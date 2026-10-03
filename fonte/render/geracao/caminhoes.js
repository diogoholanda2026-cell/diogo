// Caminhões da Holding (R3b, desenho do render 8), puros: o caminhão médio de cabine avançada da frota brasileira
// (6x4, uns 8,6 m, como os de obra) com quatro carrocerias, pela carga da entrega:
//   basculante  caçamba de aço com o monte do material (brita, areia, argila, calcário), que sobe com a carga
//   carroceria  de madeira, com os paletes (tijolo, cimento, aço, vidro, madeira), um por unidade (até 10)
//   betoneira   o balão listrado que gira (concreto), com a calha e a caixa d'água
//   bau         a carroceria fechada (sem item)
// LOD0 com cabine, chassi, rodas duplas atrás, faróis e lanternas; LOD1 em caixas, com as pontas que acendem. A
// frente olha para +z e a origem fica no chão, no meio. aParte2: a parte (PARTE_CAMINHAO) e, na carga, o índice do
// palete (1 a 10) ou 0 no monte. A cabine tem a cor da Holding (espelho.holding.cor) ou branca no frete contratado.
// Só a thread principal usa (sob demanda, mundo/caminhoes.js), com os trechos GLSL do material; não registra tipo na
// oficina.

/** Partes (aParte2.x no shader); as 10 primeiras como as dos carros. */
export const PARTE_CAMINHAO = Object.freeze({
  PINTURA: 0, VIDRO: 1, PRETO: 2, FAROL: 3, LANTERNA: 4, CROMADO: 5, ARO: 6, SOMBRA: 7, FRENTE: 8, TRASEIRA: 9,
  CACAMBA: 10, MADEIRA: 11, CARGA: 12, TAMBOR: 13, BAU: 14,
});
const P = PARTE_CAMINHAO;

/** Medidas (m): comprimento, largura, altura da cabine, comprimento da cabine, piso da carroceria, raio da roda. */
export const CAMINHAO = Object.freeze({ c: 8.6, l: 2.5, h: 3.1, cab: 1.95, piso: 1.28, roda: 0.52 });
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

/** Construtor de malha (faces planas, sem índice compartilhado entre faces). */
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

  /** Polígono convexo plano, anti-horário visto de fora; ci: índice do palete (0 fora da carga). */
  poli(pts, parte, ci = 0) {
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
    for (const p of pts) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0] / l, n[1] / l, n[2] / l);
      this.parte.push(parte, ci);
    }
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
    M.poli(lado > 0 ? q : [...q].reverse(), P.PRETO);
  }
  const aro = pts.map(([zz, yy]) => [xf + lado * 0.004, y + yy * 0.58, z + zz * 0.58]);
  M.poli(lado > 0 ? [...aro].reverse() : aro, P.ARO);
}

