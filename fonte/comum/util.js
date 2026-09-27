// Ajudantes genéricos sem estado: números, ângulos, JSON canônico e cópias. Sem relógio e sem sorteio.

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inverterLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));

/** Transição suave de 0 a 1 entre a e b (igual ao smoothstep do GLSL). */
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Número finito ou o padrão. */
export const num = (v, padrao = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);

/** Inteiro finito ou o padrão (não arredonda: fração conta como inválido). */
export const inteiro = (v, padrao = 0) => (Number.isInteger(v) ? v : padrao);

/** Arredonda com casas decimais fixas. */
export function arredondar(v, casas = 0) {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

/** Ângulo em (-PI, PI]. */
export function normalizarAngulo(a) {
  a %= TAU;
  if (a <= -Math.PI) a += TAU;
  else if (a > Math.PI) a -= TAU;
  return a;
}

/** Diferença absoluta entre dois ângulos, em [0, PI]. */
export const difAngulo = (a, b) => Math.abs(normalizarAngulo(a - b));

/** Primeiro índice i em [0, n) com arr[i] >= v (arr crescente). */
export function buscaBinaria(arr, v, n = arr.length) {
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (arr[m] < v) lo = m + 1;
    else hi = m;
  }
  return lo;
}

const ehTipado = (v) => ArrayBuffer.isView(v) && !(v instanceof DataView);
export { ehTipado };

/**
 * JSON com as chaves em ordem alfabética em todos os níveis: a mesma entrada dá sempre o mesmo texto, qualquer que
 * tenha sido a ordem de inserção. Recusa NaN, Infinity e arrays tipados (esses vão como seção binária).
 * @example jsonCanonico({ b: 1, a: [2, { d: 0, c: 1 }] }) // '{"a":[2,{"c":1,"d":0}],"b":1}'
 */
