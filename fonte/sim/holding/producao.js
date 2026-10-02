// Produção da Holding (dona: S3a): prédios da Holding, linhas com lote de 1 a 10 começando em 10 com Auto (D57),
// estoque global com a capacidade dos armazéns, produtividade pela ocupação das vagas e pela distância ao armazém
// (D47), salários, subida de nível e compra de tempo nas linhas (D13).
//
// Uma linha roda uma ordem de lote n: na partida consome os insumos de n unidades (a extração tira o recurso da planta,
// e rende menos quando ele acaba), trabalha tempoDoLote(t, n) na produtividade 1 (cada tique soma a produtividade do
// prédio) e entrega n unidades no estoque; com Auto repete. Abaixo de 50% de ocupação a linha para ('pessoal'); sem o
// salário inteiro do tique, também ('creditos'); armazém cheio segura a entrega ('armazem').
//
// Os prédios da Holding são linhas da tabela de prédios com tipo HOLDING (predios.modelo = índice em HOLDING_ORDEM).
// Quem constrói é o comando `construir` da S2a (um só para serviços e Holding, por sim.colocaveis). A lista da S3a
// acompanha a tabela a cada rodada, então serve qualquer `construir` que aloque a linha da tabela. Para testar sem a
// S2a há um substituto em holding/substituto.js (fora do índice e do pacote do jogo).
import { ITENS, ITENS_ORDEM, PREDIOS_HOLDING, HOLDING_ORDEM, HOLDING_M1A, LINHAS_POR_NIVEL, PRODUCAO, vagasDoNivel, precoBase } from '../../data/holding.js';
import { ECONOMIA, COMPRA_TEMPO, tempoPelasRegras, lotePelasRegras } from '../../data/economia.js';
import { TIPO_PREDIO, PREDIO } from '../../contratos/flags.js';
import { ORDEM } from '../../contratos/interno.js';
import { idxDaRef, gerDaRef, refDe } from '../../contratos/espelho.js';
import { RODADA, HORA } from '../../comum/relogio.js';
import { cantosRetangulo } from '../../comum/vetor.js';
import { hipot } from '../../comum/util.js';
import { regrasDe, finito, totalItens, efeitosAtivos } from './base.js';
import { extrair } from '../mundo/recursos.js';

// ------------------------------------------------------------------------------------------------ estado

export function producaoVazia() {
  const zeros = Object.fromEntries(ITENS_ORDEM.map((k) => [k, 0]));
  return {
    predios: [], // { ref, tipo, nivel, criado, ocupacao, produtividade, distArmazem, linhas: [linha] }
    estoque: { ...zeros },
    reserva: { ...zeros },
    feitos: { ...zeros },
    consumidos: { ...zeros },
    cap: 0,
    ocupacao: 0,
    salariosHora: 0,
    vistos: 0, // prédios da Holding que já deram XP
  };
}

// n: a ordem (vale para o próximo lote); nLote: o n do lote em andamento (os insumos que ele consumiu na partida)
const novaLinha = (item) => ({
  item, n: PRODUCAO.loteInicial, auto: PRODUCAO.autoInicial, ativa: !!item, rodando: false, lote: 0, nLote: 0, trabalho: 0,
  meta: 0, ini: 0, parada: null,
});

