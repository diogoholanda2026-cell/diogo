// q.barra(): os números da barra de cima (formato em contratos/consultas.js, EXEMPLO_BARRA). A F0 monta a base com os
// agregados, o caixa e o relógio; S2a e S3a completam os campos que são deles com sim.registrarParteBarra(nome, fn).
import { calendario, VELOCIDADES } from '../../comum/relogio.js';
import { faixaDaTarifa } from '../../data/economia.js';

/** Monta a barra. Pura: só lê. */
export function barra(sim) {
  const ag = sim.agregados;
  const t = sim.espelho.tempo;
  const c = calendario(sim.tique, t.frac ?? 0);
  const caixa = sim.holding.caixa();
  const { faixa, margem } = faixaDaTarifa(ag.bemEstarTarifa);
  const receitaHora = ag.populacao * ag.tarifa;
  const divida = 0;
  const b = {
    creditos: caixa,
    saldoHora: receitaHora - sim.custos.total(),
    populacao: ag.populacao,
    popHora: ag.popHora,
    bemEstar: ag.bemEstarMedio,
    bemEstarTarifa: ag.bemEstarTarifa,
    tarifa: ag.tarifa,
    faixa,
    margem,
    demanda: { R: ag.demanda.R, C: ag.demanda.C, I: ag.demanda.I, E: ag.demanda.E },
    data: { mes: c.mes, ano: c.ano, fracMes: c.fracMes, fase: t.fase },
    velocidade: sim.velocidade,
    mult: VELOCIDADES[sim.velocidade] ?? 0,
    marco: sim.progresso.marco(),
    divida,
    valuation: caixa - divida,
    caixaZerado: caixa <= 0,
    alertas: [],
    decisoesPendentes: 0,
    objetivos: [],
  };
  for (const parte of sim._partesBarra) parte.fn(b, sim);
  if (b.caixaZerado && !b.alertas.some((a) => a.id === 'caixa')) {
    b.alertas.unshift({ id: 'caixa', gravidade: 'grave', glifo: 'caixa', codigo: 'caixaZerado', params: {}, alvo: { tela: 'economia' } });
  }
  return b;
}
