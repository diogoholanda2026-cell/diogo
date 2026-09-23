// História, conselheiros e capítulos. A maquete na mesa é o "gêmeo vivo" da Arcologia de Held:
// cada etapa aprovada aqui vira obra de verdade. Textos curtos, no máximo duas linhas por fala.
export const CONSELHO = {
  iris: { nome: 'Íris', cargo: 'Arquiteta-chefe', cor: '#e8b86a', ini: 'Í' },
  tome: { nome: 'Tomé', cargo: 'Engenheiro de materiais', cor: '#7fb2d8', ini: 'T' },
  nara: { nome: 'Nara', cargo: 'Bióloga da conservação', cor: '#7cc48a', ini: 'N' },
  caio: { nome: 'Caio', cargo: 'Físico', cor: '#a58be0', ini: 'C' },
  cida: { nome: 'Dona Cida', cargo: 'Voz dos moradores', cor: '#e39a7a', ini: 'D' },
};

export const ABERTURA = [
  ['iris', 'Boas-vindas ao Ateliê da Arcologia de Held. Esta maquete é o gêmeo vivo do projeto.'],
  ['iris', 'Em azul, a Composição Total que vamos erguer. Cada etapa aprovada aqui vira obra de verdade.'],
  ['iris', 'Hoje é só pasto degradado cercado de mata. Vamos começar pelo canteiro de obras.'],
  ['nara', 'Uma regra só: nenhuma árvore da mata cai. Construímos nas clareiras e devolvemos vida a elas.'],
  ['tome', 'Tudo começa no canteiro, ali no canto da mesa. Vamos produzir os primeiros materiais.'],
];

