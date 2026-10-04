// Torres da Holding (D27, D64, D89), render: a Blade Tower de 500 m e a Legacy Tower de 452 m pelo mesmo gerador (a
// altura vem da especificação, data/arcologia-plano.js), o par no pódio redondo da sede v3 com a Dream Bridge a 330 m e
// a linha de LED nas quinas das lâminas, os LODs, o volume que projeta a sombra própria (D43) e os materiais da
// Arcologia. Também guarda o kit de malhas que as partes, o lago e os planos usam (Malha e as formas básicas).
//
// Referências: 111 West 57th (lâminas que recuam em penas numa face só, face oposta lisa), One Vanderbilt (volumes
// verticais encaixados), 432 Park Avenue (andares de vento que cortam a altura sem faixa escura), 30 Hudson Yards
// (plataforma em balanço no alto), as Petronas (o par com a ponte e as pernas inclinadas) e o SkyPark do Marina Bay
// Sands (o jardim com a piscina no alto da ponte).
//
// Espaço local de uma torre: origem no centro da planta, no chão; x ao longo dos 36 m; z ao longo dos 50 m, da face
// lisa (z = -25) para as penas (z = +25), a frente (+z com rot = 0). No par (PAR), as duas olham para o mesmo lado, com
// as faces laterais de frente uma para a outra através do vão de 28 m; o pódio redondo as cobre até 40 m.
//
// Materiais (poucas chamadas e um programa só por material, D66): 'vidro' (toda a pele de vidro da Arcologia, o desenho
// da fachada no shader pelo tipo de cada vértice, os anéis inclusive), 'opaco' (pedra, bronze, laca, ouro, jardim, as
// marquises e as luzes, com cor, rugosidade, metal, luz e padrão por vértice), 'cascata' (as Dream Falls, a névoa e a
// espuma) e 'jato' (as fontes). O par sai em 2 chamadas no LOD0, 2 no LOD1 e 1 na sombra.
import * as THREE from 'three';
import { TORRE_LAMINA, PAR, torresDoPar } from '../../data/arcologia-plano.js';
import { direcaoDoSol } from '../depuracao.js';
import { GANCHOS_COMUNS } from '../materiais/biblioteca.js';

// ================================================================================================ kit de malhas

/** Cor sRGB '#rrggbb' em linear (as cores de vértice do three são lineares). */
export function corLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)];
}

/**
 * Padrões do material opaco (desenhados no shader pelas coordenadas em metros): pista (a de corrida do teto do Horizon
 * Ring: uv = arco, distância ao eixo) e quadra (as linhas das quadras de esporte) do teto, livros (as estantes do átrio
 * da Codex) e as de antes.
 */
export const PADRAO = Object.freeze({
  nenhum: 0, pedra: 1, piso: 2, grama: 3, agua: 4, portuguesa: 5, solar: 6, folha: 7, metal: 8, pista: 9, quadra: 10, livros: 11,
  marquise: 12, malha: 13, troncoVivo: 14,
});
/** Classes de luz do material opaco: led (as linhas das quinas das torres e da ponte), livros (o átrio aceso). */
export const LUZ = Object.freeze({
  nenhuma: 0, aro: 1, obstaculo: 2, forro: 3, piscina: 4, coroa: 5, janela: 6, esfera: 7, arvoreLuz: 8, reflexo: 9, led: 10, livros: 11,
  marquise: 12,
});

/**
 * Andares da faixa de LED de um anel (D93, pedido do dono de 04/10/2026): um terço dos andares, no terço do meio da
 * altura, contínua em volta toda. Ímpar, para a faixa centrada no meio da altura cair inteira entre duas lajes (a moldura
 * das marquises): 9 dos 25 andares do Horizon Ring (de 51,2 a 108,8 m) e 7 dos 19 do Meridian Ring (de 37,9 a 82,1 m).
 * As torres ovais levam a do Horizon Ring (a mesma faixa de altura).
 */
export const andaresLed = (andares) => 2 * Math.round((andares / 3 - 1) / 2) + 1;

/**
 * Acabamento do material opaco: [r, g, b, pacote] com rugosidade e metal em 4 bits, a classe de luz e o padrão.
 * @example acab('#c8bba3', { rugo: 0.7, padrao: PADRAO.pedra })
 */
export function acab(hex, { rugo = 0.8, metal = 0, luz = 0, padrao = 0 } = {}) {
  const [r, g, b] = corLinear(hex);
  const q = (v) => Math.max(0, Math.min(15, Math.round(v * 15)));
  return [r, g, b, ((q(rugo) * 16 + q(metal)) * 16 + luz) * 16 + padrao];
}

/**
 * Tipos de fachada do material vidro (o shader desenha cada um): os das torres, anel (o vidro curvo dos anéis, com a
 * marquise de cada andar e a faixa de LED), oval (a Helix e a Compass, do mesmo jeito), codex (o vidro escuro
 * facetado) e escada (os tubos das escadas rolantes).
 */
export const VIDRO = Object.freeze({
  cortina: 0, costura: 1, vento: 2, saguao: 3, lanterna: 4, parapeito: 5, anel: 6, oval: 7, codex: 8, escada: 9, torreLod1: 10,
});

/** Dado do vértice de vidro: [tipo, semente, face com aletas (0 ou 1), marca (1: a lanterna de uma coroa)]. */
export const vid = (tipo, semente = 0, aletas = 0, marca = 0) => [tipo, semente, aletas, marca];

/** Passos da semente do vidro dos anéis (o shader lê o mesmo número; ver vidAnel). */
export const SEM_ANEL = 64;

/**
 * Semente do vidro dos anéis no meio de um de SEM_ANEL passos. Ela divide o float com o centro da faixa de LED (60,
 * 80, 900), e a interpolação do varying erra uns 6e-6 ali: o hash das salas, com a semente vezes 29, sorteava de novo a
 * cada pixel (o chuvisco das salas acesas e das persianas). No meio do passo o shader a recupera exata.
 */
export const semAnel = (semente) => (Math.min(SEM_ANEL - 1, Math.max(0, Math.floor(semente * SEM_ANEL))) + 0.5) / SEM_ANEL;

/**
 * Dado do vértice de vidro dos anéis e das torres ovais: [tipo, centro da faixa de LED (a parte inteira) + semente
 * (semAnel), pé-direito, setor + 32 x andares da faixa] (o setor diz ao shader se a marquise daquele trecho já está em
 * geometria, uniforme uLodSetor; sem faixa, 0 andares).
 */
export const vidAnel = (tipo, semente, ledMeio, pe, setor, ledAndares = 0) => [tipo, Math.floor(ledMeio) + semAnel(semente), pe, setor + 32 * ledAndares];

/** Setores com LOD de marquise (16 trechos de anel e as 2 torres ovais; uniforme vec4[5]). */
export const SETORES = 20;

/**
 * Malha em arranjos simples (sem three): posição, normal, coordenadas em metros (u ao longo da face, v de altura; nas
 * faces horizontais x e z) e um dado de 4 números por vértice (acab ou vid). Os triângulos se orientam sozinhos pela
 * normal pedida: quem monta não precisa acertar a volta.
 */
export class Malha {
  constructor(tipo = 'opaco') {
    this.tipo = tipo;
    this.p = [];
    this.n = [];
    this.uv = [];
    this.c = [];
    this.i = [];
  }

  get vertices() {
    return this.p.length / 3;
  }

  get triangulos() {
    return this.i.length / 3;
  }

  v(x, y, z, nx, ny, nz, u, w, c) {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    this.uv.push(u, w);
    this.c.push(c[0], c[1], c[2], c[3]);
    return this.p.length / 3 - 1;
  }

  /** Triângulo virado para o lado da normal do primeiro vértice; degenerado fica de fora. */
  tri(a, b, c) {
    const P = this.p;
    const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2];
    const ux = P[3 * b] - ax, uy = P[3 * b + 1] - ay, uz = P[3 * b + 2] - az;
    const vx = P[3 * c] - ax, vy = P[3 * c + 1] - ay, vz = P[3 * c + 2] - az;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz < 1e-12) return;
    const d = cx * this.n[3 * a] + cy * this.n[3 * a + 1] + cz * this.n[3 * a + 2];
    if (d >= 0) this.i.push(a, b, c);
    else this.i.push(a, c, b);
  }

  /** Quadrilátero plano a, b, c, d (em volta) com a normal n; uvs em pares. */
  quad(a, b, c, d, n, uva, uvb, uvc, uvd, k) {
    const i0 = this.v(a[0], a[1], a[2], n[0], n[1], n[2], uva[0], uva[1], k);
    const i1 = this.v(b[0], b[1], b[2], n[0], n[1], n[2], uvb[0], uvb[1], k);
    const i2 = this.v(c[0], c[1], c[2], n[0], n[1], n[2], uvc[0], uvc[1], k);
    const i3 = this.v(d[0], d[1], d[2], n[0], n[1], n[2], uvd[0], uvd[1], k);
    this.tri(i0, i1, i2);
    this.tri(i0, i2, i3);
  }

  /** Junta outra malha (mesmo tipo) nesta. */
  juntar(outra) {
    const base = this.vertices;
    for (let k = 0; k < outra.p.length; k++) this.p.push(outra.p[k]);
    for (let k = 0; k < outra.n.length; k++) this.n.push(outra.n[k]);
    for (let k = 0; k < outra.uv.length; k++) this.uv.push(outra.uv[k]);
    for (let k = 0; k < outra.c.length; k++) this.c.push(outra.c[k]);
    for (let k = 0; k < outra.i.length; k++) this.i.push(outra.i[k] + base);
    return this;
  }

  /** Caixa limite [x0, y0, z0, x1, y1, z1] (null se vazia). */
  caixa() {
    if (!this.p.length) return null;
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let k = 0; k < this.p.length; k += 3) {
      for (let e = 0; e < 3; e++) {
        const v = this.p[k + e];
        if (v < b[e]) b[e] = v;
        if (v > b[e + 3]) b[e + 3] = v;
      }
    }
    return b;
  }

  /** Aplica fn(p) → [x, y, z] às posições e gira as normais por rot (em torno de +y), para levar ao mundo. */
  transformar(dx, dy, dz, rot = 0) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (let k = 0; k < this.p.length; k += 3) {
      const x = this.p[k];
      const z = this.p[k + 2];
      this.p[k] = c * x + s * z + dx;
      this.p[k + 1] += dy;
      this.p[k + 2] = -s * x + c * z + dz;
      const nx = this.n[k];
      const nz = this.n[k + 2];
      this.n[k] = c * nx + s * nz;
      this.n[k + 2] = -s * nx + c * nz;
    }
    return this;
  }
}

/** Área com sinal (positiva no sentido x cresce e depois z cresce). */
export function areaPoli(poly) {
  let a = 0;
  const n = poly.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) a += poly[2 * j] * poly[2 * i + 1] - poly[2 * i] * poly[2 * j + 1];
  return a / 2;
}

/** Polígono (pares x, z) na orientação positiva e sem pontos repetidos seguidos. */
export function orientar(poly) {
  const pts = [];
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const x = poly[2 * i];
    const z = poly[2 * i + 1];
    const k = pts.length;
    if (k && Math.abs(pts[k - 2] - x) < 1e-6 && Math.abs(pts[k - 1] - z) < 1e-6) continue;
    pts.push(x, z);
  }
  if (pts.length > 4 && Math.abs(pts[0] - pts[pts.length - 2]) < 1e-6 && Math.abs(pts[1] - pts[pts.length - 1]) < 1e-6) pts.length -= 2;
  if (areaPoli(pts) >= 0) return pts;
  const r = [];
  for (let i = pts.length / 2 - 1; i >= 0; i--) r.push(pts[2 * i], pts[2 * i + 1]);
  return r;
}

/** Triangulação por orelhas de um polígono simples (pares x, z). Devolve índices dos pontos. */
export function triangular(poly) {
  const P = orientar(poly);
  const n = P.length / 2;
  const idx = [...Array(n).keys()];
  const out = [];
  const x = (i) => P[2 * i];
  const z = (i) => P[2 * i + 1];
  const cruz = (a, b, c) => (x(b) - x(a)) * (z(c) - z(a)) - (z(b) - z(a)) * (x(c) - x(a));
  const dentro = (p, a, b, c) => cruz(a, b, p) >= -1e-9 && cruz(b, c, p) >= -1e-9 && cruz(c, a, p) >= -1e-9;
  let guarda = 0;
  while (idx.length > 3 && guarda++ < 10000) {
    let cortou = false;
    for (let k = 0; k < idx.length; k++) {
      const a = idx[(k + idx.length - 1) % idx.length];
      const b = idx[k];
      const c = idx[(k + 1) % idx.length];
      if (cruz(a, b, c) <= 1e-9) continue; // reflexo
      let vazio = true;
      for (const p of idx) {
        if (p === a || p === b || p === c) continue;
        if (dentro(p, a, b, c)) {
          vazio = false;
          break;
        }
      }
      if (!vazio) continue;
      out.push(a, b, c);
      idx.splice(k, 1);
      cortou = true;
      break;
    }
    if (!cortou) break; // polígono ruim: fecha em leque
  }
  for (let k = 1; k + 1 < idx.length; k++) out.push(idx[0], idx[k], idx[k + 1]);
  return { pontos: P, indices: out };
}

/** Tampa horizontal de um polígono na cota y, virada para cima (cima = true) ou para baixo. uv = (x, z). */
export function tampa(m, poly, y, k, cima = true) {
  const { pontos, indices } = triangular(poly);
  const ny = cima ? 1 : -1;
  const base = m.vertices;
  for (let i = 0; i < pontos.length / 2; i++) m.v(pontos[2 * i], y, pontos[2 * i + 1], 0, ny, 0, pontos[2 * i], pontos[2 * i + 1], k);
  for (let t = 0; t < indices.length; t += 3) m.tri(base + indices[t], base + indices[t + 1], base + indices[t + 2]);
}

/**
 * Parede vertical de (ax, az) a (bx, bz), normal para fora (à direita de a→b no sentido positivo). O v das
 * coordenadas conta de vBase (o shader das torres conta os andares a partir da base de cada trecho).
 */
export function parede(m, ax, az, bx, bz, y0, y1, k, ua = 0, ub = null, vBase = 0) {
  const dx = bx - ax;
  const dz = bz - az;
  const l = Math.hypot(dx, dz);
  if (l < 1e-6 || y1 - y0 < 1e-6) return;
  const n = [dz / l, 0, -dx / l];
  const u1 = ub ?? ua + l;
  const v0 = y0 - vBase;
  const v1 = y1 - vBase;
  m.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], n, [ua, v0], [u1, v0], [u1, v1], [ua, v1], k);
}

/**
 * Prisma vertical de um polígono: paredes (k ou fn(i, ax, az, bx, bz) → k | null), tampa de cima e de baixo.
 * uFn(i, ax, az, bx, bz) → [ua, ub] dá o u de cada parede (padrão: perímetro corrido); o v conta de vBase.
 */
export function prisma(m, poly, y0, y1, { paredes = null, topo = null, base = null, uFn = null, vBase = 0 } = {}) {
  const P = orientar(poly);
  const n = P.length / 2;
  let u = 0;
  for (let i = 0; i < n; i++) {
    const ax = P[2 * i];
    const az = P[2 * i + 1];
    const bx = P[2 * ((i + 1) % n)];
    const bz = P[2 * ((i + 1) % n) + 1];
    const l = Math.hypot(bx - ax, bz - az);
    const k = typeof paredes === 'function' ? paredes(i, ax, az, bx, bz) : paredes;
    if (k) {
      const [ua, ub] = uFn ? uFn(i, ax, az, bx, bz) : [u, u + l];
      parede(m, ax, az, bx, bz, y0, y1, k, ua, ub, vBase);
    }
    u += l;
  }
  if (topo) tampa(m, P, y1, topo, true);
  if (base) tampa(m, P, y0, base, false);
}

/**
 * Caixa orientada: centro (cx, cz), meia largura hw ao longo do eixo (ux, uz) e meia profundidade hd no eixo
 * perpendicular, de y0 a y1.
 */
export function caixa(m, cx, cz, hw, hd, y0, y1, k, { ux = 1, uz = 0, topo = true, base = false, lados = null } = {}) {
  const px = -uz;
  const pz = ux;
  const c = (sa, sb) => [cx + ux * hw * sa + px * hd * sb, cz + uz * hw * sa + pz * hd * sb];
  const poly = [...c(-1, -1), ...c(1, -1), ...c(1, 1), ...c(-1, 1)];
  prisma(m, poly, y0, y1, { paredes: lados ?? k, topo: topo ? k : null, base: base ? k : null });
}

/** Caixa alinhada aos eixos pelos cantos. */
export function bloco(m, x0, y0, z0, x1, y1, z1, k, op = {}) {
  caixa(m, (x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, y0, y1, k, op);
}

/** Cilindro (ou tronco de cone) vertical com seg lados. */
export function cilindro(m, cx, cz, y0, y1, r0, r1, seg, k, { topo = true, base = false, a0 = 0 } = {}) {
  const poly0 = [];
  for (let s = 0; s < seg; s++) {
    const a = a0 + (s / seg) * Math.PI * 2;
    poly0.push(Math.cos(a), Math.sin(a));
  }
  const inclina = (r0 - r1) / Math.max(1e-6, y1 - y0);
  const li = Math.hypot(1, inclina);
  for (let s = 0; s < seg; s++) {
    const c0 = poly0[2 * s], s0 = poly0[2 * s + 1];
    const c1 = poly0[2 * ((s + 1) % seg)], s1 = poly0[2 * ((s + 1) % seg) + 1];
    const u0 = (s / seg) * Math.PI * 2 * r0;
    const u1 = ((s + 1) / seg) * Math.PI * 2 * r0;
    // normal radial por vértice: o sombreado é de peça redonda, não de prisma facetado
    const n0 = [c0 / li, inclina / li, s0 / li];
    const n1 = [c1 / li, inclina / li, s1 / li];
    const a = m.v(cx + c0 * r0, y0, cz + s0 * r0, ...n0, u0, y0, k);
    const b = m.v(cx + c1 * r0, y0, cz + s1 * r0, ...n1, u1, y0, k);
    const c = m.v(cx + c1 * r1, y1, cz + s1 * r1, ...n1, u1, y1, k);
    const d = m.v(cx + c0 * r1, y1, cz + s0 * r1, ...n0, u0, y1, k);
    m.tri(a, b, c);
    m.tri(a, c, d);
  }
  const circ = (r) => poly0.map((v, i) => (i % 2 ? cz : cx) + v * r);
  if (topo && r1 > 0) tampa(m, circ(r1), y1, k, true);
  if (base && r0 > 0) tampa(m, circ(r0), y0, k, false);
}

/** Anel plano (coroa circular) na cota y, de r0 a r1. */
export function anelPlano(m, cx, y, cz, r0, r1, seg, k, cima = true) {
  const ny = cima ? 1 : -1;
  for (let s = 0; s < seg; s++) {
    const a = (s / seg) * Math.PI * 2;
    const b = ((s + 1) / seg) * Math.PI * 2;
    const p = (r, t) => [cx + Math.cos(t) * r, y, cz + Math.sin(t) * r];
    const A = p(r0, a), B = p(r1, a), C = p(r1, b), D = p(r0, b);
    m.quad(A, B, C, D, [0, ny, 0], [A[0], A[2]], [B[0], B[2]], [C[0], C[2]], [D[0], D[2]], k);
  }
}

/**
 * Sólido de revolução: perfil [[r, y], ...] de baixo para cima, seg lados; ex e ez esticam a planta (elipse),
 * rot gira a planta. Normais pela inclinação do perfil.
 */
export function torno(m, cx, cz, perfil, seg, k, { ex = 1, ez = 1, rot = 0, fecharTopo = false } = {}) {
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const pt = (r, y, a) => {
    const lx = Math.cos(a) * r * ex;
    const lz = Math.sin(a) * r * ez;
    return [cx + cr * lx + sr * lz, y, cz - sr * lx + cr * lz];
  };
  // inclinação do perfil em cada ponto (média das duas arestas vizinhas): [peso radial, y] da normal
  const incl = perfil.map((_, j) => {
    const [ra, ya] = perfil[Math.max(0, j - 1)];
    const [rb, yb] = perfil[Math.min(perfil.length - 1, j + 1)];
    const l = Math.hypot(rb - ra, yb - ya) || 1;
    return [(yb - ya) / l, -(rb - ra) / l];
  });
  // normal macia por vértice (radial da planta esticada no ângulo do vértice, inclinada pelo perfil): o globo do átrio
  // da Codex e as Supertrees leem curvas, não como poliedros de maquete
  const normal = (j, a) => {
    let nx = Math.cos(a) / ex;
    let nz = Math.sin(a) / ez;
    const nl = Math.hypot(nx, nz) || 1;
    nx = (nx / nl) * incl[j][0];
    nz = (nz / nl) * incl[j][0];
    return [cr * nx + sr * nz, incl[j][1], -sr * nx + cr * nz];
  };
  for (let j = 0; j + 1 < perfil.length; j++) {
    const [r0, y0] = perfil[j];
    const [r1, y1] = perfil[j + 1];
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const b = ((s + 1) / seg) * Math.PI * 2;
      const u0 = a * Math.max(r0, r1);
      const u1 = b * Math.max(r0, r1);
      const v = (r, y, t, jj, u) => {
        const p = pt(r, y, t);
        return m.v(p[0], p[1], p[2], ...normal(jj, t), u, y, k);
      };
      const i0 = v(r0, y0, a, j, u0);
      const i1 = v(r0, y0, b, j, u1);
      const i2 = v(r1, y1, b, j + 1, u1);
      const i3 = v(r1, y1, a, j + 1, u0);
      m.tri(i0, i1, i2);
      m.tri(i0, i2, i3);
    }
  }
  if (fecharTopo) {
    const [r, y] = perfil[perfil.length - 1];
    if (r > 0) {
      const poly = [];
      for (let s = 0; s < seg; s++) {
        const p = pt(r, y, (s / seg) * Math.PI * 2);
        poly.push(p[0], p[2]);
      }
      tampa(m, poly, y, k, true);
    }
  }
}

/** Hash pequeno e determinístico em [0, 1) (variação por peça, sem sorteio). */
export function hashF(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x61c88647);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------------------------------------------ árvores

const FOLHAS = ['#3b4a2b', '#445233', '#34432a', '#4b5536', '#3f4d33'];
const TRONCO = acab('#4a3f35', { rugo: 0.9 });

/**
 * Árvore baixa em polígonos (copa em tufos de icosaedros com normais macias), para terraços e parques: tipo 'copa' (oiti, ipê)
 * ou 'palmeira' (palmeira-imperial, tronco alto e leque de folhas). seg controla o detalhe (1 a 3).
 */
