// Malha do prédio a partir do plano (desenho do render 5.1 a 5.3, D39), puro: sem three e sem DOM (roda no worker
// `oficina` e no Node). Duas saídas do mesmo plano:
//   LOD0  as peças com relevo (paredes com a posição na fachada, platibanda, telhado com beiral, varandas, pilotis,
//         toldo, equipamentos do telhado) escritas num Construtor, no espaço do setor; o fundir.js junta e quantiza.
//   LOD1  as peças marcadas lod1 como instâncias de forma (caixa, chanfro, cilindro, duas águas) com a fachada inteira
//         no shader: a mesma silhueta, 10 a 34 triângulos por peça.
// Formato dos atributos (o shader fachada.glsl.js lê estes nomes; R5 e X1a podem escrever no mesmo formato):
//   aFac  Uint8 x 4  tipo (FACHADA), andar / 0,05 m, vão / 0,1 m, bits (uso 2 | variante 3 | térreo 3)
//   aCorA Uint8 x 4  rgb da cor 1 (sRGB), desgaste 0..255
//   aCorB Uint8 x 4  rgb da cor 2, vidro 0..255 (tom do vidro)
//   aFacUV (LOD0)    u em vãos, v em metros desde a base da peça, vTopo (acima: platibanda), largura da face
//   aAO (LOD0)       oclusão cozida da peça
//   aTopo (LOD1)     tipo do topo, rgb do topo
import { congelar } from '../../comum/util.js';

/** Tipos de superfície do shader (os números vão nos atributos; só se acrescenta no fim). */
export const FACHADA = congelar({
  LISO: 0, JANELA: 1, FITA: 2, CORTINA: 3, BRISE_H: 4, BRISE_V: 5, COBOGO: 6, VARANDA: 7, PASTILHA: 8, TIJOLO: 9,
  GALPAO: 10, PAINEL: 11, CASA: 12,
  // de TELHA em diante: materiais sem grade de janelas
  TELHA: 20, LAJE: 21, TELHA_METAL: 22, CONCRETO: 23, METAL: 24, VIDRO: 25, MADEIRA: 26, PEDRA: 27, TOLDO: 28,
  VERDE: 29, PISO: 30, AGUA: 31, LETREIRO: 32, SOLAR: 33, PORTA: 34, GARAGEM: 35, FIBRO: 36,
});

/** Térreo desenhado pelo shader na face da frente (bits 5 a 7 de aFac.w) e a altura fixa de cada um. */
export const TERREO = congelar({ NENHUM: 0, VITRINE: 1, PORTARIA: 2, GARAGEM: 3, PILOTIS: 4, DOCA: 5, VITRINE_ALTA: 6, PORTARIA_ALTA: 7 });
export const TERREO_ALTURA = congelar([0, 4.5, 4.2, 3.2, 3.8, 5.5, 5.5, 6.0]);

/** Uso (agenda das janelas acesas, bits 0 e 1). */
export const USO = congelar({ RES: 0, COM: 1, ESC: 2, IND: 3 });

/** Formas instanciadas do LOD1 (uma InstancedMesh por forma no mapa inteiro). */
export const FORMA = congelar({ CAIXA: 0, CHANFRO: 1, CILINDRO: 2, DUAS_AGUAS: 3 });
export const FORMAS = congelar(['caixa', 'chanfro', 'cilindro', 'duasAguas']);

/** Bits do canal G da tabela de prédios na GPU (RGBA 512²: R camada, G bits, B agenda, A livre). */
export const BITS_TABELA = congelar({ ABANDONADO: 1, SELECIONADO: 2, HOLDING: 4, OBRA: 8, APAGADO: 16 });

/** Floats por instância do LOD1 no registro de um setor: matriz (16) e id. Bytes: fac, corA, corB, topo (16). */
export const INST_F = 17;
export const INST_B = 16;

// ------------------------------------------------------------------------------------------------ cores e materiais

const cacheRgb = new Map();
/** '#rrggbb' para [r, g, b] (0..255), guardado. */
export function rgbDe(hex) {
  let c = cacheRgb.get(hex);
  if (!c) {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    cacheRgb.set(hex, c);
  }
  return c;
}

/**
 * Material de superfície do plano: { t, a (andar m), v (vão m), uso, vr (variante 0..7), tr (térreo 0..7),
 * c1, c2 ('#rrggbb'), dg (desgaste 0..1), vd (vidro 0..1) }. Empacota uma vez e guarda no próprio objeto.
 */
export function empacotar(m) {
  if (m._p) return m._p;
  const [r1, g1, b1] = rgbDe(m.c1 ?? '#b0aca4');
  const [r2, g2, b2] = rgbDe(m.c2 ?? m.c1 ?? '#8a8680');
  const a = Math.max(0, Math.min(255, Math.round((m.a ?? 3) / 0.05)));
  const v = Math.max(0, Math.min(255, Math.round((m.v ?? 3) / 0.1)));
  const bits = ((m.uso ?? 0) & 3) | (((m.vr ?? 0) & 7) << 2) | (((m.tr ?? 0) & 7) << 5);
  const dg = Math.max(0, Math.min(255, Math.round((m.dg ?? 0.4) * 255)));
  const vd = Math.max(0, Math.min(255, Math.round((m.vd ?? 0) * 255)));
  m._p = [m.t ?? 0, a, v, bits, r1, g1, b1, dg, r2, g2, b2, vd];
  return m._p;
}

/** Vãos inteiros numa face: o shader usa a mesma conta no LOD1. */
export const vaosDaFace = (largura, vao) => Math.max(1, Math.floor(largura / Math.max(0.5, Math.round(vao / 0.1) * 0.1) + 0.5));

// ------------------------------------------------------------------------------------------------ normal octaédrica

/** Normal (x, y, z) unitária para 2 x Int8 (octaedro com o eixo y no polo; o shader faz o inverso em gOct). */
export function octaedro(x, y, z, out, o) {
  // eixo do octaedro: (x, z, y)
  const a = x;
  const b = z;
  const c = y;
  const s = Math.abs(a) + Math.abs(b) + Math.abs(c) || 1;
  let px = a / s;
  let py = b / s;
  if (c < 0) {
    const qx = (1 - Math.abs(py)) * (px >= 0 ? 1 : -1);
    const qy = (1 - Math.abs(px)) * (py >= 0 ? 1 : -1);
    px = qx;
    py = qy;
  }
  out[o] = Math.round(Math.max(-1, Math.min(1, px)) * 127);
  out[o + 1] = Math.round(Math.max(-1, Math.min(1, py)) * 127);
}

