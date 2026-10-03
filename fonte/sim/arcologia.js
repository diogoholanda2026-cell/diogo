// Arcologia jogável (D26, D49, D51, D59, D88 a D90; dona: X1b): as etapas do M1a da sede v3, Park of Future Dreams
// (lago.e1, o Mirror Lake com o reservatório e os portões; torre.e1 a torre.e4, a Blade Tower e a Legacy Tower), com os
// materiais entregues pela frota da Holding (D47), o caixa que nunca fica negativo (D41) e os efeitos da D49 no laço.
//
// Uma etapa: trancada até o marco que a libera e a anterior pronta; arcologia.iniciar paga os créditos e abre a obra;
// os caminhões levam o que há no armazém (o resto chega quando a Holding produz ou importa); o trabalho anda um tique
// por tique enquanto há material para a fase e caixa; pronta, aplica os efeitos, dá o XP e avisa (evento 'etapa').
// lago.e1 registra a cava do Mirror Lake no aplainar ao começar e, pronta, liga as vias internas no grafo com a flag
// ARCOLOGIA (os 8 portões) e o reservatório na rede de água. O marco 7 pede a torre.e4 pronta.
//
// Publica: comando arcologia.iniciar, consulta arcologia, espelho.arcologia, evento etapa e sim.arcologia (vagas,
// moradores de luxo, a Contribuição deles, que a economia soma na dos moradores, e o valor da obra, que entra na
// valuation). Estado na seção 'arcologia' (save e hash).
import { ETAPA, ARESTA } from '../contratos/flags.js';
import { ORDEM } from '../contratos/interno.js';
import { refDe } from '../contratos/espelho.js';
import { RODADA } from '../comum/relogio.js';
import { cos, sen, hipot } from '../comum/util.js';
import {
  ETAPAS, ETAPAS_ORDEM, ETAPAS_M2, etapaDe, duracaoDe, avancoDaTorre, alturaBlade, alturaLegacy, ALTURA_PONTE,
} from '../data/arcologia.js';
import {
  PLANOS, PLANO_ESCOLHIDO, PARTES_ORDEM, PARTES_NOMES, GLEBA_ENVELOPE, SEDE_CENTRO, cavaDoPlano, PAR,
} from '../data/arcologia-plano.js';
import { REGRAS_DONO, tarifaPelasRegras } from '../data/economia.js';
import { ITENS } from '../data/holding.js';
import { dataDoTique } from '../data/historia.js';
import { addNo, addAresta, noPerto } from './vias/grafo.js';
import { CHAO_ABAIXO_DA_PISTA } from './mundo/aplainar.js';
import { concederLicencas } from './mundo/ladrilhos.js';
import { postarMural } from './holding/base.js';

/** ref da cava do Mirror Lake no aplainar (desempate entre formas; a etapa dona é a lago.e1). */
export const REF_CAVA = 1;

/** Nome do tratador de chegada dos caminhões (sobrevive ao save, D47). */
const CHEGADA = 'arcologia';

const J = (sim) => sim.json.arcologia;

/** Estado vazio de uma etapa. */
const etapaVazia = () => ({ estado: ETAPA.TRANCADA, ini: -1, fim: -1, trabalho: 0, pago: 0, entregue: {}, pedido: {}, parada: null });

/** Seção 'arcologia' de uma partida nova. */
export function arcologiaVazia() {
  return {
    plano: PLANO_ESCOLHIDO,
    etapas: Object.fromEntries(ETAPAS_ORDEM.map((id) => [id, etapaVazia()])),
    cava: -1, // id da forma no aplainar
    produtor: -1, // id do reservatório na rede de água
    noAgua: -1, // ref do nó do anel viário onde o reservatório entra na rede
    vias: [], // refs das arestas internas
    portoes: [], // refs dos nós dos portões
    efeitos: { vagas: [0, 0, 0, 0], luxo: 0, bemEstarLuxo: 0 },
    marcos: [], // anúncios de altura já feitos no Mural (330, ponte)
  };
}

