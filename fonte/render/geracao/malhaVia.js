// Varredura das vias (desenho do render 4.2 e 4.5), pura: sem three, sem DOM (roda no Node, no worker `oficina` e na
// thread principal, onde a prévia da X2 usa gerarMalhaVia). A aresta é uma Bézier cúbica; a seção de perfilVia.js
// anda ao longo dela sobre o chão (alturaEm, D4), com a saia de 1 m nas bordas. Estações a cada 8 m (a grade do chão)
// e a cada 3 graus de curva, depois fundidas onde o trecho é reto e o chão não se afasta mais de 4 cm da reta: uma
// avenida reta no chão aplainado vira poucos quadriláteros. Cada tira tem os seus vértices (aresta viva no meio-fio);
// as normais saem da geometria de verdade (declive e abaulamento).
//
// Atributos por vértice (o shader da via, via.glsl.js): posição, normal, aUV = (u lateral, v desde o corte do início,
// v até o corte do fim, b = distância na banda), aDados = (material, tipo, marcas, AO) e aId (idx da aresta).
// Também aqui: a quantização da malha do setor (D39) e as posições dos postes, árvores e vagas ao longo da aresta,
// que o setor e o mapa de luz da rua usam com a mesma conta.
import { ponto, tangente, tabelaArco, tDoArco } from '../../comum/bezier.js';
import { perfilVia, MAT, ALTURA, faixasDoSentido } from './perfilVia.js';

/** Bits de aDados.z (marcas da aresta; na peça do nó, CRUZAMENTO). */
export const BITS = Object.freeze({
  ZEBRA_INI: 1, ZEBRA_FIM: 2,
  RET_INI_A: 4, RET_INI_B: 8, // retenção no início: faixas do sentido -1 (A), do +1 (B), as duas (A | B)
  RET_FIM_A: 16, RET_FIM_B: 32,
  PEDRA: 64, // calçada de pedra portuguesa
  CRUZAMENTO: 128, // peça do nó: sem marcas de faixa
});

/** Parâmetros da varredura. */
export const VARREDURA = Object.freeze({ passo: 8, graus: 3, tolAltura: 0.04, passoMin: 0.5 });

// ------------------------------------------------------------------------------------------------ construtor

/** Malha em construção (Float32 relativa à origem do setor), crescendo por dobra. */
export class ConstrutorVia {
  constructor(cap = 1024) {
    this.nv = 0;
    this.ni = 0;
    this._cap(cap, cap * 3);
  }

  _cap(nv, ni) {
    const cresce = (velho, n, T) => {
      const a = new T(n);
      if (velho) a.set(velho.subarray(0, Math.min(velho.length, n)));
      return a;
    };
    if (!this.pos || nv > this.pos.length / 3) {
      const n = Math.max(nv, (this.pos ? this.pos.length / 3 : 0) * 2);
      this.pos = cresce(this.pos, n * 3, Float32Array);
      this.nor = cresce(this.nor, n * 3, Float32Array);
      this.uv = cresce(this.uv, n * 4, Float32Array);
      this.dados = cresce(this.dados, n * 4, Uint8Array);
      this.id = cresce(this.id, n, Uint32Array);
    }
    if (!this.idx || ni > this.idx.length) this.idx = cresce(this.idx, Math.max(ni, (this.idx ? this.idx.length : 0) * 2), Uint32Array);
  }

  /** Um vértice; devolve o índice. */
  vert(x, y, z, nx, ny, nz, u, v, vf, b, mat, tipo, marcas, ao, id) {
    if (this.nv + 1 > this.pos.length / 3) this._cap(this.nv + 1, this.ni);
    const i = this.nv++;
    this.pos[3 * i] = x;
    this.pos[3 * i + 1] = y;
    this.pos[3 * i + 2] = z;
    this.nor[3 * i] = nx;
    this.nor[3 * i + 1] = ny;
    this.nor[3 * i + 2] = nz;
    this.uv[4 * i] = u;
    this.uv[4 * i + 1] = v;
    this.uv[4 * i + 2] = vf;
    this.uv[4 * i + 3] = b;
    this.dados[4 * i] = mat;
    this.dados[4 * i + 1] = tipo;
    this.dados[4 * i + 2] = marcas;
    this.dados[4 * i + 3] = Math.max(0, Math.min(255, Math.round(ao * 255)));
    this.id[i] = id >>> 0;
    return i;
  }

