# Nota de entrega da S3b (Ato 1 completo, cimento, Modo livre e alimentos)

Entregue em 16/10/2026. Sem commit (o integrador commita). Tudo do M1b fica atrás de `PARTE_ATUAL` (`data/zonas.js`): com o
M1a como está, nada muda no jogo (A2 verde, mesmos marcos no robô). O integrador abre o M1b trocando `'M1a'` por `'M1b'`.

## Arquivos
- `fonte/data/historia.js`: 3 decisões novas (`energia.2022`, `mina.licenca`, `vila.futuro`), `m1b` no evento `energia2022`
  (choque e decisão), `VILA_NOVA`, `MODO_LIVRE`. `fonte/sim/historia.js`: abre as do M1b só com a parte aberta; o evento que
  já passou entra na hora se o M1b abre depois (`eventosM1b`).
- `fonte/data/holding.js`: níveis 2 e 3 de Mina, Cimenteira, Vidraria, Serraria e Manejo; prédios novos `fazenda` e
  `agroindustria` (no fim da ordem, índices antigos intactos), itens `graos` e `alimentos`, `ALIMENTOS`, `CADEIA_M1A`,
  `HOLDING_M1B`; campo `zona: 'industrial'` nos industriais novos (D112, só marca; ZON2 aplica).
- `fonte/data/marcos.js` (ids do M1b da Holding, `item.cimento` no marco 2), `fonte/data/objetivos.js` (Mina, Cimenteira,
  Agroindústria, Vidraria e `cidade.vilaNova`), `fonte/data/colocaveis.js` (Fazenda e Agroindústria).
- `fonte/sim/holding/{base,producao,mercado,substituto}.js`, novo `fonte/sim/holding/vila.js`, `fonte/sim/{economia,progresso,objetivos}.js`.
- Textos: `fonte/ui/textos/s3b.js` (novo, registrado em `ui/textos.js`).
- Render: `render/colocaveis/holding.js` (Fazenda: pivô central, armazém graneleiro, silos, colheitadeira; Agroindústria: bloco
  de silos de concreto, galpão, tanques, chaminé), `render/cenas/servicos.js` (cena com os 26 tipos), `render/mundo/obras.js`
  (Fazenda sem esqueleto de obra).
- Mapa: `data/mapa-heldopolis.js`, o polígono do calcário (ver abaixo).
- Robô: `ferramentas/robo/robo-sim.mjs` ganhou `--m1b`. Teste novo: `ferramentas/testes/ato1-completo.teste.mjs` (17 testes);
  ajustados `objetivos.teste.mjs` (6 decisões) e `geracao-colocaveis.teste.mjs` (26 tipos).

## O que mudou
1. **6 decisões do Ato 1**, uma voz para cada conselheiro. M1a: `vila.agua` (Cida, Tomé), Febre Aurora (Lívia, Cida), Canal de
   Seshat (Lívia, Tomé). M1b: **Crise da Energia** (fev. 2022; Caio e Lívia): o choque põe a conta da energia da rodovia a 160%
   e a importação a 110% por 12 meses; contrato (Influência +6) anula, usina solar (Legado +6) baixa a energia importada em
   30% por 5 anos. **Licença da Mina** (marco 2; Nara e Tomé): recuperar a encosta (Mina 10% mais lenta, Legado +6) ou turnos
   dobrados (Mina e Cimenteira 20% mais rápidas, Influência +5). **Futuro da Vila** (marco 3; Cida e Íris): reformar (bem-estar
   +3 na Vila por 2 anos, Legado +3) ou projeto novo (comércio de rua +8 por 2 anos, Influência +5); as duas põem na frente o
   objetivo `cidade.vilaNova`. Efeitos novos lidos pela simulação: `produtividade` com `predio` (por tipo) e `custoLigacao`
   (fator sobre a conta `ligacao` da S2a no orçamento). Prazo, adiamento e opção padrão como nas três de antes.
2. **Mina e Cimenteira**: Mina 15 mil, Cimenteira 40 mil (os da ficha, mantidos). Cadeia: Mina (calcário) + Olaria (argila)
   -> Cimenteira (cimento) -> Concreteira. D48 no M1b: o item de um prédio da Holding que existe na partida entra na cadeia da
   obra de nível 3 a 5 (cimento com a Cimenteira, serrada com a Serraria, vidro com a Vidraria); sem a fábrica a obra importa
   sozinha, como na D92. O calcário rende 2 por unidade da grade (`porUnidade` 0,5).
3. **Modo livre (D56)**: o caixa fica em `MODO_LIVRE.caixa` (1 bilhão de créditos), então nada pede crédito; já valiam
   licença de ladrilho, marco e vias/zonas grátis. `holding.identidade` com `modo: 'livre'` e a volta ao normal recusada (já era).
   "Sem recordes": não há recorde na simulação para cortar. A opção na tela de nova partida é da U2b.
4. **Vila nova (D95)**: objetivo de Legado `cidade.vilaNova` (marco 3, M1b): casas da Vila com água e luz (90%), bem-estar médio
   56 e caixa para a reforma. Ao cumprir, a Holding paga (600 por casa em "reformar", 1.000 em "substituir") e as casas viram o
   modelo de `REQUALIFICACAO_VILA` com obra de reforma (120 ou 300 tiques); lote, semente, nível e família ficam; Legado +8,
   XP 120, fala de Dona Cida no Mural. Estado em `q.holding().vilaNova`.
