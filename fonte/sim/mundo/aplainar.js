// Aplainar puro e comutativo sobre as formas de sim.formas (D5) e o chão do espelho sempre em dia (dona: S1a, depois S1b).
//
// Cada amostra sai só da grade base (a do mapa) e das formas que a tocam: vale a de menor distância ao núcleo
// (empate: tipo; entre duas vias, o eixo mais perto; depois ref, depois cota); até a faixa plana de 8 m vale a cota
// dela; depois a base volta por smoothstep em 16 m. Como a escolha é uma ordem total, a ordem de registro não muda
// nenhum bit (A2). O eixo mais perto entre vias (S1b) é o que põe o chão 0,15 m abaixo da pista também junto dos nós:
// ali os núcleos de duas arestas se cobrem, e a de ref menor levava a cota do nó até a pista da vizinha em rampa.
//
// Ligação: o núcleo marca o retângulo sujo de cada forma registrada ou removida por sim.formas.marcarRet; este módulo
// encadeia nessa função e refaz o retângulo na hora (a UI e a S1b leem alturaEm logo depois do comando, mesmo
// pausado). Ao carregar, refaz a grade inteira a partir da base e das formas do save.
import { FORMA } from '../../contratos/interno.js';
import { amostrasNoRetangulo } from '../../comum/altura.js';
import { distSegmento, distPoligono } from '../../comum/vetor.js';
import { smoothstep } from '../../comum/util.js';
import { ponto, direcao, tabelaArco, tDoArco } from '../../comum/bezier.js';
import { VIAS, VIAS_ORDEM } from '../../data/vias.js';
import { refDe } from '../../contratos/espelho.js';
import { ARESTA } from '../../contratos/flags.js';
import { terrenoBase } from './terreno.js';

/** Alcance de uma forma além do núcleo: faixa plana de 8 m e transição de 16 m. */
export const ALCANCE = FORMA.faixaPlana + FORMA.transicao;

/** O chão no núcleo de uma via fica 0,15 m abaixo da pista (D5). */
export const CHAO_ABAIXO_DA_PISTA = 0.15;

const SEG = { d: 0, t: 0 };

/**
 * Distância de (x, z) ao núcleo de uma forma normalizada (d), a distância ao eixo da via (r; nas outras formas, igual a
 * d) e a cota do núcleo no ponto mais perto (a mesma conta do aplainar de referência da F0).
 */
export function distanciaForma(f, x, z, out = { d: 0, r: 0, cota: 0 }) {
  if (f.tipo === 'via') {
    const e = f.eixo;
    let melhor = Infinity;
    let cota = e[2];
    for (let k = 0; k + 5 < e.length; k += 3) {
      distSegmento(x, z, e[k], e[k + 1], e[k + 3], e[k + 4], SEG);
      if (SEG.d < melhor) {
        melhor = SEG.d;
        cota = e[k + 2] + (e[k + 5] - e[k + 2]) * SEG.t;
      }
    }
    out.d = Math.max(0, melhor - f.meiaLargura);
    out.r = melhor;
    out.cota = cota;
  } else {
    out.d = distPoligono(x, z, f.contorno);
    out.r = out.d;
    out.cota = f.cota;
  }
  return out;
}

const tocaRet = (f, x0, z0, x1, z1) => {
  const c = f.caixa;
  return c[0] - ALCANCE <= x1 && c[2] + ALCANCE >= x0 && c[1] - ALCANCE <= z1 && c[3] + ALCANCE >= z0;
};

/**
 * Aplainar puro: escreve em `saida` as amostras do retângulo [x0, z0, x1, z1] a partir de `base` e das `formas`
 * (normalizadas, em qualquer ordem). Fora do retângulo nada muda.
 * @param {{ n: number, passo: number, origem: number[], altura: Float32Array }} base
 * @param {Iterable<object>} formas
 * @param {number[]} ret
 * @param {Float32Array} saida
 */
