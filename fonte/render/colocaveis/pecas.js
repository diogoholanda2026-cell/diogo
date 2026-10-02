// Peças dos colocáveis (R5, D60): um montador sobre o Construtor da R4a (render/geracao/malhaPredio.js), com as formas
// que os serviços e os prédios da Holding usam: caixa com fachada, prisma de planta qualquer (cunhas, curvas), cilindro,
// sólido de revolução (silos, ovos, copas, caixas d'água), tubo e viga entre dois pontos, faixa ao longo de uma linha
// (marquise, ondas do calçadão, correias), sheds curvos, abóbada, árvores e palmeiras. Puro: sem three e sem DOM (roda
// no worker `oficina`, na thread principal sob demanda e no Node).
//
// Convenções: espaço do lote com a frente para +z (a via), y para cima a partir da cota da plataforma, giro em torno de
// y na convenção do three. Os atributos são os da fachada (malhaPredio.js): u em vãos nas paredes com fachada, em
// metros nos planos; v em metros desde a base da peça. LOD1: só entram as peças marcadas { l1: true }, com menos lados,
// e as { so1: true } (o volume simplificado, que o LOD0 não desenha).
// A variação vem de r(k), um número pela semente e por uma chave fixa: o LOD0 e o LOD1, e a Média e o Ultra, fazem as
// mesmas escolhas, porque nada depende da ordem das chamadas.
import { empacotar, vaosDaFace, FACHADA } from '../geracao/malhaPredio.js';
import { hash32 } from '../../comum/hash.js';

export const F = FACHADA;
/** Sem platibanda na face (o vTopo do shader). */
export const SEM_TOPO = 1e4;
/** Quanto as paredes que nascem no chão descem na plataforma (m). */
export const ENTERRA = 1;

/** Espécies que os colocáveis plantam (os ids da vegetação, render/geracao/arvores.js). */
export const ESPECIES_ARVORE = Object.freeze(['oiti', 'mata2', 'mata3', 'embauba', 'moita', 'palmeira']);
/** Campos por árvore na lista do montador e na resposta da oficina. */
export const PASSO_ARV = 6;

const TAU = Math.PI * 2;

/**
 * Material de superfície (o formato do plano da R4a): t (FACHADA), c1 e c2 ('#rrggbb'), a (andar m), v (vão m), uso
 * (agenda das janelas: 0 moradia, 1 comércio, 2 escritório, 3 indústria), vr (variante 0..7), tr (térreo), dg
 * (desgaste 0..1), vd (tom do vidro 0..1).
 */
export function mat(t, c1, op = {}) {
  return { t, c1, c2: op.c2 ?? c1, a: op.a ?? 3.5, v: op.v ?? 3, uso: op.uso ?? 2, vr: op.vr ?? 0, tr: op.tr ?? 0, dg: op.dg ?? 0.3, vd: op.vd ?? 0.45 };
}

const vaoDe = (m) => Math.max(0.5, Math.round((m.v ?? 3) / 0.1) * 0.1);
/** Material sem grade de janelas (telhado, piso, metal, pedra...): u em metros. */
const liso = (m) => (m.t ?? 0) >= F.TELHA;

function normalizar(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cruz(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Área com sinal do polígono [[x, z], ...] no plano (x, z). */
export function areaPoligono(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % pts.length];
    a += x0 * z1 - x1 * z0;
  }
  return a / 2;
}

