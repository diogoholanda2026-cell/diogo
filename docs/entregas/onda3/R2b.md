# R2b: vegetação, rio e horizonte simples (nota de entrega)

## Resultado

- **Árvores de verdade perto da câmera** (domínio `vegetacao`). Sete modelos com silhueta própria, gerados na carga
  (geracao/arvores.js, puro): palmeira-imperial (fuste liso, palmito verde, palmas pinadas caídas), oiti (copa em
  domo baixa e larga), três formas de Mata Atlântica (guarda-chuva emergente, redonda, estreita), embaúba (galhos em
  candelabro e rosetas de folha palmada clara) e a moita do sub-bosque e da restinga. Copa em lóbulos irregulares de
  cartas de folha recortadas por alfa, nunca uma bola.
- **LOD0, LOD1 e impostor num atlas só.** Triângulos por modelo (LOD0 / LOD1): palmeira 478 / 72, oiti 1.172 / 138,
  mata1 1.510 / 150, mata2 1.372 / 142, mata3 816 / 98, embaúba 196 / 58, moita 168 / 28. O impostor tem 17 vistas por
  espécie (8 azimutes em 2 anéis, 15 e 50 graus, e a de cima), assadas do LOD0 na carga em dois atlas (albedo com
  alfa, e a normal da copa), uma carta por árvore e uma chamada para todas.
- **Alinhadas com a mata pintada.** Cada árvore nasce numa copa que o chão já pintava (a rede de copas da textura de
  ruído portada para a CPU bit a bit, hashGPU). Perto da câmera o chão baixa a copa (copaPerto) e apaga as árvores
  soltas, a mata ciliar, as moitas e o jundu pintados (vegetacaoPerto, novo), esmaecendo numa faixa: a troca não pula.
- **Custo.** Alcances e tetos por perfil (PERFIL_VEGETACAO; o 'pc' herda o Alta): LOD0 até 45 m, LOD1 até 140 m,
  impostor até 650 m (faixa de 150 m), tetos de 100 mil triângulos no LOD0, 60 mil no LOD1 e 14 mil impostores. Sombra
  própria só do LOD0 e do LOD1, e com a malha do LOD1 (um décimo dos triângulos); o impostor não projeta. As folhas não
  leem o HAO. Da vista aberta nenhuma árvore entra (todas além de 650 m): o custo por pixel delas lá é zero. O que pesa
  é a mata fechada de perto (as cartas recortadas se sobrepõem e cada camada paga a luz): ver a tabela da mata.
- **Água em dois programas.** O mar não carrega mais o bloco do rio (no SwiftShader o desvio por tipo era pago por
  toda a água; numa GPU ele pesava nos registradores do mar inteiro): grupo 0 o mar, grupo 1 lagoas e rios, uma
  chamada a mais.
- **Rio turvo e vivo.** A água do rio corre nas coordenadas dele (aRio: ao longo, através, meia largura; sentido pela
  cota): duas fases de fluxo, ondinhas alongadas mais rápidas no meio, plumas de sedimento, talvegue mais escuro, cor
  barrenta oliva, espuma em renda na linha d'água, fios de correnteza e pedras com colar e esteira rio abaixo nas
  margens e nas corredeiras. De longe (pixel maior que a renda) a espuma vira um tom contínuo e as pedras saem (sem o
  laço delas: mais barato). Barranco de lodo escuro no lugar da faixa bege.
- **Horizonte.** Anel de 15,5 a 44 km (domínio `fora`, uma chamada, ~10 mil triângulos): Serra do Mar onde a borda do
  mapa é terra, mar aberto com ilhas raras onde é mar, cor por vértice e a neblina por cima.
- **Manchas escuras nos morros.** Causa: o campo de alturas da sombra de longe é o chão sem a copa, e a leitura era
  no topo da copa levantada (18 m): a sombra rasa se recortava em ovais. Agora a leitura fica rente ao chão com o sol
  baixo e na sombra do campo (a sombra longa dos morros sai inteira), e com o sol alto, no vértice ao sol, sobe 1/5 da
  copa mais a flecha da malha grossa (sem pontos pretos nos buracos nem ovais no alto dos morros). Conferido às 7h no
  mapa inteiro e às 10h e 17h30 na vista aberta.
- **Mar raso em polígono.** De longe o fundo do mar desce pela distância à terra: a linha d'água da malha grossa fica
  rente à costa e as ilhas perderam o polígono de areia.
- **Moldura fora do mapa sem facetas.** A normal da serra e do mar além da borda sai das alturas no vértice (antes
  era a da face): sumiram os triângulos claros e escuros vistos do mapa inteiro.
