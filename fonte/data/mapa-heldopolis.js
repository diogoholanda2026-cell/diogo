// Mapa autoral de Heldópolis (seção 4.6 do desenho da simulação, D2, D3, D36, D52, D53 e D55): um trecho do litoral
// brasileiro visto de helicóptero. Baía ao sul e a leste com ilhas e uma ponta de granito (a Pedra do Farol e o Morro
// da Enseada, à moda do Pão de Açúcar e da Urca); a Serra do Held ao norte e a Serra do Poente a oeste, com morros de
// 150 a 400 m; o Rio Held desce da serra a noroeste, corre na várzea e é a borda oeste da área inicial até a foz, onde
// fica a Vila de Santa Cida; a lagoa costeira atrás da restinga; o platô da gleba entre a lagoa e a baía; a rodovia
// entra pelo oeste, cruza o rio na ponte pronta, passa ao norte da área inicial (com o acesso até o nó de entrada) e
// desce para a orla até sair a leste.
//
// Metros; x leste, z sul (norte em -z), origem no centro. Tudo aqui é dado: fonte/sim/mundo/* gera a grade de alturas,
// a água, os recursos, a mata, a Vila e a rodovia a partir deste arquivo, sempre igual (semente fixa do mapa).
// A gleba vem de arcologia-plano.js (D59: o integrador grava o plano escolhido no portão 1).
import { congelar } from '../comum/util.js';
import { GLEBA_ENVELOPE } from './arcologia-plano.js';

// ------------------------------------------------------------------------------------------------ costa

/**
 * Linha da costa do continente, de oeste para leste, com a terra ao norte: [x, z, praia, duna].
 * praia: 1 areia (rampa suave, 2,5 m a 70 m da água), 0 costão (pedra que entra na água). duna: restinga atrás da praia.
 * As pontas de granito e as ilhas sobem do fundo como morros (abaixo); a costa aqui é a da planície.
 */
const COSTA = [
  [-4600, 1560, 0, 0], [-4100, 1500, 0, 0], [-3780, 1575, 1, 0], [-3560, 1490, 0, 0], [-3330, 1400, 0, 0],
  [-3140, 1470, 0, 0], [-2960, 1370, 1, 0.3], [-2760, 1335, 1, 0.3], [-2570, 1385, 0, 0], [-2390, 1310, 0, 0],
  [-2210, 1255, 0, 0], [-2040, 1205, 1, 0.5], [-1820, 1175, 1, 0.8], [-1580, 1150, 1, 0.8], [-1380, 1125, 1, 0.5],
  [-1210, 1100, 1, 0], [-1060, 1082, 1, 0.3], [-910, 1064, 1, 0.8], [-760, 1050, 1, 1], [-610, 1040, 1, 1],
  [-470, 1030, 1, 0.8], [-340, 1012, 1, 0.2], [-160, 1004, 1, 0], [40, 1000, 1, 0], [240, 998, 1, 0], [420, 996, 1, 0],
  // costão do canto sudeste da gleba: o platô inteiro fica em terra, com uns 60 m de barranco até a água
  [540, 1000, 0.5, 0], [640, 1002, 0, 0], [725, 990, 0, 0], [780, 950, 0, 0], [808, 890, 0, 0], [835, 820, 0.6, 0],
  [885, 762, 1, 0], [965, 712, 1, 0.2], [1060, 678, 1, 0.5], [1250, 652, 1, 0.6], [1500, 630, 1, 0.6], [1750, 624, 1, 0.6],
  [2000, 640, 1, 0.5], [2200, 670, 1, 0.3], [2330, 716, 0, 0], [2395, 792, 0, 0], [2415, 880, 0, 0],
  [2440, 985, 0, 0], [2490, 1075, 0, 0], [2570, 1150, 0, 0], [2660, 1195, 0, 0], [2750, 1165, 0, 0],
  [2795, 1080, 0, 0], [2785, 980, 0, 0], [2825, 880, 0, 0], [2905, 805, 1, 0.3], [3060, 765, 1, 0.5],
  [3310, 738, 1, 0.5], [3560, 742, 1, 0.3], [3800, 705, 0, 0], [4060, 655, 0, 0], [4600, 640, 0, 0],
];

