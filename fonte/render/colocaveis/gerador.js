// Gerador dos colocáveis (R5, D39, D60), puro: roda no worker `oficina` (tipo 'colocavel'), na thread principal sob
// demanda (sem worker) e no Node. Um pedido traz uma lista de colocáveis (os de um setor de 256 m no LOD0, ou todos no
// LOD1) e volta com uma malha só, fundida e quantizada como a dos prédios da cidade (fundir.js da R4a), no material
// `edificio`; o aId de cada vértice é a vaga do prédio (a tabela de prédios na GPU dá a obra, a seleção, a cor da
// Holding e a agenda da noite). Cada colocável ocupa um trecho contínuo dos índices (faixas): o domínio monta o LOD1
// da cidade inteira numa chamada e tira dele os que estão no LOD0 de perto sem refazer a malha.
//
// Pedido (dados): { lod: 0 | 1, detalhe: 'media' | 'ultra', ox, oz, n, num: Float32Array(n x NUM_C) [x - ox, y,
//                   z - oz, rot, w, d], ints: Uint32Array(n x INT_C) [idx, semente, tipo (COLOCAVEIS_ORDEM), nível |
//                   SEM_ARVORES] }
// Resposta: { lod, malhas: [malha quantizada] | [], caixas: Float32Array(n x CAIXA_C) [x0, z0, x1, z1, y0, y1, tris]
//             no espaço do lote, faixas: Uint32Array(n x 2) [primeiro índice, quantidade], tris, arvores:
//             Float32Array(PASSO_ARV por árvore) [x, y, z, espécie (ESPECIES_ARVORE), altura, largura] no espaço do
//             pedido, só no LOD1 (o domínio planta pela vegetação da R2b) }
// No campo do nível vai também SEM_ARVORES (o colocável em obra ainda não tem as árvores).
import { Construtor } from '../geracao/malhaPredio.js';
import { quantizarMalha } from '../geracao/quantizar.js';
import { COLOCAVEIS, COLOCAVEIS_ORDEM } from '../../data/colocaveis.js';
import { Montador, mat, F, ENTERRA, PASSO_ARV, ESPECIES_ARVORE } from './pecas.js';
import { MODELOS_SERVICOS } from './servicos.js';
import { MODELOS_HOLDING } from './holding.js';

export { PASSO_ARV, ESPECIES_ARVORE };

export const NUM_C = 6;
export const INT_C = 4;
export const CAIXA_C = 7;
/** Bit do campo de nível no pedido: o colocável não planta árvores (em obra). */
export const SEM_ARVORES = 1 << 8;

/** Gerador de cada tipo: fn(b) desenha no montador b (pecas.js). */
export const MODELOS = Object.freeze({ ...MODELOS_SERVICOS, ...MODELOS_HOLDING });

/** Modelo de reserva (tipo sem gerador): o lote e um volume de serviço com a fachada da R4a. */
function generico(b) {
  const piso = mat(F.PISO, '#8a857c');
  b.caixa(0, -ENTERRA, 0, b.w, ENTERRA + 0.05, b.d, piso, { l1: true });
  const alt = COLOCAVEIS[b.tipo]?.altura ?? 8;
  b.caixa(0, 0, 0, b.w * 0.7, Math.min(alt, 12), b.d * 0.6, mat(F.FITA, '#d2cbbd', { a: 3.6, v: 1.5 }), { topo: mat(F.LAJE, '#8f8b84'), l1: true });
}

/**
 * Desenha um colocável no construtor K (já posto no lote com K.predio). Devolve os triângulos escritos; as árvores
 * (para a vegetação) vão em op.arvores, no espaço do construtor (PASSO_ARV por árvore), se a lista vier.
 * @param {{ tipo: string, w?: number, d?: number, nivel?: number, semente?: number, lod?: 0 | 1, detalhe?: string,
 *           arvores?: number[] }} op
 */
export function modelar(K, { tipo, w, d, nivel = 1, semente = 1, lod = 0, detalhe = 'media', arvores = null }) {
  const peg = COLOCAVEIS[tipo]?.pegada ?? [24, 24];
  const b = new Montador(K, { lod, detalhe, semente, nivel, w: w || peg[0], d: d || peg[1], tipo });
  const t0 = K.tris;
  (MODELOS[tipo] ?? generico)(b);
  if (arvores) {
    const A = b.arvores;
    for (let k = 0; k + PASSO_ARV <= A.length; k += PASSO_ARV) {
      const x = A[k];
      const z = A[k + 2];
      arvores.push(K.ox + x * K.c + z * K.s, K.oy + A[k + 1], K.oz - x * K.s + z * K.c, A[k + 3], A[k + 4], A[k + 5]);
    }
  }
  return K.tris - t0;
}

