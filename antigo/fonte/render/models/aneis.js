// Os edifícios-fita do Trevo da Holding (plano mestre, revisão 6): todas as fitas saem de A (planta.js), com caminho,
// módulos, cortes, vãos, ordem, tambores e alturas de lá. Anel Mestre: o Anel de moradia pelo sul (8 módulos, terraços
// que descem para o lago, talude de 2 andares, passeio claro no teto, tambores SO e SE nos módulos 4 e 5) e a Sede da
// Holding na coroa norte (varandas brancas contínuas, a fita mais alta, portal de 3,6 no eixo, tambores NO e NE nos
// módulos 0 e 3). Folhas em gota: Escola a sudoeste (guarda-corpos coloridos no último pavimento), Universidade a
// sudeste (Engenharia com o dossel solar no rabo norte, Campus Universitário em parede de células com 5 torres no arco
// externo, Instituto com o dossel verde e jardins verticais no rabo sul), Anel da Biblioteca a noroeste (degraus para
// fora, colmeia por dentro) e Santuário a nordeste (fachada âmbar, friso claro). Contorno: Humanidades (terraço de
// esculturas) e Vila (casas brancas com janelas e telhado de duas águas por casa) abraçando a praça, com a ponta junto à
// colunata em degrau, e a Ala em Onda e o Elo Norte nos vales. Toda ponta é reta, com a tampa acabada; tambores,
// vegetação, ripas e tampas em faixa.js.
import * as THREE from 'three';
import { sweep, normals, merge, medidas, passeioTeto, FH, BAY } from '../geom.js';
import { A } from '../../data/planta.js';
import { Faixa, matDe } from './faixa.js';
import { leafMaterial } from '../forest.js';
import { hash } from '../../core/util.js';

