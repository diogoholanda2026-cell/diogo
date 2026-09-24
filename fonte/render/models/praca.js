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
function plate(pts, y, h, mat) { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); return mesh(g, mat); }

// Deque elevado ao longo de uma curva 3D: piso branco, frisos, guarda-corpo de vidro, jardineira e pilares.
export function deck(pts, w, o = {}) {
  const g = new THREE.Group(); const c = new THREE.CatmullRomCurve3(pts.map(([x, z, h]) => new THREE.Vector3(x, Math.max(heightAt(x, z), 0) + h, z)));
  const L = c.getLength(); const N = Math.max(8, Math.ceil(L / 0.2)); const S = c.getSpacedPoints(N);
  const top = [], side = [], rail = [], plant = [], ti = [], si = [], ri = [], pi = []; const arb = [];
  const quad = (arr, idx, a, b, cc, d) => { const k = arr.length / 3; arr.push(...a, ...b, ...cc, ...d); idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); };
  const L2 = [], R2 = [];
  for (let i = 0; i <= N; i++) { const p = S[i], q = S[Math.min(N, i + 1)], r = S[Math.max(0, i - 1)]; let tx = q.x - r.x, tz = q.z - r.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; const nx = tz, nz = -tx; L2.push([p.x + nx * w / 2, p.y, p.z + nz * w / 2]); R2.push([p.x - nx * w / 2, p.y, p.z - nz * w / 2]); }
  for (let i = 0; i < N; i++) {
    const a = L2[i], b = R2[i], a2 = L2[i + 1], b2 = R2[i + 1];
    quad(top, ti, a, b, a2, b2);
    const dn = (p) => [p[0], p[1] - 0.07, p[2]]; const up = (p, h) => [p[0], p[1] + h, p[2]];
    quad(side, si, dn(a), a, dn(a2), a2); quad(side, si, b, dn(b), b2, dn(b2)); quad(side, si, dn(b), dn(a), dn(b2), dn(a2));
    quad(rail, ri, a, up(a, 0.13), a2, up(a2, 0.13)); quad(rail, ri, b, up(b, 0.13), b2, up(b2, 0.13));
    if (o.jardim !== false) { // floreiras dos dois lados (0 a 0.22 e 0.78 a 1 da largura), 0.06 de altura
      const m = (p, q, t, h) => [p[0] + (q[0] - p[0]) * t, p[1] + h, p[2] + (q[2] - p[2]) * t];
      for (const [t0, t1] of [[0, 0.22], [0.78, 1]]) { quad(plant, pi, m(a, b, t0, 0.06), m(a, b, t1, 0.06), m(a2, b2, t0, 0.06), m(a2, b2, t1, 0.06)); const ti2 = t0 ? t0 : t1; quad(plant, pi, m(a, b, ti2, 0), m(a, b, ti2, 0.06), m(a2, b2, ti2, 0), m(a2, b2, ti2, 0.06)); }
    }
  }
  // arbustos nas floreiras, a cada 0.6 alternando os lados
  if (o.jardim !== false) { const passo = Math.max(1, Math.round(0.6 / (L / N))); for (let i = 1, k = 0; i < N; i += passo, k++) { const t = k % 2 ? 0.89 : 0.11; const a = L2[i], b = R2[i]; arb.push({ x: a[0] + (b[0] - a[0]) * t, z: a[2] + (b[2] - a[2]) * t, y: a[1] + 0.05, s: 0.07, kind: 'folhaLow', pal: 'jardim', h: 0.8 }); } }
  const mk = (arr, idx, mat, cast = true) => { const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); bg.setIndex(idx); bg.computeVertexNormals(); const m = mesh(bg, mat, cast); g.add(m); return m; };
  mk(top, ti, dupla(M.whiteSmooth)); mk(side, si, dupla(M.fascia)); const rm = mk(rail, ri, M.glassRail, false); rm.renderOrder = 3; if (plant.length) mk(plant, pi, dupla(M.planter), false);
  const cols = []; const step = Math.max(1, Math.round(1.5 / (L / N)));
  for (let i = step; i < N; i += step) { const p = S[i]; const gy = heightAt(p.x, p.z); if (p.y - gy > 0.25) cols.push([[p.x, gy - 0.05, p.z], [p.x, p.y - 0.07, p.z]]); }
  if (cols.length) g.add(beams(cols, 0.045, M.whiteSmooth, 6));
  if (arb.length) g.add(treeGroup(arb, { cast: false, name: 'floreiras' }));
  g.userData.caminho = S.map((p) => [p.x, p.y + 0.01, p.z]);
  if (Math.max(...pts.map((p) => p[2])) > 0.5) g.userData.semHAO = true; // passarela alta fica fora do mapa de alturas
  return g;
}

