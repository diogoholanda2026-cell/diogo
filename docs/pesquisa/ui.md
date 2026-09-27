# Frente Interface: da UI BuildIt para uma UI no nível do Cities: Skylines II

Documento da frente de interface (UI/UX) do pedido "abandone o estilo SimCity BuildIt e chegue o mais perto possível do
Cities: Skylines II". Escrito em 27/09/2026 a partir do código em `fonte/ui/`, `fonte/jogo.js`, `fonte/web/index.html`, das
capturas da vitrine (`scratchpad/trevo/vui/`, 130 cenas) e de pesquisa na web (fontes no fim, seção 7).

## 0. Resultado em uma página

- **Direção:** interface de ferramenta profissional, como a do CS2: vidro grafite escuro, texto claro, um acento azul
  para interação e um champanhe só para dinheiro e prestígio. Sai tudo que é de BuildIt: fonte Baloo 2, texto com
  contorno, botões redondos coloridos com volume, papel creme, latão, confete, balões grandes e ícones de plástico.
- **Layout no celular (986 x 443 e 915 x 412):** estado da Holding no alto à esquerda, sistema no alto à direita,
  objetivo embaixo à esquerda (polegar esquerdo), barra de ferramentas embaixo à direita com Obras como botão primário
  (polegar direito), folha de detalhes à esquerda (o "painel de seleção" do CS2). Faixa livre para o mundo: 347 px de
  altura em 443 e 316 px em 412.
- **Tipografia:** Inter (licença OFL), uma família só, mínimo de 12 px, números tabulares.
- **Ícones:** um sistema só de glifos de traço (SVG, grade de 24, traço de 1,75), entregues pela mesma API de hoje
  (`img()` e `icone()`), então os chamadores não mudam. Itens ganham um chip com a cor da família. Retratos viram
  monogramas.
- **Balões viram marcadores** de 30 px (alvo de 44 px) com haste até o prédio, cor e forma por estado, como as
  notificações sobre os prédios do CS2, com a opção de mostrar só os importantes.
- **Novidades tiradas do CS2:** Camadas (as "info views"), Mural (o "Chirper" dos conselheiros e eventos), Progresso
  (marcos: capítulos e níveis), Finanças na barra, Estatísticas com gráficos, "Localizar" nos painéis e atalhos no PC.
- **Nada de mecânica some.** Cada função de hoje tem lugar na UI nova (tabela da seção 2). A única retirada é o
  Comparar com a foto de referência e a miniatura da foto nos painéis, porque o dono liberou abandonar as imagens de
  referência.
- **Desempenho:** sem `backdrop-filter` no celular (custa uns 3,5 ms por quadro no Chrome do Android sobre WebGL, medido
  num Galaxy A15), animações só com `transform` e `opacity`, DOM escrito só quando muda (como hoje).
- **Plano:** 17 parcelas (U0 a U16), cada uma aceita pela vitrine (sem erros de página, alvos de 44 px ou mais, texto de
  12 px ou mais) e pelas medidas novas de contraste e de área do HUD.

## 1. Pesquisa

Observação sobre o método: o proxy daqui bloqueia a maior parte dos sites para leitura direta. Os fatos abaixo vêm dos
resumos da busca (WebSearch) com a URL de origem, e das páginas do GitHub, que abrem normalmente. O que é observação
minha de jogo, sem fonte aberta, está marcado como tal.

### 1.1 Cities: Skylines II

**Tecnologia.** A UI do CS2 roda sobre o Coherent Gameface: HTML, CSS e JavaScript, escrita em React com SCSS e
TypeScript. O layout aceita só flexbox (sem grid). A unidade de referência é 1 rem ≈ 1 px em Full HD. Os pontos de
encaixe da UI para mods são as áreas flutuantes do alto à esquerda, do alto à direita e de baixo à direita
(`GameTopLeft`, `GameTopRight`, `GameBottomRight`). Conclusão para nós: a nossa UI em DOM está no mesmo caminho técnico
da do CS2. Não precisamos de outra tecnologia, só de outro desenho. [1]

**Estrutura da tela.**

| Parte | No CS2 | Fonte |
|---|---|---|
| Info views | botão "i" no alto à esquerda; mostram poluição (solo, água, ruído), valor do terreno, recursos naturais, distritos, cobertura de serviços | [2][3] |
| Estado da cidade | embaixo: data com as setas de velocidade (normal, rápido, mais rápido), dinheiro e população com setas de tendência | [4][5] |
| Progresso | barra de XP embaixo à esquerda; o toque abre o painel de marcos (o que cada marco pede e libera) | [6] |
| Barra de ferramentas | embaixo, por categoria (estradas, zonas, serviços, transporte, parques...), com miniaturas de 128 x 128 dos prédios | [7] |
| Painel do selecionado (SIP) | do lado esquerdo; abas Info e Personalizar; custo de manutenção, eficiência, trabalhadores, felicidade da família | [8][9] |
| Chirper | feed de posts de cidadãos e serviços com curtidas (mais curtidas, mais gente com o mesmo problema); cidadãos seguidos numa lista abaixo dele, à direita | [10][11] |
| Economia | painel com orçamento (receitas, despesas, saldo mensal com detalhe ao passar o mouse), impostos e um empréstimo único ajustado por um controle deslizante | [12] |
| Modo foto | câmera embaixo à direita; abas Câmera (corpo, lente, distância focal), Lente (profundidade de campo, desfoque de movimento, bloom, vinheta, grão), Cor (ajustes, balanço de branco, brilho), Clima e Ambiente (hora do dia, velocidade) | [13][14][15] |
| Notificações sobre os prédios | ícones redondos sobre prédios e vias com o problema ("sem acesso à rua", "poucos clientes": ícone azul com pessoa e cédula) | [16][17] |

**O que a comunidade elogia.** A UI é "fácil de navegar" e explica a construção da cidade sem atrito [18]. As
ferramentas de estrada são o ponto mais elogiado: "um prazer de usar", "mágica", intuitivas [19][20]. Os marcos com
pontos de desenvolvimento deram um motivo claro para crescer [6].

**O que a comunidade critica (lições diretas para nós).**

1. **Setas no lugar de números.** Nos vídeos de divulgação a renda e a população por hora apareciam como número; no
   lançamento viraram setas. Jogadores relatam "três setas verdes para cima e ainda perdendo dinheiro". [5][21]
   Lição: mostrar sempre o número (+3.840/h), nunca só a seta.
2. **Botão de pausa e play ambíguo:** não fica claro se o botão mostra o estado atual ou o que vai acontecer. [22]
   Lição: botões de alternância mostram o estado com rótulo ("Auto: ligado"), não um verbo solto.
3. **Notificações e Chirper poluem a tela.** Ícones de queixa sobre prédios sem problema aparente, pedidos de "como
   esconder os ícones de aviso", e o Chirper tem opção para desligar os pop-ups. [16][23][24][25] Lição: marcadores
   pequenos, agrupados, com filtro "só importantes", e falas com opção de irem direto para o Mural.
4. **A complexidade da simulação não aparece na UI.** [22] Lição: todo número importante tem um "de onde vem" a um
   toque (o nosso toque longo e os popovers de renda e bem-estar já fazem isso; manter).
5. **Mapa de calor que satura:** a camada de valor do terreno usa só 10 faixas até 500 e fica toda verde e azul nas
   cidades grandes, a ponto de um mod refazer a escala. [26] Lição: escala de cada camada ajustada ao nosso intervalo.
6. **Texto pequeno e escala da interface só em modo de desenvolvedor.** [27] Lição: 12 px mínimo e tamanho da
   interface nas Configurações com 4 passos (o Anno 117 dá 5 tamanhos de texto [30]).
7. **Falta um painel-resumo:** mods como o City Stats existem porque o jogo não mostra as estatísticas da cidade de
   relance. [28] Lição: o nosso painel Estatísticas (seção 3.8) junta tudo numa tela.
8. **Dependência do mouse (passar por cima para ver detalhes).** [12] No celular não existe "passar por cima": o toque
   longo faz esse papel (já temos, com 500 ms), e o PC ganha o hover.

**Correções que o próprio CS2 fez depois do lançamento:** dicas de atalho de teclado dentro das dicas dos botões, com
opção de desligar (patch 1.1.10f1), e várias correções de rolagem do Chirper e do conselheiro de tutoriais. [29]

### 1.2 Highrise City

- O foco é a cadeia de produção: extrair, refinar e transformar recursos, cada um com dependências próprias. [31]
- Os recursos e o monitor de recursos ficam na barra de cima (símbolo de pacote à direita). [32]
- A crítica mais comum: UI "confusa no começo", logística "profunda quase demais". [33][34]
- Lição: as nossas cadeias são curtas (usinas, oficinas, prancha). A UI deve mostrar a cadeia como linhas "insumo →
  produto" e ligar cada item a quem o produz num toque (já existe em `irProdutor`; a UI nova dá mais destaque).

### 1.3 Outros jogos com UI forte

| Jogo | O que vale para nós | Fonte |
|---|---|---|
| Anno 117 | a palavra-guia da equipe de UI foi "elegância" (polida, delicada, refinada); 1.700 ícones feitos para serem legíveis em tamanho pequeno; 5 tamanhos de texto; ajustes para daltônicos. Crítica: não dá para ver todos os recursos de relance, e as cadeias pedem cliques e rolagens a mais | [30][35][36] |
| Anno 1800 | a tela de Estatísticas (5 abas: ilhas, população, produção, finanças, comércio) substituiu as calculadoras de fora | [37] |
| Frostpunk 2 | reforma da HUD depois do beta para ficar "mais clara e intuitiva"; fontes e layout refeitos; no controle, um menu radial de três opções com indicadores de progresso | [38][39][40] |
| Manor Lords | "denso de informação, fácil de navegar"; duas cores neutras parecidas nas áreas principais e uma terceira, contrastante, só quando é preciso chamar a atenção | [41][42] |
| Workers & Resources | o contraexemplo: UI poluída, ícones espalhados e minúsculos, letra pequena mesmo em 2560 x 1440, clique para tudo | [43][44] |
| Against the Storm | refez a UI para ganhar legibilidade e depois trouxe de volta o calor da antiga; camada de recursos ao segurar uma tecla | [45][46] |
| Pocket City 2 (celular) | toque "quase perfeito"; crítica: coisas enterradas em menus | [47] |
| Frostpunk: Beyond the Ice (celular) | HUD bem organizada, informação essencial visível; crítica: ter de tocar para coletar recurso é chato | [48][49] |

### 1.4 Toque, polegar e desempenho

- Alvo de toque: 44 pt no iOS, 48 dp no Android; 48 px CSS atende os dois e o WCAG AAA. [50]
- Em paisagem, o alcance confortável dos polegares vai para as laterais e os cantos de baixo; o terço de cima é a zona
  difícil nos aparelhos grandes. [51][52]
- `backdrop-filter: blur()` sobre WebGL no Chrome do Android: 3,5 ms por quadro a mais no processo da GPU (8,2 contra
  4,7 ms), 75 a 80% dos quadros a 90 Hz contra 99,9% sem o desfoque, e o dobro de memória (500 contra 250 MB).
  Correção do autor: tirar o desfoque abaixo de 600 px de largura. [53][54]

