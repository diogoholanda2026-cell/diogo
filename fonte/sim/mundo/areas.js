// Áreas nomeadas (Vila, orla, gleba, várzea, morros; D55) e as sugestões da primeira hora (D36; dona: S1a).
//
// espelho.areas: [{ id, nome, contorno: Float64Array }]. q.sugestoes(): o que o mapa sugere para a primeira hora, tudo
// dado autoral e determinístico: a primeira avenida do nó de entrada até o portão norte da gleba, as primeiras quadras,
// os lugares da captação (no rio, acima da Vila) e da usina solar, o nó de entrada da energia e os primeiros prédios
// da Holding (Escritório de Obra, Pedreira, Areal e Olaria, sobre os recursos). Formato de cada uma:
//   { id, tipo: 'via', via, pontos: [[x, z]] } · { id, tipo: 'zona', zona, pontos (contorno) }
//   { id, tipo: 'construir', construir, x, z, rot } · { id, tipo: 'no', x, z, ref }
import { pontoNoPoligono } from '../../comum/vetor.js';
import { GLEBA_ENVELOPE, PLANOS, PLANO_ESCOLHIDO } from '../../data/arcologia-plano.js';
import { MAPA_HELDOPOLIS } from '../../data/mapa-heldopolis.js';
import { terrenoBase } from './terreno.js';

/** Áreas do mapa com o contorno em Float64Array. */
export function areasDoMapa(mapa = MAPA_HELDOPOLIS) {
  return mapa.areas.map((a) => ({
    id: a.id,
    nome: a.nome,
    contorno: Float64Array.from(Array.isArray(a.contorno[0]) ? a.contorno.flat() : a.contorno),
  }));
}

/** Id da área nomeada que contém (x, z), ou null (a primeira da lista vence onde duas se cruzam). */
export function areaDe(sim, x, z) {
  for (const a of sim.espelho.areas) if (pontoNoPoligono(x, z, a.contorno)) return a.id;
  return null;
}

/** Portão norte da gleba: o do plano escolhido (ou do padrão da Prévia 0), senão o meio da borda norte do envelope. */
export function portaoNorte(sim) {
  const id = sim?.espelho?.arcologia?.plano ?? PLANO_ESCOLHIDO ?? 'A';
  const plano = PLANOS?.[id];
  const p = plano?.portoes?.find((q) => q.id === 'norte');
  if (p) return [p.x, p.z];
  const [x0, z0, x1] = GLEBA_ENVELOPE.caixa;
  return [(x0 + x1) / 2, z0];
}

/** Sugestões da primeira hora (cópias novas a cada chamada). */
export function sugestoes(sim) {
  const mapa = terrenoBase(sim)?.mapa ?? MAPA_HELDOPOLIS;
  const S = mapa.sugestoes;
  const out = [];
  const pontos = S.avenida.pontos.map((p) => [p[0], p[1]]);
  pontos[pontos.length - 1] = portaoNorte(sim);
  out.push({ id: 'avenida', tipo: 'via', via: S.avenida.via, pontos });
  S.quadras.forEach((q, k) => out.push({ id: `quadra${k + 1}`, tipo: 'zona', zona: q.zona, pontos: q.contorno.map((p) => [p[0], p[1]]) }));
  const entrada = sim.json.mapa?.entrada ?? -1;
  out.push({ id: 'entrada', tipo: 'no', x: mapa.entrada.x, z: mapa.entrada.z, ref: entrada, energiaMW: mapa.entrada.energiaMW });
  for (const id of ['captacao', 'usina', 'escritorio', 'pedreira', 'areal', 'olaria']) {
    const c = S[id];
    out.push({ id, tipo: 'construir', construir: c.construir, x: c.x, z: c.z, rot: c.rot });
  }
  return out;
}

export function registrar(sim) {
  const mapa = terrenoBase(sim)?.mapa ?? MAPA_HELDOPOLIS;
  sim.espelho.areas = areasDoMapa(mapa);
  sim.registrarConsulta('sugestoes', sugestoes);
}