/** Cabine avançada com o chassi, as rodas, os faróis e as lanternas (comum às quatro carrocerias). */
function base(M) {
  const { c, l, h, cab, roda: r } = CAMINHAO;
  const w = l / 2;
  const zF = c / 2;
  const zT = -c / 2;
  const zc = zF - cab;
  const y0 = 1.02; // piso da cabine
  const yv = 1.95; // base do para-brisa e das janelas
  // cabine: seções de trás para a frente, com a quina da frente chanfrada
  const sec = (z, k, recuo = 0) => [[-w + k, y0], [-w + k * 0.6, yv], [-w + k + recuo * 0.6, h - 0.08], [-w + k + 0.12 + recuo, h], [w - k - 0.12 - recuo, h], [w - k - recuo * 0.6, h - 0.08], [w - k * 0.6, yv], [w - k, y0]];
  const secoes = [{ z: zc, pts: sec(zc, 0.04) }, { z: zF - 0.22, pts: sec(zF - 0.22, 0.04) }, { z: zF, pts: sec(zF, 0.12, 0.1) }];
  for (let k = 0; k + 1 < secoes.length; k++) {
    const A = secoes[k];
    const B = secoes[k + 1];
    for (let i = 0; i + 1 < A.pts.length; i++) {
      // vidro: a janela de cada lado na frente da cabine; o resto pintado
      const janela = (i === 1 || i === 5) && k === 1;
      const lateral = (i === 1 || i === 5) && k === 0;
      const parte = janela ? P.VIDRO : lateral ? P.PINTURA : P.PINTURA;
      M.poli([[A.pts[i][0], A.pts[i][1], A.z], [B.pts[i][0], B.pts[i][1], B.z], [B.pts[i + 1][0], B.pts[i + 1][1], B.z], [A.pts[i + 1][0], A.pts[i + 1][1], A.z]], parte);
    }
  }
  // a janela lateral da porta (um vidro grande na parte de cima, nos dois lados)
  for (const s of [-1, 1]) {
    const x = s * (w - 0.025);
    const q = [[x + s * 0.005, yv + 0.05, zc + 0.35], [x + s * 0.005, h - 0.2, zc + 0.35], [x + s * 0.005, h - 0.2, zF - 0.3], [x + s * 0.005, yv + 0.05, zF - 0.3]];
    M.poli(s > 0 ? q : [...q].reverse(), P.VIDRO);
  }
  // frente: para-brisa em cima, a grade embaixo, o para-choque com os faróis
  const fr = secoes[2].pts;
  M.poli(fr.map(([x, y]) => [x, y, zF]).reverse(), P.PINTURA);
  M.poli([[fr[1][0] + 0.05, yv + 0.05, zF + 0.004], [fr[6][0] - 0.05, yv + 0.05, zF + 0.004], [fr[5][0] - 0.12, h - 0.18, zF + 0.004], [fr[2][0] + 0.12, h - 0.18, zF + 0.004]], P.VIDRO);
  // a parede de trás da cabine
  M.poli(secoes[0].pts.map(([x, y]) => [x, y, zc]), P.PINTURA);
  M.poli([[-0.62, 1.15, zF + 0.006], [0.62, 1.15, zF + 0.006], [0.62, 1.78, zF + 0.006], [-0.62, 1.78, zF + 0.006]], P.PRETO);
  // para-choque e faróis nele; degraus e o tanque
  caixa(M, -w + 0.02, 0.42, zF - 0.1, w - 0.02, 0.95, zF + 0.12, P.PRETO, { tras: null });
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? w - 0.5 : -w + 0.12;
    M.poli([[x0, 0.7, zF + 0.125], [x0 + 0.38, 0.7, zF + 0.125], [x0 + 0.38, 0.88, zF + 0.125], [x0, 0.88, zF + 0.125]], P.FAROL);
    // retrovisor em braço
    caixa(M, s > 0 ? w + 0.06 : -w - 0.2, 2.05, zF - 0.42, s > 0 ? w + 0.2 : -w - 0.06, 2.55, zF - 0.34, P.PRETO);
  }
  caixa(M, w - 0.75, 0.48, zc - 1.0, w - 0.12, 0.98, zc - 0.25, P.CROMADO, { fundo: true });
  // chassi: as duas longarinas e a traseira com as lanternas
  for (const s of [-1, 1]) caixa(M, s * 0.42 - 0.08, 0.62, zT + 0.12, s * 0.42 + 0.08, 0.92, zc, P.PRETO, { topo: null });
  caixa(M, -w + 0.05, 0.62, zT, w - 0.05, 0.92, zT + 0.14, P.PRETO, { topo: null });
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? w - 0.42 : -w + 0.1;
    M.poli([[x0 + 0.32, 0.66, zT - 0.006], [x0, 0.66, zT - 0.006], [x0, 0.86, zT - 0.006], [x0 + 0.32, 0.86, zT - 0.006]], P.LANTERNA);
  }
  // rodas: a dianteira e o tandem de trás com pneus duplos; para-lamas
  const zR1 = zT + 1.55;
  const zR2 = zT + 2.95;
  for (const s of [-1, 1]) {
    roda(M, s * (w - 0.18), r, zF - 1.28, r, 0.32, s);
    roda(M, s * (w - 0.28), r, zR1, r, 0.55, s);
    roda(M, s * (w - 0.28), r, zR2, r, 0.55, s);
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
 * do eixo, listrado com a cor da cabine) e o baú. aCab: cor da cabine (sRGB 0 a 255) e as luzes (bit 0 farol, 1
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
  if ( p == 0 || p == 8 ) { c = cab; gCamRug = 0.3; }
  else if ( p == 1 ) { c = vec3( 0.02, 0.025, 0.03 ); gCamRug = 0.06; }
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
