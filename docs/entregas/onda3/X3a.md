**Entregue em 03/10/2026** (X3a). Publicou, pelo registro: o gancho `camada` de verdade (`render/sobreposicoes/camadas.js`:
uniformes `gCamada` (ligada, n cores, categórica, emissivo que fica) e `gCamadaRampa[8]`; a cor base vira cinza claro
pela luminância dentro do laço da luz direcional, antes do `RE_Direct`, e no `edificio` o valor vem de `vIdent.w`, o
canal R da tabela de prédios que o vértice já lia; no three r186 o difuso sai de `material.diffuseContribution` e o
especular de `specularColorBlended`, e o gancho troca os dois, tira o metal e deixa 15% do emissivo; desligada, um
desvio por uniforme e nada mais: nenhuma leitura de textura, nenhum varying, nenhum programa novo ao ligar), o domínio
`camadas` (`estado()`), o domínio `marcadores` (casca leve em `marcadores.js`, que registra o domínio, a fonte do
aquecimento e a seleção com a prioridade dos marcadores, e o desenho sob demanda em `desenhoMarcadores.js`: uma chamada
instanciada, placa virada para a tela com lado fixo em px, forma pela gravidade, losango grave, triângulo atenção,
círculo informação e círculo de aro duplo da Holding, glifo do atlas da UI ou a contagem do setor, oclusão pela
profundidade, teto por perfil 200 no PC e no Alta, 60 no Média e 30 no Leve, um por setor de 256 m além de 1 km no
Média e 1,4 km no Alta, some no modo foto; `mostrados()`, `medidas()`, `selecionar()`, toque a 22 px sem torre na
frente) e o domínio `ancoras` (`ancoras(lista)` com a oclusão pelo relevo, 20 amostras na grade de alturas, refeita a
cada 6 quadros). Na UI: o item Camadas do trilho abre um popover (não uma tela: o mundo segue no toque) com as 6
camadas do M1a e o Valor do terreno quando a simulação o registra, e o filtro "Avisos: Todos, Graves e atenção,
Nenhum" (`prefs.avisos`); a legenda embaixo ao centro (até 360 px: rampa com pontas e marcas, ou as categorias, a
frase do resumo e o X; na Recursos, as obras paradas por falta de material com "Próxima"); o corpo vem sob demanda
(`telas/corpo/Camadas.jsx` e `mundo/camadas.js`) na primeira vez que alguém escreve `loja.camada`; `mundo/marcadores.js`
(o que mostrar: só os avisos da camada ligada, o filtro, a forma da Holding; refeito pelo evento `avisosPredios`, pela
camada e pelo filtro, nunca por quadro); `glifos/atlas.js` (24 glifos de aviso e os algarismos em células de 64 px num
canvas de 512, refeito quando a Inter carrega); `mundo/Rotulos.jsx` com `mundo/rotulos.js` sob demanda (áreas de longe,
a gleba com o nome da sede, avenidas de perto por `q.aresta`, os marcos da sede v3 em inglês por `PARTES_NOMES` e
`TRECHOS_HORIZON`: Blade Tower, Legacy Tower, Mirror Lake, Meridian Ring, Horizon Ring de longe e I a VIII de perto,
Codex Tower, Helix Labs, Compass Tower, Park of Future Dreams; e os prédios da Holding; até 40, colisão por
prioridade, fora do HUD e inteiros na tela). Rampas: sequencial azul de 7 paradas (Valor), divergente vermelho, cinza
e azul com o cinza no `escala.meio` (Bem-estar no 60, Serviços no meio; para daltonismo o vermelho vira laranja,
`prefs.daltonismo`), categóricas das zonas (três famílias, densidade pelo tom), das redes (atendido azul, racionado
âmbar, sem vermelho, produtor azul fundo) e dos recursos (o que domina na célula). O pedido ao render segue o que cada
dono faz com min e max: na tabela de prédios o 0 é "sem dado" (a contínua desce o min um degrau; a categórica vai com
min 0 e max 255 e o R é o índice da cor). Cena `camadas` (`?camada=` zonas, agua, energia, bemEstar, servicos,
recursos, valor; `?vista=perto|aberta`; `?avisos=muitos`; com `?ui=1` registra as camadas e os avisos de prova na
simulação e liga pela loja). Na Zonas o prédio também é pintado pela zona dele e nas camadas por aresta (Serviços)
pela rua da frente (`porPredio`, escrito no canal R da tabela da R4a depois do ouvinte dela): a camada se lê de longe,
onde a via é só pintura no chão. Vitrine: `x3-camadas`, `x3-legenda-bemestar` e `x3-legenda-recursos` (ok em 986 x 443
e 1376 x 768). 15 testes em `camadas.teste.mjs`. Medido (SwiftShader, cena `aberta`, perfil 'pc', 688 x 384,
`R.bancada` de 70 quadros, rodadas alternadas): passe dos prédios 1.248 e 1.236 ms antes, 1.257 e 1.244 depois com a
camada desligada (+0,7%, dentro do ruído: o terreno variou de 334 a 347 no mesmo par), 1.257 com a camada ligada; o
gancho não acrescenta amostrador, varying nem programa, e o marcador compila no aquecimento (0 compilações depois de
pronto, também com `?ui=1`). Cena `camadas` no 'pc' a 1376 x 768: 49 a 51 chamadas, 208 a 212 mil triângulos, até 33
marcadores (teto 200). JS principal: +12 KB da X3a (a casca dos marcadores, o gancho, a UI que liga e os textos); o
resto, 32 KB, sob demanda (o desenho dos marcadores, o corpo das camadas, os rótulos e a cena).
Pendente: (1) R.ancoras do índice passar pelo domínio 'ancoras' (oclusão pelo relevo); (2) R.selecionado tratar o
'marcador' como o prédio dele (o realce); (3) Configurações (U2a): "Avisos" (prefs.avisos, FILTROS_AVISOS e
mudarFiltro de ui/mundo/marcadores.js) e "Paleta das camadas para daltonismo" (prefs.daltonismo); (4) cartão (U1b): com
uma camada ligada, a primeira linha com o valor dela no prédio; (5) R3a: as cores da rampa das vias passam duas vezes
de sRGB para linear (Color.set já converte; `.convertSRGBToLinear()` sobra) e a via de longe, pintada no chão, não
pinta a camada por aresta; (6) vegetação, água, props, tráfego, pedestres, caminhões e obras deixam o gancho 'camada'
de fora (as árvores e os carros ficam com a cor na camada): ele custa um desvio por uniforme e pode entrar; (7) os
rótulos ganharam uma etiqueta escura translúcida (o halo sem caixa da UI 8.10 não passa do contraste de 4,5:1 da
vitrine sobre o mundo claro); o meio da rampa divergente no mundo é #7d8188 (o --divMeio dos gráficos viraria sombra
no prédio); confirmar com o dono; (8) na tabela 3.1, os arquivos novos da X3a: render/sobreposicoes/desenhoMarcadores.js,
ui/mundo/{camadas,rotulos}.js e ui/telas/corpo/Camadas.jsx.

