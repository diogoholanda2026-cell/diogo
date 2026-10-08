// Pontes e viadutos que o jogador cria (D53, D106; dona: X4, entregue pela PONT2). Puro: sem relógio, sem sorteio.
//
// Ponte: o trecho de um traço que cruza água vira ponte sozinho (sim.travessia.registrar). Tabuleiro na cota das
// margens com um leve arco, pilares de leito a leito, travessia de até 200 m (código 'vao'), custo 3 vezes o da via.
// Viaduto: o jogador escolhe a cota (0, +6, +12, +18 m) e o traço sobe por rampas de 6%, anda no alto e desce; por
// baixo, as outras vias passam sem se ligar (altura livre de 5 m), e só as pontas (rampas) se ligam. Os dois são a
// flag ARESTA.PONTE na aresta (a cota da pista está nos nós; o render e o trânsito leem a aresta como linear).
//
// A ferramenta de via (ferramenta.js) usa daqui: o perfil de elevação do traço, a classificação de cada cruzamento
// (liga, passa por cima ou por baixo, ou recusa) e a validação dos pilares. Os motivos novos viajam como códigos
// internos ('altura', 'pilar', 'rampa') que a saída da prévia traduz para os códigos do contrato com dados.motivo.
import { maisPerto } from '../../comum/bezier.js';
import { hipot } from '../../comum/util.js';
import { pontoNoRetangulo } from '../../comum/vetor.js';
import {
  ALTURA_LIVRE, DESNIVEL_MINIMO, ELEVACAO_PONTE, TRAVESSIA_MAX, PROFUNDIDADE_PILAR, alturaDaPista, comprimentoRampa, pilaresDaPeca,
} from '../../comum/viaduto.js';
import { AGUA, ARESTA } from '../../contratos/flags.js';
import { aguaEm } from '../mundo/terreno.js';
import { tipoVia, pistaNoT, prediosNaCaixa } from './validar.js';

export { ALTURA_LIVRE, DESNIVEL_MINIMO };

/** Códigos internos desta parcela e o que viram na saída da prévia (códigos do contrato com dados.motivo). */
export const MOTIVOS = Object.freeze({
  altura: { codigo: 'colisao', motivo: 'altura' },
  pilar: { codigo: 'colisao', motivo: 'pilar' },
  rampa: { codigo: 'declive', motivo: 'rampa' },
  greide: { codigo: 'declive', motivo: 'greide' },
});

/** Código e dados do contrato para um código interno ou do contrato. */
export function codigoPublico(c) {
  const m = MOTIVOS[c];
  return m ? { codigo: m.codigo, dados: { motivo: m.motivo } } : { codigo: c };
}

// ------------------------------------------------------------------------------------------------ travessia (água)

/**
 * Pergunta de validar(): o trecho sobre água vira ponte? Recusa com 'vao' quando uma travessia passa de 200 m.
 * O custo 3 vezes é aplicado pela ferramenta em toda peça que vira tabuleiro (ponte ou viaduto).
 */
export function travessia(sim, { tipo, trechos }) {
  if (tipo === 'rodovia' || tipo === 'terra') return null;
  for (const [s0, s1] of trechos) if (s1 - s0 > TRAVESSIA_MAX + 1e-6) return { codigo: 'vao' };
  return { codigo: null };
}

export function registrar(sim) {
  sim.travessia.registrar(travessia);
}

// ------------------------------------------------------------------------------------------------ perfil de elevação

/**
 * Elevação planejada do traço no arco s: a cota escolhida vezes o trapézio (rampa de subida, alto, rampa de descida).
 * Uma ponta que já está no alto (nó de um viaduto) não ganha rampa daquele lado.
 * @param {{ cota: number, comp: number, iniAlto: boolean, fimAlto: boolean }} info
 */
export function elevacaoPlanejada(info, s) {
  if (!(info.cota > 0)) return 0;
  const Lr = comprimentoRampa(info.cota);
  const dIni = info.iniAlto ? Infinity : s;
  const dFim = info.fimAlto ? Infinity : info.comp - s;
  const d = Math.min(dIni, dFim);
  return alturaDaPista(info.cota) * (d >= Lr ? 1 : d <= 0 ? 0 : d / Lr);
}

/** Informações de elevação do traço: a cota, o comprimento e se cada ponta já está no alto. */
export function infoDoTraco(sim, plano, tr, comp) {
  const V = plano.vertices;
  const alto = (v) => v.fixo && Number.isFinite(v.y) && v.y - sim.alturaEm(v.x, v.z) >= ELEVACAO_PONTE + 0.15;
  return { cota: plano.cota ?? 0, comp, iniAlto: alto(V[tr.va]), fimAlto: alto(V[tr.vb]) };
}

/** Comprimento mínimo do traço para alcançar a cota inteira (null se não precisa). */
export function comprimentoParaCota(info) {
  if (!(info.cota > 0)) return null;
  const Lr = comprimentoRampa(info.cota);
  return (info.iniAlto ? 0 : Lr) + (info.fimAlto ? 0 : Lr);
}

/**
 * Amostras do traço sobre a água e a cota alvo do tabuleiro nelas: da margem de cá à de lá, em linha reta com um arco
 * de 2,5% do vão (no máximo 6 m, no mínimo 1,5 m), pela cota das margens (D53). `alvo` é mudado no lugar.
 * @returns {{ agua: Uint8Array, trechos: { i0: number, i1: number, margemA: number, margemB: number }[] }}
 */