/** O inverso (para os testes): 2 x Int8 para a normal unitária. */
export function deOctaedro(ex, ey) {
  const x = Math.max(-1, ex / 127);
  const y = Math.max(-1, ey / 127);
  let vx = x;
  let vy = y;
  const vz = 1 - Math.abs(x) - Math.abs(y);
  if (vz < 0) {
    vx = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
    vy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
  }
  const l = Math.hypot(vx, vy, vz) || 1;
  return [vx / l, vz / l, vy / l];
}

// ------------------------------------------------------------------------------------------------ construtor

/**
 * Acumula a malha LOD0 de vários prédios no espaço do setor (Float32 aqui; o fundir.js quantiza). Cada prédio entra
 * com o seu transformado (giro em torno de y e a origem do lote no setor) e o seu idx.
 */
export class Construtor {
  constructor(capVert = 8192) {
    this._cap = 0;
    this.nv = 0;
    this.ni = 0;
    this.pos = new Float32Array(0);
    this.nor = new Float32Array(0);
    this.fuv = new Float32Array(0);
    this.mat = new Uint8Array(0);
    this.ao = new Float32Array(0);
    this.id = new Uint32Array(0);
    this.idx = new Uint32Array(Math.max(64, capVert * 1.5) | 0);
    this._crescer(capVert);
    // transformado do prédio atual
    this.c = 1;
    this.s = 0;
    this.ox = 0;
    this.oy = 0;
    this.oz = 0;
    this.pid = 0;
    this.tris = 0;
  }

  _crescer(min) {
    if (min <= this._cap) return;
    const cap = Math.max(min, this._cap * 2 || 1024);
    const f = (Tipo, velho, k) => {
      const n = new Tipo(cap * k);
      n.set(velho.subarray(0, this.nv * k));
      return n;
    };
    this.pos = f(Float32Array, this.pos, 3);
    this.nor = f(Float32Array, this.nor, 3);
    this.fuv = f(Float32Array, this.fuv, 4);
    this.mat = f(Uint8Array, this.mat, 12);
    this.ao = f(Float32Array, this.ao, 1);
    this.id = f(Uint32Array, this.id, 1);
    this._cap = cap;
  }

  _crescerIdx(min) {
    if (min <= this.idx.length) return;
    const n = new Uint32Array(Math.max(min, this.idx.length * 2));
    n.set(this.idx.subarray(0, this.ni));
    this.idx = n;
  }

  /** Começa um prédio: origem do lote no setor, rotação (convenção do three) e idx. */
  predio(ox, oy, oz, rot, id) {
    this.c = Math.cos(rot);
    this.s = Math.sin(rot);
    this.ox = ox;
    this.oy = oy;
    this.oz = oz;
    this.pid = id >>> 0;
  }

  /** Um vértice no espaço do lote; devolve o índice. */
  v(x, y, z, nx, ny, nz, u, vv, vt, larg, m, ao) {
    if (this.nv >= this._cap) this._crescer(this.nv + 1);
    const i = this.nv++;
    const c = this.c;
    const s = this.s;
    this.pos[3 * i] = this.ox + x * c + z * s;
    this.pos[3 * i + 1] = this.oy + y;
    this.pos[3 * i + 2] = this.oz - x * s + z * c;
    this.nor[3 * i] = nx * c + nz * s;
    this.nor[3 * i + 1] = ny;
    this.nor[3 * i + 2] = -nx * s + nz * c;
    this.fuv[4 * i] = u;
    this.fuv[4 * i + 1] = vv;
    this.fuv[4 * i + 2] = vt;
    this.fuv[4 * i + 3] = larg;
    this.mat.set(m, 12 * i);
    this.ao[i] = ao;
    this.id[i] = this.pid;
    return i;
  }

  /** Triângulo; a ordem é acertada para ficar anti-horária vista do lado da normal do vértice a. */
  tri(a, b, c) {
    if (this.ni + 3 > this.idx.length) this._crescerIdx(this.ni + 3);
    const p = this.pos;
    const ux = p[3 * b] - p[3 * a];
    const uy = p[3 * b + 1] - p[3 * a + 1];
    const uz = p[3 * b + 2] - p[3 * a + 2];
    const vx = p[3 * c] - p[3 * a];
    const vy = p[3 * c + 1] - p[3 * a + 1];
    const vz = p[3 * c + 2] - p[3 * a + 2];
    const n = this.nor;
    const d = (uy * vz - uz * vy) * n[3 * a] + (uz * vx - ux * vz) * n[3 * a + 1] + (ux * vy - uy * vx) * n[3 * a + 2];
    this.idx[this.ni++] = a;
    if (d >= 0) {
      this.idx[this.ni++] = b;
      this.idx[this.ni++] = c;
    } else {
      this.idx[this.ni++] = c;
      this.idx[this.ni++] = b;
    }
    this.tris++;
  }

  /**
   * Quadrilátero a, b, c, d (anti-horário visto de fora) com a normal n; uv = [u0, v0, u1, v1] (a..b ao longo de u,
   * b..c ao longo de v).
   */
  quad(a, b, c, d, n, uv, vt, larg, m, ao) {
    const i0 = this.v(a[0], a[1], a[2], n[0], n[1], n[2], uv[0], uv[1], vt, larg, m, ao);
    const i1 = this.v(b[0], b[1], b[2], n[0], n[1], n[2], uv[2], uv[1], vt, larg, m, ao);
    const i2 = this.v(c[0], c[1], c[2], n[0], n[1], n[2], uv[2], uv[3], vt, larg, m, ao);
    const i3 = this.v(d[0], d[1], d[2], n[0], n[1], n[2], uv[0], uv[3], vt, larg, m, ao);
    this.tri(i0, i1, i2);
    this.tri(i0, i2, i3);
  }
}

// ------------------------------------------------------------------------------------------------ peças do LOD0

const SEM_TOPO = 1e4;
const N_PX = [1, 0, 0];
const N_NX = [-1, 0, 0];
const N_PZ = [0, 0, 1];
const N_NZ = [0, 0, -1];
const N_PY = [0, 1, 0];
const N_NY = [0, -1, 0];

/** Ponto do espaço da peça (giro em torno de y, centro px, pz) para o espaço do lote. */
function pp(P, x, y, z) {
  const c = P._c;
  const s = P._s;
  return [P.x + x * c + z * s, y, P.z - x * s + z * c];
}
function pn(P, n) {
  const c = P._c;
  const s = P._s;
  return [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c];
}

