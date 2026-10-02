# Arcologia de Held (jogo novo): guia do projeto para o Claude

O jogo está sendo refeito do zero, no nível do **Cities: Skylines II** (referência máxima) com o que o **Highrise City**
acrescenta: você é a Holding Held, concessionária que planeja Heldópolis (vias livres, zonas com demanda, serviços,
redes, trânsito), produz os materiais da cidade em cadeias com lotes de 1 a 10 e ergue a Arcologia de Held, o
megaprojeto de assinatura (a Torre Lâmina, retangular de alto luxo, primeiro). three.js r186 em WebGL2, Preact na
interface, PWA para PC e para o Poco X7 do dono.

**O documento que manda é `docs/PROJETO.md`** (decisões, contratos, estrutura, parcelas do M1 e regras de trabalho).
Anexos: `docs/desenho/{sim,render,ui}.md` (detalhe de cada parte) e `docs/pesquisa/*.md` (fontes). `docs/VISAO.md` é a
visão de longo prazo (Holding, rivais, 12 metrópoles). `docs/desenho/historia.md` é a história em três partes (D67, D77 a D86; a fonte é o caderno do dono em `docs/pesquisa/historia-dono/`: 2005 a
2019, 2020 a jun 2026 e jun 2026 a 2040), com sócios, calendário, horas e o dólar (D68). `docs/desenho/marcos.md` descreve o complexo de lazer, esporte e
natureza (D69: santuário de três esferas, F1, arenas, shopping, parque) e o alvo de qualidade no PC atual (D70). `docs/desenho/cidade.md` trata dos visitantes, do trem-bala, da moradia social,
dos aeroportos e do gasto dos visitantes (D71 a D76).

## Como o dono trabalha
- Fala português do Brasil; responda em português: resultado primeiro, frases curtas, sem travessão.
- Joga sozinho, dá autonomia ("continue sem pedir permissão"), mas é sensível a custo: não repetir etapas já feitas,
  capturas só as necessárias.
- Regras de economia fixadas por ele (valem no jogo novo com a mesma razão, em dólares reais pela D68, em `REGRAS_DONO`): produção em lotes
  de 1 a 10; vendas no Depósito a 150% do preço base, até 100 por janela; empréstimo de 50 mil por ano, 10% ao ano,
  dívida até 500 mil; renda de 5/8/11 créditos por morador por hora conforme o bem-estar.
- Estética proibida: SimCity BuildIt, maquete, cartum, verde-lima, formas "quadradas e robóticas", Torre em bolo.
  Arquitetura sempre com referência em megaprojetos reais.

## Estrutura (ver `docs/PROJETO.md`, seção 3)
- `fonte/`: jogo novo. `comum/` (rng, hash, relógio, Bézier, caminhos, altura), `contratos/` (só o integrador muda),
  `data/`, `sim/` (determinística, sem relógio nem `Math.random`, sem three), `render/`, `ui/` (Preact, JSX),
  `app/` (arranque, laço, controle), `web/` (index, sw, manifesto).
- `ferramentas/`: `montar.mjs` (monta `previa/` durante o M1; `--saida app` só na publicação do M1), `simular.mjs`
  (`--testes` roda todo `ferramentas/testes/*.teste.mjs` e a guarda de texto), `testar.mjs`, `bancada.mjs`,
  `vitrine-ui.mjs`, `guarda-texto.mjs`, `cidade-sintetica.mjs`.
- `antigo/`: o jogo anterior (fonte, arte, ferramentas), só consulta; sai na publicação do M1.
- `app/` e `arcologia-de-held.html`: o jogo anterior congelado e publicado até o M1. Ninguém edita antes da publicação.
- `previa/`: montagem do jogo novo durante o M1; só o integrador monta.

## Regras de trabalho
- **Cada construção do complexo e da sede é dialogada com o dono antes de ser feita** (D78): pergunta curta com
  recomendação, resposta dele, e só então a ficha e a parcela.
- Cada parcela edita só os arquivos dela (tabela da seção 3.1 do PROJETO); tudo entra por registro; ninguém edita
  índice, `sim/nucleo.js`, `app/` ou `contratos/` sem ser o integrador.
- Textos em `ui/textos/<parcela>.js`, português do Brasil, sem travessão, unidades da D42 ("/h" de jogo).
- Entrega: `montar.mjs` sem avisos numa pasta temporária, `simular.mjs --testes` verde, cenas da parcela verdes,
  capturas só do que mudou. Commits só de fonte, mensagens em português; quem commita é o integrador.
- Orçamento (D66, PC primeiro): o PC do dono (i3 de 9ª geração, RX 550, 16 GB) em 1920 x 1080, 60 qps e piso de 30,
  até 800 chamadas e 2,5 milhões de triângulos na vista aberta com a cidade grande (provisório até a bancada no PC dele).
  O Poco X7 em Média (300 chamadas, 900 mil triângulos, 30 qps) volta depois. Medir com a bancada, não estimar.
- Publicação: branch da sessão, `git push -u origin <branch>`; dois commits (fonte, depois "Montagem ..." com a pasta
  montada). O GitHub Pages publica o branch.