  tri(a, b, c) {
    if (this.ni + 3 > this.idx.length) this._cap(this.nv, this.ni + 3);
    this.idx[this.ni++] = a;
    this.idx[this.ni++] = b;
    this.idx[this.ni++] = c;
  }

  /** Triângulo com a normal para cima (ou para fora de uma face vertical na direção `fora`), trocando a ordem. */
  triOrientado(a, b, c) {
    const p = this.pos;
    const ax = p[3 * a];
    const az = p[3 * a + 2];
    const cr = (p[3 * b] - ax) * (p[3 * c + 2] - az) - (p[3 * b + 2] - az) * (p[3 * c] - ax);
    // y da normal de (b - a) x (c - a) = -cruz2D(b - a, c - a)
    if (cr > 0) this.tri(a, c, b);
    else this.tri(a, b, c);
  }

  get tris() {
    return this.ni / 3;
  }
}

// ------------------------------------------------------------------------------------------------ estações

/**
 * Estação da curva no comprimento de arco s: ponto e tangente unitária. `tab` é a tabela de arco da curva (17
 * amostras, bezier.tabelaArco).
 */
export function estacao(p, tab, s, out = { x: 0, z: 0, tx: 1, tz: 0, t: 0 }, o = 0) {
  const t = tDoArco(tab, s);
  const q = ponto(p, t, [0, 0], o);
  const d = tangente(p, t, [0, 0], o);
  const c = Math.hypot(d[0], d[1]) || 1;
  out.x = q[0];
  out.z = q[1];
  out.tx = d[0] / c;
  out.tz = d[1] / c;
  out.t = t;
  return out;
}

/** Cota da via numa posição: o chão mais a altura da tira, ou o greide da ponte (cotas das pontas, linear em s). */
function cotaDe(alturaEm, x, z, dy, ponte, s, L, cotas) {
  if (ponte) return cotas[0] + (cotas[1] - cotas[0]) * (L > 0 ? s / L : 0) - ALTURA.pista + dy;
  return alturaEm(x, z) + dy;
}

/**
 * Pontos da seção de um perfil numa estação: para cada tira, os dois vértices [x, y, z] (mundo), na ordem das tiras.
 * É a conta que a varredura e a boca do cruzamento fazem igual (juntas exatas).
 */
export function pontosDaEstacao(P, est, alturaEm, { ponte = false, s = 0, L = 0, cotas = null } = {}) {
  const rx = -est.tz;
  const rz = est.tx;
  const out = new Float64Array(P.tiras.length * 6);
  let k = 0;
  for (const tr of P.tiras) {
    for (const [u, dy] of [[tr.u0, tr.y0], [tr.u1, tr.y1]]) {
      const x = est.x + rx * u;
      const z = est.z + rz * u;
      out[k++] = x;
      out[k++] = cotaDe(alturaEm, x, z, dy, ponte, s, L, cotas);
      out[k++] = z;
    }
  }
  return out;
}

/** AO cozida de um vértice pela tira: pé do meio-fio, sarjeta e fundo da saia mais escuros. */
function aoDe(mat, dy, b) {
  if (mat === MAT.SAIA) return dy < 0 ? 0.35 : 0.8;
  if (mat === MAT.MEIO_FIO) return dy <= ALTURA.pista + 1e-3 ? 0.62 : 0.95;
  if (mat === MAT.PISTA || mat === MAT.ACOSTAMENTO) return b < 0.05 ? 0.72 : 1;
  if (mat === MAT.CALCADA) return b < 0.05 ? 0.93 : 1;
  if (mat === MAT.CANTEIRO) return b < 0.05 || b > 3.95 ? 0.8 : 1;
  return 1;
}

/**
 * Estações de um trecho [s0, s1] da curva: a cada `passo` m e a cada `graus` de curva; depois fundidas onde o trecho
 * segue reto (menos de `graus` entre as pontas) e o chão de todas as tiras fica a menos de `tol` da reta.
 * @returns {number[]} os s das estações, com s0 e s1
 */
