// Vida de luxo na água e no céu (R6, D61): malhas e planos puros, sem three. Três modelos em metros (1 unidade = 1 m,
// proa em +z com rot = 0, y = 0 na linha d'água ou no eixo da fuselagem), cor por vértice:
//   iate     motor yacht de 42 m na linha do Benetti Motopanfilo e do Azimut Grande (casco branco de boca 8,4 m, três
//            conveses recuados com faixa de janelas, flybridge com mastro e radar, plataforma de popa em teca)
//   cruzeiro navio de 300 m na linha do MSC Meraviglia e do Costa Smeralda (casco azul-marinho com a obra viva vermelha,
//            nove conveses brancos com sacadas, passarelas da ponte, ponte, chaminé com faixa e baleeiras laranja)
//   jato     executivo de longo alcance de 30 m na linha do Gulfstream G650 e do Bombardier Global 7500 (fuselagem de
//            1,25 m de raio, asa enflechada de 30 m, cauda em T, dois motores na popa, filete azul e dourado)
// A cor de cada face vem do desenho; o domínio (vida/*.js) só instancia. LOD1 de cada um: cunha e blocos (algumas
// dezenas de triângulos). Os planos (onde fica a marina, a rota do cruzeiro, as rotas dos jatos) leem o terreno do
// espelho (T.agua) e a semente do mapa, sem sorteio fora do hash.
import { AGUA } from '../../contratos/flags.js';
import { hashF } from './ruido.js';

