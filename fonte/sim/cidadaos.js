// Cidadãos estatísticos (seção 7 do desenho da simulação; dona: S2a): moradores por prédio com 4 níveis de estudo,
// estudantes, mercado de trabalho da cidade inteira (do superior para o básico; quem sobra ocupa vaga de nível menor),
// migração (o prédio novo enche em 1 a 3 rodadas, com a escolaridade que segue as vagas abertas) e os agregados de
// população e empregos (S.agregados, 2.10). Uma vez por rodada (20 tiques), antes da economia.
import { HORA, RODADA } from '../comum/relogio.js';
import { PREDIO, TIPO_PREDIO } from '../contratos/flags.js';
import { ORDEM } from '../contratos/interno.js';
import { ZONAS, ZONAS_ORDEM } from '../data/zonas.js';
import { prepararCidade, vagasDe, funciona, familiaDe, nivelZona } from './predios.js';

/** Fração dos moradores que trabalha (seção 7.3). */
export const FRACAO_TRABALHA = 0.6;
/** Escolaridade de quem chega quando não há vaga aberta (básico, fundamental, médio, superior). (calibrar) */
export const ESTUDO_BASE = Object.freeze([0.35, 0.4, 0.2, 0.05]);
/** Fração da capacidade que chega por rodada num prédio que tem vaga (enche em 1 a 3 rodadas). (calibrar) */
export const CHEGADA_RODADA = 0.4;
/** Fração de cada nível que passa ao seguinte por rodada com cobertura de escola completa (seção 7.2). (calibrar) */
export const EDUCACAO_RODADA = 0.005;

const VG = [0, 0, 0, 0];

/** Capacidade de moradia do prédio i no nível atual: { moradores, lares } (0 fora da moradia). */
export function moradiaDe(sim, i, out = { moradores: 0, lares: 0 }) {
  const P = sim.tabelas.predios;
  const nv = nivelZona(P, i);
  out.moradores = nv ? nv.moradores : 0;
  out.lares = nv ? nv.lares : 0;
  return out;
}

/** Só a capacidade de moradores (o caminho rápido das varreduras). */
export const capacidadeMoradores = (P, i) => nivelZona(P, i)?.moradores ?? 0;

const CAP = { moradores: 0, lares: 0 };

/**
 * Mercado de trabalho e agregados de população (uma vez por rodada). Escreve S.agregados (populacao, lares, popHora,
 * empregos) e, na seção 'cidade', a ocupação e o desemprego por nível e a escolaridade de quem chega.
 */