- **Folha na sombra não fica preta.** A copa espalha uns 5% do sol por dentro (LOD0, LOD1 e impostor iguais), e o
  recorte de longe fica mais cheio: o miolo das copas deixou de salpicar de pontos pretos.
- **Mapa de cor do Alta em 4096:** 85,3 MiB passou a 42,7 MiB (RGB565, 16 bits, com pontilhado na gravação; na revisão trocou o RGB5_A1, que não usava o alfa e tinha o verde em 5 bits). Sem
  perda visível nas capturas (a rugosidade de longe vira constante 0,9). `?assado=8` volta ao RGBA8 para comparar.

## Medidas (SwiftShader, 'pc', 1376 x 768)

Como a PC2: só aquele passe, terminando com uma leitura de pixel (gl.finish de fato), no alvo da cena (1x) e num alvo
do dobro do lado (4x os pixels); a diferença separa o custo por pixel do fixo. As duas montagens (antes: a mesma cópia
do repositório com os arquivos da R2b no HEAD; depois: a R2b) abertas no mesmo navegador, com o laço parado, medidas
alternadas família por família; vale o mínimo das rodadas (a máquina estava com carga 8 a 12 das outras parcelas).
Milissegundos no SwiftShader: comparar entre colunas, não com o PC do dono.

**Vista aberta (cena aberta, 10h), 3 rodadas** (medir-ab.mjs, medida-ab-aberta-final6.json):

| passe | antes 1x | depois 1x | por pixel antes | por pixel depois | fixo antes | fixo depois |
|---|---|---|---|---|---|---|
| terreno (com o anel de fora) | 964 | 1.036 | 638 | 595 | 325 | 441 |
| água | 213 | 226 | 150 | 181 | 63 | 45 |
| árvores | 35 | 34 | 0 | 0 | 0 | 0 |
| prédios | 1.769 | 1.761 | 684 | 649 | 1.085 | 1.112 |
| resto | 109 | 106 | 51 | 47 | 58 | 60 |
| soma dos passes | 3.090 | 3.163 | | | | |
| cena inteira | 3.335 | 3.923 | 1.273 | 1.592 | 2.061 | 2.331 |

- Árvores: nenhuma entra na vista aberta (todas além dos 650 m): custo zero.
- Terreno: por pixel 7% menor (o assado de 16 bits e a vegetação pintada apagada perto); o fixo sobe 116 ms com o
  anel de fora (10 mil triângulos) e as leituras do vértice (a folga da sombra e a normal fora do mapa).
- Água: por pixel +20% pelo rio (o bloco do rio só no programa da água de dentro; de longe ele lê 3 texturas em vez
  de 10).
- Cena inteira: a soma dos passes sobe 2%; o mínimo da cena do antes saiu de uma rodada só (3.335 contra 3.939 nas
  outras duas), o depois ficou em 3.923 nas três.
- Chamadas 30 para 32 (o anel de fora e a água em dois programas); triângulos 322,8 mil para 333,1 mil; memória de
  vídeo 290,9 para 248,5 MB (texturas 255,9 para 213,2 MB: o assado de 16 bits); programas 51 para 57 (os das árvores
  compilam na carga, no aquecimento).

**Mata de perto (cena costa, ?vista=mata: câmera a 70 m, inclinação 12 graus), 2 rodadas** (medida-ab-mata-final5.json):

| passe | antes 1x | depois 1x | por pixel depois | fixo depois |
|---|---|---|---|---|
| árvores | 47 | 3.241 | 2.380 | 861 |
| terreno | 4.996 | 3.983 | 3.514 | 470 |
| água | 141 | 152 | 75 | 77 |
| cena inteira | 3.994 | 7.205 | 4.846 | 2.359 |

2.463 árvores na vista: 8 no LOD0, 1.675 no LOD1, 780 impostores; 64 mil triângulos de árvore e 137 mil na sombra
própria (12 chamadas, dentro do teto de 300 mil). Por LOD, com o LOD0 ainda até 70 m (medir-lod.mjs, uma montagem só):
187 árvores no LOD0 custavam 10,9 s, as 1.496 do LOD1 2,0 s e os 780 impostores 0,4 s. Daí o LOD0 até 45 m e o
impostor a partir de 140 m: o passe das árvores caiu de 7.361 para 3.241 ms (a cena de +191% para +80% sobre o antes,
que ali só tinha a copa pintada). A mata fechada de perto é o pior caso; precisa da bancada no PC do dono (pendência 5).
Depois desta medida o recorte do LOD1 ficou mais cheio (1,7 vez): a copa deixou de parecer rala, com um pouco mais de
pixels que passam no recorte.

## A1

