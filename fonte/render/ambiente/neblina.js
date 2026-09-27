// Neblina de altura com perspectiva aérea em escala real (D9, desenho do render 2.4): escreve a cada quadro os
// uniformes do gancho 'neblina' (motor/ganchos.js, GLSL em materiais/shaders/neblina.glsl.js). Números de um dia
// claro comum no litoral tropical: visibilidade de ~35 km (extinção de 1,0e-4 por metro no verde, no nível do mar:
// aerossol quase cinza mais o Rayleigh, que tira mais do azul), altura de escala de 800 m (a camada de mistura: vista
// de cima a cidade fica com contraste e as torres saem da névoa; os morros a 5 km ficam azulados). De manhã, logo
// depois do nascer, o ar está úmido: névoa mais densa e mais baixa. Nuvens engrossam um pouco o ar.
//
// A luz que o ar põe no caminho (in-scatter) é a do ar BAIXO enquanto o caminho é curto: o sol espalhado pelo lóbulo de
// Henyey-Greenstein (g = 0,6, claro na direção do sol e escuro de costas para ele), mais a luz do céu e do chão
// espalhada por igual e, de noite, o brilho da cidade. Ela é várias vezes mais escura que o horizonte do céu, que é o
// espalhamento de centenas de km de ar: usar o horizonte já de perto lavava a cidade com um véu claro e apagava a
// sombra. Com o caminho longo (transmitância baixa) a luz tende ao anel do horizonte, e o chão ao longe encontra o céu
// sem costura.

/** Extinção por metro no nível do mar (vermelho, verde, azul) e altura de escala (m). */
export const NEBLINA = Object.freeze({
  beta: [0.82e-4, 1.0e-4, 1.32e-4],
  altura: 800,
  alturaManha: 400,
  manha: 0.7,
  nuvens: 0.35,
  albedoAr: 0.9, // fração da luz que o ar espalha (aerossol claro do litoral)
  g: 0.6, // anisotropia do lóbulo do sol
  albedoChao: 0.15, // o chão que devolve luz ao ar (cidade e mata)
  cidade: 0.5, // brilho da cidade no ar baixo, pela radiância que ele põe no horizonte (mais só no horizonte)
});

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

/**
 * Luz do ar baixo (por unidade de extinção) pelo estado do céu: a parte do sol (vezes o lóbulo, na GPU) e a parte
 * ambiente, por igual em todas as direções.
 * @param {object} est  estado do céu (solIrr, ceuIrr, luaIrr, cidade, solH)
 * @returns {{ sol: number[], amb: number[] }}
 */
export function luzDoAr(est, alvo = { sol: [0, 0, 0], amb: [0, 0, 0] }) {
  const N = NEBLINA;
  const sh = est.solH ?? 0;
  for (let i = 0; i < 3; i++) {
    alvo.sol[i] = N.albedoAr * est.solIrr[i];
    // a luz que chega ao ar de todos os lados (irradiância escalar / 4 pi): o céu por cima, o chão por baixo e a lua
    const chao = N.albedoChao * (est.solIrr[i] * sh + est.ceuIrr[i] + (est.luaIrr?.[i] ?? 0) * 0.3);
    alvo.amb[i] = (N.albedoAr * (est.ceuIrr[i] + chao + (est.luaIrr?.[i] ?? 0) * 0.3)) / (2 * Math.PI) + N.cidade * (est.cidade?.[i] ?? 0);
  }
  return alvo;
}

/** Lóbulo de Henyey-Greenstein (por esferorradiano) para o cosseno c entre o olhar e o sol. */
export function henyeyGreenstein(c, g = NEBLINA.g) {
  return (1 - g * g) / (4 * Math.PI * Math.max(1 + g * g - 2 * g * c, 1e-4) ** 1.5);
}

/**
 * A luz que o ar põe no caminho na direção d (unitária) com a transmitância T por canal: a mesma conta de
 * gNeblinaLuz (shaders/neblina.glsl.js). `horizonte` é a cor do anel nessa direção (ceu.js, corVista).
 */
export function luzNoCaminho(d, T, ar, solDir, horizonte, alvo = [0, 0, 0]) {
  const hg = henyeyGreenstein(d[0] * solDir[0] + d[1] * solDir[1] + d[2] * solDir[2]);
  for (let i = 0; i < 3; i++) {
    const w = 1 - T[i];
    const perto = ar.sol[i] * hg + ar.amb[i];
    alvo[i] = perto + (horizonte[i] - perto) * w * w;
  }
  return alvo;
}

export class Neblina {
  constructor(ctx) {
    this.u = ctx.ganchos.uniformes;
    this.ligada = true;
    this.umidade = 0;
    this.densidade = 1; // multiplicador (modo foto, cenas)
    this._ar = { sol: [0, 0, 0], amb: [0, 0, 0] };
  }

  /**
   * @param {object} est  estado do céu (anel, zenite, P.sol, solIrr, ceuIrr, luaIrr, cidade)
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
    const l = luzDoAr(est, this._ar);
    u.gNeblinaSolCor.value.fromArray(l.sol);
    u.gNeblinaAmb.value.fromArray(l.amb);
    u.gNeblinaG.value = NEBLINA.g;
    u.gNeblinaCor.value.setRGB(est.horizLado[0], est.horizLado[1], est.horizLado[2]);
    u.gNeblinaLigada.value = this.ligada ? 1 : 0;
  }

  descartar() {}
}

export function registrar() {}
