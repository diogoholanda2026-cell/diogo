# Desenho do motor 3D e do visual do jogo novo

Parte "Motor 3D e visual" do jogo novo, feito do zero. Data: 27/09/2026. Referência máxima: Cities: Skylines II (CS2).
Outras: Highrise City (escala vertical), Anno 1800/117 (sombra de perto e de longe, luz) e Manor Lords (hora do dia).

Base: as pesquisas `visual.md`, `arquitetura.md`, `sistemas.md` e `ui.md` desta pasta, o código atual (consultado só
para reaproveitar peças que provaram funcionar) e o three.js 0.186.0 em `/home/user/diogo/node_modules/three`.

**Conferido hoje, nesta parte** (o que as pesquisas não tinham fechado):

- **WebGPU funciona no Chromium de teste.** Com `--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader`, numa página
  servida em `localhost` (contexto seguro), `navigator.gpu.requestAdapter()` devolve o adaptador `google/swiftshader`
  e `requestDevice()` funciona (limite de textura 8192). Sem essas opções, ou em `about:blank`, `navigator.gpu` não
  existe. A pesquisa dizia "provavelmente indisponível": não é verdade. Script: `scratchpad/cs2/sonda-gpu2.mjs`.
- **Extensões WebGL2 no Chromium de teste:** `EXT_clip_control` (profundidade invertida), `WEBGL_multi_draw`,
  `EXT_disjoint_timer_query_webgl2`, `EXT_color_buffer_float`, `OES_texture_float_linear`, ASTC e ETC2, MSAA até 4,
  textura até 8192, 32 unidades de textura no vértice. Script: `scratchpad/cs2/sonda-gpu.mjs`. No Poco X7 os valores
  reais saem da bancada (seção 15).
- **three r186, no código:** `SunLight` com 2 cascatas fixas (atlas de 2 x `mapSize`), encaixe no texel e esfera
  estável por cascata, alcance limitado por `shadow.camera.far` (`examples/jsm/lights/SunLightShadow.js`); o passe de
  sombra filtra por `object.layers.test(camera.layers)` da câmera de sombra (`WebGLShadowMap.js`, linha 522), então dá
  para ter malhas que só projetam sombra; `BatchedMesh` com `WEBGL_multi_draw` conta 1 chamada por malha
  (`WebGLBufferRenderer.js`, linha 43); `reversedDepthBuffer` no construtor do `WebGLRenderer` exige `EXT_clip_control`
  e só rende com profundidade `FloatType` (32F); `AgXToneMapping` existe no trecho `tonemapping_pars_fragment`; `Sky.js`
  tem nuvens 2D (`cloudCoverage`, `cloudDensity`, `cloudScale`, `cloudSpeed`, `cloudElevation`); `alphaToCoverage` por
  material.

---

## 0. Resultado em uma página

**Direção.** "Uma metrópole brasileira de verdade, vista de helicóptero e da calçada." Escala real em metros, sol pela
latitude e pela estação, céu físico com nuvens, neblina que azula a distância, materiais com albedo real e desgaste,
prédios gerados com volumes articulados e fachadas vivas, árvores de espécies reais, ruas com meio-fio, calçada e
faixas, e uma noite de cidade grande. Nada de mesa, maquete, tilt-shift, cor de brinquedo ou luz "da foto".

**Decisões principais.**

1. **WebGL2 (`WebGLRenderer` do three r186) no M1 ao M3**, com o código de cena, geração, LOD e ponte com a simulação
   independente do renderizador, e todo o GLSL num registro de ganchos. WebGPU fica para uma bancada A/B no M4 (agora
   testável aqui). Motivo: o desenho gasta poucas chamadas (a vantagem do WebGPU é CPU por chamada), o Mali-G615 MC2 é
   limitado por pixel e banda (o WebGPU não barateia pixel), o `WebGPURenderer` ainda tem problema aberto de desempenho
   com muitas malhas e compilação lenta de materiais de nós no celular.
2. **1 unidade = 1 metro**, y para cima, norte em -z, origem no centro do mapa. Vértices locais ao setor. Profundidade
   invertida (32F) quando houver `EXT_clip_control`; senão plano próximo dinâmico.
3. **Cena em três escalas:** setor de 256 m (fusão por material, LOD0 de perto, gerado num worker), região de 1.024 m
   (descarte e listas de instâncias) e o mapa inteiro (terreno CDLOD numa chamada, prédios de longe numa instância por
   forma).
4. **Prédios de longe custam quase nada:** o LOD1 é o mesmo conjunto de volumes do prédio, desenhado como instâncias de
   caixa (10 triângulos) com a fachada inteira no shader. De perto (LOD0) entram varandas, bordas de laje, térreo,
   telhado com equipamentos. A silhueta não muda na troca.
5. **A fachada é um shader, não uma textura pintada:** grade de andares e vãos em metros, janelas com vidro escuro que
   reflete o céu, caixilhos, peitoris, brises, desgaste, janelas acesas por hash e horário, filtrada por `fwidth` para
   não cintilar de longe.
6. **Luz:** `Sky` do r186 (no celular assado num cubo, uma face por quadro), PMREM do mesmo cubo, AgX, exposição pela
   altura do sol com mínimo à noite, neblina exponencial de altura com perspectiva aérea, bloom por redução dupla.
7. **Sombras em duas camadas:** de perto, mapa encaixado (Média: um mapa estável refeito só quando precisa; Alta e
   Ultra: `SunLight` com 2 cascatas); de longe, **sombra pelo campo de alturas da cidade**, calculada na GPU sem
   redesenhar a cena, que também dá sombra ao perfil Leve e o AO de rua (HAO). Só as caixas LOD1 e as árvores próximas
   projetam no mapa.
8. **Terreno:** mapa de alturas de 4 m por texel, CDLOD numa chamada, camadas procedurais (grama, terra roxa, rocha,
   areia, mata, uso do lote) e mapa de cor assado para o longe; mata atlântica vista de longe como copa no próprio
   terreno.
9. **Água sem redesenhar a cena:** profundidade e "refração" lidas do mapa de alturas e do mapa de cor do terreno,
   reflexo do céu com Fresnel, espuma na costa. Reflexo planar só no Ultra.
10. **Vias geradas do grafo** com perfil transversal por tipo (pista, sarjeta, meio-fio, calçada, canteiro), cruzamentos
    com raio de meio-fio e faixa de pedestre, marcas no shader, postes e árvores de rua instanciados.
11. **Noite de metrópole barata:** janelas no shader, **mapa de luz da rua** (poças dos postes assadas numa textura),
    faróis, brilho do céu sobre a área construída, lanterna da Torre.
12. **Obra à CS2:** tapume, fundação, esqueleto subindo, andaime e grua, sem geometria nova por prédio (corte no
    vértice pela tabela de prédios).
13. **Orçamento medido por cena fixa** (`?cena=`) no Chromium de teste (chamadas e triângulos exatos) e por um "Teste de
    desempenho" no aparelho (ms reais). Meta Média: até 300 chamadas e 900 mil triângulos na vista aberta com a cidade
    grande (12 mil prédios), 30 qps.

**M1 (bonito de verdade):** céu, sol e ciclo; neblina; sombras de perto e de longe; terreno com mar, rio e lago; vias
com cruzamentos; prédios gerados de 6 zonas em 5 níveis com LOD e noite; 6 espécies de árvores e mata; carros e gente
em amostra; obra com grua; Torre Lâmina e Sede; câmera à CS2 com seleção; camadas e ferramentas de via e zona
desenhadas no mundo; bancada. **Depois:** AO de tela e reflexo planar no PC, GI assada no Ultra, chuva e estações,
interiores falsos, pontes e túneis, trem e metrô, os outros megaprojetos, estilos das outras metrópoles, modo foto com
profundidade de campo, bancada WebGPU.

---

## 1. Plataforma e estrutura

### 1.1 WebGL2 ou WebGPU

| Critério | WebGL2 (`WebGLRenderer`) | WebGPU (`WebGPURenderer` + TSL) |
|---|---|---|
| Poco X7 (Mali-G615 MC2, Chrome Android) | provado: o jogo atual roda nele | Chrome liga WebGPU em Mali com Android 12+ desde a v121; driver Vulkan do Mali varia por aparelho; não medido |
| Custo por chamada (CPU) | baixo e conhecido | maior no three com muitas malhas (problema 30560, aberto e de alta prioridade; 31055: 3.000 cubos até 10 vezes mais lento) |
| Custo por pixel (o nosso gargalo) | igual | igual (mesma GPU, mesma banda) |
| Materiais próprios | `ShaderMaterial` e `onBeforeCompile` sobre os materiais do three (luz, sombra, neblina e instâncias grátis) | só TSL; nada de `onBeforeCompile`; o construtor de nós roda em JS a cada variante (carga lenta no celular) |
| Recursos que importam aqui | `SunLight` (2 cascatas), `Sky` com nuvens, `BatchedMesh` com multi-draw, AgX, profundidade invertida | os mesmos, mais computação (descarte na GPU, partículas), GTAO, SSR, TRAA (caros demais para o Mali de qualquer jeito) |
| Testes aqui | SwiftShader via ANGLE, exato em chamadas e triângulos | também funciona no Chromium de teste com as opções da seção de abertura (conferido hoje) |
| Recuo | não precisa | cai para WebGL2 sozinho, mas o backend WebGL do `WebGPURenderer` é mais lento que o `WebGLRenderer` |

**Decisão:** WebGL2 no M1 ao M3. Regras para a troca futura custar pouco:

- Todo GLSL próprio mora em `render/materiais/shaders/` e entra por um registro de ganchos (`render/motor/ganchos.js`)
  com nomes estáveis (`neblina`, `sombraLonge`, `hao`, `camada`, `noite`, `fachada`, `terreno`, `agua`, `folha`). Um
  gancho vira uma função TSL no porte.
- Geração de malhas, setores, LOD, instâncias, câmera, seleção e a ponte com a simulação não importam nada de
  `WebGLRenderer`.
- **Portão de reavaliação (M4):** a cena `bancada-aberta` nos dois renderizadores, no Poco X7 e no PC. Troca só se o
  WebGPU for 20% ou mais rápido no Poco X7 sem perder recurso.

### 1.2 Escala, eixos e precisão

- **1 unidade = 1 m.** y para cima, x para leste, **norte em -z**. Origem no centro da área jogável. Latitude de
  Heldópolis: -23,5° (Trópico de Capricórnio, como São Paulo). O ângulo do norte é um parâmetro do mapa (`NORTE_AZ`).
- **Tamanho proposto (a fechar com a simulação):** área jogável de 8.192 x 8.192 m em 16 x 16 ladrilhos compráveis de
  512 m (começa com 3 x 3 = 1,5 km, como os 9 do CS2); mundo de fora até 32 x 32 km, não jogável (mar, serras, cidades
  vizinhas em silhueta).
- **Float32 basta:** a ±16 km o passo do float32 é de 2 mm. Mesmo assim, toda malha fundida guarda vértices relativos
  ao canto do seu setor (±128 m, submilimétrico) e a posição do setor vai na matriz do objeto, que o three compõe em
  float64 na CPU.
- **Profundidade:** `reversedDepthBuffer: true` com alvo de cena de profundidade `FloatType` quando `EXT_clip_control`
  existir (existe no Chromium de teste; no Poco X7 a bancada confere). Sem ela, plano próximo dinâmico: `near =
  clamp(alturaCamera x 0,02; 0,2; 30)`, `far = clamp(distancia x 12; 4.000; 60.000)`, razão far/near até 1e5.
- **Nada de `logarithmicDepthBuffer`:** escreve `gl_FragDepth` e desliga o teste de profundidade antecipado, caro no
  Mali.

### 1.3 Três escalas de cena

