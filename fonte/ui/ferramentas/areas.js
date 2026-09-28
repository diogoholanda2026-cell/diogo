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

/**
 * Rótulos de preço sem sobreposição (com a câmera longe, os ladrilhos vizinhos ficam pequenos na tela e os preços se
 * empilham). Caixas [{ x, y, w, h, pri }] na tela (centro e tamanho em px); devolve quais ficam. Guloso: maior `pri`
 * primeiro (o escolhido), depois o mais embaixo na tela (mais perto da câmera). O(n²) com n de umas dezenas.
 */
export function rotulosSemSobrepor(caixas, folga = 4) {
  const ordem = caixas.map((_, i) => i).sort((a, b) => (caixas[b].pri ?? 0) - (caixas[a].pri ?? 0) || caixas[b].y - caixas[a].y || a - b);
  const fica = new Array(caixas.length).fill(false);
  const postas = [];
  for (const i of ordem) {
    const c = caixas[i];
    const bate = postas.some((p) => Math.abs(p.x - c.x) * 2 < p.w + c.w + 2 * folga && Math.abs(p.y - c.y) * 2 < p.h + c.h + 2 * folga);
    if (bate) continue;
    fica[i] = true;
    postas.push(c);
  }
  return fica;
}

/**
 * Rótulo do mundo que cai sob o HUD (desenho da UI 8.10): devolve o y do centro que o tira de baixo de cada retângulo
 * que ele cruza (desce abaixo dos de cima, sobe acima dos de baixo) ou null se não há como (o rótulo some). Caixa pelo
 * centro [x, y] e tamanho [w, h] em px; `hud`: [{ l, t, r, b, cima }] (cima: preso ao topo da tela).
 */
export function fugirDoHud(x, y, w, h, hud, folga = 4) {
  let yy = y;
  for (let volta = 0; volta < 3; volta++) {
    const bate = hud.find((q) => x + w / 2 > q.l && x - w / 2 < q.r && yy + h / 2 > q.t - folga && yy - h / 2 < q.b + folga);
    if (!bate) return yy;
    yy = bate.cima ? bate.b + folga + h / 2 : bate.t - folga - h / 2;
  }
  return null;
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
