# Nota de entrega: SEDE3 (sede v3, Park of Future Dreams; D88, D89 e D90)

Retomada a partir do commit da pausa ("Pausa: SEDE3 e R5 em andamento"): o mapa, os dados do plano, as partes e as
torres estavam prontos; faltavam o domínio do render (planos.js ainda era a v2 e quebrava), as duas cenas, o teste,
as capturas, a bancada e esta nota. Tudo da parcela está verde; os testes vermelhos que sobram são de outras parcelas
(coordenadas de teste dentro do disco da sede, lista abaixo).

## Arquivos

Mudados (todos da parcela):
- `fonte/data/arcologia-plano.js`: o plano A é a v3; B e C saíram (PLANOS só com o A, PLANO_ESCOLHIDO 'A').
- `fonte/data/mapa-heldopolis.js` e o gerado `fonte/sim/mundo/relevo-assado.js` (assado de novo; controles 01172d2d).
- `fonte/render/arcologia/{torre,partes,planos,lago}.js` (`fantasma.js` ficou igual: serve à geometria nova).
- `fonte/render/cenas/{torre,planos}.js`.
- `ferramentas/testes/arcologia-render.teste.mjs` (reescrito, 38 testes), `ferramentas/cidade-sintetica.mjs`,
  `ferramentas/mapa.mjs`; nas asserções da área inicial e da gleba, `ferramentas/testes/{contratos,mundo}.teste.mjs`
  (terreno e objetivos não precisaram mudar).

## O que publica

Mapa (D90):
- Área inicial de 6 x 5 ladrilhos: `MAPA_HELDOPOLIS.inicio = [[6, 5], [11, 9]]` (x de -1.024 a 2.048, z de -1.536 a
  1.024), um componente só de terra na margem leste do rio (mapa.mjs confere). Ganhou a faixa da rodovia ao norte e a
  planície e a orla da baía a leste (a área 'orla' agora fica dentro).
- Platô em disco na cota 12 (`plato.disco = { cx: 200, cz: 190, r: 860 }`, transição de 160 m); a praia da frente
  avançou em meia-lua e o costão do canto sudeste fecha a enseada; os córregos da Pedreira e do Mirante contornam o
  disco (a mais de 90 m do anel viário); a lagoa recuou a ponta leste; os morros 'leste' e 'morrinho' foram para a
  planície do leste. Nenhuma água dentro do disco; 40 m de terra em volta (teste e mapa.mjs).
- Nó de entrada em (60, -700), na boca da sela entre os morros, ao norte do portão norte; o acesso desce até ele.
- Sugestões da primeira hora: a avenida vai do nó de entrada ao portão norte (areas.js troca o fim pelo portão do
  plano); a captação e a usina ('solar', não 'usinaSolar') na rua principal da Vila, que agora sobe até (-935, 300),
  com rede: as duas prévias passam e as 28 casas da rua ficam com água e luz (as 38 das ruas de terra ficam sem, D52;
  o teste "a primeira água na rua principal não abandona as casas das ruas de terra" passa). Quadras fora do disco.
- Janela do relevo fino (16 m): de 161² para 202² amostras (x0 -1.104, z0 -1.616, lado 3.216), cobrindo a área nova
  com 64 a 80 m de margem. Custo medido: +58 KB de Float32 na memória, o texto assado de 5,0 para 8,7 KB, gerarTerreno
  de 139 para 154 ms; nada na placa (o detalhe é assado na grade de 8 m). Cabe com folga na D66.

Plano (`data/arcologia-plano.js`):
- `SEDE_CENTRO` (200, 190); `GLEBA_ENVELOPE` = o disco (contorno de 128 lados, caixa, centro, raio 812, cota 12);
  `ANEL_VIARIO` (raio 795, 24 m); `AVENIDAS` (0 a 315, a cada 45 graus); `noDiscoDaSede(x, z, folga)`.
- Portões nas 8 avenidas, na borda do anel viário (ids leste, sudeste, sul, sudoeste, oeste, noroeste, norte,
  nordeste). Vias internas com `ARESTA.ARCOLOGIA`: o anel viário em 8 arcos (`anel: true`, com `arco`), os 8 trechos
  do portão ao anel (`portao: true`) e as 8 avenidas do anel à praça do pódio (`radial: true`).