// ------------------------------------------------------------------------------------------------ leitura

/** Estado (ETAPA.*) de uma etapa jogável; TRANCADA se não existir. */
export const estadoDe = (sim, id) => J(sim)?.etapas?.[id]?.estado ?? ETAPA.TRANCADA;

/** Fração dos materiais da etapa que já chegou ao canteiro: o mínimo, item a item, de entregue / pedido. */
export function fracMateriais(def, e) {
  let f = 1;
  for (const [item, n] of Object.entries(def.materiais)) if (n > 0) f = Math.min(f, (e.entregue[item] ?? 0) / n);
  return f;
}

/** Progresso (0 a 1) de uma etapa. */
export function progressoDe(def, e) {
  if (e.estado === ETAPA.PRONTA) return 1;
  if (e.estado !== ETAPA.EM_OBRA) return 0;
  return Math.min(1, e.trabalho / duracaoDe(def));
}

/** Fase (0 a 3) pelo progresso: a pronta fica na última. */
export function faseDe(def, e) {
  if (e.estado === ETAPA.PRONTA) return def.fases.length - 1;
  if (e.estado !== ETAPA.EM_OBRA) return 0;
  return Math.min(def.fases.length - 1, Math.floor(progressoDe(def, e) * def.fases.length));
}

/** A etapa pode começar? null se pode, senão o código de recusa (contrato do comando). */
function recusa(sim, def, e) {
  if (e.estado === ETAPA.EM_OBRA) return 'emObra';
  if (e.estado === ETAPA.PRONTA) return 'nada';
  if (!sim.progresso.liberado(`etapa.${def.id}`)) return 'marco';
  if (def.requisito && estadoDe(sim, def.requisito) !== ETAPA.PRONTA) return 'trancado';
  return null;
}

/** Estoque de um item na Holding (sem a S3a, o substituto entrega de graça: sem limite). */
const estoque = (sim, item) => (typeof sim.holding.estoque === 'function' ? sim.holding.estoque(item) : Infinity);

/** Valor da obra (créditos pagos e materiais entregues a preço base): o patrimônio que a Arcologia soma. */
export function valorDaObra(sim) {
  let v = 0;
  for (const id of ETAPAS_ORDEM) {
    const e = J(sim).etapas[id];
    v += e.pago;
    for (const [item, n] of Object.entries(e.entregue)) v += n * (ITENS[item]?.base ?? 0);
  }
  return v;
}

// ------------------------------------------------------------------------------------------------ espelho

/** Publica espelho.arcologia ({ plano, etapas: [{ id, parte, estado, fase, progresso }] }) e marca o diário. */
function publicar(sim, forcar = false) {
  const j = J(sim);
  const esp = sim.espelho.arcologia ?? (sim.espelho.arcologia = { plano: null, etapas: [] });
  let mudou = forcar || esp.plano !== j.plano || esp.etapas.length !== ETAPAS.length;
  if (mudou) esp.etapas = ETAPAS.map((d) => ({ id: d.id, parte: d.parte, estado: ETAPA.TRANCADA, fase: 0, progresso: 0 }));
  esp.plano = j.plano;
  ETAPAS.forEach((def, k) => {
    const e = j.etapas[def.id];
    const o = esp.etapas[k];
    const p = Math.round(progressoDe(def, e) * 1000) / 1000;
    const f = faseDe(def, e);
    if (o.estado !== e.estado || o.fase !== f || o.progresso !== p) {
      o.estado = e.estado;
      o.fase = f;
      o.progresso = p;
      mudou = true;
    }
  });
  if (mudou) sim.mudancas.marcar('arcologia');
}

/** Trancada ou disponível pelo marco e pela etapa anterior; avisa quem ouve quando muda. */
function atualizarDisponiveis(sim) {
  for (const def of ETAPAS) {
    const e = J(sim).etapas[def.id];
    if (e.estado === ETAPA.EM_OBRA || e.estado === ETAPA.PRONTA) continue;
    const r = recusa(sim, def, e);
    const novo = r === null ? ETAPA.DISPONIVEL : ETAPA.TRANCADA;
    if (novo !== e.estado) {
      e.estado = novo;
      sim.emitir('etapa', { id: def.id, estado: novo });
    }
  }
}

