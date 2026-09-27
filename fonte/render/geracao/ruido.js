// Ruído e hash puros (sem three, sem DOM, sem relógio): servem ao mapa de ondas da água, às copas (a mesma regra da
// textura de ruído que a GPU faz para o chão), aos geradores do worker oficina e aos testes em Node. Tudo determinístico pela semente e, quando pedido,
// periódico (período inteiro em células da rede) para virar textura que emenda nas bordas.
//
// Convenções: coordenadas em unidades da rede (a célula tem lado 1); `s` é a semente (inteiro de 32 bits).

const U32 = 4294967296;

/**
 * Hash de dois inteiros e uma semente em 32 bits (mistura no estilo lowbias32, sem estado).
 * @example hash2(3, 7, 1) === hash2(3, 7, 1) // true
 */
export function hash2(i, j, s = 0) {
  let h = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Hash em [0, 1). */
export const hashF = (i, j, s = 0) => hash2(i, j, s) / U32;

const mod = (a, p) => ((a % p) + p) % p;
const suave5 = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * Ruído de valor 2D em [0, 1], suave (quíntica). Com periodo > 0 repete a cada `periodo` células.
 * @example valor(0.5, 0.5, 1, 4) === valor(4.5, 0.5, 1, 4) // true
 */
export function valor(x, z, s = 0, periodo = 0) {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const u = suave5(x - i);
  const v = suave5(z - j);
  const w = (a, b) => (periodo > 0 ? hashF(mod(a, periodo), mod(b, periodo), s) : hashF(a, b, s));
  const a = w(i, j);
  const b = w(i + 1, j);
  const c = w(i, j + 1);
  const d = w(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// 256 direções de gradiente (tabela: evita seno e cosseno por canto)
const GRAD_X = new Float64Array(256);
const GRAD_Z = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  GRAD_X[i] = Math.cos(((i + 0.5) / 256) * Math.PI * 2);
  GRAD_Z[i] = Math.sin(((i + 0.5) / 256) * Math.PI * 2);
}

/**
 * Ruído de gradiente 2D (Perlin) em cerca de [-1, 1]. Com periodo > 0 repete a cada `periodo` células.
 */
export function gradiente(x, z, s = 0, periodo = 0) {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = x - i;
  const fz = z - j;
  const g = (a, b, dx, dz) => {
    const h = (periodo > 0 ? hash2(mod(a, periodo), mod(b, periodo), s) : hash2(a, b, s)) >>> 24;
    return GRAD_X[h] * dx + GRAD_Z[h] * dz;
  };
  const u = suave5(fx);
  const v = suave5(fz);
  const n00 = g(i, j, fx, fz);
  const n10 = g(i + 1, j, fx - 1, fz);
  const n01 = g(i, j + 1, fx, fz - 1);
  const n11 = g(i + 1, j + 1, fx - 1, fz - 1);
  const a = n00 + (n10 - n00) * u;
  const b = n01 + (n11 - n01) * u;
  return (a + (b - a) * v) * 1.4142;
}

/**
 * Soma de oitavas (fbm). Periódico se periodo > 0: cada oitava dobra a frequência e o período (continua emendando).
 * @param {{ s?: number, oitavas?: number, periodo?: number, ganho?: number, tipo?: 'valor' | 'gradiente' }} op
 * @returns {number} valor: [0, 1]; gradiente: cerca de [-1, 1]
 */
export function fbm(x, z, { s = 0, oitavas = 5, periodo = 0, ganho = 0.5, tipo = 'valor' } = {}) {
  const f = tipo === 'gradiente' ? gradiente : valor;
  let soma = 0;
  let amp = 1;
  let norma = 0;
  let k = 1;
  for (let o = 0; o < oitavas; o++) {
    soma += amp * f(x * k, z * k, (s + o * 1013) | 0, periodo > 0 ? periodo * k : 0);
    norma += amp;
    amp *= ganho;
    k *= 2;
  }
  return soma / norma;
}

/**
 * Worley (células): distância ao ponto mais perto (f1) e ao segundo (f2), em unidades da rede. Periódico se periodo > 0.
 * @returns {{ f1: number, f2: number, id: number }} id: hash da célula do ponto mais perto
 */
export function worley(x, z, s = 0, periodo = 0) {
  const i = Math.floor(x);
  const j = Math.floor(z);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  for (let b = -1; b <= 1; b++) {
    for (let a = -1; a <= 1; a++) {
      const ci = i + a;
      const cj = j + b;
      const hi = periodo > 0 ? mod(ci, periodo) : ci;
      const hj = periodo > 0 ? mod(cj, periodo) : cj;
      const px = ci + hashF(hi, hj, s) - x;
      const pz = cj + hashF(hi, hj, s + 7) - z;
      const d = Math.sqrt(px * px + pz * pz);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash2(hi, hj, s + 13);
      } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2, id };
}

const byte = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

/**
 * Copas vistas de cima em [0, 1] (periódico no quadrado unitário): duas camadas de Worley (16 e 26 células por lado)
 * com altura e raio sorteados por copa; a mais alta vence. Copas de tamanhos diferentes, sem a grade regular de uma
 * camada só.
 */
export function copas(u, v, s = 0) {
  let h = 0;
  for (const [per, raio, sem] of [[16, 1.25, s], [26, 1.5, s + 57]]) {
    const w = worley(u * per, v * per, sem, per);
    const alt = 0.45 + 0.55 * ((w.id >>> 8) / 16777216);
    const r = raio * (0.8 + 0.5 * ((w.id & 255) / 255));
    h = Math.max(h, alt * Math.max(0, 1 - w.f1 * r));
  }
  return h;
}

/**
 * Componentes de um espectro direcional de ondas de vento, com vetor de onda inteiro (o mapa emenda nas bordas): o
 * módulo sorteado em escala logarítmica entre kMin e kMax (ciclos por lado), 80% em torno do vento (+x, abertura de
 * ±60°) e 20% cruzadas (o marulho de outra direção), amplitude caindo com o número de onda (e cortada nas mais longas)
 * e fase sorteada. Com dezenas de componentes em todas as escalas não aparece a rede regular que poucos trens de onda
 * desenham.
 * @returns {{ kx: number, kz: number, amp: number, fase: number }[]}
 */
export function espectroOndas(s = 7, { componentes = 128, kMin = 2, kMax = 40 } = {}) {
  const comps = [];
  const vistos = new Set();
  const l0 = Math.log(kMin);
  const l1 = Math.log(Math.max(kMin + 1, kMax));
  for (let t = 0; comps.length < componentes && t < componentes * 12; t++) {
    const k = Math.exp(l0 + hashF(t, 1, s) * (l1 - l0));
    const cruzada = hashF(t, 4, s) < 0.2;
    const th = cruzada ? 1.9 + (hashF(t, 2, s) - 0.5) * 0.9 : (hashF(t, 2, s) - 0.5) * 2.1;
    const kx = Math.round(k * Math.cos(th));
    const kz = Math.round(k * Math.sin(th));
    if (!kx && !kz) continue;
    // (kx, kz) e (−kx, −kz) são a mesma onda: fica uma só
    if (vistos.has(`${kx},${kz}`) || vistos.has(`${-kx},${-kz}`)) continue;
    vistos.add(`${kx},${kz}`);
    const kk = Math.hypot(kx, kz);
    // corte suave das ondas mais longas (como o de Phillips): nenhuma componente sozinha desenha o azulejo
    const corte = 1 - Math.exp(-((kk / 6) ** 2));
    comps.push({ kx, kz, amp: kk ** -1.35 * corte * (cruzada ? 0.6 : 1), fase: hashF(t, 3, s) * Math.PI * 2 });
  }
  return comps;
}

/**
 * Mapa de normais das ondas, RGBA8 n x n, periódico: a soma das componentes de espectroOndas (em tabelas separáveis
 * de seno e cosseno por linha e coluna, ~25 ms a 256²). RG = inclinação em x e z (0,5 = plano), B = 1, A = altura
 * (espuma nas cristas, média 0,5 e desvio de ~0,09). A inclinação é escalada para um valor médio fixo (a força das
 * ondas fica no shader da água).
 * @returns {Uint8Array} n * n * 4
 */
export function texturaOndas(n = 256, s = 7) {
  const comps = espectroOndas(s, { kMin: 2, kMax: Math.max(3, Math.floor(n / 6)) });
  const alt = new Float32Array(n * n);
  const sx = new Float32Array(n);
  const cx = new Float32Array(n);
  const sy = new Float32Array(n);
  const cy = new Float32Array(n);
  const w = (2 * Math.PI) / n;
  for (const c of comps) {
    for (let i = 0; i < n; i++) {
      sx[i] = Math.sin(w * c.kx * i) * c.amp;
      cx[i] = Math.cos(w * c.kx * i) * c.amp;
      sy[i] = Math.sin(w * c.kz * i + c.fase);
      cy[i] = Math.cos(w * c.kz * i + c.fase);
    }
    // sen(a + b) = sen a cos b + cos a sen b
    for (let y = 0; y < n; y++) {
      const o = y * n;
      const a = cy[y];
      const b = sy[y];
      for (let x = 0; x < n; x++) alt[o + x] += sx[x] * a + cx[x] * b;
    }
  }
  // inclinação por diferença central (com a volta nas bordas) e a escala que dá a inclinação média desejada
  const gx = new Float32Array(n * n);
  const gz = new Float32Array(n * n);
  let g2 = 0;
  let h2 = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const k = y * n + x;
      gx[k] = (alt[y * n + mod(x + 1, n)] - alt[y * n + mod(x - 1, n)]) / 2;
      gz[k] = (alt[mod(y + 1, n) * n + x] - alt[mod(y - 1, n) * n + x]) / 2;
      g2 += gx[k] * gx[k] + gz[k] * gz[k];
      h2 += alt[k] * alt[k];
    }
  }
  const esc = 0.5 / Math.max(1e-9, Math.sqrt(g2 / (n * n)));
  const escH = 0.092 / Math.max(1e-9, Math.sqrt(h2 / (n * n)));
  const out = new Uint8Array(n * n * 4);
  for (let k = 0; k < n * n; k++) {
    const dx = gx[k] * esc;
    const dz = gz[k] * esc;
    const l = Math.hypot(dx, 1, dz);
    out[4 * k] = byte(0.5 - (0.5 * dx) / l);
    out[4 * k + 1] = byte(0.5 - (0.5 * dz) / l);
    out[4 * k + 2] = 255;
    out[4 * k + 3] = byte(0.5 + alt[k] * escH);
  }
  return out;
}

/** Registro no worker oficina: o chão não gera malha lá (o terreno é uma grade instanciada na thread principal). */
export function registrar() {}