| Escala | Tamanho | Para quê |
|---|---|---|
| Célula | 8 m | zoneamento (a mesma do CS2), máscara de uso do solo, marcadores de zona |
| **Setor** | 256 m (32 células) | fusão por material do LOD0 (prédios, vias, props), gerado no worker, liberado quando longe; unidade de "sujo" nos eventos |
| **Região** | 1.024 m (4 x 4 setores) | descarte grosso; listas de instâncias (LOD1 de prédios, árvores, props) compactadas por região visível |
| Mapa | 8.192 m (8 x 8 regiões) | terreno CDLOD, água, céu, campos (alturas da cidade, sombra de longe, luz da rua, dados de camada) |

- **Fusão por material** (a ideia que provou funcionar no jogo atual): no LOD0 cada setor vira uma malha por família de
  material (`edificio`, `via`, `calcada`, `pbr` dos props). Um prédio não é um objeto; é um trecho de vértices com o
  atributo `aId`.
- **Instâncias** para o que se repete (caixas LOD1, árvores, postes, carros, gente, grua). `InstancedMesh` desenha
  `[0, count)` e não descarta por instância, então **o buffer é compactado com as regiões visíveis** (mais as que podem
  jogar sombra para dentro da vista) só quando esse conjunto muda, com histerese. Custo: uma cópia de 1 a 2 MB em
  arrays tipados e um envio parcial, raros; zero por quadro.
- **`BatchedMesh`** (1 chamada com `WEBGL_multi_draw`, descarte por item na CPU) fica para peças soltas que mudam muito
  (a Arcologia por etapas, props especiais). Não para 20 mil prédios: o descarte por item custa 0,5 a 1 ms de JS por
  quadro no celular.
- **LOD por tamanho em tela,** com distância de referência por perfil e histerese de 10%. Troca com dissolução por
  pontilhado (`alphaHash` no shader, 250 ms) para não "estalar".
- **Descarte:** região e setor contra o tronco da câmera (caixa, não esfera: as malhas fundidas são largas e baixas; o
  jogo atual já faz isso com `userData.cullCaixa`); oclusão só por horizonte do terreno na CPU (serras escondem regiões).
- **Oficina (worker):** a geração do LOD0 dos setores (prédios, vias, cruzamentos, props) roda num Web Worker que
  importa os mesmos geradores puros. Devolve arrays tipados transferíveis. A thread principal só cria a
  `BufferGeometry` e envia à GPU, no máximo **um setor por quadro** (1 a 3 ms). Cache LRU de 64 setores (Média 36).

### 1.4 Laço do quadro

1. Entrada e câmera (inércia, colisão).
2. Eventos da simulação desde o último quadro (fila; aplicação com teto de 2 ms por quadro, o resto no próximo).
3. Seleção de LOD e de regiões visíveis; pedidos à oficina; recebimento de um setor pronto.
4. Atualizações raras em fatias: cubo do céu (1 face), PMREM, sombra de longe (1 ladrilho), campo de alturas (1
   retângulo sujo).
5. Instâncias animadas (carros, gente, grua).
6. Render: sombra de perto (se suja), cena (MSAA), bloom, composição.
7. `engine.stats`.

**Reaproveitado do jogo atual** (`fonte/render/engine.js`): alvo HDR `R11F_G11F_B10F` com MSAA quando o aparelho
aceita, bloom por redução dupla a 1/4, resolução dinâmica em degraus com histerese, limite de quadros por estado
(carga, ocioso, modal), triângulo de tela cheia, perda e volta do contexto. Sai: `PBR Neutral` fixo, tintas de sombra
e realce, saturação 1,2, vinheta padrão.

---

## 2. Iluminação e atmosfera

### 2.1 Sol, lua e céu

- **Astronomia** (`render/ambiente/astro.js`): posição do sol pela latitude, pelo dia do ano e pela hora (declinação e
  equação do tempo simplificadas, erro menor que 1°); lua com fase; noites mais longas no inverno. A hora e o dia vêm
  da simulação (seção 14). "Sempre dia" é opção.
- **Céu:** `Sky` do r186 (Preetham, disco do sol, nuvens 2D com sombra própria e borda prateada). Turbidez, Rayleigh e
  Mie por hora e por clima (céu tropical: turbidez 2,5 a 4; mais no fim da tarde e na seca).
  - **PC:** desenhado direto (1 chamada, só pixels de céu).
  - **Celular:** assado num cubo de 128 (Média) ou 64 (Leve), **uma face por quadro**, refeito quando o sol anda 0,5° ou
    as nuvens mudam; o fundo lê o cubo (1 leitura por pixel). O `Sky.js` faz Preetham mais 5 ruídos por pixel: caro
    demais por quadro no Mali.
  - **Noite:** estrelas (textura procedural em coordenada celeste, giram com a hora), lua com halo e **brilho da cidade**
    (laranja no horizonte, proporcional à soma do mapa de luz da rua, seção 2.9).
- **Sombras das nuvens:** textura de ruído rolando com o vento, lida pelo gancho de sombra de todos os materiais (1
  leitura). Coerente com a cobertura do `Sky`.

### 2.2 Luz do ambiente (IBL)

- PMREM gerado do mesmo cubo do céu (sem disco do sol), refeito quando o sol anda 2° ou a fase do dia muda; pico de 1 a
  3 ms raro. Tamanhos: 256 (Ultra), 128 (Alta), 64 (Média), 32 (Leve).
- À noite o PMREM leva o brilho da cidade, então vidro e água refletem um céu alaranjado sobre os bairros acesos.
- Hemisfério tingido pelo chão (verde-oliva ou terra) só quando não houver PMREM (Leve sem float).

### 2.3 Curva de tons, exposição e gradação

- **AgX** (trecho do three incluído na composição), saturação 1,0, contraste pela curva, sem tintas. **PBR Neutral**
  como opção nas Configurações (A/B por captura no aceite do M1).
- **Exposição por elevação do sol:** dia 1,0; hora dourada 1,2; hora azul 2,5; noite 6 a 8 (a "exposição mínima" que
  falta ao CS2, criticado pela noite escura demais). Transição suave em 30 s de jogo.
- Balanço de branco: sol quente no nascer e no pôr (3.500 K), neutro ao meio-dia (5.800 K), sombra azulada pelo céu
  (física, não tinta).
- **CAS** (nitidez adaptativa, 5 leituras) na composição quando a resolução dinâmica cai abaixo de 1,0.
- Pontilhado de 1 nível contra faixas no céu (já existe).
- LUT 3D de 32³ só no modo foto (M2).

### 2.4 Neblina de altura e perspectiva aérea

- Troca dos trechos `fog_pars_*` e `fog_fragment` do `ShaderChunk` (todos os materiais com `fog: true` herdam, inclusive
  os de instância e os próprios).
- Densidade `β(y) = β0 · exp(-(y - y0) / H)`, integrada em forma fechada ao longo do raio (câmera ao fragmento). Valores
  de dia claro: `β0 = 1,7e-4 /m` (50% de névoa a ~4 km no chão), `H = 1.200 m`; manhã úmida: névoa baixa com `H = 150
  m` nos vales; seca: mais Mie (poeira) e cor mais quente.
- **Cor do espalhamento** = cor do horizonte do céu na direção do olhar mais um lóbulo de Henyey-Greenstein (g = 0,7) na
  direção do sol. À noite, cor do brilho da cidade.
- Custo: ~15 operações por pixel, 0 chamadas, 0,05 a 0,15 ms no Média. É o que mais tira o "objeto pequeno" da imagem.

### 2.5 Sombras

**Regra:** só projeta sombra o que tem altura e aparece de longe. O LOD0 detalhado dos prédios **não** projeta; quem
projeta é a caixa LOD1 do mesmo prédio (mesma silhueta), numa camada que só a câmera de sombra vê (`layers` 1). Assim o
passe de sombra custa 1 chamada por forma de volume, e não uma por setor. Árvores próximas projetam com material de
profundidade próprio (recorte alfa). Terreno, vias, água, gente e props pequenos não projetam no mapa.

| Perfil | Sombra de perto | Sombra de longe |
|---|---|---|
| Ultra | `SunLight` 2 cascatas de 2048 (atlas 4096 x 2048), alcance 1.500 m, PCF de 8 amostras | campo de alturas 2048² (4 m) |
| Alta | `SunLight` 2 cascatas de 1024, alcance 900 m, PCF 8 | campo de alturas 2048² |
| Média (Poco X7) | um mapa de 1024 **estável**: centro no alvo da câmera, raio `clamp(0,6 x distância; 60; 700)` m, encaixado no texel, refeito só quando o alvo anda 15% do raio, o zoom muda 20% ou o sol anda 0,5°; PCF 5 | campo de alturas 1024² (8 m) |
| Leve | nenhuma | campo de alturas 1024² |

- As cascatas do `SunLight` acompanham a câmera: no PC são refeitas em todo quadro com a câmera andando e nenhuma vez
  com ela parada.
- **Sombra de longe pelo campo de alturas** (`render/ambiente/sombraLonge.js`):
  1. O **campo de alturas da cidade** (terreno mais o topo das caixas LOD1, R16F) é desenhado de cima, em projeção
     ortográfica, só nos retângulos sujos quando prédios ou terreno mudam.
  2. Para cada texel, um passe de GPU anda na direção do sol e grava a **altura de sombra**: `s(p) = max_k(h(p + k·Δ·d)
     - k·Δ·tan(elevação))`, com passo crescente (4 a 32 m, 48 passos).
  3. No material, um fragmento em (x, y, z) está na sombra se `y < s(x, z) - viés`, com penumbra por `smoothstep`
     proporcional à distância. **Uma leitura por pixel.**
  4. Refeito em 16 ladrilhos, um por quadro, quando o sol anda 0,75°; dois mapas com mistura cruzada para não saltar.
     Custo estimado no Média a 1024²: ~1 ms por quadro durante a atualização, a cada ~2 s de relógio.
  5. Mistura com a sombra de perto na borda do mapa de perto (faixa de 10%).
- O mesmo campo dá a **colisão da câmera** (cópia na CPU a 8 m) e o **HAO** (seção 2.6).

### 2.6 Oclusão de ambiente

- **AO por vértice cozida** em toda geometria gerada (pé de parede, canto de laje, sob beiral e varanda, junta com o
  chão, dentro de pátios): custo zero por quadro, 1 atributo (`aAO`, Uint8 normalizado).
- **HAO** (oclusão pelo campo de alturas, a peça que já existe no jogo atual): escurece ruas estreitas entre prédios
  altos e a base das torres; 1 leitura, junto com a sombra de longe na mesma textura (RG).
- **AO de tela por profundidade** (estilo N8AO, meia resolução com reescala que respeita a profundidade) só no PC
  (Alta meia, Ultra inteira), no M2. O `GTAOPass` do three redesenha a cena com `MeshNormalMaterial`: fora.

### 2.7 Antisserrilhado e estabilidade

- MSAA 4x (PC) e 2x (Média), quase de graça em GPU por blocos. Sem TAA (sem vetores de movimento e com rastro em poucos
  quadros).
- **Filtragem analítica das fachadas:** as linhas de janela, caixilho e faixa de laje são funções de `u, v` em metros
  filtradas por `fwidth`; quando uma célula de janela fica menor que ~2 px, o shader troca pela média (albedo médio,
  fração de vidro, fração de janelas acesas). Sem isso a cidade cintila de longe.
- **AA especular:** rugosidade aumentada pela variação da normal na tela (Toksvig simplificado) em vidro e água.
- **Alfa por cobertura** (`alphaToCoverage`) nas folhas e no andaime, com o MSAA.

### 2.8 Bloom

Redução dupla a 1/4, 5 níveis no PC e 4 no Média, limiar 1,1 de dia (só sol refletido e céu estourado) e 0,8 à noite
(janelas, postes, faróis, lanterna da Torre). Leve sem bloom.

### 2.9 Ciclo de dia e noite; noite de metrópole

- O céu, a exposição, a neblina e as luzes seguem a hora. Quadros-chave por fase: madrugada, aurora, manhã, meio-dia,
  tarde, pôr do sol, hora azul, noite.
