# Nota de entrega: VIS1d (a sombra longa do entardecer)

Resultado: na aérea das 17h30 a sombra no gramado do parque passou de 76% para 50% da luz do chão ao sol (a conta da
VIS1a: a tela levada à luz linear), menos azul e com o sol mais quente, e a cena ficou só 10% mais escura na tela (o
chão ao sol, 7%). A sombra de longe passou de ~900 m para 3,5 km para os prédios e a sede (a Blade Tower faz os 3,2
km dela às 17h30), por uma marcha de longe só pelo topo da cidade, presa ao mundo e misturada entre os degraus do sol.
O degrau do sol da sombra de perto encolhe com o sol baixo: a ponta da sombra do anel anda ~25 m por troca do mapa,
não 110 m. Às 10h e na abertura do jogo (7h) nada muda. Custo pela proporção no SwiftShader: +0,12 ms por quadro na
RX 550 na aérea das 17h30 (o ladrilho do campo com a marcha de longe, +0,38 ms no pior ladrilho), zero na vista do
jogo; nenhum programa novo depois de pronto.

## Arquivos

Mudados (todos da parcela):
- `fonte/render/ambiente/ceu.js`: `AMBIENTE_SOL_BAIXO` e `fatorAmbiente` (o fator da luz do céu pela elevação do sol),
  `kAmb` no estado do céu, `Ambiente.estadoDoAr` (a luz do céu do ar baixo da neblina com o mesmo fator).
- `fonte/render/ambiente/ibl.js`: o fator em `cena.environmentIntensity` (o chão, a água, as fachadas, a Arcologia e
  as árvores leem o mesmo número, por uniforme).
- `fonte/render/ambiente/exposicao.js`: `EXPOSICAO.ambiente` e `aberturaAmbiente` (a exposição devolve uma parte,
  por cima do teto só com o sol baixo).
- `fonte/render/ambiente/sol.js`: `degrauDoSol` e `DEGRAU_SOL_BAIXO` (o degrau da sombra de perto pela elevação).
- `fonte/render/ambiente/sombraLonge.js`: `Altos` (as duas grades dos prédios), `alturaDaSombraLonge` (a marcha de
  longe na CPU, igual à do GLSL), `caixaDaMarchaLonge`, `alcanceDoTopo`, `ALCANCE_LONGE`, `retanguloAfetado` com o
  alcance, `alturaDaSombra` com a marcha de longe; no domínio: as grades refeitas pelos retângulos do campo e subidas
  por `texSubImage2D`, o maior topo da região de cada passe, o refazer inteiro por ladrilho, `conferir`, `ensaiar` e
  `altos` (conferência e bancada).
- `fonte/render/materiais/shaders/sombra.glsl.js`: `MARCHA_LONGE`, `passoLonge`, `marcharLonge` e `sombraEm` no
  `CAMPO_PASSE` (uAltos, uSaltos, uLonge).
- Testes: `ferramentas/testes/luz-e-entrada.teste.mjs` (5 novos), `motor.teste.mjs` (4 novos),
  `terreno.teste.mjs` (1 novo).

Sem mudança (não foi preciso): `luzNoite.js`, `motor/perfis.js` (o degrau dinâmico parte do degrau do perfil),
`shaders/terreno.glsl.js` (o chão já lia `cena.environmentIntensity` no atlas da PC3).

## O que mudou e por quê

### 1. Contraste com o sol baixo

Às 17h30 do equinócio (sol a 8,8 graus) o céu dá 0,13 de luz no chão contra 0,10 do sol rasante: a sombra tinha 58%
da luz na conta do modelo e, com a neblina de 2,6 km de ar da aérea (o véu do céu no ar baixo), 76% medido na captura.
Agora:
- O fator `kAmb` multiplica a luz do céu que ilumina: 1 acima de 12 graus, desce até 0,28 entre 9 e 7,5 graus e volta
  a 1 até 3,5 graus (sem sol direto não há sombra a firmar; o crepúsculo, a hora azul e a noite ficam como eram). A
  manhã (de 6h20 a 7h no equinócio) tem o mesmo.
