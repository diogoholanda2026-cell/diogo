// Plano da Arcologia: a sede v3, Park of Future Dreams (D88 a D90), no sul da área inicial, de frente para o mar. A
// gleba é o disco da sede (o anel viário com a calçada); dentro dele, de fora para dentro: o anel viário, o Horizon Ring
// (a faculdade e a escola, em 8 trechos), o bosque com a Codex Tower, a Helix Labs e a Compass Tower, o Meridian Ring
// (os escritórios da Holding), o parque com as Supertrees, a praça, o anel de floresta, o Mirror Lake com as Dream Falls
// e as fontes, e o pódio redondo com a Blade Tower e a Legacy Tower ligadas pela Dream Bridge. As 8 avenidas radiais
// saem dos portões, a cada 45 graus, e seguem para a cidade. Medidas do modelo do dono (docs/pesquisa/sede/sede-v3.md).
// mapa-heldopolis.js importa a gleba daqui e assenta o platô em volta dela. Metros; x leste, z sul. Ângulos em graus no
// plano x-z, como no modelo: 0 = leste, 90 = sul, 180 = oeste, 270 = norte.
import { congelar, sen, cos, atan2, hipot } from '../comum/util.js';
import { girar } from '../comum/vetor.js';
import { ARESTA } from '../contratos/flags.js';

const cm = (v) => Math.round(v * 100) / 100;
const RAD = Math.PI / 180;

/** Ponto de um arco (graus no plano x-z: 0 leste, 90 sul). */
export function pontoDoArco(cx, cz, r, graus) {
  const a = graus * RAD;
  return [cx + r * cos(a), cz + r * sen(a)];
}

/** Pontos (pares x, z) de um arco de círculo em graus, de `de` a `ate`, a cada ~passo metros. */
export function pontosDoArco(cx, cz, r, de, ate, passo = 12) {
  const n = Math.max(2, Math.ceil((Math.abs(ate - de) * Math.PI * r) / 180 / passo));
  const P = [];
  for (let i = 0; i <= n; i++) {
    const [x, z] = pontoDoArco(cx, cz, r, de + ((ate - de) * i) / n);
    P.push(cm(x), cm(z));
  }
  return P;
}

/** Rotação (convenção do three) de quem está em (x, z) e olha para (ax, az). */
export const rotParaOlhar = (x, z, ax, az) => atan2(ax - x, az - z);

// ================================================================================================ o disco no mapa

/** Centro da sede no mapa (D90): no sul da área inicial, com o anel viário a mais de 40 m da lagoa, da praia e da baía. */
export const SEDE_CENTRO = congelar([200, 190]);
const [CX, CZ] = SEDE_CENTRO;

/** Cota da gleba: o platô em disco que mapa-heldopolis.js assenta. */
const COTA = 12;

/** Anel viário (o caminho de 792 m do modelo): avenida de 24 m com o eixo a 795 m do centro, de 783 a 807. */
export const ANEL_VIARIO = congelar({ raio: 795, largura: 24 });

/** Raio da gleba: a borda de fora do anel viário com a calçada. Os portões ficam nele. */
const R_GLEBA = 812;
const N_GLEBA = 128;

/** Avenidas radiais (D88): 8, a cada 45 graus, com o portão de cada uma na borda da gleba. */
export const AVENIDAS = congelar([0, 45, 90, 135, 180, 225, 270, 315]);
const PORTOES_ID = ['leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste', 'norte', 'nordeste'];

function circulo(cx, cz, r, n) {
  const P = [];
  for (let i = 0; i < n; i++) P.push(...pontoDoArco(cx, cz, r, (360 * i) / n).map(cm));
  return P;
}

/**
 * Gleba (D90): o disco da sede, do centro à calçada de fora do anel viário. Polígono de 128 lados no sentido horário
 * visto de cima (os portões caem em vértices). Cidade e vias de fora não entram (código 'gleba'): chegam aos portões.
 */
export const GLEBA_ENVELOPE = congelar({
  contorno: circulo(CX, CZ, R_GLEBA, N_GLEBA),
  caixa: [CX - R_GLEBA, CZ - R_GLEBA, CX + R_GLEBA, CZ + R_GLEBA],
  centro: [CX, CZ],
  raio: R_GLEBA,
  cota: COTA,
  nota: 'o disco da sede v3 (D90): o anel viário com a calçada; a cidade fica fora e chega pelos 8 portões',
});