- `PARTES_ORDEM` = torre, lago, meridian, horizon, codex, helix, compass, parque; `PARTES_NOMES` com o nome em inglês
  de cada uma (Blade Tower and Legacy Tower, Mirror Lake, Meridian Ring, Horizon Ring, Codex Tower, Helix Labs, Compass
  Tower, Park of Future Dreams). `TRECHOS_HORIZON`: 8 trechos `horizon.1` a `horizon.8` (Horizon Ring I a VIII), cada um
  uma peça com id próprio; fase 1 nos de 225 e 270 graus (de frente para o portão norte), fase 2 nos outros 6.
- `HORIZON` (raio 729, 60 de fundo, 160 m, 25 andares), `MERIDIAN` (442,5, 50, 120 m, 19 andares), `PODIO` (84, 40 m),
  `LAGO` (84 a 99), `FLORESTA` (100,5 a 114), `PRACA` (114 a 150). A faixa de LED é de um andar no meio da altura,
  entre duas marquises (com dois andares lia como um cinto largo).
- Torres: `especTorre` e o par da D89. `TORRE_LAMINA` é a Blade Tower (500 m, heliponto e mastro a 520) e `TORRE_IRMA`
  a Legacy Tower (452 m); `PAR` com centros a 64 m, vão de 28 m, Dream Bridge a 330 m, rot -30 graus (o eixo a 30 graus,
  como no modelo); `torresDoPar`. Codex Tower (300 m) a 200 graus, Helix Labs (180 m, oval que gira 32 graus e afina a
  80%) a 323 graus e Compass Tower (180 m, oval reta com agulha) a 80 graus, todas no raio 583, a 199, 81 e 101 m do
  eixo da avenida mais perto.
- `TORRE_POSICAO` = a Blade no par: (172,29, 174), rot -30 graus. `POUSO` = centro do heliponto da Blade:
  (174,79, 500, 169,67). `CAMERA_ARCOLOGIA` = { x: 200, z: 250, dist: 2600, guinada: 20, inclinacao: 30 } (o disco
  inteiro às 17h30). `cavaDoPlano('A')`: o anel de água do Mirror Lake (polígono único com a fresta a leste, sob a água).
- `mataDaSede(x, z)`: a mata do parque (anel de floresta, maciços do parque, bosque entre os anéis, faixa atrás do
  Horizon), aberta nos anéis, nas avenidas e na praça; null fora do disco. Para a S1a pintar quando o parque ficar
  pronto (as cenas já pintam).
- `subsolo` (Deep Core e Lumen Collider) só como dado.

Render:
- `render/arcologia/planos.js` (reescrito): o domínio 'arcologia'. No jogo cada parte aparece pronta pelas etapas do
  espelho (`partesProntas`: a torre com torre.e4, o lago com lago.e1, as outras quando todas as etapas `<id>` ou
  `<id>.eN` estão prontas; o Horizon Ring trecho a trecho, `horizon.K` ou `horizon.K.eN`) e, antes disso, em fantasma
  com a silhueta de verdade. `vitrine({ modo: 'plano' })` mostra a sede inteira com a paisagem e as vias internas;
  `vitrine({ modo: 'torre' })` só o par no pódio. Paisagem: praça de pedra do pódio, caminhos em anel (480 e 688),
  chão e árvores dos bosques, portões e, só nas cenas, o anel viário e as avenidas (24 m, canteiro com
  palmeiras-imperiais, que param fora dos pórticos); o chão do parque e dos bosques abre as avenidas. As árvores vão
  para a vegetação (`ctx.vegetacao.plantar('arcologia', ...)`): as da mata só onde a grade da floresta não tem o parque
  pintado. `selecionar` devolve `{ tipo: 'arcologia', idx, ref }`, com `ref` = id do trecho do Horizon Ring.
  `tocaGleba` mede contra o disco (o canto da caixa não refaz a sede).
