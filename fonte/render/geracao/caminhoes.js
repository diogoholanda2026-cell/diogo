// Caminhões da Holding (R3b, desenho do render 8; cabine refeita na VIS1b), puros: o caminhão médio de cabine avançada
// da frota brasileira (6x4, uns 8,6 m, como os de obra) com quatro carrocerias, pela carga da entrega:
//   basculante  caçamba de aço com o monte do material (brita, areia, argila, calcário), que sobe com a carga
//   carroceria  de madeira, com os paletes (tijolo, cimento, aço, vidro, madeira), um por unidade (até 10)
//   betoneira   o balão listrado que gira (concreto), com a calha e a caixa d'água
//   bau         a carroceria fechada (sem item)
// A cabine é a de um Mercedes-Benz Atego ou de um Volvo VM: frente lisa com o para-brisa inteiro deitado uns 12 graus,
// moldura preta e limpadores, painel da grade com as aletas, para-choque de plástico grafite com os faróis nas quinas,
// teto com a pala de sol, quinas arredondadas com normais suaves, janela da porta, retrovisores grandes em braço,
// degraus, para-lamas e o tanque. LOD0 com cabine, chassi, rodas duplas atrás, faróis e lanternas; LOD1 em caixas, com
// as pontas que acendem (o mesmo de antes). A frente olha para +z e a origem fica no chão, no meio. aParte2: a parte (PARTE_CAMINHAO) e, na carga, o índice do
// palete (1 a 10) ou 0 no monte. A cabine tem a cor da Holding (espelho.holding.cor) ou branca no frete contratado.
// Só a thread principal usa (sob demanda, mundo/caminhoes.js), com os trechos GLSL do material; não registra tipo na
// oficina.

import { superficie, tampa, norma, cruz, sub } from './veiculos.js';

/** Partes (aParte2.x no shader); as 10 primeiras como as dos carros. */
export const PARTE_CAMINHAO = Object.freeze({
  PINTURA: 0, VIDRO: 1, PRETO: 2, FAROL: 3, LANTERNA: 4, CROMADO: 5, ARO: 6, SOMBRA: 7, FRENTE: 8, TRASEIRA: 9,
  CACAMBA: 10, MADEIRA: 11, CARGA: 12, TAMBOR: 13, BAU: 14, PLASTICO: 15,
});
const P = PARTE_CAMINHAO;

/**
 * Medidas (m): comprimento, largura, altura da cabine, comprimento da cabine, piso da carroceria, raio da roda; a
 * cabine: meia largura, piso, base do para-brisa e o quanto ele deita para trás.
 */
export const CAMINHAO = Object.freeze({ c: 8.6, l: 2.5, h: 3.1, cab: 1.95, piso: 1.28, roda: 0.52, wc: 1.19, yCab: 1.1, yVidro: 1.95, deita: 0.2 });
/** Eixo do balão da betoneira (m): da frente (perto da cabine) ao bocal atrás, mais alto. */
export const TAMBOR = Object.freeze({ z0: 1.85, y0: 1.95, z1: -3.6, y1: 2.55 });
/** Carrocerias, na ordem das malhas. */
export const CORPOS = Object.freeze(['basculante', 'carroceria', 'betoneira', 'bau']);

/** Carroceria e cor da carga (sRGB) por item do catálogo. */
export const CARGAS = Object.freeze({
  brita: { corpo: 'basculante', cor: [126, 124, 120] },
  areia: { corpo: 'basculante', cor: [198, 170, 118] },
  argila: { corpo: 'basculante', cor: [150, 84, 54] },
  calcario: { corpo: 'basculante', cor: [214, 210, 200] },
  tijolo: { corpo: 'carroceria', cor: [176, 82, 50] },
  cimento: { corpo: 'carroceria', cor: [182, 182, 176] },
  aco: { corpo: 'carroceria', cor: [104, 110, 118] },
  vidro: { corpo: 'carroceria', cor: [150, 186, 196] },
  madeira: { corpo: 'carroceria', cor: [132, 92, 58] },
  serrada: { corpo: 'carroceria', cor: [196, 156, 104] },
  concreto: { corpo: 'betoneira', cor: [150, 150, 146] },
});
/** Carroceria e cor de um item (sem item, ou item novo: o baú). */
export const cargaDe = (item) => CARGAS[item] ?? { corpo: 'bau', cor: [200, 200, 196] };

