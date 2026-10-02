# Sede v3: Park of Future Dreams (D88)

Modelo 3D feito pelo dono e compartilhado em 02/10/2026 (artifact `https://claude.ai/artifact/Pv11E7f9um3S1tPetg9MMu`,
título "Park of Future Dreams"). Substitui a sede v2 (D63 e a ilha das torres da D64). Abaixo, a geometria lida no
modelo e as mudanças que o dono pediu nas respostas. Medidas em metros; ângulos e coordenadas como no modelo (a
parcela confere a convenção no artifact). A posição no mapa e a orientação saem na parcela de implantação (SEDE3).

## 1. Geometria do modelo

| Peça | Medida no modelo |
|---|---|
| Disco do terreno | raio 1.400 (2,8 km com avenidas e floresta) |
| Anel externo | eixo no raio 729 (1,46 km de diâmetro), 60 de fundo (699 a 759), **160 de altura, 25 andares**, uns **6,9 milhões de m²** |
| Anel interno | eixo no raio 442,5 (0,89 km), 50 de fundo (417,5 a 467,5), **120 de altura, 19 andares**, uns **2,6 milhões de m²** |
| Pódio central | redondo, raio 84, 40 de altura, centro em (26, 15), com praça no topo e 4 escadas rolantes de vidro |
| Torre central | 500, em (0, 0); no modelo, inspirada no Burj Khalifa |
| Torre irmã | 452, em (55, 32); no modelo, inspirada nas Petronas |
| SkyPark | ponte-jardim entre as duas torres a 330; mirante a 420 |
| Cachoeiras | duas, de 40, a 60° e a 240°, do pódio para o lago |
| Lago em anel | raio 84 a 99, em volta do pódio |
| Anel de floresta | raio 100,5 a 114 |
| Biblioteca | 300, no raio 285, a 200° (Black Diamond de Copenhague e Tianjin Binhai) |
| Administração | 180, no raio 285, a 80° (Simpson Querrey) |
| Laboratórios | 180, no raio 285, a 320° (Torre Generali, de Zaha Hadid) |
| Faculdade (arco) | raio 325 a 355, de 120° a 170°, 26 de altura (sai, ver seção 2) |
| Escola (arco) | de 240° a 290°, 18 de altura (sai, ver seção 2) |
| Avenidas radiais | 8, a cada 45°, do raio 110 ao 1.350 |
| Caminhos em anel | raios 480, 688 e 792 |
| Subsolo | data centers em grade de 3 x 3 sob as torres, anel de resfriamento e **acelerador de partículas** em toro de raio 330 (660 de diâmetro) a 48 de profundidade, com 4 salões |

## 2. O que o dono mudou (respostas de 02/10/2026)

1. **Substitui a sede v2 inteira.** Nome: **Park of Future Dreams**, em inglês. **Toda construção tem nome em inglês**
   (os textos da interface seguem em português do Brasil).
2. **Uso dos anéis:**
   - **Anel externo:** a **faculdade e a escola**, com salas, refeitórios, quadras, piscinas e dormitórios de descanso.
   - **Anel interno:** os **escritórios da Holding**.
   - **Entre os dois anéis** (raio 467,5 a 699): as torres da **biblioteca**, dos **laboratórios** e da
     **administração**. Os ângulos do modelo (200°, 320° e 80°) são o ponto de partida; a implantação desvia das 8
     avenidas.
   - Os dois arcos baixos da faculdade e da escola saem. Dentro do anel interno fica o **parque** que dá nome à sede,
     com o pódio, as torres, as cachoeiras, o lago e a floresta.
3. **Torres:** as do modelo marcam só a **posição**. O desenho é o que fizer mais sentido com o resto da construção (em
   diálogo, regra D78). **As fontes dançantes continuam**, junto com as cachoeiras, no lago em anel.
4. **Escola:** resolvida pelo item 2 (vai para o anel externo).
5. **No mapa:** o anel externo é o **limite da sede**. As 8 avenidas radiais seguem para a cidade, e a floresta além do
   anel vira parque e bairros. O complexo (Santuário, arenas, shopping, marina) fica fora do anel, ao longo das avenidas.
   O trecho de avenidas da F1 (40%, uns 2,5 km) usa um **arco do anel viário em volta do anel externo**; o trecho
   permanente segue em S entre as esferas e pelo túnel (D81), e a volta continua com 6,2 km.
6. **Acelerador de partículas** no subsolo: confirmado, projeto secreto do **Caio Montenegro** (diretor científico),
   junto com os data centers.

## 3. Forma dos anéis (pedido do dono)

Referências: **Apple Park** e a **sede da McLaren** (McLaren Technology Centre, de Norman Foster), **encaixando a
vidraçaria e a faixa de LED** do modelo.

- **Apple Park (Cupertino):** anel contínuo, sem cantos; fachada de **vidro curvo do chão ao teto**, em painéis grandes;
  uma **marquise branca e fina em balanço em cada andar**, que faz sombra e marca linhas horizontais; telhado com
  painéis solares; pátio interno como parque. Medida no OpenStreetMap: 481 m de diâmetro por fora, 30 m e 4 andares.
- **McLaren Technology Centre (Woking):** fachada contínua de **vidro curvo voltada para um lago**, com a cobertura fina
  saliente; o lago faz parte do resfriamento do prédio.
- **No jogo:** os dois anéis com a pele de vidro curvo e as marquises brancas em cada andar (25 linhas no externo, 19
  no interno), a **faixa de LED** contínua no meio da altura, como no modelo, e o teto com painéis solares. O lago em
  anel e o anel de resfriamento do subsolo fazem o papel do lago da McLaren. Nada de cantos retos: a leitura é de
  linhas horizontais longas e curvas, o oposto das formas "quadradas e robóticas" que o dono proibiu.

## 4. Em diálogo (regra D78)

Nomes em inglês de todas as construções, o desenho das torres (500, 452, biblioteca, laboratórios e administração), as
fases do anel externo e a nova posição da Torre Lúculo (o lago da v2 saiu). Só depois disso a parcela SEDE3 refaz
`fonte/data/arcologia-plano.js` e `fonte/render/arcologia/`.
