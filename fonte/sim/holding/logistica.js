// Entregas e frota da Holding (D47; dona: S3a): o teto da frota vale só para as entregas da Arcologia (armazém para o
// canteiro). Um caminhão leva até 10 unidades (mais que isso vira várias viagens); a viagem dura o tempo da rota A*
// pelas vias na velocidade do caminhão (sem via, a linha reta com desvio). Frota: 6 no começo, a do armazém por nível
// (+6 por nível) e +6 com torre.e2 (sim.holding.efeito). Entregas visuais (Depósito, importação) ficam fora do teto.
//
// sim.holding.entregar({ item, n, origem = 'armazem', destino, aoChegar, visual }) → id (o da primeira viagem) ou -1:
//   - origem/destino: ref de prédio, { x, z }, 'armazem', 'entrada' (o nó da rodovia) ou o id de uma etapa
//     ('lago.e1', 'torre.e2': o canteiro da Arcologia);
//   - n de 1 a 1.000 e item do catálogo (ou null); fora disso volta -1;
//   - fora do teto (visual: false) e saindo do armazém, as n unidades saem do estoque na hora do pedido (sem estoque
//     bastante, nada acontece e volta -1); a reserva não conta aqui (ela existe para guardar material para a Arcologia);
//   - aoChegar: função (fica só na memória: um save no meio da viagem a perde) ou, melhor, o NOME de um tratador
//     registrado por sim.holding.registrarChegada(nome, fn), que sobrevive ao save. fn({ id, grupo, item, n, origem,
//     destino }) roda no tique da chegada.
// espelho.entregas: [{ id, item, n, caminho: Int32Array (arestas; negativo = sentido b para a), tIni, tFim, visual }].
import { PRODUCAO } from '../../data/holding.js';
import { VIAS, VIAS_ORDEM } from '../../data/vias.js';
import { GLEBA_ENVELOPE, TORRE_POSICAO } from '../../data/arcologia-plano.js';
import { MAPA_HELDOPOLIS } from '../../data/mapa-heldopolis.js';
import { ORDEM } from '../../contratos/interno.js';
import { idxDaRef, gerDaRef } from '../../contratos/espelho.js';
import { MES } from '../../comum/relogio.js';
import { hipot } from '../../comum/util.js';
import { aEstrela } from '../../comum/caminhos.js';
import { adjacencia, noPerto } from '../vias/grafo.js';
import { finito } from './base.js';
import { frotaTotal, armazemPerto, tirarEstoque, ehItem } from './producao.js';

export function logisticaVazia() {
  return {
    seq: 0,
    fila: [], // pedidos esperando caminhão: { id, grupo, item, n, origem, destino, aoChegar, pedido, visual }
    andando: [], // viagens: os mesmos campos e tIni, tFim, caminho
    stats: { feitas: 0, esperaTotal: 0, esperaMax: 0, filaMax: 0, porDestino: {} },
  };
}

/** Maior entrega de um pedido (100 viagens de 10). */
const ENTREGA_MAX = 1000;

const FUNCOES = new WeakMap(); // sim → Map(id → fn)
const CHEGADAS = new WeakMap(); // sim → Map(nome → fn)
const CSR = new WeakMap(); // sim → { chave, g, vmax }

const L = (sim) => sim.json.logistica;

/** Registra um tratador de chegada pelo nome (sobrevive ao save). */
export function registrarChegada(sim, nome, fn) {
  if (typeof nome !== 'string' || typeof fn !== 'function') throw new Error('registrarChegada(nome, fn)');
  let m = CHEGADAS.get(sim);
  if (!m) CHEGADAS.set(sim, (m = new Map()));
  m.set(nome, fn);
}

/** Forma JSON de uma ponta (ref, { x, z } ou nome). */
function ponta(p) {
  if (Number.isInteger(p)) return p;
  if (p && typeof p === 'object' && Number.isFinite(p.x) && Number.isFinite(p.z)) return { x: p.x, z: p.z };
  if (typeof p === 'string') return p;
  return 'armazem';
}

/** Posição de uma ponta no mundo. */
export function posicao(sim, p) {
  if (Number.isInteger(p)) {
    const P = sim.tabelas.predios;
    const i = P && p >= 0 ? idxDaRef(p) : -1;
    if (i >= 0 && i < P.n && P.viva[i] && P.ger[i] === gerDaRef(p)) return { x: P.x[i], z: P.z[i] };
    return { x: GLEBA_ENVELOPE.centro[0], z: GLEBA_ENVELOPE.centro[1] };
  }
  if (p && typeof p === 'object') return { x: p.x, z: p.z };
  if (p === 'armazem') {
    const a = armazemPerto(sim, TORRE_POSICAO.x, TORRE_POSICAO.z);
    if (a) return { x: a.x, z: a.z };
    return { x: MAPA_HELDOPOLIS.entrada.x, z: MAPA_HELDOPOLIS.entrada.z };
  }
  if (p === 'entrada') return { x: MAPA_HELDOPOLIS.entrada.x, z: MAPA_HELDOPOLIS.entrada.z };
  if (typeof p === 'string' && /^(torre|lago|arcologia|etapa)/.test(p)) return { x: TORRE_POSICAO.x, z: TORRE_POSICAO.z };
  return { x: GLEBA_ENVELOPE.centro[0], z: GLEBA_ENVELOPE.centro[1] };
}

