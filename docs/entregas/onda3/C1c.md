# C1c: calibração da Arcologia e da entrada na D48 (D92), nota de entrega

Resultado: o A2 ("o robô que pula a Arcologia termina mais pobre", cidade da S2a, 6 h) ficou verde sem mexer no teste.
Na semente do teste: riqueza 26.950 contra 22.653, Contribuição 258.378 contra 211.656 (1,22 vez), moradores 10.330
contra 8.079. Em 6 sementes a riqueza fica maior em todas e a Contribuição e os moradores ficam maiores na média (1,11 e
1,12); em 12 sementes também (12 de 12; 1,09 e 1,07). `simular --testes` inteiro verde, `--determinismo` ok, robô
robo-1 de 2, 6 e 12 h com todas as metas A4 do M1a dentro, A8 ok (no Node e no Chromium, hash igual). Nada commitado.

**Aviso honesto:** a média da razão da Contribuição é de 1,09 a 1,11 e o desvio entre sementes é de uns 0,2. O 1,22 da
semente do teste está dentro do ruído: com a lago.e1 a 15 mil ou a 25 mil a mesma semente dá 1,07 e 1,01 (as médias
ficam iguais, 1,13). O A2 de uma semente só vai virar de novo com mudanças que não têm nada com a Arcologia (o sistema
é caótico: qualquer mudança no número de sorteios muda a partida inteira). Recomendo ao integrador trocar o critério
da Contribuição por média de 6 sementes pelo menos igual (que esta calibração cumpre com folga) ou rodar o A2 em 3
sementes; deixo a decisão com ele (o teste não foi tocado).

## 1. O que mudou (antes e depois)

| arquivo | número ou regra | antes | depois | por quê |
|---|---|---|---|---|
| data/arcologia.js | créditos lago.e1 / torre.e1 / e2 / e3 / e4 | 60 / 150 / 300 / 350 / 250 mil | 20 / 50 / 100 / 115 / 85 mil | um terço: a cidade do M1a rende 4 mil por hora aos 0:20 e 25 a 35 mil por hora com 6 a 9 mil moradores em 6 h; a lago.e1 a 20 mil custa pouco mais que uma captação (15 mil, 5 mil moradores) e dá água para 6 mil, os portões e 300 XP |
| data/arcologia.js | XP, materiais, minutos, efeitos; etapas do M2 | | iguais | o XP da lago.e1 não ajudou (seção 4); o teste `obra` pede pelo menos 300 |
| sim/holding/mercado.js | entrada da D48 | do marco 3, a obra de nível 3 a 5 compra só da Holding todo item | só os itens da cadeia da Holding (`ITENS_DA_CADEIA`: o prédio dono está em `HOLDING_M1A`, no M1a brita, areia, argila, tijolo e concreto); cimento, vidro, aço e serrada a obra importa sozinha, como nos níveis 1 e 2, até a fábrica deles entrar | a Holding do M1a só importava esses a 160% para vender a 100% (perda pura, sem produção que a cidade espere); com o marco 3 mais cedo pela lago.e1 isso derrubava o caixa na hora errada |
| ferramentas/robo/robo-sim.mjs | dívida do ano 3 em diante | uma parcela sempre que o caixa passava de 12 mil mais parcela e juros; quitava quando dava | calendário: no máximo uma parcela a cada 2 meses em 2022 e uma por mês de 2023 em diante (folga de 5 mil), quita quando o caixa cobre a dívida de 2023 em diante | jogar melhor: o prêmio do marco 4 (40 mil) ia inteiro para a dívida de 10% ao ano (5% por hora de jogo) e as quadras paravam no ano 3; a dívida segue quitada antes de 2025 |
| ferramentas/robo/robo-sim.mjs | Arcologia recusada | tentava `arcologia.iniciar` a cada rodada e guardava estoque para ela | com 'trancado', solta a reserva de estoque da etapa e não tenta mais | o robô sem a Arcologia não guarda brita e areia para uma obra que não sai (sem efeito medido nas partidas: a cidade não compra brita nem areia) |