// patamar sobre pilares no fim de uma rampa, encostado numa fachada: laje e guarda-corpo nos lados
function patamar(pt, y) {
  const g = new THREE.Group(); g.position.set(pt.c[0], 0, pt.c[1]); g.rotation.y = -pt.rot; const { w, d } = pt; // local: x para fora da fachada
  const laje = mesh(new THREE.BoxGeometry(d, 0.07, w), M.whiteSmooth); laje.position.set(0, y - 0.035, 0); g.add(laje);
  const gc = []; for (const s of [-1, 1]) gc.push([-d / 2, s * w / 2, d / 2, s * w / 2]);
  const rg = new THREE.Group(); for (const [x0, z0, x1] of gc) { const r = mesh(new THREE.BoxGeometry(x1 - x0, 0.13, 0.015), M.glassRail, false); r.position.set((x0 + x1) / 2, y + 0.065, z0); r.renderOrder = 3; rg.add(r); } g.add(rg);
  const cols = []; for (const s of [-1, 1]) { const x = d / 2 - 0.08, z = s * (w / 2 - 0.08); cols.push([[x, -0.05, z], [x, y - 0.07, z]]); } g.add(beams(cols, 0.04, M.whiteSmooth, 6));
  return g;
}

export function passarela(id) {
  const d = PASSARELAS[id]; const root = new THREE.Group(); root.name = 'passarela-' + id; const P = { e1: deck(d.pts, d.w) }; root.add(P.e1);
  if (d.patamar) { const f = d.pts[d.pts.length - 1]; P.e1.add(patamar(d.patamar, Math.max(heightAt(f[0], f[1]), 0) + f[2])); }
  const m = d.pts[(d.pts.length / 2) | 0];
  return { id: 'pas_' + id, root, partes: P, esqueletos: {}, grua: {}, foco: { x: m[0], z: m[1], dist: 10 }, ancora: [m[0], m[2] + 1.2, m[1]], caminho: P.e1.userData.caminho };
}
// Ponte coberta (tubo envidraçado) entre a Faculdade de Ciências e a Biblioteca
export function ponteCoberta() {
  const root = new THREE.Group(); root.name = 'ponteCoberta'; const P = { e1: new THREE.Group(), e2: new THREE.Group() };
  // sai do piso térreo elevado da Faculdade de Ciências e pousa no deque da Ponte do Instituto
  const a = new THREE.Vector3(0.8, 1.5, -2.6), b = new THREE.Vector3(3.4, 1.25, 4.9); const d = b.clone().sub(a); const L = d.length(); const ang = Math.atan2(d.x, d.z);
  const body = new THREE.Group(); body.position.copy(a).add(b).multiplyScalar(0.5); body.rotation.set(-Math.atan2(d.y, Math.hypot(d.x, d.z)), ang, 0, 'YXZ'); P.e2.add(body);
  const tube = mesh(new THREE.BoxGeometry(0.55, 0.45, L), M.fac_lab); const uv = tube.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * 0.3); body.add(tube);
  const roof = mesh(new THREE.BoxGeometry(0.62, 0.06, L + 0.05), M.steel); roof.position.y = 0.25; body.add(roof);
  const floor = mesh(new THREE.BoxGeometry(0.62, 0.06, L + 0.05), M.steelDark); floor.position.y = -0.25; body.add(floor);
  const cols = []; for (let t = 0.12; t < 1; t += 0.25) { const p = a.clone().lerp(b, t); cols.push([[p.x, heightAt(p.x, p.z) - 0.1, p.z], [p.x, p.y - 0.27, p.z]]); }
  P.e1.add(beams(cols, 0.06, M.whiteSmooth, 6));
  root.add(P.e1, P.e2);
  return { id: 'ponteCoberta', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: 2.1, z: 1.2, dist: 10 }, ancora: [2.1, 2.5, 1.2] };
}

