# Arcologia de Held: projeto do jogo novo

**Versão 2, 27/09/2026**, depois da crítica em três lentes (dono, engenharia e design). Documento único que manda a
partir de agora. Junta os três desenhos (simulação, render e interface) e as quatro pesquisas, resolve os conflitos
entre eles e fecha as dúvidas. Onde este documento fala, ele vale. Onde ele cala, vale o desenho da parte, que entra
no repositório como anexo, com as trocas da seção 6. A seção 7 responde à crítica ponto a ponto (aceito, adaptado ou
recusado, com a razão). A versão 1 fica em `scratchpad/cs2/integ/PROJETO-NOVO-v1.md`, só para consulta. Nada foi
implementado ainda.

| Anexo (entra no repositório na F0) | Origem nesta pasta | Serve para |
|---|---|---|
| `docs/desenho/sim.md` | `desenho-sim.md` | regras, fórmulas, números de partida, tabelas de itens, serviços, marcos |
| `docs/desenho/render.md` | `desenho-render.md` | luz, sombras, terreno, água, vias, gerador de prédios, LOD, orçamento |
| `docs/desenho/ui.md` | `desenho-ui.md` | tokens, tipografia, glifos, layout medido, componentes, gestos, som |
| `docs/pesquisa/*.md` | `visual.md`, `ui.md`, `arquitetura.md`, `sistemas.md` | fontes e referências (não passaram por crítica) |

**Conferido pelo integrador**, além do que cada parte mediu:

- three 0.186.0 do repositório: `SunLight` com `_cascadeCount = 2`, nuvens no `Sky.js` (`cloudCoverage`),
  `reversedDepthBuffer` e `AgXToneMapping` existem. **Mas o passe de sombra do three filtra pelas camadas da câmera da
  vista, não da câmera de sombra**: `WebGLShadowMap.js`, linha 522, faz `object.layers.test(camera.layers)`, e essa
  `camera` é a principal, passada em `WebGLRenderer.js`, linha 1737. A regra "só a caixa LOD1 projeta" não sai do
  `shadowMap` do three; vira a sombra própria da D43.
- Limites do Chromium de teste (SwiftShader, `sonda-limites.mjs`): 32 unidades de textura no fragmento, 31 vetores de
  varying, 4.096 vetores de uniforme, MSAA até 4, `EXT_clip_control`, `WEBGL_multi_draw`,
  `EXT_disjoint_timer_query_webgl2`, texturas ASTC e ETC. O que se garante no Poco X7 até medir é o mínimo do WebGL2:
  16 texturas, 15 varyings, 224 vetores de uniforme no fragmento. Daí a guarda da D44 e a sonda da Prévia 0.
- Grade de alturas no Node, com 5 oitavas de ruído: **1025² a 8 m em 125 ms (4 MB); 2049² a 4 m em 437 ms (16 MB)**.
  gzip de 3,4 MB de células: 18 ms. Script: `integ/bench-terreno.mjs`.
- Regras de hoje (`fonte/sim/estado.js`): janela do Depósito de 4 h, venda a 1,5 x o preço base, 100 vendas por
  janela; tarifa de 5, 8 ou 11 pelo **bem-estar geral arredondado** (`Math.round`, linha 428) antes da faixa; ano de
  2 h e renda por hora real.
- `fonte/web/sw.js` de hoje apaga no `activate` todo cache com nome diferente do seu; `fonte/core/salvar.js` grava
  primeiro no `localStorage`, de forma síncrona, e a trava "outra página gravou" lê de lá. As duas coisas mudam o
  `sw.js` (D38) e o save (D31) do jogo novo.
- Capturas do jogo atual (`trevo/int/`), medidas em 344 x 192: saturação média de 0,44 a 0,50 e 24% a 30% de pixels
  verde-lima nas vistas da Arcologia; a vista da cidade dá 0,25, mas é névoa lavada sobre quadras vazias. Servem de
  "o que não repetir"; os limites de aceite saem de fotos aéreas reais (A9).
- Tamanho do jogo atual: ~15 mil linhas em `fonte/` e 2 mil em `ferramentas/`. O M1 inteiro está estimado em ~63 mil
  linhas com testes, em 72 sessões de agente, com três pontos de parada do dono (seção 4.4).

---

## 1. Visão e pilares

### 1.1 O jogo em um parágrafo

Você é a **Holding Held**, concessionária que ganhou o direito de planejar Heldópolis, uma cidade nova no litoral
brasileiro. Você traça avenidas no relevo, pinta zonas e vê bairros nascerem pela demanda, leva água, esgoto, energia e
serviços pela rede viária, e resolve o trânsito, como no **Cities: Skylines II**. Ao mesmo tempo você produz os
materiais da cidade em cadeias com lotes de 1 a 10, estoque e caminhões, como no **Highrise City**: do marco 3 em
diante a cidade densa só sobe com material da Holding. Com esse caixa e esses materiais você ergue a **Arcologia de
Held**, o megaprojeto de assinatura, num plano diretor que o dono escolhe entre três, tirados de distritos reais. No M1
a **Torre Lâmina**, retangular e de alto luxo, sobe em 4 etapas até o heliponto a 330 m, e cada etapa devolve algo que
a cidade usa.

### 1.2 Pilares

| Pilar | Referência | O que o dono sente |
|---|---|---|
| **Cidade de verdade** | CS2 (referência máxima) | escala real, relevo, vias livres em curva, bairros que crescem sozinhos, redes e trânsito que pesam no jogo |
| **Produção com consequência** | Highrise City | a cidade de nível 3 a 5 depende da Holding; lotes de 1 a 10; caminhões que se veem; Depósito |
| **Megaprojetos reais em tudo** | One Vanderbilt, 111 West 57th, Jewel Changi, Marina Bay, Rede Sarah, CEUs, CopenHill, Aterro do Flamengo | a Torre, os serviços e as fábricas com arquitetura de verdade; a Arcologia subindo por etapas |
| **Decisões de dono** | Frostpunk 2, Anno 117 | Conselho com dilemas, Influência e Legado com efeito escrito, memória das escolhas |
| **Bonito no celular** | CS2, Anno 1800, Manor Lords | luz física, neblina de altura, noite de metrópole, vida de luxo, 30 qps no Poco X7 |

### 1.3 Laço do jogador

- **A cada minuto (o gesto):** traçar ou emendar vias; pintar zonas; pôr um serviço onde a camada mostra falta; tocar
  num aviso sobre um prédio, ler a causa e agir; resolver o gargalo de uma cadeia (insumo, trabalhadores, armazém);
  pausar para planejar, 4x para ver crescer.
- **A cada hora de jogo (a decisão):** um marco chega com dinheiro, licença de área e desbloqueios; uma etapa da
  Arcologia termina, devolve um efeito e a próxima pede materiais; o Conselho traz um dilema; fechar a conta com
  empréstimo e manutenção sem zerar o caixa.
- **A cada sessão:** no Poco X7 (15 a 40 min) retoma do save com "Onde você parou", cumpre 1 ou 2 dos 3 objetivos
  abertos, conclui uma etapa. No PC (1 a 4 h) planeja bairros inteiros, reorganiza vias, monta cadeias.

### 1.4 O que põe o jogo no nível do CS2

| Área | No CS2 | Aqui, no navegador | Parcela |
|---|---|---|---|
| Escala | mapa real em metros, relevo, costa | 1 unidade = 1 m; 8,2 km jogáveis; moldura de 32 km; terreno CDLOD numa chamada | S1a, R2a |
| Luz | HDRP físico | céu `Sky` com nuvens, PMREM por quadros-chave, AgX, exposição pela altura do sol, neblina de altura com perspectiva aérea | R1a |
| Sombras | cascatas | perto: sombra própria (cena de projetores LOD1, D43) em todos os perfis; longe: campo de alturas; HAO; AO por vértice | R1a, R1b |
| Vias | Bézier, cruzamentos com meio-fio, pontes | grafo de Bézier cúbicas, perfil real, cruzamentos recortados, marcas no shader; ponte simples no M1b | S1b, R3a, X4 |
| Zonas | células de 8 m, demanda por fatores, 5 níveis, abandono | igual, com os fatores à vista | S1b, S2a |
| Prédios | lote inteiro, variedade, níveis | gerador em duas etapas puras, tipologias brasileiras, fachada no shader filtrada, LOD com a mesma silhueta | R4a, R4b |
| Serviços e indústria | modelos de assinatura | cada serviço e fábrica com modelo próprio e referência real (Rede Sarah, CEU, CopenHill, Marina Barrage) | R5 |
| Vida | cidadãos e carros | cidadãos estatísticos, carros pelo fluxo, gente pela atividade, vida de luxo na baía e no céu | S2a, S1c, R3a, R3b, R6 |
| Serviços e redes | pela rede viária, com capacidade | Dijkstra de várias origens fatiado por trabalho e redes dentro das vias com racionamento | S2a |
| Trânsito | agentes com rota | atribuição agregada no worker com efeito em produtividade, comércio e cobertura | S1c |
| Informação | info views, avisos sobre os prédios | tabela de prédios na GPU (0 chamadas a mais) e marcadores instanciados (1 chamada) | X3a, X3b |
| Noite | cidade acesa | janelas no shader por agenda, mapa de luz da rua, brilho do céu, exposição mínima | R1b, R3a, R4b |
| Obra | canteiro, esqueleto, grua | fases à CS2 por corte no vértice, com início e fim na GPU | R4b |
| Interface | barra, bandeja, painel do selecionado, economia, modo foto | o mesmo, em vidro grafite, feito para os polegares | U1a, U1b, X2, U2a |

Onde queremos passar o CS2: número explícito em todo lugar, lista de problemas com "Próximo", noite legível, e rodar a
30 qps num celular de entrada da linha Mali.

### 1.5 A cara da Holding

- **Premissa de concessão:** a Holding planeja e mantém a cidade e recebe a contribuição dos moradores (regra do dono).
- **Fornecedora da cidade:** cada obra e cada subida de nível compra tijolo, cimento, concreto e vidro. Do marco 3 em
  diante a cidade densa depende disso (D48). Produzir bem é crescer rápido e barato.
- **A Arcologia como promessa:** o plano escolhido aparece no terreno no primeiro minuto como fantasma, com a silhueta
  real de cada parte; cada etapa concluída é um voo de câmera, luzes acendendo e um efeito que a cidade sente (D49).
- **Identidade:** monograma "H" champanhe, cor da marca escolhida na nova partida (bandeiras, helicóptero, prédios da
  Holding), conselheiros com nome (Íris, Tomé, Nara, Caio, Dona Cida e a diretora financeira Lívia Andrade).
- **Brasil de verdade:** modernismo tropical (pilotis, cobogó, brise, pastilha), pedra portuguesa na orla, ipês,
  palmeiras-imperiais, oitis e Mata Atlântica nos morros; terra roxa e capim seco; frota de carros brasileira.

### 1.6 O que não volta (medido nas capturas do jogo atual)

- Grama e telhados verde-lima em toda parte (24% a 30% do quadro); saturação média de 0,44 a 0,50.
- A Torre "bolo de noiva" de anéis empilhados, e qualquer torre de blocos empilhados separados por faixas escuras.
- A composição do Trevo: anel em volta do lago, 4 tambores, 4 folhas em gota e eixo simétrico; fitas curvas iguais e
  robóticas; piscinas azul-ciano.
- Escala de maquete: mesa, luz de foto, tilt-shift, prédios pequenos e soltos em quadras escuras.
- Bairros como retângulos com lotes quadrados em grade; ruas que nascem do desmate; caixas no lugar de prédios.
- Mecânica BuildIt: cronômetros em relógio real, balões de coleta, pedidos em cartões, níveis pagos prédio a prédio.

### 1.7 O que volta e quando

| Do jogo atual | No jogo novo |
|---|---|
| helicóptero da Holding pousando na Torre | M1a, efeito de `torre.e4` (D61) |
| iates e cruzeiro na baía, jatinhos no céu, carros esportivos | M1b, só visual (R6) |
| helicópteros entre helipontos | M2 |
| aeroporto com aviões e jatinhos; porto com cargueiro e contêineres | M3 (a marina com iates já no M1b) |
| Sede, Torres do Conselho, Anel, Biblioteca, Vida | M2 e M3, pelo plano escolhido; no M1 são fantasmas com a silhueta real |
| cores dos prédios, nome e cor da Holding | M1a |
| compra de tempo | M1a, só nas linhas da Holding (pergunta 5) |
| rendimento com o jogo fechado | sai (pergunta 1) |
| a partida atual (capítulo 6) | não passa para o jogo novo; fica jogável em `jogo-antigo/` (pergunta 10) |

---

## 2. Decisões técnicas fechadas

### 2.1 Conflitos e dúvidas resolvidos

Cada linha fecha um conflito entre as partes ou uma dúvida levantada. "Dono" marca o que ele confirma numa prévia; o
padrão já adotado não trava nada, salvo o plano diretor (D59), que é a decisão do portão 1.

