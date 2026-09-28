// Áreas (D3, D24, D55): a grade de ladrilhos de 512 m com o preço e o desconto da Influência, e a compra por
// ladrilho.comprar. Máquina PURA: tocar escolhe o ladrilho sob a mira; a barra diz o estado e o preço; Comprar manda o
// comando. A ferramenta abre pelo Progresso, pelo modal do marco e pelo toque longo no terreno (U1b), pondo
// loja.ferramenta = { tipo: 'areas' }; não tem botão na barra de construção (D24).
import { LADRILHO } from '../../contratos/flags.js';

/** Lado do ladrilho (m) e a grade (D3). */
export const LADO_LADRILHO = 512;
export const N_LADRILHOS = 16;

/** Ladrilho [i, j] de um ponto (null fora do mapa). */
export function ladrilhoDoPonto(x, z, origem = [-4096, -4096], lado = LADO_LADRILHO, n = N_LADRILHOS) {
  const i = Math.floor((x - origem[0]) / lado);
  const j = Math.floor((z - origem[1]) / lado);
  if (i < 0 || j < 0 || i >= n || j >= n) return null;
  return [i, j];
}

/** Centro [x, z] do ladrilho. */
export const centroLadrilho = (i, j, origem = [-4096, -4096], lado = LADO_LADRILHO) => [origem[0] + (i + 0.5) * lado, origem[1] + (j + 0.5) * lado];

/**
 * Situação de um ladrilho: { i, j, estado: 'holding' | 'compravel' | 'trancado', preco, precoCheio, desconto }.
 * A tabela vem de q.ladrilhos() ou do espelho (estado Uint8Array(256), preco Float64Array(256), já com o desconto da
 * Influência aplicado pela S1a); `desconto` (0 a 0,2) é o de q.holding().efeitos.descontoLadrilho, só para mostrar o
 * preço cheio ao lado.
 */
export function infoLadrilho(tabela, i, j, desconto = 0) {
  if (!tabela?.estado) return null;
  const n = tabela.n ?? N_LADRILHOS;
  const k = j * n + i;
  const est = tabela.estado[k];
  const preco = tabela.preco?.[k] ?? 0;
  const d = Number.isFinite(desconto) ? Math.max(0, Math.min(0.9, desconto)) : 0;
  return {
    i,
    j,
    estado: est === LADRILHO.HOLDING ? 'holding' : est === LADRILHO.COMPRAVEL ? 'compravel' : 'trancado',
    preco,
    precoCheio: d > 0 ? Math.round(preco / (1 - d)) : preco,
    desconto: d,
  };
}

/** Ladrilhos compráveis (para os rótulos de preço no mundo): [{ i, j, preco }]. */
export function compraveis(tabela) {
  const l = [];
  if (!tabela?.estado) return l;
  const n = tabela.n ?? N_LADRILHOS;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (tabela.estado[j * n + i] === LADRILHO.COMPRAVEL) l.push({ i, j, preco: tabela.preco?.[j * n + i] ?? 0 });
  return l;
}

/** Estado novo. */
export function criarAreas() {
  return { sel: null, mira: null, efeitos: [] };
}

/**
 * Um passo. Eventos: fim ({ ponto }) escolhe o ladrilho; { tipo: 'cancelar' }; { tipo: 'comprado' }.
 * Efeitos: 'escolheu', 'sair'.
 */
export function passoAreas(e, ev, { origem = [-4096, -4096] } = {}) {
  if (ev.tipo === 'cancelar') return e.sel ? { ...e, sel: null, efeitos: ['escolheu'] } : { ...e, efeitos: ['sair'] };
  if (ev.tipo === 'comprado') return { ...e, efeitos: ['escolheu'] };
  if (!ev.ponto) return { ...e, efeitos: [] };
  const mira = { ponto: [ev.ponto[0], ev.ponto[1]], tela: ev.tela ?? null, dedo: ev.dedo ?? null };
  if (ev.tipo !== 'fim') return { ...e, mira, efeitos: [] };
  const l = ladrilhoDoPonto(ev.ponto[0], ev.ponto[1], origem);
  if (!l) return { ...e, mira, efeitos: [] };
  const mesmo = e.sel && e.sel[0] === l[0] && e.sel[1] === l[1];
  return { ...e, mira, sel: mesmo ? null : l, efeitos: ['escolheu'] };
}
