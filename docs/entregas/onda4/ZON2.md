# ZON2. Distrito Industrial, Zona de Utilidades e modo de crescimento da zona (D112 e D113)

Parte de SIMULAÇÃO entregue em 17/10/2026. A interface (pincel com a área destacada, aviso de recusa, painel de crescimento da
zona, dica da linha de longo alcance) é de outra parcela: esta nota lista o que ela pode chamar. Nada de `app/`, `render/` ou
`ui/` (fora o arquivo de textos) foi tocado.

## O que existe

**Mapa.** Duas áreas nomeadas novas em `espelho.areas` (ids `distritoIndustrial` e `zonaUtilidades`; contornos em
`fonte/data/zon2.js`, entram no fim de `MAPA_HELDOPOLIS.areas`).
- Distrito Industrial: o corredor plano da rodovia e a planície do calcário a noroeste (x de -1540 a -120, z de -1530 a -1080). A
  Mina continua onde estava (calcário do ladrilho (5, 5) está inteiro dentro do distrito). Fica a 1,5 km do centro da sede e a
  sotavento. Foi o único chão plano e seco da região: os morros ao sul passam de 30% de declive.
- Zona de Utilidades: margem leste do Rio Held e a várzea logo a oeste (x de -1560 a -900, z de -640 a 364), rio acima da
  Vila. A captação e a usina sugeridas continuam dentro dela (a usina sugerida passou de (-905, 350) para (-985, 300)). A Vila
  e a orla ficam de fora das duas áreas (o teste confere).
- Vento predominante em `data/zon2.js` (`VENTO_PREDOMINANTE`: do sul-sudeste para o norte-noroeste). `ventoDoMes` agora sorteia
  em torno dele (até 63 graus para cada lado); o distrito está nessa direção.

**Regras de lugar.**
- `zona.pintar` com a zona Indústria só pinta as células cujo centro está no distrito. Pincel misto pinta o de dentro e conta o
  de fora em `dados.foraDoDistrito`; se nada fica dentro, recusa com `distrito`. Outras zonas não têm restrição.
- `construir` (e `mover`) recusa com `utilidades` fora da Zona de Utilidades para captação, poço, usina solar, ETE,
  termelétrica e os tipos reservados (`tratamentoAgua`, `hidreletrica`, `subestacao`, `dataCenter`: entram na regra quando
  chegarem ao catálogo). Recusa com `distrito` fora do distrito para os prédios da Holding marcados `zona: 'industrial'`
  (Mina, Cimenteira, Vidraria, Serraria, Agroindústria). A planta inteira tem de estar dentro.
- `construir.previa` devolve o mesmo `codigo` e `dados: { area, nome }`.
- `definirRegrasDeLugar(false)` (em `data/zon2.js`, como `definirParteAtual`) desliga as regras só para testes de outras
  parcelas que montam coisas em qualquer ponto do mapa (lista em "Testes"). `definirVentoAleatorio(true)` faz o mesmo com o vento.

**Rede de longo alcance.** Produtor de rede (água, energia, esgoto) na Zona de Utilidades cuja via de acesso não leva canos e
cabos (terra) liga ao nó mais perto de uma via com redes por uma linha reta, até 3000 m. O custo entra no custo da obra
(metros x custo por metro: água 8, energia 5, esgoto 8; `data/zon2.js`) e a linha vale dinamicamente em `redes.js`. A
prévia traz `longoAlcance: { rec, metros, custo, alcanca }` e `semRede` cai para falso quando a linha alcança. O que foi pago
fica em `sim.json.zon2.linhas[ref]`. Não há manutenção por metro (anotado como possível calibração).

**Modo de crescimento (D113).** Por tipo de zona pintada (resBaixa, comBaixa, industria...): `automatico` (como antes) ou
`manual`. No Manual a demanda só acumula em `espera` (em construções, até 1000) e nada nasce até o jogador pedir um lote; o
lote nasce ao ritmo de sempre (até 3 por tique, 60 obras abertas, uma tentativa sem frente ou espaço espera o tique seguinte)
e cada construção tira uma da espera. O padrão é `automatico` (nada muda para quem não escolhe). Trocar para `automatico`
cancela o lote que faltava e devolve a espera ao acumulador (até 3); trocar para `manual` leva o acumulador para a espera.

## Comandos (entram no livro)

| Comando | Argumentos | Resposta | Recusas |
|---|---|---|---|
| `zona.modo` | `{ zona (índice de ZONAS_ORDEM ou id), modo: 'automatico' \| 'manual' }` | `dados: { zona, id, modo, cancelados }` | `valor`, `nada` (já está nesse modo) |
| `zona.lote` | `{ zona, n }` com n inteiro de 1 a 1000 (soma ao que faltava, no máximo 1000); `n = 0` cancela o que falta | `dados: { zona, id, pedido, cancelados }` | `valor`, `modo` (zona em Automático), `lote` (fora de 1 a 1000 ou passa de 1000 no total), `nada` (cancelar sem lote) |
| `zona.pintar` | como antes, mais `modo?: 'automatico' \| 'manual'` (troca o modo da zona na mesma hora) | `dados: { n, comPredio, foraDoDistrito }` | `marco`, `nada`, `valor`, `distrito` (novo; `dados.fora`) |
| `construir`, `mover` | como antes | `dados.longoAlcance` no construir | novos: `utilidades`, `distrito` |

Códigos novos em `contratos/codigos.js`: `distrito`, `utilidades`, `modo` (frases em `ui/textos/zon2.js`:
`codigo.distrito`, `codigo.utilidades`, `codigo.modo`).

## Consultas (puras, o hash não muda)