| # | Tema | Decisão | Razão |
|---|---|---|---|
| D1 | Nome | O jogo continua **Arcologia de Held**; a cidade é **Heldópolis**. Carga: "ARCOLOGIA DE HELD" e, embaixo, "Heldópolis". (Dono) | continuidade com o que ele instalou; a cidade é o palco |
| D2 | Escala | 1 unidade = 1 m; y para cima; x para leste; norte em −z; origem no centro da área jogável | todas as partes propuseram o mesmo |
| D3 | Mapa (área inicial revista pela D90: 6 x 5) | 8.192 x 8.192 m em 16 x 16 ladrilhos de 512 m; **começa com 4 x 4** (ladrilhos 6 a 9 nos dois eixos), **inteiro numa margem do Rio Held** (D53). O calcário, parte da várzea de argila e a orla nobre ficam em ladrilhos vizinhos, fora do 4 x 4. Preço do ladrilho: 40.000 x (1 + 0,15 x ladrilhos comprados pelo jogador) x (1 − 0,2 x Influência / 100); os 16 iniciais não contam (o primeiro custa 40 mil). Moldura visual de 32 km só do render | a gleba, a Vila, a lagoa e a rodovia pedem ~1 km²; como a área inicial comporta mais que a meta do M1, o que dá peso às licenças são os recursos e a orla, não o espaço |
| D4 | Alturas | grade de 1025 x 1025 amostras a 8 m (Float32), dona: simulação. **Uma leitura só:** `alturaEm(x, z)` bilinear em `fonte/comum/altura.js`, usada pela simulação, pela `R.raio` e pela varredura das vias, e reproduzida igual no GLSL do terreno. Detalhe fino só na normal do shader | 4 m custava 3,5 vezes mais tempo e 4 vezes mais memória; o bicúbico ultrapassa as amostras nos degraus do aplainamento e fura a calçada; três interpolações davam três chãos |
| D5 | Aplainamento | **Entra no M1.** `aplainar(base, formas, retangulo)` é **pura e comutativa**: cada amostra do retângulo sujo sai da grade base (a da semente) e de todas as formas que a tocam (vias, plataformas dos lotes e cavas da Arcologia, registradas em `sim.formas`). Dentro do núcleo de uma forma vale a cota dela, 0,15 m abaixo da pista (empate: menor distância, depois tipo, depois `ref`); depois de uma faixa plana de 8 m além da calçada, a forma mais próxima puxa a base por `smoothstep` em 16 m. Demolir recalcula o retângulo. A grade final não vai no save. Terraplanagem livre no M4 | a escrita incremental dependia da ordem das obras e mudava a grade depois de carregar |
| D6 | Floresta | Densidade em 1024 x 1024 células de 8 m (Uint8), dona: simulação (recurso e desmate automático sob vias e lotes). Árvores de rua e de lote: render, pela semente | a mata é recurso (madeira, Legado) e visual (copa no terreno) |
| D7 | Tempo | tique = 1 s de jogo; mês = 600 tiques = **um ciclo de dia e noite**; ano = 7.200 (12 meses); **hora de jogo = 3.600 tiques = 1 h real em 1x**. O período interno de 20 tiques se chama `rodada` no código e nunca aparece na interface. Velocidades **pausa, 1x, 2x e 4x** (0, 1, 2 e 4 tiques por segundo real) | 4x é o padrão de jogo de cidade e a simulação mediu o orçamento para 4x |
| D8 | "Por hora" das regras | renda, janela do Depósito e ano do empréstimo correm na hora de jogo. Em 1x os números e o ritmo são os de hoje. Como se mostra: D42. (Dono confirma) | se a "hora" fosse a do céu (25 s), a renda por ano seria 144 vezes maior |
| D9 | Céu | hora do céu = (7 + 24 x fração do mês) mod 24; dia do ano = (mês − 1 + fração) x 365/12; latitude −23,5°. O sol anda 0,6° por segundo real em 1x e 2,4° em 4x, sem trava. A sombra de perto usa a direção do sol **em degraus de 1,5°** (1° no PC) e a de longe **em degraus de 3°**, com mistura cruzada de dois mapas; o PMREM sai de **8 quadros-chave por ciclo** com mistura (refeitos só quando o brilho da cidade muda 10%); o cubo do céu é assado em **duplo buffer** (6 faces num cubo de trás, que troca quando fica pronto). O custo em regime entra no orçamento (A6). "Sempre dia" nas Configurações | com o mês valendo um dia, "raro" não era raro: as taxas da versão 1 refaziam sombra e céu quase sem parar em 4x |
| D10 | Jogo fechado | **Nada anda com o jogo fechado.** O jogo abre pausado; um toque volta à velocidade salva. (Dono confirma a perda dos 50% por até 12 h de hoje) | o rendimento fechado não é uma das quatro regras; com pausa ele não faz sentido |
| D11 | Tarifa | **Pelo bem-estar médio da cidade** (média dos prédios residenciais ponderada pelos moradores), como hoje, **suavizada em 1 mês de jogo** e **arredondada para o inteiro mais próximo antes da faixa**, como hoje: 30,4 dá 5; 30,5 dá 8; 60,4 dá 8; 60,5 dá 11. A barra mostra a margem até o degrau ("+3 acima de 61"); a prévia de zona mostra o efeito previsto na média; aviso âmbar abaixo de 63. `REGRAS_DONO.renda.tarifaPor = 'cidade'`; `'predio'` fica pronto e testado como proposta (pergunta 3, com o exemplo numérico) | faixas e valores são os do dono; suavizar a medida só tira a oscilação no degrau coletivo |
| D12 | Impostos | nenhum imposto no M1 (moradia, comércio, escritório e indústria) | as regras de receita são as do dono |
| D13 | Compra de tempo | padrão proposto: **só nas linhas da Holding**: 1 min 100, 5 min 500, 10 min 1.000, 30 min 2.500, 60 min 5.000 créditos, em minutos de jogo. Nas etapas da Arcologia só se o dono pedir (pergunta 5). A meta A4 é medida sem comprar tempo; um segundo relatório mostra o ritmo comprando | foi pedido do dono (tarefa 109), mas com 300 mil/h de renda 5 mil pulariam a Torre inteira |
| D14 | Gráficos | **WebGL2** (`WebGLRenderer` do three 0.186.0) do M1 ao M3; todo GLSL próprio num registro de ganchos; bancada A/B com WebGPU no M4 | o gargalo do Mali é pixel e banda, que o WebGPU não barateia; o WebGPU funciona no Chromium de teste, então o A/B será medível |
| D15 | Threads | **simulação na thread principal** no M1 a M3; **dois workers:** `tarefas` (trânsito) e `oficina` (malhas do render). Sem `SharedArrayBuffer`. Tarefas: no tique T a simulação **copia a entrada** (grafo da versão, zonas, P, A e custos da passada anterior), guarda essa cópia até T + K e transfere uma segunda cópia ao worker; o Node calcula em T com a mesma entrada e aplica em T + K. Se o resultado não chegou em T + K, **o tique para** até ele chegar (o painel mostra a velocidade efetiva); se o worker morreu, a thread principal refaz a conta a partir da cópia, em fatias | calcular "na hora" em T + K usava outro estado e divergia do Node justamente quando o worker atrasa |
| D16 | Consultas e comandos na UI | consultas **síncronas** (`sim.q.*` devolve o valor). `ui/acoes.js` trata a resposta de todo comando como **Promise**, mesmo resolvida na hora, e a UI gera o id do comando (`sessao`, `seq`) usado no desfazer e para casar respostas. Se a simulação for para um worker no M4, a UI lê um espelho local por deltas e nenhuma tela muda | consultas com Promise espalhariam `await` por 40 telas; comandos com Promise desde já tiram a única dependência síncrona que o worker quebraria |
| D17 | Comandos | `sim.cmd()` **aplica na hora**, entre dois tiques, e responde de verdade; funciona pausado. O livro guarda `[tique, seq, nome, args]`; a reprodução aplica antes do tique `tique` | aplicar entre tiques é determinístico e anda com pausa |
| D18 | Encaixe da via | um lugar só: `planejar()` da simulação (nó, aresta, 90° e 45°, prolongamento, distância de quadra, passos de 15°, comprimento múltiplo de 8 m). A UI converte pixels em metros e cuida de gestos, alças, mira, lupa, vibração e chips | dois encaixes dariam prévia diferente do que se constrói |
| D19 | Índices | `idx` = vaga da tabela (denso, estável enquanto vivo, reaproveitado só depois de liberado); `ref = idx + ger x 2²⁰`. Cada tabela expõe `n` (maior índice em uso mais 1). Crescer por dobra troca os arrays e marca `realocado` no diário; **nenhuma parcela guarda referência a coluna entre quadros**. Tetos no M1: prédios 262.144 (tabela 512² na GPU), arestas e nós 65.536, células 524.288 | o render indexa texturas por `idx`; `ger` pega a troca de dono da vaga; a dobra deixava arrays velhos vivos no render |
| D20 | Plano do prédio | capacidade (lares, moradores, empregos) sai do catálogo da simulação por modelo e nível; o catálogo traz a faixa de andares por nível; o render escolhe a forma dentro dela pela semente | desacopla as partes |
| D21 | Ponte sim e render | o render lê `sim.espelho` e `sim.mudancas.desde(v)` (seção 2.4) | mesma thread: arrays tipados sem cópia e índices em lote |
| D22 | Tipos de via | `rua` 16 m, `ruaMao` 16 m, `avenida` 24 m, `avenidaG` 32 m; do mapa: `rodovia` 28 m e **`terra` 10 m** (ruas da Vila, sem calçada nem redes, melhoráveis para `rua`). A ponte simples do M1b é atributo da aresta (flag `PONTE`), não tipo. Calçadão no M2 | larguras múltiplas de 8 m: a grade de 112 m entre eixos dá 6 células de cada lado |
| D23 | Zonas | **M1a: 4** (residencial baixa e média, comercial baixa, indústria); **M1b: mais 3** (residencial alta, comercial alta, escritório). Cor por família (residencial `#199e70`, comercial `#3987e5`, indústria `#c98500`); escritório é azul com hachura a 45°; densidade pela borda | a UI mediu: 5 cores juntas não se distinguem (deuteranopia 1,6); 3 passam |
| D24 | Categorias | barra: **Vias, Zonas, Serviços, Lazer** à esquerda; **Demolir, Empresas, Arcologia** à direita. "Transporte" some até o M2. Compra de áreas pelo Progresso, pelo modal do marco e pelo toque longo no terreno | categoria sem item fica fora da barra |
| D25 | Depósito e preço base | aba **Mercado** da tela Holding (sem prédio no mapa); venda a 150% do **preço base**, que é **o preço de catálogo do item, o mesmo da venda à cidade a 100%** (escrito em `REGRAS_DONO`); até 100 por janela de 4 h de jogo (14.400 tiques); caminhão só visual. Importação a 160%, entrega em 40 s de jogo | mesma regra e mesma janela de hoje em 1x; 160% impede arbitragem; o sentido de "preço base" muda em relação ao jogo atual (pergunta 9) |
| D26 | Arcologia no M1 | plano escolhido pelo dono (D59); etapas `lago.e1` (reservatório) e `torre.e1` a `torre.e4`, cada uma com efeito no laço (D49); o resto do plano aparece como **fantasma com a silhueta LOD1 de verdade de cada parte**, em holograma champanhe. Nada da Arcologia se demole. Sede e Torres do Conselho no M2 | o fantasma de caixas repetiria a forma antiga |
| D27 | Torre Lâmina | **Só a Torre fica fechada aqui; o resto é do plano escolhido.** Planta de 36 x 50 m, orientada pelo plano (o lado estreito para a baía); pódio de 16 m com marquise de 12 m em balanço; corpo em **três lâminas verticais** coladas pelo lado comprido: 36 x 26 m até 301 m, 36 x 14 m até 238 m e 36 x 10 m até 163 m, cada uma fechando num terraço-jardim; 65 pavimentos de 4,2 m e 2 andares de vento de 6 m **recuados 2 m, com vidro claro, forro claro iluminado e montantes contínuos** (nunca mais escuros que o corpo); a face lisa, oposta às penas, com **costura vertical de 6 m** em vidro mais escuro e aletas densas do pódio à coroa; aletas de bronze a cada 1,5 m nas faces laterais; coroa-lanterna de 29 m com os últimos 12 m ocos; **heliponto a 330 m** em balanço de 16 m; mastro a 350 m. LOD0: **12 a 20 mil triângulos no Média, 40 a 80 mil no Alta e no Ultra** (montantes, aletas, marquise e heliponto em geometria); LOD1: 3 a 5 mil. Tudo em `data/arcologia-plano.js` | recuos em lâminas inteiras leem na vertical (111 West 57th, One Vanderbilt); blocos empilhados separados por faixas escuras liam como bolo; a câmera livre vê as quatro faces; a peça-assinatura cabia em 0,2% do orçamento do Ultra |
| D28 | Marcadores e rótulos | avisos sobre os prédios **no WebGL** (instanciados, com oclusão, 1 chamada, atlas de glifos feito pela UI); rótulos, cotas, lupa e painéis **no DOM** | render e UI concordam |
| D29 | Camadas do M1 | **13**: M1a com 6 (Zonas, Bem-estar, Água, Energia, Serviços, Recursos); M1b com mais 7 (Valor do terreno, Esgoto, Trânsito, Poluição do ar, Ruído, Nível, Empregos). Holding e Obras no M2 | o mecanismo é um só (por prédio, por aresta, por grade); a versão 1 dizia 12 e listava 13 |
| D30 | Interface | Preact 10.29.8, `@preact/signals` 2.11.2, `@fontsource-variable/inter` 5.3.0, versões fixas; JSX pelo esbuild | medido pela UI: 8,1 KB com gzip |
| D31 | Save | binário, gzip, versionado, no IndexedDB `heldopolis`: 3 automáticos em rodízio e 8 manuais; exportar e importar `.held`. Automático a cada 5 min de relógio real se algo mudou e ao ir para segundo plano (**sem gzip** no segundo plano, para terminar antes de o Android congelar a aba). **Diário síncrono** no `localStorage` (`heldopolis.diario`): id do último save, tique atual (gravado a cada segundo), comandos do livro desde esse save e o carimbo da página (id da sessão e tique). Carregar = último save mais a reprodução do diário até o tique gravado; o carimbo refaz a trava "outra página gravou". Câmera e velocidade vão no save; qualidade e preferências em `heldopolis.prefs` | IndexedDB e compressão são assíncronos e o Android mata a aba no meio; a simulação determinística deixa o diário pequeno |
| D32 | Desfazer | até 10 ações da sessão da ferramenta, com reembolso integral enquanto a ferramenta estiver aberta e nenhum prédio tiver nascido nas células criadas; fora disso, demolição devolve 50% | junta a regra da simulação com as 10 ações da UI |
| D33 | Perfil do Poco X7 | **Média** pela regra `Mali-G6xx MC2`, medido pelo dono na Prévia 0 (sonda e cena de estresse) e confirmado pelo Teste de desempenho antes do M1a | as três partes concordam; o jogo atual escolhe Alta por uma regex larga |
| D34 | Holding | nome (padrão "Held") e cor (6 opções) na nova partida; a cor vai para bandeiras, helicóptero e prédios da Holding | barato |
| D35 | Narrativa do M1 | Ato 1 "A Concessão": **3 decisões no M1a** (`vila.agua` no marco 0 e mais duas) e **6 no M1b**; conselheiros Íris, Tomé, Nara, Caio, Dona Cida e **Lívia Andrade** (diretora financeira); rivais só como nota no Mural; marcos com os nomes da simulação (Canteiro a Polo Regional) | a UI trazia a diretora na primeira hora; os rivais são do M3 |
| D36 | Sugestões da primeira hora | vêm do mapa: `mapa-heldopolis.js` traz a primeira avenida, as primeiras quadras, os lugares da captação e da usina, o nó de entrada da energia e as áreas nomeadas (D55); `q.sugestoes()` | dado autoral, determinístico e testável |
| D37 | Trânsito | **núcleo do M1b, fora da linha de corte**: atribuição agregada no worker a cada 60 tiques, com efeitos: (1) a produtividade dos locais de trabalho, inclusive das linhas da Holding, cai com o tempo médio de trajeto; (2) os clientes do comércio caem com o tempo de viagem; (3) a cobertura de bombeiros e saúde usa o tempo congestionado da aresta; (4) até −8 no bem-estar. O aviso "trânsito parado" aponta a aresta e sugere melhorar, mão única ou via paralela. No M1a o render usa a heurística por tipo de via, hora e zonas vizinhas | sem efeito, mão única, avenida grande e "melhorar" seriam só estética |
| D38 | Onde vive o jogo novo durante o M1 | fonte em `fonte/`; o jogo atual vai para `antigo/` (só consulta); a montagem vai para **`previa/`**, **feita só pelo integrador** nas prévias 0, 1 e 2 (M1a) e por C2 na publicação; as parcelas commitam só a fonte. **Cada app tem prefixo próprio no cache** (`heldopolis-previa-<carimbo>`, `heldopolis-app-<carimbo>`) e o `activate` apaga só o seu prefixo. Na publicação do M1 a montagem nova passa para `app/` e `arcologia-de-held.html`; a montagem congelada do jogo atual vai para **`jogo-antigo/`**, com o `sw.js` dela trocado para apagar só caches `held-`; `antigo/` e `previa/` saem | o dono segue com o jogo atual; a Cache Storage é por origem, e o `sw.js` de hoje apagaria o cache do outro app |
| D39 | Variantes de prédio | ilimitadas pela semente; teto de triângulos por prédio e por LOD e de tempo: setor de 256 m com ~150 prédios em até 30 ms no PC e 100 ms no Poco X7, no worker. **Prédio que nasce, sobe de nível ou muda entra no anexo do setor** (malha pequena por material, refeita no worker em poucos ms); o setor é refundido depois de 5 s sem mudança, juntando as mudanças. **Atributos quantizados** (posição Int16 normalizada relativa ao setor, normal octaédrica em 2 x Int8, u e v em Half, `aId` Uint32, AO Uint8) e cópia JS solta depois do envio (`onUpload`); **teto de memória de geometria** por perfil (Média 64 MB, Ultra 400 MB); cache de 12 a 16 setores no Média | refazer o setor inteiro a cada nascimento enchia a fila em 4x; 36 setores em Float32 davam 150 a 300 MB |
| D40 | Entrada | o render é dono do árbitro de gestos; aceita os acréscimos da UI (`R.entrada.modo`, `aoFerramenta`, deslocamento da mira, rolagem pela borda, marcadores primeiro em `selecionar`, `R.estado`) | contrato fechado na seção 2.7 |
| D41 | Caixa | **O caixa nunca fica abaixo de 0.** Cada tique soma as receitas e paga, nesta ordem: manutenção de vias e serviços, salários da Holding, importação para a cidade (D48). O que não dá para pagar não vira dívida: os serviços trabalham com a eficiência na fração paga; linhas da Holding e etapas da Arcologia param; obras da cidade que dependem de importação da Holding esperam; o resto da cidade segue e a contribuição dos moradores continua entrando. Aviso grave "Caixa zerado" com "Tomar empréstimo", "Vender no Depósito" e "Ver orçamento". **Dívida = só os contratos do empréstimo** | caixa negativo seria um segundo crédito sem juros, fora da regra do dono; parar só a Holding evita a espiral |
| D42 | Unidades na interface | taxas só em **"/h" = por hora de jogo**, com a dica fixa "hora de jogo: 1 h real em 1x, 6 meses do calendário"; **a hora do céu nunca aparece em número** (glifo de sol ou lua e a fase: manhã, tarde, fim de tarde, noite; o modo foto usa a fase); **a palavra "dia" some da interface**; população em "/h"; durações de catálogo em "min de jogo" e contagens regressivas em "mm:ss" reais na velocidade atual (pausado: o valor em 1x com o glifo de pausa); calendário "Mês 3 · Ano 2" (o ano rege o empréstimo); a receita dos moradores se chama **Contribuição**, nunca "Aluguel". Abandono: aviso âmbar aos 3 min de jogo, vermelho aos 6, abandono aos 10 | três "horas" e dois "dias" na mesma tela davam um erro de 144 vezes na leitura da renda |
| D43 | Sombra de perto | **própria, em todos os perfis:** uma cena só de projetores (`InstancedMesh` que compartilham a geometria e os buffers de instância do LOD1, as árvores de perto e a Arcologia), desenhada com `renderer.render(cenaSombra, camOrto)` num alvo com `DepthTexture`. Média: 1 cascata de 1024; Alta e Ultra: 2 cascatas num atlas. O gancho `sombra` lê esse mapa e multiplica a luz do sol no `MeshStandardMaterial`; o `shadowMap` do three fica desligado e o `SunLight` sai (fica uma `DirectionalLight` sem sombra). `callsSombra` e `trisSombra` contados à parte. Prova na F0 (cena `prova-sombra`) | o three filtra o passe de sombra pela câmera da vista (conferido); com camadas, o LOD1 ou some da sombra ou aparece na imagem |
| D44 | Guarda do Mali | a bancada confere cada programa compilado contra um perfil com folha sobre os mínimos do WebGL2 e **falha acima de 12 amostradores por estágio e 12 varyings** (contados no GLSL final), 200 vetores de uniforme no fragmento e 14 atributos; `precision highp` em todo gancho e **nenhum `mediump`** nos shaders próprios (teste de texto); a sonda mede o tempo de compilação de cada programa | um programa acima do limite compila no SwiftShader e só falha no link no celular do dono |
| D45 | Registros no lugar de arquivos compartilhados | `registrarTextura(nome, gerador)` com cada gerador no arquivo da sua parcela; `oficina.worker.js` da F0 como despachante, com `registrarGeradorOficina(tipo, modulo)`; `registrarSelecionavel(dominio, fn)` para a seleção; `sim.formas.registrar(forma)` para o aplainar; `alturaEm` em `fonte/comum/` | texturas, oficina, raio e seleção eram arquivos de uma parcela usados por quatro |
| D46 | Materiais | A/B na Prévia 0: procedural contra 6 a 8 materiais fotográficos CC0 (ambientCG ou Poly Haven: asfalto, concreto, grama tropical, terra roxa, granito, areia, telha) a 1K em KTX2 (`KTX2Loader` do three), de 5 a 8 MB guardados pelo `sw.js`. A fachada continua no shader, com mapa de detalhe fotográfico. Fica o que o dono aprovar e o Poco X7 aguentar. O HTML único usa sempre o procedural. Licenças em `arte/LICENCAS.md` | repetição procedural é fonte conhecida do ar robótico, e o shader procedural é o caminho mais caro em linhas |
| D47 | Frota e entregas | o teto da frota vale **só para as entregas da Arcologia** (armazém para o canteiro). Da linha ao armazém não há viagem: a produtividade cai com a distância ao armazém (Concreteira: −1% a cada 100 m além de 500 m, até −30%; calibrar). A venda à cidade debita o estoque na hora. Os caminhões dessas duas são amostras visuais fora do teto, como o do Depósito. Um caminhão leva até 10 unidades; a unidade é a de catálogo, não "uma carga". A viagem dura o tempo da rota na velocidade real do caminhão com o congestionamento atual (2 km dão ~160 tiques); os prazos das etapas (5 a 15 min) absorvem de 1 a 3 viagens. Frota: 6 no começo, +6 com `torre.e2`, +6 por nível de armazém. O robô relata a fila e o atraso médio por etapa | 6 caminhões para a cidade inteira davam 1 entrega por minuto contra 10 pedidas; a cidade que espera o caminhão cresceria mais devagar comprando da Holding |
| D48 | Cidade e Holding | até o marco 2, a obra da cidade compra do estoque da Holding a 100% se houver e, se não houver, importa por conta própria (sem receita e sem atraso). **Do marco 3 em diante, obras de nível 3 a 5 compram só da Holding os itens da cadeia dela no M1a** (brita, areia, argila, tijolo e concreto; os outros a obra importa sozinha, D92): sem estoque, a Holding importa a 160% pelo próprio caixa e vende a 100% (a perda aparece em Economia como "Importação para a cidade"), com a opção "Abastecer a cidade por importação", ligada por padrão; desligada ou com o caixa zerado, a obra espera, com o aviso "obras paradas por falta de concreto" na barra e na camada Recursos. Níveis 1 e 2 seguem importando sozinhos. A tela Holding mostra a demanda da cidade por item e por hora | no desenho anterior a cidade nunca dependia da Holding e a produção virava renda lateral |
| D49 | Etapas da Arcologia | cada etapa devolve algo que o laço usa. `lago.e1`: reservatório e captação (água para 6 mil moradores), portões e vias internas. `torre.e1`: uma licença de ladrilho. `torre.e2`: sede operacional (+15% de produtividade nas linhas da Holding, +6 caminhões e 1.200 vagas da cidade nos níveis 2 e 3, sem salário pago pela Holding). `torre.e3`: 400 moradores de luxo e +20 de demanda residencial média num raio de 1,5 km (no M1b também alta e escritório). `torre.e4`: atratividade, valor do terreno num raio de 1,5 km, Legado +5 e o helicóptero. **O marco 7 pede `torre.e4` pronta**; a inauguração fecha o Ato 1 | pelo dinheiro, o melhor era adiar a Torre e fechar o M1 sem a obra que dá nome ao jogo |
| D50 | Bem-estar | base **40**; saúde +8, educação +6, segurança +6, bombeiros +4 (cobertura x eficiência); lazer (praça, parque) **até +6**; comércio a até 500 m até +4; sem água −25, sem energia −25, sem esgoto −15 (M1b); ar até −15 e ruído até −10 (M1b); desemprego x −15; tempo de viagem até −8 (M1b); Holding −10 a +10. Teste: água, energia, praça e comércio dão 60 ou menos; com saúde e educação passa de 61 | com base 50 e praça +10 a tarifa de 11 saía sem saúde, educação nem segurança |
| D51 | XP e marcos | +1 por morador acima do recorde; bem-estar **por mês**: moradores x (bem-estar − 50) / 2.000; ativo como no desenho. Limiares de partida: 0, 400, 1.500, 3.500, 8.000, 15.000, 25.000 e **38.000 com `torre.e4`** (marco 7 perto de 30 mil moradores). O robô calibra os limiares de XP, não os preços. Teste: 20 mil moradores a 65 por 1 h dão de 600 a 1.200 de XP de bem-estar | com o termo diário e o limiar de 21 mil, o marco 7 chegava com 12 a 15 mil moradores em 3 a 4 h |
| D52 | Água da Vila e ligação externa | a rodovia traz **só energia** (até 5 MW, a preço por hora) pelo **nó de entrada** do mapa, e só chega a quem está ligado a ele por via com calçada; não há água externa. A rua principal da Vila é `rua`; as outras são `terra` e "melhorar" as põe na rede. A decisão `vila.agua` dispara no marco 0, antes do objetivo da água: captação no rio acima da Vila (25 mil, pronta em 1 min, água para uns 5 mil moradores; Legado +5) ou o reservatório `lago.e1` (20 mil desde a D92, 5 min, água para uns 6 mil e os portões; Influência +5); as capacidades da captação e do reservatório são recalibradas pelo robô para bater com isso | a água externa "servia a Vila" que começava sem água, por uma rodovia sem calçada; a decisão pedia uma prioridade que a rede não sabe representar |
| D53 | Rio e ponte | a área inicial de 4 x 4 fica **inteira numa margem** do Rio Held, com o rio de borda (teste no `mapa.mjs`: um componente só de terra firme). A **ponte simples** entra no núcleo do M1b (X4, simulação e render juntos): traçar sobre água faz a ponte, reta ou em curva suave, tabuleiro na cota das pontas, pilares instanciados, vão até 200 m, custo por metro 3 vezes o da via | no M1a o jogador não bate num rio sem saída; no M1b o gesto do gênero chega inteiro |
| D54 | Demolir | demolir prédio da cidade custa no mínimo o valor dos materiais do nível dele a 100% do preço base | demolir barato e revender material virava fábrica de dinheiro |
| D55 | Influência, Legado e áreas | `mapa-heldopolis.js` traz **áreas nomeadas** (Vila, orla, gleba, várzea, morros), usadas pelas decisões e base dos distritos do M2. Influência (0 a 100) baixa o preço do ladrilho em até 20%; Legado (0 a 100) soma até +5 de atratividade. A tela Holding mostra os dois com o efeito escrito | o formato de decisão usava uma área que não existia e os medidores não tinham uso |
| D56 | Modo livre (M1b) | opção da nova partida: sem limite de créditos, tudo liberado, sem recordes. Bandeira em `partida.modo`, **fora de `REGRAS_DONO`**; os testes das regras rodam no modo normal; o save marca o modo e ele não volta ao normal | vale muito para quem joga sozinho e gosta de construir; custa uma bandeira |
| D57 | Lote | linha nova começa em **10 com Auto**; a folha sugere lote menor só quando ajuda (insumo curto, etapa esperando poucas unidades). "Ajustar lote" sai do laço de cada minuto | a regra do dono fica; 10 com Auto domina e não sustenta decisão frequente |
| D58 | Objetivos | **3 abertos por vez** (um da cidade, um da Holding, um da Arcologia), tirados do estado: "Leve a Torre à etapa 2: faltam 40 concreto", "Cubra a Orla com escola", "Mais 1.800 moradores para o marco 5". Ao carregar, "Onde você parou" com o objetivo e o problema mais grave | depois da primeira hora a sessão do celular ficava sem meta |
| D59 | Plano diretor da Arcologia | **o Trevo sai.** Na Prévia 0, X1a mostra três planos em escala real, assimétricos e assentados no relevo do platô entre a lagoa e a baía, como maquete de massas com as silhuetas LOD1: **A "Baía"** (Marina Bay com Gardens by the Bay e Marina Barrage), **B "Parque-canal"** (Songdo Central Park com o pódio de Hudson Yards), **C "Orla"** (Barangaroo com o Aterro do Flamengo). Todos têm a Torre Lâmina, um reservatório (`lago.e1`), Sede com Torres do Conselho, Anel de moradia em anfiteatro, Biblioteca em diamante, Vida (casca tipo Jewel e Supertrees), Escola, Universidade e Física. O dono escolhe no portão 1; o integrador grava a gleba, os portões e as vias internas do escolhido em `arcologia-plano.js` antes da onda 2 | o Trevo era a composição da foto que o dono deixou abandonar; o motivo de mantê-lo (saves e ids) não vale num jogo do zero |
| D60 | Prédios colocáveis | todo serviço e todo prédio da Holding tem modelo próprio (R5) com referência real, LOD0, LOD1 e teto de triângulos, fundido no setor como os prédios da cidade. Cena `servicos` no aceite | o dono pediu megaprojetos reais para cada tipo de construção, e são os prédios que o jogador mais coloca |
| D61 | Vida de luxo | só visual, sem simulação: helicóptero da Holding pousando na Torre (M1a, com `torre.e4`); iates e um cruzeiro na baía, jatinhos no céu e esportivos na frota de carros (M1b, de 3 a 6 chamadas instanciadas) | é o que dá o ar de alto luxo que o dono pediu e já tinha |
| D62 | M1 em duas partes | **M1a** jogável (vias, 4 zonas, 8 serviços, água e energia, Holding com 4 prédios de produção, regras do dono, Arcologia até a Torre pronta, 6 camadas) e **M1b** (trânsito, esgoto, poluição e ruído, 3 zonas e 6 serviços a mais, 7 camadas a mais, Ato 1 completo, cimento, vida de luxo, ponte, Modo livre). Portões do dono depois da Prévia 0 (visual) e da Prévia 1 (via no polegar). O M1a sai em `previa/`; o M1 inteiro, em `app/` | o M1 inteiro era um cheque em branco de 3 a 4 vezes o jogo atual antes de o dono ver qualquer coisa |
| D63 | Sede da Holding (plano A v2; substituída pela D88: sede v3) | pedida pelo dono em 28/09/2026, depois da Prévia 1: **anel fechado como a Apple Park** (481 m por fora, 358 m por dentro, 61 m de fundo, 4 andares, 30 m) com um pórtico em cada eixo; no pátio, parque e um **lago central com fontes dançantes e uma cachoeira artificial em ciclo contínuo** (a água cai do vão entre as torres gêmeas, de 45 m, e volta por dentro delas); eixo norte-sul do portão até a praia e eixo leste-oeste da cúpula até a Biblioteca; Universidade, Escola e Física nos raios de 45 graus; moradia em arcos fora do anel viário. Planta, elevação e referências em `docs/pesquisa/sede/` | a sede anterior lia como prédios soltos, um ao lado do outro; uma figura só e dois eixos resolvem (Apple Park, McLaren, Burj Khalifa, aeroporto de Daxing) |
| D64 | Torres gêmeas (revista pela D88: as torres ficam no pódio central, desenho em diálogo) | **Torre Lâmina com 500 m** e uma **irmã de 452 m** lado a lado, **quase encostadas** (fenda de 10 m no eixo norte-sul), numa ilha no centro do lago; a cachoeira cai de uma ponte a 45 m dentro da fenda num poço que transborda para o lago, e a água volta por dentro das torres (ciclo contínuo). As três lâminas da D27 com os recuos nas mesmas proporções (49%, 70% e 91% da altura), espelhadas nas duas torres; planta de 36 x 50 m cada; heliponto no topo da maior. Substitui a altura da D27 (330 m) | pedido do dono ("uma do lado da outra, quase encostando"); as Petronas como referência do par, a fenda lê as duas como uma peça só |
| D65 | Cúpula de vidro (substituída pela D69: três esferas) | a Vida vira uma **cúpula de vidro de 240 m de diâmetro e 80 m de altura** em malha diagonal, com floresta em terraços por dentro, na ponta oeste do eixo leste-oeste; as Supertrees em bosque ao sul dela, como nos Gardens by the Bay | pedido do dono, "imponente e magnífica"; Jewel Changi e Eden Project |
| D66 | PC primeiro | por enquanto o jogo é **só para o PC do dono**: Intel Core i3-9100F (4 núcleos), AMD Radeon RX 550 com 4 GB, 16 GB de RAM, SSD com 64 GB livres, Chrome ou Edge no Windows com escala de 150% (a tela é 1080p nativa). **Medido em 28/09/2026** (`docs/pesquisa/pc-dono/`): vista aberta em 1080p com MSAA 4x a 27 qps, com a placa em 32 ms por quadro (o custo é de pixel, não de triângulo); estresse com 894 mil triângulos a 53 qps (16 ms); um soluço de 166 ms por recompilar o vidro da Arcologia. Perfil de referência **PC do dono**: 1080p, alvo de 60 qps e piso de 30, com MSAA 2x, resolução dinâmica pelo cronômetro da placa (de 70% a 100% da nativa, com nitidez CAS) e todos os programas compilados na carga. Tetos: 800 chamadas e 2,5 milhões de triângulos na vista aberta com a cidade grande; memória de vídeo até 2,5 GB; download até 1 GB (teto do GitHub Pages por site). O celular (Poco X7, perfil Média) volta depois, e os tetos do Média continuam no código para não fechar essa porta **Medido de novo em 29/09/2026** com o perfil `pc` (escolhido sozinho): monitor 4K, desenho interno de 2070 x 1001 ampliado, nenhuma compilação depois de pronto, pior quadro de 50 ms; vista aberta a 26 qps com a placa em 35 ms, divididos em céu 5, terreno 13 e prédios 14 ms; estresse a 60 qps. A próxima frente (PC2) corta o custo por pixel desses três passes | pedido do dono: ver o potencial máximo estável no PC que ele tem |
| D67 | História em três partes | o jogo conta uma história com início, meio e fim: **parte 1** (2005 a 2019, o fundador sai de um laboratório de buscas aos 25 anos e cria a Holding; capítulos anuais, sem cidade, 4 a 7 h), **parte 2** (jan 2020 a jun 2026, a sede e uma parte da cidade nascem; é o que construímos agora, 12 a 16 h) e **parte 3** (jun 2026 a 2040, em paralelo: a cidade cresce a 500 mil moradores e 10 milhões de turistas por mês até jun 2032, e a Holding se espalha pelo mundo; 22 a 30 h). Projeto da cidade (US$ 500 a 900 bilhões, em tranches): a Holding, a Federação de Nova Libertas (os EUA do jogo, sem ações) e cinco fundos (Qasr al-Noor, Rimal, Singara, Jinhai e Hoshimura). **Dono da Holding em jun 2026** (privada, valuation de US$ 5,53 trilhões, lucro líquido de 2025 de US$ 215 bilhões): 20% o criador, Diogo Holanda; 10% em 20 executivos (0,5% cada); 70% em 14 sócios de 5% cada (os 5 fundos e 9 gigantes mundiais). Laboratório de origem: The Axion Evergreen. O calendário da D42 fica (1 h de jogo = 6 meses) e a interface mostra a data ("jan. 2020"); a parte 1 usa um relógio de capítulos. Turistas são fluxo estatístico (uns 1,3 milhão presentes com a cidade pronta). Detalhe em `docs/desenho/historia.md` | pedido do dono (30/09/2026): "tem que ter história como pano de fundo, com início, meio e fim"; a D51 e o marco 7 do M1 deixam de ser o fim da parte 2 |
| D68 | Dólar | as transações usam **dólar americano com valores reais**; as regras do dono mudam de número e mantêm a razão: lotes de 1 a 10 e Depósito a 150% (até 100 por janela) iguais; empréstimo a 10% ao ano com teto de dívida de 10 vezes o limite anual, os valores escalando com o porte da cidade e as tranches; renda por morador nas faixas 5, 8 e 11 com 1 unidade antiga = US$ 600 por hora de jogo (US$ 3.000, 4.800 e 6.600 em 6 meses). `REGRAS_DONO` vira função do porte; os testes A2 são reescritos na S3a e o robô (A4) calibra. Valores de partida, a confirmar | pedido do dono: "usar dólares e valores reais, adaptando minhas regras"; a renda de US$ 500 a 1.100 por mês por morador cai na faixa real de aluguel e tributos |
| D69 | Marcos do complexo | o complexo de lazer, esporte e natureza de Heldópolis tem **14 estruturas**, 13 em três áreas (Vida a oeste, Sede no centro, Jogo a leste) e uma reserva à parte: **santuário de 3 esferas de vidro** (160, 124 e 88 m de diâmetro sobre pedestais de 20, 16 e 12 m, alturas totais de 180, 140 e 100 m; floresta tropical, savana e oceano; vidro unidirecional e isolamento acústico, os animais não veem nem ouvem o lado de fora) que **substituem a cúpula da D65**; **circuito de F1** de 5 a 7 km, 60% de pista permanente e 40% de avenidas fechadas no GP, passando entre as esferas e por um **túnel de vidro acústico sob o pedestal da maior**; arenas de **35 mil** (basquete), **120 mil** (futebol americano e futebol, campo retrátil), **270 mil** (shows, bacia escavada no morro), **20 mil** (tênis e tênis de mesa), **50 mil** (jogos virtuais) e **40 mil** (anfiteatro); **Torre Lúculo** de 300 m; **shopping** com mais de 1 milhão de m² e natureza por dentro; **parque** de diversão e aquático; **Reserva da Transformação**, dentro do mapa jogável e longe do circuito e das arenas, de uns 500 ha de terra e 100 ha de baía, para elefantes, rinocerontes, búfalos, orcas e tubarões **ameaçados ou resgatados de maus tratos**, sem espetáculo nem reprodução comercial, operada pela Fundação Held. Dois geradores (arena e esfera) cobrem 9 das 14. Nasce em fases, pelo que mais serve à economia e ao conforto de quem vai morar: fase 1 até jun 2026, fase 2 até 2029, fase 3 até 2032. Ligas e eventos com nome fictício e as regras reais. Estimativa de uns US$ 81 bilhões (12% do projeto). Detalhe em `docs/desenho/marcos.md` | pedido do dono (02/10/2026): "super complexo da Holding guarda-chuva e da cidade", natureza e tecnologia juntas; os animais de grande porte ficam numa reserva externa, só ameaçados ou resgatados |
| D70 | Alvo de qualidade | o jogo é feito para jogar no **PC atual do dono** (D66), nas três partes; os tetos da D66 valem para a versão jogável e **não travam o desenho**: o que o PC atual não aguenta entra em versão simples e fica pronto para o upgrade. Quando o dono trocar de PC, uma frente de upgrade (perfil Ultra, modelos, texturas e detalhe melhores, mais jogabilidade) sobe a qualidade. Os marcos da D69 seguem a mesma regra | pedido do dono (02/10/2026): "não há necessidade de preocupação com a capacidade do PC aguentar" |
| D71 | Fluxo de pessoas | a cidade tem **capacidade de pico de 10 milhões de pessoas por mês em estadia temporária**, de qualquer tipo; o termo geral na interface é **visitante**, em três classes: turista (dorme, uns 4 milhões por mês), visitante de dia (uns 4,5 milhões) e passageiro em trânsito (uns 1,5 milhão), tudo como **fluxo estatístico** (uns 700 mil presentes no pico, uns 240 mil quartos, uns 210 mil trabalhadores do turismo). Trabalhadores de outras cidades (uns 125 mil por dia) chegam por **trem-bala em túneis, como o Shinkansen**, de 4 a 5 corredores, com o primeiro já na fase 1. **Dois aeroportos**: Internacional e Nacional (D73). O transporte de massa vem antes do M4. Detalhe em `docs/desenho/cidade.md` | pedido do dono (02/10/2026): "capacidade de receber pessoas de forma temporária, sejam turistas, visitantes, de passagem rápida"; a conta antiga de 1,3 milhão de presentes caiu para uns 700 mil |
| D72 | Moradia social | dos 500 mil moradores, **100 mil** vivem em habitação social (uns 33 mil lares): **50 mil em extrema pobreza** (classe Acolhimento, uns US$ 1 por mês, Contribuição zero) e **50 mil de baixa renda** (moradia popular, 20% da tarifa normal), que compram ou alugam a preços simbólicos. Misturada aos bairros comuns, com projeto de alta qualidade (Alt-Erlaa, Pinnacle@Duxton, Quinta Monroy) e uma **escada social** (capacitação e emprego no turismo) que sobe o Legado. Subsídio por um Fundo de Moradia. Valores de partida, o robô calibra | pedido do dono (02/10/2026) |
| D73 | Aeroportos e Modo Visita | os dois aeroportos (Internacional **Estrelas do Leste**, de 80 a 100 milhões de passageiros por ano, e Nacional **Flores da Vida**, de 40 a 60 milhões) ficam na **moldura do mapa**, de 10 a 25 km, ligados pelo trem-bala, com **estações dentro do mapa**; o jogador controla capacidade, licenças e terminais, não desenha pistas. Dá para **ver o aeroporto por dentro** no **Modo Visita**, uma cena de interior carregada na hora, com a lotação vinda da simulação. Referências do Internacional: **Beijing Daxing** (plano radial de cinco braços), **Dubai Terminal 3** (escala) e **Jewel Changi** (bosque e cachoeira de 40 m dentro do terminal), com Mata Atlântica e Amazônia. O Modo Visita entra depois do M1a, começando pelos dois aeroportos, e pode se estender ao shopping, às esferas e às arenas. Detalhe em `docs/desenho/cidade.md` | pedido do dono (02/10/2026): opção A, "sendo possível ver o aeroporto por dentro"; dois aeroportos juntos tomariam 30 a 35% do mapa jogável |
| D74 | Economia do visitante | a composição do pico (40% turistas, 45% visitantes de dia, 15% em trânsito) fica; a meta de **rotina sobe para 75 a 85% do pico** (de 7,5 a 8,5 milhões por mês), com **100% só em datas específicas** (Réveillon, Carnaval, GP de F1, finais, festival de shows de 270 mil, férias). A cidade precisa de lugares que façam o visitante **gastar muito** (de partida: turista US$ 2.400 por estadia, visitante de dia US$ 150, em trânsito US$ 60; uns US$ 100 a 125 bilhões por ano), com motores de gasto em hospedagem, compras, alta gastronomia, eventos, parque, saúde e negócios, e uma **agenda de eventos** (uns 40 milhões de ingressos por ano) que enche os vales. Sem cassino. Entram centro de convenções, marina e porto de cruzeiros, turismo de saúde, o resort Marés de Ouro e o Cinema Cosmos (D75) | pedido do dono (02/10/2026): "movimentarem a economia" e "fluxo o mais perto possível dos 10 milhões de forma rotineira, atingindo o teto em datas específicas" |
| D75 | Ampliações do complexo e preço dinâmico | entram mais **5 estruturas** (o complexo passa a ter 19): o **resort Marés de Ouro** (super resort de luxo, uns 6 mil quartos em três torres com SkyPark e laguna, com **ingressos e diárias promocionais agressivos nos dias de menor movimento**, para o público que não é ultra rico também ir), o **Cinema Cosmos** (fechado, uns 220 m de diâmetro, **50 mil lugares**, com o teto como extensão do telão, maior e mais tecnológico que o Sphere de Las Vegas), o **centro de convenções e feiras**, a **marina de iates e o porto de cruzeiros** e o **hospital de turismo de saúde**. **Preço dinâmico**: hotéis, resort, parque e ingressos variam com a ocupação projetada (até 60% de desconto abaixo de 50% e até 100% de ágio acima de 90%), o que sustenta a rotina de 75 a 85% do pico. Mais uns US$ 29 bilhões (complexo de uns US$ 110 bilhões) e uns 60 agentes no total para o complexo. Detalhe em `docs/desenho/marcos.md` e `docs/desenho/cidade.md` | pedido do dono (02/10/2026) |
| D76 | Mapa e cidade vertical | o mapa jogável **continua com 8,2 km** (D3) e a cidade de **500 mil moradores é verticalizada**, em uns 20 km² (uns 25 mil moradores por km², torres de 30 a 60 andares com verde nos terraços), para caber ao lado do complexo (uns 6 a 7 km²) e da Reserva da Transformação (uns 6 km²). **No PC novo o mapa passa a 12 km** (frente de upgrade da D70). Nomes confirmados: Resort Marés de Ouro e Cinema Cosmos. Detalhe em `docs/desenho/cidade.md` | pedido do dono (02/10/2026): "pode ser" à recomendação; sem a verticalização, complexo, reserva e cidade somariam de 32 a 48 km² dos 67 km² do mapa |
| D77 | País e eventos reais | o país anfitrião de Heldópolis é a **República de Vera Cruz do Leste** (o Brasil do jogo). Os **eventos reais de 2020 a 2026 entram**, com nome fictício e características reais (pandemia, bloqueio de canal e falta de chips, guerra e crise de energia, inflação e juros altos, assistentes de IA, data centers, tarifas), como choques com data marcada, e são o que dá o **BOOM** de crescimento da Holding guarda-chuva e das holdings intermediárias: o grupo **cresce em cada crise** (2008, Crimeia, China x EUA, pandemia) e depois com a IA. A pandemia entra como oportunidade de compra (infraestrutura a preço de banana) e obstáculo de logística, sem cenas de doença. (A ideia de 10 divisões como intermediárias fica suspensa, ver D78.) Detalhe em `docs/desenho/historia.md` | pedido do dono (02/10/2026): "sendo o que dá um BOOM no crescimento da holding guarda-chuva e suas intermediárias"; o pano de fundo é ajustado antes de voltar ao jogo |
| D78 | História do caderno do dono | o dono entregou a história em **4 páginas manuscritas** (`docs/pesquisa/historia-dono/`). **Parte 1 (2005 a 2019):** startup de algoritmo para transações financeiras (rede "Swift", nome fictício a definir), crescimento nas crises de 2008, Crimeia e China x EUA, **3 fintechs sob uma Holding guarda-chuva em 2012**, a IA **Super Cérebro em 2014**, compras silenciosas de terras raras, ouro e direitos de mineração em 2018 e, por holdings intermediárias, infraestrutura (só a infraestrutura, nunca administrando). **Parte 2 (2020 a jun 2026):** sede em obra 24/7 desde jan 2020; **Fundo Gestor de Grandes Players** com 5 fundos soberanos (US$ 50 bilhões cada, 5% cada), 9 gigantes entrando de 2021 a 2025 (3, 2, 2 e 2), 3 fintechs unificadas em 2022, pesquisa de hardware próprio em 2023. **Out 2026 ("hoje"):** privada; criador com 20% e **ações de 10 a 20 votos**; 14 sócios de 5%; 20 executivos com 0,5%; US$ 5,53 trilhões; lucro de US$ 215 bilhões; Fundo com US$ 4,3 trilhões a 40% ao ano; 45 mil funcionários em 3 turnos, 1 mil no subsolo; faculdade (10 mil) e escola (17 mil) grátis; **sem "Reorganização" em 2026**. **Modelo da cidade:** marcas de topo com exclusividade e venda e aluguel de cotas a médias e pequenas. **Regra de trabalho:** cada construção é dialogada com o dono antes de ser feita. **Confirmado no mesmo dia:** pico mensal de 10 milhões, Torre Lúculo de 300 m, **70 mil moradores em jun 2026** e o restante dos funcionários por trem-bala, **faculdade e escola grátis para quem tem alto nível de inteligência, sem pagar estudo nem moradia (moradia gratuita para quem comprova que não tem condições)**, e **4 holdings intermediárias** (fintech de 5 departamentos, terras raras, semicondutores e hardware de IA, infraestrutura física só como dona). Detalhe em `docs/desenho/historia.md` | pedido do dono (02/10/2026): "analise e faça suas perguntas e sugestões" |
| D79 | Fundo Gestor e Conselheiro de Estratégia | os **US$ 4,3 trilhões do Fundo Gestor são dos 14 sócios**; o Fundo administra parte do que eles têm, e o valor veio de aportes mais a média de 40% ao ano (2020 a 2026). **Daqui para a frente a meta é de 5 a 7% ao ano**, pelo tamanho e pela influência no mercado (o Fundo responde por **27% dos US$ 215 bilhões** de lucro do grupo, uns US$ 58 bilhões; as outras áreas dão os 73%). Na parte 3 o Fundo é o motor da expansão (cidade x filiais nas outras metrópoles). O jogo traz um **Conselheiro de Estratégia**, o Super Cérebro, que **sugere como maximizar o lucro com estratégias reais que deram certo**, mostrando o caso e o risco (M3). Fundo soberano tipo Noruega no lugar do japonês; gigantes entram em 2021 (3), 2023 (2), 2024 (2) e 2025 (2) | respostas do dono (02/10/2026) |
| D80 | Santuário Gaia e as duas IAs | **Santuário Gaia**: esferas **Floresta** (180 m), **Savana** (140 m) e **Oceano** (100 m), em **malha diagonal** de aço e vidro, dispostas **em S**, decrescentes, com a pista de F1 serpenteando entre elas e entrando no túnel sob o pedestal da Floresta; visita por galeria no pedestal e passarelas internas, com horários limitados e refúgios sem visita; Oceano na fase 1. **Subsolo da sede:** data center dos projetos secretos (militares, patentes e avanço da IA), com 1 mil pessoas, fechado ao público. **Duas IAs:** o **Super Cérebro** (interna, 2014) e a **multimodal líder de mercado** (pesquisa desde 2017, nome proposto Mosaico). **Held Silício** produz chips, placas de vídeo e memória em 3 destinos (IA interna, IA multimodal e venda); **Held Litos** tem terras raras no país sede e também na Tailândia e em países africanos (só citados, administra-se o que chega). Nomes fictícios da história aprovados. Detalhe em `marcos.md` e `historia.md` | respostas do dono (02/10/2026) |
| D81 | Circuito de F1 | o **Grande Prêmio de Heldópolis**, da **Fórmula Mundial**, em **novembro, à noite**, num circuito de **6,2 km**, cerca de **20 curvas** e reta de 1,2 km, com iluminação de LED, **60% permanente e 40% de avenidas** fechadas no GP; serpenteia entre as três esferas do Santuário Gaia e entra no túnel de vidro acústico sob o pedestal da Floresta; o **Resort Marés de Ouro cruza a pista** com uma ponte-hotel e camarotes sobre os carros. Detalhe em `marcos.md` | respostas do dono (02/10/2026) |
| D82 | Torre Lúculo | torre de **300 m**, **esbelta e torcida**, com **6 anéis giratórios** de restaurantes, uns **12 restaurantes** de alta gastronomia e **1.800 lugares** (Maison Valmonde; reservas pelo Super Cérebro) e um **jardim-observatório** no topo; **à beira do lago**, no eixo entre a Sede e a Estação Central, com praça e espelho d'água, visível da reta dos boxes da F1; fase 1. Detalhe em `marcos.md` | respostas do dono (02/10/2026) |
| D83 | Curva até 2040 e os 20 executivos | **divisão do lucro dos 73%** aprovada: Held Silício com a IA multimodal 30%, Held Capital 20%, Held Litos 12%, Held Pórtico 11% (o Fundo tem 27%). **Curva base** de 6% ao ano: de US$ 215 bilhões de lucro e US$ 5,5 trilhões em 2026 a **US$ 486 bilhões e US$ 12,5 trilhões em 2040** (cenário alto 9%, baixo 3%). **20 executivos** com nome e cargo, incluindo os 6 conselheiros que já existiam. Os dois últimos por delegação do dono. Detalhe em `historia.md` (seções 8 e 9) | respostas do dono (02/10/2026): "a curva e os nomes você sugere" |
| D84 | Arena de basquete | arena de **35 mil** lugares em **bacia oval** com **anel de LED contínuo** na fachada e telhado translúcido, em lâminas verticais de aço e vidro; time da casa **Cometas de Heldópolis**, da Associação Libertense de Basquete, **da Holding guarda-chuva e da Starlight Media**; piso que vira palco de shows e eventos corporativos, **sem gelo**; fase 1. Detalhe em `marcos.md` | respostas do dono (02/10/2026) |
| D85 | Shopping Floresta Cintilante | **grande anel de arcos** sob cobertura de vidro, com **floresta interna**, **4 avenidas temáticas** (Luxo, Tecnologia, Natureza e Família) e **praça central com cachoeira**; fase 1 com uns **250 mil m²**, crescendo por alas até mais de 1 milhão de m² em 2032; **20% de marcas de topo** com exclusividade, **50% de médias** e **30% de pequenas** (cotas de venda e aluguel), mais um **showroom imersivo da Held Silício e do Mosaico**; na área Vida, ao lado da estação do trem-bala e ligado ao Santuário Gaia por um jardim comum. Detalhe em `marcos.md` | respostas do dono (02/10/2026) |
| D86 | Marina Aurum | **enseada curva** na orla com **1.500 vagas** de iate, **píer-boulevard** comercial, clube náutico e **estaleiro de superiates** (Hanbit), ao lado do Resort Marés de Ouro e do heliponto; evento anual, a **Semana Náutica de Heldópolis** (feira de iates), em **março**; marina na fase 1 e porto de cruzeiros na fase 2. Detalhe em `marcos.md`. **A fase 1 do complexo está toda dialogada** (sede, Esfera Oceano, Torre Lúculo, arena de basquete, shopping, marina e avenidas do circuito) | respostas do dono (02/10/2026) |
| D87 | Dinheiro no M1a | a simulação guarda o dinheiro em **unidades de desenho** (o crédito antigo) e a interface mostra em **dólar** pelo fator único `REGRAS_DONO.moeda` = { símbolo US$, fator **600** } (D68: 1 unidade = US$ 600 por morador por hora de jogo na renda). As regras do dono e os testes A2 continuam nas unidades (empréstimo de 50 mil unidades por ano = US$ 30 milhões; dívida até 500 mil = US$ 300 milhões; tarifa 5, 8 e 11 = US$ 3.000, 4.800 e 6.600 por morador por hora de jogo). Os preços de item ficam os do desenho até a C1 calibrar com o robô. Trocar o fator muda só a exibição. As tranches dos sócios e a escala por porte ficam para depois do M1a | decidido pelo integrador ao abrir a onda 3 (02/10/2026), para cumprir a D68 sem refazer o equilíbrio; reversível por uma constante |
| D88 | Sede v3, "Park of Future Dreams" | o modelo 3D do dono (geometria em `docs/pesquisa/sede/sede-v3.md`) **substitui a sede v2 inteira** (D63 e a ilha das torres da D64): **anel externo** de 1,46 km de diâmetro, 60 m de fundo, **160 m e 25 andares**, com a **faculdade e a escola** (salas, refeitórios, quadras, piscinas e dormitórios de descanso); **anel interno** de 0,89 km, 50 m de fundo, **120 m e 19 andares**, com os **escritórios da Holding**; **entre os dois anéis**, as torres da **biblioteca** (300 m), dos **laboratórios** e da **administração** (180 m); no centro, pódio redondo de 40 m com as **torres de 500 e 452 m** ligadas por um SkyPark a 330 m, **duas cachoeiras de 40 m com as fontes dançantes** num lago em anel e um anel de floresta; dentro do anel interno, o parque. **Forma dos anéis: Apple Park e sede da McLaren**, com o vidro curvo, uma marquise branca por andar e a faixa de LED do modelo. **8 avenidas radiais** a cada 45° seguem para a cidade; o anel externo é o limite da sede e o complexo fica fora dele, ao longo das avenidas; o trecho de avenidas da F1 (40%) usa um arco do anel viário em volta do anel externo e o permanente segue em S entre as esferas (D81). **Subsolo:** data centers sob as torres, anel de resfriamento e um **acelerador de partículas** de 660 m de diâmetro a 48 m de profundidade, projeto secreto do Caio Montenegro. **Toda construção tem nome próprio em inglês**; os textos da interface seguem em português. Em diálogo (D78): os nomes, o desenho das torres (as do modelo marcam só a posição), as fases do anel externo e a posição da Torre Lúculo. A X1b espera a parcela SEDE3, que refaz `data/arcologia-plano.js` e `render/arcologia/` | modelo e respostas do dono (02/10/2026) |
| D89 | Sede v3: nomes, torres e fases | aprovados pelo dono: **toda construção com nome em inglês** (tabela em `docs/desenho/marcos.md`, seção 9b; tipos genéricos, times, ligas e eventos ficam como estão). **Torres:** a central de 500 m é a **Blade Tower** (a Torre Lâmina da D27 e da D64, de três lâminas retangulares) e a irmã de 452 m, a **Legacy Tower**, da mesma família, ligadas pela **Dream Bridge** a 330 m, com uma linha de LED nas quinas; a **Codex Tower** (biblioteca, 300 m) é um prisma facetado de vidro escuro (Black Diamond de Copenhague) com um átrio de livros na base (Tianjin Binhai); a **Helix Labs** e a **Compass Tower** (180 m) têm planta oval com as marquises e a faixa de LED dos anéis. **Horizon Ring** (anel externo) em **8 trechos** entre as avenidas: 2 até jun 2026, junto com o **Meridian Ring** (anel interno) e as torres, e os outros 6 até 2032, com mais vagas e centros de pesquisa; no teto, quadras, piscinas e uma pista de corrida de 4,6 km. **Lucullus Tower** (a Torre Lúculo) fora do anel externo, na avenida da Heldópolis Central Station, à beira de um espelho d'água como o lago da McLaren, à vista da reta da F1 no anel viário | respostas do dono (02/10/2026) |
| D90 | Sede no mapa e área inicial | a sede v3 fica **no sul da área inicial, de frente para o mar**, com o centro perto de (150, 190) e o anel viário a uns 795 m dele, sem tocar na lagoa, na praia, na baía nem nos dois morros do norte; a **área inicial passa de 4 x 4 para 6 x 5 ladrilhos** (x de -1.024 a 2.048, z de -1.536 a 1.024, uns 3 x 2,5 km), ganhando a faixa da rodovia ao norte e a planície e a orla da baía a leste, ainda inteira numa margem do rio (D53); as 8 avenidas da sede viram o esqueleto da cidade em volta. Medida e imagem em `docs/pesquisa/sede/sede-v3.md` (seção 5) e `sede-v3-no-mapa.jpg`. Faz a parcela SEDE3, na etapa 2 da onda 3 (com a R5); a etapa 3 fica com R3b, U2a, X1b e X3a | escolha do dono (02/10/2026) entre crescer a área inicial e comprar ladrilhos mais cedo |
| D91 | Teto do JS principal (A1) | sobe de **1,6 MB para 2,3 MB** minificado enquanto o PC é o alvo (D66): no fim da onda 3 o principal tem 2.045 KB (725 KB com gzip), que o PC do dono carrega do SSD em menos de 1 s. Telas, cenas, geradores e textos longos continuam sob demanda. Quando o Poco X7 voltar, a simulação vai para um worker ou sob demanda e o teto volta a ser medido no celular | decidido pelo integrador ao fechar a onda 3 (03/10/2026); reversível por uma constante em `ferramentas/montar.mjs` |
| D92 | Calibração da Arcologia no M1a | a lago.e1 por 60 mil, com a cidade rendendo 4 mil por hora, derrubava o começo. Calibrado com o robô: **os créditos das etapas caíram para um terço** (lago.e1 20 mil, torre.e1 50 mil, e2 100 mil, e3 115 mil, e4 85 mil; XP, materiais, minutos e efeitos iguais; as etapas do M2 ainda sem calibrar) e **a D48 vale só para os itens da cadeia da Holding no M1a** (cimento, vidro, aço e serrada a obra importa sozinha, porque a Holding só os importaria a 160% para vender a 100%). O teste A2 mede **6 sementes**: riqueza maior com a Arcologia em todas, e a média da Contribuição e dos moradores pelo menos 5% maior (medido: 1,11 e 1,12; uma semente só oscila uns 0,2). O "não os preços" da D51 vale para os marcos. As regras do dono não mudam | decidido pelo integrador ao fechar a onda 3 (03/10/2026), com as medidas da C1c em `docs/entregas/onda3/C1c.md` |

