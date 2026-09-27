# Desenho da interface, dos controles e da experiência do jogo novo

Parte "Interface, controles e experiência" do jogo novo, feito do zero. Data: 27/09/2026. Referência máxima: Cities:
Skylines II (CS2). Outras: Highrise City (HC), Anno 117 e 1800, Frostpunk 2, Manor Lords; para o toque, Pocket City 2
e TheoTown.

Base: `ui.md` (pesquisa de interface, com as fontes numeradas que cito como [ui n]), `sistemas.md`, `visual.md`,
`arquitetura.md`, `desenho-render.md` (a parte do motor 3D, já escrita: uso a API da seção 14.2 dele), `docs/VISAO.md`, o
código atual (só consultado) e as capturas do jogo atual em `scratchpad/trevo/int/`. A `ui.md` foi escrita para evoluir o
jogo atual (usinas, pranchas, balões de coleta, sem vias nem zonas, sem pausa). Daqui ela serve pela pesquisa e pelos
tokens; o desenho abaixo é para um jogo de cidade à CS2, com vias, zonas, serviços, Holding e a Arcologia como
megaprojeto.

---

## 0. Resultado em uma página

**Direção.** Interface de ferramenta profissional, no espírito do CS2: vidro grafite escuro e fino nas bordas, o mundo
como protagonista, texto claro em Inter, um azul só para o que se toca, champanhe só para dinheiro e prestígio da
Holding, cor de estado sempre com glifo e forma. Nada do SimCity BuildIt: sem fonte redonda, contorno de texto, botões
com volume, papel creme, latão, confete ou balões de coleta.

**Layout no celular em paisagem (986 x 443 e 915 x 412, px CSS):**

- **Alto, à esquerda (leitura):** marca da Holding, marco, créditos com renda por hora, população, bem-estar e barras
  de demanda. Cada número abre a sua tela (créditos → Economia, população → Cidade, marca → Holding).
- **Alto, à direita:** Conselho (quando há decisão), data com o sol ou a lua, **pausa e velocidades 1x, 2x, 3x**, menu.
- **Borda direita (polegar direito):** Camadas, Mural e Modo foto.
- **Embaixo, dividido pelos dois polegares:** à esquerda o que constrói a cidade (Vias, Zonas, Serviços, Transporte,
  Lazer); à direita o que constrói a Holding (Demolir, Empresas, Arcologia). No meio, o objetivo atual.
- **Painel do selecionado** à esquerda, como o do CS2: primeiro um cartão curto, depois a folha inteira.
- **Com uma ferramenta ativa**, a barra de baixo vira a barra da ferramenta: cancelar e desfazer no polegar esquerdo,
  construir no direito. Um dedo desenha; dois dedos movem a câmera.

**Decisões principais.**

1. **Preact 10 com `@preact/signals`**, JSX compilado pelo esbuild que o projeto já usa. Medido: 20,7 KB minificado e
   8,1 KB comprimido com um componente de teste. Sinais ligam o número direto ao nó de texto, sem redesenhar o
   componente: é o que a barra de cima precisa 4 vezes por segundo.
2. **Inter variável (OFL), só o subconjunto latino: 48 KB**, com números tabulares (`tnum`) conferidos no arquivo.
   Mínimo de 12 px, peso 500 ou mais abaixo de 14 px.
3. **Vidro sem desfoque no celular** (o desfoque custa uns 3,5 ms por quadro no Chrome do Android [ui 53]). Opacidade de
   0,84 nas barras, medida: texto secundário a 5,6:1 no pior caso (céu branco atrás). Desfoque só no PC em Alta e Ultra.
4. **Um sistema de glifos de traço** (grade de 24, traço de 1,75), em SVG no DOM e rasterizado num atlas para os
   marcadores que o render desenha.
5. **Relógio com pausa e 1x, 2x, 3x**, como o CS2. Proposta: tudo corre no relógio da simulação e 1x anda igual ao
   relógio de hoje, então os números do dono valem como hoje em 1x (decisão da simulação e do dono, seção 18).
6. **Número explícito sempre** ("+3.840/h", "34 prédios"), nunca só seta: a maior crítica à UI do CS2 [ui 5][ui 21].
7. **Avisos sobre os prédios desenhados pelo render** (WebGL, 1 chamada, com oclusão), como recomenda a parte do
   render; forma, glifo e cor por gravidade; filtro "só importantes". Rótulos, cotas, lupa e painéis ficam no DOM.
8. **Ferramentas pensadas para o polegar:** ponto de mira 56 px acima do dedo, **lupa esquemática** (vetorial, barata),
   encaixe com vibração curta, alças de 44 px para ajustar o traçado antes de construir, "Preencher quadra" com um toque
   no zoneamento e rolagem da câmera ao chegar na borda.
9. **Zonas: três famílias por cor e o resto por textura.** Medido com o validador da skill de gráficos: cinco cores de
   zona juntas no mapa não se distinguem (normal 9,8, deuteranopia 1,6). Residencial, comercial e industrial passam
   (8,4 e 19,8); escritório e mista viram textura sobre essas cores.
10. **Telas de gestão à CS2:** Holding, Economia, Cidade, Progresso, Conselho e Mural, com gráficos em SVG próprios (sem
    biblioteca), um eixo só, legenda e tabela.
11. **Onboarding sem tutorial pesado:** abertura de 40 s pulável, objetivos do marco como espinha, uma dica curta na
    primeira vez de cada ferramenta e **traçados sugeridos** (fantasmas) nas três primeiras ações.
12. **Narrativa pela interface:** a Arcologia aparece como promessa (fantasma) no primeiro minuto e cada etapa é um
    momento de câmera; o Conselho decide com memória (Influência e Legado); o Mural é a voz da cidade, da imprensa e
    dos rivais.
13. **Som procedural** (Web Audio, sem arquivos): quatro canais, ambiente pela altura da câmera, música generativa por
    hora do dia, vibração no encaixe e no confirmar.
14. **Testes sem WebGL:** vitrine com um render falso em canvas 2D e o estado real ou sintético da simulação; medidas de
    alvo, texto, contraste, transbordo, área do HUD e travessão; robô rápido (UI e simulação) e robô completo (render
    real) só de fumaça.
15. **Proteção contra os gestos do Android:** o gesto de voltar pela borda abre o menu de pausa em vez de fechar o jogo
    (armadilha no histórico), e as áreas seguras do furo da câmera são respeitadas em paisagem.

**M1 da interface:** tudo o que é preciso para jogar o M1 do render e da simulação no celular e no PC: barra de cima com
velocidade, construção com as ferramentas de via, zona, colocar e demolir, seleção, avisos, camadas, telas de Holding,
Economia, Cidade, Progresso e Conselho, Mural, configurações com teste de desempenho, modo foto básico, carga, menu
inicial, primeira hora, som, vitrine e robô. Treze parcelas (U0 a U12, seção 16).

---

## 1. Conferido nesta parte

| O quê | Resultado | Como |
|---|---|---|
| Peso do Preact | `preact` 10.29.8 + `@preact/signals` 2.11.2 + um componente: **20.673 bytes minificado, 8.098 com gzip** | esbuild do repositório, `scratchpad/cs2/ui-medidas/app.jsx` |
| npm daqui | responde; as três dependências instalam em menos de 1 s | `npm view` e `npm i` na pasta de medidas |
| Inter | variável latina (peso 100 a 900): **48.256 bytes**; latina estendida: 85.068 (não precisa, a latina cobre o português) | `@fontsource-variable/inter` 5.3.0 |
| Recursos da Inter | `tnum`, `pnum`, `frac`, `calt`, `kern`; tem − (U+2212), ·, ↑, ↓, ×, …, espaço fino U+2009 e U+00A0; **não tem → (U+2192)** nem U+202F | `fontkit` sobre o woff2 |
| Largura real dos textos | ver tabela abaixo | Chromium de teste com a Inter, `ui-medidas/larguras.mjs` |
| Contraste do vidro | pior caso (vidro sobre branco): opacidade 0,80 dá texto secundário a 4,79:1; **0,84 dá 5,58:1**, texto principal 10,8:1, azul 5,25:1, champanhe 6,7:1 | função `contrast` do validador da skill de gráficos |
| Paleta das zonas | 5 cores juntas (todos os pares): **falha** (normal 9,8 entre violeta e azul; deuteranopia 1,6 entre magenta e verde). 3 cores (verde, azul, ocre): **passa** (CVD 8,4, normal 19,8) | `validate_palette.js --pairs all`, superfície `#141a22` |
| Zonas sobre o mundo neutro | as 3 passam na distinção, mas ficam abaixo de 3:1 contra o cinza claro: precisam de contorno e legenda visível | mesmo script, superfície `#c9cdd1` |
| Cores de estado no HUD | verde `#4CC38A` e vermelho `#FF6A5C` a 6,3 em deuteranopia (faixa de aviso): cor de estado nunca sozinha | mesmo script |
| Séries dos gráficos | 4 primeiras cores escuras da paleta de referência sobre `#1e232a`, pares vizinhos: passa (8,4 e 19,8) | mesmo script |
| Relógio do jogo atual | a renda conta por hora **real** (3.600.000 ms) e o ano do calendário tem 360 dias de 20 s (2 h reais) | `fonte/sim/estado.js`, linhas 130 e 507 |

Larguras medidas (Inter, números tabulares):

| Texto | Tamanho e peso | Largura |
|---|---|---|
| 1.284.500 | 15 / 650 | 78 px |
| 128.450.000 | 15 / 650 | 98 px |
| 128,4 mi | 15 / 650 | 66 px |
| +3.840/h | 12 / 600 | 55 px |
| −12.300/h | 12 / 600 | 63 px |
| 12.480 | 15 / 650 | 54 px |
| 72% | 15 / 650 | 35 px |
| 12 mar | 13 / 600 | 43 px |
| Vias, Zonas, Lazer | 12 / 600 | 26, 36, 32 px |
| Serviços, Transporte | 12 / 600 | 51, **63 px** |
| Empresas, Arcologia, Demolir | 12 / 600 | 58, 56, 45 px |
| Sem energia em 34 prédios · Ver | 13 / 600 | 201 px |

Consequência: botões de largura fixa de 52 px (a proposta da `ui.md`) não cabem "Transporte". Os botões da barra de
construção têm largura pelo rótulo (mínimo de 52 px).

---

## 2. Premissas e ligação com as outras partes

- **Jogo novo.** Nenhum contrato do jogo atual precisa ser mantido (os `data-a` do robô, os `.veu`, a API do `Hud`). O
  que vem da `ui.md`: os tokens de base, a Inter, o sistema de glifos, o vidro sem desfoque no celular, o número
  explícito, os marcadores pequenos com filtro, o Mural e as Camadas, e as lições das críticas ao CS2. O que muda: entram
  vias, zonas, velocidade do tempo, categorias de construção e as ferramentas de traçado; saem usinas, pranchas,
  pedidos, balões de coleta e o botão Obras.
- **Render.** Uso a API da `desenho-render.md` (seção 14.2): `selecionar`, `projetar`, `ancoras`, `camadas`,
  `ferramenta.*`, `marcadores`, `selecionado`, `tempo`, `qualidade`, `bancada`, `camera.irPara`. Peço cinco acréscimos
  pequenos (seção 15.3).
- **Simulação.** Não há desenho da simulação ainda. A seção 15 propõe o contrato que a interface precisa (resumo,
  eventos, consultas, ações com motivo) e desenha tudo para funcionar com a simulação na thread principal **ou** num
  worker (consultas assíncronas desde o primeiro dia).
- **Regras do dono**, mostradas na interface exatamente como são: lotes de produção de 1 a 10; venda no Depósito a 150%
  do preço base, até 100 por janela; empréstimo de 50 mil por ano a 10% ao ano, dívida até 500 mil; renda de 5, 8 ou 11
  créditos por morador por hora pelo bem-estar (faixas de hoje: até 30%, 31 a 60%, 61 a 100%).
- **Textos** em português do Brasil, frases curtas, sem travessão (o teste da vitrine procura "—" e "–" no DOM).

---

## 3. Direção de arte da interface

### 3.1 Princípios

1. **O mundo é o protagonista.** A interface ocupa as bordas, em vidro escuro e fino. O centro da tela fica livre.
2. **Uma linguagem só:** uma fonte, um traço de glifo, três raios, os mesmos estados em toda parte.
3. **Número explícito:** todo valor aparece como número, com a tendência ao lado.
4. **Cor com trabalho definido:** neutras para a estrutura, azul para interação, champanhe para dinheiro e prestígio,
   verde, âmbar e vermelho só para estado e sempre com glifo e forma. Duas neutras e um acento, como o Manor Lords [ui 41].
5. **Polegares primeiro no celular:** o que se toca muito fica nos cantos de baixo e nas bordas; o que se lê fica no
   alto; nada importante no meio da borda de cima.
6. **Tudo explica o porquê:** nada fica desabilitado sem motivo. Tocar no que está esmaecido diz o que falta e oferece
   "Ir".
7. **Profundidade a um toque:** todo número importante tem um "de onde vem" (a crítica "a simulação não aparece na UI"
   do CS2 [ui 22]).
8. **Celebrar com sobriedade:** luz, contagem, um acorde e um voo de câmera. Sem confete, sem saltos.

### 3.2 O que tiro de cada referência

