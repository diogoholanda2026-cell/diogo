// Grafo das vias (seção 5.1 do desenho da simulação, 2.4): nós e arestas em tabelas do espelho, arestas como Bézier
// cúbicas com tabela de arco, cortes pelo raio do nó, componentes e a forma CSR para os caminhos. Toda mudança marca o
// diário. As regras de traçado (encaixe, validação, custo) são da S1b em cima destas funções.
//
// Exemplo:
//   const G = criarGrafo(sim);
//   const a = addNo(G, 0, 0), b = addNo(G, 112, 0);
//   const e = addAresta(G, a, b, 'rua');            // reta
//   const n = dividir(G, e, 0.5);                    // nó no meio, duas arestas
//   const c = addNo(G, 56, 80); addAresta(G, n, c, 'avenida', [40, 30], [60, 50]);   // curva
import { COLUNAS, TETOS } from '../../contratos/espelho.js';
import { VIAS, VIAS_ORDEM, FOLGA_NO } from '../../data/vias.js';
import * as bz from '../../comum/bezier.js';
import { montarCSR } from '../../comum/caminhos.js';
import { GradeEspacial } from '../grade.js';
import { cos, hipot } from '../../comum/util.js';

export const GRAU_MAX = 6;
/** Ângulo abaixo do qual dois trechos do mesmo tipo seguem reto num nó de grau 2 (sem cruzamento). */
const RETO_COS = cos((15 * Math.PI) / 180);

/**
 * Cria as tabelas 'nos' e 'arestas' no núcleo (com diário), liga o espelho (espelho.vias) e os índices espaciais.
 * @returns {object} G = { sim, nos, arestas, gradeNos, gradeArestas, versao }
 */
export function criarGrafo(sim, { cap = 1024 } = {}) {
  const nos = sim.registrarTabela('nos', COLUNAS.nos, cap, { teto: TETOS.nos, diario: true });
  const arestas = sim.registrarTabela('arestas', COLUNAS.arestas, cap, { teto: TETOS.arestas, diario: true });
  const G = { sim, nos, arestas, gradeNos: new GradeEspacial(), gradeArestas: new GradeEspacial(), versao: 0 };
  sim.grafo = G;
  sim.espelho.vias.nos = nos;
  sim.espelho.vias.arestas = arestas;
  sim.aoCarregar(() => reconstruirIndices(G));
  sim.registrarValidador('grafo', () => validarGrafo(G));
  return G;
}

/** Tipo de via da aresta. */
export const tipoDa = (G, e) => VIAS[VIAS_ORDEM[G.arestas.tipo[e]]];
/** Meia largura da aresta, em metros. */
export const meiaDa = (G, e) => tipoDa(G, e).largura / 2;
/** Tabela de arco (17 amostras) da aresta, como vista. */
export const arcoDa = (G, e) => G.arestas.arco.subarray(17 * e, 17 * e + 17);

/** Nó da outra ponta. */
export const outroNo = (G, e, n) => (G.arestas.a[e] === n ? G.arestas.b[e] : G.arestas.a[e]);

/** Arestas ligadas ao nó, em ordem de ligação. */
export function arestasDoNo(G, n) {
  const out = [];
  const L = G.nos.lig;
  for (let k = 0; k < GRAU_MAX; k++) {
    const e = L[GRAU_MAX * n + k];
    if (e >= 0) out.push(e);
  }
  return out;
}

function ligar(G, n, e) {
  const L = G.nos.lig;
  for (let k = 0; k < GRAU_MAX; k++) {
    if (L[GRAU_MAX * n + k] < 0) {
      L[GRAU_MAX * n + k] = e;
      G.nos.grau[n]++;
      G.nos.marcar(n);
      return true;
    }
  }
  return false;
}

