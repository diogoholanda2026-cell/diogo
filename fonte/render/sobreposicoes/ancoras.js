// Âncoras dos rótulos da UI (desenho do render 11.3; desenho da UI 8.10; X3a): a posição de tela de até 40 pontos do
// mundo por quadro, com a visibilidade. Além do que R.projetar já diz (na frente da câmera e dentro da tela), aqui
// entra a oclusão pelo relevo: um rótulo de bairro atrás de um morro some. A conta é na CPU, pela grade de alturas
// (comum/altura.js, a mesma do chão), sem ler a GPU: 20 amostras no segmento da câmera ao ponto, e cada âncora é
// conferida de novo a cada 6 quadros (as outras usam a última resposta). Prédios não escondem rótulos (o CS2 também
// não), só o chão.
//
// Publica ctx.dominio('ancoras').ancoras(lista) → [{ x, y, visivel, dist }] (a mesma forma de R.ancoras). Pendência
// do integrador: R.ancoras (render/index.js) passar por ela quando o domínio existir.
import { alturaEm } from '../../comum/altura.js';
import { projetarNaTela } from '../camera/raio.js';

export const ANCORAS = Object.freeze({ max: 40, amostras: 20, folga: 3, refazerQuadros: 6 });

/**
 * O relevo esconde o ponto p visto de o? Amostra o segmento (sem as pontas) e compara a cota da reta com o chão.
 * @param {{ n, passo, origem, altura } | null} T  espelho.terreno
 */
export function ocultoPeloChao(T, o, p, { amostras = ANCORAS.amostras, folga = ANCORAS.folga } = {}) {
  if (!T?.altura) return false;
  for (let k = 1; k < amostras; k++) {
    const t = k / amostras;
    // as amostras perto do ponto ficam de fora: o próprio chão do rótulo não o esconde
    if (t > 0.97) break;
    const x = o[0] + (p[0] - o[0]) * t;
    const y = o[1] + (p[1] - o[1]) * t;
    const z = o[2] + (p[2] - o[2]) * t;
    if (alturaEm(T, x, z) > y + folga) return true;
  }
  return false;
}

function criarAncoras(ctx) {
  const cache = new Map(); // chave do ponto → { oculto, quadro }
  let quadro = 0;
  const chave = (p) => `${Math.round(p[0])},${Math.round(p[1])},${Math.round(p[2])}`;
  return {
    nome: 'ancoras',
    quadro() {
      quadro++;
      if (cache.size > 4 * ANCORAS.max) cache.clear();
    },
    /** Posições de tela de até 40 pontos, com a oclusão pelo relevo. */
    ancoras(lista) {
      const el = ctx.canvas;
      const w = el?.clientWidth || el?.width || 1;
      const h = el?.clientHeight || el?.height || 1;
      const cam = ctx.camera.position;
      const o = [cam.x, cam.y, cam.z];
      const T = ctx.sim.espelho.terreno;
      return lista.slice(0, ANCORAS.max).map((p, k) => {
        const r = projetarNaTela(ctx.camera, w, h, p);
        if (!r.visivel) return r;
        const c = chave(p);
        let e = cache.get(c);
        if (!e || (quadro - e.quadro >= ANCORAS.refazerQuadros && (quadro + k) % ANCORAS.refazerQuadros === 0)) {
          e = { oculto: ocultoPeloChao(T, o, p), quadro };
          cache.set(c, e);
        }
        return e.oculto ? { ...r, visivel: false } : r;
      });
    },
  };
}

export function registrar(api) {
  api.registrarDominio('ancoras', criarAncoras);
}
