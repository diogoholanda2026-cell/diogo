**Entregue em 03/10/2026** (C1b, fechamento da onda 3, parte 2: integração do render e do app e a Prévia 2 do M1a).
Retomada da pausa: o trabalho do commit "Pausa: C1b em andamento" foi conferido contra a descrição e terminado; nada
foi refeito.

## O que mudou

1. **Índice e API do render** (já na pausa, conferido e testado agora): `R.ancoras` passa pelo domínio 'ancoras' (a
   oclusão pelo relevo, até 40; o resto e as cenas sem o domínio só projetam); `R.selecionado({ tipo: 'marcador', ref })`
   acende o prédio do aviso (a ref do marcador é a do prédio); `API_RENDER` com `camadas.mostrar` ({ id, ...,
   porPredio }), `selecionado` com 'marcador', `projetar` com `frente` e `prof` e `R.resolucao({ dinamica, nitidez })`;
   `R.resolucao` no motor (`Resolucao.preferir`: a dinâmica desligada trava no nominal do perfil sem apagar a trava da
   bancada e do `?pr=`; a nitidez 'desligada' tira o CAS também no quadro). As Configurações da U2a ligam sozinhas os
   dois controles (agora com `R.resolucao`). O traçado sugerido do guia corta no plano da câmera
   (`recortarNaFrente` em `ui/guia/regras.js`, pela `prof`, que é afim no mundo) e não espelha mais com a câmera rente
   ao chão. `geracao/pessoas.js` saiu do worker da oficina (225 KB, eram 230,5).
2. **Aquecimento sem compilação depois de pronto (D66).** A causa, medida na bancada: no SwiftShader um quadro da
   carga leva até 5 s; a rodada final saía aos 12 s, antes de o código sob demanda chegar, e as árvores, a gente, o
   caminhão, o marcador e o prédio de perto (LOD0) compilavam no quadro 5, depois de pronto. Agora (`motor/quadro.js`,
   `AQUECER`): a final espera os domínios sob demanda (`sobDemanda`: vegetacao, pedestres, caminhoes, colocaveis,
   obras, marcadores; o `pronto()` deles diz que o código chegou ou falhou) até 60 s e 120 quadros desenhados, os
   dois (na Nova partida pelo SwiftShader a thread presa desenhou 4 quadros em 72 s: o relógio sozinho soltava a final
   antes de o import() voltar), os de setores (prédios e vias) só até os 12 s de antes, e 4 quadros seguidos com tudo
   carregado; `R.stats.aquecimento` ganhou `esperando` (quem a carga ainda espera) e `final` (motivo 'carregado' ou
   'teto', ms, quadros e quem faltava). `pronto()` novo em vegetacao, obras, marcadores e colocaveis (a falha do import não prende).
   O domínio 'predios' põe no aquecimento um molde do LOD0 (Mesh comum com o 'edificio' e normal: o three decide o
   sombreamento por ela), porque o primeiro setor de perto pode chegar da oficina depois da final. No PC do dono a
   final continua saindo a partir de 2,5 s.
   **Os 2 'ShaderMaterial' que não ligavam:** ligavam. Eram os geradores das folhas e do assado dos impostores da
   vegetação (R2b), descartados logo depois de usados; a bancada perguntava o LINK_STATUS a um programa já apagado
   (null) e dizia "não ligou". A bancada agora guarda o estado na hora do deleteProgram, e os dois materiais têm nome
   (`arvores:gerar-folhas`, `arvores:assar-impostores`). A CAS perceptiva mora em `shaders/pos.glsl.js` (a troca de
   texto de `motor/pos.js` saiu).
