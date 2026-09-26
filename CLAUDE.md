# Arcologia de Held: guia do projeto para o Claude

Jogo de construção e negócios em 3D (three.js r186), PWA, para PC e para o Poco X7 do dono. A visão, as referências
(Cities: Skylines II e Highrise City), a avaliação de plataforma e o roteiro por fases estão em `docs/VISAO.md`:
leia antes de propor ou começar uma fase.

## Como o dono trabalha
- Fala português do Brasil; responda em português: resultado primeiro, frases curtas, sem travessão.
- Joga sozinho; dá autonomia ("pode continuar sem pedir permissão"), mas é sensível a custo: não repetir etapas já
  feitas, capturas só as necessárias.
- Regras de economia fixadas por ele (não mudar sem pedido): lotes de 1 a 10, vendas no Depósito a 150% do preço
  base (até 100 por janela), empréstimo (50 mil por ano, 10% ao ano, dívida até 500 mil) e renda de 5/8/11 créditos
  por morador por hora conforme o bem-estar.

## Estrutura
- `fonte/` código (ES modules): `sim/estado.js` (regras, save, eventos: toda regra nova passa por aqui),
  `data/` (itens, obras, história, cidade: bairros, lotes, tipos, empresas, lugares), `render/` (engine, mundo,
  cidade, obra, arredores, aéreo, marítimo, floresta, figuras), `ui/` (HUD, painéis, ícones em canvas, CSS),
  `jogo.js` (Controle: liga simulação, 3D e interface), `main.js` (arranque, câmera, laço).
- `app/` e `arcologia-de-held.html` são gerados por `node ferramentas/montar.mjs`. Nunca editar à mão.
- `ferramentas/`: `montar.mjs`, `testar.mjs` (Chromium com SwiftShader: sem GPU, poucos quadros por segundo),
  `robo-partida.js` (joga a partida inteira no navegador), `simular.mjs` (simulação sem navegador e `--testes`),
  `vitrine-ui.mjs` (capturas da interface sem WebGL), `cap-obra.mjs` (capturas da obra com relógio preso).

## Verificação antes de publicar
1. `node ferramentas/montar.mjs` (sem avisos de chave duplicada).
2. `node ferramentas/simular.mjs --testes` → `testes ok`.
3. Robô: `node ferramentas/testar.mjs <png> "teste=1&novo=1&q=leve&pr=1" 700 400 2000 "$(cat ferramentas/robo-partida.js)"`
   (5 a 15 min; rode em segundo plano). Aceite: `cap 6`, `vida 100`, `erros []`, sem linhas `error:`.
4. `node ferramentas/vitrine-ui.mjs <pasta> <cenas|todas> 986x443,915x412 noite` → `sem erros de página`.
5. Capturas 3D só do que mudou (script em `testar.mjs`; para obras, crie a obra com `ini` no passado para os
   operários já estarem nos postos). Não reconstrua `app/` enquanto um robô estiver rodando.

## Publicação
- Branch de trabalho indicado na sessão; `git push -u origin <branch>`.
- Dois commits: primeiro a fonte (`fonte/`, `ferramentas/`, docs), depois "Montagem ..." com `app/` e
  `arcologia-de-held.html`. Mensagens em português. O GitHub Pages publica o branch.
- README: seções da cidade e de gráficos acompanham o que mudou (números medidos, não estimados).

## Orçamento gráfico (meta)
PC Ultra até 1.500 chamadas e 5 milhões de triângulos; Poco X7 Média até 300 chamadas e 900 mil triângulos. Meça
com `engine.stats` (calls, tris) numa vista aberta com a cidade grande. O painel de desempenho (Configurações >
Vídeo) mostra o mesmo no aparelho do dono.

## Receitas
- Novo prédio da cidade: skill `novo-predio-da-cidade`. Verificar e publicar: skill `verificar-e-publicar`.
  Capturas: skill `capturas-de-aceite`. Agentes especializados em `.claude/agents/`.
