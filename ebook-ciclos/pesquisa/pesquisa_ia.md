# Pesquisa: a IA de 1950 a outubro de 2026

Base dos capítulos de IA (Cap. 10 e 11). Feita em 27/10/2026. Cobre a história, os invernos, a volta a partir de 2012, o papel da Covid e de outros choques, o que faz esta onda diferente das bolhas anteriores e o noticiário de julho a outubro de 2026.

**Marcas de confiança**
- **[F]**: conferido nesta pesquisa na fonte primária ou numa fonte jornalística de primeira linha (link na seção 9).
- **[S]**: fonte secundária (blog, agregador, resumo). Conferir o original antes de pôr número no livro.
- **[H]**: história consagrada, contada do mesmo jeito em toda a literatura. Antes de citar entre aspas ou dar número exato, conferir a fonte primária indicada.

**Regra da CVM.** Empresas listadas aparecem por descrição ("a maior fabricante de chips de IA", "a dona da maior rede social"). Laboratórios, produtos e marcos de pesquisa (ChatGPT, AlexNet, AlphaGo) aparecem pelo nome, porque não são ativos negociáveis. Nada aqui é recomendação nem data de estouro.

---

## 1. Linha do tempo em nove fases

### 1.1 Fundação (1943 a 1956)
- 1943: McCulloch e Pitts descrevem o neurônio artificial. [H]
- 1950: Turing publica "Computing Machinery and Intelligence" (revista *Mind*), com o "jogo da imitação". [H]
- 31/8/1955: McCarthy, Minsky, Rochester e Shannon assinam a proposta do encontro de Dartmouth, que cria o nome "inteligência artificial". A conjectura: "every aspect of learning or any other feature of intelligence can in principle be so precisely described that a machine can be made to simulate it". O plano era avançar muito em **um verão, com dez pessoas**. [F]
- 1956: o encontro acontece. McCarthy anotou depois: "There was no report". [S]

**Para o livro:** a IA nasce com uma promessa de prazo curto. Esse vício de prometer cedo demais volta em todos os ciclos.

### 1.2 Primeira primavera (1956 a 1973): o otimismo dos pioneiros
- 1957 e 1958: o perceptron de Rosenblatt, pago pela Marinha dos EUA. Em 8/7/1958 o *New York Times* o descreveu como "the embryo of an electronic computer" que a Marinha esperava que fosse capaz de "walk, talk, see, write, reproduce itself" e ter consciência da própria existência. [F para a primeira parte; conferir o resto no jornal]
- 1958: Simon e Newell preveem que em dez anos um computador seria campeão mundial de xadrez. Aconteceu em 1997, 39 anos depois. [H]
- 1970: Minsky diz à revista *Life* que "de três a oito anos" haveria uma máquina com a inteligência geral de um ser humano médio. [H, conferir a citação exata]
- O dinheiro vinha quase todo do governo (a agência de pesquisa de defesa dos EUA, então ARPA), com pouca cobrança de resultado. [H]

### 1.3 Primeiro inverno (1966 a 1980): a conta chega
- 1966: o relatório ALPAC, de sete cientistas chefiados por John R. Pierce, conclui que a tradução automática não dava resultado. O governo dos EUA corta a verba de forma drástica. [F]
- 1969: *Perceptrons*, de Minsky e Papert, mostra os limites das redes de uma camada, e o financiamento das redes neurais seca por uma década. No mesmo ano, a Emenda Mansfield passa a exigir que a pesquisa militar tenha uso militar direto. [H]
- 1973: o relatório Lighthill, encomendado pelo Conselho de Pesquisa Científica britânico, critica a "explosão combinatória": técnicas que funcionavam em problemas de brinquedo não escalavam para o mundo real. Serviu de base para o fim do apoio à IA na maioria das universidades britânicas. [F]

**O padrão:** promessa grande, demonstração pequena, limite técnico, relatório oficial e corte de verba. É um "estouro", mas de verba pública, não de bolsa.

