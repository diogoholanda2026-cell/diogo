// Terreno: grade de alturas 1025² a 8 m gerada do mapa autoral, água, declive e o espelho.terreno (dona: S1a).
//
// gerarTerreno(mapa) é pura e determinística (só soma, produto, raiz e piso: o mesmo bit no Node, no navegador e no
// worker) e guarda o resultado por mapa: a grade BASE é do mapa e nunca muda. O espelho recebe uma cópia, que o
// aplainar (D5) mantém com as formas registradas; a base não vai no save.
//
// Como o relevo sai do mapa (data/mapa-heldopolis.js), em três resoluções:
//  - grade grossa de 32 m (257²): o que é liso. Distância com sinal à costa (praia ou costão), ao rio (lado e arco),
//    às lagoas (a de Santa Cida e as marginais da várzea), aos córregos e à rodovia; a planície (praia, restinga com
//    duna e cordões, subida para dentro, coxilhas); e o relevo dos maciços acima da planície, que vem assado com a
//    erosão fluvial (mundo/relevo.js decodifica; mundo/erosao.js assa);
//  - grade média de 16 m (513²): o relevo dos maciços por Catmull-Rom com as grotas finas, e na janela da área inicial
//    o assado de 16 m (os morros da cidade vistos de perto);
//  - grade fina de 8 m: praia, fundo do mar, pães de açúcar (monólitos de granito com a pedra nua), platô da gleba,
//    lagoas, leito, várzea e vale do rio.
import { MAPA_HELDOPOLIS, MAPAS } from '../../data/mapa-heldopolis.js';
import { AGUA } from '../../contratos/flags.js';
import { alturaEm, decliveEm, amostrar } from '../../comum/altura.js';
import { clamp, smoothstep, cos, sen } from '../../comum/util.js';
import { fnv1aTexto } from '../../comum/hash.js';
import { relevoDoMapa, lobosDoMorro } from './relevo.js';

// ------------------------------------------------------------------------------------------------ ruído

const NG = 16;
const GX = new Float64Array(NG);
const GZ = new Float64Array(NG);
for (let k = 0; k < NG; k++) {
  const a = ((k + 0.5) * 2 * Math.PI) / NG;
  GX[k] = cos(a);
  GZ[k] = sen(a);
}

// tabela de permutação fixa (embaralhada uma vez por um sorteio inteiro determinístico), dobrada para não mascarar
const PERM = new Uint8Array(512);
{
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let h = 0x6d2b79f5;
  for (let i = 255; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    const j = (h >>> 0) % (i + 1);
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

/**
 * Ruído de gradiente 2D (Perlin) em [-1, 1], com semente inteira: a semente desloca a rede de 256 x 256 células por um
 * passo sorteado (canais diferentes não são cópias deslocadas por uma célula) e troca os gradientes.
 */
export function ruido(x, z, s) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const hs = Math.imul(s, 0x9e3779b1);
  const X = (xi + (hs >>> 24)) & 255;
  const Z = (zi + ((hs >>> 16) & 255)) & 255;
  const t = (hs >>> 8) & 15;
  const p0 = PERM[X] + Z;
  const p1 = PERM[X + 1] + Z;
  const g00 = (PERM[p0] ^ t) & 15;
  const g01 = (PERM[p0 + 1] ^ t) & 15;
  const g10 = (PERM[p1] ^ t) & 15;
  const g11 = (PERM[p1 + 1] ^ t) & 15;
  const n00 = GX[g00] * fx + GZ[g00] * fz;
  const n10 = GX[g10] * (fx - 1) + GZ[g10] * fz;
  const n01 = GX[g01] * fx + GZ[g01] * (fz - 1);
  const n11 = GX[g11] * (fx - 1) + GZ[g11] * (fz - 1);
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = n00 + (n10 - n00) * u;
  const b = n01 + (n11 - n01) * u;
  return (a + (b - a) * v) * 1.41;
}

/**
 * Ruído em crista suave: 1 - |r| com o vinco arredondado (a crista fica redonda numa faixa de uns `e` do ruído), para
 * as cristas e as grotas não serrilharem na grade de 16 m nem na de 8 m.
 */
export function crista(r, e = 0.22) {
  return 1 + e - Math.sqrt(r * r + e * e);
}

/** Soma de oitavas (fbm) em torno de 0. */
export function fbm(x, z, s, oitavas = 3, ganho = 0.5) {
  let t = 0;
  let a = 1;
  let f = 1;
  let norma = 0;
  for (let k = 0; k < oitavas; k++) {
    t += a * ruido(x * f, z * f, s + k * 1013);
    norma += a;
    a *= ganho;
    f *= 2.03;
  }
  return t / norma;
}

/** Semente inteira de um texto (canal do ruído). */
export const sementeDe = (texto) => fnv1aTexto(String(texto)) | 0;

// ------------------------------------------------------------------------------------------------ polilinhas

/**
 * Densifica uma polilinha de pontos [x, z, ...atributos] por Catmull-Rom (curva que passa pelos pontos), com passo
 * máximo em metros. Os atributos andam em linha reta entre dois pontos. Devolve arrays: x, z, s (arco acumulado) e
 * atr[k] para cada atributo.
 */
export function densificar(pontos, passo, fechado = false) {
  const n = pontos.length;
  const nAtr = pontos[0].length - 2;
  const xs = [];
  const zs = [];
  const atr = Array.from({ length: nAtr }, () => []);
  const P = (i) => {
    if (fechado) return pontos[((i % n) + n) % n];
    if (i < 0) return [2 * pontos[0][0] - pontos[1][0], 2 * pontos[0][1] - pontos[1][1]];
    if (i >= n) return [2 * pontos[n - 1][0] - pontos[n - 2][0], 2 * pontos[n - 1][1] - pontos[n - 2][1]];
    return pontos[i];
  };
  const trechos = fechado ? n : n - 1;
  const ini = [];
  for (let i = 0; i < trechos; i++) {
    ini.push(xs.length);
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    const dx = p2[0] - p1[0];
    const dz = p2[1] - p1[1];
    const m = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dz * dz) / passo));
    for (let k = 0; k < m; k++) {
      const t = k / m;
      const t2 = t * t;
      const t3 = t2 * t;
      xs.push(0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3));
      zs.push(0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3));
      for (let a = 0; a < nAtr; a++) atr[a].push(p1[2 + a] + (p2[2 + a] - p1[2 + a]) * t);
    }
  }
  if (!fechado) {
    xs.push(pontos[n - 1][0]);
    zs.push(pontos[n - 1][1]);
    for (let a = 0; a < nAtr; a++) atr[a].push(pontos[n - 1][2 + a]);
  }
  const x = Float64Array.from(xs);
  const z = Float64Array.from(zs);
  const s = new Float64Array(x.length);
  for (let i = 1; i < x.length; i++) {
    const dx = x[i] - x[i - 1];
    const dz = z[i] - z[i - 1];
    s[i] = s[i - 1] + Math.sqrt(dx * dx + dz * dz);
  }
  return { x, z, s, atr: atr.map((a) => Float64Array.from(a)), n: x.length, ini };
}

/**
 * Trechos de Catmull-Rom de uma polilinha (a mesma curva de densificar) como Béziers cúbicas: [x0 z0 x1 z1 x2 z2 x3 z3].
 */
export function trechosBezier(pontos) {
  const n = pontos.length;
  const P = (i) => {
    if (i < 0) return [2 * pontos[0][0] - pontos[1][0], 2 * pontos[0][1] - pontos[1][1]];
    if (i >= n) return [2 * pontos[n - 1][0] - pontos[n - 2][0], 2 * pontos[n - 1][1] - pontos[n - 2][1]];
    return pontos[i];
  };
  const out = [];
  for (let i = 0; i + 1 < n; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    out.push(Float64Array.of(
      p1[0], p1[1], p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1],
    ));
  }
  return out;
}