/** Construtor de malha (sem índice compartilhado entre faces: cada face com a parte dela). */
class Malha {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.parte = [];
    this.idx = [];
  }

  get nv() {
    return this.pos.length / 3;
  }

  /** Polígono convexo plano, anti-horário visto de fora; ci: índice do palete (0 fora da carga); nors: normais suaves. */
  poli(pts, parte, ci = 0, nors = null) {
    const [a, b, c] = pts;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    let v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (let k = 3; Math.hypot(...n) < 1e-12 && k < pts.length; k++) {
      v = [pts[k][0] - a[0], pts[k][1] - a[1], pts[k][2] - a[2]];
      n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    }
    const l = Math.hypot(...n) || 1;
    const base = this.nv;
    pts.forEach((p, k) => {
      this.pos.push(p[0], p[1], p[2]);
      if (nors) this.nor.push(nors[k][0], nors[k][1], nors[k][2]);
      else this.nor.push(n[0] / l, n[1] / l, n[2] / l);
      this.parte.push(parte, ci);
    });
    for (let k = 1; k + 1 < pts.length; k++) this.idx.push(base, base + k, base + k + 1);
  }

  get tris() {
    return this.idx.length / 3;
  }

  fechar() {
    return { posicao: Float32Array.from(this.pos), normal: Float32Array.from(this.nor), parte: Float32Array.from(this.parte), indices: Uint16Array.from(this.idx), tris: this.idx.length / 3 };
  }
}

/** Caixa: os 4 lados e o topo (e o fundo, se pedir); partes do topo, da frente (+z) e de trás podem mudar. */
function caixa(M, x0, y0, z0, x1, y1, z1, parte, { topo = parte, frente = parte, tras = parte, fundo = false, ci = 0 } = {}) {
  M.poli([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], parte, ci);
  M.poli([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], parte, ci);
  if (topo !== null) M.poli([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], topo, ci);
  if (frente !== null) M.poli([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], frente, ci);
  if (tras !== null) M.poli([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], tras, ci);
  if (fundo) M.poli([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], parte, ci);
}