As regras do dono não mudaram. A D48 segue igual para o concreto (o teste `holding` do mercado passa sem mudança: no
marco 3, sem Concreteira, a Holding importa o concreto a 160% e vende a 100%; desligada, a obra espera).

## 2. A2 em 6 sementes (6 h, mesma estratégia, com e sem a Arcologia)

Antes (código do começo desta tarefa, igual à revisão da C1a):

| semente | riqueza com / sem | Contribuição com / sem | razão | moradores com / sem | marco |
|---|---|---|---|---|---|
| robo-arco (a do teste) | 83.354 / 18.914 | 171.743 / 212.109 | 0,81 | 6.440 / 8.528 | 4 / 4 |
| robo-1 | 82.385 / 54.932 | 177.890 / 182.614 | 0,97 | 6.691 / 6.697 | 4 / 4 |
| semente-a | 122.741 / 39.658 | 187.067 / 199.244 | 0,94 | 6.804 / 7.192 | 4 / 4 |
| semente-b | 156.624 / 10.359 | 218.372 / 206.624 | 1,06 | 7.026 / 6.980 | 4 / 4 |
| semente-c | 76.345 / -6.765 | 242.784 / 232.194 | 1,05 | 7.719 / 7.912 | 4 / 4 |
| semente-d | 160.915 / 31.690 | 235.985 / 186.896 | 1,26 | 7.518 / 6.278 | 4 / 4 |

Média da razão da Contribuição 1,01; dos moradores 0,98; riqueza maior em 6 de 6.

Depois:

| semente | riqueza com / sem | Contribuição com / sem | razão | moradores com / sem | marco |
|---|---|---|---|---|---|
| robo-arco (a do teste) | 26.950 / 22.653 | 258.378 / 211.656 | 1,22 | 10.330 / 8.079 | 4 / 4 |
| robo-1 | 70.926 / 44.582 | 221.551 / 190.952 | 1,16 | 8.357 / 6.715 | 4 / 4 |
| semente-a | 83.681 / 39.650 | 261.453 / 201.053 | 1,30 | 8.070 / 7.577 | 4 / 4 |
| semente-b | 79.487 / 42.761 | 200.640 / 247.102 | 0,81 | 6.524 / 9.214 | 4 / 4 |
| semente-c | 79.037 / 48.414 | 206.535 / 226.411 | 0,91 | 7.451 / 7.824 | 4 / 4 |
| semente-d | 15.157 / -16.469 | 218.773 / 175.479 | 1,25 | 8.173 / 5.662 | 4 / 3 |

Média da razão da Contribuição 1,11 (soma com / soma sem 1,09); dos moradores 1,12 (1,09); riqueza maior em 6 de 6
(menor folga: 4.297, na semente do teste).

Mais 6 sementes (mesmo código):

| semente | riqueza com / sem | Contribuição com / sem | razão | moradores com / sem | marco |
|---|---|---|---|---|---|
| semente-e | 13.378 / -5.773 | 179.414 / 231.811 | 0,77 | 6.139 / 7.726 | 3 / 4 |
| semente-f | 69.898 / 20.044 | 197.171 / 203.260 | 0,97 | 6.800 / 6.611 | 4 / 4 |
| semente-g | 74.129 / -14.171 | 191.140 / 163.368 | 1,17 | 7.046 / 5.739 | 4 / 3 |
| semente-h | 66.326 / 28.809 | 190.647 / 231.499 | 0,82 | 6.560 / 8.539 | 4 / 4 |
| semente-i | 87.537 / 20.072 | 278.587 / 193.218 | 1,44 | 8.337 / 7.116 | 4 / 4 |
| semente-j | 67.124 / -12.616 | 213.583 / 175.718 | 1,22 | 6.691 / 6.032 | 4 / 3 |

12 sementes: razão média da Contribuição 1,09 (soma 1,07), dos moradores 1,07 (soma 1,04), riqueza maior em 12 de 12.

