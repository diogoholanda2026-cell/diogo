// Edifício-fita em terraços dividido em módulos (como as zonas residenciais do BuildIt):
// cada módulo sobe um andar por nível. Os módulos estáveis são fundidos por material.
// Linguagem da foto (Bosco Verticale / BIG / Zaha): cada laje é um beiral grosso de concreto claro com
// floreira contínua e vegetação pendente (instanciada por fita: 1 chamada), ripas de madeira na fachada
// externa (1 chamada por fita) e pontas arredondadas nas fitas abertas; um anel pode ter vãos
// (def.aberturas = índices dos cortes que viram abertura, com as pontas afinadas dos dois lados).
// Opções da rodada "fiel 2": prof.celular (parede de células da arena), prof.curbMat, prof.caminho, prof.taludeAndares,
// prof.passeioW/passeioAt (geom.js); def.ponta0/ponta1/pontas (afinamento por extremidade), def.pontaDegrau (a ponta
// leste desce em degraus), def.andaresExtra (andares a mais só na geometria do nível máximo), def.arbustos 'teto',
// def.arbustoFora, def.moitas, def.ripaPasso, def.largura(s), def.centroLargura, def.extraGeo(faixa).
// Rodada "Trevo" (plano mestre, revisão 6): def.ordem (módulo do jogo -> trecho do caminho), def.aberturaDe (largura
// do vão por corte), def.nos (tambores nos nós, do módulo dono), def.pilares (do chão até prof.y0), tampa acabada nas
// pontas retas (def.tampa = false volta à tampa plana) e os ajudantes caixa(i), pegada(i) e dentro(i, x, z, y).
import * as THREE from 'three';
import { sweep, terraceFloor, terraceOutline, cellFloor, cellOutline, passeioTeto, talude, skeletonFloor, subPathDenso, pathLength, normals, merge, beamGeo, beamMatrix, medidas, pontaFator, FH, BAY } from '../geom.js';
import { M } from '../materials.js';
import { leafMaterial } from '../forest.js';
import { hash } from '../../core/util.js';

// materiais novos do pacote de superfícies podem ainda não existir: cai num parecido
const RESERVA = { roofMetal: 'grey', caminhoTeto: 'concreto', bandaCinza: 'concreto', vidroDossel: 'glass', fasciaBeiral: 'fascia', fac_fita: 'fac_quente', fac_ambar: 'fac_fita', fac_colmeia: 'fac_fita', fac_celular: 'fac_fita', ripa: 'dark' };
export const matDe = (k) => M[k] || M[RESERVA[k]] || M.white;
let _viga = null; // pilar do esqueleto (compartilhado por todas as fitas)
const vigaGeo = () => { if (!_viga) { _viga = beamGeo(0.035, 5); _viga.userData.compartilhada = true; } return _viga; };
const marca = (map) => { for (const g of map.values()) g.userData.compartilhada = true; return map; };
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _I = new THREE.Matrix4();
const TAU = Math.PI * 2, LADOS = 24; // o tambor é varrido num círculo de 24 lados
const RECUO = 0.42, LANTERNA = 1.26, LANT_H = 0.35; // último andar do tambor recuado; raio da lanterna do átrio e altura do topo dela acima do teto
// verdes do jardim (albedo linear, os mesmos da mata de paisagismo)
const JARDIM = [[0.12, 0.24, 0.045], [0.085, 0.2, 0.04], [0.15, 0.26, 0.055], [0.19, 0.25, 0.045]];
let _tufo = null, _ripa = null;
// arbusto de 12 triângulos: dois lóbulos em pirâmide hexagonal achatada, mais claros no topo (a folhagem
// e o vento vêm do material das copas); lido de longe como a touceira da floreira
function tufoGeo() {
  if (_tufo) return _tufo;
  const P = [], N = [], C = [], I = [];
  const lobo = (cx, cy, cz, r, h, seed) => {
    const base = P.length / 3; const ax = cx + (hash(seed, 1, 5) - 0.5) * 0.3 * r, az = cz + (hash(seed, 2, 5) - 0.5) * 0.3 * r;
    P.push(ax, cy + h, az); N.push(0, 1, 0); C.push(0.98, 1.04, 0.94);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, rr = r * (0.85 + hash(k, seed, 3) * 0.3); const nx = Math.cos(a) * 0.75, nz = Math.sin(a) * 0.75, l = Math.hypot(nx, 0.66, nz); P.push(cx + Math.cos(a) * rr, cy + (hash(k, seed, 4) - 0.5) * 0.1 * r, cz + Math.sin(a) * rr); N.push(nx / l, 0.66 / l, nz / l); const v = 0.5 + hash(k, seed, 6) * 0.12; C.push(v * 0.94, v, v * 0.9); }
    for (let k = 0; k < 6; k++) { // orientação: a normal geométrica para cima e para fora
      const a = base, b = base + 1 + k, c = base + 1 + ((k + 1) % 6);
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const ny = uz * vx - ux * vz; if (ny >= 0) I.push(a, b, c); else I.push(a, c, b);
    }
  };
  lobo(0, 0, 0, 1, 0.75, 1); lobo(0.55, -0.06, 0.35, 0.7, 0.55, 2);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  g.computeBoundingSphere(); g.userData.compartilhada = true; return (_tufo = g);
}
// ripa (brise): um retângulo fino em pé, com a face para fora (escala x = espessura, y = altura)
function ripaGeo() { if (_ripa) return _ripa; const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); g.userData.compartilhada = true; return (_ripa = g); }