/** Caixa vista por dentro (paredes e piso com a face para dentro): o interior da caçamba aberta em cima. */
function caixaDentro(M, x0, y0, z0, x1, y1, z1, parte) {
  M.poli([[x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0]], parte);
  M.poli([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], parte);
  M.poli([[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], parte);
  M.poli([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], parte);
  M.poli([[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], parte);
}

/** Roda: cilindro de 8 lados no eixo x, com o aro de fora; dupla: mais larga (o par de pneus atrás). */
function roda(M, x, y, z, r, larg, lado) {
  const n = 8;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (Math.PI * 2 * k) / n + Math.PI / n;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const xf = x + (lado * larg) / 2;
  const xd = x - (lado * larg) / 2;
  for (let k = 0; k < n; k++) {
    const [z0, y0] = pts[k];
    const [z1, y1] = pts[(k + 1) % n];
    const q = [[xf, y + y0, z + z0], [xf, y + y1, z + z1], [xd, y + y1, z + z1], [xd, y + y0, z + z0]];
    // o pneu com a normal suave (redondo de perto)
    const nq = [[0, y0 / r, z0 / r], [0, y1 / r, z1 / r], [0, y1 / r, z1 / r], [0, y0 / r, z0 / r]];
    M.poli(lado > 0 ? q : [...q].reverse(), P.PRETO, 0, lado > 0 ? nq : [...nq].reverse());
  }
  const aro = pts.map(([zz, yy]) => [xf + lado * 0.004, y + yy * 0.58, z + zz * 0.58]);
  M.poli(lado > 0 ? [...aro].reverse() : aro, P.ARO);
}

/**
 * Cabine avançada (Atego, VM) com o chassi, as rodas, os faróis e as lanternas (comum às quatro carrocerias). A casca
 * da cabine é uma superfície com normais suaves (geracao/veiculos.js): as quinas arredondadas pegam a luz como chapa
 * curva, e o sol baixo não vira um bloco claro na frente lisa.
 */
function base(M) {
  const { c, l, h, cab, roda: r, wc, yCab: yp, yVidro: yv, deita } = CAMINHAO;
  const w = l / 2;
  const zF = c / 2;
  const zT = -c / 2;
  const zc = zF - cab;
  const yt = h - 0.1; // o teto (a pala de sol passa dele)
  // a frente: reta até a base do para-brisa e deitando para trás dali ao teto
  const zFr = (y) => zF - 0.02 - deita * Math.min(1, Math.max(0, (y - yv) / (yt - yv)));
  const S = { poli: (pts, p, nors) => M.poli(pts, p, 0, nors) };
  // casca: seções de trás para a frente (8 pontos, aberta embaixo); as da frente acompanham a inclinação e encolhem
  // nas quinas
  const sec = (enc, dz) => {
    const a = wc - enc;
    const pts = [[-a, yp], [-a, yv - 0.05], [-a + 0.04, yt - 0.12], [-a + 0.16, yt], [a - 0.16, yt], [a - 0.04, yt - 0.12], [a, yv - 0.05], [a, yp]];
    return pts.map(([x, y]) => [x, y, dz === null ? zc : zFr(y) - dz]);
  };
  const G = [sec(0, null), sec(0, 0.34), sec(0.05, 0.09), sec(0.17, 0)];
  const Nn = superficie(S, G, () => P.PINTURA);
  tampa(S, G[0], Nn[0], -1, () => P.PINTURA);
  // a frente lisa, em três faixas (reta embaixo, deitada em cima), com a borda misturada à das quinas
  const F = G[3];
  for (const q of [[0, 7, 6, 1], [1, 6, 5, 2], [2, 5, 4, 3]]) {
    const pts = q.map((i) => F[i]);
    const n = norma(cruz(sub(pts[1], pts[0]), sub(pts[3], pts[0])));
    S.poli(pts, P.PINTURA, q.map((i) => norma([n[0] + Nn[3][i][0] * 0.6, n[1] + Nn[3][i][1] * 0.6, n[2] + Nn[3][i][2] * 0.6])));
  }
  // peças na frente: um pouco para fora do plano dela (a normal da frente deitada)
  const sen = deita / Math.hypot(deita, yt - yv);
  const cos = (yt - yv) / Math.hypot(deita, yt - yv);
  const naFrente = (x, y, fora) => (y <= yv ? [x, y, zFr(y) + fora] : [x, y + fora * sen, zFr(y) + fora * cos]);
  const quadFrente = (x0, x1, y0, y1, parte, fora, x0t = x0, x1t = x1) => {
    M.poli([naFrente(x0, y0, fora), naFrente(x1, y0, fora), naFrente(x1t, y1, fora), naFrente(x0t, y1, fora)], parte);
  };
  // para-brisa inteiro: a moldura preta e o vidro por cima dela, com os dois limpadores parados embaixo
  const xv = wc - 0.24;
  quadFrente(-xv - 0.05, xv + 0.05, yv - 0.04, yt - 0.12, P.PRETO, 0.004, -xv + 0.02, xv - 0.02);
  quadFrente(-xv, xv, yv + 0.02, yt - 0.18, P.VIDRO, 0.008, -xv + 0.07, xv - 0.07);
  for (const x of [-0.62, 0.12]) quadFrente(x, x + 0.5, yv + 0.05, yv + 0.08, P.PRETO, 0.012, x + 0.03, x + 0.53);
  // painel da grade: aletas pretas largas entre o para-choque e o para-brisa, e a tomada de ar de baixo
  for (let k = 0; k < 4; k++) quadFrente(-0.78, 0.78, 1.3 + 0.13 * k, 1.37 + 0.13 * k, P.PRETO, 0.004);
  quadFrente(-0.92, 0.92, yp + 0.04, yp + 0.13, P.PRETO, 0.004);
  // pala de sol sobre o para-brisa
  caixa(M, -wc + 0.12, yt - 0.04, zFr(yt) - 0.1, wc - 0.12, yt + 0.06, zFr(yt) + 0.16, P.PRETO, { tras: null });
  // janelas das portas (o vidro desce até a base do para-brisa; a coluna da frente acompanha a quina)
  for (const s of [-1, 1]) {
    const xL = (y) => s * (wc + 0.006 - (0.04 * Math.max(0, y - (yv - 0.05))) / (yt - 0.12 - (yv - 0.05)));
    const y0 = yv + 0.02;
    const y1 = yt - 0.24;
    const q = [[xL(y0), y0, zF - 1.05], [xL(y0), y0, zFr(y0) - 0.42], [xL(y1), y1, zFr(y1) - 0.42], [xL(y1), y1, zF - 1.05]];
    M.poli(s > 0 ? q.reverse() : q, P.VIDRO);
  }
  M.corpo = M.idx.length;
  // para-choque de plástico grafite com os faróis nas quinas de cima e a placa no meio
  caixa(M, -w + 0.04, 0.42, zF - 0.1, w - 0.04, 0.95, zF + 0.14, P.PLASTICO, { tras: null });
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? w - 0.5 : -w + 0.12;
    M.poli([[x0, 0.72, zF + 0.145], [x0 + 0.38, 0.72, zF + 0.145], [x0 + 0.38, 0.9, zF + 0.145], [x0, 0.9, zF + 0.145]], P.FAROL);
  }
  M.poli([[-0.2, 0.5, zF + 0.145], [0.2, 0.5, zF + 0.145], [0.2, 0.63, zF + 0.145], [-0.2, 0.63, zF + 0.145]], P.CROMADO);
  // retrovisores: o braço que sai da coluna, o espelho grande e o de baixo (a face de trás espelhada)
  for (const s of [-1, 1]) {
    const xa = s * wc;
    const xb = s * (wc + 0.34);
    const zr = zFr(2.3) - 0.36;
    caixa(M, Math.min(xa, xb), 2.36, zr - 0.02, Math.max(xa, xb), 2.4, zr + 0.02, P.PRETO, { frente: null, tras: null });
    const xm0 = s * (wc + 0.3);
    const xm1 = s * (wc + 0.39);
    caixa(M, Math.min(xm0, xm1), 1.98, zr - 0.05, Math.max(xm0, xm1), 2.48, zr + 0.03, P.PRETO, { tras: P.CROMADO });
    caixa(M, Math.min(xm0, xm1), 1.78, zr - 0.04, Math.max(xm0, xm1), 1.94, zr + 0.03, P.PRETO, { tras: P.CROMADO });
  }
  // degraus da porta, à frente da roda dianteira
  for (const s of [-1, 1]) {
    const xa = s > 0 ? wc - 0.12 : -wc - 0.02;
    const xb = s > 0 ? wc + 0.02 : -wc + 0.12;
    for (const y of [0.55, 0.83]) caixa(M, xa, y, zF - 0.62, xb, y + 0.05, zF - 0.2, P.PRETO, { tras: null, frente: null });
  }
  caixa(M, w - 0.75, 0.48, zc - 1.0, w - 0.12, 0.98, zc - 0.25, P.CROMADO, { fundo: true });
  // chassi: as duas longarinas e a traseira com as lanternas
  for (const s of [-1, 1]) caixa(M, s * 0.42 - 0.08, 0.62, zT + 0.12, s * 0.42 + 0.08, 0.92, zc, P.PRETO, { topo: null });
  caixa(M, -w + 0.05, 0.62, zT, w - 0.05, 0.92, zT + 0.14, P.PRETO, { topo: null });
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? w - 0.42 : -w + 0.1;
    M.poli([[x0 + 0.32, 0.66, zT - 0.006], [x0, 0.66, zT - 0.006], [x0, 0.86, zT - 0.006], [x0 + 0.32, 0.86, zT - 0.006]], P.LANTERNA);
  }
  // rodas: a dianteira e o tandem de trás com pneus duplos; o para-lama da dianteira (meia-lua com o topo) e os de trás
  const zR1 = zT + 1.55;
  const zR2 = zT + 2.95;
  const zR0 = zF - 1.28;
  for (const s of [-1, 1]) {
    roda(M, s * (w - 0.18), r, zR0, r, 0.32, s);
    roda(M, s * (w - 0.28), r, zR1, r, 0.55, s);
    roda(M, s * (w - 0.28), r, zR2, r, 0.55, s);
    const n = 3;
    for (let k = 0; k < n; k++) {
      const a0 = (Math.PI * k) / n;
      const a1 = (Math.PI * (k + 1)) / n;
      const p = (a, rr, x) => [x, r + Math.sin(a) * rr, zR0 + Math.cos(a) * rr];
      const xo = s * (w - 0.01);
      const xi = s * (w - 0.36);
      const fora = [p(a0, r + 0.03, xo), p(a0, r + 0.12, xo), p(a1, r + 0.12, xo), p(a1, r + 0.03, xo)];
      M.poli(s > 0 ? fora : [...fora].reverse(), P.PRETO);
      const cima = [p(a0, r + 0.12, xo), p(a0, r + 0.12, xi), p(a1, r + 0.12, xi), p(a1, r + 0.12, xo)];
      M.poli(s > 0 ? cima : [...cima].reverse(), P.PRETO);
    }
    caixa(M, s > 0 ? w - 0.58 : -w + 0.02, 1.08, zR1 - 0.62, s > 0 ? w - 0.02 : -w + 0.58, 1.16, zR2 + 0.62, P.PRETO);
  }
  return { w, zF, zT, zc };
}

