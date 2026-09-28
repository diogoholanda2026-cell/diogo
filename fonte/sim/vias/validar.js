// Regras de geometria das vias (dona: S1b): pista e greide, água e travessia, gleba e portões, ladrilho, raio mínimo,
// ângulo no nó, colisão com outras vias e com prédios; e os índices derivados que essas regras usam (o eixo de cada
// aresta em polilinha e a grade dos prédios), refeitos sozinhos quando a tabela muda. Nada aqui muda o estado.
//
// Convenções: a pista de uma aresta é linear no comprimento de arco entre as cotas dos nós (a mesma conta de
// formaDaAresta, que põe o chão 0,15 m abaixo dela); `lado = +1` é a direita de a para b, em (-dz, dx).
import { tabelaArco, tDoArco, ponto, direcao, tangente, arcoDoT } from '../../comum/bezier.js';
import { distSegmento, pontoNoPoligono, distPoligono, cantosRetangulo, pontoNoRetangulo } from '../../comum/vetor.js';
import { hipot, clamp } from '../../comum/util.js';
import { GradeEspacial } from '../grade.js';
import { AGUA, ARESTA, TIPO_PREDIO } from '../../contratos/flags.js';
import { VIAS, VIAS_ORDEM, REGRAS_VIAS } from '../../data/vias.js';
import { PLANOS, PLANO_ESCOLHIDO, GLEBA_ENVELOPE } from '../../data/arcologia-plano.js';
import { aguaEm } from '../mundo/terreno.js';
import { daHolding } from '../mundo/ladrilhos.js';
import { CHAO_ABAIXO_DA_PISTA, pistaDaAresta, patamaresDa } from '../mundo/aplainar.js';

export { CHAO_ABAIXO_DA_PISTA };

/** Tipo de via de um índice ou id. */
export const tipoVia = (t) => VIAS[typeof t === 'number' ? VIAS_ORDEM[t] : t] ?? null;

/** Maior meia largura dos tipos (consultas de vizinhança). */
export const MEIA_MAX = Math.max(...VIAS_ORDEM.map((k) => VIAS[k].largura / 2));

// ------------------------------------------------------------------------------------------------ derivados

const DERIV = new WeakMap();

/** Índices derivados de uma simulação (não vão no save nem no hash). */
export function derivados(sim) {
  let d = DERIV.get(sim);
  if (!d) {
    d = { eixos: new Map(), predios: null };
    DERIV.set(sim, d);
  }
  return d;
}

// ------------------------------------------------------------------------------------------------ eixo das arestas

const PASSO_EIXO = 4;

function mesmaCurva(c, P, o) {
  const p = c.p;
  for (let k = 0; k < 8; k++) if (p[k] !== P[o + k]) return false;
  return true;
}

/**
 * Eixo de uma cúbica em polilinha (pontos a cada ~4 m de arco): { p, tab, comp, n, pts (x, z), s (arco), caixa }.
 * @param {ArrayLike<number>} P  8 números (ou a coluna p com o deslocamento o)
 */
export function eixoDeCurva(P, o = 0) {
  const p = new Float64Array(8);
  for (let k = 0; k < 8; k++) p[k] = P[o + k];
  const tab = tabelaArco(p);
  const comp = tab[16];
  const n = clamp(Math.ceil(comp / PASSO_EIXO), 2, 512);
  const pts = new Float64Array(2 * (n + 1));
  const s = new Float64Array(n + 1);
  const q = [0, 0];
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let k = 0; k <= n; k++) {
    s[k] = (comp * k) / n;
    ponto(p, k === 0 ? 0 : k === n ? 1 : tDoArco(tab, s[k]), q);
    pts[2 * k] = q[0];
    pts[2 * k + 1] = q[1];
    if (q[0] < x0) x0 = q[0];
    if (q[0] > x1) x1 = q[0];
    if (q[1] < z0) z0 = q[1];
    if (q[1] > z1) z1 = q[1];
  }
  return { p, tab, comp, n, pts, s, caixa: [x0, z0, x1, z1] };
}

