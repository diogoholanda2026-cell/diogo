// Atributos quantizados do LOD0 (D39), puro: posição em Int16 normalizado relativa à caixa do setor (escala uniforme,
// para a matriz normal do three continuar certa), normal octaédrica em 2 x Int8, posição na fachada em Half, idx em
// Uint32 e AO em Uint8. Um setor de 256 m com prédios de até 250 m fica com passo de ~4 mm (erro abaixo de 5 mm).
// O resultado vai para a thread principal por transferência e a cópia JS é solta depois do envio à GPU (onUpload).

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

/** Float para meia precisão (IEEE 754 binary16), com arredondamento ao mais próximo e saturação em 65504. */
export function paraHalf(v) {
  f32[0] = v;
  const x = u32[0];
  const sinal = (x >>> 16) & 0x8000;
  let e = ((x >>> 23) & 0xff) - 112;
  let m = x & 0x7fffff;
  if (e >= 31) return (x & 0x7fffffff) > 0x7f800000 ? sinal | 0x7e00 : sinal | 0x7bff;
  if (e <= 0) {
    if (e < -10) return sinal;
    m = (m | 0x800000) >> (1 - e);
    return sinal | ((m + 0x1000) >> 13);
  }
  const h = sinal | (e << 10) | (m >> 13);
  return h + ((m >> 12) & 1);
}

/** Meia precisão para float. */
export function deHalf(h) {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

/**
 * Quantiza a malha de um Construtor (malhaPredio.js). Devolve a malha do contrato da oficina:
 * { material, atributos: { posicao Int16 x 3, normal Int8 x 2, facUV Uint16 (half) x 4, fac, corA, corB Uint8 x 4,
 *   id Uint32, ao Uint8 }, indices, escala: Float32Array [cx, cy, cz, s], nv, tris }.
 * A posição de volta é centro + (q / 32767) * s em cada eixo.
 */
export function quantizarMalha(K, material = 'edificio') {
  const nv = K.nv;
  const p = K.pos;
  let x0 = Infinity;
  let y0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < nv; i++) {
    const x = p[3 * i];
    const y = p[3 * i + 1];
    const z = p[3 * i + 2];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  if (!nv) x0 = y0 = z0 = x1 = y1 = z1 = 0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const cz = (z0 + z1) / 2;
  const s = Math.max(1e-3, (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2);
  const k = 32767 / s;
  const posicao = new Int16Array(nv * 3);
  const normal = new Int8Array(nv * 2);
  const facUV = new Uint16Array(nv * 4);
  const fac = new Uint8Array(nv * 4);
  const corA = new Uint8Array(nv * 4);
  const corB = new Uint8Array(nv * 4);
  const ao = new Uint8Array(nv);
  const id = K.id.slice(0, nv);
  const n = K.nor;
  const o = [0, 0];
  for (let i = 0; i < nv; i++) {
    posicao[3 * i] = Math.round((p[3 * i] - cx) * k);
    posicao[3 * i + 1] = Math.round((p[3 * i + 1] - cy) * k);
    posicao[3 * i + 2] = Math.round((p[3 * i + 2] - cz) * k);
    octaedro(n[3 * i], n[3 * i + 1], n[3 * i + 2], o);
    normal[2 * i] = o[0];
    normal[2 * i + 1] = o[1];
    for (let c = 0; c < 4; c++) facUV[4 * i + c] = paraHalf(K.fuv[4 * i + c]);
    const b = 12 * i;
    for (let c = 0; c < 4; c++) {
      fac[4 * i + c] = K.mat[b + c];
      corA[4 * i + c] = K.mat[b + 4 + c];
      corB[4 * i + c] = K.mat[b + 8 + c];
    }
    ao[i] = Math.max(0, Math.min(255, Math.round(K.ao[i] * 255)));
  }
  const ni = K.ni;
  const indices = nv < 65536 ? Uint16Array.from(K.idx.subarray(0, ni)) : K.idx.slice(0, ni);
  return {
    material,
    atributos: { posicao, normal, facUV, fac, corA, corB, id, ao },
    indices,
    escala: Float32Array.of(cx, cy, cz, s),
    nv,
    tris: ni / 3,
  };
}

// a mesma conta de malhaPredio.octaedro, aqui para não importar o módulo inteiro de volta
function octaedro(x, y, z, out) {
  const s = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
  let px = x / s;
  let py = z / s;
  if (y < 0) {
    const qx = (1 - Math.abs(py)) * (px >= 0 ? 1 : -1);
    const qy = (1 - Math.abs(px)) * (py >= 0 ? 1 : -1);
    px = qx;
    py = qy;
  }
  out[0] = Math.round(Math.max(-1, Math.min(1, px)) * 127);
  out[1] = Math.round(Math.max(-1, Math.min(1, py)) * 127);
}

/** Bytes de uma malha quantizada (atributos e índices). */
export function bytesDaMalha(m) {
  let b = m.indices.byteLength;
  for (const a of Object.values(m.atributos)) b += a.byteLength;
  return b;
}

/** A quantização roda dentro do gerador de setor (fundir.js): este módulo não registra tipo na oficina. */
export function registrar() {}
