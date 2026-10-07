// Mercado da cidade (D48; dona: S3a), Depósito (D25: 150% do preço base, 100 vendas por janela de 4 h) e importação a
// 160% com entrega em 40 s de jogo.
//
// Obras da cidade (sim.holding.comprarParaObra, chamado pela S2a):
//  - até o marco 2, e nos níveis 1 e 2 sempre: compram do estoque da Holding a 100% do preço base o que houver acima
//    da reserva (item liberado para venda à cidade); o resto a cidade importa por conta própria (sem receita, sem
//    atraso);
//  - do marco 3 em diante, obras de nível 3 a 5 compram só da Holding os itens da cadeia dela (ITENS_DA_CADEIA): sem
//    estoque, a Holding importa a 160% pelo próprio caixa e vende a 100% ("Importação para a cidade", ligada por
//    padrão). Desligada, ou sem caixa depois de reservar a manutenção e os salários do tique (D41), a obra espera
//    ({ espera: true }) e entra no aviso "obras paradas por falta de <item>". Os outros itens a obra importa sozinha,
//    como nos níveis 1 e 2 (a entrada da D48 item a item, C1c).
// A demanda da cidade por item e por hora vai para a tela Holding (q.producao().itens[].cidadeHora).
import { ITENS, ITENS_ORDEM, HOLDING_M1A, precoBase } from '../../data/holding.js';
import { ECONOMIA } from '../../data/economia.js';
import { ORDEM } from '../../contratos/interno.js';
import { PREDIO } from '../../contratos/flags.js';
import { RODADA, HORA } from '../../comum/relogio.js';
import { regrasDe, efeitosAtivos } from './base.js';
import { disponivelVenda, tirarEstoque, porEstoque, itensProducao, prediosProducao, armazemPerto, ehItem } from './producao.js';
import { novaEntregaVisual, frotaVista } from './logistica.js';

export function mercadoVazio() {
  return {
    janela: 0,
    vendidas: 0,
    vendidasTotal: 0,
    autoDeposito: {}, // { item: acima }
    naoVendeCidade: [], // itens que o jogador tirou da venda à cidade
    importarAuto: true, // D48: "Abastecer a cidade por importação"
    importacoes: [], // { id, item, n, fim }
    seq: 0,
    demandaRodada: {}, // unidades pedidas pela cidade na rodada corrente
    demandaHora: {}, // média móvel da demanda por hora
    esperandoRodada: {}, // unidades que fizeram obra esperar na rodada corrente
    esperando: {}, // as da rodada anterior (aviso e camada Recursos)
    totais: { vendidasCidade: 0, importadasCidade: 0, perdaImportacao: 0, deposito: 0, importadas: 0 },
  };
}

const M = (sim) => sim.json.mercado;

/**
 * Itens em que a obra de nível 3 a 5 depende da Holding do marco 3 em diante (a entrada da D48, C1c): os que a Holding
 * faz na parte que se joga, com o prédio dono em HOLDING_M1A (brita, areia, argila, tijolo e concreto no M1a). Cimento,
 * vidro, aço e serrada a Holding do M1a só importaria a 160% para vender a 100%, sem produção que a cidade precise
 * esperar; a obra importa esses sozinha, como nos níveis 1 e 2, até a fábrica deles entrar (Cimenteira, Vidraria e
 * Serraria no M1b, aço no M3).
 */
export const ITENS_DA_CADEIA = Object.freeze(ITENS_ORDEM.filter((k) => HOLDING_M1A.includes(ITENS[k].predio)));

/** Fator e prazo da importação agora (os choques do calendário, como o Bloqueio do Canal de Seshat). */
export function condicoesImportacao(sim) {
  let fator = ECONOMIA.importacao.fator;
  let entrega = ECONOMIA.importacao.entregaTiques;
  for (const e of efeitosAtivos(sim, 'importacao')) {
    if (e.fator) fator *= e.fator;
    if (e.entregaTiques) entrega = Math.max(entrega, e.entregaTiques);
  }
  return { fator, entregaTiques: entrega };
}

const vendeCidade = (sim, item) => !M(sim).naoVendeCidade.includes(item);