/** Eixo em polilinha da aresta e (cache por vaga, geração e pontos de controle). */
export function eixoDa(sim, e) {
  const A = sim.tabelas.arestas;
  const d = derivados(sim);
  let c = d.eixos.get(e);
  if (c && c.ger === A.ger[e] && mesmaCurva(c, A.p, 8 * e)) return c;
  c = eixoDeCurva(A.p, 8 * e);
  c.ger = A.ger[e];
  d.eixos.set(e, c);
  return c;
}

const SEG = { d: 0, t: 0 };

/**
 * Distância de (x, z) a uma polilinha de eixo e o arco do ponto mais perto: out = { d, s }.
 * `limite`: segmentos cuja caixa fica mais longe que isto são pulados (mais rápido; d fica Infinity se nada perto).
 */
export function distEixo(c, x, z, out = { d: 0, s: 0 }, limite = Infinity) {
  const P = c.pts;
  let md = Infinity;
  let ms = 0;
  for (let k = 0; k < c.n; k++) {
    const ax = P[2 * k];
    const az = P[2 * k + 1];
    const bx = P[2 * k + 2];
    const bz = P[2 * k + 3];
    if (limite !== Infinity) {
      if (x < (ax < bx ? ax : bx) - limite || x > (ax > bx ? ax : bx) + limite) continue;
      if (z < (az < bz ? az : bz) - limite || z > (az > bz ? az : bz) + limite) continue;
    }
    distSegmento(x, z, ax, az, bx, bz, SEG);
    if (SEG.d < md) {
      md = SEG.d;
      ms = c.s[k] + (c.s[k + 1] - c.s[k]) * SEG.t;
    }
  }
  out.d = md;
  out.s = ms;
  return out;
}

/** Cota da pista da aresta no comprimento de arco s (linear entre os patamares dos cruzamentos, mundo/aplainar.js). */
export const pistaEm = (sim, e, s) => pistaDaAresta(sim.grafo, e, s);

/** Cota da pista no parâmetro t da curva. */
export const pistaNoT = (sim, e, t) => pistaEm(sim, e, arcoDoT(sim.tabelas.arestas.arco.subarray(17 * e, 17 * e + 17), t));

/** Declive (fração) da rampa da aresta: |y1 - y0| sobre o comprimento fora dos patamares. */
export function decliveDa(sim, e) {
  const A = sim.tabelas.arestas;
  const comp = A.arco[17 * e + 16] || 1;
  const [pa, pb] = patamaresDa(sim.grafo, e);
  return Math.abs(A.y[2 * e + 1] - A.y[2 * e]) / Math.max(1, comp - pa - pb);
}

// ------------------------------------------------------------------------------------------------ prédios

function caixaPredio(P, i) {
  const c = cantosRetangulo(P.x[i], P.z[i], P.rot[i], P.w[i], P.d[i]);
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let k = 0; k < 4; k++) {
    if (c[2 * k] < x0) x0 = c[2 * k];
    if (c[2 * k] > x1) x1 = c[2 * k];
    if (c[2 * k + 1] < z0) z0 = c[2 * k + 1];
    if (c[2 * k + 1] > z1) z1 = c[2 * k + 1];
  }
  return [x0, z0, x1, z1];
}

/**
 * Grade espacial dos prédios, mantida pelas marcas da tabela (encadeia no aviso de mudança que o diário já usa) e
 * refeita inteira ao carregar. Devolve o objeto do índice em dia.
 */
export function indicePredios(sim) {
  const d = derivados(sim);
  const P = sim.tabelas.predios;
  let ix = d.predios;
  if (!ix) {
    ix = { grade: new GradeEspacial(), sujo: new Uint8Array(P.cap), fila: [], tudo: true };
    d.predios = ix;
    const antes = P.aoMarcar;
    P.aoMarcar = (i) => {
      if (antes) antes(i);
      if (i >= ix.sujo.length) {
        const s = new Uint8Array(Math.max(P.cap, i + 1));
        s.set(ix.sujo);
        ix.sujo = s;
      }
      if (!ix.sujo[i]) {
        ix.sujo[i] = 1;
        ix.fila.push(i);
      }
    };
  }
  if (ix.tudo) {
    ix.grade.limpar();
    for (const i of ix.fila) ix.sujo[i] = 0;
    ix.fila.length = 0;
    for (let i = 0; i < P.n; i++) {
      if (!P.viva[i]) continue;
      const c = caixaPredio(P, i);
      ix.grade.inserir(i, c[0], c[1], c[2], c[3]);
    }
    ix.tudo = false;
  } else if (ix.fila.length) {
    for (const i of ix.fila) {
      ix.sujo[i] = 0;
      if (i < P.n && P.viva[i]) {
        const c = caixaPredio(P, i);
        ix.grade.inserir(i, c[0], c[1], c[2], c[3]);
      } else ix.grade.remover(i);
    }
    ix.fila.length = 0;
  }
  return ix;
}