export function aplainar(base, formas, ret, saida) {
  const { n, passo } = base;
  const [ox, oz] = base.origem;
  const [i0, j0, i1, j1] = amostrasNoRetangulo(n, passo, ox, oz, ret[0], ret[1], ret[2], ret[3]);
  // as amostras vão até a borda arredondada para fora: as candidatas são as que tocam essas amostras, não só o
  // retângulo pedido (senão uma amostra da borda sairia sem a forma que só chega nela)
  const rx0 = ox + i0 * passo;
  const rz0 = oz + j0 * passo;
  const rx1 = ox + i1 * passo;
  const rz1 = oz + j1 * passo;
  const cand = [];
  for (const f of formas) if (tocaRet(f, rx0, rz0, rx1, rz1)) cand.push(f);
  const o = { d: 0, r: 0, cota: 0 };
  const alt = base.altura;
  for (let j = j0; j <= j1; j++) {
    const z = oz + j * passo;
    // só as formas desta linha
    const linha = cand.length > 4 ? cand.filter((f) => f.caixa[1] - ALCANCE <= z && f.caixa[3] + ALCANCE >= z) : cand;
    for (let i = i0; i <= i1; i++) {
      const x = ox + i * passo;
      const k = j * n + i;
      let md = Infinity;
      let mt = 0;
      let me = 0;
      let mr = 0;
      let mc = 0;
      for (const f of linha) {
        const c = f.caixa;
        if (x < c[0] - ALCANCE || x > c[2] + ALCANCE || z < c[1] - ALCANCE || z > c[3] + ALCANCE) continue;
        distanciaForma(f, x, z, o);
        if (o.d >= ALCANCE) continue;
        const t = FORMA.ordemTipo[f.tipo];
        if (
          o.d < md ||
          (o.d === md && (t < mt || (t === mt && (o.r < me || (o.r === me && (f.ref < mr || (f.ref === mr && o.cota < mc)))))))
        ) {
          md = o.d;
          mt = t;
          me = o.r;
          mr = f.ref;
          mc = o.cota;
        }
      }
      const hb = alt[k];
      if (md === Infinity) saida[k] = hb;
      else if (md <= FORMA.faixaPlana) saida[k] = mc;
      else saida[k] = mc + (hb - mc) * smoothstep(FORMA.faixaPlana, ALCANCE, md);
    }
  }
  return saida;
}

/**
 * Refaz a grade inteira: base mais todas as formas, em ladrilhos de 512 m (só onde há forma; o resto é a base).
 */
export function aplainarTudo(base, formas, saida) {
  saida.set(base.altura);
  const lista = [...formas];
  if (!lista.length) return saida;
  const [ox, oz] = base.origem;
  const lado = (base.n - 1) * base.passo;
  const L = 512;
  for (let z0 = oz; z0 < oz + lado; z0 += L) {
    for (let x0 = ox; x0 < ox + lado; x0 += L) {
      const x1 = x0 + L - base.passo;
      const z1 = z0 + L - base.passo;
      const aqui = lista.filter((f) => tocaRet(f, x0, z0, x1, z1));
      if (aqui.length) aplainar(base, aqui, [x0, z0, x1 + base.passo, z1 + base.passo], saida);
    }
  }
  return saida;
}

// ------------------------------------------------------------------------------------------------ formas das vias

/**
 * Patamar do cruzamento (S1b): na ponta de uma aresta que chega num nó de cruzamento (raio do nó > 0), a pista segue
 * plana na cota do nó até o raio mais 8 m e só então sobe ou desce. Com outra via em ângulo agudo, o patamar vai até as
 * duas pistas se separarem e mais 8 m medidos na perpendicular: onde as pistas se cobrem, as duas ficam na mesma cota.
 * Pontas soltas e nós de grau 2 em linha reta (raio 0) não têm patamar.
 */
export const PATAMAR = 8;

/** Teto do patamar (ângulo de 30 graus entre avenidas grandes). */
export const PATAMAR_MAX = 64;

/**
 * Comprimento do patamar de uma via de meia largura `meia` num nó de raio `raio`.
 * @param {ArrayLike<number>} outras  pares [meia, cos] das outras vias do nó (cos do ângulo entre as saídas)
 */
