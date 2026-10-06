# Modo Presença: o dono dentro da própria obra (D100)

Pedido do dono em 06/10/2026: ver o interior da sede (anéis, torres e subterrâneo), pilotar um helicóptero de luxo
(sobrevoar as obras antes de prontas e ir da Blade Tower ou da Legacy Tower até a torre de restaurantes de 300 m, a
Lucullus Tower), dirigir o carro de F1 numa volta de teste, assistir de dentro a uma partida de basquete e de futebol
americano e a um filme no Cosmos Cinema, e visitar as próprias mansões, carros, iates, helicópteros, jatinhos, fazendas
e holdings intermediárias, andando, vendo o milharal e colhendo a espiga. Tudo isso é a mesma ideia: sair da câmera de
planejamento e **entrar** na obra, a pé, de carro ou de helicóptero. Por isso é **uma estrutura só** (o Modo Presença) e
cada pedido é um conteúdo dela. Entra por etapa, conforme o projeto chega nelas (tabela da seção 4).

## 1. A estrutura única

- **Cena própria, carregada na hora**, como o Modo Visita da D73: não faz parte do mapa, não pesa no orçamento da vista
  aberta (D66, D70) e sai da memória ao voltar. A simulação segue rodando por trás (lotação, hora, clima).
- **Três maneiras de estar:** a pé (terceira pessoa com câmera de ombro, ou primeira pessoa), em veículo (carro, F1,
  helicóptero, iate) e de assento (arquibancada, poltrona de cinema), com câmera fixa e olhar livre.
- **Interação por indicação:** perto de algo útil aparece uma dica ("Colher", "Entrar", "Sentar"), um botão no toque e
  uma tecla no teclado. Uma regra só para tudo.
- **Controle:** teclado e mouse no PC, **dois manches virtuais** no Poco X7 (esquerdo anda ou acelera, direito olha),
  gamepad quando houver. O toque segue a D99 (gestos medidos em dispositivo, sem o salto de cena).
- **O que a simulação vê:** quase nada. O dono é uma figura sem efeito na economia, exceto onde a ficha disser (a colheita
  conta como visita e rende Legado, nunca crédito de verdade). Assim nenhuma regra do dono (D48, lotes, 150%, empréstimo,
  renda por morador) muda por causa de um passeio.
