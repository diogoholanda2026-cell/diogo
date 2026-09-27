// Exposição pela luz no chão (D9, desenho do render 2.3): a câmera do jogo se ajusta como uma câmera de verdade, mas
// só em parte (expoente 0,75): o fim de tarde fica mais escuro e quente que o meio-dia, a hora azul mais escura ainda,
// e a noite tem uma exposição mínima que a deixa legível (o CS2 é criticado pela noite escura demais). A luz no chão
// vem do mesmo modelo do céu (sol, lua e céu na horizontal); com o sol a 45 graus ela vale pi e a exposição vale a
// chave (1,6): junto com o "look" do AgX (motor/pos.js), um chão de albedo 0,2 ao sol fica perto de 0,5 na tela, o
// asfalto perto de 0,3, a sombra perto de 0,13 e um telhado claro perto de 0,7, a faixa de uma foto aérea.
// A troca é suave (constante de 1 s real); um salto grande (cena nova, hora forçada) vai direto. Também dá o limiar
// do bloom: 1,1 de dia (só o sol refletido e o céu estourado) e 0,8 de noite (janelas, postes, faróis).

export const EXPOSICAO = Object.freeze({ referencia: Math.PI, chave: 1.6, gama: 0.75, minima: 0.5, maxima: 14, constante: 1 });

/**
 * Exposição alvo para uma luz no chão (luminância na horizontal, unidade do céu).
 * @example exposicaoAlvo(Math.PI) // 1,6 (a chave: com o sol a 45 graus)
 */
export function exposicaoAlvo(eChao, E = EXPOSICAO) {
  const e = Math.max(eChao, 1e-6);
  return Math.min(E.maxima, Math.max(E.minima, E.chave * (E.referencia / e) ** E.gama));
}

export class Exposicao {
  constructor() {
    this.valor = 1;
    this.alvo = 1;
    this.limiarBloom = 1.1;
    this.fixa = null; // modo foto e testes: exposição travada
  }

  /** @param {{ eChao: number, noite: number }} est  estado do céu; dt em segundos reais (0: vai direto) */
  atualizar(est, dt) {
    this.alvo = this.fixa ?? exposicaoAlvo(est.eChao);
    const salto = Math.abs(Math.log2(this.alvo / this.valor));
    if (!(dt > 0) || salto > 1.5) this.valor = this.alvo;
    else this.valor *= (this.alvo / this.valor) ** (1 - Math.exp(-dt / EXPOSICAO.constante));
    this.limiarBloom = 1.1 - 0.3 * est.noite;
  }
}

export function registrar() {}