/** Atributo k da polilinha densificada no arco s (linear; preso às pontas). */
export function atributoNoArco(L, k, s) {
  const S = L.s;
  const n = L.n;
  if (s <= 0) return L.atr[k][0];
  if (s >= S[n - 1]) return L.atr[k][n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (S[m] <= s) lo = m;
    else hi = m;
  }
  const f = (s - S[lo]) / (S[hi] - S[lo] || 1);
  return L.atr[k][lo] + (L.atr[k][hi] - L.atr[k][lo]) * f;
}

/**
 * Meandros de um córrego: desloca cada ponto da polilinha densa pela normal, com duas ondas de 120 a 260 m (a
 * amplitude em metros cai a zero nas pontas, que ficam onde o mapa pôs). Muda L no lugar e refaz o arco.
 */
export function serpentear(L, amplitude, s) {
  const n = L.n;
  const total = L.s[n - 1] || 1;
  const f1 = 1 / (170 + 90 * ((s >>> 3) % 7) / 6);
  const f2 = 1 / (95 + 40 * ((s >>> 7) % 5) / 4);
  const p1 = ((s >>> 11) % 100) / 16;
  const p2 = ((s >>> 17) % 100) / 16;
  const x = Float64Array.from(L.x);
  const z = Float64Array.from(L.z);
  for (let i = 1; i < n - 1; i++) {
    const tx = L.x[i + 1] - L.x[i - 1];
    const tz = L.z[i + 1] - L.z[i - 1];
    const t = Math.sqrt(tx * tx + tz * tz) || 1;
    const u = L.s[i];
    const ponta = smoothstep(0, 120, u) * smoothstep(0, 120, total - u);
    const d = amplitude * ponta * (0.7 * sen(2 * Math.PI * u * f1 + p1) + 0.3 * sen(2 * Math.PI * u * f2 + p2));
    x[i] = L.x[i] - (tz / t) * d;
    z[i] = L.z[i] + (tx / t) * d;
  }
  L.x = x;
  L.z = z;
  for (let i = 1; i < n; i++) {
    const dx = x[i] - x[i - 1];
    const dz = z[i] - z[i - 1];
    L.s[i] = L.s[i - 1] + Math.sqrt(dx * dx + dz * dz);
  }
  return L;
}

// ------------------------------------------------------------------------------------------------ perfis

/** Mínimo suave (k em metros): junta dois relevos sem vinco. */
function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}

/** Fundo do mar a u metros da costa (u > 0): raso na praia, fundo logo no costão; longe, o mesmo fundo. */
function fundoMar(u, praia) {
  if (u > 150) praia += (1 - praia) * smoothstep(150, 700, u);
  const areia = u < 110 ? -0.028 * u : u < 1400 ? -3.08 - 0.0066 * (u - 110) : -11.6 - 0.0042 * (u - 1400);
  const pedra = u < 60 ? -0.13 * u : -7.8 - 0.0062 * (u - 60);
  const h = pedra + (areia - pedra) * praia;
  return h < -32 ? -32 : h;
}

/**
 * Terra firme sem os maciços: rampa da praia (ou costão), subida da planície para dentro, cordões e dunas da restinga,
 * coxilhas e o vale raso dos córregos. sd é a distância exata à costa (a praia), sdS a suavizada (a subida).
 */
function alturaPlanicie(P, sd, sdS, praia, duna, coxilha, corrego) {
  const lp = P.larguraPraia;
  let h;
  if (sd < lp) {
    const t = sd / lp;
    h = P.cotaPraia * t * (2 - t); // rampa côncava da areia até a berma
  } else {
    h = P.cotaPraia + P.subida * ((sdS > lp ? sdS : lp) - lp);
    if (h > P.teto) h = P.teto;
  }
  if (praia < 1 && sd < 320) {
    // costão: a pedra sobe logo da água; para dentro a planície volta a ser uma só
    let c = 0.4 * sd;
    if (c > 9) c = 9;
    if (sd > 20) c += P.subida * (sd - 20);
    if (c > P.teto) c = P.teto;
    h += (c - h) * (1 - praia) * (1 - smoothstep(90, 320, sd));
  }
  if (duna > 0 && sd > 18 && sd < 420) {
    // restinga: a duna frontal atrás da berma e, para dentro, cordões arenosos paralelos à praia (sulcos entre eles)
    const b = (sd - 70) / 45;
    if (b > -1 && b < 1) {
      const q = 1 - b * b;
      h += duna * 3.2 * q * q;
    }
    if (sd > 120) {
      const f = (sd - 120) / 58;
      const onda = f - Math.floor(f) - 0.5;
      h += duna * 0.9 * (1 - smoothstep(260, 420, sd)) * (0.5 - 2 * onda * onda * 2);
    }
  }
  h += coxilha * smoothstep(150, 900, sd);
  if (corrego > 0) h -= corrego * smoothstep(40, 160, sd);
  return h;
}

// ------------------------------------------------------------------------------------------------ campos grossos

/** Grade grossa (32 m) alinhada à fina: a amostra (ic, jc) grossa é a (4 ic, 4 jc) fina. */
function gradeGrossa(n, passo, origem) {
  const nc = ((n - 1) >> 2) + 1;
  return { nc, pc: passo * 4, ox: origem[0], oz: origem[1] };
}

/**
 * Distância a uma polilinha (densificada) numa faixa, espalhada por segmento sobre uma grade. Guarda a menor distância,
 * o lado (+1 à direita de quem anda na polilinha, na direção (-dz, dx)) e o arco do ponto mais perto. Fora da faixa,
 * a distância fica `longe`. `saida` ({ dist, arco }) reaproveita os arrays; com `comLado: false` o lado não sai.
 */
function campoPolilinha(G, L, faixa, { fechado = false, longe = 1e6, saida = null, comLado = true } = {}) {
  const { nc, pc, ox, oz } = G;
  const N = nc * nc;
  const dist = saida ? saida.dist.fill(longe) : new Float32Array(N).fill(longe);
  const lado = comLado ? new Float32Array(N).fill(1) : null;
  const arco = saida ? saida.arco.fill(0) : new Float32Array(N);
  const nseg = fechado ? L.n : L.n - 1;
  for (let k = 0; k < nseg; k++) {
    const k2 = (k + 1) % L.n;
    const ax = L.x[k];
    const az = L.z[k];
    const vx = L.x[k2] - ax;
    const vz = L.z[k2] - az;
    const l2 = vx * vx + vz * vz || 1;
    const len = Math.sqrt(l2);
    const s0 = L.s[k];
    const i0 = Math.max(0, Math.floor((Math.min(ax, ax + vx) - faixa - ox) / pc));
    const i1 = Math.min(nc - 1, Math.ceil((Math.max(ax, ax + vx) + faixa - ox) / pc));
    const j0 = Math.max(0, Math.floor((Math.min(az, az + vz) - faixa - oz) / pc));
    const j1 = Math.min(nc - 1, Math.ceil((Math.max(az, az + vz) + faixa - oz) / pc));
    for (let j = j0; j <= j1; j++) {
      const pz = oz + j * pc;
      const row = j * nc;
      for (let i = i0; i <= i1; i++) {
        const px = ox + i * pc;
        let t = ((px - ax) * vx + (pz - az) * vz) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + vx * t - px;
        const qz = az + vz * t - pz;
        const d2 = qx * qx + qz * qz;
        const kk = row + i;
        const dv = dist[kk];
        if (d2 < dv * dv) {
          dist[kk] = Math.sqrt(d2);
          if (lado) lado[kk] = vx * (pz - az) - vz * (px - ax) >= 0 ? 1 : -1;
          arco[kk] = s0 + t * len;
        }
      }
    }
  }
  return { dist, lado, arco };
}

