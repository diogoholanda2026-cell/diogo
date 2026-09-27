// Mapa autoral de Heldópolis (seção 4.6 do desenho da simulação, D2, D3, D36, D52, D53 e D55): um trecho do litoral
// brasileiro visto de helicóptero, à moda do Rio de Janeiro e de Florianópolis. A baía fica ao sul, com ilhas de
// granito, e a leste, na Enseada da Praia Grande: uma meia-lua de praia (a orla nobre, fora da área inicial) fechada
// pelo espinhaço do Vigia e da Sentinela, com o Morro da Enseada e a Pedra do Farol na boca, como a Urca e o Pão de
// Açúcar. Ao norte, o Maciço do Held (crista de 330 a 410 m a 1,2 km da cidade, esporões que descem para o sul com
// vales largos entre eles e a Pedra do Held, um monólito de granito sobre a crista, como a Gávea); a oeste, a Serra
// do Poente e os Morros Irmãos na praia. Na cidade, os morros da Pedreira e do Mirante, cristas curtas de mata. O Rio
// Held desce da serra a noroeste, serpenteia em meandros na várzea (com lagoas marginais, os meandros abandonados) e
// é a borda oeste da área inicial até a foz, onde fica a Vila de Santa Cida; a lagoa costeira atrás da restinga; o
// platô da gleba entre a lagoa e a baía; a rodovia entra pelo oeste, cruza o rio na ponte pronta, passa ao pé do
// maciço ao norte da área inicial (com o acesso até o nó de entrada), contorna a enseada por trás da orla e sai a
// leste pela planície.
//
// Metros; x leste, z sul (norte em -z), origem no centro. Tudo aqui é dado: fonte/sim/mundo/* gera a grade de alturas,
// a água, os recursos, a mata, a Vila e a rodovia a partir deste arquivo, sempre igual (semente fixa do mapa). A forma
// fina dos maciços (vales, espigões, grotas) sai da erosão assada por `node ferramentas/mapa.mjs --assar`: mudou
// serras, morros, planaltos, costa, rio, lagoas, córregos, planície ou rodovia, asse de novo (o teste do mundo acusa).
// A gleba vem de arcologia-plano.js (D59: o integrador grava o plano escolhido no portão 1).
import { congelar, cos, sen } from '../comum/util.js';
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
  [540, 1000, 0.5, 0], [640, 1002, 0, 0], [725, 990, 0, 0], [780, 950, 0, 0], [808, 890, 0, 0], [835, 820, 0.3, 0],
  [872, 768, 0, 0], [935, 738, 0, 0], [1010, 722, 0.3, 0],
  // Enseada da Praia Grande (a baía a leste da cidade, fora da área inicial): praia em meia-lua do costão da gleba até
  // o pé do Morro do Vigia, como a enseada de Botafogo
  [1082, 676, 1, 0.2], [1128, 590, 1, 0.4], [1152, 480, 1, 0.5], [1170, 360, 1, 0.6], [1196, 236, 1, 0.6],
  [1244, 118, 1, 0.6], [1320, 16, 1, 0.6], [1430, -62, 1, 0.6], [1570, -112, 1, 0.6], [1720, -128, 1, 0.6],
  [1870, -112, 1, 0.5], [2000, -66, 1, 0.4], [2110, 6, 1, 0.2], [2190, 96, 0.4, 0],
  // o lado leste da enseada: costão do Vigia e da Sentinela até o Morro da Enseada e a Pedra do Farol, na boca da baía
  [2240, 200, 0, 0], [2268, 320, 0, 0], [2282, 440, 0, 0], [2300, 550, 0.3, 0], [2322, 640, 1, 0.2], [2352, 716, 0.3, 0],
  [2395, 792, 0, 0], [2415, 880, 0, 0],
  [2440, 985, 0, 0], [2490, 1075, 0, 0], [2570, 1150, 0, 0], [2660, 1195, 0, 0], [2750, 1165, 0, 0],
  [2795, 1080, 0, 0], [2785, 980, 0, 0], [2825, 880, 0, 0], [2905, 805, 1, 0.3], [3060, 765, 1, 0.5],
  [3310, 738, 1, 0.5], [3560, 742, 1, 0.3], [3800, 705, 0, 0], [4060, 655, 0, 0], [4600, 640, 0, 0],
];

// ------------------------------------------------------------------------------------------------ serras e morros