/** Parede vertical de (xa, za) a (xb, zb) no espaço da peça, com a normal para fora (à direita de a->b vista de cima). */
function parede(K, P, xa, za, xb, zb, y0, y1, m, vt, ao, u0 = 0, vBase = 0) {
  const dx = xb - xa;
  const dz = zb - za;
  const L = Math.hypot(dx, dz);
  if (L < 1e-4 || y1 - y0 < 1e-4) return;
  // normal para fora: (-dz, 0, dx)/L (a -> b vai da esquerda para a direita de quem olha a face de fora)
  const n = pn(P, [-dz / L, 0, dx / L]);
  const nv = vaosDaFace(P._largFace ?? L, (m.v ?? 3));
  const u1 = u0 + (L / (P._largFace ?? L)) * nv;
  K.quad(pp(P, xa, y0, za), pp(P, xb, y0, zb), pp(P, xb, y1, zb), pp(P, xa, y1, za), n, [u0, y0 - vBase, u1, y1 - vBase], vt, L, empacotar(m), ao);
}

/** Retângulo horizontal (topo, com a normal para cima; ou fundo, para baixo) no espaço da peça. */
function plano(K, P, x0, z0, x1, z1, y, m, ao, baixo = false) {
  const n = pn(P, baixo ? N_NY : N_PY);
  const pk = empacotar(m);
  if (!baixo) K.quad(pp(P, x0, y, z1), pp(P, x1, y, z1), pp(P, x1, y, z0), pp(P, x0, y, z0), n, [x0, z1, x1, z0], SEM_TOPO, x1 - x0, pk, ao);
  else K.quad(pp(P, x0, y, z0), pp(P, x1, y, z0), pp(P, x1, y, z1), pp(P, x0, y, z1), n, [x0, z0, x1, z1], SEM_TOPO, x1 - x0, pk, ao);
}

/** Caixa: 4 paredes (com a fachada), topo (com platibanda se houver) e fundo opcional. */
function caixa(K, P) {
  const hw = P.w / 2;
  const hd = P.d / 2;
  const y0 = P.y0;
  const y1 = P.y0 + P.h;
  const ao = P.ao ?? 1;
  const f = P.faces ?? {};
  const sem = P.sem ?? 0; // bits: 1 +x, 2 -x, 4 +z, 8 -z, 16 topo
  const par = P.parapeito ?? 0;
  const vt = par > 0 ? P.h - par : SEM_TOPO;
  const vb = P.vBase ?? 0;
  // frente (+z), direita (+x), fundo (-z), esquerda (-x): paredes no sentido anti-horário visto de fora
  if (!(sem & 4)) parede(K, P, -hw, hd, hw, hd, y0, y1, f.pz ?? P.mat, vt, ao, 0, y0 - vb);
  if (!(sem & 1)) parede(K, P, hw, hd, hw, -hd, y0, y1, f.px ?? P.lado ?? P.mat, vt, ao, 0, y0 - vb);
  if (!(sem & 8)) parede(K, P, hw, -hd, -hw, -hd, y0, y1, f.nz ?? P.fundo ?? P.mat, vt, ao, 0, y0 - vb);
  if (!(sem & 2)) parede(K, P, -hw, -hd, -hw, hd, y0, y1, f.nx ?? P.lado ?? P.mat, vt, ao, 0, y0 - vb);
  if (P.base) plano(K, P, -hw, -hd, hw, hd, y0, P.base, P.aoBase ?? 0.55, true);
  if (sem & 16 || !P.topo) return;
  if (par > 0) {
    // platibanda: laje rebaixada, faces de dentro e o capeamento
    const e = Math.min(0.2, hw * 0.2, hd * 0.2);
    const yl = y1 - par;
    plano(K, P, -hw + e, -hd + e, hw - e, hd - e, yl, P.topo, 0.95);
    const mi = P.matPlatibanda ?? P.mat;
    const liso = mi._liso ?? (mi._liso = { ...mi, t: FACHADA.LISO, tr: 0, _p: null });
    parede(K, P, hw - e, hd - e, -hw + e, hd - e, yl, y1, liso, SEM_TOPO, 0.8);
    parede(K, P, -hw + e, hd - e, -hw + e, -hd + e, yl, y1, liso, SEM_TOPO, 0.8);
    parede(K, P, -hw + e, -hd + e, hw - e, -hd + e, yl, y1, liso, SEM_TOPO, 0.8);
    parede(K, P, hw - e, -hd + e, hw - e, hd - e, yl, y1, liso, SEM_TOPO, 0.8);
    const cap = P.capa ?? CAPA;
    plano(K, P, -hw, hd - e, hw, hd, y1, cap, 1);
    plano(K, P, -hw, -hd, hw, -hd + e, y1, cap, 1);
    plano(K, P, -hw, -hd + e, -hw + e, hd - e, y1, cap, 1);
    plano(K, P, hw - e, -hd + e, hw, hd - e, y1, cap, 1);
  } else {
    plano(K, P, -hw, -hd, hw, hd, y1, P.topo, P.aoTopo ?? 1);
  }
}
const CAPA = { t: FACHADA.CONCRETO, c1: '#bdb8ae', dg: 0.5 };