Por que agora a Arcologia paga: a lago.e1 a 20 mil sai aos 0:20 sem derrubar o caixa da primeira hora; a água para 6
mil tira o teto da água (sem ela, a cidade fica nos 30 de oferta da primeira captação até a segunda, de 1:00 a 2:30
em metade das 12 sementes) e os 300 XP adiantam os marcos 2 e 3 (prêmios de 20 e 30 mil mais cedo; o marco 3 vem em
média aos 1:06 contra 1:24); o marco 3 mais cedo não pune mais porque a D48 só cobra o que a Holding faz; e o marco 4,
que a cidade com a Arcologia alcança antes em 8 de 12 sementes, vira quadra em vez de dívida. A riqueza ficou firme
porque a dívida no fim das 6 h deixou de ser sorte: com o pagamento em rajada, a diferença de dívida entre as duas
partidas chegava a 110 mil e decidia a riqueza (a Holding fica em 90 a 100 mil e o caixa em 5 a 25 mil nas duas).

Médias por lado (6 sementes): com a Arcologia a Contribuição foi de 205.640 para 227.888 e os moradores de 7.033 para
8.151; sem ela, de 203.280 para 208.776 e de 7.265 para 7.512 (as mudanças da D48 e da dívida também ajudam quem pula a
Arcologia, menos).

## 3. Robô robo-1 (metas A4 do M1a, sem comprar tempo)

| meta | alvo | 2 h | 6 h | 12 h |
|---|---|---|---|---|
| marco 1 | perto de 0:14 | 0:14 | 0:14 | 0:14 |
| marco 3 | antes de 1:30 | 0:59 | 0:59 | 0:59 |
| marco 4 | (sem meta) | | 4:05 (era 5:59) | 4:05 |
| moradores | | 3.080 (era 2.816) | 8.357 (era 6.691) | 8.842 (era 6.873) |
| empréstimo | só 2020 e 2021 | 2020: 50 mil | 2020 e 2021: 50 mil cada | idem |
| dívida máxima | até 500 mil | 52.087 | 112.578 | 112.578 |
| quitada antes de 2025 | sim | sem medida | 54.030 no fim (2022) | zero; última dívida em 2024 |
| caixa na primeira hora | não zera, até 1 empréstimo | dentro (56.474 com 1 h) | dentro | dentro |
| sempre um objetivo aberto | sim | sim | sim | sim |
| erros | [] | [] | [] | [] |
| tique p95 / p99 / máximo (ms, os 3 juntos nos 4 núcleos) | | 4,2 / 8,0 / 17,4 | 1,5 / 5,9 / 18,2 | 1,1 / 4,5 / 25,9 |

O caixa mínimo foi 175 aos 1:18 (era 15.023 aos 1:23): depois do marco 3 o robô gasta até o fim da folga das quadras,
sem zerar (zerado por 0 min, D41). O robô de 12 h fica no marco 4 com 12.347 XP e não chega à torre.e1 (pede 50 mil
mais o aço importado e 40 mil de reserva); o marco 7 em 5 a 7 h continua fora, como na C1a.

## 4. O que medi e não adotei

- **Só os créditos** (D48 e robô como antes): lago.e1 a 10, 20, 30 e 45 mil dão razão média de 1,04 a 1,16 e riqueza
  maior em 4 ou 5 de 6; o que decidia a riqueza era a dívida paga no ano 3 (seção 2).
- **Créditos em um terço sem a D48 por item:** razão média 1,01, moradores 0,99 (fora do critério); semente do teste 0,97.
- **XP da lago.e1** (com o resto da calibração final), razão média da Contribuição, semente do teste e riqueza maior:
  300 dá 1,11, 1,22 e 6 de 6; 400 dá 1,17, 1,05 e 5 de 6; 500 dá 1,13, 1,04 e 5 de 6; 600 dá 1,07, 0,99 e 4 de 6; 800
  dá 1,19, 1,26 e 3 de 6; 1.000 dá 0,96, 0,92 e 6 de 6. Sem tendência, e a riqueza perde a firmeza: fica 300 (o teste
  `obra` pede pelo menos 300).
- **Reservatório só quando a água chega a 80%** (no lugar da segunda captação): perde o XP e a água do começo, razão 0,99.
- **Usina e captação no teto da rede com o caixa que houver:** a cidade de quem pula a Arcologia piorou (média da
  Contribuição em 6 sementes de 203 para 190 mil; com a D48 por item, de 209 para 198 mil).