3. **Textos e índices da prévia:** `web/cenas.html` sem "Sede v2" nem "Torre Lâmina" (Park of Future Dreams, Blade
   Tower, Legacy Tower, Dream Bridge, Horizon Ring, Meridian Ring, Mirror Lake); os planos A, B e C saíram do índice
   (a cena não os tem mais); comentário do `TETO_ARCOLOGIA` no contrato com a sede v3. Os rótulos da X3a já passam na
   vitrine (a etiqueta escura da revisão da X3a): u2-painel, u2-dica e x3-camadas ok em 1376 x 768, 986 x 443 e
   915 x 412, de dia e de noite. A folha da Holding mostra "Inspirado em ..." (`COLOCAVEIS[tipo].referencia`), como
   a do serviço. Integração das pendências da X3a nas Configurações: "Avisos sobre os prédios" (Interface, o filtro
   `prefs.avisos`) e "Cores das camadas para daltonismo" (Acessibilidade, `prefs.daltonismo`), com duas cenas novas
   na vitrine (u2-config-interface e u2-config-acessibilidade). obra.js e heli.js da Arcologia continuam no pacote
   principal (o principal está em 2.045 KB, longe do teto de 2.355).
4. **Prévia 2 "M1a jogável"** montada em `scratchpad/novo/C1b/previa2/` (não em previa/): `cenas.html` abre em
   destaque Nova partida (`?menu=nova`) e Abrir o jogo; o Park of Future Dreams (aérea, avenida, mar, noite, as
   pranchas da Blade e da Legacy às 17h30 e às 21h, câmera livre); a obra das torres (`etapas=torre.e2:0.55`, Dream
   Bridge, helicóptero, as 5 etapas à noite); a cidade da onda 3 (colocáveis de serviço e da Holding, rua às 18h,
   comboio e fila, camadas Zonas, Bem-estar com a legenda e Água, obras, bairro crescendo, mata de perto); e as
   páginas de teste: o Teste de desempenho da U2a (`?menu=0&tela=testeDesempenho`), a página de teste automática e a
   mesma com o perfil escolhido no seletor (`?q=`, a pendência antiga). A Prévia 1 e a Prévia 0 seguem abaixo.
5. **Medidas** (abaixo) e README com os números.

## Medidas

Bancada `aberta` (cidade sintética de 12 mil prédios), 1376 x 768, pior quadro de 120 com o sol andando em 4x e
`R.bancada()` (voo) no fim; antes = a montagem da base 187a17d (`scratchpad/novo/C1b/base`), depois = a Prévia 2
(`scratchpad/novo/C1b/previa2`). SwiftShader, com a C1a rodando robôs ao mesmo tempo (o tempo por passe varia uns 10%
entre rodadas; a mudança desta parcela não toca nenhum shader de cena, só o momento da rodada final). A trava por
quadros do teto entrou depois destas rodadas; nelas a final saiu por 'carregado', que ela não muda (conferido de novo
com 12 quadros em `bancada-final`: 0 compilações depois de pronto em aberta e jogo, 'pc' e Média).

| | PC antes | PC depois | Média antes | Média depois |
|---|---|---|---|---|
| Chamadas (pior) | 73 | 73 | 63 | 62 |
| Triângulos (pior) | 643 mil | 644 mil | 271 mil | 271 mil |
| Sombra (chamadas / triângulos) | 14 / 269 mil | 14 / 270 mil | 7 / 54 mil | 7 / 54 mil |
| Vídeo | 331 MB | 331 MB | 168 MB | 168 MB |
| Compilações depois de pronto | 7 | 0 | 0 | 0 |
| Programas que "não ligam" | 2 (falso) | 0 | 2 (falso) | 0 |
| Aquecimento (rodadas, s até pronto) | 3, 35 | 2, 54 | 2, 17 | 2, 29 |
| ms por quadro (voo, médio / p95) | 5.008 / 6.950 | 5.162 / 8.700 | 4.026 / 5.683 | 4.531 / 7.150 |

Tempo de placa por passe (ms, voo; só para comparar, o PC do dono mede pelo Teste de desempenho):

| Passe | PC antes | PC depois | Média antes | Média depois |
|---|---|---|---|---|
| sombra | 269 | 285 | 47 | 52 |
| preparo | 727 | 883 | 193 | 204 |
| céu | 130 | 145 | 104 | 104 |
| terreno | 1.082 | 1.229 | 1.552 | 1.625 |
| água | 254 | 306 | 284 | 297 |
| prédios | 1.976 | 2.235 | 1.591 | 1.654 |
| arcologia | 56 | 63 | 59 | 60 |
| resto | 214 | 239 | 83 | 86 |
| pós | 61 | 67 | 62 | 66 |

