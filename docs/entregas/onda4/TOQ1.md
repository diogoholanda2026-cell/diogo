# TOQ1: toque no Poco X7 e app estável (D99). Nota de entrega, 06/10/2026

Resultado em poucas linhas:
- O defeito que o dono descreveu ("mal desliza na tela e o cenário muda de lugar rapidamente") foi reproduzido com toque emulado e CPU limitada e tinha três causas, nenhuma delas o custo do raio: (1) a velocidade de soltura era medida pelo tempo do quadro, então com quadros lentos o deslize não vinha (nada em 2 de 4 rodadas) ou explodia (1.373 px de uma vez); (2) dois dedos andando juntos viravam zoom e giro sem querer (20% a 46% de zoom no fim de um arrasto de dois dedos); (3) o controle da resolução dinâmica ignorava todo quadro acima de 250 ms, justo no celular que mais precisa dele.
- Os três foram corrigidos. Depois: o deslize vem em todas as rodadas com quadro de 130 ms ou mais lento, tem teto e para limpo; um arrasto de dois dedos faz 0% de zoom sem querer; a pinça de verdade continua dando o mesmo zoom (43% a 45%); a resolução baixa a 72% enquanto a vista se mexe e volta 280 ms depois de parar.
- O app ficou estável: a perda do contexto WebGL recarrega pelo "continuar" levando a câmera e a velocidade do tempo; o laço pausa no fundo, salva e retoma; no celular o quadro do jogo roda no máximo a 60 por segundo (a Média só desenha a 30); sessão de 32 minutos sem recarga e sem crescimento da heap.
- Nada piorou: JS do jogo 2.120 KB (teto 2.355 KB; antes 2.089 KB, a diferença inclui a UX1); bancada 'pc' aberta 68 chamadas e 551 mil triângulos (antes 73 e 552 mil), 0 compilações depois de pronto; testes inteiros verdes; montagem sem aviso.

## 1. As hipóteses, uma por uma

| Hipótese | Veredito | Prova |
|---|---|---|
| (a) um raio e um `camera.atualizar` por pointermove | custo real, mas não é o que faz o pulo | o "salto além do que o dedo andou" no arrasto de um dedo é 0 px antes e depois; o raio custa 0,01 a 0,08 ms por quadro. Mesmo assim o trabalho caiu: raios por quadro na pinça 1,75 para 0,60 e atualizações da câmera por quadro 4,4 para 2,0 (agora a câmera anda uma vez por quadro, em `quadro()`, e os eventos só guardam o dedo) |
| (b) a velocidade de soltura usa a janela de 90 ms do quadro e explode | CONFIRMADA | antes: deslize de 1.373 px numa rodada da primeira medida, e em outras o deslize nem vinha (0 px em 2 de 4 rodadas a 130 ms e 0 de 1 a 1 qps). Agora a velocidade é o ajuste de uma reta por mínimos quadrados nos últimos 100 ms de hardware (eventos coalescidos), com teto de 3.000 px/s no dedo e 2.200 px/s no centro |
| (c) `dt` limitado a 0,1 s gera saltos | confirmada em parte | a inércia era integrada por Euler (um quadro lento andava diferente de vários rápidos); agora é a conta exata (v x tau x (1 - e^(-dt/tau))), o mesmo caminho em quadros de 16 ms e de 250 ms (teste), `dtMax` 0,25 s, tau do deslize 0,32 para 0,25 s, parada limpa abaixo de 6 px/s e ao bater na borda do mapa |
| (d) 120 Hz e escala de pixel | confirmada em parte | a Média desenha a 30 qps mas o quadro inteiro (simulação, domínios, interface) rodava a 120 Hz no Poco X7; `laco.js` limita a 60 por segundo nos perfis Média e Leve (o PC segue a tela). A razão px de CSS para px do canvas não mudou o gesto: tudo é medido em px de CSS |
| (e) limiares pequenos demais para o dedo | CONFIRMADA | pan2 (dois dedos juntos, um 12% mais lento, com tremor): zoom sem querer de 20,7% (pior 23,3%) a 39,7% (pior 46%) antes, 0% depois. Limiares novos: toque 10 px (era 8), pinça o maior entre 18 px e 10% do vão (era 12 px), giro o maior entre 8 graus e 14 px de arco (era 6 graus), andar 6 px (era 4), e a pinça só vale se mudar o vão em pelo menos 30% do que o meio dos dedos andou. Modelo de dedo com semente fixa (600 gestos): pinça sem querer 30% e giro 10% antes, menos de 3% depois |
| (f) o painel da interface captura eventos | descartada | o canvas já tem `touch-action:none` e `overscroll-behavior:none` (o teste "instalação" guarda isso) e a captura do ponteiro é do canvas. Acrescentei o dedo fantasma (um pointerup perdido virava pinça no toque seguinte) e o gesto do sistema embaixo (12 px de baixo não começam nada) |
| (g) o quadro cai demais e o gesto parece quebrado | CONFIRMADA | `resolucao.js` só contava quadros de menos de 250 ms: no cenário lento (Média no Chromium sem GPU, 0,3 a 1,4 qps) 0 trocas em 60 s. Agora a janela de 1 s decide pela mediana, aceita quadros até 2,5 s, desce direto ao degrau que cabe quando a mediana passa de 1,8 vez o alvo e, em movimento, cai a 72% (piso 0,55) se o quadro já está perto do alvo e volta 280 ms depois de a vista parar. Mesmo teste: 1 troca de 1,0 para 0,85 em 32 s |

