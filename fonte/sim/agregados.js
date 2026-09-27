// Agregados da cidade (S.agregados, contrato interno 2.10). A forma vem de contratos/interno.js; aqui fica a soma
// substituta que roda até a S2a publicar a de verdade (sim.implementar('agregados', {}) a desliga).
import { criarAgregados } from '../contratos/interno.js';
import { TIPO_PREDIO, PREDIO } from '../contratos/flags.js';
import { tarifaDoBemEstar } from '../data/economia.js';

export { criarAgregados };

/** Bem-estar que o substituto assume enquanto não há a regra da S2a (dá a tarifa de 8). */
export const BEM_ESTAR_SUBSTITUTO = 50;

/**
 * Soma moradores, lares e empregos da tabela de prédios (vivos, fora de obra e não abandonados) no objeto de agregados.
 * @returns {object} os agregados
 */
export function somarPredios(sim, ag = sim.agregados) {
  const p = sim.tabelas.predios;
  let pop = 0;
  const vagas = [0, 0, 0, 0];
  if (p && p.moradores && p.flags) {
    const fora = PREDIO.OBRA | PREDIO.ABANDONADO;
    for (let i = 0; i < p.n; i++) {
      if (!p.viva[i] || p.flags[i] & fora) continue;
      pop += p.moradores[i];
      if (p.tipo[i] === TIPO_PREDIO.ZONA) vagas[0] += p.empregos[i];
    }
  }
  ag.popHora = 0;
  ag.populacao = pop;
  ag.lares = Math.round(pop / 3);
  ag.bemEstarMedio = pop > 0 ? BEM_ESTAR_SUBSTITUTO : 0;
  ag.bemEstarTarifa = Math.round(ag.bemEstarMedio);
  ag.tarifa = tarifaDoBemEstar(ag.bemEstarTarifa);
  ag.empregos.vagas = vagas;
  return ag;
}
