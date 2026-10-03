// Economia (dona: S3a): receitas e despesas por hora de jogo com o caixa nunca negativo e a ordem de pagamento da D41,
// o empréstimo igual ao de hoje (regra do dono), o orçamento, a série mensal e a parte da barra que é da economia.
//
// Cada tique: entra a Contribuição dos moradores (D11: moradores x tarifa do bem-estar médio suavizado e arredondado,
// por hora de jogo); os juros de cada contrato correm (10% ao ano, 20% depois de 10 anos); paga-se, nesta ordem, a
// manutenção de vias e serviços (com a ligação externa), os salários da Holding e, quando a cidade compra, a
// importação para ela (holding/mercado.js). O que não dá para pagar não vira dívida: os serviços trabalham na fração
// paga (sim.economia.eficiencia()), as linhas da Holding param e a obra da cidade que dependia de importação espera.
//
// Dinheiro em unidades de desenho (D87); a interface converte para US$ pelo REGRAS_DONO.moeda. Calendário com data
// real (D67): o tique 0 é jan. 2020; o empréstimo segue o ano de jogo (ano 1 = 2020).
//
// Este arquivo também instala os serviços do contrato interno (2.10) que são da S3a: sim.holding (caixa, pagar,
// receber, comprarParaObra, entregar, efeito) e sim.progresso (de progresso.js), logo no começo, para as parcelas que
// registram depois (X1b) já falarem com os de verdade.
import { ECONOMIA, CAIXA_INICIAL, tarifaPelasRegras } from '../data/economia.js';
import { dataDoTique, anoDeJogo, anoDoCalendario } from '../data/historia.js';
import { HORA, ANO, MES, RODADA } from '../comum/relogio.js';
import { ORDEM } from '../contratos/interno.js';
import { definirIdentidade } from './substitutos.js';
import { regrasDe, lancar, naoPago, atualizarLivro, somaHora, caixaVazio, finito } from './holding/base.js';
import { instalarProgresso } from './progresso.js';
import { comprarParaObra } from './holding/mercado.js';
import { entregar, registrarChegada } from './holding/logistica.js';
import { salariosHora, valorHolding, folhaHolding, ocupadosHolding } from './holding/producao.js';
import { efeitosAtivos, somarMedidor, medidores } from './historia.js';
import { JOGADOR, MUNDO, CONSELHEIROS, CONSELHEIROS_ORDEM } from '../data/nomes.js';

// ------------------------------------------------------------------------------------------------ contribuição

/**
 * Contribuição dos moradores por hora de jogo (D11). Com tarifaPor 'cidade': moradores x tarifa do bem-estar médio
 * suavizado e arredondado. Com 'predio' (proposta da pergunta 3): cada prédio paga pela sua faixa; `predios` é uma
 * lista de [moradores, bem-estar] (ou null: cai na conta da cidade).
 * @example contribuicaoHora(REGRAS_DONO, { populacao: 1000, bemEstarTarifa: 61 }) // 11000
 */
export function contribuicaoHora(regras, ag, predios = null) {
  if (regras.renda.tarifaPor === 'predio' && predios) {
    let s = 0;
    for (const [m, b] of predios) if (m > 0) s += m * tarifaPelasRegras(regras, b);
    return s;
  }
  const pop = finito(ag?.populacao);
  return pop > 0 ? pop * tarifaPelasRegras(regras, ag.bemEstarTarifa) : 0;
}

/** Lista [moradores, bem-estar] por prédio residencial, se a S2a publicou a coluna predios.bemEstar; senão null. */
function prediosComBemEstar(sim) {
  const P = sim.tabelas.predios;
  if (!P || !P.bemEstar || !P.moradores) return null;
  const out = [];
  for (let i = 0; i < P.n; i++) if (P.viva[i] && P.moradores[i] > 0) out.push([P.moradores[i], P.bemEstar[i]]);
  return out;
}

/**
 * Contribuição por hora de jogo: a dos moradores da cidade e a dos moradores de luxo da Arcologia (torre.e3, D49), que
 * também são moradores e pagam a Contribuição na faixa do bem-estar deles (sim.arcologia.contribuicaoHora da X1b).
 */
const rendaHora = (sim) => {
  const regras = regrasDe(sim);
  const cidade = contribuicaoHora(regras, sim.agregados, regras.renda.tarifaPor === 'predio' ? prediosComBemEstar(sim) : null);
  return cidade + finito(sim.arcologia?.contribuicaoHora?.());
};

