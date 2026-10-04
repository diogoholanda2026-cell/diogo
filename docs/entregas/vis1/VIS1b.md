# VIS1b: a rua de perto (nota de entrega)

Feita em 04/10/2026, sobre o HEAD 0f60e7c ("VIS1: textos"); o integrador guardou o parcial no b1f6af5 e esta nota vale
para os arquivos como estão agora no repositório. Sem commit nem git.

## Resultado

- **Árvores de rua e de lote com as espécies da R2b.** `mundo/props.js` não desenha mais copa nem palmeira (a copa de
  icosaedros e a palmeira de fitas saíram): as listas `copa` e `palmeira` do setor de vias vão para o domínio
  `vegetacao`, que as planta como oiti e palmeira-imperial no mesmo lugar e na mesma escala (o `arvoresDaRua` da R2b
  liga sozinho quando `props:copa0` some da cena), em LOD0, LOD1 e impostor, com a sombra própria de lá. As árvores do
  lote (`mundo/lotes.js`) vão por `ctx.vegetacao.plantar('lotes', ...)`: a copa do quintal varia pelo hash do item entre
  oiti (42%), copa redonda `mata2` (30%, a mangueira e o jambo dos quintais, baixa: 5 a 9 m), copa estreita `mata3` (22%,
  o ipê) e embaúba (6%); a palmeira-imperial fica no jardim dos prédios altos. Espaçamento, posição e escala são os do
  plano e do setor, sem mudança.
- **Carros (`geracao/veiculos.js`, LOD0 refeito).** Carroceria em 9 seções arredondadas com normais suaves (a lataria
  lê curva; o sol baixo vira um reflexo em faixa que corre pela chapa), quinas de trás em quarto de círculo de 0,22 m e
  o bico arredondado em planta, tampas de trás e da frente estufadas em duas metades (sem face chapada de frente para
  a câmera: o teste mede 0 m² de pintura a menos de 12 graus do eixo, contra uns 0,6 m² do bloco de antes), estufa com
  teto abaulado, colunas A e C da cor do carro, para-brisa e vidro de trás inclinados, janelas das portas com a coluna
  do meio, retrovisores com o espelho para trás, caixas de roda (de plástico preto no SUV e na picape), rodas de 7
  lados com aro, faróis que dobram a quina, grade, tomada de ar, placa Mercosul na frente e atrás, lanternas que dobram
  a quina e o difusor de plástico. Proporções de carro brasileiro comum: hatch (Onix, HB20), sedã (Onix Plus, Virtus),
  SUV (T-Cross, Creta, Compass), picape média (Hilux, S10) com a caçamba aberta. LOD0 de 360 a 400 triângulos; **o LOD1
  é o mesmo de antes (22 triângulos, testado)**. Ônibus e VUC com as normais almofadadas (a lateral grande não vira
  bloco de luz).
- **Material dos carros (`mundo/trafego.js`, `CARRO_GLSL`).** O GLSL dos carros saiu de `shaders/via.glsl.js` para o
  dono do material: pintura de verniz (rugosidade 0,36 em vez do espelho), tinta metálica leve na prata e no grafite
  (metal 0,45), vidro escuro com rugosidade 0,12 (reflete o céu sem o espelho branco), placa clara e fosca, plástico
  grafite fosco. Mesmo programa para o trânsito e os carros do lote (`carro-2`), um só.
- **Caminhões da Holding (`geracao/caminhoes.js`, cabine refeita).** Cabine avançada de Mercedes-Benz Atego ou Volvo
  VM: casca com normais suaves e quinas arredondadas, frente reta embaixo e deitada uns 12 graus no para-brisa, o
  para-brisa inteiro com a moldura preta e os dois limpadores, painel da grade com 4 aletas pretas e a tomada de ar,
  pala de sol, janelas das portas, para-choque de plástico grafite com os faróis nas quinas e a placa, retrovisores
  grandes em braço (o espelho de cima e o de baixo), dois degraus, para-lama da roda dianteira e o tanque. As 4
  carrocerias da R3b continuam (basculante, carroceria com paletes, betoneira, baú). Cabine na cor da Holding. LOD0 de
  406 a 642 triângulos (teto do teste 700), LOD1 igual (18).
