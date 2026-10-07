// Primitivas de arco da sede (D88 a D97): pontos e ângulos em volta de um centro, paredes e faixas curvas, testas e
// faixas entre polígonos. Em coordenadas do mundo (x leste, z sul; graus: 0 leste, 90 sul). As partes (partes.js), os
// lagos e as quedas (lagos.js) e as pontes (pontes.js) usam as mesmas.
const RAD = Math.PI / 180;

/** Ponto de um círculo em graus (0 leste, 90 sul). */
export const noArco = (cx, cz, r, g) => [cx + r * Math.cos(g * RAD), cz + r * Math.sin(g * RAD)];

/** Diferença entre dois ângulos em graus, em [-180, 180). */
export const difGraus = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;

/** Leva um polígono local (pares) ao mundo: gira por rot (convenção do three) e soma (x, z). */
export function aoMundo(poly, x, z, rot) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const out = [];
  for (let i = 0; i < poly.length; i += 2) out.push(x + c * poly[i] + s * poly[i + 1], z - s * poly[i] + c * poly[i + 1]);
  return out;
}

/** Elipse de semi-eixos a (x) e b (z) em seg pontos. */
export function elipse(a, b, seg = 32) {
  const P = [];
  for (let s = 0; s < seg; s++) {
    const t = (s / seg) * Math.PI * 2;
    P.push(Math.cos(t) * a, Math.sin(t) * b);
  }
  return P;
}

/** Faixa horizontal entre dois polígonos de mesmo número de pontos (anel), na cota y, virada para cima ou baixo. */
export function faixaEntre(m, A, B, y, k, cima = true, yB = y) {
  const n = A.length / 2;
  const ny = cima ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    m.quad([A[2 * i], y, A[2 * i + 1]], [A[2 * j], y, A[2 * j + 1]], [B[2 * j], yB, B[2 * j + 1]], [B[2 * i], yB, B[2 * i + 1]], [0, ny, 0], [A[2 * i], A[2 * i + 1]], [A[2 * j], A[2 * j + 1]], [B[2 * j], B[2 * j + 1]], [B[2 * i], B[2 * i + 1]], k);
  }
}

/**
 * Parede curva de raio r entre os ângulos a0 e a1 (graus), de y0 a y1 acima de yb: normal radial por vértice (a face lê
 * redonda, não facetada; sinal -1 vira para o centro), u em metros ao longo do arco, v a altura acima de yb.
 */
export function paredeArco(m, cx, cz, yb, r, a0, a1, y0, y1, k, sinal = 1) {
  const c0 = Math.cos(a0 * RAD), s0 = Math.sin(a0 * RAD);
  const c1 = Math.cos(a1 * RAD), s1 = Math.sin(a1 * RAD);
  const u0 = r * a0 * RAD;
  const u1 = r * a1 * RAD;
  const i0 = m.v(cx + r * c0, yb + y0, cz + r * s0, c0 * sinal, 0, s0 * sinal, u0, y0, k);
  const i1 = m.v(cx + r * c1, yb + y0, cz + r * s1, c1 * sinal, 0, s1 * sinal, u1, y0, k);
  const i2 = m.v(cx + r * c1, yb + y1, cz + r * s1, c1 * sinal, 0, s1 * sinal, u1, y1, k);
  const i3 = m.v(cx + r * c0, yb + y1, cz + r * s0, c0 * sinal, 0, s0 * sinal, u0, y1, k);
  m.tri(i0, i1, i2);
  m.tri(i0, i2, i3);
}

/**
 * Faixa horizontal entre os raios r0 e r1 de a0 a a1 (graus) na cota y, para cima ou para baixo. uv = (x, z), ou
 * (metros ao longo do arco em r0, distância a r0) com arco = true (a pista, a película de água).
 */
export function faixaArco(m, cx, cz, r0, r1, a0, a1, y, k, cima = true, arco = false) {
  const P = [[r0, a0], [r0, a1], [r1, a1], [r1, a0]].map(([r, a]) => noArco(cx, cz, r, a));
  const uv = arco
    ? [[r0 * a0 * RAD, 0], [r0 * a1 * RAD, 0], [r0 * a1 * RAD, r1 - r0], [r0 * a0 * RAD, r1 - r0]]
    : P.map(([x, z]) => [x, z]);
  m.quad(...P.map(([x, z]) => [x, y, z]), [0, cima ? 1 : -1, 0], ...uv, k);
}

/** Testa vertical (a borda de uma marquise ou da cobertura) no raio r, de a0 a a1, normal radial (sinal). */
export function testaArco(m, cx, cz, r, a0, a1, y0, y1, k, sinal = 1) {
  const [x0, z0] = noArco(cx, cz, r, a0);
  const [x1, z1] = noArco(cx, cz, r, a1);
  const am = ((a0 + a1) / 2) * RAD;
  m.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [Math.cos(am) * sinal, 0, Math.sin(am) * sinal], [r * a0 * RAD, y0], [r * a1 * RAD, y0], [r * a1 * RAD, y1], [r * a0 * RAD, y1], k);
}

