// Neblina de altura com perspectiva aérea em escala real (D9, desenho do render 2.4): escreve a cada quadro os
// uniformes do gancho 'neblina' (motor/ganchos.js, GLSL em materiais/shaders/neblina.glsl.js). Números de dia claro
// no litoral tropical depois da chuva: extinção de 0,78e-4 por metro no nível do mar (visibilidade de ~50 km; metade da
// luz some em ~9 km rente ao chão), um pouco mais no azul (o longe azula), altura de escala de 700 m (vista de cima a cidade fica
// com contraste e as torres saem da névoa; a Arcologia fica nítida). De
// manhã, logo depois do nascer, o ar está úmido: névoa mais densa e mais baixa. Nuvens engrossam um pouco o ar. A
// cor da luz espalhada é o anel do horizonte do céu (ambiente/ceu.js): de noite, o brilho da cidade.

/** Extinção por metro no nível do mar (vermelho, verde, azul) e altura de escala (m). */
export const NEBLINA = Object.freeze({ beta: [0.66e-4, 0.78e-4, 1.02e-4], altura: 700, alturaManha: 380, manha: 0.7, nuvens: 0.35 });

const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Umidade da manhã (0 a 1) pela hora do céu e a hora do nascer: sobe antes do nascer e se desfaz em ~3 h.
 * @example umidadeManha(6.2, 5.5) > 0.9
 */
export function umidadeManha(hora, nascer) {
  const dh = hora - nascer;
  return suave(-1.5, 0, dh) * (1 - suave(0.8, 3.2, dh));
}

export class Neblina {
  constructor(ctx) {
    this.u = ctx.ganchos.uniformes;
    this.ligada = true;
    this.umidade = 0;
    this.densidade = 1; // multiplicador (modo foto, cenas)
  }

  /**
   * @param {object} est  estado do céu (anel, zenite, P.sol)
   * @param {{ umidade?: number, nuvens?: number }} ar
   */
  atualizar(est, ar = {}) {
    const u = this.u;
    const um = ar.umidade ?? 0;
    const k = this.densidade * (1 + NEBLINA.manha * um) * (1 + NEBLINA.nuvens * (ar.nuvens ?? 0.3));
    u.gNeblinaBeta.value.set(NEBLINA.beta[0] * k, NEBLINA.beta[1] * k, NEBLINA.beta[2] * k);
    const h = NEBLINA.altura + (NEBLINA.alturaManha - NEBLINA.altura) * um;
    u.gNeblinaQueda.value = 1 / h;
    for (let i = 0; i < u.gNeblinaAnel.value.length; i++) u.gNeblinaAnel.value[i].fromArray(est.anel, 3 * i);
    u.gNeblinaZenite.value.fromArray(est.zenite);
    u.gNeblinaSolDir.value.fromArray(est.P.sol);
    u.gNeblinaLigada.value = this.ligada ? 1 : 0;
  }

  descartar() {}
}

export function registrar() {}