### 2.2 Estrutura de dados da simulação

- **Tabelas em colunas (SoA)** com `criarTabela(colunas, cap)`: `n`, `cap`, `viva` (Uint8), `ger` (Uint16), lista de
  livres em ordem determinística, `alocar()`, `liberar(i)`, crescimento por dobra que marca `realocado` no diário
  (D19). Tabelas do M1: `nos`, `arestas`, `blocos`, `celulas`, `predios`, `obras`, `entregas`, `linhas` (produção).
- **Grades:** altura e água (1025², 8 m), floresta (1024², 8 m), recursos (256², 32 m), valor do terreno (256², 32 m),
  ar e ruído (128², 64 m).
- **Grade espacial** de 64 m (128 x 128 baldes) em listas encadeadas em arrays, para arestas, prédios e blocos.
- **JSON** para o que é pequeno: caixa, contratos do empréstimo, estoque, história, objetivos, marcos, Mural, livro.
- **Registro:** toda tabela, grade e seção JSON se registra no núcleo (`registrarTabela`, `registrarGrade`,
  `registrarJson`). O save e o hash percorrem o registro; o teste de ida e volta pega estado esquecido.
- **Determinismo:** nada de `Date.now`, `performance.now` ou `Math.random` em `fonte/sim/` e `fonte/comum/` (o teste
  procura no texto); xoshiro128** com um fluxo por sistema; laços em ordem de índice; tarefas do worker pela D15.
- **Buscas grandes em fatias por trabalho:** cobertura de serviços e racionamento andam com um orçamento fixo de
  **4.000 nós retirados da fila por tique** (nunca por tempo, que quebraria o determinismo entre o Node e o navegador);
  a busca continua no tique seguinte e o resultado entra quando termina. Um serviço novo sozinho atualiza de forma
  incremental (Dijkstra só da nova origem, que só melhora arestas); remoção e mudança de rede refazem o tipo inteiro.
- **Memória alvo:** até 48 MB com 50 mil prédios.

### 2.3 Dados compartilhados (uma fonte só)

| Arquivo | Quem escreve | Quem lê | Conteúdo |
|---|---|---|---|
| `fonte/data/vias.js` | F0 cria, S1b mantém | simulação, render (perfil), UI (catálogo) | tipos, faixas, velocidade, capacidade, custo, manutenção, declive, raio mínimo, marco e **perfil transversal** |
| `fonte/data/predios.js` | F0 cria, S2a mantém | simulação, render (andares, planta), UI | modelos, zona, planta em células, por nível: lares, moradores, empregos por estudo, consumos, materiais, **andares [min, max]**, tipologia |
| `fonte/data/zonas.js` | F0 cria, S2a mantém | todos | ids, família, densidade, cor, textura, marco, parte (M1a ou M1b) |
| `fonte/data/colocaveis.js` | R5 | render, UI (miniatura e ficha) | por tipo de serviço e de prédio da Holding: modelo, referência real, pegada, LOD0, LOD1 e triângulos por perfil |
| `fonte/data/estilos.js` | R4a | render | paletas e tipologias de Heldópolis por zona e nível |
| `fonte/data/arcologia-plano.js` | **F0 cria** (envelope da gleba, planta da Torre da D27, câmera); **o integrador grava o plano escolhido no portão 1** (gleba, portões, vias internas, posição e orientação da Torre); X1a e X1b detalham | simulação (gleba, portões, vias internas, formas do aplainar), render (medidas), `mapa-heldopolis.js` (importa a gleba daqui) | os três planos candidatos, o escolhido, a Torre Lâmina, o ponto de pouso, a câmera da Arcologia |
| `fonte/data/mapa-heldopolis.js` | S1a | simulação, render (moldura), UI (sugestões) | semente, relevo, costa, rio, lagoa, recursos, rodovia com o nó de entrada, Vila, ladrilhos iniciais, **áreas nomeadas**, sugestões; a gleba vem de `arcologia-plano.js` |

Tipos de via do M1 (perfil de fora para dentro, em metros):

| id | Largura | Perfil | Velocidade | Capacidade por faixa | Marco |
|---|---|---|---|---|---|
| `rua` | 16 | calçada 3 · pista 10 (2 faixas de 3,5 e estacionamento de 3 num lado) · calçada 3 | 40 km/h | 700 | 0 |
| `ruaMao` | 16 | igual, 2 faixas no mesmo sentido | 40 | 700 | 2 |
| `avenida` | 24 | calçada 3 · pista 7 · canteiro 4 com palmeiras · pista 7 · calçada 3 | 50 | 800 | 0 |
| `avenidaG` | 32 | calçada 3,5 · pista 10,5 (3 faixas) · canteiro arborizado 4 · pista 10,5 · calçada 3,5 | 60 | 850 | 4 |
| `rodovia` | 28 | talude 3 · acostamento 2,5 · pista 7 · barreira 3 · pista 7 · acostamento 2,5 · talude 3 | 100 | 1.800 | mapa |
| `terra` | 10 | pista de chão batido 10, sem calçada, sem redes | 30 | 400 | mapa (Vila); melhora para `rua` |

Meio-fio de 15 cm dentro da calçada. Custos e manutenção seguem a simulação (calibrar). Grade de ruas: 112 m entre
eixos com `rua`, 120 m com `avenida`, 128 m com `avenidaG`. Canos e cabos correm só em via com calçada.

### 2.4 Espelho e diário (simulação para render e UI)

O render e a UI só leem, e **releem o espelho a cada quadro**: nenhuma parcela guarda referência a uma coluna entre
quadros (D19). Posições em Float64 na simulação; o render converte para relativo ao canto do setor.

**Convenções (escritas em `fonte/contratos/espelho.js`, com invariantes testáveis):**

- Prédio: `x, z` é o **centro da planta**; `w` é a **frente** (ao longo da via) e `d` o fundo, em metros; `rot` é a
  rotação em torno de +y na convenção do three (`Object3D.rotation.y`); **com `rot = 0` a frente olha para +z**; `y`
  é a cota da plataforma.
- Aresta: `p` são os 4 pontos de controle da Bézier cúbica, **P0 no nó `a` e P3 no nó `b`**; `corte` são `t0` e `t1`
  **em parâmetro da curva**, não em comprimento; `mao = 1` é o sentido a→b.
- Célula: `x, z` é o centro; `ang` é a direção para onde a frente da célula olha (para a via), na mesma convenção de
  `rot`; `lado = +1` é **à direita** de a→b olhando de cima, isto é, na direção (−dz, dx).
- Invariantes: prédio dentro das suas células; frente virada para a aresta da célula da linha 0; `t0 < t1` em [0, 1];
  cota da plataforma igual a `alturaEm` no centro. Rodam sobre a cidade sintética e sobre o save do robô.

```js
sim.espelho = {
  versao,                                         // sobe a cada marca no diário
  tempo: { tique, frac /* 0..1 entre tiques */, velocidade /* 0..3 */, mult /* 0,1,2,4 */, mes /* 1..12 */, ano,
           fracMes, hora /* 0..24, só para o render (D9) */, fase /* 'manha' | 'tarde' | 'fimDeTarde' | 'noite' */,
           diaDoAno, clima: { nuvens: 0.3, vento: [vx, vz] } },   // clima fixo no M1
  mapa: { semente, tam: 8192, origem: [-4096, -4096], latitude: -23.5, norteAz, nivelMar: 0 },
  terreno: { n: 1025, passo: 8, altura: Float32Array /* já aplainada */, agua: Uint8Array /* 0 terra 1 mar 2 rio 3 lagoa */,
             rios: [{ id, pontos: Float64Array /* x, z, nivel, largura */ }], lagoas: [{ id, nivel, contorno: Float64Array }] },
  floresta: { n: 1024, passo: 8, dens: Uint8Array },
  recursos: { n: 256, passo: 32, rocha, areia, argila, calcario, fertil, subterranea /* Uint8Array */ },
  ladrilhos: { n: 16, estado: Uint8Array(256) /* 0 trancado, 1 comprável, 2 da Holding */, preco: Float64Array(256) },
  areas: [{ id /* 'vila' | 'orla' | 'gleba' | 'varzea' | 'morros' */, nome, contorno: Float64Array }],
  vias: {
    nos: { n, cap, viva: Uint8Array, ger: Uint16Array, x, y, z: Float64Array, grau: Uint8Array, raio: Float32Array },
    arestas: { n, cap, viva, ger, a, b: Int32Array, tipo: Uint8Array /* índice em VIAS_ORDEM */,
               p: Float64Array /* 8 por aresta: x0 z0 x1 z1 x2 z2 x3 z3 */, y: Float32Array /* 2: cotas */,
               comp: Float32Array, corte: Float32Array /* 2: t0, t1 */, mao: Int8Array /* 0, 1 a→b, −1 b→a */,
               flags: Uint16Array /* ARCOLOGIA, RODOVIA, PONTE */, idade: Uint32Array /* tique da obra */ } },
  celulas: { n, cap, viva, x, z, y, ang: Float32Array, zona: Uint8Array, estado: Uint8Array /* livre, ocupada, inválida */,
             predio: Int32Array, aresta: Int32Array, lado: Int8Array, linha: Uint8Array },
  predios: { n, cap, viva, ger, tipo: Uint8Array /* 0 zona, 1 serviço, 2 holding */, modelo: Uint16Array, zona: Uint8Array,
             x, z: Float64Array, y: Float32Array, rot: Float32Array, w, d: Uint16Array /* metros */,
             nivel: Uint8Array, estilo: Uint8Array, semente: Uint32Array, flags: Uint32Array,
             obraIni, obraFim: Uint32Array /* tiques; 0 = sem obra */, cor: Uint8Array /* 0 padrão */,
             moradores, empregos: Uint16Array },
  fluxos: { versao, ida, volta, vel: Float32Array /* por aresta; vel é fator 0..1 */ },   // M1b
  entregas: [{ id, item, n, caminho: Int32Array /* arestas; negativo = sentido b→a */, tIni, tFim, visual /* fora do teto */ }],
  arcologia: { plano /* 'A' | 'B' | 'C' */, etapas: [{ id, parte, estado /* 0 trancada, 1 disponível, 2 em obra, 3 pronta */,
               fase /* 0..3 */, progresso }] },
  grades: { valor: { n: 256, passo: 32, dados: Float32Array }, ar: { n: 128, passo: 64, dados: Uint8Array },
            ruido: { n: 128, passo: 64, dados: Uint8Array } },
  holding: { nome, cor /* '#RRGGBB' */ },
  partida: { modo /* 'normal' | 'livre' */ },
};

// bits de predios.flags (fonte/contratos/flags.js)
OBRA 1<<0 · ABANDONADO 1<<1 · SEM_AGUA 1<<2 · SEM_ESGOTO 1<<3 · SEM_ENERGIA 1<<4 · SEM_ACESSO 1<<5 · HOLDING 1<<6 ·
RACIONADO 1<<7 · OBRA_NIVEL 1<<8 · DEMOLIR_AO_ABANDONAR 1<<9 · SEM_MATERIAL 1<<10

sim.mudancas.desde(v) → {
  versao,
  tudo: { terreno, floresta, vias, celulas, predios },   // por domínio: true se v saiu do anel de 65.536 marcas
  realocado: ['predios', ...],                          // tabelas que cresceram (arrays novos)
  n: { nos, arestas, celulas, predios },
  terreno: [[x0, z0, x1, z1], ...], floresta: [[...]],  // retângulos sujos em metros
  nos: Int32Array, arestas: Int32Array, celulas: Int32Array, predios: Int32Array,   // idx tocados, sem repetição
  ladrilhos, fluxos, entregas, arcologia, holding: boolean, grades: ['valor', 'ar', 'ruido'],
}
```

O diário deduplica por tabela com uma coluna `mudou[idx] = versao`, então uma pintura grande não enche o anel; `tudo`
de um domínio refaz só aquele domínio (células refazem só a camada de zona). O render chama `desde()` uma vez por
quadro e aplica com teto de 2 ms. A fase da obra sai de `(tique + frac − obraIni) / (obraFim − obraIni)`, calculada
**no vértice**: `obraIni` e `obraFim` vão para uma textura RGBA32F de 512² (início, fim, cota da base e altura; a R4b trocou porque o `updateTexture` do three r186 supõe 4 componentes) só quando a obra começa (nenhum envio por
quadro). Canteiro até 0,1, fundação até 0,25, estrutura até 0,6, fechamento até 1.

### 2.5 Comandos (UI e robô para a simulação)

`sim.cmd(nome, args)` aplica na hora (D17) e devolve `{ ok: true, id?, dados? }` ou `{ ok: false, codigo, dados? }`;
na UI isso chega sempre como Promise (D16).

| Comando | Args | Códigos de recusa |
|---|---|---|
| `velocidade` | `{ v: 0..3 }` | `valor` |
| `via.construir` | `{ plano }` (o de `q.via.previa`, conferido de novo) | `creditos`, `agua`, `vao`, `declive`, `angulo`, `curto`, `raio`, `ladrilho`, `gleba`, `colisao`, `marco` |
| `via.desfazer` | `{ sessao }` | `nada`, `ocupado`, `creditos` (desfazer uma demolição sem caixa para a devolução) |
| `via.melhorar` | `{ arestas: [ref], tipo, sessao? }` | `creditos`, `marco`, `declive` |
| `via.demolir` | `{ arestas: [ref], sessao? }` | `arcologia`, `rodovia`, `inexistente` |
| `zona.pintar` | `{ pincel: { modo: 'quadra' \| 'circulo' \| 'retangulo' \| 'celulas', x, z, raio?, x2?, z2?, celulas? }, zona /* 0 apaga */ }` | `marco`, `nada` |
| `construir` | `{ tipo, x, z, rot }` (serviço ou prédio da Holding) | `creditos`, `marco`, `acesso`, `colisao`, `declive`, `agua`, `recurso`, `ladrilho`, `gleba` |
| `demolir` | `{ refs: [ref] }` | `arcologia`, `inexistente`, `creditos` |
| `predio.cor`, `predio.nome` | `{ ref, cor }`, `{ ref, nome }` | `inexistente`, `valor` |
| `predio.nivel` | `{ ref }` (prédio da Holding) | `creditos`, `estoque`, `marco`, `maximo`, `inexistente` |
| `ladrilho.comprar` | `{ i, j }` | `licenca`, `creditos`, `vizinho`, `comprado` |
| `linha.ordem` | `{ predio, linha, item, n: 1..10, auto }` | `lote`, `estoque`, `trancado`, `ocupado`, `pessoal`, `inexistente` |
| `linha.parar` | `{ predio, linha }` | `nada`, `inexistente` |
| `estoque.reserva`, `estoque.vendeCidade` | `{ item, n }`, `{ item, sim: bool }` | `valor` |
| `cidade.importarAuto` | `{ sim: bool }` (D48) | `valor` |
| `deposito.vender` | `{ item, n }` | `limite`, `nada`, `valor` |
| `deposito.auto` | `{ item, acima: n \| null }` | `valor` |
| `importar` | `{ item, n }` (n de 1 a 1.000) | `creditos`, `trancado`, `valor` |
| `emprestimo.tomar` | `{ valor }` (múltiplo de 1.000) | `valor`, `limiteAno`, `limiteDivida` |
| `emprestimo.pagarJuros`, `.pagarParcela`, `.quitar` | `{}` | `nada`, `creditos` |
| `arcologia.iniciar` | `{ etapa }` | `marco`, `creditos`, `emObra`, `trancado`, `nada` (já pronta), `valor` (etapa que não existe) |
| `acelerar` | `{ alvo: { predio, linha }, minutos: 1 \| 5 \| 10 \| 30 \| 60 }` (etapas só se o dono pedir, D13) | `creditos`, `nada`, `valor`, `inexistente` |
| `decisao.escolher`, `decisao.adiar` | `{ id, opcao }`, `{ id }` | `inexistente`, `prazo`; `creditos` no escolher (a opção custa mais que o caixa) |
| `holding.identidade` | `{ nome, cor, modo: 'normal' \| 'livre' }` (nova partida) | `valor` |

A lista fechada de códigos vive em `fonte/contratos/codigos.js`; um teste confere que todo código tem frase em
`fonte/ui/textos/`. A `sessao` das vias é a chave da sessão da ferramenta, `'<sessão da página>.<n>'` (D16 e D32): o
desfazer e o reembolso integral valem só nela. Na UI a resposta chega com `idComando: { sessao, seq }`, e o `id` fica o
da simulação (a ref da coisa criada). Salvar, carregar, exportar e importar são do app (seção 2.8).

### 2.6 Consultas e eventos

Consultas puras e síncronas (o teste confere que o hash do estado não muda). Formatos principais:

```js
q.barra() → { creditos, saldoHora /* líquido, por hora de jogo */, populacao, popHora, bemEstar,
  bemEstarTarifa /* média suavizada e arredondada, D11 */, tarifa /* 5|8|11 */, faixa: [de, ate],
  margem: { degrau /* 31 | 61 | null */, delta },          // "+3 acima de 61"
  demanda: { R, C, I, E } /* 0..100 */, data: { mes, ano, fracMes, fase }, velocidade, mult,
  marco: { n, nome, xp, xpIni, xpProx, requisito /* 'torre.e4' | null */ }, divida, valuation, caixaZerado,
  alertas: [{ id, gravidade: 'grave' | 'atencao' | 'info', glifo, codigo, params, alvo: { x, z } | { tela } }],
  decisoesPendentes, objetivos: [{ id, texto, quem, dominio: 'cidade' | 'holding' | 'arcologia', feito, total, alvo }] }

q.retomar() → { objetivo, problema: { codigo, params, alvo } | null, desde /* tique do último save */ }
q.via.previa({ modo: 'reta' | 'curva' | 'continua' | 'grade' | 'melhorar' | 'demolir', tipo, pontos: [[x, z], ...],
              tangente /* continua */, espacamento /* grade */, arestas: [ref] /* melhorar e demolir */,
              tolerancia /* m */, encaixe, sessao })
  → { ok, segmentos: [{ p: [8], tipo, cotas: [y0, y1], ponte: bool, erros: [codigo], declive }], nosNovos, divisoes,
      novos: [[x, z]], dividir: [{ aresta, t, ponto }], pontos: [[x, z]] /* os encaixados */,
      encaixes: [{ indice, ponto, tipo: 'no' | 'aresta' | 'angulo' | 'prolongamento' | 'quadra' | 'passo' | 'comprimento'
                   | 'portao', valor, portao?, passo? }],
      guias: [{ tipo, a: [x, z], b: [x, z] }], demolir: { predios: [ref], custo }, comprimento, custo, manutencaoHora,
      declive, erros: [{ codigo, trecho /* -1: o plano inteiro */, dados? /* faltam em 'creditos' */ }],
      arestas /* melhorar e demolir: um item por aresta pedida */, devolve /* demolir; custo = -devolve */ }
                                                              // até 1 ms por chamada (meta da UI)
q.zona.previa({ pincel, zona }) → { celulas: Int32Array, comPredio, efeitoMedia /* bem-estar da cidade, D11 */ }
q.construir.previa({ tipo, x, z, rot }) → { ok, codigo?, dados? /* faltam em 'creditos' */, x, z, rot /* ajustados à frente
  da via */, custo /* já soma custoDemolir */, custoDemolir /* prédios de zona sob a planta, D54 */, manutencaoHora, alcance,
  pegada, demolir: [ref], semRede /* produtor de rede numa via sem canos nem cabos: liga só depois de melhorar */,
  efeitos: [{ camada, delta }] }
q.predio(ref) → { ref, tipo, modelo, nome, zona, nivel, estado: 'obra' | 'ok' | 'abandonado', obra: { fase, progresso, fimTique, semMaterial } | null,
  moradia: { lares, moradores, capacidade, escolaridade: [4], bemEstar, fatores: [{ id, v }], tarifa, contribuicaoHora } | null,
  trabalho: { vagas: [4], ocupadas: [4], clientes, produtividade, fatores: [{ id, v }] } | null, nivelProx: { pontos, meta, falta: [codigo] } | null,
  servicos: { agua, esgoto, energia /* 'ok' | 'racionado' | 'sem' */, saude, educacao, seguranca, bombeiros, lazer /* 0..1 */ },
  servico: { capacidade, uso, eficiencia, alcance, manutencaoHora } | null,
  holding: { nivel, linhas: [{ item, n, auto, progresso, fimTique, parada, sugestaoLote }], vagas, ocupadas, distArmazem } | null,
  avisos: [{ codigo, gravidade, desde, acao }], cor, via: { ref, nome }, faz /* frase: "fabrica mercadoria para o comércio" */ }
q.camada(id) → { id, fonte: 'predios' | 'arestas' | 'grade' | 'celulas', dados: Float32Array, grade: { n, passo, origem } | null,
  tipo: 'seq' | 'div' | 'cat', escala: { min, max, meio?, unidade }, categorias: [{ v, chave }] | null,
  legenda: [{ v, chave }], resumo: { chave, params }, versao }
q.avisosPredios() → { versao, idx: Int32Array, glifo: Uint8Array /* índice em nomes */, gravidade: Uint8Array,
  nomes: [glifo] }                                             // com os 'info'; o filtro de gravidade é da UI
q.deposito() → { janela: { fimTique, vendidas, max: 100 }, itens: [{ item, estoque, reserva, precoBase, precoVenda,
  precoImportacao, vendeCidade, auto }], importarAuto /* D48 */, importacoes: [{ id, item, n, fim /* tique da chegada */ }] }
q.emprestimo() → { disponivelAno, tomadoAno, limiteAno: 50000, divida, principal, dividaMax: 500000, taxa: 0.10, mora, passo,
  prazoAnos, jurosDevidos, jurosHora, parcela /* a de pagarParcela */, ano /* do calendário, D67 */,
  contratos: [{ id, ano, valor, saldo, juros, ini, fim, mora }] }
q.orcamento() → { receitas: { moradores /* a cidade e os moradores de luxo da Arcologia */, cidade, deposito, marcos, aporte? },
  despesas: { servicos, vias, ligacao, salarios, juros, importacao, importacaoCidade }, naoPago: { servicos, salarios },
  investimentosHora, saldoHora, fluxoCaixaHora /* saldoHora sem os juros, que correm como dívida */, caixa, eficiencia,
  caixaZerado, totais /* livro-caixa acumulado por categoria */, serie: [{ mes, caixa, receitas, despesas, moradores, bemEstar, desemprego }] }
q.producao() → { itens: [{ item, estoque, produzHora, consomeHora, cidadeHora /* demanda da cidade, D48 */, reserva, precoBase,
  liberado }],
  predios: [{ ref, tipo, nivel, produtividade, linhas: [{ item, n, auto, ativa, rodando, progresso, fimTique, parada,
  sugestaoLote }] }], frota: { usados, total, fila, atrasoMedio, esperaMax, filaMax, feitas, porDestino }, armazem: { usado,
  capacidade }, importarAuto /* D48 */,
  esperando: { item: unidades } /* obras da cidade paradas na última rodada, D48 */ }
q.arcologia() → { plano, nome, partes: [{ id, nome, etapas: [{ id, parte, nome, estado, marco, requisito, recusa, creditos,
  materiais: [{ item, pede, entregue, aCaminho, estoque }], minutos, fases, fase, progresso, materiaisFrac, parada, efeitos,
  xp, ini, fim, previsao }], futuras: [{ id, nome, prazo, creditos, materiais }] }], progressoTotal,
  valor /* créditos pagos e materiais entregues: entra no valuation, D49 */, alturas: { blade, legacy, ponte } | null,
  efeitos: { vagas: [4], moradoresLuxo, contribuicaoLuxoHora, vias, portoes, agua }, inaugurada }
q.demanda() → { resBaixa, resMedia, resAlta, comBaixa, comAlta, escritorio, industria, R, C, I, E, fatores: { zona: [{ id, v }] },
  ativas: [zona] /* as liberadas no marco */ }
q.sugestoes() → [{ id, tipo: 'via', via, pontos } | { id, tipo: 'zona', zona, pontos } | { id, tipo: 'melhorar', via, arestas: [ref],
  pontos } | { id, tipo: 'construir', construir, x, z, rot } | { id, tipo: 'no', x, z, ref, energiaMW }]   // D36
q.holding() → { nome, cor, influencia, legado, efeitos: { descontoLadrilho, atratividade }, divisoes, valuation, empresa, jogador,
  pais, ato, conselheiros: [{ id, nome, curto, cargo }] /* D77 a D83 */ }
q.marcos() · q.objetivos() · q.decisoes() · q.mural({ desde }) · q.cidade() · q.catalogo(categoria) ·
q.ladrilhos() · q.aresta(ref) · q.avisos({ perto, limite }) · q.viasPerto(x, z, raio) · q.hash()
```

Os formatos da última linha seguem o desenho da simulação (seção 16.4) e ficam escritos com um exemplo em
`fonte/contratos/consultas.js` na F0. Nenhuma consulta devolve "dias": prazos em tiques, e a UI formata (D42).

**Eventos** (`sim.on(nome, fn)`, no fim do tique ou depois de um comando): `marco {n, nome, premios, libera}`,
`desbloqueio {ids}`, `decisao {id}`, `mural {post}`, `aviso {id, gravidade, codigo, params, alvo}` (da cidade),
`avisosPredios {}` (a lista mudou), `etapa {id, estado}`, `objetivo {id, estado}`, `financas {tipo}`,
`caixaZerado {sim}`, `obraFim {ref}`, `predioNivel {ref, nivel}`, `predioAbandonado {ref}`, `velocidade {v}`,
`construido {tipo, refs}`, `demolido {tipo, refs}`, `ladrilho {i, j}`, `tarefaAtrasada {nome, tique}`.

### 2.7 Render (API usada pela UI e pelo app)

```js
const R = await criarRender(canvas, { sim: { espelho, mudancas }, qualidade: 'auto' | 'ultra' | 'alta' | 'media' | 'leve',
                                      semClip /* força as duas faixas de profundidade */ });
R.quadro(tMs)                                     // lê o diário e desenha
R.camera.irPara({ x, z, dist, guinada, inclinacao }, ms) → Promise;  R.camera.estado();  R.camera.definir(estado)
R.entrada.modo('camera' | 'ferramenta');  R.entrada.aoFerramenta(fn)  // fn({ fase: 'inicio'|'move'|'fim', x, y, ponto, dedos })
R.entrada.opcoes({ deslocY: 56, bordaPx: 48 })
R.selecionar(xTela, yTela) → { tipo: 'marcador' | 'predio' | 'colocavel' | 'aresta' | 'terreno' | 'agua' | 'arcologia', ref, idx, ponto }
R.projetar([x, y, z]) → { x, y, visivel, dist };  R.raio(xTela, yTela) → [x, y, z] | null;  R.ancoras(lista) → posições
R.camadas.mostrar({ fonte, dados, grade, cores: ['#...'], min, max, categorico });  R.camadas.ocultar()
R.ferramenta.via.previa(plano, 'normal' | 'invalido' | 'sugestao');  R.ferramenta.zona.mostrar(bool)
R.ferramenta.zona.celulas(Int32Array, zona);  R.ferramenta.pincel({ x, z, raio });  R.ferramenta.ladrilhos(bool)
R.ferramenta.fantasma({ tipo, x, z, rot, alcance, ok });  R.ferramenta.demolir(refs);  R.ferramenta.limpar()
R.marcadores.atlas(canvas, mapa);  R.marcadores.definir([{ idx, glifo, gravidade, prioridade }])
R.selecionado({ tipo, ref } | ref | null);  R.tempo.forcar({ fase } | null);  R.sempreDia(bool)   // só a ref: prédio
R.estado('livre' | 'coberto' | 'foto' | 'teste');  R.qualidade(id);  R.perfil() → { id, sugerido, capac }
R.stats   // { calls, tris, callsSombra, trisSombra, passes, ms, qps, p95, gpuMs /* por fenceSync */, pr, msaa, perfil,
          //   familias: { terreno, predios, colocaveis, arvores, vias, vida, arcologia, sombra, resto } /* tris */, pxPorTri,
          //   pior: { calls, tris, ms } /* janela de 120 quadros */, setores: { lod0, anexos, fila, msEnvio },
          //   instancias: { predios, arvores, carros, pessoas, marcadores },
          //   memoria: { geometriaMB, texturasMB, programas }, capac: { clipControl, multiDraw, timer, limites } }
R.bancada() → Promise<{ perfil, sugerido, msMedio, p95, qps, calls, tris, pior, gpuMs, familias, programas: [{ nome,
  amostradores: { v, f }, varyings, uniformesF, atributos, msCompilar }], capac }>
R.capa(640, 288) → Promise<Blob>;  R.foto({ w, h }) → Promise<Blob>;  R.voo(alvo) → Promise   // momentos de câmera;
                                  // o voo dura pelo comprimento do caminho de van Wijk e Nuij (0,8 a 4,5 s)
```

A UI nunca toca em objetos do three. `?cena=<nome>` monta as cenas fixas da bancada (seção 4.3). `R.stats` soma
**todos os passes do quadro**: `renderer.info.autoReset = false`, zerado no começo do quadro (sombra própria, faces do
céu, PMREM, campo de alturas, sombra de longe, luz da rua, cena, bloom e composição).

Registros do render (D45), criados pela F0: `registrarTextura(nome, gerador)`, `registrarGeradorOficina(tipo,
modulo)`, `registrarSelecionavel(dominio, fn)`, `registrarDominio`, `registrarCena`, `ganchos.definir`. Desde a I1 as
cenas vêm sob demanda (`carregarCena(nome)`, um pedaço do pacote por cena), e o `THREE` do contexto (dos geradores de
textura, de `ctx.THREE` e da api dos registros) é o subconjunto `THREE_TEXTURAS` de `materiais/texturas.js`: o
namespace do three passado como valor impedia a poda do three (177 KB, A1). Quem precisa de outra classe importa o three
no próprio arquivo e usa só `THREE.Nome` (a guarda de texto confere).

### 2.8 UI, app e workers

- **UI:** `criarUI(raiz, { sim, R, jogo }) → { quadro(t) }`. A ponte lê `sim.q.barra()` 4 vezes por segundo e depois de
  cada comando, e aplica nos sinais com `batch()`. Ações passam por `ui/acoes.js`, que devolve Promise e gera o id
  (`sessao`, `seq`) de cada comando (D16); códigos viram frase por `t()`.
- **App** (`jogo`): `novaPartida({ nome, cor, modo })`, `salvar(slot)`, `carregar(slot)`, `listarSaves()`,
  `exportar()`, `importar(arquivo)`, `prefs`, evento `salvo`.
- **Laço** (`fonte/app/laco.js`): `sim.avancar(dt)` (até 8 tiques por quadro, `frac` para interpolar; para quando uma
  tarefa atrasou, D15) → `R.quadro(t)` → `ui.quadro(t)` → `salvamento.talvez(t)` → `diario.talvez(t)` (a cada
  segundo). Em segundo plano o jogo pausa e salva sem gzip.
- **Worker `tarefas`:** recebe `{ id, nome, tique, entrada }` (a segunda cópia, transferida), responde `{ id, saida }`
  com arrays transferidos. No Node, a mesma função roda síncrona sobre a mesma entrada copiada. Carga: `gerarTerreno`
  também roda nele na abertura.
- **Worker `oficina`:** despachante da F0 (`registrarGeradorOficina`): recebe `{ id, tipo, chave, dados }` com `tipo`
  em `setor`, `anexo`, `vias`, `arvores`, `fora`, `colocavel`, `alturasCidade`, e responde `{ id, chave, malhas:
  [{ material, atributos quantizados, indices }] }` ou a grade Float32 das alturas da cidade (as caixas LOD1
  rasterizadas em 1024², que a GPU recebe por `texSubImage2D` e a câmera usa para colisão, sem `readPixels`). A thread
  principal envia no máximo um setor e um anexo por quadro.
- **Geradores sem three:** `fonte/sim/`, `fonte/comum/` e `render/geracao/` não importam o three (teste de texto);
  a matemática vem de `fonte/comum/`. O `montar.mjs` informa o tamanho de cada worker e falha acima do teto (A1).
- **Montagem:** no `app/` (ou `previa/`) cada worker é um arquivo com carimbo guardado pelo `sw.js`; no HTML único o
  texto do worker vira `Blob` com `URL.createObjectURL`.

### 2.9 Save

```
gzip (ou cru no segundo plano) (
  'HELD' | u16 formato = 1 | u16 bandeiras (bit 0: comprimido) | u32 tamanho do JSON |
  JSON UTF-8: { versaoSave, jogo: 'arcologia-de-held', mapa, semente, tique, criado, nome, holding: { nome, cor },
                partida: { modo }, arcologia: { plano }, json: { ...seções registradas }, vista: { camera, velocidade },
                secoes: [{ nome, tipo, n, bytes, offset }] } |
  seções binárias alinhadas em 8: 'tabela.coluna' de cada tabela registrada (n, livres, ger), grades mutáveis
  (floresta, recursos restantes, valor, ar, ruído)
)
```

- A grade de alturas não vai (sai da semente e de `aplainar()` sobre as formas registradas ao carregar).
- IndexedDB `heldopolis`: loja `saves` (slot para Blob) e loja `meta` (slot para `{ nome, data, tique, populacao,
  creditos, marco, versao, capa: Blob JPEG 640 x 288 }`). `localStorage`: `heldopolis.ultimo`, `heldopolis.prefs` e
  **`heldopolis.diario`** (D31).
- Carregar: confere cabeçalho e versão, aplica `MIGRACOES[v]` em ordem, monta numa simulação nova, roda `validar(S)`
  (células x prédios, grafo sem aresta órfã, dívida igual à soma dos contratos, caixa não negativo), **reproduz o
  diário** até o tique gravado e só então troca. Ficam do `core/salvar.js` atual a trava de importação, "outra página
  gravou" (agora pelo carimbo do diário), a quarentena de save danificado e o armazenamento persistente. O banco do
  jogo antigo (`arcologia-de-held`) não é lido nem apagado; ele continua servindo o `jogo-antigo/` (mesma origem).
- Um save de exemplo por versão em `ferramentas/saves/` e um teste que abre todos.

### 2.10 Contrato interno da simulação (entre as parcelas S, X1 e X4)

Os domínios conversam por **agregados** e por **funções de serviço** que a F0 cria com um substituto simples. Cada
parcela troca o substituto do seu domínio e não edita o arquivo das outras.

```js
S.agregados = {                                  // escrito por S2a/S2b, lido por S3a, X1b e q.barra
  populacao, lares, popHora, bemEstarMedio, bemEstarTarifa, tarifa,
  demanda: { resBaixa, resMedia, resAlta, comBaixa, comAlta, escritorio, industria, R, C, I, E, fatores },
  empregos: { vagas: [4], ocupadas: [4], desemprego: [4] },
  // S2a, com a cidade viva: bemEstarSuave (média de 1 mês sem arredondar), empregos.taxa (0 a 1), empregos.trabalhadores
  redes: { agua: { oferta, demanda }, esgoto: {...}, energia: {...}, importado: { energia } },
  trajeto: { porZona: Float32Array } | null,     // S1c (M1b); null no M1a
  mercadoria: { producao, consumo, importada } | null,   // S2b (M1b)
};
sim.custos.registrar(nome, fn → créditos por hora)     // S1b (vias), S2a (serviços, ligação); S3a soma e paga (D41)
sim.holding.pagar(valor, categoria) → bool             // F0 real (caixa nunca negativo); S3a acrescenta série e categorias
sim.holding.receber(valor, categoria)
sim.holding.comprarParaObra(ref, nivel, materiais) → { espera: bool }   // F0: importa sem receita; S3a: D48
sim.holding.entregar({ item, n, origem, destino, aoChegar, visual }) → id   // F0: instantânea; S3a: frota (D47)
sim.holding.efeito(id, { produtividade, caminhoes })   // X1b (torre.e2) → S3a
sim.progresso.xp(n, motivo);  sim.progresso.liberado(id) → bool;  sim.progresso.requisito(marco, fn)   // F0: soma e true; S3a: marcos
sim.redes.produtor({ tipo: 'agua' | 'energia', ref, capacidade, no })  // S2a; X1b registra o reservatório de lago.e1
sim.formas.registrar({ tipo: 'via' | 'plataforma' | 'cava', ref, contorno, cota })   // F0 (registro); S1b, S2a, X1b registram
sim.colocaveis.registrar(tipo, def)                     // S2a (serviços), S3a (prédios da Holding): o comando construir é um só
sim.camadas.registrar(id, fn);  sim.avisos.registrar(codigo, fn)   // cada domínio registra as suas
sim.travessia.registrar(fn)                             // X4 (M1b): validar() de S1b pergunta se o trecho sobre água vira ponte
// acréscimos da onda 3, atribuídos direto no objeto (fonte/contratos/interno.js os descreve):
sim.holding.registrarChegada(nome, fn); .folha(ref); .ocupados() → [4]; .estoque(item)   // S3a (X1b soma as vagas dela em ocupados)
sim.economia = { eficiencia(), caixaZerado(), regras(), data(t), efeitos(tipo), somarMedidor(nome, v, motivo) }   // S3a
sim.cidade = { efeito(id, { x?, z?, raio?, demanda?, valor?, bemEstar?, atratividade? }), remover(id), lista() }  // S2a; X1b (D49)
sim.arcologia = { vagas(), moradoresLuxo(), contribuicaoHora(), valor(), estado(id) }  // X1b: a economia soma contribuicaoHora
                                                        // na renda dos moradores e valor no valuation (D49)
// a linha de produção guarda nLote, o n do lote em andamento (a ordem n vale para o próximo)               // S3a
```

