// Modelos de gente (desenho do render 8), puros: a figura de 1,70 m com a silhueta real (cabeça, pescoço, tronco com
// ombro, cintura e quadril, braços com mão, pernas com joelho e pé), em LOD0 de cerca de 270 triângulos e LOD1 de 30.
// Cada vértice diz a parte (pele, cabelo, roupa de cima e de baixo, sapato, manga, canela, cabelo longo, saia, bolsa)
// e o membro (tronco, coxa, canela e braço de cada lado): a caminhada é no vértice (shaders/pessoa.glsl.js), girando
// a perna no quadril e dobrando o joelho, e o braço no ombro, pela fase da instância. aVar desloca a silhueta para a
// feminina (ombro mais estreito, cintura marcada, quadril e busto), misturada pela instância. A frente olha para +z e
// a origem fica no chão, entre os pés; a altura de cada um (1,55 a 1,90 m) é a escala da instância.
// Só o render usa (thread principal, sob demanda); não registra tipo na oficina.

/** Partes (aCorpo.x no shader). */
export const PARTE_PESSOA = Object.freeze({
  PELE: 0, CABELO: 1, CIMA: 2, BAIXO: 3, SAPATO: 4, BRACO: 5, ANTEBRACO: 6, CANELA: 7, CABELO_LONGO: 8, SAIA: 9, BOLSA: 10,
});
/** Membros (aCorpo.y no shader): 0 tronco e cabeça; lado A (x > 0) e B (x < 0). */
export const MEMBRO = Object.freeze({ TRONCO: 0, COXA_A: 1, CANELA_A: 2, COXA_B: 3, CANELA_B: 4, BRACO_A: 5, BRACO_B: 6 });
/** Articulações (m, na figura de 1,70 m): quadril, joelho e ombro (o shader gira em volta delas). */
export const JUNTA = Object.freeze({ quadril: 0.9, joelho: 0.48, ombro: 1.39, ombroX: 0.2 });
/** Altura da figura do modelo (m). */
export const ALTURA_MODELO = 1.7;

const P = PARTE_PESSOA;
const M = MEMBRO;

/** Construtor simples (faces planas, sem índice compartilhado entre faces). */
class Figura {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.corpo = [];
    this.vari = [];
    this.idx = [];
  }

  get nv() {
    return this.pos.length / 3;
  }

  /**
   * Polígono convexo plano (pontos [x, y, z] em ordem anti-horária vista de fora), com a parte, o membro e o
   * deslocamento feminino de cada ponto (dv: função do ponto, ou null).
   */
  poli(pts, parte, membro, dv = null) {
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
      this.corpo.push(parte, membro);
      const d = dv ? dv(p) : null;
      this.vari.push(d ? d[0] : 0, d ? d[1] : 0, d ? d[2] : 0);
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
      corpo: Float32Array.from(this.corpo),
      variacao: Float32Array.from(this.vari),
      indices: Uint16Array.from(this.idx),
      tris: this.idx.length / 3,
    };
  }
}

/** Anel de n pontos em volta de (cx, cz) na altura y, com meia largura rx e meia profundidade rz (começa na frente). */
function anel(n, cx, y, cz, rx, rz, giro = 0) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = giro + (2 * Math.PI * k) / n;
    out.push([cx + Math.sin(a) * rx, y, cz + Math.cos(a) * rz]);
  }
  return out;
}

/**
 * Tubo entre anéis (do de baixo para o de cima), faces para fora; partes por faixa (partes[k] entre o anel k e k+1).
 * tampaCima e tampaBaixo fecham as pontas.
 */
function tubo(F, aneis, partes, membro, dv, { tampaCima = null, tampaBaixo = null } = {}) {
  const n = aneis[0].length;
  for (let k = 0; k + 1 < aneis.length; k++) {
    const A = aneis[k];
    const B = aneis[k + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      // o anel gira no sentido de x crescente a partir da frente (+z): de fora, a face sobe pela esquerda
      F.poli([A[i], A[j], B[j], B[i]], partes[k], membro, dv);
    }
  }
  if (tampaCima !== null) F.poli([...aneis[aneis.length - 1]], tampaCima, membro, dv);
  if (tampaBaixo !== null) F.poli([...aneis[0]].reverse(), tampaBaixo, membro, dv);
}

