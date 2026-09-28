// Demolir e desfazer vias (D32; dona: S1b). Demolir devolve 50% do custo da via (100% se ela foi construída na mesma
// sessão da ferramenta); prédios que ficam sem as células da via demolida ficam sem acesso e voltam a ligar quando a via
// volta. Desfazer volta as até 10 últimas ações da sessão da ferramenta (construir, melhorar, demolir) com reembolso
// integral, enquanto nenhum prédio tiver nascido nas células criadas (senão 'ocupado'). Aqui também ficam as operações
// do grafo que andam com as formas do aplainar (registrar e tirar a forma, fotografar e restaurar uma aresta) e o custo
// de demolir um prédio pelo valor dos materiais do nível dele (D54).
import { addNo, addAresta, removerAresta, removerNo, cortes, meiaDa, arestasDoNo } from './grafo.js';
import { caixa as caixaBz } from '../../comum/bezier.js';
import { hipot } from '../../comum/util.js';
import { refDe, idxDaRef } from '../../contratos/espelho.js';
import { ARESTA, TIPO_PREDIO } from '../../contratos/flags.js';
import { VIAS, VIAS_ORDEM, REGRAS_VIAS, REGRAS_CELULAS } from '../../data/vias.js';
import { PREDIOS, PREDIOS_ORDEM } from '../../data/predios.js';
import { ITENS } from '../../data/holding.js';
import { formaDaAresta } from '../mundo/aplainar.js';
import { recolherCelulas, refazerBlocos, restaurarPredio, celulasDaAresta } from '../zonas/blocos.js';
import { decliveDa, tipoVia, amostrarCurva, prediosNaPista } from './validar.js';

// ------------------------------------------------------------------------------------------------ custos

/**
 * Preço de referência dos materiais (preço base da seção 13.2 do desenho da simulação) enquanto a S3a não publica os
 * itens em data/holding.js; depois vale ITENS[item].base. (calibrar)
 */
export const PRECO_REFERENCIA = Object.freeze({
  brita: 20, areia: 15, madeira: 30, argila: 18, calcario: 22, tijolo: 50, serrada: 80, cimento: 90, concreto: 170,
  vidro: 140, aco: 160,
});

/** Preço base de um item (catálogo da Holding, senão o de referência). */
export function precoBase(item) {
  const v = ITENS?.[item]?.base;
  return Number.isFinite(v) ? v : PRECO_REFERENCIA[item] ?? 50;
}

/** Custo de demolir um prédio da cidade: o valor dos materiais do nível dele a 100% do preço base (D54). */
export function custoDemolirPredio(sim, i) {
  const P = sim.tabelas.predios;
  if (P.tipo[i] !== TIPO_PREDIO.ZONA) return 0;
  const def = PREDIOS[PREDIOS_ORDEM[P.modelo[i]]];
  const nv = def?.niveis?.[Math.max(1, Math.min(5, P.nivel[i])) - 1];
  if (!nv) return 0;
  let s = 0;
  for (const [item, q] of Object.entries(nv.materiais ?? {})) s += q * precoBase(item);
  return Math.round(s);
}

/** Custo de construção de uma via: comprimento x custo por metro x (1 + 2 x declive). As vias do mapa custam 0. */
export function custoAresta(sim, e) {
  const A = sim.tabelas.arestas;
  const tipo = tipoVia(A.tipo[e]);
  if (!tipo?.custoM) return 0;
  return A.arco[17 * e + 16] * tipo.custoM * (1 + 2 * decliveDa(sim, e));
}

/** Manutenção da via por hora de jogo. */
export function manutencaoAresta(sim, e) {
  const A = sim.tabelas.arestas;
  const tipo = tipoVia(A.tipo[e]);
  return ((A.arco[17 * e + 16] / 1000) * (tipo?.manutKmH ?? 0));
}

// ------------------------------------------------------------------------------------------------ sessão

/** Estado das sessões da ferramenta (seção JSON 'vias' registrada pela ferramenta). */
const sessoes = (sim) => sim.json.vias;

/**
 * Guarda uma ação para desfazer na sessão (uma sessão nova esvazia a lista; guarda as 10 últimas). Sem sessão (o
 * robô) não guarda nada.
 */
