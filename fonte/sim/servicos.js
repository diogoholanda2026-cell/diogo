// Serviços com cobertura pela rede viária (seção 8.1 do desenho da simulação; dona: S2a). Para cada tipo de serviço,
// um Dijkstra de várias origens pelas vias, limitado ao raio dele; a aresta (e o prédio, pelo arco onde fica) guarda a
// origem mais perto e a distância. Cobertura = (1 - d / raio) x eficiência da origem; eficiência = min(1, capacidade /
// carga) x quadro de pessoal x a fração da manutenção que a Holding pagou (D41). Carga e eficiência uma vez por rodada.
//
// A cobertura é função pura do grafo e dos serviços prontos: refeita inteira quando o grafo muda e por tipo quando os
// serviços dele mudam (a busca de um tipo só olha o raio dele). Empate na distância fica com a origem de menor índice,
// então a conta incremental e a inteira dão o mesmo resultado, bit a bit (o carregar refaz inteira).
import { HeapMin } from '../comum/heap.js';
import { hipot } from '../comum/util.js';
import { RODADA } from '../comum/relogio.js';
import { TIPO_PREDIO } from '../contratos/flags.js';
import { ORDEM } from '../contratos/interno.js';
import { SERVICOS, SERVICOS_ORDEM, COBERTURAS, CATEGORIAS_SERVICO, FRACAO_ESTUDANTES } from '../data/servicos.js';
import { adjacencia } from './vias/grafo.js';
import { prediosNaCaixa } from './vias/validar.js';
import {
  prepararCidade, trans, acessoDe, funciona, familiaDe, registrarEfeitosPrevia, registrarPartePredio, manutencaoDe, plantaDe,
  viaComRede,
} from './predios.js';
import { ocupacaoDe, registrarParteCidade } from './cidadaos.js';

/** Tipos de serviço com cobertura pela via (os que têm raio), na ordem do índice. */
export const TIPOS_COBERTURA = Object.freeze(SERVICOS_ORDEM.filter((id) => SERVICOS[id].raio));

// ------------------------------------------------------------------------------------------------ busca

/**
 * Dijkstra de várias origens com rótulo: o par (distância, rótulo) mínimo, na ordem lexicográfica. fontes: lista de
 * [vértice, custo, rótulo]. Com manter, parte de dist e rot (só melhora: a conta incremental de um serviço novo).
 */
export function buscar(csr, fontes, limite, dist, rot, manter = false) {
  if (!manter) {
    dist.fill(Infinity);
    rot.fill(-1);
  }
  const h = new HeapMin(64);
  for (const [v, c, r] of fontes) {
    if (c > limite) continue;
    if (c < dist[v] || (c === dist[v] && r < rot[v])) {
      dist[v] = c;
      rot[v] = r;
      h.push(v, c);
    }
  }
  const { ini, dest, peso } = csr;
  while (!h.vazio) {
    const u = h.pop();
    const d = h.ultimaChave;
    if (d > dist[u]) continue;
    const ru = rot[u];
    for (let k = ini[u]; k < ini[u + 1]; k++) {
      const v = dest[k];
      const nd = d + peso[k];
      if (nd > limite) continue;
      if (nd < dist[v] || (nd === dist[v] && ru < rot[v])) {
        dist[v] = nd;
        rot[v] = ru;
        h.push(v, nd);
      }
    }
  }
}

const AC = { e: -1, s: 0 };

/** Serviços prontos de um tipo com acesso: [{ i, e, s }] em ordem de índice. */
function fontesDoTipo(sim, tipo) {
  const P = sim.tabelas.predios;
  const A = sim.tabelas.arestas;
  const m = SERVICOS_ORDEM.indexOf(tipo);
  const out = [];
  for (let i = 0; i < P.n; i++) {
    if (P.tipo[i] !== TIPO_PREDIO.SERVICO || P.modelo[i] !== m || !funciona(P, i)) continue;
    acessoDe(sim, i, AC);
    if (AC.e < 0 || !A.viva[AC.e]) continue;
    out.push({ i, e: AC.e, s: AC.s });
  }
  return out;
}