### 2.11 Perguntas que sobem ao dono

Nenhuma trava o começo. A 12 é a decisão do portão 1; as outras têm padrão adotado.

| # | Pergunta | Padrão adotado |
|---|---|---|
| 1 | Aceita que nada ande com o jogo fechado (perde os 50% por até 12 h)? | nada anda; abre pausado (D10) |
| 2 | "Por hora" = hora de jogo, igual à hora real em 1x? | sim (D8), mostrado como na D42 |
| 3 | Tarifa pela média da cidade (como hoje) ou por prédio? Exemplo: com 30 mil moradores, a média cair de 61 para 60 tira 90 mil/h (27% da renda) da cidade inteira; um bairro novo sem serviços puxa a média. Por prédio, cada prédio paga pela sua faixa e o degrau coletivo some | média da cidade, suavizada em 1 mês e arredondada, com a margem na barra (D11); por prédio pronto para trocar |
| 4 | Impostos sobre comércio, escritório e indústria? | nenhum no M1 (D12) |
| 5 | Compra de tempo nas etapas da Arcologia? Com 300 mil/h de renda, 60 min custam 5 mil, e a Torre inteira (55 min em 1x) sairia por uns 5 mil | só nas linhas da Holding (D13) |
| 6 | Nome: "Arcologia de Held", cidade Heldópolis? | sim (D1) |
| 7 | Metas de ritmo: marco 7 (que pede a Torre pronta) entre 5 e 7 h de jogo em 1x, com 25 a 40 mil moradores | adotadas para o robô calibrar (A4) |
| 8 | Torre Lâmina (D27), vista na Prévia 0 de 4 lados e de perto | adotada; o dono aprova no portão 1 |
| 9 | Com 25 a 40 mil moradores a 11, a renda é de 275 a 440 mil/h. O Depósito rende no máximo 25 unidades por hora x 255 (concreto a 150%), ~6,4 mil/h (menos de 2,5%), e os 50 mil de empréstimo por ano valem 7 a 11 minutos de renda. O Depósito e o empréstimo passam a pesar só no começo. Manter assim? E "preço base" passa a ser o preço de catálogo (D25) | manter os números; nada muda sem ele |
| 10 | A partida atual (capítulo 6) não passa para o jogo novo. A montagem atual fica congelada e jogável em `jogo-antigo/`, com o save no aparelho | sim, `jogo-antigo/` sem manutenção (D38) |
| 11 | Voltam só no M2 e no M3: helicópteros entre helipontos (M2), aeroporto com aviões e porto de carga (M3), Sede e Torres do Conselho (M2); no M1 ficam o helicóptero da Torre, iates, cruzeiro, jatinhos e esportivos, só visuais (seção 1.7). Aceita a ordem? | a ordem da seção 1.7 |
| 12 | Plano diretor da Arcologia: A "Baía", B "Parque-canal" ou C "Orla" (Prévia 0) | **decisão do portão 1** (D59) |
| 13 | Materiais fotográficos CC0 ou procedurais (A/B na Prévia 0)? | o que ele aprovar e o Poco X7 aguentar (D46) |
| 14 | O M1a sai em `previa/` e o M1 completo toma o `app/`. Prefere o M1a já no `app/`? | `previa/` até o M1 (D62) |

---

## 3. Estrutura do repositório

### 3.1 Árvore

A F0 cria **todos** os arquivos abaixo, os que não são dela como esqueleto que exporta `registrar()` vazio. Assim os
índices de importação ficam fixos e nenhuma parcela edita o índice de outra. A coluna da direita diz quem é o dono de
cada arquivo depois da F0. **Uma parcela "b" ou "c" herda os arquivos da parcela do mesmo domínio da onda anterior**
(S1b herda de S1a, R4b de R4a e assim por diante); as duas nunca rodam ao mesmo tempo.

```
/
  CLAUDE.md                     novo (F0); README.md (C1, C2)
  package.json                  F0: three 0.186.0, esbuild 0.28.2, playwright 1.56.1, preact 10.29.8,
                                @preact/signals 2.11.2, @fontsource-variable/inter 5.3.0 e o codificador KTX2 (versões fixas)
  docs/PROJETO.md               este documento (F0; só o integrador muda)
  docs/VISAO.md                 F0 troca a seção 6 por um apontador para o PROJETO; C2 revisa no fim
  docs/desenho/  docs/pesquisa/ anexos (F0)
  arte/materiais/, arte/LICENCAS.md   texturas CC0 em KTX2 e suas licenças                              R2a
  app/  arcologia-de-held.html  jogo atual congelado até a publicação do M1; depois, o jogo novo (C2)
  jogo-antigo/                  criada na publicação do M1: a montagem congelada do jogo atual (C2)
  previa/                       montagem do jogo novo durante o M1 (só o integrador monta); sai na publicação do M1
  antigo/                       fonte/, ferramentas/ e arte/ do jogo atual, só consulta; sai na publicação do M1
  fonte/
    web/        index.html, sw.js (cache com prefixo por app), manifest.webmanifest, icones/                 F0
    app/        main.js (arranque), laco.js, controle.js                                                     F0 (depois C1, C2)
                salvamento.js (automático, capa, slots), armazem.js (IndexedDB, exportar, importar, travas),
                diario.js (diário síncrono e reprodução)                                                     U2a
    comum/      rng.js (xoshiro128**), hash.js (fnv1a), relogio.js (constantes, calendário, fases),
                bezier.js, heap.js, caminhos.js (Dijkstra de várias origens fatiado por trabalho, A*),
                altura.js (alturaEm bilinear), vetor.js, util.js                                            F0
    contratos/  codigos.js, comandos.js, consultas.js, eventos.js, flags.js, camadas.js,
                espelho.js (formatos, convenções e invariantes), interno.js, render.js, save.js,
                tarefas.js (entrada copiada, T + K)                                                         F0 (só o integrador muda)
    data/       vias.js, zonas.js, predios.js                                    F0 cria; S1b (vias), S2a (zonas, predios)
                mapa-heldopolis.js (relevo, costa, rio, recursos, Vila, nó de entrada, áreas)               S1a
                servicos.js                                                                                  S2a
                colocaveis.js (modelo, referência real, LOD, triângulos)                                     R5
                economia.js (REGRAS_DONO congelado), holding.js, marcos.js, historia.js, nomes.js,
                objetivos.js                                                                                 S3a
                arcologia-plano.js    F0 cria (envelope, Torre); integrador grava o plano no portão 1; X1a detalha
                arcologia.js (etapas e efeitos)                                                              X1b
                estilos.js                                                                                   R4a
    sim/
      nucleo.js, estado.js, tabela.js, grade.js, agregados.js, substitutos.js, tarefas.js, trabalhador.js,
      livro.js (reprodução), formas.js (registro do aplainar), consultas/barra.js, salvar/formato.js,
      vias/grafo.js                                                                                          F0
      mundo/terreno.js, agua.js, recursos.js, floresta.js, ladrilhos.js, aplainar.js, vila.js, areas.js     S1a
      vias/ferramenta.js, encaixe.js, validar.js, demolir.js, nomes.js; zonas/blocos.js, pincel.js           S1b
      transito.js, tarefas/transito.js                                                                       S1c
      vias/ponte.js                                                                                          X4
      zonas/demanda.js, crescimento.js; predios.js, cidadaos.js, bemestar.js, servicos.js, redes.js          S2a
      ambiente.js, mercadoria.js                                                                             S2b
      economia.js, progresso.js, objetivos.js, historia.js, holding/producao.js, mercado.js, logistica.js    S3a
      arcologia.js                                                                                           X1b
    render/
      index.js, ponte.js, depuracao.js (caixas e linhas para o jogo andar desde a F0), cenas/index.js,
      mundo/oficina.worker.js (despachante), materiais/texturas.js (registro), camera/selecao.js (registro)  F0
      motor/renderizador.js, perfis.js, quadro.js, medidas.js, ganchos.js                                  F0 cria; R1a
      motor/pos.js, resolucao.js, bancada.js, capacidades.js, faixas.js (duas faixas de profundidade)        R1a
      ambiente/astro.js, ceu.js, ibl.js, exposicao.js, neblina.js, sol.js, nuvens.js                         R1a
      ambiente/campoAlturas.js, sombraLonge.js, luzNoite.js                                                  R1b
      sombra/projetores.js, mapa.js (sombra própria, D43)                                                    R1a
      camera/camera.js, entrada.js, raio.js                                                                  R1a (entrada completa: R1b)
      materiais/biblioteca.js, shaders/{neblina,sombra,ceu,pos}.glsl.js                                      R1a
      materiais/texturas-chao.js, shaders/{terreno,agua,folha}.glsl.js                                       R2a
      mundo/terreno.js, agua.js; geracao/ruido.js                                                            R2a
      mundo/fora.js, vegetacao.js; geracao/arvores.js, impostor.js                                           R2b
      geracao/perfilVia.js, malhaVia.js, cruzamento.js, veiculos.js; mundo/vias.js, luzRua.js, props.js,
      trafego.js; materiais/texturas-via.js; shaders/via.glsl.js                                             R3a
      geracao/pessoas.js; mundo/pedestres.js, caminhoes.js; shaders/pessoa.glsl.js                           R3b
      geracao/planoPredio.js, malhaPredio.js, fundir.js, quantizar.js; mundo/predios.js, setores.js,
      oficina.js, instancias.js; materiais/texturas-predio.js; shaders/fachada.glsl.js                       R4a
      mundo/obras.js, anexos.js, lotes.js                                                                    R4b
      colocaveis/*.js (um gerador por família de serviço e de indústria)                                     R5
      vida/iates.js, navios.js, jatos.js; frota de esportivos em geracao/veiculos-luxo.js                    R6
      geracao/ponte.js                                                                                       X4
      arcologia/torre.js, planos.js, partes.js (silhuetas LOD1), lago.js, fantasma.js                        X1a
      arcologia/obra.js, heli.js                                                                             X1b
      sobreposicoes/ferramentas.js                                                                           X2
      sobreposicoes/camadas.js, marcadores.js, ancoras.js                                                    X3a
      cenas/aberta.js, horizonte.js, noite.js, estresse.js, prova-sombra.js (R1a) · costa.js, materiais.js (R2a) ·
      rua.js (R3a) · bairro.js (R4a) · obra.js (R4b) · servicos.js (R5) · torre.js, planos.js (X1a) ·
      ferramentas.js (X2) · camadas.js (X3a)
    ui/
      index.jsx, ponte.js, loja.js, acoes.js (Promise e id de comando), consultas.js, textos.js (registro),
      formato.js (unidades da D42), prefs.js, tema/tokens.css, base.css, fontes/ (Inter latina e OFL.txt),
      glifos/Glifo.jsx, comp/Botao.jsx                                                                        F0
      glifos/glifos.js (registro com ~130 glifos)                                                             F0 cria; U1a
      comp/* (Interruptor, Segmentado, Deslizante, Quantidade, DoisToques, Barra, Chip, Linha, Tabela,
             Abas, Popover, Dica, Folha, Tela, Modal, Aviso, Vazio, Grafico, Indicador)                      U1a
      hud/BarraCima.jsx, selecao/Cartao.jsx, telas/Economia.jsx, tema/{componentes,hud,folha,telas}.css      U1a
      hud/{Velocidade,Trilho,Objetivo,FaixaAlerta,Avisos,Menu,Retomar}.jsx, selecao/Folha.jsx,
      selecao/secoes/{residencial,comercial,industrial,servico,empresa,via,terreno}.jsx,
      telas/{Holding,Cidade,Progresso,Conselho,Decisao,Momento}.jsx, mundo/MenuContexto.jsx                 U1b
      selecao/secoes/arcologia.jsx, telas/LivroArcologia.jsx                                                  X1b
      telas/Camadas.jsx, mundo/marcadores.js, Rotulos.jsx, glifos/atlas.js                                    X3a
      telas/Problemas.jsx                                                                                     X3b
      telas/Configuracoes.jsx, TesteDesempenho.jsx; inicio/*; guia/*                                          U2a
      telas/Foto.jsx, Mural.jsx; inicio/Abertura.jsx                                                          U2b
      hud/Construcao.jsx, Bandeja.jsx, BarraFerramenta.jsx; mundo/Lupa.jsx, Cotas.jsx;
      ferramentas/{via,zona,colocar,demolir,areas,sessao}.js; tema/mundo.css                                 X2
      textos/<parcela>.js (cada parcela o seu)
    som/        som.js, interface.js (U2a) · mundo.js, musica.js (U2b)
  ferramentas/
    montar.mjs, testar.mjs, simular.mjs, bancada.mjs, vitrine-ui.mjs, cidade-sintetica.mjs,
    vitrine/render-falso.js, vitrine/sim-falsa.js, guarda-texto.mjs                                          F0
    mapa.mjs (PNG do relevo, da água, dos recursos, das áreas e das sugestões)                               S1a
    codificar-texturas.mjs (CC0 para KTX2)                                                                   R2a
    sonda-gpu.mjs (limites, extensões, tempo de compilação)                                                  R1a
    robo/robo-sim.mjs (estratégia do robô, Node e navegador)                                                 S3a
    robo-navegador.js, aceite-cor.mjs, saves/                                                                C1
    testes/<area>.teste.mjs (cada parcela os seus; o simular --testes descobre todos)
    vitrine/cenas/<parcela>.js (cada parcela as suas)
```

### 3.2 Ferramentas

| Ferramenta | Situação | O que faz no jogo novo |
|---|---|---|
| `montar.mjs` | reescrita (F0) | entrada `fonte/app/main.js`; JSX do Preact; CSS de `ui/tema/*.css`; Inter com carimbo (base64 no HTML único); workers `tarefas` e `oficina` com carimbo (Blob no HTML único) e **tamanho de cada um com teto**; texturas KTX2 com carimbo (fora do HTML único) e o transcodificador Basis do three em `basis/`; o GLSL marcado `/* glsl */` sai sem comentários nem espaço de sobra; `cenas.html` (índice das cenas da prévia, de `fonte/web/`); **divisão do pacote** (desde a I1): cada `import()` vira um pedaço `parte.<carimbo>.<hash>.js` que só vem quando pedido, os pedaços comuns entram com `modulepreload` no `index.html`, e o teto do A1 vale para o `jogo` mais os pedaços que ele importa de saída (o HTML único leva tudo num arquivo); lista do `sw.js` gerada com o **prefixo do app** (com todos os pedaços); **saída em `previa/`** até o M1 e em `app/` com `--saida app`; avisa chave duplicada; roda a `guarda-texto.mjs` |
| `guarda-texto.mjs` | nova (F0) | falha se `fonte/sim/` ou `fonte/comum/` usar relógio ou `Math.random`, se `fonte/sim/`, `fonte/comum/` ou `render/geracao/` importar o three, se um arquivo de `fonte/` com `import * as THREE` passar o namespace como valor (I1, A1), se algum shader próprio usar `mediump`, ou se um texto de `ui/textos/` tiver travessão, "Aluguel", "/dia" ou a palavra "dia" |
| `testar.mjs` | fica, com `--pasta previa\|app`, `--webgpu` e `--semClip` opcionais | serve a pasta, captura, lê `R.stats` e `window.__resultado` |
| `simular.mjs` | reescrita (F0) | `--testes` (roda todo `ferramentas/testes/*.teste.mjs` e a guarda de texto), `--determinismo`, `--robo [--horas h] [--semente s] [--comprarTempo]`, `--bancada [--estresse]` (o tique medido sozinho; a `via.construir` a cada 10 tiques é medida à parte, entre os tiques, depois de uma obra de aquecimento) |
| `bancada.mjs` | nova (F0; cenas das parcelas) | roda `?cena=` por perfil no Chromium, grava PNG e JSON, guarda o **pior quadro de 120** com o sol andando, **falha se passar do orçamento** (total e por família) ou se um programa passar da guarda do Mali (D44); o sol anda em 4x e `--vel 1\|2` mede em 1x ou 2x (I1) |
| `vitrine-ui.mjs` | reescrita (F0; cenas das parcelas) | interface com o render falso e a simulação falsa ou real, nos 4 tamanhos, com as medidas da UI (alvos, texto, contraste, transbordo, área do HUD, travessão, unidades) |
| `cidade-sintetica.mjs` | nova (F0) | espelho sintético **gerado pelas APIs** (`addAresta` do `grafo.js`, `alocar()` das tabelas e um substituto de crescimento que põe o prédio de frente para a célula): 4 x 4 km, ruas e avenidas com curvas, cerca de 12 mil prédios de todas as zonas e níveis em lotes geminados (seis bairros cheios; a várzea, a lagoa e o pé dos morros a oeste ficam sem ruas), mata, mar, rio, a Torre; roda os invariantes do espelho; também `?sintetica=1` no navegador |
| `mapa.mjs` | nova (S1a) | PNG do mapa autoral sem navegador; confere que a área inicial é um componente só de terra; `--assar` roda a erosão e grava `sim/mundo/relevo-assado.js` (arquivo gerado: assar de novo ao mudar o relevo, a costa, o rio, as lagoas, os córregos, a planície ou a rodovia do mapa, ou a conta do assador), `--conferir-assado` confere que ele sai igual |
| `codificar-texturas.mjs` | nova (R2a) | CC0 (PNG ou JPEG de 1K) para KTX2 com o codificador Basis em wasm, versão fixa; sem codificador confiável, WebP de 1K com teto de memória |
| `sonda-gpu.mjs` | promovida (R1a) | limites, extensões e tempo de compilação de cada programa; a mesma sonda roda na página de teste da prévia |
| `robo/robo-sim.mjs` | nova (S3a) | a estratégia do robô pelo mesmo `cmd()`; relatório de marcos, moradores, bem-estar, renda, caixa, dívida, fila da frota, objetivos, ms por tique (p95, p99 e máximo) |
| `robo-navegador.js` | nova (C1) | fumaça pela UI até o tique 1.800, com teto de tempo real; exporta livro, hash e velocidade efetiva |
| `aceite-cor.mjs` | nova (C1) | saturação média do quadro e fração de verde-lima **dentro da máscara de gramado e telhado** (`?passe=mascara`); calibrada em 3 a 5 fotos aéreas reais |
| `cap-obra.mjs`, `conexoes.mjs`, `teste-faixa.mjs`, `teste-planta.mjs`, `vitrine.mjs`, `robo-partida.js` | saem para `antigo/ferramentas/` na F0 | eram do jogo atual |

### 3.3 O que é apagado e quando

1. **F0:** `git mv fonte antigo/fonte`, `git mv arte antigo/arte` e as ferramentas do jogo atual para
   `antigo/ferramentas/`. `app/` e `arcologia-de-held.html` ficam intocados (o dono continua jogando o atual).
   `.claude/agents/*` passam a apontar para a estrutura nova; a skill `verificar-e-publicar` ganha o fluxo novo. Tag
   `jogo-antigo` no último commit dele.
2. **Durante o M1:** ninguém edita `antigo/`, `app/` nem `arcologia-de-held.html`. As prévias e o M1a saem em
   `previa/`, montados só pelo integrador.
3. **Publicação do M1 (C2):** `app/` e `arcologia-de-held.html` atuais vão para `jogo-antigo/` com o `sw.js` trocado
   para apagar só caches `held-` (edição por script, conferida no Chromium); `montar.mjs --saida app` gera o jogo novo
   em `app/` e `arcologia-de-held.html`; `antigo/` e `previa/` são apagados no mesmo commit de fonte; README, VISAO e as
   skills `capturas-de-aceite` e `novo-predio-da-cidade` são reescritos.

---

## 4. M1: "Heldópolis nasce" (M1a e M1b)

### 4.1 O que o dono vê e faz

- Abre o jogo no Poco X7: carga em até 8 s, "Toque para entrar", menu com a capa do último save e "Onde você parou".
- Nova partida: nome e cor da Holding (no M1b também o Modo livre). Um voo de 8 s no fim da tarde sobre a baía, a Vila
  de Santa Cida na foz do rio, a rodovia com carros e o fantasma da Arcologia no platô (no M1b, **abertura de 40 s, se
  couber**).
- Vê uma costa brasileira em escala real: morros de granito com Mata Atlântica, praia com espuma, rio turvo, terra
  roxa, céu com nuvens, neblina que azula a distância, sol que corre o ciclo em 10 min e uma noite de janelas e postes.
- Traça avenidas e ruas com os polegares (mira acima do dedo, lupa, encaixe com vibração, alça para curvar), pinta
  quadras com um toque, vê casas e prédios subirem em obra com grua e andaime, sobem de nível, às vezes abandonam.
- Resolve avisos sobre os prédios (sem água, sem energia, sem trabalhadores, sem material), liga as camadas, põe
  serviços que têm cara de megaprojeto (hospital da Rede Sarah, escola de CEU, usina de CopenHill).
- Monta a produção da Holding com lote de 10 e Auto, vê os caminhões, abastece a cidade, vende no Depósito, toma
  empréstimo sem nunca zerar o caixa por descuido (o jogo avisa antes).
- Leva a Arcologia do reservatório à Torre Lâmina pronta, com o helicóptero da Holding pousando a 330 m; no M1b, iates e
  um cruzeiro na baía, jatinhos no céu e esportivos nas avenidas.
- Decide no Conselho, passa do marco 0 ao 7 em 5 a 7 h de jogo em 1x (menos em 4x), sempre com 3 objetivos abertos.

**Primeira hora (1x; o robô confere o ritmo):**

| Minuto | O que acontece | Sistema | Interface |
|---|---|---|---|
| 0:00 a 1:10 | carga, nova partida, voo de 8 s | mapa, render | carga, nova partida, legendas |
| 1:10 | Íris: "a primeira avenida liga a rodovia à gleba"; traçado sugerido | vias | objetivo da cidade, dica da via |
| 3 | decisão `vila.agua` (Dona Cida e Tomé): captação no rio acima da Vila ou reservatório `lago.e1` (D52) | história, redes | modal de decisão |
| 5 | melhorar as ruas de terra da Vila e pôr a usina solar; a Vila recebe água e energia; bem-estar passa de 30 e a tarifa sobe de 5 para 8 | vias, redes | avisos sobre a Vila, camada de água |
| 12 | Preencher quadras de residencial e comercial baixa; as primeiras casas sobem; **marco 1** (10 a 15 min) | zonas, marcos | dica do Preencher; momento do marco |
| 20 | Tomé: Escritório de Obra, Pedreira e Areal com lote de 10 e Auto; caminhões | Holding | folha da empresa |
| 25 | `lago.e1` (se não foi a escolha do minuto 3) ou a Olaria; Lívia sugere o empréstimo se o caixa apertar | Arcologia, economia | Livro da Arcologia, Economia |
| 35 a 50 | clínica e escola: com saúde e educação o bem-estar passa de 61 e a tarifa sobe de 8 para 11; **marco 2** | serviços | camada de serviços, margem na barra |
| 40 a 50 | `lago.e1` pronta: voo de câmera; portões ligados; vias internas no grafo; água para 6 mil | Arcologia | momento da etapa |
| 50 a 60 | primeira venda no Depósito; segundo dilema; primeira licença de área (o ladrilho do calcário ou a orla) | Depósito, história | modal de decisão |
| 40 a 70 | **marco 3** abre `torre.e1` e a Concreteira; obras de nível 3 a 5 passam a depender da Holding (D48) | marcos, Holding | momento do marco, aviso da dependência |

### 4.2 Escopo

**M1a, núcleo (não se corta):**

- Mapa autoral com Vila, rodovia e nó de entrada; área inicial de 4 x 4 numa margem do rio; ladrilhos por licença;
  áreas nomeadas.
- Vias: `rua`, `ruaMao`, `avenida`, `avenidaG`, `terra` (da Vila) e `rodovia` (do mapa); reta, curva, contínua, grade,
  melhorar, demolir, desfazer, encaixe; aplainamento puro e comutativo; células e pincel.
- 4 zonas com demanda, nascimento, níveis 1 a 5 e abandono; cidadãos estatísticos com estudo, empregos e bem-estar
  (D50); indústria com demanda por acesso à rodovia e mão de obra básica ociosa.
- 8 serviços: captação, poço, usina solar, praça, clínica, escola fundamental, delegacia, bombeiros. Água e energia
  pela via com racionamento; energia externa pelo nó de entrada (D52).
- Economia com as regras do dono, caixa nunca negativo (D41), orçamento e empréstimo.
- Holding: Escritório de Obra (com o primeiro armazém), Pedreira, Areal, Olaria e Concreteira (cimento importado até o
  M1b); lotes de 1 a 10 começando em 10 com Auto; estoque, reserva, abastecimento da cidade (D48), Depósito,
  importação, frota (D47), compra de tempo nas linhas.
- Arcologia no plano escolhido: `lago.e1` e `torre.e1..e4` com efeitos (D49), fantasma com as silhuetas LOD1, obra por
  fases com grua de 360 m, helicóptero da Holding.
- Marcos 0 a 7 (o 7 pede `torre.e4`), XP pela D51; Ato 1 com 3 decisões; 3 objetivos abertos e "Onde você parou".
- Pausa, 1x, 2x, 4x; save completo com diário.
- Render: céu, sol, AgX, neblina de altura, sombra própria de perto, sombra de longe e HAO, AO por vértice, MSAA, terreno
  CDLOD com camadas e mata em copa, mar, rio e lagoa, vias com cruzamentos e marcas, prédios das 4 zonas em 5 níveis com
  LOD0, LOD1, anexos, lote e noite, colocáveis com modelo próprio, 3 espécies de árvore, obra com corte e grua, Torre
  Lâmina, carros pela heurística, gente e caminhões, câmera à CS2 com seleção, 6 camadas, marcadores, ferramentas
  desenhadas no mundo, bancada, perfis Ultra, Alta, Média e Leve.
- UI: barra de cima, construção, bandeja, ferramentas, seleção, telas Holding, Economia, Cidade, Progresso e Conselho,
  Livro da Arcologia, configurações com Teste de desempenho, carga, menu, nova partida, salvar e carregar, primeira
  hora, sons de interface.

**M1b, núcleo (não se corta):**

- Trânsito agregado no worker com efeitos (D37); ponte simples (D53).
- Esgoto separado e os outros 6 serviços: ETE, termelétrica, escola de ensino médio, parque, hospital, parque da orla.
- Residencial alta, comercial alta e escritório; mercadoria agregada (a indústria zoneada abastece o comércio, a falta
  é importada e aparece no painel de demanda).
- Mina de calcário e Cimenteira no ladrilho vizinho (a primeira licença abre a cadeia do cimento).
- Ato 1 completo (6 decisões); Influência e Legado com uso fixo (D55).
- As outras 7 camadas (13 no total) e a aba Problemas com "Ver na camada" e "Próximo".
- Vida de luxo só visual (D61) e Modo livre (D56).

**M1b, linha de corte (nesta ordem de sacrifício):** cadeia de alimentos para o comércio (Fazenda e Agroindústria);
poluição do ar e ruído (fica a perda de produtividade pela distância ao armazém); Mural (fica o texto do Conselho);
música generativa (ficam os efeitos); 3 espécies a mais (coqueiro, ipê, figueira); Vidraria, Manejo florestal e
Serraria (vidro, madeira e madeira serrada importados a 160%); mundo de fora de 32 km (fica mar e serra simples); modo
foto; e por último a abertura de 40 s (fica o voo de 8 s). Helicóptero, carros, gente, trânsito agregado, sombra de
longe e perfil Leve não estão na linha de corte.

**Fica fora do M1:** ônibus e outros modos, rotatórias, calçadão, lixo, faculdade, distritos com políticas (as áreas
nomeadas entram), orçamento por serviço, extensões de serviço, poluição do solo e da água, indústria especializada,
bens de consumo além da mercadoria e dos alimentos, rivais, câmara, clima, estações, desastres, terraplanagem, Sede e
Torres do Conselho (só fantasma), AO de tela, reflexo planar, interiores falsos, aeroporto, porto de carga,
helicópteros entre helipontos.

### 4.3 Critérios de aceite medidos

Cada critério diz em que parte vale (M1a, M1b ou os dois). As prévias usam os que já cabem.

| # | Critério | Como medir | Meta |
|---|---|---|---|
| A1 | Montagem | `node ferramentas/montar.mjs --saida app` | sem avisos; JS principal até 2,3 MB minificado (D91; era 1,6 MB pelo Poco X7) (o `jogo` e os pedaços que ele importa de saída; as cenas, a cidade sintética, a simulação falsa e o KTX2 vêm por `import()` e ficam fora); worker `tarefas` até 150 KB e `oficina` até 250 KB; texturas KTX2 até 8 MB; primeiro quadro da carga em HTML e CSS antes do JS; guarda de texto verde |
| A2 | Testes | `node ferramentas/simular.mjs --testes` | `testes ok`. **Regras do dono:** tarifa arredondada (30,4 dá 5; 30,5 dá 8; 60,4 dá 8; 60,5 dá 11); limite anual e dívida; 10% em um ano com erro abaixo de 0,1%; mora após 10 anos; Depósito a 150% do preço de catálogo, 100 por janela e virada; lote 0 e 11 recusados, lote de 10 leva 8 vezes o de 1; **caixa nunca negativo** (10 mil comandos aleatórios); **dívida igual à soma dos contratos**. **Economia e jogo:** demolir e reconstruir dá saldo negativo; robô que pula a Arcologia termina mais pobre; água, energia, praça e comércio dão bem-estar 60 ou menos, e com saúde e educação passa de 61; 20 mil moradores a 65 por 1 h dão de 600 a 1.200 de XP de bem-estar; cidade de nível 3 a 5 espera sem estoque e sem importação. **Mundo:** aplainar comutativo (A depois B igual a B depois A, bit a bit; salvar e carregar no meio; cava registrada); chão 5 cm abaixo da pista em toda a seção, com faixa plana de 8 m; área inicial num componente de terra. **Motor da simulação:** worker simulado com atraso aleatório dá o hash do Node; tabela que cresce no meio mantém o render de depuração certo; invariantes do espelho na sintética e no save do robô. **Render em Node:** juntas de cruzamento abaixo de 1 cm, sem NaN, LOD1 com a mesma caixa do LOD0, atributos quantizados com erro abaixo de 5 mm. **UI em Node:** gestos, formato das unidades (D42), glifos, contraste dos tokens; guarda de texto |
| A3 | Determinismo | `--determinismo` | hashes iguais em 3 pontos, depois de salvar e carregar, e depois de matar a página no meio de um save e reproduzir o diário |
| A4 | Ritmo e economia | `--robo --horas 12`, sem comprar tempo (e um segundo relatório com `--comprarTempo`) | marco 7 com `torre.e4` entre 5 e 7 h de jogo; 25 a 40 mil moradores; bem-estar médio 62 a 75; depois do marco 3, nunca mais de 1 mês abaixo de 61; marco 1 em 10 a 15 min e marco 3 em 40 a 70 min; seguindo os objetivos, o caixa não zera na primeira hora com no máximo um empréstimo; dívida sempre até 500 mil; até 50 mil tomados por ano; dívida em queda a partir do ano 3 e quitada antes do ano 6; vendas da Holding 15% a 35% das receitas no marco 5; sempre um objetivo aberto; atraso médio da frota até 20% do prazo de cada etapa; a partir de caixa 0 com saldo negativo, volta ao positivo em até 10 min de jogo só com ações do jogo; `erros []`. **M1b:** numa cidade de 25 mil, sem mexer nas vias, aparece ao menos um gargalo (v/c acima de 1) na ligação com a rodovia, e as ferramentas do M1 o resolvem |
| A5 | Tique | `--bancada` e o cenário do robô que constrói uma via a cada 10 tiques | com 30 mil moradores no Node: p95 até 1 ms, **p99 até 2 ms e máximo até 4 ms**; com 100 mil, p95 até 3 ms; memória até 48 MB |
| A6 | Orçamento gráfico | `node ferramentas/bancada.mjs` nas cenas `aberta`, `rua` e `horizonte` (esta também com `?semClip=1`), com a cidade sintética de 12 mil prédios **e** com `saves/m1-fim.held` do robô, com o sol andando | **pior quadro** de 120: Média até 300 chamadas e 900 mil triângulos (**alvo ~620 mil**), com os tetos por família da seção 4.8; Ultra até 1.500 e 5 milhões; Leve até 200 e 500 mil; memória de geometria no Média até 64 MB; nenhum programa acima da guarda do Mali (D44); `?cena=prova-sombra`: LOD0 sem projetar, LOD1 invisível projetando |
| A7 | Interface | `node ferramentas/vitrine-ui.mjs <pasta> todas 986x443,915x412,1376x768,1920x1080` | `sem erros de página`; alvos de 44 px no toque e 32 no PC; texto de 12 px ou mais; contraste 4,5:1 abaixo de 17 px; área do HUD até 15,5% (986 x 443) e 16,5% (915 x 412); faixa livre de 340 e 310 px; nenhum travessão, "Aluguel", "/dia" ou "dia"; taxas sempre em "/h" com a dica; nenhuma chave faltando |
| A8 | Robô no navegador | `testar.mjs --pasta previa ... robo-navegador.js` em segundo plano, qualidade Leve, teto de 15 min reais | fumaça pela UI até o tique 1.800 (30 min de jogo): marco 1, `erros []`, nenhuma linha `error:`, hash igual ao do Node com o mesmo livro; relatório com a velocidade efetiva. O marco 3 fica com o A4 e com o robô rápido da UI sobre o render falso |
| A9 | Cor e luz | `aceite-cor.mjs` nas 10 cenas do A10 | limites **calibrados antes em 3 a 5 fotos aéreas reais** de cidades do litoral brasileiro (se a foto real reprova, o critério está errado). Ponto de partida: saturação média do quadro de 0,15 a 0,40; verde-lima (matiz 68° a 95°, saturação acima de 0,55) abaixo de 2% **dentro da máscara de gramado e telhado**; nenhum albedo de textura acima de 0,80 |
| A10 | Capturas para o dono | **um conjunto de 11 imagens**: `aberta` (10h), `rua` (16h), `bairro` (9h), `horizonte` (17h30), `costa` (12h), `obra` (10h), `servicos` (15h), `camadas`, `ferramentas`, `noite` (21h), e a **prancha da Torre** (4 azimutes às 17h30 e 2 closes a 30 m: pódio e coroa), lado a lado com `a1-foto`, `b1-torre` e `m-alta-cidade` | Torre sem nenhuma faixa horizontal mais escura que o corpo e com a face lisa tratada; horizonte sem costura; nada de mesa, maquete ou tilt-shift; o dono aprova |
| A11 | Poco X7 | Teste de desempenho do dono (print) | Média com 30 qps ou mais e p95 até 40 ms em `aberta` e `rua`; UI até 1,5 ms em repouso e 3 ms com ferramenta; carga até 8 s na primeira vez e 4 s depois; nenhum programa falhando no link; o dono traça uma avenida com curva e zoneia duas quadras só com os polegares |

### 4.4 Parcelas, estimativa e portões

Uma **sessão** é uma rodada de agente que implementa e testa, do tamanho de uma parcela do Trevo (P3 a P10). As linhas
contam testes. Os números são estimativa do integrador, para o dono decidir nos portões; o custo real de cada onda é
relatado no fim dela.

