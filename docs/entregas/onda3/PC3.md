# PC3: o terreno de perto e as compilações (nota de entrega)

## Resultado

- **Terreno, vista do jogo** (?menu=nova, 2070 x 1001, ?q=pc, SwiftShader, só o passe do terreno, mínimo de 3): de
  3.281 para 1.744 ms (**-47%**); tirando o custo fixo (o mesmo desenho com o fragmento vazio, ~200 ms), -51%. Depois
  da última correção (amostradores, abaixo), 1.693 ms. A cena inteira: de 3.826 para 2.236 ms (-42%).
- **Terreno, vista aberta**: de 1.995 para 1.383 ms (**-31%**; sem o fixo, -34%). Cena inteira: de 5.246 para 4.640 ms.
- **Pela proporção**, os 36,2 ms da RX 550 na vista do jogo iriam para ~19 ms, e os 15 a 20 ms da aberta para ~10 a
  14 ms. **As metas de 12 ms (jogo) e 8 ms (aberta) não estão provadas e, pela proporção, não fecham só com isto.** A
  proporção do SwiftShader com a RX 550 não é fixa (o programa de longe ficou muito menor, e na placa isso pesa mais
  que na CPU), mas só a bancada no PC do dono decide. A ablação de depois (abaixo) mostra onde está o resto.
- **Compilação depois de pronto: 0** em todo o roteiro de ferramentas (câmera na Vila, prévia de via normal, inválida
  e sugestão, construir via, zonas, pincel, fantasma, demolir, ladrilhos, camada de grade, limpar). Antes: 'via',
  'sobreposicao', 'sobreposicao:linhas' e 'sobreposicao:alcance'.
- **'arvore-sombra' e 'arvores:assar-impostores'**: os 2,2 s não vinham do sombreador (os dois são pequenos e sem
  laço; no relatório do dono é um ou o outro em cada rodada, nunca os dois): era espera na fila da compilação. Agora
  os dois compilam em paralelo antes do primeiro uso. Falta a prova no D3D11 (o SwiftShader não reproduz o caso).
- **Resolução dinâmica**: conferida, sem mudança (vem ligada no jogo, mira 15,5 ms, a nitidez acompanha, a bancada
  trava).
- **Visual**: 4 pares A/B sem perda visível. Testes verdes (terreno 34, motor 61, geracao-arvores 20;
  `simular.mjs --testes` inteiro ok) e `montar.mjs --saida` sem aviso.

## Tabela antes e depois (mesma rodada, montagem normal, ms, mínimo e mediana de 3)

| vista | medida | antes | depois | ganho |
|---|---|---:|---:|---:|
| jogo | terreno | 3.281 / 3.462 | 1.744 / 1.825 | -47% |
| jogo | terreno, de novo na mesma página | 3.382 / 3.418 | 1.794 / 1.800 | -47% |
| jogo | terreno depois da correção dos amostradores | | 1.693 / 1.758 | -48% |
| jogo | fragmento vazio (custo fixo) | 192 | 228 | |
| jogo | cena inteira | 3.826 / 3.954 | 2.236 / 2.248 | -42% |
| jogo | nós perto / meio / longe | 78 / 0 / 4 | 0 / 39 / 43 | |
| aberta | terreno | 1.995 / 2.087 | 1.383 / 1.411 | -31% |
| aberta | terreno, de novo | 2.098 / 2.103 | 1.408 / 1.420 | -33% |
| aberta | fragmento vazio | 175 | 179 | |
| aberta | cena inteira | 5.246 / 5.291 | 4.640 / 4.866 | -12% |
| aberta | nós perto / meio / longe | 36 / 0 / 27 | 0 / 18 / 45 | |

Câmeras fixas (cam-jogo.json: a abertura de jan. 2020; cam-aberta.json: ?cena=aberta), resolução travada (?pr=1). O
mesmo número varia ~5 a 10% entre rodadas (máquina compartilhada); antes e depois rodaram em seguida.

## O que mudou no terreno

Passos medidos na vista do jogo (cada um sobre o anterior; rodadas diferentes):