// ------------------------------------------------------------------------------------------------ materiais

/** Pede ao armazém o que falta da etapa e cabe no estoque (o teto da frota vale aqui, D47). */
function pedirMateriais(sim, def, e) {
  for (const [item, n] of Object.entries(def.materiais)) {
    const falta = n - (e.pedido[item] ?? 0);
    if (falta <= 0) continue;
    const pode = Math.min(falta, estoque(sim, item), 1000);
    if (!(pode >= 1)) continue;
    const q = Math.floor(pode);
    const nomeado = typeof sim.holding.registrarChegada === 'function';
    // sem a S3a, o substituto entrega na hora e chama a função; com ela, o nome do tratador sobrevive ao save
    const r = sim.holding.entregar({
      item, n: q, origem: 'armazem', destino: def.id,
      aoChegar: nomeado ? CHEGADA : (x) => chegou(sim, x),
    });
    if (r === -1) continue;
    e.pedido[item] = (e.pedido[item] ?? 0) + q;
  }
}

/** Um caminhão chegou ao canteiro: soma o que ele trouxe na etapa de destino. */
function chegou(sim, { item, n, destino }) {
  const e = J(sim)?.etapas?.[destino];
  if (!e || !item || !(n > 0)) return;
  const def = etapaDe(destino);
  const pede = def?.materiais?.[item] ?? 0;
  e.entregue[item] = Math.min(pede, (e.entregue[item] ?? 0) + n);
}

// ------------------------------------------------------------------------------------------------ efeitos (D49)

const ID_EFEITO = (id, tipo) => `arcologia.${id}.${tipo}`;

/** Liga as vias internas da sede no grafo (ARESTA.ARCOLOGIA): o anel viário, os 8 portões e as 8 avenidas radiais. */
export function ligarVias(sim) {
  const j = J(sim);
  const G = sim.grafo;
  if (!G || j.vias.length) return j.vias.length;
  const plano = PLANOS[j.plano] ?? PLANOS[PLANO_ESCOLHIDO];
  const A = G.arestas;
  const N = G.nos;
  // um portão que já tem a via da cidade ligada vira o mesmo nó (a via chegou nele antes da etapa)
  const no = (x, z) => {
    const n = noPerto(G, x, z, 1.5);
    return n >= 0 ? n : addNo(G, x, z, sim.alturaEm(x, z) + CHAO_ABAIXO_DA_PISTA);
  };
  const arestas = [];
  const nova = (a, b, p1, p2) => {
    const e = addAresta(G, a, b, 'avenida', p1, p2, { flags: ARESTA.ARCOLOGIA });
    if (e >= 0) arestas.push(refDe(e, A.ger[e]));
    return e;
  };
  const reta = (a, b) => {
    const [ax, az, bx, bz] = [N.x[a], N.z[a], N.x[b], N.z[b]];
    return nova(a, b, [ax + (bx - ax) / 3, az + (bz - az) / 3], [ax + ((bx - ax) * 2) / 3, az + ((bz - az) * 2) / 3]);
  };
  // o anel em 8 arcos de 45 graus (cúbicas de Bézier: erro de milímetros), um nó em cada avenida
  const anel = plano.vias.filter((v) => v.anel);
  const nosAnel = [];
  for (const v of anel) {
    const { cx, cz, r, de, ate } = v.arco;
    const a0 = (de * Math.PI) / 180;
    const a1 = (ate * Math.PI) / 180;
    if (!nosAnel.length) nosAnel.push(no(cx + cos(a0) * r, cz + sen(a0) * r));
    const fim = nosAnel.length === anel.length ? nosAnel[0] : no(cx + cos(a1) * r, cz + sen(a1) * r);
    const q = (a1 - a0) / 4;
    const k = ((4 / 3) * sen(q) * r) / cos(q);
    const p1 = [cx + cos(a0) * r - sen(a0) * k, cz + sen(a0) * r + cos(a0) * k];
    const p2 = [cx + cos(a1) * r + sen(a1) * k, cz + sen(a1) * r - cos(a1) * k];
    nova(nosAnel[nosAnel.length - 1], fim, p1, p2);
    if (nosAnel.length < anel.length) nosAnel.push(fim);
  }
  // radiais e portões pelas pontas do próprio plano (o nó do anel mais perto), não pela ordem da lista
  for (const v of plano.vias.filter((x) => x.radial)) reta(no(v.pontos[0], v.pontos[1]), no(v.pontos[2], v.pontos[3]));
  const portoes = [];
  for (const v of plano.vias.filter((x) => x.portao)) {
    const p = no(v.pontos[0], v.pontos[1]);
    portoes.push(refDe(p, N.ger[p]));
    reta(p, no(v.pontos[2], v.pontos[3]));
  }
  j.vias = arestas;
  j.portoes = portoes;
  // o reservatório entra na rede pelo nó do anel na avenida do portão norte (270 graus), por onde a cidade chega
  const pn = plano.portoes.find((p) => p.id === 'norte') ?? plano.portoes[0];
  const vn = pn && plano.vias.find((v) => v.portao && hipot(v.pontos[0] - pn.x, v.pontos[1] - pn.z) < 1.5);
  const nn = vn ? noPerto(G, vn.pontos[2], vn.pontos[3], 1.5) : nosAnel[0] ?? -1;
  j.noAgua = nn >= 0 ? refDe(nn, N.ger[nn]) : -1;
  return arestas.length;
}