// contorno orgânico (elipse com bojos) — mesmos coeficientes dos pátios do Anel
function blobPts(cx, cz, rx, rz, rot, seed, n = 56) { const out = []; const c = Math.cos(rot), s = Math.sin(rot); const p1 = hash(seed, 1, 5) * 6; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = 1 + 0.12 * Math.sin(2 * a + p1) + 0.06 * Math.sin(3 * a + p1 * 2); const x = Math.cos(a) * rx * k, z = Math.sin(a) * rz * k; out.push([cx + x * c - z * s, cz + x * s + z * c]); } return out; }
const distSeg = (x, z, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz || 1))); return Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t); };
const distLinha = (x, z, l) => { let d = 1e9; for (let i = 1; i < l.length; i++) d = Math.min(d, distSeg(x, z, l[i - 1], l[i])); return d; };
// ponto a uma distância d ao longo de uma polilinha, e a normal ali
function aoLongo(l, d) { for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i]; const s = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= s || i === l.length - 1) { const t = Math.min(1, d / s); return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], n: [(b[1] - a[1]) / s, -(b[0] - a[0]) / s] }; } d -= s; } return null; }
const compr = (l) => { let s = 0; for (let i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return s; };

export function praca() {
  const root = new THREE.Group(); root.name = 'praca'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  P.e1.userData.chao = 'praca'; // o piso (com os caminhos em leque) é pintado no terreno ao concluir
  const poly = A.praca.poly; const cam = A.pracaCaminhos || [];
  const inP = (x, z) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; };
  const nearPool = (x, z, m = 0.5) => A.lagosPraca.some((l) => { const c = Math.cos(-l.rot), s = Math.sin(-l.rot); const dx = x - l.c[0], dz = z - l.c[1]; const u = dx * c - dz * s, v = dx * s + dz * c; return Math.hypot(u / (l.rx * 1.18 + m), v / (l.rz * 1.18 + m)) < 1; });
  const noCaminho = (x, z, m) => cam.some((l) => distLinha(x, z, l) < m);
  // e2: espelhos d'água orgânicos e escuros (jardins filtrantes), borda plantada, arbustos e uma ilha arborizada
  const R = rng(19); const arb = [], ilhaArv = [];
  A.lagosPraca.forEach((l, li) => {
    P.e2.add(plate(blobPts(l.c[0], l.c[1], l.rx + 0.2, l.rz + 0.2, l.rot, 30 + li), 0.0, 0.06, M.planter));
    P.e2.add(plate(blobPts(l.c[0], l.c[1], l.rx, l.rz, l.rot, 30 + li), 0.0, 0.07, M.pool));
    const b = blobPts(l.c[0], l.c[1], l.rx + 0.12, l.rz + 0.12, l.rot, 30 + li, 30);
    for (let i = 0; i < 30; i++) { const [x, z] = b[i]; arb.push({ x: x + (R() - 0.5) * 0.12, z: z + (R() - 0.5) * 0.12, y: 0.06, s: 0.1 + R() * 0.06, kind: 'folhaLow', pal: 'jardim', h: 0.8 }); }
    if (li === 0) { const ix = l.c[0] - l.rx * 0.35, iz = l.c[1] + 0.05; P.e2.add(plate(blobPts(ix, iz, 0.42, 0.26, l.rot, 77), 0.0, 0.09, M.planter)); for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.28 + R(); ilhaArv.push({ x: ix + Math.cos(a) * 0.2, z: iz + Math.sin(a) * 0.12, y: 0.09, s: 0.3 + R() * 0.1, kind: 'folha', pal: 'jardim', h: 1.1 }); } }
  });
  P.e2.add(treeGroup(arb, { cast: false, name: 'borda-lagos' })); P.e2.add(treeGroup(ilhaArv, { name: 'ilha-praca' }));
  // e3: árvores de copa larga em grupos junto aos caminhos (1/4 palmeiras), bancos e postes ao longo deles
  const trees = []; const livre = (x, z) => inP(x, z) && !nearPool(x, z, 0.25) && !noCaminho(x, z, 0.36) && trees.every((t) => Math.hypot(t.x - x, t.z - z) > 0.35);
  for (let t = 0; trees.length < 40 && t < 900; t++) {
    const l = cam[(R() * cam.length) | 0]; if (!l) break; const q = aoLongo(l, R() * compr(l)); if (!q) continue; const lado = R() < 0.5 ? -1 : 1; const off = 0.65 + R() * 0.8;
    const cx = q.p[0] + q.n[0] * off * lado, cz = q.p[1] + q.n[1] * off * lado; if (!livre(cx, cz)) continue;
    const n = 3 + ((R() * 3) | 0);
    for (let k = 0, u = 0; k < n && trees.length < 40 && u < 20; u++) { const x = cx + (R() - 0.5) * 1.2, z = cz + (R() - 0.5) * 1.2; if (!livre(x, z)) continue; k++; const palm = R() < 0.25; trees.push({ x, z, y: 0.02, s: palm ? 0.24 + R() * 0.06 : 0.28 + R() * 0.14, kind: palm ? 'palmeira' : 'folha', pal: 'jardim', h: palm ? 1.2 : 1.0 }); }
  }
  P.e3.add(treeGroup(trees, { trunks: true }));
  const lamps = [], benches = [];
  const total = cam.reduce((s, l) => s + compr(l), 0);
  for (const [lista, n, off] of [[lamps, 20, 0.38], [benches, 24, 0.32]]) {
    for (let i = 0; i < n; i++) { let d = ((i + 0.5 + (lista === benches ? 0.37 : 0)) / n) * total; let l = null; for (const c of cam) { const L = compr(c); if (d <= L) { l = c; break; } d -= L; } if (!l) continue; const q = aoLongo(l, d); const lado = i % 2 ? 1 : -1; const x = q.p[0] + q.n[0] * off * lado, z = q.p[1] + q.n[1] * off * lado; if (!inP(x, z) || nearPool(x, z, 0.1)) continue; lista.push([x, z, Math.atan2(q.n[0], q.n[1])]); }
  }
  P.e3.add(beams(lamps.map(([x, z]) => [[x, 0, z], [x, 0.55, z]]), 0.012, M.steelDark, 4));
  const lg = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), M.lampGlow, lamps.length); const m4 = new THREE.Matrix4(); lamps.forEach(([x, z], i) => lg.setMatrixAt(i, m4.makeTranslation(x, 0.57, z))); P.e3.add(lg);
  const bg = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.05, 0.07), M.woodLight, benches.length); const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1); benches.forEach(([x, z, r], i) => bg.setMatrixAt(i, m4.compose(v.set(x, 0.05, z), q.setFromEuler(e.set(0, r, 0)), one))); bg.castShadow = true; P.e3.add(bg);
  P.e3.userData.pessoas = { area: poly, n: 110 };
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'praca', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'terra', e3: 'crescer' }, foco: { x: 4.2, z: 15.8, dist: 13 }, ancora: [4.2, 1.2, 15.8] };
}