// ------------------------------------------------------------------------------------------------ empréstimo

const emp = (sim) => sim.json.economia.emprestimo;

/** Principal, juros devidos e dívida (= soma dos contratos, D41). */
export function divida(sim) {
  const E = emp(sim);
  let juros = 0;
  let principal = 0;
  for (const c of E.contratos) {
    juros += c.juros;
    principal += c.saldo;
  }
  return { principal, juros, divida: principal + juros };
}

const tomadoNoAno = (sim, ano) => emp(sim).contratos.reduce((a, c) => a + (c.ano === ano ? c.valor : 0), 0);

/** Taxa anual de um contrato no tique (mora depois do prazo). */
function taxaDe(regras, c, tique) {
  const r = regras.emprestimo;
  return tique - c.ini >= r.prazoAnos * ANO ? r.mora : r.taxaAno;
}

function podar(sim) {
  const E = emp(sim);
  const ano = anoDeJogo(sim.tique);
  E.contratos = E.contratos.filter((c) => c.saldo > 0 || c.juros > 1e-9 || c.ano === ano);
}

/** Abate v do principal, dos contratos mais antigos primeiro. */
function abaterPrincipal(sim, v) {
  const E = emp(sim);
  for (const c of [...E.contratos].sort((a, b) => a.ini - b.ini || a.id - b.id)) {
    if (v <= 0) break;
    const x = Math.min(v, c.saldo);
    c.saldo -= x;
    v -= x;
  }
  E.principal = E.contratos.reduce((a, c) => a + c.saldo, 0);
}

/** Abate v dos juros devidos, dos contratos mais antigos primeiro. */
function abaterJuros(sim, v) {
  for (const c of [...emp(sim).contratos].sort((a, b) => a.ini - b.ini || a.id - b.id)) {
    if (v <= 0) break;
    const x = Math.min(v, c.juros);
    c.juros -= x;
    v -= x;
    if (c.juros < 1e-9) c.juros = 0;
  }
}

function tomar(sim, { valor } = {}) {
  const r = regrasDe(sim).emprestimo;
  const v = valor;
  if (!Number.isInteger(v) || v < r.passo || v % r.passo) return { ok: false, codigo: 'valor' };
  const ano = anoDeJogo(sim.tique);
  if (tomadoNoAno(sim, ano) + v > r.porAno) return { ok: false, codigo: 'limiteAno' };
  if (divida(sim).divida + v > r.dividaMax) return { ok: false, codigo: 'limiteDivida' };
  const E = emp(sim);
  const c = { id: ++E.seq, ano, valor: v, saldo: v, juros: 0, ini: sim.tique, fim: sim.tique + r.prazoAnos * ANO };
  E.contratos.push(c);
  E.principal += v;
  sim.holding.receber(v, 'emprestimo');
  podar(sim);
  sim.emitir('financas', { tipo: 'emprestimo' });
  return { ok: true, id: c.id, dados: { contrato: { ...c, ano: anoDoCalendario(c.ano) } } };
}

const parcelaDe = (sim) => {
  const r = regrasDe(sim).emprestimo;
  const p = emp(sim).principal;
  return p > 0 ? Math.min(p, Math.max(r.passo, Math.ceil(p / 10))) : 0;
};

function pagarJuros(sim) {
  const dev = Math.ceil(divida(sim).juros - 1e-9);
  if (dev < 1) return { ok: false, codigo: 'nada' };
  const caixa = sim.holding.caixa();
  if (caixa < 1) return { ok: false, codigo: 'creditos' };
  const v = Math.min(caixa, divida(sim).juros);
  sim.holding.pagar(v, 'jurosPagos');
  abaterJuros(sim, v);
  podar(sim);
  sim.emitir('financas', { tipo: 'juros' });
  return { ok: true, dados: { valor: v, parcial: divida(sim).juros >= 1 } };
}