- Vai por `cena.environmentIntensity` (um uniforme que o three passa a todo material padrão sem envMap próprio; o atlas
  do chão da PC3 lê o mesmo número): chão, água, fachadas, Arcologia e árvores com a mesma regra, sem programa novo e
  sem refazer os quadros-chave do PMREM. O fundo do céu não lê o ambiente: fica claro.
- A luz do céu no ar baixo da neblina (o véu do caminho) leva o mesmo fator: sem isso o véu sozinho segurava a sombra
  da aérea em ~70% (medido em 6 variantes numa página só, `cap/var*.png`).
- A exposição devolve uma parte: abre por `kAmb ^ -0,4` (1,66 vez no mínimo), por cima do teto de 14 só nesse trecho.
  O chão horizontal vivia do céu com o sol a 9 graus; com isto o chão ao sol fica perto do que era, a sombra cai mais
  da metade e a fachada ao sol acende (na aérea o mais claro da tela ainda fica abaixo do de antes: p95 0,468 para
  0,430).

| hora (equinócio) | sol (graus) | kAmb | exposição antes | depois | sombra/sol no chão, linear, sem neblina: antes | depois |
|---|---:|---:|---:|---:|---:|---:|
| 7h | 12,1 | 1,00 | 7,57 | 7,57 | 0,49 | 0,49 |
| 10h | 51,3 | 1,00 | 1,38 | 1,38 | 0,15 | 0,15 |
| 17h | 15,7 | 1,00 | 5,52 | 5,52 | 0,42 | 0,42 |
| 17h15 | 12,3 | 1,00 | 7,47 | 7,47 | 0,49 | 0,49 |
| 17h24 | 10,2 | 0,54 | 8,92 | 11,4 | 0,54 | 0,39 |
| 17h30 | 8,8 | 0,28 | 10,31 | 17,1 | 0,58 | 0,28 |
| 17h36 | 7,5 | 0,28 | 12,28 | 20,4 | 0,63 | 0,32 |
| 17h45 | 5,4 | 0,67 | 14,00 | 16,4 | 0,72 | 0,64 |
| 17h54 | 3,3 | 1,00 | 14,00 | 14,00 | 0,85 | 0,85 |

Medido nas capturas (1376 x 768, ?q=pc), sombra contra a mesma captura com a força da sombra do sol em 0 (o HAO fica):

| vista | medida | antes | depois |
|---|---|---:|---:|
| aérea 17h30 | parque (gramado), luz | 0,76 | 0,50 |
| aérea 17h30 | parque, na tela | 0,88 | 0,73 |
| aérea 17h30 | mar a leste (sombra do anel), luz | 0,79 | 0,54 |
| aérea 17h30 | teto do anel, luz | 0,71 | 0,47 |
| aérea 17h30 | miolo das sombras (a metade mais escura), luz | 0,69 | 0,43 |
| aérea 17h30 | azul/vermelho na sombra (linear) | 1,61 | 1,07 |
| aérea 17h30 | azul/vermelho ao sol (linear) | 1,07 | 0,62 |
| aérea 17h30 | tela média / chão ao sol / p95 | 0,327 / 0,338 / 0,468 | 0,293 / 0,315 / 0,430 |
| rua 17h30 | miolo das sombras, luz | 0,39 | 0,19 |
| rua 17h30 | tela média / p95 | 0,352 / 0,803 | 0,333 / 0,833 |
| aérea 10h | miolo das sombras, luz | 0,30 | 0,30 (igual) |

A conta da VIS1a (`VIS1a/cap/antes-aerea.png` contra `diag-aerea-semsombra.png`) dá 0,73 no mesmo recorte do parque:
é a mesma medida (a dela desligava também o HAO; aqui o HAO fica nas duas). "Luz" é a tela levada do sRGB para linear.

