// Blocos e células de zona de 8 m (seção 6.1 do desenho da simulação; dona: S1b). Toda aresta de via com calçada tem
// um bloco de cada lado: colunas de 8 m ao longo do arco e 6 linhas de fundo. A coluna k de uma aresta vai de
// fase + 8k a fase + 8k + 8 metros do nó a (a coluna `fase` da aresta), então dividir a aresta não mexe nas células.
// Os cortes do cruzamento não tiram colunas: tira a regra de proximidade (célula a menos de meia largura + 4 m de outra
// via é inválida), e o lado sem via que chega segue até o nó. Célula inválida também na água, com o chão variando mais
// de 4 m, fora dos ladrilhos da Holding, na gleba, no lado de dentro de curva fechada e sobre prédio que não é dela.
// Esquina: duas células de blocos diferentes a menos de 7 m, fica a de linha menor (empate: o bloco mais antigo); a
// célula com prédio vem antes de todas. O motivo de cada célula inválida fica na coluna `motivo` (bits de MOTIVO).
//
// Mudou a via: as arestas que mudaram geram as células de novo, a pintura passa para a célula nova mais perto (até
// 4 m), o prédio volta para as células que cobrem a planta dele e tudo num raio de 60 m é revalidado. Prédio que perde
// as células é demolido (obra de via) ou fica sem acesso (via demolida; volta a ligar quando a via volta).
import { tDoArco, ponto, direcao } from '../../comum/bezier.js';
import { alturaEm } from '../../comum/altura.js';
import { sen, cos, hipot, clamp } from '../../comum/util.js';
import { angDaCelula, CELULA_M, LINHAS_BLOCO } from '../../contratos/espelho.js';
import { CELULA, AGUA, ARESTA, PREDIO } from '../../contratos/flags.js';
import { REGRAS_CELULAS, REGRAS_VIAS } from '../../data/vias.js';
import { aguaEm } from '../mundo/terreno.js';
import { daHolding } from '../mundo/ladrilhos.js';
import {
  tipoVia, eixoDa, distEixo, naGleba, prediosNaCaixa, pontoNoPredio, curvaturaEm, MEIA_MAX, derivados,
} from '../vias/validar.js';

/** Bits de celulas.motivo (por que a célula é inválida). */
export const MOTIVO = Object.freeze({
  AGUA: 1, DECLIVE: 2, LADRILHO: 4, GLEBA: 8, VIA: 16, CURVA: 32, PREDIO: 64, ESQUINA: 128,
});
const GEO = 0xff & ~(MOTIVO.PREDIO | MOTIVO.ESQUINA);

// ------------------------------------------------------------------------------------------------ índice derivado

const PASSO_B = 16;
const LADO_B = 512;
const ORIGEM = -4096;

const baldeDe = (x, z) => clamp(Math.floor((x - ORIGEM) / PASSO_B), 0, LADO_B - 1) + LADO_B * clamp(Math.floor((z - ORIGEM) / PASSO_B), 0, LADO_B - 1);

/** Índice das células (baldes de 16 m e lista por aresta). Derivado: refeito ao carregar ou se a tabela mudou por fora. */
function indice(sim) {
  const C = sim.tabelas.celulas;
  const d = derivados(sim);
  let ix = d.celulas;
  if (!ix) {
    ix = { cabeca: new Int32Array(LADO_B * LADO_B).fill(-1), prox: new Int32Array(0), balde: new Int32Array(0), porAresta: new Map(), vivas: 0, sujo: true };
    d.celulas = ix;
  }
  garantir(ix, C.cap);
  if (ix.sujo || ix.vivas !== C.vivos) {
    ix.cabeca.fill(-1);
    ix.porAresta.clear();
    ix.balde.fill(-1);
    ix.vivas = 0;
    for (let c = 0; c < C.n; c++) if (C.viva[c]) inserir(sim, ix, c);
    ix.sujo = false;
  }
  return ix;
}

function garantir(ix, cap) {
  if (ix.prox.length >= cap) return;
  const p = new Int32Array(cap).fill(-1);
  p.set(ix.prox);
  const b = new Int32Array(cap).fill(-1);
  b.set(ix.balde);
  ix.prox = p;
  ix.balde = b;
}