/** Caixa que sobra para importar para a cidade depois de reservar a manutenção e os salários deste tique (D41). */
function caixaParaCidade(sim) {
  const E = sim.json.economia;
  const ch = E?.custosHora ?? { servicos: 0, vias: 0, ligacao: 0 };
  const reservado = (ch.servicos + ch.vias + ch.ligacao + (sim.json.producao?.salariosHora ?? 0)) / HORA;
  return Math.max(0, sim.holding.caixa() - reservado);
}

/**
 * Compra de materiais para uma obra da cidade (contrato interno 2.10). ref: o prédio (só informativo); nivel: 1 a 5;
 * materiais: { item: unidades }. Devolve { espera, vendidas, importadas }.
 */
export function comprarParaObra(sim, ref, nivel, materiais) {
  const m = M(sim);
  const lista = ITENS_ORDEM.filter((k) => Number.isFinite(materiais?.[k]) && materiais[k] > 0);
  if (!m || !lista.length) return { espera: false };
  // a demanda por hora conta cada obra uma vez: a obra parada tenta de novo a cada rodada (crescimento.js) e, contada
  // em toda tentativa, uma obra de 8 de concreto parada por 1 hora aparecia como 1.440 por hora na tela Holding (C1a,
  // revisão); o que ela ainda espera fica em `esperando`
  const P = sim.tabelas.predios;
  const i = P?.idxVivo ? P.idxVivo(ref) : -1;
  const retomada = i >= 0 && (P.flags[i] & PREDIO.SEM_MATERIAL) !== 0;
  if (!retomada) for (const k of lista) m.demandaRodada[k] = (m.demandaRodada[k] ?? 0) + materiais[k];
  const dependente = nivel >= 3 && sim.progresso.liberado('regra.dependencia') && sim.progresso.marco().n >= 3;
  // fora da cadeia da Holding a falta não é dela: a obra importa sozinha (falta 0 aqui)
  const plano = lista.map((k) => {
    const pede = Math.ceil(materiais[k]);
    const doEstoque = vendeCidade(sim, k) ? Math.min(pede, disponivelVenda(sim, k)) : 0;
    return { k, pede, doEstoque, falta: ITENS_DA_CADEIA.includes(k) ? pede - doEstoque : 0 };
  });
  if (!dependente) {
    for (const p of plano) vender(sim, p.k, p.doEstoque);
    return { espera: false, vendidas: plano.reduce((a, p) => a + p.doEstoque, 0), importadas: 0 };
  }
  const { fator } = condicoesImportacao(sim);
  const custo = plano.reduce((a, p) => a + p.falta * precoBase(p.k) * fator, 0);
  const falta = plano.reduce((a, p) => a + p.falta, 0);
  if (falta > 0 && (!m.importarAuto || caixaParaCidade(sim) < custo)) {
    for (const p of plano) if (p.falta > 0) m.esperandoRodada[p.k] = (m.esperandoRodada[p.k] ?? 0) + p.falta;
    return { espera: true, vendidas: 0, importadas: 0 };
  }
  for (const p of plano) vender(sim, p.k, p.doEstoque);
  if (falta > 0) {
    sim.holding.pagar(custo, 'importacaoCidade');
    let receita = 0;
    for (const p of plano) receita += p.falta * precoBase(p.k);
    sim.holding.receber(receita, 'cidade');
    m.totais.importadasCidade += falta;
    m.totais.perdaImportacao += custo - receita;
  }
  return { espera: false, vendidas: plano.reduce((a, p) => a + p.doEstoque, 0), importadas: falta };
}

/** Vende n unidades do estoque à cidade a 100% do preço base. */
function vender(sim, item, n) {
  if (!(n > 0)) return;
  tirarEstoque(sim, item, n);
  sim.holding.receber(n * precoBase(item), 'cidade');
  M(sim).totais.vendidasCidade += n;
}

// ------------------------------------------------------------------------------------------------ Depósito

/** Janela atual do Depósito (D25): floor(tique / 14.400); ao virar, as vendas voltam a 0. */
function virarJanela(sim) {
  const m = M(sim);
  const j = Math.floor(sim.tique / regrasDe(sim).deposito.janelaTiques);
  if (j !== m.janela) {
    m.janela = j;
    m.vendidas = 0;
  }
}