/** Pede que o índice dos prédios seja refeito inteiro (carregar). */
export function refazerIndicePredios(sim) {
  const d = derivados(sim);
  if (d.predios) d.predios.tudo = true;
}

/** Prédios vivos cuja caixa toca [x0, z0, x1, z1], em ordem de idx (cópia). */
export function prediosNaCaixa(sim, x0, z0, x1, z1) {
  const ix = indicePredios(sim);
  const P = sim.tabelas.predios;
  const ids = ix.grade.consultar(x0, z0, x1, z1);
  const out = [];
  for (let k = 0; k < ids.length; k++) if (ids[k] < P.n && P.viva[ids[k]]) out.push(ids[k]);
  return out;
}

/** true se o ponto cai na planta do prédio i crescida de `folga` metros. */
export const pontoNoPredio = (P, i, x, z, folga = 0) => pontoNoRetangulo(x, z, P.x[i], P.z[i], P.rot[i], P.w[i], P.d[i], folga);

// ------------------------------------------------------------------------------------------------ gleba e portões

/** Plano da Arcologia da partida (o gravado no espelho, senão o escolhido no portão 1). */
export const planoDe = (sim) => PLANOS[sim?.espelho?.arcologia?.plano ?? PLANO_ESCOLHIDO] ?? PLANOS[PLANO_ESCOLHIDO];

/** Contorno da gleba (pares x, z). */
export const glebaDe = (sim) => planoDe(sim)?.gleba ?? GLEBA_ENVELOPE.contorno;

/** Portões da gleba: [{ id, x, z }]. */
export const portoesDe = (sim) => planoDe(sim)?.portoes ?? [];

/** true se (x, z) está dentro da gleba (ou a menos de `folga` dela). */
export function naGleba(sim, x, z, folga = 0) {
  const g = glebaDe(sim);
  if (pontoNoPoligono(x, z, g)) return true;
  return folga > 0 && distPoligono(x, z, g) < folga;
}

/** Portão a menos de `raio` de (x, z), ou null. */
export function portaoPerto(sim, x, z, raio) {
  let melhor = null;
  let md = raio;
  for (const p of portoesDe(sim)) {
    const d = hipot(p.x - x, p.z - z);
    if (d <= md) {
      md = d;
      melhor = p;
    }
  }
  return melhor;
}

// ------------------------------------------------------------------------------------------------ amostras

/**
 * Amostras de uma cúbica a cada `passo` metros de arco (inclui as pontas): { n, s, x, z, dx, dz } (direção unitária).
 */
export function amostrarCurva(p, passo = REGRAS_VIAS.amostra, tab = tabelaArco(p)) {
  const comp = tab[16];
  const n = Math.max(1, Math.ceil(comp / passo));
  const a = { n, comp, s: new Float64Array(n + 1), x: new Float64Array(n + 1), z: new Float64Array(n + 1), dx: new Float64Array(n + 1), dz: new Float64Array(n + 1) };
  const q = [0, 0];
  const d = [0, 0];
  for (let k = 0; k <= n; k++) {
    const s = (comp * k) / n;
    const t = k === 0 ? 0 : k === n ? 1 : tDoArco(tab, s);
    ponto(p, t, q);
    direcao(p, t, d);
    a.s[k] = s;
    a.x[k] = q[0];
    a.z[k] = q[1];
    a.dx[k] = d[0];
    a.dz[k] = d[1];
  }
  return a;
}

/**
 * Trechos sobre água ao longo das amostras (eixo e as duas bordas da pista): [[s0, s1]] em arco. Fora do mapa conta
 * como água (mar).
 */
