# C1a: calibração do M1a e contratos da simulação (nota de entrega)

Resultado: o robô da cidade da S2a cumpre as metas A4 do M1a em 2, 6 e 12 h (marco 1 em 0:14, marco 3 em 1:07,
empréstimo só em 2020 e 2021, dívida quitada em 2023, cidade de 2,8 a 7,5 mil moradores contra os 349 da Vila).
`simular --testes`: 32 de 33 arquivos verdes; **o A2 continua vermelho num critério só** (Contribuição 20% maior com a
Arcologia), e a medida em 6 sementes mostra que com os números da D49 e da D51 ele não fecha em 6 h (detalhe e
recomendação abaixo, pendência 1). Determinismo ok. **A8 ok** no Chromium de teste (tique 1.800, marco 1, hash do
navegador igual ao do Node, 9,8 min reais); ele achou uma consulta que mudava a partida (o `q.barra`), corrigida com
teste. JS principal 2.045,5 KB (teto 2.355 KB). Sem capturas. Nada commitado.

## 1. A Arcologia se paga (A2)

- **Regra (D49):** `economia.valuation` soma o valor da obra (`sim.arcologia.valor()`: créditos pagos e materiais
  entregues). A Contribuição dos moradores de luxo da torre.e3 entra na receita `moradores` (renda por hora e saldo),
  por `sim.arcologia.contribuicaoHora()`, e não mais como `receber(..., 'arcologia')` em separado (o teste dos efeitos
  confere os 4.400 por hora em `q.orcamento().receitas.moradores` e nada em `outras`).
- **Robô:** importa o que a Holding não faz antes de iniciar a etapa (reserva de 40 mil), e durante a obra quando a
  parada é 'material'; espera metade do estoque do que a Holding faz; com o caixa a 60% dos créditos da etapa, reserva
  no estoque (`estoque.reserva`) o que a Holding faz para ela (sem isso a cidade leva tudo pela D48).
- **Teste:** `riqueza = valuation` (era `valuation + valor`, contava a obra duas vezes depois da regra). O cenário passou
  para a cidade da S2a (pendência da X1b; a de faz de conta prendia as duas partidas no mesmo teto de capacidade e dava
  14.429 moradores nas duas). As asserções ficaram iguais.
- **Medida (6 h, mesma estratégia, com e sem a Arcologia):**

| semente | riqueza com / sem | Contribuição com / sem | razão | moradores com / sem |
|---|---|---|---|---|
| robo-arco (a do teste) | 117.546 / 13.859 | 193.269 / 228.246 | 0,85 | 7.361 / 7.872 |
| robo-1 | 129.312 / 82.457 | 188.673 / 209.119 | 0,90 | 6.889 / 7.446 |
| semente-a | 86.783 / 34.513 | 201.331 / 206.618 | 0,97 | 7.443 / 7.820 |
| semente-b | 105.670 / 26.390 | 212.972 / 238.710 | 0,89 | 6.633 / 9.388 |
| semente-c | 33.765 / 97.471 | 234.010 / 223.449 | 1,05 | 7.631 / 7.878 |
| semente-d | 165.621 / 32.599 | 235.976 / 171.013 | 1,38 | 7.456 / 6.309 |

  A riqueza fica maior com a Arcologia em 5 de 6; a Contribuição oscila em volta de 1,0 (média 1,01) e a população
  também. Em 6 h só o `lago.e1` (60 mil) cabe no caixa: a `torre.e1` pede 150 mil e o caixa do robô fica entre 10 e 35
  mil depois do marco 3 (a cidade rende 45 a 60 mil por hora e gasta em vias, serviços e na importação da D48). Os
  efeitos que mudariam a cidade (licença na e1, 1.200 vagas na e2, 400 moradores de luxo e +20 de demanda na e3) não
  chegam em 6 h. A base (antes da C1a, cidade de faz de conta) era riqueza 143.795 contra 217.876.

