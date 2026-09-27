// Erosão fluvial dos maciços, só para o assado (dona: S1a). Não entra no jogo: ferramentas/mapa.mjs --assar roda
// assarRelevo() e grava mundo/relevo-assado.js; a abertura só decodifica (mundo/relevo.js).
//
// Modelo de evolução da paisagem (FastScape implícito, Braun e Willett 2013) com a altura presa ao envelope autoral:
//   dh/dt = c (P + E - h) - K A^0,5 S
// P é a planície, E o envelope dos maciços, A a área de drenagem e S o declive até o receptor. As bases (mar, planície,
// leito do rio, lagoa) ficam paradas; o resto escoa para elas. O receptor de cada célula é sorteado entre os vizinhos
// mais baixos com peso pelo quadrado do declive (sorteio inteiro determinístico por célula e iteração): tira o viés
// da grade de 8 direções (sem ele os vales correm em linhas retas a 0 e 45 graus). O ruído inicial quebra a simetria e
// dá origem às bacias; o c devolve as cristas ao envelope, e os vales descem onde a área de drenagem cresce. Abaixo de
// `limiar` células de drenagem não há canal (a encosta só difunde), e a cota de cada morro de mata é acertada no fim.
import { fnv1aTipado, hexHash } from '../../comum/hash.js';
import { smoothstep } from '../../comum/util.js';
import { ESCALA_RELEVO, VERSAO_ASSADO, envelope, fundoDoVale, hashControles, prever, decodificar, dois } from './relevo.js';

/** Parâmetros do assado (da versão VERSAO_ASSADO de relevo.js). */
export const PARAMETROS = Object.freeze({
  iteracoes: 520, K: 1.8e-3, c: 1.1e-3, limiar: 6, ruido: 34, ruidoEscala: 300, difusao: 0.14, passadasDifusao: 3, k: 3,
});

/**
 * Evolução da paisagem na grade n² de passo p. `alvo` é P + E nas células de maciço; `base` marca as células paradas
 * (com a altura já em h0). Devolve a altura final (Float64Array).
 */
export function evoluir({ n, passo, h0, alvo, base, iteracoes, K, c, limiar = 0 }) {
  const N = n * n;
  const h = Float64Array.from(h0);
  const rcv = new Int32Array(N);
  const dist = new Float64Array(N);
  const A = new Float64Array(N);
  const pilha = new Int32Array(N);
  const ndon = new Int32Array(N);
  const ini = new Int32Array(N + 1);
  const don = new Int32Array(N);
  const tmp = new Int32Array(N);
  const d1 = passo;
  const d2 = passo * Math.SQRT2;
  const area = passo * passo;
  const Amin = limiar * area; // canal só a partir de `limiar` células de drenagem: a crista não se gasta
  const OFF = [1, -1, n, -n, n + 1, n - 1, -n + 1, -n - 1];
  const DQ = [d1, d1, d1, d1, d2, d2, d2, d2];
  const livre = new Uint8Array(N);
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) livre[j * n + i] = base[j * n + i] ? 0 : 1;
  for (let it = 0; it < iteracoes; it++) {
    ndon.fill(0);
    for (let k = 0; k < N; k++) {
      rcv[k] = k;
      dist[k] = 0;
      if (!livre[k]) continue;
      const hk = h[k];
      let soma = 0;
      for (let q = 0; q < 8; q++) {
        const s = (hk - h[k + OFF[q]]) / DQ[q];
        if (s > 0) soma += s * s;
      }
      if (soma <= 0) continue;
      let x = sorteio(k, it) * soma;
      let r = k;
      let dd = 0;
      for (let q = 0; q < 8; q++) {
        const s = (hk - h[k + OFF[q]]) / DQ[q];
        if (s <= 0) continue;
        x -= s * s;
        r = k + OFF[q];
        dd = DQ[q];
        if (x <= 0) break;
      }
      rcv[k] = r;
      dist[k] = dd;
      ndon[r]++;
    }
    // doadores em lista compacta e a pilha (das bases para montante, em profundidade)
    ini[0] = 0;
    for (let k = 0; k < N; k++) ini[k + 1] = ini[k] + ndon[k];
    for (let k = 0; k < N; k++) tmp[k] = ini[k];
    for (let k = 0; k < N; k++) if (rcv[k] !== k) don[tmp[rcv[k]]++] = k;
    let top = 0;
    for (let b = 0; b < N; b++) {
      if (rcv[b] !== b) continue;
      let sp = 0;
      tmp[sp++] = b;
      while (sp) {
        const a = tmp[--sp];
        pilha[top++] = a;
        for (let q = ini[a]; q < ini[a + 1]; q++) tmp[sp++] = don[q];
      }
    }
    // área de drenagem (de montante para jusante)
    for (let k = 0; k < N; k++) A[k] = area;
    for (let s = N - 1; s >= 0; s--) {
      const k = pilha[s];
      if (rcv[k] !== k) A[rcv[k]] += A[k];
    }
    // passo implícito (n = 1, m = 0,5), das bases para montante
    for (let s = 0; s < N; s++) {
      const k = pilha[s];
      if (!livre[k]) continue;
      const r = rcv[k];
      if (r === k) {
        h[k] = (h[k] + c * alvo[k]) / (1 + c);
        continue;
      }
      const f = A[k] < Amin ? 0 : (K * Math.sqrt(A[k])) / dist[k];
      h[k] = (h[k] + c * alvo[k] + f * h[r]) / (1 + c + f);
    }
  }
  return h;
}