export function arvore(m, x, y, z, { altura = 8, raio = 3, semente = 0, tipo = 'copa', detalhe = 1 } = {}) {
  const h = hashF(semente, 7);
  const folha = acab(FOLHAS[Math.floor(h * FOLHAS.length) % FOLHAS.length], { rugo: 0.85, padrao: PADRAO.folha });
  if (tipo === 'palmeira') {
    // palmeira-imperial: estipe liso e claro, o palmito verde no alto e as folhas em arco que sobem e caem; cada folha
    // tem as duas faces (vista de baixo, da calçada, não some)
    const tr = Math.max(0.18, altura * 0.012);
    const topoTr = y + altura - 2.6;
    cilindro(m, x, z, y, topoTr, tr * 1.3, tr, detalhe >= 2 ? 7 : 5, acab('#9a948a', { rugo: 0.8 }), { topo: false });
    cilindro(m, x, z, topoTr, y + altura + 0.3, tr * 1.25, tr * 1.05, detalhe >= 2 ? 7 : 5, acab('#5b6a3a', { rugo: 0.7 }), { topo: true });
    const nf = detalhe >= 2 ? 14 : detalhe >= 1 ? 11 : 8;
    const k = acab(FOLHAS[Math.floor(h * FOLHAS.length) % FOLHAS.length], { rugo: 0.8, padrao: PADRAO.folha });
    const face = (A, B, C, D, n) => {
      m.quad(A, B, C, D, n, [0, 0], [1, 0], [1, 1], [0, 1], k);
      m.quad(A, B, C, D, [-n[0], -n[1], -n[2]], [0, 0], [1, 0], [1, 1], [0, 1], k);
    };
    for (let f = 0; f < nf; f++) {
      const a = (f / nf) * Math.PI * 2 + h * 3 + 0.4 * hashF(semente, f, 2);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const L = raio * (0.95 + 0.3 * hashF(semente, f));
      const cai = 0.4 + 0.9 * hashF(semente, f, 3); // as de baixo caem mais que as novas do alto
      const y0 = y + altura + 0.2;
      const P = [0, 0.3, 0.62, 1].map((t, i) => {
        const r = L * t;
        const yy = y0 + L * (0.55 * t - cai * t * t) + (i === 0 ? 0 : 0.2);
        return [x + ca * r, yy, z + sa * r];
      });
      const larg = [0.15, 0.75, 0.55, 0];
      const px = -sa;
      const pz = ca;
      const n = [ca * 0.2, 0.96, sa * 0.2];
      for (let s = 0; s < 3; s++) {
        const [a0, a1] = [P[s], P[s + 1]];
        const [w0, w1] = [larg[s], larg[s + 1]];
        // leve dobra em V ao longo da nervura (os folíolos caem dos dois lados)
        face([a0[0] + px * w0, a0[1] - w0 * 0.3, a0[2] + pz * w0], [a1[0] + px * w1, a1[1] - w1 * 0.3, a1[2] + pz * w1], [a1[0] - px * w1, a1[1] - w1 * 0.3, a1[2] - pz * w1], [a0[0] - px * w0, a0[1] - w0 * 0.3, a0[2] - pz * w0], n);
      }
    }
    return;
  }
  const tronco = altura * 0.38;
  cilindro(m, x, z, y, y + tronco + raio * 0.3, 0.22, 0.16, 5, TRONCO, { topo: false, a0: h * 2 });
  const tufos = detalhe >= 2 ? 5 : detalhe >= 1 ? 4 : 2;
  for (let t = 0; t < tufos; t++) {
    const a = h * 6.28 + t * 2.4;
    const d = t ? raio * (0.38 + 0.12 * hashF(semente, t, 3)) : 0;
    const cx = x + Math.cos(a) * d;
    const cz = z + Math.sin(a) * d;
    const cy = y + tronco + raio * (t ? 0.5 + 0.35 * hashF(semente, t, 5) : 0.85);
    const r = raio * (t ? 0.62 : 0.8);
    tufo(m, cx, cy, cz, r, r * 0.78, folha, semente * 7 + t);
  }
}

const ICO = (() => {
  const f = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, f, 0], [1, f, 0], [-1, -f, 0], [1, -f, 0], [0, -1, f], [0, 1, f], [0, -1, -f], [0, 1, -f], [f, 0, -1], [f, 0, 1], [-f, 0, -1], [-f, 0, 1]].map((p) => {
    const l = Math.hypot(...p);
    return p.map((c) => c / l);
  });
  const t = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  return { v, t };
})();

/** Tufo de copa: icosaedro achatado e mexido, com normais radiais (sombreado macio de folhagem). */
function tufo(m, cx, cy, cz, r, ry, k, semente) {
  const base = m.vertices;
  ICO.v.forEach((p, i) => {
    const j = 0.8 + 0.36 * hashF(semente, i);
    const x = cx + p[0] * r * j;
    const y = cy + p[1] * ry * j * (p[1] < 0 ? 0.6 : 1);
    const z = cz + p[2] * r * j;
    const tom = 0.82 + 0.3 * hashF(semente, i, 9) + (p[1] > 0 ? 0.1 : -0.12);
    m.v(x, y, z, p[0], p[1] * 0.8 + 0.25, p[2], x, z, [k[0] * tom, k[1] * tom, k[2] * tom, k[3]]);
  });
  for (const [a, b, c] of ICO.t) m.tri(base + a, base + b, base + c);
}

// ================================================================================================ as torres

/** Nível de detalhe do LOD0 por perfil. */
export const NIVEL = Object.freeze({ leve: 0, media: 1, alta: 2, ultra: 3, pc: 2 });

// bronze champanhe das aletas e montantes (anodizado acetinado: reflete ~50%, claro ao sol, nunca marrom)
const BRONZE = '#cbbb9d';

// acabamentos das torres (albedo real: nada acima de 0,80)
const K = {
  travertino: acab('#c9bda6', { rugo: 0.72, padrao: PADRAO.pedra }),
  granito: acab('#625d57', { rugo: 0.55, padrao: PADRAO.pedra }),
  piso: acab('#b4aa99', { rugo: 0.8, padrao: PADRAO.piso }),
  pisoEscuro: acab('#8d857a', { rugo: 0.75, padrao: PADRAO.piso }),
  bronze: acab(BRONZE, { rugo: 0.45, metal: 0.8, padrao: PADRAO.metal }),
  champanhe: acab('#d8caa9', { rugo: 0.38, metal: 0.8, padrao: PADRAO.metal }),
  laje: acab('#bfb092', { rugo: 0.45, metal: 0.8, padrao: PADRAO.metal }), // a borda da laje no tom das aletas: não vira anel
  ouro: acab('#c9a86a', { rugo: 0.25, metal: 1 }),
  laca: acab('#1c1c1e', { rugo: 0.28 }),
  metalEscuro: acab('#34363a', { rugo: 0.5, metal: 0.6 }),
  forro: acab('#d6cdbd', { rugo: 0.7, luz: LUZ.forro }),
  forroMarquise: acab('#cfc5b4', { rugo: 0.7, luz: LUZ.forro }),
  aro: acab('#e8dcc4', { rugo: 0.3, metal: 0.4, luz: LUZ.aro }),
  // a face de baixo do heliponto em alumínio champanhe, acesa à noite pela luz da lanterna (o Edge visto da rua)
  forroHeli: acab('#a39a8a', { rugo: 0.4, metal: 0.7, luz: LUZ.reflexo, padrao: PADRAO.metal }),
  obstaculo: acab('#7a1a14', { rugo: 0.4, luz: LUZ.obstaculo }),
  piscina: acab('#1f3d45', { rugo: 0.05, metal: 0.2, luz: LUZ.piscina, padrao: PADRAO.agua }),
  jardim: acab('#3d4a2c', { rugo: 0.9, padrao: PADRAO.folha }),
  jardineira: acab('#7d766b', { rugo: 0.8 }),
  grama: acab('#4d5a33', { rugo: 0.95, padrao: PADRAO.grama }),
  portuguesa: acab('#8c877c', { rugo: 0.85, padrao: PADRAO.portuguesa }),
  espelho: acab('#1a2a2e', { rugo: 0.03, metal: 0.15, padrao: PADRAO.agua }),
  coroa: acab('#d0bf9c', { rugo: 0.4, metal: 0.8, luz: LUZ.coroa, padrao: PADRAO.metal }),
  cobertura: acab('#3a3b3d', { rugo: 0.7 }),
  // a fita de LED das quinas e da Dream Bridge: alumínio claro com a luz por cima
  led: acab('#e6dfd2', { rugo: 0.3, metal: 0.3, luz: LUZ.led }),
};

const V = {
  cortina: vid(VIDRO.cortina, 0.11),
  costura: vid(VIDRO.costura, 0.37),
  // entalhes das quinas e fendas entre lâminas: o vidro da costura, com a luz da noite mais baixa (vC.z = 1)
  quina: vid(VIDRO.costura, 0.37, 1),
  vento: vid(VIDRO.vento, 0.53),
  saguao: vid(VIDRO.saguao, 0.71),
  // a lanterna da coroa leva 1 no último número (o shader a distingue do globo do átrio da Codex)
  lanterna: [VIDRO.lanterna, 0.29, 0, 1],
  parapeito: vid(VIDRO.parapeito, 0.83),
};

// medidas da planta, iguais nas duas torres (D64: 36 x 50 m cada)
const TL = TORRE_LAMINA;
const X = TL.planta.largura / 2; // 18
const Z0 = -TL.planta.comprimento / 2; // -25, face lisa
const ZF = TL.planta.comprimento / 2; // 25, penas
const Z1 = Z0 + TL.laminas[0].fundo; // +1: lâmina 1 | lâmina 2
const Z2 = Z1 + TL.laminas[1].fundo; // +15: lâmina 2 | lâmina 3
const PE = TL.pavimentos.altura; // 4.2
const LAJE = 0.8; // laje de cima de cada andar de vento (o vão livre é altura - LAJE)
const ENT = 1.5; // entalhe das quinas
const COST = { meia: TL.faceLisa.costura / 2, fundo: TL.faceLisa.recuoCostura }; // costura da face lisa
const REV = { meia: 1.2, fundo: 2.5 }; // fenda entre lâminas nas faces laterais (cada lâmina lê como uma placa)
const PASSO = TL.aletas.passo; // 1,5
const AL = { fundo: TL.aletas.fundo, meia: TL.aletas.espessura / 2 };
const MT = { fundo: TL.montantes.fundo, meia: TL.montantes.espessura / 2 };

/**
 * Medidas de uma torre derivadas da especificação (data/arcologia-plano.js, especTorre): cotas das lâminas, andares
 * de vento, coroa, heliponto, mastro e o pódio. base: a cota de onde o corpo sai em geometria (no par da sede v3, o
 * pódio redondo de 40 m cobre o pé das torres: o pódio próprio de 16 m e o corpo abaixo da praça não são desenhados);
 * os andares continuam contados do pódio próprio (o shader alinha as janelas).
 */
export function medidasTorre(spec = TORRE_LAMINA, { gemea = false, base = 0 } = {}) {
  const TOPO = spec.laminas.map((l) => l.topo);
  const [VENTO1, VENTO2] = spec.andaresDeVento;
  const PODIO = spec.podio.altura;
  const h = spec.heliponto;
  const COROA = {
    x: X - ENT, z0: Z0, z1: Z0 + spec.coroa.fundo, y0: spec.coroa.base, yVidro: spec.coroa.base + spec.coroa.altura - spec.coroa.oca,
    y1: h ? h.cota - h.espessura : spec.altura,
  };
  const HELI = h ? { x: 0, z: Z0 + spec.coroa.fundo + h.balanco - h.diametro / 2, r: h.diametro / 2, y1: h.cota, y0: h.cota - h.espessura } : null;
  const MASTRO = spec.mastro ? { x: 0, z: spec.mastro.z, r: spec.mastro.raio, topo: spec.mastro.topo } : null;
  const PD = gemea ? { ...spec.podio, tras: 0, marquise: 0 } : spec.podio;
  const BASE = Math.max(PODIO, base);
  return {
    spec, gemea, TOPO, VENTO1, VENTO2, PODIO, COROA, HELI, MASTRO, PD, BASE, semPodio: base > PODIO,
    PODIO_X: PD.largura / 2,
    PODIO_Z0: Z0 - PD.tras,
    PODIO_Z1: ZF + PD.frente,
    // lâmina de cada z (0, 1 ou 2) e o trecho z dela na face lateral (sem fendas nem entalhes)
    LAMINAS_Z: [
      { z0: Z0 + ENT, z1: Z1 - REV.meia, topo: TOPO[0] },
      { z0: Z1 + REV.meia, z1: Z2 - REV.meia, topo: TOPO[1] },
      { z0: Z2 + REV.meia, z1: ZF - ENT, topo: TOPO[2] },
    ],
    // base do pavimento de cada trecho do corpo (o shader conta os andares a partir dela)
    bases: [PODIO, VENTO1.base + VENTO1.altura, VENTO2.base + VENTO2.altura],
    topo: MASTRO ? MASTRO.topo : spec.altura,
  };
}

const M_LAMINA = medidasTorre(TORRE_LAMINA);

/** u das paredes da Torre: x + 18 nas faces que olham para z, z + 25 nas que olham para x (grade de 1,5 m). */
const uTorre = (i, ax, az, bx, bz) => (Math.abs(bx - ax) >= Math.abs(bz - az) ? [ax + X, bx + X] : [az - Z0, bz - Z0]);

/**
 * Contorno de um trecho do corpo (pares x, z, orientação positiva): retângulo de meia largura x e z de z0 a z1, com
 * entalhes nas quinas, a costura no meio da face lisa e as fendas entre lâminas nas faces laterais (em z = revel).
 * Devolve também o papel de cada aresta ('face', 'costura', 'fenda', 'entalhe').
 */
export function contornoTrecho({ x = X, z0 = Z0, z1 = ZF, entalhe = ENT, costura = true, fendas = [] }) {
  const P = [];
  const papel = [];
  const pt = (px, pz, pp) => {
    P.push(px, pz);
    papel.push(pp);
  };
  const e = entalhe;
  // face lisa (z = z0), de -x a +x
  pt(-x + e, z0, 'face');
  if (costura) {
    pt(-COST.meia, z0, 'costura');
    pt(-COST.meia, z0 + COST.fundo, 'costura');
    pt(COST.meia, z0 + COST.fundo, 'costura');
    pt(COST.meia, z0, 'face');
  }
  pt(x - e, z0, 'entalhe');
  if (e) pt(x - e, z0 + e, 'entalhe');
  // face lateral direita (x = +x), z crescendo
  pt(x, z0 + e, 'face');
  for (const zr of fendas) {
    pt(x, zr - REV.meia, 'fenda');
    pt(x - REV.fundo, zr - REV.meia, 'fenda');
    pt(x - REV.fundo, zr + REV.meia, 'fenda');
    pt(x, zr + REV.meia, 'face');
  }
  pt(x, z1 - e, 'entalhe');
  if (e) pt(x - e, z1 - e, 'entalhe');
  // frente (z = z1), de +x a -x
  pt(x - e, z1, 'face');
  pt(-x + e, z1, 'entalhe');
  if (e) pt(-x + e, z1 - e, 'entalhe');
  // face lateral esquerda (x = -x), z decrescendo
  pt(-x, z1 - e, 'face');
  for (const zr of [...fendas].reverse()) {
    pt(-x, zr + REV.meia, 'fenda');
    pt(-x + REV.fundo, zr + REV.meia, 'fenda');
    pt(-x + REV.fundo, zr - REV.meia, 'fenda');
    pt(-x, zr - REV.meia, 'face');
  }
  pt(-x, z0 + e, 'entalhe');
  if (e) pt(-x + e, z0 + e, 'entalhe');
  // tira pontos repetidos seguidos (entalhe zero), mantendo o papel da aresta que sai de cada ponto
  const Q = [];
  const pq = [];
  for (let i = 0; i < P.length / 2; i++) {
    const k = Q.length;
    if (k && Math.abs(Q[k - 2] - P[2 * i]) < 1e-6 && Math.abs(Q[k - 1] - P[2 * i + 1]) < 1e-6) {
      pq[pq.length - 1] = papel[i];
      continue;
    }
    Q.push(P[2 * i], P[2 * i + 1]);
    pq.push(papel[i]);
  }
  return { poly: Q, papel: pq };
}

/**
 * Trechos do corpo, de baixo para cima (o andar de vento recua 2 m; a laje de cima fecha cada um). base: a cota de
 * onde o shader conta os andares do trecho (o v das paredes sai dela).
 */
export function trechosCorpo(M = M_LAMINA) {
  const { VENTO1, VENTO2, PODIO, TOPO, BASE } = M;
  const r1 = VENTO1.recuo;
  const r2 = VENTO2.recuo;
  const t1 = VENTO1.base + VENTO1.altura;
  const t2 = VENTO2.base + VENTO2.altura;
  return [
    { nome: 'l123', y0: BASE, y1: VENTO1.base, z1: ZF, fendas: [Z1, Z2], base: PODIO },
    { nome: 'vento1', y0: VENTO1.base, y1: t1 - LAJE, x: X - r1, z0: Z0 + r1, z1: Z2 - r1, entalhe: 0, costura: false, vento: true, base: VENTO1.base },
    { nome: 'laje1', y0: t1 - LAJE, y1: t1, z1: Z2, fendas: [Z1], laje: true },
    { nome: 'l12', y0: t1, y1: VENTO2.base, z1: Z2, fendas: [Z1], base: t1 },
    { nome: 'vento2', y0: VENTO2.base, y1: t2 - LAJE, x: X - r2, z0: Z0 + r2, z1: Z2 - r2, entalhe: 0, costura: false, vento: true, base: VENTO2.base },
    { nome: 'laje2', y0: t2 - LAJE, y1: t2, z1: Z2, fendas: [Z1], laje: true },
    { nome: 'l1', y0: t2, y1: TOPO[0], z1: Z1, fendas: [], base: t2 },
  ];
}

/** Linhas da grade de 1,5 m entre a e b (com folga nas pontas). */
function linhas(a, b, origem, passo = PASSO, folga = 0.15) {
  const out = [];
  const k0 = Math.ceil((a + folga - origem) / passo - 1e-9);
  const k1 = Math.floor((b - folga - origem) / passo + 1e-9);
  for (let k = k0; k <= k1; k++) out.push(origem + k * passo);
  return out;
}

/** Pena: quanto a aleta passa do terraço (de 2,5 andares no fundo a quase 1 na frente): o topo de cada lâmina se desfia. */
const pena = (t) => PE * (2.5 - 1.6 * t);

/**
 * Leva o v das peças acesas da coroa (LUZ.coroa) à fração da altura dela, de 0 a 30: o brilho que sobe para o alto no
 * shader não depende da cota (as duas torres têm coroas em cotas diferentes).
 */
function coroaRelativa(m, M) {
  const { y0 } = M.COROA;
  const y1 = M.HELI ? M.HELI.y1 : M.spec.altura;
  for (let i = 0; i < m.c.length / 4; i++) {
    const pk = Math.round(m.c[4 * i + 3]);
    if (((pk >> 4) & 15) !== LUZ.coroa) continue;
    const y = m.p[3 * i + 1];
    m.uv[2 * i + 1] = Math.max(0, Math.min(1, (y - y0) / Math.max(1, y1 - y0))) * 30;
  }
  return m;
}

/**
 * LOD0 de uma torre por nível de detalhe (0 leve, 1 média, 2 alta, 3 ultra).
 * @param {{ nivel?: number, comEsplanada?: boolean, spec?: object, gemea?: boolean }} op
 * @returns {{ vidro: Malha, opaco: Malha }}
 */