### 1.4 Segunda primavera (1980 a 1987): os sistemas especialistas viram negócio
- Os sistemas especialistas codificam regras de especialistas humanos ("se o sintoma X, então Y"). O caso famoso é o configurador de computadores de um grande fabricante americano, que teria economizado dezenas de milhões de dólares por ano. [H, conferir o número]
- 1982: o Japão lança o projeto de Computadores de Quinta Geração, de dez anos, com máquinas paralelas para lógica. Os EUA respondem com a Strategic Computing Initiative (1983) e a Europa com programas próprios. É a primeira corrida geopolítica da IA. [H]
- Surge uma indústria de hardware dedicado, as máquinas Lisp, com empresas abertas em bolsa e capital de risco. [H]

### 1.5 Segundo inverno (1987 a 1993): o primeiro estouro de mercado
- 1987: o mercado de hardware dedicado à IA desaba quando os computadores pessoais e as estações de trabalho passam a rodar o mesmo software por uma fração do preço. [S]
- Manter os sistemas especialistas custava mais do que eles rendiam; eram "frágeis": acertavam os casos para os quais foram feitos e erravam o resto. [S]
- O projeto japonês termina em 1992 sem atingir os objetivos. [S]
- "IA" vira palavra ruim. Os pesquisadores passam a dizer "aprendizado de máquina", "informática", "sistemas inteligentes". [H]

**Lição para a bolha atual:** o hardware caro e dedicado foi engolido pelo hardware comum e barato. A mesma ameaça existe hoje para quem vende chips caros, se os modelos ficarem muito mais eficientes (ver o choque de jan. 2025, seção 5.4).

### 1.6 A primavera silenciosa (1993 a 2011): estatística, dados e placas de vídeo
- 1986: Rumelhart, Hinton e Williams popularizam a retropropagação, o método que treina redes de várias camadas. 1989: LeCun lê dígitos escritos à mão para o correio americano. [H]
- 1997: um computador vence o campeão mundial de xadrez, Kasparov. [H]
- Anos 2000: a internet gera dados em massa; filtros de spam, recomendação e busca usam aprendizado estatístico sem chamar isso de IA. [H]
- 2006 e 2007: placas de vídeo (GPU) passam a ser programáveis para cálculo geral. O que servia a jogos vira o motor da IA. [H]
- 2009: a base ImageNet, com milhões de imagens rotuladas, organizada por Fei-Fei Li. [H]

**Para o livro:** os três ingredientes da volta (algoritmos, dados e computação barata) amadureceram em silêncio, fora do radar dos mercados. É a "irrupção" de Perez acontecendo sem bolha.

### 1.7 A revolução do aprendizado profundo (2012 a 2017)
- 2012: a rede AlexNet, de Krizhevsky, Sutskever e Hinton, treinada em duas GPUs de jogo, vence a competição ImageNet com erro de cerca de 15%, contra cerca de 26% do segundo colocado. Marco da volta. [H, conferir no artigo original]
- 2014: um grande grupo de buscas compra o laboratório britânico DeepMind. [H]
- 2016: AlphaGo vence Lee Sedol no go, jogo que se dizia estar uma década fora de alcance. [H]
- Desde 2010, a computação usada para treinar os modelos de ponta cresce **cerca de 4 a 5 vezes por ano** (Epoch AI). [F]

### 1.8 A era da escala (2017 a 2022)
- 2017: o artigo "Attention Is All You Need" apresenta o Transformer, a arquitetura de todos os grandes modelos de linguagem atuais. [H]
- 2019 e 2020: GPT-2 e GPT-3. O GPT-3 sai em maio e junho de 2020, **no meio da pandemia** (ver seção 3). [H]
- Nov. 2020: AlphaFold 2 praticamente resolve a previsão da estrutura de proteínas. [H]
- 30/11/2022: lançamento do ChatGPT. Pelo UBS, que usou dados da Similarweb, chegou a 100 milhões de usuários mensais em janeiro de 2023, dois meses após o lançamento. O TikTok levou cerca de nove meses e o Instagram dois anos e meio. Um analista do UBS: "In 20 years following the internet space, we cannot recall a faster ramp". [F]

