# Nota de entrega: VIS1a (acabamento da sede v3, Park of Future Dreams; D88, D89, D93)

Acabamento da sede v3 sem mudar o desenho aprovado: os anéis leem como vidro curvo com as marquises brancas finas, o
pé assentado no jardim e a faixa de LED de um terço dos andares (D93, o pedido do dono revisto em 04/10/2026); a Helix
Labs e a Compass Tower viraram torres de verdade; o parque ganhou desenho (caminhos sinuosos, espelhos d'água, praças,
árvores); as Supertrees viraram as de Gardens by the Bay. A sombra longa foi diagnosticada: a sombra da sede existe e
funciona, o que falta é da luz do fim da tarde e do alcance da sombra (R1a e R1b, abaixo).

## Arquivos

Mudados (todos da parcela):
- `fonte/render/arcologia/torre.js`: o shader do vidro dos anéis e das ovais (gVidroAnel, gLed), os padrões novos do
  opaco (marquise, malha da copa e tronco vivo das Supertrees), a classe de luz da marquise, `andaresLed`, `vidAnel`
  com os andares da faixa, `fIncM` (inclinação da normal no mundo) e as chaves de programa `arcologia-vidro-5` e
  `arcologia-opaco-5`.
- `fonte/render/arcologia/partes.js`: acabamentos novos, o pé dos anéis (`basePlantada`, `sebeDoPe`, `PE_ANEL`), a
  faixa de LED (`faixaLed`), as torres ovais refeitas (`corposDaOval`, `PE_OVAL`, `BAL_OVAL`), o parque refeito
  (`PARQUE`, `gruposDeSupertrees`, caminhos, espelhos, praças, árvores), as Supertrees refeitas (com LOD no setor do
  parque, `SETOR_PARQUE`) e `malhasNovas` com a água.
- `fonte/render/arcologia/planos.js`: a água do parque na malha do lago e o alvo do setor do parque.
- `fonte/render/cenas/planos.js`: a vista `parque` (o bosque grande de Supertrees de perto, 17h).
- `ferramentas/testes/arcologia-render.teste.mjs`: os testes que mudaram de regra e 5 testes novos (47 ao todo).

Não mexi em `obra.js`, `heli.js`, `fantasma.js`, `lago.js` nem em `cenas/torre.js` (o defeito não estava neles).

## O que mudou e por quê (com a referência)

1. Anéis (Apple Park, McLaren):
   - Vidro: o reflexo do céu manda (o IBL que já existe, com o Fresnel do three); o reflexo anda em ondas largas de
     uns 47 m (o vidro curvo de verdade distorce o reflexo de vários painéis de uma vez), cada painel um pouco
     abaulado e torto, e a variação por painel some de longe (nada do mosaico de pontos). Montantes de alumínio a cada
     painel (3,2 m), discretos. Persianas claras em parte dos painéis.
   - Marquises finas: a testa de 0,5 m é o traço branco; o topo, visto do alto, tem a luz de uma face deitada (no fim
     da tarde pega menos sol que a fachada) e um tom abaixo; o forro, visto de baixo, idem. Logo abaixo de cada
     marquise, a sombra dela na fachada. No LOD0 as mesmas três cores em geometria.
   - Térreo: o saguão aceso, as portas a cada 48 m (vão de 6,4 m com as folhas de vidro e o batente de pedra), o
     rodapé de metal escuro e a oclusão do chão no pé (o vidro escurece até 2,5 m).
   - Pé no jardim, sem a faixa clara de maquete: a canaleta de pedra escura colada no vidro (mais escura junto dele, a
     oclusão do pé), o canteiro com a folhagem e o passeio de pedra quente; de perto (LOD0 do setor) o meio-fio e a
     sebe em volume.
   - Noite: os escritórios (Meridian) e a faculdade e a escola (Horizon, com os dormitórios de descanso, quentes)
     acendem em trechos de andar de dezenas de metros (a equipe ou a turma que ficou), com o perfil de luz do forro; o
     apagado fica escuro; as marquises escurecem (o branco pleno lia como anel cinza com a exposição da noite) e o
     forro pega a luz das salas.
   - Faixa de LED (D93): um terço dos andares, no terço do meio da altura, contínua: 9 dos 25 andares no Horizon Ring
     (de 51,2 a 108,8 m; o pedido diz uns 53 a 107) e 7 dos 19 no Meridian Ring (de 37,9 a 82,1 m; uns 40 a 80).
     Número ímpar de andares para a faixa centrada cair inteira entre duas lajes (as marquises das bordas a
     emolduram). De dia, vidro grafite espelhado com os pixels de LED atrás e o filete de inox; à noite, a fachada de
     mídia champanhe com ondas largas que sobem na diagonal, o veio fino, o tom frio que passa e o clarão que dá a
     volta, de 0,5 a 2,5 na tela.
   - Teto do Horizon Ring: quadras azuis de piso rígido, piscinas turquesa e a pista, lidas de cima.
