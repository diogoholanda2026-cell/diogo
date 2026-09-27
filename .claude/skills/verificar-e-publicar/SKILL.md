---
name: verificar-e-publicar
description: Verifica e publica uma mudança do jogo novo da Arcologia de Held - monta numa pasta temporária, roda os testes e a guarda de texto, a bancada gráfica, a vitrine da interface e o robô, e publica os commits de fonte (e, só nas prévias e na publicação do M1, a montagem). Use ao terminar qualquer parcela ou etapa antes de enviar.
---
# Verificar e publicar (jogo novo)

Critérios: `docs/PROJETO.md`, 4.3 (A1 a A11) e a entrega da ficha da parcela (4.5). Arquivos temporários só no
scratchpad da sessão. Nunca edite `antigo/`, `app/`, `arcologia-de-held.html` nem `previa/` numa parcela.

1. **Montar** numa pasta temporária: `node ferramentas/montar.mjs --saida <scratch>/montagem` (acrescente `--unico`
   para conferir o HTML único). Aceite: sem avisos (chave duplicada é bug), `guarda-texto ok`, JS principal até
   1,6 MB, worker `tarefas` até 150 KB e `oficina` até 250 KB. Só o integrador monta `previa/` (sem `--saida`), nas
   prévias 0 e 1 e no M1a; `--saida app --publicar-m1` só na publicação do M1 (C2).
2. **Testes**: `node ferramentas/simular.mjs --testes` até `testes ok` (todo `ferramentas/testes/*.teste.mjs`, cada um
   num processo, e a guarda de texto). Quando mexer em estado ou save, também `--determinismo`; em sistema do tique,
   `--bancada` (A5).
3. **Bancada gráfica** (render): `node ferramentas/bancada.mjs --pasta <scratch>/montagem --cenas <cenas da parcela>
   --perfis leve,media,ultra --saida <scratch>/bancada` até `bancada ok` (pior quadro de 120, orçamento e famílias da
   4.8, guarda do Mali). A cena `jogo` abre o jogo sem `?cena=`.
4. **Vitrine** (interface): `node ferramentas/vitrine-ui.mjs <scratch>/ui <cenas | todas>
   986x443,915x412,1376x768,1920x1080` até `sem erros de página` e `vitrine ok`.
5. **Robô**: `node ferramentas/simular.mjs --robo --horas 12` (da S3a em diante) e o robô no navegador da C1 com
   `node ferramentas/testar.mjs --pasta <montagem> --script <robô> ...` em segundo plano (5 a 15 min). Não remonte a
   pasta enquanto um robô roda.
6. **Capturas** só do que mudou (skill `capturas-de-aceite`), no máximo 4 pequenas por rodada.
7. **Commits** (mensagens em português, com as linhas de atribuição que a sessão indicar; quem commita no M1 é o
   integrador):
   - fonte: `git add fonte ferramentas docs CLAUDE.md README.md .claude package.json package-lock.json`;
   - montagem, só nas prévias (`previa/`) e na publicação do M1 (`app/` e `arcologia-de-held.html`), num commit
     "Montagem ..." depois do da fonte.
8. `git push -u origin <branch>`; só repita em erro de rede (2, 4, 8, 16 s).
9. Resposta ao dono em português: o que mudou, como foi verificado (números medidos), o que não foi feito.
