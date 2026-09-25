// História, conselheiros e capítulos. A maquete na mesa é o "gêmeo vivo" da Arcologia de Held:
// cada etapa aprovada aqui vira obra de verdade. Textos curtos, no máximo duas linhas por fala.
import { PROJ, MODULOS } from './obras.js';

export const CONSELHO = {
  iris: { nome: 'Íris', cargo: 'Arquiteta-chefe', cor: '#e8b86a', ini: 'Í' },
  tome: { nome: 'Tomé', cargo: 'Engenheiro de materiais', cor: '#7fb2d8', ini: 'T' },
  nara: { nome: 'Nara', cargo: 'Bióloga da conservação', cor: '#7cc48a', ini: 'N' },
  caio: { nome: 'Caio', cargo: 'Físico', cor: '#a58be0', ini: 'C' },
  cida: { nome: 'Dona Cida', cargo: 'Voz dos moradores', cor: '#e39a7a', ini: 'D' },
};

// abertura: três falas e o jogador já age (o tutorial segue abaixo)
export const ABERTURA = [
  ['iris', 'Boas-vindas ao Ateliê da Arcologia de Held. Em azul, a Composição Total que vamos erguer.'],
  ['nara', 'Uma regra só: nenhuma árvore da mata cai. Construímos nas clareiras e devolvemos vida a elas.'],
  ['tome', 'Tudo começa no canteiro, ali na beira do terreno. Vamos produzir os primeiros materiais.'],
];

// Primeiros passos (4 a 6 minutos). alvo: o que a interface destaca ('balao:<id do balão>',
// 'bt:<botão do trilho>', seletor CSS dentro do painel, ou 'meta' para o cartão do capítulo).
// feito(J): o passo está cumprido (também vale se o jogador já passou dele por conta própria).
const naObra = (J, k) => ['obra', 'pronta', 'feita'].includes(J.etapa(k).estado);
export const TUTORIAL = [
  { id: 'brita', quem: 'tome', fala: 'Toque na Usina de Materiais e produza Brita reciclada: é o piso do primeiro caminho. Com + e − dá para fazer até 10 de uma vez.', alvo: 'balao:uusina1',
    feito: (J) => J.S.predios.usina1.slots.some((s) => s?.item === 'brita') || J.S.stats.coletas > 0 || naObra(J, 'pas_frente.e1') },
  { id: 'caminho', quem: 'iris', fala: 'Abra Obras, escolha o Caminho da Frente e toque em Entregar e iniciar.', alvo: ['bt:obras', '[data-a=entregarIniciar]'],
    feito: (J) => naObra(J, 'pas_frente.e1') },
  { id: 'coletar', quem: 'tome', fala: 'Cada lote pronto vai sozinho para o Almoxarifado. Marque um espaço como automático e ele repete o mesmo lote sem parar.', alvo: 'balao:uusina1',
    feito: (J) => J.S.stats.coletas >= 1 },
  { id: 'aprovar', quem: 'iris', fala: 'O caminho ficou pronto. Toque no balão verde para aprovar a obra.', alvo: 'balao:epas_frente.e1',
    feito: (J) => J.feita('pas_frente.e1') },
  { id: 'carpintaria', quem: 'tome', fala: 'Construa a Carpintaria e coloque uma Viga laminada na fila.', alvo: 'balao:ocarpintaria',
    feito: (J) => { const o = J.S.predios.carpintaria; return o.ok && (o.fila.some((f) => f.item === 'viga') || o.prontos.includes('viga') || J.S.itens.viga > 0 || J.feita('sede.e2')); } },
  { id: 'lago', quem: 'nara', fala: 'Agora o Lago: entregue brita e madeira, inicie e use a ficha de Mutirão para terminar mais cedo.', alvo: 'balao:elago.e1',
    feito: (J) => J.feita('lago.e1') || J.S.stats.mutiroes > 0 },
  { id: 'anel', quem: 'cida', fala: 'As primeiras famílias esperam. Construa o primeiro módulo do Anel.', alvo: 'balao:manel0',
    feito: (J) => J.S.modulos.anel.some((m) => m.nivel > 0 || m.obra) },
  { id: 'meta', quem: 'iris', fala: 'A linha Agora mostra o próximo passo até a apresentação ao Conselho. Toque nela para seguir.', alvo: 'meta',
    feito: (J) => !!J.S.dicas.metaFoco },
];