| # | Parcela | Parte | Onda | Linhas | Sessões | Depende de |
|---|---|---|---|---|---|---|
| F0 | Fundação e contratos | M1a | 0 | 3.000 | 3 | nada |
| S1a | Mapa autoral e terreno | M1a | 1 | 1.500 | 2 | F0 |
| R1a | Motor, luz, sombra própria, câmera e sonda | M1a | 1 | 2.800 | 3 | F0 |
| R2a | Chão, mar e lagoa; A/B de materiais | M1a | 1 | 2.000 | 2 | F0 (S1a quando publicar) |
| R4a | Gerador de prédios, primeiro corte | M1a | 1 | 3.000 | 3 | F0 |
| X1a | Torre Lâmina e planos diretores (render) | M1a | 1 | 2.500 | 3 | F0 (R4a e S1a quando publicarem) |
| U1a | Pele da interface | M1a | 1 | 1.800 | 2 | F0 |
| I0 | Prévia 0 (integrador) | | 1 | | 1 | onda 1 |
| **Portão 1** | **o dono aprova a direção visual e escolhe o plano; o Poco X7 mede** | | | **~16,6 mil** | **19 (26%)** | |
| S1b | Rede viária, células e pincel | M1a | 2 | 3.200 | 3 | portão 1 |
| R1b | Entrada completa, sombra de longe, HAO e noite | M1a | 2 | 1.800 | 2 | R1a |
| R3a | Vias, cruzamentos e carros pela heurística | M1a | 2 | 2.800 | 3 | R1a, R2a |
| X2 | Ferramentas de construção | M1a | 2 | 3.000 | 3 | S1b, R1b, R3a (a parte pura desde o começo da onda) |
| I1 | Prévia 1 (integrador) | | 2 | | 1 | onda 2 |
| **Portão 2** | **o dono aprova a via no polegar e o desempenho com vias** | | | **~27,4 mil** | **31 (43%)** | |
| S2a | Cidade viva, núcleo | M1a | 3 | 3.000 | 3 | S1b |
| S3a | Economia, Holding e progresso, núcleo | M1a | 3 | 3.200 | 3 | F0 (agregados de S2a pelo substituto) |
| R2b | Vegetação, rio e mundo de fora | M1a | 3 | 1.800 | 2 | R2a |
| R3b | Gente, caminhões e fluxo | M1a | 3 | 1.500 | 2 | R3a |
| R4b | Obras, anexos, lote e noite | M1a | 3 | 2.000 | 2 | R4a |
| R5 | Prédios colocáveis | M1a | 3 | 2.000 | 2 | R4a |
| U1b | HUD, seleção e gestão | M1a | 3 | 3.000 | 3 | U1a |
| U2a | Sistema: save, diário, menus, configurações, Teste de desempenho, primeira hora | M1a | 3 | 2.800 | 3 | U1a |
| X1b | Arcologia jogável | M1a | 3 | 2.000 | 2 | X1a (S3a, U1b quando publicarem) |
| X3a | Camadas (6) e avisos | M1a | 3 | 1.800 | 2 | R2a, R3a, R4a |
| C1 | Calibração e publicação do M1a em `previa/` | M1a | 3 | 800 | 2 | onda 3 |
| **M1a** | **jogável; o dono joga e decide seguir** | | | **~51,3 mil** | **57 (79%)** | |
| S1c | Trânsito agregado com efeitos | M1b | 4 | 1.800 | 2 | M1a |
| S2b | Cidade completa (esgoto, poluição, 3 zonas, 6 serviços, mercadoria) | M1b | 4 | 2.500 | 3 | M1a |
| S3b | Ato 1 completo, cimento, Modo livre (e alimentos, se couber) | M1b | 4 | 1.800 | 2 | M1a |
| X4 | Ponte simples | M1b | 4 | 800 | 1 | M1a |
| R6 | Vida de luxo, horizonte e espécies | M1b | 4 | 1.500 | 2 | M1a |
| X3b | 7 camadas a mais e Problemas | M1b | 4 | 800 | 1 | S1c, S2b (substituto até lá) |
| U2b | Abertura, modo foto e som | M1b | 4 | 1.500 | 2 | M1a |
| C2 | Aceite, calibração e publicação do M1 | M1b | 4 | 800 | 2 | onda 4 |
| **M1** | **publicado em `app/`** | | | **~62,8 mil** | **72 (100%)** | |

Em cada portão o dono pode parar e ficar com o que já foi publicado, pedir mudança de direção (que custa só a onda
seguinte) ou seguir. O integrador relata, no fim de cada onda, as sessões gastas contra a estimativa.

### 4.5 Fichas das parcelas

Em toda ficha: **Arquivos** são os que só ela edita (seção 3.1); **Consome** e **Publica** falam dos contratos da
seção 2; **Testa sem as outras** diz qual substituto usa. Os textos de cada parcela vão em `ui/textos/<parcela>.js`.

#### F0. Fundação e contratos (onda 0; 3 sessões)
- **Arquivos:** raiz (`package.json`, `CLAUDE.md`, `docs/`, `antigo/` por `git mv`, tag `jogo-antigo`), `fonte/web/`,
  `fonte/app/{main,laco,controle}.js`, `fonte/comum/`, `fonte/contratos/`, os arquivos de F0 em `fonte/sim/`,
  `fonte/render/`, `fonte/ui/` e `ferramentas/` (seção 3.1), a primeira versão de `data/{vias,zonas,predios}.js` e de
  `data/arcologia-plano.js` (envelope da gleba no platô e a Torre da D27), e o esqueleto vazio dos outros arquivos.
- **Publica:** todos os contratos da seção 2 com JSDoc e exemplo, **com as convenções e os invariantes do espelho**;
  registros da simulação (`registrarTabela`, `registrarGrade`, `registrarJson`, `registrarSistema(periodo, fase, fn,
  fatias)`, `registrarComando`, `registrarConsulta`, `sim.custos`, `sim.colocaveis`, `sim.camadas`, `sim.avisos`,
  `sim.formas`, `sim.redes`, `sim.travessia`), do render (`registrarDominio`, `registrarCena`, `ganchos.definir` com
  `neblina`, `sombra`, `sombraLonge`, `hao`, `camada`, `noite`, `selecao`, `mascara`, `registrarTextura`,
  `registrarGeradorOficina`, `registrarSelecionavel`) e da UI (`registrarTextos`, `registrarGlifos`, `registrarSecao`,
  `registrarTela`, `registrarCenaVitrine`); substitutos do contrato interno (2.10); tabelas com `n`, dobra e
  `realocado`; diário com anel de 65.536, deduplicação e `tudo` por domínio; `grafo.js` (addNo, addAresta com Bézier,
  removerAresta, dividir, fundir, componentes, cortes pelo raio do nó); `caminhos.js` (Dijkstra de várias origens
  fatiado por trabalho e A*, a partir do `bench-sim.mjs`); `altura.js`; `tarefas.js` (entrada copiada, T + K, tique
  parado quando atrasa, refazer em fatias, worker simulado com atraso); `livro.js` (reprodução até um tique);
  `salvar/formato.js`; `render/depuracao.js`; `oficina.worker.js` despachante; `cidade-sintetica.mjs` pelas APIs;
  `sim-falsa.js`; `render-falso.js`; `montar.mjs`; `guarda-texto.mjs`; `bancada.mjs` com a guarda do Mali e o pior
  quadro; `ui/formato.js` com as unidades da D42; `ui/acoes.js` com Promise e id de comando; a versão de prova de
  `cenas/prova-sombra.js` (D43), que R1a herda.
- **Entrega:** `node ferramentas/montar.mjs` gera `previa/` que abre no Chromium com caixas sobre um chão plano, a barra
  de cima com créditos e data, e a velocidade funcionando; `simular.mjs --testes` roda `nucleo.teste.mjs` e
  `contratos.teste.mjs` (rng; tabela com `ger` e crescimento no meio; ida e volta do save com hash igual; comando entre
  tiques e reprodução do livro; worker simulado com atraso aleatório dando o hash do Node; guarda de texto; invariantes
  do espelho na cidade sintética; aplainar comutativo com formas de teste); `?cena=prova-sombra` mostra o LOD0 sem
  projetar e a caixa LOD1 invisível projetando, com `callsSombra` à parte; a bancada roda a guarda do Mali sobre os
  programas da depuração.
- **Testa sem as outras:** é a primeira. **Depende de:** nada. **Regra:** curta; regra de domínio fica como substituto.
- **Entregue em 27/09/2026** (F0-A, F0-B e F0-C, fechada na F0-R). Diferente do plano: as ferramentas das outras
  parcelas (`mapa`, `codificar-texturas`, `sonda-gpu`, `robo/robo-sim`, `robo-navegador`, `aceite-cor`) são esqueletos
  de linha de comando que só dizem a dona, sem `registrar()`, porque nenhum índice as importa; `ferramentas/saves/`,
  `ferramentas/vitrine/cenas/` e `arte/materiais/` nascem com as donas. Além de `nucleo` e `contratos`, os testes da F0
  são `casca`, `ferramentas` e `integracao` (simulação e render falsos contra os contratos). O espelho ganhou
  `nos.lig`, `arestas.arco`, `celulas.coluna` e `origem` nas grades (em `contratos/espelho.js`). A tag `jogo-antigo`
  fica para o commit do integrador.

#### S1a. Mapa autoral e terreno (onda 1; 2 sessões)
- **Arquivos:** `sim/mundo/*`, `data/mapa-heldopolis.js`, `ferramentas/mapa.mjs`, `ferramentas/testes/mundo.teste.mjs`,
  `ui/textos/s1.js`.
- **Consome:** tabelas, `grafo.js` (vias da Vila e rodovia), `altura.js`, `sim.formas`, o envelope de
  `arcologia-plano.js`.
- **Publica:** `espelho.terreno`, `floresta`, `recursos`, `ladrilhos`, `areas`; `aplainar(base, formas, retangulo)`
  puro e comutativo (D5); comando `ladrilho.comprar` (preço da D3); consultas `ladrilhos`, `sugestoes`; dados da camada
  Recursos.
- **Entrega:** mapa autoral (baía ao sul e a leste, morros de granito a norte e oeste, Rio Held como borda da área
  inicial, lagoa, platô entre a lagoa e a baía com o envelope da gleba, rodovia com ponte pronta e nó de entrada, Vila
  de Santa Cida na foz com ~60 prédios e 350 moradores, rua principal e ruas de `terra`; calcário, parte da várzea de
  argila e a orla nobre fora do 4 x 4; áreas nomeadas; sugestões da primeira hora); grade 1025² em até 150 ms no Node;
  `mapa.mjs` com PNG e o teste do componente único de terra.
- **Testa sem as outras:** Node; `mapa.mjs`; a vista de depuração da F0. **Depende de:** F0.
- **Entregue em 27/09/2026** (S1a, revisada). Publicou `espelho.terreno` (1025² a 8 m; o rio da borda norte até a
  foz, na linha da costa; 3 lagoas: Santa Cida e as duas marginais do meandro), `floresta`, `recursos` e a camada
  Recursos, `ladrilhos` e `areas`; `aplainar` puro e comutativo; `ladrilho.comprar`; `q.ladrilhos` e `q.sugestoes`.
  Diferente do plano: a forma fina dos maciços vem de erosão fluvial assada (`sim/mundo/erosao.js`, fora do pacote)
  e gravada em `sim/mundo/relevo-assado.js` (arquivo gerado, ~38 KB no pacote) por `node ferramentas/mapa.mjs
  --assar`. Quem mudar serras, morros, planaltos, costa, rio, lagoas, córregos, planície ou rodovia em
  `data/mapa-heldopolis.js`, ou a conta do assador (subindo `VERSAO_ASSADO`), assa de novo: o teste do mundo acusa
  pelo hash e reassa em memória. `rioEm` ganhou `v` (distância ao eixo liso da faixa de meandros): várzea é
  `v < varzea`, leito é `a < hw`; o fundo do vale sobe com o rio no curso de cima. Medido: grade em 93 a 170 ms de CPU
  aquecida (melhor de 6 abaixo de 150); fria, 0,6 a 0,7 s, e `criarSimulacao` fria 1,3 a 1,4 s no Node; Vila com 64
  prédios e 351 moradores; 17 testes. Pendente: medir a abertura no Poco X7 (no worker pode passar de 3 s); pães
  pequenos no mar com anel de paredão (virar morro ou perfil de ilha); as sugestões da primeira hora mudaram de lugar
  (pedreira em (-480, -558), areal em (-1000, -240), olaria em (-998, 80)); a S1b herda `rios[0].pontos` desde a borda
  norte (-2572, -4096) e a ponte da BR em x -1375 a -1225, z -1190.

#### R1a. Motor, luz, sombra própria, câmera e sonda (onda 1; 3 sessões)
- **Arquivos:** `render/motor/*` (a partir daqui), `render/ambiente/{astro,ceu,ibl,exposicao,neblina,sol,nuvens}.js`,
  `render/sombra/*`, `render/camera/{camera,entrada,raio}.js`, `render/materiais/biblioteca.js`,
  `shaders/{neblina,sombra,ceu,pos}.glsl.js`, `cenas/{aberta,horizonte,noite,estresse,prova-sombra}.js`,
  `ferramentas/sonda-gpu.mjs`.
- **Consome:** `espelho.tempo`, `alturaEm` (colisão da câmera até o campo da cidade de R1b), a cidade sintética.
- **Publica:** os ganchos comuns com nomes e uniformes estáveis; perfis e escolha automática (D33); `R.camera`,
  `R.entrada` básica (órbita, pinça, arrasto), `R.selecionar` pelo registro, `R.raio` (sobre `alturaEm`), `R.projetar`,
  `R.estado`, `R.stats` (todos os passes, famílias, pior quadro), `R.bancada` (com os programas), `R.capa`.
- **Entrega:** alvo HDR com MSAA, bloom por redução dupla, AgX, CAS, resolução dinâmica; astro pela latitude; céu `Sky`
  direto no PC e assado num cubo de 256 no Média, em duplo buffer, com o disco do sol e a lua analíticos no fundo;
  PMREM por 8 quadros-chave; exposição por hora com mínimo à noite; neblina de altura com perspectiva aérea; sombras de
  nuvem; **sombra própria (D43)** com o sol em degraus; câmera à CS2 (10 m a 9 km, 3° a 88°, inércia, colisão, voo);
  profundidade invertida com `EXT_clip_control` e **duas faixas de profundidade sem ela** (longe: céu, mundo de fora,
  terreno e LOD2 além de ~3 km com near 1.500 e far 60.000; depois limpa a profundidade e desenha o perto), forçadas por
  `?semClip=1`; **sonda de capacidades** (limites, extensões, tempo de compilação de cada programa); **cena de
  estresse** (HDR com MSAA 2x, neblina, sombra, fachada aproximada em tela cheia, 300 chamadas e 900 mil triângulos) com
  ms de GPU por `fenceSync` e `clientWaitSync`; página de teste mínima da prévia, com "Copiar resultado".
- **Testa sem as outras:** caixas e terreno sintético; `bancada.mjs`. **Depende de:** F0.
- **Entregue em 27/09/2026** (R1a, revisada). Publicou os ganchos `sombra` e `neblina` com os uniformes em
  `motor/ganchos.js`; perfis Ultra, Alta, Média e Leve com escolha automática (Mali-G6xx MC2 e Adreno 710 a 725 no
  Média; o SwiftShader cai no Leve, então as capturas de teste usam `?q=media`); `definirCamera` (órbita à CS2, 10 m a 9
  km, 3 a 88 graus, inércia, zoom com âncora, voo em arco), `definirEntrada` (arrasto com o chão sob o dedo, também no
  céu da rasante; pinça, giro, roda, teclado), `definirRaio` e `projetarNaTela` (em `camera/raio.js`); domínios `ceu`
  (astros, Preetham direto no PC e cubo 256 em duplo buffer no Média, PMREM por 8 quadros-chave, exposição, neblina de
  altura, sombra das nuvens), `entrada` e `bancada` (`ctx.bancada`: resolução travada, ms de GPU por cerca e consulta,
  programas contra a guarda do Mali; `?painel=1` é a página de teste com "Copiar resultado"); sombra própria D43 com
  `ctx.sombra.regiao`; HDR R11G11B10 com MSAA, bloom, AgX com look (potência 1,45, saturação 1,05), CAS, resolução
  dinâmica; duas faixas com `?semClip=1`; cenas `aberta`, `horizonte`, `noite`, `estresse` e `prova-sombra`;
  `ferramentas/sonda-gpu.mjs`. Medido na entrega (Média, 1280x720): aberta 41 chamadas e 252 mil triângulos; estresse
  284 e 897 mil; horizonte com semClip 52 e 553 mil. Na I0 o integrador ligou `R.bancada` a `ctx.bancada`, `R.projetar`
  a `projetarNaTela`, `R.descartar` ao quadro (resize e pós) e à entrada, e pôs os textos da página de teste em
  `ui/textos/r1.js`; bancada da Prévia 0 (1376x768, 120 quadros, sol andando, cidade sintética de 12.113 prédios):
  aberta no Média 42 chamadas e 235 mil triângulos no pior quadro (sombra 5 e 33 mil; prédios 137 mil de 240 mil), no
  Alta 51 e 444 mil (sombra 10 e 126 mil); estresse no Média 285 e 897 mil, no Alta 290 e 901 mil; guarda do Mali sem
  falha (29 programas na aberta); o ms do SwiftShader (~850 a 1.000 por quadro) não vale como medida de aparelho.
  Pendente para a R1b: `ctx.alturaCidade` na colisão da câmera (na I0 a câmera de uma vista do `bairro` caía dentro de
  uma torre), ganchos `sombraLonge`, `hao` e `noite` (hoje neutros), entrada completa (arbitragem de 80 ms, mira
  deslocada, borda), voo completo, inclinação mínima perto do chão; exportar o corte das faixas (a R4a repete a conta em
  `limiteFaixas`); luz de dia fria e chapada (pouco contraste entre face ao sol e à sombra); às 17h30 a neblina contra o
  sol deixa a mata a 3 a 5 km bege; para a prancha em luz dourada, a hora desce para perto das 18h.
- **Entregue em 28/09/2026 (PC1, perfil do PC do dono, D66, revisada).** Perfil `pc` em `motor/perfis.js`: 1080p nativo
  (teto de pixels de 1080p), MSAA 2x, sombra, céu, PMREM e LOD do Alta (`base: 'alta'`, lida pelos domínios com
  `porPerfil`), alvo de 60 qps, piso de 30 e teto de 60; tetos por família (800 chamadas, 2,5 milhões de triângulos,
  2,5 GB de vídeo, provisórios). Escolha automática por faixas de nome de placa (`escolherPerfil`, com o motivo): RX
  460 a 560, GTX 750 a 1050 e integradas boas (e placa de PC desconhecida) no `pc`; Alta e Ultra para as maiores;
  Intel HD e UHD no Média. Resolução dinâmica pelo cronômetro da placa (`ControleResolucao`, puro): mira 15,5 ms,
  degraus de 70% a 100% da nativa, desce direto ao degrau que cabe, sobe pela previsão com folga, trava a subida
  desfeita, CAS abaixo da nativa; o tempo de quadro fica para o Média e para quem não tem o cronômetro. Aquecimento em
  `motor/quadro.js` (`compileAsync` domínio por domínio no primeiro quadro e numa rodada final depois da carga;
  `ctx.quadro.aquecer` para o que ainda não está na cena) e o vigia conta cada programa ligado depois de pronto, com
  o bloqueio da thread. Página de teste: perfil e motivo, resolução interna em pixels, tempo de placa por passe (sombra,
  preparo, céu, terreno, água, prédios, vias, Arcologia, pós), memória de vídeo estimada pelo que o WebGL aloca,
  aquecimento e compilações depois de pronto, tudo no "Copiar resultado" (`?quadros=` troca os 120 quadros).
  `bancada.mjs` mede o `pc` por padrão, espera o aquecimento e avisa as compilações depois de pronto. No SwiftShader
  os números não valem: o de verdade vem da página de teste no PC do dono.
- **Entregue em 29/09/2026 (PC2, custo por pixel no PC do dono).** Céu do `pc` pelo cubo assado de 512 (duas fatias
  por quadro, sol, nuvens, horizonte, pôr do sol e noite iguais), desenhado na cena depois dos opacos (só onde nada
  cobriu). Terreno com nível de detalhe do sombreador: malha de longe separada (`TER_LONGE`, sem ruído, tufos, copas,
  manchas nem máscara; a troca vem pela distância e pelo tamanho do pixel, de 600 a 800 m no Alta e no `pc`), encostas
  íngremes sempre no caminho completo, manchas assadas no mapa de cor (4.096 no Alta e no `pc`) e o chão desenhado
  depois dos prédios e da água. Prédios com a fachada barata (`FAC_BARATA`) no LOD1 e no LOD2 e ordem da frente para
  trás por rumo da câmera (1,36 para 1,13 camadas por pixel). CAS pela ampliação (`forcaCas`: no dono, 3.840 sobre
  2.070, de 0 para 0,72, sem serrilhar). Resolução dinâmica conferida no jogo (teste: liga pelo cronômetro e segura
  15,5 ms). A/B às 10h, 17h30, bairro a 50 m e rua sem diferença visível (média até 1/255).

  | Passe | SwiftShader, aberta (ms) | Por pixel (ms) | Pixels sombreados | RX 550 (ms, estimado) |
  |---|---|---|---|---|
  | Céu | 210 para 87 (+19 da fatia) | 211 para 136 | aberta 0%, rua 11% | 5,05 para ~0,3 |
  | Terreno | 1.569 para 1.051 | 987 para 665 | 91,5% para 58,3% | 12,93 para ~5,5 |
  | Prédios | 1.822 para 1.757 | 658 para 609 | 1,36 para 1,13 camadas | 13,86 para 8 a 10,7 |
  | Cena inteira | 3.679 para 3.157 | 1.697 para 1.445 | | 35,5 para ~17 a 20 |

  A estimativa multiplica o tempo medido na RX 550 pelo ganho por pixel e pelos pixels a menos; o SwiftShader não
  descarta pelo teste de profundidade antes do sombreador nem pula ramo, então o ganho real deve ser maior. O resto até
  15 ms fica com a resolução dinâmica; o número de verdade vem da página de teste no PC do dono. Pendente: prédios
  ainda acima de 6 ms (passe só de profundidade, LOD dos ganchos na sombra, distância do LOD2).

  Revisão da PC2: a CAS filtrava o HDR linear e, sempre ligada, desenhava um anel preto em volta de cada luz da cidade
  à noite; agora filtra num espaço perceptivo (`composicaoPerceptiva` em `motor/pos.js`, a levar para `pos.glsl.js`),
  com a média da imagem igual à sem CAS. O primeiro cubo do céu saía antes do brilho da cidade medido (à noite, o céu
  ficava sem o laranja até a troca de cubo); um salto de hora ou de brilho refaz o cubo inteiro (`Ceu.refazer`). A
  reordenação das instâncias travava uns 20 ms de CPU a cada 22,5 graus de giro: agora é uma ordenação nativa por
  chave empacotada, com no máximo 6 mil instâncias por quadro.

#### R2a. Chão, mar e lagoa; A/B de materiais (onda 1; 2 sessões)
- **Arquivos:** `render/mundo/{terreno,agua}.js`, `render/geracao/ruido.js`, `render/materiais/texturas-chao.js`,
  `shaders/{terreno,agua,folha}.glsl.js`, `cenas/{costa,materiais}.js`, `arte/materiais/`, `arte/LICENCAS.md`,
  `ferramentas/codificar-texturas.mjs`, `ferramentas/testes/terreno.teste.mjs`.
- **Consome:** `espelho.terreno`, `floresta`, `celulas` e `predios` (máscara de uso do solo), ganchos de R1a
  (substituto sem efeito até R1a publicar).
- **Publica:** leitura do campo de camada no chão (gancho `camada`); **textura de células a 4 m** (R8, com a zona)
  mostrada no chão quando a ferramenta de zona abre; máscara de uso do solo, onde as vias de longe são pintadas; mapa de
  cor assado; gancho `mascara` do chão (gramado) para o aceite de cor.
- **Entrega:** CDLOD com **grade de 16 x 16 por nó** (512 triângulos) e alcances que mantêm o terreno em até 120 mil
  triângulos na cena aberta; `alturaEm` no GLSL igual à de `comum/altura.js` (teste de paridade em pontos sorteados);
  mapa de normais; camadas (grama tropical, capim seco, terra roxa, terra clara, granito, areia, folhiço, usos do lote)
  em duas versões, procedural e CC0 em KTX2, trocadas por `?materiais=proc|cc0` (D46); copa da mata no terreno; mar e
  lagoa com profundidade lida da grade, "refração" pelo mapa de cor e espuma simples; até 12 amostradores (D44).
- **Testa sem as outras:** cidade sintética e o mapa de S1a quando publicar. **Depende de:** F0.
- **Entregue em 27/09/2026** (R2a, revisada). Publicou, pelo registro: domínios `terreno` (CDLOD 16 x 16 por nó, uma
  chamada; na costa 86 nós e 44 mil triângulos) e `agua` (mar, rio e lagoa numa chamada); texturas `chao.ruido`,
  `chao.ondas` (espectro direcional de 128 componentes), `chao.camadas` e `chao.cc0`; `ctx.chao` (uniformes, malha,
  `usoSolo` 2048² a 4 m, `materiais()`, `ab()`, `fora()`, `copaPerto()` para a R2b, `reassar()`); sobreposições no
  chão sem chamada extra pelos eventos `camadas`, `ferramenta.zona` (células a 4 m), `ferramenta.ladrilhos`,
  `ferramenta.pincel` e `ferramenta.limpar`; mapa de cor assado; `?materiais=proc|cc0|ab` e `?passe=mascara`; cenas
  `costa` (paridade da altura do GLSL com `alturaEm`: 0,27 mm em 64 pontos) e `materiais` (A/B com a divisa). Arte:
  `arte/materiais/chao-camadas.ktx2` (8 fatias de 1024 em ETC1S, 3,1 MB), `fontes.json` com sha256 e
  `arte/LICENCAS.md`; `ferramentas/codificar-texturas.mjs` com ktx2-encoder 0.6.0 (nas devDependencies desde a I0,
  que também passou a levar o transcodificador Basis do three para `<saída>/basis/`). Guarda do Mali: terreno com 10
  amostradores no fragmento (11 com o A/B), água com 9. Medido (Média): costa 33 chamadas e 93 mil triângulos;
  materiais 33 e 66 mil; 24 testes. Pendente: os 8 CC0 vieram de espelhos no GitHub (conferir na ambientCG e na Poly
  Haven quando houver rede); pontos escuros de 1 a 3 px na ponta dos dedos de pedra do costão; a faixa média do chão
  vai até 1,2 a 2 km no Média (baixar `copaRelevo` para ~900 m se o Poco X7 não der); as vias pintadas no uso do solo
  alargam o asfalto ~2 m (a R3a apaga a pintura perto); a R2b troca jundu, moitas e copa pintados por árvores com
  `copaPerto`, liga espuma e correnteza do rio e desliga a moldura com `fora(false)`; o rio de 18 a 30 m na grade de
  8 m serrilha nas encostas em V (borda úmida); o mar raso em volta das ilhas é lido em resolução grossa; a água do rio
  sai cinza.

#### R4a. Gerador de prédios, primeiro corte (onda 1; 3 sessões)
- **Arquivos:** `render/geracao/{planoPredio,malhaPredio,fundir,quantizar}.js`,
  `render/mundo/{predios,setores,oficina,instancias}.js`, `render/materiais/texturas-predio.js`,
  `shaders/fachada.glsl.js`, `data/estilos.js`, `cenas/bairro.js`, `ferramentas/testes/geracao-predios.teste.mjs`.
- **Consome:** `espelho.predios`, `celulas`, `data/predios.js` (planta e andares), ganchos de R1a,
  `registrarGeradorOficina('setor')`.
- **Publica:** material `edificio` (fachada no shader) com variantes LOD0 e LOD1, usado por X1a e R5; tabela de prédios
  na GPU (RGBA 512²: camada, flags, agenda) e a RGBA32F de obra; caixas LOD1 cujos buffers de instância a
  sombra própria de R1a compartilha; gerador de setor na oficina; gancho `mascara` dos telhados; `registrarSelecionavel
  ('predio')`.
- **Entrega:** plano (gramática por zona e nível, tipologias brasileiras da seção 5.1 do desenho do render) para as 7
  zonas, porque a cidade sintética tem todas e o dono julga o horizonte na Prévia 0; malha LOD0 fundida por setor no
  worker com **atributos quantizados** e cópia JS solta depois do envio; LOD1 e LOD2 como instâncias de forma com a
  mesma silhueta; fachada filtrada por `fwidth`, vidro com normal inclinada por painel, desgaste e mapa de detalhe
  fotográfico (A/B da D46); cache LRU de 12 a 16 setores no Média; teto de memória de geometria (64 MB no Média).
- **Testa sem as outras:** lotes da cidade sintética. **Depende de:** F0.
- **Entregue em 27/09/2026** (R4a, revisada). Publicou o material `edificio` (`criarMaterialEdificio`,
  `uniformesEdificio`) com variantes LOD0 fundida e LOD1 instanciada; a tabela de prédios na GPU (RGBA8 512²) e a de
  obra (RGBA32F 512²) em `ctx.dominio('predios').tabela` e `.obra`; caixas LOD1 que a sombra própria compartilha;
  geradores `setor` e `anexo` na oficina (`fundir.js`); `gMascaraTelhado` (`?passe=mascara`);
  `registrarSelecionavel('predios')`; `limiteFaixas`, `sombraAlcanca` e `faixaDaCaixa` em `mundo/predios.js`
  (projetores pela `ctx.sombra.regiao` varridos pelo sol; com `?semClip=1`, listas por faixa pela profundidade no eixo
  da câmera); janelas nas medidas das plantas brasileiras e agenda da noite (moradia até 42%, escritório 9% depois das
  20h30); paleta de reboco mais quente em `data/estilos.js`; cena `bairro` com `?vista=` rua, 50, 200, lod1, lod2,
  torres, escritorios, industria e orla. Medido (Média): aberta 42 chamadas e 251 mil triângulos (prédios 141 mil de
  240 mil); bairro 44 e 100 mil; lod1 17 e 184 mil (12.410 instâncias); lod2 com semClip 24 e 330 mil; 0 pixels pretos
  depois da correção do kA; programa `edificio` com 5 amostradores, 7 varyings e 66 uniformes; 11 testes. Na I0 a
  cidade sintética passou a lotes geminados em seis bairros cheios, e a vista `200` do `bairro` virou para a guinada
  75 (na 20 a câmera caía dentro de uma lâmina de escritórios). Pendente para a R4b: o lote inteiro (piso, muro,
  árvores, carros), a obra por fases e o anexo do setor (ANEXO_REFUSAO de 5 s, fila medida em 4x); janela de fundo da
  loja térrea alta demais (1,9 m); conferir com a R3a a sombra dos prédios no chão da vista `rua`.

#### X1a. Torre Lâmina e planos diretores, render (onda 1; 3 sessões)
- **Arquivos:** `render/arcologia/{torre,planos,partes,lago,fantasma}.js`, `cenas/{torre,planos}.js`,
  `data/arcologia-plano.js` (detalhe da Torre e os três planos), `ferramentas/testes/arcologia-render.teste.mjs`.
- **Consome:** material `edificio` de R4a (substituto `MeshStandardMaterial` até lá), `alturaEm` e o relevo de S1a
  (substituto: o relevo da sintética), ganchos de R1a.
- **Publica:** a Torre (LOD0 por perfil e LOD1), as silhuetas LOD1 das partes (Sede com Torres do Conselho, Anel,
  Biblioteca, Vida, Escola, Universidade, Física), os três planos como dados (posição, orientação, contornos, portões
  candidatos, cava do reservatório como forma), o fantasma, `registrarSelecionavel('arcologia')`.
- **Entrega:** Torre Lâmina da D27 completa, de dia e de noite (lanterna, andares de vento acesos, aro do heliponto);
  prancha de 4 azimutes e 2 closes que passa no critério de silhueta da D27; os três planos da D59 em escala real no
  relevo do platô, cada um com uma captura aérea oblíqua às 17h30; orçamento: LOD0 da Torre de 12 a 20 mil triângulos
  no Média e de 40 a 80 mil no Alta e no Ultra, LOD1 de 3 a 5 mil, a Arcologia inteira em LOD1 perto de 25 mil, até 45
  chamadas no Média.
- **Testa sem as outras:** cenas `torre` e `planos` com a sintética. **Depende de:** F0.
- **Entregue em 27/09/2026** (X1a, revisada). Publicou o domínio `arcologia` com a Torre Lâmina da D27 (LOD0 com
  12.104 triângulos no Média e 40 a 80 mil no Alta e no Ultra; LOD1 com 3.116; volume de sombra com 104), as silhuetas
  LOD1 das partes (Sede com as Torres do Conselho, Anel com juntas de vidro, Biblioteca, Vida com Supertrees, Escola,
  Universidade, Física, pódio e barragem), o reservatório com a cava, o fantasma em holograma champanhe,
  `registrarSelecionavel('arcologia')` (idx pela `PARTES_ORDEM`), `dominio('arcologia').vitrine({ modo, plano })` e
  `torre.corte(h)`; em `data/arcologia-plano.js`: `TORRE_LAMINA`, `HELIPONTO_LOCAL`, `PLANOS.A/B/C`, `PARTES_ORDEM`,
  `PLANO_PADRAO` 'A', `TORRE_POSICAO` e `POUSO` provisórios, `CAMERA_ARCOLOGIA` e `cavaDoPlano(id)`; a classe de luz
  `LUZ.reflexo`; a noite pelo `ctx.sol.dia` da cidade; cenas `torre` (`?prancha=1`, `__cenaTorre.prancha({ hora })`
  e `.foto()`) e `planos` (`?plano=A|B|C`, `__cenaPlanos.mostrar()`). Usa materiais próprios (`arcologia:vidro` e
  `arcologia:opaco`), não o `edificio` da R4a. Medido (Média): torre 39 chamadas e 131 mil triângulos; planos 35 e 106
  mil; Arcologia em LOD1: A 23,1 mil, B 20,4 mil e C 17,2 mil; 24 testes. Pendente: o integrador grava o plano
  escolhido no portão 1; a X1b registra `cavaDoPlano` em `sim.formas` e usa `torre.corte(h)` e `POUSO`; árvores em
  tufo de icosaedro até as espécies da R2b; reservatórios do A e do C leem como piscina (borda irregular, à
  Barangaroo); parques em tapete de borda dura; cobertura solar da Sede listrada de perto; monograma H ilegível;
  Supertrees à noite como funis claros; `CeuReserva` e `AmbienteReserva` inertes (tirar); na vista aberta das 21h o
  fantasma do plano estoura em bege sobre a cidade escura (baixar a emissão dele à noite).
- **Entregue em 28/09/2026** (SEDE2, D63 a D66, revisada). O plano A virou a sede v2 em `data/arcologia-plano.js` (a mesma
  gleba; portões norte em x 250, oeste e leste; o anel viário de 18 m em três arcos e as avenidas; os eixos e a posição
  de cada parte) e a Torre saiu de `especTorre(altura)`: `TORRE_LAMINA` de 500 m e `TORRE_IRMA` de 452 m pelo mesmo
  gerador, `GEMEAS` e `torresGemeas()` (fenda de 10 m no eixo norte-sul, as faces lisas para a fenda, as lâminas
  espelhadas para fora), `TORRE_POSICAO` e `POUSO` na Lâmina, `CAMERA_ARCOLOGIA` nova e `cavaDoPlano('A')` com o lago
  circular, a ilha, o poço e a escada d'água num polígono só. No render: o par com a ponte a 45 m, a cachoeira nas duas
  bordas, os dutos com a água subindo atrás do véu, a névoa e a espuma (material `arcologia:cascata`); a Sede em anel de
  481 por 358 m, 4 andares em 30 m, marquises brancas (geometria no LOD0, shader no LOD1), cobertura solar e os quatro
  pórticos de 40 por 18 m; o lago de 270 m com a ilha em degraus, a margem natural, o poço e a escada d'água; as fontes
  em arco instanciadas (`arcologia:jato`, coreografia no vértice, acesas à noite); a cúpula de 240 por 80 m com a malha
  diagonal (barras no LOD0, shader no LOD1) e a floresta em terraços vista pelo vidro (`arcologia:claro`); a moradia em
  arcos contínuos, a Biblioteca, a Escola, a Universidade e a Física reposicionadas; o LOD das partes pela distância ao
  centro. O soluço de 166 ms era o reflexo de reserva: punha um envMap no vidro enquanto a luz do ambiente não existia e
  o tirava no quadro seguinte (programa novo); saiu com o `CeuReserva`. Os materiais da Arcologia são agora um conjunto
  fixo criado na carga, nada muda de programa entre dia, noite, LOD e fantasma, e `criarAquecimento` desenha cada um nos
  primeiros quadros (0 compilações depois de pronto nas cenas). Medido (Alta): as torres em LOD0 com 60 e 55 mil
  triângulos, a Arcologia de perto 170 mil e na vista aberta 28 mil (construída) e 23 mil (fantasma do jogo); 33 testes.
  Cenas: `torre` (prancha do par) e `planos` com `?vista=aerea|eixo|mar|noite` e `?olhar=`. Pendente (integrador): o
  contrato da Torre em `contratos.teste.mjs` (301, 238, 163, 330, 350), o portão norte em `vias.teste.mjs` (x 240) e o
  tráfego da sintética, que muda com o anel em volta da `TORRE_POSICAO`. Na revisão: a avenida do portão leste entra
  pelo vão entre a moradia e o eixo leste (atravessava o arco de 320 a 338 graus), as caixas de seleção da Sede seguem
  o anel (as de um quarto cobriam o lago), os jatos soltam o InstancedMesh ao remontar, a cachoeira e os jatos numa
  passada só, a pedra portuguesa na escala real e a vista `mar` no eixo; 35 testes.

