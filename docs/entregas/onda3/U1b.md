# U1b: HUD, seleção e gestão (nota de entrega)

## Resultado
- Data do calendário real (D67): "mar. 2021" na barra, na Economia e no Conselho; a dica da hora diz "hora de jogo: 1 h real em 1x, 6 meses do calendário".
- Dinheiro em dólar (D68, D87) só por `ui/formato.js` com `REGRAS_DONO.moeda` (US$, fator 600), curto em pt-BR: "US$ 30 mi", "US$ 1,2 bi", "+US$ 4.800/h". As consultas mandam unidades; nenhuma tela multiplica. Economia e cartão da U1a convertidos.
- Conselheiros com nome completo e cargo no Conselho; quem propõe em cada cartão da decisão. Nada do plano A antigo nos textos.
- HUD: velocidade com pausa automática nos modais (e nas telas no toque), faixa de alerta com "Caixa zerado" e as três saídas da D41, avisos curtos, os 3 objetivos (aberto na primeira hora, chip depois), trilho da vista, "Onde você parou", menu (tela `menu` com Ajuda), menu de contexto radial.
- Seleção: cartão e folha por tipo (residencial, comercial, industrial, serviço, empresa da Holding, via, terreno), com o "faz", cores, renomear, navegação e avisos com ação.
- Telas sob demanda: Holding (visão geral, produção com lotes e a sugestão, Mercado com "N de 100 vendas nesta janela" e "Abastecer a cidade por importação", imóveis; Influência e Legado com o efeito escrito), Cidade (demanda com fatores, bem-estar com a margem, serviços), Progresso (marcos, áreas, Arcologia), Conselho (decisões, histórico, conselheiros), modal de decisão e momentos (título de terço inferior, modal do marco).

## Arquivos
Novos: `fonte/ui/telas/corpo/{sobDemanda,comum,Holding,Cidade,Progresso,Conselho,Decisao,Momento,Menu}.jsx`.
Alterados (da U1b): `fonte/ui/hud/{Velocidade,Trilho,Objetivo,FaixaAlerta,Avisos,Menu,Retomar}.jsx`, `fonte/ui/selecao/Folha.jsx`, `fonte/ui/selecao/secoes/{residencial,comercial,industrial,servico,empresa,via,terreno}.jsx`, `fonte/ui/telas/{Holding,Cidade,Progresso,Conselho,Decisao,Momento}.jsx`, `fonte/ui/mundo/MenuContexto.jsx`.
Herdados da U1a: `fonte/ui/formato.js`, `fonte/ui/hud/BarraCima.jsx`, `fonte/ui/selecao/Cartao.jsx`, `fonte/ui/telas/Economia.jsx`, `fonte/ui/comp/Folha.jsx`, `fonte/ui/tema/{hud,folha,telas}.css`, `fonte/ui/textos/u1.js`, `ferramentas/testes/ui.teste.mjs`, `ferramentas/vitrine/cenas/u1.js`.
Da F0, pedido na ficha: `ferramentas/vitrine/sim-falsa.js` (datas do calendário, unidades, decisões, marcos, produção, prédio da Holding, eventos para '*'; a cidade do meio roda em 1x e sem alerta, o de água liga com `sim.estado.alertaAgua`).

## O que publica
- `ui.momento(dados)` e `registrarEtapaMomento(fn)` (telas/Momento.jsx), fila de modais `enfileirar`; `abrirDecisao(id)`.
- `registrarItemTrilho({ id, glifo, rotulo, ordem, aoTocar?, ligado? })` (hud/Trilho.jsx).
- `pausarPor(motivo)` e `soltarPausa(motivo)` (hud/Velocidade.jsx).
- `abrirTelaNaAba(ui, id, aba)`, `tomarAba`, `irParaAlvo(ui, alvo)` (hud/Menu.jsx); `mostrarRetomar(ui)`.
- `registrarAcaoAviso(id, fn)`, `folhaAberta`, `manterFolha` (selecao/Cartao.jsx); blocos da folha `Bloco`, `Par` e seções com `Comp.abas(p)` e `Comp.titulo(...)` para `registrarSecao` (X1b).
- formato: `MOEDA`, `dinheiro`, `dinheiroHora`, `dinheiroPorHora`, `curto`, `dolares`, `anoCalendario`, `mesCurto`, `dataCalendario`.
- Registros: telas `menu`, `holding`, `cidade`, `progresso`, `conselho`; HUD faixa (centro), trilho (direita), objetivo (baixo), avisos, retomar, menu de contexto e hosts de decisão e momento (sobre); folha (folha).
- Cenas da vitrine: `u1-inicio-1x` e `u1b-{holding,holding-producao,holding-mercado,cidade,progresso,conselho,conselheiros,decisao,momento,momento-etapa,folha-res,folha-empresa,folha-via,folha-terreno,ctx,faixa-caixa,faixa-agua,objetivos,retomar,ajuda}`.

