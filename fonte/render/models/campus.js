// Miolos da frente do Trevo da Holding (plano mestre, revisão 6; todas as medidas vêm de A, em planta.js):
//   escola: o Pátio da Escola na boca oeste do Anel (a base de grama é a zona 'escola' do terreno, ligada em e2).
//     e2 dois morros de terraços verdes com borda clara, areia no topo e brinquedos coloridos (trepa-trepa, gira-gira e
//     escorregadores); e3 piscina com borda clara e deque de madeira (obra em modo terra: a escavação). O bloco escolar
//     (e1, etapa de nível) é a fita 'escola' (aneis.js): este modelo não tem e1.
//   campo: miolo da folha SO. e1 terraplenagem (terra batida só sob o campo: M.soil venceria o gramado de longe); e2
//     gramado do miolo, calçada e campo com marcações (girado com o lado comprido de frente para a arquibancada), com
//     jogadores; e3 arquibancada verde de 3 degraus no pescoço, de costas para o tambor, e 4 torres de luz.
//   gramadoUni: miolo da folha SE. Gramado (vazado na Ciências), pista de atletismo em volta da Ciências (passa sob a
//     Ponte Coberta), com corredores, e o cordão de árvores baixas junto à face interna da gota, fora da Ponte Coberta.
// Par espelhado no eixo: campo x Ciências (miolos da frente) e Pátio da Escola x Anfiteatro (leste.js).
// Tudo em coordenadas do mundo; as placas do chão não se sobrepõem (sem briga de profundidade entre elas).
import * as THREE from 'three';
import { A, J } from '../../data/planta.js';
import { M } from '../materials.js';
import { tube, deckGeo } from '../geom.js';
import { treeGroup } from '../forest.js';
import { rng } from '../../core/util.js';

const rad = (g) => (g * Math.PI) / 180;
const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
// oval [x, z] (rot em graus, de +x para +z), n pontos sem repetir o primeiro
const oval = (c, rx, rz, n = 36, rot = 0) => { const co = Math.cos(rad(rot)), si = Math.sin(rad(rot)); return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, u = Math.cos(a) * rx, v = Math.sin(a) * rz; return [c[0] + u * co - v * si, c[1] + u * si + v * co]; }); };
// retângulo w x d em c, com o lado w na direção rot (graus)
const ret = (c, w, d, rot) => { const co = Math.cos(rad(rot)), si = Math.sin(rad(rot)); return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [c[0] + u * co - v * si, c[1] + u * si + v * co]); };
const area = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

