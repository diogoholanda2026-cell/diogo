# Nota de entrega da R3b (gente, caminhões e fluxo), onda 3, etapa 3

Entregue em 03/10/2026, retomada depois da pausa (o parcial do commit "Pausa: R3b e U2a em andamento" foi conferido,
revisado e terminado; nada recomeçou do zero).

## O que entrou

- **Carros (`render/mundo/trafego.js`, herdado da R3a).** Fila por faixa reescrita: a velocidade é a que ainda para no
  espaço livre com a frenagem de conforto (3 m/s², contando a velocidade do da frente) e o passo nunca passa da folga
  da fila. Era o defeito do teste 14 da geracao-vias (o carro de trás freava pela folga linear, a 6 m/s², e entrava no
  da frente com quadro longo): corrigido na fila, sem mexer no ponto da cena. Quem faz a curva do nó está nas duas
  filas (a de onde sai e a para onde vai).
- **Prioridade entre os braços (pendência da I1).** A vez é uma reserva no nó: só cruza quem tem a curva longe da
  curva de quem está dentro (poligonal de 8 trechos, com a varredura da carroceria no raio da curva) e de quem pediu
  antes; ordem de chegada, a principal na frente sem semáforo e a conversão à esquerda atrás. No semáforo só pede quem
  tem o verde; o bolsão: quem espera na retenção ainda sai no amarelo e, virando à esquerda, nos 3 primeiros segundos
  do vermelho (sem isso, a esquerda de uma avenida cheia esperava mais de um ciclo). Faixa de destino pela virada (em
  frente vindo de faixa única, sorteada entre as faixas); à esquerda da faixa da direita quase nunca. O carro não entra
  numa faixa sem lugar nem na faixa de pedestres ocupada.
- **Fluxo (S1c, quando `espelho.fluxos` existe).** Densidade por aresta pelo fluxo e pela velocidade (carros por km =
  fluxo / velocidade) e a saída do nó sorteada pelo fluxo do braço naquele sentido; sem fluxo, a heurística da R3a.
  A amostra fica cheia perto da câmera: com o teto abaixo dos carros esperados, o sorteio pesa a distância ao alvo, o
  carro nasce fora do LOD0 (não brota à vista) e quem está longe sai aos poucos. Na cena rua, a 150 m da vista: 30 a
  37 carros de 44 a 75 esperados (antes, 19 a 27).
- **Realce da aresta selecionada (pendência da I1, `render/mundo/vias.js`).** Bit G da tabela pelo evento `selecao`
  (`{ tipo, ref }`), apagado quando a aresta morre ou a vaga é reaproveitada. Na revisão: o domínio lia
  `ctx.sobre.selecao`, que o render não preenche, e apagava o realce a cada passo da simulação; agora guarda a última
  seleção do evento (teste de domínio novo).
- **Gente (`render/geracao/pessoas.js`, `render/mundo/pedestres.js`, `shaders/pessoa.glsl.js`).** Figura de 1,70 m
  com silhueta real (cabeça, pescoço, tronco com ombro, cintura e quadril, braços com mão, pernas com joelho e pé):
  LOD0 de uns 270 triângulos, LOD1 de 30; caminhada no vértice (perna no quadril, joelho, braço no ombro, o corpo sobe
  no passo), silhueta feminina por instância, 5 tons de pele reais, cabelo (4 cores, longo), roupas em tons de rua
  (sem verde-lima), saia, bermuda, manga longa e bolsa; altura de 1,55 a 1,90 m. Gente pela atividade de
  `espelho.predios` (moradores, empregos e clientes do comércio) e pela hora por família de zona, nascendo e entrando
  nas portas (agora só some numa porta da calçada, não no meio dela); faixa de andar longe do meio-fio, mantendo a
  direita; duplas e gente parada na porta; atravessa só na faixa de pedestres (no vermelho dos carros, se dá tempo; sem
  semáforo, sem carro vindo) e o carro espera. Tetos: Média 420, Alta e 'pc' 900, Ultra 1.600, Leve 150; até 250 m.
- **Caminhões (`render/geracao/caminhoes.js`, novo, e `render/mundo/caminhoes.js`).** Caminhão médio de cabine
  avançada (6x4, 8,6 m) em 4 carrocerias pela carga: basculante com o monte (brita, areia, argila, calcário), carroceria
  com um palete por unidade (tijolo, cimento, aço, vidro, madeira), betoneira com o balão listrado girando (concreto) e
  baú; cabine da cor da Holding, branca no frete contratado (entregas visuais). Seguem o `caminho` da entrega no ritmo
  da viagem da simulação (a mesma velocidade da logística da S3a, via vezes 0,9): perto da câmera andam no trânsito
  (fila, semáforo, vez), longe ou na curva vão na posição da viagem. LOD0 de 288 a 524 triângulos, LOD1 de 18; uma
  chamada por carroceria e LOD que aparece.
