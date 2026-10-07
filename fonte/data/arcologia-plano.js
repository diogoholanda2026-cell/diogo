// Plano da Arcologia: a sede v4 (D97) sobre a v3, Park of Future Dreams (D88 a D90), no sul da área inicial, de frente
// para o mar. A gleba é o disco da sede (o anel viário com a calçada); dentro dele, de fora para dentro: o anel viário, o
// Horizon Ring (a faculdade e a escola, em 8 trechos, com o Halo Lake ao pé da face de dentro e as 8 Canopy Bridges),
// o bosque denso com a Codex Tower, a Helix Labs e a Compass Tower no eixo de três avenidas, o Meridian Ring (os
// escritórios da Holding, com as quatro Dream Falls de 120 m na face de dentro), o parque na margem do Mirror Lake
// grande (com ilhas de mata e enseadas até o anel), a praça, o anel de floresta, o anel d'água do pódio com as fontes e
// o pódio redondo com a Blade Tower e a Legacy Tower ligadas pela Dream Bridge. As 8 avenidas radiais saem dos portões,
// a cada 45 graus, e seguem para a cidade. Medidas do modelo do dono (docs/pesquisa/sede/sede-v3.md) e da ficha da D97
// (docs/pesquisa/sede/sede-v4.md).
// mapa-heldopolis.js importa a gleba daqui e assenta o platô em volta dela. Metros; x leste, z sul. Ângulos em graus no
// plano x-z, como no modelo: 0 = leste, 90 = sul, 180 = oeste, 270 = norte.
import { congelar, sen, cos, atan2, hipot, smoothstep } from '../comum/util.js';
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

// ================================================================================================ a sede v4

/*
 * O plano: { id, nome, referencias, ideia, centro, gleba (contorno), torre { x, z, rot, par }, partes: [{ id, nome,
 * pecas }], paisagem, vias (internas, com a flag ARCOLOGIA), portoes, subsolo, camera }.
 * Partes (D89; PARTES_ORDEM): torre (Blade e Legacy no pódio, com a Dream Bridge), lago (o Mirror Lake grande com as
 * ilhas e as pontes baixas, o anel d'água do pódio, as Dream Falls e as fontes), meridian (Meridian Ring), horizon
 * (Horizon Ring, em 8 trechos com id próprio, cada um com a Canopy Bridge que pousa nele e o pedaço do Halo Lake que lhe
 * cabe), codex (Codex Tower), helix (Helix Labs), compass (Compass Tower) e parque (o parque na margem do lago, o anel
 * de floresta e as Supertrees). Tipos de peça (render/arcologia/partes.js desenha cada um):
 *   torre                                                  o par (render/arcologia/torre.js)
 *   podio { cx, cz, raio, altura, escadas: [graus], cachoeiras, abertura }   o pódio redondo (vai com as torres)
 *   reservatorio { forma: 'anel', r0, r1, nivel }          o anel d'água do pódio (bacia à altura do chão, com as fontes)
 *   lago { r0, nivel, fundo, banco, contorno, margem, ilhas, pontes }   o Mirror Lake grande (cava no relevo)
 *   queda { cx, cz, angulo, largura, altura, rTopo }       uma das 4 Dream Falls de 120 m (do Meridian Ring para o lago)
 *   cachoeira { cx, cz, raio, altura, angulos, abertura }  as duas quedas de 40 m do pódio para o anel d'água
 *   fontes { cx, cz, r, n, evitar: [graus] }               os jatos dançantes no anel d'água
 *   bacia { id, r0, r1, de, ate, lacunas, nivel, cais }    o Halo Lake (um pedaço por trecho do Horizon Ring)
 *   ponte { id, angulo, r0, r1, cota, largura, torre }     uma Canopy Bridge (a que pousa no trecho do Horizon Ring)
 *   anel { cx, cz, raio, fundo, altura, andares, de, ate, portais, vao, pe, led, terracos, quedas, teto }   um anel
 *   codex { x, z, altura, rot }                            o prisma facetado de vidro escuro com o átrio de livros
 *   oval { x, z, altura, a, b, afina, torcao, rot, led }   a torre oval (afina: a escala da planta no topo)
 *   floresta { cx, cz, r0, r1 }                            o anel de floresta em volta do pódio
 *   jardim { cx, cz, r0, r1 }                              o parque da margem: caminho em anel, praças e palmeiras
 *   supertree { x, z, altura }, passarela { pontos, cota } as Supertrees e a passarela entre elas
 */