- **Janelas** (no shader da fachada, seção 5.2): cada janela tem uma semente; a fração acesa segue a agenda do uso
  (moradia: 18h a 23h até 75%, madrugada 8%; escritório: 8h a 18h, à noite 15% de limpeza; comércio: vitrines de 8h a
  22h; indústria: 24 h em pontos). A hora de acender de cada janela é deslocada pela semente: a cidade acende janela a
  janela. Cor de 2.700 K a 5.000 K, parte com cortina (luz filtrada), parte com a luz azulada de tela.
- **Mapa de luz da rua** (`render/mundo/luzRua.js`): textura RGBA8 de 2048² sobre a área jogável (4 m por texel). Cada
  poste é desenhado nela como uma gaussiana aditiva (raio 12 a 18 m) numa passada de instâncias, refeita quando as vias
  mudam. Chão, vias, calçadas, lotes, o térreo das fachadas (até 8 m, atenuado) e a água leem 1 texel à noite. Não há
  luz dinâmica real.
  - **Variedade:** bairros antigos com vapor de sódio (âmbar), bairros novos com LED (branco neutro, 4.000 K), avenidas
    com LED mais forte.
- **Faróis e lanternas:** emissivo por instância nos carros (branco quente na frente, vermelho atrás), com bloom. No
  Ultra, um cone de luz barato no asfalto à frente dos 40 carros mais perto (M2).
- **Céu da cidade:** a soma do mapa de luz por região tinge o horizonte e a neblina (brilho alaranjado).
- **Arcologia:** lanterna da Torre em gradiente lento, linhas dos andares de vento, aro do heliponto, luz vermelha no
  mastro piscando; vórtice e Supertrees no M2.
- **Legibilidade à noite:** exposição mínima, ruas e contornos dos prédios nunca pretos, marcadores e camadas com o
  mesmo contraste do dia.

### 2.10 Perfis de qualidade

Custos em ms são **estimativas** para o Poco X7 no Média (0,64 MP, 30 qps) pela conta de banda e leituras de textura do
Mali; a bancada no aparelho (seção 15) troca pelo número medido.

| Recurso | Ultra (PC) | Alta (PC médio) | Média (Poco X7) | Leve | Custo no Média |
|---|---|---|---|---|---|
| Resolução interna (x CSS) | 1,5 a 2,0 | 1,0 a 1,5 | 0,85 a 1,3 | 0,7 a 1,0 | |
| Antisserrilhado | MSAA 4x | MSAA 4x | MSAA 2x | nenhum, CAS | ~0,3 ms |
| Céu | `Sky` direto + nuvens | `Sky` direto + nuvens | cubo 128, 1 face por quadro | cubo 64 sem nuvens | 0,1 ms |
| PMREM | 256 | 128 | 64 | 32 | pico raro 1 a 3 ms |
| Tons e pós | AgX, bloom 5, CAS | idem | AgX, bloom 4, CAS | AgX no renderer, sem pós | 0,9 ms |
| Neblina | altura + aérea + sol | idem | idem | exponencial simples | 0,1 ms |
| Sombra de perto | 2 cascatas de 2048, 1,5 km | 2 de 1024, 900 m | 1 mapa 1024 estável | não | 0,3 ms leitura; refazer 1 a 2 ms raro |
| Sombra de longe e HAO | 2048² | 2048² | 1024² | 1024² | 0,1 ms + ~1 ms a cada 2 s |
| AO | tela inteira + HAO + vértice (M2) | tela meia + HAO + vértice (M2) | HAO + vértice | vértice | 0 |
| Terreno, detalhe até | 600 m, normal de detalhe, triplanar na rocha | 400 m | 150 m, sem normal de detalhe | só mapa de cor | 1,5 a 2,5 ms |
| Prédios LOD0 até | 900 m | 600 m | 350 m | 200 m | 2 a 4 ms |
| Fachada | janelas + interior falso (M2) + relevo de perto | janelas + interior falso de perto (M2) | janelas procedurais | janelas simplificadas | incluído acima |
| Árvores LOD0 / LOD1 / impostor | 200 m / 700 m / 4 km | 150 / 500 m / 3 km | 100 / 400 m / 2,5 km | 60 / 250 m / 1,5 km | 1,5 a 3 ms |
| Carros / pessoas visíveis | 400 / 1.600 | 240 / 900 | 120 / 420 | 50 / 150 | 0,5 ms |
| Água | Fresnel, espuma, ondas no vértice, planar do lago (M2) | sem planar | ondas por normal | Fresnel sem espuma | 0,5 ms |
| Noite | tudo | tudo | tudo | janelas e postes | 0,1 ms |
| GI assada | sondas na Arcologia (M3) | não | não | não | |
| Teto de memória de textura | 700 MB | 400 MB | 250 MB | 150 MB | |
| **Meta: chamadas / triângulos / qps** | **1.500 / 5 mi / 60** | **800 / 2,5 mi / 60** | **300 / 900 mil / 30** | **200 / 500 mil / 30** | total estimado 12 a 18 ms |

**Escolha automática:** PC sem GPU de software → Ultra (Alta se a bancada mostrar menos de 60 qps); celular com
`Mali-G6xx MC2` ou Adreno 6xx → **Média** (o jogo atual escolhe Alta para o Poco X7 por uma regex larga: corrigir);
Mali ou Adreno de ponta → Alta; resto → Leve. A bancada pode trocar o perfil sugerido.

---

## 3. Terreno e água

### 3.1 Mapa de alturas e malha

- **Dono das alturas: a simulação** (o terreno é regra: vias e lotes aplainam). O render recebe um `Float32Array` de
  2049 x 2049 amostras a 4 m (área jogável) e outro de 1025 x 1025 a 32 m (mundo de fora), e eventos de retângulo sujo.
- Na GPU: textura R32F (leitura exata no vértice por `texelFetch` com bilinear manual) e **mapa de normais** RG8
  derivado por um passe quando a altura muda.
- **CDLOD** (`render/mundo/terreno.js`): uma grade de 32 x 32 quadrados instanciada, uma instância por nó de quadtree
  escolhido na CPU a cada quadro (100 a 300 nós, desprezível). O vértice lê a altura e faz o "morph" entre níveis (sem
  rachaduras nem estalos). **1 chamada para o terreno inteiro**, 60 a 150 mil triângulos conforme a vista. O mundo de
  fora usa o mesmo shader com a segunda textura.
- O terreno não projeta no mapa de sombra: a autossombra de morros vem da sombra de longe.
- **Copa da mata no terreno:** onde a densidade de floresta passa de 0,6, o vértice sobe até 18 m (a altura da copa) e o
  fragmento usa a cor e a normal de copa. De longe, a mata atlântica é um volume com relevo e sombra, sem instância
  nenhuma. De perto, a copa baixa para o chão e as árvores instanciadas assumem (faixa de transição de 150 m).

### 3.2 Camadas e cor

- **Camadas** (texturas procedurais em `DataArrayTexture`, seção 9): grama tropical, capim seco, terra roxa (latossolo),
  terra clara, rocha (granito), areia de praia, chão de mata (folhiço), e os usos do lote: gramado aparado, cascalho,
  piso de concreto, terra de obra.
- **Pesos por pixel:** declividade (rocha acima de 35°), altura perto da água (areia e lodo), umidade e ruído (grama x
  terra), estação (capim amarela de maio a setembro), densidade de floresta (folhiço) e a **máscara de uso do solo**
  (RGBA8, 2 m por texel: lote construído, jardim, estacionamento, obra, via) que o render pinta a partir dos lotes e das
  obras.
- **Mapa de cor assado** (2048² no Média e 4096² no PC, sobre a área jogável): a mistura das camadas vista de longe, com
  macrovariação. Longe de ~150 a 600 m (por perfil), o terreno lê só esse mapa, o de normais, o de sombra e HAO e, à
  noite, o de luz da rua (4 leituras). De perto, mais as 2 camadas de maior peso (albedo com rugosidade, e normal no PC).
- Albedos na seção 9.2.

### 3.3 Horizonte

- Mundo de fora com serras (ruído de relevo com erosão simples, gerado uma vez pela semente do mapa), mar até o
  horizonte e silhuetas de cidades vizinhas (caixas LOD1 sem janela, cor da neblina).
- Com a câmera baixa, o horizonte se funde ao céu pela neblina, sem costura (captura `h1-horizonte` no aceite).

### 3.4 Água

**Uma família de material, 1 a 3 chamadas:** mar (grade grande no nível 0), lagos (polígonos planos em nível próprio),
rios (faixa gerada ao longo de uma spline com nível por ponto e direção de fluxo).

- **Profundidade sem ler o buffer de profundidade:** `prof = nivelAgua - altura(x, z)`, lida do mapa de alturas.
  - Cor por absorção (Beer): turquesa no raso, azul-petróleo no fundo do mar; verde-oliva e turva no rio.
  - **"Refração" barata:** no raso, a cor do fundo é o mapa de cor do terreno no mesmo (x, z), escurecida pela
    profundidade. Areia vista através da água sem copiar a tela.
  - **Espuma** na linha da costa e nas margens por `prof` pequena e ruído animado; arrebentação no mar.
- **Ondas:** dois mapas de normal rolando em direções diferentes (lago: vento fraco; mar: forte; rio: seguindo o
  fluxo). No PC, Gerstner no vértice perto da costa.
- **Reflexo:** PMREM com Fresnel (F0 = 0,02), rugosidade 0,04 a 0,15 pelo vento, cintilação do sol, à noite o brilho
  da cidade e o mapa de luz das margens. **Reflexo planar** do lago da Arcologia só no Ultra (M2), a 1/4 da resolução,
  com uma camada restrita (Torre, Sede, céu).
- A água não escreve profundidade para o passe de sombra; recebe sombra de perto e de longe.

---

## 4. Vias

### 4.1 Tipos e perfil transversal

A tabela de tipos (compartilhada com a simulação, em `data/vias.js`) descreve o **perfil transversal** de fora para
dentro, em metros. Exemplos do M1:

| Tipo | Largura | Perfil | Props |
|---|---|---|---|
| `rua2` (rua local, mão dupla) | 16 m | calçada 3 + meio-fio 0,15 + pista 2 x 3,5 (estacionamento opcional 2,5 de um lado) + meio-fio + calçada 3 | postes a cada 30 m alternados; árvores de rua (oiti) a cada 12 m |
| `avenida4` (avenida com canteiro) | 32 m | calçada 4 + pista 2 x 3,5 + canteiro 4 (grama, palmeira-imperial) + pista 2 x 3,5 + calçada 4 | postes duplos no canteiro a cada 35 m |
| `via6` (arterial) | 38 m | calçada 4 + pista 3 x 3,5 + canteiro de concreto 2 + pista 3 x 3,5 + calçada 4 | postes altos no canteiro; sem árvores |
| `pedestre` | 10 m | piso de pedra portuguesa (o calçadão carioca) | bancos, árvores, luminárias baixas |

Rodovia, ciclovia, VLT, pontes, viadutos e túneis entram depois (M3 em diante), no mesmo esquema de perfil.

### 4.2 Malha de cada aresta

- A aresta é uma **Bézier cúbica** (ou reta) com tipo e cotas das pontas. Amostragem adaptativa: nova seção quando o
  desvio passa de 2° ou a cada 8 m.
- **Varredura do perfil** ao longo da curva, com a normal do plano horizontal (sem torção), a altura seguindo o terreno
  já aplainado pela simulação e inclinação transversal de 2% para a sarjeta.
- Atributos: `u` = posição lateral em metros (0 no eixo), `v` = comprimento de arco em metros, `aMat` (pista, sarjeta,
  meio-fio, calçada, canteiro), `aMarca` (código do padrão de faixas do tipo), `aId` (índice da aresta, para camadas e
  seleção), `aAO`.
- Meio-fio com face vertical de 15 cm e chanfro de 2 cm (pega o sol); a calçada tem 2 cm de caimento para a rua.

### 4.3 Cruzamentos