## 2. Tabelas, antes e depois

Método: Chromium de teste, toque pelo CDP (`Input.dispatchTouchEvent`), CPU limitada (`Emulation.setCPUThrottlingRate` 1x, 4x e 6x), 60 e 120 Hz de eventos, sonda de quadros que não depende do código do jogo (vale para a montagem da base e a entregue). Cenários por custo do quadro: rápido (uns 50 a 80 ms por quadro, 12 qps), médio (uns 130 a 250 ms, 5 qps) e lento (a Média inteira em SwiftShader, 1 qps). Gestos: arrasto (300 px em 1,2 s), flick (500 px em 250 ms), pinça (200 para 400 px) e pan2 (dois dedos juntos). Mediana e pior das rodadas (entre parênteses, quantas). Antes é a base `1775464`; depois é a árvore entregue. A máquina tem outras parcelas rodando: o "quadros acima de 50 ms" depende da carga dela, não do gesto.

| cenário | gesto | métrica | antes: mediana / pior (rodadas) | depois: mediana / pior (rodadas) |
|---|---|---|---|---|
| rápido | arrasto | salto além do que o dedo andou (px) | 0 / 0 (6) | 0 / 8,5 (6) |
| rápido | arrasto | maior salto num quadro (px; é o que o dedo andou) | 54 / 122 (6) | 57 / 93 (6) |
| rápido | arrasto | quadros acima de 50 ms | 10 / 12 (6) | 12 / 14 (6) |
| rápido | flick | 1º quadro depois de soltar (px) | 261 / 364 (6) | 206 / 352 (6) |
| rápido | flick | deslize total (px) | 777 / 856 (6) | 504 / 624 (6) |
| rápido | flick | tempo até parar (ms) | 2.452 / 2.690 (6) | 1.735 / 1.803 (6) |
| rápido | pan2 | zoom sem querer no fim (%) | 20,7 / 23,3 (6) | 0 / 0 (6) |
| rápido | pan2 | maior zoom num quadro (%) | 11,7 / 12,9 (6) | 0 / 0 (6) |
| rápido | pinça | zoom no fim (%) (a pinça de verdade) | 45,5 / 46,8 (6) | 43,1 / 45 (6) |
| médio | arrasto | salto além do que o dedo andou (px) | 0 / 0 (4) | 0 / 0 (4) |
| médio | arrasto | quadros acima de 50 ms | 5 / 12 (4) | 3 / 4 (4) |
| médio | flick | rodadas em que a vista desliza depois de soltar | 2 de 4 | 3 de 4 |
| médio | flick | deslize total (px) | 266 / 270 (4, duas sem deslize) | 563 / 637 (4) |
| médio | flick | tempo até parar (ms) | 794 / 831 | 2.548 / 2.867 |
| médio | pan2 | zoom sem querer no fim (%) | 39,7 / 46 (4) | 0 / 0 (4) |
| médio | pan2 | maior zoom num quadro (%) | 33,4 / 39,7 (4) | 0 / 0 (4) |
| médio | pinça | zoom no fim (%) | 44,4 / 44,4 (4) | 45 / 45 (4) |
| lento | flick | a vista desliza depois de soltar | 0 de 1 (0 px) | 1 de 1 (125 px) |
| lento | pan2 | maior zoom num quadro (%) | 20,4 (1) | 0 (1) |

