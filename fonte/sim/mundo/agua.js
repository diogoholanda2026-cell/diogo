// Água: máscara (mar, rio, lagoa) na grade de 8 m, rios e lagoas do espelho e o nível da água num ponto (dona: S1a).
//
// A máscara sai com a grade base (terreno.js): 1 mar (abaixo de 0 ligado ao mar aberto), 2 rio (dentro do leito), 3
// lagoa (dentro do contorno). espelho.terreno.rios: [{ id, pontos: Float64Array (x, z, nível, largura) }] da nascente à
// foz (o sentido da correnteza); espelho.terreno.lagoas: [{ id, nivel, contorno: Float64Array (x, z) }]. O fundo fica
// abaixo do nível da água em toda amostra de água (o render tira a profundidade por nível menos altura).
import { AGUA } from '../../contratos/flags.js';
import { terrenoBase, rioEm, aguaEm, ehAgua } from './terreno.js';

export { aguaEm, ehAgua };

/**
 * Nível da água em (x, z): mar 0, lagoa o nível dela, rio o nível no ponto do eixo mais perto; em terra, null.
 * @param {object} sim
 */
export function nivelAguaEm(sim, x, z) {
  const T = sim.espelho.terreno;
  const tb = terrenoBase(sim);
  if (!T || !tb) return null;
  const a = aguaEm(T, x, z);
  if (a === AGUA.MAR) return tb.mapa.nivelMar;
  if (a === AGUA.LAGOA) return tb.mapa.lagoa.nivel;
  if (a === AGUA.RIO) return rioEm(tb.base, x, z).nivel;
  return null;
}

/** Contagem de amostras por tipo de água (testes e mapa.mjs). */
export function contarAgua(T) {
  const c = [0, 0, 0, 0];
  for (let k = 0; k < T.agua.length; k++) c[T.agua[k]]++;
  return { terra: c[0], mar: c[1], rio: c[2], lagoa: c[3] };
}

export function registrar(sim) {
  const tb = terrenoBase(sim);
  const T = sim.espelho.terreno;
  if (!tb || !T) return;
  T.rios = tb.base.rios;
  T.lagoas = tb.base.lagoas;
}