function desligar(G, n, e) {
  const L = G.nos.lig;
  const o = GRAU_MAX * n;
  let achou = false;
  for (let k = 0; k < GRAU_MAX; k++) {
    if (!achou && L[o + k] === e) achou = true;
    if (achou) L[o + k] = k + 1 < GRAU_MAX ? L[o + k + 1] : -1;
  }
  if (achou) {
    G.nos.grau[n]--;
    G.nos.marcar(n);
  }
  return achou;
}

/** Cria um nó; y padrão: o chão (sim.alturaEm). Devolve o idx ou -1 no teto. */
export function addNo(G, x, z, y) {
  const { nos } = G;
  const i = nos.alocar();
  if (i < 0) return -1;
  nos.x[i] = x;
  nos.z[i] = z;
  nos.y[i] = y ?? G.sim.alturaEm(x, z);
  G.gradeNos.inserir(i, x, z, x, z);
  G.versao++;
  return i;
}

/** Remove um nó sem arestas. */
export function removerNo(G, n) {
  if (!G.nos.viva[n] || G.nos.grau[n] !== 0) return false;
  G.gradeNos.remover(n);
  G.nos.liberar(n);
  G.versao++;
  return true;
}

function geometria(G, e) {
  const A = G.arestas;
  const tab = arcoDa(G, e);
  bz.tabelaArco(A.p, tab, 8 * e);
  A.comp[e] = tab[16];
  A.y[2 * e] = G.nos.y[A.a[e]];
  A.y[2 * e + 1] = G.nos.y[A.b[e]];
  const c = bz.caixa(A.p, 8 * e, meiaDa(G, e));
  G.gradeArestas.inserir(e, c[0], c[1], c[2], c[3]);
}

/**
 * Cria uma aresta de a para b. p1 e p2 são os controles [x, z] da cúbica; só p1 = curva de 3 pontos (quadrática
 * elevada); nenhum = reta. tipo: id ou índice em VIAS_ORDEM. Devolve o idx ou -1 (mesmo nó, nó morto, grau 6, teto).
 */
export function addAresta(G, a, b, tipo, p1 = null, p2 = null, { flags = 0, mao = 0, idade = null } = {}) {
  const { nos, arestas: A } = G;
  if (a === b || !nos.viva[a] || !nos.viva[b]) return -1;
  if (nos.grau[a] >= GRAU_MAX || nos.grau[b] >= GRAU_MAX) return -1;
  const ti = typeof tipo === 'number' ? tipo : VIAS_ORDEM.indexOf(tipo);
  if (ti < 0 || ti >= VIAS_ORDEM.length) throw new Error(`addAresta: tipo de via desconhecido (${tipo})`);
  // nós no mesmo ponto dariam aresta de comprimento 0 com o corte invertido (t0 = t1)
  if (nos.x[a] === nos.x[b] && nos.z[a] === nos.z[b]) return -1;
  const e = A.alocar();
  if (e < 0) return -1;
  A.a[e] = a;
  A.b[e] = b;
  A.tipo[e] = ti;
  A.flags[e] = flags;
  A.mao[e] = mao;
  A.idade[e] = idade ?? G.sim.tique;
  const o = 8 * e;
  const P = A.p;
  const x0 = nos.x[a];
  const z0 = nos.z[a];
  const x3 = nos.x[b];
  const z3 = nos.z[b];
  if (p1 && p2) {
    P[o] = x0;
    P[o + 1] = z0;
    P[o + 2] = p1[0];
    P[o + 3] = p1[1];
    P[o + 4] = p2[0];
    P[o + 5] = p2[1];
    P[o + 6] = x3;
    P[o + 7] = z3;
  } else if (p1) {
    P.set(bz.deQuadratica(x0, z0, p1[0], p1[1], x3, z3), o);
  } else {
    P.set(bz.reta(x0, z0, x3, z3), o);
  }
  ligar(G, a, e);
  ligar(G, b, e);
  geometria(G, e);
  cortes(G, a);
  cortes(G, b);
  A.marcar(e);
  G.versao++;
  return e;
}