/**
 * Serras: cristas com [x, z, altura, meia largura da base]; `picos` é quanto a altura varia ao longo da crista (picos e
 * selas, pelo ruído). O envelope cai da crista ao pé em S; a erosão assada (mundo/erosao.js) entalha os vales, os
 * espigões e as grotas. O Maciço do Held não é uma parede reta: a crista serpenteia e solta esporões para o sul, com
 * vales largos entre eles onde a planície entra, como o Maciço da Tijuca sobre o Rio.
 */
const SERRAS = [
  {
    id: 'held-oeste', picos: 0.18,
    pontos: [[-4700, -2700, 360, 1100], [-3700, -2450, 420, 1000], [-2950, -2200, 340, 850], [-2560, -2120, 220, 650]],
  },
  {
    // crista principal do Maciço do Held, de oeste para leste, a uns 1,2 km da área inicial; a encosta sul desce em
    // 1 km até o vale da rodovia (declive médio de 40%, o da Mata Atlântica nas serras do Rio)
    id: 'held', picos: 0.2,
    pontos: [
      [-2200, -2250, 260, 700], [-1750, -2180, 350, 820], [-1250, -2150, 400, 900], [-850, -2230, 380, 900],
      [-450, -2330, 330, 880], [-50, -2240, 390, 900], [380, -2330, 410, 920], [820, -2250, 360, 880],
      [1300, -2360, 330, 860], [1850, -2220, 300, 820], [2500, -2250, 290, 800], [3300, -2300, 320, 850],
      [4700, -2350, 300, 950],
    ],
  },
  {
    // a serra do fundo, a 3,5 km da cidade
    id: 'norte', picos: 0.14,
    pontos: [
      [-4700, -3700, 190, 900], [-3300, -3500, 230, 950], [-1900, -3650, 200, 900], [-600, -3450, 220, 950],
      [800, -3600, 190, 900], [2200, -3400, 170, 900], [3500, -3550, 210, 950], [4700, -3400, 190, 900],
    ],
  },
  // esporões que descem do maciço para o sul, cada um com o seu passo (os vales da planície entram entre eles)
  { id: 'esporaoRio', picos: 0.1, pontos: [[-1850, -2150, 330, 460], [-1780, -1850, 250, 420], [-1660, -1600, 150, 360], [-1580, -1460, 60, 260]] },
  {
    id: 'esporaoPedra', picos: 0.12,
    pontos: [[-1200, -2120, 400, 500], [-1230, -1850, 320, 460], [-1160, -1630, 220, 400], [-1060, -1470, 120, 320], [-990, -1380, 40, 240]],
  },
  { id: 'esporaoMeio', picos: 0.12, pontos: [[-420, -2300, 330, 460], [-360, -2000, 260, 440], [-270, -1740, 170, 380], [-210, -1560, 80, 300]] },
  {
    id: 'esporaoMirante', picos: 0.12,
    pontos: [[400, -2300, 410, 500], [480, -2020, 320, 460], [570, -1770, 220, 400], [650, -1580, 110, 320], [710, -1470, 40, 240]],
  },
  { id: 'esporaoLeste', picos: 0.1, pontos: [[1320, -2330, 330, 460], [1250, -2030, 250, 420], [1200, -1770, 160, 360], [1180, -1560, 70, 280]] },
  {
    // espinhaço baixo da península do leste: liga o Vigia, a Sentinela, a Enseada e o Farol por selas de mata
    id: 'peninsula', picos: 0.08,
    pontos: [[2280, -460, 60, 260], [2350, -60, 125, 300], [2395, 360, 95, 280], [2440, 760, 120, 280], [2600, 1090, 105, 240]],
  },
  {
    id: 'poente', picos: 0.16,
    pontos: [
      [-2750, -2050, 300, 780], [-2560, -1650, 250, 640], [-2640, -1270, 62, 540], [-2570, -880, 260, 640],
      [-2760, -250, 380, 800], [-2630, 450, 340, 700], [-2720, 950, 250, 620], [-2600, 1350, 110, 480],
    ],
  },
  // esporões do Poente para leste, sobre a várzea (param antes do vale do rio)
  { id: 'esporaoPoente1', picos: 0.1, pontos: [[-2700, -560, 330, 420], [-2460, -470, 210, 340], [-2300, -390, 80, 250]] },
  { id: 'esporaoPoente2', picos: 0.1, pontos: [[-2640, 250, 320, 400], [-2450, 330, 190, 320], [-2320, 400, 60, 230]] },
  { id: 'esporaoPoente3', picos: 0.1, pontos: [[-2600, -1520, 230, 360], [-2420, -1420, 140, 300], [-2300, -1330, 50, 220]] },
  {
    id: 'leste', picos: 0.14,
    pontos: [
      // a frente de serra atrás da enseada e da planície do leste (a rodovia passa ao pé dela)
      [1650, -1250, 200, 480], [2150, -1120, 240, 520], [2750, -1060, 215, 520], [3350, -1000, 245, 560],
      [3950, -1020, 255, 620], [4700, -1060, 260, 700],
    ],
  },
  // esporões da serra do leste, descendo para a planície e a enseada
  { id: 'esporaoLeste1', picos: 0.1, pontos: [[2120, -1150, 240, 380], [2220, -880, 150, 320], [2300, -700, 60, 240]] },
  { id: 'esporaoLeste2', picos: 0.1, pontos: [[3380, -1010, 240, 400], [3290, -740, 150, 330], [3240, -560, 60, 250]] },
  { id: 'esporaoLeste3', picos: 0.1, pontos: [[4150, -1030, 250, 400], [4230, -760, 160, 330], [4290, -560, 60, 240]] },
];