### 1.5 O que levamos

| Princípio | De onde vem | Como aplicamos |
|---|---|---|
| Interface de ferramenta, sóbria, com o mundo como protagonista | CS2, Anno 117 | vidro grafite, sem ornamento, sem cor saturada fora de estado |
| Duas neutras e um acento | Manor Lords | grafite e cinza; azul para interação; champanhe só para dinheiro e prêmio |
| Número explícito sempre | crítica ao CS2 | "+3.840/h", "4/6", "39 s"; seta só junto do número |
| Notificação pequena e filtrável | crítica ao CS2 | marcadores de 30 px, grupos, "só importantes" |
| Painel do selecionado à esquerda | CS2 | a folha lateral fica à esquerda, com anatomia de painel de dados |
| Info views | CS2, Against the Storm | Camadas (estado das obras, serviços, lotes) |
| Resumo de estatísticas | Anno 1800, mods do CS2 | painel Estatísticas com gráficos |
| Marcos claros | CS2 | painel Progresso (capítulos e níveis) |
| Tamanhos de texto | Anno 117 | 4 passos de tamanho da interface |
| Cadeia visível | Highrise City | linhas "insumo → produto" e "quem produz" a um toque |
| Nada de clique para tudo | contraexemplo W&R | coleta automática já existe; manter arrastar para colher nos marcadores |

## 2. Inventário da interface atual

Estilo atual (visto nas capturas da vitrine): pílulas de vidro azul com texto branco de contorno, botões com volume
(verde, azul, laranja), papel creme com cabeçalho azul-noite, latão no nível e no capítulo, ícones desenhados em canvas
com brilho de plástico, fonte Baloo 2, balões brancos de 52 x 62 px, confete nos modais. A área do HUD em repouso é
14,6% da tela em 986 x 443 e 16,3% em 915 x 412; a folha lateral ocupa 34 a 35%.

Todas as telas e componentes, com o destino de cada um na UI nova:

| # | Componente | Arquivo | O que faz hoje | Na UI nova |
|---|---|---|---|---|
| 1 | Selo do nível com anel de XP | `hud.js` `.nivel` | nível e XP; toque abre as metas com a linha do próximo nível | anel fino de 36 px no começo da barra de estado; toque abre o cartão de metas com o próximo nível; "Ver tudo" abre Progresso |
| 2 | Pílula de moradores e renda/h | `.stat.pop` | toque abre o popover da renda (faixa, tarifa, cofre, offline) | item da barra de estado; popover igual, novo estilo |
| 3 | Bem-estar (folha em 3 estados) | `.stat.bem` | toque abre o popover de bem-estar | glifo de rosto (3 bocas: forma e cor mudam juntas) e o número |
| 4 | Composição concluída com anel | `.stat.vida` | toque abre Obras | anel de progresso em volta do botão Obras e o número dentro do painel Obras |
| 5 | Calendário com anel do dia | `.stat.cal` | toque abre Finanças; texto longo e curto | item da barra de estado; o anel do dia vira um traço de 2 px sob a data |
| 6 | Créditos com botão de Trocas | `.stat.creditos` | contagem animada, cor ao ganhar ou gastar; toque abre o Escritório; botão abre o Depósito | item da barra de estado (valor e renda/h); Trocas vai para a barra de ferramentas |
| 7 | Mutirão (fichas, disposição, aceleradores) | `.stat.mutirao` | popover explicativo | chip no grupo da direita: "Mutirão 1/3", barra fina de disposição, aceleradores |
| 8 | Apreciar e Configurações | `.redondo` | botões redondos | glifos no grupo da direita (Apreciar vira "Modo foto") |
| 9 | Coluna direita (Cidade, Produção, Estoque, Pedidos, Trocas) | `.dir .bt` | botões com halo; Pedidos e Trocas trancados até o capítulo; pontos de contagem | barra de ferramentas embaixo à direita, com rótulo; trancados com cadeado pequeno |
| 10 | Capacete de Obras | `.obras-bt` | contagem de etapas prontas | botão primário de 52 px no canto de baixo à direita, com o anel da composição e a contagem |
| 11 | Próximo | `.proximo` | atalho para a próxima ação quando a Agora não aparece ou a folha está aberta | chip acima da barra de ferramentas, à direita; mesma regra de uma chamada por vez |
| 12 | Medalha do capítulo e selo "Conselho aguarda" | `.cap` | abre o cartão de metas | chip "Cap. 1 · 2/5" na barra de estado, com um ponto champanhe quando o Conselho aguarda |
| 13 | Cartão de metas | `.metas` | metas com contador, próximo nível, prêmio do capítulo, "Apresentar ao Conselho" | popover compacto sob o chip; "Ver tudo" abre o painel Progresso |
| 14 | "Meta cumprida" | `.meta-feita` | cartão por 2,5 s | aviso (toast) com glifo de check |
| 15 | Pílula "Agora" e passo do tutorial | `.agora` | uma chamada de ação por vez; "Passo 1 de 8" | cartão Objetivo embaixo à esquerda |
| 16 | Fala do conselheiro | `.fala-dock` | letra a letra, recolhe para o retrato em 4 s, chip com a folha aberta, Pular | aviso no alto ao centro, com monograma; recolhe para o Mural (ponto de não lida) |
| 17 | Brindes | `.brindes` | até 2 no canto de cima | avisos à direita, sob a barra, até 2 |
| 18 | Toque longo (cartão de duas linhas) | `_toqueLongo`, `INFO` | o que é e onde conseguir | igual; no PC, também ao passar o mouse (400 ms) |
| 19 | Popover ancorado | `info()` | seta para o elemento, botão interno | igual, novo estilo |
| 20 | Guia do tutorial | `.guia` | anel pulsante | anel fino de acento, um pulso a cada 1,6 s |
| 21 | Voo de ícones e contagem | `voar()`, `_contagem` | explosão e arco até o botão; números contam em 480 ms | voo mais discreto (até 4 glifos de 20 px); contagem igual |
| 22 | Pontos de contagem | `ponto()` | número nos botões | selo de 16 px |
| 23 | Balões no mundo | `bolhas.js` | 7 tipos, arrastar colhe, presos à borda com seta, grupos "+n", apagados sob o HUD, chamariz, rótulo de ação perto | marcadores compactos (seção 3.6.12), mesma lógica |
| 24 | Rótulos de maquete | `extras.js` `.rotulo3d` | até 6 no Apreciar; "EM OBRA" | rótulos de mapa: texto com halo, sem caixa |
| 25 | Carimbo "APROVADA" em latão | `jogo._carimbo` | voa até o balão | aviso "Etapa aprovada" e um contorno claro no prédio |
| 26 | Faixa de colocar na cidade | `jogo._faixaColocar` | lotes acesos, cancelar | barra de colocação embaixo (nome, custo, efeito, Cancelar) e chip de custo perto do lote |
| 27 | Toque na mata | `jogo._toqueMata` | desmata o lote | igual |
| 28 | Painel de desempenho | `extras.painelDesempenho` | fps, chamadas, triângulos | igual, em fonte monoespaçada do sistema |
| 29 | Folha lateral (estrutura) | `paineis.js` | cabeçalho com ícone, miniatura da foto, título, subtítulo, X, voltar; corpo; rodapé fixo; pilha de 5; destaque dourado; dois toques; entrada escalonada | anatomia nova (seção 3.6.5), sem miniatura da foto, com "Localizar" |
| 30 | Usina | `r_usina` | espaços, lotes com Auto e X, Novo espaço, Mutirão, Acelerador, Comprar tempo, fichas com − N + | painel de produção em linhas (seção 3.6.7) |
| 31 | Usina de Pedidos | `_usinaPedidos` | fila de fabricação | seção "Fila de fabricação" no mesmo painel |
| 32 | Oficina | `r_oficina` | fila, coletar, automático, falta de insumos → "Encomendar em cadeia" | igual à usina, com a cadeia em destaque |
| 33 | Prédio por construir | `r_predio` | descrição e Construir | painel curto com custo e requisito |
| 34 | Almoxarifado | `r_almox` | ocupação, ampliar (dois toques), abas, grade, vazio, atalho do Depósito | tabela de estoque (seção 3.6.9) |
| 35 | Prancha da etapa | `r_etapa` | passos, fichas redondas com aro, entregar item a item, topógrafo, botão de estado único, barra da obra, aceleração, Aprovar, cores | lista de materiais em linhas (seção 3.6.6) |
| 36 | Módulo | `r_modulo` | serviços (água, energia, saneamento), passos por nível, materiais, motivo com "Ir", etiquetas, Subir, obra, aprovar, cores | mesmo desenho da prancha, com a faixa de serviços |
| 37 | Cidade | `r_cidade` | texto, atendimento das moradias, catálogo por categoria, obras da cidade, bairros, terrenos | catálogo com abas e cartões (seção 3.6.11) |
| 38 | Obras | `r_obras` | lista por estado | lista por estrutura com o estado em chip |
| 39 | Produção | `r_producao` | visão geral | tabela de todos os prédios produtivos |
| 40 | Pedidos | `r_pedidos` | cartões, totais por item, Fabricar na Usina de Pedidos, resumo no rodapé, falta com tremor, lixeira em dois toques | linhas de pedido (seção 3.6.10) |
| 41 | Depósito de Trocas | `r_deposito` | compra, venda a 150%, vendas da janela, renovação | tabela de mercado |
| 42 | Escritório | `r_escritorio` | Finanças (calendário, valuation e recorde, renda, empréstimo − / +, pagar juros, parcela, quitar); Obra e serviços (repasse, serviços, bem-estar, topógrafo) | painel Finanças no estilo do painel de economia do CS2 (seção 3.6.11) |
| 43 | Véu e modal com fila | `jogo.modal`, `_fila` | um modal por vez, depois de festas e painéis | igual; véu sem desfoque |
| 44 | Subiu de nível | `modalNivel` | confete, selo, prêmios que voam, "Liberado agora" | "Nível alcançado" sóbrio (seção 3.6.15) |
| 45 | Apresentação ao Conselho | `modalCapitulo` | falas, prêmio, novas obras, escolhas com ganho, custo, antes e depois, porquê; "Decidir depois" | cartões de decisão lado a lado |
| 46 | Etapa aprovada | `extras.modalAprovacao` | prêmio de 150% e aceleradores | modal compacto sem confete |
| 47 | Composição total | `finalComposicao` | modal final e Apreciar | título de terço inferior sobre o mundo |
| 48 | Configurações | `extras.config` | modal largo em duas colunas | modal com abas à esquerda (seção 3.6.17) |
| 49 | Apreciar | `extras.apreciar` | barra com Fotografar, Comparar, Mais (Vista geral, Enquadrar, Rótulos, Planta, Hora), X, placa viva, cabo | Modo foto (seção 3.6.18); o Comparar sai |
| 50 | Cartão de foto 1200 x 630 | `cartaoFoto` | obra e referência lado a lado, placa de latão | foto de quadro inteiro com legenda sóbria |
| 51 | Carga, girar e introdução | `main.js` `#carga`, `#gire` | fundo com a maquete desenhada, barra de latão; emoji de celular | fundo grafite, marca em Inter, linha de progresso de 2 px; glifo de girar |

