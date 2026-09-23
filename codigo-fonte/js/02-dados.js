/* =========================================================
   02 · dados: itens, receitas, construções, níveis, metas
   ========================================================= */

/* ---------------- itens ---------------- */
// matérias-primas (fábricas): qualquer fábrica produz qualquer uma já liberada
const ITEMS = {
  ligas:    { name: 'Ligas metálicas', short: 'Ligas',    time: 20,  val: 10,  unlock: 1,  color: '#C3CDDF', ic: 'ligas', raw: true },
  bambu:    { name: 'Bambu laminado',  short: 'Bambu',    time: 45,  val: 20,  unlock: 2,  color: '#C9B97A', ic: 'bambu', raw: true },
  polimero: { name: 'Polímero verde',  short: 'Polímero', time: 90,  val: 35,  unlock: 3,  color: '#86DB91', ic: 'polimero', raw: true },
  sementes: { name: 'Sementes',        short: 'Sementes', time: 150, val: 45,  unlock: 5,  color: '#E0C36B', ic: 'sementes', raw: true },
  minerais: { name: 'Minerais',        short: 'Minerais', time: 240, val: 70,  unlock: 7,  color: '#B8A7D9', ic: 'minerais', raw: true },
  vidro:    { name: 'Vidro solar',     short: 'Vidro',    time: 300, val: 90,  unlock: 8,  color: '#9FD9F2', ic: 'vidro', raw: true },
  quimicos: { name: 'Bioquímicos',     short: 'Químicos', time: 420, val: 120, unlock: 10, color: '#F29FD7', ic: 'quimicos', raw: true },
  fibras:   { name: 'Fibras têxteis',  short: 'Fibras',   time: 600, val: 160, unlock: 12, color: '#F2C9A0', ic: 'fibras', raw: true },
  // produtos das lojas (loja: quem fabrica; in: insumos)
  vigas:    { name: 'Vigas',           short: 'Vigas',    time: 60,  val: 90,  loja: 'loja1', in: { ligas: 2 }, color: '#D9DEE8', ic: 'vigas' },
  paineis:  { name: 'Painéis',         short: 'Painéis',  time: 90,  val: 150, loja: 'loja1', in: { bambu: 2 }, color: '#D8C48C', ic: 'paineis' },
  tijolos:  { name: 'Tijolos ecológicos', short: 'Tijolos', time: 180, val: 220, loja: 'loja1', in: { minerais: 2 }, color: '#E0917A', ic: 'tijolos' },
  cimento:  { name: 'Cimento verde',   short: 'Cimento',  time: 300, val: 440, loja: 'loja1', in: { minerais: 2, quimicos: 1 }, color: '#B9C2C9', ic: 'cimento' },
  cola:     { name: 'Cola biológica',  short: 'Cola',     time: 360, val: 480, loja: 'loja1', in: { polimero: 1, quimicos: 2 }, color: '#F2E38A', ic: 'cola' },
  tinta:    { name: 'Tinta viva',      short: 'Tinta',    time: 420, val: 560, loja: 'loja1', in: { ligas: 2, minerais: 1, quimicos: 2 }, color: '#F28C8C', ic: 'tinta' },
  martelo:  { name: 'Martelo',         short: 'Martelo',  time: 90,  val: 110, loja: 'loja2', in: { ligas: 1, bambu: 1 }, color: '#D0B090', ic: 'martelo' },
  fita:     { name: 'Fita métrica',    short: 'Fita',     time: 120, val: 130, loja: 'loja2', in: { ligas: 1, polimero: 1 }, color: '#F2D66B', ic: 'fita' },
  pa:       { name: 'Pá',              short: 'Pá',       time: 240, val: 200, loja: 'loja2', in: { ligas: 1, bambu: 1, polimero: 1 }, color: '#C8A97E', ic: 'pa' },
  utensilios: { name: 'Utensílios',    short: 'Utensílios', time: 360, val: 300, loja: 'loja2', in: { ligas: 2, bambu: 2, polimero: 2 }, color: '#E6E6E6', ic: 'utensilios' },
  furadeira: { name: 'Furadeira',      short: 'Furadeira', time: 480, val: 420, loja: 'loja2', in: { ligas: 2, polimero: 1, vidro: 1 }, color: '#8FD0FF', ic: 'furadeira' },
  vegetais: { name: 'Vegetais',        short: 'Vegetais', time: 120, val: 160, loja: 'loja3', in: { sementes: 2 }, color: '#7FD97A', ic: 'vegetais' },
  mudas:    { name: 'Mudas nativas',   short: 'Mudas',    time: 200, val: 240, loja: 'loja3', in: { sementes: 1, polimero: 1, bambu: 1 }, color: '#5FC98F', ic: 'mudas' },
  frutas:   { name: 'Frutas',          short: 'Frutas',   time: 480, val: 360, loja: 'loja3', in: { sementes: 2, bambu: 1 }, color: '#F2A05B', ic: 'frutas' },
  farinha:  { name: 'Farinha',         short: 'Farinha',  time: 300, val: 570, loja: 'loja3', in: { sementes: 2, fibras: 2 }, color: '#F2E9D8', ic: 'farinha' },
  cadeiras: { name: 'Cadeiras',        short: 'Cadeiras', time: 240, val: 300, loja: 'loja4', in: { bambu: 2, ligas: 1, martelo: 1 }, color: '#D2A679', ic: 'cadeiras' },
  luminaria: { name: 'Luminária',      short: 'Luminária', time: 360, val: 380, loja: 'loja4', in: { ligas: 2, vidro: 1, polimero: 1 }, color: '#FFE08A', ic: 'luminaria' },
  mesa:     { name: 'Mesa',            short: 'Mesa',     time: 420, val: 500, loja: 'loja4', in: { paineis: 1, vidro: 2, martelo: 1 }, color: '#C99A6B', ic: 'mesa' },
  tapete:   { name: 'Tapete',          short: 'Tapete',   time: 480, val: 560, loja: 'loja4', in: { fibras: 2, cola: 1 }, color: '#D98CB3', ic: 'tapete' },
  chips:    { name: 'Nanochips',       short: 'Chips',    time: 300, val: 320, loja: 'loja5', in: { ligas: 2, polimero: 1, vidro: 1 }, color: '#94BCFF', ic: 'chips' },
  sensores: { name: 'Sensores',        short: 'Sensores', time: 480, val: 620, loja: 'loja5', in: { chips: 1, vidro: 1, fibras: 1 }, color: '#B5F2E8', ic: 'sensores' },
  drones:   { name: 'Drones',          short: 'Drones',   time: 720, val: 900, loja: 'loja5', in: { chips: 2, ligas: 2, polimero: 1 }, color: '#DDE3FF', ic: 'drones' },
};
for (const k in ITEMS) ITEMS[k].id = k;
const RAW = Object.keys(ITEMS).filter(k => ITEMS[k].raw);

