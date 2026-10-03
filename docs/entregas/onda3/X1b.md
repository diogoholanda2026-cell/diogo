# Nota de entrega: X1b (Arcologia jogável; D26, D49, D51, D59, D88 a D90)

Etapa 3 da onda 3, sobre a sede v3 da SEDE3 (não redesenhada). O Ato 1 da Arcologia joga de ponta a ponta: o Mirror Lake
(lago.e1) e o par Blade Tower e Legacy Tower (torre.e1 a torre.e4), com materiais pela frota, obra por fases no render,
efeitos da D49 no laço, Livro da Arcologia, folha da parte, momento com voo de câmera e o helicóptero da Holding pousando
na Blade depois da torre.e4. O resto da sede fica em fantasma com os dados das etapas do M2 prontos (sem jogabilidade).

## Arquivos

Novos ou completados (todos da parcela):
- `fonte/data/arcologia.js`: as 5 etapas do M1a (marco, etapa anterior, créditos, materiais, minutos, XP, 4 fases, efeitos
  da D49), as 14 do M2 (`ETAPAS_M2`: meridian.e1 e e2, codex.e1, helix.e1, compass.e1, parque.e1 e horizon.1.e1 a
  horizon.8.e1, com o prazo da história: jun. 2026 para a primeira fase e os trechos VI e VII, dez. 2032 para os outros 6)
  e as alturas da obra do par (`alturaBlade`, `alturaLegacy`, `avancoLegacy`, `avancoDaTorre`, `ALTURA_PONTE`).
- `fonte/sim/arcologia.js`: o domínio (comando, consulta, sistema, espelho, evento, efeitos, cava, vias, requisito do
  marco 7, validador).
- `fonte/render/arcologia/obra.js`: estado da obra pelas etapas, as duas gruas de torre (mastro em trechos com
  drawRange, cabeça girando, carrinho), a frente de obra de concreto no topo de cada torre (3 pavimentos, núcleo na
  frente, fôrma trepante, tela), o canteiro do lago (leito de terra, tapume aberto nas avenidas, contêineres, montes) e o
  da torre.
- `fonte/render/arcologia/heli.js`: o domínio 'helicoptero' (biturbina de 13 m na cor da Holding, ciclo de 150 s).
- `fonte/ui/telas/LivroArcologia.jsx` (registro, peças comuns e o momento da etapa) e o novo
  `fonte/ui/telas/corpo/LivroArcologia.jsx` (corpo sob demanda).
- `fonte/ui/selecao/secoes/arcologia.jsx`, `fonte/ui/textos/x1.js`.
- `ferramentas/testes/arcologia.teste.mjs` (8 testes), `ferramentas/vitrine/cenas/x1.js` (4 cenas).

Herdados da X1a e da SEDE3 e mudados:
- `fonte/render/arcologia/torre.js`: corte por lado no shader do vidro e do opaco (`gCorte`, uniformes `uCorteEixo` e
  `uCorteH`, `extrasCorte()`) e `cortePorLado(blade, legacy, vao)` no modelo; `CHAVES` vidro e opaco passaram a -4.
- `fonte/render/arcologia/fantasma.js`: `uAcima` com o mesmo corte (o fantasma só acima da obra).
- `fonte/render/arcologia/planos.js`: a obra no domínio 'arcologia' (par cortado, pódio da obra nos materiais das
  torres, fantasma só acima, gruas e canteiros, alisado de quadro em quadro), `malhasDoPlano` com `podioObra` e
  `lagoObra`, `montarPortoes` (o lago pronto traz a praça do pódio e os portões), vitrine `{ modo: 'jogo', etapas, vias }`,
  `etapas()`, `obra` e `corte` no domínio.
- `fonte/render/cenas/planos.js`: `?etapas=todas | <etapa>:<progresso>`, `?heli=<segundo>` e as vistas obra, ponte,
  heli e noiteAerea; o resultado mede o corte e as gruas.
- `ferramentas/testes/arcologia-render.teste.mjs`: 4 testes novos (obra e corte por lado, grua e frente de obra,
  helicóptero, plano no jogo) e a lista das vistas.

## O que publica

- **Comando** `arcologia.iniciar { etapa }`: paga os créditos (categoria 'arcologia', investimento), abre a obra e pede
  ao armazém o que houver. Códigos: `marco`, `trancado` (a etapa anterior não ficou pronta; e as do M2), `creditos`,
  `emObra`, mais `nada` (já pronta) e `valor` (etapa desconhecida).
