# Frente visual: do BuildIt ao padrão do Cities: Skylines II, no navegador

Pesquisa e plano da renderização e da direção de arte da Arcologia de Held. Escrito em 27/09/2026 sobre o código em
`/home/user/diogo` (three.js r186, WebGL2) e as capturas em `scratchpad/trevo/int/`. As fontes estão no fim (seção 9),
numeradas como [n] no texto. As afirmações sobre o three r186 foram conferidas no próprio código em
`node_modules/three` (seção 9, "Código local").

> **[Crítico]** Este arquivo passou por revisão cética (seção 10). As correções no corpo estão marcadas com
> **[Crítico]**; texto riscado foi substituído. As 10 decisões finais da frente e a ordem nova das parcelas estão em
> 10.6 e 10.7.

---

## 0. Resultado em uma página

**Diagnóstico.** O jogo hoje parece maquete de celular por cinco motivos, todos no motor e na paleta, não no
orçamento: (1) a luz padrão é a "da foto", fixa, com céu azul-marinho, estrelas e aurora sobre um chão iluminado de
dia; (2) ~~a gradação empurra saturação (1,1 a 1,2) e tons de cor nas sombras e nos realces~~ **[Crítico]** a cor
de brinquedo vem dos albedos e texturas, não da gradação: a luz padrão `FOTO` tem saturação 0,7 (`ciclo.js`); só os
quadros do ciclo usam 1,08 a 1,15, e as tintas de sombra e realce existem nos dois; (3) não há perspectiva
aérea: a neblina é linear e só começa a 115 unidades (860 m), então tudo fica nítido e com o mesmo contraste até o
fim, o que lê como objeto pequeno; (4) os materiais têm albedo de brinquedo (verde-limão, branco puro, turquesa,
vidro azul-bala translúcido) e nenhum desgaste; (5) a vegetação é feita de bolas lisas saturadas, com pontos laranja.

**Direção nova.** "Uma metrópole brasileira de verdade, vista de helicóptero": sol na posição real da latitude, céu
físico com nuvens, neblina que azula a distância e dá escala, materiais com albedo real (concreto, pedra, vidro
escuro que espelha o céu, metal, asfalto), sujeira e variação, árvores de espécies reais (ipê, palmeira imperial,
figueira) e uma noite de cidade grande (janelas, poças de luz dos postes, faróis, brilho do céu sobre a cidade). Sem
mesa, sem aurora, sem tilt-shift fixo, sem cores de brinquedo.

**Decisões principais.**
1. Continuar em WebGL2. O WebGPURenderer do three ainda perde para o WebGL em cenas com milhares de malhas (problema
   aberto e de alta prioridade [34]) e o motor depende de `onBeforeCompile` em todo material, o que não existe no
   WebGPU. Reavaliar na fase 4 com uma cena de teste no Poco X7.
2. Luz padrão passa a ser o **ciclo de dia real** (sol pela latitude e pela estação do calendário do jogo). O modo
   "Foto" e a aurora saem do padrão. "Sempre dia" continua como opção.
   **[Crítico]** Faltava a escala de tempo: o dia do calendário tem 20 s reais (`DIA_MS` em `estado.js`), então o sol
   não pode seguir o dia do jogo. Como no CS2 (um ciclo de dia e noite vale um mês), **1 dia visual = 1 mês do
   calendário = 10 min reais**, com a estação pelo mês. E faltava o norte: a -20° o sol passa pelo norte, e a câmera
   padrão olha para o norte da planta, então a fachada vista ficaria em contraluz o ano todo. O norte geográfico passa a
   ser um parâmetro (`NORTE_AZ`), apontado para o lado da câmera e girado ~25° para a esquerda (ver 10.3).
3. Céu pelo `Sky` do three r186 (modelo de Preetham com nuvens 2D, sombra própria e borda prateada), que custa uma
   chamada e só os pixels de céu. Reflexos (PMREM) refeitos pelo ângulo do sol.
   **[Crítico]** "Só os pixels de céu" não é barato: o `Sky.js` faz Preetham e mais 5 ruídos por pixel (fbm de 4
   oitavas e o ruído de região). No celular o céu é assado num cubo (uma face por quadro) e o fundo vira uma leitura
   de cubo; o mesmo cubo gera o PMREM. O PC desenha o `Sky` direto.
4. Curva de tons **AgX** como padrão (teste A/B contra a PBR Neutral atual por captura), saturação perto de 1,0,
   sem tintas de sombra e realce. Evitar o erro do CS2 (cinza e frio [15][16]): manter o sol quente do Brasil.
5. **Neblina de altura exponencial com perspectiva aérea** e brilho na direção do sol, em escala real (1 unidade =
   7,5 m). É o maior ganho de "grandeza" por custo quase zero.
6. Sombras: **não** copiar as 4 cascatas de 2048 do CS2, que gastam ~40 ms e 72% das chamadas num PC [1][2]. Manter o
   mapa único que segue a câmera e só é refeito quando precisa, e somar um **mapa de longe** estático, refeito raramente,
   como as "duas câmeras de sombra" do Anno 1800 [27].
   **[Crítico]** No Média, a sombra de longe sai do **campo de alturas** (o do HAO, estendido à cidade), e não de uma
   segunda luz com sombra: no three uma segunda `DirectionalLight` com sombra entra no laço de luz de todo material, e
   "4 ladrilhos em 4 quadros" não existe no `WebGLShadowMap` (ver V10).
7. AO: HAO (já existe) + **AO por vértice cozida** na geometria procedural (custo zero por quadro) em todos os perfis;
   AO de tela só depth-only (estilo N8AO [37]) e só no PC. O `GTAOPass` do three redesenha a cena inteira com
   `MeshNormalMaterial` e fica de fora.
8. Sem profundidade de campo nem tilt-shift fora do modo Foto: o desfoque é o que mais faz "maquete" e é das
   opções mais criticadas do CS2 [4].
9. Antes de acrescentar densidade (props, árvores de rua), **LOD dos prédios da cidade**: a vista aberta no Poco X7 já
   passa da meta hoje (394 chamadas contra 300).
10. Medir de verdade no aparelho: o Chromium de teste não tem GPU. A parcela V0 põe um teste de desempenho no jogo.
11. **[Crítico]** O Poco X7 hoje **não** roda em Média: `guessQuality` (`engine.js`) casa `Mali-G615` com a regex
    `Mali-G(5|6)` e escolhe **Alta** (MSAA 4x, sombra 2048, resolução até 1,6 = 0,97 MP). O plano todo assume Média
    (0,64 MP). V0 decide pelo número medido; a recomendação é `MC2` → Média. Enquanto isso, nada da coluna "Alta" pode
    depender de PC (a AO de tela saiu dela; seção 5).

**O que do CS2 cabe no Poco X7 (Média) e o que não cabe** (detalhe na seção 7):

| Cabe | Não cabe |
|---|---|
| Céu físico com nuvens 2D, reflexos do céu (IBL), curva de tons e gradação, neblina de altura com perspectiva aérea, sombra do sol com sombras de longe estáticas, AO cozida e por campo de alturas, MSAA 2x, bloom, materiais PBR com detalhe de perto, água com Fresnel e espuma, noite com janelas, postes e faróis, árvores com LOD e impostor, vento, cor por estação | Nuvens e neblina volumétricas, raios de luz, iluminação global em tempo real, reflexos de tela (SSR), TAA e reescala temporal, 4 cascatas de sombra, profundidade de campo física o tempo todo, reflexo planar, AO de tela em resolução cheia, todo objeto projetando sombra |

**Parcelas, em ordem de ganho por custo** (seção 6): V0 medição no aparelho; V1 sol real e céu físico; V2 curva
de tons e gradação; V3 neblina de altura e perspectiva aérea; V4 paleta e materiais PBR; V5 LOD dos prédios da
cidade; V6 terreno e chão; V7 vegetação real; V8 noite de metrópole; V9 água; V10 sombras de longe; V11 AO cozida e AO
de tela no PC; V12 câmera de grandeza e modo Foto; V13 densidade de rua e telhados; V14 iluminação global assada no
Ultra; V15 chuva e estações.

---

## 1. Como o Cities: Skylines II chega no visual dele