/** true se k é um item do catálogo (sem cair nas chaves herdadas de Object, como 'toString'). */
export const ehItem = (k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(ITENS, k);

const J = (sim) => sim.json.producao;

/** idx vivo da ref de um prédio da Holding, ou -1. */
export function idxHolding(sim, ref) {
  const P = sim.tabelas.predios;
  if (!P || !Number.isInteger(ref) || ref < 0) return -1;
  const i = idxDaRef(ref);
  return i < P.n && P.viva[i] && P.ger[i] === gerDaRef(ref) && P.tipo[i] === TIPO_PREDIO.HOLDING ? i : -1;
}

/** Entrada da Holding de uma ref (ou null). */
export const entradaDe = (sim, ref) => J(sim).predios.find((e) => e.ref === ref) ?? null;

/** Estoque total (todas as unidades). */
export const estoqueTotal = (sim) => totalItens(J(sim).estoque);

/** Unidades de um item que podem sair para venda (acima da reserva). */
export function disponivelVenda(sim, item) {
  const p = J(sim);
  return Math.max(0, (p.estoque[item] ?? 0) - (p.reserva[item] ?? 0));
}

/** Tira n unidades do estoque (sem conferir reserva). */
export function tirarEstoque(sim, item, n) {
  const p = J(sim);
  p.estoque[item] = Math.max(0, (p.estoque[item] ?? 0) - n);
  sim.mudancas.marcar('holding');
}

/** Põe n unidades no estoque (importação e entregas; pode passar da capacidade). */
export function porEstoque(sim, item, n) {
  const p = J(sim);
  p.estoque[item] = (p.estoque[item] ?? 0) + n;
  sim.mudancas.marcar('holding');
}

// ------------------------------------------------------------------------------------------------ lista x tabela

/** Acompanha a tabela de prédios: entra o prédio da Holding novo (com a linha 0 em 10 e Auto), sai o demolido. */
export function sincronizar(sim) {
  const P = sim.tabelas.predios;
  const p = J(sim);
  if (!P) return;
  const vivos = new Set();
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.HOLDING) continue;
    const ref = refDe(i, P.ger[i]);
    vivos.add(ref);
    let e = p.predios.find((x) => x.ref === ref);
    if (!e) {
      const tipo = HOLDING_ORDEM[P.modelo[i]] ?? HOLDING_ORDEM[0];
      const def = PREDIOS_HOLDING[tipo];
      const nivel = Math.max(1, Math.min(3, P.nivel[i] || 1));
      e = { ref, tipo, nivel, criado: false, ocupacao: 0, produtividade: 0, distArmazem: 0, linhas: [] };
      for (let k = 0; k < LINHAS_POR_NIVEL[nivel - 1]; k++) e.linhas.push(novaLinha(k === 0 ? def.produz[0] ?? null : null));
      p.predios.push(e);
      p.vistos++;
      sim.progresso.xp(def.xp ?? 30, 'holding');
      sim.mudancas.marcar('holding');
    }
    // obra do substituto: termina no fim
    if (e.criado && P.flags[i] & PREDIO.OBRA && P.obraFim[i] && sim.tique >= P.obraFim[i]) {
      P.flags[i] &= ~PREDIO.OBRA;
      P.marcar(i);
    }
  }
  const antes = p.predios.length;
  p.predios = p.predios.filter((e) => vivos.has(e.ref));
  if (p.predios.length !== antes) sim.mudancas.marcar('holding');
}

// ------------------------------------------------------------------------------------------------ produtividade

/** Bônus de produtividade das etapas (sim.holding.efeito, X1b) e das decisões (historia). */
function bonus(sim) {
  let b = 0;
  const ef = sim.json.holding?.efeitos ?? {};
  for (const k of Object.keys(ef).sort()) b += finito(ef[k]?.produtividade);
  for (const e of efeitosAtivos(sim, 'produtividade')) b += finito(e.v);
  return b;
}

/** Armazéns prontos (Escritórios de Obra fora de obra): posições e capacidade. */
function armazens(sim) {
  const P = sim.tabelas.predios;
  const out = [];
  for (const e of J(sim).predios) {
    const def = PREDIOS_HOLDING[e.tipo];
    if (!def.armazem) continue;
    const i = idxHolding(sim, e.ref);
    if (i < 0 || P.flags[i] & PREDIO.OBRA) continue;
    out.push({ x: P.x[i], z: P.z[i], cap: def.armazem[e.nivel - 1] ?? def.armazem[0], caminhoes: def.caminhoes?.[e.nivel - 1] ?? 0, ref: e.ref });
  }
  return out;
}

/** Vagas de todos os prédios da Holding, por nível de estudo. */
function vagasTotais(sim) {
  const v = [0, 0, 0, 0];
  for (const e of J(sim).predios) vagasDoNivel(e.tipo, e.nivel).forEach((x, k) => (v[k] += x));
  return v;
}

