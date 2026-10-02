# R4b, obras, anexos, lote e noite: nota de entrega

Resultado: obra em 5 fases na GPU (corte no vértice pelo uniforme de tique sobre a textura de obra, esqueleto por andar,
grua de torre que sobe com os andares no prédio alto, grua móvel e andaime no baixo, tela entre a fachada e o
esqueleto), anexo do setor (D39) com refusão depois de 5 s sem mudança, lote inteiro (piso, muro e portão do plano,
árvores e carros parados), abandonado, cor da Holding e janelas por agenda que apagam no abandonado e na obra. Os
ganchos da fachada de longe perderam o HAO e a sombra própria lê o mapa com 2 amostras em vez de 8: no SwiftShader o
passe dos prédios caiu 4% (7,5% no custo por pixel), o que leva a estimativa da RX 550 de 8 a 10,7 ms para 7,4 a 9,9 ms.
**A meta de 6 ms não sai só dos ganchos**: todos eles juntos são uns 30% do custo por pixel da fachada de longe; o
resto é a própria fachada (tabela e pendência 7). Na cena bairro com crescimento sintético em 4x a fila esvazia (4,4 s
depois do fim) e o JS do envio fica em 2,7 ms no pior quadro.
`simular --testes` verde (a guarda de texto em 302 arquivos; o tempo do tique da S2a falha às vezes com a máquina
carregada e passa sozinho). A montagem só reclama do teto do JS principal (1.829 de 1.638 KB, soma de todas as
parcelas; a R4b põe 32 KB, ver "Tamanho").

## Arquivos (só os da R4b e os herdados da R4a)
- `fonte/render/mundo/obras.js` (domínio `obras`: peças, listas, fases na CPU, materiais)
- `fonte/render/materiais/shaders/obra.glsl.js` (novo: os shaders das obras, sob demanda; pendência 1)
- `fonte/render/mundo/anexos.js` (`RegistroAnexos`, D39)
- `fonte/render/mundo/lotes.js` (domínio `lotes`: árvores e carros do lote)
- `fonte/render/mundo/predios.js` (tabela de bits, textura de obra, anexos, filtros de sombra e lote, ganchos de longe)
- `fonte/render/materiais/shaders/fachada.glsl.js` (corte da obra, anexo, Holding, abandono, luz das janelas)
- `fonte/render/geracao/planoPredio.js` (`vestirLote`: árvores, palmeiras, vagas e carros), `fundir.js` (gerador
  `anexo`, itens do lote no LOD0), `malhaPredio.js` (`BITS_TABELA`, `ID_ANEXO`)
- `fonte/render/cenas/obra.js` (cena `obra`), `fonte/render/cenas/bairro.js` (`?crescer=4`)
- `ferramentas/testes/obras-anexos.teste.mjs` (novo, 9 testes)

## O que publica
- **Textura de obra** `ctx.dominio('predios').obra`: RGBA32F 512² com início, fim, cota da base e altura do prédio
  (era RG32F no texto do contrato; pendência 2). Só muda quando a obra começa ou acaba (envio de 16 bytes por vaga).
- **Bits da tabela** (`BITS_TABELA` em `geracao/malhaPredio.js`): ABANDONADO 1, SELECIONADO 2, HOLDING 4, OBRA 8,
  APAGADO 16, NIVEL 32, ANEXO 64. `ID_ANEXO = 1 << 30` no `aId` das malhas do anexo.
- **Domínio `predios`** ganhou `planoObra(i)`, `alturaObra(i, H)` (R5: corte dos colocáveis), `lotesVisiveis()`,
  `setorDe(i)`, `registro`, `bancadaLonge(v)` e `zerarEnvio()` (bancada) e `medidas().envio` (pior envio por parte).
  `ctx.stats.setores` ganhou `piorEnvio` (pior dos últimos 120 quadros) e `pendentes` (pedidos na oficina mais
  respostas a montar).
- **Domínio `obras`**: `contagem`, `carregando` (promessa dos shaders), `refazer()`, `medidas()`.
- **Domínio `lotes`**: árvores (modelos de props.js) e carros (frota de veiculos.js com o material do tráfego) dos
  setores com LOD0 à vista; nenhuma compilação nova.
