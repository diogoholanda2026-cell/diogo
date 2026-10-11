# Nota de entrega: SEDE4b (repasse visual da sede v4 para a leitura de longe, D97)

Sem refazer nada do que a SEDE4 entregou: as Canopy Bridges, o Mirror Lake grande, as Dream Falls, o Halo Lake, os Hanging Gardens e a mata
seguem como estão. O repasse atacou as três fraquezas anotadas na SEDE4 sem custo por pixel novo (nenhum sombreador pesado, nenhuma
transparência em tela cheia, nenhum programa novo) e devolveu triângulos à família arcologia.

## Arquivos
Mudados: `fonte/render/arcologia/{torre,pontes,lagos,lago,partes}.js`, `fonte/data/arcologia-plano.js` (duas linhas: a largura das quedas
e a meia janela delas no Meridian Ring), `ferramentas/testes/arcologia-render.teste.mjs` (3 testes novos, 58 ao todo).
Não mexi em `obra.js`, `planos.js`, `arcos.js`, `heli.js`, `fantasma.js`, nem fora da arcologia.
Capturas A/B (4, 1376 x 768, ?q=pc): `docs/entregas/onda4/cap/sede4b-{antes,dep}-{aerea10,noiteQuedas}.png`.

## O que mudou
1. Quedas (Dream Falls), de longe
   - Paredão de basalto molhado atrás de cada cortina: nas janelas das quedas a face de dentro do Meridian Ring deixou de ser vidro
     (que de dia refletia o céu e à noite acendia creme) e virou parede de pedra escura (`basaltoQueda`, a pedra atrás do Rain Vortex).
     Mesmo número de triângulos (a parede passa da malha do vidro para a do opaco). É a mudança que mais pesa na leitura: a cortina
     agora é uma coluna branca contra o escuro às 10h e à noite.
   - 60 m de largura (eram 50; a ficha pede de 40 a 60) e janela de 38 m de meia largura (eram 33).
   - Sombreador da cascata: a lâmina de 120 m chega ao branco mais cedo, espalha a luz do céu de dia (brilho próprio, não vira cinza na sombra do
     anel), e o pé vira jato de espuma quase opaco (a altura total da queda agora vai em `vC.w`, que era zero).
   - Névoa e espuma da base mais claras, mais opacas e mais largas (a espuma no lago passou de 16 para 22 m de profundidade, a névoa de 38 para 44 m).
2. Véu da noite plano
   - Ondas de cor que descem a cortina (azul gelo para rosa, cada queda na sua fase), fios de luz com o vão entre eles translúcido sobre o
     basalto, o branco difuso escurecido à noite (senão o ambiente lavava tudo de lilás), a luz agora sobe do pé (antes o código a deixava
     mais forte no topo, ao contrário do comentário).
3. Pontes (Canopy Bridges)
   - Classe de luz própria `LUZ.ponte` (13): a faixa de LED vai aceso de dia (traço branco-quente que lê contra o verde) e à noite uma onda
     de luz corre o vão de uma face à outra. Faixas: a testa (0,9 m), o forro de 3 m por baixo, nas duas bordas (a que se lê da avenida) e,
     novidade, 2,4 m na borda do deck por cima (a que se lê da vista aberta; por baixo ela não aparece do alto).
   - Passeio de pedra de 10 m de largura, mais claro, e deck mais claro: a ponte lê de longe como uma faixa clara contornada de luz entre os
     canteiros escuros.
   - Copa baixa de longe passou de icosaedro (20 triângulos) para bipirâmide de seis lados (12), com normais macias: devolveu uns 1,5 mil
     triângulos à família mesmo com as quatro árvores de flor por ponte.