export function malhasTorre({ nivel = 1, comEsplanada = false, spec = TORRE_LAMINA, gemea = false, base = 0 } = {}) {
  const M = medidasTorre(spec, { gemea, base });
  const { COROA, TOPO, BASE, VENTO1, VENTO2, LAMINAS_Z } = M;
  const vidro = new Malha('vidro');
  const opaco = new Malha('opaco');

  // ---------- corpo: vidro por trecho, lajes e tampas ----------
  for (const t of trechosCorpo(M)) {
    const { poly, papel } = contornoTrecho({ x: t.x ?? X, z0: t.z0 ?? Z0, z1: t.z1, entalhe: t.entalhe ?? ENT, costura: t.costura ?? true, fendas: t.fendas ?? [] });
    if (t.laje) {
      // laje do andar de vento: faixa champanhe (clara), forro aceso por baixo, piso por cima
      prisma(opaco, poly, t.y0, t.y1, { paredes: K.laje, uFn: uTorre, base: K.forro, topo: K.piso });
      continue;
    }
    if (t.vento) {
      prisma(vidro, poly, t.y0, t.y1, { paredes: V.vento, uFn: uTorre, vBase: t.base });
      continue;
    }
    prisma(vidro, poly, t.y0, t.y1, { paredes: (i) => (papel[i] === 'face' ? V.cortina : papel[i] === 'costura' ? V.costura : V.quina), uFn: uTorre, vBase: t.base });
    // tampa de cima (terraço da lâmina que acaba aqui e o piso da borda do recuo)
    tampa(opaco, poly, t.y1, K.piso, true);
  }

  // ---------- coroa-lanterna: vidro até a parte oca, gaiola aberta de aletas até o topo ----------
  {
    const { poly, papel } = contornoTrecho({ x: COROA.x, z0: COROA.z0, z1: COROA.z1, entalhe: 0, costura: true, fendas: [] });
    prisma(vidro, poly, COROA.y0, COROA.yVidro, { paredes: (i) => (papel[i] === 'costura' ? V.costura : V.lanterna), uFn: uTorre, vBase: COROA.y0 });
    tampa(opaco, poly, COROA.yVidro, K.cobertura, true);
    // núcleo dentro da gaiola: segura o heliponto na maior; na irmã fica baixo, e a gaiola lê oca contra o céu
    bloco(opaco, -4.5, COROA.yVidro, COROA.z0 + 6, 4.5, M.HELI ? COROA.y1 : COROA.yVidro + (COROA.y1 - COROA.yVidro) * 0.35, COROA.z1 - 5, K.metalEscuro);
    // montantes finos do vidro-lanterna, entre as aletas (a partir da média)
    if (nivel >= 1) {
      for (const x of linhas(-COROA.x, COROA.x, -X + PASSO / 2)) bloco(opaco, x - 0.06, COROA.y0, COROA.z1, x + 0.06, COROA.yVidro, COROA.z1 + 0.18, K.bronze, { topo: false });
      for (const s of [-1, 1]) for (const z of linhas(COROA.z0, COROA.z1, Z0 + PASSO / 2)) bloco(opaco, Math.min(s * COROA.x, s * (COROA.x + 0.18)), COROA.y0, z - 0.06, Math.max(s * COROA.x, s * (COROA.x + 0.18)), COROA.yVidro, z + 0.06, K.bronze, { topo: false });
    }
    // aro fino que amarra o topo das aletas
    anelRet(opaco, -(X + AL.fundo), COROA.z0 - MT.fundo, X + AL.fundo, COROA.z1 + AL.fundo, COROA.y1 - 0.5, COROA.y1, 0.45, K.coroa);
    if (!M.HELI) luzesObstaculo(opaco, COROA);
  }

  // ---------- aletas de bronze das faces laterais (com penas no alto de cada lâmina) ----------
  const alturaAleta = (b, z) => {
    const L = LAMINAS_Z[b];
    if (b === 0 && z <= COROA.z1) return COROA.y1 - 0.5; // sobem até o aro da coroa
    const za = b === 0 ? COROA.z1 : L.z0;
    const t = Math.max(0, Math.min(1, (z - za) / Math.max(1, L.z1 - za)));
    return L.topo + pena(t);
  };
  for (const lado of [-1, 1]) {
    for (let b = 0; b < 3; b++) {
      const L = LAMINAS_Z[b];
      for (const z of linhas(L.z0, L.z1, Z0)) aleta(opaco, lado, z, BASE, alturaAleta(b, z), nivel, M);
    }
  }

  // ---------- montantes das frentes e da face lisa ----------
  const montante = (x, z, sz, y0, y1, k = K.bronze) => {
    // sz: -1 face lisa (para -z), +1 frente (para +z)
    const zc = z + (sz * MT.fundo) / 2;
    bloco(opaco, x - MT.meia, y0, zc - MT.fundo / 2, x + MT.meia, y1, zc + MT.fundo / 2, k, { topo: true });
  };
  const xsFace = linhas(-X + ENT, X - ENT, -X).filter((x) => Math.abs(x) > COST.meia + 0.25);
  for (const x of xsFace) {
    montante(x, Z0, -1, BASE, COROA.yVidro);
    montante(x, Z0, -1, COROA.yVidro, COROA.y1 - 0.5, K.coroa); // na gaiola
  }
  // frentes das penas: lâmina 3 (z = 25), 2 (z = 15) e 1 (z = 1), cada uma de onde nasce até o parapeito
  const frentes = [
    { z: ZF, y0: BASE, y1: TOPO[2] + M.spec.parapeito },
    { z: Z2, y0: TOPO[2], y1: TOPO[1] + M.spec.parapeito },
    { z: Z1, y0: TOPO[1], y1: TOPO[0] + M.spec.parapeito },
  ];
  for (const f of frentes) for (const x of linhas(-X + ENT, X - ENT, -X)) montante(x, f.z, 1, f.y0, f.y1);

  // ---------- andares de vento: montantes do vidro recuado (atrás das aletas contínuas) ----------
  // (sem travessas de andar em geometria: finas demais, fazem moiré de longe; o shader desenha o peitoril de cada andar)
  if (nivel >= 1) {
    for (const vv of [VENTO1, VENTO2]) {
      const xr = X - vv.recuo;
      const zr0 = Z0 + vv.recuo;
      const zr1 = Z2 - vv.recuo;
      const y0 = vv.base;
      const y1 = vv.base + vv.altura - LAJE;
      for (const x of linhas(-xr, xr, -X, PASSO * 2)) {
        bloco(opaco, x - 0.07, y0, zr0 - 0.2, x + 0.07, y1, zr0, K.bronze, { topo: false });
        bloco(opaco, x - 0.07, y0, zr1, x + 0.07, y1, zr1 + 0.2, K.bronze, { topo: false });
      }
      for (const z of linhas(zr0, zr1, Z0, PASSO * 2)) {
        bloco(opaco, -xr - 0.2, y0, z - 0.07, -xr, y1, z + 0.07, K.bronze, { topo: false });
        bloco(opaco, xr, y0, z - 0.07, xr + 0.2, y1, z + 0.07, K.bronze, { topo: false });
      }
    }
  }
  // frente da coroa (z = z1 da coroa): aletas de 1,5 m até o aro, a lanterna aparece entre elas
  for (const x of linhas(-COROA.x, COROA.x, -X)) {
    bloco(opaco, x - AL.meia, COROA.y0, COROA.z1, x + AL.meia, COROA.y1 - 0.5, COROA.z1 + AL.fundo, K.coroa);
  }
  // a coroa-lanterna tem as aletas duas vezes mais densas que o corpo: uma mais fina entre cada par, na frente e nos
  // lados, do terraço da lâmina 1 ao aro (de perto a lanterna lê como uma peça de joalheria, de longe como um véu)
  if (nivel >= 1) {
    const fina = AL.meia * 0.7;
    const fundo = AL.fundo * 0.8;
    for (const x of linhas(-COROA.x, COROA.x, -X + PASSO / 2)) bloco(opaco, x - fina, COROA.y0, COROA.z1, x + fina, COROA.y1 - 0.5, COROA.z1 + fundo, K.coroa, { topo: false });
    for (const lado of [-1, 1]) {
      for (const z of linhas(Z0 + ENT, COROA.z1, Z0 + PASSO / 2)) {
        const xa = lado * X;
        const xb = lado * (X + fundo);
        bloco(opaco, Math.min(xa, xb), COROA.y0, z - fina, Math.max(xa, xb), COROA.y1 - 0.5, z + fina, K.coroa, { topo: false });
      }
    }
  }

  // ---------- costura da face lisa: aletas densas do pódio à coroa ----------
  const passoC = M.spec.faceLisa.passoCostura;
  for (const x of linhas(-COST.meia, COST.meia, -COST.meia + passoC / 2, passoC, 0.05)) {
    bloco(opaco, x - 0.12, BASE, Z0 - 0.35, x + 0.12, COROA.y1 - 0.5, Z0 + COST.fundo, nivel >= 1 ? K.champanhe : K.bronze);
  }

  // ---------- andares de vento: colunas na faixa do recuo, entre o vidro recuado e a linha do corpo ----------
  if (nivel >= 1) {
    const segC = nivel >= 2 ? 12 : 8;
    for (const vv of [VENTO1, VENTO2]) {
      const y0 = vv.base;
      const y1 = vv.base + vv.altura - LAJE;
      const meio = X - vv.recuo / 2;
      for (const s of [-1, 1]) for (const z of [-19.5, -10.5, -1.5, 7.5]) cilindro(opaco, s * meio, z, y0, y1, 0.55, 0.55, segC, K.travertino, { topo: false });
      for (const x of [-12, -6, 6, 12]) cilindro(opaco, x, Z0 + vv.recuo / 2, y0, y1, 0.55, 0.55, segC, K.travertino, { topo: false });
      for (const x of [-12, -6, 0, 6, 12]) cilindro(opaco, x, Z2 - vv.recuo / 2, y0, y1, 0.55, 0.55, segC, K.travertino, { topo: false });
    }
  }

  // ---------- terraços das lâminas: parapeito de vidro, jardineiras e árvores ----------
  const terracos = [
    { y: TOPO[2], z0: Z2, z1: ZF, arvores: [4, 7, 8, 10][nivel] },
    { y: TOPO[1], z0: Z1, z1: Z2, arvores: [4, 10, 10, 12][nivel] },
    { y: TOPO[0], z0: COROA.z1, z1: Z1, arvores: [2, 5, 5, 6][nivel] },
  ];
  terracos.forEach((t, it) => {
    const xp = X - ENT - 0.3;
    // parapeito de vidro na frente e nos lados
    bloco(vidro, -xp, t.y, t.z1 - 0.35, xp, t.y + M.spec.parapeito, t.z1 - 0.3, V.parapeito, { topo: false });
    for (const s of [-1, 1]) bloco(vidro, s * (X - 0.35) - 0.03, t.y, t.z0 + 0.3, s * (X - 0.35) + 0.03, t.y + M.spec.parapeito, t.z1 - 1.8, V.parapeito, { topo: false });
    // jardineira corrida na frente e nos lados
    bloco(opaco, -xp + 0.2, t.y, t.z1 - 1.9, xp - 0.2, t.y + 0.9, t.z1 - 0.5, K.jardineira, { topo: false });
    bloco(opaco, -xp + 0.25, t.y + 0.88, t.z1 - 1.85, xp - 0.25, t.y + 0.92, t.z1 - 0.55, K.jardim);
    for (const s of [-1, 1]) {
      bloco(opaco, s * (X - 2.6), t.y, t.z0 + 0.6, s * (X - 1.0), t.y + 0.9, t.z1 - 2.0, K.jardineira, { topo: false });
      bloco(opaco, s * (X - 2.55), t.y + 0.88, t.z0 + 0.65, s * (X - 1.05), t.y + 0.92, t.z1 - 2.05, K.jardim);
    }
    // piso de madeira no meio (deck)
    bloco(opaco, -X + 4, t.y, t.z0 + 1.2, X - 4, t.y + 0.08, t.z1 - 2.4, K.pisoEscuro);
    // árvores em fila na jardineira da frente
    for (let a = 0; a < t.arvores; a++) {
      const f = (a + 0.5) / t.arvores;
      const x = -xp + 1.5 + f * (2 * xp - 3);
      arvore(opaco, x, t.y + 0.9, t.z1 - 1.2, { altura: 5 + 1.5 * hashF(it, a), raio: 1.6 + 0.4 * hashF(a, it), semente: it * 31 + a, detalhe: nivel });
    }
  });

  // ---------- pódio (travertino, colunata, saguão de vidro, marquise em balanço); no par, o pódio redondo cobre ----------
  if (!M.semPodio) podio(vidro, opaco, nivel, M);
  else saguaoNaPraca(vidro, opaco, nivel, M);
  // ---------- a linha de LED nas quinas das lâminas (D89) ----------
  ledQuinas(opaco, M);

  // ---------- heliponto e mastro (só na maior) ----------
  if (M.HELI) heliponto(opaco, nivel, M);
  if (comEsplanada) esplanada(opaco, nivel, M);
  coroaRelativa(opaco, M);
  return { vidro, opaco };
}

/**
 * Onde a torre sai da praça do pódio redondo (o par da sede v3): um saguão de vidro claro de 7 m, recuado 1,5 m sob
 * uma marquise de bronze em volta, e o embasamento de granito no piso da praça. É a entrada da torre pela praça.
 */
function saguaoNaPraca(vidro, opaco, nivel, M) {
  const y = M.BASE;
  const ret = (d) => [-X - d, Z0 - d, X + d, Z0 - d, X + d, ZF + d, -X - d, ZF + d];
  prisma(opaco, ret(2.4), y - 0.6, y + 0.15, { paredes: K.granito, topo: K.pisoEscuro });
  prisma(vidro, ret(-1.5), y + 0.15, y + 7, { paredes: V.saguao });
  // a marquise fina de bronze em volta (o forro aceso por baixo), à altura do saguão
  prisma(opaco, ret(2.2), y + 7, y + 7.6, { paredes: K.bronze, base: K.forroMarquise, topo: K.cobertura });
  if (nivel >= 1) for (const p of aoLongo(ret(1.1), 9)) caixa(opaco, p.x, p.z, 0.35, 0.35, y + 0.15, y + 7, K.bronze, { ux: p.ux, uz: p.uz, topo: false });
}

/**
 * A linha de LED nas quinas das lâminas (D89): uma fita fina de luz no fundo de cada entalhe das quinas, do saguão até
 * o terraço de cada lâmina (e nas quatro quinas da coroa até a gaiola). De dia, um fio claro; à noite, a linha que
 * conversa com a faixa dos anéis.
 */
function ledQuinas(opaco, M) {
  const w = M.spec.led.largura / 2;
  const fita = (x, z, y0, y1) => bloco(opaco, x - w, y0, z - w, x + w, y1, z + w, K.led, { topo: false });
  const L = M.LAMINAS_Z;
  const xq = X - ENT + w;
  // as quinas da face lisa sobem até o terraço da lâmina 1; as da frente de cada lâmina, até o terraço dela
  for (const s of [-1, 1]) {
    fita(s * xq, Z0 + ENT - w, M.BASE + 7.6, M.COROA.y0);
    fita(s * xq, ZF - ENT + w, M.BASE + 7.6, L[2].topo);
    fita(s * xq, Z2 - ENT + w, L[2].topo, L[1].topo);
    fita(s * xq, Z1 - ENT + w, L[1].topo, L[0].topo);
  }
}

/** Luzes de obstáculo nas quinas do aro da coroa (a torre sem mastro). */
function luzesObstaculo(m, COROA) {
  for (const sx of [-1, 1]) for (const z of [COROA.z0 + 0.6, COROA.z1 - 0.6]) {
    const x = sx * (X - 0.4);
    bloco(m, x - 0.35, COROA.y1, z - 0.35, x + 0.35, COROA.y1 + 0.7, z + 0.35, K.obstaculo);
  }
}

/**
 * Aleta de bronze da face lateral (lado -1 ou +1, no z dado). Do Alta para cima o corpo sai em painéis com junta de
 * 12 cm, de um andar até o terraço da lâmina 3 e de dois andares acima dele (na torre de 500 m o painel de um andar
 * em toda a altura passava do teto de 70 mil triângulos, D66; lá no alto a junta de dois andares lê igual).
 */
function aleta(m, lado, z, y0, y1, nivel, M, k = K.bronze) {
  const x0 = lado * X;
  const x1 = lado * (X + AL.fundo);
  const xm = x0 + lado * AL.fundo * 0.62;
  const corpo = (ya, yb) => bloco(m, Math.min(x0, xm), ya, z - AL.meia, Math.max(x0, xm), yb, z + AL.meia, k, { base: nivel >= 2 });
  if (nivel >= 1) {
    // nariz mais fino e mais claro, contínuo do pé ao topo (a linha que o olho segue)
    bloco(m, Math.min(xm, x1), y0, z - AL.meia * 0.42, Math.max(xm, x1), y1 + 0.3, z + AL.meia * 0.42, K.champanhe);
    if (nivel >= 2) {
      const [b0, b1, b2] = M.bases;
      let y = y0;
      while (y < y1 - 0.2) {
        const base = y < M.VENTO1.base ? b0 : y < M.VENTO2.base ? b1 : b2;
        const passo = y < M.VENTO1.base ? PE : 2 * PE;
        const prox = Math.min(y1, base + Math.floor((y - base) / passo + 1 + 1e-6) * passo);
        corpo(y, Math.max(y + 0.1, prox - 0.12));
        y = prox;
      }
      return;
    }
    corpo(y0, y1);
    return;
  }
  bloco(m, Math.min(x0, x1), y0, z - AL.meia, Math.max(x0, x1), y1, z + AL.meia, k);
}

/** Contorno do pódio com as quinas chanfradas (afastado d para fora). */
export function contornoPodio(d = 0, M = M_LAMINA) {
  const x = M.PODIO_X + d;
  const z0 = M.PODIO_Z0 - d;
  const z1 = M.PODIO_Z1 + d;
  const c = M.PD.chanfro + d * 0.41;
  return [-x + c, z0, x - c, z0, x, z0 + c, x, z1 - c, x - c, z1, -x + c, z1, -x, z1 - c, -x, z0 + c];
}

/** Pontos ao longo de um contorno a cada passo (centro de cada vão), com a direção da aresta. */
function aoLongo(poly, passo, folga = 1.2) {
  const P = orientar(poly);
  const n = P.length / 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const ax = P[2 * i];
    const az = P[2 * i + 1];
    const bx = P[2 * ((i + 1) % n)];
    const bz = P[2 * ((i + 1) % n) + 1];
    const l = Math.hypot(bx - ax, bz - az);
    const q = Math.max(1, Math.round((l - 2 * folga) / passo));
    for (let k = 0; k <= q; k++) {
      const t = (folga + ((l - 2 * folga) * k) / q) / l;
      out.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, ux: (bx - ax) / l, uz: (bz - az) / l });
    }
  }
  return out;
}

function podio(vidro, opaco, nivel, M) {
  const { PD, PODIO_X, PODIO_Z0, PODIO_Z1 } = M;
  const y0 = -3; // a base entra no chão (a plataforma do aplainar é plana, mas o relevo de prova não)
  const ye = PD.embasamento;
  const ys = PD.marquiseCota; // topo do saguão
  const yt = PD.altura;
  // embasamento de granito, 1 m para fora, e o piso da esplanada coberta
  prisma(opaco, contornoPodio(1.0, M), y0, ye, { paredes: K.granito, topo: K.pisoEscuro });
  // saguão de vidro recuado atrás da colunata
  prisma(vidro, contornoPodio(-1.8, M), ye, ys, { paredes: V.saguao });
  // colunata de travertino a cada 6 m
  for (const p of aoLongo(contornoPodio(-0.7, M), PD.passoPilares)) {
    caixa(opaco, p.x, p.z, PD.pilar / 2, PD.pilar / 2, ye, ys, K.travertino, { ux: p.ux, uz: p.uz, topo: false });
    if (nivel >= 1) {
      // base e capitel de bronze escurecido
      caixa(opaco, p.x, p.z, PD.pilar / 2 + 0.12, PD.pilar / 2 + 0.12, ye, ye + 0.6, K.bronze, { ux: p.ux, uz: p.uz });
      caixa(opaco, p.x, p.z, PD.pilar / 2 + 0.1, PD.pilar / 2 + 0.1, ys - 0.5, ys, K.bronze, { ux: p.ux, uz: p.uz, topo: false, base: true });
    }
  }
  // ático de travertino com o forro aceso por baixo (entre a colunata e o vidro)
  prisma(opaco, contornoPodio(0, M), ys, yt - 0.4, { paredes: K.travertino, base: K.forroMarquise });
  // pingadeira de bronze e o piso do terraço do pódio
  prisma(opaco, contornoPodio(0.25, M), yt - 0.4, yt, { paredes: K.bronze, topo: K.piso });
  // parapeito de vidro do terraço do pódio
  const par = orientar(contornoPodio(-0.4, M));
  for (let i = 0; i < par.length / 2; i++) {
    const j = (i + 1) % (par.length / 2);
    const ax = par[2 * i], az = par[2 * i + 1], bx = par[2 * j], bz = par[2 * j + 1];
    const l = Math.hypot(bx - ax, bz - az);
    caixa(vidro, (ax + bx) / 2, (az + bz) / 2, l / 2, 0.03, yt, yt + 1.1, V.parapeito, { ux: (bx - ax) / l, uz: (bz - az) / l, topo: false });
  }
  if (PD.marquise > 0) {
    // marquise de 12 m em balanço sobre a entrada (face lisa), com borda de bronze e forro aceso
    const mz1 = PODIO_Z0;
    const mz0 = PODIO_Z0 - PD.marquise;
    const mx = PD.marquiseLargura / 2;
    bloco(opaco, -mx, ys - PD.marquiseEspessura, mz0, mx, ys, mz1, K.bronze, { base: false });
    bloco(opaco, -mx + 0.3, ys - PD.marquiseEspessura - 0.02, mz0 + 0.3, mx - 0.3, ys - PD.marquiseEspessura + 0.01, mz1, K.forroMarquise, { topo: false, base: true, lados: false });
    // degraus de granito da entrada, do chão ao piso do embasamento
    for (let d = 0; d < 3; d++) bloco(opaco, -mx + 2 + d, y0, mz1 - 1 - (3 - d) * 0.8, mx - 2 - d, ((d + 1) * ye) / 3, mz1 - 1, K.granito);
    if (nivel >= 1) {
      // três portas giratórias de vidro com a coroa de bronze, no eixo da marquise
      const zp = PODIO_Z0 + 1.2;
      for (const x of [-6, 0, 6]) {
        cilindro(vidro, x, zp, ye, ye + 3.2, 1.6, 1.6, 12, V.saguao, { topo: false });
        cilindro(opaco, x, zp, ye + 3.2, ye + 3.6, 1.75, 1.75, 12, K.bronze, { topo: true, base: true });
        cilindro(opaco, x, zp, ye, ye + 3.2, 0.09, 0.09, 4, K.bronze, { topo: false });
      }
      // o monograma H da Holding, em champanhe, no ático de travertino sobre a marquise
      const zh = PODIO_Z0 - 0.14;
      bloco(opaco, -1.45, ys + 1.2, zh, -0.85, ys + 4.4, PODIO_Z0, K.champanhe, { base: true });
      bloco(opaco, 0.85, ys + 1.2, zh, 1.45, ys + 4.4, PODIO_Z0, K.champanhe, { base: true });
      bloco(opaco, -0.85, ys + 2.55, zh, 0.85, ys + 3.05, PODIO_Z0, K.champanhe, { base: true });
    }
  }
  // piscina de borda infinita virada para fora, no terraço da frente
  bloco(opaco, -15, yt - 0.3, ZF + 3, 15, yt + 0.02, PODIO_Z1 - 1.5, K.piscina, { lados: K.travertino });
  // jardineiras e árvores no terraço do pódio (lados e fundo)
  const nArv = [6, 12, 16, 22][nivel];
  for (let a = 0; a < nArv; a++) {
    const lado = a % 2 ? 1 : -1;
    const f = Math.floor(a / 2) / Math.max(1, Math.ceil(nArv / 2) - 1);
    const z = PODIO_Z0 + 3 + f * (PODIO_Z1 - PODIO_Z0 - 10);
    const x = lado * (PODIO_X - 3.5);
    bloco(opaco, x - 1.6, yt, z - 1.6, x + 1.6, yt + 0.8, z + 1.6, K.jardineira, { topo: false });
    bloco(opaco, x - 1.5, yt + 0.78, z - 1.5, x + 1.5, yt + 0.82, z + 1.5, K.jardim);
    arvore(opaco, x, yt + 0.8, z, { altura: 6 + 2 * hashF(a, 5), raio: 2 + 0.6 * hashF(a, 9), semente: 700 + a, detalhe: nivel });
  }
}

/**
 * Contorno do tabuleiro do heliponto (pares x, z): retângulo sobre a coroa e uma proa em meia elipse que avança o
 * balanço, apontada para o mesmo lado das penas. d afasta (positivo) ou recua o contorno.
 */
export function contornoHeliponto(d = 0, seg = 16, M = M_LAMINA) {
  const { COROA } = M;
  const xa = COROA.x + 0.5 + d;
  const z0 = COROA.z0 + 0.6 - d;
  const zf = COROA.z1; // de onde nasce a proa
  const ponta = COROA.z1 + M.spec.heliponto.balanco + d;
  const P = [-xa, z0, xa, z0];
  for (let s = 0; s <= seg; s++) {
    const t = (s / seg) * Math.PI;
    P.push(Math.cos(t) * xa, zf + Math.sin(t) * (ponta - zf));
  }
  return P;
}

