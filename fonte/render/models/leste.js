// Lado leste da composição: Bioma Aquático (cúpula geodésica com aquário), Vila Estudantil
// (anfiteatro e casas brancas), Recinto dos Gorilas (passarela anelar), Acelerador de Partículas
// (poço em corte) e os Habitats Expandidos da savana.
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { beams, merge, FH } from '../geom.js';
import { treeGroup } from '../forest.js';
import { Manada, animalGeos, animalMaterial } from '../animais.js';
import { heightAt } from '../ground.js';
import { hash, rng } from '../../core/util.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
export function rocha(x, z, s, seed = 1, y = null) {
  const g = new THREE.DodecahedronGeometry(1, 1); const p = g.attributes.position; const R = rng(seed * 97 + 5);
  const k = new Map(); for (let i = 0; i < p.count; i++) { const key = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); if (!k.has(key)) k.set(key, 0.75 + R() * 0.5); const f = k.get(key); p.setXYZ(i, p.getX(i) * f, Math.max(-0.2, p.getY(i)) * f * 0.8, p.getZ(i) * f); }
  g.computeVertexNormals(); const m = mesh(g, M.rock); m.scale.set(s, s * (0.7 + R() * 0.5), s * (0.8 + R() * 0.3)); m.rotation.y = R() * 6; m.position.set(x, (y ?? heightAt(x, z)) + s * 0.1, z); return m;
}
function ellShape(cx, cz, rx, rz, rot = 0, n = 64) { const s = new THREE.Shape(); for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; const u = Math.cos(a) * rx, v = Math.sin(a) * rz; const x = cx + u * Math.cos(rot) - v * Math.sin(rot), z = cz + u * Math.sin(rot) + v * Math.cos(rot); i ? s.lineTo(x, -z) : s.moveTo(x, -z); } return s; }
function flatShape(shape, mat, y) { const g = new THREE.ShapeGeometry(shape, 48); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); const m = mesh(g, mat, false); m.position.y = y; return m; }
// anel elíptico vertical (paredes, guarda-corpos)
function ellWall(cx, cz, rx, rz, y0, h, mat, a0 = 0, a1 = Math.PI * 2, seg = 72, side = THREE.DoubleSide) {
  const pos = [], idx = []; for (let i = 0; i <= seg; i++) { const a = a0 + ((a1 - a0) * i) / seg; const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz; pos.push(x, y0, z, x, y0 + h, z); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const uv = []; for (let i = 0; i <= seg; i++) uv.push(i / seg * (rx + rz) * 1.2, 0, i / seg * (rx + rz) * 1.2, 1); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return mesh(g, side === THREE.DoubleSide ? dupla(mat) : mat);
}
// deque anelar elevado (passarela em anel) com pilares e guarda-corpos de vidro
function ringDeck(cx, cz, rx, rz, y, w, seg = 96) {
  const g = new THREE.Group(); const top = [], idx = [];
  for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; const c = Math.cos(a), s = Math.sin(a); top.push(cx + c * (rx - w / 2), y, cz + s * (rz - w / 2), cx + c * (rx + w / 2), y, cz + s * (rz + w / 2)); if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(top, 3)); dg.setIndex(idx); dg.computeVertexNormals();
  const deck = mesh(dg, dupla(M.whiteSmooth)); g.add(deck);
  const under = deck.clone(); under.position.y = -0.06; g.add(under);
  g.add(ellWall(cx, cz, rx + w / 2, rz + w / 2, y - 0.06, 0.06, M.fascia));
  g.add(ellWall(cx, cz, rx - w / 2, rz - w / 2, y - 0.06, 0.06, M.fascia));
  const rail1 = ellWall(cx, cz, rx + w / 2, rz + w / 2, y, 0.14, M.glassRail); rail1.castShadow = false; g.add(rail1);
  const rail2 = ellWall(cx, cz, rx - w / 2, rz - w / 2, y, 0.14, M.glassRail); rail2.castShadow = false; g.add(rail2);
  const posts = []; for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz; posts.push([[x, heightAt(x, z) - 0.1, z], [x, y - 0.06, z]]); }
  g.add(beams(posts, 0.05, M.whiteSmooth, 6));
  return g;
}