As 7 compilações do antes (arvore-lod0, arvore-lod1, arvore-impostor, pessoa, caminhao, marcador, edificio) eram todas
no quadro 5. Depois, 0 em `aberta`, `bairro`, `rua` e `planos` no 'pc' e no Média (`--compilacoes`, 12 quadros:
bairro 104 e 78 chamadas, 405 e 169 mil triângulos; rua 123 e 96, 622 e 335 mil; planos 47 e 43, 90 e 70 mil) e no
jogo pela Nova partida (`?menu=nova`: antes da trava por quadros, 11 compilações, porque a thread presa desenhou 4
quadros em 72 s e o teto do relógio soltava a final antes de o import() voltar; depois, final "carregado" aos 90 s e
0; na bancada `jogo` com `menu=nova`, 12 quadros: 44 chamadas e 64 mil triângulos no 'pc', 40 e 44 mil no Média,
0 compilações depois de pronto). JS principal: 2.045 KB (teto 2.355 KB da D91; 2.045 na base), 395 KB sob demanda em 51 pedaços; worker da
oficina 225 KB (230,5 antes).


## Capturas (1376 x 768, perfil 'pc', `scratchpad/novo/C1b/capturas/`)

Julgadas contra Apple Park, McLaren Technology Centre, Petronas, Black Diamond e Cities: Skylines II:

- `sede-aerea.png` (a sede às 17h30): os dois anéis leem como Apple Park em escala de estádio, a mata do parque e a
  orla funcionam. **Para o dono:** sem nenhuma sombra no chão (a captura mede 0 chamadas de sombra; a pendência 9 da
  SEDE3 continua), o que deixa a sede com cara de **maquete**; a Helix Labs e a Compass Tower de longe leem como
  **silos** cilíndricos lisos; a Blade e a Legacy, de cima, como duas **caixas** finas (as lâminas só aparecem de lado).
- `sede-avenida.png`: a Codex Tower facetada (Black Diamond) e a Blade em lâminas escalonadas estão boas. **Para o
  dono:** o Horizon Ring ocupa a tela como uma **muralha** listrada uniforme, sem a leitura do vidro curvo com marquise
  do Apple Park; o pórtico da avenida é um corte minúsculo na base; Helix e Compass de novo como **silos** no alto.
- `sede-noite.png` (do parque, 21h): a Blade acesa, a linha de LED nas quinas e as Dream Falls em volta do pódio
  ficaram bonitas. **Para o dono:** o Meridian Ring à noite sai **cinza-claro e manchado** (as marquises brancas claras
  sem a faixa de LED do modelo), parece **maquete** iluminada de dia; as copas do parque saem salpicadas (pendência 8
  da R2b).
- `obra-torres.png` (`etapas=torre.e2:0.55`): o corte das torres e o fantasma em grade dos anéis são claros. **Para o
  dono:** a parte construída lê como **caixa** preta lisa (sem as lâminas), as gruas são riscos finos que somem a 400 m
  e o pódio não tem canteiro visível (tapume, pilhas, caminhões).
- `rua-18h.png`: gente nas calçadas, semáforo e palmeiras. **Para o dono:** os carros são **caixas** de poucas faces
  (lanterna chapada) e as copas facetadas em bola da calçada (props.js, pendência 1 da R2b) leem como **cartum**; o
  asfalto quase preto.
- `colocaveis.png`: o bairro de serviços lê como Cities: Skylines II (biodigestores da ETE, caixa d'água, escola,
  quadra). **Para o dono:** um bloco cinza liso enorme com chaminé (alto à direita) é uma **caixa** sem detalhe.
- `camada-bemestar.png`: a camada se lê de longe como a vista de informação do CS2, com os marcadores. Sem ressalva.


## Testes

- `node ferramentas/simular.mjs --testes` (14h10): 32 arquivos ok, só o A2 de `arcologia.teste.mjs` falha (da C1a).
  Numa rodada no meio, `camadas` e `mundo` falharam por mudanças em curso da C1a (`ui/textos/s2.js` e
  `sim/mundo/areas.js`); na conferência final os dois passam.