### 2. Alcance da sombra longa

A marcha de perto (48 passos de 4 a 48 m, ~903 m, chão e cidade) segue igual. Depois dela, a marcha de longe vai até
3,5 km só pelo topo da cidade (prédios e Arcologia; os morros seguem com ~900 m, sem esticar a sombra deles):
- Duas grades feitas na CPU a partir de `Campo.cidade` (`Altos`): a fina, o maior topo em 2 x 2 células do campo (8 m
  no 'pc' e no Alta, 16 m no Média; 1.024² e 512², R16F, 2 MB no 'pc'), e a de saltos, o maior em 8 x 8 finas e nas 8
  vizinhas (64 m e 128 m; 128² e 64²). Refeitas só nos retângulos que o campo publica (um prédio que nasce), subidas
  por `texSubImage2D`.
- A marcha anda em passos do tamanho da célula de saltos (64 m no 'pc'): lê a célula de saltos no meio do passo e só
  quando ela poderia subir a sombra lê as 8 finas do passo; para quando o maior topo da região que ela alcança contra
  o sol não subiria mais a sombra. Cada passe (ladrilho) recebe esse maior topo da CPU (`uLonge.w`): sem prédio alto a
  montante, ou com o sol alto (às 10h a Blade só faz 400 m), ela nem começa. O refazer inteiro passou a ser por
  ladrilho (16 passes) para cada um ter o seu maior.
- Mesmo resultado em R e G do campo: os materiais não mudam (nenhum amostrador novo neles). A sombra engorda no
  máximo uma célula fina (8 m), como a do nível 1 na marcha de perto.
- Um prédio alto que nasce ou some suja a faixa da sombra dele até `alcanceDoTopo` (o topo dele, antes ou depois, sobre
  a tangente do sol, até 3,5 km).
- Conferido no navegador (`med/conferir.log`): em 800 leituras do campo (R e G; 600 a leste da sede, onde a sombra
  longa cai, 342 delas em sombra a mais de 1 km da Blade), a GPU e a conta da CPU batem a 0,17 m no pior e 0,02 m na
  média.
- Na aérea das 17h30 a sombra da Blade e da Legacy chega à baía além do anel, onde antes a cascata de longe cortava
  num risco reto (`f/recorte-baia.png`, antes e depois); o resto dela cai dentro da sombra dos anéis ou fora do
  quadro (a ponta, a 3,2 km, fica à direita da vista).

### 3. Sem cintilar

- A sombra de longe é do campo, preso ao mundo (texels de 4 m no mapa): a câmera andando não mexe nela. Entre os
  degraus de 3 graus do sol ela anda pela mistura de sempre (`gCampoT`), e na troca o campo novo começa com a sombra do
  degrau em que o velho terminou: sem salto.
- A sombra de perto (as cascatas, até 1,4 km do foco e 2,4 km na direção do sol com ele baixo) é refeita a cada degrau
  do sol (1 grau no 'pc'); com o sol a 9 graus a ponta da sombra do anel de 160 m pulava ~110 m a cada 1,7 s em 1x. O
  degrau agora cai com sen² da elevação abaixo de 30 graus, até um quarto do do perfil (0,25 grau no 'pc'): a ponta
  anda em passos de ~25 m (teste). O mapa sai até 4 vezes mais no fim e no começo do dia; o passe custa ~0,14 ms na
  RX 550 pela proporção (42 ms de 4.733 no SwiftShader), uma vez a cada ~25 quadros em 1x.

## Custo (SwiftShader, 1920 x 1080, ?q=pc, aérea das 17h30, mínimo de 3)

Na mesma página e no mesmo instante, cada ladrilho do campo com e sem a marcha de longe, intercalados (`ensaiar` do
domínio; `medir2.mjs`, `med/ablacao-*.json`):