export function trechosSobreAgua(sim, a, meia) {
  const T = sim.espelho.terreno;
  const out = [];
  if (!T?.agua) return out;
  let ini = -1;
  for (let k = 0; k <= a.n; k++) {
    let agua = false;
    for (const u of [0, meia, -meia]) {
      const x = a.x[k] - a.dz[k] * u;
      const z = a.z[k] + a.dx[k] * u;
      if (aguaEm(T, x, z) !== AGUA.TERRA) {
        agua = true;
        break;
      }
    }
    if (agua && ini < 0) ini = k;
    if (!agua && ini >= 0) {
      out.push([a.s[Math.max(0, ini - 1)], a.s[k]]);
      ini = -1;
    }
  }
  if (ini >= 0) out.push([a.s[Math.max(0, ini - 1)], a.s[a.n]]);
  return out;
}

/** true se alguma amostra (eixo e bordas) cai fora dos ladrilhos da Holding. */
export function foraDosLadrilhos(sim, a, meia) {
  if (!sim.espelho.ladrilhos) return false;
  for (let k = 0; k <= a.n; k++) {
    for (const u of [0, meia, -meia]) {
      if (!daHolding(sim, a.x[k] - a.dz[k] * u, a.z[k] + a.dx[k] * u)) return true;
    }
  }
  return false;
}

/**
 * true se a pista entra na gleba. As amostras a menos de meia largura + 2 m de um portão ficam de fora: a via pode
 * chegar até o portão.
 */
export function entraNaGleba(sim, a, meia) {
  const portoes = portoesDe(sim);
  const raio = meia + 2;
  for (let k = 0; k <= a.n; k++) {
    let noPortao = false;
    for (const p of portoes) if (hipot(p.x - a.x[k], p.z - a.z[k]) < raio) noPortao = true;
    if (noPortao) continue;
    for (const u of [0, meia, -meia]) {
      if (naGleba(sim, a.x[k] - a.dz[k] * u, a.z[k] + a.dx[k] * u)) return true;
    }
  }
  return false;
}

/** Menor raio de curvatura de uma cúbica (24 amostras), em metros; reta dá Infinity. */
export function raioMinimo(p, o = 0) {
  let min = Infinity;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const u = 1 - t;
    const dx = 3 * u * u * (p[o + 2] - p[o]) + 6 * u * t * (p[o + 4] - p[o + 2]) + 3 * t * t * (p[o + 6] - p[o + 4]);
    const dz = 3 * u * u * (p[o + 3] - p[o + 1]) + 6 * u * t * (p[o + 5] - p[o + 3]) + 3 * t * t * (p[o + 7] - p[o + 5]);
    const ddx = 6 * u * (p[o + 4] - 2 * p[o + 2] + p[o]) + 6 * t * (p[o + 6] - 2 * p[o + 4] + p[o + 2]);
    const ddz = 6 * u * (p[o + 5] - 2 * p[o + 3] + p[o + 1]) + 6 * t * (p[o + 7] - 2 * p[o + 5] + p[o + 3]);
    const cr = Math.abs(dx * ddz - dz * ddx);
    const v2 = dx * dx + dz * dz;
    if (cr < 1e-12 || v2 < 1e-12) continue;
    const r = (v2 * Math.sqrt(v2)) / cr;
    if (r < min) min = r;
  }
  return min;
}

/**
 * Curvatura com sinal da cúbica no parâmetro t: > 0 quando a curva vira para a direita (lado +1, na direção (-dz, dx)).
 */
export function curvaturaEm(p, t, o = 0) {
  const u = 1 - t;
  const dx = 3 * u * u * (p[o + 2] - p[o]) + 6 * u * t * (p[o + 4] - p[o + 2]) + 3 * t * t * (p[o + 6] - p[o + 4]);
  const dz = 3 * u * u * (p[o + 3] - p[o + 1]) + 6 * u * t * (p[o + 5] - p[o + 3]) + 3 * t * t * (p[o + 7] - p[o + 5]);
  const ddx = 6 * u * (p[o + 4] - 2 * p[o + 2] + p[o]) + 6 * t * (p[o + 6] - 2 * p[o + 4] + p[o + 2]);
  const ddz = 6 * u * (p[o + 5] - 2 * p[o + 3] + p[o + 1]) + 6 * t * (p[o + 7] - 2 * p[o + 5] + p[o + 3]);
  const v2 = dx * dx + dz * dz;
  if (v2 < 1e-12) return 0;
  // (-dz, dx) é a direita: curvar para lá é a segunda derivada com componente positiva nessa direção
  return (dx * ddz - dz * ddx) / (v2 * Math.sqrt(v2));
}

