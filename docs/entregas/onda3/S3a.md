# Nota de entrega da S3a (economia, Holding e progresso, núcleo)

Entregue em 02/10/2026, na etapa 1 da onda 3. Tudo no padrão novo, sem git (o integrador commita).

## Arquivos

Criados ou completados (todos da S3a):

- `fonte/data/economia.js`: `REGRAS_DONO` com `moeda: { simbolo: 'US$', fator: 600 }` (D68, D87); `CAIXA_INICIAL` 300 mil;
  `COMPRA_TEMPO` (D13); `ECONOMIA` (importação a 160% com entrega em 40 s, ordem de pagamento da D41, salários por
  estudo, série de 240 meses, aviso de 15 min, receitas com o ponto de entrada `aporte`, sem uso);
  `tarifaPelasRegras`, `tempoPelasRegras`, `lotePelasRegras` (a simulação passa as regras dela) e `emDolar` (só
  interface e nota). `tarifaDoBemEstar(b, regras?)` aceita as regras só se forem objeto (serve em `lista.map`).
- `fonte/data/holding.js`: 11 itens (preço base, tempo, insumos, recurso, marco, parte), prédios da Holding
  (Escritório de Obra, Pedreira, Areal, Olaria, Concreteira no M1a; Mina, Cimenteira, Vidraria, Serraria e Manejo
  prontos para a S3b) com `nome`, `faz`, custo, planta, vagas, armazém, caminhões e os níveis 2 e 3; `HOLDING_ORDEM`
  (= `predios.modelo` do tipo HOLDING); `PRODUCAO` (ocupação mínima 50%, caminhão de 10, frota de 6).
- `fonte/data/marcos.js`: marcos 0 a 7 com os limiares da D51, prêmio, licenças a partir do 2, `libera` e `m1b`;
  `marcoQueLibera`.
- `fonte/data/historia.js`: calendário (D67: tique 0 = jan. 2020; `dataDoTique`, `tiqueDaData`, `anoDeJogo`), Ato 1,
  as 3 decisões do M1a e os eventos do período com nome fictício.
- `fonte/data/nomes.js`: o jogador (Diogo Holanda), a Holding Held, Vera Cruz do Leste, os 6 conselheiros com nome
  completo e cargo, os 20 executivos e listas de nomes fictícios.
- `fonte/data/objetivos.js`: os objetivos por domínio (um contínuo no fim de cada lista).
- `fonte/sim/economia.js`, `fonte/sim/progresso.js`, `fonte/sim/objetivos.js`, `fonte/sim/historia.js`.
- `fonte/sim/holding/producao.js`, `mercado.js`, `logistica.js` e dois novos: `base.js` (regras da simulação,
  livro-caixa por categoria, efeitos e Mural) e `substituto.js` (o `construir` dos prédios da Holding para testar sem a
  S2a; fora do índice e do pacote).
- `fonte/ui/textos/s3.js`: itens, prédios, paradas, alertas, Influência e Legado, marcos, etapas, objetivos, decisões e
  Mural (chaves `s3.*`).
- `ferramentas/robo/robo-sim.mjs` (o robô) e o novo `ferramentas/robo/cidade-faz-de-conta.mjs` (simulação só com a
  S3a, a cidade de faz de conta pelos agregados e ajudantes de teste).
- `ferramentas/testes/{regras-dono,economia,holding,progresso,objetivos}.teste.mjs` (34 testes).

## O que publiquei

**Serviços do contrato interno (2.10):** `sim.holding` de verdade (caixa nunca negativo com o livro-caixa por
categoria, `comprarParaObra` pela D48, `entregar` com a frota da D47, `efeito`) e `sim.progresso` de verdade (`xp`,
`liberado`, `requisito`, `marco`), instalados no começo do registrar da economia, antes das parcelas que registram
depois. Acréscimos fora do contrato (pendência 1): `sim.holding.registrarChegada(nome, fn)`, `folha(ref)`,
`ocupados()`, `estoque(item)` e `sim.economia = { eficiencia(), caixaZerado(), regras(), data(t), efeitos(tipo),
somarMedidor(nome, v, motivo) }`. A S2a já usa `regras`, `eficiencia`, `folha` e `ocupados`.

**Comandos:** `linha.ordem`, `linha.parar`, `predio.nivel`, `acelerar`, `estoque.reserva`, `estoque.vendeCidade`,
`cidade.importarAuto`, `deposito.vender`, `deposito.auto`, `importar`, `emprestimo.tomar|pagarJuros|pagarParcela|
quitar`, `decisao.escolher`, `decisao.adiar`, `holding.identidade`.