/* ---------------- categorias e construções ---------------- */
const CATS = [
  { id: 'res', name: 'Moradias', ic: 'home' },
  { id: 'fab', name: 'Fábricas', ic: 'factory' },
  { id: 'loja', name: 'Lojas', ic: 'shop' },
  { id: 'ener', name: 'Energia', ic: 'bolt' },
  { id: 'agua', name: 'Água', ic: 'drop' },
  { id: 'rec', name: 'Reciclagem', ic: 'recycle' },
  { id: 'seg', name: 'Segurança', ic: 'shield' },
  { id: 'sau', name: 'Saúde', ic: 'health' },
  { id: 'edu', name: 'Educação', ic: 'book' },
  { id: 'par', name: 'Parques', ic: 'tree' },
  { id: 'tra', name: 'Transporte', ic: 'road' },
  { id: 'mega', name: 'Marcos', ic: 'star' },
];
const CAT_NAME = {}; for (const c of CATS) CAT_NAME[c.id] = c.name;

// estágios da zona residencial (todas 3x2): imagem, população, tempo da obra de melhoria (s)
const RES_STAGES = [
  { img: 'res1', name: 'Vila Estudantil', pop: 80,   up: 6,  desc: 'Blocos brancos ao redor do anfiteatro. A primeira morada dos novos habitantes.' },
  { img: 'res2', name: 'Blocos de Engenharia', pop: 180, up: 10, desc: 'Quarteirões brancos entre as vias curvas, com terraços verdes.' },
  { img: 'res3', name: 'Terraços do Anel', pop: 320, up: 14, desc: 'Um trecho do anel residencial, com terraços iluminados sobre o bosque.' },
  { img: 'res4', name: 'Curva Iluminada', pop: 520, up: 18, desc: 'Torre curva envidraçada, com salões acesos e passarelas.' },
  { img: 'res5', name: 'Curva do Lago', pop: 780, up: 22, desc: 'A torre curva de frente para o espelho d’água, com jardins nos terraços.' },
  { img: 'res6', name: 'Torre Espiral', pop: 1100, up: 26, desc: 'A torre em espiral no meio dos anéis: o endereço mais desejado da arcologia.' },
  { img: 'res7', name: 'Anel Residencial', pop: 1500, up: 30, desc: 'Fachada inteira do grande anel iluminado. Milhares de moradores num só trecho.' },
];
const RES_MAX = RES_STAGES.length;
// orçamento (em § de valor de itens) de cada melhoria: do estágio i para i+1
const RES_BUDGET = [110, 260, 560, 1050, 1900, 3200];
const RES_ITEMS_N = [2, 2, 3, 3, 4, 4];