// ------------------------------------------------------------------------------------------------ greide

/**
 * Greide de um traço: cotas da pista nas amostras (arco s), perto do chão mais 0,15 m, com declive até g, passando
 * exatamente pelas cotas fixas (nós que já existem e cruzamentos). O alvo é a média móvel do chão; entre o envelope de
 * aterro e o de corte fica o meio a meio (g-Lipschitz); por fim o alvo é preso entre os cones das cotas fixas, o que
 * mantém o declive e passa pelas fixas. O declive conta no arco reduzido `sr` (o arco sem os patamares dos
 * cruzamentos, onde a pista é plana): amostras no mesmo sr ficam na mesma cota.
 * @param {Float64Array} s   arco das amostras (crescente)
 * @param {Float64Array} alvo  chão + 0,15 em cada amostra
 * @param {Map<number, number>} fixas  índice da amostra → cota
 * @param {Float64Array} [sr]  arco reduzido (não decrescente); padrão: s
 * @returns {{ y: Float64Array, ok: boolean, pior: number }}  ok false se duas fixas pedem mais que g; pior: o maior
 *   corte ou aterro em relação ao alvo
 */
export function greide(s, alvo, fixas, g, janela = REGRAS_VIAS.greideJanela, sr = s) {
  const n = s.length;
  // média móvel pelo arco
  const acum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) acum[i + 1] = acum[i] + alvo[i];
  const m = new Float64Array(n);
  let a = 0;
  let b = 0;
  for (let i = 0; i < n; i++) {
    while (s[i] - s[a] > janela / 2) a++;
    while (b + 1 < n && s[b + 1] - s[i] <= janela / 2) b++;
    m[i] = (acum[b + 1] - acum[a]) / (b + 1 - a);
  }
  const env = (acima) => {
    const y = Float64Array.from(m);
    for (let i = 1; i < n; i++) {
      const lim = y[i - 1] + (acima ? -1 : 1) * g * (sr[i] - sr[i - 1]);
      if (acima ? y[i] < lim : y[i] > lim) y[i] = lim;
    }
    for (let i = n - 2; i >= 0; i--) {
      const lim = y[i + 1] + (acima ? -1 : 1) * g * (sr[i + 1] - sr[i]);
      if (acima ? y[i] < lim : y[i] > lim) y[i] = lim;
    }
    return y;
  };
  const ya = env(true);
  const yc = env(false);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = (ya[i] + yc[i]) / 2;
  let ok = true;
  const idx = [...fixas.keys()].sort((p, q) => p - q);
  for (let k = 0; k + 1 < idx.length; k++) {
    const i = idx[k];
    const j = idx[k + 1];
    if (Math.abs(fixas.get(j) - fixas.get(i)) > g * (sr[j] - sr[i]) + 1e-6) ok = false;
  }
  if (idx.length) {
    for (let i = 0; i < n; i++) {
      let lo = -Infinity;
      let hi = Infinity;
      for (const j of idx) {
        const c = fixas.get(j);
        const r = g * Math.abs(sr[i] - sr[j]);
        if (c - r > lo) lo = c - r;
        if (c + r < hi) hi = c + r;
      }
      if (lo > hi) {
        const mid = (lo + hi) / 2;
        lo = mid;
        hi = mid;
      }
      y[i] = clamp(y[i], lo, hi);
    }
    for (const j of idx) y[j] = fixas.get(j);
  }
  let pior = 0;
  for (let i = 0; i < n; i++) pior = Math.max(pior, Math.abs(y[i] - alvo[i]));
  return { y, ok, pior };
}

/**
 * Quebras do greide: índices das amostras que viram nós para a pista seguir o greide com erro até `tol`, com as
 * fixas sempre dentro e arestas de pelo menos `trechoMin` metros entre quebras novas (Douglas-Peucker no perfil, linear
 * no arco reduzido sr, como a pista entre os patamares).
 */
