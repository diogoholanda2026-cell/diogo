// Leitura única da altura do chão (D4): bilinear sobre a grade de alturas. A simulação, R.raio, a varredura das vias
// e o GLSL do terreno usam esta mesma conta (R2a confere a paridade em pontos sorteados).
//
// Grade: { n, passo, origem: [ox, oz], altura: Float32Array(n * n) }. A amostra altura[j * n + i] fica em
// x = ox + i * passo, z = oz + j * passo (linha j cresce para o sul). Fora da grade vale a borda.

/**
 * Bilinear genérica sobre uma grade quadrada n x n.
 * @example amostrar(new Float32Array([0, 1, 2, 3]), 2, 1, 0, 0, 0.5, 0.5) // 1.5
 */
export function amostrar(dados, n, passo, ox, oz, x, z) {
  let fx = (x - ox) / passo;
  let fz = (z - oz) / passo;
  const lim = n - 1;
  fx = fx < 0 ? 0 : fx > lim ? lim : fx;
  fz = fz < 0 ? 0 : fz > lim ? lim : fz;
  let i = Math.floor(fx);
  let j = Math.floor(fz);
  if (i > n - 2) i = n - 2;
  if (j > n - 2) j = n - 2;
  const tx = fx - i;
  const tz = fz - j;
  const k = j * n + i;
  const h00 = dados[k];
  const h10 = dados[k + 1];
  const h01 = dados[k + n];
  const h11 = dados[k + n + 1];
  return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
}

/**
 * Altura do chão em (x, z), em metros.
 * @param {{ n: number, passo: number, origem: number[], altura: Float32Array }} t espelho.terreno
 */
export function alturaEm(t, x, z) {
  return amostrar(t.altura, t.n, t.passo, t.origem[0], t.origem[1], x, z);
}

/** Declive (fração, 0,12 = 12%) em (x, z) pela diferença central de alturaEm com meio passo. */
export function decliveEm(t, x, z) {
  const h = t.passo / 2;
  const dx = (alturaEm(t, x + h, z) - alturaEm(t, x - h, z)) / (2 * h);
  const dz = (alturaEm(t, x, z + h) - alturaEm(t, x, z - h)) / (2 * h);
  return Math.sqrt(dx * dx + dz * dz);
}

/** Índices (i, j) da amostra de uma grade mais perto de (x, z), presos à grade. */
export function indiceMaisPerto(n, passo, ox, oz, x, z) {
  const i = Math.min(n - 1, Math.max(0, Math.round((x - ox) / passo)));
  const j = Math.min(n - 1, Math.max(0, Math.round((z - oz) / passo)));
  return [i, j];
}

/** Valor da célula (sem interpolar) de uma grade de células n x n que cobre [ox, ox + n * passo). */
export function celulaEm(dados, n, passo, ox, oz, x, z) {
  const i = Math.floor((x - ox) / passo);
  const j = Math.floor((z - oz) / passo);
  if (i < 0 || j < 0 || i >= n || j >= n) return 0;
  return dados[j * n + i];
}

/** Retângulo de amostras [i0, j0, i1, j1] (inclusive) de uma grade que cobre o retângulo do mundo [x0, z0, x1, z1]. */
export function amostrasNoRetangulo(n, passo, ox, oz, x0, z0, x1, z1) {
  const i0 = Math.max(0, Math.floor((x0 - ox) / passo));
  const j0 = Math.max(0, Math.floor((z0 - oz) / passo));
  const i1 = Math.min(n - 1, Math.ceil((x1 - ox) / passo));
  const j1 = Math.min(n - 1, Math.ceil((z1 - oz) / passo));
  return [i0, j0, i1, j1];
}