export function registrarAcao(sim, sessao, acao) {
  const J = sessoes(sim);
  if (!J) return;
  if (sessao !== undefined && sessao !== null && sessao !== J.sessao) {
    J.sessao = sessao;
    J.acoes = [];
  }
  if (J.sessao === null || J.sessao === undefined) return;
  J.acoes.push(acao);
  while (J.acoes.length > REGRAS_VIAS.desfazerMax) J.acoes.shift();
}

/**
 * true se a aresta (ref) foi criada na sessão atual da ferramenta: uma das construídas ou um pedaço de uma delas que
 * outra obra da sessão dividiu.
 */
function daSessao(sim, ref, sessao) {
  const J = sessoes(sim);
  if (!J || J.sessao === null || (sessao !== undefined && sessao !== null && sessao !== J.sessao)) return false;
  const minhas = new Set();
  for (const a of J.acoes) {
    if (a.tipo !== 'construir') continue;
    for (const r of a.arestas) minhas.add(r);
    for (const d of a.divisoes) if (minhas.has(d.original.ref)) for (const r of d.pecas) minhas.add(r);
  }
  return minhas.has(ref);
}

/**
 * Troca a ref de uma aresta nas ações guardadas da sessão: ao desfazer, a aresta dividida ou demolida volta com outra
 * ref, e as ações anteriores precisam achá-la para ser desfeitas também.
 */
function trocarRef(sim, velha, nova) {
  const J = sessoes(sim);
  if (!J || velha === nova) return;
  const troca = (r) => (r === velha ? nova : r);
  for (const a of J.acoes) {
    if (a.tipo === 'construir') {
      a.arestas = a.arestas.map(troca);
      for (const d of a.divisoes) {
        d.pecas = d.pecas.map(troca);
        if (d.original.ref === velha) d.original.ref = nova;
      }
    } else if (a.tipo === 'melhorar') {
      for (const x of a.arestas) x.ref = troca(x.ref);
    } else if (a.tipo === 'demolir') {
      for (const f of a.fotos) f.ref = troca(f.ref);
    }
  }
}

/** O prédio restaurado volta com outra ref: as listas de quem já estava ali (ocupantes) passam a achá-lo. */
function trocarRefPredio(sim, velha, nova) {
  const J = sessoes(sim);
  if (!J || velha === nova) return;
  for (const a of J.acoes) if (a.ocupantes) a.ocupantes = a.ocupantes.map((r) => (r === velha ? nova : r)).sort((x, y) => x - y);
}

/** Quanto demolir a aresta devolve: 50% do custo, 100% se ela é da sessão atual. */
export function devolucaoAresta(sim, e, sessao) {
  const A = sim.tabelas.arestas;
  const f = daSessao(sim, refDe(e, A.ger[e]), sessao) ? 1 : REGRAS_VIAS.devolucao;
  return Math.round(custoAresta(sim, e) * f);
}

// ------------------------------------------------------------------------------------------------ grafo com formas

/** Registra a forma do aplainar da aresta (a ponte fica no alto, sem forma). */
export function registrarForma(sim, e) {
  const A = sim.tabelas.arestas;
  if (A.flags[e] & ARESTA.PONTE) return;
  sim.formas.registrar(formaDaAresta(sim.grafo, e));
}

/** Tira a forma da aresta (pela ref). */
export const tirarForma = (sim, ref) => sim.formas.removerRef('via', ref);

/**
 * Refaz as formas das arestas ligadas aos nós (o raio do nó e os ângulos mudaram e com eles os patamares da pista),
 * menos as de `pular` (que acabaram de ganhar a forma com o grafo já pronto). A rampa de uma aresta refeita pode ter
 * mudado, e com ela a dobra do greide no nó de grau 2 sem raio da outra ponta: a vizinha de lá também é refeita.
 */
export function reformarNos(sim, nos, pular = null) {
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const G = sim.grafo;
  const feitas = new Set(pular ?? []);
  const fazer = [];
  const juntar = (e) => {
    if (feitas.has(e)) return;
    feitas.add(e);
    fazer.push(e);
  };
  for (const n of [...nos].sort((a, b) => a - b)) {
    if (n < 0 || n >= N.n || !N.viva[n]) continue;
    for (const e of arestasDoNo(G, n)) juntar(e);
  }
  const diretas = fazer.length;
  for (let k = 0; k < diretas; k++) {
    const e = fazer[k];
    for (const m of [A.a[e], A.b[e]]) {
      if (N.grau[m] === 2 && !(N.raio[m] > 0)) for (const o of arestasDoNo(G, m)) juntar(o);
    }
  }
  for (const e of fazer) {
    if (!A.viva[e] || A.flags[e] & ARESTA.PONTE) continue;
    tirarForma(sim, refDe(e, A.ger[e]));
    registrarForma(sim, e);
  }
}

