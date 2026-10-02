# S2a, cidade viva (núcleo): nota de entrega

Resultado: zonas, demanda, nascimento, níveis, abandono, cidadãos, bem-estar, serviços, redes e valor do terreno
prontos e testados. `simular --testes` verde (26 arquivos), `--determinismo` ok, tique com 41 mil moradores em p95 2,4 ms.
A montagem passa do teto do JS principal (1.750 KB para 1.638), e a S2a responde por 74 KB disso (pendência 1).

## Arquivos (só os da S2a)
- `fonte/data/zonas.js`, `fonte/data/predios.js`, `fonte/data/servicos.js`
- `fonte/sim/predios.js`, `fonte/sim/cidadaos.js`, `fonte/sim/bemestar.js`, `fonte/sim/servicos.js`, `fonte/sim/redes.js`
- `fonte/sim/zonas/demanda.js`, `fonte/sim/zonas/crescimento.js`
- `fonte/ui/textos/s2.js`
- novos: `ferramentas/testes/{zonas,crescimento,servicos,redes,bemestar}.teste.mjs`

## O que publica
- **Comandos:** `construir` (serviços da S2a e os colocáveis da Holding pelo mesmo registro, prévia grudada na via),
  `demolir` (serviço devolve 50%; zona custa os materiais do nível, D54), `predio.cor`, `predio.nome`.
- **Consultas:** `construir.previa`, `predio` (moradia, trabalho, serviço, fatores, `nivelProx`, avisos), `demanda`
  (zonas, R/C/I/E, fatores, `ativas`), `cidade`, `catalogo`, `avisosPredios` (com `nomes` dos glifos), `avisos`.
- **Camadas:** `zonas`, `nivel`, `bemEstar`, `agua`, `energia`, `servicos`, `valor`.
- **Estado:** colunas de prédio `bemEstar`, `pontos`, `problema`, `estudo` (4), `efic`, `carga`, `avisos`; seção JSON
  `cidade`; grade `valor` (256 x 256, 32 m) no espelho; `S.agregados` (populacao, lares, popHora, empregos com `taxa` e
  `trabalhadores`, demanda, bemEstarMedio, `bemEstarSuave`, `bemEstarTarifa`, tarifa, redes).
- **Registros:** `sim.cidade.efeito/remover/lista` (efeitos de área para a X1b e a S3a), o efeito previsto da pintura na
  média (`registrarEfeitoMedia`, lido por `q.zona.previa`), `registrarParteBarra('s2a')` (alertas da cidade), custos
  `servicos` e `ligacao` (energia da rodovia a 0,5 por kW por hora, até 5 MW, D52), `sim.redes.produtor` envolvido para
  sujar as redes.
- **Sistemas (ORDEM):** redes (rodada, fase 0), bem-estar (rodada, fase 0), cidadãos (fase 5), demanda (fase 10),
  serviços e cargas (fase 15), valor (20 fatias), prédios (20 fatias), crescimento (todo tique).

## Pedidos da parcela
- **D76:** residencial média de 3 a 6 andares no nível 1 até 12 a 25 no 5; comercial baixa de 1 a 6; residencial alta
  de 30 a 60 pronta para o M1b (do nível 1 ao 4 até 37 andares, porque as tipologias de varanda passam do teto de
  triângulos acima disso; o nível 5 chega a 60). Teste `zonas` confere a faixa no catálogo.
- **Registro extensível:** nenhuma zona citada pelo nome no código da S2a (teste lê os 7 arquivos); a rodovia da
  indústria e o valor mínimo da zona vêm do registro (`rodovia: true`, `valor.min`).
- **D52:** energia externa só pelo nó de entrada, só o que falta, até 5 MW; água de fora nenhuma.
- **D87:** dinheiro em unidades; a interface converte.
- **A2 do bem-estar (D50):** água, energia, praça e comércio dão 60 ou menos; com saúde e educação passa de 61.
- **XP (D51, com a S3a):** 17,8 mil moradores a 65 por 1 h de jogo deram 781 de XP (faixa 600 a 1.200; com 20 mil, uns
  880).
- **Determinismo:** duas partidas iguais com o mesmo hash, salvar no meio e carregar segue igual (teste `crescimento`);
  `simular --determinismo`: 3.600 tiques, hashes iguais antes e depois do save.
- **Tempo do tique (Node, `bancada40k.mjs`, via a cada 10 tiques):** 2.591 prédios, 41.260 moradores: média 0,93 ms,
  p50 0,73, **p95 2,41**, p99 5,23, máximo 8,07 ms; primeiro tique (monta os índices) 30,6 ms. Meta p95 abaixo de 4 ms.
- **Densidade da cidade sintética:** 12 mil prédios dão 165 mil moradores; 18,6 mil por km² na área urbanizada (8,9 km²
  de hectares com prédio), 23,6 mil por km² nas quadras residenciais, 10,5 mil por km² na caixa da cidade (15,7 km²).
  Com 2.600 prédios (uns 42 mil moradores, a meta do M1a): 16,9 mil por km² urbanizado (2,5 km²).

## Ajustes da última sessão
- Grade do comércio incremental (vagas inteiras por quadrado de 256 m; só os prédios comerciais marcados trocam a parte
  deles): a onda de abandono deixou de custar 45 a 70 ms por tique.
- Balanço das redes numa passada só e o racionamento ordenado por chave numérica: de 4,4 para 2,4 ms com 12 mil prédios.
- O abandonado volta quando o bem-estar possível chega a 25 (era 30: numa cidade sem emprego nenhum ele nunca voltava).
- A indústria sem rodovia e o valor mínimo da zona saem do registro (`rodovia`, `valor.min`), sem id de zona no código.
- O alerta "faltam trabalhadores" só depois da primeira rodada do mercado de trabalho (aparecia no tique 0).

