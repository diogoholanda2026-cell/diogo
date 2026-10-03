# C1d: interface antes da Prévia 2 (pendências da C1a)

Resultado: as quatro pendências fechadas, com teste. `simular --testes`: 33 arquivos, 32 verdes; só o `arcologia` falha,
no A2 (o mesmo da C1a, do outro agente). `camadas` 18 de 18 (eram 15), `save` 14 de 14 (eram 11), `ui` 24 e
`ui-ferramentas` 41 sem mudança. Vitrine das 16 cenas u2 e x3 (com a nova `u2-sugestao-vila`) nos 4 tamanhos: ok.
Montagem sem avisos: jogo 2.049,6 KB (gzip 726,4 KB; teto 2.355), sob demanda 398,7 KB. Nada commitado.

## 1. Guia da primeira hora (`fonte/ui/guia/`)

- `SUGESTAO_DO_OBJETIVO`: `cidade.vila` vai para 'vila' e `cidade.ligacao` para 'ligacao'. `CATEGORIA_DO_OBJETIVO`: as
  duas apontam Vias (o anel).
- Tipo 'melhorar': `comandosDaSugestao` dá um `via.melhorar` com as arestas e o tipo da sugestão. O `usarSugestao` relê
  `q.sugestoes()` na hora do toque (as refs mudam quando uma via divide a rua, e a rua que o jogador já melhorou sai).
  Se o comando com todas recusa por outro motivo que não dinheiro, melhora rua por rua. Sem rua de terra, não manda
  nada nem avisa. A ferramenta de via serve (o "Usar sugestão" aparece em qualquer modo dela).
- Fantasma das ruas: uma linha tracejada por rua, pela curva do espelho (9 pontos por aresta; sem o espelho, o par de
  nós). Os nós em sequência ligavam ruas que não se tocam. O botão fica no ponto de rua mais perto do centro da Vila.
- Releitura: `guiaDaSim(sim, chave)` guarda a lista e as prévias por partida e só relê quando a chave muda. A chave são
  os objetivos abertos mais a versão dos eventos do guia ('construido', 'demolido', 'objetivo', 'marco',
  'desbloqueio', 'carregado', pela identidade do último em `loja.eventos`). Nada por quadro. O teste conta as
  chamadas: 30 leituras dão 1 consulta; 'financas' não relê; 'construido' relê e a 'vila' encolhe.
- Pedreira antes da avenida: `resolverSugestoes` lê a prévia (`construir.previa`) do prédio sugerido.
  - 'acesso': troca pela via sugerida que passa a até 150 m (`viaQueServe`; a avenida fica a uns 60 m), sem repetir o
    traçado se a avenida já está à vista, e o anel aponta Vias (`categoriaGuiada` aceita `trocas`).
  - 'creditos' ou 'marco': a sugestão fica.
  - Outra recusa (o prédio já construído no lugar, à espera das linhas do objetivo, ou outra coisa em cima): o fantasma
    sai.
  - Com a avenida feita, a Pedreira volta.

## 2. Camadas (`ui/telas/corpo/Camadas.jsx`, `ui/mundo/camadas.js`)

- `criarVigiaDiario()` olha `sim.mudancas` (desde a versão em que a camada foi consultada). `diarioMarcou(res, fonte)`
  confere o domínio da fonte: células na Zonas, prédios, arestas; a grade não olha.
- Olha a cada 250 ms com o jogo pausado e a cada 1 s com ele andando. Andando, só células e vias contam: os prédios
  marcam 1 a 3 por tique pela obra e pelos moradores, e o dado deles vem na virada da rodada (medido na robo-1 a 2 h).
- A conferência da rodada a cada 2 s continua. Pausado e sem comando, nada se consulta (testado).
- Medidas na robo-1 a 2 h (282 prédios, 10,5 mil células), por consulta: Zonas 1,6 ms; Bem-estar 0,5; Água 0,14;
  Energia 0,09; Serviços 0,09; Nível 0,07; Valor 0,47; Recursos 14,8 (é por grade, não olha o diário).
  `desde()` com 2.000 marcas: 0,3 ms.