export function comprimentoPatamar(raio, meia, outras = []) {
  if (!(raio > 0)) return 0;
  let p = raio + PATAMAR;
  for (let k = 0; k + 1 < outras.length; k += 2) {
    const mo = outras[k];
    const c = outras[k + 1] < -1 ? -1 : outras[k + 1] > 1 ? 1 : outras[k + 1];
    const sen = Math.sqrt(1 - c * c);
    if (sen < 0.2) continue; // quase em linha: seguem juntas (grau 2) ou em sentidos opostos
    // as bordas das duas pistas se cruzam a s1 desta via e s2 da outra (as duas positivas: as pistas se cobrem)
    const s1 = (mo + meia * c) / sen;
    const s2 = (meia + mo * c) / sen;
    if (s1 <= 0 || s2 <= 0) continue;
    const q = s1 + PATAMAR / sen;
    if (q > p) p = q;
  }
  return p < PATAMAR_MAX ? p : PATAMAR_MAX;
}

const D1 = [0, 0];
const D2 = [0, 0];

/** Direção (unitária) com que a aresta e sai do nó n. */
function saidaDe(A, e, n, out) {
  if (A.a[e] === n) return direcao(A.p, 0, out, 8 * e);
  direcao(A.p, 1, out, 8 * e);
  out[0] = -out[0];
  out[1] = -out[1];
  return out;
}

const meiaDe = (A, e) => VIAS[VIAS_ORDEM[A.tipo[e]]].largura / 2;

/** Patamar da aresta e na ponta do nó n: pelo raio do nó e pelos ângulos com as outras vias dele. */
export function patamarNaPonta(G, e, n) {
  const r = G.nos.raio[n];
  if (!(r > 0)) return 0;
  const A = G.arestas;
  const L = G.nos.lig;
  saidaDe(A, e, n, D1);
  const outras = [];
  for (let k = 0; k < 6; k++) {
    const o = L[6 * n + k];
    if (o < 0 || o === e || !A.viva[o]) continue;
    saidaDe(A, o, n, D2);
    outras.push(meiaDe(A, o), D1[0] * D2[0] + D1[1] * D2[1]);
  }
  return comprimentoPatamar(r, meiaDe(A, e), outras);
}

/**
 * Patamares [pa, pb] de uma aresta de comprimento comp: sobra ao menos 1 m de rampa no meio e, com o desnível dy entre
 * as pontas, a rampa não passa do declive gMax do tipo (o patamar encolhe; se o cruzamento ficar desnivelado demais, a
 * ferramenta recusa com 'declive').
 */
export function patamares(comp, pa, pb, dy = 0, gMax = Infinity) {
  let lim = Math.max(0, comp - 1);
  if (dy !== 0 && gMax > 0 && gMax < Infinity) lim = Math.min(lim, Math.max(0, comp - Math.abs(dy) / gMax));
  if (pa + pb > lim) {
    const k = lim / (pa + pb);
    return [pa * k, pb * k];
  }
  return [pa, pb];
}

/** Cota da pista no arco s: plana nos patamares, linear no arco entre eles. */
export function cotaDaPista(y0, y1, comp, pa, pb, s) {
  const m = comp - pa - pb;
  if (!(m > 0)) return s < comp / 2 ? y0 : y1;
  const f = (s - pa) / m;
  return y0 + (y1 - y0) * (f < 0 ? 0 : f > 1 ? 1 : f);
}

/** Patamares da aresta e (pelos nós do grafo, com o declive do tipo). */
export function patamaresDa(G, e) {
  const A = G.arestas;
  const dy = A.y[2 * e + 1] - A.y[2 * e];
  return patamares(A.arco[17 * e + 16], patamarNaPonta(G, e, A.a[e]), patamarNaPonta(G, e, A.b[e]), dy, VIAS[VIAS_ORDEM[A.tipo[e]]].declive);
}

/** Cota da pista da aresta e no comprimento de arco s (com os patamares). */
export function pistaDaAresta(G, e, s) {
  const A = G.arestas;
  const [pa, pb] = patamaresDa(G, e);
  return cotaDaPista(A.y[2 * e], A.y[2 * e + 1], A.arco[17 * e + 16], pa, pb, s);
}