Contratos que a UI nova precisa manter (senão o robô, a vitrine ou a simulação quebram):

- Atributos `data-a` de todos os controles (o `_bind` do `jogo.js` e o `_clique` dos painéis dependem deles).
- `.veu`, `[data-fecha]`, `[data-esc]`, `[data-continuar]` e `[data-depois]` nos modais (o `robo-partida.js` usa os quatro
  primeiros).
- As classes que as cenas da vitrine clicam: `.pedido`, `.pronto`, `.vaga`, `.mais`, `[data-a=entregar][data-k]`, `.folha`,
  `.corpo`, `.rodape`, `.alvo`, `.fraco`. Se uma parcela mudar uma delas, a mesma parcela atualiza `vitrine-ui.mjs`.
- APIs: `Hud.botao`, `alvoBotao`, `retangulos`, `ponto`, `meta`, `proximo`, `falar`, `brinde`, `info`, `voar`, `reter`,
  `soltar`, `visivel`; `Paineis.abrir`, `fechar`, `voltar`, `agendar`, `destacar`, `largura`; `Bolhas.definir`,
  `atualizar`, `posTela`, `sob`, `tela`.
- `img(nome)` e `icone(nome)` com os mesmos nomes (144 desenhos, mais `predio:*` e `retrato:*`).

## 3. Proposta

### 3.1 Princípios

1. **O mundo é o protagonista.** A UI é vidro escuro e fino nas bordas; o centro da tela fica livre.
2. **Uma linguagem só.** Mesma fonte, mesmo traço de glifo, mesmos raios, mesmos estados em toda parte.
3. **Número explícito.** Todo valor aparece como número, com a tendência ao lado ("12.000 · +3.840/h").
4. **Cor com significado.** Neutras para a estrutura, azul para o que se toca, champanhe para dinheiro e prêmio, verde,
   âmbar e vermelho só para estado, sempre com um glifo junto (quem não distingue cores lê a forma).
5. **Polegares primeiro no celular.** Ações frequentes nos cantos de baixo; leitura no alto; nada importante no centro
   da borda de cima.
6. **Tudo explica o porquê.** Nada fica desabilitado sem motivo: o toque em algo esmaecido diz o que falta e oferece
   "Ir" (regra de hoje, mantida).
7. **Celebrar com sobriedade.** Luz, contagem e um som; sem confete nem saltos.

### 3.2 Layout

**Celular, 986 x 443 (medidas em px CSS; margem de 8 px mais a área segura):**

```
y 8  +--------------------------------------------------------------------------------------------------+
     | (Nv 9) [Cap.1 2/5] | [$ 12.000 +3.840/h] [Moradores 480] [Bem 33%] [12/3 A2]   [Mutirão 1/3 ▰▱ 5]|
     |                                                                     [Camadas][Mural·][Foto][Conf] |
y 44 +----------------------------+---------------------------------------------------+----------------+
     |                 [aviso da fala: (IR) Íris, Arquiteta-chefe: "Cada placa é uma obra..."  Pular]   |
     |                                                                                                  |
     |                                        MUNDO 3D                                (avisos, até 2)   |
     |                                                                                                  |
     |                                                                             [Próximo: Entregar ›]|
y391 | [PASSO 1 DE 9  Produza brita na Usina     Ir ›]   [Cidade][Produção][Estoque][Pedidos][Trocas]   |
     |                                                   [Finanças]                         [ OBRAS 3 ] |
y435 +--------------------------------------------------------------------------------------------------+
```

(O diagrama junta os dois grupos da direita numa linha só para caber; na tela, o grupo do sistema fica no alto à
direita, na mesma linha da barra de estado, e a barra de ferramentas fica numa linha só, embaixo à direita.)

- **Barra de estado, alto à esquerda:** altura visual de 36 px (alvo de 44 px pelo `::after`), uma faixa de vidro
  contínua com divisórias de 1 px, como a barra de estado do CS2. Itens: nível (anel), capítulo, créditos com renda/h,
  moradores, bem-estar, data. Abaixo de 940 px de largura a data usa a forma curta ("12/3 · A2"), como hoje.
- **Grupo do sistema, alto à direita:** Mutirão (chip), Camadas, Mural, Modo foto, Configurações (glifos de 36 px
  visuais, alvo de 44).
- **Objetivo, embaixo à esquerda:** cartão de 44 px de altura e até 340 px de largura (Agora ou passo do tutorial).
- **Barra de ferramentas, embaixo à direita:** Cidade, Produção, Estoque, Pedidos, Trocas, Finanças (56 x 44 cada,
  glifo de 20 px e rótulo de 12 px) e Obras (52 x 52, primário). Largura total de uns 420 px.
- **Próximo:** chip de 40 px acima da barra de ferramentas, à direita.
- **Aviso da fala:** no alto ao centro, 8 px abaixo da barra, até 520 px de largura.
- **Faixa livre para o mundo:** de y 44 a y 391, 347 px (78% da altura). Em 915 x 412: de 44 a 360, 316 px (77%).
- **Área do HUD em repouso:** estimativa de 14,2% em 986 x 443 (hoje 14,6%), com aparência mais leve por ser
  translúcida e sem volume.

**Com a folha aberta:** a folha ocupa a esquerda (largura `--folhaW`, a mesma regra de hoje: até 412 px, 44% da
largura e 36% da área). O cartão Objetivo fica por baixo dela (não precisa aparecer: o Próximo assume, como hoje). A
barra de ferramentas continua à direita (em 986 ela começa em x 558 e a folha termina em x 420; em 915 começa em 487 e
a folha termina em 410), então as duas convivem. O aviso da fala se centra no espaço livre à direita da folha.

**Modo colocar (Cidade):** a barra de ferramentas dá lugar à barra de colocação (glifo do tipo, nome, custo, efeito,
Cancelar), e um chip com o custo acompanha o lote aceso mais perto do centro.

**Modo foto:** tudo some; ficam o X no alto à direita, a legenda embaixo à esquerda e a barra de foto embaixo ao centro
(some em 3,5 s sem toque, como hoje).

**PC (1376 x 768 e maior):** mesmos cantos. A escala sobe por `--escala` (1,12 a partir de 700 px de altura), a barra
de estado mostra mais campos (valuation e dívida), a barra de ferramentas mostra rótulos maiores, a folha tem 420 px, o
Mural pode ficar fixo à direita (como o Chirper do CS2), o hover abre as dicas e os atalhos de teclado aparecem nelas.

### 3.3 Tokens de design

```css
:root{
  /* superfícies: vidro grafite; opacidade alta garante contraste sobre céu claro (sem desfoque no celular) */
  --s0: rgba(12,16,22,.80);   /* barras sobre o mundo */
  --s1: rgba(16,21,28,.94);   /* folha, modais, popovers */
  --s2: rgba(255,255,255,.04);/* cartão dentro da folha */
  --s3: rgba(255,255,255,.08);/* linha em foco, campo, segmento ligado */
  --veu: rgba(6,9,13,.55);    /* atrás do modal */
  --fio: rgba(255,255,255,.08); --fio2: rgba(255,255,255,.14);
  --luz: inset 0 1px 0 rgba(255,255,255,.06); /* brilho de 1 px na borda de cima do vidro */
  /* texto */
  --t1: #EEF2F6; --t2: #A7B1BD; --t3: #6F7A87; --tinv: #0B0F14;
  /* acento de interação e de prestígio */
  --ac: #5AB0FF; --ac2: #8CC8FF; --acE: #2F7FD0; --acF: rgba(90,176,255,.16);
  --ch: #D9BD84; --chF: rgba(217,189,132,.14);
  /* estado (sempre com glifo) */
  --ok: #4CC38A; --al: #F2B14C; --er: #FF6A5C; --off: #5E6875;
  /* famílias de itens (chip de 32 px: fundo a 16%, glifo a 100%) */
  --fTerra: #C8A27C; --fPedra: #AEB6BF; --fMetal: #8FB0CF; --fVidro: #7ED0E6;
  --fVerde: #79C38B; --fEletro: #E6C467; --fEspecial: var(--ch);
  /* forma */
  --r1: 6px; --r2: 10px; --r3: 14px; --rp: 999px;
  --e1: 4px; --e2: 8px; --e3: 12px; --e4: 16px; --e5: 24px;
  --sombra1: 0 1px 2px rgba(0,0,0,.35); --sombra2: 0 8px 24px rgba(0,0,0,.35);
  --alvo: 44px; --barra: 36px;
  /* tipo e movimento */
  --fonte: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --t12: 12px; --t13: 13px; --t15: 15px; --t17: 17px; --t20: 20px; --t28: 28px;
  --d1: 80ms; --d2: 160ms; --d3: 240ms; --curva: cubic-bezier(.2,.8,.2,1);
}
/* PC com Alta ou Ultra: desfoque só nas duas barras e na folha (três elementos no máximo) */
:root[data-vidro="1"] .topo, :root[data-vidro="1"] .base, :root[data-vidro="1"] .folha {
  backdrop-filter: blur(12px) saturate(1.2); --s0: rgba(12,16,22,.66); --s1: rgba(16,21,28,.80);
}
:root[data-contraste="1"] { --s0: rgba(10,13,18,.92); --s1: rgba(12,16,22,.98); --fio: rgba(255,255,255,.22); --t2: #C9D1DA; }
```

**Contraste medido na conta (pior caso, vidro `--s0` sobre céu branco):** o fundo efetivo fica perto de rgb(67,70,75).
`--t1` sobre ele dá 8,9:1 e `--t2`, 4,7:1 (os dois passam do AA de 4,5:1). Sobre `--s1` (quase opaco), `--t2` dá 8,3:1 e o
azul `--ac`, 7,7:1. `--t3` dá 4,1:1: só para texto desabilitado ou decorativo, nunca para informação. Texto escuro
`--tinv` sobre o botão azul dá 8,2:1.

**Fase do dia:** o `data-fase` de hoje continua; à noite só a opacidade de `--s0` sobe 0,04. Não há mais troca de matiz.

### 3.4 Tipografia

- **Inter** (SIL Open Font License), boa legibilidade em 12 a 14 px graças à altura-x grande, com algarismos de largura
  fixa para números. [55][56] Uma família só: o peso faz a hierarquia.
- **Arquivos:** Inter variável (eixo de peso), subconjuntos latin e latin-ext, em `fonte/web/fontes/` com o `OFL.txt`.
  Meta: até 110 KB somados. Se passar, três pesos estáticos (500, 600, 700) só latin, que já cobre o português (U+00C0 a
  U+00FF). Conferir no subconjunto os sinais usados na UI: o latin do Google traz o − (U+2212); se a seta → (U+2192)
  faltar, ela cai na fonte do sistema sem quebrar nada. Os arquivos podem vir do pacote `@fontsource-variable/inter` ou do repositório
  `google/fonts` no GitHub (o GitHub responde daqui). Sai a Baloo 2 (4 arquivos, 69 KB).
- **Escala (px CSS):**