// ---------------- Bioma Aquático de Conservação ----------------
function geodome(rx, rz, h, detail = 4) {
  const ico = new THREE.IcosahedronGeometry(1, detail); const p = ico.attributes.position; const tri = []; const edges = new Map();
  const V = (i) => [p.getX(i), p.getY(i), p.getZ(i)];
  const tf = ([x, y, z]) => [x * rx, Math.max(0, y) * h, z * rz];
  for (let i = 0; i < p.count; i += 3) {
    const a = V(i), b = V(i + 1), c = V(i + 2); if ((a[1] + b[1] + c[1]) / 3 < -0.02) continue;
    const A2 = tf(a), B2 = tf(b), C2 = tf(c); tri.push(...A2, ...B2, ...C2);
    for (const [u, v] of [[A2, B2], [B2, C2], [C2, A2]]) { const k1 = u.map((q) => q.toFixed(3)).join(), k2 = v.map((q) => q.toFixed(3)).join(); const key = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1; if (!edges.has(key)) edges.set(key, [u, v]); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals();
  return { glass: g, edges: [...edges.values()] };
}
export function bioma() {
  const [cx, cz] = A.bioma.c; const r = A.bioma.r; const rx = r + 0.3, rz = r * 0.84, h = 3.8;
  const root = new THREE.Group(); root.name = 'bioma'; root.position.set(cx, 0, cz); const P = {};
  // e1: fundação, tanque e areia
  P.e1 = new THREE.Group();
  P.e1.add(flatShape(ellShape(0, 0, rx + 0.35, rz + 0.35), M.whiteSmooth, 0.03));
  P.e1.add(ellWall(0, 0, rx * 0.97, rz * 0.97, 0, 0.25, M.concreto));
  const sand = flatShape(ellShape(0, 0, rx * 0.95, rz * 0.95), M.sand, 0.06); P.e1.add(sand);
  for (let i = 0; i < 7; i++) { const a = hash(i, 1, 501) * 6.28, d = 0.3 + hash(i, 2, 501) * 0.55; P.e1.add(rocha(Math.cos(a) * rx * d, Math.sin(a) * rz * d, 0.28 + hash(i, 3, 501) * 0.35, 500 + i, 0.1)); }
  // e2: estrutura geodésica
  const d = geodome(rx, rz, h, 4); P.e2 = new THREE.Group();
  P.e2.add(beams(d.edges.map(([a, b]) => [a, b]), 0.022, M.steel, 4));
  P.e2.add(ellWall(0, 0, rx, rz, 0, 0.12, M.steelDark));
  // e3: painéis de vidro
  P.e3 = new THREE.Group(); const gl = mesh(d.glass, M.glassDome, false); gl.renderOrder = 4; P.e3.add(gl);
  // e4: aquário vivo (água, baleia, arraias e cardume)
  P.e4 = new THREE.Group();
  const wg = new THREE.CylinderGeometry(1, 1, 1.15, 48, 1, false); wg.scale(rx * 0.95, 1, rz * 0.95); wg.translate(0, 0.62, 0);
  const water = mesh(wg, M.waterDeep, false); water.renderOrder = 2; P.e4.add(water);
  const faunaW = new THREE.Group(); P.e4.add(faunaW);
  const bal = new THREE.InstancedMesh(animalGeos().baleia, animalMaterial(), 1); const ar = new THREE.InstancedMesh(animalGeos().arraia, animalMaterial(), 3); const px = new THREE.InstancedMesh(animalGeos().peixe, animalMaterial(), 40);
  faunaW.add(bal, ar, px); P.e4.userData.fauna = { bal, ar, px, rx, rz };
  const inner = { update(t) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const T = t * 0.00012; e.set(0, -T * 6.28 - Math.PI / 2, Math.sin(t * 0.0008) * 0.05); q.setFromEuler(e); p.set(Math.cos(T * 6.28) * rx * 0.55, 0.5, Math.sin(T * 6.28) * rz * 0.5); s.setScalar(0.9); bal.setMatrixAt(0, m4.compose(p, q, s)); bal.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 3; i++) { const u = T * 1.6 + i * 2.1; e.set(0, -u * 6.28 - Math.PI / 2, 0); q.setFromEuler(e); p.set(Math.cos(u * 6.28) * rx * 0.35, 0.25 + i * 0.12, Math.sin(u * 6.28) * rz * 0.35); s.setScalar(0.7); ar.setMatrixAt(i, m4.compose(p, q, s)); } ar.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 40; i++) { const u = T * 3 + (i % 8) * 0.012 + ((i / 8) | 0) * 0.2; const rr = 0.25 + ((i * 7) % 5) * 0.08; e.set(0, -u * 6.28 - Math.PI / 2, 0); q.setFromEuler(e); p.set(Math.cos(u * 6.28) * rx * rr + ((i * 13) % 7) * 0.03, 0.35 + ((i * 11) % 6) * 0.1, Math.sin(u * 6.28) * rz * rr); s.setScalar(0.8); px.setMatrixAt(i, m4.compose(p, q, s)); } px.instanceMatrix.needsUpdate = true;
  } };
  P.e4.userData.update = inner.update;
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'bioma', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: cx, z: cz, dist: 13 }, ancora: [cx, h + 0.8, cz] };
}