O CS2 roda no Unity com o HDRP (pipeline de alta definição, com base física) sobre Direct3D 11, e usa o DOTS para a
simulação. A Colossal Order escreveu à mão o descarte e a textura virtual, porque as peças do Unity não estavam
prontas [1][3][5]. O menu gráfico expõe quase tudo o que o HDRP faz: iluminação global, volumétricos, reflexos de tela,
névoa, nuvens volumétricas e de distância, sombras de nuvens, qualidade do terreno e nível de detalhe [6][7].

| Componente | O que o CS2 faz | Custo e críticas | Lição para nós |
|---|---|---|---|
| Céu e atmosfera | Céu físico do HDRP (Rayleigh, Mie, perspectiva aérea) com nuvens volumétricas e "distance clouds" e sombras de nuvem [6][40] | Volumétricos estão entre as opções mais caras; guias mandam baixar ou desligar [7][8] | Céu analítico de uma chamada, nuvens 2D no próprio céu e sombras de nuvem por textura (já temos) |
| Neblina e perspectiva aérea | Névoa volumétrica do HDRP ("Low Volumetric" em diante) [6] | Cara; jogadores dizem que a luz do sol parece branca demais sem espalhamento [9] | Neblina de altura analítica com cor puxada para o sol: dá a mesma leitura de distância por quase nada |
| Iluminação global | GI do HDRP; é a opção isolada mais cara [6][7] | Guias recomendam desligar [7][8] | No PC Ultra, sondas assadas (LightProbeGrid do r186); no celular, céu + hemisfério + HAO |
| Oclusão de ambiente | SSAO/GTAO do HDRP com níveis de qualidade [9] | "Não é essencial, pode ficar em baixo" [9] | AO cozida por vértice para todos; AO de tela só no PC |
| Sombras | Mapas em cascata, 4 cascatas de 2048 x 2048; todo objeto projeta sombra [1][2] | Numa análise de quadro, as sombras levam ~40 ms e 4.828 das 6.705 chamadas (72%); a opção de qualidade de sombra nem estava ligada a nada [1][2] | Sombra é o maior custo do gênero. Mapa único encaixado e refeito sob demanda, mais um mapa de longe estático |
| Antisserrilhado | TAA do HDRP; DLSS e FSR entraram depois [3] | Rastro e borrão com poucos quadros | No celular, MSAA (quase de graça em GPU por blocos [42][43]); sem TAA |
| Profundidade de campo | Três modos: desligado, "físico" (caro) e "tilt shift" (barato, dá o ar de maquete) [4] | Das opções mais reclamadas: desfoca em quadros baixos; ganho de 5,7% a 10% ao desligar [4] | Fora do padrão. Só no modo Foto |
| Gradação e exposição | Volumes do HDRP; o modo foto expõe Color Adjustments, White Balance, Shadows/Midtones/Highlights, Bloom, Vignette, Film Grain [11][12][13] | A queixa visual mais comum: cidade cinza, "lavada", luz fria e sem vida [15][16]; o mod Lumina (LUTs e curvas próprias) virou padrão da comunidade [17][18] | Luz quente do Brasil, saturação natural (~1,0), contraste pela curva e não por tinta |
| Materiais | Prédios com 5 mapas: BaseColor, MaskMap (metal, verniz, brilho), Normal, ControlMask (3 máscaras de cor para variar a mesma peça e máscara de neve) e Emissive (luzes por ID) [19][20][21] | Críticas a texturas lisas e sem relevo em alguns modelos [16] | Mesma ideia em textura procedural: variação de cor por instância, rugosidade por pixel, normal de detalhe, janelas por ID |
| Nível de detalhe | Previsto (LOD por malha, impostor automático nas árvores) [19][22] | No lançamento faltavam LODs: pedestres com dentes sempre desenhados, pilha de toras com mais de 100 mil vértices [1][2][3] | LOD e fusão são obrigatórios antes de densidade |
| Vegetação | Árvores com idades, vento, variação de cor por estação e impostor automático; 4 camadas (árvores de cidade e silvestres, arbustos, forração alta e baixa) [22] | LOD da folhagem criticado [9] | Espécies reais com LOD em 3 degraus e impostor; cor por estação |
| Água | Ondas, espuma com faixa de altura, lagos mais calmos que o mar [23] | Física da água criticada, visual elogiado | Mar com espuma na costa; lago calmo que espelha o céu |
| Noite | Janelas e postes acendem ao pôr do sol [10] | Elogiada no geral; críticas: noite escura demais para construir, carros sem farol, rua sem luz dos prédios, falta brilho do céu da cidade [24][25] | Exposição mínima à noite, poças de luz dos postes, faróis e brilho do céu, tudo barato |
| Ciclo e clima | Clima por mapa real; um ciclo de dia e noite = um mês; noites mais longas no inverno; chuva e temperatura mudam o uso de parques e a energia [10] | Muitos desligam o ciclo porque a noite atrapalha [24] | Ciclo real como padrão, com "Sempre dia" e noite legível |
| Escala e densidade | Escala real, calçadas, faixas, postes, árvores de rua, carros e gente; decalques para faixas, pavimento e marcas de pneu [19][22] | Custo alto sem LOD | Decalque na textura da rua, props instanciados, gente e carros por amostra |

**O que a comunidade elogia no CS2:** a noite, as janelas acendendo, a escala real e o modo foto com câmera
cinematográfica [11][24]. **O que critica:** paleta cinza e fria, luz branca sem espalhamento, sombras fortes demais e
áreas sem luz escuras demais [9][15][16][26], desfoque, desempenho ruim por falta de LOD e sombra cara [1][2][4]. O
Lumina mostra que a correção mais pedida é de gradação (LUT, balanço de branco, curva), não de geometria [17][18].

---

## 2. Outros jogos de cidade com visual forte

| Jogo | O que faz bem | O que levamos |
|---|---|---|
| Highrise City | Escala enorme (cidades de até 194 km², 30 mil prédios, 20 mil pessoas); boa luz em "alta"; detalhe aparece conforme a câmera chega perto [28][29] | Escala e legibilidade valem mais que detalhe de longe; detalhe progressivo pelo zoom |
| Anno 117 | Direção de arte com o pilar "elegância" (refinado, delicado); luz suave de dia, pôr do sol laranja, noite contrastada; RT no PC [30][31][32] | Uma palavra-guia para a arte. Para nós: "grandeza" (escala, luz de verdade, materiais nobres) |
| Anno 1800 | Duas câmeras de sombra: uma de perto, detalhada, e uma de longe, larga, para o terreno [27]; fumaça e vegetação vivas [33] | O esquema de sombra da parcela V10 |
| Manor Lords | Nuvens volumétricas que criam névoa no alto; luz que muda com hora e clima [35][36] | Neblina e hora do dia como alma da imagem; nuvens baratas no celular |
| Frostpunk 2 | Luz emissiva como linguagem (calor, geradores, janelas); mapas de calor legíveis [44][45] | Emissivo por função (janelas, postes, faróis) e camadas de dados sobre o 3D |
| Workers & Resources | Visual modesto, mas a arquitetura copia a real e isso convence [46][47] | Realismo vem muito da arquitetura: casa com a frente de arquitetura (megaprojetos reais) |
| Cities: Skylines 1 com mods | "Render It!" (AO, bloom, gradação, FXAA/TAA) e "Relight"/Lumina (LUT) transformam o jogo [48][17] | O primeiro salto é de pós-processamento e gradação, antes de modelos novos |
| Infinitown (web, three.js) | Cidade procedural bonita e leve no navegador, com blocos que se repetem [49] | Prova de que o navegador aguenta uma cidade viva com arte coerente |

---

## 3. Diagnóstico do visual atual (capturas)

Escala do motor: 1 andar = 0,4 unidade = 3 m (`geom.js`), então **1 unidade = 7,5 m**. A mesa da Arcologia tem
80 x 62 unidades (600 x 465 m). A pessoa tem 0,27 unidade (2 m; deveria ter 0,23). A neblina vai de 115 a 470
unidades (860 m a 3,5 km).