- **Gente (`geracao/pessoas.js`, LOD0 refeito; `shaders/pessoa.glsl.js`).** 400 triângulos no LOD0: tronco e cabeça em
  8 lados (virilha escondida entre as coxas, quadril, cintura, peito, ombro e pescoço; queixo, boca, maçã do rosto com o
  nariz, sobrancelha, linha do cabelo e o alto), cabelo curto em cima, nos lados e na nuca com o rosto de pele, braços
  com o deltoide que entra no ombro (fechado em cima: de cima não se vê o tubo oco), manga curta, mão achatada, pernas
  com coxa, joelho, panturrilha e tornozelo, e normais suaves em tudo. As mesmas juntas (quadril, joelho, ombro), a
  mesma caminhada da R3b, os 5 tons de pele e as roupas; o shader ganhou só um degradê de oclusão do pé ao peito no
  vértice. O LOD1 continua com 30 triângulos (agora com normais suaves).
- **Cena `rua`.** Vista nova `calcada` (o grupo de gente mais cheio a até 70 m do cruzamento, a câmera na pista olhando a
  calçada quase de lado, a 10 m); o resultado traz `arvores` (as medidas da vegetação), `lotes` e `calcada`.

## Orçamento (bancada, 'pc', 12 quadros, pior quadro)

`node ferramentas/bancada.mjs --cenas rua,bairro --perfis pc --quadros 12 --aquecer 500`, a mesma bancada nas três
montagens: **antes** (git archive do 0f60e7c), **VIS1b** (o 0f60e7c com só os arquivos da parcela por cima) e **VIS1b com
as 2 linhas da R2b** (a pendência 1, aplicadas só na cópia de teste).

| cena | medida | antes | VIS1b | VIS1b + R2b |
|---|---|---|---|---|
| rua | chamadas (sombra) | 126 (24) | 126 (24) | 126 (24) |
| rua | triângulos (sombra) | 622 mil (178 mil) | 463 mil (71 mil) | 465 mil (71 mil) |
| rua | família árvores / vida / resto | 91 mil / 33 mil / 94 mil | 9 mil / 40 mil / 118 mil | |
| bairro | chamadas (sombra) | 106 (20) | 98 (16) | 98 (16) |
| bairro | triângulos (sombra) | 403 mil (135 mil) | 305 mil (72 mil) | 305 mil (72 mil) |
| ambas | programas / compilados depois de pronto | 66 / 0 | 63 / 0 | 63 / 0 |

- Triângulos: -26% na rua e -24% no bairro (o teto era +10%). As árvores de rua e de lote no LOD1 e no impostor da R2b
  custam muito menos que as copas de props até 650 m (a família árvores caiu de 91 mil para 9 mil na rua) e a sombra
  própria perdeu as copas de LOD0 de props até 190 m (o impostor não projeta, desenho da R2b).
- Sobe o que é de perto: vida +18% na rua (carro de 360 a 400 triângulos no LOD0 até 95 m, gente de 400 até 38 m,
  caminhão de 406 a 642 até 120 m) e resto +25 mil (os carros parados dos lotes, que o plano da R4b desenha sempre no
  LOD0, agora com o modelo novo).
- Chamadas: nenhuma a mais por modelo (carro, caminhão e gente com uma chamada por modelo e LOD, como antes). As árvores
  saem das 6 chamadas de props e lotes (e 4 de sombra) e entram nos baldes da vegetação por espécie; com as espécies do
  lote (mata2, mata3, embaúba) a vista pode somar até 6 chamadas e 3 de sombra onde não há mata por perto: medido, a rua
  ficou igual e o bairro caiu 8.
- Programas: 66 para 63 (os dois materiais de árvore de props e o de lotes saíram; carro, caminhão e gente seguem com um
  programa cada, compilados no aquecimento: 0 depois de pronto nas duas cenas).
- CPU: o código por quadro do tráfego e da gente não mudou (só os modelos e o material); os lotes refazem a lista de
  árvores só quando os lotes à vista mudam (a mesma hora em que já refaziam as listas de carros).
- Tamanho (montagem): JS principal 2.060,1 para 2.061,6 KB; sob demanda 398,7 para 402,4 KB (o caminhão e a gente);
  worker da oficina 225,0 para 229,5 KB (teto 250: `geracao/veiculos.js` cresceu e está no índice do worker só por um
  `registrar()` vazio, pendência 4).

