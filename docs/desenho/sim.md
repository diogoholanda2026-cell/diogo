# Jogo novo: desenho da simulação, dos sistemas e dos dados

Parte **SIMULAÇÃO, SISTEMAS E DADOS** do jogo novo (feito do zero). Data: 27/09/2026.

Base: `docs/VISAO.md`, as pesquisas `sistemas.md`, `arquitetura.md`, `visual.md` e `ui.md` desta pasta, o código
atual (`fonte/sim/estado.js`, `fonte/core/salvar.js`, `fonte/data/*`) e uma bancada medida agora
(`scratchpad/cs2/bench-sim.mjs`, Node 22 num Xeon de 2,8 GHz). As pesquisas não passaram por crítica; o que foi
decisivo para este desenho foi conferido no código ou medido. Números de economia marcados "(calibrar)" são pontos de
partida para o robô ajustar, não valores fechados.

---

## 0. Resultado em uma página

1. **O jogo em uma frase:** você é a Holding Held, concessionária de Heldópolis. Planeja a cidade como no Cities:
   Skylines II (vias livres, zonas com demanda, serviços pela rede, trânsito), produz os materiais como no Highrise
   City (cadeias com lotes (digitáveis até 1000, D110) e caminhões) e ergue a **Arcologia de Held**, o megaprojeto de assinatura, por
   etapas que consomem esses materiais.
2. **Tempo à CS2, com as regras do dono intactas.** Pausa, 1x, 2x e 4x. Um tique = 1 s de jogo. A "hora" das regras
   do dono é a **hora de jogo = 1 h real em 1x** (igual a hoje); o ano continua com 2 h de jogo, o mês com 10 min, e
   o ciclo de dia e noite dura um mês, como no CS2. Com isso renda por hora, empréstimo por ano e janela do Depósito
   mantêm o sentido e o equilíbrio que o dono conhece. Nada anda com o jogo fechado.
3. **Mundo em metros.** 1 unidade = 1 m. Mapa jogável de 8.192 x 8.192 m em 16 x 16 ladrilhos de 512 m; o jogo
   começa com 4 x 4 (2 km x 2 km). Relevo em grade de 8 m, mar, rio e lagoa, recursos naturais em grade de 32 m.
   Em float32 a 4 km da origem a precisão é 0,49 mm (medido); a simulação guarda posições em Float64.
4. **Vias em grafo de Bézier cúbicas**, 4 tipos no M1 (rua, rua de mão única, avenida, avenida grande) mais a
   rodovia pronta do mapa. Ferramentas reta, curva, contínua, grade, melhorar e demolir, com encaixe em nó, aresta,
   ângulo, comprimento múltiplo de 8 m e paralela. Pontes, rotatórias, viadutos e túneis ficam para depois.
5. **Zonas à CS2:** células de 8 m ao longo das vias, até 6 de fundo; 7 tipos de zona no M1; demanda com fatores
   visíveis; prédios nascem, sobem do nível 1 ao 5 e podem ser abandonados. O nível sobe sozinho (CS2) e cada obra
   compra materiais no mercado da cidade, que a Holding abastece (Highrise City).
6. **Cidadãos estatísticos:** cada prédio guarda contagens (lares, moradores, escolaridade em 4 níveis, empregados).
   Nada de uma entidade por pessoa. O que se vê (carros, gente) é amostra desenhada a partir dos números.
   **Bem-estar por prédio** decide a renda de 5, 8 ou 11 por morador por hora (regra do dono); a barra mostra a
   média ponderada.
7. **Serviços com área pela rede viária** (Dijkstra de várias origens, normalizado pelo raio) e capacidade. Água,
   esgoto e energia correm dentro das vias (como a baixa tensão e os canos do CS2): falta vira racionamento dos mais
   distantes. No começo a ligação da rodovia importa um pouco de água e energia.
8. **Trânsito agregado no celular:** zonas de tráfego de 256 m, gravidade e atribuição incremental com a curva BPR,
   num Web Worker a cada 3 dias de jogo. Saída: fluxo e velocidade por aresta e sentido. Carros visíveis são amostra
   proporcional ao fluxo; os caminhões da Holding são agentes de verdade, com rota. Ônibus no M2.
9. **Economia:** a Holding tem um caixa só. Receitas: moradores (5/8/11), vendas de materiais à cidade, Depósito
   (150% do preço base, até 100 por janela de 4 h de jogo) e, depois, empresas. Despesas: manutenção de serviços e
   vias, salários das empresas da Holding e juros. Empréstimo idêntico ao de hoje (50 mil por ano, 10% ao ano, dívida
   até 500 mil). Sem imposto sobre moradia; imposto sobre empresas só com aprovação do dono.
10. **Progressão:** 16 marcos por XP (à CS2) com desbloqueios e licenças de ladrilho; por cima, 5 atos da Holding com
    conselheiros e decisões (Influência x Legado). A Arcologia avança por etapas presas a marcos.
11. **Software:** simulação pura em `fonte/sim/`, determinística (semente, tique inteiro, sem relógio nem
    `Math.random`), na **thread principal** no M1 com orçamento por tique, e tarefas pesadas (trânsito) num worker cujo
    resultado entra num tique fixo, para o Node e o navegador darem o mesmo resultado. Estado em arrays tipados (SoA),
    grade espacial de 64 m, comandos registrados num livro, consultas puras para a UI, espelho e diário de mudanças
    para o render. Save binário comprimido no IndexedDB, versionado, com exportar e importar.
12. **M1 "Heldópolis nasce":** mapa autoral com a Vila de Santa Cida já de pé (a primeira tela não é vazia), vias,
    zonas, 14 serviços e utilidades, redes, trânsito visível, valor do terreno, ar e ruído, 19 camadas, cadeia de
    construção da Holding, Depósito, empréstimo, marcos 0 a 7, Ato 1 e a Torre Lâmina em 4 etapas. O robô em Node
    joga até a Torre pronta. M2 a M6 no fim (seção 18).

Medições desta bancada (Node, Xeon 2,8 GHz; no Poco X7 estimo 2 a 3 vezes mais lento, a medir no aparelho):

| Operação | Tempo |
|---|---|
| Dijkstra no grafo inteiro de 29.929 nós e 119 mil arestas dirigidas, 1 origem | 4,1 ms |
| Dijkstra limitado a 1.500 m (cobertura de um serviço) | 0,03 ms |
| Dijkstra de 40 origens juntas (cobertura de um tipo de serviço no mapa todo) | 3,8 ms |
| 64 Dijkstras seguidos (uma passada de atribuição com 64 zonas) | 198 ms |
| Varredura de 20 mil prédios (bem-estar e renda) | 0,31 ms |
| Uma passada de difusão numa grade de 256 x 256 | 0,32 ms |
| `structuredClone` de 1 MB (custo de mandar ao worker sem transferir) | 0,60 ms |

---

## 1. O jogo e os pilares

### 1.1 A premissa

A Holding Held ganhou a **concessão para planejar e urbanizar Heldópolis**, uma cidade nova no litoral. Isso tem
precedente real no Brasil e fora: a NOVACAP, empresa criada em 1956 para construir Brasília; a Alphaville
Urbanismo, que planeja bairros-cidade inteiros; e Songdo, na Coreia, feita por incorporadora privada. A premissa
resolve o conflito que a pesquisa de sistemas apontou ("o jogador é a Holding, não o prefeito"): como
concessionária, a Holding traça vias, zoneia, mantém os serviços e recebe a contribuição urbana dos moradores (a regra
de 5, 8 ou 11 por hora). Como empresa, ela produz, vende, se endivida e disputa mercado. A política entra depois
(M5), quando a concessão passa a conviver com câmara e prefeito eleitos.

### 1.2 Pilares

| Pilar | De onde vem | O que o jogador sente |
|---|---|---|
| **Cidade de verdade** | CS2 (referência máxima) | traçar avenidas no relevo, ver bairros nascerem pela demanda, resolver trânsito, água e energia pela rede |
| **Produção com consequência** | Highrise City | cadeias que abastecem o crescimento da cidade e a obra; lotes (até 1000, D110); caminhões que se veem; vender no Depósito |
| **A obra-marco** | megaprojetos reais (arquitetura.md) | a Arcologia de Held subindo por etapas, da terraplenagem do lago à coroa acesa da Torre Lâmina |
| **Decisões de dono** | Frostpunk 2, Anno 117, VISAO.md | conselheiros, dilemas com ganho e custo, Influência x Legado, rivais (M3) |

O que sai do jogo antigo: níveis pagos com item em cada prédio da cidade, cronômetros de relógio real, balões,
pedidos da comunidade em cartões, desmate lote a lote, bairros fixos em grade. O que fica: as quatro regras de
economia do dono, com os mesmos números e o mesmo sentido de tempo.

### 1.3 Papel da Arcologia

A Arcologia é o **prédio de assinatura da Holding**, como os marcos do CS2 e o megaarranha-céu do fim do Highrise
City. Ela ocupa uma gleba reservada no mapa (o plano do Trevo continua como desenho: Anel Mestre em volta do lago,
Torre no centro, quatro tambores, quatro folhas, eixo), é feita de **partes** com **etapas**, e cada etapa pede
marco, créditos, materiais entregues por caminhão e dias de obra. Pronta, cada etapa dá algo à cidade: moradia de
luxo, empregos qualificados, vagas de ensino, atratividade e valor do terreno em volta. A Torre Lâmina (retangular,
de alto luxo, arquitetura.md seção 4) é a primeira parte grande e fecha o M1.

---

## 2. Laço do jogador

### 2.1 A cada minuto (o gesto)
- Traçar ou emendar vias; pintar zonas; pôr um serviço onde a camada mostra falta.
- Tocar num ícone de aviso sobre um prédio, ler a causa e agir (sem água, sem trabalhadores, trânsito).
- Ajustar a produção: escolher o lote (1 a 1000, D110) e o automático de uma linha; vender excedente no Depósito.
- Mudar a velocidade: pausar para planejar, 4x para ver crescer.

### 2.2 A cada hora de jogo (a decisão)
- Um marco chega: dinheiro, licença de ladrilho, desbloqueios. Abrir um ladrilho novo e planejar o bairro.
- Uma etapa da Arcologia termina e outra começa: garantir os materiais (produzir, comprar, reservar estoque).
- O Conselho traz um dilema (1 ou 2 por hora): cada opção puxa Influência ou Legado.
- Fechar a conta: orçamento por hora, empréstimo, manutenção dos serviços.

### 2.3 A cada sessão
- **Celular (15 a 40 min):** retomar do save automático exatamente onde parou (o jogo não anda fechado); cumprir 1
  ou 2 objetivos, rodar a 4x, resolver avisos, concluir uma etapa.
- **PC (1 a 4 h):** planejar bairros inteiros, reorganizar vias, montar cadeias, levar a Arcologia um ato adiante.

### 2.4 Primeira hora (ritmo alvo em 1x; o robô confere)

| Minuto | O que acontece | Sistema |
|---|---|---|
| 0 | câmera sobre a baía; Vila de Santa Cida (uns 350 moradores) sem água encanada; rodovia com carros; gleba da Arcologia marcada | mapa autoral |
| 0 a 5 | Íris: "a primeira avenida liga a rodovia à gleba"; o jogador traça a avenida | vias |
| 5 a 12 | Dona Cida: água, esgoto e energia para a Vila (captação no rio, estação de esgoto, usina solar) | redes |
| 12 a 20 | pintar residencial baixa e comercial baixa; a demanda puxa as primeiras casas; marco 1 | zonas, marcos |
| 20 a 35 | Tomé: Pedreira e Areal da Holding em lotes de 10 com automático; a etapa "Terraplenagem e lago" começa | Holding, Arcologia |
| 35 a 50 | clínica, escola e delegacia; bem-estar passa de 60 e a renda por morador sobe de 8 para 11; marco 2 | serviços, economia |
| 50 a 60 | primeira venda no Depósito; primeiro dilema do Conselho; primeira licença de ladrilho | Depósito, história |

---

## 3. Tempo

### 3.1 Relógio

| Grandeza | Tiques | Em 1x | Observação |
|---|---|---|---|
| tique | 1 | 1 s | unidade inteira da simulação |
| dia | 20 | 20 s | igual ao `DIA_MS` de hoje |
| mês | 600 | 10 min | um ciclo de dia e noite (CS2: um ciclo vale um mês) |
| ano | 7.200 | 2 h | igual ao `ANO_MS` de hoje; conta o limite anual do empréstimo |
| **hora de jogo** | 3.600 | 1 h | a "hora" das regras do dono (renda por hora, janela do Depósito) |

- Velocidades: pausa, 1x, 2x e 4x (tiques por segundo real: 0, 1, 2, 4). O CS2 pausa e acelera a própria simulação
  (`selectedSpeed`, conferido pela pesquisa no código decompilado); aqui é igual.
- **Por que a hora de jogo vale 1 h real em 1x:** as regras do dono foram equilibradas com renda por hora real e ano
  de 2 h. Se a "hora" fosse a hora do relógio do ciclo (25 s em 1x), a renda por ano seria 144 vezes maior e o
  empréstimo de 50 mil por ano perderia o sentido no primeiro minuto. A barra mostra "+12.400/h" com a dica "por hora
  de jogo (1 h real em 1x)".