/** Fotografia de uma aresta para restaurar depois (JSON puro). */
export function fotoAresta(sim, e) {
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const no = (n) => ({ ref: refDe(n, N.ger[n]), x: N.x[n], z: N.z[n], y: N.y[n] });
  return {
    ref: refDe(e, A.ger[e]),
    a: no(A.a[e]),
    b: no(A.b[e]),
    tipo: A.tipo[e],
    flags: A.flags[e],
    mao: A.mao[e],
    idade: A.idade[e],
    fase: A.fase ? A.fase[e] : 0,
    nome: A.nomeVia ? A.nomeVia[e] : 0,
    p: Array.from(A.p.subarray(8 * e, 8 * e + 8)),
  };
}

/** Nó de uma foto: o mesmo se ainda vive, senão um vivo no mesmo ponto, senão um novo. */
function noDaFoto(sim, f) {
  const N = sim.tabelas.nos;
  if (N.vivaRef(f.ref)) return idxDaRef(f.ref);
  const r = sim.grafo.gradeNos.maisPerto(f.x, f.z, 0.01, (i) => (N.viva[i] ? hipot(N.x[i] - f.x, N.z[i] - f.z) : Infinity));
  if (r) return r.id;
  return addNo(sim.grafo, f.x, f.z, f.y);
}

/**
 * Recria a aresta de uma foto. Devolve o idx novo ou -1. Sem a forma: quem restaura chama reformarNos com o grafo
 * pronto (os patamares dependem de todas as vias do nó).
 */
export function restaurarAresta(sim, f) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  const a = noDaFoto(sim, f.a);
  const b = noDaFoto(sim, f.b);
  if (a < 0 || b < 0) return -1;
  const e = addAresta(G, a, b, f.tipo, [f.p[2], f.p[3]], [f.p[4], f.p[5]], { flags: f.flags, mao: f.mao, idade: f.idade });
  if (e < 0) return -1;
  if (A.fase) A.fase[e] = f.fase;
  if (A.nomeVia) A.nomeVia[e] = f.nome;
  A.marcar(e);
  return e;
}

/** Caixa das arestas (com a meia largura). */
export function caixaDasArestas(sim, es) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  let c = [Infinity, Infinity, -Infinity, -Infinity];
  for (const e of es) {
    if (!A.viva[e]) continue;
    const k = caixaBz(A.p, 8 * e, meiaDa(G, e));
    c = [Math.min(c[0], k[0]), Math.min(c[1], k[1]), Math.max(c[2], k[2]), Math.max(c[3], k[3])];
  }
  return c;
}

const juntar = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

/** Caixa de uma foto (pelos pontos de controle). */
function caixaDaFoto(f) {
  const k = caixaBz(f.p, 0, VIAS[VIAS_ORDEM[f.tipo]].largura / 2);
  return k;
}

/**
 * Prédios (refs em ordem) a menos de meia largura + 4 m da pista de uma aresta ou de uma foto: os que a via volta a
 * cobrir ou a invalidar ao ser desfeita a demolição. Serve para saber se nasceu prédio ali depois (D32: 'ocupado').
 */
export function prediosNaFaixa(sim, f) {
  const P = sim.tabelas.predios;
  const meia = VIAS[VIAS_ORDEM[f.tipo]].largura / 2;
  const a = amostrarCurva(Float64Array.from(f.p));
  return prediosNaPista(sim, a, meia, REGRAS_CELULAS.folgaVia).map((i) => refDe(i, P.ger[i]));
}

/** Refs dos prédios nas células das arestas, em ordem (quem já estava ali ao fim de uma obra). */
export function prediosNasCelulas(sim, es) {
  const C = sim.tabelas.celulas;
  const P = sim.tabelas.predios;
  const out = new Set();
  for (const e of es) for (const c of celulasDaAresta(sim, e)) if (C.predio[c] >= 0) out.add(refDe(C.predio[c], P.ger[C.predio[c]]));
  return [...out].sort((a, b) => a - b);
}

