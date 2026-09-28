// Plano da Arcologia. A F0 grava o ENVELOPE da gleba no platô, a Torre Lâmina da D27 e a câmera; o integrador grava o
// plano escolhido no portão 1 (gleba, portões, vias internas, posição e orientação da Torre, D59); X1a e X1b detalham.
// mapa-heldopolis.js (S1a) importa a gleba daqui e assenta o platô em volta dela. Metros; x leste, z sul.
//
// X1a detalha a Torre (medidas de cada peça do modelo) e os três planos candidatos da D59 como dados: posição e
// orientação de cada parte, contornos, portões candidatos, vias internas e a cava do reservatório como forma do
// aplainar. Ângulos dos arcos em graus, no plano x-z: 0 = leste, 90 = sul, 180 = oeste, 270 = norte.
import { congelar, sen, cos, atan2 } from '../comum/util.js';
import { girar } from '../comum/vetor.js';

/**
 * Envelope da gleba: retângulo no platô entre a lagoa (sudoeste) e a baía (sul e leste), dentro da área inicial de
 * 4 x 4 ladrilhos ([-1024, 1024] nos dois eixos). Cabe qualquer um dos três planos (A Baía, B Parque-canal, C Orla).
 * A cota é a do platô que S1a assenta; cidade e vias não entram (código 'gleba').
 */
export const GLEBA_ENVELOPE = congelar({
  contorno: [-340, 180, 660, 180, 660, 940, -340, 940], // pares x, z, sentido horário visto de cima
  caixa: [-340, 180, 660, 940],
  centro: [160, 560],
  cota: 12,
  nota: 'provisório até o portão 1; o plano escolhido pode encolher, nunca sair do envelope',
});

/**
 * Torre Lâmina (D27): planta de 36 x 50 m com o lado estreito (36 m) para a baía; três lâminas verticais coladas pelo
 * lado comprido, a mais alta na face lisa e a mais baixa do lado das penas (terraços para a baía). Cotas em metros.
 * Conta das alturas: pódio 16 + 35 pavimentos até 163 (terraço da lâmina 3) + andar de vento 1 (163 a 169)
 * + 15 pavimentos até 232 + andar de vento 2 (232 a 238, terraço da lâmina 2) + 15 pavimentos até 301 = 65 pavimentos.
 *
 * Espaço local do modelo (render/arcologia/torre.js): origem no centro da planta, no chão da plataforma; x ao longo dos
 * 36 m; z ao longo dos 50 m, da face lisa (z = -25) para as penas (z = +25), que olham para a baía (frente, +z com
 * rot = 0). A lâmina 1 vai de z = -25 a +1, a 2 de +1 a +15 e a 3 de +15 a +25.
 */