function aplicarEfeito(sim, def, ef) {
  const j = J(sim);
  const [cx, cz] = SEDE_CENTRO;
  switch (ef.tipo) {
    case 'vias':
      ligarVias(sim);
      break;
    case 'agua': {
      if (j.produtor >= 0 || !sim.redes?.produtor) break;
      const n = j.noAgua >= 0 && sim.tabelas.nos?.vivaRef(j.noAgua) ? j.noAgua : -1;
      const pn = PLANOS[j.plano].portoes.find((p) => p.id === 'norte') ?? { x: cx, z: cz };
      j.produtor = sim.redes.produtor({ tipo: 'agua', ref: def.id, capacidade: ef.capacidade, no: n, x: pn.x, z: pn.z });
      break;
    }
    case 'valor':
      sim.cidade?.efeito(ID_EFEITO(def.id, 'valor'), { x: cx, z: cz, raio: ef.raio, valor: ef.v });
      break;
    case 'licenca':
      if (sim.json.ladrilhos) concederLicencas(sim, ef.n);
      break;
    case 'holding':
      sim.holding.efeito(def.id, { produtividade: ef.produtividade, caminhoes: ef.caminhoes });
      break;
    case 'vagas':
      for (let k = 0; k < 4; k++) j.efeitos.vagas[k] += ef.vagas[k] ?? 0;
      break;
    case 'moradores':
      j.efeitos.luxo += ef.n;
      j.efeitos.bemEstarLuxo = ef.bemEstar;
      break;
    case 'demanda':
      sim.cidade?.efeito(ID_EFEITO(def.id, 'demanda'), { x: cx, z: cz, raio: ef.raio, demanda: { ...ef.zonas } });
      break;
    case 'atratividade':
      sim.cidade?.efeito(ID_EFEITO(def.id, 'atratividade'), { atratividade: ef.v });
      break;
    case 'legado':
      sim.economia?.somarMedidor?.('legado', ef.v, def.id);
      break;
    default:
      break; // helicoptero: só o render (D61)
  }
}