- Em cada nó de grau 3 ou mais (e de grau 2 com ângulo acima de 25° ou troca de tipo):
  1. Para cada par de arestas vizinhas (em ordem angular), acha onde as bordas das calçadas se cruzam e **recorta cada
     aresta** na maior distância necessária mais o raio de meio-fio.
  2. **Polígono da pista**: liga as bocas recortadas com arcos de concordância de meio-fio (raio 5 m em rua, 8 m em
     avenida), triangulado.
  3. **Esquinas de calçada**: o deslocamento dos arcos, com rampa de acessibilidade na faixa de pedestre.
  4. **Marcas:** faixa de pedestre (zebra) em cada boca, linha de retenção, setas (M2); no shader, pelo `u, v` local da
     boca.
- Ponta sem saída: cul-de-sac com raio de 9 m. Transição entre tipos: afunilamento de 20 m.
- **Teste de junta** (em node): toda boca recortada coincide com os vértices do polígono do cruzamento a menos de 1 cm;
  nenhum buraco nem sobreposição (área da pista = soma das partes).

### 4.4 Superfície e marcas

- **Asfalto procedural:** agregado, fissuras, remendos, trilha de pneu mais escura e polida no meio de cada faixa
  (calculada por `u`), óleo no meio da faixa, borda desgastada; mais novo nas vias recém-feitas (idade da aresta).
- **Marcas no shader:** a posição das linhas vem de uma tabela de padrões por tipo (até 8 linhas por padrão, cor,
  tracejado de 3 m com vão de 9 m, contínua dupla amarela no eixo), filtrada por `fwidth`. Sem geometria nem decalque.
- **Calçada:** concreto em placas, ou pedra portuguesa em ondas nos calçadões e na orla (o padrão de Copacabana em
  shader), grelhas e tampas de bueiro por hash.
- **Props** (instanciados por região): postes (3 modelos: urbano, avenida, decorativo), árvores de rua pela espécie do
  tipo, placas, semáforos nos cruzamentos de avenida, pontos de ônibus (M2), hidrantes, lixeiras.

### 4.5 Fusão e LOD

- LOD0 por setor: pista e calçada numa malha (`via`), meio-fio e canteiro na mesma, props instanciados. 1 a 2 chamadas
  por setor.
- LOD1 (longe, por região): sem meio-fio em geometria, marcas trocadas pela média, amostragem a cada 16 m, props só os
  postes (à noite eles vivem no mapa de luz).
- A camada de trânsito pinta a pista pelo `aId` (seção 11).

---

## 5. Prédios da cidade: o gerador

O objetivo é o nível do CS2: volumes articulados, fachadas coerentes com o uso e o nível, térreo ativo, telhados com
equipamento, lote inteiro tratado, e variedade sem cara de caixa. Tudo procedural e determinístico pela semente, em
duas etapas puras (testáveis em node): **plano** (dados) e **malha** (geometria).

### 5.1 Plano do prédio (gramática)

**Entrada:** `{ lote: 4 pontos (frente na via), frente, fundo, zona, densidade, nivel 1 a 5, estilo (cidade e bairro),
semente, cor? }`.

**Saída (`planoPredio`)**: lista de volumes, fachada por volume, térreo, topo, lote.

```js
{
  volumes: [{ forma: 'caixa'|'chanfro'|'cilindro12'|'L', x, z, w, d, y0, h, giro,
              fachada: { tipo, andar, vao, peitoril, janela, cor, cor2, vidro, relevo }, topo: { tipo, itens } }],
  terreo: { tipo: 'loja'|'pilotis'|'portaria'|'garagem'|'galpao', altura },
  lote: { recuo, piso: 'jardim'|'estacionamento'|'patio', muro: 'grade'|'muro'|'nenhum', arvores: [[x, z, especie]] },
  caixa: [xmin, ymin, zmin, xmax, ymax, zmax], alturaTopo, areaUtil
}
```

**Tipologias por zona e nível** (Heldópolis, modernismo tropical brasileiro; o CS2 muda o visual a cada dois níveis, e
nós também):

| Zona | Níveis 1 e 2 | Níveis 3 e 4 | Nível 5 |
|---|---|---|---|
| Residencial baixa | casa térrea e sobrado, telha cerâmica ou laje com caixa d'água, muro e portão, quintal | sobrado geminado, varanda, pastilha | casa de alto padrão: laje plana em balanço, madeira, piscina |
| Residencial média | prédio de 4 a 6 pavimentos sobre pilotis, janelas em fita, cobogó na escada | 8 a 12 pavimentos, varandas, garagem no térreo | 12 a 16 com varanda gourmet de vidro |
| Residencial alta | torre de 15 a 20 sobre pódio, pele de pastilha e janelas | 25 a 35 com varandas corridas e coroamento | 40 a 60, vidro e aletas, terraço no topo, heliponto (a Torre da Holding sempre maior) |
| Comercial | loja térrea com toldo e letreiro, 1 a 2 pavimentos em cima | galeria com vitrines em dois níveis, fachada de vidro | centro comercial com pele perfurada e marquise |
| Escritório | lâmina de 6 a 10 com brises horizontais | 12 a 25 com pele de vidro e montantes | 30 a 45, vidro de controle solar, coroamento iluminado |
| Industrial | galpão com telhado em shed ou arco metálico, pátio de carga | galpão maior, silos, pontes rolantes externas | fábrica limpa com fachada de painel e vidro |

- **Volumes:** base (pódio ou corpo), torre recuada, anexos; recuos em degraus a partir do nível 3; chanfros e cilindro
  no nível 5 de escritório; forma em L nos lotes de esquina.
- **Variação pela semente:** paleta do estilo (tons reais: branco-gelo, areia, terracota, cinza concreto, verde-oliva de
  pastilha, azul-acinzentado; nada de saturado), razão de janela, vão, padrão de varanda, lado do anexo, itens do telhado.
- **Estilo por metrópole** entra como tabela (`data/estilos.js`); o M1 tem só Heldópolis.

### 5.2 Fachada no shader (o coração do visual)

Material `edificio`: `MeshStandardMaterial` com ganchos (seção 9.1) que calculam albedo, rugosidade, metalicidade,
normal e emissivo por pixel a partir de:

- `u` (metros ao longo da face) e `v` (metros desde o chão do volume), normal da face, parâmetros do volume (tipo de
  fachada, andar, vão, peitoril, janela, cores) e a semente.
- **Grade:** andar = `floor(v / andar)`, vão = `floor(u / vao)`. Dentro da célula: caixilho, vidro, peitoril,
  montante, pano cego, laje. Cada tipo de fachada (janela em fita, janela solta, pele de vidro com montantes, brise
  horizontal, brise vertical, cobogó, varanda, painel pré-moldado, pastilha, tijolo, galpão) é uma função pequena.
- **Vidro:** escuro e reflexivo (F0 0,04 a 0,08, rugosidade 0,05 a 0,12), com **leve inclinação da normal por painel**
  (a ondulação real das peles de vidro, que quebra o reflexo em mosaico e é o que mais faz uma torre parecer real).
  Atrás: cortina ou persiana por hash de dia; interior falso por leitura de atlas de salas no Alta e Ultra (M2).
- **Desgaste:** escorrido vertical sob peitoris, pé de parede mais escuro (0,5 m), sujeira no topo das platibandas,
  variação de tom por painel, manchas de umidade no concreto (mais nos níveis baixos e nos prédios antigos).
- **Noite:** janelas acesas pela agenda da seção 2.9; `emissivo = cor(K) x intensidade x aceso(hash, hora, uso)`.
- **Filtragem** por `fwidth` e troca pela média de longe (seção 2.7). O LOD1 usa a mesma função: a fachada de perto e
  de longe é a mesma.
- **Custo:** 40 a 60 operações e 1 a 2 leituras (ruído e, no PC, normal de detalhe) por pixel de fachada.

### 5.3 Níveis de detalhe

| LOD | Quando | O que é | Triângulos por prédio | Chamadas |
|---|---|---|---|---|
| LOD0 | até 350 m (Média) | volumes com relevo: faixa de laje (5 a 10 cm), varandas extrudadas, térreo recuado com vitrine e toldo, pilotis, platibanda, caixa d'água, casa de máquinas, condensadoras, antenas, telhado cerâmico em geometria; AO cozida | casa 300 a 600; médio 600 a 1.500; torre 1.000 a 2.500 (teto Média 1.200) | 1 a 2 por setor (fundido) |
| LOD1 | além do LOD0 | os mesmos volumes como **instâncias de forma** (caixa 10 triângulos, chanfro 18, cilindro12 44, L 20) com a fachada inteira no shader e o topo pelo tipo de telhado | 10 a 60 | 1 por forma no mapa inteiro (4) |
| LOD2 | além de 2,5 km (Média) | só o volume principal, fachada pela média (cor, fração de vidro, fração acesa) | 10 | nas mesmas instâncias |

- Cada instância LOD1 leva: posição, tamanho, giro (3 + 3 + 1 floats), parâmetros de fachada (vec4), cor (RGB8 empacotado)
  e `aId`. 20 mil prédios x 2,5 volumes = 50 mil instâncias, ~2,4 MB.
- As caixas LOD1 também são as que **projetam sombra** (camada 1) e as que alimentam o campo de alturas.
- Troca LOD0/LOD1 por setor, com dissolução.

### 5.4 O lote inteiro

O CS2 convence porque o prédio vem com o lote. O plano traz o lote e o render desenha:

- **Piso** pela máscara de uso do solo (jardim, estacionamento com vagas pintadas, pátio de carga, quintal de terra).
- **Muro ou grade** na frente (brasileiro: muro de 2 m com portão nas casas, grade nos prédios), como geometria LOD0
  fundida.
- **Árvores e arbustos** do lote (espécies do estilo), carros estacionados, piscina no residencial de nível alto,
  caçambas e paletes na indústria. Instanciados por região.

### 5.5 Estados

- **Abandonado:** janelas sem luz, vidros quebrados (hash), pichação e sujeira mais fortes, mato no lote.
- **Selecionado ou sob o cursor:** realce de borda por Fresnel e brilho leve, pelo `aId` igual ao uniforme
  `uSelecionado`. Zero chamadas a mais.
- **Cor escolhida pelo jogador:** substitui a cor principal (prédios da Holding).
- **Camada ligada:** a cor vem da tabela de dados (seção 11.1).

### 5.6 A tabela de prédios na GPU

Textura RGBA de 512 x 512 (262 mil vagas) indexada pelo `aId` (índice denso vindo da simulação), lida no vértice por
`texelFetch`:

- R: valor da camada ativa (0 a 255 na rampa); G: progresso da obra (0 a 255); B: flags (abandonado, selecionado, da
  Holding, apagado); A: variação de agenda (deslocamento das luzes).
- Atualizada por `texSubImage2D` só nas vagas que mudaram.

---

## 6. Megaprojetos da Arcologia

Modelos de autor em código (`render/arcologia/`), com as mesmas regras: medidas vindas de um único objeto de plano (como
o `A` do jogo atual), fusão por material, repetições instanciadas, fachada no shader onde couber, LOD1 próprio, peças
ligadas às etapas da obra.

**Escala.** A `arquitetura.md` foi escrita em unidades do jogo atual (1 u = 7,5 m; Torre com 26 u = 195 m). No jogo
novo a Arcologia é um distrito real. **Proposta (fechar com o integrador):** planta do Trevo a 10 m por unidade antiga
(800 x 620 m, 50 ha, o tamanho do distrito de Marina Bay Sands) e alturas redesenhadas para escala de megaprojeto:

| Peça | Referências | Medidas propostas | LOD0 Média / Ultra (triângulos) |
|---|---|---|---|
| **Torre Lâmina** (a Torre da Holding) | One Vanderbilt, 111 West 57th, 432 Park, Edge (30 Hudson Yards) | planta 36 x 50 m (lado estreito ao sul); pódio de 16 m; corpo em 4 blocos (3 de 18 pavimentos de 4,2 m e 1 de 9) separados por andares de vento de 6 m; face sul recua em 4 "penas" (0, 5, 11, 17 m) com terraços-jardim; coroa-lanterna de 30 m; **heliponto a 330 m** em balanço de 16 m sobre o lago; mastro até 350 m | 4 mil / 9 mil |
| Torres do Conselho (2) | Tencent Seafront, Bloomberg | 150 m, planta 36 x 26 m com cantos de raio 6 m, moldura de pedra de 2 pavimentos e aletas de bronze | 2,5 mil cada |
| Sede (faixa curva) | Apple Park, Bloomberg, Google Bay View | 33 m, moldura de pedra, cobertura solar em escamas | 8 mil |
| Anel Mestre (moradia) | Marina One, Interlace, Tietgen, Bosco Verticale | 30 a 60 m em anfiteatro voltado ao sul, cortina de vidro por fora e vale verde em terraços por dentro | 24 mil |
| Biblioteca (Diamante) | Biblioteca Nacional do Catar, Tianjin Binhai | 76 x 76 m, quinas a 55 m, esfera de 36 m, pináculo a 75 m | 5 mil |
| Cúpula da Vida | Jewel Changi, Gardens by the Bay | casca em gota de 96 m de diâmetro e 70 m, óculo com vórtice | 5 mil |
| Universidade, Escola, contorno, eixo, lago, Física | ver `arquitetura.md` 6 e 7 | escala 10 m por unidade | ~80 mil somados |

- **Torre Lâmina em detalhe (render):** blocos por extrusão de um retângulo com quinas recortadas (1,5 x 1,5 m) e a
  costura de ouro nas faces leste e oeste (reentrância de 2,5 x 1,5 m); aletas verticais de bronze a cada 1,5 m nas
  faces sul, leste e oeste (no Ultra em geometria instanciada, ~290 aletas de 12 triângulos; no Média, relevo e sombra
  no shader da fachada `peleVidroAletas`); andares de vento escuros com forro dourado (as três horizontais, que à noite
  viram linhas de luz); terraços com árvores instanciadas e guarda-corpo de vidro; heliponto em laca preta com aro de
  luz e "H" dourado; lanterna com aletas mais densas e o último trecho oco contra o céu. O helicóptero da Holding pousa
  no ponto `pouso` do plano.
- **LOD1 da Arcologia** (vista da cidade): volumes com a fachada do shader, sem aletas, caixas salientes nem árvores de
  terraço, ~25 mil triângulos.
- **Chamadas:** até 45 no Média (materiais: `edificio` com os tipos de fachada da Arcologia, `pbr` para pedra, bronze,
  laca, ouro e vidro-lanterna, folhas, água).
- **Obra por etapas:** cada peça do modelo tem `etapa` e `parte`; a etapa em obra usa o mesmo corte por altura da seção
  12 (as peças são malhas próprias, com o progresso num uniforme), com gruas proporcionais (a da Torre a 360 m).
- **M1:** Torre Lâmina e Sede com as Torres do Conselho e o lago. O resto da Arcologia no M2 (depende de a simulação
  trazer as etapas).

---

## 7. Vegetação

### 7.1 Espécies reais (M1)

| Espécie | Onde | Forma | Estação |
|---|---|---|---|
| Palmeira-imperial | avenidas, eixo da Arcologia | tronco liso de 25 m, coroa de palmas | sempre verde |
| Coqueiro | orla | tronco curvo, palmas | sempre verde |
| Ipê (amarelo e roxo) | praças, canteiros | copa aberta | florido de julho a setembro, sem folha na floração |
| Oiti | árvore de rua clássica | copa redonda e densa, verde-escura | sempre verde |
| Figueira (Ficus) | praças e parques | copa enorme de sombra | sempre verde |
| Mata atlântica (3 variantes de dossel + embaúba) | morros e matas | copas irregulares | embaúba prateada |

Flamboyant, jacarandá, bananeira e helicônias entram no M2.

### 7.2 Geração e LOD

- **Gerador em node** (`render/geracao/arvores.js`): tronco em cilindros afunilados de 6 a 8 lados com ramificação
  simples (semente), folhas em **cartas de cachos** com textura alfa; palmeiras com tronco curvo e palmas em fitas
  curvadas com textura alfa. Texturas de folha feitas na GPU na carga (seção 9.3).
- **LOD0:** 400 a 800 triângulos (palmeiras), 1.000 a 2.000 (copas largas), alfa por cobertura, vento no vértice por
  altura e hash, translucidez da folha contra o sol (termo barato de transmissão).
- **LOD1:** 60 a 150 triângulos (lóbulos da copa com a textura de folha e o tronco em 4 lados).
- **Impostor:** 8 vistas horizontais mais o topo, assadas na carga num atlas (uma carta por árvore, 2 triângulos),
  com normal de copa para receber luz. Todas as espécies num atlas só: **1 chamada** para todos os impostores.
- **Longe:** a copa no terreno (seção 3.1) para a mata; árvores de rua somem no mapa de cor.
- Cor por instância (variação de verde e de floração) e por estação (uniforme).
- **Chamadas:** espécie x LOD0 e LOD1 (até 12) mais 1 de impostores, e as mesmas LOD0/LOD1 próximas no passe de
  sombra. Triângulos de árvores no Média: até 150 mil.
- **Dono das árvores:** a simulação guarda a densidade de floresta (recurso) e o que foi desmatado; as árvores de rua e
  de lote vêm dos tipos de via e do plano do lote (render, determinístico pela semente).

---

## 8. Gente e carros

- **A simulação dá fluxos, o render mostra uma amostra.** Carros por aresta proporcionais ao fluxo (veículos por hora)
  e à velocidade; pedestres por setor proporcionais à densidade de uso (comércio, praças, pontos). Sem fluxo (M1, se a
  simulação ainda não tiver trânsito), a amostra usa o tipo de via, a hora e as zonas vizinhas.
- **Carros:** 6 modelos gerados (hatch, sedã, SUV, picape, ônibus, caminhão), 150 a 400 triângulos no LOD0 e 12 a 24 no
  LOD1; cor por instância pela frota brasileira (branco, prata, preto e cinza em ~80%); faróis e lanternas emissivos à
  noite; andam nas faixas pela curva da aresta, com espaçamento e parada simples nos cruzamentos (semáforo visual no
  M2). Posição calculada na CPU para até 400 carros (0,2 ms).
- **Pessoas:** figura de ~200 triângulos com caminhada no vértice (membros marcados por atributo, ciclo por hash) e
  LOD1 de 24 triângulos; altura de 1,55 a 1,90 m; roupas em tons reais; só até 250 m da câmera; nas calçadas, faixas,
  praças e portas das lojas.
- **Chamadas:** um `InstancedMesh` por modelo e LOD (carros 12, gente 2).
- **Aviões, helicópteros e navios** (o jogo atual já tem): voltam no M2 com os modelos novos.

---

## 9. Materiais e texturas procedurais

### 9.1 Biblioteca de materiais (poucos programas)

| Material | Base | Usado em |
|---|---|---|
| `terreno` | `MeshStandardMaterial` + ganchos de vértice (CDLOD) e de cor (camadas) | terreno e mundo de fora |
| `agua` | `MeshStandardMaterial` + ganchos | mar, lago, rio |
| `via` | `MeshStandardMaterial` + ganchos (marcas, asfalto, calçada por `aMat`) | pistas, calçadas, meio-fio, cruzamentos |
| `edificio` | `MeshStandardMaterial` + ganchos (fachada, telhado, lote) | LOD0 fundido e LOD1 instanciado (duas variantes) |
| `pbr` | `MeshStandardMaterial` com texturas procedurais | props, carros, Arcologia (pedra, bronze, laca, ouro, concreto, madeira) |
| `vidroLanterna` | `MeshStandardMaterial` com emissivo em gradiente | coroa da Torre, esfera da Biblioteca |
| `folha`, `tronco`, `impostor` | `MeshStandardMaterial` + ganchos (vento, transmissão, alfa) | vegetação |
| `pessoa` | `MeshStandardMaterial` + gancho de caminhada | gente |
| `sobreposicao`, `marcador` | `ShaderMaterial` sem luz | camadas, ferramentas, marcadores |
| céu, pós | `ShaderMaterial` | céu, cubo, bloom, composição |

- **Ganchos comuns a todos:** neblina de altura, sombra de longe e HAO, sombras de nuvem, camada (dessaturar e pintar
  pelo `aId`), noite (mapa de luz), realce de seleção. Cada gancho entra na `customProgramCacheKey`.
- Ficar em cima do `MeshStandardMaterial` mantém luz, IBL, `SunLight`, instâncias, `BatchedMesh` e profundidade
  invertida funcionando sem reescrever o shader de luz.
- **Total esperado:** 20 a 30 programas, compilados na carga com `compileAsync` (`KHR_parallel_shader_compile`) atrás
  da tela de carga.

### 9.2 Albedos reais (linear), para acabar com a maquete

| Superfície | Albedo | Rugosidade | Observação |
|---|---|---|---|
| Asfalto novo / gasto | 0,04 a 0,06 / 0,10 a 0,14 | 0,85 / 0,7 na trilha | nunca preto puro |
| Concreto aparente | 0,30 a 0,40 | 0,8 | manchas e poros |
| Pintura clara de fachada | 0,55 a 0,75 | 0,7 | **nada acima de 0,80** |
| Grama tropical / capim seco | 0,08 a 0,18 (oliva) / 0,25 a 0,30 | 0,9 | sem verde-limão |
| Terra roxa / terra clara | 0,12 a 0,18 / 0,20 a 0,28 | 0,95 | avermelhada |
| Areia de praia | 0,35 a 0,45 | 0,9 | |
| Granito | 0,20 a 0,35 | 0,6 a 0,8 | |
| Telha cerâmica | 0,25 a 0,35 | 0,75 | laranja-avermelhada |
| Folhagem | 0,05 a 0,12 | 0,6 | transmissão |
| Vidro de fachada | cor 0,02 a 0,05 | 0,05 a 0,12 | F0 0,04 a 0,08 |
| Bronze / alumínio | metal, 0,4 (bronze escuro) / 0,9 | 0,35 / 0,3 | Arcologia e caixilhos |

Aceite automático: nenhuma textura de albedo com média acima de 0,80; saturação média do quadro na vista padrão abaixo
da do jogo atual (medida no PNG).

### 9.3 Texturas feitas na GPU na carga

- Geradas por passes de shader em alvos (`WebGLArrayRenderTarget` para as camadas), com mipmaps, em vez de canvas 2D:
  segundos a menos no celular e o mesmo resultado em todo aparelho.
- **Conjuntos:** camadas do terreno (albedo com rugosidade no alfa; normal no PC), asfalto, calçada, concreto, pedra,
  madeira, telha, folhas (cachos de 8 formas), palmas, ruído 3D tileável pequeno (64³ em 2D empacotado), atlas de
  impostores, atlas de interiores (M2), estrelas.
- Tamanhos por perfil: 512 (Leve), 1024 (Média), 2048 (PC).
- Cache opcional no IndexedDB (lido por `readPixels` e reenviado na próxima carga) se a geração passar de 1 s no Poco
  X7.
- Meta de carga: menos de 8 s na primeira vez e menos de 4 s depois, no Poco X7.

---

## 10. Câmera, entrada e seleção

### 10.1 Câmera à CS2

- **Órbita em volta de um alvo no chão** (a altura do alvo segue o terreno e o topo das vias): distância de 10 m (nível
  da rua) a 9 km (a cidade inteira), guinada livre, inclinação de 3° (horizonte) a 88° (de cima). fov vertical de 40°.
- **Acoplamentos:** perto do chão a inclinação mínima sobe um pouco para não entrar em prédio; a velocidade de pan é
  proporcional à altura; zoom na direção do cursor ou do ponto médio da pinça.
