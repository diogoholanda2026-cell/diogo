# Sistemas de jogo: o Cities: Skylines II como referência máxima

Frente **Sistemas de jogo** da pesquisa CS2. Data: 27/09/2026. Só pesquisa e plano: nada foi implementado.

Como a pesquisa foi feita: busca na web (WebSearch) com dezenas de consultas. O proxy deste contêiner bloqueia a
abertura direta dos sites (WebFetch deu `EGRESS_BLOCKED` na Paradox, na wiki oficial, na Colossal Order, na Wikipedia,
no PC Gamer e no Game Developer), então os fatos vêm dos resumos que a busca devolve de cada página. Cada fato leva a
referência [Cn], [Hn] ou [On] da lista de fontes no fim. Números marcados com "(guia)" vêm de guias de jogadores, não
do jogo: conferir antes de copiar valor.

> **[Crítico]** Revisado no mesmo dia pelo crítico cético da frente. A busca na web já tinha estourado a cota da sessão
> e o proxy bloqueia os mesmos sites (e também Steam, Game Rant, TheGamer, TechRaptor, Dexerto e o blog [C64]). Só o
> GitHub abre. Por isso conferi quatro mecânicas do CS2 na **busca de código do GitHub, em código decompilado do jogo**
> publicado num repositório de mod [C66] a [C69], e marquei com "(não conferido)" os números que continuam só com a
> fonte de guia. O código do nosso jogo foi conferido linha a linha (seção 5). As correções no corpo vêm marcadas com
> **[Crítico]**; o resumo delas e as decisões revistas estão na seção 12, no fim.

## 0. Resultado primeiro

- O CS2 tem uns 20 sistemas. O jogo tem hoje a versão BuildIt de 8 deles (serviços com raio, água, energia e esgoto
  como capacidade, bairros comprados, níveis pagos com material, renda, empréstimo, capítulos, cidade em grade fixa).
  Faltam os três que fazem o CS2 parecer CS2: **vias livres, zonas com demanda e trânsito com rotas**.
- **Esta rodada (visual, interface e arquitetura) não muda regra nem save.** Da parte de sistemas entra só o que mostra
  na tela, no jeito do CS2, os dados que já existem: camadas de informação, ícones de problema sobre os prédios, painel
  da cidade e saldo por hora. São 5 parcelas pequenas (S1 a S5) e uma opcional (S6), mais a atualização dos documentos (S7).
- **Roteiro proposto:** fase 2 "Cidade que cresce" (zonas, demanda, valor do terreno, serviços com capacidade, marcos),
  fase 3 "Vias e trânsito", fase 4 "Holding e mercado" (rivais, cadeias do Highrise City, carga, turismo), fase 5
  "Escala e vida" (motor, cidadãos, clima, desastres). As fases de apps, mapa-múndi e 12 metrópoles seguem depois.
- **Como caber no Poco X7:** simular por agregado e mostrar uma amostra, e não agente por agente como o CS2. Isso
  vale para o trânsito (fluxo por via, calculado num worker), para os cidadãos (grupos por bairro, idade e
  escolaridade) e para a poluição (grade grossa). O próprio CS2 penou com desempenho, e o SimCity 2013 mostrou o que
  dá errado com agentes simples demais.
- **As regras fixadas pelo dono não mudam.** Nada de imposto sobre moradia (a renda de 5, 8 ou 11 por morador
  continua) nem de limite de empréstimo que cresce por marco (o CS2 faz isso, aqui não).
- **[Crítico] Faltava o relógio.** O CS2 tem pausa e velocidades [C67]; aqui tudo corre no relógio real, com
  cronômetros no jeito BuildIt, e o "Ritmo 1x/2x/4x" é um modo de teste escondido nas Configurações. É a diferença de
  sistema mais sentida entre os dois jogos e o plano não falava dela. Vira pergunta ao dono (seção 12.3), porque mexe
  no sentido de "por hora" e "por ano" das regras dele.
- **[Crítico] "Abandone o estilo BuildIt" também pesa no laço de jogo.** O plano deixava usinas, oficinas, balões e
  pedidos com a mesma cara até a fase 4. Entra nesta rodada a parcela S8 (painel de produção no jeito do CS2 e do HC e
  vocabulário novo, sem mudar regra nem save), e os ícones de S3 tiram os balões dos prédios da cidade.
- **[Crítico] Três das camadas propostas não informavam nada** (serviços e bem-estar são um número só para a cidade, e
  o valor do terreno é igual em todo o bairro), e a dessaturação no pós-processamento pintaria de cinza a própria
  camada. S1, S2 e S3 foram reescritas (seção 10.1).

## 1. Como li o pedido

- **CS2 é a referência máxima** para todos os componentes de um jogo de cidade: vias, trânsito, zonas, serviços,
  redes, transporte, economia, política local, informação na tela, progressão, cidadãos, ambiente e clima.
- **Highrise City (HC)** é a referência de produção: cadeias longas, material entregue na obra e verticalização.
- **"Abandone o estilo SimCity BuildIt"** vale para a estética e para o jeito BuildIt de crescer a cidade (tudo pago
  com item e cronômetro). Não vale para as quatro regras de economia que o dono fixou. Elas ficam como estão:
  1. lotes de produção de 1 a 10;
  2. vendas no Depósito a 150% do preço base, até 100 por janela;
  3. empréstimo de até 50 mil por ano, a 10% ao ano, com dívida de até 500 mil;
  4. renda de 5, 8 ou 11 créditos por morador por hora, conforme o bem-estar.
- **O jogador é a Holding, não o prefeito.** No CS2 o jogador é o governo da cidade. Aqui ele é dono de uma holding
  que também constrói e governa a cidade (até a política chegar). Por isso alguns sistemas do CS2 entram adaptados:
  o orçamento vira o caixa da Holding, os impostos só entram onde não batem com a renda por morador e as leis vêm
  da câmara (fase 4).
- **Saves antigos continuam valendo.** Os ids de projetos, etapas, módulos, lotes (`bairro:i:j`) e bairros ficam.
  Sistema novo entra com padrão em `normalizar` e, se a forma do save mudar, com migração para a versão 4.

## 2. Os sistemas do Cities: Skylines II (pesquisa)

### 2.1 Vias
- **Ferramentas:** reta, curva, contínua, grade e substituir, com guias e encaixe. As vias pequenas, médias e grandes
  e as rodovias têm várias configurações de faixas e mão única. As rodovias não levam canos nem cabos baixos; as
  outras vias levam [C1][C2][C3].
- **Rotatórias:** entram por cima de um cruzamento, em vários tamanhos, e copiam as faixas das vias que chegam. Há
  cruzamentos e trevos prontos, que se ligam sozinhos à rede [C1][C4].
- **Elevação:** valor negativo faz via em corte e depois túnel. Viaduto e ponte saem com a mesma ferramenta [C1].
- **Cais:** os cais fazem o muro de arrimo sozinhos e aceitam as melhorias da via [C6].
- **Melhorias de via:** árvores e barreiras de som reduzem o ruído (a barreira só na rodovia). Calçada larga e grama
  dão espaço ao pedestre e tiram vagas na rua [C3][C7].
- **Hierarquia de vias** é a espinha dorsal do jogo, segundo a própria Colossal Order [C5].
- **Manutenção:** o depósito manda caminhões (10, ou 15 com melhoria) que consertam as vias, limpam acidentes e tiram
  neve. Via ruim deixa o trânsito lento e aumenta os acidentes [C11].
- **Bicicletas (patch 1.4.2f1, 19/11/2025):** ciclovias, faixas de bicicleta, bicicletários e patinetes. A escolha usa
  os mesmos fatores de rota, e há leis para incentivar [C12][C13].

### 2.2 Trânsito
- **Custo de rota em quatro partes:** tempo, conforto, dinheiro e comportamento. O adulto pesa o tempo, o jovem pesa o
  dinheiro (combustível e estacionamento) e o idoso pesa o conforto [C8][C9][C10].
- **Estacionamento** é um dos quatro aspectos da rota: o agente só vai de carro se achar vaga [C8][C9].
- **Troca de faixa e ultrapassagem:** os carros trocam de faixa e ultrapassam quando a outra faixa está mais vazia.
  Quando há acidente longo, recalculam a rota e fazem retorno [C8].
- **Na rotatória**, quem entra dá preferência, mas às vezes fura [C8].

### 2.3 Zonas, demanda e níveis
- **Quatro zonas:** residencial, comercial, industrial e escritório [C14][C15][C16].
  - Residencial: baixa, média, em fileira, alta, baixa renda e mista (moradia com comércio no térreo, que atende as
    duas demandas).
  - Comercial e escritório: baixa e alta.
  - Industrial, mais a indústria especializada sobre recursos naturais (ver 2.14).
- **Células:** a zona se pinta em células de 8 m ao longo da via, até 6 de fundo (48 m) [C17].
- **Demanda:** a residencial sobe quando surgem empregos no comércio, na indústria e nos escritórios. Estudantes puxam a
  média e a alta densidade [C16]. Os fatores aparecem num painel [C57]:
  - moradias vagas, empregos, desemprego e impostos;
  - felicidade, sem-teto, vagas de estudo, riqueza e tamanho das famílias.
- **Níveis de 1 a 5:** o prédio sobe sozinho com o dinheiro que sobra depois da manutenção. A cada nível sobem a
  manutenção e o aluguel, e o consumo por família cai [C18].
- **Densidade:** uma fileira de alta densidade atende a demanda de cinco de baixa [C16]. **[Crítico]** (guia, não
  conferido: é uma regra de bolso de jogador, não um número do jogo; não usar como parâmetro).

### 2.4 Prédios-assinatura
- Cada um tem requisitos próprios: marco atingido, felicidade mínima e um número de células zoneadas de certo tipo.
  Depois de liberado, sai de graça, mas só se constrói uma vez [C20][C21].
- Os primeiros saem cedo: por exemplo, 1.000 células de fileira europeia liberam a Vertigo Square [C21].

### 2.5 Serviços
- **Serviços liberados por marco** (**[Crítico]** o texto dizia "doze", mas a lista abaixo tem 13 itens; a contagem
  depende de como o menu agrupa, então fica sem número):
  - vias, eletricidade, água e esgoto;
  - saúde, cuidado funerário e lixo;
  - educação, bombeiros, polícia e administração;
  - transporte, parques e comunicação [C22][C23][C24].
- **Cobertura dupla:** uma cobertura passiva perto do prédio e uma cobertura por veículos ou visitas. Por isso o tempo
  de resposta pelas vias pesa na escolha do lugar [C24].
- **Melhorias em três tipos** [C25][C26]:
  - operacionais: mudam números sem mudar a aparência, como o filtro na usina a carvão;
  - extensões: alas do hospital e da escola, com mais leitos e vagas;
  - subprédios: clínica infantil e parquinho da escola, tanque de combustível da usina.
  Assim um prédio vira megaestrutura sem espalhar dez prédios pequenos.