### 1.9 O frenesi (2023 a 2026)
- **Investimento privado:** em 2025, o investimento privado em IA nos EUA chegou a US$ 285,9 bilhões, mais de 23 vezes os US$ 12,4 bilhões da China; a adoção nas organizações chegou a 88% (AI Index 2026, Stanford). [F] Os resumos secundários falam em US$ 344,7 bilhões de investimento privado global, alta de 127,5%, e US$ 170,9 bilhões só em IA generativa. [S]
- **Capex das gigantes:** as quatro maiores provedoras de nuvem dos EUA indicaram de US$ 720 bilhões a US$ 745 bilhões de investimento em 2026; com uma quinta empresa de bancos de dados, cerca de US$ 835 bilhões. [S] O BIS já falava em mais de US$ 1 trilhão em 2025 e 2026 (ver citacoes_conferidas, 4a). [F]
- **Receita dos laboratórios:** o maior laboratório de IA disse a investidores ter receita anualizada perto de US$ 50 bilhões no fim de setembro de 2026, com prejuízo operacional de US$ 12,3 bilhões no 2o trimestre sobre US$ 6,7 bilhões de receita; o plano de computação de 2026 a 2030 soma cerca de US$ 856 bilhões. [S, segundo FT e Reuters]
- **Prêmio Nobel:** em 2024, o Nobel de Física foi para Hopfield e Hinton (redes neurais) e o de Química para Hassabis e Jumper (AlphaFold), junto com Baker. A IA ganha a legitimidade máxima da ciência. [H]

---

## 2. O padrão dos ciclos da IA

| Onda | Promessa | Quem pagou | Limite que apareceu | Como terminou |
|---|---|---|---|---|
| 1956 a 1973 | Inteligência humana em 10 a 20 anos | Governo (defesa) | Explosão combinatória; perceptron de uma camada | Relatórios ALPAC e Lighthill; corte de verba |
| 1980 a 1987 | Especialista na caixa | Empresas e governos (corrida com o Japão) | Sistemas frágeis e caros de manter | Colapso do hardware dedicado em 1987 |
| 2012 a hoje | Inteligência geral; produtividade para toda a economia | Grandes empresas de tecnologia, capital de risco, crédito privado, governos | A conferir: energia, retorno, custo de computação | Em aberto |

**Três diferenças entre os invernos antigos e hoje:**
1. Os invernos antigos foram cortes de **verba pública de pesquisa**. Hoje o dinheiro é **privado e de mercado**, com bolsa, crédito e fundos de pensão expostos. Um inverno agora seria uma crise financeira, não um corte de orçamento.
2. Antes, a tecnologia **não funcionava** em escala. Hoje funciona e é usada por centenas de milhões de pessoas. A dúvida é se **paga a conta** do investimento, não se existe.
3. Antes, quem prometia eram os cientistas. Hoje quem promete são as empresas mais valiosas do mundo, com incentivo de mercado para isso.

---

## 3. A Covid e os outros choques que ajudaram a IA

A pandemia não criou a IA, mas mexeu em quatro alavancas ao mesmo tempo: dinheiro barato, digitalização forçada, chips como questão de Estado e uma nova história quando a anterior acabou.

### 3.1 Dinheiro de graça (2020 e 2021)
- Em março de 2020 o Fed levou o juro a perto de zero e voltou a comprar títulos em massa; o balanço do banco central americano mais que dobrou até 2022. [H, conferir no FRED]
- Com juro zero, o valor presente de lucros distantes sobe, e empresas "de futuro" sem lucro ficam mais valiosas. É o ambiente ideal para apostar em IA.
- Capital de risco em IA: recorde de mais de US$ 20 bilhões só no 2o trimestre de 2021 (CB Insights); US$ 22,3 bilhões no ano pela ABI Research, perto do pico de 2019. Os números têm escopos diferentes. [S]

### 3.2 Digitalização forçada
- Escritórios, escolas e consultas foram para a tela de uma vez. O executivo-chefe de uma das maiores empresas de software disse ter visto "dois anos de transformação digital em dois meses". [S]
- A McKinsey disse que as empresas se viam "sete anos à frente" do que esperavam antes da pandemia. [S, é fala em entrevista, não estudo]
- Uma pesquisa da KPMG com 950 executivos de empresas com receita acima de US$ 1 bilhão: todos disseram que a pandemia ajudou a ampliar o uso de IA em 2020. [S]
- **Efeito de médio prazo:** mais nuvem, mais dados digitais, trabalho remoto com ferramentas de texto e vídeo. Quando os modelos de linguagem chegaram, em 2022, os usuários e os dados já estavam lá.