## Como testei
- `node ferramentas/simular.mjs --testes`: verde (guarda de texto em 301 arquivos; 26 arquivos de teste; os 5 da S2a com
  31 testes: zonas 7, crescimento 7, serviços 7, redes 5, bem-estar 5).
- `node ferramentas/simular.mjs --determinismo`: ok.
- `node ferramentas/simular.mjs --bancada` (A5, 11.779 prédios e 158.498 moradores): média 1,96 ms, p50 1,42, p95 4,80,
  p99 7,83, máximo 68,7 ms (o primeiro tique monta cobertura, redes e frentes da cidade gerada por fora). Antes das
  otimizações desta sessão: p95 6,5, p99 48, por uma onda de abandono que refazia a grade do comércio a cada prédio e
  pelo balanço das redes.
- `node ferramentas/montar.mjs --saida <scratchpad>/novo/S2a/montagem`: sem aviso do esbuild; 1 problema: jogo 1.750,2 KB
  (gzip 603 KB) acima do teto de 1.638 KB. A mesma montagem com os 11 arquivos da S2a na versão do HEAD dá 1.676,5 KB:
  a S2a soma 73,7 KB (predios 20, crescimento 10, demanda 10, redes 7, bem-estar 7, serviços 7, os dados 11 e os textos 4).
- Bancada gráfica: ver abaixo.

## Bancada gráfica (perfil 'pc')
`node ferramentas/bancada.mjs --cenas bairro,aberta --perfis pc --pasta <scratchpad>/novo/S2a/montagem --quadros 8`
(SwiftShader, 1376 x 768; o orçamento conta chamadas e triângulos, que não dependem da resolução):
- `bairro-pc`: pior 77 chamadas, 202 mil triângulos (sombra 10 / 35 mil), 48 programas, 0 compilações depois de pronto, ok.
  As torres da residencial média e alta e os prédios médios aparecem altos (captura `bancada/bairro-pc.png`).
- `aberta-pc`: pior 50 chamadas, 429 mil triângulos (sombra 10 / 127 mil), 46 programas, 0 depois de pronto, ok. Bem
  dentro de 800 chamadas e 2,5 milhões de triângulos (captura `bancada/aberta-pc.png`).
A primeira tentativa com 120 quadros em 1920 x 1080 passou de 15 min no SwiftShader e foi parada.

## Pendências
1. **JS principal (integrador):** 1.750 KB contra o teto de 1.638. Sem a S2a já seria 1.676,5 KB (as outras parcelas
   da onda 3). A saída natural é carregar a simulação (estado.js e os domínios) por `import()` depois da tela de carga,
   ou no worker; não é arquivo da S2a.
2. **Bancada do A5 (integrador e SEDE3, dona de `ferramentas/cidade-sintetica.mjs`):** com a D76, os 12 mil prédios da
   sintética dão 158 mil moradores, e o rótulo do A5 é "30 mil moradores" (meta p95 de 1 ms). Pede recalibrar
   `SINTETICA.predios` (uns 2.600 para 40 mil) ou a meta; e a bancada deveria aquecer um tique antes de medir (a
   sintética nasce sem `aoCarregar`, então o primeiro tique monta os índices: 30 a 70 ms).
3. **Dijkstra fatiado (ficha da S2a):** a cobertura dos serviços é síncrona, inteira quando o grafo muda e incremental
   quando só entra uma origem nova (a conta incremental é igual à inteira, bit a bit, testado). Com 1.210 arestas custa
   até 1,2 ms; com uns 5 mil arestas no fim do M1a pode passar de 4 ms no tique da via nova. Fatiar pelas tarefas fica
   para a próxima sessão.
4. **Calibração (C1, robô):** no começo da campanha a demanda residencial fica perto de 0 (a Vila tem 87% de desemprego
   e bem-estar 0, sem água e sem energia) até a indústria e o comércio darem emprego e as redes chegarem à Vila. As
   fórmulas são as da seção 6.4; os pesos ficam para o robô.
5. **Vila (X1a e calibração):** quando a cidade passa a produzir água ou energia numa rede sem ligação com a Vila, as
   casas dela contam o problema e abandonam em 10 min de jogo (D42). É o jogo, mas pode ser duro no tutorial: a primeira
   captação e a usina deveriam ligar na rede da Vila.
6. **`data/mapa-heldopolis.js` (SEDE3):** a sugestão `usina` usa `construir: 'usinaSolar'`; o id do catálogo é `solar`.
7. **Contrato (integrador):** a S2a publica fora do contrato escrito: `sim.cidade` (efeitos de área), `agregados.bemEstarSuave`
   e `bemEstarTarifa`, `agregados.empregos.taxa` e `.trabalhadores`, `q.avisosPredios().nomes`, `q.demanda().ativas`.
8. **UI (U2a/X3a):** as chaves `fator.*`, `falta.*`, `aviso.*` e `camada.*` estão em `ui/textos/s2.js`; os glifos dos
   avisos de prédio estão em `GLIFOS_AVISO` (sim/predios.js), pela ordem de `q.avisosPredios().nomes`.
9. **R4b:** as tipologias de varanda passam do teto de triângulos acima de 37 andares; a residencial alta (M1b) fica em
   37 nos níveis 1 a 4 até o gerador ganhar uma tipologia de torre alta.