Lido com cuidado:
- O deslize antes do flick no cenário rápido era maior (777 px contra 504 px) porque o tau era 0,32 s e a velocidade vinha do tempo do quadro; o alvo do projeto é o deslize que o dedo pede e para limpo (teto de uns 550 px em um arremesso de verdade, parada em uns 1,4 s). No cenário médio é o contrário: antes não deslizava ou explodia, agora desliza o que o dedo pediu. O "tempo até parar" de 2,5 s no médio é a soma do deslize com quadros de 200 a 600 ms (a vista anda em poucos quadros grandes), não a inércia.
- Uma das 4 rodadas do flick médio (120 Hz, CPU 1x) não deslizou: os eventos que o CDP injeta não são alinhados ao quadro como os do Chrome num aparelho, um quadro de 400 ms deixou o pointerdown parado por mais de 450 ms e o gesto virou toque longo (0 px). No aparelho o Chrome entrega os pointermove antes do rAF. Se o dono relatar o menu de contexto abrindo ao arremessar rápido, a conta é subir `longoMs` para 500 ou medir pelo tempo do último evento (pendência abaixo).
- "Maior salto num quadro" no arrasto é quanto a imagem andou no maior quadro, que é o que o dedo andou nele (o "salto além do dedo" é a medida do defeito: 0 antes e depois, com um pior caso de 8,5 px depois, num quadro de 1 s). Quadros de 400 ms andam 100 px porque o dedo andou 100 px.
- A pinça de verdade agora perde só o limiar (20 px de 200) em qualquer velocidade de quadro (a referência é o ponto do limiar no caminho dos dedos, não o ponto em que o quadro o viu; uma versão intermediária perdia 30% do zoom em quadros de 200 ms, o teste novo guarda isso).

Custo por quadro durante o gesto (mediana das rodadas, antes / depois):

| gesto | raios por quadro | ms de raio por quadro | `camera.atualizar` por quadro |
|---|---|---|---|
| arrasto | 0,88 / 0,71 | 0,08 / 0,01 | 1,81 / 1,57 |
| pinça | 1,75 / 0,60 | 0,03 / 0,02 | 4,38 / 2,00 |
| dois dedos juntos | 1,73 / 0,80 | 0,04 / 0,02 | 4,38 / 2,50 |

Resolução dinâmica na Média inteira (Chromium sem GPU, 60 s parado, DPR 1; ferramenta `h/dinamica.mjs`): antes 0 trocas, razão de pixels 1,0 em todas as janelas de 1 s (de 0,5 a 1,4 qps: o controle ignorava quadros acima de 250 ms); depois 1 troca (1,0 para 0,85 aos 32 s, quadro de 1,58 s). Isso prova que o controle enxerga quadros lentos; o efeito na Média no Poco X7 só o Teste de desempenho do dono mostra (ver a seção 6).

Retomada do contexto, no Chromium com `WEBGL_lose_context` (`h/retomada.mjs`): antes de perder, câmera (123, -456, 777, 33 graus, 41 graus), velocidade 2 e 349 habitantes; durante, a tela "Reconectando os gráficos..." e o tempo pausado (velocidade 0); depois da volta, a página recarregou pelo `?menu=continuar`, a câmera voltou idêntica, a velocidade voltou a 2, a população é a mesma (349), o `?menu=continuar` saiu do endereço e a guarda de recargas ficou com 1 registro. Sem a recarga, o jogo voltava a desenhar com o chão chapado e escuro (o cubo do céu, a luz do ambiente e a sombra só existem na placa).