/** sRGB hex para linear. */
export function linear(hex) {
  const v = (k) => {
    const c = parseInt(hex.slice(1 + 2 * k, 3 + 2 * k), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [v(0), v(1), v(2)];
}

const cruz = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const media = (P) => {
  const s = [0, 0, 0];
  for (const p of P) for (let q = 0; q < 3; q++) s[q] += p[q] / P.length;
  return s;
};

/**
 * Malha de cor por vértice. A orientação de cada face vem de um ponto de dentro do corpo (`dentro`): a normal sempre
 * olha para longe dele, então a ordem dos pontos de quem desenha não importa.
 */
export class MalhaCor {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.cor = [];
    this.idx = [];
  }

  get nv() {
    return this.pos.length / 3;
  }

  get tris() {
    return this.idx.length / 3;
  }

  vert(p, n, c) {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.cor.push(c[0], c[1], c[2]);
    return this.nv - 1;
  }

  /** Polígono convexo plano, normal da face, virado para longe de `dentro`. */
  poli(pts, cor, dentro) {
    let n = [0, 0, 0];
    for (let k = 1; k + 1 < pts.length && Math.hypot(...n) < 1e-9; k++) n = cruz(sub(pts[k], pts[0]), sub(pts[k + 1], pts[0]));
    if (Math.hypot(...n) < 1e-9) return;
    n = norm(n);
    let P = pts;
    if (dot(n, sub(media(pts), dentro)) < 0) {
      n = [-n[0], -n[1], -n[2]];
      P = [...pts].reverse();
    }
    const c = typeof cor === 'string' ? linear(cor) : cor;
    const ids = P.map((p) => this.vert(p, n, c));
    for (let k = 1; k + 1 < ids.length; k++) this.idx.push(ids[0], ids[k], ids[k + 1]);
  }

  /** Caixa x0..x1, y0..y1, z0..z1 sem o fundo (e sem o topo se cima for false). */
  caixa(x0, y0, z0, x1, y1, z1, cor, { cima = true, baixo = false } = {}) {
    const d = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    this.poli([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], cor, d);
    this.poli([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], cor, d);
    this.poli([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], cor, d);
    this.poli([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], cor, d);
    if (cima) this.poli([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], cor, d);
    if (baixo) this.poli([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], cor, d);
  }

  /**
   * Superfície em grade G[k][i] (anéis k ao longo do corpo, pontos i em volta) com normais suaves; a cor de cada
   * quadrilátero vem de cor(k, i) (null pula) e a orientação de centro(k) (um ponto de dentro do anel k).
   */
  grade(G, cor, centro, { fechada = false } = {}) {
    const nk = G.length;
    const ni = G[0].length;
    const nf = fechada ? ni : ni - 1;
    const N = G.map((a) => a.map(() => [0, 0, 0]));
    const faces = [];
    for (let k = 0; k + 1 < nk; k++) {
      for (let i = 0; i < nf; i++) {
        const c = cor(k, i);
        if (c == null) continue;
        const j = (i + 1) % ni;
        const A = G[k][i];
        const B = G[k + 1][i];
        const C = G[k + 1][j];
        const D = G[k][j];
        let n = cruz(sub(C, A), sub(D, B));
        const o = centro(k);
        const flip = dot(n, sub(media([A, B, C, D]), o)) < 0;
        if (flip) n = [-n[0], -n[1], -n[2]];
        for (const [kk, ii] of [[k, i], [k + 1, i], [k + 1, j], [k, j]]) for (let q = 0; q < 3; q++) N[kk][ii][q] += n[q];
        faces.push([k, i, j, c, flip]);
      }
    }
    const Nn = N.map((a) => a.map(norm));
    for (const [k, i, j, c, flip] of faces) {
      const q = [[k, i], [k + 1, i], [k + 1, j], [k, j]];
      if (flip) q.reverse();
      const col = typeof c === 'string' ? linear(c) : c;
      const ids = q.map(([kk, ii]) => this.vert(G[kk][ii], Nn[kk][ii], col));
      this.idx.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
    }
  }

  fechar() {
    const nv = this.nv;
    return {
      posicao: Float32Array.from(this.pos),
      normal: Float32Array.from(this.nor),
      cor: Float32Array.from(this.cor),
      indices: nv > 65535 ? Uint32Array.from(this.idx) : Uint16Array.from(this.idx),
      tris: this.idx.length / 3,
    };
  }
}

/** Interpola uma tabela [[t, v], ...] ordenada em t (linear). */
function tabela(T, t) {
  if (t <= T[0][0]) return T[0][1];
  for (let k = 1; k < T.length; k++) {
    if (t <= T[k][0]) {
      const f = (t - T[k - 1][0]) / (T[k][0] - T[k - 1][0]);
      return T[k - 1][1] + (T[k][1] - T[k - 1][1]) * f;
    }
  }
  return T[T.length - 1][1];
}

/**
 * Um conves: prisma de contorno convexo (pontos [x, z]) de y0 a y1 com a faixa de janelas escuras entre yJ0 e yJ1
 * (puxada 3 cm para fora) e o teto. Paredes brancas acima e abaixo.
 */
function conves(M, poly, y0, y1, yJ0, yJ1, c, rake = 0) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const zMax = Math.max(...poly.map((p) => p[1]));
  const d = [cx, (y0 + y1) / 2, cz];
  // a frente inclinada (para-brisa de iate): o topo dos vértices da proa recua `rake` m, em proporção à posição
  const topo = (p, y) => [p[0], p[1] - rake * Math.max(0, (p[1] - cz) / Math.max(1, zMax - cz)) * ((y - y0) / (y1 - y0))];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k];
    const b = poly[(k + 1) % poly.length];
    // a borda da janela sai 3 cm da parede (a normal fica a da parede)
    let nx = b[1] - a[1];
    let nz = -(b[0] - a[0]);
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    if (nx * ((a[0] + b[0]) / 2 - cx) + nz * ((a[1] + b[1]) / 2 - cz) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const f = (y, o = 0) => [a, b].map((q) => {
      const [x, z] = topo(q, y);
      return [x + nx * o, y, z + nz * o];
    });
    const faixa = (ya, yb, cor, o) => {
      const [p, q] = f(ya, o);
      const [r, s] = f(yb, o);
      M.poli([p, q, s, r], cor, d);
    };
    faixa(y0, yJ0, c.parede, 0);
    faixa(yJ0, yJ1, c.vidro, 0.03);
    faixa(yJ1, y1, c.parede, 0);
  }
  M.poli(poly.map((q) => { const [x, z] = topo(q, y1); return [x, y1, z]; }), c.teto ?? c.parede, d);
}

// ------------------------------------------------------------------------------------------------ casco

/**
 * Anel do casco de boca b, borda h acima da água e calado d: da borda esquerda, pelo fundo, à borda direita (15 pontos).
 * Os segmentos 0 a 6 (do lado esquerdo; o direito espelha): 0 borda, 1 faixa de janelas, 2 costado até a linha d'água, 3
 * a 6 obra viva.
 */
function anelCasco(b, h, d, z) {
  const m = Math.min(h, 2);
  const Lh = [[-1, h], [-1, h - 0.45 * m], [-1, h - 0.9 * m], [-0.985, 0], [-0.9, -0.4 * d], [-0.7, -0.78 * d], [-0.4, -0.96 * d]];
  return [
    ...Lh.map(([f, y]) => [f * b, y, z]),
    [0, -d, z],
    ...Lh.slice().reverse().map(([f, y]) => [-f * b, y, z]),
  ];
}