function pagarParcela(sim) {
  const par = parcelaDe(sim);
  const jur = divida(sim).juros;
  if (par < 1 && jur < 1) return { ok: false, codigo: 'nada' };
  const total = jur + par;
  if (sim.holding.caixa() < total) return { ok: false, codigo: 'creditos' };
  if (jur > 0) sim.holding.pagar(jur, 'jurosPagos');
  if (par > 0) sim.holding.pagar(par, 'pagamentoEmprestimo');
  abaterJuros(sim, jur);
  abaterPrincipal(sim, par);
  podar(sim);
  sim.emitir('financas', { tipo: 'parcela' });
  return { ok: true, dados: { valor: total, juros: jur, parcela: par } };
}

function quitar(sim) {
  const d = divida(sim);
  if (d.divida < 1) return { ok: false, codigo: 'nada' };
  if (sim.holding.caixa() < d.divida) return { ok: false, codigo: 'creditos' };
  if (d.juros > 0) sim.holding.pagar(d.juros, 'jurosPagos');
  if (d.principal > 0) sim.holding.pagar(d.principal, 'pagamentoEmprestimo');
  abaterJuros(sim, d.juros);
  abaterPrincipal(sim, d.principal);
  podar(sim);
  sim.emitir('financas', { tipo: 'quitou' });
  return { ok: true, dados: { valor: d.divida } };
}

/** q.emprestimo() (seção 2.6). Anos no calendário (2020 em diante); o limite segue o ano de jogo. */
export function consultaEmprestimo(sim) {
  const r = regrasDe(sim).emprestimo;
  const ano = anoDeJogo(sim.tique);
  const tomado = tomadoNoAno(sim, ano);
  const d = divida(sim);
  const disponivel = Math.max(0, Math.floor(Math.min(r.porAno - tomado, r.dividaMax - d.divida) / r.passo) * r.passo);
  return {
    disponivelAno: disponivel,
    tomadoAno: tomado,
    limiteAno: r.porAno,
    divida: d.divida,
    principal: d.principal,
    dividaMax: r.dividaMax,
    taxa: r.taxaAno,
    mora: r.mora,
    passo: r.passo,
    prazoAnos: r.prazoAnos,
    jurosDevidos: d.juros,
    jurosHora: jurosHora(sim),
    parcela: parcelaDe(sim),
    ano: anoDoCalendario(ano),
    contratos: emp(sim).contratos
      .filter((c) => c.saldo > 0 || c.juros > 0)
      .map((c) => ({ id: c.id, ano: anoDoCalendario(c.ano), valor: c.valor, saldo: c.saldo, juros: c.juros, ini: c.ini, fim: c.fim, mora: sim.tique - c.ini >= r.prazoAnos * ANO })),
  };
}

/** Juros que correm por hora de jogo (10% ao ano e o ano tem 2 h: 5% do saldo por hora). */
export function jurosHora(sim) {
  const regras = regrasDe(sim);
  let s = 0;
  for (const c of emp(sim).contratos) s += (c.saldo * taxaDe(regras, c, sim.tique) * HORA) / ANO;
  return s;
}

// ------------------------------------------------------------------------------------------------ orçamento

/** Custos registrados (sim.custos) por categoria do orçamento: vias, ligação externa e o resto como serviços. */
function custosPorCategoria(sim) {
  const out = { servicos: 0, vias: 0, ligacao: 0 };
  for (const { nome, valor } of sim.custos.lista()) {
    const v = finito(valor);
    if (!(v > 0)) continue;
    if (nome === 'vias' || nome.startsWith('vias.')) out.vias += v;
    else if (/ligacao|externa/i.test(nome)) out.ligacao += v;
    else out.servicos += v;
  }
  return out;
}

/** Receitas, despesas e não pago por hora de jogo (puro). */
export function porHora(sim) {
  const E = sim.json.economia;
  const L = E.livro;
  const t = sim.tique;
  const receitas = {
    moradores: rendaHora(sim),
    cidade: somaHora(L, 'r.cidade', t),
    deposito: somaHora(L, 'r.deposito', t),
    marcos: somaHora(L, 'r.marcos', t),
  };
  const aporte = somaHora(L, 'r.aporte', t);
  if (aporte > 0) receitas.aporte = aporte;
  const despesas = {
    servicos: E.custosHora.servicos,
    vias: E.custosHora.vias,
    ligacao: E.custosHora.ligacao,
    salarios: salariosHora(sim),
    juros: jurosHora(sim),
    importacao: somaHora(L, 'd.importacao', t),
    importacaoCidade: somaHora(L, 'd.importacaoCidade', t),
  };
  const soma = (o) => Object.values(o).reduce((a, v) => a + v, 0);
  const saldoHora = soma(receitas) - soma(despesas);
  return {
    receitas,
    despesas,
    naoPago: { servicos: somaHora(L, 'n.servicos', t), salarios: somaHora(L, 'n.salarios', t) },
    investimentos: somaHora(L, 'd.investimentos', t),
    saldoHora,
    // o que sai do caixa de fato: os juros correm como dívida (só saem quando o jogador paga), então não zeram o caixa
    fluxoCaixaHora: saldoHora + despesas.juros,
  };
}

