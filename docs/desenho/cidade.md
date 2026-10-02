# A cidade de 500 mil e o fluxo de pessoas (D71 e D72)

Decidido pelo dono em 02/10/2026. Este anexo trata de quem vive, trabalha e passa por Heldópolis: os visitantes, os
trabalhadores que vêm de fora, a moradia social e os aeroportos. O `docs/PROJETO.md` (D71 e D72) manda; aqui está o
detalhe. **Nada disto está no código ainda.** Números são estimativas de projeto, para o dono ajustar.

## 1. Decisões do dono

1. **Capacidade de pico de 10 milhões de pessoas por mês em estadia temporária**, de qualquer tipo: turistas,
   visitantes e gente de passagem rápida. "Turista" deixa de ser a palavra geral; o termo geral é **visitante**.
2. **Trem-bala em túneis, como no Japão**, para trabalhadores de outras cidades irem e virem todo dia.
3. **Moradia social:** das habitações dos 500 mil moradores, as de **100 mil** pessoas são sociais: **50 mil em extrema
   pobreza** e **50 mil de baixa renda**, que compram ou alugam a preços simbólicos.
4. **Dois aeroportos:** um **Internacional** (visitas de fora do país) e um **Nacional** (visitas do país), porque a
   cidade nasce para ser a mais turística do mundo.

## 2. Visitantes

Três classes, todas "estadia temporária". A proposta de composição do pico de 10 milhões por mês:

| Classe | Quem é | Parte | Por mês | Presentes ao mesmo tempo |
|---|---|---|---|---|
| Turista | dorme na cidade (média de 4 noites) | 40% | 4 milhões | uns 530 mil |
| Visitante de dia | vem e volta no mesmo dia (trem, ônibus, carro) | 45% | 4,5 milhões | uns 150 mil ao meio-dia |
| Passageiro em trânsito | conexão no aeroporto ou no porto, poucas horas | 15% | 1,5 milhão | uns 6 mil |

- **Presentes no pico:** uns **700 mil** ao mesmo tempo. A conta antiga (1,3 milhão, que supunha 10 milhões todos
  hospedados por 4 noites) cai pela metade com esta definição.
- **Quartos de hotel:** uns **240 mil** (Las Vegas tem uns 150 mil), com 2,2 pessoas por quarto.
- **Trabalhadores do turismo:** uns **210 mil**, na razão de 0,3 por visitante presente.
- **Ocupação média:** de 55 a 60% do pico, ou uns 5,5 a 6 milhões por mês.
- **Na simulação:** fluxo estatístico por classe (chegadas, permanência, gasto, lotação), e só uma amostra vira gente
  visível na rua. A interface diz "visitantes" e abre nas três classes.

## 3. Trabalhadores de fora e o trem-bala

- **Conta:** uns 400 mil empregos (turismo 210 mil, serviços, saúde, educação, comércio local e Holding 190 mil). Dos
  500 mil moradores, uns 275 mil trabalham. Faltam uns **125 mil**, que vêm de **outras cidades da região**, todo dia.
- **Trem-bala:** inspirado no Shinkansen, com **túneis** pelas serras (o Seikan tem 54 km, o Daishimizu 22 km). Cada
  corredor leva uns 17 mil passageiros por hora e sentido (uns 13 trens por hora, de 1.300 lugares). No pico da manhã
  chegam uns 75 mil por hora (pendulares e visitantes de dia), o que pede **de 4 a 5 corredores**.
- **Estação Central** na esplanada da Sede, estações menores nas áreas Vida e Jogo e as **estações dos aeroportos**.
- **Metrô e trem urbano** ligam as estações às áreas. O que for preciso para os estádios (3 a 4 linhas pesadas, D69)
  e para os pendulares vem **antes** do M4.
- **Fase 1 (até jun 2026):** o primeiro corredor já abre com a cidade, porque os trabalhadores da obra e os pioneiros
  vêm da região.
- **Nome:** fictício, com as características do original (por exemplo, "Trem-Bala Held", com linhas nomeadas).
- **Custo estimado:** de US$ 50 a 100 bilhões, pelos túneis.

