# Arcologia de Held: composição total

Jogo de construção no estilo **SimCity BuildIt**, em 3D, feito para celular (testado para o Poco X7) e que também roda no computador. A única obra do jogo é a **Composição Total da Arcologia de Held**, com todas as estruturas da foto em `arte/originais/composicao-total-arcologia-de-held.png`, construídas como uma cidade viva no visual do BuildIt: dia claro e colorido, ciclo de dia e noite, praia, mar e morros em volta. Cada estrutura segue a arquitetura da foto (terraços com beirais e floresta vertical, casca branca em rede, madeira em treliça, cúpula geodésica), com as cores limpas e vivas do BuildIt. Ela começa como pasto degradado cercado de mata e cresce etapa por etapa, com canteiro, andaimes, grua e operários, até ter cada componente da foto no lugar.

**Jogar:** https://diogoholanda2026-cell.github.io/diogo/ (atualiza sozinho a cada envio ao GitHub).

| Composição total, de dia | Planta holográfica no início |
|---|---|
| ![](arte/telas/01-composicao-total.png) | ![](arte/telas/02-planta-holografica.png) |

| Obra em andamento | Prancha de entrega | Usina de materiais |
|---|---|---|
| ![](arte/telas/03-obra.png) | ![](arte/telas/04-prancha.png) | ![](arte/telas/05-usina.png) |

![Comparação com a foto de referência](arte/telas/06-comparacao.png)

![Ciclo de dia e noite](arte/telas/09-dia-e-noite.png)

![Biblioteca Central, etapa por etapa](arte/telas/07-etapas-biblioteca.png)

![Modos de obra: draga, obra linear, aprovação e replantio](arte/telas/08-modos-de-obra.png)

## Instalar no celular (recomendado)

O melhor formato para este jogo é um **app instalável (PWA) servido pelo GitHub Pages**. No Poco X7:

1. Abra o link acima no **Chrome**.
2. Menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial"). Se nada acontecer, dê ao Chrome a permissão **Atalhos na tela inicial** nas configurações do HyperOS.
3. Abra pelo ícone. O jogo roda em **tela cheia, em paisagem**, **funciona sem internet** e se atualiza sozinho quando houver versão nova.
4. Em Configurações do jogo, confira se aparece "Armazenamento protegido": assim o Chrome não apaga o progresso quando o celular enche.

Para jogar a **120 qps**: o Chrome para Android limita jogos a 60 qps em telas de 120 Hz. Até o Chrome 156 (que libera 120 Hz em tela cheia), desative `chrome://flags/#throttle-main-thread-to-60hz`, deixe a tela do celular em 120 Hz e escolha 120 nas configurações do jogo. 60 qps esquenta menos e gasta menos bateria.

### Por que PWA e não um app próprio (APK)

| | Navegador | **PWA instalada** | APK (Capacitor/TWA) | Motor nativo (Unity/Godot) |
|---|---|---|---|---|
| Desempenho 3D | igual | **igual** | igual (mesmo Chromium) | um pouco melhor |
| Tela cheia e paisagem travada | limitado | **sim** | sim | sim |
| Offline | não | **sim** | sim | sim |
| Atualização | automática | **automática** | reinstalar APK | reinstalar APK |
| Instalação no Poco X7 | nenhuma | **um toque** | sideload (o Google anunciou verificação obrigatória de desenvolvedores no Brasil a partir de 30/09/2026) | sideload |
| Salvamento | pode ser apagado | **protegido** (`storage.persist`) | "transitório" (WebView) | arquivo local |

A PWA usa o mesmo renderizador que um APK usaria, sem o atrito de instalar APK, e recebe cada melhoria assim que o código é enviado. Um motor nativo exigiria reescrever tudo por um ganho pequeno.

## Como jogar

O ciclo é o do SimCity BuildIt, adaptado a uma obra fixa e pensado para **4 visitas curtas por dia**: em cada visita o jogador coleta, entrega, aprova e enche as filas; o canteiro trabalha enquanto o jogo está fechado.