### 3.3 A ciência que a pandemia acelerou
- O GPT-3 saiu em maio e junho de 2020 e o AlphaFold 2 em novembro de 2020, em plena pandemia. As vacinas de RNA também mostraram o poder da biologia computacional. [H]
- A pandemia deu à IA um caso de uso de vida ou morte e uma vitrine, com governos dispostos a financiar ciência rápida.

### 3.4 A falta de chips vira questão de Estado
- 2021: a falta de semicondutores para carros e eletrônicos mostrou que quase todos os chips avançados vinham de um só lugar, Taiwan. [H]
- Ago. 2022: a lei de chips dos EUA (CHIPS and Science Act), com cerca de US$ 52,7 bilhões para a fabricação. Out. 2022: os primeiros controles de exportação de chips de IA para a China. [H, conferir valores]
- **Efeito:** a IA passou a ser tratada como **segurança nacional**. Isso traz subsídio e compras do governo, mas também a corrida EUA e China, que justifica gastar "a qualquer preço".

### 3.5 O fim de outras bolhas liberou recursos para esta
- 2022: o fim do boom das criptomoedas e a mudança de uma das maiores redes de cripto para um sistema que não usa mineração liberaram GPUs, galpões e contratos de energia. Parte das atuais "neoclouds" (nuvens especializadas em IA) nasceu de antigas mineradoras de cripto. [H, conferir caso a caso]
- 2022: as ações de tecnologia caíram com a alta dos juros, e as empresas demitiram em massa. O ChatGPT chegou **no fundo desse mercado** e deu à tecnologia uma narrativa nova. É a "economia das narrativas" de Shiller em ação: a história anterior (metaverso, cripto) tinha acabado e o mercado precisava de outra.

### 3.6 Leitura para o livro
O choque extremo não gera a bolha sozinho. Ele **antecipa o futuro**: obriga a digitalizar, barateia o dinheiro e transforma uma tecnologia em prioridade de Estado. Quando a tecnologia certa aparece logo depois (ChatGPT, 2022), encontra a infraestrutura, os usuários e o capital prontos. É o mesmo papel que as guerras tiveram no rádio, na aviação e nos computadores.

---

## 4. Por que esta bolha é diferente (e o que é igual)