- **Distrito atendido:** o jogador escolhe que distrito cada prédio de serviço atende [C45].
- **Lixo:** todo prédio gera lixo. Prédios de nível alto e gente mais estudada geram menos. O aterro enche, o
  incinerador vira energia e polui o ar, e a reciclagem vira matéria para a indústria [C27].
- **Educação:** cinco níveis de escolaridade, com escola fundamental, ensino médio, faculdade e universidades [C23][C54].
- **Polícia:** patrulhas baixam a chance de crime e as prisões levam ao presídio (ou para fora da cidade) [C28].
- **Bombeiros:** risco de incêndio por prédio e por árvore. Há unidade de resgate para desabamento, abrigos, alerta
  precoce e ônibus de evacuação [C28].
- **Comunicação:** correio (receber carta dá bem-estar) e telecom com torres e servidores de alcance e banda
  diferentes [C24][C54].

### 2.6 Redes de água, esgoto e energia
- **Energia:** a baixa tensão corre dentro das vias. A alta tensão vai por linhas até os transformadores. A bateria
  guarda o que sobra e segura o apagão [C29][C30].
- **Água:** vem da superfície (rios, lagos, mar) e do lençol subterrâneo, que esgota, se renova devagar e pode ser
  contaminado. O esgoto mal tratado polui a água [C29].
- **Na tela:** setas de vento e de corrente e as manchas do lençol ligam e desligam [C29].

### 2.7 Transporte público e carga
- **Modos:** ônibus e táxi no começo; depois bonde, metrô, trem, navio e avião [C31].
- **Linhas:** cada linha tem preço da passagem, número de veículos (o teto depende do comprimento) e horário (dia,
  noite ou os dois). O preço entra no custo de rota [C31][C32].
- **Carga:** as linhas de carga têm número de veículos e horário [C31].
- **Bridges & Ports (29/10/2025):** balsas, 20 pontes (inclusive levadiças), cais, píeres de lazer, portos em três
  tamanhos, pesca, fazenda de peixe e plataformas de petróleo [C63].

### 2.8 Economia
- **Impostos:** por zona, de −10% a 30%. Na moradia, por nível de escolaridade (guia). Imposto baixo faz o prédio subir
  de nível mais rápido [C34][C35].
- **Orçamento dos serviços:** de 50% a 150%, e muda a eficiência. Água e energia também têm tarifa, que muda o
  consumo (guia) [C35].
- **Empréstimo:** um só, ajustável, com juros maiores quanto maior o valor e pago por mês. O limite sobe a cada marco
  (de 100 mil a 26,1 milhões). A Prefeitura tira 1 ponto dos juros e o Banco Central, 2 [C36][C37].
  **[Crítico]** Conferido no código: ao atingir um marco, o jogo soma `m_LoanLimit` do marco à "capacidade de crédito"
  (`Creditworthiness`) da cidade, e o painel de empréstimo lê esse valor [C66]. Os números de 100 mil a 26,1 milhões e
  os pontos de juros da Prefeitura e do Banco Central seguem só com a fonte de guia (não conferidos).
- **Economy 2.0 (patch 1.1.5f1, 24/06/2024)** [C38][C39]:
  - aluguel = (valor do terreno + zona x nível) x área x multiplicador;
  - as famílias gastam o que sobra depois do aluguel;
  - o preço tem duas partes: a da indústria e a do comércio;
  - os subsídios do governo saíram;
  - o painel de impostos abre no marco 1 e o de produção no marco 2.

### 2.9 Políticas e distritos
- **Distrito:** desenhado à mão. Tem painel com população, riqueza média, escolaridade, felicidade com os prós e os
  contras e políticas próprias [C45].
- **Políticas de distrito** [C43]:
  - consciência energética (−5% de energia) e reciclagem;
  - lombadas e taxa de estacionamento na rua;
  - proibição de motor a combustão (só moradores e empresas do distrito);
  - rodovia sem limite de velocidade.
- **Políticas da cidade:** por exemplo, a gestão avançada de poluição, que baixa a poluição do solo e do ar e aumenta
  o lixo [C44].

### 2.10 Informação na tela
- **Camadas de informação (info views):** o botão "i" abre uma camada por tema. O mundo fica neutro e o dado aparece em
  cor. Alguns exemplos [C28][C47]:
  - ar em azul e vermelho, com setas de vento;
  - solo, ruído, água e esgoto (a água limpa em azul e a suja em marrom);
  - energia, saúde, lixo, zonas, risco de incêndio, condição das vias e sem-teto.
- **[Crítico] A camada pinta os próprios prédios, não só o chão.** No código do jogo, o sistema de cor dos objetos
  (`Game.Rendering/ObjectColorSystem`) lê os dados de camada de cada tipo de prédio (`InfoviewBuildingData`) e troca a
  cor do prédio; o sistema de marcadores (`Game.Notifications/MarkerCreateSystem`) põe os marcadores da camada aberta
  [C68]. Por isso uma placa colorida no chão do lote (a proposta original de S2) não basta: numa vista de cima com
  torres, o chão some atrás dos prédios.
- **Ícones de problema** sobre o prédio: sem água, sem energia, lixo, doença, aluguel alto. O problema longo fica
  vermelho e leva ao abandono [C65].
- **Chirper** (a rede social da cidade): segue a vida de um cidadão e mostra reclamações. Críticos dizem que
  informação importante ficou escondida nele [C55].
- **Painel de informações da cidade:** fica junto das barras de demanda, com abas de demanda, políticas e
  estatísticas [C44][C57].