const TYPES = {
  // ---- sede (prefeitura) ----
  sede: { name: 'Sede da Holding Guarda-Chuva', cat: 'mega', w: 5, h: 2, unique: true, catalog: false, noDemolish: true, noMove: true, full: 'sedeFull', tag: 'Sede',
    desc: 'O anel de vidro que coordena toda a arcologia. Aqui você coleta os impostos, expande o terreno e o armazém.' },

  // ---- moradias ----
  zona: { name: 'Zona Residencial', cat: 'res', w: 3, h: 2, cost: 250, unlock: 1, time: 12, xp: 10, res: true,
    desc: 'Uma zona residencial começa como Vila Estudantil e evolui por 7 estágios conforme você entrega os itens pedidos.' },

  // ---- fábricas (matérias-primas) ----
  fab1: { name: 'Fábrica Subterrânea', cat: 'fab', w: 3, h: 2, cost: 400, unlock: 1, time: 15, xp: 15, slots: 2, useP: 8, useW: 4, useR: 6, traffic: 3,
    desc: 'O acelerador subterrâneo e seu centro de física: a primeira linha de produção de matérias-primas. 2 vagas na fila.' },
  fab2: { name: 'Laboratório de Materiais', cat: 'fab', w: 3, h: 2, cost: 2400, unlock: 4, time: 30, xp: 60, slots: 3, useP: 14, useW: 8, useR: 10, traffic: 4,
    desc: 'Laboratórios abertos em corte dentro do anel. 3 vagas na fila de produção.' },
  fab3: { name: 'Complexo de Laboratórios', cat: 'fab', w: 4, h: 2, cost: 9000, unlock: 8, time: 45, xp: 160, slots: 4, useP: 24, useW: 12, useR: 16, traffic: 6,
    desc: 'O trecho inteiro do anel de laboratórios. 4 vagas na fila de produção.' },
  fab4: { name: 'Superlaboratório', cat: 'fab', w: 3, h: 2, cost: 30000, unlock: 13, time: 60, xp: 400, slots: 5, useP: 40, useW: 16, useR: 20, traffic: 6, boost: 1.25,
    desc: 'O superlaboratório em corte da Arcologia Circular. 5 vagas e produção 25% mais rápida.' },

  // ---- lojas (produtos) ----
  loja1: { name: 'Oficina de Estruturas', cat: 'loja', w: 3, h: 2, cost: 900, unlock: 2, time: 20, xp: 30, slots: 3, useP: 6, useW: 3, useR: 4, traffic: 3,
    desc: 'Vigas, painéis, tijolos, cimento, cola e tinta: tudo o que uma moradia precisa para crescer.' },
  loja2: { name: 'Loja de Ferragens', cat: 'loja', w: 3, h: 2, cost: 1800, unlock: 3, time: 25, xp: 45, slots: 3, useP: 6, useW: 3, useR: 4, traffic: 3,
    desc: 'Ferramentas na praça da passarela: martelo, fita, pá, utensílios e furadeira.' },
  loja3: { name: 'Mercado Agroflorestal', cat: 'loja', w: 3, h: 2, cost: 4200, unlock: 5, time: 30, xp: 80, slots: 3, useP: 8, useW: 10, useR: 6, traffic: 4,
    desc: 'Estufa em degraus com painéis solares. Vegetais, mudas, frutas e farinha.' },
  loja4: { name: 'Bioestúdio de Design', cat: 'loja', w: 3, h: 2, cost: 8500, unlock: 7, time: 35, xp: 130, slots: 4, useP: 10, useW: 4, useR: 5, traffic: 4,
    desc: 'A fachada iluminada do anel abriga o estúdio de móveis: cadeiras, luminárias, mesas e tapetes.' },
  loja5: { name: 'Laboratório de Nanochips', cat: 'loja', w: 4, h: 2, cost: 22000, unlock: 10, time: 45, xp: 260, slots: 4, useP: 30, useW: 8, useR: 8, traffic: 5,
    desc: 'Biotecnologia e nanotecnologia num prédio de vidro ondulado. Nanochips, sensores e drones.' },

  // ---- energia ----
  ener1: { name: 'Parque Eólico', cat: 'ener', w: 3, h: 2, cost: 500, unlock: 1, time: 12, xp: 12, power: 80, traffic: 1,
    desc: 'Turbinas eólicas e painéis nas coberturas. Energia limpa para o começo da cidade.' },
  ener2: { name: 'Usina Solar Flor', cat: 'ener', w: 4, h: 2, cost: 3600, unlock: 4, time: 30, xp: 70, power: 320, traffic: 2,
    desc: 'Telhados em forma de flor cobertos de painéis solares.' },
  ener3: { name: 'Torre Bioclimática', cat: 'ener', w: 4, h: 2, cost: 24000, keys: 6, unlock: 9, time: 60, xp: 300, power: 1200, traffic: 3,
    desc: 'Cobertura de vidro em pétalas, turbinas e painéis nos terraços. Energia em grande escala.' },

  // ---- água ----
  agua1: { name: 'Lago das Fontes', cat: 'agua', w: 2, h: 1, cost: 400, unlock: 1, time: 10, xp: 10, water: 80, traffic: 1,
    desc: 'A praça com o lago das fontes também abastece a cidade com água tratada.' },
  agua2: { name: 'Reservatório do Vale', cat: 'agua', w: 2, h: 1, cost: 3200, unlock: 4, time: 25, xp: 60, water: 320, traffic: 1,
    desc: 'Lago natural entre árvores e passarelas, com estação de bombeamento.' },
  agua3: { name: 'Anel das Águas', cat: 'agua', w: 3, h: 1, cost: 22000, keys: 6, unlock: 9, time: 60, xp: 280, water: 1200, traffic: 2,
    desc: 'O anel administrativo com o grande lago interno que funciona como reservatório.' },

  // ---- reciclagem (resíduos) ----
  rec1: { name: 'Estação de Reciclagem', cat: 'rec', w: 2, h: 2, cost: 700, unlock: 3, time: 15, xp: 20, waste: 90, useP: 4, traffic: 2,
    desc: 'Tanque circular e pavilhão de triagem. Sem reciclagem, o lixo se acumula e a felicidade cai.' },
  rec2: { name: 'Central de Reciclagem', cat: 'rec', w: 3, h: 2, cost: 5200, unlock: 7, time: 35, xp: 90, waste: 360, useP: 10, traffic: 3,
    desc: 'A ponta do anel de laboratórios convertida em central de reciclagem de alto volume.' },
  rec3: { name: 'Instituto de Economia Circular', cat: 'rec', w: 4, h: 2, cost: 26000, unlock: 13, time: 60, xp: 300, waste: 1300, useP: 24, traffic: 3,
    desc: 'O anel superior e seu campus: pesquisa e processamento de resíduos em escala de cidade.' },

  // ---- segurança (cobertura) ----
  seg1: { name: 'Posto de Vigilância', cat: 'seg', w: 2, h: 2, cost: 800, unlock: 2, time: 15, xp: 20, cov: 'seg', radius: 6, useP: 3, useW: 1, traffic: 2,
    desc: 'A torre de controle vigia as ruas em volta. Moradias cobertas ficam mais tranquilas.' },
  seg2: { name: 'Central de Segurança', cat: 'seg', w: 3, h: 2, cost: 6500, unlock: 6, time: 35, xp: 110, cov: 'seg', radius: 10, useP: 8, useW: 3, traffic: 3,
    desc: 'A praça da passarela concentra o comando de segurança de toda a arcologia.' },

  // ---- saúde (cobertura) ----
  sau1: { name: 'Clínica Cúpula', cat: 'sau', w: 3, h: 2, cost: 1400, unlock: 3, time: 20, xp: 35, cov: 'sau', radius: 6, useP: 4, useW: 3, traffic: 2,
    desc: 'A pequena cúpula de vidro abriga a clínica do bairro.' },
  sau2: { name: 'Centro de Reabilitação', cat: 'sau', w: 3, h: 2, cost: 7200, unlock: 7, time: 35, xp: 120, cov: 'sau', radius: 9, useP: 8, useW: 6, traffic: 3,
    desc: 'Piscinas terapêuticas nos terraços do anel. Cobre um raio maior.' },
  sau3: { name: 'Hospital das Ondas', cat: 'sau', w: 3, h: 2, cost: 26000, keys: 8, unlock: 11, time: 60, xp: 320, cov: 'sau', radius: 14, useP: 26, useW: 12, traffic: 4,
    desc: 'As torres brancas onduladas: o hospital central da arcologia.' },

  // ---- educação (cobertura) ----
  edu1: { name: 'Escola Primária', cat: 'edu', w: 3, h: 2, cost: 1100, unlock: 2, time: 18, xp: 30, cov: 'edu', radius: 5, useP: 3, useW: 2, traffic: 3,
    desc: 'Parquinhos e salas nos terraços verdes. Educação aumenta a felicidade e os impostos.' },
  edu2: { name: 'Escola e Campus Jovem', cat: 'edu', w: 3, h: 2, cost: 5600, unlock: 5, time: 30, xp: 100, cov: 'edu', radius: 8, useP: 8, useW: 6, traffic: 4,
    desc: 'Escola e campus para jovens de 10 a 17 anos, com campo de futebol e quadras.' },
  edu3: { name: 'Biblioteca Central', cat: 'edu', w: 2, h: 2, cost: 9800, unlock: 8, time: 40, xp: 160, cov: 'edu', radius: 7, joy: 0.06, useP: 6, useW: 2, traffic: 2,
    desc: 'Biblioteca Central e Centro de Recursos Digitais da ARC, em treliça de madeira e vidro.' },
  edu4: { name: 'Campus Universitário', cat: 'edu', w: 4, h: 2, cost: 30000, keys: 8, unlock: 11, time: 60, xp: 350, cov: 'edu', radius: 13, useP: 20, useW: 10, traffic: 5,
    desc: 'O anel do campus com seu campo interno. Educação superior para toda a arcologia.' },

  // ---- parques e bem-estar (felicidade por raio) ----
  par1: { name: 'Praça das Fontes', cat: 'par', w: 2, h: 1, cost: 300, unlock: 1, time: 8, xp: 8, cov: 'par', radius: 4, joy: 0.06,
    desc: 'Espelho d’água e bancos entre as árvores. Quem mora perto fica um pouco mais feliz.' },
  par2: { name: 'Campo Esportivo', cat: 'par', w: 2, h: 1, cost: 700, unlock: 2, time: 10, xp: 15, cov: 'par', radius: 4, joy: 0.08,
    desc: 'Campo de futebol com parquinho de dinossauros ao lado.' },
  par3: { name: 'Anfiteatro', cat: 'par', w: 3, h: 2, cost: 1600, unlock: 3, time: 15, xp: 30, cov: 'par', radius: 5, joy: 0.1,
    desc: 'Arquibancadas verdes ao pé da biblioteca. Shows e aulas ao ar livre.' },
  par4: { name: 'Santuário de Primatas', cat: 'par', w: 2, h: 1, cost: 2200, unlock: 4, time: 18, xp: 40, cov: 'par', radius: 5, joy: 0.12, useW: 3,
    desc: 'O recinto circular dos gorilas e chimpanzés.' },
  par5: { name: 'Lago dos Hipopótamos', cat: 'par', w: 2, h: 1, cost: 3200, unlock: 5, time: 20, xp: 55, cov: 'par', radius: 5, joy: 0.13, useW: 6,
    desc: 'Passarelas sobre o lago onde os hipopótamos descansam.' },
  par6: { name: 'Bosque das Trilhas', cat: 'par', w: 3, h: 2, cost: 4800, unlock: 6, time: 24, xp: 75, cov: 'par', radius: 6, joy: 0.15,
    desc: 'Trilhas iluminadas por dentro da mata. Silêncio e ar puro.' },
  par7: { name: 'Bosque do Lago', cat: 'par', w: 3, h: 2, cost: 6500, unlock: 7, time: 26, xp: 95, cov: 'par', radius: 6, joy: 0.16,
    desc: 'Mata fechada à beira do espelho d’água da Arcologia Circular.' },
  par8: { name: 'Zona dos Grandes Felinos', cat: 'par', w: 3, h: 2, cost: 9000, keys: 3, unlock: 8, time: 30, xp: 120, cov: 'par', radius: 7, joy: 0.18, useW: 4,
    desc: 'Leões e tigres entre as rochas, na ponta do anel do santuário.' },
  par9: { name: 'Aviário Vertical', cat: 'par', w: 2, h: 2, cost: 12000, keys: 4, unlock: 9, time: 35, xp: 150, cov: 'par', radius: 7, joy: 0.2, useW: 4,
    desc: 'Torres de tela com árvores inteiras dentro: um jardim vertical cheio de aves.' },
  par10: { name: 'Bioma Aquático', cat: 'par', w: 3, h: 2, cost: 18000, keys: 6, unlock: 11, time: 45, xp: 220, cov: 'par', radius: 8, joy: 0.24, useP: 12, useW: 14,
    desc: 'Cúpula geodésica com um oceano em miniatura para conservação da vida aquática.' },
  par11: { name: 'Savana dos Elefantes', cat: 'par', w: 4, h: 2, cost: 26000, keys: 8, unlock: 12, time: 50, xp: 300, cov: 'par', radius: 9, joy: 0.28, useW: 12,
    desc: 'Bioma savana com elefantes, girafas e rinocerontes entre acácias e lagos.' },
  par12: { name: 'Reserva do Anel', cat: 'par', w: 4, h: 1, cost: 32000, keys: 8, unlock: 14, time: 50, xp: 320, cov: 'par', radius: 10, joy: 0.3,
    desc: 'Mata preservada dentro do anel, com lago e mirantes.' },

  // ---- transporte e comércio ----
  tra1: { name: 'Terminal de Cargas', cat: 'tra', w: 3, h: 2, cost: 2000, unlock: 4, time: 25, xp: 60, unique: true, cargo: true, useP: 6, traffic: 4,
    desc: 'O trevo de viadutos por onde chegam as encomendas. Entregue os pedidos para ganhar chaves e peças de expansão.' },
  tra2: { name: 'Estação Transit', cat: 'tra', w: 2, h: 1, cost: 3000, unlock: 6, time: 20, xp: 50, transit: 14, radius: 7, useP: 4,
    desc: 'Passarelas e ônibus elétricos. Aumenta a capacidade das ruas em volta e reduz o trânsito.' },
  mer1: { name: 'Torre do Comércio Global', cat: 'tra', w: 3, h: 2, cost: 1500, unlock: 3, time: 25, xp: 60, unique: true, market: true, useP: 8, traffic: 4,
    desc: 'A torre em degraus no meio do lago. Abre o Mercado Global para comprar itens de outras cidades.' },

  // ---- marcos (megaestruturas) ----
  arco: { name: 'Arco da Holding', cat: 'mega', tag: 'Marco', w: 4, h: 2, cost: 40000, keys: 10, unlock: 10, time: 90, xp: 500, cov: 'par', radius: 9, joy: 0.2, taxBoost: 0.1, useP: 40, useW: 20, traffic: 4,
    desc: 'O arco de vidro da Sede sobre o anel. +10% em impostos e felicidade em volta.' },
  arcoCirc: { name: 'Arcologia Circular', tag: 'Modelo-01', cat: 'mega', w: 7, h: 3, cost: 120000, keys: 16, unlock: 12, time: 150, xp: 1200, full: 'arcoCircFull', items: { vigas: 6, tijolos: 4, cimento: 2 },
    pop: 6000, cov: 'par', radius: 10, joy: 0.2, useP: 200, useW: 160, useR: 120, traffic: 8,
    desc: 'O Modelo-01 inteiro: anéis residenciais iluminados em volta de um lago com fontes. +6.000 habitantes.' },
  ciencia: { name: 'Arcologia Ciência e Educação', tag: 'Modelo-02', cat: 'mega', w: 7, h: 3, cost: 220000, keys: 22, unlock: 14, time: 180, xp: 1800, full: 'cienciaFull', items: { chips: 4, sensores: 2, paineis: 6 },
    cov: 'edu', radius: 16, joy: 0.15, prodBoost: 0.25, useP: 260, useW: 160, useR: 100, traffic: 8,
    desc: 'Arcologia integrada de ciência e educação. Produção 25% mais rápida e educação em raio enorme.' },
  santuario: { name: 'Santuário de Animais Expandido', tag: 'Modelo-02', cat: 'mega', w: 7, h: 3, cost: 300000, keys: 26, unlock: 15, time: 180, xp: 2200, full: 'santuarioFull', items: { mudas: 6, frutas: 4, tapete: 2 },
    cov: 'par', radius: 16, joy: 0.35, tourism: 900, useP: 200, useW: 300, useR: 120, traffic: 8,
    desc: 'Santuário expandido sob o arco da Sede. Turismo: +§900 por hora e muita felicidade.' },
  holding: { name: 'Holding e Santuário Global', tag: 'Modelo-02', cat: 'mega', w: 7, h: 3, cost: 400000, keys: 30, unlock: 16, time: 210, xp: 2600, full: 'holdingFull', items: { drones: 2, mesa: 3, tinta: 3 },
    cov: 'seg', radius: 18, joy: 0.15, taxBoost: 0.25, storage: 60, useP: 280, useW: 180, useR: 140, traffic: 8,
    desc: 'Administração global da holding com santuário. +25% em impostos, +60 no armazém e segurança em raio enorme.' },
  held: { name: 'Arcologia de Held', tag: 'Composição total', cat: 'mega', w: 7, h: 3, cost: 800000, keys: 40, unlock: 18, unique: true, time: 300, xp: 5000, full: 'heldFull', items: { drones: 4, sensores: 4, cimento: 4, farinha: 4 },
    pop: 12000, cov: 'par', radius: 20, joy: 0.3, taxBoost: 0.5, prodBoost: 0.25, useP: 500, useW: 400, useR: 300, traffic: 10,
    desc: 'A composição total: campus, biblioteca, acelerador, santuário e bioma num só complexo. +12.000 habitantes, +50% em impostos e +25% em produção.' },
};
for (const k in TYPES) { const t = TYPES[k]; t.id = k; if (!t.img) t.img = k; }
const isRes = t => !!t.res;
const isProd = t => !!t.slots;