export const TORRE_LAMINA = congelar({
  planta: { largura: 36, comprimento: 50, ladoEstreitoPara: 'baia' },
  // pódio de pedra (travertino) com saguão de vidro claro atrás de uma colunata; chanfro nas quinas; passa 8 m dos
  // lados da Torre, 6 m atrás e 14 m na frente (o terraço com a piscina virada para a água); a marquise de 12 m em
  // balanço fica na face lisa, sobre a entrada, onde a costura desce
  podio: {
    altura: 16, marquise: 12, largura: 52, tras: 6, frente: 14, chanfro: 6, passoPilares: 6, pilar: 1.4,
    marquiseLargura: 30, marquiseCota: 10.4, marquiseEspessura: 0.9, embasamento: 1.2,
  },
  // da face lisa para as penas: fundo de cada lâmina ao longo dos 50 m e cota do terraço-jardim que a fecha
  laminas: [
    { largura: 36, fundo: 26, topo: 301 },
    { largura: 36, fundo: 14, topo: 238 },
    { largura: 36, fundo: 10, topo: 163 },
  ],
  pavimentos: { n: 65, altura: 4.2 },
  andaresDeVento: [
    { base: 163, altura: 6, recuo: 2 },
    { base: 232, altura: 6, recuo: 2 },
  ],
  // andares de vento com vidro claro, forro claro iluminado e montantes contínuos: nunca mais escuros que o corpo
  faceLisa: { costura: 6, vidro: 'escuro', aletas: 'densas', passoCostura: 0.75, recuoCostura: 0.8 },
  // aletas de bronze champanhe nas faces laterais (as de 50 m, que mostram as penas): lâminas de 0,45 m de fundo e 0,26
  // de espessura (a 45 graus ainda se vê metade de vidro entre elas: a torre lê como vidro com filetes, não como metal)
  aletas: { passo: 1.5, material: 'bronze', faces: 'laterais', fundo: 0.45, espessura: 0.26 },
  // montantes das faces de frente e da face lisa (geometria no LOD0; no shader no LOD1)
  montantes: { passo: 1.5, fundo: 0.35, espessura: 0.14 },
  // lanterna de vidro de 301 a 318 sobre os 18 m de trás da lâmina 1 (na frente, o terraço-jardim de 301), aletas a
  // cada 0,75 m e os últimos 12 m ocos, só aletas contra o céu e o aro que segura o heliponto
  coroa: { base: 301, altura: 29, oca: 12, fundo: 18, passoAletas: 0.75 },
  // heliponto em laca preta com aro de luz e o H dourado: tabuleiro sobre a coroa com uma proa em meia elipse que
  // avança 16 m além da frente dela, sobre a água (Edge, 30 Hudson Yards); diametro é o círculo de toque
  heliponto: { cota: 330, balanco: 16, diametro: 28, espessura: 1.2 },
  mastro: { topo: 350, raio: 0.7, z: -22 },
  parapeito: 1.2, // guarda-corpo de vidro dos terraços
  triangulos: {
    lod0: { media: [12000, 20000], alta: [40000, 80000], ultra: [40000, 80000] },
    lod1: [3000, 5000],
  },
});

/** Centro do heliponto no espaço local da Torre (z da frente da coroa mais o balanço, menos o raio). */
export const HELIPONTO_LOCAL = congelar({
  x: 0,
  y: TORRE_LAMINA.heliponto.cota,
  z: -25 + TORRE_LAMINA.coroa.fundo + TORRE_LAMINA.heliponto.balanco - TORRE_LAMINA.heliponto.diametro / 2,
});

// ------------------------------------------------------------------------------------------------ ajudas

/** Ponto de um arco (graus no plano x-z: 0 leste, 90 sul). */
export function pontoDoArco(cx, cz, r, graus) {
  const a = (graus * Math.PI) / 180;
  return [cx + r * cos(a), cz + r * sen(a)];
}

/** Rotação (convenção do three) de quem está em (x, z) e olha para (ax, az). */
export const rotParaOlhar = (x, z, ax, az) => atan2(ax - x, az - z);

/** Posição no mundo de um ponto local da Torre (lx, ly, lz) com a Torre em { x, z, rot }; y acima da plataforma. */
export function torreParaMundo(torre, lx, ly, lz) {
  const [dx, dz] = girar(lx, lz, torre.rot);
  return { x: torre.x + dx, y: ly, z: torre.z + dz };
}

/**
 * Suaviza uma poligonal (pares x, z) pelo corte de cantos de Chaikin: cada volta troca cada aresta por dois pontos a
 * 1/4 e 3/4 dela, e a forma converge para uma curva macia (margens de água, caminhos). Aberta, mantém as pontas.
 * valores (opcional) anda junto, um número por ponto (a largura de um canal).
 */
export function suavizar(pontos, { voltas = 3, fechado = true, valores = null } = {}) {
  let P = pontos.slice();
  let W = valores ? valores.slice() : null;
  for (let v = 0; v < voltas; v++) {
    const n = P.length / 2;
    const Q = [];
    const U = [];
    const m = fechado ? n : n - 1;
    if (!fechado) {
      Q.push(P[0], P[1]);
      if (W) U.push(W[0]);
    }
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % n;
      Q.push(0.75 * P[2 * i] + 0.25 * P[2 * j], 0.75 * P[2 * i + 1] + 0.25 * P[2 * j + 1]);
      Q.push(0.25 * P[2 * i] + 0.75 * P[2 * j], 0.25 * P[2 * i + 1] + 0.75 * P[2 * j + 1]);
      if (W) U.push(0.75 * W[i] + 0.25 * W[j], 0.25 * W[i] + 0.75 * W[j]);
    }
    if (!fechado) {
      Q.push(P[2 * n - 2], P[2 * n - 1]);
      if (W) U.push(W[n - 1]);
    }
    P = Q.map((x) => Math.round(x * 100) / 100);
    W = W ? U : null;
  }
  return valores ? { pontos: P, valores: W } : P;
}