/**
 * Casco por estações. tab: { z: [[t, v]], w, h, d } com t de -1 (popa) a 1 (proa); cores: { topo, janela, fundo, convés }.
 * Devolve as estações para o convés.
 */
function casco(M, { comp, boca, w, h, d, estacoes, cores, janelas = null }) {
  const G = [];
  const centros = [];
  for (const t of estacoes) {
    const z = (comp / 2) * t;
    G.push(anelCasco((boca / 2) * tabela(w, t), tabela(h, t), tabela(d, t), z));
    centros.push([0, -0.2, z]);
  }
  M.grade(
    G,
    (k, i) => {
      const lado = i <= 6 ? i : 13 - i;
      if (lado >= 3) return cores.fundo;
      if (lado === 1 && janelas && estacoes[k] > janelas[0] && estacoes[k] < janelas[1]) return cores.janela;
      return cores.topo;
    },
    (k) => centros[k],
  );
  // convés: tira entre as bordas
  const C = G.map((a) => [a[0], a[a.length - 1]]);
  M.grade(C, () => cores.convés, (k) => [0, -1, G[k][0][2]]);
  // popa e proa: tampas
  for (const k of [0, G.length - 1]) {
    const dentro = [0, -0.5, G[k === 0 ? 1 : G.length - 2][0][2]];
    M.poli(G[k], cores.topo, dentro);
  }
  return G;
}

const ESTACOES = [-1, -0.9, -0.7, -0.4, -0.1, 0.2, 0.45, 0.65, 0.8, 0.9, 0.97, 1];

// ------------------------------------------------------------------------------------------------ iate

/** Medidas do iate (m). */
export const IATE = Object.freeze({ comp: 42, boca: 8.4, altura: 13.2, calado: 1.8 });

/** Iate de 42 m (LOD0, uns 450 triângulos) ou o LOD1 (cunha e dois blocos, 40 triângulos). */
export function malhaIate(lod = 0) {
  const M = new MalhaCor();
  const cores = { topo: '#f1f2ef', janela: '#202a37', fundo: '#2c3849', convés: '#a98a5e' };
  const c = { parede: linear('#f4f4f1'), vidro: linear('#222c39'), teto: linear('#e9eaea') };
  const w = [[-1, 0.9], [-0.7, 1], [0.1, 0.98], [0.5, 0.82], [0.8, 0.5], [0.95, 0.18], [1, 0.03]];
  const h = [[-1, 2.55], [-0.4, 2.3], [0.2, 2.4], [0.6, 2.85], [0.9, 3.4], [1, 3.75]];
  const d = [[-1, 1.5], [-0.3, 1.8], [0.3, 1.55], [0.7, 0.9], [1, 0.2]];
  if (lod) {
    casco(M, { comp: IATE.comp, boca: IATE.boca, w, h, d, estacoes: [-1, -0.3, 0.3, 0.75, 1], cores });
    M.caixa(-3.3, 2.4, -11, 3.3, 7.8, 5, c.parede);
    M.caixa(-2.5, 7.8, -9, 2.5, 10, -1, c.parede);
    return M.fechar();
  }
  casco(M, { comp: IATE.comp, boca: IATE.boca, w, h, d, estacoes: ESTACOES, cores, janelas: [-0.55, 0.55] });
  // casa principal, convés superior e flybridge recuados, com a faixa de janelas
  const casa = (hw, zA, zF, bico) => [
    [-hw, zA], [hw, zA], [hw + 0.12, zA + (zF - zA) * 0.5], [hw - bico * 0.3, zF - bico * 0.5], [hw - bico, zF], [-hw + bico, zF], [-hw + bico * 0.3, zF - bico * 0.5], [-hw - 0.12, zA + (zF - zA) * 0.5],
  ];
  conves(M, casa(3.5, -11.5, 10.5, 2.6), 2.3, 5.2, 3.1, 4.5, c, 1.4);
  conves(M, casa(3.15, -10, 5.2, 2.2), 5.2, 7.7, 5.8, 7.1, c, 1.6);
  conves(M, casa(2.7, -9, -1.0, 1.4), 7.7, 9.9, 8.3, 9.3, c, 1.2);
  // laje do flybridge saindo 40 cm, mastro e arco do radar
  M.caixa(-3.05, 9.9, -9.6, 3.05, 10.08, -0.6, c.teto);
  M.caixa(-0.1, 10.08, -5.2, 0.1, 13.2, -5.0, c.parede);
  M.caixa(-1.2, 12.0, -5.3, 1.2, 12.18, -4.9, c.parede);
  M.caixa(-0.35, 10.08, -3.0, 0.35, 10.7, -2.3, c.vidro);
  // pad solar na proa, plataforma de popa em teca e o tender no convés de popa
  M.caixa(-1.4, 3.0, 12.2, 1.4, 3.3, 16.2, '#e8dcc6');
  M.caixa(-3.5, 0.12, -23.0, 3.5, 0.34, -20.5, cores.convés);
  M.caixa(-1.4, 2.3, -17.5, 1.4, 3.1, -13.0, '#d8d9d8');
  return M.fechar();
}