/** Telhado de duas águas com beiral: cumeeira ao longo de x da peça; w e d já incluem o beiral. */
function duasAguas(K, P) {
  const hw = P.w / 2;
  const hd = P.d / 2;
  const y0 = P.y0;
  const y1 = P.y0 + P.h;
  const b = P.beiral ?? 0.5;
  const esp = 0.12;
  const tl = P.topo;
  const L = Math.hypot(hd, P.h);
  const ny = hd / L;
  const nz = P.h / L;
  const pkT = empacotar(tl);
  // águas (u ao longo da cumeeira, v ao longo da água, do beiral para a cumeeira)
  K.quad(pp(P, -hw, y0, hd), pp(P, hw, y0, hd), pp(P, hw, y1, 0), pp(P, -hw, y1, 0), pn(P, [0, ny, nz]), [0, 0, P.w, L], SEM_TOPO, P.w, pkT, 1);
  K.quad(pp(P, hw, y0, -hd), pp(P, -hw, y0, -hd), pp(P, -hw, y1, 0), pp(P, hw, y1, 0), pn(P, [0, ny, -nz]), [0, 0, P.w, L], SEM_TOPO, P.w, pkT, 1);
  // forro do beiral (por baixo, na sombra) e a testeira
  const forro = P.forro ?? FORRO;
  const pkF = empacotar(forro);
  const ye = y0 - esp;
  K.quad(pp(P, hw, ye, hd), pp(P, -hw, ye, hd), pp(P, -hw, y1 - esp, 0), pp(P, hw, y1 - esp, 0), pn(P, [0, -ny, -nz]), [0, 0, P.w, L], SEM_TOPO, P.w, pkF, 0.5);
  K.quad(pp(P, -hw, ye, -hd), pp(P, hw, ye, -hd), pp(P, hw, y1 - esp, 0), pp(P, -hw, y1 - esp, 0), pn(P, [0, -ny, nz]), [0, 0, P.w, L], SEM_TOPO, P.w, pkF, 0.5);
  const test = empacotar(P.testeira ?? forro);
  K.quad(pp(P, -hw, ye, hd), pp(P, hw, ye, hd), pp(P, hw, y0, hd), pp(P, -hw, y0, hd), pn(P, N_PZ), [0, 0, P.w, esp], SEM_TOPO, P.w, test, 0.9);
  K.quad(pp(P, hw, ye, -hd), pp(P, -hw, ye, -hd), pp(P, -hw, y0, -hd), pp(P, hw, y0, -hd), pn(P, N_NZ), [0, 0, P.w, esp], SEM_TOPO, P.w, test, 0.9);
  // oitões: triângulos na linha da parede (recuados do beiral), com a cor e a fachada lisa da parede
  const xo = hw - (P.beiralOitao ?? b);
  const zw = hd - b;
  const yw = y0 + P.h * (b / hd);
  const mo = P.mat;
  const liso = mo._liso ?? (mo._liso = { ...mo, t: FACHADA.LISO, tr: 0, _p: null });
  const pk = empacotar(liso);
  for (const lado of [1, -1]) {
    const x = xo * lado;
    const n = pn(P, lado > 0 ? N_PX : N_NX);
    const a = K.v(...pp(P, x, yw, zw * lado), ...n, 0, yw - y0, SEM_TOPO, 2 * zw, pk, 0.85);
    const bb = K.v(...pp(P, x, yw, -zw * lado), ...n, 1, yw - y0, SEM_TOPO, 2 * zw, pk, 0.85);
    const c = K.v(...pp(P, x, y1 - esp, 0), ...n, 0.5, y1 - esp - y0, SEM_TOPO, 2 * zw, pk, 0.85);
    K.tri(a, bb, c);
    // guarda-pó: a espessura das duas águas na ponta do beiral
    const xb = hw * lado;
    const nn = pn(P, lado > 0 ? N_PX : N_NX);
    K.quad(pp(P, xb, ye, hd), pp(P, xb, y0, hd), pp(P, xb, y1, 0), pp(P, xb, y1 - esp, 0), nn, [0, 0, 1, 1], SEM_TOPO, 1, test, 0.9);
    K.quad(pp(P, xb, ye, -hd), pp(P, xb, y0, -hd), pp(P, xb, y1, 0), pp(P, xb, y1 - esp, 0), nn, [0, 0, 1, 1], SEM_TOPO, 1, test, 0.9);
  }
}
const FORRO = { t: FACHADA.MADEIRA, c1: '#8a6d52', v: 2, dg: 0.3 };

const FORRO_FIBRO = { t: FACHADA.CONCRETO, c1: '#7d7b76', v: 2, dg: 0.5 };

/**
 * Meia-água (fibrocimento das casas de autoconstrução, galpão de fundo): uma água só, do beiral da frente (+z, em y0)
 * ao dos fundos (-z, em y0 + h), com os oitões triangulares e o pano dos fundos na cor da parede. No LOD1 vira a forma
 * de duas águas da mesma caixa.
 */
function meiaAgua(K, P) {
  const hw = P.w / 2;
  const hd = P.d / 2;
  const y0 = P.y0;
  const y1 = P.y0 + P.h;
  const esp = 0.1;
  const L = Math.hypot(P.d, P.h);
  const ny = P.d / L;
  const nz = P.h / L;
  const pkT = empacotar(P.topo);
  K.quad(pp(P, -hw, y0, hd), pp(P, hw, y0, hd), pp(P, hw, y1, -hd), pp(P, -hw, y1, -hd), pn(P, [0, ny, nz]), [0, 0, P.w, L], SEM_TOPO, P.w, pkT, 1);
  const forro = P.forro ?? FORRO_FIBRO;
  const pkF = empacotar(forro);
  K.quad(pp(P, hw, y0 - esp, hd), pp(P, -hw, y0 - esp, hd), pp(P, -hw, y1 - esp, -hd), pp(P, hw, y1 - esp, -hd), pn(P, [0, -ny, -nz]), [0, 0, P.w, L], SEM_TOPO, P.w, pkF, 0.5);
  parede(K, P, -hw, hd, hw, hd, y0 - esp, y0, forro, SEM_TOPO, 0.9);
  parede(K, P, hw, -hd, -hw, -hd, y1 - esp, y1, forro, SEM_TOPO, 0.9);
  for (const lado of [1, -1]) {
    const nn = pn(P, lado > 0 ? N_PX : N_NX);
    K.quad(pp(P, lado * hw, y0 - esp, hd), pp(P, lado * hw, y0, hd), pp(P, lado * hw, y1, -hd), pp(P, lado * hw, y1 - esp, -hd), nn, [0, 0, 1, 1], SEM_TOPO, 1, pkF, 0.9);
  }
  // oitões e o pano dos fundos acima da parede (a caixa de baixo para no topo da parede da frente)
  const b = P.beiral ?? 0.4;
  const bo = P.beiralOitao ?? b;
  const k = P.h / P.d;
  const zF = hd - b;
  const zB = -hd + b;
  const yF = y0 + b * k;
  const yB = y0 + (P.d - b) * k;
  const mo = P.mat;
  const liso = mo._liso ?? (mo._liso = { ...mo, t: FACHADA.LISO, tr: 0, _p: null });
  const pk = empacotar(liso);
  for (const lado of [1, -1]) {
    const x = (hw - bo) * lado;
    const n = pn(P, lado > 0 ? N_PX : N_NX);
    const a = K.v(...pp(P, x, yF, zF), ...n, 0, yF - y0, SEM_TOPO, zF - zB, pk, 0.85);
    const bb = K.v(...pp(P, x, yF, zB), ...n, 1, yF - y0, SEM_TOPO, zF - zB, pk, 0.85);
    const c = K.v(...pp(P, x, yB, zB), ...n, 1, yB - y0, SEM_TOPO, zF - zB, pk, 0.85);
    K.tri(a, bb, c);
  }
  parede(K, P, hw - bo, zB, -hw + bo, zB, yF, yB, liso, SEM_TOPO, 0.85);
}