/**
 * Ocupação, produtividade, distância ao armazém, capacidade e salários: uma vez por rodada. A Holding contrata primeiro
 * (é a concessionária): ocupação = trabalhadores ativos / vagas da Holding, até 1. A S2a desconta as ocupadas da
 * Holding (sim.holding.ocupados()) do mercado de trabalho da cidade.
 */
export function recalcular(sim) {
  const p = J(sim);
  const P = sim.tabelas.predios;
  const ag = sim.agregados;
  const vagas = vagasTotais(sim);
  const V = vagas.reduce((a, b) => a + b, 0);
  const ativos = finito(ag.populacao) * ECONOMIA.fracaoAtiva;
  const frac = V > 0 ? Math.min(1, ativos / V) : 0;
  const b = bonus(sim);
  const arm = armazens(sim);
  p.cap = arm.reduce((a, x) => a + x.cap, 0);
  p.ocupacao = frac;
  let sal = 0;
  for (const e of p.predios) {
    const def = PREDIOS_HOLDING[e.tipo];
    const i = idxHolding(sim, e.ref);
    let dist = Infinity;
    if (i >= 0) for (const a of arm) dist = Math.min(dist, hipot(a.x - P.x[i], a.z - P.z[i]));
    e.distArmazem = Number.isFinite(dist) ? Math.round(dist) : -1;
    let penal = 0;
    const da = def.distanciaArmazem;
    if (da && Number.isFinite(dist)) penal = Math.min(da.max, Math.max(0, ((dist - da.livre) / 100) * da.porCem));
    e.ocupacao = frac;
    e.produtividade = frac < PRODUCAO.ocupacaoMinima ? 0 : Math.max(0, frac * (1 - penal) * (1 + b));
    const vg = vagasDoNivel(e.tipo, e.nivel);
    for (let k = 0; k < 4; k++) sal += Math.round(vg[k] * frac) * ECONOMIA.salarioHora[k];
  }
  p.salariosHora = sal;
}

/** Salários da Holding por hora de jogo (o último cálculo da rodada). */
export const salariosHora = (sim) => J(sim)?.salariosHora ?? 0;

/** Trabalhadores ocupados pela Holding, por nível de estudo (para o mercado de trabalho da S2a). */
export function ocupadosHolding(sim) {
  const p = J(sim);
  const v = vagasTotais(sim);
  return v.map((x) => Math.round(x * p.ocupacao));
}

/** Frota da Holding (D47): 6 no começo; com armazém, os caminhões dele por nível; mais os efeitos das etapas. */
export function frotaTotal(sim) {
  const arm = armazens(sim);
  let base = arm.length ? arm.reduce((a, x) => a + x.caminhoes, 0) : PRODUCAO.frotaInicial;
  const ef = sim.json.holding?.efeitos ?? {};
  for (const k of Object.keys(ef)) base += Math.max(0, Math.floor(finito(ef[k]?.caminhoes)));
  return base;
}

/** Posição do armazém mais perto de (x, z), ou null. */
export function armazemPerto(sim, x = 0, z = 0) {
  let melhor = null;
  for (const a of armazens(sim)) {
    const d = hipot(a.x - x, a.z - z);
    if (!melhor || d < melhor.d) melhor = { x: a.x, z: a.z, ref: a.ref, d };
  }
  return melhor;
}

// ------------------------------------------------------------------------------------------------ linhas

/** Polígono de extração: a planta com 32 m de folga em volta. */
function areaDeExtracao(sim, e) {
  const P = sim.tabelas.predios;
  const i = idxHolding(sim, e.ref);
  if (i < 0) return null;
  return cantosRetangulo(P.x[i], P.z[i], P.rot[i], P.w[i] + 64, P.d[i] + 64);
}