/* ---------------- níveis, terreno, armazém ---------------- */
const NEED = [0, 0, 120, 360, 800, 1500, 2500, 3900, 5800, 8200, 11200, 15000, 19500, 25000, 31500, 39000, 48000, 58000, 70000, 84000, 100000, 118000, 138000, 160000, 185000, 212000];
const MAXL = NEED.length - 1;
const LAND = [16, 20, 24, 28, 32, 36, 40, 44, 48];
// expansão de terreno: nível mínimo, créditos e peças de expansão
const LAND_REQ = [null, { lvl: 3, c: 3000, p: 3 }, { lvl: 5, c: 12000, p: 5 }, { lvl: 7, c: 30000, p: 7 }, { lvl: 9, c: 70000, p: 9 }, { lvl: 11, c: 140000, p: 11 }, { lvl: 13, c: 260000, p: 13 }, { lvl: 15, c: 420000, p: 15 }, { lvl: 17, c: 650000, p: 18 }];
const STORE_BASE = 50, STORE_STEP = 25;
const storeReq = n => ({ c: 400 + n * n * 150, p: 2 + Math.floor(n / 2) }); // n = melhorias já feitas
const ROAD_COST = [0, 10, 40, 120];         // por quadrado, por nível (rua, avenida, via expressa)
const ROAD_CAP = [0, 14, 34, 90];           // capacidade de tráfego por trecho
const ROAD_NAME = ['', 'Rua', 'Avenida', 'Via expressa'];
const TAX_CAP_H = 6;                         // horas de imposto acumulável na Sede