// ------------------------------------------------------------------------------------------------ serras e morros

/**
 * Serras: cristas com [x, z, altura, meia largura da base]. O perfil cai da crista até a base; espigões e grotas
 * descem perpendiculares à crista (ruído alongado no sentido da encosta), como na Serra do Mar.
 */
const SERRAS = [
  {
    id: 'held-oeste',
    pontos: [[-4700, -2700, 360, 1100], [-3700, -2450, 420, 1000], [-2950, -2200, 340, 850], [-2560, -2120, 220, 650]],
  },
  {
    // a frente da serra fica a uns 900 m da área inicial: da baía, os morros da cidade na frente e a serra atrás
    id: 'held',
    pontos: [
      [-2120, -2080, 240, 700], [-1650, -1980, 360, 820], [-1050, -1930, 415, 850], [-400, -2010, 370, 850],
      [300, -2060, 400, 850], [1000, -1960, 330, 800], [1700, -1900, 300, 800], [2500, -1980, 290, 850],
      [3300, -2080, 320, 900], [4700, -2150, 300, 1000],
    ],
  },
  {
    id: 'norte',
    pontos: [
      [-4700, -3700, 190, 900], [-3300, -3500, 230, 950], [-1900, -3650, 200, 900], [-600, -3450, 220, 950],
      [800, -3600, 190, 900], [2200, -3400, 170, 900], [3500, -3550, 210, 950], [4700, -3400, 190, 900],
    ],
  },
  {
    // esporões que descem da serra até perto do vale da rodovia
    id: 'esporoes',
    pontos: [[-1250, -1880, 330, 420], [-1150, -1560, 200, 380], [-1060, -1380, 90, 300]],
  },
  { id: 'esporao2', pontos: [[-150, -1960, 320, 420], [-120, -1620, 190, 380], [-80, -1420, 80, 300]] },
  { id: 'esporao3', pontos: [[900, -1900, 300, 420], [950, -1600, 180, 360], [1000, -1420, 75, 280]] },
  {
    id: 'poente',
    pontos: [
      [-2750, -2050, 300, 800], [-2600, -1650, 250, 700], [-2600, -1270, 62, 560], [-2640, -880, 260, 700],
      [-2720, -250, 380, 850], [-2680, 450, 340, 800], [-2640, 950, 250, 650], [-2600, 1350, 110, 480],
    ],
  },
  {
    id: 'leste',
    pontos: [
      [1680, -1000, 190, 520], [1780, -420, 250, 540], [2150, -20, 200, 480], [2650, 150, 185, 470],
      [3250, 90, 235, 580], [3950, -10, 255, 680], [4700, -60, 260, 700],
    ],
  },
];

/**
 * Morros isolados: domos de granito ('pao': flancos quase a prumo e topo arredondado, pedra nua) e morros de mata
 * ('morro': redondos). rx e rz são os raios da base; ang gira a elipse (radianos, a partir de +x para +z); face e
 * forte: o lado em pé (direção no mundo, em radianos) e quanto ele é mais íngreme que o de trás.
 * Os de mar (ilhas e a ponta) sobem do fundo: h é a cota do topo acima do mar.
 */