## Achado fora da parcela (R2b): o impostor das árvores perdia as folhas

Com as árvores da cidade passando para a vegetação, o defeito do impostor da R2b aparece em toda a cidade: na vista do
bairro (cena `bairro`, câmera a 400 m e 45 graus) as árvores de rua e de lote viraram galhos sem folha (pontos
escuros). Causa: o assado dos impostores (`GLSL_IMP_ASSAR` em `materiais/shaders/folha.glsl.js`) lê o atlas de folhas no
mip da resolução do assado e descarta com alfa < 0,5 **sem o reforço do alfa pelo mip** que o material do LOD0 e do LOD1
usa (`aT.a * ( 1.0 + aMip * 0.45 )`): no quadro de 128 px do 'pc' as cartas de folha somem e só o tronco e os galhos
ficam. Segundo ponto: o alcance das árvores no 'pc' (`perto` 650 m, esmaecendo de 500 a 650 m, distância 3D da câmera)
corta a metade de cima da vista do bairro; o props desenhava as copas pela distância do setor (até uns 900 m).
Proposta (2 linhas, testada numa cópia, não no repositório; `exp-patch.sh`):

```
// folha.glsl.js, GLSL_IMP_ASSAR.fragmento
if ( vArvCel < 6.5 && aT.a * ( 1.0 + aMip * 0.45 ) < 0.5 ) discard;
// vegetacao.js, PERFIL_VEGETACAO.alta (o 'pc' herda)
alta: { lod0: 45, lod1: 140, perto: 1000, faixa: 200, ... }
```

Medido na cena `bairro` ('pc', a mesma bancada): com as 2 linhas, 98 chamadas e 305 mil triângulos, iguais aos da VIS1b
sozinha (o impostor custa 2 triângulos e uma chamada para todos). A imagem
`capturas/bairro-arvores-antes-so-vis1b-com-r2b.png` mostra o mesmo recorte nas três montagens: as copas de props, os
galhos sem folha do impostor de hoje e as copas cheias com a correção.

## Capturas

1.376 x 768, `?q=pc`, em `/tmp/claude-0/-home-user-diogo/f46543ed-2f24-59fc-a862-962bb146c549/scratchpad/novo/VIS1b/capturas/` (o `.json` e o `.log` de cada uma ao lado). **Antes:** a montagem do 0f60e7c.
**Depois:** a VIS1b com as 2 linhas da R2b da pendência 1 aplicadas na cópia de teste (sem elas, as árvores de rua de
longe ficam sem folha; ver a imagem do bairro).

- `rua-10h-antes.png` / `rua-10h-depois.png` (`cena=rua&hora=10`, rasante): as bolas facetadas da calçada viram oitis
  de folha recortada, a palmeira-imperial da R2b no canteiro (e a sombra dela no asfalto, das palmas de verdade).
- `rua-18h-antes.png` / `rua-18h-depois.png` (`hora=18`, sol baixo atrás da câmera): o bloco bege na traseira do SUV
  preto vira a traseira com lanternas que dobram a quina, placa, difusor e um reflexo em faixa na tampa curva.
- `caminhao-antes.png` / `caminhao-depois.png` (`vista=caminhao&hora=10`): a cabine lisa com o para-brisa preto vira a
  cabine de Atego (para-brisa com moldura e limpadores, grade de aletas, pala, retrovisores, para-choque com faróis);
  as picapes do outro lado com caçamba, placa e lanternas.
- `calcada-antes.png` / `calcada-depois.png` (`vista=calcada&hora=16`, a vista nova): a gente de perto, com normais
  suaves, cabeça e ombros redondos, cintura e quadril. O antes saiu com a primeira versão da vista (inclinação 6 graus,
  15 graus de guinada a menos); o grupo é o mesmo.
- Conferência (não entra nas 4): `bairro-arvores-antes-so-vis1b-com-r2b.png`, recortes da imagem da bancada do bairro
  nas três montagens (antes, só a VIS1b, com as 2 linhas da R2b).

Julgamento contra o CS2 e foto de rua: a rua de perto deixou de ler como maquete nas árvores (agora as da R2b) e na
traseira dos carros; o caminhão lê como caminhão de obra brasileiro. A gente melhorou (silhueta, ombro, cabeça), mas de
perto ainda é uma figura lisa de cor chapada por peça, sem textura de roupa nem rosto: está no nível do CS2 a 30 m, não
a 10 m.

