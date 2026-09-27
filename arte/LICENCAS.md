# Licenças da arte do jogo novo

Toda textura fotográfica que entra no jogo tem de estar listada aqui, com a fonte e a licença. Só entra material
**CC0** (domínio público) de ambientCG ou Poly Haven (D46). A ferramenta `ferramentas/codificar-texturas.mjs` recusa
foto de camada cujo material não esteja nesta lista ou cujo sha256 não seja o de `arte/materiais/fontes.json`.

## Situação (27/09/2026, parcela R2a)

O chão tem as duas versões do A/B da D46: a procedural (padrão, e sempre no HTML único) e a fotográfica CC0,
`arte/materiais/chao-camadas.ktx2` (8 fatias de 1024 x 1024 em Basis ETC1S com mipmaps, ~3,2 MB), ligada por
`?materiais=cc0` e mostrada lado a lado na cena `materiais`.

**De onde vieram as fotos.** O proxy de saída desta máquina recusa `ambientcg.com`, `api.polyhaven.com` e
`dl.polyhaven.org` (política da organização). Os oito materiais são da **ambientCG, versão 1K-JPG, sem edição**, e as
cópias vieram de projetos públicos no GitHub que trazem o pacote da ambientCG inteiro (com o `.mtlx` e o `.usda` do
pacote original), por `raw.githubusercontent.com`. Cada arquivo foi conferido pelo sha256; seis dos oito vieram
iguais byte a byte de dois ou três projetos independentes. Os espelhos e os sha256 estão em
`arte/materiais/fontes.json`. As fotos não vão para o git (`arte/materiais/fonte/` é ignorada):
`node ferramentas/codificar-texturas.mjs --baixar` as traz de volta e confere.

**Para conferir na fonte** (numa rede que alcance a ambientCG): baixar o `<ID>_1K-JPG.zip` de cada material abaixo e
comparar o sha256 do `_Color.jpg` e do `_Displacement.jpg` com os de `fontes.json`.

## Como trocar um material

1. Escolher na ambientCG ou na Poly Haven a versão de 1K (JPG ou PNG). O que procurar em cada camada: grama rala de
   pasto tropical (grama); capim seco com palha (capim); solo avermelhado com torrões (terra roxa); terra batida clara
   (terra clara); rocha cinza com líquen (granito); areia de praia fina (areia); folhas secas de mata (folhiço); piso
   de concreto gasto (concreto). A cor média da foto não importa: o jogo usa a variação dela sobre a cor da paleta de
   cada camada (albedo real do desenho do render, 9.2).
2. Pôr o material, os espelhos e o sha256 em `arte/materiais/fontes.json` e uma linha na tabela abaixo.
3. Rodar `node ferramentas/codificar-texturas.mjs --baixar` (gera `arte/materiais/chao-camadas.ktx2`, até 8 MB).

## Materiais

Licença de todos: CC0 1.0 Universal, https://docs.ambientcg.com/license/ (autor: ambientCG, Lennart Demes).

| Camada (arquivo em `fonte/`) | Material | Página na fonte | Mapas usados |
|---|---|---|---|
| grama (`grama.jpg`, `grama-altura.jpg`) | Grass004 | https://ambientcg.com/view?id=Grass004 | Color, Displacement |
| capim (`capim.jpg`, `capim-altura.jpg`) | Ground073 | https://ambientcg.com/view?id=Ground073 | Color, Displacement |
| terraRoxa (`terraRoxa.jpg`, `terraRoxa-altura.jpg`) | Ground067 | https://ambientcg.com/view?id=Ground067 | Color, Displacement |
| terraClara (`terraClara.jpg`) | Ground103 | https://ambientcg.com/view?id=Ground103 | Color (altura pela luminância) |
| granito (`granito.jpg`, `granito-altura.jpg`) | Rock050 | https://ambientcg.com/view?id=Rock050 | Color, Displacement |
| areia (`areia.jpg`, `areia-altura.jpg`) | Ground080 | https://ambientcg.com/view?id=Ground080 | Color, Displacement |
| folhico (`folhico.jpg`, `folhico-altura.jpg`) | Ground040 | https://ambientcg.com/view?id=Ground040 | Color, Displacement |
| concreto (`concreto.jpg`, `concreto-altura.jpg`) | Concrete047A | https://ambientcg.com/view?id=Concrete047A | Color, Displacement |