/**
 * Contorno (pares) de um canal: eixo em pontos [x, z, ...] e largura por ponto. Sentido: um lado, a ponta de baixo, o
 * outro lado e a cabeceira. As pontas fecham em meia volta (bacia redonda, como a cabeceira e a foz de um canal de
 * parque), não no corte reto de uma vala. Trigonometria de comum/util.js: a cava vai para a simulação (D5).
 */
export function contornoDoCanal(eixo, larguras, { passosPonta = 6 } = {}) {
  const n = eixo.length / 2;
  const esq = [];
  const dir = [];
  const tan = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    let tx = eixo[2 * b] - eixo[2 * a];
    let tz = eixo[2 * b + 1] - eixo[2 * a + 1];
    const t = Math.sqrt(tx * tx + tz * tz) || 1;
    tx /= t;
    tz /= t;
    tan.push(tx, tz);
    const m = larguras[i] / 2;
    esq.push(eixo[2 * i] - tz * m, eixo[2 * i + 1] + tx * m);
    dir.push(eixo[2 * i] + tz * m, eixo[2 * i + 1] - tx * m);
  }
  // meia volta em torno da ponta i, do lado lx, lz para o oposto, passando por fx, fz (a frente da ponta)
  const ponta = (i, lx, lz, fx, fz) => {
    const out = [];
    const m = larguras[i] / 2;
    for (let k = 1; k < passosPonta; k++) {
      const th = (k / passosPonta) * Math.PI;
      const c = cos(th);
      const s = sen(th);
      out.push(Math.round((eixo[2 * i] + m * (c * lx + s * fx)) * 100) / 100, Math.round((eixo[2 * i + 1] + m * (c * lz + s * fz)) * 100) / 100);
    }
    return out;
  };
  const u = n - 1;
  const fim = ponta(u, -tan[2 * u + 1], tan[2 * u], tan[2 * u], tan[2 * u + 1]);
  const volta = [];
  for (let i = n - 1; i >= 0; i--) volta.push(dir[2 * i], dir[2 * i + 1]);
  const cabeceira = ponta(0, tan[1], -tan[0], -tan[0], -tan[1]);
  return [...esq, ...fim, ...volta, ...cabeceira];
}

// ------------------------------------------------------------------------------------------------ os três planos

/*
 * Cada plano: { id, nome, referencias, ideia, gleba (contorno), torre { x, z, rot }, partes: [{ id, nome, pecas }],
 * paisagem { parques, pracas, passeios, bosques }, vias (internas, candidatas), portoes, camera }.
 * Partes (D59): torre, lago (reservatório lago.e1), sede (Sede com as Torres do Conselho), anel (moradia em
 * anfiteatro), biblioteca (Diamante), vida (casca tipo Jewel e Supertrees), escola, universidade, fisica.
 * Tipos de peça (render/arcologia/partes.js desenha a silhueta LOD1 de cada um):
 *   torre { x, z, rot }                                   a Torre Lâmina (render/arcologia/torre.js)
 *   reservatorio { contorno, nivel, fundo, borda }         espelho d'água; nivel e fundo relativos à cota da gleba
 *   barragem { de, ate, largura }                          Marina Barrage: comportas e cobertura verde caminhável
 *   podio { contorno, altura }                             plataforma de Hudson Yards (lojas, praça no teto)
 *   sede { arco: { cx, cz, r, de, ate }, fundo, altura }   faixa curva com moldura de pedra e cobertura solar
 *   conselho { x, z, rot, altura }                         torre de 36 x 26 m com cantos de raio 6
 *   anel { arco | caminho, fundo, alturas, portais? }      faixa contínua em anfiteatro (vãos de ~30 m com juntas de 3 m),
 *                                                          o lado de dentro em terraços verdes; portais abrem vãos de 40 m
 *   biblioteca { x, z, rot }                               placa dobrada em diamante (76 x 76), esfera e pináculo
 *   vida { x, z, rot, diametro, altura }, supertree { x, z, altura }
 *   escola { x, z, rot }                                   gota baixa em volta do campo, cobertura em anel
 *   universidade { x, z, rot }                             laje ondulada com pátios redondos e duas torres de laboratório
 *   fisica { arco, raioTubo, altura }                      dois tubos de aço sobre pilares em V e ondas de terra
 */

