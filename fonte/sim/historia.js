// História do Ato 1 "A Concessão" no M1a (dona: S3a): calendário com data real (D67), eventos do período com nome
// fictício (D77), as 3 decisões do M1a com a marca gravada (memória), Influência e Legado (D55) e o Mural.
//
// Decisões: `vila.agua` no marco 0 (minuto 3, D52), a Febre Aurora (mar. 2020) e o Bloqueio do Canal de Seshat
// (mar. 2021). Uma decisão abre (evento `decisao`), espera a escolha até o prazo (um adiamento por decisão) e, se o
// prazo passa, vale a opção padrão. A escolha aplica os efeitos (data/historia.js), soma Influência ou Legado, grava a
// marca '<decisão>:<opção>' e põe a fala no Mural. Os efeitos que são da cidade (bem-estar numa área, demanda) ficam
// na lista para a S2a ler por sim.economia.efeitos(tipo).
import { DECISOES, EVENTOS, MEDIDORES, MURAL_MAX, tiqueDaData, dataDoTique, MES_TIQUES } from '../data/historia.js';
import { ORDEM } from '../contratos/interno.js';
import { RODADA } from '../comum/relogio.js';
import { postarMural, efeitosAtivos as ativos, finito } from './holding/base.js';
import { concederLicencas } from './mundo/ladrilhos.js';

export function historiaVazia() {
  return {
    ato: 1,
    influencia: MEDIDORES.inicial.influencia,
    legado: MEDIDORES.inicial.legado,
    pendentes: [], // { id, desde, prazo, adiada }
    decididas: [], // { id, opcao, tique, auto }
    marcas: [], // '<decisão>:<opção>' (memória: outras decisões e falas leem)
    efeitos: [], // { tipo, ..., ate: tique | null, origem, anulado }
    eventos: [], // ids dos eventos do calendário que já chegaram
    abertas: [], // ids das decisões que já abriram (sem evento)
    objetivosExtras: [], // { dominio, id } que uma decisão pôs na frente
    medidores: [], // { nome, v, motivo, tique }
    mural: [],
    seqMural: 0,
  };
}

const H = (sim) => sim.json.historia;
const clamp100 = (v) => Math.max(0, Math.min(MEDIDORES.max, v));

/** Efeitos ativos de um tipo (para a S2a: 'bemArea', 'demanda'; para a S3a: 'produtividade', 'importacao'). */
export const efeitosAtivos = (sim, tipo) => ativos(sim, tipo).map((e) => ({ ...e }));

/** Soma Influência ou Legado (0 a 100). */
export function somarMedidor(sim, nome, v, motivo = 'outro') {
  const h = H(sim);
  if (!h || (nome !== 'influencia' && nome !== 'legado') || !Number.isFinite(v) || v === 0) return false;
  h[nome] = clamp100(h[nome] + v);
  h.medidores.push({ nome, v, motivo: String(motivo), tique: sim.tique });
  if (h.medidores.length > 200) h.medidores.splice(0, h.medidores.length - 200);
  sim.mudancas.marcar('holding');
  return true;
}

/** Influência, Legado e o efeito escrito (D55). */
export function medidores(sim) {
  const h = H(sim);
  const inf = h?.influencia ?? 0;
  const leg = h?.legado ?? 0;
  return {
    influencia: inf,
    legado: leg,
    efeitos: { descontoLadrilho: (MEDIDORES.descontoLadrilhoMax * inf) / MEDIDORES.max, atratividade: (MEDIDORES.atratividadeMax * leg) / MEDIDORES.max },
  };
}

/** Tique em que a decisão abre (as ligadas a um evento abrem com ele). */
function tiqueDe(d) {
  if (d.quando.ano) return tiqueDaData(d.quando.ano, d.quando.mes ?? 1);
  return d.quando.tique ?? 0;
}

function abrir(sim, d) {
  const h = H(sim);
  if (h.pendentes.some((p) => p.id === d.id) || h.decididas.some((x) => x.id === d.id)) return;
  h.pendentes.push({ id: d.id, desde: sim.tique, prazo: sim.tique + d.prazo, adiada: false });
  if (!h.abertas.includes(d.id)) h.abertas.push(d.id);
  sim.emitir('decisao', { id: d.id });
  sim.mudancas.marcar('holding');
}