| Captura | O que lê como BuildIt ou maquete | Causa no código |
|---|---|---|
| `m-alta-foto.png` (vista padrão) | Verde-limão uniforme no chão e nos terraços, brancos puros, tudo com o mesmo contraste até o fundo, mata em bolinhas com manchas laranja | `M.lawn` 0xd0dca0 e `M.planter` 0x5f8a3a com textura de grama viva (`tex.grass`); saturação 1,1 a 1,2 (`ciclo.js`); neblina linear longe; paleta `outono` a 2% (`forest.js`) |
| `b1-torre.png` | Torre em anéis empilhados (bolo), faixas âmbar, gente grande, beirais brancos grossos sem aresta, lago azul chapado | Modelo (frente de arquitetura); `fac_fita` com vidro pintado; `M.fasciaBeiral` branco sem desgaste; água opaca com cor fixa (`AGUA.raso/fundo`) |
| `b5-praca.png` | Piso branco e brilhante, canteiros redondos de desenho, arcos brancos, cores de roupa saturadas | `M.pavers`, `M.whiteSmooth`, paletas de `figuras.js` |
| `c6-noite.png` | Luz "da foto": chão iluminado com céu de noite; janelas todas acesas em âmbar igual; linhas ciano nas bordas | `FOTO` em `ciclo.js` (luz 2,5 com noite 1), `setNight(n, 3.2*n)`, `M.fasciaLuz`, `M.cyanGlow` |
| `m-alta-cidade.png` | Bairros como tabuleiro de caixas brancas iguais; sem sombra longe do centro; sem rua viva; campos em retalhos de desenho | `cidade.js` (caixa + fita de vidro + cobertura verde); sombra cobre no máximo ~140 x 140 unidades (`env.update`: `span` preso em 90); `arredores.js` |
| `c1-cap1.png` | Gabarito pintado em verde-claro com borda branca, "tapete" de grama, como planta de jogo de celular | `ground.js` (gabarito em grama aparada clara com borda de piso claro) |

Outros sinais de "desenho": a luz de recorte por Fresnel (`rimCor` em `hao.js` e a luz `rim` em `env.js`) contorna
paredes e copas como em ilustração; a luz "sempre da esquerda" (`ciclo.js`, `SOL`) nunca deixa a fachada em
contraluz; a câmera fica sempre alta (35° a 60°, `camera.js`), então quase nunca se vê horizonte, céu e silhueta.

**O que já está bom e fica:** MSAA com formato R11G11B10, bloom por redução dupla (o que a Arm recomenda [41]),
resolução dinâmica em degraus, limite de quadros por estado, sombra encaixada no texel e refeita só quando precisa,
HAO por campo de alturas, sombras das nuvens, fusão por quadrante, LOD da mata e da gente, janelas que acendem vão a
vão. É uma base boa: o salto é de direção de arte e de alguns passos novos, não de reescrever o motor.

---

## 4. Como chegar perto disso no navegador

### 4.1 Modelo de custo no Poco X7 (Mali-G615 MC2)

A GPU tem 2 núcleos a ~1 GHz; no 3DMark Wild Life Stress fica em ~3.100 pontos com 98,9% de estabilidade (não
esquenta) e é mais fraca que a do Dimensity 7200 [50][51][52]. Na qualidade Média a tela de 915 x 412 (CSS) vai a 1,3
de resolução: 1.190 x 536 = **0,64 megapixel**. Regras do Mali que pesam aqui [42]: textura 3D e formatos FP32 custam
o dobro; filtro trilinear custa o dobro do bilinear; compressão de quadro (AFBC) corta até 50% da banda. O MSAA é quase
de graça em GPU por blocos [42][43]. Com essas premissas, um passo de tela cheia simples custa ~0,3 a 0,7 ms (banda
de leitura e escrita), e cada leitura de textura a mais por pixel custa ~0,05 a 0,1 ms. Os números em ms deste
documento são **estimativas** por essa conta; o valor real sai da parcela V0 no aparelho.

### 4.2 Céu e atmosfera

- **`Sky` do three r186** (`examples/jsm/objects/Sky.js`): modelo de Preetham (turbidez, Rayleigh, Mie, disco do sol)
  e, desde o r186, nuvens 2D com ruído de gradiente, cobertura por região, sombra própria (Beer-powder), borda prateada
  na direção do sol (Henyey-Greenstein g = 0,7) e mistura com a atmosfera para as nuvens distantes sumirem na névoa
  [38]. Custa uma chamada e só os pixels de céu (0,1 a 0,3 ms no Média com 40% de céu na tela). Troca o céu em
  gradiente de `env.js` sem perder nada que importe (lua e estrelas podem continuar num termo à noite).
- **Atmosfera de Bruneton** (takram `three-atmosphere`, com perspectiva aérea e nuvens volumétricas [39]): é o
  caminho de qualidade do CS2 no navegador, mas pede pós-processamento próprio e passos de raio; fica para o Ultra no
  futuro, não para o celular.
- **Reflexos do céu (PMREM)**: já existe um cubo de 64 filtrado pelo `PMREMGenerator`. Passa a ser gerado do `Sky`
  (sem disco do sol) e refeito quando o sol anda mais de ~2° ou a fase do dia muda, com o tom contínuo por cima (já
  existe em `ceuTint`). Custo: um pico de 1 a 3 ms raro.

### 4.3 Curva de tons, exposição e gradação

- O three tem ACES, AgX (desde o r160) e Khronos PBR Neutral [53][54][55]. A **PBR Neutral** preserva a cor base
  (feita para produto) e hoje está no `COMPOSITE`; o **AgX** leva realces saturados (sol, pôr do sol, luzes) para o
  branco sem mudar o matiz, o que o ACES não faz [53][56]. Para foto de cidade, AgX. Decisão por A/B de capturas nas
  quatro horas (V2).
- Exposição em EV pela elevação do sol, e à noite uma **exposição mínima** (o CS2 é criticado pela noite escura
  demais [24][25]).
- Gradação: manter a cadeia analítica do `COMPOSITE` (barata, só ALU), mas com saturação ~1,0, contraste pela curva e
  sem `shadowTint`/`highTint`. Uma LUT 3D de 32³ é opcional para "looks" do modo Foto (uma leitura 3D por pixel:
  ~0,1 a 0,2 ms no Média).
- Nitidez adaptativa (CAS, 5 leituras) dentro da composição quando a resolução cai abaixo de 1,0: devolve a nitidez
  perdida pela resolução dinâmica por ~0,25 ms.

### 4.4 Neblina de altura e perspectiva aérea

A neblina exponencial de altura dá densidade maior nas partes baixas e transição suave com a altitude, a custo de
~2 camadas de névoa simples [57][58][59]. O three tem `exponentialHeightFogFactor` só no TSL (WebGPU); no WebGL basta
trocar os trechos `fog_pars_*` e `fog_fragment` do `ShaderChunk`, como o motor já faz com o PCF. A cor da névoa vem do
céu: azul no horizonte e um lóbulo quente de Mie na direção do sol. Em escala real, com o céu tropical: ~10% de
névoa a 1 km, ~50% a 4 km, e névoa baixa mais densa nos vales de manhã. Custo: ~15 operações por pixel,
~0,05 a 0,15 ms no Média, zero chamadas. É o recurso que mais tira o "objeto pequeno" da imagem.

### 4.5 Sombras

- CS2: 4 cascatas de 2048 e toda peça projetando sombra, ~40 ms por quadro [1][2]. O `CSM` do three segue a mesma
  ideia (uma luz por cascata; no celular, 2 cascatas e mapas menores [60][61][62]).
- r186 trouxe a **`SunLight`** com 2 cascatas de 1024 nativas no WebGLRenderer [63] (conferido em
  `src/renderers/webgl/WebGLLights.js` e no chunk `shadowmap_pars_fragment`). Porém as cascatas se encaixam no
  frustum da câmera e precisam ser refeitas a cada movimento, o que acaba com a política atual de refazer só quando
  precisa.
- **Proposta (Anno 1800 [27])**: mapa de **perto** = o atual (encaixado no texel, refeito quando o alvo sai de 20% do
  quadro ou o sol gira 0,5°); mapa de **longe** = uma segunda luz de sombra, de intensidade zero, cobrindo toda a área
  aberta, refeita só quando o sol gira ~2° ou a construção muda, e amostrada no shader quando o fragmento sai do mapa
  de perto. O three tem `shadow.autoUpdate` e `shadow.needsUpdate` por luz (`WebGLShadowMap.js`, linha 170), então
  cada mapa é refeito na sua hora. Hoje a vista aberta com a cidade fica sem sombra fora de ~140 x 140 unidades
  (`env.update`); isso resolve.
- Só projeta sombra o que tem altura (prédios, árvores grandes); gente, carros e props pequenos usam sombra de contato
  (já existe) e AO.

### 4.6 Oclusão de ambiente

