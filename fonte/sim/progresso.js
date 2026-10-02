// XP e marcos (D51), licenças e desbloqueios (dona: S3a). Implementa sim.progresso do contrato interno (2.10):
// xp(n, motivo), liberado(id), requisito(marco, fn) e marco().
//
// XP passivo: +1 por morador acima do maior número já atingido (os moradores do começo, a Vila, são o ponto de
// partida); por mês, moradores x (bem-estar − 50) / 2.000 quando a média passa de 50 (amostrada a cada rodada). XP
// ativo: vias novas (+1 a cada 100 m acima do maior total já construído, aqui), serviços (o `xp` do catálogo, dado pelo
// construir da S2a), prédios da Holding (+30, holding/producao.js quando entram na lista), etapas da Arcologia (a X1b
// chama xp) e objetivos (objetivos.js). Cada marco dá 10 mil x n, uma licença de
// ladrilho a partir do 2, os desbloqueios e os eventos `marco` e `desbloqueio`. O marco 7 pede a Torre pronta
// (requisito registrado pela X1b; sem ele, a etapa torre.e4 pronta no espelho da Arcologia).
import { MARCOS, XP, marcoQueLibera } from '../data/marcos.js';
import { ORDEM } from '../contratos/interno.js';
import { ARESTA, ETAPA } from '../contratos/flags.js';
import { VIAS, VIAS_ORDEM } from '../data/vias.js';
import { MES, RODADA } from '../comum/relogio.js';
import { finito, livre, postarMural } from './holding/base.js';
import { concederLicencas } from './mundo/ladrilhos.js';

const REQUISITOS = new WeakMap(); // sim → Map(marco → fn)

const prog = (sim) => sim.json.progresso;

/** Garante os campos da S3a na seção 'progresso' (criada pela F0 com { xp, motivos }). */
function campos(sim) {
  const p = prog(sim);
  if (p.marco === undefined) p.marco = 0;
  if (p.popMax === undefined) p.popMax = -1;
  // -1: ainda sem ponto de partida (o registrar toma as vias que já existem, as ruas da Vila e a rodovia; sem XP)
  if (p.viasMax === undefined) p.viasMax = -1;
  if (p.bemMes === undefined) p.bemMes = { soma: 0, n: 0 };
  if (p.historico === undefined) p.historico = [];
  return p;
}

/** true se o requisito do marco n está cumprido (sem requisito, sim). */
function requisitoOk(sim, n) {
  const m = MARCOS[n];
  if (!m?.requisito) return true;
  const fn = REQUISITOS.get(sim)?.get(n);
  if (fn) {
    try {
      return !!fn(sim);
    } catch {
      return false;
    }
  }
  // sem a X1b: a etapa pronta no espelho da Arcologia
  return (sim.espelho.arcologia?.etapas ?? []).some((e) => e.id === m.requisito && e.estado === ETAPA.PRONTA);
}

/** Marco atual no formato da barra (contratos/consultas.js). */
export function marcoAtual(sim) {
  const p = prog(sim);
  const m = MARCOS[p.marco] ?? MARCOS[0];
  const prox = MARCOS[p.marco + 1] ?? null;
  return { n: m.n, nome: m.nome, xp: p.xp, xpIni: m.xp, xpProx: prox ? prox.xp : null, requisito: prox?.requisito ?? null };
}

/** liberado(id): o que um marco ainda não alcançado lista fica trancado; os ids do M1b ficam trancados no M1a. */
export function liberado(sim, id) {
  if (livre(sim)) return true;
  for (const m of MARCOS) if (m.m1b?.includes(id)) return false;
  const n = marcoQueLibera(id);
  return n < 0 || prog(sim).marco >= n;
}

/**
 * Instala sim.progresso (economia.js chama no começo do registrar da S3a, antes das parcelas que registram depois).
 */
export function instalarProgresso(sim) {
  campos(sim);
  REQUISITOS.set(sim, new Map());
  sim.implementar('progresso', {
    xp(n, motivo = 'outro') {
      if (!(n > 0) || !Number.isFinite(n)) return;
      const p = prog(sim);
      p.xp += n;
      p.motivos[motivo] = (p.motivos[motivo] ?? 0) + n;
    },
    liberado: (id) => liberado(sim, id),
    requisito(marco, fn) {
      if (Number.isInteger(marco) && typeof fn === 'function') REQUISITOS.get(sim).set(marco, fn);
    },
    marco: () => marcoAtual(sim),
  });
}

