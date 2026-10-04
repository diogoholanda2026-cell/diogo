# VIS1c: as árvores da cidade com folha e sombra, e o chão da sede sem pasto (nota de entrega)

Feita em 04/10/2026 sobre o repositório como estava às 06:25 (cópia em `scratchpad/novo/VIS1c/antes-src`, a base do
"antes"). A VIS1d rodou ao mesmo tempo em `ambiente/*`, `motor/perfis.js` e `shaders/{sombra,terreno}.glsl.js`: as
medidas e as capturas de "depois" usam a mesma base com só os arquivos da VIS1c por cima (`meu-src`, montagem `d2`), para
não misturar as duas parcelas. Sem commit nem git.

## Resultado

1. **Folhas no assado dos impostores** (`folha.glsl.js`, `GLSL_IMP_ASSAR`). O descarte agora tem o reforço do alfa pelo
   mip, o mesmo do LOD0, do LOD1 e da sombra: `if ( vArvCel < 6.5 && aT.a * ( 1.0 + aMip * 0.45 ) < 0.5 ) discard;`.
   Achado no caminho: com as folhas de volta, as copas de longe saíam quase pretas. O atlas de folhas é preto
   transparente fora das folhas e os mipmaps fazem a média do rgb com esse preto: no mip 3 do assado do PC a cor da
   folha sai multiplicada pela cobertura (uns 35%), e o reforço do alfa deixa passar justamente esses texels. Agora
   `arvCor` divide a cor pelo alfa do mip 1 em diante (no mip 0 não: a borda de um pixel da folha tem a cor inteira),
   no assado e também no LOD0 e no LOD1 (o mesmo defeito escurecia as copas do LOD1 de 45 a 140 m). Medido nas
   capturas: a copa do impostor no bairro passou de (32, 41, 32) para (55, 72, 47) em sRGB, a do LOD1 na rua de
   (32, 46, 29) para (54, 71, 41): o impostor e o LOD1 com a mesma cor, matiz de 94 a 99 graus e saturação 0,35 a
   0,42 (verde de folha, nada de verde-limão). Sem halo: o impostor já tirava o alfa pré-multiplicado do atlas dele.
2. **Alcance por dono** (`vegetacao.js`, `PERFIL_VEGETACAO` e `alcanceDaFonte`). A rua, os lotes e as plantadas (praças,
   a Arcologia) vão até `cidade` (1.000 m no Alta e no 'pc', faixa de 200 m); a mata e o campo seguem em `perto`
   (650 m, faixa 150) e as moitas em 170 m. A proposta da VIS1b (tudo a 1.000 m) foi medida e a mata ficou cara à toa:
   2,2 a 2,5 vezes os ladrilhos gerados e guardados (o cache tem 2.400) e 23% a 46% mais impostores, e além de 650 m a
   copa pintada do chão já desenha a mata; as árvores da cidade não têm nada que as pinte de longe (tabela abaixo).
   Ultra 1.300/250, Média 650/150, Leve 360/90. O corte pela vista e os setores de vias da rua usam o alcance maior.
3. **Sombra das árvores de longe** (`GLSL_IMP_SOMBRA`, `criarMaterialImpostorSombra`, `Impostores`). O impostor tem o
   gêmeo dele na sombra própria, com a MESMA geometria (as instâncias não vão duas vezes para a GPU): a carta de cada
   árvore virada para o sol (a direção é o eixo z da câmera ortográfica da sombra, a mesma para todas), com a vista do
   atlas mais perto da direção do sol, recortada pelo alfa do assado com o reforço do mip e o esmaecer do desenho: o
   desenho da copa, não um disco. A carta recua meio raio ao longo da luz: a sombra no chão não muda (teste) e a carta
   do desenho, que passa pelo centro virada para a câmera, não cai inteira na sombra da própria árvore; com o sol a pino
   o chão debaixo do centro segue na sombra em todas as espécies (teste). Uma leitura de textura por pixel, sem laço,
   o vértice com a mesma função da carta do desenho (`GLSL_IMP_CARTA`, `impCarta`). O programa novo
   (`arvore-impostor-sombra`) compila em paralelo com os outros da sombra antes do primeiro uso (0 compilações depois de
   pronto em todas as capturas). Vale até onde as cascatas alcançam (o resto o mapa corta).