### 4.1 O que é diferente
1. **Quem paga, pelo menos no começo.** Na pontocom, empresas sem lucro viviam de IPO. Até 2024, o investimento em IA foi pago pelo caixa de empresas muito lucrativas. O BIS mostra a virada: em 2025 e 2026 o capex passou o fluxo de caixa livre e as empresas foram para a dívida (citacoes_conferidas, 4b). As cinco maiores emitiram **US$ 230 bilhões em títulos nos nove primeiros meses de 2026, mais que o dobro de 2025 inteiro**. [S] Em out. 2026, a dona da maior rede social teve, num trimestre, capex de US$ 34,9 bilhões acima do caixa operacional de US$ 32,8 bilhões, com fluxo de caixa livre negativo pela primeira vez em mais de uma década. [S]
2. **A adoção é real e rapidíssima.** 100 milhões de usuários em dois meses; 88% das organizações usam IA (AI Index 2026); a receita dos laboratórios cresce várias vezes por ano. Na pontocom, a adoção da internet era real, mas os modelos de negócio não. Aqui o produto existe; a dúvida é a margem.
3. **O custo marginal não é zero.** Software tradicional custa quase nada por cliente a mais. Cada resposta de IA gasta computação e energia. As margens dos laboratórios são muito menores que as do software clássico.
4. **O ativo envelhece rápido.** As ferrovias de 1847 e a fibra óptica de 2000 serviram por décadas depois do estouro; a fibra "escura" de 2001 virou a internet barata dos anos 2000. As GPUs perdem valor em 3 a 6 anos com a chegada de chips novos. Se houver estouro, sobra menos infraestrutura útil do que nas bolhas anteriores. Os prédios, as linhas de energia e as subestações ficam. [Análise; conferir as estimativas de depreciação]
5. **Há um limite físico.** Os data centers usaram cerca de 415 TWh em 2024 (1,5% da eletricidade mundial), e a projeção da IEA para 2030 é de 945 TWh, um pouco mais que o consumo atual do Japão. Os EUA respondem por 45% do consumo dos data centers. [F] A pontocom nunca esbarrou em energia; esta onda esbarra em transformadores, linhas de transmissão e licenças.
6. **A concentração na bolsa é maior.** As dez maiores ações do principal índice americano somam cerca de 39% a 41% do índice em 2025 e 2026, contra cerca de 26% em 2000. [S] Quem compra um fundo de índice "neutro" está muito exposto à IA sem saber.
7. **O financiamento é circular.** Fabricantes de chips investem nos laboratórios, que compram chips desses fabricantes e alugam nuvem de quem também é sócio. A maior fabricante de chips de IA anunciou investir US$ 30 bilhões no maior laboratório e garantir até US$ 105 bilhões de um data center dele; outra fabricante de chips dá proteção a cerca de US$ 43,5 bilhões de financiamento de outro laboratório. [S, segundo Reuters] A Morgan Stanley estima mais de US$ 3,1 trilhões em compromissos fora do balanço de sete grandes empresas de tecnologia. [S] **Rima com 1999:** os fabricantes de equipamentos de telecomunicações emprestavam dinheiro aos clientes para que comprassem seus próprios equipamentos; quando os clientes quebraram, os fabricantes foram juntos. [H]
8. **Boa parte do valor está fora da bolsa.** Os maiores laboratórios são privados. O risco chega ao poupador pelo crédito privado, pelos fundos de pensão e pela concentração do índice, não por IPOs de varejo como em 1999.
9. **É corrida de Estado.** EUA e China tratam a IA como segurança nacional. Isso sustenta o gasto mesmo sem retorno, mas também cria riscos próprios: a China teve **o próprio estouro**, com o índice das ações de IA e chips caindo cerca de 40% em menos de quatro meses e cerca de US$ 480 bilhões perdidos, segundo a Reuters (26/10/2026), enquanto o Nasdaq caiu cerca de 6%. [F]
10. **O peso na economia real.** Pelo ING, o investimento ligado à IA respondeu por cerca de um terço do crescimento dos EUA em 2026; pela medida mais ampla, cerca de metade no 2o trimestre. [F] A Bridgewater estima um impulso de cerca de 1,4 ponto percentual ao crescimento de 2026. [S] Mas data center emprega pouca gente depois de pronto e quase todo o custo é equipamento importado.

### 4.2 O que é igual (o Ciclo da Euforia de sempre)
- **A narrativa de nova era**, agora com nome: "inteligência artificial geral".
- **O FOMO** que Marks descreveu em 2000 e repetiu em 2025.
- **O capex acima do caixa** e a ida para a dívida, como nas ferrovias e nas telecomunicações.
- **O investimento excessivo enquanto a receita não chega:** a "pergunta de US$ 600 bilhões" da Sequoia (2024) cresceu para trilhões em compromissos.
- **O juro subindo no fim da festa.** Em 2000 o Fed subiu os juros até maio; em set. 2026 subiu pela primeira vez desde 2023, para 3,75% a 4%, por causa de um choque do petróleo (Brent perto de US$ 108). O título de dez anos dos EUA bateu 5,36% em 7/10/2026, o maior desde abril de 2002. [F]
- **A dúvida da produtividade.** O MIT (NANDA, jul. 2025) relatou que 95% das organizações não viram retorno mensurável em resultado com IA generativa, sobre US$ 30 bilhões a US$ 40 bilhões investidos; os autores chamam o número de retrato preliminar. [S] Acemoglu estima um ganho de produtividade pequeno em dez anos (citacoes_conferidas, 13a). [F]