/** Tenta começar o lote da linha. Devolve true se começou. */
function iniciar(sim, e, l) {
  const p = J(sim);
  const item = ITENS[l.item];
  if (!item) {
    l.ativa = false;
    return false;
  }
  if (e.produtividade <= 0) {
    l.parada = 'pessoal';
    return false;
  }
  if (!sim.json.economia?.salariosOk) {
    l.parada = 'creditos';
    return false;
  }
  for (const [k, q] of Object.entries(item.req)) {
    if ((p.estoque[k] ?? 0) < q * l.n) {
      l.parada = 'estoque';
      return false;
    }
  }
  let lote = l.n;
  if (item.recurso && sim.espelho.recursos?.[item.recurso.tipo]) {
    const area = areaDeExtracao(sim, e);
    const tirou = area ? extrair(sim, item.recurso.tipo, area, l.n * item.recurso.porUnidade) : 0;
    lote = Math.floor(tirou / item.recurso.porUnidade);
    if (lote <= 0) {
      l.parada = 'recurso';
      return false;
    }
  }
  for (const [k, q] of Object.entries(item.req)) {
    p.estoque[k] -= q * l.n;
    p.consumidos[k] = (p.consumidos[k] ?? 0) + q * l.n;
  }
  l.lote = lote;
  l.nLote = l.n;
  l.meta = tempoPelasRegras(regrasDe(sim), item.t, l.n);
  l.trabalho = 0;
  l.rodando = true;
  l.ini = sim.tique;
  l.parada = null;
  sim.mudancas.marcar('holding');
  return true;
}

/** Entrega o lote pronto, se cabe no armazém. */
function entregarLote(sim, l) {
  const p = J(sim);
  if (estoqueTotal(sim) + l.lote > p.cap) {
    l.parada = 'armazem';
    return;
  }
  p.estoque[l.item] = (p.estoque[l.item] ?? 0) + l.lote;
  p.feitos[l.item] = (p.feitos[l.item] ?? 0) + l.lote;
  l.rodando = false;
  l.trabalho = 0;
  l.meta = 0;
  l.lote = 0;
  l.nLote = 0;
  l.parada = null;
  if (!l.auto) l.ativa = false;
  sim.mudancas.marcar('holding');
}

/** O tique da produção: cada linha ativa anda pela produtividade do prédio. */
function sistemaLinhas(sim, k, fatias, T) {
  if (T % RODADA === 0) {
    sincronizar(sim);
    recalcular(sim);
  }
  const P = sim.tabelas.predios;
  const salOk = !!sim.json.economia?.salariosOk;
  for (const e of J(sim).predios) {
    const i = idxHolding(sim, e.ref);
    const obra = i < 0 || !!(P.flags[i] & PREDIO.OBRA);
    for (const l of e.linhas) {
      if (!l.ativa || !l.item) continue;
      if (obra) {
        l.parada = 'obra';
        continue;
      }
      if (!l.rodando && !iniciar(sim, e, l)) continue;
      if (l.trabalho < l.meta) {
        if (!salOk) {
          l.parada = 'creditos';
          continue;
        }
        if (e.produtividade <= 0) {
          l.parada = 'pessoal';
          continue;
        }
        l.trabalho += e.produtividade;
        l.parada = null;
      }
      if (l.trabalho >= l.meta) entregarLote(sim, l);
    }
  }
}

// ------------------------------------------------------------------------------------------------ comandos

function linhaDe(sim, predio, linha) {
  const e = entradaDe(sim, predio);
  if (!e || idxHolding(sim, predio) < 0) return { codigo: 'inexistente' };
  if (!Number.isInteger(linha) || linha < 0 || linha >= e.linhas.length) return { codigo: 'trancado' };
  return { e, l: e.linhas[linha] };
}

/** Insumos de n unidades disponíveis? */
function temInsumos(sim, item, n) {
  const p = J(sim);
  return Object.entries(ITENS[item].req).every(([k, q]) => (p.estoque[k] ?? 0) >= q * n);
}