/** Barra (tubo) de a até b com raio r. */
export function barra(m, a, b, r, seg, k) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(d[0], d[1], d[2]);
  if (L < 1e-6) return;
  const w = [d[0] / L, d[1] / L, d[2] / L];
  const ref = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u = [w[1] * ref[2] - w[2] * ref[1], w[2] * ref[0] - w[0] * ref[2], w[0] * ref[1] - w[1] * ref[0]];
  const lu = Math.hypot(...u);
  u = u.map((v) => v / lu);
  const v = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
  for (let s = 0; s < seg; s++) {
    const t0 = (s / seg) * Math.PI * 2;
    const t1 = ((s + 1) / seg) * Math.PI * 2;
    const tm = (t0 + t1) / 2;
    const dir = (t) => [Math.cos(t) * u[0] + Math.sin(t) * v[0], Math.cos(t) * u[1] + Math.sin(t) * v[1], Math.cos(t) * u[2] + Math.sin(t) * v[2]];
    const e0 = dir(t0);
    const e1 = dir(t1);
    const p = (o, e) => [o[0] + e[0] * r, o[1] + e[1] * r, o[2] + e[2] * r];
    m.quad(p(a, e0), p(a, e1), p(b, e1), p(b, e0), dir(tm), [t0 * r, 0], [t1 * r, 0], [t1 * r, L], [t0 * r, L], k);
  }
}

/** Anel retangular (moldura) de largura w entre os cantos (x0, z0) e (x1, z1), de y0 a y1. */
export function anelRet(m, x0, z0, x1, z1, y0, y1, w, k) {
  bloco(m, x0, y0, z0, x1, y1, z0 + w, k, { base: true });
  bloco(m, x0, y0, z1 - w, x1, y1, z1, k, { base: true });
  bloco(m, x0, y0, z0 + w, x0 + w, y1, z1 - w, k, { base: true });
  bloco(m, x1 - w, y0, z0 + w, x1, y1, z1 - w, k, { base: true });
}

/** Faixa plana ao longo de um contorno fechado (recuada r para dentro, largura w), na cota y. */
function faixaContorno(m, poly, y, recuo, w, k) {
  const P = orientar(poly);
  const n = P.length / 2;
  for (let i = 0; i < n; i++) {
    const ax = P[2 * i], az = P[2 * i + 1];
    const bx = P[2 * ((i + 1) % n)], bz = P[2 * ((i + 1) % n) + 1];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 1e-6) continue;
    const nx = (bz - az) / l; // normal para fora
    const nz = -(bx - ax) / l;
    const o = (px, pz, dd) => [px - nx * dd, y, pz - nz * dd];
    m.quad(o(ax, az, recuo), o(bx, bz, recuo), o(bx, bz, recuo + w), o(ax, az, recuo + w), [0, 1, 0], [ax, az], [bx, bz], [bx, bz], [ax, az], k);
  }
}

/**
 * Face de baixo do tabuleiro em cunha: plana sobre a coroa (z < zr) e subindo até a borda na ponta da proa. A
 * espessura extra vai de h na raiz a zero na ponta; paredes laterais fecham a cunha.
 */
function cunha(m, poly, yBase, zr, zPonta, h, k) {
  const P = orientar(poly);
  const n = P.length / 2;
  const yAt = (z) => yBase - h * Math.max(0, Math.min(1, 1 - (z - zr) / Math.max(1, zPonta - zr)));
  const { pontos, indices } = triangular(P);
  const b0 = m.vertices;
  for (let i = 0; i < pontos.length / 2; i++) {
    const x = pontos[2 * i];
    const z = pontos[2 * i + 1];
    m.v(x, yAt(z), z, 0, -1, 0.2, x, z, k);
  }
  for (let t = 0; t < indices.length; t += 3) m.tri(b0 + indices[t], b0 + indices[t + 1], b0 + indices[t + 2]);
  for (let i = 0; i < n; i++) {
    const ax = P[2 * i], az = P[2 * i + 1];
    const bx = P[2 * ((i + 1) % n)], bz = P[2 * ((i + 1) % n) + 1];
    const ya = yAt(az);
    const yb = yAt(bz);
    if (ya > yBase - 1e-3 && yb > yBase - 1e-3) continue;
    const l = Math.hypot(bx - ax, bz - az) || 1;
    const nn = [(bz - az) / l, 0, -(bx - ax) / l];
    m.quad([ax, ya, az], [bx, yb, bz], [bx, yBase, bz], [ax, yBase, az], nn, [0, ya], [l, yb], [l, yBase], [0, yBase], K.metalEscuro);
  }
}

function heliponto(m, nivel, M) {
  const { HELI, COROA, MASTRO } = M;
  const seg = [8, 20, 24, 28][nivel];
  const { y0, y1 } = HELI;
  const deck = contornoHeliponto(0, seg, M);
  // tabuleiro: borda champanhe fina, topo em laca preta e a face de baixo em cunha (grossa na coroa, fina na proa)
  prisma(m, deck, y0, y1 - 0.35, { paredes: K.metalEscuro });
  prisma(m, contornoHeliponto(0.05, seg, M), y1 - 0.35, y1, { paredes: K.coroa, topo: K.laca });
  cunha(m, deck, y0, COROA.z1, COROA.z1 + M.spec.heliponto.balanco, 3.2, K.forroHeli);
  // rede de proteção inclinada para fora, dos dois lados
  const Pd = orientar(contornoHeliponto(0.05, seg, M));
  const n = Pd.length / 2;
  for (let i = 0; i < n; i++) {
    const ax = Pd[2 * i], az = Pd[2 * i + 1];
    const bx = Pd[2 * ((i + 1) % n)], bz = Pd[2 * ((i + 1) % n) + 1];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 1e-6) continue;
    const nx = (bz - az) / l;
    const nz = -(bx - ax) / l;
    const fora = (px, pz, dd, y) => [px + nx * dd, y, pz + nz * dd];
    for (const [sy, dy] of [[1, 0], [-1, -0.06]]) {
      m.quad(fora(ax, az, 0, y1 - 0.3 + dy), fora(bx, bz, 0, y1 - 0.3 + dy), fora(bx, bz, 1.6, y1 - 0.95 + dy), fora(ax, az, 1.6, y1 - 0.95 + dy), [0, sy, 0], [0, 0], [1, 0], [1, 1], [0, 1], K.metalEscuro);
    }
  }
  // aro de luz no perímetro, o círculo de toque e o H dourado (lido de quem chega pelo ar)
  faixaContorno(m, contornoHeliponto(0, seg, M), y1 + 0.02, 0.5, 0.35, K.aro);
  anelPlano(m, HELI.x, y1 + 0.02, HELI.z, HELI.r * 0.62, HELI.r * 0.62 + 0.45, [24, 40, 56, 64][nivel], K.ouro);
  const hh = 4.5;
  const hw = 2.6;
  bloco(m, HELI.x - hw - 0.5, y1, HELI.z - hh, HELI.x - hw + 0.5, y1 + 0.03, HELI.z + hh, K.ouro);
  bloco(m, HELI.x + hw - 0.5, y1, HELI.z - hh, HELI.x + hw + 0.5, y1 + 0.03, HELI.z + hh, K.ouro);
  bloco(m, HELI.x - hw + 0.5, y1, HELI.z - 0.5, HELI.x + hw - 0.5, y1 + 0.03, HELI.z + 0.5, K.ouro);
  // luzes de aproximação no aro (a partir da média)
  if (nivel >= 1) for (let s = 0; s < 16; s++) {
    const a = (s / 16) * Math.PI * 2;
    const r = HELI.r * 0.62 - 0.6;
    bloco(m, HELI.x + Math.cos(a) * r - 0.2, y1, HELI.z + Math.sin(a) * r - 0.2, HELI.x + Math.cos(a) * r + 0.2, y1 + 0.2, HELI.z + Math.sin(a) * r + 0.2, K.aro);
  }
  // mastro com a luz de obstáculo
  if (MASTRO) {
    cilindro(m, MASTRO.x, MASTRO.z, COROA.yVidro, MASTRO.topo - 1, MASTRO.r, MASTRO.r * 0.45, nivel >= 2 ? 10 : 6, K.champanhe, { topo: true });
    cilindro(m, MASTRO.x, MASTRO.z, MASTRO.topo - 1, MASTRO.topo, 0.5, 0.35, 6, K.obstaculo, { topo: true });
  }
}

/**
 * Esplanada da Torre sozinha (planos B e C): piso de granito em volta do pódio (24 m), espelho d'água na frente das
 * penas (a Torre refletida, Marina Bay), gramados com palmeiras-imperiais nos lados e a pedra portuguesa em ondas na
 * chegada (Aterro do Flamengo). Laje rasa que assenta no relevo.
 */
export function esplanada(opaco, nivel = 1, M = M_LAMINA) {
  const { PD, PODIO_X, PODIO_Z0, PODIO_Z1 } = M;
  const ext = contornoPodio(24, M);
  prisma(opaco, ext, -1.2, 0.08, { paredes: K.granito, topo: K.piso });
  // chegada em pedra portuguesa (face lisa)
  bloco(opaco, -34, 0.08, PODIO_Z0 - 22, 34, 0.1, PODIO_Z0 - 1.5, K.portuguesa, { lados: false });
  // espelho d'água na frente (borda de granito)
  bloco(opaco, -32, 0.08, PODIO_Z1 + 3, 32, 0.45, PODIO_Z1 + 21, K.granito, { topo: false });
  bloco(opaco, -31.4, 0.08, PODIO_Z1 + 3.6, 31.4, 0.3, PODIO_Z1 + 20.4, K.espelho, { lados: false });
  // chegada: balizadores de granito na borda da marquise, postes finos de bronze e floreiras com um oiti de cada lado
  if (nivel >= 1 && PD.marquise > 0) {
    const mx = PD.marquiseLargura / 2;
    const mz0 = PODIO_Z0 - PD.marquise;
    const zb = mz0 - 1.2;
    for (let x = -mx + 1; x <= mx - 1 + 1e-6; x += 2.5) cilindro(opaco, x, zb, 0, 0.95, 0.28, 0.24, 6, K.granito, { topo: true });
    for (const x of [-mx - 2, mx + 2]) {
      for (const z of [mz0 - 4, mz0 - 11]) {
        cilindro(opaco, x, z, 0, 7.5, 0.12, 0.09, 6, K.bronze, { topo: false });
        bloco(opaco, x - 0.35, 7.5, z - 0.35, x + 0.35, 7.8, z + 0.35, K.aro, { base: true });
      }
    }
    for (const x of [-mx - 5.5, mx + 5.5]) {
      bloco(opaco, x - 2.2, 0, mz0 - 1, x + 2.2, 0.9, mz0 + 7, K.granito, { topo: false });
      bloco(opaco, x - 2.1, 0.86, mz0 - 0.9, x + 2.1, 0.9, mz0 + 6.9, K.jardim);
      arvore(opaco, x, 0.9, mz0 + 3, { altura: 8, raio: 3, semente: 811 + (x > 0 ? 1 : 0), detalhe: nivel });
    }
  }
  // gramados dos lados, com palmeiras-imperiais em fila e copas nos cantos
  const nPalma = [4, 8, 10, 12][nivel];
  for (const lado of [-1, 1]) {
    const x0 = lado * (PODIO_X + 5);
    const x1 = lado * (PODIO_X + 19);
    bloco(opaco, Math.min(x0, x1), 0.08, PODIO_Z0 + 2, Math.max(x0, x1), 0.14, PODIO_Z1 - 2, K.grama, { lados: false });
    for (let i = 0; i < nPalma; i++) {
      const z = PODIO_Z0 + 6 + (i * (PODIO_Z1 - PODIO_Z0 - 12)) / Math.max(1, nPalma - 1);
      arvore(opaco, lado * (PODIO_X + 16), 0.14, z, { tipo: 'palmeira', altura: 17 + 3 * hashF(i, lado), raio: 3.6, semente: 300 + i * 2 + (lado > 0 ? 1 : 0), detalhe: nivel });
    }
    const nCopa = [1, 3, 4, 5][nivel];
    for (let i = 0; i < nCopa; i++) {
      arvore(opaco, lado * (PODIO_X + 9 + 2 * hashF(i, 3)), 0.14, PODIO_Z0 + 10 + i * 18, { altura: 9, raio: 3.4, semente: 400 + i * 2 + (lado > 0 ? 1 : 0), detalhe: nivel });
    }
  }
}

/**
 * LOD1 de uma torre (vista da cidade): os mesmos volumes, as aletas no shader (faixas de bronze nas faces laterais) e
 * o que faz a silhueta (penas, coroa em gaiola, heliponto e mastro). Mesma caixa limite do LOD0.
 */
export function malhasTorreLod1({ comEsplanada = false, spec = TORRE_LAMINA, gemea = false, base = 0 } = {}) {
  const M = medidasTorre(spec, { gemea, base });
  const { COROA, TOPO, BASE, VENTO1, VENTO2, LAMINAS_Z, PD, PODIO_Z0, PODIO_Z1, HELI, MASTRO } = M;
  const vidro = new Malha('vidro');
  const opaco = new Malha('opaco');
  const k12 = (aletas) => vid(VIDRO.torreLod1, 0.11, aletas);
  // faces laterais (as de 50 m, ao longo de z) levam as aletas no shader; frentes e face lisa, os montantes
  const lateral = (ax, az, bx, bz) => Math.abs(bz - az) > Math.abs(bx - ax);
  for (const t of trechosCorpo(M)) {
    const { poly, papel } = contornoTrecho({ x: t.x ?? X, z0: t.z0 ?? Z0, z1: t.z1, entalhe: t.entalhe ?? ENT, costura: t.costura ?? true, fendas: t.fendas ?? [] });
    if (t.laje) {
      prisma(opaco, poly, t.y0, t.y1, { paredes: K.laje, uFn: uTorre, base: K.forro, topo: K.piso });
      continue;
    }
    if (t.vento) {
      prisma(vidro, poly, t.y0, t.y1, { paredes: (i, ax, az, bx, bz) => vid(VIDRO.vento, 0.53, lateral(ax, az, bx, bz) ? 1 : 0), uFn: uTorre, vBase: t.base });
      continue;
    }
    prisma(vidro, poly, t.y0, t.y1, {
      paredes: (i, ax, az, bx, bz) => (papel[i] === 'costura' ? V.costura : papel[i] !== 'face' ? V.quina : k12(lateral(ax, az, bx, bz) ? 1 : 0)),
      uFn: uTorre,
      vBase: t.base,
    });
    tampa(opaco, poly, t.y1, K.piso, true);
  }
  // aletas em geometria só onde fazem a silhueta: as penas que passam do terraço de cada lâmina e a gaiola da coroa
  // (o corpo delas, do pódio ao terraço, sai do shader, com a largura aparente pelo ângulo de vista)
  for (const lado of [-1, 1]) {
    for (let b = 0; b < 3; b++) {
      const L = LAMINAS_Z[b];
      for (const z of linhas(L.z0, L.z1, Z0, PASSO)) {
        let y0 = L.topo - 1;
        let y1;
        if (b === 0 && z <= COROA.z1) {
          y0 = COROA.y0;
          y1 = COROA.y1 - 0.5;
        } else {
          const za = b === 0 ? COROA.z1 : L.z0;
          y1 = L.topo + pena(Math.max(0, Math.min(1, (z - za) / Math.max(1, L.z1 - za))));
        }
        bloco(opaco, Math.min(lado * X, lado * (X + AL.fundo)), y0, z - AL.meia, Math.max(lado * X, lado * (X + AL.fundo)), y1, z + AL.meia, K.bronze);
      }
    }
  }
  // coroa: vidro-lanterna e a gaiola aberta de aletas a cada 3 m
  {
    const { poly, papel } = contornoTrecho({ x: COROA.x, z0: COROA.z0, z1: COROA.z1, entalhe: 0, costura: true, fendas: [] });
    prisma(vidro, poly, COROA.y0, COROA.yVidro, { paredes: (i) => (papel[i] === 'costura' ? V.costura : V.lanterna), uFn: uTorre, vBase: COROA.y0 });
    tampa(opaco, poly, COROA.yVidro, K.cobertura, true);
    bloco(opaco, -4.5, COROA.yVidro, COROA.z0 + 6, 4.5, HELI ? COROA.y1 : COROA.yVidro + (COROA.y1 - COROA.yVidro) * 0.35, COROA.z1 - 5, K.metalEscuro);
    for (const x of linhas(-COROA.x, COROA.x, -X, PASSO)) bloco(opaco, x - AL.meia, COROA.y0, COROA.z1, x + AL.meia, COROA.y1, COROA.z1 + AL.fundo, K.coroa);
    for (const x of linhas(-COROA.x, COROA.x, -X, PASSO * 2)) bloco(opaco, x - 0.3, COROA.yVidro, Z0 - MT.fundo, x + 0.3, COROA.y1, Z0, K.coroa);
    anelRet(opaco, -(X + AL.fundo), COROA.z0 - MT.fundo, X + AL.fundo, COROA.z1 + AL.fundo, COROA.y1 - 0.5, COROA.y1, 0.45, K.coroa);
    if (!HELI) luzesObstaculo(opaco, COROA);
  }
  // costura em relevo (as aletas densas viram 3 lâminas)
  for (const x of [-2, 0, 2]) bloco(opaco, x - 0.3, BASE, Z0 - 0.35, x + 0.3, COROA.y1 - 0.5, Z0 + COST.fundo, K.champanhe);
  // pódio (no par da sede v3, o pódio redondo cobre o pé da torre)
  if (!M.semPodio) {
    prisma(opaco, contornoPodio(1.0, M), -3, PD.embasamento, { paredes: K.granito, topo: K.pisoEscuro });
    prisma(vidro, contornoPodio(-1.8, M), PD.embasamento, PD.marquiseCota, { paredes: V.saguao });
    for (const p of aoLongo(contornoPodio(-0.7, M), PD.passoPilares)) caixa(opaco, p.x, p.z, PD.pilar / 2, PD.pilar / 2, PD.embasamento, PD.marquiseCota, K.travertino, { ux: p.ux, uz: p.uz, topo: false });
    prisma(opaco, contornoPodio(0, M), PD.marquiseCota, PD.altura - 0.4, { paredes: K.travertino, base: K.forroMarquise });
    prisma(opaco, contornoPodio(0.25, M), PD.altura - 0.4, PD.altura, { paredes: K.bronze, topo: K.piso });
    if (PD.marquise > 0) bloco(opaco, -PD.marquiseLargura / 2, PD.marquiseCota - PD.marquiseEspessura, PODIO_Z0 - PD.marquise, PD.marquiseLargura / 2, PD.marquiseCota, PODIO_Z0, K.bronze, { base: true });
    bloco(opaco, -15, PD.altura - 0.3, ZF + 3, 15, PD.altura + 0.02, PODIO_Z1 - 1.5, K.piscina, { lados: K.travertino });
  } else saguaoNaPraca(vidro, opaco, 0, M);
  ledQuinas(opaco, M);
  // terraços: só a faixa verde baixa atrás do parapeito. De longe, copas soltas no alto de cada lâmina liam como
  // enfeite de bolo; o jardim aparece inteiro de perto, no LOD0
  for (const t of [{ y: TOPO[2], z1: ZF }, { y: TOPO[1], z1: Z2 }, { y: TOPO[0], z1: Z1 }]) {
    bloco(opaco, -X + ENT + 0.5, t.y, t.z1 - 1.9, X - ENT - 0.5, t.y + 1.1, t.z1 - 0.5, K.jardim);
  }
  // colunas redondas de travertino no recuo dos andares de vento (de longe, o ritmo vertical atravessa a faixa clara)
  for (const vv of [VENTO1, VENTO2]) {
    const y0 = vv.base;
    const y1 = vv.base + vv.altura - LAJE;
    const meio = X - vv.recuo / 2;
    const col = (x, z) => cilindro(opaco, x, z, y0, y1, 0.55, 0.55, 8, K.travertino, { topo: false });
    for (const sx of [-1, 1]) for (const z of [-19.5, -10.5, -1.5, 7.5]) col(sx * meio, z);
    for (const x of [-12, -6, 6, 12]) col(x, Z0 + vv.recuo / 2);
    for (const x of [-12, -6, 0, 6, 12]) col(x, Z2 - vv.recuo / 2);
  }
  // parapeitos de vidro dos terraços (a linha fina que fecha cada lâmina contra o céu)
  for (const t of [{ y: TOPO[2], z0: Z2, z1: ZF }, { y: TOPO[1], z0: Z1, z1: Z2 }, { y: TOPO[0], z0: COROA.z1, z1: Z1 }]) {
    const xp = X - ENT - 0.3;
    bloco(vidro, -xp, t.y, t.z1 - 0.35, xp, t.y + M.spec.parapeito, t.z1 - 0.3, V.parapeito, { topo: false });
    for (const sx of [-1, 1]) bloco(vidro, sx * (X - 0.35) - 0.03, t.y, t.z0 + 0.3, sx * (X - 0.35) + 0.03, t.y + M.spec.parapeito, t.z1 - 1.8, V.parapeito, { topo: false });
  }
  if (HELI) {
    // heliponto em proa (a curva é silhueta contra o céu: segmentos como no LOD0 da Média) e mastro
    const segH = 20;
    prisma(opaco, contornoHeliponto(0, segH, M), HELI.y0, HELI.y1 - 0.35, { paredes: K.metalEscuro });
    prisma(opaco, contornoHeliponto(0.05, segH, M), HELI.y1 - 0.35, HELI.y1, { paredes: K.coroa, topo: K.laca });
    cunha(opaco, contornoHeliponto(0, segH, M), HELI.y0, COROA.z1, COROA.z1 + M.spec.heliponto.balanco, 3.2, K.forroHeli);
    faixaContorno(opaco, contornoHeliponto(0, segH, M), HELI.y1 + 0.02, 0.5, 0.4, K.aro);
    anelPlano(opaco, HELI.x, HELI.y1 + 0.02, HELI.z, HELI.r * 0.62, HELI.r * 0.62 + 0.5, 24, K.ouro);
  }
  if (MASTRO) {
    cilindro(opaco, MASTRO.x, MASTRO.z, COROA.yVidro, MASTRO.topo - 1, MASTRO.r, MASTRO.r * 0.45, 6, K.champanhe);
    cilindro(opaco, MASTRO.x, MASTRO.z, MASTRO.topo - 1, MASTRO.topo, 0.5, 0.35, 6, K.obstaculo);
  }
  if (comEsplanada) esplanada(opaco, 0, M);
  coroaRelativa(opaco, M);
  return { vidro, opaco };
}

/**
 * Volume que projeta a sombra própria (D43): as lâminas, a coroa e o pódio recuados 2,5 m para dentro da linha do
 * vidro (as aletas e os andares de vento recuados ficam fora do volume e não se sombreiam por engano), o heliponto e
 * o mastro. Uma chamada.
 */
