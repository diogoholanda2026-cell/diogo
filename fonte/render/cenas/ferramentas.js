// Cena 'ferramentas' (desenho do render 11.2 e 15.2; A10): as ferramentas desenhadas no mundo sobre a cidade sintética,
// na ponta de uma rua que dá para campo aberto. Uma avenida em curva sai do fim da rua (a prévia com a fita, as bordas,
// o eixo e a guia do prolongamento) e o bloco de células livres ao lado fica aceso na cor da zona que o pincel vai
// pintar, com as células de 8 m instanciadas num raio de 400 m da mira. Com ?ui=1 a interface abre a ferramenta de via
// de verdade e traça a mesma avenida pela entrada do render (cliques de mouse no canvas: A, B e a alça do meio), para
// a captura do dono mostrar a barra da ferramenta, as alças e a cota.
// O resultado traz o que as sobreposições desenharam (triângulos da fita, células, linhas) e o quadro.
import { deQuadratica, direcao } from '../../comum/bezier.js';
import { alturaEm } from '../../comum/altura.js';
import { CELULA } from '../../contratos/flags.js';
import { ZONAS_ORDEM } from '../../data/zonas.js';

/** Ponta de rua da cidade sintética que dá para o campo (a leste), e a vista. */
export const LUGAR = Object.freeze({ ponta: [1130, -1742], camera: { x: 1215, z: -1690, dist: 360, guinada: 8, inclinacao: 44 } });

/** A ponta viva mais perto de um ponto (grau 1) e a direção em que a rua continua. */
export function pontaPerto(esp, [x, z]) {
  const N = esp.vias?.nos;
  const A = esp.vias?.arestas;
  if (!N?.n || !A?.n) return null;
  let melhor = -1;
  let md = Infinity;
  for (let i = 0; i < N.n; i++) {
    if (!N.viva[i] || N.grau[i] !== 1) continue;
    const d = (N.x[i] - x) ** 2 + (N.z[i] - z) ** 2;
    if (d < md) {
      md = d;
      melhor = i;
    }
  }
  if (melhor < 0) return null;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e] || (A.a[e] !== melhor && A.b[e] !== melhor)) continue;
    const noA = A.a[e] === melhor;
    const d = direcao(A.p, noA ? 0 : 1, [0, 0], 8 * e);
    return { no: melhor, ponto: [N.x[melhor], N.z[melhor]], dir: noA ? [-d[0], -d[1]] : d };
  }
  return null;
}

/** Células livres e sem zona num raio (as da prévia do pincel). */
function celulasLivres(esp, [x, z], raio, max = 240) {
  const C = esp.celulas;
  const l = [];
  for (let c = 0; c < (C?.n ?? 0) && l.length < max; c++) {
    if (!C.viva[c] || C.estado[c] !== CELULA.LIVRE || C.zona[c]) continue;
    if ((C.x[c] - x) ** 2 + (C.z[c] - z) ** 2 <= raio * raio) l.push(c);
  }
  return Int32Array.from(l);
}

/** Com a interface (?ui=1): abre a via e traça A, B e a curva por cliques de mouse no canvas. */
async function tracarPelaInterface(held, A, B, M) {
  const R = held.R;
  const canvas = document.getElementById('mundo');
  const quadro = () => new Promise((ok) => requestAnimationFrame(() => ok()));
  const tela = (p) => {
    const T = held.sim?.espelho?.terreno;
    const y = T?.altura ? alturaEm(T, p[0], p[1]) : 0;
    const s = R.projetar([p[0], y, p[1]]);
    return [s.x, s.y];
  };
  const clique = async (p, ate = null) => {
    const [x, y] = tela(p);
    const base = { pointerId: 7, pointerType: 'mouse', isPrimary: true, bubbles: true, clientX: x, clientY: y, button: 0, buttons: 1 };
    canvas.dispatchEvent(new PointerEvent('pointerdown', base));
    if (ate) {
      const [x2, y2] = tela(ate);
      for (let k = 1; k <= 6; k++) {
        canvas.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: x + ((x2 - x) * k) / 6, clientY: y + ((y2 - y) * k) / 6 }));
        await quadro();
      }
      canvas.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: x2, clientY: y2, buttons: 0 }));
    } else canvas.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0 }));
    await quadro();
  };
  held.ui.ui.loja.ferramenta.value = { tipo: 'via', tipoVia: 'avenida' };
  await quadro();
  await clique(A);
  await clique(B);
  // a alça do meio fica no meio da reta: arrastar curva a avenida
  await clique([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], M);
}