// Capítulos: metas (todas precisam ser cumpridas), apresentação ao Conselho da Holding e escolha.
// tipos de meta: etapa ('proj.e'), modulos (faixa, quantidade, nível), predio (id), nivel (jogador).
// obras: ids do que o capítulo abre; abre: os nomes (calculados no fim do arquivo).
// A escolha feita no fim de um capítulo vale para os seguintes (EFEITOS): por isso o dilema
// oferecido fala do que vem pela frente. Cada opção: {id, quem, txt, ganho, custo, porque} (+ dica pronta, no fim
// do arquivo); a primeira cuida das pessoas (bem-estar) e a segunda acelera a obra.
export const CAPITULOS = [
  { n: 1, nome: 'Fundação', sub: 'Terra nua, primeiros materiais', obras: ['pas_frente', 'lago', 'sede', 'anel'],
    metas: [
      { tipo: 'predio', id: 'carpintaria', txt: 'Construa a Carpintaria' },
      { tipo: 'etapa', id: 'pas_frente.e1', txt: 'Abra o Caminho da Frente' },
      { tipo: 'etapa', id: 'lago.e1', txt: 'Desassoreie o Lago Central' },
      { tipo: 'etapa', id: 'sede.e2', txt: 'Erga o térreo da Sede da Holding' },
      { tipo: 'modulos', faixa: 'anel', qtd: 3, nivel: 2, txt: 'Leve 3 módulos do Anel ao nível 2' },
    ],
    fala: [['iris', 'O Conselho viu a primeira volta do Anel de pé. Aprovado!'], ['tome', 'Agora o canteiro precisa crescer com a obra. Como vamos organizá-lo?']],
    escolha: [
      { id: 'compacto', quem: 'iris', txt: 'Canteiro compacto', ganho: '+4% de bem-estar', custo: '−20 vagas no Almoxarifado', porque: 'Íris prefere: menos caminhões perto da mata.' },
      { id: 'amplo', quem: 'tome', txt: 'Canteiro amplo', ganho: '+40 vagas no Almoxarifado e +3 vagas na fila de cada oficina', custo: '−3% de bem-estar até o epílogo', porque: 'Tomé prefere: estoque folgado e oficinas que trabalham a noite toda.' },
    ] },
  { n: 2, nome: 'Água que corre', sub: 'Lago vivo, praça e escola', obras: ['escola', 'campo', 'praca', 'pas_bulevar', 'pas_anel', 'pas_frente2'],
    metas: [
      { tipo: 'etapa', id: 'lago.e3', txt: 'Conclua a Estação natural de água' },
      { tipo: 'etapa', id: 'escola.e3', txt: 'Entregue a Escola com piscina' },
      { tipo: 'etapa', id: 'campo.e3', txt: 'Ilumine o campo' },
      { tipo: 'etapa', id: 'praca.e2', txt: 'Faça os jardins filtrantes da praça' },
      { tipo: 'etapa', id: 'sede.e3', txt: 'Instale o anel de vidro solar da Sede' },
      { tipo: 'modulos', faixa: 'anel', qtd: 8, nivel: 3, txt: 'Todos os módulos do Anel no nível 3' },
    ],
    fala: [['nara', 'A água do lago já volta limpa para a mata. Os martins-pescadores voltaram.'], ['iris', 'Agora, o coração do campus: a Biblioteca. O que abre primeiro?']],
    escolha: [
      { id: 'biblio24h', quem: 'cida', txt: 'Biblioteca aberta dia e noite', ganho: '+6% de bem-estar', custo: '−1.500 de energia e 3 estantes a mais nos andares de leitura', porque: 'Dona Cida prefere: estudo não tem hora.' },
      { id: 'labs', quem: 'caio', txt: 'Laboratórios primeiro', ganho: 'Laboratório de Campo liberado já; ele e a Oficina Elétrica 25% mais rápidos', custo: 'Dossel da Biblioteca 20% mais caro', porque: 'Caio prefere: pesquisa começa cedo.' },
    ] },
  { n: 3, nome: 'Saber de madeira', sub: 'Biblioteca, faculdades e ciência', obras: ['biblioteca', 'crd', 'humanidades', 'engenharia', 'instituto', 'ciencias', 'onda', 'gramadoUni', 'uniElo', 'pas_ponte', 'ponteCoberta', 'pas_caracol', 'uni', 'anelBib'],
    metas: [
      { tipo: 'etapa', id: 'biblioteca.e5', txt: 'Cubra a Biblioteca com o dossel' },
      { tipo: 'etapa', id: 'crd.e3', txt: 'Acenda o Centro de Recursos Digitais' },
      { tipo: 'etapa', id: 'ciencias.e4', txt: 'Conclua a Faculdade de Ciências' },
      { tipo: 'etapa', id: 'humanidades.e2', txt: 'Termine a Faculdade de Humanidades' },
      { tipo: 'etapa', id: 'engenharia.e2', txt: 'Termine a Faculdade de Engenharia' },
      { tipo: 'etapa', id: 'instituto.e2', txt: 'Termine o Instituto de Estudos Urbanos' },
      { tipo: 'modulos', faixa: 'uni', qtd: 4, nivel: 3, txt: 'Campus Universitário no nível 3' },
      { tipo: 'etapa', id: 'sede.e4', txt: 'Feche a cobertura da Sede' },
    ],
    fala: [['iris', 'O dossel da Biblioteca aparece de qualquer ponto do campus. Lindo.'], ['caio', 'E embaixo da terra cabe um acelerador inteiro. De onde vem a energia?']],
    escolha: [
      { id: 'telhados', quem: 'nara', txt: 'Telhados solares', ganho: '+1.500 de energia e +3% de bem-estar', custo: 'Cada casa pede 1 painel solar a mais no 2º pavimento', porque: 'Nara prefere: nada de perfurar o aquífero.' },
      { id: 'geotermia', quem: 'caio', txt: 'Geotermia profunda', ganho: '+3.000 de energia', custo: 'Centro de Física 30% mais demorado', porque: 'Caio prefere: o calor da terra não acaba.' },
    ] },
  { n: 4, nome: 'Energia escondida', sub: 'Acelerador e Vila Estudantil', obras: ['acelerador', 'anfiteatro', 'pas_vila', 'casas'],
    metas: [
      { tipo: 'etapa', id: 'acelerador.e4', txt: 'Abra o Centro de Física Avançada' },
      { tipo: 'etapa', id: 'anfiteatro.e2', txt: 'Estreie o palco do anfiteatro' },
      { tipo: 'modulos', faixa: 'casas', qtd: 6, nivel: 3, txt: 'Todas as casas da Vila no nível 3' },
      { tipo: 'modulos', faixa: 'anel', qtd: 8, nivel: 5, txt: 'Todos os módulos do Anel no nível 5' },
    ],
    fala: [['caio', 'Primeiro feixe no anel! E a rede de energia aguenta a arcologia inteira.'], ['nara', 'Agora é a vez dos gigantes. Quem chega primeiro ao Santuário?']],
    escolha: [
      { id: 'elefantes', quem: 'nara', txt: 'Elefantes primeiro', ganho: '+4% de bem-estar', custo: 'A cúpula do Bioma espera os elefantes chegarem', porque: 'Nara prefere: a manada está num zoológico fechado.' },
      { id: 'aquario', quem: 'caio', txt: 'Aquário primeiro', ganho: 'A cúpula tem prioridade: Serralheria e Vidraçaria 25% mais rápidas e aquário com 40% menos itens', custo: 'Os elefantes esperam mais no zoológico: −2% de bem-estar', porque: 'Caio prefere: a baleia não pode esperar.' },
    ] },
  { n: 5, nome: 'Casa dos gigantes', sub: 'Santuário, savana, bioma e gorilas', obras: ['santuario', 'santuarioInt', 'savana', 'bioma', 'gorilas', 'pas_trilhaBioma', 'pas_elo', 'pas_santuario'],
    metas: [
      { tipo: 'etapa', id: 'santuarioInt.e2', txt: 'Receba a fauna resgatada no Santuário' },
      { tipo: 'etapa', id: 'savana.e4', txt: 'Complete os habitats da savana' },
      { tipo: 'etapa', id: 'bioma.e4', txt: 'Encha o aquário do Bioma' },
      { tipo: 'etapa', id: 'gorilas.e4', txt: 'Receba a família de gorilas' },
      { tipo: 'modulos', faixa: 'santuario', qtd: 5, nivel: 4, txt: 'Santuário com os quatro pavimentos' },
    ],
    fala: [['nara', 'Os gorilas olham para a passarela com curiosidade. Estão em casa.'], ['iris', 'Falta só o canteiro para a arcologia ficar igual ao projeto. E a água do replantio?']],
    escolha: [
      { id: 'tarifa', quem: 'cida', txt: 'Tarifa social da água', ganho: '+6% de bem-estar', custo: 'A obra paga a água a preço cheio: Replantar a mata custa 30% mais', porque: 'Dona Cida prefere: água limpa para todos, pelo preço justo.' },
      { id: 'aguaObra', quem: 'tome', txt: 'Água para a obra', ganho: 'Horto 20% mais rápido e o replantio 40% mais curto', custo: '−3% de bem-estar', porque: 'Tomé prefere: o replantio pede muita rega.' },
    ] },
  { n: 6, nome: 'Composição total', sub: 'Devolver o canteiro à mata', obras: ['reflorestar'],
    metas: [{ tipo: 'etapa', id: 'reflorestar.e0', txt: 'Desmonte o canteiro' }, { tipo: 'etapa', id: 'reflorestar.e1', txt: 'Replante a mata' }],
    fala: [['iris', 'A composição total da Arcologia de Held está completa. Igual ao projeto do Conselho.'], ['cida', 'Toda cidade começa pequena. Obrigada por construir esta com a gente.']],
    escolha: null },
];