export function malhaSombraTorre({ spec = TORRE_LAMINA, gemea = false, base = 0 } = {}) {
  const M = medidasTorre(spec, { gemea, base });
  const { TOPO, BASE, COROA, HELI, MASTRO, PD } = M;
  const m = new Malha('opaco');
  const k = K.cobertura;
  const d = 2.5;
  const rect = (x, z0, z1) => [-x, z0, x, z0, x, z1, -x, z1];
  prisma(m, rect(X - d, Z0 + d, ZF - d), BASE, TOPO[2], { paredes: k, topo: k });
  prisma(m, rect(X - d, Z0 + d, Z2 - d), TOPO[2], TOPO[1], { paredes: k, topo: k });
  prisma(m, rect(X - d, Z0 + d, Z1 - d), TOPO[1], TOPO[0], { paredes: k, topo: k });
  prisma(m, rect(COROA.x - d, COROA.z0 + d, COROA.z1 - d), TOPO[0], HELI ? COROA.y1 : COROA.yVidro, { paredes: k, topo: k });
  if (HELI) prisma(m, contornoHeliponto(-1.5, 6, M), HELI.y0 + 0.2, HELI.y1 - 0.2, { paredes: k, topo: k, base: k });
  if (!M.semPodio) prisma(m, contornoPodio(-1.0, M), 0, PD.altura - 0.5, { paredes: k, topo: k });
  if (MASTRO) cilindro(m, MASTRO.x, MASTRO.z, TOPO[0], MASTRO.topo - 2, MASTRO.r * 0.6, 0.2, 4, k);
  return m;
}

/** Pontos de interesse no espaço local de uma torre (câmeras da prancha, pouso). */
export function pontosTorre(M = M_LAMINA) {
  const { COROA, HELI, PD, PODIO, PODIO_X, PODIO_Z0, PODIO_Z1 } = M;
  return Object.freeze({
    centro: [0, (M.spec.altura + PODIO) / 2, 0],
    heliponto: HELI ? [HELI.x, HELI.y1, HELI.z] : null,
    entrada: [0, PD.marquiseCota / 2, PODIO_Z0 - PD.marquise / 2],
    coroa: [0, (COROA.y0 + COROA.y1) / 2, (COROA.z0 + COROA.z1) / 2],
    topo: M.topo,
    podio: { x: PODIO_X, z0: PODIO_Z0, z1: PODIO_Z1 },
  });
}

/** Pontos da Blade Tower sozinha. */
export const PONTOS_TORRE = pontosTorre(M_LAMINA);

// ------------------------------------------------------------------------------------------------ o par (D89)

const KP = {
  bronze: K.bronze,
  granito: K.granito,
  forro: K.forro,
  jardim: K.jardim,
  jardineira: K.jardineira,
  piscina: K.piscina,
  led: K.led,
  // o deck de madeira do jardim da ponte
  deck: acab('#8a7158', { rugo: 0.8 }),
  // a pele branca da ponte (o SkyPark lê como uma lâmina branca entre as torres de vidro)
  branco: acab('#e3e0d8', { rugo: 0.5 }),
};

/** Modo de cada peça de água do material 'cascata' (o shader desenha cada um). */
export const CASCATA = Object.freeze({ lamina: 0, nevoa: 1, espuma: 2, faixa: 3 });

/**
 * Casca cilíndrica vertical de um efeito (névoa): uv = (volta em metros, altura). Entre os ângulos a0 e a1 (radianos),
 * com o raio de r0 (no pé) a r1 (no alto).
 */
export function cascaEfeito(m, cx, cz, y0, y1, r0, r1, seg, modo, linhas = 1, fase = 0, a0 = 0, a1 = Math.PI * 2) {
  const k = [modo, fase, 0, 0];
  const base = m.vertices;
  for (let j = 0; j <= linhas; j++) {
    const t = j / linhas;
    const y = y0 + (y1 - y0) * t;
    const r = r0 + (r1 - r0) * t;
    for (let s = 0; s <= seg; s++) {
      const a = a0 + ((a1 - a0) * s) / seg;
      m.v(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, Math.cos(a), 0, Math.sin(a), a * Math.max(r0, r1), y - y0, k);
    }
  }
  const L = seg + 1;
  for (let j = 0; j < linhas; j++) for (let s = 0; s < seg; s++) {
    const a = base + j * L + s;
    m.tri(a, a + 1, a + L + 1);
    m.tri(a, a + L + 1, a + L);
  }
}

/** Medidas de uma torre do par (o pódio redondo cobre o pé dela até a praça). */
export const medidasDoPar = (spec) => medidasTorre(spec, { gemea: true, base: PAR.podio });

/**
 * A Dream Bridge (D89) no espaço do par: ponte-jardim de dois níveis entre as faces laterais das duas torres, a 330 m.
 * Embaixo, o andar fechado de vidro claro com o forro aceso; em cima, o jardim do SkyPark com o deck, as jardineiras com
 * árvores, a piscina estreita e o guarda-corpo de vidro; por fora, a pele branca com a linha de LED nas bordas; e as
 * pernas inclinadas de bronze das Petronas, do meio da ponte até as fachadas.
 */
function pontePar(vidro, opaco, nivel) {
  const P = PAR.ponte;
  const xf = PAR.vao / 2 + P.embute; // entra um pouco em cada torre
  const { cota, z0, z1, espessura } = P;
  const yb = cota - espessura - P.nivelFechado; // o fundo da ponte
  const yf = cota - espessura; // o piso do jardim, por baixo da laje
  // pele branca: o fundo e as laterais, com o forro aceso por baixo
  bloco(opaco, -xf, yb - 0.6, z0 - 0.4, xf, yb, z1 + 0.4, KP.branco, { base: false });
  bloco(opaco, -xf + 0.4, yb - 0.62, z0, xf - 0.4, yb - 0.6, z1, KP.forro, { topo: false, base: true, lados: false });
  // o andar fechado: vidro claro dos dois lados compridos
  for (const z of [z0, z1]) bloco(vidro, -xf, yb, z - 0.08, xf, yf, z + 0.08, V.saguao, { topo: false });
  // a laje do jardim, branca, com a borda fina
  bloco(opaco, -xf, yf, z0 - 0.6, xf, cota, z1 + 0.6, KP.branco, { topo: false });
  bloco(opaco, -xf, cota - 0.02, z0 - 0.6, xf, cota, z1 + 0.6, KP.deck, { lados: false });
  // a linha de LED nas duas bordas compridas
  for (const z of [z0 - 0.62, z1 + 0.62]) bloco(opaco, -xf, yf + 0.9, z - 0.12, xf, yf + 1.3, z + 0.12, KP.led, { topo: false });
  // guarda-corpo de vidro do jardim
  for (const z of [z0 - 0.4, z1 + 0.4]) bloco(vidro, -xf, cota, z - 0.04, xf, cota + 1.2, z + 0.04, V.parapeito, { topo: false });
  // a piscina estreita no meio, com a borda de pedra (a do Marina Bay Sands, aqui sobre o vão)
  const zm = (z0 + z1) / 2;
  bloco(opaco, -10, cota - 0.4, zm - 2.2, 10, cota + 0.04, zm + 2.2, KP.piscina, { lados: KP.granito });
  // jardineiras com árvores nas duas margens do deck
  const nArv = [2, 4, 5, 6][nivel];
  for (const zl of [z0 + 2.2, z1 - 2.2]) {
    bloco(opaco, -xf + 1.5, cota, zl - 1.2, xf - 1.5, cota + 0.9, zl + 1.2, KP.jardineira, { topo: false });
    bloco(opaco, -xf + 1.6, cota + 0.86, zl - 1.1, xf - 1.6, cota + 0.92, zl + 1.1, KP.jardim);
    for (let a = 0; a < nArv; a++) {
      const x = -xf + 3 + ((2 * xf - 6) * (a + 0.5)) / nArv;
      arvore(opaco, x, cota + 0.9, zl, { altura: 4.5 + 1.5 * hashF(a, Math.round(zl)), raio: 1.6, semente: 1200 + a + Math.round(zl), detalhe: Math.min(nivel, 1) });
    }
  }
  // as pernas inclinadas (Petronas): do meio do fundo da ponte até cada fachada, um par em cada lado
  const yp = P.pernas.cota;
  const seg = nivel >= 2 ? 8 : 6;
  for (const s of [-1, 1]) {
    for (const z of [z0 + 4, z1 - 4]) {
      barra(opaco, [0, yb - 0.6, z], [s * (PAR.vao / 2 - 0.5), yp, z], 0.55, seg, KP.bronze);
    }
    // a sapata onde a perna encosta na torre
    bloco(opaco, s * (PAR.vao / 2) - (s > 0 ? 1.4 : 0), yp - 1.2, z0 + 2, s * (PAR.vao / 2) + (s > 0 ? 0 : 1.4), yp + 1.2, z1 - 2, KP.bronze);
  }
}

/**
 * O par (D89) no espaço do par: as duas torres (LOD0 do nível, ou LOD1) lado a lado, a Blade em x = -32 e a Legacy em
 * x = +32, as duas com as penas para +z, e a Dream Bridge entre elas.
 * @param {{ nivel?: number, lod?: 0 | 1 }} op
 * @returns {{ vidro: Malha, opaco: Malha, efeitos: Malha }}
 */
export function malhasPar({ nivel = 1, lod = 0 } = {}) {
  const vidro = new Malha('vidro');
  const opaco = new Malha('opaco');
  const efeitos = new Malha('cascata');
  for (const t of torresDoPar({ x: 0, z: 0, rot: 0 })) {
    const op = { spec: t.spec, gemea: true, base: PAR.podio };
    const m = lod === 0 ? malhasTorre({ nivel, ...op }) : malhasTorreLod1(op);
    m.vidro.transformar(t.x, 0, t.z, 0);
    m.opaco.transformar(t.x, 0, t.z, 0);
    vidro.juntar(m.vidro);
    opaco.juntar(m.opaco);
  }
  pontePar(vidro, opaco, lod === 0 ? nivel : 0);
  return { vidro, opaco, efeitos };
}

/** Volume de sombra do par: as duas torres e a ponte. */
export function malhaSombraPar() {
  const m = new Malha('opaco');
  for (const t of torresDoPar({ x: 0, z: 0, rot: 0 })) m.juntar(malhaSombraTorre({ spec: t.spec, gemea: true, base: PAR.podio }).transformar(t.x, 0, t.z, 0));
  const P = PAR.ponte;
  bloco(m, -PAR.vao / 2, P.cota - P.espessura - P.nivelFechado - 0.6, P.z0, PAR.vao / 2, P.cota, P.z1, K.cobertura);
  return m;
}

// ================================================================================================ three

