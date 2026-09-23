// Interior do Anel do Campus (Escola e Campus para Jovens, campo, faculdades em blocos brancos)
// e o Gramado do Campus Universitário.
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { curve, beams, FH } from '../geom.js';
import { treeGroup } from '../forest.js';
import { hash, rng } from '../../core/util.js';
import { Faixa } from './faixa.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
function blobPts(cx, cz, rx, rz, rot, seed, n = 60) { const out = []; const c = Math.cos(rot), s = Math.sin(rot); const p1 = hash(seed, 1, 5) * 6; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = 1 + 0.12 * Math.sin(2 * a + p1) + 0.06 * Math.sin(3 * a + p1 * 2); const x = Math.cos(a) * rx * k, z = Math.sin(a) * rz * k; out.push([cx + x * c - z * s, cz + x * s + z * c]); } return out; }
function plate(pts, y, h, mat) { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); return mesh(g, mat); }

// brinquedos coloridos (torres, escorregadores, balanços, domo de escalar)
function playground(cx, cz, y, seed) {
  const g = new THREE.Group(); const R = rng(seed); const cols = [M.orange, M.red, M.yellow, M.blue, M.teal];
  for (let i = 0; i < 4; i++) {
    const x = cx + (R() - 0.5) * 1.8, z = cz + (R() - 0.5) * 1.0; const c = cols[(R() * cols.length) | 0]; const k = R();
    if (k < 0.3) { const t = mesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), c); t.position.set(x, y + 0.13, z); g.add(t); const r = mesh(new THREE.ConeGeometry(0.14, 0.14, 4), M.red); r.position.set(x, y + 0.33, z); r.rotation.y = Math.PI / 4; g.add(r); const s = mesh(new THREE.BoxGeometry(0.34, 0.02, 0.08), M.yellow); s.position.set(x + 0.2, y + 0.12, z); s.rotation.z = -0.55; g.add(s); }
    else if (k < 0.55) { const fr = []; fr.push([[x - 0.2, y, z - 0.08], [x, y + 0.24, z]], [[x - 0.2, y, z + 0.08], [x, y + 0.24, z]], [[x + 0.2, y, z - 0.08], [x, y + 0.24, z]], [[x + 0.2, y, z + 0.08], [x, y + 0.24, z]]); g.add(beams(fr, 0.012, c, 4)); const bar = mesh(new THREE.BoxGeometry(0.42, 0.02, 0.02), c); bar.position.set(x, y + 0.24, z); g.add(bar); }
    else if (k < 0.8) { const d = mesh(new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), dupla(new THREE.MeshStandardMaterial({ color: 0xee7f33, wireframe: true }))); d.position.set(x, y, z); g.add(d); }
    else { const w = mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 16), c); w.position.set(x, y + 0.12, z); w.rotation.y = R() * 3; g.add(w); }
  }
  return g;
}
// aglomerado de blocos brancos (laboratórios / institutos), dividido em duas etapas
function blocos(cx, cz, w, d, rot, nx, nz, seed) {
  const R = rng(seed); const low = new THREE.Group(), high = new THREE.Group(); const c = Math.cos(rot), s = Math.sin(rot);
  const bw = w / nx, bd = d / nz; const solar = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (R() < 0.12) continue; const u = -w / 2 + bw * (i + 0.5), v = -d / 2 + bd * (j + 0.5); const x = cx + u * c - v * s, z = cz + u * s + v * c;
    const floors = 1 + ((R() * 3) | 0); const bx = bw * (0.72 + R() * 0.2), bz = bd * (0.72 + R() * 0.2);
    for (let f = 0; f < floors; f++) {
      const grp = f === 0 ? low : high; const sw = f ? 0.88 : 1;
      const b = mesh(new THREE.BoxGeometry(bx * sw, FH - 0.04, bz * sw), f % 2 ? M.white : M.whiteSmooth); b.position.set(x, f * FH + FH / 2, z); b.rotation.y = -rot; grp.add(b);
      const win = mesh(new THREE.BoxGeometry(bx * sw * 1.01, FH * 0.36, bz * sw * 1.01), M.fac_lab, false); win.position.set(x, f * FH + FH * 0.52, z); win.rotation.y = -rot; const uv = win.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 0.12, 0.3 + uv.getY(k) * 0.12); grp.add(win);
      if (f === floors - 1) { if (R() < 0.6) solar.push([x, (f + 1) * FH, z, bx * sw * 0.7, bz * sw * 0.6]); const cap = mesh(new THREE.BoxGeometry(bx * sw + 0.03, 0.03, bz * sw + 0.03), M.fascia); cap.position.set(x, (f + 1) * FH - 0.01, z); cap.rotation.y = -rot; grp.add(cap); }
    }
  }
  const sg = new THREE.BoxGeometry(1, 0.02, 1); const sp = new THREE.InstancedMesh(sg, M.blue, solar.length); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, -rot, 0));
  solar.forEach(([x, y, z, a, b], i) => sp.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y + 0.05, z), q, new THREE.Vector3(a, 1, b)))); high.add(sp);
  return { low, high };
}

