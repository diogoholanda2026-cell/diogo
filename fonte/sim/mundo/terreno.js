// Terreno: grade de alturas 1025² a 8 m gerada do mapa autoral, água, declive e o espelho.terreno (dona: S1a).
//
// gerarTerreno(mapa) é pura e determinística (só soma, produto, raiz e piso: o mesmo bit no Node, no navegador e no
// worker) e guarda o resultado por mapa: a grade BASE é da semente fixa do mapa e nunca muda. O espelho recebe uma
// cópia, que o aplainar (D5) mantém com as formas registradas; a base não vai no save.
//
// Como o relevo sai do mapa (data/mapa-heldopolis.js), em três resoluções:
//  - grade grossa de 32 m (257²): o que é liso. Distância com sinal à costa (com o tipo de costa, praia ou costão,
//    suavizados longe da água), ao rio (lado e arco), à lagoa, às cristas das serras, córregos e colinas baixas, e à
//    rodovia (serras e morros baixam no vale dela);
//  - grade média de 16 m (513²): a forma das serras (espigões, ravinas, crista sinuosa e arredondada) e dos planaltos,
//    e o ruído de detalhe, para nenhuma encosta mostrar as facetas da grade grossa;
//  - grade fina de 8 m: planície e fundo do mar, domos de granito e morros, platô da gleba, vale e várzea do rio,
//    lagoa, e o acabamento de detalhe.
// Os vincos dos ruídos em crista são arredondados (crista()) para não serrilhar em nenhuma das grades.
import { MAPA_HELDOPOLIS, MAPAS } from '../../data/mapa-heldopolis.js';
import { AGUA } from '../../contratos/flags.js';
import { alturaEm, decliveEm, amostrar } from '../../comum/altura.js';
import { clamp, smoothstep, cos, sen } from '../../comum/util.js';
import { fnv1aTexto } from '../../comum/hash.js';

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

function mistura(h) {
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) & (NG - 1);
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

/** Ponto dentro de um polígono dado por arrays x e z (par e ímpar). */
export function dentroDe(px, pz, X, Z, n = X.length) {
  let dentro = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const zi = Z[i];
    const zj = Z[j];
    if (zi > pz !== zj > pz && px < ((X[j] - X[i]) * (pz - zi)) / (zj - zi) + X[i]) dentro = !dentro;
  }
  return dentro;
}

// ------------------------------------------------------------------------------------------------ perfis


/** Mínimo suave (k em metros): junta dois relevos sem vinco. */
function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}

/** Perfil de uma serra da crista (t = 0) à base (t = 1): topo agudo e encosta côncava. */
function perfilSerra(t) {
  if (t >= 1) return 0;
  const u = 1 - t;
  return 0.55 * u * u + 0.45 * u * u * (1 + 2 * t);
}

/** Terra firme: rampa da praia (ou do costão), subida da planície e dunas da restinga, sem as colinas. */
function planicie(d, praia, duna, P) {
  const lp = P.larguraPraia;
  let h;
  if (d < lp) {
    const t = d / lp;
    h = P.cotaPraia * t * (2 - t); // rampa côncava da areia até a berma
  } else {
    h = P.cotaPraia + P.subida * (d - lp);
    if (h > P.teto) h = P.teto;
  }
  if (praia < 1 && d < 320) {
    // costão: a pedra sobe logo da água; para dentro a planície volta a ser uma só (a mesma conta de compor)
    const c = Math.min(9, 0.4 * d) + P.subida * Math.max(0, d - 20);
    h += (Math.min(c, P.teto) - h) * (1 - praia) * (1 - smoothstep(90, 320, d));
  }
  if (duna > 0 && d > 18 && d < 150) {
    const b = (d - 70) / 45;
    if (b > -1 && b < 1) {
      const q = 1 - b * b;
      h += duna * 3.2 * q * q;
    }
  }
  return h;
}