// Efeito de cada escolha, lido na hora pela simulação (nada fica somado no save).
// bem, almox (vagas), fila (vagas em cada oficina), repasse (fração), energia; usina/oficina/xp (fração); oficinas/itens: produção mais rápida;
// custoEtapa/tempoEtapa: fração a mais; itensEtapa: fator nos itens; maisItens: itens a mais na etapa; requer: pré-requisito extra;
// semRequer: prédio sem pré-requisito; modulo: {faixa: {nível: itens a mais}}; ateCap: vale até esse capítulo.
// 'legado:<id>' são as escolhas de saves antigos: o mesmo bônus de antes, sem custo.
export const EFEITOS = {
  compacto: { bonus: { bem: 4 }, custo: { almox: -20 } },
  amplo: { bonus: { almox: 40, fila: 3 }, custo: { bem: -3, ateCap: 6 } },
  biblio24h: { bonus: { bem: 6 }, custo: { energia: -1500, maisItens: { 'biblioteca.e3': { estante: 3 } } } },
  labs: { bonus: { semRequer: { laboratorio: 1 }, oficinas: { eletrica: 0.25, laboratorio: 0.25 } }, custo: { custoEtapa: { 'biblioteca.e5': 0.2 } } },
  geotermia: { bonus: { energia: 3000 }, custo: { tempoEtapa: { 'acelerador.e4': 0.3 } } },
  telhados: { bonus: { energia: 1500, bem: 3 }, custo: { modulo: { casas: { 2: { solar: 1 } } } } },
  elefantes: { bonus: { bem: 4 }, custo: { requer: { 'bioma.e2': ['savana.e3'] } } },
  aquario: { bonus: { itensEtapa: { 'bioma.e4': 0.6 }, oficinas: { serralheria: 0.25, vidracaria: 0.25 } }, custo: { bem: -2 } },
  // o dilema do capítulo 5 pesa no epílogo: o replantio (itens e tempo) e o bem-estar com que a composição termina
  tarifa: { bonus: { bem: 6 }, custo: { custoEtapa: { 'reflorestar.e1': 0.3 } } },
  aguaObra: { bonus: { oficinas: { horto: 0.2 }, tempoEtapa: { 'reflorestar.e1': -0.4 } }, custo: { bem: -3 } },
  'legado:usina+': { bonus: { usina: 0.15 } },
  'legado:almox+': { bonus: { almox: 25 } },
  'legado:repasse+': { bonus: { repasse: 0.15 } },
  'legado:mutirao2': {},
  'legado:oficina+': { bonus: { oficina: 0.15 } },
  'legado:bem+': { bonus: { bem: 5 } },
  'legado:xp+': { bonus: { xp: 0.2 } },
};