- **Colisão:** a câmera fica 2 m acima do campo de alturas (cópia na CPU a 8 m) e do terreno.
- **Inércia** com amortecimento crítico; `irPara` com arco (voo), reaproveitando a ideia do `flyTo` atual.
- **Plano próximo e distante** dinâmicos (seção 1.2).
- **Modo passeio** (câmera de rua que anda pela calçada) e **seguir** um carro ou pessoa: M2.

### 10.2 Entrada

| Ação | Toque | Mouse e teclado |
|---|---|---|
| Mover | 1 dedo arrasta; **o ponto do chão fica sob o dedo** (raio contra o terreno) | botão esquerdo ou do meio arrasta; WASD; borda da tela (opção) |
| Zoom | pinça no ponto médio | roda no cursor; + e - |
| Girar | 2 dedos giram | botão direito arrasta; Q e E |
| Inclinar | 2 dedos arrastam na vertical | botão direito arrasta na vertical; R e F |
| Selecionar | toque curto | clique |
| Menu de contexto | toque longo (vibra) | clique direito curto |
| Ferramenta | arrasto com lupa e encaixe (seção 11.2) | arrasto com encaixe; Shift desliga o encaixe |

Os gestos são arbitrados por limiar de movimento e ângulo nos primeiros 80 ms (sem trocar de gesto no meio). A UI tem
precedência sobre o mundo (o evento que cai num elemento da UI não chega à câmera).

### 10.3 Seleção

- **Na CPU e sem ler a GPU:** o raio da tela anda no campo de alturas (passo em DDA pela grade de 8 m) até achar a
  primeira célula acima do raio; depois testa as caixas dos prédios daquele trecho (grade espacial do render com os
  volumes do plano) e as arestas de via (distância à curva menor que meia largura). Devolve `{ tipo, id, ponto }`.
- Determinística e testável em node. Precisa só dos planos e do mapa de alturas.
- **Seleção por GPU** (passe de 1 pixel com o `aId` como cor) fica para o M2, se for preciso escolher props, carros ou
  gente.
- Sob o cursor (PC): a mesma consulta, no máximo 20 vezes por segundo.

---

## 11. Sobreposições no mundo

### 11.1 Camadas (as "info views" do CS2)

- **Mundo neutro:** o gancho `camada` (uniforme `uCamada`) leva a cor base de tudo para um cinza claro antes da luz.
  Uniforme, sem recompilar.
- **Prédios pintados** pela tabela de prédios (seção 5.6): R = valor na rampa da camada. É o que o CS2 faz (o prédio,
  e não só o chão, muda de cor).
- **Vias pintadas** por aresta (fluxo, condição) numa textura de dados indexada pelo `aId` da via.
- **Campos no chão** (valor do terreno, poluição, ruído, cobertura de serviço): textura de dados sobre o mapa (256² a
  512²), lida pelo terreno com a rampa, com linhas de nível finas.
- **Legenda e escala:** a UI desenha; o render recebe a rampa (até 8 cores) e o intervalo.
- **Custo:** 0 chamadas com a camada ligada ou desligada (tudo por uniforme e textura); só o envio da tabela quando os
  dados mudam.

### 11.2 Ferramentas desenhadas no mundo

- **Traçado de via:** a prévia é a própria malha da via gerada pelo mesmo gerador (na thread principal, só a aresta em
  traçado), com material `sobreposicao` translúcido azul; guias de encaixe (retas a 90° e 45°, prolongamentos, nós
  próximos, grade de 8 m) em linhas finas; cotas de comprimento e ângulo projetadas para a UI; vermelho onde colide.
  Custo: 2 a 4 chamadas enquanto a ferramenta está ativa.
- **Zoneamento:** células de 8 m ao longo das vias como instâncias de quadrado (1 chamada para todas), coladas no
  terreno pelo mapa de alturas no vértice, com cor por zona e borda; o pincel é um círculo projetado no terreno
  (uniforme no shader do terreno, 0 chamadas).
- **Colocar prédio de serviço ou da Holding:** fantasma do LOD1 do modelo com o círculo de alcance no terreno.
- **Lupa no toque** (celular): a UI mostra um recorte ampliado; o render expõe `projetar` e `raio` para ela.

### 11.3 Marcadores e rótulos

- **Marcadores de aviso sobre os prédios** (as notificações do CS2): placas viradas para a câmera no shader de vértice
  de um `InstancedMesh`, com atlas dos glifos da UI rasterizados na carga. 1 chamada; teto de 200 (PC), 60 (Média), 30
  (Leve), os mais perto; de longe, um marcador por setor com o número de avisos. Oclusão pela profundidade (um
  marcador atrás de uma torre some).
- **Rótulos** (nomes de bairros, vias, marcos): texto é da UI; o render fornece a posição na tela a cada quadro para até
  40 âncoras (`ancoras()`), com visibilidade.

---

## 12. Construção

### 12.1 Prédios da cidade (fases à CS2)

| Fase | O que aparece | Como |
|---|---|---|
| 0. Canteiro | tapume em volta do lote, terra de obra, contêiner, caçamba | máscara de uso do solo (terra) + props instanciados |
| 1. Fundação | laje e estacas, betoneira | a caixa do prédio cortada na altura 0,3 m (tabela de prédios, canal G) |
| 2. Estrutura | esqueleto de concreto subindo (pilares e lajes por andar), grua para prédios acima de 4 pavimentos, andaime nas casas | `InstancedMesh` de pilar e de laje (grade da planta pela semente); grua instanciada com mastro na altura do topo e lança girando; andaime como casca com padrão alfa acima da altura pronta |
| 3. Fechamento | a fachada sobe andar por andar atrás do esqueleto, com tela de proteção | **corte no vértice:** o shader do `edificio` prende em `y = altura pronta` os vértices acima dela (lê o progresso pelo `aId`); o topo vira uma tampa limpa sem `discard` |
| 4. Pronto | grua e tapume saem, festa de inauguração opcional | canal G = 255; props removidos |

- **Custo:** 0 geometria nova por prédio; ~5 chamadas para todas as obras juntas (pilares, lajes, gruas, andaimes,
  tapumes).
- O progresso vem da simulação (`obra: { fase, progresso }`); o render só interpola.
- Operários (gente com capacete) no canteiro dos prédios perto da câmera, pela amostra de pessoas.

### 12.2 Arcologia por etapas

- Cada etapa acrescenta peças do modelo de autor. Durante a etapa: canteiro na área, gruas proporcionais à peça
  (torre: grua de ascensão interna, ou duas gruas externas altas na Torre), esqueleto e fechamento pelo mesmo corte
  por altura, agora por uniforme da peça.
- Ao fim de uma etapa: câmera de celebração opcional (voo curto) e as luzes da peça acendem na primeira noite.
- O canteiro animado detalhado do jogo atual (caminhões, betoneira, operários nos postos) é reaproveitado como ideia
  no M2, com modelos novos.

---

## 13. Módulos e arquivos propostos

```
fonte/render/
  index.js                 criarRender(canvas, opcoes) -> API (seção 14.2)
  ponte.js                 aplica eventos da simulação; guarda índices densos; fila com teto de ms por quadro
  motor/
    renderizador.js        WebGLRenderer, capacidades (clip_control, multi_draw, timer), profundidade, contexto perdido
    perfis.js              tabela de qualidade (seção 2.10) e escolha automática
    quadro.js              laço, limite de quadros por estado, resolução dinâmica em degraus
    pos.js                 alvo HDR com MSAA, bloom, composição AgX, CAS, esmaecer
    ganchos.js             registro dos ganchos GLSL e das chaves de programa
    medidas.js             engine.stats, cronômetro de GPU, memória
    bancada.js             cenas fixas e voo de teste de desempenho
  ambiente/
    astro.js               sol e lua pela latitude, dia e hora
    ceu.js                 Sky r186, cubo assado, estrelas, lua, brilho da cidade
    ibl.js                 PMREM sob demanda
    exposicao.js           curva de exposição e balanço de branco por hora
    neblina.js             trechos fog_* de altura com perspectiva aérea
    sol.js                 luz do sol, sombra de perto por perfil (mapa estável ou SunLight)
    campoAlturas.js        alturas da cidade na GPU e cópia na CPU
    sombraLonge.js         altura de sombra e HAO pelo campo
    nuvens.js              sombras de nuvem e parâmetros de clima
  mundo/
    setores.js             grade de setores e regiões, LOD por setor, descarte, sujeira, cache LRU
    oficina.js             ponte com o worker de geração
    oficina.worker.js      gera LOD0 de setores (prédios, vias, props) com os geradores puros
    instancias.js          listas por região compactadas (LOD1, árvores, props)
    terreno.js             CDLOD, texturas de altura, normais, cor, máscara de uso
    agua.js                mar, lagos e rios
    vias.js                malhas de via por setor e prévia da ferramenta
    predios.js             LOD0 fundido, LOD1 instanciado, tabela de prédios
    vegetacao.js           espécies, LOD, impostores, copa no terreno
    props.js               postes, placas, bancos, carros parados
    trafego.js             amostra de carros
    pedestres.js           amostra de pessoas
    obras.js               canteiros, esqueletos, gruas, andaimes
    luzRua.js              mapa de luz da rua
  geracao/                 puro: sem DOM e sem WebGL, roda em node e no worker
    rng.js, ruido.js       hash, gerador pseudoaleatório, ruído (reaproveita os utilitários atuais)
    fundir.js              fusão por material, AO por vértice, vértices locais ao setor
    perfilVia.js           tipos de via em perfil transversal
    malhaVia.js            varredura de aresta
    cruzamento.js          recorte e polígono de cruzamento
    planoPredio.js         gramática (seção 5.1)
    malhaPredio.js         LOD0 a partir do plano
    estilos.js             paletas e tipologias por zona, nível e cidade
    arvores.js             espécies e LODs
    veiculos.js, pessoas.js modelos de carro e de gente
    impostor.js            vistas do atlas
  arcologia/
    plano.js               medidas da Arcologia em metros (fonte única, como o A atual)
    torre.js, conselho.js, sede.js, lago.js   (M1)
    anel.js, biblioteca.js, vida.js, campus.js, eixo.js, fisica.js   (M2)
  materiais/
    biblioteca.js          instâncias dos materiais da seção 9.1
    texturas.js            geração na GPU e cache
    shaders/*.glsl.js      fachada, terreno, via, agua, folha, pessoa, sobreposicao, marcador, ceu, pos
  camera/
    camera.js              órbita à CS2, colisão, voo
    entrada.js             toque, mouse e teclado com arbitragem de gestos
    raio.js                raio contra o campo de alturas e o terreno
    selecao.js             consulta de prédios e vias
  sobreposicoes/
    camadas.js             info views
    ferramentas.js         traçado de via, células de zona, pincel, fantasma
    marcadores.js          avisos instanciados e âncoras de rótulos
```

**Ferramentas:**

```
ferramentas/
  bancada.mjs              roda as cenas ?cena= no Chromium, grava PNG e JSON de stats, compara com o orçamento
  teste-geracao.mjs        testes dos geradores em node (entra no simular --testes)
  cidade-sintetica.mjs     estado de simulação sintético (cidade grande) para o render sem a simulação
  sonda-gpu.mjs            capacidades do navegador (a sonda de hoje, promovida)
  montar.mjs, testar.mjs   ficam; montar.mjs ganha a saída do worker (arquivo com carimbo no app/, Blob no HTML único)
```

---

## 14. Interfaces

### 14.1 Da simulação para o render (o que o render lê)

O render é **sem regra**: tudo o que desenha deriva do estado da simulação e de sementes. O mesmo save mostra sempre a
mesma cidade. Formatos propostos (o integrador fecha com a parte da simulação):