5. **Alimentos (linha de corte, feito)**: Fazenda (grãos na terra fértil, que renova) e Agroindústria (2 grãos -> 1 alimento).
   Com o M1b e a mercadoria da S2b publicada, a Holding vende ao comércio a 100% uma fração do consumo dele; o fornecido sobe a
   `producao` e desce a `importada` de `sim.agregados.mercadoria` (aplicado de novo a cada objeto novo que a S2b escreve).
   Vidraria, Serraria e Manejo já tinham modelo (R5): agora têm níveis, marcos e objetivo (Vidraria).
6. **Mapa**: o calcário saía numa encosta de mais de 30% e nenhuma Mina (64 x 56 m, aplainar até 12,8 m) cabia (menor desnível
   medido: 18 m). O polígono foi para a planície alta a noroeste, no ladrilho (5, 5), colado à área inicial pelo oeste (mesma
   ideia: a primeira licença abre a cadeia). `mapa.mjs --conferir` ok; A2 verde.

## Calibração (robô, 12 h, semente robo-1, cidade de faz de conta)
| | marco 5 | marco 6 | caixa mínimo | moradores |
|---|---|---|---|---|
| M1a (base) | 4:19 | 8:49 | 6.310 | 15.110 |
| `--m1b`, só as decisões | 4:44 | 8:59 | 14.613 | 15.055 |
| `--m1b`, cadeia com folga de 40 mil | 4:54 | 10:09 | 14.613 | 15.055 |
| `--m1b`, cadeia com folga de 150 mil (padrão do robô) | 4:44 | 8:49 | 14.613 | 15.055 |
- As decisões novas custam caixa (Energia 20 a 30 mil, Mina 10 a 25 mil, reforma da Vila 3.600): o marco 5 atrasa 25 min no
  robô, que sempre escolhe contrato, acelerar e reformar. Os marcos 1 a 4 não mudam.
- A cadeia comprada cedo (folga de 40 mil) rouba argila do tijolo e prende 95 mil: o marco 6 atrasa 70 min. Com folga de 150 mil
  não atrasa nada. Retorno: o cimento próprio poupa 54 por unidade contra a importação (uns 2,2 mil/h no robô), então os 95 mil
  voltam em dezenas de horas; a cadeia vale pela independência da importação e pela margem do Depósito, não pelo caixa do
  começo. Custos mantidos em 15 e 40 mil.
- A4 (marco 1, marco 3, caixa, dívida, vendas no marco 5, objetivos, erros): as mesmas metas dentro e fora do M1a; marco 1 segue FORA como antes.

## Verificado
- `simular.mjs --testes` e `montar.mjs` sem avisos: ver o fim desta nota (resultado final). A2 (`arcologia.teste.mjs`) verde.
- Determinismo e save: teste de ida e volta com decisões pendentes, efeitos, Vila nova e alimentos (hash igual, e igual depois de rodar); save de antes da S3b carrega.

## Não verificado na tela
- Fazenda e Agroindústria: modelos só em Node (triângulos, caixa do LOD1, determinismo); falta ver as capturas (cena `servicos`) e
  a bancada no PC. Sem glifo próprio (usa o da categoria).
- Casas da Vila reformadas: o modelo novo (lote de 24 m) desenha dentro do lote antigo (16 m); ver na tela se a escala fica boa.
- Cartões das 3 decisões novas e do objetivo `cidade.vilaNova` na interface.

## Pendências para o integrador
1. Abrir o M1b: `PARTE_ATUAL = 'M1b'` em `data/zonas.js` (liga junto com a S2b). Os ids M1b da Holding passam a valer em `progresso.liberado`.
2. `q.holding().vilaNova` é um acréscimo fora do contrato (não pude registrar consulta nova); promover a `contratos/consultas.js` se a UI quiser.
3. `sim.agregados.mercadoria.alimentos` (S2b/S3b): a oferta de alimentos entra na conta da mercadoria; a S2b pode ler `sim.q.producao().alimentos` se quiser mostrar.
4. D112 (ZON2): `zona: 'industrial'` está nos dados de Mina, Cimenteira, Vidraria, Serraria e Agroindústria; nada o aplica ainda. A Mina fica presa ao calcário do ladrilho (5, 5): ZON2 precisa do calcário dentro ou ao lado do Distrito Industrial.
5. Opção de Modo livre na nova partida: U2b.

## Resultado final (16/10/2026)
- `simular.mjs --testes`: **testes ok** (inclui `ato1-completo` 17/17, `arcologia` A2 e a guarda de texto).
- `montar.mjs --saida <temporária>`: sem avisos; jogo 2.264 KB (teto 2.355), oficina 231,8 KB (teto 250).
- `--determinismo`: ok (hashes iguais, antes e depois do save).
- `--bancada` (cidade sintética de 126 mil moradores, com as outras parcelas rodando ao mesmo tempo): FORA da meta A5 (p95 4,6 ms);
  os maiores sistemas são prédios, valor, trânsito e redes; a Holding não aparece entre os 8. Os sistemas novos da S3b
  (alimentos, ajuste da mercadoria) são uma comparação por tique. Medir de novo quando as parcelas pararem de mexer.
