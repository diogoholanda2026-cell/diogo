# Estado do jogo novo (28/09/2026)

## ONDE PAROU (03/10/2026)

**Prévia 2 "M1a jogável" publicada** (fonte `ae3f72e`, montagem `d2f1c6a`; GitHub Pages ok):
https://diogoholanda2026-cell.github.io/diogo/previa/cenas.html. Onda 3 inteira revisada e integrada (notas em
`docs/entregas/onda3/`); D91 (teto do JS em 2,3 MB) e D92 (etapas da Arcologia a um terço, D48 só nos itens da cadeia
da Holding, A2 em 6 sementes). Testes ok; montagem sem aviso; 0 compilações depois de pronto. CI "Robô de equilíbrio"
consertado (`4da958c`: rodava um script do jogo antigo; agora `npm ci` e `simular:testes`; verde nos commits `4da958c` e `21aad60`).

**Medida do dono na Prévia 2 (03/10/2026, `docs/pesquisa/pc-dono/medida-2026-10-03.md`):** 21 qps na vista do jogo, com o
terreno em 36 ms de 46 (80%). **PC3 feita e publicada na Prévia 2b** (fonte `6c4e48f`): passe do terreno -52% na vista
do jogo pela proporção no SwiftShader (uns 17 ms estimados na RX 550, meta 12), 0 compilações usando as ferramentas.
Falta a nova medida do dono; próximos cortes na nota da PC3 (`docs/entregas/onda3/PC3.md`).

**VIS1 entregue e integrada** (04/10/2026, notas em `docs/entregas/vis1/`): faixa de LED de um terço (9 e 7 andares),
vidro dos anéis, Helix e Compass, parque e Supertrees; carros, caminhões, gente e árvores de rua pela vegetação.
**VIS1c e VIS1d entregues; Prévia 2c publicada** (04/10/2026): árvores com folha e sombra de longe, sede sem pasto,
sombra do entardecer a 50% e longa até 3,5 km. Esperando a medida e o olhar do dono na Prévia 2c. Próximo: a SEDE4
(D97, texto pronto em `.claude/orquestracao/parcelas/SEDE4.txt`) e depois a onda 4 (com MOV1 e R4c).

**Esperando o dono:** jogar a Prévia 2 e medir no PC dele (Teste de desempenho e página de teste com ?q=), e julgar o
visual: anéis da sede como muralha listrada sem sombra no chão, Helix Labs e Compass Tower como silos, parque central
ralo, Supertrees como varetas, árvores de rua facetadas, traseira dos carros clara com o sol baixo, cabine do caminhão
lisa e gente low-poly; e decidir: manutenção das 24 avenidas da sede (recomendação: no custo da Arcologia), primeira
quadra sugerida de indústria, Areal como segunda sugestão do objetivo da Pedreira, cor da Holding nos caixilhos e 307
px livres com alerta em 986 x 443. Próximo passo recomendado: uma passada visual (sede, rua e árvores) antes da onda 4.

**Pedido do dono em 04/10/2026:** faixa de LED com um terço dos andares (D93, entregue na VIS1a); mover e girar
construções prontas (D94, MOV1); moradia no mínimo de classe média alta (D95, R4c e S2b); sede v4 com Canopy Bridges,
Mirror Lake grande, Dream Falls de 120 m, Halo Lake e mata densa (D97, aprovada, parcela SEDE4); plano por disciplinas
(D96, `docs/desenho/producao.md`).

**Pedido do dono em 06/10/2026 (13 melhorias, por etapa em `producao.md`, seção 5):** D98 colocar com giro livre, motivo
do vermelho, escolha livre e obras em paralelo (UX1); D99 toque no Poco X7 e app estável (TOQ1); D100 Modo Presença
(interiores, helicóptero, F1, arenas, propriedades do dono; `docs/desenho/presenca.md`, M2 a M5); D101 governo do grupo
(dirigir, negociar, banco intragrupo; `docs/desenho/grupo.md`, M3, M5 e M6); D102 animação das obras (OBR2) e fluidez.
**PAUSA por limite de sessão (06/10/2026, 09:30 UTC; retomada às 18:30):** UX1 e TOQ1 caíram depois de uns 200 passos cada,
com a maior parte feita (ver o ONDE PAROU no topo de `parcelas/UX1.txt` e `TOQ1.txt`); SEDE4 e MOV1 não começaram. WIP guardado
em commit de guarda. Relançar com a mesma base `1775464`.
**Workflow lançado em 06/10/2026:** etapa 1 = UX1 e TOQ1; etapa 2 = SEDE4 e MOV1. Depois: OBR2, R4c, S1c, S2b, S3b, X4,
R6, X3b, U2b e a C2. Se parar no meio, grave o parcial e relance com ONDE PAROU.