/** true se (x, z) cai no disco da gleba (com folga, em metros). */
export const noDiscoDaSede = (x, z, folga = 0) => (x - CX) * (x - CX) + (z - CZ) * (z - CZ) <= (R_GLEBA + folga) * (R_GLEBA + folga);

// ================================================================================================ as torres

/**
 * Torres da Holding (D27, D64, D89): planta de 36 x 50 m, três lâminas verticais coladas pelo lado comprido, a mais
 * alta na face lisa e a mais baixa do lado das penas. As cotas saem da altura: os recuos ficam a 49%, 70% e 91% dela
 * (arredondados ao pavimento de 4,2 m), com os andares de vento de 6 m no terraço da lâmina 3 e logo abaixo do da
 * lâmina 2, e a coroa-lanterna do terraço da lâmina 1 até o topo. A altura conta do chão.
 *
 * Espaço local do modelo (render/arcologia/torre.js): origem no centro da planta, no chão; x ao longo dos 36 m; z ao
 * longo dos 50 m, da face lisa (z = -25) para as penas (z = +25), a frente (+z com rot = 0). A lâmina 1 vai de z = -25 a
 * +1, a 2 de +1 a +15 e a 3 de +15 a +25.
 */
const PE_TORRE = 4.2;
const PODIO_TORRE = 16;
const VENTO_TORRE = 6;
/** Frações da altura em que cada lâmina recua (D64: as mesmas da D27). */
export const RECUOS = congelar([0.49, 0.7, 0.91]);

/**
 * Medidas de uma torre de altura dada (cota do topo: o heliponto, na que tem, ou o aro da coroa).
 * @param {number} altura  metros
 * @param {{ nome?: string, heliponto?: boolean }} op  heliponto e mastro só na maior (D89)
 */
export function especTorre(altura, { nome = 'Blade Tower', heliponto = true } = {}) {
  const n = (base, alvo) => Math.max(1, Math.round((alvo - base) / PE_TORRE));
  const n3 = n(PODIO_TORRE, RECUOS[0] * altura);
  const topo3 = cm(PODIO_TORRE + n3 * PE_TORRE);
  const n2 = n(topo3 + VENTO_TORRE, RECUOS[1] * altura - VENTO_TORRE);
  const base2 = cm(topo3 + VENTO_TORRE + n2 * PE_TORRE);
  const topo2 = cm(base2 + VENTO_TORRE);
  const n1 = n(topo2, RECUOS[2] * altura);
  const topo1 = cm(topo2 + n1 * PE_TORRE);
  const coroa = cm(altura - topo1);
  return congelar({
    nome,
    altura,
    planta: { largura: 36, comprimento: 50, ladoEstreitoPara: 'mar' },
    // pódio de pedra da torre sozinha (a cena da Torre); no par da sede v3 as torres nascem dentro do pódio redondo
    podio: {
      altura: PODIO_TORRE, marquise: 12, largura: 52, tras: 6, frente: 14, chanfro: 6, passoPilares: 6, pilar: 1.4,
      marquiseLargura: 30, marquiseCota: 10.4, marquiseEspessura: 0.9, embasamento: 1.2,
    },
    // da face lisa para as penas: fundo de cada lâmina ao longo dos 50 m e cota do terraço-jardim que a fecha
    laminas: [
      { largura: 36, fundo: 26, topo: topo1 },
      { largura: 36, fundo: 14, topo: topo2 },
      { largura: 36, fundo: 10, topo: topo3 },
    ],
    pavimentos: { n: n1 + n2 + n3, altura: PE_TORRE },
    andaresDeVento: [
      { base: topo3, altura: VENTO_TORRE, recuo: 2 },
      { base: base2, altura: VENTO_TORRE, recuo: 2 },
    ],
    faceLisa: { costura: 6, vidro: 'escuro', aletas: 'densas', passoCostura: 0.75, recuoCostura: 0.8 },
    // aletas de bronze champanhe nas faces laterais (as de 50 m, que mostram as penas)
    aletas: { passo: 1.5, material: 'bronze', faces: 'laterais', fundo: 0.45, espessura: 0.26 },
    montantes: { passo: 1.5, fundo: 0.35, espessura: 0.14 },
    coroa: { base: topo1, altura: coroa, oca: Math.round(coroa * 0.414), fundo: 18, passoAletas: 0.75 },
    // heliponto em laca preta com aro de luz e o H dourado, em proa que avança 16 m além da frente da coroa
    heliponto: heliponto ? { cota: altura, balanco: 16, diametro: 28, espessura: 1.2 } : null,
    mastro: heliponto ? { topo: altura + 20, raio: 0.7, z: -22 } : null,
    // a linha de LED nas quinas das lâminas (D89), que conversa com a faixa dos anéis
    led: { largura: 0.35 },
    parapeito: 1.2,
    triangulos: {
      lod0: { media: [6000, 26000], alta: [40000, 70000], ultra: [40000, 70000], pc: [40000, 70000] },
      lod1: [2000, 5000],
    },
  });
}