| vista | passe | sem a marcha de longe | com | diferença | RX 550 pela proporção (cena de 15,5 ms) |
|---|---|---:|---:|---:|---:|
| aérea 17h30 | ladrilho do passo do sol (um por quadro), média | 527 ms | 565 ms | +37,8 ms (+7,2%) | +0,12 ms |
| aérea 17h30 | o pior ladrilho | 652 ms | 767 ms | +115 ms | +0,38 ms |
| aérea 17h30 | refazer inteiro (salto de hora), 16 ladrilhos | 18.417 ms | 18.836 ms | +2,3% | uma vez |
| aérea 17h30 | cena inteira (referência) | 4.733 ms | | | |
| jogo (7h) | ladrilho do passo do sol, média | 428 ms | 421 ms | 0 (ruído; a marcha de longe nunca liga) | 0 |
| jogo (7h) | cena inteira | 3.844 ms | | | |

Montagens separadas (antes contra depois; a máquina dividida com outras parcelas, de 5 a 50% de ruído entre páginas):

| rodada | vista | ladrilhos (soma dos 16) | refazer inteiro | sombra própria refeita | terreno | cena |
|---|---|---|---|---|---|---|
| 1 (lado a lado) | aérea | 11.613 / 12.896 | 27.580 / 27.559 | 60,5 / 95,8 | 3.208 / 3.725 | 8.283 / 8.825 |
| 1 (lado a lado) | jogo | 9.963 / 10.148 | 25.117 / 26.697 | 11,8 / 11,3 | 3.545 / 3.715 | 5.176 / 5.471 |
| 3 (em seguida) | aérea | 7.682 / 8.185 | 18.234 / 17.105 | 41,2 / 55,2 | 2.267 / 2.292 | 5.434 / 5.204 |

O terreno e a cena não mudam de programa (o fator do ambiente é um uniforme; as diferenças são do ruído). A sombra
própria refeita custa ~0,9% da cena na aérea (~0,14 ms na RX 550) e 0,3% no jogo; com o degrau dinâmico ela sai até 4
vezes mais com o sol baixo: uma vez a cada ~25 quadros em 1x (+0,005 ms por quadro), a cada ~6 em 4x (+0,02 ms).
Na CPU: as grades inteiras em 40 a 50 ms (carga e troca de qualidade), um setor de 256 m em 0,15 ms, o maior topo da
região de um passe em 0,04 ms. Memória de vídeo: +2 MB (a fina de 1.024² em R16F e a de saltos de 128²). JS
principal: +6,6 KB (2.075,4 para 2.082,0 KB na montagem só com a VIS1d).

## Como testei

- `node --test ferramentas/testes/luz-e-entrada.teste.mjs`: 22 de 22. Novos: a torre de 511 m faz sombra em todos os
  receptores de 950 m a 3,2 km com o sol a 9 graus, em 16 direções, nunca mais alta que a do canto dela e nada a 40 m
  do eixo, sem passar da ponta nem do lado do sol, e o morro de 300 m não estica além da marcha de perto; o maior da
  região para a marcha sem mudar a sombra (em 3 alturas do sol) e sem prédio alto a montante ela nem começa (às 10h
  também não); as grades refeitas por retângulo (prédios que nascem e somem) iguais às inteiras, a de saltos por cima
  das 9 vizinhas; um prédio alto que nasce suja a faixa até 3,5 km e um sobrado só a marcha de perto; o passe do campo
  é um programa só (sem pré-processador, grades e alcance por uniforme, 4 amostradores, laços de tamanho fixo).