| Uso | Tamanho | Peso | Detalhe |
|---|---|---|---|
| Rótulo de seção, legenda, selo | 12 | 600 | caixa alta, espaçamento +0,06em, `--t2` |
| Texto secundário, subtítulo, custo | 13 | 500 | `--t2` |
| Texto de corpo, linhas de lista, botões | 15 | 600 | `--t1` |
| Valores da barra de estado, título da folha | 17 | 650 | números tabulares |
| Título de modal | 20 | 650 | |
| Número de destaque (nível, valuation) | 28 | 700 | |

- Mínimo de 12 px e peso de 500 ou mais abaixo de 14 px (texto fino sobre vidro escuro some no celular).
- `font-variant-numeric: tabular-nums` em todo número (contadores não "dançam" na contagem animada).
- Altura de linha 1,3 no corpo e 1,15 nos números. Sem contorno de texto na UI. Só os rótulos do mundo têm halo
  (`text-shadow` de 2 camadas, sem `-webkit-text-stroke`).
- Tamanho da interface nas Configurações: 90% (só no PC), 100%, 112% e 125%. No celular, 90% fica escondido para
  nunca cair abaixo de 12 px.

### 3.5 Iconografia

- **Um estilo só:** glifos de traço numa grade de 24, traço de 1,75 px, pontas e juntas redondas, cor `currentColor`,
  sem preenchimento (preenchimento só em detalhes pequenos, a 35%). É o estilo dos glifos que o Apreciar já usa hoje em
  `extras.js` (`G.foto`, `G.enq`...), estendido para tudo.
- **Mesma API, troca por baixo:** `icones.js` passa de desenhos em canvas a um registro de glifos. `icone(nome)` devolve
  uma URL `data:image/svg+xml` com o traço já na cor certa (branco, ou a cor da família do item); `img(nome)` continua
  devolvendo `<img>`. Assim os 144 nomes de hoje, `predio:*` e `retrato:*` seguem funcionando sem mexer nos chamadores
  (HUD, painéis, marcadores, voo de ícones). A URL de um glifo tem de 300 a 700 bytes; `prepararIcones()` deixa de gerar
  blobs em canvas (carga mais rápida).
- **Itens (materiais e produtos):** glifo de traço dentro de um chip de 32 px com a cor da família (fundo a 16%, aro de
  1 px a 28%, glifo na cor cheia). Famílias: terra (madeira, argila, substrato), pedra (brita, cimento, concreto, bloco,
  pré-moldado), metal (aço, cobre, perfil, conector, guarda-corpo, nó), vidro (vidro, acrílico, cúpula, painel, duplo),
  verde (mudas, grama, jardim), eletro (fiação, luminária, solar, sensor, computador), especiais (estrado, etiqueta,
  cadeado, estaca, baliza, trena e as licenças) em champanhe. Isso dá a leitura rápida por cor que o Highrise City tem nos
  recursos, sem o brilho de plástico.
- **Retratos dos conselheiros:** monograma (inicial em 600 sobre um círculo com a cor do conselheiro a 20% e aro de 1,5 px
  na cor cheia). Nome e cargo sempre ao lado. Sai o retrato desenhado.
- **Conjunto de glifos da UI (cerca de 60):** créditos (moeda com H), renda, moradores, bem-estar (3 rostos), composição,
  calendário, relógio, nível, capítulo (bandeira), marco (troféu de traço), conselho (colunas), mutirão (mãos), acelerador
  (raio duplo), camadas, mural (balão de fala), foto, configurações, obras (grua), produção, estoque (caixas), pedidos
  (prancheta), trocas (setas opostas), cidade, finanças (gráfico de barras), fechar, voltar, mais, menos, check, alerta,
  cadeado, info, automático (laço), cancelar, entregar, fabricar, descartar, localizar (alvo), subir, água, energia,
  saneamento, polícia, saúde, escola, faculdade, prefeitura, lote, pincel, enquadrar, rótulos, planta, vista geral,
  passeio (órbita), manhã, sol, pôr do sol, lua, ciclo, tela cheia, som, vibração, salvar, exportar, importar, girar.
- **Prédios e lugares** (`predio:*`, tipos da cidade, estruturas da Arcologia): glifos de traço da silhueta. Opção para
  depois (parcela U14): miniaturas 3D de 128 x 128 do catálogo da Cidade, como as do CS2 [7], renderizadas uma vez pelo
  próprio motor e guardadas; na vitrine (sem WebGL) cai no glifo.

### 3.6 Componentes

#### 3.6.1 Barra de estado (alto à esquerda)

- Faixa `--s0` com `--luz`, raio `--r2`, altura visual de 36 px; cada item é um botão com alvo de 44 px.
- Itens, da esquerda para a direita:
  - **Nível:** anel de 28 px (traço de 2,5 px em `--ac` pelo XP) com o número em 15/700 dentro. Toque: cartão de metas
    com a linha do próximo nível (a ação `nivel` de hoje).
  - **Capítulo:** "Cap. 1" em 12/600 e "2/5" em 15/650, com uma barra segmentada de 2 px embaixo. Ponto champanhe de
    6 px quando o Conselho aguarda. Toque: cartão de metas (`capmin`).
  - **Créditos:** glifo de moeda em `--ch`, valor em 17/650, "+3.840/h" em 12/600 `--ok` (ou `--er` se negativo). Ao
    ganhar, o valor fica champanhe por 500 ms; ao gastar, vermelho por 300 ms (hoje: latão e vermelho). Toque:
    Finanças.
  - **Moradores:** glifo e valor; toque: popover da renda (como hoje).
  - **Bem-estar:** rosto (sorriso a partir de 70%, reto de 35 a 69%, triste abaixo de 35%, em `--ok`, `--al`, `--er`) e
    o número. Toque: popover de bem-estar.
  - **Data:** "Dia 12 · Mês 3 · Ano 2" (ou "12/3 · A2") com o traço do dia de 2 px embaixo. Toque: Finanças.
- Popovers: `--s1`, raio `--r2`, seta de 8 px, título 13/650, lista com o número à esquerda em 15/650 e o texto em
  13/500.

#### 3.6.2 Grupo do sistema (alto à direita)

- **Mutirão:** chip de 36 px: glifo, "1/3" em 15/650, barra de disposição de 3 px sob o número (`--ch`), e o contador de
  aceleradores com o glifo de raio quando existir. Toque: popover do Mutirão (como hoje).
- **Camadas** (novo), **Mural** (novo, com selo de não lidas), **Modo foto** (o Apreciar), **Configurações:** glifos de
  22 px em quadrados de 36 px com raio `--r2`; estado ligado com fundo `--acF` e glifo `--ac`.

#### 3.6.3 Objetivo (embaixo à esquerda)

- Cartão `--s0` de 44 px de altura e até 340 px: glifo da ação (20 px, `--ac`), rótulo "AGORA" ou "PASSO 1 DE 9" em
  12/600 caixa alta `--t2`, o texto em 13/600 numa linha (reticências), e "Ir ›" em `--ac` à direita.
- Estados: espera (glifo de relógio, texto `--t2`), feito (check `--ok` por 600 ms antes de trocar), troca de texto (o
  texto sobe 6 px e aparece em 160 ms).
- Toque em qualquer ponto executa (como hoje). O anel do guia do tutorial aponta o alvo no mundo ou na UI.

#### 3.6.4 Barra de ferramentas e Obras (embaixo à direita)

- Botões de 56 x 44: glifo de 20 px e rótulo de 12/600 embaixo, `--t2`; ligado (painel aberto) com `--t1`, fundo `--s3`
  e um traço de 2 px de `--ac` embaixo. Selo de contagem de 16 px no canto (fundo `--ac`, número 12/700 `--tinv`; "!" em
  `--al` para o Almoxarifado quase cheio).
- Trancados (Pedidos e Trocas antes do capítulo): glifo e rótulo em `--t3`, cadeado de 10 px; o toque explica quando
  abre (como hoje). Ao destrancar, um pulso de luz (opacidade) uma vez.
- **Finanças** entra na barra (abre o Escritório na aba Finanças). O toque nos créditos e na data continua abrindo o
  mesmo painel.
- **Obras:** 52 x 52, fundo `--ac`, glifo da grua em `--tinv`, anel externo de 2 px com a porcentagem da composição
  (substitui a pílula "vida"), selo com o número de etapas prontas para aprovar.

#### 3.6.5 Folha lateral (a base de todos os painéis)

Anatomia:

```
+------------------------------------------+
| ‹ [glifo] Usina de Materiais   [◎] [×]   |  cabeçalho 56 px: título 17/650; subtítulo 12/500 --t2
|           2/3 espaços · lotes até 10     |  ◎ = Localizar (painéis ligados a um lugar do mundo)
|------------------------------------------|
| ABAS (quando houver): 44 px, traço de 2 px no ativo
|------------------------------------------|
| RÓTULO DE SEÇÃO                          |  12/600 caixa alta, 16 px de margem acima
| linha ............................ valor |  48 px, divisória --fio
| cartão (--s2, raio --r2, fio --fio)       |
|------------------------------------------|
| rodapé fixo: ação principal (48 px)      |  a regra de hoje: .fixa, .fixo, .resumo e .licenca.fixo vão para o rodapé
+------------------------------------------+
```

- Fundo `--s1`, cantos direitos com raio `--r3`, sombra `--sombra2`, sem papel creme e sem faixa azul.
- **Primitivas** (usadas por todas as telas):
  - **Linha:** chip ou glifo de 32 px, título 15/600, subtítulo 12 ou 13/500 `--t2`, e à direita valor em 15/650
    tabular ou uma ação.
  - **Botões:** primário (fundo `--ac`, texto `--tinv`, 44 px, 48 px no rodapé, raio `--r2`, 15/650); secundário (fundo
    `--s3`, fio `--fio2`, texto `--t1`); fantasma (sem fundo, texto `--ac`); prestígio para compras com créditos e fichas
    (fio `--ch`, texto `--ch`); perigo (texto e fio `--er`). A segunda linha de custo continua: "moeda 600 · relógio 2 min
    6 s" em 12/500.
  - **"Fraco":** 50% de opacidade, continua tocável e explica o motivo (regra de hoje).
  - **Dois toques:** o primeiro arma por 2,6 s: fio `--al`, rótulo "Toque de novo para confirmar" e uma barra de 2 px
    que esvazia no tempo (hoje só troca o texto).
  - **Seletor de quantidade:** [−] N [+], 44 x 44 cada, N em 17/650.
  - **Interruptor** (Auto e as opções Sim ou Não): trilho de 44 x 26, botão de 20 px; ligado em `--ac`, com o rótulo do
    estado ao lado ("Auto: ligado"). Isso resolve a ambiguidade que o CS2 tem no play e pausa [22].
  - **Segmentado:** 36 px visuais (alvo de 44), segmento ligado com `--s3` e texto `--t1`.
  - **Barra de progresso:** 4 px, trilho `--fio`, preenchimento `--ac` (obra), `--ok` (pronto) ou `--al` (atenção);
    tempo restante em 12/600 tabular à direita.
  - **Chip de requisito:** glifo de 16 px e "4/6"; `--ok` com check quando tem, `--al` quando parcial, `--er` com "!"
    quando falta.
  - **Vazio:** glifo de 32 px `--t3`, frase em 13/500 `--t2` e a ação que resolve.