// ------------------------------------------------------------------------------------------------ cruzeiro

/** Medidas do cruzeiro (m). */
export const CRUZEIRO = Object.freeze({ comp: 300, boca: 38, altura: 52, calado: 8.4 });

/** Cruzeiro de 300 m (LOD0, uns 1.200 triângulos) ou o LOD1 (cunha e blocos, 60 triângulos). */
export function malhaCruzeiro(lod = 0) {
  const M = new MalhaCor();
  const cores = { topo: '#15233c', janela: '#15233c', fundo: '#6b2722', convés: '#b8b3a6' };
  const c = { parede: linear('#f1f1ee'), vidro: linear('#27323f'), teto: linear('#dcddda') };
  const w = [[-1, 0.9], [-0.9, 0.97], [-0.5, 1], [0.4, 1], [0.7, 0.9], [0.85, 0.7], [0.95, 0.38], [0.99, 0.12], [1, 0.03]];
  const h = [[-1, 11.6], [-0.8, 11], [0.6, 11], [0.8, 12.5], [1, 17]];
  const d = [[-1, 5.5], [-0.8, 8.2], [0.7, 8.4], [0.92, 6], [1, 2]];
  const est = [-1, -0.9, -0.7, -0.4, 0, 0.4, 0.6, 0.75, 0.88, 0.95, 0.99, 1];
  if (lod) {
    casco(M, { comp: CRUZEIRO.comp, boca: CRUZEIRO.boca, w, h, d, estacoes: [-1, -0.5, 0.3, 0.8, 1], cores });
    M.caixa(-17, 11, -125, 17, 38, 90, c.parede);
    M.caixa(-6, 38, -52, 6, 52, -36, linear('#21427a'));
    return M.fechar();
  }
  casco(M, { comp: CRUZEIRO.comp, boca: CRUZEIRO.boca, w, h, d, estacoes: est, cores });
  // nove conveses de 3,1 m, recuados na popa e na proa a cada degrau; sacadas (parede, vidro, parede)
  const base = 10.9;
  for (let n = 0; n < 9; n++) {
    const y0 = base + 3.1 * n;
    const hw = 17.8 - 0.3 * n;
    const zA = -128 + 7 * Math.max(0, n - 2);
    const zF = 98 - 9 * Math.max(0, n - 3);
    const bico = Math.min(15 + 2 * n, hw - 3);
    const poly = [
      [-hw, zA], [hw, zA], [hw, zF - bico * 1.4], [hw - bico * 0.35, zF - bico * 0.5], [hw - bico, zF], [-hw + bico, zF], [-hw + bico * 0.35, zF - bico * 0.5], [-hw, zF - bico * 1.4],
    ];
    conves(M, poly, y0, y0 + 3.1, y0 + 1.0, y0 + 2.4, c, 2.5 + 0.7 * n);
  }
  // ponte de comando: corpo largo no topo do conves 3 com as asas até a boca (passarelas)
  M.caixa(-19.5, 20.5, 88, 19.5, 23.2, 93, c.vidro);
  M.caixa(-17.5, 23.2, 87, 17.5, 23.4, 94, c.teto);
  // chaminé com a faixa amarela e o topo rasgado
  M.caixa(-5.4, 39, -55, 5.4, 46, -35, linear('#21427a'));
  M.caixa(-5.45, 46, -55.05, 5.45, 48.6, -34.95, linear('#d8b02a'), { cima: false });
  M.caixa(-5.4, 48.6, -55, 5.4, 53, -38, linear('#21427a'));
  // baleeiras laranja nos dois bordos do conves 2 (seis por bordo)
  for (const s of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const z = -70 + 26 * k;
      M.caixa(s * 18.3 - 0.9, 14.6, z - 4.6, s * 18.3 + 0.9, 17.1, z + 4.6, '#e0601b');
    }
  }
  // piscina no conves 8: duas lajes de espreguiçadeiras claras (planos) e a cobertura sobre a ponta de popa
  M.caixa(-9, 36.0, -108, 9, 36.4, -84, '#bcd0d8');
  return M.fechar();
}

