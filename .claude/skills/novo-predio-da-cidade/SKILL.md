---
name: novo-predio-da-cidade
description: Receita para acrescentar um tipo de prédio da cidade, serviço ou prédio da Holding ao jogo novo - catálogo, regra por registro, gerador 3D com referência real, glifo, textos, cena, teste e robô. Use quando o dono pedir um prédio, serviço ou empresa novo. (A reescrever na C2, com o catálogo final do M1.)
---
# Novo prédio da cidade (a reescrever na C2)

O essencial do jogo novo, até a C2 reescrever. Cada passo é da parcela dona do arquivo (tabela 3.1 do
`docs/PROJETO.md`); o que for de outra parcela vira pendência para o integrador.

1. **Catálogo**: prédio de zona em `fonte/data/predios.js` (capacidade por modelo e nível, faixa de andares, D20);
   serviço em `fonte/data/servicos.js`; prédio da Holding em `fonte/data/holding.js`. Números de partida marcados
   "(calibrar)"; nada muda `REGRAS_DONO`.
2. **Regra**: serviço e prédio da Holding entram por `sim.colocaveis.registrar(tipo, def)` (o comando `construir` é
   um só); custos por `sim.custos.registrar`; avisos e camadas por `sim.avisos` e `sim.camadas`. Teste em
   `ferramentas/testes/<area>.teste.mjs`.
3. **Modelo**: `fonte/data/colocaveis.js` com a referência real, LOD0, LOD1 e o teto de triângulos (D60); gerador
   puro em `fonte/render/colocaveis/<familia>.js` (sem three), registrado com `registrarGeradorOficina`; frente em
   +z com `rot = 0`, 1 unidade = 1 m; LOD1 com a mesma caixa do LOD0.
4. **Interface**: glifo por `registrarGlifos`, textos em `fonte/ui/textos/<parcela>.js` (sem travessão, unidades da
   D42), seção da folha por `registrarSecao` se o efeito for novo.
5. **Cena e medida**: o prédio aparece na cena `servicos` (ou na da parcela); `bancada.mjs` verde e uma captura de
   perto e de longe (skill `capturas-de-aceite`).
6. **Robô**: a estratégia de `ferramentas/robo/robo-sim.mjs` usa o tipo quando ele for parte do laço.
7. Siga a skill `verificar-e-publicar`.