/** Garante a cobertura em dia (refaz o que sujou). Devolve { csr, tipos: { tipo: { dist, rot, raio, porAresta } } }. */
export function garantirCobertura(sim) {
  const t = trans(sim);
  const N = sim.tabelas.nos;
  const A = sim.tabelas.arestas;
  if (t.cob && !t.grafoSujo && !t.servSujo && t.cob.nNos === N.n) return t.cob;
  const novoGrafo = !t.cob || t.grafoSujo || t.cob.nNos !== N.n;
  const cob = novoGrafo ? { csr: adjacencia(sim.grafo, { respeitarMao: false }), nNos: N.n, tipos: {}, versao: (t.cob?.versao ?? 0) + 1 } : t.cob;
  t.grafoSujo = false;
  t.servSujo = false;
  for (const tipo of TIPOS_COBERTURA) {
    const lista = fontesDoTipo(sim, tipo);
    const assin = lista.map((f) => `${f.i}:${f.e}:${f.s}`).join('|');
    const ant = cob.tipos[tipo];
    if (!novoGrafo && ant && ant.assin === assin) continue;
    const raio = SERVICOS[tipo].raio;
    const fontes = [];
    // incremental: as fontes antigas continuam todas (só entrou serviço novo) e o grafo é o mesmo
    const velhas = ant && !novoGrafo ? new Set(ant.assin ? ant.assin.split('|') : []) : null;
    const incremental = !!velhas && lista.length >= velhas.size && [...velhas].every((k) => assin.split('|').includes(k));
    for (const f of lista) {
      if (incremental && velhas.has(`${f.i}:${f.e}:${f.s}`)) continue;
      fontes.push([A.a[f.e], f.s, f.i], [A.b[f.e], Math.max(0, A.arco[17 * f.e + 16] - f.s), f.i]);
    }
    const tc = incremental ? ant : { dist: new Float64Array(N.n), rot: new Int32Array(N.n), raio };
    buscar(cob.csr, fontes, raio, tc.dist, tc.rot, incremental);
    tc.assin = assin;
    tc.porAresta = new Map();
    for (const f of lista) {
      const l = tc.porAresta.get(f.e);
      if (l) l.push(f);
      else tc.porAresta.set(f.e, [f]);
    }
    tc.n = lista.length;
    cob.tipos[tipo] = tc;
    cob.versao++;
  }
  t.cob = cob;
  return cob;
}

const DR = { d: Infinity, r: -1 };

/** Distância pela via do ponto de arco s na aresta e até o serviço do tipo mais perto: out = { d, r (idx do serviço) }. */
export function distanciaTipo(sim, tipo, e, s, out = DR) {
  const tc = garantirCobertura(sim).tipos[tipo];
  out.d = Infinity;
  out.r = -1;
  if (!tc || !tc.n || e < 0) return out;
  const A = sim.tabelas.arestas;
  const a = A.a[e];
  const b = A.b[e];
  const comp = A.arco[17 * e + 16];
  if (a < tc.dist.length) {
    out.d = tc.dist[a] + s;
    out.r = tc.rot[a];
  }
  if (b < tc.dist.length) {
    const db = tc.dist[b] + Math.max(0, comp - s);
    if (db < out.d || (db === out.d && tc.rot[b] < out.r)) {
      out.d = db;
      out.r = tc.rot[b];
    }
  }
  for (const f of tc.porAresta.get(e) ?? []) {
    const dd = Math.abs(f.s - s);
    if (dd < out.d || (dd === out.d && f.i < out.r)) {
      out.d = dd;
      out.r = f.i;
    }
  }
  return out;
}