const anelDoMapa = (r, de, ate, passo) => pontosDoArco(CX, CZ, r, de, ate, passo);
const noRaio = (r, a) => pontoDoArco(CX, CZ, r, a).map(cm);
const dif = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;

/**
 * Andares da faixa de LED de um anel (D93): um terço dos andares, no terço do meio da altura. Ímpar, para a faixa
 * centrada no meio da altura cair inteira entre duas lajes (a moldura das marquises): 9 dos 25 andares do Horizon Ring e
 * 7 dos 19 do Meridian Ring.
 */
export const andaresDaFaixaLed = (andares) => 2 * Math.round((andares / 3 - 1) / 2) + 1;

/** Faixa de LED de um anel (D93): { y0, y1, andares }, contínua em volta toda, centrada na altura, com y em metros. */
function ledDoAnel(altura, andares) {
  const n = andaresDaFaixaLed(andares);
  const meia = (n * altura) / andares / 2;
  const r1 = (v) => Math.round(v * 10) / 10;
  return congelar({ y0: r1(altura / 2 - meia), y1: r1(altura / 2 + meia), andares: n });
}

/**
 * Um anel (Apple Park): eixo no raio, fundo, altura, andares, a faixa de LED (D93) e os Hanging Gardens (D97): na face de
 * dentro o prédio recua `recuo` m a cada terraço, nos andares de `linhas` (com a faixa de LED num degrau só, sem
 * terraço no meio dela); a face de fora segue vidro e marquise branca.
 */
const anelDe = (raio, fundo, altura, andares, terracos) => congelar({ raio, fundo, altura, andares, led: ledDoAnel(altura, andares), terracos: congelar(terracos) });

/** Horizon Ring (D88 e D89): eixo a 729 m, 60 de fundo, 160 m e 25 andares; a faculdade e a escola. */
export const HORIZON = anelDe(729, 60, 160, 25, { linhas: [4, 8, 17, 21], recuo: 3 });
/** Meridian Ring (D88): eixo a 442,5 m, 50 de fundo, 120 m e 19 andares; os escritórios da Holding. */
export const MERIDIAN = anelDe(442.5, 50, 120, 19, { linhas: [3, 6, 13, 16], recuo: 2.5 });

/** Recuo (m) da face de dentro de um anel na altura y: um degrau de terraço para cada linha de terraço abaixo dela. */
export function recuoDaFaceNaAltura(A, y) {
  const pe = A.altura / A.andares;
  return A.terracos.linhas.filter((l) => l * pe <= y + 1e-6).length * A.terracos.recuo;
}

/** Raio da face de dentro (o vidro) de um anel na altura y, com os terraços dos Hanging Gardens. */
export const raioDaFaceDeDentro = (A, y) => A.raio - A.fundo / 2 + recuoDaFaceNaAltura(A, y);

/** Pórticos (D88): onde cada avenida cruza um anel, ele passa por cima num vão de 40 m por 18 m. */
const PORTICO = { vao: 40, pe: 18 };
/** Pódio, lago em anel do pódio, floresta e praça (do centro para fora). */
export const PODIO = congelar({ raio: 84, altura: 40 });
export const LAGO = congelar({ r0: 84, r1: 99, nivel: -0.6, fundo: -2.6 });
export const FLORESTA = congelar({ r0: 100.5, r1: 114 });
export const PRACA = congelar({ r0: 114, r1: 150 });
/** Nível (m acima do chão) da água do anel do pódio e do Halo Lake: bacias à altura do chão, com o coroamento de pedra. */
export const BACIA = congelar({ nivel: 0.3, coroamento: 0.65 });

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

/**
 * As torres entre os anéis (D97): no raio 583, no eixo da avenida mais perto do ângulo do modelo (a Codex em 180, a Helix em
 * 315 e a Compass em 90; a do portão norte, a 270, fica livre: é a entrada da primeira hora). Cada uma leva o pórtico de
 * 40 x 18 m na base, como os anéis, e a Canopy Bridge da avenida passa por ela em dois vãos de uns 90 m.
 */
