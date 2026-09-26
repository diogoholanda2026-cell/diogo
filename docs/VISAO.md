# Visão e roteiro: da Arcologia a um império em 12 metrópoles

Documento de direção do jogo. Diz o que o jogo quer ser, o que pegamos de Cities: Skylines II e de Highrise City,
onde ele deve rodar, como crescer até o tamanho pedido e quem (entre agentes e ferramentas) faz cada parte.
Atualizado em 26/09/2026, depois da fase 1 (desmate, porto, jatinhos, esportivos e limites maiores).

## 1. Onde estamos

- **Arcologia de Held:** a obra central, em 6 capítulos, com a mecânica do SimCity BuildIt: usinas, oficinas, pranchas,
  pavimentos, pedidos e obras animadas.
- **Cidade em volta, em mundo aberto:**
  - 20 bairros e 1.651 lotes que começam cobertos de mata. Tocar nas árvores desmata o lote e abre a rua.
  - Moradias que sobem de nível e serviços com área de atendimento (polícia, saúde, escola, faculdade), mais a
    Prefeitura.
  - Comércio, lazer e empresas da Holding em terrenos que valorizam.
  - Aeroporto com aviões e jatinhos, porto com iates, cargueiro e cruzeiro, helicópteros entre helipontos e carros
    esportivos.
- **Economia fixada pelo dono:** lotes de 1 a 10, vendas no Depósito, empréstimo e renda de 5, 8 ou 11 créditos por
  morador. Por cima dela vêm valuation, lucro das empresas e renda do comércio.
- **Plataforma:**
  - Hoje: navegador (three.js r186), instalável como app (PWA) no celular e no PC, com qualidades Leve, Média, Alta e
    Ultra.
  - Testes: robô que joga a partida inteira, testes de regra, vitrine da interface e capturas.

## 2. Referências principais

Cities: Skylines II (CS2) é a referência de **cidade**: terreno, estradas, zonas, serviços, transporte e simulação.
Highrise City (HC) é a referência de **economia de produção**: cadeias de produtos, logística, recursos entregues nas
obras e arranha-céus. O SimCity BuildIt continua valendo só para o ritmo de sessões curtas no celular.

| Sistema | Cities: Skylines II | Highrise City | Aqui: hoje → próximo passo |
|---|---|---|---|
| Expansão do mapa | compra de áreas do mapa | mapa grande, livre | bairros comprados e desmate lote a lote → mapa em blocos que carregam sob demanda (fase 4) |
| Estradas | ferramentas de reta, curva, rotatória, ponte, hierarquia de vias | estradas livres | a rua nasce com o desmate → ferramenta de estradas livres (fase 3) |
| Crescimento | zonas residencial, comercial, industrial e de escritórios crescem pela demanda | prédios sobem com recursos e serviços | tipos colocados à mão e níveis com materiais → zonas com demanda, mantendo os prédios da Holding à mão (fase 3) |
| Produção | empresas, recursos e comércio exterior | dezenas de produtos em cadeias longas, depósitos e caminhões | usinas e oficinas, fábrica e centro logístico da Holding → cadeias com insumos, estoque e preço de mercado (fase 2) |
| Serviços | saúde, educação, polícia, bombeiros, lixo, cemitério, correio, telecom e parques | serviços por área | polícia, saúde, escola, faculdade e Prefeitura → bombeiros, lixo, telecom e correio (fase 2) |
| Água e energia | redes de cabos e canos | redes | capacidade da cidade inteira → redes opcionais no modo PC (fase 4) |
| Transporte | ônibus, bonde, metrô, trem, táxi, navio, avião e carga | caminhões e trens de carga | carros, VLT, aeroporto e porto → linhas desenhadas e trânsito com rotas (fase 3) |
| Cidadãos | ciclo de vida, trabalho, estudo e turismo | necessidades por produto | população agregada com pedestres e carros de amostra → agentes estatísticos (fase 4) |
| Política | políticas por distrito, impostos e orçamento | não | Prefeitura → câmara, leis, eleições e influência (fase 5) |
| Progresso | marcos com pontos para desbloquear | desbloqueio por produção | capítulos e níveis → marcos da Holding e da cidade (fase 2) |
| Clima | estações, chuva, neve | dia e noite | dia e noite e a luz da foto → estações e chuva (fase 4) |

## 3. Navegador ou nativo?

**Recomendação: manter o motor web (JavaScript + three.js), mas evoluir o motor e empacotar como app de PC e de
Android.** Motivos:

1. **Um código só para PC e Poco X7.** O mesmo jogo roda nos dois, e só a qualidade muda.
2. **Tudo pode ser construído e testado aqui.** Montar, jogar a partida inteira com o robô, medir e capturar funciona
   num contêiner Linux sem tela. Unity e Unreal exigem editor gráfico e licença, então eu não conseguiria compilar nem
   testar esses jogos daqui.
3. **O jogo já tem mais de 13 mil linhas** de simulação, interface, modelos e testes. Trocar de motor jogaria meses
   fora antes de ganhar qualquer coisa nova.
4. **O navegador já usa a placa de vídeo.** WebGL (e WebGPU, no próximo passo) desenha na GPU. O Chrome do Android
   tem WebGPU nos aparelhos com GPU ARM Mali, como o Mali-G615 do Poco X7.

| Opção | PC com placa de vídeo | Poco X7 | Desenvolver aqui | Reaproveita o jogo | Teto de desempenho |
|---|---|---|---|---|---|
| **Web + app de PC (Electron) + app Android (PWA/TWA)** | bom, e ótimo com WebGPU | bom nas qualidades Leve e Média | sim, com testes automáticos | 100% | médio; sobe com WebGPU e workers |
| Godot 4 | muito bom | bom | parcial (exporta sem tela) | reescrever tudo | alto |
| Unity (como CS2) | excelente | médio | não (precisa do editor) | reescrever tudo | muito alto |
| Unreal 5 | excelente | fraco para esse aparelho | não | reescrever tudo | altíssimo no PC |

**Como jogar em cada aparelho:**

- **PC, já hoje:**
  - Abra o site no Chrome ou no Edge e instale como app (ícone de instalar na barra de endereço).
  - Em Configurações do Windows > Tela > Gráficos, marque o Chrome como **Alto desempenho**. Assim ele usa a placa
    dedicada.
  - Escolha a qualidade Ultra.
- **PC, fase 5:** um aplicativo próprio (Electron). Ele tem janela sem navegador, força a placa dedicada e grava os
  saves em arquivo. Um workflow do GitHub gera o `.exe` para baixar.
- **Poco X7, já hoje:**
  - Abra no Chrome e toque em "Adicionar à tela inicial".
  - Use a qualidade Média, ou Leve se esquentar.
  - Os 8 GB de RAM bastam. Os 4 GB "virtuais" não ajudam a GPU.
- **Poco X7, fase 5:** APK (Trusted Web Activity) com a qualidade Média como padrão e tela cheia.

**Quando reavaliar:** se a simulação com dezenas de milhares de agentes (fase 4) passar do limite do JavaScript,
o núcleo da simulação vai para Rust compilado em WebAssembly, dentro do mesmo jogo. Trocar de motor só entra na conta
depois disso. O plano B seria o Godot 4.

**Orçamento por aparelho (meta):**

| | Chamadas de desenho | Triângulos | Pedestres na cidade | Carros | Quadros por segundo |
|---|---|---|---|---|---|
| PC Ultra | até 1.500 | até 5 milhões | 1.600 | 400 | 60 |
| PC Alta | até 800 | até 2,5 milhões | 900 | 240 | 60 |
| Poco X7 Média | até 300 | até 900 mil | 420 | 120 | 30 a 45 |
| Poco X7 Leve | até 200 | até 500 mil | 150 | 50 | 30 |

## 4. "Limites até 100 vezes"

**O que já entrou:**

- Teto de 27.000 prédios por tipo (100 vezes o anterior).
- 20 bairros e 1.651 lotes, mais o porto e o aeroporto.
- Até 1.600 pedestres e 400 carros na cidade no Ultra (4 vezes).
- 80 esportivos, aviões e jatinhos, helicópteros, iates, cargueiro e cruzeiro.
- Zoom até 230 unidades.

**Por que o desenho não vai a 100 vezes agora:** 100 vezes a cidade de hoje daria uns 90 mil prédios e dezenas de
milhões de triângulos. Nem o CS2 desenha isso de uma vez. Ele desenha só o que está perto, com versões simplificadas
de longe, e simula o resto em números.

**O caminho (fase 4):**

- **Mapa em blocos** (chunks) que carregam e descarregam conforme a câmera.
- **Prédios com três níveis de detalhe:** o modelo, uma caixa com fachada e um ponto de luz de noite.
- **Instâncias na GPU** para árvores, carros e gente.
- **Simulação agregada por quarteirão,** com uma amostra visível de pessoas e carros.
- **Com isso a meta passa a ser:** 50 mil lotes por metrópole, 1 milhão de moradores simulados e as 12 metrópoles
  guardadas no mesmo save.

## 5. O jogo que você descreveu

### 5.1 Pilares