```js
// carga inicial
mundo = {
  mapa: { tamanho: 8192, celula: 4, alturas: Float32Array(2049 * 2049), fora: { celula: 32, alturas: Float32Array(1025 * 1025) },
          nivelMar: 0, norteAz: 0, latitude: -23.5, semente },
  agua: { lagos: [{ id, nivel, contorno: [[x, z], ...] }], rios: [{ id, pontos: [[x, z, nivel, largura], ...] }] },
  floresta: { celula: 8, densidade: Uint8Array(1024 * 1024) },                      // 0 a 255
  vias: { nos: [{ id, x, z, y }], arestas: [{ id, idx, a, b, curva: [x0, z0, x1, z1, x2, z2, x3, z3], tipo, idade }] },
  lotes: [{ id, idx, aresta, lado, pontos: [[x, z] x 4], zona, densidade }],
  predios: [{ id, idx, lote, tipo: 'zona'|'servico'|'holding'|'arcologia', modelo, zona, nivel, estilo, semente,
              cor, obra: { fase: 0..4, progresso: 0..1 } | null, estado: 'ok'|'abandonado'|'vazio' }],
  tempo: { hora: 0..24, diaDoAno: 0..365, clima: { nuvens: 0..1, chuva: 0..1, vento: [vx, vz] } },
}
// idx = índice denso e estável (vaga) usado nas texturas de dados; reaproveitado só depois de o objeto sair

// a cada passo, eventos em lote (a ordem importa)
eventos = [
  { t: 'terreno', ret: [x0, z0, x1, z1] },            // o render relê o retângulo de mundo.mapa.alturas
  { t: 'via+', aresta }, { t: 'via-', id }, { t: 'no~', no },
  { t: 'lote+', lote }, { t: 'lote-', id },
  { t: 'predio+', predio }, { t: 'predio~', id, campos }, { t: 'predio-', id },
  { t: 'obra', id, fase, progresso },
  { t: 'floresta', ret },
  { t: 'tempo', hora, diaDoAno, clima },
]

// amostras (a cada ~2 s de relógio)
fluxos = { veiculos: Float32Array(arestas), velocidade: Float32Array(arestas), pedestres: Float32Array(setores) }

// camadas (quando a UI liga uma camada ou os dados mudam)
camada = { nome, porPredio: Float32Array(vagas) | null, porVia: Float32Array | null,
           porCelula: { n: 512, dados: Float32Array } | null, rampa: ['#...', ...], min, max }
```

- **Sem worker de simulação** o render lê os arrays direto; **com worker**, a ponte recebe os eventos por
  `postMessage` e os arrays grandes (alturas, fluxos) por transferência ou `SharedArrayBuffer` (este exige isolamento
  de origem, que o GitHub Pages não dá por cabeçalho: evitar).
- O plano dos prédios é gerado pelo render a partir de `(lote, zona, nivel, estilo, semente)`. Se a simulação precisar
  de números do prédio (altura, área útil para capacidade), chama a mesma função pura `planoPredio` (seção 19).

### 14.2 Do render para a UI e para o controle

```js
const R = await criarRender(canvas, { qualidade: 'auto', mundo, aoSelecionar, aoPairar });
R.aplicar(eventos);                         // da simulação
R.fluxos(fluxos);
R.quadro(t);                                // chamado pelo laço principal
R.camera.irPara({ x, z, dist, guinada, inclinacao }, ms);  R.camera.estado();
R.selecionar(xTela, yTela)                  // -> { tipo: 'predio'|'via'|'lote'|'terreno'|'agua', id, ponto: [x, y, z] }
R.projetar([x, y, z])                       // -> { x, y, visivel, dist }
R.ancoras(lista)                            // posições de tela de até 40 âncoras por quadro (rótulos da UI)
R.camadas.mostrar(camada); R.camadas.ocultar();
R.ferramenta.via.previa({ pontos, tipo, encaixes }); R.ferramenta.zona.celulas(lista); R.ferramenta.pincel({ x, z, raio });
R.ferramenta.fantasma({ modelo, x, z, giro, alcance });  R.ferramenta.limpar();
R.marcadores(lista)                         // [{ idx, glifo, cor, prioridade }]
R.selecionado(idx | null);
R.tempo({ hora, diaDoAno, clima }); R.sempreDia(bool);
R.qualidade(id); R.perfil();                // troca e leitura do perfil
R.stats                                     // seção 15.1
R.bancada()                                 // voo de teste; devolve o relatório
R.foto(opcoes)                              // M2
```

A UI nunca toca em objetos do three. O controle (`jogo.js` ou equivalente) liga a simulação ao render e a UI às duas.

---

## 15. Medição, captura e testes

### 15.1 `engine.stats`

```js
{ calls, tris, callsSombra, trisSombra, passes, ms, qps, p95, pr, msaa, perfil,
  gpuMs,                        // EXT_disjoint_timer_query_webgl2 quando existir (existe no SwiftShader; no Android o
                                // Chrome pode não expor: cair para o tempo de quadro)
  setores: { lod0, fila }, instancias: { predios, arvores, carros, pessoas, marcadores },
  memoria: { geometrias, texturasMB, programas }, capac: { clipControl, multiDraw, timer, r11 } }
```

### 15.2 Cenas fixas (`?cena=`)

Todas com semente, hora, clima, perfil e câmera fixos (`&q=media&pr=1&hora=17.5`), sobre a `cidade-sintetica` (12 mil
prédios em 4 x 4 km, 60 km de vias, 150 mil árvores, a Torre e a Sede):

| Cena | Câmera | Serve para |
|---|---|---|
| `bancada-aberta` | 3 km, 35°, cidade inteira | **orçamento** (a meta de 300 chamadas e 900 mil triângulos no Média) |
| `rua` | 12 m, 5°, avenida com lojas | LOD0, fachadas, calçada, gente, carros |
| `bairro` | 400 m, 45° | transição LOD0/LOD1, sombras de perto |
| `torre` | Torre Lâmina a 600 m, 20° | Arcologia, vidro, reflexo, céu |
| `horizonte` | 150 m, 3° | neblina, céu, serras, costura |
| `noite` | `bairro` e `aberta` às 21h e 2h | janelas, postes, céu da cidade |
| `costa` | praia e mar a 300 m | água, espuma, areia |
| `obra` | 5 obras em fases diferentes | canteiros, grua, corte |
| `camadas` | `aberta` com 2 camadas | info views |
| `ferramentas` | via em traçado e zonas | sobreposições |

### 15.3 No Chromium de teste (sem GPU)

- `ferramentas/bancada.mjs` roda as cenas em cada perfil (Leve, Média, Ultra), grava PNG e JSON e **falha se passar do
  orçamento** (chamadas e triângulos são exatos no SwiftShader; ms não valem nada ali).
- Comparação de imagem com a rodada anterior (diferença média de pixels) para pegar mudança acidental.
- WebGPU: com as opções da abertura, a mesma cena pode rodar no `WebGPURenderer` quando a bancada A/B do M4 existir.

### 15.4 No aparelho

- **Configurações > Vídeo > Teste de desempenho:** voo de 20 s por `bancada-aberta`, `bairro`, `rua` e `noite` com
  resolução travada; mostra ms médio, p95, qps, chamadas, triângulos, GPU, capacidades e o perfil sugerido; botão
  "copiar" para o dono mandar o print. É o único lugar onde ms é real.
- Painel de desempenho ao vivo (o que já existe no jogo atual) continua.

### 15.5 Em node

- `teste-geracao.mjs` (entra no `simular --testes`): determinismo (mesma semente, mesmo hash da malha); nenhum `NaN`;
  prédio dentro do lote e da altura máxima do nível; triângulos por LOD dentro do teto; LOD1 com a mesma caixa do
  LOD0 (1 cm); juntas dos cruzamentos (seção 4.3); via sem autointerseção em curva fechada; árvores dentro do teto
  por espécie.

---

## 16. Orçamento da vista aberta (Média, `bancada-aberta`)

| Item | Chamadas | Triângulos |
|---|---|---|
| Terreno (CDLOD) e mundo de fora | 1 | 120 mil |
| Céu (fundo do cubo) | 1 | 0 |
| Água | 2 | 10 mil |
| Vias LOD0 (setores perto) e LOD1 (regiões) | 20 a 30 | 100 mil |
| Prédios LOD0 (setores até 350 m, poucos nesta vista) | 10 a 20 | 120 mil |
| Prédios LOD1 e LOD2 (instâncias de forma) | 4 | 250 mil |
| Vegetação (espécie x LOD + impostores) | 10 a 13 | 150 mil |
| Props (postes, placas, carros parados) | 6 a 8 | 40 mil |
| Carros e gente | 6 a 8 | 30 mil |
| Arcologia (LOD1 nesta vista) | 10 a 15 | 25 mil |
| Obras | 5 | 10 mil |
| Marcadores e sobreposições | 1 a 3 | 1 mil |
| Passe de sombra (caixas LOD1, árvores e Arcologia perto) | 15 a 25 | (conta nos triângulos) ~40 mil |
| Pós (bloom 4 níveis, composição) | 8 a 9 | 0 |
| **Total** | **~100 a 140** | **~900 mil com folga de 5 a 10%** |

- Há folga em chamadas (o gargalo do Poco X7 é pixel e triângulo, não chamada). A folga paga a vista de rua, que tem
  mais LOD0 e mais gente.
- No Ultra, a mesma vista com LOD0 até 900 m, cascatas e mais árvores: ~400 a 700 chamadas e 3 a 4 milhões de
  triângulos, abaixo de 1.500 e 5 milhões.

---

## 17. Escopo e parcelas

### 17.1 M1: bonito de verdade

Entra: céu físico e ciclo real; AgX e exposição; neblina de altura; sombras de perto (por perfil) e de longe; HAO e
AO por vértice; MSAA e bloom; terreno CDLOD com camadas, mata em copa e mundo de fora; mar, um rio e um lago; vias
`rua2`, `avenida4`, `via6` e `pedestre` com cruzamentos, marcas, postes e árvores de rua; prédios gerados de
residencial baixa, média e alta, comercial, escritório e industrial em 5 níveis, com LOD0, LOD1, lote e noite; 6
espécies e a mata; carros e gente em amostra; obra à CS2; Torre Lâmina, Torres do Conselho, Sede e lago; câmera à CS2 e
seleção; camadas (3 a 4) e ferramentas de via e zona; marcadores; bancada no Chromium e no aparelho.

Fica para depois:

| Marco | O que entra |
|---|---|
| M2 | AO de tela no PC; reflexo planar do lago no Ultra; interiores falsos; resto da Arcologia (Anel, Biblioteca, Vida, Campus, eixo, Física); aviões, helicópteros e navios; semáforos; faróis projetados; modo foto (profundidade de campo e tilt-shift no PC, LUT); mais espécies; seleção por GPU; câmera de passeio e seguir |
| M3 | pontes, viadutos, túneis, rodovia e trevos; VLT, ônibus e metrô com estações; GI assada na Arcologia (Ultra); chuva e chão molhado; estações completas |
| M4 | bancada A/B WebGL2 x WebGPU; escala de 50 mil lotes (descarte na GPU se o WebGPU ganhar); render num worker com `OffscreenCanvas` (se a UI pesar) |
| M5 em diante | estilos das outras metrópoles (tabelas de `estilos.js` e espécies por clima), mundo de fora por metrópole |

### 17.2 Parcelas do render para o M1 (proposta ao integrador)

Cada parcela edita só os seus arquivos, testa com o estado sintético (`cidade-sintetica`) e fecha com a bancada.