### 4.3 A leitura pela teoria de Perez
Pelo esquema de Perez (citacoes_conferidas, 2), a revolução da informação começou em 1971 e teve a bolha dupla de 2000 e 2008. A IA pode ser lida de dois jeitos, e o livro deve apresentar os dois:
- **Leitura A:** a IA é a fase de **implantação** da revolução da informação, e a bolha é um excesso dentro da era de ouro dessa revolução. Seria um estouro menor, sem mudança de era.
- **Leitura B:** a IA é a **irrupção de uma sexta revolução**, junto com a energia limpa e a biotecnologia, e estamos no frenesi da instalação. Pelo padrão, viria um estouro grande, seguido de regulação e de uma era de ouro.
O livro não precisa escolher; pode usar os quatro cenários para mostrar as duas leituras.

---

## 5. Outros pontos que um profissional citaria

### 5.1 As leis de escala e o paradoxo de Jevons
- Treinar modelos de ponta usa cerca de 4 a 5 vezes mais computação a cada ano. [F]
- O custo de rodar um modelo com o mesmo desempenho cai muito depressa: o AI Index 2025 relatou uma queda de cerca de 280 vezes entre nov. 2022 e out. 2024 para o nível do GPT-3.5. [S, conferir no AI Index 2025]
- **Paradoxo de Jevons:** quando o carvão ficou mais eficiente no século XIX, o consumo total subiu, em vez de cair. A IA mais barata aumenta o uso total, o que defende o capex. Mas o preço por unidade despenca, o que aperta a margem de quem vende. As duas coisas são verdade ao mesmo tempo.

### 5.2 A economia dos modelos
- O modelo de ponta vira **commodity** depressa: a diferença entre o melhor modelo americano e o melhor chinês caiu para cerca de 2,7% em mar. 2026 (AI Index 2026). [F]
- Quem fica com a margem? Até agora, quem vende os chips e a energia (as "pás e picaretas" da corrida do ouro), não quem vende o modelo.

### 5.3 Energia, Brasil e geopolítica
- A matriz elétrica brasileira é mais de 80% renovável; os pedidos de conexão de data centers ao sistema elétrico somam 38 GW, dos quais 7,1 GW em projetos de cerca de R$ 159 bilhões (Ministério de Minas e Energia, jun. 2026). [S]
- O regime tributário especial para data centers (Redata) tem datas desencontradas entre as fontes. Uma diz que foi sancionado em 15/9/2026, com potencial de R$ 500 bilhões a R$ 1 trilhão em investimentos. [S, conferir no Diário Oficial]
- **Gancho para o leitor brasileiro:** como em 1971 e no Encilhamento, o Brasil entra na onda pela energia e pelo incentivo do governo; o risco é construir capacidade para uma demanda que pode encolher.

### 5.4 Os testes de estresse que já aconteceram
- **27/1/2025, o choque DeepSeek:** um laboratório chinês lançou um modelo barato e eficiente, e a maior fabricante de chips de IA perdeu US$ 593 bilhões de valor de mercado num só dia, queda de quase 17%, recorde de Wall Street (Reuters, dados LSEG); o índice de semicondutores caiu 9,2%. O mercado se recuperou nos meses seguintes. [F]
- **22/10/2026:** o Nasdaq caiu 2,6%, a maior queda diária desde junho, e o índice de semicondutores caiu 6,7%, depois que a dona da maior rede social anunciou ações sem direito a voto para pagar o investimento em IA. [S, segundo Reuters]
- **Out. 2026, o estouro chinês:** ver 4.1, item 9.

### 5.5 Quem está avisando (out. 2026)
- Em 7/10/2026, Ray Dalio disse que a IA é uma "bolha clássica" perto de estourar, citando juros em alta e a dívida que financia a IA. [F, Bloomberg]
- Em 20/10/2026, Ken Griffin disse que os investidores estão "almost certainly" numa bolha. [F, Bloomberg]
- Em 25 e 26/10/2026, o dono de um grande grupo de foguetes e de um laboratório de IA disse que mais de 200 neoclouds podem enfrentar "guppy-level death and consolidation", porque os credores relutam em financiar quem depende só da demanda de IA. [S, segundo Fortune e SiliconANGLE]
- Os investidores passaram a exigir juros maiores nos títulos ligados à infraestrutura de IA. [S, segundo Reuters]