/** A etapa ficou pronta: efeitos, XP, Mural e o evento. */
function concluir(sim, def, e) {
  e.estado = ETAPA.PRONTA;
  e.fim = sim.tique;
  e.trabalho = duracaoDe(def);
  e.parada = null;
  for (const ef of def.efeitos) aplicarEfeito(sim, def, ef);
  sim.progresso.xp(def.xp, 'arcologia');
  postarMural(sim, def.parte === 'lago' ? 'tome' : 'iris', `x1.mural.${def.id}`, {});
  sim.mudancas.marcar('holding');
  sim.emitir('etapa', { id: def.id, estado: ETAPA.PRONTA });
}

/** Avisos de altura da obra do par no Mural: a Blade a 330 m e a Dream Bridge içada. */
function anunciarAlturas(sim) {
  const j = J(sim);
  const g = avancoDaTorre(ETAPAS_ORDEM.map((id) => ({ id, estado: j.etapas[id].estado, progresso: progressoDe(etapaDe(id), j.etapas[id]) })));
  if (g < 0) return;
  const hb = alturaBlade(g);
  const hl = alturaLegacy(g);
  if (hb >= PAR.ponte.cota && !j.marcos.includes('blade330')) {
    j.marcos.push('blade330');
    postarMural(sim, 'iris', 'x1.mural.blade330', { m: PAR.ponte.cota });
  }
  if (Math.min(hb, hl) >= ALTURA_PONTE && !j.marcos.includes('ponte')) {
    j.marcos.push('ponte');
    postarMural(sim, 'iris', 'x1.mural.ponte', { m: PAR.ponte.cota });
  }
}

// ------------------------------------------------------------------------------------------------ o tique

function sistema(sim, k, fatias, T) {
  const j = J(sim);
  const rodada = T % RODADA === 0;
  const parado = !!sim.economia?.caixaZerado?.();
  for (const def of ETAPAS) {
    const e = j.etapas[def.id];
    if (e.estado !== ETAPA.EM_OBRA) continue;
    if (rodada) pedirMateriais(sim, def, e);
    const dur = duracaoDe(def);
    const mat = fracMateriais(def, e);
    // o trabalho só anda com material para a fase e caixa (D41: as etapas param com o caixa zerado)
    e.parada = parado ? 'caixa' : e.trabalho >= dur * mat && e.trabalho < dur ? 'material' : null;
    if (!e.parada && e.trabalho < dur) e.trabalho++;
    if (e.trabalho >= dur && mat >= 1) concluir(sim, def, e);
  }
  if (rodada) {
    atualizarDisponiveis(sim);
    anunciarAlturas(sim);
  }
  // a Contribuição dos moradores de luxo da torre.e3 entra com a dos moradores (economia.js lê contribuicaoLuxo)
  publicar(sim);
}

// ------------------------------------------------------------------------------------------------ comando

function iniciar(sim, { etapa } = {}) {
  if (typeof etapa !== 'string') return 'valor';
  const def = etapaDe(etapa);
  if (!def) return ETAPAS_M2.some((x) => x.id === etapa) ? 'trancado' : 'valor';
  const e = J(sim).etapas[etapa];
  const r = recusa(sim, def, e);
  if (r) return r;
  if (!sim.holding.pagar(def.creditos, 'arcologia')) return 'creditos';
  e.estado = ETAPA.EM_OBRA;
  e.ini = sim.tique;
  e.trabalho = 0;
  e.pago = def.creditos;
  e.parada = null;
  // a terraplenagem cava o Mirror Lake (D5): o chão desce no aplainar desde o começo da obra
  if (def.id === 'lago.e1' && J(sim).cava < 0) J(sim).cava = sim.formas.registrar(cavaDoPlano(J(sim).plano, GLEBA_ENVELOPE.cota, REF_CAVA));
  pedirMateriais(sim, def, e);
  publicar(sim);
  sim.emitir('etapa', { id: def.id, estado: ETAPA.EM_OBRA });
  return { ok: true, dados: { custo: def.creditos, fim: e.ini + duracaoDe(def) } };
}

// ------------------------------------------------------------------------------------------------ consulta

const data = (t) => (t >= 0 ? { tique: t, ...dataDoTique(t) } : null);

