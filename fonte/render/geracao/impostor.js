// Vistas do atlas de impostores (desenho do render 7.2), puro (sem three): todas as espécies num atlas só, uma carta
// por árvore (2 triângulos), 1 chamada para todos. Cada espécie tem QUADROS vistas assadas na carga a partir do LOD0
// (mundo/vegetacao.js): 8 azimutes em dois anéis de elevação (15 e 50 graus) e a vista de cima, com o albedo e o
// alfa num atlas e a normal da copa noutro, para a carta receber a luz do sol e do céu. Aqui ficam a disposição do
// atlas, as direções de cada vista e a escolha da vista pela direção da câmera (a mesma conta do GLSL, testada).
//
// Convenção: a vista k olha para a árvore DE dir(k) (unitário, no espaço da árvore, +y para cima); azimute 0 em +x e
// crescendo para +z.

export const AZIMUTES = 8;
/** Elevação (graus) dos anéis de vistas; a última vista é a de cima (90). */
export const ANEIS = Object.freeze([15, 50]);
export const QUADROS = AZIMUTES * ANEIS.length + 1;
/** Elevação (graus) acima da qual entra a vista de cima, e onde a troca de anel acontece. */
export const TROCA_ANEL = 32;
export const TROCA_TOPO = 72;

const RAD = Math.PI / 180;

/** Direção (de onde a câmera olha) da vista k. */
export function direcaoDoQuadro(k) {
  if (k >= AZIMUTES * ANEIS.length) return [0, 1, 0];
  const anel = Math.floor(k / AZIMUTES);
  const az = ((k % AZIMUTES) / AZIMUTES) * 2 * Math.PI;
  const el = ANEIS[anel] * RAD;
  return [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
}

/**
 * Disposição do atlas: uma linha por espécie com as QUADROS vistas, células quadradas de `lado` px.
 * @returns {{ colunas: number, linhas: number, largura: number, altura: number, lado: number }}
 */
export function dispor(nEspecies, lado) {
  return { colunas: QUADROS, linhas: nEspecies, largura: QUADROS * lado, altura: nEspecies * lado, lado };
}

/** Retângulo da célula (espécie, vista) em uv (0 a 1): [u0, v0, u1, v1]. */
export function celulaDoQuadro(nEspecies, especie, k) {
  return [k / QUADROS, especie / nEspecies, (k + 1) / QUADROS, (especie + 1) / nEspecies];
}

/**
 * Vistas a misturar para uma direção de câmera no espaço da árvore (de onde a câmera olha, unitário): duas vistas
 * vizinhas no anel mais perto da elevação e o peso da segunda; acima de TROCA_TOPO, a de cima. A mesma conta do
 * GLSL (folha.glsl.js, impostorQuadros).
 * @returns {{ a: number, b: number, peso: number }}
 */
export function quadrosDaVista(d) {
  const el = Math.asin(Math.max(-1, Math.min(1, d[1]))) / RAD;
  if (el >= TROCA_TOPO) return { a: QUADROS - 1, b: QUADROS - 1, peso: 0 };
  const anel = el < TROCA_ANEL ? 0 : 1;
  let az = Math.atan2(d[2], d[0]) / (2 * Math.PI);
  if (az < 0) az += 1;
  // a folga de 1e-9 segura a vista exata (sem ela, 0,999... cairia na vista de trás com peso 1)
  const x = az * AZIMUTES + 1e-9;
  const i = Math.floor(x) % AZIMUTES;
  return { a: anel * AZIMUTES + i, b: anel * AZIMUTES + ((i + 1) % AZIMUTES), peso: Math.max(0, x - 1e-9 - Math.floor(x)) };
}

/**
 * Câmera ortográfica de uma vista para assar: a esfera do modelo (centro em y, raio) vista de dir(k), com o "para
 * cima" da carta (a projeção do +y, ou -z na vista de cima). O quadro cobre 2 raios.
 * @returns {{ posicao: number[], alvo: number[], cima: number[], meio: number }}
 */
export function cameraDoQuadro(k, centroY, raio) {
  const d = direcaoDoQuadro(k);
  const alvo = [0, centroY, 0];
  const dist = raio * 3;
  const cima = k === QUADROS - 1 ? [0, 0, -1] : [0, 1, 0];
  return { posicao: [d[0] * dist, centroY + d[1] * dist, d[2] * dist], alvo, cima, meio: raio, perto: raio * 0.5, longe: raio * 5.5 };
}

export function registrar() {}