1. **Usinas de Materiais** (até 3, com até 6 espaços) produzem matérias-primas em paralelo: madeira certificada, brita reciclada, aço reciclado, argila, sementes nativas, vidro, cobre e fibra de bambu. São rápidas: rendem durante a visita.
2. **Oficinas** (Carpintaria, Central de Concreto, Horto, Serralheria, Vidraçaria, Oficina Elétrica e Laboratório de Campo) fazem os produtos **um de cada vez, em fila de até 9 itens**. Quanto mais avançado o produto, mais tempo leva (níveis 1–2 ×0,75, 3–4 ×1, 5–9 ×3, 10–14 ×5, 15+ ×8): uma fila cheia rende a noite inteira. Com a **bandeja cheia (9 prontos)** a fila para, e o próximo item só começa, com o tempo inteiro, depois da coleta. **Encomenda em cadeia:** um item pode entrar na fila sem os insumos; ele espera, puxa os insumos do almoxarifado ou da bandeja de outra oficina quando ficam prontos, nunca segura a fila e sai sozinho depois de 12 h sem insumos.
3. **Almoxarifado** tem limite. Amplie com estrados, etiquetas e cadeados, que caem ao coletar produção (3%) e ao subir de nível (um por nível).
4. **Obras:** cada estrutura da foto tem de 1 a 5 etapas. Na **prancha**, entregue os materiais aos poucos, pague os créditos e inicie. As obras ficam mais longas a cada capítulo (de minutos no capítulo 1 a horas no 5), então a cada volta a obra está num ponto diferente do filme. Ao aprovar, a Holding paga a **medição**: 70% do custo da etapa nos capítulos 1 a 3, 60% no 4 e 50% no 5 e no epílogo (no fim, os repasses de uma arcologia cheia já pagam as obras).
5. **Módulos:** os edifícios-fita (Anel do Campus, Campus Universitário, Anel da Biblioteca, Santuário com 4 pavimentos e as casas da Vila) crescem um pavimento por nível; cada pavimento aprovado também é medido (com a mesma tabela).
6. **Serviços e bem-estar:** do nível 3 em diante os moradores pedem **água**; do 4 em diante, **energia e saneamento**; o último pavimento pede **70% de bem-estar**. O bem-estar é 35 + as obras de lazer + as escolhas do Conselho − 1 ponto a cada 200 moradores: morar mais gente pede mais praça e verde. No fim do capítulo 3 fica em torno de 75% (cerca de 80% com as escolhas que cuidam das pessoas, 60% a 65% com as que aceleram a obra); por isso, no capítulo 4, quem escolheu acelerar precisa do palco do anfiteatro e do Centro de Física antes de subir o Anel ao 5º pavimento.
7. **Repasses** da Holding: (24 + 0,0025 por morador) × (0,5 + bem-estar) créditos por minuto, guardados por até 4 h no cofre da Sede (antes dela, no Escritório).
8. **Mutirão e disposição:** a comunidade ganha **disposição** (+2 por pedido, +4 por módulo, +8 por etapa, +30 por marco); a cada 100 pontos vem uma **ficha de Mutirão** (teto de 3). Uma ficha adianta até **2 horas** de um cronômetro (na usina, todos os espaços; na oficina, o item atual).
9. **Licenças:** obras grandes pedem topografia. **Estacas** vêm da madeira (0,6%), **balizas** da Serralheria (3%) e **trenas** da Oficina Elétrica (3%). O **Topógrafo** do Escritório faz uma por vez: estaca (2 madeira + 300, 20 min), baliza (2 aço + 600, 30 min), trena (2 cobre + 900, 45 min).
10. **Pedidos da comunidade** (do capítulo 2 em diante: 3 cartões, 4 no capítulo 3, 6 depois) têm quem pede, onde mora e por quê, e pagam com licenças, itens de almoxarifado, bem-estar por 24 h ou disposição, além de créditos e experiência.
11. **Depósito de Trocas:** 10 unidades de cada matéria-prima a cada 4 horas, com o preço subindo 12% a cada compra; vende até 20 itens por janela.