/** Caixa sem o fundo (topo e 4 lados), com a parte e o membro. */
function caixa(F, x0, y0, z0, x1, y1, z1, parte, membro, dv = null, fundo = false) {
  F.poli([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], parte, membro, dv);
  F.poli([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], parte, membro, dv);
  F.poli([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], parte, membro, dv);
  F.poli([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], parte, membro, dv);
  F.poli([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], parte, membro, dv);
  if (fundo) F.poli([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], parte, membro, dv);
}

// deslocamentos da silhueta feminina por altura (x: estreita ou alarga para os lados; z: busto e quadril)
function femininoTronco(p) {
  const [x, y, z] = p;
  const sx = Math.sign(x);
  if (y > 1.36) return [-0.03 * sx, 0, 0]; // ombro mais estreito
  if (y > 1.18) return [-0.012 * sx, 0, z > 0 ? 0.022 : 0]; // busto
  if (y > 0.98) return [-0.025 * sx, 0, 0]; // cintura marcada
  if (y > 0.84) return [0.022 * sx, 0, z < 0 ? -0.012 : 0]; // quadril
  return [0.01 * sx, 0, 0];
}
const femininoBraco = (p) => [-0.028 * Math.sign(p[0]), 0, 0];
const femininoCoxa = (p) => (p[1] > 0.7 ? [0.012 * Math.sign(p[0]), 0, 0] : [0, 0, 0]);

/** LOD0: a figura inteira (cerca de 270 triângulos). */
function figuraLOD0() {
  const F = new Figura();
  // pernas: coxa (quadril ao joelho) e canela (joelho ao tornozelo), 6 lados, e o pé
  for (const lado of [1, -1]) {
    const x = 0.095 * lado;
    const coxa = lado > 0 ? M.COXA_A : M.COXA_B;
    const canela = lado > 0 ? M.CANELA_A : M.CANELA_B;
    tubo(F, [anel(6, x, JUNTA.joelho, 0.005, 0.058, 0.062), anel(6, x, 0.84, 0, 0.082, 0.088)], [P.BAIXO], coxa, femininoCoxa);
    tubo(F, [anel(6, x, 0.09, -0.01, 0.04, 0.045), anel(6, x, JUNTA.joelho, 0.005, 0.058, 0.062)], [P.CANELA], canela, null);
    // pé: do calcanhar à ponta, mais baixo na frente
    const pts = [[x - 0.05, 0, -0.06], [x + 0.05, 0, -0.06], [x + 0.05, 0, 0.19], [x - 0.05, 0, 0.19]];
    const t = [[x - 0.048, 0.1, -0.05], [x + 0.048, 0.1, -0.05], [x + 0.045, 0.055, 0.17], [x - 0.045, 0.055, 0.17]];
    F.poli([pts[1], t[1], t[2], pts[2]], P.SAPATO, canela);
    F.poli([pts[3], t[3], t[0], pts[0]], P.SAPATO, canela);
    F.poli([pts[2], t[2], t[3], pts[3]], P.SAPATO, canela);
    F.poli([pts[0], t[0], t[1], pts[1]], P.SAPATO, canela);
    F.poli([t[0], t[3], t[2], t[1]], P.SAPATO, canela);
  }
  // tronco: virilha, quadril, cintura, peito, ombro e a base do pescoço (6 lados, mais largo que fundo)
  const aneisTronco = [
    anel(6, 0, 0.8, 0, 0.15, 0.1, Math.PI / 6),
    anel(6, 0, 0.94, 0, 0.175, 0.11, Math.PI / 6),
    anel(6, 0, 1.06, 0.005, 0.158, 0.1, Math.PI / 6),
    anel(6, 0, 1.25, 0.01, 0.185, 0.12, Math.PI / 6),
    anel(6, 0, 1.4, 0, 0.205, 0.1, Math.PI / 6),
    anel(6, 0, 1.46, 0, 0.07, 0.065, Math.PI / 6),
  ];
  tubo(F, aneisTronco, [P.BAIXO, P.BAIXO, P.CIMA, P.CIMA, P.CIMA], M.TRONCO, femininoTronco);
  // pescoço e cabeça (6 lados): queixo, maçã do rosto, testa e o alto
  const cab = [anel(6, 0, 1.46, 0.005, 0.055, 0.055), anel(6, 0, 1.51, 0.02, 0.07, 0.085), anel(6, 0, 1.6, 0.015, 0.084, 0.1), anel(6, 0, 1.67, 0.005, 0.068, 0.085)];
  tubo(F, cab, [P.PELE, P.PELE, P.PELE], M.TRONCO, null);
  // cabelo: a calota do alto da cabeça, mais baixa atrás (a nuca) e com a franja na testa
  const c0 = anel(6, 0, 1.6, 0.01, 0.09, 0.106).map(([x, y, z]) => [x, z > 0.05 ? 1.63 : z < -0.05 ? 1.535 : 1.58, z]);
  const c1 = anel(6, 0, 1.675, 0.005, 0.075, 0.092);
  tubo(F, [c0, c1], [P.CABELO], M.TRONCO, null);
  const topo = [0, 1.715, 0];
  for (let i = 0; i < 6; i++) F.poli([c1[(i + 1) % 6], c1[i], topo], P.CABELO, M.TRONCO);
  // cabelo longo: a mecha atrás, da nuca até o meio das costas (some no shader se não for longo)
  caixa(F, -0.085, 1.3, -0.135, 0.085, 1.6, -0.07, P.CABELO_LONGO, M.TRONCO);
  // braços: do ombro ao cotovelo (manga e braço) e ao punho (antebraço), 4 lados, e a mão que afina até os dedos
  for (const lado of [1, -1]) {
    const x = (JUNTA.ombroX + 0.015) * lado;
    const m = lado > 0 ? M.BRACO_A : M.BRACO_B;
    const aneis = [anel(4, x, 0.84, 0.015, 0.034, 0.038), anel(4, x, 1.12, 0, 0.043, 0.047), anel(4, x * 0.98, 1.26, -0.005, 0.05, 0.052), anel(4, x * 0.97, 1.41, -0.01, 0.052, 0.058)];
    tubo(F, aneis, [P.ANTEBRACO, P.BRACO, P.CIMA], m, femininoBraco);
    const dedos = [x, 0.735, 0.02];
    const w = aneis[0];
    for (let i = 0; i < 4; i++) F.poli([w[(i + 1) % 4], w[i], dedos], P.PELE, m, femininoBraco);
  }
  // saia (some no shader se a roupa de baixo não for saia): da cintura até o joelho, abrindo
  tubo(F, [anel(6, 0, 0.53, 0, 0.215, 0.165, Math.PI / 6), anel(6, 0, 1.03, 0, 0.165, 0.11, Math.PI / 6)], [P.SAIA], M.TRONCO, femininoTronco);
  // bolsa de ombro, do lado B, no quadril
  caixa(F, -0.27, 0.9, -0.08, -0.205, 1.12, 0.1, P.BOLSA, M.TRONCO, null);
  return F.fechar();
}