/** Blade Tower (D89, a Torre Lâmina da D27 e da D64): 500 m no heliponto, o mastro a 520 m. */
export const TORRE_LAMINA = especTorre(500, { nome: 'Blade Tower', heliponto: true });

/** Legacy Tower (D89): a irmã de 452 m no aro da coroa, sem heliponto. */
export const TORRE_IRMA = especTorre(452, { nome: 'Legacy Tower', heliponto: false });

/**
 * O par no pódio redondo (D89): a Blade e a Legacy lado a lado, com os centros a 64 m (o modelo do dono: 63,6 m) e as
 * faces laterais de frente uma para a outra através de um vão de 28 m; as duas com as penas para o mar e a face lisa,
 * com a costura vertical, para o portão norte. A Dream Bridge atravessa o vão a 330 m: ponte-jardim de dois níveis, como
 * a das Petronas, com o jardim e a piscina do SkyPark do Marina Bay Sands no alto e as pernas inclinadas até as torres.
 * As torres nascem no chão; o pódio redondo de 40 m as cobre até a praça.
 *
 * Espaço do par: origem no centro do pódio; x pelo eixo das torres (a Blade em -32, a Legacy em +32); z ao longo das
 * torres (o z local de cada uma). rot = -30 graus põe o eixo a 30 graus no mapa, como no modelo.
 */
export const PAR = congelar({
  distancia: 64,
  vao: 28,
  rot: -Math.PI / 6,
  podio: 40,
  ponte: {
    nome: 'Dream Bridge',
    cota: 330, // o piso do jardim
    z0: -23, z1: -1, // na lâmina 1 das duas (a 2 da Legacy acaba a 318 m)
    espessura: 3.2,
    nivelFechado: 4.2, // o andar de vidro sob o jardim
    embute: 1.2, // quanto a ponte entra em cada fachada
    pernas: { cota: 286 }, // onde as pernas inclinadas encostam nas torres
  },
});

/**
 * As duas torres no mundo a partir do centro do par { x, z, rot }.
 * @returns {{ spec: object, lado: number, x: number, z: number, rot: number }[]}  a Blade primeiro
 */
export function torresDoPar(par) {
  const d = PAR.distancia / 2;
  const rot = par.rot ?? PAR.rot;
  return [
    { spec: TORRE_LAMINA, lado: -1 },
    { spec: TORRE_IRMA, lado: 1 },
  ].map(({ spec, lado }) => {
    const [dx, dz] = girar(lado * d, 0, rot);
    return { spec, lado, x: par.x + dx, z: par.z + dz, rot };
  });
}

/** Centro do heliponto no espaço local da Blade (z da frente da coroa mais o balanço, menos o raio). */
export const HELIPONTO_LOCAL = congelar({
  x: 0,
  y: TORRE_LAMINA.heliponto.cota,
  z: -25 + TORRE_LAMINA.coroa.fundo + TORRE_LAMINA.heliponto.balanco - TORRE_LAMINA.heliponto.diametro / 2,
});

/** Posição no mundo de um ponto local da Torre (lx, ly, lz) com a Torre em { x, z, rot }; y acima do chão. */
export function torreParaMundo(torre, lx, ly, lz) {
  const [dx, dz] = girar(lx, lz, torre.rot);
  return { x: torre.x + dx, y: ly, z: torre.z + dz };
}

// ================================================================================================ ajudas

/**
 * Suaviza uma poligonal (pares x, z) pelo corte de cantos de Chaikin: cada volta troca cada aresta por dois pontos a
 * 1/4 e 3/4 dela, e a forma converge para uma curva macia (caminhos, maciços de árvores). Aberta, mantém as pontas.
 */
