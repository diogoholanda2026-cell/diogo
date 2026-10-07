// Peças puras do gesto de câmera (TOQ1, D99): limiares do árbitro para o dedo no vidro de 6,7 polegadas, a velocidade
// de soltura medida no tempo real dos eventos, o teto do deslocamento de um quadro e a conversão das preferências do
// toque em opções da entrada. Sem three e sem DOM: roda no Node (ferramentas/testes/toque.teste.mjs).

/**
 * Limiares do árbitro (ui.md 9.1), em px CSS (no Android o px CSS é o dp: 64 px por cm no Poco X7).
 * toquePx 10 (era 8): o dedo rola ao tocar e um toque para selecionar não pode virar arrasto. A pinça entra com o
 * maior entre 18 px e 10% do vão inicial dos dois dedos, e o giro com o maior entre 8 graus e 14 px de arco (o arco é
 * o raio, metade do vão, vezes o ângulo): dois dedos que andam juntos nunca andam iguais (um fica uns 10% para trás), e
 * 12 px de pinça ou 6 graus de giro eram só isso, o que fazia um arrasto de dois dedos virar zoom e giro sem querer.
 */
export const GESTOS = Object.freeze({
  decidirMs: 80, toqueMs: 250, toquePx: 10, longoMs: 450, pincaPx: 18, pincaFracao: 0.1, giroGraus: 8, giroArcoPx: 14,
  dominio: 0.3, andarPx: 6, mousePx: 3, margemBaixoPx: 12,
});

/** Velocidade de soltura e teto do quadro (px de tela por segundo e por quadro). */
export const SOLTURA = Object.freeze({
  janelaMs: 100, // as amostras dos últimos 100 ms (hardware) entram no ajuste
  paradoMs: 80, // o dedo parou antes de soltar: sem deslize
  minPxS: 60, // abaixo disto o deslize não vale a pena
  maxPxS: 3000, // teto do dedo (o fling do Android chega a 8000, mas na tela de 986 px de largura isso é arremesso)
  tetoQuadro: 1.6, // o ponto preso não anda mais que 1,6 vez o que o dedo andou no quadro...
  folgaQuadroPx: 12, // ...mais esta folga
});

/** Valores padrão do toque (padrão bom sem mexer em nada); as escolhas das Configurações ficam em ui/inicio/corpo/Toque.jsx. */
export const TOQUE_PADRAO = Object.freeze({ arrasto: 1, pinca: 1, giro: 1, inercia: false });

const noIntervalo = (v, a, b, padrao) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : padrao);

/**
 * Opções da entrada a partir das preferências do jogador (prefs.toqueArrasto, toquePinca, toqueGiro, toqueInercia).
 * Valor torto vale o padrão; a sensibilidade fica entre 0,4 e 2.
 */
export function opcoesDoToque(prefs = {}) {
  return {
    sensArrasto: noIntervalo(prefs.toqueArrasto, 0.4, 2, TOQUE_PADRAO.arrasto),
    sensPinca: noIntervalo(prefs.toquePinca, 0.4, 2, TOQUE_PADRAO.pinca),
    sensGiro: noIntervalo(prefs.toqueGiro, 0.4, 2, TOQUE_PADRAO.giro),
    inercia: prefs.toqueInercia === true,
  };
}

/** Pinça: quanto o vão dos dedos precisa mudar para virar zoom (px). */
export const limiarPinca = (d0) => Math.max(GESTOS.pincaPx, GESTOS.pincaFracao * d0);

/** Giro: quanto o ângulo entre os dedos precisa mudar para virar giro (graus). */
export function limiarGiro(d0) {
  const raio = Math.max(20, d0 / 2);
  return Math.min(30, Math.max(GESTOS.giroGraus, (GESTOS.giroArcoPx / raio) * (180 / Math.PI)));
}

/**
 * Amostras do dedo (tempo do hardware em ms, px) para medir a velocidade de soltura. Com quadros lentos chega um
 * pointermove por quadro (os outros vêm em getCoalescedEvents): as amostras trazem o tempo de cada um, e a velocidade
 * sai do ajuste de uma reta por mínimos quadrados nos últimos 100 ms, nunca do tempo do quadro.
 */
export class Rastro {
  constructor(max = 24) {
    this.max = max;
    this.a = [];
  }

  limpar() {
    this.a.length = 0;
  }

  /** Acrescenta uma amostra (o mesmo instante troca a anterior; tempo para trás é ignorado). */
  push(t, x, y) {
    if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const a = this.a;
    const u = a[a.length - 1];
    if (u) {
      if (t < u.t) return;
      if (t === u.t) {
        u.x = x;
        u.y = y;
        return;
      }
    }
    a.push({ t, x, y });
    if (a.length > this.max) a.shift();
  }