4. **Chão da sede** (`terreno.js`: `usoDaSede`, `partesDaSedeNoChao`, `parquePintado`, `carimbarSede`; `mataDaSede`).
   O uso do solo carimba a sede por último: piso no pódio com a torre pronta, no leito do lago e na praça com o lago
   pronto, na planta dos anéis (trecho a trecho no Horizon Ring) e das torres do bosque prontas; com o parque pronto, o
   disco inteiro é jardim, gramado onde a grade da floresta não tem mata (abaixo de 0,4) e a mata dos bosques com a copa
   pintada e as árvores de perto. Gramado e piso entram no `urb` da vegetação pintada: nada de pasto, moita nem árvore
   solta nas praças e nos gramados. As partes prontas saem das etapas do espelho com a regra de `partesProntas`
   (`render/arcologia/planos.js`, teste de igualdade); o parque conta como pronto quando a mata dele está pintada na
   grade (a S1a pinta quando o parque fica pronto; as cenas pintam a de prova): 90% das células de mata do parque, uma
   em cada 5, com a densidade de `mataDaSede` (as células saem uma vez por forma de grade: 0,04 ms por conferência,
   porque o sinal 'arcologia' chega a cada tique da obra). O domínio refaz o disco quando a chave das partes muda
   (etapa pronta, mata pintada ou apagada) e refaz só o pedaço quando a mata muda dentro dele com o parque pronto.
   `mataDaSede` devolve 0 nos gramados do parque (era 0,06) e nas clareiras dos caminhos e das torres (era 0,05).
5. **`via.glsl.js`**: os trechos `CARRO_*` sem uso saíram (o GLSL dos carros mora em `mundo/trafego.js`).

O item 5 da ficha (o LOD1 ralo e juntar as espécies numa chamada por LOD) ficou como pendência medida (abaixo).

## Medidas (SwiftShader, 'pc', 1376 x 768, pr=1)

Script próprio (`medir.mjs` na pasta da parcela, como o da PC3): espera o assado dos impostores, gera todos os
ladrilhos do alcance (`preparar`), e mede cada passe sozinho terminando com uma leitura de pixel (mínimo e mediana de
5). A sombra própria com e sem o gêmeo dos impostores foi medida intercalada na mesma página (15 pares), porque a
máquina rodou com carga de 5 a 12 das outras parcelas e o mesmo passe varia até 2 vezes entre páginas. Vale comparar
dentro de cada linha, não com o PC do dono.

**Alcance** (antes, a VIS1c e a proposta da VIS1b com tudo a 1.000 m, `t1000`):

| vista | medida | antes | VIS1c (mata 650, cidade 1.000) | tudo a 1.000 m |
|---|---|---:|---:|---:|
| bairro (câmera a 410 m, 45 graus) | impostores | 430 | 476 | 696 |
| bairro | ladrilhos da mata gerados | 322 | 322 | 802 |
| bairro | triângulos da família árvores | 860 | 952 | 1.392 |
| bairro | passe das árvores (ms, mínimo) | 195 | 260 | 306 |
| mata (`costa?vista=mata`) | LOD0 / LOD1 / impostores | 8 / 1.675 / 780 | 8 / 1.675 / 780 | 8 / 1.675 / 962 |
| mata | ladrilhos gerados | 386 | 386 | 858 |
| mata | passe das árvores (ms, mínimo, mesma rodada) | | 3.332 | 3.628 |
| aberta (10h) e jogo (abertura da PC3) | árvores na vista | 0 | 0 | 0 |

A vista do jogo da PC3 (câmera a 1.265 m do chão) e a aberta não têm árvore nenhuma nos três casos; o uso do solo da
sede não muda nelas (nenhuma parte pronta na Nova partida); o passe de sombra tem as mesmas 2 chamadas e 1.320
triângulos no jogo e 12 chamadas e 129 mil triângulos na aberta, antes e depois.

**Sombra do impostor** (A/B intercalado na montagem da VIS1c; o raio das cascatas é o do `index.js`, 0,6 da distância
da câmera ao alvo: 240 m no bairro, 60 m na rua e na mata):

| vista | impostores | sombra sem / com (ms, mín.) | medianas | diferença | fração da cena | RX 550 pela proporção | família sombra (chamadas, triângulos) |
|---|---:|---:|---:|---:|---:|---:|---|
| bairro | 476 | 102,2 / 148,2 | 129,6 / 184,1 | +46 (+55) | 0,53% (0,57%) | +0,19 ms | 14 para 16; 47.840 para 49.744 |
| rua 10h | 792 | 97,9 / 114,3 | 118,8 / 144,6 | +16 (+26) | 0,12% (0,19%) | +0,04 ms | 22 para 24; 36.808 para 39.976 |
| mata de perto | 780 | 1.748,7 / 2.069,1 | 2.506 / 2.686 | +320 (+180) | 1,47% (0,80%) | +0,51 ms (+0,28 pela mediana) | 18 para 20; 124.336 para 127.456 |