export function suavizar(pontos, { voltas = 3, fechado = true } = {}) {
  let P = pontos.slice();
  for (let v = 0; v < voltas; v++) {
    const n = P.length / 2;
    const Q = [];
    const m = fechado ? n : n - 1;
    if (!fechado) Q.push(P[0], P[1]);
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % n;
      Q.push(0.75 * P[2 * i] + 0.25 * P[2 * j], 0.75 * P[2 * i + 1] + 0.25 * P[2 * j + 1]);
      Q.push(0.25 * P[2 * i] + 0.75 * P[2 * j], 0.25 * P[2 * i + 1] + 0.75 * P[2 * j + 1]);
    }
    if (!fechado) Q.push(P[2 * n - 2], P[2 * n - 1]);
    P = Q.map(cm);
  }
  return P;
}

/**
 * Contorno (pares) de um anel de água entre r0 e r1 como um polígono só: o círculo de fora e o de dentro (no sentido
 * contrário) ligados por uma fresta de 0,4 m a leste. A cava do aplainar não tem furo: o miolo (o pódio) fica de fora,
 * e a fresta fica sob a água (a transição de 8 m a cobre).
 */
export function contornoAnelDeAgua(cx, cz, r0, r1, n = 120) {
  const P = [];
  const e1 = 0.2 / r1;
  const e0 = 0.2 / r0;
  for (let i = 0; i <= n; i++) {
    const a = e1 + ((2 * Math.PI - 2 * e1) * i) / n;
    P.push(cm(cx + r1 * cos(a)), cm(cz + r1 * sen(a)));
  }
  for (let i = 0; i <= n; i++) {
    const a = 2 * Math.PI - e0 - ((2 * Math.PI - 2 * e0) * i) / n;
    P.push(cm(cx + r0 * cos(a)), cm(cz + r0 * sen(a)));
  }
  return P;
}

// ================================================================================================ a sede v3

/*
 * O plano: { id, nome, referencias, ideia, centro, gleba (contorno), torre { x, z, rot, par }, partes: [{ id, nome,
 * pecas }], paisagem, vias (internas, com a flag ARCOLOGIA), portoes, subsolo, camera }.
 * Partes (D89; PARTES_ORDEM): torre (Blade e Legacy no pódio, com a Dream Bridge), lago (o Mirror Lake, as Dream Falls
 * e as fontes), meridian (Meridian Ring), horizon (Horizon Ring, em 8 trechos com id próprio), codex
 * (Codex Tower), helix (Helix Labs), compass (Compass Tower) e parque (o parque dentro do Meridian Ring, o anel de
 * floresta e as Supertrees). Tipos de peça (render/arcologia/partes.js desenha cada um):
 *   torre                                                  o par (render/arcologia/torre.js)
 *   podio { cx, cz, raio, altura, escadas: [graus], cachoeiras, abertura }   o pódio redondo (vai com as torres)
 *   reservatorio { forma: 'anel', r0, r1, nivel, fundo, contorno }   o Mirror Lake; nivel e fundo relativos à gleba
 *   cachoeira { cx, cz, raio, altura, angulos, abertura }  as Dream Falls, da borda do pódio para o lago
 *   fontes { cx, cz, r, n, evitar: [graus] }               os jatos dançantes no lago em anel
 *   anel { cx, cz, raio, fundo, altura, andares, de, ate, portais, vao, pe, led, teto }   um trecho de anel (Apple Park)
 *   codex { x, z, altura, rot }                            o prisma facetado de vidro escuro com o átrio de livros
 *   oval { x, z, altura, a, b, afina, torcao, rot, led }   a torre oval (afina: a escala da planta no topo)
 *   floresta { cx, cz, r0, r1 }                            o anel de floresta em volta do lago
 *   jardim { cx, cz, r0, r1 }                              o parque: gramados, bosques e caminhos
 *   supertree { x, z, altura }, passarela { pontos, cota } as Supertrees e a passarela entre elas
 */

const anelDoMapa = (r, de, ate, passo) => pontosDoArco(CX, CZ, r, de, ate, passo);
const noRaio = (r, a) => pontoDoArco(CX, CZ, r, a).map(cm);