// ---------- A "Baía": Marina Bay, Gardens by the Bay e Marina Barrage ----------
// A água no meio e o skyline em volta. O reservatório é a baía interna, fechada para o mar por uma barragem com teto
// verde; a Torre ocupa a ponta de terra da margem norte e vira a lâmina estreita para a barragem e o mar; o Anel sobe
// da margem oeste para o norte como a plateia de um anfiteatro; a Sede e as Torres do Conselho fecham a margem
// nordeste; a Biblioteca pousa na margem leste, sobre a água; a Vida e as Supertrees ficam no oeste, junto da lagoa,
// como os jardins da baía.
const A_CENTRO = [240, 770];
const PLANO_A = {
  id: 'A',
  nome: 'Baía',
  referencias: ['Marina Bay', 'Gardens by the Bay', 'Marina Barrage', 'Marina Bay Sands'],
  ideia: 'a água no meio, o skyline em volta e a barragem para o mar',
  gleba: [-340, 180, 660, 180, 660, 940, -340, 940],
  torre: { x: 150, z: 566, rot: 0.62 },
  partes: [
    { id: 'torre', nome: 'Torre Lâmina', pecas: [{ tipo: 'torre' }] },
    {
      id: 'lago', nome: 'Reservatório',
      pecas: [
        {
          tipo: 'reservatorio', nivel: -2, fundo: -8, borda: 'degraus',
          // margens macias (Chaikin): a baía interna tem a curva de uma enseada, não a de um polígono
          contorno: suavizar([
            -60, 760, -30, 700, 30, 655, 105, 632, 190, 618, 270, 614, 345, 628, 420, 660, 490, 706, 555, 752, 612, 790,
            640, 808, 528, 922, 440, 918, 340, 908, 240, 892, 140, 866, 60, 836, -10, 804,
          ]),
        },
        { tipo: 'barragem', de: [648, 800], ate: [520, 930], largura: 26 },
      ],
    },
    {
      id: 'sede', nome: 'Sede e Torres do Conselho',
      pecas: [
        { tipo: 'sede', arco: { cx: A_CENTRO[0], cz: A_CENTRO[1], r: 340, de: 284, ate: 318 }, fundo: 26, altura: 33 },
        { tipo: 'conselho', x: 316, z: 408, altura: 150, olhar: A_CENTRO },
        { tipo: 'conselho', x: 520, z: 520, altura: 126, olhar: A_CENTRO },
      ],
    },
    {
      id: 'anel', nome: 'Anel de moradia',
      pecas: [{ tipo: 'anel', arco: { cx: A_CENTRO[0], cz: A_CENTRO[1], r: 372, de: 168, ate: 262 }, fundo: 28, alturas: [34, 66] }],
    },
    { id: 'biblioteca', nome: 'Biblioteca', pecas: [{ tipo: 'biblioteca', x: 590, z: 640, olhar: A_CENTRO }] },
    {
      id: 'vida', nome: 'Vida',
      pecas: [
        { tipo: 'vida', x: -236, z: 812, rot: 0.9, diametro: 96, altura: 70 },
        { tipo: 'supertree', x: -150, z: 900, altura: 50 },
        { tipo: 'supertree', x: -118, z: 872, altura: 42 },
        { tipo: 'supertree', x: -96, z: 910, altura: 36 },
        { tipo: 'supertree', x: -62, z: 884, altura: 46 },
        { tipo: 'supertree', x: -30, z: 916, altura: 30 },
        { tipo: 'supertree', x: -176, z: 872, altura: 34 },
      ],
    },
    { id: 'escola', nome: 'Escola', pecas: [{ tipo: 'escola', x: -218, z: 420, rot: 0.75 }] },
    { id: 'universidade', nome: 'Universidade', pecas: [{ tipo: 'universidade', x: 20, z: 280, rot: 0.12 }] },
    { id: 'fisica', nome: 'Centro de Física', pecas: [{ tipo: 'fisica', arco: { cx: A_CENTRO[0], cz: A_CENTRO[1], r: 548, de: 272, ate: 302 }, raioTubo: 7, altura: 9 }] },
  ],
  paisagem: {
    // anfiteatro verde entre o Anel e a água; parque dos jardins no oeste; orla de pedra em volta do reservatório
    parques: [
      [-120, 640, -40, 560, 60, 520, 160, 480, 90, 600, 20, 650, -30, 700, -70, 760, -110, 820, -200, 760],
      [-320, 700, -250, 690, -160, 760, -100, 830, -20, 860, 60, 880, 140, 900, 200, 930, -320, 935],
      [380, 470, 470, 510, 540, 600, 560, 700, 500, 690, 430, 640, 360, 610, 300, 590, 330, 520],
      [-330, 240, -120, 200, 140, 200, 340, 250, 340, 330, 160, 400, -60, 420, -250, 330],
    ],
    // a praça da Torre é a esplanada dela (torre.js); esta é a do Conselho
    pracas: [
      [420, 420, 520, 450, 500, 520, 400, 490],
    ],
    passeios: [
      { caminho: [-60, 770, -20, 690, 60, 640, 180, 612, 300, 612, 420, 650, 520, 718, 630, 796], largura: 14 },
      { caminho: [240, 190, 240, 330, 225, 450, 190, 540], largura: 18 },
    ],
    bosques: [
      { contorno: [-330, 480, -270, 470, -240, 600, -330, 640], densidade: 0.006 },
      { contorno: [560, 200, 650, 200, 650, 420, 580, 440], densidade: 0.005 },
    ],
  },
  vias: [
    { tipo: 'avenida', pontos: [240, 180, 240, 320, 232, 420, 210, 480] },
    { tipo: 'avenida', pontos: [-340, 560, -250, 540, -150, 470, -40, 440, 90, 470] },
    { tipo: 'avenida', pontos: [660, 430, 590, 440, 530, 470, 440, 470, 360, 460] },
  ],
  portoes: [
    { id: 'norte', x: 240, z: 180 },
    { id: 'oeste', x: -340, z: 560 },
    { id: 'leste', x: 660, z: 430 },
  ],
  camera: { x: 200, z: 640, dist: 1150, guinada: 18, inclinacao: 27 },
};