- **Consulta** `q.arcologia()`: `{ plano, nome, partes: [{ id, nome, etapas, futuras }], progressoTotal, valor, alturas,
  efeitos, inaugurada }`; cada etapa com `recusa`, `materiais [{ item, pede, entregue, aCaminho, estoque }]`, `fases`,
  `fase`, `progresso`, `materiaisFrac`, `parada` ('material' | 'caixa'), `efeitos`, `xp`, e `ini`, `fim`, `previsao`
  como `{ tique, ano, mes }` (D67).
- **Espelho** `espelho.arcologia = { plano: 'A', etapas: [5 do M1a] }` (marca 'arcologia' quando muda).
- **Evento** `etapa { id, estado }` em cada troca (disponível, em obra, pronta).
- **Mural**: cada etapa pronta e as alturas da obra ("A Blade Tower chegou a 330 m.", "A Dream Bridge foi içada a 330
  m entre a Blade Tower e a Legacy Tower.").
- **Efeitos da D49** (ids em `sim.json.cidade.efeitos`: `arcologia.<etapa>.<tipo>`):
  - lago.e1: as 24 vias internas no grafo com `ARESTA.ARCOLOGIA` (anel em 8 arcos de Bézier, 8 trechos dos portões, 8
    radiais até a praça), reaproveitando o nó do portão onde a via da cidade já chegou; o reservatório na rede de água
    (`sim.redes.produtor`, capacidade 36 = 6 mil moradores, no nó do anel da avenida norte); valor do terreno em volta.
    A cava `cavaDoPlano('A')` entra em `sim.formas` quando a etapa começa (o aplainar desce o leito na hora).
  - torre.e1: 1 licença de ladrilho (`concederLicencas`).
  - torre.e2: `sim.holding.efeito('torre.e2', { produtividade: 0.15, caminhoes: 6 })` e 1.200 vagas nos níveis 2 e 3.
  - torre.e3: 400 moradores de luxo (Contribuição na faixa de 11, 4.400 unidades por hora) e +20 de demanda de
    residencial média em 1,5 km.
  - torre.e4: atratividade +5, valor em volta (raio 900), Legado +5 (`somarMedidor`), o helicóptero; o marco 7 pede
    ela pronta (`sim.progresso.requisito(7, ...)`).
- `sim.arcologia = { vagas(), moradoresLuxo(), valor(), estado(id) }` (fora do contrato).
- **Render**: domínio 'helicoptero' (novo, em `render/arcologia/heli.js`); no 'arcologia', `vitrine({ modo: 'jogo',
  etapas, vias })`, `etapas()`, `obra`, `corte`.
- **Interface**: tela `arcologia` (Livro), `registrarSecao('arcologia')` com `titulo`, `registrarEtapaMomento`.
- **Vitrine**: `x1-livro`, `x1-livro-sede`, `x1-folha-torre`, `x1-momento`.

## Como testei

- `node ferramentas/simular.mjs --testes`: verde antes da parcela (`testes-base.txt`). Na rodada final, a única falha era
  minha (`contratos`: `Math.tan` no arco do anel em `sim/arcologia.js`); trocada por `sen(q) / cos(q)` de `comum/util.js`,
  `contratos` + `arcologia` voltaram a 23 de 23 e a rodada inteira refeita depois das capturas deu "testes ok" (32 arquivos
  e a guarda de texto, 1 min 9 s; saída em `testes.txt`).
- `ferramentas/testes/arcologia.teste.mjs` (8): a cadeia e os códigos do comando (marco, trancado, créditos, em obra, as
  do M2 trancadas); obra parada sem material e andando pela frota, com data de calendário; os efeitos da D49 um a um (24
  vias `ARCOLOGIA`, produtor 36, valor, licença, `holding.efeito` com 6 caminhões, ocupados +600 e +600, demanda de 20
  em 1,5 km, 4.400 por hora de luxo, Legado +5, atratividade, marco 7 só com a torre.e4, `inaugurada`); a cava como forma
  do aplainar (leito abaixo da água, pódio na cota, igual depois do save); os portões nas 8 avenidas (a via da cidade que
  chegou antes reaproveita o nó, 8 portões com 1 aresta interna cada, componente ligada à praça, `via.demolir` recusa com
  'arcologia'); as alturas da obra (Legacy um passo atrás, ponte só com as duas acima de 330 m); save no meio da obra
  com o mesmo hash; e o robô A2 de 6 h que pula a Arcologia termina mais pobre (riqueza = valuation +
  `q.arcologia().valor`; 8 h no `robo2.mjs`: 246 mil contra 135 mil).
- `ferramentas/testes/arcologia-render.teste.mjs`: 42 verdes (4 novos: obra com corte por lado e os mesmos programas;
  grua, frente de obra e canteiros; helicóptero, rota e ciclo sem descer abaixo do heliponto; plano no jogo).
- `node ferramentas/montar.mjs --saida scratchpad/novo/X1b/montagem`: sem avisos. Tamanho: JS principal medido com o
  esbuild em 2.104,5 KB (com as outras parcelas da onda abertas ao mesmo tempo); a minha parte no principal é cerca de
  36 KB (sim 9,0; obra 7,7; textos 5,7; helicóptero 4,5; registro do Livro 2,9; dados 2,7; seção da folha 2,5; o resto
  em planos, torre e fantasma); o corpo do Livro (5,8 KB) entra sob demanda.
- Vitrine da interface (`ferramentas/vitrine-ui.mjs`, cenas x1-*) em 1376 x 768 e 986 x 443: 8 de 8 sem falha.

## Capturas (1376 x 768, ?q=pc, cena planos)

- `capturas/obra-e2.png` (`etapas=torre.e2:0.55&vista=obra`, 16h30): o par em obra, Blade a 133,5 m e Legacy a 83,8 m,
  frente de concreto no topo, as duas gruas (3.544 triângulos), o fantasma só acima da obra. 51 chamadas.
- `capturas/ponte.png` (`etapas=todas&vista=ponte`, 17h30): as torres prontas com a Dream Bridge a 330 m, o Meridian
  Ring, o Horizon Ring e as Supertrees em fantasma. 45 chamadas, 120.904 triângulos da Arcologia.
- `capturas/heli.png` (`etapas=todas&heli=50&vista=heli`, 17h30): o helicóptero da Holding descendo no heliponto da Blade.
  36 chamadas.
- `capturas/noite.png` (`etapas=todas&vista=noiteAerea`, 21h): o Park of Future Dreams à noite, as torres acesas e o
  resto da sede em fantasma. 48 chamadas.
- Vitrine da interface em `vitrine/`: Livro (Ato 1 e A sede), folha da Blade Tower e Legacy Tower, momento da etapa.

## Pendências para o integrador

1. S2a: um gancho para vagas e moradores de uma área (hoje as 1.200 vagas embrulham `sim.holding.ocupados`, a Holding
   contrata primeiro, e a Contribuição dos 400 moradores de luxo entra direto por `sim.holding.receber(..., 'arcologia')`,
   que cai em "outras"). Quando o gancho existir, a X1 troca as duas coisas por ele.
2. S3a: o valuation devia somar `q.arcologia().valor` (a Arcologia é patrimônio da Holding); o robô devia importar o
   que falta durante a obra (sem aço ele para na torre.e1 em 16 h); a reserva padrão do armazém podia seguir o que a etapa
   pede. O Livro já tem "Importar o que falta".
3. S1b ou dono: a manutenção das 24 avenidas `ARCOLOGIA` (cerca de 10,3 km, uns 3.090 por hora pela tabela de avenida)
   é cobrada como qualquer via; decidir se a via interna da sede paga manutenção.
4. Contratos (integrador): `q.arcologia` com os campos novos (`partes`, `progressoTotal`, `valor`, `alturas`, `efeitos`,
   `inaugurada`), os códigos `nada` e `valor` de `arcologia.iniciar`, `sim.arcologia`, `sim.holding.ocupados` embrulhado,
   o domínio de render 'helicoptero', `CHAVES` vidro e opaco em -4, o arquivo novo `ui/telas/corpo/LivroArcologia.jsx`
   na tabela 3.1 e as chaves `x1.mural.*` do Mural.
5. `web/cenas.html` (integrador) ainda fala em "Sede v2" e "Torre Lâmina": trocar e acrescentar as cenas
   `planos?etapas=torre.e2:0.55&vista=obra`, `?etapas=todas&vista=ponte`, `?etapas=todas&heli=50&vista=heli` e
   `?etapas=todas&vista=noiteAerea`.
6. S1a: pintar `mataDaSede` quando o parque ficar pronto (M2) e tirar a floresta de dentro do disco da sede no jogo.
7. C1: o JS principal ganhou cerca de 36 KB; se o teto apertar, a geometria da obra e do helicóptero pode virar import
   dinâmico (só aparecem com a lago.e1 em obra ou a torre.e4 pronta).
8. C1: calibrar custos, materiais, durações e efeitos das 5 etapas; o robô da cidade real (não o faz de conta) com a
   Arcologia.
9. Render: as gruas e o helicóptero não têm sombra própria (só o corte das torres projeta sombra certa).
10. U1a: um comentário de `ui/glifos/glifos.js` ainda diz "Torre Lâmina".