- **Fechado, nada anda** (como no CS2). O jogo antigo rendia 50% por até 12 h fechado; isso não é uma das quatro
  regras e sai. Pergunta ao dono na seção 20.
- Data na barra: "Mês 3 · Ano 2". O dia do mês marca a hora do sol (o render decide a curva). Em 4x o dia visual
  dura 2,5 min; sugestão ao render: o sol anda no máximo no ritmo de 2x (seção 20).

### 3.2 Agendador

Cada sistema tem período e fase em tiques; os que varrem muitos itens trabalham em fatias (1/20 por tique, então cada
item uma vez por dia). Orçamento alvo: **tique até 1 ms no p95 no Node** com 30 mil moradores (estimativa: até 3 ms
no Poco X7). Em 4x são 4 tiques por segundo: 4 x 3 ms = 12 ms por segundo, 1,2% da thread principal.

| Sistema | Quando roda | Custo esperado |
|---|---|---|
| comandos do jogador | início do tique, na ordem em que chegaram | pequeno |
| economia (renda e despesas contínuas) | todo tique, com totais em cache | O(1) |
| produção da Holding, obras, entregas | todo tique, por fila de prioridade do tique de término | O(eventos) |
| crescimento (nascimento de prédios) | todo tique, com acumulador por zona | até 3 prédios por tique |
| prédios (bem-estar, nível, abandono, renda) | 1/20 dos prédios por tique | 0,3 ms para 20 mil prédios inteiros (medido) |
| cidadãos (empregos, educação, migração) | 1 vez por dia (no tique 5 de cada dia) | agregados por nível de estudo |
| demanda | 1 vez por dia (no tique 10 de cada dia) | agregados |
| cobertura de serviços | quando a rede ou os serviços mudam, um tipo por tique; cargas e eficiência 1 vez por dia | 3,8 ms por tipo no mapa inteiro (medido) |
| redes (água, esgoto, energia) | quando mudam e 1 vez por dia | componentes e racionamento |
| valor do terreno, poluição | 1/20 da grade por tique | frações de 0,3 ms |
| trânsito | pedido a cada 60 tiques, resultado aplicado 60 tiques depois | no worker |
| XP passivo e marcos | a cada 20 tiques | pequeno |
| série estatística | 1 vez por mês | pequeno |
| save automático | 1 vez por mês e ao sair da página | fora do tique |

---

## 4. Mundo

### 4.1 Escala e precisão
- **1 unidade = 1 m** em todo o jogo (simulação, render, dados). Alturas em metros.
- Precisão do float32 (medida): 0,49 mm a 4.096 m da origem, 0,98 mm a 8.192 m, 1,95 mm a 16.384 m. A origem fica
  no centro do mapa, então nada jogável passa de 5,8 km da origem. O render guarda vértices relativos à origem de cada
  ladrilho; a simulação guarda posições em `Float64Array` e só converte ao entregar.

### 4.2 Mapa e ladrilhos
- Área jogável: **8.192 x 8.192 m (67 km²)**, 16 x 16 = 256 ladrilhos de 512 m. O CS2 tem 441 quadros de uns 623 m
  (159 km² úteis) e começa com 9; aqui o mapa é menor para caber no celular, e o começo é maior porque a gleba da
  Arcologia ocupa espaço.
- Início: **4 x 4 ladrilhos (2.048 m, 4,2 km²)** em volta da gleba, da Vila e da entrada da rodovia.
- Comprar ladrilho: 1 licença (vem dos marcos) + preço = 40.000 x (1 + 0,15 x ladrilhos já comprados) (calibrar).
  Só ladrilho vizinho de um já comprado.
- Moldura visual até 30 km (serra, mar, ilhas), sem simulação: é do render.

### 4.3 Terreno
- Grade de alturas de **1.025 x 1.025 amostras a cada 8 m** (Float32, 4,2 MB), gerada da semente e dos controles do
  mapa autoral (seção 4.6). Consultas: `altura(x, z)` bilinear, `declive(x, z)`, `ehAgua(x, z)`.
- Vias e prédios não editam a grade no M1: a simulação guarda a altura de cada nó e de cada lote (a plataforma) e o
  render acomoda o chão em volta de forma determinística. Terraplanagem livre vem no M4 (então o save guarda os
  remendos da grade).
- Regras de declive: rua até 12%, avenida até 10%, avenida grande até 8%; célula de zona inválida se o chão varia
  mais de 4 m dentro dela; prédio colocado aceita até 3 m de desnível na planta.

### 4.4 Água
- Mar com nível 0 m; rio como polilinha com largura (40 a 140 m) e profundidade; lagoa com nível fixo. Máscara de
  água na mesma grade de 8 m (Uint8: 0 terra, 1 mar, 2 rio, 3 lagoa).
- Sem simulação de fluido. Poluição da água (esgoto sem tratamento a montante) no M2.
- Fontes para a rede de água: rio e lagoa (captação na margem), lençol (poço). Mar só com dessalinização (M3).

### 4.5 Recursos naturais
Grades de 256 x 256 (32 m), Uint8 de 0 a 255, uma por recurso:

| Recurso | Onde | Serve para | Renova? |
|---|---|---|---|
| rocha | morros de granito | brita (Pedreira) | não; muito grande |
| areia | leito e margens do rio | areia, vidro | devagar (o rio deposita) |
| argila | várzea | argila, tijolo | não |
| calcário | faixa a noroeste | calcário, cimento | não |
| floresta | encostas (Mata Atlântica) | madeira por manejo certificado | sim, em 30 anos de jogo; corte tira Legado |
| terra fértil | planícies | agro (M3) | sim |
| água subterrânea | planícies | poços | sim, devagar |
| petróleo | mar aberto | M5 | não |

A extração baixa o valor da célula; a camada "Recursos" mostra o que resta.

### 4.6 O mapa de Heldópolis (autoral, com semente fixa)
- Baía ao sul e a leste, com praias e uma ponta rochosa; morros de granito a norte e oeste (o "Pão de Açúcar" da
  cidade); o **Rio Held** desce dos morros a noroeste e deságua na baía; uma lagoa costeira a sudoeste.
- A **rodovia** (BR, 2 x 2 faixas) entra pelo oeste, cruza o rio numa ponte pronta e segue pela orla até sair a
  leste. É a ligação externa: traz migrantes, carga, e no começo importa um pouco de água e energia.
- A **gleba da Arcologia** (retângulo de uns 800 x 620 m, se o Trevo for escalado a 10 m por unidade; ver seção 20)
  fica num platô plano entre a lagoa e a baía, com os portões marcados onde a cidade deve chegar.
- A **Vila de Santa Cida** (uns 60 prédios de nível 1 e 2, 350 moradores, ruas locais) fica na foz do rio. É a casa
  de Dona Cida e o primeiro problema do jogador: gente sem água encanada, sem esgoto e com energia da rodovia.
- O norte geográfico é parâmetro do render (`NORTE_AZ` da pesquisa visual); a simulação só usa o vento, em
  coordenadas do mapa.

---

## 5. Vias

### 5.1 Grafo
- **Nó:** posição (x, y, z), grau, tipo (ponta, meio, cruzamento), raio de cruzamento (calculado das larguras que
  chegam), arestas ligadas (até 6).
- **Aresta:** nós `a` e `b`, tipo de via, **Bézier cúbica** (p0 = nó a, p1, p2, p3 = nó b; reta e curva simples viram
  cúbica), alturas nas pontas, comprimento de arco, tabela de 16 amostras (arco para parâmetro), cortes `t0` e `t1`
  (onde a pista começa depois do cruzamento), sentido (para mão única), blocos de zona dos dois lados.
- Tudo em arrays tipados por coluna (seção 16.3). Componentes conexos por união e busca, refeitos ao mudar o grafo.

### 5.2 Tipos (M1)

| id | Nome | Faixas | Largura | Velocidade | Capacidade por faixa | Custo por m | Manutenção por km por h | Zona? | Marco |
|---|---|---|---|---|---|---|---|---|---|
| `rua` | Rua | 1 + 1 | 12 m (pista 6, calçadas 3 + 3) | 40 km/h | 700 veíc./h | 30 | 150 | sim | 0 |
| `ruaMao` | Rua de mão única | 2 no mesmo sentido | 12 m | 40 km/h | 700 | 32 | 150 | sim | 2 |
| `avenida` | Avenida | 2 + 2, canteiro de 2 m | 22 m | 50 km/h | 800 | 70 | 300 | sim | 0 |
| `avenidaG` | Avenida grande | 3 + 3, canteiro arborizado de 4 m | 34 m | 60 km/h | 850 | 130 | 500 | sim | 4 |
| `rodovia` | Rodovia (pronta no mapa) | 2 + 2, sem calçada | 24 m | 100 km/h | 1.800 | (não se constrói no M1) | 0 (do estado) | não | mapa |

Custos e manutenção (calibrar) em créditos. As redes de água, esgoto e energia correm dentro de todas as vias com
calçada (seção 8.2). Faixas saem do tipo; conexões de faixa por cruzamento ficam para o M2 (no M1 toda conversão é
permitida, menos retorno no mesmo nó).

### 5.3 Cruzamentos e regras de geometria
- Cruzar uma aresta existente divide as duas e cria um nó. Encostar a menos de 2 m de um nó funde no nó.
- Ângulo mínimo entre duas arestas no mesmo nó: 30°. Grau máximo: 6. Comprimento mínimo depois de dividir: 8 m.
- Raio mínimo de curva: rua 20 m, avenida 40 m, avenida grande 60 m.
- Declive máximo por tipo (seção 4.3), medido no perfil já suavizado.
- Proibido no M1: atravessar água (sem ponte), sair dos ladrilhos comprados, entrar na gleba (a Arcologia tem vias
  próprias, que entram no grafo quando a etapa do lago fica pronta), passar a menos de 4 m de um prédio sem demolir
  (a ferramenta mostra o que seria demolido e o custo).
- Corte no cruzamento: `t0` e `t1` de cada aresta afastam a pista até o raio do nó (maior meia largura que chega mais
  2 m). A malha do cruzamento é do render.

### 5.4 Ferramenta de traçado (pura: a mesma função no navegador e no Node)
- **Modos:** reta (2 pontos), curva (3 pontos: início, controle, fim), contínua (curvas encadeadas com tangente
  contínua), **grade** (um retângulo vira ruas espaçadas; padrão 112 m entre eixos de rua, que dá 6 células de cada
  lado; 120 m com avenida), melhorar (troca o tipo de arestas existentes, cobra a diferença), demolir (arestas e
  prédios; devolve 50% do custo, 100% se for desfeito na mesma sessão da ferramenta).
- **Encaixe, em ordem de prioridade:** nó existente; ponto sobre aresta existente; ângulo (90°, 45° e múltiplos de
  15° em relação à via de onde parte, com folga de 3°); comprimento múltiplo de 8 m (combina com as células); guias
  paralelas às vias próximas na distância que completa o fundo de zona (48 m + meias larguras). A tolerância vem da
  UI em metros (ela converte os pixels do polegar pelo zoom).
- **Pré-visualização:** `planejar(...)` devolve os segmentos, os nós novos, as divisões, as guias usadas, o custo, o
  que será demolido e os erros por trecho (água, declive, ângulo, ladrilho, gleba). A UI desenha e o jogador confirma;
  só então `cmd('via.construir', plano)` aplica, conferindo de novo.
- **Custo:** comprimento x custo por metro do tipo x (1 + 2 x declive médio) + demolições.

### 5.5 Depois do M1
- M2: rotatória sobre cruzamento, ponte simples (vão reto sobre água com tabuleiro em altura fixa), calçadão
  (pedestre e bicicleta), conexões de faixa por cruzamento.
- M4: vias elevadas, viadutos, túneis, trevos prontos, rodovia construída pelo jogador, terraplanagem.
- M5: cais com muro de arrimo.

---

## 6. Zonas, demanda e crescimento

### 6.1 Blocos e células
- Toda aresta de via com calçada gera um **bloco de zona** de cada lado: colunas de 8 m ao longo do arco útil (entre
  os cortes, menos 4 m em cada ponta) e **6 linhas de 8 m de fundo** (48 m), como no CS2.
- Cada célula guarda zona (Uint8), estado (livre, ocupada, inválida) e o prédio que a ocupa (Int32). Para o desenho
  da grade de zona, a simulação entrega centro e ângulo de cada célula.
- Célula inválida quando: cai em água; o chão varia mais de 4 m nela; fica fora dos ladrilhos comprados ou dentro da
  gleba; fica a menos de meia largura + 4 m de outra via; no lado de dentro de uma curva, o raio local é menor que o
  deslocamento da célula mais 4 m.
- Duas células de blocos diferentes a menos de 7 m uma da outra: fica a de linha menor (mais perto da própria via);
  empate, fica a do bloco mais antigo. Isso fecha as esquinas sem buraco nem sobreposição.
