// Hash FNV-1a de 32 bits (estado do jogo, save) e hashes inteiros para sementes. Bytes em little-endian.

export const FNV_BASE = 0x811c9dc5;
const FNV_PRIMO = 0x01000193;

/**
 * FNV-1a sobre bytes. Encadeável: passe o hash anterior em h.
 * @example fnv1a(new Uint8Array([97])) // 0xe40c292c ('a')
 */
export function fnv1a(bytes, h = FNV_BASE) {
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, FNV_PRIMO);
  }
  return h >>> 0;
}

/** FNV-1a sobre os bytes de qualquer array tipado (ou de uma parte dele: n elementos a partir de 0). */
export function fnv1aTipado(ta, h = FNV_BASE, n = ta.length) {
  const bytes = new Uint8Array(ta.buffer, ta.byteOffset, n * ta.BYTES_PER_ELEMENT);
  return fnv1a(bytes, h);
}

/** FNV-1a sobre o texto em UTF-8 (igual no Node e no navegador). */
export function fnv1aTexto(s, h = FNV_BASE) {
  const t = String(s);
  for (let i = 0; i < t.length; i++) {
    let c = t.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < t.length) {
      const d = t.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) {
      h = Math.imul(h ^ c, FNV_PRIMO);
    } else if (c < 0x800) {
      h = Math.imul(h ^ (0xc0 | (c >> 6)), FNV_PRIMO);
      h = Math.imul(h ^ (0x80 | (c & 63)), FNV_PRIMO);
    } else if (c < 0x10000) {
      h = Math.imul(h ^ (0xe0 | (c >> 12)), FNV_PRIMO);
      h = Math.imul(h ^ (0x80 | ((c >> 6) & 63)), FNV_PRIMO);
      h = Math.imul(h ^ (0x80 | (c & 63)), FNV_PRIMO);
    } else {
      h = Math.imul(h ^ (0xf0 | (c >> 18)), FNV_PRIMO);
      h = Math.imul(h ^ (0x80 | ((c >> 12) & 63)), FNV_PRIMO);
      h = Math.imul(h ^ (0x80 | ((c >> 6) & 63)), FNV_PRIMO);
      h = Math.imul(h ^ (0x80 | (c & 63)), FNV_PRIMO);
    }
  }
  return h >>> 0;
}

/** Soma um inteiro de 32 bits (4 bytes, little-endian) ao hash. */
export function fnv1aU32(v, h = FNV_BASE) {
  h = Math.imul(h ^ (v & 255), FNV_PRIMO);
  h = Math.imul(h ^ ((v >>> 8) & 255), FNV_PRIMO);
  h = Math.imul(h ^ ((v >>> 16) & 255), FNV_PRIMO);
  h = Math.imul(h ^ (v >>> 24), FNV_PRIMO);
  return h >>> 0;
}

/** Finalizador do murmur3: espalha os bits de um inteiro de 32 bits. */
export function hash32(x) {
  x |= 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Hash de uma coordenada inteira com semente (ruído, variação por célula). */
export function hashCoord(i, j, s = 0) {
  return hash32(Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ hash32(s));
}

/** Mesmo hash em [0, 1). */
export const hashCoordF = (i, j, s = 0) => hashCoord(i, j, s) / 4294967296;

/** Hash em 8 dígitos hexadecimais. */
export const hexHash = (h) => (h >>> 0).toString(16).padStart(8, '0');