// ---------- B "Parque-canal": Songdo Central Park com o pódio de Hudson Yards ----------
// Um canal de água corta a gleba do noroeste até a baía, com o parque central nas duas margens. Na foz, um pódio de
// quarteirão (Hudson Yards) segura a Torre e as Torres do Conselho e abre a praça da Biblioteca para o canal; o Anel
// acompanha a margem sudoeste em blocos que sobem para o noroeste; a Vida marca a cabeceira do canal; a Escola e a
// Universidade ficam nas margens, com o parque na porta.
// o eixo corre da cabeceira (noroeste) à foz (sudeste) em S suave, com 25 m de amplitude, e alarga no lago do meio
// a cabeceira fica a ~25 m da casca da Vida, em terra (a Vida marca o começo do canal, não pousa dentro da cava)
const CANAL_B0 = [
  -211.3, 326.8, -129.3, 399, -41.8, 464, 51.2, 521.8, 147.5, 575, 243.8, 628.2, 336.8, 686, 424.3, 751, 506.3, 823.2,
  585, 900,
];
const LARG_B0 = [48, 56, 92, 132, 124, 72, 56, 56, 60, 64];
const { pontos: CANAL_B, valores: LARG_B } = suavizar(CANAL_B0, { voltas: 3, fechado: false, valores: LARG_B0 });
const PLANO_B = {
  id: 'B',
  nome: 'Parque-canal',
  referencias: ['Songdo Central Park', 'Hudson Yards', 'The Shops at Hudson Yards', 'Vessel'],
  ideia: 'um canal com o parque nas margens e um pódio de quarteirão na foz',
  gleba: [-340, 180, 660, 180, 660, 940, -340, 940],
  torre: { x: 500, z: 628, rot: 0.9 },
  partes: [
    {
      id: 'torre', nome: 'Torre Lâmina',
      pecas: [
        { tipo: 'torre' },
        { tipo: 'podio', altura: 18, contorno: [390, 560, 520, 540, 610, 590, 640, 680, 590, 740, 470, 720, 400, 660] },
      ],
    },
    { id: 'lago', nome: 'Reservatório', pecas: [{ tipo: 'reservatorio', nivel: -2, fundo: -7, borda: 'cais', contorno: contornoDoCanal(CANAL_B, LARG_B) }] },
    {
      id: 'sede', nome: 'Sede e Torres do Conselho',
      pecas: [
        { tipo: 'sede', arco: { cx: 500, cz: 1000, r: 470, de: 258, ate: 286 }, fundo: 24, altura: 33 },
        { tipo: 'conselho', x: 430, z: 575, altura: 150, olhar: [640, 900] },
        { tipo: 'conselho', x: 585, z: 700, altura: 124, olhar: [640, 900] },
      ],
    },
    {
      id: 'anel', nome: 'Anel de moradia',
      pecas: [{ tipo: 'anel', caminho: suavizar([-250, 470, -130, 548, 0, 600, 110, 646, 220, 704, 320, 764, 400, 832], { voltas: 2, fechado: false }), fundo: 26, alturas: [66, 34], lado: 'esquerda', portais: [0.3, 0.63] }],
    },
    { id: 'biblioteca', nome: 'Biblioteca', pecas: [{ tipo: 'biblioteca', x: 128, z: 452, olhar: [100, 520] }] },
    {
      id: 'vida', nome: 'Vida',
      pecas: [
        { tipo: 'vida', x: -268, z: 250, rot: 0.5, diametro: 96, altura: 70 },
        { tipo: 'supertree', x: -170, z: 250, altura: 48 },
        { tipo: 'supertree', x: -140, z: 290, altura: 40 },
        { tipo: 'supertree', x: -110, z: 250, altura: 34 },
        { tipo: 'supertree', x: -200, z: 212, altura: 30 },
        { tipo: 'supertree', x: -90, z: 300, altura: 44 },
      ],
    },
    { id: 'escola', nome: 'Escola', pecas: [{ tipo: 'escola', x: 250, z: 400, rot: 2.4 }] },
    { id: 'universidade', nome: 'Universidade', pecas: [{ tipo: 'universidade', x: -120, z: 700, rot: -0.55 }] },
    { id: 'fisica', nome: 'Centro de Física', pecas: [{ tipo: 'fisica', arco: { cx: 420, cz: 900, r: 660, de: 250, ate: 280 }, raioTubo: 7, altura: 9 }] },
  ],
  paisagem: {
    parques: [
      // as duas margens do canal (parque central)
      [-320, 330, -210, 280, -60, 360, 60, 410, 180, 470, 300, 540, 380, 590, 380, 640, 290, 650, 170, 590, 50, 540, -70, 480, -210, 420, -320, 420],
      [-300, 420, -150, 470, -40, 500, 70, 540, 170, 590, 280, 650, 400, 720, 470, 800, 540, 880, 580, 935, 460, 935, 380, 870, 300, 800, 180, 740, 60, 690, -80, 630, -200, 560, -310, 520],
      [-340, 780, -200, 760, -40, 800, 120, 860, 240, 900, 300, 935, -340, 935],
    ],
    pracas: [
      [300, 480, 380, 500, 380, 570, 320, 580],
      [180, 400, 260, 380, 290, 440, 210, 470],
    ],
    passeios: [
      { caminho: [-290, 300, -190, 370, -60, 440, 60, 500, 170, 560, 290, 626, 400, 700, 480, 780, 560, 860], largura: 12 },
    ],
    bosques: [
      { contorno: [-330, 560, -230, 600, -230, 760, -330, 760], densidade: 0.006 },
      { contorno: [380, 200, 650, 200, 650, 300, 400, 300], densidade: 0.004 },
    ],
  },
  vias: [
    { tipo: 'avenida', pontos: [160, 180, 170, 300, 200, 380, 300, 460, 390, 520] },
    { tipo: 'avenida', pontos: [660, 520, 610, 560, 540, 540] },
    { tipo: 'avenida', pontos: [-340, 640, -240, 650, -120, 760, 0, 820] },
  ],
  portoes: [
    { id: 'norte', x: 160, z: 180 },
    { id: 'leste', x: 660, z: 520 },
    { id: 'oeste', x: -340, z: 640 },
  ],
  camera: { x: 180, z: 600, dist: 1150, guinada: 26, inclinacao: 27 },
};