const MORROS = [
  { id: 'pedreira', forma: 'morro', x: -470, z: -820, rx: 360, rz: 245, ang: 1.25, h: 236, face: 1.7, forte: 2.2 },
  { id: 'mirante', forma: 'morro', x: 485, z: -870, rx: 360, rz: 240, ang: 1.8, h: 205, face: 1.3, forte: 0.5 },
  { id: 'lagoaNorte', forma: 'morro', x: -650, z: 330, rx: 150, rz: 130, ang: 0.6, h: 50 },
  { id: 'leste', forma: 'morro', x: 880, z: -230, rx: 230, rz: 200, ang: 0.2, h: 78 },
  { id: 'enseada', forma: 'pao', x: 2440, z: 865, rx: 230, rz: 170, ang: 0.55, h: 218, face: 2.4, forte: 1 },
  { id: 'farol', forma: 'pao', x: 2680, z: 1125, rx: 310, rz: 195, ang: 0.62, h: 396, face: 1.2, forte: 1.3 },
  { id: 'irmaoMaior', forma: 'pao', x: -2420, z: 930, rx: 270, rz: 215, ang: 0.3, h: 262, face: 1.6, forte: 1.2 },
  { id: 'irmaoMenor', forma: 'pao', x: -2140, z: 1010, rx: 180, rz: 150, ang: 0.3, h: 186, face: 1.5, forte: 1.1 },
  { id: 'orla', forma: 'morro', x: 1790, z: 110, rx: 300, rz: 240, ang: 0.1, h: 150 },
  { id: 'urca', forma: 'morro', x: 2180, z: 250, rx: 210, rz: 165, ang: 0.4, h: 112 },
  { id: 'ilhaGuaras', forma: 'morro', x: -480, z: 2520, rx: 440, rz: 240, ang: 0.3, h: 138 },
  { id: 'ilhaMeio', forma: 'pao', x: 900, z: 2060, rx: 175, rz: 145, ang: -0.2, h: 64 },
  { id: 'ilhaRasa', forma: 'morro', x: 2950, z: 2620, rx: 560, rz: 280, ang: -0.4, h: 172 },
  { id: 'ilhaPoente', forma: 'morro', x: -2520, z: 2320, rx: 260, rz: 200, ang: 0.8, h: 88 },
  { id: 'lajePescador', forma: 'pao', x: 1880, z: 1720, rx: 75, rz: 60, ang: 0.2, h: 22 },
  { id: 'ilhaCabras', forma: 'morro', x: 3620, z: 1520, rx: 170, rz: 130, ang: -0.6, h: 70 },
];

/**
 * Planaltos: o alto atrás das serras (o planalto da Serra do Mar), com a cota média, a largura da borda (da cota 0 à
 * cota cheia, para dentro) e a ondulação. Deixam o vale da rodovia a oeste e o corredor do rio abertos.
 */
const PLANALTOS = [
  {
    id: 'norte', cota: 220, borda: 950, ondulacao: 60,
    contorno: [[-4800, -2150], [-2500, -2200], [-1000, -2050], [1300, -2080], [3000, -2100], [4800, -2200], [4800, -4800], [-4800, -4800]],
  },
  {
    id: 'oesteNorte', cota: 180, borda: 600, ondulacao: 50,
    contorno: [[-4800, -2400], [-3100, -2300], [-3200, -1700], [-4800, -1720]],
  },
  {
    id: 'oesteSul', cota: 170, borda: 700, ondulacao: 50,
    contorno: [[-4800, -860], [-3200, -880], [-3050, 400], [-3150, 1250], [-4800, 1350]],
  },
  {
    id: 'nordeste', cota: 120, borda: 600, ondulacao: 45,
    contorno: [[2050, -1800], [4800, -1850], [4800, -650], [3300, -560], [2300, -700]],
  },
];

// ------------------------------------------------------------------------------------------------ rio e lagoa

/**
 * Rio Held, da nascente (norte) à foz: [x, z, largura, nível da água, várzea à esquerda, várzea à direita].
 * Esquerda e direita olhando rio abaixo: no trecho de baixo, que corre para o sul, a esquerda é a margem leste (a da
 * área inicial, estreita) e a direita a oeste (a várzea larga, fora da área inicial).
 */
const RIO = [
  [-2620, -4300, 18, 128, 10, 10],
  [-2470, -3650, 22, 100, 15, 15],
  [-2370, -3050, 26, 74, 20, 20],
  [-2340, -2460, 30, 50, 16, 16],
  [-2160, -1960, 36, 30, 60, 120],
  [-1860, -1610, 44, 15, 150, 300],
  [-1560, -1390, 52, 7.5, 240, 450],
  [-1300, -1195, 60, 4.5, 200, 560],
  [-1150, -905, 66, 3.6, 150, 650],
  [-1062, -555, 72, 3.0, 130, 700],
  [-1044, -150, 78, 2.5, 125, 700],
  [-1050, 250, 86, 2.0, 120, 650],
  [-1112, 600, 96, 1.4, 105, 550],
  [-1162, 880, 116, 0.8, 70, 450],
  [-1222, 1060, 140, 0.3, 35, 300],
  [-1252, 1200, 170, 0, 10, 10],
];