| passo | terreno (ms) | o que é |
|---|---:|---|
| antes | 3.460 | um programa só, com o caminho completo em quase toda a tela da abertura |
| 1. três programas e camadas preparadas uma vez | 2.729 a 2.962 | 'terreno' (perto, com as camadas do chão), 'terreno-medio' (sem as camadas, além dos 400 m do detalhe) e 'terreno-longe' (só o assado); costão, fim da praia e margem calculados uma vez por pixel (terPreparar), a vegetação pintada uma vez, a de beira d'água só perto d'água, a água exata só nos primeiros 250 m, manchas e tufos só de perto, a normal do relevo só quando há relevo, as 2 camadas de cada pixel escolhidas sem índice variável (no D3D11 o vetor indexado vai para a memória temporária) |
| 2. luz do ambiente por atlas e PCF de Vogel constante | 2.496 | a luz do ambiente do chão lê um atlas octaédrico de 160 x 32 (5 níveis, refeito a cada quadro do ambiente da cena, 'terreno:ambiente') com 1 leitura na difusa e 2 na especular, no lugar do textureCubeUV do three; a PCF da sombra usa o disco de Vogel em constantes e um giro por pixel, sem seno e cosseno por amostra (a mesma conta, vale para todos os materiais com sombra) |
| 3. assado de 1 m por texel e relevo assado | 2.004 a 2.046 | o mapa de cor assado vai de 4.096² para 8.192² (RGB565): o caminho barato começa a ~825 m (antes ~1.650 m), a vista do jogo inteira; o relevo das copas grandes, que só o caminho completo desenhava até 1,65 a 2,48 km, vem de um assado de relevo (R8, 8.192²) com a mesma soma de pesos de antes |
| 4. encosta só nas paredes | 2.040 (2.161 sem, na mesma rodada) | com o assado de 1 m, a projeção lateral da mata e da pedra de longe só nas paredes (inclinação acima de 0,45, antes 0,2) |
| ordem de frente para trás | (dentro dos passos) | os nós de cada malha saem ordenados pela distância: o teste de profundidade descarta o que fica atrás dos morros antes do fragmento |

Não entrou (medido e descartado): o aniso 1 no assado e no ruído (sem ganho no SwiftShader, perda de nitidez de
longe) e o desvio só por uniforme (19% com o código ainda no programa, contra 51% tirando o caminho do programa).

Amostradores (contados pela guarda do motor, contarPrograma, no navegador): 'pc' com 12 nos três programas do chão
(antes 12 e 11) e o Média com 12, 11 e 11; vetores de uniforme de 96 para 92. Para isso o envMap do three, sem uso desde
o atlas, saiu da declaração, e o assado de relevo só existe no meio e no de longe com o perfil que o tem
(TER_RELEVO_ASSADO); o de perto faz o relevo por pixel até onde ele chega (a mesma soma de pesos). Um teste novo
segura isso.

## Ablação antes (um recurso desligado por vez, mesma câmera)

Mínimo de 3 desenhos só do terreno, 2070 x 1001, montagem de antes. Ganho = base menos a variante.

