# Frente Arquitetura: a Arcologia com a régua dos megaprojetos reais

Data: 27/09/2026. Pedido do dono: sair da estética SimCity BuildIt, Torre retangular de alto luxo no lugar do bolo,
Arcologia com grandiosidade e magnitude sem a forma "quadrada e robótica", Cities: Skylines II (CS2) como régua de
qualidade e megaprojetos reais como exemplo para cada tipo de construção.

Como li o projeto: `docs/VISAO.md`, `fonte/data/planta.js` (medidas P, A, ALT, TORRE), `fonte/render/models/faixa.js`,
`aneis.js`, `centro.js`, `campus.js`, `biblioteca.js`, `cupula.js`, `leste.js`, `praca.js`, `plano.js`, `jogo.js`
(obra dos módulos), `materials.js` (pintura do jogador) e as capturas em `scratchpad/trevo/int/`.

Medições feitas agora (script `scratchpad/cs2/mede-atual.mjs`, Node, sem navegador; e `enquadra.mjs` para a câmera):

- As 12 fitas no nível máximo somam **152 mil triângulos** (anel 30,6 mil; sede 19,4 mil; santuário 21,7 mil; escola
  20,5 mil; anelBib 18,9 mil; o resto entre 4 e 9 mil). Biblioteca 10 mil, acelerador 9,5 mil.
- Robô com a cidade, qualidade Leve: 76 chamadas e 386 mil triângulos (`trevo/int/robo.log`).
- Câmera padrão (`VISTA_FOTO`: dist 78, inclinação 0,66 rad = 38 graus, fov 34): o topo de um prédio no centro do lago
  cabe na tela até **21 a 22 unidades** de altura. Com 26 ele sai pelo alto (tabela na seção 9).

Nota sobre as fontes: a busca na web funcionou; o WebFetch foi bloqueado pelo proxy na maior parte dos sites
(Wikipedia, KPF, Structure). Os números citados vêm dos resumos das páginas listadas em cada seção.

---

## 0. Resultado em uma página

1. **A Torre vira a "Torre Lâmina":** prisma retangular de 3,2 x 4,4, com 26,0 de altura até o heliponto (52
   pavimentos de 0,5) e mastro até 27,6. A face sul (a da câmera) recua em quatro "penas" com terraços-jardim. Três
   andares de vento vazados dividem o corpo em quatro blocos (três de 12 pavimentos e um de 6). Aletas verticais
   de bronze, costura dourada, coroa-lanterna acesa à noite e heliponto em balanço sobre o lago. Referências: One Vanderbilt, 111 West 57th,
   432 Park Avenue e o Edge do 30 Hudson Yards.
2. **Hierarquia em quatro degraus.** A Torre (26) é o único pico. Depois vêm as duas Torres do Conselho nos tambores
   NO e NE (12) e os marcos de 6,5 a 7,5 (Biblioteca, Cúpula da Vida, laboratórios da Universidade). Por último, as
   fitas de 1,5 a 6,0, com alturas diferentes em cada trecho. Hoje tudo fica entre 3,5 e 4,4, e a Torre tem 14.
3. **Fim das listras.** Cada face ganha uma tipologia própria. Por fora, a face é urbana: cortina de vidro com
   montantes verticais, moldura de pedra de dois pavimentos (Bloomberg) e caixas salientes (Tietgen, Habitat 67). Por
   dentro, voltada ao lago e aos miolos, ela é um vale verde em terraços a cada dois pavimentos (Marina One, Parkroyal,
   Bosco Verticale). A floreira e o beiral branco em todo pavimento acabam.
4. **Cada módulo vira um prédio.** Os módulos por nível da mecânica continuam: anel 8, uni 4, anelBib 3, casas 6 e
   santuário 5. Cada um tem perfil de altura próprio, com teto em degraus. Uma fenda de vidro separa os módulos, as
   coroas aparecem no nível máximo e pontes de vidro ligam dois módulos quando os dois chegam ao máximo. Para isso, a
   Faixa passa a separar **nível da mecânica** de **andares da geometria**.
5. **O Anel Mestre vira um anfiteatro voltado para a câmera.** Ele é baixo no portal sul (3,0: abre a vista do eixo
   até a Torre) e sobe até 6,0 nas pontas norte, onde encosta nas Torres do Conselho. Visto do sul, lê como o skyline
   em volta de uma baía (Marina Bay), com a Torre no meio e refletida no lago.
6. **O plano do Trevo fica.** Mesa 80 x 62, Anel, nós, folhas, eixo e lago, com todas as posições vindas de `A`.
   Mudam três coisas: as alturas (`ALT_` e a nova tabela de perfis), o bloco `TORRE` e a câmera padrão (inclinação de
   29 graus e alvo erguido a 5; com ela o topo da Torre de 26 cai a 78% do caminho entre o centro e a borda de cima
   da tela). Saves, ids de projetos, etapas e módulos não mudam.
7. **Custo.** A Arcologia inteira fica em cerca de 140 mil triângulos na Média e 235 mil no Ultra, sem contar a
   vegetação instanciada. Hoje são mais de 185 mil só nas partes que medi. A cortina de vidro gasta menos
   que o terraço de hoje, e essa economia paga as torres. Materiais novos: vidro de cortina, pedra, bronze e
   vidro-lanterna (4), sempre fundidos por material.
8. **Onze parcelas** (seção 12), a começar pela Torre, que é a maior queixa e a mais visível. Cada parcela tem captura
   de aceite, `engine.stats`, os testes de junta (`teste-planta`, `conexoes`) e o robô.

---

## 1. Diagnóstico: por que parece "quadrado, robótico e BuildIt"

Olhando `m-alta-foto.png`, `b1-torre.png`, `b5-praca.png`, `b6-uni.png`, `b3-bib.png`, `b4-vida.png` e `c6-noite.png`:

| Sintoma | Causa no código | Efeito na tela |
|---|---|---|
| Listras horizontais em tudo | a seção de `terraceFloor` repete beiral branco, vidro recuado e floreira verde **em cada pavimento de 0,5**, em todas as 12 fitas e nos 4 tambores | a Arcologia lê como código de barras, sem escala: um pavimento de 4 m e um bloco de 40 m parecem iguais |
| Tudo da mesma altura | `ALT_`: fitas de 1,5 a 4,4; a Torre com 14 é só 3 vezes a fita e 1,9 vez o Residencial de Luxo da cidade (7,3) | silhueta chata, sem skyline; da câmera padrão é um tapete |
| Torre em bolo de noiva | `TORRE.camadas`: 4 cilindros de 24 lados que diminuem, cada um com terraço-jardim e friso dourado | lê como bolo ou farol, não como sede de holding |
| Tambores em bolo | `tamborNiveis`: rotundas de anéis empilhados | quatro "bolos" menores em volta do grande |
| Paleta de maquete | branco creme, verde de grama saturado no teto, âmbar | tudo tem o mesmo valor de luz; não há vidro escuro, pedra, metal |
| Chão e água sem cerimônia | todo prédio pousa igual, sem pódio, sem pilotis alto, sem degraus até a água | falta a "base" que dá peso aos megaprojetos |
| Guarda-corpos coloridos (Escola), telhado de duas águas (Vila), obelisco com guarda-chuva (Praça) | decoração de brinquedo | é o vocabulário do BuildIt que o dono pediu para abandonar |

O que já está bom e fica: o traçado do Trevo (anel em volta do lago, Torre no centro, quatro folhas, eixo), a Cúpula
fechada sem bichos à vista, a ideia de jardim e o lago como coração.

---

## 2. O que torna grandiosos os megaprojetos pesquisados

Cada item traz o que copiar (proporção, massa, fachada, coroa, base, encontro com o chão ou a água, materiais e luz à
noite), com as fontes.

### 2.1 Torres de luxo e marcos únicos

- **432 Park Avenue (Rafael Viñoly):** planta quadrada de 28,5 m e 425,5 m de altura, esbeltez 1:15. A fachada é só
  uma grade de concreto branco aparente com janelas de cerca de 3 x 3 m, seis por face em cada andar. O corpo tem 96
  andares, em blocos de 12 separados por andares técnicos duplos **vazados** (o vento atravessa). Lição: a disciplina
  de uma forma só; a grande escala vem da repetição de janelas grandes, e os vãos escuros cortam a altura em blocos.
  Fontes: https://www.skyscraper.org/supertall/building/432-park-avenue/ ,
  https://archeyes.com/432-park-avenue-by-rafael-vinoly-minimalism-in-the-new-york-skyline/ ,
  https://www.skyscrapercenter.com/building/432-park-avenue/13227 ,
  https://www.vinoly.com/works/432-park-avenue/
- **111 West 57th / Steinway Tower (SHoP):** base de 18 x 23 m, 435 m de altura, esbeltez 1:24. Face norte reta até
  o topo e face sul recuando em "penas" (feathered), não em degraus grossos. Terracota em 26 perfis e 6 cores, com
  filigrana de bronze. Lição: recuos finos numa face só, e textura vertical de material quente.
  Fontes: https://jdsdevelopment.com/portfolio/111-west-57th-street ,
  https://newyorkyimby.com/2020/09/111-west-57th-streets-terracotta-and-bronze-facade-reaches-crown-as-completion-nears-in-midtown.html ,
  https://www.re-thinkingthefuture.com/case-studies/steinway-tower-the-worlds-thinnest-skyscraper/
- **One Vanderbilt (KPF):** quatro volumes que se encaixam e afinam em espiral até a coroa em degraus inclinados, com
  agulha acesa. Tímpanos de terracota canelada na cortina de vidro. Na base, cortes em ângulo abrem a vista para a
  Grand Central. Lição: volumes intertravados dão movimento a um prisma, a coroa é desenhada e a base conversa com o
  vizinho. Fontes: https://www.kpf.com/project/one-vanderbilt ,
  https://www.designboom.com/architecture/one-vanderbilt-new-york-skyscraper-kpf-09-14-2020/ ,
  https://www.aisc.org/awards-and-competitions/ideas2-awards/ideas2-awards-archives/one-vanderbilt/
- **Central Park Tower (Adrian Smith + Gordon Gill):** 472 m, com um balanço de 8,5 m a 88 m do chão para liberar a
  vista do parque. Lição: um só gesto de balanço, bem colocado, vira assinatura.
  Fontes: https://www.smithgill.com/work/central_park_tower/ ,
  https://www.dezeen.com/2019/09/24/central-park-tower-adrian-smith-gordon-gill-architecture-tops-out/