/**
 * Córregos: vales rasos que drenam a planície dos pés dos morros até a lagoa e o mar (sem água na grade: são estreitos
 * demais para 8 m; a mata ciliar marca o traçado). [x, z]; profundidade e meia largura do vale em metros.
 */
const CORREGOS = [
  { id: 'pedreira', profundidade: 2.6, largura: 55, pontos: [[-470, -560], [-520, -300], [-548, -40], [-520, 180], [-520, 420], [-560, 600], [-600, 690]] },
  { id: 'mirante', profundidade: 2.4, largura: 55, pontos: [[470, -610], [560, -330], [700, -60], [790, 240], [850, 520], [905, 700]] },
  { id: 'vale', profundidade: 2, largura: 45, pontos: [[-160, -1150], [-260, -1060], [-520, -1080], [-760, -1120], [-980, -1150]] },
];

/** Lagoa costeira atrás da restinga, a sudoeste da gleba: contorno (fechado) e nível da água. */
const LAGOA = {
  id: 'lagoa',
  nivel: 1.1,
  profundidade: 4.2,
  // alongada ao longo da costa, atrás da restinga, como as lagoas do litoral fluminense
  contorno: [
    [-730, 700], [-640, 688], [-560, 712], [-492, 704], [-446, 738], [-422, 802], [-446, 864], [-502, 912],
    [-570, 944], [-660, 948], [-740, 922], [-788, 868], [-792, 790], [-772, 736],
  ],
};

// ------------------------------------------------------------------------------------------------ platô e planície

/** Platô da gleba: plano na cota do envelope; ao sul desce em barranco até a praia. */
const PLATO = {
  caixa: GLEBA_ENVELOPE.caixa,
  cota: GLEBA_ENVELOPE.cota,
  margem: 24, // plano além da caixa
  transicao: 170, // volta ao relevo em volta
};

/** Planície: cota que sobe devagar para dentro da terra, com colinas baixas (coxilhas) de poucos metros. */
const PLANICIE = {
  cotaPraia: 2.4, larguraPraia: 70, subida: 0.011, teto: 30,
  // coxilhas baixas perto da cidade e morrotes mais longe (metros), pela distância ao centro da área inicial
  colinas: 5, morrotes: 55, raioCidade: [1500, 2900],
};

/** Calcário: faixa a noroeste, na encosta sul da Serra do Held, fora da área inicial (D3). Polígono. */
const CALCARIO = [[-980, -1560], [-420, -1610], [-60, -1500], [-120, -1300], [-560, -1270], [-940, -1330]];

// ------------------------------------------------------------------------------------------------ rodovia e Vila

/**
 * Rodovia (BR, 2 x 2 faixas, D22): pontos de passagem de oeste para leste (curvas suaves entre eles, raio >= 250 m).
 * `ponte` marca o vão sobre o rio (sem forma no aplainar); `vila` é a junção da estrada de terra da Vila; `juncao` é a
 * saída do acesso até o nó de entrada.
 */
const RODOVIA = {
  pontos: [
    [-4096, -1318], [-3600, -1292], [-3100, -1272], [-2600, -1262], [-2150, -1230], [-1800, -1200], [-1500, -1193],
    [-1375, -1190, 'ponte'], [-1225, -1190], [-1010, -1190, 'vila'], [-600, -1200], [-220, -1205], [40, -1203, 'juncao'],
    [420, -1196], [790, -1176], [1060, -1108], [1225, -905], [1305, -610], [1345, -270], [1400, 90], [1485, 330],
    [1660, 450], [1960, 472], [2260, 500], [2560, 536], [2860, 552], [3220, 538], [3720, 520], [4096, 518],
  ],
  // acesso de 4 faixas da junção até o nó de entrada, pela sela entre o Morro da Pedreira e o do Mirante
  acesso: [[40, -1203], [32, -1060], [8, -890], [18, -710], [46, -560], [72, -430]],
  declive: 0.055,
  sobreVarzea: 4.5, // folga mínima acima do nível do rio na várzea
  vaoLivre: 7.5, // tabuleiro da ponte acima da água
};

