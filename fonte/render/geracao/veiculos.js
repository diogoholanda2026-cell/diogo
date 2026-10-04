// Modelos de carro da frota brasileira (desenho do render 8; VIS1b), puros: hatch (Onix, HB20, Polo), sedã (Onix Plus,
// Virtus, Corolla), SUV (T-Cross, Creta, Compass), picape média (Hilux, S10), ônibus urbano (Padron de 12 m) e caminhão
// leve (VUC com baú). Medidas reais, em metros; a frente olha para +z e a origem fica no chão, no meio do carro.
//   LOD0  carros de passeio com 300 a 400 triângulos: carroceria em seções arredondadas com normais suaves (o sol baixo
//         vira um reflexo que corre pela lataria, não um bloco claro numa face plana), estufa com as colunas, para-brisa
//         e vidro de trás inclinados, janelas das portas com a coluna do meio, para-choques com a parte de baixo em
//         plástico, placa Mercosul na frente e atrás, faróis, grade, lanternas que dobram a quina, retrovisores, caixas
//         de roda e rodas de 7 lados com o aro
//   LOD1  12 a 24 triângulos: a carroceria e a cabine em caixas, com as pontas que acendem à noite (o mesmo de antes)
// A cor vem da instância (a frota: branco, prata, preto e cinza passam de 80%); aParte diz o que é cada vértice
// (pintura, vidro, pneu, farol, lanterna, cromado, aro, placa, plástico) para o shader (mundo/trafego.js).

/**
 * Partes (aParte no shader). FRENTE e TRASEIRA são as faces de ponta do LOD1: pintura de dia e, à noite, os dois
 * faróis (ou as lanternas) desenhados no shader, para a cidade vista de longe ter as filas de luz.
 */
export const PARTE = Object.freeze({ PINTURA: 0, VIDRO: 1, PRETO: 2, FAROL: 3, LANTERNA: 4, CROMADO: 5, ARO: 6, SOMBRA: 7, FRENTE: 8, TRASEIRA: 9, PLACA: 10, PLASTICO: 11 });

/**
 * Medidas: comprimento, largura, altura do teto, altura da cintura (onde começam os vidros), vão livre, raio da roda,
 * entre-eixos, e as estações da cabine (fração do comprimento a partir da traseira): base do vidro de trás, fim do
 * teto, frente do teto e base do para-brisa (nesta ordem: fVT, fTT, fTF, fPB); capô: altura do capô na ponta; traseira:
 * altura da tampa (porta-malas ou tampa traseira) na ponta; caçamba: a picape.
 */
export const MODELOS = Object.freeze([
  { id: 'hatch', nome: 'hatch', c: 3.95, l: 1.72, h: 1.48, cintura: 0.95, vao: 0.16, roda: 0.3, eixos: 2.55, cabine: [0.7, 0.47, 0.18, 0.06], capo: 0.7, traseira: 0.92 },
  { id: 'seda', nome: 'sedã', c: 4.55, l: 1.76, h: 1.46, cintura: 0.93, vao: 0.15, roda: 0.31, eixos: 2.65, cabine: [0.68, 0.49, 0.27, 0.17], capo: 0.7, traseira: 0.97 },
  { id: 'suv', nome: 'SUV', c: 4.42, l: 1.82, h: 1.66, cintura: 1.05, vao: 0.2, roda: 0.34, eixos: 2.64, cabine: [0.7, 0.52, 0.13, 0.04], capo: 0.84, traseira: 1.02, plastico: true },
  { id: 'picape', nome: 'picape', c: 5.3, l: 1.86, h: 1.8, cintura: 1.12, vao: 0.25, roda: 0.37, eixos: 3.08, cabine: [0.66, 0.55, 0.4, 0.37], capo: 0.98, traseira: 1.1, cacamba: 0.37, plastico: true },
  { id: 'onibus', nome: 'ônibus', c: 12.4, l: 2.5, h: 3.1, cintura: 1.2, vao: 0.3, roda: 0.5, eixos: 6.2, janela: [1.2, 2.55], onibus: true },
  { id: 'caminhao', nome: 'caminhão', c: 7.1, l: 2.3, h: 3.05, cintura: 1.35, vao: 0.3, roda: 0.45, eixos: 3.9, cab: 1.85, caminhao: true },
]);

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cruz = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
export const norma = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const mesmo = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 1e-6;

/** Construtor simples de malha (sem índice compartilhado entre faces: cada face com a parte dela). */
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

  /**
   * Polígono convexo plano (pontos [x, y, z] em ordem, vistos de fora no sentido anti-horário); nors: a normal de cada
   * ponto (suave) ou nada (a da face).
   */
  poli(pts, parte, nors = null) {
    const a = pts[0];
    const u = sub(pts[1], a);
    let n = cruz(u, sub(pts[2], a));
    // o primeiro trio pode ser colinear: procura um que não seja
    for (let k = 2; Math.hypot(...n) < 1e-9 && k + 1 < pts.length; k++) n = cruz(u, sub(pts[k + 1], a));
    n = norma(n);
    const base = this.nv;
    pts.forEach((p, k) => {
      const q = nors ? nors[k] : n;
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(q[0], q[1], q[2]);
      this.parte.push(parte);
    });
    for (let k = 1; k + 1 < pts.length; k++) this.idx.push(base, base + k, base + k + 1);
  }

  get tris() {
    return this.idx.length / 3;
  }

  fechar() {
    return {
      posicao: Float32Array.from(this.pos),
      normal: Float32Array.from(this.nor),
      parte: Uint8Array.from(this.parte),
      indices: Uint16Array.from(this.idx),
      tris: this.idx.length / 3,
    };
  }
}