/** Quantas vendas ainda cabem na janela (puro). */
function restamNaJanela(sim) {
  const m = M(sim);
  const r = regrasDe(sim).deposito;
  const j = Math.floor(sim.tique / r.janelaTiques);
  return r.vendasPorJanela == null ? Infinity : r.vendasPorJanela - (j === m.janela ? m.vendidas : 0);
}

/** Vende no Depósito (a 150% do preço base), até o que cabe na janela. Devolve as vendidas ou o código. */
function venderDeposito(sim, item, n) {
  virarJanela(sim);
  const m = M(sim);
  const p = sim.json.producao;
  const r = regrasDe(sim).deposito;
  const resta = r.vendasPorJanela == null ? Infinity : r.vendasPorJanela - m.vendidas;
  if (resta <= 0) return 'limite';
  const tem = p.estoque[item] ?? 0;
  if (tem <= 0) return 'nada';
  const k = Math.min(n, tem, resta);
  tirarEstoque(sim, item, k);
  m.vendidas += k;
  m.vendidasTotal += k;
  m.totais.deposito += k;
  const valor = k * precoBase(item) * r.venda;
  sim.holding.receber(valor, 'deposito');
  // o caminhão do Depósito é só visual (D25), do armazém até a rodovia
  const a = armazemPerto(sim);
  if (a) novaEntregaVisual(sim, { item, n: k, origem: { x: a.x, z: a.z }, destino: 'entrada' });
  sim.emitir('financas', { tipo: 'deposito' });
  return { vendidas: k, valor };
}

function cmdVender(sim, { item, n } = {}) {
  if (!ehItem(item) || !Number.isInteger(n) || n < 1) return 'valor';
  const r = venderDeposito(sim, item, n);
  return typeof r === 'string' ? r : { ok: true, dados: r };
}

function cmdAuto(sim, { item, acima } = {}) {
  if (!ehItem(item)) return 'valor';
  const m = M(sim);
  if (acima === null || acima === undefined) delete m.autoDeposito[item];
  else if (Number.isInteger(acima) && acima >= 0) m.autoDeposito[item] = acima;
  else return 'valor';
  sim.mudancas.marcar('holding');
  return { ok: true };
}

// ------------------------------------------------------------------------------------------------ importação

function cmdImportar(sim, { item, n } = {}) {
  if (!ehItem(item) || !Number.isInteger(n) || n < 1 || n > 1000) return 'valor';
  if (!sim.progresso.liberado(`item.${item}`)) return 'trancado';
  const { fator, entregaTiques } = condicoesImportacao(sim);
  const custo = n * precoBase(item) * fator;
  if (!sim.holding.pagar(custo, 'importacao')) return 'creditos';
  const m = M(sim);
  const id = ++m.seq;
  m.importacoes.push({ id, item, n, fim: sim.tique + entregaTiques });
  m.totais.importadas += n;
  const a = armazemPerto(sim);
  if (a) novaEntregaVisual(sim, { item, n, origem: 'entrada', destino: { x: a.x, z: a.z }, duracao: entregaTiques });
  sim.emitir('financas', { tipo: 'importacao' });
  return { ok: true, id, dados: { custo, chega: sim.tique + entregaTiques } };
}

function cmdVendeCidade(sim, { item, sim: sn } = {}) {
  if (!ehItem(item) || typeof sn !== 'boolean') return 'valor';
  const m = M(sim);
  m.naoVendeCidade = m.naoVendeCidade.filter((k) => k !== item);
  if (!sn) m.naoVendeCidade.push(item);
  m.naoVendeCidade.sort();
  sim.mudancas.marcar('holding');
  return { ok: true };
}

function cmdImportarAuto(sim, { sim: sn } = {}) {
  if (typeof sn !== 'boolean') return 'valor';
  M(sim).importarAuto = sn;
  sim.mudancas.marcar('holding');
  return { ok: true };
}

// ------------------------------------------------------------------------------------------------ o tique

