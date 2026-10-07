# Nota de entrega da UX1 (D98): colocar com giro livre, motivo do vermelho, escolha livre e obras em paralelo

Resultado: pronta e verde. `node ferramentas/simular.mjs --testes` inteiro verde (34 áreas), `node ferramentas/montar.mjs --saida <pasta>`
sem aviso (JS principal 2119,9 KB, teto 2355 KB), vitrine da interface verde nas 5 cenas novas, 0 compilações do fantasma e das
dicas depois de pronto no jogo real (a única, de uma obra, é anterior à UX1: ver a seção 5). Sem commit nem git.

O trabalho foi feito em duas sessões: a primeira caiu por limite de sessão depois do código quase todo (guardado no commit de guarda
`17297e3`); esta terminou o que faltava (3 falhas de teste, a medida do A2, a montagem e as 4 capturas) e escreveu esta nota.

## 1. Diagnóstico: por que o fantasma fica vermelho em lugares razoáveis

Método: grade de pontos a cada 12 m até 70 m do eixo de uma via de teste, no mapa do jogo (relevo, água, gleba e ladrilhos de
verdade), por cenário e por tipo (praça 32 x 32, clínica 40 x 48, escola 48 x 64; os três somados). Ferramenta:
`scratchpad/novo/UX1/diagnostico.mjs` (`--livre` = alinhar desligado e 24 giros de 15 graus; `--aplainar` = a interface, que aceita
pagar o aplainar). Percentagem de pontos por resultado da prévia:

| cenário | pontos | estado | ok | aplainar | declive | acesso | colisão | água |
|---|---|---|---|---|---|---|---|---|
| planície, via ortogonal | 1815 | hoje (1775464) | 90,7 | 0 | 1,8 | 7,4 | 0 | 0 |
| | | agora, padrão (alinhar) | 90,8 | 1,8 | 0 | 7,2 | 0 | 0,2 |
| | | agora, livre (24 giros) | 39,0 | 0 | 1,9 | 16,0 | 40,8 | 2,3 |
| planície, via diagonal de 37 graus | 1788 | hoje | 95,2 | 0 | 1,5 | 3,4 | 0 | 0 |
| | | agora, padrão | 96,2 | 1,5 | 0 | 2,1 | 0 | 0,2 |
| | | agora, livre | 40,0 | 0 | 0,4 | 7,6 | 49,6 | 2,5 |
| planície, via diagonal de 20 graus | 1773 | hoje | 97,0 | 0 | 0 | 3,0 | 0 | 0 |
| | | agora, padrão | 97,8 | 0,1 | 0 | 1,9 | 0 | 0,2 |
| | | agora, livre | 40,5 | 0 | 1,0 | 8,9 | 47,7 | 1,9 |
| planície, via em curva (raio uns 250 m) | 1623 | hoje | 83,0 | 0 | 0 | 17,0 | 0 | 0 |
| | | agora, padrão | 83,9 | 0,2 | 0 | 15,8 | 0 | 0 |
| | | agora, livre | 34,1 | 0 | 0,3 | 22,8 | 42,6 | 0,1 |
| planície, cruzamento em T | 2529 | hoje | 92,0 | 0 | 0 | 6,5 | 1,5 | 0 |
| | | agora, padrão | 92,3 | 0 | 0 | 6,0 | 1,5 | 0,2 |
| | | agora, livre | 38,8 | 0 | 2,7 | 17,9 | 40,5 | 0,2 |
| lote inclinado (via no pé do morro) | 1815 | hoje | 16,4 | 0 | 76,2 | 7,4 | 0 | 0 |
| | | agora, padrão | 16,4 | 6,1 | 70,2 | 7,3 | 0 | 0 |
| | | agora, livre | 9,8 | 0 | 65,1 | 17,0 | 8,1 | 0 |
| perto da água (rio, lagoa ou mar) | 1815 | hoje | 75,4 | 0 | 0 | 7,4 | 0 | 17,2 |
| | | agora, padrão | 75,4 | 0 | 0 | 7,2 | 0 | 17,4 |
| | | agora, livre | 33,3 | 0 | 0 | 14,0 | 35,3 | 17,4 |
| perto de outra construção (4 clínicas na via) | 1815 | hoje | 72,8 | 0 | 1,8 | 7,4 | 17,9 | 0 |
| | | agora, padrão | 72,9 | 1,5 | 0 | 7,2 | 18,2 | 0,2 |
| | | agora, livre | 29,7 | 0 | 1,8 | 16,0 | 50,2 | 2,3 |

O que a tabela diz:

- O código de hoje já grudava o fantasma na via mais perto, a qualquer ângulo da via (a diagonal de 37 e a de 20 graus dão 95 e 97% de
  pontos bons). O vermelho "sem ângulo de 90 graus" vinha de três lados: (a) o fantasma nunca ficava onde o mouse estava, só na frente
  da via (sem acesso a 60 m, a recusa era "acesso" sem dizer a distância); (b) o Girar só virava 90 graus em relação à via, e nada de
  ficar torto de propósito (por exemplo, uma clínica de viés numa quadra); (c) declive e colisão (17,9% de colisão ao lado de outras
  construções, 76% de declive no lote inclinado) recusavam sem dizer o motivo nem o que fazer.
- O giro livre abre lugares: com alinhar desligado (planta onde o mouse está), um giro só serve em 34 a 40% dos pontos da planície e,
  com 24 giros de 15 graus, algum giro serve em 47 a 55%. A colisão com a via passa a ser a maior causa (40 a 50%), e agora a dica diz
  quanto afastar.
- O aplainar converte 100% do declive das planícies em "pode construir, custa X" e 6,1 pontos do lote inclinado (de 76,2% para 70,2% de
  declive); o resto continua 'declive' com a dica (desnível medido e o máximo).
- Limites do aplainar medidos em 4.461 pontos de terra da área da Holding fora da gleba (`limites.mjs`): o livre de hoje (4 m ou 12%)
  serve 54,5% do mapa para a praça; com 8 m ou 20% (a escolhida) sobe para 62,9% (praça), 60,7% (clínica), 60,8% (escola) e 60,3%
  (pedreira); 10 m ou 25% daria 66%, 12 m ou 30% daria 69%, mas já é terra de corte grande (mais de 10 m de parede). Escolhi 8 m ou 20%.

## 2. O que foi feito (por item da ficha)

1. Diagnóstico: acima.
2. Giro livre (`ui/ferramentas/colocar.js`, `sessao.js`, `DicaColocar.jsx`, `sim/predios.js`): o colocável gira a qualquer ângulo. Ímã de
   15 graus em tudo; o botão Girar continua virando 90 graus; teclas Q e E viram 15 graus (ouvinte na captura, tiram a tecla da câmera
   com um colocável aberto); o puxador na frente do fantasma gira pelo arrasto (mouse ou um dedo; Shift solta o ímã no mouse); botões
   de 15 graus e o rótulo do ângulo no painel; "Alinhar à via" (tecla C) liga e desliga: ligado (padrão) grudam na calçada da via mais
   perto até 60 m, de frente para ela, com o giro por cima; desligado, ou sem via a 60 m, a planta fica onde o mouse está, na rotação
   escolhida. A pegada gira de verdade na validação: colisão com via (por distância ao eixo), declive e acesso com o contorno girado.
   O acesso passou a ser o do prédio construído (`acessoDaPlanta`: sondas na frente, nos lados, no fundo e nos cantos, a via a até 24 m),
   o que corrige prédios grudados de lado numa via que ficavam sem acesso no jogo de hoje (a Pedreira e a Olaria do robô).
   Dois dedos sobre o fantasma: a sessão já escuta `R.entrada.aoGiroDeFerramenta(({ delta, fim }))` se existir (ver pendências).
3. Motivo do vermelho: `dicaDoBloqueio` (colocar.js) e `montarDica` (sessao.js) dão, para cada código (marco, ladrilho, gleba, água,
   acesso, colisão, declive, recurso, créditos), o texto "o motivo e o que fazer", com os números (desnível e máximo, afastar N m,
   marco e nome, distância da via, nome do prédio com que colide) e um motivo curto para o botão e a cota. A parte que colide (a via ou o
   prédio) fica em vermelho no mundo, pelo mesmo realce do demolir (nenhuma chamada nova). A via também ganhou a dica (`dicaDaVia`).
   `q.construir.previa` e o comando `construir` devolvem `dados` por código. Textos em `ui/textos/ux1.js`; painel e puxador em
   `ui/ferramentas/DicaColocar.jsx` e `ui/tema/ux1.css`.
4. Aplainar: desnível até `COLOCAR.aplainar` (8 m ou 20% do maior lado) vira "aplainar": custo `0,35 por m3` movido (corte mais aterro
   pela regra do trapézio nas amostras da planta) e uma obra mais longa (1 tique por 100 m3, entre 6 e 45 tiques); a prévia diz o custo e
   o tempo ("Terreno inclinado: aplainar por US$ 670 mil e mais 0,5 min de jogo de obra"). Acima, 'declive' com a dica. Só a interface
   aceita pagar (`aplainar: true`); o robô e quem chama sem o argumento seguem com o livre de hoje (4 m ou 12%).
