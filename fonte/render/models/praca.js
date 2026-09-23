// Praça central (espelhos d'água filtrantes, palmeiras, bancos e luzes), passarelas elevadas
// com guarda-corpos de vidro, a ponte coberta e o caminho da frente.
import * as THREE from 'three';
import { A, PASSARELAS } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { beams } from '../geom.js';
import { treeGroup } from '../forest.js';
import { heightAt } from '../ground.js';
import { rng, hash } from '../../core/util.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
function ellPts(cx, cz, rx, rz, rot, n = 48) { const o = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const u = Math.cos(a) * rx, v = Math.sin(a) * rz; o.push([cx + u * Math.cos(rot) - v * Math.sin(rot), cz + u * Math.sin(rot) + v * Math.cos(rot)]); } return o; }
function plate(pts, y, h, mat) { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); return mesh(g, mat); }

// Deque elevado ao longo de uma curva 3D: piso branco, frisos, guarda-corpo de vidro, jardineira e pilares.
export function deck(pts, w, o = {}) {
  const g = new THREE.Group(); const c = new THREE.CatmullRomCurve3(pts.map(([x, z, h]) => new THREE.Vector3(x, Math.max(heightAt(x, z), 0) + h, z)));
  const L = c.getLength(); const N = Math.max(8, Math.ceil(L / 0.2)); const S = c.getSpacedPoints(N);
  const top = [], side = [], rail = [], plant = [], ti = [], si = [], ri = [], pi = [];
  const quad = (arr, idx, a, b, cc, d) => { const k = arr.length / 3; arr.push(...a, ...b, ...cc, ...d); idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); };
  const L2 = [], R2 = [];
  for (let i = 0; i <= N; i++) { const p = S[i], q = S[Math.min(N, i + 1)], r = S[Math.max(0, i - 1)]; let tx = q.x - r.x, tz = q.z - r.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; const nx = tz, nz = -tx; L2.push([p.x + nx * w / 2, p.y, p.z + nz * w / 2]); R2.push([p.x - nx * w / 2, p.y, p.z - nz * w / 2]); }
  for (let i = 0; i < N; i++) {
    const a = L2[i], b = R2[i], a2 = L2[i + 1], b2 = R2[i + 1];
    quad(top, ti, a, b, a2, b2);
    const dn = (p) => [p[0], p[1] - 0.07, p[2]]; const up = (p, h) => [p[0], p[1] + h, p[2]];
    quad(side, si, dn(a), a, dn(a2), a2); quad(side, si, b, dn(b), b2, dn(b2)); quad(side, si, dn(b), dn(a), dn(b2), dn(a2));
    quad(rail, ri, a, up(a, 0.13), a2, up(a2, 0.13)); quad(rail, ri, b, up(b, 0.13), b2, up(b2, 0.13));
    if (o.jardim !== false) { const m = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + 0.035, p[2] + (q[2] - p[2]) * t]; quad(plant, pi, m(a, b, 0.02), m(a, b, 0.2), m(a2, b2, 0.02), m(a2, b2, 0.2)); }
  }
  const mk = (arr, idx, mat, cast = true) => { const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); bg.setIndex(idx); bg.computeVertexNormals(); const m = mesh(bg, mat, cast); g.add(m); return m; };
  mk(top, ti, dupla(M.whiteSmooth)); mk(side, si, dupla(M.fascia)); const rm = mk(rail, ri, M.glassRail, false); rm.renderOrder = 3; if (plant.length) mk(plant, pi, dupla(M.planter), false);
  const cols = []; const step = Math.max(1, Math.round(1.5 / (L / N)));
  for (let i = step; i < N; i += step) { const p = S[i]; const gy = heightAt(p.x, p.z); if (p.y - gy > 0.25) cols.push([[p.x, gy - 0.05, p.z], [p.x, p.y - 0.07, p.z]]); }
  if (cols.length) g.add(beams(cols, 0.045, M.whiteSmooth, 6));
  g.userData.caminho = S.map((p) => [p.x, p.y + 0.01, p.z]);
  return g;
}