"Pela proporção": a diferença dividida pela cena inteira desenhada na mesma página, vezes 35 ms (a placa do PC do dono
na vista aberta, D66; a do bairro não foi medida lá). Meta da ficha: o bairro com a sombra das copas de volta sem
passar de +0,5 ms: **+0,19 ms**. O pior caso é a mata fechada de perto (a cascata de 40 e 60 m de raio cheia de cartas
grandes que se sobrepõem): +0,28 a +0,51 ms, a conferir na bancada do PC do dono (pendência 4).

**Programas e tamanho:** 63 para 64 programas (o `arvore-impostor-sombra`), 0 compilados depois de pronto nas 8
capturas. JS principal +5,5 KB (2.075,4 para 2.080,9 KB na mesma base; 2.086,4 KB montando o repositório com a VIS1d),
sob demanda +1,5 KB (o GLSL das árvores), worker da oficina igual (216,6 KB).

**Bancada do projeto** (`node ferramentas/bancada.mjs --cenas bairro,aberta --perfis pc --quadros 12 --aquecer 500`
e `--cenas costa --consulta "vista=mata"`, pior quadro de 12, as duas montagens na mesma base; pastas `banc/`):

| cena | chamadas | triângulos | sombra (chamadas / triângulos) | programas | depois de pronto |
|---|---|---|---|---|---|
| bairro | 98 para 100 | 304 para 308 mil | 16 / 72 mil para 18 / 75 mil | 63 para 64 | 0 e 0 |
| aberta | 68 e 68 | 497 e 493 mil | 14 / 173 e 14 / 171 mil | 63 para 64 | 0 e 0 |
| costa, vista mata | 82 para 84 | 342 para 348 mil | 20 / 151 para 22 / 156 mil | 64 para 65 | 0 e 0 |

A família sombra do bairro não volta aos 135 mil de antes da VIS1b: a sombra das copas de longe custa 2 triângulos
por árvore (a carta), contra as copas inteiras de props que projetavam antes; o que volta é a cobertura.

## Capturas (1376 x 768, ?q=pc)

Em `/tmp/claude-0/-home-user-diogo/f46543ed-2f24-59fc-a862-962bb146c549/scratchpad/novo/VIS1c/cap/` (o `.json` e o
`.log` de cada uma ao lado). Antes: a montagem da base (`antes`). Depois: a VIS1c (`d2`), com um script que espera o
assado e gera os ladrilhos do alcance antes da foto (`prep.js`; sem ele, com a máquina carregada, a mata do pasto ainda
não tinha nascido numa captura de conferência). Lado a lado em `par-*.png`.

- `bairro-antes.png` / `bairro-depois.png` (`cena=bairro`, a vista da VIS1b): as árvores de rua e de lote com a copa
  cheia (antes, galhos), até o alto da vista, cada uma com a sombra no chão; as do pasto com copa e sombra. Recortes:
  `cmp-lotes-zoom.png` (o quarteirão do meio) e `cmp-pasto-d2b.png` (o pasto, a VIS1c sem e com a cor da folha
  corrigida).
- `rua-10h-antes.png` / `rua-10h-depois.png` (`cena=rua&hora=10`): os oitis do LOD1 ao fundo com a cor da folha do
  LOD0 (antes escuros), a palmeira e a sombra dela como antes.
- `mata-antes.png` / `mata-depois.png` (`cena=costa&vista=mata`): a mata com a mesma cor de folha de perto e de longe
  (a copa média 14% mais clara, o mesmo matiz), o sub-bosque igual.
- `parque-antes.png` / `parque-depois.png` (`cena=planos&vista=parque`): sem as moitas na praça de pedra e no
  gramado; as copas do fundo cheias. Família árvores de 37.472 para 15.960 triângulos (as moitas do pasto saíram).

Julgamento contra o CS2: o bairro a 400 m deixou de ler como maquete (as copas soltas no chão e os galhos); as
árvores de longe têm volume e sombra. De perto a mata é a da R2b. A sombra das copas só vai até onde as cascatas vão
(240 m em volta do alvo no bairro): no alto da vista as copas ficam sem sombra (pendência 1).

## Como testei