### 5.6 Riscos que não são de mercado
- **Regulação:** a lei europeia de IA (2024), com obrigações escalonadas até 2026 e 2027. [H]
- **Direitos autorais:** processos de autores e jornais contra o uso de textos no treino. [H]
- **Trabalho:** 73% dos especialistas esperam impacto positivo no trabalho, contra 23% do público, uma distância de 50 pontos (AI Index 2026). [F]
- **Talento:** o número de pesquisadores de IA que se mudam para os EUA caiu 89% desde 2017, 80% só no último ano (AI Index 2026). [F]

---

## 6. Noticiário de julho a outubro de 2026 (item 4 do LEIA-ME)

| Data | Fato | Marca |
|---|---|---|
| ago. 2026 | ING: a IA responde por cerca de 1/3 do crescimento dos EUA em 2026 | [F] |
| 16/9/2026 | O Fed sobe os juros para 3,75% a 4%, a primeira alta desde 2023, com o petróleo em alta | [F] |
| 1o semestre 2026 | Um laboratório de IA relata receita de US$ 16,3 bilhões, contra US$ 1,1 bilhão um ano antes, e cerca de US$ 9 bilhões gastos em computação | [S] |
| 7/10/2026 | O título de dez anos dos EUA chega a 5,36%, o maior desde abr. 2002; Dalio fala em bolha | [F] |
| 20/10/2026 | Griffin: "almost certainly" uma bolha | [F] |
| 22/10/2026 | Nasdaq cai 2,6%; semicondutores caem 6,7% | [S] |
| 22/10/2026 | Relatório sobre "financiamento circular" diz que a IA está "primed to pop" | [S] |
| 26/10/2026 | Reuters: na China, a bolha da IA "já estourou" (índice −40%, US$ 480 bilhões) | [F] |
| 28/10/2026 | Próxima decisão do Fed, no mesmo dia dos resultados de duas gigantes da nuvem | [S] |

**Atenção:** o mês ainda não acabou. Refazer esta tabela antes de fechar os Cap. 10 e 11.

---

## 7. Sinais para o kit de diagnóstico (sem data de estouro)
1. Capex acima do caixa operacional das maiores empresas (já aconteceu em pelo menos uma, out. 2026).
2. Emissão de dívida e financiamento circular crescendo mais rápido que a receita.
3. Juros longos subindo e banco central apertando (5,36% no título de dez anos em out. 2026).
4. Concentração recorde no índice.
5. Prêmio de risco subindo nos títulos de infraestrutura de IA.
6. Quedas fortes de um dia por notícias de eficiência (DeepSeek) ou de financiamento (out. 2026).
7. Estouro num mercado vizinho (China, out. 2026), como o Japão em 1990 antes do resto.
8. Gente de dentro do setor falando em consolidação.

Usar como **termômetro**, nunca como previsão.

---

## 8. Lacunas a conferir antes de escrever
- Números exatos do AI Index 2026 no PDF (o investimento global de US$ 344,7 bilhões veio de resumos).
- A citação de Minsky à *Life* em 1970 e a de Simon em 1958, nos originais.
- O erro da AlexNet (15,3% contra 26,2%) no artigo de 2012.
- O orçamento do projeto japonês de Quinta Geração.
- O balanço do Fed de 2020 a 2022 (FRED, série WALCL).
- O valor da lei de chips dos EUA e a data dos controles de exportação.
- A data de sanção do Redata.
- As estimativas de depreciação das GPUs.
- O fechamento de outubro de 2026.

---