- **Juros todo mês e uma parcela a cada 2 ou 3 meses no ano 3:** a cidade parou mais (12 sementes, média sem a
  Arcologia de 203 para 190 mil) e a semente do teste ficou em 1,18 e 1,19.
- **Nada de dívida paga no ano 3:** a semente do teste passa, mas a meta de 12 h quebra (43 mil de dívida no fim,
  última em 2025).
- **Reserva de estoque da etapa só perto do caixa total dela:** a semente do teste foi para 1,00; mantive a regra da C1a.

## 5. Testes e medidas

- `node ferramentas/simular.mjs --testes`: guarda de texto ok (337 arquivos); 33 arquivos ok, `arcologia` em 35 s com o
  A2; `testes ok`.
- `node ferramentas/simular.mjs --determinismo`: ok (3 pontos iguais, save no meio e o livro reproduzido).
- `node ferramentas/robo/a8.mjs --node`: tique 1.800, marco 1 (559 XP), 442 moradores, 18 comandos, ok; no navegador,
  seção 6.
- As 12 sementes da seção 2 rodaram de novo no código do repositório (as 6 primeiras com 4 processos, as outras com
  1): os mesmos números da cópia de trabalho.
- `node ferramentas/simular.mjs --bancada`: FORA das metas do A5 como antes (a cidade sintética tem 141 mil moradores e
  não 30 mil, pendência 2 da S2a); igual com e sem esta mudança: p95 4,10 ms contra 4,11 na cópia sem ela.
- `node ferramentas/montar.mjs --saida <scratchpad>/C1c/montagem`: sem avisos, jogo 2.049,7 KB (gzip 726,4 KB, teto 2.355).
- Scripts e partidas em `scratchpad/novo/C1c/` (`scripts/exp.mjs` uma partida, `scripts/lote.mjs` as sementes em
  paralelo, `res/<rodada>/` cada partida com a série de meia em meia hora).

## 6. A8 no navegador

`node ferramentas/robo/a8.mjs --pasta <scratchpad>/C1c/montagem --tam 480x270`: A8 ok. Tique 1.800, marco 1 (559 XP),
442 moradores, caixa 187.945, 18 comandos no livro, 10,1 min reais, 2,97 tiques por segundo; hash 2685854081 no
navegador e no Node. A meia hora do A8 não chega à lago.e1 nem ao marco 3, então a calibração não muda essa partida.

## Pendências

1. **Integrador (teste):** não pude mexer nos testes. Proposta para `ferramentas/testes/holding.teste.mjs` (passa com a
   mudança e falha sem ela): `scratchpad/novo/C1c/proposta/d48-cadeia.teste.mjs` (vidro, aço e cimento não pesam no
   caixa da Holding nem fazem a obra esperar; o concreto e o tijolo seguem a D48 e o aviso).
2. **Integrador (A2):** o critério de 1,2 vez numa semente está dentro do ruído (seção 2 e aviso); trocar por média de
   6 sementes pelo menos igual, ou 3 sementes, para o teste não virar com mudanças alheias.
3. **PROJETO (integrador):** D48, acrescentar "a dependência vale para os itens da cadeia da Holding na parte que se joga
   (no M1a, brita, areia, argila, tijolo e concreto); cimento, vidro, aço e serrada a obra importa sozinha até a fábrica
   deles entrar"; D52 diz "lago.e1 (60 mil, ...)": agora 20 mil; D92: registrar os créditos em um terço. A tela Holding
   segue mostrando a demanda da cidade por todos os itens (`cidadeHora`), mas o aviso e o `esperando` só os da cadeia.
4. **Dono (já pendente da C1a):** a manutenção das 24 avenidas internas da sede (uns 1.240 por hora com a lago.e1
   pronta) ainda cai na conta de vias da cidade; entra no custo da Arcologia?
5. **Etapas do M2** (`ETAPAS_M2`): créditos de partida intocados (900 mil no Meridian); calibrar quando o M2 jogar.

## Arquivos

fonte/data/arcologia.js, fonte/sim/holding/mercado.js, ferramentas/robo/robo-sim.mjs.
