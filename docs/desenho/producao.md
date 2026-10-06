# Plano de produção por disciplinas (D96)

Pedido do dono em 04/10/2026: levar o jogo em alto nível em todas as disciplinas de um estúdio, em etapas, com as
ferramentas certas e com referências de topo, para não errar à toa nem inventar. Este anexo diz **o que cada disciplina
faz aqui, em que etapa, com o que, contra qual referência e quando está pronta**. O `docs/PROJETO.md` continua mandando;
as decisões entram lá (D-números) e as parcelas seguem as fichas.

Regras que valem para todas as disciplinas:

- **Referência real antes de produzir.** Arquitetura com megaprojeto real (CLAUDE.md), sistema com jogo de referência
  (Cities: Skylines II, Highrise City, SimCity), técnica com fonte publicada (livro, palestra da GDC, documentação).
  O que não tiver fonte é marcado "proposta" e o dono decide.
- **Medir, não estimar.** Desempenho na bancada e no PC do dono (D66); economia no robô; interface na vitrine; visual em
  capturas antes e depois na mesma câmera.
- **Dono no portão.** Toda construção do complexo e da sede é dialogada antes (D78); cada prévia termina com a medida e
  o olhar do dono.

## 1. Etapas da produção

O ciclo da indústria é pré-produção, fatia vertical, produção, alfa, beta, lançamento e pós-lançamento: a pré-produção
fecha com o documento de desenho, um protótipo e o plano; a fatia vertical é um trecho do jogo na qualidade final que
prova estilo, sensação, técnica e desempenho; a alfa tem tudo dentro, com defeitos; a beta endurece o jogo com testes
de função, regressão, compatibilidade e desempenho ([Unity Learn](https://learn.unity.com/course/game-development-in-a-nutshell/tutorial/production-and-post-release),
[Rami Ismail, marcos](https://ltpf.ramiismail.com/milestones/), [CG Spectrum](https://cgspectrum.com/blog/game-development-process)).
No nosso calendário:

| Etapa | O que fecha | Marcos do PROJETO | Portão (quem aprova) |
|---|---|---|---|
| E0 Pré-produção | PROJETO, desenhos, pesquisa, contratos, protótipos | ondas 0 a 2 (feito) | dono aprovou planos e sede |
| **E1 Fatia vertical** | a primeira hora de jogo na qualidade final: sede v4, rua, árvores, água, som básico, 30 qps no PC do dono | Prévia 2 a 2c, VIS1, PC3, SEDE4 | medida e olhar do dono |
| E2 Produção do M1 | cidade completa, trânsito, Ato 1 inteiro, ponte, abertura, foto, som, mover e girar | onda 4 e C2 (M1 publicado) | testes, robô, bancada e dono |
| E3 Produção da Parte 2 | complexo fase 1, M2 e M3, Conselho com voz, decisões grandes | M2, M3 | idem, por prévia |
| E4 Alfa | Parte 2 jogável do começo ao fim (2020 a jun 2026), com defeitos | fim do M3 | robô termina a Parte 2 |
| E5 Beta | conteúdo fechado, polimento, QA pesado, desempenho travado | antes do lançamento | 0 defeito grave, piso de 30 qps |
| E6 Lançamento | a Parte 2 publicada para o PC (PWA instalável) | publicação | dono |
| E7 Depois | Partes 1 e 3, PC novo (Ultra), Poco X7 | M4 em diante | por parte |

## 2. Disciplinas

Cada linha diz: o que é aqui; o que usar (ferramentas do projeto e de fora); a referência de topo; quando está pronto;
quem faz (os agentes do projeto, em `.claude/agents/`).

### 2.1 Game design

| Disciplina | O que é aqui | O que usar | Referência | Pronto quando | Quem |
|---|---|---|---|---|---|
| **Game Design Core** | o laço: planejar a cidade, produzir os materiais em lotes de 1 a 10, erguer a Arcologia, crescer Influência e Legado; regras do dono (REGRAS_DONO) | PROJETO.md, `docs/desenho/*.md`, robô (`ferramentas/robo/`), testes A2 e A4 | Jesse Schell, *The Art of Game Design: A Book of Lenses*; Brian Upton e Brenda Romero (cursos); [diários de desenvolvimento do CS2](https://colossalorder.fi/?p=1809) (economia "complexa, mas não complicada") | o robô cumpre as metas A4 e o dono joga a primeira hora sem travar | diretor-de-jogo |
| **Level Design** | o mapa de 8,2 km, a área inicial de 6 x 5, as sugestões e a primeira hora, o encaixe da sede e do complexo | `mapa.mjs`, cenas, sugestões do mapa, guia da primeira hora | Christopher Totten, *An Architectural Approach to Level Design*; [GDC, "We Built This City on Bits 'n Maps"](https://gdcvault.com/play/1034347/We-Built-This-City-on) | a primeira hora não tem beco sem saída (robô e dono), toda vista bonita leva a uma ação | diretor-de-jogo, artista-3d |
| **Systems Design** (não há combate) | economia, trânsito, serviços, crises reais com nomes fictícios, rivais (VISAO) | robô, `--bancada` do tique, camadas para ler o sistema | Tynan Sylvester, *Designing Games*; Brian Sellers, *Advanced Game Design: A Systems Approach*; [Andrew Willmott, "Inside GlassBox"](https://www.andrewwillmott.com/talks/inside-glassbox) (motor de simulação do SimCity 2013) | cada sistema tem causa visível no mapa e meta no robô | engenheiro-simulacao |

### 2.2 Narrativa e roteiro

| Disciplina | O que é aqui | O que usar | Referência | Pronto quando | Quem |
|---|---|---|---|---|---|
| **Narrative Design** | a história em três partes (historia.md), o Conselho, decisões com consequência mecânica, o Mural, o calendário real (D67) | `data/historia.js`, decisões e objetivos, momentos da U1b | [Marta Fijak, "Ghost in the Machine: Authorial Voice in System Design" (Frostpunk)](https://gdcvault.com/play/1027186/Independent-Games-Summit-Ghost-in); [11 bit, "Why Make Games?"](https://gdcvault.com/play/1025741/Why-Make-Games-Lessons-from) | toda decisão muda um número do jogo e aparece no mapa ou no Mural | roteirista, diretor-de-jogo |
| **Roteiro e Lore** | falas dos conselheiros, textos da interface, nomes fictícios, os 20 executivos, os eventos de 2008 a 2040 | `ui/textos/*.js`, guarda de texto, `historia.md` | Heussner, Finley, Hepler e Lemay, *The Game Narrative Toolbox* | português do Brasil, sem travessão, nenhum nome real (lista da seção 7 da história) | roteirista |

### 2.3 Arte visual

| Disciplina | O que é aqui | O que usar | Referência | Pronto quando | Quem |
|---|---|---|---|---|---|
| **Concept Art** | pranchas de referência real e os modelos do dono antes de modelar (D78) | pranchas (Python e OpenStreetMap), fotos de referência, os artifacts do dono | [GDC, "Building SimCity: Art in the Service of Simulation"](https://gdcvault.com/play/1017823/Building-SimCity-Art-in-the) (a arte mostra o que a simulação faz) | o dono aprova a prancha antes da parcela | artista-3d |
| **Arte 3D** | geradores procedurais em three.js (prédios, colocáveis, sede, árvores, vias), LOD e impostores | `render/geracao/*`, oficina, bancada, cenas | Akenine-Möller e outros, *Real-Time Rendering*; [manual do three.js](https://threejs.org/manual/); referência de arquitetura real por peça | capturas A/B contra a referência; tetos de triângulos e chamadas por perfil | artista-3d |
| **Animação** | caminhada no vértice, gruas, obra, tráfego, câmera, helicóptero, animais (depois) | sombreadores de vértice, `camera.js` | Richard Williams, *The Animator's Survival Kit* (princípios: peso, tempo, antecipação) | nada desliza nem atravessa; 0 compilação depois de pronto | artista-3d, engenheiro-grafico |
| **VFX** | água, cachoeiras, fontes, névoa, LED, luz noturna, fogos da inauguração, chuva | sombreadores (`agua`, `arcologia:cascata`, `jato`), pós | [comunidade Real-Time VFX](https://realtimevfx.com/t/how-we-made-waterfall-in-season-a-letter-to-the-future/23420); [cachoeira do League of Legends](https://80.lv/articles/waterfall-from-league-of-legends-breakdown/?amp=1) (textura de fluxo, espuma e borda) | lê bem de longe e de perto e custa o que a bancada permite na RX 550 | engenheiro-grafico |

### 2.4 Programação e engenharia

| Disciplina | O que é aqui | O que usar | Referência | Pronto quando | Quem |
|---|---|---|---|---|---|
| **Gameplay Programming** | comandos, consultas, registros, determinismo, save | `fonte/sim`, contratos, testes, `--determinismo` | Robert Nystrom, [*Game Programming Patterns*](https://gameprogrammingpatterns.com/) (gratuito); Jason Gregory, *Game Engine Architecture* | testes verdes, hash igual antes e depois do save | engenheiro-simulacao |
| **IA** | os agentes do jogo (carros, gente, caminhões, empresas, rivais) e o robô que joga para testar; o Super Cérebro é personagem, não código | `trafego.js`, `pedestres.js`, robô | Ian Millington, *AI for Games*; [*Game AI Pro*](http://www.gameaipro.com/) (gratuito); Willmott, "Inside GlassBox" (agentes) | ninguém trava nem atravessa; o robô termina os marcos | engenheiro-simulacao, engenheiro-grafico |
| **Engine e Graphics** | three.js r186 em WebGL2, LOD, instâncias, sombras, céu, pós, resolução dinâmica | bancada, Teste de desempenho, Spector.js | *Real-Time Rendering*; [manual do three.js](https://threejs.org/manual/); [fórum do three.js](https://discourse.threejs.org/t/how-to-optimize-objects-in-three-js-methods-of-optimization/2242/2) | piso de 30 qps e meta de 60 no PC do dono (D66), medidos nele | engenheiro-grafico |
| **Networking e Backend** | **não há multijogador**: o jogo é para um jogador, PWA que roda sem servidor; o GitHub Pages publica | GitHub Pages, IndexedDB (save local), exportar e importar | proposta: só se o dono pedir salvar na nuvem ou ranking, um serviço pequeno à parte, depois do lançamento | sem servidor até a Parte 2 sair; nada de dado pessoal fora do PC | integrador |

### 2.5 Áudio

| Disciplina | O que é aqui | O que usar | Referência | Pronto quando | Quem |
|---|---|---|---|---|---|
| **Trilha sonora** | música adaptativa em camadas que sobem e descem com o estado da cidade (bem-estar, obra, noite, crise, inauguração) | Web Audio (`fonte/som`), camadas em laço; a origem da música é do dono: biblioteca licenciada, compositor contratado ou ferramenta de música com licença comercial | [camadas verticais, GDC 2021 (Sackboy)](https://www.gamedeveloper.com/game-platforms/pure-vertical-layering-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-); [música adaptativa em jogos](https://alibimusic.com/blog/adaptive-music-video-games) | troca de camada sem corte, volume equilibrado, nenhuma faixa sem licença | engenheiro-interface (U2b) |
| **SFX** | ambiente da cidade pela distância da câmera, obra, trânsito, água, interface | Web Audio procedural mais amostras com licença (Creative Commons 0 ou compradas) | idem, e o ambiente por zoom do Cities: Skylines | nada estoura, o som segue a câmera, a interface responde a cada toque | engenheiro-interface |
| **Dublagem** | as falas curtas do Conselho e da abertura | três caminhos (o dono escolhe): sem voz no M1 (texto); voz sintética neural em português do Brasil com licença comercial ([Azure](https://azure.microsoft.com/en-gb/updates/azure-cognitive-services-adds-brazilian-portuguese-to-neural-text-to-speech/), [ElevenLabs](https://elevenlabs.io/docs/capabilities/text-to-dialogue)); ou dubladores contratados para a abertura e o trailer | o contrato de uso de cada serviço antes de gravar | licença conferida; voz com o mesmo tom em todas as falas | roteirista e o dono |

### 2.6 Produção e qualidade

| Disciplina | O que é aqui | O que usar | Referência | Pronto quando | Quem |
|---|---|---|---|---|---|
| **Produção** | ondas e parcelas com implementador e revisor, decisões numeradas, RETOMADA, pausa ordenada, prévias com portão do dono | `.claude/orquestracao/`, PROJETO.md, GitHub | Clinton Keith, *Agile Game Development with Scrum*; Heather Chandler, *The Game Production Handbook*; [marcos de Rami Ismail](https://ltpf.ramiismail.com/milestones/) | cada etapa tem entrega, dono da aprovação e critério de entrada da próxima | integrador |
| **QA** | 33 suítes de teste, determinismo, robô (A2, A4, A8), bancada com tetos, vitrine da interface, capturas A/B, CI no GitHub | `simular.mjs --testes`, `bancada.mjs`, `vitrine-ui.mjs`, `testar.mjs`, CI "Robô de equilíbrio" | [testes automáticos do Sea of Thieves e robôs clientes do The Division (GDC)](https://gdconf.com/news/see-how-ubisoft-tested-division-automated-players-gdc-2019); [orçamento de 33,3 ms a 30 qps](https://www.ixiegaming.com/blog/automated-game-testing-that-delivers-bots-toolchains-and-ci-cd/) | CI verde, 0 teste instável, 0 compilação depois de pronto, piso de 30 qps no PC do dono | testador |

## 3. Próximas etapas, em ordem

1. **VIS1** (rodando): sede com acabamento e faixa de LED de um terço dos andares (D93); rua com as árvores da R2b,
   carros, caminhões e gente melhores. Prévia 2c e medida do dono.
2. **SEDE4** (sede v4, D97, respostas do dono em 04/10/2026): Canopy Bridges, Mirror Lake grande, Dream Falls de
   120 m, Halo Lake, mata densa e Hanging Gardens (`docs/pesquisa/sede/sede-v4.md`), com pranchas de referência antes
   de modelar.
3. **Onda 4** (fecha o M1), com os acréscimos pedidos pelo dono:
   - **UX1**, colocar com giro livre, motivo do vermelho e obras em paralelo (D98), e **TOQ1**, o toque no Poco X7 e o
     app estável (D99), as duas primeiras, porque são o que o dono sente no uso;
   - **MOV1**, mover e girar construções prontas (D94), sobre a ferramenta da UX1;
   - **OBR2**, a animação das obras (D102);
   - o padrão residencial alto (D95) entra na **R4c** (gerador de prédios e catálogo) e na **S2b** (cidade completa).
   - E mais: S1c (trânsito), S3b (Ato 1 inteiro), X4 (ponte), X3b (camadas), U2b (abertura, modo foto e o som
     adaptativo da seção 2.5), e a **C2** publica o M1.
4. **Áudio**: a trilha e os efeitos da U2b seguem a seção 2.5; a origem da música e a voz são decisões do dono.
5. Depois do M1, a etapa E3 (Parte 2: complexo fase 1, M2 e M3), sempre com prévia e portão do dono.

## 4. O que o dono decide

- A origem da música (biblioteca licenciada, compositor ou ferramenta com licença) e da voz (sem voz, voz sintética ou
  dubladores).
- Salvar na nuvem ou ranking depois do lançamento (hoje, nada de servidor).
- Respondido em 04/10/2026: a sede v4 (D97) e a regra de mover e girar (D94). O padrão residencial segue a D95 (moradia
  social no mesmo padrão, Vila requalificada no Ato 1) até o dono pedir outra coisa.

## 5. Pedidos do dono de 06/10/2026, por etapa

Regra do dono: as melhorias entram **conforme o projeto chega nas etapas** a que pertencem. Esta tabela diz qual é a
etapa e a parcela de cada uma; nenhuma estraga uma regra de economia dele (D48, lotes, 150%, empréstimo, renda).

| Pedido | Decisão | Etapa | Parcela |
|---|---|---|---|
| Mover uma construção já pronta | D94 | M1, onda 4 (etapa 2) | MOV1 |
| Colocar sem exigir o ângulo exato de 90 graus (fica vermelho) | D98 | M1, onda 4 (etapa 1) | UX1 |
| Escolher qual construção iniciar e fazer várias em paralelo | D98 | M1, onda 4 (etapa 1) | UX1 |
| Jogabilidade no Poco X7 (desliza mal, a cena salta) e app estável | D99 | M1, onda 4 (etapa 1) | TOQ1 |
| Mais animação nas construções | D102 | M1, onda 4 | OBR2 |
| Jogo, mecânica e gráficos mais fluidos | D102 | contínuo; polimento na E5 | PC3 e depois, FLU1 na E5 |
| Moradia de classe média alta no mínimo | D95 | M1, onda 4 | R4c e S2b |
| Ver o interior da sede (anéis, torres) | D100 | M2 | Modo Presença |
| Ver o subterrâneo (Deep Core e Lumen Collider) | D100 | M3 | Modo Presença |
| Pilotar o helicóptero de luxo: voo livre antes da obra pronta | D100 | M2 | Modo Presença |
| Helicóptero da Blade ou da Legacy até a Lucullus Tower | D100 | M3 | Modo Presença |
| Volta de teste de F1 | D100 | M3 | Modo Presença |
| Partida de basquete por dentro | D100 | M3 | Modo Presença |
| Partida de futebol americano e cinema por dentro | D100 | M4 | Modo Presença |
| Visitar mansão, carros e fazenda (colher o milho) | D100 | M3 | Modo Presença |
| Visitar iates e jatinhos | D100 | M4 | Modo Presença |
| Visitar as holdings intermediárias | D100 | M5 | Modo Presença |
| Dirigir a Holding guarda-chuva e o que ela controla | D101 | M3 | Governo do grupo |
| Negociar no mundo corporativo | D101 | M3 | Governo do grupo |
| O banco do grupo emprestar à guarda-chuva | D101 | M3 | Governo do grupo |
| Negociar no mundo geopolítico, influenciando o mundo | D101 | M5 (um país) e M6 (global) | Governo do grupo |

Detalhes e referências: `docs/desenho/presenca.md` (Modo Presença) e `docs/desenho/grupo.md` (governo do grupo).
