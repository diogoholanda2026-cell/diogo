// Terreno: grade de alturas 1025² a 8 m gerada do mapa autoral, água, declive e o espelho.terreno (dona: S1a).
//
// gerarTerreno(mapa) é pura e determinística (só soma, produto, raiz e piso: o mesmo bit no Node, no navegador e no
// worker) e guarda o resultado por mapa: a grade BASE é da semente fixa do mapa e nunca muda. O espelho recebe uma
// cópia, que o aplainar (D5) mantém com as formas registradas; a base não vai no save.
//
// Como o relevo sai do mapa (data/mapa-heldopolis.js), em duas resoluções:
//  - grade grossa de 32 m (257²): distância com sinal à costa (com o tipo de costa, praia ou costão), ao rio (lado e
//    arco), à lagoa, às cristas das serras e colinas baixas da planície;
//  - grade fina de 8 m: planície e fundo do mar pela distância à costa, serras com espigões e grotas no sentido da
//    encosta, domos de granito e morros, platô da gleba, vale e várzea do rio, lagoa, detalhe fino só nos morros.
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

/** Ruído de gradiente 2D (Perlin) em [-1, 1], com semente inteira. */
export function ruido(x, z, s) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const ax = Math.imul(xi, 0x27d4eb2d);
  const bx = Math.imul(xi + 1, 0x27d4eb2d);
  const az = Math.imul(zi, 0x165667b1) ^ s;
  const bz = Math.imul(zi + 1, 0x165667b1) ^ s;
  const g00 = mistura(ax ^ az);
  const g10 = mistura(bx ^ az);
  const g01 = mistura(ax ^ bz);
  const g11 = mistura(bx ^ bz);
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

