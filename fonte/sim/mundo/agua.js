// Água: máscara (mar, rio, lagoa) na grade de 8 m, rios e lagoas do espelho e o nível da água num ponto (dona: S1a).
//
// A máscara sai com a grade base (terreno.js): 1 mar (abaixo de 0; todo ele ligado ao mar aberto, o teste do mundo
// confere), 2 rio (dentro do leito), 3 lagoa (dentro do contorno). espelho.terreno.rios: [{ id, pontos: Float64Array
// (x, z, nível, largura) }] no sentido da correnteza, da entrada no mapa (a nascente fica além da borda norte) à foz;
// espelho.terreno.lagoas: [{ id, nivel, contorno: Float64Array (x, z) }], a de Santa Cida primeiro e depois as lagoas
// marginais da várzea (meandros abandonados do rio). O fundo fica abaixo do nível da água em toda amostra de água (o
// render tira a profundidade por nível menos altura) e as margens do rio ficam acima dele.
import { AGUA } from '../../contratos/flags.js';
import { pontoNoPoligono } from '../../comum/vetor.js';
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
  if (a === AGUA.LAGOA) {
    // a lagoa cujo contorno tem o ponto (a amostra de água pode cair um pouco fora dele: então a mais perto no campo)
    for (const l of T.lagoas) if (pontoNoPoligono(x, z, l.contorno)) return l.nivel;
    const C = tb.base.campos;
    const i = Math.round((x - C.G.ox) / C.G.pc);
    const j = Math.round((z - C.G.oz) / C.G.pc);
    return C.lagoa.lista[C.lagoa.qual[Math.min(C.G.nc - 1, Math.max(0, j)) * C.G.nc + Math.min(C.G.nc - 1, Math.max(0, i))]].nivel;
  }
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
  // cópias: a base é de todas as simulações do mesmo mapa
  T.rios = tb.base.rios.map((r) => ({ id: r.id, pontos: r.pontos.slice() }));
  T.lagoas = tb.base.lagoas.map((l) => ({ id: l.id, nivel: l.nivel, contorno: l.contorno.slice() }));
}