function novoEfeito(sim, e, origem) {
  const { tipo, meses, ...resto } = e;
  H(sim).efeitos.push({ tipo, ...resto, ate: meses ? sim.tique + meses * MES_TIQUES : null, origem, anulado: false });
}

/** Aplica um efeito de decisão; `auto`: a opção padrão no fim do prazo (paga o que o caixa tiver, D41). */
function aplicar(sim, e, origem, auto) {
  switch (e.tipo) {
    case 'caixa':
      if (e.v > 0) sim.holding.receber(e.v, 'decisao');
      else if (e.v < 0) sim.holding.pagar(auto ? Math.min(-e.v, sim.holding.caixa()) : -e.v, 'decisao');
      break;
    case 'licencas':
      if (sim.json.ladrilhos) concederLicencas(sim, e.n);
      break;
    case 'semChoque':
      for (const x of H(sim).efeitos) if (x.origem === `evento:${e.evento}`) x.anulado = true;
      break;
    case 'objetivo': {
      const lista = H(sim).objetivosExtras;
      if (!lista.some((o) => o.id === e.id)) lista.push({ dominio: e.dominio, id: e.id });
      break;
    }
    default:
      novoEfeito(sim, e, origem);
  }
}

/** Escolhe a opção de uma decisão aberta. Devolve { ok } ou o código. */
export function escolher(sim, id, opcao, auto = false) {
  const h = H(sim);
  const d = DECISOES.find((x) => x.id === id);
  if (!d) return 'inexistente';
  const pi = h.pendentes.findIndex((p) => p.id === id);
  if (pi < 0) return 'prazo';
  const o = d.opcoes.find((x) => x.id === opcao);
  if (!o) return 'inexistente';
  const custo = o.efeitos.reduce((a, e) => a + (e.tipo === 'caixa' && e.v < 0 ? -e.v : 0), 0);
  if (!auto && custo > sim.holding.caixa()) return 'creditos';
  for (const e of o.efeitos) aplicar(sim, e, `decisao:${d.id}`, auto);
  if (o.influencia) somarMedidor(sim, 'influencia', o.influencia, `decisao:${d.id}`);
  if (o.legado) somarMedidor(sim, 'legado', o.legado, `decisao:${d.id}`);
  h.pendentes.splice(pi, 1);
  h.decididas.push({ id: d.id, opcao: o.id, tique: sim.tique, auto });
  h.marcas.push(`${d.id}:${o.id}`);
  postarMural(sim, o.quem, `s3.mural.decisao.${d.id}.${o.id}`, {}, null, MURAL_MAX);
  sim.mudancas.marcar('holding');
  return { ok: true, dados: { opcao: o.id, auto } };
}

function cmdEscolher(sim, { id, opcao } = {}) {
  const r = escolher(sim, id, opcao, false);
  return r;
}

function cmdAdiar(sim, { id } = {}) {
  const h = H(sim);
  const d = DECISOES.find((x) => x.id === id);
  if (!d) return 'inexistente';
  const p = h.pendentes.find((x) => x.id === id);
  if (!p || p.adiada) return 'prazo';
  p.prazo += d.adiar;
  p.adiada = true;
  sim.mudancas.marcar('holding');
  return { ok: true, dados: { prazo: p.prazo } };
}

/** true se a marca da decisão foi gravada ('vila.agua:captacao'). */
export const temMarca = (sim, marca) => !!H(sim)?.marcas.includes(marca);