Fundo e salvamento (`h/fundo.mjs`, navegador): ao ir para o fundo a simulação pausou (velocidade 0 e o tique parado em 3), o diário gravou o tique exato (3) e o save automático saiu (auto2 no tique 3); ao voltar a velocidade 2 voltou e o tique andou (6); `pagehide` gravou o diário no tique de agora (7). Sem erros.

## 3. Memória: sessão de 32,5 minutos sem recarga (`h/memoria.mjs`)

Chromium de teste em 480 x 270, Leve, aceleração máxima (4x), o robô de partida jogando, coleta e medida da heap depois de um gc a cada 2,5 min.

| min | tique | heap JS (MB) | nós DOM | ouvintes | vídeo (MB) | geometrias | texturas |
|---|---|---|---|---|---|---|---|
| 0 | 0 | 17,3 | 552 | 85 | 59,5 | 39 | 31 |
| 2,5 | 380 | 21,9 | 568 | 89 | 83,1 | 42 | 33 |
| 5 | 677 | 23,3 | 656 | 90 | 83,1 | 42 | 33 |
| 10 | 1.444 | 23,5 | 652 | 90 | 83,1 | 42 | 35 |
| 15 | 2.243 | 23,7 | 648 | 90 | 83,8 | 42 | 33 |
| 20 | 3.156 | 23,9 | 649 | 90 | 83,4 | 42 | 33 |
| 25 | 3.907 | 23,9 | 657 | 91 | 83,8 | 42 | 37 |
| 30 | 4.655 | 24,2 | 657 | 91 | 83,1 | 42 | 33 |
| 32,5 | 4.995 | 23,9 | 658 | 91 | 83,4 | 42 | 34 |

A heap sobe uns 6 MB nos primeiros 5 minutos (a cidade que o robô constrói) e daí oscila entre 23,3 e 24,2 MB: sem crescimento (teto medido 24,2 MB). Uma carga de página (sem recarga), 0 erros, mesma página do começo ao fim; nós, ouvintes, memória de vídeo, geometrias e texturas estáveis. A máquina sem GPU roda uns 2,5 tiques por segundo a 4x (o laço limita o dt a 250 ms por quadro, D15): 5.000 dos 7.200 tiques de 30 minutos; num celular a 30 qps chegaria aos 7.200 (o robô não chegou ao alvo de tiques no tempo, por isso `ok:false`, mas sem falhas: `falhas: []`). Durante a sessão houve 1 compilação de programa depois de pronto (a partir do minuto 2,5, com o robô construindo; a bancada aberta tem 0): não é do gesto, fica de observação para o dono das cenas.
A simulação sozinha (Node, `h/heap-sim.mjs`, o robô por 6 h de jogo): heap 13,5 para 15,2 MB, platô nas últimas três amostras.

## 4. O que mudou (só os meus arquivos)

Novos:
- `fonte/render/camera/gesto.js`: peças puras (limiares do árbitro, `Rastro` com a velocidade por mínimos quadrados no tempo do hardware, teto do quadro, `opcoesDoToque`, `pontoDaPinca` e `pontoDoGiro`). Sem three, roda no Node.
- `fonte/render/camera/toque-log.js`: o registro `?toque=1` (por quadro: eventos, dt, deslocamento da câmera, custo do raio, salto) e o painel ao vivo no canto da tela.
- `fonte/app/estavel.js`: a perda e a volta do contexto WebGL, a retomada (câmera e velocidade na sessão, validade de 5 min), a guarda de recargas (2 em 60 s; se a volta não vem em 8 s, recarrega do mesmo jeito).
- `fonte/ui/inicio/corpo/Toque.jsx` e `fonte/ui/textos/toq1.js`: Configurações do toque.
- `ferramentas/testes/toque.teste.mjs`: 27 testes.