- **Pilha e voltar** (até 5), **destaque** (hoje um anel dourado: vira um contorno de 2 px de `--ac` que pisca uma vez),
  **entrada escalonada** dos primeiros cartões (fica, com 24 ms de passo e 6 px de deslocamento).
- **Localizar** (novo, como o botão de câmera do painel do CS2): nos painéis de etapa, módulo, usina, oficina e prédio da
  cidade, leva a câmera ao lugar (`irPara` com `abrir=false`).

#### 3.6.6 Prancha da etapa e módulo

```
| ‹ [grua] Sede da Holding                  [◎] [×] |
|          Etapa 1 de 4 · Terraplenagem e fundações  |
| ●────○────○────○   Terraplenagem · Térreo · ...    |  passos com nome curto, o atual em --ac
| MATERIAIS                                  2 de 4  |
| [brita]  Brita reciclada     0/6  ▱▱▱▱▱▱   Produzir |  sem estoque: ação "Produzir" (irProdutor)
| [conc.]  Concreto            0/2  tem 1  Entregar 1 |  com estoque: entrega item a item (como hoje)
| [estaca] Estaca de topografia 0/1  licença          |
|          Topógrafo: encomendar · 200            [›] |  licença que falta: linha fixa no rodapé (regra de hoje)
| EFEITOS   +1.500 de energia · +2% de bem-estar      |
| SOBRE A ETAPA  (13 px, 3 linhas e "Mais")           |
| COR  ○ ○ ○ ○ ○ ○                                    |  paleta em pastilhas de 28 px, alvo de 44
|-----------------------------------------------------|
| [ Entregar 4 materiais          600 · 2 min 6 s ]   |  botão de estado único (regra de hoje)
```

- As fichas redondas com aro viram linhas com barra de 4 px. O "+N" que sobe ao entregar fica (texto `--ok`, sobe 8 px em
  400 ms).
- Botão de estado único, sem mudar a regra: "Iniciar obra" (primário), "Entregar N materiais" (secundário), "Faltam N
  materiais" ou "Sem créditos" (fraco, com motivo).
- Em obra: barra, tempo, e o grupo **Acelerar** (seção 3.6.7). Pronta: "Aprovar a etapa" (primário). Feita: "Próxima
  etapa" (secundário).
- **Módulo:** o mesmo desenho, com a faixa de serviços no topo (água, energia e saneamento como três linhas "uso/cap" com
  barra, vermelho quando o novo pavimento não é atendido, toque leva à obra que dá o serviço), os passos por nível, o
  cartão de motivo com "Ir" e as etiquetas (bem-estar mínimo, cobertura, +moradores).

#### 3.6.7 Produção (usina, oficina, Usina de Pedidos e visão geral)

```
| ‹ [fábrica] Usina de Materiais          [◎] [×] |
|             2/3 espaços · lotes até 10         |
| EM PRODUÇÃO                                     |
| [brita] Brita ×5    ▰▰▰▰▱▱  39 s   Auto ◉  ×    |  48 px por lote; "3/5 feitas" em 12 px
| [aço]   Aço ×1      ▰▱▱▱▱▱  1 min 18 s  Auto ○ × |
| [livre] [livre]  [+ Novo espaço · 300]          |  vagas em pastilhas de 44 px
| ACELERAR                                        |
| [Mutirão 2 h · 1 ficha] [Acelerador 1 h · 5] [Comprar tempo ▾] |
| PRODUZIR                                        |
| [madeira] Madeira       39 s/un   [− 5 +]  [Produzir 5 · 2 min 36 s] |
| [brita]   Brita         ...                     |
```

- **Grupo Acelerar:** os três botões grandes e coloridos de hoje (laranja do Mutirão, cinza do acelerador, fileira de
  cinco pacotes de tempo) viram uma linha com dois botões de prestígio e um "Comprar tempo" que abre os cinco pacotes
  (1, 5, 10, 30 e 60 min, com o preço de hoje) numa fileira logo abaixo. Nada muda na regra nem nos preços.
- **Oficina:** as receitas mostram a cadeia na mesma linha: `[viga] Viga  ←  madeira ×2 ✓  aço ×1 !` com "até N" pelo que
  os insumos permitem; faltando insumo, a linha de aviso oferece "Encomendar em cadeia" (primário). Coleta e bandeja
  cheia ficam como hoje.
- **Usina de Pedidos:** seção "Fila de fabricação" com as linhas da fila e "Ver os pedidos".
- **Visão geral (botão Produção):** tabela de todos os prédios produtivos: nome, espaços em uso, o que faz, tempo do
  próximo pronto, e um toque abre o prédio (como hoje, em linhas em vez de cartões).

#### 3.6.8 Lista de obras

- Agrupada por estrutura do Trevo (Anel Mestre, tambores, folhas, contorno, eixo, cidade), cada etapa em uma linha com o
  estado em chip: pronta para aprovar (`--ok`, check), em obra (barra `--ac` e tempo), prancha com materiais (`--al`,
  "3/5"), disponível (`--t2`), bloqueada (cadeado `--t3`, com o motivo no toque). A composição total aparece no topo
  ("Composição 2,4%" com barra) no lugar da pílula "vida".

#### 3.6.9 Estoque (Almoxarifado)

- Topo: "312 de 400 vagas" com barra (`--al` a partir de 80%, `--er` a partir de 95%) e "Ampliar (+N vagas)" com os chips
  do que pede (dois toques, como hoje).
- Abas: Matérias-primas, Produtos, Especiais. Grade de chips de 64 x 64 (chip de família, número em 15/650 embaixo) ou,
  no PC, tabela com nome. Toque num item vai a quem produz (como hoje). Atalho "Depósito de Trocas" no fim.

#### 3.6.10 Pedidos e Trocas

- **Pedidos:** faixa de totais por item no topo (o que todos os pedidos somam e quanto você tem). Cada pedido é uma linha
  de 56 px: quem pede, chips dos itens (verde quando tem), o que rende (créditos em `--ch`, XP, disposição), e as ações
  "Entregar" (primário quando completo), "Fabricar na Usina de Pedidos" (secundário), lixeira (dois toques). O resumo no
  rodapé e o tremor quando falta ficam.
- **Trocas (Depósito):** tabela de mercado: item, seu estoque, comprar (preço), vender (preço de 150% em destaque),
  "vendas nesta janela 37/100" e "renova às 14:20". Compra acima de 10% dos créditos pede dois toques (como hoje).

#### 3.6.11 Cidade e Finanças