function sistemaMercado(sim, k, fatias, T) {
  const m = M(sim);
  // importações que chegam
  if (m.importacoes.length) {
    const ficam = [];
    for (const imp of m.importacoes) {
      if (imp.fim <= T) porEstoque(sim, imp.item, imp.n);
      else ficam.push(imp);
    }
    if (ficam.length !== m.importacoes.length) m.importacoes = ficam;
  }
  if (T % RODADA !== RODADA - 1) return;
  // fim da rodada: demanda por hora (média móvel com constante de 1 hora), avisos de espera e o Depósito automático
  const a = RODADA / HORA;
  for (const item of ITENS_ORDEM) {
    const v = ((m.demandaRodada[item] ?? 0) * HORA) / RODADA;
    const ant = m.demandaHora[item] ?? 0;
    const novo = ant + (v - ant) * a;
    if (novo > 1e-6 || ant > 0) m.demandaHora[item] = novo > 1e-6 ? novo : 0;
    if (m.demandaHora[item] === 0) delete m.demandaHora[item];
  }
  m.demandaRodada = {};
  m.esperando = m.esperandoRodada;
  m.esperandoRodada = {};
  for (const item of Object.keys(m.autoDeposito).sort()) {
    const p = sim.json.producao;
    const limite = Math.max(m.autoDeposito[item], p.reserva[item] ?? 0);
    const excesso = (p.estoque[item] ?? 0) - limite;
    if (excesso > 0 && restamNaJanela(sim) > 0) venderDeposito(sim, item, excesso);
  }
}

// ------------------------------------------------------------------------------------------------ consultas

/** q.deposito() (seção 2.6). */
function consultaDeposito(sim) {
  const m = M(sim);
  const r = regrasDe(sim).deposito;
  const p = sim.json.producao;
  const j = Math.floor(sim.tique / r.janelaTiques);
  return {
    janela: { fimTique: (j + 1) * r.janelaTiques, vendidas: j === m.janela ? m.vendidas : 0, max: r.vendasPorJanela ?? null },
    itens: itensProducao(sim).map(({ item }) => ({
      item,
      estoque: p.estoque[item] ?? 0,
      reserva: p.reserva[item] ?? 0,
      precoBase: precoBase(item),
      precoVenda: precoBase(item) * r.venda,
      precoImportacao: precoBase(item) * condicoesImportacao(sim).fator,
      vendeCidade: vendeCidade(sim, item),
      auto: m.autoDeposito[item] ?? null,
    })),
    importarAuto: m.importarAuto,
    importacoes: m.importacoes.map((x) => ({ ...x })),
  };
}

/** q.producao() (seção 2.6). */
function consultaProducao(sim) {
  const m = M(sim);
  const p = sim.json.producao;
  return {
    itens: itensProducao(sim, m.demandaHora),
    predios: prediosProducao(sim),
    frota: frotaVista(sim),
    armazem: { usado: Object.values(p.estoque).reduce((a, v) => a + v, 0), capacidade: p.cap },
    importarAuto: m.importarAuto,
    esperando: { ...m.esperando },
  };
}

/** Item com mais obra esperando na última rodada (o aviso "obras paradas por falta de concreto"). */
export function obrasEsperando(sim) {
  const e = M(sim)?.esperando ?? {};
  let melhor = null;
  for (const k of Object.keys(e).sort()) if (!melhor || e[k] > e[melhor]) melhor = k;
  return melhor ? { item: melhor, n: e[melhor] } : null;
}

function parteBarra(b, sim) {
  const o = obrasEsperando(sim);
  if (o) b.alertas.push({ id: 'obrasSemMaterial', gravidade: 'atencao', glifo: 'semMaterial', codigo: 'obrasSemMaterial', params: { item: o.item, n: o.n }, alvo: { tela: 'holding' } });
}

export function registrar(sim) {
  sim.registrarJson('mercado', mercadoVazio());
  sim.registrarComando('deposito.vender', cmdVender);
  sim.registrarComando('deposito.auto', cmdAuto);
  sim.registrarComando('importar', cmdImportar);
  sim.registrarComando('estoque.vendeCidade', cmdVendeCidade);
  sim.registrarComando('cidade.importarAuto', cmdImportarAuto);
  sim.registrarConsulta('deposito', consultaDeposito);
  sim.registrarConsulta('producao', consultaProducao);
  sim.registrarSistema(1, 0, sistemaMercado, 1, { nome: 'holding.mercado', ordem: ORDEM.holding + 1 });
  sim.registrarParteBarra('s3a.mercado', parteBarra);
}