/** BufferGeometry de uma Malha (posição, normal, aUvM, aC e índices). */
export function geometriaDe(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(m.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(m.n, 3));
  g.setAttribute('aUvM', new THREE.Float32BufferAttribute(m.uv, 2));
  g.setAttribute('aC', new THREE.Float32BufferAttribute(m.c, 4));
  g.setIndex(m.vertices > 65535 ? new THREE.Uint32BufferAttribute(m.i, 1) : new THREE.Uint16BufferAttribute(m.i, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Uniformes comuns dos materiais da Arcologia (um objeto só, como os dos ganchos). */
export const UNIFORMES = {
  uNoite: { value: 0 }, // 0 dia, 1 noite (pela altura do sol)
  uHora: { value: 12 }, // hora do céu (agenda das janelas)
  uTempo: { value: 0 }, // segundos (luz de obstáculo, a faixa de LED)
  // 1 nos setores (trechos de anel, torres ovais) cujas marquises estão em geometria (LOD0): o vidro não as pinta
  uLodSetor: { value: Array.from({ length: SETORES / 4 }, () => new THREE.Vector4()) },
};

/**
 * Luz artificial da Arcologia à noite, em unidades do céu. A exposição da R1a chega a 8 à noite (e a ~2,3 às 17h30):
 * uma janela de 0,2 vira ~1,6 na tela, quente e sem estourar no AgX; a lanterna e o aro do heliponto passam de 1 e
 * acendem o bloom.
 */
export const LUZ_NOITE = Object.freeze({ janela: 0.2, forro: 0.3, lanterna: 0.38, aro: 1.2, led: 0.34, exposicaoNoite: 8 });

const GLSL_COMUM = /* glsl */ `
uniform float uNoite;
uniform float uHora;
uniform float uTempo;
uniform float uCorte;
// corte da obra do par (X1b): centro do pódio e eixo das torres (x, z); o corte da Blade, o da Legacy e o do vão (y no
// mundo) e a meia largura do vão. Fora da obra o eixo é zero e os três cortes ficam no alto (não corta nada)
uniform vec4 uCorteEixo;
uniform vec4 uCorteH;
varying vec4 vC;
varying vec2 vUvM;
#define G_LUZ_JANELA ${LUZ_NOITE.janela.toFixed(3)}
#define G_LUZ_FORRO ${LUZ_NOITE.forro.toFixed(3)}
#define G_LUZ_LANTERNA ${LUZ_NOITE.lanterna.toFixed(3)}
#define G_LUZ_ARO ${LUZ_NOITE.aro.toFixed(3)}
#define G_LUZ_LED ${LUZ_NOITE.led.toFixed(3)}
float gCorte( vec3 p ) {
  float s = dot( p.xz - uCorteEixo.xy, uCorteEixo.zw );
  float lado = s < -uCorteH.w ? uCorteH.x : ( s > uCorteH.w ? uCorteH.y : uCorteH.z );
  return min( uCorte, lado );
}
float gH1( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
// ruído de valor interpolado: manchas macias (grama, folhagem), nunca a grade de quadrados do hash por célula
float gRuido( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  float a = gH1( i );
  float b = gH1( i + vec2( 1.0, 0.0 ) );
  float c = gH1( i + vec2( 0.0, 1.0 ) );
  float d = gH1( i + vec2( 1.0, 1.0 ) );
  return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
}
// o mesmo, filtrado: vira a média quando a célula cabe em poucos pixels (sem cintilar de longe)
float gRuidoF( vec2 p ) {
  float fw = max( fwidth( p.x ), fwidth( p.y ) );
  return mix( gRuido( p ), 0.5, smoothstep( 0.3, 0.8, fw ) );
}
// 1 perto da linha da grade (largura w em fração da célula), filtrado pela derivada: sem serrilhado de longe
float gLinha( float x, float w ) {
  float fw = max( fwidth( x ), 1e-4 );
  float d = abs( fract( x + 0.5 ) - 0.5 );
  float a = 1.0 - smoothstep( w * 0.5 - fw, w * 0.5 + fw, d );
  return mix( a, w, smoothstep( 0.25, 0.5, fw ) );
}
`;

const VERT_PARS = /* glsl */ `
attribute vec2 aUvM;
attribute vec4 aC;
varying vec4 vC;
varying vec2 vUvM;
`;

// medidas das aletas e dos montantes (e a cor do bronze champanhe) que o shader do LOD1 desenha no lugar da geometria
const AL_GLSL = (() => {
  const c = corLinear(BRONZE);
  const f = (v) => v.toFixed(3);
  return {
    esp: f(TL.aletas.espessura), fundo: f(TL.aletas.fundo), mEsp: f(TL.montantes.espessura), mFundo: f(TL.montantes.fundo),
    cor: `vec3( ${c.map(f).join(', ')} )`,
  };
})();

// fachada: tipo por vértice; saída em fAlb (difuso), fTint e fMet (reflexo), fRug, fEmi e fInc (inclinação do painel)
const FRAG_VIDRO = /* glsl */ `
vec3 fAlb; vec3 fTint; float fMet; float fRug; vec3 fEmi; vec2 fInc; vec3 fIncM;
float fCosV = 1.0; // |cos| entre a normal e a vista (o main escreve antes de gFachada)
uniform float uLinhas;
uniform vec4 uLodSetor[${SETORES / 4}];
// fração de janelas acesas pela hora (escritório: cheio de dia, cai depois das 18h; às 21h, uma em cinco)
float gAcesas( float h ) {
  float f = 0.82;
  if ( h >= 18.0 ) f = 0.82 - 0.72 * pow( clamp( ( h - 18.0 ) / 4.0, 0.0, 1.0 ), 0.6 );
  else if ( h < 6.5 ) f = mix( 0.12, 0.82, smoothstep( 5.0, 6.5, h ) );
  return f;
}
// 1 se as marquises do setor s estão em geometria (o LOD0 daquele trecho)
float gLodSetor( float s ) {
  int i = int( s + 0.5 );
  vec4 v = uLodSetor[ i / 4 ];
  int c = i - 4 * ( i / 4 );
  return c == 0 ? v.x : c == 1 ? v.y : c == 2 ? v.z : v.w;
}
// LOD1 das torres: aletas (faces laterais, vC.z = 1) e montantes a cada 1,5 m pintados por cima do vidro. De lado a
// aleta cobre o vidro entre ela e a vizinha, então a largura aparente cresce com a tangente do ângulo de vista
void gAletasLod1( float u ) {
  float tg = sqrt( max( 0.0, 1.0 - fCosV * fCosV ) ) / max( fCosV, 0.05 );
  float w = vC.z > 0.5 ? min( 0.95, ( ${AL_GLSL.esp} + ${AL_GLSL.fundo} * tg ) / 1.5 ) : min( 0.9, ( ${AL_GLSL.mEsp} + ${AL_GLSL.mFundo} * tg ) / 1.5 ) * uLinhas;
  float al = gLinha( u / 1.5, w );
  fTint = mix( fTint, ${AL_GLSL.cor} * mix( 1.0, 0.12, uNoite ), al );
  fMet = mix( fMet, 0.8, al );
  fRug = mix( fRug, 0.45, al );
  fAlb = mix( fAlb, vec3( 0.08, 0.07, 0.055 ) * mix( 1.0, 0.3, uNoite ), al );
  fEmi *= 1.0 - al;
}
void gVidroPainel( float col, float fl, float fv, float sem, float esp ) {
  // de longe (um pixel cobre mais de meio painel) a variação por painel vira a média: nem ruído, nem moiré
  float longe = smoothstep( 0.35, 1.1, fwidth( vUvM.x ) );
  float hp = mix( gH1( vec2( col, fl ) + sem * 17.0 ), 0.5, longe );
  esp = mix( esp, 0.2, longe );
  // vidro de controle solar prata-azulado: reflete o céu; o calor do fim de tarde vem do reflexo do sol
  fTint = vec3( 0.40, 0.43, 0.46 );
  fMet = 0.38 + 0.04 * hp;
  fRug = 0.05 + 0.025 * hp;
  fAlb = vec3( 0.012, 0.013, 0.015 );
  float pers = step( 0.84, hp ) * ( 0.2 + 0.5 * gH1( vec2( col * 1.7, fl * 2.3 ) ) ) * ( 1.0 - longe );
  float emPers = step( 0.8 - pers, fv ) * ( 1.0 - esp ) * ( 1.0 - longe );
  fAlb = mix( fAlb, vec3( 0.1, 0.095, 0.085 ), emPers * 0.6 );
  fTint = mix( fTint, vec3( 0.38, 0.40, 0.42 ), esp );
  fMet = mix( fMet, 0.32, esp );
  fRug = mix( fRug, 0.14, esp );
  fAlb = mix( fAlb, vec3( 0.045, 0.045, 0.045 ), esp );
  fInc = ( vec2( gH1( vec2( col, fl ) * 3.1 + 1.3 ), gH1( vec2( fl, col ) * 2.3 + 7.1 ) ) - 0.5 ) * 0.012 * ( 1.0 - longe );
  // noite: a unidade (6 painéis) está ocupada ou não; nas ocupadas, cada cômodo (2 painéis) acende pela agenda, com
  // força e tom próprios (um em dez com luz fria de tela), mais forte perto do forro. Lê janela a janela, nunca tijolo
  float ap = floor( col / 6.0 );
  float un = floor( col / 2.0 );
  float fr = gAcesas( uHora );
  float ocupado = step( gH1( vec2( ap, fl ) + sem * 31.0 ), 0.6 );
  float comodo = step( gH1( vec2( un * 1.7, fl * 0.3 ) + sem * 13.0 ), fr / 0.6 );
  float forca = gH1( vec2( un * 1.3, fl * 0.7 ) + 9.1 );
  float acesa = ocupado * comodo * step( 0.06, hp ) * ( forca < 0.25 ? 0.14 : 0.55 + 0.45 * forca );
  float muitoLonge = smoothstep( 2.2, 4.5, fwidth( vUvM.x ) );
  float hUn = gH1( vec2( fl, ap ) + 3.7 );
  float unid = step( gH1( vec2( ap * 1.3, fl * 0.7 ) + sem * 7.0 + 2.9 ), fr * 0.62 ) * ( 0.45 + 0.35 * hUn );
  acesa = mix( acesa, mix( unid, fr * 0.16, muitoLonge ), longe ) * ( 1.0 - esp );
  float hu = mix( hUn, 0.85, muitoLonge );
  vec3 corLuz = mix( vec3( 1.0, 0.4, 0.1 ), vec3( 1.0, 0.64, 0.32 ), hu );
  float fria = mix( gH1( vec2( un * 2.3, fl * 1.1 ) + 1.7 ), gH1( vec2( ap * 2.3, fl * 1.1 ) + 1.7 ), longe );
  corLuz = mix( corLuz, vec3( 0.72, 0.84, 1.0 ), step( 0.9, fria ) * ( 1.0 - muitoLonge ) );
  float teto = mix( 0.45 + 0.55 * smoothstep( 0.15, 0.78, fv ), 0.8, longe );
  fEmi = corLuz * acesa * uNoite * G_LUZ_JANELA * teto * ( 1.0 - emPers * 0.45 );
  fEmi += vec3( 0.5, 0.6, 0.8 ) * ocupado * ( 1.0 - acesa ) * 0.006 * gH1( vec2( un, fl ) * 1.9 + 4.3 ) * uNoite * G_LUZ_JANELA * ( 1.0 - longe ) * ( 1.0 - esp );
  fTint *= mix( vec3( 1.0 ), vec3( 0.5, 0.58, 0.75 ), uNoite );
}
// A faixa de LED dos anéis e das torres ovais (D88, D93): um terço dos andares no terço do meio da altura, contínua, entre
// duas marquises; nas ovais, na mesma faixa de altura da do Horizon Ring. De dia, uma faixa
// escura de vidro especial (grafite espelhado, os pixels de LED atrás dele numa grade de 0,6 m, as juntas a cada 3,2 m e
// o filete de inox nas bordas); à noite, a fachada de mídia viva: luz champanhe que corre o anel em ondas largas, um
// veio mais fino que sobe na diagonal, o tom frio que passa devagar, as bordas acesas que emolduram a faixa e um clarão
// que dá a volta (o que se lê de longe na vista aberta). Sem arco-íris: a luz da Holding é champanhe
void gLed( float u, float y, float meio, float pe, float n ) {
  float H = n * pe;
  float t = clamp( ( y - ( meio - 0.5 * H ) ) / H, 0.0, 1.0 );
  float longe = smoothstep( 0.2, 0.6, max( fwidth( u ), 1e-3 ) );
  float pontos = mix( gLinha( u / 0.6, 0.4 ) * gLinha( y / 0.6, 0.4 ), 0.16, longe );
  float borda = min( t, 1.0 - t );
  float filete = 1.0 - smoothstep( 0.0, 0.012 + fwidth( t ), borda );
  fTint = mix( vec3( 0.095, 0.1, 0.11 ), vec3( 0.5, 0.5, 0.49 ), filete );
  fMet = mix( 0.75, 0.9, filete );
  fRug = mix( 0.07, 0.25, filete );
  fAlb = vec3( 0.006, 0.006, 0.007 ) + vec3( 0.018, 0.017, 0.016 ) * pontos * ( 1.0 - filete );
  fInc = vec2( 0.0 );
  float junta = gLinha( u / 3.2, 0.012 );
  fTint = mix( fTint, vec3( 0.3 ), junta );
  float onda = 0.5 + 0.5 * sin( u / 55.0 - uTempo * 0.5 + 0.9 * sin( u / 270.0 + uTempo * 0.05 ) + t * 2.4 );
  float veio = 0.5 + 0.5 * sin( u / 21.0 + t * 1.6 - uTempo * 1.1 );
  float clarao = exp( -pow( ( mod( u - uTempo * 42.0, 1150.0 ) - 575.0 ) / 60.0, 2.0 ) );
  float fria = smoothstep( 0.55, 1.0, sin( u / 610.0 + uTempo * 0.08 ) );
  vec3 cor = mix( vec3( 1.0, 0.72, 0.42 ), vec3( 0.62, 0.84, 1.0 ), fria * 0.5 );
  float moldura = 1.0 - smoothstep( 0.0, 0.08, borda );
  // de 0,5 a 2,5 na tela à noite (champanhe com as ondas visíveis; mais que isso o AgX lavava a faixa de branco)
  float luz = ( 0.18 + 0.62 * onda * onda + 0.15 * veio ) * ( 0.7 + 0.3 * pontos ) + 0.45 * moldura + 0.8 * clarao;
  fEmi = cor * luz * mix( 0.004, G_LUZ_LED * 0.62, uNoite ) * ( 1.0 - filete * ( 1.0 - uNoite ) );
}
// Anéis (Apple Park, McLaren) e torres ovais: vidro curvo do chão ao teto em painéis largos (3,2 m nos anéis, 1,5 m nas
// ovais) com os montantes finos de alumínio. Cada painel é um pouco abaulado e torto: o reflexo do céu (o IBL) e do
// parque passa de painel em painel, e do alto uma parte deles pega o céu (o vidro lê vidro, não um cinza só). Logo
// abaixo de cada marquise, a sombra dela na fachada; no térreo, o saguão, as portas a cada 48 m com o batente de pedra e
// o rodapé escuro, com a oclusão no pé. À noite, os escritórios (Meridian, ovais) e a faculdade e a escola (Horizon,
// com os dormitórios de descanso) acesos pela agenda, em salas, com o forro aceso perto do teto (as linhas quentes da
// Apple Park à noite); o apagado fica escuro de verdade. No LOD1 (e nos setores sem a geometria) a marquise sai daqui:
// a testa branca fina, o topo deitado (com a luz de uma face horizontal) visto do alto e o forro visto de baixo
void gVidroAnel( float u, float y, float sem, float pe, float meio, float setorLed, float painel ) {
  float nLed = floor( setorLed / 32.0 + 0.001 );
  float setor = setorLed - 32.0 * nLed;
  if ( abs( y - meio ) < 0.5 * nLed * pe ) {
    gLed( u, y, meio, pe, nLed );
    return;
  }
  float yy = y / pe;
  float fl = floor( yy );
  float fv = fract( yy );
  float col = floor( u / painel );
  float fwu = max( fwidth( u ), 1e-3 );
  float fwy = max( fwidth( y ), 1e-3 );
  // de longe (um pixel cobre meio painel) a variação por painel vira a média: nem ruído, nem moiré
  float longe = smoothstep( 0.12, 0.45, fwu / painel );
  float hp = gH1( vec2( col, fl ) + sem * 17.0 );
  float hq = gH1( vec2( fl * 1.3, col * 0.7 ) + sem * 5.3 );
  // vidro extraclaro de controle solar: o reflexo (com o Fresnel do three) manda; o interior escuro por trás
  fTint = vec3( 0.27, 0.30, 0.33 ) * mix( 0.94 + 0.12 * hp, 1.0, longe );
  fMet = 0.45;
  fRug = mix( 0.03 + 0.03 * hq, 0.05, longe );
  fAlb = vec3( 0.014, 0.016, 0.018 ) * mix( 0.75 + 0.5 * hq, 1.0, longe );
  float perto = 1.0 - longe;
  // o reflexo anda em ondas largas (o vidro curvo de verdade distorce o reflexo devagar, de vários painéis de uma vez),
  // cada painel um pouco abaulado e torto: sem o mosaico de pontos que o giro painel a painel fazia
  float onda = gRuido( vec2( u / 47.0 + sem * 11.0, fl * 0.43 + sem * 3.0 ) ) - 0.5;
  fIncM.y += ( fv - 0.5 ) * 0.05 * perto + onda * 0.1;
  fInc = ( vec2( hq, gH1( vec2( col, fl ) * 2.3 + 7.1 ) ) - 0.5 ) * 0.01 * perto;
  // persianas: em parte dos painéis a persiana clara desce um pouco. Só de perto (o painel com mais de uns 10 pixels):
  // de meia distância um painel em cinco com a persiana clara virava um mosaico de pontos no anel inteiro
  float pers = step( 0.8, hq ) * ( 0.15 + 0.45 * gH1( vec2( col * 1.7, fl * 2.3 ) ) );
  float pertoPers = 1.0 - smoothstep( 0.04, 0.12, fwu / painel );
  fAlb = mix( fAlb, vec3( 0.12, 0.115, 0.105 ), step( 1.0 - pers, fv ) * 0.7 * pertoPers );
  // a sombra da marquise logo abaixo dela: o vidro reflete o forro à sombra e a sala escurece perto do teto
  float somb = smoothstep( 0.7, 0.96, fv );
  fTint *= 1.0 - 0.45 * somb;
  fAlb *= 1.0 - 0.6 * somb;
  // montantes de alumínio a cada painel (de longe viram a média, sem moiré)
  float mont = gLinha( u / painel, 0.09 / painel ) * 0.6;
  fTint = mix( fTint, vec3( 0.5, 0.5, 0.49 ), mont );
  fMet = mix( fMet, 0.7, mont );
  fRug = mix( fRug, 0.35, mont );
  fAlb = mix( fAlb, vec3( 0.2, 0.2, 0.19 ), mont );
  // noite: as salas (4 painéis no escritório, 3 na sala de aula) acesas pela agenda, em trechos de andar de dezenas de
  // metros (a equipe ou a turma que ficou acende junto; o sorteio sala a sala virava um chuvisco de pontos brancos de
  // longe); os dormitórios de descanso da faculdade, quentes e acesos até tarde
  float escola = step( setor, 7.5 );
  float fr = gAcesas( uHora );
  float sala = floor( col / mix( 4.0, 3.0, escola ) );
  float dorm = escola * step( 0.72, gH1( vec2( fl, floor( u / 300.0 ) ) + sem * 7.0 ) );
  float p = mix( fr, mix( fr * 0.85, 0.72, dorm ), escola );
  float trecho = gRuido( vec2( u / 120.0 + sem * 13.0 + fl * 3.17, fl * 1.9 ) );
  float limiar = 0.5 + ( 0.5 - p ) * 0.6;
  float zona = smoothstep( limiar - 0.03, limiar + 0.03, trecho );
  float hs = gH1( vec2( sala * 1.31, fl * 0.71 ) + sem * 29.0 );
  float muitoLonge = smoothstep( 0.6, 1.6, fwu / ( painel * 4.0 ) );
  float acesa = mix( step( hs, mix( 0.04, 0.88, zona ) ), mix( 0.04, 0.88, zona ), muitoLonge );
  acesa *= 0.7 + 0.3 * gH1( vec2( sala * 0.7, fl * 1.3 ) + 4.1 );
  vec3 corLuz = mix( vec3( 1.0, 0.8, 0.58 ), vec3( 0.92, 0.94, 1.0 ), step( 0.85, gH1( vec2( sala, fl ) * 1.7 + 2.0 ) ) * ( 1.0 - muitoLonge ) );
  corLuz = mix( corLuz, vec3( 1.0, 0.66, 0.38 ), dorm );
  float perfil = mix( 0.35 + 0.65 * smoothstep( 0.15, 0.95, fv ), 0.7, longe );
  fEmi = corLuz * acesa * perfil * uNoite * G_LUZ_JANELA * 0.8;
  // térreo: o saguão aceso (pedra quente) e, a cada 48 m, a porta: vão de 6,4 m com as folhas de vidro e o montante de
  // bronze, o batente de pedra clara em volta; o rodapé de metal escuro e a oclusão do chão no pé da fachada
  if ( fl < 0.5 ) {
    float d = abs( mod( u, 48.0 ) - 24.0 );
    float porta = step( d, 3.2 ) * step( y, 4.4 );
    float batente = ( 1.0 - porta ) * step( d, 3.8 ) * step( y, 5.0 );
    fAlb = mix( fAlb, vec3( 0.09, 0.075, 0.06 ), 0.8 * ( 1.0 - somb ) );
    fTint *= 0.85;
    float mPorta = max( gLinha( ( u - 24.0 ) / 1.6, 0.05 ), gLinha( ( y - 3.0 ) / 10.0, 0.012 ) ) * porta;
    fAlb = mix( fAlb, vec3( 0.03, 0.025, 0.02 ), porta * 0.6 );
    fTint = mix( fTint, vec3( 0.26, 0.17, 0.09 ), mPorta );
    fMet = mix( fMet, 1.0, mPorta );
    fTint = mix( fTint, vec3( 0.03 ), batente );
    fMet = mix( fMet, 0.0, batente );
    fRug = mix( fRug, 0.7, batente );
    fAlb = mix( fAlb, vec3( 0.42, 0.4, 0.36 ), batente );
    fEmi = vec3( 1.0, 0.78, 0.52 ) * ( 0.35 + 0.65 * smoothstep( 0.3, 0.9, fv ) ) * mix( 0.004, G_LUZ_JANELA * ( 0.8 + 0.6 * porta ), uNoite ) * ( 1.0 - batente );
    float rodape = 1.0 - smoothstep( 0.32, 0.32 + fwy, y );
    fTint = mix( fTint, vec3( 0.08 ), rodape );
    fAlb = mix( fAlb, vec3( 0.02 ), rodape );
    fMet = mix( fMet, 0.6, rodape );
    fRug = mix( fRug, 0.5, rodape );
  }
  float oclusao = 0.55 + 0.45 * smoothstep( 0.0, 2.5, y );
  fTint *= oclusao;
  fAlb *= oclusao;
  if ( uLinhas > 0.5 && gLodSetor( setor ) < 0.5 && y > 0.5 * pe ) {
    vec3 vd = normalize( cameraPosition - vGPosMundo );
    // o balanço: 2,4 m nos anéis, 1,2 m nas torres ovais (painel de 1,5 m)
    float tg = clamp( vd.y / max( 0.12, length( vd.xz ) ), -4.0, 4.0 ) * mix( 2.4, 1.2, step( painel, 2.0 ) );
    float dy = y - ( fl + step( 0.5, fv ) ) * pe; // distância à laje mais perto (negativa abaixo dela)
    float testa = 1.0 - smoothstep( 0.25 - fwy, 0.25 + fwy, abs( dy ) );
    float topo = ( 1.0 - testa ) * step( dy, 0.0 ) * ( 1.0 - smoothstep( 0.25 + max( tg, 0.0 ) - fwy, 0.25 + max( tg, 0.0 ) + fwy, -dy ) );
    float forro = ( 1.0 - testa ) * step( 0.0, dy ) * ( 1.0 - smoothstep( 0.25 + max( -tg, 0.0 ) - fwy, 0.25 + max( -tg, 0.0 ) + fwy, dy ) );
    float m = max( testa, max( topo, forro ) );
    // o topo e o forro com a luz de uma face deitada (o topo pega menos sol que a fachada no fim da tarde)
    fIncM = mix( fIncM, vec3( 0.0, 4.0 * ( topo - forro ), 0.0 ), max( topo, forro ) );
    fTint = mix( fTint, vec3( 0.03 ), m );
    fMet = mix( fMet, 0.0, m );
    fRug = mix( fRug, 0.6, m );
    vec3 branco = mix( vec3( 0.76, 0.75, 0.72 ), vec3( 0.4, 0.39, 0.37 ), topo ) * mix( 1.0, 0.82, forro );
    fAlb = mix( fAlb, branco * mix( 1.0, 0.18, uNoite ), m );
    fEmi = mix( fEmi, vec3( 1.0, 0.86, 0.66 ) * uNoite * ( 0.006 + 0.05 * acesa * forro ), m );
  }
}
void gFachada() {
  float tipo = floor( vC.x + 0.5 );
  float sem = vC.y;
  float u = vUvM.x;
  float y = vUvM.y;
  fEmi = vec3( 0.0 );
  fInc = vec2( 0.0 );
  fIncM = vec3( 0.0 );
  if ( tipo < 0.5 || tipo > 9.5 ) {
    // cortina das torres (e o LOD1, com as aletas pintadas nas faces laterais); o v conta da base do trecho
    float yy = y / 4.2;
    float fl = floor( yy );
    float fv = fract( yy );
    float col = floor( u / 1.5 );
    gVidroPainel( col, fl, fv, sem, step( 0.8, fv ) );
    if ( tipo > 9.5 ) gAletasLod1( u );
  } else if ( tipo < 1.5 ) {
    // costura: vidro mais escuro, painéis de 0,75; à noite a espinha acesa da face lisa, do pódio à coroa (as quinas,
    // vC.z = 1, com um terço da luz)
    float yy = y / 4.2;
    float col = floor( u / 0.75 );
    float fv = fract( yy );
    gVidroPainel( col, floor( yy ), fv, sem, step( 0.82, fv ) );
    fTint *= 0.72;
    fMet = min( 1.0, fMet + 0.12 );
    fEmi = vec3( 1.0, 0.78, 0.52 ) * uNoite * G_LUZ_JANELA * ( 0.75 + 0.25 * fv ) * mix( 1.0, 0.12, vC.z );
  } else if ( tipo < 2.5 ) {
    // andar de vento: vidro claro, forro claro iluminado, nunca mais escuro que o corpo
    float fv = clamp( y / 4.8, 0.0, 1.0 );
    fTint = vec3( 0.30 );
    fMet = 0.08;
    fRug = 0.05;
    fAlb = mix( vec3( 0.14, 0.13, 0.12 ), vec3( 0.34, 0.32, 0.28 ), smoothstep( 0.45, 0.95, fv ) );
    fEmi = vec3( 1.0, 0.82, 0.6 ) * ( 0.35 + 0.65 * smoothstep( 0.2, 1.0, fv ) ) * mix( 0.01, G_LUZ_FORRO, uNoite );
    float m = gLinha( u / 1.5, 0.06 );
    fAlb = mix( fAlb, vec3( 0.3, 0.24, 0.16 ), m );
    if ( uLinhas > 0.5 ) gAletasLod1( u );
  } else if ( tipo < 3.5 ) {
    // saguão: vidro claro, interior de pedra quente, montantes a cada 3 m
    float fv = clamp( y / 9.2, 0.0, 1.0 );
    fTint = vec3( 0.32, 0.30, 0.27 );
    fMet = 0.1;
    fRug = 0.05;
    fAlb = mix( vec3( 0.16, 0.14, 0.11 ), vec3( 0.34, 0.30, 0.24 ), fv );
    fEmi = vec3( 1.0, 0.7, 0.42 ) * ( 0.25 + 0.75 * fv ) * mix( 0.03, 0.14, uNoite );
    float m = max( gLinha( u / 3.0, 0.05 ), gLinha( ( y - 1.2 ) / 4.6, 0.03 ) );
    fTint = mix( fTint, vec3( 0.26, 0.17, 0.09 ), m );
    fMet = mix( fMet, 1.0, m );
    fAlb = mix( fAlb, vec3( 0.0 ), m );
    fEmi *= 1.0 - m;
  } else if ( tipo < 4.5 ) {
    // lanterna da coroa (vC.w = 1) e o globo do átrio da Codex (vC.w = 0): vidro champanhe, âmbar para branco à noite
    float t = clamp( y / 17.0, 0.0, 1.0 ) * vC.w;
    fTint = vec3( 0.5, 0.46, 0.39 );
    fMet = 0.34;
    fRug = 0.08;
    fAlb = vec3( 0.15, 0.13, 0.1 );
    fEmi = mix( vec3( 1.0, 0.52, 0.18 ), vec3( 1.0, 0.86, 0.62 ), t ) * mix( 0.012, G_LUZ_LANTERNA, uNoite ) * ( 0.65 + 0.35 * t );
    fEmi *= mix( 0.3, 1.0, vC.w );
    float m = gLinha( u / 0.75, 0.12 );
    fTint = mix( fTint, vec3( 0.26, 0.17, 0.09 ), m );
    fMet = mix( fMet, 1.0, m );
    fAlb = mix( fAlb, vec3( 0.0 ), m );
    fEmi *= 1.0 - 0.8 * m;
  } else if ( tipo < 5.5 ) {
    // parapeito de vidro
    fTint = vec3( 0.32, 0.34, 0.33 );
    fMet = 0.2;
    fRug = 0.03;
    fAlb = vec3( 0.05, 0.06, 0.06 );
  } else if ( tipo < 7.5 ) {
    // anéis (painéis de 3,2 m) e torres ovais (1,5 m); a semente volta exata ao meio do passo (semAnel)
    float semA = ( floor( fract( vC.y ) * ${SEM_ANEL}.0 ) + 0.5 ) / ${SEM_ANEL}.0;
    gVidroAnel( u, y, semA, vC.z, floor( vC.y ), vC.w, tipo > 6.5 ? 1.5 : 3.2 );
  } else if ( tipo < 8.5 ) {
    // Codex (o Black Diamond): vidro quase preto, espelho do céu nas facetas, andares de 4,5 m com o caixilho fino; à
    // noite, poucas salas de leitura acesas em luz quente
    float yy = y / 4.5;
    float fl = floor( yy );
    float fv = fract( yy );
    gVidroPainel( floor( u / 1.8 ), fl, fv, sem, step( 0.9, fv ) );
    fTint *= vec3( 0.42, 0.44, 0.48 );
    fMet = min( 1.0, fMet + 0.25 );
    fRug *= 0.7;
    fAlb *= 0.45;
    fEmi *= 0.5;
    float m = gLinha( yy, 0.04 );
    fTint = mix( fTint, vec3( 0.06 ), m );
    fAlb = mix( fAlb, vec3( 0.02 ), m );
  } else {
    // escada rolante: tubo de vidro claro com os degraus e o corrimão aceso vistos por dentro
    fTint = vec3( 0.42, 0.47, 0.49 );
    fMet = 0.3;
    fRug = 0.05;
    fAlb = mix( vec3( 0.08, 0.09, 0.09 ), vec3( 0.26, 0.26, 0.27 ), gLinha( u / 0.45, 0.25 ) * 0.6 );
    float corrimao = 1.0 - smoothstep( 0.0, 0.2, abs( y - 1.0 ) );
    fEmi = vec3( 1.0, 0.86, 0.62 ) * mix( 0.004, 0.1, uNoite ) * ( 0.25 + 0.75 * corrimao );
  }
}
`;

const FRAG_OPACO = /* glsl */ `
float oRug; float oMet; vec3 oEmi; float oPad; vec3 oCor; float oMalha;
void gOpaco() {
  oMalha = 0.0;
  float pk = floor( vC.w + 0.5 );
  oPad = mod( pk, 16.0 ); pk = floor( pk / 16.0 );
  float cls = mod( pk, 16.0 ); pk = floor( pk / 16.0 );
  oMet = mod( pk, 16.0 ) / 15.0; pk = floor( pk / 16.0 );
  oRug = mod( pk, 16.0 ) / 15.0;
  oCor = vC.rgb;
  vec2 p = vUvM;
  // padrões (pedra, piso, grama, água, pedra portuguesa, painel solar, folhagem, metal escovado)
  if ( oPad > 0.5 && oPad < 1.5 ) {
    float fila = floor( p.y / 0.75 );
    float bloco = floor( p.x / 1.5 + 0.5 * mod( fila, 2.0 ) );
    float j = max( gLinha( p.y / 0.75, 0.025 ), gLinha( p.x / 1.5 + 0.5 * mod( fila, 2.0 ), 0.012 ) );
    oCor *= ( 0.93 + 0.12 * gH1( vec2( bloco, fila ) ) ) * ( 1.0 - 0.18 * j );
  } else if ( oPad > 1.5 && oPad < 2.5 ) {
    float j = max( gLinha( p.x / 1.2, 0.03 ), gLinha( p.y / 1.2, 0.03 ) );
    oCor *= ( 0.92 + 0.14 * gH1( floor( p / 1.2 ) ) ) * ( 1.0 - 0.15 * j );
  } else if ( oPad > 2.5 && oPad < 3.5 ) {
    // gramado: manchas macias em três escalas (23, 6 e 1,7 m); o hash por célula dava quadrados de 6 m (maquete)
    float n = gRuidoF( p / 6.0 ) * 0.5 + gRuidoF( p / 1.7 + 3.1 ) * 0.3 + gRuidoF( p / 23.0 + 9.7 ) * 0.2;
    oCor *= 0.74 + 0.52 * n;
  } else if ( oPad > 3.5 && oPad < 4.5 ) {
    oCor *= 1.0;
  } else if ( oPad > 4.5 && oPad < 5.5 ) {
    // ondas da pedra portuguesa (Copacabana, Aterro do Flamengo): preto e branco em faixas onduladas na escala real
    // (faixas de 1,5 m que ondulam a cada 9 m; com faixas de 5 m e ondas de 29 m o calçadão lia, do alto, como um
    // ziguezague de maquete). De longe (a fase anda mais de meia onda por pixel) o desenho vira o cinza médio
    float fase = ( p.y + 1.4 * sin( p.x / 1.45 ) ) * 2.1;
    float o = sin( fase );
    float fw = fwidth( o ) + 1e-3;
    float b = mix( smoothstep( -fw, fw, o ), 0.5, smoothstep( 0.7, 1.8, fwidth( fase ) ) );
    oCor = mix( vec3( 0.07, 0.066, 0.06 ), vec3( 0.5, 0.47, 0.42 ), b );
  } else if ( oPad > 5.5 && oPad < 6.5 ) {
    float j = max( gLinha( p.x / 2.0, 0.05 ), gLinha( p.y / 1.0, 0.05 ) );
    oCor = mix( oCor, vec3( 0.2, 0.2, 0.21 ), j );
    oMet = mix( oMet, 0.8, j );
  } else if ( oPad > 6.5 && oPad < 7.5 ) {
    oCor *= 0.8 + 0.4 * gRuidoF( p * 1.3 );
  } else if ( oPad > 7.5 && oPad < 8.5 ) {
    oRug = clamp( oRug + ( gH1( floor( p * vec2( 0.5, 3.0 ) ) ) - 0.5 ) * 0.12, 0.05, 1.0 );
    // à noite (exposição de 8) o bronze claro pegava o luar como espelho e a torre inteira lia bege: o metal escurece,
    // e ficam as janelas, a costura, os andares de vento e a lanterna
    oCor *= mix( 1.0, 0.14, uNoite );
  } else if ( oPad > 8.5 && oPad < 9.5 ) {
    // pista de atletismo do teto do Horizon Ring: uv = (arco, distância à borda de dentro), raias de 1,22 m em branco
    // e a marca a cada 100 m
    float raia = gLinha( p.y / 1.22, 0.05 / 1.22 ) * step( 0.1, p.y ) * step( p.y, 7.25 );
    float marca = gLinha( p.x / 100.0, 0.1 / 100.0 );
    oCor *= 0.9 + 0.12 * gRuidoF( p * 0.7 );
    oCor = mix( oCor, vec3( 0.78, 0.77, 0.74 ), max( raia, marca * 0.8 ) );
  } else if ( oPad > 9.5 && oPad < 10.5 ) {
    // quadra (tênis, a medida oficial): uv em metros a partir do centro; as linhas brancas de 5 cm, o fundo em volta
    // mais escuro
    vec2 a = abs( p );
    float fw = max( fwidth( p.x ), 1e-3 );
    float l = 0.0;
    l = max( l, ( 1.0 - smoothstep( 0.05, 0.05 + fw, abs( a.x - 11.885 ) ) ) * step( a.y, 5.49 ) );
    l = max( l, ( 1.0 - smoothstep( 0.05, 0.05 + fw, abs( a.y - 5.485 ) ) ) * step( a.x, 11.89 ) );
    l = max( l, ( 1.0 - smoothstep( 0.05, 0.05 + fw, abs( a.y - 4.115 ) ) ) * step( a.x, 11.89 ) );
    l = max( l, ( 1.0 - smoothstep( 0.05, 0.05 + fw, abs( a.x - 6.4 ) ) ) * step( a.y, 4.12 ) );
    l = max( l, ( 1.0 - smoothstep( 0.05, 0.05 + fw, a.y ) ) * step( a.x, 6.4 ) );
    l = mix( l, 0.06, smoothstep( 0.3, 1.0, fw ) );
    float dentro = step( a.x, 11.9 ) * step( a.y, 5.5 );
    oCor *= mix( 0.72, 1.0, dentro );
    oCor = mix( oCor, vec3( 0.82, 0.82, 0.8 ), l );
  } else if ( oPad > 11.5 && oPad < 12.5 ) {
    // marquise de alumínio branco (a Apple Park): as juntas das chapas a cada 1,5 m; à noite a chapa só pega o luar e o
    // reflexo das salas (com a exposição da noite o branco pleno lia como um anel cinza)
    oCor *= ( 1.0 - 0.1 * gLinha( p.x / 1.5, 0.03 ) ) * mix( 1.0, 0.2, uNoite );
  } else if ( oPad > 12.5 && oPad < 13.5 ) {
    // copa das Supertrees (Gardens by the Bay): a malha de aço em funil, nervuras radiais (uv.x em nervuras), anéis a
    // cada 2,5 m da inclinação (uv.y) e as diagonais; parte das células com as jardineiras de bromélias e samambaias e o
    // resto aberto (o céu passa). De longe (a célula com menos de uns 3 pixels) a copa vira a média, sem furo cintilando
    vec2 fw = fwidth( p );
    float perto = 1.0 - smoothstep( 0.18, 0.4, max( fw.x, fw.y ) );
    float aco = max( max( gLinha( p.x, 0.11 ), gLinha( p.y, 0.1 ) ), max( gLinha( p.x + p.y * 0.5, 0.06 ), gLinha( p.x - p.y * 0.5, 0.06 ) ) );
    float hc = gH1( floor( p ) + 11.3 );
    float jardim = step( hc, 0.32 );
    vec3 folhas = mix( vec3( 0.07, 0.1, 0.045 ), vec3( 0.26, 0.07, 0.1 ), step( 0.85, gH1( floor( p * 2.0 ) + 3.1 ) ) ) * ( 0.8 + 0.4 * gRuidoF( p * 3.0 ) );
    if ( perto > 0.5 && aco < 0.3 && jardim < 0.5 ) discard;
    vec3 longe = mix( oCor * 0.85, folhas, 0.3 );
    oCor = mix( longe, mix( folhas, oCor, aco ), perto );
    oMalha = aco * perto + 0.3 * ( 1.0 - perto );
  } else if ( oPad > 13.5 && oPad < 14.5 ) {
    // tronco das Supertrees: o jardim vertical (samambaias, bromélias e orquídeas em manchas) atrás da treliça de aço em
    // losangos; uv = metros em volta e de altura
    float los = max( gLinha( ( p.x + 0.8 * p.y ) / 2.6, 0.1 ), gLinha( ( p.x - 0.8 * p.y ) / 2.6, 0.1 ) );
    float n = gRuidoF( p * 0.9 ) * 0.6 + gRuidoF( p * 2.7 + 5.0 ) * 0.4;
    vec3 folhas = mix( vec3( 0.06, 0.09, 0.04 ), vec3( 0.12, 0.15, 0.06 ), n );
    folhas = mix( folhas, vec3( 0.3, 0.08, 0.14 ), step( 0.78, gRuidoF( p * 1.7 + 9.0 ) ) * 0.8 );
    oCor = mix( folhas, vec3( 0.2, 0.12, 0.08 ), los );
    oMet = mix( 0.0, 0.4, los );
    oMalha = los;
  } else if ( oPad > 10.5 ) {
    // estantes do átrio da Codex: lombadas de 6 a 12 cm em tons de couro e papel, prateleira a cada 0,42 m; de longe,
    // a média quente
    float fila = floor( p.y / 0.42 );
    float col = floor( p.x / 0.09 + gH1( vec2( fila, 3.0 ) ) );
    float h = gH1( vec2( col, fila ) );
    vec3 lomb = mix( mix( vec3( 0.32, 0.12, 0.07 ), vec3( 0.55, 0.45, 0.3 ), h ), vec3( 0.12, 0.16, 0.2 ), step( 0.82, h ) );
    float prat = gLinha( p.y / 0.42, 0.08 );
    float longe = smoothstep( 0.04, 0.12, fwidth( p.x ) );
    vec3 c = mix( lomb * ( 0.8 + 0.4 * gH1( vec2( col * 1.3, fila ) ) ), vec3( 0.36, 0.25, 0.17 ), longe );
    oCor = mix( c, oCor, prat );
  }
  oEmi = vec3( 0.0 );
  if ( cls > 0.5 && cls < 1.5 ) oEmi = vec3( 1.0, 0.93, 0.8 ) * mix( 0.04, G_LUZ_ARO, uNoite );
  else if ( cls > 1.5 && cls < 2.5 ) oEmi = vec3( 1.0, 0.06, 0.03 ) * ( 0.4 + 2.5 * uNoite ) * step( 0.5, fract( uTempo * 0.66 ) );
  else if ( cls > 2.5 && cls < 3.5 ) oEmi = vec3( 1.0, 0.87, 0.68 ) * mix( 0.02, G_LUZ_FORRO, uNoite );
  else if ( cls > 3.5 && cls < 4.5 ) oEmi = vec3( 0.25, 0.62, 0.72 ) * uNoite * 0.2;
  else if ( cls > 4.5 && cls < 5.5 ) oEmi = vec3( 1.0, 0.74, 0.45 ) * uNoite * 0.2 * smoothstep( 0.0, 30.0, vUvM.y ); // v da coroa: 0 a 30 (coroaRelativa)
  else if ( cls > 5.5 && cls < 6.5 ) oEmi = vec3( 1.0, 0.76, 0.48 ) * uNoite * G_LUZ_JANELA * step( 0.45, gH1( floor( p / vec2( 1.5, 3.2 ) ) ) );
  else if ( cls > 6.5 && cls < 7.5 ) oEmi = vec3( 1.0, 0.88, 0.7 ) * mix( 0.01, 0.45, uNoite );
  // Supertrees à noite (o espetáculo de luz de Gardens by the Bay): a malha da copa e a treliça do tronco acesas em
  // violeta, magenta e branco quente que trocam devagar, cada árvore no seu tempo; nas barras (sem malha no padrão), os
  // pontos de luz a cada 2,5 m. Com 0,3 a copa inteira estourava em branco na exposição da noite (uma taça acesa).
  // A fase anda devagar pelo chão (a onda que passa pelo bosque): o sorteio por célula de 60 m cortava a copa que caía
  // na divisa em duas cores, numa linha reta
  else if ( cls > 7.5 && cls < 8.5 ) {
    float fase = dot( vGPosMundo.xz, vec2( 0.012, 0.009 ) );
    float ciclo = 0.5 + 0.5 * sin( uTempo * 0.35 + fase + vGPosMundo.y * 0.05 );
    vec3 show = mix( mix( vec3( 0.62, 0.3, 1.0 ), vec3( 1.0, 0.32, 0.7 ), ciclo ), vec3( 1.0, 0.78, 0.5 ), smoothstep( 0.7, 1.0, sin( uTempo * 0.13 + fase ) ) );
    float linha = oPad > 12.5 ? oMalha : max( gLinha( p.x / 2.5, 0.25 ), gLinha( p.y / 2.5, 0.25 ) );
    oEmi = show * uNoite * ( 0.008 + 0.07 * linha );
  }
  // o forro das marquises dos anéis à noite: a luz das salas que sai pelo vidro e bate nele (as linhas quentes da Apple
  // Park), mais forte em trechos
  else if ( cls > 11.5 && cls < 12.5 ) oEmi = vec3( 1.0, 0.78, 0.52 ) * uNoite * ( 0.004 + 0.016 * smoothstep( 0.35, 0.75, gRuidoF( vGPosMundo.xz / 70.0 ) ) );
  // reflexo: metal que recebe a luz da lanterna logo abaixo (a face de baixo do heliponto), um brilho morno e fraco
  else if ( cls > 8.5 && cls < 9.5 ) oEmi = vec3( 1.0, 0.72, 0.42 ) * uNoite * 0.014;
  // a linha de LED das quinas e da ponte: champanhe, que respira devagar subindo a torre (de dia, um traço claro)
  else if ( cls > 9.5 && cls < 10.5 ) oEmi = vec3( 1.0, 0.87, 0.68 ) * mix( 0.03, G_LUZ_LED * 2.6, uNoite ) * ( 0.8 + 0.2 * sin( vUvM.y / 38.0 - uTempo * 0.6 ) );
  // o átrio de livros aceso por dentro
  else if ( cls > 10.5 ) oEmi = vec3( 1.0, 0.8, 0.56 ) * mix( 0.004, 0.06, uNoite ) * oCor * 6.0;
}
`;

function ligarComum(shader, extras) {
  Object.assign(shader.uniforms, UNIFORMES, extras);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvC = aC;\nvUvM = aUvM;');
}


/**
 * Chave de programa dos materiais da Arcologia: fixa por material (nada de dia, noite, LOD ou fantasma na chave). O
 * que muda entre as variantes são uniformes (uLinhas, uCorte, uNoite): um programa só por material, compilado na carga.
 */
export const CHAVES = Object.freeze({
  vidro: 'arcologia-vidro-5', opaco: 'arcologia-opaco-5', cascata: 'arcologia-cascata-2', jato: 'arcologia-jato-2',
});

/**
 * Meia largura do vão no corte por lado (X1b): 1 m mais estreita que o vão de 28 m. As faces internas das torres ficam
 * exatamente a 14 m do centro; com o limite em 14 m o arredondamento as jogava no vão (cortado no pódio) e a face sumia
 * na obra. Os montantes e as chapas da Dream Bridge que entram até 1 m no vão sobem com a torre.
 */
export const MEIO_VAO_CORTE = PAR.vao / 2 - 1;

/** O volume da sombra da obra só troca de 2 em 2 m: cada troca pede um passe novo do mapa de sombra. */
const PASSO_SOMBRA_OBRA = 2;

/** Uniformes do corte por lado da obra do par (gCorte): sem obra, nada corta. */
export const extrasCorte = () => ({ uCorteEixo: { value: new THREE.Vector4(0, 0, 0, 0) }, uCorteH: { value: new THREE.Vector4(1e6, 1e6, 1e6, 0) } });

/**
 * Material de vidro da Arcologia: MeshStandardMaterial com a fachada no shader (tipo por vértice) e os ganchos
 * comuns. uLinhas desenha montantes e marquises onde não há geometria (LOD1).
 */
export function materialVidro(ganchos, { linhas = 0, corte = 1e6 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.4, envMapIntensity: 1.0 });
  const extras = { uLinhas: { value: linhas }, uCorte: { value: corte }, ...extrasCorte() };
  mat.userData.uniformes = extras;
  mat.onBeforeCompile = (shader) => {
    ligarComum(shader, extras);
    let fs = shader.fragmentShader.replace('#include <common>', `#include <common>\n${GLSL_COMUM}\n${FRAG_VIDRO}`);
    fs = fs.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif ( vGPosMundo.y > gCorte( vGPosMundo ) ) discard;');
    fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\nfCosV = abs( dot( normalize( vNormal ), normalize( vViewPosition ) ) );\ngFachada();\ndiffuseColor.rgb = fTint;');
    fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = fRug;');
    fs = fs.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = fMet;');
    fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize( normal + vec3( fInc, 0.0 ) + ( viewMatrix * vec4( fIncM, 0.0 ) ).xyz );');
    fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fEmi;');
    fs = fs.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.diffuseContribution = fAlb;');
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => CHAVES.vidro;
  mat.name = 'arcologia:vidro';
  return ganchos.aplicar(mat, GANCHOS_COMUNS);
}

/** Material opaco da Arcologia: cor, rugosidade, metal, luz e padrão por vértice. */
export function materialOpaco(ganchos, { corte = 1e6 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, envMapIntensity: 0.8 });
  const extras = { uCorte: { value: corte }, ...extrasCorte() };
  mat.userData.uniformes = extras;
  mat.onBeforeCompile = (shader) => {
    ligarComum(shader, extras);
    let fs = shader.fragmentShader.replace('#include <common>', `#include <common>\n${GLSL_COMUM}\n${FRAG_OPACO}`);
    fs = fs.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif ( vGPosMundo.y > gCorte( vGPosMundo ) ) discard;');
    fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\ngOpaco();\ndiffuseColor.rgb *= oCor;');
    fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = oRug;');
    fs = fs.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = oMet;');
    fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += oEmi;');
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => CHAVES.opaco;
  mat.name = 'arcologia:opaco';
  return ganchos.aplicar(mat, GANCHOS_COMUNS);
}

// água que cai, espirra e escorre (tudo no sombreador, sem simulação): modo em vC.x (CASCATA), fase em vC.y
const FRAG_CASCATA = /* glsl */ `
vec3 wAlb; float wAlfa; float wRug; vec3 wEmi;
float wQueda( float x, float y, float t ) {
  // a fase anda com a raiz da altura caída: os fios aceleram na queda, como a água de verdade
  float q = sqrt( max( y, 0.0 ) * 0.204 );
  return gRuidoF( vec2( x * 1.4, ( q - t ) * 3.2 ) ) * 0.6 + gRuidoF( vec2( x * 3.7 + 7.0, ( q - t ) * 7.5 ) ) * 0.4;
}
void gCascata() {
  float modo = floor( vC.x + 0.5 );
  float fase = vC.y;
  vec2 p = vUvM;
  float t = uTempo;
  wRug = 0.25;
  wEmi = vec3( 0.0 );
  if ( modo < 0.5 ) {
    // lâmina das Dream Falls (v: metros caídos desde a borda): verde-clara na borda, branca de ar embaixo, em cortinas
    // de fios que se juntam e se abrem na queda
    float fio = wQueda( p.x, p.y, t + fase * 3.0 );
    float cordas = gRuidoF( vec2( p.x * 1.5 + 0.35 * sin( p.y * 0.21 ), 3.1 + fase * 7.0 ) );
    float ar = smoothstep( 2.0, 30.0, p.y );
    float esp = smoothstep( 0.46 - 0.2 * ar, 0.78, fio );
    wAlb = mix( vec3( 0.3, 0.42, 0.42 ), vec3( 0.88, 0.9, 0.9 ), max( esp, 0.2 + ar * 0.65 ) );
    wAlfa = clamp( ( 0.42 + 0.55 * fio + 0.25 * ar ) * mix( 0.5, 1.0, smoothstep( 0.25, 0.6, cordas ) ), 0.0, 0.96 );
    // à noite, acesa por baixo (os refletores no espelho d'água): a espuma brilha, a água clara quase apaga
    wEmi = mix( vec3( 0.6, 0.78, 1.0 ), vec3( 1.0, 0.96, 0.9 ), esp ) * uNoite * ( 0.02 + 0.16 * esp ) * ( 0.4 + 0.6 * ar );
  } else if ( modo < 1.5 ) {
    // névoa onde a água bate: sobe, espalha e some com a altura
    float n = gRuidoF( vec2( p.x * 0.3 + t * 0.25, p.y * 0.22 - t * 0.55 + fase * 9.0 ) ) * 0.6 + gRuidoF( vec2( p.x * 0.8 - t * 0.4, p.y * 0.5 - t * 1.0 ) ) * 0.4;
    float alt = 1.0 - smoothstep( 1.0, 16.0, p.y );
    wAlb = vec3( 0.86, 0.88, 0.89 );
    wAlfa = smoothstep( 0.35, 0.85, n ) * alt * 0.5;
    wRug = 1.0;
    wEmi = vec3( 0.75, 0.88, 1.0 ) * uNoite * 0.05 * wAlfa;
  } else if ( modo < 2.5 ) {
    // espuma no lago, em volta de onde a lâmina bate (uv: ao longo da queda, distância a ela)
    float n = gRuidoF( p * 0.8 + vec2( t * 0.35, -t * 0.6 ) ) * 0.6 + gRuidoF( p * 2.2 - vec2( t * 0.8, t * 0.25 ) ) * 0.4;
    float perto = 1.0 - smoothstep( 0.5, 9.0, abs( p.y ) );
    wAlb = vec3( 0.84, 0.86, 0.86 );
    wAlfa = smoothstep( 0.3, 0.7, n ) * perto * 0.92;
    wRug = 0.5;
    wEmi = vec3( 0.7, 0.86, 1.0 ) * uNoite * 0.05 * wAlfa;
  } else {
    // faixa: a película que corre no alto do pódio até a borda (v cresce para a borda), lisa e rápida
    float fl = gRuidoF( vec2( p.x * 0.9, ( p.y - t * 2.2 ) * 1.6 ) ) * 0.6 + gRuidoF( vec2( p.x * 2.6 + 4.0, ( p.y - t * 3.1 ) * 3.0 ) ) * 0.4;
    wAlb = mix( vec3( 0.16, 0.26, 0.27 ), vec3( 0.74, 0.8, 0.8 ), smoothstep( 0.62, 0.92, fl ) );
    wAlfa = 0.55 + 0.35 * fl;
    wRug = 0.08;
    wEmi = vec3( 0.7, 0.86, 1.0 ) * uNoite * 0.03 * fl;
  }
}
`;

/** Material dos efeitos de água (as Dream Falls, a névoa, a espuma e a película do pódio): transparente, animado no shader. */
export function materialCascata(ganchos) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.9 });
  // os dois lados numa passada só: o three desenharia um transparente de dois lados em duas chamadas, trocando o lado
  // com needsUpdate a cada quadro (lâminas, névoa e espuma finas não pedem a ordem de trás para frente)
  mat.forceSinglePass = true;
  const extras = { uCorte: { value: 1e6 } };
  mat.userData.uniformes = extras;
  mat.onBeforeCompile = (shader) => {
    ligarComum(shader, extras);
    let fs = shader.fragmentShader.replace('#include <common>', `#include <common>\n${GLSL_COMUM}\n${FRAG_CASCATA}`);
    fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\ngCascata();\ndiffuseColor = vec4( wAlb, wAlfa );');
    fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = wRug;');
    fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += wEmi;');
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => CHAVES.cascata;
  mat.name = 'arcologia:cascata';
  return ganchos.aplicar(mat, ['neblina']);
}

/** Altura máxima de um jato das fontes (m) e o ciclo do espetáculo (s). */
export const FONTES = Object.freeze({ altura: 72, ciclo: 48 });

// fontes dançantes (Dubai Fountain): cada jato é uma instância da coluna unitária (dois planos cruzados de 1 m de
// altura); o vértice estica a coluna na altura do momento, abre o leque no alto e balança, tudo pela fração do jato
// ao longo do arco (aJato.x), o tipo (aJato.y: 0 os grandes, 1 os pequenos) e o tempo. Quatro atos de 12 s: a onda
// que corre o arco, o pulso de todos, pares e ímpares alternados e o leque do meio para as pontas
const JATO_VERT = /* glsl */ `
attribute vec2 aJato;
varying vec3 vJ;
float jAto( float a, float f, float t ) {
  if ( a < 0.5 ) return 0.5 + 0.5 * sin( 6.2832 * ( t / 4.0 - f * 2.5 ) );
  if ( a < 1.5 ) return pow( 0.5 + 0.5 * sin( 6.2832 * t / 2.4 ), 2.0 );
  if ( a < 2.5 ) return 0.5 + 0.5 * sin( 6.2832 * t / 3.0 + 3.1416 * mod( floor( f * 63.0 + 0.5 ), 2.0 ) );
  float c = fract( t / 6.0 );
  return smoothstep( 0.0, 0.2, c * 1.3 - abs( f - 0.5 ) ) * ( 1.0 - smoothstep( 0.65, 1.0, c ) );
}
float jAltura( float f, float tp, float t ) {
  float ciclo = mod( t, ${FONTES.ciclo.toFixed(1)} );
  float a = floor( ciclo / 12.0 );
  float s = fract( ciclo / 12.0 );
  float h = mix( jAto( a, f, t ), jAto( mod( a + 1.0, 4.0 ), f, t ), smoothstep( 0.82, 1.0, s ) );
  // o meio do arco sobe mais, e cada jato tem a sua força (nenhuma fileira de canos iguais)
  float teto = mix( 1.0, 0.4, tp ) * ( 0.55 + 0.45 * sin( 3.1416 * f ) ) * ( 0.62 + 0.38 * fract( sin( f * 91.7 + tp * 13.1 ) * 437.5 ) );
  return max( 0.015, h ) * teto * ${FONTES.altura.toFixed(1)};
}
`;

const JATO_FRAG = /* glsl */ `
varying vec3 vJ;
vec3 jAlb; float jAlfa; vec3 jEmi;
void gJato() {
  float v = vJ.y;
  // fios que sobem, o miolo mais denso e o leque do alto em névoa (a coluna nunca é um cano branco)
  float fio = gRuidoF( vec2( vJ.x * 7.0, v * vJ.z * 0.3 - uTempo * 5.0 ) ) * 0.65 + gRuidoF( vec2( vJ.x * 17.0 + 3.0, v * vJ.z * 0.9 - uTempo * 7.0 ) ) * 0.35;
  // o miolo denso e um halo de gotas em volta: de perto o jato tem corpo (só o miolo lia como um fio fino à noite)
  float r = abs( vJ.x ) * ( 1.0 + 0.8 * ( 1.0 - v ) );
  float miolo = 1.0 - smoothstep( 0.06, 0.42, r );
  float halo = 1.0 - smoothstep( 0.2, 0.5, r );
  float topo = 1.0 - smoothstep( 0.72, 1.0, v );
  float nevoa = mix( 1.0, 0.5, smoothstep( 0.55, 0.95, v ) );
  float corpo = max( smoothstep( 0.15, 0.75, fio ) * miolo, 0.28 * halo * fio );
  jAlfa = corpo * topo * nevoa * 0.85 * smoothstep( 0.0, 0.04, v ) * smoothstep( 1.0, 4.0, vJ.z );
  jAlb = mix( vec3( 0.62, 0.7, 0.72 ), vec3( 0.88, 0.9, 0.9 ), v );
  // à noite as fontes acesas de baixo: branco-azulado no pé, apagando para o alto, com o halo aceso também
  jEmi = vec3( 0.85, 0.92, 1.0 ) * uNoite * 0.2 * ( 1.0 - 0.65 * v ) * ( 0.4 + 0.6 * fio ) * ( 0.5 + 0.5 * miolo );
}
`;

/** Material dos jatos das fontes (instanciado, transparente, com a coreografia no sombreador de vértice). */
export function materialJato(ganchos) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.8 });
  mat.forceSinglePass = true; // os planos cruzados dos jatos numa chamada só (veja materialCascata)
  const extras = { uCorte: { value: 1e6 } };
  mat.userData.uniformes = extras;
  mat.onBeforeCompile = (shader) => {
    ligarComum(shader, extras);
    let vs = shader.vertexShader.replace('#include <common>', `#include <common>\nuniform float uTempo;\n${JATO_VERT}`);
    vs = vs.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
{
  float H = jAltura( aJato.x, aJato.y, uTempo );
  float v = position.y;
  float larg = 1.6 + 4.8 * pow( v, 2.0 ) * ( 0.25 + 0.75 * H / ${FONTES.altura.toFixed(1)} );
  transformed = vec3( position.x * larg, v * H, position.z * larg );
  // os jatos balançam e se inclinam em leque (os robôs da Dubai Fountain), para o lado de fora do arco
  float leque = ( aJato.x - 0.5 ) * 0.5 * ( 0.5 + 0.5 * sin( uTempo * 0.35 ) );
  transformed.x += ( sin( uTempo * 0.7 + aJato.x * 9.0 ) * 0.07 * v + leque ) * H * v;
  vJ = vec3( position.x + position.z, v, H );
}`,
    );
    shader.vertexShader = vs;
    let fs = shader.fragmentShader.replace('#include <common>', `#include <common>\n${GLSL_COMUM}\n${JATO_FRAG}`);
    fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\ngJato();\ndiffuseColor = vec4( jAlb, jAlfa );');
    fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += jEmi;');
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => CHAVES.jato;
  mat.name = 'arcologia:jato';
  return ganchos.aplicar(mat, ['neblina']);
}