#### U1a. Pele da interface (onda 1; 2 sessões)
- **Arquivos:** `ui/comp/*`, `ui/glifos/glifos.js` (a partir daqui), `ui/hud/BarraCima.jsx`, `ui/selecao/Cartao.jsx`,
  `ui/telas/Economia.jsx`, `ui/tema/{componentes,hud,folha,telas}.css`, `ui/textos/u1.js`,
  `ferramentas/vitrine/cenas/u1.js`, `ferramentas/testes/ui.teste.mjs`.
- **Consome:** `q.barra`, `q.predio`, `q.orcamento`, `q.emprestimo` (pela `sim-falsa`); `ui/formato.js`.
- **Publica:** primitivas e o sistema de glifos para as outras parcelas de UI; `?ui=vitrine`, que põe a pele sobre a
  cena `aberta` na prévia.
- **Entrega:** tokens, tipografia e o primeiro corte de ~60 glifos; barra de cima (créditos, saldo em "/h" com a dica,
  população, bem-estar com a margem até o degrau, "Mês · Ano", fase do sol, velocidade); cartão de prédio residencial e
  de serviço; tela Economia (orçamento com a linha da regra "Contribuição: 12.480 x 11 = 137.280/h", empréstimo com as
  regras escritas, caixa, "não pago"); vitrine nos 4 tamanhos.
- **Testa sem as outras:** `sim-falsa.js` e `render-falso.js`. **Depende de:** F0.
- **Entregue em 27/09/2026** (U1a, revisada). Publicou 19 primitivas em `ui/comp` (Interruptor, Segmentado,
  Deslizante, Quantidade de 1 a 10, DoisToques, Barra, Chip, Linha, Tabela, Abas, Popover e Ancora, Dica, Folha, Tela
  e Secao, Modal, Aviso, Vazio, Grafico em SVG, Indicador) e `botaoDoPasso` (o toque no limite avisa por
  `loja.avisar`); 148 glifos de traço 1,75 (`glifoBemEstar`, `registrarGlifos`); a barra de cima em
  `registrarHud('cima')`, que aperta em 4 níveis no PC; o cartão em `registrarHud('folha')` (residencial, serviço
  pelo tipo do catálogo com `categoriaServico`, obra e Holding) com `registrarAcaoAviso` e `folhaAberta`; a tela
  `economia` (Orçamento com a linha da regra e os 12 meses, Empréstimo com as regras de `REGRAS_DONO`); Esc fecha só a
  camada de cima; textos `u1`; 16 cenas `u1-*` na vitrine; 13 testes. Medido: HUD em repouso com 8,4% da tela a
  986x443 e 8,8% a 915x412. Na I0 o integrador aplicou o patch da `sim-falsa` (saldo igual a receitas menos
  despesas, 134.280/h; juros por hora; serviços pelo tipo) e marca `data-vidro='1'` no PC em Alta e Ultra
  (`app/controle.js`). Pendente: glifos `pedestre` e `seguir` (M2); com `q.predio` nulo na primeira leitura o render
  destaca sem cartão (decidir na U1b); a U1b troca o menu provisório pela tela `menu`, registra as seções (o botão
  Detalhes aparece) e as telas Holding, Cidade, Progresso e Conselho; o aviso do limite só aparece com
  `hud/Avisos.jsx`.

#### S1b. Rede viária, células e pincel (onda 2; 3 sessões)
- **Arquivos:** `sim/vias/{ferramenta,encaixe,validar,demolir,nomes}.js`, `sim/zonas/{blocos,pincel}.js`,
  `data/vias.js` (a partir daqui), `ferramentas/testes/{vias,celulas}.teste.mjs`; herda os de S1a.
- **Consome:** grafo, tabelas, caminhos, `alturaEm`, `aplainar` e `sim.formas`, `sim.custos`, `sim.progresso`
  (substituto), a gleba, os portões e as vias internas do plano escolhido em `arcologia-plano.js`.
- **Publica:** `espelho.vias`, `celulas`; comandos `via.*` e `zona.pintar`; consultas `via.previa`, `zona.previa` (o
  `efeitoMedia` vem de uma função de S2a, com substituto 0), `aresta`, `viasPerto`; formas das vias no aplainar; custo
  das vias; `sim.travessia` consultado em `validar()` (sem registro, trecho sobre água é recusado com `agua`).
- **Entrega:** ferramenta pura com encaixe (D18) em até 1 ms; divisão em cruzamento, ângulo mínimo de 30°, raio mínimo,
  declive por tipo, água, gleba e ladrilho; custo `comprimento x custo por m x (1 + 2 x declive médio)` mais
  demolições; "melhorar" de `terra` para `rua`; desfazer (D32); blocos e células de 8 m com 6 de fundo e as regras de
  esquina; pincel (quadra, círculo, retângulo); o teste do chão 5 cm abaixo da pista em toda a seção.
- **Testa sem as outras:** Node; a vista de depuração. **Depende de:** portão 1.
- **Entregue em 28/09/2026** (S1b). Publicou `q.via.previa` (reta, curva, contínua, grade, melhorar e demolir),
  `via.construir`, `via.melhorar`, `via.demolir`, `via.desfazer`, `zona.pintar`, `q.zona.previa` (a S2a liga o
  `efeitoMedia` por `registrarEfeitoMedia` de `sim/zonas/pincel.js`), `q.aresta`, `q.viasPerto`, o custo `vias` em
  `sim.custos`, as formas das vias no aplainar e as colunas próprias `arestas.fase`, `arestas.nomeVia` e
  `celulas.motivo`. Diferente do plano: a pista é plana nos patamares dos cruzamentos (raio do nó + 8 m, mais com via
  em ângulo agudo, até as pistas se separarem) e linear entre eles (`pistaDaAresta` em `sim/mundo/aplainar.js`); nas
  dobras côncavas do greide a forma rebaixa o chão, porque a grade bilinear de 8 m passa até 2 vezes a mudança de
  declive acima da dobra; o patamar cede ao declive do tipo e o cruzamento que ficaria desnivelado mais de 10 cm é
  recusado com `declive`. Os cruzamentos saem da polilinha dos eixos (a subdivisão das cúbicas travava com vias quase
  paralelas). As colunas das células seguem a fase da aresta (dividir não mexe nelas) e a via nova alinha as dela com
  as linhas da primeira via que cruza; a via antiga fora desse passo deixa um recorte de meia célula na faixa de 4 m da
  esquina. O começo sobre outra via anda até 4 m para o passo das células dela (o T fecha a esquina sem vão). A prévia
  avisa também o prédio da coluna de células que o nó novo corta; desfazer a melhoria ou a demolição recusa com
  `ocupado` se nasceu prédio ali depois. Vila: as casas das ruas de terra 1 m mais recuadas (66 prédios, 355
  moradores) e a plataforma até 0,3 m abaixo do chão da rua. Medido: encaixe p95 0,06 ms; prévia p50 0,22 e p95 0,5 ms
  na cidade sintética (1.121 arestas, 125 mil células, 12 mil prédios) e numa rede de 3.120 arestas; grade 2 x 2 em
  1,2 ms; `via.construir` na rede grande p50 16 ms; chão de 5,9 a 47 cm abaixo da pista nas 121 arestas do teste; 18
  testes em `vias` e `celulas`. Pendente:
  o `jogo` montado passa do teto do A1 (1.813 KB; a S1b soma uns 75 KB); a bancada do tique (A5) passa da meta na
  primeira `via.construir` (índices dos prédios e das células, uns 17 ms, e o JIT) e em coletas de 4 ms; encaixar o
  traço no passo de 8 m da via que ele cruza, para fechar também esse recorte; o cruzamento a menos do patamar de um nó
  de greide é recusado com `declive` até na planície (3 a 13% das posições ao longo de ruas com 2 a 3% de declive).
  Na I1 o integrador ajustou o contrato ao que a S1b faz: `via.melhorar` e `via.demolir` com `sessao`, `via.desfazer`
  com `creditos` e `q.via.previa` com os modos `melhorar` e `demolir` e os campos a mais (2.5 e 2.6, `contratos/`). A
  bancada do tique mede a `via.construir` à parte, entre os tiques (D17), depois de uma obra que monta os índices
  preguiçosos da sintética: A5 dentro (tique p99 0,15 ms e máximo 0,8 ms; obra p50 0,12 ms e máximo 2,2 ms; a primeira,
  com os índices, 22 ms).

#### R1b. Entrada completa, sombra de longe, HAO e noite (onda 2; 2 sessões)
- **Arquivos:** `render/ambiente/{campoAlturas,sombraLonge,luzNoite}.js`; herda os de R1a.
- **Consome:** a grade `alturasCidade` da oficina (caixas LOD1 de R4a rasterizadas), o mapa de luz da rua (R3a).
- **Publica:** ganchos `sombraLonge`, `hao` e `noite` completos; `R.entrada` completo (modos da UI, `aoFerramenta`,
  deslocamento da mira, rolagem pela borda, arbitragem em 80 ms); `R.voo`.
- **Entrega:** campo de alturas da cidade pela grade da oficina (`texSubImage2D`), com a colisão da câmera na mesma
  grade na CPU; sombra de longe em 16 ladrilhos com o sol em degraus de 3° e mistura; HAO; noite (exposição mínima,
  brilho da cidade, estrelas, lua); custo em regime medido em 1x e 4x.
- **Testa sem as outras:** sintética e a bancada. **Depende de:** R1a.
- **Entregue em 28/09/2026** (R1b). Publicou os ganchos `sombraLonge`, `hao` e `noite` completos em `motor/ganchos.js`
  (uniformes `gCampo*`, `gHaoParams`, `gLuzRuaMapa`, `gLuzRuaParams`, `gNoiteParams`, `gNoiteJanelas`);
  `ctx.alturaCidade(x, z)` e `ctx.campoAlturas` (grade da CPU a 8 m no Média e no Leve e a 4 m no Alta e no Ultra,
  pelas peças LOD1 do `planoPredio` da R4a por setor e pelos volumes da Arcologia na cena de sombra, com o nível 1 de
  uma pirâmide de máximos, subida por `texSubImage2D` só nos retângulos sujos; o gerador `alturasCidade` fica
  registrado para a oficina); `ctx.quadro.antes` (passes dos domínios antes da cena, contados em `R.stats`; a R3a já
  usa); `R.entrada` completo (`modo`, `aoFerramenta` com a mira 56 px acima do dedo e o ponto do chão, `opcoes` com
  `deslocY` de 0 a 72, `bordaPx`, `bordaMouse` e `area`; árbitro de 80 ms que não deixa a pinça riscar a via; segundo
  dedo e troca de modo cancelam a ferramenta; toque curto e longo; dois dedos que inclinam ou aproximam sem trocar no
  meio; cursor parado do mouse; teclado); `R.voo` pelo caminho ótimo de van Wijk e Nuij (`caminhoVoo`); colisão da
  câmera pela grade da CPU, subindo a vista pela órbita com bissecção (`inclinacaoEfetiva`; a inclinação mínima perto
  do chão é essa). Sombra de longe: campo RGBA16F (R e G a altura da sombra em dois degraus de 3 graus misturados pela
  hora, B a visibilidade do céu, A o chão), 16 ladrilhos por degrau; a marcha lê o campo no fim e no meio de cada passo
  e, nos passos longos, a célula do nível 1: na cidade sintética às 17h30 fica a 1% da marcha fina de 2 m (a pirâmide
  inteira engordava a sombra em 18% do bairro) e acha a torre de 8 m a 400 m; GPU e CPU batem a 0,12%. HAO no chão e no
  pé das paredes. Noite: o mapa de luz da rua da R3a (sem ela, o substituto pelas arestas) suavizado numa textura de
  1.024² (as poças emendam na rua, sem colar de contas), a luz até a altura da lâmpada (telhado escuro), a luz das
  janelas no chão pela oclusão e o brilho da cidade pelo número de postes. Luz: exposição da hora dourada medida pela
  fachada ao sol (`solMedida` 0,42), luz do céu com saturação 0,4 (a sombra deixa de sair azul), cenas fixas no
  equinócio (`?dia=` troca). Medido na bancada (1376x768, 120 quadros, sol andando em 4x, cidade sintética): aberta no
  Média 52 chamadas e 214 mil triângulos no pior quadro, no Alta 68 e 423 mil; noite no Média 52 e 214 mil, no Alta 56
  e 425 mil; guarda do Mali sem falha. Custo em regime: um ladrilho por quadro (uma chamada; 65.536 texels no Média,
  262.144 no Alta; até 143 leituras por texel com o sol baixo e de 37 a 87 com ele entre 25 e 60 graus, porque a marcha
  para quando o maior da região não subiria mais a sombra, com o mesmo resultado) em 16 quadros por degrau; em 1x
  (degrau de 5 s) sem atraso (60 quadros: no máximo 1 por quadro); em 4x (1,25 s), com quadros mais lentos que o sol,
  até 4 por quadro no ritmo da hora (no SwiftShader a 5 quadros por degrau: no máximo 4 num quadro e 1 atraso em 10
  trocas); prédios que nascem longe um do outro no mesmo quadro refazem retângulos separados; na CPU, zero sem mudança,
  1 ms por prédio novo, 210 ms na carga da cidade de 12 mil prédios no Média (380 ms no Alta). Testes em
  `ferramentas/testes/luz-e-entrada.teste.mjs`.
  Pendente: o ms de GPU no Poco X7 (`?painel=1`); a cor do LED da R3a (0,86; 0,86; 0,82, uns 5.500 K, contra 4.000 K
  do desenho 2.9) e a parte de sódio (45% das quadras) deixam a rua mais branca que laranja na vista aberta; o campo na
  carga pelo worker `oficina` (o índice dele ainda não inclui o módulo); `R.voo` com duração pela distância.
  Na I1: o worker `oficina` registra o `campoAlturas`, e o domínio manda o ladrilho de cada setor para ele quando o
  worker existe (vale só a resposta do último pedido do setor e de antes de uma troca de qualidade; `preparar()` segue
  na hora); `ctx.THREE` do domínio é o subconjunto `THREE_TEXTURAS`; `R.voo` dura pelo comprimento S do caminho (0,8 a
  4,5 s); `bancada.mjs --vel 1|2|4`.

#### R3a. Vias, cruzamentos e carros pela heurística (onda 2; 3 sessões)
- **Arquivos:** `render/geracao/{perfilVia,malhaVia,cruzamento,veiculos}.js`, `render/mundo/{vias,luzRua,props,trafego}.js`,
  `render/materiais/texturas-via.js`, `shaders/via.glsl.js`, `cenas/rua.js`, `ferramentas/testes/geracao-vias.teste.mjs`.
- **Consome:** `espelho.vias`, `data/vias.js` (perfis), `alturaEm`, `registrarGeradorOficina('vias')`.
- **Publica:** `gerarMalhaVia(aresta, perfil)` pura (usada pela prévia de X2); textura de dados por aresta indexada pelo
  `aId` (camadas); mapa de luz da rua; `registrarSelecionavel('aresta')`.
- **Entrega:** varredura do perfil sobre `alturaEm` com saia de 1 m; cruzamentos com recorte, arcos de meio-fio, faixas
  de pedestre e teste de juntas; asfalto e marcas no shader (com o detalhe CC0 se aprovado); postes, árvores de rua e
  semáforos instanciados; malha só até o alcance do perfil e, além dele, a via pintada na máscara do terreno, com viés
  de profundidade proporcional à distância na faixa de troca; carros (6 modelos, frota brasileira, faróis) pela
  heurística por tipo de via, hora e zonas vizinhas; tetos por perfil (Média 120 carros).
- **Testa sem as outras:** grafo da cidade sintética. **Depende de:** R1a, R2a.
- **Entregue em 28/09/2026** (R3a). Publicou `gerarMalhaVia(aresta, perfil, { alturaEm })` pura (a X2 usa na prévia),
  os domínios `vias` (setores de 256 m pela oficina, tipo `vias`, até o alcance do perfil: Média 560 m; tabela RGBA8
  256² por `aId` com camada, realce e desgaste; `registrarSelecionavel('aresta')`), `luzRua` (`ctx.luzRua` no formato
  do gancho `noite` da R1b: textura, origem, tam, ganho 4 e brilho), `props` (postes urbano, duplo e rural, semáforos,
  oiti e palmeira-imperial em dois LODs) e `trafego` (6 modelos da frota com faróis e freio, heurística por tipo, hora
  e zonas, semáforo de 40 s igual ao do shader, Média 120 carros andando e 160 parados). Perfis da D22 com meio-fio de
  15 cm, abaulamento, sarjeta e marcas do CTB; cruzamentos com recorte, arco de meio-fio (raio nunca abaixo da calçada
  mais 0,5 m), zebra e retenção; retorno redondo na ponta; a pintura da via no chão da R2a some perto da câmera por um
  gancho no material (`ctx.chao`). Medido (Média, cena `rua`): rasante 54 a 71 chamadas, 259 mil triângulos, vias 24
  mil; vista de 300 m 47 a 63 chamadas e 185 mil; guarda do Mali ok (a `via` usa 8 amostradores e 7 varyings); a
  cidade sintética inteira tem 270 mil triângulos de via em 190 setores (pior setor 5 mil, 3 a 12 ms). 18 testes.
  Revisão: faróis assentados no bico (antes ficavam dentro da carroceria) e acesos também no LOD1; fila pelo
  comprimento do carro e entrada na faixa só com lugar; retorno na ponta da rua (a rodovia sai do mapa); retenção a
  1,6 m da faixa de pedestres; folíolos recortados na palmeira; o gerador do setor sem relógio.
  Pendente: `R.selecionado(ref)` não diz o domínio (o realce da aresta existe, mas fica desligado); o JS montado passou
  do teto de 1,6 MB com a onda 2 inteira; a calçada de pedra portuguesa depende da área `orla` do mapa.
  Na I1 o integrador achou os "pilares claros" da vista rasante: eram da R3a. Em `mundo/props.js` três chamadas de
  `cone(x, z, y0, y1)` recebiam a altura no lugar do z, e cada palmeira-imperial plantava um segundo estipe a 7,65 m e
  o palmito a 17 m dela, do chão para cima, girados com a instância (um caía na faixa, a 1 m do meio-fio); a copa ganhava
  um galho solto a 3 m. Corrigido, com teste (a árvore cabe na coroa). O LED da luz da rua foi para ~4.000 K (1,0; 0,80;
  0,62; o forte, 1,0; 0,82; 0,65), como no desenho 2.9. `R.selecionado` aceita `{ tipo, ref }` e o render emite
  `selecao` com o domínio: o realce da aresta pode ligar (bit G da tabela), pendente para a R3b.

#### X2. Ferramentas de construção de ponta a ponta (onda 2; 3 sessões)
- **Arquivos:** `ui/ferramentas/*`, `ui/hud/{Construcao,Bandeja,BarraFerramenta}.jsx`, `ui/mundo/{Lupa,Cotas}.jsx`,
  `ui/tema/mundo.css`, `ui/textos/x2.js`, `render/sobreposicoes/ferramentas.js`, `cenas/ferramentas.js`,
  `ferramentas/testes/ui-ferramentas.teste.mjs`, `ferramentas/vitrine/cenas/x2.js`.
- **Consome:** `q.via.previa`, `q.zona.previa`, `q.construir.previa`, `q.catalogo`, `q.viasPerto`, `q.ladrilhos`;
  comandos `via.*`, `zona.pintar`, `construir`, `demolir`, `ladrilho.comprar` (por `acoes.js`, com Promise e id);
  `R.entrada`, `R.raio`, `R.projetar`; `gerarMalhaVia` de R3a (substituto: fita plana).
- **Publica:** `R.ferramenta.*` implementado; máquinas de estado puras.
- **Entrega:** barra de construção e bandeja com cartões e cadeados; ferramenta de via (mirando A, prévia com alças,
  curva pela alça do meio, contínua, grade, melhorar, demolir, desfazer), mira 56 px acima do dedo, lupa esquemática em
  canvas 2D, chips de encaixe com vibração, cotas, rolagem pela borda; zonas (Preencher, pincel P, M e G, retângulo,
  apagar) com a zona no chão pela textura de células e **instâncias só num raio de 400 m da mira** (até 8 mil células)
  para a grade nítida; colocar com fantasma grudado na frente da via e círculo de alcance; demolir com contorno e dois
  toques para a Holding; Áreas (grade de ladrilhos com preço e desconto da Influência); teclado do PC.
- **Testa sem as outras:** as máquinas em Node com sequências de ponteiros; a vitrine com a simulação falsa. **Depende
  de:** F0; a parte pura começa com a onda 2 e a integração quando S1b, R1b e R3a publicarem.
- **Entregue em 28/09/2026** (X2). Publicou o domínio `ferramentas` do render (`R.ferramenta.via`, `zona`, `celulas`,
  `pincel`, `fantasma`, `demolir`, `limpar`): a prévia da via pela `gerarMalhaVia` da R3a (a fita plana fica de
  substituto), células de 8 m instanciadas só num raio de 400 m da mira (até 8 mil), fantasma com círculo de alcance e
  contorno de demolir, de 1 a 4 chamadas. Máquinas puras em `ui/ferramentas` (via com mirando A, alças, curva pela alça
  do meio, Reta, Curva, Contínua, Grade e Melhorar; zona com Preencher, Pincel P, M e G, Retângulo e Apagar; colocar
  grudado na frente da via; demolir com dois toques para a Holding; Áreas com preço e desconto) e a sessão que as liga
  a `R.entrada.aoFerramenta` (mira 56 px acima do dedo), às consultas `q.via.previa`, `q.zona.previa`,
  `q.construir.previa` e `q.viasPerto` (com planejador, pincel e encaixe locais quando a consulta falta; a barra diz
  "estimado"), aos comandos por `acoes.js`, ao Desfazer de 10 ações, à vibração, à rolagem pela borda e ao teclado do
  PC (Enter, Esc, Ctrl+Z, Shift, vírgula e ponto). Contrato para as outras telas: `loja.ferramenta.value = { tipo,
  ... }` abre a ferramenta e `null` fecha. HUD: barra de construção, bandeja com cartões e cadeados, barra da
  ferramenta; no mundo, lupa esquemática em canvas 2D (foge da cota) e cotas, alças, chips de encaixe e os preços das
  Áreas sem sobreposição. Textos `x2`, 41 testes, 13 cenas `x2-*` na vitrine e a cena `ferramentas` (sintética, com
  `ui=1` traçando pela entrada). Com a S1b, `q.via.previa` responde no mesmo formato (conferido em Node na sintética).
  Pendente: o jogo montado passa do teto A1 (1.798 KB contra 1.638; a X2 soma cerca de 85 KB); a sintética das cenas
  roda sem os domínios, então a prévia ali é a local.
  Na I1: `ui/acoes.js` devolve o id do comando em `idComando` e deixa o `Resposta.id` do contrato (a ref criada)
  intacto; `refCriada()` continua lendo `id`, `ref` ou `dados.ref` e o teste do Colocar cobre o `id`. A barra de
  construção (`hud/Construcao.jsx`) some sob as telas de gestão: pelo vidro da tela Economia ela aparecia por baixo, e a
  vitrine acusava a sobreposição em 16 cenas da U1a (a cena `u1-primitivas` marca a tela dela como aberta).

#### S2a. Cidade viva, núcleo (onda 3; 3 sessões)
- **Arquivos:** `sim/zonas/{demanda,crescimento}.js`, `sim/{predios,cidadaos,bemestar,servicos,redes}.js`,
  `data/{zonas,predios,servicos}.js` (a partir daqui),
  `ferramentas/testes/{zonas,crescimento,servicos,redes,bemestar}.teste.mjs`, `ui/textos/s2.js`.
- **Consome:** `celulas` e grafo (S1b), caminhos fatiados, terreno, `sim.holding.comprarParaObra` (substituto),
  `sim.progresso`, `sim.formas` (plataformas).
- **Publica:** `espelho.predios`, `grades.valor`; `S.agregados`; comandos `construir` (serviços), `demolir` (D54),
  `predio.cor`, `predio.nome`; consultas `construir.previa`, `predio`, `demanda`, `cidade`, `catalogo` e o efeito de
  uma pintura na média (para `q.zona.previa`); dados das camadas Zonas, Bem-estar, Água, Energia, Serviços, Valor e
  Nível; avisos de prédio; custos dos serviços e da energia externa; `sim.redes.produtor`.
- **Entrega:** 4 zonas (D23); demanda com fatores (indústria: acesso à rodovia e mão de obra básica ociosa);
  nascimento até 3 por tique e 60 obras; níveis 1 a 5 com requisitos; abandono em minutos de jogo (D42); cidadãos com 4
  níveis de estudo e mercado de trabalho; bem-estar da D50 por prédio, média suavizada e arredondada (D11) e `'predio'`
  pronto; 8 serviços com Dijkstra fatiado e atualização incremental; água e energia por componente com racionamento
  pelos mais distantes; energia externa pelo nó de entrada (D52); valor do terreno.
- **Testa sem as outras:** grafo de teste pela API da F0; dinheiro pelo substituto. **Depende de:** S1b.
- **Entregue em 02/10/2026** (S2a, revisada; onda 3, etapa 1). Zonas como registro extensível (4 no M1a, 3 no M1b),
  demanda R/C/I/E com fatores, nascimento de frente para a via, níveis, abandono da D42, cidadãos, bem-estar, serviços,
  redes (energia da rodovia só pelo nó de entrada, até 5 MW; nenhuma água de fora, D52) e valor do terreno em grade de
  32 m; camadas zonas, nivel, bemEstar, agua, energia, servicos e valor; D76 nos andares (residencial média de 3 a 6 no
  nível 1 a 12 a 25 no 5). Tique na sintética de 2.591 prédios: p95 2,41 ms; `--bancada` com 158 mil moradores: p95
  3,82 ms. Fora do contrato escrito (aceitos pelo integrador): `sim.cidade` (efeito, remover, lista), agregados
  `bemEstarSuave`, `bemEstarTarifa` e `empregos.taxa`, `q.avisosPredios().nomes`, `q.demanda().ativas`, `custoDemolir` e
  `semRede` na prévia. Pendências: cobertura dos serviços ainda síncrona (fatiar), -3 do sobrequalificado (7.3), consumo
  menor nos níveis altos (6.6), calibração do começo (Vila sem água nem energia, demanda perto de 0) para a C1. Nota
  completa em `docs/entregas/onda3/S2a.md`.

#### S3a. Economia, Holding e progresso, núcleo (onda 3; 3 sessões)
- **Arquivos:** `sim/{economia,progresso,objetivos,historia}.js`, `sim/holding/*`,
  `data/{economia,holding,marcos,historia,nomes,objetivos}.js`, `ferramentas/robo/robo-sim.mjs`,
  `ferramentas/testes/{regras-dono,economia,holding,progresso,objetivos}.teste.mjs`, `ui/textos/s3.js`.
- **Consome:** `S.agregados`, `sim.custos`, `sim.colocaveis`, caminhos (A* dos caminhões), `sim.holding.efeito` (X1b).
- **Publica:** as implementações de `sim.holding.*` e `sim.progresso.*`; `REGRAS_DONO` congelado (seção 12.1 do
  desenho da simulação, com `tarifaPor: 'cidade'`, o arredondamento e o preço base escrito); comandos de linha,
  estoque, abastecimento da cidade, Depósito, importação, empréstimo, acelerar, decisão e identidade; consultas
  `orcamento`, `emprestimo`, `deposito`, `producao`, `holding`, `marcos`, `objetivos`, `retomar`, `decisoes`, `mural`;
  os números de `q.barra` que são dela; eventos; `espelho.entregas`; o robô em Node.
- **Entrega:** receitas e despesas por hora de jogo com **o caixa nunca negativo** e a ordem de pagamento (D41);
  empréstimo idêntico ao de hoje; mercado da cidade (D48), Depósito (150%, 100 por janela de 4 h), importação a 160%;
  Escritório de Obra e os 4 prédios de produção do M1a com custo (Escritório de Obra 15 mil, Pedreira 12 mil, Areal 8
  mil, Olaria 15 mil, Concreteira 30 mil; calibrar); linhas com lote de 1 a 10 começando em 10 com Auto e sugestão de
  lote (D57); produtividade pela ocupação e pela distância ao armazém; frota (D47); compra de tempo nas linhas (D13);
  XP e marcos (D51) com o requisito do marco 7; licenças; Influência e Legado com efeito (D55); Ato 1 com 3 decisões
  (`vila.agua` no marco 0 e mais duas); 3 objetivos abertos e "Onde você parou" (D58); série mensal; caixa inicial de
  300 mil (calibrar); robô que joga pelo `cmd()` e relata ritmo, caixa, fila da frota, objetivos e o tique (p95, p99 e
  máximo), com o cenário de uma via a cada 10 tiques.
- **Testa sem as outras:** cidade de faz de conta pelos agregados; os testes das regras do dono não dependem de nada.
  **Depende de:** F0.
- **Entregue em 02/10/2026** (S3a, revisada; onda 3, etapa 1). `sim.holding` (caixa nunca negativo com livro-caixa,
  comprarParaObra pela D48, entregar com a frota da D47, efeito) e `sim.progresso` de verdade; comandos de linha,
  estoque, depósito, importação, empréstimo, decisão e identidade; consultas de orçamento, depósito, produção, holding,
  marcos, objetivos, retomar, decisões e mural; os 5 prédios da Holding do M1a; história do M1a com data (vila.agua no
  minuto 3, Febre Aurora em mar. 2020, Bloqueio do Canal de Seshat em mar. 2021); marco 7 pede torre.e4; robô
  `ferramentas/robo/robo-sim.mjs`. Acréscimos ao contrato: `sim.holding.registrarChegada`, `folha`, `ocupados`,
  `estoque`, o objeto `sim.economia`, `nLote` na linha e `fluxoCaixaHora` no orçamento. Pendências para a C1: ritmo dos
  marcos e do empréstimo no robô fora das metas, preços em dólar acima do mercado (proposta na nota), reserva padrão da
  próxima etapa da Arcologia (depende da X1b), frota somada por Escritório. Nota completa em
  `docs/entregas/onda3/S3a.md`.

#### R2b. Vegetação, rio e horizonte simples (onda 3; 2 sessões)
- **Arquivos:** `render/mundo/{fora,vegetacao}.js`, `render/geracao/{arvores,impostor}.js`,
  `ferramentas/testes/geracao-arvores.teste.mjs`; herda os de R2a.
- **Consome:** `espelho.floresta`, `terreno`, `celulas` e `predios` (árvores de lote), `registrarGeradorOficina('arvores')`.
- **Publica:** árvores de perto como projetores da sombra própria.
- **Entrega:** 3 espécies (palmeira-imperial, oiti, mata com embaúba) com LOD0, LOD1 e impostor num atlas só; rio com
  correnteza e espuma; mundo de fora simples (mar e serra); tetos por perfil.
- **Testa sem as outras:** sintética. **Depende de:** R2a.
- **Entregue em 02/10/2026** (R2b, revisada; onda 3, etapa 1). Domínios 'vegetacao' e 'fora', atlas de folhas na
  GPU e 7 espécies (palmeira-imperial, oiti, três de Mata Atlântica, embaúba e moita) em LOD0, LOD1 e impostor;
  `ctx.vegetacao` e `ctx.chao.vegetacaoPerto`; rio turvo nas coordenadas dele, com plumas, espuma e pedras; água em dois
  programas (mar e rio); mapa de cor do Alta e do pc de 85,3 para 42,7 MiB; manchas escuras dos morros e mar raso das
  ilhas resolvidos. Pendências: copas ralas na média distância e custo da mata a medir no PC do dono antes de mexer;
  margem do rio em degraus na vista aberta (R2a); faixa entre o anel de fora e a moldura do CDLOD com a câmera baixa.
  Nota completa em `docs/entregas/onda3/R2b.md`.

#### R3b. Gente, caminhões e fluxo (onda 3; 2 sessões)
- **Arquivos:** `render/geracao/pessoas.js`, `render/mundo/{pedestres,caminhoes}.js`, `shaders/pessoa.glsl.js`; herda
  os de R3a.
- **Consome:** `espelho.predios` (atividade), `entregas`, `fluxos` quando existir (M1b).
- **Entrega:** gente pela atividade dos prédios ao longo da via, com caminhada no vértice; caminhões da Holding pelo
  `caminho` das entregas (as do teto e as amostras visuais); carros pelo fluxo quando `fluxos` existir e pela
  heurística antes; tetos por perfil (Média 120 carros e 420 pessoas).
- **Testa sem as outras:** sintética com entregas e fluxos sintéticos. **Depende de:** R3a.
- **Herda da I1 (pendências da R3a):** prioridade entre os braços do cruzamento (sem ela, 4 carros se cruzam dentro do
  cruzamento em 300 s, em curvas de braços diferentes); ligar o realce da aresta selecionada (bit G da tabela) pelo
  evento `selecao` do render, que já leva `{ tipo, ref }`.
- **Entregue em 03/10/2026** (R3b, revisada; onda 3, etapa 3, retomada depois da pausa). Tráfego com fila de
  velocidade segura (corrige o carro dentro de carro do teste 14 da geracao-vias), reserva no nó com ordem de chegada,
  principal na frente e bolsão para quem vira à esquerda; gente pela atividade dos prédios e pela hora, com caminhada no
  vértice (braço contra a perna), 5 tons de pele e roupas variadas, atravessando só na faixa; caminhões da Holding pelo
  caminho da entrega, com 4 carrocerias pela carga e a cabine na cor da Holding; realce da aresta selecionada. CPU no
  Alta/'pc' às 18h: tráfego 0,58 ms e gente 0,47 ms (acima do 0,5 ms somado do desenho: medir no PC do dono). Integrador:
  'pedestres' e 'caminhoes' no aquecimento. Pendências: cabine do caminhão lisa e figura de gente low-poly (o dono julga),
  traseira dos carros da R3a refletindo o sol baixo como bloco claro, `geracao/pessoas.js` no worker da oficina só por um
  registrar vazio (C1), +38,8 KB no JS principal. Nota completa em `docs/entregas/onda3/R3b.md`.

#### R4b. Obras, anexos, lote e noite (onda 3; 2 sessões)
- **Arquivos:** `render/mundo/{obras,anexos,lotes}.js`, `cenas/obra.js`; herda os de R4a.
- **Consome:** `predios.obraIni`, `obraFim`, `flags`; o diário.
- **Entrega:** obra em 5 fases com esqueleto, grua, andaime e corte no vértice pelo uniforme de tique e `frac` sobre a
  textura de início e fim; **anexo do setor** (D39) com refusão depois de 5 s sem mudança; lote inteiro (piso, muro,
  árvores, carros parados); abandonado, selecionado e cor da Holding; janelas por agenda à noite; medida na cena
  `bairro` com crescimento sintético em 4x: fila da oficina e ms de envio por quadro (meta: fila que esvazia e até 3 ms
  de envio no pior quadro).
- **Testa sem as outras:** sintética com obras sintéticas. **Depende de:** R4a.
- **Entregue em 02/10/2026** (R4b, revisada; onda 3, etapa 1). Obra em 5 fases na GPU (corte da fachada pelo
  `gTique` sobre a textura de obra, agora **RGBA32F** com início, fim, cota da base e altura), canteiro, esqueleto, grua
  de torre que sobe com o prédio, tela e andaime; anexo do setor (D39) sem buraco nem cópia dupla; lote vestido (árvores,
  vagas, carros); abandonado, cor da Holding por bit e janelas por agenda; `alturaObra(i, H)` para a R5. **A meta de 6 ms
  dos prédios de longe não foi atingida** (estimativa da RX 550 de 7,4 a 9,9 ms; os ganchos somam uns 30% e o resto é a
  fachada): fica para a bancada no PC do dono. Pendências: cor da Holding nos caixilhos (70%) contra o desenho 5.5
  (decidir com o dono), árvores do lote com a copa facetada das ruas (trocar pelas da R2b), primeira montagem de 200
  obras de 7 a 8 ms com o JIT frio. Nota completa em `docs/entregas/onda3/R4b.md`.

