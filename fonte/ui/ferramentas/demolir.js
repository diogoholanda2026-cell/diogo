// Ferramenta de demolir (desenho da UI 9.4, D26, D32, D54): máquina PURA. Tocar marca ou desmarca (contorno vermelho
// pelo render); arrastar marca vários; a barra diz o que se perde e o que volta; prédios da Holding pedem dois toques;
// a Arcologia e a rodovia recusam com o motivo. Quem acha o alvo sob o dedo é a cola (R.selecionar, e o espelho para as
// vias enquanto a seleção de aresta da R3a não existe).
import { PREDIO, TIPO_PREDIO, ARESTA } from '../../contratos/flags.js';
import { VIAS, VIAS_ORDEM } from '../../data/vias.js';
import { idxDaRef } from '../../contratos/espelho.js';

/** Estado novo. */
export function criarDemolir() {
  return { marcados: [], dedo: false, mira: null, efeitos: [] };
}

/**
 * Descreve um alvo do espelho: { ref, tipo: 'predio' | 'aresta', holding, recusa: codigo | null }.
 * @param {object} esp
 * @param {{ tipo: string, ref: number }} sel  'predio' | 'colocavel' | 'aresta' | 'arcologia'
 */
export function alvoDe(esp, sel) {
  if (!sel || sel.ref === null || sel.ref === undefined) {
    if (sel?.tipo === 'arcologia') return { ref: -1, tipo: 'arcologia', holding: false, recusa: 'arcologia' };
    return null;
  }
  if (sel.tipo === 'arcologia') return { ref: sel.ref, tipo: 'arcologia', holding: false, recusa: 'arcologia' };
  if (sel.tipo === 'aresta') {
    const A = esp?.vias?.arestas;
    const e = idxDaRef(sel.ref);
    const f = A && e < A.n ? A.flags[e] : 0;
    const tipo = A && e < A.n ? VIAS_ORDEM[A.tipo[e]] : null;
    const recusa = f & ARESTA.ARCOLOGIA ? 'arcologia' : f & ARESTA.RODOVIA || tipo === 'rodovia' ? 'rodovia' : null;
    return { ref: sel.ref, tipo: 'aresta', holding: false, recusa };
  }
  if (sel.tipo === 'predio' || sel.tipo === 'colocavel') {
    const P = esp?.predios;
    const i = idxDaRef(sel.ref);
    const holding = !!(P && i < P.n && (P.tipo[i] === TIPO_PREDIO.HOLDING || P.flags[i] & PREDIO.HOLDING));
    return { ref: sel.ref, tipo: 'predio', holding, recusa: null };
  }
  return null;
}

/**
 * Um passo. Eventos: inicio, move, fim ({ ponto, tela }); { tipo: 'alvo', alvo, somar } (a cola achou o que há sob o
 * dedo); { tipo: 'cancelar' }; { tipo: 'feito' } (demoliu). Efeitos: { efeito: 'escolher', ponto, tela, somar },
 * { efeito: 'recusa', codigo }, 'marcas' (mudou a lista), 'limpar', 'sair'.
 */
export function passoDemolir(e, ev) {
  if (ev.tipo === 'cancelar') {
    if (e.marcados.length) return { ...e, marcados: [], efeitos: ['marcas'] };
    return { ...e, efeitos: ['sair'] };
  }
  if (ev.tipo === 'feito') return { ...e, marcados: [], efeitos: ['marcas'] };
  if (ev.tipo === 'alvo') {
    const a = ev.alvo;
    if (!a) return { ...e, efeitos: [] };
    if (a.recusa) return { ...e, efeitos: ev.somar ? [] : [{ efeito: 'recusa', codigo: a.recusa }] };
    // a ref só vale dentro da tabela: prédio e aresta podem ter o mesmo número
    const igual = (m) => m.ref === a.ref && m.tipo === a.tipo;
    const tem = e.marcados.some(igual);
    if (tem && ev.somar) return { ...e, efeitos: [] };
    const marcados = tem ? e.marcados.filter((m) => !igual(m)) : [...e.marcados, a];
    return { ...e, marcados, efeitos: ['marcas'] };
  }
  if (!ev.ponto) return { ...e, efeitos: [] };
  const mira = { ponto: [ev.ponto[0], ev.ponto[1]], tela: ev.tela ?? null, dedo: ev.dedo ?? null };
  if (ev.tipo === 'inicio') return { ...e, mira, dedo: true, efeitos: [{ efeito: 'escolher', ponto: mira.ponto, tela: ev.tela, somar: false }] };
  if (ev.tipo === 'move' && e.dedo) return { ...e, mira, efeitos: [{ efeito: 'escolher', ponto: mira.ponto, tela: ev.tela, somar: true }] };
  if (ev.tipo === 'fim') return { ...e, mira, dedo: false, efeitos: [] };
  return { ...e, mira, efeitos: [] };
}

/** Refs marcadas por tipo: { predios: [ref], arestas: [ref] }. */
export function refsMarcadas(e) {
  return {
    predios: e.marcados.filter((m) => m.tipo === 'predio').map((m) => m.ref),
    arestas: e.marcados.filter((m) => m.tipo === 'aresta').map((m) => m.ref),
  };
}

/**
 * O que vai para R.ferramenta.demolir: a ref de cada prédio (como no contrato) e { tipo: 'aresta', ref } de cada via
 * (a ref sozinha não diz a tabela; prédio e aresta podem ter o mesmo número).
 */
export const marcasParaRender = (e) => e.marcados.map((m) => (m.tipo === 'aresta' ? { tipo: 'aresta', ref: m.ref } : m.ref));

/** Dois toques quando há prédio da Holding na lista (desenho da UI 8.5). */
export const pedeDoisToques = (e) => e.marcados.some((m) => m.holding);

/**
 * O que se perde e o que volta: prédios, moradores e empregos pelo espelho; vias com a volta ESTIMADA de 50% do custo
 * (fora do desfazer da sessão, D32). O custo dos prédios (D54) é da simulação.
 * @returns {{ predios, holding, arestas, moradores, empregos, metros, voltaVias }}
 */
export function resumoDemolir(esp, e) {
  const P = esp?.predios;
  const A = esp?.vias?.arestas;
  const r = { predios: 0, holding: 0, arestas: 0, moradores: 0, empregos: 0, metros: 0, voltaVias: 0 };
  for (const m of e.marcados) {
    const i = idxDaRef(m.ref);
    if (m.tipo === 'predio') {
      r.predios++;
      if (m.holding) r.holding++;
      if (P && i < P.n && P.viva[i]) {
        r.moradores += P.moradores[i];
        r.empregos += P.empregos[i];
      }
    } else if (m.tipo === 'aresta') {
      r.arestas++;
      if (A && i < A.n && A.viva[i]) {
        const comp = A.comp[i] || 0;
        r.metros += comp;
        r.voltaVias += 0.5 * comp * (VIAS[VIAS_ORDEM[A.tipo[i]]]?.custoM ?? 0);
      }
    }
  }
  r.metros = Math.round(r.metros);
  r.voltaVias = Math.round(r.voltaVias);
  return r;
}