export function registrar(registrarCena) {
  registrarCena('ferramentas', {
    sim: 'sintetica',
    hora: 10,
    camera: LUGAR.camera,
    async montar(ctx) {
      const esp = ctx.sim.espelho;
      const falhas = [];
      const ponta = pontaPerto(esp, LUGAR.ponta);
      if (!ponta) falhas.push('a cidade sintética não tem ponta de rua perto do lugar da cena');
      const A = ponta?.ponto ?? LUGAR.ponta;
      const d = ponta?.dir ?? [1, 0];
      const n = [-d[1], d[0]];
      // avenida em curva: 200 m para a frente e 90 m para o lado, com o controle no prolongamento da rua
      const B = [A[0] + d[0] * 200 + n[0] * 90, A[1] + d[1] * 200 + n[1] * 90];
      const C = [A[0] + d[0] * 130, A[1] + d[1] * 130];
      const M = [(A[0] + 2 * C[0] + B[0]) / 4, (A[1] + 2 * C[1] + B[1]) / 4];
      const cota = (p) => (esp.terreno?.altura ? alturaEm(esp.terreno, p[0], p[1]) : 0);
      const plano = {
        ok: true,
        segmentos: [{ p: Array.from(deQuadratica(A[0], A[1], C[0], C[1], B[0], B[1])), tipo: 'avenida', cotas: [cota(A), cota(B)], ponte: false, erros: [] }],
        guias: [{ tipo: 'prolongamento', a: [...A], b: [A[0] + d[0] * 260, A[1] + d[1] * 260] }],
        encaixes: [{ ponto: [...A], tipo: 'no', valor: ponta?.no ?? -1 }],
        erros: [],
      };
      ctx.emitir('ferramenta.via', { plano, estilo: 'normal' });
      // zonas: a mira do pincel ao lado da rua, as células livres em volta acesas em residencial baixa
      const mira = [A[0] - d[0] * 60 - n[0] * 30, A[1] - d[1] * 60 - n[1] * 30];
      ctx.emitir('ferramenta.zona', true);
      ctx.emitir('ferramenta.pincel', { x: mira[0], z: mira[1], raio: 16 });
      const acesas = celulasLivres(esp, mira, 70);
      ctx.emitir('ferramenta.celulas', { celulas: acesas, zona: ZONAS_ORDEM.indexOf('resBaixa') });
      const dom = ctx.dominio('ferramentas');
      if (!dom) falhas.push('o domínio ferramentas não registrou');
      let comUI = false;
      return {
        quadro() {
          if (comUI || typeof window === 'undefined') return;
          const held = window.__held;
          if (!held?.ui || !held.R) return;
          comUI = true;
          tracarPelaInterface(held, A, B, M).catch((e) => console.error('cena ferramentas: roteiro da interface', e));
        },
        resultado() {
          const m = dom?.medidas?.() ?? null;
          const f = [...falhas];
          if (m && !m.via) f.push('a prévia da via não desenhou');
          if (m && !m.celulas) f.push('nenhuma célula de zona desenhada perto da mira');
          if (!acesas.length) f.push('nenhuma célula livre perto da mira');
          const s = ctx.stats;
          return {
            ok: f.length === 0,
            falhas: f,
            medidas: m,
            acesas: acesas.length,
            quadro: { calls: s.calls, tris: s.tris, resto: s.familias.resto },
          };
        },
      };
    },
  });
}