- `q.zona.crescimento({ zona? })`: lista (uma por zona da parte em curso) ou o item de uma zona (ou `null`):
  `{ zona, id, nome, familia, modo, pedido, espera, demanda, frentes, construidos, emObra }`. `pedido` é o que falta do lote;
  `espera` é o que a demanda acumulou, em construções.
- `q.zona.regras()`: `{ ligadas, distrito: { id, nome, contorno, zonas, tipos }, utilidades: { id, nome, contorno, tipos }, vento: { de, para, angulo }, longoAlcance: { custoPorMetro, alcanceMax }, modos, lote: { min, max } }`.
- `q.zona.lugar({ x, z })`: `{ distrito, utilidades }` (o ponto está em cada área?), para a dica ao passar o mouse.
- `q.zona.previa` ganhou `foraDoDistrito` (e, na indústria, `celulas` só traz as de dentro).
- `q.construir.previa` ganhou `longoAlcance` e `dados` nas recusas novas.

## Textos (`ui/textos/zon2.js`, já no índice)

Grupos de chaves: `codigo.distrito|utilidades|modo`; `zon2.distrito.*` e `zon2.utilidades.*` (nome, dica, tipos, vento, recusas);
`zon2.rede.*` (título da linha, adutora, linha de transmissão, emissário, sem alcance); `zon2.modo.*` (automático, manual,
dicas, trocou, cancelou); `zon2.lote.*` (pergunta, começar, cancelar, pedido, nenhum, espera, máximo); `zon2.crescimento.resumo`.

## Save

`versaoSave` 3 para 4. Seção JSON nova `zon2` (`modo`, `pedido`, `espera`, `linhas`). `MIGRACOES[3]` é vazia: o save da v3 abre
com tudo em Automático. A indústria e as utilidades que um save antigo já tem fora das áreas ficam onde estão.

## Robô (`ferramentas/robo/robo-sim.mjs`)

Continua chegando longe nos dois modos (`--modo automatico|manual`, também em `rodarRobo({ modo })`; padrão `automatico`).
Mudanças: (1) a estrada de terra da Vila vira rua com redes no primeiro gesto (antes dos prédios da Holding, que se
alinham à rua mais larga e, de outro jeito, a impedem de melhorar), levando a água e a energia até o distrito; (2) a indústria
ganha duas faixas no corredor plano da rodovia (uma rua paralela de 150 em 150 m, ao sul da rodovia e depois ao norte dela, a
segunda ligada ao nó da Vila), e o robô pinta a faixa dos dois lados trecho a trecho, quando a indústria pede espaço; a
quadra industrial sugerida perto da Vila virou comercial (`SUGESTOES.quadras`); (3) quando só a indústria pede espaço o robô
não abre quadra de casas; (4) usina solar e poço extras vão para a Zona de Utilidades, com a linha de longo alcance; (5) a
Cimenteira do `--m1b` vai para perto da Mina; (6) no Manual cada zona pintada recebe `modo: 'manual'` e a cada rodada o robô
pede lote do tamanho da espera (até as frentes livres).
Semente `zon2`, 12 h: Automático marco 4 em 3:34 (10,7 mil moradores) e Manual marco 4 em 3:09 (10,5 mil). No HEAD de antes
(mesma semente) o robô fechava as 12 h no marco 3 com 4,7 mil moradores.

## Testes

`ferramentas/testes/zon2.teste.mjs` (18 testes): áreas, Mina, vento, pintura no distrito, utilidades, linha de longo alcance e
custo, modo e lote (validação, ritmo, troca, cancelamento), consultas puras, determinismo com save no meio, migração v3 para v4,
textos e o robô nos dois modos (3 h cada).
Testes antigos ajustados (só o que a regra nova mexe, cada um com comentário no topo):
- `definirRegrasDeLugar(false)` em ambiente, celulas, cidade-completa, mercadoria, mover, redes, servicos e zonas (montam
  indústria e utilidades em qualquer ponto do mapa);
- `definirVentoAleatorio(true)` em ambiente (as fontes e as casas do teste ficam em lados fixos; o vento predominante tem teste próprio);
- ambiente deixou de fixar `versaoSave === 3`; mundo lista as duas áreas novas; esgoto roda o robô até a ETE e uns 900
  moradores em vez de 2400 tiques fixos (o ritmo do robô mudou).
Rodei: `simular --testes` (testes ok, inclusive mundo e arcologia 12 de 12 no A2), `--determinismo` ok, `--bancada` (FORA como
no HEAD: p95 de 4,9 a 5,9 ms na cidade sintética de 126 mil moradores nesta máquina; o crescimento ganhou só a leitura do modo
por zona).

## Pendências e o que não verifiquei

- Nada de interface foi feito nem visto na tela (sem Chromium aqui). A interface precisa: destacar as duas áreas no pincel e na
  barra de construção, mostrar `foraDoDistrito` e as recusas, o painel de modo e lote por zona e a linha de longo alcance na
  prévia dos produtores.
- O modo vale por tipo de zona, não por mancha pintada (as células guardam só o tipo). Se o dono quiser por mancha, é coluna nova
  na tabela de células e migração.
- O vento mexeu na direção das manchas de ar: a poluição do distrito segue o vento para o norte-noroeste. Calibração do ar não refeita.
- O chão plano do distrito comporta uns 50 prédios industriais nas duas faixas do robô (o HEAD de antes chegava a 70 com a
  indústria dentro da cidade). Mais indústria pede outra faixa ou o ladrilho do calcário comprado (a planície oeste do distrito).
- Custos por metro e alcance da linha são números de partida (calibrar).