/** Preenche por linhas (par e ímpar) o polígono X, Z na grade: 1 dentro. */
function preencherPoligono(G, X, Z) {
  const { nc, pc, ox, oz } = G;
  const out = new Uint8Array(nc * nc);
  const n = X.length;
  const xs = [];
  for (let j = 0; j < nc; j++) {
    const pz = oz + j * pc;
    xs.length = 0;
    for (let a = 0, b = n - 1; a < n; b = a++) {
      const za = Z[a];
      const zb = Z[b];
      if (za > pz !== zb > pz) xs.push(X[a] + ((pz - za) * (X[b] - X[a])) / (zb - za));
    }
    xs.sort((p, q) => p - q);
    for (let m = 0; m + 1 < xs.length; m += 2) {
      const i0 = Math.max(0, Math.ceil((xs[m] - ox) / pc));
      const i1 = Math.min(nc - 1, Math.floor((xs[m + 1] - ox) / pc));
      for (let i = i0; i <= i1; i++) out[j * nc + i] = 1;
    }
  }
  return out;
}

/**
 * Costa: distância com sinal (+ terra), tipo de costa (praia) e restinga (duna) na grade grossa. Perto da costa a
 * distância é exata; longe dela vem de uma grade de 128 m (também exata), para o fundo do mar não ter facetas.
 */
function campoCosta(G, mapa) {
  const L = densificar(mapa.costa, 70);
  const faixa = 640;
  const { nc, pc, ox, oz } = G;
  const N = nc * nc;
  const dist = new Float32Array(N).fill(1e6);
  const praia = new Float32Array(N).fill(1);
  const duna = new Float32Array(N);
  for (let k = 0; k + 1 < L.n; k++) {
    const ax = L.x[k];
    const az = L.z[k];
    const vx = L.x[k + 1] - ax;
    const vz = L.z[k + 1] - az;
    const l2 = vx * vx + vz * vz || 1;
    const pa = L.atr[0][k];
    const pb = L.atr[0][k + 1];
    const da = L.atr[1][k];
    const db = L.atr[1][k + 1];
    const i0 = Math.max(0, Math.floor((Math.min(ax, ax + vx) - faixa - ox) / pc));
    const i1 = Math.min(nc - 1, Math.ceil((Math.max(ax, ax + vx) + faixa - ox) / pc));
    const j0 = Math.max(0, Math.floor((Math.min(az, az + vz) - faixa - oz) / pc));
    const j1 = Math.min(nc - 1, Math.ceil((Math.max(az, az + vz) + faixa - oz) / pc));
    for (let j = j0; j <= j1; j++) {
      const pz = oz + j * pc;
      for (let i = i0; i <= i1; i++) {
        const px = ox + i * pc;
        let t = ((px - ax) * vx + (pz - az) * vz) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + vx * t - px;
        const qz = az + vz * t - pz;
        const d2 = qx * qx + qz * qz;
        const kk = j * nc + i;
        const dv = dist[kk];
        if (d2 < dv * dv) {
          dist[kk] = Math.sqrt(d2);
          praia[kk] = pa + (pb - pa) * t;
          duna[kk] = da + (db - da) * t;
        }
      }
    }
  }
  // longe da costa: distância exata numa grade de 128 m sobre a costa rala, interpolada
  const nl = ((nc - 1) >> 2) + 1;
  const pl = pc * 4;
  const longe = new Float32Array(nl * nl);
  const passoRalo = 3;
  for (let j = 0; j < nl; j++) {
    const pz = oz + j * pl;
    for (let i = 0; i < nl; i++) {
      const px = ox + i * pl;
      let m = Infinity;
      for (let k = 0; k + passoRalo < L.n; k += passoRalo) {
        const ax = L.x[k];
        const az = L.z[k];
        const vx = L.x[k + passoRalo] - ax;
        const vz = L.z[k + passoRalo] - az;
        let t = ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + vx * t - px;
        const qz = az + vz * t - pz;
        const d2 = qx * qx + qz * qz;
        if (d2 < m) m = d2;
      }
      longe[j * nl + i] = Math.sqrt(m);
    }
  }
  for (let j = 0; j < nc; j++) {
    for (let i = 0; i < nc; i++) {
      const k = j * nc + i;
      if (dist[k] < faixa) continue;
      const d = amostrar(longe, nl, pl, ox, oz, ox + i * pc, oz + j * pc);
      dist[k] = d > faixa ? d : faixa;
    }
  }
  // continente: a costa fechada pelo norte, além da borda do mapa
  const X = Float64Array.from([...L.x, L.x[L.n - 1], L.x[0]]);
  const Z = Float64Array.from([...L.z, -6000, -6000]);
  const terra = preencherPoligono(G, X, Z);
  for (let k = 0; k < N; k++) if (!terra[k]) dist[k] = -dist[k];
  return { sd: dist, praia, duna, linha: L };
}

/** Ruído numa grade (n x n, passo, origem): o relevo lê por bilinear o que é de baixa frequência. */
function gradeRuido(n, passo, ox, oz, escala, s) {
  const out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = (oz + j * passo) / escala;
    for (let i = 0; i < n; i++) out[j * n + i] = ruido((ox + i * passo) / escala, z, s);
  }
  return out;
}

/**
 * Campo da costa suavizado longe da água. A distância exata tem vinco no eixo entre duas costas (entre a praia do sul e
 * a da enseada, por exemplo) e o tipo de costa (praia ou costão) salta ali de um lado para o outro: a planície, que
 * sobe com os dois, ganharia uma crista reta com os dentes da grade grossa. Média numa janela de (2 r + 1)² células,
 * misturada à exata a partir de 40 m da água (a praia fica exata). Com `sinal`, a média só entra com o mesmo sinal.
 * Sem `sd`, é só a média móvel.
 */
function suavizarCosta(G, campo, sd, r = 3, sinal = false) {
  const { nc } = G;
  const N = nc * nc;
  const tmp = new Float32Array(N);
  const out = new Float32Array(N);
  const w = 2 * r + 1;
  // média móvel em x e depois em z (bordas presas)
  for (let j = 0; j < nc; j++) {
    const row = j * nc;
    let soma = 0;
    for (let q = -r; q <= r; q++) soma += campo[row + (q < 0 ? 0 : q)];
    for (let i = 0; i < nc; i++) {
      tmp[row + i] = soma / w;
      const sai = i - r;
      const entra = i + r + 1;
      soma += campo[row + (entra > nc - 1 ? nc - 1 : entra)] - campo[row + (sai < 0 ? 0 : sai)];
    }
  }
  for (let i = 0; i < nc; i++) {
    let soma = 0;
    for (let q = -r; q <= r; q++) soma += tmp[(q < 0 ? 0 : q) * nc + i];
    for (let j = 0; j < nc; j++) {
      const k = j * nc + i;
      const v = campo[k];
      const d = !sd ? 1e9 : sd[k] < 0 ? -sd[k] : sd[k];
      const m = smoothstep(40, 220, d);
      const b = soma / w;
      out[k] = m > 0 && (!sinal || b * v > 0) ? v + (b - v) * m : v;
      const sai = j - r;
      const entra = j + r + 1;
      soma += tmp[(entra > nc - 1 ? nc - 1 : entra) * nc + i] - tmp[(sai < 0 ? 0 : sai) * nc + i];
    }
  }
  return out;
}



// ------------------------------------------------------------------------------------------------ campos do mapa

/**
 * Faixa da rodovia: o relevo dos maciços some até VALE_FUNDO metros do eixo e volta inteiro a CORREDOR metros (entra
 * no envelope). Estreita de propósito: a BR corre no pé da serra e corta a ponta dos esporões, com taludes de corte,
 * como as rodovias de verdade; o greide (vila.js) acerta o resto.
 */
const CORREDOR = 170;
const VALE_FUNDO = 34;

/**
 * Campos grossos (32 m) do mapa, comuns à abertura e ao assado do relevo: costa (distância com sinal, tipo, restinga,
 * suavizados longe da água), rio (distância com lado, arco e a tabela por arco), lagoa (distância com sinal), córregos,
 * coxilhas e o corredor da rodovia.
 */