- Mudou a via: os blocos das arestas afetadas e dos vizinhos a até 60 m são refeitos; a pintura passa para a célula
  nova mais próxima (até 4 m); prédios em células que ficaram inválidas são demolidos (a pré-visualização da via já
  avisou).

### 6.2 Tipos de zona (M1)

| id | Nome | Cor da camada | Prédios | Marco |
|---|---|---|---|---|
| `resBaixa` | Residencial baixa | verde claro | casas e sobrados (1 a 3 andares) | 0 |
| `resMedia` | Residencial média | verde | prédios de 4 a 10 andares | 2 |
| `resAlta` | Residencial alta | verde escuro | torres de 15 a 40 andares | 4 |
| `comBaixa` | Comercial baixa | azul claro | lojas de rua, térreo comercial | 0 |
| `comAlta` | Comercial alta | azul | galerias, centros comerciais, torres de uso misto | 3 |
| `escritorio` | Escritórios | roxo | torres corporativas | 3 |
| `industria` | Indústria | amarelo | galpões e fábricas genéricas | 0 |

As cores seguem o CS2 (residencial verde, comercial azul, indústria amarela, escritório roxo); a paleta exata é da
UI. Residencial misto, indústria especializada (agro, floresta, mineração) e zonas de baixa renda ficam para M2 e M3.

### 6.3 Pincel (feito para o dedo)
- Tocar num bloco pinta a faixa inteira até o fundo escolhido (1 a 6 linhas); arrastar pinta por onde passa; um
  modo "quarteirão" preenche todos os blocos em volta de um miolo; apagar é o mesmo pincel com a zona 0.
- `q.zona.previa(pincel)` devolve as células que mudam e quantas têm prédio (pintar outra zona por cima de um prédio
  o marca para demolir quando ele for abandonado, como no CS2; não demole na hora).

### 6.4 Demanda
Calculada uma vez por dia, suavizada (novo = 0,8 x velho + 0,2 x calculado), de 0 a 100 por tipo de zona. Cada fator
tem teto e aparece no painel de demanda com o sinal e o valor, como o painel de fatores do CS2.

| Demanda | Fatores (calibrar os pesos) |
|---|---|
| Residencial (total) | base 40; + vagas de emprego livres (até +35); − desemprego (até −35); − moradias vagas (até −30); + (bem-estar médio − 50) x 0,5; + impulso inicial até 2.000 moradores (até +25); + atratividade da Arcologia (até +10) |
| Divisão em baixa, média e alta | peso da baixa pela fatia com estudo básico e fundamental; da média pelo ensino médio e pelos estudantes; da alta pelo superior e pelo valor do terreno livre acima de 450; tipo ainda trancado recebe peso 0 |
| Comercial (baixa e alta) | base 30; + consumo não atendido dos moradores (até +50); − lojas vagas (até −30); + mão de obra básica ociosa (até +10); a alta pede valor do terreno |
| Escritórios | base 10; + trabalhadores com superior sem emprego (até +50); + valor do terreno médio (até +15); − salas vagas |
| Indústria | base 30; + mão de obra básica ociosa (até +35); + bens que o comércio consome e a cidade não produz (até +25); − galpões vagos |

### 6.5 Nascimento dos prédios
- Uma lista por tipo de zona guarda as **frentes livres** (blocos com célula livre e pintada na linha 0), mantida a
  cada pintura, nascimento ou demolição.
- A cada tique, um acumulador por zona soma `demanda / 100 x taxa` (taxa: 0,4 residencial, 0,2 comercial, 0,15
  indústria, 0,1 escritório, em prédios por tique; calibrar). Cada unidade inteira vira uma tentativa, até 3 por
  tique no total e 60 obras abertas ao mesmo tempo.
- Tentativa: sorteia uma frente (peso = valor do terreno x acesso, pelo gerador da zona), acha a coluna livre, abre
  a largura até o máximo que as células livres da mesma zona permitem e o fundo possível, e escolhe no catálogo o
  maior modelo que cabe (zona, largura, fundo). Se nada cabe, a frente fica marcada "sem espaço" por 5 dias.
- O prédio nasce **em obra** (2 a 6 dias, pelo tamanho), com andaime e grua desenhados pelo render; a obra compra os
  materiais no mercado da cidade (seção 12.6).

### 6.6 Níveis de 1 a 5
- Uma vez por dia cada prédio ganha pontos: 5 + 10 x valor do terreno normalizado + 10 x bem-estar / 100
  (calibrar). Com `pontos >= 100 x nível` e os **requisitos do próximo nível**, abre uma obra curta de 2 dias que
  compra os materiais do nível e troca o modelo (mesma planta, mais alto e mais rico).
- Requisitos (mistura do CS2 com a lista do Highrise City):

| Nível | Pede |
|---|---|
| 2 | água, esgoto e energia |
| 3 | + saúde e educação na via do prédio |
| 4 | + segurança, bombeiros e parque ou praça a até 600 m |
| 5 | + valor do terreno acima de 600 e bem-estar do prédio acima de 70 |

- Nível mais alto: mais moradores ou empregos, menos consumo por pessoa, menos poluição (indústria), mais pontos de
  XP ao subir.

### 6.7 Abandono
- Um contador de dias com problema sobe enquanto o prédio está sem água, sem esgoto ou sem energia; com bem-estar
  abaixo de 20 (moradia); com menos de 30% das vagas ocupadas (trabalho); ou com menos de 30% dos clientes esperados
  (comércio). Zera quando o problema some.
- Aviso âmbar aos 5 dias, vermelho aos 10, **abandonado aos 15**: zera moradores e empregos, derruba o valor do
  terreno em volta e fica cinza. O jogador demole (custo baixo) ou espera: se o problema sumir, o lote volta a
  nascer pela demanda.

### 6.8 Catálogo de prédios da cidade (dados)
Cada modelo diz zona, planta em células, gente e empregos por nível, consumos, poluição e materiais. O desenho
(volumes, fachada, telhado) é do gerador do render, pela chave (modelo, nível, estilo, semente). Exemplos:

| Modelo | Zona | Planta (células) | Nível 1 | Nível 5 | Materiais do nível 1 |
|---|---|---|---|---|---|
| casa | resBaixa | 2 x 3 (16 x 24 m) | 1 lar, 4 moradores | 1 lar, 5 | 2 tijolo, 1 madeira serrada, 1 cimento |
| sobrado geminado | resBaixa | 3 x 4 | 2 lares, 8 | 3 lares, 12 | 4 tijolo, 2 madeira serrada, 2 cimento |
| prédio médio | resMedia | 4 x 5 | 16 lares, 48 | 28 lares, 84 | 8 concreto, 6 tijolo, 2 vidro |
| torre residencial | resAlta | 5 x 6 | 60 lares, 180 | 160 lares, 480 | 24 concreto, 8 vidro, 8 aço |
| loja | comBaixa | 2 x 3 | 6 empregos | 12 | 3 tijolo, 1 vidro |
| centro comercial | comAlta | 5 x 6 | 60 | 200 | 20 concreto, 10 vidro, 6 aço |
| torre de escritórios | escritorio | 5 x 6 | 150 | 500 | 24 concreto, 14 vidro, 10 aço |
| galpão | industria | 4 x 5 | 30 | 80 | 10 concreto, 6 aço |

Densidade que isso dá (conferência de ordem de grandeza): um km² com ruas a cada 112 m tem uns 80 quarteirões e
11 mil células; em residencial média são uns 550 prédios e 33 mil moradores. A área inicial comporta 50 a 100 mil
moradores.

---

## 7. Cidadãos e agentes

### 7.1 Quanto simular
- **Simulado (estatístico):** por prédio residencial, lares, moradores, contagem por escolaridade (4 níveis),
  empregados, estudantes, bem-estar; por prédio de trabalho, vagas por escolaridade e vagas ocupadas; por zona de
  tráfego, viagens. Não existe entidade por pessoa (o CS2 simula cada cidadão e paga caro; a lição do SimCity 2013 é
  não simular agentes simples demais com rota ingênua).
- **Desenhado (amostra, sem estado na simulação):** carros pelo fluxo das arestas, pedestres pela atividade dos prédios
  ao longo da via, operários nas obras. Tetos do VISAO.md: 1.600 pedestres e 400 carros no PC Ultra, 420 e 120 no Poco
  X7 Médio.
- **Agentes de verdade (poucos):** caminhões da Holding (entregas com rota, seção 13.4) e, no M2, ônibus nas linhas.
- **Cidadãos nomeados:** 40 moradores com nome, casa e emprego tirados dos agregados (um par prédio e índice), só para
  o Mural (o "Chirper") e para "seguir um morador". O que acontece com eles é sorteado do estado do prédio (falta
  água, subiu de nível, perdeu o emprego).

### 7.2 Escolaridade e educação
- Quatro níveis: 0 básico (sem escola ou fundamental incompleto), 1 fundamental, 2 médio, 3 superior. O CS2 usa
  cinco; quatro bastam para ligar escola, emprego e demanda, com uma coluna a menos em todo prédio.
- Uma vez por dia, em cada prédio coberto por escola do nível k com eficiência e, uma fração 0,5% x cobertura x e
  dos moradores do nível k passa ao k+1 (os estudantes contam na carga da escola). Faculdade e universidade (nível 3)
  entram no M2; no M1 o nível 3 vem de migrantes atraídos por escritórios e pela Arcologia.

### 7.3 Empregos
- Mercado de trabalho da cidade inteira no M1 (o trajeto ainda não restringe): do nível 3 para o 0, preenche as
  vagas do nível L com trabalhadores do nível L; quem sobra do nível L pode ocupar vaga de nível menor
  (sobrequalificado, com −3 de bem-estar). Cada local de trabalho recebe a mesma fração preenchida do seu nível.
- Trabalhadores = 60% dos moradores; desemprego do prédio = soma, por nível, da fração do nível x desemprego do nível.
- Ocupação de vagas baixa derruba a produção das empresas da Holding (seção 13.3) e leva ao abandono na zona.
- M2: o mercado passa a pesar o tempo de viagem (com o trânsito estável); M4: idade e aposentadoria.

### 7.4 Bem-estar (0 a 100, por prédio residencial)

| Termo | Valor |
|---|---|
| base | 50 |
| saúde, educação, segurança, bombeiros na via do prédio | até +8, +6, +6, +4 (pela cobertura x eficiência) |
| praça ou parque perto | até +10 |
| comércio a até 500 m | até +4 |
| sem água, sem esgoto, sem energia | −25, −15, −25 |
| poluição do ar, ruído | até −15, até −10 |
| desemprego do prédio | fração desempregada x −15 |
| tempo de viagem da zona (trânsito) | até −8 |
| Holding (Arcologia, decisões, políticas) | −10 a +10 |

Resultado limitado a 0..100 e suavizado em 1 dia. **A renda do prédio por hora de jogo é moradores x tarifa**, com
tarifa 5 (bem-estar até 30), 8 (31 a 60) e 11 (61 a 100): a regra do dono aplicada a cada morador pelo bem-estar
dele. A barra mostra o bem-estar médio ponderado pelos moradores. Se o dono preferir a faixa pela média da cidade
(como hoje), é um parâmetro (`REGRAS_DONO.tarifaPor = 'predio' | 'cidade'`); ver seção 20.

### 7.5 Migração e população
- Moradores chegam pela demanda residencial: cada prédio novo ou que sobe de nível enche em 1 a 3 dias. A
  escolaridade dos que chegam segue a oferta de empregos (vaga de escritório atrai superior) e a atratividade.
- Saem quando o prédio é abandonado (os lares vão embora da cidade no M1). Ciclo de vida (nascer, envelhecer, morrer)
  no M4.

---

## 8. Serviços e redes

### 8.1 Cobertura pela rede viária, com capacidade
- A cobertura anda pelas vias, como no CS2: para cada tipo de serviço, um **Dijkstra de várias origens** em que o
  custo de cada origem é normalizado pelo raio dela (d / raio); para quando passa de 1. Cada aresta guarda a origem
  mais próxima e a distância normalizada. Custo medido: 3,8 ms por tipo no grafo de 30 mil nós (Node).
- **Carga** de cada serviço = moradores (ou estudantes, pacientes) das arestas que ele atende; **eficiência** =
  min(1, capacidade / carga). **Cobertura da aresta** = (1 − d) x eficiência da origem. Os prédios leem a cobertura
  da aresta onde ficam.
- O Dijkstra só roda quando a rede ou os serviços mudam (um tipo por tique). Cargas e eficiência se recalculam uma vez
  por dia sem rodar o Dijkstra de novo.
- Orçamento por serviço (50% a 150%, muda capacidade e manutenção) e escolha do distrito atendido: M2.

