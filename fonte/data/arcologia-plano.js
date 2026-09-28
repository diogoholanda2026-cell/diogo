// Plano da Arcologia. A F0 grava o ENVELOPE da gleba no platô, a Torre e a câmera; o integrador grava o plano escolhido
// no portão 1 (gleba, portões, vias internas, posição e orientação da Torre, D59); X1a, SEDE2 e X1b detalham.
// mapa-heldopolis.js (S1a) importa a gleba daqui e assenta o platô em volta dela. Metros; x leste, z sul.
//
// As torres da Holding (D27 e D64) saem de especTorre(altura): a Torre Lâmina de 500 m e a irmã de 452 m, lado a lado
// na fenda de 10 m (GEMEAS). Os três planos candidatos da D59 como dados: posição e orientação de cada parte,
// contornos, portões, vias internas e a cava do reservatório como forma do aplainar. O A é a sede v2 (D63 a D65): o
// anel fechado, o lago com as gêmeas e as fontes, a cúpula de vidro. Ângulos dos arcos em graus, no plano x-z:
// 0 = leste, 90 = sul, 180 = oeste, 270 = norte.
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
 * Torres da Holding (D27 e D64): planta de 36 x 50 m, três lâminas verticais coladas pelo lado comprido, a mais alta
 * na face lisa e a mais baixa do lado das penas. As cotas saem da altura: os recuos ficam a 49%, 70% e 91% dela
 * (arredondados ao pavimento de 4,2 m), com os andares de vento de 6 m no terraço da lâmina 3 e logo abaixo do da
 * lâmina 2, e a coroa-lanterna do terraço da lâmina 1 até o topo. A D27 (330 m) tinha os recuos a 49%, 72% e 91%.
 *
 * Espaço local do modelo (render/arcologia/torre.js): origem no centro da planta, no chão da plataforma; x ao longo dos
 * 36 m; z ao longo dos 50 m, da face lisa (z = -25) para as penas (z = +25), a frente (+z com rot = 0). A lâmina 1 vai
 * de z = -25 a +1, a 2 de +1 a +15 e a 3 de +15 a +25.
 */
const PE_TORRE = 4.2;
const PODIO_TORRE = 16;
const VENTO_TORRE = 6;
/** Frações da altura em que cada lâmina recua (D64: as mesmas da D27). */
export const RECUOS = congelar([0.49, 0.7, 0.91]);
const cm = (v) => Math.round(v * 100) / 100;

/**
 * Medidas de uma torre de altura dada (cota do topo: o heliponto, na que tem, ou o aro da coroa).
 * @param {number} altura  metros
 * @param {{ nome?: string, heliponto?: boolean }} op  heliponto e mastro só na maior (D64)
 */