function inserir(sim, ix, c) {
  const C = sim.tabelas.celulas;
  garantir(ix, C.cap);
  const b = baldeDe(C.x[c], C.z[c]);
  ix.balde[c] = b;
  ix.prox[c] = ix.cabeca[b];
  ix.cabeca[b] = c;
  const e = C.aresta[c];
  let l = ix.porAresta.get(e);
  if (!l) ix.porAresta.set(e, (l = []));
  l.push(c);
  ix.vivas++;
}

function tirar(ix, c, e) {
  const b = ix.balde[c];
  if (b < 0) return;
  let ant = -1;
  for (let k = ix.cabeca[b]; k >= 0; k = ix.prox[k]) {
    if (k === c) {
      if (ant < 0) ix.cabeca[b] = ix.prox[k];
      else ix.prox[ant] = ix.prox[k];
      break;
    }
    ant = k;
  }
  ix.balde[c] = -1;
  ix.prox[c] = -1;
  const l = ix.porAresta.get(e);
  if (l) {
    const i = l.indexOf(c);
    if (i >= 0) l.splice(i, 1);
    if (!l.length) ix.porAresta.delete(e);
  }
  ix.vivas--;
}

/** Pede que o índice das células seja refeito (carregar). */
export function refazerIndice(sim) {
  const d = derivados(sim);
  if (d.celulas) d.celulas.sujo = true;
}

/** Células (idx) de uma aresta, em ordem de criação (cópia). */
export function celulasDaAresta(sim, e) {
  const ix = indice(sim);
  return [...(ix.porAresta.get(e) ?? [])];
}

/** Células vivas com o centro em [x0, z0, x1, z1], em ordem de idx. */
export function celulasNaCaixa(sim, x0, z0, x1, z1) {
  const ix = indice(sim);
  const C = sim.tabelas.celulas;
  const i0 = clamp(Math.floor((x0 - ORIGEM) / PASSO_B), 0, LADO_B - 1);
  const i1 = clamp(Math.floor((x1 - ORIGEM) / PASSO_B), 0, LADO_B - 1);
  const j0 = clamp(Math.floor((z0 - ORIGEM) / PASSO_B), 0, LADO_B - 1);
  const j1 = clamp(Math.floor((z1 - ORIGEM) / PASSO_B), 0, LADO_B - 1);
  const out = [];
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      for (let c = ix.cabeca[j * LADO_B + i]; c >= 0; c = ix.prox[c]) {
        const x = C.x[c];
        const z = C.z[c];
        if (x >= x0 && x <= x1 && z >= z0 && z <= z1) out.push(c);
      }
    }
  }
  return out.sort((a, b) => a - b);
}

/** Células com o prédio i (pela planta dele), em ordem de idx. */
export function celulasDoPredio(sim, i) {
  const P = sim.tabelas.predios;
  const C = sim.tabelas.celulas;
  const r = (P.w[i] + P.d[i]) / 2 + 8;
  return celulasNaCaixa(sim, P.x[i] - r, P.z[i] - r, P.x[i] + r, P.z[i] + r).filter((c) => C.predio[c] === i);
}

// ------------------------------------------------------------------------------------------------ geração

/** true se a aresta tem blocos de zona: tipo com calçada e zona, fora da rodovia, das pontes e da Arcologia. */
export function temBlocos(sim, e) {
  const A = sim.tabelas.arestas;
  if (!A.viva[e]) return false;
  const tipo = tipoVia(A.tipo[e]);
  return !!tipo?.zona && !(A.flags[e] & (ARESTA.ARCOLOGIA | ARESTA.RODOVIA | ARESTA.PONTE));
}

/** Fase da aresta em [0, 8). */
const faseDa = (A, e) => {
  const f = A.fase ? A.fase[e] : 0;
  const m = f % CELULA_M;
  return m < 0 ? m + CELULA_M : m;
};

/** Parâmetro t do centro da coluna k da aresta e. */
function tDaColuna(A, e, k) {
  return tDoArco(A.arco.subarray(17 * e, 17 * e + 17), faseDa(A, e) + CELULA_M * k + CELULA_M / 2);
}

/**
 * Cria as células dos dois blocos da aresta (lado +1 primeiro, colunas e linhas em ordem), livres e sem zona; a
 * validação vem depois. Devolve os idx.
 */