export function alvoDaAgua(sim, X, Z, S, alvo, meia) {
  const T = sim.espelho.terreno;
  const n = S.length;
  const agua = new Uint8Array(n);
  if (!T?.agua) return { agua, trechos: [] };
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    let dx = X[b] - X[a];
    let dz = Z[b] - Z[a];
    const L = hipot(dx, dz) || 1;
    dx /= L;
    dz /= L;
    for (const u of [0, meia, -meia]) {
      if (aguaEm(T, X[i] - dz * u, Z[i] + dx * u) !== AGUA.TERRA) {
        agua[i] = 1;
        break;
      }
    }
  }
  const trechos = [];
  for (let i = 0; i < n; i++) {
    if (!agua[i]) continue;
    let j = i;
    while (j + 1 < n && agua[j + 1]) j++;
    // margens: a amostra seca mais perto de cada lado (a ponta do traço, se a água vai até ela)
    const margemA = Math.max(0, i - 1);
    const margemB = Math.min(n - 1, j + 1);
    trechos.push({ i0: i, i1: j, margemA, margemB });
    i = j;
  }
  for (const tr of trechos) {
    const sA = S[tr.margemA];
    const sB = S[tr.margemB];
    const yA = alvo[tr.margemA];
    const yB = alvo[tr.margemB];
    const vao = Math.max(1e-6, sB - sA);
    const arco = Math.min(6, Math.max(1.5, 0.025 * vao));
    for (let i = tr.i0; i <= tr.i1; i++) {
      const u = (S[i] - sA) / vao;
      alvo[i] = yA + (yB - yA) * u + arco * 4 * u * (1 - u);
    }
  }
  return { agua, trechos };
}

// ------------------------------------------------------------------------------------------------ cruzamentos

/**
 * Como o traço cruza uma via que existe, no ponto q (arco s do traço, parâmetro u da aresta e): 'normal' (liga, como
 * sempre), 'passagem' (uma passa por cima da outra, sem se ligar) ou 'altura' (uma das duas está no alto mas sem a
 * altura livre: recusa). Só vira passagem ou 'altura' quando um dos dois está a mais de ELEVACAO_PONTE do chão.
 */
export function classificarCruzamento(sim, info, s, e, u, q) {
  const A = sim.tabelas.arestas;
  const chao = sim.alturaEm(q[0], q[1]) + 0.15;
  const meuAlto = elevacaoPlanejada(info, s) >= ELEVACAO_PONTE;
  const yOutra = pistaNoT(sim, e, u);
  const outraAlta = !!(A.flags[e] & ARESTA.PONTE) && yOutra - chao >= ELEVACAO_PONTE;
  if (!meuAlto && !outraAlta) return { tipo: 'normal' };
  const yMeu = chao + elevacaoPlanejada(info, s);
  const d = yMeu - yOutra;
  if (Math.abs(d) >= DESNIVEL_MINIMO) return { tipo: 'passagem', yMeu, yOutra };
  return { tipo: 'altura', yMeu, yOutra };
}

// ------------------------------------------------------------------------------------------------ pilares

/** Função "tem via no chão aqui?" para o espaçamento dos pilares: pista de via que não é tabuleiro, com folga de 2 m. */
export function viaNoChao(sim) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  return (x, z) => {
    const ids = G.gradeArestas.consultar(x - 20, z - 20, x + 20, z + 20);
    for (let k = 0; k < ids.length; k++) {
      const e = ids[k];
      if (!A.viva[e] || A.flags[e] & ARESTA.PONTE) continue;
      const m = tipoVia(A.tipo[e]).largura / 2 + 2;
      if (maisPerto(A.p, x, z, 8 * e).d < m) return true;
    }
    return false;
  };
}

/**
 * Pilares de uma peça de tabuleiro com as regras de chão válido: nenhum sobre pista de via no chão, sobre prédio ou na
 * água funda demais. Devolve os códigos de erro ('pilar') ou [].
 */
export function validarPilares(sim, pc, ya, yb, bloqueia) {
  const P = sim.tabelas.predios;
  const T = sim.espelho.terreno;
  const mar = sim.espelho.mapa?.nivelMar ?? 0;
  const pilares = pilaresDaPeca(pc.p, [ya, yb], (x, z) => sim.alturaEm(x, z), bloqueia);
  for (const pl of pilares) {
    if (T?.agua && aguaEm(T, pl.x, pl.z) !== AGUA.TERRA && pl.base < mar - PROFUNDIDADE_PILAR) return ['pilar'];
    for (const i of prediosNaCaixa(sim, pl.x - 12, pl.z - 12, pl.x + 12, pl.z + 12)) {
      if (pontoNoRetangulo(pl.x, pl.z, P.x[i], P.z[i], P.rot[i], P.w[i], P.d[i], 2)) return ['pilar'];
    }
  }
  return [];
}

// ------------------------------------------------------------------------------------------------ demolir

/**
 * A estrutura de uma ponte ou viaduto do jogador: a aresta e as vizinhas de tabuleiro encadeadas por nós de grau 2
 * (a cadeia de rampas e vãos até os nós onde a via volta ao chão). Rodovia e Arcologia ficam de fora. Em ordem de idx.
 */
export function estruturaDaPonte(sim, e) {
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const tabuleiro = (x) => A.viva[x] && A.flags[x] & ARESTA.PONTE && !(A.flags[x] & (ARESTA.RODOVIA | ARESTA.ARCOLOGIA));
  if (!tabuleiro(e)) return [e];
  const feitas = new Set([e]);
  const fila = [e];
  while (fila.length) {
    const atual = fila.pop();
    for (const n of [A.a[atual], A.b[atual]]) {
      if (N.grau[n] !== 2) continue;
      for (let k = 0; k < 6; k++) {
        const o = N.lig[6 * n + k];
        if (o < 0 || feitas.has(o) || !tabuleiro(o)) continue;
        feitas.add(o);
        fila.push(o);
      }
    }
  }
  return [...feitas].sort((a, b) => a - b);
}