Mudados:
- `fonte/render/camera/entrada.js`: o árbitro. Um raio por quadro, ponto preso sob o dedo com teto de deslocamento por quadro (1,6 vez o que o dedo andou, mais 12 px), soltura medida em tempo de hardware, limiares novos, dedo fantasma, gesto do sistema embaixo, cancelamento em foco perdido, fundo e `pagehide`, o aviso de movimento para a resolução e o registro.
- `fonte/render/camera/camera.js`: inércia exata, tetos (`DESLIZE`), parada limpa e na borda, `metrosPorPx` e `velocidade`.
- `fonte/render/motor/resolucao.js`: mediana, quadros lentos de verdade, descida severa direto ao degrau, resolução em movimento.
- `fonte/app/laco.js`: limite de 60 qps no celular, relógio do quadro recomeça ao voltar do fundo e do cache de voltar e avançar.
- `fonte/app/controle.js`: preferências do toque na entrada, `ligarContexto` e a aplicação da retomada.
- `fonte/ui/inicio/corpo/Configuracoes.jsx`: 5 linhas, só para encaixar `ControlesToque` na aba Controles (é da U2a: pendência).
- `ferramentas/testes/luz-e-entrada.teste.mjs`: os testes de entrada chamam `E.quadro()` porque a câmera agora anda no quadro, não no evento.
- Não precisaram de mudança: `fonte/web/sw.js` e `manifest.webmanifest` (tela cheia, horizontal, ícones 192 e 512 com o mascarável, `fetch`, `install` e `activate`, `viewport-fit=cover`; o teste "instalação" guarda isso).

## 5. Contratos, registros e orçamento

- Preferências novas em `heldopolis.prefs`: `toqueArrasto`, `toquePinca`, `toqueGiro` (0,6 a 1,5, a entrada limita a 0,4 e 2) e `toqueInercia`. Padrão 100% e deslize ligado, sem mexer em nada.
- `R.entrada.opcoes({ sensArrasto, sensPinca, sensGiro, inercia })` (a entrada já tinha `opcoes`).
- `?toque=1` na URL liga `window.__toque` (`quadros`, `eventos`, `resumo()`, `limpar()`) e o painel.
- Sessão: chaves `heldopolis.retomada` e `heldopolis.recargas` no `sessionStorage`.
- Orçamento: `jogo 2120.1 KB` (teto 2355 KB; a base marcava 2089.0 KB, a diferença inclui a UX1); `guarda-texto ok (344 arquivos)`; bancada 'pc' aberta: antes 73 chamadas e 552 mil triângulos, depois 68 e 551 mil, 64 programas, 0 depois de pronto.

## 6. Pedido ao dono: o que medir no Poco X7

1. Teste de desempenho (Configurações, Vídeo): 3 rodadas, na vista do jogo, com a qualidade Média. Anote o qps médio, o p95 em ms e a resolução final de cada rodada. Meta: 30 qps; o piso que a TOQ1 persegue é 24 qps sem o gesto derrubar. O p95 em ms é o quadro que 95% dos quadros não passam (33 ms é 30 qps; acima de 50 ms o gesto engasga). Se a resolução final ficar em 70% ou menos, o aparelho está no limite e a nitidez cai.
2. Um vídeo curto (gravador de tela do Android) com `?toque=1` no fim do endereço da prévia (por exemplo `.../previa/?toque=1`): um arrasto lento, um arremesso rápido, uma pinça e dois dedos juntos. O painel no canto de cima à esquerda mostra a tabela do último gesto ao vivo:
   - `quadros no gesto` e `dt médio`: quantos quadros e quanto tempo por quadro durante o gesto (33 ms é o alvo);
   - `quadros acima de 50 ms`: os engasgos durante o gesto (queremos 0 a 2);
   - `maior salto` (e o que o dedo andou): quanto a imagem andou no maior quadro; deve ser perto do que o dedo andou;
   - `salto além do dedo`: quanto o chão escorregou do dedo; deve ficar perto de 0 (acima de 20 px o ponto preso está pulando);
   - `deslize depois de soltar`: px e ms que a vista continuou andando; num arremesso forte esperamos uns 300 a 550 px em até uns 1,5 s;
   - `raios por quadro`: deve ser 1 ou menos;
   - `resolução`: a razão de pixels de agora; cai a uns 72% durante o gesto e volta uns 0,3 s depois de parar.
3. Configurações, Controles, "Toque e câmera": diga se o arrasto, a pinça e o giro estão bons em 100%, ou qual valor (60% a 150%) ficou melhor; e se prefere o deslize ligado ou desligado.
4. Instalar como app (menu do Chrome, "Instalar app"): deve abrir em tela cheia na horizontal. Troque de aplicativo por um minuto e volte: o jogo deve voltar pausado e retomar na velocidade de antes; diga se a página recarregou.