**Consultas:** `orcamento` (receitas, despesas e não pago por hora de jogo, saldo, eficiência, totais e a série
mensal com ano e mês), `emprestimo` (anos no calendário; o limite segue o ano de jogo), `deposito`, `producao`
(itens, prédios, frota, armazém, obras esperando), `holding` (Influência, Legado, efeitos, valuation, conselheiros),
`marcos`, `objetivos`, `retomar`, `decisoes` (abertas; `{ historico: true }` dá as decididas), `mural({ desde })`.
Na barra (`registrarParteBarra`): `creditos`, `saldoHora`, `divida`, `valuation`, `caixaZerado`, `data` com o ano do
calendário (2020 em diante), `alertas` (`caixaZerado`, `caixaVaiZerar`, `obrasSemMaterial`, `decisaoAberta`),
`decisoesPendentes` e `objetivos`. O `marco` vem do `sim.progresso.marco()`.

**Eventos:** `marco`, `desbloqueio`, `decisao`, `mural`, `objetivo`, `financas`, `caixaZerado`, `predioNivel` (e
`construido` no substituto). **Espelho:** `espelho.entregas` (`caminho` em Int32Array, `~e` no sentido b para a).

**Regras e números:** a contribuição usa a média suavizada e arredondada (D11; `'predio'` pronto, lendo a coluna
`predios.bemEstar` da S2a); juros de 10% ao ano por contrato, mora de 20% depois de 10 anos, parcela de 10% do
principal (mínimo 1.000); Depósito a 150% com 100 por janela de 14.400 tiques; importação a 160% em 40 s; até o marco
2 a obra compra do estoque e importa o resto sozinha, do 3 em diante os níveis 3 a 5 só compram da Holding (importa a
160% e vende a 100%, "Importação para a cidade" ligada por padrão; sem caixa ou desligada, a obra espera); linha nova
em 10 com Auto e sugestão de lote só quando ajuda (D57); produtividade pela ocupação (a Holding contrata primeiro) e
pela distância ao armazém na Concreteira; 3 decisões do Ato 1 com data e marca; 3 objetivos sempre abertos.

**História (D77 a D83):** `vila.agua` no marco 0, minuto 3 (captação, Legado; reservatório, Influência); **Febre
Aurora** em mar. 2020 (comprar infraestrutura a preço de banana: 40 mil, uma licença, linhas 10% mais lentas por 6
meses, Influência +8; proteger o canteiro e a Vila: 20 mil, bem-estar +4 na Vila por 1 ano, Legado +8); **Bloqueio do
Canal de Seshat** em mar. 2021 (o choque: importação a 200% e 3 vezes mais lenta por 6 meses; fretar navios: 50 mil,
anula o choque, Influência +6; produção local: linhas 15% mais rápidas por 1 ano, Legado +6). A Crise da Energia de
2022 entra só como nota no Mural (decisão na S3b). Prazo de 3 meses, um adiamento de 1 mês, opção padrão no fim. Os
textos falam em Blade Tower (D89).

## Como testei

- `node ferramentas/simular.mjs --testes`: **testes ok** (24 arquivos, guarda de texto ok). Os da S3a: regras-dono 9,
  economia 7, holding 7, progresso 5, objetivos 6, todos verdes, rodando só com os domínios da S3a.
- `node ferramentas/simular.mjs --determinismo`: ok (hashes iguais, salvar e carregar no meio, reprodução do livro).
- `node ferramentas/montar.mjs --saida <scratchpad>/build`: guarda ok; **JS principal 1.749 KB, acima do teto de
  1.638** (pendência 4). A parte da S3a no pacote é de uns 69 KB (medida pelo metafile do esbuild: produção 10,7,
  economia 9,3, textos 9,3, objetivos 6, mercado 5,9, história 5, logística 4,8, dados 12, base 2,3). Já tirei 9 KB:
  o substituto de construir saiu do pacote e os dados viraram `/* @__PURE__ */` (o que a simulação não usa cai).
- `node ferramentas/simular.mjs --bancada`: o tique é da cidade da S2a (prédios 821 ms, valor 300, redes 209 nos 660
  tiques); a economia soma 17 ms (0,03 ms por tique) e a Holding nem entra entre os 8 maiores.