/** Sorteio inteiro em [0, 1) por célula e iteração (sem estado: a mesma conta em qualquer ordem). */
function sorteio(k, it) {
  let x = Math.imul(k, 0x9e3779b1) ^ Math.imul(it + 1, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

/** Difusão de encosta (tira o ruído de célula que o sorteio deixa), só nas células livres. */
function difundir(h, n, base, coef, passadas) {
  const N = n * n;
  const t = new Float64Array(N);
  for (let p = 0; p < passadas; p++) {
    t.set(h);
    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const k = j * n + i;
        if (base[k]) continue;
        h[k] = t[k] + coef * (t[k - 1] + t[k + 1] + t[k - n] + t[k + n] - 4 * t[k]);
      }
    }
  }
  return h;
}

/**
 * Bases da erosão e a altura delas, na grade G (a grossa ou a do detalhe): mar (nível 0), o pé submerso dos maciços
 * (no envelope; base 3), leito e várzea baixa do rio (nível + 0,8; base 2 no curso de cima, acima da planície), lagoa
 * (nível) e a planície (onde o envelope é quase nulo). `borda` (opcional) prende as células da borda da grade na
 * altura dada (o detalhe encosta no relevo grosso). Devolve { base, h0, alvo }.
 */
export function bases(mapa, C, E, F, P, G = C.G, borda = null) {
  const { nc } = G;
  const NC = nc * nc;
  const mesma = G === C.G;
  const ler = (D, x, z) => F.amostrar(D, C.G.nc, C.G.pc, C.G.ox, C.G.oz, x, z);
  const base = new Uint8Array(NC);
  const h0 = new Float64Array(NC);
  const alvo = new Float64Array(NC);
  const R = { a: 0, hw: 0, nivel: 0, varzea: 0, lado: 1, v: 0 };
  for (let k = 0; k < NC; k++) {
    const i = k % nc;
    const j = (k / nc) | 0;
    const x = G.ox + i * G.pc;
    const z = G.oz + j * G.pc;
    const p = P[k];
    alvo[k] = p + E[k];
    h0[k] = alvo[k];
    if (borda && (i === 0 || j === 0 || i === nc - 1 || j === nc - 1)) {
      base[k] = 1;
      h0[k] = borda(x, z, p);
      continue;
    }
    const sd = mesma ? C.costa.sd[k] : ler(C.costa.sd, x, z);
    if (sd < 0 && E[k] < 1) {
      base[k] = 1;
      h0[k] = 0;
      continue;
    }
    if (alvo[k] < 0) {
      // pé submerso dos maciços (ilhas, pontas, costões): fica no envelope (base 3, no relevo assado). A erosão fluvial
      // para no nível do mar; sem isto o pé subia até ele e virava um raso de areia em volta das ilhas
      base[k] = 3;
      h0[k] = alvo[k];
      continue;
    }
    if (E[k] < 1) {
      base[k] = 1;
      h0[k] = p;
      continue;
    }
    F.rioNosCampos(C, x, z, R);
    if (R.a < R.hw + 24) {
      // leito: no nível do rio mais 0,8 m; no curso de cima, onde a água corre acima da planície, o fundo do vale (a
      // base 2 fica no relevo assado, como o envelope)
      const f = fundoDoVale(C, F, x, z, R.nivel);
      base[k] = f > 0 ? 2 : 1;
      h0[k] = f > 0 ? p + f : Math.min(p, R.nivel + 0.8);
      continue;
    }
    const lsd = mesma ? C.lagoa.sd[k] : ler(C.lagoa.sd, x, z);
    if (lsd > -24) {
      base[k] = 1;
      h0[k] = mesma ? C.lagoa.nivel[k] : ler(C.lagoa.nivel, x, z);
    }
  }
  return { base, h0, alvo };
}