export const R_TORRES = 583;
export const TORRES_DO_BOSQUE = congelar({ codex: 180, helix: 315, compass: 90 });
const naRota = (a) => -a * RAD + Math.PI / 2; // rot de quem tem o eixo comprido (x local) tangente ao anel no ângulo a
/** Meia profundidade radial de cada torre na altura das pontes (m), de onde cada vão da ponte pousa na fachada. */
const MEIA_NA_PONTE = congelar({ codex: 16, helix: 12.8, compass: 12.6 });

// ------------------------------------------------------------------------------------------------ o Mirror Lake grande

/** As 4 Dream Falls (D97): nos 4 ângulos que ficam entre as avenidas (22,5 + 45 k) e olham para a aérea e para o parque. */
export const QUEDAS_ANGULOS = congelar([67.5, 157.5, 247.5, 337.5]);
/** As 4 ilhas de mata, no meio dos outros quatro setores entre as avenidas. */
export const ILHAS_ANGULOS = congelar([22.5, 112.5, 202.5, 292.5]);

/**
 * O Mirror Lake grande (D97): de 150 m (o cais da praça do pódio) até uns 330 m, com a margem ondulada, 4 enseadas que
 * chegam ao Meridian Ring (as Dream Falls pousam nelas) e 4 ilhas de mata. `banco`: a distância (m) do contorno da cava
 * até a margem d'água (o aplainar dá 8 m de fundo plano e 16 m de rampa: a água de 0,6 m sob o chão corta a rampa a uns
 * 19 m); `enseada`: o raio da margem no fundo das enseadas.
 */
export const MIRROR = congelar({ r0: 150, base: 322, banco: 19, enseada: 413, nivel: LAGO.nivel, fundo: LAGO.fundo });

/** Raio (m) da margem d'água do Mirror Lake no ângulo dado (graus): a margem ondulada, e a enseada onde cai uma Dream Fall. */
export function margemDoLago(graus) {
  const a = graus * RAD;
  const base = MIRROR.base + 11 * sen(3 * a + 0.7) + 6 * sen(5 * a + 2.2) + 3 * sen(11 * a + 1);
  let r = base;
  for (const q of QUEDAS_ANGULOS) {
    // a enseada: reta no fundo (a 3,4 graus do eixo) e abrindo em 7,6 graus, até a margem do lago
    const t = 1 - smoothstep(3.4, 11, Math.abs(dif(graus, q)));
    r = Math.max(r, base + (MIRROR.enseada - base) * t);
  }
  return cm(r);
}

/** A margem em 360 passos de 1 grau (a malha do lago, o contorno da cava e a mata leem a mesma). */
const MARGEM = Array.from({ length: 360 }, (_, g) => margemDoLago(g));
/** Raio da margem d'água entre os passos de 1 grau (interpolado), para as leituras por ponto. */
export function raioDaMargem(graus) {
  const g = ((graus % 360) + 360) % 360;
  const i = Math.floor(g);
  const f = g - i;
  return MARGEM[i] * (1 - f) + MARGEM[(i + 1) % 360] * f;
}

/** As 4 ilhas de mata: centro no mundo, raio da margem d'água (visível) e raio do furo da cava (visível mais o banco). */
export const ILHAS = congelar(
  ILHAS_ANGULOS.map((ang, k) => {
    const r = [240, 246, 236, 244][k];
    const raio = [49, 44, 52, 46][k];
    const [x, z] = noRaio(r, ang);
    return congelar({ ang, r, x, z, raio, furo: raio + MIRROR.banco });
  }),
);

