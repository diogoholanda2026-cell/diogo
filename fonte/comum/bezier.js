// Bézier cúbica no chão: p são 8 números x0 z0 x1 z1 x2 z2 x3 z3 (P0 no nó a, P3 no nó b, seção 2.4).
// Todas as funções aceitam um deslocamento o para ler direto da coluna p das arestas (8 por aresta).
import { atan2, hipot } from './util.js';

const PASSOS_ARCO = 16;
const SUB = 4; // subamostras por trecho da tabela de arco

/** Ponto da curva no parâmetro t. */
export function ponto(p, t, out = [0, 0], o = 0) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  out[0] = a * p[o] + b * p[o + 2] + c * p[o + 4] + d * p[o + 6];
  out[1] = a * p[o + 1] + b * p[o + 3] + c * p[o + 5] + d * p[o + 7];
  return out;
}

/** Derivada da curva no parâmetro t (não normalizada). */
export function tangente(p, t, out = [0, 0], o = 0) {
  const u = 1 - t;
  const a = 3 * u * u;
  const b = 6 * u * t;
  const c = 3 * t * t;
  out[0] = a * (p[o + 2] - p[o]) + b * (p[o + 4] - p[o + 2]) + c * (p[o + 6] - p[o + 4]);
  out[1] = a * (p[o + 3] - p[o + 1]) + b * (p[o + 5] - p[o + 3]) + c * (p[o + 7] - p[o + 5]);
  if (out[0] === 0 && out[1] === 0) {
    // pontos de controle colados na ponta: usa a corda
    out[0] = p[o + 6] - p[o];
    out[1] = p[o + 7] - p[o + 1];
  }
  return out;
}

/** Tangente unitária no parâmetro t. */
export function direcao(p, t, out = [0, 0], o = 0) {
  tangente(p, t, out, o);
  const c = hipot(out[0], out[1]) || 1;
  out[0] /= c;
  out[1] /= c;
  return out;
}

/**
 * Reta como cúbica (controles a um terço e a dois terços).
 * @example reta(0, 0, 90, 0) // Float64Array [0, 0, 30, 0, 60, 0, 90, 0]
 */
export function reta(x0, z0, x3, z3, out = new Float64Array(8)) {
  out[0] = x0;
  out[1] = z0;
  out[2] = x0 + (x3 - x0) / 3;
  out[3] = z0 + (z3 - z0) / 3;
  out[4] = x0 + (2 * (x3 - x0)) / 3;
  out[5] = z0 + (2 * (z3 - z0)) / 3;
  out[6] = x3;
  out[7] = z3;
  return out;
}

/** Curva simples de 3 pontos (início, controle, fim) como cúbica: a quadrática elevada de grau. */
export function deQuadratica(x0, z0, cx, cz, x3, z3, out = new Float64Array(8)) {
  out[0] = x0;
  out[1] = z0;
  out[2] = x0 + (2 / 3) * (cx - x0);
  out[3] = z0 + (2 / 3) * (cz - z0);
  out[4] = x3 + (2 / 3) * (cx - x3);
  out[5] = z3 + (2 / 3) * (cz - z3);
  out[6] = x3;
  out[7] = z3;
  return out;
}

/**
 * Tabela de arco: comprimento acumulado em t = k/16, k = 0..16. tab[16] é o comprimento total.
 * Cada trecho soma 4 cordas, o que dá erro abaixo de 0,1% nas curvas das vias.
 */
export function tabelaArco(p, out = new Float32Array(PASSOS_ARCO + 1), o = 0) {
  let s = 0;
  let px = p[o];
  let pz = p[o + 1];
  const q = [0, 0];
  out[0] = 0;
  const n = PASSOS_ARCO * SUB;
  for (let i = 1; i <= n; i++) {
    ponto(p, i / n, q, o);
    s += hipot(q[0] - px, q[1] - pz);
    px = q[0];
    pz = q[1];
    if (i % SUB === 0) out[i / SUB] = s;
  }
  return out;
}

/** Comprimento da curva. */
export const comprimento = (p, o = 0) => tabelaArco(p, undefined, o)[PASSOS_ARCO];

/** Parâmetro t no comprimento de arco s (interpolação linear na tabela). */
export function tDoArco(tab, s) {
  const n = tab.length - 1;
  const total = tab[n];
  if (s <= 0 || total <= 0) return 0;
  if (s >= total) return 1;
  let lo = 0;
  let hi = n;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (tab[m] <= s) lo = m;
    else hi = m;
  }
  const f = (s - tab[lo]) / (tab[hi] - tab[lo] || 1);
  return (lo + f) / n;
}

/** Comprimento de arco no parâmetro t. */
export function arcoDoT(tab, t) {
  const n = tab.length - 1;
  if (t <= 0) return 0;
  if (t >= 1) return tab[n];
  const k = Math.min(n - 1, Math.floor(t * n));
  const f = t * n - k;
  return tab[k] + (tab[k + 1] - tab[k]) * f;
}

/**
 * Ponto da curva mais perto de (x, z): { t, d, x, z }. 32 amostras e refino por bisseção do parâmetro.
 */