### 2.11 Progressão
- **Vinte marcos,** de Tiny Village a Megalopolis [C48][C49][C51]:
  - Pontos de expansão (XP) passivos 16 vezes por dia do jogo, pela população e pela felicidade. **[Crítico]** ("16
    vezes" não conferido.)
  - Pontos ativos por construir serviço, assinatura ou via.
  - Cada marco dá dinheiro, pontos de desenvolvimento, licenças de expansão e limite de empréstimo maior, e abre
    serviços e políticas.
- **Árvore de desenvolvimento:** nós por serviço. Nas vias, por exemplo: rotatória, estacionamentos, rodovias, vias
  grandes e ponte grande. Todos os marcos juntos dão pontos para a árvore inteira (228 pontos, guia) [C50].
- **Mapa:** 441 quadros, 159 km² no total; começa com 9. Cada quadro custa 1 licença e dinheiro pela área útil [C48][C52].

### 2.12 Cidadãos
- **Ciclo de vida:** nascer ou mudar para a cidade, estudar, formar, casar, trabalhar, mudar de casa, envelhecer e
  morrer (de velhice, doença, acidente ou desabamento) [C53][C54].
- **Felicidade** = bem-estar + saúde. O bem-estar cai com falta de energia, água ou esgoto, com poluição, lixo e falta
  de lazer [C54].
- **Família:** o aluguel depende da escolaridade mais alta da casa, da cobertura de serviços e do tamanho da moradia
  [C54].
- **Sem-teto:** família pobre sem casa e sem dinheiro para ir embora vive nos parques. Os patches de 2024 corrigiram
  isso e puseram o sem-teto na camada de população [C56][C57].

### 2.13 Valor do terreno
- Espalha-se pelas vias até a vizinhança. Sobe com serviços atendidos (polícia, saúde, comunicação, educação, lixo,
  lazer) e com demanda alta. Cai com poluição. É o que mais pesa no aluguel [C18][C19].
- Parques e marcos não sobem o valor direto: atendem necessidades, e a gente satisfeita paga mais [C19].

### 2.14 Poluição, recursos e produção
- **Poluição:** ar (anda com o vento), solo, ruído e água, cada uma com camada própria [C28][C46][C47].
- **Recursos naturais:** lençol, terra fértil, floresta, minério e petróleo. A terra fértil e a floresta se renovam; o
  minério e o petróleo acabam. A indústria especializada (agro, floresta, mineração, petróleo) se pinta em cima [C42].
- **Empresas virtuais,** com nome e cores, produzem materiais, bens e bens imateriais. O painel de produção mostra o
  superávit ou o déficit de cada recurso, de onde vem e para onde vai [C33].
- **Comércio exterior:** o que falta é importado e o que sobra é exportado; exportar produto acabado rende mais [C40][C41].
- **Armazéns** equilibram o estoque entre si [C40].

### 2.15 Clima, estações, desastres e turismo
- **Clima:** cada mapa tem o seu, pela latitude, com temperatura, chuva, nuvens, neve no frio e duração do dia.
  Frio e calor sobem o consumo de energia; a neve pede limpa-neve [C58][C59].
- **Desastres (liga e desliga):** incêndio florestal no seco, granizo no frio sem congelar e tornado, o pior. Há
  alerta prévio [C58][C59].
- **Tempo do jogo:** um ciclo de dia e noite vale um mês; o ano tem 12 dias; em velocidade normal o dia dura cerca de
  uma hora (guia) [C60].
- **[Crítico] Relógio de simulação com pausa.** No código, o dia tem 262.144 tiques de simulação
  (`TimeSystem.kTicksPerDay`) e a velocidade é um valor escolhido pelo jogador (`selectedSpeed`), que o próprio jogo
  zera para pausar (o diálogo de erro faz isso) [C67]. Há mods que esticam o dia 3,5 vezes para dar rotina realista aos
  cidadãos (Time2Work) [C69]. Ou seja: no CS2 o tempo é da simulação, não do relógio da parede. Aqui é o contrário
  (seção 5).
- **Turismo:** a atratividade da cidade traz turistas. Hotéis nascem no comércio quando ela é alta, e as atrações
  puxam mais que o lazer comum [C61][C62].

### 2.16 Como o CS2 aguenta a escala, e o que isso ensina
- O CS2 roda em Unity com DOTS (ECS, Jobs e Burst) para usar vários núcleos na simulação de agentes [C64].
- Mesmo assim saiu pesado. A análise de desempenho aponta o desenho sem níveis de detalhe, e não a simulação [C64].
- Lição para nós: a simulação pode ser funda se for agregada; o gargalo é o desenho. Nível de detalhe, instâncias e
  amostra visível são obrigatórios, ainda mais no Poco X7.
- **[Crítico]** O blog [C64] estava bloqueado para mim também; a conclusão acima segue com a fonte do pesquisador. A
  lição vale de qualquer jeito, e tem número: 1.651 lotes com prédio a 540 triângulos em média já somam os 900 mil do
  Poco X7 Média, sem contar Arcologia, mata e terreno. **Sem o LOD dos prédios da cidade (parcela V5 da frente visual),
  a fase 2 (crescimento por zonas) estoura o orçamento só com a cidade.** V5 passa a ser pré-requisito da fase 2.

## 3. O que o Highrise City acrescenta

| O que o HC faz | Fonte | Como serve aqui |
|---|---|---|
| Escala de produção: mais de 300 tipos de prédio, até 30 mil por cidade, 60 recursos, 15 mil veículos, mapa de 196 km² | [H1][H2] | referência de amplitude das cadeias da Holding (fase 4) |
| Material de construção entregue: casa de nível 2 pede 2 madeiras e 2 tijolos; nível 3 pede 5 madeiras, 4 tijolos e 2 metais. Pranchas, lingotes, vidro e concreto armado vêm de cadeias próprias | [H5][H6] | é quase a regra de hoje dos níveis da Arcologia: fica, mas com entrega por caminhão e sem cara de BuildIt |
| Moradia e escritório em 5 níveis, com necessidades que crescem; o prédio só sobe se tiver escola, polícia, bombeiro, médico, hospital, lixo, parque e parquinho | [H7][H11] | igual às coberturas de hoje (nível 2 pede polícia e escola...): já estamos no caminho do HC |
| Transportadoras com caminhões buscam, guardam e entregam; armazéns | [H7][H11] | centro logístico da Holding vira armazém no mapa (fase 4) |
| Verticalização: mega-arranha-céus no fim do jogo, porto espacial que abre o Novo Jogo+ | [H3] | assinaturas da Holding inspiradas em megaprojetos reais (frente de arquitetura) |
| Missões de história e de pesquisa, ônibus, resíduo perigoso, subestações, shopping (1.0); metrô e aviões (DLC) | [H3][H8] | pesquisa vira a árvore de desenvolvimento (fase 2) |
| Crítica: logística funda demais, curva de aprendizado íngreme | [H4][H10] | no celular, logística automática e visível, não microgestão |

**[Crítico]** As quantidades de material por nível ([H5][H6]) vêm de análises do acesso antecipado (2021) e podem ter
mudado na 1.0 (2023); servem de ordem de grandeza, não de tabela. Os números de escala da primeira linha ([H1][H2])
não puderam ser conferidos (Steam bloqueada).

## 4. Outros jogos pesquisados, e o que pegar de cada

| Jogo | O que faz bem | O que pegar | Fase |
|---|---|---|---|
| Anno 1800 e Anno 117 (2025) | Classes de população com necessidades por bens e serviços, cadeias matéria → intermediário → bem final, entreposto que compra e vende sozinho [O1][O2]. O 117 mostra setas com o efeito na vizinhança ao posicionar, tem campanha com diálogos e agrupa construções por classe [O3] | necessidades por nível de moradia ligadas a bens das cadeias; mostrar o efeito na vizinhança ao posicionar (valor do terreno, ruído) | 2 (setas) e 4 (bens) |
| Tropico 6 | Facções com aprovação, eleições, constituição e decretos com custo político [O4][O5] | câmara com partidos, decretos como políticas com custo em Influência | 4 |
| Frostpunk 2 | Conselho vota leis (51 de 100; regras pedem dois terços), negociação com promessas, tensão que vira greve [O6][O7] | votação na câmara com promessas cobradas depois; greve como consequência | 4 |
| Capitalism Lab | Subsidiárias com diretor de IA, abertura de capital, bolsa, títulos; DLC em que o jogador é empresa e prefeito ao mesmo tempo, com PIB da cidade [O8][O9] | divisões da Holding como subsidiárias, valuation como preço de ação, rivais com IA | 4 |
| Workers & Resources | No modo realista a obra só começa com o material no canteiro, e o escritório de construção traz material e operários [O10] | a obra da Holding recebe material por caminhão (o canteiro animado já existe) | 4 |
| Transport Fever 2 | Indústria só produz com transporte até quem consome; sobe de nível quando escoa 80% da produção por um tempo [O11] | regra de nível das empresas da Holding por escoamento, não por item | 4 |
| Pocket City 2 e TheoTown | Cidades completas no celular: 3D leve, controles simples, prefeito que anda pela cidade (PC2), mais de 10 milhões de downloads (TheoTown) [O12][O13] | ferramentas de via e zona feitas para o dedo (arrastar e soltar); prova de que dá no celular | 2 e 3 |
| SimCity 2013 (lição) | Motor GlassBox: agentes iam ao emprego e à casa mais próximos pela rota mais curta, e isso gerou engarrafamentos absurdos [O14][O15] | rota pelo tempo e pelo congestionamento, nunca só pela distância; destinos por atração, não o mais perto | 3 |

**[Crítico]** Os detalhes numéricos desta tabela (dois terços no Frostpunk 2, 80% no Transport Fever 2, 10 milhões de
downloads do TheoTown) não foram conferidos por mim (sites bloqueados). Nenhum deles vira parâmetro nesta rodada; se
virar numa fase futura, conferir antes. O [O16] existe e é uma direção de carro em WebGPU puro, sem three.js e sem
trânsito de cidade: serve de prova de que o WebGPU desenha bem, não de modelo para o trânsito agregado.

## 5. O jogo hoje (lido no código)

- **Cidade** (`fonte/data/cidade.js`):
  - 20 bairros em grade (`BAIRROS`) com 1.651 lotes de 4 x 4 unidades e ruas de 1,2. Com o andar de 0,4 unidade, 1
    unidade vale uns 10 m: o lote tem uns 40 m e o mundo todo uns 9 km², cerca de 24 quadros do CS2.
  - Os bairros se compram por capítulo e pedem a Prefeitura (`comprarBairro`).
  - A rua nasce com o desmate (`desmatar`, que exige acesso pela borda ou por lote limpo).
- **Prédios da cidade** (`CIDADE`):
  - Colocados à mão: 4 moradias, 3 de comércio, 12 serviços, 4 de lazer e 5 empresas da Holding. **[Crítico]** São
    13 tipos na categoria serviço, contando aeroporto, porto e estação de VLT; os de atendimento são 10 com a
    Prefeitura.
  - Cada tipo é uma faixa de módulos. O nível 1 custa só créditos; os seguintes pedem materiais, serviços e
    cobertura (o jeito BuildIt).
- **Serviços** (`COBERTURAS`, `coberturaLote`):
  - Polícia, escola, saúde e faculdade atendem por raio. A Prefeitura vale para a cidade inteira.
  - Água, energia e saneamento são uma capacidade da cidade inteira contra a população (`servicos()`).
  - Não há capacidade por prédio, veículos, manutenção nem orçamento. Não há bombeiros, lixo, correio, telecom nem
    cemitério.
  - **[Crítico] Falta de serviço não tira renda.** Água, energia ou saneamento abaixo da população só travam o
    próximo nível (`servOk` em `requisitosModulo`, `estado.js` linha 820). A captura `915x412-cidade-cobertura.png`
    mostra "60/0" nas três barras sem perda nenhuma. O que tira dinheiro hoje é só o bem-estar baixo (faixa 5, 8 ou 11)
    e a falta de gente nas empresas (`emp.ocupacao` = moradores x 0,6 / empregos, que multiplica o lucro, linha 468).
- **Bem-estar** (`bemEstar()`): base 35, mais o lazer e os serviços prontos (os quatro primeiros de cada tipo contam
  inteiros, os outros pela metade), mais as escolhas do Conselho, menos 1 ponto a cada 200 moradores. É um número só
  para a cidade toda.
- **Economia** (`estado.js`):
  - Renda de 5, 8 ou 11 por morador por hora, pelo bem-estar, com cofre de 12 h.
  - Comércio soma até +45% de renda. As empresas da Holding têm lucro por hora e empregos.
  - Empréstimo fixo, valuation, Depósito de trocas e pedidos da comunidade.
  - A única despesa corrente são os juros (**[Crítico]** e a mora de 20% ao ano no saldo de contrato vencido, depois
    dos 10 anos de prazo; a parcela do principal é paga quando o jogador quer).
- **Valor do terreno** (`precoTerreno`): base do bairro x (1 + 2 x ocupação do bairro). Só pesa a ocupação.
  **[Crítico]** Consequência: todos os lotes de um bairro valem o mesmo. Uma camada de valor hoje mostra 20 blocos
  lisos, não o degradê do CS2.
- **Produção** (`itens.js`): 8 matérias-primas em usinas paralelas e 28 produtos em 7 oficinas com fila (BuildIt), com
  lotes de 1 a 10 e coleta automática. A Fábrica da Holding põe matéria-prima direto no Almoxarifado.
- **Trânsito e transporte:**
  - Carros andam em circuitos fixos no anel viário e nas saídas (`arredores.js`: 22 no anel, 2 por saída) e nas ruas
    dos bairros.
  - Pedestres, aviões, helicópteros, iates, cargueiro e cruzeiro são de enfeite.
  - A estação de VLT dá só bem-estar. Não há linhas, rotas nem congestionamento.
- **Progressão:** 6 capítulos com metas e Conselho, nível do jogador de 1 a 35 por XP, marcos a 1/3 e 2/3 do capítulo,
  bairros e tipos liberados por capítulo.
- **Tempo:** calendário de 1 dia = 20 s, mês de 30 dias e ano de 360 dias (2 h reais). O empréstimo de 50 mil por ano
  conta nesse ano. Tudo é calculado por horário, e o jogo progride fechado.
  **[Crítico]** Não existe pausa. O "Ritmo da obra" 1x, 2x ou 4x fica nas Configurações, com a legenda "modo de teste"
  (`ui/extras.js` linha 267), e só divide a duração das próximas produções e obras (`S.ritmo`, `estado.js` linhas
  477 a 481). Fechado, a renda rende 50% (`OFFLINE_FATOR`) por até 12 h.
- **Informação na tela:**
  - No modo colocar, os lotes se pintam pela cobertura do tipo escolhido (`jogo.js`, perto da linha 629).
  - Há painéis de bem-estar (fontes), serviços (capacidade x uso) e finanças (Escritório).
  - O painel do prédio diz o que falta e oferece "Construir" (captura `915x412-cidade-cobertura.png`).
  - **[Crítico]** As marcas de lote do modo colocar (`mostrarLotes`, `render/cidade.js` linha 668) são uma malha
    instanciada com teto `MAX_MARCAS = 1000` (linha 463, comentário ainda dos "dez bairros"). Não cabem os 1.651 lotes.
  - **[Crítico]** A imagem da cena sai num alvo `R11F_G11F_B10F` sem canal alfa, com MSAA e profundidade não resolvida
    (`engine.js` linhas 196 a 205 e 277), e o `COMPOSITE` aplica a saturação na tela inteira (linha 132). Não há onde
    guardar uma máscara "isto é camada, não dessature".
  - **[Crítico]** A fusão do mundo (`render/mundo.js`, `fundirLista`) já guarda a faixa de índices de cada fonte. É o
    gancho para marcar cada vértice com o lote dono, que é o que a camada precisa para pintar o prédio inteiro.

## 6. Tabela: sistema do CS2 x jogo

Custo: **P** = 1 parcela (um agente, um dia); **M** = 2 a 4 parcelas; **G** = uma fase inteira (5 ou mais parcelas,
com robô e testes novos). Valor para o dono (perfil: estratégico, negócios, alto padrão visual, escala gigante,
sessões no Poco X7 e partidas longas no PC): **A** alto, **M** médio, **B** baixo. Fase: a do roteiro novo (seção 8).

### 6.1 Vias e trânsito

| Sistema do CS2 | Hoje | O que falta | Custo | Valor | Fase |
|---|---|---|---|---|---|
| Ferramenta de vias (reta, curva, contínua, grade, substituir, encaixe) | rua nasce do desmate em grade fixa; anel viário fixo da Arcologia | desenhar via com o dedo, encaixe, custo por metro, lotes gerados ao longo dela | G | A: é o gesto que define o gênero | 3 |
| Hierarquia de vias e faixas (pequena, média, grande, avenida, rodovia, mão única) | um tipo de rua | 5 tipos com faixas, velocidade e capacidade; perfil visual por tipo | M | A | 3 |
| Rotatórias, cruzamentos e trevos prontos | cruzamentos da grade | rotatória sobre cruzamento; 2 ou 3 trevos prontos | M | M | 3 |
| Pontes, viadutos, túneis e cais | só as passarelas da Arcologia, de enfeite | elevação de via, ponte sobre água, cais na orla | G | M | 5 |
| Melhorias de via (árvores, grama, calçada larga, faixa de ônibus, barreira de som) | nenhuma | 4 melhorias com efeito em ruído e valor do terreno | P | M | 3 |
| Rua de pedestres e ciclovia (2025) | pedestres de amostra; passarelas na Arcologia | tipo de via só para pedestre e bicicleta; combina com a Arcologia verde | P | M | 3 |
| Trânsito com rotas (tempo, conforto, dinheiro, comportamento) | carros em circuitos fixos | viagens origem-destino por bairro, fluxo e velocidade por via, congestionamento visível | G | A | 3 |
| Estacionamento e taxa | nada | vagas como capacidade por bairro; garagem como negócio da Holding | M | B | 4 |
| Manutenção de vias, acidentes, limpa-neve | nada | condição agregada por via e depósito de manutenção; sem neve (Brasil) | P | B | 5 |

### 6.2 Zonas e crescimento

| Sistema do CS2 | Hoje | O que falta | Custo | Valor | Fase |
|---|---|---|---|---|---|
| Zonas por tipo e densidade (moradia baixa, média, fileira, alta, baixa renda, mista; comércio e escritório baixa e alta; indústria) | tipos colocados à mão, lote a lote | pincel de zona nos lotes livres; o prédio aparece sozinho; os colocados à mão continuam (como assinatura) | G | A | 2 |
| Demanda e seus fatores | não existe | demanda por zona a partir de empregos, moradias vagas, bem-estar, vagas de estudo e custo de vida; barras na tela | M | A | 2 |
| Níveis de 1 a 5 que sobem sozinhos pelo lucro e pelo valor do terreno | níveis pagos com créditos e materiais | zoneados sobem sozinhos; os da Holding e a Arcologia continuam pedindo material (como no HC) | M | A | 2 |
| Estilos regionais (Europa e América do Norte) | um estilo (creme e vidro) | primeiro estilo novo nesta rodada (frente de arquitetura); um estilo por metrópole depois | M | M | 1.3 e 7 |
| Prédios-assinatura (requisito, uma vez, atratividade) | a Arcologia e os prédios únicos por capítulo | assinaturas da Holding inspiradas em megaprojetos, com requisito (marco, bem-estar, células zoneadas) e efeito (valor do terreno, turismo) | M | A | 2 (regra); 1.3 (visual) |

### 6.3 Serviços e redes

| Sistema do CS2 | Hoje | O que falta | Custo | Valor | Fase |
|---|---|---|---|---|---|
| Serviço com raio e capacidade, vários prédios por tipo, distrito atendido | raio fixo e um prédio por tipo; sem capacidade | capacidade por prédio (vagas, leitos), mais de um por tipo, eficiência pela verba | M | A | 2 |
| Extensões (operacionais, alas, subprédios) | etapas dos projetos da Arcologia (parecido) | alas e subprédios nos serviços da cidade; a Arcologia apresentada como megaestrutura com extensões | M | M | 2 |
| Bombeiros e risco de incêndio | nada | quartel com raio; risco por prédio e por mata; incêndio como evento | M | M | 2 |
| Lixo (aterro, incinerador, reciclagem) | nada | lixo por prédio; aterro com capacidade; incinerador dá energia; reciclagem vira matéria-prima da Holding | M | M | 2 |
| Educação em 5 níveis | escola e faculdade com raio; Escola e Universidade na Arcologia | vagas por nível; escolaridade da população por bairro; efeito em empregos e na demanda de escritório | M | A: mão de obra para a Holding | 2 |
| Comunicação (correio, telecom) | nada | telecom com cobertura como negócio da divisão de Tecnologia; correio simples | P | M | 2 |
| Parques e lazer com atratividade | praça, parque, cultura e arena dão bem-estar | raio de lazer e atratividade para o turismo | P | M | 2 |
| Saúde, cemitério, crime e presídio | posto e hospital com raio; delegacia com raio | capacidade de leitos, cemitério, índice de crime por bairro | M | B | 5 |
| Água e esgoto (superfície, lençol, contaminação) | capacidade da cidade toda | ligação pela via (sem desenhar cano); poluição da água pelo esgoto; lençol só no PC | M | M | 5 |
| Energia (baixa na via, alta em linhas, transformador, bateria) | usina solar e hidrelétrica somam capacidade | linhas de alta tensão desenhadas no PC; baixa tensão pela via | M | M | 5 |

### 6.4 Transporte

| Sistema do CS2 | Hoje | O que falta | Custo | Valor | Fase |
|---|---|---|---|---|---|
| Linhas de ônibus, VLT, metrô e trem (paradas, preço, veículos, horário) | estação de VLT de enfeite | ferramenta de linhas com paradas; passageiros saem do cálculo de trânsito | G | A | 3 |
| Táxi, balsa, avião de passageiros, conexões com fora | aeroporto e porto com renda de 4% e veículos de enfeite | aeroporto e porto como portas de turista e de carga; balsa na orla | M | A: aviação e navegação são divisões da Holding | 4 |
| Carga (caminhão, trem, navio, avião) | cargueiro de enfeite | caminhões ligados às cadeias; porto e aeroporto exportam | M | A | 4 |

### 6.5 Economia, governo e progressão

| Sistema do CS2 | Hoje | O que falta | Custo | Valor | Fase |
|---|---|---|---|---|---|
| Orçamento: receitas, despesas e manutenção | renda, comércio, lucro e juros espalhados no Escritório | painel com receitas e despesas por hora (só leitura) nesta rodada; manutenção dos serviços só com aprovação do dono | P, depois M | A | 1.3 (painel); 2 (manutenção) |
| Impostos por zona e por escolaridade | a renda por morador faz esse papel (regra do dono) | nada na moradia; imposto só em comércio, escritório e indústria, se o dono aprovar | M | M | 4 |
| Empréstimo com limite que sobe por marco | regra fixa do dono (50 mil por ano, 10%, até 500 mil); Banco da Holding baixa juros | nada: não muda | - | - | não entra |
| Tarifa de água e energia | nada | a Holding como concessionária cobra tarifa; muda o consumo | P | M | 4 |
| Aluguel pelo valor do terreno (Economy 2.0) | renda por morador | aluguel dos imóveis da Holding como receita do Imobiliário, por cima da renda por morador (decisão do dono) | M | A | 4 |
| Políticas da cidade e de distrito | escolhas do Conselho por capítulo (permanentes) | políticas ligáveis por bairro, com custo e efeito; leis da cidade pela câmara | P, depois M | M | 2 (bairro); 4 (câmara) |
| Distritos | 20 bairros comprados | bairro vira distrito: painel, políticas e serviço atendido | P | M | 2 |
| Marcos (XP passivo e ativo, recompensas) | 6 capítulos, nível de 1 a 35, marcos dentro do capítulo | marcos da cidade por população e bem-estar, separados dos capítulos da Arcologia | M | A | 2 |
| Pontos e árvore de desenvolvimento | liberação por nível e capítulo | árvore por área (vias, energia, transporte, serviços, Holding) | M | A | 2 |
| Compra de áreas do mapa (441 quadros) | 20 bairros por preço e capítulo | mapa em blocos e áreas novas além dos bairros | G | A: escala | 5 |

### 6.6 Informação na tela

| Sistema do CS2 | Hoje | O que falta | Custo | Valor | Fase |
|---|---|---|---|---|---|
| Camadas de informação (mundo neutro, dado em cor) | cor dos lotes só no modo colocar; painéis de bem-estar e serviços | ~~8 camadas: cobertura, serviços, bem-estar, valor, Holding, nível, densidade, mata~~ **[Crítico]** 8 camadas que variam de lote para lote: cobertura (4 serviços e total), o que trava o próximo nível, estado do lote (mata, limpo, ocupado, Holding), nível, moradores, valor (por bairro, dito na legenda); serviços e bem-estar saem das camadas e vão para o painel Cidade, porque são um número só | M | A: é a cara do CS2 | 1.3 |
| Ícones de problema sobre os prédios | o "falta X" só aparece no painel do prédio | ícones flutuantes em lote (uma chamada de desenho); toque abre o painel com a causa e a ação. **[Crítico]** Hoje quase nada é "problema" no sentido do CS2 (seção 5): os ícones mostram o que trava o nível (âmbar) e empresa sem gente (vermelho, é a única perda real); falta de água ou energia vira um alerta só na barra | P | A | 1.3 |
| **[Crítico] Relógio da simulação (pausa, 1x, 2x, 3x na barra)** | relógio real; "Ritmo" 1x/2x/4x escondido como modo de teste | decidir com o dono (seção 12.3); nesta rodada nada muda | M a G | A: é como se joga um jogo de cidade no PC | pergunta |
| Painel de informações da cidade | Escritório com abas Finanças e Obra | painel Cidade com abas População, Economia, Serviços, Bem-estar e Bairros | P | A | 1.3 |
| Barras de demanda | não há demanda | entram com a demanda | P | A | 2 |
| Chirper | falas dos conselheiros e pedidos | "Rede da cidade": posts curtos a partir dos eventos que já existem | P | M | 1.3 (opcional) ou 2 |

### 6.7 Cidadãos, ambiente e produção

| Sistema do CS2 | Hoje | O que falta | Custo | Valor | Fase |
|---|---|---|---|---|---|
| Ciclo de vida, famílias, riqueza, sem-teto | população agregada pelo nível dos módulos | grupos por bairro (idade x escolaridade x riqueza) com taxas de evento; 50 moradores nomeados para seguir | G | M | 5 |
| Empregos e desemprego por escolaridade | empregos das empresas (o lucro cai se faltar gente) | vagas x trabalhadores por escolaridade; o desemprego entra na demanda | M | A | 2 |
| Felicidade = bem-estar + saúde | um bem-estar geral (define a tarifa 5, 8 ou 11) | o bem-estar geral continua mandando na tarifa; os fatores novos (lixo, poluição) entram nele | P | M | 2 e 3 |
| Valor do terreno (serviços, lazer, poluição, demanda) | base x ocupação | valor por lote com serviços, lazer, distância da Arcologia, poluição e demanda | M | A: é o Imobiliário da Holding | 2 |
| Poluição do ar (vento), do solo e ruído | nada | três campos numa grade grossa; efeito no valor e no bem-estar | M | M | 3 |
| Clima e estações | dia e noite | estações tropicais (chuva e seca) pelo calendário; efeito leve no consumo | M | M: visual | 5 |
| Desastres, alerta e abrigo | nada | 2 ou 3 eventos raros (tempestade, incêndio na mata), com opção de desligar | M | B | 5 |
| Turismo (atratividade, hotéis, atrações) | nada | atratividade da Arcologia e das assinaturas; hotéis como Hotelaria e luxo da Holding | M | A: luxo | 4 |
| Empresas, recursos, superávit e déficit | usinas e oficinas BuildIt; empresas com lucro fixo | cadeias com estoque e preço de mercado; painel de produção. **[Crítico]** O painel de produção (superávit e déficit por item com os dados de hoje) sobe para esta rodada como S8; só as cadeias novas ficam na fase 4 | G (S8: P) | A | 4 (S8: 1.3) |
| Indústria sobre recursos naturais | só a madeira do desmate | recursos por região (e por metrópole depois) | M | M | 4 e 7 |
| Importação e exportação | Depósito de trocas (compra com preço subindo, venda a 150%, 100 por janela) | porto e aeroporto exportam o excedente; o Depósito continua com as mesmas regras | M | A | 4 |
| Armazéns | Almoxarifado; Centro logístico (+vagas) | armazém no mapa com caminhões (HC) | M | M | 4 |

## 7. Como fazer no navegador sem estourar o Poco X7

Regra geral: **a regra fica em `fonte/sim/estado.js`** (roda igual no navegador, no robô e no `simular.mjs`). O
desenho mostra uma **amostra** do que a regra calcula. O que for pesado vai para um **Web Worker** que importa o mesmo
módulo.

- **Camadas (esta rodada):**
  - Uma malha instanciada de placas, uma por lote (reaproveita a marca do modo colocar), com a cor pela rampa da
    camada: 1.651 instâncias, uns 3,3 mil triângulos e 1 chamada.
  - ~~O resto do mundo fica dessaturado por um valor no pós-processamento que já existe (COMPOSITE).~~
    **[Crítico] Não funciona:** a saturação do `COMPOSITE` vale para a tela inteira e pintaria de cinza a própria
    camada; o alvo da cena não tem alfa para servir de máscara (seção 5), e trocar para RGBA em meia precisão dobra a
    banda de memória no Mali. **Troca:** um uniforme `uCamada` (0 ou 1) injetado nos materiais compartilhados por
    `onBeforeCompile` (o `materials.js` já tem os ganchos e a cópia deles em `ganchos()`), que leva a cor de base para
    um cinza claro antes da luz. As placas da camada usam material próprio, fora do gancho. Uniforme não recompila o
    programa; só a primeira vez compila.
  - **[Crítico] Pintar o prédio, não só o chão** (é o que o CS2 faz [C68]): na fusão, cada vértice ganha um atributo
    `aLote` (Uint16; 65535 = sem lote, para Arcologia, mata e terreno). No vértice, um `texelFetch` numa textura de
    dados de 64 x 32 (2.048 casas, uma por lote, RGBA8) dá a cor do lote; com `uCamada` ligado, a cor de base vira essa
    cor. Custo: 2 bytes por vértice e 1 leitura de textura por vértice, **0 chamadas a mais**. Os módulos da Arcologia
    podem receber ids acima de 1.651 na mesma textura, para as camadas de nível e moradores valerem para ela também.
  - As placas no chão continuam, para lote vazio e mata, mas numa malha própria de 2.048 instâncias (o `MAX_MARCAS`
    de hoje é 1.000), sem sombra (`castShadow = false`, senão custa mais uma chamada no passe de sombra), fora do HAO
    (`semHAO`) e com `polygonOffset` para não piscar no chão.
  - Recalcula só quando a camada abre ou chega um evento de mudança, nunca por quadro.
- **Ícones de problema (esta rodada):** atlas com os ícones em canvas que já existem (`ui/icones.js`) numa malha
  instanciada de placas viradas para a câmera: 1 chamada, no máximo 200 visíveis (os mais perto).
  **[Crítico]** A placa virada para a câmera é feita no shader do vértice da `InstancedMesh`; não usar `THREE.Sprite`,
  que custa uma chamada por ícone. Teto por qualidade: 200 no PC, 60 na Média e 30 na Leve (em 915 x 412, 200 ícones
  de 44 px cobrem a tela). Com a câmera longe, um ícone por bairro com o número de avisos, como o agrupamento de
  marcadores de mapa.
- **Zonas e crescimento (fase 2):**
  - Uma passada por lote a cada passo da simulação: hoje o fechado anda em passos de 5 min, até 288 passos.
  - A demanda sai de somas por bairro. Os lotes zoneados livres com maior valor recebem prédio.
  - A obra animada que já existe (andaime, grua, operários) mostra o crescimento.
  - Os prédios vêm de uma biblioteca procedural por zona, densidade, nível e estilo, fundidos por bairro como hoje.
    **[Crítico]** Essa biblioteca é trabalho de arte do tamanho de uma fase (G), não um detalhe: 4 zonas x 2 ou 3
    densidades x 5 níveis x variantes. Ela depende da frente de arquitetura (linguagem dos megaprojetos) e do LOD da
    frente visual (V5); sem LOD, 1.651 prédios estouram o Poco X7 (seção 2.16).
- **Trânsito (fase 3):**
  - Grafo de vias com nós e arestas (comprimento, faixas, velocidade, capacidade).
  - Matriz de viagens entre zonas de tráfego (bairros e polos: uns 20 a 60) por período do dia.
  - Atribuição em poucas iterações com a curva clássica de atraso t = t0 x (1 + 0,15 x (fluxo/capacidade)^4), num
    Web Worker a cada 10 s de jogo. Resultado: fluxo e velocidade por aresta.
  - Os carros visíveis são uma amostra proporcional ao fluxo, instanciados, andando na velocidade calculada. O
    congestionamento aparece sem simular cada carro.
  - Dijkstra de 60 origens num grafo de 5 mil arestas leva milissegundos. **[Crítico]** Estimativa mais honesta:
    uns 0,2 a 0,5 ms por origem no celular, então 12 a 30 ms por iteração e 60 a 150 ms por atribuição de 5
    iterações. Cabe no worker a cada 10 s reais (meio dia do calendário; "10 s de jogo" era ambíguo), mas medir no
    Poco X7 antes de fixar.
  - **[Crítico]** O jogo sai em duas formas: `app/` (PWA com um `jogo.<carimbo>.js` e o `sw.js`) e um HTML só
    (`arcologia-de-held.html`). No HTML único o worker precisa ir embutido como texto e subir por `Blob` e
    `URL.createObjectURL`; no `app/` ele vira mais um arquivo com carimbo, que o `sw.js` tem de guardar no cache. As duas
    coisas pedem uma saída a mais no `montar.mjs`. E o `simular.mjs` e o robô rodam a
    mesma função de atribuição de forma síncrona no Node: o worker é só o envelope do navegador.
  - A rota é por tempo e congestionamento, nunca só por distância: é a lição do SimCity 2013 [O14].
- **Linhas de transporte (fase 3):** a linha vira aresta com tempo próprio no mesmo grafo. Os passageiros saem da
  atribuição (modo por custo: tempo, dinheiro e conforto, como no CS2 [C8]).
- **Cidadãos (fase 5):**
  - Grupos por bairro, com 5 faixas de idade x 5 de escolaridade x 3 de riqueza, e taxas de nascimento, estudo,
    emprego, mudança e morte.
  - Uns 50 moradores nomeados só para a Rede da cidade e para seguir um deles.
  - O desenho de pedestres continua na tabela de orçamento do VISAO.md (420 no Poco X7 Média).
- **Poluição e valor do terreno:**
  - Grade de 64 x 64 sobre o mapa, com difusão simples e vento. Cada lote lê a célula dele.
  - A camada vira uma textura de dados.
  - O valor do terreno recalcula por evento (prédio novo, serviço pronto), não por quadro.
- **Redes físicas (fase 5):**
  - Como no CS2, cano e cabo de baixa tensão vão dentro da via [C3][C29]. A rede é o próprio grafo de vias: um
    bairro tem água se a via dele chega a uma estação.
  - Só a alta tensão se desenha à parte, e só no PC.
  - Nada de ferramenta de cano no celular.
- **WebGPU:** o three r186 tem o WebGPURenderer com compute. O caminho do VISAO.md fica: o trânsito agregado cabe na
  CPU do worker. O compute na GPU só entra se a amostra visível passar de milhares de carros no PC Ultra [O16][O17].
- **Save:** campos novos com padrão em `normalizar`. A versão 4 só vem quando a forma mudar: zonas por lote na fase 2 e
  vias e lotes novos na fase 3. Os lotes antigos `bairro:i:j` ficam; as vias livres criam lotes novos com outro
  prefixo em áreas novas.

## 8. Roteiro atualizado

### 8.1 Esta rodada (fase 1.3: "Cara de CS2"): pedidos agora

- **As outras frentes fazem o grosso:**
  - motor visual realista;
  - arquitetura com megaprojetos (Torre retangular de alto luxo e demais prédios);
  - interface nova no jeito do CS2.
- **Da frente de sistemas entra só a exposição dos dados atuais,** sem regra nova e sem mudança de save:
  - camadas de informação;
  - ícones de problema;
  - painel da cidade;
  - saldo por hora na barra;
  - Rede da cidade (opcional);
  - **[Crítico]** painel de produção e vocabulário sem BuildIt (S8): a mesma regra, apresentada como indústria e
    contratos, com superávit e déficit por item como no CS2 [C33] e no HC.
- **Por que parar aí:** o dono pediu visual, interface e arquitetura, e é sensível a custo. Mexer na regra agora
  obrigaria a refazer o equilíbrio do robô (capítulo 6, vida 100) no meio da troca visual.

### 8.2 Depois desta rodada

| Fase | Nome | O que entra | Por que nessa ordem | Pronto quando |
|---|---|---|---|---|
| 2 | Cidade que cresce | zonas com demanda nos lotes atuais; crescimento e níveis automáticos; valor do terreno por lote; empregos e escolaridade agregados; serviços com capacidade e extensões; bombeiros, lixo, telecom; marcos da cidade e árvore de desenvolvimento; bairros como distritos com políticas; assinaturas com requisito; barras de demanda | é o coração do CS2 e não precisa de vias livres (a grade de hoje basta). Rivais e Imobiliário dependem de demanda e de valor do terreno | um bairro cresce só por zonas; o robô completa 3 marcos da cidade; capítulo 6 continua fechando |
| 3 | Vias e trânsito | ferramenta de vias no toque (reta, curva, grade); tipos e melhorias; rotatória; rua de pedestres e ciclovia; lotes gerados ao longo das vias; trânsito agregado no worker com carros por fluxo; linhas de ônibus, VLT e metrô; poluição do ar, do solo e ruído com camadas | depende das zonas (fase 2) para ter origem e destino das viagens | uma cidade crescida só por zonas e vias; congestionamento visível e resolvido por via ou linha |
| 4 | Holding e mercado | divisões, Influência, rivais e aliados, eventos com memória (o que era a fase 2 do VISAO.md); câmara e leis locais; cadeias do HC com entrega por caminhão; carga e comércio exterior pelo porto e pelo aeroporto; turismo e hotéis; aluguel dos imóveis da Holding; impostos fora da moradia e tarifas (com aprovação) | rivais disputam demanda, terreno e clientes, que só existem depois da fase 2 | o robô vence um rival e completa 10 eventos |
| 5 | Escala e vida | motor (worker, blocos, níveis de detalhe, WebGPU opcional); compra de áreas em blocos; cidadãos em grupos com ciclo de vida; saúde, cemitério, crime; clima e estações tropicais; desastres; redes físicas no PC; pontes, túneis e cais | precisa do motor em escala para crescer 30 vezes | 50 mil lotes a 60 quadros no PC e 30 no Poco X7 |
| 6 | Apps | `.exe` (Electron) e APK (TWA), saves em arquivo | igual ao VISAO.md (era a fase 5) | instalados nos aparelhos do dono |
| 7 | Mapa-múndi e 2ª metrópole | rotas de avião e navio, câmbio; recursos naturais e estilo por metrópole | igual (era a 6) | uma filial lucrativa fora do Brasil |
| 8 | 12 metrópoles | política e geopolítica completas | igual (era a 7) | todas no mesmo save |

**As fases 3 e 4 podem trocar de lugar sem prejuízo técnico:** a Holding só depende da fase 2. Se o dono quiser
negócios antes do trânsito, a ordem vira 2, 4, 3.

**[Crítico] A fase 2 está grande demais para uma fase.** Somando os custos da seção 6, ela tem uns 25 a 30 dias de
parcela (zonas G, biblioteca de prédios G, mais uns dez itens M). Dividir em duas, cada uma com robô e publicação:
- **2a "Zonas":** pré-requisito V5 (LOD da frente visual); zonas nos lotes, demanda com barras, valor do terreno por
  lote, níveis automáticos, empregos e escolaridade agregados, primeira biblioteca de prédios (moradia e comércio).
  Pronto quando: um bairro cresce só por zonas, a vista aberta com a cidade cheia fica em até 300 chamadas e 900 mil
  triângulos na Média, e o capítulo 6 continua fechando.
- **2b "Serviços e marcos":** capacidade e extensões, bombeiros, lixo, telecom, marcos da cidade, árvore, distritos
  com políticas, assinaturas com requisito. Pronto quando: o robô completa 3 marcos da cidade.

### 8.3 O que muda em relação ao VISAO.md

- A fase 2 antiga (Holding, rivais, eventos, bombeiros, lixo, telecom, marcos) se divide:
  - a parte de cidade (bombeiros, lixo, telecom, marcos) fica na fase 2 nova, junto com zonas e demanda, que
    vinham da fase 3;
  - a parte de negócios vai para a fase 4.
- A fase 4 antiga (motor em escala) vira a 5, e ganha os sistemas de vida do CS2 (cidadãos, clima, desastres, redes).
- O que o jeito BuildIt deixa na cidade:

| Mecânica de hoje (jeito BuildIt) | Destino |
|---|---|
| Níveis de moradia da cidade pagos com material | só nos prédios da Holding e na Arcologia; os zoneados crescem sozinhos (fase 2) |
| Pedidos da comunidade (balões com itens) | viram contratos de empresas e da Prefeitura (fase 4), com as mesmas quantidades e os 150%. **[Crítico]** O nome "Contratos" e a lista sem balões entram já (S8), com a mesma regra |
| Usinas e oficinas com fila | viram indústrias da Holding no mapa (fase 4); os lotes de 1 a 10 ficam. **[Crítico]** Já nesta rodada aparecem no painel de produção (S8) como "Extração" e "Indústria", com produção por hora e saldo por item |
| **[Crítico]** Balões de coleta sobre os prédios | na cidade, saem nesta rodada (ícones de S3); na Arcologia, a frente de interface decide com a coleta automática que já existe |
| **[Crítico]** Cronômetros de relógio real, sem pausa | pergunta ao dono (seção 12.3); nada muda nesta rodada |
| Almoxarifado com estrados, etiquetas e cadeados | vira centro de distribuição (fase 4) |
| Depósito de trocas | vira mercado e comércio exterior (fase 4); 150% e 100 por janela ficam |
| Compra de tempo e aceleradores | ficam (pedido do dono) |
| Mutirão e disposição | ficam até a fase 4; podem virar "horas extras" da Construtora |

## 9. Decisões principais

1. **O CS2 passa a ser a regra da cidade.** O jeito BuildIt sai do crescimento da cidade (fase 2). Fica só nos prédios
   da Holding e na Arcologia, onde a entrega de material é justamente o que o Highrise City faz.
2. **Simulação agregada com amostra visível,** e não agentes um a um como o CS2. Os motivos: o Poco X7, o próprio CS2
   (pesado no desenho, não na regra [C64]) e a lição do SimCity 2013 [O14].
3. **Nada que bata com as regras do dono.** Sem imposto na moradia, sem limite de empréstimo por marco e sem mudar o
   Depósito nem os lotes de 1 a 10. Receita nova (aluguel dos imóveis da Holding, impostos fora da moradia, tarifas)
   só com aprovação dele, na fase 4.
4. **Esta rodada não muda regra nem save:** só mostra, no jeito do CS2, os dados que já existem. **[Crítico]** E
   mostra só dados que variam no mapa: número único da cidade vai para painel, não para camada.
5. **Roteiro reordenado:** "Cidade que cresce" (2) antes de "Vias e trânsito" (3) e de "Holding e mercado" (4). As
   fases 3 e 4 podem trocar.
6. **Os bairros de hoje viram distritos e a grade fica.** As vias livres criam lotes novos em áreas novas. Nenhum id
   antigo muda.
7. **Redes pela via, como no CS2:** água, esgoto e energia de baixa tensão vão dentro das vias. A alta tensão só se
   desenha no PC. Não há ferramenta de cano no celular.
8. **O calendário fica:** dia de 20 s e ano de 2 h, porque o empréstimo de 50 mil por ano depende dele. As estações usam
   os trimestres do calendário (30 min reais cada), com clima tropical de chuva e seca, sem neve.
9. **A Arcologia é a megaestrutura-assinatura,** como os serviços modulares do CS2 (etapas = extensões). Os capítulos
   continuam sendo a campanha dela. Os marcos da cidade são uma trilha à parte.
10. **O bem-estar geral continua mandando na tarifa de 5, 8 ou 11.** Os fatores novos do CS2 (lixo, poluição,
    saúde) entram nele. A regra fica; o número pode cair mais, e o robô mede isso a cada fase.

**Perguntas ao dono** (não travam esta rodada):
- **[Crítico]** Relógio: continua o relógio real (cronômetros que andam com o jogo fechado) ou passa a ter pausa e
  velocidades como o CS2? Ver seção 12.3.
- Confirma a ordem 2, 3, 4, ou prefere 2, 4, 3?
- Aceita manutenção dos serviços como despesa na fase 2? Ela muda o equilíbrio, mas não as quatro regras.
- Aceita aluguel dos imóveis da Holding e imposto fora da moradia na fase 4?

## 10. Parcelas

### 10.1 Desta rodada (sistemas; nenhuma regra nova, nenhum campo novo no save)

**[Crítico] Tabela reescrita.** A versão anterior tinha: camadas que não variam no mapa (`servicos`, `bem`), a
dessaturação no `COMPOSITE` que apagaria a própria camada, `MAX_MARCAS` de 1.000 para 1.651 lotes, "grave = quando tira
renda" para falta de serviço (que hoje não tira renda), aceite de desenho 3D pela `vitrine-ui` (que roda sem WebGL: o
`engine` dela é um esboço sem `render`), nenhuma parcela para o laço BuildIt e nenhuma ordem entre as parcelas.

