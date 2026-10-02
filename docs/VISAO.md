# Visão e roteiro: da Arcologia a um império em 12 metrópoles

Documento de direção do jogo. Diz o que o jogo quer ser, o que pegamos de Cities: Skylines II e de Highrise City,
onde ele deve rodar, como crescer até o tamanho pedido e quem (entre agentes e ferramentas) faz cada parte.
Atualizado em 27/09/2026: o jogo está sendo refeito do zero e o plano e o roteiro dele estão em `docs/PROJETO.md` (seção 6
deste documento). A visão de longo prazo continua aqui.

## 1. Onde estamos

- **Arcologia de Held:** a obra central, em 6 capítulos, com a mecânica do SimCity BuildIt: usinas, oficinas, pranchas,
  pavimentos, pedidos e obras animadas. Desde a fase 1.2 ela é uma construção só, o **Trevo da Holding**: o Anel
  Mestre (Sede e Anel) em volta do lago com a Torre escalonada e o heliponto, quatro tambores, quatro folhas em gota
  (Escola, Universidade, Biblioteca, Vida com a Cúpula fechada), contorno fechado com a linha de luz do acelerador e o
  eixo com a praça e a colunata; anel viário por fora, ligado aos bairros e ao porto. Prédios da cidade e obras da
  Arcologia aceitam cor escolhida pelo jogador.
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

**Decidido pelo dono (26/09/2026):** as metrópoles são baseadas nos 12 países reais, com nomes fictícios.

| País de referência | Metrópole | Vocação e arquitetura |
|---|---|---|
| Brasil | **Heldópolis** | construção, natureza e agro; a Arcologia de Held é o marco; modernismo tropical, verde nos terraços |
| EUA | **Nova Libertas** | finanças, tecnologia e mídia; torres de vidro, avenidas largas |
| Reino Unido | **Albionford** | bancos, seguros e bolsa; tijolo, pedra e vidro às margens de um rio |
| Alemanha | **Rheinhaven** | indústria, engenharia e automóveis; fábricas limpas, trens e o porto fluvial |
| França | **Valmonde** | luxo, moda e turismo; bulevares, praças radiais e ateliês |
| China | **Jinhai** | manufatura, portos e infraestrutura; megatorres e trens-bala |
| Japão | **Hoshimura** | robótica, trens e eletrônicos; bairros densos e jardins |
| Coreia do Sul | **Hanbit** | eletrônicos, estaleiros e cultura pop; telões e pontes |
| Índia | **Suryapur** | serviços, TI e mão de obra; mercados e parques tecnológicos |
| Singapura | **Singara** | porto, finanças e hub aéreo; jardins verticais |
| Emirados Árabes Unidos | **Qasr al-Noor** | turismo de luxo, aviação e arranha-céus; ilhas artificiais |
| Arábia Saudita | **Rimal** | energia e megaprojetos no deserto; cidades lineares |

- **Por que nomes fictícios:** a política e as crises ficam livres de fatos reais.
- **O país de Heldópolis** chama-se **República de Vera Cruz do Leste** (D77).
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

### 5.7 O tom: drama corporativo e utopia em equilíbrio

**Decidido pelo dono (26/09/2026):** um equilíbrio entre os dois.

- **Dois medidores:** Influência (poder, mercado, política) e Legado (o que a Holding deixa para as cidades: bem-estar,
  verde, cultura).
- **Nos eventos de decisão:** em geral, uma opção puxa um medidor e a outra puxa o outro.
- **Cada ato alterna:** crises e rivalidade (drama) com obras-marco e metas de cidade sustentável (utopia).
- **Finais diferentes:** conforme o equilíbrio entre os dois medidores ao chegar à 12ª metrópole, você vira império,
  fundação ou as duas coisas.

### 5.8 A história em atos

