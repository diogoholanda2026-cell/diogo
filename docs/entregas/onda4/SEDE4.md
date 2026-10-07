# Nota de entrega: SEDE4 (sede v4, Park of Future Dreams, D97)

## Arquivos
Mudados: `fonte/data/arcologia-plano.js`, `fonte/render/arcologia/{lago,partes,planos,torre}.js`, `fonte/render/cenas/planos.js`.
Novos: `fonte/render/arcologia/{arcos,lagos,pontes}.js`.
Testes: `ferramentas/testes/arcologia-render.teste.mjs` (55 testes, 14 ajustados para a v4 e 7 novos), e uma linha de coordenada em
`ferramentas/testes/arcologia.teste.mjs` (o ponto de prova da cava passou do anel d'água do pódio para o Mirror Lake grande).
Nada em ui, em sim fora do que já existia, nem em relevo assado: a cava do lago grande entra pela forma `cava` do aplainar (`cavaDoPlano`).

## O que foi publicado
- Plano: 8 `ponte` (Canopy Bridge I a VIII, tabuleiro a 66 m, 30 m de largura, arco raso com flecha de 8,8 m), 8 `bacia` (Halo Lake,
  645 a 695 m, cortado nas avenidas), `lago` (Mirror Lake grande de 150 m a uns 330 m, 4 ilhas, 4 enseadas, 8 pontes baixas de pedra),
  4 `queda` (Dream Falls de 120 m), `anelDeAgua` do pódio mantido (bacia à altura do chão, fontes e as 2 quedas de 40 m).
- Dado da faixa de LED (D93) no plano: `HORIZON.led = { y0: 51.2, y1: 108.8, andares: 9 }`, `MERIDIAN.led = { y0: 37.9, y1: 82.1, andares: 7 }`;
  `torre.js` lê `andaresLed` do dado. Hanging Gardens: `terracos { linhas, recuo }` nos dois anéis (face de dentro recua, a de fora segue vidro).
- Codex (180 graus), Helix (315) e Compass (90) no eixo da avenida, raio 583, com pórtico de 40 x 18 m; a avenida de 270 (portão norte) ficou livre.
- Vistas novas da cena `planos`: `canopy`, `canopyTopo`, `quedas`, `noiteQuedas`; `parque` refeita.
- Mata: `mataDaSede` com mata de 0,8 a 0,94 (nunca o gramado limpo; o teste VIS1c de terreno exige 0 ou 0,8 ou mais), ilhas, margem, bosque entre os anéis
  aberto nas avenidas, caminhos e bases das torres. Espécies pela vegetação (R2b), grandes de 25 a 40 m em 1 de cada 9.

## Desvio da ficha (pedir confirmação ao dono)
A ficha põe as 4 quedas em 45, 135, 225 e 315 graus, mas as 8 avenidas são a cada 45 graus: esses ângulos são eixos de avenida. As Dream Falls
ficaram a 67,5, 157,5, 247,5 e 337,5 graus (entre duas avenidas, a 22,5 graus de cada uma), e as 4 ilhas nos outros 4 setores (22,5, 112,5, 202,5, 292,5).
As Supertrees caíram de 15 para 10 (3 bosques de 4, 3 e 3) para dar lugar ao lago grande.

## Testes
- `node --test ferramentas/testes/arcologia-render.teste.mjs`: 55 de 55.
- `node ferramentas/simular.mjs --testes`: verde inteiro (fim 0, "testes ok").
- `node ferramentas/montar.mjs --saida <pasta temporária>`: sem aviso (jogo 2158 KB, teto 2355 KB).
- Novos testes: 8 pontes nos eixos e na altura das faixas de LED; 3 torres no eixo com pórtico; lago grande, ilhas e enseadas; 4 quedas
  de 120 m fora das avenidas; Halo Lake fora do corredor das avenidas; Hanging Gardens; tetos de triângulos; cava do lago grande.
- Ajustes em testes de outras parcelas: só a coordenada do ponto de prova em `arcologia.teste.mjs` (X1b).

## Orçamento (SwiftShader, perfil pc, 1376 x 768; pela proporção, não em ms de RX 550)
| vista | chamadas antes / depois | triângulos totais antes / depois | família arcologia antes / depois | compilações depois de pronto |
| --- | --- | --- | --- | --- |
| aérea (10h e 17h30) | 28 / 28 | 92 mil / 105 mil | 42 mil / 54,6 mil (teto 60 mil) | 0 |
| parque de perto | 41 / 40 | 169 mil / 199 mil | 61,6 mil / 71,7 mil (teto 250 mil) | 0 |
| canopy (pior caso de perto) | n/a / 46 | n/a / 337 mil | 180,6 mil (teto 250 mil) | 0 |
| noite das quedas | n/a / 49 | n/a / 344 mil | 171,5 mil | 0 |
Bancada (voo, 60 quadros): aérea pior caso 56 chamadas e 106 mil tri antes, 56 chamadas e 118 mil tri depois, 64 programas nas duas, 0 compilações depois de pronto.
Mata de longe pelos impostores da vegetação; nenhum programa novo (as quedas usam o material da cascata da SEDE3).
Avenida (bancada): antes 71 chamadas e 208 mil tri no pior quadro, 0 depois de pronto. A bancada "depois" da avenida não terminou (a máquina estava carregada por outras parcelas e a rodada foi cortada); a leitura equivalente é a captura `dep-canopy` (46 chamadas, 337 mil tri, 0 compilações). Repetir a bancada da avenida com a máquina livre.

## Capturas (1376 x 768, ?q=pc, `cap/` desta pasta)
Antes: `antes-aerea10.png`, `antes-aerea1730.png`, `antes-avenida.png`, `antes-noite.png`, `antes-parque.png`.
Depois: `dep-aerea10.png`, `dep-aerea1730.png`, `dep-canopy.png` (a avenida com a ponte acima), `dep-noiteQuedas.png`, `dep-parque.png`.
Julgamento: os dois anéis leem como um conjunto com 8 pontes brancas finas entre eles, o lago com ilhas de mata aparece na aérea sem zoom,
as quedas aparecem como cortinas claras nas faces do Meridian, a mata é de verdes variados (sem verde-lima). Ponto fraco: de perto a
folhagem dos terraços ainda é de poucas espécies e o véu das quedas à noite está mais chapado que o Rain Vortex; fica para um repasse da VIS.

## Pendências para o integrador
- A X1b deve registrar a cava com `cavaDoPlano` (já é o que `sim/arcologia.js` faz); o ponto de prova do domínio é `pontoNoLago` (240 m, 67,5 graus).
- Confirmar com o dono o ângulo das quedas (desvio acima).
- Se o integrador quiser as 4 quedas nos 45 graus da ficha, é preciso tirar 4 das 8 avenidas ou mudar as avenidas: não recomendo.
- Bancada de CPU no PC do dono (RX 550) segue pendente, como no resto do M1.