/** Remove a aresta; nós que ficam sem aresta saem junto (a não ser com manterNos). */
export function removerAresta(G, e, { manterNos = false } = {}) {
  const { nos, arestas: A } = G;
  if (e < 0 || e >= A.n || !A.viva[e]) return false;
  const a = A.a[e];
  const b = A.b[e];
  desligar(G, a, e);
  desligar(G, b, e);
  G.gradeArestas.remover(e);
  A.liberar(e);
  for (const n of a === b ? [a] : [a, b]) {
    if (!manterNos && nos.grau[n] === 0) removerNo(G, n);
    else cortes(G, n);
  }
  G.versao++;
  return true;
}

/**
 * Divide a aresta no parâmetro t (0 < t < 1): cria um nó no ponto e duas arestas com o mesmo tipo, flags, mão e
 * idade. Devolve o nó novo.
 */
export function dividir(G, e, t) {
  const A = G.arestas;
  if (!A.viva[e] || !(t > 0 && t < 1)) return -1;
  // no teto a aresta sumiria sem as duas novas: confere antes de remover
  if (G.nos.vivos >= G.nos.teto || A.vivos + 1 > A.teto) return -1;
  const [p, q] = bz.dividir(A.p, t, undefined, undefined, 8 * e);
  const a = A.a[e];
  const b = A.b[e];
  const tipo = A.tipo[e];
  const flags = A.flags[e];
  const mao = A.mao[e];
  const idade = A.idade[e];
  const y = A.y[2 * e] + (A.y[2 * e + 1] - A.y[2 * e]) * t;
  removerAresta(G, e, { manterNos: true });
  const n = addNo(G, p[6], p[7], y);
  addAresta(G, a, n, tipo, [p[2], p[3]], [p[4], p[5]], { flags, mao, idade });
  addAresta(G, n, b, tipo, [q[2], q[3]], [q[4], q[5]], { flags, mao, idade });
  return n;
}

/**
 * Funde n2 em n1: as arestas de n2 passam para n1 (a ponta e o controle vizinho andam juntos); arestas entre os dois
 * somem. Devolve n1, ou -1 sem mudar nada se n1 passaria do grau 6.
 */
export function fundir(G, n1, n2) {
  const { nos, arestas: A } = G;
  if (n1 === n2 || !nos.viva[n1] || !nos.viva[n2]) return n1;
  const deN2 = arestasDoNo(G, n2);
  const entre = deN2.filter((e) => outroNo(G, e, n2) === n1).length;
  if (nos.grau[n1] - entre + (deN2.length - entre) > GRAU_MAX) return -1;
  const dx = nos.x[n1] - nos.x[n2];
  const dz = nos.z[n1] - nos.z[n2];
  const outros = new Set();
  for (const e of deN2) {
    const o = outroNo(G, e, n2);
    if (o === n1) {
      removerAresta(G, e, { manterNos: true });
      continue;
    }
    desligar(G, n2, e);
    const k = 8 * e;
    if (A.a[e] === n2) {
      A.a[e] = n1;
      A.p[k] += dx;
      A.p[k + 1] += dz;
      A.p[k + 2] += dx;
      A.p[k + 3] += dz;
    } else {
      A.b[e] = n1;
      A.p[k + 6] += dx;
      A.p[k + 7] += dz;
      A.p[k + 4] += dx;
      A.p[k + 5] += dz;
    }
    // a ponta fica exatamente no nó
    A.p[A.a[e] === n1 ? k : k + 6] = nos.x[n1];
    A.p[A.a[e] === n1 ? k + 1 : k + 7] = nos.z[n1];
    ligar(G, n1, e);
    geometria(G, e);
    A.marcar(e);
    outros.add(o);
  }
  removerNo(G, n2);
  cortes(G, n1);
  for (const o of outros) cortes(G, o);
  G.versao++;
  return n1;
}