Ordem: **S1 → (S2, S3, S4, S8 em paralelo) → S5 → S6 (opcional) → S7.** As consultas (`estado.js`) são desta frente;
os painéis e a barra são da frente de interface, que recebe os contratos prontos. Para não brigar por arquivo, esta
frente não edita `hud.js` nem `paineis.js`: entrega a consulta pura, o teste e uma cena da vitrine com o dado cru.

| # | Parcela | Arquivos | Contrato | Custo | Aceite |
|---|---|---|---|---|---|
| S1 | Consultas das camadas | `fonte/sim/estado.js`, `ferramentas/simular.mjs` (testes) | `J.camada(tipo)` → `{lotes: Map<loteId, number \| null>, modulos: Map<'faixa:i', number>, rampa: 'seq' \| 'cat', legenda: [{v, txt, cor}], resumo: {txt, n}}`, pura, sem evento; `null` = lote de bairro fechado (fica cinza). Tipos: `cobertura:policia`, `cobertura:educacao`, `cobertura:saude`, `cobertura:superior`, `cobertura:total` (0 a 4 serviços / 4), `trava` (categórica: nada, itens, cobertura, serviço, bem-estar, a partir de `requisitosModulo`), `estado` (categórica: mata, limpo, ocupado, Holding), `nivel` (nível / nível máximo do tipo), `moradores` (moradores do lote / maior do mapa; também para os módulos da Arcologia), `valor` (`precoTerreno` / maior preço; legenda diz "por bairro"). Sai `servicos` e `bem`: número único, vão para S4 | P | teste: função pura (save igual antes e depois, por `JSON.stringify`); valores em 0..1 ou categoria válida; `cobertura:x` igual a `coberturaLote`; `valor` igual para todos os lotes do mesmo bairro; bairro fechado dá `null` |
| S2 | Desenho das camadas | `fonte/render/camadas.js` (novo), `render/materials.js` (gancho `uCamada`), `render/mundo.js` (atributo `aLote` na fusão), `render/cidade.js` (placas próprias de 2.048), `jogo.js` | com a camada aberta: cor de base dos materiais compartilhados vai para cinza claro; prédio da cidade e módulo da Arcologia tomam a cor do lote por `texelFetch` numa textura 64 x 32; lote vazio e mata ganham placa no chão (instanciada, sem sombra, `polygonOffset`). Nada no `COMPOSITE` | M | captura 3D com `testar.mjs` (skill capturas-de-aceite), camadas `cobertura:policia` e `valor`, antes e depois; `engine.stats`: no máximo +1 chamada e +3,3 mil triângulos na vista aberta com a cidade grande; abrir e fechar a camada 10 vezes não aumenta `renderer.info.programs` (só uniforme); robô sem `erros` |
| S3 | Ícones sobre os prédios | `estado.js` (`J.avisos()` → `[{f, i, lote, tipo, nivel: 'trava' \| 'perda', causa}]`), `fonte/render/avisos3d.js` (novo), `ferramentas/simular.mjs` | `trava` (âmbar): o que impede o próximo nível (`cobFalta`, `servOk`, `bemOk`, itens), só em prédio parado; `perda` (vermelho): empresa com `emp.ocupacao` < 1, a única perda real de hoje. Falta de água, energia ou saneamento: um alerta só, na barra (dado em `J.avisosCidade()`), nunca um ícone por prédio. `InstancedMesh` com placa virada no shader; atlas de `icones.js`; teto 200/60/30 por qualidade; longe, um por bairro com número; toque abre o painel do prédio. Tira os balões dos prédios da cidade | P | teste: todo `cobFalta` de prédio parado gera `trava`; ocupação < 1 gera `perda`; nenhum aviso em bairro fechado. Captura 3D; `engine.stats` +1 chamada; robô sem `erros` |
| S4 | Consultas do painel Cidade e do saldo | `estado.js` (`J.resumoCidade()`, `J.saldoHora()`), `ferramentas/simular.mjs`, cena `cidade-painel` em `ferramentas/vitrine-ui.mjs`; o desenho do painel e da barra é da frente de interface | `saldoHora()` → `{receitas: {moradores, conselho, comercio, shopping, empresas}, despesas: {juros}, saldo}`, por **hora real jogando** (fechado rende 50%, e isso vai escrito). `moradores = pop x tarifa`; `conselho`, `comercio` e `shopping` são as partes de `pop x tarifa x (ef.repasse, rendaCidade, emp.renda)`; `juros = jurosPorDia x 180` (1 dia = 20 s). `resumoCidade()` junta população, bem-estar com fontes, serviços (capacidade x uso) e bairros (lotes, ocupação, valor, moradores) com as consultas que já existem | P | teste: soma das receitas = `rendaHora()` (diferença < 1 crédito); `juros` bate com `emprestimoInfo().jurosPorDia x 180`; cena da vitrine sem erros de página em 986x443 e 915x412 |
| S5 | Legenda e seletor de camadas | `fonte/ui/` (frente de interface), ícones das camadas em `icones.js`, cena `camadas` em `ferramentas/vitrine-ui.mjs` | botão "i" abre a lista; a escolhida fica até fechar; lembra a última por `localStorage` com try/catch; a legenda mostra o `resumo` de S1 | P | alvos de 44 px e texto de 12 px ou mais; cena `camadas` sem erros nas duas telas |
| S6 (opcional) | Rede da cidade | `fonte/ui/` (feed) | posts curtos a partir dos eventos que já saem (`nivel`, `moduloFeito`, `etapaFeita`, `bairroComprado`, `emprestimo`, `aviso`; todos conferidos no `estado.js`), assinados por conselheiros e moradores | P | fica para a fase 2 se a rodada apertar |
| **S8 (nova)** | Painel de produção e vocabulário sem BuildIt | `estado.js` (`J.producaoInfo()`), `ferramentas/simular.mjs`; os nomes moram em `data/itens.js` (`PREDIOS`), `data/historia.js` (falas) e na interface (`hud.js`, `paineis.js`, `extras.js`), então a troca de nomes é feita junto com a frente de interface | por item: `{estoque, emCurso, porHora, demanda, saldo, de: [predio], para: ['etapa' \| 'modulo' \| 'contrato']}`; `porHora` sai dos espaços e filas no automático (`n / durLote`), `demanda` soma o que falta nas etapas e pavimentos disponíveis (`itensEtapa`, `requisitosModulo`) e nos pedidos (`pedidosTotais`). Nomes de tela: Usinas = Extração, Oficinas = Indústria, Pedidos = Contratos, Almoxarifado = Armazém. Ids, eventos e save ficam | P | teste: consulta pura; `saldo = estoque + emCurso − demanda`; os ids do save não mudam (robô com `cap 6` e `vida 100`) |
| S7 | Documentos | `docs/VISAO.md` (seções 2 e 6: tabela CS2 e roteiro novo, com a fase 2 dividida), `README.md` (camadas, avisos, painéis) | resumo desta pesquisa, com os números medidos | P | revisão do texto; sem travessão |