Tudo segue rodando com o jogo fechado: ao voltar, as oficinas andam em passos de 5 minutos (uma pode esperar o produto da outra) e é só coletar. Jogando quatro vezes por dia, a composição inteira leva cerca de duas semanas; em Configurações, **Ritmo da obra 2× ou 4×** encurta todos os cronômetros.

### A história e a ordem da obra

Cinco capítulos e um epílogo, com conselheiros (Íris, arquiteta-chefe; Tomé, engenheiro de materiais; Nara, bióloga; Caio, físico; Dona Cida, voz dos moradores). A ordem segue a lógica de uma obra real: primeiro o acesso, a água e a administração; depois moradia, escola e praça; em seguida biblioteca e faculdades; o acelerador subterrâneo e a vila; por fim os habitats dos animais. Cada etapa aprovada tem uma fala do conselheiro da área; ao cumprir 1/3 e 2/3 das metas de um capítulo vem um **marco** (fala, disposição e créditos).

No fim de cada capítulo o Conselho apresenta um **dilema** sobre o que vem pela frente: a primeira opção cuida das pessoas (bem-estar), a segunda acelera a obra, e cada uma tem um custo. Canteiro compacto × amplo; Biblioteca aberta dia e noite × Laboratórios primeiro; Telhados solares × Geotermia profunda; Elefantes × Aquário primeiro; e, para o replantio do epílogo, Tarifa social da água (+6% de bem-estar, replantio 30% mais caro) × Água para a obra (Horto 20% mais rápido e replantio 40% mais curto, −3% de bem-estar). O epílogo lembra as escolhas.

1. **Fundação:** canteiro, Caminho da Frente, desassoreamento do Lago Central, Sede da Holding e os primeiros módulos do Anel. Um tutorial curto (4 a 6 minutos) leva da primeira brita ao primeiro módulo: um anel dourado pulsa sobre o que tocar (o balão, o botão ou o controle dentro do painel) e o conselheiro explica cada passo.
2. **Água que corre:** margens vivas e estação natural de água, Escola e Campus para Jovens, campo, Praça Central com jardins filtrantes, Bulevar Verde, anel de vidro solar da Sede.
3. **Saber de madeira:** Biblioteca Central (núcleo, andares, pilares-árvore, dossel), Centro de Recursos Digitais, Faculdades de Humanidades, Engenharia e Ciências, Instituto de Estudos Urbanos, Campus Universitário, Ala em Onda, pontes.
4. **Energia escondida:** Acelerador de Partículas (poço, anel, detectores, Centro de Física), anfiteatro e casas da Vila Estudantil.
5. **Casa dos gigantes:** Santuário com 4 pavimentos, habitats da savana com elefantes, girafas e rinocerontes, Bioma Aquático (cúpula geodésica com aquário) e Recinto dos Gorilas. Os materiais do santuário (nós, cúpula, acrílico, ração, kits veterinários) só aparecem aqui.
6. **Composição total:** desmontar o canteiro (as oficinas descem para galpões sob o acelerador) e replantar a mata. As duas pranchas aceitam materiais já no capítulo 5 e as obras do epílogo são curtas de propósito (fator de obra 0,15), então o final acontece em uma ou duas visitas, como uma festa.

### Equilíbrio medido por um robô

`ferramentas/simular.mjs` joga a partida inteira sozinho, no ritmo contínuo ou em **4 sessões de 15 minutos por dia** (7:30, 12:30, 18:30 e 22:00), e mede a duração de cada capítulo, onde a obra trava, quanto as oficinas trabalham, créditos, fichas, pedidos e obras simultâneas. `npm run simular:todos` roda testes de regra (fila parada, cadeia, tempo fechado, migração de saves antigos, depósito, topógrafo, marcos, pedidos, falas), confere que nenhuma ordem de obra pode travar serviços ou bem-estar, e uma matriz de 8 combinações, e sai com erro se algo sair das faixas:

- capítulo 1 em 30 a 45 minutos de jogo contínuo; em sessões, o jogo inteiro em 12 a 16 dias, cada capítulo do 2 ao 5 em 1,5 a 4 dias e o epílogo em até 8 horas;
- créditos no fim de cada capítulo, inclusive o 5, até 1,5 vez o custo do seguinte (sem inflação); oficinas ocupadas pelo menos 15% do tempo; ao menos 3 níveis no capítulo 5;
- bem-estar entre 70% e 85% (média) no fim do capítulo 3, sem chegar a 100% antes do capítulo 5;
- com Mutirão, no máximo 30% das fichas perdidas no teto; com o Depósito, o jogo encurta no máximo 15%; licenças e saneamento pesam de verdade, mas nunca travam;
- a encomenda em cadeia termina sem trava; a "Meta em foco" (o robô que só segue `J.planoMeta()`, que também manda coletar a bandeja cheia, subir módulos em paralelo, adiantar produção, pré-entregar o epílogo e ampliar o que trava) termina na mesma faixa de 12 a 16 dias, com o epílogo em até 8 horas;
- ao menos 3 dos 5 dilemas mudam o tempo em 8% ou mais e nenhum passa de 20%; o do capítulo 5 é medido no epílogo, que não pode passar de 3 horas no contínuo.

O mesmo robô roda no GitHub Actions a cada envio. As consultas e eventos que a interface usa (tutorial, Meta em foco, progresso das metas, falas, avisos, disposição, topógrafo, depósito, serviços, pedidos e escolhas) estão descritos no começo de `fonte/sim/estado.js`, e a interface mostra todos eles (veja **Interface**).

### Salvamento

O jogo grava no navegador a cada 12 segundos e ao sair, esconder ou congelar a aba: primeiro no localStorage (na hora) e depois no IndexedDB; ao abrir, lê os dois e fica com o gravado por último. Importar um arquivo (ou apagar o progresso) trava a gravação até a página recarregar, para o jogo da memória não gravar por cima. Um save de versão antiga é **migrado** (com uma cópia de segurança antes) e nunca recomeça o jogo; um save danificado fica guardado à parte e o jogo avisa. Em Configurações dá para exportar e importar o save em arquivo.

## Interface

No estilo do SimCity BuildIt e pensada para a tela 20:9 em paisagem (986x443 no Poco X7): a cidade fica sempre à vista, tudo que se toca tem pelo menos 44 px e os textos usam a fonte arredondada Baloo 2 (embutida, funciona sem internet), em branco com contorno.