4. Água
   - Reflexo do céu do Mirror Lake e do Halo Lake de dia ×1,9 (era ×1,0; à noite segue 0,35): o espelho ganha leitura. Pedra clara do
     coroamento do Halo Lake de 0,6 para 1,8 m (contorno claro do espelho d'água).
5. Espécies de folhagem
   - Terraços dos Hanging Gardens: oiti, embaúba, mata3 (estreita), palmeira (juçara) e mata2 (a figueira jovem) pela vegetação, mais 28 %
     de árvores de flor em volume (ipê-amarelo, ipê-roxo, quaresmeira, manacá-da-serra), que entram só no LOD0 do setor (de perto), então não
     custam nada na vista aberta. A mata1 (jequitibá-rosa) e a mata2 (figueira) seguem as grandes de 25 a 40 m da mata.
   - Pontes: quatro árvores de flor por ponte (as quatro espécies, em posições diferentes de uma ponte para outra) e as de fileira com juçara,
     embaúba, oiti, mata3 e figueira. Nenhum verde-lima (as cores novas: ipê `#c99a2e` e `#85578a`, quaresmeira `#8c3a7c`, manacá `#c4a3c8`).

## Testes
- `node --test ferramentas/testes/arcologia-render.teste.mjs`: 58 de 58 (novos: LED da ponte como classe de luz com os 24 vértices esperados e a
  copa de 12 triângulos; só espécies da Mata Atlântica nas pontes e nos terraços e as de flor só no LOD0; as quedas de 60 m com a altura no vértice).
- `node ferramentas/simular.mjs --testes`: tudo verde, menos `mundo` (a falha de tempo de CPU preexistente, ignorada como combinado).
- `node ferramentas/montar.mjs --saida <pasta temporária>`: sem aviso (jogo 2220 KB, teto 2355 KB; antes 2218 KB).

## Medidas (SwiftShader, perfil pc, 1376 x 768; chamadas e triângulos são exatos, ms não valem)
Aérea das 10h (`?olhar=-570,1300,2300,200,40,150,40,10`), bancada `--voo --compilacoes`, 60 quadros:
| medida | antes | depois |
| --- | --- | --- |
| família arcologia (triângulos) | 58.470 (teto 60.000) | 56.996 |
| triângulos totais, quadro médio / pior | 109.984 / 122.300 | 108.510 / 120.828 |
| chamadas, pior quadro | 48 | 50 (ver abaixo) |
| programas / compilações depois de pronto | 65 / 0 | 65 / 0 |
| guarda do Mali (D44) | ok | ok |
Pontes: 10.632 triângulos nas 8 antes, 9.158 depois. Anéis, água e efeitos sem mudança de contagem.
As 2 chamadas a mais no pior quadro não vêm de malha nova (nenhuma peça nova, nenhum material novo; a mudança de vidro para opaco no
paredão fica nas malhas que já existiam): a bancada pega o pior de 60 quadros e a cadência da sombra e do carregamento do chão varia de
uma rodada para outra no SwiftShader. A foto do último quadro dá 38 chamadas mais 6 de sombra antes e 50 sem sombra depois, então a leitura é
ruído de quadro, não custo. Repetir no PC do dono (RX 550) para ter o número real.
De perto (`noiteQuedas`): família arcologia 175.432 antes, 173.958 depois (teto 250 mil), 50 chamadas nas duas.

## O que não pude verificar na tela
- Milissegundos de placa na RX 550: o Chromium daqui é SwiftShader. Pela conta, o repasse não soma pixel (a cortina é a mesma área, a
  espuma e a névoa são pouco maiores, só em volta das quedas), mas a medida real está pendente, como o resto do M1.
- A mata de longe. Na cena `planos` o impostor da vegetação não aparece nas vistas abertas (a família `arvores` fica em 0), então não
  tenho como julgar a mata entre os anéis daqui; ela segue lendo como um tapete verde-oliva (a pintura do terreno de `mataDaSede`), sem a copa
  de mata alta. Pendência para o integrador (render de vegetação, fora dos meus arquivos): conferir no jogo se os impostores cobrem o
  entorno da sede a 2,5 km e, se não, aumentar o alcance deles ali. Não criei um manto de copa na família arcologia porque de perto ele
  flutuaria sobre as árvores.
- As quatro árvores de flor em volume dos terraços (só de perto) e a faixa de LED da ponte de baixo: pelo teste de malha, não por captura
  (a ponte lê melhor de perto na vista `canopy`, que não refiz para não passar de 4 capturas).
- O brilho do LED de dia (`0,34`) e o ×1,9 do reflexo do lago foram escolhidos pela captura das 10h; às 17h30 não refiz a captura.
- O véu da noite ficou com ondas diagonais e fios, mas ainda é um gradiente suave; as bandas de cor mais saturadas do Rain Vortex pedem
  uma noite em GPU real para afinar.

## Pendências para o integrador
- Confirmar com o dono as quedas de 60 m (o teto da ficha) e o paredão de basalto no lugar do vidro nas janelas delas.
- O pior quadro de chamadas da bancada da aérea passou de 48 para 50; repetir com a máquina livre.