/**
 * Morros isolados: domos de granito ('pao': flancos quase a prumo e topo arredondado, pedra nua) e morros de mata
 * ('morro': redondos). rx e rz são os raios da base; ang gira a elipse (radianos, a partir de +x para +z); face e
 * forte: o lado em pé (direção no mundo, em radianos) e quanto ele é mais íngreme que o de trás.
 * Os de mar (ilhas e a ponta) sobem do fundo: h é a cota do topo acima do mar.
 */
const MORROS = [
  { id: 'pedreira', forma: 'morro', x: -470, z: -820, rx: 420, rz: 320, ang: 0.15, h: 236, face: 1.7, forte: 0.7 },
  { id: 'mirante', forma: 'morro', x: 485, z: -870, rx: 400, rz: 300, ang: -0.25, h: 205, face: 1.3, forte: 0.6 },
  { id: 'lagoaNorte', forma: 'morro', x: -650, z: 330, rx: 150, rz: 130, ang: 0.6, h: 50 },
  { id: 'leste', forma: 'morro', x: 880, z: -230, rx: 230, rz: 200, ang: 0.2, h: 78 },
  // Pedra do Held: o monólito de granito sobre a crista do maciço, visto de toda a cidade (a Pedra da Gávea do Rio)
  { id: 'pedraHeld', forma: 'pao', x: -1230, z: -2110, rx: 360, rz: 270, ang: 0.15, h: 495, face: 1.57, forte: 1.3 },
  { id: 'enseada', forma: 'pao', x: 2440, z: 865, rx: 230, rz: 170, ang: 0.55, h: 218, face: 2.4, forte: 1 },
  { id: 'farol', forma: 'pao', x: 2680, z: 1125, rx: 280, rz: 185, ang: 0.62, h: 396, face: 1.2, forte: 1.3 },
  { id: 'irmaoMaior', forma: 'pao', x: -2420, z: 930, rx: 270, rz: 215, ang: 0.3, h: 262, face: 1.6, forte: 1.2 },
  { id: 'irmaoMenor', forma: 'pao', x: -2140, z: 1010, rx: 180, rz: 150, ang: 0.3, h: 186, face: 1.5, forte: 1.1 },
  // o lado leste da enseada: Vigia e Sentinela, em pé para a água, até a Enseada e o Farol na boca da baía
  { id: 'vigia', forma: 'morro', x: 2360, z: -10, rx: 250, rz: 190, ang: 1.35, h: 168, face: 3.3, forte: 1.6 },
  { id: 'sentinela', forma: 'pao', x: 2400, z: 390, rx: 185, rz: 150, ang: 1.45, h: 124, face: 3.1, forte: 1.2 },
  { id: 'sossego', forma: 'morro', x: 3350, z: 320, rx: 280, rz: 210, ang: 0.3, h: 92 },
  // ilhas: domos de granito com a pedra nua nos flancos (as Cagarras e as Tijucas)
  { id: 'ilhaGuaras', forma: 'morro', x: -480, z: 2520, rx: 430, rz: 200, ang: 0.3, h: 128, face: 1.6, forte: 0.8 },
  { id: 'ilhaMeio', forma: 'pao', x: 900, z: 2060, rx: 175, rz: 145, ang: -0.2, h: 64 },
  { id: 'ilhaRasa', forma: 'morro', x: 2950, z: 2620, rx: 540, rz: 250, ang: -0.4, h: 140, face: 1.3, forte: 0.9 },
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
    id: 'norte', cota: 220, borda: 700, ondulacao: 60,
    contorno: [[-4800, -2350], [-2600, -2380], [-1600, -2450], [-600, -2520], [500, -2480], [1500, -2560], [3000, -2450], [4800, -2500], [4800, -4800], [-4800, -4800]],
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
    contorno: [[2100, -1850], [4800, -1900], [4800, -1250], [3300, -1200], [2300, -1350]],
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
  [-2160, -1960, 36, 30, 45, 80],
  [-1860, -1610, 44, 15, 110, 200],
  [-1560, -1390, 52, 7.5, 240, 450],
  [-1300, -1195, 58, 4.5, 200, 560],
  // na várzea o rio serpenteia em meandros de 700 a 900 m (uns 12 larguras, como os rios de planície), encostando na
  // área inicial só nas curvas de leste (a captação, o Areal e a Vila); a várzea larga fica do lado oeste
  [-1215, -1080, 60, 4.0, 150, 600],
  [-1150, -930, 60, 3.7, 110, 650],
  [-1205, -790, 62, 3.4, 160, 620],
  [-1390, -700, 62, 3.2, 330, 480],
  [-1510, -560, 64, 3.0, 440, 380],
  [-1430, -410, 64, 2.8, 380, 440],
  [-1200, -340, 66, 2.6, 180, 620],
  [-1052, -230, 66, 2.5, 100, 700],
  [-1110, -90, 68, 2.35, 120, 700],
  [-1320, 20, 68, 2.2, 310, 520],
  [-1310, 140, 70, 2.05, 300, 520],
  [-1090, 230, 72, 1.95, 110, 680],
  [-1048, 330, 74, 1.85, 100, 680],
  [-1075, 450, 76, 1.7, 105, 650],
  [-1150, 560, 80, 1.5, 150, 600],
  [-1122, 680, 84, 1.3, 110, 560],
  // o trecho da foz, colado na borda da área inicial: a Vila fica inteira na margem leste
  [-1094, 800, 92, 1.0, 80, 470],
  [-1112, 940, 108, 0.6, 50, 360],
  [-1150, 1050, 126, 0.25, 30, 260],
  [-1172, 1092, 146, 0, 10, 10],
];