/** q.orcamento() (seção 2.6). */
export function consultaOrcamento(sim) {
  const E = sim.json.economia;
  const h = porHora(sim);
  return {
    receitas: h.receitas,
    despesas: h.despesas,
    naoPago: h.naoPago,
    investimentosHora: h.investimentos,
    saldoHora: h.saldoHora,
    fluxoCaixaHora: h.fluxoCaixaHora,
    caixa: sim.holding.caixa(),
    eficiencia: E.eficiencia,
    caixaZerado: E.zerado,
    totais: JSON.parse(JSON.stringify(E.livro.totais)),
    serie: E.serie.map((p) => ({ ...p })),
  };
}

/** q.holding() (seção 2.6, D55): identidade, Influência e Legado com o efeito escrito, valuation e quem é quem. */
export function consultaHolding(sim) {
  const id = sim.json.identidade ?? { nome: 'Held', cor: '#c9a86a' };
  const m = medidores(sim);
  return {
    nome: id.nome,
    cor: id.cor,
    influencia: m.influencia,
    legado: m.legado,
    efeitos: m.efeitos,
    divisoes: [],
    valuation: valuation(sim),
    empresa: MUNDO.holding,
    pais: MUNDO.pais,
    jogador: JOGADOR.nome,
    ato: sim.json.historia?.ato ?? 1,
    conselheiros: CONSELHEIROS_ORDEM.map((k) => ({ id: k, ...CONSELHEIROS[k] })),
  };
}

/**
 * Patrimônio (seção 12.7 do desenho): caixa − dívida + prédios da Holding pelo custo + estoque a preço base + a obra da
 * Arcologia (D49: créditos pagos e materiais entregues, sim.arcologia.valor da X1b), que é da Holding.
 */
export function valuation(sim) {
  return sim.holding.caixa() - divida(sim).divida + valorHolding(sim) + finito(sim.arcologia?.valor?.());
}

// ------------------------------------------------------------------------------------------------ o tique

function tique(sim, k, fatias, T) {
  const E = sim.json.economia;
  const regras = regrasDe(sim);
  atualizarLivro(sim);
  // custos registrados: uma vez por rodada (as funções das outras parcelas podem varrer tabelas)
  if (T % RODADA === 0) {
    const c = custosPorCategoria(sim);
    E.custosHora.servicos = c.servicos;
    E.custosHora.vias = c.vias;
    E.custosHora.ligacao = c.ligacao;
  }
  // 1. receitas contínuas: a Contribuição dos moradores
  const renda = rendaHora(sim) / HORA;
  if (renda > 0) sim.holding.receber(renda, 'moradores');
  // juros correm em cada contrato (não saem do caixa: são dívida até o jogador pagar)
  for (const c of E.emprestimo.contratos) if (c.saldo > 0) c.juros += (c.saldo * taxaDe(regras, c, T)) / ANO;
  // 2. manutenção de vias, serviços e ligação, na fração possível
  const ch = E.custosHora;
  const manut = (ch.servicos + ch.vias + ch.ligacao) / HORA;
  let frac = 1;
  if (manut > 0) {
    const pago = Math.min(manut, sim.holding.caixa());
    frac = pago / manut;
    if (pago > 0) {
      // proporcional por categoria; o pagamento sai uma vez só (sem arredondar para não sobrar resto)
      const hj = sim.json.holding;
      hj.caixa -= pago;
      if (hj.caixa < 0) hj.caixa = 0;
      for (const cat of ['servicos', 'vias', 'ligacao']) if (ch[cat] > 0) lancar(sim, 'despesa', cat, (pago * ch[cat]) / HORA / manut);
    }
    if (frac < 1) naoPago(sim, 'servicos', manut - pago);
  }
  E.eficiencia = frac;
  // 3. salários da Holding: sem o salário inteiro, as linhas param neste tique
  const sal = salariosHora(sim) / HORA;
  if (sal > 0) {
    const ok = sim.holding.pagar(sal, 'salarios');
    E.salariosOk = ok;
    if (!ok) naoPago(sim, 'salarios', sal);
  } else E.salariosOk = true;
  // caixa zerado (D41): sem caixa e saldo que não fecha
  if (T % RODADA === 7 || E.zerado) {
    const caixa = sim.holding.caixa();
    const fluxo = porHora(sim).fluxoCaixaHora;
    const zerado = caixa < ECONOMIA.caixaZeradoAbaixo && (fluxo < 0 || frac < 1 || !E.salariosOk);
    if (zerado !== E.zerado) {
      E.zerado = zerado;
      sim.emitir('caixaZerado', { sim: zerado });
    }
  }
}