## 9. Fontes
**Conferidas [F]**
- Proposta de Dartmouth (1955), reimpressa na AI Magazine 27(4), 2006: https://ojs.aaai.org/index.php/aimagazine/article/view/1904/1802
- Relatório Lighthill (1973), resumo e cópias: https://en.wikipedia.org/wiki/Lighthill_report ; https://www.saildart.org/LIGHT2.REV[2,JMC]
- ALPAC (1966): https://en.wikipedia.org/wiki/ALPAC
- Perceptron e o *New York Times* de 8/7/1958: https://en.wikipedia.org/wiki/Perceptron
- Epoch AI, computação de treino: https://epoch.ai/blog/training-compute-of-frontier-ai-models ; https://epoch.ai/trends
- AI Index 2026 (Stanford HAI): https://hai.stanford.edu/ai-index/2026-ai-index-report
- UBS sobre o ChatGPT (Reuters, fev. 2023): https://business.inquirer.net/384799/chatgpt-sets-record-for-fastest-growing-user-base
- IEA, *Energy and AI* (abr. 2025): https://www.iea.org/reports/energy-and-ai/executive-summary
- DeepSeek e a perda de US$ 593 bilhões (Reuters, jan. 2025): https://finance.yahoo.com/news/chinas-deepseek-sets-off-ai-071458375.html
- ING, a IA no crescimento dos EUA: https://think.ing.com/downloads/pdf/opinion/how-much-is-ai-contributing-to-us-economic-growth
- Reuters, o estouro na China (26/10/2026): https://money.usnews.com/investing/news/articles/2026-10-26/analysis-in-china-the-ai-bubble-has-already-burst
- Bloomberg, Dalio (7/10/2026): https://www.bloomberg.com/news/articles/2026-10-07/ray-dalio-warns-ai-bubble-is-approaching-burst-point
- Bloomberg, Griffin (20/10/2026): https://www.bloomberg.com/news/articles/2026-10-20/ken-griffin-says-ai-almost-certainly-in-a-bubble-right-now
- CNBC, alta do Fed (16/9/2026): https://www.cnbc.com/2026/09/16/fed-rate-decision-september-2026.html
- Juro de dez anos e a queda de 22/10/2026: https://finance.yahoo.com/markets/stocks/articles/10-yield-just-fell-below-111507754.html ; https://www.marketscreener.com/news/s-p-500-nasdaq-end-lower-as-revived-ai-doubts-spark-tech-selloff-ce785cdede8bf720

**Secundárias [S]**
- Capex de 2026: https://www.tmtfinance.com/intel/2026-hyperscaler-capex-tops-us700bn-analysis ; https://know.creditsights.com/insights/tech-raising-hyperscaler-capex-2026-estimates/
- Dívida e financiamento circular: https://biz.heraldcorp.com/article/10916568 ; https://phys.org/news/2026-10-paying-circular-money-machine-ai.html ; https://asiatimes.com/2026/10/report-says-circular-financing-shows-ai-bubble-primed-to-pop/
- Neoclouds: https://fortune.com/2026/10/26/elon-musk-ai-boom-debt-neoclouds ; https://siliconangle.com/2026/10/25/elon-musk-predicts-neocloud-shakeout-as-credit-for-ai-infrastructure-dries-up
- Receita e compromissos dos laboratórios: https://www.fool.com/investing/2026/10/24/anthropics-revenue-surged-to-163-billion-in-the-fi/ ; https://newmarketpitch.com/blogs/news/frontier-ai-labs-openai-compute-costs
- Concentração do índice: https://chartrow.com/visuals/index-concentration ; https://walnutinvest.com/stats/market-concentration-statistics
- MIT NANDA, *The GenAI Divide* (2025): https://www.theregister.com/2025/08/18/generative_ai_zero_return_95_percent
- Pandemia e IA: https://forklog.com/en/news/study-finds-pandemic-accelerated-deployment-of-ai-systems-across-businesses ; https://venturebeat.com/business/ai-startup-funding-remained-strong-in-q2-report-finds ; https://ciotechasia.com/ai-venture-capital-investment-nears-2019-historical-high/ ; https://www.qed42.com/insights/how-covid-19-pandemic-accelerated-cloud-adoption
- Segundo inverno: https://www.holloway.com/g/making-things-think/sections/the-second-ai-winter-19871993
- Bridgewater: https://www.bridgewater.com/research-and-insights/the-macro-implications-of-the-ai-capex-boom
- Petróleo e Fed: https://inflationdata.com/articles/2026/09/17/fed-raises-rates-into-oil-inflation-shock/
- Brasil e data centers: https://agenciainfra.com/blog/data-centers-tem-pedidos-de-38-gw-e-r-159-bi-em-investimentos-diz-mme/ ; https://www.datacenterdynamics.com/br/an%C3%A1lises/brasil-se-prepara-para-a-ia-energia-redata-e-a-corrida-para-transformar-potencial-em-capacidade-instalada/