/** Cobertura (0 a 1, já vezes a eficiência) de uma categoria no ponto (e, s): o melhor tipo da categoria. */
export function coberturaNoPonto(sim, cat, e, s) {
  const P = sim.tabelas.predios;
  let melhor = 0;
  for (const tipo of TIPOS_COBERTURA) {
    if (SERVICOS[tipo].categoria !== cat) continue;
    distanciaTipo(sim, tipo, e, s, DR);
    if (DR.r < 0 || DR.d >= SERVICOS[tipo].raio) continue;
    const c = (1 - DR.d / SERVICOS[tipo].raio) * (P.efic[DR.r] || 0);
    if (c > melhor) melhor = c;
  }
  return melhor;
}

/** Cobertura de uma categoria no prédio i (pela via de acesso dele; 0 sem acesso). */
export function coberturaPredio(sim, i, cat) {
  acessoDe(sim, i, AC);
  if (AC.e < 0) return 0;
  return coberturaNoPonto(sim, cat, AC.e, AC.s);
}

/**
 * Cobertura de cada categoria no meio de cada aresta (Float32Array de COBERTURAS.length x arestas.n, categoria k na
 * fatia k), em cache até a busca ou a eficiência de algum serviço mudar. O valor do terreno e a camada leem daqui.
 */
export function coberturaArestas(sim) {
  const t = trans(sim);
  const cob = garantirCobertura(sim);
  const A = sim.tabelas.arestas;
  const c = t.cobArestas;
  const efic = t.eficVersao ?? 0;
  if (c && c.versao === cob.versao && c.efic === efic && c.n === A.n) return c.dados;
  const dados = new Float32Array(COBERTURAS.length * A.n);
  if (TIPOS_COBERTURA.some((tipo) => cob.tipos[tipo]?.n)) {
    for (let e = 0; e < A.n; e++) {
      if (!A.viva[e]) continue;
      const s = A.arco[17 * e + 16] / 2;
      for (let k = 0; k < COBERTURAS.length; k++) dados[k * A.n + e] = coberturaNoPonto(sim, COBERTURAS[k], e, s);
    }
  }
  t.cobArestas = { versao: cob.versao, efic, n: A.n, dados };
  return dados;
}

// ------------------------------------------------------------------------------------------------ carga e eficiência

/** Quadro de pessoal (0,6 a 1 pela ocupação das vagas) vezes a fração da manutenção paga (D41). */
export function pessoalEPagamento(sim, i) {
  const oc = ocupacaoDe(sim, i).frac;
  const pago = typeof sim.economia?.eficiencia === 'function' ? sim.economia.eficiencia() : 1;
  return (0.6 + 0.4 * oc) * (Number.isFinite(pago) ? Math.max(0, Math.min(1, pago)) : 1);
}

/** Carga e eficiência de todos os serviços (uma vez por rodada; também quando um serviço fica pronto). */
export function sistemaCargas(sim) {
  const P = sim.tabelas.predios;
  const A = sim.tabelas.arestas;
  garantirCobertura(sim);
  // moradores por aresta (no meio dela): a carga é por aresta atendida
  const mor = new Float64Array(A.n);
  for (let i = 0; i < P.n; i++) {
    if (!funciona(P, i) || P.tipo[i] !== TIPO_PREDIO.ZONA || !P.moradores[i] || familiaDe(sim, i) !== 'res') continue;
    acessoDe(sim, i, AC);
    if (AC.e >= 0 && AC.e < A.n) mor[AC.e] += P.moradores[i];
  }
  const carga = new Float64Array(P.n);
  for (const tipo of TIPOS_COBERTURA) {
    const def = SERVICOS[tipo];
    if (!garantirCobertura(sim).tipos[tipo]?.n) continue;
    const f = def.carga === 'estudantes' ? FRACAO_ESTUDANTES : 1;
    for (let e = 0; e < A.n; e++) {
      if (!mor[e] || !A.viva[e]) continue;
      distanciaTipo(sim, tipo, e, A.arco[17 * e + 16] / 2, DR);
      if (DR.r >= 0 && DR.d < def.raio) carga[DR.r] += mor[e] * f;
    }
  }
  for (let i = 0; i < P.n; i++) {
    if (P.tipo[i] !== TIPO_PREDIO.SERVICO || !P.viva[i]) continue;
    atualizarServico(sim, i, carga[i]);
  }
}