/** Coluna unitária de um jato: dois planos cruzados de 1 m, em 8 fatias (a altura e a largura saem do vértice). */
export function malhaJato() {
  const m = new Malha('jato');
  const k = [0, 0, 0, 0];
  for (const [ax, az] of [[1, 0], [0, 1]]) {
    const base = m.vertices;
    const n = [az, 0, -ax];
    for (let j = 0; j <= 8; j++) {
      const v = j / 8;
      m.v(-0.5 * ax, v, -0.5 * az, ...n, -0.5, v, k);
      m.v(0.5 * ax, v, 0.5 * az, ...n, 0.5, v, k);
    }
    for (let j = 0; j < 8; j++) {
      const a = base + 2 * j;
      m.i.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  return m;
}

/**
 * Jatos das fontes num InstancedMesh: posições (pares x, z), a cota da água e a fração de cada um no arco. A caixa
 * limite vai à altura máxima (o vértice estica a coluna).
 */
export function criarJatos(ctx, jatos, y, material) {
  const g = geometriaDe(malhaJato());
  const n = jatos.length;
  const dados = new Float32Array(2 * n);
  jatos.forEach((j, i) => {
    dados[2 * i] = j.f;
    dados[2 * i + 1] = j.tipo;
  });
  g.setAttribute('aJato', new THREE.InstancedBufferAttribute(dados, 2));
  const o = new THREE.InstancedMesh(g, material, Math.max(1, n));
  const mtx = new THREE.Matrix4();
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  jatos.forEach((j, i) => {
    o.setMatrixAt(i, mtx.makeTranslation(j.x, y, j.z));
    x0 = Math.min(x0, j.x);
    x1 = Math.max(x1, j.x);
    z0 = Math.min(z0, j.z);
    z1 = Math.max(z1, j.z);
  });
  o.count = n;
  o.instanceMatrix.needsUpdate = true;
  // o three calcula a caixa das instâncias pela da coluna unitária: a coluna esticada passa dela
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-6, 0, -6), new THREE.Vector3(6, FONTES.altura + 2, 6));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, FONTES.altura / 2, 0), FONTES.altura);
  // a esfera do arco inteiro (com a altura e o leque dos jatos) no lugar da que o three calcularia pela coluna unitária:
  // com ela o arco sai do quadro quando a câmera olha para outro lado
  o.frustumCulled = n > 0;
  if (n) o.boundingSphere = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, y + FONTES.altura / 2, (z0 + z1) / 2), Math.hypot(x1 - x0, z1 - z0) / 2 + FONTES.altura);
  o.name = 'arcologia:fontes';
  o.renderOrder = 12;
  ctx.medidas?.familia(o, 'arcologia');
  return o;
}