/**
 * Superfície em grade: G[k][i] = [x, y, z] (anéis ao longo do carro, o mesmo número de pontos em cada um), faces entre
 * os anéis k e k + 1 e os pontos i e i + 1 (i + 1 volta ao 0 com fechada) com a parte de partes(k, i) (-1 pula).
 * Normais suaves: em cada ponto, a soma das faces vizinhas pesada pela área (a lataria lê curva de perto). Devolve as
 * normais da grade (as tampas misturam com elas). M: qualquer construtor com poli(pts, parte, normais) (a cabine dos
 * caminhões da Holding, geracao/caminhoes.js, usa a mesma).
 */
export function superficie(M, G, partes, { fechada = false } = {}) {
  const nk = G.length;
  const ni = G[0].length;
  const nf = fechada ? ni : ni - 1;
  const N = G.map((a) => a.map(() => [0, 0, 0]));
  const faces = [];
  for (let k = 0; k + 1 < nk; k++) {
    for (let i = 0; i < nf; i++) {
      const p = partes(k, i);
      if (p < 0) continue;
      const j = (i + 1) % ni;
      const A = G[k][i];
      const B = G[k + 1][i];
      const C = G[k + 1][j];
      const D = G[k][j];
      // anti-horário visto de fora (o contorno sobe pela esquerda e desce pela direita, visto da frente)
      const n = cruz(sub(C, A), sub(D, B));
      for (const [kk, ii] of [[k, i], [k + 1, i], [k + 1, j], [k, j]]) for (let q = 0; q < 3; q++) N[kk][ii][q] += n[q];
      faces.push([k, i, j, p]);
    }
  }
  const Nn = N.map((a) => a.map(norma));
  for (const [k, i, j, p] of faces) {
    const pts = [];
    const nors = [];
    for (const [kk, ii] of [[k, i], [k + 1, i], [k + 1, j], [k, j]]) {
      const q = G[kk][ii];
      if (pts.length && (mesmo(q, pts[pts.length - 1]) || (pts.length === 3 && mesmo(q, pts[0])))) continue;
      pts.push(q);
      nors.push(Nn[kk][ii]);
    }
    if (pts.length >= 3) M.poli(pts, p, nors);
  }
  return Nn;
}

/**
 * Tampa de uma ponta em faixas: o anel (simétrico, de baixo pela esquerda, por cima e de volta pela direita, com um
 * número par de pontos) fechado de baixo para cima por faixas entre os pares de pontos da mesma altura (i e n - 1 - i),
 * cada faixa em duas metades com a coluna do meio estufada `bojo` m para fora (a ponta curva em planta, como a tampa e
 * o para-choque de verdade). Normais: a borda com as do anel na grade (a lataria que dobra a quina), o meio de frente:
 * o reflexo do sol baixo vira uma faixa em pé que corre pela chapa, e não um bloco nem o X de um leque. dz: para onde a
 * tampa olha (-1 atrás, 1 na frente); partes(k): a parte da faixa k (de baixo para cima).
 */
export function tampa(M, anel, normais, dz, partes, bojo = 0.04) {
  const n = anel.length;
  const meio = [];
  for (let k = 0; k < n / 2; k++) {
    const L = anel[k];
    const R = anel[n - 1 - k];
    const ny = (normais[k][1] + normais[n - 1 - k][1]) * 0.35;
    // o par de cima fica no plano da ponta: estufado, ele abria uma fresta em V entre a tampa e o tampo (de cima se
    // via o chão por ela)
    const b = k === n / 2 - 1 ? 0 : bojo;
    meio.push({ p: [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2, (L[2] + R[2]) / 2 + dz * b], n: norma([0, ny, dz]) });
  }
  const emite = (vs, parte) => {
    const pts = [];
    const nors = [];
    for (const [p, nn] of vs) {
      if (pts.length && (mesmo(p, pts[pts.length - 1]) || (pts.length === 3 && mesmo(p, pts[0])))) continue;
      pts.push(p);
      nors.push(nn);
    }
    if (pts.length >= 3) M.poli(pts, parte, nors);
  };
  for (let k = 0; k + 1 < n / 2; k++) {
    const L0 = [anel[k], normais[k]];
    const L1 = [anel[k + 1], normais[k + 1]];
    const R0 = [anel[n - 1 - k], normais[n - 1 - k]];
    const R1 = [anel[n - 2 - k], normais[n - 2 - k]];
    const C0 = [meio[k].p, meio[k].n];
    const C1 = [meio[k + 1].p, meio[k + 1].n];
    if (dz > 0) {
      emite([L0, C0, C1, L1], partes(k));
      emite([C0, R0, R1, C1], partes(k));
    } else {
      emite([C0, L0, L1, C1], partes(k));
      emite([R0, C0, C1, R1], partes(k));
    }
  }
}

/**
 * Caixa de x0..x1, y0..y1, z0..z1 sem o fundo (5 faces, 10 triângulos); topo, frente (+z) e trás podem ter outra
 * parte. semLado: 1 tira a face de x0 (encostada na carroceria do lado +x), -1 a de x1.
 */
function caixa(M, x0, y0, z0, x1, y1, z1, parte, topo = parte, frente = parte, tras = parte, semLado = 0) {
  if (semLado !== -1) M.poli([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], parte);
  if (semLado !== 1) M.poli([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], parte);
  M.poli([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], topo);
  M.poli([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], frente);
  M.poli([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], tras);
}