| variante | o que sai | jogo (ms) | ganho | aberta (ms) | ganho |
|---|---|---:|---:|---:|---:|
| base | tudo ligado | 3.460 |  | 2.231 |  |
| sem-detalhe-camadas | camadas do chão (TER_DETALHE) | 3.015 | 445 (13%) | 1.992 | 239 (11%) |
| sem-medio-vegetacao | vegetação do meio (mata, campo e copas) | 2.907 | 553 (16%) | 2.024 | 208 (9%) |
| sem-ingreme-lateral | projeção lateral nas encostas | 3.329 | 131 (4%) | 2.205 | 27 (1%) |
| sem-manchas-tufos | manchas e tufos do campo | 3.055 | 405 (12%) | 2.090 | 141 (6%) |
| sem-granito | granito e costão | 3.358 | 102 (3%) | 2.206 | 26 (1%) |
| sem-relevo-copas | relevo das copas (rede da R2a) | 3.426 | 34 (1%) | 2.182 | 49 (2%) |
| sem-normal-derivada | normal do relevo pelas derivadas | 3.402 | 58 (2%) | 2.152 | 80 (4%) |
| sem-ruido | ruído (3 oitavas com gradiente) | 2.999 | 461 (13%) | 2.096 | 135 (6%) |
| sem-agua-exata | borda d'água exata | 3.362 | 98 (3%) | 2.129 | 103 (5%) |
| sem-veg-perto | vegetação de perto (R2b) | 3.489 | -28 (-1%) | 2.174 | 58 (3%) |
| sem-sobreposicoes | faixa das vias, aplainar, camadas e células, ladrilhos, pincel | 3.345 | 115 (3%) | 2.149 | 82 (4%) |
| sem-caminho-completo | o caminho completo inteiro (só o assado) | 1.693 | 1.767 (51%) | 1.514 | 717 (32%) |
| sem-sombra-perto | sombra do sol (PCF) | 3.156 | 304 (9%) | 1.926 | 305 (14%) |
| sem-sombra-longe | sombra de longe e do campo (R2b) | 3.323 | 137 (4%) | 2.079 | 153 (7%) |
| sem-nuvem | sombra das nuvens | 3.397 | 63 (2%) | 2.083 | 149 (7%) |
| sem-hao | HAO | 3.332 | 129 (4%) | 2.078 | 154 (7%) |
| sem-noite | luz da noite | 3.445 | 15 (0%) | 2.174 | 58 (3%) |
| sem-neblina | neblina | 3.475 | -15 (0%) | 2.067 | 164 (7%) |
| sem-ibl | luz do ambiente (textureCubeUV do three) | 2.947 | 513 (15%) | 1.703 | 528 (24%) |
| so-assado-sem-ganchos | só o assado, sem sombra, HAO, noite e neblina | 1.204 | 2.256 (65%) | 1.090 | 1.141 (51%) |
| vazio | fragmento vazio (custo fixo) | 197 | 3.263 (94%) | 194 | 2.037 (91%) |
| uni-longe-tudo | caminho barato por uniforme (o código fica no programa) | 2.793 | 667 (19%) | 2.007 | 224 (10%) |
| uni-sem-sombra | sombra desligada por uniforme | 3.334 | 126 (4%) | 2.133 | 99 (4%) |

Cena inteira nessa rodada: jogo 4.178, aberta 5.251. Leitura: metade do custo era o caminho completo, e ele cobria
quase a tela inteira da abertura (o barato só a partir de ~1,65 km). Dentro dele ninguém dominava: luz do ambiente,
vegetação do meio, ruído, camadas e manchas, de 12% a 16% cada. Desviar por uniforme ganhou só 19%: por isso programas
separados e o assado mais fino, não só desvios.

## Ablação depois (onde está o resto)

| variante | o que sai | jogo (ms) | ganho | aberta (ms) | ganho |
|---|---|---:|---:|---:|---:|
| base | tudo ligado | 1.726 |  | 1.387 |  |
| sem-caminho-completo | o caminho completo (o meio e as paredes) | 1.512 | 214 (12%) | 1.225 | 162 (12%) |
| sem-relevo-assado | relevo das copas pelo assado | 1.692 | 34 (2%) | 1.377 | 10 (1%) |
| sem-normal-relevo | normal do relevo | 1.640 | 86 (5%) | 1.413 | -26 (-2%) |
| sem-amb | luz do ambiente (atlas) | 1.538 | 188 (11%) | 1.235 | 152 (11%) |
| sem-sombra-perto | sombra do sol (PCF) | 1.434 | 292 (17%) | 1.160 | 227 (16%) |
| sem-sombra-longe | sombra de longe e do campo | 1.692 | 34 (2%) | 1.316 | 71 (5%) |
| sem-nuvem | sombra das nuvens | 1.704 | 21 (1%) | 1.386 | 1 (0%) |
| sem-hao | HAO | 1.705 | 21 (1%) | 1.423 | -35 (-3%) |
| sem-neblina | neblina | 1.615 | 111 (6%) | 1.325 | 62 (4%) |
| vazio | fragmento vazio (custo fixo) | 202 | 1.524 (88%) | 185 | 1.202 (87%) |
| base2 | tudo ligado, de novo (o ruído da medida) | 1.858 |  | 1.440 |  |