/**
 * Grafo compacto com o tempo de viagem do caminhão por aresta (refeito quando as vias mudam e a cada mês). A chave usa a
 * versão do grafo: só as contagens não bastam (demolir e construir no mesmo tique reaproveita a vaga com outras pontas,
 * e a rota velha daria outra duração que a de uma partida carregada, que refaz o grafo).
 */
function grafoTempo(sim) {
  const G = sim.grafo;
  const A = G.arestas;
  const N = G.nos;
  const chave = `${G.versao ?? 0}:${A.n}:${A.vivos}:${N.n}:${N.vivos}:${Math.floor(sim.tique / MES)}`;
  const c = CSR.get(sim);
  if (c && c.chave === chave) return c;
  let vmax = 1;
  const g = adjacencia(G, {
    custo: (e) => {
      const v = ((VIAS[VIAS_ORDEM[A.tipo[e]]]?.velocidade ?? 40) / 3.6) * PRODUCAO.caminhao.fatorVelocidade;
      if (v > vmax) vmax = v;
      return A.comp[e] / v;
    },
  });
  const novo = { chave, g, vmax };
  CSR.set(sim, novo);
  return novo;
}

/** Rota e duração (tiques) entre dois pontos: A* pelas vias ou linha reta. */
export function rota(sim, a, b) {
  const cam = PRODUCAO.caminhao;
  const reta = () => ({ caminho: [], duracao: Math.max(10, Math.round((hipot(b.x - a.x, b.z - a.z) * cam.desvioSemVia) / cam.velocidadeSemVia)) });
  const G = sim.grafo;
  if (!G || G.nos.vivos < 2) return reta();
  const na = noPerto(G, a.x, a.z, 800);
  const nb = noPerto(G, b.x, b.z, 800);
  if (na < 0 || nb < 0 || na === nb) return reta();
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const { g, vmax } = grafoTempo(sim);
    const r = aEstrela(g, na, nb, { x: G.nos.x, z: G.nos.z, fator: 1 / vmax });
    if (!r) return reta();
    const refs = Array.from(r.refs ?? []);
    if (refs.some((e) => !G.arestas.viva[e < 0 ? ~e : e])) {
      CSR.delete(sim);
      continue;
    }
    const pontas = (hipot(G.nos.x[na] - a.x, G.nos.z[na] - a.z) + hipot(G.nos.x[nb] - b.x, G.nos.z[nb] - b.z)) / cam.velocidadeSemVia;
    return { caminho: refs, duracao: Math.max(10, Math.round(r.custo + pontas)) };
  }
  return reta();
}

function partir(sim, e, duracao = null) {
  const a = posicao(sim, e.origem);
  const b = posicao(sim, e.destino);
  const r = duracao ? { caminho: [], duracao } : rota(sim, a, b);
  e.tIni = sim.tique;
  e.tFim = sim.tique + r.duracao;
  e.caminho = r.caminho;
  L(sim).andando.push(e);
}

const emViagem = (sim) => L(sim).andando.reduce((a, e) => a + (e.visual ? 0 : 1), 0);

/** Põe na estrada o que cabe na frota. */
function despachar(sim) {
  const l = L(sim);
  const total = frotaTotal(sim);
  let usados = emViagem(sim);
  let mudou = false;
  while (l.fila.length && usados < total) {
    const e = l.fila.shift();
    const espera = sim.tique - e.pedido;
    l.stats.esperaTotal += espera;
    if (espera > l.stats.esperaMax) l.stats.esperaMax = espera;
    const chave = typeof e.destino === 'string' ? e.destino : 'outro';
    const d = l.stats.porDestino[chave] ?? (l.stats.porDestino[chave] = { viagens: 0, espera: 0, viagem: 0 });
    d.viagens++;
    d.espera += espera;
    partir(sim, e);
    d.viagem += e.tFim - e.tIni;
    usados++;
    mudou = true;
  }
  return mudou;
}

/**
 * Pede uma entrega (contrato interno 2.10). Devolve o id da primeira viagem, ou -1 sem estoque para sair do armazém.
 */
