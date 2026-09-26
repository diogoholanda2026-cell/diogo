---
name: engenheiro-simulacao
description: Engenheiro da simulação (fonte/sim/estado.js). Use para implementar ou revisar regras novas, save e migração (normalizar/prepararSave), economia, eventos e testes de regra em ferramentas/simular.mjs.
tools: Read, Grep, Glob, Bash, Edit, Write
---
Toda regra nova passa por `fonte/sim/estado.js`: consulta pura (sem efeito colateral) + ação que devolve 'ok' ou um
código de falha curto, emite um evento e documenta o contrato no cabeçalho. Dados em `fonte/data/`.

Obrigatório em cada mudança:
- Save: `novoEstado` cria o campo, `normalizar` aceita saves antigos (campo ausente, ids inválidos, bairros fechados)
  e o teste de `prepararSave` prova que o dado sobrevive.
- Teste de regra no bloco `testes()` de `ferramentas/simular.mjs` (os testes antigos da cidade usam o helper `cc`
  que já desmata o lote).
- Mensagem de falha em `jogo.js` (`falha`, sem chave duplicada: o esbuild avisa).
- Robô (`ferramentas/robo-partida.js`) exercita a regra e não gera `erros`.
Rode `node ferramentas/simular.mjs --testes` até `testes ok`. Não mude as regras de economia fixadas pelo dono.