// ---------------------------------------------------------------- geometria em listas (uma por material)
class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  v(x, y, z, nx, ny, nz, u, w) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); return this.p.length / 3 - 1; }
  // triângulo virado para a normal do primeiro vértice
  t(a, b, c) {
    const P = this.p, ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2]; const e1 = [P[b * 3] - ax, P[b * 3 + 1] - ay, P[b * 3 + 2] - az], e2 = [P[c * 3] - ax, P[c * 3 + 1] - ay, P[c * 3 + 2] - az];
    const d = (e1[1] * e2[2] - e1[2] * e2[1]) * this.n[a * 3] + (e1[2] * e2[0] - e1[0] * e2[2]) * this.n[a * 3 + 1] + (e1[0] * e2[1] - e1[1] * e2[0]) * this.n[a * 3 + 2];
    if (d >= 0) this.i.push(a, b, c); else this.i.push(a, c, b);
  }
  q(a, b, c, d) { this.t(a, b, c); this.t(a, c, d); }
  get vazio() { return !this.i.length; }
  geo() {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setIndex(this.i); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
}
// tampo plano em y (contorno com furos), uv planar
function tampa(G, pts, y, furos = []) {
  const V = (l) => l.map(([x, z]) => new THREE.Vector2(x, z)); const tri = THREE.ShapeUtils.triangulateShape(V(pts), furos.map(V)); const todos = [...pts, ...furos.flat()];
  const b = G.p.length / 3; for (const [x, z] of todos) G.v(x, y, z, 0, 1, 0, x / 2.2, z / 2.2);
  for (const [a, c, d] of tri) G.t(b + a, b + c, b + d);
}
// paredes de um contorno fechado de y0 a y1, normais suaves para fora (fora = -1: para dentro, a face de um furo)
function lados(G, pts, y0, y1, fora = 1) {
  const n = pts.length, s = Math.sign(area(pts)) * fora; const nr = []; let L = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; nr.push([(dz / l) * s, (-dx / l) * s]); }
  const b0 = G.p.length / 3;
  for (let i = 0; i <= n; i++) {
    const k = i % n, m = nr[(k - 1 + n) % n], e = nr[k]; let nx = m[0] + e[0], nz = m[1] + e[1]; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    if (i) L += Math.hypot(pts[k][0] - pts[i - 1][0], pts[k][1] - pts[i - 1][1]); const [x, z] = pts[k];
    G.v(x, y0, z, nx, 0, nz, L / 2.2, y0 / 2.2); G.v(x, y1, z, nx, 0, nz, L / 2.2, y1 / 2.2);
  }
  for (let i = 0; i < n; i++) { const a = b0 + i * 2; G.q(a, a + 2, a + 3, a + 1); }
}
// faixa plana entre dois contornos fechados com o mesmo número de pontos; uvf(i, fora) = [u, v] (padrão planar)
function faixaPlana(G, ext, int, y, uvf) {
  const n = ext.length, b = G.p.length / 3;
  for (let i = 0; i <= n; i++) { const k = i % n; for (const [p, f] of [[ext[k], 1], [int[k], 0]]) { const [u, v] = uvf ? uvf(i, f) : [p[0] / 2.2, p[1] / 2.2]; G.v(p[0], y, p[1], 0, 1, 0, u, v); } }
  for (let i = 0; i < n; i++) { const a = b + i * 2; G.q(a, a + 2, a + 3, a + 1); }
}
// prisma de contorno fechado: paredes e tampo
const prisma = (G, pts, y0, y1) => { lados(G, pts, y0, y1); tampa(G, pts, y1); };
// anel de borda (aro): paredes de fora e de dentro e o tampo, de y0 a y1
const aro = (G, ext, int, y0, y1) => { lados(G, ext, y0, y1); lados(G, int, y0, y1, -1); faixaPlana(G, ext, int, y1); };
// malhas de um mapa { material: Geo } num grupo
const addGeos = (grp, mapa, cast = true) => { for (const [mat, G] of mapa) if (!G.vazio) grp.add(mesh(G.geo(), mat, cast)); };

