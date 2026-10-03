// Escolhe os marcadores que o render mostra (desenho da UI 8.9; D28; X3a): a lista de q.avisosPredios() vira
// R.marcadores.definir([{ idx, glifo, gravidade, prioridade }]), recalculada quando os avisos mudam (evento
// 'avisosPredios'), quando a camada troca ou quando o filtro muda, nunca por quadro. O render escolhe quais cabem (teto
// por perfil, os mais perto) e agrupa por setor de longe.
//   filtro (prefs.avisos): 'todos' · 'importantes' (só graves e atenção) · 'nenhum'
//   com uma camada ligada, só os avisos daquela camada (AVISOS_DA_CAMADA)
//   prédio da Holding: o aviso que não é grave vem no círculo de aro duplo (forma 'holding')
import { effect } from '@preact/signals';
import { TIPO_PREDIO } from '../../contratos/flags.js';
import { gravarPrefs } from '../prefs.js';

/** Glifos de aviso que cada camada mostra ("com uma camada ligada, só os avisos daquela camada", UI 8.9). */
export const AVISOS_DA_CAMADA = Object.freeze({
  zonas: Object.freeze(['semVia', 'abandonado', 'alerta', 'poucosClientes', 'semTrabalhadores', 'semMercadoria']),
  bemEstar: Object.freeze(['bemEstarRuim', 'alerta', 'abandonado']),
  agua: Object.freeze(['semAgua']),
  energia: Object.freeze(['semEnergia']),
  servicos: Object.freeze([]),
  recursos: Object.freeze(['semMaterial']),
  valor: Object.freeze([]),
});

/** Filtros dos avisos (prefs.avisos), na ordem do controle. */
export const FILTROS_AVISOS = Object.freeze(['todos', 'importantes', 'nenhum']);
/** Teto do que a UI manda (o render corta de novo pelo perfil). */
export const MAX_PEDIDOS = 4000;
/** Nomes dos glifos de q.avisosPredios().glifo quando a consulta não traz `nomes` (a mesma ordem de sim/predios.js). */
export const GLIFOS_PADRAO = Object.freeze(['', 'abandonado', 'alerta', 'semAgua', 'semEnergia', 'semVia', 'semMaterial', 'semTrabalhadores', 'poucosClientes', 'trabalho', 'bemEstarRuim']);
const GRAVIDADES = ['info', 'atencao', 'grave'];

/**
 * A lista para o render (pura): avisos = q.avisosPredios(); camada = id ligada ou null; filtro; ehHolding(idx).
 * Prioridade: grave 3, atenção 2, Holding 1,5, informação 1 (o render desempata pela distância).
 */
export function escolherAvisos(avisos, { camada = null, filtro = 'todos', ehHolding = () => false, max = MAX_PEDIDOS } = {}) {
  if (!avisos?.idx?.length || filtro === 'nenhum') return [];
  const nomes = avisos.nomes ?? GLIFOS_PADRAO;
  const daCamada = camada ? AVISOS_DA_CAMADA[camada] ?? null : null;
  const out = [];
  for (let k = 0; k < avisos.idx.length; k++) {
    const idx = avisos.idx[k];
    const glifo = nomes[avisos.glifo[k]] || 'alerta';
    let gravidade = GRAVIDADES[avisos.gravidade[k]] ?? 'info';
    if (filtro === 'importantes' && gravidade === 'info') continue;
    if (daCamada && !daCamada.includes(glifo)) continue;
    if (gravidade !== 'grave' && ehHolding(idx)) gravidade = 'holding';
    const prioridade = gravidade === 'grave' ? 3 : gravidade === 'atencao' ? 2 : gravidade === 'holding' ? 1.5 : 1;
    out.push({ idx, glifo, gravidade, prioridade });
  }
  out.sort((a, b) => b.prioridade - a.prioridade);
  return out.slice(0, max);
}

/** Troca o filtro dos avisos nas preferências (pelo app quando houver, senão na loja e no localStorage). */
export function mudarFiltro(ui, filtro) {
  if (!FILTROS_AVISOS.includes(filtro)) return;
  const jogo = ui.jogo;
  if (jogo && !jogo.falso && typeof jogo.gravarPrefs === 'function') jogo.gravarPrefs({ avisos: filtro });
  else {
    const p = { ...ui.loja.prefs.peek(), avisos: filtro };
    ui.loja.prefs.value = p;
    gravarPrefs(p);
  }
}

/** O filtro atual (padrão 'todos'). */
export const filtroAtual = (prefs) => (FILTROS_AVISOS.includes(prefs?.avisos) ? prefs.avisos : 'todos');

export function registrar(ui) {
  const { loja } = ui;
  let sujo = true;
  let tUltimo = -Infinity;
  let ultimoEvento = null;
  let ultimaVersao = null;

  // eventos: 'avisosPredios' (a lista mudou), 'construido', 'demolido' e a troca de partida; camada e filtro
  effect(() => {
    const ev = loja.eventos.value;
    const ult = ev[ev.length - 1];
    if (ult && ult !== ultimoEvento) {
      ultimoEvento = ult;
      if (ult.nome === 'avisosPredios' || ult.nome === 'demolido' || ult.nome === 'construido') sujo = true;
    }
  });
  effect(() => {
    loja.camada.value;
    loja.prefs.value;
    sujo = true;
  });

  let simAnt = null;
  let tiqueAnt = null;
  ui.aoQuadro((tMs) => {
    if (!ui.R?.marcadores?.definir) return;
    // outra partida (nova ou carregada): a lista velha aponta para prédios que não são mais os mesmos
    const sim = ui.obterSim();
    if (sim !== simAnt) {
      simAnt = sim;
      sujo = true;
    }
    // a cada 2 s confere a versão (um evento perdido), só se o relógio andou (pausado, os avisos não mudam)
    if (!sujo && tMs - tUltimo < 2000) return;
    if (sujo && tMs - tUltimo < 250) return;
    const tique = sim?.espelho?.tempo?.tique ?? null;
    if (!sujo && tique !== null && tique === tiqueAnt) {
      tUltimo = tMs;
      return;
    }
    tiqueAnt = tique;
    const avisos = ui.consultar('avisosPredios');
    const versao = avisos?.versao ?? null;
    if (!sujo && versao === ultimaVersao) {
      tUltimo = tMs;
      return;
    }
    const P = ui.obterSim()?.espelho?.predios;
    const lista = escolherAvisos(avisos, {
      camada: loja.camada.peek(),
      filtro: filtroAtual(loja.prefs.peek()),
      ehHolding: (i) => !!P && i < P.n && P.tipo[i] === TIPO_PREDIO.HOLDING,
    });
    ui.R.marcadores.definir(lista);
    ultimaVersao = versao;
    sujo = false;
    tUltimo = tMs;
  });
}