/**
 * Roda: cilindro de n lados no eixo x, com normais suaves no pneu, o flanco preto e o aro por cima dele (sem o flanco,
 * o vão entre o aro e a banda mostrava a lataria atrás: a roda virava uma calota cinza pintada no lado do carro).
 * cima: false tira a metade de cima da banda, que nos carros de passeio fica dentro da carroceria (o painel do lado
 * cobre a roda acima do eixo); com ela o carro passava de 400 triângulos.
 */
function roda(M, x, y, z, r, larg, lado, n = 8, { cima = true } = {}) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (Math.PI * 2 * k) / n + Math.PI / n;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  const xf = x + (lado * larg) / 2;
  const xd = x - (lado * larg) / 2;
  for (let k = 0; k < n; k++) {
    const [z0, y0] = pts[k];
    const [z1, y1] = pts[(k + 1) % n];
    if (!cima && y0 > -1e-6 && y1 > -1e-6) continue;
    const q = [[xf, y + y0 * r, z + z0 * r], [xf, y + y1 * r, z + z1 * r], [xd, y + y1 * r, z + z1 * r], [xd, y + y0 * r, z + z0 * r]];
    const nq = [[0, y0, z0], [0, y1, z1], [0, y1, z1], [0, y0, z0]];
    M.poli(lado > 0 ? q : [...q].reverse(), PARTE.PRETO, lado > 0 ? nq : [...nq].reverse());
  }
  const disco = (raio, fora) => pts.map(([zz, yy]) => [xf + lado * fora, y + yy * r * raio, z + zz * r * raio]);
  const flanco = disco(1, 0.001);
  M.poli(lado > 0 ? [...flanco].reverse() : flanco, PARTE.PRETO);
  const aro = disco(0.62, 0.004);
  M.poli(lado > 0 ? [...aro].reverse() : aro, PARTE.ARO);
}

/**
 * Caixa de roda: a meia-lua escura do vão do para-lama acima do pneu, na lateral (x = lado * xl), de r0 a r1 do eixo
 * (no SUV e na picape, a moldura de plástico preto).
 */
function caixaDeRoda(M, xl, y, z, r0, r1, lado, parte) {
  const n = 3;
  for (let k = 0; k < n; k++) {
    const a0 = (Math.PI * k) / n;
    const a1 = (Math.PI * (k + 1)) / n;
    const p = (a, r) => [lado * xl, y + Math.sin(a) * r, z + Math.cos(a) * r];
    const q = [p(a0, r0), p(a0, r1), p(a1, r1), p(a1, r0)];
    // na ordem de q a face olha para dentro (-x do lado +x): vira para fora dos dois lados
    M.poli(lado > 0 ? [...q].reverse() : q, parte);
  }
}

/**
 * Onde um raio paralelo a z, vindo de fora (sentido -dz), encosta na carroceria já feita em (x, y): o z da face mais de
 * fora, ou null se passa ao lado. Só vale uma face a menos de `janela` m para dentro do plano da ponta (zPonta): uma
 * roda ou a traseira da cabine lá no meio não servem. É o que assenta os faróis, as lanternas, a placa e a grade.
 */
function zNaSuperficie(M, x, y, dz, zPonta, janela = 0.45) {
  let melhor = null;
  const P = M.pos;
  // só a carroceria (M.corpo: os índices até ela); rodas, retrovisores e as peças já assentadas não contam
  const fim = M.corpo ?? M.idx.length;
  for (let t = 0; t < fim; t += 3) {
    const a = 3 * M.idx[t];
    const b = 3 * M.idx[t + 1];
    const c = 3 * M.idx[t + 2];
    // coordenadas baricêntricas de (x, y) no triângulo projetado no plano xy
    const d = (P[b + 1] - P[c + 1]) * (P[a] - P[c]) + (P[c] - P[b]) * (P[a + 1] - P[c + 1]);
    if (Math.abs(d) < 1e-12) continue;
    const l1 = ((P[b + 1] - P[c + 1]) * (x - P[c]) + (P[c] - P[b]) * (y - P[c + 1])) / d;
    const l2 = ((P[c + 1] - P[a + 1]) * (x - P[c]) + (P[a] - P[c]) * (y - P[c + 1])) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
    const z = l1 * P[a + 2] + l2 * P[b + 2] + l3 * P[c + 2];
    if ((z - zPonta) * dz < -janela) continue;
    if (melhor === null || z * dz > melhor * dz) melhor = z;
  }
  return melhor;
}

/** Célula de peça assentada: afundando mais que DIVIDIR na curva da ponta, divide em 4 (uma vez); sai no máximo SAIDA_MAX (m). */
const DIVIDIR = 0.012;
const SAIDA_MAX = 0.03;

/**
 * Peça assentada na ponta (farol, lanterna, placa, grade, plástico): grade de nx x ny quadriláteros de xa a xb e de y0
 * a y0 + alt, cada vértice na carroceria (a face mais de fora naquele x, y, perto da ponta) com um recuo para fora; sem
 * face ali, o plano zPonta. Chame depois da carroceria. dz: 1 na frente, -1 atrás. dividir: a célula que afunda na
 * curva divide em 4 (os faróis e as lanternas); sem, só sai para fora (a placa, a grade e o plástico, planos).
 */