A verificação segue o CLAUDE.md:
- `montar.mjs` sem avisos;
- `simular.mjs --testes` → `testes ok`;
- robô com `cap 6`, `vida 100` e `erros []`;
- `vitrine-ui` com as cenas novas em 986x443 e 915x412, à noite;
- chamadas e triângulos medidos numa vista aberta com a cidade grande (Poco X7 Média: até 300 chamadas).
- **[Crítico]** capturas 3D das camadas e dos avisos com o `testar.mjs` (a `vitrine-ui` não tem WebGL e não serve de
  aceite para S2 e S3).

### 10.2 Das próximas fases (para planejar, não para agora)

- **Fase 2:**
  - 2.1 zonas nos lotes (pincel, tipos e densidades; save v4 com `S.cidade.zonas`);
  - 2.2 demanda e crescimento automático com a obra animada;
  - 2.3 valor do terreno por lote e níveis dos zoneados;
  - 2.4 empregos e escolaridade agregados;
  - 2.5 serviços com capacidade, vários por tipo e extensões;
  - 2.6 bombeiros, lixo e telecom;
  - 2.7 marcos da cidade e árvore de desenvolvimento;
  - 2.8 bairros como distritos com políticas;
  - 2.9 assinaturas com requisito e efeito;
  - 2.10 robô, testes e README.