/** Fundo do mar a u metros da costa (u > 0): raso na praia, fundo logo no costão; longe, o mesmo fundo. */
function fundoMar(u, praia) {
  if (u > 150) praia += (1 - praia) * smoothstep(150, 700, u);
  const areia = u < 110 ? -0.028 * u : u < 1400 ? -3.08 - 0.0066 * (u - 110) : -11.6 - 0.0042 * (u - 1400);
  const pedra = u < 60 ? -0.13 * u : -7.8 - 0.0062 * (u - 60);
  const h = pedra + (areia - pedra) * praia;
  return h < -32 ? -32 : h;
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

/** Grade média (16 m, 513²) alinhada à fina: a amostra (im, jm) média é a (2 im, 2 jm) fina. */
function gradeMedia(n, passo, origem) {
  const nm = ((n - 1) >> 1) + 1;
  return { nm, pm: passo * 2, ox: origem[0], oz: origem[1] };
}

/**
 * Serras na grade média (16 m): a distância à crista e o arco vêm da grade grossa (são lisos); a forma da encosta sai
 * a cada 16 m, para os espigões e as grotas não virarem facetas da grade grossa. Perfil côncavo da crista (arredondada)
 * ao pé; o ponto de leitura anda com um deslocamento lento, e a crista e os espigões serpenteiam; espigões alongados no
 * sentido da encosta, que entortam e se ramificam descendo; picos e selas ao longo da crista; ravinas de duas oitavas
 * (240 m, na grossa, e 110 m, da grade de detalhe) quebram a meia encosta. Máximo entre as serras.
 */
function campoSerras(G, M, mapa, semente, detalhe) {
  const { nc, pc } = G;
  const { nm, pm, ox, oz } = M;
  const R = new Float32Array(nm * nm);
  // campos lentos comuns às serras: a torção e o deslocamento da leitura (520 a 650 m) numa grade de 64 m, e a oitava
  // larga das ravinas (240 m) na grossa
  const n64 = ((nm - 1) >> 2) + 1;
  const torcao = gradeRuido(n64, pm * 4, ox, oz, 650, semente + 3);
  const desvioX = gradeRuido(n64, pm * 4, ox, oz, 520, semente + 5);
  const desvioZ = gradeRuido(n64, pm * 4, ox, oz, 520, semente + 7);
  const ravinaG = gradeRuido(nc, pc, G.ox, G.oz, 240, semente + 31);
  const DESVIO = 70;
  const buf = { dist: new Float32Array(nc * nc), arco: new Float32Array(nc * nc) };
  const esp1 = new Float32Array(nc * nc);
  let rala = null; // serras do fundo: avaliadas a cada 32 m e interpoladas para a média
  let idx = 0;
  for (const serra of mapa.serras) {
    const L = densificar(serra.pontos, 200);
    let faixa = 0;
    for (const p of serra.pontos) if (p[3] > faixa) faixa = p[3];
    // fora da faixa a distância fica um pouco além dela: a bilinear perto da borda não pula para o infinito
    const C = campoPolilinha(G, L, faixa, { longe: faixa * 1.3, saida: buf, comLado: false });
    const D = C.dist;
    const A = C.arco;
    const s1 = semente + 7919 * ++idx;
    const fino = serra.fino !== false;
    // a oitava larga dos espigões (320 m ao longo da crista, 900 m descendo) é lenta: sai na grossa, nas coordenadas da
    // encosta de cada nó, e a média lê no mesmo ponto deslocado da distância
    esp1.fill(0);
    for (let k = 0; k < nc * nc; k++) {
      const d = D[k];
      if (!(d < faixa)) continue;
      const ic = k % nc;
      const jc = (k / nc) | 0;
      const i4 = ic >> 1 < n64 - 1 ? ic >> 1 : n64 - 2;
      const j4 = jc >> 1 < n64 - 1 ? jc >> 1 : n64 - 2;
      const f4x = ic >> 1 < n64 - 1 ? (ic & 1) * 0.5 : 1;
      const f4z = jc >> 1 < n64 - 1 ? (jc & 1) * 0.5 : 1;
      const t0 = torcao[j4 * n64 + i4] + (torcao[j4 * n64 + i4 + 1] - torcao[j4 * n64 + i4]) * f4x;
      const t1 = torcao[(j4 + 1) * n64 + i4] + (torcao[(j4 + 1) * n64 + i4 + 1] - torcao[(j4 + 1) * n64 + i4]) * f4x;
      const u = A[k] + 120 * (t0 + (t1 - t0) * f4z);
      esp1[k] = crista(ruido(u / 320, d / 900, s1), 0.25);
    }
    // por arco, a cada 16 m: altura, meia largura e os picos e selas da crista
    const nt = Math.ceil(L.s[L.n - 1] / 16) + 2;
    const tab = new Float32Array(nt * 3);
    for (let q = 0; q < nt; q++) {
      tab[3 * q] = atributoNoArco(L, 0, q * 16) * (0.84 + 0.3 * ruido((q * 16) / 850, 0.5, s1 + 17));
      tab[3 * q + 1] = atributoNoArco(L, 1, q * 16);
    }
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (let q = 0; q < L.n; q++) {
      if (L.x[q] < x0) x0 = L.x[q];
      if (L.x[q] > x1) x1 = L.x[q];
      if (L.z[q] < z0) z0 = L.z[q];
      if (L.z[q] > z1) z1 = L.z[q];
    }
    const alc = faixa + DESVIO;
    const i0 = Math.max(0, Math.floor((x0 - alc - ox) / pm));
    const i1 = Math.min(nm - 1, Math.ceil((x1 + alc - ox) / pm));
    const j0 = Math.max(0, Math.floor((z0 - alc - oz) / pm));
    const j1 = Math.min(nm - 1, Math.ceil((z1 + alc - oz) / pm));
    // a serra do fundo (sem a oitava fina) sai a cada 32 m: os limites vão para os nós pares (nm - 1 é par)
    const salto = fino ? 1 : 2;
    const jA = salto === 2 ? j0 & ~1 : j0;
    const jB = salto === 2 ? Math.min(nm - 1, j1 + (j1 & 1)) : j1;
    const iA = salto === 2 ? i0 & ~1 : i0;
    const iB = salto === 2 ? Math.min(nm - 1, i1 + (i1 & 1)) : i1;
    if (salto === 2) {
      rala ??= new Float32Array(nm * nm);
      for (let jm = jA; jm <= jB; jm++) rala.fill(0, jm * nm + iA, jm * nm + iB + 1);
    }
    for (let jm = jA; jm <= jB; jm += salto) {
      const pz = oz + jm * pm;
      // linha grossa sem deslocamento (as grades se alinham: 2 médias por grossa)
      const jg = jm >> 1 < nc - 1 ? jm >> 1 : nc - 2;
      const fzg = jm >> 1 < nc - 1 ? (jm & 1) * 0.5 : 1;
      const j4 = jm >> 2 < n64 - 1 ? jm >> 2 : n64 - 2;
      const f4z = jm >> 2 < n64 - 1 ? (jm & 3) * 0.25 : 1;
      const r40 = j4 * n64;
      const r41 = r40 + n64;
      for (let im = iA; im <= iB; im += salto) {
        const px = ox + im * pm;
        const ig = im >> 1 < nc - 1 ? im >> 1 : nc - 2;
        const fxg = im >> 1 < nc - 1 ? (im & 1) * 0.5 : 1;
        const g0 = jg * nc + ig;
        const g1 = g0 + nc;
        // longe da faixa mesmo com o deslocamento: pula sem ler o resto (a distância muda no máximo 1 m por metro)
        const d0 = D[g0] < D[g0 + 1] ? D[g0] : D[g0 + 1];
        const d1 = D[g1] < D[g1 + 1] ? D[g1] : D[g1 + 1];
        if ((d0 < d1 ? d0 : d1) > faixa + 1.5 * (DESVIO + pc)) continue;
        // campos lentos na grade de 64 m, no ponto sem deslocamento
        const i4 = im >> 2 < n64 - 1 ? im >> 2 : n64 - 2;
        const f4x = im >> 2 < n64 - 1 ? (im & 3) * 0.25 : 1;
        const a0 = r40 + i4;
        const a1 = r41 + i4;
        const xa = desvioX[a0] + (desvioX[a0 + 1] - desvioX[a0]) * f4x;
        const za = desvioZ[a0] + (desvioZ[a0 + 1] - desvioZ[a0]) * f4x;
        const qx = px + DESVIO * (xa + (desvioX[a1] + (desvioX[a1 + 1] - desvioX[a1]) * f4x - xa) * f4z);
        const qz = pz + DESVIO * (za + (desvioZ[a1] + (desvioZ[a1 + 1] - desvioZ[a1]) * f4x - za) * f4z);
        // leitura deslocada da distância, do arco e da torção
        let fx = (qx - G.ox) / pc;
        let fz = (qz - G.oz) / pc;
        if (fx < 0) fx = 0;
        else if (fx > nc - 1) fx = nc - 1;
        if (fz < 0) fz = 0;
        else if (fz > nc - 1) fz = nc - 1;
        let ic = Math.floor(fx);
        let jc = Math.floor(fz);
        if (ic > nc - 2) ic = nc - 2;
        if (jc > nc - 2) jc = nc - 2;
        fx -= ic;
        fz -= jc;
        const k0 = jc * nc + ic;
        const k1 = k0 + nc;
        const da = D[k0] + (D[k0 + 1] - D[k0]) * fx;
        const d = da + (D[k1] + (D[k1 + 1] - D[k1]) * fx - da) * fz;
        if (!(d < faixa)) continue;
        const aa = A[k0] + (A[k0 + 1] - A[k0]) * fx;
        const s = aa + (A[k1] + (A[k1 + 1] - A[k1]) * fx - aa) * fz;
        let q = (s / 16) | 0;
        if (q < 0) q = 0;
        else if (q > nt - 2) q = nt - 2;
        const f = s / 16 - q;
        const W = tab[3 * q + 1] + (tab[3 * q + 4] - tab[3 * q + 1]) * f;
        const t = d / W;
        if (t >= 1) continue;
        const H = tab[3 * q] + (tab[3 * q + 3] - tab[3 * q]) * f;
        // crista arredondada (não é fio de faca): o perfil lê t amaciado perto de 0
        const tr = Math.sqrt(t * t + 0.0025) - 0.05 + 0.05 * t;
        const ta = torcao[a0] + (torcao[a0 + 1] - torcao[a0]) * f4x;
        const tw = ta + (torcao[a1] + (torcao[a1 + 1] - torcao[a1]) * f4x - ta) * f4z;
        // coordenadas da encosta: u ao longo da crista (torcido pela torção lenta e pelo deslocamento), d descendo
        const u = s + 120 * tw;
        // espigões: cristas redondas que descem da serra, com grotas entre elas (a oitava larga vem da grossa)
        const ea = esp1[k0] + (esp1[k0 + 1] - esp1[k0]) * fx;
        const n1 = ea + (esp1[k1] + (esp1[k1 + 1] - esp1[k1]) * fx - ea) * fz;
        // a oitava fina (150 m) só nas serras perto da cidade; nas do fundo vale a média dela
        const n2 = fino ? crista(ruido(u / 150, d / 420, s1 + 11), 0.3) : 0.7;
        const espigao = 0.62 * n1 * n1 * n1 + 0.38 * n2 * n2;
        // ravinas: ruído em crista suave de duas oitavas no mundo (a segunda pesa onde a primeira é crista)
        const ra = ravinaG[g0] + (ravinaG[g0 + 1] - ravinaG[g0]) * fxg;
        let r1 = crista(ra + (ravinaG[g1] + (ravinaG[g1 + 1] - ravinaG[g1]) * fxg - ra) * fzg, 0.3);
        r1 *= r1;
        let r2 = fino ? crista(detalhe[jm * nm + im], 0.35) : 0.6;
        r2 *= r2 * r1;
        const ravina = 0.7 * r1 + 0.3 * r2;
        // a meia encosta é a mais recortada; a crista e o pé, mais lisos
        const meio = 4 * t * (1 - t);
        const h = H * perfilSerra(tr) * (0.5 + 0.38 * espigao + meio * 0.2 * (ravina - 0.45));
        const k = jm * nm + im;
        if (salto === 2) rala[k] = h;
        else if (h > R[k]) R[k] = h;
      }
    }
    if (salto === 2) {
      // interpola os nós ímpares entre os pares avaliados
      for (let jm = jA; jm <= jB; jm++) {
        const ja = jm & ~1;
        const jb = jm & 1 ? ja + 2 : ja;
        const fz = (jm & 1) * 0.5;
        for (let im = iA; im <= iB; im++) {
          const ia = im & ~1;
          const ib = im & 1 ? ia + 2 : ia;
          const fx = (im & 1) * 0.5;
          const a = rala[ja * nm + ia] + (rala[ja * nm + ib] - rala[ja * nm + ia]) * fx;
          const b = rala[jb * nm + ia] + (rala[jb * nm + ib] - rala[jb * nm + ia]) * fx;
          const h = a + (b - a) * fz;
          const k = jm * nm + im;
          if (h > R[k]) R[k] = h;
        }
      }
    }
  }
  return R;
}

/**
 * Relevo da terra além da planície, na grade média: planaltos atrás das serras (morros de topo redondo recortados por
 * vales) e colinas (coxilhas baixas perto da cidade, morrotes longe dela), já com o peso da distância à costa. O que é
 * lento (a borda, a ondulação de 1.400 m e as colinas) sai da grade grossa; os vales, a cada 16 m.
 */
function campoPlanalto(G, M, mapa, semente, sdCosta) {
  const { nc, pc } = G;
  const { nm, pm, ox, oz } = M;
  const NC = nc * nc;
  const out = new Float32Array(nm * nm);
  const P = mapa.planicie;
  const [r0, r1] = P.raioCidade;
  const buf = { dist: new Float32Array(NC), arco: new Float32Array(NC) };
  const w = new Float32Array(NC);
  const lento = new Float32Array(NC);
  // linha jm da média lida na grossa (2 médias por grossa), para interpolar ao longo dela
  const lw = new Float32Array(nc);
  const ll = new Float32Array(nc);
  const linhaAlinhada = (F, jm, L) => {
    const jg = jm >> 1 < nc - 1 ? jm >> 1 : nc - 2;
    const fz = jm >> 1 < nc - 1 ? (jm & 1) * 0.5 : 1;
    const a = jg * nc;
    const b = a + nc;
    for (let q = 0; q < nc; q++) L[q] = F[a + q] + (F[b + q] - F[a + q]) * fz;
  };
  for (const [q, pl] of mapa.planaltos.entries()) {
    const L = densificar(pl.contorno.map(([x, z]) => [x, z]), 200, true);
    const C = campoPolilinha(G, L, pl.borda, { fechado: true, longe: pl.borda, saida: buf, comLado: false });
    const dentro = preencherPoligono(G, L.x, L.z);
    const sp = semente + 3571 * (q + 1);
    // na grossa: o peso da borda (0 fora) e a ondulação lenta
    w.fill(0);
    lento.fill(0);
    for (let k = 0; k < NC; k++) {
      if (!dentro[k]) continue;
      const px = G.ox + (k % nc) * pc;
      const pz = G.oz + ((k / nc) | 0) * pc;
      w[k] = smoothstep(0, pl.borda, C.dist[k]);
      lento[k] = pl.cota + pl.ondulacao * fbm(px / 1400, pz / 1400, sp, 2);
    }
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (const [x, z] of pl.contorno) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
    const i0 = Math.max(0, Math.floor((x0 - ox) / pm));
    const i1 = Math.min(nm - 1, Math.ceil((x1 - ox) / pm));
    const j0 = Math.max(0, Math.floor((z0 - oz) / pm));
    const j1 = Math.min(nm - 1, Math.ceil((z1 - oz) / pm));
    for (let jm = j0; jm <= j1; jm++) {
      const pz = oz + jm * pm;
      linhaAlinhada(w, jm, lw);
      linhaAlinhada(lento, jm, ll);
      for (let im = i0; im <= i1; im++) {
        const ig = im >> 1 < nc - 1 ? im >> 1 : nc - 2;
        const fx = im >> 1 < nc - 1 ? (im & 1) * 0.5 : 1;
        const wk = lw[ig] + (lw[ig + 1] - lw[ig]) * fx;
        if (wk <= 0) continue;
        const px = ox + im * pm;
        // o planalto é recortado: vales (ruído em crista invertido) entre morros de topo redondo
        const v = crista(ruido(px / 620, pz / 620, sp + 1), 0.2);
        const h = wk * (ll[ig] + (ll[ig + 1] - ll[ig]) * fx) * (0.62 + 0.38 * v * v);
        const k = jm * nm + im;
        if (h > out[k]) out[k] = h;
      }
    }
  }
  // colinas e morrotes (lentos: na grossa) e o peso da distância à costa
  const col = lento.fill(0);
  for (let k = 0; k < NC; k++) {
    if (sdCosta[k] <= 0) continue;
    const px = G.ox + (k % nc) * pc;
    const pz = G.oz + ((k / nc) | 0) * pc;
    const c = 0.7 * ruido(px / 950, pz / 950, semente + 31) + 0.3 * ruido(px / 420, pz / 420, semente + 37);
    const longe = smoothstep(r0, r1, Math.sqrt(px * px + pz * pz));
    // morrotes: só as cristas do ruído sobem, redondas; coxilhas: ondulação suave
    col[k] = (P.colinas * c + P.morrotes * longe * smoothstep(0.05, 0.75, c)) ;
    w[k] = smoothstep(150, 900, sdCosta[k]);
  }
  for (let k = 0; k < NC; k++) if (sdCosta[k] <= 0) w[k] = 0;
  for (let jm = 0; jm < nm; jm++) {
    linhaAlinhada(w, jm, lw);
    linhaAlinhada(col, jm, ll);
    for (let im = 0; im < nm; im++) {
      const ig = im >> 1 < nc - 1 ? im >> 1 : nc - 2;
      const fx = im >> 1 < nc - 1 ? (im & 1) * 0.5 : 1;
      const k = jm * nm + im;
      const pesoCosta = lw[ig] + (lw[ig + 1] - lw[ig]) * fx;
      // na água (ou na beira) nada sobe; em terra, o planalto e as colinas pesam com a distância à costa
      if (pesoCosta <= 0 && out[k] === 0) continue;
      out[k] = (out[k] + ll[ig] + (ll[ig + 1] - ll[ig]) * fx) * pesoCosta;
    }
  }
  return out;
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


// ------------------------------------------------------------------------------------------------ gerador

const CACHE = new Map();

/**
 * Vale da rodovia: serras e morros somem até VALE_FUNDO metros do eixo e voltam inteiros a CORREDOR metros, para a BR
 * passar pelo pé da serra num vale de fundo largo, com cortes e aterros de poucos metros.
 */
const CORREDOR = 360;
const VALE_FUNDO = 50;

/**
 * Gera a grade base de um mapa (guardada por id: a segunda chamada devolve a mesma). NÃO altere os arrays devolvidos;
 * o espelho recebe cópias.
 * @returns {{ id, n, passo, origem: number[], altura: Float32Array, agua: Uint8Array, rios: object[], lagoas: object[],
 *            campos: object, ms?: number }}
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
  const semente = sementeDe(mapa.semente);
  const G = gradeGrossa(n, passo, origem);
  const { nc } = G;

  // campos grossos
  const costa = campoCosta(G, mapa);
  // longe da água, a distância e o tipo de costa suavizados (sem vinco no eixo entre duas costas)
  const sdSuave = suavizarCosta(G, costa.sd, costa.sd, 3, true);
  costa.praia = suavizarCosta(G, costa.praia, costa.sd, 3);
  costa.duna = suavizarCosta(G, costa.duna, costa.sd, 3);
  // serras e planaltos na grade média (16 m); o detalhe de 110 m é comum às serras e ao acabamento
  const M = gradeMedia(n, passo, origem);
  const detalhe = gradeRuido(M.nm, M.pm, M.ox, M.oz, 110, semente + 55);
  const serras = campoSerras(G, M, mapa, semente, detalhe);
  const planalto = campoPlanalto(G, M, mapa, semente, costa.sd);
  const rioL = densificar(mapa.rio.pontos, 60);
  const faixaRio = 950;
  const rio = campoPolilinha(G, rioL, faixaRio);
  // o arco salta no eixo de dentro das curvas (o ponto mais perto troca de trecho): a média tira o degrau do nível e
  // da várzea que ele traria
  rio.arco = suavizarCosta(G, rio.arco, null, 2);
  const rioSL = new Float32Array(nc * nc);
  for (let k = 0; k < nc * nc; k++) rioSL[k] = rio.dist[k] * rio.lado[k];
  const lagoaL = densificar(mapa.lagoa.contorno, 30, true);
  const lagoaC = campoPolilinha(G, lagoaL, 320, { fechado: true, longe: 320 });
  const lagoaSd = lagoaC.dist;
  for (let k = 0; k < nc * nc; k++) {
    if (lagoaSd[k] >= 320) {
      lagoaSd[k] = -320;
      continue;
    }
    const px = G.ox + (k % nc) * G.pc;
    const pz = G.oz + ((k / nc) | 0) * G.pc;
    if (!dentroDe(px, pz, lagoaL.x, lagoaL.z, lagoaL.n)) lagoaSd[k] = -lagoaSd[k];
  }

  // córregos: quanto o vale raso tira da planície (grade grossa; o vale tem centenas de metros de comprimento) e a
  // distância ao leito (a mata ciliar sai dela)
  const corrego = new Float32Array(nc * nc);
  const corregoDist = new Float32Array(nc * nc).fill(1e4);
  for (const [q, c] of (mapa.corregos ?? []).entries()) {
    const L = serpentear(densificar(c.pontos, 16), c.meandro ?? 22, semente + 131 * (q + 1));
    const C = campoPolilinha(G, L, c.largura * 1.6, { longe: c.largura * 1.6 + 64, comLado: false });
    for (let k = 0; k < nc * nc; k++) {
      if (C.dist[k] < corregoDist[k]) corregoDist[k] = C.dist[k];
      const t = C.dist[k] / (c.largura * 1.6);
      if (t >= 1) continue;
      const u = 1 - t * t;
      const v = c.profundidade * u * u;
      if (v > corrego[k]) corrego[k] = v;
    }
  }

  // tabela do rio por arco a cada 8 m: meia largura, nível e várzeas
  const nTab = Math.ceil(rioL.s[rioL.n - 1] / 8) + 2;
  const tabRio = new Float32Array(nTab * 4);
  for (let q = 0; q < nTab; q++) {
    const s = q * 8;
    tabRio[4 * q] = atributoNoArco(rioL, 0, s) / 2;
    tabRio[4 * q + 1] = atributoNoArco(rioL, 1, s);
    tabRio[4 * q + 2] = atributoNoArco(rioL, 2, s);
    tabRio[4 * q + 3] = atributoNoArco(rioL, 3, s);
  }

  // domos e morros na grade fina
  const relevo = new Float32Array(N);
  const tipoDomo = new Uint8Array(N); // 1 pão (pedra nua nos flancos), 2 morro
  espalharMorros(mapa, semente, G, M, costa, planalto, relevo, tipoDomo);

  // composição na grade fina
  const altura = new Float32Array(N);
  const agua = new Uint8Array(N);
  // ruídos de baixa frequência em grades ralas: o vale do rio (260 m) na grossa e o detalhe das encostas (110 m) a 16 m
  const vale = gradeRuido(nc, G.pc, G.ox, G.oz, 260, semente + 77);
  // corredor da rodovia: a estrada corre num vale entre o pé da serra e os morros (não num corte de 40 m pela encosta)
  const corredor = mapa.rodovia
    ? campoPolilinha(G, densificar(mapa.rodovia.pontos.map((p) => [p[0], p[1]]), 60), CORREDOR, { longe: CORREDOR + 64, comLado: false }).dist
    : new Float32Array(nc * nc).fill(CORREDOR + 64);
  compor({
    n, passo, ox: origem[0], oz: origem[1], nc, semente, P: mapa.planicie, plato: mapa.plato, lagoa: mapa.lagoa,
    campos: [costa.sd, costa.praia, costa.duna, rioSL, rio.arco, lagoaSd, corrego, sdSuave, vale, corredor],
    medios: [planalto, serras, detalhe],
    nm: M.nm, tabRio, nTab, faixaRio, relevo, tipoDomo, altura, agua,
  });

  // rios e lagoas do espelho
  const pontosRio = new Float64Array(rioL.n * 4);
  for (let q = 0; q < rioL.n; q++) {
    pontosRio[4 * q] = rioL.x[q];
    pontosRio[4 * q + 1] = rioL.z[q];
    pontosRio[4 * q + 2] = rioL.atr[1][q];
    pontosRio[4 * q + 3] = rioL.atr[0][q];
  }
  const contornoLagoa = new Float64Array(lagoaL.n * 2);
  for (let q = 0; q < lagoaL.n; q++) {
    contornoLagoa[2 * q] = lagoaL.x[q];
    contornoLagoa[2 * q + 1] = lagoaL.z[q];
  }
  return {
    id: mapa.id,
    n,
    passo,
    origem: [origem[0], origem[1]],
    altura,
    agua,
    rios: [{ id: mapa.rio.id, pontos: pontosRio }],
    lagoas: [{ id: mapa.lagoa.id, nivel: mapa.lagoa.nivel, contorno: contornoLagoa }],
    // campos que recursos, mata e a Vila reaproveitam
    campos: {
      G, M, costa, planalto, relevo, tipoDomo, corrego, corregoDist,
      rio: { L: rioL, sl: rioSL, arco: rio.arco, tab: tabRio, nTab, faixa: faixaRio },
      lagoa: { L: lagoaL, sd: lagoaSd },
    },
  };
}

/** Planície (ou fundo) num ponto qualquer pelos campos grossos e o planalto da média, sem serras nem domos. */
function baixadaEm(G, M, costa, planalto, P, x, z) {
  const { nc, pc, ox, oz } = G;
  const sd = amostrar(costa.sd, nc, pc, ox, oz, x, z);
  const praia = amostrar(costa.praia, nc, pc, ox, oz, x, z);
  if (sd < 0) return fundoMar(-sd, praia);
  const duna = amostrar(costa.duna, nc, pc, ox, oz, x, z);
  return planicie(sd, praia, duna, P) + amostrar(planalto, M.nm, M.pm, M.ox, M.oz, x, z);
}

/**
 * Lobos de um morro: o principal e dois ou três ombros menores ao lado, em coordenadas da elipse principal (raio 1).
 * Morro de verdade não é um domo só: tem ombros, selas e espigões (determinístico pela semente do morro).
 */
function lobosDoMorro(pao, sm) {
  const lobos = [[0, 0, 1, 1, 1]]; // cx, cz, raio x, raio z, altura
  const n = pao ? 2 : 3;
  for (let k = 0; k < n; k++) {
    const a = ((mistura(sm + 17 * k) + 0.5) / NG) * Math.PI * 2 + k * 2.1;
    const d = 0.38 + 0.04 * (mistura(sm + 31 * k) & 7);
    const r = 0.5 + 0.03 * (mistura(sm + 47 * k) & 7);
    const h = (pao ? 0.42 : 0.5) + 0.04 * (mistura(sm + 59 * k) & 7);
    lobos.push([cos(a) * d, sen(a) * d, r * 1.15, r, h]);
  }
  return lobos;
}

/**
 * Domos e morros na grade fina, espalhados pela caixa de cada um: lobos ('pao' de flanco em pé ou 'morro' redondo),
 * contorno torcido pelo ruído, saia larga e baixa (o pé do morro entra na planície sem degrau), grotas nos flancos do
 * morro de mata e caneluras (sulcos verticais) no granito do pão. h é a cota do topo acima do mar.
 */
function espalharMorros(mapa, semente, G, M, costa, planalto, relevo, tipoDomo) {
  const { n, passo } = mapa;
  const [ox, oz] = mapa.origem;
  const SAIA = 1.6;
  // passada rala primeiro (todos os tipos de morro passam pelo laço antes de ele ser otimizado), depois a cheia
  for (let passada = 0; passada < 2; passada++) {
  const salto = passada === 0 ? 8 : 1;
  for (const [m, morro] of mapa.morros.entries()) {
    const cs = cos(morro.ang);
    const sn = sen(morro.ang);
    const A = Math.max(0, morro.h - baixadaEm(G, M, costa, planalto, mapa.planicie, morro.x, morro.z));
    const r = Math.max(morro.rx, morro.rz) * SAIA * 1.12;
    const i0 = Math.max(0, Math.floor((morro.x - r - ox) / passo));
    const i1 = Math.min(n - 1, Math.ceil((morro.x + r - ox) / passo));
    const j0 = Math.max(0, Math.floor((morro.z - r - oz) / passo));
    const j1 = Math.min(n - 1, Math.ceil((morro.z + r - oz) / passo));
    const sm = semente + 104729 * (m + 1);
    const pao = morro.forma === 'pao';
    // o pão tem saia curta: a pedra entra na água em pé (sem avental de areia em volta)
    const nucleo = pao ? 0.93 : 0.8;
    const saia = pao ? 1.3 : SAIA;
    const irx = 1 / morro.rx;
    const irz = 1 / morro.rz;
    const lobos = lobosDoMorro(pao, sm);
    const nl = lobos.length;
    // face: o lado em pé (pedra), com o outro lado mais longo e manso; direção no mundo levada para a elipse
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
    for (let j = j0; j <= j1; j += salto) {
      const dz = oz + j * passo - morro.z;
      const bj = (j - j0) >> 2;
      const fz = ((j - j0) & 3) * 0.25;
      for (let i = i0; i <= i1; i += salto) {
        const dx = ox + i * passo - morro.x;
        let lx = (dx * cs + dz * sn) * irx;
        let lz = (dz * cs - dx * sn) * irz;
        const e2 = lx * lx + lz * lz;
        if (e2 >= saia * saia * 1.25) continue;
        // contorno torcido: o morro não é uma elipse
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
          lx *= 1 / f;
          lz *= 1 / f;
        }
        let h = 0;
        let s4 = 0;
        let t2p = 9;
        for (let q = 0; q < nl; q++) {
          const L = lobos[q];
          const ax = (lx - L[0]) / L[2];
          const az = (lz - L[1]) / L[3];
          const t2 = ax * ax + az * az;
          if (q === 0) t2p = t2;
          if (t2 >= 1) continue;
          const u = 1 - t2;
          // pão: flanco em pé que chega ao pé quase sem quina (só o último décimo do raio amacia)
          const v = L[4] * (pao ? u * (1 + 0.35 * t2) * (u < 0.1 ? u * u * (300 - 2000 * u) : 1) : u * u);
          if (v > h) h = v;
          s4 += v * v * v * v;
        }
        // morro de mata: os lobos se juntam pela norma 4 (o ombro sobe para o principal por uma sela lisa, sem o vinco
        // de bolhas encostadas); o pão fica com o máximo, que deixa os flancos a prumo
        if (!pao && s4 > 0) h = Math.sqrt(Math.sqrt(s4));
        h *= nucleo;
        const ts = (lx * lx + lz * lz) / (saia * saia);
        if (ts < 1) {
          const u = 1 - ts;
          h += (1 - nucleo) * u * u;
        }
        if (h <= 0) continue;
        const flanco = t2p < 1 ? 4 * t2p * (1 - t2p) : 0;
        if (pao) {
          // caneluras: o ruído anda com a direção e devagar com o raio, e desenha sulcos que descem torcendo (não é
          // um leque de raios iguais)
          const rr = Math.sqrt(lx * lx + lz * lz) + 1e-6;
          const g = ruido((lx / rr) * 4.5 + rr * 1.3, (lz / rr) * 4.5 - rr * 0.9, sm + 5);
          h *= 1 + 0.035 * w1 + flanco * 0.022 * g;
        } else {
          const g = crista(ruido(dx / 105, dz / 105, sm + 5), 0.3);
          h *= 1 + 0.05 * w1 + flanco * 0.16 * (g * g - 0.45);
        }
        h *= A;
        const k = j * n + i;
        if (passada === 1 && h > relevo[k]) {
          relevo[k] = h;
          tipoDomo[k] = pao && t2p < 1 ? 1 : 2;
        }
      }
    }
  }
  }
}

/**
 * Composição na grade fina, linha a linha: as linhas grossas (32 m) e médias (16 m) são interpoladas uma vez por linha
 * fina e depois ao longo dela. Escreve altura, água e o relevo acima da planície (serras e domos, para a mata e os
 * recursos).
 */
function compor(o) {
  const { n, passo, ox, oz, nc, nm, P, plato, lagoa, campos, medios, tabRio, nTab, faixaRio, relevo, tipoDomo, altura, agua } = o;
  const nCampos = campos.length;
  const linhas = [];
  for (let c = 0; c < nCampos; c++) linhas.push(new Float32Array(nc));
  const Lsd = linhas[0];
  const Lpraia = linhas[1];
  const Lduna = linhas[2];
  const Lrio = linhas[3];
  const Larco = linhas[4];
  const Llag = linhas[5];
  const Lcor = linhas[6];
  const Lsuave = linhas[7];
  const Lvale = linhas[8];
  const Lrod = linhas[9];
  const nMedios = medios.length;
  const linhasM = [];
  for (let c = 0; c < nMedios; c++) linhasM.push(new Float32Array(nm));
  const Lpla = linhasM[0];
  const Lser = linhasM[1];
  const Ldet = linhasM[2];
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
  const nivelLagoa = lagoa.nivel;
  const profLagoa = lagoa.profundidade;
  const lp = P.larguraPraia;
  const cotaPraia = P.cotaPraia;
  const subida = P.subida;
  const teto = P.teto;
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
    // linhas médias (16 m)
    const jm = j >> 1;
    const am = jm * nm;
    const bm = (jm + 1 < nm ? jm + 1 : jm) * nm;
    const fzm = (j & 1) * 0.5;
    for (let c = 0; c < nMedios; c++) {
      const F = medios[c];
      const L = linhasM[c];
      for (let q = 0; q < nm; q++) {
        const va = F[am + q];
        L[q] = va + (F[bm + q] - va) * fzm;
      }
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
      // mar aberto sem ilha: só o fundo (nem rio, nem lagoa, nem platô chegam a 700 m da costa)
      if (sd < -700 && relevo[k] === 0) {
        const sdS = Lsuave[ic] + (Lsuave[ic2] - Lsuave[ic]) * fx;
        const hm = fundoMar(sdS < -1 ? -sdS : -sd, 1);
        altura[k] = hm;
        agua[k] = hm < 0 ? AGUA.MAR : 0;
        continue;
      }
      // planície (praia, costão, restinga, subida para dentro) ou fundo do mar; a subida lê a distância suavizada
      // (os campos só são lidos onde pesam)
      let h;
      let pla = 0;
      if (sd >= 0) {
        if (sd < lp) {
          const t = sd / lp;
          h = cotaPraia * t * (2 - t);
        } else {
          const sdS = Lsuave[ic] + (Lsuave[ic2] - Lsuave[ic]) * fx;
          h = cotaPraia + subida * ((sdS > lp ? sdS : lp) - lp);
          if (h > teto) h = teto;
        }
        const praia = sd < 320 ? Lpraia[ic] + (Lpraia[ic2] - Lpraia[ic]) * fx : 1;
        if (praia < 1) {
          // costão: a pedra sobe logo da água; para dentro a planície volta a ser uma só
          let c = 0.4 * sd;
          if (c > 9) c = 9;
          if (sd > 20) c += subida * (sd - 20);
          if (c > teto) c = teto;
          h += (c - h) * (1 - praia) * (1 - smoothstep(90, 320, sd));
        }
        if (sd > 18 && sd < 150) {
          const duna = Lduna[ic] + (Lduna[ic2] - Lduna[ic]) * fx;
          if (duna > 0) {
            const b = (sd - 70) / 45;
            if (b > -1 && b < 1) {
              const q = 1 - b * b;
              h += duna * 3.2 * q * q;
            }
          }
        }
        pla = Lpla[im] + (Lpla[im2] - Lpla[im]) * fxm;
        h += pla;
        const cr = Lcor[ic] + (Lcor[ic2] - Lcor[ic]) * fx;
        if (cr > 0) h -= cr * smoothstep(40, 160, sd);
      } else {
        const sdS = Lsuave[ic] + (Lsuave[ic2] - Lsuave[ic]) * fx;
        const u = sdS < -1 ? -sdS : -sd;
        h = fundoMar(u, u < 700 ? Lpraia[ic] + (Lpraia[ic2] - Lpraia[ic]) * fx : 1);
      }
      // serras e domos (o maior dos dois), com o detalhe fino da encosta; no vale da rodovia eles baixam até o chão
      let rs = Lser[im] + (Lser[im2] - Lser[im]) * fxm;
      const rd0 = relevo[k];
      let rd = rd0;
      const drod = Lrod[ic] + (Lrod[ic2] - Lrod[ic]) * fx;
      if (drod < CORREDOR && (rs > 0 || rd > 0)) {
        const f = smoothstep(VALE_FUNDO, CORREDOR, drod);
        rs *= f;
        rd *= f;
      }
      let r = rs > rd ? rs : rd;
      const rDet = r + (pla > 20 ? 0.5 * (pla - 20) : 0);
      if (rDet > 12) {
        // as serras já trazem as ravinas; o detalhe fino pesa mais nos morros de mata e no planalto
        const peso = rs > rd ? 0.01 : pla > 20 ? 0.02 : tipoDomo[k] === 1 ? 0.006 : 0.012;
        const dn = Ldet[im] + (Ldet[im2] - Ldet[im]) * fxm;
        const q = crista(dn, 0.3);
        r += rDet * peso * (2 * q * q - 1);
      }
      h += r;
      relevo[k] = rDet > r ? rDet : r;
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
        const alvo = lsd >= 0 ? nivelLagoa - 0.45 - profLagoa * smoothstep(0, 130, lsd) : nivelLagoa + 0.3 - lsd * (0.055 - 0.002 * lsd);
        h = smin(h, alvo, 1.5);
        if (lsd > 0) ag = AGUA.LAGOA;
      }
      // rio: leito, várzea e as encostas do vale
      const sl = Lrio[ic] + (Lrio[ic2] - Lrio[ic]) * fx;
      const a = sl < 0 ? -sl : sl;
      if (a < faixaRio) {
        const s = Larco[ic] + (Larco[ic2] - Larco[ic]) * fx;
        let q = Math.floor(s / 8);
        if (q < 0) q = 0;
        else if (q > nTab - 2) q = nTab - 2;
        const f = s / 8 - q;
        const q4 = 4 * q;
        const hw = tabRio[q4] + (tabRio[q4 + 4] - tabRio[q4]) * f;
        const nivel = tabRio[q4 + 1] + (tabRio[q4 + 5] - tabRio[q4 + 1]) * f;
        const vi = sl < 0 ? 2 : 3;
        const varzea = tabRio[q4 + vi] + (tabRio[q4 + vi + 4] - tabRio[q4 + vi]) * f;
        let novo;
        if (a < hw) {
          // leito
          const e = a / hw;
          novo = smin(h, nivel - 0.35 - (1.4 + hw / 22) * (1 - e * e), 1.2);
        } else {
          // várzea e vale: o relevo desce liso até o piso da várzea (sem degrau nem beiço), numa encosta mais curta
          // rio acima, com a largura variando pelo ruído do vale
          const borda = hw + varzea;
          const piso = nivel + 0.8 + 1.5 * smoothstep(hw, hw + 30, a) + 0.4 * smoothstep(hw + 30, borda, a);
          // na baixada a várzea já é o vale: só uma barranca curta (os morros perto do rio ficam); na serra, a encosta
          // do vale desce em V até o rio
          const serra = smoothstep(8, 60, nivel);
          const rv = Lvale[ic] + (Lvale[ic2] - Lvale[ic]) * fx;
          const lv = (150 + 300 * serra) * (1 + 0.3 * rv);
          const w = smoothstep(borda, borda + lv, a);
          const wq = w * w + (w - w * w) * serra;
          novo = h > piso ? piso + (h - piso) * wq : h;
        }
        const fora = smoothstep(faixaRio * 0.8, faixaRio, a);
        h = novo + (h - novo) * fora;
        if (a < hw && sd > 0) ag = AGUA.RIO;
      }
      if (ag === 0 && h < 0) ag = AGUA.MAR;
      altura[k] = h;
      agua[k] = ag;
      if (passada === 0) relevo[k] = rd0; // a passada rala não pode mudar a entrada da cheia
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
 * O rio perto de (x, z) pelos campos da grade base: distância ao eixo (a), meia largura, nível da água, várzea do lado
 * do ponto e o lado (+1 à direita de quem desce o rio). Longe do rio, a = Infinity. `out` reaproveita o objeto (laços
 * sobre a grade inteira, como a mata).
 */
export function rioEm(base, x, z, out = { a: 0, hw: 0, nivel: 0, varzea: 0, lado: 1 }) {
  const { G, rio } = base.campos;
  const sl = amostrar(rio.sl, G.nc, G.pc, G.ox, G.oz, x, z);
  const a = sl < 0 ? -sl : sl;
  out.lado = sl < 0 ? -1 : 1;
  if (!(a < rio.faixa)) {
    out.a = Infinity;
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
  const c = sl < 0 ? 2 : 3;
  out.a = a;
  out.hw = t[q4] + (t[q4 + 4] - t[q4]) * f;
  out.nivel = t[q4 + 1] + (t[q4 + 5] - t[q4 + 1]) * f;
  out.varzea = t[q4 + c] + (t[q4 + 4 + c] - t[q4 + c]) * f;
  return out;
}

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