export function camposDoMapa(mapa) {
  const { n, passo, origem } = mapa;
  const semente = sementeDe(mapa.semente);
  const G = gradeGrossa(n, passo, origem);
  const { nc } = G;
  const NC = nc * nc;
  const costa = campoCosta(G, mapa);
  // longe da água, a distância e o tipo de costa suavizados (sem vinco no eixo entre duas costas)
  const sdSuave = suavizarCosta(G, costa.sd, costa.sd, 3, true);
  costa.praia = suavizarCosta(G, costa.praia, costa.sd, 3);
  costa.duna = suavizarCosta(G, costa.duna, costa.sd, 3);
  // rio
  const rioL = densificar(mapa.rio.pontos, 40);
  const faixaRio = 950;
  const rio = campoPolilinha(G, rioL, faixaRio);
  // o arco salta no eixo de dentro das curvas (o ponto mais perto troca de trecho): a média tira o degrau do nível e
  // da várzea que ele traria
  rio.arco = suavizarCosta(G, rio.arco, null, 2);
  const rioSL = new Float32Array(NC);
  for (let k = 0; k < NC; k++) rioSL[k] = rio.dist[k] * rio.lado[k];
  const nTab = Math.ceil(rioL.s[rioL.n - 1] / 8) + 2;
  const tabRio = new Float32Array(nTab * 4);
  for (let q = 0; q < nTab; q++) {
    const s = q * 8;
    tabRio[4 * q] = atributoNoArco(rioL, 0, s) / 2;
    tabRio[4 * q + 1] = atributoNoArco(rioL, 1, s);
    tabRio[4 * q + 2] = atributoNoArco(rioL, 2, s);
    tabRio[4 * q + 3] = atributoNoArco(rioL, 3, s);
  }
  // faixa de meandros (o vale): eixo liso da várzea, a montante o próprio rio. Pontos [x, z, nível, várzea esq., dir.],
  // as várzeas medidas do eixo (no trecho do rio, a meia largura do leito mais a várzea dele)
  const V = mapa.rio.vale;
  const P = mapa.rio.pontos;
  let valePts = P.map((p) => [p[0], p[1], p[3], p[2] / 2 + p[4], p[2] / 2 + p[5]]);
  if (V && V.length > 1) {
    let q0 = 0;
    let dm = Infinity;
    for (let q = 0; q < P.length; q++) {
      const dx = P[q][0] - V[0][0];
      const dz = P[q][1] - V[0][1];
      const d = dx * dx + dz * dz;
      if (d < dm) {
        dm = d;
        q0 = q;
      }
    }
    valePts = [...valePts.slice(0, q0), ...V.map((p) => [...p])];
  }
  const valeL = densificar(valePts, 40);
  const vale = campoPolilinha(G, valeL, faixaRio);
  vale.arco = suavizarCosta(G, vale.arco, null, 2);
  const valeSL = new Float32Array(NC);
  for (let k = 0; k < NC; k++) valeSL[k] = vale.dist[k] * vale.lado[k];
  const nTabV = Math.ceil(valeL.s[valeL.n - 1] / 8) + 2;
  const tabVale = new Float32Array(nTabV * 3);
  for (let q = 0; q < nTabV; q++) {
    const s = q * 8;
    tabVale[3 * q] = atributoNoArco(valeL, 0, s);
    tabVale[3 * q + 1] = atributoNoArco(valeL, 1, s);
    tabVale[3 * q + 2] = atributoNoArco(valeL, 2, s);
  }
  // lagoas (a de Santa Cida e as marginais da várzea): distância com sinal (+ dentro) até 320 m, a maior entre elas, e
  // o nível e a profundidade da lagoa que manda em cada nó
  const lagoas = mapa.lagoas ?? [mapa.lagoa];
  const lagoaSd = new Float32Array(NC).fill(-320);
  const lagoaNivel = new Float32Array(NC).fill(lagoas[0].nivel);
  const lagoaProf = new Float32Array(NC).fill(lagoas[0].profundidade);
  const lagoaQual = new Uint8Array(NC);
  const lagoasL = [];
  for (const [q, lg] of lagoas.entries()) {
    const L = densificar(lg.contorno, lg === lagoas[0] ? 30 : 16, true);
    lagoasL.push(L);
    const Cl = campoPolilinha(G, L, 320, { fechado: true, longe: 320, comLado: false });
    const dentro = preencherPoligono(G, L.x, L.z);
    for (let k = 0; k < NC; k++) {
      const d = Cl.dist[k];
      if (d >= 320) continue;
      const v = dentro[k] ? d : -d;
      if (v > lagoaSd[k]) {
        lagoaSd[k] = v;
        lagoaNivel[k] = lg.nivel;
        lagoaProf[k] = lg.profundidade ?? 2;
        lagoaQual[k] = q;
      }
    }
  }
  // córregos: quanto o vale raso tira da planície e a distância ao leito (a mata ciliar sai dela)
  const corrego = new Float32Array(NC);
  const corregoDist = new Float32Array(NC).fill(1e4);
  for (const [q, c] of (mapa.corregos ?? []).entries()) {
    const L = serpentear(densificar(c.pontos, 16), c.meandro ?? 22, semente + 131 * (q + 1));
    const C = campoPolilinha(G, L, c.largura * 1.6, { longe: c.largura * 1.6 + 64, comLado: false });
    for (let k = 0; k < NC; k++) {
      if (C.dist[k] < corregoDist[k]) corregoDist[k] = C.dist[k];
      const t = C.dist[k] / (c.largura * 1.6);
      if (t >= 1) continue;
      const u = 1 - t * t;
      const v = c.profundidade * u * u;
      if (v > corrego[k]) corrego[k] = v;
    }
  }
  // coxilhas: ondulação baixa da planície (o peso da distância à costa entra na planície)
  const coxilha = new Float32Array(NC);
  const amp = mapa.planicie.colinas ?? 0;
  if (amp) {
    for (let k = 0; k < NC; k++) {
      if (costa.sd[k] <= 0) continue;
      const x = G.ox + (k % nc) * G.pc;
      const z = G.oz + ((k / nc) | 0) * G.pc;
      coxilha[k] = amp * (0.7 * ruido(x / 950, z / 950, semente + 31) + 0.3 * ruido(x / 420, z / 420, semente + 37));
    }
  }
  const corredor = mapa.rodovia
    ? {
        dist: campoPolilinha(G, densificar(mapa.rodovia.pontos.map((p) => [p[0], p[1]]), 60), CORREDOR, { longe: CORREDOR + 64, comLado: false }).dist,
        fundo: VALE_FUNDO,
        largura: CORREDOR,
      }
    : null;
  return {
    G, semente, costa, sdSuave, coxilha, corrego, corregoDist, corredor,
    rio: { L: rioL, sl: rioSL, arco: rio.arco, tab: tabRio, nTab, faixa: faixaRio },
    vale: { L: valeL, sl: valeSL, arco: vale.arco, tab: tabVale, nTab: nTabV },
    lagoa: { L: lagoasL[0], sd: lagoaSd, nivel: lagoaNivel, prof: lagoaProf, qual: lagoaQual, lista: lagoas, contornos: lagoasL },
    P: mapa.planicie,
  };
}

/** Planície (ou fundo do mar) no nó k da grade grossa, sem maciços, platô, lagoa nem rio. */
export function planicieNo(C, k) {
  const sd = C.costa.sd[k];
  const sdS = C.sdSuave[k];
  const praia = C.costa.praia[k];
  if (sd < 0) return fundoMar(sdS < -1 ? -sdS : -sd, praia);
  return alturaPlanicie(C.P, sd, sdS, praia, C.costa.duna[k], C.coxilha[k], C.corrego[k]);
}