**Atualização (D67, 30/09/2026):** a história agora tem três partes (2005 a 2019, 2020 a jun 2026 e jun 2026 a 2040), com
calendário, sócios e horas em `docs/desenho/historia.md`. Os atos abaixo ficam como roteiro de conteúdo: os atos 1 e 2
caem na parte 2 e os atos 3 a 5 na parte 3.

1. **A Arcologia (hoje):** a obra que dá origem à Holding.
2. **A Holding:** a cidade cresce em volta. Surgem os primeiros rivais e a primeira eleição.
3. **O mercado:** cadeias de produção, bolsa e uma crise que testa as alianças.
4. **O país:** a Holding vira grupo nacional, com política federal e o porto e o aeroporto como portas do mundo.
5. **O mundo:** filiais nas 12 metrópoles e a geopolítica.

Os conselheiros de hoje continuam: Íris, Tomé, Nara, Caio e Dona Cida. Entram novos personagens: a diretora
financeira, o advogado, a chefe de relações públicas, os fundadores rivais e os líderes políticos.

## 6. Roteiro

O roteiro por fases saiu daqui. O jogo está sendo refeito do zero, e o plano dele é um documento só:
**`docs/PROJETO.md`**. Lá estão o M1 "Heldópolis nasce" (seção 4: M1a e M1b, parcelas, prévias e os portões em que
você aprova a direção), os critérios de aceite medidos e o roteiro do M2 ao M6 (seção 5.1).

As fases 1 a 1.2 (desmate, porto, jatinhos, esportivos, limites maiores, plano diretor e Trevo da Holding) ficaram no
jogo anterior, que continua jogável e congelado em `app/` até a publicação do M1 e, depois dela, em `jogo-antigo/`.
A visão deste documento (a Holding, os rivais, a política e as 12 metrópoles, seção 5) continua valendo e entra no
jogo novo a partir do M2.

## 7. Equipe de IA

### 7.1 Agentes (em `.claude/agents/`)

| Agente | Faz | Usa |
|---|---|---|
| `diretor-de-jogo` | mantém a visão coerente, escreve regras, decisões e objetivos, decide o que entra em cada parcela | `docs/PROJETO.md`, este documento, `fonte/data` |
| `engenheiro-simulacao` | simulação por registro em `fonte/sim/`, save, determinismo, economia, testes | `simular.mjs --testes`, `--determinismo`, `--bancada`, robô |
| `engenheiro-grafico` | render em WebGL2, sombra própria, LOD, oficina, orçamento por perfil | `bancada.mjs`, `testar.mjs` |
| `artista-3d` | gerador de prédios, colocáveis, Torre Lâmina, com referência real | `fonte/render/geracao/`, cenas da bancada |
| `engenheiro-interface` | interface em Preact: HUD, folhas, telas, ferramentas, glifos, gestos | `vitrine-ui.mjs`, render e simulação falsos |
| `roteirista` | história, personagens, falas, decisões e todos os textos da interface | `fonte/data/historia.js`, `fonte/ui/textos/` |
| `testador` | testes, bancada, vitrine, robô e capturas de aceite, caça a regressões | ferramentas de teste |

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

- `verificar-e-publicar`: montar numa pasta temporária, testes e guarda de texto, bancada, vitrine, robô, commits de
  fonte (e a montagem só nas prévias e na publicação do M1).
- `novo-predio-da-cidade` e `capturas-de-aceite`: o essencial do jogo novo; reescritas na C2 com o M1 pronto.

### 7.5 O que preciso de você

- ~~Decidir os nomes das metrópoles~~: decidido, países reais com nomes fictícios (seção 5.6).
- ~~Decidir o tom da história~~: decidido, equilíbrio entre drama corporativo e utopia (seção 5.7).
- **Testar cada fase no Poco X7 e no PC** e mandar fps e prints. Há um painel de desempenho nas configurações.
- **Na fase 5, criar uma chave de assinatura do APK** nos secrets do repositório. Eu explico o passo a passo.