function assentar(M, xa, xb, y0, alt, dz, zPonta, nx, ny, parte, recuo = 0.004, dividir = true) {
  const sup = (x, y) => zNaSuperficie(M, x, y, dz, zPonta);
  const vert = (x, y) => [x, y, (sup(x, y) ?? zPonta) + dz * recuo];
  // anti-horário visto de fora: na frente (dz = 1) x cresce para a direita; atrás, para a esquerda
  const vira = (xb > xa) !== (dz > 0);
  const celulas = [];
  const celula = (x0, x1, y1, y2, prof) => {
    const q = [vert(x0, y1), vert(x1, y1), vert(x1, y2), vert(x0, y2)];
    // quanto a célula afunda na carroceria (a superfície faz barriga dentro dela)
    let fundo = 0;
    for (const [a, b] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]]) {
      const zc = (q[0][2] * (1 - a) + q[1][2] * a) * (1 - b) + (q[3][2] * (1 - a) + q[2][2] * a) * b;
      const zs = sup(x0 + (x1 - x0) * a, y1 + (y2 - y1) * b);
      if (zs !== null) fundo = Math.max(fundo, (zs + dz * recuo - zc) * dz);
    }
    if (dividir && fundo > DIVIDIR && prof < 1) {
      const xm = (x0 + x1) / 2;
      const ym = (y1 + y2) / 2;
      celula(x0, xm, y1, ym, prof + 1);
      celula(xm, x1, y1, ym, prof + 1);
      celula(x0, xm, ym, y2, prof + 1);
      celula(xm, x1, ym, y2, prof + 1);
      return;
    }
    for (const p of q) p[2] += dz * Math.min(SAIDA_MAX, fundo);
    celulas.push(vira ? q.reverse() : q);
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      celula(xa + ((xb - xa) * i) / nx, xa + ((xb - xa) * (i + 1)) / nx, y0 + (alt * j) / ny, y0 + (alt * (j + 1)) / ny, 0);
    }
  }
  // as células entram depois de todas medidas (uma não serve de superfície para a outra)
  for (const q of celulas) M.poli(q, parte);
}

/**
 * Seção da carroceria de baixo (10 pontos, de baixo pela esquerda, por cima e de volta pela direita): fundo chanfrado,
 * lateral de baixo até a linha do para-choque (ym), lateral de cima com um pouco de caída, ombro e o tampo (capô,
 * cintura ou tampa) em yt. ww: meia largura.
 */
function secao(ww, y0, ym, yt) {
  const rb = Math.min(0.1, (ym - y0) * 0.4);
  const rs = Math.min(0.06, (yt - ym) * 0.3);
  return [
    [-ww + rb, y0], [-ww, y0 + rb], [-ww, ym], [-ww + 0.015, yt - rs], [-ww + rs + 0.03, yt],
    [ww - rs - 0.03, yt], [ww - 0.015, yt - rs], [ww, ym], [ww, y0 + rb], [ww - rb, y0],
  ];
}

/** Partes das faces da seção (i de 0 a 9): fundo, lateral de baixo, de cima, ombro, tampo e o espelho; 9 é o assoalho. */
const FACE = Object.freeze({ CHANFRO: [0, 8], BAIXO: [1, 7], CIMA: [2, 6], OMBRO: [3, 5], TAMPO: 4, FUNDO: 9 });