- LOD por setor: 18 setores (16 oitavos de anel e as 2 ovais) trocam as marquises do shader pelas de geometria quando
  a câmera chega a `DIST_PARTES_LOD0` (800 m no 'pc') de cada um; o uniforme `uLodSetor` avisa o vidro. Um material
  por tipo (vidro, opaco, cascata, jato, mais a água e o fantasma), todos no aquecimento: nada recompila entre dia,
  noite, LOD e fantasma (teste e `compilacoes.depois: 0` nas capturas).
- `partes.js`: anéis (vidro curvo do chão ao teto com normal radial, marquise branca em cada laje, faixa de LED, teto
  solar; no Horizon a pista de 4,6 km, quadras e piscinas; no Meridian o jardim; pórticos de 40 x 18 m), pódio redondo
  com praça, jardineiras, guarda-corpo e 4 escadas rolantes de vidro, Dream Falls (lâmina, película, espuma e névoa no
  shader), fontes, Codex (prisma facetado escuro com as arestas acesas e o átrio de livros com o globo), ovais (agora
  esguias: afinam até o topo), anel de floresta e parque (como deque plano na cota do pódio sobre a borda da cava),
  Supertrees (treliça e funil de nervuras, acesas à noite) e a passarela. No fantasma, o gramado do parque não entra
  (um véu de 800 m só custaria pixel) e os anéis levam só a face de fora. As marquises do LOD0 saem em trechos de 3
  graus (217 mil de perto no pior caso, com folga no teto de 250 mil).
- `torre.js`: o par no pódio (as torres saem da praça a 40 m), a Dream Bridge (ponte-jardim de dois níveis, piscina,
  pernas inclinadas de bronze), a linha de LED nas quinas; os shaders do vidro dos anéis (vidro mais escuro e o forro
  fino; à noite os andares acendem em trechos longos e independentes, sem o mosaico de ruído), da faixa de LED, da
  Codex, das escadas e das quedas. A cachoeira da fenda e os dutos da v2 saíram.
- Cenas: 'torre' (prancha az20, az110, az200, az290 e os closes 'ponte' e 'coroas'; ?contexto=0 só o par) e 'planos'
  (?vista= aerea, avenida, mar, noite; ?olhar=). Helpers em cenas/torre.js: `pintarMataDaSede(ctx)` (pinta a mata do
  parque na grade da cena e desfaz) e `fixarCamera(ctx, ...)` (a vista fixa entra no lugar da câmera do jogo; sem isso a
  vegetação e a sombra viam a câmera do jogo e as vistas saíam sem nenhuma árvore).

Cidade sintética: a cidade fica fora do disco (0 prédios dentro); o Centro foi para a faixa entre a sede e a rodovia
(-160, -1.020), o Sudoeste ganhou ruas (passo 144), a vila de terra foi para (-1.800, 880) e as vias internas da sede
(24 arestas ARCOLOGIA) seguem o plano v3. Carga: 12.113 para 12.197 prédios, 1.121 para 1.116 arestas, 165.876 para
154.495 moradores (o Centro denso saiu do meio); 6.749 prédios na área inicial nova. As medidas da bancada seguem
comparáveis.

## Como testei

- `node ferramentas/simular.mjs --testes`: arcologia-render (38/38), contratos, mundo, objetivos, terreno, integracao,
  economia, holding e os outros verdes; vermelhos só os de outras parcelas listados nas pendências.
- `node ferramentas/mapa.mjs --saida <tmp>` e `--conferir-assado`: "mapa ok" (1 componente de terra, Vila com 66
  prédios e 349 moradores, gleba em terra e dentro da área inicial) e o assado confere.
- `node ferramentas/montar.mjs --saida <tmp>`: sem avisos além do A1 conhecido; JS principal 1.892 KB (antes da etapa 2:
  1.897; teto 1.638, decisão da C1); as cenas seguem sob demanda.
