// Grade de setores de 256 m (desenho do render 1.3, D39): cada prédio pertence ao setor do centro da sua planta; o
// setor é a unidade de fusão do LOD0 (uma malha por material), de pedido à oficina, de cache e de troca de LOD. Sem
// three: roda no Node (testes) e no navegador. O domínio `predios` (predios.js) usa a grade e monta os pedidos aqui.
import { INT, NUM, empacotarPredio } from '../geracao/fundir.js';
import { PREDIO } from '../../contratos/flags.js';

/** Lado do setor em metros. */
export const LADO_SETOR = 256;

export class GradeSetores {
  /** @param {{ tam?: number, origem?: number[] }} op  o mapa (8.192 m, origem no canto sudoeste da área) */
  constructor({ tam = 8192, origem = [-tam / 2, -tam / 2] } = {}) {
    this.n = Math.ceil(tam / LADO_SETOR);
    this.ox = origem[0];
    this.oz = origem[1];
  }

  /** Setor do ponto (x, z) ou -1 fora do mapa. */
  indice(x, z) {
    const i = Math.floor((x - this.ox) / LADO_SETOR);
    const j = Math.floor((z - this.oz) / LADO_SETOR);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return j * this.n + i;
  }

  /** Canto (x, z) de menor coordenada do setor. */
  canto(s) {
    return [this.ox + (s % this.n) * LADO_SETOR, this.oz + Math.floor(s / this.n) * LADO_SETOR];
  }
}

/** Distância de um ponto a uma caixa (0 dentro). */
export function distCaixa(px, py, pz, x0, y0, z0, x1, y1, z1) {
  const dx = px < x0 ? x0 - px : px > x1 ? px - x1 : 0;
  const dy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
  const dz = pz < z0 ? z0 - pz : pz > z1 ? pz - z1 : 0;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Assinatura de um prédio no espelho: muda quando qualquer coisa que o gerador usa muda (lugar, lote, modelo, nível,
 * estilo, semente, cor, abandono). O setor só é refeito quando a lista ou uma assinatura muda.
 */
export function assinatura(P, i) {
  let h = 0x811c9dc5;
  const mix = (v) => {
    h = Math.imul(h ^ (v | 0), 0x01000193);
  };
  mix(Math.round(P.x[i] * 100));
  mix(Math.round(P.z[i] * 100));
  mix(Math.round(P.y[i] * 100));
  mix(Math.round(P.rot[i] * 10000));
  mix(P.w[i]);
  mix(P.d[i]);
  mix(P.modelo[i]);
  mix(P.nivel[i]);
  mix(P.estilo[i]);
  mix(P.semente[i]);
  mix(P.cor[i]);
  mix(P.flags[i] & PREDIO.ABANDONADO);
  return h >>> 0;
}

/**
 * Pedido de um setor para a oficina (fundir.gerarSetor) a partir do espelho e da lista de idx do setor.
 * @returns {{ dados: object, transferir: ArrayBuffer[] }}
 */
export function pedidoDoSetor(P, lista, grade, s, lod0) {
  const [ox, oz] = grade.canto(s);
  const n = lista.length;
  const num = new Float32Array(n * NUM);
  const ints = new Uint32Array(n * INT);
  for (let k = 0; k < n; k++) {
    const i = lista[k];
    num[NUM * k] = P.x[i] - ox;
    num[NUM * k + 1] = P.y[i];
    num[NUM * k + 2] = P.z[i] - oz;
    num[NUM * k + 3] = P.rot[i];
    num[NUM * k + 4] = P.w[i];
    num[NUM * k + 5] = P.d[i];
    ints[INT * k] = i;
    ints[INT * k + 1] = P.semente[i];
    ints[INT * k + 2] = P.modelo[i];
    ints[INT * k + 3] = empacotarPredio(P.nivel[i], P.estilo[i], P.cor[i], P.flags[i] & PREDIO.ABANDONADO);
  }
  return { dados: { setor: s, ox, oz, lod0, n, num, ints }, transferir: [num.buffer, ints.buffer] };
}

export function registrar() {}