/** Declive da rampa da aresta (sinal de a para b) e os patamares: { g, pa, pb, comp }. */
export function rampaDa(G, e) {
  const A = G.arestas;
  const comp = A.arco[17 * e + 16];
  const [pa, pb] = patamaresDa(G, e);
  const m = comp - pa - pb;
  return { g: m > 0 ? (A.y[2 * e + 1] - A.y[2 * e]) / m : 0, pa, pb, comp };
}

// Dobra côncava do greide (onde o declive aumenta: pé de rampa, fim de patamar, vale entre duas rampas): entre duas
// amostras da grade de 8 m a interpolação bilinear passa acima da dobra em até 8/4 = 2 vezes a mudança de declive
// (D4). A forma rebaixa o chão ali o que passa da folga, até 12 m da dobra (as amostras das células que ela cruza), e
// volta ao normal nos 12 m seguintes: o chão fica ao menos 5 cm abaixo da pista em toda a seção.
const PASSO_GRADE = 8;
/** O chão fica ao menos isto abaixo da pista em toda a seção (m). */
export const FOLGA_CHAO = 0.05;
const ALCANCE_DOBRA = 12;
const VOLTA_DOBRA = 12;

/** Declive com que a outra aresta de um nó de grau 2 sem raio sai dele (0 numa ponta solta ou ponte). */
function saidaDoGreide(G, e, n) {
  const N = G.nos;
  const A = G.arestas;
  if (N.grau[n] !== 2 || N.raio[n] > 0) return 0;
  for (let k = 0; k < 6; k++) {
    const o = N.lig[6 * n + k];
    if (o < 0 || o === e || !A.viva[o]) continue;
    if (A.flags[o] & ARESTA.PONTE) return 0;
    const { g } = rampaDa(G, o);
    return A.a[o] === n ? g : -g;
  }
  return 0;
}

/**
 * Dobras côncavas da pista da aresta: [{ s, rebaixo }] com o rebaixo do chão no arco s (m).
 * @param {number} abaixo  o chão fica isto abaixo da pista fora das dobras
 */
export function dobrasDa(G, e, abaixo = CHAO_ABAIXO_DA_PISTA) {
  const A = G.arestas;
  const { g, pa, pb, comp } = rampaDa(G, e);
  const folga = abaixo - FOLGA_CHAO;
  const out = [];
  const juntar = (s, delta) => {
    const r = (PASSO_GRADE / 4) * delta - folga + 0.01;
    if (r > 0) out.push({ s, rebaixo: r });
  };
  // na ponta a: fim do patamar, ou o nó (a outra via de um nó de grau 2 reto, ou o chão plano além da ponta)
  if (pa > 0) juntar(pa, g);
  else juntar(0, g + saidaDoGreide(G, e, A.a[e]));
  if (pb > 0) juntar(comp - pb, -g);
  else juntar(comp, -g + saidaDoGreide(G, e, A.b[e]));
  // as dobras da vizinha de um nó de grau 2 sem raio até 24 m do nó: as amostras em volta do nó podem ser dela ou desta
  const N = G.nos;
  for (const [n, fora] of [[A.a[e], (x) => -x], [A.b[e], (x) => comp + x]]) {
    if (N.grau[n] !== 2 || N.raio[n] > 0) continue;
    for (let k = 0; k < 6; k++) {
      const o = N.lig[6 * n + k];
      if (o < 0 || o === e || !A.viva[o] || A.flags[o] & ARESTA.PONTE) continue;
      const ro = rampaDa(G, o);
      const doNo = (so) => (A.a[o] === n ? so : ro.comp - so);
      const internas = [];
      if (ro.pa > 0) internas.push([ro.pa, ro.g]);
      if (ro.pb > 0) internas.push([ro.comp - ro.pb, -ro.g]);
      for (const [so, delta] of internas) {
        const dist = doNo(so);
        const r = (PASSO_GRADE / 4) * delta - folga + 0.01;
        if (r > 0 && dist < ALCANCE_DOBRA + VOLTA_DOBRA) out.push({ s: fora(dist), rebaixo: r });
      }
    }
  }
  return out;
}