/**
 * Faixa de meandros do Rio Held (a várzea que o rio varre de um lado a outro), da ponte à foz: [x, z, nível, meia
 * largura da várzea à esquerda, à direita], medidas a partir deste eixo liso (não do leito, que serpenteia dentro dela).
 * A várzea e as encostas do vale saem daqui; o leito, do RIO. Acima da ponte, o eixo é o próprio rio.
 */
const RIO_VALE = [
  [-1300, -1195, 4.5, 210, 620],
  [-1240, -900, 3.8, 200, 640],
  [-1300, -620, 3.15, 250, 620],
  [-1270, -300, 2.6, 260, 640],
  [-1200, 0, 2.25, 220, 640],
  [-1160, 300, 1.9, 175, 640],
  [-1110, 600, 1.45, 110, 600],
  [-1102, 840, 0.9, 85, 470],
  [-1145, 1000, 0.45, 60, 330],
  [-1172, 1092, 0, 20, 20],
];

/**
 * Córregos: vales rasos que drenam a planície dos pés dos morros até a lagoa e o mar (sem água na grade: são estreitos
 * demais para 8 m; a mata ciliar marca o traçado). [x, z]; profundidade e meia largura do vale em metros.
 */
const CORREGOS = [
  { id: 'pedreira', profundidade: 2.6, largura: 55, pontos: [[-470, -560], [-520, -300], [-548, -40], [-520, 180], [-520, 420], [-566, 540], [-604, 650]] },
  { id: 'mirante', profundidade: 2.4, largura: 55, pontos: [[470, -610], [560, -330], [690, -70], [850, 160], [1010, 330], [1150, 420]] },
  { id: 'vale', profundidade: 2, largura: 45, pontos: [[-160, -1150], [-260, -1060], [-520, -1080], [-760, -1120], [-980, -1150]] },
];