/** Contorno da cava do lago (pares x, z): a borda de fora, o cais de dentro e os furos das ilhas, ligados por frestas. */
function contornoDoLago() {
  const P = [];
  const e = 0.25;
  for (let g = e; g <= 360 - e + 1e-9; g += 1) P.push(...noRaio(MARGEM[Math.floor(g)] - MIRROR.banco, g));
  P.push(...noRaio(MARGEM[359] - MIRROR.banco, 360 - e));
  // o lado de dentro, de volta pelo cais, entrando em cada ilha pela fresta radial (as ilhas em ordem de ângulo
  // decrescente, no mesmo sentido do cais)
  const ilhas = [...ILHAS].sort((a, b) => b.ang - a.ang);
  let g = 360 - e;
  const cais = (de, ate) => {
    for (let q = de; q >= ate - 1e-9; q -= 3) P.push(...noRaio(MIRROR.r0, q));
  };
  for (const ilha of ilhas) {
    cais(g, ilha.ang + 0.01);
    g = ilha.ang;
    // fresta: do cais até a borda do furo, o círculo do furo no sentido do cais, e a volta pela mesma fresta
    const rBorda = ilha.r - ilha.furo;
    P.push(...noRaio(MIRROR.r0, ilha.ang), ...noRaio(rBorda, ilha.ang));
    const n = 48;
    for (let i = 1; i < n; i++) {
      const t = (2 * Math.PI * i) / n;
      // o ponto do círculo a partir da borda de dentro (o ângulo 0 aponta para o cais), girado para a direção da ilha
      const ux = cos(ilha.ang * RAD);
      const uz = sen(ilha.ang * RAD);
      const lx = -ilha.furo * cos(t);
      const lz = ilha.furo * sen(t);
      P.push(cm(ilha.x + ux * lx - uz * lz), cm(ilha.z + uz * lx + ux * lz));
    }
    P.push(...noRaio(rBorda, ilha.ang), ...noRaio(MIRROR.r0, ilha.ang));
  }
  cais(g, e);
  return P;
}

// ------------------------------------------------------------------------------------------------ Halo Lake

/** Halo Lake (D97): faixa d'água de 50 m ao pé da face de dentro do Horizon Ring (de 645 a 695 m), com o cais de 4 m até o vidro. */
export const HALO = congelar({ r0: 645, r1: 695, cais: 4, nivel: BACIA.nivel });
/** Meia largura (m) do corredor de uma avenida que a água não invade: a pista de 24 m e o guarda-corpo de pedra. */
export const CORREDOR_AVENIDA = 14;

// ------------------------------------------------------------------------------------------------ Canopy Bridges

/**
 * As 8 Canopy Bridges (D97): tabuleiro a 66 m (dentro das duas faixas de LED, entre duas marquises), 30 m de largura,
 * laje de 1,6 m e um arco raso por baixo (a flecha de 8,8 m em uns 237 m, uns 1/27) que nasce a 54,8 m nas duas faces.
 */
export const PONTE = congelar({ cota: 66, largura: 30, espessura: 1.6, nasce: 54.8, flecha: 8.8 });

/** Uma ponte por avenida: do Meridian Ring (face de fora) à face de dentro do Horizon Ring na altura dela. */
function pontesDoPlano() {
  const r0 = MERIDIAN.raio + MERIDIAN.fundo / 2;
  const r1 = raioDaFaceDeDentro(HORIZON, PONTE.cota);
  return AVENIDAS.map((angulo, k) => {
    const par = Object.entries(TORRES_DO_BOSQUE).find(([, g]) => g === angulo);
    return {
      tipo: 'ponte',
      id: `ponte.${k + 1}`,
      nome: `Canopy Bridge ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][k]}`,
      cx: CX,
      cz: CZ,
      angulo,
      r0,
      r1,
      ...PONTE,
      torre: par ? { id: par[0], r: R_TORRES, meia: MEIA_NA_PONTE[par[0]] } : null,
    };
  });
}
export const PONTES = congelar(pontesDoPlano());

// Supertrees (Gardens by the Bay): três bosques na margem do lago, entre as enseadas, com a passarela no maior
const SUPERTREES = [
  // bosque grande, a sudeste do pódio, de frente para o lago e o mar
  [17, 372, 46], [26.5, 380, 40], [21, 394, 34], [28.5, 366, 30],
  // bosque do oeste, perto da Codex
  [197, 376, 42], [207, 384, 36], [202, 396, 30],
  // bosque do norte, na chegada pelo portão norte
  [288, 372, 40], [297, 382, 34], [293, 396, 28],
].map(([a, r, h]) => ({ tipo: 'supertree', x: noRaio(r, a)[0], z: noRaio(r, a)[1], altura: h }));