// ---------------------------------------------------------------- Pátio da Escola
// brinquedos coloridos: trepa-trepa em arcos cruzados (tubos) sobre a areia
function trepa(grp, c, y, r, mats, a0 = 0.3) {
  mats.forEach((m, i) => { const a = (i * Math.PI) / mats.length + a0, co = Math.cos(a), si = Math.sin(a); const pts = []; for (let k = 0; k <= 8; k++) { const t = (k / 8) * Math.PI; pts.push([c[0] + co * Math.cos(t) * r, y + Math.sin(t) * r * 0.95, c[1] + si * Math.cos(t) * r]); } grp.add(tube(pts, 0.022, m, 12, 5)); });
}
// morro de terraços verdes: degraus de grama (M.roof) com a borda clara, cada um menor e puxado para o norte (os
// terraços abrem para o sul, de frente para a câmera), areia no topo; o escorregador desce do topo pela lateral (sx)
function morro(grp, m, sx, cores) {
  const n = m.h >= 0.8 ? 3 : 2, passo = n === 3 ? 0.27 : 0.45, T = []; const G = new Map([[M.roof, new Geo()], [M.fasciaBeiral, new Geo()], [M.sand, new Geo()]]);
  for (let i = 0; i < n; i++) {
    const s = 1 - i * passo, rx = m.rx * s, rz = m.rz * s, c = [m.c[0], m.c[1] - (1 - s) * m.rz * 0.3], y = (m.h * (i + 1)) / n; T.push({ c, rx, rz, y });
    prisma(G.get(M.roof), oval(c, rx - 0.02, rz - 0.02), 0, y);
    aro(G.get(M.fasciaBeiral), oval(c, rx, rz), oval(c, rx - 0.07, rz - 0.07), y - 0.035, y + 0.02);
  }
  const t = T[n - 1]; tampa(G.get(M.sand), oval(t.c, t.rx - 0.07, t.rz - 0.07), t.y + 0.012); addGeos(grp, G);
  // escorregador: segue os degraus por cima (0,045 acima de cada borda) e chega ao chão fora do morro
  const zs = t.c[1], R = T.map((d) => d.rx * Math.sqrt(Math.max(0, 1 - ((zs - d.c[1]) / d.rz) ** 2)));
  const perfil = [[R[n - 1] - 0.12, t.y + 0.05]]; for (let i = n - 1; i >= 0; i--) perfil.push([R[i] + 0.04, T[i].y + 0.045]); perfil.push([R[0] + 0.3, 0.1], [R[0] + 0.45, 0.035]);
  grp.add(mesh(deckGeo(perfil.map(([r, y]) => [m.c[0] + sx * r, y, zs]), 0.15, 0.025), cores[0]));
  return t;
}
// Escola e Campus para Jovens: só os pátios (e2) e a piscina (e3); o bloco escolar é a fita 'escola'
export function escola() {
  const E = A.patios.escola; const root = new THREE.Group(); root.name = 'escola'; const P = { e2: new THREE.Group(), e3: new THREE.Group() };
  // e2: o morro grande (3 terraços) com trepa-trepa e escorregador para o oeste; o pequeno (2) com gira-gira e
  // escorregador para o leste
  const [m1, m2] = E.morros;
  const t1 = morro(P.e2, m1, -1, [M.yellow]); trepa(P.e2, t1.c, t1.y + 0.012, Math.min(t1.rx, t1.rz) * 0.6, [M.orange, M.teal, M.yellow]);
  const t2 = morro(P.e2, m2, 1, [M.teal]), gx = t2.c[0] - 0.2; const gira = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 14), M.orange); gira.position.set(gx, t2.y + 0.03, t2.c[1]); P.e2.add(gira);
  const eixo = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6), M.steel); eixo.position.set(gx, t2.y + 0.12, t2.c[1]); P.e2.add(eixo);
  trepa(P.e2, [t2.c[0] + 0.22, t2.c[1]], t2.y + 0.012, 0.18, [M.yellow], Math.PI / 2);   // arco entre o gira-gira e o escorregador
  // e3: piscina (água M.pool) com borda clara e deque de madeira; o deque e a borda param na junta da Humanidades (a
  // água de A fica a ~0,19 da pegada dela): recorte radial a partir do centro F do arco da Humanidades
  const p = E.piscina, [dx, dz] = p.deck, H = A.humanidades, lim = H.R + H.w / 2 + J; const rF = (q) => Math.hypot(q[0] - H.F[0], q[1] - H.F[1]);
  const afasta = (l) => l.map((q) => { const r = rF(q); return r >= lim ? q : [H.F[0] + ((q[0] - H.F[0]) / r) * lim, H.F[1] + ((q[1] - H.F[1]) / r) * lim]; });
  const agua = oval(p.c, p.rx, p.rz, 40), borda = afasta(oval(p.c, p.rx + 0.06, p.rz + 0.06, 40)), deque = afasta(oval(p.c, p.rx + dx, p.rz + dz, 40));
  const G = new Map([[M.madeiraClara, new Geo()], [M.fasciaBeiral, new Geo()], [M.pool, new Geo()]]);
  aro(G.get(M.madeiraClara), deque, borda, 0, 0.06); aro(G.get(M.fasciaBeiral), borda, agua, 0, 0.075); tampa(G.get(M.pool), agua, 0.04); addGeos(P.e3, G);
  for (const k of Object.keys(P)) root.add(P[k]);
  const c = E.c; return { id: 'escola', root, partes: P, esqueletos: {}, grua: {}, modos: { e3: 'terra' }, foco: { x: c[0], z: c[1], dist: 11 }, ancora: [c[0], 1.5, c[1]] };
}