- `GTAOPass`, `SSAOPass` e `SAOPass` do three (WebGL) redesenham a cena com `MeshNormalMaterial` para ter normais
  (`GTAOPass.js`, `_renderOverride`): dobram as chamadas e quebram os shaders com instância e vento. Fora.
- **N8AO** reconstrói tudo da profundidade, tem meia resolução com reescala que respeita a profundidade (~1 ms fixo),
  modos "Performance" (8 amostras) e "Low" (16) [37][64]. Custo estimado no Média: 1,5 a 2,5 ms com a resolução da
  profundidade. Entra só no PC (Alta meia resolução, Ultra inteira).
- **AO por vértice cozida** na geometria procedural (em `geom.js`, no `bake`): cantos de laje, pé de parede, junta
  com o chão, sob beirais. Custo zero por quadro, 1 atributo a mais. Com o HAO que já existe, cobre o celular.

### 4.7 Antisserrilhado

MSAA 2x no Média e 4x no PC (o custo no Mali é quase nulo [42][43]); SMAA no celular perde ~12 a 17 qps para o FXAA
num estudo [43]. TAA fica de fora: precisa de vetores de movimento, que os shaders com vento, água e animação por
vértice não geram, e deixa rastro com poucos quadros por segundo.

### 4.8 Iluminação global

- O r186 traz a **`LightProbeGridWebGL`**: grade 3D de sondas de harmônicos esféricos L2, assada toda na GPU, com
  assado incremental no r186 e rebatidas indiretas no r185 [63][65]. Por fragmento são 7 leituras de textura 3D
  (conferido em `lightprobes_pars_fragment.glsl.js`), que no Mali valem ~14 bilineares [42]: 1,5 a 3 ms no Média.
  Entra só no Ultra, sobre a Arcologia, refeita quando uma etapa termina.
- `VXGINode` e `SSGINode` existem no r186, mas só no WebGPU, e são caros demais para o celular [63][66].
- No celular a "GI" continua sendo: céu (PMREM) + hemisfério tingido pelo chão + HAO + AO cozida.

### 4.9 Reflexos e água

- `Water`, `Water2` e `Reflector` do three redesenham a cena de um espelho (`Reflector.js`): dobram as chamadas. Só
  no Ultra, a 1/4 da resolução e com camada restrita (Torre, Sede e céu), sobre o lago central.
- SSR só existe no WebGPU (`SSRNode`) e precisa de normais de tela. Fora.
- Para todos: vidro e água dielétricos (F0 = 0,04) refletindo o PMREM com Fresnel correto, ondas por dois mapas de
  normal (já existe), espuma na linha da costa e nas margens pela distância à água (a costa é analítica: `costaX`),
  cor por profundidade e cintilação do sol (já existe).

### 4.10 Bloom, profundidade de campo e tilt-shift

Bloom já está no padrão certo (redução dupla, a opção que a Arm indica para celular [41]); só o limiar muda para pegar
só sol, janelas e postes. Profundidade de campo e tilt-shift vão para o modo Foto, com meia resolução e dois passos
(1 a 2 ms), só no PC, como no modo foto do CS2 [11][12].

### 4.11 Materiais e fachadas

- CS2 usa 5 mapas por prédio [19][20]. Em textura procedural isso vira: **cor base** com albedo real e variação por
  instância (a ideia do ControlMask); **rugosidade/metal por pixel** num canal (caixilho metálico, vidro liso,
  concreto áspero); **normal de detalhe** de perto; **emissivo por ID de janela** (já existe o acendimento vão a vão).
- **Interior mapping** nas torres de vidro: salas falsas atrás da janela com uma leitura de atlas por pixel, sem
  geometria; o three-fenestra estende o `MeshStandardMaterial` por `onBeforeCompile`, faz milhares de janelas numa
  instância, tem variação de luz por janela por hash e cai para impostor chapado de longe [67][68]. Para Alta e Ultra
  de perto; custo ~0,3 a 0,8 ms onde houver janelas na tela.
- **Desgaste**: escorridos sob peitoris, pé de parede mais escuro, variação de tom por painel. É o que mais separa
  "real" de "maquete".
- **Arestas chanfradas** de poucos centímetros nas lajes e beirais: pegam brilho do sol e tiram o ar de caixa de CG.

### 4.12 Vegetação

CS2: árvores com idade, vento, cor por estação e impostor automático [22]. No three, impostores octaédricos
(uma carta que mistura 3 vistas assadas) já rodam 200 mil árvores numa cena de teste [69][70]. Para nós: 3 degraus
por espécie (carta de folhas com alpha-to-coverage de perto, lóbulos no meio, impostor ou a textura de copas do terreno
de longe), vento no vértice (já existe `windU`) e cor por instância e por estação (ipê florido de julho a setembro).

### 4.13 WebGPU e TSL: vale agora?

- A favor: o Chrome do Android liga o WebGPU em aparelhos com GPU ARM Mali e Android 12 ou mais desde a versão 121
  [71][72]; o three tem nós prontos (GTAO, SSR, SSGI, TRAA, nuvens, `exponentialHeightFogFactor`) e o r184 tirou
  alocações por quadro e tornou o `compileAsync` não bloqueante [73].
- Contra: (1) com muitas malhas não instanciadas o WebGPURenderer ainda é de 2 a 10 vezes mais lento que o WebGL
  (problemas [74] e [34], este aberto e de alta prioridade) [75]; (2) o motor tem ganchos `onBeforeCompile` em
  quase todo material (HAO, janelas, água, macro, grade, terreno, figuras): tudo teria de ser reescrito em TSL;
  (3) os nós caros não caberiam no Mali-G615 MC2 de qualquer jeito.
- **Decisão:** WebGL2 agora. Para baratear a migração depois: juntar os ganchos de shader num registro único
  (`render/ganchos.js`) com a mesma lista de trechos, para portar para TSL num lugar só. Reavaliar na fase 4 com a
  mesma cena rodando nos dois renderizadores no Poco X7.

---

## 5. O motor atual, arquivo por arquivo

Custo = diferença estimada no Poco X7, qualidade Média (0,64 MP, 30 qps), salvo indicação.

| Arquivo | Sai (estética BuildIt/maquete) | Entra | Custo |
|---|---|---|---|
| `engine.js` | Objetivo "imagem nítida o tempo todo, como no BuildIt"; PBR Neutral fixa; saturação 1,2 e tintas de sombra e realce como padrão | AgX (Neutral como opção), exposição em EV vinda do ambiente, nitidez CAS na composição quando `pr < 1`, passo de AO de tela (Alta/Ultra) com profundidade resolvida, tilt-shift e DOF no modo Foto, medição de GPU (V0) | +0,1 a 0,3 ms (AgX, CAS); AO só PC |
| `env.js` | Ciclo "foto" padrão, céu em gradiente artístico, aurora, luz de contraluz `rim`, `THREE.Fog` linear, sombra que só cobre o centro | `Sky` r186 com nuvens, PMREM do `Sky` pelo ângulo do sol, hemisfério tirado do céu, neblina de altura, mapa de sombra de longe, brilho do céu sobre a cidade à noite | 0 chamadas; céu 0,1 a 0,3 ms; pico de PMREM raro |
| `ciclo.js` | Quadros `FOTO` e `NOITE` com aurora; sol "sempre à esquerda" | Posição real do sol pela latitude (-20°) e pela data do calendário do jogo; quadros-chave viram parâmetros de atmosfera (turbidez, Rayleigh, Mie) e de exposição; noite com exposição mínima | 0 |
| `materials.js` | Paleta BuildIt (turquesa, verde-limão, laranja, branco puro), vidro azul translúcido (opacidade 0,34), fitas de luz ciano, `M.planter` verde vivo | Biblioteca PBR com albedo real: concreto, pedra (travertino, granito), vidro de controle solar escuro e reflexivo, metal (alumínio, bronze, champanhe), asfalto, cascalho de cobertura, jardim com arbustos; ganchos novos `comDetalhe` (normal e cor de detalhe de perto), `comInterior` (Alta/Ultra) e `comUmidade` (chuva) | +0,2 a 0,5 ms de perto; 0 chamadas |
| `textures.js` | Grama viva de ruído, copas em bolinha com sombra desenhada, fachadas com céu pintado no vidro | Texturas procedurais com canal de rugosidade: concreto com poros e manchas, asfalto com agregado e remendos, piso em proporção real, grama com touceiras e falhas, atlas de fachada (pele de vidro, pré-moldado, pedra, montantes), atlas de interiores, atlas de folhas; teto de 1024 no Média | tempo de carga (medir) |
| `ground.js` | Gabarito em grama clara com borda branca; tapete de grama; zonas pintadas | Chão por camadas (grama, terra, pedra, piso) com macrovariação; meio-fio, calçada e faixas; margem do lago em pedra com linha molhada; o gabarito vira marcação de topografia (piquetes e linhas finas), não um tapete verde | +0,2 a 0,4 ms; +1 a 3 chamadas |
| `forest.js` | Copas de icosaedro saturadas, paleta `outono` laranja solta na mata | 4 espécies (ipê, jacarandá, palmeira imperial, figueira), 3 degraus de LOD com carta de folhas e impostor, variação de cor por instância, cor por estação | +3 a 6 chamadas; triângulos de perto limitados |
| `hao.js` | Luz de recorte por Fresnel (`rimCor`) | Fica o HAO, o tom do céu e as sombras das nuvens; sai o recorte; entra o termo de AO por vértice no mesmo gancho | 0 |
| `figuras.js` | Pessoa de 2 m, roupas saturadas | Pessoa de 1,75 m (0,23 u), paleta de roupa realista, gente só perto (já tem LOD) | 0 |
| `arredores.js` | "Estilo SimCity BuildIt": campos em retalhos com sebes regulares, coqueiros de desenho, nuvens de algodão em sprite | Lavoura em retalhos de tons reais, mata densa com a textura de copas nova, mar com espuma e cor por profundidade, serras azuladas pela neblina, silhuetas de cidade ao longe para dar escala; nuvens só no céu | 0 a -2 chamadas |
| `cidade.js` | Caixas brancas iguais com fita de vidro e cobertura verde | (visual) coberturas com platibanda, caixas d'água, casas de máquinas; variedade de fachada por tipo; LOD de longe em caixa com fachada; à noite janelas variadas, poças de luz e faróis | reduz chamadas na vista aberta (V5) |
| `geom.js` | Arestas vivas de 90° | AO por vértice no `bake`, chanfro opcional nas bordas de laje | 0 por quadro |