export function estacoes(p, tab, s0, s1, P, alturaEm, { passo = VARREDURA.passo, graus = VARREDURA.graus, tol = VARREDURA.tolAltura, ponte = false } = {}) {
  const L = s1 - s0;
  if (!(L > 1e-4)) return [s0, s1];
  const n0 = Math.max(1, Math.ceil(L / passo));
  const cand = [];
  for (let i = 0; i <= n0; i++) cand.push(s0 + (L * i) / n0);
  // refina pela curvatura: um ponto no meio onde a tangente vira mais que `graus`
  const lim = Math.cos((graus * Math.PI) / 180);
  const e1 = { x: 0, z: 0, tx: 1, tz: 0, t: 0 };
  const e2 = { x: 0, z: 0, tx: 1, tz: 0, t: 0 };
  const fino = [cand[0]];
  for (let i = 0; i + 1 < cand.length; i++) {
    const pilha = [[cand[i], cand[i + 1], 0]];
    const saida = [];
    while (pilha.length) {
      const [a, b, prof] = pilha.pop();
      estacao(p, tab, a, e1);
      estacao(p, tab, b, e2);
      if (prof < 6 && b - a > VARREDURA.passoMin && e1.tx * e2.tx + e1.tz * e2.tz < lim) {
        const m = (a + b) / 2;
        pilha.push([m, b, prof + 1], [a, m, prof + 1]);
      } else saida.push(b);
    }
    fino.push(...saida);
  }
  if (ponte) return fino;
  // funde: da estação mantida a, estica até onde a reta ainda serve
  const us = [...new Set(P.tiras.flatMap((t) => [t.u0, t.u1]))];
  const chao = fino.map((s) => {
    const e = estacao(p, tab, s, { x: 0, z: 0, tx: 1, tz: 0, t: 0 });
    return { s, e, h: us.map((u) => alturaEm(e.x - e.tz * u, e.z + e.tx * u)) };
  });
  const manter = [0];
  let a = 0;
  while (a < chao.length - 1) {
    let b = a + 1;
    while (b + 1 < chao.length) {
      const c = b + 1;
      const A = chao[a];
      const C = chao[c];
      if (A.e.tx * C.e.tx + A.e.tz * C.e.tz < lim) break;
      let ok = true;
      const cx = C.e.x - A.e.x;
      const cz = C.e.z - A.e.z;
      const cc = Math.hypot(cx, cz) || 1;
      for (let k = a + 1; k < c && ok; k++) {
        const E = chao[k].e;
        // curva em S: a direção no meio e o eixo fora da corda também impedem a fusão
        if (A.e.tx * E.tx + A.e.tz * E.tz < lim || Math.abs(((E.x - A.e.x) * cz - (E.z - A.e.z) * cx) / cc) > tol) {
          ok = false;
          break;
        }
        const f = (chao[k].s - A.s) / (C.s - A.s);
        for (let j = 0; j < us.length; j++) {
          if (Math.abs(chao[k].h[j] - (A.h[j] + (C.h[j] - A.h[j]) * f)) > tol) {
            ok = false;
            break;
          }
        }
      }
      if (!ok) break;
      b = c;
    }
    manter.push(b);
    a = b;
  }
  return manter.map((i) => chao[i].s);
}

// ------------------------------------------------------------------------------------------------ varredura

/**
 * Malha de uma aresta (ou de um trecho dela): a varredura do perfil sobre o chão. Pura.
 * @param {{ p: ArrayLike<number>, sIni?: number, sFim?: number, s0?: number, s1?: number, id?: number,
 *           marcas?: number, ponte?: boolean, cotas?: number[], tampaIni?: boolean, tampaFim?: boolean }} aresta
 *   p: os 8 números da Bézier (x0 z0 ... x3 z3); sIni e sFim: os cortes do cruzamento em metros de arco (padrão 0 e
 *   o comprimento); s0 e s1: o trecho desta malha (padrão sIni e sFim); marcas: BITS; tampas: fecha o canteiro e a
 *   barreira na ponta (junto de um cruzamento); ponte: greide linear nas cotas (em vez do chão)
 * @param {object | string | number} perfil  perfilVia(tipo) ou o tipo
 * @param {{ alturaEm: (x: number, z: number) => number, ox?: number, oz?: number, K?: ConstrutorVia,
 *           passo?: number, graus?: number, tol?: number }} op
 * @returns {ConstrutorVia} com a malha (vértices relativos a ox, oz)
 * @example gerarMalhaVia({ p: reta(0, 0, 112, 0) }, 'rua', { alturaEm: () => 0 })
 */