/**
 * Cota dos morros de mata: a erosão e a difusão gastam o topo de um morro pequeno; aqui o relevo em volta de cada um
 * é escalado para o topo voltar à cota do mapa (peso 1 no miolo, 0 no pé, liso entre os dois).
 */
function calibrarMorros(mapa, C, F, rel, P, G = C.G) {
  const { nc, pc, ox, oz } = G;
  for (const m of mapa.morros) {
    if (m.forma === 'pao') continue;
    const cs = F.cos(m.ang);
    const sn = F.sen(m.ang);
    const R = Math.max(m.rx, m.rz) * 1.4;
    if (m.x + R < ox || m.z + R < oz || m.x - R > ox + (nc - 1) * pc || m.z - R > oz + (nc - 1) * pc) continue;
    const i0 = Math.max(0, Math.floor((m.x - R - ox) / pc));
    const i1 = Math.min(nc - 1, Math.ceil((m.x + R - ox) / pc));
    const j0 = Math.max(0, Math.floor((m.z - R - oz) / pc));
    const j1 = Math.min(nc - 1, Math.ceil((m.z + R - oz) / pc));
    const raio = (i, j) => {
      const dx = ox + i * pc - m.x;
      const dz = oz + j * pc - m.z;
      const lx = (dx * cs + dz * sn) / m.rx;
      const lz = (dz * cs - dx * sn) / m.rz;
      return Math.sqrt(lx * lx + lz * lz);
    };
    let topo = -Infinity;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (raio(i, j) < 0.8) topo = Math.max(topo, P[j * nc + i] + rel[j * nc + i]);
    const pc0 = F.planicieEm(C, m.x, m.z);
    if (!(topo > pc0 + 1)) continue;
    const f = (m.h - pc0) / (topo - pc0);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const w = 1 - smoothstep(0.6, 1.3, raio(i, j));
        if (w > 0) rel[j * nc + i] *= 1 + (f - 1) * w;
      }
    }
  }
}

/** Escreve bits (do mais significativo para o menos). */
class EscritorBits {
  constructor() {
    this.b = [];
    this.acc = 0;
    this.n = 0;
  }
  bit(v) {
    this.acc = (this.acc << 1) | v;
    if (++this.n === 8) {
      this.b.push(this.acc);
      this.acc = 0;
      this.n = 0;
    }
  }
  bits(v, n) {
    for (let i = n - 1; i >= 0; i--) this.bit(Math.floor(v / dois(i)) & 1);
  }
  /** Exp-Golomb de ordem k. */
  eg(v, k) {
    const w = v + dois(k);
    let m = 0;
    while (dois(m + 1) <= w) m++;
    for (let i = 0; i < m - k; i++) this.bit(0);
    this.bits(w, m + 1);
  }
  bytes() {
    const out = [...this.b];
    if (this.n) out.push(this.acc << (8 - this.n));
    return Uint8Array.from(out);
  }
}

function paraBase64(bytes) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const v = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += a[(v >> 18) & 63] + a[(v >> 12) & 63];
    s += i + 1 < bytes.length ? a[(v >> 6) & 63] : '=';
    s += i + 2 < bytes.length ? a[v & 63] : '=';
  }
  return s;
}

/** Codifica alturas acima da planície (n², metros) no formato de relevo.decodificar. */
export function codificar(rel, n, k = PARAMETROS.k, escala = ESCALA_RELEVO) {
  const N = n * n;
  const q = new Int32Array(N);
  for (let i = 0; i < N; i++) q[i] = Math.round(rel[i] / escala);
  const W = new EscritorBits();
  let zeros = 0;
  for (let pos = 0; pos < N; pos++) {
    const r = q[pos] - prever(q, n, pos % n, (pos / n) | 0);
    if (r === 0) {
      zeros++;
      continue;
    }
    W.eg(zeros, 0);
    zeros = 0;
    const u = r > 0 ? 2 * r : -2 * r - 1;
    W.eg(u - 1, k);
  }
  if (zeros) W.eg(zeros, 0);
  return { n, k, escala, dados: paraBase64(W.bytes()) };
}

/**
 * Um passo do assado numa grade G: bases, ruído inicial, evolução, difusão, relevo acima da planície (0 nas bases) e a
 * cota dos morros. `borda` prende a borda (o detalhe). Devolve { rel: Float32Array, E }.
 */