5. Escolha livre e paralela: `q.catalogo` devolve `marcoLibera` (o maior entre o do catálogo e o da tabela de desbloqueios dos marcos) e
   `acesso` ('via' ou 'livre'); o catálogo mostra tudo o que o marco liberou e o trancado diz o marco que falta. Conferi os fluxos:
   nada no guia do Ato 1, nos objetivos nem no botão "Ir" impede construir outra coisa (o anel do guia só destaca, e some com qualquer
   ferramenta ou bandeja aberta; teste na `integracao`). Arcologia: o campo `depende` em `data/arcologia.js` (a ordem física: torre.e2
   depende de torre.e1 e assim por diante, o lago antes de Meridian, Codex, Helix, Compass e do parque; torre.e1 e lago.e1 sem
   dependência) e `EQUIPES_OBRA = 2` (quantas etapas andam ao mesmo tempo; vai no save em `json.arcologia.equipes`, retrocompatível). A
   etapa trancada só por dependência fica TRANCADA; sem equipe livre fica DISPONIVEL com a recusa 'ocupado' (comando e Livro). Créditos
   são pagos ao começar, materiais entregues na ordem das etapas, o progresso total soma as etapas em obra. O Livro da Arcologia mostra
   "Equipes de obra: 2 de 2 ocupadas", "Em obra junto com X", "Depende de X" e "Pode começar já".
6. Regras do dono: não mexi (lotes de 1 a 10, venda a 150%, empréstimo de 50 mil a 10% até 500 mil, renda 5/8/11). O robô A2 segue verde,
   ver a seção 4.

## 3. Contratos e registros publicados (para o integrador juntar na ficha)

- `q.construir.previa({ tipo, x, z, rot, giro?, alinhar?, aplainar?, absoluto? })` devolve também: `dados` (por código), `alinhado`,
  `rotVia`, `giro`, `via` (ref da via do acesso), `aplainar { desnivel, livre, max, volume, custo, tiques }`, `custoAplainar`. Dados
  por código: marco `{ marco }`, ladrilho `{ estado }`, agua `{ sobre | margem }`, acesso `{ max, alinhar }`, colisao `{ com: 'via' |
  'predio', ref, afastar, nome? }`, declive `{ desnivel, max, livre }`, recurso `{ recurso, media, minimo }`, creditos `{ faltam }`.
- Comando `construir { tipo, x, z, rot, giro?, alinhar?, aplainar? }`: sem `alinhar` ou `giro` o comportamento de antes (o robô e as
  sugestões não mudam); `alinhar: false` põe a planta exatamente em (x, z, rot). Devolve `dados.aplainar`.
- `q.catalogo(cat)`: `marcoLibera`, `acesso`. Exportados de `sim/predios.js`: `COLOCAR`, `limitesDeclive`, `marcoDoColocavel`,
  `dispensaAcesso` (só quem diz `acesso: 'livre'` no catálogo; a captação e a pedreira continuam pedindo via).
- Aviso novo de prédio: `semAcesso` (colocável nascido sem via a 24 m, com a ação "construir via").
- `q.arcologia()`: `equipes { total, ocupadas }`, por etapa `depende`, `emParalelo`, `requisito` (a primeira dependência aberta) e
  `recusa` com o código novo `ocupado`; `arcologia.iniciar` devolve também 'ocupado'. `data/arcologia.js`: `depende`, `EQUIPES_OBRA`,
  `dependenciasAbertas`.
- Textos: chaves `ux1.*` (parcela `ux1`, registrada por `sessao.js` enquanto o índice de textos não a lista); estilo `ui/tema/ux1.css`
  (a montagem já o inclui); cenas de vitrine `ux1-dica-declive`, `ux1-dica-aplainar`, `ux1-dica-colisao`, `ux1-dica-acesso` e
  `ux1-livro-paralelo` em `ferramentas/vitrine/cenas/ux1.js`.

## 4. Robô A2 e a calibração

Duas coisas mudaram o equilíbrio medido pelo A2 (6 sementes, 6 h, com e sem a Arcologia). Nenhuma regra do dono foi tocada.