- **Cena `rua`.** Vistas novas: `fila` (a chegada ao cruzamento; adianta até o fim de um vermelho com 3 carros parados
  na chegada pelo oeste, no máximo 240 s; o resultado traz `fila`) e `caminhao` (comboio de brita, tijolo, areia e
  concreto pela avenida, a câmera junto do segundo). Povoa gente e caminhões, adianta 40 s (com a amostra mantida:
  nasce e sai gente e carro como no jogo) e mede tudo no resultado.
- **Desempenho (CPU, Node, cena rua, 18h).** Na revisão: distância entre poligonais em quadrados com parada no limite,
  chaves numéricas de faixa, listas e entradas das filas reaproveitadas e a matriz das instâncias montada direto
  (`matrizGiroY`, sem quatérnio). Alta/'pc' (240 carros, ~560 pessoas): tráfego de 1,15 para 0,7 ms e gente de 0,69
  para 0,52 ms por quadro; Média (120 carros, ~340 pessoas): 0,36 e 0,4 ms. Depois da revisão adversarial (sem objeto
  novo por carro e por quadro, o semáforo do braço guardado na saída, a chave da faixa de pedestres em número e o u da
  calçada guardado na pessoa): Alta/'pc' 0,58 e 0,47 ms, Média 0,3 e 0,25 ms. Ainda acima dos 0,5 ms da linha
  "Carros / pessoas" do desenho do render (2.10): medir no PC do dono.

## Como foi testado

- `node ferramentas/simular.mjs --testes`: verde em tudo o que é da R3b e herdado dela, inclusive o teste 14 da
  geracao-vias (tráfego) no cruzamento novo (1082,3; 529,4) e na rua sem saída. Na última rodada só o `contratos`
  falhou, pelo `Math.tan` em `fonte/sim/arcologia.js:211`, arquivo da X1b em andamento (não é da R3b); antes dessa
  mudança da X1b a rodada inteira passou.
- `ferramentas/testes/vida-rua.teste.mjs` (9 testes): prioridade no cruzamento sem carro dentro de carro em 300 s (na
  curva e na fila) na cena rua e nas ruas do bairro sul, com a gente junto; fila e vez (velocidade segura, virada,
  faixa de destino, poligonais, fluxo, semáforo, matriz das instâncias); caminhão seguindo o caminho da entrega aresta
  por aresta até o fim (duas entregas da cidade sintética); caminhões gerados; figura e aparência; gente na calçada
  (pela hora, na faixa de andar, atravessando só na faixa sem carro a menos de 1,8 m); realce (puro e no domínio);
  materiais sem mediump.
- Fora dos testes (rascunhos em `r2/`): 300 s em 5 lugares e 4 perfis (Média a Ultra, 8h a 18h) sem nenhuma
  sobreposição; sem trava permanente perto da câmera em 600 s (no pico da Ultra, gargalos de avenida para rua seguram
  carros até ~60 s e andam).
- Montagem: `node ferramentas/montar.mjs --saida <temp>` só com o aviso A1. JS principal 1.989,4 KB; a R3b soma
  38,8 KB nele (medido montando a mesma árvore com os arquivos da R3b da base: 1.950,6 KB), a lógica dos domínios
  trafego, pedestres e caminhoes; geradores e GLSL de gente e caminhão sob demanda.

## Bancada (aberta, 1376 x 768)

`node ferramentas/bancada.mjs --cenas aberta --perfis pc,media --quadros 12` (os mesmos 12 quadros da medida de antes,
na base 9b001b5):

| perfil | antes (base) | depois |
| --- | --- | --- |
| 'pc' | 70 chamadas, 483 mil tri (sombra 14 / 166 mil), vida 616 | 70 chamadas, 478 mil tri (sombra 14 / 163 mil), vida 484 |
| Média | 59 chamadas, 232 mil tri (sombra 7 / 34 mil), vida 748 | 59 chamadas, 232 mil tri (sombra 7 / 34 mil), vida 484 |

Na vista aberta a vida quase não pesa (a gente só até 250 m, o carro pela amostra perto do alvo). Programas: 58 para
61. As duas falhas da bancada são os dois `ShaderMaterial` que não ligam, iguais na base. Avisos: 6 programas
compilados depois de pronto (arvore-lod0, arvore-lod1, arvore-impostor e edificio, que aparecem também montando a
árvore de agora sem a R3b, e pessoa e caminhao, da R3b): os módulos sob demanda chegam depois da rodada final do
aquecimento com a máquina ocupada (a base, na mesma hora, deu 0). A R3b agora pede uma rodada a mais quando o modelo
chega tarde (como as árvores) e os domínios `pedestres` e `caminhoes` publicam `pronto()`; ver pendências.