- **Fase 3:**
  - 3.1 grafo de vias e ferramenta de vias no toque;
  - 3.2 tipos, faixas e melhorias;
  - 3.3 rotatória e cruzamentos;
  - 3.4 lotes gerados ao longo das vias;
  - 3.5 atribuição de trânsito no worker e carros por fluxo;
  - 3.6 linhas de ônibus, VLT e metrô;
  - 3.7 poluição do ar, do solo e ruído com camadas;
  - 3.8 robô e testes.
- **Fase 4:**
  - 4.1 divisões e Influência;
  - 4.2 rivais e aliados;
  - 4.3 eventos com memória;
  - 4.4 câmara e leis;
  - 4.5 cadeias com entrega por caminhão e centro de distribuição;
  - 4.6 carga e exportação pelo porto e pelo aeroporto;
  - 4.7 turismo e hotéis;
  - 4.8 aluguel, impostos fora da moradia e tarifas (se aprovados);
  - 4.9 robô e testes.
- **Fase 5:**
  - 5.1 simulação no worker e mapa em blocos;
  - 5.2 níveis de detalhe e WebGPU opcional;
  - 5.3 cidadãos em grupos com ciclo de vida;
  - 5.4 saúde, cemitério e crime;
  - 5.5 clima e estações tropicais;
  - 5.6 desastres;
  - 5.7 redes físicas no PC;
  - 5.8 pontes, túneis e cais;
  - 5.9 compra de áreas.

