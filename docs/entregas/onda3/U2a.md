# U2a: sistema (save, diário, menus, configurações, Teste de desempenho e primeira hora)

Entregue em 03/10/2026 (onda 3, etapa 3, retomada depois da pausa; o parcial estava no commit "Pausa: R3b e U2a em
andamento", conferido contra a ficha e terminado).

## O que ficou pronto

- **Save (D31, 2.9):** IndexedDB `heldopolis` (lojas `saves` e `meta` na mesma transação), 3 automáticos em rodízio e 8
  manuais, capa JPEG de 640 x 288 por `R.capa`, exportar e importar `.held` (cru ou gzip, conferido inteiro antes de ocupar
  um espaço) com as travas herdadas: a da importação (marca na sessão), a quarentena do save danificado (as 3 cópias mais
  novas ficam, nunca se apaga sem guardar) e o armazenamento persistente. Automático a cada 5 min de relógio se algo
  mudou, ao sair para o menu e no segundo plano **sem gzip e sem capa**. Um save por vez.
- **Diário síncrono:** `heldopolis.diario` com a base, os comandos do livro desde ela, o tique (a cada segundo, a cada
  comando, ao pausar e no começo de cada save) e o carimbo da página; "outra página gravou" pelo carimbo (a aba de trás
  para de gravar e recarrega ao voltar). Carregar = save mais novo da linhagem + reprodução até o tique gravado; a
  partida que caiu antes do primeiro save volta pela semente e pelos comandos e salva na hora. localStorage cheio pede
  um save.
- **API `jogo` (2.8):** `salvar`, `carregar`, `listarSaves`, `exportar`, `importar`, `novaPartida` (com o primeiro save),
  e ainda `continuar`, `apagarSave`, `sairParaMenu`, `quarentena`, `armazenamento`, `persistir`, `temPartida`,
  `temDiario`, `app.salvamento` (estado e o gancho `atrasar(ms)` do teste) e os eventos `salvo`, `carregado`,
  `novaPartida` e `menuInicial`.
- **Entrada e menu inicial (8.19, D66, D67):** "Clique para entrar" no mouse e "Toque para entrar" no toque (libera o
  som; no toque, tela cheia em paisagem); menu sobre a capa do último save com Continuar (Holding, moradores, "mar. 2021",
  "salvo há 7 min"), Nova partida, Carregar, Configurações e Créditos; atalhos à vista no mouse (Enter, N, C, O, R; setas;
  Esc volta). Nova partida com "Holding Held" e "Diogo Holanda" preenchidos e editáveis, 6 cores da marca e o calendário
  em jan. 2020. Armadilha do voltar do Android. `?menu=0` (sem menu nem save, prévias e robô), `?menu=nova` e
  `?menu=continuar` (testes). A fila de modais esvazia ao trocar de partida (pendência da U1b).
- **Configurações (8.17):** Vídeo (Auto, Ultra, Alta, **PC**, Média, Leve com o orçamento de cada uma; "Manter esta
  qualidade? 10 s" com relógio próprio, que volta sozinha mesmo trocando de aba ou fechando a tela; resolução dinâmica e
  nitidez CAS com a leitura ao vivo; luz fixa; painel F9; Teste de desempenho), Interface, Controles (mira, borda do
  mouse, teclas), Som (5 canais, segundo plano, vibração), Jogo, Acessibilidade, Salvamento e Sobre. Page Up e Page Down
  (ou [ e ]) trocam a aba.
- **Teste de desempenho:** esconde a interface, conta 3 s, voa 20 s (sede, Vila, orla, nó de entrada) com `R.bancada` e
  mostra perfil escolhido e motivo, resolução interna e dinâmica, CAS, qps, ms, p95, pior quadro, chamadas e triângulos
  (com a sombra), tempo de placa (cerca, cronômetro e por passe), aquecimento, compilações depois de pronto, memória de
  vídeo e tarefas longas; aplicar o sugerido, copiar e compartilhar (Web Share; sem permissão, caixa de texto).
- **Primeira hora:** anel de guia na categoria do objetivo aberto; traçados sugeridos do mapa da SEDE3 (a avenida do nó de
  entrada ao portão norte, as quadras, a captação e a usina na rua da Vila, os prédios da Holding) com "Usar sugestão"
  quando a ferramenta certa está aberta; o prédio sugerido entra **encaixado pela prévia** (`construir.previa`, de frente
  para a via), como na ferramenta de colocar; dicas únicas com o conselheiro e a mão fantasma (uma por vez, cada uma uma
  vez, "Não mostrar dicas").
- **Som (11) e vibração (9.6):** mixer procedural (mestre com compressor, música, ambiente, mundo, interface), silencia
  em segundo plano; clique, encaixe que sobe, baque, pincel por família de zona, estalo, erro, acorde do marco e sino da
  etapa; vibração no marco e no erro.

## Arquivos
Criados: `fonte/ui/guia/{Dica.jsx,Guia.jsx,estilo.js,regras.js}`, `fonte/ui/inicio/{Entrada.jsx,estado.js,estilo.js}`,
`fonte/ui/inicio/corpo/{Inicio.jsx,Carregar.jsx,Configuracoes.jsx,TesteDesempenho.jsx,comum.js,estilo.js}`,
`fonte/ui/textos/u2-telas.js` (textos das telas sob demanda), `ferramentas/testes/save.teste.mjs`,
`ferramentas/vitrine/cenas/u2.js`.
Mudados: `fonte/app/{salvamento,armazem,diario}.js`, `fonte/som/{som,interface}.js`,
`fonte/ui/guia/{dicas,objetivos,sugestoes}.js`, `fonte/ui/inicio/{carga.js,Girar.jsx,MenuInicial.jsx,NovaPartida.jsx}`,
`fonte/ui/telas/{Configuracoes,TesteDesempenho}.jsx`, `fonte/ui/textos/u2.js`.

## Como testei
- `node ferramentas/simular.mjs --testes`: guarda-texto ok e todos os testes verdes menos `vida-rua`, da R3b, que está
  rodando ao mesmo tempo (arquivos dela mudando no disco). `save` com 10 subtestes: 9 ok e 1 `todo` (pendência 1).
- `node ferramentas/testes/save.teste.mjs --chromium <montagem>`: nova partida, avenida, 40 tiques, empréstimo, pausa,
  save segurado no meio (`atrasar(60000)`), a página morre por `Page.crash` (sem pagehide) e a página nova continua:
  **tique 43, seq 5 e hash 1725291345 antes e depois**, sem erro de página.
- Vitrine: `node ferramentas/vitrine-ui.mjs <pasta> u2-entrada,u2-menu,u2-nova,u2-carregar,u2-config,u2-config-som,
  u2-config-salvamento,u2-teste,u2-painel,u2-dica 1376x768,986x443`: 20 de 20 ok, sem erro de página.
- Jogo montado no Chromium (roteiro em `jogo-real.mjs` desta pasta): entrada, menu, nova partida, anel e dica, traçado
  sugerido com "Usar sugestão" (88 para 91 arestas), menu do jogo com Salvar e Sair, menu inicial de volta com o
  Continuar ("Holding Held · 349 moradores · jan. 2020 · salvo agora há pouco"); sem erros.
- `node ferramentas/montar.mjs --saida <temp>`: só o aviso A1 de sempre. **Jogo 1.988,0 KB** (com o parcial da R3b);
  a mesma árvore com os arquivos da U2a da base monta 1.930,9 KB: **a U2a soma uns 57 KB ao principal** (salvamento
  10,7, formato.js do save 6,2, armazém 5,7, guia 10, som 5,1, entrada e carga 6,5, CSS 5,5, textos 2,1) e **54 KB sob
  demanda** (corpo do início, configurações, saves, teste e os textos das telas).

## Capturas (4, nesta pasta, `capturas/`)
`1376x768-menu-inicial.png`, `1376x768-teste-desempenho.png`, `986x443-configuracoes-video.png` (vitrine) e
`1376x768-jogo-primeira-hora.png` (jogo montado: dica da Íris Valverde, traçado e "Usar sugestão").

## Pendências para o integrador
1. **S3a, `sim/objetivos.js` (bloqueia a primeira hora):** `rodoviaLigaGleba` faz `const comp = componentes(G)`, mas
   `componentes` devolve `{ comp, n }`; `comp[a]` fica `undefined` e o objetivo da primeira avenida nunca fecha (o anel e o
   traçado ficam para sempre). Troca: `const { comp } = componentes(G);` (como em `sim/zonas/demanda.js`). O teste
   `todo` em `save.teste.mjs` passa a valer: tirar o `{ todo }` depois.
2. **SEDE3 ou S1a, `data/mapa-heldopolis.js`:** as sugestões dos prédios da Holding (Escritório de Obra em (-120, -598),
   Pedreira, Areal e Olaria) ficam sem via a menos de 76 a mais de 200 m, mesmo com a avenida sugerida; o "Usar
   sugestão" recusa por `acesso` até o jogador abrir uma rua. O Escritório é objetivo aberto desde o começo: pôr os
   lugares na beira da avenida ou da rua da Vila, ou sugerir a rua até eles.
3. **R1a e contrato:** `R.resolucao({ dinamica, nitidez })` não existe; a tela grava `resolucaoDinamica` e `nitidez` e
   chama `R.resolucao?.()`. Proposta: em `render/index.js`, `resolucao({ dinamica, nitidez }) { quadro.resolucao.fixa =
   !dinamica; ... CAS desligado quando nitidez === 'desligada' }` e a linha no `API_RENDER`.
4. **Opções da 8.17 sem quem as leia (não pus controle morto):** limite de quadros (R1a: API para o `tetoQps`), lupa e
   encaixe padrão (X2), sensibilidade e inverter arrasto (R1b, `entrada.opcoes`), filtro de avisos e falas (U1b),
   paleta para daltonismo (X3a), modo criativo (S3b). Quando existirem, a linha entra em `inicio/corpo/Configuracoes.jsx`.
5. **U1b ou C1:** "Inspirado em ..." na folha da Holding (`ui/selecao/secoes/empresa.jsx`) como já faz `servico.jsx`
   (`COLOCAVEIS[tipo].referencia`); a folha não é da U2a.
6. **S3a:** o comando `holding.identidade` vai com `criador` (D77 a D83) e hoje é ignorado; a meta do save e a `vista`
   já guardam o criador. Guardar em `json.identidade` quando a S3a aceitar.
7. **F0, `ui/prefs.js`:** `PREFS_PADRAO.musica` é 0,5 e o desenho (11) pede 35% (`VOLUME_PADRAO.musica` = 0,35);
   `aplicarPrefs` só trata `reduzirMovimento === true` (o "Desligado" segue o sistema pelo CSS).
8. **Árvore 3.1:** pôr `ui/textos/u2-telas.js` (textos das telas sob demanda) na linha da U2a.
9. **C1 (robô e prévias):** a página sem `?menu` abre a entrada e o menu inicial; robô e cenas usam `?menu=0` (sem
   menu nem save), `?menu=nova` ou `?menu=continuar`.
10. **Teto A1:** 1.988 KB no principal contra 1.638 (a C1 decide); a U2a pôs telas e textos longos sob demanda.

## Revisão adversarial (03/10/2026)
Corrigido nos arquivos da U2a:
- **Carregar o automático mais velho perdia o save:** o save de segurança antes de carregar caía no rodízio justo no
  espaço que ia ser aberto (com os 3 automáticos cheios, "Carregar auto1" gravava a partida de agora em auto1 e abria
  ela mesma). `salvar(slot, { evitar })` tira o espaço do rodízio; `carregar` e `apagarSave` usam.
- **Nova partida que caía antes do primeiro save voltava diferente:** o app manda `holding.identidade` (com o criador)
  antes de o diário começar; a reconstrução perdia o comando (seq um a menos, outro hash e seq repetido no diário).
  `comecarNova` leva para o diário os comandos que a simulação nova já tem.
- **Aba velha gravando por cima da linhagem:** se outra aba assumiu a partida no começo de um save, o retrato velho virava
  save da mesma linhagem; o save agora para com `outraPagina`.
- **Apagar o save que é a base do diário** da partida em jogo salva de novo na hora (a partida não fica sem base).
- **Exportar a partida** (Configurações) salva antes: o arquivo leva a partida de agora, não a de até 5 min atrás.
- **Continuar mostrava o último save, não o que abre:** `resumoContinuar` (e `app.resumoContinuar`) dá a partida do
  diário (até a que nunca salvou) ou o save da linhagem com a data do diário; o menu e a capa usam.
- **"Recomeçar" perdia o criador:** `app.salvamento.estado()` não trazia `criador`.
- **"Sair para o menu" com `?menu=0`** (e nas cenas e na sintética) deixava o jogo coberto e parado sem menu: só existe
  onde há menu inicial.
- **Resolução dinâmica e nitidez eram controle morto** (`R.resolucao` não existe): ficam à vista, desligadas e com o
  motivo, e ligam sozinhas quando a R1a publicar a função; a leitura ao vivo continua.
- Dicas "avisos" e "numeros" com o texto do mouse ("Clique"); importação recusa arquivo grande antes de ler; variável
  morta nas dicas.
Testes: `save.teste.mjs` com 11 (10 ok e o `todo` da S3a), um novo cobrindo carregar o automático mais velho, a
identidade na reconstrução, apagar a base e o resumo do Continuar. `simular --testes` inteiro verde (33 áreas).
Chromium (`--chromium`): tique 42, seq 5, hash igual antes e depois. Jogo montado: carregar auto1 abre o tique 0 e o
de segurança vai para auto2; exportar salva antes; menu volta com "Holding Held · 349 moradores · jan. 2020".
Principal: a U2a pesa 49 KB no JS principal e 48 KB sob demanda (medido por arquivo no metafile do esbuild).
Pendência nova para a X3a: os rótulos do mundo (Meridian Ring, Horizon Ring, Codex Tower...) ficam com contraste de
1,82:1 sobre o chão claro da vitrine e um sai da tela; as cenas u2-painel e u2-dica falham na medida só por eles.