**Perfis de qualidade depois do plano:**

| Recurso | Ultra (PC) | Alta (PC ou celular forte) | Média (Poco X7) | Leve |
|---|---|---|---|---|
| Resolução | 1,3 a 2,0 | 1,0 a 1,6 | 0,85 a 1,3 | 0,7 a 1,0 |
| Antisserrilhado | MSAA 4x | MSAA 4x | MSAA 2x | nenhum |
| Céu | `Sky` + nuvens, PMREM 128 | idem | `Sky` + nuvens, PMREM 64 | `Sky` sem nuvens, PMREM 32 |
| Tons | AgX + gradação + bloom 5 níveis | idem | idem, bloom 4 níveis | AgX direto no renderer, sem pós |
| Neblina | altura + aérea + sol | idem | idem | exponencial simples |
| Sombra | perto 2048 PCF8 + longe 2048 | perto 2048 + longe 1024 | perto 1024 PCF5 + longe 1024 refeito raro | perto 1024 |
| AO | N8AO inteira + HAO + vértice | N8AO meia + HAO + vértice | HAO + vértice + contato | vértice |
| GI | LightProbeGrid na Arcologia | não | não | não |
| Água | PMREM + espuma + reflexo planar do lago | PMREM + espuma | PMREM + espuma | PMREM |
| Materiais | detalhe + interiores | detalhe + interiores de perto | detalhe de perto | base |
| Vegetação | cartas + lóbulos + impostor, vento | idem | lóbulos + impostor, vento | lóbulos baixos |
| Noite | janelas, postes, faróis, brilho do céu | idem | idem | janelas e postes |
| Modo Foto | DOF e tilt-shift | tilt-shift | não | não |

---

## 6. Plano de implementação em parcelas

Cada parcela é pequena, independente e publicável sozinha. Aceite padrão de todas: `node ferramentas/montar.mjs` sem
avisos, `simular.mjs --testes` → `testes ok`, robô com `cap 6`, `vida 100`, `erros []`. Capturas antes e depois
pelo `testar.mjs`, sempre o mesmo conjunto: **m-alta** (vista padrão), **b1-torre**, **b5-praca**, **c6-noite**,
**m-alta-cidade**, **c1-cap1** e uma nova **h1-horizonte** (câmera baixa, V12), nas horas 9h, 12h, 17h30 e 21h quando a
parcela mexe em luz. `engine.stats` (calls, tris) registrado em cada captura. Orçamento que nenhuma parcela pode
quebrar: Média vista padrão com cidade ≤ 254 chamadas e 664 mil triângulos (hoje); PC Ultra vista aberta ≤ 1.500 e 5
milhões. Saves antigos valem: nenhuma parcela muda ids de projeto, etapa ou módulo; a configuração `ciclo: 'foto'`
salva vira `'relogio'` ou `'acelerado'` na carga.

### V0. Medição no aparelho (antes de tudo)
- **Arquivos:** `engine.js`, painel de desempenho em `ui/` (Configurações > Vídeo).
- **O que faz:** botão "Teste de desempenho": voo fixo de 20 s por 3 vistas (padrão, torre, cidade aberta) com
  resolução travada; mostra ms médio e p95, qps, calls, tris e a GPU; usa `EXT_disjoint_timer_query_webgl2` por passo
  quando o navegador expõe, senão só o tempo de quadro. O dono manda o print.
- **Custo:** 0 fora do teste.
- **Aceite:** o teste roda no Chromium de teste sem erro e grava o resultado; no aparelho, o dono manda o print da
  linha de base antes de V1.

### V1. Sol real e céu físico (maior ganho)
- **Arquivos:** `env.js`, `ciclo.js`, texto do ciclo em `ui/` (Configurações > Luz).
- **O que faz:** ciclo de dia real como padrão (sol pela latitude -20° e pela data do jogo; noites mais longas no
  inverno, como no CS2 [10]); `Sky` r186 com nuvens no lugar do céu atual; PMREM do `Sky` refeito a cada ~2° de sol;
  hemisfério e cor da neblina tirados do céu; aurora e modo "Foto" fora do padrão; "Sempre dia" continua.
- **Perfis:** todos; nuvens desligadas no Leve.
- **Custo:** 0 chamadas a mais (troca o céu); 0,1 a 0,3 ms de céu no Média; pico de PMREM de 1 a 3 ms a cada poucos
  minutos de jogo.
- **Aceite:** capturas m-alta às 9h, 12h, 17h30 e 21h: céu azul com nuvens de dia, laranja no pôr do sol, noite com
  lua; sombras mudando de lado com a hora; `calls` igual ao antes ±2; robô sem erro com o ciclo acelerado.

### V2. Curva de tons e gradação fotográfica
- **Arquivos:** `engine.js` (`COMPOSITE`), `ciclo.js` (valores de P).
- **O que faz:** AgX na composição (Neutral como opção de configuração), saturação ~1,0, contraste pela curva, sem
  tintas de sombra e realce; exposição em EV pela elevação do sol, exposição mínima à noite; CAS quando `pr < 1`.
- **Custo:** +0,1 a 0,3 ms no Média; 0 chamadas.
- **Aceite:** A/B AgX x Neutral nas 4 horas (o dono escolhe); saturação média do quadro m-alta cai (medida no PNG)
  sem o verde virar cinza; o céu do pôr do sol não estoura em amarelo chapado.

### V3. Neblina de altura e perspectiva aérea
- **Arquivos:** `env.js` (parâmetros por hora), um módulo novo `render/neblina.js` que troca os trechos `fog_*` do
  `ShaderChunk`; o céu e os arredores leem a mesma função.
- **O que faz:** neblina exponencial de altura em escala real (1 u = 7,5 m), cor do céu no horizonte e lóbulo quente
  na direção do sol; névoa baixa de manhã nos vales.
- **Custo:** ~0,05 a 0,15 ms no Média; 0 chamadas.
- **Aceite:** m-alta-cidade: bairros distantes azulados e com menos contraste, a Arcologia nítida; h1-horizonte sem
  costura entre chão e céu; `calls` e `tris` iguais.