// ---------------- Vila Estudantil Expandida ----------------
function sector(r0, r1, a0, a1, h, y, mat, seg = 40) {
  const s = new THREE.Shape(); for (let i = 0; i <= seg; i++) { const a = a0 + ((a1 - a0) * i) / seg; const x = Math.cos(a) * r1, z = Math.sin(a) * r1; i ? s.lineTo(x, -z) : s.moveTo(x, -z); }
  for (let i = seg; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / seg; s.lineTo(Math.cos(a) * r0, -Math.sin(a) * r0); }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 4 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  return mesh(g, mat);
}
export function anfiteatro() {
  const [cx, cz] = A.anfiteatro.c; const root = new THREE.Group(); root.name = 'anfiteatro'; root.position.set(cx, 0, cz); root.rotation.y = -0.2; const P = {};
  const a0 = Math.PI * 0.32, a1 = Math.PI * 1.68; // abre para o leste (casas)
  P.e1 = new THREE.Group(); // escavação e arquibancadas
  const RA = A.anfiteatro.r; for (let k = 0; k < 10; k++) P.e1.add(sector(1.1 + k * 0.17, RA, a0, a1, 0.09, k * 0.09, k % 2 ? M.grey : M.concreto));
  P.e1.add(flatShape(ellShape(0, 0, 1.1, 1.1), M.pavers, 0.02));
  P.e2 = new THREE.Group(); // palco, cobertura leve e iluminação
  const stage = sector(0, 0.85, -Math.PI * 0.45, Math.PI * 0.45, 0.12, 0, M.woodLight); stage.position.x = 0.4; P.e2.add(stage);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.8, 24, 1, true, Math.PI * 0.05, Math.PI * 0.9), dupla(M.whiteSmooth)); back.position.set(0.65, 0.4, 0); back.rotation.y = Math.PI / 2; back.castShadow = true; P.e2.add(back);
  const lamps = []; for (let i = 0; i < 7; i++) { const a = a0 + ((a1 - a0) * (i + 0.5)) / 7; const rr = A.anfiteatro.r + 0.05; lamps.push([[Math.cos(a) * rr, 0.9, Math.sin(a) * rr], [Math.cos(a) * rr, 1.3, Math.sin(a) * rr]]); }
  P.e2.add(beams(lamps, 0.02, M.steelDark, 4)); for (const [, b] of lamps) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), M.lampGlow); l.position.set(...b); P.e2.add(l); }
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'anfiteatro', root, partes: P, esqueletos: {}, grua: {}, foco: { x: cx + 1.5, z: cz, dist: 11 }, ancora: [cx, 1.6, cz] };
}
// Casas brancas empilhadas: módulos residenciais (nível 1 a 3)
export class CasasVila {
  constructor() {
    const v = A.vila; this.group = new THREE.Group(); this.group.name = 'casas'; this.id = 'casas'; this.group.position.set(v.c[0], 0, v.c[1]); this.group.rotation.y = -0.32;
    this.mods = [[-1.8, -0.7], [-0.4, -0.85], [1.0, -0.6], [-1.3, 0.75], [0.15, 0.62], [1.6, 0.8]].map(([x, z], i) => ({ i, x, z, nivel: 0, g: null, w: 1.25 + hash(i, 1, 71) * 0.25, d: 1.05 + hash(i, 2, 71) * 0.2 }));
    this.max = 3;
  }
  _casa(m, n) {
    const g = new THREE.Group(); const fh = 0.44;
    for (let f = 0; f < n; f++) {
      const w = m.w * (1 - f * 0.12), d = m.d * (1 - f * 0.08), ox = f === 1 ? 0.12 : f === 2 ? -0.1 : 0;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, fh, d), M.white); body.position.set(m.x + ox, f * fh + fh / 2, m.z); body.castShadow = true; body.receiveShadow = true; g.add(body);
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, fh * 0.45, 0.02), M.fac_quente); win.position.set(m.x + ox, f * fh + fh * 0.52, m.z + d / 2 + 0.005); g.add(win);
      const win2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, fh * 0.45, d * 0.5), M.fac_quente); win2.position.set(m.x + ox + w / 2 + 0.005, f * fh + fh * 0.52, m.z); g.add(win2);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.035, d + 0.04), M.fascia); cap.position.set(m.x + ox, (f + 1) * fh, m.z); g.add(cap);
    }
    if (n >= 3) { const t = new THREE.Mesh(new THREE.BoxGeometry(m.w * 0.5, 0.02, m.d * 0.4), M.roof); t.position.set(m.x - 0.1, n * 0.44 + 0.03, m.z); g.add(t); }
    return g;
  }
  setNivel(i, n) { const m = this.mods[i]; if (m.g) this.group.remove(m.g); m.nivel = n; m.g = n > 0 ? this._casa(m, n) : null; if (m.g) this.group.add(m.g); }
  setTodos(n) { for (const m of this.mods) this.setNivel(m.i, n); }
  andar(i, f, F) { const m = this.mods[i]; const full = this._casa(m, F); const acabado = new THREE.Group(); const ch = full.children.filter((c) => c.position.y >= f * 0.44 - 0.01); for (const c of ch) acabado.add(c); return { acabado, esqueleto: null }; }
  centro(i) { const m = this.mods[i]; const v = new THREE.Vector3(m.x, 0, m.z).applyMatrix4(this.group.matrixWorld); return [v.x, v.z]; }
  alturaTopo(n) { return n * 0.44 + 0.1; }
  refresh() {}
}