/** Perfil de um domo: 'pao' de ombros cheios e flanco quase a prumo; 'morro' redondo de pé côncavo. */
function perfilDomo(forma, t2) {
  if (t2 >= 1) return 0;
  const u = 1 - t2;
  return forma === 'pao' ? u * (1 + 0.35 * t2) : u * u;
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
  if (praia < 1) {
    // costão: a pedra sobe logo da água
    const c = Math.min(9, 0.4 * d) + P.subida * Math.max(0, d - 20);
    h += (Math.min(c, P.teto) - h) * (1 - praia);
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
 * a distância fica `longe`.
 */
function campoPolilinha(G, L, faixa, { fechado = false, longe = 1e6 } = {}) {
  const { nc, pc, ox, oz } = G;
  const N = nc * nc;
  const dist = new Float32Array(N).fill(longe);
  const lado = new Float32Array(N).fill(1);
  const arco = new Float32Array(N);
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
          lado[kk] = vx * (pz - az) - vz * (px - ax) >= 0 ? 1 : -1;
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

/** Serras: altura das cristas com espigões e grotas no sentido da encosta, na grade grossa (máximo entre serras). */
function campoSerras(G, mapa, semente) {
  const { nc, pc, ox, oz } = G;
  const N = nc * nc;
  const R = new Float32Array(N);
  let idx = 0;
  for (const serra of mapa.serras) {
    const L = densificar(serra.pontos, 110);
    let faixa = 0;
    for (const p of serra.pontos) if (p[3] > faixa) faixa = p[3];
    const C = campoPolilinha(G, L, faixa);
    const s1 = semente + 7919 * ++idx;
    // altura e meia largura por arco, a cada 16 m
    const nt = Math.ceil(L.s[L.n - 1] / 16) + 2;
    const tab = new Float32Array(nt * 2);
    for (let q = 0; q < nt; q++) {
      tab[2 * q] = atributoNoArco(L, 0, q * 16);
      tab[2 * q + 1] = atributoNoArco(L, 1, q * 16);
    }
    for (let k = 0; k < N; k++) {
      const d = C.dist[k];
      if (!(d < faixa)) continue;
      const s = C.arco[k];
      let q = (s / 16) | 0;
      if (q > nt - 2) q = nt - 2;
      const f = s / 16 - q;
      const W = tab[2 * q + 1] + (tab[2 * q + 3] - tab[2 * q + 1]) * f;
      const t = d / W;
      if (t >= 1) continue;
      const H = tab[2 * q] + (tab[2 * q + 2] - tab[2 * q]) * f;
      const px = ox + (k % nc) * pc;
      const pz = oz + ((k / nc) | 0) * pc;
      // coordenadas da encosta: u ao longo da crista (torcido), v descendo; espigões alongados no sentido de v
      const u = s + 120 * ruido(px / 650, pz / 650, s1 + 3);
      const n1 = 1 - Math.abs(ruido(u / 300, d / 1000, s1));
      const n2 = 1 - Math.abs(ruido(u / 135, d / 480, s1 + 11));
      // espigões (cristas que descem da serra) e grotas entre eles; a crista sobe e desce em picos e selas
      const espigao = 0.62 * n1 * n1 * n1 + 0.38 * n2 * n2;
      const crista = 0.84 + 0.3 * ruido(u / 850, 0.5, s1 + 17);
      const h = H * crista * perfilSerra(t) * (0.5 + 0.5 * espigao);
      if (h > R[k]) R[k] = h;
    }
  }
  return R;
}

/**
 * Relevo da terra além da planície, na grade grossa: planaltos atrás das serras e colinas (coxilhas baixas perto da
 * cidade, morrotes longe dela), já com o peso da distância à costa.
 */
function campoPlanalto(G, mapa, semente, sdCosta) {
  const { nc, pc, ox, oz } = G;
  const N = nc * nc;
  const out = new Float32Array(N);
  const P = mapa.planicie;
  const [r0, r1] = P.raioCidade;
  // cada planalto: distância para dentro do contorno
  for (const [q, pl] of mapa.planaltos.entries()) {
    const L = densificar(pl.contorno.map(([x, z]) => [x, z]), 200, true);
    const C = campoPolilinha(G, L, pl.borda, { fechado: true, longe: pl.borda });
    const X = L.x;
    const Z = L.z;
    const dentro = preencherPoligono(G, X, Z);
    const sp = semente + 3571 * (q + 1);
    for (let k = 0; k < N; k++) {
      if (!dentro[k]) continue;
      const px = ox + (k % nc) * pc;
      const pz = oz + ((k / nc) | 0) * pc;
      const w = smoothstep(0, pl.borda, C.dist[k]);
      // o planalto é recortado: vales (ruído em crista invertido) entre morros de topo redondo
      const v = 1 - Math.abs(ruido(px / 620, pz / 620, sp + 1));
      const h = w * (pl.cota + pl.ondulacao * fbm(px / 1400, pz / 1400, sp, 2)) * (0.62 + 0.38 * v * v);
      if (h > out[k]) out[k] = h;
    }
  }
  for (let k = 0; k < N; k++) {
    const sd = sdCosta[k];
    if (sd <= 0) continue;
    const px = ox + (k % nc) * pc;
    const pz = oz + ((k / nc) | 0) * pc;
    const c = 0.7 * ruido(px / 950, pz / 950, semente + 31) + 0.3 * ruido(px / 420, pz / 420, semente + 37);
    const longe = smoothstep(r0, r1, Math.sqrt(px * px + pz * pz));
    // morrotes: só as cristas do ruído sobem, redondas; coxilhas: ondulação suave
    const morrote = P.morrotes * longe * smoothstep(0.05, 0.75, c);
    out[k] = (out[k] + P.colinas * c + morrote) * smoothstep(150, 900, sd);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ gerador

const CACHE = new Map();

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
  const serras = campoSerras(G, mapa, semente);
  const planalto = campoPlanalto(G, mapa, semente, costa.sd);
  const rioL = densificar(mapa.rio.pontos, 60);
  const faixaRio = 1100;
  const rio = campoPolilinha(G, rioL, faixaRio);
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

  // córregos: quanto o vale raso tira da planície (grade grossa; o vale tem centenas de metros de comprimento)
  const corrego = new Float32Array(nc * nc);
  for (const c of mapa.corregos ?? []) {
    const L = densificar(c.pontos, 40);
    const C = campoPolilinha(G, L, c.largura * 1.6);
    for (let k = 0; k < nc * nc; k++) {
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
  espalharMorros(mapa, semente, G, costa, planalto, relevo, tipoDomo);

  // composição na grade fina
  const altura = new Float32Array(N);
  const agua = new Uint8Array(N);
  compor({
    n, passo, ox: origem[0], oz: origem[1], nc, semente, P: mapa.planicie, plato: mapa.plato, lagoa: mapa.lagoa,
    campos: [costa.sd, costa.praia, costa.duna, planalto, serras, rioSL, rio.arco, lagoaSd, corrego],
    tabRio, nTab, faixaRio, relevo, tipoDomo, altura, agua,
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
      G, costa, planalto, relevo, tipoDomo, corrego,
      rio: { L: rioL, sl: rioSL, arco: rio.arco, tab: tabRio, nTab, faixa: faixaRio },
      lagoa: { L: lagoaL, sd: lagoaSd },
    },
  };
}

/** Planície (ou fundo) num ponto qualquer pelos campos grossos, sem serras nem domos. */
function baixadaEm(G, costa, planalto, P, x, z) {
  const { nc, pc, ox, oz } = G;
  const sd = amostrar(costa.sd, nc, pc, ox, oz, x, z);
  const praia = amostrar(costa.praia, nc, pc, ox, oz, x, z);
  if (sd < 0) return fundoMar(-sd, praia);
  const duna = amostrar(costa.duna, nc, pc, ox, oz, x, z);
  return planicie(sd, praia, duna, P) + amostrar(planalto, nc, pc, ox, oz, x, z);
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
function espalharMorros(mapa, semente, G, costa, planalto, relevo, tipoDomo) {
  const { n, passo } = mapa;
  const [ox, oz] = mapa.origem;
  const SAIA = 1.6;
  // passada rala primeiro (todos os tipos de morro passam pelo laço antes de ele ser otimizado), depois a cheia
  for (let passada = 0; passada < 2; passada++) {
  const salto = passada === 0 ? 8 : 1;
  for (const [m, morro] of mapa.morros.entries()) {
    const cs = cos(morro.ang);
    const sn = sen(morro.ang);
    const A = Math.max(0, morro.h - baixadaEm(G, costa, planalto, mapa.planicie, morro.x, morro.z));
    const r = Math.max(morro.rx, morro.rz) * SAIA * 1.12;
    const i0 = Math.max(0, Math.floor((morro.x - r - ox) / passo));
    const i1 = Math.min(n - 1, Math.ceil((morro.x + r - ox) / passo));
    const j0 = Math.max(0, Math.floor((morro.z - r - oz) / passo));
    const j1 = Math.min(n - 1, Math.ceil((morro.z + r - oz) / passo));
    const sm = semente + 104729 * (m + 1);
    const pao = morro.forma === 'pao';
    const nucleo = pao ? 0.86 : 0.8;
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
        if (e2 >= SAIA * SAIA * 1.25) continue;
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
        let t2p = 9;
        for (let q = 0; q < nl; q++) {
          const L = lobos[q];
          const ax = (lx - L[0]) / L[2];
          const az = (lz - L[1]) / L[3];
          const t2 = ax * ax + az * az;
          if (q === 0) t2p = t2;
          if (t2 >= 1) continue;
          const u = 1 - t2;
          const v = L[4] * (pao ? u * (1 + 0.35 * t2) : u * u);
          if (v > h) h = v;
        }
        h *= nucleo;
        const ts = (lx * lx + lz * lz) / (SAIA * SAIA);
        if (ts < 1) {
          const u = 1 - ts;
          h += (1 - nucleo) * u * u;
        }
        if (h <= 0) continue;
        const flanco = t2p < 1 ? 4 * t2p * (1 - t2p) : 0;
        if (pao) {
          // caneluras: o ruído só muda com a direção (constante ao longo do raio), então desenha sulcos que descem
          const rr = Math.sqrt(lx * lx + lz * lz) + 1e-6;
          const g = ruido((lx / rr) * 5.5, (lz / rr) * 5.5, sm + 5);
          h *= 1 + 0.035 * w1 + flanco * 0.05 * g;
        } else {
          const g = 1 - Math.abs(ruido(dx / 75, dz / 75, sm + 5));
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
 * Composição na grade fina, linha a linha: as linhas grossas são interpoladas uma vez por linha fina e depois ao longo
 * dela. Escreve altura, água e o relevo acima da planície (serras e domos, para a mata e os recursos).
 */
function compor(o) {
  const { n, passo, ox, oz, nc, P, plato, lagoa, campos, tabRio, nTab, faixaRio, relevo, tipoDomo, altura, agua } = o;
  const nCampos = campos.length;
  const linhas = [];
  for (let c = 0; c < nCampos; c++) linhas.push(new Float32Array(nc));
  const Lsd = linhas[0];
  const Lpraia = linhas[1];
  const Lduna = linhas[2];
  const Lpla = linhas[3];
  const Lser = linhas[4];
  const Lrio = linhas[5];
  const Larco = linhas[6];
  const Llag = linhas[7];
  const Lcor = linhas[8];
  const cx0 = plato.caixa[0];
  const cz0 = plato.caixa[1];
  const cx1 = plato.caixa[2];
  const cz1 = plato.caixa[3];
  const cotaPlato = plato.cota;
  const alcPlato = plato.margem + plato.transicao;
  const nivelLagoa = lagoa.nivel;
  const profLagoa = lagoa.profundidade;
  const sDet = o.semente + 55;
  const sVale = o.semente + 77;
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
    const dentroPlatoZ = z > cz0 - alcPlato && z < cz1 + alcPlato;
    const ddz = z < cz0 ? cz0 - z : z > cz1 ? z - cz1 : 0;
    for (let i = 0; i < n; i += salto) {
      const x = ox + i * passo;
      const ic = i >> 2;
      const fx = (i & 3) * 0.25;
      const ic2 = ic + 1 < nc ? ic + 1 : ic;
      const k = j * n + i;
      const sd = Lsd[ic] + (Lsd[ic2] - Lsd[ic]) * fx;
      const praia = Lpraia[ic] + (Lpraia[ic2] - Lpraia[ic]) * fx;
      // planície (praia, costão, restinga, subida para dentro) ou fundo do mar
      let h;
      let pla = 0;
      if (sd >= 0) {
        if (sd < lp) {
          const t = sd / lp;
          h = cotaPraia * t * (2 - t);
        } else {
          h = cotaPraia + subida * (sd - lp);
          if (h > teto) h = teto;
        }
        if (praia < 1) {
          let c = 0.4 * sd;
          if (c > 9) c = 9;
          if (sd > 20) c += subida * (sd - 20);
          if (c > teto) c = teto;
          h += (c - h) * (1 - praia);
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
        pla = Lpla[ic] + (Lpla[ic2] - Lpla[ic]) * fx;
        h += pla;
        const cr = Lcor[ic] + (Lcor[ic2] - Lcor[ic]) * fx;
        if (cr > 0) h -= cr * smoothstep(40, 160, sd);
      } else {
        h = fundoMar(-sd, praia);
      }
      // serras e domos (o maior dos dois), com o detalhe fino da encosta
      const rs = Lser[ic] + (Lser[ic2] - Lser[ic]) * fx;
      const rd = relevo[k];
      let r = rs > rd ? rs : rd;
      const rDet = r + (pla > 20 ? 0.5 * (pla - 20) : 0);
      if (rDet > 12) {
        const peso = rs > rd || pla > 20 ? 0.035 : tipoDomo[k] === 1 ? 0.006 : 0.02;
        const q = 1 - Math.abs(ruido(x / 110, z / 110, sDet));
        r += rDet * peso * (2 * q * q - 1);
      }
      h += r;
      relevo[k] = rDet > r ? rDet : r;
      // platô da gleba: plano na cota, sem invadir a praia
      if (dentroPlatoZ) {
        const ddx = x < cx0 ? cx0 - x : x > cx1 ? x - cx1 : 0;
        if (ddx < alcPlato) {
          const dr = ddx > 0 || ddz > 0 ? Math.sqrt(ddx * ddx + ddz * ddz) : 0;
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
        let alvo;
        if (a < hw) {
          const e = a / hw;
          alvo = nivel - 0.35 - (1.4 + hw / 22) * (1 - e * e);
        } else if (a < hw + varzea) {
          alvo = nivel + 0.8 + 1.5 * smoothstep(hw, hw + 30, a) + 0.4 * smoothstep(hw + 30, hw + varzea, a);
        } else {
          // encosta do vale: mais em pé rio acima, com ruído para não virar plano, crescendo longe do rio
          const e = a - hw - varzea;
          let enc = 0.18 + nivel * 0.009;
          if (enc > 0.75) enc = 0.75;
          alvo = nivel + 2.7 + e * (enc + 0.0004 * e) * (1 + 0.35 * ruido(x / 260, z / 260, sVale));
        }
        const fora = smoothstep(faixaRio * 0.8, faixaRio, a);
        const cortado = smin(h, alvo, a < hw + 40 ? 1.2 : 5);
        h = cortado + (h - cortado) * fora;
        if (a < hw && sd > 0) ag = AGUA.RIO;
      }
      if (ag === 0 && h < 0) ag = AGUA.MAR;
      altura[k] = h;
      agua[k] = ag;
      if (passada === 0) relevo[k] = rd; // a passada rala não pode mudar a entrada da cheia
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
 * do ponto e o lado (+1 à direita de quem desce o rio). Longe do rio, a = Infinity.
 */
export function rioEm(base, x, z) {
  const { G, rio } = base.campos;
  const sl = amostrar(rio.sl, G.nc, G.pc, G.ox, G.oz, x, z);
  const a = sl < 0 ? -sl : sl;
  if (!(a < rio.faixa)) return { a: Infinity, hw: 0, nivel: 0, varzea: 0, lado: 1 };
  const s = amostrar(rio.arco, G.nc, G.pc, G.ox, G.oz, x, z);
  const t = rio.tab;
  let q = Math.floor(s / 8);
  if (q < 0) q = 0;
  else if (q > rio.nTab - 2) q = rio.nTab - 2;
  const f = s / 8 - q;
  const v = (c) => t[4 * q + c] + (t[4 * q + 4 + c] - t[4 * q + c]) * f;
  return { a, hw: v(0), nivel: v(1), varzea: sl < 0 ? v(2) : v(3), lado: sl < 0 ? -1 : 1 };
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
    agua: base.agua,
    rios: [], // mundo/agua.js publica
    lagoas: [],
  };
  sim.espelho.mapa.nivelMar = mapa.nivelMar;
  sim.mudancas.tudo('terreno');
}

const BASES = new WeakMap();

/** Mapa e grade base da simulação ({ mapa, base }), ou null antes do registro. */
export const terrenoBase = (sim) => BASES.get(sim) ?? null;