/** Carro de passeio (hatch, sedã, SUV, picape): LOD0. */
function carroLOD0(m) {
  const M = new Malha();
  const w = m.l / 2;
  const zT = -m.c / 2;
  const zF = m.c / 2;
  const y0 = m.vao;
  const yc = m.cintura;
  const yCapo = m.capo;
  const yTras = m.traseira;
  const z = (f) => zT + f * m.c;
  const [fPB, fTF, fTT, fVT] = m.cabine;
  // linha do para-choque (onde a lateral de baixo acaba) atrás e na frente
  const ymT = y0 + 0.42;
  const ymF = y0 + 0.4;
  const zVT = z(fVT);
  const zPB = z(fPB);
  // estações da carroceria de baixo, de trás para a frente: [z, meia largura, fundo, para-choque, tampo]. As pontas
  // encolhem (a traseira e o bico arredondados: nenhuma face grande de frente para a câmera), a lateral é um pouco mais
  // larga no meio (a planta curva) e o tampo sobe da tampa à cintura e desce da cintura ao capô
  // a traseira dobra as quinas num quarto de círculo de 0,22 m (em planta e em pé)
  const est = [
    [zT, w - 0.22, y0 + 0.11, ymT - 0.02, yTras - 0.1],
    [zT + 0.065, w - 0.065, y0 + 0.032, ymT, yTras - 0.03],
    [zT + 0.22, w - 0.01, y0, ymT, yTras],
  ];
  if (zVT - zT > 0.4) est.push([zVT, w, y0, ymT, m.cacamba ? yTras : yc]);
  else est[2][4] = yc;
  // o capô desce da cintura ao bico, e o bico arredonda em planta (as quinas recuam: o farol dobra a quina)
  est.push(
    [zPB, w, y0, ymF, yc],
    [zF - 0.75, w - 0.006, y0, ymF, yCapo + 0.08],
    [zF - 0.3, w - 0.03, y0, ymF, yCapo + 0.02],
    [zF - 0.09, w - 0.12, y0 + 0.03, ymF - 0.02, yCapo - 0.02],
    [zF, w - 0.32, y0 + 0.1, ymF - 0.05, yCapo - 0.1],
  );
  const G = est.map(([zz, ww, a, b, t]) => secao(ww, a, b, t).map(([x, y]) => [x, y, zz]));
  const nk = G.length;
  const kVT = est.findIndex((e) => e[0] === zVT);
  const plastico = (i) => FACE.CHANFRO.includes(i) || (m.plastico && FACE.BAIXO.includes(i));
  const partes = (k, i) => {
    if (i === FACE.FUNDO) return k === 0 || k === nk - 2 ? PARTE.PRETO : -1;
    // a caçamba da picape: aberta em cima entre a tampa e a cabine
    if (m.cacamba && i === FACE.TAMPO && k === 2 && kVT === 3) return -1;
    if (plastico(i)) return PARTE.PLASTICO;
    return PARTE.PINTURA;
  };
  const Nn = superficie(M, G, partes, { fechada: true });
  // as pontas: o miolo da traseira e do bico, abaulados (o plástico de baixo é peça assentada)
  tampa(M, G[0], Nn[0], -1, () => PARTE.PINTURA, 0.035);
  tampa(M, G[nk - 1], Nn[nk - 1], 1, () => PARTE.PINTURA, 0.05);
  // caçamba da picape: o piso, as paredes de dentro, a tampa por dentro e a parede da cabine
  if (m.cacamba && kVT === 3) {
    const za = zT + 0.2;
    const zb = zVT;
    const xi = w - 0.09;
    const yp = yc - 0.5;
    // todas viradas para dentro da caçamba (o material é de uma face só: virada para fora, a parede some e a caçamba
    // vira um buraco para o chão)
    M.poli([[-xi, yp, zb], [xi, yp, zb], [xi, yp, za], [-xi, yp, za]], PARTE.PLASTICO);
    M.poli([[-xi, yp, za], [-xi, yTras, za], [-xi, yTras, zb], [-xi, yp, zb]], PARTE.PLASTICO);
    M.poli([[xi, yp, zb], [xi, yTras, zb], [xi, yTras, za], [xi, yp, za]], PARTE.PLASTICO);
    M.poli([[-xi, yp, za], [-xi, yTras, za], [xi, yTras, za], [xi, yp, za]].reverse(), PARTE.PLASTICO);
    // a parede da cabine na caçamba, com as normais abauladas nos cantos (chapa de verdade, não um espelho plano); sobe
    // 3 cm por cima da base do vidro de trás (rente a ela, a emenda deixava uma linha de pontos claros)
    const nc = (sx, sy) => norma([sx * 0.35, sy * 0.25, -1]);
    M.poli([[xi, yp, zb], [-xi, yp, zb], [-xi, yc + 0.03, zb], [xi, yc + 0.03, zb]], PARTE.PINTURA, [nc(1, -1), nc(-1, -1), nc(-1, 1), nc(1, 1)]);
  }

  // estufa: da base do vidro de trás ao teto e à base do para-brisa, com a caída do teto e o teto abaulado
  const wb = w - 0.09;
  const wr = w - 0.24;
  const hR = m.h - 0.035;
  const meio = (y) => [[-wb, y], [-wb, y], [-0.45 * wb, y], [0.45 * wb, y], [wb, y], [wb, y]];
  const teto = [[-wb, yc], [-wr, hR], [-0.45 * wr, m.h], [0.45 * wr, m.h], [wr, hR], [wb, yc]];
  const zc = [zVT, z(fTT), z(fTF), zPB];
  const E = [meio(yc), teto, teto, meio(yc)].map((s, k) => s.map(([x, y]) => [x, y, zc[k]]));
  superficie(M, E, (k, i) => (i === 0 || i === 4 ? PARTE.PINTURA : k === 1 ? PARTE.PINTURA : PARTE.VIDRO));
  // colunas A e C: a faixa da cor do carro na borda do para-brisa e do vidro de trás (o vidro não vai de lado a lado)
  // A, B: a borda do vidro (de baixo para cima); C, D: os pontos de dentro na mesma altura (para onde a faixa cresce);
  // fora: 1 no para-brisa (olha para a frente), -1 no vidro de trás
  const coluna = (A, B, C, D, larg, fora) => {
    const p = (P, Q, t) => [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, P[2] + (Q[2] - P[2]) * t];
    let n = norma(cruz(sub(B, A), sub(C, A)));
    if (n[2] * fora < 0) n = n.map((x) => -x);
    const o = (P) => [P[0] + n[0] * 0.004, P[1] + n[1] * 0.004, P[2] + n[2] * 0.004];
    const q = [o(A), o(B), o(p(B, D, larg)), o(p(A, C, larg))];
    const nq = cruz(sub(q[1], q[0]), sub(q[2], q[0]));
    M.poli(nq[0] * n[0] + nq[1] * n[1] + nq[2] * n[2] > 0 ? q : q.reverse(), PARTE.PINTURA);
  };
  for (const s of [-1, 1]) {
    const iB = s < 0 ? 0 : 5; // a borda (sobre a lateral)
    const iD = s < 0 ? 2 : 3; // o ponto de dentro do vidro
    const iT = s < 0 ? 1 : 4; // a quina do teto
    // para-brisa (k = 2 para 3): da quina do teto à base, crescendo para dentro
    coluna(E[3][iB], E[2][iT], E[3][iD], E[2][iD], 0.16, 1);
    // vidro de trás (k = 0 para 1)
    coluna(E[0][iB], E[1][iT], E[0][iD], E[1][iD], 0.2, -1);
  }
  // janelas das portas: na lateral da estufa, por dentro das colunas, com a coluna do meio escura entre elas
  const hJ = hR - 0.05;
  const yJ = yc + 0.04;
  const xNa = (y) => wb + ((wr - wb) * (y - yc)) / (hR - yc);
  const zA = (y) => zPB + ((z(fTF) - zPB) * (y - yc)) / (hR - yc) - 0.08;
  // a borda de trás acompanha o vidro de trás (na picape ele é quase em pé: com a borda reta, o vidro da porta passava
  // da cabine no alto)
  const zC = (y) => zVT + ((z(fTT) - zVT) * (y - yc)) / (hR - yc) + (m.cacamba ? 0.06 : 0.12);
  const zB = z(fTT) + (z(fTF) - z(fTT)) * (m.cacamba ? 0.55 : 0.47);
  for (const s of [-1, 1]) {
    const v = (zz, y) => [s * (xNa(y) + 0.005), y, zz];
    for (const [za, zb] of [[zC, () => zB - 0.05], [() => zB + 0.05, zA]]) {
      const q = [v(za(yJ), yJ), v(zb(yJ), yJ), v(zb(hJ), hJ), v(za(hJ), hJ)];
      if (q[1][2] - q[0][2] < 0.15) continue;
      M.poli(s > 0 ? q.reverse() : q, PARTE.VIDRO);
    }
  }
  M.corpo = M.idx.length;
  // retrovisores: a carcaça da cor do carro, o espelho virado para trás, na base da coluna A
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? wb + 0.02 : -wb - 0.17;
    const x1 = s > 0 ? wb + 0.17 : -wb - 0.02;
    caixa(M, x0, yc - 0.01, zPB - 0.26, x1, yc + 0.1, zPB - 0.16, PARTE.PINTURA, PARTE.PINTURA, PARTE.PINTURA, PARTE.VIDRO, s);
  }
  // rodas e caixas de roda
  const eixoF = m.eixos / 2 + m.c * 0.02;
  const eixoT = -m.eixos / 2 + m.c * 0.02;
  for (const zz of [eixoF, eixoT]) {
    for (const lado of [-1, 1]) {
      roda(M, lado * (w - 0.1), m.roda, zz, m.roda, 0.22, lado, 7, { cima: false });
      caixaDeRoda(M, w + 0.004, m.roda, zz, m.roda + 0.01, m.roda + (m.plastico ? 0.11 : 0.065), lado, m.plastico ? PARTE.PLASTICO : PARTE.PRETO);
    }
  }
  // faróis e lanternas assentados no bico e na traseira (antes da grade e da placa: as peças não contam como
  // superfície); as lanternas na tampa do hatch e do SUV, no painel de trás do sedã e na tampa da caçamba
  const yLanterna = m.cacamba ? yTras - 0.32 : yTras - 0.25;
  for (const s of [-1, 1]) {
    assentar(M, s * (w - 0.14), s * (w - 0.45), yCapo - 0.2, 0.1, 1, zF, 1, 1, PARTE.FAROL, 0.006);
    assentar(M, s * (w - 0.09), s * (w - 0.39), yLanterna, 0.14, -1, zT, 1, 1, PARTE.LANTERNA, 0.006);
  }
  // a lanterna dobra a quina: um pedaço na lateral, na chapa entre as estações de 0,065 e 0,22 m
  for (const s of [-1, 1]) {
    const x = (zz) => w - 0.065 + (0.055 * (zz - zT - 0.065)) / 0.155 + 0.004;
    const za = zT + 0.09;
    const zb = zT + 0.2;
    const q = [[s * x(za), yLanterna, za], [s * x(zb), yLanterna, zb], [s * x(zb), yLanterna + 0.12, zb], [s * x(za), yLanterna + 0.12, za]];
    M.poli(s > 0 ? q.reverse() : q, PARTE.LANTERNA);
  }
  // grade entre os faróis, a tomada de ar e a placa da frente; atrás, a placa e o difusor de plástico
  assentar(M, -(w - 0.44), w - 0.44, yCapo - 0.26, 0.12, 1, zF, 2, 1, PARTE.PRETO, 0.004, false);
  assentar(M, -(w - 0.4), w - 0.4, y0 + 0.1, 0.13, 1, zF, 2, 1, PARTE.PLASTICO, 0.004, false);
  assentar(M, -0.2, 0.2, y0 + 0.25, 0.13, 1, zF, 1, 1, PARTE.PLACA, 0.007, false);
  assentar(M, 0.2, -0.2, m.cacamba ? y0 + 0.28 : ymT + 0.06, 0.13, -1, zT, 1, 1, PARTE.PLACA, 0.007, false);
  assentar(M, w - 0.36, -(w - 0.36), y0 + 0.13, 0.1, -1, zT, 2, 1, PARTE.PLASTICO, 0.004, false);
  return M.fechar();
}