// ---------------- Recinto dos Gorilas ----------------
export function gorilas() {
  const g0 = A.gorilas; const [cx, cz] = g0.c; const root = new THREE.Group(); root.name = 'gorilas'; const P = {};
  P.e1 = new THREE.Group(); // rochedos, fosso e gramado
  P.e1.add(flatShape(ellShape(cx, cz, g0.rx, g0.rz), M.lawn, 0.03));
  P.e1.add(ellWall(cx, cz, g0.rx + 0.05, g0.rz + 0.05, -0.05, 0.14, M.concreto));
  for (const [x, z, s] of A.rochas) P.e1.add(rocha(x, z, s * 0.9, (x * 13) | 0));
  P.e2 = new THREE.Group(); P.e2.add(ringDeck(cx, cz, g0.rx + 0.45, g0.rz + 0.45, 0.95, 0.42)); // passarela anelar elevada
  const fence = ellWall(cx, cz, g0.rx + 0.08, g0.rz + 0.08, 0.05, 0.42, M.glassRail); fence.castShadow = false; P.e2.add(fence);
  P.e3 = new THREE.Group(); // abrigo e árvores
  const hut = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.35, 8), M.wood); hut.position.set(cx + g0.rx * 0.55, 0.2, cz - g0.rz * 0.45); hut.castShadow = true; P.e3.add(hut);
  const roofH = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.35, 8), M.woodFrame); roofH.position.set(cx + g0.rx * 0.55, 0.55, cz - g0.rz * 0.45); roofH.castShadow = true; P.e3.add(roofH);
  const tr = []; for (let i = 0; i < 6; i++) { const a = hash(i, 1, 611) * 6.28, d = 0.55 + hash(i, 2, 611) * 0.3; tr.push({ x: cx + Math.cos(a) * g0.rx * d, z: cz + Math.sin(a) * g0.rz * d, s: 0.3 + hash(i, 3, 611) * 0.15, pal: 'jardim', trunk: true, h: 1.3 }); }
  P.e3.add(treeGroup(tr, { trunks: true }));
  P.e4 = new THREE.Group(); // família de gorilas (estátuas vivas da foto: bem grandes)
  const gi = new THREE.InstancedMesh(animalGeos().gorila, animalMaterial(), 5); const m4 = new THREE.Matrix4(); const poses = [[-1.6, -0.3, 0.6, 1.7], [-0.2, -0.9, 2.2, 1.55], [1.0, 0.35, 3.4, 1.8], [-0.8, 0.85, 5.2, 1.35], [1.9, -0.6, 1.2, 1.5]];
  poses.forEach(([x, z, a, s], i) => { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)); m4.compose(new THREE.Vector3(cx + x, 0.03, cz + z), q, new THREE.Vector3(s, s, s)); gi.setMatrixAt(i, m4); });
  gi.castShadow = true; gi.receiveShadow = true; P.e4.add(gi);
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'gorilas', root, partes: P, esqueletos: {}, grua: {}, foco: { x: cx - 1, z: cz - 1, dist: 11 }, ancora: [cx, 2.2, cz] };
}

