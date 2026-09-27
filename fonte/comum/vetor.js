// Geometria plana no chão (x para leste, z para o sul; y para cima fica de fora). Convenções da seção 2.4.
import { atan2, cos, sen } from './util.js';

export const dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
export const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));
export const comprimento = (x, z) => Math.sqrt(x * x + z * z);
export const pontoEscalar = (ax, az, bx, bz) => ax * bx + az * bz;
/** Componente y do produto vetorial de (ax, 0, az) por (bx, 0, bz) com o sinal do plano: ax * bz - az * bx. */
export const cruz = (ax, az, bx, bz) => ax * bz - az * bx;

/** Vetor unitário (ou [0, 0]). */
export function normalizar(x, z, out = [0, 0]) {
  const c = Math.sqrt(x * x + z * z);
  if (c > 0) {
    out[0] = x / c;
    out[1] = z / c;
  } else {
    out[0] = 0;
    out[1] = 0;
  }
  return out;
}

/**
 * Lado direito de uma direção (dx, dz) olhando de cima: (-dz, dx). É o lado = +1 das células (2.4).
 * @example direita(1, 0) // [0, 1]: indo para leste, a direita é o sul
 */
export const direita = (dx, dz, out = [0, 0]) => {
  out[0] = -dz;
  out[1] = dx;
  return out;
};

/**
 * Direção da frente para uma rotação em torno de +y na convenção do three (Object3D.rotation.y).
 * Com rot = 0 a frente olha para +z.
 * @example frenteDaRotacao(Math.PI / 2) // [1, 0]
 */
export const frenteDaRotacao = (rot, out = [0, 0]) => {
  out[0] = sen(rot);
  out[1] = cos(rot);
  return out;
};

/** Rotação (convenção do three) cuja frente aponta para (fx, fz). */
export const rotacaoDaFrente = (fx, fz) => atan2(fx, fz);

/** Gira um ponto local (x, z) pela rotação do three: devolve as coordenadas no mundo relativas ao centro. */
export function girar(x, z, rot, out = [0, 0]) {
  const c = cos(rot);
  const s = sen(rot);
  out[0] = c * x + s * z;
  out[1] = -s * x + c * z;
  return out;
}

/** Inverso de girar: coordenadas locais de um vetor do mundo. */
export function desgirar(x, z, rot, out = [0, 0]) {
  const c = cos(rot);
  const s = sen(rot);
  out[0] = c * x - s * z;
  out[1] = s * x + c * z;
  return out;
}

/**
 * Ponto dentro do retângulo de um prédio (centro, rot, w ao longo da frente, d de fundo), com folga em metros.
 * No local do prédio a frente olha para +z, a largura w corre em x e o fundo d em z.
 */
export function pontoNoRetangulo(px, pz, cx, cz, rot, w, d, folga = 0) {
  const c = cos(rot);
  const s = sen(rot);
  const dx = px - cx;
  const dz = pz - cz;
  const lx = c * dx - s * dz;
  const lz = s * dx + c * dz;
  return Math.abs(lx) <= w / 2 + folga && Math.abs(lz) <= d / 2 + folga;
}

/** Os 4 cantos (x, z) do retângulo de um prédio, em ordem anti-horária vista de cima. */
export function cantosRetangulo(cx, cz, rot, w, d) {
  const out = new Float64Array(8);
  const hw = w / 2;
  const hd = d / 2;
  const loc = [-hw, -hd, hw, -hd, hw, hd, -hw, hd];
  const c = cos(rot);
  const s = sen(rot);
  for (let k = 0; k < 4; k++) {
    const x = loc[2 * k];
    const z = loc[2 * k + 1];
    out[2 * k] = cx + c * x + s * z;
    out[2 * k + 1] = cz - s * x + c * z;
  }
  return out;
}

/** Distância de um ponto a um segmento e o parâmetro t do ponto mais perto. */
export function distSegmento(px, pz, ax, az, bx, bz, out = { d: 0, t: 0 }) {
  const vx = bx - ax;
  const vz = bz - az;
  const l2 = vx * vx + vz * vz;
  let t = l2 > 0 ? ((px - ax) * vx + (pz - az) * vz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + vx * t;
  const qz = az + vz * t;
  out.d = Math.sqrt((px - qx) * (px - qx) + (pz - qz) * (pz - qz));
  out.t = t;
  return out;
}

/** true se os segmentos AB e CD se cruzam (sem contar pontas que só encostam). */
export function segmentosCruzam(ax, az, bx, bz, cx, cz, dx, dz) {
  const d1 = cruz(bx - ax, bz - az, cx - ax, cz - az);
  const d2 = cruz(bx - ax, bz - az, dx - ax, dz - az);
  const d3 = cruz(dx - cx, dz - cz, ax - cx, az - cz);
  const d4 = cruz(dx - cx, dz - cz, bx - cx, bz - cz);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Área com sinal de um polígono dado como pares x, z. */
export function areaPoligono(pts) {
  let a = 0;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) a += pts[2 * j] * pts[2 * i + 1] - pts[2 * i] * pts[2 * j + 1];
  return a / 2;
}

/** Ponto dentro de um polígono (pares x, z), pela regra par e ímpar. */
export function pontoNoPoligono(px, pz, pts) {
  let dentro = false;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[2 * i];
    const zi = pts[2 * i + 1];
    const xj = pts[2 * j];
    const zj = pts[2 * j + 1];
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Distância de um ponto à borda de um polígono (pares x, z); 0 dentro dele. */
export function distPoligono(px, pz, pts) {
  if (pontoNoPoligono(px, pz, pts)) return 0;
  let m = Infinity;
  const n = pts.length / 2;
  const o = { d: 0, t: 0 };
  for (let i = 0, j = n - 1; i < n; j = i++) {
    distSegmento(px, pz, pts[2 * j], pts[2 * j + 1], pts[2 * i], pts[2 * i + 1], o);
    if (o.d < m) m = o.d;
  }
  return m;
}

/** Caixa [xmin, zmin, xmax, zmax] de uma lista de pares x, z (passo 2) ou triplas x, z, y (passo 3). */
export function caixaDePontos(pts, passo = 2) {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let i = 0; i + 1 < pts.length; i += passo) {
    const x = pts[i];
    const z = pts[i + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return [x0, z0, x1, z1];
}

/** true se duas caixas [x0, z0, x1, z1] se tocam. */
export const caixasTocam = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