/** Nó de entrada (D52): fim do acesso; só ele traz energia da rodovia (até 5 MW) para vias com calçada. */
const ENTRADA = { x: 72, z: -430, energiaMW: 5 };

/**
 * Vila de Santa Cida (uns 60 prédios de nível 1 e 2, 350 moradores): rua principal ('rua') e ruas de terra na foz,
 * entre o rio e a lagoa, e a estrada de terra que sobe pela beira da várzea até a rodovia.
 */
const VILA = {
  moradores: 350,
  predios: 60,
  ruas: [
    { id: 'principal', tipo: 'rua', pontos: [[-986, 560], [-991, 732], [-997, 862], [-1008, 1010]] },
    { id: 'praia', tipo: 'terra', pontos: [[-1092, 1016], [-1008, 1010], [-880, 1000], [-780, 994], [-680, 992]] },
    { id: 'beiraRio', tipo: 'terra', pontos: [[-986, 560], [-1046, 640], [-1061, 734], [-1074, 864], [-1092, 1016]] },
    { id: 'deCima', tipo: 'terra', pontos: [[-986, 560], [-900, 598], [-872, 724], [-868, 856], [-880, 1000]] },
    { id: 'travessaNorte', tipo: 'terra', pontos: [[-1061, 734], [-991, 732], [-872, 724]] },
    { id: 'travessaSul', tipo: 'terra', pontos: [[-1074, 864], [-997, 862], [-868, 856]] },
    {
      id: 'estrada', tipo: 'terra',
      pontos: [[-986, 560], [-944, 400], [-926, 200], [-918, -60], [-916, -380], [-928, -700], [-962, -990], [-1010, -1190]],
    },
  ],
  // área onde nascem os prédios (fora dela, só as ruas)
  area: [[-1100, 400], [-905, 380], [-880, 500], [-820, 600], [-812, 950], [-660, 955], [-660, 1034], [-1120, 1062], [-1098, 800]],
};

// ------------------------------------------------------------------------------------------------ áreas e sugestões

/** Áreas nomeadas (D55): base das decisões e dos distritos do M2. */
const AREAS = [
  {
    id: 'vila', nome: 'Vila de Santa Cida',
    contorno: [[-1115, 380], [-895, 365], [-870, 495], [-805, 590], [-800, 950], [-650, 955], [-650, 1040], [-1135, 1075], [-1112, 800]],
  },
  { id: 'gleba', nome: 'Gleba da Arcologia', contorno: GLEBA_ENVELOPE.contorno },
  {
    id: 'orla', nome: 'Orla da Praia Grande',
    contorno: [[1040, 470], [1600, 400], [2330, 440], [2380, 700], [2200, 672], [1750, 626], [1250, 654], [1040, 690]],
  },
  {
    id: 'varzea', nome: 'Várzea do Held',
    contorno: [
      [-1980, -1330], [-1030, -1330], [-930, -1000], [-900, -500], [-905, 100], [-915, 520], [-1040, 560],
      [-1100, 900], [-1230, 1120], [-1560, 1150], [-2010, 1190], [-2080, 400], [-2050, -400],
    ],
  },
  {
    id: 'morros', nome: 'Morros do Norte',
    contorno: [[-1000, -1040], [1000, -1040], [1010, -600], [640, -560], [260, -620], [-180, -560], [-600, -480], [-880, -560]],
  },
];

/**
 * Sugestões da primeira hora (D36): a primeira avenida do nó de entrada até a gleba, as primeiras quadras dos dois
 * lados dela, os lugares da captação (no rio acima da Vila) e da usina solar, e os primeiros prédios da Holding.
 * O fim da avenida é o portão norte do plano escolhido (areas.js acerta pelo plano; aqui vale o do envelope).
 */