/** A passarela do bosque grande (a OCBC Skyway): um arco a 22 m entre as Supertrees mais altas. */
const PASSARELA = { tipo: 'passarela', cota: 22, largura: 2.6, pontos: [...noRaio(372, 17), ...noRaio(380, 26.5), ...noRaio(394, 21), ...noRaio(372, 17)] };

/** Anel de pedra do passeio que acompanha a margem do lago, no parque (as palmeiras-imperiais dos dois lados). */
export const PASSEIO_DO_PARQUE = congelar({ r: 358, largura: 6 });

const PLANO_A = {
  id: 'A',
  nome: 'Park of Future Dreams',
  versao: 4,
  referencias: [
    'Apple Park', 'McLaren Technology Centre', 'Torres Petronas', 'Marina Bay Sands SkyPark', 'Black Diamond (Copenhague)',
    'Biblioteca de Tianjin Binhai', 'Gardens by the Bay', 'Torre Generali', 'The Crystal (Chongqing)', 'Rain Vortex (Jewel Changi)',
    'Bosco Verticale',
  ],
  ideia: 'dois anéis de vidro com terraços verdes por dentro e oito pontes-jardim entre eles abraçam o parque; no centro, o lago com ilhas de mata, as quedas de 120 m e as torres no pódio',
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
        // o lago grande: cavado no relevo (a cava do plano), com 4 ilhas de mata, 4 enseadas e 8 pontes baixas de pedra
        {
          tipo: 'lago', nome: 'Mirror Lake', cx: CX, cz: CZ, r0: MIRROR.r0, nivel: MIRROR.nivel, fundo: MIRROR.fundo, banco: MIRROR.banco,
          contorno: contornoDoLago(), margem: MARGEM, ilhas: ILHAS, pontes: [...AVENIDAS],
        },
        // o anel d'água do pódio: bacia à altura do chão, com o coroamento de pedra, as fontes e as duas quedas do pódio
        { tipo: 'reservatorio', nome: 'Mirror Lake', forma: 'anel', cx: CX, cz: CZ, r0: LAGO.r0, r1: LAGO.r1, nivel: BACIA.nivel, coroamento: BACIA.coroamento },
        // Dream Falls do pódio: duas cachoeiras de 40 m da borda do pódio, a 60 e a 240 graus, em arcos de 60 graus
        { tipo: 'cachoeira', nome: 'Dream Falls', cx: CX, cz: CZ, raio: PODIO.raio, altura: PODIO.altura, angulos: [60, 240], abertura: 60 },
        // Dream Falls grandes: 4 cortinas de 120 m do teto do Meridian Ring para as enseadas do lago
        ...QUEDAS_ANGULOS.map((angulo, k) => ({
          tipo: 'queda', id: `queda.${k + 1}`, nome: 'Dream Falls', cx: CX, cz: CZ, angulo, largura: 50, altura: MERIDIAN.altura,
          rTopo: MERIDIAN.raio - MERIDIAN.fundo / 2 - 4.2,
        })),
        // fontes dançantes no anel d'água, fora das cachoeiras e das escadas rolantes
        { tipo: 'fontes', cx: CX, cz: CZ, r: 92, n: 120, evitar: [[30, 90], [210, 270], [9, 21], [144, 156], [189, 201], [324, 336]] },
      ],
    },
    {
      id: 'meridian', nome: 'Meridian Ring',
      pecas: [{
        tipo: 'anel', id: 'meridian', cx: CX, cz: CZ, ...MERIDIAN, de: 0, ate: 360, portais: [...AVENIDAS], ...PORTICO,
        teto: 'jardim', quedas: QUEDAS_ANGULOS.map((angulo) => ({ angulo, meia: 33 })),
      }],
    },
    {
      id: 'horizon', nome: 'Horizon Ring',
      // cada trecho leva o anel, o pedaço do Halo Lake do pé dele e a Canopy Bridge que pousa na avenida onde ele começa
      pecas: TRECHOS_HORIZON.flatMap((t, k) => [
        { tipo: 'anel', id: t.id, nome: t.nome, cx: CX, cz: CZ, ...HORIZON, de: t.de, ate: t.ate, portais: [t.de, t.ate], ...PORTICO, teto: 'esporte', fase: t.fase, peDeDentro: 'cais', cais: HALO.cais },
        {
          tipo: 'bacia', id: `halo.${k + 1}`, nome: 'Halo Lake', trecho: t.id, cx: CX, cz: CZ, r0: HALO.r0, r1: HALO.r1, cais: HALO.cais, de: t.de, ate: t.ate,
          lacunas: [t.de, t.ate], nivel: BACIA.nivel, coroamento: BACIA.coroamento,
        },
        { ...PONTES[k], trecho: t.id },
      ]),
    },
    {
      id: 'codex', nome: 'Codex Tower',
      pecas: [{
        tipo: 'codex', x: noRaio(R_TORRES, TORRES_DO_BOSQUE.codex)[0], z: noRaio(R_TORRES, TORRES_DO_BOSQUE.codex)[1], altura: 300,
        rot: naRota(TORRES_DO_BOSQUE.codex), olhar: [CX, CZ], passagem: { ...PORTICO },
      }],
    },
    {
      id: 'helix', nome: 'Helix Labs',
      pecas: [{
        tipo: 'oval', x: noRaio(R_TORRES, TORRES_DO_BOSQUE.helix)[0], z: noRaio(R_TORRES, TORRES_DO_BOSQUE.helix)[1], altura: 180, a: 27, b: 17, afina: 0.8,
        torcao: 32, rot: naRota(TORRES_DO_BOSQUE.helix), led: HORIZON.led, passagem: { ...PORTICO },
      }],
    },
    {
      id: 'compass', nome: 'Compass Tower',
      pecas: [{
        tipo: 'oval', x: noRaio(R_TORRES, TORRES_DO_BOSQUE.compass)[0], z: noRaio(R_TORRES, TORRES_DO_BOSQUE.compass)[1], altura: 180, a: 25, b: 16,
        afina: 0.84, torcao: 0, rot: naRota(TORRES_DO_BOSQUE.compass), led: HORIZON.led, coroa: 'agulha', passagem: { ...PORTICO },
      }],
    },
    {
      id: 'parque', nome: 'Park of Future Dreams',
      pecas: [
        { tipo: 'floresta', cx: CX, cz: CZ, r0: FLORESTA.r0, r1: FLORESTA.r1 },
        { tipo: 'jardim', cx: CX, cz: CZ, r0: MIRROR.base, r1: MERIDIAN.raio - MERIDIAN.fundo / 2 - 6, margem: MARGEM },
        ...SUPERTREES,
        PASSARELA,
      ],
    },
  ],
  paisagem: {
    // a praça do pódio, onde as avenidas acabam, e os caminhos em anel entre os anéis (480 e 634, o passeio do Halo
    // Lake; o de 290 do modelo agora é o passeio da margem do lago, dentro do jardim)
    praca: { cx: CX, cz: CZ, r0: PRACA.r0, r1: PRACA.r1 },
    caminhos: [
      { cx: CX, cz: CZ, r: 480, largura: 10 },
      { cx: CX, cz: CZ, r: HALO.r0 - 11, largura: 10 },
    ],
    // o bosque denso entre os anéis (a Codex, a Helix e a Compass no meio dele, nos eixos das avenidas) e a faixa verde
    // entre o Horizon Ring e o anel viário
    bosques: [
      { cx: CX, cz: CZ, r0: MERIDIAN.raio + MERIDIAN.fundo / 2 + 8, r1: HALO.r0 - 17, densidade: 0.0075 },
      { cx: CX, cz: CZ, r0: HORIZON.raio + HORIZON.fundo / 2 + 6, r1: ANEL_VIARIO.raio - ANEL_VIARIO.largura / 2 - 3, densidade: 0.005 },
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
 * Mata do parque (densidade de 0 a 1, a da grade espelho.floresta) num ponto do disco, ou null fora dele (D97: Mata
 * Atlântica densa): o anel de floresta em volta do pódio, as 4 ilhas do Mirror Lake, a margem do lago até a face de
 * dentro do Meridian Ring, o bosque entre os anéis (até o Halo Lake) e a faixa verde atrás do Horizon Ring. Ficam
 * abertos, com 0, a água do lago e do Halo Lake, os anéis, as vias, a praça, o passeio da margem, as praças das
 * Supertrees, os caminhos e as bases das torres (VIS1c: com 0,05 e 0,06 o chão pintava pasto ralo ali). Para a grade da
 * mata (a S1a pinta quando o parque fica pronto; as cenas pintam a da simulação de prova); o uso do solo da sede
 * (render/mundo/terreno.js, usoDaSede) põe gramado onde ela fica abaixo de 0,4.
 */
const BOSQUES_DE_SUPERTREES = gruposDeSupertreesDoPlano(SUPERTREES);
function gruposDeSupertreesDoPlano(lista) {
  // os bosques: as Supertrees a menos de 90 m umas das outras, com o centro e o raio da praça de cada grupo
  const g = lista.map((_, i) => i);
  const raiz = (i) => (g[i] === i ? i : (g[i] = raiz(g[i])));
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) if (hipot(lista[i].x - lista[j].x, lista[i].z - lista[j].z) < 90) g[raiz(i)] = raiz(j);
  const por = new Map();
  lista.forEach((q, i) => por.set(raiz(i), [...(por.get(raiz(i)) ?? []), q]));
  return [...por.values()].map((l) => {
    const x = l.reduce((s, q) => s + q.x, 0) / l.length;
    const z = l.reduce((s, q) => s + q.z, 0) / l.length;
    return { x, z, raio: Math.max(...l.map((q) => hipot(q.x - x, q.z - z) + q.altura * 0.3)) + 10 };
  });
}

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
  // a mata é fechada, com densidade de 0,8 a 0,94 (nunca o gramado limpo: abaixo de 0,8 o chão da VIS1c pintaria pasto ralo)
  const densa = 0.8 + 0.14 * ruido;
  if (r >= FLORESTA.r0 && r <= FLORESTA.r1) return 0.92;
  if (r < MIRROR.r0) return 0;
  // o lago, as ilhas e a margem
  for (const ilha of ILHAS) {
    const d = hipot(x - ilha.x, z - ilha.z);
    if (d < ilha.raio - 3) return Math.min(0.94, 0.86 + 0.1 * ruido);
    if (d < ilha.furo) return 0;
  }
  const margem = raioDaMargem(a);
  if (r < margem + 6) return 0;
  const rParque = MERIDIAN.raio - MERIDIAN.fundo / 2 - 8;
  if (r < rParque) {
    if (Math.abs(r - PASSEIO_DO_PARQUE.r) < 7) return 0;
    for (const b of BOSQUES_DE_SUPERTREES) if (hipot(x - b.x, z - b.z) < b.raio) return 0;
    return densa;
  }
  const r0 = MERIDIAN.raio + MERIDIAN.fundo / 2 + 10;
  const r1 = HALO.r0 - 8;
  if (r > r0 && r < r1) {
    if (Math.abs(r - 480) < 9 || Math.abs(r - (HALO.r0 - 11)) < 9) return 0;
    for (const t of Object.values(TORRES_DO_BOSQUE)) {
      const [tx, tz] = pontoDoArco(CX, CZ, R_TORRES, t);
      if (hipot(x - tx, z - tz) < 50) return 0;
    }
    return densa;
  }
  if (r > HORIZON.raio + HORIZON.fundo / 2 + 8 && r < ANEL_VIARIO.raio - ANEL_VIARIO.largura / 2 - 4) return Math.min(0.92, 0.6 + 0.3 * ruido + 0.2);
  return 0;
}

/** O plano da sede v4 (o portão 1 já passou: os planos B e C saíram). */
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
 * A cava do Mirror Lake grande (a lago.e1) como forma do aplainar (D5; a X1b registra quando lago.e1 começa): o contorno
 * com o cais de dentro, as 4 enseadas e os furos das 4 ilhas (frestas de 0 m no meio da água). A cota é a do leito; a
 * água fica em cotaGleba + nivel. O anel d'água do pódio é uma bacia à altura do chão: não cava.
 * @returns {{ tipo: 'cava', ref: number, contorno: number[], cota: number, nivel: number }}
 */
export function cavaDoPlano(id, cotaGleba = GLEBA_ENVELOPE.cota, ref = 1) {
  const r = PLANOS[id].partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'lago');
  return { tipo: 'cava', ref, contorno: [...r.contorno], cota: cotaGleba + r.fundo, nivel: cotaGleba + r.nivel };
}