- **Geradores da oficina**: `setor` leva `lote` (copa, palmeira, 4 modelos de carro) no LOD0; `anexo` (mesmo formato,
  ids com `ID_ANEXO`).
- **Cena `obra`** (`?vista=padrao|alto|baixo|lote`, `?anda=1` anda em 4x): escolhe na cidade sintética um alto em
  fechamento (p 0,76), outro em estrutura (0,45), baixos nas quatro fases, duas casas e uma reforma; tira as obras que
  a sintética já tinha. **Cena `bairro`** `?crescer=4&por=40`: nascimentos, subidas de nível e fim de obra no diário,
  a partir do fim do aquecimento; resultado com envio (JS, GL e partes) e fila.

## Como funciona
- **Fases** (`FASES_OBRA` do contrato): canteiro (tapume, placa, contêiner, caçamba, pilhas), fundação (laje sobe de
  -0,6 a 0,3 m, betoneira), estrutura (pilares em grade de ~6 m e uma laje por andar até a altura do prédio; o
  esqueleto sobe com o progresso), fechamento (a fachada sobe em degraus de 3 m atrás do esqueleto, a tela cobre da
  fachada pronta até ~10 m acima), pronto (a bandeira sai e tudo some no mesmo quadro). Progresso no vértice:
  `(gTique - ini) / (fim - ini)`, com `gTique = tique + frac` do espelho; nenhum envio por quadro.
- **Corte no vértice** (fachada): acima da altura pronta o vértice desce para ela (o topo vira tampa), com um degrau
  mínimo por altura contra z-fight; a fachada das paredes acompanha (`vPF.y`). A reforma de nível (OBRA_NIVEL) não
  corta: tela ou andaime e a grua, se for alto.
- **D76**: prédio acima de 14 m tem grua de torre (Liebherr 150 EC-B: mastro de 1,6 m que sobe até 7 m acima do
  esqueleto, lança de 25 a 55 m que gira pelo tique, carrinho e gancho descendo até a frente de trabalho) e tela;
  abaixo, grua móvel sobre caminhão (braço que mira o topo da obra) e andaime tubular com tábuas e diagonais.
- **CPU**: a lista leva só as peças da fase de agora e da do próximo segundo (na velocidade atual); a troca de fase
  refaz as listas uma vez. Três chamadas (caixas, cascas, gruas) e dois projetores de sombra (caixas com a massa do
  prédio até a altura pronta, e gruas). Teto por perfil (`PERFIL_OBRAS`: pc/alta 200 obras em 2 km).
- **Anexo (D39)**: o prédio que nasce, sobe de nível ou muda vai para o anexo do setor (malha pequena, uma por quadro
  na oficina); a cópia que vale é escolhida no vértice pelo bit ANEXO, então nunca há buraco nem cópia dupla. Refusão
  da base com 5 s sem mudança, ou anexo com 32 prédios, ou diferença mais velha que 30 s. Uma base por idx (a vaga que
  muda de setor espera a base velha sair; enquanto isso, APAGADO).
- **Lote**: o plano veste o lote (`vestirLote`): árvores no quintal (~1 a cada 9 m) e na frente, palmeira na
  residencial alta, vagas de 2,6 m no recuo de 5,2 m ou mais, carro ao lado da casa e sob os pilotis; o abandonado não
  tem carro. Piso e muro com portão já eram do plano (R4a).
- **Abandonado** (fragmento): mato no piso e no verde, vidro quebrado por hash, pichação no pé e na platibanda, tom
  apagado; as janelas não acendem. **Holding**: 70% da cor da Holding no tom base, letreiro e toldo na cor; tapume e
  placa da obra dela na cor. **Selecionado** segue o realce da R4a (`gSelecionado`).
- **Noite**: janelas acesas pela agenda (canal B da tabela, R4a), apagadas no abandonado e na obra nova.