function assarGrade(mapa, C, F, par, G, borda = null) {
  const { nc, pc, ox, oz } = G;
  const NC = nc * nc;
  const P = new Float64Array(NC);
  if (G === C.G) for (let k = 0; k < NC; k++) P[k] = F.planicieNo(C, k);
  else for (let k = 0; k < NC; k++) P[k] = F.planicieEm(C, ox + (k % nc) * pc, oz + ((k / nc) | 0) * pc);
  const E = envelope(mapa, C, F, G);
  const { base, h0, alvo } = bases(mapa, C, E, F, P, G, borda);
  // ruído inicial (só nos maciços, pesando pela altura do envelope): a semente das bacias
  const s = F.sementeDe(mapa.semente) + 2024;
  for (let k = 0; k < NC; k++) {
    if (base[k]) continue;
    const x = ox + (k % nc) * pc;
    const z = oz + ((k / nc) | 0) * pc;
    h0[k] += par.ruido * F.fbm(x / par.ruidoEscala, z / par.ruidoEscala, s, 3) * Math.min(1, E[k] / 60);
  }
  const h = evoluir({ n: nc, passo: pc, h0, alvo, base, iteracoes: par.iteracoes, K: par.K, c: par.c, limiar: par.limiar });
  difundir(h, nc, base, par.difusao, par.passadasDifusao);
  // relevo acima da planície; nas bases nada (mar, rio, lagoa e planície), salvo o leito do curso de cima (base 2), o
  // pé submerso dos maciços (base 3) e a borda presa do detalhe
  const rel = new Float32Array(NC);
  for (let k = 0; k < NC; k++) {
    const i = k % nc;
    const j = (k / nc) | 0;
    const naBorda = borda && (i === 0 || j === 0 || i === nc - 1 || j === nc - 1);
    if (base[k] === 1 && !naBorda) continue;
    const v = h[k] - P[k];
    rel[k] = v > 0 ? v : 0;
  }
  calibrarMorros(mapa, C, F, rel, P, G);
  return { rel, E };
}

/** Codifica e confere a volta (o erro máximo tem de ficar em meia unidade da escala). */
function empacotar(rel, n, par) {
  const cod = codificar(rel, n, par.k);
  const volta = decodificar(cod);
  let erroMax = 0;
  for (let k = 0; k < n * n; k++) erroMax = Math.max(erroMax, Math.abs(volta[k] - rel[k]));
  return { cod, volta, erroMax };
}

/**
 * O assado inteiro: o relevo grosso (32 m) de todo o mapa e o detalhe (16 m) sobre a área inicial e os morros dela,
 * com a borda presa no grosso. `F` são as ferramentas de terreno.js. Devolve o objeto do módulo gerado e as medidas.
 */
export function assarRelevo(mapa, C, F, par = PARAMETROS) {
  const grossa = assarGrade(mapa, C, F, par, C.G);
  const g = empacotar(grossa.rel, C.G.nc, par);
  const modulo = {
    mapa: mapa.id,
    versao: VERSAO_ASSADO,
    controles: hashControles(mapa, VERSAO_ASSADO),
    n: C.G.nc,
    passo: C.G.pc,
    k: g.cod.k,
    escala: g.cod.escala,
    hash: hexHash(fnv1aTipado(g.volta)),
    dados: g.cod.dados,
    detalhe: null,
  };
  let bytes = (g.cod.dados.length * 3) / 4;
  let erroMax = g.erroMax;
  let volta16 = null;
  const D = mapa.detalheRelevo;
  if (D) {
    const nd = Math.round(D.lado / D.passo) + 1;
    const GD = { nc: nd, pc: D.passo, ox: D.x0, oz: D.z0 };
    // a borda do detalhe fica no relevo grosso (a planície mais o grosso decodificado, por bilinear)
    const borda = (x, z, p) => p + F.amostrar(g.volta, C.G.nc, C.G.pc, C.G.ox, C.G.oz, x, z);
    const det = assarGrade(mapa, C, F, { ...par, ...(par.detalhe ?? {}) }, GD, borda);
    const d = empacotar(det.rel, nd, par);
    modulo.detalhe = { x0: D.x0, z0: D.z0, n: nd, passo: D.passo, k: d.cod.k, escala: d.cod.escala, hash: hexHash(fnv1aTipado(d.volta)), dados: d.cod.dados };
    bytes += (d.cod.dados.length * 3) / 4;
    erroMax = Math.max(erroMax, d.erroMax);
    volta16 = d.volta;
  }
  return {
    modulo,
    medidas: { bytes: Math.round(bytes), erroMax },
    rel: g.volta,
    rel16: volta16,
    E: grossa.E,
  };
}