// direção de saída da aresta e a partir do nó n
function saida(G, e, n, out) {
  const A = G.arestas;
  if (A.a[e] === n) {
    bz.direcao(A.p, 0, out, 8 * e);
  } else {
    bz.direcao(A.p, 1, out, 8 * e);
    out[0] = -out[0];
    out[1] = -out[1];
  }
  return out;
}

/**
 * Refaz o raio do nó (maior meia largura que chega mais 2 m; 0 numa ponta ou num nó de grau 2 que segue reto com o
 * mesmo tipo) e os cortes t0 e t1 das arestas ligadas.
 */
export function cortes(G, n) {
  const { nos } = G;
  if (!nos.viva[n]) return;
  const lista = arestasDoNo(G, n);
  let r = 0;
  if (lista.length >= 2) {
    let maior = 0;
    for (const e of lista) maior = Math.max(maior, meiaDa(G, e));
    r = maior + FOLGA_NO;
    if (lista.length === 2 && G.arestas.tipo[lista[0]] === G.arestas.tipo[lista[1]]) {
      const u = saida(G, lista[0], n, [0, 0]);
      const v = saida(G, lista[1], n, [0, 0]);
      if (-(u[0] * v[0] + u[1] * v[1]) >= RETO_COS) r = 0;
    }
  }
  if (nos.raio[n] !== Math.fround(r)) {
    nos.raio[n] = r;
    nos.marcar(n);
  }
  for (const e of lista) atualizarCorte(G, e);
}

/** Cortes t0 e t1 da aresta pelos raios dos seus nós (sempre t0 < t1). */
export function atualizarCorte(G, e) {
  const { nos, arestas: A } = G;
  const tab = arcoDa(G, e);
  const comp = tab[16];
  let s0 = nos.raio[A.a[e]];
  let s1 = comp - nos.raio[A.b[e]];
  if (s1 - s0 < comp * 0.1) {
    s0 = Math.min(s0, comp * 0.45);
    s1 = Math.max(s1, comp * 0.55);
  }
  const t0 = Math.fround(bz.tDoArco(tab, s0));
  const t1 = Math.fround(bz.tDoArco(tab, s1));
  if (A.corte[2 * e] !== t0 || A.corte[2 * e + 1] !== t1) {
    A.corte[2 * e] = t0;
    A.corte[2 * e + 1] = t1;
    A.marcar(e);
  }
}

/**
 * Componentes conexos (ignorando a mão). comp[i] = rótulo do componente do nó i (0, 1, ... pela ordem do menor nó),
 * -1 para vaga morta.
 * @returns {{ comp: Int32Array, n: number }}
 */
export function componentes(G) {
  const { nos, arestas: A } = G;
  const pai = new Int32Array(nos.n);
  for (let i = 0; i < nos.n; i++) pai[i] = i;
  const raiz = (i) => {
    while (pai[i] !== i) {
      pai[i] = pai[pai[i]];
      i = pai[i];
    }
    return i;
  };
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    const ra = raiz(A.a[e]);
    const rb = raiz(A.b[e]);
    if (ra !== rb) {
      if (ra < rb) pai[rb] = ra;
      else pai[ra] = rb;
    }
  }
  const comp = new Int32Array(nos.n).fill(-1);
  const rotulo = new Int32Array(nos.n).fill(-1);
  let k = 0;
  for (let i = 0; i < nos.n; i++) {
    if (!nos.viva[i]) continue;
    const r = raiz(i);
    if (rotulo[r] < 0) rotulo[r] = k++;
    comp[i] = rotulo[r];
  }
  return { comp, n: k };
}

/**
 * Grafo compacto (CSR) para caminhos.js: vértices = nós; cada aresta viva dá uma ligação por sentido permitido.
 * ref da ligação: e para a -> b e ~e para b -> a (a convenção de espelho.entregas.caminho).
 * @param {{ custo?: (e: number) => number, respeitarMao?: boolean }} op  custo padrão: comprimento em metros
 */