/** Monte do material dentro da caçamba: grade 4 x 6 com a crista no meio (o shader baixa pela carga). */
function monte(M, x0, x1, z0, z1, yBase, yBorda, yCrista) {
  const nx = 4;
  const nz = 6;
  const alt = (i, j) => {
    const u = i / nx;
    const v = j / nz;
    const b = Math.min(u, 1 - u) * 2;
    const c = Math.min(v, 1 - v) * 2;
    return yBorda + (yCrista - yBorda) * Math.sqrt(Math.max(0, b)) * Math.min(1, c * 1.6) - (b < 0.01 || c < 0.01 ? 0.05 : 0);
  };
  const P0 = (i, j) => [x0 + ((x1 - x0) * i) / nx, alt(i, j), z0 + ((z1 - z0) * j) / nz];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) M.poli([P0(i, j), P0(i, j + 1), P0(i + 1, j + 1), P0(i + 1, j)], P.CARGA);
  }
  void yBase;
}

function basculante(M, b) {
  const { w, zT, zc } = b;
  const y0 = CAMINHAO.piso;
  const y1 = 2.45;
  const z0 = zT + 0.05;
  const z1 = zc - 0.12;
  // a caçamba por fora (sem topo) e por dentro, com a borda de cima e os reforços
  caixa(M, -w, y0 - 0.12, z0, w, y1, z1, P.CACAMBA, { topo: null, fundo: true });
  caixaDentro(M, -w + 0.08, y0, z0 + 0.08, w - 0.08, y1, z1 - 0.08, P.CACAMBA);
  M.poli([[-w, y1, z0], [-w, y1, z1], [-w + 0.08, y1, z1 - 0.08], [-w + 0.08, y1, z0 + 0.08]], P.CACAMBA);
  M.poli([[w - 0.08, y1, z0 + 0.08], [w - 0.08, y1, z1 - 0.08], [w, y1, z1], [w, y1, z0]], P.CACAMBA);
  M.poli([[-w, y1, z1], [w, y1, z1], [w - 0.08, y1, z1 - 0.08], [-w + 0.08, y1, z1 - 0.08]], P.CACAMBA);
  M.poli([[w, y1, z0], [-w, y1, z0], [-w + 0.08, y1, z0 + 0.08], [w - 0.08, y1, z0 + 0.08]], P.CACAMBA);
  for (const s of [-1, 1]) for (let k = 1; k < 4; k++) caixa(M, s > 0 ? w : -w - 0.05, y0, z0 + ((z1 - z0) * k) / 4 - 0.06, s > 0 ? w + 0.05 : -w, y1 - 0.05, z0 + ((z1 - z0) * k) / 4 + 0.06, P.CACAMBA, { tras: null, frente: null });
  // a proteção da cabine (a aba de cima, para frente)
  M.poli([[-w + 0.1, y1, z1], [w - 0.1, y1, z1], [w - 0.1, y1 + 0.05, z1 + 0.55], [-w + 0.1, y1 + 0.05, z1 + 0.55]].reverse(), P.CACAMBA);
  monte(M, -w + 0.1, w - 0.1, z0 + 0.1, z1 - 0.1, y0, 2.15, 2.75);
}