## Como testei

- `node --test ferramentas/testes/vida-rua.teste.mjs ferramentas/testes/geracao-vias.teste.mjs
  ferramentas/testes/obras-anexos.teste.mjs`: 41 de 41. Novos ou mudados: carros de perto (lataria com normal suave,
  0 m² de pintura chapada de frente ou de trás, as duas placas de 40 x 13 cm, retrovisores, janelas laterais, LOD1 com
  os mesmos 22 triângulos, rugosidade do verniz, do vidro, da placa e do plástico no GLSL); árvores de rua (props sem
  modelo nem malha de árvore, as listas do setor iguais às que a vegetação planta, os postes e o semáforo compactados de
  um `setoresPerto` gerador); cabine do caminhão (para-brisa deitado de mais de 1,4 m², espelhos para trás, para-choque
  de plástico, casca suave, rugosidades); figura de gente (300 a 400 triângulos no LOD0, faces para fora pelo eixo do
  membro na altura, normais suaves, cabelo e rosto, ombros de 0,4 a 0,52 m, peito em 8 lados); lote (as árvores do setor
  de verdade plantáveis na vegetação, na posição do plano, espécies e alturas, pesos do sorteio, o domínio planta pelo
  dono 'lotes' sem malha de árvore e solta no descarte). A luz escondida no bico (teste da R3a) segue zerada.
- `node ferramentas/simular.mjs --testes`: 33 de 33, guarda de texto ok (no repositório como está, com a VIS1a junto).
- `node ferramentas/montar.mjs --saida /tmp/claude-0/-home-user-diogo/f46543ed-2f24-59fc-a862-962bb146c549/scratchpad/novo/VIS1b/m-repo`: sem aviso (JS principal 2.075,3 KB com a VIS1a).
- Bancada e capturas: acima. A vitrine dos modelos (`/tmp/claude-0/-home-user-diogo/f46543ed-2f24-59fc-a862-962bb146c549/scratchpad/novo/VIS1b/vitrine/`, uma página com os materiais de verdade e os ganchos
  vazios) serviu para afinar carro, caminhão e gente antes do jogo inteiro.
- Achado no meio: `setoresPerto` é um gerador; a primeira versão do props andava nele duas vezes e a rua ficou sem
  poste (a bancada mostrou 0 postes). Corrigido e com teste.

## Pendências para o integrador

1. **R2b, antes da Prévia (2 linhas, fora da VIS1b):** o assado do impostor sem o reforço do alfa pelo mip
   (`folha.glsl.js`, `GLSL_IMP_ASSAR`) e o alcance do 'pc' (`vegetacao.js`, `PERFIL_VEGETACAO.alta`: `perto` 1000 e
   `faixa` 200). Sem as duas, a vista do bairro perde as árvores de rua e de lote (galhos sem folha e nada além de
   650 m). O `exp-patch.sh` na pasta da parcela aplica as duas numa cópia. Custo medido: nenhum (98 chamadas e 305 mil
   triângulos no bairro, com e sem).
2. **R2b (juntar espécies):** a vegetação desenha uma chamada por espécie e LOD (e uma de sombra por espécie); as copas
   do lote usam 3 espécies a mais que a rua (mata2, mata3, embaúba). Medido sem chamada a mais na rua e com 8 a menos no
   bairro, mas onde não há mata por perto são até 6 chamadas e 3 de sombra a mais; juntar as espécies numa chamada por
   LOD (multi-draw ou a espécie no vértice) é trabalho da R2b. Também da R2b: o LOD1 de 45 a 140 m segue ralo
   (pendência 8 dela) e o impostor não projeta sombra (as árvores de rua além de 140 m ficaram sem sombra; o props
   projetava as copas de LOD0 até uns 190 m).
3. **R3a (`shaders/via.glsl.js`):** os trechos `CARRO_*` não têm mais uso (o GLSL dos carros foi para
   `mundo/trafego.js`, `CARRO_GLSL`, junto do material): apagar.
4. **Integrador (`mundo/oficina.worker.js`):** o índice do worker importa `geracao/veiculos.js` (e `pessoas.js`) só
   por um `registrar()` vazio; com o carro novo o worker foi de 225,0 para 229,5 KB (teto 250). Tirar os dois do índice.
