// Aplainar puro e comutativo sobre as formas de sim.formas (D5) e o chão do espelho sempre em dia (dona: S1a).
//
// Cada amostra sai só da grade base (a do mapa) e das formas que a tocam: vale a de menor distância ao núcleo
// (empate: tipo, depois ref, depois cota); até a faixa plana de 8 m vale a cota dela; depois a base volta por
// smoothstep em 16 m. Como a escolha é uma ordem total, a ordem de registro não muda nenhum bit (A2).
//
// Ligação: o núcleo marca o retângulo sujo de cada forma registrada ou removida por sim.formas.marcarRet; este módulo
// encadeia nessa função e refaz o retângulo na hora (a UI e a S1b leem alturaEm logo depois do comando, mesmo
// pausado). Ao carregar, refaz a grade inteira a partir da base e das formas do save.
import { FORMA } from '../../contratos/interno.js';
import { amostrasNoRetangulo } from '../../comum/altura.js';
import { distSegmento, distPoligono } from '../../comum/vetor.js';
import { smoothstep } from '../../comum/util.js';
import { ponto, tabelaArco, tDoArco } from '../../comum/bezier.js';
import { VIAS, VIAS_ORDEM } from '../../data/vias.js';
import { refDe } from '../../contratos/espelho.js';
import { terrenoBase } from './terreno.js';

/** Alcance de uma forma além do núcleo: faixa plana de 8 m e transição de 16 m. */
export const ALCANCE = FORMA.faixaPlana + FORMA.transicao;

/** O chão no núcleo de uma via fica 0,15 m abaixo da pista (D5). */
export const CHAO_ABAIXO_DA_PISTA = 0.15;

const SEG = { d: 0, t: 0 };

/**
 * Distância de (x, z) ao núcleo de uma forma normalizada e a cota do núcleo no ponto mais perto (a mesma conta do
 * aplainar de referência da F0).
 */
export function distanciaForma(f, x, z, out = { d: 0, cota: 0 }) {
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
    out.cota = cota;
  } else {
    out.d = distPoligono(x, z, f.contorno);
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
  const o = { d: 0, cota: 0 };
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
      let mr = 0;
      let mc = 0;
      for (const f of linha) {
        const c = f.caixa;
        if (x < c[0] - ALCANCE || x > c[2] + ALCANCE || z < c[1] - ALCANCE || z > c[3] + ALCANCE) continue;
        distanciaForma(f, x, z, o);
        if (o.d >= ALCANCE) continue;
        const t = FORMA.ordemTipo[f.tipo];
        if (o.d < md || (o.d === md && (t < mt || (t === mt && (f.ref < mr || (f.ref === mr && o.cota < mc)))))) {
          md = o.d;
          mt = t;
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
 * Forma do aplainar de uma aresta do grafo: o eixo da Bézier a cada ~8 m, com a cota da pista linear no arco entre os
 * dois nós, menos 0,15 m, e a meia largura do tipo. Ponte (flag PONTE) não tem forma: o tabuleiro fica no alto.
 */
export function formaDaAresta(G, e, { abaixo = CHAO_ABAIXO_DA_PISTA } = {}) {
  const A = G.arestas;
  const tipo = VIAS[VIAS_ORDEM[A.tipo[e]]];
  const p = A.p.subarray(8 * e, 8 * e + 8);
  const tab = tabelaArco(p);
  const comp = tab[16];
  const m = Math.max(1, Math.ceil(comp / 8));
  const eixo = new Float64Array((m + 1) * 3);
  const y0 = A.y[2 * e] - abaixo;
  const y1 = A.y[2 * e + 1] - abaixo;
  const q = [0, 0];
  for (let k = 0; k <= m; k++) {
    const s = (comp * k) / m;
    ponto(p, tDoArco(tab, s), q);
    eixo[3 * k] = q[0];
    eixo[3 * k + 1] = q[1];
    eixo[3 * k + 2] = y0 + ((y1 - y0) * k) / m;
  }
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