2. Helix Labs (Torre Generali, Zaha Hadid) e Compass Tower (Simpson Querrey, Chicago): pódio largo (2 e 3 andares)
   com jardim no teto; marquise curta (1,2 m: a leitura é vertical, de vidro); os andares na régua de 6,4 m do Horizon
   Ring e a faixa de LED na mesma faixa de altura (51,2 a 108,8 m). A Helix gira 32 graus e afina até 80%, com as
   duas espinhas de bronze que mostram a torção e a lanterna de vidro de corte inclinado (6 a 20 m acima do teto,
   acesa à noite). A Compass recua em três corpos (a 115,2 e a 147,2 m, acima da faixa), com terraços plantados,
   guarda-corpo de vidro e árvores, e termina na grelha das máquinas com a agulha.
3. Parque (Burle Marx, Aterro do Flamengo e Copacabana; Gardens by the Bay): caminho em anel de 290 m com as
   palmeiras-imperiais; em cada oitavo, um caminho sinuoso da praça ao Meridian com os oitis; espelhos d'água em arco
   com a borda de pedra (6), fora das praças; praças de pedra clara com a fita de pedra portuguesa nos bosques de
   Supertrees e nos cruzamentos; copas em volta das praças. Os bosques densos seguem pela grade da mata pintada
   (mataDaSede) e, sem ela, pelas árvores marcadas `mata` de 7 em 7 m (eram de 11 em 11). Tudo pela vegetação da R2b
   (`ctx.vegetacao.plantar`).
4. Supertrees: tronco vivo (o jardim vertical atrás da treliça em losangos, no shader) com 8 barras em diagonal; copa
   larga em funil (diâmetro de 60% da altura) como malha de aço nas duas faces, com nervuras, anéis e diagonais, parte
   das células plantadas e o resto aberto (o céu passa; de longe a copa lê cheia, nunca varetas); 16 nervuras e o aro.
   À noite, violeta, magenta e branco quente que trocam devagar. O detalhe (barras e nervuras) só de perto, no setor
   do parque (LOD0 a 800 m do centro no 'pc').

## Sombra longa na aérea às 17h30 (o diagnóstico)

A sombra da sede funciona: sem sombra nenhuma (script que desliga a de perto e a de longe) o interior inteiro dos anéis
clareia (`cap/diag-dif-semsombra.png`). O que impede a sombra longa de aparecer:
- Às 17h30 da cena o sol está a 8,9 graus (direção (-0,986; 0,154; -0,059), quase oeste). A sombra do Horizon Ring
  (160 m) tem 1 km e cobre o interior inteiro; a da Blade (500 m) teria 3,2 km e cai toda dentro da sombra dos anéis,
  e o resto dela (sobre a baía) passa do alcance: a cascata de longe do 'pc' tem 1.400 m de raio e a marcha da sombra
  de longe, uns 900 m.
- O contraste da sombra é baixo com o sol baixo: no gramado do parque a sombra fica com 75% da luz do sol (medido nas
  duas capturas, `cap/antes-aerea.png` contra `cap/diag-aerea-semsombra.png`), e a exposição automática vai a 10,3.
O que falta (R1a e R1b, não é da sede): com o sol abaixo de uns 12 graus, baixar o céu (o IBL) em relação ao sol, para
a sombra no chão chegar perto de 50%; e, para as torres de 500 m, uma cascata de longe maior na vista aberta ou a
marcha da sombra de longe com alcance de uns 3 km para os projetores altos (o campo já tem a Blade a 511 m).

## Como testei

- `node --test ferramentas/testes/arcologia-render.teste.mjs`: 47 de 47 (5 novos: faixa de LED de um terço com a
  moldura e as ovais na mesma faixa; o pé dos anéis sem faixa clara e com a oclusão; Helix e Compass como torres;
  o parque; as Supertrees com a malha nas duas faces e o detalhe de perto).
- `node ferramentas/simular.mjs --testes`: "testes ok" (todos os arquivos e a guarda de texto), rodado de novo no
  estado final (`VIS1a/testes2.txt`).
