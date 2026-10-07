// A água da sede v4 (D97): o Mirror Lake grande (de 150 a uns 330 m, com 4 ilhas de mata, 4 enseadas e 8 pontes baixas de
// pedra), o anel d'água do pódio (uma bacia à altura do chão, com o coroamento de granito, as fontes e as duas quedas do
// pódio), o Halo Lake (a faixa d'água de 50 m ao pé da face de dentro do Horizon Ring, cortada pelas avenidas, como o lago
// da McLaren) e as 4 Dream Falls de 120 m (cortinas do teto do Meridian Ring para as enseadas, com a névoa e a espuma na
// base e a luz de baixo à noite).
//
// O Mirror Lake grande é cavado no relevo (a cava do plano, data/arcologia-plano.js: lago.js a aplica nas cenas e a X1b no
// jogo): a água é só o plano em cota - 0,6 m, e as ilhas, as margens e o leito são o próprio chão. As bacias (o anel do
// pódio e o Halo Lake) ficam à altura do chão, com 0,3 m de água dentro de um coroamento de 0,65 m, e não cavam nada.
import { acab, PADRAO, LUZ, CASCATA, cascaEfeito, caixa } from './torre.js';
import { noArco, paredeArco, faixaArco, testaArco, faixaEntre } from './arcos.js';
import { MIRROR, CORREDOR_AVENIDA, raioDaMargem } from '../../data/arcologia-plano.js';

const RAD = Math.PI / 180;

const K = {
  granito: acab('#77716a', { rugo: 0.6, padrao: PADRAO.pedra }),
  pedraClara: acab('#bdb3a1', { rugo: 0.72, padrao: PADRAO.pedra }),
  pedraPonte: acab('#a99f8c', { rugo: 0.7, padrao: PADRAO.pedra }),
  arcoEscuro: acab('#2b2925', { rugo: 0.9 }),
  bronze: acab('#cbbb9d', { rugo: 0.45, metal: 0.8, padrao: PADRAO.metal }),
  forro: acab('#d8d4ca', { rugo: 0.6, luz: LUZ.marquise }),
  calcada: acab('#a39c90', { rugo: 0.8, padrao: PADRAO.piso }),
  asfalto: acab('#2c2e31', { rugo: 0.85 }),
  canteiro: acab('#46532f', { rugo: 0.95, padrao: PADRAO.grama }),
};

/** Círculo (pares x, z) de raio r em n passos de 360/n graus a partir de a0 (graus). */
const circulo = (cx, cz, r, n, a0 = 0) => Array.from({ length: n }, (_, i) => noArco(cx, cz, r, a0 + (360 * i) / n)).flat();

/** Faixa aberta entre duas polilinhas de mesmo tamanho (a de faixaEntre fecha a volta). */
function faixaAberta(m, A, B, y, k, cima = true) {
  const n = A.length / 2;
  const ny = cima ? 1 : -1;
  for (let i = 0; i + 1 < n; i++) {
    const j = i + 1;
    m.quad([A[2 * i], y, A[2 * i + 1]], [A[2 * j], y, A[2 * j + 1]], [B[2 * j], y, B[2 * j + 1]], [B[2 * i], y, B[2 * i + 1]], [0, ny, 0], [A[2 * i], A[2 * i + 1]], [A[2 * j], A[2 * j + 1]], [B[2 * j], B[2 * j + 1]], [B[2 * i], B[2 * i + 1]], k);
  }
}

// ------------------------------------------------------------------------------------------------ Mirror Lake grande

/**
 * Ponte baixa de pedra (D97) de uma avenida sobre o lago: a laje à altura da pista (de 150 m, o cais da praça, até a margem
 * mais uns 8 m), a fachada de pedra até o leito com os arcos cegos na altura d'água, o guarda-corpo de granito e a pista
 * de 24 m (calçada, duas faixas e o canteiro do meio, onde a avenida tem as palmeiras-imperiais). No jogo a avenida é um
 * aterro no chão (o aplainar da via vence a cava), e a ponte o veste.
 */