#### R5. Prédios colocáveis (onda 3; 2 sessões)
- **Arquivos:** `render/colocaveis/*`, `data/colocaveis.js`, `cenas/servicos.js`,
  `ferramentas/testes/geracao-colocaveis.teste.mjs`.
- **Consome:** material `edificio` e a fusão por setor de R4a (`registrarGeradorOficina('colocavel')`), os tipos de
  `data/servicos.js` e `data/holding.js`.
- **Publica:** um gerador por tipo, com LOD0 e LOD1; `registrarSelecionavel('colocavel')`.
- **Entrega:** a tabela abaixo, com a referência escrita na ficha de cada prédio (a UI mostra "inspirado em ..."). Os
  modelos do M1b e da linha de corte entram aqui também, porque custam pouco perto do resto e deixam o M1b só com a
  simulação.

| Tipo | Modelo | Referência real | LOD0 Média / Ultra | LOD1 |
|---|---|---|---|---|
| captação | tomada d'água com comportas, passarela e teto verde na margem | Marina Barrage (Singapura) | 3 mil / 8 mil | 300 |
| poço | casa de bombas com cobogó e caixa d'água em torre | torres d'água modernistas brasileiras | 1,5 mil / 4 mil | 150 |
| usina solar | campo de painéis com rastreadores (instanciados) e prédio de controle | complexo solar de Pirapora (MG); prédio de controle de Noor Ouarzazate | 4 mil / 10 mil | 200 |
| praça | pedra portuguesa em ondas, bancos e ipês | calçadão de Copacabana (Burle Marx) | 2 mil / 5 mil | 100 |
| clínica | pavilhão baixo com sheds curvos e jardim interno | Rede Sarah (Lelé) | 3 mil / 8 mil | 250 |
| escola fundamental | bloco didático longo sobre pilotis, quadra coberta e caixa d'água em torre | CEU de São Paulo | 4 mil / 10 mil | 300 |
| delegacia | lâmina sobre pilotis com brise-soleil | Palácio Capanema (Rio) | 3 mil / 8 mil | 250 |
| bombeiros | volumes em cunha de concreto com marquise em balanço | Vitra Fire Station (Zaha Hadid) | 3 mil / 8 mil | 250 |
| ETE (M1b) | ovos digestores de aço e tanques redondos | Newtown Creek (Nova York) | 5 mil / 12 mil | 400 |
| termelétrica (M1b) | caixa de alumínio em degraus com rampa verde no teto e chaminé | CopenHill (Copenhague) | 5 mil / 12 mil | 400 |
| escola de ensino médio (M1b) | dois blocos com passarela e pátio coberto | CEU com os blocos da FDE | 5 mil / 12 mil | 400 |
| parque (M1b) | marquise sinuosa, lago e gramado | marquise do Ibirapuera (Niemeyer) | 4 mil / 10 mil | 300 |
| hospital (M1b) | pódio de atendimento com sheds, jardim no meio e bloco de internação | Rede Sarah com o sanduíche de funções do Kampung Admiralty | 8 mil / 20 mil | 600 |
| parque da orla (M1b) | aterro com jardins, palmeiras e pedra portuguesa | Aterro do Flamengo (Burle Marx) | 6 mil / 15 mil | 400 |
| Escritório de Obra | canteiro de megaprojeto: contêineres empilhados, grua e galpão-armazém | canteiros de Hudson Yards | 3 mil / 8 mil | 250 |
| Pedreira | cava de granito em bancadas, britador e correias | tipologia real de pedreira de brita | 4 mil / 10 mil | 300 |
| Areal | draga na margem e pilhas cônicas | tipologia real de areal de rio | 2 mil / 5 mil | 150 |
| Olaria | fornos-túnel e chaminé de tijolo aparente | tipologia real de cerâmica vermelha | 3 mil / 8 mil | 250 |
| Concreteira | silos, central dosadora e betoneiras | central de concreto usinado | 3 mil / 8 mil | 250 |
| Mina de calcário e Cimenteira (M1b) | cava clara em bancadas; torre de ciclones, forno rotativo e silos | fábrica de cimento com pré-aquecedor de ciclones | 3 mil e 6 mil / 8 mil e 15 mil | 250 e 450 |
| Vidraria, Serraria, Manejo (corte) | galpão longo com forno float; galpão e pátio de toras; posto na mata | tipologias reais | 3 mil / 8 mil | 250 |

- **Testa sem as outras:** cena `servicos` com a sintética. **Depende de:** R4a.
- **Entregue em 03/10/2026** (R5, revisada; onda 3, etapa 2). 24 colocáveis em `data/colocaveis.js` (14 serviços e 10
  prédios da Holding, do M1a, do M1b e da linha de corte), cada um com a referência real ("Inspirado em ..."), a pegada
  da planta da simulação e os tetos Média, Ultra e LOD1; o 'pc' usa a coluna Ultra (cabe). Gerador 'colocavel' na
  oficina com o corpo sob demanda; domínio 'colocaveis' (LOD1 do mapa numa chamada, LOD0 por setor, corte da obra da
  R4b, `silhueta(tipo, nivel)` para o fantasma da X2), ligado no índice fixo pelo integrador; seleção 'colocavel'. A
  revisão trocou a pedreira e a mina em degraus (bolo) por morro lavrado, refez os tijolos do CopenHill e corrigiu a
  sombra da obra, o erro da oficina e um vazamento da silhueta. Pendências: delegacia (Capanema) atarracada pelo lote,
  internação do hospital em caixa escura, encostas lisas da pedreira, termelétrica escura à noite; a folha da Holding
  ainda não mostra "Inspirado em ..." (U2a ou C1); LOD1 numa escala só pode brigar com o chão de longe (medir no M1b).
  Nota completa em `docs/entregas/onda3/R5.md`.

#### U1b. HUD, seleção e gestão (onda 3; 3 sessões)
- **Arquivos:** `ui/hud/{Velocidade,Trilho,Objetivo,FaixaAlerta,Avisos,Menu,Retomar}.jsx`, `ui/selecao/Folha.jsx`,
  `ui/selecao/secoes/{residencial,comercial,industrial,servico,empresa,via,terreno}.jsx`,
  `ui/telas/{Holding,Cidade,Progresso,Conselho,Decisao,Momento}.jsx`, `ui/telas/corpo/*` (corpos sob demanda),
  `ui/mundo/MenuContexto.jsx`; herda os de U1a.
- **Consome:** `q.barra`, `q.retomar`, `q.predio`, `q.orcamento`, `q.emprestimo`, `q.deposito`, `q.producao`,
  `q.holding`, `q.cidade`, `q.demanda`, `q.marcos`, `q.decisoes`; eventos; `R.selecionar`, `R.camera`, `R.estado`.
- **Publica:** `Momento` (título de terço inferior, fala, voo) para marco e etapa; `registrarSecao` usado por X1b.
- **Entrega:** velocidade com pausa automática nos modais; os 3 objetivos; faixa de alerta com "Caixa zerado"; avisos;
  cartão e folha por tipo, com "faz" ("fabrica mercadoria para o comércio"); menu de contexto radial; telas Holding
  (visão geral, produção com lotes e a sugestão, Mercado com "37 de 100 vendas nesta janela", demanda da cidade por
  item e por hora, "Abastecer a cidade por importação", Influência e Legado com o efeito escrito), Economia completa
  ("Importação para a cidade", "não pago"), Cidade (demanda com fatores, bem-estar com a margem, serviços), Progresso
  (marcos com o requisito do marco 7, áreas), Conselho (decisão em cartões, histórico); gráficos em SVG; nenhuma
  unidade fora da D42.
- **Testa sem as outras:** `sim-falsa.js` e `render-falso.js` na vitrine. **Depende de:** U1a.
- **Entregue em 02/10/2026** (U1b, revisada; onda 3, etapa 1). Data no calendário da D67 ("mar. 2021"), dinheiro em
  dólar só pelo `ui/formato.js`, conselheiros com nome completo e cargo, textos do plano A antigo fora. Interfaces:
  `ui.momento` e `registrarEtapaMomento`, `abrirDecisao`, `registrarItemTrilho`, `pausarPor`, `abrirTelaNaAba`,
  `mostrarRetomar`, `registrarAcaoAviso`, Bloco e Par da folha e `sobDemanda`. Telas menu, holding, cidade, progresso e
  conselho com o corpo sob demanda em `ui/telas/corpo/` (a U1b é dona da pasta); HUD com faixa de alerta, trilho,
  objetivo, avisos, "Onde você parou" e menu de contexto radial; folhas por tipo; 27 cenas novas na vitrine.
  Pendências: a fila de modais não esvazia ao carregar outra partida (U2a), o "Ir" da Arcologia sem tela (X1b), o item
  'camadas' no trilho (X3a), 307 px livres em 986 x 443 com alerta, abaixo da meta de 340 (confirmar com o dono). Nota
  completa em `docs/entregas/onda3/U1b.md`.

#### U2a. Sistema: save, diário, menus, configurações, Teste de desempenho e primeira hora (onda 3; 3 sessões)
- **Arquivos:** `fonte/app/{salvamento,armazem,diario}.js`, `ui/inicio/*` (menos a abertura),
  `ui/telas/{Configuracoes,TesteDesempenho}.jsx`, `ui/guia/*`, `fonte/som/{som,interface}.js`, `ui/textos/u2.js`,
  `ferramentas/vitrine/cenas/u2.js`, `ferramentas/testes/save.teste.mjs`.
- **Consome:** `salvar/formato.js` e `livro.js` da F0; `R.bancada`, `R.capa`, `R.qualidade`, `R.voo`,
  `R.tempo.forcar`; `q.objetivos`, `q.retomar`, `q.sugestoes`; eventos.
- **Publica:** a API `jogo` do app (2.8); preferências; o som de interface.
- **Entrega:** IndexedDB com 3 automáticos e 8 manuais, capa, exportar e importar com as travas herdadas; **diário
  síncrono** com reprodução e o carimbo da página; save sem gzip no segundo plano; carga com fases e "Toque para
  entrar"; menu inicial com a capa e "Onde você parou"; nova partida (nome e cor); menu com a armadilha do voltar do
  Android; configurações completas; Teste de desempenho (voo de 20 s, sonda, programas, copiar e compartilhar);
  dicas únicas com mão fantasma e traçados sugeridos; sons de interface; vibração. Teste no Chromium: matar a página
  no meio de um save e recarregar sem perder tique.
- **Testa sem as outras:** vitrine com a simulação falsa; save no Chromium com a simulação da F0. **Depende de:** U1a.
- **Entregue em 03/10/2026** (U2a, revisada; onda 3, etapa 3, retomada depois da pausa). Save no IndexedDB com 3
  automáticos e 8 manuais, capa, exportar e importar `.held` com as travas herdadas, automático a cada 5 min e ao sair;
  diário síncrono que devolve a partida que caiu antes do primeiro save (testado matando a página no meio de um save);
  API `jogo` da 2.8; entrada "Clique/Toque para entrar"; menu inicial com Continuar e atalhos; nova partida com "Holding
  Held", "Diogo Holanda", 6 cores e jan. 2020; Configurações com o PC no seletor, resolução dinâmica e nitidez CAS;
  Teste de desempenho com voo de 20 s; primeira hora com anel de guia e "Usar sugestão". Integrador: o objetivo da
  primeira avenida não fechava (`componentes(G).comp` em `sim/objetivos.js`), corrigido. Pendências: Escritório,
  Pedreira, Areal e Olaria sugeridos longe de via (recusa por 'acesso'), `R.resolucao` no R1a (os controles estão
  prontos e desligados), traçado sugerido espelhado com a câmera rente ao chão, música padrão 0,5 contra 0,35 da F0,
  "Inspirado em ..." na folha da Holding. Nota completa em `docs/entregas/onda3/U2a.md`.

#### SEDE3. Sede v3 e área inicial (onda 3, etapa 2; 2 sessões)
- **Arquivos:** `data/arcologia-plano.js`, `data/mapa-heldopolis.js` e o gerado `sim/mundo/relevo-assado.js`,
  `render/arcologia/{torre,partes,planos,lago,fantasma}.js`, `render/cenas/{torre,planos}.js`,
  `ferramentas/testes/arcologia-render.teste.mjs`, `ferramentas/cidade-sintetica.mjs`; nas asserções da área inicial, da
  gleba ou da sede, `ferramentas/testes/{contratos,mundo,terreno,objetivos}.teste.mjs` e `ferramentas/mapa.mjs`.
- **Publica:** a área inicial de 6 x 5 (D90); o disco da sede no platô; o plano A v3 (gleba, portões nas 8 avenidas, vias
  internas, `PARTES_ORDEM` com id e nome em inglês, `TORRE_POSICAO`, `POUSO`, `CAMERA_ARCOLOGIA`, `cavaDoPlano`); os
  dois anéis (Apple Park e McLaren, vidro curvo, marquise por andar, faixa de LED), Blade e Legacy Tower no pódio com a
  Dream Bridge, Codex Tower, Helix Labs, Compass Tower, Dream Falls, Mirror Lake com as fontes, o parque com as
  Supertrees e os fantasmas; cenas `torre` e `planos` (aerea, avenida, mar, noite).
- **Entrega:** testes de forma e de mapa verdes, família arcologia até 250 mil triângulos de perto e 60 mil na vista
  aberta, nenhuma recompilação em tempo de jogo, bancada aberta no 'pc' medida antes e depois, 4 capturas.
- **Entregue em 03/10/2026** (SEDE3, revisada; onda 3, etapa 2, retomada depois do reinício do contêiner e da pausa).
  Área inicial de 6 x 5 (`inicio [[6,5],[11,9]]`), platô em disco na cota 12 (centro (200, 190), raio 860), córregos
  contornando o disco, Morro do Mirante recuado 30 m, nó de entrada em (60, -700), avenida e quadras sugeridas fora do
  disco, captação e usina 'solar' na rua principal da Vila (agora até (-935, 300), com rede); janela do relevo fino de
  161² para 202² (+58 KB). Plano A v3 (só o A): gleba em disco (raio 812), 8 portões, vias internas ARCOLOGIA,
  `PARTES_ORDEM` (torre, lago, meridian, horizon, codex, helix, compass, parque) com `PARTES_NOMES` em inglês,
  `TRECHOS_HORIZON` (8, dois na fase 1), Blade e Legacy com centros a 64 m, vão de 28 m e Dream Bridge a 330 m,
  `TORRE_POSICAO` e `POUSO` novos, `cavaDoPlano` no Mirror Lake, `mataDaSede`. Render: domínio 'arcologia' da v3 com
  `partesProntas` pelas etapas e fantasma do que falta, LOD por 18 setores, nada recompila. Família arcologia: 217 mil
  de perto no pior caso, 31,7 mil na vista aberta com a sede pronta, 13,3 mil no jogo de hoje. Cidade sintética fora do
  disco. Integrador: teto da vista aberta de 40 mil para 60 mil (contrato), mata limpa pelo disco
  (`sim/mundo/floresta.js`) e os testes de outras parcelas com vias dentro do disco corrigidos. Pendências: Helix Labs e
  Compass Tower leem como silos de longe, a fachada do Horizon Ring fica monótona de perto e o parque central ralo
  (ver com o dono na prévia); anéis acinzentados à noite; sombra longa das torres na aérea (R1b); API de câmera fixa
  (R1a); greide do nó de entrada no limite de declive (S1a); coroa de quadras do robô dentro do disco (S3a, C1); dois
  'ShaderMaterial' sem dono que não ligam no SwiftShader (C1). Nota completa em `docs/entregas/onda3/SEDE3.md`.

#### X1b. Arcologia jogável (onda 3; 2 sessões)
- **Depois da SEDE3 (D88 a D90):** a sede v3 troca a forma da Arcologia; a X1b roda na etapa 3 da onda 3, sobre o que a
  SEDE3 publicar (partes, portões nas 8 avenidas, Blade e Legacy Tower, fantasmas com os nomes em inglês).

- **Arquivos:** `data/arcologia.js`, `sim/arcologia.js`, `render/arcologia/{obra,heli}.js`,
  `ui/telas/LivroArcologia.jsx`, `ui/selecao/secoes/arcologia.jsx`, `ui/textos/x1.js`,
  `ferramentas/testes/arcologia.teste.mjs`, `ferramentas/vitrine/cenas/x1.js`; herda os de X1a.
- **Consome:** `sim.holding.entregar`, `pagar` e `efeito`, `sim.progresso`, `sim.redes.produtor`, `sim.formas`;
  `Momento` e primitivas de U1b; `R.voo`.
- **Publica:** gleba, portões e vias internas no grafo com a flag `ARCOLOGIA` quando `lago.e1` fica pronta; a cava do
  reservatório como forma do aplainar; `espelho.arcologia`; comando `arcologia.iniciar`; consulta `arcologia`; evento
  `etapa`; os efeitos da D49.
- **Entrega:** etapas `lago.e1` e `torre.e1..e4` com fases, materiais pela frota e efeitos; obra da Torre por fases com
  grua de 360 m; helicóptero da Holding pousando no `pouso` depois de `torre.e4`; Livro da Arcologia e folha da etapa;
  voo de câmera por etapa; teste "o robô que pula a Arcologia termina mais pobre".
- **Testa sem as outras:** entregas instantâneas do substituto; cena `torre`; vitrine com a simulação falsa.
  **Depende de:** X1a; integra quando S3a e U1b publicarem.
- **Entregue em 03/10/2026** (X1b, revisada; onda 3, etapa 3). O Ato 1 da Arcologia joga de ponta a ponta: lago.e1
  (Mirror Lake, cava no aplainar, 24 vias ARCOLOGIA com os portões nas 8 avenidas, reservatório para 6 mil moradores) e
  torre.e1 a e4 sobre a Blade Tower e a Legacy Tower (licença, +15% de produtividade e 6 caminhões, 1.200 vagas, 400
  moradores de luxo, +20 de demanda residencial, atratividade, valor, Legado +5 e o helicóptero); `arcologia.iniciar`,
  `q.arcologia()`, espelho, evento e Mural; o resto da sede em fantasma e as 14 etapas do M2 nos dados; render da obra
  no par (corte por lado, Legacy um passo atrás, duas gruas até uns 545 m) e o domínio 'helicoptero'; tela do Livro e
  momentos. **A2 vermelho depois da integração:** com o objetivo da primeira avenida corrigido, o robô que constrói a
  Arcologia termina 6 h com 143.795 contra 217.876 sem ela; a Arcologia ainda não se paga (o valuation não soma a obra,
  o robô não importa o aço que falta). É a calibração da C1. Pendências: raio da demanda ignorado pela S2a (vale na
  cidade toda), raio do valor da torre.e4 (900 contra 1,5 km da D49), manutenção das 24 avenidas internas (decidir),
  contratos de `q.deposito().importacoes` e dos campos novos, `web/cenas.html` com "Sede v2" e "Torre Lâmina", gruas e
  helicóptero sem sombra. Nota completa em `docs/entregas/onda3/X1b.md`.

#### X3a. Camadas e avisos, 6 camadas (onda 3; 2 sessões)
- **Arquivos:** `render/sobreposicoes/{camadas,marcadores,ancoras}.js`, `ui/telas/Camadas.jsx`,
  `ui/mundo/{marcadores.js,Rotulos.jsx}`, `ui/glifos/atlas.js`, `ui/textos/x3.js`, `cenas/camadas.js`,
  `ferramentas/testes/camadas.teste.mjs`, `ferramentas/vitrine/cenas/x3.js`.
- **Consome:** `q.camada`, `q.avisosPredios`, `q.avisos`, evento `avisosPredios`; o gancho `camada` lido por R2a
  (chão), R3a (vias pelo `aId`) e R4a (prédios pela tabela na GPU).
- **Publica:** `R.camadas.*`, `R.marcadores.*`, `R.ancoras`.
- **Entrega:** mundo neutro por uniforme; as 6 camadas do M1a com as rampas da UI e legenda embaixo ao centro; a camada
  Recursos com as obras paradas por falta de material; marcadores instanciados com forma por gravidade, oclusão e teto
  por perfil (60 no Média), um por setor de longe; atlas dos glifos; rótulos de áreas, avenidas e marcos no DOM; filtro
  de avisos.
- **Testa sem as outras:** dados de camada da cidade sintética; cena `camadas`. **Depende de:** R2a, R3a, R4a.
- **Entregue em 03/10/2026** (X3a, revisada; onda 3, etapa 3). Gancho 'camada' de verdade (`gCamada` e a rampa;
  desligado custa um desvio por uniforme); domínios 'camadas', 'marcadores' (uma chamada instanciada, forma pela
  gravidade, oclusão pela profundidade, teto de 200 no pc e Alta e 60 no Média, um por setor de longe) e 'ancoras'
  (oclusão pelo relevo); `porPredio` no contrato do aviso 'camadas'; popover de Camadas no trilho com as 6 do M1a, o
  Valor e o filtro de avisos; legenda embaixo ao centro; rótulos da sede em inglês. Pendências: `R.ancoras` ainda usa só
  `R.projetar` (ligar o domínio no índice, C1), rótulos com contraste 1,82:1 e um saindo da tela, avisos 'info' que a
  S2a descarta, a Contribuição em unidades nos textos da camada Bem-estar (fere a D68), camadas que só atualizam na
  rodada, marcador de setor que pode sumir atrás das torres, cores de subtipo da Zonas e o cinza da rampa divergente
  (o dono confirma). Nota completa em `docs/entregas/onda3/X3a.md`.

#### C1. Calibração e publicação do M1a (onda 3; 2 sessões)
- **Dividida em 03/10/2026** em duas parcelas ao mesmo tempo: **C1a** (calibração pelo robô, regras pendentes e contratos
  da simulação) e **C1b** (integração do render e do app, aquecimento sem compilação depois de pronto e a Prévia 2 numa
  pasta temporária; `previa/` e os commits ficam com o integrador). Textos em `.claude/orquestracao/parcelas/`.
- **Arquivos:** `ferramentas/{robo-navegador.js,aceite-cor.mjs}`, `ferramentas/saves/`, `README.md`, os números
  marcados "(calibrar)" nos arquivos de dados depois que as donas terminaram, `fonte/app/*` (integração).
- **Entrega:** calibração pelo robô até as metas A4 que valem no M1a; A8 (fumaça até o tique 1.800); A9 com os limites
  calibrados em 3 a 5 fotos aéreas reais; as capturas do A10 que já existem no M1a; A6 com o save do robô; README com
  números medidos; montagem em `previa/` e publicação em dois commits (fonte e "Montagem ...").
- **Depende de:** onda 3.
- **Entregue em 03/10/2026** (C1a e C1b, revisadas; retomadas depois da pausa). **C1a:** robô dentro das metas A4 do
  M1a (semente robo-1: marco 1 em 0:14, marco 3 em 1:07, empréstimo só em 2020 e 2021 e quitado em 2024, 2.816
  moradores em 2 h contra 353 na base), A8 no Chromium (tique 1.800 com o mesmo hash do Node), valuation com a obra da
  Arcologia (D49), objetivo de ligar a Vila às redes depois da primeira avenida, sugestões da Holding de frente para a
  via, greide do nó de entrada, demanda da torre.e3 com raio, avisos 'info' no mapa, textos do bem-estar em dólar,
  camadas Zonas e Nível atualizando com o jogo parado, contratos registrados (2.6), defeitos achados e corrigidos (o
  q.barra mudava a partida pelo cache do custo dos serviços; a demanda da cidade por hora aparecia 35 vezes maior; o
  robô importava em dobro). **A2 ainda vermelho:** a lago.e1 sai aos 0:20 por 60 mil com a cidade rendendo 4 mil por
  hora, e a Contribuição e a população ficam menores com a Arcologia em 6 h (a riqueza já é maior). **C1b:** API do
  render ligada (ancoras, marcador, `camadas.mostrar`, `R.resolucao`, `projetar` com frente), aquecimento que espera
  os domínios sob demanda (0 compilações depois de pronto na bancada aberta, bairro, rua, planos e na Nova partida, no
  'pc' e no Média), os 2 'ShaderMaterial' sem dono explicados (programas já descartados), CAS em `pos.glsl.js`,
  `pessoas.js` fora do worker, cenas.html com os nomes da D88 e D89, "Inspirado em ..." na folha, Configurações com
  avisos e cores para daltonismo, Prévia 2 montada e README com os números (aberta no 'pc': 73 chamadas e 644 mil
  triângulos). Notas completas em `docs/entregas/onda3/C1a.md` e `C1b.md`.

#### S1c. Trânsito agregado com efeitos (onda 4; 2 sessões)
- **Arquivos:** `sim/transito.js`, `sim/tarefas/transito.js`, `ferramentas/testes/transito.teste.mjs`.
- **Consome:** grafo, zonas de tráfego pelos agregados, `tarefas.js` da F0.
- **Publica:** `espelho.fluxos`; `S.agregados.trajeto`; o custo congestionado da aresta, registrado para a cobertura
  de bombeiros e saúde; dados da camada Trânsito; aviso "trânsito parado" com a aresta e a sugestão.
- **Entrega:** zonas de 256 m, gravidade, 3 passadas com BPR no worker a cada 60 tiques (D15); os efeitos da D37
  (produtividade pelo trajeto, clientes do comércio pelo tempo de viagem, cobertura pelo tempo congestionado,
  bem-estar); a meta do gargalo no robô.
- **Testa sem as outras:** Node com worker simulado. **Depende de:** M1a.

#### S2b. Cidade completa (onda 4; 3 sessões)
- **Arquivos:** `sim/{ambiente,mercadoria}.js`, `ferramentas/testes/{ambiente,mercadoria}.teste.mjs`; herda os de S2a.
- **Entrega:** esgoto separado com a ETE; termelétrica, escola de ensino médio, parque, hospital e parque da orla;
  residencial alta, comercial alta e escritório; mercadoria agregada (produção da indústria zoneada contra o consumo do
  comércio, a falta importada e mostrada no painel de demanda); poluição do ar e ruído (linha de corte) com fontes na
  indústria, na Pedreira, na Mina de calcário, na Cimenteira, na termelétrica e nas vias grandes, com efeito no
  bem-estar e no valor do terreno; dados das camadas Esgoto, Ar, Ruído e Empregos.
- **Depende de:** M1a.

#### S3b. Ato 1 completo, cimento e Modo livre (onda 4; 2 sessões)
- **Arquivos:** herda os de S3a.
- **Entrega:** as 6 decisões do Ato 1; Mina de calcário e Cimenteira (Mina 15 mil, Cimenteira 40 mil; calibrar) no
  ladrilho vizinho; Modo livre (D56); se couber, a cadeia de alimentos (Fazenda e Agroindústria para o comércio) e a
  Vidraria, o Manejo florestal e a Serraria.
- **Depende de:** M1a.

#### X4. Ponte simples (onda 4; 1 sessão)
- **Arquivos:** `sim/vias/ponte.js`, `render/geracao/ponte.js`, `ferramentas/testes/ponte.teste.mjs`.
- **Entrega:** a D53 de ponta a ponta: `sim.travessia.registrar` aceita o trecho sobre água (reto ou em curva suave, até
  200 m, tabuleiro na cota das pontas, custo 3 vezes, flag `PONTE`, recusa `vao`); tabuleiro e pilares instanciados no
  render; a prévia da via mostra a ponte.
- **Depende de:** M1a.

#### R6. Vida de luxo, horizonte e espécies (onda 4; 2 sessões)
- **Arquivos:** `render/vida/{iates,navios,jatos}.js`, `render/geracao/veiculos-luxo.js`; herda `mundo/fora.js` e
  `geracao/arvores.js` de R2b para os itens da linha de corte.
- **Entrega:** iates na marina e um cruzeiro na baía, jatinhos cruzando o céu, esportivos na frota de carros (de 3 a 6
  chamadas instanciadas, sem simulação, D61); se couber, 3 espécies a mais (coqueiro, ipê, figueira) e o mundo de fora
  de 32 km.
- **Depende de:** M1a.

#### X3b. 7 camadas a mais e Problemas (onda 4; 1 sessão)
- **Arquivos:** `ui/telas/Problemas.jsx`; herda os de X3a.
- **Entrega:** Valor do terreno, Esgoto, Trânsito, Poluição do ar, Ruído, Nível e Empregos; aba Problemas da tela
  Cidade com "Ver na camada" e "Próximo".
- **Depende de:** S1c e S2b (substitutos até lá).

#### U2b. Abertura, modo foto, som e Mural (onda 4; 2 sessões)
- **Arquivos:** `ui/telas/{Foto,Mural}.jsx`, `ui/inicio/Abertura.jsx`, `fonte/som/{mundo,musica}.js`; herda os de U2a.
- **Entrega:** Modo livre na nova partida; sons do mundo pela altura da câmera; e, na ordem da linha de corte, Mural,
  música generativa, modo foto básico (fases do sol, sem hora em número) e a abertura de 40 s.
- **Depende de:** M1a.

#### C2. Aceite, calibração e publicação do M1 (onda 4; 2 sessões)
- **Arquivos:** os de C1, `docs/VISAO.md`, `.claude/skills/*`, `.claude/agents/*`, `jogo-antigo/`.
- **Entrega:** calibração pelo robô até todas as metas A4; A1 a A11 verdes; capturas completas do A10; README com
  números medidos; publicação em dois commits com `app/` e `arcologia-de-held.html` novos, a montagem antiga em
  `jogo-antigo/` e `antigo/` e `previa/` apagados.
- **Depende de:** onda 4.

### 4.6 Ondas, caminho crítico, prévias e portões

```
Onda 0   F0
Onda 1   S1a  R1a  R2a  R4a  X1a  U1a                          → I0: Prévia 0 "vitrine visual"  → PORTÃO 1
Onda 2   S1b  R1b  R3a  X2                                      → I1: Prévia 1 "via no polegar"  → PORTÃO 2
Onda 3   S2a  S3a  R2b  R3b  R4b  R5  U1b  U2a  X1b  X3a       → C1: M1a jogável em previa/
Onda 4   S1c  S2b  S3b  X4  R6  X3b  U2b                        → C2: M1 em app/
```

- **Caminho crítico:** F0, R1a e X1a (a Torre e a luz), Prévia 0, portão 1, S1b, X2, Prévia 1, portão 2, S2a com S3a
  (a cidade cresce e paga), X1b, C1, onda 4, C2.
- **Prévia 0, "vitrine visual"** (depois da onda 1; o integrador monta e publica em `previa/`): o dono vê no Poco X7 e
  no PC, sem jogar, o que mais o incomodou:
  - cena `torre`: a Torre Lâmina de dia e de noite, com a prancha de 4 azimutes e 2 closes;
  - cena `planos`: os três planos diretores (A "Baía", B "Parque-canal", C "Orla") como maquete de massas no relevo;
  - cenas `aberta` e `bairro`: a cidade sintética com a fachada no shader, LOD0 e LOD1, céu, AgX, neblina e sombra
    própria, às 10h e às 17h30, e `noite`;
  - cena `materiais`: A/B entre o chão e a fachada procedurais e os materiais CC0, lado a lado;
  - `?ui=vitrine`: a pele nova da interface (barra de cima, cartão, tela Economia com a `sim-falsa`) sobre a cena;
  - página de teste: a sonda (limites, extensões, tempo de compilação de cada programa) e a bancada nas cenas `aberta`
    e `estresse` (ms médio, p95, ms de GPU por `fenceSync`, chamadas, triângulos), com "Copiar resultado".
  - **Portão 1:** o dono aprova a direção visual (Torre, fachadas, céu e luz, pele da UI), **escolhe o plano diretor**
    e os materiais; o print da página de teste fixa o perfil Média (resolução, MSAA, sombra, amostradores). Com isso o
    integrador grava o plano em `arcologia-plano.js` e abre a onda 2. Custo até aqui: 19 de 72 sessões (26%).
- **Prévia 1, "via no polegar"** (depois da onda 2): o mapa autoral de verdade com relevo, rio, Vila e rodovia; traçar,
  curvar, emendar, melhorar e demolir vias com os polegares; zonear quadras (as células aparecem, nada cresce ainda);
  carros pela heurística; sombra de longe e noite. O dono roda o roteiro de 5 min (5.3) e manda o print.
  - **Portão 2:** o dono aprova o gesto e o desempenho com vias. Custo até aqui: 31 de 72 (43%).
  - **Montada na I1 (28/09/2026)** em `previa/`: o índice abre no jogo (o mapa autoral, sem o canteiro de prova da F0),
    no roteiro de 5 min e nas cenas de vias; as cenas da Prévia 0 continuam abrindo, agora sob demanda. Roteiro
    automatizado no Chromium (1376 x 768 e 986 x 443), pela interface: 10 vias (retas, curvas, contínua e duas
    avenidas), 2 cruzamentos com a avenida, desfazer uma via, melhorar a travessa de terra da Vila, demolir e desfazer
    a demolição, 3 quadras zoneadas (cerca de 540, 425 e 420 células), sem erro no console, sem recusa da simulação e
    sem domínio substituto. Bancada (1376 x 768, pior de 120 quadros, sol andando em 4x): `aberta` no Média 50 chamadas
    e 214 mil triângulos (sombra 5 e 34 mil; prédios 137 mil), no Alta 58 e 423 mil (sombra 10 e 126 mil); `estresse`
    no Média 285 e 897 mil, no Alta 290 e 901 mil; guarda do Mali sem falha. JS principal de 1.530 KB (teto 1.638) e
    120 KB sob demanda em 21 pedaços. Na integração, a barra de construção da X2 passou a sumir sob as telas de gestão
    (aparecia pelo vidro da tela Economia).
- **Prévia 1b, "sede v2 e o PC do dono"** (SEDE2 e PC1, D63 a D66; **montada na I2 em 28/09/2026** em `previa/`): o
  índice abre em destaque a sede v2 (aérea, eixo norte, do mar e noite; a prancha das torres às 17h30 e às 21h) e a
  página de teste do PC (perfil escolhido e o motivo, resolução interna, resolução dinâmica, tempo de placa por passe,
  aquecimento e compilações depois de pronto), que abre sem `?q=` para a escolha automática valer; o seletor ganhou o
  PC; a Prévia 1 e a Prévia 0 continuam abaixo. Na integração: o 'pc' entrou no contrato (`PERFIS`, `ORCAMENTO.pc` e
  `TETO_ARCOLOGIA`, 250 mil de perto e 40 mil na vista aberta no PC e no Alta), `R.aquecido()` e a carga do jogo que
  espera o aquecimento (até 20 s); os domínios leem as tabelas por `porPerfil` (o PC com as do Alta); a suavização da
  luz da noite entra no aquecimento (uma cena à parte compila com as luzes dela); os carros que convergem para a mesma
  faixa já fazem fila na curva. No Chromium (SwiftShader, perfil PC): as 38 páginas do índice abrem sem erro; 0
  compilações depois de pronto nas cenas da sede, também trocando eixo, noite, plano B ao meio-dia, aérea e mar na mesma
  página. Bancada (1376 x 768, pior de 120 quadros, 4x): `aberta` no PC 57 chamadas e 430 mil triângulos (sombra 10 e
  127 mil; Arcologia 26 mil), no Alta 60 e 430 mil; `estresse` no PC e no Alta 290 e 901 mil; 0 compilações depois de
  pronto. JS principal de 1.587 KB (teto 1.638).
- **M1a** (depois da onda 3, montado por C1 em `previa/`): jogável do minuto 0 ao marco 7, com a Torre, a economia, a
  Holding e as 6 camadas. O robô em Node roda desde o começo da onda 3 (S3a), com as metas A4 parciais (marco 1 e marco
  3) antes da calibração. O dono joga e decide seguir para o M1b. Custo até aqui: 57 de 72 (79%).
- **M1** (depois da onda 4): C2 publica em `app/`.

### 4.7 Regras de trabalho das parcelas

1. Cada parcela trabalha num worktree próprio a partir do último commit integrado e **edita só os seus arquivos**
   (seção 3.1). Uma parcela "b" ou "c" herda os arquivos da anterior do mesmo domínio; nunca rodam juntas.
2. Tudo entra por registro; nenhuma parcela edita índice, `nucleo.js`, `fonte/app/` ou `fonte/contratos/`. Mudar um
   contrato é pedido ao integrador, que muda `fonte/contratos/` num commit próprio e avisa as parcelas afetadas.
3. Cada parcela entrega com `montar.mjs` sem avisos (numa pasta temporária, sem commitar), `simular.mjs --testes`
   verde (os seus testes e os de todos), as suas cenas da vitrine ou da bancada verdes e capturas só do que mudou.
4. Textos em português do Brasil, sem travessão, em `ui/textos/<parcela>.js`, com as unidades da D42. Números de
   economia marcados "(calibrar)" quando forem ponto de partida.
