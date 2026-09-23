// Centro da composição: Faculdade de Ciências Avançadas (lóbulos orgânicos sobre pilotis, com
// laboratórios à mostra em corte), a Ala em Onda, o Lago Central e o pátio da Sede da Holding.
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { sweep, subPath, beams, curve, normals, FH } from '../geom.js';
import { treeGroup } from '../forest.js';
import { heightAt } from '../ground.js';
import { hash, rng } from '../../core/util.js';
import { Faixa } from './faixa.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
// contorno orgânico (elipse com bojos)
function blob(cx, cz, rx, rz, rot, seed, n = 150) {
  const out = []; const c = Math.cos(rot), s = Math.sin(rot); const p1 = hash(seed, 1, 3) * 6, p2 = hash(seed, 2, 3) * 6;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = 1 + 0.1 * Math.sin(2 * a + p1) + 0.07 * Math.sin(3 * a + p2); const x = Math.cos(a) * rx * k, z = Math.sin(a) * rz * k; out.push([cx + x * c - z * s, cz + x * s + z * c]); }
  return out;
}
function shapeOf(pts) { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); return s; }
function plate(pts, y, h, mat) { const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); return mesh(g, mat); }
const addMap = (grp, map, matFn) => { for (const [k, g] of map) grp.add(mesh(g, matFn(k))); };
// banda branca arredondada (borda de laje "fluida")
function bandEdges(y, t = 0.3, out = 0.12) {
  return [
    { a: [-0.45, y], b: [0, y], mat: 'band', uv: 'plan' },
    { a: [0, y], b: [out, y + t * 0.25], mat: 'band', uv: 'run' },
    { a: [out, y + t * 0.25], b: [out + 0.02, y + t * 0.6], mat: 'band', uv: 'run' },
    { a: [out + 0.02, y + t * 0.6], b: [0, y + t], mat: 'band', uv: 'run' },
    { a: [0, y + t], b: [-0.45, y + t], mat: 'band', uv: 'plan' },
  ];
}
// Um lóbulo da faculdade: níveis com bandas brancas, vidro recuado, lajes, laboratórios e pilotis.
function lobo(P, pts, y0, nLev, lh, corte, seed) {
  const nor = normals(pts, true);
  const levels = []; for (let k = 0; k <= nLev; k++) { const f = 1 - 0.035 * k; let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length; levels.push(pts.map(([x, z], i) => [cx + (x - cx) * f + nor[i][0] * 0.08 * Math.sin(k * 1.3 + i * 0.05), cz + (z - cz) * f + nor[i][1] * 0.08 * Math.sin(k * 1.3 + i * 0.05)])); }
  // e1: pilotis e lajes de concreto
  const cols = []; for (let i = 0; i < pts.length; i += 10) { const [x, z] = levels[0][i], [nx, nz] = nor[i]; cols.push([[x - nx * 0.7, heightAt(x, z), z - nz * 0.7], [x - nx * 0.7, y0, z - nz * 0.7]]); }
  let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; cols.push([[cx + Math.cos(a) * 0.8, 0, cz + Math.sin(a) * 0.5], [cx + Math.cos(a) * 0.8, y0, cz + Math.sin(a) * 0.5]]); }
  P.e1.add(beams(cols, 0.07, M.whiteSmooth, 8));
  for (let k = 0; k < nLev; k++) P.e1.add(plate(levels[k], y0 + k * lh, 0.08, M.concreto));
  const lobby = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, y0, 24, 1, true), dupla(M.glassWarm)); lobby.scale.set(1, 1, 0.6); lobby.position.set(cx, y0 / 2, cz); P.e1.add(lobby);
  // e2: laboratórios (bancadas, equipamentos e telas) nos pisos
  const labs = []; const R = rng(seed * 31 + 7);
  for (let k = 0; k < nLev; k++) for (let n = 0; n < 16; n++) { const i = (R() * pts.length) | 0; const [x, z] = levels[k][i]; const t = 0.25 + R() * 0.55; const px = cx + (x - cx) * t, pz = cz + (z - cz) * t; labs.push([px, y0 + k * lh + 0.08, pz, 0.18 + R() * 0.3, 0.12 + R() * 0.2, 0.14 + R() * 0.2, R()]); }
  const lb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.whiteSmooth, labs.length); const sc = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.cyanGlow, labs.length); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); let ns = 0;
  labs.forEach(([x, y, z, w, h, d, r], i) => { q.setFromEuler(new THREE.Euler(0, r * 3, 0)); lb.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y + h / 2, z), q, new THREE.Vector3(w, h, d))); if (r < 0.45) sc.setMatrixAt(ns++, m4.compose(new THREE.Vector3(x, y + h + 0.05, z), q, new THREE.Vector3(w * 0.6, 0.07, 0.012))); });
  sc.count = ns; lb.castShadow = true; P.e2.add(lb, sc);
  for (let k = 0; k < nLev; k++) P.e2.add(plate(levels[k], y0 + k * lh + 0.06, 0.03, M.whiteSmooth));
  // e3: casca orgânica — bandas brancas fluidas em cada nível (a assinatura do prédio)
  for (let k = 0; k <= nLev; k++) addMap(P.e3, sweep(levels[k], true, bandEdges(y0 + k * lh - 0.02, k === nLev ? 0.34 : 0.26, 0.14)), () => M.whiteSmooth);
  P.e3.add(plate(levels[nLev], y0 + nLev * lh + 0.2, 0.06, M.roof));
  // e4: vidro recuado (menos na fachada em corte, onde os laboratórios ficam à mostra) e luzes
  const glassPath = subPath(pts, true, corte[1], corte[0] + 1, 120);
  for (let k = 0; k < nLev; k++) { const lv = subPath(levels[k], true, corte[1], corte[0] + 1, 120); addMap(P.e4, sweep(lv, false, [{ a: [-0.42, y0 + k * lh + 0.26], b: [-0.42, y0 + (k + 1) * lh - 0.02], mat: 'fac', uv: 'facade', vBase: y0 }], { caps: false }), () => M.fac_lab); }
  const glow = []; for (let k = 0; k < nLev; k++) { const lv = subPath(levels[k], true, corte[0], corte[1], 40); const nn = normals(lv, false); for (let i = 0; i < lv.length; i += 4) glow.push([lv[i][0] - nn[i][0] * 0.5, y0 + (k + 1) * lh - 0.06, lv[i][1] - nn[i][1] * 0.5]); }
  const gl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.02, 0.06), M.lampGlow, glow.length); glow.forEach((p, i) => gl.setMatrixAt(i, m4.makeTranslation(...p))); P.e4.add(gl);
  return glassPath;
}