function ordem(sim, { predio, linha, item, n, auto } = {}) {
  const { e, l, codigo } = linhaDe(sim, predio, linha);
  if (codigo) return codigo;
  if (!lotePelasRegras(regrasDe(sim), n)) return 'lote';
  const def = PREDIOS_HOLDING[e.tipo];
  if (typeof item !== 'string' || !def.produz.includes(item) || !sim.progresso.liberado(`item.${item}`)) return 'trancado';
  const comAuto = auto === true;
  if (l.rodando && l.item !== item) return 'ocupado';
  if (!l.rodando && !comAuto) {
    if (!temInsumos(sim, item, n)) return 'estoque';
    if (e.produtividade <= 0 && sim.agregados.populacao > 0) return 'pessoal';
  }
  l.item = item;
  l.n = n;
  l.auto = comAuto;
  l.ativa = true;
  if (!l.rodando) l.parada = null;
  sim.mudancas.marcar('holding');
  return { ok: true };
}

function parar(sim, { predio, linha } = {}) {
  const { l, codigo } = linhaDe(sim, predio, linha);
  if (codigo) return codigo === 'trancado' ? 'nada' : codigo;
  if (!l.ativa && !l.rodando) return 'nada';
  // lote em andamento: os insumos que ele consumiu voltam ao estoque (a extração não volta para a rocha). Vale o n da
  // partida, não o da ordem: trocar o lote com a linha rodando muda só o próximo
  if (l.rodando) {
    const p = J(sim);
    const n = l.nLote ?? l.n;
    for (const [k, q] of Object.entries(ITENS[l.item]?.req ?? {})) {
      p.estoque[k] = (p.estoque[k] ?? 0) + q * n;
      p.consumidos[k] = Math.max(0, (p.consumidos[k] ?? 0) - q * n);
    }
  }
  l.ativa = false;
  l.rodando = false;
  l.trabalho = 0;
  l.meta = 0;
  l.lote = 0;
  l.nLote = 0;
  l.parada = null;
  sim.mudancas.marcar('holding');
  return { ok: true };
}

function subirNivel(sim, { ref } = {}) {
  const e = entradaDe(sim, ref);
  const i = idxHolding(sim, ref);
  if (!e || i < 0) return 'inexistente';
  const def = PREDIOS_HOLDING[e.tipo];
  const prox = def.niveis[e.nivel];
  if (e.nivel >= 3 || !prox) return 'maximo';
  if (sim.progresso.marco().n < prox.marco) return 'marco';
  const p = J(sim);
  for (const [k, q] of Object.entries(prox.materiais)) if ((p.estoque[k] ?? 0) < q) return 'estoque';
  if (!sim.holding.pagar(prox.custo, 'holding.nivel')) return 'creditos';
  for (const [k, q] of Object.entries(prox.materiais)) {
    p.estoque[k] -= q;
    p.consumidos[k] = (p.consumidos[k] ?? 0) + q;
  }
  e.nivel++;
  while (e.linhas.length < LINHAS_POR_NIVEL[e.nivel - 1]) e.linhas.push(novaLinha(null));
  const P = sim.tabelas.predios;
  P.nivel[i] = e.nivel;
  P.empregos[i] = vagasDoNivel(e.tipo, e.nivel).reduce((a, b) => a + b, 0);
  P.marcar(i);
  recalcular(sim);
  sim.mudancas.marcar('holding');
  sim.emitir('predioNivel', { ref, nivel: e.nivel });
  return { ok: true, dados: { nivel: e.nivel } };
}

function acelerar(sim, { alvo, minutos } = {}) {
  const preco = COMPRA_TEMPO[minutos];
  if (!Number.isInteger(minutos) || !preco) return 'valor';
  const { l, codigo } = linhaDe(sim, alvo?.predio, alvo?.linha);
  if (codigo) return codigo === 'trancado' ? 'nada' : codigo;
  if (!l.rodando || l.trabalho >= l.meta) return 'nada';
  if (!sim.holding.pagar(preco, 'tempo')) return 'creditos';
  l.trabalho = Math.min(l.meta, l.trabalho + minutos * 60);
  sim.mudancas.marcar('holding');
  return { ok: true, dados: { minutos } };
}