- Testes novos: `integracao.teste.mjs` (o índice da prévia só aponta para cenas, vistas, etapas, telas e `?menu=` que
  existem, com os nomes da D88 e D89, o destaque da Prévia 2 e o link da página de teste com `?q=`; o traçado sugerido
  cortado no plano da câmera); `motor.teste.mjs` (a final espera os sob demanda e os quadros, o teto dos setores, o teto
  dos sob demanda por relógio e por quadros, o motivo da final; os testes de antes passam `minQuadros: 1`).
- `node ferramentas/montar.mjs --saida scratchpad/novo/C1b/previa2`: sem aviso, guarda-texto ok, JS principal 2.045,2 KB.
- Vitrine (`vitrine-ui.mjs`): todas as cenas u1, u2 e x3 ok em 1376 x 768 e 986 x 443 (vit3), mais u2-painel, u2-dica
  e x3-camadas de noite e em 915 x 412 (vit5) e as duas cenas novas das Configurações (vit4).
- Bancada: as tabelas acima (`bancada-antes`, `bancada-depois`, `bancada-depois-cenas`, `bancada-final`,
  `bancada-final-jogo`).
- No Chromium: `?menu=0&tela=testeDesempenho` abre o Teste de desempenho sobre o jogo em jan. 2020
  (`verif-teste.png`); `?menu=nova` entra direto na partida (`verif-nova.png`).


## Arquivos

Mudados nesta retomada: `README.md` (seção da Prévia 2 com os números), `fonte/web/cenas.html`,
`fonte/render/motor/quadro.js` (AQUECER e Aquecimento), `fonte/render/index.js` (comentário do `aquecido`),
`fonte/render/mundo/predios.js` (molde do LOD0 no aquecimento), `fonte/render/mundo/vegetacao.js` (`pronto()` e os nomes
dos dois geradores), `fonte/render/mundo/obras.js`, `fonte/render/sobreposicoes/marcadores.js` e
`fonte/render/colocaveis/dominio.js` (`pronto()`), `fonte/contratos/render.js` (comentário do `TETO_ARCOLOGIA`),
`fonte/app/main.js` (comentário do teto da carga), `fonte/ui/selecao/secoes/empresa.jsx` ("Inspirado em"),
`fonte/ui/inicio/corpo/Configuracoes.jsx` e `fonte/ui/textos/u2-telas.js` (Avisos e daltonismo),
`ferramentas/bancada.mjs` (estado da ligação guardado no deleteProgram, `--aquecer` 150 s, carga com o teto),
`ferramentas/testar.mjs` (carga com o teto), `ferramentas/vitrine/cenas/u2.js` (u2-config-interface e
u2-config-acessibilidade), `ferramentas/testes/integracao.teste.mjs` e `ferramentas/testes/motor.teste.mjs`.
Já no commit da pausa (conferidos): `fonte/contratos/render.js` (API_RENDER), `fonte/render/index.js` (ancoras,
selecionado, resolucao), `fonte/render/camera/raio.js` (frente e prof), `fonte/render/motor/{resolucao,quadro,pos,
bancada}.js`, `fonte/render/materiais/shaders/pos.glsl.js`, `fonte/render/mundo/oficina.worker.js`,
`fonte/ui/guia/{Guia.jsx,regras.js,estilo.js}`, `ferramentas/vitrine/render-falso.js`, `ferramentas/vitrine/cenas/u2.js`
e `ferramentas/testes/motor.teste.mjs`. Nenhum arquivo novo no repositório.

## Pendências para o integrador

1. **Commits e previa/:** a C1b não commitou. A Prévia 2 montada está em `scratchpad/novo/C1b/previa2/`; para publicar,
   montar de novo em `previa/` depois de juntar a C1a (a montagem desta pasta leva o trabalho em curso da C1a de
   03/10 às 13h).