const I4 = new THREE.Matrix4(), TAU = Math.PI * 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
// junta mapas material -> geometria (uma geometria por material) e marca as geometrias como compartilhadas (cache)
function junta(maps) { const por = new Map(); for (const mp of maps) if (mp) for (const [k, g] of mp) { if (!por.has(k)) por.set(k, []); por.get(k).push([g, I4]); } const out = new Map(); for (const [k, l] of por) out.set(k, l.length === 1 ? l[0][0] : merge(l)); return out; }
const marca = (map) => { for (const g of map.values()) g.userData.compartilhada = true; return map; };
const cumDe = (P) => { const c = [0]; for (let k = 1; k < P.length; k++) c.push(c[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1])); return c; };
// ponto do caminho P a s do começo: posição, normal (para fora) e tangente
function amostra(P, nor, cum, s) {
  let k = 1; while (k < P.length - 1 && cum[k] < s) k++; const t = Math.min(1, Math.max(0, (s - cum[k - 1]) / (cum[k] - cum[k - 1] || 1)));
  const a = P[k - 1], b = P[k]; let nx = nor[k - 1][0] + (nor[k][0] - nor[k - 1][0]) * t, nz = nor[k - 1][1] + (nor[k][1] - nor[k - 1][1]) * t; const ln = Math.hypot(nx, nz) || 1, lt = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, nx: nx / ln, nz: nz / ln, tx: (b[0] - a[0]) / lt, tz: (b[1] - a[1]) / lt };
}
// pedaço do caminho P entre s0 e s1 (pontas interpoladas)
function recorte(P, cum, s0, s1) {
  const em = (s) => { let k = 1; while (k < P.length - 1 && cum[k] < s) k++; const t = Math.min(1, Math.max(0, (s - cum[k - 1]) / (cum[k] - cum[k - 1] || 1))); return [P[k - 1][0] + (P[k][0] - P[k - 1][0]) * t, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * t]; };
  const out = [em(s0)]; for (let k = 0; k < P.length; k++) if (cum[k] > s0 + 0.02 && cum[k] < s1 - 0.02) out.push(P[k]); out.push(em(s1)); return out;
}
// peças soltas (quadriláteros e primitivas do three já posicionadas): Map material -> BufferGeometry
class Pecas {
  constructor() { this.q = new Map(); this.g = new Map(); }
  // quadrilátero a b c d com a normal n (os triângulos seguem n) e uv [[u, v] x 4]
  quad(k, a, b, c, d, n, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    let B = this.q.get(k); if (!B) this.q.set(k, (B = { p: [], n: [], uv: [], i: [] })); const i0 = B.p.length / 3;
    [a, b, c, d].forEach((v, j) => { B.p.push(v[0], v[1], v[2]); B.n.push(n[0], n[1], n[2]); B.uv.push(uv[j][0], uv[j][1]); });
    const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], e2 = [d[0] - b[0], d[1] - b[1], d[2] - b[2]]; const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) B.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); else B.i.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2);
  }
  // primitiva do three (posição, normal, uv) com a matriz m
  prim(k, geo, m) { if (!this.g.has(k)) this.g.set(k, []); this.g.get(k).push([geo, m.clone()]); }
  mapa() {
    const out = new Map();
    for (const [k, B] of this.q) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2)); g.setIndex(B.i); out.set(k, g); }
    for (const [k, l] of this.g) { const g = merge(l); out.set(k, out.has(k) ? merge([[out.get(k), I4], [g, I4]]) : g); for (const [p] of l) p.dispose(); }
    for (const g of out.values()) { g.computeBoundingSphere(); g.computeBoundingBox(); }
    return out;
  }
}
// verdes do jardim (os mesmos dos arbustos das fitas) e um tufo de folhagem de 6 triângulos (pirâmide hexagonal achatada)
const JARDIM = [[0.12, 0.24, 0.045], [0.085, 0.2, 0.04], [0.15, 0.26, 0.055], [0.19, 0.25, 0.045]];
let _tufo = null;
function tufoGeo() {
  if (_tufo) return _tufo; const P = [0, 0.75, 0], N = [0, 1, 0], C = [0.98, 1.04, 0.94], I = [];
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU, r = 0.85 + hash(k, 5, 3) * 0.3, l = Math.hypot(0.75, 0.66); P.push(Math.cos(a) * r, (hash(k, 5, 4) - 0.5) * 0.1, Math.sin(a) * r); N.push((Math.cos(a) * 0.75) / l, 0.66 / l, (Math.sin(a) * 0.75) / l); const v = 0.5 + hash(k, 5, 6) * 0.12; C.push(v * 0.94, v, v * 0.9); }
  for (let k = 0; k < 6; k++) I.push(0, 1 + ((k + 1) % 6), 1 + k);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  g.computeBoundingSphere(); g.userData.compartilhada = true; return (_tufo = g);
}

// ---------------------------------------------------------------- Faixa com peças por módulo
// def.porModulo(faixa, m, F, f0, f1) => Map material -> geometria dos andares f0..f1-1 do módulo m com F andares (ou
// null): entra na geometria do módulo (fusão, planta e fantasma), no andar da obra e na caixa. A Vila usa para as janelas
// das casas e o telhado de duas águas de cada casa quando ela chega ao nível máximo (sem os arbustos que ele cobre).
class FaixaMod extends Faixa {
  _extra(i, F) { this._ex ??= new Map(); const k = i + ':' + F; if (!this._ex.has(k)) { const mp = this.def.porModulo(this, this.mods[i], F, 0, F); this._ex.set(k, mp && mp.size ? marca(mp) : null); } return this._ex.get(k); }
  _geo(i, F, viz = null) {
    const g = super._geo(i, F, viz); if (!(F > 0)) return g; this._mix ??= new WeakMap(); let r = this._mix.get(g);
    if (!r) { const ex = this._extra(i, this._Fg(F)); r = ex ? marca(junta([g, ex])) : g; this._mix.set(g, r); }
    return r;
  }
  andar(i, f, F) {
    const a = super.andar(i, f, F); this._exA ??= new Map(); const k = i + ':' + f + ':' + F;
    if (!this._exA.has(k)) { const mp = this.def.porModulo(this, this.mods[i], F, f, f + 1); this._exA.set(k, mp && mp.size ? marca(mp) : null); }
    const ex = this._exA.get(k); if (ex) for (const [mk, g] of ex) { const o = new THREE.Mesh(g, matDe(mk)); o.castShadow = true; o.receiveShadow = true; o.userData.matKey = mk; a.acabado.add(o); }
    return a;
  }
  caixa(i, n) {
    const b = super.caixa(i, n); n = Math.max(0, n ?? this.mods[i].nivel); if (!(n > 0)) return b;
    const ex = this._extra(i, this._Fg(n)); if (ex) for (const g of ex.values()) { if (!g.boundingBox) g.computeBoundingBox(); b.max.y = Math.max(b.max.y, g.boundingBox.max.y); }
    return b;
  }
  // o telhado da casa no nível máximo cobre a cobertura: tira os arbustos do teto e do parapeito de cima (ficariam sob o
  // telhado ou furando os beirais dele); só as casas no máximo têm arbustos nessa altura
  _extras() {
    super._extras(); const yT = medidas(this.prof).y(this._Fg(this.max)) - 0.1, im = this.extras.children.find((o) => o.name === this.id + '-arbustos'); if (!im) return;
    let n = 0; for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, _m); if (_m.elements[13] >= yT) continue; if (n !== i) { im.setMatrixAt(n, _m); im.getColorAt(i, _c); im.setColorAt(n, _c); } n++; }
    if (n < im.count) { im.count = n; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
  }
}