/**
 * Normais almofadadas de uma malha em caixas (ônibus e VUC): a da face misturada com a direção do centro da caixa
 * (expoente 2), na pintura e no cromado. A lataria grande e plana deixa de virar um bloco de luz com o sol baixo.
 */
function almofadar(Mx, cx, cy, hx, hy, hz, peso = 0.5) {
  const { posicao: P, normal: N, parte } = Mx;
  for (let v = 0; v < parte.length; v++) {
    if (parte[v] !== PARTE.PINTURA && parte[v] !== PARTE.CROMADO) continue;
    const r = [(P[3 * v] - cx) / hx, (P[3 * v + 1] - cy) / hy, P[3 * v + 2] / hz];
    const g = r.map((x) => Math.sign(x) * x * x);
    const n = norma([N[3 * v] + g[0] * peso, N[3 * v + 1] + g[1] * peso, N[3 * v + 2] + g[2] * peso]);
    // nunca vira para dentro da face
    if (n[0] * N[3 * v] + n[1] * N[3 * v + 1] + n[2] * N[3 * v + 2] < 0.5) continue;
    N.set(n, 3 * v);
  }
  return Mx;
}

/** Laterais retas em loft (ônibus e VUC): seções { z, pts } com o mesmo número de pontos e as tampas. */
function loft(M, secoes, partes, { tampas = true, parteTampa = null } = {}) {
  const n = secoes[0].pts.length;
  for (let k = 0; k + 1 < secoes.length; k++) {
    const A = secoes[k];
    const B = secoes[k + 1];
    for (let i = 0; i + 1 < n; i++) {
      const p = typeof partes === 'function' ? partes(k, i) : partes[i];
      if (p < 0) continue;
      M.poli([[A.pts[i][0], A.pts[i][1], A.z], [B.pts[i][0], B.pts[i][1], B.z], [B.pts[i + 1][0], B.pts[i + 1][1], B.z], [A.pts[i + 1][0], A.pts[i + 1][1], A.z]], p);
    }
  }
  if (tampas) {
    const t0 = secoes[0];
    const t1 = secoes[secoes.length - 1];
    const pt = parteTampa ?? (typeof partes === 'function' ? partes(0, 0) : partes[0]);
    M.poli(t0.pts.map(([x, y]) => [x, y, t0.z]), pt);
    M.poli([...t1.pts].reverse().map(([x, y]) => [x, y, t1.z]), pt);
  }
}