5. **As parcelas commitam só a fonte**, mensagens em português. Só o integrador monta `previa/`, e só nas prévias 0 e
   1 e no M1a (C1); C2 monta `app/`. Nenhum commit toca `antigo/`, `app/` ou `arcologia-de-held.html` antes de C2.
6. No fim de cada onda o integrador relata as sessões gastas contra a estimativa da 4.4, antes do portão.

### 4.8 Orçamento da vista aberta (Média, `bancada aberta`)

Alvo do Média: **~620 mil triângulos**, com o teto de 900 mil como limite; o pior quadro de 120 é o que conta (A6). A
bancada falha quando uma família passa do seu teto.

| Família | Chamadas | Triângulos (alvo) | Teto da família |
|---|---|---|---|
| Terreno (CDLOD 16 x 16 por nó) e mundo de fora | 1 a 2 | 100 mil | 120 mil |
| Céu (fundo do cubo 256) | 1 | 0 | |
| Água | 2 | 10 mil | 20 mil |
| Vias LOD0 (setores perto; longe pintadas no chão) | 15 a 25 | 70 mil | 90 mil |
| Prédios LOD0 (setores até 350 m) e anexos | 12 a 24 | 90 mil | 240 mil (LOD0, anexos, LOD1 e LOD2 juntos) |
| Prédios LOD1 e LOD2 (instâncias de forma) | 4 | 120 mil | (na linha de cima) |
| Colocáveis (serviços e Holding) | 4 a 8 | 25 mil | 40 mil |
| Vegetação (espécie x LOD e impostores) | 10 a 13 | 80 mil | 110 mil |
| Props (postes, placas, carros parados) | 6 a 8 | 20 mil | 30 mil |
| Carros, gente, caminhões e vida de luxo | 8 a 10 | 25 mil | 40 mil |
| Arcologia (LOD1 nesta vista; LOD0 da Torre só de perto) | 10 a 15 | 25 mil | 40 mil (LOD0 da Torre à parte, até 20 mil) |
| Obras | 5 | 8 mil | 15 mil |
| Marcadores e sobreposições | 1 a 3 | 1 mil | 20 mil (instâncias de zona perto da mira) |
| Sombra própria (LOD1, árvores de perto, Arcologia), em `callsSombra` | 8 a 15 | 40 mil | 60 mil |
| Pós (bloom 4 níveis, composição) | 8 a 9 | 0 | |
| **Total** | **~95 a 150** | **~614 mil** | **900 mil** |

**Custo em regime por quadro no Média** (estimativa; a Prévia 0 troca pelo medido): cubo do céu, uma face de 256² por
quadro, ~0,15 ms; sombra de perto refeita a cada degrau de 1,5° do sol (a cada 2,5 s em 1x e 0,6 s em 4x) ou quando o
alvo anda, de 1 a 2 ms por vez, em média até 0,1 ms; sombra de longe, 16 ladrilhos a cada degrau de 3°, ~0,2 ms em 1x e
~0,45 ms em 4x; PMREM por quadros-chave, 0. Somados ao quadro de 12 a 18 ms, a meta de 33 ms continua com folga. A
bancada mede com o sol andando.

No Ultra, a mesma vista com LOD0 até 900 m, a Torre com 40 a 80 mil triângulos, cascatas e mais árvores: ~400 a 700
chamadas e 3 a 4 milhões de triângulos, abaixo de 1.500 e 5 milhões.

---

## 5. Depois do M1

### 5.1 Roteiro M2 a M6 (em ordem de valor)

| Marco | Nome | Simulação e sistemas | Render e interface | Arcologia | Pronto quando |
|---|---|---|---|---|---|
| **M2** | Cidade viva | ônibus (linhas, paradas, divisão modal); mercado de trabalho pelo tempo de viagem; rotatória, calçadão, conexões de faixa, **alça simples da rodovia**; lixo com reciclagem que vira insumo da Holding; faculdade e universidade; distritos com políticas a partir das áreas nomeadas; orçamento por serviço de 50% a 150%; **extensões de serviço** (alas do hospital, ampliação da escola); **prédios de assinatura com requisito**, alimentados pelas etapas da Arcologia; poluição do solo e da água; residencial misto; árvore de desenvolvimento; marcos 8 a 11 | AO de tela no PC; reflexo planar do lago no Ultra; interiores falsos; **helicópteros entre helipontos**; semáforos; modo foto avançado; miniaturas 3D do catálogo; camadas Holding e Obras; tela Transporte; câmera de rua e seguir | Ato 2 no plano escolhido: Sede e Torres do Conselho, Anel de moradia, Escola, Universidade (entram como serviços de educação) | o robô chega ao marco 11 com duas linhas de ônibus lotadas e o trânsito resolvido por linha ou via |
| **M3** | Holding e mercado | divisões com diretor e caixa; Influência e Legado completos; 3 rivais e aliados; eventos com memória; bens de consumo vendidos ao comércio zoneado (a partir da mercadoria e dos alimentos); siderúrgica e pré-moldados; armazéns com estoque próprio; **porto de carga e aeroporto** (exportação e turismo); hotéis e luxo; contratos; aluguel e impostos fora da moradia se o dono aprovar | viadutos desenhados; VLT; chuva e chão molhado; GI assada na Arcologia no Ultra; **aviões de linha e cargueiros**; tela de rivais | Ato 3: Biblioteca (Diamante), Vida (casca tipo Jewel e Supertrees) e o espaço público do plano | o robô vence um rival e completa 10 eventos |
| **M4** | Escala e vida | mapa inteiro (256 ladrilhos, 50 mil prédios); simulação num worker se o tique passar de 4 ms no p95 do Poco X7; metrô; rodovias do jogador, viadutos, túneis, trevos; terraplanagem (save guarda os remendos); ciclo de vida dos cidadãos; saúde avançada, cemitério, crime; clima tropical com chuva, seca e estações; desastres leves que se desligam; alta tensão no PC; marcos 12 a 15 | bancada A/B WebGL2 x WebGPU no Poco X7 e no PC (troca se o WebGPU for 20% mais rápido no Poco X7 sem perder recurso); render em worker com `OffscreenCanvas` se a UI pesar | Ato 4: Centro de Física e o fechamento do plano | 50 mil prédios a 60 qps no PC e 30 no Poco X7; tique até 4 ms no aparelho |
| **M5** | Apps e política | `.exe` (Electron) e APK (TWA) com saves em arquivo e nuvem opcional; prefeito e câmara eleitos, leis com votação e custo em Influência, eleição a cada 4 anos de jogo | estilos por metrópole começam (tabelas de `estilos.js` e espécies por clima) | a Arcologia completa como sede do grupo | instalados nos aparelhos do dono; uma eleição disputada |
| **M6** | O mundo | mapa-múndi, Nova Libertas e depois as 12 metrópoles; rotas de avião e navio; câmbio, tarifas e crises; cidades fora da tela simuladas em resumo; finais (império, fundação, os dois) | mundo de fora por metrópole | a Arcologia como modelo exportado | uma filial lucrativa fora do Brasil e, no fim, as 12 no mesmo save |

O roteiro por fases da `docs/VISAO.md` (fases 2 a 7) passa a ser este (M2 a M6). A ponte simples saiu do M2: está no
M1b (D53).

### 5.2 Riscos

| Risco | Efeito | Plano |
|---|---|---|
| O dono não gostar da direção visual | dinheiro gasto numa direção errada | Prévia 0 com 26% do custo; portão 1 antes de qualquer sistema grande |
| M1 grande (72 sessões, ~63 mil linhas) | atraso e custo | M1a e M1b; três pontos de parada; relatório de sessões por onda; linha de corte do M1b |
| Traçar via no polegar | frustra o gesto do gênero | mira deslocada, lupa, encaixe com vibração, alças; Prévia 1 e portão 2 |
| Programa acima do limite do Mali | material some no celular do dono | guarda da D44 na bancada; sonda e cena de estresse na Prévia 0; nenhum `mediump` |
| Sombra pelas camadas do three | LOD1 aparecendo ou sem sombra | sombra própria (D43), provada na F0 |
| Shader da fachada caro no Mali | ms acima do previsto nas vistas cheias | variantes por perfil; medida na Prévia 0 antes de acrescentar detalhe |
| Cintilação de fachadas e vias de longe | "chuvisco" no horizonte | filtragem por `fwidth`; vias de longe pintadas no chão |
| Pico de tique ao traçar vias | quadro acima de 33 ms em 4x | buscas fatiadas por trabalho e incrementais; A5 com p99 e máximo no cenário de vias |
| Refusão de setores em 4x | bairro atrasado e envio pesado | anexo do setor e refusão com atraso (D39); medida em R4b |
| Memória do celular | a aba recarrega | teto de geometria (64 MB no Média), atributos quantizados, cache de 12 a 16 setores, texturas até 250 MB |
| Tique no Poco X7 acima de 3 ms | soluço em 4x | fatias do agendador; bancada com o save real; simulação em worker no M4 |
| Determinismo com o worker | o robô do navegador diverge | entrada copiada e tique parado na demora (D15); teste com atraso aleatório |
| Determinismo Node x Chrome | o robô do navegador diverge | hash de trecho no A8; se divergir, `Math.exp` e `Math.pow` viram tabela |
| Aplainar dependente da ordem | prédios flutuando depois de carregar | aplainar puro e comutativo (D5) com teste bit a bit |
| Contratos mudando no meio | retrabalho entre parcelas | contratos com convenções e invariantes na F0; cidade sintética pelas APIs; mudança só pelo integrador |
| Carga lenta no celular | primeira impressão ruim | terreno no worker, `compileAsync`, tempo de compilação na sonda; cache no IndexedDB se passar de 1 s; meta de 8 s |
| `EXT_clip_control` ausente no Poco X7 | z-fighting de longe | duas faixas de profundidade, testadas aqui com `?semClip=1` |
| Materiais CC0 pesados | download e memória | KTX2 com teto de 8 MB; o HTML único fica procedural; A/B decide |
| Save perdido quando o Android mata a aba | até 5 min de jogo perdidos | diário síncrono e reprodução determinística (D31) |
| Um app apagar o cache do outro | jogo congelado sem abrir offline | prefixo por app no `sw.js` (D38); teste offline com os dois instalados |
| Workers no HTML único | worker não sobe fora do servidor | Blob com `URL.createObjectURL` (montar.mjs) |
| Equilíbrio da economia | ritmo errado, regras do dono sem peso | robô calibra pelas metas A4; `REGRAS_DONO` congelado; pergunta 9 ao dono |
| Save danificado ou migração | perda de partida | `validar(S)` antes de trocar, quarentena, um save de exemplo por versão |
| Dependência do Preact | atualização quebrar | versões fixas; plano B de ~200 linhas com a mesma forma de uso |

### 5.3 Como medir no Poco X7

1. **Onde:** as prévias e o M1a em `.../previa/` (PWA próprio, com cache de prefixo próprio, sem mexer no jogo atual);
   o M1 em `.../app/`.
2. **Prévia 0:** abrir a página de teste, rodar a sonda e a bancada (`aberta` e `estresse`), mandar o print; olhar a
   Torre, os três planos, a cidade de dia e de noite, e o A/B de materiais.
3. **Teste de desempenho** (Configurações > Vídeo, a partir do M1a): voo de 20 s por `aberta`, `bairro`, `rua` e
   `noite` com resolução travada. Mostra ms médio, p95, qps, chamadas, triângulos, GPU (por `fenceSync`), "UI ms",
   perfil atual e sugerido, e os programas acima da guarda. Botões "Copiar resultado" e "Compartilhar".
4. **Painel ao vivo** (Configurações > Vídeo, ou F9 no PC): qps, ms, p95, chamadas, triângulos, "UI ms", tique da
   simulação em ms, memória de geometria e de texturas.
5. **Roteiro do dono nas prévias 1 e no M1a (5 min):** abrir, rodar o Teste de desempenho, jogar 5 min em 4x, traçar
   uma avenida com curva, zonear duas quadras, olhar a noite, mandar o print. Se esquentar, repetir o teste depois de
   15 min para ver a queda de qps.
6. **Metas no aparelho:** Média com 30 qps ou mais e p95 até 40 ms; UI até 1,5 ms em repouso e 3 ms com ferramenta;
   tique até 3 ms; carga até 8 s na primeira vez e 4 s depois; nenhum programa falhando no link.
7. **O que só se mede aqui:** chamadas e triângulos exatos (SwiftShader), imagem, erros, determinismo, ritmo do robô.

---

## 6. Onde este documento muda os desenhos

| Desenho | Seção | Muda para |
|---|---|---|
| Simulação | 3.1 (dia de 20 s na interface) | a palavra "dia" some da interface; o período de 20 tiques é a `rodada` (D7, D42) |
| Simulação | 4.3 (vias e prédios não editam a grade; `altura` bilinear) | aplainar puro e comutativo no M1 (D5); `alturaEm` única (D4) |
| Simulação | 4.6 (rio e área inicial) | área inicial numa margem; ponte simples no M1b (D53) |
| Simulação | 5.2 (larguras 12, 22 e 34 m) | 16, 24 e 32 m, mais `terra` (D22) |
| Simulação | 6.4 (indústria por "bens que a cidade não produz") | M1a: acesso à rodovia e mão de obra ociosa; M1b: mercadoria agregada |
| Simulação | 6.7 (abandono em 5, 10 e 15 dias; demolir barato) | 3, 6 e 10 min de jogo (D42); demolir custa os materiais (D54) |
| Simulação | 7.3 (o trajeto não restringe) | trânsito com efeito no M1b (D37) |
| Simulação | 7.4 (base 50, praça +10; `tarifaPor: 'predio'`) | base 40, lazer +6 (D50); `'cidade'` suavizada e arredondada (D11) |
| Simulação | 8.1 (14 serviços no M1; captação de 5.000 m³ por rodada) | 8 no M1a e 6 no M1b; modelos pela R5; captação e reservatório recalibrados (D52) |
| Simulação | 8.2 (ligação externa com água) | só energia, pelo nó de entrada (D52) |
| Simulação | 9.2 e 16.2 (sem resultado, calcula na hora) | entrada copiada e tique parado (D15) |
| Simulação | 12.1 (preço base implícito) | preço de catálogo escrito em `REGRAS_DONO` (D25) |
| Simulação | 12.3 (caixa até −50.000) | caixa nunca negativo (D41) |
| Simulação | 12.5 (a obra importa sozinha com 50% a mais) | D48 |
| Simulação | 12.6 (caixa 250 mil; quitar antes do ano 6 medido em 7 h) | 300 mil (calibrar); robô de 12 h (A4) |
| Simulação | 13.2 e 13.4 (unidade = carga; frota para todas as entregas) | unidade de catálogo, caminhão de 10; frota só para a Arcologia (D47) |
| Simulação | 13.3 (lote livre; compra de tempo nas etapas) | começa em 10 com Auto (D57); compra só nas linhas (D13) |
| Simulação | 14.1 e 14.2 (Trevo; efeitos fracos das etapas) | plano escolhido (D59); efeitos da D49; marco 7 pede `torre.e4` |
| Simulação | 15.1 (XP diário de bem-estar; limiares até 21 mil) | XP por mês e limiares da D51 |
| Simulação | 15.3 e 15.4 (`vila.agua` no marco 1; objetivos só da primeira hora; área inexistente) | marco 0 com a escolha da captação (D52); 3 objetivos contínuos (D58); áreas nomeadas (D55) |
| Simulação | 18.1 (9 prédios de produção) | 4 no M1a, Mina e Cimenteira no M1b, 3 na linha de corte |
| Render | 1.2 (plano próximo dinâmico sem `EXT_clip_control`) | duas faixas de profundidade e `?semClip=1` |
| Render | 1.2 e 19.1 (começa com 3 x 3; alturas a 4 m) | 4 x 4 (D3); 8 m, bilinear (D4) |
| Render | 1.3 (cache de 64 e 36 setores; setor inteiro refeito) | 12 a 16 no Média; anexos, quantização e teto de memória (D39) |
| Render | 2.1 e 2.2 (cubo de 128 refeito a 0,5°; PMREM a cada 2°) | cubo de 256 em duplo buffer; 8 quadros-chave (D9) |
| Render | 2.5 (sombra pelas camadas do three; `SunLight` no PC) | sombra própria (D43); sol em degraus |
| Render | 2.5 e 10.3 (colisão pela cópia na CPU do campo na GPU) | grade da oficina, sem `readPixels` |
| Render | 3.1 (grade de 32 x 32 por nó; bicúbico) | 16 x 16; bilinear igual à simulação |
| Render | 4.1 (`rua2`, `avenida4`, `via6`, `pedestre`) | tipos da seção 2.3 |
| Render | 5.6 (progresso da obra em 8 bits) | início e fim numa RGBA32F, progresso no vértice |
| Render | 6 e 17.1 (Trevo a 10 m; Torre em blocos com faixas escuras, 4 mil e 9 mil triângulos; Sede no M1) | planos da D59; Torre da D27; Sede no M2, fantasma no M1 |
| Render | 7.1 (6 espécies no M1) | 3 no núcleo e 3 na linha de corte |
| Render | 9.3 (tudo procedural) | A/B com CC0 (D46) |
| Render | 11.2 (células de zona como instâncias no mapa inteiro) | no chão pela textura de células; instâncias só perto da mira |
| Render | 14.1 (mundo em objetos e eventos `{t}`) | espelho e diário da seção 2.4 (D21) |
| Render | 15.1 (`engine.stats` depois da cena) | soma de todos os passes, famílias e pior quadro (2.7) |
| Render | 16 (orçamento de ~900 mil) | seção 4.8 (alvo ~620 mil) |
| Interface | 5 e 8.2 (1x, 2x, 3x; hora do céu no relógio) | 1x, 2x, 4x (D7); fase do sol, sem hora (D42) |
| Interface | 7.1 e 8.1 ("+38/dia", "Aluguel 11/h", "Juros do ano em 18 dias") | D42: "/h", "Contribuição", prazos em minutos de jogo |
| Interface | 8.6 e 10.1 (objetivo só da primeira hora) | 3 objetivos contínuos e "Onde você parou" (D58) |
| Interface | 8.17 (3 espaços de save) | 3 automáticos, 8 manuais e o diário (D31) |
| Interface | 9.2 (encaixe na UI) | encaixe em `planejar()` da simulação (D18) |
| Interface | 10.2 (roteiro da primeira hora; "5 etapas"; etapa 1 no marco 2) | tabela da seção 4.1; `lago.e1` no marco 0 e `torre.e1` no marco 3 |
| Interface | 8.4 (Transporte na barra; Áreas nas zonas) | Transporte some no M1; Áreas pelo Progresso (D24) |
| Interface | 12.2 e 12.4 (consultas e ações síncronas) | consultas síncronas, ações com Promise e id (D16) |
| Interface | 15 (contratos propostos) | seção 2 deste documento |
| Arquitetura (pesquisa) | 4 a 9 (Trevo, Torre com penas em blocos) | plano escolhido (D59); Torre da D27; os prédios das partes continuam como referência |

---

## 7. Resposta à crítica

**Balanço:** 66 pontos; **54 aceitos** como propostos e **12 adaptados** (o problema foi aceito e a solução mudou).
Nenhum foi recusado por inteiro. Houve cinco recusas parciais, com a razão escrita: o trânsito na linha de corte (dono
9), o teto de tempo nas fatias (engenharia 5), a conferência de programas no Node (engenharia 3), as zonas só no chão
(engenharia 21) e a bandeira do Modo livre dentro de `REGRAS_DONO` (design 20). Três pontos foram conferidos no código
antes de aceitar: a sombra do three (engenharia 1), o `sw.js` (engenharia 14) e o `salvar.js` (engenharia 15), além
dos limites do SwiftShader (engenharia 3) e do arredondamento da tarifa (dono 17).

**Conflitos entre as lentes e como fechei:**

- Trânsito: o dono 9 punha na linha de corte, o design 2 tirava. Fica fora da linha, no núcleo do M1b: sem ele as
  ferramentas de via do M1 não resolvem nada, e o dono pediu o CS2 como referência para todos os sistemas.
- Ponte: o dono 11 queria no M1, o design 8 no M2 com o mapa numa margem. Ficam os dois: mapa numa margem no M1a e
  ponte simples, simulação e render juntos, no M1b.
- Capturas: o dono 7 pedia 6 da Torre, o dono 19 pedia um conjunto só. A Torre vira uma prancha, e o conjunto tem 11
  imagens.
- Gleba: a engenharia 11 queria a gleba fixa na F0, o dono 2 queria o plano escolhido depois da Prévia 0. A F0 grava o
  envelope; o plano entra pelo integrador no portão 1, antes da primeira parcela que precisa dele (S1b).
- Caixa: o dono 5 proíbe caixa negativo, o design 17 tratava a espiral do caixa negativo. A D41 junta os dois.
- Prévia 2: o dono 4 queria o M1a jogável com a Torre, o design 13 queria a prévia 2 com a economia e a Torre. A prévia
  2 é o M1a.

### 7.1 Lente do dono

1. **[grave] Prévia 0 cedo. Aceito.** A onda 1 virou a Prévia 0, "vitrine visual" (R1a, R2a, R4a, X1a, U1a e S1a para o
   relevo), com a Torre completa de dia e de noite, os planos, a cidade sintética com a fachada nova, o A/B de
   materiais, a pele da UI e a página de teste; portão 1 com 26% do custo. A parte de render do X1 (X1a) passou para a
   onda 1. Acrescentei o R2a porque sem chão a vitrine não deixa julgar luz nem materiais. (4.4, 4.6, D62)
2. **[grave] Trevo. Adaptado.** O Trevo saiu (D59); X1a mostra 3 planos assimétricos no relevo, tirados de distritos
   reais; o fantasma usa as silhuetas LOD1 (D26); a D27 ficou só com a Torre. A adaptação é de ordem: como S1b precisa
   da gleba e dos portões, a F0 grava um envelope e o integrador grava o plano escolhido no portão 1.
3. **[grave] Prédios colocáveis. Aceito.** R5 com a tabela de modelo, referência, LOD0, LOD1 e triângulos, e a cena
   `servicos` no A10 (D60). Troquei duas sugestões: a usina fotovoltaica usa Pirapora (MG), porque Noor Ouarzazate é
   solar térmica (fica o prédio de controle de Noor); a delegacia usa o Palácio Capanema. As indústrias usam tipologias
   reais (cava em bancadas, torre de ciclones, silos), sem nomear fábrica.
4. **[grave] Cheque em branco. Aceito.** A 4.4 tem linhas e sessões por parcela (72 sessões, ~63 mil linhas), portão 1
   (visual) e portão 2 (via no polegar), e o M1 dividido em M1a e M1b, cada um jogável (D62). O M1a vai até a Torre
   pronta, porque a Torre é a promessa do jogo; o M1b ficou com o que o crítico listou.
5. **[grave] Caixa negativo. Aceito.** D41; testes "caixa nunca negativo" e "dívida igual à soma dos contratos" no A2.
6. **[medio] Vida de luxo. Adaptado na divisão.** Helicóptero no M1a (efeito de `torre.e4`, X1b); iates, cruzeiro,
   jatinhos e esportivos no núcleo do M1b (R6), só visuais. Todos fora da linha de corte. Seção 1.7 e pergunta 11.
7. **[medio] Torre para a câmera livre. Aceito.** D27 refeita: três lâminas verticais em vez de blocos empilhados;
   andares de vento recuados com vidro e forro claros; face lisa com costura de 6 m; 12 a 20 mil triângulos no Média e
   40 a 80 mil no Alta e no Ultra. A10 com a prancha de 4 azimutes e 2 closes e o critério de silhueta.
8. **[medio] Highrise City diluído. Adaptado.** D48: do marco 3 em diante, obras de nível 3 a 5 compram só da Holding;
   sem estoque, a Holding importa a 160% pelo caixa e vende a 100%, ou a obra espera com o aviso "obras paradas por
   falta de concreto". Deixei a importação automática ligada por padrão para não travar a cidade de quem ainda não
   produz; a consequência é a perda de 60% por unidade, à vista em Economia. Demanda da cidade por item e por hora na
   tela Holding. A cadeia de alimentos entrou no M1b, primeira da linha de corte.
9. **[medio] Ordem de sacrifício. Adaptado.** Nova ordem na 4.2; helicóptero, carros e gente saíram da linha.
   **Recusa parcial:** o trânsito agregado não fica na linha (design 2). A cadeia de alimentos, nova, entrou antes da
   poluição.
10. **[medio] "11/h" e "Aluguel". Aceito.** D42, com o design 4; guarda de texto contra "Aluguel", "/dia" e "dia" (A7).
11. **[medio] Ponte. Aceito**, junto com o design 8 (D53, X4).
12. **[medio] Materiais CC0. Aceito.** D46 e a cena `materiais`. Ressalvas: o codificador KTX2 roda em Node por wasm,
    com versão fixa (sem um confiável, WebP de 1K com teto de memória); o HTML único fica procedural para não crescer
    8 MB.
13. **[medio] Montagem em conflito. Aceito.** 4.7, regra 5.
14. **[medio] Verde-lima. Aceito.** A9 calibrado em 3 a 5 fotos aéreas reais antes de valer; verde-lima de 68° a 95°
    com saturação acima de 0,55, só na máscara de gramado e telhado (`?passe=mascara`). O teto de saturação do ponto
    de partida subiu para 0,40 até a calibração.
15. **[medio] Peso das regras. Aceito.** Pergunta 9 com as contas; preço base escrito na D25 e em `REGRAS_DONO`.
16. **[leve] Promessas cortáveis. Aceito.** A abertura de 40 s está marcada "se couber" na 4.1; helicóptero e perfil
    Leve saíram da linha, então A6 e A8 ficam como estão.
17. **[leve] Arredondamento. Aceito**, conferido no código de hoje (`Math.round`). D11 e A2.
18. **[leve] Robô de 7 h. Aceito.** A4 roda 12 h no Node e confere também "dívida em queda a partir do ano 3".
19. **[leve] Capturas demais. Adaptado.** Um conjunto de 11 imagens: 10 cenas no horário que mais conta e a prancha da
    Torre. A cor do A9 é medida nas 10.
20. **[leve] Partida atual. Aceito.** Pergunta 10; `jogo-antigo/` na publicação do M1, com o `sw.js` corrigido. O save
    continua no aparelho, porque o IndexedDB é por origem e a pasta nova é da mesma origem.

### 7.2 Lente de engenharia

1. **[grave] Sombra por camadas. Aceito, conferido no código** (`WebGLShadowMap.js` linha 522, `WebGLRenderer.js`
   linha 1737). D43: sombra própria em todos os perfis, o `SunLight` sai, prova na F0 e no A6. O cabeçalho deixou de
   dizer que "tudo existe" sem essa ressalva.
2. **[grave] Aplainar dependente da ordem. Aceito.** D5 com a regra fixa e os testes do A2; a cava do reservatório
   entra por `sim.formas` (X1b).
3. **[grave] Chromium folgado. Adaptado no item (a).** A conferência de cada programa compilado precisa do navegador,
   então roda na `bancada.mjs`; o `simular --testes`, em Node, roda só a guarda de texto (sem `mediump`, sem three nos
   geradores). **Recusa parcial:** conferir programas no Node não é possível. (b) e (c) como pedido: D44, sonda e cena
   de estresse na Prévia 0, ms de GPU por `fenceSync`. Limites conferidos com a `sonda-limites.mjs`.
4. **[medio] Triângulos do terreno e da conta. Aceito.** Grade de 16 x 16 por nó, alvo ~620 mil e tetos por família
   (4.8), `familias` e `pxPorTri` em `R.stats`. O alvo passou um pouco de 600 mil porque agora entram os colocáveis e a
   vida de luxo, que a conta antiga não tinha.
5. **[medio] Picos de Dijkstra. Adaptado.** As fatias têm orçamento de trabalho (4.000 nós por tique). **Recusa
   parcial:** teto de tempo não, porque daria resultados diferentes no Node e no navegador e quebraria o hash.
   Atualização incremental para serviço novo; A5 com p99 e máximo no cenário de uma via a cada 10 tiques.
6. **[medio] Setor sujo. Aceito, com a saída do anexo** (D39, R4b): setores de 256 m mantêm poucas chamadas, o anexo
   refaz só o que mudou e o setor é refundido com atraso; R4b mede fila e envio em 4x.
7. **[medio] Memória de geometria. Aceito.** D39 e A6: 64 MB no Média, atributos quantizados, `onUpload`, 12 a 16
   setores.
8. **[medio] Sol rápido. Aceito.** D9 com degraus de 1,5° e 3°, 8 quadros-chave e duplo buffer; custo em regime na 4.8.
9. **[medio] Worker e determinismo. Aceito.** D15 e o teste com atraso aleatório (A2).
10. **[medio] Crescimento por dobra. Aceito, as duas regras** (reler a cada quadro; `realocado` e `n`). D19, 2.4 e o
    teste da F0.
11. **[medio] Parcelas não disjuntas. Adaptado.** D45 e a árvore 3.1 como pedido; a gleba final entra pelo integrador
    no portão 1 (o plano só é escolhido ali), e `mapa-heldopolis.js` importa a gleba de `arcologia-plano.js`.
12. **[medio] Sentido dos dados. Aceito.** Convenções na 2.4, invariantes testáveis, cidade sintética pelas APIs.
13. **[medio] Três interpolações. Aceito.** D4 com `alturaEm` bilinear única e paridade com o GLSL; teste da seção da
    pista com a faixa plana de 8 m; vias de longe pintadas no chão com viés de profundidade na troca (R3a).
14. **[medio] Cache do service worker. Aceito, conferido no `sw.js` de hoje.** D38 com prefixo por app e teste offline
    com os dois instalados; o `sw.js` do `jogo-antigo/` é trocado pelo mesmo motivo.
15. **[medio] Save assíncrono. Aceito, conferido no `salvar.js` de hoje.** D31 com o diário síncrono, a reprodução e o
    carimbo; sem gzip no segundo plano; teste de matar a página (A3, U2a).
16. **[medio] A8 que não fecha. Aceito.** A8 em tiques (1.800), com teto de 15 min reais e velocidade efetiva; o marco 3
    fica com o A4 e com o robô rápido sobre o render falso.
17. **[medio] Near e far. Aceito.** Duas faixas de profundidade (R1a) e `?semClip=1` na bancada (A6).
18. **[medio] `renderer.info`. Aceito.** 2.7 e A6: `autoReset = false`, soma de todos os passes, pior quadro de 120.
19. **[leve] `readPixels`. Aceito.** Grade `alturasCidade` feita na oficina e enviada por `texSubImage2D` (2.8, R1b).
20. **[leve] Anel de 4.096. Aceito.** 65.536 marcas, deduplicação e `tudo` por domínio (2.4).
21. **[leve] Zonas instanciadas. Adaptado.** A zona vai para o chão por uma textura de células a 4 m (R2a). **Recusa
    parcial:** perto da mira, num raio de 400 m e até 8 mil células (16 mil triângulos), ficam instâncias, porque
    células de 8 m giradas numa textura de 4 m perdem a grade nítida que o dono usa para pintar.
22. **[leve] Cubo de 128. Aceito.** 256 no Média, com sol e lua analíticos (D9, R1a).
23. **[leve] Progresso da obra. Aceito.** RGBA32F de início e fim, progresso no vértice (2.4, R4a, R4b).
24. **[leve] three nos workers. Aceito.** Guarda de texto e teto por worker (A1, 2.8).
25. **[leve] Comando síncrono. Aceito, as duas saídas** (D16).

### 7.3 Lente de design

1. **[grave] Frota que não fecha. Aceito.** D47: teto só para a Arcologia, venda à cidade na hora, caminhão de 10
   unidades, viagem pela rota em tiques, prazos que absorvem de 1 a 3 viagens, e o robô relata fila e atraso (A4). Da
   linha ao armazém não há viagem: a distância vira perda de produtividade, o que também atende o design 14.
2. **[grave] Trânsito sem peso. Aceito.** D37: fora da linha de corte, no núcleo do M1b, com os efeitos e a meta do
   gargalo (A4). Ficou no M1b pela divisão do dono 4; no M1a a mão única ainda é só forma, e isso está escrito.
3. **[grave] Arcologia pendurada. Aceito.** D49, o marco 7 pedindo `torre.e4` e o teste do robô sem Arcologia (A2).
4. **[medio] Três horas e dois dias. Aceito.** D42, com o dono 10; abandono em minutos; guarda de texto.
5. **[medio] Degrau coletivo. Aceito.** D11 (suavização em 1 mês, margem, prévia do efeito, aviso abaixo de 63), meta do
   robô (A4) e o exemplo na pergunta 3.
6. **[medio] Tarifa de 11 sem serviços. Aceito.** D50 (base 40, lazer até +6) e o teste de regra (A2).
7. **[medio] Água da Vila. Aceito.** D52: só energia pela rodovia, ruas de `terra`, decisão sobre o lugar da captação no
   marco 0, antes do objetivo.
8. **[medio] Rio sem ponte. Aceito**, junto com o dono 11 (D53). O render da ponte também veio para o M1b (X4), então
   não há mais simulação no M2 e desenho no M3.
9. **[medio] XP rápido demais. Aceito.** D51 com os limiares novos e o teste de ordem de grandeza.
10. **[medio] Indústria sem produto. Aceito, uma saída em cada parte:** no M1a, acesso à rodovia e mão de obra ociosa;
    no M1b, a mercadoria agregada. O cartão diz o que o galpão faz e a tela Holding diz que ela fornece material de
    obra.
11. **[medio] Compra de tempo irrisória. Aceito.** D13, pergunta 5 com os números, A4 sem comprar tempo e o segundo
    relatório.
12. **[medio] Sem meta depois da primeira hora. Aceito.** D58 e `q.retomar`; o robô confere (A4).
13. **[medio] Prévias sem laço. Adaptado.** A Torre aparece ainda mais cedo, na Prévia 0; a prévia 2 virou o próprio
    M1a, com a economia e a Torre jogável; o robô em Node roda desde o começo da onda 3 com as metas parciais.
14. **[medio] Holding sem lugar no mapa. Aceito.** Pedreira, Mina e Cimenteira são fontes de ar e ruído (S2b, na linha
    de corte); a Concreteira perde produtividade longe do armazém (D47), o que vale mesmo se a poluição cair; a prévia
    de colocar mostra os efeitos na vizinhança.
15. **[leve] Ladrilhos sem pressão. Aceito.** D3: calcário, parte da argila e a orla fora do 4 x 4; "comprados pelo
    jogador".
16. **[leve] Lote dominado. Aceito.** D57 e o laço da 1.3.
17. **[leve] Espiral do caixa. Adaptado à D41.** Como o caixa não fica negativo, param só a Holding, a Arcologia e as
    obras que dependem de importação da Holding; a cidade segue e a contribuição continua. Os serviços trabalham na
    fração paga, e não num piso de 50%, para o jogador ver a falta. Teste de recuperação a partir de caixa 0 (A4).
18. **[leve] Demolir e revender. Aceito.** D54 e teste (A2).
19. **[leve] Área inexistente e medidores sem uso. Aceito.** D55 (S1a e S3a).
20. **[leve] O que faltava do CS2. Adaptado.** Extensões de serviço, prédios de assinatura e alça da rodovia no M2
    (5.1); Modo livre no M1b (D56). **Recusa parcial:** a bandeira fica em `partida.modo`, fora de `REGRAS_DONO`, que
    só guarda as regras do dono e é testado como constante congelada.
21. **[leve] Caixa da primeira hora. Aceito.** Custos dos prédios da Holding definidos (S3a); caixa inicial de 300 mil
    (calibrar); a meta do robô virou "o caixa não zera na primeira hora com no máximo um empréstimo", porque pela D41
    ele não fica negativo. A conta fecha melhor: o reservatório pode substituir a captação, a delegacia e o esgoto
    saíram da primeira hora, e os gastos ficam perto de 300 mil contra 300 mil de caixa, 50 mil de empréstimo, 30 mil
    dos marcos 1 e 2 e a renda da Vila.

### 7.4 Por que as parcelas estão prontas para rodar em paralelo

- **Arquivos exclusivos:** a árvore 3.1 dá um dono para cada arquivo; texturas, oficina, seleção, aplainar e altura
  viraram registros ou `comum/` (D45), e as parcelas "b" e "c" herdam arquivos só de uma parcela da onda anterior.
- **Contratos com sentido:** formatos, convenções e invariantes na F0 (2.4), com a cidade sintética gerada pelas APIs,
  então render e UI trabalham sobre os mesmos dados que S1b e S2a vão produzir.
- **Substitutos:** cada função do contrato interno (2.10) tem substituto na F0, e cada ficha diz com qual substituto
  testa sozinha.
- **Montagem sem conflito:** as parcelas commitam só a fonte; `previa/` é do integrador (4.7).
- **Decisões que travavam:** a única decisão que falta (o plano diretor) está no portão 1, antes da primeira parcela
  que depende dela; as outras perguntas têm padrão adotado (2.11).