export function ciencias() {
  const c = A.ciencias; const root = new THREE.Group(); root.name = 'ciencias'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group(), e4: new THREE.Group() };
  const loboA = blob(c.c[0] + 2.2, c.c[1] - 0.2, 3.4, 2.1, c.rot - 0.15, 4);
  const loboB = blob(c.c[0] - 3.6, c.c[1] + 0.4, 2.3, 1.5, c.rot + 0.25, 9);
  lobo(P, loboA, 0.75, 3, 0.62, [0.1, 0.42], 1);
  lobo(P, loboB, 0.6, 2, 0.6, [0.12, 0.36], 2);
  // espelho d'água redondo à frente (visível na foto)
  const pond = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), M.pool); pond.rotation.x = -Math.PI / 2; pond.position.set(c.c[0] + 1.6, 0.06, c.c[1] + 2.6); pond.scale.set(1.3, 1, 1); P.e4.add(pond);
  const pondR = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.05, 6, 40), M.whiteSmooth); pondR.rotation.x = -Math.PI / 2; pondR.scale.set(1.3, 1, 1); pondR.position.copy(pond.position); P.e4.add(pondR);
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'ciencias', root, partes: P, esqueletos: {}, grua: { e1: true, e3: true }, foco: { x: c.c[0], z: c.c[1] + 1, dist: 15 }, ancora: [c.c[0] + 1.5, 3.6, c.c[1]] };
}
// Ala em Onda: fita em "S" com terraços entre o Campus Universitário e a Faculdade de Ciências
export function alaOnda() {
  return new Faixa({ id: 'onda', closed: false, path: curve([[-15.4, -5.0], [-13.2, -7.4], [-10.8, -5.6], [-8.6, -7.6], [-6.2, -6.4]], false, 120), modulos: 1,
    prof: { o0: -0.5, o1: 0.7, setIn: 0, setOut: 0.28, fac: 'fac_lab', facIn: 'fac_quente' }, niveis: 3 });
}