// ---------------------------------------------------------------- decoração
// Escola: guarda-corpos coloridos no último pavimento, faixas finas (0,12) de pé sobre as floreiras das duas bordas da
// laje, em trechos de 1,2 que se revezam em laranja, amarelo e azul-piscina; param antes das pontas (tampa acabada)
const CORES_ESCOLA = ['orange', 'yellow', 'teal'];
function guardaCorpos(F) {
  const p = F.prof, md = medidas(p), Fg = F._Fg(F.max), f = Fg - 1, y0 = md.y(f) + md.slab + md.curb, y1 = y0 + 0.12, e = 0.025, seg = 1.2, maps = [];
  const oO = md.eO(f) - 0.004, oI = md.eI(f) + 0.004;
  const fora = (k) => [{ a: [oO, y0], b: [oO, y1], mat: k, uv: 'run' }, { a: [oO, y1], b: [oO - e, y1], mat: k, uv: 'plan' }, { a: [oO - e, y1], b: [oO - e, y0], mat: k, uv: 'run' }];
  const dentro = (k) => [{ a: [oI, y1], b: [oI, y0], mat: k, uv: 'run' }, { a: [oI + e, y1], b: [oI, y1], mat: k, uv: 'plan' }, { a: [oI + e, y0], b: [oI + e, y1], mat: k, uv: 'run' }];
  for (const m of F.trechos) {
    const [k0, k1] = F._faixaK(m, f, Fg), P = m.path, N = P.length, cum = m.cum || cumDe(P); const a = cum[k0] + (k0 > 0 || m.c0 ? 0.16 : 0), b = cum[k1] - (k1 < N - 1 || m.c1 ? 0.16 : 0); if (b - a < 0.3) continue;
    const cortes = [a]; for (let s = Math.ceil((m.u0 + a) / seg) * seg - m.u0; s < b - 0.05; s += seg) if (s > a + 0.05) cortes.push(s); cortes.push(b);
    for (let j = 0; j + 1 < cortes.length; j++) {
      const s0 = cortes[j], s1 = cortes[j + 1], k = CORES_ESCOLA[Math.floor((m.u0 + (s0 + s1) / 2) / seg) % CORES_ESCOLA.length], pts = recorte(P, cum, s0, s1), caps = j === 0 && j === cortes.length - 2 ? true : j === 0 ? 'ini' : j === cortes.length - 2 ? 'fim' : false;
      maps.push(sweep(pts, false, fora(k), { caps }), sweep(pts, false, dentro(k), { caps }));
    }
  }
  return junta(maps);
}
// Dossel guarda-chuva do MODELO-02 sobre o teto (Engenharia e Instituto): haste fina do teto até o capitel, copa rasa em
// funil (centro em y0, borda em topo) com a borda clara; 'solar' = painéis solares em pétalas com 12 nervuras claras,
// 'verde' = jardim com floreira na borda (as moitas vêm de moitasDossel)
function dossel(F, d) {
  const md = medidas(F.prof), yT = md.y(F._Fg(F.max)) + md.slab, { r, y0, topo } = d, rh = d.haste, rc = 1.0, solar = d.mat === 'solar';
  const circ = []; for (let j = 0; j < 24; j++) { const a = (j / 24) * TAU; circ.push([d.c[0] + Math.cos(a) * rc, d.c[1] + Math.sin(a) * rc]); }
  const o = (rr) => rr - rc, borda = solar ? 'fasciaBeiral' : 'planter';
  const E = [
    { a: [o(rh), yT - 0.02], b: [o(rh), y0 - 0.16], mat: 'fasciaBeiral', uv: 'run' },            // haste
    { a: [o(rh), y0 - 0.16], b: [o(0.42), y0], mat: 'fasciaBeiral', uv: 'run' },                  // capitel
    { a: [o(0.42), y0], b: [o(r), topo - 0.05], mat: 'fasciaBeiral', uv: 'plan' },                 // fundo da copa
    { a: [o(r), topo - 0.05], b: [o(r), topo], mat: borda, uv: 'run' },                            // borda
    { a: [o(r), topo], b: [o(r - 0.07), topo], mat: borda, uv: 'plan' },
    { a: [o(r - 0.07), topo], b: [o(r - 0.07), topo - 0.02], mat: borda, uv: 'run' },
    { a: [o(r - 0.07), topo - 0.02], b: [o(0.02), y0 + 0.05], mat: solar ? 'solar' : 'roof', uv: 'plan' }, // painéis ou jardim
  ];
  const maps = [sweep(circ, true, E, {})];
  if (solar) { // nervuras: 12 réguas claras sobre os painéis, do centro à borda
    const pc = new Pecas(), yA = (rr) => y0 + 0.05 + ((topo - 0.07 - y0) * (rr - 0.02)) / (r - 0.09) + 0.012;
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * TAU, ux = Math.cos(a), uz = Math.sin(a), vx = -uz * 0.025, vz = ux * 0.025, P = (rr, s) => [d.c[0] + ux * rr + vx * s, yA(rr), d.c[1] + uz * rr + vz * s];
      pc.quad('fasciaBeiral', P(0.12, -1), P(r - 0.07, -1), P(r - 0.07, 1), P(0.12, 1), [0, 1, 0]);
    }
    maps.push(pc.mapa());
  }
  return junta(maps);
}
// moitas no jardim do dossel verde: tufos de folhagem (o material das copas das fitas) em dois anéis
function moitasDossel(d) {
  const { r, y0, topo } = d, lista = []; const yA = (rr) => y0 + 0.05 + ((topo - 0.07 - y0) * (rr - 0.02)) / (r - 0.09);
  for (const [rr, n, s0] of [[0.38, 6, 0.2], [0.82, 10, 0.17]]) for (let j = 0; j < n; j++) { const a = ((j + hash(j, n, 81) * 0.4) / n) * TAU; lista.push([d.c[0] + Math.cos(a) * rr, yA(rr), d.c[1] + Math.sin(a) * rr, s0 + hash(j, n, 82) * 0.06, hash(j, n, 83)]); }
  const im = new THREE.InstancedMesh(tufoGeo(), leafMaterial(), lista.length);
  lista.forEach(([x, y, z, s, h], i) => { _e.set(0, h * 6.28, 0); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(s, s * 0.85, s); im.setMatrixAt(i, _m.compose(_p, _q, _s)); const c = JARDIM[(h * JARDIM.length) | 0], v = 0.85 + hash(i, 5, 77) * 0.3; im.setColorAt(i, _c.setRGB(c[0] * v, c[1] * v, c[2] * v)); });
  im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); im.name = 'moitas-dossel';
  return [im];
}
// Instituto: jardins verticais na face interna (painéis verdes de 0,22 a cada 0,7 diante do vidro de cada andar, fora
// do recuo da tampa acabada das pontas)
function jardinsVerticais(F) {
  const p = F.prof, md = medidas(p), Fg = F._Fg(F.max), pc = new Pecas();
  for (const m of F.trechos) {
    const P = m.path, N = P.length, cum = m.cum || cumDe(P), nor = normals(P, false), rb = Math.min(md.B, cum[N - 1] * 0.2);
    for (let f = 0; f < Fg; f++) {
      const [k0, k1] = F._faixaK(m, f, Fg); const a = cum[k0] + rb + 0.2, b = cum[k1] - rb - 0.2; if (b - a < 0.5) continue;
      const n = Math.max(1, Math.round((b - a) / 0.7)), ya = md.y(f) + md.slab + 0.02, yb = md.y(f + 1) - 0.02, o = md.gI(f) - 0.008;
      for (let j = 0; j < n; j++) {
        const q = amostra(P, nor, cum, a + ((b - a) * (j + 0.5)) / n), w = 0.11, cx = q.x + q.nx * o, cz = q.z + q.nz * o;
        pc.quad('planter', [cx - q.tx * w, ya, cz - q.tz * w], [cx + q.tx * w, ya, cz + q.tz * w], [cx + q.tx * w, yb, cz + q.tz * w], [cx - q.tx * w, yb, cz - q.tz * w], [-q.nx, 0, -q.nz]);
      }
    }
  }
  return pc.mapa();
}
// Campus Universitário: 5 torres de células 1,0 acima da parede (topo em A.uni.torreTopo), nas frações A.uni.torres do
// caminho, com 2 x torreR ao longo dele; fachada celular com leve batimento para dentro e tampa creme
function torresUni(F) {
  const u = A.uni, p = F.prof, md = medidas(p), P = F.def.path, cum = cumDe(P), L = cum[cum.length - 1], y0 = md.y(F._Fg(F.max)), y1 = u.torreTopo - 0.04, rep = p.celRep || [7.04, 2.2], maps = [];
  const fac = (a, b) => ({ a, b, mat: 'fac_celular', uv: 'facade', vBase: p.y0 || 0, uRep: rep[0], vRep: rep[1] });
  const E = [fac([p.o1 + 0.06, y0], [p.o1 - 0.02, y1]), { a: [p.o1 - 0.02, y1], b: [p.o1 - 0.02, y1 + 0.04], mat: 'fasciaBeiral', uv: 'run' }, { a: [p.o1 - 0.02, y1 + 0.04], b: [p.o0 + 0.02, y1 + 0.04], mat: 'fasciaBeiral', uv: 'plan' },
    { a: [p.o0 + 0.02, y1 + 0.04], b: [p.o0 + 0.02, y1], mat: 'fasciaBeiral', uv: 'run' }, fac([p.o0 + 0.02, y1], [p.o0 - 0.06, y0])];
  for (const t of u.torres) { const s = t * L; maps.push(sweep(recorte(P, cum, s - u.torreR, s + u.torreR), false, E, { caps: true, capMat: 'fasciaBeiral', u0: s - u.torreR })); }
  return junta(maps);
}
// Humanidades: terraço de esculturas, 5 peças brancas abstratas (anel em pé, prismas torcidos, esfera no pedestal,
// arco em V e obelisco) em plintos, ao longo do teto de 4 pavimentos, entre o passeio e as moitas da borda externa
function esculturas(F) {
  const p = F.prof, md = medidas(p), Fg = F._Fg(F.max), yS = md.y(Fg) + md.slab, pt = passeioTeto(Fg, p), oE = md.eO(Fg) - md.curbW;
  const oS = pt ? (pt[0] + oE - 0.32) / 2 : (oE + md.eI(Fg) + md.curbW) / 2; const pc = new Pecas(), mat = new THREE.Matrix4(), R = new THREE.Matrix4(), T = new THREE.Matrix4();
  const m = F.trechos[0], P = m.path, cum = m.cum || cumDe(P), nor = normals(P, false), [k0, k1] = F._faixaK(m, Fg - 1, Fg); const a = cum[k0] + 1.0, b = cum[k1] - 1.0;
  const pecas = [
    (add) => { add(new THREE.BoxGeometry(0.14, 0.05, 0.14), 0, 0.025, 0); add(new THREE.TorusGeometry(0.15, 0.032, 6, 14), 0, 0.2, 0); },                                     // anel em pé
    (add) => { add(new THREE.BoxGeometry(0.16, 0.05, 0.16), 0, 0.025, 0); for (let j = 0; j < 3; j++) add(new THREE.BoxGeometry(0.1, 0.13, 0.1), 0, 0.115 + j * 0.13, 0, (j * Math.PI) / 7); }, // prismas torcidos
    (add) => { add(new THREE.CylinderGeometry(0.03, 0.05, 0.24, 8), 0, 0.12, 0); add(new THREE.IcosahedronGeometry(0.1, 1), 0, 0.33, 0); },                                   // esfera no pedestal
    (add) => { add(new THREE.BoxGeometry(0.05, 0.4, 0.07), -0.07, 0.19, 0, 0, 0.36); add(new THREE.BoxGeometry(0.05, 0.4, 0.07), 0.07, 0.19, 0, 0, -0.36); },                // arco em V invertido
    (add) => { add(new THREE.BoxGeometry(0.13, 0.05, 0.13), 0, 0.025, 0); add(new THREE.ConeGeometry(0.075, 0.5, 4), 0, 0.3, 0, Math.PI / 4); },                               // obelisco
  ];
  pecas.forEach((fn, j) => {
    const q = amostra(P, nor, cum, a + ((b - a) * (j + 0.5)) / pecas.length), ang = Math.atan2(-q.tz, q.tx); const x = q.x + q.nx * oS, z = q.z + q.nz * oS;
    fn((geo, dx, dy, dz, ry = 0, rz = 0) => { _e.set(0, ry, rz); R.makeRotationFromEuler(_e); T.makeTranslation(dx, dy, dz); mat.makeRotationY(ang).setPosition(x, yS, z).multiply(T).multiply(R); pc.prim('whiteSmooth', geo, mat); });
  });
  return pc.mapa();
}
// Vila: casas brancas com janelas altas (vidro da fachada, que acende à noite; 1 a cada 0,8, nas duas faces, fora do
// recuo das tampas das pontas e do degrau) e, na casa que chega ao nível máximo, o telhado de duas águas claro apoiado
// nos parapeitos das varandas do teto, com as empenas brancas nas pontas
function vila(F, m, Fg, f0, f1) {
  const p = F.prof, md = medidas(p), P = m.path, N = P.length, cum = m.cum || cumDe(P), nor = normals(P, false), rb = Math.min(md.B, cum[N - 1] * 0.2), pc = new Pecas(); const uR = BAY * 32, vR = FH * 4, w = 0.14;
  for (let f = f0; f < f1; f++) {
    const [k0, k1] = F._faixaK(m, f, Fg); const a = cum[k0] + (k0 > 0 || m.c0 ? rb : 0) + 0.2, b = cum[k1] - (k1 < N - 1 || m.c1 ? rb : 0) - 0.2; if (b - a < 0.4) continue;
    const n = Math.max(1, Math.round((b - a) / 0.8)), ya = md.y(f) + md.slab + 0.05, yb = md.y(f + 1) - 0.07;
    for (let j = 0; j < n; j++) {
      const s = a + ((b - a) * (j + 0.5)) / n, q = amostra(P, nor, cum, s), u0 = (m.u0 + s - w) / uR, u1 = (m.u0 + s + w) / uR, v0 = ya / vR, v1 = yb / vR;
      for (const [o, sg] of [[md.gO(f) + 0.006, 1], [md.gI(f) - 0.006, -1]]) {
        const cx = q.x + q.nx * o, cz = q.z + q.nz * o, dx = q.tx * w, dz = q.tz * w;
        pc.quad('fac_fita', [cx - dx, ya, cz - dz], [cx + dx, ya, cz + dz], [cx + dx, yb, cz + dz], [cx - dx, yb, cz - dz], [q.nx * sg, 0, q.nz * sg], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
      }
    }
  }
  const maps = [pc.mapa()];
  if (f1 === Fg && Fg >= F._Fg(F.max)) { // telhado de duas águas sobre o teto do último andar
    const [k0, k1] = F._faixaK(m, Fg - 1, Fg), ye = md.y(Fg) + md.slab + md.curb, oO = md.eO(Fg) + 0.02, oI = md.eI(Fg) - 0.02, oR = (oO + oI) / 2, yR = ye + 0.36, yb = ye - 0.04;
    const E = [{ a: [oO, yb], b: [oO, ye], mat: 'whiteSmooth', uv: 'run' }, { a: [oO, ye], b: [oR, yR], mat: 'roofMetal', uv: 'plan' }, { a: [oR, yR], b: [oI, ye], mat: 'roofMetal', uv: 'plan' },
      { a: [oI, ye], b: [oI, yb], mat: 'whiteSmooth', uv: 'run' }, { a: [oI, yb], b: [oO, yb], mat: 'whiteSmooth', uv: 'plan' }];
    maps.push(sweep(P.slice(k0, k1 + 1), false, E, { caps: true, capMat: 'whiteSmooth', capPoly: [[oI, yb], [oO, yb], [oO, ye], [oR, yR], [oI, ye]] }));
  }
  return junta(maps);
}

// ---------------------------------------------------------------- as fitas
// definição comum a partir de A[k]: caminho, módulos, cortes, vãos (aberturaDe e gap), ordem, tambores, degrau e alturas
// (fh, niveis, andaresExtra); ponta 0 = reta, com a tampa acabada
const defDe = (k, prof, mais = {}) => { const a = A[k]; return { id: k, closed: false, path: a.caminho, modulos: a.modulos, cortes: a.cortes, aberturas: a.aberturas, aberturaDe: a.aberturaDe, ordem: a.ordem, nos: a.nos, gap: a.gap,
  pontaDegrau: a.pontaDegrau, ponta: 0, niveis: a.niveis, andaresExtra: a.extra, prof: { o0: a.o0, o1: a.o1, fh: a.fh, fac: 'fac_fita', facIn: 'fac_fita', ...prof }, ...mais }; };
const TERRACO = { setIn: 0.24, setOut: 0.02 };             // terraços com floreiras (degraus para dentro)
// fitas do contorno (Humanidades, Onda, Elo Norte): laje de 0,07 (0,09 nas folhas). Os beirais das duas fitas se cruzam
// junto à tangência; com a mesma laje, os tetos das lajes ficariam no mesmo plano (z-fighting do terraço verde de uma
// com a laje clara da outra)
const CONTORNO = { slab: 0.07 };
const VARANDA = { beiral: 0.22, slab: 0.07, curb: 0.14, curbW: 0.03, curbMat: 'fasciaBeiral' }; // laje creme com parapeito
export function faixas() {
  return {
    // ---- Anel Mestre
    // Anel de moradia: 8 módulos pelo sul (ordem de A: 0 e 1 no portal, 4 e 5 com os tambores SO e SE), vãos nos tambores
    // da frente e no portal, lajes finas, terraços largos e verdes descendo para o lago, os 2 andares de baixo no talude,
    // passeio claro na borda externa do teto; 7 pavimentos (3,5) no nível máximo
    anel: new Faixa(defDe('anel', { setIn: 0.22, setOut: 0.02, beiral: 0.16, slab: 0.05, curb: 0.04, curbW: 0.08, passeioW: 0.22, passeioAt: 0.25, taludeAndares: 2 },
      { passo: 0.32, moitas: true, arbustoPasso: 0.8, arbustoMax: 900, ripaPasso: 0.2 })),
    // Sede da Holding: coroa norte, varandas brancas contínuas (laje creme com parapeito), terraços que descem para o lago,
    // cobertura de metal; portal de 3,6 no eixo; tambores NO e NE nos módulos 0 e 3; 8 pavimentos (4,4): o poder
    sede: new Faixa(defDe('sede', { setIn: 0.18, setOut: 0, ...VARANDA, roof: 'roofMetal', passeio: false }, { passo: 0.32, arbustos: false, ripas: false })),
    // ---- folhas
    // Escola: a gota SO inteira, 3 módulos que sobem juntos; terraços com floreiras e ripas; guarda-corpos coloridos
    escola: new Faixa(defDe('escola', TERRACO, { passo: 0.4, arbustoMax: 500, extraGeo: guardaCorpos })),
    // Universidade: Engenharia (rabo norte, dossel solar), Campus Universitário (arco externo, parede de células de 6
    // pavimentos com 5 torres; células de 0,25, 2 fileiras por pavimento) e Instituto (rabo sul, dossel verde e jardins
    // verticais); juntas retas entre os três
    engenharia: new Faixa(defDe('engenharia', TERRACO, { passo: 0.4, arbustoMax: 150, extraGeo: (F) => dossel(F, A.engenharia.dossel) })),
    uni: new Faixa(defDe('uni', { setIn: 0, setOut: 0, beiral: 0, curb: 0, curbW: 0.14, celular: true, celRep: [8.0, 2.5], fac: 'fac_celular', facIn: 'fac_celular', roof: 'roof' },
      { passo: 0.32, ripas: false, arbustoPasso: 1.2, extraGeo: torresUni })),
    instituto: new Faixa(defDe('instituto', TERRACO, { passo: 0.4, arbustoMax: 150, extraGeo: (F) => junta([dossel(F, A.instituto.dossel), jardinsVerticais(F)]), decor: () => moitasDossel(A.instituto.dossel) })),
    // Anel da Biblioteca: gota NO, 4 pavimentos de 0,55 em degraus para fora, colmeia por dentro, passeio de deque cinza
    anelBib: new Faixa(defDe('anelBib', { setIn: 0, setOut: 0.4, facIn: 'fac_colmeia', caminho: 'grey' }, { passo: 0.4, arbustoMax: 500 })),
    // Santuário: gota NE, 5 pavimentos de fachada âmbar, teto verde com friso claro; o pescoço fica aberto (a Cúpula à vista).
    // Friso de 0,07: com 0,06 o topo do friso do 4º pavimento (1,65) ficaria no plano do teto do Elo do Santuário, que
    // encosta de lado e recebe o beiral
    santuario: new Faixa(defDe('santuario', { setIn: 0.12, setOut: 0.03, curb: 0.07, curbMat: 'fasciaBeiral', fac: 'fac_ambar', facIn: 'fac_ambar', roof: 'roof', passeio: false }, { passo: 0.4, arbustoPasso: 1.0, arbustoMax: 450 })),
    // ---- contorno
    // Humanidades e Artes: braço oeste da praça, terraços; a ponta leste (junto à colunata) desce e chega com 2 pavimentos;
    // terraço de esculturas no teto
    humanidades: new Faixa(defDe('humanidades', { ...TERRACO, ...CONTORNO }, { passo: 0.4, arbustoMax: 250, extraGeo: esculturas })),
    // Vila: braço leste, 6 casas brancas (vão de 0,2 entre elas) com varandas brancas e janelas; ponta oeste em degrau;
    // telhado de duas águas em cada casa no nível máximo (sem passeio no teto: fica sob o telhado)
    casas: new FaixaMod(defDe('casas', { setIn: 0.2, setOut: 0.02, ...VARANDA, fac: 'whiteSmooth', facIn: 'whiteSmooth', passeio: false }, { passo: 0.4, arbustoMax: 250, ripas: false, porModulo: vila })),
    // Ala em Onda (vale oeste) e Elo Norte (vale leste): 2 módulos, terraços verdes largos com moitas
    onda: new Faixa(defDe('onda', { setIn: 0.3, setOut: 0.02, ...CONTORNO }, { passo: 0.4, moitas: true, arbustoMax: 150 })),
    uniElo: new Faixa(defDe('uniElo', { setIn: 0.3, setOut: 0.02, ...CONTORNO }, { passo: 0.4, moitas: true, arbustoMax: 150 })),
  };
}