function carroceria(M, b) {
  const { w, zT, zc } = b;
  const y0 = CAMINHAO.piso;
  const z0 = zT + 0.02;
  const z1 = zc - 0.1;
  caixa(M, -w, y0 - 0.18, z0, w, y0, z1, P.MADEIRA, { fundo: true });
  // guardas laterais de tábuas (duas faixas) e a cabeceira mais alta, de metal
  for (const s of [-1, 1]) {
    for (const [a, c] of [[y0 + 0.06, y0 + 0.3], [y0 + 0.38, y0 + 0.62]]) caixa(M, s > 0 ? w - 0.05 : -w, a, z0, s > 0 ? w : -w + 0.05, c, z1, P.MADEIRA);
  }
  caixa(M, -w, y0, z0, w, y0 + 0.62, z0 + 0.05, P.MADEIRA, { frente: null });
  caixa(M, -w, y0, z1 - 0.06, w, y0 + 1.5, z1, P.CACAMBA);
  // os paletes: 2 colunas x 5, de trás para a frente (o primeiro atrás da cabine), um por unidade
  const pz = (z1 - 0.12 - (z0 + 0.12)) / 5;
  let k = 1;
  for (let j = 4; j >= 0; j--) {
    for (const s of [-1, 1]) {
      const za = z0 + 0.12 + j * pz + 0.04;
      const xa = s > 0 ? 0.06 : -w + 0.14;
      const xb = s > 0 ? w - 0.14 : -0.06;
      // o estrado de madeira e a carga em cima
      caixa(M, xa, y0, za, xb, y0 + 0.14, za + pz - 0.08, P.MADEIRA, { topo: null, ci: k });
      caixa(M, xa + 0.03, y0 + 0.14, za + 0.03, xb - 0.03, y0 + 1.0, za + pz - 0.11, P.CARGA, { ci: k });
      k++;
    }
  }
}