| # | Parcela | Arquivos | Entrega | Testa sem as outras com | Tamanho | Depende de |
|---|---|---|---|---|---|---|
| R0 | **Fundação do motor** | `render/index.js`, `ponte.js`, `motor/*`, `materiais/biblioteca.js` (esqueleto), `ferramentas/bancada.mjs`, `cidade-sintetica.mjs`, `sonda-gpu.mjs` | renderizador, perfis, laço, pós AgX, ganchos, stats, cenas `?cena=`, API da seção 14.2 com stubs | caixas no chão plano | M | nada |
| R1 | Céu, sol e atmosfera | `ambiente/astro.js`, `ceu.js`, `ibl.js`, `exposicao.js`, `neblina.js`, `nuvens.js` | ciclo, cubo, PMREM, noite, neblina | cena de caixas às 9h, 12h, 17h30, 21h | M | R0 |
| R2 | Terreno | `mundo/terreno.js`, `shaders/terreno`, `materiais/texturas.js` (camadas), `camera/raio.js` | CDLOD, camadas, mapa de cor, máscara, copa, horizonte | mapa sintético | G | R0 |
| R3 | Água | `mundo/agua.js`, `shaders/agua` | mar, lago, rio | alturas sintéticas | M | R0 (R2 só para o mapa de cor; stub de cor lisa) |
| R4 | Sombras e AO | `ambiente/sol.js`, `campoAlturas.js`, `sombraLonge.js` | sombra de perto por perfil, campo de alturas, sombra de longe, HAO, colisão na CPU | caixas | M | R0 |
| R5 | Vias | `geracao/perfilVia.js`, `malhaVia.js`, `cruzamento.js`, `mundo/vias.js`, `mundo/luzRua.js`, `shaders/via` | malhas, cruzamentos, marcas, props de rua, mapa de luz | grafo sintético | G | R0 |
| R6 | Gerador de prédios | `geracao/planoPredio.js`, `malhaPredio.js`, `estilos.js`, `fundir.js`, `mundo/predios.js`, `setores.js`, `oficina*.js`, `instancias.js`, `shaders/fachada` | plano, fachada, LOD0, LOD1, lote, noite, tabela de prédios | lotes sintéticos | G (a maior) | R0 |
| R7 | Vegetação | `geracao/arvores.js`, `impostor.js`, `mundo/vegetacao.js`, `shaders/folha` | 6 espécies, LOD, impostores, copa | pontos sintéticos | G | R0 (R2 para a copa no terreno) |
| R8 | Obra | `mundo/obras.js` | fases, esqueleto, grua, andaime, corte | prédios sintéticos com progresso | M | R6 |
| R9 | Vida | `geracao/veiculos.js`, `pessoas.js`, `mundo/trafego.js`, `pedestres.js`, `props.js` | carros, gente, props | grafo sintético | M | R5 |
| R10 | Câmera, entrada e seleção | `camera/*` | órbita à CS2, gestos, colisão, seleção | terreno plano e caixas | M | R0 |
| R11 | Sobreposições | `sobreposicoes/*` | camadas, ferramentas de via e zona, marcadores, âncoras | dados sintéticos | M | R0 (R5 para a prévia de via) |
| R12 | Arcologia M1 | `arcologia/plano.js`, `torre.js`, `conselho.js`, `sede.js`, `lago.js` | Torre Lâmina, Torres do Conselho, Sede, lago, LOD1 | cena `torre` | G | R0 (R6 para a fachada) |
| R13 | Orçamento e aceite | ajustes finos nos perfis e distâncias de LOD | bancada verde nos 3 perfis, capturas de aceite, números no README | tudo | M | todas |

Ordem: R0 primeiro (curta, publica os contratos). Depois em paralelo: R1, R2, R4, R5, R6, R7, R10, R11, R12 (com
stubs). Em seguida R3, R8 e R9. R13 fecha.

### 17.3 Aceite do M1 (render)

- `bancada.mjs` verde: Média `bancada-aberta` até 300 chamadas e 900 mil triângulos; Ultra até 1.500 e 5 milhões; Leve
  até 200 e 500 mil.
- Capturas das cenas da seção 15.2 às 9h, 12h, 17h30 e 21h, lado a lado com as do jogo atual: nada de verde-limão,
  branco puro, bolinhas de árvore, mesa ou luz de foto; horizonte sem costura; Torre retangular.
- No Poco X7 (dono): "Teste de desempenho" com 30 qps ou mais no Média na `bancada-aberta` e na `rua`.
- Sem erros de página no Chromium de teste; geradores verdes em node.

---

## 18. Riscos

| Risco | Efeito | Plano |
|---|---|---|
| Shader da fachada caro no Mali | ms acima do previsto nas vistas cheias de prédio | variante simplificada por perfil (Leve e Média sem desgaste de perto), medir na bancada do aparelho antes de acrescentar detalhe |
| Cintilação das fachadas de longe | "chuvisco" no horizonte | filtragem por `fwidth` e troca pela média desde a R6; captura em sequência de zoom |
| Geração no worker e envio à GPU travando o quadro | soluços ao andar | um setor por quadro, envio parcial, prioridade pela distância; cache LRU |
| `EXT_clip_control` ausente no Poco X7 | z-fighting de longe | plano próximo dinâmico; bias nas marcas de via e nas sobreposições |
| Trechos de `ShaderChunk` do three mudam de versão | ganchos quebram em atualização | three fixo em 0.186.0; cada gancho confere o texto e avisa (como o PCF do jogo atual) |
| Muitas variantes de programa | carga lenta e soluços | 20 a 30 programas, `compileAsync` na carga, aquecimento das variantes de sombra e instância |
| HTML único e worker | worker não carrega no arquivo solto | `montar.mjs` embute o worker como texto e sobe por `Blob`; no `app/` vira arquivo com carimbo no cache do `sw.js` |
| Chromium sem GPU | ms nunca medido aqui | ms só no aparelho; aqui só chamadas, triângulos e imagem |
| Tamanho do M1 | o render sozinho tem 14 parcelas | a R6 (prédios) é o caminho crítico do visual: começar por ela junto com a R0 |

---

## 19. Dúvidas que o integrador precisa fechar com as outras partes

1. **Mapa (simulação):** confirma área jogável de 8.192 m, ladrilhos compráveis de 512 m (16 x 16, começa com 3 x 3) e
   alturas em `Float32Array` a 4 m, com a simulação como dona das alturas e do aplainamento sob vias e lotes?
2. **Índices densos (simulação):** a simulação fornece `idx` estável e denso para prédios, lotes e arestas (até 262
   mil prédios na textura de 512²), reaproveitado só depois da remoção? O render depende disso para camadas, obra e
   seleção.
3. **Plano do prédio (simulação e render):** quem decide altura e área útil? Proposta: a função pura
   `render/geracao/planoPredio.js` (ou movida para `fonte/mundo/`) é chamada pelos dois; a simulação usa só `areaUtil` e
   `alturaTopo`. Alternativa: a simulação fixa a capacidade por zona e nível e o render só desenha.
4. **Relógio (simulação e UI):** quanto dura um dia visual em tempo real e há pausa e velocidades? O render precisa de
   `hora` e `diaDoAno` contínuos; ciclo visual abaixo de ~8 min de relógio deixa o céu "correndo" demais (o CS2 usa um
   ciclo por mês).
5. **Vias (simulação):** Bézier cúbica como curva da aresta, tipos em `data/vias.js` com o perfil transversal da seção
   4.1, elevação só no M3?
6. **Floresta (simulação):** a densidade de floresta por célula de 8 m é da simulação (recurso e desmate)? As árvores
   de rua e de lote ficam com o render.
7. **Trânsito no M1 (simulação):** haverá fluxo por aresta no M1? Se não, o render usa a heurística da seção 8.
8. **Arcologia (arquitetura e integrador):** escala de 10 m por unidade antiga para a planta do Trevo e Torre Lâmina de
   330 m no heliponto (36 x 50 m)? E a câmera padrão da Arcologia no jogo novo (a proposta da `arquitetura.md` era para
   a escala antiga).
9. **Marcadores (UI):** marcadores de aviso desenhados no WebGL (instanciados, com oclusão, 1 chamada) com os glifos da
   UI, ou DOM como propõe a `ui.md`? Recomendo WebGL para os avisos e DOM só para rótulos e o painel do selecionado.
10. **Camadas (UI e simulação):** lista das camadas do M1 e formato (por prédio, por via, por célula) com as rampas.
11. **Workers (integração):** simulação em worker? A oficina de geração do render é outro worker. O `montar.mjs`
    precisa gerar os dois nos dois formatos (app e HTML único).
12. **Estado da câmera no save (UI e simulação):** a posição da câmera e a qualidade gráfica vão no save ou nas
    preferências locais?
13. **Perfil padrão do Poco X7:** Média pela regra `MC2`, confirmada pelo teste de desempenho no aparelho antes de
    publicar o M1?

---

## 20. Fontes

Pesquisas desta pasta (com as fontes originais numeradas nelas): `visual.md` (seções 1, 4, 7 e 9: CS2 com 4 cascatas
de 2048 e ~40 ms de sombra, Anno 1800 com duas câmeras de sombra, custos do Mali, AgX, neblina de altura, N8AO,
impostores octaédricos, interior mapping, WebGPU no Chrome Android desde a v121, problemas 30560 e 31055 do three),
`arquitetura.md` (seções 2, 4 a 7, 9 a 11: referências reais e orçamento da Arcologia), `sistemas.md` (seções 2.3, 2.10,
2.16 e 7: células de 8 m, camadas que pintam o prédio no código do CS2, agregado com amostra visível), `ui.md` (seções
0 e 3.6: camadas, marcadores, desempenho do `backdrop-filter`).

Referências principais retomadas aqui:

- paavohtl, "Why Cities: Skylines 2 performs poorly": https://blog.paavo.me/cities-skylines-2-performance/
- Anno 1800, análise de quadro: https://blog.thomaspoulet.fr/posts/anno-1800-frame-analysis/
- CS2, Asset Pipeline e texturas (MaskMap, ControlMask, emissivo): https://cs2.paradoxwikis.com/Asset_Pipeline:_Buildings
- CS2, árvores com idade e impostor: https://cs2.paradoxwikis.com/Asset_Pipeline:_Aging_Trees
- CS2, clima e estações (um ciclo por mês): https://colossalorder.fi/?p=1788
- Strugar, CDLOD (Continuous Distance-Dependent Level of Detail for Rendering Heightmaps), 2010:
  https://github.com/fstrugar/CDLOD
- Unreal, neblina exponencial de altura: https://dev.epicgames.com/documentation/en-us/unreal-engine/exponential-height-fog-in-unreal-engine
- Joost van Dongen, interior mapping: http://joostdevblog.blogspot.com/2018/09/interior-mapping-real-rooms-without.html
- three.js r186 (SunLight com CSM, nuvens do Sky, LightProbeGrid): https://github.com/mrdoob/three.js/releases/tag/r186
- three.js, problemas de desempenho do WebGPURenderer: https://github.com/mrdoob/three.js/issues/30560 e
  https://github.com/mrdoob/three.js/issues/31055
- Chrome 121, WebGPU no Android: https://developer.chrome.com/blog/new-in-webgpu-121
- Guia do Mali (custos de textura e banda): https://github.com/azhirnov/cpu-gpu-arch/blob/main/gpu/ARM-Mali_Guide.md

Código conferido hoje (three 0.186.0):

- `examples/jsm/lights/SunLightShadow.js`: `_cascadeCount = 2`, atlas com uma viewport por cascata, divisão prática
  (média de uniforme e logarítmica), encaixe no texel, alcance por `shadow.camera.far`.
- `src/renderers/webgl/WebGLShadowMap.js`, linha 522: `object.layers.test( camera.layers )` com a câmera de sombra.
- `src/renderers/webgl/WebGLBufferRenderer.js` e `WebGLIndexedBufferRenderer.js`: `renderMultiDraw` com
  `WEBGL_multi_draw`, 1 chamada contada.
- `src/renderers/WebGLRenderer.js` e `webgl/WebGLCapabilities.js`: `reversedDepthBuffer` exige `EXT_clip_control`;
  `webgl/WebGLTextures.js`: profundidade `FloatType` vira `DEPTH_COMPONENT32F`.
- `examples/jsm/objects/Sky.js`: uniformes de nuvem; `src/objects/BatchedMesh.js`: `perObjectFrustumCulled`,
  `setVisibleAt`, texturas de matriz e cor.
- `src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js`: `AgXToneMapping`.

Sondas de hoje: `scratchpad/cs2/sonda-gpu.mjs` (extensões WebGL2 do Chromium de teste) e `sonda-gpu2.mjs` (WebGPU com
adaptador SwiftShader em `localhost`).
