# X3b. 7 camadas a mais e Problemas

Entregue em 17/10/2026. As camadas e a aba só aparecem com o M1b no jogo (`parteNoJogo('M1b')`; `?m1b=1` ou `PARTE_ATUAL`).

## O que já existia (não refeito)
Esgoto, Trânsito, Ar, Ruído e Empregos no popover (`parte: 'M1b'`, pela revisão), os dados das 7 camadas na simulação (S1c: trânsito; S2a: valor e nível; S2b: esgoto, ar, ruído, empregos), os alertas `transitoParado*`, `faltaEsgoto`, `poluicao*` e o mapa `CAMADA_DO_ALERTA`.

## O que mudou
- **Camadas** (`ui/mundo/camadas.js`): o Nível dos prédios entrou no popover (faltava; o glifo é o `nivel`); o Valor do terreno virou `parte: 'M1b'` (só aparece com o M1b, como o contrato diz). Com o M1b o popover tem 13 camadas (6 do M1a e as 7 do M1b).
- **Cores certas**: Trânsito, Ar e Ruído usavam uma rampa que pintava o livre de vermelho (o trânsito) ou de azul (poluição). Agora vão do cinza claro, passando pelo âmbar no limite (1 no trânsito; a marca "aviso" no ar e no ruído), ao vermelho fundo; a luminância cai ao longo da rampa e há versão para daltonismo. Empregos tem duas pontas sem "bom": âmbar (morador sem emprego) e azul (vaga sem trabalhador), com cinza no equilíbrio.
- **Legenda**: pontas e marca do meio em palavras (`<chave>.curto`, ou a frase se couber em 18 caracteres), o número na dica; nova linha de **unidade por extenso** (`camada.<id>.unidade`, com `{passo}` das grades): "Pontos de 0 a 1.000 em cada quadrado de 64 m", "Fluxo dividido pela capacidade da via: 1 é a via cheia" etc.
- **Glifos próprios** (`ui/glifos/glifos.js`): `fumaca` (ar: chaminé com fumaça), `ruido` (ruído: barras de onda; o `som` segue sendo o alto-falante do volume) e `vagas` (empregos: pessoa com um mais).
- **Marcadores** (`ui/mundo/marcadores.js`): `AVISOS_DA_CAMADA` ganhou esgoto, trânsito, ar, ruído, empregos e nível (com a camada ligada, só os avisos dela).
- **Aba Problemas** da tela Cidade (`ui/mundo/problemas.js` puro; corpo em `ui/telas/corpo/Problemas.jsx`; `ui/telas/Problemas.jsx` re-exporta e fica como ponto de entrada; quinta aba em `corpo/Cidade.jsx`). Junta os alertas da cidade (`q.barra().alertas`) e os avisos de prédio (`q.avisosPredios()`, agrupados por tipo e gravidade) numa lista, do grave ao info e, dentro da gravidade, a maior contagem primeiro. Um alerta que já descreve um grupo de prédios (falta de água, energia, esgoto, obras paradas, desemprego, abandono, ar) o absorve e ganha os prédios como alvos. **Ver na camada** liga a camada do problema, fecha a tela e centraliza na aresta ou no prédio (um toque seguinte vai ao próximo lugar do mesmo problema); sem ponto, abre a tela do alerta. **Próximo** escolhe o problema seguinte (volta ao primeiro). Teclado: setas, N e Enter. O escolhido e a volta pelos prédios sobrevivem a fechar e abrir a tela.
- Textos em `ui/textos/x3.js` (`x3.prob.*`, `cid.aba.problemas`, `camada.*.unidade`, `.curto`); sem arquivo novo, o índice não mudou.

## Testes e vitrine
`ui-problemas.teste.mjs` (novo, 7 testes: agrupar e ordenar, absorção pelo alerta, Próximo e Ver, camadas e textos, as 7 camadas com a simulação de verdade, glifos, aba) e `camadas.teste.mjs` (sem mudança de teste). Cenas em `ferramentas/vitrine/cenas/x3.js`: `x3b-camadas-m1b`, `x3b-legenda-{transito,empregos,nivel,valor,esgoto}` e `x3b-problemas`, verdes em 986x443, 915x412, 1376x768 e 1920x1080 junto com as cenas da X3a.

## Pendências e o que não verifiquei
- `simular --testes`: tudo verde exceto `mundo` (tempo de CPU, preexistente) e o `ui` por causa do Mural da U2b em andamento (chaves `u2b.mural.*` ainda sem texto), que não é desta parcela.
- Não vi no jogo de verdade (WebGL): a cor das camadas sobre prédios, arestas e grades vem do render (R3a, R4a, R2a), conferida só pelo pedido e pela vitrine com o render falso; a câmera do "Ver na camada" (`R.camera.irPara`) foi conferida só com o render falso.
- O atalho para a aba a partir da faixa de alerta ("+N") não foi feito (a faixa é da U1b); a aba abre pela tela Cidade.