### V4. Paleta e materiais PBR reais
- **Arquivos:** `materials.js`, `textures.js`, `geom.js` (chanfro opcional), `data/cidade.js` (`PALETA` com tons
  reais; a escolha de cor do jogador continua, com tons de fachada de verdade).
- **O que faz:** albedos reais (grama e jardim mais escuros e oliva, concreto 0,3 a 0,45, asfalto 0,05 a 0,12, pedra
  clara 0,5, vidro escuro dielétrico refletindo o céu), rugosidade por pixel, normal e cor de detalhe de perto
  (`comDetalhe`), desgaste (escorridos, pé de parede, variação por painel), materiais para a Torre de luxo (vidro de
  controle solar, aletas de bronze ou champanhe, pódio em pedra, coroamento com LED à noite). Sai o recorte `rimCor`.
- **Custo:** +0,2 a 0,5 ms nos closes; 0 a +2 chamadas (materiais novos entram na fusão por quadrante).
- **Aceite:** b1-torre, b5-praca e m-alta antes e depois; `calls` ≤ antes + 2; vidro espelha o céu e fica escuro
  contra o sol; nenhum branco puro acima de 0,85 de albedo.

### V5. LOD dos prédios da cidade (protege o orçamento)
- **Arquivos:** `cidade.js`, `mundo.js` (fusão por bairro).
- **O que faz:** cada prédio pronto ganha LOD 1 (caixa com fachada em textura, ~12 a 30 triângulos, fundida por
  bairro) e LOD 2 à noite de longe (pontos de luz); troca por distância em pixels com histerese, como a mata.
- **Custo:** reduz. Meta: vista aberta no Média ≤ 300 chamadas e ≤ 900 mil triângulos (hoje 394 chamadas).
- **Aceite:** m-alta-cidade com zoom 230 no Média ≤ 300 calls; no Ultra sem salto visível na troca (captura em
  sequência de zoom).

### V6. Terreno e chão
- **Arquivos:** `ground.js`, `arredores.js`, `textures.js`, `models/plano.js` (vias).
- **O que faz:** chão por camadas (grama, terra, pedra, piso) com macrovariação e grama com touceiras; ruas com
  meio-fio, calçada e faixas desenhadas na textura da via (decalque sem geometria nova); margem do lago em pedra com
  linha molhada; o gabarito do capítulo 1 vira marcação de topografia; lavouras e mata dos arredores em tons reais.
- **Custo:** +0,2 a 0,4 ms no Média; +1 a 3 chamadas.
- **Aceite:** c1-cap1 e m-alta-cidade antes e depois; `calls` ≤ antes + 3.

### V7. Vegetação real
- **Arquivos:** `forest.js`, `textures.js` (atlas de folhas e de impostores), modelos que usam `treeGroup`.
- **O que faz:** ipê, jacarandá, palmeira imperial e figueira; 3 degraus (carta de folhas com alpha-to-coverage de
  perto, lóbulos no meio, impostor ou textura de copas de longe); variação de cor por instância; ipê florido no
  inverno e seca amarelando o capim de maio a setembro (uniforme de estação). Sai a paleta `outono` solta.
- **Custo:** +3 a 6 chamadas (espécie x degrau, instanciado); triângulos de árvores de perto ≤ 150 mil no Média.
- **Aceite:** b5-praca e m-alta; orçamento de triângulos respeitado; vento visível de perto.

### V8. Noite de metrópole
- **Arquivos:** `materials.js` (janelas), `env.js` (brilho do céu), `ground.js` e vias (poças de luz), carros em
  `cidade.js`/`arredores.js`.
- **O que faz:** janelas com temperatura de cor e intensidade variadas, parte apagada, cortinas (sem o âmbar igual);
  poças de luz dos postes calculadas no shader do chão a partir da grade de postes (sem luzes reais); faróis e
  lanternas nos carros (emissivo na instância, com bloom); brilho alaranjado do céu sobre a área construída; reflexo
  das luzes na água; fitas ciano da borda saem. Resolve as críticas de noite do CS2 [24][25].
- **Custo:** +0,1 a 0,2 ms no Média; 0 a +2 chamadas.
- **Aceite:** c6-noite antes e depois às 21h e 2h; ruas com luz no chão; carros com farol; exposição legível.

### V9. Água
- **Arquivos:** `materials.js` (`comAgua`), `arredores.js` (mar).
- **O que faz:** lago calmo e escuro que espelha o céu (PMREM, rugosidade 0,05, Fresnel), ondulação de vento; mar
  com cor por profundidade (turquesa no raso, azul fundo), espuma animada na arrebentação ao longo de `costaX`,
  cintilação do sol. No Ultra, reflexo planar do lago central a 1/4 com camada só da Torre, Sede e céu.
- **Custo:** 0 chamadas no Média; Ultra +40 a 80 chamadas e ~1 ms.
- **Aceite:** b1-torre e vista da praia antes e depois; `calls` do Média iguais.

### V10. Sombras de longe
- **Arquivos:** `env.js`, `engine.js` (patch do trecho de sombra para usar o mapa de longe fora do de perto).
- **O que faz:** segunda luz de sombra com intensidade zero cobrindo a área aberta, refeita só com o sol a cada ~2°
  ou quando uma obra termina, em 4 ladrilhos espalhados em 4 quadros para não travar; o mapa de perto continua como
  está.
- **Custo:** amostragem +0,1 ms; refazer: pico de 5 a 15 ms dividido em 4 quadros, raro.
- **Aceite:** m-alta-cidade com todos os prédios com sombra; captura no ciclo acelerado sem salto de sombra; `calls`
  do quadro normal iguais.

### V11. AO cozida e AO de tela no PC
- **Arquivos:** `geom.js` (`bake`), `hao.js` (termo de vértice), `engine.js` (passo de AO depth-only).
- **O que faz:** AO por vértice em cantos, pés de parede e sob beirais em todos os perfis; no PC, passo de AO por
  profundidade (meia resolução no Alta, inteira no Ultra) com reescala que respeita a profundidade.
- **Custo:** 0 no celular; PC +0,5 a 1,5 ms.
- **Aceite:** b1-torre e b5-praca com contato claro entre peças e chão; nenhuma chamada de cena a mais (o passo de AO
  é de tela cheia).

### V12. Câmera de grandeza e modo Foto
- **Arquivos:** `camera.js`, `engine.js`, `ui/` (modo Apreciar/Foto).
- **O que faz:** de perto a câmera pode descer até ~12° de inclinação e mostrar horizonte e silhueta; modo Foto com
  hora, nuvens e neblina ajustáveis, tilt-shift e DOF (PC), vinheta, como o modo foto do CS2 [11][12].
- **Custo:** 0 no jogo normal; 1 a 2 ms no modo Foto.
- **Aceite:** captura h1-horizonte (câmera a 12° com a Torre e o céu); `calls` na câmera baixa ≤ meta do perfil (mais
  céu e mais distância na tela).

### V13. Densidade de rua e telhados
- **Arquivos:** `cidade.js`, `models/praca.js`, `models/plano.js`, `figuras.js` (escala 0,23).
- **O que faz:** postes, árvores de rua, bancos, pontos de ônibus, carros estacionados, faixas de pedestre; nos
  telhados, platibandas, caixas d'água e casas de máquinas; tudo instanciado e fundido por quadrante, com LOD e
  densidade menor no Média.
- **Custo:** +5 a 10 chamadas; PC +100 a 200 mil triângulos; Média metade da densidade.
- **Aceite:** capturas de perto de um bairro; `calls` e `tris` dentro da meta de cada perfil.

### V14. Iluminação global assada no Ultra
- **Arquivos:** `env.js`, `mundo.js`.
- **O que faz:** `LightProbeGridWebGL` sobre a Arcologia (ex.: 16 x 4 x 12 sondas), assada de forma incremental ao
  terminar uma etapa e quando a fase do dia muda.
- **Custo:** só Ultra; 7 leituras 3D por pixel; assado espalhado por vários quadros.
- **Aceite:** pátios e sob as marquises com luz rebatida colorida; qps do Ultra ≥ 60 no PC do dono.

### V15. Chuva e estações (fase 4)
- **Arquivos:** `env.js`, `materials.js` (`comUmidade`), `forest.js`.
- **O que faz:** céu nublado, chão molhado (rugosidade menor, albedo mais escuro, reflexo do céu), gotas na tela em
  partículas leves; estações na vegetação e no capim.