## 11. Fontes

Cities: Skylines II
- [C1] Colossal Order, diário de desenvolvimento 1, ferramentas de vias: https://colossalorder.fi/?p=1547
- [C2] Paradox, Feature Highlight 1, Road Tools: https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools
- [C3] Wiki oficial, Roads: https://cs2.paradoxwikis.com/Roads
- [C4] PCGamesN, rotatórias: https://www.pcgamesn.com/cities-skylines-2/roundabouts
- [C5] Game Developer, vias como espinha dorsal do CS2: https://www.gamedeveloper.com/design/how-colossal-order-turned-roads-into-the-backbone-of-cities-skylines-ii
- [C6] Paradox, patch Quays & Piers 1.3.3f1: https://www.paradoxinteractive.com/games/cities-skylines-ii/news/quays-and-piers-patch
- [C7] Game Rant, melhorias de via: https://gamerant.com/cities-skylines-2-how-upgrade-roads/
- [C8] Colossal Order, diário de desenvolvimento 2, IA de trânsito: https://colossalorder.fi/?p=1597
- [C9] Paradox, Feature Highlight 2, Traffic AI: https://www.paradoxinteractive.com/games/cities-skylines-ii/features/traffic-ai
- [C10] Wiki oficial, Traffic: https://cs2.paradoxwikis.com/Traffic
- [C11] Game Rant, condição das vias: https://gamerant.com/cities-skylines-2-how-fix-road-conditions-guide/
- [C12] Paradox, notas do Bike Patch 1.4.2f1: https://www.paradoxinteractive.com/games/cities-skylines-ii/news/bike-patch-notes
- [C13] PC Gamer, patch das bicicletas: https://www.pcgamer.com/games/city-builder/cities-skylines-2s-bicycle-update-adds-a-lot-more-than-just-bikes-as-colossal-order-prepares-to-hand-over-development-to-a-new-studio/
- [C14] Wiki oficial, Zoning: https://cs2.paradoxwikis.com/Zoning
- [C15] Paradox, Feature Highlight 4, Zones & Signature Buildings: https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings
- [C16] Pro Game Guides, todas as zonas: https://progameguides.com/cities-skylines-2/all-zones-in-cities-skylines-ii-and-what-they-mean/
- [C17] Steam, tamanho da célula de zona: https://steamcommunity.com/app/949230/discussions/0/3937895474111313685/
- [C18] Mods Cities 2, valor do terreno e níveis: https://www.modscities2.com/cities-skylines-2-land-value-and-building-levels/
- [C19] TheGamer, valor do terreno: https://www.thegamer.com/cities-skylines-2-increase-manage-land-value-explained-guide/
- [C20] Wiki oficial, Signature buildings: https://cs2.paradoxwikis.com/Signature_buildings
- [C21] Game Rant, assinaturas: https://gamerant.com/cities-skylines-2-how-to-unlock-and-place-signature-buildings/
- [C22] Paradox, Feature Highlight 5, City Services, Districts & Policies: https://www.paradoxinteractive.com/games/cities-skylines-ii/features/city-services-districts-policies
- [C23] Wiki oficial, Services: https://cs2.paradoxwikis.com/Services
- [C24] Chill Place Gaming, serviços e cobertura: https://chillplacegaming.com/city-services-cities-skylines-ii/
- [C25] Chill Place Gaming, prédios modulares: https://chillplacegaming.com/modular-buildings-cities-skylines-ii/
- [C26] Shacknews, melhorias de serviço: https://www.shacknews.com/article/137559/cities-skylines-2-best-service-upgrades
- [C27] PCGamesN, lixo: https://www.pcgamesn.com/cities-skylines-2/garbage
- [C28] Wiki oficial, Info views: https://cs2.paradoxwikis.com/Info_views
- [C29] Paradox, Feature Highlight 6, Electricity & Water: https://www.paradoxinteractive.com/games/cities-skylines-ii/features/electricity-water
- [C30] TheGamer, eletricidade: https://www.thegamer.com/cities-skylines-2-electricity-power-demand/
- [C31] Wiki oficial, Transportation: https://cs2.paradoxwikis.com/Transportation
- [C32] TheGamer, linhas de ônibus: https://www.thegamer.com/cities-skylines-2-bus-routes-basic-transportation-set-up/
- [C33] Paradox, Feature Highlight 9, Economy & Production: https://www.paradoxinteractive.com/games/cities-skylines-ii/features/economy-production
- [C34] Screen Rant, impostos: https://screenrant.com/cities-skylines-2-tax-rate/
- [C35] Chill Place Gaming, impostos e receitas: https://chillplacegaming.com/cities-skylines-ii-taxes-income/
- [C36] Game Rant, empréstimos: https://gamerant.com/how-take-get-loans-cities-skylines-2/
- [C37] Magic Game World, impostos e empréstimos: https://www.magicgameworld.com/cities-skylines-2-understanding-taxes-and-loans/
- [C38] Paradox, diário Economy 2.0 parte 1: https://www.paradoxinteractive.com/games/cities-skylines-ii/news/dev-diary-economy-part-one
- [C39] TechRaptor, notas do Economy 2.0: https://techraptor.net/gaming/news/cities-skylines-2-economy-20-patch
- [C40] Chill Place Gaming, cadeias de suprimento: https://chillplacegaming.com/supply-chain-cities-skylines-ii/
- [C41] TheGamer, importação e exportação: https://www.thegamer.com/cities-skylines-2-imports-exports-guide/
- [C42] Wiki oficial, Natural resources: https://cs2.paradoxwikis.com/Natural_resources
- [C43] GINX, políticas de distrito: https://www.ginx.tv/en/cities-skylines-2/all-district-policies-listed-explained
- [C44] VideoGamer, políticas: https://www.videogamer.com/guides/cities-skylines-2-policies/
- [C45] PCGamesN, distritos: https://www.pcgamesn.com/cities-skylines-2/districts
- [C46] Wiki oficial, Pollution: https://cs2.paradoxwikis.com/Pollution
- [C47] GamesRadar, poluição: https://www.gamesradar.com/cities-skylines-2-pollution-guide/
- [C48] Wiki oficial, Progression: https://cs2.paradoxwikis.com/Progression
- [C49] Colossal Order, diário 10, progressão: https://colossalorder.fi/news/development-diary-10-game-progression/
- [C50] Dexerto, árvore de desenvolvimento: https://www.dexerto.com/gaming/cities-skylines-2-development-trees-unlockables-and-costs-2349659/
- [C51] The Review Geek, XP e marcos: https://www.thereviewgeek.com/citiesskylines2-guide-progressionsystem/
- [C52] PC Gamer, tamanho do mapa: https://www.pcgamer.com/cities-skylines-2-map-size/
- [C53] Colossal Order, diário 11, cidadãos: https://colossalorder.fi/news/development-diary-11-citizen-simulation-lifepath/
- [C54] Wiki oficial, Citizens: https://cs2.paradoxwikis.com/Citizens
- [C55] Shacknews, Chirper e cidadãos: https://www.shacknews.com/article/136821/cities-skylines-2-chirper-internet-citizen-lifepaths
- [C56] PCGamesN, sem-teto: https://www.pcgamesn.com/cities-skylines-2/homelessness
- [C57] UrbanLoon, fatores de demanda: https://urbanloon.com/pages/cities-skylines-2-no-residential-demand
- [C58] Paradox, Feature Highlight 8, Climate & Seasons: https://www.paradoxinteractive.com/games/cities-skylines-ii/features/climate-seasons
- [C59] TechRaptor, clima e desastres: https://techraptor.net/gaming/news/cities-skylines-2-climate-video
- [C60] Steam, escalas de tempo do CS2: https://steamcommunity.com/sharedfiles/filedetails/?id=3072493428
- [C61] Wiki oficial, Tourism: https://cs2.paradoxwikis.com/index.php?title=Tourism
- [C62] VideoGamer, hotéis: https://www.videogamer.com/guides/cities-skylines-2-hotels/
- [C63] Paradox, lançamento do Bridges & Ports: https://www.paradoxinteractive.com/media/press-releases/press-release/cities-skylines-ii-bridges-ports-expansion-available-now
- [C64] paavohtl, por que o CS2 roda mal: https://blog.paavo.me/cities-skylines-2-performance/
- [C65] Wiki oficial, ícones de notificação: https://cs2.paradoxwikis.com/Category:Notification_icons
- [C66] **[Crítico]** Código decompilado do CS2 publicado num repositório de mod (busca de código do GitHub; serve para
  conferir mecânica, não para copiar): `Game.Simulation/MilestoneSystem.cs` soma `milestone.m_LoanLimit` ao
  `Creditworthiness` da cidade, que o `Game.Tools/LoanSystem.cs` lê:
  https://github.com/bworthy89/roadmod/blob/5b49a4fc0c572f2b5133df83083ebb4afe2f76a6/New%20folder/Game.Simulation/MilestoneSystem.cs
  e https://github.com/bworthy89/roadmod/blob/5b49a4fc0c572f2b5133df83083ebb4afe2f76a6/New%20folder/Game.Tools/LoanSystem.cs