## Custo dos prédios de longe (pedido da ficha)
Medido no SwiftShader como a PC2 (só o passe, uma vez no alvo da cena e uma no dobro do lado, com espera da GPU por
readPixels, mesma câmera), cena aberta `?q=pc&pr=1`, 1.376 x 768. A máquina estava carregada por outras parcelas (até
3 navegadores ao mesmo tempo), então medi tudo na mesma rodada, intercalado, e fiquei com o menor de 4 rodadas: duas
páginas no mesmo navegador (antes, HEAD, e agora), com o laço das duas parado; na de agora, as variantes dos ganchos de
longe trocadas na mesma página (`bancadaLonge`).

Passe inteiro dos prédios (LOD0, LOD1 e LOD2), em ms:

| Passe | Antes (HEAD) | Agora | Diferença |
|---|---|---|---|
| Prédios, alvo da cena (1x) | 2.971 | 2.854 | -4% |
| Prédios, por pixel (1x) | 1.053 | 974 | -7,5% |
| Prédios, fixo (vértice e chamadas) | 1.918 | 1.880 | -2% |

O "agora" já leva o que a R4b pôs no vértice e no fragmento (corte da obra, anexo, abandono, Holding) sem custo
visível. Só o LOD1 e o LOD2 (o que a vista aberta mais desenha), variantes dos ganchos de longe na mesma página:

| Ganchos de longe | Por pixel (ms) | Contra todos |
|---|---|---|
| Todos, PCF 8 (como antes) | 1.165 | |
| Todos, PCF 2 | 1.102 | -5% |
| Sem HAO, PCF 2 (**o padrão agora**) | 1.114 | -4% |
| Sem HAO, PCF 1 | 1.038 | -11% |
| Sem HAO e sem sombra própria (perto e longe) | 912 | -22% |
| Só a camada (sem neblina, sombra, HAO, noite, seleção, máscara) | 812 | -30% |

O ruído entre rodadas é de uns 10% (a variante "sem HAO, PCF 8" deu 1.270, fora da faixa). Leitura: o HAO e as
amostras do PCF ficam no ruído do SwiftShader (na placa cada amostra é uma leitura de textura: 8 para 2 corta uns 75%
dessas leituras); a sombra própria é o gancho que pesa (uns 18%); tirar todos dá 30% e muda a imagem (sem neblina e
sem sombra). Estimativa da RX 550 pelo método da PC2 (o tempo medido nela vezes a razão por pixel): 8 a 10,7 ms para
7,4 a 9,9 ms com o padrão; 6,3 a 8,4 ms sem a sombra de longe; 5,6 a 7,5 ms só com a camada. O SwiftShader põe 65% do
passe no fixo (vértice), que na placa pesa pouco, então o número de verdade é o da bancada no PC do dono (a página
mede com `?ganchosLonge=` e `?amostrasLonge=`, ou `bancadaLonge()` na mesma página).

## Crescimento sintético em 4x (meta da ficha)
`cena=bairro&q=pc&crescer=4&por=40`, 640 x 360, com material simples no desenho (no SwiftShader um quadro inteiro
leva segundos; os envios de malha e lista acontecem iguais). Uns 40 quadros, quase um tique por quadro (o pior caso:
em 4x de verdade é um tique a cada 15 quadros): 47 nascimentos e 13 subidas de nível (o teto de 60 obras abertas),
anexos até 13 setores.

| Medida | Valor |
|---|---|
| JS do envio, pior quadro | 2,7 ms (receber malha 2,2; listas visíveis 1,3; listas de sombra 1,5, cada uma no seu pior quadro) |
| Envio (JS + WebGL), p95 | 3,3 ms |
| Fila da oficina | máximo 13, esvazia 4,4 s depois do fim do crescimento |
| WebGL nos envios (SwiftShader) | pior 9,2 ms, mas é espera da GPU de software: um `bufferSubData` de 2 KB levou 8 ms; o maior envio foi um `bufferData` de 73 KB |

A sombra espera um quadro quando as listas visíveis já foram refeitas no mesmo (o pior quadro não soma as duas). O
número do WebGL de verdade vem da bancada no PC do dono.