export function sistemaCidadaos(sim) {
  const P = sim.tabelas.predios;
  const j = sim.json.cidade;
  const ag = sim.agregados;
  const W = [0, 0, 0, 0];
  const V = [0, 0, 0, 0];
  let pop = 0;
  let lares = 0;
  for (let i = 0; i < P.n; i++) {
    if (!funciona(P, i)) continue;
    if (P.tipo[i] === TIPO_PREDIO.ZONA && familiaDe(sim, i) === 'res') {
      const m = P.moradores[i];
      if (!m) continue;
      pop += m;
      const cap = moradiaDe(sim, i, CAP);
      lares += cap.moradores ? Math.round((cap.lares * m) / cap.moradores) : 0;
      for (let n = 0; n < 4; n++) W[n] += m * FRACAO_TRABALHA * estudoDe(P, i, n);
    } else if (P.tipo[i] !== TIPO_PREDIO.HOLDING) {
      // serviço na obra de nascimento não emprega (funciona já tirou); prédio de zona: vagas do nível
      vagasDe(sim, i, VG);
      for (let n = 0; n < 4; n++) V[n] += VG[n];
    }
  }
  // a Holding contrata primeiro (é a concessionária, S3a): as ocupadas dela saem dos trabalhadores da cidade
  const h = typeof sim.holding.ocupados === 'function' ? sim.holding.ocupados() : null;
  const ocupHolding = [0, 0, 0, 0];
  if (Array.isArray(h)) {
    for (let n = 0; n < 4; n++) {
      ocupHolding[n] = Math.min(W[n], Math.max(0, +h[n] || 0));
      W[n] -= ocupHolding[n];
    }
  }
  // do superior para o básico: quem sobra no nível n desce para as vagas do nível n - 1
  const ocup = [0, 0, 0, 0];
  const naoContratado = [1, 1, 1, 1];
  let sobra = 0;
  for (let n = 3; n >= 0; n--) {
    const disp = W[n] + sobra;
    const ocupadas = Math.min(V[n], disp);
    ocup[n] = ocupadas;
    sobra = disp - ocupadas;
    naoContratado[n] = disp > 0 ? sobra / disp : 0;
  }
  // um trabalhador do nível n fica sem emprego se não entrou no n nem em nenhum abaixo
  const desemp = [0, 0, 0, 0];
  for (let n = 0; n < 4; n++) {
    let u = 1;
    for (let m = n; m >= 0; m--) u *= naoContratado[m];
    desemp[n] = W[n] > 0 ? (u * W[n]) / (W[n] + ocupHolding[n]) : 0;
  }
  const totalW = W[0] + W[1] + W[2] + W[3] + ocupHolding[0] + ocupHolding[1] + ocupHolding[2] + ocupHolding[3];
  for (let n = 0; n < 4; n++) {
    j.ocupacao[n] = V[n] > 0 ? ocup[n] / V[n] : 1;
    j.desemprego[n] = desemp[n];
    ag.empregos.vagas[n] = Math.round(V[n] + ocupHolding[n]);
    ag.empregos.ocupadas[n] = Math.round(ocup[n] + ocupHolding[n]);
    ag.empregos.desemprego[n] = desemp[n];
  }
  ag.empregos.taxa = totalW > 0 ? sobra / totalW : 0;
  ag.empregos.trabalhadores = Math.round(totalW);
  // quem chega segue as vagas abertas (vaga de escritório atrai superior)
  const livres = V.map((v, n) => Math.max(0, v - ocup[n]));
  const somaL = livres[0] + livres[1] + livres[2] + livres[3];
  for (let n = 0; n < 4; n++) j.estudoChegada[n] = somaL > 0 ? 0.5 * ESTUDO_BASE[n] + (0.5 * livres[n]) / somaL : ESTUDO_BASE[n];
  // população e ritmo por hora de jogo (suavizado)
  const delta = j.popAnterior < 0 ? 0 : pop - j.popAnterior;
  ag.popHora = Math.round(0.8 * (ag.popHora || 0) + 0.2 * (delta * (HORA / RODADA)));
  j.popAnterior = pop;
  ag.populacao = pop;
  ag.lares = lares;
}

/**
 * Fração dos moradores do prédio i no nível de estudo n. Prédio que nasceu fora da S2a (Vila, cidade sintética) e
 * ainda não passou pela rodada vale a escolaridade de partida.
 */
export function estudoDe(P, i, n) {
  const o = 4 * i;
  const s = P.estudo[o] + P.estudo[o + 1] + P.estudo[o + 2] + P.estudo[o + 3];
  return s > 0.5 ? P.estudo[o + n] : ESTUDO_BASE[n];
}

const OC = { vagas: 0, ocupadas: 0, frac: 1 };

/**
 * Ocupação das vagas de um local de trabalho pelo mercado da cidade (a mesma fração por nível): { vagas, ocupadas,
 * frac }. Sem `out`, devolve um objeto reaproveitado (leia na hora).
 */
export function ocupacaoDe(sim, i, out = OC) {
  vagasDe(sim, i, VG);
  const oc = sim.json.cidade.ocupacao;
  const total = VG[0] + VG[1] + VG[2] + VG[3];
  out.vagas = total;
  if (!total) {
    out.ocupadas = 0;
    out.frac = 1;
    return out;
  }
  let ocupadas = 0;
  for (let n = 0; n < 4; n++) ocupadas += VG[n] * oc[n];
  out.ocupadas = ocupadas;
  out.frac = ocupadas / total;
  return out;
}

/** Desemprego do prédio residencial i: soma da fração de cada nível vezes o desemprego do nível (0 a 1). */
export function desempregoDe(sim, i) {
  const P = sim.tabelas.predios;
  const d = sim.json.cidade.desemprego;
  let s = 0;
  for (let n = 0; n < 4; n++) s += estudoDe(P, i, n) * d[n];
  return s;
}

/**
 * Migração de uma rodada no prédio residencial i (já pronto): chega até CHEGADA_RODADA da capacidade, com a
 * escolaridade de quem chega; acima da capacidade (nível que caiu), sai o excedente. Devolve quantos chegaram.
 */
