# TOP1. Cidade de topo (D115, D95)

Entregue em 17/10/2026. Os níveis de 1 a 5 das três residenciais viram a escada classe média alta, alta, super-rica, ultra-rica e Tier 0,1%. Só gerador, catálogo e textos; nada de zonas, sim, contratos ou índices.

## O que mudou
- `fonte/render/geracao/planoPredio.js` (plano puro, roda no worker `oficina`; mesmo registro de antes, nenhum gerador novo na oficina):
  - `superTorre` (nível 5 da residencial alta, Tier 0,1%): base de pedra com saguão de pé-direito duplo, marquise e espelho d'água; fuste esbelto de 50 a 60 andares com pé-direito de 3,8 m (uns 200 a 250 m); um único recuo, assimétrico (nunca em degraus: a Torre em bolo continua proibida); lâmina de pedra no canto de trás que sobe acima do topo; cobertura duplex envidraçada com terraço e heliponto. Três peles pela semente: cortina champanhe com montantes, aletas verticais de pedra, grelha de concreto claro. Sem faixa horizontal escura.
  - `cobertura()` (nova peça comum): pavilhão envidraçado de pé-direito duplo, empenas de pedra nas pontas, laje fina que avança. Entra na `torreLuxo` do nível 4 (heliponto sobre ela em 60% das torres) e na nova `varandaCobertura` (prédios de varandas, níveis 4 e 5; heliponto no 5 em 70%).
  - `mansaoHeliponto` (nível 5 da residencial baixa, lotes de 32 x 32 m ou mais): heliponto no gramado dos fundos (disco, aro e H), dentro do lote e fora da casa; o fundo da casa cresce para comportá-lo (nas duas variantes, clássica e contemporânea). Árvores e carros do lote se desviam dele.
- `fonte/data/predios.js`: tipologias da escada (resBaixa 1 e 2 casa de alto padrão, 3 casa de pedra e vidro, 4 mansão, 5 mansão com heliponto; resMedia 3 varanda gourmet, 4 e 5 varanda com cobertura; resAlta 3 e 4 torre de luxo, 5 super torre). `casaJardim` e `casaPatio` (lotes de 24 m) ficam na mansão no nível 5. Andares do nível 5 da resAlta de 45 a 60 para 50 a 60 (continua dentro da faixa 30 a 60 da D76). Moradores, lares, empregos e consumo intactos (renda 5/8/11 por morador).
- `fonte/data/estilos.js` (mínimo, fora da lista, anotado): três entradas novas em `TIPOLOGIAS` (`mansaoHeliponto`, `varandaCobertura`, `superTorre`) com pé-direito e recuo. Nada existente muda.
- `fonte/ui/textos/top1.js`: nomes dos degraus, das tipologias e dicas. **O integrador precisa ligar `top1` em `fonte/ui/textos.js`** (import e `MODULOS`); até lá o teste `casca` "índices" acusa `ui/textos/top1.js`.
- Testes: `ferramentas/testes/top1.teste.mjs` (novo, 6 testes: escada, super torre, cobertura, heliponto da mansão, tetos de triângulos por LOD e textos). Ajuste de duas linhas em `moradia-alto-padrao.teste.mjs` (nível 5 da torre e da mansão têm tipologia nova).

## Referências
Super torre: Central Park Tower e 432 Park Avenue (Billionaires' Row), 30 Hudson Yards (Hudson Yards), Marina Bay Sands (Marina Bay). Cobertura e varanda: Hudson Yards, Marina Bay, Dubai Marina. Mansão com heliponto: Palm Jumeirah, Mônaco e Cidade Jardim (São Paulo).

## Números
- Cidade sintética (8.874 prédios, Node): LOD0 somado 997.910 triângulos (R4c registrou 0,99 M; diferença abaixo de 1%), LOD1 201.712. Tipologias de topo nela: 19 super torres, 59 torres de luxo, 153 varandas com cobertura, 17 mansões com heliponto.
- Por prédio, pior caso em 24 sementes (LOD0 / LOD1; teto da família): super torre 486 / 114 (1200 / 150); torre de luxo nível 4 892 / 76 (1200 / 150); varanda com cobertura nível 5 810 / 86 (1500 / 150); mansão com heliponto 438 / 64 (600 / 150).
- Bancada (Chromium com WebGL por software, perfil `pc`, cena `bairro`, 1400 x 900): `torres` 104 chamadas e 730 mil triângulos; vista de superTorres 94 chamadas e 940 mil; mansão de perto 91 e 708 mil; torre de perto 86 e 839 mil. Longe dos 800 chamadas e 2,5 milhões. As chamadas não mudam (o setor funde por material, nenhum material, textura ou sombreador novo). Sem erros no console. Tempos de quadro do software não valem para a RX 550.
- Oficina: 237,1 KB de 250 (eram 226,5; +10,6 KB). Margem curta para as próximas parcelas.

## Capturas (só o que mudou)
`docs/entregas/onda4/cap/`: `top1-supertorres.png` (skyline com as super torres, lâminas e coroas), `top1-supertorre-perto.png` (torre alta com lâmina de pedra), `top1-mansao-heliponto.png` (mansão nível 5, disco com o H no gramado dos fundos).

## Testes
- `top1`, `geracao-predios`, `moradia-alto-padrao`, `vida-luxo`, `bemestar`, `crescimento`, `zonas` (do TOP1) verdes; `montar.mjs` em pasta temporária sem avisos; guarda de texto ok.
- `simular --testes` ainda tem falhas que não são desta parcela: `mundo` (CPU, preexistente) e, com o trabalho da ZON2 em andamento no mesmo tronco, `ambiente`, `celulas`, `cidade-completa`, `esgoto`, `mercadoria` e `mover` (erros de `FAMILIA_ZONA` antes da inicialização e de `utilidades`), e `contratos` (`zona.modo`). `casca` falha só por `ui/textos/top1.js` sem índice (acima).

## Pendências e riscos
- Ver no PC do dono (RX 550) as coberturas e as super torres de dia e de noite; no software não se mede GPU.
- A cobertura das torres de luxo do nível 4 só aparece de perto; de longe é a silhueta (LOD1 com a mesma caixa).
- Cidade turística e polo da sede: esta parcela entrega só a arquitetura. Hotéis de topo, marinas e orla de iate (Dubai Marina, Mônaco) ficam para outra parcela.
- Incidente de processo: um `git stash` meu desfez por alguns segundos as edições em andamento da ZON2 em `sim/predios.js`, `sim/zonas/*` e `data/mapa-heldopolis.js`; reaplicadas por patch sem conflito. Quem toca a ZON2 deve conferir que `git diff` desses arquivos continua completo.