/** Eficiência de um serviço com a carga dada (0 na obra e no abandono). */
export function atualizarServico(sim, i, carga = null) {
  const P = sim.tabelas.predios;
  const def = SERVICOS[SERVICOS_ORDEM[P.modelo[i]]];
  if (!def || !funciona(P, i)) {
    P.efic[i] = 0;
    return;
  }
  if (carga !== null) P.carga[i] = carga;
  const cap = def.capacidade;
  const pelaCarga = def.raio && cap ? Math.min(1, cap / Math.max(1, P.carga[i])) : 1;
  const novo = Math.fround(pelaCarga * pessoalEPagamento(sim, i));
  if (novo !== P.efic[i]) {
    // a cobertura depende da eficiência das origens: o cache por aresta fica velho (a busca não muda)
    P.efic[i] = novo;
    const t = trans(sim);
    t.eficVersao = (t.eficVersao ?? 0) + 1;
  }
}

// ------------------------------------------------------------------------------------------------ camada e consultas

function camadaServicos(sim) {
  const A = sim.tabelas.arestas;
  const cob = coberturaArestas(sim);
  const dados = new Float32Array(A.n);
  let soma = 0;
  let n = 0;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    let v = 0;
    for (let k = 0; k < COBERTURAS.length; k++) v += cob[k * A.n + e];
    dados[e] = v / COBERTURAS.length;
    soma += dados[e];
    n++;
  }
  return {
    id: 'servicos', fonte: 'arestas', dados, grade: null, tipo: 'seq', escala: { min: 0, max: 1, unidade: '%' }, categorias: null,
    legenda: [{ v: 0, chave: 'camada.servicos.sem' }, { v: 1, chave: 'camada.servicos.completo' }],
    resumo: { chave: 'camada.servicos.resumo', params: { media: n ? Math.round((100 * soma) / n) : 0 } },
    versao: sim.json.cidade.rodada * 1000 + (trans(sim).cob?.versao ?? 0) % 1000,
  };
}

function partePredio(sim, i, out) {
  const P = sim.tabelas.predios;
  const cob = {};
  for (const cat of COBERTURAS) cob[cat] = Math.round(coberturaPredio(sim, i, cat) * 100) / 100;
  out.servicos = { ...(out.servicos ?? {}), ...cob };
  if (P.tipo[i] !== TIPO_PREDIO.SERVICO) return;
  const tipo = SERVICOS_ORDEM[P.modelo[i]];
  const def = SERVICOS[tipo];
  if (!def) return;
  out.servico = {
    tipo, categoria: def.categoria, capacidade: def.capacidade, uso: Math.round(P.carga[i]), eficiencia: Math.round(P.efic[i] * 100) / 100,
    alcance: def.raio ?? 0, manutencaoHora: def.manutencaoHora, rede: !!CATEGORIAS_SERVICO[def.categoria]?.rede,
  };
}