/** Caixa [x0, y0, z0, x1, y1, z1] dos vértices [v0, v1) do construtor, no espaço do lote (desfaz o giro). */
function caixaDoTrecho(K, v0, v1, ox, oy, oz, rot) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = v0; i < v1; i++) {
    const dx = K.pos[3 * i] - ox;
    const dz = K.pos[3 * i + 2] - oz;
    // inverso de x = xl c + zl s, z = -xl s + zl c
    const xl = dx * c - dz * s;
    const zl = dx * s + dz * c;
    const yl = K.pos[3 * i + 1] - oy;
    if (xl < b[0]) b[0] = xl;
    if (yl < b[1]) b[1] = yl;
    if (zl < b[2]) b[2] = zl;
    if (xl > b[3]) b[3] = xl;
    if (yl > b[4]) b[4] = yl;
    if (zl > b[5]) b[5] = zl;
  }
  return v1 > v0 ? b : [0, 0, 0, 0, 0, 0];
}

/** Gera a malha de uma lista de colocáveis (o pedido 'colocavel' da oficina). */
export function gerarColocaveis(dados) {
  const { n = 0, num, ints, lod = 0, detalhe = 'media' } = dados;
  // um pedido sem os dados (os buffers foram transferidos a um worker que morreu) não vira malha com NaN: o erro volta
  // na resposta e o domínio pede de novo
  if (n > 0 && !(num?.length >= n * NUM_C && ints?.length >= n * INT_C)) throw new Error(`colocavel: pedido sem os dados de ${n} colocáveis`);
  const K = new Construtor(Math.max(1024, n * (lod ? 400 : 6000)));
  const caixas = new Float32Array(n * CAIXA_C);
  const faixas = new Uint32Array(n * 2);
  // as árvores vão no pedido do LOD1 (o domínio planta todas de uma vez na vegetação)
  const arvores = lod === 1 ? [] : null;
  for (let i = 0; i < n; i++) {
    const x = num[NUM_C * i];
    const y = num[NUM_C * i + 1];
    const z = num[NUM_C * i + 2];
    const rot = num[NUM_C * i + 3];
    const idx = ints[INT_C * i];
    const tipo = COLOCAVEIS_ORDEM[ints[INT_C * i + 2]] ?? '';
    const v0 = K.nv;
    const i0 = K.ni;
    K.predio(x, y, z, rot, idx >>> 0);
    const t = modelar(K, { tipo, w: num[NUM_C * i + 4], d: num[NUM_C * i + 5], nivel: ints[INT_C * i + 3] & 255, semente: ints[INT_C * i + 1], lod, detalhe, arvores: ints[INT_C * i + 3] & SEM_ARVORES ? null : arvores });
    const c = caixaDoTrecho(K, v0, K.nv, x, y, z, rot);
    caixas.set([c[0], c[2], c[3], c[5], c[1], c[4], t], CAIXA_C * i);
    faixas[2 * i] = i0;
    faixas[2 * i + 1] = K.ni - i0;
  }
  const malhas = K.nv ? [quantizarMalha(K)] : [];
  return { lod, malhas, caixas, faixas, tris: K.tris, arvores: Float32Array.from(arvores ?? []) };
}

/**
 * Pedido de uma lista de colocáveis a partir do espelho (o domínio monta; os testes também).
 * @param {object} P  espelho.predios
 * @param {{ i: number, tipo: string }[]} itens
 * @returns {{ dados: object, transferir: ArrayBuffer[] }}
 */
export function pedidoColocaveis(P, itens, { ox = 0, oz = 0, lod = 0, detalhe = 'media', semArvores = () => false } = {}) {
  const n = itens.length;
  const num = new Float32Array(n * NUM_C);
  const ints = new Uint32Array(n * INT_C);
  itens.forEach(({ i, tipo }, k) => {
    num.set([P.x[i] - ox, P.y[i], P.z[i] - oz, P.rot[i], P.w[i], P.d[i]], NUM_C * k);
    ints[INT_C * k] = i;
    ints[INT_C * k + 1] = P.semente[i];
    // tipo fora da tabela: o índice não existe e o gerador desenha o modelo de reserva
    const t = COLOCAVEIS_ORDEM.indexOf(tipo);
    ints[INT_C * k + 2] = t < 0 ? 0xffff : t;
    ints[INT_C * k + 3] = (P.nivel[i] || 1) | (semArvores(i) ? SEM_ARVORES : 0);
  });
  return { dados: { lod, detalhe, ox, oz, n, num, ints }, transferir: [num.buffer, ints.buffer] };
}
