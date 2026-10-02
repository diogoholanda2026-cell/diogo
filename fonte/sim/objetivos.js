// Objetivos (D58; dona: S3a): 3 abertos por vez, um da cidade, um da Holding e um da Arcologia, tirados do estado, e
// "Onde você parou" (q.retomar). A lista vem de data/objetivos.js; aqui fica a conta de cada medida.
//
// Formato de cada objetivo (q.objetivos e q.barra().objetivos): { id, texto (chave 's3.objetivo.*'), params,
// paramsChave (params que são chaves de texto: a interface traduz antes de montar a frase), quem, dominio, feito,
// total, alvo: { x, z } | { tela } | { ui } | null, recompensa: { xp, creditos } }.
import { OBJETIVOS, DOMINIOS_OBJETIVO, ETAPAS_M1A } from '../data/objetivos.js';
import { MARCOS } from '../data/marcos.js';
import { ZONAS_ORDEM } from '../data/zonas.js';
import { SERVICOS_ORDEM } from '../data/servicos.js';
import { ORDEM } from '../contratos/interno.js';
import { TIPO_PREDIO, ETAPA, GRAVIDADES } from '../contratos/flags.js';
import { RODADA } from '../comum/relogio.js';
import { componentes, noPerto } from './vias/grafo.js';
import { noDeEntrada } from './mundo/vila.js';
import { portaoNorte } from './mundo/areas.js';
import { finito } from './holding/base.js';
import { temMarca } from './historia.js';

const CARREGADO = new WeakMap(); // sim → tique em que a partida foi carregada (q.retomar().desde)

export const objetivosVazio = () => ({ feitos: [], abertos: { cidade: null, holding: null, arcologia: null } });
const O = (sim) => sim.json.objetivos;

// ------------------------------------------------------------------------------------------------ medidas

/** Tipos de serviço na ordem do catálogo da S2a (predios.modelo dos serviços). */
const ordemServicos = () => SERVICOS_ORDEM;

function contarServicos(sim, tipos) {
  const P = sim.tabelas.predios;
  const ordem = ordemServicos();
  const achados = new Set();
  if (P) for (let i = 0; i < P.n; i++) if (P.viva[i] && P.tipo[i] === TIPO_PREDIO.SERVICO) achados.add(ordem[P.modelo[i]]);
  return tipos.filter((t) => achados.has(t)).length;
}

function contarCelulas(sim, zona = null) {
  const C = sim.tabelas.celulas;
  if (!C) return 0;
  let s = 0;
  for (let i = 0; i < C.n; i++) if (C.viva[i] && C.zona[i] && (zona === null || C.zona[i] === zona)) s++;
  return s;
}

/** A primeira avenida liga o nó de entrada à gleba (portão norte)? */
function rodoviaLigaGleba(sim) {
  const G = sim.grafo;
  if (!G || !sim.json.mapa) return false;
  const a = noDeEntrada(sim);
  const [px, pz] = portaoNorte(sim);
  const b = noPerto(G, px, pz, 80);
  if (a < 0 || b < 0) return false;
  const comp = componentes(G);
  return comp[a] >= 0 && comp[a] === comp[b];
}

/** Etapas da Arcologia pelo espelho (X1b), ou a lista do M1a ainda trancada. */
function etapas(sim) {
  const e = sim.espelho.arcologia?.etapas ?? [];
  return e.length ? e : ETAPAS_M1A.map((id) => ({ id, estado: ETAPA.TRANCADA, progresso: 0 }));
}

/** Materiais que faltam numa etapa (q.arcologia da X1b; null sem ela). */
function faltaDaEtapa(sim, id) {
  if (!sim.q.arcologia) return null;
  try {
    for (const parte of sim.q.arcologia()?.partes ?? []) {
      for (const et of parte.etapas ?? []) {
        if (et.id !== id) continue;
        let melhor = null;
        for (const m of et.materiais ?? []) {
          const falta = Math.max(0, finito(m.pede) - finito(m.entregue));
          if (falta > 0 && (!melhor || falta > melhor.falta)) melhor = { item: m.item, falta, estoque: finito(m.estoque) };
        }
        return melhor;
      }
    }
  } catch {
    return null;
  }
  return null;
}

const chaveItem = (item) => `s3.item.${item}`;