## Tamanho (A1)
Minificado, só os arquivos da R4b no pacote principal: 114,4 para 146,8 KB (+32,4 KB): predios.js +7,7, obras.js +12,5,
fachada.glsl.js +3,9, anexos.js +2,6, lotes.js +2,1, planoPredio.js +2,1, fundir.js +1,1. Sob demanda: os shaders das
obras 8,3 KB, cena obra 4,3 KB, cena bairro +2,8 KB. Worker da oficina 153 KB (teto 250). A montagem inteira:
jogo 1.829 KB (teto 1.638), soma das parcelas da etapa.

## Capturas (1376 x 768, `?q=pc`)
- `cap/final-padrao.png`: `cena=obra` às 10h (o alto em fechamento com a tela e o esqueleto, a grua móvel do baixo, o
  alto em estrutura com a grua de torre).
- `cap/final-noite.png`: `cena=bairro&hora=21`, janelas por agenda.
- `cap/final-lote.png`: `cena=obra&vista=lote`, pilotis com carros, árvore, muro e guarita.
- `cap/final-alto.png`: `cena=obra&vista=alto`, a torre de 81 m em fechamento com a grua no topo.

## Como testei
- `node ferramentas/simular.mjs --testes`: verde; `obras-anexos` com 9 testes: as 5 fases pelo uniforme de tique
  (tradução do GLSL para JS conferida contra `alturaPronta`), o vértice da fachada com o corte e o anexo, as peças do
  alto (grua de torre, tela, esqueleto, 4 tapumes, massa), do baixo (grua móvel, andaime) e da reforma, os shaders das
  obras montando sobre o three (com e sem sombra, sem mediump), o registro de anexos (refusão aos 5 s e adiamento,
  anexo grande ou velho, morto e apagado, vaga que muda de setor), o gerador marcando `ID_ANEXO`, os itens do lote
  (dentro do lote, determinísticos, abandonado sem carro) e o domínio inteiro com a cidade sintética (reforma, anexo
  montado com os bits ANEXO e NIVEL, sem refusão aos 4 s, refundido aos 5,2 s, bit limpo, nenhum pendente).
- `node ferramentas/montar.mjs --saida <temporária>`: só o aviso do teto do JS principal.
- Cenas `obra` (quatro vistas) e `bairro` (`hora=21` e `crescer=4`) com `ok: true`.

## Pendências
1. **Integrador, tabela 3.1:** arquivo novo `render/materiais/shaders/obra.glsl.js` (os shaders das obras, sob
   demanda como o `folha.glsl.js`; o teste de índices exige que todo módulo do render que não é `.glsl.js` esteja
   ligado a um índice).
2. **Contrato 2.4:** a textura de obra é RGBA32F (início, fim, cota da base, altura do prédio), não RG32F; o texto do
   PROJETO (linhas 354, 1095, 1106, 1812, 1949) cita RG32F.
3. **R5:** os colocáveis com o material `edificio` ganham o corte chamando `ctx.dominio('predios').alturaObra(idx, H)`
   quando a obra começa (e `alturaObra(idx, 0)` no fim); a cor da Holding vem pelo bit HOLDING da tabela (bandeira
   `PREDIO.HOLDING` ou tipo HOLDING).
4. **R1b:** o `campoAlturas` conta o prédio em obra na altura inteira (a sombra do chão e a câmera); se quiser a altura
   da obra, `alturaObra`/`planoObra` dão a conta.
5. **R2b:** as árvores do lote usam os modelos de props.js (R3a); dá para trocar pelas espécies da R2b quando ela
   publicar o modelo instanciável.
6. **Integrador:** o JS principal passa do teto (1.829 de 1.638 KB) com todas as parcelas; a R4b põe 32 KB.
7. **Prédios de longe abaixo de 6 ms (integrador e PC):** os ganchos não bastam (acima). Os próximos cortes, do mais
   barato para o mais caro na imagem: passe só de profundidade dos prédios antes da cor (1,13 para 1,0 camada por
   pixel, a pendência da PC2), fachada do LOD2 assada num atlas em vez de procedural, sombra de longe fora do LOD2.
   Confirmar na bancada do PC do dono, junto com o WebGL do envio no crescimento (o SwiftShader mede a espera da GPU
   de software).
8. `stats.setores` ganhou `piorEnvio` e `pendentes`; `medidas()` do domínio `predios` ganhou `envio` (para a bancada).