/* ---------------- metas ---------------- */
const cnt = t => D.counts[t] || 0;
const cntDone = t => D.done[t] || 0;
const maxLvl = () => { let m = 0; for (const b of S.bld) if (b.t === 'zona' && b.lvl > m) m = b.lvl; return m; };
const GOALS = [
  { t: 'Construa 3 Zonas Residenciais ao lado da rua', n: 3, v: () => cntDone('zona'), r: 300, xp: 15 },
  { t: 'Coloque uma matéria-prima na fila da Fábrica Subterrânea', n: 1, v: () => S.stats.queued, r: 200, xp: 10 },
  { t: 'Melhore uma moradia para o estágio 2', n: 2, v: () => maxLvl(), r: 500, xp: 25 },
  { t: 'Trace 12 quadrados de rua', n: 12, v: () => S.stats.roads, r: 300, xp: 15 },
  { t: 'Chegue a 600 habitantes', n: 600, v: () => D.pop, r: 600, xp: 30 },
  { t: 'Construa a Oficina de Estruturas', n: 1, v: () => cntDone('loja1'), r: 700, xp: 30 },
  { t: 'Produza 5 Vigas', n: 5, v: () => S.stats.made.vigas || 0, r: 700, xp: 30 },
  { t: 'Construa um Posto de Vigilância', n: 1, v: () => cntDone('seg1'), r: 800, xp: 35 },
  { t: 'Colete impostos na Sede', n: 1, v: () => S.stats.taxes, r: 500, xp: 20 },
  { t: 'Deixe a felicidade em 70%', n: 70, v: () => Math.round(D.joy * 100), r: 1000, xp: 40 },
  { t: 'Construa a Torre do Comércio Global', n: 1, v: () => cntDone('mer1'), r: 1200, xp: 50 },
  { t: 'Chegue a 2.000 habitantes', n: 2000, v: () => D.pop, r: 1500, xp: 60 },
  { t: 'Construa o Terminal de Cargas', n: 1, v: () => cntDone('tra1'), r: 1500, xp: 60 },
  { t: 'Despache uma encomenda no Terminal', n: 1, v: () => S.stats.cargo, r: 2000, xp: 80, keys: 2 },
  { t: 'Expanda o terreno da cidade', n: 1, v: () => S.land, r: 2000, xp: 80 },
  { t: 'Melhore uma moradia para o estágio 4', n: 4, v: () => maxLvl(), r: 3000, xp: 100 },
  { t: 'Chegue a 6.000 habitantes', n: 6000, v: () => D.pop, r: 5000, xp: 150, gems: 5 },
  { t: 'Construa a Torre Bioclimática', n: 1, v: () => cntDone('ener3'), r: 6000, xp: 200 },
  { t: 'Melhore uma moradia para o estágio 7', n: 7, v: () => maxLvl(), r: 8000, xp: 250, gems: 5 },
  { t: 'Construa a Arcologia Circular (Modelo-01)', n: 1, v: () => cntDone('arcoCirc'), r: 20000, xp: 400, keys: 6 },
  { t: 'Chegue a 30.000 habitantes', n: 30000, v: () => D.pop, r: 30000, xp: 500 },
  { t: 'Construa a Arcologia Ciência e Educação', n: 1, v: () => cntDone('ciencia'), r: 40000, xp: 600, keys: 8 },
  { t: 'Construa o Santuário de Animais Expandido', n: 1, v: () => cntDone('santuario'), r: 50000, xp: 700, keys: 8 },
  { t: 'Construa a Holding e Santuário Global', n: 1, v: () => cntDone('holding'), r: 60000, xp: 800, keys: 10 },
  { t: 'Complete a Arcologia de Held', n: 1, v: () => cntDone('held'), r: 150000, xp: 1500 },
  { t: 'Chegue a 100.000 habitantes', n: 100000, v: () => D.pop, r: 200000, xp: 2000 },
];