- Teste com a simulação de verdade e o corpo JSX montado pelo esbuild: a Zonas ligada, zona pintada com o jogo pausado
  vai ao render na olhada seguinte, com as células pintadas no dado.
- Achado na vitrine (já existia antes, também na `x3-camadas`): em 1920 x 1080 a legenda encostava na barra de
  construção. A legenda fica no mundo, sem zoom, e a barra tem zoom 1,25. A folga (60 px embaixo e 100 px no modo alto)
  agora multiplica por `--zoom`.

## 3. Avisos sobre os prédios (`ui/prefs.js`)

- `PREFS_PADRAO.avisos = 'importantes'` ("Graves e atenção"). `lerPrefs` só completa o que falta: quem gravou outro
  filtro mantém; quem nunca escolheu (as prefs de antes não tinham a chave) passa ao padrão novo.
- Testado com um localStorage de mentira. A vitrine confere o padrão marcado no popover das camadas e nas
  Configurações.

## 4. Legenda do bem-estar

- Coube: sob a rampa, uma linha com a Contribuição de cada faixa em dólar por hora pelo `fmt.dinheiroPorHora`:
  "US$ 3.000/h · US$ 4.800/h · US$ 6.600/h".
  - Cada faixa ocupa a largura dela na rampa (0 a 30,5, 30,5 a 60,5, 60,5 a 100), com um traço em cima. A faixa da
    cidade agora (a tarifa do resumo) fica com o traço champanhe e em negrito.
  - A dica de cada uma: "Bem-estar de 0 a 30: Contribuição de US$ 3.000/h por morador", com a dica da hora (D42).
  - As faixas saem de `REGRAS_DONO.renda` (5, 8 e 11; limiares 30,5 e 60,5), sem número nos textos da S2a.
- Em 915 x 412 cabe com folga (faixas de uns 100 e 130 px para textos de uns 75 px).

## Para o integrador

- `fonte/ui/mundo/marcadores.js` (fora da minha lista) ainda tem 'todos' como reserva de `filtroAtual` e
  `escolherAvisos` quando as prefs não trazem o filtro. O jogo sempre passa as prefs completas (lerPrefs), então o padrão
  novo vale. Se quiser coerência, a reserva pode ler `PREFS_PADRAO.avisos`, e o teste de `camadas` linha
  `filtroAtual({})` muda junto.
- O objetivo `holding.pedreiraAreal` pede Pedreira e Areal, mas o guia só sugere a Pedreira. Antes da avenida o guia
  agora mostra a avenida. Se o dono quiser, o Areal (com acesso pela estrada de terra desde o começo) pode entrar como
  segunda sugestão do objetivo.
- PROJETO (ficha C1) e `docs/entregas/onda3/C1a.md`: as pendências 3, 4 e 5 da C1a e o filtro padrão da revisão estão
  feitos aqui.

## Arquivos

- fonte/ui/guia: regras.js, Guia.jsx, sugestoes.js, objetivos.js.
- fonte/ui/mundo/camadas.js, fonte/ui/telas/corpo/Camadas.jsx, fonte/ui/prefs.js (só o padrão do filtro),
  fonte/ui/textos/x3.js (2 chaves).
- ferramentas/testes: save.teste.mjs (3 testes novos da primeira hora) e camadas.teste.mjs (faixas, diário, camada
  pausada e filtro padrão).
- ferramentas/vitrine/cenas: u2.js (cena nova `u2-sugestao-vila`, filtro padrão nas Configurações) e x3.js (faixas e
  filtro padrão).

Medidas em `scratchpad/novo/C1d/`: `medir-diario.mjs`, `medir2.mjs`, `testes.txt`, a vitrine em `ui/` e `ui2/`, e a
montagem em `montagem/`.
