// Texturas das vias (D45): o detalhe do asfalto, da calçada e da terra, feito uma vez na carga (puro, periódico: o
// mosaico fecha nas bordas). Canais: R agregado fino (grão do asfalto e do concreto), G manchas médias (óleo, umidade,
// tinta gasta), B fissuras (ruído em crista: perto de 1 na trinca), A pedras (Voronoi: 0 no rejunte, 1 no meio da
// pedra; a pedra portuguesa e o cascalho). O shader (via.glsl.js) lê em metros do mundo em várias escalas, então o
// detalhe não estica com o tamanho da via. Sem CC0 de asfalto aprovado no portão 1: procedural (D46).

const LADO = 256;

function hashP(i, j, p, s) {
  const x = ((i % p) + p) % p;
  const y = ((j % p) + p) % p;
  let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(s + 1, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Ruído de valor periódico com período p células, em (u, v) de 0 a 1. */
function valor(u, v, p, s) {
  const x = u * p;
  const y = v * p;
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const a = fx * fx * (3 - 2 * fx);
  const b = fy * fy * (3 - 2 * fy);
  const h00 = hashP(i, j, p, s);
  const h10 = hashP(i + 1, j, p, s);
  const h01 = hashP(i, j + 1, p, s);
  const h11 = hashP(i + 1, j + 1, p, s);
  return h00 + (h10 - h00) * a + (h01 - h00) * b + (h00 - h10 - h01 + h11) * a * b;
}

function fbm(u, v, p0, oitavas, s) {
  let t = 0;
  let amp = 0.5;
  let soma = 0;
  let p = p0;
  for (let k = 0; k < oitavas; k++) {
    t += amp * valor(u, v, p, s + k * 13);
    soma += amp;
    amp *= 0.5;
    p *= 2;
  }
  return t / soma;
}

/** Voronoi periódico (p células): 0 na borda entre duas células, 1 no meio (distância à borda normalizada). */
function voronoi(u, v, p, s) {
  const x = u * p;
  const y = v * p;
  const i = Math.floor(x);
  const j = Math.floor(y);
  let d1 = 9;
  let d2 = 9;
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const ci = i + di;
      const cj = j + dj;
      const px = ci + 0.15 + 0.7 * hashP(ci, cj, p, s);
      const py = cj + 0.15 + 0.7 * hashP(ci, cj, p, s + 7);
      const d = Math.hypot(x - px, y - py);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) d2 = d;
    }
  }
  return Math.min(1, (d2 - d1) * 1.6);
}

/** Os bytes RGBA do detalhe das vias (puro, testável no Node). */
export function bytesDetalheVia(lado = LADO) {
  const d = new Uint8Array(lado * lado * 4);
  for (let j = 0; j < lado; j++) {
    for (let i = 0; i < lado; i++) {
      const u = i / lado;
      const v = j / lado;
      const k = 4 * (j * lado + i);
      const grao = fbm(u, v, 64, 2, 1) * 0.7 + valor(u, v, 128, 2) * 0.3;
      const manchas = fbm(u, v, 4, 4, 3);
      // fissuras: crista do ruído (1 - |2n - 1|) afinada, em duas escalas cruzadas
      const n1 = fbm(u, v, 6, 3, 5);
      const n2 = fbm(u + 0.37, v, 11, 2, 6);
      const crista = Math.max(1 - Math.abs(2 * n1 - 1), 0.85 * (1 - Math.abs(2 * n2 - 1))) ** 6;
      const pedra = voronoi(u, v, 26, 9);
      d[k] = Math.round(grao * 255);
      d[k + 1] = Math.round(manchas * 255);
      d[k + 2] = Math.round(Math.min(1, crista) * 255);
      d[k + 3] = Math.round(pedra * 255);
    }
  }
  return d;
}

/** Registra 'via.detalhe' (DataTexture RGBA8 periódica com mipmaps). */
export function registrar(api) {
  api.registrarTextura('via.detalhe', ({ THREE, perfil }) => {
    const lado = perfil?.id === 'leve' ? 128 : LADO;
    const t = new THREE.DataTexture(bytesDetalheVia(lado), lado, lado, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = ['ultra', 'alta'].includes(perfil?.base ?? perfil?.id) ? 8 : 4; // o 'pc' herda do Alta
    t.colorSpace = THREE.NoColorSpace;
    t.name = 'via.detalhe';
    t.needsUpdate = true;
    return t;
  });
}