- [C67] **[Crítico]** Mesmo repositório: `Game.Simulation/TimeSystem.cs` (`kTicksPerDay = 262144`),
  `Game.Simulation/ISimulationSystem.cs` (`float selectedSpeed`) e `Game.UI/ErrorDialogManager.cs` (guarda a velocidade
  e põe `selectedSpeed = 0f`, isto é, pausa):
  https://github.com/bworthy89/roadmod/blob/5b49a4fc0c572f2b5133df83083ebb4afe2f76a6/New%20folder/Game.Simulation/TimeSystem.cs
  e https://github.com/bworthy89/roadmod/blob/5b49a4fc0c572f2b5133df83083ebb4afe2f76a6/New%20folder/Game.Simulation/ISimulationSystem.cs
- [C68] **[Crítico]** Mesmo repositório: `Game.Rendering/ObjectColorSystem.cs` e `Game.Notifications/MarkerCreateSystem.cs`
  leem `InfoviewBuildingData` (`Game.Prefabs/InfoviewBuildingData.cs`) para colorir prédios e pôr marcadores na camada:
  https://github.com/bworthy89/roadmod/blob/5b49a4fc0c572f2b5133df83083ebb4afe2f76a6/New%20folder/Game.Rendering/ObjectColorSystem.cs
  e https://github.com/bworthy89/roadmod/blob/5b49a4fc0c572f2b5133df83083ebb4afe2f76a6/New%20folder/Game.Notifications/MarkerCreateSystem.cs
- [C69] **[Crítico]** Mods de tempo do CS2: Time2Work (`slow_time_factor` multiplica `TimeSystem.kTicksPerDay`):
  https://github.com/ruzbeh0/Time2Work ; comentário do TransitTimetables ("Vanilla: 1 day = TimeSystem.kTicksPerDay =
  262144 frames", "3.5x by default"):
  https://github.com/AmicusDeus/TransitTimetables/blob/4fc4337cb5382dba8f3e273ce8447b7c5b2b0d7e/TimebaseSystem.cs

Highrise City
- [H1] Steam, Highrise City: https://store.steampowered.com/app/1489970/Highrise_City/
- [H2] GINX, o sucessor de SimCity: https://www.ginx.tv/en/highrise-city-best-simcity-successor-you-ve-probably-never-played
- [H3] Pixelkin, saída do acesso antecipado (1.0): https://pixelkin.org/2023/09/04/city-builder-highrise-city-officially-leaves-early-access-on-pc/
- [H4] WayTooManyGames, análise: https://waytoomany.games/2023/09/13/review-highrise-city/
- [H5] Bone-Idle, análise do acesso antecipado: http://www.bone-idle.ie/highrise-city-early-access-review/
- [H6] LadiesGamers, prévia: https://ladiesgamers.com/highrise-city-early-access-preview/
- [H7] Magic Game World, guia de iniciante: https://www.magicgameworld.com/highrise-city-beginners-guide-tips-for-a-successful-city/
- [H8] Steam, DLC Metro & Planes: https://store.steampowered.com/app/2024160/Highrise_City_Metro__Planes/
- [H9] Codex Gamicus, cadeias de produção: https://gamicus.fandom.com/wiki/Production_Chains_in_Highrise_City
- [H10] OneUpNerd, análise: https://oneupnerd.com/review/highrise-city-review/
- [H11] ZapZockt, análise: https://zapzockt.de/en/highrise-city-review-test/

Outros jogos e técnica
- [O1] Anno 1800 Wiki, população: https://anno1800.fandom.com/wiki/Population
- [O2] Chill Place Gaming, cadeias do Anno 1800: https://chillplacegaming.com/anno-1800-supply-chains/
- [O3] GameSpew, prévia do Anno 117: https://www.gamespew.com/2025/10/anno-117-pax-romana-preview/
- [O4] Gamepressure, política do Tropico 6: https://www.gamepressure.com/tropico-6/politics-and-constitution/z8c0a4
- [O5] Game Rant, facções do Tropico 6: https://gamerant.com/tropico-6-every-faction-explained-guide/
- [O6] Frostpunk Wiki, o Conselho: https://frostpunk.fandom.com/wiki/The_Council
- [O7] Twinfinite, votação no Frostpunk 2: https://twinfinite.net/guides/frostpunk-2-council-voting-explained-how-to-pass-every-vote-negotiate-more/
- [O8] Capitalism Lab, DLC de subsidiárias: https://www.capitalismlab.com/subsidiary-dlc/
- [O9] Capitalism Lab, DLC de simulação da cidade: https://www.capitalismlab.com/ces-dlc/
- [O10] Wiki oficial do Workers & Resources, construção: https://wiki.hoodedhorse.com/Workers_Resources_Soviet_Republic/Construction
- [O11] Wiki do Transport Fever 2, indústrias e carga: https://wiki.transportfever2.com/doku.php?id=gamemanual%3Aindustriescargos
- [O12] TouchArcade, análise do Pocket City 2: https://toucharcade.com/2023/04/18/pocket-city-2-review-mobile-iphone-ipad-premium-city-builder/
- [O13] Wikipedia, TheoTown: https://en.wikipedia.org/wiki/TheoTown
- [O14] GameSpot, trânsito do SimCity 2013: https://www.gamespot.com/articles/simcity-traffic-problems-being-fixed-says-maxis/1100-6405369/
- [O15] SimCity Wiki, motor GlassBox: https://simcity-archive.fandom.com/wiki/Glassbox_Simulation_Engine
- [O16] greggman, simulação de direção em WebGPU: https://github.com/greggman/webgpu-driving
- [O17] Three.js Roadmap, compute shaders em WebGPU: https://threejsroadmap.com/blog/introduction-to-webgpu-compute-shaders
- [O18] **[Crítico]** three.js r186, notas da versão (WebGPURenderer com `compileComputeAsync`, compute com
  `updateBefore`/`updateAfter`, correções do `BatchedMesh`): https://github.com/mrdoob/three.js/releases/tag/r186