// ---------------- Acelerador de Partículas Subterrâneo ----------------
export function acelerador() {
  const a = A.acelerador; const [cx, cz] = a.c; const root = new THREE.Group(); root.name = 'acelerador'; const P = {}; const D = 2.3;
  P.e1 = new THREE.Group(); // escavação do poço: paredes e piso
  const wall = ellWall(cx, cz, a.rx, a.rz, -D, D + 0.04, M.concreto); P.e1.add(wall);
  const fl = flatShape(ellShape(cx, cz, a.rx, a.rz), M.grey, -D); P.e1.add(fl);
  for (let k = 1; k < 4; k++) P.e1.add(ellWall(cx, cz, a.rx - 0.01, a.rz - 0.01, -D + k * 0.55, 0.05, M.fascia));
  const rim = ellWall(cx, cz, a.rx + 0.08, a.rz + 0.08, -0.02, 0.2, M.whiteSmooth); P.e1.add(rim);
  P.e2 = new THREE.Group(); // túnel e anel do acelerador
  const tor = new THREE.TorusGeometry(1, 0.13, 10, 72); tor.rotateX(Math.PI / 2); tor.scale(a.rx * 0.62, 1, a.rz * 0.6); tor.translate(cx, -D + 0.55, cz);
  P.e2.add(mesh(tor, M.whiteSmooth));
  const glows = []; for (let i = 0; i < 24; i++) { const t = (i / 24) * Math.PI * 2; glows.push([cx + Math.cos(t) * a.rx * 0.62, -D + 0.69, cz + Math.sin(t) * a.rz * 0.6]); }
  const gb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.03, 0.12), M.cyanGlow, glows.length); const m4 = new THREE.Matrix4(); glows.forEach((p, i) => gb.setMatrixAt(i, m4.makeTranslation(...p))); P.e2.add(gb);
  P.e3 = new THREE.Group(); // detectores e laboratório
  const det = new THREE.Group(); det.position.set(cx - a.rx * 0.62, -D + 0.62, cz); P.e3.add(det);
  const cols = [M.red, M.blue, M.yellow, M.steel, M.blue];
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5 - i * 0.02, 0.5 - i * 0.02, 0.14, 16), cols[i]); c.position.z = -0.35 + i * 0.17; c.rotation.x = Math.PI / 2; c.castShadow = true; det.add(c); }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 12), M.cyanGlow); core.rotation.x = Math.PI / 2; det.add(core);
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.35), i % 2 ? M.dark : M.steelDark); r.position.set(cx + a.rx * (0.1 + i * 0.1), -D + 0.25, cz - a.rz * 0.75 + (i % 2) * 0.1); r.castShadow = true; P.e3.add(r); const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.01), M.cyanGlow); s.position.set(r.position.x, -D + 0.38, r.position.z + 0.18); P.e3.add(s); }
  const strips = ellWall(cx, cz, a.rx - 0.03, a.rz - 0.03, -0.35, 0.04, M.cyanGlow); P.e3.add(strips);
  P.e4 = new THREE.Group(); // Centro de Física Avançada: pavilhão curvo de vidro na borda de trás
  const back = new THREE.Group(); P.e4.add(back);
  for (let f = 0; f < 2; f++) { back.add(ellWall(cx, cz - 0.1, a.rx + 0.55, a.rz + 0.5, f * 0.46 + 0.05, 0.4, M.fac_lab, Math.PI * 1.05, Math.PI * 1.95, 40)); back.add(ellWall(cx, cz - 0.1, a.rx + 0.58, a.rz + 0.53, f * 0.46, 0.06, M.fascia, Math.PI * 1.03, Math.PI * 1.97, 40)); }
  const roofB = sector(a.rx + 0.1, a.rx + 0.62, Math.PI * 1.04, Math.PI * 1.96, 0.06, 0.92, M.roof); roofB.scale.set(1, 1, a.rz / a.rx); roofB.position.set(cx, 0, cz - 0.1); back.add(roofB);
  const rail = ellWall(cx, cz, a.rx + 0.12, a.rz + 0.12, 0.18, 0.28, M.glassRail, Math.PI * 0.05, Math.PI * 0.95, 40); rail.castShadow = false; P.e4.add(rail);
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'acelerador', root, partes: P, esqueletos: {}, grua: { e4: true }, foco: { x: cx, z: cz + 0.5, dist: 9 }, ancora: [cx, 1.4, cz] };
}