| id | Serviço | Custo | Manutenção por h | Capacidade | Raio pela via | Empregos | Marco |
|---|---|---|---|---|---|---|---|
| `captacao` | Captação de água (margem de rio ou lagoa) | 25.000 | 800 | 5.000 m³/dia | rede | 10 | 0 |
| `poco` | Poço artesiano (lençol) | 8.000 | 300 | 800 m³/dia | rede | 3 | 0 |
| `ete` | Estação de tratamento de esgoto (margem) | 30.000 | 1.000 | 5.000 m³/dia | rede | 12 | 0 |
| `solar` | Usina solar (6 x 6 células) | 30.000 | 600 | 8 MW | rede | 6 | 0 |
| `termica` | Termelétrica a gás | 60.000 | 2.000 | 50 MW | rede | 30 | 1 |
| `praca` | Praça | 3.000 | 60 | lazer | 300 m | 0 | 0 |
| `clinica` | Clínica | 20.000 | 700 | 8.000 moradores | 1.200 m | 25 | 1 |
| `escolaF` | Escola fundamental | 25.000 | 900 | 600 vagas | 1.500 m | 30 | 1 |
| `delegacia` | Delegacia | 20.000 | 800 | 10.000 moradores | 1.500 m | 30 | 1 |
| `bombeiros` | Quartel de bombeiros | 25.000 | 900 | 12.000 moradores | 1.800 m | 30 | 2 |
| `escolaM` | Escola de ensino médio | 45.000 | 1.500 | 1.200 vagas | 2.500 m | 50 | 3 |
| `parque` | Parque | 12.000 | 250 | lazer | 600 m | 4 | 3 |
| `hospital` | Hospital | 90.000 | 3.000 | 40.000 moradores | 3.000 m | 200 | 4 |
| `parqueG` | Parque da orla (grande) | 40.000 | 800 | lazer e atratividade | 1.200 m | 12 | 5 |

Todos os números são ponto de partida (calibrar). Serviços da Arcologia (Escola, Universidade, Biblioteca) entram
como fontes de cobertura quando as etapas ficam prontas (M2 e M3).

### 8.2 Redes de água, esgoto e energia (simplificação para o celular)
- Canos e cabos de baixa tensão vão **dentro das vias** (como no CS2). Não há ferramenta de cano nem de cabo no M1;
  linhas de alta tensão desenhadas só no M4, e só no PC.
- A rede de cada recurso é o próprio grafo de vias: por **componente conexo**, oferta (produtores ligados) contra
  demanda (prédios ligados). Consumo: 0,2 m³/dia de água e de esgoto e 1 kW por morador; 0,1 m³/dia e 1,5 kW por
  emprego (indústria 3 kW).
- **Racionamento:** se a oferta não cobre a demanda, uma busca de várias origens a partir dos produtores ordena os
  prédios pela distância na rede, e os mais distantes ficam sem o recurso até a demanda caber na oferta. O problema
  aparece nas pontas da rede, não sorteado.
- **Ligação externa:** a rodovia importa até 5 MW e 1.000 m³/dia de água (uns 4 mil moradores) a um preço por hora
  (calibrar). Serve para a Vila e para o começo; depois o jogador troca por produção própria. Exportar o excedente de
  energia pela mesma ligação: M3.
- Lixo (coleta, aterro, reciclagem que vira matéria-prima da Holding), cemitério e crime com presídio: M2 e M4.

---

## 9. Transporte e trânsito

### 9.1 O que cabe no celular
Simular cada carro com rota, como o CS2, não cabe. Cabe um **trânsito agregado**: viagens entre zonas, fluxo por
aresta, congestionamento pela curva BPR e uma amostra visível. Com a bancada: um Dijkstra no grafo de 30 mil nós
custa 4,1 ms no Node (estimo 10 a 15 ms no Poco X7); uma atribuição com 64 zonas e 3 passadas faz 192 Dijkstras,
uns 0,8 s no Node e 2 a 3 s no celular, **dentro do worker**, com janela de 60 s de jogo (15 s reais em 4x).

### 9.2 Modelo (M1)
- **Zonas de tráfego:** células de 256 m com moradores ou empregos; o centroide liga aos nós da rede dentro da
  célula. Acima de 150 zonas ativas, as zonas se juntam em células de 512 m (limite do M1 a M3; o M4 revê).
- **Geração:** produção Pᵢ = trabalhadores empregados (viagem casa-trabalho no pico) + 0,3 x moradores (compras);
  atração Aⱼ = vagas ocupadas + 0,3 x capacidade comercial.
- **Distribuição por gravidade:** Tᵢⱼ = Pᵢ x Aⱼ x f(cᵢⱼ) / Σₖ Aₖ f(cᵢₖ), com f(c) = exp(−0,08 x c) e c em minutos
  de viagem com o congestionamento da atribuição anterior. Destino por atração e custo, nunca "o mais perto" (lição do
  SimCity 2013).
- **Atribuição incremental:** 3 passadas (50%, 30% e 20% das viagens); entre elas o tempo de cada aresta vira
  t = t0 x (1 + 0,15 x (v/c)⁴). Cada origem roda um Dijkstra e soma o fluxo subindo a árvore a partir dos destinos
  (O(nós) por origem).
- **Quando:** a cada 60 tiques a simulação monta a entrada (grafo por versão, zonas, P, A) e pede ao worker; o
  resultado entra **exatamente 60 tiques depois**. Se não chegou, a thread principal calcula na hora (trava um pouco,
  mas o jogo segue igual). O Node sempre calcula na hora: por isso o resultado é o mesmo nos dois.

### 9.3 Saídas
- Por aresta e sentido: fluxo no pico (veículos por hora), v/c e fator de velocidade. Por zona: tempo médio de
  viagem (entra no bem-estar e, no M2, na produtividade).
- **Carros visíveis (render):** densidade por aresta proporcional ao fluxo, com teto por perfil; no nó, o carro
  escolhe a próxima aresta com probabilidade proporcional ao fluxo que sai por ela (sem retorno). Anda na velocidade
  da aresta. Hora do dia visual modula a densidade (picos de manhã e à tarde do ciclo). Não há estado na simulação.
- **Caminhões da Holding:** agentes com rota A* na hora da entrega (seção 13.4). O render lê a lista de entregas e
  põe o caminhão no ponto certo do caminho pelo tique.

### 9.4 Transporte público e carga (depois)
- **Ônibus no M2** (o primeiro modo, como no CS2): linhas com paradas nas arestas, número de ônibus, tarifa;
  divisão modal por custo (tempo, dinheiro, conforto) tira viagens da matriz de carros; os ônibus são agentes.
- Metrô e VLT no M4; porto e aeroporto como portas de carga, turismo e exportação no M3; táxi e balsa no M3.

---

## 10. Ambiente e valor do terreno

### 10.1 Poluição
- **Ar:** grade de 128 x 128 (64 m), Uint8. Fontes: indústria (cai com o nível), termelétrica, fluxo das vias
  grandes. Por dia: soma as fontes, desloca a nuvem pelo vento do mês (fração de célula), uma passada de difusão e
  decaimento de 10%.
- **Ruído:** mesma grade, sem acúmulo: refeito por dia a partir do fluxo x tipo de via, comércio e indústria, com um
  borrão.
- Solo (indústria, aterro) e água (esgoto sem tratamento) no M2.
- Efeitos: bem-estar (seção 7.4), valor do terreno, demanda de saúde (M4).

### 10.2 Valor do terreno
- Grade de 256 x 256 (32 m), Float32, índice de 0 a 1.000. Refeita em fatias (1/20 por tique, cada célula uma vez por
  dia) e suavizada (0,8 velho + 0,2 novo).
- Soma: base 100; acesso viário (célula a até 48 m de uma via: +50); cobertura de saúde, educação, segurança,
  bombeiros e lazer (até +60 cada, lidas das arestas próximas); orla, rio e lagoa (+80 x e^(−d/200 m)); Arcologia
  (+200 x e^(−d/800 m), escalado pelas etapas prontas); centralidade (empregos de comércio e escritório a até 500 m,
  até +100); menos poluição do ar (x 1,0), ruído (x 0,6) e abandono (−40 perto).
- Usos: onde os prédios nascem, divisão da demanda residencial, pontos de nível, requisito do nível 5, preço dos
  ladrilhos e, no M3, o Imobiliário da Holding. Variar lote a lote (e não por bairro) atende a crítica da pesquisa de
  sistemas (hoje todos os lotes de um bairro valem o mesmo).

---

## 11. Camadas de informação e avisos

### 11.1 Camadas (info views)
Com uma camada aberta, o mundo fica neutro e o dado aparece em cor **nos próprios prédios e vias**, não só no chão (o
CS2 faz assim, conferido pela pesquisa). A simulação entrega o dado; o render pinta.

| Camada | Fonte | Rampa |
|---|---|---|
| Zonas | células e prédios | categórica |
| Valor do terreno | grade 32 m | sequencial |
| Bem-estar | prédios residenciais | divergente (30 e 60 marcados: as faixas 5, 8, 11) |
| Água, Esgoto, Energia | prédios (atendido, racionado, sem ligação) e produtores | categórica, com oferta e demanda na legenda |
| Saúde, Educação, Segurança, Bombeiros, Lazer | arestas (cobertura) e prédios | sequencial |
| Poluição do ar, Ruído | grade 64 m | sequencial |
| Trânsito | arestas (v/c) | verde, amarelo, vermelho |
| Nível dos prédios | prédios | 1 a 5 |
| Empregos | prédios de trabalho (ocupação) e moradia (desemprego) | divergente |
| Recursos naturais | grades 32 m | categórica com intensidade |
| Holding | propriedades, empresas, rotas de caminhão | categórica |
| Obras | prédios em obra e etapas da Arcologia | categórica |

Formato: `q.camada(tipo) → { fonte: 'predios' | 'arestas' | 'grade' | 'celulas', dados: TypedArray, rampa, legenda:
[{v, txt}], resumo: {txt, n} }`. `dados` tem um valor por índice (prédio, aresta, célula) ou é a grade inteira.
Recalcula quando a camada abre e quando o domínio muda de versão, nunca por quadro.

### 11.2 Avisos sobre os prédios
`q.avisos({ perto: {x, z}, limite })` devolve `[{ ref, tipo, gravidade: 'info' | 'alerta' | 'grave', desde, causa,
acao }]`, ordenados por gravidade e distância. Tipos no M1: sem água, sem esgoto, sem energia, sem acesso por via,
sem trabalhadores, sem clientes, desemprego alto, poluição alta, trânsito parado, abandono próximo (5 e 10 dias),
abandonado, obra sem material (espera o mercado), linha da Holding parada (sem insumo, sem gente, armazém cheio).
Falta de recurso da cidade inteira (oferta menor que demanda) vira **um** alerta de cidade, não um por prédio.

---

## 12. Economia

### 12.1 Regras do dono (constante congelada, testada)

```js
// fonte/data/economia.js: não mudar sem pedido do dono (testes em ferramentas/simular.mjs --testes)
export const REGRAS_DONO = Object.freeze({
  lote: { min: 1, max: 10, fatorTempo: 0.8 },           // lote de n leva t x max(1, 0,8 x n): 10 levam 8 vezes 1
  deposito: { venda: 1.5, vendasPorJanela: 100, janelaHoras: 4 }, // 150% do preço base; janela de 4 h de jogo
  emprestimo: { porAno: 50000, taxaAno: 0.10, dividaMax: 500000, passo: 1000, prazoAnos: 10, mora: 0.20 },
  renda: { faixas: [[30, 5], [60, 8], [100, 11]], tarifaPor: 'predio' }, // créditos por morador por hora de jogo
});
```

Prazo de 10 anos, mora de 20% e passo de 1.000 vêm do jogo atual (`EMP` em `estado.js`), que já aplica as regras
assim; ficam iguais.

### 12.2 Receitas e despesas

| Receitas | Como |
|---|---|
| Contribuição dos moradores | Σ prédios (moradores x tarifa pelo bem-estar), por hora de jogo, acumulada a cada tique |
| Vendas de materiais à cidade | cada obra ou subida de nível compra o que precisa; se a Holding tem estoque liberado para venda, vende a 100% do preço base |
| Depósito | venda a 150% do preço base, até 100 unidades por janela de 4 h de jogo (soma de todos os itens) |
| Marcos | prêmio em créditos (seção 15.1) |
| Depois | aluguel dos imóveis da Holding e impostos sobre empresas (M3, só com aprovação do dono), exportação pelo porto, turismo, tarifas de concessionária |

| Despesas | Como |
|---|---|
| Manutenção dos serviços | por hora de jogo, pela tabela da seção 8.1 |
| Manutenção das vias | por km por hora, pelo tipo |
| Ligação externa | água e energia importadas, por hora |
| Salários das empresas da Holding | trabalhadores ocupados x salário por nível de estudo, por hora |
| Juros | 10% ao ano sobre o principal, acumulados a cada tique (como hoje); mora de 20% depois de 10 anos |
| Importação de materiais | 160% do preço base (acima do preço de venda do Depósito, para não haver arbitragem), entrega em 2 dias de jogo |

### 12.3 Orçamento
- `q.orcamento()` → `{ receitas: {moradores, cidade, deposito, marcos}, despesas: {servicos, vias, ligacao,
  salarios, juros, importacao}, saldoHora, caixa, serie }`. Tudo por hora de jogo; a série guarda um ponto por mês
  (240 pontos = 20 anos) com caixa, receitas, despesas, moradores, bem-estar médio, desemprego e demanda.