// junta vários mapas material -> geometria num só (uma geometria por material)
function junta(maps) {
  const por = new Map(); for (const mp of maps) if (mp) for (const [k, g] of mp) { if (!por.has(k)) por.set(k, []); por.get(k).push([g, _I]); }
  const out = new Map(); for (const [k, l] of por) out.set(k, l.length === 1 ? l[0][0] : merge(l)); return out;
}
const cumDe = (P) => { const c = [0]; for (let k = 1; k < P.length; k++) c.push(c[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1])); return c; };
const faixaDe = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, k) => a + k); // [a, b)
// corta d0 do começo e d1 do fim de um caminho aberto (W = fator de largura por ponto, interpolado; null = 1)
function corta(path, W, d0, d1) {
  const N = path.length, cum = cumDe(path), L = cum[N - 1];
  const at = (d) => { let k = 1; while (k < N - 1 && cum[k] < d) k++; const t = Math.min(1, Math.max(0, (d - cum[k - 1]) / (cum[k] - cum[k - 1] || 1))); const a = path[k - 1], b = path[k]; return [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], W ? W[k - 1] + (W[k] - W[k - 1]) * t : 1]; };
  const [a, wa] = at(d0), [b, wb] = at(L - d1); const pts = [a], Wt = [wa];
  for (let k = 0; k < N; k++) if (cum[k] > d0 + 0.02 && cum[k] < L - d1 - 0.02) { pts.push(path[k]); Wt.push(W ? W[k] : 1); }
  pts.push(b); Wt.push(wb); return { pts, W: W ? Wt : null };
}
// referência numa ponta do caminho (fim = ponta final), a d para dentro: ponto, normal (+o), direção para fora da
// ponta e fator de largura
function refPonta(path, nor, W, fim, d = 0) {
  const N = path.length, ix = (j) => (fim ? N - 1 - j : j); const e = path[ix(0)], q = path[ix(1)]; let tx = e[0] - q[0], tz = e[1] - q[1]; const l = Math.hypot(tx, tz) || 1;
  let acc = 0, j = 0; while (j < N - 2) { const a = path[ix(j)], b = path[ix(j + 1)], s = Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc + s >= d) break; acc += s; j++; }
  const a = path[ix(j)], b = path[ix(j + 1)], s = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, u = Math.min(1, Math.max(0, (d - acc) / s));
  const na = nor[ix(j)], nb = nor[ix(j + 1)]; const nx = na[0] + (nb[0] - na[0]) * u, nz = na[1] + (nb[1] - na[1]) * u, ln = Math.hypot(nx, nz) || 1;
  return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, nx: nx / ln, nz: nz / ln, tx: tx / l, tz: tz / l, w: W ? W[ix(j)] + (W[ix(j + 1)] - W[ix(j)]) * u : 1 };
}
// pedaços planos (tampa acabada, discos do tambor, pilares): Map material -> BufferGeometry (posição, normal, uv, índice)
class Molde {
  constructor() { this.m = new Map(); }
  _b(k) { let b = this.m.get(k); if (!b) this.m.set(k, (b = { p: [], n: [], uv: [], i: [] })); return b; }
  _v(b, q, n, t) { b.p.push(q[0], q[1], q[2]); b.n.push(n[0], n[1], n[2]); b.uv.push(t[0], t[1]); return b.p.length / 3 - 1; }
  // quadrilátero a b c d com a normal n (os triângulos seguem n); uv: [[u, v] x 4] ou 'plan' (planta, x/z)
  quad(k, a, b, c, d, n, uv) {
    const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], e2 = [d[0] - b[0], d[1] - b[1], d[2] - b[2]]; const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (Math.hypot(cx, cy, cz) < 1e-7) return; // degenerado
    const B = this._b(k), Q = [a, b, c, d], U = uv === 'plan' ? Q.map((q) => [q[0] / 2.2, q[2] / 2.2]) : uv; const i0 = B.p.length / 3; Q.forEach((q, j) => this._v(B, q, n, U[j]));
    if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) B.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); else B.i.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2);
  }
  // disco (ou cone raso) de raio r em volta de c, borda em y e centro em yc, virado para cima ou para baixo
  leque(k, c, r, y, yc, cima = true, seg = LADOS) {
    const B = this._b(k), n = cima ? [0, 1, 0] : [0, -1, 0]; const i0 = this._v(B, [c[0], yc, c[1]], n, [c[0] / 2.2, c[1] / 2.2]);
    for (let j = 0; j < seg; j++) { const a = (j / seg) * TAU, x = c[0] + Math.cos(a) * r, z = c[1] + Math.sin(a) * r; this._v(B, [x, y, z], n, [x / 2.2, z / 2.2]); }
    for (let j = 0; j < seg; j++) { const a = i0 + 1 + j, b = i0 + 1 + ((j + 1) % seg); if (cima) B.i.push(i0, b, a); else B.i.push(i0, a, b); }
  }
  // pilar: prisma de seg lados em (x, z) de y0 a y1
  pilar(k, x, z, r, y0, y1, seg = 8) {
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU, b = ((j + 1) / seg) * TAU, m = (a + b) / 2; const P = (t, y) => [x + Math.cos(t) * r, y, z + Math.sin(t) * r];
      this.quad(k, P(a, y0), P(b, y0), P(b, y1), P(a, y1), [Math.cos(m), 0, Math.sin(m)], [[j / seg, y0], [(j + 1) / seg, y0], [(j + 1) / seg, y1], [j / seg, y1]]);
    }
  }
  mapa() {
    const out = new Map();
    for (const [k, b] of this.m) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setIndex(b.i); g.computeBoundingSphere(); g.computeBoundingBox(); out.set(k, g); }
    return out;
  }
}