// ---------------- Habitats Expandidos (savana) ----------------
export function savana() {
  const poly = A.savana.poly; const root = new THREE.Group(); root.name = 'savana'; const P = {};
  P.e1 = new THREE.Group(); // cercados de madeira ao redor dos habitats
  const posts = [], rails = [];
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(L / 0.5));
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; const x0 = a[0] + (b[0] - a[0]) * t0, z0 = a[1] + (b[1] - a[1]) * t0, x1 = a[0] + (b[0] - a[0]) * t1, z1 = a[1] + (b[1] - a[1]) * t1; const y0 = heightAt(x0, z0), y1 = heightAt(x1, z1); posts.push([[x0, y0, z0], [x0, y0 + 0.22, z0]]); rails.push([[x0, y0 + 0.2, z0], [x1, y1 + 0.2, z1]], [[x0, y0 + 0.1, z0], [x1, y1 + 0.1, z1]]); } }
  P.e1.add(beams(posts, 0.018, M.woodFrame, 4)); P.e1.add(beams(rails, 0.01, M.woodFrame, 3));
  P.e2 = new THREE.Group(); // abrigos, rochas e árvores de savana
  const R = rng(733); const rocks = [[12.6, 0.2, 0.5], [18.8, 2.4, 0.55], [14.2, -3.0, 0.4], [19.6, -1.6, 0.35], [16.2, 4.4, 0.45]]; for (const [x, z, s] of rocks) P.e2.add(rocha(x, z, s, (x * 7) | 0));
  const ac = []; for (let i = 0; i < 14; i++) { let x, z; do { x = 11 + R() * 9.5; z = -3.8 + R() * 9.6; } while (!inPolyS(x, z, poly)); ac.push({ x, z, s: 0.3 + R() * 0.2, pal: 'savana', trunk: true, h: 1.5 }); }
  const acG = treeGroup(ac, { trunks: true }); acG.traverse((o) => { if (o.isInstancedMesh && o.userData.kind) { const m = new THREE.Matrix4(); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); m.decompose(p, q, s); s.y *= 0.45; p.y += 0.12; m.compose(p, q, s); o.setMatrixAt(i, m); } o.instanceMatrix.needsUpdate = true; } }); P.e2.add(acG);
  for (const [x, z, r] of [[13.4, 1.6, 0.4], [18.4, -2.9, 0.35]]) { const s = new THREE.Mesh(new THREE.ConeGeometry(r + 0.15, 0.3, 6), M.woodFrame); s.position.set(x, heightAt(x, z) + 0.35, z); s.castShadow = true; P.e2.add(s); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 4), M.wood); c.position.set(x, heightAt(x, z) + 0.15, z); P.e2.add(c); }
  // e3: elefantes / e4: girafas e rinocerontes (animam no mundo)
  P.e3 = new THREE.Group(); P.e4 = new THREE.Group();
  const sub = (poly2) => poly2;
  P.e3.userData.manadas = [new Manada('elefante', 4, sub(poly), { vel: 0.1, escala: 1.25 })];
  P.e4.userData.manadas = [new Manada('girafa', 3, sub(poly), { vel: 0.12, escala: 1.1 }), new Manada('rinoceronte', 2, sub(poly), { vel: 0.08, escala: 1.3 })];
  for (const m of P.e3.userData.manadas) P.e3.add(m.mesh); for (const m of P.e4.userData.manadas) P.e4.add(m.mesh);
  for (const k of Object.keys(P)) root.add(P[k]);
  const c = poly.reduce((s, [x, z]) => [s[0] + x / poly.length, s[1] + z / poly.length], [0, 0]);
  return { id: 'savana', root, partes: P, esqueletos: {}, grua: {}, foco: { x: c[0], z: c[1], dist: 14 }, ancora: [c[0], 1.6, c[1]] };
}
function inPolyS(x, z, poly) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; }