function betoneira(M, b) {
  const { w, zT, zc } = b;
  // chassi auxiliar e a caixa d'água atrás da cabine
  caixa(M, -w + 0.3, 1.0, zT + 0.2, w - 0.3, 1.28, zc - 0.1, P.PRETO);
  caixa(M, -0.45, 1.28, zc - 0.75, 0.45, 2.3, zc - 0.12, P.CROMADO);
  // o balão: anéis em volta do eixo inclinado (10 lados), do fundo fechado ao bocal
  const T = TAMBOR;
  const ax = [0, T.y1 - T.y0, T.z1 - T.z0];
  const L = Math.hypot(ax[1], ax[2]);
  const d = [0, ax[1] / L, ax[2] / L];
  // dois vetores perpendiculares ao eixo: x e o "para cima" do eixo
  const e1 = [1, 0, 0];
  const e2 = [0, -d[2], d[1]];
  const perfil = [[0, 0.55], [0.08, 0.98], [0.42, 1.12], [0.72, 0.95], [0.95, 0.52], [1, 0.4]];
  const n = 10;
  const aneis = perfil.map(([f, r]) => {
    const c = [0, T.y0 + ax[1] * f, T.z0 + ax[2] * f];
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k) / n;
      out.push([c[0] + (e1[0] * Math.cos(a) + e2[0] * Math.sin(a)) * r, c[1] + (e1[1] * Math.cos(a) + e2[1] * Math.sin(a)) * r, c[2] + (e1[2] * Math.cos(a) + e2[2] * Math.sin(a)) * r]);
    }
    return out;
  });
  for (let k = 0; k + 1 < aneis.length; k++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      M.poli([aneis[k][i], aneis[k + 1][i], aneis[k + 1][j], aneis[k][j]], P.TAMBOR);
    }
  }
  M.poli([...aneis[0]], P.TAMBOR);
  M.poli([...aneis[aneis.length - 1]].reverse(), P.PRETO);
  // a calha e o funil atrás
  caixa(M, -0.32, 2.2, zT - 0.05, 0.32, 2.65, zT + 0.45, P.CROMADO);
  M.poli([[-0.2, 1.45, zT - 0.4], [0.2, 1.45, zT - 0.4], [0.2, 2.2, zT + 0.05], [-0.2, 2.2, zT + 0.05]].reverse(), P.PRETO);
  // os suportes do balão
  for (const zz of [zc - 0.4, zT + 1.0]) caixa(M, -0.7, 1.28, zz - 0.12, 0.7, 1.75, zz + 0.12, P.PRETO);
}

function bau(M, b) {
  const { w, zT, zc } = b;
  caixa(M, -w, CAMINHAO.piso - 0.1, zT + 0.02, w, 3.45, zc - 0.12, P.BAU, { fundo: true, tras: P.BAU });
  M.poli([[w - 0.02, 1.3, zT - 0.004], [-w + 0.02, 1.3, zT - 0.004], [-w + 0.02, 3.4, zT - 0.004], [w - 0.02, 3.4, zT - 0.004]], P.CROMADO);
}

/** Sombra de contato: o quadrilátero escuro no chão, um pouco maior que o caminhão. */
function sombra(M) {
  const w = CAMINHAO.l / 2 + 0.15;
  const c = CAMINHAO.c / 2 + 0.2;
  M.poli([[-w, 0.03, c], [w, 0.03, c], [w, 0.03, -c], [-w, 0.03, -c]], P.SOMBRA);
}

function caminhaoLOD0(corpo) {
  const M = new Malha();
  const b = base(M);
  ({ basculante, carroceria, betoneira, bau })[corpo](M, b);
  sombra(M);
  return M.fechar();
}

/** LOD1: a cabine e a carroceria em caixas, as pontas que acendem à noite e o monte (ou o balão) em cima. */
function caminhaoLOD1(corpo) {
  const M = new Malha();
  const { c, l, h, cab } = CAMINHAO;
  const w = l / 2;
  const zF = c / 2;
  const zT = -c / 2;
  const zc = zF - cab;
  caixa(M, -w, 0.5, zc, w, h, zF, P.PINTURA, { frente: P.FRENTE, tras: null });
  const parte = corpo === 'basculante' ? P.CACAMBA : corpo === 'carroceria' ? P.MADEIRA : corpo === 'betoneira' ? P.TAMBOR : P.BAU;
  const topo = corpo === 'bau' ? 3.45 : corpo === 'betoneira' ? 2.9 : corpo === 'carroceria' ? 2.25 : 2.45;
  caixa(M, -w, 0.5, zT, w, topo, zc - 0.1, parte, { tras: P.TRASEIRA, frente: null, topo: corpo === 'basculante' ? P.CARGA : corpo === 'carroceria' ? P.CARGA : parte });
  sombra(M);
  return M.fechar();
}