2. **PROJETO:** registrar esta nota no fim da ficha C1 e a Prévia 2 na 4.6 (o que o índice abre e os números acima).
3. **Dono, visual (capturas acima):** sem sombra no chão na aérea da sede; Helix Labs e Compass Tower como silos de
   longe; Horizon Ring como muralha listrada de perto, pórtico pequeno; Meridian Ring cinza-claro e manchado à noite;
   a obra das torres como caixa preta e gruas invisíveis a 400 m; carros em caixa e copas em bola na rua (props.js da
   R3a, pendência 1 da R2b); o bloco cinza liso com chaminé no bairro de serviços. Cada um volta à parcela dona
   (SEDE3/X1b, R3a/R3b, R5) depois da conversa com o dono (D78).
4. **U1a:** o comentário de `ui/glifos/glifos.js` (linha 107) ainda diz "Torre Lâmina" (só comentário).
5. **Configurações sem leitor ainda** (U2a, 8.17): limite de quadros (falta uma API do `tetoQps` na R1a), lupa e
   encaixe padrão (X2), sensibilidade e inverter arrasto (`entrada.opcoes`, R1b), modo criativo (S3b).
6. **X3a, o que não é integração:** a primeira linha do cartão com o valor da camada ligada (U1b); as cores da rampa
   das vias convertidas duas vezes de sRGB e a via de longe sem a camada por aresta (R3a); o gancho 'camada' em
   vegetação, água, props, tráfego, gente, caminhões e obras.
7. **A1 (folga):** `mundo/oficina.js` importa o `oficina.worker.js` inteiro para o modo sem worker (pendência 3a da
   R2b) e obra.js e heli.js da Arcologia podem ir sob demanda; com 2.045 de 2.355 KB não fiz.
8. **Carga:** o app espera o aquecimento só até 20 s (`TETO_AQUECER_MS`); numa máquina lenta a final pode sair depois
   (até 60 s e 120 quadros, ou quando o código chega) e a carga já saiu: sem compilação depois de pronto, mas com o
   jogo andando enquanto compila. No PC do dono tudo chega em poucos segundos; conferir no Teste de desempenho dele.

## Revisão adversarial (03/10/2026)

Corrigido:
- `mundo/pedestres.js` e `mundo/caminhoes.js`: o `pronto()` agora conta a falha do import (antes só `!!mod`): um
  pedaço sob demanda que não chega prendia a rodada final até o teto de 60 s e 120 quadros, contra o que o `AQUECER`
  promete ("chegou ou falhou").
- `ferramentas/bancada.mjs`: com `--compilacoes`, o aquecimento que não termina em `--aquecer` s também falha. Antes
  era só aviso, e o "0 compilações depois de pronto" passava sem a rodada final ter saído (a `aberta` no 'pc' levou
  128 s dos 150 do teto no SwiftShader ocupado). Numa máquina ocupada, rode com `--aquecer 300`.
- `motor/quadro.js`: a troca de perfil zera também `esperando` e a conta de quadros do teto (o relatório mostrava a
  espera do perfil de antes); teste novo em `motor.teste.mjs`.
- `ferramentas/testes/integracao.teste.mjs`: o índice da prévia confere também as vistas da `costa` e o id da camada
  na cena `camadas` (um id desconhecido cai na Zonas sem aviso).
- `ferramentas/vitrine/cenas/u2.js`: `u2-config-acessibilidade` espera a linha do daltonismo em vez de 60 ms fixos.

Conferido no Chromium (`?menu=0&q=pc`, sem captura para o dono): final "carregado" aos 51 s com 9 quadros, 0
compilações depois de pronto; `R.resolucao({ dinamica: false, nitidez: 'desligada' })` deixa o modo 'fixa' e o CAS em
0, e a volta ao automático religa o cronômetro; `R.ancoras` com 45 pontos devolve 45 (40 pelo domínio) na forma de
`R.projetar` (com `frente` e `prof`); `R.selecionado({ tipo: 'marcador' })` sem erro.

Fica: o `pronto()` da casca dos colocáveis espera também os setores da oficina (o `prontoAgora` do desenho), no teto
dos sob demanda (60 s) e não no dos setores (12 s); com o molde `colocaveis:aquecer` bastaria a chegada do código.
Não mudei sem medir de novo na bancada.