function parteCidade(sim, out) {
  const P = sim.tabelas.predios;
  const porTipo = {};
  for (let i = 0; i < P.n; i++) {
    if (P.tipo[i] !== TIPO_PREDIO.SERVICO || !P.viva[i]) continue;
    const tipo = SERVICOS_ORDEM[P.modelo[i]];
    const def = SERVICOS[tipo];
    const x = porTipo[tipo] ?? (porTipo[tipo] = { tipo, categoria: def.categoria, n: 0, prontos: 0, capacidade: 0, carga: 0, eficiencia: 0, manutencaoHora: 0 });
    x.n++;
    x.manutencaoHora += def.manutencaoHora;
    if (!funciona(P, i)) continue;
    x.prontos++;
    x.capacidade += def.capacidade ?? 0;
    x.carga += P.carga[i];
    x.eficiencia += P.efic[i];
  }
  const lista = SERVICOS_ORDEM.filter((t) => porTipo[t]).map((t) => {
    const x = porTipo[t];
    return { ...x, carga: Math.round(x.carga), eficiencia: x.prontos ? Math.round((100 * x.eficiencia) / x.prontos) / 100 : 0 };
  });
  // fração dos moradores atendidos por categoria
  const cobertura = {};
  let total = 0;
  for (const cat of COBERTURAS) cobertura[cat] = 0;
  for (let i = 0; i < P.n; i++) {
    if (!funciona(P, i) || P.tipo[i] !== TIPO_PREDIO.ZONA || !P.moradores[i]) continue;
    total += P.moradores[i];
    for (const cat of COBERTURAS) cobertura[cat] += P.moradores[i] * coberturaPredio(sim, i, cat);
  }
  for (const cat of COBERTURAS) cobertura[cat] = total ? Math.round((100 * cobertura[cat]) / total) / 100 : 0;
  out.servicos = lista;
  out.cobertura = cobertura;
}

/** Efeitos da prévia de um serviço: moradores que passam a ser atendidos (cobertura) ou a oferta da rede. */
function efeitosPrevia(sim, tipo, def, L) {
  const s = SERVICOS[tipo];
  if (!s) return [];
  // produtor de frente para uma rua sem canos nem cabos (terra): nada chega à rede até melhorar a rua
  if (!s.raio) return s.capacidade ? [{ camada: s.categoria, delta: viaComRede(sim, L.e) ? s.capacidade : 0 }] : [];
  const P = sim.tabelas.predios;
  let novos = 0;
  const r = s.raio * 0.8; // pela via o alcance é menor que em linha reta
  for (const i of prediosNaCaixa(sim, L.x - r, L.z - r, L.x + r, L.z + r)) {
    if (!funciona(P, i) || !P.moradores[i] || hipot(P.x[i] - L.x, P.z[i] - L.z) > r) continue;
    novos += P.moradores[i] * (1 - Math.min(1, coberturaPredio(sim, i, s.categoria)));
  }
  return [{ camada: 'servicos', delta: Math.round(novos) }];
}

/** Manutenção por hora de jogo dos serviços prontos (a S3a soma e paga, D41); uma conta por tique. */
const CUSTO = new WeakMap();
export function custoServicos(sim) {
  const c = CUSTO.get(sim);
  if (c && c.tique === sim.tique && c.n === sim.tabelas.predios.vivos) return c.v;
  const P = sim.tabelas.predios;
  let v = 0;
  for (let i = 0; i < P.n; i++) if (P.tipo[i] === TIPO_PREDIO.SERVICO && funciona(P, i)) v += manutencaoDe(SERVICOS[SERVICOS_ORDEM[P.modelo[i]]]);
  CUSTO.set(sim, { tique: sim.tique, n: P.vivos, v });
  return v;
}

// ------------------------------------------------------------------------------------------------ registro

export function registrar(sim) {
  if (!sim.tabelas.predios || !sim.grafo) return;
  prepararCidade(sim);
  for (const tipo of SERVICOS_ORDEM) {
    const s = SERVICOS[tipo];
    sim.colocaveis.registrar(tipo, { ...s, tipo, tipoPredio: TIPO_PREDIO.SERVICO, planta: plantaDe(s), alcance: s.raio ?? 0 });
  }
  // manutenção dos serviços prontos (a S3a soma e paga, D41)
  sim.custos.registrar('servicos', custoServicos);
  sim.registrarSistema(RODADA, 15, sistemaCargas, 1, { nome: 'servicos', ordem: ORDEM.servicos });
  sim.camadas.registrar('servicos', camadaServicos);
  registrarPartePredio(partePredio);
  registrarParteCidade(parteCidade);
  registrarEfeitosPrevia(efeitosPrevia);
  sim.aoCarregar(() => garantirCobertura(sim));
}