## Como testei
- `node --test ferramentas/testes/ui.teste.mjs`: 22 de 22 (13 da U1a, 9 da U1b: formato, textos, faixa, objetivos, menu, folha, menu de contexto, pausa automática, Holding e momentos).
- `node ferramentas/simular.mjs --testes`: 29 suítes verdes, guarda de texto ok (311 arquivos); falha só a `casca`, em 2 asserções que a ficha manda mudar (ver pendências 1).
- `node ferramentas/montar.mjs --saida <temp>`: sem avisos além do teto do JS principal (jogo 1.891,9 KB, teto 1.638; antes da U1b esta árvore já montava 1.829). A U1b soma uns 63 KB no principal (HUD, folha, seções, menu de contexto e registros, cerca de 42 KB; textos, cerca de 13 KB) e 28 KB sob demanda em pedaços (Holding 8,5, Cidade 5,1, Progresso 3,6, Momento 2,4, Decisão 2,2, Conselho 2,0, Menu 1,8, comum 1,2).
- Vitrine em 986x443, 915x412, 1376x768 e 1920x1080: todas as cenas (187 capturas com medida) ok, sem erro de página.

## Capturas
`cap1-986x443-decisao.png`, `cap2-1376x768-holding-mercado.png`, `cap3-986x443-folha-empresa.png`, `cap4-986x443-faixa-caixa.png`.

## Pendências
1. Integrador, `ferramentas/testes/casca.teste.mjs`: (a) linha 27 espera "Mês 3 · Ano 2"; com a D67 é "mar. 2021" ({ mes: 3, ano: 2 } vira 2021); (b) o teste de índices só aceita import direto de `ui/index.jsx`: aceitar `ui/telas/corpo/*` (vêm por `import()` dos registros das telas) e pôr a pasta na tabela 3.1 como U1b.
2. Teto do JS principal (A1) estourado pela soma das parcelas: 1.892 KB contra 1.638.
3. X2: barra de construção e bandeja ainda em `fmt.creditos` com " créditos" nos textos x2 (e o teste da X2 com "124 m · 3.720 créditos"); passar a `fmt.dinheiro`. Chip de encaixe sobre a cota em 986x443 (`mundo/Cotas.jsx`).
4. F0, textos: `codigo.limiteAno` e `codigo.limiteDivida` com "50 mil" e "500 mil" em unidades e `data.mesAno` obsoleto; mandar o valor por parâmetro em dólar.
5. S3a: textos das decisões com dinheiro em unidades ("40 mil agora", "20 mil em protocolos"); o cartão já mostra "Custa US$ 24 mi agora" ao lado. Tirar o valor da frase ou mandar por parâmetro.
6. X1b: `ui.momento` e `registrarEtapaMomento` para a etapa; `registrarSecao('arcologia', Comp)` com `Comp.titulo`; tela `arcologia` ou `livroArcologia` (menu e Progresso já apontam para ela).
7. X3a: `registrarItemTrilho` para Camadas e os ids de `loja.camada` ('agua', 'energia', 'bemEstar', 'empregos', 'servicos', 'recursos') usados pelo "Ver camada".
8. R5: `COLOCAVEIS[tipo].referencia` para a folha mostrar a referência real.
9. U2a: `jogo.salvar` e `jogo.sairParaMenu` (o menu só mostra Salvar e Sair se existirem), voltar do Android abre `ui.abrirTela('menu')`, prefs `pausarTelas`, `cenasMarco` e `cartaoNoPC` na tela Configurações; o "Onde você parou" já abre no evento 'carregado'.
10. Desenho (ui.md 7.1 e 7.3): com o jogo pausado ou com alerta, o chip ou a faixa no centro de cima e o objetivo no centro de baixo deixam 307 px livres em 986x443 (meta 340). A vitrine mede o repouso com a cidade em 1x e sem alerta; a cena pausada mede a área com a meta do objetivo aberto.