/** Contribuição por hora de jogo dos moradores de luxo da torre.e3, na faixa do bem-estar deles (regra do dono). */
function contribuicaoLuxo(sim) {
  const j = J(sim);
  return j.efeitos.luxo > 0 ? j.efeitos.luxo * tarifaPelasRegras(sim.economia?.regras?.() ?? REGRAS_DONO, j.efeitos.bemEstarLuxo) : 0;
}

/** Uma etapa para as telas (formato de contratos/consultas.js, com os campos a mais do Livro). */
function etapaVista(sim, def) {
  const e = J(sim).etapas[def.id];
  const dur = duracaoDe(def);
  const prog = progressoDe(def, e);
  // previsão do fim: o tempo que falta no ritmo de agora (a falta de material atrasa, e a tela diz)
  const previsao = e.estado === ETAPA.EM_OBRA ? data(sim.tique + (dur - e.trabalho)) : null;
  return {
    id: def.id,
    parte: def.parte,
    nome: def.nome,
    estado: e.estado,
    marco: def.marco,
    requisito: def.requisito,
    recusa: e.estado === ETAPA.EM_OBRA || e.estado === ETAPA.PRONTA ? null : recusa(sim, def, e),
    creditos: def.creditos,
    materiais: Object.entries(def.materiais).map(([item, pede]) => ({
      item, pede, entregue: e.entregue[item] ?? 0, aCaminho: Math.max(0, (e.pedido[item] ?? 0) - (e.entregue[item] ?? 0)),
      estoque: Number.isFinite(estoque(sim, item)) ? estoque(sim, item) : 0,
    })),
    minutos: def.minutos,
    fases: def.fases,
    fase: faseDe(def, e),
    progresso: prog,
    materiaisFrac: fracMateriais(def, e),
    parada: e.parada,
    efeitos: def.efeitos.map((x) => ({ ...x })),
    xp: def.xp,
    ini: data(e.ini),
    fim: data(e.fim),
    previsao,
  };
}

/** q.arcologia(): partes com as etapas (as do M2 em `futuras`), o progresso do megaprojeto e os efeitos ativos. */
function consulta(sim) {
  const j = J(sim);
  const plano = PLANOS[j.plano] ?? PLANOS[PLANO_ESCOLHIDO];
  const partes = PARTES_ORDEM.map((id) => ({
    id,
    nome: PARTES_NOMES[id],
    etapas: ETAPAS.filter((d) => d.parte === id).map((d) => etapaVista(sim, d)),
    futuras: ETAPAS_M2.filter((d) => d.parte === id).map((d) => ({ id: d.id, nome: d.nome, prazo: { ...d.prazo }, creditos: d.creditos, materiais: { ...d.materiais } })),
  }));
  const prontas = ETAPAS_ORDEM.filter((id) => j.etapas[id].estado === ETAPA.PRONTA).length;
  const emObra = ETAPAS.find((d) => j.etapas[d.id].estado === ETAPA.EM_OBRA);
  const progressoTotal = (prontas + (emObra ? progressoDe(emObra, j.etapas[emObra.id]) : 0)) / ETAPAS.length;
  const g = avancoDaTorre(ETAPAS_ORDEM.map((id) => ({ id, estado: j.etapas[id].estado, progresso: progressoDe(etapaDe(id), j.etapas[id]) })));
  return {
    plano: j.plano,
    nome: plano.nome,
    partes,
    progressoTotal,
    valor: valorDaObra(sim),
    alturas: g < 0 ? null : { blade: alturaBlade(g), legacy: alturaLegacy(g), ponte: Math.min(alturaBlade(g), alturaLegacy(g)) >= ALTURA_PONTE },
    efeitos: {
      vagas: [...j.efeitos.vagas],
      moradoresLuxo: j.efeitos.luxo,
      contribuicaoLuxoHora: contribuicaoLuxo(sim),
      vias: j.vias.length,
      portoes: j.portoes.length,
      agua: j.produtor >= 0 ? (ETAPAS[0].efeitos.find((x) => x.tipo === 'agua')?.moradores ?? 0) : 0,
    },
    inaugurada: estadoDe(sim, 'torre.e4') === ETAPA.PRONTA,
  };
}