- **Cidade** (o catálogo, como a barra de ferramentas do CS2): abas Moradia, Serviços, Comércio, Empresas, Lugares e
  Bairros. Cada tipo é um cartão de 2 linhas: glifo (ou miniatura 3D, parcela U14), nome, efeito com número ("+12% de
  renda por nível", "atende 6 quadras"), quantidade na cidade, custo e tempo, e "Construir". A seção "Atendimento das
  moradias" vira uma linha de chips (polícia 0/1, escola 0/1...) no topo. Comprar bairro fica na aba Bairros.
- **Colocar:** barra de colocação embaixo e chip de custo perto do lote (seção 3.2).
- **Finanças** (o painel de economia do CS2 [12]): abas **Visão geral** (valuation em 28/700 com o recorde, renda/h,
  caixa, dívida, e um gráfico de linha do valuation quando a série existir, parcela U15), **Empréstimo** (controle
  deslizante em passos de 1.000 mais os botões − e +, limite do ano, dívida máxima, juros de 10% ao ano, pagar juros,
  parcela ou quitar: a regra do dono não muda), **Obra e serviços** (repasse, água, energia e saneamento com uso e
  capacidade, bem-estar com a composição das parcelas, topógrafo).

#### 3.6.12 Marcadores no mundo (no lugar dos balões)

```
   ( ✓ )    círculo de 30 px, fundo --s0, aro de 2 px na cor do estado, glifo de 16 px
     |      haste de 1 px e 10 px até o chão
     •      ponto de 4 px no lugar exato
```

| Tipo de hoje | Cor do aro | Glifo | Na borda da tela |
|---|---|---|---|
| pronta (aprovar) | `--ok` | check | sim, com seta |
| coleta | `--ac` | o item | sim |
| moedas (repasse) | `--ch` | moeda | sim |
| subir | `--ac` | seta para cima | sim |
| placa (obra disponível) | `--t1` | grua | não |
| bloq | `--off` | cadeado | não |
| obra (em andamento) | anel de progresso `--ac` no lugar do aro | grua | não |

- Alvo de toque de 44 px pelo `::after`. Arrastar o dedo por vários colhe todos (regra de hoje). Grupos a menos de 56 px
  viram um marcador com o selo "+3" (12/700). Os presos à borda ganham uma seta de 8 px. Sob o HUD ficam apagados e sem
  toque (como hoje).
- Com a câmera perto, um rótulo curto à direita ("Aprovar", 12/600, fundo `--s0`).
- **Sem flutuação ociosa.** O chamariz vira um anel que se expande e some (600 ms) no marcador de maior prioridade, a cada
  6 a 8 s (a lógica de hoje).
- **Filtro nas Configurações:** "Marcadores: todos · só importantes (aprovar, colher, moedas, subir) · nenhum" (lição do
  CS2 [23][24]).

#### 3.6.13 Rótulos do mundo

- Texto 13/600 `--t1` com halo escuro (duas sombras de 0 a 2 px), sem caixa, com uma linha-guia de 1 px até o pé; o estado
  "EM OBRA" vira um chip de 12 px `--al` ao lado. A regra de no máximo 6, sem cruzar o HUD nem outros rótulos, fica.

#### 3.6.14 Falas, Mural e avisos

- **Aviso da fala:** `--s1`, raio `--r2`, até 520 px, monograma de 28 px, nome e cargo em 12/600 caixa alta `--t2`,
  texto em 15/500 em até 2 linhas, "Pular" fantasma. A revelação letra a letra fica, duas vezes mais rápida (6 ms por
  letra, até 1,2 s); o toque completa. Depois de 4 s sem toque o aviso sobe e some, e a fala vai para o Mural com um ponto
  de não lida no botão. A fila, os grupos do tutorial e a validade (`se`) seguem como hoje.
- **Mural** (novo, o Chirper da Holding): popover de 340 px ancorado no botão Mural (no PC pode ficar fixo à direita, como
  o Chirper do CS2 [10]). Lista as últimas 50 falas e eventos (etapa aprovada, pedido novo, ano novo, meta cumprida, dias
  que passaram fora) com hora do jogo e um selo "Importante" para os que pedem ação, cada um com "Ir" quando houver alvo.
  Memória da sessão, sem mexer no save.
- **Configuração "Falas dos conselheiros":** aviso na tela · só as do tutorial e as importantes · só no Mural (lição do
  CS2 [25]).
- **Avisos (brindes):** à direita, 8 px abaixo da barra de estado, até 2 (o mais velho diminui); `--s1`, glifo de 18 px na
  cor do estado e texto 13/600; entram descendo 8 px em 160 ms e saem apagando em 120 ms.
- **Toque longo e hover:** cartão `--s1` com título 13/650, o que é em 13/500 e onde conseguir em 12/500 `--t2`, mais o
  atalho de teclado no PC ("Atalho: O").

#### 3.6.15 Modais

- Véu `--veu` (sem desfoque), modal `--s1`, largura de até 620 px (92% da tela no celular), altura de até 92%, raio
  `--r3`. Cabeçalho com sobretítulo 12/600 caixa alta e título 20/650. Ações no rodapé: largura cheia no celular,
  alinhadas à direita no PC.
- **Nível alcançado:** sobretítulo "NÍVEL ALCANÇADO", número em 44/700 dentro de um anel de 96 px que se completa em
  600 ms com um brilho que atravessa uma vez; prêmios em linhas ("Créditos +650", "Estrado +1"); "Liberado agora" com
  chips de itens e prédios; "Continuar" (`[data-continuar]`) faz os prêmios voarem (como hoje). Sem confete.
- **Apresentação ao Conselho:** falas em linhas com monograma; faixa com "Aprovado", prêmio da Holding e novas obras;
  pergunta; 2 ou 3 cartões de decisão lado a lado (rolagem horizontal se não couber em 915): monograma de quem propõe,
  título 15/650, "Ganho" com glifo de mais em `--ok`, "Custo" com glifo de menos em `--er`, as linhas de antes e depois
  ("Almoxarifado: 60 → 40 vagas"), o porquê em 12/500 e "Escolher" (`[data-esc]`). "Decidir depois" (`[data-depois]`)
  fantasma. O véu não fecha (fixo) e o tremor fica. A escolhida cresce 2% e a outra apaga, como hoje.
- **Etapa aprovada:** compacto: nome da obra, "passou na medição da Holding", linhas de prêmio (créditos: 150% do custo;
  +1 acelerador de obra; +1 de produção), "Continuar".
- **Composição total:** a câmera vai à vista geral e um cartão de terço inferior mostra "Arcologia de Held · composição
  total", as falas finais e "Continuar" e "Fotografar".
- **Carimbo "APROVADA":** sai o latão; entra o aviso "Etapa aprovada" com check e um contorno claro de 2 px que percorre a
  silhueta do prédio uma vez (efeito do lado 3D, se a frente gráfica quiser; senão só o aviso).

#### 3.6.16 Progresso (capítulos e níveis)

- **Cartão rápido** (toque no capítulo ou no nível): popover de 320 px com o capítulo, as metas com contador (toque leva à
  meta, `data-a="meta"`), a linha do próximo nível e o prêmio; "Apresentar ao Conselho" (primário, `data-a="conselho"`)
  quando tudo está cumprido; "Ver tudo".
- **Painel Progresso** (novo, como o painel de marcos do CS2 [6]): abas Capítulos e Níveis. Capítulos: trilha vertical de
  1 a 6, cada um com nome, estado (feito, atual, futuro), prêmio e o que abre ("Novas obras"); o atual abre as metas.
  Níveis: XP atual, próximo nível, prêmio (300 + 50 × nível, a regra de hoje) e o que cada nível libera.

#### 3.6.17 Configurações

- Modal de 880 x 92% com abas à esquerda (Vídeo, Som e toque, Jogo, Interface, Salvamento, Acessibilidade, Sobre) e o
  conteúdo à direita em linhas de 52 px (rótulo 15/600 e explicação 12/500 `--t2` à esquerda; controle à direita).
- Opções de hoje, todas mantidas: qualidade (Auto, Ultra, Alta, Média, Leve), quadros por segundo (30, 60, 120), tela
  cheia, painel de desempenho, efeitos, música, vibração, luz e ciclo, ritmo da obra (modo de teste), exportar e
  importar, tamanho da interface, reduzir movimento, alto contraste, recomeçar (dois toques, em Salvamento), instalar como
  app, GPU e versão (em Sobre).
- Novas: marcadores no mundo (3.6.12), falas dos conselheiros (3.6.14), mostrar dicas de atalho (PC), vidro com desfoque
  (PC; ligado por padrão em Alta e Ultra).
- Interruptores no lugar dos pares "Sim / Não".

#### 3.6.18 Modo foto (o Apreciar)

- Barra de vidro embaixo ao centro, em duas linhas como hoje:
  - Linha principal: Vista geral, Enquadrar (as 7 vistas), Passeio, Ajustes, Fotografar (primário).
  - Linha "Ajustes": Hora do dia (Automático, Manhã, Meio-dia, Pôr do sol, Noite) e controles deslizantes de
    exposição, contraste, saturação, vinheta e bloom. São os parâmetros que o motor já tem em `engine.params`
    (uniformes baratos, como as abas Lente e Cor do modo foto do CS2 [13]). Mais Rótulos e Planta como interruptores.
- X no alto à direita; legenda embaixo à esquerda em texto 13/600 com halo ("Arcologia de Held · 2,4% · Capítulo 1 ·
  Torre e lago"), sem placa de latão.
- **Sai o Comparar** (cabo, espiar e noite forçada), porque o dono liberou abandonar as imagens de referência.
- **Cartão de foto 1200 x 630:** a imagem do jogo em quadro inteiro, com um degradê embaixo e a legenda (nome em 28/650,
  "Capítulo 1 · 2,4% da composição" em 13/600 caixa alta, data à direita), em Inter. Sem o quadro da referência.

#### 3.6.19 Camadas (novo: as "info views")

- Popover no botão Camadas com a lista; a camada ativa mostra uma legenda embaixo ao centro (chip com a escala) e some ao
  escolher "Nenhuma".
- Camadas que usam dados e recursos 3D que já existem:
  1. **Estado das obras:** pinta as etapas por estado (feita, em obra, pronta, prancha, bloqueada), com a mesma cor dos
     marcadores.
  2. **Serviços:** a cobertura de polícia, saúde, escola e faculdade na cidade (o modo cobertura de hoje, vira camada).
  3. **Lotes:** livres, em obra, construídos, e o valor do bairro (escala ajustada ao nosso intervalo, lição do mapa de
     calor do CS2 [26]).
  4. **Planta:** o fantasma da planta (hoje só no Apreciar).
- Custo: até 2 chamadas de desenho a mais com a camada ligada; nenhuma com ela desligada.

#### 3.6.20 Estatísticas (novo)

- Painel com abas Holding (créditos, renda/h, valuation, dívida), Arcologia (composição, moradores, bem-estar) e Cidade
  (moradores, lotes, lucro das empresas por hora). Cada série em um gráfico de linha em SVG (largura da folha x 64 px,
  linha de 1,5 px `--ac`, área a 12%, valor atual e mínimo e máximo), sem biblioteca.
- Depende de uma série gravada por dia do jogo em `sim/estado.js` (`S.serie`, até 360 pontos, padrão `[]` na migração).
  Não muda nenhuma regra de economia; saves antigos abrem com a série vazia.

#### 3.6.21 Carga, girar e introdução

- **Carga:** fundo grafite com um degradê vertical leve, "ARCOLOGIA DE HELD" em 28/650 com espaçamento de 0,2em, a frase
  em 13/500 `--t2`, linha de progresso de 2 px em `--ac` com 320 px, e "Toque para entrar" (secundário). Sai o desenho da
  maquete com latão.
- **Girar:** glifo de celular girando (SVG, sem emoji) e "Gire o celular: o jogo é em paisagem".
- **Introdução:** a planta holográfica fica (é 3D); a UI só esconde as barras durante ela (como hoje, `.intro`).

### 3.7 Estados e animações

| Evento | Visual | Duração | Com "reduzir movimento" |
|---|---|---|---|
| Toque em botão | escala 0,97 e fundo mais escuro | 80 ms | só a cor |
| Abrir folha | desliza 16 px da esquerda e aparece | 240 ms, `--curva` | aparece em 120 ms |
| Fechar folha | apaga e recua 8 px | 160 ms | 80 ms |
| Abrir modal | véu aparece; modal sobe 12 px | 240 ms | 120 ms |
| Número muda | contagem (como hoje) e cor por 500 ms | 480 ms | troca direta e cor |
| Voo de ícones | até 4 glifos de 20 px em arco | 560 ms | não voa; o destino pisca |
| Aviso entra ou sai | desce 8 px e aparece; sai apagando | 160 e 120 ms | só opacidade |
| Chamariz de marcador | anel expande de 1 a 1,6 e some | 600 ms, a cada 6 a 8 s | desligado |
| Guia do tutorial | anel fino, um pulso | 1,6 s | anel parado |
| Meta cumprida | check desenha o traço; aviso | 400 ms | aviso só |
| Nível alcançado | anel completa; brilho atravessa uma vez | 600 ms | anel cheio direto |
| Destrancar botão | pulso de opacidade | 400 ms, uma vez | nenhum |
| Dois toques armado | fio âmbar e barra que esvazia | 2,6 s | igual (é informação) |

- Tudo só com `transform` e `opacity` (regra de hoje). Uma animação ociosa por elemento no máximo, e só no chamariz e no
  guia.
- Sem saltos, molas ou excesso de curva: a curva é sempre `cubic-bezier(.2,.8,.2,1)`.
- Som e vibração ficam como hoje (tique, sucesso, erro), com o volume dos efeitos da UI 20% menor.

### 3.8 O que sai e por quê

| Sai | Por quê | Entra |
|---|---|---|
| Baloo 2 e o contorno de texto | marca do estilo BuildIt; contorno pesa e fica infantil | Inter, texto sem contorno sobre vidro opaco o bastante |
| Botões com volume em verde, azul e laranja | estética de jogo casual | primário azul plano, secundário de vidro, prestígio em champanhe |
| Papel creme, faixa azul-noite e latão | "prancheta da maquete" do BuildIt | folha grafite de dados |
| Ícones em canvas com brilho de plástico | cartunescos | glifos de traço e chips por família |
| Retratos desenhados | cartunescos | monogramas |
| Balões de 52 x 62 px com flutuação | poluem a tela (a queixa do CS2 com notificações) | marcadores de 30 px |
| Confete e carimbo de latão | comemoração infantil | luz, contagem e avisos |
| Comparar, miniatura da foto e o lado da referência no cartão | o dono liberou abandonar as imagens de referência | ajustes de foto e cartão de quadro inteiro |
| Emoji de celular na tela de girar | fora do estilo | glifo SVG |

Efeito colateral bom: sem o Comparar, `foto.webp` (249 KB) deixa de ser necessário na UI. A montagem hoje embute essa
foto em base64 no `arcologia-de-held.html`; a frente visual decide se ela sai de vez (a vitrine também deixa de usá-la
como fundo, parcela U0).

### 3.9 O que não entra e por quê

- **Pausa e velocidade do tempo** (a peça mais visível do rodapé do CS2): a nossa economia corre em tempo real (renda de
  5, 8 ou 11 por morador por hora, cronômetros de obra e produção, empréstimo por ano do jogo), com regras fixadas pelo
  dono. Acelerar ou pausar mudaria essas regras. O lugar fica com o calendário. O "Ritmo da obra" continua como modo de
  teste nas Configurações.
- **Desfoque de fundo no celular:** custo medido de 3,5 ms por quadro [53]; o orçamento do Poco X7 é de 33 ms a 30
  quadros, e a GPU é a mesma do WebGL.
- **Trocar a UI para WebGPU ou para o canvas:** o CS2 faz a UI em HTML e CSS [1]; o DOM atual já só escreve o que muda.
  WebGPU e TSL são assunto da frente gráfica.

## 4. Plano de implementação em parcelas

**Critério comum de aceite de toda parcela:**

1. `node ferramentas/montar.mjs` sem avisos.
2. `node ferramentas/simular.mjs --testes` → `testes ok`.
3. `node ferramentas/vitrine-ui.mjs <pasta> todas 986x443,915x412 noite` (ou as cenas da parcela) → "sem erros de
   página", `alvos<44 0`, `textos<12 0`, e as medidas novas da U0 dentro da meta.
4. Robô (`testar.mjs` com `robo-partida.js`: `cap 6`, `vida 100`, `erros []`) só nas parcelas marcadas com "robô", por
   causa do custo (5 a 15 min).

**Ordem e dependências:** U0 → U1 → U2 → U3 → U4 → (U5, U6, U7, U8 em paralelo, depois da divisão de `paineis.js` feita
na U4) → U9 → U10 → U11 → U12 → U13 → U14 → U15 → U16.

| Parcela | O que faz | Arquivos | Aceite específico |
|---|---|---|---|
| **U0. Vitrine pronta para a UI nova** | fundo da vitrine a partir de uma captura do jogo (série `dia` com `FUNDO_DIA`), não mais a foto de referência; medidas novas: contraste de texto (amostra do fundo efetivo, pior caso sobre branco; meta 4,5:1 abaixo de 17 px e 3:1 acima), nenhuma fonte "Baloo", nenhum `backdrop-filter` sem `data-vidro="1"`, área do HUD (meta: até 14,5% em 986 x 443 e até 16% em 915 x 412), faixa livre (meta: 340 px em 443 e 310 px em 412); retângulos de "cobre" relidos da planta nova | `ferramentas/vitrine-ui.mjs` | roda as 65 cenas nos 2 tamanhos e grava a linha de base das medidas novas (com a UI antiga, para comparar) |
| **U1. Tokens e tipografia** | tokens da seção 3.3; Inter em `fonte/web/fontes/` com o OFL; `preload` no `index.html`; sai a Baloo e o sistema de contorno de texto (`--cc`, `paint-order`); `data-vidro` ligado pela qualidade no `main.js`; `montar.mjs` copia as fontes novas; o canvas do cartão de foto passa a Inter | `fonte/ui/estilo.css` (só `:root`, `@font-face` e o bloco de contorno), `fonte/web/index.html`, `fonte/web/fontes/`, `fonte/main.js`, `ferramentas/montar.mjs`, `fonte/ui/extras.js` (fonte do cartão) | fontes somadas até 110 KB; nenhuma "Baloo" na montagem; contraste da U0 passa nas cenas de HUD |
| **U2. Glifos** | `icones.js` vira registro de glifos SVG com a mesma API (`icone`, `img`, `prepararIcones`, `LISTA_ICONES`, `nomesIcones`); ~60 glifos de UI, 54 de itens, os de prédios, lugares e tipos da cidade; chips de família; retratos em monograma; teste que confere que todo nome usado no código tem glifo | `fonte/ui/icones.js` (reescrito), `fonte/ui/estilo.css` (chip), teste em `ferramentas/simular.mjs --testes` (ou `ferramentas/teste-icones.mjs` chamado por ele) | nenhum nome sem glifo; tempo de `prepararIcones` menor que hoje (medir); vitrine sem erros |
| **U3. Barras do HUD** (robô) | barra de estado, grupo do sistema, Objetivo, barra de ferramentas com Finanças, Obras com o anel da composição, Próximo; `data-a` novos: `camadas`, `mural`, `financas` (este cai no Escritório na aba Finanças); atalhos de teclado no PC (O, P, E, R, T, C, F, Esc); `_larguras`, `retangulos` e `alvoBotao` recalculados | `fonte/ui/hud.js`, `fonte/ui/estilo.css` (seções do HUD), `fonte/jogo.js` (`_bind`: casos novos) | cenas `inicio`, `agora`, `metas`, `metas-agora`, `inicio-recolhida`, `bem`, `calendario`, `brindes`, `guia-painel`, `acelerar`, `mutirao`: área do HUD e faixa livre na meta, `ctas` sem Agora e Próximo juntos; robô passa |
| **U4. Folha e primitivas** | anatomia da folha, primitivas da seção 3.6.5, botão Localizar; **divide `paineis.js`** em módulos por tela (`paineis/base.js` com a classe e as primitivas, `obra.js`, `producao.js`, `estoque.js`, `cidade.js`, `financas.js`) sem mudar comportamento, para as parcelas seguintes andarem em paralelo | `fonte/ui/paineis.js` → `fonte/ui/paineis/*.js`, `fonte/ui/estilo.css` (folha) | todas as cenas de painel sem erros; os mesmos `data-a` e classes que a vitrine clica |
| **U5. Obras** | prancha em linhas, passos com nome, módulo com faixa de serviços, lista de obras por estrutura, cores em pastilhas | `fonte/ui/paineis/obra.js`, CSS | cenas `prancha*`, `modulo*`, `obras*`, `aprovacao*`, `cores-obra`, `rotulo-obra` |
| **U6. Produção** | lotes em linhas, vagas, grupo Acelerar, receitas com a cadeia, visão geral em tabela, Usina de Pedidos | `fonte/ui/paineis/producao.js`, CSS | cenas `usina*`, `oficina*`, `producao`, `acelerar`, `mutirao` |
| **U7. Estoque, Pedidos e Trocas** | estoque com abas e chips, pedidos em linhas com totais, mercado em tabela | `fonte/ui/paineis/estoque.js`, CSS | cenas `almox*`, `pedidos*`, `pedido-*`, `deposito*` |
| **U8. Cidade e Finanças** | catálogo com abas, barra de colocação e chip de custo (`_faixaColocar`), Finanças com abas e controle deslizante do empréstimo (passo de 1.000, mesmas regras) | `fonte/ui/paineis/cidade.js`, `fonte/ui/paineis/financas.js`, `fonte/jogo.js` (`_faixaColocar`), CSS | cenas `cidade*`, `empresa`, `escritorio*`; robô não precisa (as regras não mudam) |
| **U9. Marcadores e rótulos** (robô) | balões viram marcadores; chamariz em anel; filtro "só importantes"; rótulos de mapa | `fonte/ui/bolhas.js`, `fonte/ui/extras.js` (rótulos), CSS | cenas `baloes`, `rotulo-foco`, `rotulo-obra`, `apreciar-rotulos`; `baloesPerto` 0; alvos de 44 px pelo `::after`; robô passa (ele colhe pela API, mas a coleta por toque precisa seguir) |
| **U10. Falas, Mural e avisos** | aviso da fala no alto; Mural (popover e fixo no PC) com histórico da sessão; configuração das falas; avisos à direita | `fonte/ui/hud.js`, novo `fonte/ui/mural.js`, `fonte/jogo.js` (eventos que alimentam o Mural), CSS | cenas `inicio`, `conselho`, `brindes`, `inicio-recolhida` e cena nova `mural`; nenhuma fala perdida (a fila tem os mesmos itens) |
| **U11. Modais** (robô) | nível, Conselho, etapa aprovada, final, carimbo virando aviso; sem confete | `fonte/jogo.js` (`modal`, `modalNivel`, `modalCapitulo`, `finalComposicao`, `_carimbo`), `fonte/ui/extras.js` (`modalAprovacao`), CSS | cenas `nivel`, `nivel-selo`, `capitulo`, `capitulo-toque-fora`, `aprovacao-etapa`, `final`; `.veu`, `[data-fecha]`, `[data-esc]`, `[data-continuar]`, `[data-depois]` presentes; robô passa |
| **U12. Configurações e Modo foto** | modal com abas, interruptores, opções novas; barra de foto com Ajustes (exposição, contraste, saturação, vinheta, bloom via `engine.params`); sai o Comparar; cartão de foto novo | `fonte/ui/extras.js`, `fonte/main.js` (se `fotoURL` deixar de ser usado), CSS | cenas `config`, `apreciar*` (a `apreciar-comparar` sai da vitrine), `fotografar-cartao`, `cores`; o cartão sai em 1200 x 630 |
| **U13. Carga e girar** | tela de carga e de girar novas; `theme-color` do manifesto | `fonte/main.js`, `fonte/web/index.html`, `fonte/web/manifest.webmanifest`, CSS | captura da carga nos 2 tamanhos; sem emoji |
| **U14. Camadas e miniaturas** | as 4 camadas da seção 3.6.19 e, se a frente gráfica aprovar, miniaturas 3D do catálogo da Cidade renderizadas uma vez | `fonte/jogo.js`, `fonte/render/mundo.js` e `fonte/render/cidade.js` (sobreposições que já existem), novo `fonte/ui/camadas.js`, CSS | cena nova `camadas`; captura 3D de cada camada; até +2 chamadas com a camada ligada e 0 desligada (`engine.stats`) |
| **U15. Estatísticas e Progresso** | `S.serie` em `sim/estado.js` (amostra por dia do jogo, 360 pontos, migração com padrão vazio); painel Estatísticas com gráficos em SVG; painel Progresso (capítulos e níveis) | `fonte/sim/estado.js`, `fonte/core/salvar.js` (migração, se precisar), novos `fonte/ui/paineis/estatisticas.js` e `progresso.js`, teste de migração em `simular.mjs --testes` | save antigo abre com a série vazia (teste); cenas novas `estatisticas` e `progresso` |
| **U16. Revisão e publicação** (robô) | passada final de consistência (tokens, pesos, espaçamentos), capturas no PC 1376 x 768 e no celular, README (seção de interface com números medidos), `docs/VISAO.md` (referências de UI) | README, `docs/`, CSS | vitrine `todas` limpa; robô passa; capturas de aceite enviadas ao dono |

**Tamanho aproximado:** U2, U3, U4, U6 e U15 são as maiores; U0, U1, U13 e U16 são curtas. As parcelas U5 a U8 podem
andar em worktrees paralelos depois da U4, porque cada uma fica num arquivo de painel próprio e numa seção própria do CSS
(o CSS pode ser dividido por componente na U4 também: `estilo.css` importando `hud.css`, `folha.css`, `mundo.css`,
`modais.css`, juntados na montagem).

## 5. Riscos e cuidados

- **Largura em 915 px:** a barra de estado e o grupo do sistema somam uns 820 px. Se um número crescer (créditos na casa
  dos milhões), a data vai para a forma curta e a renda/h vai para baixo do valor. A U0 mede o transbordo.
- **Glifos de itens:** 54 desenhos novos são o maior trabalho manual. Se atrasar, a U2 entrega os glifos de UI primeiro e
  os itens entram com um desenho provisório (os desenhos de hoje, sem brilho e sem reflexo, dentro do chip), trocados
  depois na mesma API.
- **Vitrine sobre fundo do jogo:** a captura de fundo precisa ser atualizada quando a frente visual mudar o mundo; os
  retângulos de "cobre" (Sede e Biblioteca) também.
- **Hábitos do dono:** a mudança é grande. As 3 primeiras partidas depois da troca devem mostrar o Mural com uma fala de
  Íris explicando onde cada coisa foi parar (entra no grupo de dicas, sem mexer no tutorial).

## 6. Decisões principais

1. Vidro grafite escuro, sem desfoque no celular; desfoque só no PC em Alta e Ultra, em até 3 elementos.
2. Inter (OFL) como fonte única, 12 px de mínimo, números tabulares; saem a Baloo 2 e o contorno de texto.
3. Um sistema de glifos de traço em SVG entregue pela mesma API `img()` e `icone()`; itens em chip de cor por família;
   retratos em monograma.
4. Estado no alto à esquerda (adaptação do rodapé do CS2 ao celular), sistema no alto à direita, Objetivo embaixo à
   esquerda, barra de ferramentas embaixo à direita com Obras primário, folha de detalhes à esquerda.
5. Balões viram marcadores de 30 px com haste, cor e forma por estado, e filtro "só importantes".
6. Falas viram aviso no alto e Mural com histórico, com opção de irem só para o Mural.
7. Número explícito sempre (nunca só seta), lição da maior crítica à UI do CS2.
8. Sem pausa nem velocidade: a economia em tempo real é regra do dono; o calendário ocupa o lugar.
9. Saem da UI a foto de referência, o Comparar e a miniatura da foto, conforme o dono.
10. Novidades do CS2: Camadas, Mural, Progresso, Finanças na barra, Estatísticas, Localizar e atalhos no PC.
11. Contratos preservados: `data-a`, os seletores dos modais que o robô usa, as APIs de `Hud`, `Paineis` e `Bolhas`.
12. Celebração sóbria: luz, contagem e som; sem confete.

## 7. Fontes

Legenda: (b) lido pelo resumo da busca; (d) aberto diretamente.

1. UI Modding, Cities Skylines 2 Wiki: https://cs2.paradoxwikis.com/UI_Modding (b)
2. Info views, Cities Skylines 2 Wiki: https://cs2.paradoxwikis.com/Info_views (b)
3. GameSkinny, poluição e o botão "i" das info views: https://www.gameskinny.com/tips/cities-skyline-2-how-to-reduce-every-type-of-pollution/ (b)
4. Steam, velocidade da simulação: https://steamcommunity.com/app/949230/discussions/0/3877096256094421100/ (b)
5. Steam, renda e população por hora como número: https://steamcommunity.com/app/949230/discussions/0/3937895063006207114/ (b)
6. Progression, Cities Skylines 2 Wiki: https://cs2.paradoxwikis.com/Progression ; Development Diary #10: https://colossalorder.fi/news/development-diary-10-game-progression/ ; Feature Highlight #10: https://www.paradoxinteractive.com/games/cities-skylines-ii/features/game-progression (b)
7. Assets: Common Asset Principles (miniaturas 128 x 128): https://cs2.paradoxwikis.com/Assets:_Common_Asset_Principles (b)
8. Steam, anúncios do CS2 (painel do selecionado à esquerda, abas Info e Personalizar): https://steamcommunity.com/app/949230/announcements/ (b)
9. Feature Highlight #11, Citizen Simulation & Lifepath: https://www.paradoxinteractive.com/games/cities-skylines-ii/features/citizen-simulation-lifepath ; Economy (wiki): https://cs2.paradoxwikis.com/index.php?title=Economy&mobileaction=toggle_view_desktop (b)
10. PC Gamer, Chirper e Lifepath: https://www.pcgamer.com/chirper-might-actually-be-useful-for-keeping-track-of-your-citizens-lifepaths-in-cities-skylines-2/ (b)
11. Neowin, Chirper volta no CS2: https://www.neowin.net/news/chirper-social-media-returns-in-cities-skylines-2-as-citizens-get-more-complex-lives/ (b)
12. Painel de economia e empréstimo: https://cs2.paradoxwikis.com/index.php?title=Economy&mobileaction=toggle_view_desktop ; Dev Diary Economy 2.0 parte 2: https://www.paradoxinteractive.com/games/cities-skylines-ii/news/dev-diary-economy-part-two (b)
13. Feature Highlight #13, Cinematic Camera & Photo Mode: https://www.paradoxinteractive.com/games/cities-skylines-ii/features/cinematic-camera-photo-mode (b)
14. Photo Mode, Cities Skylines 2 Wiki: https://cs2.paradoxwikis.com/Photo_Mode (b)
15. GameRant, modo foto (câmera embaixo à direita): https://gamerant.com/cities-skylines-2-how-use-photo-mode-screenshot-save-location/ (b)
16. Steam, ícones de queixa sobre os prédios: https://steamcommunity.com/app/949230/discussions/0/3937895474111100542/ ; Category:Notification icons: https://cs2.paradoxwikis.com/Category:Notification_icons (b)
17. PC Gamer, "Not Enough Customers": https://www.pcgamer.com/cities-skylines-2-not-enough-customers/ ; GamesRadar: https://www.gamesradar.com/cities-skylines-2-not-enough-customers/ (b)
18. TechRadar, análise do CS2: https://techradar.com/gaming/consoles-pc/cities-skylines-2-review-road-to-success (b)
19. TheSixthAxis, análise do CS2: https://www.thesixthaxis.com/2023/10/24/cities-skylines-2-review/ (b)
20. Paradox Forum, "What we ABSOLUTELY LOVE about Cities Skylines 2": https://forum.paradoxplaza.com/forum/threads/what-we-absolutely-love-about-cities-skylines-2.1621641/ (b)
21. Steam, "The monthly balance is so confuse": https://steamcommunity.com/app/949230/discussions/0/4406290986177065637/ (b)
22. Steam, discussão de UI do CS2 (play e pausa, simulação que não aparece na UI): https://steamcommunity.com/app/949230/discussions/0/3817410454871282505 (b)
23. Steam, "Is there a way to hide the warning icons over buildings?": https://steamcommunity.com/app/949230/discussions/0/3877096256099749457/ (b)
24. Steam, "Chirper messages makes no sense": https://steamcommunity.com/app/949230/discussions/0/3877096256094450019/ (b)
25. GameSkinny, desligar o Chirper: https://www.gameskinny.com/tips/cities-skylines-2-how-to-turn-chirper-off/ (b)
26. GitHub, Infixo/CS2-LandValueHeatmap: https://github.com/Infixo/CS2-LandValueHeatmap (d)
27. Steam, "UI Scale" do CS2: https://steamcommunity.com/app/949230/discussions/0/601913251731809415/ (b)
28. GitHub, kendallroth/cs2-city-stats: https://github.com/kendallroth/cs2-city-stats (d)
29. Patch 1.1.X, Cities Skylines 2 Wiki: https://cs2.paradoxwikis.com/Patch_1.1.X ; notas do 1.1.10f1: https://updatecrazy.com/cities-skylines-2-update-1-1-10f1-patch-notes/ (b)
30. Anno 117, destaque de acessibilidade: https://news.ubisoft.com/en-us/article/2FfSSEUp1jtg9isC9NxowP/anno-117-pax-romana-accessibility-spotlight (b)
31. Production Chains in Highrise City: https://gamicus.fandom.com/wiki/Production_Chains_in_Highrise_City (b)
32. Highrise City, guia para iniciantes (barra de cima e monitor de recursos): https://www.magicgameworld.com/highrise-city-beginners-guide-tips-for-a-successful-city/ (b)
33. OneUpNerd, análise de Highrise City: https://oneupnerd.com/review/highrise-city-review/ (b)
34. GINX, Highrise City: https://www.ginx.tv/en/highrise-city-best-simcity-successor-you-ve-probably-never-played (b)
35. Anno Union, DevBlog da equipe de UI: https://www.anno-union.com/devblog-the-user-interface-team-and-a-deeper-dive-into-the-visuals/ ; produção de ícones: https://www.anno-union.com/devblog-our-icon-production-process/ (b)
36. Steam, "Has Good UI Design Become a Lost Technology of the Ancients?" (Anno 117): https://steamcommunity.com/app/3274580/discussions/0/553491276511602715/ (b)
37. Anno 1800 Wiki, Statistics: https://anno1800.fandom.com/wiki/Statistics (b)
38. gagadget, Frostpunk 2 e a interface: https://gagadget.com/en/494135-intuitive-and-clear-frostpunk-2s-game-director-talked-about-the-main-changes-in-the-interface-and-visual-design-of-the-game/ (b)
39. Frostpunk no X, mudanças de UI e UX: https://x.com/frostpunkgame/status/1815378831647154209 (b)
40. Xbox Wire, Frostpunk 2 no controle: https://news.xbox.com/en-us/2025/09/18/adapting-frostpunk-2s-depth-to-a-gamepad/ (b)
41. Steam, "UI thoughts from a professional Dashboard Dev" (Manor Lords): https://steamcommunity.com/app/1363080/discussions/0/598539452432936012/ (b)
42. Medium, "Notes on Manor Lords": https://medium.com/@bea.nasling/notes-on-manor-lords-early-days-e9a5182fcbae (b)
43. Steam, "I just can't deal with the UI" (Workers & Resources): https://steamcommunity.com/app/784150/discussions/0/6895657216189386139/ (b)
44. Steam, "UI too small" (Workers & Resources): https://steamcommunity.com/app/784150/discussions/0/3193614756859650064/ ; Techarx: https://techarx.com/workers-resources-soviet-republic-early-access-review/ (b)
45. Eremite Games, Interface Update: https://eremitegames.com/interface-update/ (b)
46. Eremite Games, Interface Hotfix: https://eremitegames.com/interface-hotfix-we-hear-you/ (b)
47. TouchArcade, análise de Pocket City 2: https://toucharcade.com/2023/04/18/pocket-city-2-review-mobile-iphone-ipad-premium-city-builder/ (b)
48. Pocket Gamer, Frostpunk: Beyond the Ice: https://www.pocketgamer.com/frostpunk-beyond-the-ice/review/ (b)
49. GamingonPhone, Frostpunk: Beyond the Ice: https://gamingonphone.com/reviews/frostpunk-beyond-the-ice-game-review/ (b)
50. LogRocket, tamanhos de alvo de toque: https://blog.logrocket.com/ux-design/all-accessible-touch-target-sizes/ ; 72Technologies: https://www.72technologies.com/blog/tap-targets-thumb-zones-mobile-ux (b)
51. Parachute Design, zona do polegar: https://parachutedesign.ca/blog/thumb-zone-ux/ (b)
52. Timothy Graf, zona do polegar: https://timgraf.com/ux-design/designing-for-the-thumb-zone-a-modern-guide-to-mobile-ux-that-respects-human-anatomy/ (b)
53. GitHub, custo do blur na HUD no Android (Station-Sciences/bot-crossing #74): https://github.com/Station-Sciences/bot-crossing/issues/74 (d)
54. MDN, backdrop-filter: https://developer.mozilla.org/docs/Web/CSS/Reference/Properties/backdrop-filter (b)
55. Inter, licença e uso em UI: https://madegooddesigns.com/inter-font/ ; https://www.fonthubs.com/en/fonts/inter (b)
56. Barlow Semi Condensed (alternativa avaliada e descartada: condensadas perdem legibilidade abaixo de 13 px): https://fonts.google.com/specimen/Barlow%2BSemi%2BCondensed ; https://fontalternatives.com/blog/best-free-condensed-fonts-2026/ (b)
57. Unified Icon Library (ícones no estilo da UI do CS2 para mods): https://github.com/algernon-A/UnifiedIconLibrary (b)