/** Planície (ou fundo) num ponto qualquer, pela bilinear dos campos grossos. */
export function planicieEm(C, x, z) {
  const { nc, pc, ox, oz } = C.G;
  const sd = amostrar(C.costa.sd, nc, pc, ox, oz, x, z);
  const sdS = amostrar(C.sdSuave, nc, pc, ox, oz, x, z);
  const praia = amostrar(C.costa.praia, nc, pc, ox, oz, x, z);
  if (sd < 0) return fundoMar(sdS < -1 ? -sdS : -sd, praia);
  const duna = amostrar(C.costa.duna, nc, pc, ox, oz, x, z);
  const cox = amostrar(C.coxilha, nc, pc, ox, oz, x, z);
  const cor = amostrar(C.corrego, nc, pc, ox, oz, x, z);
  return alturaPlanicie(C.P, sd, sdS, praia, duna, cox, cor);
}

/**
 * O rio perto de (x, z) pelos campos. Do leito: distância ao eixo (a), meia largura (hw), nível da água e o lado (+1 à
 * direita de quem desce o rio). Da faixa de meandros (o vale): distância ao eixo liso (v) e a várzea do lado do ponto,
 * medida desse eixo (dentro da várzea: v < varzea). Longe do rio, a = v = Infinity. `out` reaproveita o objeto.
 */
export function rioNosCampos(C, x, z, out = { a: 0, hw: 0, nivel: 0, varzea: 0, lado: 1, v: 0 }) {
  const { G, rio, vale } = C;
  const sl = amostrar(rio.sl, G.nc, G.pc, G.ox, G.oz, x, z);
  const vl = amostrar(vale.sl, G.nc, G.pc, G.ox, G.oz, x, z);
  const a = sl < 0 ? -sl : sl;
  const v = vl < 0 ? -vl : vl;
  out.lado = sl < 0 ? -1 : 1;
  if (!(a < rio.faixa) && !(v < rio.faixa)) {
    out.a = Infinity;
    out.v = Infinity;
    out.hw = 0;
    out.nivel = 0;
    out.varzea = 0;
    out.lado = 1;
    return out;
  }
  const s = amostrar(rio.arco, G.nc, G.pc, G.ox, G.oz, x, z);
  const t = rio.tab;
  let q = Math.floor(s / 8);
  if (q < 0) q = 0;
  else if (q > rio.nTab - 2) q = rio.nTab - 2;
  const f = s / 8 - q;
  const q4 = 4 * q;
  out.a = a;
  out.hw = t[q4] + (t[q4 + 4] - t[q4]) * f;
  out.nivel = t[q4 + 1] + (t[q4 + 5] - t[q4 + 1]) * f;
  const sv = amostrar(vale.arco, G.nc, G.pc, G.ox, G.oz, x, z);
  const tv = vale.tab;
  let p = Math.floor(sv / 8);
  if (p < 0) p = 0;
  else if (p > vale.nTab - 2) p = vale.nTab - 2;
  const g = sv / 8 - p;
  const p3 = 3 * p + (vl < 0 ? 1 : 2);
  out.v = v;
  out.varzea = tv[p3] + (tv[p3 + 3] - tv[p3]) * g;
  return out;
}

/** Ferramentas que relevo.js e erosao.js recebem (evita a importação circular com este módulo). */
export const FERRAMENTAS = Object.freeze({
  sementeDe, ruido, fbm, densificar, atributoNoArco, campoPolilinha, preencherPoligono, amostrar, cos, sen,
  planicieEm, planicieNo, rioNosCampos,
});

// ------------------------------------------------------------------------------------------------ maciços a 16 m

/**
 * Relevo dos maciços na grade média (16 m, 513²): Catmull-Rom sobre o de 32 m (os nós pares são os da grossa; os do
 * meio saem de (-a + 9 b + 9 c - d) / 16) e as grotas finas das encostas, um ruído em crista que pesa com o declive e
 * com a altura (a erosão assada tem 32 m; as grotas de 40 a 70 m saem aqui).
 */
function relevoMedio(rel, nc, pc, ox, oz, semente) {
  const nm = 2 * nc - 1;
  const pm = pc / 2;
  // linhas: cada linha grossa ganha os pontos do meio
  const L = new Float32Array(nc * nm);
  for (let j = 0; j < nc; j++) {
    const a = j * nc;
    const o = j * nm;
    for (let i = 0; i < nc; i++) L[o + 2 * i] = rel[a + i];
    for (let i = 0; i + 1 < nc; i++) {
      const v0 = rel[a + (i > 0 ? i - 1 : 0)];
      const v1 = rel[a + i];
      const v2 = rel[a + i + 1];
      const v3 = rel[a + (i + 2 < nc ? i + 2 : nc - 1)];
      L[o + 2 * i + 1] = (-v0 + 9 * v1 + 9 * v2 - v3) / 16;
    }
  }
  const out = new Float32Array(nm * nm);
  for (let jm = 0; jm < nm; jm++) {
    const o = jm * nm;
    if ((jm & 1) === 0) {
      out.set(L.subarray((jm >> 1) * nm, (jm >> 1) * nm + nm), o);
      continue;
    }
    const j = jm >> 1;
    const r0 = (j > 0 ? j - 1 : 0) * nm;
    const r1 = j * nm;
    const r2 = (j + 1) * nm;
    const r3 = (j + 2 < nc ? j + 2 : nc - 1) * nm;
    for (let i = 0; i < nm; i++) out[o + i] = (-L[r0 + i] + 9 * L[r1 + i] + 9 * L[r2 + i] - L[r3 + i]) / 16;
  }
  // grotas finas e o fim do excesso do Catmull-Rom no pé (nada abaixo da planície)
  for (let jm = 1; jm < nm - 1; jm++) {
    const z = oz + jm * pm;
    const o = jm * nm;
    for (let im = 1; im < nm - 1; im++) {
      const k = o + im;
      const h = out[k];
      if (h <= 0) {
        out[k] = 0;
        continue;
      }
      if (h < 8) continue;
      const gx = out[k + 1] - out[k - 1];
      const gz = out[k + nm] - out[k - nm];
      const decl = Math.sqrt(gx * gx + gz * gz) / (2 * pm);
      const x = ox + im * pm;
      const g = crista(ruido(x / 58, z / 58, semente + 61), 0.3);
      const amp = (h < 120 ? h * 0.03 : 3.6) * smoothstep(0.12, 0.6, decl);
      out[k] = h + amp * (g * g - 0.5);
    }
  }
  return out;
}

/**
 * Troca, na janela do detalhe, o relevo médio pelo assado a 16 m (a mesma grade: a janela é alinhada). A borda do
 * assado fino é o grosso; os 4 nós junto dela misturam os dois (o grosso chega aqui por Catmull-Rom e grotas).
 */
function aplicarDetalhe(rel16, nm, pm, ox, oz, D) {
  const i0 = Math.round((D.x0 - ox) / pm);
  const j0 = Math.round((D.z0 - oz) / pm);
  const n = D.n;
  for (let j = 0; j < n; j++) {
    const jm = j0 + j;
    if (jm < 0 || jm >= nm) continue;
    const bj = j < n - 1 - j ? j : n - 1 - j;
    for (let i = 0; i < n; i++) {
      const im = i0 + i;
      if (im < 0 || im >= nm) continue;
      const bi = i < n - 1 - i ? i : n - 1 - i;
      const b = bi < bj ? bi : bj;
      const w = b >= 4 ? 1 : b / 4;
      const k = jm * nm + im;
      rel16[k] += (D.rel[j * n + i] - rel16[k]) * w;
    }
  }
}

// ------------------------------------------------------------------------------------------------ pães de açúcar

/**
 * Pães de açúcar (forma 'pao'): monólitos de granito com o flanco quase a prumo e o topo arredondado, na grade fina.
 * Lobos em torno do principal, contorno torcido pelo ruído, o lado em pé (face) e caneluras (sulcos que descem
 * torcendo) na pedra. h é a cota do topo acima do mar; a saia curta entra na água em pé. Escreve no relevo o que passa
 * do que já está lá e marca tipoDomo = 1 onde o flanco é do pão.
 */
