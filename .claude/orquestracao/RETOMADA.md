# Retomada da onda 2 (pausada em 28/09/2026, 06:03 UTC)

Pausa pedida pelo dono antes do limite de uso de 5 horas. Nada rodando.

## Estado
- Onda 1 e Prévia 0: prontas e publicadas (`00368d1` fonte, `87e60d7` montagem em `previa/`).
- Portão 1: plano A (Baía) adotado por padrão (`4acc370`). O dono pode trocar.
- Onda 2: as quatro parcelas pararam no meio da implementação, sem revisão. Trabalho parcial no commit
  "Jogo novo, onda 2 em andamento (pausada)". Base da onda para os revisores: `4acc370`.
  - S1b: faltam os patamares nos cruzamentos em declive, os testes `vias` e `celulas`, as medidas.
  - R1b: faltam a pirâmide de alturas, a conferência da luz, da hora dourada e da noite, a bancada.
  - R3a: falta montar e abrir a cena rua pela primeira vez, o teste `geracao-vias`, as capturas.
  - X2: falta a conferência visual da vitrine e da cena ferramentas.
  Testes no estado pausado: 12 áreas verdes; falham `casca` (canteiro de prova) e `mundo` (Vila e rodovia),
  provavelmente pelas mudanças parciais da S1b em `data/vias.js` e `sim/vias`. `previa/` e `app/` não foram tocados.
  A linha "ONDE PAROU" no fim de cada `parcelas/<id>.txt` diz o ponto exato.

## Como retomar (integrador)
1. Os textos usam o caminho do scratchpad. Se o contêiner foi reciclado, copie esta pasta para lá:
   `S=/tmp/claude-0/-home-user-diogo/f46543ed-2f24-59fc-a862-962bb146c549/scratchpad/cs2; mkdir -p $S && cp -r .claude/orquestracao/* $S/`
   (se o caminho do scratchpad mudou, troque o caminho antigo pelo novo em `onda.js`, `impl-ctx.txt` e `parcelas/*.txt`).
2. Relance as duas duplas com o mesmo `onda.js`, sempre com `"base": "4acc370"`:
   - `{"nome": "Onda 2 (a)", "base": "4acc370", "etapas": [[{"id": "S1b"}, {"id": "R1b"}]]}`
   - `{"nome": "Onda 2 (b)", "base": "4acc370", "etapas": [[{"id": "R3a"}, {"id": "X2"}]]}`
3. Nunca use `resumeFromRunId`: ele refaz tudo o que vem depois da primeira chamada que falhou. Se uma parcela
   falhar de novo, relance só ela; se só a revisão faltar, passe o resultado pronto em `impl` para pular a
   implementação.
4. Faça um commit de segurança a cada parcela que terminar a revisão.
5. Com as quatro revisadas, rode a I1 (`[[{"id": "I1", "revisar": false}]]`), acrescente em `parcelas/I1.txt` os
   caminhos dos relatórios das duplas, commite a fonte e depois a montagem da Prévia 1 em `previa/`.