/** Lagoa costeira atrás da restinga, a sudoeste da gleba: contorno (fechado) e nível da água. */
const LAGOA = {
  id: 'lagoa',
  nivel: 1.1,
  profundidade: 4.2,
  // alongada ao longo da costa, atrás da restinga, com a margem norte recortada e um saco onde chega o córrego da
  // Pedreira, como as lagoas do litoral fluminense
  contorno: [
    [-808, 820], [-790, 760], [-748, 728], [-690, 722], [-650, 700], [-618, 668], [-590, 676], [-584, 716],
    [-548, 742], [-490, 740], [-440, 764], [-404, 806], [-398, 856], [-428, 894], [-486, 910], [-540, 930],
    [-610, 944], [-680, 948], [-742, 934], [-790, 900],
  ],
};

/**
 * Meia-lua de uma lagoa marginal (meandro abandonado): arco de raio r e largura `largura` entre os ângulos a0 e a1
 * (radianos, de +x para +z), com as pontas afinando. Devolve o contorno fechado [[x, z], ...].
 */
function meiaLua(cx, cz, r, largura, a0, a1, n = 14) {
  const fora = [];
  const dentro = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + (a1 - a0) * t;
    const w = (largura * (0.35 + 0.65 * sen(3.141592653589793 * t))) / 2;
    const c = cos(a);
    const s = sen(a);
    fora.push([Math.round(cx + (r + w) * c), Math.round(cz + (r + w) * s)]);
    dentro.push([Math.round(cx + (r - w) * c), Math.round(cz + (r - w) * s)]);
  }
  return [...fora, ...dentro.reverse()];
}

/**
 * Lagoas marginais da várzea do Held: meandros que o rio abandonou, do lado oeste (fora da área inicial), com a água
 * um pouco acima do rio e a mata ciliar em volta. O nível de cada uma vale em toda a meia-lua.
 */
const LAGOAS_MARGINAIS = [
  { id: 'meandroNorte', nivel: 3.4, profundidade: 1.8, contorno: meiaLua(-1700, -760, 150, 46, 1.9, 4.9) },
  { id: 'meandroSul', nivel: 2.6, profundidade: 1.6, contorno: meiaLua(-1560, 330, 130, 40, -1.2, 1.9) },
];

// ------------------------------------------------------------------------------------------------ platô e planície

/** Platô da gleba: plano na cota do envelope; ao sul desce em barranco até a praia. */
const PLATO = {
  caixa: GLEBA_ENVELOPE.caixa,
  cota: GLEBA_ENVELOPE.cota,
  margem: 24, // plano além da caixa
  transicao: 170, // volta ao relevo em volta
};

/**
 * Planície: cota que sobe devagar para dentro da terra, com coxilhas de poucos metros (a ondulação baixa em que a
 * cidade assenta) e a restinga atrás das praias (duna frontal e cordões arenosos, pela coluna duna da costa).
 */
const PLANICIE = { cotaPraia: 2.4, larguraPraia: 70, subida: 0.011, teto: 30, colinas: 5 };

/** Morrotes: colinas de até `altura` metros longe da cidade (entre os raios, pela distância ao centro) e da costa. */
const MORROTES = { altura: 55, raio: [1500, 2900] };

/**
 * Janela do relevo fino (16 m) em volta da área inicial: ali a câmera chega perto, e os morros da cidade ganham a
 * erosão numa grade mais fina (espigões e grotas de 50 a 100 m); fora dela vale a de 32 m. Alinhada à grade de 16 m.
 */
const DETALHE_RELEVO = { x0: -1280, z0: -1440, lado: 2560, passo: 16 };

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
    [420, -1196], [790, -1176], [1060, -1108], [1300, -960], [1520, -780], [1760, -640], [2040, -580], [2360, -520],
    [2700, -430], [3050, -310], [3450, -170], [3800, -60], [4096, 10],
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
 * entre o rio e a lagoa, e a estrada de terra que sobe pela beira da várzea até a rodovia. A Vila fica inteira na área
 * inicial (D3): as plantas param 4 m antes da borda oeste (x = -1024, que corre pela margem do rio) e da sul
 * (z = 1024, na praia); mapa.mjs confere.
 */