- **Custo:** +0,1 a 0,3 ms na chuva.
- **Aceite:** capturas com chuva de dia e de noite (luzes refletidas no asfalto molhado).

**Ordem e dependências.** V0 → V1 → V2 → V3 (as três juntas mudam a cara do jogo sem custo) → V4 → V5 (antes de
qualquer densidade) → V6 → V7 → V8 → V9 → V10 → V11 → V12 → V13 → V14 → V15. V4 conversa com a frente de arquitetura
(a Torre retangular de luxo usa os materiais de V4); V5 e V13 conversam com a fase 4 (LOD e blocos).

---

## 7. O que dá e o que não dá do CS2 no Poco X7

| Recurso do CS2 | Poco X7 (Média) | PC (Alta/Ultra) | Por quê |
|---|---|---|---|
| Céu físico | Sim (Preetham + nuvens 2D) | Sim; Bruneton no futuro | Uma chamada, só pixels de céu |
| Nuvens volumétricas | Não; nuvens 2D e sombras de nuvem | Talvez (takram) | Passos de raio por pixel |
| Névoa volumétrica e raios de luz | Não; neblina de altura analítica | Não | Volume em froxels é caro até no PC [7][8] |
| Perspectiva aérea | Sim (analítica) | Sim | ALU por pixel |
| Iluminação global | Não; céu + hemisfério + HAO | Sondas assadas no Ultra | 7 leituras 3D por pixel |
| AO de tela | Não; HAO + AO cozida | Sim, depth-only | Banda e ms no Mali |
| Sombras em cascata | Não; perto + longe estático | Perto + longe | 4 cascatas custam ~40 ms no PC [1] |
| TAA / DLSS / FSR | Não; MSAA 2x + CAS | MSAA 4x | Sem vetores de movimento; FSR1 só no WebGPU do three [73] |
| Reflexos de tela / planar | Não; PMREM + Fresnel | Planar do lago no Ultra | Redesenha a cena |
| Profundidade de campo | Não | Só modo Foto | Criticada e cara [4] |
| Materiais PBR com detalhe | Sim, detalhe de perto | Sim + interior mapping | Leituras extras só de perto |
| Árvores com idade, vento, estação, impostor | Sim, com menos espécies de perto | Sim | Instância + impostor |
| Noite (janelas, postes, faróis, brilho do céu) | Sim, tudo emissivo e analítico | Sim | Sem luzes dinâmicas reais |
| Água com ondas e espuma | Sim, por normal e máscara | Sim | Sem simulação de fluido |
| Escala e densidade de props | Metade, com LOD | Sim | Chamadas e triângulos |
| Clima e estações | Sim (chuva leve, cor por estação) | Sim | Uniformes |

---

## 8. Riscos e cuidados

- **Chaves de programa:** cada gancho novo precisa entrar na `customProgramCacheKey` (como o `|hao` faz hoje), senão
  o three reaproveita o programa errado. O aquecimento de obras (`obras.aquecer`) tem de compilar os programas novos.
- **Patch do PCF:** `engine.js` troca o trecho `shadowmap_pars_fragment` por regex; o mesmo trecho agora tem a
  `SunLight`. Qualquer patch de sombra (V10) tem de conferir o texto do r186 e cair para o original com aviso, como hoje.
- **Neblina global:** trocar `fog_*` afeta todo material com `fog: true`, inclusive os `ShaderMaterial` que incluem
  os trechos. Conferir céu, nuvens, figuras e água.
- **Capturas sem GPU:** o Chromium de teste usa SwiftShader: vale para imagem, `calls` e `tris`, nunca para ms. Todo
  custo em ms deste documento é estimativa até V0 medir no aparelho.
- **Robô e vitrine:** a hora padrão muda (de "foto" para ciclo real); o robô e as capturas de aceite devem fixar a
  hora por parâmetro para não depender do relógio.
- **Saves:** nada de ids novos; só a configuração de ciclo é migrada.
- **Tempo de carga:** texturas procedurais maiores custam CPU na abertura; gerar em etapas durante a tela de carga e
  guardar no cache do navegador se passar de ~1 s no Poco X7.

---

## 9. Fontes

Cities: Skylines II
1. paavohtl, "Why Cities: Skylines 2 performs poorly" (4 cascatas de 2048, ~40 ms de sombra, 4.828 de 6.705 chamadas, dentes, falta de LOD): https://blog.paavo.me/cities-skylines-2-performance/
2. PC Gamer, análise técnica de polígonos do CS2: https://www.pcgamer.com/a-tech-analysis-of-cities-skylines-2-proves-its-rendering-way-too-many-polygons-making-cyberpunk-2077-look-like-minecraft-in-comparison/ e HotHardware: https://hothardware.com/news/cities-skylines-2-autopsy
3. Wikipedia, Cities: Skylines II (HDRP, Direct3D 11): https://en.wikipedia.org/wiki/Cities:_Skylines_II ; TechRadar sobre os dentes: https://www.techradar.com/gaming/pc-gaming/no-cities-skylines-2s-performance-issues-arent-because-of-the-citizens-teeth-developer-confirms
4. Profundidade de campo e tilt-shift (fórum Steam): https://steamcommunity.com/app/949230/discussions/0/3877095833476042048/ ; Paradox, guia de desempenho: https://support.paradoxplaza.com/hc/en-us/articles/14648080779538-Cities-Skylines-2-Our-Guide-to-Optimizing-Performance
5. DSOGaming, análise de desempenho: https://www.dsogaming.com/pc-performance-analyses/cities-skylines-2-benchmarks-pc-performance-analysis/
6. Opções gráficas (GI, volumétricos, SSR, nuvens, terreno, LOD): https://www.switchbladegaming.com/game-settings/cities-skylines-2-best-settings/
7. PC Gamer, 5 opções gráficas: https://www.pcgamer.com/cities-skylines-2-immediately-change-these-5-graphics-options-for-a-big-performance-boost/
8. Hardware Times, guia de desempenho: https://hardwaretimes.com/cities-skylines-2-performance-guide-how-to-run-the-game-at-80-fps/
9. Vortex Gaming, gráficos realistas (luz branca sem espalhamento, sombras fortes, LOD da folhagem): https://vortexgaming.io/en/postdetail/739188
10. Colossal Order, diário 8, Clima e Estações: https://colossalorder.fi/?p=1788 ; https://www.paradoxinteractive.com/games/cities-skylines-ii/features/climate-seasons
11. Diário 13, Câmera cinematográfica e modo foto: https://forum.paradoxplaza.com/forum/developer-diary/development-diary-13-cinematic-camera-photo-mode.1597590/ ; https://www.paradoxinteractive.com/games/cities-skylines-ii/features/cinematic-camera-photo-mode
12. Wiki do CS2, Photo Mode (volumes do HDRP expostos): https://cs2.paradoxwikis.com/Photo_Mode
13. MP1st sobre o modo foto: https://mp1st.com/news/cities-skylines-2-announces-revamped-photo-mode-feature-in-latest-developer-deep-dive
15. "CS2 looks ugly" (Steam): https://steamcommunity.com/app/949230/discussions/0/4625853707314005367/
16. "Game looks terrible now?" (Steam): https://steamcommunity.com/app/949230/discussions/0/762933430657795171/
17. Lumina (documentação): https://skylinx.gitbook.io/lumina
18. Lumina (Paradox Mods): https://mods.paradoxplaza.com/mods/94394/Windows
19. Asset Pipeline: Buildings: https://cs2.paradoxwikis.com/index.php?mobileaction=toggle_view_desktop&title=Asset_Pipeline%3A_Buildings
20. Texturas do CS2 (MaskMap, ControlMask): https://cslmodding.info/cs2/textures/
21. Assets: Setting Up Emissive: https://cs2.paradoxwikis.com/Assets:_Setting_Up_Emissive
22. Asset Pipeline: Aging Trees (idades, vento, estação, impostor, camadas): https://cs2.paradoxwikis.com/Asset_Pipeline:_Aging_Trees
23. Map Creation: Water: https://cs2.paradoxwikis.com/Map_Creation:_Water
24. "Light Pollution and Real Next-Gen Graphics" (Steam): https://steamcommunity.com/app/949230/discussions/0/3878221099907609366/ ; ciclo desequilibrado: https://steamcommunity.com/app/949230/discussions/0/3937895063005320114/
25. Visibilidade à noite (fórum Paradox): https://forum.paradoxplaza.com/forum/threads/idea-to-improve-night-time-visibility.1603959/
26. "Shadows too Dark" (Steam): https://steamcommunity.com/app/949230/discussions/0/3877095833484029841/