export function adjacencia(G, { custo = null, respeitarMao = true } = {}) {
  const { nos, arestas: A } = G;
  const de = [];
  const para = [];
  const peso = [];
  const ref = [];
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    const w = custo ? custo(e) : A.comp[e];
    const m = respeitarMao ? A.mao[e] : 0;
    if (m >= 0) {
      de.push(A.a[e]);
      para.push(A.b[e]);
      peso.push(w);
      ref.push(e);
    }
    if (m <= 0) {
      de.push(A.b[e]);
      para.push(A.a[e]);
      peso.push(w);
      ref.push(~e);
    }
  }
  return montarCSR(nos.n, de, para, peso, ref);
}

/** Nó vivo mais perto de (x, z) até `raio`, ou -1. */
export function noPerto(G, x, z, raio) {
  const { nos } = G;
  const r = G.gradeNos.maisPerto(x, z, raio, (i) => hipot(nos.x[i] - x, nos.z[i] - z));
  return r ? r.id : -1;
}

/** Aresta viva mais perto de (x, z) até `raio`: { e, t, d, x, z } ou null. */
export function arestaPerto(G, x, z, raio) {
  const A = G.arestas;
  const mp = { t: 0, d: 0, x: 0, z: 0 };
  let melhor = null;
  const ids = G.gradeArestas.consultar(x - raio, z - raio, x + raio, z + raio);
  for (let k = 0; k < ids.length; k++) {
    const e = ids[k];
    if (!A.viva[e]) continue;
    bz.maisPerto(A.p, x, z, 8 * e, mp);
    if (mp.d <= raio && (!melhor || mp.d < melhor.d)) melhor = { e, t: mp.t, d: mp.d, x: mp.x, z: mp.z };
  }
  return melhor;
}

/** Refaz os índices espaciais a partir das tabelas (depois de carregar). */
export function reconstruirIndices(G) {
  const { nos, arestas: A } = G;
  G.gradeNos.limpar();
  G.gradeArestas.limpar();
  for (let i = 0; i < nos.n; i++) if (nos.viva[i]) G.gradeNos.inserir(i, nos.x[i], nos.z[i], nos.x[i], nos.z[i]);
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    const c = bz.caixa(A.p, 8 * e, meiaDa(G, e));
    G.gradeArestas.inserir(e, c[0], c[1], c[2], c[3]);
  }
  G.versao++;
}

/** Confere o grafo: sem aresta órfã, pontas nos nós, listas de ligação coerentes. Devolve textos de erro. */
export function validarGrafo(G) {
  const { nos, arestas: A } = G;
  const erros = [];
  for (let e = 0; e < A.n && erros.length < 50; e++) {
    if (!A.viva[e]) continue;
    const a = A.a[e];
    const b = A.b[e];
    if (a < 0 || b < 0 || a >= nos.n || b >= nos.n || !nos.viva[a] || !nos.viva[b]) {
      erros.push(`aresta ${e} órfã`);
      continue;
    }
    if (!arestasDoNo(G, a).includes(e) || !arestasDoNo(G, b).includes(e)) erros.push(`aresta ${e} fora da lista do nó`);
    const k = 8 * e;
    if (A.p[k] !== nos.x[a] || A.p[k + 1] !== nos.z[a] || A.p[k + 6] !== nos.x[b] || A.p[k + 7] !== nos.z[b]) {
      erros.push(`aresta ${e} com ponta fora do nó`);
    }
    if (!(A.corte[2 * e] < A.corte[2 * e + 1])) erros.push(`aresta ${e} com corte invertido`);
  }
  for (let n = 0; n < nos.n && erros.length < 50; n++) {
    if (!nos.viva[n]) continue;
    const lista = arestasDoNo(G, n);
    if (lista.length !== nos.grau[n]) erros.push(`nó ${n} com grau ${nos.grau[n]} e ${lista.length} ligações`);
    for (const e of lista) if (!A.viva[e] || (A.a[e] !== n && A.b[e] !== n)) erros.push(`nó ${n} liga a aresta ${e} que não é dele`);
  }
  return erros;
}
