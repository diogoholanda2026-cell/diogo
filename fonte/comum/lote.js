// Forma do lote ocupado (LOTE1): retângulo de cantos arredondados no espaço do lote (origem no centro, frente em +z).
// A mesma conta serve ao chão pintado do render e às listas de árvores, carros e cerca do gerador: o lote deixa de ser
// um retângulo reto e o canto vira um quarto de círculo, como o pátio que o aplainar molda em sim/mundo/aplainar.js.
// Puro: sem three, sem relógio, sem sorteio.
import { cos, sen } from './util.js';

/** Raio do canto do lote de w x d (m): um quinto do lado menor, entre 2 e 6 m. */
export function raioDoCanto(w, d) {
  const r = 0.2 * Math.min(w, d);
  return r < 2 ? 2 : r > 6 ? 6 : r;
}

/**
 * Distância com sinal ao lote arredondado de meias dimensões hw x hd e canto r, de um ponto no espaço do lote (lx, lz):
 * negativa dentro (a distância à borda), zero na borda, positiva fora.
 */
export function distLote(lx, lz, hw, hd, r = raioDoCanto(2 * hw, 2 * hd)) {
  const qx = (lx < 0 ? -lx : lx) - (hw - r);
  const qz = (lz < 0 ? -lz : lz) - (hd - r);
  const ox = qx > 0 ? qx : 0;
  const oz = qz > 0 ? qz : 0;
  const dentro = qx > qz ? qx : qz;
  return Math.sqrt(ox * ox + oz * oz) + (dentro < 0 ? dentro : 0) - r;
}

/** true se o ponto (lx, lz) está dentro do lote arredondado, com folga em metros (positiva alarga). */
export const dentroDoLote = (lx, lz, hw, hd, folga = 0, r = raioDoCanto(2 * hw, 2 * hd)) => distLote(lx, lz, hw, hd, r) <= folga;

/**
 * Contorno do lote arredondado como polilinha fechada no espaço do lote: pares [lx, lz] em ordem anti-horária, com
 * `arco` segmentos por canto (4 por padrão). Para a marcação no chão (ferramentas) e para quem precisa do polígono.
 */
export function contornoDoLote(w, d, arco = 4, r = raioDoCanto(w, d)) {
  const hw = w / 2;
  const hd = d / 2;
  const out = [];
  // centros dos cantos e o ângulo inicial de cada um (a sequência anda no sentido anti-horário em x, z)
  const cantos = [[hw - r, -hd + r, -Math.PI / 2], [hw - r, hd - r, 0], [-hw + r, hd - r, Math.PI / 2], [-hw + r, -hd + r, Math.PI]];
  for (const [cx, cz, a0] of cantos) {
    for (let k = 0; k <= arco; k++) {
      const a = a0 + (k / arco) * (Math.PI / 2);
      out.push([cx + r * cos(a), cz + r * sen(a)]);
    }
  }
  return out;
}