export function gerarMalhaVia(aresta, perfil, op) {
  const P = typeof perfil === 'object' ? perfil : perfilVia(perfil);
  const { alturaEm, ox = 0, oz = 0 } = op;
  const K = op.K ?? new ConstrutorVia(512);
  const p = aresta.p;
  const tab = tabelaArco(p);
  const L = tab[16];
  const sIni = aresta.sIni ?? 0;
  const sFim = aresta.sFim ?? L;
  const s0 = Math.max(sIni, aresta.s0 ?? sIni);
  const s1 = Math.min(sFim, aresta.s1 ?? sFim);
  if (!(s1 - s0 > 1e-3)) return K;
  const ponte = !!aresta.ponte;
  const cotas = aresta.cotas ?? [0, 0];
  const id = aresta.id ?? 0;
  const marcas = aresta.marcas ?? 0;
  const tipo = P.idx;
  const ss = estacoes(p, tab, s0, s1, P, alturaEm, { passo: op.passo, graus: op.graus, tol: op.tol, ponte });
  const nT = P.tiras.length;
  const ns = ss.length;
  // posições de todas as estações (mundo, Float64) e depois as normais pela geometria
  const pos = new Float64Array(ns * nT * 6);
  const est = { x: 0, z: 0, tx: 1, tz: 0, t: 0 };
  const ests = [];
  for (let i = 0; i < ns; i++) {
    estacao(p, tab, ss[i], est);
    ests.push({ ...est });
    pos.set(pontosDaEstacao(P, est, alturaEm, { ponte, s: ss[i], L, cotas }), i * nT * 6);
  }
  const base = K.nv;
  const n = [0, 0, 0];
  for (let i = 0; i < ns; i++) {
    const s = ss[i];
    const iA = Math.max(0, i - 1);
    const iB = Math.min(ns - 1, i + 1);
    for (let j = 0; j < nT; j++) {
      const tr = P.tiras[j];
      for (let lado = 0; lado < 2; lado++) {
        const o = (i * nT + j) * 6 + lado * 3;
        // lateral: da ponta u0 para a u1 da tira; longitudinal: da estação anterior para a seguinte
        const o0 = (i * nT + j) * 6;
        let lx = pos[o0 + 3] - pos[o0];
        let ly = pos[o0 + 4] - pos[o0 + 1];
        let lz = pos[o0 + 5] - pos[o0 + 2];
        if (Math.abs(lx) + Math.abs(ly) + Math.abs(lz) < 1e-9) {
          lx = -ests[i].tz;
          lz = ests[i].tx;
        }
        const oa = (iA * nT + j) * 6 + lado * 3;
        const ob = (iB * nT + j) * 6 + lado * 3;
        let gx = pos[ob] - pos[oa];
        let gy = pos[ob + 1] - pos[oa + 1];
        let gz = pos[ob + 2] - pos[oa + 2];
        if (iA === iB) {
          gx = ests[i].tx;
          gy = 0;
          gz = ests[i].tz;
        }
        // n = lateral x longitudinal
        n[0] = ly * gz - lz * gy;
        n[1] = lz * gx - lx * gz;
        n[2] = lx * gy - ly * gx;
        const c = Math.hypot(n[0], n[1], n[2]) || 1;
        const u = lado ? tr.u1 : tr.u0;
        const dy = lado ? tr.y1 : tr.y0;
        const b = lado ? tr.b1 : tr.b0;
        K.vert(pos[o] - ox, pos[o + 1], pos[o + 2] - oz, n[0] / c, n[1] / c, n[2] / c, u, s - sIni, sFim - s, b, tr.mat, tipo, marcas, aoDe(tr.mat, dy, b), id);
      }
    }
  }
  for (let i = 0; i + 1 < ns; i++) {
    for (let j = 0; j < nT; j++) {
      const a = base + (i * nT + j) * 2;
      const b = a + 1;
      const c = base + ((i + 1) * nT + j) * 2;
      const d = c + 1;
      K.tri(a, b, c);
      K.tri(b, d, c);
    }
  }
  // tampas do canteiro e da barreira junto do cruzamento (a calçada segue na esquina)
  if (aresta.tampaIni && s0 <= sIni + 1e-6) tampa(K, P, pos.subarray(0, nT * 6), ests[0], -1, ox, oz, id, marcas, s0 - sIni, sFim - s0);
  if (aresta.tampaFim && s1 >= sFim - 1e-6) tampa(K, P, pos.subarray((ns - 1) * nT * 6, ns * nT * 6), ests[ns - 1], 1, ox, oz, id, marcas, s1 - sIni, sFim - s1);
  return K;
}