## 2. Robô e começo da partida

- **Quadras fora do disco:** a malha oeste começa na primeira quadra sugerida (na ligação com a Vila), quadras
  compridas de 112 x 336 m lado a lado a partir de nós ligados; a leste, pela via que sai da avenida e contorna o disco
  pelo norte (até a planície entre o Mirante e a rodovia). Novo: o **elo** do canto nordeste da malha oeste ao nó de
  entrada, pelo pé do Morro da Pedreira (a rede da cidade passa a ser uma só com a da avenida: energia da rodovia e a
  água do reservatório). O dinheiro para os níveis (D48) só vai quando não há quadra nem a via do leste por fazer.
- **Começo que não pune:** objetivos novos `cidade.vila` (a rede chega a 90% das casas da Vila, xp 40, sugestão 'vila':
  melhorar as 4 ruas de terra) e `cidade.ligacao` (rede da rua principal até a primeira quadra, xp 20) logo depois de
  água e energia. Medidas `vilaNaRede` e `redeAte:<sugestão>` em `sim/objetivos.js`. Bem-estar da Vila: 13 (tarifa 5)
  na base, 55 (tarifa 8) em 2 h.
- **Sugestões da Holding de frente para via e sobre o recurso:** Escritório (-886, -420) e Areal (-955, -205, areia
  134) na estrada de terra; Olaria (-996, 160, argila 104) no **caminho do barreiro**, um ramal de terra novo de 74 m
  da estrada até a beira do rio (`VILA.ruas`, fora da área dos prédios da Vila; a Vila segue com 66 prédios e 349
  moradores; relevo intocado, `mapa.mjs --so-conferir` e `--conferir-assado` ok); Pedreira (93, -755, rocha 124) no pé
  do Morro do Mirante, de frente para o primeiro trecho da avenida (perto da estrada a encosta é íngreme demais e o pé
  tem rocha 60 a 72). O teste `mundo` confere a prévia ok no começo (a Pedreira, 'acesso' antes da avenida e ok depois)
  e o recurso acima de 90 no quadrado de 80 m.
- **Greide do acesso (`sim/mundo/vila.js`):** a ponta do acesso desce até o chão natural antes do nó; o nó de entrada
  foi de 17,19 m para 14,18 m e as ruas que saem dele para o sul ficam em 5,5% a 7,5% (eram 12%, no limite). Sem mudar
  dados, sem assar de novo.
- **Cenário de vias do relatório:** voltou a achar lugar (os encaixes de passo e comprimento aparecem em qualquer
  ponto; só nó, aresta e portão contam como via perto).

## 3. Regras pendentes

- `torre.e3`: a demanda vale só dentro do raio (`fracaoNoRaio` em `zonas/demanda.js`: a fração das frentes livres da
  zona no raio multiplica o bônus; o nascimento já preferia as frentes perto pelo `bonusPerto`).
- `torre.e4`: valor em 1.500 m (era 900), como a D49; o teste confere o raio.
- `q.avisosPredios`: os 'info' (desemprego, bem-estar ruim) ficam; o filtro "Graves e atenção" é da UI (desenho 8.9).
- `camada.bemEstar.faixa5/8/11`: sem número (era "Contribuição de 5" em unidades de desenho). O valor em dólar já sai no
  resumo da legenda pelo `fmt.dinheiro`; o teste `camadas` confere que a faixa não traz número.
- Camadas Zonas e Nível: a `versao` passa a ser o hash dos dados (`versaoDosDados`), então muda com a zona pintada com o
  jogo pausado. **Falta a UI reconsultar fora da virada da rodada** (pendência 3).
- Frota (D47 e desenho 13.4): a frota segue o maior nível de armazém (6 por nível), um segundo Escritório soma estoque e
  não caminhões (era a soma por Escritório). Teste novo em `holding`.
- Manutenção das 24 avenidas da sede: **pendência do dono** (2).

## 4. Contratos (só o que já existe)