// ------------------------------------------------------------------------------------------------ jato

/** Medidas do jato (m). */
export const JATO = Object.freeze({ comp: 31.8, envergadura: 29.8, altura: 7.3 });

/** Jato executivo de 30 m (LOD0, uns 520 triângulos). */
export function malhaJato() {
  const M = new MalhaCor();
  const branco = linear('#f3f4f6');
  const barriga = linear('#c9cdd3');
  const azul = linear('#1c2e55');
  const ouro = linear('#b8883f');
  const vidro = linear('#10151c');
  const fosco = linear('#3a3d42');
  const seg = 16;
  // [z, raio, centro y]; o nariz em +z, a cauda em -z
  const E = [[15.2, 0.06, -0.22], [14.5, 0.45, -0.2], [13.0, 0.85, -0.12], [10.5, 1.12, -0.03], [6, 1.25, 0], [-3, 1.25, 0], [-7, 1.15, 0.12], [-10.5, 0.82, 0.3], [-13, 0.5, 0.5], [-15.2, 0.28, 0.62]];
  const G = E.map(([z, r, cy]) => Array.from({ length: seg }, (_, s) => {
    const a = (2 * Math.PI * s) / seg;
    return [Math.cos(a) * r * 1.02, cy + Math.sin(a) * r, z];
  }));
  M.grade(
    G,
    (k, i) => {
      const a = (360 * (i + 0.5)) / seg; // 0 a direita, 90 em cima
      const lado = Math.abs(Math.cos((a * Math.PI) / 180));
      if (G[k][0][2] > 11.3 && lado < 0.4 && Math.sin((a * Math.PI) / 180) > 0.5) return vidro; // para-brisa
      if (G[k][0][2] < 11 && G[k][0][2] > -6 && (i === 1 || i === 6) && k > 2) return vidro; // janelas (faixa)
      if ((i === 0 || i === 7) && k > 1 && k < 7) return azul; // filete
      if ((i === 15 || i === 8) && k > 1 && k < 7) return ouro;
      return Math.sin((a * Math.PI) / 180) < -0.35 ? barriga : branco;
    },
    (k) => [0, E[k][2], E[k][0]],
    { fechada: true },
  );
  // asas (flechadas 36 graus, diedro, winglet), uma de cada lado: bordo de ataque da raiz, fuga da raiz, fuga da ponta,
  // ataque da ponta
  for (const s of [-1, 1]) {
    const R = [[s * 1.15, -0.78, 2.2, 0.5], [s * 1.15, -0.78, -3.4, 0.5], [s * 14.9, 0.5, -10.8, 0.18], [s * 14.9, 0.5, -9.0, 0.18]];
    const alto = R.map(([x, y, z, t]) => [x, y + t / 2, z]);
    const baixo = R.map(([x, y, z, t]) => [x, y - t / 2, z]);
    const d = media([...alto, ...baixo]);
    M.poli(alto, branco, d);
    M.poli(baixo, barriga, d);
    M.poli([alto[1], alto[2], baixo[2], baixo[1]], branco, d);
    M.poli([alto[2], alto[3], baixo[3], baixo[2]], branco, d);
    M.poli([alto[3], alto[0], baixo[0], baixo[3]], branco, d);
    // winglet
    M.caixa(s * 14.85 - 0.04, 0.4, -10.8, s * 14.85 + 0.04, 1.9, -9.6, azul);
  }
  // deriva em T (flechada) e estabilizador no topo
  const fin = [[0.14, 1.0, -9.8], [0.14, 1.0, -14.9], [0.14, 7.2, -15.6], [0.14, 7.2, -13.2]];
  M.poli(fin, branco, [0, 4, -12]);
  M.poli(fin.map(([x, y, z]) => [-x, y, z]), branco, [0, 4, -12]);
  M.poli([[0.14, 1.0, -9.8], [0.14, 7.2, -13.2], [-0.14, 7.2, -13.2], [-0.14, 1.0, -9.8]], branco, [0, 4, -12]);
  M.poli([[0.14, 6.6, -15.4], [0.14, 7.2, -15.6], [-0.14, 7.2, -15.6], [-0.14, 6.6, -15.4]], azul, [0, 4, -12]);
  for (const s of [-1, 1]) {
    const q = [[0, 7.2, -13.2], [0, 7.2, -15.6], [s * 4.5, 7.25, -16.6], [s * 4.5, 7.25, -15.4]];
    const d = [s * 2, 7.2, -15];
    M.poli(q.map(([x, y, z]) => [x, y + 0.07, z]), branco, d);
    M.poli(q.map(([x, y, z]) => [x, y - 0.07, z]), barriga, d);
  }
  // motores na popa: nacela cilíndrica (10 lados), entrada e escapamento escuros, pilone
  for (const s of [-1, 1]) {
    const ex = s * 2.15;
    const Gm = [[-3.6, 0.48], [-4.4, 0.64], [-9.8, 0.66], [-11.4, 0.5], [-11.9, 0.4]].map(([z, r]) => Array.from({ length: 10 }, (_, q) => {
      const a = (2 * Math.PI * q) / 10;
      return [ex + Math.cos(a) * r, 0.75 + Math.sin(a) * r, z];
    }));
    M.grade(Gm, (k) => (k === 3 ? fosco : branco), (k) => [ex, 0.75, Gm[k][0][2]], { fechada: true });
    M.poli(Gm[0], fosco, [ex, 0.75, -8]);
    M.poli(Gm[4], fosco, [ex, 0.75, -8]);
    M.caixa(s * 1.2, 0.4, -9.4, s * 1.8, 0.9, -5.2, branco);
  }
  return M.fechar();
}