## 4. Moradia social (D72)

- **Tamanho:** 100 mil moradores, 20% do total, em uns **33 mil lares**.
- **Duas classes**, com tarifa **simbólica** (D68, em dólar):
  - **Acolhimento** (extrema pobreza, 50 mil): US$ 1 por mês, praticamente subsidiada. A Contribuição à Holding é zero.
  - **Moradia popular** (baixa renda, 50 mil): 20% da tarifa normal, ou uns US$ 100 a 220 por mês. Compra ou aluguel.
- **Integração:** nada de gueto. Os conjuntos ficam misturados aos bairros comuns, com escola, saúde, trabalho e
  transporte perto. A qualidade do projeto é alta.
- **Referências:** Wohnpark Alt-Erlaa e Karl-Marx-Hof (Viena, onde mais da metade mora em moradia subsidiada), Pinnacle@Duxton
  e os HDB (Singapura, uns 80% da população) e Quinta Monroy (Elemental, Chile, moradia que cresce com a família).
- **Escada social:** capacitação e emprego no turismo levam o morador de Acolhimento para Popular e depois para o
  mercado. Cada degrau sobe o Legado. Os 100 mil também fornecem uns 55 mil trabalhadores ao turismo.
- **Custo:** uns US$ 4 bilhões de obra, mais o subsídio anual, que sai de um **Fundo de Moradia** abastecido pela
  Holding e por parte das tranches dos sócios.
- **No jogo:** dois tipos de zona novos (Acolhimento e Popular), com tarifa própria, e metas de Legado.

## 5. Aeroportos

- **Aeroporto Internacional:** de 80 a 100 milhões de passageiros por ano (como Dubai ou Atlanta), com 3 pistas
  paralelas e dois terminais grandes.
- **Aeroporto Nacional:** de 40 a 60 milhões, com 2 pistas (como Haneda, o aeroporto nacional de Tóquio, que tem o
  Narita como internacional).
- **O problema de tamanho:** um aeroporto desses ocupa de 12 a 15 km² (Hong Kong tem 12,5, o Kansai 10,5). Os dois somam
  uns 20 a 25 km², cerca de **30 a 35% do mapa jogável** (8,2 por 8,2 km).
- **Proposta:** os aeroportos ficam na **moldura do mapa** (de 10 a 25 km da cidade, como Narita fica de Tóquio),
  ligados pelo trem-bala, com as **estações dentro do mapa jogável**. O jogador controla capacidade, licenças e
  terminais, mas não desenha pistas. Os aviões aparecem no céu e nas telas (pendência 1).
- **Alternativa:** uma ilha artificial na baía (como Kansai e Chek Lap Kok), dentro do mapa, em escala reduzida.
- **Custo estimado:** de US$ 30 a 50 bilhões os dois.

## 6. Dinheiro, em resumo

Somando o complexo (D69, US$ 81 bilhões), o trem-bala (50 a 100), os aeroportos (30 a 50) e a moradia social (4), são
uns **US$ 200 bilhões**, cerca de 29% dos US$ 700 bilhões do projeto. O resto vai para as moradias dos outros 400 mil,
as vias, as redes e os serviços.

## 7. O que muda no plano

- **M1 e onda 3:** não mudam.
- **Transporte de massa:** trem-bala, metrô e trem urbano vêm antes do M4, junto da série dos marcos.
- **Simulação:** novas classes de visitantes, pendulares por trem, duas zonas de moradia social, o Fundo de Moradia e
  as metas de Legado da escada social.
- **Aeroportos:** se ficarem na moldura, o custo de render é pequeno (estação, aviões no céu e uma tela de gestão).

## Pendências (perguntas ao dono)

1. **Aeroportos na moldura** (recomendo) **ou ilha artificial dentro do mapa**?
2. **Composição do pico** (40% turistas, 45% visitantes de dia e 15% em trânsito) e **tarifa simbólica** (US$ 1 por mês
   no Acolhimento e 20% da tarifa normal na moradia popular) servem como partida?