/** Conta de uma medida: { feito, total, params?, paramsChave?, texto? }. */
function medir(sim, obj) {
  const [medida, arg] = obj.medida.split(':');
  const ag = sim.agregados;
  switch (medida) {
    case 'rodoviaGleba':
      return { feito: rodoviaLigaGleba(sim) ? 1 : 0, total: 1 };
    case 'servico':
      return { feito: Math.min(1, contarServicos(sim, [arg]) || (arg === 'captacao' && finito(ag.redes?.agua?.oferta) > 0 ? 1 : 0)), total: 1 };
    case 'servicos': {
      const tipos = arg.split(',');
      return { feito: contarServicos(sim, tipos), total: tipos.length };
    }
    case 'redeAgua':
      return { feito: finito(ag.redes?.agua?.oferta) > 0 ? 1 : 0, total: 1 };
    case 'redeEnergia':
      return { feito: finito(ag.redes?.energia?.oferta) > 0 ? 1 : 0, total: 1 };
    case 'celulasZoneadas':
      return { feito: Math.min(obj.total, contarCelulas(sim)), total: obj.total, params: { n: obj.total } };
    case 'celulasZona':
      return { feito: Math.min(obj.total, contarCelulas(sim, ZONAS_ORDEM.indexOf(arg))), total: obj.total, params: { n: obj.total } };
    case 'moradores':
      return { feito: Math.min(obj.total, Math.floor(finito(ag.populacao))), total: obj.total, params: { n: obj.total } };
    case 'bemEstar':
      return { feito: Math.min(obj.total, Math.round(finito(ag.bemEstarTarifa))), total: obj.total, params: { n: obj.total } };
    case 'xpMarco': {
      const m = sim.progresso.marco();
      if (m.xpProx === null) {
        const alvo = (Math.floor(finito(ag.populacao) / 5000) + 1) * 5000;
        return { feito: Math.floor(finito(ag.populacao)), total: alvo, params: { n: alvo }, texto: 's3.objetivo.cidade.crescer' };
      }
      const falta = Math.max(0, Math.ceil(m.xpProx - m.xp));
      const req = MARCOS[m.n + 1]?.requisito;
      return { feito: Math.max(0, Math.floor(m.xp - m.xpIni)), total: m.xpProx - m.xpIni, params: { n: falta, marco: m.n + 1, nome: MARCOS[m.n + 1].nome }, texto: req && falta === 0 ? 's3.objetivo.cidade.marcoTorre' : undefined };
    }
    case 'holding': {
      const n = sim.json.producao.predios.filter((e) => e.tipo === arg).length;
      return { feito: Math.min(1, n), total: 1 };
    }
    case 'linhasAuto': {
      const tipos = arg.split(',');
      const ok = tipos.filter((t) => sim.json.producao.predios.some((e) => e.tipo === t && e.linhas.some((l) => l.ativa && l.auto && l.n === 10)));
      return { feito: ok.length, total: tipos.length };
    }
    case 'vendasDeposito':
      return { feito: Math.min(1, sim.json.mercado.vendidasTotal), total: 1 };
    case 'estoqueEtapa': {
      const alvo = etapas(sim).find((e) => e.estado === ETAPA.DISPONIVEL || e.estado === ETAPA.EM_OBRA);
      const f = alvo ? faltaDaEtapa(sim, alvo.id) : null;
      if (f) {
        const est = sim.json.producao.estoque[f.item] ?? 0;
        return { feito: Math.min(f.falta, est), total: f.falta, params: { n: f.falta, item: f.item, etapa: alvo.id }, paramsChave: { item: chaveItem(f.item) } };
      }
      // sem a X1b: brita e areia para o reservatório (50 de cada, seção 14.2 do desenho)
      const est = sim.json.producao.estoque;
      const item = (est.brita ?? 0) <= (est.areia ?? 0) ? 'brita' : 'areia';
      return { feito: Math.min(50, est[item] ?? 0), total: 50, params: { n: 50, item }, paramsChave: { item: chaveItem(item) }, texto: 's3.objetivo.holding.estoque.base' };
    }
    case 'etapaIniciada': {
      const e = etapas(sim).find((x) => x.id === arg);
      return { feito: e && e.estado >= ETAPA.EM_OBRA ? 1 : 0, total: 1 };
    }
    case 'proximaEtapa': {
      const e = etapas(sim).find((x) => x.estado !== ETAPA.PRONTA);
      if (!e) return { feito: 1, total: 1, texto: 's3.objetivo.arcologia.inaugurada' };
      const f = faltaDaEtapa(sim, e.id);
      const params = { etapa: e.id };
      if (f) {
        params.n = f.falta;
        params.item = f.item;
        return { feito: Math.round(finito(e.progresso) * 100), total: 100, params, paramsChave: { item: chaveItem(f.item) }, texto: `s3.objetivo.arcologia.falta.${e.id}` };
      }
      return { feito: Math.round(finito(e.progresso) * 100), total: 100, params, texto: `s3.objetivo.arcologia.${e.id}` };
    }
    default:
      return { feito: 0, total: 1 };
  }
}