Cena `rua` no 'pc' (as capturas): rasante 10h 97 chamadas e 570 mil tri (vida 25 mil), rasante 18h 97 e 582 mil
(vida 37 mil, 240 carros e 458 pessoas), fila 76 e 310 mil, caminhão 89 e 527 mil. Média, cena rua no Node (CPU):
0,36 ms de tráfego e 0,2 a 0,4 ms de gente por quadro.

## Capturas

Em `cap-final/` (1376 x 768, ?q=pc, `node ferramentas/testar.mjs --consulta "cena=rua&q=pc&..."`):

- `rua-10h.png` (`hora=10`, rasante): a avenida comercial de manhã, gente nas calçadas e na esquina, pouco carro (o
  fluxo da cidade sintética às 10h dá uns 0,8 carro por 100 m de faixa).
- `rua-18h.png` (`hora=18`): o pico, com carros na faixa, gente em grupo na esquina e o entardecer.
- `fila-18h.png` (`vista=fila&hora=18`): 3 carros parados no vermelho com a luz de freio, gente na calçada; a cena
  adiantou 224,5 s até a fila formar.
- `caminhao-10h.png` (`vista=caminhao&hora=10`): o caminhão de tijolo da Holding (carroceria com os paletes) entrando
  na avenida, outro do comboio atrás, carros freando no outro sentido.

Para o dono ver: de perto, com o sol baixo atrás da câmera, a traseira lisa dos carros da R3a reflete o sol como um
bloco claro (`rua-18h.png`); é o modelo dos carros (geracao/veiculos.js), não mexi.

## Pendências para o integrador

- Aquecimento (D66): pôr `pedestres` e `caminhoes` em `AQUECER.dominios` (motor/quadro.js) para a rodada final esperar
  o modelo e o GLSL sob demanda deles (os dois publicam `pronto()`); hoje, com a máquina ocupada, os programas pessoa
  e caminhao compilam numa rodada extra depois de pronto. As árvores e o edificio têm o mesmo atraso na árvore de agora
  (sem a R3b também), contra 0 na base: conferir na integração.
- `render/geracao/caminhoes.js` é arquivo novo da R3b (modelo e GLSL do caminhão, sob demanda): pôr na árvore da 3.1.
- JS principal: +38,8 KB da R3b (a C1 decide; os corpos dos domínios poderiam ir sob demanda como os geradores).
- Os dois `ShaderMaterial` que não ligam na bancada já falham na base (9b001b5), sem dono; não são da R3b.
- `espelho.fluxos` só existe na cidade sintética (`{ versao, ida, volta, vel }`, o contrato); no jogo, sem a S1c, os
  carros seguem a heurística da R3a.
- A figura tem uns 270 triângulos no LOD0 (o desenho 8 fala em ~200) e 30 no LOD1 (24): o teto do teste é 300 e 32.
- `cap/` e `dbg-*.mjs` na pasta da R3b são rascunhos de antes da pausa; as capturas finais estão em `cap-final/` e os
  rascunhos da retomada em `r2/` (bancadas, logs e scripts de depuração).

## Revisão adversarial (03/10/2026)

- **Caminhada:** o braço balançava junto com a perna do mesmo lado (o passo de camelo) e o corpo subia no passo
  largo, tirando os dois pés do chão (o da frente a 7 cm). Corrigido em `shaders/pessoa.glsl.js`: o braço vai à frente
  com a perna do outro lado e o corpo desce 1,5 cm no apoio duplo. Teste novo lê os números do próprio GLSL e confere
  a fase do braço e o pé no chão.
- **Gente sumindo à vista:** quem passava do alvo (a câmera andou, a hora mudou) ou chegava ao fim do trajeto numa
  calçada sem porta sumia no meio da calçada, mesmo na frente da câmera. Agora só some assim fora do LOD0; perto,
  entra numa porta.
- **Heurística do M1a sem teste:** o teste de 300 s só rodava com `espelho.fluxos` (que o jogo não tem antes da S1c);
  ganhou o caso sem fluxos no pico da tarde. Conferido também fora do teste: Média, Alta e Ultra, 8h e 18h, passo de
  0,1 a 0,4 s (velocidade 4), com e sem fluxos, em três lugares: nenhuma sobreposição e nenhum NaN.
- **CPU:** ver Desempenho acima (cerca de 20% a menos).
- Pendência nova: o índice fixo do worker da oficina (`mundo/oficina.worker.js`, do integrador) importa
  `geracao/pessoas.js` só pelo `registrar()` vazio; com a figura nova são uns 14 KB de fonte num worker de 230,5 KB
  (teto 250). Pode sair do índice: a figura só é usada na thread principal, sob demanda.