/**
 * Telhado de quatro águas com beiral (a casa brasileira mais comum): cumeeira ao longo de x da peça (w >= d), águas
 * inclinadas iguais nas quatro faces; w e d já incluem o beiral. No LOD1 vira a forma de duas águas da mesma caixa.
 */
function quatroAguas(K, P) {
  const hw = P.w / 2;
  const hd = P.d / 2;
  const y0 = P.y0;
  const y1 = P.y0 + P.h;
  const r = Math.max(0, hw - hd); // meia cumeeira
  const esp = 0.12;
  const L = Math.hypot(hd, P.h);
  const ny = hd / L;
  const nz = P.h / L;
  const pkT = empacotar(P.topo);
  // águas longas (trapézios) e as pontas (triângulos): u ao longo do beiral, v subindo a água
  K.quad(pp(P, -hw, y0, hd), pp(P, hw, y0, hd), pp(P, r, y1, 0), pp(P, -r, y1, 0), pn(P, [0, ny, nz]), [0, 0, P.w, L], SEM_TOPO, P.w, pkT, 1);
  K.quad(pp(P, hw, y0, -hd), pp(P, -hw, y0, -hd), pp(P, -r, y1, 0), pp(P, r, y1, 0), pn(P, [0, ny, -nz]), [0, 0, P.w, L], SEM_TOPO, P.w, pkT, 1);
  for (const lado of [1, -1]) {
    const n = pn(P, [lado * nz, ny, 0]);
    const a = K.v(...pp(P, lado * hw, y0, lado * hd), ...n, 0, 0, SEM_TOPO, P.d, pkT, 1);
    const b = K.v(...pp(P, lado * hw, y0, -lado * hd), ...n, P.d, 0, SEM_TOPO, P.d, pkT, 1);
    const c = K.v(...pp(P, lado * r, y1, 0), ...n, P.d / 2, L, SEM_TOPO, P.d, pkT, 1);
    K.tri(a, b, c);
  }
  // forro do beiral (por baixo) e a testeira em volta
  const forro = P.forro ?? FORRO;
  plano(K, P, -hw, -hd, hw, hd, y0 - esp, forro, 0.5, true);
  const test = P.testeira ?? forro;
  parede(K, P, -hw, hd, hw, hd, y0 - esp, y0, test, SEM_TOPO, 0.9);
  parede(K, P, hw, -hd, -hw, -hd, y0 - esp, y0, test, SEM_TOPO, 0.9);
  parede(K, P, hw, hd, hw, -hd, y0 - esp, y0, test, SEM_TOPO, 0.9);
  parede(K, P, -hw, -hd, -hw, hd, y0 - esp, y0, test, SEM_TOPO, 0.9);
}

/** Prisma de n lados inscrito na caixa (w, d), com topo plano; chanfro = 8 lados com cantos cortados. */
function prisma(K, P, n, chanfro = 0) {
  const pts = [];
  const hw = P.w / 2;
  const hd = P.d / 2;
  if (chanfro > 0) {
    const c = chanfro;
    pts.push([hw, hd - c], [hw, -hd + c], [hw - c, -hd], [-hw + c, -hd], [-hw, -hd + c], [-hw, hd - c], [-hw + c, hd], [hw - c, hd]);
  } else {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      pts.push([hw * Math.cos(a), -hd * Math.sin(a)]);
    }
  }
  const m = pts.length;
  let per = 0;
  for (let k = 0; k < m; k++) per += Math.hypot(pts[(k + 1) % m][0] - pts[k][0], pts[(k + 1) % m][1] - pts[k][1]);
  const nv = vaosDaFace(per, P.mat.v ?? 3);
  const y0 = P.y0;
  const y1 = P.y0 + P.h;
  const par = P.parapeito ?? 0;
  const vt = par > 0 ? P.h - par : SEM_TOPO;
  const pk = empacotar(P.mat);
  let acum = 0;
  const ao = P.ao ?? 1;
  for (let k = 0; k < m; k++) {
    const [xa, za] = pts[k];
    const [xb, zb] = pts[(k + 1) % m];
    const L = Math.hypot(xb - xa, zb - za);
    const u0 = (acum / per) * nv;
    acum += L;
    const u1 = (acum / per) * nv;
    const nrm = pn(P, [-(zb - za) / L, 0, (xb - xa) / L]);
    // faces redondas: a normal de cada vértice aponta do centro (sombreado liso no cilindro)
    if (!chanfro) {
      const na = pn(P, [xa / hw, 0, za / hd]);
      const nb = pn(P, [xb / hw, 0, zb / hd]);
      const la = Math.hypot(na[0], na[2]);
      const lb = Math.hypot(nb[0], nb[2]);
      const i0 = K.v(...pp(P, xa, y0, za), na[0] / la, 0, na[2] / la, u0, 0, vt, per, pk, ao);
      const i1 = K.v(...pp(P, xb, y0, zb), nb[0] / lb, 0, nb[2] / lb, u1, 0, vt, per, pk, ao);
      const i2 = K.v(...pp(P, xb, y1, zb), nb[0] / lb, 0, nb[2] / lb, u1, P.h, vt, per, pk, ao);
      const i3 = K.v(...pp(P, xa, y1, za), na[0] / la, 0, na[2] / la, u0, P.h, vt, per, pk, ao);
      K.tri(i0, i1, i2);
      K.tri(i0, i2, i3);
    } else {
      K.quad(pp(P, xa, y0, za), pp(P, xb, y0, zb), pp(P, xb, y1, zb), pp(P, xa, y1, za), nrm, [u0, 0, u1, P.h], vt, per, pk, ao);
    }
  }
  if (P.topo) {
    const pt = empacotar(P.topo);
    const nt = pn(P, N_PY);
    const c = K.v(...pp(P, 0, y1, 0), ...nt, 0, 0, SEM_TOPO, 1, pt, 1);
    const ids = pts.map(([x, z]) => K.v(...pp(P, x, y1, z), ...nt, x, z, SEM_TOPO, 1, pt, 1));
    for (let k = 0; k < m; k++) K.tri(c, ids[k], ids[(k + 1) % m]);
  }
}