// ------------------------------------------------------------------------------------------------ planos (puros)

/** Cota (m, sem o nível do mar) do mar ou da terra na amostra mais perto de (x, z); fora do mapa vale a borda. */
export function ehMar(T, x, z) {
  const i = Math.min(T.n - 1, Math.max(0, Math.round((x - T.origem[0]) / T.passo)));
  const j = Math.min(T.n - 1, Math.max(0, Math.round((z - T.origem[1]) / T.passo)));
  return T.agua[j * T.n + i] === AGUA.MAR;
}

const centroDoMapa = (T) => {
  const L = T.passo * (T.n - 1);
  return [T.origem[0] + L / 2, T.origem[1] + L / 2];
};

/**
 * Distância (m) de um ponto de mar até a terra mais perto, procurando em círculos de até `max` m (Infinity se não há
 * terra nesse raio); fora do mapa não há terra (o mundo de fora é mar ou serra distante).
 */
export function distanciaDaTerra(T, x, z, max = 800, passo = 24) {
  for (let r = passo; r <= max; r += passo) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / passo));
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k) / n;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (dentro(T, px, pz) && !ehMar(T, px, pz)) return r;
    }
  }
  return Infinity;
}

const dentro = (T, x, z) => {
  const L = T.passo * (T.n - 1);
  return x >= T.origem[0] && z >= T.origem[1] && x <= T.origem[0] + L && z <= T.origem[1] + L;
};

/**
 * Marina e fundeadouro: a água aberta da costa mais perto do centro do mapa (a cidade). Devolve null se o mapa não tem
 * mar. atracados: até 8 iates de proa para a terra, lado a lado e a 16 m uns dos outros, a 45 m da margem; fundeados: 4
 * iates a 200 a 700 m da costa, cada um com o rumo do vento. Cada item: { x, z, rot, escala, tom }.
 */