/** LOD1: pernas em prismas de 3 lados (andam), o tronco e a cabeça numa coluna de 4 lados com o alto (30 triângulos). */
function figuraLOD1() {
  const F = new Figura();
  for (const lado of [1, -1]) {
    const x = 0.09 * lado;
    const m = lado > 0 ? M.COXA_A : M.COXA_B;
    // prisma: frente, trás e o lado de fora
    const b = [[x - 0.07 * lado, 0, 0.09], [x + 0.07 * lado, 0, 0], [x - 0.07 * lado, 0, -0.09]];
    const t = b.map(([px, , pz]) => [px, 0.86, pz]);
    const faces = [[0, 1], [1, 2], [2, 0]];
    for (const [i, j] of faces) {
      const q = [b[i], b[j], t[j], t[i]];
      F.poli(lado > 0 ? q : [q[1], q[0], q[3], q[2]], P.BAIXO, m);
    }
  }
  const a0 = anel(4, 0, 0.8, 0, 0.17, 0.11, Math.PI / 4);
  const a1 = anel(4, 0, 1.42, 0, 0.21, 0.11, Math.PI / 4);
  const a2 = anel(4, 0, 1.7, 0, 0.08, 0.09, Math.PI / 4);
  tubo(F, [a0, a1], [P.CIMA], M.TRONCO, femininoTronco);
  tubo(F, [a1, a2], [P.PELE], M.TRONCO, null, { tampaCima: P.CABELO });
  return F.fechar();
}

const cache = new Map();

/** Malha da figura no LOD pedido (0 ou 1): { posicao, normal, corpo, variacao, indices, tris }. Guardada. */
export function malhaPessoa(lod = 0) {
  if (!cache.has(lod)) cache.set(lod, lod ? figuraLOD1() : figuraLOD0());
  return cache.get(lod);
}

// ------------------------------------------------------------------------------------------------ roupas e tons