O maior pedaço agora é a sombra do sol (PCF de 8 amostras na tela inteira, 17%), que é dos ganchos e vale para todos
os materiais; depois o caminho completo que sobrou (paredes e o meio, 12%), a luz do ambiente (11%) e a neblina (6%).
O resto (~50%) é o assado lido, a luz direta do three e os vértices.

## Compilação depois de pronto (item 2)

Roteiro no Chromium (ferr.mjs, ?menu=nova&q=pc), contando os programas ligados depois de pronto.

| | antes | depois |
|---|---|---|
| câmera perto da Vila | 'via' (23,9 ms) | 0 |
| prévia de via, inválida, sugestão, construir, zonas, pincel, fantasma, demolir, ladrilhos, camada, limpar | 'sobreposicao' (2.158,8 ms de bloqueio no SwiftShader, na primeira prévia), 'sobreposicao' (4,1 ms), 'sobreposicao:linhas' (7,3 ms), 'sobreposicao:alcance' (4 ms) | 0 |

Causas: (1) o aquecimento das sobreposições usava geometria vazia sem o atributo de posição, e o three põe "tem
posição" e as cores por vértice na chave do programa: o programa aquecido não servia para o de verdade; agora
`geometriaVazia(cores)` dá posição e cor; (2) o material 'via' não estava na cena da abertura (o mapa visto de 2 km,
nenhuma via no alcance): uma malha de aquecimento com os mesmos atributos de um setor (`geometriaAquecerVia`) entra no
aquecimento. As capturas confirmam: a da Vila antes compilou 'via' no quadro 14; depois, 0.

## Árvores (item 3)

No relatório do PC do dono, numa rodada 'arvore-sombra' leva 2.151 ms e 'arvores:assar-impostores' 1,2 ms; noutra,
2.177 ms no assado e 5,1 ms na sombra. O tempo é do primeiro programa usado de forma síncrona enquanto a fila do
KHR_parallel_shader_compile ainda compila o resto da carga, não do sombreador. Mudança: o material do assado nasce uma
vez com o GLSL das árvores (antes nascia e morria dentro do assado); os programas dos dois LODs, dos impostores, da
sombra (no estado de sombra) e do assado (no alvo dele) compilam em paralelo com `Aquecimento.compilar()`
(compileAsync do three, que só olha o COMPLETION_STATUS, sem parar a thread); as árvores só entram no quadro e o
assado só roda quando todos ficaram prontos, e o aquecimento da carga espera por isso. Teste novo: os dois sombreadores
sem laço, sem vetor indexado por variável e com menos de 2.200 caracteres.

No SwiftShader o caso não aparece (antes: 5 e 4 ms). Depois, o assado dos impostores mostra 1,4 s de bloqueio durante
a carga: é a fila do processo da GPU, que no SwiftShader executa na CPU o assado de 8.192² pedido logo antes; não é
compilação (o COMPLETION_STATUS já tinha voltado pronto). Na placa o assado só é enviado. Conferir no PC do dono
(pendência 2).

## Resolução dinâmica (item 4)

`motor/resolucao.js` e `motor/quadro.js` (só conferidos): no estado 'livre' do jogo o controle pelo cronômetro da
placa mira 15,5 ms com os degraus de 70%, 80%, 90% e 100% da nativa; ?pr= e o estado 'teste' travam (a bancada); a
nitidez é o maior entre a ampliação para a tela (`forcaCas`) e a queda abaixo do nominal (`resolucao.cas`). Os testes
do motor cobrem. Com a placa a 46,6 ms na vista do jogo, nem 70% (~23 ms) chegava aos 15,5; com o terreno de agora a
conta fica perto do alvo no degrau de baixo, o que só a bancada confirma.

## Visual (A/B, 1376 x 768, ?q=pc&pr=1, mesma câmera)

Diferença por pixel, 0 a 255 (o maior dos três canais):

| par | média | p99 | máx | pixels acima de 8 |
|---|---:|---:|---:|---:|
| abertura do jogo | 1,73 | 7 | 53 | 0,46% |
| aberta às 10h | 1,50 | 6 | 63 | 0,37% |
| aberta às 17h30 | 1,22 | 5 | 88 | 0,33% |
| chão a 50 m perto da Vila | 1,11 (o chão: 0,62, p99 1) | 16 | 135 | 1,89% |