export function maisPerto(p, x, z, o = 0, out = { t: 0, d: 0, x: 0, z: 0 }) {
  const q = [0, 0];
  const N = 32;
  let melhorT = 0;
  let melhorD = Infinity;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    ponto(p, t, q, o);
    const d = (q[0] - x) * (q[0] - x) + (q[1] - z) * (q[1] - z);
    if (d < melhorD) {
      melhorD = d;
      melhorT = t;
    }
  }
  let passo = 1 / N;
  for (let k = 0; k < 14; k++) {
    passo /= 2;
    for (const t of [melhorT - passo, melhorT + passo]) {
      if (t < 0 || t > 1) continue;
      ponto(p, t, q, o);
      const d = (q[0] - x) * (q[0] - x) + (q[1] - z) * (q[1] - z);
      if (d < melhorD) {
        melhorD = d;
        melhorT = t;
      }
    }
  }
  ponto(p, melhorT, q, o);
  out.t = melhorT;
  out.d = Math.sqrt(melhorD);
  out.x = q[0];
  out.z = q[1];
  return out;
}

/** Divide a curva em t (de Casteljau): a = [0, t], b = [t, 1]. */
export function dividir(p, t, a = new Float64Array(8), b = new Float64Array(8), o = 0) {
  for (let k = 0; k < 2; k++) {
    const p0 = p[o + k];
    const p1 = p[o + 2 + k];
    const p2 = p[o + 4 + k];
    const p3 = p[o + 6 + k];
    const p01 = p0 + (p1 - p0) * t;
    const p12 = p1 + (p2 - p1) * t;
    const p23 = p2 + (p3 - p2) * t;
    const p012 = p01 + (p12 - p01) * t;
    const p123 = p12 + (p23 - p12) * t;
    const m = p012 + (p123 - p012) * t;
    a[k] = p0;
    a[2 + k] = p01;
    a[4 + k] = p012;
    a[6 + k] = m;
    b[k] = m;
    b[2 + k] = p123;
    b[4 + k] = p23;
    b[6 + k] = p3;
  }
  return [a, b];
}

/** Caixa [xmin, zmin, xmax, zmax] do polígono de controle (contém a curva). */
export function caixa(p, o = 0, folga = 0) {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let k = 0; k < 4; k++) {
    const x = p[o + 2 * k];
    const z = p[o + 2 * k + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return [x0 - folga, z0 - folga, x1 + folga, z1 + folga];
}

/**
 * Parâmetros (t em p, u em q) onde duas curvas se cruzam, por subdivisão; tolerância em metros.
 * @example cruzamentos(reta(-10, 0, 10, 0), reta(0, -10, 0, 10)) // [[0.5, 0.5]]
 */
export function cruzamentos(p, q, tol = 0.02, oP = 0, oQ = 0) {
  const res = [];
  const pilha = [[Float64Array.from(p.slice(oP, oP + 8)), 0, 1, Float64Array.from(q.slice(oQ, oQ + 8)), 0, 1, 0]];
  while (pilha.length) {
    const [a, a0, a1, b, b0, b1, prof] = pilha.pop();
    const ca = caixa(a);
    const cb = caixa(b);
    if (ca[0] > cb[2] || cb[0] > ca[2] || ca[1] > cb[3] || cb[1] > ca[3]) continue;
    const ta = Math.max(ca[2] - ca[0], ca[3] - ca[1]);
    const tb = Math.max(cb[2] - cb[0], cb[3] - cb[1]);
    if ((ta < tol && tb < tol) || prof > 40) {
      const t = (a0 + a1) / 2;
      const u = (b0 + b1) / 2;
      if (!res.some(([x, y]) => Math.abs(x - t) < 1e-3 && Math.abs(y - u) < 1e-3)) res.push([t, u]);
      continue;
    }
    if (ta >= tb) {
      const [x, y] = dividir(a, 0.5);
      const m = (a0 + a1) / 2;
      pilha.push([x, a0, m, b, b0, b1, prof + 1], [y, m, a1, b, b0, b1, prof + 1]);
    } else {
      const [x, y] = dividir(b, 0.5);
      const m = (b0 + b1) / 2;
      pilha.push([a, a0, a1, x, b0, m, prof + 1], [a, a0, a1, y, m, b1, prof + 1]);
    }
  }
  return res.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}

/** Ângulo (rad) da tangente em t, na convenção de rotação do three (atan2(dx, dz)). */
export function anguloEm(p, t, o = 0) {
  const d = tangente(p, t, [0, 0], o);
  return atan2(d[0], d[1]);
}

/** Pontos x, z amostrados a cada `passo` metros ao longo do arco (inclui as pontas). */
export function amostrar(p, passo, tab = tabelaArco(p)) {
  const total = tab[tab.length - 1];
  const n = Math.max(1, Math.ceil(total / passo));
  const out = new Float64Array(2 * (n + 1));
  const q = [0, 0];
  for (let i = 0; i <= n; i++) {
    ponto(p, tDoArco(tab, (total * i) / n), q);
    out[2 * i] = q[0];
    out[2 * i + 1] = q[1];
  }
  return out;
}