- `node --test ferramentas/testes/geracao-arvores.teste.mjs`: 24 de 24 (4 novos: o assado com o reforço do mip como o
  LOD0, o LOD1 e a sombra; o alcance por dono; o domínio num contexto sem GPU, com as árvores de um lote até 1.000 m,
  o esmaecer na faixa, o gêmeo do impostor na sombra com a mesma geometria e o descarte; a carta da sombra virada para
  o sol, uma leitura, o recuo que não muda a sombra no chão e o chão debaixo da copa na sombra em todas as espécies;
  2 ajustados à função comum da carta).
- `node --test ferramentas/testes/terreno.teste.mjs`: 40 de 40 no repositório (um deles é da VIS1d, que mexe no mesmo
  arquivo; 3 novos da VIS1c: `mataDaSede` com 0 nos gramados; o uso do solo
  da sede pelas partes prontas, igual a `partesProntas`, e com o parque pintado; e, num chão plano com o parque
  pintado e um ruído que pinta pasto, nenhuma moita nem árvore solta nos gramados, nas praças e nos caminhos, a mata
  dos bosques com as árvores, e o refazer por pedaço igual ao todo).
- `vida-rua`, `obras-anexos`, `arcologia-render`, `geracao-vias`: 90 de 90, sem mudança.
- `node ferramentas/simular.mjs --testes`: testes ok, guarda de texto ok (33 arquivos). Numa rodada com a máquina
  carregada (as capturas junto) o `crescimento` falhou no tempo do tique (p95 de 23 ms contra 4 ms); sozinho e na rodada
  final, verde (p95 de 2,5 ms). Nada da simulação mudou.
- `node ferramentas/montar.mjs --saida scratchpad/novo/VIS1c/m-repo` (o repositório): sem aviso; guarda de texto ok.

## Pendências para o integrador

1. **VIS1d (alcance das cascatas):** a sombra do impostor vai até onde as cascatas vão. Hoje o raio é 0,6 da distância
   da câmera ao alvo (`render/index.js`, `acompanharSombra`): no bairro, 240 m em volta do alvo; o alto da vista fica
   sem a sombra das copas (e de tudo o que só a sombra própria desenha; o campo da sombra de longe não leva árvore).
   Se a VIS1d aumentar o alcance, o impostor acompanha sozinho; o custo cresce com a área da cascata (medido: +46 ms
   no SwiftShader a 240 m, +0,19 ms pela proporção).
2. **SEDE4 (D97):** `usoDaSede` lê as peças do plano por tipo (`podio`, `reservatorio`, `anel`, `codex`, `oval`) e a
   praça da paisagem; o resto do disco com o parque é gramado onde a grade não tem mata. As peças novas da D97 (as
   Canopy Bridges, o Mirror Lake grande, o Halo Lake) precisam de uma regra ali (o lago grande, por exemplo, como o
   `reservatorio`). Se o integrador preferir, `usoDaSede` pode morar em `data/arcologia-plano.js` ao lado de
   `mataDaSede` (fora da VIS1c). A mata densa da D97 entra sozinha: é a grade pintada.
3. **S1a (quando o parque ficar pronto no jogo):** pintar a mata do parque na grade com `mataDaSede` (como
   `pintarMataDaSede` das cenas): é o que liga o parque no uso do solo (`parquePintado`). Se a S1a pintar outra coisa,
   o uso precisa de um sinal explícito.
4. **Bancada no PC do dono:** a sombra dos impostores na mata fechada de perto (+0,28 a +0,51 ms pela proporção). Se
   pesar, a saída medida é tirar da sombra os impostores da mata fechada (as de `arvoreDaCopa` com copa fechada) e
   deixar os soltos e os da cidade: o gêmeo ganha uma geometria própria com os mesmos atributos e o `instanceCount` só
   dos que projetam (eles vão primeiro na lista).
5. **R2b (item 5 da ficha, não coube sem custo):** (a) juntar as espécies numa chamada por LOD: hoje uma por espécie e
   LOD (medido: 9 chamadas de árvore e 12 de sombra delas na rua às 10h; 7 e 10 na mata; 1 e 2 no bairro, só o
   impostor); precisa do `BatchedMesh` com os atributos da instância numa textura, ou do multi-draw com instância
   base, trabalho de uma parcela. (b) O LOD1 de 45 a 140 m: a cor ficou certa (`arvCor`, o LOD1 deixou de sair
   escuro), o recorte das cartas ainda pisca em pontos de 1 a 2 px no SwiftShader; conferir no PC do dono com o MSAA e
   o alfa por cobertura reais antes de mexer em `ARV_DENS_LOD1`.
6. **R2b, conferir:** `arvCor` muda a cor das folhas do LOD0 e do LOD1 do mip 1 em diante (de perto, no mip 0, nada
   muda): as copas de média distância ficaram mais claras, a cor que o desenho 9.2 pede para a folha. É correção, mas
   mexe no visual aprovado da R2b.