// ---------------------------------------------------------------- campo (miolo da folha SO)
// arquibancada em arco (c, r0 a r1, a0 a a1 graus, h, degraus): pisos de grama, espelhos claros virados para o campo,
// costas e cabeceiras de pedra clara
function arquibancada(aq) {
  const G = new Map([[M.lawn, new Geo()], [M.fasciaBeiral, new Geo()], [M.concretoClaro, new Geo()]]); const n = aq.degraus, d = (aq.r1 - aq.r0) / n, hs = aq.h / n, c = aq.c;
  const a0 = rad(aq.a0), a1 = rad(aq.a1), seg = Math.max(8, Math.ceil(Math.abs(aq.a1 - aq.a0) / 3));
  // tira ao longo do arco entre (ra, ya) e (rb, yb), normal (radial nr, vertical ny)
  const tira = (Gm, ra, ya, rb, yb, nr, ny, plano) => {
    const b = Gm.p.length / 3;
    for (let k = 0; k <= seg; k++) { const a = a0 + ((a1 - a0) * k) / seg, co = Math.cos(a), si = Math.sin(a), s = (Math.abs(a - a0) * (ra + rb)) / 2;
      for (const [r, y] of [[ra, ya], [rb, yb]]) { const x = c[0] + co * r, z = c[1] + si * r; Gm.v(x, y, z, co * nr, ny, si * nr, plano ? x / 2.2 : s / 2.2, plano ? z / 2.2 : y / 2.2); } }
    for (let k = 0; k < seg; k++) { const i = b + k * 2; Gm.q(i, i + 2, i + 3, i + 1); }
  };
  for (let k = 0; k < n; k++) { const r = aq.r0 + k * d; tira(G.get(M.fasciaBeiral), r, k * hs, r, (k + 1) * hs, -1, 0); tira(G.get(M.lawn), r, (k + 1) * hs, r + d, (k + 1) * hs, 0, 1, true); }
  tira(G.get(M.concretoClaro), aq.r1, 0, aq.r1, aq.h, 1, 0);
  // cabeceiras: o perfil em escada nas duas pontas do arco
  const perfil = [[aq.r0, 0]]; for (let k = 0; k < n; k++) perfil.push([aq.r0 + k * d, (k + 1) * hs], [aq.r0 + (k + 1) * d, (k + 1) * hs]); perfil.push([aq.r1, 0]);
  const tri = THREE.ShapeUtils.triangulateShape(perfil.map(([r, y]) => new THREE.Vector2(r, y)), []); const Gc = G.get(M.concretoClaro);
  for (const [a, s] of [[a0, -Math.sign(a1 - a0)], [a1, Math.sign(a1 - a0)]]) {
    const co = Math.cos(a), si = Math.sin(a), b = Gc.p.length / 3; for (const [r, y] of perfil) Gc.v(c[0] + co * r, y, c[1] + si * r, -si * s, 0, co * s, r / 2.2, y / 2.2);
    for (const [i, j, k] of tri) Gc.t(b + i, b + j, b + k);
  }
  const g = new THREE.Group(); addGeos(g, G); return g;
}
// torre de luz (r de pegada, altura h): base de concreto, mastro de aço e o refletor inclinado para o centro do campo
function torreLuz(p, alvo, tl) {
  const g = new THREE.Group(); const base = mesh(new THREE.CylinderGeometry(tl.r * 0.85, tl.r, 0.1, 8), M.concreto); base.position.set(p[0], 0.05, p[1]); g.add(base);
  const hm = tl.h - 0.3, mastro = mesh(new THREE.CylinderGeometry(0.045, 0.07, hm, 6, 1, true), M.steel); mastro.position.set(p[0], 0.1 + hm / 2, p[1]); g.add(mastro);
  const cab = new THREE.Group(); cab.position.set(p[0], tl.h - 0.13, p[1]); cab.rotation.y = Math.atan2(alvo[0] - p[0], alvo[1] - p[1]); g.add(cab);
  const inc = new THREE.Group(); inc.rotation.x = 0.4; cab.add(inc);
  const caixa = mesh(new THREE.BoxGeometry(0.36, 0.22, 0.07), M.steelDark); inc.add(caixa);
  const luz = mesh(new THREE.PlaneGeometry(0.3, 0.16), M.lampGlow, false); luz.position.z = 0.036; inc.add(luz);
  return g;
}
export function campo() {
  const c = A.campo, S = c.gramado.c; const root = new THREE.Group(); root.name = 'campo'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  // e1: terraplenagem do campo: terra batida no retângulo do campo, 0,08 para dentro. M.soil tem polygonOffset (vence o
  // terreno logo abaixo) e, de longe, ganharia de qualquer placa sem deslocamento pouco acima dela: só o campo de e2
  // (M.field, deslocamento maior e mais alto) cobre a terra; o gramado e a calçada ficam fora dela
  const T = new Geo(); tampa(T, ret(c.c, c.w - 0.16, c.d - 0.16, c.rot), 0.012); P.e1.add(mesh(T.geo(), M.soil, false));
  // e2: gramado vazado no campo, calçada clara de 0,15 em volta e o campo com as marcações (M.field)
  const moldura = ret(c.c, c.w + 0.3, c.d + 0.3, c.rot), G = new Map([[M.lawn, new Geo()], [M.caminhoTeto, new Geo()]]);
  tampa(G.get(M.lawn), oval(S, c.gramado.r, c.gramado.r, 64), 0.05, [moldura]); tampa(G.get(M.caminhoTeto), moldura, 0.05, [ret(c.c, c.w, c.d, c.rot)]); addGeos(P.e2, G, false);
  const f = new THREE.PlaneGeometry(c.w, c.d); f.rotateX(-Math.PI / 2); const quadra = mesh(f, M.field, false); quadra.position.set(c.c[0], 0.05, c.c[1]); quadra.rotation.y = -rad(c.rot); P.e2.add(quadra);
  P.e2.userData.pessoas = { area: c.poly, y: 0.05, n: 12 };      // os jogadores
  // e3: arquibancada no pescoço e as 4 torres de luz
  P.e3.add(arquibancada(c.arquibancada)); for (const p of c.torresLuz) P.e3.add(torreLuz(p, c.c, c.torreLuz));
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'campo', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'terra', e2: 'crescer' }, foco: { x: S[0], z: S[1], dist: 13 }, ancora: [S[0], 1.0, S[1]] };
}