- **No alto à esquerda:** o selo de nível (o anel vermelho enche com a experiência) e as pílulas de moradores, bem-estar (carinha verde, amarela ou vermelha) e composição concluída. **No alto à direita:** créditos com o **+** laranja (Depósito de Trocas), **Mutirão** (fichas e a barra de disposição), Apreciar e a engrenagem azul das Configurações. Tocar no bem-estar mostra as três maiores fontes e a pressão de moradia; tocar no Mutirão explica que cada ficha reduz até 2 h de uma obra. Os números contam até o valor novo quando as moedas e estrelas chegam voando.
- **À direita**, os botões de Produção, Almoxarifado, Pedidos e Trocas, com selos vermelhos; **embaixo à direita**, o botão grande de **Obras** com capacete, como o de construir do BuildIt.
- **Capítulo:** a medalha embaixo à esquerda (número do capítulo e metas cumpridas) abre as metas com o progresso de cada uma (`3/8`, `etapa 2/5`) e o texto inteiro da ação Agora; tocar numa meta leva até o prédio, a obra ou o módulo. Meta cumprida pisca em verde.
- **Agora (Meta em foco):** uma linha com a próxima ação concreta para as metas do capítulo ("Produzir 2 Concreto na Central de Concreto"); tocar nela (ou no **Ir**) leva a câmera, abre o painel e destaca o controle certo.
- **Próximo** (embaixo, à direita): ícone e verbo da próxima coisa a fazer (Coletar, Aprovar, Produzir, Obra…); quando repete a ação da linha Agora, fica só o ícone. Só leva a câmera e abre o painel; pulsa quando há algo para coletar ou aprovar e some quando não há nada. Em repouso, o HUD cobre menos de 12% da tela.
- **Falas do conselho** aparecem num balão branco com o retrato de quem fala, no alto, também com painel aberto; o tempo de leitura depende do tamanho do texto, para enquanto há um modal e tem o botão **Pular**. Avisos curtos empilham logo abaixo (até três).
- **Painéis** são cartões claros com a faixa azul do título e o X vermelho, abertos numa folha à esquerda (até 412 px de largura e no máximo 36% da tela); os botões têm volume e afundam ao tocar (verde para a ação principal, azul para a secundária, laranja para adiantar). A câmera desloca a cidade para a área livre, de modo que o prédio operado fica à direita da folha. Painéis abertos de dentro de outro têm o botão **‹** para voltar.
- **Prancha da obra:** como a tela de melhoria do BuildIt, cada material aparece num círculo com entregue/necessário, check verde quando completo e **!** vermelho quando falta. Com tudo à mão, um toque só: **Entregar e iniciar**; a folha fecha e a câmera mostra o canteiro montando. Licença que falta pode ser encomendada ao **Topógrafo** ali mesmo, com cronômetro.
- **Pedidos:** grade de cartões com quem pede, onde mora, a fala inteira (até duas linhas) e a recompensa; seis cabem sem rolar em 986x443; o cartão inteiro entrega. Se faltar algo, os itens tremem e aparece o que falta com o atalho **Produzir**. A lixeira pede dois toques.
- **Balões** são círculos brancos com aro colorido pelo tipo (coletar, aprovar, obra), entram com mola, pulam cada um no seu ritmo e os de coletar e aprovar chamam atenção. Fora da tela, os importantes ficam presos à borda com uma seta (tocar leva até lá); balões muito próximos viram um grupo com `+n` (tocar aproxima). Módulo que precisa de água, energia, saneamento ou bem-estar mostra um balão cinza com o ícone do que falta.
- **Aprovar:** o balão sai, o carimbo APROVADO cai e bate no mesmo instante em que o andaime desmonta; depois vêm o aviso da medição, as estrelas de experiência e, na última etapa de um projeto, uma volta de câmera com barras de cinema. Um modal só abre depois da festa, sem painel aberto e um de cada vez.
- **Conselho:** a apresentação do fim de capítulo não some com um toque fora; **Decidir depois** deixa a pílula **Conselho aguarda** no alto. O modal diz quanto a Holding paga pela apresentação (medido na própria regra) e cada escolha mostra ganho, custo e quem prefere; ao escolher, as moedas voam até o contador.
- **Configurações** em quatro colunas, sem rolar, com o **Ciclo de dia e noite**: Acelerado (padrão, um dia a cada 24 minutos), Hora do celular ou Sempre dia; **Recomeçar** pede dois toques. **Importar** usa o arquivo exportado e recarrega o jogo (avisos de migração aparecem num aviso).
- `ferramentas/vitrine-ui.mjs` captura a interface no celular (986x443 e 915x412) sem WebGL, cena por cena, e mede alvos de toque, tamanho de texto, área do HUD e da folha.

## Controles

- **Um dedo:** arrasta o mapa (com inércia). **Pinça:** aproxima. **Torcer dois dedos:** gira. **Dois dedos para cima/baixo:** inclina.
- **Toque** numa construção, num lote ou num balão. **Toque duplo:** aproxima naquele ponto. Arrastar o dedo por vários balões de coleta recolhe todos.
- **Próximo** e **Ir** levam até a próxima ação. Tocar na cidade fecha a folha e o cartão das metas.
- **Apreciar** (ícone de câmera no alto): esconde a interface e a câmera passeia devagar; a barra de baixo some sozinha depois de 3,5 s e volta com um toque. Tem **Vista geral** (a cidade inteira, como no BuildIt), **Comparar com a referência** (a foto por cima, com transparência ajustável, no enquadramento dela), **Rótulos** (etiquetas com o nome de cada estrutura da foto) e **Planta**, a **hora do dia** (Automático, Manhã, Meio-dia, Pôr do sol e Noite), **Fotografar** (salva ou compartilha um JPEG do quadro) e **Sair**. Com som ligado, pássaros e água ao fundo.
- No computador: arrastar move, roda do mouse aproxima, botão direito gira e inclina.