/** Horizon Ring (D88 e D89): eixo a 729 m, 60 de fundo, 160 m e 25 andares; a faculdade e a escola. */
export const HORIZON = congelar({ raio: 729, fundo: 60, altura: 160, andares: 25 });
/** Meridian Ring (D88): eixo a 442,5 m, 50 de fundo, 120 m e 19 andares; os escritórios da Holding. */
export const MERIDIAN = congelar({ raio: 442.5, fundo: 50, altura: 120, andares: 19 });
/** Pórticos (D88): onde cada avenida cruza um anel, ele passa por cima num vão de 40 m por 18 m. */
const PORTICO = { vao: 40, pe: 18 };
/** Pódio, lago, floresta e praça (do centro para fora). */
export const PODIO = congelar({ raio: 84, altura: 40 });
export const LAGO = congelar({ r0: 84, r1: 99, nivel: -0.6, fundo: -2.6 });
export const FLORESTA = congelar({ r0: 100.5, r1: 114 });
export const PRACA = congelar({ r0: 114, r1: 150 });

/**
 * Faixa de LED de cada peça (D88): contínua, um andar no meio da altura de cada anel, entre duas marquises (com dois
 * andares ela lia como um cinto largo); nas torres ovais, na mesma altura da do Horizon Ring (a que o olho segue de
 * longe). y0 e y1 acima do chão.
 */
const ledNoMeio = (A) => {
  const pe = A.altura / A.andares;
  return { y0: cm(A.altura / 2 - pe / 2), y1: cm(A.altura / 2 + pe / 2) };
};
const LED_HORIZON = ledNoMeio(HORIZON);
const LED_MERIDIAN = ledNoMeio(MERIDIAN);

/** Os 8 trechos do Horizon Ring, entre as avenidas (D89): 2 até jun. 2026 e os outros 6 até 2032. */
export const TRECHOS_HORIZON = congelar(
  AVENIDAS.map((de, k) => ({
    id: `horizon.${k + 1}`,
    nome: `Horizon Ring ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][k]}`,
    de,
    ate: de + 45,
    // a primeira fase fica de frente para o portão norte, por onde a cidade chega
    fase: de === 225 || de === 270 ? 1 : 2,
  })),
);

/** As torres entre os anéis (D88): perto do raio 583, nos ângulos do modelo, a mais de 60 m do eixo das avenidas. */
const R_TORRES = 583;
const TORRES_DO_BOSQUE = { codex: 200, helix: 323, compass: 80 };
const naRota = (a) => -a * RAD + Math.PI / 2; // rot de quem tem o eixo comprido (x local) tangente ao anel no ângulo a

// Supertrees (Gardens by the Bay): três bosques no parque, entre as avenidas, com a passarela no maior
const SUPERTREES = [
  // bosque grande, a sudeste do pódio, de frente para o lago e o mar
  [22, 250, 50], [12, 290, 42], [32, 300, 46], [18, 330, 34], [28, 215, 38], [8, 238, 30], [36, 262, 32],
  // bosque do oeste, perto da Codex
  [197, 260, 44], [208, 300, 36], [188, 305, 30], [214, 238, 28],
  // bosque do norte, na chegada pelo portão norte
  [290, 260, 40], [300, 300, 34], [282, 300, 28], [296, 230, 26],
].map(([a, r, h]) => ({ tipo: 'supertree', x: noRaio(r, a)[0], z: noRaio(r, a)[1], altura: h }));

/** A passarela do bosque grande (a OCBC Skyway): um arco a 22 m entre as Supertrees mais altas. */
const PASSARELA = { tipo: 'passarela', cota: 22, largura: 2.6, pontos: [...noRaio(250, 22), ...noRaio(292, 14), ...noRaio(300, 32), ...noRaio(262, 36), ...noRaio(250, 22)] };