Decisões até a D102 registradas.

## Feito
- Onda 1 e Prévia 0 (`00368d1`, `87e60d7`). Portão 1: plano A (Baía) adotado por padrão (`4acc370`).
- Onda 2 (S1b, R1b, R3a, X2) revisada (`7ccca28`, `ed81c43`) e integrada pela I1 (`424d396`, `2f82e7f`).
- Prévia 1 "via no polegar" montada e publicada em `previa/` (`cc8856d`); o site publica `previa/` (`5c50624`).

## Decisões novas do dono (D63 a D90)
- Sede em anel como a Apple Park, lago central com fontes e cachoeira em ciclo, torres de 500 e 452 m quase encostadas,
  cúpula de vidro de 240 m; PC primeiro (RX 550, medido em `docs/pesquisa/pc-dono/`).
- D67 a D70 (30/09 e 02/10/2026): história em três partes e dólar (`docs/desenho/historia.md`); complexo de lazer e esporte,
  com três esferas no lugar da cúpula, F1, arenas, shopping e parque (`docs/desenho/marcos.md`); PC atual como alvo em
  todas as partes, upgrade depois; visitantes, trem-bala, moradia social, aeroportos com Modo Visita e economia do visitante e ampliações do complexo (`docs/desenho/cidade.md` e `marcos.md`, D71 a D76).
- D77 a D86 (02/10/2026): país Vera Cruz do Leste, eventos reais e a história do caderno do dono (`historia.md` e
  `docs/pesquisa/historia-dono/`). Cada construção é dialogada com o dono antes de ser feita.
  Nada disso está no código; o M1 e a onda 3 não mudam.
- D87 (dinheiro em unidades, exibido em dólar), D88 (sede v3, Park of Future Dreams, nomes de construção em inglês) e
  D89 (nomes, torres, 8 trechos do Horizon Ring, Lucullus Tower). D90: sede no sul da área inicial, que passa a 6 x 5
  ladrilhos (`docs/pesquisa/sede/sede-v3.md`, seção 5).

## Próximo passo
- Portão 2: o dono roda o roteiro de 5 min e a página de teste da Prévia 1b (previa/cenas.html) no PC dele.
- Pendências da I2 para a onda 3: aquecimento com mínimo de quadros (via e edificio compilaram depois de pronto na cena
  ferramentas); estresse sem ?q= fixa o Média; opção 'pc' nas Configurações (U2a); textos do plano A antigo (U1b, X1b);
  X1b usa criarPar, torre.corte(h), POUSO (275, 500, 570) e o canal na cavaDoPlano; volumes quadrados da moradia,
  Universidade e Escola, árvores e Supertrees (R2b, R5); jatos das fontes finos de perto à noite.
- Onda 3 (S2a, S3a, R2b, R3b, R4b, R5, U1b, U2a, X1b, X3a) até o M1a: os textos dessas parcelas ainda não foram
  escritos. Escreva-os em `parcelas/` no mesmo formato das ondas 1 e 2 (texto da ficha, o que a Prévia 1 mostrou,
  `_comum` da onda) antes de lançar, com a base no último commit.
- Pendências herdadas para a onda 3 estão nas notas de entrega de cada ficha do `docs/PROJETO.md` e no relatório da I1
  (manchas escuras nos morros e mar raso em polígono no mapa inteiro, rio cinza: R2b; árvores em bola: R2b; chip de
  encaixe sobre a cota em 986x443: U1b ou X2; prioridade nos cruzamentos e realce da aresta: R3b).

## Regras que evitam erro
1. Os textos usam o caminho do scratchpad. Se o contêiner foi reciclado, copie esta pasta para lá:
   `S=/tmp/claude-0/-home-user-diogo/f46543ed-2f24-59fc-a862-962bb146c549/scratchpad/cs2; mkdir -p $S && cp -r .claude/orquestracao/* $S/`
   (se o caminho do scratchpad mudou, troque o caminho antigo pelo novo em `onda.js`, `impl-ctx.txt` e `parcelas/*.txt`).
2. Nunca use `resumeFromRunId`: ele refaz tudo o que vem depois da primeira chamada que falhou. Relance só o que falta;
   se só a revisão faltar, passe o resultado pronto em `impl`.
3. Commit de segurança a cada parcela revisada. Na pausa: pare os workflows, devolva `previa/` ao último publicado se
   houver montagem não conferida, commite a fonte e anote ONDE PAROU no texto de cada parcela.
4. Antes de mandar link ao dono, confira no GitHub (actions) que o "Publicar no GitHub Pages" passou.
