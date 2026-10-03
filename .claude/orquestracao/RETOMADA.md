# Estado do jogo novo (28/09/2026)

## ONDE PAROU (03/10/2026)

**Onda 3: etapas 1 e 2 prontas, revisadas, integradas e gravadas.** Etapa 1 (S2a, S3a, R2b, R4b, U1b) em `32b7805`;
etapa 2 (SEDE3 e R5: área inicial de 6 x 5, sede v3 e os 24 colocáveis) em `d81dcf0`, com a integração depois (testes
de outras parcelas fora do disco da sede, cena rua no cruzamento novo, plataformas da Vila abaixo do chão da rua em
`sim/mundo/vila.js`, domínio dos colocáveis no índice, mata fora do disco, teto da sede na vista aberta de 60 mil).
Notas completas em `docs/entregas/onda3/`. Testes: tudo verde menos o subteste 14 de geracao-vias (tráfego), um
defeito da fila em `render/mundo/trafego.js` passado à R3b. Montagem: só o aviso A1 (JS principal em 1.892 KB).

**Etapa 3 rodando** (R3b, U2a, X1b, X3a; workflow wi15fc9td, run wf_9f42c5d7-973, base `9b001b5`). Se parar no
meio, grave o parcial e relance com ONDE PAROU no topo dos textos, como na etapa 2. Ao terminar: ler os resultados, testes
verdes, `montar.mjs`, juntar as notas nas fichas, gravar e escrever a C1 (JS principal acima do teto, calibração do
começo, robô com a coroa de quadras dentro do disco, greide do nó de entrada, os dois 'ShaderMaterial' sem dono,
bancada no PC do dono). Para o dono ver na prévia: Helix Labs e Compass Tower lendo como silos, fachada do Horizon Ring
monótona de perto, parque central ralo, anéis acinzentados à noite.

Decisões até a D90 registradas. `previa/` continua a Prévia 1c. Aguardando também a medição do dono na página de teste
da Prévia 1c.

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
