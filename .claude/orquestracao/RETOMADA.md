# Retomada da Prévia 1 (pausada em 28/09/2026, 12:16 UTC)

Pausa pedida pelo dono. Nada rodando.

## Estado
- Onda 1 e Prévia 0: prontas e publicadas (`00368d1` fonte, `87e60d7` montagem em `previa/`). O site agora publica
  `previa/` (`5c50624`, pages.yml).
- Portão 1: plano A (Baía) adotado por padrão (`4acc370`).
- Onda 2: as quatro parcelas (S1b, R1b, R3a, X2) prontas e revisadas (`7ccca28`, `ed81c43`).
- I1 (integração da Prévia 1): pausada no meio. O que ela fez está no commit "Prévia 1: integração em andamento
  (pausada)"; a base dela é `7cc08c5`. Com isso, `simular --testes` passa nas 16 áreas e o jogo monta com 1.530 KB
  (dentro do teto de 1.638 KB) e 120 KB sob demanda. Faltam: o roteiro automatizado no Chromium, as capturas de
  aceite, a bancada, a montagem final em `previa/` e o relatório. A linha RETOMADA no fim de `parcelas/I1.txt` diz o
  ponto exato.
- `previa/` continua sendo a Prévia 0 publicada (a montagem parcial da I1 foi descartada, não estava conferida).

## Como retomar (integrador)
1. Os textos usam o caminho do scratchpad. Se o contêiner foi reciclado, copie esta pasta para lá:
   `S=/tmp/claude-0/-home-user-diogo/f46543ed-2f24-59fc-a862-962bb146c549/scratchpad/cs2; mkdir -p $S && cp -r .claude/orquestracao/* $S/`
   (se o caminho do scratchpad mudou, troque o caminho antigo pelo novo em `onda.js`, `impl-ctx.txt` e `parcelas/*.txt`).
   Os relatórios das parcelas (`tasks/*.output`) somem com o contêiner; nesse caso as notas de entrega no fim de cada
   ficha do `docs/PROJETO.md` e a lista de pendências em `parcelas/I1.txt` bastam.
2. Relance só a I1: `{"nome": "Prévia 1", "base": "7cc08c5", "etapas": [[{"id": "I1", "revisar": false}]]}`.
3. Nunca use `resumeFromRunId`: ele refaz tudo o que vem depois da primeira chamada que falhou.
4. No fim: conferir as capturas, commit da fonte, depois "Montagem da Prévia 1" com `previa/`, push, e conferir no
   GitHub (actions) que o "Publicar no GitHub Pages" passou antes de mandar o link ao dono.
5. Depois vem a onda 3 (S2a, S3a, R2b, R3b, R4b, R5, U1b, U2a, X1b, X3a) até o M1a; os textos dessas parcelas ainda não
   foram escritos.