- Robô (relatórios em `<scratchpad>/novo/S3a/robo-*.txt`):
  - `--horas 12 --fazDeConta` (3,7 s): marcos 1 em 0:08, 2 em 0:22, 3 em 4:49, 4 em 5:59; 12.987 moradores no fim;
    caixa mínimo 776 (5:18), nunca zerado; dívida máxima 219.651, 50 mil por ano em 2020, 2021 e 2022; sempre um
    objetivo aberto; tique p95 0,051, p99 0,097, máximo 4,6 ms; cenário de uma obra de via a cada 10 tiques: tique p95
    0,13, p99 0,18, máximo 0,25 ms, `via.construir` p95 1,8 ms; `erros []`.
  - `--horas 12 --fazDeConta --comprarTempo`: igual (o caixa nunca passou de 250 mil, a regra do robô para comprar).
  - `--horas 2 --cidadeReal` (cidade da S2a como está agora): a Vila perde moradores (171 no fim, bem-estar 2,8),
    captação sem energia e usina sem água; caixa zerado depois de 1:01; tique p95 0,94, p99 1,70, máximo 10,5 ms;
    cenário de vias p95 0,75, p99 1,03, máximo 1,48 ms; `erros []`.
  - Metas A4 parciais: marco 1 e marco 3 **fora** nos dois modos (ver C1 abaixo); dentro: caixa da primeira hora, dívida
    até 500 mil, até 50 mil por ano, sempre um objetivo, `erros []`.

Capturas: nenhuma (a parcela não muda nada na tela).

## Preços em dólar que ficam mais de 5 vezes longe do mercado (para a C1)

Com o fator 600 e a unidade do desenho ("uma carga de caminhão"), **todos os itens ficam acima de 5 vezes**:

| Item | Base | Em US$ | Mercado de uma carga | Desvio |
|---|---|---|---|---|
| brita | 20 | 12.000 | 10 t a US$ 25 a 40/t: 250 a 400 | 30 a 50x |
| areia | 15 | 9.000 | 10 t: 200 a 350 | 25 a 45x |
| argila | 18 | 10.800 | 10 t: 100 a 300 | 35 a 100x |
| tijolo | 50 | 30.000 | 8 a 10 mil tijolos: 3.000 a 5.000 | 6 a 10x |
| madeira | 30 | 18.000 | 20 m³ de toras: 1.200 a 2.000 | 9 a 15x |
| madeira serrada | 80 | 48.000 | 20 m³: 8.000 a 12.000 | 4 a 6x (no limite) |
| calcário | 22 | 13.200 | 10 t: 150 a 300 | 45 a 90x |
| cimento | 90 | 54.000 | 10 t: 1.000 a 1.500 | 35 a 55x |
| concreto | 170 | 102.000 | 8 m³ usinado: 1.000 a 1.300 | 80 a 100x |
| vidro | 140 | 84.000 | 20 t de vidro float: 12.000 a 16.000 | 5 a 7x |
| aço | 160 | 96.000 | 10 t de vergalhão: 7.000 a 9.000 | 10 a 14x |
| Concreteira | 30 mil | 18 mi | central dosadora: 0,5 a 2 mi | 9 a 36x |
| Escritório de Obra | 15 mil | 9 mi | canteiro com armazém: 1 a 3 mi | 3 a 9x (no limite) |

Pedreira (7,2 mi), Areal (4,8 mi) e Olaria (9 mi) ficam dentro de 5 vezes. Proposta para a C1: chamar a unidade de
**lote industrial** (brita e areia em lotes de uns 400 t, concreto de uns 800 m³, aço de uns 120 t), o que põe os
preços na faixa real sem mexer no equilíbrio; o caminhão vira um comboio.

## Pendências para o integrador

1. **Contrato interno:** passar para `fonte/contratos/interno.js` os acréscimos da S3a: `sim.holding.registrarChegada`,
   `folha`, `ocupados`, `estoque` e o objeto `sim.economia` (eficiencia, caixaZerado, regras, data, efeitos,
   somarMedidor). Códigos que a S3a devolve além da lista do comando: `inexistente` (linha.ordem, linha.parar,
   acelerar, predio.nivel), `valor` (importar, acelerar, emprestimo de valor errado já está) e `creditos`
   (decisao.escolher quando a opção custa mais que o caixa).