function reserva(sim, { item, n } = {}) {
  if (!ehItem(item) || !Number.isInteger(n) || n < 0 || n > 1e6) return 'valor';
  J(sim).reserva[item] = n;
  sim.mudancas.marcar('holding');
  return { ok: true };
}

// ------------------------------------------------------------------------------------------------ consultas

/** Sugestão de lote menor (D57): só quando ajuda (insumo curto, ou a etapa esperando poucas unidades). */
function sugestaoLote(sim, e, l) {
  if (!l.item || l.rodando) return null;
  if (l.parada === 'estoque') {
    for (let k = l.n - 1; k >= 1; k--) if (temInsumos(sim, l.item, k)) return k;
    return null;
  }
  const falta = faltaNaEtapa(sim, l.item);
  if (falta > 0 && falta < l.n && (J(sim).estoque[l.item] ?? 0) === 0) return falta;
  return null;
}

/** Unidades de um item que a etapa da Arcologia em obra ainda pede (q.arcologia da X1b; 0 sem ela). */
function faltaNaEtapa(sim, item) {
  if (!sim.q.arcologia) return 0;
  let falta = 0;
  try {
    const a = sim.q.arcologia();
    for (const parte of a?.partes ?? []) {
      for (const et of parte.etapas ?? []) {
        if (et.estado !== 2) continue;
        for (const m of et.materiais ?? []) if (m.item === item) falta += Math.max(0, finito(m.pede) - finito(m.entregue));
      }
    }
  } catch {
    return 0;
  }
  return falta;
}

/** Linha para as telas: progresso 0..1, fim estimado em tiques e a parada. */
function linhaVista(sim, e, l) {
  const prod = e.produtividade;
  const resta = l.rodando ? Math.max(0, l.meta - l.trabalho) : 0;
  return {
    item: l.item,
    n: l.n,
    auto: l.auto,
    ativa: l.ativa,
    rodando: l.rodando,
    progresso: l.rodando && l.meta > 0 ? Math.min(1, l.trabalho / l.meta) : 0,
    fimTique: l.rodando && prod > 0 ? sim.tique + Math.ceil(resta / prod) : null,
    parada: l.ativa ? l.parada : null,
    sugestaoLote: l.ativa ? sugestaoLote(sim, e, l) : null,
  };
}

/** Parte holding de q.predio(ref): { nivel, linhas, vagas, ocupadas, distArmazem, produtividade } ou null. */
export function folhaHolding(sim, ref) {
  const e = entradaDe(sim, ref);
  if (!e) return null;
  const vagas = vagasDoNivel(e.tipo, e.nivel);
  const def = PREDIOS_HOLDING[e.tipo];
  return {
    tipo: e.tipo,
    nivel: e.nivel,
    nivelMax: 3,
    proximoNivel: def.niveis[e.nivel] ? { custo: def.niveis[e.nivel].custo, materiais: { ...def.niveis[e.nivel].materiais }, marco: def.niveis[e.nivel].marco } : null,
    linhas: e.linhas.map((l) => linhaVista(sim, e, l)),
    produz: [...def.produz],
    vagas,
    ocupadas: vagas.map((v) => Math.round(v * e.ocupacao)),
    distArmazem: e.distArmazem,
    produtividade: e.produtividade,
  };
}

/** Produção e consumo teóricos por hora das linhas ativas (na produtividade atual). */
function taxas(sim) {
  const produz = {};
  const consome = {};
  for (const e of J(sim).predios) {
    if (e.produtividade <= 0) continue;
    for (const l of e.linhas) {
      if (!l.ativa || !l.item) continue;
      const item = ITENS[l.item];
      const ciclo = tempoPelasRegras(regrasDe(sim), item.t, l.n) / e.produtividade;
      const porHora = (l.n * HORA) / Math.max(1, ciclo);
      produz[l.item] = (produz[l.item] ?? 0) + porHora;
      for (const [k, q] of Object.entries(item.req)) consome[k] = (consome[k] ?? 0) + q * porHora;
    }
  }
  return { produz, consome };
}