/** Faróis (frente) e lanternas (atrás) num ônibus ou num VUC. */
function luzes(M, w, zF, zT, yF, yT, alt, larg, recuo, margemF = 0.08) {
  for (const s of [-1, 1]) {
    assentar(M, s * (w - margemF), s * (w - margemF - larg), yF, alt, 1, zF, 2, 1, PARTE.FAROL, recuo);
    assentar(M, s * (w - 0.08), s * (w - 0.08 - larg), yT, alt, -1, zT, 2, 1, PARTE.LANTERNA, recuo);
  }
}

/** Ônibus urbano: caixa com a faixa de janelas, para-brisa inteiro e seis rodas. */
function onibusLOD0(m) {
  const M = new Malha();
  const w = m.l / 2;
  const zT = -m.c / 2;
  const zF = m.c / 2;
  const [j0, j1] = m.janela;
  const y0 = m.vao;
  const sec = (ww) => [[-ww + 0.1, y0], [-ww, y0 + 0.1], [-ww, j0], [-ww, j1], [-ww + 0.1, m.h], [ww - 0.1, m.h], [ww, j1], [ww, j0], [ww, y0 + 0.1], [ww - 0.1, y0]];
  const secoes = [{ z: zT, pts: sec(w - 0.02) }, { z: zT + 0.15, pts: sec(w) }, { z: zF - 0.3, pts: sec(w) }, { z: zF, pts: sec(w - 0.05) }];
  loft(M, secoes, (k, i) => (i === 9 ? -1 : i === 2 || i === 6 ? PARTE.VIDRO : PARTE.PINTURA), { parteTampa: PARTE.PINTURA });
  // para-brisa e vidro de trás
  M.poli([[-w + 0.1, j0 - 0.3, zF + 0.01], [w - 0.1, j0 - 0.3, zF + 0.01], [w - 0.1, m.h - 0.15, zF + 0.01], [-w + 0.1, m.h - 0.15, zF + 0.01]], PARTE.VIDRO);
  M.poli([[w - 0.2, j0 + 0.2, zT - 0.01], [-w + 0.2, j0 + 0.2, zT - 0.01], [-w + 0.2, j1, zT - 0.01], [w - 0.2, j1, zT - 0.01]], PARTE.VIDRO);
  M.corpo = M.idx.length;
  for (const zz of [m.eixos / 2 + 0.3, -m.eixos / 2 + 0.3, -m.eixos / 2 - 1.1]) for (const lado of [-1, 1]) roda(M, lado * (w - 0.18), m.roda, zz, m.roda, 0.3, lado, 6);
  luzes(M, w, zF, zT, 0.55, 0.7, 0.2, 0.3, 0.012);
  return almofadar(M.fechar(), 0, m.h / 2, w, m.h / 2, m.c / 2, 0.35);
}

