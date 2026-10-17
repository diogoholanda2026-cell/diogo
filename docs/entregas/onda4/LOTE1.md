# LOTE1. O pátio do lote se molda ao relevo (terraplenagem natural)

Entregue em 17/10/2026. Simulação e render; nada em `fonte/ui`, `contratos/` nem `app/`. Não commitado.

## O problema

A plataforma do lote era um polígono plano na cota do centro, com faixa plana de 8 m e rampa de 16 m (smoothstep). Num declive de 22%
isso dava um patamar largo e uma rampa íngreme (declive do chão de 0,76 m por m, até 5,1 m de terra movida), e entre dois lotes
ou entre lote e via o chão trocava de uma forma para a outra de uma vez (degraus de até 4 m).

## O que mudou

**Perfil novo da plataforma** (`fonte/sim/mundo/aplainar.js`, constantes em `LOTE`):
- A pegada do prédio continua plana e exata na cota dele (o prédio é rígido e o espelho jura que a cota é o chão no centro).
- Em volta, o pátio sobe em 10 m (`subida`) para um plano inclinado ajustado ao terreno natural por mínimos quadrados (`ajustarPlano`,
  preso ao centro, declive máximo 0,5), com corte/aterro limitado a 2 m (`corte`, saturação C1, sem exp).
- Dali o talude mistura o pátio com o terreno natural por smoothstep numa largura proporcional ao desnível (8 m por metro, mínimo
  4 m, até o alcance de 24 m). Colado na pegada há uma margem de 1,5 m (calçada e fundação).
- Os cantos já saem arredondados: a distância ao polígono é circular fora dele.

**Mistura em vez de troca** (`misturar`): pátios de lote (formas com `plano`) deixam de disputar "o mais perto vence" com as outras
formas. Dentro do núcleo de uma forma vale só ela (via antes de plataforma, depois a de menor ref, como sempre); fora dos
núcleos a média de Shepard com peso 1/d² que cai a zero no alcance. Nenhuma forma troca de vez com a vizinha, então não há degrau
entre lote e lote nem entre lote e via. As vias entre si seguem na disputa antiga (a S1b não mudou). Junto de uma via o pátio só
abaixa o chão (nunca terra do lote acima do chão da rua, até 8 m da pista, voltando a poder subir nos 8 m seguintes): é o que
mantém o teste de chão 5 cm abaixo da pista na Vila. A ordem dos candidatos é canônica (ref, tipo, cota, caixa), então a soma não
depende da ordem de registro, nem na última casa.

**Registro sem mexer em quem registra** (`fonte/sim/formas.js`): `sim.formas.registrar` aceita `plano: [gx, gz, cx, cz]` na
plataforma; quando chega sem ele, o gancho `sim.formas.moldar` (ligado por `aplainar.registrar`) ajusta o plano ao terreno natural.
Por isso `construir`, o crescimento de zona, a Vila e o mover não mudaram de chamada; só `blocos.js` e `mover.js` passaram a
guardar o `plano` ao desfazer e restaurar. Quem quiser o perfil antigo passa `reto: true`.

**Custo do aplainar** (`fonte/sim/predios.js`): o volume que `conferirLugar` cobra agora soma o volume do pátio e do talude
(`volumeDoPatio`, amostras de 4 m, só quando o declive passa do livre). Continua proporcional ao volume movido
(`custoM3` igual); em terreno plano o pátio custa zero.

**Render** (sem chamada nova; usa o uso do solo que já existe):
- `fonte/comum/lote.js` (novo): `raioDoCanto`, `distLote` (retângulo de cantos arredondados, raio de 1/5 do lado menor entre 2 e
  6 m) e `contornoDoLote`.