// ---------------------------------------------------------------- gramado do Campus Universitário (miolo da folha SE)
// gramado (vazado na Ciências, com a junta), pista de atletismo com as linhas claras, o cordão de árvores baixas junto à
// face interna da gota (fora da pista e da Ponte Coberta) e corredores na pista
export function gramadoUni() {
  const g = A.gramadoUni, ps = g.pista, S = g.c, ci = A.ciencias, pc = A.ponteCoberta; const root = new THREE.Group(); root.name = 'gramadoUni'; const P = { e1: new THREE.Group() };
  const rOut = ps.r, rIn = ps.r - ps.w, lin = 0.04, N = 96, circ = (r) => oval(S, r, r, N);
  const G = new Map([[M.lawn, new Geo()], [M.track, new Geo()], [M.fasciaBeiral, new Geo()]]);
  faixaPlana(G.get(M.lawn), circ(g.r), circ(rOut), 0.03);
  tampa(G.get(M.lawn), circ(rIn), 0.03, [oval(ci.c, ci.rx + J, ci.rz + J, 40, ci.rot)]);
  faixaPlana(G.get(M.fasciaBeiral), circ(rOut), circ(rOut - lin), 0.03); faixaPlana(G.get(M.fasciaBeiral), circ(rIn + lin), circ(rIn), 0.03);
  // pista: as raias da textura correm ao longo (u pelo comprimento, v de dentro para fora)
  const rm = (rOut + rIn) / 2; faixaPlana(G.get(M.track), circ(rOut - lin), circ(rIn + lin), 0.03, (i, fora) => [((i / N) * Math.PI * 2 * rm) / 2.0, fora ? 1 : 0]);
  addGeos(P.e1, G, false);
  // cordão de árvores entre a pista e a borda do gramado (centro a 4,8, copa até ~0,18: fica fora da floreira do térreo
  // da gota), fora da Ponte Coberta (meia largura + junta + copa)
  const [a, b] = pc.pts, dSeg = (x, z) => { const vx = b[0] - a[0], vz = b[1] - a[1], l = vx * vx + vz * vz, t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / l)); return Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t); };
  const R = rng(88), rA = rOut + 0.2, nA = Math.floor((2 * Math.PI * rA) / 0.5), tr = [];
  for (let i = 0; i < nA; i++) { const t = ((i + 0.5) / nA) * Math.PI * 2, r = rA + (R() - 0.5) * 0.02, x = S[0] + Math.cos(t) * r, z = S[1] + Math.sin(t) * r, s = 0.13 + R() * 0.02; if (dSeg(x, z) < pc.w / 2 + J + 0.2) continue; tr.push({ x, z, s, h: 0.9, pal: 'jardim' }); }
  P.e1.add(treeGroup(tr, { name: 'cordaoUni' }));
  // corredores: a área é o anel da pista (contorno de fora e o de dentro ao contrário, pela costura em t = 0)
  const cf = circ(rOut - 0.06), cd = circ(rIn + 0.06); P.e1.userData.pessoas = { area: [...cf, cf[0], cd[0], ...cd.slice(1).reverse(), cd[0]], y: 0.03, n: 10 };
  root.add(P.e1);
  const u = [Math.cos(rad(ci.rot)), Math.sin(rad(ci.rot))], an = [S[0] - u[0] * rm, S[1] - u[1] * rm];   // âncora na pista, do lado oposto ao tambor
  return { id: 'gramadoUni', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'crescer' }, foco: { x: S[0], z: S[1], dist: 14 }, ancora: [an[0], 0.8, an[1]] };
}