- Triângulos (família arcologia, conta do teste com o 'pc'): de perto, no pior caso (o par no LOD0 e os 18 setores com
  as marquises em geometria), 217 mil (teto 250 mil; Blade 54,1 mil e Legacy 48,3 mil no LOD0); vista aberta com a sede
  construída 31,7 mil (teto pedido 60 mil); no jogo de hoje (torres e lago prontos, o resto em fantasma) 11,2 mil
  (no fantasma os anéis levam só a face de fora: o holograma transparente de dois lados dobrava a sobreposição de
  pixels na vista aberta).
  Nas capturas: aérea 35,8 mil, avenida 69,7 mil, mar 45,5 mil, noite 161 mil; 37 a 50 chamadas no quadro inteiro.
- Bancada 'aberta' no 'pc' (`node ferramentas/bancada.mjs --cenas aberta --perfis pc --voo`, cidade sintética com as
  torres e o lago prontos e o resto em fantasma, SwiftShader), antes (montagem da base 32b7805) e depois (a final):
  pior quadro 71 e 71 chamadas, 647 e 640 mil triângulos; família arcologia 25,7 e 11,2 mil; sombra 262 e 269 mil;
  59 e 58 programas, 0 compilados depois de pronto nos dois; vídeo 340 e 339 MB, geometria 21,5 e 19,3 MB.
  Placa por quadro, por passe (ms no SwiftShader, antes e depois): sombra 4,95 e 4,63; preparo 10,7 e 16,1; céu 1,33 e
  2,63; terreno 16,2 e 21,8; água 3,77 e 5,05; prédios 30,5 e 37,5; vida 0,11 e 0,10; arcologia 0,56 e 0,90; resto 3,75
  e 4,23; pós 0,89 e 1,22; total 73,4 e 79,2. O passe da Arcologia cresceu (o fantasma do anel de 1,5 km cobre mais
  tela que o anel de 481 m da v2) e continua em 1,1% da placa; os outros passes, que esta parcela não toca, subiram
  junto porque a máquina rodava a R5 ao mesmo tempo (o SwiftShader mede CPU): a comparação absoluta entre as duas
  rodadas é ruidosa, vale a proporção. As duas rodadas acusam "programa ShaderMaterial não ligou" duas vezes, igual
  antes e depois (não é desta parcela; os materiais da Arcologia têm nome e ligam).
  Arquivos: `scratchpad/novo/SEDE3/bancada0/` (antes) e `scratchpad/novo/SEDE3/r2/bancada2/` (depois).

## Capturas (1376 x 768, ?q=pc)

Em `scratchpad/novo/SEDE3/capturas/` (cena 'planos', `?vista=`; nenhuma compilação depois de pronto):
- `planos-aerea.png` (17h30, 35,8 mil triângulos da família, 37 chamadas): o disco inteiro de frente para o mar, com os
  dois anéis de linhas horizontais longas, a pista e as quadras no teto do Horizon Ring, o parque, o pódio com as
  torres e as três torres do bosque. Contra a Apple Park: a mesma figura de anel contínuo com o parque dentro, em
  escala de 1,5 km; lê como sede e não como peças soltas. A sombra própria não aparece a 2,6 km (pendência 9).
- `planos-avenida.png` (17h15, 69,7 mil, 8 setores no LOD0): do alto da avenida do portão oeste; a avenida entra no
  pórtico, o Horizon Ring com uma marquise branca por andar e o vidro escuro entre elas (a assinatura da Apple Park), a
  faixa de LED fina no meio, e acima dele a Blade, a Legacy e o cristal escuro da Codex (o Black Diamond).
- `planos-mar.png` (18h, 45,5 mil): da duna da restinga, a lagoa na frente e a curva de vidro do Horizon Ring
  refletindo o pôr do sol, como a McLaren no lago; as torres ficam atrás do anel daqui (só a coroa da Blade passa).
- `planos-noite.png` (21h, 161 mil, as torres no LOD0): do parque, a Dream Fall de 60 graus acesa caindo do pódio, as
  fontes no Mirror Lake, a Blade com a linha de LED nas quinas, a Codex com as arestas acesas, as Supertrees e o
  Meridian Ring com os andares acesos em trechos longos.

## Pendências para o integrador