/** Varanda: laje em balanço (d para fora da parede, na direção +z da peça) e guarda-corpo de vidro ou cheio. */
function varanda(K, P) {
  const hw = P.w / 2;
  const hd = P.d / 2;
  const y0 = P.y0;
  const esp = P.esp ?? 0.16;
  const gc = P.gc ?? 1.1;
  const lajeM = P.mat;
  // laje: topo, fundo, testa e as pontas
  plano(K, P, -hw, -hd, hw, hd, y0 + esp, lajeM, 0.9);
  plano(K, P, -hw, -hd, hw, hd, y0, lajeM, 0.55, true);
  parede(K, P, -hw, hd, hw, hd, y0, y0 + esp, lajeM, SEM_TOPO, 0.95);
  parede(K, P, hw, hd, hw, -hd, y0, y0 + esp, lajeM, SEM_TOPO, 0.95);
  parede(K, P, -hw, -hd, -hw, hd, y0, y0 + esp, lajeM, SEM_TOPO, 0.95);
  if (!gc) return;
  // guarda-corpo: por fora e por dentro (visto de cima e da calçada)
  const g = P.guarda;
  const y1 = y0 + esp;
  const y2 = y1 + gc;
  const e = 0.04;
  parede(K, P, -hw, hd, hw, hd, y1, y2, g, SEM_TOPO, 1);
  parede(K, P, hw - e, hd - e, -hw + e, hd - e, y1, y2, g, SEM_TOPO, 0.8);
  if (!P.semPontas) {
    parede(K, P, hw, hd, hw, -hd, y1, y2, g, SEM_TOPO, 1);
    parede(K, P, -hw, -hd, -hw, hd, y1, y2, g, SEM_TOPO, 1);
    parede(K, P, -hw + e, hd - e, -hw + e, -hd, y1, y2, g, SEM_TOPO, 0.8);
    parede(K, P, hw - e, -hd, hw - e, hd - e, y1, y2, g, SEM_TOPO, 0.8);
  }
}

/** Placa vertical (dos dois lados): letreiro, portão, guarda-corpo solto, painel. Plano x-y da peça, virada para +z. */
function placa(K, P) {
  const hw = P.w / 2;
  const y0 = P.y0;
  const y1 = P.y0 + P.h;
  const hd = (P.d ?? 0) / 2;
  parede(K, P, -hw, hd, hw, hd, y0, y1, P.mat, SEM_TOPO, P.ao ?? 1);
  if (!P.umLado) parede(K, P, hw, -hd, -hw, -hd, y0, y1, P.verso ?? P.mat, SEM_TOPO, P.ao ?? 1);
}

/** Plano inclinado com espessura (toldo, marquise inclinada, painel solar): cai de y0 + h (junto à parede, -z) a y0. */
function inclinado(K, P) {
  const hw = P.w / 2;
  const hd = P.d / 2;
  const ya = P.y0 + P.h;
  const yb = P.y0;
  const esp = P.esp ?? 0.08;
  const L = Math.hypot(P.d, P.h);
  const ny = P.d / L;
  const nz = P.h / L;
  const m = empacotar(P.mat);
  const mb = empacotar(P.baixo ?? P.mat);
  K.quad(pp(P, -hw, yb, hd), pp(P, hw, yb, hd), pp(P, hw, ya, -hd), pp(P, -hw, ya, -hd), pn(P, [0, ny, nz]), [0, 0, P.w, L], SEM_TOPO, P.w, m, 1);
  K.quad(pp(P, hw, yb - esp, hd), pp(P, -hw, yb - esp, hd), pp(P, -hw, ya - esp, -hd), pp(P, hw, ya - esp, -hd), pn(P, [0, -ny, -nz]), [0, 0, P.w, L], SEM_TOPO, P.w, mb, 0.6);
  K.quad(pp(P, -hw, yb - esp, hd), pp(P, hw, yb - esp, hd), pp(P, hw, yb, hd), pp(P, -hw, yb, hd), pn(P, N_PZ), [0, 0, P.w, esp], SEM_TOPO, P.w, m, 0.9);
  if (P.pontas) {
    parede(K, P, hw, hd, hw, -hd, yb - esp, ya, P.mat, SEM_TOPO, 0.9);
    parede(K, P, -hw, -hd, -hw, hd, yb - esp, ya, P.mat, SEM_TOPO, 0.9);
  }
}

/** Shed (telhado em dente de serra): n dentes ao longo de z, a face de vidro voltada para +z. */
function shed(K, P) {
  const n = Math.max(1, P.dentes ?? 3);
  const hw = P.w / 2;
  const passo = P.d / n;
  const y0 = P.y0;
  const y1 = P.y0 + P.h;
  const vidro = P.vidro;
  for (let k = 0; k < n; k++) {
    const za = -P.d / 2 + k * passo;
    const zb = za + passo;
    const L = Math.hypot(passo, P.h);
    // água metálica subindo de za (baixo) até zb (alto)
    K.quad(pp(P, hw, y0, za), pp(P, -hw, y0, za), pp(P, -hw, y1, zb), pp(P, hw, y1, zb), pn(P, [0, passo / L, -P.h / L]), [0, 0, P.w, L], SEM_TOPO, P.w, empacotar(P.topo), 1);
    // pano de vidro vertical em zb
    parede(K, P, -hw, zb, hw, zb, y0, y1, vidro, SEM_TOPO, 1);
    // oitões dos dentes
    for (const lado of [1, -1]) {
      const x = hw * lado;
      const nn = pn(P, lado > 0 ? N_PX : N_NX);
      const mk = empacotar(P.mat);
      const a = K.v(...pp(P, x, y0, lado > 0 ? zb : za), ...nn, 0, 0, SEM_TOPO, passo, mk, 0.9);
      const b = K.v(...pp(P, x, y0, lado > 0 ? za : zb), ...nn, 1, 0, SEM_TOPO, passo, mk, 0.9);
      const c = K.v(...pp(P, x, y1, zb), ...nn, lado > 0 ? 0 : 1, P.h, SEM_TOPO, passo, mk, 0.9);
      K.tri(a, b, c);
    }
  }
}

