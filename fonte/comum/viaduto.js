// Regras e geometria comuns de pontes e viadutos (D53, D106; dona: PONT2). Puro: sem relógio, sem sorteio, sem three.
// A simulação valida com estes números (greide, altura livre, pilar em chão válido) e o render desenha com os mesmos
// (o tabuleiro, os pórticos), então o que a prévia aprova é o que aparece.
//
// Engenharia de referência: viadutos de rampa com greide de 6% (limite de 8% das normas rodoviárias), tabuleiro em viga
// de concreto protendido de 1,2 m, pilares a cada 32 m (vãos de 25 a 40 m) e altura livre de 5 m sobre a via de baixo.
import { tabelaArco, tDoArco, ponto, direcao } from './bezier.js';

/** Cotas que o jogador escolhe para o viaduto, em metros de altura livre sobre o chão (0: térreo). */
export const COTAS_VIADUTO = Object.freeze([0, 6, 12, 18]);

/** Greide das rampas de subida e descida (fração). */
export const GREIDE_RAMPA = 0.06;
/** Declive máximo de qualquer trecho elevado (rampa mais o chão por baixo); acima disso a prévia recusa. */
export const GREIDE_MAX_ELEVADO = 0.08;
/** Altura livre mínima sobre a pista de baixo (m), medida da pista até a face de baixo do tabuleiro. */
export const ALTURA_LIVRE = 5;
/** Espessura do tabuleiro (viga e laje, m): a pista fica isto acima da face de baixo. */
export const ESPESSURA_TABULEIRO = 1.2;
/** Desnível mínimo entre as duas pistas para uma passar por cima da outra sem se ligar. */
export const DESNIVEL_MINIMO = ALTURA_LIVRE + ESPESSURA_TABULEIRO;
/** Elevação (pista menos o chão) a partir da qual o trecho já é tabuleiro no alto: flag PONTE, sem aplainar. */
export const ELEVACAO_PONTE = 1;
/** Elevação a partir da qual o trecho precisa de pilar. */
export const ELEVACAO_PILAR = 1.5;
/** Vão de pilar a pilar (m): o espaçamento dos pilares é o comprimento dividido em partes iguais até isto. */
export const VAO_PILAR = 32;
/** Maior travessia sobre a água (m), a D53. */
export const TRAVESSIA_MAX = 200;
/** Profundidade máxima da água onde cabe um pilar (m). */
export const PROFUNDIDADE_PILAR = 25;
/** Custo por metro da ponte e do viaduto, em múltiplos da via comum (D53). */
export const MULT_CUSTO_PONTE = 3;
/** Manutenção por hora do tabuleiro, em múltiplos da via comum. */
export const MULT_MANUTENCAO_PONTE = 2;

/** Normaliza a cota pedida: um dos degraus, ou null se não for. */
export function lerCota(v) {
  if (v === undefined || v === null) return 0;
  return COTAS_VIADUTO.includes(v) ? v : null;
}

/**
 * Altura da pista sobre o chão para a cota escolhida. A cota (0, +6, +12, +18) é a altura livre sob o tabuleiro, o
 * gabarito de quem passa por baixo; a pista fica a espessura do tabuleiro acima disso.
 */
export const alturaDaPista = (cota) => (cota > 0 ? cota + ESPESSURA_TABULEIRO : 0);

/** Comprimento de cada rampa para subir até a pista da cota, no greide da rampa. */
export const comprimentoRampa = (cota) => alturaDaPista(cota) / GREIDE_RAMPA;

/** Deslocamentos (m, no arco) que um pilar tenta, em ordem, para sair de cima de uma via no chão. */
const DESVIOS = Object.freeze([0, 2, -2, 4, -4, 6, -6, 8, -8, 10, -10, 12, -12]);

/**
 * Pilares de uma peça de tabuleiro: um a cada VAO_PILAR (partes iguais), com as duas pontas, onde a pista está a
 * ELEVACAO_PILAR ou mais do chão. A cota da pista é linear no arco (as pontas da aresta, como o render e o trânsito).
 * Um pilar do meio que cairia em lugar bloqueado (`bloqueia`, por exemplo a pista de uma via no chão) anda até 12 m
 * ao longo do arco; se não achar chão livre (ou se é de uma ponta, que é nó) ele não existe: o tabuleiro vence o vão
 * por cima da via, de 50 a 70 m, em viga de concreto protendido.
 * @param {ArrayLike<number>} p  Bézier cúbica (8 números)
 * @param {[number, number]} cotas  cota da pista nas pontas
 * @param {(x: number, z: number) => number} chao  altura do chão (ou do leito, na água)
 * @param {((x: number, z: number) => boolean) | null} [bloqueia]
 * @returns {{ x: number, z: number, dx: number, dz: number, topo: number, base: number, pista: number, s: number }[]}
 *   topo: face de baixo do tabuleiro
 */
export function pilaresDaPeca(p, cotas, chao, bloqueia = null) {
  const tab = tabelaArco(p);
  const comp = tab[16];
  const n = Math.max(1, Math.round(comp / VAO_PILAR));
  const out = [];
  const q = [0, 0];
  const d = [0, 0];
  const em = (s) => {
    const t = s <= 0 ? 0 : s >= comp ? 1 : tDoArco(tab, s);
    ponto(p, t, q);
    direcao(p, t, d);
  };
  for (let k = 0; k <= n; k++) {
    const ponta = k === 0 || k === n;
    let s = (comp * k) / n;
    em(s);
    if (bloqueia && bloqueia(q[0], q[1])) {
      if (ponta) continue;
      let livre = false;
      for (const dv of DESVIOS) {
        const s2 = s + dv;
        if (s2 <= 4 || s2 >= comp - 4) continue;
        em(s2);
        if (!bloqueia(q[0], q[1])) {
          s = s2;
          livre = true;
          break;
        }
      }
      if (!livre) continue;
    }
    const pista = cotas[0] + (cotas[1] - cotas[0]) * (comp > 0 ? s / comp : 0);
    const base = chao(q[0], q[1]);
    if (pista - base < ELEVACAO_PILAR) continue;
    out.push({ x: q[0], z: q[1], dx: d[0], dz: d[1], topo: pista - ESPESSURA_TABULEIRO, base, pista, s });
  }
  return out;
}

/** Chave estável de um pilar (decímetros), para juntar o pilar que duas peças dividem no nó. */
export const chavePilar = (x, z) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