export function planoMarina(T, semente = 1) {
  if (!T?.agua) return null;
  const [cx, cz] = centroDoMapa(T);
  const passoBusca = 4; // amostras (32 m)
  let melhor = null;
  for (let j = 0; j < T.n; j += passoBusca) {
    for (let i = 0; i < T.n; i += passoBusca) {
      if (T.agua[j * T.n + i] !== AGUA.MAR) continue;
      const x = T.origem[0] + i * T.passo;
      const z = T.origem[1] + j * T.passo;
      const dTerra = distanciaDaTerra(T, x, z, 160, 20);
      if (!(dTerra >= 40 && dTerra <= 80)) continue;
      // água aberta em volta (uma costa reta dá a metade): pelo menos 40% de mar em 150 a 800 m
      let mar = 0;
      let tot = 0;
      for (let a = 0; a < 16; a++) {
        for (const r of [150, 300, 400, 800]) {
          tot++;
          if (ehMar(T, x + Math.cos((a * Math.PI) / 8) * r, z + Math.sin((a * Math.PI) / 8) * r)) mar++;
        }
      }
      if (mar / tot < 0.4) continue;
      const d = Math.hypot(x - cx, z - cz);
      if (!melhor || d < melhor.d) melhor = { x, z, d };
    }
  }
  if (!melhor) return null;
  // direção da terra: média das direções com terra a 100 m
  let tx = 0;
  let tz = 0;
  for (let a = 0; a < 36; a++) {
    const ang = (a * Math.PI) / 18;
    for (const r of [60, 110]) {
      const px = melhor.x + Math.cos(ang) * r;
      const pz = melhor.z + Math.sin(ang) * r;
      if (dentro(T, px, pz) && !ehMar(T, px, pz)) {
        tx += Math.cos(ang);
        tz += Math.sin(ang);
      }
    }
  }
  const l = Math.hypot(tx, tz) || 1;
  tx /= l;
  tz /= l;
  // proa (+z) para a terra: rot em torno de y com a proa em (sin rot, cos rot)
  const rot = Math.atan2(tx, tz);
  const px = -tz; // a tangente à margem
  const pz = tx;
  const atracados = [];
  for (let k = -4; k < 4; k++) {
    const x = melhor.x + px * (k + 0.5) * 16 - tx * 18;
    const z = melhor.z + pz * (k + 0.5) * 16 - tz * 18;
    if (!ehMar(T, x, z) || !ehMar(T, x - tx * 25, z - tz * 25) || !ehMar(T, x + tx * 20, z + tz * 20)) continue;
    const h = hashF(k + 9, 3, semente);
    atracados.push({ x: x - tx * (hashF(k + 9, 5, semente) - 0.3) * 9, z: z - tz * (hashF(k + 9, 5, semente) - 0.3) * 9, rot: rot + (h - 0.5) * 0.1, escala: 0.62 + 0.5 * hashF(k + 9, 4, semente), tom: h });
  }
  const fundeados = [];
  for (let k = 0; k < 4; k++) {
    const dist = 200 + 500 * hashF(k, 11, semente);
    const lado = (hashF(k, 12, semente) - 0.5) * 900;
    const x = melhor.x - tx * dist + px * lado;
    const z = melhor.z - tz * dist + pz * lado;
    if (!ehMar(T, x, z) || distanciaDaTerra(T, x, z, 120, 30) < 120) continue;
    fundeados.push({ x, z, rot: hashF(k, 13, semente) * Math.PI * 2, escala: 0.9 + 0.6 * hashF(k, 14, semente), tom: hashF(k, 15, semente) });
  }
  return { x: melhor.x, z: melhor.z, rot, atracados, fundeados };
}

/**
 * Rota do cruzeiro: um oval (duas retas e dois semicírculos de 600 m) em água aberta, paralelo à costa da marina, a uns
 * 1,8 km dela; ou, sem espaço, ancorado (comprimento 0). Devolve { cx, cz, rot, reta, raio, vel } ou null sem mar.
 */
export function rotaCruzeiro(T, marina, semente = 1) {
  if (!T?.agua) return null;
  const [mx, mz] = centroDoMapa(T);
  const base = marina ? [marina.x, marina.z, marina.rot] : [mx, mz, 0];
  // tenta afastar do ponto da marina na direção do mar (contra a terra) em passos até caber o oval inteiro
  const tx = marina ? -Math.sin(marina.rot) : 0;
  const tz = marina ? -Math.cos(marina.rot) : 1;
  for (let dist = 1800; dist <= 4200; dist += 400) {
    for (const reta of [1600, 800, 0]) {
      const rot = marina ? marina.rot + Math.PI / 2 : hashF(1, 2, semente) * Math.PI;
      const cx = base[0] + tx * dist;
      const cz = base[1] + tz * dist;
      const raio = 600;
      let ok = true;
      for (let a = 0; a < 32 && ok; a++) {
        const p = pontoDoOval({ cx, cz, rot, reta, raio }, (a / 32) * (2 * reta + 2 * Math.PI * raio));
        if (dentro(T, p.x, p.z) && (!ehMar(T, p.x, p.z) || distanciaDaTerra(T, p.x, p.z, 300, 60) < 300)) ok = false;
      }
      if (ok) return { cx, cz, rot, reta, raio, vel: 3.2 };
    }
  }
  return null;
}