/** Abóbada (telhado em arco) ao longo de x: s segmentos, com os tímpanos nas pontas. */
function arco(K, P) {
  const s = P.segmentos ?? 6;
  const hw = P.w / 2;
  const hd = P.d / 2;
  const pk = empacotar(P.topo);
  const pt = [];
  for (let k = 0; k <= s; k++) {
    const a = Math.PI * (k / s);
    pt.push([hd * Math.cos(a), P.y0 + P.h * Math.sin(a)]);
  }
  for (let k = 0; k < s; k++) {
    const [za, ya] = pt[k];
    const [zb, yb] = pt[k + 1];
    const L = Math.hypot(zb - za, yb - ya);
    const nz = (yb - ya) / L;
    const ny = -(zb - za) / L;
    K.quad(pp(P, hw, ya, za), pp(P, -hw, ya, za), pp(P, -hw, yb, zb), pp(P, hw, yb, zb), pn(P, [0, ny, nz]), [0, (k / s) * 10, P.w, ((k + 1) / s) * 10], SEM_TOPO, P.w, pk, 1);
  }
  const mt = empacotar(P.mat);
  for (const lado of [1, -1]) {
    const x = hw * lado;
    const nn = pn(P, lado > 0 ? N_PX : N_NX);
    const c = K.v(...pp(P, x, P.y0, 0), ...nn, 0.5, 0, SEM_TOPO, P.d, mt, 0.9);
    const ids = pt.map(([z, y]) => K.v(...pp(P, x, y, z), ...nn, 0.5 + (lado * z) / P.d, y - P.y0, SEM_TOPO, P.d, mt, 0.9));
    for (let k = 0; k < s; k++) (lado > 0 ? K.tri(c, ids[k], ids[k + 1]) : K.tri(c, ids[k + 1], ids[k]));
  }
}

/** Cone (topo de silo). */
function cone(K, P) {
  const n = 12;
  const hw = P.w / 2;
  const hd = P.d / 2;
  const pk = empacotar(P.mat);
  const apice = K.v(...pp(P, 0, P.y0 + P.h, 0), ...pn(P, N_PY), 0, P.h, SEM_TOPO, 1, pk, 1);
  const ids = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const x = hw * Math.cos(a);
    const z = -hd * Math.sin(a);
    const L = Math.hypot(hw, P.h);
    const nn = pn(P, [(Math.cos(a) * P.h) / L, hw / L, (-Math.sin(a) * P.h) / L]);
    ids.push(K.v(...pp(P, x, P.y0, z), ...nn, k, 0, SEM_TOPO, 1, pk, 1));
  }
  for (let k = 0; k < n; k++) K.tri(ids[k], ids[(k + 1) % n], apice);
}

/** Coluna (pilotis): prisma de 4 ou 8 lados, sem topo. */
function coluna(K, P) {
  const n = P.redonda ? 8 : 4;
  const r = P.w / 2;
  const pk = empacotar(P.mat);
  const y0 = P.y0;
  const y1 = P.y0 + P.h;
  for (let k = 0; k < n; k++) {
    const a0 = ((k + (n === 4 ? 0.5 : 0)) / n) * Math.PI * 2;
    const a1 = ((k + 1 + (n === 4 ? 0.5 : 0)) / n) * Math.PI * 2;
    const f = n === 4 ? Math.SQRT2 : 1;
    const xa = r * f * Math.cos(a0);
    const za = -r * f * Math.sin(a0);
    const xb = r * f * Math.cos(a1);
    const zb = -r * f * Math.sin(a1);
    const am = (a0 + a1) / 2;
    K.quad(pp(P, xa, y0, za), pp(P, xb, y0, zb), pp(P, xb, y1, zb), pp(P, xa, y1, za), pn(P, [Math.cos(am), 0, -Math.sin(am)]), [0, 0, 1, P.h], SEM_TOPO, 1, pk, P.ao ?? 0.9);
  }
}

/** Piso do lote (um plano na cota y0): quintal cimentado, estacionamento, deck, piscina. */
function piso(K, P) {
  plano(K, P, -P.w / 2, -P.d / 2, P.w / 2, P.d / 2, P.y0, P.mat, P.ao ?? 1);
}

const EMISSORES = {
  piso, caixa, duasAguas, quatroAguas, meiaAgua, chanfro: (K, P) => prisma(K, P, 8, P.chanfro ?? Math.min(P.w, P.d) * 0.18),
  cilindro: (K, P) => prisma(K, P, P.lados ?? 16), varanda, placa, inclinado, shed, arco, cone, coluna,
};

/**
 * Escreve o LOD0 de um plano no construtor (o prédio já posto com K.predio). Devolve os triângulos escritos.
 * Peças lote (piso, muro) entram também; a R4b completa o lote.
 */
export function malhaDoPlano(K, plano) {
  const t0 = K.tris;
  for (const P of plano.pecas) {
    if (P.soLod1) continue;
    const fn = EMISSORES[P.forma];
    if (!fn) continue;
    P._c = Math.cos(P.giro ?? 0);
    P._s = Math.sin(P.giro ?? 0);
    fn(K, P);
  }
  return K.tris - t0;
}

// ------------------------------------------------------------------------------------------------ LOD1

const IDX_FORMA = { caixa: FORMA.CAIXA, chanfro: FORMA.CHANFRO, cilindro: FORMA.CILINDRO, duasAguas: FORMA.DUAS_AGUAS, quatroAguas: FORMA.DUAS_AGUAS, meiaAgua: FORMA.DUAS_AGUAS };
const TOPO_NENHUM = { t: FACHADA.LAJE, c1: '#8f8b84' };

/**
 * Instâncias do LOD1 de um plano, no espaço do setor: para cada peça lod1, a forma, a matriz (coluna maior, como o
 * three), os bytes (fac, corA, corB, topo) e se é a principal (a única que fica no LOD2).
 * @param {(forma, matriz16, bytes16, principal) => void} emitir
 */
export function instanciasDoPlano(plano, ox, oy, oz, rot, emitir) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const m = new Float32Array(16);
  const b = new Uint8Array(16);
  for (const P of plano.pecas) {
    if (!P.lod1) continue;
    // forma1: a forma do LOD1 quando ela difere (caixa d'água redonda vira caixa, com a mesma caixa envolvente)
    const f = IDX_FORMA[P.forma1 ?? P.forma];
    if (f === undefined) continue;
    const g = rot + (P.giro ?? 0);
    const cg = Math.cos(g);
    const sg = Math.sin(g);
    // centro da base da peça no setor
    const px = ox + P.x * c + P.z * s;
    const pz = oz - P.x * s + P.z * c;
    const py = oy + P.y0;
    // matriz = T * Ry(g) * S(w, h, d); coluna maior
    m[0] = cg * P.w;
    m[1] = 0;
    m[2] = -sg * P.w;
    m[3] = 0;
    m[4] = 0;
    m[5] = P.h;
    m[6] = 0;
    m[7] = 0;
    m[8] = sg * P.d;
    m[9] = 0;
    m[10] = cg * P.d;
    m[11] = 0;
    m[12] = px;
    m[13] = py;
    m[14] = pz;
    m[15] = 1;
    const pk = empacotar(P.mat);
    for (let k = 0; k < 12; k++) b[k] = pk[k];
    const tp = empacotar(P.topo ?? TOPO_NENHUM);
    b[12] = tp[0] | (P.ent ? 128 : 0);
    b[13] = tp[4];
    b[14] = tp[5];
    b[15] = tp[6];
    emitir(f, m, b, !!P.principal);
  }
}