- `render/mundo/terreno.js`: o piso, a terra e o gramado do lote são pintados pela distância arredondada (antes, caixa reta). Em
  declive de 6% ou mais, uma faixa de até 7 m de terra nua (o talude) é pintada em volta, mais forte onde o lote encara a subida ou a
  descida e some ao longo da curva de nível. Uma leitura de declive por lote, não por texel. `caixaPredio` ganhou 4 m de folga
  para o talude pintado entrar no retângulo sujo.
- `render/geracao/planoPredio.js` (`bate`): árvores e carros do lote não ficam no canto cortado.
- `render/sobreposicoes/ferramentas.js`: a marcação do fantasma no chão é o contorno arredondado (a mesma linha, mais segmentos).

## Save

Nenhuma migração. A forma ganhou um campo opcional (`plano`); o save genérico o leva e o hash o cobre. Save antigo carrega com
as plataformas sem `plano`, que seguem no perfil antigo (reto) até o prédio ser movido, refeito ou desfeito. `versaoSave` segue 4.

## Testes e medidas

`ferramentas/testes/lote-curva.teste.mjs` (14 testes): pegada plana e exata; declive forte, côncavo, convexo e sela (declive do chão
no máximo natural + 0,3 e nunca maior que o perfil antigo; terra movida menor); plano de mínimos quadrados e limite de inclinação;
largura do talude cresce com o desnível e é contínua; perto de via e de outro lote (sem degrau novo, comutativo); perfil antigo
preservado; validação da forma; simulação (plano no registro, chão no centro, save e hash iguais); custo com o pátio; contorno
arredondado; via só recebe abaixamento.

Num declive de 22% (lote 24 x 16): declive máximo do chão 0,47 (antes 0,76), terra movida no máximo 3,3 m (antes 5,1 m); entre três
lotes de cotas diferentes, 1,85 m por 2 m (antes 4,0).

- `simular.mjs --testes`: ok (tudo, inclusive `vias` e a guarda de texto). `--determinismo`: ok (3 marcos, com save). `montar.mjs`
  numa pasta temporária: sem avisos (jogo 2347,1 KB para o teto de 2355 KB).
- Registrar 1849 lotes: 0,12 ms por lote; `aplainarTudo` 70 ms. A bancada A5 não rodou: nada do tique mudou (o aplainar só roda
  ao construir, mover, demolir e carregar).
- Capturas (fora de `previa/`): `docs/entregas/onda4/cap/lote1-vila-antes.png` e `lote1-vila-depois.png`, a Vila em
  encosta de 15% (terra nua nas bordas, cantos suaves). Nenhum objeto de desenho novo no código; as chamadas medidas na captura oscilam de 24 a 52 entre rodadas do mesmo quadro no SwiftShader (quadro único, menu e dicas), então não servem de medida: a medida certa é a bancada.

## Para o dono confirmar

1. **O prédio continua em pegada plana**, com pátio inclinado só em volta. Plano inclinado sob o prédio exigiria fundação em
   escada ou pilotis (as paredes só descem 1 m, `ENTERRA`). Se quiser casas em socalcos ou pilotis nas encostas, é outra obra.
2. **Corte/aterro máximo do pátio 2 m e talude de 8 m por metro** (ajustáveis em `LOTE`). Mais corte deixa o pátio mais plano e o
   talude mais alto; menos deixa o chão mais íngreme em volta.
3. **Junto de vias o pátio só abaixa o chão.** Foi o preço de manter a rua mandando (e o teste de chão da S1b). Pátio de lote
   acima da rua só aparece a partir de uns 16 m da pista.
4. **O muro da frente continua reto** (peças retas do plano); só o chão, as árvores, os carros e a marcação seguem a forma
   arredondada. Curvar o muro pede peças novas e mexe em muitos modelos.
5. **Lotes antigos de saves já feitos ficam retos** até serem refeitos. Dá para migrar tudo (regenerar o plano de todas as
   plataformas ao carregar) se preferir; muda o chão de cidades já jogadas.
6. A cena de captura `servicos` ainda aplaina o chão do jeito antigo (ela roda sem simulação; o render não importa `sim/`).
