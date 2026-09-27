// Registro da seleção (D40, D45): cada domínio registra como o raio da tela acerta as coisas dele, e R.selecionar
// devolve a mais perto. Os marcadores vêm primeiro (D40): um marcador acertado ganha de qualquer coisa atrás dele.
// Sem leitura da GPU: tudo na CPU, a partir do espelho e das medidas de cada domínio.
//
//   registrarSelecionavel('predios', (raio, ctx) => ({ tipo: 'predio', ref, idx, ponto: [x, y, z], dist }) | null,
//                         { prioridade: 0 })
//   raio: { origem: [x, y, z], dir: [x, y, z] (unitário), xTela, yTela }

/** Prioridades: menor ganha antes da distância (marcadores são 0; o resto do mundo 10). */
export const PRIORIDADE = Object.freeze({ marcador: 0, mundo: 10, chao: 20 });

const selecionaveis = new Map();

/**
 * @param {string} dominio  nome único (registrar de novo troca)
 * @param {(raio: object, ctx: object) => ({ tipo: string, ref?: number | null, idx?: number, ponto: number[], dist: number } | null)} fn
 * @param {{ prioridade?: number }} op
 */
export function registrarSelecionavel(dominio, fn, { prioridade = PRIORIDADE.mundo } = {}) {
  if (typeof fn !== 'function') throw new Error(`registrarSelecionavel(${dominio}): fn`);
  selecionaveis.set(dominio, { fn, prioridade });
}

export function removerSelecionavel(dominio) {
  selecionaveis.delete(dominio);
}

export const selecionaveisRegistrados = () => [...selecionaveis.keys()];

/**
 * Seleciona pelo raio: pergunta a cada domínio e fica com o acerto de menor prioridade e, no empate, o mais perto.
 * Devolve { tipo, ref, idx, ponto } (formato Selecao do contrato) ou null.
 */
export function selecionarPorRaio(raio, ctx) {
  let melhor = null;
  let pm = Infinity;
  for (const [nome, { fn, prioridade }] of selecionaveis) {
    let r = null;
    try {
      r = fn(raio, ctx);
    } catch (e) {
      console.error(`seleção: ${nome} falhou:`, e);
    }
    if (!r || !Number.isFinite(r.dist)) continue;
    if (prioridade < pm || (prioridade === pm && r.dist < melhor.dist)) {
      melhor = r;
      pm = prioridade;
    }
  }
  if (!melhor) return null;
  return { tipo: melhor.tipo, ref: melhor.ref ?? null, idx: melhor.idx ?? -1, ponto: melhor.ponto };
}