const VILA = {
  moradores: 350,
  predios: 60,
  ruas: [
    { id: 'principal', tipo: 'rua', pontos: [[-972, 560], [-976, 732], [-980, 862], [-986, 990]] },
    { id: 'praia', tipo: 'terra', pontos: [[-986, 990], [-880, 992], [-780, 992], [-680, 990]] },
    { id: 'deCima', tipo: 'terra', pontos: [[-972, 560], [-900, 598], [-872, 724], [-868, 856], [-880, 992]] },
    { id: 'travessaNorte', tipo: 'terra', pontos: [[-976, 732], [-872, 724]] },
    { id: 'travessaSul', tipo: 'terra', pontos: [[-980, 862], [-868, 856]] },
    {
      id: 'estrada', tipo: 'terra',
      pontos: [[-972, 560], [-944, 400], [-926, 200], [-918, -60], [-916, -380], [-928, -700], [-962, -990], [-1010, -1190]],
    },
  ],
  // área onde nascem os prédios, com a planta inteira dentro dela (fora, só as ruas)
  area: [[-1020, 400], [-905, 380], [-880, 500], [-820, 600], [-812, 950], [-660, 955], [-660, 1020], [-1020, 1020]],
};

// ------------------------------------------------------------------------------------------------ áreas e sugestões

/** Áreas nomeadas (D55): base das decisões e dos distritos do M2. */
const AREAS = [
  {
    id: 'vila', nome: 'Vila de Santa Cida',
    contorno: [[-1036, 380], [-895, 365], [-870, 495], [-805, 590], [-800, 950], [-650, 955], [-650, 1040], [-1060, 1060], [-1044, 800]],
  },
  { id: 'gleba', nome: 'Gleba da Arcologia', contorno: GLEBA_ENVELOPE.contorno },
  {
    id: 'orla', nome: 'Orla da Praia Grande',
    // a meia-lua da Enseada da Praia Grande, da linha d'água até uns 280 m para dentro (ladrilhos vizinhos, D3)
    contorno: [
      [1060, 700], [1112, 596], [1140, 480], [1158, 360], [1182, 232], [1232, 108], [1310, 2], [1424, -78],
      [1568, -128], [1720, -144], [1874, -128], [2008, -80], [2124, -6], [2210, 90], [2140, -250], [1900, -400],
      [1600, -420], [1330, -320], [1120, -130], [1040, 80], [1030, 400], [1030, 680],
    ],
  },
  {
    id: 'varzea', nome: 'Várzea do Held',
    contorno: [
      [-1980, -1330], [-1030, -1330], [-930, -1000], [-900, -500], [-905, 100], [-915, 520], [-1036, 560],
      [-1044, 800], [-1060, 1060], [-1150, 1120], [-1560, 1150], [-2010, 1190], [-2080, 400], [-2050, -400],
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
  pedreira: { construir: 'pedreira', x: -480, z: -558, rot: 3.1416 },
  areal: { construir: 'areal', x: -1000, z: -240, rot: -1.5708 },
  olaria: { construir: 'olaria', x: -998, z: 80, rot: -1.5708 },
};

/** Nomes de lugares para os rótulos do mapa (chave do texto em ui/textos/s1.js). */
const LUGARES = [
  { id: 'rioHeld', x: -1050, z: -300, tipo: 'rio' },
  { id: 'lagoa', x: -670, z: 790, tipo: 'agua' },
  { id: 'lagoasMeandro', x: -1700, z: -760, tipo: 'agua' },
  { id: 'baia', x: 600, z: 1600, tipo: 'agua' },
  { id: 'serraHeld', x: -700, z: -2200, tipo: 'serra' },
  { id: 'pedraHeld', x: -1230, z: -2110, tipo: 'morro' },
  { id: 'serraPoente', x: -3200, z: -300, tipo: 'serra' },
  { id: 'pedreira', x: -470, z: -790, tipo: 'morro' },
  { id: 'mirante', x: 485, z: -845, tipo: 'morro' },
  { id: 'farol', x: 2680, z: 1125, tipo: 'morro' },
  { id: 'enseada', x: 2440, z: 865, tipo: 'morro' },
  { id: 'vigia', x: 2360, z: -10, tipo: 'morro' },
  { id: 'sentinela', x: 2400, z: 390, tipo: 'morro' },
  { id: 'enseadaAgua', x: 1720, z: 360, tipo: 'agua' },
  { id: 'irmaos', x: -2300, z: 960, tipo: 'morro' },
  { id: 'praiaVila', x: -900, z: 1060, tipo: 'praia' },
  { id: 'praiaGrande', x: 1440, z: -80, tipo: 'praia' },
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
  rio: { id: 'held', nome: 'Rio Held', pontos: RIO, vale: RIO_VALE },
  corregos: CORREGOS,
  lagoa: LAGOA,
  lagoas: [LAGOA, ...LAGOAS_MARGINAIS],
  plato: PLATO,
  planicie: PLANICIE,
  morrotes: MORROTES,
  detalheRelevo: DETALHE_RELEVO,
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