// Marcos dentro do capítulo (ao cumprir 1/3 e 2/3 das metas): fala, disposição e créditos
export const MARCOS = {
  1: [['tome', 'O canteiro já produz sem parar. A Holding mandou uma recompensa extra.'], ['iris', 'Falta pouco para a primeira apresentação. O Conselho vai gostar do que vê.']],
  2: [['nara', 'A água já corre limpa até a praça. A comunidade veio ajudar de mutirão.'], ['cida', 'As famílias do Anel perguntam da escola todo dia. Estamos quase lá.']],
  3: [['iris', 'A Biblioteca já aparece por cima das árvores. O campus ganhou um centro.'], ['caio', 'Faculdades quase prontas. Já tem estudante pedindo vaga no laboratório.']],
  4: [['caio', 'O anel do acelerador já tem forma. A Vila está curiosa com o barulho.'], ['cida', 'A Vila Estudantil está quase cheia. Os estudantes chegaram antes das casas.']],
  5: [['nara', 'Os primeiros animais já estão em casa. O Santuário respira.'], ['iris', 'Falta pouco para a arcologia ficar igual ao projeto.']],
};

// Falas curtas disparadas por acontecimentos (cada uma aparece uma vez)
export const DICAS = {
  primeiraColeta: ['tome', 'Os lotes prontos entram sozinhos no Almoxarifado. Se ele lotar, o resto espera no espaço até você coletar.'],
  almoxCheio: ['tome', 'O almoxarifado lotou. Use os materiais nas obras ou amplie com estrados, etiquetas e cadeados.'],
  primeiraEtapa: ['iris', 'Cada placa é uma obra. Na prancha, entregue os materiais aos poucos e inicie quando estiver tudo lá.'],
  obraComecou: ['tome', 'A obra começou. O canteiro trabalha mesmo com o jogo fechado; ao aprovar, a Holding devolve 150% do custo e dá dois aceleradores.'],
  modulo: ['iris', 'Os módulos do Anel crescem um andar por nível, como uma cidade de verdade.'],
  servicoAgua: ['cida', 'Para passar do nível 2, os moradores precisam de água tratada. O lago resolve.'],
  servicoEnergia: ['tome', 'O nível 4 pede energia e saneamento: a fachada solar da Sede e os jardins filtrantes da praça.'],
  servicoSaneamento: ['nara', 'Saneamento vem das plantas: jardins filtrantes, gramados e a bacia do anfiteatro tratam o esgoto.'],
  bemNivel: ['cida', 'O último pavimento pede 70% de bem-estar. Mais gente morando pede mais praça, escola e verde.'],
  licenca: ['iris', 'Obra grande pede topografia. Estacas vêm da madeira, balizas da Serralheria e trenas da Elétrica.'],
  topografo: ['tome', 'Faltou licença? O Topógrafo do Escritório faz uma por vez, em troca de material e créditos.'],
  pedidos: ['cida', 'O quadro de pedidos abriu: os vizinhos pedem materiais e retribuem com créditos, licenças, itens e disposição. A Usina de Pedidos fabrica o que falta.'],
  deposito: ['tome', 'O Depósito de Trocas, no Almoxarifado, vende matéria-prima com estoque que renova a cada 4 horas. E compra sobras pagando 50% acima do preço de compra, até 100 por janela.'],
  bemEstar: ['cida', 'Praças, escola e biblioteca deixam todo mundo mais feliz. Com mais bem-estar, cada morador paga mais por hora: 5, 8 ou 11 créditos.'],
  disposicao: ['cida', 'Cada obra aprovada anima a comunidade. Com a disposição cheia, ganhamos uma ficha de Mutirão.'],
  cadeia: ['tome', 'Dá para encomendar em cadeia: o item espera na fila e puxa os insumos assim que ficarem prontos.'],
};