7. **Integrador:** registrar esta nota no fim da ficha VIS1c (`docs/PROJETO.md`); nenhum arquivo novo na árvore 3.1;
   `vida-rua` e `obras-anexos` não precisaram mudar. `ferramentas/testes/terreno.teste.mjs` tem acréscimos das duas
   parcelas (a VIS1d importa `AmbienteChao` lá): os dois juntos dão 40 de 40.

## Revisão adversarial (04/10/2026)

Corrigido nos arquivos da parcela (sem commit), com teste novo de cada um:

- **Palmeiras e sub-bosque verde-amarelados de média distância (arvCor).** O atlas de folhas guardava a cor cheia, e
  a palma pinada e a folha da embaúba têm cor em toda a célula (alfa 0 fora da folha); dividir pelo alfa do mip 1 em
  diante clareava essas cartas 2 a 4 vezes, e as bordas de um pixel das folhas finas (moita, mata fina) também
  (`VIS1c-rev/cmp-palmas.png`: antes, VIS1c, revisão; `VIS1c-rev/cmp-sub.png`). Agora o atlas guarda a cor multiplicada pelo alfa
  (`GLSL_GERAR_FOLHAS`) e `arvCor` divide em qualquer mip: a média de cada mip é ponderada pela cobertura, sem
  escurecer nem clarear. Os 10% mais claros do sub-bosque na `costa?vista=mata`: antes (63, 70, 47), VIS1c (82, 92, 52),
  revisão (69, 77, 48); as copas (61, 73, 47), (73, 87, 54) e (65, 77, 48). As copas de longe do bairro e o LOD1
  continuam cheios e verdes, sem halo.
- **Moitas plantadas até 1.000 m.** O alcance por dono levou as moitas dos jardins dos lotes e dos serviços
  (`servicos.js`, `holding.js` plantam `especie: 'moita'`) para o alcance da cidade; antes elas esmaeciam aos 170 m pela
  espécie. Agora a moita, venha de onde vier, fica no alcance das moitas (`alcanceDaFonte(pv, tipo, especie)` e o laço
  das candidatas). No bairro: 476 para 399 impostores, sem mudar o que se vê.
- **Vias internas da sede fora do uso do solo.** A ficha pede "as partes prontas e as vias internas". Agora, com o lago
  pronto (quando a X1b liga o anel viário, os portões e as avenidas no grafo) ou o parque, as vias do plano entram como
  piso. No jogo o grafo já carimba a via; nas cenas (`planos?etapas=`), que desenham as vias do plano sem o grafo, o
  pasto e as moitas saíam no meio delas.
- **190 ms de travada ao refazer o disco.** `usoDaSede` percorria as 35 peças do plano em cada um dos 165 mil texels do
  disco: refazer a sede (uma etapa pronta, a mata do parque pintada, a carga do jogo) custava 174 a 180 ms no
  SwiftShader. Agora as formas saem uma vez por conjunto de partes, com as coroas contíguas juntas (os 8 arcos do anel
  viário e os trechos do Horizon Ring viram uma volta): 12 ms só com a torre, 42 ms com tudo e o parque (o mesmo
  resultado texel a texel fora das vias, conferido contra a versão da VIS1c em 40 combinações de trechos).
- Testes: `geracao-arvores` 26 de 26 (2 novos: o atlas multiplicado pelo alfa e a moita plantada no alcance das
  moitas); `terreno` 40 de 40 (as vias internas no teste do uso da sede); `simular --testes` verde; `montar` sem aviso
  (jogo 2.089,0 KB).
- Capturas da revisão (montagem do repositório, com a VIS1d junto): `VIS1c-rev/cap/{rua-10h,mata,bairro,parque}.png`, 0
  compilações depois de pronto nas quatro; comparações `VIS1c-rev/cmp-{palmas,sub,bairro,parque}.png`.

Pendências acrescentadas pela revisão:

- **SEDE4:** ao fundo da praça, as árvores plantadas da paisagem da Arcologia em fila, de longe, leem como pirulitos
  (copa redonda num tronco fino, `cmp-parque.png`); já era assim antes da VIS1c. Vale rever a espécie e o espaçamento no
  parque novo.
- **Bancada no PC do dono:** `arvoresDaRua` com 1.000 m roda na thread principal quando os setores da vista mudam (a
  VIS1b mediu 7,4 ms por remontagem na rua); medir no i3 antes de subir o Ultra para 1.300 m.
