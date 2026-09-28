// Modelos de carro da frota brasileira (desenho do render 8), puros: hatch (Onix, Gol), sedã (Virtus, Corolla), SUV
// (Compass, HR-V), picape média (Hilux, S10), ônibus urbano (Padron de 12 m) e caminhão leve (VUC com baú). Cada um
// com LOD0 (150 a 400 triângulos: carroceria em seções com ombro e caída do teto, vidros, rodas, faróis e lanternas)
// e LOD1 (12 a 24 triângulos: a carroceria e a cabine em caixas). Medidas reais, em metros; a frente olha para +z e
// a origem fica no chão, no meio do carro. A cor vem da instância (a frota: branco, prata, preto e cinza passam de
// 80%); aParte diz o que é cada vértice (pintura, vidro, pneu, farol, lanterna, cromado, aro) para o shader.

/**
 * Partes (aParte no shader). FRENTE e TRASEIRA são as faces de ponta do LOD1: pintura de dia e, à noite, os dois
 * faróis (ou as lanternas) desenhados no shader, para a cidade vista de longe ter as filas de luz.
 */
export const PARTE = Object.freeze({ PINTURA: 0, VIDRO: 1, PRETO: 2, FAROL: 3, LANTERNA: 4, CROMADO: 5, ARO: 6, SOMBRA: 7, FRENTE: 8, TRASEIRA: 9 });

/**
 * Medidas: comprimento, largura, altura do teto, altura da cintura (onde começam os vidros), vão livre, raio da roda,
 * entre-eixos, e as estações da cabine (fração do comprimento a partir da traseira): base do para-brisa, frente do
 * teto, fim do teto, base do vidro de trás.
 */
export const MODELOS = Object.freeze([
  { id: 'hatch', nome: 'hatch', c: 3.95, l: 1.72, h: 1.48, cintura: 0.95, vao: 0.16, roda: 0.3, eixos: 2.55, cabine: [0.66, 0.5, 0.18, 0.06], capo: 0.72 },
  { id: 'seda', nome: 'sedã', c: 4.55, l: 1.76, h: 1.46, cintura: 0.93, vao: 0.15, roda: 0.31, eixos: 2.65, cabine: [0.64, 0.5, 0.26, 0.18], capo: 0.72 },
  { id: 'suv', nome: 'SUV', c: 4.42, l: 1.82, h: 1.66, cintura: 1.05, vao: 0.2, roda: 0.34, eixos: 2.64, cabine: [0.66, 0.54, 0.14, 0.05], capo: 0.85 },
  { id: 'picape', nome: 'picape', c: 5.3, l: 1.86, h: 1.8, cintura: 1.12, vao: 0.25, roda: 0.37, eixos: 3.08, cabine: [0.64, 0.56, 0.4, 0.37], capo: 0.95, cacamba: 0.37 },
  { id: 'onibus', nome: 'ônibus', c: 12.4, l: 2.5, h: 3.1, cintura: 1.2, vao: 0.3, roda: 0.5, eixos: 6.2, janela: [1.2, 2.55], onibus: true },
  { id: 'caminhao', nome: 'caminhão', c: 7.1, l: 2.3, h: 3.05, cintura: 1.35, vao: 0.3, roda: 0.45, eixos: 3.9, cab: 1.85, caminhao: true },
]);

/** Construtor simples de malha (Float32, sem índice compartilhado entre faces: aresta viva). */
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

  /** Polígono convexo plano (pontos [x, y, z] em ordem, vistos de fora no sentido anti-horário). */
  poli(pts, parte) {
    const a = pts[0];
    const b = pts[1];
    const c = pts[2];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    // o primeiro trio pode ser colinear: procura um que não seja
    for (let k = 2; Math.hypot(...n) < 1e-9 && k + 1 < pts.length; k++) {
      const w = [pts[k + 1][0] - a[0], pts[k + 1][1] - a[1], pts[k + 1][2] - a[2]];
      n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    }
    const cn = Math.hypot(...n) || 1;
    const base = this.nv;
    for (const p of pts) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0] / cn, n[1] / cn, n[2] / cn);
      this.parte.push(parte);
    }
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
 * Loft de seções: secoes[k] = { z, pts: [[x, y], ...] } (mesmo número de pontos, contorno de baixo para cima pela
 * esquerda e de volta pela direita), faces entre seções com a parte de cada lado; tampas nas pontas.
 */