export function encher(sim, i, demandaR = 50) {
  const P = sim.tabelas.predios;
  const cap = capacidadeMoradores(P, i);
  const m = P.moradores[i];
  if (m > cap) {
    P.moradores[i] = cap;
    return cap - m;
  }
  if (m >= cap) return 0;
  // sem demanda residencial a chegada fica lenta, mas não para (quem pintou espera ver gente)
  const f = CHEGADA_RODADA * (0.35 + 0.65 * Math.min(1, Math.max(0, demandaR) / 50));
  const chegam = Math.min(cap - m, Math.max(1, Math.ceil(cap * f)));
  const e = sim.json.cidade.estudoChegada;
  const novo = m + chegam;
  for (let n = 0; n < 4; n++) P.estudo[4 * i + n] = (estudoDe(P, i, n) * m + e[n] * chegam) / novo;
  P.moradores[i] = novo;
  return chegam;
}

/**
 * Educação de uma rodada no prédio i: com cobertura c (0 a 1, já vezes a eficiência) da escola que leva do nível
 * `de` ao `para`, a fração EDUCACAO_RODADA x c dos moradores do nível `de` sobe.
 */
export function educar(sim, i, de, para, c) {
  if (!(c > 0)) return;
  const P = sim.tabelas.predios;
  if (P.estudo[4 * i] + P.estudo[4 * i + 1] + P.estudo[4 * i + 2] + P.estudo[4 * i + 3] < 0.5) {
    for (let n = 0; n < 4; n++) P.estudo[4 * i + n] = ESTUDO_BASE[n];
  }
  const q = Math.min(P.estudo[4 * i + de], EDUCACAO_RODADA * c);
  P.estudo[4 * i + de] -= q;
  P.estudo[4 * i + para] += q;
}

// ------------------------------------------------------------------------------------------------ q.cidade

const partesCidade = [];
/** Outro domínio da S2a completa q.cidade: fn(sim, saida). */
export function registrarParteCidade(fn) {
  if (!partesCidade.includes(fn)) partesCidade.push(fn);
}

/** q.cidade() → visão geral da cidade (população, empregos, escolaridade, prédios; demanda, redes e serviços). */
export function consultaCidade(sim) {
  const P = sim.tabelas.predios;
  const ag = sim.agregados;
  const porZona = {};
  const porNivel = [0, 0, 0, 0, 0];
  const estudo = [0, 0, 0, 0];
  let total = 0;
  let obras = 0;
  let abandonados = 0;
  let servicos = 0;
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i]) continue;
    if (P.tipo[i] !== TIPO_PREDIO.ZONA) {
      if (P.tipo[i] === TIPO_PREDIO.SERVICO) servicos++;
      continue;
    }
    total++;
    const z = ZONAS_ORDEM[P.zona[i]];
    porZona[z] = (porZona[z] ?? 0) + 1;
    porNivel[Math.max(1, P.nivel[i]) - 1]++;
    if (P.flags[i] & PREDIO.OBRA) obras++;
    if (P.flags[i] & PREDIO.ABANDONADO) abandonados++;
    const m = P.moradores[i];
    if (m) for (let n = 0; n < 4; n++) estudo[n] += m * estudoDe(P, i, n);
  }
  const somaE = estudo[0] + estudo[1] + estudo[2] + estudo[3];
  const out = {
    populacao: ag.populacao, lares: ag.lares, popHora: ag.popHora, bemEstar: ag.bemEstarMedio, bemEstarTarifa: ag.bemEstarTarifa,
    tarifa: ag.tarifa, desemprego: ag.empregos.taxa ?? 0, trabalhadores: ag.empregos.trabalhadores ?? 0,
    empregos: { vagas: [...ag.empregos.vagas], ocupadas: [...ag.empregos.ocupadas], desemprego: [...ag.empregos.desemprego] },
    escolaridade: estudo.map((v) => (somaE > 0 ? v / somaE : 0)),
    predios: { total, porZona, porNivel, emObra: obras, abandonados, servicos },
    redes: JSON.parse(JSON.stringify(ag.redes)),
    demanda: { ...ag.demanda, fatores: undefined },
    zonas: Object.keys(ZONAS),
  };
  for (const fn of partesCidade) fn(sim, out);
  return out;
}

// ------------------------------------------------------------------------------------------------ registro

export function registrar(sim) {
  if (!sim.tabelas.predios || !sim.grafo) return;
  prepararCidade(sim);
  // os agregados de verdade (cidadãos, bem-estar, demanda e redes) tiram a soma substituta da F0
  sim.implementar('agregados', {});
  sim.registrarSistema(RODADA, 5, sistemaCidadaos, 1, { nome: 'cidadaos', ordem: ORDEM.cidade });
  sim.registrarConsulta('cidade', consultaCidade);
}