const PLANO_A = {
  id: 'A',
  nome: 'Park of Future Dreams',
  versao: 3,
  referencias: [
    'Apple Park', 'McLaren Technology Centre', 'Torres Petronas', 'Marina Bay Sands SkyPark', 'Black Diamond (Copenhague)',
    'Biblioteca de Tianjin Binhai', 'Gardens by the Bay', 'Torre Generali',
  ],
  ideia: 'dois anéis de vidro com uma marquise branca por andar abraçam o parque; no centro, as torres no pódio sobre o lago',
  centro: [CX, CZ],
  gleba: GLEBA_ENVELOPE.contorno,
  // centro do par (o pódio); as duas torres saem de torresDoPar()
  torre: { x: CX, z: CZ, rot: PAR.rot, par: true },
  partes: [
    {
      id: 'torre', nome: 'Blade Tower and Legacy Tower',
      pecas: [
        { tipo: 'torre' },
        // o pódio redondo de 40 m de onde as torres saem, com a praça no topo e as 4 escadas rolantes de vidro (fora
        // das cachoeiras); vai com as torres (elas nascem nele)
        { tipo: 'podio', cx: CX, cz: CZ, raio: PODIO.raio, altura: PODIO.altura, escadas: [15, 150, 195, 330], cachoeiras: [60, 240], abertura: 60 },
      ],
    },
    {
      id: 'lago', nome: 'Mirror Lake',
      pecas: [
        {
          tipo: 'reservatorio', nome: 'Mirror Lake', forma: 'anel', cx: CX, cz: CZ, r0: LAGO.r0, r1: LAGO.r1,
          nivel: LAGO.nivel, fundo: LAGO.fundo, contorno: contornoAnelDeAgua(CX, CZ, LAGO.r0, LAGO.r1),
        },
        // Dream Falls: duas cachoeiras de 40 m da borda do pódio, a 60 e a 240 graus, em arcos de 60 graus
        { tipo: 'cachoeira', nome: 'Dream Falls', cx: CX, cz: CZ, raio: PODIO.raio, altura: PODIO.altura, angulos: [60, 240], abertura: 60 },
        // fontes dançantes no lago, fora das cachoeiras e das escadas rolantes
        { tipo: 'fontes', cx: CX, cz: CZ, r: 92, n: 120, evitar: [[30, 90], [210, 270], [9, 21], [144, 156], [189, 201], [324, 336]] },
      ],
    },
    {
      id: 'meridian', nome: 'Meridian Ring',
      pecas: [{
        tipo: 'anel', id: 'meridian', cx: CX, cz: CZ, ...MERIDIAN, de: 0, ate: 360, portais: [...AVENIDAS], ...PORTICO, led: LED_MERIDIAN,
        teto: 'jardim',
      }],
    },
    {
      id: 'horizon', nome: 'Horizon Ring',
      pecas: TRECHOS_HORIZON.map((t) => ({
        tipo: 'anel', id: t.id, nome: t.nome, cx: CX, cz: CZ, ...HORIZON, de: t.de, ate: t.ate, portais: [t.de, t.ate], ...PORTICO,
        led: LED_HORIZON, teto: 'esporte', fase: t.fase,
      })),
    },
    {
      id: 'codex', nome: 'Codex Tower',
      pecas: [{ tipo: 'codex', x: noRaio(R_TORRES, TORRES_DO_BOSQUE.codex)[0], z: noRaio(R_TORRES, TORRES_DO_BOSQUE.codex)[1], altura: 300, rot: naRota(TORRES_DO_BOSQUE.codex), olhar: [CX, CZ] }],
    },
    {
      id: 'helix', nome: 'Helix Labs',
      pecas: [{ tipo: 'oval', x: noRaio(R_TORRES, TORRES_DO_BOSQUE.helix)[0], z: noRaio(R_TORRES, TORRES_DO_BOSQUE.helix)[1], altura: 180, a: 27, b: 17, afina: 0.8, torcao: 32, rot: naRota(TORRES_DO_BOSQUE.helix), led: LED_HORIZON }],
    },
    {
      id: 'compass', nome: 'Compass Tower',
      pecas: [{ tipo: 'oval', x: noRaio(R_TORRES, TORRES_DO_BOSQUE.compass)[0], z: noRaio(R_TORRES, TORRES_DO_BOSQUE.compass)[1], altura: 180, a: 25, b: 16, afina: 0.84, torcao: 0, rot: naRota(TORRES_DO_BOSQUE.compass), led: LED_HORIZON, coroa: 'agulha' }],
    },
    {
      id: 'parque', nome: 'Park of Future Dreams',
      pecas: [
        { tipo: 'floresta', cx: CX, cz: CZ, r0: FLORESTA.r0, r1: FLORESTA.r1 },
        { tipo: 'jardim', cx: CX, cz: CZ, r0: PRACA.r1, r1: MERIDIAN.raio - MERIDIAN.fundo / 2 - 6 },
        ...SUPERTREES,
        PASSARELA,
      ],
    },
  ],
  paisagem: {
    // a praça do pódio, onde as avenidas acabam, e os caminhos em anel do modelo entre os anéis (480 e 688; o de 290,
    // dentro do Meridian Ring, é do jardim)
    praca: { cx: CX, cz: CZ, r0: PRACA.r0, r1: PRACA.r1 },
    caminhos: [
      { cx: CX, cz: CZ, r: 480, largura: 10 },
      { cx: CX, cz: CZ, r: 688, largura: 10 },
    ],
    // o bosque entre os anéis (a Codex, a Helix e a Compass no meio dele) e a faixa verde entre o Horizon Ring e o anel
    // viário
    bosques: [
      { cx: CX, cz: CZ, r0: MERIDIAN.raio + MERIDIAN.fundo / 2 + 8, r1: HORIZON.raio - HORIZON.fundo / 2 - 8, densidade: 0.0042 },
      { cx: CX, cz: CZ, r0: HORIZON.raio + HORIZON.fundo / 2 + 6, r1: ANEL_VIARIO.raio - ANEL_VIARIO.largura / 2 - 3, densidade: 0.003 },
    ],
  },
  // vias internas (D88), com a flag ARCOLOGIA: o anel viário em 8 arcos entre as avenidas, os 8 trechos curtos dos
  // portões até o anel e as 8 avenidas do anel até a praça do pódio. A X1b liga no grafo quando lago.e1 fica pronta
  vias: [
    ...AVENIDAS.map((de) => ({
      tipo: 'avenida', largura: ANEL_VIARIO.largura, flags: ARESTA.ARCOLOGIA, anel: true,
      arco: { cx: CX, cz: CZ, r: ANEL_VIARIO.raio, de, ate: de + 45 },
      pontos: anelDoMapa(ANEL_VIARIO.raio, de, de + 45, 20),
    })),
    ...AVENIDAS.map((a) => ({ tipo: 'avenida', largura: 24, flags: ARESTA.ARCOLOGIA, portao: true, pontos: [...noRaio(R_GLEBA, a), ...noRaio(ANEL_VIARIO.raio, a)] })),
    ...AVENIDAS.map((a) => ({ tipo: 'avenida', largura: 24, flags: ARESTA.ARCOLOGIA, radial: true, pontos: [...noRaio(ANEL_VIARIO.raio, a), ...noRaio(PRACA.r1, a)] })),
  ],
  portoes: AVENIDAS.map((a, k) => {
    const [x, z] = noRaio(R_GLEBA, a);
    return { id: PORTOES_ID[k], x, z, angulo: a };
  }),
  // subsolo (D88; fora do M1a, só dados): os data centers sob as torres e o acelerador, o projeto secreto do Caio
  subsolo: {
    deepCore: { nome: 'Deep Core', grade: [3, 3], lado: 34, passo: 46, profundidade: 26, resfriamento: 92 },
    lumenCollider: { nome: 'Lumen Collider', raio: 330, profundidade: 48, saloes: [45, 135, 225, 315] },
  },
  // o disco inteiro às 17h30, do sul-sudoeste, com as torres no meio (CAMERA_ARCOLOGIA)
  camera: { x: CX, z: CZ + 60, dist: 2600, guinada: 20, inclinacao: 30 },
};

