// Projetores da sombra própria (D43): o que entra na cena de sombra e como. Regra do desenho do render 2.5: só
// projeta o que tem altura e aparece de longe (a caixa LOD1 dos prédios, as árvores de perto, a Arcologia); o LOD0
// detalhado, o terreno, as vias, a água, a gente e os props pequenos não projetam. Cada gêmeo compartilha a
// geometria (e, na malha instanciada, o buffer de instâncias) da fonte: nenhum envio a mais. Estas funções são o que
// os domínios usam (R4a, R2b, X1a); ctx.sombra é a SombraPropria de render/sombra/mapa.js.
import * as THREE from 'three';

/**
 * Gêmeo projetor de uma malha (Mesh ou InstancedMesh). A família 'sombra' de R.stats conta os triângulos dele. Uma
 * instanciada grande (a cidade em LOD1) ganha buffer próprio só com as instâncias da cascata, refeito quando o mapa é
 * refeito (compactar: true ou false força; sem ele, acima de 4.096 vagas).
 * @example const g = projetar(ctx, lod1Caixas)  // o LOD1 pode estar invisível na vista e projeta mesmo assim
 */
export function projetar(ctx, fonte, { material = null, compactar = null } = {}) {
  const g = ctx.sombra.projetor(fonte, { material, compactar });
  return ctx.medidas?.familia ? ctx.medidas.familia(g, 'sombra') : g;
}

/** Gêmeos de todas as malhas de um grupo (a Arcologia por partes). Devolve a função que solta todos. */
export function projetarGrupo(ctx, grupo, { material = null, filtro = null } = {}) {
  const fontes = [];
  grupo.traverse((o) => {
    if ((o.isMesh || o.isInstancedMesh) && (!filtro || filtro(o))) fontes.push(o);
  });
  for (const f of fontes) projetar(ctx, f, { material });
  return () => {
    for (const f of fontes) ctx.sombra.soltar(f);
  };
}

/**
 * Material de profundidade com recorte por alfa (folhas das árvores de perto): só escreve a profundidade onde o alfa
 * do mapa passa do limiar.
 */
export function materialRecorte({ mapa, limiar = 0.5, lados = THREE.DoubleSide } = {}) {
  return new THREE.MeshBasicMaterial({ colorWrite: false, map: mapa ?? null, alphaTest: limiar, side: lados });
}

/** Solta o gêmeo de uma fonte. */
export function soltar(ctx, fonte) {
  ctx.sombra.soltar(fonte);
}

export function registrar() {}