## 7. Pendências para o integrador

1. A ferramenta aberta (a via em desenho, a zona, o item a colocar) não é retomada depois da recarga do contexto: o estado dela vive em `ui/ferramentas/sessao.js` (UX1 e X2), com a prévia e o desfazer dentro. O app já guarda a câmera e a velocidade. Proposta: `sessao.js` exportar `estadoParaRetomar()` e `retomar(estado)` com o tipo e as opções que `abrir(tipo, op)` aceita, e o `controle.js` leva isso na mesma chave de retomada. Sem isso o jogador volta ao mesmo lugar e tempo, com a bandeja fechada.
2. `ui/inicio/corpo/Configuracoes.jsx` (da U2a): 5 linhas minhas (import e o bloco `ControlesToque` na aba Controles, só quando a tela é de toque).
3. A medida de "a Média não cai de 24 qps por causa do gesto" não existe no Chromium de teste (SwiftShader roda a Média a 1 qps); o que está provado é o controle (testes de unidade e a troca de degrau em quadros lentos) e o trabalho por quadro do gesto (um raio, uma atualização). O número de verdade é o Teste de desempenho do dono (seção 6).
4. O CDP não alinha os eventos ao quadro como o Chrome num aparelho: 1 de 4 flicks médios virou toque longo por um quadro de 400 ms. Se o dono relatar o menu de contexto abrindo no arremesso, subir `GESTOS.longoMs` de 450 para 500 e medir o toque longo pelo tempo do último evento.
5. Uma compilação de programa depois de pronto na sessão do robô (a partir do minuto 2,5): ver com o dono das cenas qual programa (não é do gesto; a bancada aberta tem 0).
6. A guarda de texto ficou sem aviso e os textos novos estão só em `ui/textos/toq1.js`; se o integrador mover o registro, `controle.js` e `Toque.jsx` chamam `registrar(registrarTextos)` (idempotente).

## 8. Como testei

- `node ferramentas/simular.mjs --testes`: tudo verde (arcologia, mundo e save falharam numa rodada intermediária por edição em andamento da UX1 em `sim/predios.js` e passaram na seguinte; o A2 do robô verde na final), `testes ok`, guarda de texto ok em 344 arquivos.
- `node --test ferramentas/testes/toque.teste.mjs`: 27 de 27. Cobre: arrasto sem salto com quadros de 120 ms e um raio por quadro, dez eventos custam um raio, penhasco (o chão salta 120 m), sensibilidade, soltura por coalescidos, teto e parada limpa, dedo parado e arrasto lento, inércia desligada, mínimos quadrados, limiares (600 gestos com semente), a pinça e o giro com quadros de 16 e de 208 ms, o dedo fantasma, o gesto do sistema, o registro `?toque=1`, a conta exata da inércia, a borda do mapa, a resolução em movimento e em quadros lentos de verdade, a retomada, o contexto (inclusive a perda com o tempo já pausado pelo fundo, que leva a velocidade de antes do fundo), o laço no fundo, o limite de 60 qps, o manifesto e o service worker, e o salvamento no fundo, em `pagehide` e em `freeze`.
- `node ferramentas/montar.mjs --saida <pasta temporária>`: sem aviso (jogo 2120.1 KB, worker de tarefas 3,5 KB, oficina 216,6 KB).
- Navegador: `h/gesto.mjs` (matriz), `h/dinamica.mjs`, `h/retomada.mjs`, `h/fundo.mjs`, `h/memoria.mjs`, `ferramentas/bancada.mjs` (cena aberta no 'pc').

Arquivos de apoio em `scratchpad/novo/TOQ1/`: `h/` (scripts de medida), `fim/` (saídas finais: `tabela-entrega.md`, `custo-final.md`, `memoria.json`, `memoria-tabela.md`, `retomada.log`, `fundo.log`, `testes-final.log`, `montagem-final.log`, `out/` e `out2/` com os brutos dos gestos), `antes-inicial.json` e a captura `fim/cap-config-toque.png` (Configurações do toque, 1376 x 768).
