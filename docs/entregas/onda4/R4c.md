# R4c. Moradia de alto padrão (D95)

Entregue em 11/10/2026 (retomada de duas sessões; a primeira caiu no limite).

## O que mudou
- `fonte/data/predios.js`: as zonas do jogador só têm tipologia de alto padrão. Modelos novos no fim do catálogo (índices antigos intactos): `casaJardim`, `sobradoAlto`, `casaPatio`, `casaTerreno`, `mansaoLote` (lote até 40 x 40 m). `resBaixa` vai de `casaAltoPadrao` (nível 1) a `mansao` (nível 5); `resMedia` é `edificioPedraVidro` e `varandaGourmet`; `resAlta` é `torreVarandas`, `torreLuxo` e `torreVidro`, com heliponto no nível 5 (e em parte do 4). A casa de autoconstrução (`vila`, `casa`, `sobradoGeminado`) fica só nos cinco modelos com `area: 'vila'`, que `modelosDaZona` não devolve; a Vila de Santa Cida os cria pelo mapa. Gancho da S3b: `REQUALIFICACAO_VILA`, `ehDaVila`, `modelosDaVila`.
- `fonte/data/estilos.js`: paletas travertino, granito, ripado, zinco, ardósia, sebe e gramado (verdes secos, nunca o lima) e as tipologias novas.
- `fonte/render/geracao/planoPredio.js`: `casaAltoPadrao`, `casaPedraVidro`, `mansao` (pórtico, colunas, quatro águas em ardósia ou zinco, piscina, muro de pedra e grade), `edificioPedraVidro` (empena de pedra), `torreLuxo`, portaria e paisagismo; a casa popular só com `vila: true`.
- Testes: `moradia-alto-padrao.teste.mjs` (novo) e ajustes em `geracao-predios`, `contratos`, `bemestar`; `cidade-sintetica.mjs` passa de 12 mil a 9 mil prédios (o lote grande ocupa mais chão).

## Referências (uma prancha por tipologia)
- `casaAltoPadrao`, `casaPedraVidro`: Jardim Europa e Jardim Paulistano, São Paulo (casas modernistas e contemporâneas, concreto, pedra, ripado de ipê).
- `mansao`: Vila Nova Conceição e Cidade Jardim, São Paulo (pórtico, telhado de ardósia, muro alto).
- `edificioPedraVidro`, `varandaGourmet`: Vila Nova Conceição e Itaim.
- `torreVarandas`, `torreLuxo`: Barra da Tijuca (Rio) e Balneário Camboriú.
- `torreVidro` com heliponto: Avenida Brasil Central de Balneário e Itaim.

## Capacidade dos lares (mudou) e o robô A2
Moradores por nível 1 a 5: `casaJardim` 5 a 8, `sobradoAlto` 5 a 8, `casaPatio` 6 a 10, `casaTerreno` 8 a 12, `mansaoLote` 8 a 12 (família com caseiro, motorista, babá). Renda de 5/8/11 por morador intacta. Com a primeira capacidade (4 a 7, 4 a 6, 5 a 8, 5 a 9, 6 a 12) o A2 falhou só em "marcos somados com 19, sem 21" (população menor nas 6 sementes); a capacidade acima o devolveu ao verde sem mexer em piso nenhum do teste. População da cidade sintética: 154 mil antes, 137 mil depois.

## Números (cidade sintética, geração em Node; sem navegador no ambiente)
- Prédios: 12.197 antes, 8.874 depois. Triângulos de LOD0 somados (teto, tudo em LOD0): 1,35 M antes, 0,99 M depois; LOD1: 272 mil antes, 201 mil depois. Média por prédio sem mudança (111). `resBaixa`: 105 por prédio antes, 117 depois.
- Chamadas: não mudam (o setor funde por material, não por prédio). Oficina 226,5 KB de 250. Sem sombreador, textura nem transparência novos.
- Não verificado na tela: capturas (rua de classe média alta, mansão nível 5, torre de luxo, vista aberta) e chamadas/GPU na bancada, por falta de Chromium aqui. Falta o dono ver no PC (RX 550).