- `node ferramentas/montar.mjs --saida scratchpad/novo/VIS1a/final`: sem aviso (JS principal 2.075 KB, teto 2.355).
- O commit do integrador "VIS1 em andamento" (b1f6af5) guardou um estado parcial desta parcela; o final está na árvore
  de trabalho (a faixa de LED de um terço dos andares, os testes novos e os acertos depois dele).
- Triângulos da família arcologia (a conta do teste, 'pc'): vista aberta com a sede construída 42,4 mil (teto 60
  mil; 31,7 mil na SEDE3), de perto no pior caso 230 mil (teto 250 mil; 217 mil na SEDE3). As Supertrees têm o
  detalhe (barras e nervuras) no setor do parque, de perto: de longe cada uma tem uns 440 triângulos.
- Nas capturas (família arcologia, antes e depois): aérea 35,8 e 42,0 mil; avenida 69,7 e 67,7 mil; noite 161 e 169
  mil; parque 54,0 e 61,6 mil; chamadas no quadro 28 e 28, 42 e 39, 42 e 44, 39 e 42.
- Nenhum programa novo depois de pronto em nenhuma captura (`compilacoes.depois` 0); os materiais continuam os 8 do
  conjunto fixo, só com as chaves novas.
- Bancada (`node ferramentas/bancada.mjs --cenas planos --perfis pc --voo --quadros 60 --consulta "vista=<v>"`,
  SwiftShader, a sede inteira construída), placa por quadro do passe 'arcologia' antes e depois:
  - aérea: 13,26 e 17,61 ms, 17,7% e 20,5% da placa (total 74,8 e 85,7 ms; os outros passes subiram 11% juntos, a
    máquina rodava a VIS1b e outras parcelas, vale a proporção). Pela proporção, num quadro de 15,5 ms do PC do dono a
    sede passa de 2,75 para 3,18 ms: +0,43 ms (o teto da parcela é +1 ms). 0 programas compilados depois de pronto.
  - avenida (8 setores de perto no LOD0, o anel enchendo a tela): 46,37 e 26,82 ms, 29,8% e 30,3% da placa (total
    155,5 e 88,6 ms: a máquina estava muito mais carregada na rodada de antes; vale a proporção). Pela proporção, de
    4,62 para 4,70 ms num quadro de 15,5 ms: +0,08 ms. 0 programas compilados depois de pronto nas quatro rodadas.
  Pastas: `bancada-antes-aerea/`, `bancada-depois-aerea/`, `bancada-antes-avenida/`, `bancada-depois-avenida/`.

## Capturas (1376 x 768, ?q=pc)

Em `scratchpad/novo/VIS1a/cap/`, cena planos (antes: a montagem do começo da parcela, `VIS1a/antes`; depois: a
final, `VIS1a/depois`):
- `antes-aerea.png` e `depois-aerea.png` (17h30): os anéis com a faixa de LED escura de um terço dos andares, o teto
  do Horizon Ring com a pista, as quadras azuis e as piscinas, a Compass em recuos com a agulha, as praças dos bosques
  de Supertrees, os caminhos sinuosos e os espelhos d'água no parque.
- `antes-avenida.png` e `depois-avenida.png` (17h15): o Horizon Ring de perto, a faixa de LED de 9 andares no terço do
  meio (o pedido do dono), o vidro com o reflexo e as marquises finas.
- `antes-noite.png` e `depois-noite.png` (21h): o Meridian Ring com a faixa de LED viva (7 andares), as salas acesas
  em trechos, as marquises escuras; as Supertrees em violeta e magenta.
- `antes-parque.png` e `depois-parque.png` (17h, a vista nova `parque`): as Supertrees com a copa em malha e o tronco
  vivo, a praça de pedra clara com a fita de pedra portuguesa, as copas em volta e o Meridian Ring em vidro atrás.
De conferência (não são pares): `v3-helix.png` (a Helix com a espinha de bronze que gira, entre os anéis de vidro),
`v4-compass.png` (a Compass com o pódio, os recuos e a agulha), `diag-dif-semsombra.png` (onde a sombra da sede cai na
aérea: o que clareia sem sombra).

## Pendências para o integrador

1. `data/arcologia-plano.js` (SEDE3, integrador): `ledNoMeio` e o comentário ainda descrevem a faixa de um andar; o
   render lê só o centro dela e aplica a D93 por `andaresLed` (render/arcologia/torre.js: um terço dos andares,
   ímpar). Levar a regra ao dado (por exemplo `led: { y0: 51.2, y1: 108.8, andares: 9 }` no Horizon e
   `{ y0: 37.9, y1: 82.1, andares: 7 }` no Meridian) para a interface e o Livro poderem dizer, e trocar o comentário.