export function especTorre(altura, { nome = 'Torre Lâmina', heliponto = true } = {}) {
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
    planta: { largura: 36, comprimento: 50, ladoEstreitoPara: 'baia' },
    // pódio de pedra (travertino) com saguão de vidro claro atrás de uma colunata; chanfro nas quinas; passa 8 m dos
    // lados da Torre, 6 m atrás e 14 m na frente (o terraço com a piscina virada para a água); a marquise de 12 m em
    // balanço fica na face lisa, sobre a entrada, onde a costura desce (no par, D64, a face lisa dá para a fenda: o
    // pódio não passa dela e a marquise sai, render/arcologia/torre.js)
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
    // andares de vento com vidro claro, forro claro iluminado e montantes contínuos: nunca mais escuros que o corpo
    faceLisa: { costura: 6, vidro: 'escuro', aletas: 'densas', passoCostura: 0.75, recuoCostura: 0.8 },
    // aletas de bronze champanhe nas faces laterais (as de 50 m, que mostram as penas): lâminas de 0,45 m de fundo e 0,26
    // de espessura (a 45 graus ainda se vê metade de vidro entre elas: a torre lê como vidro com filetes, não como metal)
    aletas: { passo: 1.5, material: 'bronze', faces: 'laterais', fundo: 0.45, espessura: 0.26 },
    // montantes das faces de frente e da face lisa (geometria no LOD0; no shader no LOD1)
    montantes: { passo: 1.5, fundo: 0.35, espessura: 0.14 },
    // lanterna de vidro sobre os 18 m de trás da lâmina 1 (na frente, o terraço-jardim), aletas a cada 0,75 m e os
    // últimos 41% ocos, só aletas contra o céu e o aro que segura o heliponto (ou que fecha a coroa, sem ele)
    coroa: { base: topo1, altura: coroa, oca: Math.round(coroa * 0.414), fundo: 18, passoAletas: 0.75 },
    // heliponto em laca preta com aro de luz e o H dourado: tabuleiro sobre a coroa com uma proa em meia elipse que
    // avança 16 m além da frente dela (Edge, 30 Hudson Yards); diametro é o círculo de toque
    heliponto: heliponto ? { cota: altura, balanco: 16, diametro: 28, espessura: 1.2 } : null,
    mastro: heliponto ? { topo: altura + 20, raio: 0.7, z: -22 } : null,
    parapeito: 1.2, // guarda-corpo de vidro dos terraços
    triangulos: {
      lod0: { media: [8000, 26000], alta: [40000, 70000], ultra: [40000, 70000], pc: [40000, 70000] },
      lod1: [2000, 5000],
    },
  });
}

/** Torre Lâmina (D64): 500 m no heliponto, o mastro a 520 m. */
export const TORRE_LAMINA = especTorre(500, { nome: 'Torre Lâmina', heliponto: true });

/** A irmã (D64): 452 m no aro da coroa, sem heliponto. */
export const TORRE_IRMA = especTorre(452, { nome: 'Torre Irmã', heliponto: false });

/**
 * Torres gêmeas (D64): lado a lado, quase encostadas, com as faces lisas de frente uma para a outra através da fenda
 * de 10 m no eixo norte-sul; as lâminas recuam para fora, espelhadas (a Lâmina a leste, a irmã a oeste), e o par lê
 * como uma peça só aberta ao meio (as Petronas, o Burj Khalifa nos recuos). No espaço do par: origem no meio da
 * fenda, x através dela (leste com rot = 0), z ao longo dela (sul).
 * A cachoeira em ciclo contínuo: a água cai de uma ponte a 45 m dentro da fenda num poço na base, que transborda por
 * uma escada d'água até o lago; e volta por dutos de vidro nas duas faces da fenda, subindo do poço à ponte.
 */
export const GEMEAS = congelar({
  fenda: 10,
  // ponte de bronze e vidro entre as faces lisas, com a borda de onde a lâmina de água cai (z do par)
  ponte: { cota: 45, z0: -4, z1: 4, espessura: 3.2 },
  // o poço entre os pódios, na base da fenda, e a escada d'água que leva o transbordo ao lago (para o sul)
  poco: { x: 5, z0: -26, z1: 27, nivel: -0.6, fundo: -1.6 },
  escada: { z0: 27, z1: 61, degraus: 7 },
  // dutos de vidro na frente da costura de cada face lisa, atrás das lâminas de água: a água sobe do poço à ponte e
  // se vê pelo véu da cachoeira (x a partir da face, z do par)
  dutos: { raio: 0.75, afasta: 1.15, zs: [-2.1, 2.1] },
});

/**
 * As duas torres no mundo a partir do centro do par { x, z, rot } (rot 0: fenda norte-sul).
 * @returns {{ spec: object, lado: number, x: number, z: number, rot: number }[]}  a Lâmina primeiro
 */