| Jogo | O que entra |
|---|---|
| Cities: Skylines II | barra de estado, barra de ferramentas por categoria com bandeja de itens, painel do selecionado à esquerda, info views (Camadas), avisos sobre os prédios, Chirper (Mural), painel de economia com empréstimo, marcos, modo foto, pausa e 3 velocidades [ui 1 a 17] |
| Highrise City | recursos e cadeias sempre à vista: tabela de produção com saldo por hora e a linha "insumo → produto" [ui 31][ui 32] |
| Anno 117 e 1800 | elegância como palavra-guia, ícones legíveis em tamanho pequeno, 4 tamanhos de texto, tela de estatísticas em abas [ui 30][ui 35][ui 37] |
| Frostpunk 2 | decisões do Conselho com votos e consequência, menu radial de poucas opções (vira o menu de contexto do toque longo) [ui 38 a 40] |
| Manor Lords | densidade de informação com calma visual: duas neutras e um acento [ui 41][ui 42] |
| Pocket City 2 e TheoTown | ferramentas de via e zona feitas para o dedo [ui 47] |
| Workers & Resources (contraexemplo) | nada de ícones minúsculos espalhados nem clique para tudo [ui 43][ui 44] |

### 3.3 Clima

"Sala de controle de uma holding de alto padrão": grafite, fios finos de luz, champanhe discreto na marca e no dinheiro,
azul frio na interação. A interface é sempre escura (não há tema claro): o mundo, com céu e sol reais, é a parte clara
da tela, como no CS2.

---

## 4. Tokens de design

```css
:root{
  /* superfícies: vidro grafite. Sem desfoque no celular: a opacidade garante o contraste sobre céu claro */
  --s0: rgba(12,16,22,.84);    /* barras e botões sobre o mundo (medido: pior caso #33363b) */
  --s1: rgba(16,21,28,.94);    /* folhas, telas, popovers, modais (pior caso #1e232a) */
  --s2: rgba(255,255,255,.04); /* cartão dentro de uma folha */
  --s3: rgba(255,255,255,.08); /* linha em foco, campo, segmento ligado */
  --veu: rgba(6,9,13,.55);
  --fio: rgba(255,255,255,.08); --fio2: rgba(255,255,255,.14);
  --luz: inset 0 1px 0 rgba(255,255,255,.06);          /* brilho de 1 px na borda de cima do vidro */
  --grao: url("data:image/png;base64,...");              /* ruído de 64 x 64 a 3%: "vidro fosco" sem desfoque */
  /* texto (sobre --s0 no pior caso: 10,8 / 5,6 / 2,9) */
  --t1: #EEF2F6; --t2: #A7B1BD; --t3: #6F7A87; --tinv: #0B0F14;
  /* interação e prestígio */
  --ac: #5AB0FF; --ac2: #8CC8FF; --acE: #2F7FD0; --acF: rgba(90,176,255,.16);
  --ch: #D9BD84; --chF: rgba(217,189,132,.14);
  /* estado: sempre com glifo e forma (verde x vermelho = 6,3 em deuteranopia) */
  --ok: #4CC38A; --al: #F2B14C; --er: #FF7B6E; --off: #5E6875;
  /* zonas: três famílias por cor (validadas em todos os pares), subtipos por textura */
  --zR: #199e70; --zC: #3987e5; --zI: #c98500;
  /* séries de gráfico (paleta escura de referência, ordem fixa, validada sobre #1e232a) */
  --g1: #3987e5; --g2: #d95926; --g3: #199e70; --g4: #c98500;
  /* divergente (bom x ruim) e sequencial (magnitude) das camadas */
  --divBom: #3987e5; --divMeio: #383835; --divRuim: #e66767;
  --seq: #cde2fb,#9ec5f4,#6da7ec,#3987e5,#256abf,#184f95,#0d366b;  /* lido pelo JS e passado ao render */
  /* forma e espaço */
  --r1: 6px; --r2: 10px; --r3: 14px; --rp: 999px;
  --e1: 4px; --e2: 8px; --e3: 12px; --e4: 16px; --e5: 24px;
  --sombra1: 0 1px 2px rgba(0,0,0,.35); --sombra2: 0 8px 24px rgba(0,0,0,.35);
  --alvo: 44px; --barra: 40px; --linha: 48px;
  /* tipo */
  --fonte: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mono: ui-monospace, 'Roboto Mono', 'Cascadia Mono', monospace;   /* só o painel de desempenho; fonte do sistema */
  --t12: 12px; --t13: 13px; --t15: 15px; --t17: 17px; --t20: 20px; --t28: 28px; --t40: 40px;
  /* movimento */
  --d1: 80ms; --d2: 160ms; --d3: 240ms; --d4: 360ms; --curva: cubic-bezier(.2,.8,.2,1);
  /* escala: altura da janela e o ajuste do jogador (90% só no PC, 100, 112, 125%) */
  --escala: 1;
}
@media (pointer: fine){ :root{ --linha: 36px; } }                 /* densidade de mouse no PC */
@media (min-height: 700px){ :root{ --escala: 1.1; } }
@media (min-height: 1000px){ :root{ --escala: 1.25; } }
:root[data-vidro="1"] .vidro{ backdrop-filter: blur(14px) saturate(1.2); --s0: rgba(12,16,22,.70); }  /* PC Alta e Ultra, até 3 elementos */
:root[data-contraste="1"]{ --s0: rgba(10,13,18,.94); --s1: rgba(12,16,22,.98); --fio: rgba(255,255,255,.22); --t2: #C9D1DA; }
```

- **Camadas (z):** mundo 0; rótulos do mundo 10; HUD 20; bandeja e barra da ferramenta 30; folha 40; tela de gestão 50;
  popovers 60; avisos 70; modal 80; carga 90.
- **Densidade:** "toque" (celular: linhas de 48 px, alvos de 44) e "mouse" (PC com ponteiro fino: linhas de 36 px,
  alvos de 32 px com estado de passar o mouse). Texto nunca abaixo de 12 px nas duas.
- **Não há tema claro.** A interface é escura por desenho; o alto contraste só escurece o vidro e clareia o texto.
- **Proibido:** gradientes coloridos, sombras de cor, `text-stroke`, emoji, cor saturada fora de estado, desfoque no
  celular, mais de três elementos com desfoque no PC.

---

## 5. Tipografia

- **Inter variável, subconjunto latino, 48 KB** (`inter-latin-wght-normal.woff2` do pacote `@fontsource-variable/inter`,
  com o `OFL.txt`). Uma família só; o peso faz a hierarquia. Sem itálico no M1.
- **Seta (→):** a fonte não tem. Toda seta da interface é glifo SVG (`seta-dir`); no texto corrido, "para".
- **Escala:**

| Uso | Tamanho | Peso | Detalhe |
|---|---|---|---|
| Rótulo de seção, legenda, selo | 12 | 600 | caixa alta, +0,06em, `--t2` |
| Rótulo de botão da barra, renda por hora, custo | 12 | 600 | |
| Texto secundário, subtítulo | 13 | 500 | `--t2` |
| Corpo, linhas de lista, botões | 15 | 600 | `--t1` |
| Valores da barra de cima, título da folha | 15 a 17 | 650 | números tabulares |
| Título de tela e de modal | 20 | 650 | |
| Número de destaque (valuation, saldo) | 28 | 700 | |
| Marco alcançado | 40 | 700 | só no momento |

- Mínimo de 12 px; peso 500 ou mais abaixo de 14 px (texto fino some sobre vidro escuro no celular).
- `font-variant-numeric: tabular-nums` em todo número (a contagem animada não "dança").
- Altura de linha 1,3 no corpo e 1,1 nos números empilhados da barra de cima.
- **Números em pt-BR:** `Intl.NumberFormat('pt-BR')` com formatadores em cache. Barra de cima: número cheio até
  9.999.999; a partir de 10 milhões, forma curta "128,4 mi" (medido: 66 px contra 98). Renda com sinal sempre ("+3.840/h",
  "−12.300/h", com o − U+2212). Durações: "2 min 6 s", "3 dias". Créditos são glifo, não símbolo de moeda.
- **Legibilidade em 986 x 443:** nenhum texto de informação abaixo de 12/600; valores da barra de cima em 15/650;
  rótulos do mundo em 13/600 com halo; o texto das telas de gestão em 15 nas linhas e 13 nas explicações.

---

## 6. Iconografia

### 6.1 Estilo

- **Glifos de traço** numa grade de 24, traço de 1,75, pontas e juntas redondas, `currentColor`, sem preenchimento (só
  detalhes pequenos a 35%). Tamanhos de uso: 16, 20, 22 e 28 px.
- **Registro único** em `fonte/ui/glifos/glifos.js`: nome → caminhos SVG. `<Glifo n="vias" />` no DOM; o mesmo registro
  gera o atlas dos marcadores do render (seção 6.3).
- **Personagens:** monograma (inicial em 600 sobre círculo da cor do personagem a 20%, aro de 1,5 px na cor cheia), com
  nome e cargo sempre ao lado. Nada de retrato desenhado.
- **Marca da Holding:** monograma "H" em champanhe dentro de um anel; cor da marca escolhida na nova partida (seção 8.19).

### 6.2 Conjunto (cerca de 130 glifos no M1)

| Grupo | Glifos |
|---|---|
| Estado da cidade | créditos (moeda com H), renda, população, bem-estar (3 rostos), demanda, marco, data, sol, lua, nuvem |
| Tempo | pausa, velocidade 1, 2 e 3 (1 a 3 triângulos), relógio |
| Construção | vias, zonas, serviços, transporte, lazer, empresas, arcologia, demolir |
| Vias | rua, avenida, via expressa, pedestre, reta, curva, contínua, encaixe, desfazer, construir, cancelar, alça |
| Zonas | preencher, pincel, retângulo, apagar, residencial, comercial, industrial, escritório, mista, densidade 1 a 3 |
| Serviços | água, esgoto, energia, lixo, saúde, educação, polícia, bombeiros, administração, comunicação, parque, praça |
| Holding | construção, imobiliário, indústria, logística, finanças, energia, tecnologia, mídia, hotelaria, aviação, influência, legado, valuation, depósito, lote |
| Avisos | sem via, sem energia, sem água, esgoto, lixo, sem trabalhadores, poucos clientes, sem mercadoria, abandonado, falta material, falta dinheiro, estoque cheio, doença, crime, incêndio, trânsito |
| Vista e sistema | camadas, mural, foto, menu, configurações, conselho, localizar, seguir, info, fechar, voltar, mais, menos, cadeado, check, alerta, seta (4 direções), filtro, tabela, gráfico, som, vibração, tela cheia, salvar, carregar, exportar, importar, teclado, olho, girar prédio, girar celular |

### 6.3 Marcadores e miniaturas

- **Atlas dos marcadores:** na carga, `glifos/atlas.js` desenha os ~20 glifos de aviso num canvas de 512 x 512 (células
  de 64 px, traço branco) e entrega ao render como textura. O render desenha os marcadores instanciados (1 chamada).
- **Forma por gravidade** (a cor nunca carrega o sentido sozinha):

| Gravidade | Forma | Aro | Exemplos |
|---|---|---|---|
| Grave | losango | `--er` | sem energia, sem água, abandonado, incêndio |
| Atenção | triângulo | `--al` | lixo, esgoto, poucos clientes, sem trabalhadores, obra parada |
| Ação ou informação | círculo | `--ac` | estoque cheio, etapa pronta para iniciar, novo nível |
| Holding | círculo de aro duplo | `--ch` | aviso de prédio da Holding (produção parada, lote pronto) |

- **Miniaturas 3D do catálogo** (as de 128 x 128 do CS2 [ui 7]): M2, pedidas ao render (`R.miniatura`, seção 15.3). No
  M1, o catálogo usa o glifo da silhueta.

---

## 7. Layout

### 7.1 Celular, 986 x 443 (px CSS, margem de 8 px mais as áreas seguras)

```
x 8                                                                                                   978
y 8  +--+--+-----------+---------+-------+---------+                   +------+---------+--+--+--+--+--+
     |H |M3|(c)1.284.500|(p)12.480|(:) 72%|R C I E  |                   |Cons 1|(sol) 12 mar|P |1 |2 |3 |= |
     |  |  |   +3.840/h |  +38/dia|       || | | | |                   |      |  Ano 2   |  |  |  |  |  |
y 48 +--+--+-----------+---------+-------+---------+                   +------+---------+--+--+--+--+--+
y 56                      ( ! Sem energia em 34 prédios · Ver )                                  +--+
                                                                              +-----------+     |Ca|
                                                                              | aviso 1   |     |Mu|
                                                                              +-----------+     |Fo|
                                             MUNDO 3D                                           +--+
     
y 391+----+-----+--------+----------+-----+   +----------------------------------+  +-------+--------+---------+
     |Vias|Zonas|Serviços|Transporte|Lazer|   | (o) Objetivo: ligue a baía à ro… Ir |  |Demolir|Empresas|Arcologia|
y 435+----+-----+--------+----------+-----+   +----------------------------------+  +-------+--------+---------+
```