/** Fecha o mês: um ponto na série (até 240 = 20 anos). */
function fecharMes(sim, k, fatias, T) {
  const E = sim.json.economia;
  const L = E.livro;
  const ag = sim.agregados;
  const { ano, mes } = dataDoTique(T);
  const desemp = ag.empregos?.desemprego ?? [0, 0, 0, 0];
  E.serie.push({
    ano,
    mes,
    caixa: sim.holding.caixa(),
    receitas: L.mes.receitas,
    despesas: L.mes.despesas,
    investimentos: L.mes.investimentos,
    moradores: finito(ag.populacao),
    bemEstar: finito(ag.bemEstarMedio),
    desemprego: desemp.reduce((a, v) => a + finito(v), 0) / Math.max(1, desemp.length),
    divida: divida(sim).divida,
  });
  if (E.serie.length > ECONOMIA.serieMax) E.serie.splice(0, E.serie.length - ECONOMIA.serieMax);
  L.mes = { receitas: 0, despesas: 0, investimentos: 0 };
}

// ------------------------------------------------------------------------------------------------ barra

function parteBarra(b, sim) {
  const E = sim.json.economia;
  const caixa = sim.holding.caixa();
  const h = porHora(sim);
  const d = divida(sim);
  const t = sim.espelho.tempo;
  const { ano, mes, fracMes } = dataDoTique(sim.tique, t?.frac ?? 0);
  b.creditos = caixa;
  b.saldoHora = h.saldoHora;
  b.divida = d.divida;
  b.valuation = valuation(sim);
  b.caixaZerado = E.zerado;
  b.data = { mes, ano, fracMes, fase: t?.fase ?? 'manha' };
  b.alertas = b.alertas.filter((a) => a.id !== 'caixa');
  if (E.zerado) {
    b.alertas.unshift({ id: 'caixa', gravidade: 'grave', glifo: 'caixa', codigo: 'caixaZerado', params: {}, alvo: { tela: 'economia' } });
  } else if (h.fluxoCaixaHora < 0 && caixa > 0) {
    // "o caixa zera em": pelo que sai do caixa (sem os juros, que viram dívida)
    const minutos = (caixa / -h.fluxoCaixaHora) * 60;
    if (minutos < ECONOMIA.avisoCaixaMinutos) {
      b.alertas.unshift({ id: 'caixa', gravidade: 'atencao', glifo: 'caixa', codigo: 'caixaVaiZerar', params: { minutos: Math.max(1, Math.floor(minutos)) }, alvo: { tela: 'economia' } });
    }
  }
}

// ------------------------------------------------------------------------------------------------ registro

/** Categorias que, pagas por pagar() (S1b, S2a), são obra e não manutenção. */
const OBRAS = Object.freeze(['vias', 'servicos', 'ligacao']);

/** Estado inicial da seção 'economia'. */
export function economiaVazia() {
  return {
    emprestimo: { seq: 0, principal: 0, contratos: [] },
    livro: caixaVazio(),
    custosHora: { servicos: 0, vias: 0, ligacao: 0 },
    eficiencia: 1,
    salariosOk: true,
    zerado: false,
    serie: [],
  };
}