/** Caminhão leve (VUC): cabine e baú. */
function caminhaoLOD0(m) {
  const M = new Malha();
  const w = m.l / 2;
  const zT = -m.c / 2;
  const zF = m.c / 2;
  const zCab = zF - m.cab;
  const y0 = m.vao + 0.35;
  // baú
  const bau = [[-w, y0 + 0.4], [-w, m.h], [w, m.h], [w, y0 + 0.4]];
  loft(M, [{ z: zT, pts: bau }, { z: zCab - 0.15, pts: bau }], [PARTE.CROMADO, PARTE.CROMADO, PARTE.CROMADO], { parteTampa: PARTE.CROMADO });
  // chassi
  const ch = [[-w + 0.3, m.vao + 0.3], [-w + 0.3, y0 + 0.4], [w - 0.3, y0 + 0.4], [w - 0.3, m.vao + 0.3]];
  loft(M, [{ z: zT + 0.3, pts: ch }, { z: zCab, pts: ch }], [PARTE.PRETO, PARTE.PRETO, PARTE.PRETO], { tampas: false });
  // cabine
  const hc = m.h - 0.4;
  const cab = [[-w + 0.05, y0], [-w + 0.05, m.cintura + 0.35], [-w + 0.15, hc], [w - 0.15, hc], [w - 0.05, m.cintura + 0.35], [w - 0.05, y0]];
  loft(M, [{ z: zCab, pts: cab }, { z: zF - 0.35, pts: cab }, { z: zF, pts: cab.map(([x, y]) => [x * 0.97, y > m.cintura ? y - 0.12 : y]) }],
    (k, i) => (i === 1 ? PARTE.VIDRO : i === 3 ? PARTE.VIDRO : PARTE.PINTURA), { parteTampa: PARTE.PINTURA });
  M.poli([[-w + 0.2, m.cintura + 0.4, zF + 0.01], [w - 0.2, m.cintura + 0.4, zF + 0.01], [w - 0.25, hc - 0.15, zF - 0.1], [-w + 0.25, hc - 0.15, zF - 0.1]], PARTE.VIDRO);
  M.corpo = M.idx.length;
  for (const zz of [zF - 0.95, zF - 0.95 - m.eixos]) for (const lado of [-1, 1]) roda(M, lado * (w - 0.2), m.roda, zz, m.roda, 0.3, lado, 6);
  luzes(M, w, zF, zT, y0 + 0.1, y0 + 0.2, 0.16, 0.3, 0.01, 0.12);
  // para-choque, retrovisores em braço e o tanque de diesel do lado esquerdo, entre os eixos
  caixa(M, -w + 0.02, m.vao + 0.12, zF - 0.02, w - 0.02, y0 + 0.02, zF + 0.1, PARTE.PRETO);
  for (const s of [-1, 1]) caixa(M, s > 0 ? w + 0.02 : -w - 0.14, m.cintura + 0.3, zF - 0.62, s > 0 ? w + 0.14 : -w - 0.02, m.cintura + 0.72, zF - 0.54, PARTE.PRETO);
  caixa(M, w - 0.62, m.vao + 0.18, zF - 1.9, w - 0.12, m.vao + 0.62, zF - 1.35, PARTE.CROMADO);
  return almofadar(M.fechar(), 0, m.h / 2, w, m.h / 2, m.c / 2, 0.35);
}

/** LOD1: carroceria e cabine em caixas (sem fundo), 20 triângulos; as pontas de baixo levam os faróis e as lanternas. */
function carroLOD1(m) {
  const M = new Malha();
  const w = m.l / 2;
  const zT = -m.c / 2;
  const zF = m.c / 2;
  if (m.onibus) {
    caixa(M, -w, m.vao, zT, w, m.janela[0], zF, PARTE.PINTURA, PARTE.PINTURA, PARTE.FRENTE, PARTE.TRASEIRA);
    caixa(M, -w, m.janela[0], zT, w, m.h, zF, PARTE.VIDRO, PARTE.PINTURA);
  } else if (m.caminhao) {
    caixa(M, -w, m.vao + 0.4, zT, w, m.h, zF - m.cab - 0.15, PARTE.CROMADO, PARTE.CROMADO, PARTE.CROMADO, PARTE.TRASEIRA);
    caixa(M, -w + 0.05, m.vao + 0.2, zF - m.cab, w - 0.05, m.h - 0.4, zF, PARTE.PINTURA, PARTE.PINTURA, PARTE.FRENTE);
  } else {
    const [fPB, fTF, fTT, fVT] = m.cabine;
    caixa(M, -w, m.vao, zT, w, m.cintura, zF, PARTE.PINTURA, PARTE.PINTURA, PARTE.FRENTE, PARTE.TRASEIRA);
    caixa(M, -w + 0.12, m.cintura, zT + (fVT + (fTT - fVT) * 0.5) * m.c, w - 0.12, m.h, zT + (fTF + (fPB - fTF) * 0.5) * m.c, PARTE.VIDRO, PARTE.PINTURA, PARTE.VIDRO);
  }
  return M.fechar();
}

/**
 * Sombra de contato (desenho do render 4.5 e 2.5: carro não projeta na sombra própria): um quadrilátero escuro no chão,
 * um pouco maior que o carro, que o assenta na pista de dia sem custo de passe.
 */
function comSombra(m, malha) {
  const w = m.l / 2 + 0.12;
  const c = m.c / 2 + 0.15;
  const nv = malha.posicao.length / 3;
  const pos = new Float32Array(malha.posicao.length + 12);
  pos.set(malha.posicao);
  pos.set([-w, 0.03, c, w, 0.03, c, w, 0.03, -c, -w, 0.03, -c], nv * 3);
  const nor = new Float32Array(malha.normal.length + 12);
  nor.set(malha.normal);
  nor.set([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], nv * 3);
  const parte = new Uint8Array(nv + 4);
  parte.set(malha.parte);
  parte.fill(PARTE.SOMBRA, nv);
  const idx = new Uint16Array(malha.indices.length + 6);
  idx.set(malha.indices);
  idx.set([nv, nv + 1, nv + 2, nv, nv + 2, nv + 3], malha.indices.length);
  return { posicao: pos, normal: nor, parte, indices: idx, tris: idx.length / 3 };
}

const cache = new Map();

/**
 * Malha de um modelo (índice em MODELOS ou id) no LOD pedido (0 ou 1): { posicao, normal, parte, indices, tris }.
 * Guardada: a mesma para o mesmo pedido.
 */
export function malhaVeiculo(modelo, lod = 0) {
  const m = typeof modelo === 'number' ? MODELOS[modelo] : MODELOS.find((x) => x.id === modelo);
  if (!m) throw new Error(`veículo desconhecido: ${modelo}`);
  const k = `${m.id}:${lod}`;
  if (!cache.has(k)) cache.set(k, comSombra(m, lod ? carroLOD1(m) : m.onibus ? onibusLOD0(m) : m.caminhao ? caminhaoLOD0(m) : carroLOD0(m)));
  return cache.get(k);
}

/** Os modelos de carro são usados na thread principal (instâncias); este módulo não registra tipo na oficina. */
export function registrar() {}