1. **Construir de verdade:** obra com canteiro, operários, materiais e tempo, do desmate ao arranha-céu.
2. **Negócios com consequência:** a Holding compra, constrói, empresta, concorre e decide. Cada decisão muda a
   empresa, a cidade, os rivais e os aliados.
3. **Poder e influência:** reputação, relações e política, da Prefeitura à geopolítica.
4. **Escala crescente:** um lote, um bairro, uma cidade, um país, o mundo.
5. **Luxo como símbolo:** sede, mansões, carros, jatinhos, iates e helicópteros. Eles contam como status e abrem
   portas.

### 5.2 A Holding guarda-chuva

- **Divisões:**
  - Construção
  - Imobiliário
  - Indústria
  - Logística
  - Finanças (banco, seguros)
  - Energia
  - Tecnologia
  - Mídia
  - Hotelaria e luxo
  - Aviação e navegação
- **Cada divisão tem:**
  - um diretor (personagem com traços);
  - caixa próprio;
  - demonstrativo de resultado (receita, custo, lucro);
  - funcionários;
  - reputação;
  - projetos.
- **O conselho de administração** (você preside) aprova grandes investimentos. O valuation vira preço de ação.
  Captar dinheiro vendendo parte da Holding dilui o seu controle.
- **Influência** é um recurso novo. Vem de mídia, filantropia, empregos gerados e relações. Gasta-se em licenças,
  licitações e política.

### 5.3 Decisões com consequência

- **Eventos com 2 a 4 escolhas,** como o Conselho de hoje, mas com memória:
  - a escolha grava uma marca na história;
  - muda relações;
  - abre ou fecha caminhos semanas depois.
- **Exemplos:**
  - Uma licitação do metrô: entrar sozinho, em consórcio com um rival ou fazer lobby na câmara.
  - Uma denúncia de poluição da fábrica: investir em filtros, abafar na mídia ou fechar a planta.
  - Um rival em crise: comprar as dívidas dele, formar aliança ou deixar quebrar.
  - Uma greve dos operários: negociar, substituir ou automatizar.
- **Cada escolha mostra o ganho, o custo e o risco,** como os dilemas atuais. Nenhuma opção é a certa: cada uma cuida
  de uma coisa e custa outra.

### 5.4 Concorrentes e aliados

- **Rivais:** 3 a 5 holdings na primeira metrópole, cada uma com fundador, estilo (agressiva, conservadora, familiar,
  estrangeira), caixa e bairros de interesse. Eles:
  - compram terrenos e disputam licitações;
  - lançam prédios que tiram moradores e clientes dos seus;
  - propõem parcerias.
- **Aliados:** bancos, famílias tradicionais, sindicatos, a Prefeitura, a mídia e investidores estrangeiros.
- **Relações:** vão de -100 a 100 e mudam com as decisões. Com relação alta vêm juros menores, licenças mais rápidas e
  informação privilegiada. Com relação baixa vêm auditorias, greves e campanhas contra você.

### 5.5 Política

- Prefeito e câmara municipal com partidos e humor.
- Leis que mudam as regras da cidade: impostos por zona, limite de altura, meta verde, zona franca.
- Eleições a cada 4 anos do jogo. Você pode apoiar candidatos.
- Na escala do país: presidente, congresso, câmbio e tarifas.

### 5.6 As 12 metrópoles

Cada metrópole faz o papel de um país. Tem arquitetura, clima, moeda, leis, recursos e rivais próprios.

- **Os 12 países de referência:** Brasil (onde fica a Arcologia), EUA, Reino Unido, Alemanha, França, China, Japão,
  Coreia do Sul, Índia, Singapura, Emirados Árabes Unidos e Arábia Saudita.
- **Nomes:** os nomes de trabalho são fictícios e inspirados em cada país. Isso deixa a política livre de problemas
  com fatos reais, mas pode ser trocado pelos nomes reais se você preferir.
- **Mapa-múndi:** liga as metrópoles por rotas de avião e de navio. O porto e o aeroporto de cada uma são a porta de
  entrada.
- **Abrir filial em outra metrópole pede:**
  - licença do governo local;
  - um parceiro local (aliado);
  - capital mínimo.
- **Geopolítica:**
  - tratados e blocos comerciais;
  - tarifas;
  - câmbio;
  - crises (energia, eleições, sanções, pandemia);
  - corridas por recursos.
- **O que as crises movem:** os preços das cadeias de produção e as rotas de comércio.

### 5.7 A história em atos

1. **A Arcologia (hoje):** a obra que dá origem à Holding.
2. **A Holding:** a cidade cresce em volta. Surgem os primeiros rivais e a primeira eleição.
3. **O mercado:** cadeias de produção, bolsa e uma crise que testa as alianças.
4. **O país:** a Holding vira grupo nacional, com política federal e o porto e o aeroporto como portas do mundo.
5. **O mundo:** filiais nas 12 metrópoles e a geopolítica.