export class Faixa {
  // def: { id, path, closed, prof:{o0,o1,setIn,setOut,fac,facIn,roof,y0,fh,beiral,curb,curbW,slab}, modulos|cortes,
  //        aberturas:[índices de cortes], abertura (largura do vão), aberturaDe:{corte: largura} (vão próprio por corte),
  //        ponta (comprimento do afinamento; 0 = reto, com a tampa acabada), ponta0/ponta1/pontas:{corte: Lt}
  //        (afinamento por extremidade), tampa (false = tampa plana antiga nas pontas retas), gap (vão TOTAL em cada corte
  //        interno, gap / 2 de cada lado, com tampa: a Vila usa 0,2), largura(s) (fator de largura pela distância ao começo do
  //        caminho), centroLargura (eixo do afinamento), pontaDegrau:{leste|oeste}, andaresExtra, ordem:[trecho do módulo i],
  //        nos:[{c:[x, z], r, modulo, id}] (tambores), pilares:{passo, r, pontas} (do chão até prof.y0),
  //        arbustos (false | 'teto'), arbustoPasso, arbustoMax, arbustoFora, moitas, ripas, ripaPasso,
  //        decor(faixa) => objetos extras e extraGeo(faixa) => Map<material, geometria> fundida, no nível máximo }
  // this.mods[i] = módulo do jogo i (m.i; m.t = índice do trecho no caminho); this.trechos = os mesmos, na ordem do caminho
  constructor(def) {
    this.def = def; this.id = def.id; this.group = new THREE.Group(); this.group.name = def.id;
    this.L = pathLength(def.path, def.closed);
    const n = def.modulos || 1; const cuts = def.cortes || Array.from({ length: n + 1 }, (_, i) => i / n); const nc = cuts.length - 1;
    this.prof = { fac: 'fac_fita', roof: 'roof', ...def.prof };
    const p = this.prof; this.oc = def.centroLargura ?? (p.o0 + p.o1) / 2; // eixo do perfil (as pontas afinam em torno dele)
    const Lt = def.ponta ?? Math.max(0.35, 0.6 * (p.o1 - p.o0)); const gap = (def.gap ?? 0) / 2; // meio vão de cada lado do corte
    const meio = (c) => (def.aberturaDe?.[def.closed ? c % nc : c] ?? def.abertura ?? 1.2) / 2; // meia largura do vão no corte c
    const LtDe = (c) => def.pontas?.[c] ?? (c === 0 ? def.ponta0 : c === nc ? def.ponta1 : undefined) ?? Lt;
    const ab = new Set(def.aberturas || []); const aberto = (c) => (def.closed ? ab.has(c % nc) : c === 0 || c === nc || ab.has(c));
    const acabada = def.tampa !== false; const trechos = [];
    for (let i = 0; i < nc; i++) {
      const s0 = cuts[i], s1 = cuts[i + 1]; const a0 = aberto(i), a1 = aberto(i + 1); const Lt0 = a0 ? LtDe(i) : 0, Lt1 = a1 ? LtDe(i + 1) : 0;
      const g0 = a0 ? (!def.closed && i === 0 ? 0 : meio(i)) : gap, g1 = a1 ? (!def.closed && i === nc - 1 ? 0 : meio(i + 1)) : gap;
      const { pts, s, L } = subPathDenso(def.path, def.closed, s0 + g0 / this.L, s1 - g1 / this.L, def.passo ?? 0.26, Lt0 > 0 ? Lt0 : 0, Lt1 > 0 ? Lt1 : 0);
      const m0 = s0 * this.L + g0;
      const W = s.map((d) => Math.min(Lt0 > 0 ? pontaFator(d, Lt0) : 1, Lt1 > 0 ? pontaFator(L - d, Lt1) : 1, def.largura ? def.largura(m0 + d) : 1));
      const afina = W.some((w) => w < 0.999);
      // pontas: tampadas (vão ou junta de def.gap); as retas (sem afinamento) com a tampa acabada (t0/t1), as outras
      // com a tampa plana antiga (caps)
      const c0 = a0 || gap > 0, c1 = a1 || gap > 0, t0 = acabada && c0 && !(Lt0 > 0), t1 = acabada && c1 && !(Lt1 > 0), v0 = c0 && !t0, v1 = c1 && !t1;
      trechos.push({ i, t: i, s0, s1, path: pts, W, afina, caps: v0 && v1 ? true : v0 ? 'ini' : v1 ? 'fim' : false, ab0: a0, ab1: a1, c0, c1, t0, t1, u0: s0 * this.L, nivel: 0, emObra: false, degrau: null, nos: [] });
    }
    // ponta em degrau: a ponta afinada mais a leste (ou a oeste) tem os andares de cima terminando antes
    if (def.pontaDegrau) { const cand = []; for (const m of trechos) { if (m.ab0) cand.push([m, 'ini', m.path[0][0]]); if (m.ab1) cand.push([m, 'fim', m.path[m.path.length - 1][0]]); } if (cand.length) { cand.sort((a, b) => b[2] - a[2]); const [m, lado] = def.pontaDegrau.oeste ? cand[cand.length - 1] : cand[0]; m.degrau = lado; } }
    // ordem: o módulo do jogo i fica no trecho ordem[i] do caminho (sem def.ordem, a identidade)
    const ordem = def.ordem || trechos.map((_, t) => t);
    if (ordem.length !== nc || new Set(ordem).size !== nc || ordem.some((t) => !Number.isInteger(t) || t < 0 || t >= nc)) throw new Error('Faixa ' + def.id + ': def.ordem precisa ser uma permutação de 0..' + (nc - 1));
    this.trechos = trechos; this.mods = ordem.map((t, i) => Object.assign(trechos[t], { i }));
    // tambores nos nós: um círculo de 24 lados em volta de c, do módulo do jogo no.modulo
    (def.nos || []).forEach((no, k) => {
      const m = this.mods[no.modulo]; if (!m) throw new Error('Faixa ' + def.id + ': nó ' + k + ' sem o módulo ' + no.modulo);
      const r = no.r ?? 3; const circ = []; for (let j = 0; j < LADOS; j++) { const a = (j / LADOS) * TAU; circ.push([no.c[0] + Math.cos(a) * r, no.c[1] + Math.sin(a) * r]); }
      m.nos.push({ id: no.id, c: no.c, r, modulo: no.modulo, k, circ });
    });
    this.cache = new Map(); this.cacheAndar = new Map();
    this.merged = new THREE.Group(); this.merged.name = def.id + '-fundido'; this.group.add(this.merged);
    this.soltos = new THREE.Group(); this.group.add(this.soltos);
    this.lotes = new THREE.Group(); this.lotes.name = def.id + '-lotes'; this.group.add(this.lotes);
    this.extras = new THREE.Group(); this.group.add(this.extras);
  }
  get max() { return this.def.niveis || 5; }
  // andares da geometria de um módulo no nível n (no máximo entram os andares extras, que a mecânica não conta)
  _Fg(n) { return n >= this.max ? n + (this.def.andaresExtra || 0) : n; }
  // índices [k0, k1] do caminho do módulo cobertos pelo andar f (ponta em degrau: os andares de cima terminam antes)
  _faixaK(m, f, F) { const N = m.path.length; if (!m.degrau || F <= 2 || f < 2) return [0, N - 1]; const k = f >= 4 ? 6 : 4; return m.degrau === 'fim' ? [0, N - 1 - k] : [k, N - 1]; }
  // opções da varredura de um módulo (afinamento das pontas em torno do eixo do perfil); k0 = primeiro índice do trecho
  _opts(m, extra = {}, k0 = 0) { const u0 = m.u0 + (k0 ? this._cum(m)[k0] : 0); return { u0, caps: m.caps, width: m.afina ? (t, k) => m.W[k0 + k] : null, widthCenter: this.oc, ...extra }; }
  _cum(m) { if (!m.cum) m.cum = cumDe(m.path); return m.cum; }
  // um andar do perfil; com prof.y0 > 0 (fita no alto) o térreo ganha a face de baixo
  _floor(f, F) {
    const p = this.prof; const E = (p.celular ? cellFloor : terraceFloor)(f, F, p);
    if (f === 0 && (p.y0 || 0) > 0) { const md = medidas(p); E.push({ a: [p.celular ? p.o0 : md.eI(0), md.base], b: [p.celular ? p.o1 : md.eO(0), md.base], mat: 'fasciaBeiral', uv: 'plan' }); }
    return E;
  }
  _outline(F, f0, f1) { return (this.prof.celular ? cellOutline : terraceOutline)(F, this.prof, f0, f1); }
  // varre os andares (pisos: [[f, arestas]]) no trecho path do módulo (a partir do índice k0). velhas = {ini, fim}:
  // contorno da tampa plana antiga em cada ponta (ou null); pontas = {ini, fim}: {F, pisos, bandas} da tampa acabada
  // (o vidro desses andares recua o beiral na ponta). Sem tampa acabada é a varredura de sempre.
  _varre(m, path, k0, pisos, velhas, pontas = {}) {
    const vi = velhas.ini, vf = velhas.fim, ti = pontas.ini, tf = pontas.fim;
    const plana = (E) => {
      if (!vi || !vf || vi === vf) return sweep(path, false, E, this._opts(m, { caps: vi && vf ? true : vi ? 'ini' : vf ? 'fim' : false, capPoly: vi || vf || undefined }, k0));
      return junta([sweep(path, false, E, this._opts(m, { caps: 'ini', capPoly: vi }, k0)), sweep(path, false, [], this._opts(m, { caps: 'fim', capPoly: vf }, k0))]); // dois contornos: uma varredura só de tampa
    };
    if (!ti && !tf) { const E = []; for (const [, e] of pisos) E.push(...e); return plana(E); }
    const rb = this.prof.celular ? 0 : Math.min(medidas(this.prof).B, pathLength(path, false) * 0.2);
    const Wp = m.afina ? m.W.slice(k0, k0 + path.length) : null, u0 = m.u0 + (k0 ? this._cum(m)[k0] : 0);
    const resto = [], grupos = new Map(); // vidro recuado, por ponta (1 = começo, 2 = fim, 3 = as duas)
    for (const [f, e] of pisos) { const g = (rb > 0 && ti?.pisos.includes(f) ? 1 : 0) + (rb > 0 && tf?.pisos.includes(f) ? 2 : 0); for (const a of e) { if (a.uv !== 'facade' || !g) resto.push(a); else { if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(a); } } }
    const maps = [plana(resto)];
    for (const [g, E] of grupos) { const c = corta(path, Wp, g & 1 ? rb : 0, g & 2 ? rb : 0); maps.push(sweep(c.pts, false, E, { u0: u0 + (g & 1 ? rb : 0), caps: false, width: c.W ? (t, k) => c.W[k] : null, widthCenter: this.oc })); }
    if (ti) maps.push(this._tampa(path, Wp, false, rb, ti)); if (tf) maps.push(this._tampa(path, Wp, true, rb, tf));
    return junta(maps);
  }
  // Tampa acabada numa ponta reta: o vidro dos andares `pisos` recua rb (a varredura recortada vem de _varre) e a cara da
  // ponta é fachada (prof.fac, uv de fachada) entre as lajes; as lajes de `bandas` fecham a ponta com o beiral inteiro e a
  // floreira dando a volta, a loggia do recuo ganha piso e teto e o talude fecha em parede de arrimo. Na parede de
  // células (prof.celular) a ponta fecha rente, com as células, o rodapé e a platibanda.
  _tampa(path, Wp, fim, rb, { F, pisos, bandas, cunhas = [] }) {
    const p = this.prof, md = medidas(p), oc = this.oc, mo = new Molde(), nor = normals(path, false); const R0 = refPonta(path, nor, Wp, fim, 0);
    const P = (R, o, y) => { const oo = oc + (o - oc) * R.w; return [R.x + R.nx * oo, y, R.z + R.nz * oo]; };
    const fora = [R0.tx, 0, R0.tz], dentro = [-R0.tx, 0, -R0.tz], cima = [0, 1, 0], baixo = [0, -1, 0];
    const run = (oa, ob) => [[oa / 1.5, 0], [ob / 1.5, 0], [ob / 1.5, 1], [oa / 1.5, 1]];
    const face = (k, R, oa, ob, ya, yb, n, uv) => mo.quad(k, P(R, oa, ya), P(R, ob, ya), P(R, ob, yb), P(R, oa, yb), n, uv || run(oa, ob));
    if (p.celular) { // parede de células: fecha rente
      if (!pisos.length) return mo.mapa(); const fh = p.fh || FH, base = p.y0 || 0, rep = p.celRep || [7.04, 2.2], aba = p.curbW ?? 0.14, rod = 0.06; const f0 = Math.min(...pisos), f1 = Math.max(...pisos) + 1;
      const ya = f0 === 0 ? base + rod : base + f0 * fh, yt = base + f1 * fh; const v = (y) => (y - base) / rep[1];
      face(p.fac, R0, p.o0, p.o1, ya, yt, fora, [[p.o0 / rep[0], v(ya)], [p.o1 / rep[0], v(ya)], [p.o1 / rep[0], v(yt)], [p.o0 / rep[0], v(yt)]]);
      if (f0 === 0) face('fasciaBeiral', R0, p.o0, p.o1, base, base + rod, fora);
      if (f1 === F) { const yS = yt + (p.celTopo ?? 0.09), yP = yS + (p.celPlat ?? 0.1); face('fasciaBeiral', R0, p.o1 - aba, p.o1, yt, yP, fora); face('fasciaBeiral', R0, p.o0, p.o0 + aba, yt, yP, fora); face('fasciaBeiral', R0, p.o0 + aba, p.o1 - aba, yt, yS, fora); }
      return mo.mapa();
    }
    const { slab, curb, curbW } = md, cm = p.curbMat || 'planter', tl = talude(p, F), vb = md.base + (p.vBase || 0), uR = BAY * 32, vR = FH * 4;
    let Rv = R0; if (rb > 0) { const c = corta(path, Wp, fim ? 0 : rb, fim ? rb : 0); Rv = refPonta(c.pts, normals(c.pts, false), c.W, fim, 0); } // ponta do vidro recuado
    const cd = rb > 0 ? Math.min(curbW, rb * 0.6) : 0, Rc = cd > 0 ? refPonta(path, nor, Wp, fim, cd) : R0; // floreira da ponta
    for (const lv of bandas) { // lajes: a cara da ponta com o beiral e a floreira dando a volta
      const y = md.y(lv), yS = y + slab, yC = yS + curb, tal = tl && lv < tl.T && lv < F, eO = md.eO(lv), eI = tal ? md.gI(lv) : md.eI(lv);
      if (cd > 0) {
        face('fasciaBeiral', R0, eI, eO, y, yC, fora); const fa = tal ? eI : eI + curbW, fb = eO - curbW;
        if (fb - fa > 0.02) { mo.quad(cm, P(R0, fa, yC), P(R0, fb, yC), P(Rc, fb, yC), P(Rc, fa, yC), cima, 'plan'); mo.quad(cm, P(Rc, fa, yS), P(Rc, fb, yS), P(Rc, fb, yC), P(Rc, fa, yC), dentro, run(fa, fb)); }
      } else { face('fasciaBeiral', R0, eI, eO, y, yS, fora); face('fasciaBeiral', R0, eO - curbW, eO, yS, yC, fora); if (!tal) face('fasciaBeiral', R0, eI, eI + curbW, yS, yC, fora); }
    }
    for (const f of pisos) { // andares: o vidro na ponta (recuado), o piso e o teto da loggia, e o talude
      const y = md.y(f), ya = y + slab, yb = md.y(f + 1), gI = md.gI(f), gO = md.gO(f), tal = tl && f < tl.T; const u = (o) => o / uR, v = (yy) => (yy - vb) / vR;
      face(p.fac, Rv, gI, gO, ya, yb, fora, [[u(gI), v(ya)], [u(gO), v(ya)], [u(gO), v(yb)], [u(gI), v(yb)]]);
      if (rb > 0) {
        const Rf = cd > 0 && bandas.includes(f) ? Rc : R0;
        mo.quad('fasciaBeiral', P(Rv, gI, ya), P(Rv, gO, ya), P(Rf, gO, ya), P(Rf, gI, ya), cima, 'plan'); mo.quad('fasciaBeiral', P(Rv, gI, yb), P(Rv, gO, yb), P(R0, gO, yb), P(R0, gI, yb), baixo, 'plan');
        if (tal) mo.quad('fasciaBeiral', P(Rv, gI, ya), P(R0, gI, ya), P(R0, gI, yb), P(Rv, gI, yb), [R0.nx, 0, R0.nz], run(0, rb)); // arrimo ao lado da loggia
      }
      if (tal) { const a = tl.oAt(y), b = tl.oAt(yb); if (a < gI && b < gI) mo.quad('fasciaBeiral', P(R0, a, y), P(R0, gI, y), P(R0, gI, yb), P(R0, b, yb), fora, run(a, gI)); } // cunha do talude
    }
    for (const f of cunhas) { // ao lado de um vizinho sem talude (tampa parcial): só a cunha entre a rampa e o vidro dele
      const y = md.y(f), yb = md.y(f + 1), gI = md.gI(f); if (!tl || f >= tl.T) continue; const a = tl.oAt(y), b = tl.oAt(yb); if (a < gI && b < gI) mo.quad('fasciaBeiral', P(R0, a, y), P(R0, gI, y), P(R0, gI, yb), P(R0, b, yb), fora, run(a, gI));
    }
    return mo.mapa();
  }
  // pilares do chão até prof.y0 (def.pilares {passo, r, pontas}): a cada passo ao longo do módulo, nas duas bordas (o0 +
  // 0,15 e o1 - 0,15) ou só no eixo se a fita tiver menos de 1,6 de largura; pontas: true = de ponta a ponta, o primeiro
  // e o último a 0,15 das pontas (as quinas do portal); uma geometria de concreto (em cache), ou null
  _pil(m) {
    if (m.pil !== undefined) return m.pil; const d = this.def.pilares, p = this.prof, y0 = p.y0 || 0; if (!d || !(y0 > 0)) return (m.pil = null);
    const cum = this._cum(m), L = cum[cum.length - 1], nor = normals(m.path, false), mo = new Molde(), rc = d.pontas ? Math.min(0.15, L / 4) : 0;
    const n = Math.max(1, Math.round((L - 2 * rc) / (d.passo || 1.5))), os = p.o1 - p.o0 < 1.6 ? [this.oc] : [p.o0 + 0.15, p.o1 - 0.15];
    for (let j = 0; j < (d.pontas ? n + 1 : n); j++) {
      const s = d.pontas ? rc + (j * (L - 2 * rc)) / n : ((j + 0.5) * L) / n; let k = 1; while (k < cum.length - 1 && cum[k] < s) k++; const t = (s - cum[k - 1]) / (cum[k] - cum[k - 1] || 1);
      const a = m.path[k - 1], b = m.path[k], x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, w = m.W[k - 1] + (m.W[k] - m.W[k - 1]) * t;
      let nx = nor[k - 1][0] + (nor[k][0] - nor[k - 1][0]) * t, nz = nor[k - 1][1] + (nor[k][1] - nor[k - 1][1]) * t; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      for (const o of os) { const oo = this.oc + (o - this.oc) * w; mo.pilar('concreto', x + nx * oo, z + nz * oo, d.r || 0.07, -0.02, y0); }
    }
    const g = mo.mapa().get('concreto'); g.userData.compartilhada = true; return (m.pil = g);
  }
  // recuo do vidro do andar g num tambor de F andares (só o último, com 2 ou mais)
  _rec(g, F) { return F >= 2 && g === F - 1 ? -RECUO : 0; }
  // Tambor (rotunda no nó, no vocabulário da fita): arestas do andar f de F para varrer no círculo (o = distância para fora
  // do raio do tambor) e os discos. Térreo de vidro âmbar, lajes creme com beiral, floreira na borda a partir da laje 2,
  // último andar recuado com jardim no teto e a lanterna de vidro do átrio (r 1,26, 0,35 acima do teto, aro claro).
  _tamborAndar(no, f, F) {
    const p = this.prof, md = medidas(p), { B, slab, curb, curbW } = md, cm = p.curbMat || 'planter', oL = LANTERNA - no.r; const E = [], D = [];
    const nivel = (lv) => {
      const y = md.y(lv), yS = y + slab, yC = yS + curb, topo = lv === F;
      if (lv === 0) { E.push({ a: [B, y], b: [B, yS], mat: 'fasciaBeiral', uv: 'run' }, { a: [B, yS], b: [this._rec(0, F), yS], mat: 'fasciaBeiral', uv: 'plan' }); return; }
      const g = this._rec(lv - 1, F), e = g + B, gi = topo ? oL : this._rec(lv, F); const piso = (a) => (topo || a - gi > 0.2 ? 'roof' : 'fasciaBeiral'); // jardim no teto e nos terraços largos
      E.push({ a: [g, y], b: [e, y], mat: 'fasciaBeiral', uv: 'plan' });
      if (lv >= 2) E.push({ a: [e, y], b: [e, yC], mat: 'fasciaBeiral', uv: 'run' }, { a: [e, yC], b: [e - curbW, yC], mat: cm, uv: 'plan' }, { a: [e - curbW, yC], b: [e - curbW, yS], mat: cm, uv: 'run' }, { a: [e - curbW, yS], b: [gi, yS], mat: piso(e - curbW), uv: 'plan' });
      else E.push({ a: [e, y], b: [e, yS], mat: 'fasciaBeiral', uv: 'run' }, { a: [e, yS], b: [gi, yS], mat: piso(e), uv: 'plan' });
      if (topo) { // lanterna do átrio: vidro, aro claro, cúpula rasa (topo 0,35 acima do teto y(F), como no plano) e o piso do átrio
        const yT = y + LANT_H, yA = yT - 0.04, yL = yA - 0.04;
        E.push({ a: [oL, yS], b: [oL, yL], mat: 'vidroDossel', uv: 'run' }, { a: [oL + 0.03, yL], b: [oL + 0.03, yA], mat: 'fasciaBeiral', uv: 'run' }, { a: [oL + 0.03, yA], b: [oL - 0.09, yA], mat: 'fasciaBeiral', uv: 'plan' });
        D.push(['vidroDossel', LANTERNA - 0.09, yA, yT, true], ['fasciaBeiral', LANTERNA, yS - 0.02, yS - 0.02, true]);
      }
    };
    nivel(f);
    E.push({ a: [this._rec(f, F), md.y(f) + slab], b: [this._rec(f, F), md.y(f + 1)], mat: f === 0 ? 'fac_ambar' : p.fac, uv: 'facade', vBase: md.base + (p.vBase || 0) });
    if (f === F - 1) nivel(F);
    return { E, D };
  }
  _discos(no, D) { if (!D.length) return null; const mo = new Molde(); for (const [k, r, y, yc, cima] of D) mo.leque(k, no.c, r, y, yc, cima); return mo.mapa(); }
  // geometria do tambor com F andares (a fusão do módulo dono)
  _tamborGeo(no, F) { const E = [], D = []; for (let f = 0; f < F; f++) { const a = this._tamborAndar(no, f, F); E.push(...a.E); D.push(...a.D); } return junta([sweep(no.circ, true, E, {}), this._discos(no, D)]); }
  // andar f de F do tambor para a obra: acabado, esqueleto (laje em disco) e pilares (8 na fachada e 4 no átrio)
  _tamborObra(no, f, F) {
    const { E, D } = this._tamborAndar(no, f, F); const md = medidas(this.prof), g = this._rec(f, F), rr = no.r + g, y = md.y(f), mo = new Molde();
    mo.leque('concreto', no.c, rr, y + 0.07, y + 0.07, true); mo.leque('concreto', no.c, rr, y, y, false);
    const mats = []; for (let j = 0; j < LADOS; j += 3) { const a = (j / LADOS) * TAU; for (const R of j % 6 === 0 ? [rr - 0.06, 1.4] : [rr - 0.06]) mats.push(beamMatrix([no.c[0] + Math.cos(a) * R, y, no.c[1] + Math.sin(a) * R], [no.c[0] + Math.cos(a) * R, y + md.fh, no.c[1] + Math.sin(a) * R])); }
    return { acab: junta([sweep(no.circ, true, E, {}), this._discos(no, D)]), esq: junta([sweep(no.circ, true, [{ a: [g, y], b: [g, y + 0.07], mat: 'concreto', uv: 'run' }], {}), mo.mapa()]), mats };
  }
  // andares (da geometria) dos vizinhos no caminho que ficam abaixo do módulo m nos cortes internos (sem vão nem junta):
  // ali a ponta ganha a tampa acabada dos andares que sobram. null = nenhuma (ou def.tampa = false).
  _viz(m) {
    if (this.def.tampa === false || m.nivel <= 0) return null; const T = this.trechos, n = T.length, F = this._Fg(m.nivel); let ini = null, fim = null;
    const baixo = (j) => { const v = this.def.closed ? T[(j + n) % n] : T[j]; if (!v || v === m) return null; const Fv = v.nivel > 0 ? this._Fg(v.nivel) : 0; return Fv < F ? Fv : null; };
    if (!m.c0) ini = baixo(m.t - 1); if (!m.c1) fim = baixo(m.t + 1);
    return ini == null && fim == null ? null : { ini, fim };
  }
  // geometria de um módulo com F andares (em cache: reaproveitada pela fusão e pela planta), com o tambor e os pilares;
  // viz = _viz(m) (só na fusão): tampas nos cortes internos ao lado de um vizinho mais baixo
  _geo(i, F, viz = null) {
    F = this._Fg(F); const k = i + ':' + F + (viz ? ':' + viz.ini + ':' + viz.fim : '');
    if (viz) { const mv = this.mods[i]; if (mv.vizK && mv.vizK !== k) this.cache.delete(mv.vizK); mv.vizK = k; } // só a última variante com tampa parcial fica em cache
    if (this.cache.has(k)) return this.cache.get(k);
    const m = this.mods[i]; let map; const tudo = (n) => ({ F: n, pisos: faixaDe(0, n), bandas: faixaDe(0, n + 1) });
    const parcial = (n, Fv) => { if (!(Fv > 0)) return tudo(n); const tl = talude(this.prof, n); return { F: n, pisos: faixaDe(Fv, n), bandas: faixaDe(Fv + 1, n + 1), cunhas: tl && Fv <= tl.T ? faixaDe(0, Fv) : [] }; }; // a laje Fv segue no teto do vizinho; se ele não tem talude, a rampa fecha com a cunha
    if (!m.degrau || F <= 2) {
      const pisos = []; for (let f = 0; f < F; f++) pisos.push([f, this._floor(f, F)]); const ol = this._outline(F);
      map = this._varre(m, m.path, 0, pisos, { ini: m.caps === true || m.caps === 'ini' ? ol : null, fim: m.caps === true || m.caps === 'fim' ? ol : null }, { ini: m.t0 ? tudo(F) : viz?.ini != null ? parcial(F, viz.ini) : null, fim: m.t1 ? tudo(F) : viz?.fim != null ? parcial(F, viz.fim) : null });
    } else { // ponta em degrau: trechos com número de andares diferente (como em andar()), cada um com as próprias tampas
      const N = m.path.length, fim = m.degrau === 'fim'; const kc = []; for (let f = 0; f < F; f++) { const [a, b] = this._faixaK(m, f, F); kc.push(fim ? N - 1 - b : a); } // onde cada andar termina, contado da ponta
      const K = [...new Set(kc)].sort((a, b) => a - b), nDe = (j) => kc.filter((v) => v <= K[j]).length; const maps = [];
      const tD = fim ? m.t1 : m.t0, cD = fim ? m.c1 : m.c0, tC = fim ? m.t0 : m.t1, cC = fim ? m.c0 : m.c1, vC = fim ? viz?.ini : viz?.fim;
      for (let j = 0; j < K.length; j++) { // da ponta do degrau para o corpo
        const n = nDe(j), ka = K[j], kb = j + 1 < K.length ? K[j + 1] : null; const i0 = fim ? (kb == null ? 0 : N - 1 - kb) : ka, i1 = fim ? N - 1 - ka : kb == null ? N - 1 : kb;
        const pisos = []; for (let f = 0; f < n; f++) pisos.push([f, this._floor(f, n)]);
        const nA = j ? nDe(j - 1) : 0; let oD = null, pD = null, oC = null, pC = null; // lado do degrau (a ponta ou um degrau) e lado do corpo
        if (j === 0 && cD) { if (tD) pD = tudo(n); else oD = this._outline(n); }
        if (j > 0) { if (tD) pD = parcial(n, nA); else oD = this._outline(n, nA, n); }
        if (kb == null && cC) { if (tC) pC = tudo(n); else oC = this._outline(n); } else if (kb == null && vC != null) pC = parcial(n, vC);
        maps.push(this._varre(m, m.path.slice(i0, i1 + 1), i0, pisos, fim ? { ini: oC, fim: oD } : { ini: oD, fim: oC }, fim ? { ini: pC, fim: pD } : { ini: pD, fim: pC }));
      }
      map = junta(maps);
    }
    const pil = this._pil(m); if (m.nos.length || pil) map = junta([map, ...m.nos.map((no) => this._tamborGeo(no, F)), pil ? new Map([['concreto', pil]]) : null]);
    marca(map); this.cache.set(k, map); return map;
  }
  // reconstrói a malha fundida com todos os módulos que não estão em obra (na ordem do caminho); o fundido anterior
  // (fora do cache) é descartado
  refresh() {
    for (const c of this.merged.children.slice()) { this.merged.remove(c); c.geometry.dispose(); }
    const by = new Map();
    for (const m of this.trechos) { if (m.nivel <= 0) continue; for (const [k, g] of this._geo(m.i, m.nivel, this._viz(m))) { if (!by.has(k)) by.set(k, []); by.get(k).push([g, new THREE.Matrix4()]); } }
    if (this.def.extraGeo && this.mods.every((m) => m.nivel >= this.max)) { // geometria extra do nível máximo, fundida por material (0 chamadas)
      if (!this._extraGeo) { this._extraGeo = this.def.extraGeo(this); for (const g of this._extraGeo.values()) g.userData.compartilhada = true; }
      for (const [k, g] of this._extraGeo) { if (!by.has(k)) by.set(k, []); by.get(k).push([g, new THREE.Matrix4()]); }
    }
    for (const [k, list] of by) { const mesh = new THREE.Mesh(merge(list), matDe(k)); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.matKey = k; this.merged.add(mesh); }
    this._extras(); this._lotes();
  }
  setNivel(i, n) { this.mods[i].nivel = n; this.refresh(); }
  setTodos(n) { for (const m of this.mods) m.nivel = n; this.refresh(); }
  // peças para a obra do andar f (0..) do módulo do jogo i que terá F andares (com o andar f do tambor e, no andar 0, os
  // pilares). As geometrias ficam em cache (marcadas como compartilhadas): abrir a prancha várias vezes não cria
  // geometria nova na GPU.
  andar(i, f, F) {
    const key = i + ':' + f + ':' + F; let c = this.cacheAndar.get(key);
    if (!c) {
      const m = this.mods[i]; const p = this.prof; const fh = p.fh || FH; const y0 = (p.y0 || 0) + f * fh; const N = m.path.length;
      const [k0, k1] = this._faixaK(m, f, F); const path = k0 === 0 && k1 === N - 1 ? m.path : m.path.slice(k0, k1 + 1);
      // pontas da peça: as do módulo e, no andar cortado pelo degrau, o degrau (acabado se a ponta do degrau for reta)
      const ol = this._outline(F, f, f + 1), pt = { F, pisos: [f], bandas: f === F - 1 ? [f, F] : [f] };
      const vI = (k0 > 0 || m.c0) && !m.t0, vF = (k1 < N - 1 || m.c1) && !m.t1;
      let acab = this._varre(m, path, k0, [[f, this._floor(f, F)]], { ini: vI ? ol : null, fim: vF ? ol : null }, { ini: m.t0 ? pt : null, fim: m.t1 ? pt : null });
      let esq = sweep(path, false, skeletonFloor(f, p), this._opts(m, { caps: false }, k0));
      const outer = p.o1 - (p.setOut || 0) * f - 0.06, inner = p.o0 + (p.setIn || 0) * f + 0.06;
      const nor = normals(m.path, false); const mats = [];
      for (let k = k0; k <= k1; k += 3) { const [x, z] = m.path[k], [nx, nz] = nor[k]; const w = m.W[k]; for (const o of [outer, inner]) { const oo = this.oc + (o - this.oc) * w; mats.push(beamMatrix([x + nx * oo, y0, z + nz * oo], [x + nx * oo, y0 + fh, z + nz * oo])); } }
      const tb = m.nos.map((no) => this._tamborObra(no, f, F)), pil = f === 0 ? this._pil(m) : null;
      if (tb.length || pil) { acab = junta([acab, ...tb.map((t) => t.acab), pil ? new Map([['concreto', pil]]) : null]); esq = junta([esq, ...tb.map((t) => t.esq)]); for (const t of tb) mats.push(...t.mats); }
      c = { acab: marca(acab), esq: marca(esq), mats }; this.cacheAndar.set(key, c);
    }
    const acabado = new THREE.Group(); const esqueleto = new THREE.Group();
    for (const [k, g] of c.acab) { const mesh = new THREE.Mesh(g, matDe(k)); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.matKey = k; acabado.add(mesh); }
    for (const g of c.esq.values()) { const mesh = new THREE.Mesh(g, M.concreto); mesh.castShadow = true; esqueleto.add(mesh); }
    const im = new THREE.InstancedMesh(vigaGeo(), M.concreto, c.mats.length); c.mats.forEach((mt, k) => im.setMatrixAt(k, mt)); im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); esqueleto.add(im);
    esqueleto.visible = false;
    return { acabado, esqueleto, caminho: { path: this.mods[i].path, closed: false, o: this.prof.o1 + 0.2 } };
  }
  // contorno do lote vazio (planta no chão, virada para cima), com o do tambor
  _lotes() {
    for (const c of this.lotes.children.slice()) { this.lotes.remove(c); c.geometry?.dispose(); }
    const p = this.prof; const y = (p.y0 || 0) + 0.035;
    for (const m of this.trechos) {
      if (m.nivel > 0 || m.emObra || !m.lote) continue;
      const E = [{ a: [p.o1, y], b: [p.o0, y], mat: 'fill', uv: 'plan' }];
      const E2 = [{ a: [p.o1, y + 0.003], b: [p.o1 - 0.16, y + 0.003], mat: 'line', uv: 'plan' }, { a: [p.o0 + 0.16, y + 0.003], b: [p.o0, y + 0.003], mat: 'line', uv: 'plan' }];
      let map = sweep(m.path, false, [...E, ...E2], this._opts(m, { caps: false }));
      if (m.nos.length) map = junta([map, ...m.nos.map((no) => { const mo = new Molde(); mo.leque('fill', no.c, no.r, y, y, true); return junta([mo.mapa(), sweep(no.circ, true, [{ a: [0, y + 0.003], b: [-0.16, y + 0.003], mat: 'line', uv: 'plan' }], {})]); })]);
      for (const [k, g] of map) { const mesh = new THREE.Mesh(g, k === 'line' ? M.loteLinha : M.loteFill); mesh.renderOrder = 3; this.lotes.add(mesh); }
    }
  }
  // Vegetação das floreiras (arbustos na borda de cada beiral, pendendo para fora; por dentro em grupos de 3; moitas
  // maiores nos terraços largos e no talude; mais uma fileira nas bordas da cobertura), ripas de madeira na fachada
  // externa e a decoração do nível máximo (def.decor). Tudo instanciado por fita: 1 chamada para os arbustos, 1 para
  // as ripas. def.arbustos: false (nada) ou 'teto' (só a cobertura); def.arbustoFora = fração das floreiras externas
  // plantadas nos andares intermediários; def.moitas = moitas e árvores pequenas (Anel). Os tambores entram na mesma
  // fila (floreiras a partir da laje 2 e o jardim do teto).
  _extras() {
    for (const c of this.extras.children.slice()) { this.extras.remove(c); if (!c.userData.keep) c.traverse((o) => o.isInstancedMesh && o.dispose()); }
    const p = this.prof; const md = medidas(p); const arb = [], rip = []; const passo = this.def.arbustoPasso ?? 0.75; const oc = this.oc; const modo = this.def.arbustos;
    // uma fileira de arbustos no deslocamento o, altura y ao longo de P (normais nor, comprimentos cum, largura W; id =
    // semente): lado (±1) pende para fora; chance = fração dos pontos plantados; grupo = tufos por ponto; escala =
    // [mín, máx]; k0..k1 = trecho do caminho
    const filaDe = (P, nor, cum, W, id) => (o, y, lado, sd, esp, dy0 = 0, chance = 1, grupo = 1, escala = [0.10, 0.16], k0 = 0, k1 = P.length - 1) => {
      let prox = cum[k0] + hash(sd, id, 71) * esp;
      for (let k = k0; k <= k1; k++) {
        if (cum[k] < prox) continue; prox = cum[k] + esp * (0.75 + hash(k, sd, 72) * 0.5);
        const w = W[k]; if (w < 0.5) continue; if (chance < 1 && hash(k, sd, 75) > chance) continue; // nas pontas afinadas a floreira some
        const [x, z] = P[k], [nx, nz] = nor[k]; const tx = -nz, tz = nx;
        for (let g = 0; g < grupo; g++) {
          const h = hash(k + g * 31, sd * 7 + id * 13, 73); const pende = lado && g === 0 && h < 0.6; const oo = oc + (o - oc) * w + (pende ? 0.05 * lado : 0) + (g ? (hash(k, g, 78) - 0.5) * 0.12 : 0), dt = g ? (hash(k, g, 79) - 0.5) * 0.36 : 0;
          arb.push([x + nx * oo + tx * dt, y + dy0 + (pende ? -0.05 : 0), z + nz * oo + tz * dt, escala[0] + hash(k + g, sd, 74) * (escala[1] - escala[0]), h]);
        }
      }
    };
    for (const m of this.trechos) {
      if (m.nivel <= 0) continue; const F = this._Fg(m.nivel); const nor = normals(m.path, false); const N = m.path.length; const cum = this._cum(m);
      const fila = filaDe(m.path, nor, cum, m.W, m.t);
      if (modo !== false) {
        const tl = talude(p, F); const fora = this.def.arbustoFora ?? 1;
        if (modo !== 'teto' && !p.celular) for (let lv = 1; lv <= F; lv++) {
          const y = md.y(lv) + md.slab + md.curb; const [k0, k1] = this._faixaK(m, lv - 1, F);
          fila(md.eO(lv) - md.curbW / 2, y, 1, lv * 2, passo, 0, lv < F ? fora : 1, 1, [0.10, 0.16], k0, k1);
          if (!tl || lv > tl.T) fila(md.eI(lv) + md.curbW / 2, y, -1, lv * 2 + 1, passo, 0, 1, this.def.moitas ? 3 : 1, [0.10, 0.16], k0, k1);
          if (this.def.moitas && lv < F && (!tl || lv > tl.T)) { const g = md.gI(lv), wT = g - md.eI(lv) - md.curbW; if (wT > 0.4) fila(g - 0.29, md.y(lv) + md.slab, 0, lv * 2 + 40, passo * 1.8, 0, 0.7, 1, [0.18, 0.30], k0, k1); } // moitas no meio do terraço largo
        }
        if (tl && this.def.moitas) { const ym = (tl.yB + tl.yT) / 2; fila(tl.oAt(ym), ym - 0.02, 0, 44, passo * 1.4, 0, 0.8, 1, [0.16, 0.28]); fila(tl.oAt(tl.yB + (tl.yT - tl.yB) * 0.22), tl.yB + (tl.yT - tl.yB) * 0.22 - 0.02, 0, 45, passo * 2.2, 0, 0.6, 1, [0.14, 0.22]); } // moitas e árvores pequenas no talude
        // cobertura: fileira(s) por dentro das floreiras, fora do passeio (teto largo)
        const a = md.eO(F) - md.curbW, b = md.eI(F) + md.curbW; const [k0, k1] = this._faixaK(m, F - 1, F);
        if (p.celular) { const yS = md.y(F) + (p.celTopo ?? 0.09); fila(a - 0.16, yS, 0, 90, passo, 0, 1, 1, [0.10, 0.16], k0, k1); fila(b + 0.16, yS, 0, 91, passo, 0, 1, 1, [0.10, 0.16], k0, k1); }
        else if (a - b > 0.8) { const y = md.y(F) + md.slab; if (this.def.moitas) fila(b + 0.35, y, 0, 90, 2.4, 0, 1, 1, [0.32, 0.45], k0, k1); else { fila(a - 0.16, y, 0, 90, passo * 1.6, 0, 1, 1, [0.10, 0.16], k0, k1); fila(b + 0.16, y, 0, 91, passo * 1.6, 0, 1, 1, [0.10, 0.16], k0, k1); } }
        for (const no of m.nos) { // tambor: floreiras das lajes (a partir da 2) e o jardim do teto, entre a floreira e a lanterna
          const nt = normals(no.circ, true), ft = filaDe(no.circ, nt, cumDe(no.circ), no.circ.map(() => 1), 97 + no.k * 7);
          if (modo !== 'teto') for (let lv = 2; lv <= F; lv++) ft(this._rec(lv - 1, F) + md.B - md.curbW / 2, md.y(lv) + md.slab + md.curb, 1, 300 + lv * 2, passo, 0, lv < F ? fora : 1);
          const e = this._rec(F - 1, F) + md.B - (F >= 2 ? md.curbW : 0); ft((e + LANTERNA - no.r) / 2, md.y(F) + md.slab, 0, 390, passo * 1.6);
        }
      }
      if (this.def.ripas !== false && !p.celular) {
        const rb = Math.min(md.B, cum[N - 1] * 0.2), vz = this._viz(m); // nada de ripa no recuo da tampa acabada
        for (let f = 0; f < F; f++) {
          const g = md.gO(f) + 0.012, y0 = md.y(f) + md.slab, h = md.fh - md.slab; const [k0, k1] = this._faixaK(m, f, F); let prox = cum[k0] + 0.17; const rp = this.def.ripaPasso ?? 0.34;
          const ri = m.t0 || (vz?.ini != null && f >= vz.ini), rf = m.t1 || (vz?.fim != null && f >= vz.fim);
          for (let k = k0; k <= k1; k++) { if (cum[k] < prox) continue; prox = cum[k] + rp; const w = m.W[k]; if (w < 0.6) continue; if ((ri && cum[k] < rb) || (rf && cum[k] > cum[N - 1] - rb)) continue; const oo = oc + (g - oc) * w; const [x, z] = m.path[k], [nx, nz] = nor[k]; rip.push([x + nx * oo, y0, z + nz * oo, h, Math.atan2(nx, nz)]); }
        }
      }
    }
    const max = this.def.arbustoMax ?? 1300; const lista = arb.length > max ? arb.filter((_, i) => i % Math.ceil(arb.length / max) === 0) : arb;
    if (lista.length) {
      const im = new THREE.InstancedMesh(tufoGeo(), leafMaterial(), lista.length);
      lista.forEach(([x, y, z, s, h], i) => {
        _e.set((hash(i, 1, 76) - 0.5) * 0.3, h * 6.28, (hash(i, 2, 76) - 0.5) * 0.3); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(s * (0.9 + hash(i, 3, 76) * 0.3), s * 0.85, s * (0.9 + hash(i, 4, 76) * 0.3));
        im.setMatrixAt(i, _m4.compose(_p, _q, _s)); const c = JARDIM[(h * JARDIM.length) | 0], v = 0.85 + hash(i, 5, 77) * 0.3; im.setColorAt(i, _c.setRGB(c[0] * v, c[1] * v, c[2] * v));
      });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); im.name = this.id + '-arbustos'; this.extras.add(im);
    }
    if (rip.length) {
      const im = new THREE.InstancedMesh(ripaGeo(), matDe('ripa'), rip.length);
      rip.forEach(([x, y, z, h, ry], i) => { _e.set(0, ry, 0); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(0.022, h, 1); im.setMatrixAt(i, _m4.compose(_p, _q, _s)); });
      im.instanceMatrix.needsUpdate = true; im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); im.name = this.id + '-ripas'; this.extras.add(im);
    }
    if (this.def.decor && this.mods.every((m) => m.nivel >= this.max)) { if (!this._decor) { this._decor = new THREE.Group(); this._decor.name = this.id + '-decor'; this._decor.userData.keep = true; for (const o of this.def.decor(this)) this._decor.add(o); } this.extras.add(this._decor); }
  }
  // Passeio claro do teto (para as pessoas): polilinhas [x, y, z] pelo meio da cobertura dos módulos
  // prontos, na ordem do caminho; módulos vizinhos no mesmo nível viram uma linha só (não através dos vãos nem das
  // juntas). Vazio se a fita não tem passeio.
  caminhoTeto() {
    const p = this.prof; if (p.roof !== 'roof' || p.passeio === false) return [];
    const fh = p.fh || FH; const out = []; let cur = null, nivCur = -1; const T = this.trechos;
    for (const m of T) {
      const F = this._Fg(m.nivel); const pt = F > 0 ? passeioTeto(F, p) : null; if (!pt) { cur = null; nivCur = -1; continue; }
      const o = (pt[0] + pt[1]) / 2, y = (p.y0 || 0) + F * fh + 0.09; const nor = normals(m.path, false); const [k0, k1] = this._faixaK(m, F - 1, F);
      const ks = []; for (let k = k0; k < k1; k += 2) ks.push(k); ks.push(k1); // um ponto a cada 2, e sempre o último
      const pts = ks.map((k) => { const oo = this.oc + (o - this.oc) * m.W[k]; return [+(m.path[k][0] + nor[k][0] * oo).toFixed(3), y, +(m.path[k][1] + nor[k][1] * oo).toFixed(3)]; });
      if (cur && nivCur === F && !m.c0) cur.push(...pts.slice(1)); else { cur = pts; out.push(cur); } nivCur = F;
    }
    if (this.def.closed && out.length > 1 && !T[0].c0 && T[0].nivel === T[T.length - 1].nivel && T[0].nivel > 0) { const ult = out.pop(); out[0] = [...ult, ...out[0].slice(1)]; }
    return out.filter((l) => l.length > 1);
  }
  // centro aproximado do módulo do jogo i (para balões e câmera)
  centro(i) { const m = this.mods[i]; const q = m.path[(m.path.length / 2) | 0]; const nor = normals(m.path, false)[(m.path.length / 2) | 0]; const o = (this.prof.o0 + this.prof.o1) / 2; return [q[0] + nor[0] * o, q[1] + nor[1] * o]; }
  alturaTopo(n) { const p = this.prof; return (p.y0 || 0) + this._Fg(n) * (p.fh || FH) + 0.1; }
  // caixa (THREE.Box3) do módulo do jogo i pronto no nível n (o atual por padrão; no máximo com os andares extras): o
  // trecho com o beiral e o pé do talude, a floreira do teto, o tambor com a lanterna e os pilares até o chão. Para o
  // toque (mundo.js) e a caixa da obra (obra.js).
  caixa(i, n) {
    const m = this.mods[i], p = this.prof, md = medidas(p); n = Math.max(0, n ?? m.nivel); const F = n > 0 ? this._Fg(n) : 0, tl = F > 0 ? talude(p, F) : null;
    const nor = normals(m.path, false), b = new THREE.Box3(), v = new THREE.Vector3(); const B = p.celular ? 0 : md.B, oI = Math.min(p.o0 - B, tl ? tl.base : Infinity); // o pé do talude passa do beiral
    m.path.forEach((q, k) => { for (const o of [oI, p.o1 + B]) { const oo = this.oc + (o - this.oc) * m.W[k]; b.expandByPoint(v.set(q[0] + nor[k][0] * oo, 0, q[1] + nor[k][1] * oo)); } });
    for (const no of m.nos) { const R = no.r + md.B; b.expandByPoint(v.set(no.c[0] - R, 0, no.c[1] - R)); b.expandByPoint(v.set(no.c[0] + R, 0, no.c[1] + R)); }
    const topo = F > 0 ? (p.celular ? md.y(F) + (p.celTopo ?? 0.09) + (p.celPlat ?? 0.1) : md.y(F) + md.slab + md.curb) : 0; // floreira da cobertura ou platibanda
    b.min.y = (this._pil(m) ? 0 : p.y0 || 0) - 0.05; b.max.y = Math.max(this.alturaTopo(n), topo, m.nos.length && F > 0 ? md.y(F) + LANT_H : 0); return b;
  }
  // pegada no chão do módulo do jogo i: lista de polígonos [[x, z], ...] (o trecho, de o0 a o1 com o afinamento, e
  // depois cada tambor, no círculo de 24 lados do raio r)
  pegada(i) {
    const m = this.mods[i], p = this.prof, nor = normals(m.path, false); const lado = (o) => m.path.map((q, k) => { const oo = this.oc + (o - this.oc) * m.W[k]; return [q[0] + nor[k][0] * oo, q[1] + nor[k][1] * oo]; });
    return [[...lado(p.o1), ...lado(p.o0).reverse()], ...m.nos.map((no) => no.circ.map((q) => [q[0], q[1]]))];
  }
  // o ponto (x, z) cai no módulo do jogo i (no trecho ou no tambor, com o beiral)? Com y, também entre o chão da peça
  // e o topo no nível atual. Ajuda o acerto exato do toque (mundo._faixaHit).
  dentro(i, x, z, y) {
    const m = this.mods[i], p = this.prof, md = medidas(p);
    if (y != null) { const b = this.caixa(i); if (y < b.min.y || y > b.max.y) return false; }
    for (const no of m.nos) if (Math.hypot(x - no.c[0], z - no.c[1]) <= no.r + md.B) return true;
    const P = m.path, n = P.length, nor = normals(P, false); let kb = 0, db = 1e9; for (let k = 0; k < n; k++) { const q = (x - P[k][0]) ** 2 + (z - P[k][1]) ** 2; if (q < db) { db = q; kb = k; } }
    const dx = x - P[kb][0], dz = z - P[kb][1]; if ((kb === 0 || kb === n - 1) && Math.abs(dx * nor[kb][1] - dz * nor[kb][0]) > 0.15) return false; // além da ponta
    const off = dx * nor[kb][0] + dz * nor[kb][1], w = m.W[kb], B = p.celular ? 0 : md.B; return off >= this.oc + (p.o0 - B - this.oc) * w && off <= this.oc + (p.o1 + B - this.oc) * w;
  }
}