  /**
   * Velocidade do dedo em px/s na hora t da soltura: { vx, vy } (parado: zeros) ou null sem amostras que bastem.
   * Pelo menos 12 ms de movimento; com uma amostra só na janela (quadro lento sem eventos coalescidos) usa a anterior.
   */
  velocidade(t, { janelaMs = SOLTURA.janelaMs, paradoMs = SOLTURA.paradoMs } = {}) {
    const a = this.a;
    if (a.length < 2) return null;
    const u = a[a.length - 1];
    if (t - u.t > paradoMs) return { vx: 0, vy: 0 };
    let w = a.filter((s) => s.t >= u.t - janelaMs);
    if (w.length < 2) w = a.slice(-2);
    if (w[w.length - 1].t - w[0].t < 12) {
      // amostras coladas (dois eventos no mesmo quadro): estende a janela até pegar um intervalo que dê para medir
      const k = a.findIndex((s) => s.t >= u.t - 2 * janelaMs && u.t - s.t >= 12);
      if (k < 0) return null;
      w = a.slice(k);
    }
    const n = w.length;
    let st = 0;
    let sx = 0;
    let sy = 0;
    for (const s of w) {
      st += s.t;
      sx += s.x;
      sy += s.y;
    }
    const mt = st / n;
    const mx = sx / n;
    const my = sy / n;
    let num1 = 0;
    let num2 = 0;
    let den = 0;
    for (const s of w) {
      const dt = s.t - mt;
      num1 += dt * (s.x - mx);
      num2 += dt * (s.y - my);
      den += dt * dt;
    }
    if (!(den > 0)) return null;
    return { vx: (num1 / den) * 1000, vy: (num2 / den) * 1000 };
  }
}

/** Limita o vetor (vx, vy) a no máximo m de comprimento. */
export function limitarVetor(vx, vy, m) {
  const c = Math.hypot(vx, vy);
  if (!(c > m) || !(c > 0)) return [vx, vy];
  return [(vx * m) / c, (vy * m) / c];
}

/**
 * Teto do deslocamento da câmera num quadro, em metros: o ponto preso sob o dedo não anda mais que 1,6 vez o que o
 * dedo andou (mais 12 px de folga), na escala de metros por px do chão sob o dedo (a maior do quadro e do anterior:
 * um dedo que desce da parte de cima da tela, onde o px vale mais, anda a média). O que passar do teto fica para o
 * quadro seguinte (o ponto preso alcança o dedo em poucos quadros, sem pulo).
 */
export function tetoDoQuadro(dedoPx, mPorPxAgora, mPorPxAntes = 0) {
  const m = Math.max(mPorPxAgora || 0, mPorPxAntes || 0);
  return SOLTURA.tetoQuadro * (dedoPx + SOLTURA.folgaQuadroPx) * m;
}

/** Reduz (dx, dz) ao teto, mantendo a direção. Devolve [dx, dz, limitou]. */
export function aplicarTeto(dx, dz, teto) {
  const c = Math.hypot(dx, dz);
  if (!(c > teto) || !(teto >= 0) || !(c > 0)) return [dx, dz, false];
  return [(dx * teto) / c, (dz * teto) / c, true];
}

/**
 * Metros do chão por px de tela no ponto p, visto da câmera em cp: o tamanho angular de um px vezes a distância,
 * esticado pela inclinação do raio sobre o chão (no máximo 11 vezes: perto do horizonte o px vale muito).
 */
export function metrosPorPxEm(cp, p, fovGraus, altTela) {
  const dx = p[0] - cp.x;
  const dy = p[1] - cp.y;
  const dz = p[2] - cp.z;
  const dist = Math.hypot(dx, dy, dz);
  if (!(dist > 0) || !(altTela > 0)) return 0;
  const sen = Math.max(Math.sin((5 * Math.PI) / 180), Math.min(1, -dy / dist));
  return ((2 * dist * Math.tan((fovGraus * Math.PI) / 360)) / altTela) / sen;
}

const RAD = Math.PI / 180;

/**
 * A mudança do vão dos dedos vale como pinça? Passou do limiar e não é só um dedo que ficou atrás: a mudança do vão
 * precisa ser pelo menos 30% do que o meio dos dedos andou (`viaja`, px), senão é um arrasto de dois dedos.
 * @param {number} dVao  vão agora menos o vão do começo (px)
 * @param {number} d0  o vão do começo
 * @param {number} viaja  quanto o meio dos dedos andou desde o começo (px)
 */
export const ehPinca = (dVao, d0, viaja) => Math.abs(dVao) > limiarPinca(d0) && Math.abs(dVao) > GESTOS.dominio * viaja;

/** A mudança do ângulo vale como giro? Passou do limiar e o arco que ela faz (o raio vezes o ângulo) é 30% do que o meio andou. */
export function ehGiro(dGraus, d0, viaja) {
  const g = Math.abs(dGraus);
  return g > limiarGiro(d0) && Math.max(20, d0 / 2) * g * RAD > GESTOS.dominio * viaja;
}

/**
 * Onde o limiar da pinça foi cruzado no caminho dos dedos (a mudança do vão, com o sinal de dVao), para a referência do
 * zoom: com quadros lentos o quadro vê a mudança já bem além do limiar, e a vista não deve perder o caminho até ali.
 * É o limiar (o maior entre o fixo e os 30% do que o meio andou), no máximo a mudança de agora.
 */
export function pontoDaPinca(dVao, d0, viaja) {
  const lim = Math.max(limiarPinca(d0), GESTOS.dominio * viaja);
  return Math.sign(dVao) * Math.min(Math.abs(dVao), lim);
}

/** O mesmo para o giro: o ângulo (graus, com o sinal de dGraus) em que o limiar foi cruzado. */
export function pontoDoGiro(dGraus, d0, viaja) {
  const raio = Math.max(20, d0 / 2);
  const lim = Math.max(limiarGiro(d0), (GESTOS.dominio * viaja) / raio / RAD);
  return Math.sign(dGraus) * Math.min(Math.abs(dGraus), lim);
}