// ------------------------------------------------------------------------------------------------ via.demolir

function demolirVias(sim, { arestas, sessao } = {}) {
  const A = sim.tabelas.arestas;
  const G = sim.grafo;
  if (!Array.isArray(arestas) || !arestas.length) return { ok: false, codigo: 'valor' };
  const lista = [];
  for (const ref of arestas) {
    const e = A.idxVivo(ref);
    if (e < 0) return { ok: false, codigo: 'inexistente' };
    if (A.flags[e] & ARESTA.ARCOLOGIA) return { ok: false, codigo: 'arcologia' };
    if (A.flags[e] & (ARESTA.RODOVIA | ARESTA.PONTE)) return { ok: false, codigo: 'rodovia' };
    if (!lista.includes(e)) lista.push(e);
  }
  lista.sort((a, b) => a - b);
  let devolvido = 0;
  for (const e of lista) devolvido += devolucaoAresta(sim, e, sessao);
  const fotos = lista.map((e) => fotoAresta(sim, e));
  // quem já estava na faixa da via: desfazer a demolição recusa se nascer prédio ali depois
  const ocupantes = [...new Set(fotos.flatMap((f) => prediosNaFaixa(sim, f)))].sort((a, b) => a - b);
  const caixa = caixaDasArestas(sim, lista);
  const { registros, predios } = recolherCelulas(sim, lista);
  const nos = new Set();
  for (const e of lista) {
    nos.add(A.a[e]);
    nos.add(A.b[e]);
    tirarForma(sim, refDe(e, A.ger[e]));
    removerAresta(G, e);
  }
  reformarNos(sim, nos);
  refazerBlocos(sim, { predios, caixa, modo: 'soltar' });
  if (devolvido > 0) sim.holding.receber(devolvido, 'vias');
  registrarAcao(sim, sessao, { tipo: 'demolir', fotos, devolvido, registros, ocupantes });
  sim.emitir('demolido', { tipo: 'via', refs: fotos.map((f) => f.ref) });
  return { ok: true, dados: { devolvido } };
}

// ------------------------------------------------------------------------------------------------ via.desfazer

function desfazerConstrucao(sim, acao) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const C = sim.tabelas.celulas;
  const vivas = (refs) => refs.every((r) => A.vivaRef(r));
  if (!vivas(acao.arestas) || !acao.divisoes.every((d) => vivas(d.pecas))) return 'ocupado';
  const criadas = acao.arestas.map((r) => idxDaRef(r));
  for (const e of criadas) for (const c of celulasDaAresta(sim, e)) if (C.predio[c] >= 0) return 'ocupado';
  const pecas = acao.divisoes.flatMap((d) => d.pecas.map((r) => idxDaRef(r)));
  const caixa = caixaDasArestas(sim, [...criadas, ...pecas]);
  const { registros, predios } = recolherCelulas(sim, [...criadas, ...pecas]);
  const nos = new Set();
  for (const e of criadas) {
    nos.add(A.a[e]);
    nos.add(A.b[e]);
    tirarForma(sim, refDe(e, A.ger[e]));
    removerAresta(G, e);
  }
  const originais = [];
  for (const d of [...acao.divisoes].reverse()) {
    const pontas = new Set([d.original.a.ref, d.original.b.ref]);
    const meio = new Set();
    for (const r of d.pecas) {
      const e = idxDaRef(r);
      for (const n of [A.a[e], A.b[e]]) if (!pontas.has(refDe(n, N.ger[n]))) meio.add(n);
      tirarForma(sim, r);
      removerAresta(G, e, { manterNos: true });
    }
    for (const n of meio) if (N.viva[n] && N.grau[n] === 0) removerNo(G, n);
    const velha = d.original.ref;
    const e = restaurarAresta(sim, d.original);
    if (e >= 0) {
      trocarRef(sim, velha, refDe(e, A.ger[e]));
      originais.push(e);
      nos.add(A.a[e]);
      nos.add(A.b[e]);
    }
  }
  reformarNos(sim, nos);
  for (const reg of acao.predios ?? []) {
    const i = restaurarPredio(sim, reg);
    if (i < 0) continue;
    predios.add(i);
    trocarRefPredio(sim, reg.ref, refDe(i, sim.tabelas.predios.ger[i]));
  }
  refazerBlocos(sim, { gerar: originais, registros, predios, caixa, modo: 'soltar' });
  if (acao.custo > 0) sim.holding.receber(acao.custo, 'vias');
  return null;
}