export function torresGemeas(par) {
  const d = GEMEAS.fenda / 2 + TORRE_LAMINA.planta.comprimento / 2;
  return [
    { spec: TORRE_LAMINA, lado: 1 },
    { spec: TORRE_IRMA, lado: -1 },
  ].map(({ spec, lado }) => {
    const [dx, dz] = girar(lado * d, 0, par.rot ?? 0);
    return { spec, lado, x: par.x + dx, z: par.z + dz, rot: (par.rot ?? 0) + (lado * Math.PI) / 2 };
  });
}

/** Centro do heliponto no espaço local da Torre Lâmina (z da frente da coroa mais o balanço, menos o raio). */
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

/** Pontos (pares x, z) de um arco de círculo em graus (0 leste, 90 sul), de `de` a `ate`, a cada ~passo metros. */
export function pontosDoArco(cx, cz, r, de, ate, passo = 12) {
  const n = Math.max(2, Math.ceil((Math.abs(ate - de) * Math.PI * r) / 180 / passo));
  const P = [];
  for (let i = 0; i <= n; i++) {
    const [x, z] = pontoDoArco(cx, cz, r, de + ((ate - de) * i) / n);
    P.push(cm(x), cm(z));
  }
  return P;
}

/**
 * Contorno (pares) de um lago circular com uma ilha elíptica no meio, como um polígono só: o círculo de fora e a
 * elipse da ilha ligados por uma fresta de 0,4 m a leste (a cava do aplainar não tem furo; a fresta fica abaixo da
 * água e a transição de 8 m a cobre). Pontos no lago dão dentro; na ilha, fora. canal { x, z0 } (opcional) abre na
 * ilha o poço e a escada d'água das torres, do sul da ilha até z0 (relativo ao centro), com meia largura x: fazem
 * parte da cava (o terreno desce sob eles).
 */
export function contornoLagoComIlha(cx, cz, raio, rx, rz, n = 96, canal = null) {
  const P = [];
  const e0 = 0.2 / raio;
  const e1 = 0.2 / Math.max(rx, rz);
  for (let i = 0; i <= n; i++) {
    const a = e0 + ((2 * Math.PI - 2 * e0) * i) / n;
    P.push(cm(cx + raio * cos(a)), cm(cz + raio * sen(a)));
  }
  // a ilha no sentido contrário; no sul (seno positivo), onde a elipse passa de x = +canal.x a -canal.x, o contorno
  // sobe pelo canal até o fundo do poço e volta
  // (a trigonometria de comum/util.js: o contorno vai para a simulação, D5)
  const q = canal ? Math.min(1, canal.x / rx) : 0;
  const tc = atan2(q, Math.sqrt(1 - q * q));
  let noCanal = false;
  for (let i = 0; i <= n; i++) {
    const a = 2 * Math.PI - e1 - ((2 * Math.PI - 2 * e1) * i) / n;
    if (canal && a < Math.PI / 2 + tc && a > Math.PI / 2 - tc) {
      if (!noCanal) {
        noCanal = true;
        const zb = cm(cz + rz * cos(tc));
        // o ângulo desce: chega pelo oeste (x < 0) e sai pelo leste
        P.push(cm(cx - canal.x), zb, cm(cx - canal.x), cm(cz + canal.z0), cm(cx + canal.x), cm(cz + canal.z0), cm(cx + canal.x), zb);
      }
      continue;
    }
    P.push(cm(cx + rx * cos(a)), cm(cz + rz * sen(a)));
  }
  return P;
}