/** Comprimento das vias do jogador (sem a rodovia, a terra do mapa e as vias internas da Arcologia). */
function comprimentoVias(sim) {
  const A = sim.tabelas.arestas;
  if (!A) return 0;
  let s = 0;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e] || A.flags[e] & (ARESTA.RODOVIA | ARESTA.ARCOLOGIA)) continue;
    if (!VIAS[VIAS_ORDEM[A.tipo[e]]]?.constroi) continue;
    s += A.comp[e];
  }
  return s;
}

/** Alcança o marco n: prêmio, licenças, desbloqueios e eventos. */
function alcancar(sim, n) {
  const p = prog(sim);
  const m = MARCOS[n];
  p.marco = n;
  const creditos = XP.premioPorMarco * n;
  if (creditos > 0) sim.holding.receber(creditos, 'marcos');
  if (m.licencas > 0 && sim.json.ladrilhos) concederLicencas(sim, m.licencas);
  p.historico.push({ n, tique: sim.tique, xp: p.xp });
  sim.emitir('marco', { n, nome: m.nome, premios: { creditos, licencas: m.licencas }, libera: [...m.libera] });
  if (m.libera.length) sim.emitir('desbloqueio', { ids: [...m.libera] });
  postarMural(sim, 'iris', 's3.mural.marco', { n, nome: m.nome });
  sim.mudancas.marcar('holding');
}

function sistemaProgresso(sim, k, fatias, T) {
  const p = prog(sim);
  const ag = sim.agregados;
  const pop = Math.floor(finito(ag.populacao));
  // moradores acima do recorde (os do começo são o ponto de partida)
  if (p.popMax < 0) p.popMax = pop;
  else if (pop > p.popMax) {
    sim.progresso.xp((pop - p.popMax) * XP.porMoradorNovo, 'moradores');
    p.popMax = pop;
  }
  // bem-estar do mês, amostrado a cada rodada
  const be = finito(ag.bemEstarMedio);
  p.bemMes.soma += pop * Math.max(0, be - XP.bemEstar.base);
  p.bemMes.n++;
  if (Math.floor((T + RODADA) / MES) !== Math.floor(T / MES)) {
    const media = p.bemMes.n ? p.bemMes.soma / p.bemMes.n : 0;
    if (media > 0) sim.progresso.xp(media / XP.bemEstar.divisor, 'bemEstar');
    p.bemMes = { soma: 0, n: 0 };
  }
  // vias novas
  const vias = comprimentoVias(sim);
  if (p.viasMax < 0) p.viasMax = vias;
  else if (vias > p.viasMax + 1e-6) {
    sim.progresso.xp(((vias - p.viasMax) / 100) * XP.viaPorCemMetros, 'vias');
    p.viasMax = vias;
  }
  // marcos (um de cada vez, na ordem; o 7 pede a Torre pronta)
  while (p.marco + 1 < MARCOS.length && p.xp >= MARCOS[p.marco + 1].xp && requisitoOk(sim, p.marco + 1)) alcancar(sim, p.marco + 1);
}

/** q.marcos(): os marcos 0 a 7 com o que cada um pede e libera. */
function consultaMarcos(sim) {
  const p = prog(sim);
  return MARCOS.map((m) => ({
    n: m.n,
    nome: m.nome,
    xp: m.xp,
    feito: p.marco >= m.n,
    atual: p.marco === m.n,
    libera: [...m.libera],
    licencas: m.licencas,
    premio: XP.premioPorMarco * m.n,
    requisito: m.requisito ?? null,
    requisitoOk: m.requisito ? requisitoOk(sim, m.n) : true,
    tique: p.historico.find((h) => h.n === m.n)?.tique ?? (m.n === 0 ? 0 : null),
  }));
}

export function registrar(sim) {
  const p = campos(sim);
  // as vias do mapa (ruas da Vila) já estão no grafo: são o ponto de partida do XP de vias, como os moradores da Vila
  if (p.viasMax < 0) p.viasMax = comprimentoVias(sim);
  sim.registrarConsulta('marcos', consultaMarcos);
  // a cada rodada, depois da economia, da Holding e da Arcologia
  sim.registrarSistema(RODADA, RODADA - 2, sistemaProgresso, 1, { nome: 'progresso', ordem: ORDEM.progresso });
}