| Elemento | Posição em 986 x 443 | Em 915 x 412 | Medida |
|---|---|---|---|
| Barra de cima, grupo da esquerda | x 8 a 454, y 8 a 48 | igual | H 44, marco 44, créditos 118, população 94, bem-estar 75, demanda 66 (larguras medidas + 16 de folga) |
| Barra de cima, grupo da direita | x 615 a 978 | x 544 a 907 | Conselho 60 (só com decisão), data 83, velocidade 4 x 44, menu 44 |
| Faixa de alerta | centro, y 56 a 92 | igual | até 420 px |
| Trilho da vista (direita) | x 934 a 978, y 56 a 200 | x 863 a 907 | 3 x 48 |
| Avisos (toasts) | x 590 a 926, a partir de y 56 | x 519 a 855 | até 2, 40 px cada |
| Construção, grupo da cidade | x 8 a 310, y 391 a 435 | igual | 52 + 52 + 63 + 75 + 52 e folgas |
| Construção, grupo da Holding | x 775 a 978, y 383 a 435 | x 704 a 907 | Demolir 57, Empresas 70, Arcologia 68 x 52 (primário, com anel de progresso) |
| Objetivo | entre os grupos, até 400 px | 330 a 692 (362 px) | 44 px; recolhe para um chip de 140 px |
| Faixa livre para o mundo | y 48 a 391: 343 px (77%) | y 48 a 360: 312 px (76%) | |
| Área do HUD em repouso | ~15,0% (objetivo recolhido), ~17,6% (objetivo aberto) | ~16% e 19% | a vitrine mede |

Conta da área: grupos de cima 446 x 40 + 363 x 40; trilho 44 x 144; grupos de baixo 310 x 44 + 203 x 52; objetivo
recolhido 140 x 44. Total ≈ 65,7 mil px² de 436,8 mil.

**Por que não há trilho de gestão à esquerda:** com ele o HUD passava de 20% da tela. As telas de gestão abrem pelos
próprios números (créditos → Economia; população, bem-estar e demanda → Cidade; marco → Progresso; H → Holding), pelo
chip do Conselho quando há decisão, pelo menu (lista completa) e por atalhos no PC. É o jeito do CS2 de tocar no
dinheiro para abrir a economia, e a primeira hora ensina isso (seção 10).

### 7.2 Zonas do polegar

Poco X7: 15,3 cm de largura para 986 px (64 px por cm). O polegar direito alcança bem uns 6,5 cm da borda (x 570 a
978); o esquerdo, x 8 a 420; a faixa do meio (420 a 570) é a mais difícil de tocar, e a borda de cima no meio também.

- Toque frequente: grupos de baixo, trilho direito, barra da ferramenta (cancelar à esquerda, construir à direita).
- Toque moderado: velocidade e menu no canto de cima à direita (o polegar alcança a borda em paisagem).
- Leitura: números no alto à esquerda, faixa de alerta no alto ao centro, objetivo embaixo ao centro (toque raro).

### 7.3 Estados da tela

| Estado | O que muda |
|---|---|
| Repouso | como o diagrama |
| Categoria aberta | a **bandeja** sobe acima do grupo da categoria (y 255 a 383): sub-abas e cartões dos itens |
| Ferramenta ativa | a barra de baixo inteira vira a **barra da ferramenta** (seção 8.5); a barra de cima e o trilho ficam |
| Selecionado | **cartão** de 360 x 128 à esquerda (x 8 a 368, y 255 a 383); "Detalhes" abre a **folha** (x 8 a 368, y 56 a 435, cobre o grupo da cidade) |
| Tela de gestão | cobre de y 56 a 435 e de x 8 a 978; a barra de cima fica (o dinheiro muda enquanto se decide); o render cai para o estado "coberto" |
| Popover | ancorado no botão que o abriu, com seta de 8 px |
| Modal (decisão, marco) | véu `--veu`, modal de até 620 px; pausa o tempo |
| Modo foto | toda a interface some; ficam X, legenda e a barra da foto |
| Pausado | o botão de pausa fica âmbar e um chip "PAUSADO" (60 px) aparece sob a barra de cima, no centro |

### 7.4 PC (1376 x 768 e 1920 x 1080)

- Mesmos cantos, `--escala` 1,1 ou 1,25 e densidade de mouse.
- A barra de cima ganha os botões de gestão com rótulo depois do H (Holding, Economia, Cidade, Progresso, Conselho) e
  mais campos (valuation e dívida).
- A barra de construção fica numa linha só, centrada embaixo, como no CS2 (no PC não há zona do polegar).
- A folha tem 400 px; o Mural pode ficar fixo à direita, como o Chirper [ui 10].
- Passar o mouse abre dicas (400 ms) com o atalho de teclado ("Atalho: V"), que se desligam nas Configurações [ui 29].

### 7.5 Áreas seguras e gestos do Android

- `viewport-fit=cover` e `env(safe-area-inset-*)` em todas as margens: em paisagem, o furo da câmera do Poco X7 fica
  numa das bordas laterais, onde está o trilho.
- **Voltar pela borda:** no Android, arrastar da borda esquerda ou direita é "voltar" e fecharia o jogo. A página
  empilha um estado no histórico; o `popstate` abre o menu de pausa e empilha de novo. Para sair: "Sair do jogo" no menu.
- **Barra de gestos embaixo:** um toque que começa nos 12 px de baixo não inicia ferramenta nem câmera.
- Retrato: tela "Gire o celular: o jogo é em paisagem" com glifo animado (sem emoji).

### 7.6 Mapa das telas

```
Carga → Menu inicial → (Continuar | Nova partida | Carregar | Configurações | Créditos)
Jogo
 ├─ Barra de cima: H → Holding · Marco → Progresso · Créditos → Economia · População, Bem-estar, Demanda → Cidade
 │                 Conselho → Decisão · Data → popover do calendário · Velocidade · Menu
 ├─ Trilho: Camadas (popover) · Mural (popover; fixo no PC) · Modo foto
 ├─ Construção: Vias · Zonas · Serviços · Transporte · Lazer | Demolir · Empresas · Arcologia → bandeja → ferramenta
 ├─ Mundo: toque → cartão → folha · toque longo → menu de contexto · marcador → cartão com o aviso no topo
 └─ Menu: Retomar · Salvar · Carregar · Holding · Economia · Cidade · Transporte · Progresso · Conselho · Mural ·
          Camadas · Modo foto · Configurações · Ajuda (glossário e atalhos) · Sair para o menu
```

---

## 8. Componentes

### 8.1 Barra de cima

- Dois grupos de vidro `--s0` com `--luz` e `--grao`, raio `--r2`, 40 px de altura visual, cada item um botão com alvo
  de 44 px (o `::after` estende 2 px acima e abaixo). Divisórias de 1 px `--fio`.
- **Grupo da esquerda:**
  - **H (Holding):** monograma champanhe; toque abre a tela Holding.
  - **Marco:** anel de 28 px (traço de 2,5 px `--ac` pelo XP) com o número em 15/700. Toque: popover com o marco
    atual, o que falta para o próximo e "Ver marcos".
  - **Créditos:** glifo `--ch`, valor em 15/650, renda por hora em 12/600 embaixo (`--t2` com o sinal; o número
    negativo ganha o glifo de alerta, não só cor). Ao ganhar, o valor fica champanhe por 500 ms; ao gastar, pisca
    `--er` 300 ms. Toque: Economia.
  - **População:** glifo, valor e "+38/dia". Toque: Cidade.
  - **Bem-estar:** rosto (sorriso a partir de 61%, reto de 31 a 60%, triste até 30%: as faixas de renda do dono) e o
    número. Toque: popover "Bem-estar 72%: 11 créditos por morador por hora. Abaixo de 61% cai para 8." com os três
    maiores fatores e "Ver tudo" (Cidade, aba Bem-estar).
  - **Demanda:** quatro barras de 8 x 18 px (residencial, comercial, industrial, escritório) com as letras R C I E em
    12/600 embaixo; cor da família (escritório: azul com hachura). Toque: popover com os quatro números e os fatores
    principais; "Ver tudo" abre Cidade, aba Demanda.
- **Grupo da direita:**
  - **Conselho:** chip "Conselho 1" com ponto champanhe, só quando há decisão pendente. Toque: a decisão.
  - **Data:** "12 mar" em 13/600 e "Ano 2" em 12/600, com o glifo do sol ou da lua na posição da hora visual. Toque:
    popover do calendário (data, hora, clima, "Juros do ano em 18 dias", "Próximo marco: faltam 312 moradores").
  - **Velocidade** (seção 8.2) e **Menu**.

### 8.2 Relógio e velocidade

- Segmentado de quatro botões de 44 x 40: **Pausa, 1x, 2x, 3x** (glifos de 1 a 3 triângulos, sem texto). O ativo tem
  fundo `--s3` e traço de 2 px `--ac` embaixo; pausado, o botão de pausa fica `--al` e aparece o chip "PAUSADO". O
  estado é sempre o que está marcado, nunca o que vai acontecer (a ambiguidade do play e pausa do CS2 [ui 22]).
- **Pausa automática:** ao abrir decisões e modais (sempre); ao abrir telas de gestão (padrão ligado no celular,
  desligado no PC); quando o app vai para segundo plano (sempre). Volta à velocidade anterior ao fechar.
- **Hora visual:** a data anda pelo calendário da simulação; o ciclo de dia e noite do céu dura **um mês** do
  calendário, como no CS2 [ui 4] (em 1x, se o dia continuar com 20 s, o ciclo visual dura 10 min, acima dos 8 min que o
  render pede). Proposta para a simulação, seção 18.

### 8.3 Trilho da vista (borda direita)

- Três botões de 44 x 44 com glifo de 22 px: **Camadas**, **Mural** (selo de não lidas só para "Importante" e
  Conselho, para não virar ruído), **Modo foto**. Ligado: fundo `--acF` e glifo `--ac`.
- Toque longo (celular) ou passar o mouse (PC): o nome.

### 8.4 Barra de construção e bandeja

- **Botões:** glifo de 22 px e rótulo 12/600 embaixo, largura pelo rótulo (mínimo 52), `--t2`; aberto com `--t1`,
  fundo `--s3` e traço de 2 px `--ac`. Categoria sem nenhum item no jogo fica fora da barra; categoria com itens ainda
  trancados mostra cadeado de 10 px e, no toque, "Abre no marco 4: Bairro".
- **Arcologia:** 68 x 52, glifo champanhe e anel de 2 px com o progresso total do megaprojeto; selo quando uma etapa
  pode começar.
- **Bandeja** (o menu de itens do CS2 [ui 7]): sobe acima do grupo da categoria, até 560 px de largura, 128 px de altura.
  - Linha 1: sub-abas em segmentado de 36 px com rolagem horizontal (Serviços: Água, Energia, Lixo, Saúde, Educação,
    Segurança, Administração, Comunicação; Zonas: Residencial, Comercial, Industrial, Escritório, Mista, Distritos,
    Áreas; Empresas: uma aba por divisão da Holding).
  - Linha 2: cartões de 88 x 80 com rolagem horizontal: glifo ou miniatura de 32, nome em 12/600 (2 linhas), preço em
    12/600 (vermelho com glifo quando falta dinheiro), e um efeito curto quando couber ("atende 1.200"). Trancado:
    cadeado e "Marco 4".
  - Toque num cartão: ativa a ferramenta e a bandeja recolhe. Toque longo: cartão de detalhe (custo, manutenção por
    hora, capacidade, alcance, requisitos, o que libera).

```
+-------------------------------------------------------------------------------+
| [Água] [Energia] [Lixo] [Saúde] [Educação] [Segurança] [Administração] [...]  |
| +--------+ +--------+ +--------+ +--------+ +--------+                       |
| | (ícone)| | (ícone)| | (ícone)| | (cad.) | | (ícone)|                       |
| |Bomba   | |Estação | |Caixa   | |Estação | |Torre   |                       |
| |d'água  | |de trat.| |d'água  | |grande  | |de água |                       |
| |  8.000 | | 22.000 | |  3.500 | |Marco 4 | |  6.000 |                       |
| +--------+ +--------+ +--------+ +--------+ +--------+                       |
+-------------------------------------------------------------------------------+
```

### 8.5 Barra da ferramenta ativa

Substitui a barra de baixo inteira enquanto a ferramenta está ativa (o "painel de opções da ferramenta" do CS2):

```
+------------------+----------------------------------------------------------+--------------+
| [x Cancelar][<- ]| [Avenida 4 faixas v] [Reta|Curva] [Contínua o] [Encaixe o] |  [ CONSTRUIR ]|
|                  |          124 m · 3.720 créditos · manutenção 12/h          |   (primário) |
+------------------+----------------------------------------------------------+--------------+
  polegar esquerdo                        meio (leitura)                        polegar direito
```

| Ferramenta | Meio da barra | Direita |
|---|---|---|
| Via | tipo (abre a bandeja), Reta ou Curva, Contínua, Encaixe, total (metros, custo, manutenção) | Construir (108 x 52) |
| Zona | zona e densidade, Preencher, Pincel, Retângulo, Apagar, tamanho do pincel (P, M, G), demanda R C I E | Pronto (a pintura já vale; Desfazer volta) |
| Colocar | nome, custo, manutenção, capacidade e alcance, Girar | Construir |
| Demolir | quantos selecionados, o que se perde e o que volta | Demolir (dois toques se houver prédio da Holding) |

- Construir inválido fica fraco e com o motivo no rótulo ("Cruza água", "Sem créditos: faltam 1.200").
- Desfazer: até 10 ações da ferramenta atual (reembolso: pergunta para a simulação, seção 18).
- No PC: Enter constrói, Esc cancela, Ctrl+Z desfaz, Shift segurado desliga o encaixe.

### 8.6 Objetivo e conselheiro

- Cartão `--s0` de 44 px e até 400 px: monograma de 28 px de quem fala, "OBJETIVO 2 DE 5" em 12/600 caixa alta,
  o texto em 13/600 numa linha e "Ir" em `--ac` com glifo de seta. Toque executa: abre a categoria certa com um anel de
  guia no botão ou voa até o lugar.