// ---------- C "Orla": Barangaroo com o Aterro do Flamengo ----------
// A orla vira um parque linear contínuo (o Aterro de Burle Marx), com o calçadão na borda da baía. Na ponta sudeste
// fica o grupo de torres (Barangaroo South): a Torre, as Torres do Conselho e a Sede atrás; na ponta sudoeste, junto
// da lagoa, o promontório naturalista (Barangaroo Reserve), com o reservatório numa cava de pedra em degraus. O Anel
// é um crescente voltado para a baía, atrás do parque; a Biblioteca e a Vida são os pavilhões do parque, como o MAM no
// Aterro; a Escola, a Universidade e a Física ocupam o alto, ao norte.
const C_CENTRO = [200, 1210];
const PLANO_C = {
  id: 'C',
  nome: 'Orla',
  referencias: ['Barangaroo', 'Barangaroo Reserve', 'Aterro do Flamengo', 'MAM Rio'],
  ideia: 'um parque linear na borda da baía, as torres numa ponta e o promontório na outra',
  gleba: [-340, 180, 660, 180, 660, 940, -340, 940],
  torre: { x: 555, z: 812, rot: 0.72 },
  partes: [
    { id: 'torre', nome: 'Torre Lâmina', pecas: [{ tipo: 'torre' }] },
    {
      id: 'lago', nome: 'Reservatório',
      pecas: [
        {
          tipo: 'reservatorio', nivel: -3, fundo: -10, borda: 'pedra',
          contorno: suavizar([-262, 782, -214, 738, -150, 728, -98, 748, -58, 790, -70, 842, -118, 880, -176, 872, -232, 884, -268, 840], { voltas: 2 }),
        },
      ],
    },
    {
      id: 'sede', nome: 'Sede e Torres do Conselho',
      pecas: [
        { tipo: 'sede', arco: { cx: 560, cz: 820, r: 190, de: 196, ate: 262 }, fundo: 24, altura: 33 },
        { tipo: 'conselho', x: 455, z: 760, altura: 150, olhar: [620, 940] },
        { tipo: 'conselho', x: 610, z: 668, altura: 128, olhar: [620, 940] },
      ],
    },
    {
      id: 'anel', nome: 'Anel de moradia',
      pecas: [{ tipo: 'anel', arco: { cx: C_CENTRO[0], cz: C_CENTRO[1], r: 540, de: 247, ate: 294 }, fundo: 28, alturas: [36, 64], portais: [0.5] }],
    },
    { id: 'biblioteca', nome: 'Biblioteca', pecas: [{ tipo: 'biblioteca', x: 250, z: 876, olhar: [250, 1000] }] },
    {
      id: 'vida', nome: 'Vida',
      pecas: [
        { tipo: 'vida', x: 40, z: 862, rot: 1.3, diametro: 96, altura: 70 },
        { tipo: 'supertree', x: 120, z: 900, altura: 44 },
        { tipo: 'supertree', x: 146, z: 868, altura: 36 },
        { tipo: 'supertree', x: 170, z: 910, altura: 30 },
        { tipo: 'supertree', x: -40, z: 910, altura: 40 },
        { tipo: 'supertree', x: -20, z: 872, altura: 32 },
      ],
    },
    { id: 'escola', nome: 'Escola', pecas: [{ tipo: 'escola', x: -200, z: 470, rot: 0.3 }] },
    { id: 'universidade', nome: 'Universidade', pecas: [{ tipo: 'universidade', x: 130, z: 420, rot: 0.08 }] },
    { id: 'fisica', nome: 'Centro de Física', pecas: [{ tipo: 'fisica', arco: { cx: 200, cz: 1210, r: 960, de: 262, ate: 290 }, raioTubo: 7, altura: 9 }] },
  ],
  paisagem: {
    parques: [
      // o Aterro: faixa verde da orla, de ponta a ponta
      [-340, 700, -250, 680, -120, 700, 0, 760, 120, 800, 250, 820, 360, 830, 430, 850, 470, 900, 480, 935, -340, 935],
      // o promontório (Reserve), mais largo e naturalista
      [-340, 600, -280, 610, -180, 640, -80, 690, -30, 760, -300, 780],
      // o alto ao norte, entre os prédios
      [-330, 240, 0, 210, 330, 230, 400, 330, 250, 520, 50, 530, -150, 560, -320, 380],
    ],
    pracas: [
      [470, 700, 540, 690, 580, 740, 500, 760],
    ],
    passeios: [
      { caminho: [-330, 920, -200, 912, -60, 924, 60, 928, 200, 924, 330, 910, 440, 916, 520, 926, 600, 934], largura: 16 },
      { caminho: [-300, 820, -200, 900, -80, 880, 40, 920, 160, 870, 280, 910, 400, 880], largura: 6 },
    ],
    bosques: [
      { contorno: [-340, 620, -240, 640, -150, 700, -270, 740, -340, 700], densidade: 0.009 },
      { contorno: [420, 200, 650, 200, 650, 380, 450, 400], densidade: 0.005 },
    ],
  },
  vias: [
    { tipo: 'avenida', pontos: [140, 180, 150, 300, 200, 400, 300, 520, 420, 620, 500, 690] },
    { tipo: 'avenida', pontos: [660, 560, 600, 600, 560, 640] },
    { tipo: 'avenida', pontos: [-340, 560, -200, 590, -60, 640, 80, 690] },
  ],
  portoes: [
    { id: 'norte', x: 140, z: 180 },
    { id: 'leste', x: 660, z: 560 },
    { id: 'oeste', x: -340, z: 560 },
  ],
  camera: { x: 170, z: 640, dist: 1150, guinada: 12, inclinacao: 27 },
};