/** Tons de pele (sRGB), do mais claro ao mais escuro: a diversidade da população brasileira. */
export const TONS_PELE = Object.freeze([[236, 196, 166], [214, 167, 132], [176, 124, 88], [129, 86, 58], [86, 57, 40]]);
/** Cores de cabelo (sRGB): preto, castanho escuro, castanho claro e loiro escuro, grisalho. */
export const CABELOS = Object.freeze([[24, 20, 18], [58, 40, 30], [120, 88, 58], [150, 148, 144]]);

/** Roupas de cima (sRGB, peso): neutros na maioria, como numa rua de verdade; nada de verde-lima. */
const CIMA = Object.freeze([
  [[238, 238, 234], 14], [[205, 205, 200], 6], [[40, 40, 44], 12], [[28, 38, 66], 10], [[96, 124, 160], 7], [[150, 170, 196], 5],
  [[190, 172, 140], 6], [[120, 30, 38], 4], [[168, 74, 52], 4], [[84, 92, 62], 4], [[206, 160, 72], 3], [[214, 168, 170], 4],
  [[70, 70, 74], 6], [[176, 54, 48], 3], [[40, 92, 96], 3],
]);
/** Roupas de baixo (sRGB, peso): jeans, preto, cáqui, cinza, branco. */
const BAIXO = Object.freeze([
  [[44, 62, 98], 16], [[62, 86, 124], 10], [[28, 28, 32], 14], [[170, 150, 112], 7], [[96, 96, 98], 7], [[226, 224, 216], 4],
  [[70, 58, 48], 4], [[30, 40, 60], 6],
]);

function porPeso(lista, h) {
  const t = lista.reduce((a, [, w]) => a + w, 0);
  let x = h * t;
  for (const [v, w] of lista) {
    x -= w;
    if (x < 0) return v;
  }
  return lista[lista.length - 1][0];
}

/** Bits da roupa (aRoupa.a): cor do cabelo (0 a 3), cabelo longo, pernas de fora, saia, manga longa, bolsa. */
export const BITS_ROUPA = Object.freeze({ LONGO: 4, PERNAS: 8, SAIA: 16, MANGA: 32, BOLSA: 64 });

/**
 * A aparência de uma pessoa a partir de números de 0 a 1 (h(k) para k = 0, 1, 2...): sexo (0 ou 1), altura (m), as
 * cores de cima e de baixo (sRGB), o tom de pele (0 a 255) e os bits. Clima tropical: bermuda, saia e manga curta.
 * @param {(k: number) => number} h
 */
export function aparencia(h) {
  const fem = h(0) < 0.52 ? 1 : 0;
  // altura: mulheres 1,55 a 1,75; homens 1,63 a 1,90 (média brasileira de 1,61 e 1,73, com a cauda)
  const altura = fem ? 1.55 + 0.2 * (h(1) * 0.5 + h(2) * 0.5) : 1.63 + 0.27 * (h(1) * 0.5 + h(2) * 0.5);
  const pele = Math.floor(255 * Math.min(1, Math.max(0, h(3) * 0.85 + h(4) * 0.15)));
  // cabelo: escuro na maioria; claro só com pele clara; grisalho em 1 de 8
  let cabelo = h(5) < 0.12 ? 3 : h(5) < 0.55 ? 0 : 1;
  if (cabelo === 1 && pele < 70 && h(6) < 0.4) cabelo = 2;
  let bits = cabelo;
  if (fem ? h(7) < 0.75 : h(7) < 0.06) bits |= BITS_ROUPA.LONGO;
  const saia = fem && h(8) < 0.3;
  if (saia) bits |= BITS_ROUPA.SAIA | BITS_ROUPA.PERNAS;
  else if (h(8) > (fem ? 0.82 : 0.62)) bits |= BITS_ROUPA.PERNAS; // bermuda ou short
  if (h(9) < 0.22) bits |= BITS_ROUPA.MANGA;
  if (fem ? h(10) < 0.45 : h(10) < 0.08) bits |= BITS_ROUPA.BOLSA;
  const cima = porPeso(CIMA, h(11));
  // saia e vestido: às vezes da mesma cor de cima (o vestido)
  const baixo = saia && h(12) < 0.5 ? cima : porPeso(BAIXO, h(12));
  return { fem, altura, pele, bits, cima, baixo };
}

/** Os modelos de gente são usados na thread principal (instâncias); este módulo não registra tipo na oficina. */
export function registrar() {}