/** Alvo do objetivo: lugar sugerido pelo mapa, tela ou ferramenta. */
function alvoDe(sim, obj) {
  if (!obj.alvo) return null;
  const [tipo, id] = obj.alvo.split(':');
  if (tipo === 'tela') return { tela: id };
  if (tipo === 'ferramenta') return { ui: `ferramenta.${id}` };
  if (tipo === 'sugestao' && sim.q.sugestoes) {
    const s = sim.q.sugestoes().find((x) => x.id === id);
    if (!s) return null;
    if (Number.isFinite(s.x)) return { x: s.x, z: s.z };
    const pts = s.pontos ?? [];
    if (!pts.length) return null;
    const c = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
    return { x: c[0] / pts.length, z: c[1] / pts.length };
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ escolha

const pode = (sim, obj) => (obj.marco === undefined || sim.progresso.marco().n >= obj.marco) && (!obj.requer || temMarca(sim, obj.requer));

/** O objetivo aberto de um domínio: os que uma decisão pôs na frente, depois a lista, no primeiro não feito. */
function abertoDe(sim, dominio) {
  const o = O(sim);
  const extras = (sim.json.historia?.objetivosExtras ?? []).filter((x) => x.dominio === dominio).map((x) => OBJETIVOS.find((y) => y.id === x.id)).filter(Boolean);
  for (const obj of [...extras, ...OBJETIVOS.filter((x) => x.dominio === dominio)]) {
    if (o.feitos.includes(obj.id)) continue;
    if (obj.requer && !temMarca(sim, obj.requer)) continue;
    if (!pode(sim, obj)) continue;
    return obj;
  }
  return null;
}

function vista(sim, obj) {
  const m = medir(sim, obj);
  return {
    id: obj.id,
    texto: m.texto ?? `s3.objetivo.${obj.id}`,
    params: m.params ?? {},
    paramsChave: m.paramsChave ?? {},
    quem: obj.quem,
    dominio: obj.dominio,
    feito: m.feito,
    total: m.total,
    alvo: alvoDe(sim, obj),
    recompensa: { ...obj.recompensa },
  };
}

/** q.objetivos(): os 3 abertos (puro). */
export function consultaObjetivos(sim) {
  const out = [];
  for (const d of DOMINIOS_OBJETIVO) {
    const obj = abertoDe(sim, d);
    if (obj) out.push(vista(sim, obj));
  }
  return out;
}

/** Contínuos: refeitos pelo estado, nunca acabam (sempre há um aberto). */
const continuo = (obj) => obj.total === undefined;

function sistemaObjetivos(sim) {
  const o = O(sim);
  for (const d of DOMINIOS_OBJETIVO) {
    for (let guarda = 0; guarda < 8; guarda++) {
      const obj = abertoDe(sim, d);
      const id = obj?.id ?? null;
      if (o.abertos[d] !== id) {
        o.abertos[d] = id;
        if (id) sim.emitir('objetivo', { id, estado: 'aberto' });
      }
      if (!obj || continuo(obj)) break;
      const m = medir(sim, obj);
      if (!(m.feito >= m.total)) break;
      o.feitos.push(obj.id);
      if (obj.recompensa.xp) sim.progresso.xp(obj.recompensa.xp, 'objetivos');
      if (obj.recompensa.creditos) sim.holding.receber(obj.recompensa.creditos, 'marcos');
      sim.emitir('objetivo', { id: obj.id, estado: 'feito' });
    }
  }
}

// ------------------------------------------------------------------------------------------------ Onde você parou

const PESO = Object.fromEntries(GRAVIDADES.map((g, i) => [g, i]));

/** q.retomar(): o objetivo menos adiantado e o problema mais grave da barra. */
function consultaRetomar(sim) {
  const lista = consultaObjetivos(sim);
  let objetivo = null;
  for (const x of lista) {
    const r = x.total > 0 ? x.feito / x.total : 0;
    if (!objetivo || r < objetivo.r) objetivo = { ...x, r };
  }
  if (objetivo) delete objetivo.r;
  let problema = null;
  for (const a of sim.q.barra().alertas ?? []) {
    if (!problema || (PESO[a.gravidade] ?? 0) > (PESO[problema.gravidade] ?? 0)) problema = a;
  }
  return {
    objetivo,
    problema: problema ? { codigo: problema.codigo, params: { ...problema.params }, alvo: problema.alvo ?? null } : null,
    desde: CARREGADO.get(sim) ?? 0,
  };
}

function parteBarra(b, sim) {
  b.objetivos = consultaObjetivos(sim);
}

export function registrar(sim) {
  sim.registrarJson('objetivos', objetivosVazio());
  sim.registrarConsulta('objetivos', consultaObjetivos);
  sim.registrarConsulta('retomar', consultaRetomar);
  sim.registrarSistema(RODADA, RODADA - 1, sistemaObjetivos, 1, { nome: 'objetivos', ordem: ORDEM.progresso + 1 });
  sim.registrarParteBarra('s3a.objetivos', parteBarra);
  sim.aoCarregar(() => CARREGADO.set(sim, sim.tique));
}

