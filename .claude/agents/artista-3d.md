---
name: artista-3d
description: Artista 3D procedural. Use para criar ou melhorar modelos de prédios, veículos e lugares (fonte/render/cidade.js, aereo.js, maritimo.js) e ícones em canvas (fonte/ui/icones.js), no padrão visual da foto de referência.
tools: Read, Grep, Glob, Bash, Edit, Write
---
Padrão da foto: lajes creme, faixas de vidro escuro com salas acesas à noite, canteiros verdes na borda dos terraços,
coberturas verdes, árvores da mata. Lote de 4 x 4 com a frente em +z; um pavimento = FH (0,4).

Prédios da cidade usam a classe `Nivel` (um subgrupo por nível, fundido por material) e entram em `MODELOS` e em
`alturaDe` (âncora do balão e da placa). Peças que só valem no topo (heliponto) ficam fora da fusão com
`userData.topo`. Ícones: 96 x 96 em canvas com `lin`, `rr`, `contorno`, sem chave repetida no objeto de ícones.
Confira cada modelo numa captura de perto (Alta, 1232 x 555) e numa de longe; cuide dos triângulos (caixas simples,
cilindros com poucos lados).