// ------------------------------------------------------------------------------------------------ vagas

/**
 * As 1.200 vagas dos escritórios da Blade Tower (torre.e2, D49) entram no mercado de trabalho da cidade como vagas da
 * Holding (que contrata primeiro), sem salário pago por ela: soma no sim.holding.ocupados que a S2a lê (pendência: um
 * registro de vagas de área na S2a deixaria isto sem embrulho).
 */
function instalarVagas(sim) {
  const orig = sim.holding.ocupados;
  if (orig?.arcologia) return;
  const novo = () => {
    const h = typeof orig === 'function' ? orig() : [0, 0, 0, 0];
    const v = J(sim).efeitos.vagas;
    return [0, 1, 2, 3].map((k) => (+h?.[k] || 0) + v[k]);
  };
  novo.arcologia = true;
  sim.holding.ocupados = novo;
}

// ------------------------------------------------------------------------------------------------ registro

/**
 * Seção carregada de um save mais velho (uma etapa nova nos dados, um campo que faltava): completa com o estado vazio
 * sem mexer no que veio. Sem isto, o tique leria uma etapa que o save não tem e pararia a simulação.
 */
function normalizar(sim) {
  const j = J(sim);
  const v = arcologiaVazia();
  for (const k of Object.keys(v)) if (j[k] === undefined || j[k] === null) j[k] = v[k];
  for (const id of ETAPAS_ORDEM) {
    const e = j.etapas[id] ?? (j.etapas[id] = etapaVazia());
    for (const [k, x] of Object.entries(etapaVazia())) if (e[k] === undefined) e[k] = x;
  }
  for (const [k, x] of Object.entries(v.efeitos)) if (j.efeitos[k] === undefined) j.efeitos[k] = x;
}

function validar(sim) {
  const erros = [];
  const j = J(sim);
  for (const def of ETAPAS) {
    const e = j.etapas[def.id];
    if (!e) {
      erros.push(`etapa ${def.id} sem estado`);
      continue;
    }
    if (![0, 1, 2, 3].includes(e.estado)) erros.push(`etapa ${def.id}: estado ${e.estado}`);
    for (const [item, n] of Object.entries(e.entregue)) if (!(n >= 0 && n <= (def.materiais[item] ?? 0))) erros.push(`etapa ${def.id}: ${item} entregue ${n}`);
    if (e.estado >= ETAPA.EM_OBRA && def.requisito && j.etapas[def.requisito]?.estado !== ETAPA.PRONTA) erros.push(`etapa ${def.id} em obra sem ${def.requisito} pronta`);
  }
  return erros;
}

export function registrar(sim) {
  sim.registrarJson('arcologia', arcologiaVazia());
  sim.registrarComando('arcologia.iniciar', iniciar);
  sim.registrarConsulta('arcologia', consulta);
  sim.registrarSistema(1, 0, sistema, 1, { nome: 'arcologia', ordem: ORDEM.arcologia });
  sim.holding.registrarChegada?.(CHEGADA, (x) => chegou(sim, x));
  // o marco 7 pede a Blade Tower pronta (D49, D51)
  sim.progresso.requisito(7, (s) => estadoDe(s, 'torre.e4') === ETAPA.PRONTA);
  instalarVagas(sim);
  sim.arcologia = {
    vagas: () => [...J(sim).efeitos.vagas],
    moradoresLuxo: () => J(sim).efeitos.luxo,
    contribuicaoHora: () => contribuicaoLuxo(sim),
    valor: () => valorDaObra(sim),
    estado: (id) => estadoDe(sim, id),
  };
  sim.registrarValidador('arcologia', validar);
  sim.aoCarregar(() => {
    normalizar(sim);
    publicar(sim, true);
  });
  atualizarDisponiveis(sim);
  publicar(sim, true);
}