`node ferramentas/montar.mjs --saida <temporária>` na mesma cópia do repositório, com e sem os arquivos da R2b:
JS principal 1.782 KB antes e 1.829 KB depois (+46 KB; o teto de 1.638 KB já estava passado pelas outras parcelas).
Sob demanda: o GLSL das árvores, 13 KB, num pedaço próprio (só o domínio `vegetacao` o importa, por import()). Worker
da oficina: 141,6 para 157,0 KB (teto 250 KB). O que sobra no principal e por que está na pendência 3.

## Arquivos

Novos ou reescritos: render/mundo/vegetacao.js, render/mundo/fora.js, render/geracao/arvores.js,
render/geracao/impostor.js, ferramentas/testes/geracao-arvores.teste.mjs. Herdados da R2a e mudados:
render/mundo/terreno.js, render/mundo/agua.js, render/materiais/shaders/{terreno,agua,folha}.glsl.js,
render/cenas/costa.js, ferramentas/testes/terreno.teste.mjs.

## Publicou

- Domínios `vegetacao` e `fora` (já no índice). Textura `arvores.folhas` (atlas de folhas 4 x 2 na GPU). Gerador da
  oficina `arvores` (as espécies nos dois LODs).
- `ctx.vegetacao = { especies, plantar(dono, itens | Float32Array), medidas(), preparar() }`: lotes, praças e a
  Arcologia plantam árvores por espécie (id ou índice), altura, largura, giro e tom.
- `ctx.chao`: `vegetacaoPerto(arv, faixa, moitas, faixaMoitas)`, `amostras()` e `aoMudar(fn)` (novos), além de
  `copaPerto` (R2a).
- O GLSL das árvores (folha.glsl.js) vem sob demanda; a cor da copa (CORES_COPA, GLSL_COPA, vec3Linear) mora agora em
  terreno.glsl.js e sai de novo por folha.glsl.js para quem já importava dali.
- Cena `costa`: `?vista=rio|mata|serra`.

## Testes