Outros jogos
27. Anno 1800, análise de quadro (duas câmeras de sombra): https://blog.thomaspoulet.fr/posts/anno-1800-frame-analysis/
28. Highrise City, NoobFeed: https://www.noobfeed.com/reviews/highrise-city-pc-review ; GamesCreed: https://www.gamescreed.com/reviews/highrise-city-pc-review/
29. Highrise City, 3rd-strike: https://3rd-strike.com/highrise-city-review/ ; Steam: https://store.steampowered.com/app/1489970/Highrise_City/
30. Anno 117, DevBlog da interface e do visual (pilar "elegância"): https://www.anno-union.com/devblog-the-user-interface-team-and-a-deeper-dive-into-the-visuals/
31. Anno 117, análise PC Gamer: https://www.pcgamer.com/games/city-builder/anno-117-pax-romana-review/
32. Anno 117, GameGPU (luz, pôr do sol, RT): https://en.gamegpu.com/test-gpu/rts-strategii/anno-117-pax-romana-test-gpu-cpu
33. Anno 1800 no Intel (de 10 a 30 qps em notebook): https://www.intel.com/content/dam/develop/external/us/en/documents/bringing-anno-1800-to-laptop-gamers-around-the-world-the-long-road-from-10-to-30-fps.pdf
35. Manor Lords, notas da 0.8.004 (UE5): https://steamdb.info/patchnotes/15797823/
36. Manor Lords, Tom's Hardware: https://www.tomshardware.com/pc-components/gpus/manor-lords-pc-benchmarks
44. Frostpunk, design: https://retrostylegames.com/blog/frostpunk-game-design/
45. Frostpunk, mapa de calor: https://lexdev.net/tutorials/case_studies/frostpunk_heatmap.html
46. Workers & Resources (Wikipedia): https://en.wikipedia.org/wiki/Workers_%26_Resources:_Soviet_Republic
47. Workers & Resources, Gazettely: https://gazettely.com/2024/07/games/workers-resources-soviet-republic-review/
48. Render It! (CS1): https://smods.ru/archives/55351
49. Infinitown (Little Workshop): https://demos.littleworkshop.fr/infinitown

Navegador, three.js e GPU de celular
34. three.js, problema 30560 (UBO do WebGPURenderer com muitas malhas, aberto, alta prioridade): https://github.com/mrdoob/three.js/issues/30560
37. N8AO: https://github.com/N8python/n8ao
38. three.js r186, notas ("More realistic clouds" no Sky, SunLight com CSM, LightProbeGrid incremental, SSAONode, VXGINode): https://github.com/mrdoob/three.js/releases/tag/r186
39. takram three-geospatial (atmosfera de Bruneton e nuvens volumétricas para three): https://github.com/takram-design-engineering/three-geospatial
40. Unity HDRP, céu com base física: https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.0/manual/create-a-physically-based-sky.html
41. Arm, pós-processamento no celular (redução dupla no bloom): https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/post-processing-effects-on-mobile-optimization-and-alternatives ; GDC18: https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/post-processing-effects-for-mobile-at-gdc18
42. Guia do Mali (textura 3D e FP32 2x, trilinear 2x, AFBC até 50%): https://github.com/azhirnov/cpu-gpu-arch/blob/main/gpu/ARM-Mali_Guide.md
43. Antisserrilhado em celular (MSAA x FXAA x SMAA): https://fenix.tecnico.ulisboa.pt/downloadFile/1407770020546379/extended-abstract-antialiasing.pdf ; Meta, MSAA em GPU móvel: https://developers.meta.com/horizon/documentation/native/android/mobile-msaa-analysis/
50. Dimensity 7300 (Beebom): https://beebom.com/dimensity-7300-benchmarks/
51. Dimensity 7300 (NanoReview): https://nanoreview.net/en/soc/mediatek-dimensity-7300
52. Mali-G615 MC2 explicado: https://rockchips.net/mali-g615-mc2-gpu-explained/
53. three.js, suporte a AgX (problema 27362): https://github.com/mrdoob/three.js/issues/27362
54. Khronos PBR Neutral: https://www.khronos.org/news/press/khronos-pbr-neutral-tone-mapper-released-for-true-to-life-color-rendering-of-3d-products
55. model-viewer, comparação de curvas: https://modelviewer.dev/examples/tone-mapping
56. Fórum three.js sobre o AgX: https://discourse.threejs.org/t/is-agx-tonemapping-implemented-correctly/60609
57. Unreal, neblina exponencial de altura: https://dev.epicgames.com/documentation/en-us/unreal-engine/exponential-height-fog-in-unreal-engine
58. Wenzel, efeitos atmosféricos em tempo real (SIGGRAPH 2006): https://advances.realtimerendering.com/s2006/Wenzel-Real-time_Atmospheric_Effects_in_Games.pdf
59. Flax, neblina de altura: https://docs.flaxengine.com/manual/graphics/fog-effects/exponential-height-fog.html
60. three.js, CSM: https://threejs.org/docs/pages/CSM.html
61. three-csm (StrandedKitty): https://github.com/StrandedKitty/three-csm
62. Guia de desempenho do three (2 cascatas no celular): https://gist.github.com/iErcann/2a9dfa51ed9fc44854375796c8c24d92
63. three.js r186 (ver [38]) e r185 (rebatidas no LightProbeGrid, GTAO, SSR): https://github.com/mrdoob/three.js/releases/tag/r185
64. Fórum three.js, HBAO x N8AO: https://discourse.threejs.org/t/new-ambient-occlusion-example-hbao-vs-n8ao/58847
65. (código local) `examples/jsm/lighting/LightProbeGridWebGL.js`
66. three.js, página do WebGPURenderer: https://threejs.org/manual/en/webgpurenderer.html
67. three-fenestra (interior mapping para three): https://github.com/codedgar/three-fenestra
68. Joost van Dongen, interior mapping: http://joostdevblog.blogspot.com/2018/09/interior-mapping-real-rooms-without.html
69. Fórum three.js, floresta de impostores octaédricos: https://discourse.threejs.org/t/a-forest-of-octahedral-impostors/85735
70. Componente de impostores octaédricos: https://github.com/ektogamat/octahedral-impostor-component
71. Chrome 121, WebGPU no Android (Android 12+, GPUs Qualcomm e ARM): https://developer.chrome.com/blog/new-in-webgpu-121
72. OSnews sobre o WebGPU no Chrome 121 para Android: https://www.osnews.com/story/138330/webgpu-comes-to-chrome-121-for-android/
73. three.js r184 (sem alocação por quadro, `compileAsync` não bloqueante, FSR1 no WebGPU): https://github.com/mrdoob/three.js/releases/tag/r184
74. three.js, problema 31055 (WebGPU ~10 vezes mais lento com 3.000 cubos): https://github.com/mrdoob/three.js/issues/31055
75. Fórum three.js, WebGPURenderer mais lento que o WebGL: https://discourse.threejs.org/t/why-webgpurenderer-performance-significantly-lower-than-webglrenderer/77629

Código local conferido (three 0.186.0 em `/home/user/diogo/node_modules/three`)
- `examples/jsm/objects/Sky.js`: Preetham com nuvens 2D, Beer-powder e borda prateada.
- `examples/jsm/lights/SunLight.js` e `SunLightShadow.js`: 2 cascatas de 1024; `src/renderers/webgl/WebGLLights.js` e `shadowmap_pars_fragment.glsl.js` com `NUM_SUN_LIGHT_SHADOWS`.
- `examples/jsm/lighting/LightProbeGridWebGL.js` e `src/renderers/shaders/ShaderChunk/lightprobes_pars_fragment.glsl.js`: 7 leituras de textura 3D por fragmento.
- `examples/jsm/postprocessing/GTAOPass.js`: `_renderOverride` com `MeshNormalMaterial` (redesenha a cena).
- `examples/jsm/objects/Water.js` e `Reflector.js`: `renderer.render(scene, mirrorCamera)` (redesenha a cena).
- `src/renderers/webgl/WebGLShadowMap.js`: `shadow.autoUpdate` e `shadow.needsUpdate` por luz.
- `src/nodes/fog/Fog.js`: `exponentialHeightFogFactor` (só TSL).