function ponteBaixa(g, cx, cz, yc, angulo, r0, r1, nivel, fundo) {
  const a = angulo * RAD;
  const ux = Math.cos(a);
  const uz = Math.sin(a);
  const lx = -uz;
  const lz = ux;
  const P = (s, v, y) => [cx + ux * s + lx * v, y, cz + uz * s + lz * v];
  const topo = yc + 0.3;
  const sm = (r0 + r1) / 2;
  const c = P(sm, 0, 0);
  // a laje maciça com a fachada de pedra até o leito (a base fica dentro do chão cavado)
  caixa(g.opaco, c[0], c[2], (r1 - r0) / 2, 12.3, yc + fundo, topo, K.pedraPonte, { ux, uz, topo: false });
  const camada = (s0, s1, v0, v1, y, k) => g.opaco.quad(P(s0, v0, y), P(s1, v0, y), P(s1, v1, y), P(s0, v1, y), [0, 1, 0], [P(s0, v0, 0)[0], P(s0, v0, 0)[2]], [P(s1, v0, 0)[0], P(s1, v0, 0)[2]], [P(s1, v1, 0)[0], P(s1, v1, 0)[2]], [P(s0, v1, 0)[0], P(s0, v1, 0)[2]], k);
  camada(r0, r1, -12, 12, topo + 0.01, K.calcada);
  camada(r0, r1, -10, -3.5, topo + 0.03, K.asfalto);
  camada(r0, r1, 3.5, 10, topo + 0.03, K.asfalto);
  camada(r0, r1, -2, 2, topo + 0.06, K.canteiro);
  // o guarda-corpo de granito dos dois lados
  for (const sd of [-1, 1]) {
    const q = P(sm, sd * 12, 0);
    caixa(g.opaco, q[0], q[2], (r1 - r0) / 2, 0.35, topo, topo + 1, K.granito, { ux, uz });
  }
  // os arcos cegos da fachada (os vãos d'água), de 14 em 14 m: um trapézio escuro do nível d'água para cima
  const nA = Math.max(1, Math.floor((r1 - r0 - 6) / 14));
  const yAgua = nivel - 0.25;
  for (let i = 0; i < nA; i++) {
    const s = r0 + 8 + ((r1 - r0 - 16) * (i + 0.5)) / nA;
    for (const sd of [-1, 1]) {
      const v = sd * 12.34;
      const n = [lx * sd, 0, lz * sd];
      g.opaco.quad(P(s - 4.6, v, yAgua), P(s + 4.6, v, yAgua), P(s + 3.4, v, yAgua + 1.25), P(s - 3.4, v, yAgua + 1.25), n, [0, 0], [9.2, 0], [8.2, 1.25], [1, 1.25], K.arcoEscuro);
    }
  }
  // as palmeiras-imperiais no canteiro do meio, de 14 em 14 m (a avenida tem as mesmas)
  if (g.arvores) {
    for (let s = r0 + 10; s < r1 - 6; s += 14) {
      const q = P(s, 0, topo + 0.1);
      g.arvores.push({ x: q[0], y: q[1], z: q[2], especie: 'palmeira', altura: 17 + 4 * ((Math.round(s) % 5) / 5), giro: (s * 1.7) % 6.28 });
    }
  }
}

/**
 * O Mirror Lake grande: o plano d'água do cais da praça (150 m) até a margem ondulada (com as 4 enseadas), o muro do cais
 * da praça, as 8 pontes baixas de pedra e as caixas de seleção. As ilhas e as margens são o chão (a cava). Sem a cava
 * (g.fantasma) é o holograma do espelho prometido logo acima do chão.
 */