Os conselheiros de hoje continuam: Íris, Tomé, Nara, Caio e Dona Cida. Entram novos personagens: a diretora
financeira, o advogado, a chefe de relações públicas, os fundadores rivais e os líderes políticos.

## 6. Roteiro por fases

| Fase | O que entra | Pronto quando |
|---|---|---|
| 1 (feita) | desmate, porto, jatinhos, esportivos, limites maiores, esta visão e a equipe de IA | publicada em 26/09/2026 |
| 2 | Holding com divisões, influência, rivais e aliados na primeira metrópole, eventos de decisão com memória, bombeiros, lixo, telecom e marcos | robô vence um rival e completa 10 eventos |
| 3 | estradas livres (reta, curva, rotatória), zonas com demanda, linhas de ônibus e metrô, trânsito com rotas | uma cidade crescida só por zonas e estradas |
| 4 | motor em escala: WebGPU, simulação em worker, mapa em blocos, níveis de detalhe, estações e chuva, agentes estatísticos | 50 mil lotes a 60 quadros no PC e 30 no Poco X7 |
| 5 | apps: `.exe` de PC (Electron) e APK (TWA), saves em arquivo, nuvem opcional | instalados e testados nos seus aparelhos |
| 6 | mapa-múndi e a segunda metrópole (EUA), rotas de avião e navio, câmbio | uma filial lucrativa fora do Brasil |
| 7 | as 12 metrópoles, política e geopolítica completas | todas jogáveis no mesmo save |

## 7. Equipe de IA

### 7.1 Agentes (em `.claude/agents/`)

| Agente | Faz | Usa |
|---|---|---|
| `diretor-de-jogo` | mantém a visão coerente, escreve regras e eventos, decide o que entra em cada fase | este documento, `fonte/data`, simulação |
| `engenheiro-simulacao` | regras em `fonte/sim/estado.js`, save, testes de regra, economia | `simular.mjs --testes`, robô |
| `engenheiro-grafico` | render, desempenho, níveis de detalhe, WebGPU, orçamento por aparelho | `testar.mjs`, medição de chamadas e triângulos |
| `artista-3d` | modelos procedurais no padrão da foto, ícones | `fonte/render/cidade.js`, `icones.js`, capturas |
| `roteirista` | história, personagens, falas, decisões e consequências | `fonte/data/historia.js`, eventos |
| `testador` | robô de partida, vitrine da interface, capturas de aceite, caça a regressões | ferramentas de teste |

### 7.2 Personas

- **O jogador (você):**
  - joga sozinho;
  - tem perfil estratégico e de negócios;
  - joga em sessões no Poco X7 e em partidas longas no PC;
  - quer alto padrão visual e escala gigante.
- **O revisor exigente:** persona usada nas revisões. Pergunta "isto parece Cities: Skylines II?" e "isto roda no
  Poco X7?".
- **Os personagens do jogo:** conselheiros, diretores, rivais e políticos, com traços que guiam falas e decisões.

### 7.3 Ferramentas

- **Já em uso:** Node, esbuild, three.js, Playwright com Chromium, GitHub Actions e GitHub Pages.
- **Para as fases 4 e 5:**
  - Electron e electron-builder: `.exe` no GitHub Actions com Windows.
  - Bubblewrap ou Capacitor, com JDK e Android SDK: APK.
  - glTF-Transform, meshoptimizer e texturas KTX2: modelos e texturas leves.
  - wasm-pack, se o núcleo for para Rust.
- **Medição real:** o navegador de testes daqui não tem GPU. O desempenho de verdade se mede nos seus aparelhos, com
  um painel de desempenho no jogo que você pode ligar e mandar por print.

### 7.4 Skills (em `.claude/skills/`)

- `verificar-e-publicar`: montar, testes de regra, robô, vitrine, commits separados (fonte e montagem) e envio.
- `novo-predio-da-cidade`: dados, modelo por nível, ícone, altura, painel, robô, teste e README.
- `capturas-de-aceite`: capturas com a câmera certa, obra no meio e medição de chamadas e triângulos.

### 7.5 O que preciso de você

- **Decidir os nomes das metrópoles:** reais ou fictícios.
- **Decidir o tom da história:** mais drama corporativo ou mais construção e utopia.
- **Testar cada fase no Poco X7 e no PC** e mandar fps e prints. Há um painel de desempenho nas configurações.
- **Na fase 5, criar uma chave de assinatura do APK** nos secrets do repositório. Eu explico o passo a passo.