// ---------------- Lago Central ----------------
export function lago(ground) {
  const root = new THREE.Group(); root.name = 'lago'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  // e1: desassoreamento (o nível da água sobe; animação no mundo)
  P.e1.userData.nivel = true;
  // e2: margens vivas — juncos, árvores na ilha e nas margens
  const reeds = []; const poly = A.lago; const R = rng(77);
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; for (let k = 0; k < 7; k++) { const t = R(); const x = a[0] + (b[0] - a[0]) * t + (R() - 0.5) * 0.4, z = a[1] + (b[1] - a[1]) * t + (R() - 0.5) * 0.4; reeds.push([x, z, 0.15 + R() * 0.2]); } }
  const rg = new THREE.ConeGeometry(0.03, 1, 4); rg.translate(0, 0.5, 0); const rim = new THREE.InstancedMesh(rg, M.planter, reeds.length); const m4 = new THREE.Matrix4();
  reeds.forEach(([x, z, h], i) => rim.setMatrixAt(i, m4.compose(new THREE.Vector3(x, -0.12, z), new THREE.Quaternion(), new THREE.Vector3(1, h * 1.5, 1)))); P.e2.add(rim);
  const tr = []; for (let i = 0; i < 10; i++) { const a = R() * 6.28, r = R() * (A.ilha.r - 0.3); tr.push({ x: A.ilha.c[0] + Math.cos(a) * r, z: A.ilha.c[1] + Math.sin(a) * r, s: 0.3 + R() * 0.15, pal: 'jardim', h: 1.1 }); }
  for (let i = 0; i < 18; i++) { const k = (R() * poly.length) | 0; const a = poly[k], b = poly[(k + 1) % poly.length]; const t = R(); tr.push({ x: a[0] + (b[0] - a[0]) * t + (R() - 0.5) * 1.2, z: a[1] + (b[1] - a[1]) * t + (R() - 0.5) * 1.2, s: 0.28 + R() * 0.16, pal: 'jardim' }); }
  P.e2.add(treeGroup(tr.map((t) => ({ ...t, y: Math.max(0, heightAt(t.x, t.z)) }))));
  // e3: estação natural de água — ilhas flutuantes filtrantes, deque de madeira e casa de bombas
  for (const [x, z, rx, rz] of [[-5.8, -9.8, 0.7, 0.4], [3.4, -8.2, 0.6, 0.35], [1.2, -11.2, 0.5, 0.3], [-3.6, -6.2, 0.55, 0.3]]) { const g = new THREE.CylinderGeometry(1, 1, 0.05, 20); g.scale(rx, 1, rz); const m = mesh(g, M.grassBright, false); m.position.set(x, -0.07, z); P.e3.add(m); const sh = []; for (let i = 0; i < 5; i++) sh.push({ x: x + (R() - 0.5) * rx, z: z + (R() - 0.5) * rz, y: -0.05, s: 0.09 + R() * 0.05, pal: 'jardim' }); P.e3.add(treeGroup(sh, { cast: false })); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.3), M.woodLight); deck.position.set(5.6, 0.02, -6.4); deck.rotation.y = 0.6; deck.castShadow = true; P.e3.add(deck);
  const house = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.45), M.white); house.position.set(6.6, 0.18, -5.6); house.castShadow = true; P.e3.add(house);
  const hr = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.04, 0.49), M.roof); hr.position.set(6.6, 0.37, -5.6); P.e3.add(hr);
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'lago', root, partes: P, esqueletos: {}, grua: {}, foco: { x: -1, z: -8, dist: 17 }, ancora: [-1, 1.4, -8] };
}

// ---------------- Pátio da Sede ----------------
export function sedePatio() {
  const s = A.sede; const root = new THREE.Group(); root.name = 'sedePatio'; const P = { e1: new THREE.Group(), e4: new THREE.Group() };
  const pts = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; const u = Math.cos(a) * (s.rx - 1.45), v = Math.sin(a) * (s.rz - 1.45); pts.push([s.c[0] + u * Math.cos(s.rot) - v * Math.sin(s.rot), s.c[1] + u * Math.sin(s.rot) + v * Math.cos(s.rot)]); }
  const fund = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; const u = Math.cos(a) * (s.rx + 0.1), v = Math.sin(a) * (s.rz + 0.1); fund.push([s.c[0] + u * Math.cos(s.rot) - v * Math.sin(s.rot), s.c[1] + u * Math.sin(s.rot) + v * Math.cos(s.rot)]); }
  P.e1.add(plate(fund, -0.05, 0.08, M.concreto));
  P.e4.add(plate(pts, 0.03, 0.03, M.lawn));
  const field = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.9), M.field); field.rotation.x = -Math.PI / 2; field.rotation.z = -s.rot; field.position.set(s.c[0] + 0.3, 0.07, s.c[1] + 0.2); field.receiveShadow = true; P.e4.add(field);
  const tr = []; const R = rng(41); for (let i = 0; i < 16; i++) { const a = R() * 6.28; tr.push({ x: s.c[0] + Math.cos(a) * (s.rx - 2.1), z: s.c[1] + Math.sin(a) * (s.rz - 1.9), s: 0.22 + R() * 0.1, pal: 'jardim', h: 1.1 }); }
  P.e4.add(treeGroup(tr));
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'sedePatio', root, partes: P, esqueletos: {}, grua: {}, foco: { x: s.c[0], z: s.c[1] + 1, dist: 16 }, ancora: [s.c[0], 2.6, s.c[1]] };
}