## Gráficos

No visual do SimCity BuildIt, feito para o Mali-G615 MC2 do Poco X7. A composição inteira cabe em cerca de 170 chamadas de desenho e 490 mil triângulos, contando a sombra e os arredores.

- **Estruturas fiéis à foto:** cada prédio segue a linguagem construtiva da maquete da foto, com as cores vivas do BuildIt. Os edifícios-fita (Anel, Campus Universitário, Sede, Santuário, Anel da Biblioteca) são terraços em que cada laje é um beiral grosso de concreto claro com floreira contínua e vegetação pendendo pela fachada, vidro recuado na sombra e ripas escuras, pontas arredondadas que afinam e, no Anel, duas aberturas por onde entram os acessos (a floresta vertical de Stefano Boeri e as fitas de BIG e Zaha Hadid). A Faculdade de Ciências é uma rede única de bandas brancas boleadas com quatro células abertas, laboratórios brancos dentro e rampas até o chão (MAD Architects). A Biblioteca é uma torre de lajes brancas onduladas com floreiras, estantes de madeira, treliça diagonal de madeira clara, pilares-árvore em V e um dossel de grelha de madeira com painéis translúcidos; o Centro de Recursos Digitais é um casco de arcos de madeira sobre um bloco branco (Shigeru Ban, Kengo Kuma). A Sede é uma fita clara em terraços verdes com um módulo mais alto e a cobertura guarda-chuva junto à piscina. No leste, cúpula geodésica quase esférica com passarela em espiral por dentro do aquário, casas brancas empilhadas e deslocadas (Habitat 67), anfiteatro escavado sem cobertura, cerca de vidro alta dos gorilas e a bacia do acelerador em três degraus com o anel branco legível.
- **Dia de BuildIt:** sol quente vindo da esquerda da tela, sombras nítidas caindo para a direita e azuladas pelo céu (nunca pretas), verde vivo, água turquesa, prédios brancos limpos e vidro azul refletindo o céu. Gradação em espaço linear com tonemapping Khronos PBR Neutral, sem desfoque nem vinheta pesada: imagem nítida o tempo todo.
- **Ciclo de dia e noite:** amanhecer rosa e laranja, hora dourada com sombras longas, dia claro, pôr do sol dourado e lilás, crepúsculo violeta e noite azul-profunda, com a lua, janelas que acendem prédio a prédio, postes, fitas de luz nas passarelas, reflexos quentes nos lagos e estrelas. Tudo interpolado sem degraus; a sombra acompanha o sol e só é refeita quando ele anda meio grau.
- **Luz com vida:** sombras de nuvens passando pelo terreno, brilhos do sol cintilando na água, luz de recorte nos contornos, rebote verde da grama, bloom leve de dia e forte à noite, névoa azul-clara ao longe.
- **Arredores:** a obra fica num terreno que continua até o horizonte, com campos, bosques, morros e serras na névoa, praia com coqueiros e mar com ondas e espuma na areia, veleiros e nuvens.
- **Oclusão de ambiente por campo de alturas:** a cidade vista de cima vira um mapa de alturas desfocado, que escurece a base das paredes, os degraus dos terraços, o chão sob as passarelas e a orla da mata. É recalculado só quando a obra muda.
- **Mata em cachos** com vento e três níveis de detalhe por célula; **190 pessoas** nas passarelas, praças e terraços, com figura simples de longe; elefantes, girafas, rinocerontes e gorilas de dorso prateado que andam de verdade; um bando de aves.
- **Obra com sentido físico**: o canteiro monta em 1,6 s (estacas, poeira, mastro telescópico da grua); a grua trabalha num ciclo de içamento de 14 s com pêndulo e nunca cruza prédios prontos; o caminhão entrega e as pilhas no chão de obra correspondem aos materiais entregues; os operários ficam em postos (andaime, laje, pátio) com um mestre de colete; o andaime sobe um lance acima da obra, com diagonais e tela de proteção; o prédio sobe andar por andar, com tampa de seção e concreto fresco. Modos próprios para **draga** (desassoreamento), **caminho** (passarelas avançam trecho a trecho), **plantio**, **caixas** (os bichos saem dos engradados), **terraplenagem**, **pavimentação**, **desmonte do canteiro** e **replantio**. Ao voltar depois de um tempo fora, a obra avança num time-lapse de 1,5 s.
- **Aprovação coreografada**: o andaime desmonta de cima, a grua estaciona, poeira, confete (fogos à noite) e o carimbo APROVADO no mesmo instante; o prédio nunca é achatado.
- Tudo o que fica pronto é **fundido em poucas malhas por material**, em quadrantes que o descarte por caixa esconde fora da tela; a refusão depois de uma aprovação é adiada para não travar.
- Perfis **Ultra, Alta, Média e Leve**, escolhidos pelo processador gráfico (o Poco X7 usa Alta); limite de 30, 60 ou 120 qps; 30 qps com a tela parada.