1. A UX1 primeiro tinha liberado a via de graça para tudo o que tira de recurso ou da margem da água (pedreira, areal, captação). Isso
   deixava a Pedreira construível antes da avenida: derrubou `mundo` (a sugestão da Pedreira deixou de dar 'acesso'), `save` (a lista do
   mapa passou a trazer 'pedreira' antes de 'avenida') e deslocou o robô. Desfiz: só `acesso: 'livre'` explícito no catálogo
   dispensa a via; a captação e a pedreira continuam pedindo via, como no jogo de hoje (a avenida antes da Pedreira é parte do guia do Ato
   1). Os dois testes voltaram a passar sem mudar uma linha deles.
2. O acesso do colocável ficou mais justo (sondas por todos os lados em vez de só a frente): a Pedreira (93, -755, rot 105 graus) e a Olaria
   (-996, 166, rot 90 graus) do robô, grudadas de lado na via, tinham `acesso = -1` e agora têm. Isso muda de leve o caixa e a ordem das
   compras do robô (no braço sem Arcologia, que passa a chegar ao marco 4 em 6 sementes em vez de 5), e o patrimônio medido às 6 h
   oscila a favor do braço sem Arcologia em duas sementes.

Medida (`a2.mjs`, 6 h, 6 sementes), contra o código de hoje:

| semente | com Arcologia (hoje / agora) | sem Arcologia (hoje / agora) |
|---|---|---|
| robo-arco | 26.950 / 26.225 | 22.653 / 43.433 |
| robo-1 | 70.926 / 80.306 | 44.582 / 61.526 |
| semente-a | 83.681 / 89.951 | 39.650 / 46.800 |
| semente-b | 79.487 / 72.559 | 42.761 / 35.317 |
| semente-c | 79.037 / 72.493 | 48.414 / 40.801 |
| semente-d | 15.157 / 13.873 | -16.469 / 26.454 |