export function quebrasDoGreide(s, y, fixas, tol = REGRAS_VIAS.greideTolerancia, trechoMin = REGRAS_VIAS.greideTrechoMin, sr = s) {
  const n = s.length;
  const marcas = new Uint8Array(n);
  marcas[0] = 1;
  marcas[n - 1] = 1;
  for (const i of fixas.keys()) marcas[i] = 1;
  const pilha = [];
  let ant = 0;
  for (let i = 1; i < n; i++) {
    if (marcas[i]) {
      pilha.push([ant, i]);
      ant = i;
    }
  }
  while (pilha.length) {
    const [i, j] = pilha.pop();
    if (j - i < 2) continue;
    let pior = -1;
    let dp = tol;
    const L = sr[j] - sr[i];
    for (let k = i + 1; k < j; k++) {
      if (s[k] - s[i] < trechoMin || s[j] - s[k] < trechoMin) continue;
      const lin = L > 0 ? y[i] + ((y[j] - y[i]) * (sr[k] - sr[i])) / L : y[i];
      const d = Math.abs(y[k] - lin);
      if (d > dp) {
        dp = d;
        pior = k;
      }
    }
    if (pior >= 0) {
      marcas[pior] = 1;
      pilha.push([i, pior], [pior, j]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (marcas[i]) out.push(i);
  return out;
}

// ------------------------------------------------------------------------------------------------ ângulos

/**
 * Direção de saída da aresta e a partir do nó n (unitária), na ponta do nó.
 */
export function saidaDoNo(sim, e, n, out = [0, 0]) {
  const A = sim.tabelas.arestas;
  if (A.a[e] === n) {
    direcao(A.p, 0, out, 8 * e);
  } else {
    direcao(A.p, 1, out, 8 * e);
    out[0] = -out[0];
    out[1] = -out[1];
  }
  return out;
}

/** Cosseno do ângulo mínimo entre vias no nó (30 graus). */
export const COS_ANGULO_MIN = 0.8660254037844387;

/**
 * true se a direção unitária (dx, dz) sai do nó n a pelo menos 30 graus de todas as arestas ligadas a ele (menos as
 * de `ignorar`).
 */
export function anguloLivre(sim, n, dx, dz, ignorar = null) {
  const A = sim.tabelas.arestas;
  const L = sim.tabelas.nos.lig;
  const d = [0, 0];
  for (let k = 0; k < 6; k++) {
    const e = L[6 * n + k];
    if (e < 0 || !A.viva[e] || (ignorar && ignorar.has(e))) continue;
    saidaDoNo(sim, e, n, d);
    if (d[0] * dx + d[1] * dz > COS_ANGULO_MIN + 1e-9) return false;
  }
  return true;
}

// ------------------------------------------------------------------------------------------------ colisões

const DE = { d: 0, s: 0 };

/**
 * Arestas cuja pista a pista nova (amostras a, meia largura) cobre: devolve a lista de idx. `excl` diz, por aresta, os
 * círculos [x, z, raio] onde a sobreposição é a própria junção (nós e divisões que o plano compartilha com ela);
 * `propria` é uma aresta a pular (a que está sendo melhorada).
 */
export function viasSobrepostas(sim, a, meia, excl = null, propria = -1) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let k = 0; k <= a.n; k++) {
    if (a.x[k] < x0) x0 = a.x[k];
    if (a.x[k] > x1) x1 = a.x[k];
    if (a.z[k] < z0) z0 = a.z[k];
    if (a.z[k] > z1) z1 = a.z[k];
  }
  const r = meia + MEIA_MAX;
  const ids = G.gradeArestas.consultar(x0 - r, z0 - r, x1 + r, z1 + r);
  const out = [];
  for (let q = 0; q < ids.length; q++) {
    const e = ids[q];
    if (!A.viva[e] || e === propria) continue;
    const c = eixoDa(sim, e);
    const soma = meia + tipoVia(A.tipo[e]).largura / 2 - 0.5;
    const cx = c.caixa;
    const circulos = excl ? excl.get(e) ?? null : null;
    for (let k = 0; k <= a.n; k++) {
      const x = a.x[k];
      const z = a.z[k];
      if (x < cx[0] - soma || x > cx[2] + soma || z < cx[1] - soma || z > cx[3] + soma) continue;
      if (circulos) {
        let dentro = false;
        for (const [px, pz, pr] of circulos) {
          if (hipot(px - x, pz - z) < pr) {
            dentro = true;
            break;
          }
        }
        if (dentro) continue;
      }
      distEixo(c, x, z, DE, soma);
      if (DE.d < soma) {
        out.push(e);
        break;
      }
    }
  }
  return out;
}

/**
 * Prédios que a pista (amostras a, meia largura) toca: a planta crescida de meia + folga contém alguma amostra do eixo
 * (a cada ~2 m). Em ordem de idx.
 */
export function prediosNaPista(sim, a, meia, folga = REGRAS_VIAS.folgaPredio) {
  const P = sim.tabelas.predios;
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let k = 0; k <= a.n; k++) {
    if (a.x[k] < x0) x0 = a.x[k];
    if (a.x[k] > x1) x1 = a.x[k];
    if (a.z[k] < z0) z0 = a.z[k];
    if (a.z[k] > z1) z1 = a.z[k];
  }
  const r = meia + folga;
  const cand = prediosNaCaixa(sim, x0 - r, z0 - r, x1 + r, z1 + r);
  const out = [];
  for (const i of cand) {
    const c = caixaPredio(P, i);
    let toca = false;
    for (let k = 0; k <= a.n && !toca; k++) {
      // entre duas amostras, mais uma no meio (passo de ~2 m)
      for (let h = 0; h < (k < a.n ? 2 : 1) && !toca; h++) {
        const x = h ? (a.x[k] + a.x[k + 1]) / 2 : a.x[k];
        const z = h ? (a.z[k] + a.z[k + 1]) / 2 : a.z[k];
        if (x < c[0] - r || x > c[2] + r || z < c[1] - r || z > c[3] + r) continue;
        if (pontoNoRetangulo(x, z, P.x[i], P.z[i], P.rot[i], P.w[i], P.d[i], r)) toca = true;
      }
    }
    if (toca) out.push(i);
  }
  return out;
}