- **Referências de método:** um jogo de gestão que já deixa andar em primeira pessoa pelo que o jogador construiu é o
  *Planet Coaster 2* (o primeiro só tinha a primeira pessoa dentro das atrações)
  ([heise](https://heise.de/-9799110), [PC Gamer](https://www.pcgamer.com/planet-coaster-review/)); o corte de paredes
  para ver dentro vem de *The Sims* e *Two Point Hospital*; o resto é técnica de jogo de ação em terceira pessoa
  (controlador de personagem com colisão simples, câmera com mola, dica de interação).
- **Orçamento:** cada modo é um módulo carregado sob demanda (import dinâmico), com teto próprio de chamadas e
  triângulos medido na bancada. O JS principal fica abaixo de 2,3 MB (D91).

## 2. Os conteúdos, um a um

| Pedido | O que é | Como fazer | Referência | Etapa |
|---|---|---|---|---|
| **Interior da sede** | Corte da Park of Future Dreams (anéis, Blade, Legacy, Codex, Helix, Compass, Lucullus) e visita por dentro, andando pelos andares e pelo **subterrâneo** (Deep Core, Lumen Collider) | duas camadas: (1) o **corte**, na câmera normal: um plano remove a fachada de um setor e mostra os andares com a ocupação da simulação (faculdade e escola no Horizon Ring, escritórios no Meridian Ring); (2) a **visita**, cena de interior com iluminação assada e a lotação da simulação | Apple Park e McLaren Technology Centre (os anéis), Burj Khalifa e Black Diamond (torres), plantas reais; o subsolo é projeto secreto do Caio Montenegro (D80): visita só do dono | corte e visita dos anéis e torres no **M2**; subsolo no **M3** |
| **Helicóptero de luxo** | Pilotar, saindo do heliponto da Blade Tower ou da Legacy Tower até o heliponto da Lucullus Tower; antes da obra pronta, **sobrevoar as construções** | modelo de voo **arcade com assistência** (inclina, sobe e desce, com auto-pairar), câmera de cabine e externa, rota com anéis de checagem e pouso no heliponto; no voo livre, sem destino | helicópteros de luxo reais: Airbus H160 (versão ACH160), Leonardo AW109 Trekker e Bell 429, os três vendidos como transporte VIP ([Vertical](https://verticalmag.com/?p=332445), [HeliOps](https://www.heliopsmag.com/articles/bespoke-italian-style-the-airbus-h160-in-service-with-air-corporate)) | **voo livre no M2**, junto com o Modo Presença; a rota até a Lucullus Tower quando ela ficar pronta |
| **Volta de F1** | Uma volta de teste no Heldópolis Circuit (6,2 km, uns 20 curvas, reta de 1,2 km, D81) | carro de corrida **arcade com assistência**; ou o controlador de veículo por raios do Rapier (carregado sob demanda se o tamanho couber), ou um modelo próprio de bicicleta com derrapagem (decide a parcela, medindo) ([Rapier](https://rapier.rs/javascript3d/classes/DynamicRayCastVehicleController.html)) | pista e carro reais da Fórmula Mundial (nome fictício, D81) | **M3**, quando o trecho permanente do circuito existir |
| **Partida e cinema por dentro** | Assistir de assento, na arquibancada, a uma partida da Associação Libertense de Basquete (a "NBA" do jogo, na Comet Arena) e da Liga Libertense de Futebol Americano (a "NFL", no Libertas Stadium), e a um filme no Cosmos Cinema | a **partida é simulada em eventos** (placar, posses, lances) a partir da força dos times e da semente; a cena anima os lances por **modelos de jogada** e mostra a torcida pela lotação; o cinema mostra o filme numa tela, de uma poltrona | o motor de partida do *Football Manager* simula a partida e a mostra em 3D só como atmosfera ([Giant Bomb](https://www.giantbomb.com/games/3030-23498/), [Gamesradar](https://www.gamesradar.com/football-manager-2009)) | basquete no **M3** (a Comet Arena é da fase 1); futebol americano e cinema nas fases deles |
| **Propriedades do dono** | Visitar mansões, carros, iates, helicópteros, jatinhos, fazendas e as holdings intermediárias, e **agir** (andar, entrar, colher) | um **hub de propriedades**: lista no menu do dono, cada item abre a cena dele; a fazenda é da Held Capital (a agroindústria, D78/historia.md), com o milharal em instâncias, vento no sombreador e a **colheita** como interação por indicação | *Farming Simulator* e *Stardew Valley* para a colheita; iates e jatos reais da marina e dos aeroportos (D73, D86) | mansão, carros e fazenda no **M3**; iates e jatinhos no **M4**; holdings intermediárias no **M5** |

## 3. O que cada conteúdo precisa para fechar (D78)

Cada construção do complexo e da sede tem o diálogo com o dono antes da ficha (D78). Para o Modo Presença, antes de cada
conteúdo entrar na parcela:
- **Interior:** o que se vê em cada andar e se a visita tem missão (por exemplo, o Caio Montenegro mostrando o Lumen
  Collider).
- **Helicóptero:** o modelo (uma das três referências), a cor e a cabine, e se a rota até a Lucullus Tower rende
  alguma coisa (hóspede VIP, reserva do restaurante).
- **F1:** se a volta de teste vale tempo recorde e se o carro tem a cara da equipe da Holding.
- **Partida e cinema:** quanto de jogo se assiste (um lance, um quarto, a partida inteira acelerada) e o que o filme
  mostra.
- **Propriedades:** o que cada uma tem para fazer e se o passeio rende só Legado ou também algum efeito leve.

## 4. Etapas

| Etapa | Entra |
|---|---|
| **M1 (onda 4)** | nada do Modo Presença; só o que prepara: o toque no Poco X7 (D99), mover e girar (D94) e a animação das obras (D102) |
| **M2** | a estrutura (cena sob demanda, personagem, dica de interação, manches), o **voo livre de helicóptero**, o **corte** e a **visita** dos anéis e das torres |
| **M3** | o subsolo, a rota até a Lucullus Tower, a **volta de F1**, a **partida de basquete**, a mansão, os carros e a **fazenda com a colheita** |
| **M4** | iates, jatinhos, o futebol americano e o cinema, conforme as obras deles |
| **M5** | as holdings intermediárias por dentro |

## 5. Riscos

- **Escopo:** é o item mais caro do projeto. Mitigação: uma estrutura só, conteúdos pequenos e um por parcela, cada um
  com o diálogo da D78 antes.
- **Orçamento gráfico:** interior de grande escala (1,6 km de anel, 25 andares) não cabe inteiro. Mitigação: a visita é
  por **setor** (uma ala por vez, com portas e corredores que escondem o resto) e a iluminação é assada.
- **Desempenho no Poco X7:** o modo é opcional e começa no PC (D66). No Poco X7 entra depois, com o perfil Média.
- **Nomes reais:** NBA, NFL e a Fórmula 1 são marcas. O jogo usa os nomes fictícios que já estão em `marcos.md`
  (Associação Libertense de Basquete, Liga Libertense de Futebol Americano, Fórmula Mundial).
