---
name: capturas-de-aceite
description: Como capturar cenas 3D da Arcologia de Held no Chromium de teste (sem GPU) - montar a cena por script, posicionar a câmera, obras com operários nos postos, e medir chamadas de desenho e triângulos. Use para conferir modelos, obras, lugares e o orçamento gráfico.
---
# Capturas de aceite

- Ferramenta: `node ferramentas/testar.mjs <png> "teste=1&novo=1&q=alta" 1232 555 <ms> "<script>"`. O script roda
  na página (`window.__held` = {engine, rig, env, mundo, obras, J, C, ...}); embrulhe em `{ ... }` e sem `return`.
  A saída JSON traz `st.calls` e `st.tris`; `window.__resultado` volta em `res`.
- SwiftShader desenha 1 quadro a cada 5 a 7 s em Alta: animações quase não andam. Para obras, crie a obra com
  `m.obra.ini = agora - 1 h` e `fim = agora + 30 min`, remova os canteiros (`C._removerSite`) e chame
  `C.sincronizar()`: os operários já nascem nos postos (novo = false).
- Prédios prontos: `construirCidade` (desmate antes: `C.desmatar(lote)` ou `J.S.cidade.limpos[lote] = 1`), depois
  `m.nivel = N; m.obra = null`, `J._derivar()`, `C.sincronizar()`, `H.mundo.refundirAgora()`.
- Câmera: `H.rig.pitchFix = null; H.rig.target.set(x, 0, z); H.rig.dist = D; H.rig.yaw = Y; H.rig.tilt = T; H.rig.apply()`.
  Remova balões (`document.querySelectorAll('.balao,.bolha').forEach((e) => e.remove())`).
- Orçamento: vista aberta (dist 150+) com a Arcologia completa (todas as etapas `feita`, módulos no máximo) e 150+
  prédios da cidade no nível máximo. Registre chamadas e triângulos no README.
- Mande ao dono só as capturas que mostram o que mudou.