// Pedidos da comunidade: quem pede, onde mora, a fala e o que pede em cada capítulo.
export const PEDIDOS = [
  { id: 'sato', quem: 'Família Sato', onde: 'Anel, módulo 3', cor: '#e6a15c', fala: 'A reforma do apartamento parou no meio. Faltam umas peças.', grupos: { 2: ['viga', 'deque', 'concreto'], 3: ['trelica', 'painel', 'bloco'], 4: ['estante', 'luminaria', 'duplo'], 5: ['jardim', 'solar', 'guarda'] } },
  { id: 'horta', quem: 'Horta Comunitária', onde: 'borda da Praça', cor: '#7cc48a', fala: 'Vamos plantar nas bordas da praça. Ajuda com mudas?', grupos: { 2: ['grama', 'substrato', 'mudas'], 3: ['muda', 'grama', 'substrato'], 4: ['muda', 'jardim'], 5: ['jardim', 'muda'] } },
  { id: 'marcenaria', quem: 'Oficina de marcenaria', onde: 'Escola e Campus Jovem', cor: '#c98b52', fala: 'A turma do oitavo ano vai montar bancos para o pátio.', grupos: { 2: ['viga', 'madeira', 'deque'], 3: ['deque', 'painel', 'viga'], 4: ['estante', 'luminaria'], 5: ['computador', 'estante'] } },
  { id: 'bicicletas', quem: 'Clube de ciclismo', onde: 'Passeio do Anel', cor: '#6fb0d8', fala: 'Queremos bicicletários cobertos em cada passarela.', grupos: { 2: ['aco', 'viga', 'madeira'], 3: ['perfil', 'aco'], 4: ['guarda', 'conector', 'perfil'], 5: ['conector', 'perfil', 'guarda'] } },
  { id: 'gremio', quem: 'Grêmio de Ciências', onde: 'Faculdade de Ciências', cor: '#a58be0', fala: 'O laboratório de estudantes precisa de equipamento.', grupos: { 3: ['fiacao', 'painel', 'conector'], 4: ['sensor', 'fiacao', 'kitlab'], 5: ['kitlab', 'sensor', 'computador'] } },
  { id: 'vila', quem: 'Moradores da Vila', onde: 'Vila Estudantil', cor: '#e39a7a', fala: 'As casas novas ainda estão sem varanda.', grupos: { 4: ['deque', 'painel', 'bloco'], 5: ['solar', 'jardim', 'duplo'] } },
  { id: 'vet', quem: 'Equipe veterinária', onde: 'Santuário', cor: '#5fb3a0', fala: 'Chegaram mais animais do que esperávamos.', grupos: { 5: ['racao', 'kitvet', 'substrato'] } },
  { id: 'feira', quem: 'Feira de sábado', onde: 'Praça Central', cor: '#d9b44a', fala: 'Os feirantes querem matéria-prima para as barracas.', grupos: { 2: ['madeira', 'brita', 'argila'], 3: ['aco', 'vidro', 'argila'], 4: ['vidro', 'cobre', 'fibra'], 5: ['cobre', 'fibra', 'vidro'] } },
];