const cache = new Map();

/** Malha de uma carroceria ('basculante', 'carroceria', 'betoneira', 'bau') no LOD 0 ou 1. Guardada. */
export function malhaCaminhao(corpo, lod = 0) {
  if (!CORPOS.includes(corpo)) throw new Error(`carroceria desconhecida: ${corpo}`);
  const k = `${corpo}:${lod}`;
  if (!cache.has(k)) cache.set(k, lod ? caminhaoLOD1(corpo) : caminhaoLOD0(corpo));
  return cache.get(k);
}

// ------------------------------------------------------------------------------------------------ GLSL do material
// (aqui, e não em shaders/via.glsl.js, para virem sob demanda com o modelo; mundo/caminhoes.js monta o material)

/**
 * Caminhões da Holding (geracao/caminhoes.js, mundo/caminhoes.js): as partes dos carros e mais a caçamba, a madeira,
 * a carga (cor da instância; o monte baixa e os paletes somem pela quantidade), o balão da betoneira (gira em volta
 * do eixo, listrado com a cor da cabine), o baú e o plástico grafite do para-choque. A pintura é de verniz (0,36) e o
 * vidro reflete o céu (0,1): nada de espelho branco com o sol baixo. aCab: cor da cabine (sRGB 0 a 255) e as luzes (bit 0 farol, 1
 * freio) mais 4 vezes a fase do balão (0 a 63); aCarga: cor da carga e a quantidade (0 a 10 unidades).
 */