- Caixa negativo: permitido até −50.000 com aviso grave; abaixo disso, obras e produção param até voltar (o
  empréstimo continua limitado pela regra do dono).

### 12.4 Empréstimo (regra do dono, igual a hoje)
- `cmd('emprestimo.tomar', {valor})` → `'ok' | 'valor' | 'limiteAno' | 'limiteDivida'`: múltiplos de 1.000; soma dos
  contratos do ano do jogo até 50.000; principal + juros devidos até 500.000.
- Juros de 10% ao ano sobre o saldo de cada contrato, acumulados a cada tique; contrato com mais de 10 anos rende 20%.
- `cmd('emprestimo.pagarJuros')`, `cmd('emprestimo.pagarParcela')` (juros + 10% do principal, mínimo 1.000, contratos
  mais antigos primeiro) e `cmd('emprestimo.quitar')`, como hoje.
- O limite **não** sobe por marco (o CS2 sobe; aqui não, por regra do dono).

### 12.5 Mercado da cidade e Depósito
- Cada item tem **preço base** (dados). Materiais de construção têm dois destinos automáticos e um manual:
  1. **Obras da cidade** compram do estoque da Holding a 100% do base se o item estiver liberado para venda e acima da
     reserva que o jogador marcou (padrão: reservar o que a próxima etapa da Arcologia pede). Sem estoque, a obra
     importa sozinha (sem receita para a Holding) e demora 50% a mais; até o marco 2 a demora extra não vale, porque
     a cidade começa antes de a Holding produzir tijolo, cimento e madeira serrada.
  2. **Arcologia:** as etapas puxam do estoque por caminhão (seção 14.3).
  3. **Depósito (manual ou automático):** `cmd('deposito.vender', {item, n})` → `'ok' | 'limite' | 'nada'`; regra
     "vender o que passar de N" por item. Janela = `floor(tique / 14.400)`; ao virar a janela, as vendas voltam a 0.
- `q.deposito()` → `{ janela: {fimTique, vendidas, max: 100}, itens: [{item, estoque, reserva, precoBase,
  precoVenda, vendeCidade, auto}] }`.

### 12.6 Números de partida e metas de calibração
Números de partida (calibrar): caixa inicial 250.000; Vila de Santa Cida com 350 moradores a tarifa 5 (sem serviços,
bem-estar perto de 25). O robô ajusta os preços e pesos até cumprir, em 1x:

| Meta | Alvo |
|---|---|
| saldo por hora positivo com os serviços básicos | a partir de uns 1.500 moradores |
| marco 1 / marco 3 / marco 7 | 10 a 15 min / 40 a 70 min / 5 a 7 h de jogo |
| empréstimo | o robô usa nos 2 primeiros anos e quita antes do ano 6; dívida nunca passa de 500 mil |
| vendas da Holding (cidade + Depósito) | 15% a 35% das receitas no marco 5 |
| bem-estar médio com cobertura completa | 62 a 75 (faixa de 11), sem saturar em 100 |
| moradores no fim do M1 (marco 7, Torre pronta) | 25 a 40 mil |

### 12.7 O que não entra no M1
Imposto sobre moradia (a regra do dono faz esse papel e não muda); imposto sobre comércio, escritório e indústria
(pergunta ao dono); tarifas de água e energia; aluguel dos imóveis da Holding; bolsa e ações (valuation só como
número de patrimônio: caixa − dívida + valor das propriedades a preço de terreno).

---

## 13. Holding e cadeias de produção

### 13.1 Empresas no M1
Uma Holding, um caixa. No M1 ela opera três negócios (as divisões com diretor, caixa e resultado próprios vêm no M3):
- **Held Materiais:** extração e indústria de materiais de construção.
- **Construtora Held:** executa as etapas da Arcologia (e, no M3, obras por contrato).
- **Held Logística:** armazéns e frota de caminhões.

### 13.2 Itens e receitas do M1 (preço base e tempo de 1 unidade em 1x; calibrar)
Uma unidade é uma carga de caminhão (por exemplo 10 t de brita ou 8 m³ de concreto).

| Item | Onde | Pede | Preço base | Tempo (s de jogo) | Marco |
|---|---|---|---|---|---|
| brita | Pedreira (sobre rocha) | recurso | 20 | 30 | 0 |
| areia | Areal (margem do rio) | recurso | 15 | 25 | 0 |
| madeira | Manejo florestal (floresta) | recurso | 30 | 45 | 1 |
| argila | Olaria (várzea) | recurso | 18 | 30 | 1 |
| calcário | Mina de calcário | recurso | 22 | 35 | 2 |
| tijolo | Olaria | 2 argila | 50 | 40 | 1 |
| madeira serrada | Serraria | 2 madeira | 80 | 50 | 1 |
| cimento | Cimenteira | 2 calcário + 1 argila | 90 | 60 | 2 |
| concreto | Concreteira | 1 cimento + 2 brita + 1 areia | 170 | 70 | 3 |
| vidro | Vidraria | 3 areia + 1 calcário | 140 | 90 | 4 |
| aço | só importado no M1 (siderúrgica e reciclagem no M3) | | 160 | | 3 |

### 13.3 Prédios de produção
- Colocados à mão, de frente para uma via, dentro de ladrilho comprado; extração só sobre o recurso (a produção cai
  com o recurso que resta na planta).
- Cada prédio tem **linhas** (1 no nível 1, 2 no nível 2, 3 no nível 3; subir de nível custa créditos e materiais).
- Cada linha roda **uma ordem de lote n (1 a 1000, D110)**: consome os insumos de n unidades do estoque na partida, leva
  `t x max(1, 0,8 x n) / produtividade` e entrega n unidades no estoque ao terminar (regra do dono, igual a hoje). Com
  **automático**, repete o mesmo lote enquanto houver insumo e espaço.
- Produtividade = ocupação das vagas (trabalhadores do mercado da cidade, seção 7.3): abaixo de 50% a linha para.
  Salários por hora entram nas despesas.
- Estoque global da Holding com capacidade = soma dos armazéns (o primeiro vem no Escritório de Obra). Armazém cheio
  segura a entrega na linha.
- **Compra de tempo** (pedido antigo do dono: 1 min 100, 5 min 500, 10 min 1.000, 30 min 2.500, 60 min 5.000
  créditos, em minutos de jogo): fica só nas linhas da Holding e nas etapas da Arcologia, nunca na cidade. Pergunta
  ao dono na seção 20.

### 13.4 Logística automática e visível (o Highrise City sem a microgestão que a crítica apontou)
- Toda transferência vira uma **entrega**: linha que terminou para o armazém mais perto, armazém para a obra da
  Arcologia, armazém para a obra da cidade que comprou, armazém para o Depósito. `{ id, item, n, origem, destino,
  caminho: arestas, tIni, tFim }`, com rota A* na hora (tempo com o congestionamento atual).
- A frota limita as entregas simultâneas (6 caminhões no começo; +6 por nível de armazém; garagem compra mais). Fila
  cheia atrasa a Arcologia: esse é o gargalo que o jogador resolve, sem desenhar rota nenhuma.
- No M1 o estoque é um só (a entrega é visual e dá o atraso). No M3 os armazéns ganham estoque próprio.

### 13.5 Depois (M3)
Divisões com diretores, Influência e Legado completos, rivais disputando terreno e demanda, bens de consumo
(alimentos, eletrônicos, móveis) vendidos ao comércio zoneado, siderúrgica, pré-moldados e fachadas, porto de carga
e aeroporto (exportação e turismo), hotéis e luxo, contratos com a Prefeitura e empresas.

---

## 14. A Arcologia de Held

### 14.1 Gleba, partes e etapas
- Uma gleba reservada (polígono nos dados do mapa) com **portões**: nós que a cidade deve alcançar com vias. A etapa
  do lago põe no grafo o anel viário interno e liga os portões.
- O desenho continua o **Trevo da Holding** (arquitetura.md): Anel Mestre, lago, Torre, 4 tambores, 4 folhas, eixo e
  contorno. Em metros, a proposta é 10 m por unidade antiga no plano (gleba de uns 800 x 620 m). Alturas e modelos
  são da parte de render e arquitetura (Torre Lâmina retangular, de luxo).
- Partes (ids novos): `lago`, `torre`, `sede`, `anel`, `tambores`, `escola`, `universidade`, `biblioteca`, `vida`,
  `eixo`, `contorno`, `fisica`. Cada parte tem etapas `e1..eN`.
- Estados de uma etapa: 0 trancada, 1 disponível, 2 em obra, 3 pronta.

### 14.2 Etapas do M1 (Ato 1; números para calibrar)

| id | Etapa | Marco | Créditos | Materiais | Dias (1x) | Efeitos quando pronta |
|---|---|---|---|---|---|---|
| `lago.e1` | Terraplenagem, lago e anel viário | 0 | 60.000 | 50 brita, 50 areia | 15 (5 min) | portões ligados; valor do terreno em volta; XP 300 |
| `torre.e1` | Fundações e pódio da Torre Lâmina | 3 | 150.000 | 60 concreto, 60 brita, 20 aço | 30 (10 min) | XP 600 |
| `torre.e2` | Corpo: blocos 1 e 2 | 4 | 300.000 | 120 concreto, 60 aço, 40 vidro | 45 | 1.200 empregos (escritórios da Holding, níveis 2 e 3); XP 1.000 |
| `torre.e3` | Corpo: blocos 3 e 4 | 5 | 350.000 | 100 concreto, 60 aço, 60 vidro | 45 | 400 moradores de luxo; XP 1.200 |
| `torre.e4` | Coroa-lanterna e heliponto | 6 | 250.000 | 50 vidro, 30 aço, 20 madeira serrada | 30 | atratividade; Legado +5; valor do terreno num raio de 1,5 km; helicóptero da Holding; XP 1.500 |

### 14.3 Entrega e progresso (Highrise City)
- Cada etapa tem fases (fundação, estrutura, fachada, acabamento) com uma fatia dos materiais. O progresso =
  min(tempo decorrido / duração, materiais entregues / pedidos). Sem material, a obra para e o aviso "obra sem
  material" aparece sobre o canteiro.
- As entregas saem do estoque respeitando a reserva; o jogador pode comprar o que falta pela importação (160%, 2 dias).
- O render lê `espelho.arcologia` (estado, fase e progresso de cada etapa) para subir a obra por fases.

### 14.4 Depois do M1
- M2 (Ato 2): `sede.e1` (Anel Mestre norte e Torres do Conselho, sede das divisões), `anel.e1..e3` (moradia),
  `escola.e1..e2`, `universidade.e1..e3` (entram como serviços de educação da cidade).
- M3 (Ato 3): `biblioteca`, `vida` (Cúpula e Supertrees: atratividade e turismo), `eixo`.
- M4 (Ato 4): `tambores`, `contorno`, `fisica` (acelerador: pesquisa e desbloqueios).

---

## 15. Progressão e narrativa

### 15.1 XP e marcos
- XP passivo: +1 por morador acima do maior número já atingido (os 350 da Vila contam como ponto de partida); por dia, + moradores x (bem-estar − 50) / 5.000 se o
  bem-estar médio passar de 50.
- XP ativo: vias (+1 por 100 m), serviços (+20 a +80), prédios da Holding (+30), etapas da Arcologia (tabela 14.2).
- Cada marco dá créditos (10.000 x n), 1 licença de ladrilho (a partir do marco 2), desbloqueios e, do M2 em diante,
  pontos para a árvore de desenvolvimento. O limite do empréstimo não muda (regra do dono).

| n | Marco | XP | Desbloqueia (M1) |
|---|---|---|---|
| 0 | Canteiro | 0 | rua, avenida; residencial baixa, comercial baixa, indústria; captação, poço, esgoto, usina solar, praça; Escritório de Obra, Pedreira, Areal; Depósito; empréstimo; `lago.e1` |
| 1 | Povoado | 300 | clínica, escola fundamental, delegacia, termelétrica; Olaria, Manejo florestal, Serraria |
| 2 | Vila | 900 | bombeiros; residencial média; rua de mão única; Mina de calcário, Cimenteira; 1ª licença |
| 3 | Vila Próspera | 2.000 | escritórios, comercial alta; ensino médio, parque; Concreteira; importação de aço; `torre.e1` |
| 4 | Cidade Nova | 4.000 | avenida grande; residencial alta; hospital; Vidraria; `torre.e2` |
| 5 | Cidade | 7.500 | parque da orla; armazém nível 2 e garagem; `torre.e3` |
| 6 | Cidade Grande | 13.000 | `torre.e4` |
| 7 | Polo Regional | 21.000 | fim do Ato 1 (inauguração da Torre); o que o M2 trouxer |
| 8 a 15 | Capital Regional, Metrópole Nascente, Metrópole, Grande Metrópole, Metrópole Nacional, Metrópole Continental, Cidade Global, Heldópolis Lendária | 32 mil a 300 mil | M2 a M4 |

### 15.2 Árvore de desenvolvimento (M2)
Nós por área (vias, redes, serviços, transporte, Holding, Arcologia), pagos com os pontos dos marcos, como no CS2.
Exemplos: rotatória, ponte, orçamento por serviço, segunda linha de ônibus, siderúrgica.