function espalharPaes(mapa, C, relevo, tipoDomo) {
  const { n, passo } = mapa;
  const [ox, oz] = mapa.origem;
  const semente = C.semente;
  for (const [m, morro] of mapa.morros.entries()) {
    if (morro.forma !== 'pao') continue;
    const cs = cos(morro.ang);
    const sn = sen(morro.ang);
    const A = Math.max(0, morro.h - planicieEm(C, morro.x, morro.z));
    const r = Math.max(morro.rx, morro.rz) * 1.3 * 1.12;
    const i0 = Math.max(0, Math.floor((morro.x - r - ox) / passo));
    const i1 = Math.min(n - 1, Math.ceil((morro.x + r - ox) / passo));
    const j0 = Math.max(0, Math.floor((morro.z - r - oz) / passo));
    const j1 = Math.min(n - 1, Math.ceil((morro.z + r - oz) / passo));
    const sm = semente + 104729 * (m + 1);
    const nucleo = 0.93;
    const saia = 1.3;
    const irx = 1 / morro.rx;
    const irz = 1 / morro.rz;
    const lobos = lobosDoMorro(sm);
    const nl = 3; // o principal e dois ombros
    const forte = morro.forte ?? 0;
    let flx = 0;
    let flz = 0;
    if (forte) {
      const fwx = cos(morro.face);
      const fwz = sen(morro.face);
      flx = (fwx * cs + fwz * sn) * irx;
      flz = (fwz * cs - fwx * sn) * irz;
      const fl = Math.sqrt(flx * flx + flz * flz);
      flx /= fl;
      flz /= fl;
    }
    const escala = 1 / (morro.rx + morro.rz);
    // torção do contorno numa grade de 32 m sobre a caixa (é de baixa frequência), lida por bilinear
    const nw = ((i1 - i0) >> 2) + 2;
    const mw = ((j1 - j0) >> 2) + 2;
    const W1 = new Float32Array(nw * mw);
    const W2 = new Float32Array(nw * mw);
    for (let b = 0; b < mw; b++) {
      const dz = oz + (j0 + 4 * b) * passo - morro.z;
      for (let a = 0; a < nw; a++) {
        const dx = ox + (i0 + 4 * a) * passo - morro.x;
        W1[b * nw + a] = ruido(dx * escala * 2.2, dz * escala * 2.2, sm);
        W2[b * nw + a] = ruido(dx * escala * 2.2 + 7.3, dz * escala * 2.2 - 3.1, sm);
      }
    }
    for (let j = j0; j <= j1; j++) {
      const dz = oz + j * passo - morro.z;
      const bj = (j - j0) >> 2;
      const fz = ((j - j0) & 3) * 0.25;
      for (let i = i0; i <= i1; i++) {
        const dx = ox + i * passo - morro.x;
        let lx = (dx * cs + dz * sn) * irx;
        let lz = (dz * cs - dx * sn) * irz;
        const e2 = lx * lx + lz * lz;
        if (e2 >= saia * saia * 1.25) continue;
        const ai = (i - i0) >> 2;
        const fx = ((i - i0) & 3) * 0.25;
        const q0 = bj * nw + ai;
        const w1a = W1[q0] + (W1[q0 + 1] - W1[q0]) * fx;
        const w1b = W1[q0 + nw] + (W1[q0 + nw + 1] - W1[q0 + nw]) * fx;
        const w2a = W2[q0] + (W2[q0 + 1] - W2[q0]) * fx;
        const w2b = W2[q0 + nw] + (W2[q0 + nw + 1] - W2[q0 + nw]) * fx;
        const w1 = w1a + (w1b - w1a) * fz;
        const w2 = w2a + (w2b - w2a) * fz;
        lx += 0.16 * w1;
        lz += 0.16 * w2;
        if (forte) {
          const rr = Math.sqrt(lx * lx + lz * lz) + 1e-9;
          const c = (lx * flx + lz * flz) / rr;
          const f = c > 0 ? 1 / (1 + forte * c * c) : 1 + 0.45 * c * c;
          lx /= f;
          lz /= f;
        }
        let h = 0;
        let t2p = 9;
        for (let q = 0; q < nl; q++) {
          const L = lobos[q];
          const ax = (lx - L[0]) / L[2];
          const az = (lz - L[1]) / L[3];
          const t2 = ax * ax + az * az;
          if (q === 0) t2p = t2;
          if (t2 >= 1) continue;
          // pão de açúcar: topo largo e redondo, flanco que cai quase a prumo no último terço do raio (a curva
          // raiz(1 - t^2,5)) e o último décimo amaciado no pé
          const t = Math.sqrt(t2);
          const b = 1 - t2 * Math.sqrt(t);
          const pe = 1 - t < 0.1 ? smoothstep(0, 0.1, 1 - t) : 1;
          const v = (q === 0 ? 1 : 0.84 * L[4]) * Math.sqrt(b > 0 ? b : 0) * pe;
          if (v > h) h = v;
        }
        h *= nucleo;
        const ts = (lx * lx + lz * lz) / (saia * saia);
        if (ts < 1) {
          const u = 1 - ts;
          h += (1 - nucleo) * u * u;
        }
        if (h <= 0) continue;
        // caneluras: o ruído anda com a direção e devagar com o raio (sulcos que descem torcendo)
        const flanco = t2p < 1 ? 4 * t2p * (1 - t2p) : 0;
        const rr = Math.sqrt(lx * lx + lz * lz) + 1e-6;
        const g = ruido((lx / rr) * 4.5 + rr * 1.3, (lz / rr) * 4.5 - rr * 0.9, sm + 5);
        h *= A * (1 + 0.035 * w1 + flanco * 0.045 * g);
        const k = j * n + i;
        if (h > relevo[k]) {
          relevo[k] = h;
          tipoDomo[k] = t2p < 1 ? 1 : 0;
        }
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------ gerador

const CACHE = new Map();

/**
 * Gera a grade base de um mapa (guardada por id: a segunda chamada devolve a mesma). NÃO altere os arrays devolvidos;
 * o espelho recebe cópias.
 * @returns {{ id, n, passo, origem: number[], altura: Float32Array, agua: Uint8Array, rios: object[], lagoas: object[],
 *            campos: object, assado: boolean, ms?: number }}
 */
export function gerarTerreno(mapa = MAPA_HELDOPOLIS, { cronometro = null } = {}) {
  const guardado = CACHE.get(mapa.id);
  if (guardado) return guardado;
  const t0 = cronometro ? cronometro() : 0;
  const T = construir(mapa);
  if (cronometro) T.ms = cronometro() - t0;
  CACHE.set(mapa.id, T);
  return T;
}

/** Esquece a grade guardada (testes de tempo). */
export function esquecerTerreno(id) {
  CACHE.delete(id);
}

function construir(mapa) {
  const { n, passo, origem } = mapa;
  const N = n * n;
  const C = camposDoMapa(mapa);
  const { G } = C;
  const { nc } = G;
  // maciços: o relevo assado (ou o envelope liso) a 32 m, levado a 16 m com as grotas finas
  const { rel, detalhe, assado } = relevoDoMapa(mapa, C, FERRAMENTAS);
  const rel16 = relevoMedio(rel, nc, G.pc, G.ox, G.oz, C.semente);
  if (detalhe) aplicarDetalhe(rel16, 2 * nc - 1, G.pc / 2, G.ox, G.oz, detalhe);
  // pães de açúcar na grade fina
  const domo = new Float32Array(N);
  const tipoDomo = new Uint8Array(N);
  espalharPaes(mapa, C, domo, tipoDomo);
  // composição na grade fina
  const altura = new Float32Array(N);
  const agua = new Uint8Array(N);
  const relevo = new Float32Array(N);
  const vale = gradeRuido(nc, G.pc, G.ox, G.oz, 260, C.semente + 77);
  compor({
    n, passo, ox: origem[0], oz: origem[1], nc, P: mapa.planicie, plato: mapa.plato, semente: C.semente,
    campos: [C.costa.sd, C.costa.praia, C.costa.duna, C.rio.sl, C.rio.arco, C.lagoa.sd, C.corrego, C.sdSuave, vale, C.coxilha, C.lagoa.nivel, C.lagoa.prof, C.vale.sl, C.vale.arco],
    rel16, domo, tabRio: C.rio.tab, nTab: C.rio.nTab, faixaRio: C.rio.faixa, tabVale: C.vale.tab, nTabV: C.vale.nTab, relevo, altura, agua,
  });

  // rios e lagoas do espelho; o rio sai cortado na borda do mapa (a nascente fica fora dele: a água do render começa
  // na borda, não no ar sobre a moldura)
  const pontosRio = rioNoMapa(C.rio.L, origem[0], origem[1], origem[0] + (n - 1) * passo, origem[1] + (n - 1) * passo);
  const lagoasEspelho = C.lagoa.lista.map((lg, q) => {
    const L = C.lagoa.contornos[q];
    const contorno = new Float64Array(L.n * 2);
    for (let i = 0; i < L.n; i++) {
      contorno[2 * i] = L.x[i];
      contorno[2 * i + 1] = L.z[i];
    }
    return { id: lg.id, nivel: lg.nivel, contorno };
  });
  return {
    id: mapa.id,
    n,
    passo,
    origem: [origem[0], origem[1]],
    altura,
    agua,
    rios: [{ id: mapa.rio.id, pontos: pontosRio }],
    lagoas: lagoasEspelho,
    assado,
    // campos que recursos, mata e a Vila reaproveitam
    campos: { ...C, relevo, tipoDomo },
  };
}

/**
 * Pontos do rio para o espelho (x, z, nível, largura), só o trecho dentro do retângulo [x0, z0, x1, z1]: onde a linha
 * cruza a borda entra um ponto interpolado nela. O rio do mapa é um trecho só dentro do mapa (da borda norte à foz).
 */
function rioNoMapa(L, x0, z0, x1, z1) {
  const dentro = (q) => L.x[q] >= x0 && L.x[q] <= x1 && L.z[q] >= z0 && L.z[q] <= z1;
  const out = [];
  const ponto = (q, t) => {
    const r = q + 1 < L.n ? q + 1 : q;
    const v = (a) => a[q] + (a[r] - a[q]) * t;
    out.push(v(L.x), v(L.z), v(L.atr[1]), v(L.atr[0]));
  };
  // fração do trecho q -> q + 1 em que ele cruza a borda (o ponto q de um lado, q + 1 do outro)
  const cruza = (q) => {
    let t0 = 0;
    let t1 = 1;
    const dx = L.x[q + 1] - L.x[q];
    const dz = L.z[q + 1] - L.z[q];
    for (const [p, d, lo, hi] of [[L.x[q], dx, x0, x1], [L.z[q], dz, z0, z1]]) {
      if (d === 0) continue;
      const a = (lo - p) / d;
      const b = (hi - p) / d;
      const tMin = a < b ? a : b;
      const tMax = a < b ? b : a;
      if (tMin > t0) t0 = tMin;
      if (tMax < t1) t1 = tMax;
    }
    return dentro(q) ? t1 : t0;
  };
  for (let q = 0; q < L.n; q++) {
    const d = dentro(q);
    if (d) ponto(q, 0);
    if (q + 1 < L.n && d !== dentro(q + 1)) ponto(q, cruza(q));
  }
  return Float64Array.from(out);
}

/**
 * Composição na grade fina, linha a linha: as linhas grossas (32 m) e médias (16 m) são interpoladas uma vez por linha
 * fina e depois ao longo dela. Escreve altura, água e o relevo acima da planície (maciços e pães, para a mata e os
 * recursos).
 */
function compor(o) {
  const { n, passo, ox, oz, nc, P, plato, campos, rel16, domo, tabRio, nTab, faixaRio, tabVale, nTabV, relevo, altura, agua } = o;
  const nm = 2 * nc - 1;
  const nCampos = campos.length;
  const linhas = [];
  for (let c = 0; c < nCampos; c++) linhas.push(new Float32Array(nc));
  const [Lsd, Lpraia, Lduna, Lrio, Larco, Llag, Lcor, Lsuave, Lvale, Lcox, Lniv, Lprof, Lvsl, Lvarco] = linhas;
  const Lrel = new Float32Array(nm);
  const cx0 = plato.caixa[0];
  const cz0 = plato.caixa[1];
  const cx1 = plato.caixa[2];
  const cz1 = plato.caixa[3];
  const cotaPlato = plato.cota;
  const alcPlato = plato.margem + plato.transicao;
  // a borda do platô não é reta: a distância à caixa anda até BORDA_PLATO metros com um ruído lento
  const BORDA_PLATO = 60;
  const alcCaixa = alcPlato + BORDA_PLATO;
  const sBorda = o.semente + 99;
  // duas passadas: a primeira, rala (1 amostra a cada 16 nos dois eixos), passa por todos os casos (mar, praia, serra,
  // lagoa, rio, platô) antes de o motor do JavaScript otimizar o laço; sem ela o laço é refeito a cada caso novo
  for (let passada = 0; passada < 2; passada++) {
    const salto = passada === 0 ? 16 : 1;
    for (let j = 0; j < n; j += salto) {
      const z = oz + j * passo;
      const jc = j >> 2;
      const fz = (j & 3) * 0.25;
      const a0 = jc * nc;
      const b0 = (jc + 1 < nc ? jc + 1 : jc) * nc;
      for (let c = 0; c < nCampos; c++) {
        const F = campos[c];
        const L = linhas[c];
        for (let ic = 0; ic < nc; ic++) {
          const va = F[a0 + ic];
          L[ic] = va + (F[b0 + ic] - va) * fz;
        }
      }
      // linha média (16 m) dos maciços
      const jm = j >> 1;
      const am = jm * nm;
      const bm = (jm + 1 < nm ? jm + 1 : jm) * nm;
      const fzm = (j & 1) * 0.5;
      for (let q = 0; q < nm; q++) {
        const va = rel16[am + q];
        Lrel[q] = va + (rel16[bm + q] - va) * fzm;
      }
      const dentroPlatoZ = z > cz0 - alcCaixa && z < cz1 + alcCaixa;
      const ddz = z < cz0 ? cz0 - z : z > cz1 ? z - cz1 : 0;
      for (let i = 0; i < n; i += salto) {
        const x = ox + i * passo;
        const ic = i >> 2;
        const fx = (i & 3) * 0.25;
        const ic2 = ic + 1 < nc ? ic + 1 : ic;
        const im = i >> 1;
        const im2 = im + 1 < nm ? im + 1 : im;
        const fxm = (i & 1) * 0.5;
        const k = j * n + i;
        const sd = Lsd[ic] + (Lsd[ic2] - Lsd[ic]) * fx;
        const sdS = Lsuave[ic] + (Lsuave[ic2] - Lsuave[ic]) * fx;
        const praia = Lpraia[ic] + (Lpraia[ic2] - Lpraia[ic]) * fx;
        // maciços (relevo assado a 16 m) e pães (grade fina): o maior dos dois
        const rm = Lrel[im] + (Lrel[im2] - Lrel[im]) * fxm;
        const rd = domo[k];
        const r = rm > rd ? rm : rd;
        let h;
        if (sd < 0) {
          h = fundoMar(sdS < -1 ? -sdS : -sd, praia);
        } else {
          const duna = Lduna[ic] + (Lduna[ic2] - Lduna[ic]) * fx;
          const cox = Lcox[ic] + (Lcox[ic2] - Lcox[ic]) * fx;
          const cr = Lcor[ic] + (Lcor[ic2] - Lcor[ic]) * fx;
          h = alturaPlanicie(P, sd, sdS, praia, duna, cox, cr);
        }
        h += r;
        relevo[k] = r;
        // platô da gleba: plano na cota, sem invadir a praia
        if (dentroPlatoZ) {
          const ddx = x < cx0 ? cx0 - x : x > cx1 ? x - cx1 : 0;
          if (ddx < alcCaixa) {
            let dr = ddx > 0 || ddz > 0 ? Math.sqrt(ddx * ddx + ddz * ddz) : 0;
            if (dr > 0) dr += BORDA_PLATO * ruido(x / 300, z / 300, sBorda) * smoothstep(0, 40, dr);
            const w = (1 - smoothstep(plato.margem, alcPlato, dr)) * smoothstep(6, 42, sd);
            if (w > 0) h += (cotaPlato - h) * w;
          }
        }
        let ag = 0;
        // lagoa: bacia rasa com a margem em rampa
        const lsd = Llag[ic] + (Llag[ic2] - Llag[ic]) * fx;
        if (lsd > -300) {
          // dentro, a bacia; fora, a margem em rampa que cresce depressa (não corta o que fica longe da água)
          const nivelLagoa = Lniv[ic] + (Lniv[ic2] - Lniv[ic]) * fx;
          const profLagoa = Lprof[ic] + (Lprof[ic2] - Lprof[ic]) * fx;
          const alvo = lsd >= 0 ? nivelLagoa - 0.45 - profLagoa * smoothstep(0, 130, lsd) : nivelLagoa + 0.3 - lsd * (0.055 - 0.002 * lsd);
          h = smin(h, alvo, 1.5);
          if (lsd > 0) ag = AGUA.LAGOA;
        }
        // rio: o leito (que serpenteia) e a várzea com as encostas do vale (da faixa de meandros, de eixo liso)
        const sl = Lrio[ic] + (Lrio[ic2] - Lrio[ic]) * fx;
        const a = sl < 0 ? -sl : sl;
        const vsl = Lvsl[ic] + (Lvsl[ic2] - Lvsl[ic]) * fx;
        const v = vsl < 0 ? -vsl : vsl;
        if (a < faixaRio || v < faixaRio) {
          const s = Larco[ic] + (Larco[ic2] - Larco[ic]) * fx;
          let q = Math.floor(s / 8);
          if (q < 0) q = 0;
          else if (q > nTab - 2) q = nTab - 2;
          const f = s / 8 - q;
          const q4 = 4 * q;
          const hw = tabRio[q4] + (tabRio[q4 + 4] - tabRio[q4]) * f;
          const nivel = tabRio[q4 + 1] + (tabRio[q4 + 5] - tabRio[q4 + 1]) * f;
          const sv = Lvarco[ic] + (Lvarco[ic2] - Lvarco[ic]) * fx;
          let p = Math.floor(sv / 8);
          if (p < 0) p = 0;
          else if (p > nTabV - 2) p = nTabV - 2;
          const g = sv / 8 - p;
          const p3 = 3 * p;
          const nivelV = tabVale[p3] + (tabVale[p3 + 3] - tabVale[p3]) * g;
          const vi = p3 + (vsl < 0 ? 1 : 2);
          const borda = tabVale[vi] + (tabVale[vi + 3] - tabVale[vi]) * g;
          // várzea e vale: o relevo desce liso até o piso da várzea (sem degrau nem beiço), com um dique baixo na beira
          // do leito; na serra a encosta desce em V até o rio, na baixada é só uma barranca
          const piso = nivelV + 0.8 + 1.5 * smoothstep(hw, hw + 30, a) + 0.4 * smoothstep(0.3 * borda, borda, v);
          const serra = smoothstep(8, 60, nivelV);
          const rv = Lvale[ic] + (Lvale[ic2] - Lvale[ic]) * fx;
          const lv = (150 + 300 * serra) * (1 + 0.3 * rv);
          const w = smoothstep(borda, borda + lv, v);
          const wq = w * w + (w - w * w) * serra;
          let novo = h > piso ? piso + (h - piso) * wq : h;
          if (a >= hw && a < hw + 32 && sd > 40) {
            // barranca: o chão junto do leito não fica abaixo da água (sem a lâmina do rio acima da margem)
            const m = nivel + 0.4;
            if (novo < m) novo += (m - novo) * (1 - smoothstep(hw + 16, hw + 32, a));
          }
          if (a < hw) {
            // leito; no mar ele some em 40 m (a foz não cava um buraco no raso da praia)
            const e = a / hw;
            const fundo = (1.4 + hw / 22) * (1 - e * e) * (sd > 0 ? 1 : 1 - smoothstep(0, 40, -sd));
            novo = smin(novo, nivel - 0.35 - fundo, 1.2);
            if (sd > 0) ag = AGUA.RIO;
          }
          const fora = smoothstep(faixaRio * 0.8, faixaRio, a < v ? a : v);
          h = novo + (h - novo) * fora;
        }
        if (ag === 0 && h < 0) ag = AGUA.MAR;
        altura[k] = h;
        agua[k] = ag;
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------ consultas

/** Altura bilinear (D4). */
export const altura = (T, x, z) => alturaEm(T, x, z);

/** Declive em fração (0,12 = 12%). */
export const declive = (T, x, z) => decliveEm(T, x, z);

/** Categoria da água na amostra mais perto (AGUA.TERRA, MAR, RIO, LAGOA); fora do mapa, mar. */
export function aguaEm(T, x, z) {
  const i = Math.round((x - T.origem[0]) / T.passo);
  const j = Math.round((z - T.origem[1]) / T.passo);
  if (i < 0 || j < 0 || i >= T.n || j >= T.n) return AGUA.MAR;
  return T.agua[j * T.n + i];
}

/** true se o ponto cai na água (qualquer uma das quatro amostras em volta é água). */
export function ehAgua(T, x, z) {
  const fx = (x - T.origem[0]) / T.passo;
  const fz = (z - T.origem[1]) / T.passo;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= T.n - 1 || j >= T.n - 1) return true;
  const k = j * T.n + i;
  return !!(T.agua[k] | T.agua[k + 1] | T.agua[k + T.n] | T.agua[k + T.n + 1]);
}

/**
 * O rio perto de (x, z) pela grade base: distância ao eixo (a), meia largura, nível da água, várzea do lado do ponto e
 * o lado (+1 à direita de quem desce o rio). Longe do rio, a = Infinity. `out` reaproveita o objeto (laços sobre a
 * grade inteira, como a mata).
 */
export const rioEm = (base, x, z, out) => rioNosCampos(base.campos, x, z, out);

/** Distância com sinal à costa (+ terra) pelos campos da grade base. */
export function costaEm(base, x, z) {
  const { G, costa } = base.campos;
  return amostrar(costa.sd, G.nc, G.pc, G.ox, G.oz, x, z);
}

/** Mapa pelo id (criarSimulacao({ mapa })). */
export const mapaDe = (id) => MAPAS[id] ?? null;

// ------------------------------------------------------------------------------------------------ registro

/**
 * Publica espelho.terreno: { n, passo, origem, altura (cópia da base, o aplainar mantém), agua } (rios e lagoas: agua.js).
 * A base e os campos ficam em terrenoBase(sim) para os outros módulos do mundo.
 */
export function registrar(sim) {
  const mapa = mapaDe(sim.mapa) ?? MAPA_HELDOPOLIS;
  const base = gerarTerreno(mapa, { cronometro: sim.cronometro });
  BASES.set(sim, { mapa, base });
  sim.espelho.terreno = {
    n: base.n,
    passo: base.passo,
    origem: [...base.origem],
    altura: base.altura.slice(),
    agua: base.agua.slice(), // cópia: a base é de todas as simulações do mesmo mapa
    rios: [], // mundo/agua.js publica
    lagoas: [],
  };
  sim.espelho.mapa.nivelMar = mapa.nivelMar;
  sim.mudancas.tudo('terreno');
}

const BASES = new WeakMap();

/** Mapa e grade base da simulação ({ mapa, base }), ou null antes do registro. */
export const terrenoBase = (sim) => BASES.get(sim) ?? null;