/** true se o prédio i é da cidade (de zona); serviços e prédios da Holding não saem com a via ('colisao'). */
export const predioDaCidade = (sim, i) => sim.tabelas.predios.tipo[i] === TIPO_PREDIO.ZONA;

/** true se a aresta não pode ser cruzada nem dividida pelo jogador (rodovia, ponte, Arcologia). */
export function arestaIntocavel(sim, e) {
  const f = sim.tabelas.arestas.flags[e];
  return !!(f & (ARESTA.RODOVIA | ARESTA.PONTE | ARESTA.ARCOLOGIA));
}

/**
 * true se o jogador pode ligar uma via nova ao nó n: nó comum, ou nó da rodovia que já é ponta (o nó de entrada) ou
 * que já tem uma via comum ligada (a junção da Vila). Nó da Arcologia só pelo portão.
 */
export function noLigavel(sim, n) {
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  let intocavel = 0;
  let comum = 0;
  for (let k = 0; k < 6; k++) {
    const e = N.lig[6 * n + k];
    if (e < 0 || !A.viva[e]) continue;
    if (arestaIntocavel(sim, e)) intocavel++;
    else comum++;
  }
  if (!intocavel || comum > 0) return true;
  return N.grau[n] === 1;
}

// ------------------------------------------------------------------------------------------------ registro

/**
 * Colunas próprias da S1b na tabela de arestas: `fase` (onde começa a primeira coluna de células, em metros de arco a
 * partir do nó a; as células ficam alinhadas quando a aresta se divide) e o índice do prédio sob a grade dos prédios.
 */
export function registrar(sim) {
  const A = sim.tabelas.arestas;
  if (A && !A.specs.fase) A.novaColuna('fase', Float32Array);
  if (sim.tabelas.predios) {
    indicePredios(sim);
    sim.aoCarregar(() => {
      refazerIndicePredios(sim);
      derivados(sim).eixos.clear();
    });
  }
}

/** Tangente (não normalizada) no parâmetro t, reexportada para os outros módulos das vias. */
export { tangente };