### 15.3 Atos, conselheiros e decisões
- **Atos** (VISAO.md 5.8): 1 A Concessão (M1: da Vila à Torre), 2 A Cidade (M2), 3 O Mercado (M3: rivais), 4 O País
  (M4 e M5: política), 5 O Mundo (M6: metrópoles).
- **Conselheiros** que continuam: Íris (arquiteta-chefe: Arcologia e urbanismo), Tomé (engenheiro de materiais: obras
  e logística), Nara (bióloga: ambiente), Caio (físico: energia e ciência), Dona Cida (voz dos moradores). Novos a
  partir do M3: a diretora financeira, o advogado, a chefe de relações públicas, os fundadores rivais.
- **Decisão:** 2 a 4 opções, cada uma com ganho, custo e o medidor que puxa (Influência ou Legado). A escolha grava
  uma marca que outras decisões e falas leem depois ("memória", M3 completa).

```js
// fonte/data/historia.js (formato)
{ id: 'vila.agua', ato: 1, quando: { marco: 1, fato: 'vilaSemAgua' }, quem: 'cida',
  texto: 'A Vila espera água há vinte anos. A captação pode ir para a Vila ou para os lotes novos primeiro.',
  opcoes: [
    { id: 'vila', quem: 'cida', txt: 'A Vila primeiro', ganho: '+6 de bem-estar na Vila por 2 anos', custo: 'a primeira
      zona nova espera 10 dias', legado: +5, efeitos: [{ tipo: 'bemArea', area: 'vila', v: 6, anos: 2 }] },
    { id: 'lotes', quem: 'tome', txt: 'Os lotes novos primeiro', ganho: 'demanda residencial +10 por 1 ano', custo:
      '−4 de bem-estar na Vila', influencia: +5, efeitos: [{ tipo: 'demanda', zona: 'res', v: 10, anos: 1 }] } ] }
```

- **Influência e Legado** (0 a 100) já existem no M1, movidos pelas decisões; no M1 os efeitos são diretos (descontos
  em licenças, bem-estar). Os usos completos (licitações, política, finais) vêm no M3 a M6.

### 15.4 Objetivos (a primeira hora sem tutorial pesado)
Lista de dados com um predicado sobre o estado e uma recompensa pequena; a UI mostra um de cada vez (o cartão
"Agora"). `q.objetivos()` → `[{ id, texto, quem, progresso: {feito, total}, alvo: {x, z} | {ui: 'ferramenta.via'},
recompensa }]`. Exemplos: ligar a rodovia à gleba, levar água à Vila, pintar a primeira zona, abrir Pedreira e Areal
com lote de 10 automático, começar `lago.e1`, 1.000 moradores, clínica e escola, primeira venda no Depósito.

---

## 16. Arquitetura de software

### 16.1 Visão geral

```
 toque, mouse, teclado
        |
        v
  ferramentas da UI --- q.via.previa(), q.zona.previa() (puras, síncronas) ---+
        |                                                                      |
        | cmd(nome, args)                        q.*(consultas puras)          |
        v                                             ^                        |
  +-----------------------------------------------+   |                        |
  | SIM (thread principal no M1)                  |---+  UI (DOM)              |
  |  relógio, agendador, sistemas, estado (SoA),  |                            |
  |  livro de comandos, eventos                   |--- espelho + mudancas --> render (three)
  +-----------------------------------------------+
        | pedir(tarefa, entrada) no tique T        ^ resultado aplicado no tique T + K
        v                                          |
  WORKER de tarefas (trânsito; no Node roda síncrono, mesma função)
```

### 16.2 Thread principal ou worker
- **M1 a M3: simulação na thread principal**, com tarefas pesadas no worker. Motivos:
  1. a UI e as ferramentas precisam de consultas síncronas (pré-visualização da via a cada movimento do dedo);
  2. o render lê os arrays tipados sem cópia;
  3. o tique cabe (medido: varrer 20 mil prédios custa 0,31 ms no Node; o agendador fatia o resto);
  4. `SharedArrayBuffer` exige os cabeçalhos COOP e COEP, que o GitHub Pages não deixa configurar (há o contorno por
     service worker, frágil). Sem ele, espelhar o estado do worker custaria cópias a cada tique (medido: 0,6 ms por MB
     só para clonar, no Node).
- **Worker para tarefas:** trânsito (M1), cobertura quando o grafo passar de 50 mil nós (M4), rotas de ônibus (M2).
  Entrada com arrays transferidos (o grafo só vai quando a versão muda; o worker guarda a última), saída transferida.
- **Determinismo com worker:** a tarefa pedida no tique T entra no tique T + K (K fixo por tarefa). Se não chegou, a
  thread principal calcula na hora. O Node calcula sempre na hora. Mesma função, mesmo resultado.
- **M4:** se o tique passar de 4 ms no p95 no Poco X7, a simulação inteira vai para o worker. A disciplina de hoje
  (comandos entram, mudanças saem, consultas puras) torna a mudança mecânica: a UI passa a ler um espelho atualizado
  por deltas.
- **Montagem:** no `app/` o worker vira um arquivo com carimbo, guardado pelo `sw.js`; no HTML único ele vai embutido
  como texto e sobe por `Blob` e `URL.createObjectURL`. O `montar.mjs` ganha essa saída.

### 16.3 Estado
```
S = {
  versao: 1, semente, mapa: 'heldopolis', tique, velocidade, criado, gravado, nome,
  rng: { crescimento, cidadaos, historia, transito, ... },   // estado de cada gerador (4 x Uint32)
  holding: { caixa, emprestimo: {principal, juros, contratos: [{id, ano, valor, saldo, ini, fim}]},
             estoque: {item: n}, reserva: {item: n}, vendeCidade: {item: bool}, autoDeposito: {item: n},
             frota, influencia, legado, stats },
  cidade: { ladrilhos: Uint8Array(256), vias, zonas, predios, obras, cidadaos, servicos, redes,
            grades: {valor, ar, ruido}, transito, demanda, serie },
  arcologia: { etapas: { id: {estado, ini, fase, entregue: {item: n}} } },
  progresso: { xp, marco, licencas, popMax, desbloqueados: [ids] },
  historia: { ato, decisoes: {id: opcao}, marcas: [ids], objetivos: {id: estado}, mural: [...], nomeados: [...] },
  deposito: { janela, vendidas },
  livro: [[tique, nome, args], ...]   // últimos 2.000 comandos, para reproduzir defeitos
}
```
- **Tabelas em colunas (SoA):** `criarTabela({ x: Float64Array, z: Float64Array, nivel: Uint8Array, ... }, cap)`
  com `n`, `cap`, lista de livres, `ger` (Uint16, geração do índice), `alocar()`, `liberar(i)` e crescimento por
  dobra. Referência externa = `i + ger x 2²⁰` (número seguro em JS); a UI guarda referências, o render usa índices com
  a versão do domínio.
- Tabelas do M1: nós, arestas, blocos, células, prédios, obras, entregas. Grades: altura, água, recursos, valor, ar,
  ruído.
- **Grade espacial** de 64 m (128 x 128 baldes) com listas encadeadas em arrays (cabeça por balde, próximo por
  entrada) para arestas, prédios e blocos: encaixe da ferramenta, colisão, toque e consultas "perto de".
- Estimativa de memória no mapa inteiro com 50 mil prédios: nós e arestas 3 MB, células 300 mil x 12 B = 3,6 MB,
  prédios 50 mil x 60 B = 3 MB, grades 6 MB, altura 4,2 MB: uns 20 MB, abaixo do teto de 64 MB.

### 16.4 Comandos, consultas, eventos e espelho
- **Comandos** (a única forma de mudar o estado; entram no início do próximo tique, na ordem; vão para o livro):
  `via.construir`, `via.melhorar`, `via.demolir`, `zona.pintar`, `construir` (serviço, Holding), `demolir`,
  `predio.nivel` (Holding), `linha.ordem` {predio, linha, item, n, auto}, `linha.parar`, `estoque.reserva`,
  `estoque.vendeCidade`, `deposito.vender`, `deposito.auto`, `importar`, `emprestimo.tomar`, `emprestimo.pagarJuros`,
  `emprestimo.pagarParcela`, `emprestimo.quitar`, `arcologia.iniciar`, `acelerar` {alvo, minutos}, `decisao.escolher`,
  `ladrilho.comprar`, `velocidade`. Resposta: `{ ok, codigo, ... }` com códigos curtos ('creditos', 'marco',
  'ladrilho', 'agua', 'declive', 'limiteAno' etc.) que a UI traduz.
- **Consultas** (puras, síncronas, nunca mudam o estado; teste: o hash do estado não muda): `barra`, `demanda`,
  `orcamento`, `emprestimo`, `deposito`, `producao`, `predio(ref)`, `aresta(ref)`, `arcologia`, `marcos`,
  `objetivos`, `avisos`, `camada`, `estatisticas`, `via.previa`, `zona.previa`, `construir.previa` (com os efeitos na
  vizinhança: valor do terreno, ruído e cobertura, as setas do Anno 117).
- **Eventos** (`sim.on(nome, fn)`), emitidos no fim do tique: `marco`, `desbloqueio`, `decisao`, `mural`, `aviso`,
  `etapa`, `objetivo`, `financas`, `obraFim`, `predioNivel`, `predioAbandonado`, `velocidade`, `salvo`. Servem à UI,
  ao som e ao Mural.
- **Espelho e diário de mudanças** (contrato com o render): leitura direta dos arrays, e
  `sim.mudancas.desde(versao)` → `{ versao, vias: {nos: Int32Array, arestas: Int32Array}, blocos: Int32Array,
  predios: Int32Array, obras: Int32Array, grades: [nomes], fluxos: bool, arcologia: bool, entregas: bool,
  ladrilhos: bool }`. O render pede uma vez por quadro e refaz só o que mudou. Formato na seção 17.1.

### 16.5 Determinismo
- Nada de `Date.now`, `performance.now` ou `Math.random` em `fonte/sim/` (o teste procura no código).
- Gerador xoshiro128** com um fluxo por sistema, estado no save; sorteios só dentro do tique.
- Laços em ordem de índice; listas de livres em ordem determinística; nada depende da ordem de chaves de objeto com
  números.
- Tarefas do worker aplicadas em tique fixo (seção 16.2).
- `hashEstado(S)`: FNV-1a sobre as seções binárias e o JSON canônico do save.
- Node e Chrome usam o mesmo V8 (as funções `Math.exp`, `Math.pow` vêm da mesma biblioteca); o robô do navegador
  confere o hash de um trecho curto contra o Node. Se divergir, as curvas viram tabela.

### 16.6 Save
- **Formato binário versionado:** cabeçalho `HELD` + versão + JSON (escalares, listas pequenas, história) + seções
  binárias `{nome, tipo, tamanho, bytes}` alinhadas em 8, tudo comprimido com gzip (`CompressionStream` no navegador,
  `zlib` no Node). A grade de altura não vai (sai da semente); no M4 vão os remendos da terraplanagem.
- Tamanho estimado: 20 mil prédios, 300 mil células e 20 mil arestas somam uns 4 MB crus e 1 MB comprimidos.
- **IndexedDB** num banco novo (`heldopolis`), loja `saves` (conteúdo) e loja `meta` (nome, data, moradores, caixa,
  marco, miniatura) para listar sem abrir. Vagas: 3 automáticas em rodízio (1 por mês de jogo e ao sair da página) e
  até 8 manuais. `localStorage` guarda só o id do último save.
- O banco do jogo antigo (`arcologia-de-held`) não é apagado nem lido.
- **Exportar e importar:** arquivo `.held` (o próprio gzip). Importar confere cabeçalho e versão, migra, carrega numa
  simulação nova, roda `validar(S)` (invariantes: células x prédios, grafo sem aresta órfã, dívida dentro do limite) e
  só então troca. Do `core/salvar.js` de hoje ficam as proteções que provaram funcionar: trava durante a importação,
  "outra página gravou", quarentena de save danificado e pedido de armazenamento persistente.
- **Migrações:** `MIGRACOES[v](dados) → dados` de v para v + 1; um save de exemplo por versão em `ferramentas/saves/`
  e um teste que abre todos.

### 16.7 Testes e ferramentas
- `node ferramentas/simular.mjs --testes`: regras do dono (tarifa nas bordas 30, 31, 60, 61; limite anual e dívida do
  empréstimo; 10% em um ano com erro abaixo de 0,1%; mora depois de 10 anos; Depósito a 150%, 100 por janela e virada
  da janela; lote 0 e 11 recusados, lote de 10 leva 8 vezes o de 1), vias (divisão no cruzamento, ângulo mínimo,
  encaixe em nó, grade com contagem certa, custo, devolução), zonas (células de uma reta de 200 m, invalidez em água,
  declive e gleba, pintura preservada ao refazer), crescimento (nasce com demanda, sem sobreposição, sobe de nível com
  serviços, abandona sem água em 15 dias), serviços (cobertura cai com a distância pela via, componente desligado não
  recebe), redes (racionamento dos mais distantes), trânsito (conservação do fluxo, mesma resposta síncrona e pelo
  worker simulado), save (ida e volta com hash igual, migração, arquivo danificado recusado), determinismo (sem
  relógio nem `Math.random` em `fonte/sim/`).
