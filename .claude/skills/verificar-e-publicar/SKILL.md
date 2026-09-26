---
name: verificar-e-publicar
description: Verifica e publica uma mudança da Arcologia de Held - monta o app, roda os testes de regra, o robô de partida completa e a vitrine da interface, e publica em dois commits (fonte e montagem) no branch de trabalho. Use ao terminar qualquer etapa antes de enviar.
---
# Verificar e publicar

1. `cd /home/user/diogo && node ferramentas/montar.mjs` e confira: nenhum aviso (chave duplicada é bug).
2. `node ferramentas/simular.mjs --testes` até `testes ok`.
3. Robô em segundo plano (5 a 15 min):
   `node ferramentas/testar.mjs <scratch>/robo.png "teste=1&novo=1&q=leve&pr=1" 700 400 2000 "$(cat ferramentas/robo-partida.js)" > <scratch>/robo.txt 2>&1`
   Leia a primeira linha JSON (`res`): aceite com `cap 6`, `vida 100`, `eco.erros` vazio e nenhuma linha `error:`.
   Não rode `montar.mjs` enquanto o robô estiver rodando.
4. Interface: `node ferramentas/vitrine-ui.mjs <scratch>/ui <cenas|todas> 986x443,915x412 noite` → `sem erros de página`.
5. README: atualize as seções que a mudança toca, com números medidos.
6. Commits (mensagens em português, com as linhas de atribuição que a sessão indicar):
   - `git add fonte ferramentas README.md docs CLAUDE.md .claude` → commit da fonte;
   - `git add -A app arcologia-de-held.html` → commit "Montagem ...".
7. `git push -u origin <branch>`; só repita em erro de rede (2, 4, 8, 16 s).
8. Resposta ao dono em português: o que mudou, como foi verificado (números do robô), o que não foi feito.