2. **Calendário (D67):** `comum/relogio.js` ainda dá `espelho.tempo.ano` de 1 em diante e `ui/formato.js` escreve "Mês
   3 · Ano 2". A S3a já põe o ano de 2020 em diante na barra e nas consultas (`data/historia.js`: `ANO_INICIAL`,
   `dataDoTique`); os meses abreviados estão em `s3.mes.1` a `s3.mes.12` e o formato em `s3.data` ("{mes} {ano}").
   `EXEMPLO_BARRA.data` pode passar a `{ mes: 3, ano: 2020 }`.
3. **`q.holding` registrada com `{ substituto: 's3a' }`** só para o teste do mundo (`mundo.teste.mjs`, "Influência 50
   tira 10%") poder trocá-la; trocar o teste para `sim.economia.somarMedidor('influencia', 50, 'teste')` e tirar a
   marca em `fonte/sim/economia.js`.
4. **JS principal (A1):** 1.749 KB contra o teto de 1.638 KB com a onda inteira na árvore; a S3a pesa uns 69 KB, quase
   tudo simulação, que o índice fixo (`fonte/sim/estado.js`) importa de saída. Caminhos: a simulação inteira por
   `import()` em `fonte/app/main.js` (vira um pedaço sob demanda), ou rever o teto pela D66 e D70 (PC primeiro). Os
   textos longos das decisões e do Mural (uns 4 KB) podem ir sob demanda se o índice de textos aceitar um segundo
   arquivo da S3 (tentei `s3-historia.js` por `import()` e o teste de índices da casca recusa módulo fora do índice).
5. **S2a:** usar `sim.q.holding().efeitos.atratividade` (Legado, até +5) na demanda residencial e os efeitos
   `sim.economia.efeitos('bemArea')` (Febre Aurora: +4 na Vila por 12 meses) e `'demanda'`; os materiais de
   `comprarParaObra` são os ids de `data/holding.js` (`serrada`, `aco`...). O XP de serviço sai do `def.xp` do
   construir da S2a (a S3a não conta de novo); o da Holding sai da S3a quando o prédio entra na lista (o colocável da
   Holding não tem `xp`). No robô com a cidade da S2a, a captação fica sem energia e a usina sem água: a rede não fecha
   e a Vila esvazia.
6. **S1a e S2a:** a sugestão da usina diz `usinaSolar` e o serviço da S2a é `solar`.
7. **X1b:** `sim.progresso.requisito(7, fn)` para o marco 7 (sem ele vale `torre.e4` pronta no espelho); entregas por
   `sim.holding.entregar({ item, n, origem: 'armazem', destino: 'torre.e2', aoChegar: 'arcologia' })` com
   `sim.holding.registrarChegada('arcologia', fn)` (o nome sobrevive ao save; função não); a entrega tira o estoque
   no pedido (-1 sem estoque) e um pedido acima de 10 vira várias viagens; `sim.holding.estoque(item)`;
   `sim.holding.efeito('torre.e2', { produtividade: 0.15, caminhoes: 6 })`; licença de `torre.e1` por
   `concederLicencas` (S1a); Legado +5 de `torre.e4` por `sim.economia.somarMedidor('legado', 5, 'torre.e4')`; XP das
   etapas por `sim.progresso.xp(n, 'arcologia')`; parar as etapas com `sim.economia.caixaZerado()` (D41).
8. **U1b:** alertas da S3a em `s3.alerta.<codigo>` (com params); objetivos com `texto` e `params`, e `paramsChave`
   (traduzir antes: `{ item: 's3.item.concreto' }`); decisões com `titulo`, `texto`, opções com `texto`, `ganho`,
   `custo` (chaves) e `creditos`; Mural com `autor` (id do conselheiro), `texto` (chave) e `params`; folha do prédio da
   Holding por `q.predio(ref).holding` (`sim.holding.folha`), paradas em `s3.parada.<codigo>`. Dinheiro: os textos da
   F0 `codigo.limiteAno` e `codigo.limiteDivida` falam em "50 mil" e "500 mil" (unidades); em dólar são US$ 30 milhões
   e US$ 300 milhões.
9. **X3a:** a camada Recursos pode mostrar as obras paradas por falta de material por `q.producao().esperando`.
10. **R3b e R5:** `espelho.entregas` (formato acima, `visual` nas do Depósito e da importação); `predios.modelo` do tipo
    HOLDING é o índice em `HOLDING_ORDEM`, planta em `PREDIOS_HOLDING[tipo].planta`.
11. **Guarda de texto:** proposta de palavras proibidas em `ui/textos/*`, `data/historia.js` e `data/nomes.js` (nomes
    reais de empresa, país, doença ou pessoa): Google, Alphabet, Swift, Covid, coronavírus, SARS, Wuhan, Suez, Ever
    Given, Ucrânia, Rússia, Crimeia, Putin, Trump, Biden, Obama, China, chinês, Estados Unidos, EUA, Brasil,
    Tailândia, Nvidia, OpenAI, ChatGPT, Microsoft, Apple, Amazon, Lehman, Silicon Valley Bank, SVB. O teste de
    objetivos já confere essa lista nos textos da S3; nos créditos de arquitetura (D60) os nomes reais continuam.
12. **C1 (calibração):** com os preços de hoje a cidade cresce devagar demais para as metas do A4 (marco 3 em 4:49 na
    cidade de faz de conta): um bloco de grade de 3 x 2 quadras custa uns 60 mil e dá uns 1.100 moradores (11 mil por
    hora), então o caixa é o gargalo; e o XP de ações (vias, prédios, objetivos) leva o marco 1 a 8 min. Calibrar
    custos de via e de serviço, densidade e os limiares da D51 com o robô na cidade da S2a pronta.
13. O robô e a cidade de faz de conta leem `sim._comandos` e `sim._sistemas` (o núcleo não tem consulta pública dos
    registros); um `sim.temComando(nome)` no núcleo deixaria isso limpo.

## Revisão adversarial (02/10/2026)

Corrigido nos arquivos da S3a, com teste de regressão para cada um:

1. **Insumo de graça** (`holding/producao.js`): trocar o lote de uma linha rodando (n 1 para 10, mesmo item) e parar
   devolvia os insumos do n novo (2 argila viravam 20) e deixava `consumidos` negativo. A linha guarda `nLote` (o n da
   partida); `parar` devolve só o que o lote consumiu; a ordem nova vale no próximo lote.
2. **Rota velha do caminhão** (`holding/logistica.js`): a chave do grafo de tempo eram só as contagens; demolir e
   construir na mesma vaga com outro tipo mantinha a rota e o tempo antigos (e uma partida carregada calculava outro
   tempo). A chave usa `G.versao`. Ao carregar, as funções `aoChegar` da memória e o grafo de tempo são esquecidos
   (ids de viagem do save podiam disparar uma função da partida anterior). `posicao` de uma ref confere a geração.
3. **`entregar`**: `n: 0` levava 1 unidade; `n` enorme enchia a fila (2e5 viraram 20 mil viagens). Agora 1 a 1.000 e
   item do catálogo, senão -1.
4. **Chaves herdadas** (`toString`, `constructor`...) passavam por item em importar, reserva, Depósito e
   vendeCidade (importar 'toString' saía de graça e punha texto no estoque). `ehItem` confere chave própria.
5. **XP de vias de graça**: as ruas da Vila (430 m) davam 4,3 XP no começo. O ponto de partida das vias é tomado no
   registrar, como os moradores da Vila.
6. **"O caixa zera em" falso**: o aviso e o caixa zerado usavam o saldo com os juros, que viram dívida e não saem do
   caixa. Usam `fluxoCaixaHora` (saldo + juros), também em `q.orcamento()`.
7. **Dinheiro escrito nos textos (D87)**: "40 mil agora", "20 mil", "50 mil" nos custos das decisões (a interface já
   mostra o preço em dólar ao lado). Tirados; "1 min de obra" virou "1 min de jogo de obra" (D42).
8. **Armazém nível 2**: os dados deixavam no marco 3, mas o marco 5 lista `nivel.armazem2` (seção 15.1). Agora no
   marco 5 (calibrar na C1); antes disso, mais estoque é outro Escritório de Obra. Texto da parada ajustado.
9. `q.decisoes` não quebra com uma pendente de id que saiu dos dados. Robô: metas A4 a mais (empréstimo só em 2020 e
   2021, sem dívida a partir de 2025, vendas de 15% a 35% no marco 5); hoje as duas do empréstimo ficam FORA.

Fica para a C1 e outras parcelas: a reserva padrão "o que a próxima etapa pede" (seção 12.5) não existe (a reserva
começa em 0; precisa do `q.arcologia` da X1b); frota soma os caminhões de cada Escritório de Obra (dois Escritórios
de 15 mil dão 12 caminhões); o robô toma empréstimo depois do ano 2 e não quita antes de 2025.