2. VIS1b, R2b ou S1a: o disco da sede não entra no uso do solo (`rasterizarUso` em render/mundo/terreno.js), então o
   chão pinta pasto ali: moitas e árvores soltas no gramado do parque e até sobre as praças (`depois-parque.png`, as
   moitas na praça). Rasterizar a sede construída (praças, caminhos, gramados, os anéis) como uso urbano, ou dar à
   vegetação uma clareira por dono (a Arcologia passaria as praças e os caminhos). E `mataDaSede` devolve 0,06 nos
   gramados: devolver 0.
3. SEDE4 (D97): a mata do parque cobre 23% dele (`mataDaSede`, ruído acima de 0,62); de longe (a mais de 650 m a
   vegetação não desenha árvore) o parque só lê denso com mais mata pintada, coisa que a D97 já pede ("mata densa de
   Mata Atlântica"). O Mirror Lake grande da D97 (de 150 a 330 m) toma boa parte do parque desta parcela (caminhos,
   espelhos, praças dos bosques de Supertrees): o jardim (`jardim` e `PARQUE` em partes.js) precisa ser refeito na
   SEDE4; o pé dos anéis (`basePlantada`) na face de dentro do Horizon dá lugar ao Halo Lake e aos Hanging Gardens.
4. R1a e R1b (a sombra longa, diagnóstico acima): baixar o céu em relação ao sol com o sol abaixo de uns 12 graus (a
   sombra no chão a uns 50% em vez de 75%) e cobrir sombras de uns 3 km na vista aberta (a cascata de longe do 'pc'
   tem 1.400 m e a marcha da sombra de longe uns 900 m; a Blade a 8,9 graus faz 3,2 km).
5. Integrador: `web/cenas.html` com a vista nova `planos?vista=parque`.
6. Contratos: as chaves de programa dos materiais da Arcologia passaram a `arcologia-vidro-5` e `arcologia-opaco-5`
   (a X1b registrou -4); os padrões novos do opaco (`PADRAO.marquise`, `malha`, `troncoVivo`) e a classe de luz
   `LUZ.marquise` são internos da Arcologia; o setor 18 do LOD (`SETOR_PARQUE`) passou a ser o parque (antes era a
   reserva das ovais sem id).
7. Vegetação: o parque planta umas 300 árvores de desenho fora da mata (102 palmeiras-imperiais, 128 oitis e 66 copas
   em volta das praças; a lista da sede na cena passou de 757 para 1.151 árvores); o teto de instâncias da vegetação
   no 'pc' segue folgado nas capturas.

## Revisão adversarial (VIS1a-rev)

Corrigido (só nos arquivos da parcela):
1. Chuvisco de pixel no vidro dos anéis, das ovais e do pódio: a semente dividia o float com o centro da faixa de LED
   (60, 80, 900) e o varying erra uns ulp ali (6e-6 a 6e-5); o hash das salas (semente vezes 29) mudava 0,1 por ulp e
   sorteava de novo a cada pixel. À noite as salas acesas saíam pontilhadas (o "chuvisco" que a nota dava como
   resolvido) e de dia as persianas e o tom por painel viravam ruído. Agora `semAnel` (torre.js) põe a semente no meio
   de um de 64 passos e o shader a recupera exata; o `floor` do centro da faixa também ficou firme (com semente 0 ele
   caía no metro de baixo). Teste novo simula o erro de até 16 ulp.
2. Persianas só de perto (painel com mais de uns 10 pixels): de meia distância um painel em cinco claro lia como
   mosaico.
3. Supertrees à noite: a fase do espetáculo era sorteada por célula de 60 m e cortava em duas cores a copa que caía na
   divisa; agora anda devagar pelo chão (a onda que passa pelo bosque).
4. Juntas da marquise (padrão marquise) ao longo do arco no topo das marquises do LOD0 dos anéis e das ovais (eram em
   x do mundo: em parte do anel corriam ao longo da marquise).
5. `alvosDosSetores` não grava setor indefinido para uma oval fora da Helix e da Compass; `K.piso` sem uso saiu.

Capturas da revisão (`scratchpad/novo/VIS1a-rev/cap/`): `rev-noite.png` (as salas em blocos limpos, sem pontilhado),
`rev-avenida.png` (o vidro sem o mosaico das persianas), `rev-noiteAerea.png` (a faixa de LED legível de longe na
vista aberta à noite, pedido da D93 que não tinha captura) e `rev-parque-noite.png` (as Supertrees acesas de perto).
Triângulos e chamadas iguais aos da entrega; 0 programas compilados depois de pronto.