export function entregar(sim, { item = null, n = 1, origem = 'armazem', destino = null, aoChegar = null, visual = false } = {}) {
  const l = L(sim);
  // de 1 a ENTREGA_MAX unidades (n = 0 não leva uma unidade por engano; n enorme não enche a fila de viagens)
  const total = Math.floor(finito(n, 1));
  if (total < 1 || total > ENTREGA_MAX) return -1;
  if (item !== null && !ehItem(item)) return -1;
  const o = ponta(origem);
  if (!visual && o === 'armazem' && item) {
    const tem = sim.json.producao?.estoque?.[item] ?? 0;
    if (tem < total) return -1;
    tirarEstoque(sim, item, total);
  }
  const cap = PRODUCAO.caminhao.capacidade;
  let grupo = -1;
  for (let resto = total; resto > 0; resto -= cap) {
    const id = ++l.seq;
    if (grupo < 0) grupo = id;
    const e = {
      id, grupo, item, n: Math.min(cap, resto), origem: o, destino: ponta(destino), aoChegar: typeof aoChegar === 'string' ? aoChegar : null,
      pedido: sim.tique, visual: !!visual, tIni: 0, tFim: 0, caminho: [],
    };
    if (typeof aoChegar === 'function') {
      let m = FUNCOES.get(sim);
      if (!m) FUNCOES.set(sim, (m = new Map()));
      m.set(id, aoChegar);
    }
    if (e.visual) partir(sim, e);
    else l.fila.push(e);
  }
  if (l.fila.length > l.stats.filaMax) l.stats.filaMax = l.fila.length;
  despachar(sim);
  publicar(sim);
  return grupo;
}

/** Entrega só visual (Depósito, importação): fora do teto, sem tratador. */
export function novaEntregaVisual(sim, { item, n, origem, destino, duracao = null }) {
  const l = L(sim);
  if (!l) return -1;
  const id = ++l.seq;
  const e = { id, grupo: id, item, n, origem: ponta(origem), destino: ponta(destino), aoChegar: null, pedido: sim.tique, visual: true, tIni: 0, tFim: 0, caminho: [] };
  partir(sim, e, duracao);
  publicar(sim);
  return id;
}

/** espelho.entregas a partir das viagens (o render relê a cada quadro). */
function publicar(sim) {
  sim.espelho.entregas = L(sim).andando.map((e) => ({
    id: e.id, item: e.item, n: e.n, caminho: Int32Array.from(e.caminho), tIni: e.tIni, tFim: e.tFim, visual: e.visual,
  }));
  sim.mudancas.marcar('entregas');
}

function sistemaEntregas(sim, k, fatias, T) {
  const l = L(sim);
  let mudou = false;
  if (l.andando.length) {
    const chegam = l.andando.filter((e) => e.tFim <= T);
    if (chegam.length) {
      l.andando = l.andando.filter((e) => e.tFim > T);
      mudou = true;
      for (const e of chegam) {
        if (!e.visual) l.stats.feitas++;
        const f = FUNCOES.get(sim)?.get(e.id) ?? (e.aoChegar ? CHEGADAS.get(sim)?.get(e.aoChegar) : null) ?? (typeof e.destino === 'string' ? CHEGADAS.get(sim)?.get(e.destino) : null);
        FUNCOES.get(sim)?.delete(e.id);
        if (f) f({ id: e.id, grupo: e.grupo, item: e.item, n: e.n, origem: e.origem, destino: e.destino });
      }
    }
  }
  if (l.fila.length && despachar(sim)) mudou = true;
  if (mudou) publicar(sim);
}

/** Frota para q.producao: usados, total, fila, atraso médio (tiques de espera por caminhão) e por destino. */
export function frotaVista(sim) {
  const l = L(sim);
  const despachadas = Object.values(l.stats.porDestino).reduce((a, d) => a + d.viagens, 0);
  const porDestino = {};
  for (const k of Object.keys(l.stats.porDestino).sort()) {
    const d = l.stats.porDestino[k];
    porDestino[k] = { viagens: d.viagens, esperaMedia: d.viagens ? d.espera / d.viagens : 0, viagemMedia: d.viagens ? d.viagem / d.viagens : 0 };
  }
  return {
    usados: emViagem(sim),
    total: frotaTotal(sim),
    fila: l.fila.length,
    atrasoMedio: despachadas ? l.stats.esperaTotal / despachadas : 0,
    esperaMax: l.stats.esperaMax,
    filaMax: l.stats.filaMax,
    feitas: l.stats.feitas,
    porDestino,
  };
}

export function registrar(sim) {
  sim.registrarJson('logistica', logisticaVazia());
  sim.registrarSistema(1, 0, sistemaEntregas, 1, { nome: 'holding.logistica', ordem: ORDEM.holding + 2 });
  // ao carregar: as funções aoChegar (só na memória) e o grafo de tempo são da partida anterior; ids de viagem do save
  // podem coincidir com os delas
  sim.aoCarregar(() => {
    FUNCOES.delete(sim);
    CSR.delete(sim);
    publicar(sim);
  });
}

