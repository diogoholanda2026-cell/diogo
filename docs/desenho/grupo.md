# Governo do grupo: negociar, dirigir e emprestar entre as empresas (D101)

Pedido do dono em 06/10/2026: negociar no mundo corporativo e no geopolítico global, influenciando o mundo; dirigir o rumo
e as ações da Holding guarda-chuva e do que ela controla; e deixar o banco do grupo emprestar à Holding guarda-chuva,
já que ele é controlado por uma holding intermediária. Estes sistemas são a espinha da Parte 2 (M3) e da Parte 3 (M5 e M6)
e já têm lugar no roteiro (`PROJETO.md`, 5.1) e na história (`historia.md`). Entram **por etapa**, conforme o projeto
chega nelas.

## 1. O grupo como o jogo o vê

A Holding Held guarda-chuva controla quatro intermediárias: **Held Capital** (a fintech e o banco, 5 departamentos,
inclusive agroindústria e construções de grande porte), **Held Litos**, **Held Silício** e **Held Pórtico**
(`historia.md`, seção 5.5). O Fundo Gestor é dos 14 sócios (D79). O jogador é o criador e dirige o grupo; o Conselho e o
Super Cérebro aconselham.

## 2. Dirigir a Holding e o que ela controla (M3)

- **Tela do grupo:** o organograma (guarda-chuva, intermediárias, divisões e filiais), com o caixa, o lucro e o risco de
  cada uma, e as **diretrizes** que o dono pode dar a cada nível: orçamento de investimento, apetite de risco,
  dividendos para a guarda-chuva, prioridade de expansão e o que comprar ou vender.
- **Ações:** abrir, fundir, comprar e vender empresas e participações; criar uma intermediária; trocar o diretor de uma
  divisão; ordenar uma obra à construtora do grupo. O que a divisão faz sozinha segue a diretriz (a simulação executa;
  o jogador dirige).
- **Conselheiro de Estratégia (D79):** o Super Cérebro sugere a jogada, com o caso real em que deu certo e o risco.
- **Regra de honestidade:** toda ação mostra o custo, o prazo e o que muda, antes de confirmar (princípio do CS2).
- **Referências:** *Capitalism Lab* e *Offworld Trading Company* pela camada empresarial; *Football Manager* pelo
  princípio de dirigir por diretrizes e delegar a execução; o organograma como interface é a mesma ideia do gráfico de
  um grupo real (holding, controlada, coligada).

## 3. Negociar no mundo corporativo (M3)

- **Contratos e parcerias:** fornecimento de longo prazo (a cadeia de materiais da Holding e as do complexo), joint
  ventures, contratos de obra e de licenciamento, com preço, prazo, multa e cláusula de saída.
- **Aquisições e participações:** oferta, contraproposta, resposta do alvo (aceita, recusa, pede mais) e o efeito no
  grupo; os rivais e aliados do M3 (os gigantes da `historia.md`, seção 5.4) negociam pelo mesmo modelo, com personalidade.
- **Modelo:** negociação por **rodadas**, cada lado com um valor de reserva escondido e um humor; o jogador vê o que o
  outro lado revela e o conselheiro estima o resto. Sem mini-jogo de reflexo.

## 4. Negociar no mundo geopolítico (M5 e M6)

- **O que é:** relações do grupo com **países fictícios** (a República de Vera Cruz do Leste e as potências da D77),
  por **ações diplomáticas** (acordos comerciais, tarifas, vistos para executivos, licenças de operação, financiamento
  de infraestrutura, lobby) e por **crises** que o grupo atravessa e, às vezes, provoca.
- **Influência:** o grupo ganha ou perde **Influência** (o recurso do M3, junto com o Legado) com cada governo, e a Influência compra leis,
  licenças e proteção em crise; é o que "influenciar o mundo" significa dentro do jogo.
- **Referências:** *Victoria 3*, pelas **ações diplomáticas** em três tipos (instantâneas, contínuas e pactos, com custo
  de influência) ([diário de desenvolvimento nº 20](https://admin-forum.paradoxplaza.com/forum/developer-diary/victoria-3-dev-diary-20-diplomatic-actions.1495234));
  *Tropico 6*, pelo equilíbrio entre potências (acordos comerciais com uma desagradam as rivais, a rejeição pode virar
  sanção ou intervenção) ([resumo](https://onlinegam.it.com/?p=245)).
- **Regra do projeto:** países, empresas e pessoas reais **não** aparecem com nome real; só os fictícios da
  `historia.md` (seção 7).
- **Etapa:** a camada diplomática simples (acordos e tarifas de um país, a Vera Cruz do Leste) entra no **M5**, com a
  política local (prefeito, câmara, leis); a global, com câmbio, tarifas, crises e as 12 metrópoles, no **M6**.

## 5. O banco do grupo empresta à Holding guarda-chuva (M3)

**Por que é permitido:** a Held Capital é um banco controlado por uma intermediária da guarda-chuva. No Brasil, a Lei
13.506/2017 reformulou o crime de "empréstimo vedado" da Lei 7.492/1986 (art. 17) e deixou de **proibir** o empréstimo
de banco a partes relacionadas; ele passou a ter **condições e limites** regulatórios, que a Resolução CMN 4.693 (em
vigor desde 1º de janeiro de 2019) define
([Migalhas](https://www.migalhas.com.br/depeso/290162/operacoes-entre-partes-relacionadas--o-novo-regime-juridico-regulatorio-bancario-a-partir-da-edicao-da-lei-13-506-17),
[Levy & Salomão](https://www.levysalomao.com.br/files/publicacao/anexo/20181031132548_ls-boletimjuridico--outubro2018-emprestimos-de-instituicoes-financeiras-a-partes-relacionadas.pdf)).
No jogo, o país é fictício (Vera Cruz do Leste), mas a regra vem dessa realidade.

**Como funciona (proposta, a calibrar com o robô do M3):**
- Uma **linha intragrupo** na Held Capital, separada do empréstimo de 50 mil por ano a 10%, até 500 mil, que o dono
  fixou (`REGRAS_DONO`), que **não muda**.
- **Condições de mercado:** o juro e o prazo são os que a Held Capital cobraria de um terceiro (princípio de mercado);
  taxa abaixo disso aciona um alerta do Conselho.
- **Limite:** uma fração do capital da Held Capital por parte relacionada (os números do limite não são citados aqui
  porque variam por norma; a calibração do jogo fica no `REGRAS_DONO` ao lado, marcada como proposta).
- **Efeitos:** os juros saem da guarda-chuva e entram na Held Capital (no consolidado é neutro, mas o caixa de cada
  empresa muda), o dinheiro da guarda-chuva sobe, e a Held Capital fica menos líquida para emprestar a terceiros e
  para o Fundo Gestor. Passar do limite ou das condições gera **multa do regulador** e perda de Influência.
- **Teste:** o robô do M3 prova que a linha intragrupo ajuda quem a usa com juízo e prejudica quem abusa, e que não
  quebra nenhuma regra do dono (o A2 segue verde).

## 6. Etapas e parcelas

| Etapa | Entra |
|---|---|
| **M3** | tela do grupo e diretrizes, Conselheiro de Estratégia (D79), negociação corporativa, linha intragrupo da Held Capital |
| **M5** | diplomacia simples de um país, junto com a política local |
| **M6** | diplomacia global com câmbio, tarifas, crises e as 12 metrópoles |

Antes de cada um entrar numa parcela vale o diálogo da D78: o que o dono quer decidir e o que quer delegar.