// Capítulos: metas (todas precisam ser cumpridas), apresentação ao Conselho da Holding e escolha.
// tipos de meta: etapa ('proj.e'), modulos (faixa, quantidade, nível), predio (id), nivel (jogador)
export const CAPITULOS = [
  { n: 1, nome: 'Fundação', sub: 'Terra nua, primeiros materiais', abre: ['pas_frente', 'lago', 'sede', 'anel'],
    metas: [
      { tipo: 'predio', id: 'carpintaria', txt: 'Construa a Carpintaria' },
      { tipo: 'etapa', id: 'pas_frente.e1', txt: 'Abra o Caminho da Frente' },
      { tipo: 'etapa', id: 'lago.e1', txt: 'Desassoreie o Lago Central' },
      { tipo: 'etapa', id: 'sede.e2', txt: 'Erga o térreo da Sede da Holding' },
      { tipo: 'modulos', faixa: 'anel', qtd: 3, nivel: 2, txt: 'Leve 3 módulos do Anel ao nível 2' },
    ],
    fala: [['iris', 'O Conselho viu a primeira volta do Anel de pé. Aprovado!'], ['cida', 'As primeiras famílias já perguntam quando podem se mudar.']],
    escolha: [{ id: 'usina+', txt: 'Usinas 15% mais rápidas', dica: 'Tomé prefere: mais matéria-prima.' }, { id: 'almox+', txt: '+25 vagas no Almoxarifado', dica: 'Íris prefere: menos aperto.' }] },
  { n: 2, nome: 'Água que corre', sub: 'Lago vivo, praça e escola', abre: ['escola', 'campo', 'praca', 'pas_bulevar', 'pas_anel'],
    metas: [
      { tipo: 'etapa', id: 'lago.e3', txt: 'Conclua a Estação natural de água' },
      { tipo: 'etapa', id: 'escola.e3', txt: 'Entregue a Escola com piscina' },
      { tipo: 'etapa', id: 'campo.e3', txt: 'Ilumine o campo' },
      { tipo: 'etapa', id: 'praca.e2', txt: 'Faça os jardins filtrantes da praça' },
      { tipo: 'etapa', id: 'sede.e3', txt: 'Instale o anel de vidro solar da Sede' },
      { tipo: 'modulos', faixa: 'anel', qtd: 8, nivel: 3, txt: 'Todos os módulos do Anel no nível 3' },
    ],
    fala: [['nara', 'A água do lago já volta limpa para a mata. Os martins-pescadores voltaram.'], ['iris', 'Agora, o coração do campus: a Biblioteca.']],
    escolha: [{ id: 'repasse+', txt: '+15% nos repasses', dica: 'Dona Cida prefere.' }, { id: 'mutirao2', txt: '+2 fichas de Mutirão', dica: 'Tomé prefere.' }] },
  { n: 3, nome: 'Saber de madeira', sub: 'Biblioteca, faculdades e ciência', abre: ['biblioteca', 'crd', 'humanidades', 'engenharia', 'instituto', 'ciencias', 'onda', 'gramadoUni', 'uniElo', 'pas_ponte', 'ponteCoberta', 'uni', 'anelBib'],
    metas: [
      { tipo: 'etapa', id: 'biblioteca.e5', txt: 'Cubra a Biblioteca com o dossel' },
      { tipo: 'etapa', id: 'crd.e3', txt: 'Acenda o Centro de Recursos Digitais' },
      { tipo: 'etapa', id: 'ciencias.e4', txt: 'Conclua a Faculdade de Ciências' },
      { tipo: 'etapa', id: 'humanidades.e2', txt: 'Termine a Faculdade de Humanidades' },
      { tipo: 'etapa', id: 'engenharia.e2', txt: 'Termine a Faculdade de Engenharia' },
      { tipo: 'etapa', id: 'instituto.e2', txt: 'Termine o Instituto de Estudos Urbanos' },
      { tipo: 'modulos', faixa: 'uni', qtd: 4, nivel: 4, txt: 'Campus Universitário no nível 4' },
      { tipo: 'etapa', id: 'sede.e4', txt: 'Feche a cobertura da Sede' },
    ],
    fala: [['iris', 'O dossel da Biblioteca aparece de qualquer ponto do campus. Lindo.'], ['caio', 'E embaixo da terra cabe um acelerador inteiro. Vamos?']],
    escolha: [{ id: 'oficina+', txt: 'Oficinas 15% mais rápidas', dica: 'Tomé prefere.' }, { id: 'bem+', txt: '+5% de bem-estar', dica: 'Dona Cida prefere.' }] },
  { n: 4, nome: 'Energia escondida', sub: 'Acelerador e Vila Estudantil', abre: ['acelerador', 'anfiteatro', 'pas_vila', 'casas'],
    metas: [
      { tipo: 'etapa', id: 'acelerador.e4', txt: 'Abra o Centro de Física Avançada' },
      { tipo: 'etapa', id: 'anfiteatro.e2', txt: 'Estreie o palco do anfiteatro' },
      { tipo: 'modulos', faixa: 'casas', qtd: 6, nivel: 3, txt: 'Todas as casas da Vila no nível 3' },
      { tipo: 'modulos', faixa: 'anel', qtd: 8, nivel: 5, txt: 'Todos os módulos do Anel no nível 5' },
    ],
    fala: [['caio', 'Primeiro feixe no anel! E a central geotérmica já ajuda a rede.'], ['nara', 'Agora é a vez dos gigantes. O santuário espera.']],
    escolha: [{ id: 'usina+', txt: 'Usinas 15% mais rápidas', dica: 'Tomé prefere.' }, { id: 'xp+', txt: '+20% de experiência', dica: 'Íris prefere.' }] },
  { n: 5, nome: 'Casa dos gigantes', sub: 'Santuário, savana, bioma e gorilas', abre: ['santuario', 'santuarioInt', 'savana', 'bioma', 'gorilas', 'pas_trilhaBioma', 'pas_elo', 'pas_santuario'],
    metas: [
      { tipo: 'etapa', id: 'santuarioInt.e2', txt: 'Receba a fauna resgatada no Santuário' },
      { tipo: 'etapa', id: 'savana.e4', txt: 'Complete os habitats da savana' },
      { tipo: 'etapa', id: 'bioma.e4', txt: 'Encha o aquário do Bioma' },
      { tipo: 'etapa', id: 'gorilas.e4', txt: 'Receba a família de gorilas' },
      { tipo: 'modulos', faixa: 'santuario', qtd: 5, nivel: 2, txt: 'Anel do Santuário completo' },
    ],
    fala: [['nara', 'Os gorilas olham para a passarela com curiosidade. Estão em casa.'], ['iris', 'Falta só uma coisa para a composição ficar igual à maquete: o canteiro.']],
    escolha: [{ id: 'mutirao2', txt: '+2 fichas de Mutirão', dica: '' }, { id: 'repasse+', txt: '+15% nos repasses', dica: '' }] },
  { n: 6, nome: 'Composição total', sub: 'Devolver o canteiro à mata', abre: ['reflorestar'],
    metas: [{ tipo: 'etapa', id: 'reflorestar.e1', txt: 'Reflorestar o canteiro' }],
    fala: [['iris', 'A composição total da Arcologia de Held está completa. Igual à maquete do Conselho.'], ['cida', 'Toda cidade começa pequena. Obrigada por construir esta com a gente.']],
    escolha: null },
];

// Falas curtas disparadas por acontecimentos (cada uma aparece uma vez)
export const DICAS = {
  primeiraColeta: ['tome', 'Toque no balão para coletar. Arrastar o dedo por vários balões coleta todos.'],
  almoxCheio: ['tome', 'O almoxarifado lotou. Use os materiais nas obras ou amplie com estrados, etiquetas e cadeados.'],
  primeiraEtapa: ['iris', 'Toque na placa da obra para ver a prancha. Entregue os materiais e comece a obra.'],
  modulo: ['iris', 'Os módulos do Anel crescem um andar por nível, como uma cidade de verdade.'],
  servicoAgua: ['cida', 'Para passar do nível 2, os moradores precisam de água tratada. O lago resolve.'],
  servicoEnergia: ['tome', 'Nível 4 pede energia. A fachada solar da Sede é a nossa usina.'],
  servicoSaneamento: ['nara', 'Nível 5 pede saneamento: os jardins filtrantes da praça tratam o esgoto com plantas.'],
  licenca: ['iris', 'Obra grande pede topografia: estacas, balizas e trenas caem ao coletar produção.'],
  pedidos: ['cida', 'O quadro de pedidos está aberto: os vizinhos trocam materiais por créditos.'],
  deposito: ['tome', 'No Depósito de Trocas dá para comprar matéria-prima ou vender o que sobra.'],
  bemEstar: ['cida', 'Praças, escola e biblioteca deixam todo mundo mais feliz. Felicidade aumenta os repasses.'],
};