/**
 * Materiais da Arcologia de um render: um conjunto FIXO, criado de uma vez na carga e compartilhado por tudo (a Torre,
 * as partes, os planos, o fantasma e as cenas). Nenhum material novo nasce em tempo de jogo e nada troca de programa:
 * o dia e a noite, o LOD e o corte da obra são uniformes (D66: o soluço de 166 ms era o 'arcologia:vidro' compilado
 * de novo, veja atualizarArcologia). As torres têm os seus (mesmo programa, o uCorte próprio).
 */
const materiaisPorCtx = new WeakMap();
export function materiais(ctx) {
  let m = materiaisPorCtx.get(ctx);
  if (!m) {
    const g = ctx.ganchos;
    m = {
      vidro: materialVidro(g),
      vidroLod1: materialVidro(g, { linhas: 1 }),
      opaco: materialOpaco(g),
      cascata: materialCascata(g),
      jato: materialJato(g),
      torreVidro: materialVidro(g),
      torreVidroLod1: materialVidro(g, { linhas: 1 }),
      torreOpaco: materialOpaco(g),
    };
    m.lista = new Set(Object.values(m));
    materiaisPorCtx.set(ctx, m);
  }
  return m;
}

/** Solta os materiais da Arcologia de um render (o domínio chama ao descartar). */
export function descartarMateriais(ctx) {
  const m = materiaisPorCtx.get(ctx);
  if (!m) return;
  for (const x of m.lista) x.dispose();
  m.lista.clear();
  materiaisPorCtx.delete(ctx);
}

/**
 * Aquecimento: um triângulo degenerado por material (o dos jatos num InstancedMesh, que é outro programa), desenhado
 * nos primeiros quadros depois que a luz do ambiente existe. Assim todo programa da Arcologia compila na carga, no
 * passe de verdade (o mesmo alvo HDR, a mesma luz), e nada compila quando a Torre fica pronta ou a câmera chega perto.
 * Depois fica escondido na cena (o compileAsync da carga também o acha).
 * @returns {{ grupo: THREE.Group, quadro(): boolean, feito: boolean, descartar(): void }}
 */
export function criarAquecimento(ctx, lista) {
  const grupo = new THREE.Group();
  grupo.name = 'arcologia:aquecer';
  const m = new Malha('aquecer');
  const k = [0, 0, 0, 0];
  m.v(0, -1000, 0, 0, 1, 0, 0, 0, k);
  m.v(0, -1000, 0, 0, 1, 0, 0, 0, k);
  m.v(0, -1000, 0, 0, 1, 0, 0, 0, k);
  m.i.push(0, 1, 2);
  const geo = geometriaDe(m);
  for (const mat of lista) {
    let o;
    if (mat.name === 'arcologia:jato') {
      const gj = geometriaDe(m);
      gj.setAttribute('aJato', new THREE.InstancedBufferAttribute(new Float32Array(2), 2));
      o = new THREE.InstancedMesh(gj, mat, 1);
    } else o = new THREE.Mesh(geo, mat);
    o.frustumCulled = false;
    o.name = `aquecer:${mat.name}`;
    grupo.add(o);
  }
  let quadros = 0;
  const api = {
    grupo,
    feito: false,
    /** Chame a cada quadro: liga o grupo por 2 quadros depois que a luz do ambiente existe. Devolve true se desenha. */
    quadro() {
      if (api.feito) return false;
      const pronto = !!ctx.cena?.environment;
      grupo.visible = pronto;
      if (pronto && ++quadros > 2) {
        grupo.visible = false;
        api.feito = true;
      }
      return grupo.visible;
    },
    descartar() {
      grupo.parent?.remove(grupo);
      for (const o of grupo.children) {
        if (o.geometry !== geo) o.geometry.dispose();
        if (o.isInstancedMesh) o.dispose();
      }
      geo.dispose();
    },
  };
  grupo.visible = false;
  return api;
}

// ------------------------------------------------------------------------------------------------ céu

const tmpDir = new THREE.Vector3();

/** Estado do céu pela hora: direção do sol, noite (0 a 1) e quão baixo o sol está. */
export function estadoDoCeu(ctx, alvo = {}) {
  const hora = ctx.horaDoCeu();
  const t = ctx.sim?.espelho?.tempo;
  const dir = direcaoDoSol(hora, t?.diaDoAno ?? 15, ctx.sim?.espelho?.mapa?.latitude ?? -23.5, alvo.dir ?? tmpDir.clone());
  const dia = THREE.MathUtils.smoothstep(dir.y, -0.1, 0.1);
  alvo.dir = dir;
  alvo.hora = hora;
  // a noite pelo fator de dia do render (ctx.sol.dia, da R1a) e na mesma conta das janelas da cidade (R4a): a
  // Arcologia acende junto com a cidade no anoitecer, não antes nem depois
  const diaRender = ctx.sol?.dia;
  alvo.noite = Number.isFinite(diaRender) ? Math.min(1, Math.max(0, 1 - 1.25 * diaRender)) : 1 - dia;
  alvo.baixo = 1 - THREE.MathUtils.smoothstep(dir.y, 0.02, 0.4);
  return alvo;
}

// ------------------------------------------------------------------------------------------------ as torres no render

/**
 * Distância (m) em que a Torre troca o LOD1 pelo LOD0, por perfil: o LOD0 tem aletas de 0,26 m e montantes de 0,14 m
 * em geometria, que só ficam firmes enquanto cobrem perto de meio pixel (além disso fazem moiré); de longe, o LOD1
 * desenha as mesmas linhas no shader, filtradas.
 */
export const DIST_LOD0 = Object.freeze({ leve: 380, media: 650, alta: 950, ultra: 1300, pc: 950 });

/** Distância além da qual os efeitos de água (cachoeira, fontes) somem: menores que um pixel. */
export const DIST_EFEITOS = 2600;

const malhaThree = (ctx, m, mat, familia = 'arcologia', nome = '') => {
  const o = new THREE.Mesh(geometriaDe(m), mat);
  o.name = nome;
  ctx.medidas?.familia(o, familia);
  return o;
};

const caixaDe = (...ms) => {
  const bs = ms.map((m) => m.caixa()).filter(Boolean);
  return [0, 1, 2].map((e) => Math.min(...bs.map((b) => b[e]))).concat([3, 4, 5].map((e) => Math.max(...bs.map((b) => b[e]))));
};

/**
 * Um modelo de torre no render (a Torre sozinha ou o par): LOD0, LOD1, o gêmeo de sombra e, no par, os efeitos de
 * água. Usa os materiais fixos das torres (materiais(ctx)): trocar de perfil refaz a geometria, nunca o programa.
 */
function criarModelo(ctx, { nome, m0, m1, ms, efeitos = null, yCentro, topo }) {
  const mats = materiais(ctx);
  const grupo = new THREE.Group();
  grupo.name = nome;
  const lod0 = new THREE.Group();
  const lod1 = new THREE.Group();
  lod0.add(malhaThree(ctx, m0.vidro, mats.torreVidro, 'arcologia', `${nome}:lod0:vidro`), malhaThree(ctx, m0.opaco, mats.torreOpaco, 'arcologia', `${nome}:lod0:opaco`));
  lod1.add(malhaThree(ctx, m1.vidro, mats.torreVidroLod1, 'arcologia', `${nome}:lod1:vidro`), malhaThree(ctx, m1.opaco, mats.torreOpaco, 'arcologia', `${nome}:lod1:opaco`));
  const fx = efeitos?.triangulos ? malhaThree(ctx, efeitos, mats.cascata, 'arcologia', `${nome}:efeitos`) : null;
  if (fx) fx.renderOrder = 11;
  const volSombra = new THREE.Mesh(geometriaDe(ms), mats.torreOpaco);
  volSombra.visible = false;
  volSombra.name = `${nome}:sombra`;
  grupo.add(lod0, lod1, volSombra);
  if (fx) grupo.add(fx);
  // o gêmeo da sombra projeta mesmo com a fonte escondida: quem esconde a Torre (fantasma, obra) solta o projetor
  let projetando = false;
  const projetar = (b) => {
    if (!ctx.sombra) return;
    if (b && !projetando) ctx.medidas?.familia(ctx.sombra.projetor(volSombra), 'sombra');
    else if (!b && projetando) ctx.sombra.soltar(volSombra);
    projetando = b;
  };
  projetar(true);
  let lod = 0;
  let corte = 1e6;
  const centro = new THREE.Vector3();
  const api = {
    grupo,
    get lod() {
      return lod;
    },
    triangulos: { lod0: m0.vidro.triangulos + m0.opaco.triangulos, lod1: m1.vidro.triangulos + m1.opaco.triangulos, sombra: ms.triangulos, efeitos: efeitos?.triangulos ?? 0 },
    caixa: caixaDe(m0.vidro, m0.opaco),
    posicionar(x, y, z, rot) {
      grupo.position.set(x, y, z);
      grupo.rotation.set(0, rot, 0);
      grupo.updateMatrixWorld(true);
      ctx.sombra?.marcar();
    },
    /** Força um LOD (0 ou 1) ou volta ao automático (null). */
    forcarLod: null,
    quadro() {
      centro.set(0, yCentro, 0).applyMatrix4(grupo.matrixWorld);
      const d = ctx.camera.position.distanceTo(centro);
      // histerese de 5%: a câmera parada perto do limite (o zoom com inércia, o tremor do toque) não pisca de LOD
      const limite = (DIST_LOD0[ctx.perfil?.id] ?? 1700) * (lod === 0 ? 1.05 : 0.95);
      lod = api.forcarLod ?? (d < limite ? 0 : 1);
      lod0.visible = lod === 0 && grupo.visible;
      lod1.visible = lod === 1 && grupo.visible;
      if (fx) fx.visible = grupo.visible && corte >= topo && d < DIST_EFEITOS;
    },
    /** Mostra a Torre pronta ou a esconde (antes da torre.e4 quem aparece é o fantasma, que não faz sombra). */
    mostrar(b) {
      grupo.visible = !!b;
      projetar(!!b);
      ctx.sombra?.marcar();
    },
    /**
     * Corte por altura (obra da X1b): esconde o que passa de h metros acima da plataforma. O volume da sombra encolhe
     * junto (achatado até h: a sombra da obra tem a altura dela). A água só corre com as torres prontas.
     */
    corte(h = 1e6) {
      corte = h;
      for (const m of [mats.torreVidro, mats.torreVidroLod1, mats.torreOpaco]) {
        m.userData.uniformes.uCorte.value = grupo.position.y + h;
        m.userData.uniformes.uCorteEixo.value.set(0, 0, 0, 0);
        m.userData.uniformes.uCorteH.value.set(1e6, 1e6, 1e6, 0);
      }
      volSombra.scale.y = Math.min(1, Math.max(1e-3, h / topo));
      volSombra.updateMatrixWorld(true);
      ctx.sombra?.marcar();
    },
    /**
     * Corte por lado da obra do par (X1b): a Blade (x local < -vão/2) até blade, a Legacy (x > vão/2) até legacy e o
     * vão (a Dream Bridge e o pódio entre as torres) até vao, em metros acima da plataforma. Sem argumentos, desfaz.
     * O volume da sombra encolhe até a mais alta.
     */
    cortePorLado(blade = 1e6, legacy = blade, vao = Math.min(blade, legacy)) {
      const y = grupo.position.y;
      const r = grupo.rotation.y;
      corte = Math.max(blade, legacy);
      for (const m of [mats.torreVidro, mats.torreVidroLod1, mats.torreOpaco]) {
        const u = m.userData.uniformes;
        u.uCorte.value = 1e6;
        u.uCorteEixo.value.set(grupo.position.x, grupo.position.z, Math.cos(r), -Math.sin(r));
        u.uCorteH.value.set(y + blade, y + legacy, y + vao, MEIO_VAO_CORTE);
      }
      // a obra sobe a cada quadro: a sombra acompanha aos saltos (o mapa não se refaz a cada quadro da obra)
      const s = Math.min(1, Math.max(1e-3, corte / topo));
      const atual = volSombra.scale.y;
      if (s !== atual && (Math.abs(s - atual) * topo >= PASSO_SOMBRA_OBRA || s === 1 || s < atual)) {
        volSombra.scale.y = s;
        volSombra.updateMatrixWorld(true);
        ctx.sombra?.marcar();
      }
    },
    descartar() {
      projetar(false);
      grupo.parent?.remove(grupo);
      grupo.traverse((o) => o.geometry?.dispose());
      // os materiais são do conjunto fixo (materiais(ctx)): ficam para a próxima montagem, sem compilar de novo
    },
  };
  return api;
}

/**
 * Uma torre sozinha num render (a cena da Torre, a bancada): LOD0 do perfil, LOD1 e o gêmeo de sombra. Posicione
 * com posicionar(x, y, z, rot) e chame quadro() a cada quadro (escolhe o LOD pela distância da câmera).
 */
export function criarTorre(ctx, { perfil = ctx.perfil, comEsplanada = true, spec = TORRE_LAMINA } = {}) {
  const nivel = NIVEL[perfil?.id] ?? 1;
  const M = medidasTorre(spec);
  return criarModelo(ctx, {
    nome: 'arcologia:torre',
    m0: malhasTorre({ nivel, comEsplanada, spec }),
    m1: malhasTorreLod1({ comEsplanada, spec }),
    ms: malhaSombraTorre({ spec }),
    yCentro: (spec.altura + M.PODIO) / 2,
    topo: M.topo,
  });
}

/**
 * O par da sede v3 num render (D89): a Blade e a Legacy no pódio com a Dream Bridge, na mesma API da Torre.
 * posicionar() recebe o centro do pódio (o meio do vão) e a rotação do par.
 */
export function criarPar(ctx, { perfil = ctx.perfil } = {}) {
  const nivel = NIVEL[perfil?.id] ?? 1;
  const m0 = malhasPar({ nivel, lod: 0 });
  const m1 = malhasPar({ lod: 1 });
  const api = criarModelo(ctx, {
    nome: 'arcologia:par',
    m0,
    m1,
    ms: malhaSombraPar(),
    efeitos: m0.efeitos,
    yCentro: TORRE_LAMINA.altura / 2,
    topo: medidasDoPar(TORRE_LAMINA).topo,
  });
  api.par = true;
  // o LOD0 de cada torre (o resultado da cena 'torre' confere os 70 mil): sob demanda, porque gerar as duas de novo
  // custa uns 90 ms de thread principal, e o jogo não lê isto na carga
  let porTorre = null;
  Object.defineProperty(api, 'triangulosPorTorre', {
    enumerable: true,
    get() {
      porTorre ??= torresDoPar({ x: 0, z: 0, rot: 0 }).map((t) => {
        const m = malhasTorre({ nivel, spec: t.spec, gemea: true, base: PAR.podio });
        return { nome: t.spec.nome, lod0: m.vidro.triangulos + m.opaco.triangulos };
      });
      return porTorre;
    },
  });
  return api;
}

/**
 * Atualiza os uniformes da Arcologia (noite, hora e tempo). Chame uma vez por quadro. Não mexe em material nenhum:
 * o 'arcologia:vidro' compilava duas vezes porque o reflexo de reserva punha um envMap próprio enquanto a luz do
 * ambiente (IBL) não existia e o tirava no quadro seguinte (needsUpdate: programa novo, 162 ms); o reflexo agora é
 * sempre o da cena (cena.environment) e o dia e a noite são só uniformes.
 */
export function atualizarArcologia(ctx, tMs, estado = estadoDoCeu(ctx)) {
  UNIFORMES.uNoite.value = estado.noite;
  UNIFORMES.uHora.value = estado.hora;
  // volta de 2 h: o float guarda a fase das animações sem saltos visíveis
  UNIFORMES.uTempo.value = (tMs / 1000) % 7200;
  return estado;
}