// ---------------- Santuário: interior (lagoa, rochas e fauna resgatada) ----------------
export function santuarioInterior() {
  const s = A.santuario; const root = new THREE.Group(); root.name = 'santuarioInt'; const P = {};
  P.e1 = new THREE.Group(); // clareiras, rochas e mirantes
  for (const [x, z, sc] of [[14.6, -11.8, 0.45], [21.8, -9.6, 0.5], [24.8, -11.2, 0.35], [11.8, -9.4, 0.4], [18.4, -12.8, 0.3]]) P.e1.add(rocha(x, z, sc, (x * 11) | 0));
  P.e2 = new THREE.Group(); // fauna resgatada: elefantes e rinocerontes na clareira
  const area = [[10.2, -14.6], [15.0, -15.4], [15.6, -11.2], [11.0, -10.4]];
  P.e2.userData.manadas = [new Manada('elefante', 2, area, { vel: 0.08, escala: 1.2 }), new Manada('rinoceronte', 2, [[20.4, -12.4], [26.2, -12.6], [26.0, -8.2], [20.8, -8.0]], { vel: 0.07, escala: 1.25 })];
  for (const m of P.e2.userData.manadas) P.e2.add(m.mesh);
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'santuarioInt', root, partes: P, esqueletos: {}, grua: {}, foco: { x: s.c[0], z: s.c[1], dist: 18 }, ancora: [s.c[0], 2, s.c[1]] };
}
