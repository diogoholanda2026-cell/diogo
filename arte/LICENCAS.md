# Licenças da arte do jogo novo

Toda textura fotográfica que entra no jogo tem de estar listada aqui, com a fonte e a licença. Só entra material
**CC0** (domínio público) de ambientCG ou Poly Haven (D46). A ferramenta `ferramentas/codificar-texturas.mjs` recusa
qualquer foto que não esteja nesta lista.

## Situação (27/09/2026, parcela R2a)

Nenhum material CC0 foi baixado: o proxy de saída desta máquina recusa `ambientcg.com`, `api.polyhaven.com` e
`dl.polyhaven.org` (política da organização). O chão da Prévia 0 é todo procedural. O caminho CC0 está pronto e foi
testado de ponta a ponta com imagens sintéticas (que não entram no jogo): foto por camada, `codificar-texturas.mjs`
(Basis Universal em wasm, KTX2 com 8 fatias), `montar.mjs` levando o arquivo, `KTX2Loader` do three e a cena
`materiais` com o A/B lado a lado.

## Como acrescentar

1. Baixar a versão de 1K (JPG ou PNG) de cada camada, na ordem do chão: `grama`, `capim`, `terraRoxa`, `terraClara`,
   `granito`, `areia`, `folhico`, `concreto`. Se houver mapa de deslocamento, ele vai como `<id>-altura.<ext>`.
2. Salvar em `arte/materiais/fonte/` com o id da camada no nome (`grama.jpg`, `grama-altura.jpg`, ...).
3. Listar cada arquivo na tabela abaixo (o nome do arquivo tem de aparecer aqui).
4. Rodar `node ferramentas/codificar-texturas.mjs` (gera `arte/materiais/chao-camadas.ktx2`, até 8 MB).

O que procurar em cada camada: grama rala de pasto tropical, sem verde-limão (grama); capim seco amarelado (capim);
solo vermelho de latossolo (terra roxa); terra batida clara (terra clara); granito cinza com líquen (granito); areia de
praia fina e clara (areia); folhas secas de mata (folhiço); piso de concreto gasto (concreto). A cor média da foto não
importa: o jogo usa a variação dela sobre a cor da paleta de cada camada.

## Arquivos

| Arquivo | Camada | Fonte (página) | Autor | Licença |
|---|---|---|---|---|
| (nenhum ainda) | | | | |