export function registrar(sim) {
  sim.registrarJson('economia', economiaVazia());
  const hj = sim.json.holding;
  if (!(hj.caixa >= 0)) hj.caixa = CAIXA_INICIAL;
  if (!hj.efeitos) hj.efeitos = {};

  // sim.progresso de verdade antes das parcelas que registram depois (X1b usa requisito no registrar dela)
  instalarProgresso(sim);

  // sim.holding de verdade (2.10): o caixa nunca fica abaixo de 0 (D41), com o livro-caixa por categoria
  sim.implementar('holding', {
    caixa: () => sim.json.holding.caixa,
    pagar(valor, categoria) {
      const h = sim.json.holding;
      if (!(valor >= 0) || !Number.isFinite(valor)) return false;
      if (h.caixa < valor) return false;
      h.caixa -= valor;
      // obra de via ou de serviço paga por outra parcela é investimento (a manutenção, a S3a lança à parte)
      lancar(sim, 'despesa', OBRAS.includes(categoria) ? `obra.${categoria}` : categoria, valor);
      return true;
    },
    receber(valor, categoria) {
      if (!(valor > 0) || !Number.isFinite(valor)) return;
      sim.json.holding.caixa += valor;
      lancar(sim, 'receita', categoria, valor);
    },
    comprarParaObra: (ref, nivel, materiais) => comprarParaObra(sim, ref, nivel, materiais),
    entregar: (pedido) => entregar(sim, pedido),
    efeito(id, dados) {
      const h = sim.json.holding;
      const p = finito(dados?.produtividade);
      const c = Math.max(0, Math.floor(finito(dados?.caminhoes)));
      h.efeitos[String(id)] = { produtividade: p, caminhoes: c };
      sim.mudancas.marcar('holding');
    },
  });
  // acréscimos da S3a fora do contrato (pendência do integrador: passar para contratos/interno.js)
  sim.holding.registrarChegada = (nome, fn) => registrarChegada(sim, nome, fn);
  sim.holding.folha = (ref) => folhaHolding(sim, ref);
  sim.holding.ocupados = () => ocupadosHolding(sim);
  sim.holding.estoque = (item) => sim.json.producao?.estoque?.[item] ?? 0;
  sim.implementar('economia', {});
  sim.economia = {
    /** Fração da manutenção paga no último tique (os serviços trabalham nela, D41). */
    eficiencia: () => sim.json.economia.eficiencia,
    caixaZerado: () => sim.json.economia.zerado,
    regras: () => regrasDe(sim),
    data: (t = sim.tique) => dataDoTique(t),
    /** Efeitos ativos das decisões e dos eventos de um tipo ('bemArea', 'demanda'...). */
    efeitos: (tipo) => efeitosAtivos(sim, tipo),
    /** Soma Influência ou Legado (X1b: torre.e4 dá Legado +5). */
    somarMedidor: (nome, v, motivo) => somarMedidor(sim, nome, v, motivo),
  };

  sim.registrarComando('holding.identidade', (s, args) => definirIdentidade(s, args));
  sim.registrarComando('emprestimo.tomar', tomar);
  sim.registrarComando('emprestimo.pagarJuros', pagarJuros);
  sim.registrarComando('emprestimo.pagarParcela', pagarParcela);
  sim.registrarComando('emprestimo.quitar', quitar);
  sim.registrarConsulta('orcamento', consultaOrcamento);
  sim.registrarConsulta('emprestimo', consultaEmprestimo);
  // marcada como substituível só para o teste do mundo (mundo.teste.mjs troca q.holding para provar o desconto do
  // ladrilho pela Influência); pendência do integrador
  sim.registrarConsulta('holding', consultaHolding, { substituto: 's3a' });
  sim.registrarSistema(1, 0, tique, 1, { nome: 'economia', ordem: ORDEM.economia });
  sim.registrarSistema(MES, MES - 1, fecharMes, 1, { nome: 'economia.mes', ordem: ORDEM.economia + 1 });
  sim.registrarParteBarra('s3a.economia', parteBarra);
  sim.registrarValidador('economia', () => {
    const e = [];
    const E = sim.json.economia;
    const soma = E.emprestimo.contratos.reduce((a, c) => a + c.saldo, 0);
    if (Math.abs(soma - E.emprestimo.principal) > 1e-6) e.push(`principal ${E.emprestimo.principal} diferente da soma dos contratos ${soma}`);
    for (const c of E.emprestimo.contratos) if (!(c.saldo >= 0) || !(c.juros >= 0)) e.push(`contrato ${c.id} negativo`);
    if (!(sim.json.holding.caixa >= 0)) e.push(`caixa negativo (${sim.json.holding.caixa})`);
    return e;
  });
}