function desfazerMelhoria(sim, acao) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  if (!acao.arestas.every((x) => A.vivaRef(x.ref))) return 'ocupado';
  const es = acao.arestas.map((x) => idxDaRef(x.ref));
  // prédio que nasceu nas células da via depois da obra
  if (acao.ocupantes) {
    const antes = new Set(acao.ocupantes);
    if (prediosNasCelulas(sim, es).some((r) => !antes.has(r))) return 'ocupado';
  }
  let caixa = caixaDasArestas(sim, es);
  const { registros, predios } = recolherCelulas(sim, es);
  const nos = new Set();
  acao.arestas.forEach((x, k) => {
    const e = es[k];
    tirarForma(sim, x.ref);
    A.tipo[e] = x.tipo;
    A.mao[e] = x.mao;
    const c = caixaBz(A.p, 8 * e, meiaDa(G, e));
    G.gradeArestas.inserir(e, c[0], c[1], c[2], c[3]);
    A.marcar(e);
    nos.add(A.a[e]);
    nos.add(A.b[e]);
  });
  for (const n of nos) cortes(G, n);
  G.versao++;
  reformarNos(sim, nos);
  for (const reg of acao.predios ?? []) {
    const i = restaurarPredio(sim, reg);
    if (i < 0) continue;
    predios.add(i);
    trocarRefPredio(sim, reg.ref, refDe(i, sim.tabelas.predios.ger[i]));
  }
  caixa = juntar(caixa, caixaDasArestas(sim, es));
  refazerBlocos(sim, { gerar: es, registros, predios, caixa, modo: 'soltar' });
  if (acao.custo > 0) sim.holding.receber(acao.custo, 'vias');
  return null;
}

function desfazerDemolicao(sim, acao) {
  // prédio que nasceu na faixa da via depois da demolição (a via voltaria por cima dele)
  if (acao.ocupantes) {
    const antes = new Set(acao.ocupantes);
    for (const f of acao.fotos) if (prediosNaFaixa(sim, f).some((r) => !antes.has(r))) return 'ocupado';
  }
  if (acao.devolvido > 0 && !sim.holding.pagar(acao.devolvido, 'vias')) return 'creditos';
  const novas = [];
  let caixa = [Infinity, Infinity, -Infinity, -Infinity];
  const nos = new Set();
  for (const f of acao.fotos) {
    const velha = f.ref;
    const e = restaurarAresta(sim, f);
    if (e >= 0) {
      trocarRef(sim, velha, refDe(e, sim.tabelas.arestas.ger[e]));
      novas.push(e);
      nos.add(sim.tabelas.arestas.a[e]);
      nos.add(sim.tabelas.arestas.b[e]);
    }
    caixa = juntar(caixa, caixaDaFoto(f));
  }
  reformarNos(sim, nos);
  refazerBlocos(sim, { gerar: novas, registros: acao.registros ?? [], caixa, modo: 'soltar' });
  return null;
}

function desfazer(sim, { sessao } = {}) {
  const J = sessoes(sim);
  if (!J || J.sessao === null || sessao !== J.sessao || !J.acoes.length) return { ok: false, codigo: 'nada' };
  const acao = J.acoes[J.acoes.length - 1];
  const f = { construir: desfazerConstrucao, melhorar: desfazerMelhoria, demolir: desfazerDemolicao }[acao.tipo];
  const codigo = f ? f(sim, acao) : 'nada';
  if (codigo) return { ok: false, codigo };
  J.acoes.pop();
  sim.emitir(acao.tipo === 'demolir' ? 'construido' : 'demolido', { tipo: 'via', refs: [] });
  return { ok: true, dados: { acao: acao.tipo } };
}

// ------------------------------------------------------------------------------------------------ registro

export function registrar(sim) {
  sim.registrarComando('via.demolir', demolirVias);
  sim.registrarComando('via.desfazer', desfazer);
}