- `consultas.js`: `construir.previa` (custoDemolir, semRede, pegada, demolir, dados.faltam), `avisosPredios` (nomes),
  `deposito` (precoImportacao, importarAuto, importacoes), `emprestimo` (principal, mora, passo, prazoAnos, jurosHora,
  parcela, ano, juros por contrato), `orcamento` (aporte, investimentosHora, fluxoCaixaHora, eficiencia, caixaZerado,
  totais), `producao` (produtividade, linhas, armazem), `arcologia` (nome, campos da etapa, futuras, valor, alturas,
  efeitos, inaugurada), `demanda` (R, C, I, E, ativas), `sugestoes` (os 5 tipos, com 'melhorar').
- `comandos.js`: `arcologia.iniciar` com 'nada' e 'valor'; 'inexistente' em `linha.ordem`, `linha.parar`,
  `predio.nivel` e `acelerar`; 'valor' em `importar` e `acelerar`; 'creditos' em `decisao.escolher`.
- `interno.js` (só comentário, nenhum padrão novo nos agregados): `bemEstarSuave`, `empregos.taxa` e `.trabalhadores`;
  `sim.holding.registrarChegada/folha/ocupados/estoque`, `sim.economia`, `sim.cidade` (efeito, remover, lista),
  `sim.arcologia` (vagas, moradoresLuxo, contribuicaoHora, valor, estado) e `nLote` na linha.
- `docs/PROJETO.md`, seção 2: as mesmas linhas em 2.5, 2.6 e 2.10.

## 5. Números calibrados pelo robô (antes e depois)

| arquivo | número | antes | depois | por quê |
|---|---|---|---|---|
| data/vias.js | custo por metro rua / ruaMao / avenida / avenidaG | 30 / 32 / 70 / 130 | 12 / 13 / 28 / 52 | a quadra de 112 m custava 14 mil e rendia uns 1.500 por hora |
| data/vias.js | manutenção por km por hora rua / ruaMao / avenida / avenidaG / terra | 150 / 150 / 300 / 500 / 20 | 60 / 60 / 120 / 200 / 8 | idem |
| data/servicos.js | captação / poço / usina / praça | 25.000 / 8.000 / 30.000 / 3.000 | 15.000 / 5.000 / 16.000 / 1.500 | o caixa da primeira hora ia em poucos prédios |
| data/servicos.js | clínica / escola / delegacia / bombeiros | 20.000 / 25.000 / 20.000 / 25.000 | 10.000 / 12.000 / 10.000 / 12.000 | idem, e os bairros ficavam sem cobertura |
| data/marcos.js | XP do marco 1 | 400 | 500 | com os objetivos novos o marco 1 caía em 0:08; agora 0:14 (meta 10 a 15 min) |
| sim/zonas/demanda.js | `DEMANDA.com.excesso` | não havia | -45 (comercial com mais de 30% de capacidade sobrando) | a comercial nascia sem clientes |
| sim/zonas/crescimento.js | `CRESCIMENTO.tentativas` | 4, sem uso | 4 torneios por nascimento | a ponta da quadra matava a tentativa |
| data/arcologia.js | raio do valor da torre.e4 | 900 | 1.500 | D49 |
| sim/holding/producao.js | frota | soma por Escritório | maior nível de armazém | D47 |