- **30 Hudson Yards, Edge (KPF):** mirante triangular em balanço de 24 m no 100º andar, com vidro inclinado 9 graus e
  piso de vidro. Lição: uma plataforma que sai do prisma no alto faz a silhueta. Fontes:
  https://www.kpf.com/project/edge , https://www.sbp.de/en/project/30-hudson-yards-observation-deck-edge/ ,
  https://www.archpaper.com/2020/03/the-edge-debuts-1000-feet-above-hudson-yards/
- **Lotte World Tower (KPF):** 555 m. Afunila numa massa convexa e tensa (pincel de caligrafia), em vidro prateado
  com filigrana de metal branco. **Uma costura vertical** percorre a altura inteira, apontada para o centro histórico.
  Lição: a costura dá direção e esbeltez com custo zero de massa. Fontes: https://www.kpf.com/project/lotte-world-tower ,
  https://www.designboom.com/architecture/lotte-world-tower-seoul-kpf-kohn-pedersen-fox-associates-04-14-2017/
- **Torre Reforma (L. Benjamín Romano):** 246 m, com duas paredes de concreto aparente (concretado em faixas de
  70 cm) e uma terceira face de vidro com tirantes em V duplo. Planta triangular. Lição: duas faces cegas e uma
  aberta, contraste de material. Fontes:
  https://www.dezeen.com/2016/07/27/lbra-arquitectos-torre-reforma-concrete-glass-skyscraper-mexico-city-tallest-building/ ,
  https://www.international-highrise-award.com/en/best-high-rises/20182019/torre-reforma/
- **Lakhta Center (Gorproject, RMJM):** 462 m. Estrela de cinco pontas que gira 90 graus e afina, com 16.505 painéis
  de vidro curvados a frio. Lição: a torção reduz o vento e dá brilho contínuo; é cara em geometria.
  Fontes: https://www.studiomatrx.org/guides/lakhta-center ,
  https://www.lightmetalage.com/news/industry-news/applications-design/tallest-skyscraper-in-europe-constructed-with-aluminum-facade/
- **Burj Khalifa (SOM):** 828 m. Planta em Y (a flor Hymenocallis) com 27 recuos em espiral e terraços, terminando
  numa agulha de aço. Lição: é a régua de altura, e o recuo em espiral leva o olho até o topo.
  Fontes: https://www.som.com/projects/burj-khalifa/ , https://www.burjkhalifa.ae/the-tower/architecture-design/
- **The Spiral (BIG, Hudson Yards):** 66 andares com terraços ajardinados que sobem em espiral em volta da torre, uma
  fita verde contínua. Lição: jardins altos visíveis de longe, sem listrar a torre inteira.
  Fontes: https://www.archpaper.com/2023/12/big-the-spiral-glass-tower-wrapped-climbing-balconies/ ,
  https://www.6sqft.com/bjarke-ingels-the-spiral-office-tower-opens-hudson-yards/
- **Salesforce Tower (Pelli Clarke Pelli):** a coroa de 40 m é oca, revestida de alumínio perfurado, com 11 mil LEDs
  que mostram imagens em baixa resolução à noite, visíveis a 30 km. Lição: a coroa vira luminária da cidade.
  Fontes: https://www.archpaper.com/2018/05/salesforce-towers-massive-light-show-permanently-illuminate-san-franciscos-skyline/ ,
  https://salesforcetower.com/artwork/
- **53W53 (Jean Nouvel):** diagrid de concreto na fachada e faces que se inclinam até vários picos, com gradiente de
  cor até o dourado e o prateado nos mais altos. Lição: o topo pode ser um feixe de pontas.
  Fontes: https://www.dezeen.com/2018/06/19/jean-nouvel-53w53-tower-supertall-skyscraper-tops-out-over-moma-new-york-city/ ,
  https://www.wsp.com/en-gl/projects/53w53

### 2.2 Sedes corporativas

- **Apple Park (Foster + Partners):** um anel de 461 m de diâmetro e 4 andares, envolto nos maiores painéis de vidro
  curvo já feitos, num pomar. Lição: uma forma só, contínua, com o paisagismo fazendo metade do trabalho. Fontes:
  https://www.studiomatrx.org/guides/apple-park , https://www.archdaily.com/871559/the-spaceship-has-landed-apples-new-campus-opens
- **Bloomberg London (Foster + Partners):** moldura estrutural de arenito formando aberturas de **dois andares**, com
  250 aletas verticais de bronze que variam de passo e densidade conforme o sol. Lição: ritmo vertical nobre, pedra e
  bronze, com a escala do vão duplo. Fontes:
  https://www.dezeen.com/2017/10/04/norman-fosters-bloomberg-european-headquarters-london-worlds-most-sustainable-office/ ,
  https://archeyes.com/bloombergs-european-headquarters-by-foster-partners/
- **Google Bay View (BIG + Heatherwick):** três pavilhões em tenda com cobertura em "escamas de dragão" (50 mil
  painéis solares prateados) e janelas altas entre as abóbadas. Lição: a cobertura é a fachada vista de cima, e a
  câmera do jogo olha de cima. Fontes: https://www.dezeen.com/2022/05/18/google-bay-view-campus-big-heatherwick-studio/ ,
  https://www.archpaper.com/2022/09/heatherwick-studio-big-transform-swiss-solar-shingles-barn-bay/
- **Tencent Seafront Towers (NBBJ):** duas torres de 50 e 39 andares (250 e 192 m), com alturas desencontradas e
  ligadas por três pontes de convivência, como um "campus vertical". Lição: par de torres desiguais com pontes.
  Fontes: https://www.designboom.com/architecture/nbbj-tencent-seafront-towers-shenzhen-china-04-12-2018/ ,
  https://www.thorntontomasetti.com/project/tencent-seafront-towers
- **Amazon Spheres (NBBJ):** três esferas de 24 a 29 m que se cruzam, em painéis de hexecontaedro pentagonal, com 40
  mil plantas. Lição: vidro em forma pura ao lado das torres. Fontes:
  https://www.architecturalrecord.com/articles/13227-amazon-spheres-by-nbbj-open-in-seattle ,
  https://www.archpaper.com/2018/08/amazons-glass-spheres/
- **Eixo Monumental e Esplanada (Lúcio Costa, Niemeyer, Burle Marx):** eixo de 250 m de largura com gramado central
  e 17 ministérios em fila, terminando no Congresso. Lição para Heldópolis (modernismo tropical): o eixo gramado e
  largo, a repetição serena e o palácio no fim. Fontes: https://pt.wikipedia.org/wiki/Eixo_Monumental ,
  https://visitebrasilia.com.br/turismo/esplanada-dos-ministerios

### 2.3 Moradia em anel, em folhas e em fitas

- **The Interlace (OMA, Ole Scheeren):** 31 blocos de 6 andares, todos do mesmo comprimento, empilhados em hexágono
  em volta de 8 pátios, com três picos de 24 andares. Lição: blocos simples cruzados fazem montanha; "mora-se num
  pátio, não num prédio". Fontes: https://www.designboom.com/architecture/oma-ole-scheeren-the-interlace-singapore-06-27-2014/ ,
  https://buro-os.com/projects/the-interlace
- **Marina One (Ingenhoven):** quatro torres de 139 a 200 m. **Por fora seguem a grade da cidade; por dentro, um vale
  verde livre em 3D** (o Green Heart), com fitas de brise em curva como arrozais. Lição central para o Anel: face
  externa rigorosa e face interna em vale. Fontes: https://www.archdaily.com/886215/green-heart-marina-one-singapore-ingenhoven-architects ,
  https://www.dezeen.com/2017/11/10/multi-storey-gardens-marina-one-development-ingenhoven-architects-gustafson-porter-bowman-singapore/