/**
 * Mata do parque (densidade de 0 a 1, a da grade espelho.floresta) num ponto do disco, ou null fora dele: o anel de
 * floresta em volta do lago, os maciços do parque entre as clareiras, o bosque entre os anéis (com as clareiras das
 * torres e dos caminhos) e a faixa verde atrás do Horizon Ring. Os anéis, as vias, a praça e os gramados ficam abertos.
 * Para a grade da mata (a S1a pinta quando o parque fica pronto; as cenas pintam a da simulação de prova).
 */
export function mataDaSede(x, z) {
  const dx = x - CX;
  const dz = z - CZ;
  // as funções de comum/util (as mesmas em todo motor de JS): a S1a pinta a grade da mata da simulação com isto
  const r = hipot(dx, dz);
  if (r > R_GLEBA) return null;
  const a = ((atan2(dz, dx) / RAD) % 360 + 360) % 360;
  // as avenidas radiais (24 m) com 4 m de calçada de cada lado, do anel viário à praça
  const naAvenida = AVENIDAS.some((g) => {
    const d = ((a - g + 540) % 360) - 180;
    return Math.abs(d) < 90 && Math.abs(r * sen(d * RAD)) < 16;
  });
  if (naAvenida && r > PRACA.r1 - 2) return 0;
  const ruido = 0.5 + 0.25 * sen(dx / 61 + 1.3 * cos(dz / 83)) + 0.25 * cos(dz / 47 - 0.7 * sen(dx / 71));
  if (r >= FLORESTA.r0 && r <= FLORESTA.r1) return 0.92;
  if (r > PRACA.r1 + 8 && r < MERIDIAN.raio - MERIDIAN.fundo / 2 - 12) {
    // o parque: maciços nas bordas e gramados abertos no meio (Burle Marx); a clareira do caminho de 290 m
    if (Math.abs(r - 290) < 9) return 0.05;
    return ruido > 0.62 ? 0.86 : 0.06;
  }
  const r0 = MERIDIAN.raio + MERIDIAN.fundo / 2 + 10;
  const r1 = HORIZON.raio - HORIZON.fundo / 2 - 10;
  if (r > r0 && r < r1) {
    if (Math.abs(r - 480) < 9 || Math.abs(r - 688) < 9) return 0.05;
    for (const t of Object.values(TORRES_DO_BOSQUE)) {
      const [tx, tz] = pontoDoArco(CX, CZ, R_TORRES, t);
      if (hipot(x - tx, z - tz) < 80) return 0.05;
    }
    return ruido > 0.36 ? 0.88 : 0.1;
  }
  if (r > HORIZON.raio + HORIZON.fundo / 2 + 8 && r < ANEL_VIARIO.raio - ANEL_VIARIO.largura / 2 - 4) return ruido > 0.3 ? 0.8 : 0.2;
  return 0;
}