function gerarCelulas(sim, ix, e) {
  const A = sim.tabelas.arestas;
  const C = sim.tabelas.celulas;
  if (!temBlocos(sim, e)) return [];
  const meia = tipoVia(A.tipo[e]).largura / 2;
  const comp = A.arco[17 * e + 16];
  const fase = faseDa(A, e);
  const ncol = Math.max(0, Math.floor((comp - fase) / CELULA_M + 1e-6));
  const q = [0, 0];
  const d = [0, 0];
  const out = [];
  for (const lado of [1, -1]) {
    for (let k = 0; k < ncol; k++) {
      const t = tDaColuna(A, e, k);
      ponto(A.p, t, q, 8 * e);
      direcao(A.p, t, d, 8 * e);
      const lx = -d[1] * lado;
      const lz = d[0] * lado;
      const ang = angDaCelula(d[0], d[1], lado);
      for (let r = 0; r < LINHAS_BLOCO; r++) {
        const off = meia + CELULA_M / 2 + r * CELULA_M;
        const c = C.alocar();
        if (c < 0) return out; // teto das células: o resto do bloco fica sem célula
        const x = q[0] + lx * off;
        const z = q[1] + lz * off;
        C.x[c] = x;
        C.z[c] = z;
        C.y[c] = sim.alturaEm(x, z);
        C.ang[c] = ang;
        C.aresta[c] = e;
        C.lado[c] = lado;
        C.linha[c] = r;
        C.coluna[c] = k;
        C.estado[c] = CELULA.LIVRE;
        C.predio[c] = -1;
        C.marcar(c);
        inserir(sim, ix, c);
        out.push(c);
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ validação

const DE = { d: 0, s: 0 };

/** Bits geométricos da célula (água, declive, ladrilho, gleba, via, curva), sem prédio nem esquina. */
function motivoGeo(sim, c) {
  const C = sim.tabelas.celulas;
  const A = sim.tabelas.arestas;
  const T = sim.espelho.terreno;
  const x = C.x[c];
  const z = C.z[c];
  const fx = sen(C.ang[c]) * 4;
  const fz = cos(C.ang[c]) * 4;
  let m = 0;
  // água e declive: centro e os 4 cantos do quadrado de 8 m
  let hmin = Infinity;
  let hmax = -Infinity;
  for (let k = 0; k < 5; k++) {
    const a = k === 0 ? 0 : k === 1 || k === 2 ? 1 : -1;
    const b = k === 0 ? 0 : k === 1 || k === 3 ? 1 : -1;
    const px = x + a * fx + b * fz;
    const pz = z + a * fz - b * fx;
    if (T?.agua && aguaEm(T, px, pz) !== AGUA.TERRA) m |= MOTIVO.AGUA;
    if (k > 0) {
      const h = T ? alturaEm(T, px, pz) : 0;
      if (h < hmin) hmin = h;
      if (h > hmax) hmax = h;
    }
  }
  if (hmax - hmin > REGRAS_CELULAS.desnivelMax) m |= MOTIVO.DECLIVE;
  if (sim.espelho.ladrilhos && !daHolding(sim, x, z)) m |= MOTIVO.LADRILHO;
  if (naGleba(sim, x, z, REGRAS_CELULAS.folgaGleba)) m |= MOTIVO.GLEBA;
  // outra via perto
  const e = C.aresta[c];
  const R = MEIA_MAX + REGRAS_CELULAS.folgaVia;
  const ids = sim.grafo.gradeArestas.consultar(x - R, z - R, x + R, z + R);
  for (let k = 0; k < ids.length; k++) {
    const o = ids[k];
    if (o === e || !A.viva[o]) continue;
    const lim = tipoVia(A.tipo[o]).largura / 2 + REGRAS_CELULAS.folgaVia;
    const eo = eixoDa(sim, o);
    const cx = eo.caixa;
    if (x < cx[0] - lim || x > cx[2] + lim || z < cx[1] - lim || z > cx[3] + lim) continue;
    distEixo(eo, x, z, DE, lim);
    if (DE.d < lim - 1e-6) {
      m |= MOTIVO.VIA;
      break;
    }
  }
  // lado de dentro de curva fechada, ou mais perto de outro trecho da própria via
  if (e >= 0 && A.viva[e]) {
    const meia = tipoVia(A.tipo[e]).largura / 2;
    const off = meia + CELULA_M / 2 + C.linha[c] * CELULA_M;
    const k = curvaturaEm(A.p, tDaColuna(A, e, C.coluna[c]), 8 * e) * C.lado[c];
    if (k > 0 && 1 / k < off + REGRAS_CELULAS.folgaCurva) m |= MOTIVO.CURVA;
    else {
      distEixo(eixoDa(sim, e), x, z, DE);
      if (DE.d < off - 1.5) m |= MOTIVO.CURVA;
    }
  }
  return m;
}

/** true se a célula c está sobre um prédio que não é dela (centro a menos de 3 m da planta). */
function sobrePredio(sim, c) {
  const C = sim.tabelas.celulas;
  const P = sim.tabelas.predios;
  const x = C.x[c];
  const z = C.z[c];
  const f = REGRAS_CELULAS.folgaPredio;
  for (const i of prediosNaCaixa(sim, x - f, z - f, x + f, z + f)) {
    if (i === C.predio[c]) continue;
    if (pontoNoPredio(P, i, x, z, f)) return true;
  }
  return false;
}

// prioridade na esquina: a célula com prédio, depois a de linha menor, o bloco mais antigo, a aresta e o lado
function antes(sim, c, o) {
  const C = sim.tabelas.celulas;
  const A = sim.tabelas.arestas;
  const oc = C.predio[c] >= 0;
  const oo = C.predio[o] >= 0;
  if (oc !== oo) return oc;
  if (C.linha[c] !== C.linha[o]) return C.linha[c] < C.linha[o];
  const ec = C.aresta[c];
  const eo = C.aresta[o];
  if (ec !== eo) {
    const ic = A.idade[ec];
    const io = A.idade[eo];
    if (ic !== io) return ic < io;
    return ec < eo;
  }
  if (C.lado[c] !== C.lado[o]) return C.lado[c] > C.lado[o];
  return c < o;
}

/** Heap de células pela prioridade da esquina. */
class Fila {
  constructor(sim) {
    this.sim = sim;
    this.h = [];
  }
  get vazia() {
    return this.h.length === 0;
  }
  push(c) {
    const h = this.h;
    h.push(c);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!antes(this.sim, h[i], h[p])) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }
  pop() {
    const h = this.h;
    const top = h[0];
    const ult = h.pop();
    if (h.length) {
      h[0] = ult;
      let i = 0;
      for (;;) {
        const a = 2 * i + 1;
        const b = a + 1;
        let m = i;
        if (a < h.length && antes(this.sim, h[a], h[m])) m = a;
        if (b < h.length && antes(this.sim, h[b], h[m])) m = b;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    return top;
  }
}

/** Vizinhas de esquina de c: células de outro bloco a menos de 7 m. */
function vizinhasDeEsquina(sim, ix, c, out) {
  const C = sim.tabelas.celulas;
  const R = REGRAS_CELULAS.esquina;
  const x = C.x[c];
  const z = C.z[c];
  const i0 = clamp(Math.floor((x - R - ORIGEM) / PASSO_B), 0, LADO_B - 1);
  const i1 = clamp(Math.floor((x + R - ORIGEM) / PASSO_B), 0, LADO_B - 1);
  const j0 = clamp(Math.floor((z - R - ORIGEM) / PASSO_B), 0, LADO_B - 1);
  const j1 = clamp(Math.floor((z + R - ORIGEM) / PASSO_B), 0, LADO_B - 1);
  out.length = 0;
  const e = C.aresta[c];
  const lado = C.lado[c];
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      for (let o = ix.cabeca[j * LADO_B + i]; o >= 0; o = ix.prox[o]) {
        if (o === c || (C.aresta[o] === e && C.lado[o] === lado)) continue;
        if (hipot(C.x[o] - x, C.z[o] - z) < R) out.push(o);
      }
    }
  }
  return out;
}

function estadoDe(C, c) {
  if (C.predio[c] >= 0) return CELULA.OCUPADA;
  return C.motivo[c] ? CELULA.INVALIDA : CELULA.LIVRE;
}

/**
 * Regra da esquina sobre as células dadas (e as que mudarem por causa delas): em ordem de prioridade, a célula fica
 * se é válida e nenhuma vizinha de outro bloco que vem antes ficou.
 */
function esquinas(sim, ix, lista) {
  const C = sim.tabelas.celulas;
  const fila = new Fila(sim);
  const marca = new Map();
  for (const c of lista) {
    if (!marca.has(c)) {
      marca.set(c, 1);
      fila.push(c);
    }
  }
  const viz = [];
  while (!fila.vazia) {
    const c = fila.pop();
    const antesM = C.motivo[c];
    let m = antesM & ~MOTIVO.ESQUINA;
    if (!m && C.predio[c] < 0) {
      vizinhasDeEsquina(sim, ix, c, viz);
      for (const o of viz) {
        if (C.motivo[o] === 0 && antes(sim, o, c)) {
          m = MOTIVO.ESQUINA;
          break;
        }
      }
    }
    if (m !== antesM) {
      C.motivo[c] = m;
      // a mudança pode soltar ou prender as vizinhas que vêm depois
      vizinhasDeEsquina(sim, ix, c, viz);
      for (const o of viz) {
        if (!marca.has(o) && antes(sim, c, o)) {
          marca.set(o, 1);
          fila.push(o);
        }
      }
    }
    const est = estadoDe(C, c);
    if (C.estado[c] !== est || m !== antesM) {
      C.estado[c] = est;
      C.marcar(c);
    }
  }
}

// ------------------------------------------------------------------------------------------------ prédios

/**
 * Tira o prédio i da tabela (com a plataforma do aplainar e as células), guardando o que é preciso para desfazer.
 * @returns {{ ref: number, dados: Record<string, number[]>, formas: object[] }}
 */
export function removerPredio(sim, i) {
  const P = sim.tabelas.predios;
  const C = sim.tabelas.celulas;
  const ref = P.ref(i);
  const dados = {};
  for (const k of P.nomes) {
    const { por } = P.specs[k];
    dados[k] = Array.from(P[k].subarray(i * por, (i + 1) * por));
  }
  const formas = [];
  for (const f of sim.formas.porId.values()) {
    if (f.tipo === 'plataforma' && f.ref === ref) formas.push({ tipo: f.tipo, contorno: Array.from(f.contorno), cota: f.cota });
  }
  for (const c of celulasDoPredio(sim, i)) {
    C.predio[c] = -1;
    C.estado[c] = C.motivo[c] ? CELULA.INVALIDA : CELULA.LIVRE;
    C.marcar(c);
  }
  P.liberar(i);
  if (formas.length) sim.formas.removerRef('plataforma', ref);
  return { ref, dados, formas };
}

/** Recria um prédio guardado por removerPredio (ref nova) com a plataforma. Devolve o idx ou -1. */
export function restaurarPredio(sim, reg) {
  const P = sim.tabelas.predios;
  const i = P.alocar();
  if (i < 0) return -1;
  for (const k of P.nomes) {
    const v = reg.dados[k];
    if (!v) continue;
    const { por } = P.specs[k];
    for (let j = 0; j < por; j++) P[k][i * por + j] = v[j];
  }
  P.marcar(i);
  const ref = P.ref(i);
  for (const f of reg.formas ?? []) sim.formas.registrar({ ...f, ref });
  return i;
}

/** Solta o prédio das células (via demolida): fica sem acesso até uma via voltar a ligar. */
function soltarPredio(sim, i) {
  const P = sim.tabelas.predios;
  const C = sim.tabelas.celulas;
  for (const c of celulasDoPredio(sim, i)) {
    C.predio[c] = -1;
    C.estado[c] = C.motivo[c] ? CELULA.INVALIDA : CELULA.LIVRE;
    C.marcar(c);
  }
  P.flags[i] |= PREDIO.SEM_ACESSO;
  P.marcar(i);
}

/**
 * Liga o prédio i às células livres e válidas que cobrem a planta (mesma frente, uma célula por 8 x 8 m, com a linha 0).
 * Devolve true se ligou.
 */
function ligarPredio(sim, i, candidatas) {
  const P = sim.tabelas.predios;
  const C = sim.tabelas.celulas;
  const quer = Math.round(P.w[i] / CELULA_M) * Math.round(P.d[i] / CELULA_M);
  const fx = sen(P.rot[i]);
  const fz = cos(P.rot[i]);
  const cosMin = 0.9659258262890683; // 15 graus
  const lista = [];
  let linha0 = false;
  for (const c of candidatas) {
    if (C.predio[c] >= 0 || C.motivo[c] & GEO) continue;
    if (!pontoNoPredio(P, i, C.x[c], C.z[c], 1.5)) continue;
    if (sen(C.ang[c]) * fx + cos(C.ang[c]) * fz < cosMin) continue;
    lista.push(c);
    if (C.linha[c] === 0) linha0 = true;
  }
  if (lista.length !== quer || !linha0) return false;
  for (const c of lista) {
    C.predio[c] = i;
    C.motivo[c] = 0;
    C.estado[c] = CELULA.OCUPADA;
    C.marcar(c);
  }
  if (P.flags[i] & PREDIO.SEM_ACESSO) {
    P.flags[i] &= ~PREDIO.SEM_ACESSO;
    P.marcar(i);
  }
  return true;
}

// ------------------------------------------------------------------------------------------------ recolher e refazer

/**
 * Tira as células das arestas (antes de a aresta mudar ou sair): devolve os registros da pintura e os prédios que
 * estavam nelas.
 * @returns {{ registros: { x: number, z: number, zona: number }[], predios: Set<number> }}
 */
export function recolherCelulas(sim, arestas) {
  const ix = indice(sim);
  const C = sim.tabelas.celulas;
  const registros = [];
  const predios = new Set();
  for (const e of arestas) {
    const lista = [...(ix.porAresta.get(e) ?? [])].sort((a, b) => a - b);
    for (const c of lista) {
      if (C.zona[c]) registros.push({ x: C.x[c], z: C.z[c], zona: C.zona[c] });
      if (C.predio[c] >= 0) predios.add(C.predio[c]);
      tirar(ix, c, e);
      C.liberar(c);
    }
  }
  return { registros, predios };
}

/**
 * Refaz os blocos: gera as células das arestas `gerar`, passa a pintura dos registros, liga os prédios, revalida tudo
 * na caixa (e o que a esquina puxar) e resolve os prédios que ficaram sem célula válida.
 * @param {{ gerar?: number[], registros?: object[], predios?: Iterable<number>, caixa?: number[] | null,
 *           modo?: 'demolir' | 'soltar' }} op
 * @returns {{ demolidos: object[], soltos: number[], novas: number }}  demolidos: registros de removerPredio
 */
export function refazerBlocos(sim, { gerar = [], registros = [], predios = [], caixa = null, modo = 'demolir' } = {}) {
  const ix = indice(sim);
  const C = sim.tabelas.celulas;
  const P = sim.tabelas.predios;
  const novas = [];
  for (const e of gerar) for (const c of gerarCelulas(sim, ix, e)) novas.push(c);
  // caixa: a pedida mais a das células novas, com a vizinhança
  let [x0, z0, x1, z1] = caixa ?? [Infinity, Infinity, -Infinity, -Infinity];
  for (const c of novas) {
    if (C.x[c] < x0) x0 = C.x[c];
    if (C.x[c] > x1) x1 = C.x[c];
    if (C.z[c] < z0) z0 = C.z[c];
    if (C.z[c] > z1) z1 = C.z[c];
  }
  // pintura: cada registro vai para a célula nova mais perto (até 4 m), uma por célula
  if (registros.length && novas.length) passarPintura(sim, novas, registros);
  if (!(x0 <= x1)) return { demolidos: [], soltos: [], novas: 0 };
  const V = REGRAS_VIAS.vizinhanca;
  const area = celulasNaCaixa(sim, x0 - V, z0 - V, x1 + V, z1 + V);
  // chão e bits geométricos
  for (const c of area) {
    const y = sim.alturaEm(C.x[c], C.z[c]);
    if (C.y[c] !== Math.fround(y)) {
      C.y[c] = y;
      C.marcar(c);
    }
    C.motivo[c] = (C.motivo[c] & MOTIVO.ESQUINA) | motivoGeo(sim, c);
  }
  // prédios que estavam nas células refeitas (e os soltos na área) voltam para as células novas
  const pendentes = new Set(predios);
  for (const i of prediosNaCaixa(sim, x0 - V, z0 - V, x1 + V, z1 + V)) {
    if (P.flags[i] & PREDIO.SEM_ACESSO && P.tipo[i] === 0 && !celulasDoPredio(sim, i).length) pendentes.add(i);
  }
  const semCelula = [];
  for (const i of [...pendentes].sort((a, b) => a - b)) {
    if (i >= P.n || !P.viva[i]) continue;
    if (celulasDoPredio(sim, i).length) continue;
    const r = (P.w[i] + P.d[i]) / 2 + 8;
    const cand = celulasNaCaixa(sim, P.x[i] - r, P.z[i] - r, P.x[i] + r, P.z[i] + r);
    if (!ligarPredio(sim, i, cand)) semCelula.push(i);
  }
  // prédio sobre a célula e esquinas
  for (const c of area) if (C.predio[c] < 0 && sobrePredio(sim, c)) C.motivo[c] |= MOTIVO.PREDIO;
  esquinas(sim, ix, area);
  // prédios com célula inválida
  const ruins = new Set(semCelula.filter((i) => P.tipo[i] === 0 && !(P.flags[i] & PREDIO.SEM_ACESSO) && modo === 'demolir'));
  const soltos = [];
  for (const c of area) if (C.predio[c] >= 0 && C.motivo[c] & (GEO | MOTIVO.PREDIO)) ruins.add(C.predio[c]);
  for (const i of semCelula) if (modo === 'soltar' && !(P.flags[i] & PREDIO.SEM_ACESSO)) soltos.push(i);
  const demolidos = [];
  for (const i of [...ruins].sort((a, b) => a - b)) {
    if (!P.viva[i]) continue;
    if (modo === 'soltar') soltos.push(i);
    else demolidos.push(removerPredio(sim, i));
  }
  for (const i of soltos) if (P.viva[i]) soltarPredio(sim, i);
  if (demolidos.length || soltos.length) {
    // as células que vagaram podem voltar a valer na esquina
    for (const c of area) C.motivo[c] = (C.motivo[c] & ~MOTIVO.PREDIO) | (C.predio[c] < 0 && sobrePredio(sim, c) ? MOTIVO.PREDIO : 0);
    esquinas(sim, ix, area);
  }
  for (const c of area) {
    const est = estadoDe(C, c);
    if (C.estado[c] !== est) {
      C.estado[c] = est;
      C.marcar(c);
    }
  }
  return { demolidos, soltos, novas: novas.length };
}

function passarPintura(sim, novas, registros) {
  const C = sim.tabelas.celulas;
  const R = REGRAS_CELULAS.transferencia;
  const baldes = new Map();
  const chave = (i, j) => i * 65536 + j;
  registros.forEach((r, k) => {
    const c = chave(Math.floor(r.x / R), Math.floor(r.z / R));
    const l = baldes.get(c);
    if (l) l.push(k);
    else baldes.set(c, [k]);
  });
  const usado = new Uint8Array(registros.length);
  for (const c of novas) {
    const x = C.x[c];
    const z = C.z[c];
    const bi = Math.floor(x / R);
    const bj = Math.floor(z / R);
    let melhor = -1;
    // até 4 m inclusive (alargar a rua em 8 m afasta as células exatamente 4 m)
    let md = R + 1e-3;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        for (const k of baldes.get(chave(bi + di, bj + dj)) ?? []) {
          if (usado[k]) continue;
          const d = hipot(registros[k].x - x, registros[k].z - z);
          if (d < md || (d === md && k < melhor)) {
            md = d;
            melhor = k;
          }
        }
      }
    }
    if (melhor >= 0) {
      usado[melhor] = 1;
      C.zona[c] = registros[melhor].zona;
      C.marcar(c);
    }
  }
}

/** Revalida as células num retângulo (ladrilho comprado, prédio posto ou tirado por outro domínio). */
export function revalidarRetangulo(sim, x0, z0, x1, z1, { modo = 'demolir' } = {}) {
  return refazerBlocos(sim, { caixa: [x0, z0, x1, z1], modo });
}

/** Gera as células de todas as arestas com blocos que ainda não têm (montagem do mapa). */
export function gerarFaltantes(sim) {
  const A = sim.tabelas.arestas;
  const ix = indice(sim);
  const lista = [];
  for (let e = 0; e < A.n; e++) if (temBlocos(sim, e) && !ix.porAresta.has(e)) lista.push(e);
  if (!lista.length) return { demolidos: [], soltos: [], novas: 0 };
  return refazerBlocos(sim, { gerar: lista });
}

// ------------------------------------------------------------------------------------------------ registro

export function registrar(sim) {
  const C = sim.tabelas.celulas;
  if (!C || !sim.grafo) return;
  if (!C.specs.motivo) C.novaColuna('motivo', Uint8Array);
  indice(sim);
  // as vias do mapa com calçada (rua principal da Vila) já saem com os blocos
  gerarFaltantes(sim);
  // ao carregar, o índice das células sai na hora (a primeira prévia depois da carga fica leve)
  sim.aoCarregar(() => {
    refazerIndice(sim);
    indice(sim);
  });
}