**Revisão adversarial (03/10/2026).** Corrigido: (a) a frase da legenda do Bem-estar mostrava a Contribuição em
unidades de desenho ("Contribuição de 11"); agora vai em dólar por `fmt.dinheiro` (D68, D87: "US$ 6.600"),
`PARAMS_DINHEIRO` em `ui/mundo/camadas.js`; (b) as obras paradas da Recursos saíam do glifo do pior aviso (uma obra
parada e sem água sumia da conta) e só eram contadas quando a legenda se redesenhava (a versão da Recursos quase não
muda, então o número ficava parado); agora vêm da flag `PREDIO.SEM_MATERIAL` do espelho, num sinal refeito a cada
rodada; (c) a ponte da camada refazia `q.camada` inteira a cada 2 s só para ler a versão (a Recursos custa uns 7 ms
na thread principal); agora só quando a rodada vira, e pausado nada; (d) os marcadores da UI não se refaziam na troca
de partida quando a versão dos avisos coincidia (a lista velha apontava para outros prédios); agora a troca de
simulação suja a lista, e pausado a conferência de 2 s não consulta; (e) o produtor da Água e da Energia passou de
champanhe para o azul fundo `#184f95` (o champanhe ficava igual ao âmbar do racionado sob a luz e em deuteranopia, e
é a cor da Holding nos marcadores); (f) a contagem de dois algarismos dos marcadores de setor saía espremida pela
metade (o 11 e o 16 viravam barras); agora os dois algarismos vão na proporção da fonte; (g) tecla I abre e fecha o
popover (desenho da UI 9.5); (h) textos sem uso (`x3.marcador.grupo`, `x3.rotulos.rotulo`) saíram; os nomes dos
glifos da cena vêm de `GLIFOS_PADRAO`; o cache de nomes dos rótulos tem teto. Teste novo: os marcadores da UI na
troca de partida e com o relógio parado; a legenda em dólar; o produtor distinto do racionado.