/**
 * Fecha as partes altas (canteiro, barreira) na ponta: um polígono vertical virado para fora (sentido -1 no início,
 * +1 no fim), do contorno alto até a base na pista. As tiras altas vêm marcadas no perfil (alto: 'canteiro' ou
 * 'barreira'), seguidas: o contorno é a primeira ponta da primeira e a segunda ponta de cada uma.
 */
function tampa(K, P, secao, est, sentido, ox, oz, id, marcas, v, vf) {
  const nx = est.tx * sentido;
  const nz = est.tz * sentido;
  const tiras = P.tiras;
  for (let j = 0; j < tiras.length; ) {
    const alto = tiras[j].alto;
    if (!alto) {
      j++;
      continue;
    }
    let k = j;
    while (k + 1 < tiras.length && tiras[k + 1].alto === alto) k++;
    const mat = alto === 'canteiro' ? MAT.MEIO_FIO : MAT.BARREIRA;
    const anel = [];
    const pega = (o, u, ao) => anel.push(K.vert(secao[o] - ox, secao[o + 1], secao[o + 2] - oz, nx, 0, nz, u, v, vf, 0, mat, P.idx, marcas, ao, id));
    pega(j * 6, tiras[j].u0, 0.7);
    for (let q = j; q <= k; q++) pega(q * 6 + 3, tiras[q].u1, q === k ? 0.7 : 0.95);
    for (let q = 1; q + 1 < anel.length; q++) triVertical(K, anel[0], anel[q], anel[q + 1], nx, nz);
    j = k + 1;
  }
}

/** Triângulo de uma face vertical com a normal para (nx, 0, nz). */
function triVertical(K, a, b, c, nx, nz) {
  const p = K.pos;
  const ux = p[3 * b] - p[3 * a];
  const uy = p[3 * b + 1] - p[3 * a + 1];
  const uz = p[3 * b + 2] - p[3 * a + 2];
  const vx = p[3 * c] - p[3 * a];
  const vy = p[3 * c + 1] - p[3 * a + 1];
  const vz = p[3 * c + 2] - p[3 * a + 2];
  const cx = uy * vz - uz * vy;
  const cz = ux * vy - uy * vx;
  if (cx * nx + cz * nz >= 0) K.tri(a, b, c);
  else K.tri(a, c, b);
}

// ------------------------------------------------------------------------------------------------ quantização

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

/** Normal de volta do octaedro (a mesma conta do shader, gOct). */
export function deOctaedro(a, b) {
  let x = a / 127;
  let y = b / 127;
  let z = 1 - Math.abs(x) - Math.abs(y);
  if (z < 0) {
    const nx = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
    const ny = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
    x = nx;
    y = ny;
  }
  const c = Math.hypot(x, z, y) || 1;
  return [x / c, z / c, y / c];
}

/**
 * Quantiza a malha de um ConstrutorVia (D39): posição Int16 relativa à caixa (escala uniforme), normal octaédrica em
 * 2 x Int8, aUV em Float32 x 4 (v de rodovia passa de 1 km: meia precisão não serve), aDados Uint8 x 4, aId Uint32.
 * A posição de volta é centro + (q / 32767) * s.
 */