## Estrutura do código

```
app/                         o jogo montado (PWA publicada no GitHub Pages)
arcologia-de-held.html       o mesmo jogo num arquivo único (abre direto, sem servidor)
arte/originais/              imagens de referência (a foto da composição total)
arte/telas/                  capturas de tela
fonte/
  main.js                    carregamento, motor, mundo, save, primeiro toque
  jogo.js                    liga simulação, mundo 3D e interface
  core/                      utilidades, som procedural, vibração, salvamento (IndexedDB)
  data/                      planta traçada da foto, itens, obras e etapas, história, rótulos
  sim/estado.js              simulação: produção, filas, prancha, módulos, serviços, capítulos
  render/                    motor (pós-processamento), oclusão por campo de alturas (hao.js), câmera,
                             ciclo de dia e noite (ciclo.js), céu, arredores (arredores.js), terreno,
                             floresta, obra animada (obra.js), figuras, animais,
                             descarte de memória (descartar.js) e o mundo
  render/models/             cada estrutura da foto, por etapas
  ui/                        HUD, painéis (folha lateral), balões, ícones desenhados em código,
                             configurações e modo Apreciar
  web/                       HTML, manifesto, service worker, ícones, a fonte Baloo 2 (OFL) e a foto em WebP
ferramentas/
  montar.mjs                 empacota fonte/ com esbuild em app/ e no arquivo único
  simular.mjs                robô que joga do início ao fim (sessões, escolhas, faixas do equilíbrio)
  robo-partida.js            robô que joga a partida inteira no navegador (pela interface)
  testar.mjs                 capturas de tela no Chromium (WebGL por software)
  vitrine.mjs                conjunto padrão de capturas (composição, closes, obra, celular) para comparar versões
  cap-obra.mjs               capturas de aceite de cada modo de obra, montagem e aprovação
  conexoes.mjs               confere na planta se fitas, passarelas e vias se cruzam
  vitrine-ui.mjs             capturas e medidas da interface no celular, sem WebGL
```

```bash
npm install
npm run montar            # gera app/ e arcologia-de-held.html
node ferramentas/simular.mjs 30 1   # robô: verifica cada 30 min, ritmo 1×
SESSOES=1 ESCOLHA=alt MUTIRAO=1 node ferramentas/simular.mjs 1 1   # 4 sessões de 15 min por dia
npm run simular:todos     # testes de regra + matriz de 8 combinações (faixas de equilíbrio)
npm run testar -- /tmp/tela.png "vista=foto&tudo=1"
```

Three.js (licença MIT) vai embutido no pacote; o aviso de licença fica no fim do `app/jogo.<versão>.js`.