Os créditos das etapas da Arcologia e os limiares do marco 2 em diante ficaram (D51: "o robô calibra os limiares de
XP, não os preços").

## 6. Robô: metas A4 do M1a (semente robo-1, sem comprar tempo)

| meta | alvo | 2 h | 6 h | 12 h |
|---|---|---|---|---|
| marco 1 | 10 a 15 min | 0:14 | 0:14 | 0:14 |
| marco 3 | 40 a 70 min | 1:07 | 1:07 | 1:07 |
| marco 4 | (sem meta no M1a) | | 4:40 | 4:40 |
| moradores (Vila: 349) | cidade além da Vila | 2.816 | 6.889 | 7.526 |
| bem-estar (tarifa) | | 55,0 (8) | 46,6 (8) | 45,7 (8) |
| caixa na primeira hora | não zera, no máximo 1 empréstimo | mínimo 15.023, 1 empréstimo | dentro | dentro |
| empréstimo | só 2020 e 2021, até 50 mil por ano | 2020: 50 mil | 2020 e 2021: 50 mil cada | idem |
| dívida máxima | até 500 mil | 52.421 | 115.772 | 115.772 |
| quitada antes do ano 6 (2025) | sim | sem medida | 38.902 no fim (2022) | zero em 2023 |
| sempre um objetivo aberto | sim | sim | sim | sim |
| erros | [] | [] | [] | [] |
| tique p95 / p99 / máximo (ms, os 3 robôs juntos nos 4 núcleos) | | 5,3 / 10,8 / 97,7 | 3,2 / 8,1 / 82,9 | 1,2 / 5,7 / 43,6 |
| cenário de vias (uma obra a cada 10 tiques) | | p95 4,7 ms; via.construir p95 11,4 ms | p95 2,7; 5,4 ms | p95 2,2; 4,6 ms |

Base (antes da C1a, 2 h): 353 moradores, bem-estar 13,2 (tarifa 5), só o marco 1 (0:10), marco 3 fora.
Fora do M1a: o marco 7 em 5 a 7 h com 25 a 40 mil moradores não chega (marco 4 e uns 7,5 mil em 12 h); o bem-estar de 62
a 75 também não (a cidade fica na tarifa 8). O que segura: espaço na área inicial (a planície oeste e a do leste
acabam perto de 7 mil; o resto é morro, mar e o rio) e a dependência da D48 nos níveis 3 a 5 (as obras de nível ficam
esperando material e a importação a 160% come o caixa).

## 7. A8 (fumaça no navegador)

- `ferramentas/robo-navegador.js` (era o esqueleto da F0): joga a primeira meia hora pelas sugestões da primeira hora
  como o "Usar sugestão" (prédio encaixado pela prévia, o comando recebe o lugar final), a 4x, com o laço, o render e a
  interface ligados, até o tique 1.800 ou 15 min reais; devolve tique, marco, XP, erros, hash, livro e velocidade.
- `ferramentas/robo/a8.mjs` (novo): roda o `testar.mjs` com o robô e confere no Node marco 1, `erros []`, nenhuma linha
  de erro no console e o hash da reprodução do livro. `--node` roda o mesmo robô no Node em 4 s (estratégia).
- Resultado (`--pasta <montagem temporária> --tam 480x270`, qualidade Leve): tique 1.800, marco 1 (559 XP), 442
  moradores, 18 comandos, 9,8 min reais, velocidade efetiva 3,06 tiques por segundo (o laço mede 1,5 no fim), hash
  1363585677 no navegador e no Node. Em 960 x 540 o SwiftShader dá 0,9 tique por segundo e não chega no teto.
- **O A8 achou um defeito da simulação:** a primeira rodada completa deu hash diferente do Node. Bisseção no Node: o
  `q.barra` (e o `q.retomar`, que o chama) mudava a partida, porque `sim.custos.total()` chama o custo dos serviços,
  que ficava em cache pelo tique e pela contagem de prédios; a interface consulta a barra entre dois tiques, o cache
  guardava o custo de antes de a obra de um serviço terminar no tique seguinte, e a economia pagava esse valor. A chave
  do cache agora tem a versão do diário (`sim/servicos.js`), e o teste novo em `servicos` ("q.barra entre os tiques não
  muda a partida") falha sem a correção. A medida `redeAte` dos objetivos novos também deixou de usar o cache das redes
  (calcula os componentes na hora).

## 8. Medidas

- `node ferramentas/montar.mjs --saida <scratchpad>/montagem`: sem avisos; jogo 2.045,5 KB (gzip 724,6 KB, teto
  2.355 KB), sob demanda 395,3 KB, worker de tarefas 3,5 KB, oficina 225 KB.
- `node ferramentas/simular.mjs --testes`: guarda de texto ok (337 arquivos); 32 arquivos ok; `arcologia` com 8 de 9
  (o A2: "Contribuição com 193269, sem 228246"; as asserções de etapa e de riqueza antes dela passam).
- `node ferramentas/robo/a8.mjs --pasta <montagem> --tam 480x270`: A8 ok (seção 7).
- `node ferramentas/simular.mjs --determinismo`: ok (3 pontos, save no meio e o livro reproduzido).
- `node ferramentas/mapa.mjs --so-conferir` e `--conferir-assado`: ok.

## Pendências

1. **A2, dono ou integrador:** com os números da D49 e da D51 a Arcologia não faz a Contribuição da cidade crescer 20%
   em 6 h (tabela da seção 1). Recomendação: trocar o critério da Contribuição por um que o laço da D49 dá no prazo
   (a riqueza já passa em 5 de 6 sementes), ou medir em 12 h com a torre.e2, ou calibrar os créditos da torre.e1 e da
   torre.e2 contra a renda do M1a (pede revisar a frase da D51 sobre os preços). Não mexi no teste nem nos preços.
2. **Dono:** manutenção das 24 avenidas internas da sede (uns 10,3 km; com a tabela nova, uns 1.240 por hora, eram
   3.090). Recomendação: entram no custo da Arcologia, sem cobrança por hora.
3. **UI (X3a ou integrador):** `ui/telas/corpo/Camadas.jsx` só reconsulta na virada da rodada; com o jogo pausado a
   zona pintada não aparece. A `versao` das camadas Zonas e Nível já muda com os dados: reconsultar também quando o
   diário (`sim.mudancas`) marcar células ou prédios.
4. **UI (guia):** `SUGESTAO_DO_OBJETIVO` precisa de 'cidade.vila' para 'vila' e 'cidade.ligacao' para 'ligacao', e o
   "Usar sugestão" precisa do tipo 'melhorar' (`via.melhorar` com as `arestas` da sugestão, relidas na hora). A
   sugestão da Pedreira pede a avenida antes (o guia pode apontar a avenida quando a prévia der 'acesso').
5. **Legenda:** se o dono quiser o valor em dólar em cada faixa do bem-estar, `modeloLegenda` passa `params` nas marcas
   pelo `formatarParams` (hoje só o resumo tem) e as faixas ganham `{valor}`.
6. **App:** expor as ações da interface (`ui/acoes.js` `comando`) em `window.__held` para o A8 mandar os comandos pelo
   mesmo caminho da UI; hoje o robô do navegador usa `sim.cmd` (o mesmo livro).
7. **Economia do M1a (S2a e S3a):** o marco 7 com 25 a 40 mil moradores em 5 a 7 h está longe (seção 6); os níveis 3 a 5
   presos na D48 e o espaço da área inicial são o gargalo. Medido, não calibrado aqui.

## Arquivos

fonte/sim: economia.js, arcologia.js, predios.js, objetivos.js, servicos.js, holding/producao.js, zonas/demanda.js,
zonas/crescimento.js, mundo/areas.js, mundo/vila.js. fonte/data: arcologia.js, mapa-heldopolis.js, marcos.js,
objetivos.js, servicos.js, vias.js. fonte/contratos: consultas.js, comandos.js, interno.js. fonte/ui/textos: s2.js,
s3.js. ferramentas: robo-navegador.js, robo/robo-sim.mjs, robo/cidade-faz-de-conta.mjs, robo/a8.mjs (novo),
testes/{arcologia,holding,progresso,mundo,camadas,servicos}.teste.mjs. docs/PROJETO.md (seção 2).

## Revisão adversarial (03/10/2026)

Medidas e scripts em `scratchpad/novo/C1a-rev/`. Nada commitado.

### Corrigido

1. **Objetivo `cidade.vila` fechava sozinho.** Sem água ou sem energia na cidade a S2a não marca a falta em casa
   nenhuma, e a medida `vilaNaRede` contava as 66 casas como servidas (60 de 60 no tique 0). Agora a medida pede as duas
   redes com oferta (`sim/objetivos.js`). Teste novo em `objetivos` (a Vila na rede depois de melhorar as ruas de terra;
   a ligação até a quadra 1), que falha sem a correção.
2. **Demanda da cidade por hora inflada (D48, tela Holding).** A obra parada tenta de novo a cada rodada e
   `comprarParaObra` somava o pedido em toda tentativa: uma obra de 8 de concreto parada por 1 h aparecia como 1.440 por
   hora (robo-1, 2:00: concreto 17.797/h; corrigido, 502/h). Agora a tentativa da obra que já está com `SEM_MATERIAL`
   não conta de novo (`sim/holding/mercado.js`); o que espera segue em `esperando`. Teste novo em `holding`. Só muda a
   exibição (nenhuma regra lê `demandaHora`).
3. **Robô importava em dobro.** O cimento da Concreteira e o material das etapas durante a obra não contavam as
   importações a caminho (40 tiques) e o passo seguinte (20 tiques depois) importava de novo (5 lotes de 30 de cimento
   em 2 min). `importando(item)` lê `q.deposito().importacoes`. Função `estoque` sem uso removida; `pretasFeitas` virou
   `quadrasFeitas`.
4. **Contratos:** `q.producao()` com `importarAuto`, `esperando`, `itens[].precoBase/liberado` e
   `frota.esperaMax/filaMax/feitas/porDestino`; `q.holding()` com `empresa`, `jogador` (a tela Holding usa), `pais`,
   `ato` e `conselheiros` (consultas.js e PROJETO 2.6, só o que existe).
5. **Testes que faltavam** para as regras novas (em `zonas`): o bônus de demanda com raio (todas as frentes no raio
   dão 20, nenhuma dá 0, metade fica no meio, sem raio vale a cidade) e a versão das camadas Zonas e Nível mudando com a
   pintura sem rodar o jogo.
6. `ferramentas/robo/a8.mjs` com 480 x 270 por padrão (em 960 x 540 o SwiftShader não chega ao tique 1.800 no teto).

### A2 (continua vermelho, agora com o diagnóstico certo)

- A nota dizia "num critério só": **errado**. Na semente do teste a população também falha (com 6.440, sem 8.528),
  depois da Contribuição.
- Com a correção 3 a riqueza fica maior com a Arcologia nas 6 sementes (eram 5 de 6). A Contribuição segue ruído:

| semente | riqueza com / sem | Contribuição com / sem | razão | moradores com / sem |
|---|---|---|---|---|
| robo-arco | 83.354 / 18.914 | 171.743 / 212.109 | 0,81 | 6.440 / 8.528 |
| robo-1 | 82.385 / 54.932 | 177.890 / 182.614 | 0,97 | 6.691 / 6.697 |
| semente-a | 122.741 / 39.658 | 187.067 / 199.244 | 0,94 | 6.804 / 7.192 |
| semente-b | 156.624 / 10.359 | 218.372 / 206.624 | 1,06 | 7.026 / 6.980 |
| semente-c | 76.345 / -6.765 | 242.784 / 232.194 | 1,05 | 7.719 / 7.912 |
| semente-d | 160.915 / 31.690 | 235.985 / 186.896 | 1,26 | 7.518 / 6.278 |

- Por que a partida com a Arcologia perde: a lago.e1 sai aos 0:20 por 60 mil (a cidade rende 4 mil por hora); os 300
  XP trazem o marco 3 para 0:58 (sem: 1:23), e a D48 começa com o caixa baixo; o robô desliga a importação para a
  cidade abaixo de 45 mil, cerca de 100 obras param, o desemprego vai a 39% e de 1:30 a 3:00 ele não abre quadra (caixa
  de 11 a 17 mil contra o custo da rua mais 15 mil de folga).
- `data/arcologia.js` marca os créditos das etapas "(calibrar): a C1 calibra com o robô" e a pendência 8 da X1b pede
  isso; a leitura da D51 ("não os preços") não fecha com a C1a ter calibrado vias e serviços. Medi a lago.e1 a 25 mil:
  razão média 1,13, mas a riqueza cai em 2 de 6. Não adotei.
- Recomendação ao integrador ou ao dono: com uma semente só a Contribuição varia mais de 20% entre sementes, então o
  critério de 1,2 vezes não separa a regra do ruído. Escolher entre (a) Contribuição média de 4 ou mais sementes pelo
  menos igual, (b) medir em 12 h com a torre.e2, ou (c) recalibrar a lago.e1 e a entrada na D48 juntas.

### Robô (semente robo-1, depois da correção 3)

| meta | 2 h | 6 h | 12 h |
|---|---|---|---|
| marcos 1, 2, 3 | 0:14, 0:33, 1:07 | igual | igual |
| marco 4 | | 5:59 (era 4:40) | 5:59 |
| moradores | 2.816 | 6.691 | 6.873 (era 7.526) |
| empréstimo | 2020: 50 mil | 2020 e 2021 | 2020 e 2021 |
| dívida máxima / última dívida | 52.421 / 2020 | 122.383 / 2022 | 122.383 / 2024 (antes de 2025) |
| caixa mínimo | 15.023 (1:23) | 13.279 | 507 (11:07) |
| sempre objetivo, erros [] | sim | sim | sim |

O marco 4 e os moradores de 12 h pioraram com menos cimento comprado (a cidade importou mais concreto a 160%); são
metas fora do M1a e o sistema é caótico entre sementes (as 6 do A2 variam mais que isso).

### Ficou

- A2 (acima). Os avisos 'info' agora vão para o mapa: o de desemprego é da cidade (acima de 15%) e marca todo prédio
  residencial; no filtro padrão "Todos" a cidade com 20% a 39% de desemprego fica cheia de marcadores (até o teto de
  200). Recomendação (UI ou S2a): filtro padrão "Graves e atenção", ou o desemprego só no aviso da cidade.
- A primeira quadra sugerida (quadra1, alvo do objetivo de zonear) é de indústria: o guia leva o jogador a pintar
  indústria antes de casa. Faz sentido pelo desemprego da Vila, mas é decisão de jogo para o dono.
- A UI guarda `q.sugestoes()` uma vez por partida (`ui/guia/regras.js`, listaDoMapa): a sugestão 'vila' muda quando
  as ruas são melhoradas (some quando acabam). Junta com a pendência 4.

### Testes da revisão

- `simular --testes`: guarda de texto ok; 33 arquivos, 32 verdes; `arcologia` com 8 de 9 (o A2: "Contribuição com
  171743, sem 212109"). `objetivos` 7 de 7, `zonas` 9 de 9, `holding` 12 de 12 com os testes novos.
- `simular --determinismo` ok; `mapa.mjs --so-conferir` e `--conferir-assado` ok.
- Pureza das consultas: 2 h do robô com q.barra, objetivos, retomar, orçamento, produção, depósito, arcologia, demanda,
  avisosPredios, sugestões, as 8 camadas, q.predio e as três prévias a cada tique dão o mesmo hash que sem elas.
- Montagem em `C1a-rev/montagem` sem avisos: jogo 2.046,2 KB (gzip 724,9 KB, teto 2.355 KB).
- A8 no Chromium (480 x 270, Leve): tique 1.800, marco 1 (559 XP), 442 moradores, 8,6 min reais, 3,49 tiques/s, hash
  1363585677 no navegador e no Node. `a8.mjs --node` ok.