1. Testes de outras parcelas com ruas de teste dentro do disco da sede (centro (200, 190), raio 812; código 'gleba').
   Sugestão que constrói e tem o mesmo comprimento: trocar [[-760, -300], [-280, -300]] por [[1100, -300], [1580, -300]].
   - bemestar.teste.mjs:28 (`ruaComRedes`: `assert.ok(sim.cmd('via.construir', { plano }).ok)` com [[-760, -300],
     [-280, -300]]), usado nos testes das linhas 101 e 157.
   - celulas.teste.mjs:278 (pincel: `[{"codigo":"gleba","trecho":2},{"codigo":"gleba","trecho":4}]`) e :28/:321 (rua
     [[-600, -200], [-500, -200]]).
   - crescimento.teste.mjs:27 (`rua`, [[-760, -300], [-200, -300]]), nos testes das linhas 237 e 337.
   - redes.teste.mjs:25 (`rua`, [[-760, -300], [-280, -300]]) no teste da linha 206.
   - servicos.teste.mjs:21 (`rua`, a mesma) nos testes das linhas 272 e 300.
   - zonas.teste.mjs:24 (`rua`, a mesma) nos testes das linhas 149 e 182.
   - vias.teste.mjs:599 (`jogar`: via.construir com `{"codigo":"gleba","trecho":2}`) e :642
     (`assert.ok(fazer('avenida', [[-600, -300], [-200, -300]]))`).
2. redes.teste.mjs:186 (`assert.equal(p.semRede, true)` para a captação em (-957, 321)): a rua principal da Vila agora
   sobe até (-935, 300) (D90: a captação sugerida fica nela, com rede), então ali já não é estrada de terra. Escolher
   um ponto da estrada de terra mais ao norte (ela passa por (-926, 200) e (-918, -60)).
3. geracao-vias.teste.mjs:530 ("o cruzamento da cena rua sumiu da cidade sintética"): `RUA` de render/cenas/rua.js
   (907, 526,3) caiu dentro do disco. O cruzamento avenida com rua mais perto fora do disco na cidade sintética nova é
   (1.082,3, 529,4) (4 braços, 133 m do disco); as vistas da cena rua andam junto (dona: R3b).
