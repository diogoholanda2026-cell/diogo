---
name: novo-predio-da-cidade
description: Receita para acrescentar um tipo de prédio, empresa ou lugar especial à cidade da Arcologia de Held - dados, regra, modelo 3D por nível, ícone, textos do painel, robô, teste e README. Use quando o dono pedir um prédio, serviço, empresa ou equipamento novo.
---
# Novo prédio da cidade

1. **Dados** (`fonte/data/cidade.js`, objeto `CIDADE`): `cat` (moradia, comercio, servico, lazer, empresa), `nome`,
   `sub`, `icone`, `cap` (capítulo), `max` (níveis), `custo[]` e `tempo[]` por nível (índice 0 = 0). Conforme o tipo:
   `popNivel[]`, `servico {agua|energia|saneamento}`, `bem`, `renda`, `cobre {policia|saude|educacao|superior: raio}`,
   `unico`, `lucro`/`empregos`/`efeito` (empresa, com `EFEITO_EMPRESA`), `lugar` (área especial em `LUGARES`).
2. **Regra** (`fonte/sim/estado.js`): só se o tipo tiver efeito novo (siga o padrão de `_empresas`, `rendaCidade`,
   `servicos`). Documente no cabeçalho.
3. **Modelo** (`fonte/render/cidade.js`): função `(n, seed)` com `new Nivel(n)`, peças do nível n, `return N.fim()`;
   registre em `MODELOS` e a altura do topo em `alturaDe`. Frente em +z, lote 4 x 4, pavimento FH.
4. **Ícone** (`fonte/ui/icones.js`): função 96 x 96 com o mesmo nome do `icone` (confira que não existe).
5. **Painel** (`fonte/ui/paineis.js`): `efeitoCidade` e a descrição em `r_modulo` se o efeito for novo.
6. **Robô**: inclua o tipo na lista `CID` de `ferramentas/robo-partida.js` (lugares especiais em `LUGAR`).
7. **Teste de regra** em `ferramentas/simular.mjs` (use `cc(J, f, lote)`, que desmata o lote antes).
8. **Captura** do modelo em todos os níveis (skill `capturas-de-aceite`) e **README** (seção da cidade).
9. Siga a skill `verificar-e-publicar`.