export function passarela(id) {
  const d = PASSARELAS[id]; const root = new THREE.Group(); root.name = 'passarela-' + id; const P = { e1: deck(d.pts, d.w) }; root.add(P.e1);
  const m = d.pts[(d.pts.length / 2) | 0];
  return { id: 'pas_' + id, root, partes: P, esqueletos: {}, grua: {}, foco: { x: m[0], z: m[1], dist: 10 }, ancora: [m[0], m[2] + 1.2, m[1]], caminho: P.e1.userData.caminho };
}
// Ponte coberta (tubo envidraçado) entre a Faculdade de Ciências e a Biblioteca
export function ponteCoberta() {
  const root = new THREE.Group(); root.name = 'ponteCoberta'; const P = { e1: new THREE.Group(), e2: new THREE.Group() };
  const a = new THREE.Vector3(1.6, 1.25, -3.4), b = new THREE.Vector3(3.2, 1.25, 3.6); const d = b.clone().sub(a); const L = d.length(); const ang = Math.atan2(d.x, d.z);
  const body = new THREE.Group(); body.position.copy(a).add(b).multiplyScalar(0.5); body.rotation.y = ang; P.e2.add(body);
  const tube = mesh(new THREE.BoxGeometry(0.55, 0.45, L), M.fac_lab); const uv = tube.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * 0.3); body.add(tube);
  const roof = mesh(new THREE.BoxGeometry(0.62, 0.06, L + 0.05), M.steel); roof.position.y = 0.25; body.add(roof);
  const floor = mesh(new THREE.BoxGeometry(0.62, 0.06, L + 0.05), M.steelDark); floor.position.y = -0.25; body.add(floor);
  const cols = []; for (let t = 0.12; t < 1; t += 0.25) { const p = a.clone().lerp(b, t); cols.push([[p.x, heightAt(p.x, p.z) - 0.1, p.z], [p.x, p.y - 0.27, p.z]]); }
  P.e1.add(beams(cols, 0.06, M.whiteSmooth, 6));
  root.add(P.e1, P.e2);
  return { id: 'ponteCoberta', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: 2.4, z: 0, dist: 10 }, ancora: [2.4, 2.4, 0] };
}

export function praca() {
  const root = new THREE.Group(); root.name = 'praca'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  P.e1.userData.chao = 'praca'; // o piso é pintado no terreno ao concluir
  // e2: espelhos d'água (jardins filtrantes) com borda de pedra e juncos
  const R = rng(19);
  for (const l of A.lagosPraca) {
    const rim = plate(ellPts(l.c[0], l.c[1], l.rx + 0.14, l.rz + 0.14, l.rot), 0.0, 0.08, M.cream); P.e2.add(rim);
    const w = plate(ellPts(l.c[0], l.c[1], l.rx, l.rz, l.rot), 0.0, 0.085, M.pool); P.e2.add(w);
    const reeds = []; for (let i = 0; i < 10; i++) { const a = R() * 6.28; reeds.push({ x: l.c[0] + Math.cos(a) * l.rx * 0.8, z: l.c[1] + Math.sin(a) * l.rz * 0.8, y: 0.08, s: 0.07 + R() * 0.04, pal: 'jardim' }); }
    P.e2.add(treeGroup(reeds, { cast: false }));
  }
  // e3: palmeiras, árvores, bancos e postes de luz
  const poly = A.praca.poly; const trees = [];
  const inP = (x, z) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; };
  const nearPool = (x, z) => A.lagosPraca.some((l) => Math.hypot((x - l.c[0]) / (l.rx + 0.5), (z - l.c[1]) / (l.rz + 0.5)) < 1);
  for (let i = 0; i < 26; i++) { let x, z, k = 0; do { x = -3 + R() * 15; z = 11.6 + R() * 8; k++; } while ((!inP(x, z) || nearPool(x, z)) && k < 40); if (k >= 40) continue; trees.push({ x, z, y: 0.02, s: 0.22 + R() * 0.1, kind: R() < 0.55 ? 'palmeira' : 'folha', pal: 'jardim', h: 1.2 }); }
  P.e3.add(treeGroup(trees, { trunks: true }));
  const lamps = []; const benches = [];
  for (let i = 0; i < 16; i++) { let x, z, k = 0; do { x = -3 + R() * 15; z = 11.6 + R() * 8; k++; } while ((!inP(x, z) || nearPool(x, z)) && k < 40); if (k >= 40) continue; if (i % 2) lamps.push([x, z]); else benches.push([x, z, R() * 3]); }
  P.e3.add(beams(lamps.map(([x, z]) => [[x, 0, z], [x, 0.55, z]]), 0.012, M.steelDark, 4));
  const lg = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), M.lampGlow, lamps.length); const m4 = new THREE.Matrix4(); lamps.forEach(([x, z], i) => lg.setMatrixAt(i, m4.makeTranslation(x, 0.57, z))); P.e3.add(lg);
  const bg = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.05, 0.07), M.woodLight, benches.length); benches.forEach(([x, z, r], i) => bg.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0.05, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r, 0)), new THREE.Vector3(1, 1, 1)))); bg.castShadow = true; P.e3.add(bg);
  P.e3.userData.pessoas = { area: poly, n: 40 };
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'praca', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'terra', e3: 'crescer' }, foco: { x: 4.4, z: 15.6, dist: 13 }, ancora: [4.4, 1.2, 15.6] };
}