/** Itens que o M1a não usa (só do M1b); aparecem nas telas só se houver estoque. */
const SO_M1B = Object.freeze(['madeira', 'calcario']);

/** Itens que aparecem nas telas. */
const itensVisiveis = (sim) => ITENS_ORDEM.filter((k) => !SO_M1B.includes(k) || (J(sim).estoque[k] ?? 0) > 0);

/** Valor da Holding para a valuation: prédios pelo custo e estoque a preço base. */
export function valorHolding(sim) {
  const p = J(sim);
  if (!p) return 0;
  let v = 0;
  for (const e of p.predios) v += PREDIOS_HOLDING[e.tipo]?.custo ?? 0;
  for (const k of ITENS_ORDEM) v += (p.estoque[k] ?? 0) * precoBase(k);
  return v;
}

/** Itens do q.producao (a demanda da cidade vem do mercado). */
export function itensProducao(sim, cidadeHora = {}) {
  const p = J(sim);
  const { produz, consome } = taxas(sim);
  return itensVisiveis(sim).map((item) => ({
    item,
    estoque: p.estoque[item] ?? 0,
    produzHora: produz[item] ?? 0,
    consomeHora: consome[item] ?? 0,
    cidadeHora: cidadeHora[item] ?? 0,
    reserva: p.reserva[item] ?? 0,
    precoBase: precoBase(item),
    liberado: sim.progresso.liberado(`item.${item}`),
  }));
}

/** Prédios do q.producao. */
export function prediosProducao(sim) {
  return J(sim).predios.map((e) => ({ ref: e.ref, tipo: e.tipo, nivel: e.nivel, produtividade: e.produtividade, linhas: e.linhas.map((l) => linhaVista(sim, e, l)) }));
}

// ------------------------------------------------------------------------------------------------ construir (substituto)

/** Definição de colocável de um prédio da Holding (sim.colocaveis; o `construir` da S2a lê). */
export function defColocavel(tipo) {
  const def = PREDIOS_HOLDING[tipo];
  return Object.freeze({
    tipo,
    categoria: 'empresas',
    tipoPredio: TIPO_PREDIO.HOLDING,
    modelo: HOLDING_ORDEM.indexOf(tipo),
    nome: def.nome,
    faz: def.faz,
    chave: `s3.holding.${tipo}`,
    custo: def.custo,
    manutencaoHora: 0,
    marco: def.marco,
    liberado: `holding.${tipo}`,
    planta: [...def.planta],
    recurso: def.recurso ?? null,
    margem: def.margem ?? undefined,
    holding: true,
    parte: def.parte,
    barra: 'empresas',
    vagas: (sim, i) => vagasDoNivel(tipo, sim.tabelas.predios.nivel[i] || 1),
    empregos: def.vagas.reduce((a, b) => a + b, 0),
    // sem `xp` aqui: o XP do prédio da Holding sai uma vez só, quando ele entra na lista (sincronizar)
    xpHolding: def.xp,
    obraTiques: def.obraTiques,
    aoConstruir: (sim) => sincronizar(sim),
    aoDemolir: (sim) => sincronizar(sim),
  });
}

// ------------------------------------------------------------------------------------------------ registro

export function registrar(sim) {
  sim.registrarJson('producao', producaoVazia());
  for (const tipo of HOLDING_M1A) sim.colocaveis.registrar(tipo, defColocavel(tipo));
  sim.registrarComando('linha.ordem', ordem);
  sim.registrarComando('linha.parar', parar);
  sim.registrarComando('predio.nivel', subirNivel);
  sim.registrarComando('acelerar', acelerar);
  sim.registrarComando('estoque.reserva', reserva);
  sim.registrarSistema(1, 0, sistemaLinhas, 1, { nome: 'holding.producao', ordem: ORDEM.holding });
  sim.registrarValidador('producao', () => {
    const e = [];
    for (const [k, v] of Object.entries(J(sim).estoque)) if (!(v >= 0) || !Number.isInteger(v)) e.push(`estoque de ${k}: ${v}`);
    return e;
  });
}