export function escola() {
  const root = new THREE.Group(); root.name = 'escola'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  // e1: bloco escolar em "S" (3 andares) — é uma fita própria
  const bloco = new Faixa({ id: 'escolaBloco', closed: false, path: curve([[-17.0, 10.4], [-15.4, 12.0], [-13.4, 11.7], [-11.9, 12.8]], false, 60), modulos: 1, prof: { o0: -0.45, o1: 0.45, setIn: 0.1, setOut: 0.1, fac: 'fac_quente' }, niveis: 3, arbustos: false });
  bloco.setTodos(3); P.e1.add(bloco.group);
  // e2: pátios em plataformas e parquinhos
  for (const [x, z, rx, rz, r, sd] of [[-16.9, 6.4, 1.6, 0.95, 0.9, 11], [-15.2, 9.0, 1.35, 0.85, 0.4, 12]]) {
    const pts = blobPts(x, z, rx, rz, r, sd); P.e2.add(plate(pts, 0.0, 0.3, M.whiteSmooth)); P.e2.add(plate(blobPts(x, z, rx - 0.08, rz - 0.08, r, sd), 0.3, 0.02, M.sand)); P.e2.add(playground(x, z, 0.32, sd));
  }
  // e3: piscina com deque
  const px = -15.9, pz = 4.3, rot = 0.55; const pool = plate(blobPts(px, pz, 1.25, 0.55, rot, 21), 0.16, 0.02, M.pool); P.e3.add(plate(blobPts(px, pz, 1.55, 0.8, rot, 21), 0.0, 0.17, M.woodLight)); P.e3.add(pool);
  const lg = []; for (let i = 0; i < 5; i++) lg.push(mesh(new THREE.BoxGeometry(0.16, 0.03, 0.07), M.white));
  lg.forEach((l, i) => { l.position.set(px - 0.9 + i * 0.42, 0.2, pz + 0.72 - i * 0.18); l.rotation.y = -rot; P.e3.add(l); });
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'escola', root, partes: P, esqueletos: {}, grua: { e1: true }, foco: { x: -15.2, z: 8.6, dist: 12 }, ancora: [-15.2, 2.2, 9] };
}
export function campo() {
  const c = A.campo; const root = new THREE.Group(); root.name = 'campo'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  const g = new THREE.PlaneGeometry(c.w + 0.6, c.d + 0.6); g.rotateX(-Math.PI / 2);
  const soil = mesh(g, M.soil, false); soil.position.set(c.c[0], 0.03, c.c[1]); soil.rotation.y = -c.rot; P.e1.add(soil);
  const f = new THREE.PlaneGeometry(c.w, c.d); f.rotateX(-Math.PI / 2); const field = mesh(f, M.field, false); field.position.set(c.c[0], 0.045, c.c[1]); field.rotation.y = -c.rot; P.e2.add(field);
  // arquibancada em degraus ao longo do lado de trás e torres de luz
  const st = new THREE.Group(); st.position.set(c.c[0], 0, c.c[1]); st.rotation.y = -c.rot; P.e3.add(st);
  for (let k = 0; k < 5; k++) { const b = mesh(new THREE.BoxGeometry(c.w * 0.8, 0.07 * (k + 1), 0.2), k % 2 ? M.grey : M.concreto); b.position.set(0, 0.035 * (k + 1), -c.d / 2 - 0.35 - k * 0.2); st.add(b); }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const px = (x * c.w) / 2 + x * 0.25, pz = (z * c.d) / 2 + z * 0.25; st.add(beams([[[px, 0, pz], [px, 1.3, pz]]], 0.025, M.steel, 5)); const l = mesh(new THREE.BoxGeometry(0.2, 0.08, 0.05), M.lampGlow, false); l.position.set(px, 1.32, pz); l.lookAt(0, 0, 0); st.add(l); }
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'campo', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'terra', e2: 'crescer' }, foco: { x: c.c[0], z: c.c[1], dist: 11 }, ancora: [c.c[0], 1.2, c.c[1]] };
}
export function engenharia() {
  const root = new THREE.Group(); root.name = 'engenharia'; const b = blocos(-3.3, 12.0, 4.6, 1.7, -0.42, 6, 2, 31);
  const P = { e1: b.low, e2: b.high }; root.add(P.e1, P.e2);
  return { id: 'engenharia', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: -3.3, z: 12, dist: 10 }, ancora: [-3.3, 1.8, 12] };
}
export function instituto() {
  const root = new THREE.Group(); root.name = 'instituto'; const b = blocos(-0.1, 6.9, 2.1, 4.4, 0.38, 3, 6, 47);
  const P = { e1: b.low, e2: b.high }; root.add(P.e1, P.e2);
  return { id: 'instituto', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: -0.1, z: 6.9, dist: 10 }, ancora: [-0.1, 1.8, 6.9] };
}
// Gramado do Campus Universitário (campo e pista dentro do "C")
export function gramadoUni() {
  const u = A.uni; const root = new THREE.Group(); root.name = 'gramadoUni'; const P = { e1: new THREE.Group() };
  const f = new THREE.PlaneGeometry(4.6, 2.6); f.rotateX(-Math.PI / 2); const field = mesh(f, M.field, false); field.position.set(u.c[0] + 1.2, 0.04, u.c[1] + 0.2); field.rotation.y = -u.rot; P.e1.add(field);
  const tr = []; const R = rng(88); for (let i = 0; i < 12; i++) { const a = R() * 6.28; tr.push({ x: u.c[0] + 1.2 + Math.cos(a) * 3.2, z: u.c[1] + 0.2 + Math.sin(a) * 2.2, s: 0.22 + R() * 0.1, pal: 'jardim' }); }
  P.e1.add(treeGroup(tr)); root.add(P.e1);
  return { id: 'gramadoUni', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'crescer' }, foco: { x: u.c[0], z: u.c[1], dist: 14 }, ancora: [u.c[0] + 1, 1.2, u.c[1]] };
}