export function quantizarVia(K, material = 'via') {
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
  const o = [0, 0];
  for (let i = 0; i < nv; i++) {
    posicao[3 * i] = Math.round((p[3 * i] - cx) * k);
    posicao[3 * i + 1] = Math.round((p[3 * i + 1] - cy) * k);
    posicao[3 * i + 2] = Math.round((p[3 * i + 2] - cz) * k);
    octaedro(K.nor[3 * i], K.nor[3 * i + 1], K.nor[3 * i + 2], o);
    normal[2 * i] = o[0];
    normal[2 * i + 1] = o[1];
  }
  const ni = K.ni;
  const indices = nv < 65536 ? Uint16Array.from(K.idx.subarray(0, ni)) : K.idx.slice(0, ni);
  return {
    material,
    atributos: { posicao, normal, uv: K.uv.slice(0, nv * 4), dados: K.dados.slice(0, nv * 4), id: K.id.slice(0, nv) },
    indices,
    escala: Float32Array.of(cx, cy, cz, s),
    caixa: Float32Array.of(x0, y0, z0, x1, y1, z1),
    nv,
    tris: ni / 3,
  };
}

/** Bytes de uma malha quantizada. */
export function bytesDaMalhaVia(m) {
  let b = m.indices.byteLength;
  for (const a of Object.values(m.atributos)) b += a.byteLength;
  return b;
}

// ------------------------------------------------------------------------------------------------ objetos da rua

/** Hash de 32 bits de inteiros (determinístico, sem Math.random). */
export function hashI(a, b = 0, c = 0) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}
export const hashF = (a, b = 0, c = 0) => hashI(a, b, c) / 4294967296;

/** Folga das pontas: nada de poste, árvore ou vaga a menos disto do corte do cruzamento (m). */
export const FOLGA_PONTA = Object.freeze({ poste: 4, arvore: 6, vaga: 7 });

/**
 * Postes de uma aresta entre os cortes [sIni, sFim]: [{ x, z, s, u, lado, dx, dz, altura, braco, modelo }] com (dx,
 * dz) a direção para onde o braço aponta (para a pista). Mesma conta no setor (props) e no mapa de luz da rua.
 */
export function postesDaAresta(p, tipo, sIni, sFim, id, tab = tabelaArco(p)) {
  const P = typeof tipo === 'object' ? tipo : perfilVia(tipo);
  const R = P.regras.postes;
  const out = [];
  if (!R) return out;
  const L = sFim - sIni - 2 * FOLGA_PONTA.poste;
  if (L < 1) return out;
  const n = Math.max(1, Math.round(L / R.espaco));
  const passo = L / n;
  const est = { x: 0, z: 0, tx: 1, tz: 0, t: 0 };
  for (let k = 0; k <= n; k++) {
    const s = sIni + FOLGA_PONTA.poste + passo * k;
    estacao(p, tab, s, est);
    let u;
    let lado;
    if (R.onde === 'canteiro') {
      u = P.canteiro ? (P.canteiro.u0 + P.canteiro.u1) / 2 : P.barreira ? (P.barreira.u0 + P.barreira.u1) / 2 : 0;
      lado = 0;
    } else if (R.onde === 'lado') {
      lado = 1;
      u = P.meia + 0.6;
    } else {
      lado = (k + (id & 1)) % 2 ? 1 : -1;
      u = lado > 0 ? P.bordas.d + 0.55 : P.bordas.e - 0.55;
    }
    const rx = -est.tz;
    const rz = est.tx;
    out.push({ x: est.x + rx * u, z: est.z + rz * u, s, u, lado, dx: -rx * (lado || 1), dz: -rz * (lado || 1), altura: R.altura, braco: R.braco, modelo: R.modelo });
  }
  return out;
}

/**
 * Árvores de rua de uma aresta: [{ x, z, s, u, especie, escala, semente }]. As das calçadas só nas ruas arborizadas
 * (a probabilidade do tipo, pelo idx da aresta), com falhas; as do canteiro sempre. Longe das pontas e dos postes.
 */