- `node --test ferramentas/testes/motor.teste.mjs`: 65 de 65. Novos: o fator do ambiente pela altura do sol (1 acima
  de 12 graus e sem sol, o mínimo de 9 a 7,5, sem degrau de 0,05 em 0,05 grau); às 17h30 a sombra/sol no chão de 0,58
  para 0,28 (linear, sem neblina), o chão ao sol acima de 90% do que era, a sombra abaixo da metade, a fachada ao sol
  até 1,8 vez, às 10h, 12h e 15h igual, a noite no teto; o fator em `cena.environmentIntensity` sem mexer nos
  quadros-chave, a neblina com a mesma luz do céu e o three passando o número aos materiais (conferido no fonte do
  r186); o degrau do sol (o do perfil acima de 30 graus, um quarto dele abaixo de 9, a ponta do anel em menos de 30 m
  por troca, a lua com o do perfil).
- `node --test ferramentas/testes/terreno.teste.mjs`: o atlas do ambiente do chão segue `cena.environmentIntensity`
  a cada quadro (1 novo; o arquivo também tem os da VIS1c).
- `node ferramentas/simular.mjs --testes`: "testes ok" e guarda de texto ok (`testes2.txt`). Numa rodada de antes,
  com a máquina carregada, o `crescimento` (p95 do tique da simulação, 26 ms contra 4) falhou; não é desta parcela e
  passou na rodada final.
- `node ferramentas/montar.mjs --saida scratchpad/novo/VIS1d/montagem-repo`: sem aviso (JS principal 2.086,4 KB com
  as outras parcelas, teto 2.355).
- Nenhum programa novo depois de pronto em nenhuma captura (`compilacoes.depois` 0 nas 4 vistas, antes e depois).
- Medida das sombras: `razao2.py` (a captura contra a mesma com a força da sombra em 0, na tela e em luz linear).

## Capturas (1376 x 768, ?q=pc; pares em `scratchpad/novo/VIS1d/f/`)

- `par-aerea.png` (`antes-aerea.png`, `depois-aerea.png`): planos?vista=aerea, 17h30. A sombra dos anéis sobre a baía
  e o parque dentro do Horizon Ring em sombra, os morros com relevo, a luz quente; a sombra longa das torres chega à
  baía além do anel (`recorte-baia.png`, ampliado).
- `par-aerea10.png`: a mesma aérea às 10h (?olhar=-570,1300,2300,200,40,150,40,10). Igual (fora do mar, onde as ondas
  andam entre as capturas, a diferença média é 0,74/255); as sombras dos anéis e das torres às 10h já se viam
  (`dif-aerea10.png`, onde a sombra cai).
- `par-jogo.png`: a abertura do jogo (?menu=nova, 7h de janeiro, sol a 21 graus). Igual (diferença média 0,68/255,
  0,09% dos pixels acima de 8: as árvores e a água).
- `par-rua.png`: cena=rua, 17h30. A pista em sombra mais funda e quente, os prédios ao sol mais acesos.
De conferência: `antes-aerea-vis1a.png` (a medida da VIS1a), `*-semsol.png` (a força da sombra em 0, para as razões).

## Pendências para o integrador

1. Sombra de perto (R1a, `render/sombra/mapa.js`): o degrau dinâmico deixa a ponta das sombras longas dentro das
   cascatas andar ~25 m por troca do mapa, mas ainda em passos; sumir com eles pede dois mapas com transição (ou o
   mapa refeito a cada quadro com o sol andando). E a cidade instanciada só projeta as instâncias de dentro da
   cascata: com a cidade vertical da D76, uma torre de 150 m logo fora dela, contra o sol, não faria sombra dentro
   (a de longe cobre só fora das cascatas). Compactar pelo volume da luz estendido contra o sol.
2. Bancada no PC do dono: o passe do campo com a marcha de longe na aérea das 17h30 (estimado em +0,12 ms por quadro)
   e o degrau dinâmico em 4x. Com a cidade vertical (milhares de torres de 100 a 200 m) a marcha de longe liga em
   quase todo ladrilho ao entardecer: medir de novo quando a cidade grande existir.