/**
 * Forma do aplainar de uma aresta do grafo: o eixo da Bézier a cada ~8 m (e nas pontas dos patamares e das dobras), com
 * a cota da pista (pistaDaAresta) menos 0,15 m, rebaixada perto das dobras côncavas, e a meia largura do tipo. Ponte
 * (flag PONTE) não tem forma: o tabuleiro fica no alto.
 */
export function formaDaAresta(G, e, { abaixo = CHAO_ABAIXO_DA_PISTA } = {}) {
  const A = G.arestas;
  const tipo = VIAS[VIAS_ORDEM[A.tipo[e]]];
  const p = A.p.subarray(8 * e, 8 * e + 8);
  const tab = tabelaArco(p);
  const comp = tab[16];
  const [pa, pb] = patamaresDa(G, e);
  const dobras = dobrasDa(G, e, abaixo);
  const m = Math.max(1, Math.ceil(comp / 8));
  const ss = [];
  for (let k = 0; k <= m; k++) ss.push((comp * k) / m);
  const extra = [pa, comp - pb];
  for (const d of dobras) {
    extra.push(d.s);
    for (const u of [ALCANCE_DOBRA, ALCANCE_DOBRA + VOLTA_DOBRA]) extra.push(d.s - u, d.s + u);
  }
  for (const x of extra) if (x > 0.05 && x < comp - 0.05 && !ss.some((v) => Math.abs(v - x) < 0.05)) ss.push(x);
  ss.sort((a, b) => a - b);
  const eixo = new Float64Array(ss.length * 3);
  const y0 = A.y[2 * e];
  const y1 = A.y[2 * e + 1];
  const q = [0, 0];
  ss.forEach((s, k) => {
    ponto(p, k === 0 ? 0 : k === ss.length - 1 ? 1 : tDoArco(tab, s), q);
    let rb = 0;
    for (const d of dobras) {
      const dist = Math.abs(s - d.s);
      const w = dist <= ALCANCE_DOBRA ? 1 : dist >= ALCANCE_DOBRA + VOLTA_DOBRA ? 0 : 1 - (dist - ALCANCE_DOBRA) / VOLTA_DOBRA;
      if (d.rebaixo * w > rb) rb = d.rebaixo * w;
    }
    eixo[3 * k] = q[0];
    eixo[3 * k + 1] = q[1];
    eixo[3 * k + 2] = cotaDaPista(y0, y1, comp, pa, pb, s) - abaixo - rb;
  });
  return { tipo: 'via', ref: refDe(e, A.ger[e]), eixo, meiaLargura: tipo.largura / 2 };
}

// ------------------------------------------------------------------------------------------------ registro

/** Refaz um retângulo do chão do espelho agora (usado pelo encadeamento em sim.formas.marcarRet). */
export function refazerRetangulo(sim, ret) {
  const tb = terrenoBase(sim);
  const T = sim.espelho.terreno;
  if (!tb || !T) return;
  aplainar(tb.base, sim.formas.porId.values(), ret, T.altura);
}

/** Refaz o chão inteiro (carregar um save). */
export function refazerTudo(sim) {
  const tb = terrenoBase(sim);
  const T = sim.espelho.terreno;
  if (!tb || !T) return;
  aplainarTudo(tb.base, sim.formas.porId.values(), T.altura);
  sim.mudancas.tudo('terreno');
}

/**
 * Liga o aplainar à simulação: toda forma registrada ou removida refaz o seu retângulo na hora; carregar refaz tudo.
 */
export function registrar(sim) {
  const marcar = sim.formas.marcarRet;
  sim.formas.marcarRet = (x0, z0, x1, z1) => {
    refazerRetangulo(sim, [x0, z0, x1, z1]);
    if (marcar) marcar(x0, z0, x1, z1);
  };
  sim.aoCarregar(() => refazerTudo(sim));
  // se já houver formas (montagem fora da ordem), o chão sai em dia desde já
  if (sim.formas.tamanho) refazerTudo(sim);
}
