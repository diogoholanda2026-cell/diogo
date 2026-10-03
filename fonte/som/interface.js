// Sons da interface (desenho da UI 11; dona: U2a): clique seco no toque, tique de encaixe que sobe a cada encaixe
// seguido, baque grave ao construir, pincel macio ao zonear (um tom por família), estalo ao demolir, dois toques
// descendentes no erro, acorde de pad no marco e sino baixo na etapa da Arcologia. Nunca um som por tique de dinheiro.
// Vibração no marco e no erro fora da ferramenta (a X2 vibra o encaixe e o confirmar dela). Ouve a simulação pelos
// eventos do contrato, o livro (zona.pintar e as demolições), os avisos da loja (recusas) e a sessão da ferramenta.
import { effect } from '@preact/signals';
import { canal, tom, ruidoFiltrado, vibrar, liberar, ativo } from './som.js';
import { avisos } from '../ui/loja.js';
import { sessao } from '../ui/ferramentas/sessao.js';
import { ZONAS_ORDEM } from '../data/zonas.js';

/** Notas por família de zona no pincel (residencial, comercial, industrial e o resto). */
const TOM_ZONA = { res: 392, com: 523.25, ind: 293.66, outra: 440 };
const familia = (z) => (/^res/.test(z) ? 'res' : /^com/.test(z) ? 'com' : /^ind/.test(z) ? 'ind' : 'outra');

let encaixes = { n: 0, t: 0 };
const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Os sons, pelo nome (a interface também chama: tocar('toque')). */
export const SONS = {
  toque() {
    const g = canal('interface');
    ruidoFiltrado(g, { dur: 0.03, freq: 3200, q: 2.5, vol: 0.12 });
    tom(g, { f: 1400, dur: 0.04, tipo: 'triangle', vol: 0.03 });
  },
  encaixe() {
    const g = canal('interface');
    const t = agora();
    encaixes = { n: t - encaixes.t < 1200 ? Math.min(encaixes.n + 1, 7) : 0, t };
    tom(g, { f: 880 * 2 ** ([0, 2, 4, 7, 9, 12, 14, 16][encaixes.n] / 12), dur: 0.07, vol: 0.06 });
  },
  construir() {
    const g = canal('interface');
    tom(g, { f: 120, dur: 0.3, vol: 0.28, ate: 48 });
    ruidoFiltrado(g, { dur: 0.2, freq: 420, q: 0.8, vol: 0.12, filtro: 'lowpass' });
  },
  zonear(zona = 'resBaixa') {
    const g = canal('interface');
    const f = TOM_ZONA[familia(zona)];
    ruidoFiltrado(g, { dur: 0.22, freq: 1800, q: 0.7, vol: 0.05, filtro: 'lowpass' });
    tom(g, { f, dur: 0.3, vol: 0.05, ataque: 0.04 });
  },
  demolir() {
    const g = canal('interface');
    ruidoFiltrado(g, { dur: 0.08, freq: 2600, q: 3, vol: 0.18 });
    tom(g, { f: 180, dur: 0.18, tipo: 'triangle', vol: 0.1, ate: 90 });
  },
  erro() {
    const g = canal('interface');
    tom(g, { f: 440, dur: 0.1, tipo: 'triangle', vol: 0.07 });
    tom(g, { f: 330, t0: 0.11, dur: 0.14, tipo: 'triangle', vol: 0.07 });
  },
  marco() {
    const g = canal('interface');
    for (const [i, f] of [261.63, 329.63, 392, 523.25].entries()) tom(g, { f, t0: i * 0.06, dur: 1.6, tipo: 'triangle', vol: 0.05, ataque: 0.15 });
  },
  etapa() {
    const g = canal('interface');
    tom(g, { f: 196, dur: 2.2, vol: 0.12, ataque: 0.004 });
    tom(g, { f: 196 * 2.76, dur: 0.9, vol: 0.025, ataque: 0.004 });
  },
  confirmar() {
    const g = canal('interface');
    tom(g, { f: 659.25, dur: 0.12, vol: 0.06 });
    tom(g, { f: 987.77, t0: 0.07, dur: 0.18, vol: 0.05 });
  },
};

/** Toca um som pelo nome (sem contexto liberado, não faz nada). */
export function tocar(nome, ...args) {
  try {
    SONS[nome]?.(...args);
  } catch (e) {
    // o áudio nunca derruba o jogo
  }
}

/** Ouve uma simulação (eventos do contrato). Devolve a função que desliga. */
export function ouvirSim(sim) {
  if (!sim?.on) return () => {};
  const soltar = [
    sim.on('construido', () => tocar('construir')),
    sim.on('marco', () => {
      tocar('marco');
      vibrar([20, 60, 20]);
    }),
    sim.on('etapa', ({ estado } = {}) => {
      if (estado === 3) {
        tocar('etapa');
        vibrar([20, 60, 20]);
      }
    }),
  ];
  return () => soltar.forEach((f) => f?.());
}

/** registrar(app) vem de app/controle.js. */
export function registrar(app) {
  if (typeof window === 'undefined' || !app) return;
  let soltarSim = ouvirSim(app.sim);
  let seq = app.sim?.livro?.ultimoSeq ?? 0;
  app.on?.('trocouSim', ({ sim }) => {
    soltarSim();
    soltarSim = ouvirSim(sim);
    seq = sim?.livro?.ultimoSeq ?? 0;
  });
  // pincel e demolição pelo livro (a pintura não tem evento; o 'demolido' também vem do abandono, que não é do jogador);
  // a recusa toca o erro pelo aviso
  let avisoAntes = avisos.peek().length ? avisos.peek()[avisos.peek().length - 1].id : 0;
  app.aoQuadro?.(() => {
    const livro = app.sim?.livro;
    if (!livro || livro.ultimoSeq <= seq) return;
    for (const e of livro.desde(seq)) {
      if (e[2] === 'zona.pintar' && e[3]?.zona) tocar('zonear', ZONAS_ORDEM[e[3].zona] ?? 'resBaixa');
      else if (e[2] === 'demolir' || e[2] === 'via.demolir') tocar('demolir');
    }
    seq = livro.ultimoSeq;
  });
  effect(() => {
    const l = avisos.value;
    const ult = l[l.length - 1];
    if (!ult || ult.id <= avisoAntes) return;
    avisoAntes = ult.id;
    if (ult.codigo) {
      tocar('erro');
      if (!sessao.peek()) vibrar([30, 40, 30]);
    }
  });
  // encaixe da ferramenta (cada encaixe novo da sessão da X2)
  let encaixeAntes = null;
  effect(() => {
    const e = sessao.value?.encaixe ?? null;
    if (e && e !== encaixeAntes && (!encaixeAntes || e.tipo !== encaixeAntes.tipo || e.ponto?.[0] !== encaixeAntes.ponto?.[0] || e.ponto?.[1] !== encaixeAntes.ponto?.[1])) tocar('encaixe');
    encaixeAntes = e;
  });
  // clique seco em todo botão da interface (no momento do toque, não na volta); o primeiro toque também libera o som
  // quando a página entrou direto, sem o "Clique para entrar" (?menu=nova)
  document.addEventListener(
    'pointerdown',
    (ev) => {
      if (!ativo()) liberar();
      const b = ev.target?.closest?.('#ui .bt, #ui [role="tab"], #ui [role="switch"]');
      if (b && b.getAttribute('aria-disabled') !== 'true') tocar('toque');
    },
    { capture: true, passive: true },
  );
}