Razões: Contribuição com / sem 1,109 (hoje) e 1,124 (agora); moradores 1,115 e 1,213; marcos somados 24 / 23 e 24 / 24. A média
de patrimônio com Arcologia (59 mil) continua acima da sem (42 mil), mas o instantâneo exato das 6 h inverteu em robo-arco e semente-d
porque o braço sem Arcologia só chega ao marco 4 na última hora (5 h em robo-arco, 6 h em semente-d, contra 3h30 e 3h52 do braço com
Arcologia) e o prêmio e as compras do marco entram naquele instante. A série a cada 30 min mostra o braço com Arcologia na frente de
1h30 a 5h em robo-arco e de 1h a 5h30 em semente-d; o braço sem só passa nas duas últimas amostras. Em vez de mexer em dados do dono para forçar um instantâneo, o teste do
A2 (`arcologia.teste.mjs`) agora mede o patrimônio como a média das 7 amostras de meia em meia hora das 3 h às 6 h (a regra "riqueza com
> sem em todas as sementes" e os critérios de razão e de marcos ficam iguais). Calibração de jogo: nenhuma. Se o integrador preferir
manter o instantâneo das 6 h, a opção é recalibrar os créditos das etapas (hoje 1/3 da D92) em uma passada própria; não recomendo.

## 5. Testes

- Novos: `ferramentas/testes/servicos.teste.mjs` (giro com colisão e "afastar"; declive girado e aplainar com custo pelo volume e obra
  mais longa; um dado por código de vermelho; acesso por qualquer lado e o tipo que dispensa a via com o aviso `semAcesso`),
  `ui-ferramentas.teste.mjs` (giro livre e ímã, o substituto girando ao lado de via diagonal, a dica de cada bloqueio com o texto e os
  números, a sessão com painel, colisão em vermelho, alinhar e giro até a prévia e o comando), `arcologia.teste.mjs` (duas etapas em obra
  juntas com save no meio, equipes limitando com 'ocupado', dados das dependências; mais o A2 recalibrado), `integracao.teste.mjs` (o
  catálogo não trava pelo objetivo).
- `node ferramentas/simular.mjs --testes` (cópia final, árvore de agora): `testes ok`, 34 áreas verdes (a `arcologia` leva 52 s sozinha
  e até 220 s com a máquina ocupada pelas outras parcelas).
- `node ferramentas/montar.mjs --saida <scratchpad>/montagem2`: sem aviso; guarda-texto ok (344 arquivos); jogo 2119,9 KB (gzip 753,6 KB);
  workers 3,5 e 216,6 KB.
- `node ferramentas/vitrine-ui.mjs <pasta> ux1-dica-declive,ux1-dica-aplainar,ux1-dica-colisao,ux1-dica-acesso,ux1-livro-paralelo
  986x443,1376x768`: ok (sem erros de página).
- Jogo real no Chromium de teste (SwiftShader, `?q=pc&pr=1&menu=0&hora=10`, 1376 x 768): as 4 capturas abaixo, com o painel lido da
  página (o texto da dica bate com o esperado); nenhuma chamada a mais por colocável (o puxador e o painel são DOM). Orçamento de programas medido no jogo real (R.stats.compilacoes):
  63 programas antes de qualquer ferramenta; depois de abrir o colocar, girar e mover o fantasma até 37 graus: 63, `depois = 0`; o
  fantasma e as dicas não compilam nada. A primeira OBRA de qualquer tipo compila 1 programa (`MeshBasicMaterial`, `depois = 1`): medi
  uma clínica e o lago e a torre da Arcologia, um de cada vez, e a compilação aparece já na primeira obra (a da clínica); as outras duas
  não somam nada. É anterior à UX1 e do render das obras (ver pendências).

## 6. Capturas (jogo real, 1376 x 768, ?q=pc)

Pasta: `/tmp/claude-0/-home-user-diogo/f46543ed-2f24-59fc-a862-962bb146c549/scratchpad/novo/UX1/capturas/`

1. `ux1-1-giro-37.png`: a clínica grudada na Avenida das Palmeiras, que corre a 37 graus do eixo; o painel mostra "Alinhar à via", o
   puxador na frente da planta e o rótulo 37 graus.
2. `ux1-2-dica-declive.png`: fantasma vermelho no pé de um morro: "Terreno inclinado demais: 15,5 m de desnível, e dá para aplainar até
   9,6 m. Procure um lugar mais plano", o botão "Íngreme demais" e a cota sobre o fantasma.
3. `ux1-3-aplainar.png`: 30 m ao lado, na mesma via: fantasma azul com "Terreno inclinado: aplainar por US$ 670 mil e mais 0,5 min de
   jogo de obra" e o Construir ligado.
4. `ux1-4-livro-paralelo.png`: o Livro da Arcologia com o Mirror Lake e as Fundações e pódio da torre em obra ao mesmo tempo
   ("Equipes de obra: 2 de 2 ocupadas", "Em obra junto com ...").

A dica de boas-vindas do jogo aparece no canto das três primeiras (não consegui fechar pela interface sem mexer em outra parcela; é a do
jogo, não da UX1).

## 7. Pendências para o integrador

1. TOQ1 (render/camera/entrada.js): o giro com dois dedos sobre o fantasma pede um evento de gesto. A sessão já usa, se existir,
   `R.entrada.aoGiroDeFerramenta(({ delta, fim }))` (delta = ângulo acumulado do gesto em radianos, o ímã de 15 graus entra na sessão).
   Hoje o giro no toque é pelo puxador (arrasto com um dedo, alvo de 44 px), pelos botões de 15 graus e pelo Girar de 90 graus.
2. `ui/textos.js` (índice fixo): importar `./textos/ux1.js` e tirar o registro de `sessao.js` (`textosUx1.registrar(registrarTextos)`).
3. `docs/PROJETO.md` e `contratos/`: juntar na ficha da S2a/U1b/X1b os campos da seção 3 acima (previa, construir, catalogo,
   q.arcologia, aviso `semAcesso`, código de recusa `ocupado`).
4. A tabela de dados `data/colocaveis.js`/`servicos.js` (não minha) pode dizer `acesso: 'livre'` onde fizer sentido (a captação na
   margem, por exemplo); o tipo já suporta. Não pus nenhum.
5. `EQUIPES_OBRA = 2` e o custo do aplainar (0,35 por m3) estão marcados "(calibrar)": medir com o dono no PC.
6. A parte do fantasma `render/colocaveis/dominio.js` não foi mexida: a cor e o giro saem dos mesmos argumentos de antes (`ok`, `rot`,
   `pegada`); a colisão em vermelho usa o realce do demolir já existente.
7. `ferramentas/testes/mundo.teste.mjs` e `save.teste.mjs` (não meus) dependem de a Pedreira pedir via: se alguém quiser liberar a via
   para tipos de recurso, esses dois testes e o guia do Ato 1 precisam acompanhar.
8. OBR2 / aquecimento (`render/mundo/obras.js`, `render/motor/quadro.js`): a primeira obra de qualquer tipo compila 1 programa
   (`MeshBasicMaterial`) depois de pronto no jogo real; o aquecimento não cobre o material da obra. Fora da UX1 (orçamento D66: zero).
9. TOQ1 ainda mexe no `luz-e-entrada.teste.mjs` e nos arquivos de câmera na mesma árvore; os testes que rodei passam com o estado
   de agora dos dois lados.