export function arvoresDaAresta(p, tipo, sIni, sFim, id, tab = tabelaArco(p)) {
  const P = typeof tipo === 'object' ? tipo : perfilVia(tipo);
  const out = [];
  const est = { x: 0, z: 0, tx: 1, tz: 0, t: 0 };
  const postes = postesDaAresta(p, P, sIni, sFim, id, tab);
  const livre = (s, lado) => postes.every((q) => Math.abs(q.s - s) > 2.5 || (q.lado !== 0 && lado !== 0 && q.lado !== lado));
  const plantar = (regra, onde, semente) => {
    if (!regra || hashF(id, semente) >= regra.prob) return;
    const L = sFim - sIni - 2 * FOLGA_PONTA.arvore;
    if (L < 2) return;
    const canteiro = onde === 'canteiro';
    const n = Math.max(1, Math.floor(L / regra.espaco));
    const passo = L / n;
    for (const lado of canteiro ? [0] : [-1, 1]) {
      for (let k = 0; k < (canteiro ? n : n + 1); k++) {
        // falhas (árvore que morreu, garagem, poste de luz no caminho): 25% nas calçadas
        if (!canteiro && hashF(id, k * 7 + lado + 3, semente) < 0.25) continue;
        const jit = canteiro ? 0 : (hashF(id, k, semente + 5) - 0.5) * 2.4;
        const s = Math.min(sFim - FOLGA_PONTA.arvore, Math.max(sIni + FOLGA_PONTA.arvore, sIni + FOLGA_PONTA.arvore + passo * (k + (canteiro ? 0.5 : 0)) + jit));
        if (!livre(s, lado)) continue;
        estacao(p, tab, s, est);
        const u = canteiro ? (P.canteiro ? (P.canteiro.u0 + P.canteiro.u1) / 2 : 0) : lado > 0 ? P.bordas.d + 1.0 : P.bordas.e - 1.0;
        out.push({ x: est.x - est.tz * u, z: est.z + est.tx * u, s, u, especie: regra.especie, escala: 0.8 + 0.4 * hashF(id, k, lado + 17), semente: hashI(id, k, lado + 31) });
      }
    }
  };
  const R = P.regras;
  if (R.arvores) plantar(R.arvores, R.arvores.onde, 23);
  if (R.calcadaArv) plantar(R.calcadaArv, 'calcadas', 29);
  return out;
}

/**
 * Vagas de estacionamento ocupadas de uma aresta: [{ x, z, s, u, dx, dz, semente }] a cada 5,5 m na faixa de
 * estacionamento, com o carro virado no sentido da faixa ao lado. `ocupacao` 0 a 1.
 */
export function vagasDaAresta(p, tipo, sIni, sFim, id, mao = 0, ocupacao = 0.55, tab = tabelaArco(p)) {
  const P = typeof tipo === 'object' ? tipo : perfilVia(tipo);
  const out = [];
  if (!P.vagas.length) return out;
  const L = sFim - sIni - 2 * FOLGA_PONTA.vaga;
  if (L < 5.5) return out;
  const n = Math.floor(L / 5.5);
  const est = { x: 0, z: 0, tx: 1, tz: 0, t: 0 };
  for (const vg of P.vagas) {
    // a faixa de trânsito ao lado da vaga dá o sentido do carro estacionado
    const viz = P.faixas.reduce((m, f) => (Math.abs(f.meio - vg.meio) < Math.abs(m.meio - vg.meio) ? f : m), P.faixas[0]);
    const sentido = mao === 0 ? viz.sentido : viz.sentido * mao;
    for (let k = 0; k < n; k++) {
      if (hashF(id, k, 41) >= ocupacao) continue;
      const s = sIni + FOLGA_PONTA.vaga + 5.5 * (k + 0.5);
      estacao(p, tab, s, est);
      const u = vg.meio + Math.sign(vg.meio || 1) * 0.35; // encostado no meio-fio
      out.push({ x: est.x - est.tz * u, z: est.z + est.tx * u, s, u, dx: est.tx * sentido, dz: est.tz * sentido, semente: hashI(id, k, 43) });
    }
  }
  return out;
}

/** Faixas de trânsito de uma aresta para os carros (m do eixo e sentido físico), pela mão. */
export function faixasDeTransito(tipo, mao = 0) {
  const P = typeof tipo === 'object' ? tipo : perfilVia(tipo);
  return [...faixasDoSentido(P, 1, mao).map((f) => ({ u: f.meio, sentido: 1 })), ...faixasDoSentido(P, -1, mao).map((f) => ({ u: f.meio, sentido: -1 }))];
}

/** A varredura não registra tipo na oficina: o setor ('vias') é de cruzamento.js, que junta arestas e nós. */
export function registrar() {}