/** Os três planos candidatos da D59, como dados (o integrador escolhe no portão 1). */
export const PLANOS = congelar({ A: PLANO_A, B: PLANO_B, C: PLANO_C });

/** Ordem das partes (o idx da seleção 'arcologia' é a posição aqui). */
export const PARTES_ORDEM = congelar(['torre', 'lago', 'sede', 'anel', 'biblioteca', 'vida', 'escola', 'universidade', 'fisica']);

/** Plano escolhido ('A' | 'B' | 'C'); null até o portão 1. */
export const PLANO_ESCOLHIDO = null;

/** Plano que o jogo mostra enquanto nenhum foi escolhido (a cidade sintética também usa este). */
export const PLANO_PADRAO = 'A';

/**
 * Posição provisória da Torre (até o integrador gravar o plano): a do plano padrão.
 * rot na convenção do three; com rot = 0 a frente (lado das penas) olha para +z (sul, a baía).
 */
export const TORRE_POSICAO = congelar({ ...PLANO_A.torre, provisoria: true });

/** Ponto de pouso do helicóptero da Holding (D61): o centro do heliponto; y acima da plataforma da Torre. */
export const POUSO = congelar({ ...torreParaMundo(TORRE_POSICAO, HELIPONTO_LOCAL.x, HELIPONTO_LOCAL.y, HELIPONTO_LOCAL.z), provisorio: true });

/** Câmera da Arcologia (voos e o botão da barra). Ângulos em graus (contratos/render.js). */
export const CAMERA_ARCOLOGIA = congelar({ x: 170, z: 640, dist: 1300, guinada: 28, inclinacao: 20 });

/**
 * A cava do reservatório de um plano como forma do aplainar (D5; X1b registra quando lago.e1 começa). A cota é a do
 * leito; a água fica em cotaGleba + nivel.
 * @returns {{ tipo: 'cava', ref: number, contorno: number[], cota: number, nivel: number }}
 */
export function cavaDoPlano(id, cotaGleba = GLEBA_ENVELOPE.cota, ref = 1) {
  const r = PLANOS[id].partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
  return { tipo: 'cava', ref, contorno: [...r.contorno], cota: cotaGleba + r.fundo, nivel: cotaGleba + r.nivel };
}