function loft(M, secoes, partes, { tampas = true, parteTampa = null } = {}) {
  const n = secoes[0].pts.length;
  for (let k = 0; k + 1 < secoes.length; k++) {
    const A = secoes[k];
    const B = secoes[k + 1];
    for (let i = 0; i + 1 < n; i++) {
      const p = typeof partes === 'function' ? partes(k, i) : partes[i];
      if (p < 0) continue;
      // anti-horário visto de fora (o contorno sobe pela esquerda e desce pela direita, visto da frente)
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

/** Seção da carroceria de baixo: arredondada nas quinas (8 pontos), de -w a w, de y0 a y1. */
function secaoBaixa(w, y0, y1, r = 0.1) {
  return [[-w + r, y0], [-w, y0 + r], [-w, y1 - r], [-w + r * 0.7, y1], [w - r * 0.7, y1], [w, y1 - r], [w, y0 + r], [w - r, y0]];
}

/** Caixa de x0..x1, y0..y1, z0..z1 sem o fundo (5 faces, 10 triângulos); topo, frente (+z) e trás podem ter outra parte. */
function caixa(M, x0, y0, z0, x1, y1, z1, parte, topo = parte, frente = parte, tras = parte) {
  M.poli([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], parte);
  M.poli([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], parte);
  M.poli([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], topo);
  M.poli([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], frente);
  M.poli([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], tras);
}

/** Roda: cilindro de 6 lados no eixo x, com o aro de fora. */
function roda(M, x, y, z, r, larg, lado) {
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI * 2 * k) / 6 + Math.PI / 6;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const xf = x + (lado * larg) / 2;
  const xd = x - (lado * larg) / 2;
  for (let k = 0; k < 6; k++) {
    const [z0, y0] = pts[k];
    const [z1, y1] = pts[(k + 1) % 6];
    const q = [[xf, y + y0, z + z0], [xf, y + y1, z + z1], [xd, y + y1, z + z1], [xd, y + y0, z + z0]];
    M.poli(lado > 0 ? q : [...q].reverse(), PARTE.PRETO);
  }
  const aro = pts.map(([zz, yy]) => [xf, y + yy * 0.62, z + zz * 0.62]);
  M.poli(lado > 0 ? [...aro].reverse() : aro, PARTE.ARO);
}

/**
 * Onde um raio paralelo a z, vindo de fora (sentido -dz), encosta na carroceria já feita em (x, y): o z da face mais de
 * fora, ou null se passa ao lado. Só vale uma face a menos de `janela` m para dentro do plano da ponta (zPonta): uma
 * roda ou a traseira da cabine lá no meio não servem. É o que assenta os faróis e as lanternas no capô e na tampa.
 */
function zNaSuperficie(M, x, y, dz, zPonta, janela = 0.45) {
  let melhor = null;
  const P = M.pos;
  for (let t = 0; t < M.idx.length; t += 3) {
    // as luzes já assentadas não contam como carroceria
    const pt = M.parte[M.idx[t]];
    if (pt === PARTE.FAROL || pt === PARTE.LANTERNA) continue;
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

/** Célula de luz: afundando mais que DIVIDIR na quina do bico, divide em 4 (uma vez); sai no máximo SAIDA_MAX (m). */
const DIVIDIR = 0.012;
const SAIDA_MAX = 0.03;

/**
 * Faróis e lanternas: grades finas de quadriláteros na frente e atrás, cada vértice assentado na carroceria (a face mais
 * de fora naquele x, y, perto da ponta) com um recuo para fora; sem face ali, o plano zF ou zT. Chame depois da
 * carroceria e antes das peças soltas (grade, para-choque). margemF: afastamento do farol da lateral.
 */
function luzes(M, w, zF, zT, yF, yT, alt = 0.14, larg = 0.34, recuo = 0.004, margemF = 0.08) {
  // grade de nx x ny células que acompanha a curva do bico (um quadrilátero só afundaria no meio)
  const grade = (xa, xb, y0, dz, zPonta, nx, ny, parte) => {
    const sup = (x, y) => zNaSuperficie(M, x, y, dz, zPonta);
    const vert = (x, y) => [x, y, (sup(x, y) ?? zPonta) + dz * recuo];
    // anti-horário visto de fora: na frente (dz = 1) x cresce para a direita; atrás, para a esquerda
    const vira = (xb > xa) !== (dz > 0);
    const celula = (x0, x1, y1, y2, prof) => {
      const q = [vert(x0, y1), vert(x1, y1), vert(x1, y2), vert(x0, y2)];
      // quanto a célula afunda na carroceria (a superfície faz barriga dentro dela)
      let fundo = 0;
      for (const [a, b] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]]) {
        const zc = (q[0][2] * (1 - a) + q[1][2] * a) * (1 - b) + (q[3][2] * (1 - a) + q[2][2] * a) * b;
        const zs = sup(x0 + (x1 - x0) * a, y1 + (y2 - y1) * b);
        if (zs !== null) fundo = Math.max(fundo, (zs + dz * recuo - zc) * dz);
      }
      if (fundo > DIVIDIR && prof < 1) {
        const xm = (x0 + x1) / 2;
        const ym = (y1 + y2) / 2;
        celula(x0, xm, y1, ym, prof + 1);
        celula(xm, x1, y1, ym, prof + 1);
        celula(x0, xm, ym, y2, prof + 1);
        celula(xm, x1, ym, y2, prof + 1);
        return;
      }
      for (const p of q) p[2] += dz * Math.min(SAIDA_MAX, fundo);
      M.poli(vira ? q.reverse() : q, parte);
    };
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        celula(xa + ((xb - xa) * i) / nx, xa + ((xb - xa) * (i + 1)) / nx, y0 + (alt * j) / ny, y0 + (alt * (j + 1)) / ny, 0);
      }
    }
  };
  for (const s of [-1, 1]) {
    grade(s * (w - margemF), s * (w - margemF - larg), yF, 1, zF, 2, 1, PARTE.FAROL);
    grade(s * (w - 0.08), s * (w - 0.08 - larg), yT, -1, zT, 2, 1, PARTE.LANTERNA);
  }
}