// Uma fala por etapa, do conselheiro da área, dita pouco depois do carimbo de aprovação.
export const FALAS_ETAPA = {
  'pas_frente.e1': ['tome', 'O caminho já leva os caminhões até a praça sem cortar uma raiz. Bom começo.'],
  'lago.e1': ['nara', 'A água voltou a correr para o lago. Agora dá para abastecer os primeiros moradores.'],
  'lago.e2': ['nara', 'Os juncos já seguram as margens. Vi uma garça pousar na ilha hoje cedo.'],
  'lago.e3': ['nara', 'As ilhas flutuantes filtram a água sem química nenhuma. O lago trata a si mesmo.'],
  'sede.e1': ['tome', 'Fundações da Sede no lugar. Cortamos só o terreno que precisava.'],
  'sede.e2': ['iris', 'A Sede já recolhe a renda que os moradores pagam por hora. Toque nas moedas para coletar.'],
  'sede.e3': ['tome', 'Cada placa de vidro dessa fachada gera energia. A Sede virou usina.'],
  'sede.e4': ['iris', 'Cobertura verde e pátio prontos. A Sede está igual ao projeto do Conselho.'],
  'escola.e1': ['cida', 'As salas olham para o pátio. As crianças vão estudar vendo árvore, não muro.'],
  'escola.e2': ['cida', 'Os parquinhos já estão cheios. Barulho bom de ouvir.'],
  'escola.e3': ['cida', 'Piscina aberta! A aula de natação começa segunda.'],
  'campo.e1': ['tome', 'Terreno nivelado e drenado. A chuva agora corre para o lago, não para o campo.'],
  'campo.e2': ['nara', 'Grama nativa: aguenta pisão e seca sem pedir irrigação.'],
  'campo.e3': ['cida', 'Luz no campo! O primeiro jogo da noite já tem torcida.'],
  'praca.e1': ['cida', 'Piso claro e drenante na praça. Já tem gente sentada no meio-fio.'],
  'praca.e2': ['nara', 'Os espelhos d’água são jardins que limpam o esgoto. Ninguém diria.'],
  'praca.e3': ['cida', 'Palmeiras, bancos e luz: a praça virou o ponto de encontro da arcologia.'],
  'pas_bulevar.e1': ['tome', 'O Bulevar passa por cima do jardim sem pisar em nada. Leve como deve ser.'],
  'pas_anel.e1': ['nara', 'O Passeio do Anel contorna a mata sem tocar nas raízes. Promessa cumprida.'],
  'pas_frente2.e1': ['tome', 'A Fita da Frente passa por cima do caminho antigo. Dois níveis, nenhuma árvore cortada.'],
  'biblioteca.e1': ['iris', 'O núcleo da Biblioteca está de pé: escadas e elevadores no concreto, o resto em madeira.'],
  'biblioteca.e2': ['iris', 'Três andares de leitura com estantes iluminadas. O cheiro de madeira é ótimo.'],
  'biblioteca.e3': ['tome', 'Seis andares em madeira laminada. É a torre de madeira mais alta do campus.'],
  'biblioteca.e4': ['tome', 'Os pilares-árvore se abrem em V e seguram o dossel como galhos seguram a copa.'],
  'biblioteca.e5': ['iris', 'O dossel está no lugar. É a imagem que o projeto do Conselho mostra.'],
  'crd.e1': ['caio', 'Os laboratórios digitais já têm energia e rede. Falta o telhado em onda.'],
  'crd.e2': ['tome', 'As costelas da abóbada vieram inteiras da Carpintaria. Encaixe perfeito.'],
  'crd.e3': ['caio', 'Computadores ligados no Centro de Recursos Digitais. A rede da arcologia acordou.'],
  'humanidades.e1': ['cida', 'A Faculdade de Humanidades acompanha a curva do Anel. Parece que sempre esteve ali.'],
  'humanidades.e2': ['cida', 'Ateliês abertos e esculturas no terraço. Já tem exposição marcada.'],
  'engenharia.e1': ['tome', 'Laboratórios de engenharia no térreo. Vão testar os nossos próprios materiais.'],
  'engenharia.e2': ['caio', 'Painéis solares na cobertura: a faculdade produz mais energia do que gasta.'],
  'instituto.e1': ['cida', 'O Instituto de Estudos Urbanos vai estudar a própria arcologia. Justo.'],
  'instituto.e2': ['nara', 'Jardins verticais nos pavimentos altos. Os pássaros já descobriram.'],
  'ciencias.e1': ['caio', 'A Faculdade de Ciências flutua sobre pilotis. A água da chuva passa por baixo.'],
  'ciencias.e2': ['caio', 'Bancadas de biotecnologia montadas. Já dá para construir o Laboratório de Campo.'],
  'ciencias.e3': ['iris', 'As bandas brancas estão no lugar. É a assinatura da faculdade.'],
  'ciencias.e4': ['caio', 'Vidro recuado e fachada em corte: de fora dá para ver os laboratórios trabalhando.'],
  'onda.e1': ['iris', 'A fita em S liga o Campus Universitário à Ciência. Uma ala só, sem emendas.'],
  'onda.e2': ['nara', 'Terraços verdes em recuo na Ala em Onda. Mais chão para as plantas do que para o prédio.'],
  'gramadoUni.e1': ['nara', 'O gramado do campus segura a chuva e trata a água que escorre. Grama que trabalha.'],
  'uniElo.e1': ['tome', 'O Elo Norte é um prédio-ponte: liga o Anel ao Campus por cima da mata.'],
  'uniElo.e2': ['nara', 'Terraço-jardim no Elo Norte. Mais um corredor verde para os bichos.'],
  'pas_ponte.e1': ['tome', 'A Ponte do Instituto cruza o jardim com pilares finos e vão longo. Quase não faz sombra.'],
  'pas_caracol.e1': ['cida', 'O Caracol não tem degrau nenhum. Cadeira de rodas e carrinho de bebê sobem sem ajuda.'],
  'ponteCoberta.e1': ['tome', 'Pilares finos entre a Ciência e a Biblioteca. Amanhã chega o tubo de vidro.'],
  'ponteCoberta.e2': ['cida', 'Agora dá para ir da Ciência à Biblioteca na chuva sem guarda-chuva.'],
  'acelerador.e1': ['caio', 'O poço está aberto e contido. Lá embaixo cabe um anel de partículas.'],
  'acelerador.e2': ['caio', 'Túnel fechado e ímãs no lugar. O anel do acelerador está completo.'],
  'acelerador.e3': ['caio', 'Detectores ligados. Primeiro feixe hoje à noite!'],
  'acelerador.e4': ['caio', 'O Centro de Física Avançada abriu as portas. E a central geotérmica já ajuda a rede.'],
  'anfiteatro.e1': ['nara', 'As arquibancadas escondem uma bacia que guarda a chuva. O anfiteatro também é cisterna.'],
  'anfiteatro.e2': ['cida', 'Palco pronto! A Vila já marcou a primeira noite de música.'],
  'pas_vila.e1': ['tome', 'A Passarela da Vila vai da Biblioteca às casas por cima da mata. Nenhum galho no caminho.'],
  'santuarioInt.e1': ['nara', 'Clareiras e mirantes prontos. O biodigestor transforma resíduo em energia.'],
  'santuarioInt.e2': ['nara', 'Os primeiros animais resgatados chegaram ao Santuário. Estão calmos.'],
  'savana.e1': ['nara', 'Cercas de madeira e trilhas de cascalho. A savana está pronta para receber.'],
  'savana.e2': ['nara', 'Lagoa, abrigos de sombra e acácias. Parece que a savana sempre esteve ali.'],
  'savana.e3': ['nara', 'A manada de elefantes chegou! A mais velha foi direto para a lagoa.'],
  'savana.e4': ['nara', 'Girafas e rinocerontes no habitat. A savana está completa.'],
  'bioma.e1': ['caio', 'Fundação e tanque do Bioma prontos. A areia veio da própria escavação.'],
  'bioma.e2': ['tome', 'Milhares de barras e nós: a cúpula geodésica está fechada. Nenhuma peça igual à outra.'],
  'bioma.e3': ['tome', 'Cada triângulo tem seu painel. A cúpula brilha até de dia.'],
  'bioma.e4': ['nara', 'A baleia nadou a primeira volta no aquário. Quase choramos aqui.'],
  'gorilas.e1': ['nara', 'Rochedos de arenito e o fosso prontos. Nada de grade.'],
  'gorilas.e2': ['tome', 'A passarela anelar tem vidro para ver sem incomodar. Os gorilas nem vão notar.'],
  'gorilas.e3': ['nara', 'Abrigo e árvores no recinto. Sombra e esconderijo para quem precisar.'],
  'gorilas.e4': ['nara', 'A família de gorilas chegou. Olha o tamanho deles!'],
  'pas_trilhaBioma.e1': ['nara', 'A trilha contorna a cúpula e desce até os gorilas. Passeio de uma tarde inteira.'],
  'pas_elo.e1': ['tome', 'O Elo do Santuário liga a savana ao anel de pesquisa. Os veterinários agradecem.'],
  'pas_santuario.e1': ['nara', 'Um mirante contínuo sobre a mata do santuário. Dá para ver os elefantes lá de cima.'],
  'reflorestar.e0': ['tome', 'As oficinas já estão nos galpões sob o acelerador. O canteiro ficou vazio.'],
  'reflorestar.e1': ['nara', 'Mudas no chão onde era o canteiro. Em dez anos ninguém vai saber que houve obra aqui.'],
};