3. Água ao entardecer: pela regra pedida (o mesmo ambiente), o reflexo do céu na água cai com o fator; a baía fica
   uns 15% mais escura na tela às 17h30. Se o dono achar o mar escuro demais, o caminho é o fator só na luz difusa
   (um uniforme novo no gancho da sombra: contrato do integrador).
4. `ferramentas/testes/terreno.teste.mjs` foi editado ao mesmo tempo pela VIS1c (os testes dela em "a sede (VIS1c)" e
   o meu no fim, "VIS1d"): conferir os dois na junção.
5. Documentos (integrador): a ficha VIS1d no PROJETO e o desenho do render (2.5, sombra de longe: até 3,5 km para a
   cidade; 2.2 e 2.3, a luz do ambiente e a exposição com o sol baixo).
6. A medida da VIS1a (75% no parque) é a da tela levada à luz linear: a mesma desta nota (76% antes, 50% depois).

## Revisão adversarial

Corrigido (arquivos da parcela):
1. A marcha de longe lia até um passo além de 3,5 km (o último passo começava antes de `fim` e lia 64 m depois),
   fora da caixa do maior topo de cada passe e da faixa suja de um prédio. Na borda de um ladrilho a ponta da sombra
   da Blade Tower (sol abaixo de 8,2 graus, sombra além de 3,5 km) saía numa coluna e não na vizinha: reproduzido na
   CPU, coluna 511 com 47 m de sombra lendo tudo e -0,3 m com o maior do ladrilho. Agora a marcha só dá passos
   inteiros antes de ALCANCE_LONGE (GLSL e CPU; alcance real ~3.460 m) e a caixa, o `alcanceDoTopo` e a faixa suja
   valem como limite de verdade. Teste novo, que falha com o código antigo.
2. "Sem salto entre degraus" não valia para a ponta da sombra longa: a mistura reta das alturas punha a ponta no
   lugar novo logo no começo do degrau (o lado ao sol guarda o chão, não o quanto falta para a sombra). Medido na CPU
   (igual à GPU): a ponta do anel andava 59% do caminho nos primeiros 10% do degrau e a da Blade Tower 100% em 5%; de
   24% a 50% das células que trocam de sombra no degrau trocavam nos piores 2% dele. Agora `gCampoMistura`
   (shaders/sombra.glsl.js, no gancho 'sombraLonge' e no vértice do chão em terreno.glsl.js) curva o tempo onde um dos
   lados é só o chão: de 7% a 18% (a Blade, 10%); onde os dois lados são sombra, a reta de antes. Espelho na CPU,
   `misturaDoCampo`, e teste novo. Sem uniforme nem programa novo (compilações depois de pronto: 0).
3. Comentários: o alcance de perto é ~903 m (estava ~911).

Conferido sem mudança: GPU e CPU do campo batem (800 leituras, 0,167 m no pior, 0,020 na média, igual à entrega);
`node ferramentas/simular.mjs --testes` verde (scratchpad/novo/VIS1d/rev/testes-depois.txt); montar sem aviso.

Fica (integrador ou próxima parcela):
- A ponta ainda anda mais rápido no começo da parte que se move (o campo não sabe a distância até o prédio). Para
  ficar uniforme: guardar no campo a distância ao topo que deu a sombra, ou degraus de 1 a 1,5 grau com o sol baixo.
- O reflexo do céu na água e no vidro cai com o fator do ambiente (environmentIntensity escala o difuso e o
  especular do IBL). Se o dono achar a baía escura, dá para devolver só o especular no trecho 'indireta' com o
  envMapIntensity que o three já passa (sem uniforme novo).
- `ensaiar` e `semLonge` no domínio só servem à medição; ligar na bancada.mjs ou tirar.
- Custo da marcha de longe com a cidade vertical: com o sol entre 3 e 7 graus e torres de 150 a 200 m em todo
  ladrilho, até ~200 leituras por texel (estimado em 1 a 1,5 ms por ladrilho na RX 550): medir na bancada.