/** Carro de passeio (hatch, sedã, SUV, picape): LOD0. */
function carroLOD0(m) {
  const M = new Malha();
  const w = m.l / 2;
  const zT = -m.c / 2;
  const zF = m.c / 2;
  const y0 = m.vao;
  const yc = m.cintura;
  const yCapo = m.capo;
  // carroceria de baixo: para-choque, capô que sobe até a cintura no para-brisa, porta-malas
  const z = (f) => zT + f * m.c;
  const [fPB, fTF, fTT, fVT] = m.cabine;
  const est = [
    [z(0), w - 0.1, y0 + 0.08, yCapo - 0.12],
    [z(0.04), w, y0, m.cacamba ? yc : yCapo - 0.02],
    [z(fVT), w, y0, yc],
    [z(fPB), w, y0, yc],
    [z(0.9), w, y0, yCapo],
    [z(0.97), w - 0.04, y0 + 0.04, yCapo - 0.05],
    [z(1), w - 0.12, y0 + 0.12, yCapo - 0.16],
  ];
  const secoes = est.map(([zz, ww, a, b]) => ({ z: zz, pts: secaoBaixa(ww, a, b, 0.1) }));
  // faces: baixo preto (pneus e assoalho), resto pintura; a faixa de baixo dos lados em plástico preto no SUV
  loft(M, secoes, (k, i) => (i === 7 ? -1 : i === 0 || i === 6 ? (m.id === 'suv' || m.id === 'picape' ? PARTE.PRETO : PARTE.PINTURA) : PARTE.PINTURA), { parteTampa: PARTE.PINTURA });
  // assoalho
  M.poli([[-w + 0.1, y0, zF - 0.1], [w - 0.1, y0, zF - 0.1], [w - 0.1, y0, zT + 0.1], [-w + 0.1, y0, zT + 0.1]].reverse(), PARTE.PRETO);
  // cabine: da base do para-brisa (cintura) ao teto e à base do vidro de trás, com a caída do teto (tumblehome)
  const wb = w - 0.04;
  const wr = w - 0.2;
  const zc = [z(fVT), z(fTT), z(fTF), z(fPB)];
  const alto = [yc, m.h, m.h, yc];
  const cab = zc.map((zz, k) => ({ z: zz, pts: [[-wb, yc], [-(k === 0 || k === 3 ? wb - 0.02 : wr), alto[k]], [k === 0 || k === 3 ? wb - 0.02 : wr, alto[k]], [wb, yc]] }));
  loft(M, cab, (k, i) => (k === 1 ? (i === 1 ? PARTE.PINTURA : PARTE.VIDRO) : PARTE.VIDRO), { tampas: false });
  // caçamba da picape: o piso afundado e a tampa (caixa aberta desenhada por dentro)
  if (m.cacamba) {
    const zc0 = z(0.04);
    const zc1 = z(fVT) - 0.02;
    M.poli([[-w + 0.08, yc - 0.45, zc1], [w - 0.08, yc - 0.45, zc1], [w - 0.08, yc - 0.45, zc0], [-w + 0.08, yc - 0.45, zc0]], PARTE.PRETO);
  }
  // rodas
  const eixoF = m.eixos / 2 + (m.c * 0.02);
  const eixoT = -m.eixos / 2 + (m.c * 0.02);
  for (const zz of [eixoF, eixoT]) for (const lado of [-1, 1]) roda(M, lado * (w - 0.1), m.roda, zz, m.roda, 0.22, lado);
  // faróis e lanternas assentados no bico e na traseira (antes da grade: a grade não conta como superfície): as
  // lanternas na tampa do hatch e do SUV, no painel de trás do sedã (porta-malas comprido) e na tampa da caçamba
  const yLanterna = m.cacamba ? yc - 0.3 : fVT > 0.1 ? yCapo - 0.19 : yc - 0.18;
  luzes(M, w, zF, zT, yCapo - 0.24, yLanterna, 0.14, 0.3, 0.006, 0.1);
  M.poli([[-0.35, yCapo - 0.3, zF + 0.001], [0.35, yCapo - 0.3, zF + 0.001], [0.35, yCapo - 0.18, zF + 0.001], [-0.35, yCapo - 0.18, zF + 0.001]], PARTE.PRETO);
  return M.fechar();
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
  loft(M, secoes, (k, i) => (i === 9 ? -1 : i === 2 || i === 6 ? (k === 2 ? PARTE.VIDRO : PARTE.VIDRO) : PARTE.PINTURA), { parteTampa: PARTE.PINTURA });
  // para-brisa e vidro de trás
  M.poli([[-w + 0.1, j0 - 0.3, zF + 0.01], [w - 0.1, j0 - 0.3, zF + 0.01], [w - 0.1, m.h - 0.15, zF + 0.01], [-w + 0.1, m.h - 0.15, zF + 0.01]], PARTE.VIDRO);
  M.poli([[w - 0.2, j0 + 0.2, zT - 0.01], [-w + 0.2, j0 + 0.2, zT - 0.01], [-w + 0.2, j1, zT - 0.01], [w - 0.2, j1, zT - 0.01]], PARTE.VIDRO);
  for (const zz of [m.eixos / 2 + 0.3, -m.eixos / 2 + 0.3, -m.eixos / 2 - 1.1]) for (const lado of [-1, 1]) roda(M, lado * (w - 0.18), m.roda, zz, m.roda, 0.3, lado);
  luzes(M, w, zF, zT, 0.55, 0.7, 0.2, 0.3, 0.012);
  return M.fechar();
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
  for (const zz of [zF - 0.95, zF - 0.95 - m.eixos]) for (const lado of [-1, 1]) roda(M, lado * (w - 0.2), m.roda, zz, m.roda, 0.3, lado);
  luzes(M, w, zF, zT, y0 + 0.1, y0 + 0.2, 0.16, 0.3, 0.01, 0.12);
  // para-choque, retrovisores em braço e o tanque de diesel do lado esquerdo, entre os eixos
  caixa(M, -w + 0.02, m.vao + 0.12, zF - 0.02, w - 0.02, y0 + 0.02, zF + 0.1, PARTE.PRETO);
  for (const s of [-1, 1]) caixa(M, s > 0 ? w + 0.02 : -w - 0.14, m.cintura + 0.3, zF - 0.62, s > 0 ? w + 0.14 : -w - 0.02, m.cintura + 0.72, zF - 0.54, PARTE.PRETO);
  caixa(M, w - 0.62, m.vao + 0.18, zF - 1.9, w - 0.12, m.vao + 0.62, zF - 1.35, PARTE.CROMADO);
  return M.fechar();
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