// Epílogo: o Conselho lembra das escolhas feitas pelo caminho
export const EPILOGO = {
  compacto: ['iris', 'O canteiro compacto poupou a mata a obra inteira. Valeu cada vaga a menos.'],
  amplo: ['tome', 'O canteiro amplo aguentou a obra inteira. Agora a mata ocupa cada metro dele.'],
  biblio24h: ['cida', 'A Biblioteca aberta dia e noite virou a sala de estar da arcologia.'],
  labs: ['caio', 'Os laboratórios que abriram primeiro já publicaram três pesquisas sobre a fauna.'],
  geotermia: ['caio', 'A geotermia profunda aquece a água de toda a arcologia. Sem fumaça.'],
  telhados: ['nara', 'Os telhados solares da Vila deixaram o céu limpo. Deu trabalho, deu certo.'],
  elefantes: ['nara', 'A manada chegou primeiro e ensinou aos outros o caminho da lagoa.'],
  aquario: ['caio', 'O aquário abriu primeiro e a baleia já tem nome: Held.'],
  tarifa: ['cida', 'A tarifa social valeu cada centavo. Ninguém ficou sem água na arcologia.'],
  aguaObra: ['tome', 'O Horto regou o replantio inteiro sem faltar água. A mata pegou rápido.'],
};

// nomes do que cada capítulo abre (projetos que não existem nesta versão ficam de fora) e o texto pronto de cada
// escolha (dica = ganho, custo e quem prefere, para quem mostra uma linha só)
for (const c of CAPITULOS) {
  c.obras = c.obras.filter((id) => PROJ[id] || MODULOS[id]); c.abre = c.obras.map((id) => PROJ[id]?.nome || MODULOS[id].nome);
  for (const o of c.escolha || []) o.dica = `${o.ganho}. Custo: ${o.custo}. ${o.porque}`;
}