function lago(g, p) {
  const { cx, cz, r0 } = p;
  const yc = g.chao(cx, cz);
  const nivel = g.nivelLago ?? yc + p.nivel;
  const N = 180;
  const dentro = circulo(cx, cz, r0, N);
  const fora = Array.from({ length: N }, (_, i) => noArco(cx, cz, raioDaMargem((360 * i) / N) + 3, (360 * i) / N)).flat();
  if (g.sombra) return;
  // caixas de seleção: oito quadrados sobre o Mirror Lake
  for (let q = 0; q < 8; q++) {
    const [x, z] = noArco(cx, cz, 240, 22.5 + 45 * q);
    g.caixa([x, yc + p.fundo, z], 100, 4);
  }
  if (g.fantasma) {
    faixaEntre(g.opaco, dentro, fora, yc + 0.4, [0, 0, 0, 0], true);
    return;
  }
  faixaEntre(g.agua, dentro, fora, nivel, [0, 0, 0, 0], true);
  // o muro do cais da praça: do leito ao chão da praça, virado para a água, com o coroamento de pedra clara
  const nM = 120;
  for (let i = 0; i < nM; i++) {
    const a0 = (360 * i) / nM;
    const a1 = (360 * (i + 1)) / nM;
    paredeArco(g.opaco, cx, cz, yc, r0, a0, a1, p.fundo, 0.26, K.granito, 1);
    faixaArco(g.opaco, cx, cz, r0 - 0.9, r0, a0, a1, yc + 0.27, K.pedraClara, true);
  }
  for (const ang of p.pontes ?? []) ponteBaixa(g, cx, cz, yc, ang, r0 - 0.5, raioDaMargem(ang) + 8, nivel, p.fundo);
}

// ------------------------------------------------------------------------------------------------ bacias

/**
 * Bacia d'água à altura do chão (D97), com o coroamento de granito: o anel d'água do pódio (`forma: 'anel'`, a volta
 * inteira, com as fontes e as duas quedas do pódio) e cada pedaço do Halo Lake (de `de` a `ate`, cortado pelas avenidas:
 * a água não entra no corredor de 28 m delas, e na avenida da ponte o guarda-corpo de granito acompanha a pista).
 */