4. casca.teste.mjs:468 (índices: render/colocaveis/*.js sem índice fixo) é da R5, não desta parcela.
5. Contrato: `TETO_ARCOLOGIA.aberta` (40 mil) e `ORCAMENTO.pc.familias.arcologia.teto` (40 mil) para 60 mil, como a
   SEDE3 pede (hoje a sede inteira na aérea mede 35,8 mil e cabe nos 40).
6. `sim/mundo/floresta.js` limpa a mata na caixa do platô, que agora é o ponto do centro (o platô sai redondo pela
   distância à caixa): no jogo nascem capões dentro do disco (aparecem no inicio.png do mapa.mjs). Trocar pela
   distância a `mapa.plato.disco` (cx, cz, r). E, quando a parte 'parque' ficar pronta, pintar `mataDaSede` na grade
   (S1a ou X1b), como as cenas fazem com `pintarMataDaSede`.
7. X1b: a regra de `partesProntas` (ids `torre.e1..e4`, `lago.e1`, `meridian.eN`, `horizon.K` ou `horizon.K.eN`,
   `codex.eN`, `helix.eN`, `compass.eN`, `parque.eN`); ligar `plano.vias` no grafo com ARCOLOGIA quando lago.e1 ficar
   pronta (o render só desenha as vias internas nas cenas); registrar `cavaDoPlano('A')` (o anel do Mirror Lake);
   `selecionar` devolve o id do trecho em `ref`; `PARTES_NOMES` para a interface; `TORRE_POSICAO` e `POUSO` mudaram de
   lugar (a Blade no par, a -30 graus).
8. Câmera fixa: as cenas com vista fixa trocam `ctx.cameraApi.atualizar` e `alvo` enquanto a vista vale
   (`fixarCamera`). Fica melhor como API do render (R1a), para nenhuma cena precisar fazer isso.
9. As torres não projetam sombra longa visível na aérea às 17h30 (o mapa da sombra cobre a câmera de 2,6 km?); conferir
   na R1b quando houver tempo.
10. Bancada: os dois programas "ShaderMaterial" que não ligam no SwiftShader (antes e depois desta parcela) deixam a
    bancada 'aberta' do 'pc' em falha; achar o dono (sem nome de material).

## Revisão adversarial (03/10/2026)

O que estava errado e foi corrigido (só arquivos da parcela):

1. A primeira avenida sugerida não construía. O último trecho, (130, -662) a (200, -622), chegava ao portão norte de
   viés e a lateral da pista entrava no disco: a prévia dava 'gleba' e o robô desistia depois de 20 tentativas. Agora
   `SUGESTOES.avenida` é [[60, -700], [120, -716], [200, -680], [200, -622]]: sai do nó pela meia encosta (o nó fica no
   aterro do acesso, 3 m acima do pasto) e chega ao portão pela reta radial da avenida norte. Os três trechos constroem
   em ordem, com declive de 7,5%, 2,1% e 1,9% (o limite da avenida é 10%), e o último encaixa no portão 'norte'. O
   teste do mundo agora constrói a avenida trecho a trecho.
2. Duas das três quadras sugeridas não passavam na prévia da grade (a caixa delas entrava no disco: 'gleba'), e o robô
   descartava as duas. Agora são retângulos fora do disco: resBaixa (-745, -250) a (-635, 90), comBaixa (700, -600) a
   (880, -470) e resBaixa (-745, 120) a (-635, 300). O teste do mundo confere a grade da caixa de cada uma. Robô de 2 h:
   as três quadras e a avenida saem, e o marco 1 chega em 0:17 (a base 32b7805 chegava em 0:20; com a SEDE3 sem a
   revisão, nunca).
3. O platô cortava o pé do Morro do Mirante junto do portão norte: 2,5 m de relevo de maciço na borda do anel viário e
   10 m a 20 m dela (o pedido era não tocar nos morros do norte). O Mirante recuou 30 m para o norte (z -880 para
   -910) e o relevo foi assado de novo (controles 2397f8cb): 0 m na borda e 10 m além dela, 0,75 m a 20 m. Teste novo:
   nenhum relevo de maciço até 10 m além da borda do anel viário e a borda a 40 m ou mais da areia (medido: 50,8 m).
4. Fantasma (o que o jogo mostra hoje): as quadras e as piscinas do teto do Horizon Ring entravam no holograma como
   retângulos claros sobre o véu da cobertura; agora o fantasma do teto é só o véu. As Supertrees no fantasma eram
   tronco e funil cheio e, vistas do alto, liam como cogumelos brancos; agora o holograma é o esqueleto (tronco, 8
   nervuras e o aro). As linhas do holograma somem antes de ficarem a menos de 3 pixels uma da outra (de longe a grade de
   6 m do anel virava um código de barras). Dois testes novos (teto sem quadras no fantasma; Supertree sem véu entre as
   nervuras, que falha com o funil antigo).
5. A faixa de LED dos anéis sumia à noite entre os forros (0,55 do LED da calibração, perto da janela mais acesa).
   Agora fica de 1 a 3 na tela, duas a quatro vezes a janela, abaixo do aro do heliponto; as janelas dos anéis subiram
   de 0,38 para 0,5 do G_LUZ_JANELA (0,8 na tela, o piso da calibração da R1a). Conferido na captura da noite.
6. `criarPar` gerava as duas torres de novo só para contar os triângulos por torre (uns 90 ms de thread principal na
   carga e a cada troca de qualidade); agora `triangulosPorTorre` é calculado sob demanda (só a cena 'torre' lê).
7. `PLANO_A.camera` (não usada e diferente) e `CAMERA_ARCOLOGIA` agora são a mesma; `mataDaSede` usa `hipot` e
   `atan2` de comum/util (a S1a vai pintar a grade da simulação com ela).

Medidas depois da revisão: arcologia-render 38/38, mundo 18/18, contratos, terreno, objetivos e integração verdes;
`mapa.mjs` "mapa ok" e o assado confere; montagem 1.892 KB (só o A1). Triângulos da família no jogo de hoje (as torres
e o lago prontos, o resto em fantasma), na cena 'aberta' do 'pc': 13,3 mil (o esqueleto das Supertrees soma 2,1 mil;
teto 40 mil). Noite (cena planos, ?vista=noite): 161 mil, como antes.

Capturas da revisão (1376 x 768, ?q=pc), em `scratchpad/novo/SEDE3/rev/`: `aberta-jogo.png` (antes) e
`aberta-jogo2.png` (depois: o fantasma limpo e as Supertrees em esqueleto) e `planos-noite.png` (a faixa de LED do
Meridian Ring acesa).

### Pendências (lista completa, troca os itens 1 a 3 acima)

As falhas de outras parcelas são todas vias de teste que agora entram no disco da sede (código 'gleba'). Trocas que a
prévia aceita, conferidas: [[-760, -480], [-280, -480]] (o mesmo trecho 180 m ao norte; povoar e produtores em z -460)
ou [[1100, -300], [1580, -300]] para a rua de [[-760, -300], [-280, -300]]; [[60, -700], [120, -716]] para a rua do nó
de entrada; [[200, -720], [200, -622]] para a rua que chega ao portão norte.
- bemestar: `ruaComRedes` (linha 28), nos testes 1, 2 e 4.
- celulas: `via` (linha 28) com [[-600, -200], [-400, -200]], [[-600, -300], [-376, -300], [-376, -76]],
  avenida [[-600, -200], [-280, -200]], [[990, 0], [990, 200]] (o teste 4 esperava outro código, o ponto agora é
  gleba) e [[-600, -200], [-500, -200]]; o pincel da linha 278.
- crescimento: `rua` (linha 27), testes 1 a 5 e 7.
- redes: `rua` (linha 25), testes 1, 2, 3 e 6; teste 4 com [[60, -700], [80, -500]] (entra no disco); teste 5, linha
  186 (a captação em (-957, 321) agora fica na rua principal da Vila, com rede: escolher um ponto da estrada de terra,
  perto de (-926, 200) ou (-918, -60)).
- servicos: `rua` (linha 21), testes 2 a 6, 9 e 10; linhas 202 e 236 ([[-760, -300], [-280, -300]] e
  [[-760, -240], [-280, -240]]).
- vias: linha 143 (rua de base [[-500, -400], [-300, -400]]), 225, 280 (o portão da v2 em [[250, 20], [250, 180]]: usar
  [[200, -720], [200, -622]], que encaixa no 'norte'), 331, 388, 465, 556, 599 e 642.
- zonas: `rua` (linha 24), testes 5, 6 e 7.
- geracao-vias, linha 530: o cruzamento da cena rua (R3b) caiu no disco; o mais perto fora dele na cidade sintética é
  (1.082,3, 529,4).
- casca, linha 468: da R5.
- Robô (`ferramentas/robo/robo-sim.mjs`, dona S3a): a coroa de blocos em volta de (-150, -320) cai quase toda no disco
  (25 de 34 descartados); levar a coroa para a faixa oeste, a faixa da rodovia e a planície do leste. Mesmo com as três
  quadras sugeridas prontas, a cidade do robô não cresce em 6 h (353 moradores, só a Vila; a base 32b7805 também não
  crescia: 248).
- `sim/mundo/floresta.js` (S1a): a mata do disco não é limpa (usa `plato.caixa`, que agora é o ponto do centro): média
  0,12 de densidade no disco e 0,7% das células acima de 0,5 (os dois capões do inicio.png). Limpar pela distância a
  `mapa.plato.disco`.
- O nó de entrada fica 3 m acima do pasto (o acesso não desce a 5,5% a encosta do fim da sela): qualquer via que saia
  dele para o sul passa de 9% nos primeiros metros: uma rua direto para o sul fica em 12,0% e uma avenida em 10,0%,
  exatamente no limite de cada tipo. A avenida sugerida contorna pela meia encosta. Rever o greide do acesso na
  rodovia (S1a) ou levar o nó um pouco mais ao sul.
- Contrato: `TETO_ARCOLOGIA.aberta` e `ORCAMENTO.pc.familias.arcologia.teto` de 40 mil para 60 mil (pedido da SEDE3).