export function jsonCanonico(v) {
  if (v === null) return 'null';
  switch (typeof v) {
    case 'number':
      if (!Number.isFinite(v)) throw new Error(`jsonCanonico: número inválido (${v})`);
      return JSON.stringify(v);
    case 'string':
    case 'boolean':
      return JSON.stringify(v);
    case 'undefined':
    case 'function':
      return 'null';
    case 'object': {
      if (ehTipado(v)) throw new Error('jsonCanonico: array tipado (use uma seção binária)');
      if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : jsonCanonico(x))).join(',')}]`;
      const chaves = Object.keys(v).filter((k) => v[k] !== undefined && typeof v[k] !== 'function').sort();
      return `{${chaves.map((k) => `${JSON.stringify(k)}:${jsonCanonico(v[k])}`).join(',')}}`;
    }
    default:
      throw new Error(`jsonCanonico: tipo ${typeof v}`);
  }
}

/**
 * Cópia de dados puros para JSON: arrays tipados viram arrays comuns, funções e undefined somem.
 * É a forma dos argumentos de comando no livro (D17).
 */
export function copiaJson(v) {
  // NaN e Infinity viram null como no JSON: o livro na memória e o livro do save reproduzem igual
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
  if (ehTipado(v)) return Array.from(v);
  if (Array.isArray(v)) return v.map((x) => (x === undefined || typeof x === 'function' ? null : copiaJson(x)));
  const out = {};
  for (const k of Object.keys(v)) {
    const x = v[k];
    if (x === undefined || typeof x === 'function') continue;
    out[k] = copiaJson(x);
  }
  return out;
}

/** Cópia profunda que preserva arrays tipados (cópia nova do buffer). */
export function copiaProfunda(v) {
  if (v === null || typeof v !== 'object') return v;
  if (ehTipado(v)) return v.slice();
  if (Array.isArray(v)) return v.map(copiaProfunda);
  const out = {};
  for (const k of Object.keys(v)) out[k] = copiaProfunda(v[k]);
  return out;
}

/** Junta os buffers dos arrays tipados de uma estrutura (lista de transferência do postMessage). */
export function buffersDe(v, lista = []) {
  if (v === null || typeof v !== 'object') return lista;
  if (ehTipado(v)) {
    if (!lista.includes(v.buffer)) lista.push(v.buffer);
    return lista;
  }
  for (const k of Object.keys(v)) buffersDe(v[k], lista);
  return lista;
}

/** Congela um objeto e tudo o que ele contém (menos arrays tipados, que o JS não congela). */
export function congelar(o) {
  if (o === null || typeof o !== 'object' || Object.isFrozen(o) || ehTipado(o)) return o;
  for (const k of Object.keys(o)) congelar(o[k]);
  return Object.freeze(o);
}

/** Troca o conteúdo de um objeto no lugar, mantendo a identidade (usado ao carregar um save). */
export function trocarConteudo(alvo, dados) {
  for (const k of Object.keys(alvo)) delete alvo[k];
  if (dados && typeof dados === 'object') Object.assign(alvo, dados);
  return alvo;
}

/** Mantém no máximo n itens do fim de uma lista (no lugar). */
export function cortarInicio(lista, n) {
  if (lista.length > n) lista.splice(0, lista.length - n);
  return lista;
}

// ------------------------------------------------------------------------------------------------------------------
// Matemática determinística. Math.sin, cos, atan2, exp, log, pow e hypot podem dar resultados diferentes entre
// versões do V8 (o Chromium de teste e o Node já divergem no cosseno). Na simulação e em tudo que vira estado use
// estas, que só usam + - * / e sqrt (corretamente arredondados pelo IEEE 754): o mesmo bit em qualquer motor.
// Algoritmos do fdlibm (Sun Microsystems), com o cosseno simplificado. Erro de 1 a 2 ulp.

const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer); // little-endian: [baixo, alto]
const altoDe = (x) => {
  F64[0] = x;
  return U32[1] | 0;
};
function comAlto(x, alto) {
  F64[0] = x;
  U32[1] = alto >>> 0;
  return F64[0];
}
/** 2^k exato (k inteiro). */
function doisA(k) {
  if (k > 1023) return doisA(1023) * doisA(k - 1023);
  if (k < -1022) return doisA(-1022) * doisA(Math.max(k + 1022, -1074 + 1022));
  F64[0] = 0;
  U32[1] = (k + 1023) << 20;
  return F64[0];
}

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.08757232129817482790e-9;
const C6 = -1.13596475577881948265e-11;

function kSen(x, y) {
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return x - ((z * (0.5 * y - v * r) - y) - v * S1);
}

function kCos(x, y) {
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  return 1 - (0.5 * z - (z * r - x * y));
}

const INV_PIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417;
const PIO2_2 = 6.07710050630396597660e-11;
const PIO2_2T = 2.02226624879595063154e-21;
const RED = [0, 0];

// redução de x por pi/2 (Cody-Waite em duas etapas): devolve n e deixa o resto em RED = [y0, y1]. Exata até |x| perto
// de 1,6 milhão (n * PIO2_1 sem arredondamento); acima disso perde dígitos, mas continua com os mesmos bits em todo motor
// (os ângulos do jogo ficam muito abaixo)
function reduzir(x) {
  const n = Math.round(x * INV_PIO2);
  const t = x - n * PIO2_1;
  let w = n * PIO2_2;
  const r = t - w;
  w = n * PIO2_2T - (t - r - w);
  const y0 = r - w;
  RED[0] = y0;
  RED[1] = r - y0 - w;
  return n;
}

/** Seno determinístico. */
export function sen(x) {
  if (!Number.isFinite(x)) return NaN;
  if (Math.abs(x) <= 0.7853981633974483) return x === 0 ? x : kSen(x, 0);
  const n = reduzir(x) & 3;
  const [a, b] = RED;
  return n === 0 ? kSen(a, b) : n === 1 ? kCos(a, b) : n === 2 ? -kSen(a, b) : -kCos(a, b);
}

/** Cosseno determinístico. */
export function cos(x) {
  if (!Number.isFinite(x)) return NaN;
  if (Math.abs(x) <= 0.7853981633974483) return kCos(x, 0);
  const n = reduzir(x) & 3;
  const [a, b] = RED;
  return n === 0 ? kCos(a, b) : n === 1 ? -kSen(a, b) : n === 2 ? -kCos(a, b) : kSen(a, b);
}

const ATAN_HI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.57079632679489655800];
const ATAN_LO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.11111104054623557880e-1,
  9.09088713343650656196e-2, -7.69187620504482999495e-2, 6.66107313738753120669e-2, -5.83357013379057348645e-2,
  4.97687799461593236017e-2, -3.65315727442169155270e-2, 1.62858201153657823623e-2,
];

/** Arco tangente determinístico. */
export function atan(x) {
  if (Number.isNaN(x)) return NaN;
  const neg = x < 0;
  let a = Math.abs(x);
  if (a >= 7.378697629483821e19) return neg ? -(ATAN_HI[3] + ATAN_LO[3]) : ATAN_HI[3] + ATAN_LO[3];
  let id;
  if (a < 0.4375) {
    if (a < 1.862645149230957e-9) return x;
    id = -1;
    a = x;
  } else if (a < 1.1875) {
    if (a < 0.6875) {
      id = 0;
      a = (2 * a - 1) / (2 + a);
    } else {
      id = 1;
      a = (a - 1) / (a + 1);
    }
  } else if (a < 2.4375) {
    id = 2;
    a = (a - 1.5) / (1 + 1.5 * a);
  } else {
    id = 3;
    a = -1 / a;
  }
  const z = a * a;
  const w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return a - a * (s1 + s2);
  const r = ATAN_HI[id] - ((a * (s1 + s2) - ATAN_LO[id]) - a);
  return neg ? -r : r;
}

const PI = 3.1415926535897931160;
const PI_LO = 1.2246467991473531772e-16;
const PI_2 = 1.5707963267948965580;

/** atan2(y, x) determinístico (mesma convenção do Math.atan2). */
export function atan2(y, x) {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (x === 1) return atan(y);
  const ny = y < 0 || Object.is(y, -0);
  const nx = x < 0 || Object.is(x, -0);
  const m = (ny ? 1 : 0) | (nx ? 2 : 0);
  if (y === 0) return m <= 1 ? y : m === 2 ? PI : -PI;
  if (x === 0) return ny ? -PI_2 : PI_2;
  if (!Number.isFinite(x)) {
    if (!Number.isFinite(y)) return [PI / 4, -PI / 4, (3 * PI) / 4, (-3 * PI) / 4][m];
    return [0, -0, PI, -PI][m];
  }
  if (!Number.isFinite(y)) return ny ? -PI_2 : PI_2;
  const q = Math.abs(y / x);
  let z;
  if (q > 1.152921504606847e18) z = PI_2 + 0.5 * PI_LO;
  else if (nx && q < 8.673617379884035e-19) z = 0;
  else z = atan(q);
  switch (m) {
    case 0:
      return z;
    case 1:
      return -z;
    case 2:
      return PI - (z - PI_LO);
    default:
      return z - PI_LO - PI;
  }
}

/** Hipotenusa determinística (sem o cuidado de estouro do Math.hypot: as medidas do jogo são pequenas). */
export const hipot = (x, y) => Math.sqrt(x * x + y * y);

const LN2_HI = 6.93147180369123816490e-1;
const LN2_LO = 1.90821492927058770002e-10;
const INV_LN2 = 1.44269504088896338700;
const P1 = 1.66666666666666019037e-1;
const P2 = -2.77777777770155933842e-3;
const P3 = 6.61375632143793436117e-5;
const P4 = -1.65339022054652515390e-6;
const P5 = 4.13813679705723846039e-8;

/** Exponencial determinística. */
export function exp(x) {
  if (Number.isNaN(x)) return NaN;
  if (x > 7.09782712893383973096e2) return Infinity;
  if (x < -7.45133219101941108420e2) return 0;
  const a = Math.abs(x);
  let k = 0;
  let hi = 0;
  let lo = 0;
  if (a > 0.34657359027997264) {
    if (a < 1.0397207708399179) {
      hi = x < 0 ? x + LN2_HI : x - LN2_HI;
      lo = x < 0 ? -LN2_LO : LN2_LO;
      k = x < 0 ? -1 : 1;
    } else {
      k = Math.trunc(INV_LN2 * x + (x < 0 ? -0.5 : 0.5));
      hi = x - k * LN2_HI;
      lo = k * LN2_LO;
    }
    x = hi - lo;
  } else if (a < 3.725290298461914e-9) {
    return 1 + x;
  }
  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2) - x);
  const y = 1 - (lo - (x * c) / (2 - c) - hi);
  // perto do teto (x > 709,43) k chega a 1024 e 2^k sozinho estoura: multiplica em duas vezes, as duas exatas
  return k > 1023 ? y * 2 * doisA(k - 1) : y * doisA(k);
}

const LG1 = 6.666666666666735130e-1;
const LG2 = 3.999999999940941908e-1;
const LG3 = 2.857142874366239149e-1;
const LG4 = 2.222219843214978396e-1;
const LG5 = 1.818357216161805012e-1;
const LG6 = 1.531383769920937332e-1;
const LG7 = 1.479819860511658591e-1;

/** Logaritmo natural determinístico. */
export function log(x) {
  if (Number.isNaN(x) || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return x;
  let hx = altoDe(x);
  let k = 0;
  if (hx < 0x00100000) {
    k -= 54;
    x *= 1.8014398509481984e16;
    hx = altoDe(x);
  }
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  const i0 = (hx + 0x95f64) & 0x100000;
  x = comAlto(x, hx | (i0 ^ 0x3ff00000));
  k += i0 >> 20;
  const f = x - 1;
  const dk = k;
  if ((0x000fffff & (2 + hx)) < 3) {
    if (f === 0) return k === 0 ? 0 : dk * LN2_HI + dk * LN2_LO;
    const R = f * f * (0.5 - 0.33333333333333333 * f);
    return k === 0 ? f - R : dk * LN2_HI - ((R - dk * LN2_LO) - f);
  }
  const s = f / (2 + f);
  const z = s * s;
  let i = hx - 0x6147a;
  const w = z * z;
  const j = 0x6b851 - hx;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  i |= j;
  const R = t2 + t1;
  if (i > 0) {
    const hfsq = 0.5 * f * f;
    return k === 0 ? f - (hfsq - s * (hfsq + R)) : dk * LN2_HI - ((hfsq - (s * (hfsq + R) + dk * LN2_LO)) - f);
  }
  return k === 0 ? f - s * (f - R) : dk * LN2_HI - ((s * (f - R) - dk * LN2_LO) - f);
}

/** Potência determinística: expoente inteiro por quadrados; o resto por exp(y log x). */
export function pot(x, y) {
  if (Number.isInteger(y) && Math.abs(y) <= 1024) {
    let r = 1;
    let b = x;
    let e = Math.abs(y);
    while (e > 0) {
      if (e & 1) r *= b;
      b *= b;
      e = Math.floor(e / 2);
    }
    return y < 0 ? 1 / r : r;
  }
  if (x === 0) return y > 0 ? 0 : Infinity;
  if (x < 0) return NaN;
  return exp(y * log(x));
}