- **Habitat 67 (Moshe Safdie):** 354 módulos pré-moldados empilhados como pixels, cada apartamento com jardim no teto
  do vizinho. Lição: caixas desencontradas dão escala humana a uma megaestrutura; é a Vila Estudantil ("casas brancas
  empilhadas"). Fontes: https://www.designboom.com/architecture/for-everyone-a-garden-moshe-safdie-habitat-67-50-years-on-08-28-2021/ ,
  https://archeyes.com/habitat-67-by-safdie-architects-a-visionary-experiment-in-modular-housing/
- **8 House (BIG):** planta em oito com a cobertura que sobe e desce nas quinas, uma rampa contínua de pedestres e
  bicicletas até o 10º andar e dois telhados verdes inclinados que ligam o prédio ao campo. Lição: a fita pode descer
  até o chão. Fontes: https://www.dezeen.com/2010/10/22/8-house-by-big-2/ , https://www.architecturalrecord.com/articles/7867-house
- **VIA 57 West (BIG):** o "courtscraper", quarteirão europeu com uma quina puxada para o céu: face sul em paraboloide
  hiperbólico, retas que viram superfície torcida. Lição: um teto inclinado muda tudo, e dá para fazer com painéis
  planos. Fontes: https://archeyes.com/via-57-west-by-big-the-courtscraper-in-manhattans-skyline/ ,
  https://architizer.com/blog/practice/materials/via-57-big/
- **Bosco Verticale (Stefano Boeri):** 800 árvores de 3, 6 e 9 m em varandas de concreto de 3,35 m em balanço,
  desencontradas, com vasos de 1,10 m. Lição: poucos terraços profundos com árvores de verdade, em vez de muitas
  floreiras rasas. Fontes: https://www.stefanoboeriarchitetti.net/en/project/vertical-forest/ ,
  https://www.architectsjournal.co.uk/buildings/bosco-verticale-by-stefano%E2%80%86boeri-architetti
- **Kampung Admiralty (WOHA):** "sanduíche" de funções empilhadas (praça, centro médico, parque comunitário em
  terraços no teto), com limite de 45 m. Lição: o teto em degraus verdes é um parque. Fontes:
  https://woha.net/project/kampung-admiralty/ , https://www.dezeen.com/2018/12/07/kampung-admiralty-woha-singapore-world-building-year/
- **Oasia Hotel Downtown (WOHA):** torre de malha de alumínio vermelho coberta por 21 espécies de trepadeiras, com
  jardins suspensos em varandas urbanas a cada estrato. Lição: uma pele que é vegetação e cor ao mesmo tempo.
  Fontes: https://www.designboom.com/architecture/woha-oasia-hotel-downtown-singapore-living-tower-12-07-2016/ ,
  https://www.architectural-review.com/buildings/oasia-downtown-singapore-by-woha
- **PARKROYAL on Pickering (WOHA):** pódio esculpido em curvas de nível com vales, grotas e cascatas, e jardins suspensos
  em prateleiras em balanço **a cada 4 andares**. Lição: o intervalo de jardim a cada 4 pavimentos tira a listra e dá
  escala. Fontes: https://www.dezeen.com/2013/10/10/parkroyal-on-pickering-by-woha/ ,
  https://archello.com/project/parkroyal-on-pickering-singapore
- **Marina Bay Sands (Safdie):** três torres de 55 a 57 andares (cerca de 191 m) com o SkyPark de 340 m por cima e um
  balanço de 66,5 m. Lição: a ligação no alto transforma três torres num portal. Fontes:
  https://www.arup.com/en-us/projects/marina-bay-sands-integrated-resort/ , https://www.studiomatrx.org/guides/marina-bay-sands
- **Raffles City Chongqing, The Crystal (Safdie):** um "arranha-céu horizontal" de 300 m a 250 m do chão, ligando
  quatro torres, em estrutura sanfonada de vidro e alumínio. Lição: pontes de vidro entre torres do anel. Fontes:
  https://www.dezeen.com/2020/06/25/safdie-architects-the-crystal-raffles-city-chongqing-architecture/ ,
  https://www.safdiearchitects.com/projects/raffles-city-chongqing
- **Pinnacle@Duxton:** sete torres de 50 andares ligadas no 26º e no 50º por jardins-ponte contínuos de 500 m. Lição:
  a fita no alto ligando torres (o passeio no teto do jogo pode subir de nível). Fontes:
  https://www.nlb.gov.sg/main/article-detail?cmsuuid=65771d77-a3e8-4d46-963d-7d3d70501fcf , http://www.pinnacleduxton.com.sg/
- **Tietgen Dormitory (Lundgaard & Tranberg):** moradia estudantil **circular** em volta de um pátio, com 360 quartos
  na borda externa em caixas que avançam e recuam, dando o aspecto cristalino. Lição direta para o Anel: um cilindro
  ganha vida com caixas salientes alternadas. Fontes: https://www.archdaily.com/474237/tietgen-dormitory-lundgaard-and-tranberg-architects ,
  https://archello.com/project/tietgen-dormitory
- **Punggol Waterway Terraces:** blocos em planta hexagonal ligada que descem em terraços até o canal, com fitas
  onduladas de varandas como brise. Lição: descer até a água em degraus. Fontes:
  https://www.archdaily.com/787479/punggol-waterway-terraces-group8asia ,
  https://www.urbanstrategies.com/project/punggol-masterplan-the-sustainable-waterfront-town-in-the-tropics/
- **Forest City (Sasaki):** quatro ilhas artificiais com verde vertical em todos os prédios e mangues recompostos na
  borda. Lição e alerta: verde em tudo vira papel de parede; o verde precisa de volume e lugar. Fontes:
  https://www.archdaily.com/781247/sasakis-forest-city-master-plan-in-iskandar-malaysia-stretches-across-4-islands ,
  https://futuresoutheastasia.com/forest-city/

### 2.4 Escola, universidade, biblioteca, ciências

- **Tianjin Binhai Library (MVRDV):** estantes em terraços que abraçam uma esfera luminosa de 21 m (o "olho") e
  continuam na fachada como brises. Lição: um objeto luminoso visto por uma grande abertura. Fontes:
  https://www.mvrdv.com/projects/246/tianjin-binhai-library ,
  https://www.dezeen.com/2017/11/04/mvrdv-tianjin-binhai-public-library-giant-eye-china-winy-maas/
- **Qatar National Library (OMA):** duas placas quadradas de 138 m, afastadas e dobradas na diagonal; o perfil
  externo é um diamante e as quinas levantadas formam terraços de livros. Lição: uma placa dobrada faz um marco
  baixo e largo. Fontes: https://www.archdaily.com/892727/qatar-national-library-oma ,
  https://www.dezeen.com/2018/04/19/oma-qatar-nation-library-architecture-doha/
- **Seattle Central Library (OMA):** plataformas deslocadas em balanço de até 16 m, dentro de uma pele de vidro em
  malha de losangos. Fontes: https://www.spl.org/hours-and-locations/central-library/central-library-highlights/central-library-architecture ,
  https://www.mka.com/projects/seattle-central-library/
- **Rolex Learning Center (SANAA, EPFL):** uma laje única ondulada de 20 mil m² com 14 pátios arredondados; a
  paisagem é o prédio. Fontes: https://www.dezeen.com/2010/02/17/rolex-learning-center-by-sanaa/ ,
  https://arquitecturaviva.com/works/epfl-rolex-learning-center-1
- **Harvard Science and Engineering Complex (Behnisch):** pele de aço inox hidroformado de 1,5 mm sobre os
  laboratórios, leve como tecido. Fontes: https://behnisch.com/work/projects/0274 ,
  https://www.dezeen.com/2022/03/21/hydroformed-steel-lattice-harvard-building-behnisch-architekten/
- **Stanford Science and Engineering Quad (Pei Cobb Freed, Hargreaves):** arcadas livres de aço, pedra e tecido que
  unem os prédios; painéis solares nos tetos. Fontes: https://www.pcf-p.com/projects/science-and-engineering-quad-stanford-university/ ,
  https://www.hargreaves.com/work/stanford-university-science-and-engineering-quad/
- **NTU Learning Hub, The Hive (Heatherwick):** 12 torres afuniladas de salas redondas em volta de um átrio. Alerta:
  lê como cesto de dim sum, isto é, como bolo; não usar. Fonte:
  https://www.dezeen.com/2015/03/10/thomas-heatherwick-textured-tower-balconies-cpg-consultants-learning-hub-nanyang-technological-university-singapore/
- **Crystal Bridges (Safdie):** pavilhões de concreto e cedro com cobertura de cobre, dois deles em ponte sobre
  lagos represados, suspensos por cabos. Lição: prédio que atravessa a água. Fontes:
  https://www.safdiearchitects.com/projects/crystal-bridges-museum-of-american-art ,
  https://www.architecturalrecord.com/articles/7878-crystal-bridges-museum-of-american-art

### 2.5 Cúpula da Vida e estufas

- **Jewel Changi (Safdie):** vidro e aço em **toro** (rosquinha) com 9 mil painéis, todos diferentes, e o Rain Vortex
  de 40 m caindo por um óculo no topo. Lição: forma lisa e contínua, um evento de água no centro e o espetáculo de luz
  à noite. Fontes: https://www.safdiearchitects.com/projects/jewel-changi-airport ,
  https://www.dezeen.com/2019/04/12/jewel-changi-airport-singapore-safdie-architects-waterfall/
- **Gardens by the Bay (WilkinsonEyre, Grant Associates):** Flower Dome e Cloud Forest em gridshell com arcos
  externos radiais; 18 Supertrees de 25 a 50 m acesos à noite; OCBC Skyway de 128 m a 22 m do chão entre duas
  Supertrees. Fontes: https://www.atelierten.com/articles/in-depth-gardens-by-the-bay/ ,
  https://www.designboom.com/architecture/wilkinson-eyre-singapore-gardens-by-the-bay/ ,
  https://www.gardensbythebay.com.sg/en/things-to-do/attractions/ocbc-skyway.html
- **Eden Project (Grimshaw):** bolhas geodésicas de hexágonos de ETFE (o maior com 11 m) que se cruzam, com vãos de
  até 130 m. Lição: hexágonos grandes em vez de triângulos miúdos. Fontes:
  https://grimshaw.global/projects/culture-and-exhibition/the-eden-project-the-biomes/ ,
  https://www.edenproject.com/mission/architecture

### 2.6 Acelerador e Centro de Física

- **CERN Science Gateway (Renzo Piano):** dois tubos de aço de 10 m de diâmetro e 80 m de comprimento (espelho do
  túnel do LHC), uma ponte a 6 m sobre a estrada, 4 mil m² de painéis solares e uma mata de 400 árvores. Fontes:
  https://home.cern/news/news/cern/cern-science-gateway-architecture-service-knowledge ,
  https://www.rpbw.com/project/cern-science-gateway-building , https://www.arup.com/en-us/projects/cern-science-gateway/
- **ESO Supernova (Bernhardt + Partner):** duas cascas curvas de concreto, uma estrela binária prestes a explodir,
  sem painel repetido. Fonte: https://supernova.eso.org/about/architecture/
- **ITER:** Complexo Tokamak de 120 x 80 m com teto a 60 m, e o Salão de Montagem de 60 m de altura. Lição: a massa
  cega industrial também impressiona. Fontes: https://www.iter.org/project/projects-underway/tokamak-complex ,
  https://www.iter.org/construction/TKMAssemblyHall
- **MAX IV (FOJAB, paisagem de Snøhetta):** anel de 528 m cercado por ondas de terra desenhadas pelo comprimento da
  vibração do tráfego. Lição: a paisagem em ondas em volta do anel é o próprio monumento. Fontes:
  https://www.snohetta.com/projects/max-iv-laboratory-landscape-2 ,
  https://www.wallpaper.com/architecture/good-vibrations-snhetta-max-iv-laboratory-landscape-design-unveiled

### 2.7 Praça, eixo, colunata, pontes e passarelas

- **Praça de São Pedro (Bernini):** 284 colunas dóricas de 17 m em **quatro fileiras**, em dois hemiciclos que abraçam
  uma elipse de 340 x 240 m. Dos focos, as quatro fileiras parecem uma só. Fontes:
  https://www.basilicasanpietro.va/en/san-pietro/the-square ,
  https://archeyes.com/st-peters-square-by-bernini-baroque-spatial-composition-in-vatican-city/
- **Vessel (Heatherwick):** 154 lances de escada e 80 patamares num favo de 46 m, com a base de 15 m e o topo de 46 m,
  aço pintado por fora e liga cor de cobre por baixo. Fontes: https://heatherwick.com/project/vessel/ ,
  https://www.architecturalrecord.com/articles/13967-vessel-has-landed-heatherwicks-sculptural-structure-opens-at-hudson-yards
- **High Line (Field Operations, DS+R, Oudolf):** pranchas pré-moldadas com juntas abertas, cujas pontas afinadas
  "penteiam" os canteiros; gradiente de 100% piso a 100% planta. Fontes: https://architizer.com/projects/high-line/ ,
  https://archeyes.com/the-high-line-in-new-york-by-diller-scofidio-renfro-james-corner-field-operations-and-piet-oudolf/
- **Helix Bridge (Cox, Arup):** 280 m em dupla hélice de tubos de aço inox (6 externos e 5 internos), com fitas de
  LED à noite. Fonte: https://www.coxarchitecture.com.au/project/the-helix-bridge/
- **Superkilen (BIG, Topotek 1, Superflex):** parque linear em três zonas de cor (praça vermelha, mercado preto,
  parque verde). Lição: pisos com identidade forte e objetos de lugar. Fontes:
  https://www.topotek1.de/openSpaces/superkilen-2/ ,
  https://the.akdn/en/how-we-work/our-agencies/aga-khan-trust-culture/akaa/superkilen
- **Ópera de Oslo (Snøhetta):** teto caminhável de mármore de Carrara que sobe do fiorde como geleira. Lição: prédio
  público que nasce da água como praça inclinada. Fontes: https://www.snohetta.com/projects/norwegian-national-opera-and-ballet ,
  https://www.archdaily.com/440/oslo-opera-house-snohetta

### 2.8 Anfiteatro, estádio, lago e canais

- **Estádio Mané Garrincha (Castro Mello, gmp, sbp):** 288 pilares de concreto de 1,2 a 1,5 m de diâmetro formam um
  peristilo que segura um anel de cobertura com usina solar de 2,5 MW. Lição: colunata em anel mais cobertura
  flutuante, em linguagem brasiliense. Fontes: https://www.archdaily.com/pt//623873/estadio-nacional-de-brasilia-mane-garrincha-castro-mello-arquitetos ,
  https://www.gmp-arquitetos.com/projetos/estadio-nacional-brasilia-mane-garrincha
- **Auditório Ibirapuera (Niemeyer):** volume branco com a marquise vermelha "Labareda" e uma porta de 20 m no fundo
  do palco que abre para uma plateia de 15 mil no parque. Fontes: https://pt.wikipedia.org/wiki/Audit%C3%B3rio_Ibirapuera ,
  https://ibirapuera.org/equipamentos-parque-ibirapuera/auditorio-do-ibirapuera/
- **Marina Barrage e Marina Bay:** barragem que faz um reservatório de 240 ha, com cobertura verde caminhável e o
  skyline em volta da baía. Lição: a água parada como espelho do skyline. Fontes:
  https://www.cdmsmith.com/en/client-solutions/projects/singapore-marina-barrage ,
  https://www.nlb.gov.sg/main/article-detail?cmsuuid=64fae4f4-99b8-4d72-9691-851bc0894489
- **Cheonggyecheon (Seul):** 5,8 km de córrego reaberto no lugar de um elevado, com margens em degraus de pedra,
  pedras de travessia e 22 pontes. Lição: bordas de pedra em degraus, onde as pessoas descem até a água. Fontes:
  https://www.landscapeperformance.org/case-study-briefs/cheonggyecheon-stream-restoration-project ,
  https://www.archdaily.com/1020945/re-naturalization-of-urban-waterways-the-case-study-of-cheonggye-stream-in-seoul-south-korea

### 2.9 O que o CS2 ensina sobre prédios

- **Signature buildings** são âncoras do skyline, únicos e com efeito na simulação (XP e bônus em volta). Para nós:
  Torre, Torres do Conselho, Biblioteca e Cúpula são as "assinaturas" da Arcologia.
  Fontes: https://cs2.paradoxwikis.com/Signature_buildings , https://colossalorder.fi/?p=1649
- O visual muda **a cada dois níveis**: níveis baixos têm ar mais simples, e os altos, mais moderno e detalhado. Os
  artistas partem de volumes brancos (white boxing) e iteram os detalhes típicos do estilo. Temas trocam cores e
  detalhes. Fontes: https://colossalorder.fi/?p=1649 , https://colossalorder.fi/?p=1767 ,
  https://cs2.paradoxwikis.com/index.php?title=Asset_Pipeline%3A_Buildings&mobileaction=toggle_view_desktop
- **Fachada sem geometria:** o "interior mapping" (Joost van Dongen, 2008) simula salas atrás do vidro com um raio no
  shader, sem geometria extra. É usado em jogos de mundo aberto. Existe versão MIT para three.js (three-fenestra,
  three 0.150 ou mais novo, `onBeforeCompile`, instanciável). Fontes:
  http://joostdevblog.blogspot.com/2018/09/interior-mapping-real-rooms-without.html ,
  https://github.com/codedgar/three-fenestra ,
  https://80.lv/articles/interior-mapping-rendering-real-rooms-without-geometry
- **BatchedMesh** (three) desenha geometrias diferentes com o mesmo material numa chamada, com visibilidade por item.
  É útil para os prédios da cidade e para peças soltas que mudam de nível. Fontes:
  https://threejs.org/docs/pages/BatchedMesh.html ,
  https://discourse.threejs.org/t/how-to-choose-between-instancedmesh-and-batchedmesh/81221

---

## 3. Princípios de direção de arte para a Arcologia

1. **Quatro degraus de altura:** pico único (Torre, 26), segundo degrau (Torres do Conselho, 12), marcos (6,5 a 7,5)
   e tecido (fitas de 1,5 a 6,0). Nada do tecido passa de metade do segundo degrau.
2. **Base, corpo e coroa em todo prédio que importa.** A base encontra o chão ou a água: pódio, pilotis alto,
   espelho, degraus, cais. O corpo tem ritmo vertical. A coroa é desenhada: lanterna, balanço, jardim alto, pontas.
3. **Duas caras (Marina One).** Para fora, rumo à cidade, a fachada é urbana e rigorosa: vidro, pedra e bronze. Para
   dentro, rumo ao lago e aos miolos, é um vale verde em terraços largos com árvores.
4. **Ritmo vertical e escala dupla.** O módulo de fachada tem dois pavimentos (Bloomberg). Os jardins entram a cada 2
   a 4 pavimentos (Parkroyal), com montantes e aletas verticais. As únicas horizontais fortes são os andares de vento
   da Torre, as pontes e as coroas.
5. **Nenhuma fita com altura constante.** Cada módulo tem perfil próprio e o teto desce em degraus (8 House,
   VIA 57). O Anel sobe do portal sul para o norte e forma o anfiteatro voltado para a câmera.
6. **Ligações no alto.** Pontes de vidro entre módulos no nível máximo (The Crystal, Pinnacle@Duxton) e o passeio no
   teto que continua por elas.
7. **A água como espelho.** Degraus de pedra até o lago no lado da câmera (Cheonggyecheon, Oslo), Torre refletida
   (Marina Bay).
8. **Noite com poucas luzes fortes.** Coroa-lanterna da Torre (Salesforce), linhas dos andares de vento, pontes
   com LED (Helix), Supertrees e o vórtice da Cúpula. As janelas acendem pelo shader, não por geometria.
9. **Paleta de materiais curta (PBR).** Seis materiais "de obra": vidro de cortina, concreto claro, pedra (travertino
   ou arenito), bronze escuro, madeira e vegetação. Ouro só na Torre. Nada de guarda-corpo colorido de brinquedo. A
   cor do jogador tinge pedra e concreto por inteiro, bronze pela metade e só os caixilhos do vidro (tabela `PINTA`
   de `materials.js`).
10. **Referência brasileira para Heldópolis.** Eixo gramado e largo (Esplanada), colunata e cobertura em anel (Mané
    Garrincha), marquise e palco aberto (Ibirapuera) e verde de Burle Marx no chão, não pintado no teto.

---

## 4. Torre da Holding: três variantes e a recomendada

Unidade: 1 pavimento = 0,5. A ilha tem raio 3,9 com centro em C = (0; -3,5). As pontes chegam à borda da ilha no
nível 0,55 (sul) e 0,5 (norte). A câmera padrão olha do sul.

| | A. Monolito em grade | **B. Torre Lâmina (recomendada)** | C. Prisma com costura e lanterna |
|---|---|---|---|
| Referências | 432 Park Avenue, Torre Reforma | One Vanderbilt, 111 West 57th, Edge (30 Hudson Yards), The Spiral | Lotte World Tower, Salesforce Tower, Lakhta |
| Planta | quadrado 3,0 x 3,0 | retângulo 3,2 (leste-oeste) x 4,4 (norte-sul) na base do corpo | quadrado 3,6 com quinas chanfradas, afinando para 2,6 |
| Altura (heliponto) | 26,0 (esbeltez 1:8,7) | 26,0 (1:8,1 vista do sul) e mastro até 27,6 | 26,0 e lanterna até 27,0 |
| Corpo | grade de concreto branco, janelas de 0,5 x 0,5 (6 por face em cada pavimento, como o 432) | 3 blocos de 12 pavimentos e 1 de 6, separados por andares de vento vazados; face sul recua em 4 "penas"; face norte reta | curva suave de afinamento (entasis), costura dourada vertical voltada para o eixo sul |
| Coroa | topo plano, heliponto rente | lanterna de vidro e bronze de 2,3, oca no alto, com heliponto em balanço de 1,6 sobre o lago | coroa de metal perfurado de 3,0 com LEDs (vídeo lento à noite) |
| Força | mais barata (a textura faz tudo), austera, muito "luxo discreto" | silhueta única do sul, terraços visíveis, ligação com o verde da Arcologia, balanço que vira assinatura | a mais sedosa; a noite é a mais forte |
| Fraqueza | da câmera vira um pilar branco; parece o `cidTorre` da cidade ampliado | mais peças (ainda barata) | o afinamento se afasta do "retangular" pedido; risco de parecer foguete |
| Triângulos (Média / Ultra) | 1,5 mil / 3 mil | 4 mil / 9 mil | 3 mil / 6 mil |

**Recomendação: B, a Torre Lâmina**, com a lanterna acesa de C na coroa. É retangular, é de luxo, tem um gesto só
(os recuos em pena voltados para a câmera, fechando no balanço do heliponto) e conversa com o resto: os terraços da
Torre são os jardins da Arcologia levados ao alto.

### 4.1 Torre Lâmina: ficha técnica

- **Implantação.** Eixo em x = 0. O retângulo é alinhado aos eixos do mundo, com o lado estreito (3,2) virado para o
  sul: a câmera vê a Torre esbelta.
- **Pódio (0 a 1,2).** Quadrado de 5,4 com quinas chanfradas de 0,7. O ponto mais distante do centro fica a 3,4, menos
  que a ilha (3,9), então sobra um anel de juncos e pedra. O saguão tem pé-direito duplo, com vidro recuado 0,25 sob
  uma laje de pedra de 0,2. As pontes chegam a um passeio de 1,1 em volta do pódio (da ponte sul ao pódio há 1,1 de
  praça). No teto do pódio (1,2), um jardim e uma piscina de borda infinita virada para o sul (Marina Bay Sands,
  Parkroyal).
- **Corpo (1,2 a 23,7).** Quatro blocos:

  | Bloco | y0 a y1 | Pavimentos | Face sul (z) | Profundidade N-S | Terraço criado |
  |---|---|---|---|---|---|
  | 1 | 1,2 a 7,2 | 12 | -1,3 | 4,4 | (pódio) |
  | vento | 7,2 a 7,7 | 1 vazado | recuo 0,4 em todo o perímetro, forro dourado | | |
  | 2 | 7,7 a 13,7 | 12 | -1,8 | 3,9 | 0,5 com jardim |
  | vento | 13,7 a 14,2 | 1 vazado | idem | | |
  | 3 | 14,2 a 20,2 | 12 | -2,4 | 3,3 | 0,6 com jardim |
  | vento | 20,2 a 20,7 | 1 vazado | idem | | |
  | 4 | 20,7 a 23,7 | 6 | -3,0 | 2,7 | 0,6 com jardim |

  A face norte fica em z = -5,7 do pódio ao topo. Nas faces leste e oeste corre a costura: uma reentrância de 0,25
  de largura e 0,15 de fundo no meio da face, com friso de ouro, do pódio à coroa (Lotte). As quinas têm recorte de
  0,15 x 0,15 (notched corners), o que afina a leitura sem custo.
- **Coroa (23,7 a 26,0).** Lanterna de vidro com aletas de bronze mais densas (passo 0,2 contra 0,4 do corpo). O
  último 1,2 é oco, com as aletas soltas contra o céu (Salesforce, 432). Profundidade de 2,3.
- **Heliponto (26,0).** Laje de 2,8 x 2,8 e 0,12 de espessura em laca preta, com aro de luz e o "H" em ouro. Avança
  1,6 para o sul além da face da coroa (centro em z = -3,2), sobre os terraços (Edge, Central Park Tower).
  Guarda-corpo de vidro inclinado de 0,15. Valores novos: `pouso = [0, 26.05, -3.2]` e `repasse = [0, 27.0, -3.2]`.
- **Mastro.** Na quina noroeste, fino (r 0,05), do topo da coroa até 27,6, com luz vermelha piscando.
- **Fachada do corpo.** Vidro de cortina escuro champanhe (reflete o céu) com aletas verticais de bronze a cada 0,4
  nas faces sul, leste e oeste. A face norte tem montantes finos na textura. Os andares de vento são faixas escuras
  com forro dourado: as únicas três horizontais do corpo, que à noite viram linhas de luz.
- **Terraços.** Cada recuo do sul tem floreira baixa, 4 a 6 árvores pequenas (as copas instanciadas de hoje) e
  guarda-corpo de vidro (The Spiral).
- **Noite.** Lanterna com emissivo em gradiente lento (âmbar para branco quente), linhas dos andares de vento, aro do
  heliponto, janelas acesas pela textura (30 a 40%) e o reflexo no lago nas qualidades Alta e Ultra.
- **Obra (sede.e4).** A caixa de obra passa de 14 para 27,6 de altura: a grua da `obra.js` precisa subir acima dela
  (hoje ela já procura a altura dos obstáculos). Opcional: a Torre sobe por blocos durante a etapa (4 cortes de
  `clipped`).
- **Modelagem barata.** Os blocos são extrusões de retângulos com o recorte das quinas e da costura (uma `Shape` de
  16 pontos por bloco), fundidos por material. As aletas são caixas finas numa `InstancedMesh` ou fundidas (cerca de
  150 aletas de 12 triângulos). Na Média as aletas ficam só na textura (mapa normal simples). No Ultra dá para usar
  interior mapping no vidro da Torre e das Torres do Conselho.
- **Orçamento.** Na Média, 4 mil triângulos e 5 materiais (vidro de cortina, bronze, pedra, laca, ouro) mais as copas
  instanciadas. No Ultra, 9 mil com as aletas em geometria.

### 4.2 O que muda em `planta.js` para a Torre

O bloco `TORRE` passa a ser:
`{ c, podio: {lado: 5.4, chanfro: 0.7, topo: 1.2}, blocos: [[y0, y1, zSul], ...], zNorte: -5.7, largura: 3.2,
vento: 0.5, coroa: [23.7, 26.0, zSul], heliponto: {c: [0, -3.2], lado: 2.8, y: 26.0}, mastro: 27.6, topo: 26.0,
pouso, repasse, radier: 3.4 }`. Continuam existindo `c`, `topo`, `pouso`, `repasse` e `radier`, que `aereo.js`,
`rotulos.js`, `extras.js` e `centro.js` leem. `camadas`, `coroa` e `heliponto` só são lidos por `torreHolding()`, que
é reescrita.

Também mudam: a rota de aproximação do `HeliHolding` em `aereo.js`, que hoje desce de 16 e precisa vir acima de 28; o
lugar "Torre e lago" em `extras.js` (distância de 38 para 50, inclinação menor); e os textos de `obras.js` (sede.e4)
e de `historia.js` (fala 'sede.e4'), que hoje dizem "bolo de noiva".

---

## 5. Sede da Holding e Anel Mestre

### 5.1 Sede (fita 'sede', 4 módulos, tambores NO e NE, portal norte de 3,6)

- **Referências:** Bloomberg (moldura de pedra de 2 andares e aletas de bronze), Apple Park (a curva contínua),
  Google Bay View (cobertura em escamas solares), Tencent (par de torres) e o Eixo Monumental (o palácio no fim do
  eixo).
- **Massa.** A faixa curva tem 6 pavimentos de 0,55 (3,3) no nível máximo (hoje 8 de 0,55 = 4,4). Ela é mais baixa
  porque a verticalidade passa para as torres. Os **tambores NO e NE viram as Torres do Conselho**: 12,0 de altura (22
  pavimentos de 0,55), em planta de retângulo arredondado de 3,6 x 2,6 com cantos de raio 0,6. Cabe no círculo do
  tambor (raio 3,0), com o lado longo virado para o lago. Cada torre tem pódio no círculo do tambor (base de vidro de
  1,1), corpo de 1,1 a 11,2 e coroa de 0,8 com jardim e pergolado de bronze.
- **Silhueta da câmera.** As duas torres ficam em x = ±13,9 e z = -9,5, nos cantos norte do lago. Com a Torre no
  meio, formam um tríptico: 26 no centro e 12 dos lados, atrás. A faixa da Sede, baixa entre elas, fica em boa parte
  escondida pela Torre, e é assim que deve ser.
- **Fachada.** Moldura de pedra (travertino claro) com vãos de 2 pavimentos (1,1) e 0,9 de largura, e 3 aletas de
  bronze por vão, com o passo variando por orientação (Bloomberg). As torres usam a mesma moldura, que termina numa
  aba fina de pedra no topo.
- **Cobertura.** Cobertura solar em escamas levemente abobadada (Bay View), com janelas altas entre as abóbadas a cada
  módulo. Liga com a etapa sede.e3 ("Anel de vidro solar"), cujo nome continua certo.
- **Pórtico do portal norte.** Continua sendo os dois pavimentos de cima sobre o portal, agora na moldura de pedra,
  com friso de bronze no lugar do ouro.
- **Mecânica.** As etapas sobem a fita inteira (e2 nível 1, e3 nível 3, e4 nível 4). As torres crescem com os
  tambores (nós dos módulos 0 e 3): nos níveis 1 a 3 são pódio e 1 ou 2 blocos, e o corpo inteiro com a coroa só
  aparece no nível 4 (e4, a mesma etapa da Torre). Nenhum id muda.
- **Orçamento.** Faixa com cerca de 8 mil triângulos (a moldura instanciada gasta menos que a varanda de hoje, que
  soma 19,4 mil), torres com 2,5 mil cada e cobertura com 1,5 mil. Total de 14 a 15 mil na Média e 25 mil no Ultra.

### 5.2 Anel de moradia (fita 'anel', 8 módulos, 5 níveis, tambores SO e SE, portal sul)

- **Referências:** Tietgen (cilindro com caixas salientes), Marina One (fora rigoroso e dentro em vale), Interlace
  (picos), Parkroyal (jardins a cada 4 pavimentos), Bosco Verticale (árvores de verdade), 8 House e VIA 57 (teto
  inclinado), The Crystal e Pinnacle@Duxton (pontes altas).
- **Anfiteatro voltado para a câmera.** Cada módulo tem um perfil de altura no nível máximo. O perfil sobe do portal
  sul (3,0) até as pontas norte (6,0), que encostam nas Torres do Conselho. Os tetos dentro de cada módulo sobem em
  degraus de 1 a 2 pavimentos.

  | Módulo do jogo | Trecho no caminho (ORDEM_ANEL) | Onde fica | Pavimentos no máximo (0,5) | Altura | Teto |
  |---|---|---|---|---|---|
  | 0 | 4 | oeste do portal sul | 6 no portal, subindo a 8 | 3,0 a 4,0 | degraus |
  | 1 | 3 | leste do portal sul | 6 a 8 (espelho do 0) | 3,0 a 4,0 | degraus |
  | 2 | 5 | sudoeste | 8 a 9 | 4,0 a 4,5 | degraus |
  | 3 | 2 | sudeste | 8 a 9 | 4,0 a 4,5 | degraus |
  | 4 | 6 | tambor SO | 10 | 5,0 | plano, com o tambor de vidro |
  | 5 | 1 | tambor SE | 10 | 5,0 | plano, com o tambor de vidro |
  | 6 | 7 | oeste, até o tambor NO | 10 a 12 | 5,0 a 6,0 | degraus, ombro da Torre do Conselho |
  | 7 | 0 | leste, até o tambor NE | 10 a 12 | 5,0 a 6,0 | degraus |

  Hoje todos os módulos têm 7 pavimentos (3,5) no máximo. O portal sul (ponte de 1,55 a 2,55) continua abaixo dos
  módulos 0 e 1 (3,0).
- **Face externa (cidade):** cortina de vidro com montantes verticais, uma faixa fina de pedra a cada 2 pavimentos e
  **caixas salientes** (Tietgen): volumes de 0,6 a 1,0 de largura, 1 a 2 pavimentos de altura e 0,3 a 0,5 de avanço,
  alternados por semente do módulo. Cada caixa tem 12 triângulos; são 15 a 25 por módulo, instanciadas.
- **Face interna (lago):** vale verde. O talude de hoje (2 andares) continua, e acima dele entra um terraço a cada 2
  pavimentos com recuo de 0,35, vaso de 0,25 e árvores pequenas instanciadas (Bosco, Parkroyal). O verde deixa de ser
  uma floreira por pavimento e passa a ser um degrau largo a cada 1,0 de altura.
- **Fendas.** Em cada corte interno sem vão entra uma fenda de vidro recuada de 0,3, na altura toda, e cada módulo lê
  como um prédio (as quatro torres do Marina One). Isso também mostra o módulo que o jogador tocou.
- **Tambores SO e SE:** tambores de vidro (a rotunda de vidro com cobertura flutuante, como os pavilhões do Apple
  Park). Cilindro de vidro na altura do módulo dono, com disco de cobertura de laca de raio 3,25 (0,25 de beiral) e
  átrio com uma árvore grande no meio. Deixam de ser bolos.
- **Passeio no teto e pontes.** O passeio de hoje continua. Quando os módulos 4 e 2 (e os módulos 5 e 3) chegam ao
  máximo, uma ponte de vidro liga o teto de um ao do outro por cima do degrau (The Crystal). Quando os 8 módulos
  estão no máximo, o passeio vira o "Anel do Céu" contínuo, com LED no guarda-corpo à noite.
- **Orçamento.** Hoje são 30,6 mil triângulos (22,9 mil fundidos e 7,7 mil de extras). O proposto fica em 22 a 26 mil
  na Média, porque a cortina gasta 1 a 2 arestas por pavimento contra 6 a 8 do terraço de hoje. As caixas somam cerca
  de 2,4 mil e as árvores reaproveitam a fila de arbustos.

---

## 6. Folhas

### 6.1 Escola (gota SO: fita 'escola' de 3 módulos que sobem juntos, pátio, campo)

- **Referências:** Kampung Admiralty (parque em degraus no teto), Rolex Learning Center (teto que ondula) e Mané
  Garrincha (colunata em anel).
- **Massa.** A gota fica com 3 a 5 pavimentos (1,5 a 2,5), subindo do rabo junto ao tambor até o arco de fora. Por
  dentro, voltado para o campo, o teto é um talude gramado contínuo, uma arquibancada verde de onde se vê o jogo. Por
  fora ficam aletas verticais de madeira com três tons quentes (o laranja, o amarelo e o azul de hoje viram madeira
  tingida, não guarda-corpo de brinquedo).
- **Campo:** a arquibancada no pescoço fica; em volta do campo entra um anel de 56 pilares finos (r 0,07, altura 1,4,
  instanciados) com uma cobertura elíptica fina de 0,6 de largura e painéis solares no teto, como uma arena em
  miniatura na linguagem de Brasília. As torres de luz saem (a cobertura ilumina).
- **Pátio da Escola (e2, e3):** os morros com brinquedos coloridos viram morros de grama com escorregador de aço e
  areia (sem cores saturadas). A piscina fica.
- **Orçamento:** de 20,5 mil hoje para 10 mil (fita) mais 1,5 mil (arena).

### 6.2 Universidade (gota SE: Engenharia, 'uni' com 4 módulos, Instituto, Ciências, Ponte Coberta)

- **Referências:** Harvard SEC (pele de aço), Stanford SEQ (arcadas e cobertura solar) e Rolex (laje ondulada).
- **'uni' (parede de células, 4 módulos):** a parede de células fica, porque já é diferente do resto. As 5 torrinhas
  de 1,0 dão lugar a **duas torres de laboratório** de 6,5 nos módulos 1 e 2, de planta retangular de 2,0 x 2,4. Elas
  aparecem no nível máximo do módulo, com pele de malha de aço (o `M.mesh` de hoje, com recorte alfa) sobre vidro. Uma
  arcada contínua de pórticos de aço e cobertura translúcida corre pela face interna, no térreo, ligando Engenharia,
  uni e Instituto (Stanford).
- **Engenharia e Instituto:** os dosséis guarda-chuva (solar e verde) viram duas coberturas planas de painéis solares
  sobre pilares finos no teto (a linguagem da arcada).
- **Ciências (miolo):** a elipse de bandas brancas vira uma **laje única ondulada** de 1 a 2 pavimentos com 4 pátios
  redondos (Rolex). É uma `ExtrudeGeometry` com furos (o `plateHoles` de `centro.js`) e o tampo deslocado por seno
  (grade de 24 x 16). A Ponte Coberta chega à proa como hoje.
- **Orçamento:** 12 mil na Média (hoje 14,0 mil só nas três fitas).

### 6.3 Biblioteca (gota NO: 'anelBib' com 3 módulos, Biblioteca com 5 etapas, CRD)

- **Referências:** Qatar National Library (placa dobrada em diamante), Tianjin Binhai (o olho luminoso) e Seattle
  (malha de losangos).
- **Biblioteca, o marco do oeste (7,5).** O vaso sobre pilares em V com o dossel quadrado vira o **Diamante**: uma
  placa quadrada de 7,6 x 7,6, com as quinas do eixo da folha levantadas até 5,5 e as outras duas no chão, fechada por
  vidro em malha de losangos. Dentro, a **esfera do olho** (r 1,8, vidro leitoso aceso), vista por uma abertura oval
  virada para o tambor NO. Estantes em terraços viram brises horizontais curvos nas faces de vidro, só dentro da
  abertura. Um pináculo de luz sobe da esfera até 7,5.
- **Etapas (5):** plinto e espelho (fica), placa de piso, estrutura em losango, vidro, esfera e luz. O mesmo número
  de partes.
- **anelBib (3 módulos):** a gota ganha perfil em degraus, de 3 pavimentos (0,55) nos rabos a 6 no arco de fora
  (1,65 a 3,3), com a colmeia por dentro trocada por terraços a cada 2 pavimentos. Pontes de vidro entre os módulos 0
  e 2 no máximo.
- **CRD (leque):** fica o leque de vidro com costelas de madeira laminada, que já é bom (lembra Crystal Bridges); sai
  o bloco branco.
- **Orçamento:** Biblioteca de 10 mil para 5 mil, anelBib de 18,9 mil para 10 mil.

### 6.4 Vida (gota NE: 'santuario' com 5 módulos, Cúpula, Estufa, Galeria, Trilha)

- **Referências:** Jewel Changi (toro de vidro e vórtice), Gardens by the Bay (gridshell com costelas, Supertrees e
  Skyway), Eden (hexágonos grandes) e Bosco Verticale (moradia dos pesquisadores).
- **Cúpula da Vida, o marco do leste (7,0).** Continua fechada e sem bichos à vista. A malha geodésica de triângulos
  vira uma **casca lisa em gota achatada** (torno de 14 pontos e 48 segmentos) com malha em diagrid de quadriláteros
  na textura alfa do vidro. No topo, um óculo de raio 0,8 por onde cai o **Vórtice**: um cilindro de água de 0,4 de
  raio com UV correndo e névoa na base. À noite, luz fria no vórtice e anel de LED no óculo. Raio 4,8 e altura de 7,0
  (hoje 5,2).
- **Estufa Anexa:** gridshell com 8 costelas externas em arco (Flower Dome), em vez de mais uma bolha geodésica.
- **Supertrees:** 5 árvores de aço de 4,5 a 6,0 ao longo da Trilha, do tambor NE até a Galeria. O tronco é torneado
  em 12 lados e a copa é um funil de treliça com jardim; entre as duas mais altas, uma passarela suspensa a 3,0 (OCBC
  Skyway). À noite, as copas acendem em cores lentas.
- **Santuário (5 módulos):** perfil de 5 a 8 pavimentos, com fachada de varandas profundas desencontradas e árvores
  (Bosco), em vez da fachada âmbar listrada.
- **Orçamento:** Cúpula e Estufa com 5 mil (a geodésica de hoje é mais cara), Supertrees com 2,5 mil e santuário de
  21,7 mil para 12 mil.

---

## 7. Contorno, eixo e água

### 7.1 Fitas do contorno

- **Onda (vale oeste) e Elo Norte (vale leste), 2 módulos cada:** passam a **descer até o chão** nas pontas, com teto
  verde inclinado que vira gramado (8 House). O contorno da Arcologia se funde à paisagem em vez de fechar como
  muralha. Perfil de 4 pavimentos no meio e 0 nas pontas, com 1 pavimento de vidro no térreo.
- **Vila Estudantil (casas, 6 módulos, 3 níveis):** cada casa vira um **cacho de caixas brancas empilhadas**
  (Habitat 67). São 3 a 5 caixas de 0,9 x 0,6 x 0,45 por nível, desencontradas, cada uma com o teto como jardim da de
  cima. Saem o telhado de duas águas e as janelas coladas. É barato: 12 triângulos por caixa, instanciadas, com a
  pegada dentro da faixa.
- **Humanidades e Artes (1 módulo):** o teto de esculturas vira um **teto-praça de pedra clara** que desce até o piso
  da praça junto à colunata (Ópera de Oslo). As esculturas ficam no teto inclinado.
- **Elo do Santuário e crescente:** ver a seção 7.4.

### 7.2 Eixo e praça

- **Colunata da praça (pas_frente2):** a fita-ponte de terraços vira uma **colunata de verdade**: dois hemiciclos de
  4 fileiras de colunas brancas (r 0,09, altura 1,6), cerca de 20 colunas por fileira em cada arco, e um entablamento
  fino com floreira no topo (São Pedro, em escala de praça). São cerca de 160 colunas de 16 triângulos, instanciadas:
  2,6 mil.
- **Marco da Holding (praca.e3):** o obelisco com guarda-chuva dourado vira uma escultura de treliça em favo, de 4,0
  de altura, com base de raio 0,6 e topo de 1,6, em aço escuro e cobre por baixo (Vessel). Liga com a luz da praça à
  noite. Cerca de 800 triângulos.
- **Bulevar Verde (pas_bulevar):** deque de pranchas cujas pontas afinadas "penteiam" os canteiros (High Line). É
  textura e forma do canteiro, sem geometria nova.
- **Ponte da ilha (pas_ponte):** vira ponte em dupla hélice de tubos claros com LED (Helix), com 2 hélices de 3 tubos
  (`TubeGeometry`, cerca de 2 mil triângulos).
- **Portal do Anel e pórtico da Sede:** ficam na seção das fitas, com a nova fachada.
- **Eixo norte:** o piso fica. Os renques baixos viram duas fileiras de palmeiras imperiais (instâncias da mata),
  como a Esplanada.

### 7.3 Lago

- **Tamanho e forma:** ficam (`A.lago`, bacias, diques e ilha).
- **Degraus d'água:** na margem sul, a do lado da câmera, entre o pavilhão e os diques, entra uma arquibancada de 3
  degraus de pedra que desce até a água (Cheonggyecheon, Ópera de Oslo). É uma varredura ao longo da margem (cerca de
  1,4 mil triângulos) na etapa lago.e3.
- **Espelho:** o reflexo da Torre na água é da frente visual (reflexo planar ou SSR nas qualidades Alta e Ultra). A
  arquitetura só garante que a Torre fique no meio do espelho sul vista da câmera padrão, o que já acontece.
- **Vales:** os canais até os Repuxos ganham pedras de travessia (Cheonggyecheon).

### 7.4 Acelerador e Centro de Física

- **Referências:** CERN Science Gateway (tubos sobre pilares e ponte), MAX IV (ondas de terra) e ESO Supernova (duas
  cascas).
- **Crescente (Centro de Física, e4):** a fita de vidro de 1 módulo vira **dois tubos** de raio 0,7 que seguem o arco
  do crescente (`TubeGeometry` num arco), sobre pilares em V (instanciados), a 0,9 do chão, com painéis solares no
  topo. Os braços do Elo do Santuário chegam de ponta nos tubos como pontes (a ponte do CERN).
- **Linha de luz:** fica. Opcional (parcela própria): 3 ondas baixas de terra paralelas à linha de luz por fora do
  contorno, no terreno (`ground.js`), como no MAX IV.
- **Orçamento:** 1,5 mil nos tubos contra os cerca de 3 mil da fita de hoje.

### 7.5 Anfiteatro da Vila

- **Referência:** Auditório Ibirapuera. A ferradura de degraus fica. O palco ganha um volume branco com uma **porta
  grande** que abre para a plateia de grama e uma marquise vermelha em "labareda" na entrada (o único vermelho da
  Arcologia).

---

## 8. A Faixa sem cara de robô (mudanças em `faixa.js` sem perder os módulos)

O contrato da mecânica fica como está: `S.modulos[f][i].nivel`, a ordem (`ORDEM_ANEL`), os cortes, os vãos, os nós e
as juntas de 0,12 entre projetos. O que muda é a geometria que cada nível produz.

### 8.1 Níveis diferentes de andares

- Hoje `_Fg(n)` = n, ou n + `andaresExtra` no máximo, igual para todos os módulos.
- Novo: `def.andares(i, n)` dá os pavimentos da geometria do módulo i no nível n. O padrão é o de hoje. O Anel usa
  `round(Hmax_i * n / max)`, com Hmax_i da tabela de perfis (seção 5.2).
- `andar(i, f, F)` continua sendo chamado por `jogo.js` com níveis (f = nível que sobe menos 1, F = nível alvo).
  Por dentro, ele monta a **faixa de pavimentos** de `andares(i, f)` até `andares(i, f + 1)` como uma peça só da obra
  (com a grua e os operários de hoje). `jogo.js` não muda nessa parte.
- `alturaTopo(n)` e `caixa(i, n)` passam a considerar o módulo. `jogo.js` (âncoras dos balões e da obra, linhas 430
  e 438) passa o i.

### 8.2 Perfil em degraus

- `def.perfil(i)` = `[{ ate: fração do trecho, andares }]`: onde o teto de cada pavimento termina ao longo do módulo.
  Isso **generaliza** o que `pontaDegrau` e `_faixaK` já fazem (os andares de cima terminam antes). O código de
  tampas acabadas nos degraus (`_geo` com a lista K) é o mesmo; muda só a fonte dos cortes.
- Com isso, o teto de um módulo sobe em 2 ou 3 degraus (8 House, VIA 57) sem geometria inclinada, que teria custo
  e quebraria o passeio.

### 8.3 Tipologia por face

- `prof.fora` e `prof.dentro` podem ser `'terraco'`, `'cortina'`, `'moldura'` ou `'celular'`. Cada uma gera as arestas do
  pavimento daquele lado (a função `_floor` monta as duas metades).
  - `cortina`: vidro rente em o1, uma aresta por pavimento, com uma faixa de pedra de 0,06 a cada 2 pavimentos.
  - `moldura`: pilastras e travessas de pedra a cada 2 pavimentos (instanciadas ao longo do caminho, passo de 0,9)
    e aletas de bronze instanciadas; o vidro recua 0,12.
  - `terraco`: o de hoje, com `passoJardim` (o jardim a cada k pavimentos; os outros pavimentos ficam só com vidro e
    laje fina).
  - `celular`: o de hoje (uni).
- `def.caixas = { passo, largura: [a, b], avanco: [a, b], alturas: [1, 2], lado: 'fora', semente }`: volumes
  salientes numa `InstancedMesh` por fita (1 chamada), fora das fendas, dos degraus e das tampas.

### 8.4 Coroas, fendas e pontes

- `def.coroa(i, Fg)`: mapa material para geometria que o módulo ganha no nível máximo (torre de laboratório,
  pergolado, jardim alto). Usa o mesmo caminho de `porModulo` da `FaixaMod` de `aneis.js`, que passa para a `Faixa`.
- `def.fendas = { recuo: 0.3, largura: 0.4 }`: nos cortes internos sem vão, as duas tampas recuam e fica um vidro
  escuro na altura do menor vizinho.
- `def.pontes = [{ de: i, para: j, y, w }]`: ponte de vidro fundida (0 chamadas a mais) quando **os dois** módulos
  estão no máximo. Generaliza o `extraGeo`, que hoje espera todos os módulos no máximo.

### 8.5 Variação sem sorte

Cada módulo tem uma semente (`hash(id, i)`) que escolhe ±1 pavimento no degrau do meio, o lado das caixas e o tom da
pedra (3 tons). É determinística: o mesmo save mostra sempre a mesma Arcologia.

### 8.6 Testes

- `ferramentas/conexoes.mjs`: além das juntas, confere que nenhuma caixa saliente, coroa ou ponte invade a pegada de
  outro projeto (caixa contra pegada mais a junta).
- Teste novo da Faixa no `simular --testes`: `andares(i, n)` cresce com n, `andares(i, max)` é igual ao perfil, a
  `pegada(i)` não muda com a tipologia e as peças `andar(i, f, F)` somadas dão a geometria do nível.
- `ferramentas/teste-planta.mjs`: pódio da Torre dentro da ilha, Torres do Conselho dentro do círculo do tambor e
  `pouso` sobre a laje do heliponto.

---

## 9. O plano do Trevo deve mudar?

**Não na planta; sim nas alturas, na Torre e na câmera.**

- **Planta (mesa 80 x 62, Anel 32 x 24 de linha média, nós, folhas, eixo, lago, anel viário):** fica. Mexer nela
  quebraria as juntas medidas, o gabarito do capítulo 1, os caminhos dos pedestres e o canteiro, sem ganho de
  magnitude. A magnitude vem da terceira dimensão.
- **Alturas:** `ALT_` e a tabela nova de perfis (em `planta.js`, junto de A, porque altura é plano). Os números estão
  nas seções 4 a 7.
- **Torre:** o bloco `TORRE` novo (seção 4.2). A ilha fica com raio 3,9, e o pódio de 5,4 cabe.
- **Lago:** mesmo tamanho. Ganha os degraus da margem sul e o papel de espelho.
- **Câmera padrão (`VISTA_FOTO`):** precisa mudar para mostrar a Torre inteira com céu acima. Medido com o
  `enquadra.mjs` (coordenada vertical na tela de -1 a 1, onde 1 é a borda de cima):

  | Câmera | Torre de 22 | Torre de 26 | Torre de 30 | Anel viário sul | Anel viário norte |
  |---|---|---|---|---|---|
  | Atual (dist 78, 0,66 rad, alvo y 0, fov 34) | 0,95 | **1,14 (corta)** | 1,36 | -0,94 | 0,63 |
  | **Proposta (dist 80, 0,50 rad = 29 graus, alvo (0; 5; -2), fov 38)** | 0,62 | **0,78** | 0,95 | -0,92 | 0,27 |
  | Alternativa (dist 92, 0,48 rad, alvo (0; 6; -2), fov 34) | 0,57 | 0,72 | 0,87 | -0,87 | 0,23 |

  A proposta mostra a Arcologia inteira (a pista sul na borda de baixo, como hoje) e a Torre com cerca de um décimo da
  altura da tela livre acima dela. Fica mais oblíqua, como as vistas de skyline do CS2: o norte sobe na tela e as Torres do Conselho se
  destacam do fundo. `main.js` precisa aceitar o alvo com y (`rig.target.set(o.x, o.y ?? 0, o.z)`) e o `flyTo`
  também. A `VISTA_GERAL` (0,88 rad) pode ficar; nela a Torre de 26 cai em 0,89.
- **Se o dono quiser manter a câmera de hoje,** a Torre não pode passar de 21 no heliponto. Recomendo mudar a câmera:
  26 dá 3,6 vezes o Residencial de Luxo da cidade (7,3), contra 1,9 vez hoje.

### 9.1 Hierarquia final (alturas no nível máximo)

| Degrau | Elemento | Altura | Hoje |
|---|---|---|---|
| Pico | Torre da Holding (heliponto; mastro 27,6) | 26,0 | 14,0 |
| 2º | Torres do Conselho (tambores NO e NE) | 12,0 | 4,4 + lanterna |
| Marcos | Biblioteca (Diamante com pináculo) | 7,5 | 6,2 |
| Marcos | Cúpula da Vida | 7,0 | 5,2 |
| Marcos | Laboratórios da Universidade (2) | 6,5 | 3,0 + 1,0 |
| Marcos | Supertrees (5) | 4,5 a 6,0 | não existem |
| Tecido | Anel (do portal ao norte) | 3,0 a 6,0 | 3,5 |
| Tecido | Sede (faixa) | 3,3 | 4,4 |
| Tecido | Folhas (escola, anelBib, santuário) | 1,5 a 4,0 | 1,5 a 2,5 |
| Tecido | Contorno | 0 a 2,0 | 1,5 a 2,0 |
| Cidade | Residencial de Luxo nível 5 (com heliponto) | 7,3 | 7,3 |

---

## 10. Materiais (PBR) por prédio

A frente visual cuida de céu, PMREM, tonemapping e reflexo. A arquitetura precisa de quatro materiais novos em
`materials.js` e das entradas na tabela `PINTA`:

| Material | Base | Uso | Pintura do jogador (PINTA) |
|---|---|---|---|
| `vidroCortina` | cor 0x2c3440, rugosidade 0,08, metalicidade 0,85, `envMapIntensity` 1,2; mapa de montantes verticais e janelas (emissivo à noite, como os `fac_*` de hoje); interior mapping no Ultra | Torre, Torres do Conselho, face externa do Anel, labs | 0,2 (só caixilhos) |
| `pedra` | travertino 0xd9d0bf, rugosidade 0,75, textura leve de veios | molduras (Sede, Conselho), pódio da Torre, degraus d'água, teto de Humanidades | 1 |
| `bronze` | 0x6b5236, rugosidade 0,35, metalicidade 0,9 | aletas da Torre e da Sede, pergolados | 0,5 |
| `vidroLanterna` | vidro leitoso com emissivo em gradiente (animado no `ciclo.js`) | coroa da Torre, óculo da Cúpula, esfera da Biblioteca | não |
| existentes | `concretoClaro`, `laca`, `ouro`, `madeiraClara`, `mesh`, `pool`, `planter`, `glass` | resto | já definidos |

Sem `envMap` (qualidade Leve), o `vidroCortina` cai para rugosidade 0,3 e metalicidade 0,2, para não ficar preto.
O verde saturado de teto (`roof` como grama) sai dos tetos de laje. O verde passa a ser só vegetação em volume
(copas instanciadas) e gramado no chão.

---

## 11. Orçamento e modelagem barata

Regras: uma malha por material depois da fusão (como hoje: `Faixa.refresh` e a fusão por quadrante do `mundo.js`),
repetições em `InstancedMesh` (caixas, aletas, colunas, pilares, árvores) e textura para o detalhe fino.

| Prédio | Técnica | Triângulos Média | Triângulos Ultra | Hoje (medido) |
|---|---|---|---|---|
| Torre Lâmina | extrusões por bloco; aletas na textura (Média) ou instanciadas (Ultra) | 4 mil | 9 mil | não medido (torno de 24 lados; estimo 6 mil) |
| Sede (faixa, torres, cobertura) | varredura `moldura`; torres em extrusão; escamas na textura | 14 mil | 25 mil | 19,4 mil |
| Anel (8 módulos, 2 tambores) | varredura `cortina`/`terraco`; caixas instanciadas | 24 mil | 40 mil | 30,6 mil |
| Escola, campo e arena | varredura e pilares instanciados | 11 mil | 18 mil | 20,5 mil + 3,5 mil |
| Universidade e Ciências | varredura `celular`; labs; laje ondulada | 12 mil | 20 mil | 14,0 mil + 2,8 mil (gramado) |
| Biblioteca, anelBib e CRD | placa dobrada, esfera ico 3, varredura | 15 mil | 25 mil | 29 mil |
| Vida (Cúpula, Estufa, Supertrees, santuário) | torno e textura alfa; troncos torneados | 20 mil | 35 mil | 21,7 mil + a cúpula |
| Contorno (Onda, Elo Norte, Vila, Humanidades) | varredura com rampa; caixas instanciadas | 16 mil | 25 mil | 27,1 mil |
| Eixo (colunata, Marco, pontes, bulevar) | instâncias e tubos | 9 mil | 15 mil | não medido |
| Acelerador e Física | tubos e pilares em V | 8 mil | 12 mil | 9,5 mil |
| Lago (margens e degraus) | varredura | 6 mil | 10 mil | não medido |
| **Total da Arcologia** | | **cerca de 140 mil** | **cerca de 235 mil** | mais de 185 mil medidos (sem Torre, Cúpula, praça, CRD e lago) |

A vegetação instanciada (copas, arbustos, juncos) fica com a frente visual. Chamadas: os materiais novos somam 4 a
cada grupo fundido. A meta da Arcologia é de até 45 chamadas na Média, com a fusão por quadrante. Na vista da cidade
(dist 230) entra um LOD1 da Arcologia: blocos com a textura da fachada, sem aletas, caixas nem árvores de terraço,
com cerca de 25 mil triângulos.

---

## 12. Plano de implementação em parcelas

Ordem pensada para entregar primeiro o que o dono mais notou (a Torre) e para que cada parcela possa ser publicada
sozinha. Todas terminam com: `node ferramentas/montar.mjs` sem avisos, `simular --testes` ok, robô com `cap 6`,
`vida 100` e `erros []`, e capturas só do que mudou. Onde a parcela mexe em geometria das fitas, rodar
`teste-planta.mjs` e `conexoes.mjs`.

| # | Parcela | Arquivos | Aceite (captura e medida) | Tamanho |
|---|---|---|---|---|
| A1 | **Torre Lâmina** | `data/planta.js` (TORRE), `render/models/centro.js` (`torreHolding`), `render/aereo.js` (rota do HeliHolding), `ui/extras.js` (lugar Torre e lago), `data/obras.js` e `data/historia.js` (textos de sede.e4) | `b1-torre` antes e depois; `m-alta-foto`; noite (`c6-noite`); robô com o helicóptero pousando (pouso na laje); Torre com até 4 mil triângulos na Média; `teste-planta` com o pódio dentro da ilha | M |
| A2 | **Câmera padrão** | `data/planta.js` (VISTA_FOTO com y), `main.js` (`vistaFoto` e `flyTo` com alvo y), `render/camera.js` se preciso | `vistaFoto` em 986x443 e 1376x768: topo da Torre entre 0,70 e 0,85 da meia altura e pista sul visível; vitrine-ui sem erros | P |
| A3 | **Faixa 2 (contrato)** | `render/models/faixa.js` (`andares`, `perfil`, `prof.fora/dentro`, `caixas`, `fendas`, `pontes`, `coroa`), `render/models/aneis.js` (defDe e FaixaMod), `jogo.js` (alturaTopo com i), `ferramentas/conexoes.mjs`, teste novo no `simular.mjs` | com os valores padrão, capturas iguais às de hoje (diferença de pixels perto de zero em `m-alta-foto` e `c1-cap1`); testes ok; robô ok | G |
| A4 | **Materiais de arquitetura** | `render/materials.js` (vidroCortina, pedra, bronze, vidroLanterna, PINTA), `render/textures.js` (cortina com montantes e janelas acesas) | cena de amostras com a luz do dia e da noite; qualidade Leve sem vidro preto; pintura do jogador na pedra e nos caixilhos | P |
| A5 | **Anel Mestre e Sede** | `data/planta.js` (ALT_ e perfis do anel e da sede; TAMBOR), `render/models/aneis.js` (anel, sede), `render/models/faixa.js` (tambor de vidro e Torre do Conselho no nó), `render/models/centro.js` (pórtico) | `m-alta-foto` com o anfiteatro e o tríptico; `b1-torre`; obra de um módulo do anel com operários (`cap-obra.mjs`, com `ini` no passado); `c1-cap1` (gabarito igual); anel até 26 mil e sede até 15 mil na Média | G |
| A6 | **Biblioteca e Vida** | `render/models/biblioteca.js`, `render/models/cupula.js`, `render/models/aneis.js` (anelBib, santuario), `render/models/praca.js` (Trilha e Skyway) | `b3-bib`, `b4-vida` e noite com o vórtice e as Supertrees acesas; a Cúpula sem bichos à vista | G |
| A7 | **Universidade e Escola** | `render/models/aneis.js` (escola, engenharia, uni, instituto), `render/models/centro.js` (Ciências), `render/models/campus.js` (campo, arena, pátio) | `b6-uni` e `b2-so`; a pista passa sob a Ponte Coberta como hoje | M |
| A8 | **Contorno, eixo e água** | `render/models/aneis.js` (onda, uniElo, casas, humanidades), `render/models/praca.js` (colunata, Marco, ponte Helix, bulevar), `render/models/centro.js` (lago: degraus d'água), `render/models/leste.js` (anfiteatro) | `b5-praca`, `b7-norte` e `m-alta-foto`; casas com as caixas dentro da pegada; colunata com instâncias (1 chamada) | G |
| A9 | **Acelerador e Física** | `render/models/leste.js` (tubos e pilares), `data/planta.js` (seção do crescente), opcional `render/ground.js` (ondas) | `b7-norte` e `b8-topo`; linha de luz contínua | M |
| A10 | **Noite, LOD e orçamento** | `render/ciclo.js` (lanterna e linhas), `render/mundo.js` (LOD1 da Arcologia na vista da cidade), painel de desempenho | `m-media-cidade` e `m-ultra-cidade` com `engine.stats`: Poco Média até 300 chamadas e 900 mil triângulos; PC Ultra até 1.500 e 5 milhões | M |
| A11 | **Textos, README e publicação** | `data/obras.js`, `data/historia.js`, `data/rotulos.js`, README (seções da cidade e de gráficos com números medidos), `docs/VISAO.md` (fase 1.3) | verificação completa (skill `verificar-e-publicar`), dois commits | P |

Dependências: A3 vem antes de A5 a A8. A4 pode andar junto com A1 e ajuda A1 a A8. A2 depende de A1 (a altura
final). A10 fecha depois de tudo.

---

## 13. A cidade em volta (para a próxima fase, mesma régua)

O pedido fala em "cada tipo de construção". Os prédios da cidade (`render/cidade.js`) seguem os mesmos princípios.
Mapa de referências para quando a frente da cidade for refeita:

| Tipo do jogo | Referência real | Ideia principal |
|---|---|---|
| Residencial de Luxo (`cidLuxo`) | 111 West 57th, 432 Park | prisma esbelto com heliponto; mais baixo e mais simples que a Torre (nunca competir com ela) |
| Torre residencial (`cidTorre`) | Marina One, Punggol | faces de fora retas e jardim a cada 4 pavimentos |
| Edifício em terraços (`cidTerraco`) | Interlace, Kampung Admiralty | blocos cruzados e teto-parque |
| Casas (`cidCasas`) | Habitat 67 em escala pequena | caixas empilhadas com teto-jardim |
| Escritório e Banco | Bloomberg, Torre Reforma | moldura de pedra e aletas; parede cega de concreto e face de vidro |
| Prefeitura | Congresso e Esplanada | lâminas e pórtico no fim de um eixo gramado |
| Escola e Faculdade | Kampung Admiralty, Stanford SEQ | teto em degraus e arcadas |
| Hospital | Kampung Admiralty (sanduíche de funções) | pódio de atendimento, jardim no meio e moradia em cima |
| Estádio | Mané Garrincha | peristilo de pilares e anel de cobertura solar |
| Shopping | Jewel Changi | toro de vidro com jardim e cascata |
| Aeroporto e Porto | Jewel, Marina Barrage | cobertura contínua caminhável, verde sobre a infraestrutura |

---

## 14. Resumo das decisões

1. Torre recomendada: variante B, **Torre Lâmina**, com 3,2 x 4,4, 26,0 no heliponto, três blocos de 12 pavimentos e
   um de 6 separados por andares de vento, face sul em penas, lanterna acesa e heliponto em balanço.
2. Hierarquia: 26 / 12 / 6,5 a 7,5 / 1,5 a 6,0, com as Torres do Conselho nos tambores NO e NE.
3. Planta do Trevo intacta. Mudam `ALT_`, perfis, `TORRE` e `VISTA_FOTO` (dist 80, 0,50 rad, alvo (0; 5; -2), fov 38).
4. Faixa 2: níveis separados de andares, perfis em degraus, tipologias por face, caixas, fendas, coroas e pontes, com
   os mesmos módulos e ids.
5. Cada folha e cada peça do eixo ganha um megaprojeto de régua: Diamante com olho (Biblioteca), toro com vórtice e
   Supertrees (Vida), laje ondulada e labs de malha (Universidade), parque em degraus e arena de pilares (Escola),
   caixas empilhadas (Vila), teto-praça (Humanidades), colunata de 4 fileiras (praça), treliça em favo (Marco), ponte
   em hélice (ilha), tubos sobre pilares (Física) e degraus d'água (lago).
6. Materiais novos: vidro de cortina, pedra, bronze e vidro-lanterna. Sai o verde de teto de laje e o colorido de
   brinquedo.
7. Orçamento: cerca de 140 mil triângulos na Média e 235 mil no Ultra na Arcologia, até 45 chamadas na Média, e LOD1
   de 25 mil na vista da cidade.