5. **R4b/R4c:** os carros parados do lote são sempre do LOD0 (o plano não tem LOD para eles): com o carro novo, +20 a
   25 mil triângulos na família resto na rua e no bairro. Uma lista de LOD1 por distância seria uma chamada a mais por
   modelo, por isso não entrou. Com a D95 (cidade de alto padrão) a R4c pode puxar `CARROS_LOTE` para mais SUV e sedã.
6. **Integrador (`fonte/web/cenas.html`):** a vista nova `rua?vista=calcada` no índice das cenas da prévia.
7. **Integrador:** registrar esta nota no fim da ficha VIS1b; nenhum arquivo novo na árvore 3.1.

## Revisão adversarial (04/10/2026)

Corrigido nos arquivos da parcela (sem commit), com teste novo de cada um:

- **Picape com a caçamba furada.** As paredes de dentro e a parede da cabine estavam viradas para fora: com o material
  de uma face só, de cima e de trás via-se o chão e o miolo do carro pela caçamba (6% dos raios de câmeras acima do
  horizonte batiam numa face de costas; agora 0,05%). A parede da cabine sobe 3 cm por cima da base do vidro de trás
  (a emenda deixava uma linha de pontos claros) e o vidro da porta acompanha o vidro de trás (passava da cabine no alto).
- **Caixas de roda invisíveis em todos os carros e para-lamas do caminhão invisíveis.** As meias-luas e o para-lama
  dianteiro (lado e cima) estavam virados para dentro e sumiam vistos de fora.
- **Roda que parecia calota pintada.** Entre o aro e a banda não havia flanco: via-se a lataria atrás. Agora o flanco
  preto fica atrás do aro; a metade de cima da banda, escondida pelo painel do lado, saiu nos carros de passeio (LOD0
  de 370 a 396 triângulos, 4 a menos que antes; ônibus 212 e VUC 184 com o flanco; LOD1 igual, 22).
- **Fresta em V no alto da traseira e do bico** (tampa estufada contra o tampo reto): de cima via-se o chão por ela.
- **Caminhão:** painel de plástico da frente entre o para-choque e o piso da cabine (a fresta escura sumiu); 514 a 650
  triângulos.
- **Cabelo longo virado para dentro:** a mecha sumia vista de trás (agora costas, lados e o alto para fora; 400
  triângulos).
- **Degradê de oclusão da gente em degraus:** vPessoa era flat, então a cor do degradê saía por triângulo (degrau no
  joelho e nas faixas do tronco). Agora é suave.
- Testes: `vida-rua`, `geracao-vias` e `obras-anexos` 42 de 42 (teste novo de furo por raios nos carros, flanco da
  roda, para-lamas e painel do caminhão, mecha e cor suave da gente, e a vegetação que chega depois do primeiro quadro
  nos lotes); `simular --testes` 33 de 33; `montar` sem aviso.
- Capturas da revisão (montagem do repositório, sem as 2 linhas da R2b): `VIS1b-rev/capturas/caminhao-rev.png` e
  `calcada-rev.png`; comparações `VIS1b-rev/cmp-picape-caminhao.png` e `cmp-gente.png`.

Pendências acrescentadas pela revisão:

- **Bloqueante, R2b:** além das 2 linhas da pendência 1, o impostor não projeta sombra, e isso agora pesa na vista do
  bairro: as árvores de lote projetavam sombra em todo setor LOD0 (props, copa0 com sombra) e hoje só até 140 m; a 400 m
  as copas ficam sem sombra, soltas no chão como maquete (`VIS1b-rev/zoom-bairro-sombra.png`, recorte da imagem da
  bancada: antes x VIS1b com as 2 linhas). A sombra do impostor (a carta virada para o sol no passe de sombra) é da R2b.
- **R2b:** subir o `perto` do Alta para 1000 m vale também para a mata: medir a `costa?vista=mata` antes de aceitar. O
  `montar` da vegetação passa a receber as árvores de rua e de lote (3,2 ms por remontagem na rua, 7,4 ms com 1000 m).
- **R4c/integrador:** com os carros de lote sempre no LOD0, a família resto da rua foi a 118 mil (teto da vista aberta
  110 mil; a bancada só confere famílias na `aberta`).