/** Ponto do oval a s metros do começo: { x, z, rumo } (rumo: ângulo em torno de y, proa em (sin, cos)). */
export function pontoDoOval({ cx, cz, rot, reta, raio }, s) {
  const per = 2 * reta + 2 * Math.PI * raio;
  let u = ((s % per) + per) % per;
  // coordenadas locais: a reta ao longo de +z local de -reta/2 a reta/2 em x = +raio, volta em x = -raio
  let lx;
  let lz;
  let a;
  if (u < reta) {
    lx = raio;
    lz = -reta / 2 + u;
    a = 0;
  } else if (u < reta + Math.PI * raio) {
    const t = (u - reta) / raio;
    lx = raio * Math.cos(t);
    lz = reta / 2 + raio * Math.sin(t);
    a = t;
  } else if (u < 2 * reta + Math.PI * raio) {
    u -= reta + Math.PI * raio;
    lx = -raio;
    lz = reta / 2 - u;
    a = Math.PI;
  } else {
    const t = (u - 2 * reta - Math.PI * raio) / raio;
    lx = -raio * Math.cos(t);
    lz = -reta / 2 - raio * Math.sin(t);
    a = Math.PI + t;
  }
  // gira o oval por rot; o rumo local é atan2(dx, dz) da tangente (anda a +z com a = 0; vira para -x)
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const x = cx + lx * cs + lz * sn;
  const z = cz - lx * sn + lz * cs;
  const rumo = rot - a;
  return { x, z, rumo: ((rumo % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) };
}

/**
 * Rotas dos jatinhos: n retas que cruzam o céu sobre a região do mapa, em alturas diferentes, a 110 m/s (visual) e de
 * ponta a ponta de 2 x 22 km. Cada rota: { x0, z0, dx, dz, y, comp, vel, fase }.
 */
export function rotasJatos(T, semente = 1, n = 3) {
  const [cx, cz] = T ? centroDoMapa(T) : [0, 0];
  const out = [];
  for (let k = 0; k < n; k++) {
    const az = (k / n + 0.07 + 0.2 * hashF(k, 21, semente)) * Math.PI;
    const dx = Math.sin(az);
    const dz = Math.cos(az);
    const desl = (hashF(k, 22, semente) - 0.5) * 3600; // distância da reta ao centro
    const comp = 44000;
    out.push({
      x0: cx - dz * desl - dx * comp / 2,
      z0: cz + dx * desl - dz * comp / 2,
      dx,
      dz,
      y: 1300 + 450 * k + 250 * hashF(k, 23, semente),
      comp,
      vel: 105 + 25 * hashF(k, 24, semente),
      fase: hashF(k, 25, semente),
    });
  }
  return out;
}

/** Posição e rumo de um jato na rota à hora tMs (a reta é percorrida e recomeça). */
export function jatoNaRota(r, tMs) {
  const s = (((tMs / 1000) * r.vel + r.fase * r.comp) % r.comp + r.comp) % r.comp;
  return { x: r.x0 + r.dx * s, y: r.y, z: r.z0 + r.dz * s, rumo: Math.atan2(r.dx, r.dz) };
}

/**
 * Escreve a matriz (coluna a coluna, 16 floats em out a partir de o) de translação x, y, z, guinada (em torno de y), arfagem
 * (em torno de x local), rolagem (em torno de z local) e escala s.
 */
export function escreverMatriz(out, o, x, y, z, guinada, arfagem = 0, rolagem = 0, s = 1) {
  const cy = Math.cos(guinada);
  const sy = Math.sin(guinada);
  const cp = Math.cos(arfagem);
  const sp = Math.sin(arfagem);
  const cr = Math.cos(rolagem);
  const sr = Math.sin(rolagem);
  // R = Ry * Rx * Rz
  const r00 = cy * cr + sy * sp * sr;
  const r01 = -cy * sr + sy * sp * cr;
  const r02 = sy * cp;
  const r10 = cp * sr;
  const r11 = cp * cr;
  const r12 = -sp;
  const r20 = -sy * cr + cy * sp * sr;
  const r21 = sy * sr + cy * sp * cr;
  const r22 = cy * cp;
  out[o] = r00 * s; out[o + 1] = r10 * s; out[o + 2] = r20 * s; out[o + 3] = 0;
  out[o + 4] = r01 * s; out[o + 5] = r11 * s; out[o + 6] = r21 * s; out[o + 7] = 0;
  out[o + 8] = r02 * s; out[o + 9] = r12 * s; out[o + 10] = r22 * s; out[o + 11] = 0;
  out[o + 12] = x; out[o + 13] = y; out[o + 14] = z; out[o + 15] = 1;
}