- `node ferramentas/simular.mjs --robo [--horas 7] [--semente s]`: o robô joga pelo mesmo `cmd()` (avenida da rodovia
  à gleba, grade de ruas, zonas pela demanda, redes, serviços onde a camada falta, Holding em lotes de 10 com
  automático, etapas, empréstimo quando o caixa aperta, ladrilhos quando há licença). Relatório: tempo de cada marco em
  horas de jogo, moradores, bem-estar, renda por hora, dívida, erros, ms por tique (p50 e p95), memória.
- `--determinismo`: duas partidas iguais dão o mesmo hash em 3 pontos; salvar e carregar no meio dá o mesmo hash no
  fim.
- `--bancada`: cidade sintética de 30 mil e de 100 mil moradores; tempo por sistema e por tique.
- `ferramentas/mapa.mjs`: tira PNG do relevo, da água, dos recursos e das zonas iniciais (sem navegador) para
  conferir o mapa autoral.
- No navegador (`testar.mjs`, que fica): o robô joga 20 min em 4x pela UI e confere erros, hash de um trecho contra o
  Node e o orçamento gráfico.

---

## 17. Módulos e arquivos

### 17.1 `fonte/sim/`

| Arquivo | Faz | Interface principal |
|---|---|---|
| `nucleo.js` | cria a simulação, relógio, fila de comandos, agendador, eventos, espelho, diário | `criarSim({ semente, mapa, dados? }) → Sim`; `sim.avancar(msReais) → nTiques` (até 8 tiques por quadro); `sim.tique()`; `sim.velocidade`; `sim.cmd(nome, args) → Resposta`; `sim.q`; `sim.on(nome, fn)`; `sim.espelho`; `sim.mudancas.desde(v)` |
| `relogio.js` | constantes e calendário | `TIQUE_S = 1, DIA = 20, MES = 600, ANO = 7200, HORA = 3600`; `calendario(t) → { mes, ano, diaDoMes, fracMes }` |
| `rng.js` | geradores e hash | `rng(estado) → { u32(), f(), int(a, b), escolher(pesos) }`; `semear(semente, canal)`; `fnv1a(bytes, h?)` |
| `tabela.js` | tabelas SoA | `criarTabela(colunas, cap)`; `ref(i)`, `idx(ref)`, `viva(ref)` |
| `grade.js` | grade espacial | `criarGrade(passo, tam)`; `inserir(lista, id, caixa)`; `remover(...)`; `consultar(caixa, fn)`; `maisPerto(x, z, raio, filtro)` |
| `mundo/terreno.js` | altura, água, declive | `gerarTerreno(mapa, semente) → { tam, passo, origem, altura: Float32Array, agua: Uint8Array }`; `altura(T, x, z)`; `declive(T, x, z)`; `ehAgua(T, x, z)` |
| `mundo/recursos.js` | grades de recursos | `gerarRecursos(mapa, semente) → { rocha, areia, ... : Uint8Array(65536) }`; `extrair(R, tipo, poligono, n)` |
| `mundo/ladrilhos.js` | posse e compra | `ladrilhoDe(x, z)`; `podeComprar(S, i, j) → codigo`; `preco(S, i, j)` |
| `vias/bezier.js` | curvas | `ponto(p, t, out)`, `tangente(p, t, out)`, `tabelaArco(p) → Float32Array(17)`, `tDoArco(tab, s)`, `maisPerto(p, x, z)`, `cruzamentos(p, q) → [[t, u]]`, `deslocar(p, d)` |
| `vias/grafo.js` | nós e arestas | `criarGrafo()`; `addNo(G, x, z, y)`; `addAresta(G, a, b, tipo, p1, p2)`; `dividir(G, e, t) → no`; `removerAresta(G, e)`; `fundir(G, n1, n2)`; `componentes(G) → Int32Array`; `cortes(G, n)` |
| `vias/ferramenta.js` | traçado puro | `planejar(G, T, S, { modo, tipo, pontos, tolerancia, grade? }) → Plano { segmentos, nosNovos, divisoes, demolir, guias, custo, erros: [{codigo, trecho}] }`; `aplicar(sim, plano) → Resposta` |
| `zonas/blocos.js` | blocos e células | `refazerBlocos(sim, arestas)`; `validarCelula(sim, c)`; espelho: `celulas.{x, z, ang, zona, estado, predio}` |
| `zonas/pincel.js` | pintura | `previa(sim, pincel) → { celulas: Int32Array, comPredio }`; `pintar(sim, pincel, zona)` |
| `zonas/demanda.js` | demanda | `calcularDemanda(sim) → { resBaixa, resMedia, resAlta, comBaixa, comAlta, escritorio, industria, fatores: {zona: [{id, v}]} }` |
| `zonas/crescimento.js` | nascer, subir, abandonar | `sistemaCrescimento(sim)`; `sistemaPredios(sim, fatia)` |
| `predios.js` | tabela de prédios e colocados à mão | `previaConstruir(sim, {tipo, x, z, rot}) → { ok, erros, custo, efeitos }`; `construir(sim, ...)`; `demolir(sim, ref)` |
| `cidadaos.js` | lares, estudo, empregos, migração, nomeados | `sistemaCidadaos(sim)` (diário); `mercadoTrabalho(sim) → { desemprego: Float32Array(4), ocupacao: Float32Array(4) }` |
| `bemestar.js` | bem-estar e tarifa | `bemEstarPredio(sim, i) → 0..100`; `tarifa(b) → 5 \| 8 \| 11` |
| `servicos.js` | cobertura e capacidade | `coberturaTipo(sim, tipo)` (Dijkstra normalizado); `cargas(sim)`; espelho: `cobertura[tipo]: Uint8Array(por aresta)` |
| `redes.js` | água, esgoto, energia | `balanco(sim) → { agua: {oferta, demanda}, esgoto, energia }`; `racionar(sim, recurso)` |
| `transito.js` | montar entrada e aplicar saída | `entradaTransito(sim) → Entrada (arrays)`; `aplicarTransito(sim, saida)` |
| `tarefas/transito.js` | função pura (worker e Node) | `atribuir({ grafo, zonas, P, A, passadas }) → { fluxo: Float32Array(2 x arestas), tempoZona: Float32Array }` |
| `tarefas.js` | fila de tarefas | `criarTarefas({ worker })`; `pedir(nome, entrada, tiqueAplicar) → id`; `resultado(id, tiqueAtual)` (calcula na hora se venceu) |
| `ambiente.js` | ar, ruído, valor do terreno | `sistemaAmbiente(sim, fatia)`; espelho: `grades.{valor, ar, ruido}` |
| `economia.js` | receitas, despesas, empréstimo, série | `sistemaEconomia(sim)`; `emprestimo.{tomar, pagarJuros, pagarParcela, quitar}`; `orcamento(sim)` |
| `holding/producao.js` | linhas, lotes, estoque | `ordem(sim, predio, linha, item, n, auto) → codigo`; `sistemaProducao(sim)` |
| `holding/mercado.js` | mercado da cidade, Depósito, importação | `comprarObra(sim, obra, materiais)`; `vender(sim, item, n) → codigo`; `importar(sim, item, n)` |
| `holding/logistica.js` | entregas e frota | `novaEntrega(sim, {item, n, origem, destino})`; `rota(sim, a, b) → Int32Array` (A*); `sistemaEntregas(sim)` |
| `arcologia.js` | etapas | `iniciar(sim, id) → codigo`; `sistemaArcologia(sim)`; espelho: `arcologia.etapas` |
| `progresso.js` | XP, marcos, licenças | `ganharXp(sim, n, motivo)`; `sistemaMarcos(sim)`; `liberado(sim, id) → bool` |
| `historia.js` | atos, decisões, objetivos, Mural | `sistemaHistoria(sim)`; `escolher(sim, id, opcao) → codigo` |
| `avisos.js` | avisos por prédio e da cidade | `avisos(sim, filtro)` |
| `camadas.js` | dados das info views | `camada(sim, tipo)` |
| `consultas.js` | junta as consultas `q.*` | `criarConsultas(sim)` |
| `salvar/formato.js` | binário, gzip, migrações, validação | `serializar(S) → Uint8Array`; `desserializar(bytes) → S`; `MIGRACOES`; `validar(S) → [erros]`; `hashEstado(S)` |
| `salvar/armazem.js` | IndexedDB, exportar, importar | `gravar(slot, bytes, meta)`; `ler(slot)`; `listar()`; `exportar(S)`; `importar(arquivo)` (herda as travas do `core/salvar.js`) |
| `trabalhador.js` | ponto de entrada do worker | recebe `{id, nome, entrada}`, responde `{id, saida}` com transferência |

**Contrato do espelho com o render (M1):**

```js
sim.espelho = {
  terreno: { tam: 1025, passo: 8, origem: [-4096, -4096], altura: Float32Array, agua: Uint8Array, rio: Float32Array },
  ladrilhos: Uint8Array(256),                // 0 trancado, 1 comprável, 2 da Holding
  vias: {
    nos: { n, x, y, z /* Float64Array */, grau: Uint8Array, tipo: Uint8Array, raio: Float32Array },
    arestas: { n, viva: Uint8Array, a, b /* Int32Array */, tipo: Uint8Array,
               p: Float64Array /* 8 por aresta: p0..p3 em x, z */, y: Float32Array /* 2 */, comp: Float32Array,
               corte: Float32Array /* 2: t0, t1 */, mao: Int8Array /* 0 dupla, 1 a→b, -1 b→a */ } },
  celulas: { n, x, z /* Float32Array */, ang: Float32Array, zona: Uint8Array, estado: Uint8Array, predio: Int32Array },
  predios: { n, viva: Uint8Array, modelo: Uint16Array, zona: Uint8Array, x, z: Float64Array, y: Float32Array,
             rot: Float32Array, w, d: Uint8Array /* em células de 8 m ou metros para os colocados */, nivel: Uint8Array,
             estilo: Uint8Array, semente: Uint32Array, flags: Uint32Array /* obra, abandonado, sem água... */,
             obraIni, obraFim: Uint32Array, cor: Uint8Array },
  fluxos: { ida, volta, vel: Float32Array /* por aresta */ },
  entregas: [{ id, item, caminho: Int32Array, tIni, tFim }],
  arcologia: { etapas: [{ id, estado, fase, progresso }] },
  grades: { valor: { tam: 256, passo: 32, dados: Float32Array }, ar: { tam: 128, passo: 64, dados: Uint8Array },
            ruido: { ... } },
  tique, fracTique,                           // para interpolar o que anda entre tiques
};
```

### 17.2 `fonte/data/`

| Arquivo | Conteúdo | Formato (exemplo) |
|---|---|---|
| `economia.js` | `REGRAS_DONO` (congelado), caixa inicial, custos gerais, compra de tempo | seção 12.1 |
| `mapa-heldopolis.js` | semente, tamanho, controles do relevo, costa, rio, lagoa, recursos, rodovia, gleba e portões, Vila, ladrilhos iniciais | `{ semente: 'heldopolis-1', tam: 8192, ladrilho: 512, inicio: [[6,6],[9,9]], rio: [[x, z, largura], ...], morros: [{c, r, h}], gleba: {poligono, portoes}, vila: {vias, predios}, rodovia: {pontos, faixas} }` |
| `vias.js` | tipos de via | `{ rua: { nome, faixas: [1, 1], largura: 12, vel: 40, cap: 700, custo: 30, manut: 150, zona: true, declive: 0.12, raioMin: 20, marco: 0 }, ... }` |
| `zonas.js` | tipos de zona | `{ resBaixa: { nome, grupo: 'res', dens: 1, cor, marco: 0 }, ... }` |
| `predios.js` | catálogo da cidade | `{ casa: { zona: 'resBaixa', w: 2, d: 3, niveis: [{ lares: 1, mor: 4, materiais: {tijolo: 2, serrada: 1, cimento: 1}, agua: 0.8, kw: 4 }, ...], estilos: ['tropical', 'moderno'] } }` |
| `servicos.js` | serviços e utilidades | `{ clinica: { nome, custo, manut, cap: 8000, raio: 1200, empregos: [5, 10, 8, 2], planta: [24, 32], marco: 1, xp: 30 } }` |
| `holding.js` | itens, receitas, prédios de produção, armazéns, frota | `ITENS: { concreto: { nome, base: 170, t: 70, req: {cimento: 1, brita: 2, areia: 1}, predio: 'concreteira', marco: 3 } }`, `PREDIOS_HOLDING: { pedreira: { recurso: 'rocha', linhas: [1, 2, 3], vagas: [...], custo, manut } }` |
| `arcologia.js` | partes, etapas, fases, efeitos | `{ id: 'torre.e2', parte: 'torre', nome, marco: 4, creditos: 300000, materiais: {...}, dias: 45, fases: [...], efeitos: [{ tipo: 'empregos', niveis: [0, 0, 600, 600] }], xp: 1000 }` |
| `marcos.js` | marcos, XP, prêmios, desbloqueios | `[{ n: 3, nome: 'Vila Próspera', xp: 2000, creditos: 30000, licencas: 1, libera: ['escritorio', 'comAlta', ...] }]` |
| `historia.js` | atos, conselheiros, decisões, objetivos, falas do Mural | seção 15.3 |
| `nomes.js` | nomes brasileiros para os moradores nomeados e empresas da cidade (fictícios) | listas |