function sistemaHistoria(sim, k, fatias, T) {
  const h = H(sim);
  // eventos do calendário
  for (const ev of EVENTOS) {
    if (h.eventos.includes(ev.id) || T < tiqueDaData(ev.ano, ev.mes)) continue;
    h.eventos.push(ev.id);
    for (const c of ev.choque ?? []) novoEfeito(sim, c, `evento:${ev.id}`);
    if (ev.mural) postarMural(sim, ev.mural.autor, ev.mural.chave, { ...dataDoTique(T) }, null, MURAL_MAX);
    if (ev.decisao) {
      const d = DECISOES.find((x) => x.id === ev.decisao);
      if (d) abrir(sim, d);
    }
  }
  // decisões sem evento (vila.agua: marco 0, minuto 3)
  const marco = sim.progresso.marco().n;
  for (const d of DECISOES) {
    if (d.evento || h.abertas.includes(d.id)) continue;
    if (T >= tiqueDe(d) && marco >= (d.quando.marco ?? 0)) abrir(sim, d);
  }
  // prazos vencidos: vale a opção padrão
  for (const p of [...h.pendentes]) {
    if (T < p.prazo) continue;
    const d = DECISOES.find((x) => x.id === p.id);
    if (d) escolher(sim, d.id, d.padrao, true);
    else h.pendentes.splice(h.pendentes.indexOf(p), 1);
  }
  // efeitos vencidos saem
  if (h.efeitos.some((e) => e.ate !== null && T >= e.ate)) h.efeitos = h.efeitos.filter((e) => e.ate === null || T < e.ate);
}

// ------------------------------------------------------------------------------------------------ consultas

const chaveOpcao = (d, o) => `s3.decisao.${d.id}.${o.id}`;

/** q.decisoes(): as abertas (cartões do Conselho); com { historico: true }, as já decididas. */
function consultaDecisoes(sim, op = {}) {
  const h = H(sim);
  if (op?.historico) {
    return h.decididas.map((x) => {
      const d = DECISOES.find((y) => y.id === x.id);
      const o = d?.opcoes.find((y) => y.id === x.opcao);
      return { id: x.id, opcao: x.opcao, tique: x.tique, data: dataDoTique(x.tique), auto: x.auto, titulo: `s3.decisao.${x.id}.titulo`, texto: o ? chaveOpcao(d, o) : null, quem: o?.quem ?? null };
    });
  }
  // uma pendente cujo id saiu dos dados (save de outra versão) não aparece; o prazo dela vence sem efeito
  return h.pendentes.filter((p) => DECISOES.some((x) => x.id === p.id)).map((p) => {
    const d = DECISOES.find((x) => x.id === p.id);
    return {
      id: d.id,
      ato: d.ato,
      titulo: `s3.decisao.${d.id}.titulo`,
      texto: `s3.decisao.${d.id}.texto`,
      quem: [...d.quem],
      desde: p.desde,
      prazo: p.prazo,
      adiada: p.adiada,
      podeAdiar: !p.adiada,
      data: dataDoTique(p.desde),
      area: d.area ?? null,
      padrao: d.padrao,
      opcoes: d.opcoes.map((o) => ({
        id: o.id,
        quem: o.quem,
        texto: chaveOpcao(d, o),
        ganho: `${chaveOpcao(d, o)}.ganho`,
        custo: `${chaveOpcao(d, o)}.custo`,
        creditos: o.efeitos.reduce((a, e) => a + (e.tipo === 'caixa' && e.v < 0 ? -e.v : 0), 0),
        influencia: o.influencia,
        legado: o.legado,
      })),
    };
  });
}

/** q.mural({ desde }): falas com tique depois de `desde` (sem argumento, todas). */
function consultaMural(sim, op = {}) {
  const desde = finito(op?.desde, -1);
  return H(sim).mural.filter((p) => p.tique > desde).map((p) => ({ ...p, params: { ...p.params }, data: dataDoTique(p.tique) }));
}

function parteBarra(b, sim) {
  const h = H(sim);
  b.decisoesPendentes = h.pendentes.length;
  if (h.pendentes.length) {
    const p = h.pendentes[0];
    b.alertas.push({ id: 'decisao', gravidade: 'info', glifo: 'conselho', codigo: 'decisaoAberta', params: { id: p.id, prazo: p.prazo }, alvo: { tela: 'conselho' } });
  }
}

export function registrar(sim) {
  sim.registrarJson('historia', historiaVazia());
  sim.registrarComando('decisao.escolher', cmdEscolher);
  sim.registrarComando('decisao.adiar', cmdAdiar);
  sim.registrarConsulta('decisoes', consultaDecisoes);
  sim.registrarConsulta('mural', consultaMural);
  sim.registrarSistema(RODADA, RODADA - 1, sistemaHistoria, 1, { nome: 'historia', ordem: ORDEM.progresso + 2 });
  sim.registrarParteBarra('s3a.historia', parteBarra);
}