const SUGESTOES = {
  avenida: { via: 'avenida', pontos: [[72, -430], [96, -230], [140, -40], [160, 180]] },
  quadras: [
    { zona: 'resBaixa', contorno: [[-236, -330], [58, -350], [100, -140], [-196, -120]] },
    { zona: 'comBaixa', contorno: [[132, -330], [370, -300], [372, -90], [170, -100]] },
    { zona: 'resBaixa', contorno: [[-180, -40], [120, -30], [140, 150], [-150, 150]] },
  ],
  captacao: { construir: 'captacao', x: -1004, z: 320, rot: -1.5708 },
  usina: { construir: 'usinaSolar', x: -842, z: 470, rot: 0 },
  escritorio: { construir: 'escritorioObra', x: 250, z: -470, rot: 0 },
  pedreira: { construir: 'pedreira', x: -500, z: -670, rot: 3.1416 },
  areal: { construir: 'areal', x: -992, z: 60, rot: -1.5708 },
  olaria: { construir: 'olaria', x: -950, z: -250, rot: -1.5708 },
};

/** Nomes de lugares para os rótulos do mapa (chave do texto em ui/textos/s1.js). */
const LUGARES = [
  { id: 'rioHeld', x: -1050, z: -300, tipo: 'rio' },
  { id: 'lagoa', x: -670, z: 790, tipo: 'agua' },
  { id: 'baia', x: 600, z: 1600, tipo: 'agua' },
  { id: 'serraHeld', x: -700, z: -2200, tipo: 'serra' },
  { id: 'serraPoente', x: -3200, z: -300, tipo: 'serra' },
  { id: 'pedreira', x: -470, z: -790, tipo: 'morro' },
  { id: 'mirante', x: 485, z: -845, tipo: 'morro' },
  { id: 'farol', x: 2680, z: 1125, tipo: 'morro' },
  { id: 'enseada', x: 2440, z: 865, tipo: 'morro' },
  { id: 'irmaos', x: -2300, z: 960, tipo: 'morro' },
  { id: 'praiaVila', x: -900, z: 1060, tipo: 'praia' },
  { id: 'praiaGrande', x: 1650, z: 640, tipo: 'praia' },
  { id: 'ilhaGuaras', x: -480, z: 2520, tipo: 'ilha' },
  { id: 'ilhaRasa', x: 2950, z: 2620, tipo: 'ilha' },
  { id: 'ilhaMeio', x: 900, z: 2060, tipo: 'ilha' },
  { id: 'ponte', x: -1300, z: -1190, tipo: 'ponte' },
];

// ------------------------------------------------------------------------------------------------ o mapa

/**
 * O mapa de Heldópolis. `semente` é a do mapa (fixa): a mesma para toda partida; a da partida só rege os sorteios do
 * jogo. `inicio`: ladrilhos 6 a 9 nos dois eixos (D3).
 */
export const MAPA_HELDOPOLIS = congelar({
  id: 'heldopolis',
  nome: 'Heldópolis',
  semente: 'heldopolis-mapa-1',
  tam: 8192,
  origem: [-4096, -4096],
  n: 1025,
  passo: 8,
  ladrilho: 512,
  ladrilhos: 16,
  inicio: [[6, 6], [9, 9]],
  nivelMar: 0,
  latitude: -23.5,
  costa: COSTA,
  serras: SERRAS,
  morros: MORROS,
  planaltos: PLANALTOS,
  rio: { id: 'held', nome: 'Rio Held', pontos: RIO },
  corregos: CORREGOS,
  lagoa: LAGOA,
  plato: PLATO,
  planicie: PLANICIE,
  calcario: CALCARIO,
  rodovia: RODOVIA,
  entrada: ENTRADA,
  vila: VILA,
  areas: AREAS,
  sugestoes: SUGESTOES,
  lugares: LUGARES,
});

/** Mapas conhecidos por id (criarSimulacao({ mapa })). */
export const MAPAS = congelar({ heldopolis: MAPA_HELDOPOLIS });