export const CAMINHAO_VERTICE_PARS = /* glsl */ `
attribute vec2 aParte2;
attribute vec4 aCab;
attribute vec4 aCarga;
flat varying vec4 vCab;
flat varying vec4 vCarga;
flat varying float vParte;
varying vec3 vCamLocal;      // x, y do modelo (as luzes do LOD1) e a coordenada das listras do balão
uniform float gCamTempo;     // s (o balão gira)
uniform vec4 gCamTambor;     // eixo do balão: y0, z0, y1, z1
uniform float gCamPiso;      // piso da carroceria (o monte baixa até ele)
vec3 camGira( vec3 p, vec3 o, vec3 d, float a ) {
  vec3 v = p - o;
  float c = cos( a );
  float s = sin( a );
  return o + v * c + cross( d, v ) * s + d * dot( d, v ) * ( 1.0 - c );
}
`;
/** Vértice: troca o #include <beginnormal_vertex> (pose do balão e da carga). */
export const CAMINHAO_VERTICE_NORMAL = /* glsl */ `
vec3 objectNormal = normal;
vec3 camPos = position;
{
  int parte = int( aParte2.x + 0.5 );
  vParte = aParte2.x;
  vCab = aCab;
  vCarga = aCarga;
  vCamLocal = vec3( position.xy, 0.0 );
  if ( parte == 12 ) {
    float n = aCarga.a;
    if ( aParte2.y > 0.5 ) {
      // palete além da quantidade: some
      if ( aParte2.y > n + 0.01 ) camPos = vec3( 0.0 );
    } else {
      // o monte sobe com a carga, a partir do piso
      camPos.y = gCamPiso + ( camPos.y - gCamPiso ) * clamp( n / 10.0, 0.0, 1.0 );
      if ( n < 0.5 ) camPos = vec3( 0.0 );
    }
  }
  if ( parte == 13 ) {
    vec3 o = vec3( 0.0, gCamTambor.x, gCamTambor.y );
    vec3 d = normalize( vec3( 0.0, gCamTambor.z - gCamTambor.x, gCamTambor.w - gCamTambor.y ) );
    // as listras em espiral giram com o balão: o ângulo em volta do eixo e a posição ao longo dele, antes de girar
    vec3 v = position - o;
    float ax = dot( v, d );
    vec3 r = v - d * ax;
    vec3 e2 = vec3( 0.0, -d.z, d.y );
    vCamLocal.z = atan( dot( r, e2 ), r.x ) / 6.2831853 + ax * 0.32;
    float a = gCamTempo * 1.6 + floor( aCab.a / 4.0 ) * 0.7;
    camPos = camGira( position, o, d, a );
    objectNormal = camGira( normal, vec3( 0.0 ), d, a );
  }
}
`;
export const CAMINHAO_VERTICE_MAIN = /* glsl */ `
vec3 transformed = camPos;
`;
export const CAMINHAO_FRAGMENTO_PARS = /* glsl */ `
flat varying vec4 vCab;
flat varying vec4 vCarga;
flat varying float vParte;
varying vec3 vCamLocal;
uniform float gCamNoite;
float gCamRug = 0.4;
float gCamMetal = 0.0;
vec3 camLinear( vec3 s ) { return pow( s / 255.0, vec3( 2.2 ) ); }
`;
export const CAMINHAO_FRAGMENTO_COR = /* glsl */ `
{
  int p = int( vParte + 0.5 );
  vec3 cab = min( camLinear( vCab.rgb ), vec3( 0.75 ) );
  vec3 c;
  if ( p == 0 || p == 8 ) { c = cab; gCamRug = 0.36; }
  else if ( p == 1 ) { c = vec3( 0.03, 0.034, 0.038 ); gCamRug = 0.1; }
  else if ( p == 2 ) { c = vec3( 0.025 ); gCamRug = 0.8; }
  else if ( p == 3 ) { c = vec3( 0.55, 0.55, 0.52 ); gCamRug = 0.15; }
  else if ( p == 4 ) { c = vec3( 0.25, 0.01, 0.01 ); gCamRug = 0.2; }
  else if ( p == 5 ) { c = vec3( 0.55, 0.56, 0.56 ); gCamRug = 0.35; gCamMetal = 0.6; }
  else if ( p == 6 ) { c = vec3( 0.3 ); gCamRug = 0.3; gCamMetal = 0.8; }
  else if ( p == 9 || p == 10 ) { c = vec3( 0.07, 0.072, 0.075 ); gCamRug = 0.55; gCamMetal = 0.3; }
  else if ( p == 11 ) { c = vec3( 0.2, 0.12, 0.065 ); gCamRug = 0.85; }
  else if ( p == 12 ) { c = camLinear( vCarga.rgb ); gCamRug = 0.95; }
  else if ( p == 13 ) {
    // listras em espiral: a cor da cabine e o branco
    float l = step( 0.5, fract( vCamLocal.z * 3.0 ) );
    c = mix( cab, vec3( 0.72, 0.72, 0.7 ), l );
    gCamRug = 0.35;
  }
  else if ( p == 14 ) { c = vec3( 0.7, 0.7, 0.68 ); gCamRug = 0.45; }
  else if ( p == 15 ) { c = vec3( 0.05, 0.052, 0.055 ); gCamRug = 0.7; }
  else { c = vec3( 0.0 ); gCamRug = 1.0; }
  diffuseColor.rgb = c;
}
`;
export const CAMINHAO_FRAGMENTO_RUGOSIDADE = /* glsl */ `
float roughnessFactor = gCamRug;
`;
export const CAMINHAO_FRAGMENTO_METAL = /* glsl */ `
float metalnessFactor = gCamMetal;
`;
export const CAMINHAO_FRAGMENTO_EMISSIVO = /* glsl */ `
{
  int p = int( vParte + 0.5 );
  int luz = int( mod( vCab.a, 4.0 ) + 0.5 );
  if ( p == 3 && ( luz & 1 ) != 0 ) totalEmissiveRadiance += vec3( 1.0, 0.88, 0.7 ) * 9.0 * gCamNoite;
  if ( p == 4 ) totalEmissiveRadiance += vec3( 1.0, 0.04, 0.02 ) * ( ( ( luz & 2 ) != 0 ? 5.0 : 0.0 ) + 2.5 * gCamNoite * float( luz & 1 ) );
  if ( p == 8 || p == 9 ) {
    float x = abs( vCamLocal.x );
    float par = step( 0.45, x ) * step( x, 1.15 ) * step( 0.55, vCamLocal.y ) * step( vCamLocal.y, 0.95 );
    if ( p == 8 && ( luz & 1 ) != 0 ) totalEmissiveRadiance += vec3( 1.0, 0.88, 0.7 ) * 6.0 * gCamNoite * par;
    if ( p == 9 ) totalEmissiveRadiance += vec3( 1.0, 0.04, 0.02 ) * par * ( ( ( luz & 2 ) != 0 ? 4.0 : 0.0 ) + 1.8 * gCamNoite * float( luz & 1 ) );
  }
}
`;

/** Só a thread principal usa; nada a registrar na oficina. */
export function registrar() {}
