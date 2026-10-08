// Peças comuns da economia, da Holding e do progresso (dona: S3a): as regras do dono que valem para a simulação, o
// livro-caixa por categoria (receitas, despesas correntes, investimentos e financiamento, D41) e pequenos ajudantes.
// Nada aqui lê relógio nem sorteia; o estado fica nas seções JSON registradas (save e hash).
import { REGRAS_DONO, ECONOMIA, DESPESAS_CORRENTES } from '../../data/economia.js';
import { MINUTO } from '../../comum/relogio.js';

const REGRAS = new WeakMap();

/** Regras do dono desta simulação (sempre REGRAS_DONO no jogo; os testes trocam por usarRegras). */
export const regrasDe = (sim) => REGRAS.get(sim) ?? REGRAS_DONO;

/**
 * Só para testes: troca as regras desta simulação (por exemplo a moeda, para provar que o fator não muda nada).
 * @example usarRegras(sim, { ...REGRAS_DONO, moeda: { simbolo: 'US$', fator: 1 } })
 */
export function usarRegras(sim, regras) {
  REGRAS.set(sim, regras);
}

/** true no Modo livre (D56; o M1a não tem, mas a bandeira já existe). */
export const livre = (sim) => sim.json.partida?.modo === 'livre';

export const finito = (v, padrao = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);

/** Inteiro >= 0 de um argumento de comando, ou null. */
export const inteiroNaoNeg = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

// ------------------------------------------------------------------------------------------------ livro-caixa

/** Categorias com balde de 1 hora (60 baldes de 1 minuto de jogo): o que entra por evento e aparece "por hora". */
export const CATEGORIAS_HORA = Object.freeze([
  'r.cidade', 'r.deposito', 'r.marcos', 'r.aporte', 'r.outras',
  'd.importacao', 'd.importacaoCidade', 'd.investimentos',
  'n.servicos', 'n.salarios',
]);
const IDX = Object.fromEntries(CATEGORIAS_HORA.map((c, i) => [c, i]));
const NB = 60;

/** Estado do livro-caixa (dentro da seção 'economia'). */
export function caixaVazio() {
  return {
    minuto: 0, // minuto de jogo do balde atual
    baldes: new Array(CATEGORIAS_HORA.length * NB).fill(0),
    // totais desde o começo (robô, Progresso): receitas e despesas por categoria, investimentos e financiamento
    totais: { receitas: {}, despesas: {}, investimentos: {}, financiamento: {}, naoPago: {} },
    // somas do mês corrente (série mensal)
    mes: { receitas: 0, despesas: 0, investimentos: 0 },
  };
}

/** Gira os baldes até o minuto do tique (zera os que passaram). */
function girar(L, tique) {
  const m = Math.floor(tique / MINUTO);
  if (m === L.minuto) return;
  const passos = Math.min(NB, Math.max(0, m - L.minuto));
  for (let k = 1; k <= passos; k++) {
    const b = (L.minuto + k) % NB;
    for (let c = 0; c < CATEGORIAS_HORA.length; c++) L.baldes[c * NB + b] = 0;
  }
  L.minuto = m;
}

/**
 * Soma da última hora de uma categoria do balde ('r.cidade', 'd.importacao'...) vista do tique dado. Pura: os baldes
 * de mais de uma hora atrás (que o próximo lançamento zeraria) não contam.
 */
export function somaHora(L, cat, tique) {
  const c = IDX[cat];
  if (c === undefined) return 0;
  const m = Math.floor(tique / MINUTO);
  const de = Math.max(L.minuto - NB + 1, m - NB + 1);
  let s = 0;
  for (let x = de; x <= L.minuto; x++) s += L.baldes[c * NB + (((x % NB) + NB) % NB)];
  return s;
}

const somar = (o, k, v) => {
  o[k] = (o[k] ?? 0) + v;
};

/**
 * Lança um valor no livro-caixa. tipo: 'receita' | 'despesa'. As categorias que não são receita nem despesa corrente
 * vão para investimentos (pagar: obra, ladrilho, prédio) ou outras receitas (receber: devoluções); 'emprestimo' e
 * 'pagamentoEmprestimo' vão para financiamento (não entram no saldo por hora).
 */
export function lancar(sim, tipo, categoria, valor) {
  const E = sim.json.economia;
  if (!E || !(valor > 0)) return;
  const L = E.livro;
  girar(L, sim.tique);
  const b = L.minuto % NB;
  const cat = String(categoria ?? 'outras');
  if (cat === 'emprestimo' || cat === 'pagamentoEmprestimo' || cat === 'jurosPagos' || cat === 'fundoTeste') {
    somar(L.totais.financiamento, cat, valor);
    return;
  }
  if (tipo === 'receita') {
    const r = ECONOMIA.receitas.includes(cat) ? cat : 'outras';
    somar(L.totais.receitas, r, valor);
    L.mes.receitas += valor;
    const k = IDX[`r.${r}`];
    if (k !== undefined) L.baldes[k * NB + b] += valor;
    return;
  }
  if (DESPESAS_CORRENTES.includes(cat)) {
    somar(L.totais.despesas, cat, valor);
    L.mes.despesas += valor;
    const k = IDX[`d.${cat}`];
    if (k !== undefined) L.baldes[k * NB + b] += valor;
    return;
  }
  somar(L.totais.investimentos, cat, valor);
  L.mes.investimentos += valor;
  L.baldes[IDX['d.investimentos'] * NB + b] += valor;
}

/** Anota o que não foi pago (D41): 'servicos' ou 'salarios'. */
export function naoPago(sim, categoria, valor) {
  const E = sim.json.economia;
  if (!E || !(valor > 0)) return;
  const L = E.livro;
  girar(L, sim.tique);
  somar(L.totais.naoPago, categoria, valor);
  const k = IDX[`n.${categoria}`];
  if (k !== undefined) L.baldes[k * NB + (L.minuto % NB)] += valor;
}

/** Gira os baldes sem lançar (as consultas leem a última hora certa mesmo sem movimento). */
export function atualizarLivro(sim) {
  const E = sim.json.economia;
  if (E) girar(E.livro, sim.tique);
}

// ------------------------------------------------------------------------------------------------ itens

/** Soma de um mapa { item: n } (só números finitos e positivos). */
export function totalItens(mapa) {
  let s = 0;
  for (const k of Object.keys(mapa ?? {})) s += mapa[k] > 0 ? mapa[k] : 0;
  return s;
}

// ------------------------------------------------------------------------------------------------ história

/** Efeitos ativos (decisões e eventos) de um tipo, da seção 'historia' (lista vazia sem ela). */
export function efeitosAtivos(sim, tipo) {
  const H = sim.json.historia;
  if (!H) return [];
  return H.efeitos.filter((e) => e.tipo === tipo && (e.ate === null || sim.tique < e.ate) && !e.anulado);
}

/**
 * Põe uma fala no Mural (q.mural). autor: id do conselheiro; texto: chave em ui/textos/s3.js; alvo: { x, z } |
 * { tela } | null.
 */
export function postarMural(sim, autor, texto, params = {}, alvo = null, maximo = 200) {
  const H = sim.json.historia;
  if (!H) return;
  H.mural.push({ id: ++H.seqMural, tique: sim.tique, autor, texto, params, alvo });
  if (H.mural.length > maximo) H.mural.splice(0, H.mural.length - maximo);
  const post = H.mural[H.mural.length - 1];
  sim.emitir('mural', { post: { ...post, params: { ...post.params } } });
}