function bacia(g, p) {
  const { cx, cz, r0, r1 } = p;
  const yc = g.chao(cx, cz);
  const nivel = g.nivelBacia ?? yc + p.nivel;
  const topo = yc + p.coroamento;
  const anel = p.forma === 'anel';
  if (g.sombra) return;
  if (anel) {
    // caixas de seleção: oito quadrados sobre o anel d'água do pódio
    for (let q = 0; q < 8; q++) {
      const [x, z] = noArco(cx, cz, (r0 + r1) / 2, 22.5 + 45 * q);
      g.caixa([x, nivel, z], 12, 4, 12);
    }
    const N = 120;
    const A = circulo(cx, cz, r0, N);
    const B = circulo(cx, cz, r1, N);
    if (g.fantasma) {
      faixaEntre(g.opaco, A, B, yc + 0.4, [0, 0, 0, 0], true);
      return;
    }
    faixaEntre(g.agua, A, B, nivel, [0, 0, 0, 0], true);
    // o coroamento: o muro de fora da bacia, o topo de pedra e a pedra clara até o chão da floresta
    for (let i = 0; i < N; i++) {
      const a0 = (360 * i) / N;
      const a1 = (360 * (i + 1)) / N;
      paredeArco(g.opaco, cx, cz, yc, r1, a0, a1, 0, p.coroamento, K.granito, 1);
      faixaArco(g.opaco, cx, cz, r1, r1 + 1.6, a0, a1, topo, K.pedraClara, true);
    }
    return;
  }
  // o Halo Lake: um pedaço de anel entre as avenidas
  const meia = (r) => Math.asin(Math.min(1, CORREDOR_AVENIDA / r)) / RAD;
  const n = Math.max(2, Math.round((p.ate - p.de) / 3));
  const ang = (r, i) => p.de + meia(r) + ((p.ate - p.de - 2 * meia(r)) * i) / n;
  const arco = (r) => Array.from({ length: n + 1 }, (_, i) => noArco(cx, cz, r, ang(r, i))).flat();
  // caixa de seleção do pedaço: sobre a água, no meio dele
  {
    const [mx, mz] = noArco(cx, cz, (r0 + r1) / 2, (p.de + p.ate) / 2);
    g.caixa([mx, nivel, mz], 30, 4, 30);
  }
  if (g.fantasma) {
    faixaAberta(g.opaco, arco(r0), arco(r1), yc + 0.4, [0, 0, 0, 0], true);
    return;
  }
  faixaAberta(g.agua, arco(r0), arco(r1), nivel, [0, 0, 0, 0], true);
  // os muros de dentro e de fora, o topo de granito e as pontas junto das avenidas
  for (const [r, sinal] of [[r1, 1], [r0, -1]]) {
    for (let i = 0; i < n; i++) {
      const a0 = ang(r, i);
      const a1 = ang(r, i + 1);
      paredeArco(g.opaco, cx, cz, yc, r, a0, a1, 0, p.coroamento, K.granito, sinal);
      faixaArco(g.opaco, cx, cz, sinal > 0 ? r : r - 0.6, sinal > 0 ? r + 0.6 : r, a0, a1, topo, K.pedraClara, true);
    }
  }
  // as pontas junto das avenidas: o muro e o topo ao longo da linha do corredor (o muro olha para a avenida)
  for (const lado of [1, -1]) {
    const a = (lado > 0 ? p.de : p.ate) * RAD;
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const lx = -uz;
    const lz = ux;
    const PQ = (r, v) => {
      const s = Math.sqrt(Math.max(0, r * r - v * v));
      return [cx + ux * s + lx * v, cz + uz * s + lz * v];
    };
    const v = lado * CORREDOR_AVENIDA;
    const [ax, az] = PQ(r0 - 0.6, v);
    const [bx, bz] = PQ(r1 + 0.6, v);
    const L = Math.hypot(bx - ax, bz - az);
    g.opaco.quad([ax, yc, az], [bx, yc, bz], [bx, topo, bz], [ax, topo, az], [-lado * lx, 0, -lado * lz], [0, 0], [L, 0], [L, p.coroamento], [0, p.coroamento], K.granito);
    const [cx0, cz0] = PQ(r0 - 0.6, v - lado * 0.6);
    const [dx0, dz0] = PQ(r1 + 0.6, v - lado * 0.6);
    g.opaco.quad([ax, topo, az], [bx, topo, bz], [dx0, topo, dz0], [cx0, topo, cz0], [0, 1, 0], [ax, az], [bx, bz], [dx0, dz0], [cx0, cz0], K.pedraClara);
  }
  // o guarda-corpo de granito da avenida da ponte (só no começo do trecho, para não repetir no seguinte): dois muros baixos
  // ao longo da pista, de 12,4 m do eixo, a cada lado
  if (p.ponte !== false) {
    const a = p.de * RAD;
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const sm = (r0 + r1) / 2;
    const L = r1 - r0 + 1.2;
    for (const sd of [-1, 1]) {
      const q = [cx + ux * sm - uz * sd * 12.4, cz + uz * sm + ux * sd * 12.4];
      caixa(g.opaco, q[0], q[1], L / 2, 0.3, yc, yc + 0.95, K.granito, { ux, uz });
    }
  }
}

// ------------------------------------------------------------------------------------------------ Dream Falls (120 m)

/**
 * Dream Falls (D97): uma das 4 cortinas de 120 m do teto do Meridian Ring para a enseada do Mirror Lake. A lâmina sai do
 * bico de bronze em balanço no teto (a uns 4 m do vidro, passando as marquises) e pousa `recuo` m à frente dele, em 14 x
 * 16 células com a borda macia (vC.z), a película corre no canal do teto até o bico, a espuma se espalha no lago e a névoa
 * sobe em duas cascas (o sombreador da cascata anima tudo; à noite a luz sobe do pé). No material 'cascata'.
 */