### 17.3 `ferramentas/`
`montar.mjs` (reaproveitado, com a saída do worker), `simular.mjs` (testes, robô, determinismo, bancada),
`robo-sim.mjs` (a estratégia do robô, usada no Node e no navegador), `mapa.mjs` (PNG do mapa), `testar.mjs` e
`vitrine-ui.mjs` (reaproveitados), `saves/` (saves de exemplo por versão).

### 17.4 O que se reaproveita do jogo atual
`montar.mjs`, `testar.mjs` e a ideia do robô no Chromium; as proteções do `core/salvar.js`; o hash FNV e os
ajudantes de `estado.js` (`clamp`, `num`); a lógica do empréstimo e do Depósito, reescrita com os mesmos números e com
testes que comparam com as fórmulas de hoje. O resto da simulação (`estado.js`, `data/cidade.js`, `obras.js`,
`itens.js`) não entra.

---

## 18. Escopo

### 18.1 M1 "Heldópolis nasce" (jogável e bonito)
**Entra:** mapa autoral com relevo, mar, rio, lagoa, recursos e a Vila de Santa Cida; rodovia pronta com trânsito;
16 ladrilhos iniciais e compra por licença; vias (4 tipos, reta, curva, contínua, grade, melhorar, demolir, encaixe);
7 zonas com demanda, nascimento, níveis de 1 a 5 e abandono; cidadãos estatísticos com estudo, empregos e bem-estar
por prédio; 14 serviços e utilidades com cobertura pela via; água, esgoto e energia pela via, com racionamento e
ligação externa; trânsito agregado no worker com carros visíveis; valor do terreno, ar e ruído; 19 camadas e os
avisos; economia com as regras do dono, orçamento e série; Holding com 9 prédios de produção, lotes de 1 a 10,
estoque, mercado da cidade, Depósito, importação, entregas com caminhões; Arcologia `lago.e1` e `torre.e1..e4`;
marcos 0 a 7; Ato 1 com 6 a 8 decisões, Influência e Legado; objetivos da primeira hora; pausa, 1x, 2x e 4x; save
binário com 3 automáticos, 8 manuais, exportar e importar; robô, testes, determinismo e bancada.

**Não entra:** ônibus e outros modos, pontes, rotatórias, lixo, faculdade, distritos e políticas, orçamento por
serviço, poluição do solo e da água, indústria especializada, bens de consumo, rivais, câmara, clima, desastres,
terraplanagem.

**Parcelas da simulação (ordem):**

| # | Parcela | Tamanho | Depende de |
|---|---|---|---|
| S0 | núcleo: relógio, rng, tabelas, grade espacial, comandos, eventos, espelho, hash | P | nada |
| S1 | save: formato, gzip, IndexedDB, exportar, importar, migrações | M | S0 |
| S2 | mundo: mapa autoral, terreno, água, recursos, ladrilhos, Vila | M | S0 |
| S3 | vias: grafo, Bézier, cortes, ferramenta, encaixe, custo | G | S2 |
| S4 | zonas: blocos, células, validade, pincel | M | S3 |
| S5 | crescimento: catálogo, demanda, nascimento, níveis, abandono, obras | G | S4, S6, S7 |
| S6 | cidadãos: estudo, empregos, migração, bem-estar, renda | M | S4 |
| S7 | serviços e redes | M | S3 |
| S8 | ambiente: valor do terreno, ar, ruído | P | S5 |
| S9 | trânsito: zonas, gravidade, atribuição, worker, fluxos | M | S3, S6 |
| S10 | economia: orçamento, empréstimo, série | P | S6, S7 |
| S11 | Holding: produção, mercado, Depósito, importação, entregas | M | S3, S10 |
| S12 | Arcologia: gleba, etapas do Ato 1 | P | S11 |
| S13 | progresso e história: XP, marcos, licenças, decisões, objetivos, Mural | M | S5, S12 |
| S14 | avisos, camadas e consultas dos painéis | M | S5 a S13 |
| S15 | robô, determinismo, bancada, calibração | M | cresce junto desde S3 |

**Aceite do M1 (lado da simulação):**
- `simular.mjs --testes` → `testes ok`.
- `--robo` chega ao marco 7 com `torre.e4` pronta entre 5 e 7 h de jogo, com 25 a 40 mil moradores, bem-estar médio
  de 62 a 75, dívida sempre até 500 mil, no máximo 50 mil tomados por ano, e `erros []`.
- `--determinismo`: hashes iguais em 3 pontos e depois de salvar e carregar.
- `--bancada`: tique até 1 ms no p95 com 30 mil moradores e até 3 ms com 100 mil (Node); memória até 40 MB.
- Robô do navegador: 20 min em 4x sem erros e com o hash de um trecho igual ao do Node.

### 18.2 Roteiro M2 a M6

| Marco | Nome | Simulação e sistemas | Arcologia | Pronto quando |
|---|---|---|---|---|
| M2 | Cidade viva | ônibus (linhas, paradas, divisão modal); atribuição com mais passadas e mercado de trabalho pelo tempo de viagem; rotatória, ponte simples, calçadão, conexões de faixa; lixo (coleta, aterro, reciclagem); faculdade e universidade; distritos com políticas; orçamento por serviço (50% a 150%); poluição do solo e da água; residencial misto; prédios de assinatura com requisito; árvore de desenvolvimento; marcos 8 a 11 | Ato 2: Sede e Torres do Conselho, Anel de moradia, Escola, Universidade | o robô chega ao marco 11 com duas linhas de ônibus lotadas e o trânsito resolvido por linha ou via |
| M3 | Holding e mercado | divisões com diretores e caixa; Influência e Legado completos; 3 rivais e aliados; eventos com memória; bens de consumo e siderúrgica; armazéns com estoque próprio; porto de carga e aeroporto (exportação, turismo); hotéis e luxo; contratos; aluguel e impostos fora da moradia (se o dono aprovar) | Ato 3: Biblioteca, Vida (Cúpula e Supertrees), eixo | o robô vence um rival e completa 10 eventos |
| M4 | Escala e vida | mapa inteiro (256 ladrilhos, 50 mil prédios); simulação no worker se o tique pedir; metrô e VLT; rodovias do jogador, viadutos, túneis, trevos; terraplanagem; cidadãos com idade e ciclo de vida; saúde avançada, cemitério, crime; clima tropical (chuva e seca) e estações; desastres leves que se desligam; linhas de alta tensão no PC; marcos 12 a 15 | Ato 4: tambores, contorno, Centro de Física | 50 mil prédios a 60 quadros no PC e 30 no Poco X7, tique até 4 ms no aparelho |
| M5 | Apps e política | `.exe` (Electron) e APK (TWA), saves em arquivo, nuvem opcional; prefeito e câmara eleitos, leis da cidade com votação e custo em Influência, eleição a cada 4 anos | a Arcologia completa como sede do grupo | instalados e testados nos aparelhos do dono; uma eleição disputada |
| M6 | O mundo | mapa-múndi, segunda metrópole (Nova Libertas) e depois as 12, rotas de avião e navio, câmbio, tarifas, crises; cidades fora da tela simuladas em resumo; finais (império, fundação, os dois) | a Arcologia como modelo exportado para outras metrópoles | uma filial lucrativa fora do Brasil (e, no fim, as 12 no mesmo save) |

---

## 19. Decisões principais

1. **Premissa de concessão urbana:** a Holding planeja e mantém a cidade (CS2) e faz negócios (Highrise City). Um
   caixa só no M1.
2. **Tempo à CS2 (pausa, 1x, 2x, 4x) com a hora de jogo = 1 h real em 1x**, ano de 2 h e mês de 10 min, para as
   regras do dono manterem número e sentido. Nada anda fechado.
3. **1 unidade = 1 m;** mapa de 8.192 m em 16 x 16 ladrilhos de 512 m; início em 4 x 4; posições em Float64 na
   simulação.
4. **Vias em grafo de Bézier cúbicas** com ferramenta pura (mesma função na pré-visualização, no robô e no teste).
5. **Zonas em células de 8 m e 6 de fundo**, com demanda por fatores, nascimento pela demanda, níveis automáticos que
   compram materiais e abandono por problema longo.
6. **Cidadãos estatísticos por prédio;** agentes só onde contam (caminhões da Holding, ônibus no M2); o resto é
   amostra do render.
7. **Bem-estar por prédio e tarifa por prédio** (5, 8, 11 por morador por hora), média ponderada na barra.
8. **Serviços pela rede viária** com capacidade; **redes dentro das vias**, com racionamento pelos mais distantes e
   ligação externa no começo.
9. **Trânsito agregado** (gravidade e atribuição incremental com BPR) no worker a cada 3 dias de jogo, aplicado em
   tique fixo; carros por fluxo; ônibus no M2.
10. **Holding como fornecedora da cidade:** as obras da cidade compram materiais da Holding; Depósito a 150% até 100
    por janela de 4 h de jogo; importação a 160% (sem arbitragem).
11. **Arcologia como megaprojeto por etapas** com materiais entregues; Torre Lâmina em 4 etapas fecha o M1.
12. **16 marcos por XP** com licenças de ladrilho e desbloqueios, sem aumentar o limite do empréstimo; 5 atos com
    decisões por cima.
13. **Simulação determinística na thread principal no M1**, SoA, grade espacial, comandos com livro, consultas puras,
    espelho e diário para o render; save binário gzip no IndexedDB, versionado.
14. **Vila de Santa Cida já de pé** no começo: a primeira tela tem vida e o primeiro problema.

---

## 20. Dúvidas para o integrador (e as que sobem ao dono)

**Com o dono (não travam o começo; o desenho tem um padrão para cada uma):**
1. Relógio: pausa e velocidades como o CS2, sem nada andar com o jogo fechado (padrão), ou manter algum rendimento
   fechado como hoje (50% por até 12 h)?
2. "Por hora" das regras = hora de jogo, 1 h real em 1x (padrão), para renda, janela do Depósito e ano do empréstimo
   continuarem como ele conhece?
3. Tarifa 5, 8 ou 11 pelo bem-estar **de cada prédio** (padrão) ou pela média da cidade (como hoje)?
4. Imposto sobre comércio, escritórios e indústria: fica de fora (padrão) até ele pedir?
5. Compra de tempo com créditos: mantém só nas linhas da Holding e nas etapas da Arcologia (padrão), ou sai de vez
   junto com o estilo BuildIt?
6. Nome: o jogo continua "Arcologia de Held", com a cidade chamada Heldópolis?

**Com a parte de render:**
7. Escala da Arcologia em metros: 10 m por unidade antiga no plano do Trevo (gleba de uns 800 x 620 m) e alturas
   reais da Torre Lâmina (proposta: 300 a 360 m). A simulação só precisa do polígono da gleba, dos portões e das
   plantas das etapas.
8. Ladrilhos de 512 m como unidade de carga do terreno e das malhas; grade de altura de 8 m; moldura visual de 30 km.
9. O contrato do espelho (seção 17.1): posições em Float64, conversão para Float32 relativa ao ladrilho no render;
   `mudancas.desde()` uma vez por quadro; `flags` dos prédios para o desenho de obra e abandono.
10. Camadas: o render pinta prédios e arestas por índice (atributo por vértice com o índice e textura de dados, como
    propôs a pesquisa de sistemas) a partir de `q.camada()`.
11. Carros por fluxo com escolha no nó proporcional ao fluxo que sai; caminhões da Holding pelo `caminho` e pelo
    tique; tetos de carros e pedestres por perfil do VISAO.md.
12. Ciclo de dia e noite = 1 mês (10 min em 1x); em 4x, o sol anda no máximo como em 2x (só visual)?
13. Gerador de prédios pela chave (modelo, nível, estilo, semente, w, d): a lista de modelos da seção 6.8 é o mínimo
    do M1; o render diz quantas variantes cabem no orçamento.

**Com a parte de UI:**
14. A simulação fica na thread principal com consultas síncronas: a UI não deve planejar chamadas assíncronas para
    ela no M1.
15. Ferramentas de via e zona: a simulação devolve encaixes, guias, custo e erros; a UI decide os gestos e passa a
    tolerância em metros pelo zoom.
16. Códigos de resposta dos comandos: a UI traduz (lista fechada na parcela S0).
17. Barra: dinheiro com "/h" = por hora de jogo; data "Mês · Ano"; controle de velocidade com pausa.
18. Objetivos da primeira hora vêm da simulação (`q.objetivos()`), com alvo no mundo ou na UI.

**Com as ferramentas:**
19. `montar.mjs` passa a gerar o worker (arquivo com carimbo no `app/` e `Blob` no HTML único) e o `sw.js` guarda o
    arquivo novo.
20. O banco do save muda de nome (`heldopolis`); o do jogo antigo fica intocado.
