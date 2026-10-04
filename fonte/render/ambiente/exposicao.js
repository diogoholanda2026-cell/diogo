// Exposição pela luz no chão (D9, desenho do render 2.3): a câmera do jogo se ajusta como uma câmera de verdade, mas
// só em parte (expoente 0,75): o fim de tarde fica mais escuro e quente que o meio-dia, a hora azul mais escura ainda,
// e a noite tem uma exposição mínima que a deixa legível (o CS2 é criticado pela noite escura demais). A luz no chão
// vem do mesmo modelo do céu (sol, lua e céu na horizontal); com o sol a 45 graus ela vale pi e a exposição vale a
// chave (1,6): junto com o "look" do AgX (motor/pos.js), um chão de albedo 0,2 ao sol fica perto de 0,5 na tela, o
// asfalto perto de 0,3, a sombra perto de 0,13 e um telhado claro perto de 0,7, a faixa de uma foto aérea.
// Com o sol baixo a luz no chão horizontal é quase toda do céu, mas o fotógrafo mede pela fachada ao sol: a medida é a
// maior entre a luz no chão e uma parte da luz direta do sol (solMedida), e a hora dourada fica mais escura e quente,
// com as fachadas ao sol acesas e a sombra funda, em vez de a exposição subir e lavar a névoa. Com 0,42 as 17h30 do
// equinócio (sol a 9 graus) expõem 9,8: a fachada ao sol perto de 0,7 na tela e o chão à sombra ainda legível.
// A troca é suave (constante de 1 s real); um salto grande (cena nova, hora forçada) vai direto. Também dá o limiar
// do bloom: 1,1 de dia (só o sol refletido e o céu estourado) e 0,8 de noite (janelas, postes, faróis).
// Com o sol baixo a luz do ambiente cai (VIS1d, ceu.js, AMBIENTE_SOL_BAIXO: o fator kAmb do estado do céu) e a
// exposição devolve uma parte dela: abre por kAmb elevado a -`ambiente` (com o mínimo de 0,28, 1,66 vez), por cima do
// teto (às 17h30 a conta já pede 10,3 e o fim da tarde chega ao teto; a noite não muda, kAmb vale 1). A sombra longa
// escurece bem mais que o chão ao sol, e a cena não apaga: o chão ao sol fica perto do que era (o sol rasante dá pouco
// ao chão, que vivia do céu) e a fachada ao sol, mais acesa, fica abaixo do mais claro de antes na aérea (o céu e o mar
// eram o mais claro).

export const EXPOSICAO = Object.freeze({ referencia: Math.PI, chave: 1.6, gama: 0.75, minima: 0.5, maxima: 14, constante: 1, solMedida: 0.42, ambiente: 0.4 });

const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Luz medida para a exposição: a do chão ou a parte da luz direta do sol, a maior. */
export const luzMedida = (est, E = EXPOSICAO) => Math.max(est.eChao, est.solIrr ? E.solMedida * luma(est.solIrr) : 0);

/** O quanto a exposição abre com a luz do ambiente baixada pelo sol baixo (kAmb do estado do céu; 1 sem ele). */
export const aberturaAmbiente = (est, E = EXPOSICAO) => (est.kAmb ?? 1) ** -E.ambiente;

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
    this.alvo = this.fixa ?? exposicaoAlvo(luzMedida(est)) * aberturaAmbiente(est);
    const salto = Math.abs(Math.log2(this.alvo / this.valor));
    if (!(dt > 0) || salto > 1.5) this.valor = this.alvo;
    else this.valor *= (this.alvo / this.valor) ** (1 - Math.exp(-dt / EXPOSICAO.constante));
    this.limiarBloom = 1.1 - 0.3 * est.noite;
  }
}

export function registrar() {}