- Feito: check `--ok` por 600 ms e o próximo sobe 6 px e aparece (160 ms).
- Recolhe para o chip "Objetivos 2/5" (toque reabre). Depois da primeira hora ele recolhe sozinho.
- **Dicas contextuais:** o mesmo cartão, com fundo `--s1`, na primeira vez de cada ferramenta (seção 10.3).

### 8.7 Seleção: cartão e folha

**Cartão (celular)**, 360 x 128, à esquerda, sem cobrir o centro:

```
+--------------------------------------------------+
| (ic) Edifício Aurora              Residencial 3  [x]|
|      Rua das Palmeiras · Vila Norte               |
|  Moradores 84/96   Bem-estar 71%   Aluguel 11/h   |
|  [!] Sem energia há 2 dias           [ Ver camada ]|
|  [ Detalhes ]   [ Localizar ]   [ ... ]           |
+--------------------------------------------------+
```

- Toque num marcador abre o cartão com o aviso no topo e a ação que resolve ("Construir usina", "Ver camada de
  energia", "Ir para a Concreteira").
- Com uma camada ligada, a primeira linha do cartão mostra o valor da camada naquele prédio.
- No PC, a seleção abre direto a folha (como o CS2), com opção de usar o cartão.

**Folha** (360 px no celular, 400 no PC), anatomia:

```
+------------------------------------------+
| < (ic) Edifício Aurora        [loc][...][x]|  cabeçalho 56 px: título 17/650 (editável com toque longo)
|        Residencial média · nível 3        |  subtítulo 12/500 --t2
| [Visão geral] [Moradores] [Serviços]     |  abas de 44 px
|------------------------------------------|
| AVISOS                                   |  cada aviso com causa, número e ação
| RESUMO                                   |  linhas de 48 px: rótulo e valor tabular
| NÍVEL  3 de 5  ▰▰▰▱▱  "sobe com valor do terreno e serviços" |
| SERVIÇOS  água ✓ energia ! esgoto ✓ lixo ✓ saúde ✓ educação ✓ |
|------------------------------------------|
| rodapé: ação principal (48 px)           |
+------------------------------------------+
```

| Tipo | Seções (o que a simulação precisa dar) |
|---|---|
| Residencial | moradores e capacidade, famílias, bem-estar e fatores, renda gerada por hora, nível e o que falta para subir, serviços atendidos, escolaridade, avisos |
| Comercial e escritório | trabalhadores e vagas, clientes ou produtividade, lucro por hora, mercadoria, nível, avisos |
| Industrial | trabalhadores, produção por hora, insumos, destino da carga, poluição, avisos |
| Serviço | capacidade e uso, alcance (liga a camada certa), manutenção por hora, eficiência, veículos (M2), extensões (M2) |
| Empresa da Holding | divisão, diretor, produção com **lote de 1 a 10** e Auto, estoque, lucro por hora, trabalhadores, cadeia "insumo → produto" com quem produz cada insumo, cor da marca |
| Arcologia | estrutura, etapa atual de N, requisitos (marco, créditos, materiais da Holding com origem), progresso, próxima etapa, "Iniciar etapa", cor |
| Via | tipo, comprimento, fluxo e velocidade (se houver), condição (M3), Substituir e Melhorias (M2) |
| Lote vazio ou terreno | zona, valor do terreno, dono (Holding, rival, cidade), recursos |
| Distrito (M2) | população, riqueza, escolaridade, felicidade, políticas |

- **Localizar** (glifo de alvo): leva a câmera ao objeto. **Seguir** (M2) para veículos e pessoas.
- Pilha de até 5 com Voltar (ir de um prédio para o fornecedor e voltar).

### 8.8 Menu de contexto (toque longo)

- Toque longo (450 ms, vibração de 10 ms) ou clique direito curto: até 4 pétalas de 56 px em arco em volta do dedo,
  com rótulo de 12/600, puxando para cima e para dentro da tela (nunca sob o dedo). É o radial de poucas opções do
  Frostpunk 2 no controle [ui 40].
- Ações por tipo: prédio (Detalhes, Localizar, Cor, Demolir); via (Detalhes, Substituir, Melhorias, Demolir); terreno
  (Zonear aqui, Construir aqui, Valor do terreno); prédio da Holding (Detalhes, Produção, Cor, Vender imóvel se a
  simulação tiver).
- Soltar sobre a pétala executa; soltar fora cancela.

### 8.9 Avisos sobre os prédios (marcadores)

- Desenhados pelo render (placas viradas para a câmera, 1 chamada, com oclusão pela profundidade), teto por perfil:
  200 no PC, 60 na Média, 30 na Leve, os mais importantes e mais perto primeiro. De longe, um marcador por setor com o
  número de avisos (seção 11.3 do render).
- A UI escolhe **o que** mostrar: `R.marcadores([{ idx, glifo, gravidade, prioridade }])`, recalculado quando os avisos
  mudam (evento), nunca por quadro.
- Toque: o render devolve o marcador em `selecionar` (seção 15.3) e a UI abre o cartão do prédio com o aviso no topo.
- **Filtro** no popover de Camadas e nas Configurações: "Avisos: todos · só graves e atenção · nenhum". Com uma camada
  ligada, só os avisos daquela camada.
- **Lista de problemas** (Cidade, aba Problemas): cada tipo com a contagem ("Sem energia: 34 prédios"), "Ver na camada"
  e "Próximo" (voa de um em um). O CS2 não tem isso e os jogadores recorrem a mods [ui 28].

### 8.10 Rótulos do mundo e cotas

- **Rótulos** (DOM, até 40): nomes de bairros (de longe), avenidas (de perto), marcos da Arcologia e prédios da
  Holding. Texto 13/600 `--t1` com halo escuro de duas sombras, sem caixa. Posição por `R.ancoras()` a cada quadro, só
  com `transform`. Somem sob o HUD e quando se cruzam (fica o de maior prioridade).
- **Cotas** da ferramenta de via: chip `--s1` perto do meio do traçado com "124 m · 3.720" e, no ponto de encaixe, o
  ângulo ("90°"); vermelho com o motivo quando inválido ("Declive de 14%: máximo 10%").

### 8.11 Alerta, avisos e Mural

- **Faixa de alerta:** um problema da cidade inteira por vez (falta de energia, de água, de esgoto, caixa negativo,
  dívida perto do limite), com glifo na forma da gravidade, número e "Ver" (abre a camada ou a tela certa); "+2" se
  houver outros.
- **Avisos (toasts):** à direita sob a barra, até 2, 4 s; `--s1`, glifo de 18 px e texto 13/600; entram descendo 8 px
  (160 ms) e saem apagando (120 ms). Nunca para o que exige ação: isso vai para a faixa, o marcador ou o Conselho.
- **Mural** (o Chirper da Holding): popover de 340 px ancorado no trilho (fixo à direita no PC).
  - Autores: Conselho (conselheiros e diretores), Cidade (moradores, com o bairro), Imprensa ("Diário de Heldópolis"),
    Mercado (rivais e bolsa, M2).
  - Cada post: monograma ou glifo, autor, hora do jogo, até 140 caracteres, "Ir" quando tem lugar, selo "Importante".
  - No lugar das curtidas do CS2, "312 famílias concordam": o número de afetados, que mede a gravidade.
  - Filtros: Tudo, Conselho, Cidade, Imprensa, Mercado. Últimos 200 na sessão; os importantes vão no save.
  - Configuração "Falas dos conselheiros: aviso na tela · só importantes · só no Mural" [ui 25].

### 8.12 Camadas (as info views)

- Popover no trilho com uma grade de 2 colunas de botões (glifo e nome) e, embaixo, o filtro de avisos.
- Camada ligada: o render deixa o mundo neutro e pinta prédios, vias ou chão (seção 11.1 do render). A UI mostra a
  **legenda embaixo ao centro** (chip de até 360 px com a rampa, os números do mínimo e do máximo e a unidade) e "X" para
  desligar.
- Rampas (a skill de gráficos): **sequencial** de um tom (azul claro para escuro) para magnitude (valor do terreno,
  densidade, fluxo); **divergente** azul (bom) e vermelho (ruim) com cinza no meio para cobertura e bem-estar; **por
  categoria** só com até 3 cores (zonas, dono do lote: Holding, rivais, cidade). Paleta para daltonismo nas
  Configurações (a divergente vira azul e laranja).
- Escala de cada camada ajustada ao intervalo real, com o número na legenda (lição do valor do terreno saturado do CS2
  [ui 26]).

| Camada | Dado | M1? |
|---|---|---|
| Zonas | por célula, 3 famílias e texturas | sim |
| Valor do terreno | por célula, sequencial | sim, se a simulação tiver valor por lote |
| Cobertura de serviços (escolher: saúde, educação, segurança, lixo) | por célula, divergente | sim |
| Água, esgoto e energia | por prédio: atendido ou não | sim |
| Trânsito | por via: fluxo e velocidade | quando a simulação tiver fluxo |
| Nível dos prédios, escolaridade, felicidade, poluição (ar, solo, ruído), Holding e rivais, turismo | variado | M2 em diante |

O render aceita 3 a 4 camadas no M1; a lista final depende da simulação (seção 18).

### 8.13 Telas de gestão

Estrutura comum: cobre y 56 a 435; cabeçalho de 48 px com glifo, título 20/650, abas e X à direita (polegar direito);
corpo com rolagem; em larguras acima de 900 px, duas colunas (indicadores à esquerda, detalhe à direita). Toda linha
com número tem "de onde vem" no toque longo.

**Holding** (a identidade do jogador):

| Aba | Conteúdo |
|---|---|
| Visão geral | valuation em 28/700 com a variação do mês e o gráfico de 12 meses; caixa, dívida, lucro por hora; **Influência** e **Legado** como dois medidores separados de 0 a 100 (nunca num gráfico de dois eixos) |
| Divisões | cartões por divisão: diretor (monograma), receita, custo e lucro por hora, funcionários, reputação, projetos; trancadas com o marco |
| Produção | tabela por produto: produz/h, consome/h, estoque, saldo (como o painel de produção do CS2 e o monitor do HC); a linha da cadeia "areia → vidro → painel de fachada → Torre"; ordens por empresa com **lote de 1 a 10** e Auto |
| Mercado | o **Depósito**: comprar e vender por item; venda a **150% do preço base**; "37 de 100 vendas nesta janela · renova em 14 min" |
| Imóveis | prédios da Holding com lucro por hora e ocupação; Localizar |
| Rivais (M2) | holdings rivais, bairros de interesse, relação de −100 a 100 |

**Economia** (o painel de economia do CS2 [ui 12]):

| Aba | Conteúdo |
|---|---|
| Orçamento | saldo por hora em 28/700; receitas e despesas em duas colunas de linhas com barra; a primeira receita mostra a regra do dono: "Moradores: 12.480 x 11 = 137.280/h (bem-estar 72%, faixa de 61 a 100%)"; gráfico do saldo em 12 meses |
| Empréstimo | deslizante de 1.000 em 1.000 com os botões − e +; "Disponível neste ano: 38.000 de 50.000"; "Dívida: 120.000 de 500.000"; "Juros: 10% ao ano"; contratos; pagar juros, parcela ou quitar |
| Impostos e verbas | só se a simulação adotar (imposto de comércio, escritório e indústria; verba dos serviços de 50 a 150%); a renda por morador nunca vira imposto |

**Cidade** (o painel de informações e estatísticas que o CS2 não tem inteiro [ui 28]): Visão geral (população, famílias,
empregos, desemprego, escolaridade em indicadores com o número grande), Demanda (as barras e a lista de fatores com +
e −), Bem-estar (fatores com o número de cada um e as faixas de renda), Serviços (capacidade x uso por serviço, com
"Ver camada"), Problemas (seção 8.9), Distritos (M2).

**Progresso:** Marcos (trilha vertical: número, nome, meta com o número atual, prêmio e o que libera; o atual aberto),
Desenvolvimento (se a simulação tiver árvore), **Livro da Arcologia** (cada estrutura com as etapas, as feitas acesas,
a atual com os requisitos).

**Conselho:** Decisões pendentes, Histórico (as marcas que cada escolha deixou e o que elas abriram ou fecharam),
Relações (M2).

**Transporte** (quando a simulação tiver linhas): linhas com passageiros, veículos e preço.

### 8.14 Decisões do Conselho

- Modal de até 620 px (92% no celular). Pausa o tempo. Sobretítulo "CONSELHO · DECISÃO", título 20/650, a situação em
  2 a 3 linhas, e **2 a 4 cartões lado a lado** (rolagem horizontal em 915):

```
+----------------------------+  +----------------------------+
| (T) Tomé propõe            |  | (N) Nara propõe            |
| Canteiro 24 horas          |  | Canteiro só de dia         |
| Influência  +3  ▰▰▰        |  | Legado      +4  ▰▰▰▰       |
| + Obra 30% mais rápida     |  | + Bem-estar +2%            |
| − Bem-estar −3% na Vila    |  | − Etapa 1 leva 2 dias a mais|
| Abre: contrato da Rodovia  |  | Abre: selo Obra Verde      |
| [ Escolher ]               |  | [ Escolher ]               |
+----------------------------+  +----------------------------+
                 Decidir depois (prazo: 5 dias)
```

- Ganho com glifo de mais, custo com glifo de menos (a cor ajuda, a forma decide), números sempre. "Decidir depois"
  enquanto houver prazo. A escolha vira marca no Histórico e post no Mural.

### 8.15 Momentos: marco alcançado e etapa da Arcologia

- **Marco:** som de acorde, título de terço inferior sobre o mundo por 3 s ("MARCO 3 · BAIRRO") e depois o modal
  compacto: prêmios em linhas (créditos, pontos, áreas), "Liberado agora" com chips das categorias e prédios, Continuar.
  O anel do marco se completa em 600 ms. Sem confete.
- **Etapa da Arcologia concluída:** a câmera voa até a estrutura (`R.camera.irPara`, 2,5 s), título de terço inferior
  ("TORRE LÂMINA · ETAPA 2 DE 5"), uma fala de uma linha e Continuar; as luzes da peça acendem na primeira noite
  (render). Pulável com um toque; desligável ("Cenas de marco" nas Configurações).

### 8.16 Gráficos

Regras da skill de gráficos, aplicadas à interface escura:

- Linha de 2 px, área a 12% embaixo; marcadores de 8 px só no ponto tocado; grade recessiva `--fio`; **um eixo só**
  (dois números de escalas diferentes viram dois gráficos).
- Uma série: sem legenda, o título diz o que é. Duas a quatro: legenda sempre e rótulo direto no fim da linha. Mais de
  quatro: "Outros".
- Cores `--g1` a `--g4` na ordem fixa, sempre para a mesma entidade (receitas por fonte, por exemplo), nunca por
  posição. Texto sempre em `--t1` e `--t2`, nunca na cor da série. Estado só com as cores de estado e glifo.
- **Toque e segure** (celular) ou passe o mouse (PC): linha vertical e cartão com o valor e a data. Alvo maior que a
  marca.
- "Ver tabela" em todo gráfico (acessibilidade e conferência).
- SVG feito à mão em `comp/Grafico.jsx` (linha, área, barras e barra empilhada), sem biblioteca.

### 8.17 Configurações

Tela com abas à esquerda e linhas de 52 px à direita (rótulo 15/600 e explicação 12/500 `--t2`; controle à direita):

| Aba | Opções |
|---|---|
| Vídeo | **Qualidade** (Auto, Ultra, Alta, Média, Leve; cada uma com o orçamento: "Média: até 300 chamadas e 900 mil triângulos, para celulares como o Poco X7"); troca na hora com "Manter esta qualidade? 10 s" (volta sozinha se o celular travar); resolução; limite de quadros (30, 60, 120); ajustes avançados recolhidos; **Painel de desempenho** (qps, ms, p95, chamadas, triângulos, "UI ms", memória); **Teste de desempenho** |
| Interface | tamanho (90% só no PC, 100, 112, 125%); densidade no PC; dicas de atalho; avisos (todos, importantes, nenhum); falas; pausar ao abrir telas; cenas de marco |
| Controles | ponto de mira acima do dedo (0, 40, **56**, 72 px); lupa (ligada); encaixe padrão; sensibilidade da câmera; inverter arrasto; rolar pela borda da tela (PC); teclas (lista, com troca) |
| Som | geral, música, ambiente, efeitos do mundo, interface; silenciar em segundo plano; vibração |
| Jogo | salvamento automático (a cada 5 min e ao sair); dicas; modo criativo (se a simulação tiver) |
| Acessibilidade | alto contraste; reduzir movimento (segue o sistema por padrão); paleta das camadas para daltonismo; tamanho |
| Salvamento | salvar, carregar (3 espaços e o automático, com capa), exportar, importar, recomeçar (dois toques) |
| Sobre | versão, GPU, capacidades (do `R.stats`), licenças (Inter OFL, three MIT, Preact MIT) |

**Teste de desempenho** (a UI da bancada do render, seção 15.4 dele): "Rodar teste (20 s)". A interface some, uma
contagem aparece e o render voa pelas cenas. Resultado num cartão: perfil atual e sugerido, ms médio, p95, qps,
chamadas, triângulos, GPU e "UI ms"; botões "Aplicar o perfil sugerido", "Copiar resultado" e "Compartilhar" (Web Share,
para o dono mandar o print).

### 8.18 Modo foto

- **M1 (básico):** esconde toda a interface; ficam o X (alto à direita), a legenda (embaixo à esquerda: "Heldópolis ·
  12 mar, Ano 2 · 18:40") e a barra embaixo ao centro com Hora do dia (deslizante e atalhos manhã, meio-dia, pôr do sol,
  noite), Exposição, Grade de terços, Esconder avisos e **Fotografar** (captura do canvas; baixa o arquivo ou compartilha
  pelo Web Share no Android). A câmera desce mais perto do chão (limite do render).
- **M2:** profundidade de campo e tilt-shift no PC, cor e LUT, vinheta, grão, câmera de rua, seguir, quando o render
  tiver (`R.foto`).
- A barra some em 3,5 s sem toque; um toque a traz de volta.

### 8.19 Carga, menu inicial, nova partida e pausa

- **Carga:** grafite com degradê vertical leve, "HELDÓPOLIS" em 28/650 com espaçamento de 0,2em, a fase em 12/600
  (Código, Mundo, Cidade, Céu e sombras, Pronto) e linha de progresso de 2 px `--ac`. Primeiro quadro da carga em menos
  de 1 s (HTML e CSS mínimos antes do JS). Termina em "Toque para entrar" (libera o som e a tela cheia).
- **Menu inicial:** fundo com a **capa do último save** (JPEG de 640 x 288, uns 40 KB, gravado a cada salvamento): abre na
  hora e não gasta GPU. Botões: Continuar (nome, população, data, "jogado há 2 h"), Nova partida, Carregar,
  Configurações, Créditos.
- **Nova partida:** nome da Holding (padrão "Held", editável), cor da marca (6 opções que o render usa em bandeiras,
  helicóptero e cor padrão da Holding), mapa (Heldópolis no M1), opções (dicas ligadas, modo criativo se houver).
- **Menu (≡ ou Esc ou voltar do Android):** Retomar, Salvar, Carregar, as telas de gestão, Configurações, Ajuda (glossário
  e atalhos), Sair para o menu.

### 8.20 Primitivas

| Primitiva | Desenho |
|---|---|
| Botão primário | fundo `--ac`, texto `--tinv` (8,3:1), 44 px (48 no rodapé), raio `--r2`, 15/650 |
| Secundário | fundo `--s3`, fio `--fio2`, texto `--t1` |
| Fantasma | sem fundo, texto `--ac` |
| Prestígio | fio e texto `--ch` (gastos grandes da Holding) |
| Perigo | fio e texto `--er` com glifo |
| Dois toques | o primeiro arma por 2,6 s: fio `--al`, "Toque de novo para confirmar" e barra de 2 px que esvazia |
| Interruptor | trilho de 44 x 26 com o estado escrito ao lado ("Auto: ligado") |
| Segmentado | 36 px visuais (alvo de 44), segmento ligado em `--s3` com traço `--ac` |
| Deslizante | trilho de 4 px, polegar de 24 px (alvo de 44), passos marcados; valor em 15/650 ao lado |
| Quantidade | [−] N [+] de 44 x 44; para os lotes de produção, limitado de 1 a 10 |
| Barra de progresso | 4 px, preenchimento `--ac`, `--ok` ou `--al`; tempo restante em 12/600 à direita |
| Chip | 28 px, glifo de 16 e texto 12/600 |
| Linha | 48 px (36 no PC): glifo ou chip de 32, título 15/600, subtítulo 13/500, valor 15/650 tabular ou ação |
| Tabela | cabeçalho 12/600 caixa alta, linhas de 44 px, ordenação no toque do cabeçalho, virtual acima de 50 linhas |
| Vazio | glifo de 32 `--t3`, frase em 13/500 e a ação que resolve |
| Fraco | 50% de opacidade, continua tocável e diz o motivo |

**Movimento** (só `transform` e `opacity`; com "reduzir movimento", troca direta):

| Evento | Visual | Duração |
|---|---|---|
| Toque em botão | escala 0,97 | 80 ms |
| Bandeja e folha abrem | sobem ou deslizam 12 a 16 px e aparecem | 240 ms |
| Fecham | apagam e recuam 8 px | 160 ms |
| Número muda | contagem e cor por 500 ms | 480 ms |
| Aviso entra ou sai | desce 8 px; apaga | 160 e 120 ms |
| Anel de guia | um pulso | 1,6 s |
| Encaixe | a mira "estala" (escala 1,15 e volta) | 120 ms |

---

## 9. Controles

### 9.1 Câmera e seleção

A arbitragem de gestos mora no render (`camera/entrada.js`, seção 10.2 dele). A tabela junta o que ele propõe com os
modos da interface:

| Ação | Toque, sem ferramenta | Toque, com ferramenta | Mouse e teclado |
|---|---|---|---|
| Mover | 1 dedo arrasta (o chão fica sob o dedo) | **2 dedos** arrastam | botão esquerdo ou do meio arrasta; WASD e setas; borda da tela (opção) |
| Zoom | pinça | pinça | roda no cursor; + e − |
| Girar | 2 dedos giram | 2 dedos giram | botão direito arrasta; Q e E |
| Inclinar | 2 dedos arrastam na vertical | não (evita conflito com mover) | botão direito na vertical; R e F |
| Selecionar | toque curto | (a ferramenta usa o toque) | clique |
| Menu de contexto | toque longo (450 ms) | não | clique direito curto |
| Usar a ferramenta | não | **1 dedo** (tocar, arrastar, alças) | botão esquerdo |

- Limiares: toque até 250 ms e 8 px; arrasto a partir de 8 px; pinça quando a distância muda mais de 12 px; giro acima
  de 6°; nos primeiros 80 ms o gesto é decidido e não troca no meio (render).
- Um toque que cai na interface nunca chega ao mundo.
- **Rolagem pela borda com ferramenta:** com o dedo ou a mira a menos de 48 px da borda da área livre durante um arrasto,
  a câmera anda na direção da borda (velocidade proporcional à distância). Sem isso uma avenida longa não cabe no
  polegar.

### 9.2 Traçado de via no celular

**Máquina de estados** (`fonte/ui/ferramentas/via.js`, pura e testada em node):

```
ocioso --toque--> mirando A --solta--> A fixo --toque ou arrasto--> mirando B --solta--> prévia com alças
   ^                                                                                      |   |   |
   |                        Cancelar ou Esc                                               |   |   +--Construir--> (Contínua? B vira A e volta a "mirando B" : ocioso)
   +--------------------------------------------------------------------------------------+   +--arrasta alça (A, B ou meio)--> prévia com alças
```

- **Atalho rápido:** tocar em A, arrastar até B e soltar faz as duas etapas num gesto.
- **Curva sem modo extra:** a prévia reta tem uma alça no meio; arrastar essa alça curva a via (Bézier). O segmentado
  Reta ou Curva só muda o que a alça do meio faz ao ser tocada (Reta: volta a reta).
- **Ponto de mira deslocado:** enquanto o dedo está apoiado, o ponto que conta fica 56 px acima do contato (ajustável
  de 0 a 72), marcado por uma mira de 20 px com um fio até o dedo. O dedo nunca esconde o ponto.
- **Lupa esquemática:** círculo de 128 px, ampliação de 3 vezes em volta da mira, do lado oposto ao do dedo (acima e à
  esquerda se o dedo está na metade direita). Desenha em canvas 2D, a partir dos dados e não dos pixels: vias como
  faixas na largura real, nós como pontos, guias de encaixe tracejadas, grade de 8 m, contorno da água e dos prédios.
  Custo abaixo de 1 ms e só com o dedo apoiado. Por que não copiar os pixels do WebGL: exige ler o quadro da GPU (no
  Mali isso pode parar a fila) e a imagem ampliada fica borrada; a lupa com imagem fica como experimento no M2.
- **Encaixe** (`ferramentas/encaixe.js`, puro), em ordem de prioridade:
  1. nó existente a menos de 20 px de tela (mínimo de 6 m);
  2. ponto sobre uma via existente (vira cruzamento);
  3. ângulo de 90° ou 45° em relação à via ligada, e prolongamento dela;
  4. distâncias de quadra (múltiplos de 8 m a partir da via paralela: dá quadras certas para zonear);
  5. passos de 15° sem outra referência.
  Ao encaixar: a mira estala, vibração de 8 ms, e um chip curto ("90°", "Cruzamento"). Shift no PC ou o botão
  Encaixe desligam.
- **Validação a cada movimento** (≤ 1 ms, função pura da simulação, seção 15.2): comprimento mínimo de 16 m, ângulo de
  cruzamento mínimo de 30° (aviso), declive, água, sobreposição a prédio (a demolição entra no custo e na cota), créditos.
- **Cotas** perto do traçado e o total na barra da ferramenta (seção 8.5).
- **Com mouse:** clique em A e clique em B (como o CS2), alças arrastáveis, Enter constrói.

```
     (lupa 3x)                 +------------------------+
    /  --+--  \                |  124 m · 3.720  [90°]  |
   |  ===+=== |                +------------------------+
    \    o    /           A o=================(o)=================o B
                                             alça do meio
                                   (+) mira
                                    |
                                  (dedo)
```

### 9.3 Zonas

- **Preencher** (padrão; o melhor amigo do polegar): toque dentro de uma quadra pinta todas as células livres que dão
  para as vias dela, com a zona escolhida. Aplica na hora, com um brilho de 240 ms; Desfazer volta.
- **Pincel:** arrastar pinta pela mira; tamanhos P, M e G (raio de 1, 2 e 4 células de 8 m).
- **Retângulo:** apoiar, arrastar a diagonal e soltar.
- **Apagar:** as três formas, tirando a zona.
- Zona e densidade vêm da bandeja: Residencial (baixa, média, alta), Comercial (baixa, alta), Industrial, Escritório,
  Mista. A demanda R C I E fica na barra da ferramenta.
- **Desenho das células** (render, 1 chamada): família pela cor (`--zR`, `--zC`, `--zI`), escritório com hachura a 45°
  sobre o azul, mista dividida na diagonal entre verde e azul, densidade alta com borda interna mais forte, contorno
  escuro de 1 px (o contraste com o mundo neutro claro é baixo, medido abaixo de 3:1) e legenda visível na barra da
  ferramenta.

### 9.4 Colocar e demolir

- **Colocar:** o fantasma (LOD1 do render) segue a mira, **gruda na frente da via mais perto** e gira para ela; o
  círculo de alcance aparece no chão com a cobertura atual em volta (camada certa ligada sozinha). Um dedo arrasta o
  fantasma; "Girar" vira 90°; Construir. Inválido: vermelho e o motivo ("Precisa de acesso a uma via").
- **Demolir:** toque marca (contorno vermelho pelo render), arrastar marca vários; a barra diz o que se perde e o
  custo; prédios da Holding e da Arcologia pedem dois toques (se a simulação permitir demolir).

### 9.5 Teclado do PC

| Tecla | Faz |
|---|---|
| Espaço · 1 · 2 · 3 | pausa · velocidades |
| W A S D, setas · Q E · R F · roda, + − | mover · girar · inclinar · zoom |
| Home | voltar à Arcologia |
| V · Z · X · T · G | Vias · Zonas · Serviços · Transporte · Lazer |
| H · M · B | Empresas · Arcologia · Demolir |
| I · N · K · U | Camadas · Mural · Modo foto · esconder a interface |
| L | localizar o selecionado |
| Shift + 1 a 6 | Holding · Economia · Cidade · Transporte · Progresso · Conselho |
| Enter · Esc · Ctrl+Z | construir · cancelar ou fechar ou menu · desfazer |
| Shift (segurado) · vírgula e ponto | sem encaixe · girar o prédio ao colocar |
| F9 | painel de desempenho |

Todas trocáveis nas Configurações; as dicas mostram a tecla.

### 9.6 Vibração

Encaixe 8 ms; confirmar 15 ms; toque longo 10 ms; erro 30, pausa 40, 30 ms; marco 20, 60, 20 ms. Desligável. Só
Android (o `navigator.vibrate` não existe no iOS).

---

## 10. Primeira hora e narrativa

### 10.1 Princípios

1. **Nada de tutorial em trilho.** O jogador pode ignorar tudo; os objetivos do marco dão a direção (é o que os marcos
   do CS2 fazem bem [ui 6]).
2. **Mostrar no mundo, não em texto:** avisos sobre os prédios ensinam os serviços; o traçado sugerido ensina a via.
3. **Uma coisa nova por vez,** no máximo uma dica na tela.
4. **Tudo pulável,** e as dicas se desligam de vez.

### 10.2 Roteiro-alvo (a simulação calibra os números)

| Minuto (1x) | O que acontece | Na interface |
|---|---|---|
| 0:00 | carga e "Toque para entrar" | seção 8.19 |
| 0:10 | Nova partida: nome e cor da Holding | uma tela, dois campos |
| 0:30 | **Abertura (40 s, pulável):** voo sobre a baía no fim da tarde; três legendas de terço inferior: "Heldópolis, baía norte" · "A Holding Held comprou a concessão da orla" · "Aqui vai subir a Arcologia de Held". O fantasma da Arcologia (contorno luminoso da Torre Lâmina e da Sede) aparece no terreno e fica | tempo pausado; só "Pular" |
| 1:10 | Íris (arquiteta-chefe), no objetivo: "Primeiro, ligar o terreno à rodovia." Anel de guia em Vias; o **traçado sugerido** (tracejado azul) liga a saída da rodovia ao canteiro | objetivo 1 de 5; tempo em 1x |
| 1:30 | Dica da ferramenta de via (uma vez): "Toque no começo e no fim. Arraste a bolinha do meio para curvar." com a mão fantasma de 1,2 s | cartão de dica |
| 3:00 | "Moradia para os operários": a barra R da demanda pulsa; quadras sugeridas ao lado da avenida; dica do Preencher | objetivo 2 |
| 5:00 | as primeiras casas sobem (obra à CS2); logo aparecem **avisos de sem água e sem energia**. Dica: "Esses sinais mostram o que falta. Toque num deles." | objetivo 3: água e energia |
| 8:00 | bomba d'água na margem do rio (lugar sugerido) e usina; os avisos somem | |
| 10:00 | **Marco 1** (momento da seção 8.15): libera comércio, indústria, escola, saúde e as Empresas | modal do marco |
| 12:00 | Tomé (engenheiro de materiais): "A Torre pede concreto e aço. Vamos produzir nós mesmos." Objetivo: Construtora Held e Concreteira; primeira **ordem de produção em lote** (1 a 10) | folha da empresa |
| 18:00 | a diretora financeira sugere o **empréstimo** quando o caixa cai: abre a aba Empréstimo com as regras escritas | aviso e tela de Economia |
| 22:00 | dica única: "Toque nos números lá em cima para ver os detalhes." (ensina Economia, Cidade, Progresso) | |
| 25:00 | **Marco 2** libera a **Etapa 1 da Arcologia** ("Fundações da Torre Lâmina"): requisitos à vista no Livro da Arcologia; Iniciar; a câmera voa para o canteiro e a grua sobe | Arcologia |
| 35:00 | **primeira decisão do Conselho** (2 cartões: Influência ou Legado) | modal |
| 45:00 | o Mural traz a primeira nota da imprensa sobre um rival (gancho para o M2) | Mural |
| 55:00 | **Etapa 1 concluída** (momento com voo e luzes) e o marco 3 à vista | |

### 10.3 Dicas e sugestões

- **Dica:** o cartão do objetivo em `--s1`, 2 linhas no máximo, mão fantasma animada em CSS (um glifo de dedo que faz o
  gesto por cima do botão ou do mundo, 3 vezes no máximo), "Entendi" e "Não mostrar dicas". Cada dica aparece uma vez
  (preferências locais).
- **Traçado sugerido** nas três primeiras ações (primeira via, primeira quadra, lugar da bomba d'água): fantasma
  tracejado no mundo (render `ferramenta.via.previa` com estilo "sugestão") e o botão "Usar sugestão" na barra da
  ferramenta. Depende de o mapa trazer essas sugestões (seção 18).
- **Ajuda** no menu: glossário curto (o que é demanda, bem-estar e faixa de renda, marco, lote de produção, Depósito,
  Influência e Legado) e a lista de gestos e atalhos.

### 10.4 A Holding e a Arcologia contadas pela interface

- **A Arcologia é a promessa desde o primeiro minuto:** o fantasma no terreno fica visível até a etapa sair do chão; o
  botão Arcologia tem o anel do progresso total; o **Livro da Arcologia** (Progresso) é o "livro de obra" do
  megaprojeto, com as estruturas, as etapas e o que cada uma pede da cidade e da Holding. Cada etapa concluída é um
  momento de câmera (seção 8.15).
- **A Holding é o jogador:** o H abre a identidade (valuation, divisões, Influência e Legado); os diretores falam no
  Mural e propõem no Conselho; a cor da marca aparece no mundo.
- **Decisões com memória:** cada escolha fica no Histórico do Conselho e reaparece ("Por causa do Canteiro 24 horas, a
  Vila Norte não confia em nós") em posts e em cartões futuros.
- **A cidade tem voz:** moradores por bairro, imprensa e rivais no Mural; o número de famílias que concordam mostra o
  peso de cada queixa.
- **Marcos com nome da história** (proposta ao roteirista): Canteiro, Vila Operária, Bairro, Distrito, Cidade, Polo
  Regional... até Metrópole.

### 10.5 Personagens (proposta; o roteirista fecha)

| Personagem | Papel na interface |
|---|---|
| Íris, arquiteta-chefe | vias, zonas e Arcologia; fala na primeira hora |
| Tomé, engenheiro de materiais | produção, empresas e cadeias |
| Nara, bióloga da conservação | Legado: verde, água, poluição |
| Caio, físico | energia e tecnologia |
| Dona Cida, voz dos moradores | bem-estar, queixas da cidade |
| Diretora financeira (nova) | Economia, empréstimo, valuation |

---

## 11. Som

- **Tudo procedural em Web Audio** (a ideia do `core/audio.js` de hoje: osciladores, ruído filtrado, reverberação
  gerada), sem arquivos de áudio. Libera no "Toque para entrar".
- **Canais:** Mestre → Música, Ambiente, Efeitos do mundo, Interface, cada um com volume próprio. Compressor no mestre.
- **Ambiente pela câmera** (`R.camera.estado()` e o tipo de chão sob o alvo, consulta da simulação):

| Altura da câmera | Ambiente |
|---|---|
| até 60 m | rua: carros passando (pelo fluxo perto, se houver), passos, pássaros perto de parques, mar perto da costa |
| 60 a 600 m | zumbido da cidade proporcional à população à vista, vento leve |
| acima de 600 m | vento e o zumbido distante; mar se a costa estiver à vista |

- **Interface:** clique seco e curto (toque), tique de encaixe (tom sobe a cada encaixe seguido), baque grave ao
  construir, pincel macio ao zonear (um tom por família), estalo ao demolir, dois toques descendentes no erro, acorde
  de pad no marco, sino baixo na etapa da Arcologia. Nunca um som por tique de dinheiro.
- **Música generativa** por hora do dia (manhã, tarde, noite), pads e piano esparso, 12 vozes no máximo, entra e sai
  devagar; padrão a 35%.
- **Custo:** o Web Audio roda na thread de áudio; a meta é menos de 1% de CPU na thread principal. Silencia em segundo
  plano.

---

## 12. Arquitetura de software da interface

### 12.1 Escolha: Preact com sinais

| Opção | Peso comprimido | A favor | Contra |
|---|---|---|---|
| **Preact 10 + `@preact/signals`** | **8,1 KB medido** | componentes declarativos para ~40 telas e ~30 componentes; sinais atualizam só o nó de texto que muda; JSX pelo esbuild do projeto; MIT; maduro | uma dependência (fixa em versão) |
| DOM na mão (como o jogo atual) | 0 | nenhuma dependência | o `paineis.js` de hoje (631 linhas densas) mostra o custo: DOM desatualizado, difícil de mudar e de dividir entre agentes |
| React | ~45 KB | o que o CS2 usa | pesado para o celular sem ganho aqui |
| Lit (web components) | ~6 KB | padrão da web | shadow DOM atrapalha os tokens globais e os seletores dos testes |
| Interface em canvas ou WebGL | 0 | tudo no mesmo quadro | texto, acessibilidade e testes sem WebGL ficam muito piores; o CS2 faz a interface em HTML e CSS [ui 1] |

**Plano B**, se o integrador vetar dependências: `ui/nucleo/` com `h()`, `sinal()`, `computado()` e `efeito()` (umas
200 linhas) com a mesma forma de uso dos sinais, para a troca futura ser mecânica.

### 12.2 Fluxo de dados

```
Simulação (thread principal ou worker)
   │  resumo (4 por segundo) · eventos (quando acontecem) · respostas das consultas
   ▼
ponte.js  ──►  loja.js (sinais)  ──►  componentes (Preact)  ──►  DOM
   ▲                                        │
   │  pedidos (ações e consultas, com Promise)   │ toque, teclado
   └──────────────  acoes.js  ◄─────────────┘
                        │
                        ▼
                   Render (API R): ferramentas, camadas, marcadores, câmera, seleção
```

- A interface **nunca** lê o estado interno da simulação nem objetos do three. Lê sinais; escreve por `acoes.js`.
- **Consultas assíncronas desde o primeiro dia** (`await consultas.predio(id)`): com a simulação na thread principal
  elas resolvem na hora; num worker, por mensagem. A troca não mexe na interface.
- **Validação das ferramentas é síncrona** (roda a cada movimento do dedo): funções puras da simulação (`validarVia`,
  `validarColocar`, `celulasQuadra`) importadas também na thread principal.

### 12.3 Loja

```js
// fonte/ui/loja.js
import { signal, computed, batch } from '@preact/signals';
export const resumo = signal(RESUMO_VAZIO);   // créditos, renda, população, bem-estar, demanda, data, velocidade, marco, alertas
export const selecao = signal(null);          // { tipo, id }
export const detalhe = signal(null);          // resposta da consulta do selecionado (2 vezes por segundo com a folha aberta)
export const ferramenta = signal(null);       // { tipo: 'via'|'zona'|'colocar'|'demolir', ...estado da máquina }
export const tela = signal(null);             // 'holding'|'economia'|'cidade'|'progresso'|'conselho'|'transporte'|null
export const camada = signal(null);
export const avisos = signal([]);             // toasts
export const mural = signal([]);
export const decisoes = signal([]);
export const prefs = signal(lerPrefs());      // localStorage separado do save
export function aplicarResumo(r) { batch(() => { resumo.value = r; }); }
```

```jsx
// fonte/ui/hud/Creditos.jsx
const valor = computed(() => fmt.creditosBarra(resumo.value.creditos));
const renda = computed(() => fmt.porHora(resumo.value.rendaHora));
export const Creditos = () => (
  <Botao a="economia" rotulo={t('hud.creditos')} class="item">
    <Glifo n="creditos" class="ch" />
    <span class="pilha"><b class="num">{valor}</b><small class="num">{renda}</small></span>
  </Botao>
);
```

Passar o sinal (`{valor}`) em vez de `{valor.value}` faz o Preact trocar só o texto, sem redesenhar o componente.

### 12.4 Ações e motivos

```js
// fonte/ui/acoes.js
export async function construirVia(tracado) {
  const r = await sim.pedir('via.construir', tracado);      // { ok: true, id } | { ok: false, motivo, dados }
  if (!r.ok) avisar(t('motivo.' + r.motivo, r.dados), 'erro');
  else som.construir();
  return r;
}
```

- Toda ação devolve `ok` ou um **motivo com código** (`sem_creditos`, `cruza_agua`, `declive`, `marco`, `sem_acesso`...);
  `textos.js` tem a frase de cada código e, quando houver, o "Ir". Um teste confere que todo código tem texto.
- Todo elemento que age tem `data-a` (e `data-k` quando há chave): o robô e a vitrine clicam por eles.

### 12.5 O que roda a cada quadro

- A interface não tem laço próprio. O laço principal chama `ui.quadro(t)` depois de `R.quadro(t)`, que só:
  1. posiciona rótulos e cotas com `transform` a partir de `R.ancoras()` (até 40);
  2. redesenha a lupa (só com o dedo apoiado);
  3. anima a contagem dos números (quando há).
- O resto é por evento ou pelo resumo de 4 por segundo, em `batch()`.

### 12.6 Desempenho no celular

- **Metas:** interface até 1,5 ms por quadro em repouso e 3 ms com ferramenta ativa no Poco X7 (medido pelo "UI ms" do
  painel de desempenho); até 600 nós no DOM em repouso e 2.500 com uma tela de gestão aberta; nenhuma tarefa acima de
  50 ms depois da carga (`PerformanceObserver` de tarefas longas no painel).
- **Regras:** sem `backdrop-filter` no celular; animação só com `transform` e `opacity`; nenhuma leitura de layout no
  laço (posições vêm do render); `contain: layout paint style` em folhas, telas e bandeja; `will-change` só nos rótulos
  do mundo; sombras grandes só em elementos parados; listas acima de 50 linhas virtuais (Mural, imóveis, problemas);
  gráficos redesenhados só ao abrir e uma vez por minuto do jogo.
- **Render "coberto":** com uma tela de gestão aberta, a interface chama `R.estado('coberto')` e o render baixa para
  poucos quadros por segundo (ele já tem limite por estado); a bateria agradece.

### 12.7 Acessibilidade

- Semântica real: `button`, `role="tablist"` e `tab`, `dialog` com `aria-modal`, `aria-label` nos botões de glifo (vem
  de `textos.js`), `aria-live="polite"` nos avisos. Ajuda o teclado e os testes.
- Foco visível: contorno de 2 px `--ac` com 2 px de folga. Tab percorre a tela aberta; Esc fecha a de cima.
- Tamanho da interface em 4 passos, alto contraste, reduzir movimento (segue o sistema), paleta das camadas para
  daltonismo, estado sempre com forma e glifo, alvos de 44 px no toque.

### 12.8 Textos e formatação

- `fonte/ui/textos.js`: todas as frases, por chave, com parâmetros (`t('motivo.sem_creditos', { faltam: 1200 })`).
  Proibido "—" e "–" (teste). Nomes próprios e números seguem as regras da seção 5.
- `fonte/ui/formato.js`: números, créditos (cheio e curto), por hora, porcentagem, durações, datas do calendário.

### 12.9 Montagem

- `package.json`: `preact` 10.29.8, `@preact/signals` 2.11.2, `@fontsource-variable/inter` 5.3.0 (só o woff2 latino e o
  `OFL.txt` são copiados), versões fixas.
- `montar.mjs`: `jsx: 'automatic'`, `jsxImportSource: 'preact'`; CSS da interface juntado num arquivo (no `app/`) ou
  num `<style>` (no HTML único); a fonte vira arquivo com carimbo no `app/` (no cache do `sw.js`) e base64 no HTML único
  (uns 64 KB); `preload` da fonte no `index.html`. As saídas dos workers são do render e da simulação.

---

## 13. Testes

### 13.1 Render falso

`ferramentas/vitrine/render-falso.js` implementa a API `R` sem WebGL: um canvas 2D com um fundo (captura de uma cena da
bancada do render guardada em `ferramentas/vitrine/fundos/`, ou degradê enquanto ela não existe), `projetar` e `ancoras`
por uma câmera fixa de mentira, `selecionar` contra as caixas da cidade sintética, marcadores desenhados com o mesmo
atlas de glifos, `bancada()` com um resultado pronto. Serve à vitrine e ao robô rápido.

### 13.2 Vitrine

`ferramentas/vitrine-ui.mjs` (reescrito): monta a interface com o render falso e o estado da simulação (real, ou a cidade
sintética do render enquanto a simulação não existe), abre cada cena e captura em **986 x 443, 915 x 412, 1376 x 768 e
1920 x 1080**. Cerca de 1 s por captura.

- **Cenas:** repouso, pausado, bandeja de serviços, via (mirando, prévia com alças, inválida), zona (preencher, pincel),
  colocar, demolir, cartão e folha de cada tipo, menu de contexto, marcadores, faixa de alerta, avisos, Mural, camadas
  (uma de cada rampa), Holding (cada aba), Economia (orçamento, empréstimo), Cidade (demanda, bem-estar, problemas),
  Progresso (marcos, Livro), decisão do Conselho, marco alcançado, etapa da Arcologia, configurações (vídeo, resultado
  do teste de desempenho), modo foto, carga, girar, menu inicial, nova partida, menu, primeira hora (5 passos).
- **Medidas por cena** (JSON), com meta:

| Medida | Meta |
|---|---|
| Erros de página | 0 |
| Alvos de toque abaixo de 44 px (celular) ou 32 px (PC) | 0 |
| Textos abaixo de 12 px | 0 |
| Contraste de cada texto sobre o pior fundo (vidro sobre branco) | 4,5:1 abaixo de 17 px; 3:1 acima |
| Transbordo (texto cortado sem reticências) | 0 |
| Sobreposição entre grupos do HUD | 0 |
| Área do HUD em repouso | até 15,5% (986 x 443) e 16,5% (915 x 412) |
| Faixa livre para o mundo | ao menos 340 px (443) e 310 px (412) |
| Travessão ("—" ou "–") no texto visível | 0 |
| Chave de texto faltando ("??") | 0 |
| Nós no DOM | até 600 em repouso |
| Ações principais na zona do polegar (celular) | todas |

### 13.3 Testes em node (entram no `simular --testes`)

- `gestos`: sequências sintéticas de ponteiros → gesto certo (toque, arrasto, pinça, giro, toque longo; com e sem
  ferramenta).
- `encaixe` e máquina da via: casos de nó, cruzamento, 90°, 45°, prolongamento, distância de quadra, curva pela alça,
  contínua, cancelar.
- `formato`: pt-BR, sinais, forma curta, nenhum `NaN`.
- `textos`: todo código de motivo com texto; nenhum travessão; nenhuma chave usada sem texto.
- `glifos`: todo nome usado no código existe; SVG válido.
- `tokens`: contraste dos pares de tokens sobre os piores fundos (o cálculo da seção 1).

### 13.4 Robôs

- **Robô rápido** (interface, simulação e render falso, sem WebGL, poucos minutos): joga a primeira hora pela interface
  de verdade, clicando por `data-a` e fazendo gestos no canvas (`window.__ui.gesto(...)` gera eventos de ponteiro a partir
  de pontos do mundo por `R.projetar`): traça as vias, zoneia por Preencher, coloca serviços, abre todas as telas, toma
  empréstimo, faz uma ordem de lote, decide no Conselho, inicia a etapa 1. Aceite: marco 3, 0 erros, todas as telas
  abertas, cada ferramenta usada ao menos uma vez por gesto.
- **Robô completo** (render real no Chromium de teste, qualidade Leve): o mesmo roteiro encurtado, só como fumaça (5 a
  15 min, em segundo plano).
- Gancho de teste só com `?teste=1`: `window.__ui = { estado(), acionar(a, k), gesto(tipo, pontos), cena(nome) }`.

### 13.5 No aparelho

O dono roda o Teste de desempenho e manda o resultado; o "UI ms" confere a meta da seção 12.6.

---

## 14. Módulos e arquivos

```
fonte/ui/
  index.jsx              criarUI(raiz, { sim, render }): monta tudo, liga a ponte, devolve { quadro(t) }
  ponte.js               recebe resumo e eventos da simulação, aplica na loja; manda pedidos
  loja.js                sinais (seção 12.3)
  acoes.js               comandos para a simulação e o render (única porta de saída)
  consultas.js           consultas assíncronas (predio, economia, holding, cidade, catalogo...)
  textos.js              frases em pt-BR por chave
  formato.js             números, créditos, datas, durações
  prefs.js               preferências locais (tamanho, som, dicas vistas, teclas)
  tema/
    tokens.css  base.css  componentes.css  hud.css  folha.css  telas.css  mundo.css
    fontes/inter-latin-wght-normal.woff2  OFL.txt
  glifos/
    glifos.js            registro dos glifos SVG
    Glifo.jsx
    atlas.js             atlas dos avisos para o render
  comp/                  Botao, BotaoGlifo, Interruptor, Segmentado, Deslizante, Quantidade, DoisToques, Barra, Chip,
                         Linha, Tabela, Abas, Popover, Dica, Folha, Tela, Modal, Aviso, Vazio, Grafico, Indicador
  hud/
    BarraCima.jsx  Velocidade.jsx  Trilho.jsx  Construcao.jsx  Bandeja.jsx  BarraFerramenta.jsx
    Objetivo.jsx  FaixaAlerta.jsx  Avisos.jsx  Menu.jsx
  mundo/
    Rotulos.jsx  Cotas.jsx  Lupa.jsx  MenuContexto.jsx  marcadores.js (escolhe o que o render mostra)
  ferramentas/
    gestos.js            modos da entrada (câmera ou ferramenta) e eventos para a ferramenta ativa (puro)
    encaixe.js           geometria do encaixe (puro)
    via.js  zona.js  colocar.js  demolir.js   máquinas de estado (puras)
  selecao/
    Cartao.jsx  Folha.jsx  secoes/ (residencial, comercial, industrial, servico, empresa, arcologia, via, terreno)
  telas/
    Holding.jsx  Economia.jsx  Cidade.jsx  Progresso.jsx  Conselho.jsx  Transporte.jsx  Mural.jsx  Camadas.jsx
    Configuracoes.jsx  TesteDesempenho.jsx  Foto.jsx  Decisao.jsx  Momento.jsx (marco e etapa)
  inicio/
    carga.js (sem Preact: primeiro quadro)  MenuInicial.jsx  NovaPartida.jsx  Girar.jsx  Abertura.jsx
  guia/
    objetivos.js  dicas.js  sugestoes.js   primeira hora (seção 10)
fonte/som/
  som.js                 mixer, canais, ambiente pela câmera
  interface.js  mundo.js  musica.js
ferramentas/
  vitrine-ui.mjs         (reescrito) cenas e medidas
  vitrine/render-falso.js  vitrine/fundos/  vitrine/cenas.js
  robo-rapido.js  robo-partida.js
  teste-ui.mjs           testes em node da seção 13.3 (chamado pelo simular --testes)
```

Reaproveitado do jogo atual como ideia (não como código preso): a forma do salvamento em `core/salvar.js`
(localStorage e IndexedDB, exportar e importar, trava de importação), o som procedural de `core/audio.js`, o
`core/vibra.js`, a vitrine sem WebGL e o robô no Chromium.

---

## 15. Contratos com as outras partes

### 15.1 Simulação → interface

```js
// resumo, 4 vezes por segundo (e na hora, depois de uma ação)
resumo = {
  creditos, rendaHora,                    // rendaHora com sinal, "por hora" no sentido que a simulação fixar
  populacao, popDia,
  bemEstar, faixa: { tarifa: 5|8|11, de, ate },
  demanda: { R, C, I, E },                // 0 a 100
  data: { dia, mes, ano, hora },          // hora visual 0 a 24
  velocidade: 0|1|2|3,
  marco: { n, nome, xp, xpProx },
  valuation, divida, caixaHolding,        // PC mostra na barra
  alertas: [{ id, gravidade, glifo, texto, alvo }],
  decisoesPendentes, muralImportantes,
}
// eventos, quando acontecem
{ t: 'aviso', gravidade, texto, alvo }      { t: 'mural', post }
{ t: 'marco', n, premios, libera }          { t: 'decisao', evento }
{ t: 'etapa', estrutura, etapa, de }        { t: 'avisosPredios' }  // mudou a lista de marcadores
{ t: 'construido' | 'demolido', tipo, id }
// consultas (Promise)
predio(id) · via(id) · lote(id) · distrito(id) · economia() · holding() · producao() · mercado() · cidade() ·
progresso() · livroArcologia() · catalogo(categoria) · camada(nome) (já no formato do render, seção 14.1 dele) ·
avisosPredios() -> [{ idx, glifo, gravidade }] · viasPerto(x, z, raio) (lupa e encaixe) · sugestoes() (primeira hora)
// funções puras e síncronas (importadas na thread principal)
validarVia(tracado) -> { ok, motivo, comprimento, custo, manutencao, cruzamentos, demolir }
validarColocar(tipo, x, z, giro) -> { ok, motivo, frente, giro, custo }
celulasQuadra(x, z) -> [celulas]
```

### 15.2 Interface → simulação (ações; todas devolvem `{ ok }` ou `{ ok: false, motivo, dados }`)

```
velocidade(v) · via.construir(tracado) · via.desfazer() · zona.pintar(celulas, zona) · construir(tipo, x, z, giro) ·
demolir(ids) · etapa.iniciar(estrutura) · empresa.produzir(id, produto, lote 1 a 10, auto) · mercado.comprar(item, n) ·
mercado.vender(item, n) · emprestar(v) · pagarJuros() · pagarParcela() · quitar() · decidir(evento, opcao) ·
cor(id, cor) · renomear(id, nome) · salvar(espaco) · carregar(espaco) · exportar() · importar(arquivo)
```

### 15.3 Interface ↔ render

Uso a API da seção 14.2 da `desenho-render.md` e peço cinco acréscimos pequenos:

1. **`R.entrada.modo('camera' | 'ferramenta')`** e **`R.entrada.aoFerramenta(fn)`**: com ferramenta, 1 dedo vai para a
   ferramenta (`{ fase: 'inicio'|'move'|'fim', x, y, ponto }`, com o ponto do chão já calculado) e 2 dedos movem a
   câmera sem inclinar. Mais o deslocamento da mira (`deslocY`) e a rolagem pela borda (`bordaPx`).
2. **`R.selecionar`** testa os marcadores primeiro (22 px de tela) e devolve `{ tipo: 'marcador', idx, glifo }`.
3. **`R.estado('livre' | 'coberto' | 'foto' | 'teste')`** para o limite de quadros e para esconder o que a foto não quer.
4. **`R.marcadores.atlas(canvas, mapa)`**: a interface entrega o atlas dos glifos (seção 6.3).
5. **`R.miniatura(modelo, 128)`** (M2): imagem do catálogo renderizada uma vez.

E confirmo as escolhas dele: avisos no WebGL; rótulos, cotas, lupa e painéis no DOM; legenda das camadas desenhada pela
interface com a rampa passada ao render; `R.bancada()` devolvendo `{ perfil, sugerido, msMedio, p95, qps, calls, tris,
gpu, capac }` para a tela do Teste de desempenho.

---

## 16. Escopo e parcelas

### 16.1 M1 e depois

| Entra no M1 | Fica para depois |
|---|---|
| Fundação (Preact, tokens, Inter, ~130 glifos, loja, ações, textos, formato) | miniaturas 3D do catálogo (M2) |
| Barra de cima com velocidade e pausa; trilho; faixa de alerta; avisos | Mural com cidadão seguido, à Chirper (M2) |
| Construção: categorias, bandeja, catálogo com glifos | Transporte com linhas (quando a simulação tiver) |
| Ferramentas: via (reta, curva pela alça, contínua, encaixe, lupa, cotas, desfazer), zona (preencher, pincel, retângulo, apagar), colocar, demolir | grade de vias, substituir, melhorias de via (M2); elevação, pontes, rotatórias e trevos prontos (M3) |
| Seleção: cartão e folha para todos os tipos do M1; menu de contexto | distritos e políticas (M2) |
| Marcadores (lista e filtro), rótulos, lista de problemas | |
| Camadas do M1 (3 a 4) | as outras camadas |
| Telas: Holding (visão geral, divisões do M1, produção com lotes, mercado, imóveis), Economia, Cidade, Progresso (marcos e Livro da Arcologia), Conselho | Rivais e relações (M2); câmara, leis e eleições (M3 em diante) |
| Momentos: marco, etapa, decisão | |
| Configurações completas com o Teste de desempenho | |
| Modo foto básico | modo foto avançado (M2, com o render) |
| Carga, menu inicial com capa, nova partida, menu, salvar, carregar, exportar, importar | nuvem (fase de apps) |
| Primeira hora: objetivos, dicas, sugestões, abertura | |
| Som e vibração | |
| Acessibilidade da seção 12.7; teclado completo no PC | |
| Vitrine, testes em node, robô rápido e robô completo | |

### 16.2 Parcelas

Cada parcela edita só os seus arquivos, testa com o render falso e o estado sintético, e fecha com a vitrine das suas
cenas (sem erros, alvos, textos, contraste, transbordo).

| # | Parcela | Entrega | Tamanho | Depende de |
|---|---|---|---|---|
| U0 | **Fundação** | dependências, tokens, Inter, base CSS, primitivas, glifos de sistema, loja, ações e consultas com a simulação falsa, textos, formato, prefs, render falso, vitrine nova com as medidas, `teste-ui.mjs` | M | nada |
| U1 | HUD | barra de cima com velocidade, trilho, construção (sem ferramentas), objetivo, faixa, avisos, menu | M | U0 |
| U2 | Entrada e seleção | modos da entrada (com a R10 do render), menu de contexto, cartão e folha com as seções por tipo | M | U0 (render R10 ou falso) |
| U3 | **Ferramenta de via** | máquina, encaixe, mira, lupa, cotas, alças, contínua, desfazer, bandeja de vias, rolagem pela borda | G | U1, U2 (render R5 e R11 para a prévia real) |
| U4 | Zona, colocar e demolir | preencher, pincel, retângulo, apagar; fantasma com frente de via; demolir | M | U3 (a entrada e a barra da ferramenta) |
| U5 | Mundo informativo | marcadores (atlas e lista), rótulos, camadas com legenda, lista de problemas | M | U1 (render R11) |
| U6 | Economia e Cidade | telas, gráficos em SVG, empréstimo com as regras do dono | M | U1 |
| U7 | **Holding e Arcologia** | Holding (visão geral, divisões, produção com lotes, mercado a 150%, imóveis), folha da empresa, Livro da Arcologia, folha da Arcologia | G | U1, U2 |
| U8 | Progresso, Conselho e Mural | marcos, decisões, histórico, Mural, momentos | M | U1 |
| U9 | Sistema | configurações com o Teste de desempenho, modo foto básico, carga, menu inicial com capa, nova partida, salvar e carregar | M | U1 (render R0 para a bancada) |
| U10 | Primeira hora | objetivos, dicas com mão fantasma, sugestões, abertura | M | U3 a U8 |
| U11 | Som e vibração | mixer, interface, ambiente pela câmera, música generativa | P | U0 |
| U12 | Aceite | robô rápido e completo, vitrine inteira nos 4 tamanhos, README, capturas para o dono | M | todas |

Ordem: U0 primeiro (publica os contratos). Depois em paralelo U1, U2, U11. Em seguida U3, U5, U6, U7, U8, U9 (U4 logo
depois de U3). U10 e U12 fecham. O caminho crítico é U0 → U2 → U3 → U4 → U10: a ferramenta de via no celular é o risco
maior e deve chegar ao dono como protótipo jogável cedo.

### 16.3 Aceite do M1 (interface)

- Vitrine sem falhas nas medidas da seção 13.2, nos 4 tamanhos.
- Robô rápido chega ao marco 3 pela interface, sem erros; robô completo passa como fumaça.
- No Poco X7: "UI ms" até 1,5 ms em repouso e 3 ms com ferramenta ativa; o dono traça uma avenida com curva e zoneia
  duas quadras só com os polegares e aprova as capturas.

---

## 17. Riscos

| Risco | Efeito | Plano |
|---|---|---|
| Precisão da via no polegar | frustração no gesto que define o gênero | mira deslocada, lupa, encaixe com vibração, alças antes de construir, Preencher nas zonas; protótipo da U3 no aparelho do dono antes de seguir |
| Dois dedos para mover a câmera com ferramenta | quem espera arrastar com um dedo se perde | dica na primeira vez; rolagem pela borda; opção "tocar e segurar 300 ms para mover" se o dono estranhar |
| Números grandes em 915 px | barra de cima estoura | forma curta a partir de 10 milhões (medido: 66 px); a vitrine mede o transbordo |
| Contrato da simulação indefinido | telas sem dados reais | simulação falsa na U0 com o formato da seção 15; as telas dependentes de regra nova (impostos, verbas, trânsito) só aparecem se a simulação tiver |
| Relógio com pausa mexe nas regras do dono | "por hora" e "por ano" mudam de sentido | proposta na seção 18: 1x igual ao de hoje; decisão do dono |
| Voltar pela borda do Android | o jogo fecha no meio de um traçado | armadilha no histórico (seção 7.5) |
| Dependência do Preact | atualização quebrar | versões fixas; plano B da seção 12.1 |
| Marcadores no WebGL | toque neles depende do render | `selecionar` com marcadores primeiro (seção 15.3); no render falso, a mesma regra |
| Muita coisa no M1 | a interface atrasar o render | parcelas com render falso andam sem esperar; U3 cedo |

---

## 18. Dúvidas que o integrador precisa fechar

1. **Relógio (simulação e dono):** entra pausa e 1x, 2x, 3x? Proposta: toda regra corre no relógio da simulação, e 1x
   anda igual ao relógio de hoje (renda por hora e ano do empréstimo iguais aos de hoje em 1x; 2x e 3x aceleram tudo
   junto; pausa para tudo). Fechado, continua o de hoje (50% por até 12 h)? O ciclo visual de dia e noite dura um mês do
   calendário (10 min em 1x com o dia de 20 s), como no CS2? O save guarda a velocidade ou o jogo sempre abre em 1x?
2. **Categorias e itens do M1 (simulação):** quais serviços existem (água, esgoto, energia, lixo, saúde, educação,
   polícia, bombeiros, administração, comunicação)? Há transporte no M1? Há compra de áreas do mapa (ladrilhos de 512 m
   do render) no M1? Categoria sem item fica fora da barra.
3. **Impostos e verbas (simulação e dono):** entram imposto de comércio, escritório e indústria e verba dos serviços de
   50 a 150%? A interface só mostra se houver; a renda por morador (5, 8, 11) nunca vira imposto.
4. **Produção e Depósito no jogo novo (simulação):** quais empresas produzem por ordem de lote (1 a 10)? O Depósito é um
   prédio no mapa ou só a aba Mercado? Quanto dura a janela das 100 vendas?
5. **Arcologia no M1 (simulação e arquitetura):** estruturas e etapas do M1 (o render fala em Torre Lâmina, Torres do
   Conselho, Sede e lago), o que cada etapa pede (marco, créditos, materiais das cadeias) e se alguma parte da Arcologia
   pode ser demolida.
6. **Desfazer (simulação):** reembolso integral enquanto a obra não começou? Por quanto tempo?
7. **Simulação em worker no M1?** A interface já nasce com consultas assíncronas; as validações das ferramentas precisam
   ser funções puras importáveis na thread principal (`validarVia`, `validarColocar`, `celulasQuadra`, `viasPerto`).
8. **Entrada (render):** aceita o `R.entrada.modo` com os eventos de ferramenta, o `deslocY` da mira e a rolagem pela
   borda (seção 15.3)? Quem é dono do árbitro de gestos fica com o render.
9. **Marcadores (render):** `selecionar` com marcadores primeiro e o atlas vindo da interface?
10. **Camadas do M1 (simulação e render):** quais 3 ou 4? Proposta: zonas, cobertura de serviços, água e energia, e valor
    do terreno se a simulação tiver valor por lote.
11. **Sugestões da primeira hora (simulação ou mapa):** o mapa traz a primeira via, as primeiras quadras e o lugar da
    bomba d'água como dados (`sugestoes()`)?
12. **Narrativa (roteirista):** textos da abertura e das dicas, papéis dos personagens (seção 10.5), a diretora
    financeira, nomes dos marcos, se há rival no M1 ou só a nota no Mural, autores do Mural.
13. **Nome e cor da Holding (dono e render):** editáveis na nova partida? A cor da marca vai para bandeiras, helicóptero
    e cor padrão dos prédios da Holding no render?
14. **Save e preferências (render e simulação):** proposta: preferências (qualidade, som, interface, teclas, dicas vistas)
    no localStorage, fora do save; câmera e velocidade no save; capa do save (JPEG pequeno) junto.
15. **Dependências (integrador):** aceita `preact`, `@preact/signals` e `@fontsource-variable/inter` com versões fixas e
    as mudanças no `montar.mjs` da seção 12.9?
16. **Perfil do Poco X7 (render e dono):** Média como padrão, confirmada pelo Teste de desempenho no aparelho antes de
    publicar o M1.

---

## 19. Fontes

- Pesquisa de interface com as fontes numeradas: `scratchpad/cs2/ui.md`, seção 7 (citadas aqui como [ui n]).
- Sistemas do CS2: `scratchpad/cs2/sistemas.md`; motor e API do render: `scratchpad/cs2/desenho-render.md`.
- Medidas desta parte: `scratchpad/cs2/ui-medidas/` (`app.jsx` para o peso do Preact, `larguras.mjs` para as larguras
  de texto, `node_modules/@fontsource-variable/inter` para a fonte).
- Paletas e contraste: validador `scripts/validate_palette.js` da skill de gráficos (método Machado, Oliveira e
  Fernandes 2009 para daltonismo; contraste WCAG).
- Código consultado: `fonte/sim/estado.js` (relógio e renda), `fonte/data/historia.js` (personagens), `fonte/core/`
  (salvamento, som, vibração), `ferramentas/vitrine-ui.mjs`.