/**
 * Forma unitária do LOD1 (base em y = 0, topo em 1, x e z em [-0,5, 0,5]); sem o fundo.
 * aUnit = [s (0..1 ao longo da face ou do perímetro), t (1 no oitão), tipo (0 parede, 1 topo, 2 água), eixo da
 * largura (0 escala z, 1 escala x, 2 perímetro do chanfro, 3 perímetro do cilindro)].
 * @returns {{ posicao: Float32Array, normal: Float32Array, unit: Float32Array, indices: Uint16Array, tris: number }}
 */
export function formaUnitaria(forma) {
  const pos = [];
  const nor = [];
  const uni = [];
  const idx = [];
  const v = (x, y, z, n, u) => {
    pos.push(x, y, z);
    nor.push(...n);
    uni.push(...u);
    return pos.length / 3 - 1;
  };
  const quad = (a, b, c, d, n, ua, ub, ext) => {
    const i0 = v(...a, n, [ua, 0, ...ext]);
    const i1 = v(...b, n, [ub, 0, ...ext]);
    const i2 = v(...c, n, [ub, 0, ...ext]);
    const i3 = v(...d, n, [ua, 0, ...ext]);
    idx.push(i0, i1, i2, i0, i2, i3);
  };
  const h = 0.5;
  if (forma === FORMA.CAIXA) {
    quad([-h, 0, h], [h, 0, h], [h, 1, h], [-h, 1, h], [0, 0, 1], 0, 1, [0, 1]);
    quad([h, 0, h], [h, 0, -h], [h, 1, -h], [h, 1, h], [1, 0, 0], 0, 1, [0, 0]);
    quad([h, 0, -h], [-h, 0, -h], [-h, 1, -h], [h, 1, -h], [0, 0, -1], 0, 1, [0, 1]);
    quad([-h, 0, -h], [-h, 0, h], [-h, 1, h], [-h, 1, -h], [-1, 0, 0], 0, 1, [0, 0]);
    quad([-h, 1, h], [h, 1, h], [h, 1, -h], [-h, 1, -h], [0, 1, 0], 0, 0, [1, 1]);
  } else if (forma === FORMA.DUAS_AGUAS) {
    const L = Math.hypot(0.5, 1);
    const ny = 0.5 / L;
    const nz = 1 / L;
    // águas: s ao longo da cumeeira (0..1), t ao longo da água (0..1)
    let a = v(-h, 0, h, [0, ny, nz], [0, 0, 2, 1]);
    let b = v(h, 0, h, [0, ny, nz], [1, 0, 2, 1]);
    let c = v(h, 1, 0, [0, ny, nz], [1, 1, 2, 1]);
    let d = v(-h, 1, 0, [0, ny, nz], [0, 1, 2, 1]);
    idx.push(a, b, c, a, c, d);
    a = v(h, 0, -h, [0, ny, -nz], [0, 0, 2, 1]);
    b = v(-h, 0, -h, [0, ny, -nz], [1, 0, 2, 1]);
    c = v(-h, 1, 0, [0, ny, -nz], [1, 1, 2, 1]);
    d = v(h, 1, 0, [0, ny, -nz], [0, 1, 2, 1]);
    idx.push(a, b, c, a, c, d);
    // oitões (t = 1 marca o oitão: parede lisa)
    a = v(h, 0, h, [1, 0, 0], [0, 1, 0, 0]);
    b = v(h, 0, -h, [1, 0, 0], [1, 1, 0, 0]);
    c = v(h, 1, 0, [1, 0, 0], [0.5, 1, 0, 0]);
    idx.push(a, b, c);
    a = v(-h, 0, -h, [-1, 0, 0], [0, 1, 0, 0]);
    b = v(-h, 0, h, [-1, 0, 0], [1, 1, 0, 0]);
    c = v(-h, 1, 0, [-1, 0, 0], [0.5, 1, 0, 0]);
    idx.push(a, b, c);
  } else {
    const pts = [];
    const cil = forma === FORMA.CILINDRO;
    if (cil) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        pts.push([h * Math.cos(a), -h * Math.sin(a)]);
      }
    } else {
      const c = 0.18;
      pts.push([h, h - c], [h, -h + c], [h - c, -h], [-h + c, -h], [-h, -h + c], [-h, h - c], [-h + c, h], [h - c, h]);
    }
    const m = pts.length;
    let per = 0;
    const ac = [0];
    for (let k = 0; k < m; k++) {
      per += Math.hypot(pts[(k + 1) % m][0] - pts[k][0], pts[(k + 1) % m][1] - pts[k][1]);
      ac.push(per);
    }
    const eixo = cil ? 3 : 2;
    for (let k = 0; k < m; k++) {
      const [xa, za] = pts[k];
      const [xb, zb] = pts[(k + 1) % m];
      const sa = ac[k] / per;
      const sb = ac[k + 1] / per;
      if (cil) {
        const la = Math.hypot(xa, za);
        const lb = Math.hypot(xb, zb);
        const i0 = v(xa, 0, za, [xa / la, 0, za / la], [sa, 0, 0, eixo]);
        const i1 = v(xb, 0, zb, [xb / lb, 0, zb / lb], [sb, 0, 0, eixo]);
        const i2 = v(xb, 1, zb, [xb / lb, 0, zb / lb], [sb, 0, 0, eixo]);
        const i3 = v(xa, 1, za, [xa / la, 0, za / la], [sa, 0, 0, eixo]);
        idx.push(i0, i1, i2, i0, i2, i3);
      } else {
        const L = Math.hypot(xb - xa, zb - za);
        quad([xa, 0, za], [xb, 0, zb], [xb, 1, zb], [xa, 1, za], [-(zb - za) / L, 0, (xb - xa) / L], sa, sb, [0, eixo]);
      }
    }
    const c = v(0, 1, 0, [0, 1, 0], [0, 0, 1, 1]);
    const ids = pts.map(([x, z]) => v(x, 1, z, [0, 1, 0], [0, 0, 1, 1]));
    for (let k = 0; k < m; k++) idx.push(c, ids[k], ids[(k + 1) % m]);
  }
  return { posicao: Float32Array.from(pos), normal: Float32Array.from(nor), unit: Float32Array.from(uni), indices: Uint16Array.from(idx), tris: idx.length / 3 };
}

/** O gerador LOD0 roda dentro do gerador de setor (fundir.js): este módulo não registra tipo na oficina. */
export function registrar() {}