// ---------- A "Baía" v2 (D63 a D65): a sede em anel fechado ----------
// Uma figura só, como a Apple Park e a McLaren: o anel da Sede (481 m por fora, 358 m por dentro, 4 andares) abraça o
// pátio, um parque com bosque em volta de um lago circular de 270 m; no meio do lago, numa ilha de pedra, as torres
// gêmeas de 500 e 452 m com a cachoeira na fenda (o Burj Khalifa na ponta do lago, as Petronas no par), e as fontes
// dançantes em arco no lado sul. Dois eixos cruzam o centro: norte-sul, do portão à praia, e leste-oeste, da cúpula de
// vidro (Jewel, Eden) à Biblioteca; a Universidade, a Escola e a Física ficam nos raios de 45 graus (os braços de
// Daxing); a moradia em arcos fora do anel viário, abertos nos eixos e nos raios. Coordenadas da planta
// docs/pesquisa/sede/proposta-sede-v2.png (proposta2.py).
const A_CENTRO = [250, 570];
const [ACX, ACZ] = A_CENTRO;
const A_RAIO_VIA = 281; // eixo do anel viário (18 m, de 272 a 290)
// entroncamento da avenida do portão leste no anel viário: no vão entre o arco de moradia de 320 a 338 graus e o eixo
// leste (a 330 graus, no meio da planta, a avenida atravessava a moradia)
const A_ANG_LESTE = 347;
const PLANO_A = {
  id: 'A',
  nome: 'Baía',
  versao: 2,
  referencias: ['Apple Park', 'McLaren Technology Centre', 'Burj Khalifa e o lago', 'Torres Petronas', 'Jewel Changi', 'Gardens by the Bay', 'Aeroporto de Daxing'],
  ideia: 'o anel da Sede abraça o lago e as torres gêmeas; dois eixos, do portão à praia e da cúpula à Biblioteca',
  gleba: [-340, 180, 660, 180, 660, 940, -340, 940],
  // centro do par de torres (a fenda no eixo norte-sul); as duas torres saem de torresGemeas()
  torre: { x: ACX, z: ACZ, rot: 0, gemeas: true },
  centro: A_CENTRO,
  partes: [
    { id: 'torre', nome: 'Torres gêmeas', pecas: [{ tipo: 'torre' }] },
    {
      id: 'lago', nome: 'Lago e fontes',
      pecas: [
        {
          // lago de 270 m com a ilha das torres: borda de pedra em degraus na ilha, margem natural no parque
          tipo: 'reservatorio', forma: 'circulo', cx: ACX, cz: ACZ, raio: 135, ilha: { rx: 96, rz: 60 },
          nivel: -2, fundo: -6, borda: 'natural', bordaIlha: 'degraus',
          contorno: contornoLagoComIlha(ACX, ACZ, 135, 96, 60, 96, { x: GEMEAS.poco.x, z0: GEMEAS.poco.z0 }),
        },
        // fontes dançantes em arco no lado sul do lago (Dubai Fountain), entre a ilha e a margem
        { tipo: 'fontes', cx: ACX, cz: ACZ, r: 110, de: 28, ate: 152, n: 64 },
      ],
    },
    {
      id: 'sede', nome: 'Sede',
      pecas: [{ tipo: 'sedeAnel', cx: ACX, cz: ACZ, rFora: 240.5, rDentro: 179, andares: 4, altura: 30, portais: [270, 0, 90, 180], vao: 40, pe: 18 }],
    },
    {
      id: 'anel', nome: 'Moradia',
      // quatro arcos fora do anel viário, abertos no eixo norte e nos raios de 45 graus; sobem para o eixo
      pecas: [
        { tipo: 'anel', arco: { cx: ACX, cz: ACZ, r: 321.5, de: 202, ate: 220 }, fundo: 30, alturas: [44, 48], continuo: true },
        { tipo: 'anel', arco: { cx: ACX, cz: ACZ, r: 321.5, de: 238, ate: 264 }, fundo: 30, alturas: [50, 54], continuo: true },
        { tipo: 'anel', arco: { cx: ACX, cz: ACZ, r: 321.5, de: 276, ate: 302 }, fundo: 30, alturas: [54, 50], continuo: true },
        { tipo: 'anel', arco: { cx: ACX, cz: ACZ, r: 321.5, de: 320, ate: 338 }, fundo: 30, alturas: [48, 44], continuo: true },
      ],
    },
    { id: 'biblioteca', nome: 'Biblioteca', pecas: [{ tipo: 'biblioteca', x: 600, z: ACZ, olhar: A_CENTRO, lado: 64 }] },
    {
      id: 'vida', nome: 'Cúpula de vidro',
      pecas: [
        // D65: 240 m de diâmetro e 80 de altura, malha diagonal, floresta em terraços por dentro
        { tipo: 'cupula', x: -175, z: ACZ, diametro: 240, altura: 80, oculo: 14 },
        // o bosque das Supertrees ao sul da cúpula (Gardens by the Bay)
        { tipo: 'supertree', x: -265, z: 800, altura: 40 },
        { tipo: 'supertree', x: -220, z: 795, altura: 50 },
        { tipo: 'supertree', x: -175, z: 805, altura: 46 },
        { tipo: 'supertree', x: -130, z: 815, altura: 36 },
        { tipo: 'supertree', x: -245, z: 845, altura: 32 },
        { tipo: 'supertree', x: -200, z: 850, altura: 48 },
        { tipo: 'supertree', x: -155, z: 860, altura: 38 },
        { tipo: 'supertree', x: -110, z: 865, altura: 28 },
        { tipo: 'supertree', x: -220, z: 890, altura: 34 },
      ],
    },
    // nos raios de 45 graus: a Escola ao longo do raio nordeste, a Universidade de través no noroeste (os laboratórios
    // para o sudoeste), a Física em anel (síncrotron) no sudeste
    { id: 'escola', nome: 'Escola', pecas: [{ tipo: 'escola', x: cm(ACX + 410 * Math.SQRT1_2), z: cm(ACZ - 410 * Math.SQRT1_2), rot: (-3 * Math.PI) / 4 }] },
    { id: 'universidade', nome: 'Universidade', pecas: [{ tipo: 'universidade', x: cm(ACX - 395 * Math.SQRT1_2), z: cm(ACZ - 395 * Math.SQRT1_2), rot: (-3 * Math.PI) / 4 }] },
    { id: 'fisica', nome: 'Centro de Física', pecas: [{ tipo: 'fisica', arco: { cx: 529, cz: 849, r: 44, de: 0, ate: 360 }, raioTubo: 6, altura: 7, ondasLargura: 14 }] },
  ],
  paisagem: {
    // o jardim das Supertrees e a clareira em volta da cúpula
    parques: [
      [-300, 770, -150, 770, -60, 820, -80, 900, -220, 915, -310, 860],
    ],
    // praça de chegada no portão norte
    pracas: [
      [195, 186, 305, 186, 305, 246, 195, 246],
    ],
    // os eixos em pedra (24 m) e o calçadão da praia
    passeios: [
      { caminho: [ACX, 298, ACX, 432], largura: 24, eixo: true },
      { caminho: [ACX, 708, ACX, 937], largura: 24, eixo: true },
      { caminho: [388, ACZ, 552, ACZ], largura: 24, eixo: true },
      { caminho: [112, ACZ, -52, ACZ], largura: 24, eixo: true },
      // o calçadão da praia em pedra portuguesa (Copacabana), com palmeiras
      { caminho: [-336, 930, 656, 930], largura: 12, portuguesa: true },
    ],
    // mata dos dois lados da praça do portão
    bosques: [
      { contorno: [35, 186, 185, 186, 185, 246, 35, 246], densidade: 0.008 },
      { contorno: [315, 186, 465, 186, 465, 246, 315, 246], densidade: 0.008 },
    ],
    // anéis: o bosque em volta do lago, o cinturão de mata em volta da Sede (a Apple Park) e a clareira da cúpula
    aneis: [
      { cx: ACX, cz: ACZ, r0: 161, r1: 176, tipo: 'bosque', densidade: 0.006 },
      { cx: ACX, cz: ACZ, r0: 248, r1: 270, tipo: 'bosque', densidade: 0.007 },
      { cx: -175, cz: ACZ, r0: 128, r1: 150, tipo: 'parque' },
    ],
  },
  vias: [
    { tipo: 'avenida', largura: 24, pontos: [ACX, 180, ACX, cm(ACZ - A_RAIO_VIA)] },
    // o anel viário partido nos entroncamentos (norte, leste e oeste)
    { tipo: 'avenida', largura: 18, pontos: pontosDoArco(ACX, ACZ, A_RAIO_VIA, 270, A_ANG_LESTE) },
    { tipo: 'avenida', largura: 18, pontos: pontosDoArco(ACX, ACZ, A_RAIO_VIA, A_ANG_LESTE, 510) },
    { tipo: 'avenida', largura: 18, pontos: pontosDoArco(ACX, ACZ, A_RAIO_VIA, 150, 270) },
    { tipo: 'avenida', largura: 18, pontos: [-340, 745, -150, 745, -60, 738, ...pontoDoArco(ACX, ACZ, A_RAIO_VIA, 150).map(cm)] },
    // do portão leste: entra reta (de frente para a borda) e desce em diagonal até o anel
    { tipo: 'avenida', largura: 18, pontos: [660, 430, 615, 430, ...pontoDoArco(ACX, ACZ, A_RAIO_VIA, A_ANG_LESTE).map(cm)] },
  ],
  portoes: [
    { id: 'norte', x: ACX, z: 180 },
    { id: 'oeste', x: -340, z: 745 },
    { id: 'leste', x: 660, z: 430 },
  ],
  camera: { x: ACX, z: 600, dist: 1500, guinada: 20, inclinacao: 30 },
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

/** Plano escolhido no portão 1 ('A' | 'B' | 'C'): o A (Baía) por padrão, até o dono decidir outro. */
export const PLANO_ESCOLHIDO = 'A';

/** Plano que o jogo mostra enquanto nenhum foi escolhido (a cidade sintética também usa este). */
export const PLANO_PADRAO = 'A';

/**
 * Posição da Torre Lâmina no plano escolhido (a do par, D64, quando o plano tem as gêmeas).
 * rot na convenção do three; com rot = 0 a frente (lado das penas) olha para +z (sul); no par a Lâmina olha para
 * leste (rot = 90 graus), com a face lisa na fenda.
 */
export function torreDoPlano(id) {
  const t = PLANOS[id].torre;
  if (!t.gemeas) return { x: t.x, z: t.z, rot: t.rot };
  const { x, z, rot } = torresGemeas(t)[0];
  return { x: cm(x), z: cm(z), rot };
}

export const TORRE_POSICAO = congelar(torreDoPlano(PLANO_ESCOLHIDO));

/** Ponto de pouso do helicóptero da Holding (D61): o centro do heliponto da Lâmina; y acima da plataforma da Torre. */
export const POUSO = congelar({ ...torreParaMundo(TORRE_POSICAO, HELIPONTO_LOCAL.x, HELIPONTO_LOCAL.y, HELIPONTO_LOCAL.z) });

/**
 * Câmera da Arcologia (voos e o botão da barra): o anel inteiro com as torres de lado, do sul-sudoeste. Ângulos em
 * graus (contratos/render.js).
 */
export const CAMERA_ARCOLOGIA = congelar({ x: 250, z: 600, dist: 1500, guinada: 20, inclinacao: 26 });

/**
 * A cava do reservatório de um plano como forma do aplainar (D5; X1b registra quando lago.e1 começa). A cota é a do
 * leito; a água fica em cotaGleba + nivel.
 * @returns {{ tipo: 'cava', ref: number, contorno: number[], cota: number, nivel: number }}
 */
export function cavaDoPlano(id, cotaGleba = GLEBA_ENVELOPE.cota, ref = 1) {
  const r = PLANOS[id].partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
  return { tipo: 'cava', ref, contorno: [...r.contorno], cota: cotaGleba + r.fundo, nivel: cotaGleba + r.nivel };
}