Os máximos são das copas ao vento e das bordas de prédios; nos recortes 1:1 (morros, Vila e lago, rio) não há perda
de detalhe nem mudança de cor. Pares em `ab/par-*.png` (60% do tamanho) e recortes em `ab/recorte-*.png`.

## Memória e carga

- Mapa assado: 42,7 MiB (4.096², RGB565) para 256 MiB (8.192² RGB565 e o relevo R8, com mipmaps): +213 MiB. O PC do
  dono mediu 363 MB de memória de vídeo; o teto da D66 é 2,5 GB.
- O Alta passa a assar como o 'pc': o teste da integração ("perfil 'pc' ... as tabelas dos domínios dão a ele o que dão
  ao Alta") exige o mesmo valor nas duas linhas de PERFIL_TERRENO.
- Carga no SwiftShader: pronto de 53 s para 85 s. O assado inteiro custa 4 vezes o de antes, e na Nova partida ele
  roda 2 vezes (antes também): o espelho troca o terreno (um T novo) a ~6 s e de novo a ~43 s, e cada troca remonta e
  reassa tudo (montarTudo).

## Testes

- `ferramentas/testes/terreno.teste.mjs` (34): 6 novos da PC3 (os três programas e o que cada um carrega; os ramos
  caros só onde o peso não é zero; o assado de 1 m e o alcance do relevo; o atlas do ambiente igual à conta do
  textureCubeUV; os nós do meio de frente para trás e o material do meio seguindo o de perto; os amostradores sem
  passar os de antes) e 3 ajustados.
- `ferramentas/testes/motor.teste.mjs` (61): 3 novos (compilação adiantada no alvo de cada uso; as ferramentas com a
  geometria do uso e o aquecimento da via; o disco de Vogel dando as mesmas amostras).
- `ferramentas/testes/geracao-arvores.teste.mjs` (20): 1 novo (sombra e assado das árvores pequenos e compilados antes
  do uso) e o da memória do assado ajustado.
- `node ferramentas/simular.mjs --testes`: todos ok, guarda de texto ok. `node ferramentas/montar.mjs --saida
  <scratchpad>/novo/PC3/montagem-repo`: sem aviso.

## Arquivos

- `fonte/render/materiais/shaders/terreno.glsl.js`
- `fonte/render/materiais/shaders/sombra.glsl.js` (PCF)
- `fonte/render/mundo/terreno.js`
- `fonte/render/mundo/vegetacao.js` (só o assado dos impostores e a compilação adiantada dos programas)
- `fonte/render/mundo/vias.js` (só o aquecimento)
- `fonte/render/sobreposicoes/ferramentas.js` (só o aquecimento)
- `fonte/render/motor/quadro.js` (Aquecimento.compilar)
- `ferramentas/testes/terreno.teste.mjs`, `motor.teste.mjs`, `geracao-arvores.teste.mjs`

## Pendências

1. **Bancada no PC do dono**: o terreno na vista do jogo e na aberta. Pela proporção, ~19 ms e ~10 a 14 ms, acima das
   metas de 12 e 8. Próximos cortes, pela ablação de depois: menos amostras de PCF de longe (os ganchos de sombra, que
   valem para todos os materiais), o caminho completo das paredes e a luz do ambiente; a resolução dinâmica cobre parte.
2. **msBloqueio de 'arvore-sombra' e 'arvores:assar-impostores' no D3D11** (meta abaixo de 200 ms): o SwiftShader não
   reproduz o caso.
3. **Tempo de carga no PC do dono** com o assado de 8.192² (4 vezes o de antes, 2 vezes na Nova partida). Se pesar, o
   integrador vê por que o espelho troca o terreno duas vezes na carga (fora dos arquivos da PC3) ou o perfil volta ao
   assado de 4.096² (perde-se o ganho do passo 3).
4. O Alta (placas médias) também ficou com o assado de 8.192² e +213 MiB, pela regra do teste da integração. Se o
   integrador quiser o Alta em 4.096², a regra do 'pc' igual ao Alta muda no contrato e no teste (não são da PC3).
5. A PCF de Vogel em constantes mexe na sombra de todos os materiais (a mesma conta, com teste); vale um olhar nos
   prédios na próxima bancada.
6. O roteiro das ferramentas (ferr.mjs) e a medida do passe do terreno (medir.mjs) ficaram no scratchpad; se o
   integrador quiser, viram cena da bancada ou teste do testar.mjs (não são da PC3).
7. Registrar a PC3 no `docs/PROJETO.md` (não editado).

## Revisão adversarial (depois da entrega)

Corrigido nos arquivos da PC3:

1. **Divisão dos nós em 3D** (`dividirNos`, terreno.js). O corte do caminho barato e o do detalhe mediam só a
   distância no chão; o sombreador mede em 3D (vTer.z). Agora, com a câmera acima do topo do nó (o máximo da pirâmide;
   o chão desenhado só desce dele, perto d'água), a altura dela sobre o topo entra na conta. Com a câmera abaixo do nó,
   segue só a distância no chão (conservadora). A imagem é a mesma por construção (o peso do caminho completo já era
   zero nesses pixels) e o teste segura que o chão nunca fica mais perto que a conta. Também tira uma emenda: com a
   câmera alta olhando para baixo, um nó "de perto" pelo chão ficava sem o relevo das copas (o de perto não lê o
   assado de relevo) ao lado de nós do meio com ele.
   Medida (SwiftShader, só o passe do terreno, 2070 x 1001, mínimo de 3, mesma câmera, a montagem da entrega contra a
   revisada):

   | vista | nós perto / meio / longe | entrega (ms) | revisada (ms) | ganho |
   |---|---|---:|---:|---:|
   | jogo | 0 / 39 / 43 contra 0 / 24 / 58 | 1.739 a 1.793 | 1.572 a 1.575 | -10% |
   | aberta | 0 / 18 / 45 contra 0 / 13 / 50 | 1.327 a 1.350 | 1.310 a 1.320 | -2% (no ruído) |

   Na placa o ganho tende a ser maior: o programa do meio é bem maior que o de longe (registradores e ocupação), mesmo
   com os ramos pulados. Os 24 nós do meio que sobram na vista do jogo são as encostas íngremes (a projeção lateral).
2. **Compilação adiantada antes do primeiro quadro** (`Aquecimento.compilar`, quadro.js). Se o GLSL das árvores
   chegasse antes do primeiro quadro, os programas compilavam na tela, sem o tom e sem a luz do ambiente (chave
   diferente), `programasProntos` virava true e o primeiro desenho compilava de novo, na hora (o caso dos 2,2 s).
   Agora o pedido espera o primeiro quadro. Teste novo no motor.
3. **Leve sem programa duplicado** (`seguirMestre`). Sem as camadas do chão (Leve), o meio e o de perto têm os mesmos
   defines: a chave agora é a mesma e o three usa um programa só (antes compilava dois iguais no aparelho mais fraco).
4. **Assado de 8.192² só com a placa que aceita** (`limitarAssado`). O WebGL2 só garante MAX_TEXTURE_SIZE de 2.048;
   numa placa de 4.096 o alvo de 8.192² falhava (chão sem cor). Agora cai para o maior lado aceito, sem o assado de
   relevo e com a encosta de antes. Teste novo.
5. Comentário errado: inclinação 0,2 a 0,45 é uma encosta de uns 37 a 57 graus (estava "20 a 45 graus").

Testes: terreno 36 (2 novos), motor 61 (o de compilação adiantada cobre o adiamento), `simular.mjs --testes` inteiro
ok, `montar.mjs --saida` sem aviso. Capturas A/B da revisão em `novo/PC3-rev/par-*.png`.
A/B da revisão (1376 x 768, ?q=pc&pr=1, entrega contra revisada): abertura do jogo média 0,77/255 e p99 6; a 900 m
da Vila (inclinação 25 graus, perto, meio e longe na tela) média 1,42 e p99 16. O mapa da diferença mostra que ela
fica toda na água (as ondas andam entre as capturas); no chão, nada. 0 compilações depois de pronto nas duas.