/** Triangulação por orelhas de um polígono simples [[x, z], ...]; devolve trios de índices. */
export function triangular(pts) {
  const n = pts.length;
  if (n < 3) return [];
  const idx = [...Array(n).keys()];
  if (areaPoligono(pts) < 0) idx.reverse();
  const tris = [];
  const dentro = (p, a, b, c) => {
    const s = (u, v, w) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
    return s(a, b, p) >= -1e-9 && s(b, c, p) >= -1e-9 && s(c, a, p) >= -1e-9;
  };
  let guarda = n * n;
  while (idx.length > 3 && guarda-- > 0) {
    let achou = false;
    for (let k = 0; k < idx.length; k++) {
      const ia = idx[(k + idx.length - 1) % idx.length];
      const ib = idx[k];
      const ic = idx[(k + 1) % idx.length];
      const a = pts[ia];
      const b = pts[ib];
      const c = pts[ic];
      const conv = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (conv <= 1e-9) continue;
      let vazio = true;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        if (dentro(pts[j], a, b, c)) {
          vazio = false;
          break;
        }
      }
      if (!vazio) continue;
      tris.push([ia, ib, ic]);
      idx.splice(k, 1);
      achou = true;
      break;
    }
    if (!achou) break;
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

/**
 * Montador de um colocável. b.r(k) e b.entre(k, a, b) dão a variação pela semente; b.em(x, y, z, giro, fn) desenha
 * fn num sistema local; cada forma aceita { l1 } (entra no LOD1) e { ao } (oclusão cozida).
 */
export class Montador {
  /**
   * @param {object} K  o Construtor (malhaPredio.js), já com K.predio(...) do colocável
   * @param {{ lod?: 0 | 1, detalhe?: 'media' | 'ultra', semente?: number, nivel?: number, w?: number, d?: number,
   *           tipo?: string }} op
   */
  constructor(K, { lod = 0, detalhe = 'media', semente = 1, nivel = 1, w = 32, d = 32, tipo = '' } = {}) {
    this.K = K;
    this.lod = lod;
    this.ultra = detalhe === 'ultra' && lod === 0;
    this.detalhe = detalhe;
    this.semente = semente >>> 0;
    this.nivel = Math.max(1, Math.min(3, nivel | 0 || 1));
    this.w = w;
    this.d = d;
    this.tipo = tipo;
    this.T = { x: 0, y: 0, z: 0, c: 1, s: 0 };
    this._pilha = [];
    /** Árvores para a vegetação: x, y, z (espaço do modelo), espécie (ESPECIES_ARVORE), altura, largura. */
    this.arvores = [];
  }

  /** Número em [0, 1) pela semente e pela chave k (inteira). */
  r(k) {
    return hash32((this.semente ^ Math.imul((k | 0) + 1, 0x9e3779b1)) >>> 0) / 4294967296;
  }

  entre(k, a, b) {
    return a + (b - a) * this.r(k);
  }

  /** Item da lista pela chave k. */
  item(k, lista) {
    return lista[Math.min(lista.length - 1, Math.floor(this.r(k) * lista.length))];
  }

  /** A peça fica de fora neste LOD? { l1 }: entra nos dois; { so1 }: só no LOD1 (o volume simplificado). */
  fora(op) {
    return this.lod === 1 ? !op?.l1 && !op?.so1 : !!op?.so1;
  }

  /** Lados de um círculo: múltiplos de 4 (a caixa envolvente é a mesma em todos os LOD). */
  lados(op, base = 16) {
    if (this.lod === 1) return op?.lados1 ?? op?.lados ?? 8;
    if (op?.lados) return op.lados;
    return this.ultra ? Math.max(base, 16) + 8 : base;
  }

  /** Desenha fn com a origem em (x, y, z) e girado por giro (radianos) em torno de y. */
  em(x, y, z, giro, fn) {
    const T = this.T;
    this._pilha.push(T);
    const c = Math.cos(giro);
    const s = Math.sin(giro);
    this.T = { x: T.x + x * T.c + z * T.s, y: T.y + y, z: T.z - x * T.s + z * T.c, c: T.c * c - T.s * s, s: T.s * c + T.c * s };
    try {
      fn();
    } finally {
      this.T = this._pilha.pop();
    }
  }

  _p(x, y, z) {
    const T = this.T;
    return [T.x + x * T.c + z * T.s, T.y + y, T.z - x * T.s + z * T.c];
  }

  _n(nx, ny, nz) {
    const T = this.T;
    return [nx * T.c + nz * T.s, ny, -nx * T.s + nz * T.c];
  }

  /** Vértice já no espaço do modelo. */
  _v(p, n, u, v, vt, larg, pk, ao) {
    return this.K.v(p[0], p[1], p[2], n[0], n[1], n[2], u, v, vt, larg, pk, ao);
  }

  /**
   * Quadrilátero a, b, c, d (pontos locais [x, y, z]) com a normal n (local; null: pela regra da mão direita de
   * a, b, d); u e v por vértice; vt e larg da fachada.
   */
  quad(a, b, c, d, m, { n = null, u = [0, 1, 1, 0], v = [0, 0, 1, 1], vt = SEM_TOPO, larg = 1, ao = 1 } = {}) {
    const nn = n ?? normalizar(cruz([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [d[0] - a[0], d[1] - a[1], d[2] - a[2]]));
    const N = this._n(nn[0], nn[1], nn[2]);
    const pk = empacotar(m);
    const i0 = this._v(this._p(...a), N, u[0], v[0], vt, larg, pk, ao);
    const i1 = this._v(this._p(...b), N, u[1], v[1], vt, larg, pk, ao);
    const i2 = this._v(this._p(...c), N, u[2], v[2], vt, larg, pk, ao);
    const i3 = this._v(this._p(...d), N, u[3], v[3], vt, larg, pk, ao);
    this.K.tri(i0, i1, i2);
    this.K.tri(i0, i2, i3);
  }

  /** Triângulo com a normal n (local; null pela regra da mão direita). */
  tri(a, b, c, m, { n = null, uv = [[0, 0], [1, 0], [0, 1]], larg = 1, ao = 1 } = {}) {
    const nn = n ?? normalizar(cruz([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]));
    const N = this._n(nn[0], nn[1], nn[2]);
    const pk = empacotar(m);
    const i0 = this._v(this._p(...a), N, uv[0][0], uv[0][1], SEM_TOPO, larg, pk, ao);
    const i1 = this._v(this._p(...b), N, uv[1][0], uv[1][1], SEM_TOPO, larg, pk, ao);
    const i2 = this._v(this._p(...c), N, uv[2][0], uv[2][1], SEM_TOPO, larg, pk, ao);
    this.K.tri(i0, i1, i2);
  }

  /**
   * Parede vertical de (xa, za) a (xb, zb), de y0 a y1, com a normal para fora à direita de a para b (a mesma regra
   * da R4a). Com fachada, u em vãos inteiros na largura da face; nos materiais lisos, em metros. op.vBase: o v da
   * fachada conta a partir daí (o chão do lote); op.vt: altura da platibanda (desde a base da peça).
   */
  parede(xa, za, xb, zb, y0, y1, m, op = {}) {
    if (this.fora(op)) return;
    const L = Math.hypot(xb - xa, zb - za);
    if (L < 1e-4 || y1 - y0 < 1e-4) return;
    const n = [(-(zb - za)) / L, 0, (xb - xa) / L];
    const vb = op.vBase ?? y0;
    // u em vãos: inteiros na face com grade de janelas, contínuo nos lisos (o shader multiplica pelo vão)
    const u0 = op.u0 ?? 0;
    const u1 = liso(m) ? u0 + L / vaoDe(m) : u0 + (L / (op.largFace ?? L)) * vaosDaFace(op.largFace ?? L, vaoDe(m));
    this.quad([xa, y0, za], [xb, y0, zb], [xb, y1, zb], [xa, y1, za], m, {
      n, u: [u0, u1, u1, u0], v: [y0 - vb, y0 - vb, y1 - vb, y1 - vb], vt: op.vt ?? SEM_TOPO, larg: L, ao: op.ao ?? 1,
    });
  }

  /** Retângulo horizontal na cota y (para cima; op.baixo: para baixo), u e v em metros. */
  plano(x0, z0, x1, z1, y, m, op = {}) {
    if (this.fora(op)) return;
    const ao = op.ao ?? 1;
    const s = op.escalaUV ?? 1;
    if (!op.baixo) this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], m, { n: [0, 1, 0], u: [x0 * s, x1 * s, x1 * s, x0 * s], v: [z1 * s, z1 * s, z0 * s, z0 * s], larg: x1 - x0, ao });
    else this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], m, { n: [0, -1, 0], u: [x0 * s, x1 * s, x1 * s, x0 * s], v: [z0 * s, z0 * s, z1 * s, z1 * s], larg: x1 - x0, ao });
  }

  /**
   * Caixa centrada em (cx, cz), da cota y0 até y0 + h, de w (em x) por d (em z). op: giro, topo (material ou false),
   * base (material do fundo), faces { pz, px, nz, nx } (material por face), sem (bits: 1 +x, 2 -x, 4 +z, 8 -z),
   * vBase, vt, ao, l1.
   */
  caixa(cx, y0, cz, w, h, d, m, op = {}) {
    if (this.fora(op)) return;
    const fazer = () => {
      const hw = w / 2;
      const hd = d / 2;
      const y1 = y0 + h;
      const f = op.faces ?? {};
      const sem = op.sem ?? 0;
      const p = { vBase: op.vBase ?? y0, vt: op.vt, ao: op.ao, l1: true };
      if (!(sem & 4)) this.parede(-hw, hd, hw, hd, y0, y1, f.pz ?? m, p);
      if (!(sem & 1)) this.parede(hw, hd, hw, -hd, y0, y1, f.px ?? m, p);
      if (!(sem & 8)) this.parede(hw, -hd, -hw, -hd, y0, y1, f.nz ?? m, p);
      if (!(sem & 2)) this.parede(-hw, -hd, -hw, hd, y0, y1, f.nx ?? m, p);
      const topo = op.topo === undefined ? m : op.topo;
      if (topo) this.plano(-hw, -hd, hw, hd, y1, topo, { l1: true, ao: op.aoTopo ?? 1 });
      if (op.base) this.plano(-hw, -hd, hw, hd, y0, op.base, { l1: true, baixo: true, ao: 0.6 });
    };
    this.em(cx, 0, cz, op.giro ?? 0, fazer);
  }

  /** Laje horizontal com espessura (topo, fundo e bordas). */
  laje(cx, y, cz, w, d, esp, m, op = {}) {
    if (this.fora(op)) return;
    this.caixa(cx, y - esp, cz, w, esp, d, op.borda ?? m, { ...op, topo: op.topo ?? m, base: op.fundo ?? m });
  }

  /**
   * Prisma de planta pts ([[x, z], ...], qualquer sentido, simples) da cota y0 a y0 + h. op: topo (material ou false),
   * base, faces (material por aresta, função (k) => material), cima: pts do topo (paredes inclinadas, mesma contagem),
   * hTopo: alturas do topo por vértice (topo inclinado), l1, ao.
   */
  prisma(pts, y0, h, m, op = {}) {
    if (this.fora(op)) return;
    // a mesma regra da caixa: as paredes andam no sentido em que a normal (-dz, dx) aponta para fora
    let base = pts.map((p) => [p[0], p[1]]);
    let cima = op.cima ? op.cima.map((p) => [p[0], p[1]]) : base;
    let hs = op.hTopo ? [...op.hTopo] : base.map(() => h);
    if (areaPoligono(base) > 0) {
      base = base.reverse();
      cima = cima.reverse();
      hs = hs.reverse();
    }
    const n = base.length;
    let per = 0;
    for (let k = 0; k < n; k++) per += Math.hypot(base[(k + 1) % n][0] - base[k][0], base[(k + 1) % n][1] - base[k][1]);
    let acum = 0;
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n;
      const mk = typeof op.faces === 'function' ? op.faces(k) ?? m : m;
      const [xa, za] = base[k];
      const [xb, zb] = base[j];
      const [xa1, za1] = cima[k];
      const [xb1, zb1] = cima[j];
      const L = Math.hypot(xb - xa, zb - za);
      if (L < 1e-4) continue;
      const ya1 = y0 + hs[k];
      const yb1 = y0 + hs[j];
      const lisoM = liso(mk);
      const u0 = lisoM ? acum / vaoDe(mk) : 0;
      const u1 = lisoM ? (acum + L) / vaoDe(mk) : vaosDaFace(L, vaoDe(mk));
      acum += L;
      const a = [xa, y0, za];
      const b = [xb, y0, zb];
      const c = [xb1, yb1, zb1];
      const d = [xa1, ya1, za1];
      // normal pela face (paredes inclinadas incluídas): para fora pela regra da caixa
      const nrm = normalizar(cruz([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [d[0] - a[0], d[1] - a[1], d[2] - a[2]]));
      const fora = [-(zb - za) / L, 0, (xb - xa) / L];
      const sinal = nrm[0] * fora[0] + nrm[2] * fora[2] < 0 ? -1 : 1;
      this.quad(a, b, c, d, mk, {
        n: [nrm[0] * sinal, nrm[1] * sinal, nrm[2] * sinal], u: [u0, u1, u1, u0], v: [0, 0, yb1 - y0, ya1 - y0],
        vt: op.vt ?? SEM_TOPO, larg: L, ao: op.ao ?? 1,
      });
    }
    const topo = op.topo === undefined ? m : op.topo;
    if (topo) {
      const tri = triangular(cima);
      // topo inclinado: a normal pelo plano dos três primeiros pontos não alinhados
      let nt = [0, 1, 0];
      if (op.hTopo) {
        for (const [i0, i1, i2] of tri) {
          const p0 = [cima[i0][0], hs[i0], cima[i0][1]];
          const p1 = [cima[i1][0], hs[i1], cima[i1][1]];
          const p2 = [cima[i2][0], hs[i2], cima[i2][1]];
          const c = cruz([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]]);
          if (Math.hypot(...c) > 1e-6) {
            nt = normalizar(c);
            if (nt[1] < 0) nt = [-nt[0], -nt[1], -nt[2]];
            break;
          }
        }
      }
      for (const [i0, i1, i2] of tri) {
        const P = (i) => [cima[i][0], y0 + hs[i], cima[i][1]];
        this.tri(P(i0), P(i1), P(i2), topo, { n: nt, uv: [i0, i1, i2].map((i) => [cima[i][0], cima[i][1]]), ao: op.aoTopo ?? 1 });
      }
    }
    if (op.base) for (const [i0, i1, i2] of triangular(base)) {
      const P = (i) => [base[i][0], y0, base[i][1]];
      this.tri(P(i0), P(i1), P(i2), op.base, { n: [0, -1, 0], uv: [i0, i1, i2].map((i) => [base[i][0], base[i][1]]), ao: 0.6 });
    }
  }

  /** Placa plana horizontal de planta qualquer (piso, espelho d'água, gramado), na cota y. */
  piso(pts, y, m, op = {}) {
    if (this.fora(op)) return;
    const s = op.escalaUV ?? 1;
    for (const [i0, i1, i2] of triangular(pts)) {
      const P = (i) => [pts[i][0], y, pts[i][1]];
      this.tri(P(i0), P(i1), P(i2), m, { n: [0, 1, 0], uv: [i0, i1, i2].map((i) => [pts[i][0] * s, pts[i][1] * s]), ao: op.ao ?? 1 });
    }
  }

  /**
   * Sólido de revolução em torno do eixo y em (cx, cz): perfil [[r, y], ...] de baixo para cima. op: lados, liso
   * (normais médias nos pontos do perfil), fundo e topo (fecha com um leque se o r da ponta não for 0), rz (elipse:
   * raio em z = r x rz), l1, ao.
   */
  torno(cx, cz, perfil, m, op = {}) {
    if (this.fora(op)) return;
    const n = this.lados(op, op.ladosBase ?? 16);
    const rz = op.rz ?? 1;
    const pk = empacotar(m);
    const vao = vaoDe(m);
    const P = perfil.length;
    // normais do perfil por segmento (no plano r, y) e o comprimento acumulado
    const segN = [];
    const acum = [0];
    for (let k = 0; k + 1 < P; k++) {
      const dr = perfil[k + 1][0] - perfil[k][0];
      const dy = perfil[k + 1][1] - perfil[k][1];
      const l = Math.hypot(dr, dy) || 1;
      segN.push([dy / l, -dr / l]);
      acum.push(acum[k] + l);
    }
    const rMax = Math.max(...perfil.map((p) => p[0]), 1e-3);
    const circ = TAU * rMax;
    const anel = (k, nr, ny) => {
      const ids = [];
      const [r, y] = perfil[k];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        const ca = Math.cos(a);
        const sa = -Math.sin(a);
        const p = this._p(cx + r * ca, y, cz + r * rz * sa);
        const N = this._n(nr * ca, ny, (nr * sa) / rz);
        const l = Math.hypot(...N) || 1;
        ids.push(this._v(p, [N[0] / l, N[1] / l, N[2] / l], ((i / n) * circ) / vao, acum[k], SEM_TOPO, circ, pk, op.ao ?? 1));
      }
      return ids;
    };
    for (let k = 0; k + 1 < P; k++) {
      let na = segN[k];
      let nb = segN[k];
      if (op.liso) {
        if (k > 0) na = normalizar2(segN[k - 1], segN[k]);
        if (k + 2 < P) nb = normalizar2(segN[k], segN[k + 1]);
      }
      const A = anel(k, na[0], na[1]);
      const B = anel(k + 1, nb[0], nb[1]);
      const ra = perfil[k][0];
      const rb = perfil[k + 1][0];
      for (let i = 0; i < n; i++) {
        // na ponta (r = 0) um dos dois triângulos some
        if (ra > 1e-6) this.K.tri(A[i], A[i + 1], B[i + 1]);
        if (rb > 1e-6) this.K.tri(A[i], B[i + 1], B[i]);
      }
    }
    const tampa = (k, cima) => {
      const [r, y] = perfil[k];
      if (r <= 1e-6) return;
      const mt = (cima ? op.topo : op.fundo) ?? m;
      const pkt = empacotar(mt);
      const N = this._n(0, cima ? 1 : -1, 0);
      const c = this._v(this._p(cx, y, cz), N, 0, 0, SEM_TOPO, 1, pkt, op.ao ?? 1);
      const ids = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        ids.push(this._v(this._p(cx + r * Math.cos(a), y, cz - r * rz * Math.sin(a)), N, r * Math.cos(a), r * Math.sin(a), SEM_TOPO, 1, pkt, op.ao ?? 1));
      }
      for (let i = 0; i < n; i++) this.K.tri(c, ids[i], ids[(i + 1) % n]);
    };
    if (op.topo !== false && (op.topo || op.fechar)) tampa(P - 1, true);
    if (op.fundo) tampa(0, false);
  }

  /** Cilindro vertical (prisma redondo) de raio r e altura h; op como o torno (topo: material ou false). */
  cilindro(cx, y0, cz, r, h, m, op = {}) {
    this.torno(cx, cz, [[r, y0], [r, y0 + h]], m, { topo: op.topo === undefined ? m : op.topo, ...op, liso: false });
  }

  /**
   * Tubo de seção circular entre dois pontos locais a e b (raio r): postes, canos, correias, braços de grua. op: lados
   * (4, 6 ou 8), pontas (fecha as duas), l1.
   */
  tubo(a, b, r, m, op = {}) {
    if (this.fora(op)) return;
    const n = op.lados ?? (this.lod === 1 ? 4 : this.ultra ? 8 : 6);
    const eixo = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const L = Math.hypot(...eixo);
    if (L < 1e-5) return;
    const e = eixo.map((x) => x / L);
    // dois vetores perpendiculares
    const ref = Math.abs(e[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = normalizar(cruz(e, ref));
    const w = cruz(e, u);
    const pk = empacotar(m);
    const vao = vaoDe(m);
    // anéis no espaço local: o ponto e a normal radial de cada lado
    const aneis = [a, b].map((p) => {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const ang = (i / n) * TAU + (n === 4 ? Math.PI / 4 : 0);
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const nl = [u[0] * ca + w[0] * sa, u[1] * ca + w[1] * sa, u[2] * ca + w[2] * sa];
        pts.push({ q: [p[0] + nl[0] * r, p[1] + nl[1] * r, p[2] + nl[2] * r], nl });
      }
      return pts;
    });
    const ids = aneis.map((pts, k) => pts.map(({ q, nl }, i) => this._v(this._p(...q), this._n(...nl), ((i / n) * TAU * r) / vao, k * L, SEM_TOPO, TAU * r, pk, op.ao ?? 1)));
    for (let i = 0; i < n; i++) {
      this.K.tri(ids[0][i], ids[0][i + 1], ids[1][i + 1]);
      this.K.tri(ids[0][i], ids[1][i + 1], ids[1][i]);
    }
    if (op.pontas) {
      for (const [k, s] of [[0, -1], [1, 1]]) {
        const N = this._n(e[0] * s, e[1] * s, e[2] * s);
        const c = this._v(this._p(...(k ? b : a)), N, 0, 0, SEM_TOPO, 1, pk, 1);
        const anel = aneis[k].slice(0, n).map(({ q }) => this._v(this._p(...q), N, 0, 0, SEM_TOPO, 1, pk, 1));
        for (let i = 0; i < n; i++) this.K.tri(c, anel[i], anel[(i + 1) % n]);
      }
    }
  }

  /**
   * Viga de seção retangular (larg x alt) entre dois pontos locais a e b; "cima" é o eixo vertical da seção (padrão:
   * o y do mundo projetado). Quatro faces, sem as pontas (op.pontas fecha).
   */
  viga(a, b, larg, alt, m, op = {}) {
    if (this.fora(op)) return;
    const eixo = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const L = Math.hypot(...eixo);
    if (L < 1e-5) return;
    const e = eixo.map((x) => x / L);
    const ref = Math.abs(e[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
    const lado = normalizar(cruz(e, ref));
    const cima = cruz(lado, e);
    const hl = larg / 2;
    const ha = alt / 2;
    const P = (p, sl, sc) => [p[0] + lado[0] * hl * sl + cima[0] * ha * sc, p[1] + lado[1] * hl * sl + cima[1] * ha * sc, p[2] + lado[2] * hl * sl + cima[2] * ha * sc];
    const faces = [
      [1, 1, -1, 1, cima, larg],
      [-1, -1, 1, -1, cima.map((x) => -x), larg],
    ];
    // cima e baixo
    for (const [s0, , s1, sc, n, lw] of faces) this.quad(P(a, s0, sc), P(a, s1, sc), P(b, s1, sc), P(b, s0, sc), m, { n, u: [0, lw, lw, 0], v: [0, 0, L, L], larg: lw, ao: op.ao ?? 1 });
    // lados
    this.quad(P(a, 1, -1), P(a, 1, 1), P(b, 1, 1), P(b, 1, -1), m, { n: lado, u: [0, alt, alt, 0], v: [0, 0, L, L], larg: alt, ao: op.ao ?? 1 });
    this.quad(P(a, -1, 1), P(a, -1, -1), P(b, -1, -1), P(b, -1, 1), m, { n: lado.map((x) => -x), u: [0, alt, alt, 0], v: [0, 0, L, L], larg: alt, ao: op.ao ?? 1 });
    if (op.pontas) {
      this.quad(P(a, -1, -1), P(a, 1, -1), P(a, 1, 1), P(a, -1, 1), m, { n: e.map((x) => -x), larg: larg });
      this.quad(P(b, 1, -1), P(b, -1, -1), P(b, -1, 1), P(b, 1, 1), m, { n: e, larg: larg });
    }
  }

  /**
   * Faixa ao longo da linha pts ([[x, z], ...]) na cota y, com meia largura ml (número ou [esquerda, direita] por
   * ponto). op: esp (espessura, desenha o fundo e as bordas), escalaUV, l1, ao. Serve à marquise, às ondas do
   * calçadão, aos caminhos e às correias planas.
   */
  faixa(pts, y, ml, m, op = {}) {
    if (this.fora(op)) return;
    const n = pts.length;
    if (n < 2) return;
    const esq = [];
    const dir = [];
    for (let k = 0; k < n; k++) {
      const a = pts[Math.max(0, k - 1)];
      const b = pts[Math.min(n - 1, k + 1)];
      const tx = b[0] - a[0];
      const tz = b[1] - a[1];
      const l = Math.hypot(tx, tz) || 1;
      const nx = -tz / l;
      const nz = tx / l;
      const [me, md] = Array.isArray(ml) ? (Array.isArray(ml[k]) ? ml[k] : ml) : [ml, ml];
      esq.push([pts[k][0] + nx * me, pts[k][1] + nz * me]);
      dir.push([pts[k][0] - nx * md, pts[k][1] - nz * md]);
    }
    const s = op.escalaUV ?? 1;
    const esp = op.esp ?? 0;
    const yb = y - esp;
    for (let k = 0; k + 1 < n; k++) {
      const A = esq[k];
      const B = esq[k + 1];
      const C = dir[k + 1];
      const D = dir[k];
      this.quad([D[0], y, D[1]], [C[0], y, C[1]], [B[0], y, B[1]], [A[0], y, A[1]], m, {
        n: [0, 1, 0], u: [D[0] * s, C[0] * s, B[0] * s, A[0] * s], v: [D[1] * s, C[1] * s, B[1] * s, A[1] * s], larg: 1, ao: op.ao ?? 1,
      });
      if (esp > 0) {
        const mb = op.fundo ?? m;
        this.quad([A[0], yb, A[1]], [B[0], yb, B[1]], [C[0], yb, C[1]], [D[0], yb, D[1]], mb, { n: [0, -1, 0], u: [A[0], B[0], C[0], D[0]], v: [A[1], B[1], C[1], D[1]], ao: 0.6 });
        const mbo = op.borda ?? m;
        for (const [P0, P1] of [[A, B], [C, D]]) {
          const L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]);
          this.quad([P0[0], yb, P0[1]], [P1[0], yb, P1[1]], [P1[0], y, P1[1]], [P0[0], y, P0[1]], mbo, { u: [0, L, L, 0], v: [0, 0, esp, esp], larg: L, ao: 0.9 });
        }
      }
    }
    if (esp > 0 && op.pontas !== false) {
      const mbo = op.borda ?? m;
      for (const [P0, P1] of [[dir[0], esq[0]], [esq[n - 1], dir[n - 1]]]) {
        const L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]);
        this.quad([P0[0], yb, P0[1]], [P1[0], yb, P1[1]], [P1[0], y, P1[1]], [P0[0], y, P0[1]], mbo, { u: [0, L, L, 0], v: [0, 0, esp, esp], larg: L, ao: 0.9 });
      }
    }
  }

  /**
   * Placa inclinada com espessura: os quatro cantos de cima a, b, c, d (locais, anti-horário visto de cima); a face de
   * baixo desce esp na normal. Painel solar, rampa verde, cobertura de uma água.
   */
  placa(a, b, c, d, esp, m, op = {}) {
    if (this.fora(op)) return;
    let n = normalizar(cruz([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [d[0] - a[0], d[1] - a[1], d[2] - a[2]]));
    if (n[1] < 0) n = n.map((x) => -x);
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const ad = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    const s = op.escalaUV ?? 1;
    this.quad(a, b, c, d, m, { n, u: [0, ab * s, ab * s, 0], v: [0, 0, ad * s, ad * s], larg: ab, ao: op.ao ?? 1 });
    if (!(esp > 0)) return;
    const baixo = (p) => [p[0] - n[0] * esp, p[1] - n[1] * esp, p[2] - n[2] * esp];
    const [A, B, C, D] = [a, b, c, d].map(baixo);
    const mb = op.baixo ?? m;
    this.quad(A, D, C, B, mb, { n: n.map((x) => -x), u: [0, ad, ad, 0], v: [0, 0, ab, ab], larg: ad, ao: 0.6 });
    if (op.bordas === false) return;
    const mbo = op.borda ?? mb;
    for (const [P0, P1, Q0, Q1] of [[a, b, A, B], [b, c, B, C], [c, d, C, D], [d, a, D, A]]) {
      const L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]);
      const mid = [(P0[0] + P1[0]) / 2 - (a[0] + c[0]) / 2, 0, (P0[2] + P1[2]) / 2 - (a[2] + c[2]) / 2];
      const nb = normalizar([mid[0], 0.0001, mid[2]]);
      this.quad(Q0, Q1, P1, P0, mbo, { n: nb, u: [0, L, L, 0], v: [0, 0, esp, esp], larg: L, ao: 0.85 });
    }
  }

  /**
   * Sheds curvos (Rede Sarah): n arcos ao longo de z, cada um subindo de za a zb num quarto de elipse de altura h,
   * com o pano de vidro vertical em zb; x de x0 a x1; y0 a cota de apoio. mTelha: a chapa curva; mVidro: o pano;
   * mOitao: os oitões curvos das pontas.
   */
  shedsCurvos(x0, x1, z0, z1, y0, h, n, mTelha, mVidro, mOitao, op = {}) {
    if (this.fora(op)) return;
    const seg = this.lod === 1 ? 2 : this.ultra ? 8 : 5;
    const passo = (z1 - z0) / n;
    for (let k = 0; k < n; k++) {
      const za = z0 + k * passo;
      const zb = za + passo;
      const arco = [];
      for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        // quarto de elipse convexo: sobe íngreme em za e deita na crista em zb, onde o vidro desce (a chapa da Sarah)
        const ang = (t * Math.PI) / 2;
        arco.push([za + (1 - Math.cos(ang)) * passo, y0 + Math.sin(ang) * h]);
      }
      let acum = 0;
      for (let i = 0; i < seg; i++) {
        const [zA, yA] = arco[i];
        const [zB, yB] = arco[i + 1];
        const L = Math.hypot(zB - zA, yB - yA);
        const nz = -(yB - yA) / L;
        const ny = (zB - zA) / L;
        this.quad([x1, yA, zA], [x0, yA, zA], [x0, yB, zB], [x1, yB, zB], mTelha, { n: [0, ny, nz], u: [x1, x0, x0, x1], v: [acum, acum, acum + L, acum + L], larg: x1 - x0 });
        acum += L;
      }
      // pano de vidro vertical voltado para +z, debaixo da crista
      this.parede(x0, zb, x1, zb, y0, y0 + h * 0.96, mVidro, { vBase: y0 });
      // oitões: leque do arco nas duas pontas
      for (const [x, s] of [[x0, -1], [x1, 1]]) {
        for (let i = 0; i < seg; i++) {
          const a = [x, y0, zb];
          const b = [x, arco[i][1], arco[i][0]];
          const c = [x, arco[i + 1][1], arco[i + 1][0]];
          this.tri(a, b, c, mOitao, { n: [s, 0, 0] });
        }
      }
    }
  }

  /** Abóbada (cobertura em arco) ao longo de x, de largura d em z, flecha h, apoiada na cota y0; tímpanos opcionais. */
  abobada(cx, y0, cz, w, d, h, m, op = {}) {
    if (this.fora(op)) return;
    const seg = this.lod === 1 ? 4 : this.ultra ? 12 : 8;
    const hw = w / 2;
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const z = -d / 2 + d * t;
      // arco circular com a flecha h
      const R = (h * h + (d * d) / 4) / (2 * h);
      const y = Math.sqrt(Math.max(0, R * R - z * z)) - (R - h);
      pts.push([cz + z, y0 + y]);
    }
    let acum = 0;
    const esp = op.esp ?? 0;
    for (let i = 0; i < seg; i++) {
      const [zA, yA] = pts[i];
      const [zB, yB] = pts[i + 1];
      const L = Math.hypot(zB - zA, yB - yA);
      const nz = -(yB - yA) / L;
      const ny = (zB - zA) / L;
      this.quad([cx + hw, yA, zA], [cx - hw, yA, zA], [cx - hw, yB, zB], [cx + hw, yB, zB], m, { n: [0, ny, nz], u: [hw, -hw, -hw, hw], v: [acum, acum, acum + L, acum + L], larg: w });
      if (esp > 0) this.quad([cx - hw, yA - esp, zA], [cx + hw, yA - esp, zA], [cx + hw, yB - esp, zB], [cx - hw, yB - esp, zB], op.forro ?? m, { n: [0, -ny, -nz], u: [0, w, w, 0], v: [acum, acum, acum + L, acum + L], larg: w, ao: 0.6 });
      acum += L;
    }
    if (op.timpano) {
      for (const [x, s] of [[cx - hw, -1], [cx + hw, 1]]) {
        for (let i = 0; i < seg; i++) {
          this.tri([x, y0, cz], [x, pts[i][1], pts[i][0]], [x, pts[i + 1][1], pts[i + 1][0]], op.timpano, { n: [s, 0, 0], uv: [[0, 0], [pts[i][0], pts[i][1] - y0], [pts[i + 1][0], pts[i + 1][1] - y0]] });
        }
      }
    }
  }

  /**
   * Árvore plantada pela vegetação da R2b (ctx.vegetacao.plantar: as espécies de verdade, com LOD, impostor, vento e
   * sombra): o montador só guarda o lugar no espaço do modelo, a espécie, a altura e a largura da copa. op: alt, raio,
   * especie ('oiti', 'mata2', 'mata3', 'embauba', 'moita', 'palmeira').
   */
  arvore(x, y, z, op = {}) {
    const alt = op.alt ?? 8;
    const larg = 2 * (op.raio ?? alt * 0.42);
    const p = this._p(x, y, z);
    this.arvores.push(p[0], p[1], p[2], Math.max(0, ESPECIES_ARVORE.indexOf(op.especie ?? 'oiti')), alt, larg);
  }

  /** Palmeira (imperial): plantada pela vegetação como a árvore. */
  palmeira(x, y, z, op = {}) {
    const alt = op.alt ?? 18;
    const p = this._p(x, y, z);
    this.arvores.push(p[0], p[1], p[2], ESPECIES_ARVORE.indexOf('palmeira'), alt, op.larg ?? alt * 0.4);
  }

  /** Poste de luz com braço e luminária (pedra portuguesa, praças e parques). */
  poste(x, y, z, alt = 5, op = {}) {
    if (this.fora(op)) return;
    const metal = mat(F.METAL, op.cor ?? '#3d4144');
    // no LOD1 o fuste vai até o topo da luminária (a mesma caixa do LOD0)
    this.tubo([x, y - 0.2, z], [x, y + alt + (this.lod === 1 ? 0.15 : 0), z], op.r ?? 0.08, metal, { lados: 4, l1: op.l1 });
    if (this.lod === 1) return;
    const luz = mat(F.LETREIRO, '#e6dcc4');
    this.caixa(x, y + alt - 0.1, z, 0.5, 0.25, 0.5, luz, { topo: metal });
  }

  /** Banco de praça: assento de madeira sobre dois pés de concreto. */
  banco(x, y, z, giro, comp = 2.4) {
    if (this.lod === 1) return;
    const conc = mat(F.CONCRETO, '#b8b2a6');
    const mad = mat(F.MADEIRA, '#7b5b40', { v: 0.6 });
    this.em(x, y, z, giro, () => {
      this.caixa(-comp / 2 + 0.25, 0, 0, 0.3, 0.42, 0.5, conc, {});
      this.caixa(comp / 2 - 0.25, 0, 0, 0.3, 0.42, 0.5, conc, {});
      this.caixa(0, 0.42, 0, comp, 0.08, 0.55, mad, {});
    });
  }

  /** Veículo simples (caminhão, carro de serviço) com cabine e caçamba ou baú; cor pelo material. */
  veiculo(x, y, z, giro, op = {}) {
    if (this.lod === 1 && !op.l1) return;
    const L = op.comp ?? 8;
    const W = op.larg ?? 2.5;
    const cab = mat(F.METAL, op.corCabine ?? '#d9d6cf');
    const corpo = op.mat ?? mat(F.METAL, op.cor ?? '#9a9890');
    const pneu = mat(F.CONCRETO, '#26272a');
    const vidro = mat(F.VIDRO, '#2b3a45');
    this.em(x, y, z, giro, () => {
      this.caixa(0, 0.25, -L / 2 + 0.9, W * 0.9, 0.6, 1.8, pneu, { topo: false, l1: op.l1 });
      this.caixa(0, 0.25, L / 2 - 1.1, W * 0.9, 0.6, 1.4, pneu, { topo: false, l1: op.l1 });
      this.caixa(0, 0.75, L / 2 - 1.1, W, 1.9, 2.2, cab, { faces: { pz: vidro }, l1: op.l1 });
      if (op.betoneira) {
        // tambor da betoneira inclinado, na cor dela
        this.caixa(0, 0.75, -1, W * 0.8, 0.5, L - 3, mat(F.METAL, '#55585c'), { l1: op.l1 });
        this.tubo([0, 1.6, -L / 2 + 0.6], [0, 2.9, L / 2 - 2.6], 1.15, corpo, { lados: this.lod === 1 ? 4 : 8, pontas: true, l1: op.l1 });
      } else this.caixa(0, 0.75, -1, W, op.alt ?? 2.2, L - 2.6, corpo, { l1: op.l1 });
    });
  }
}

function normalizar2(a, b) {
  const x = a[0] + b[0];
  const y = a[1] + b[1];
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}