- `node ferramentas/simular.mjs --testes`: tudo verde menos `casca` (o índice fixo não liga ui/telas/corpo/*.jsx, arquivos
  novos de outra parcela da onda, no meio do trabalho dela); guarda de texto ok.
- `node --test ferramentas/testes/geracao-arvores.teste.mjs`: 19 de 19 depois da revisão (espécies e LODs com tetos, determinismo,
  silhueta sem bola, albedo sem verde-limão, oficina, hash da GPU bit a bit, rede de copas periódica, vegetação
  pintada, ladrilhos na cidade sintética, vistas do impostor, LODs dentro dos tetos, shaders sem precisão média, rio
  com sentido e lado coerentes e barrento, anel de fora virado para cima, terreno com assado de 16 bits, folga da
  sombra e o GLSL das árvores sob demanda).
- `node --test ferramentas/testes/terreno.teste.mjs` (R2a): 28 de 28 (a expressão da copa no vértice atualizada).
- `node ferramentas/montar.mjs --saida <temporária>`: sem avisos além do teto A1 do JS principal (ver acima).

## Capturas

1.376 x 768, ?q=pc, em /tmp/claude-0/-home-user-diogo/f46543ed-2f24-59fc-a862-962bb146c549/scratchpad/novo/R2b/cap/:
- final-aberta-10h.png: sem as manchas ovais nos morros; o rio barrento sem a margem tracejada.
- final-aberta-17h30.png.
- final-bairro-50m.png: as árvores da R2b no terreno vago (LOD1 e LOD0); as bolas da calçada ainda são do props.js
  (pendência 1).
- final-rio.png: correnteza, espuma na linha d'água, pedras com esteira, mata ciliar, embaúbas e moitas.
- Conferência (não entra nas 4): final-jogo-mapa.png, o mapa inteiro às 7h, sombra longa inteira, sem manchas e sem
  facetas na moldura; antes-*.png são as do início.

## Revisão adversarial (02/10/2026)

Corrigido nos arquivos da parcela, com os testes verdes (geracao-arvores 19 de 19, terreno 28 de 28):
- Impostor girado ao contrário: o vértice levava a direção da câmera ao espaço da árvore pelo giro direto e o
  fragmento devolvia a normal pelo inverso (o oposto de matrizArvore): a copa pulava de lado na troca do LOD1 para o
  impostor. Teste novo confere as duas rotações do GLSL contra a matriz da instância.
- Montagem das árvores: a chave da ordem empacotava a lista em 12 bits (até 4.096 listas). Com um dono por lote
  (R4b), as listas passam disso, a chave invadia a distância e a leitura caía noutra lista (TypeError no quadro). Agora
  a chave leva o número da candidata. Distância NaN (árvore plantada com coordenada inválida) fica de fora.
- `ctx.vegetacao.plantar` valida as árvores (espécie da tabela, coordenadas e tamanho finitos; função pura
  `plantaveis`, testada): uma espécie fora da tabela quebrava a montagem de todas.
- Balde que cresce: o dispose da geometria velha apagava na GPU os buffers da forma da espécie, que o balde da sombra
  própria e o do outro LOD usam (o VAO deles seguia apontando para os apagados). Agora solta só o aInst.
- Folhagem preta: a copa (cor por vértice, com a oclusão das cartas de dentro) saía a 0,020 no oiti e 0,029 a 0,034
  na mata e na moita, abaixo da faixa 0,05 a 0,12 do desenho 9.2. Folhas do oiti, das três matas e da moita mais
  claras (0,053 a 0,073 por vértice); teste novo da faixa nos dois LODs.
- Horizonte: a semente do anel era o tamanho do texto da semente do mapa (mapas de sementes do mesmo tamanho repetiam
  a serra; uma semente numérica dava NaN). Agora o FNV-1a do texto (`sementeFora`, testada).
- Assado de 16 bits em RGB565 (mesma memória, verde com 6 bits, sem o alfa que não era usado): o grão do pontilhado na
  vista aberta caiu de 2,07 para 1,80 (gradiente médio por pixel num recorte de pasto; o RGBA8 dava 1,48).
- A rua (setores de vias) vira Float32Array uma vez quando muda, não a cada montagem.

Capturas da revisão (scratchpad/novo/R2b-rev/cap/): rev-bairro-50m, rev-mata, rev-aberta-10h, rev-serra.

## Pendências

1. **R3b (props.js):** tirar as copas em bola (`copa` e `palmeira`, icosaedros) de mundo/props.js. A rua passa
   sozinha para o domínio `vegetacao` (oiti e palmeira-imperial pelos setores de vias) quando `props:copa0` some da
   cena. Na captura do bairro as duas aparecem lado a lado: as bolas na calçada, as árvores da R2b no terreno vago.
2. **R4b, praças e X1b:** árvores de lote, de praça e da Arcologia por `ctx.vegetacao.plantar(dono, itens)`.
3. **Integrador (A1):** a R2b soma 46 KB ao JS principal (1.782 para 1.829 KB no mesmo instante do repositório; o
   teto de 1.638 KB já estava passado pelas outras parcelas). O GLSL das árvores (13 KB) já vem sob demanda. O resto
   pede o integrador: (a) mundo/oficina.js importa oficina.worker.js de saída e, com ele, todos os geradores da oficina
   para o modo sem worker (arvores.js, 15 KB, entre eles, e também os de prédios e vias): trocar por import() no modo
   local; (b) o corpo do domínio `vegetacao` (21 KB) num arquivo novo sob demanda (mundo/vegetacao-corpo.js), uma
   linha na tabela 3.1. Worker da oficina: 141,6 para 157,0 KB (teto 250).
4. **R1b (sombra de longe):** (a) o campo de alturas e o HAO não levam a copa; a R2b compensa no terreno lendo os
   uniformes do campo no vértice (gCampoMapa, gCampoParams, gCampoT, gCampoLigado; avisar se mudarem de nome) e a
   elevação do sol (uTerCopaV.w). O certo é o campo levar a copa. (b) Com o sol baixo (7h) a sombra longa dos morros
   sai escura e dura demais (pouca luz do céu na sombra, penumbra estreita).
5. **Bancada no PC do dono:** calibrar PERFIL_VEGETACAO (alcances dos LODs, tetos, lado do impostor) e medir a vista
   da mata de perto; no SwiftShader o custo das árvores é medido, mas o alfa por cobertura e o MSAA não.
6. **S1a / mapa do jogo:** o rio do mapa autoral usa o mesmo shader (pedras e espuma afinadas no rio reto da cidade
   sintética); conferir quando o mapa tiver rios em T.rios.
7. **Integrador:** registrar esta nota no fim da ficha R2b (docs/PROJETO.md).
8. **Revisão, aberto (R2b ou R2c):** na média distância (LOD1 de 45 a 140 m, vista `bairro` a 50 m) as copas soltas
   saem ralas e salpicadas (o recorte das cartas pisca em pontos de 1 a 2 px); de perto (`?vista=mata`) ficam cheias.
   Conferir na bancada do PC do dono, com o MSAA e o alfa por cobertura reais, antes de mexer em ARV_DENS_LOD1 e no
   reforço do alfa pelo mip.
9. **Revisão, aberto (herdado da R2a):** na vista aberta a margem do rio sai em degraus (a malha grossa do terreno fura
   a faixa da água em dentes de 15 a 20 m, em marrom de lodo); a R2a deixou como pendência e a R2b não tratou.