function queda(g, p) {
  const { cx, cz, angulo, largura, altura: H, rTopo } = p;
  const yc = g.chao(cx, cz);
  const nivel = g.nivelLago ?? yc + MIRROR.nivel;
  const recuo = 8;
  const rPouso = rTopo - recuo;
  const meia = (largura / 2 / rTopo) / RAD;
  const a0 = angulo - meia;
  const a1 = angulo + meia;
  const [mx, mz] = noArco(cx, cz, rPouso, angulo);
  if (g.fantasma || g.sombra || !g.efeitos) {
    g.caixa([mx, nivel, mz], largura / 2 + 6, H + 2, largura / 2 + 6);
    return;
  }
  const fase = 0.29 * (p.id ? Number(p.id.slice(-1)) : 0);
  const yTopo = yc + H + 0.2;
  // a lâmina: de cima ao lago; o raio diminui com o quadrado da queda (a parábola da água que sai do bico, para o lago)
  const nA = 14;
  const nV = 16;
  const base = g.efeitos.vertices;
  for (let j = 0; j <= nV; j++) {
    const t = j / nV;
    const yy = yTopo - (yTopo - nivel) * t;
    const r = rTopo - recuo * t * t;
    for (let i = 0; i <= nA; i++) {
      const a = a0 + ((a1 - a0) * i) / nA;
      const c = Math.cos(a * RAD);
      const s = Math.sin(a * RAD);
      g.efeitos.v(cx + r * c, yy, cz + r * s, -c, 0, -s, rTopo * a * RAD, yTopo - yy, [CASCATA.lamina, fase, 1 + i / nA, 0]);
    }
  }
  const Lv = nA + 1;
  for (let j = 0; j < nV; j++) {
    for (let i = 0; i < nA; i++) {
      const q = base + j * Lv + i;
      g.efeitos.tri(q, q + 1, q + Lv + 1);
      g.efeitos.tri(q, q + Lv + 1, q + Lv);
    }
  }
  // a película do canal do teto até o bico e a espuma no lago (uv: metros ao longo, distância à linha de partida)
  const w = [CASCATA.faixa, fase, 0, 0];
  const e = [CASCATA.espuma, fase, 0, 0];
  const nS = 8;
  for (let i = 0; i < nS; i++) {
    const b0 = a0 + ((a1 - a0) * i) / nS;
    const b1 = a0 + ((a1 - a0) * (i + 1)) / nS;
    const P = [[rTopo + 11, b0], [rTopo + 11, b1], [rTopo, b1], [rTopo, b0]].map(([r, a]) => noArco(cx, cz, r, a));
    g.efeitos.quad(...P.map(([x, z]) => [x, yTopo + 0.2, z]), [0, 1, 0], [0, 0], [rTopo * (b1 - b0) * RAD, 0], [rTopo * (b1 - b0) * RAD, 11], [0, 11], w);
    const Q = [[rPouso + 3, b0], [rPouso + 3, b1], [rPouso - 13, b1], [rPouso - 13, b0]].map(([r, a]) => noArco(cx, cz, r, a));
    g.efeitos.quad(...Q.map(([x, z]) => [x, nivel + 0.06, z]), [0, 1, 0], [rPouso * b0 * RAD, -3], [rPouso * b1 * RAD, -3], [rPouso * b1 * RAD, 13], [rPouso * b0 * RAD, 13], e);
  }
  // a névoa: duas cascas que se abrem para o lago
  const am0 = (a0 - 1.2) * RAD;
  const am1 = (a1 + 1.2) * RAD;
  cascaEfeito(g.efeitos, cx, cz, nivel, nivel + 38, rPouso + 3, rPouso - 14, 18, CASCATA.nevoa, 3, fase, am0, am1);
  cascaEfeito(g.efeitos, cx, cz, nivel, nivel + 18, rPouso + 4, rPouso - 9, 14, CASCATA.nevoa, 2, fase + 0.5, am0, am1);
  // o bico de bronze em balanço no teto, com o forro por baixo (a cobertura do anel acaba 2,4 m antes)
  const rBico = rTopo - 0.3;
  faixaArco(g.opaco, cx, cz, rBico, rTopo + 4.4, a0 - 0.15, a1 + 0.15, yc + H + 0.1, K.bronze, true);
  testaArco(g.opaco, cx, cz, rBico, a0 - 0.15, a1 + 0.15, yc + H - 0.9, yc + H + 0.5, K.bronze, -1);
  faixaArco(g.opaco, cx, cz, rBico, rTopo + 4.4, a0 - 0.15, a1 + 0.15, yc + H - 0.9, K.forro, false);
  g.caixa([mx, nivel, mz], largura / 2 + 6, H + 2, largura / 2 + 6);
}

/** Tipos de peça que viram malha aqui (a ponte é do pontes.js). */
export const PECAS_DE_AGUA = Object.freeze({ lago, bacia, reservatorio: bacia, queda });