/** O plano da sede v3 (o portão 1 já passou: os planos B e C saíram). */
export const PLANOS = congelar({ A: PLANO_A });

/** Ordem das partes (o idx da seleção 'arcologia' é a posição aqui; os trechos do Horizon Ring dão o mesmo idx). */
export const PARTES_ORDEM = congelar(['torre', 'lago', 'meridian', 'horizon', 'codex', 'helix', 'compass', 'parque']);

/** Nome em inglês de cada parte (D89), na ordem de PARTES_ORDEM. */
export const PARTES_NOMES = congelar(Object.fromEntries(PLANO_A.partes.map((p) => [p.id, p.nome])));

/** Plano escolhido (o A, a sede v3). */
export const PLANO_ESCOLHIDO = 'A';

/** Plano que o jogo mostra enquanto nenhum foi escolhido (a cidade sintética também usa este). */
export const PLANO_PADRAO = 'A';

/**
 * Posição da Blade Tower no plano (no par): rot na convenção do three; com rot = 0 a frente (lado das penas) olha
 * para +z (sul); no par as duas olham para o mar, a 120 graus no mapa.
 */
export function torreDoPlano(id) {
  const t = PLANOS[id].torre;
  const { x, z, rot } = torresDoPar(t)[0];
  return { x: cm(x), z: cm(z), rot };
}

export const TORRE_POSICAO = congelar(torreDoPlano(PLANO_ESCOLHIDO));

/** Ponto de pouso do helicóptero da Holding (D61): o centro do heliponto da Blade; y acima do chão. */
export const POUSO = congelar({ ...torreParaMundo(TORRE_POSICAO, HELIPONTO_LOCAL.x, HELIPONTO_LOCAL.y, HELIPONTO_LOCAL.z) });

/**
 * Câmera da Arcologia (voos e o botão da barra): o disco inteiro às 17h30, do sul-sudoeste, com as torres no meio.
 * Ângulos em graus (contratos/render.js).
 */
export const CAMERA_ARCOLOGIA = congelar({ ...PLANOS[PLANO_ESCOLHIDO].camera });

/**
 * A cava do Mirror Lake (o reservatório da lago.e1) como forma do aplainar (D5; X1b registra quando lago.e1 começa):
 * o anel de água em volta do pódio. A cota é a do leito; a água fica em cotaGleba + nivel.
 * @returns {{ tipo: 'cava', ref: number, contorno: number[], cota: number, nivel: number }}
 */
export function cavaDoPlano(id, cotaGleba = GLEBA_ENVELOPE.cota, ref = 1) {
  const r = PLANOS[id].partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
  return { tipo: 'cava', ref, contorno: [...r.contorno], cota: cotaGleba + r.fundo, nivel: cotaGleba + r.nivel };
}
