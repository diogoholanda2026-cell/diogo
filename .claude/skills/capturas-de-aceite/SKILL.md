---
name: capturas-de-aceite
description: Como capturar cenas 3D do jogo novo no Chromium de teste (sem GPU) - cenas fixas por ?cena=, perfis, câmera e a medida de chamadas e triângulos pela bancada. Use para conferir modelos, obras, a Torre e o orçamento gráfico. (A reescrever na C2, com as cenas finais do M1.)
---
# Capturas de aceite (a reescrever na C2)

O essencial do jogo novo, até a C2 reescrever com as cenas finais:

- **Montagem** numa pasta temporária: `node ferramentas/montar.mjs --saida <scratch>/montagem`.
- **Uma captura**: `node ferramentas/testar.mjs --pasta <scratch>/montagem --consulta "cena=<nome>&q=media&pr=1"
  --tam 1376x768 --espera 1500 --saida <scratch>/<nome>.png`. A saída JSON traz `stats` (o `R.stats`: `calls`,
  `tris`, `callsSombra`, `trisSombra`, `familias`) e `resultado` (`window.__resultado`). `--script` roda código na
  página depois de `window.__pronto` (`window.__held` = { sim, R, ui }); `--semClip` e `--webgpu` são opcionais.
- **Números para o orçamento** saem da bancada, não da captura: `node ferramentas/bancada.mjs --pasta <montagem>
  --cenas aberta,rua,horizonte --perfis leve,media,ultra` (pior quadro de 120 com o sol andando, PNG e JSON por
  cena). Metas: 4.8 e A6 do `docs/PROJETO.md`.
- **Cenas do aceite (A10)**: `aberta` (10h), `rua` (16h), `bairro` (9h), `horizonte` (17h30), `costa` (12h), `obra`
  (10h), `servicos` (15h), `camadas`, `ferramentas`, `noite` (21h) e a prancha da Torre (4 azimutes às 17h30 e 2
  closes a 30 m). Cada parcela registra as suas cenas em `fonte/render/cenas/` (`registrarCena`).
- **SwiftShader** desenha poucos quadros por segundo: espere o `__pronto`, fixe hora e câmera pela consulta da cena
  e evite animação na captura. Obras: crie a obra com `obraIni` no passado para a fase aparecer.
- Interface sem WebGL: `ferramentas/vitrine-ui.mjs` (render falso), não esta skill.
- Mande ao dono só as capturas que mostram o que mudou.
