// Lado leste da composição: Bioma Aquático (casca geodésica quase esférica com aquário e passarela em
// espiral), Vila Estudantil (anfiteatro de arquibancadas claras e aglomerado de casas brancas empilhadas),
// Recinto dos Gorilas (cerca alta de vidro), Acelerador de Partículas (bacia em degraus creme) e os
// Habitats Expandidos da savana (cercas de madeira e acácias de copa achatada).
import * as THREE from 'three';
import { A, SANTUARIO_GRAMADO } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { beams, curve, sweep, BAY, FH } from '../geom.js';
import { treeGroup } from '../forest.js';
import { Manada, animalGeos, animalMaterial } from '../animais.js';
import { heightAt } from '../ground.js';
import { hash, rng, TAU } from '../../core/util.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
// materiais só do leste (uma instância por módulo, criada quando o materials.js já está pronto)
const LOCAL = {};
const local = (k, make) => LOCAL[k] || (LOCAL[k] = make());
const std = (o) => new THREE.MeshStandardMaterial(o);
// vidro azul-esverdeado da cúpula (translúcido, com a água e a baleia visíveis por dentro)
const vidroCupula = () => local('vidroCupula', () => std({ color: 0x9fd8e8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.1 }));
// cerca e guarda-corpo de vidro quase invisíveis (só o reflexo)
const vidroCerca = () => local('vidroCerca', () => std({ color: 0xe6f5fb, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.3 }));
// água turquesa do aquário, mais transparente que a do materials.js (mesmo mapa de ondas)
const aguaAquario = () => local('aguaAquario', () => { const b = M.waterDeep || M.pool || M.water; const m = b.clone(); m.color.set(0x38c2d6); m.transparent = true; m.opacity = 0.62; m.depthWrite = false; if (m.emissive) m.emissive.set(0x0c7a92); return m; });
export function rocha(x, z, s, seed = 1, y = null, mat = null) {
  const g = new THREE.DodecahedronGeometry(1, 1); const p = g.attributes.position; const R = rng(seed * 97 + 5);
  const k = new Map(); for (let i = 0; i < p.count; i++) { const key = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); if (!k.has(key)) k.set(key, 0.75 + R() * 0.5); const f = k.get(key); p.setXYZ(i, p.getX(i) * f, Math.max(-0.2, p.getY(i)) * f * 0.8, p.getZ(i) * f); }
  g.computeVertexNormals(); const m = mesh(g, mat || M.rock); m.scale.set(s, s * (0.7 + R() * 0.5), s * (0.8 + R() * 0.3)); m.rotation.y = R() * 6; m.position.set(x, (y ?? heightAt(x, z)) + s * 0.1, z); return m;
}
function ellShape(cx, cz, rx, rz, rot = 0, n = 64) { const s = new THREE.Shape(); for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; const u = Math.cos(a) * rx, v = Math.sin(a) * rz; const x = cx + u * Math.cos(rot) - v * Math.sin(rot), z = cz + u * Math.sin(rot) + v * Math.cos(rot); i ? s.lineTo(x, -z) : s.moveTo(x, -z); } return s; }
function flatShape(shape, mat, y) { const g = new THREE.ShapeGeometry(shape, 48); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); const m = mesh(g, mat, false); m.position.y = y; return m; }
// anel elíptico vertical (paredes, guarda-corpos); uvFac: mapa de fachada na escala dos vãos (BAY x FH)
function ellWall(cx, cz, rx, rz, y0, h, mat, a0 = 0, a1 = Math.PI * 2, seg = 72, side = THREE.DoubleSide, uvFac = false) {
  const pos = [], idx = [], uv = []; let arc = 0, px = 0, pz = 0;
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg; const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz; if (i) arc += Math.hypot(x - px, z - pz); px = x; pz = z;
    pos.push(x, y0, z, x, y0 + h, z); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    if (uvFac) uv.push(arc / (BAY * 32), 0, arc / (BAY * 32), h / (FH * 4)); else { const u = (i / seg) * (rx + rz) * 1.2; uv.push(u, 0, u, 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return mesh(g, side === THREE.DoubleSide ? dupla(mat) : mat);
}
// coroa elíptica horizontal (patamares, lajes de galeria, topo de muretas), normal para cima
function ellFlat(cx, cz, rx0, rz0, rx1, rz1, y, mat, a0 = 0, a1 = Math.PI * 2, seg = 72, cast = false) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg; const c = Math.cos(a), s = Math.sin(a); const x0 = cx + c * rx0, z0 = cz + s * rz0, x1 = cx + c * rx1, z1 = cz + s * rz1;
    pos.push(x0, y, z0, x1, y, z1); nor.push(0, 1, 0, 0, 1, 0); uv.push(x0 / 2.2, z0 / 2.2, x1 / 2.2, z1 / 2.2);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere();
  return mesh(g, mat, cast);
}
// fitas entre polilinhas 3D (deques em hélice): a orientação de cada quadrilátero segue a normal pretendida
class Fitas {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  strip(P0, P1, nrm, us = 1) {
    const base = this.p.length / 3; let s = 0;
    for (let j = 0; j < P0.length; j++) { if (j) s += Math.hypot(P0[j][0] - P0[j - 1][0], P0[j][1] - P0[j - 1][1], P0[j][2] - P0[j - 1][2]); const nn = nrm(j); this.p.push(...P0[j], ...P1[j]); this.n.push(...nn, ...nn); this.uv.push(s * us, 0, s * us, 1); }
    const P = this.p, N = this.n;
    for (let j = 0; j < P0.length - 1; j++) {
      const a0 = base + j * 2, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3;
      const e1 = [P[b0 * 3] - P[a0 * 3], P[b0 * 3 + 1] - P[a0 * 3 + 1], P[b0 * 3 + 2] - P[a0 * 3 + 2]], e2 = [P[a1 * 3] - P[a0 * 3], P[a1 * 3 + 1] - P[a0 * 3 + 1], P[a1 * 3 + 2] - P[a0 * 3 + 2]];
      const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
      if (cx * N[a0 * 3] + cy * N[a0 * 3 + 1] + cz * N[a0 * 3 + 2] >= 0) this.i.push(a0, b0, a1, b0, b1, a1); else this.i.push(a0, a1, b0, b0, a1, b1);
    }
  }
  geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setIndex(this.i); g.computeBoundingSphere(); g.computeBoundingBox(); return g; }
}
// ---------------- Bioma Aquático de Conservação ----------------
// Casca geodésica quase esférica: esfera unitária cortada na latitude -k (a parte de baixo curva para dentro,
// como na foto), esticada em rx/rz no plano e hy na vertical, pousada no anel de concreto a y0.
function geodome(rx, rz, hy, k, y0, detail = 4) {
  const ico = new THREE.IcosahedronGeometry(1, detail); const p = ico.attributes.position; const tri = []; const edges = new Map(); const fb = Math.sqrt(1 - k * k);
  const V = (i) => [p.getX(i), p.getY(i), p.getZ(i)];
  const tf = ([x, y, z]) => { const yy = Math.max(-k, y); const f = yy > y ? fb / (Math.hypot(x, z) || 1) : 1; return [x * f * rx, (yy + k) * hy + y0, z * f * rz]; };
  for (let i = 0; i < p.count; i += 3) {
    const a = V(i), b = V(i + 1), c = V(i + 2); if (Math.max(a[1], b[1], c[1]) < -k + 0.002) continue;
    const A2 = tf(a), B2 = tf(b), C2 = tf(c); tri.push(...A2, ...B2, ...C2);
    for (const [u, v] of [[A2, B2], [B2, C2], [C2, A2]]) { const k1 = u.map((q) => q.toFixed(3)).join(), k2 = v.map((q) => q.toFixed(3)).join(); const key = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1; if (!edges.has(key)) edges.set(key, [u, v]); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals();
  return { glass: g, edges: [...edges.values()] };
}
export function bioma() {
  const [cx, cz] = A.bioma.c; const r = A.bioma.r;
  const rx = r + 0.25, rz = r * 0.92, hy = rx * 0.92, k = 0.22, yA = 0.45; // casca: raio no plano rx/rz, vertical hy; anel de 0,45
  const fb = Math.sqrt(1 - k * k), bx = rx * fb, bz = rz * fb; const h = yA + (1 + k) * hy; // raio da base da casca e altura total
  const fCasca = (y) => Math.sqrt(Math.max(0.04, 1 - ((y - yA) / hy - k) ** 2)); // fração do raio da casca na altura y
  const root = new THREE.Group(); root.name = 'bioma'; root.position.set(cx, 0, cz); const P = {};
  // e1: anel baixo de concreto claro, tanque (areia e rochas claras: 3 altas viram ilhas) e o prédio de apoio encostado
  P.e1 = new THREE.Group();
  P.e1.add(flatShape(ellShape(0, 0, bx + 0.45, bz + 0.45), M.whiteSmooth, 0.03));
  P.e1.add(ellWall(0, 0, bx + 0.04, bz + 0.04, 0, yA, M.cream, 0, TAU, 96));
  P.e1.add(ellFlat(0, 0, bx - 0.28, bz - 0.28, bx + 0.09, bz + 0.09, yA, M.whiteSmooth, 0, TAU, 96));
  P.e1.add(flatShape(ellShape(0, 0, bx - 0.05, bz - 0.05), M.sand, 0.06));
  const pedra = M.bandaCinza || M.concreto;
  for (let i = 0; i < 5; i++) { const a = hash(i, 1, 501) * 6.28, d = 0.25 + hash(i, 2, 501) * 0.5; P.e1.add(rocha(Math.cos(a) * bx * d, Math.sin(a) * bz * d, 0.2 + hash(i, 3, 501) * 0.2, 500 + i, 0.1, pedra)); }
  for (const [u, v, sc] of [[-0.45, -0.25, 0.6], [0.35, 0.3, 0.5], [0.1, -0.55, 0.42]]) { const q = rocha(u * bx, v * bz, sc, 520 + ((u * 10) | 0), 0.08, pedra); q.scale.y = (1.9 - 0.08) / (sc * 0.95); P.e1.add(q); }
  { // prédio de apoio: caixa branca de um pavimento com faixa de janelas escura, tangente ao anel na frente/direita
    const ab = 0.95; const ap = new THREE.Group(); ap.position.set(Math.cos(ab) * (bx + 0.32), 0, Math.sin(ab) * (bz + 0.32)); ap.rotation.y = -(Math.PI / 2 + ab);
    const corpo = mesh(new THREE.BoxGeometry(1.0, 0.55, 0.6), M.white); corpo.position.y = 0.275; ap.add(corpo);
    const tampa = mesh(new THREE.BoxGeometry(1.06, 0.035, 0.66), M.whiteSmooth); tampa.position.y = 0.56; ap.add(tampa);
    for (const [x, z, w, d] of [[0, -0.306, 0.8, 0.012], [0.506, 0, 0.012, 0.42], [-0.506, 0, 0.012, 0.42]]) { const j = mesh(new THREE.BoxGeometry(w, 0.14, d), M.dark, false); j.position.set(x, 0.3, z); ap.add(j); }
    P.e1.add(ap);
  }
  // e2: estrutura geodésica (barras brancas) com a passarela em espiral suspensa por dentro
  const d = geodome(rx, rz, hy, k, yA, 4); P.e2 = new THREE.Group();
  P.e2.add(beams(d.edges, 0.02, M.whiteSmooth, 4));
  P.e2.add(ellWall(0, 0, bx + 0.02, bz + 0.02, yA, 0.1, M.steelDark, 0, TAU, 96));
  { // mezanino em espiral: 1,5 volta de deque branco (0,25) por dentro da casca, com guarda-corpo e escoras até as barras
    const N = 120, w = 0.25, th = 0.05, y0 = yA + 1.75, y1 = yA + 3.1, a0 = Math.PI * 1.15; const Ot = [], It = [], Ob = [], Ib = [], rad = [];
    for (let j = 0; j <= N; j++) { const t = j / N; const a = a0 + t * 1.5 * TAU, y = y0 + (y1 - y0) * t; const f = fCasca(y) * 0.9; const c = Math.cos(a), s = Math.sin(a); rad.push([c, s, f, y]);
      Ot.push([c * f * rx, y, s * f * rz]); It.push([c * (f * rx - w), y, s * (f * rz - w)]); Ob.push([c * f * rx, y - th, s * f * rz]); Ib.push([c * (f * rx - w), y - th, s * (f * rz - w)]); }
    const F = new Fitas(); F.strip(It, Ot, () => [0, 1, 0]); F.strip(Ob, Ib, () => [0, -1, 0]); F.strip(Ot, Ob, (j) => [rad[j][0], 0, rad[j][1]]); F.strip(Ib, It, (j) => [-rad[j][0], 0, -rad[j][1]]);
    P.e2.add(mesh(F.geo(), M.whiteSmooth));
    const posts = [], esc = []; for (let j = 0; j <= N; j += 6) { const [c, s, f, y] = rad[j]; posts.push([Ot[j], [Ot[j][0], y + 0.3, Ot[j][2]]]); const fs = fCasca(y + 0.12); esc.push([Ot[j], [c * fs * rx, y + 0.12, s * fs * rz]]); }
    P.e2.add(beams(posts, 0.012, M.whiteSmooth, 4)); P.e2.add(beams(esc, 0.012, M.whiteSmooth, 4));
    const cur = new THREE.CatmullRomCurve3(Ot.filter((_, j) => j % 2 === 0).map(([x, y, z]) => new THREE.Vector3(x, y + 0.32, z)));
    P.e2.add(mesh(new THREE.TubeGeometry(cur, 100, 0.014, 5, false), M.whiteSmooth));
  }
  // e3: painéis de vidro azul-esverdeado
  P.e3 = new THREE.Group(); const gl = mesh(d.glass, vidroCupula(), false); gl.renderOrder = 4; P.e3.add(gl); P.e3.userData.semHAO = true;
  // e4: aquário vivo — água turquesa translúcida até meia casca acompanhando a curva, baleia, arraias e cardume
  P.e4 = new THREE.Group(); const yW = yA + 1.62;
  const wg = new THREE.CylinderGeometry(fCasca(yW) * 0.985, fb * 0.99, yW - 0.03, 48, 1, false); wg.scale(rx, 1, rz); wg.translate(0, (yW + 0.03) / 2, 0);
  const water = mesh(wg, aguaAquario(), false); water.renderOrder = 2; P.e4.add(water);
  const faunaW = new THREE.Group(); P.e4.add(faunaW);
  const bal = new THREE.InstancedMesh(animalGeos().baleia, animalMaterial(), 1); const ar = new THREE.InstancedMesh(animalGeos().arraia, animalMaterial(), 3); const px = new THREE.InstancedMesh(animalGeos().peixe, animalMaterial(), 40);
  faunaW.add(bal, ar, px); P.e4.userData.fauna = { bal, ar, px, rx, rz };
  // objetos reaproveitados a cada quadro (nada é alocado no laço)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), p = new THREE.Vector3(), s = new THREE.Vector3();
  const bxw = bx * 0.55, bzw = bz * 0.5;
  const inner = { update(t) {
    const T = t * 0.00012 * 6.28; const ct = Math.cos(T), st = Math.sin(T);
    // baleia: rumo pela tangente da elipse e leve inclinação na curva
    e.set(0.12, Math.atan2(-bzw * ct, -bxw * st), Math.sin(t * 0.0008) * 0.05); q.setFromEuler(e); p.set(ct * bxw, 1.1, st * bzw); s.setScalar(1.3); bal.setMatrixAt(0, m4.compose(p, q, s)); bal.instanceMatrix.needsUpdate = true;
    e.set(0, 0, 0);
    for (let i = 0; i < 3; i++) { const u = t * 0.00012 * 1.6 + i * 2.1; e.y = -u * 6.28 - Math.PI / 2; q.setFromEuler(e); p.set(Math.cos(u * 6.28) * bx * 0.35, 0.3 + i * 0.12, Math.sin(u * 6.28) * bz * 0.35); s.setScalar(0.7); ar.setMatrixAt(i, m4.compose(p, q, s)); } ar.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 40; i++) { const u = t * 0.00012 * 3 + (i % 8) * 0.012 + ((i / 8) | 0) * 0.2; const rr = 0.25 + ((i * 7) % 5) * 0.08; e.y = -u * 6.28 - Math.PI / 2; q.setFromEuler(e); p.set(Math.cos(u * 6.28) * bx * rr + ((i * 13) % 7) * 0.03, 0.45 + ((i * 11) % 6) * 0.22, Math.sin(u * 6.28) * bz * rr); s.setScalar(0.8); px.setMatrixAt(i, m4.compose(p, q, s)); } px.instanceMatrix.needsUpdate = true;
  } };
  P.e4.userData.update = inner.update;
  for (const kk of Object.keys(P)) root.add(P[kk]);
  return { id: 'bioma', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: cx, z: cz, dist: 12 }, ancora: [cx, h + 0.6, cz] };
}

// ---------------- Vila Estudantil Expandida ----------------
function sector(r0, r1, a0, a1, h, y, mat, seg = 40) {
  const s = new THREE.Shape(); for (let i = 0; i <= seg; i++) { const a = a0 + ((a1 - a0) * i) / seg; const x = Math.cos(a) * r1, z = Math.sin(a) * r1; i ? s.lineTo(x, -z) : s.moveTo(x, -z); }
  for (let i = seg; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / seg; s.lineTo(Math.cos(a) * r0, -Math.sin(a) * r0); }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 4 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  return mesh(g, mat);
}
// Anfiteatro escavado na encosta: 10 degraus de arquibancada clara com bancos de madeira, orquestra pavimentada,
// palco redondo de madeira com um fundo curvo baixo, e uma coroa de rocha irregular atrás do último degrau.
export function anfiteatro() {
  const [cx, cz] = A.anfiteatro.c; const root = new THREE.Group(); root.name = 'anfiteatro'; root.position.set(cx, 0, cz); root.rotation.y = -0.9; const P = {};
  const a0 = Math.PI * 0.32, a1 = Math.PI * 1.68; // abre para a frente e a direita (casas e visitante)
  P.e1 = new THREE.Group(); // escavação e arquibancadas
  const RA = A.anfiteatro.r; const N = 10, dr = (RA - 1.1) / N, dh = 0.09;
  for (let k = 0; k < N; k++) { const r0 = 1.1 + k * dr; P.e1.add(sector(r0, RA, a0, a1, dh, k * dh, k % 2 ? M.cream : M.concreto)); P.e1.add(sector(r0 + 0.025, r0 + 0.08, a0, a1, 0.035, (k + 1) * dh, M.wood)); }
  P.e1.add(flatShape(ellShape(0, 0, 1.1, 1.1), M.pavers, 0.02));
  { // coroa de rocha: um aro extrudado com o topo e a borda de fora sacudidos por ruído, mais pedras nas pontas
    const rim = sector(RA + 0.01, RA + 0.5, a0 - 0.05, a1 + 0.05, 0.34, N * dh - 0.12, M.rock); const p = rim.geometry.attributes.position; const yT = N * dh - 0.12 + 0.34;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const hx = Math.round(x * 9), hz = Math.round(z * 9); const rr = Math.hypot(x, z); let f = 1, yy = y; if (rr > RA + 0.45) f = 1 + (hash(hx, hz, 21) - 0.5) * 0.24; if (y > yT - 0.01) yy = y + (hash(hx, hz, 22) - 0.5) * 0.22; p.setXYZ(i, x * f, yy, z * f); }
    rim.geometry.computeVertexNormals(); rim.geometry.computeBoundingSphere(); P.e1.add(rim);
    for (const [a, sc, sd] of [[a0 - 0.02, 0.42, 31], [a1 + 0.02, 0.38, 32], [Math.PI, 0.45, 33], [Math.PI * 0.72, 0.3, 34], [Math.PI * 1.3, 0.34, 35]]) P.e1.add(rocha(Math.cos(a) * (RA + 0.35), Math.sin(a) * (RA + 0.35), sc, sd, N * dh - 0.05));
  }
  P.e2 = new THREE.Group(); // palco de madeira, fundo curvo baixo e iluminação
  const stage = sector(0, 0.85, -Math.PI * 0.45, Math.PI * 0.45, 0.12, 0, M.woodLight); stage.position.x = 0.4; P.e2.add(stage);
  const fundo = sector(1.12, 1.2, -Math.PI * 0.4, Math.PI * 0.4, 0.28, 0, M.cream); fundo.position.x = 0.4; P.e2.add(fundo);
  const lamps = []; for (let i = 0; i < 5; i++) { const a = a0 + ((a1 - a0) * (i + 0.5)) / 5; const rr = RA + 0.62; lamps.push([[Math.cos(a) * rr, N * dh, Math.sin(a) * rr], [Math.cos(a) * rr, N * dh + 0.5, Math.sin(a) * rr]]); }
  P.e2.add(beams(lamps, 0.015, M.steelDark, 4)); for (const [, b] of lamps) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), M.lampGlow); l.position.set(...b); P.e2.add(l); }
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'anfiteatro', root, partes: P, esqueletos: {}, grua: {}, foco: { x: cx + 0.8, z: cz + 0.6, dist: 11 }, ancora: [cx, 1.6, cz] };
}
// Casas brancas empilhadas (módulos residenciais, nível 1 a 3): aglomerado compacto em duas fileiras de caixas
// encostadas; cada andar é uma caixa deslocada (balanço de 0,25 para um lado, terraço com jardim para o outro),
// janelas escuras pequenas em faixa e terraços brancos, como o Habitat 67 da foto.
export class CasasVila {
  constructor() {
    const v = A.vila; this.group = new THREE.Group(); this.group.name = 'casas'; this.id = 'casas'; this.group.position.set(v.c[0], 0, v.c[1]); this.group.rotation.y = v.rot ?? -0.32;
    const pos = [[-1.28, -0.5], [-0.02, -0.55], [1.24, -0.48], [-1.2, 0.5], [0.06, 0.55], [1.3, 0.46]];
    this.mods = pos.map(([x, z], i) => ({ i, x, z, nivel: 0, g: null, w: 1.12 + hash(i, 1, 71) * 0.14, d: 0.92 + hash(i, 2, 71) * 0.1, lado: i % 2 ? 1 : -1, frente: i < 3 ? -1 : 1, escura: true }));
    this.max = 3;
  }
  // caixa do andar f (extensões x0, x1, z0, z1 relativas ao centro do módulo)
  _caixa(m, f) {
    const { w, d, lado, frente } = m; const T = 0.42, B = 0.25;
    if (f === 0) return [-w / 2, w / 2, -d / 2, d / 2];
    if (f === 1) return lado > 0 ? [-w / 2 + T, w / 2 + B, -d / 2, d / 2] : [-w / 2 - B, w / 2 - T, -d / 2, d / 2];
    const x = lado > 0 ? [-w / 2 + T + 0.05, w / 2 - 0.12] : [-w / 2 + 0.12, w / 2 - T - 0.05];
    return frente > 0 ? [x[0], x[1], -d / 2 + 0.32, d / 2 + B] : [x[0], x[1], -d / 2 - B, d / 2 - 0.32];
  }
  _casa(m, n) {
    const g = new THREE.Group(); const fh = 0.44; const jan = M.dark;
    const add = (geo, mat, x, y, z, cast = true) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; g.add(o); return o; };
    for (let f = 0; f < n; f++) {
      const [x0, x1, z0, z1] = this._caixa(m, f); const bw = x1 - x0, bd = z1 - z0, mx = m.x + (x0 + x1) / 2, mz = m.z + (z0 + z1) / 2; const yb = f * fh;
      add(new THREE.BoxGeometry(bw, fh, bd), M.white, mx, yb + fh / 2, mz);
      // janelas: quadrados escuros pequenos em faixa, nas quatro faces
      const jx = Math.max(1, Math.floor((bw - 0.18) / 0.22)), jz = Math.max(1, Math.floor((bd - 0.18) / 0.22)); const ox = mx - ((jx - 1) * 0.22) / 2, oz = mz - ((jz - 1) * 0.22) / 2;
      for (let j = 0; j < jx; j++) { add(new THREE.BoxGeometry(0.12, 0.08, 0.012), jan, ox + j * 0.22, yb + 0.25, m.z + z0 - 0.006, false); add(new THREE.BoxGeometry(0.12, 0.08, 0.012), jan, ox + j * 0.22, yb + 0.25, m.z + z1 + 0.006, false); }
      for (let j = 0; j < jz; j++) { add(new THREE.BoxGeometry(0.012, 0.08, 0.12), jan, m.x + x0 - 0.006, yb + 0.25, oz + j * 0.22, false); add(new THREE.BoxGeometry(0.012, 0.08, 0.12), jan, m.x + x1 + 0.006, yb + 0.25, oz + j * 0.22, false); }
      add(new THREE.BoxGeometry(bw + 0.04, 0.035, bd + 0.04), f === n - 1 ? M.whiteSmooth : M.fascia, mx, yb + fh, mz);
      // terraço: jardim pequeno na parte da laje que a caixa de cima deixa livre (ou num canto do topo)
      if (f < n - 1) { const [nx0, nx1, nz0, nz1] = this._caixa(m, f + 1); const livre = f === 0 ? (m.lado > 0 ? [x0 + 0.06, nx0 - 0.06] : [nx1 + 0.06, x1 - 0.06]) : (m.lado > 0 ? [nx1 + 0.06, x1 - 0.06] : [x0 + 0.06, nx0 - 0.06]); const zl = f === 0 ? [z0 + 0.12, z1 - 0.12] : (m.frente > 0 ? [z0 + 0.06, nz0 - 0.06] : [nz1 + 0.06, z1 - 0.06]);
        if (livre[1] - livre[0] > 0.12 && zl[1] - zl[0] > 0.12) add(new THREE.BoxGeometry(livre[1] - livre[0], 0.025, zl[1] - zl[0]), M.roof, m.x + (livre[0] + livre[1]) / 2, yb + fh + 0.03, m.z + (zl[0] + zl[1]) / 2, false); }
      else add(new THREE.BoxGeometry(Math.min(0.4, bw * 0.45), 0.025, Math.min(0.32, bd * 0.45)), M.roof, mx + (m.lado > 0 ? -1 : 1) * bw * 0.22, yb + fh + 0.03, mz + m.frente * bd * 0.2, false);
    }
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
// escarpa contínua de arenito (perfil em trapézio com estratos, altura e borda irregulares)
function escarpa(linha) {
  const cam = curve(linha, false, Math.max(24, Math.round(linha.length * 8)), 0.5);
  const E = [[0.42, 0], [0.39, 0.3], [0.35, 0.33], [0.31, 0.64], [0.28, 0.66], [0.25, 1.0], [-0.25, 1.0], [-0.28, 0.66], [-0.31, 0.64], [-0.35, 0.33], [-0.39, 0.3], [-0.42, 0]]; // base ±0.42, topo ±0.25
  const ed = []; for (let k = 0; k < E.length - 1; k++) ed.push({ a: E[k], b: E[k + 1], mat: 'r', uv: 'plan' });
  const g = [...sweep(cam, false, ed, { planScale: 1.2 }).values()][0]; const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const alt = 0.6 + 0.5 * (0.5 + 0.5 * Math.sin(x * 0.9 + z * 0.4) * Math.cos(z * 0.7 - x * 0.2)); const nx = (hash(Math.round(x * 7), Math.round(z * 7), 7) - 0.5) * 0.24, nz = (hash(Math.round(z * 7), Math.round(x * 7), 8) - 0.5) * 0.24; p.setXYZ(i, x + nx * (y > 0 ? 1 : 0.4), y * alt + heightAt(x, z), z + nz * (y > 0 ? 1 : 0.4)); }
  g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); return mesh(g, M.rock);
}
export function gorilas() {
  const g0 = A.gorilas; const [cx, cz] = g0.c; const root = new THREE.Group(); root.name = 'gorilas'; const P = {};
  P.e1 = new THREE.Group(); // escarpa, rochedos (fora e dentro do recinto), fosso e gramado
  P.e1.add(flatShape(ellShape(cx, cz, g0.rx, g0.rz), M.lawn, 0.03));
  P.e1.add(ellWall(cx, cz, g0.rx + 0.05, g0.rz + 0.05, -0.05, 0.14, M.concreto));
  for (const [x, z, s] of A.rochas) P.e1.add(rocha(x, z, s * 0.9, (x * 13) | 0));
  for (const [u, v, s, sd] of [[-0.55, 0.45, 0.32, 41], [0.2, -0.8, 0.26, 42], [0.15, 0.72, 0.24, 43], [-0.28, -0.72, 0.26, 44], [0.76, 0.28, 0.22, 45]]) P.e1.add(rocha(cx + u * g0.rx, cz + v * g0.rz, s, sd, 0.03));
  if (A.escarpa) P.e1.add(escarpa(A.escarpa));
  // e2: cerca alta de vidro quase invisível com corrimão branco fino sobre postes finos
  P.e2 = new THREE.Group(); const fx = g0.rx + 0.1, fz = g0.rz + 0.1, hf = 1.1;
  const fence = ellWall(cx, cz, fx, fz, 0.03, hf, vidroCerca(), 0, Math.PI * 2, 96); fence.castShadow = false; fence.renderOrder = 3; P.e2.add(fence);
  const tor = new THREE.TorusGeometry(1, 0.014, 4, 96); tor.rotateX(Math.PI / 2); tor.scale(fx, 1, fz); tor.translate(cx, hf + 0.04, cz); P.e2.add(mesh(tor, M.whiteSmooth));
  const posts = []; for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; const x = cx + Math.cos(a) * fx, z = cz + Math.sin(a) * fz; posts.push([[x, 0, z], [x, hf + 0.04, z]]); }
  P.e2.add(beams(posts, 0.012, M.whiteSmooth, 4));
  P.e3 = new THREE.Group(); // abrigo e árvores
  const hut = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.35, 8), M.wood); hut.position.set(cx + g0.rx * 0.55, 0.2, cz - g0.rz * 0.45); hut.castShadow = true; P.e3.add(hut);
  const roofH = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.35, 8), M.woodFrame); roofH.position.set(cx + g0.rx * 0.55, 0.55, cz - g0.rz * 0.45); roofH.castShadow = true; P.e3.add(roofH);
  const tr = []; for (let i = 0; i < 6; i++) { const a = hash(i, 1, 611) * 6.28, d = 0.55 + hash(i, 2, 611) * 0.3; tr.push({ x: cx + Math.cos(a) * g0.rx * d, z: cz + Math.sin(a) * g0.rz * d, s: 0.3 + hash(i, 3, 611) * 0.15, pal: 'jardim', trunk: true, h: 1.3 }); }
  P.e3.add(treeGroup(tr, { trunks: true }));
  P.e4 = new THREE.Group(); // família de gorilas (estátuas da foto), um deles sentado se a forma existir
  const G = animalGeos(); const sent = G.gorilaSentado; const poses = [[-1.4, -0.3, 0.6, 1.3], [-0.2, -0.8, 2.2, 1.2], [0.9, 0.35, 3.4, 1.4], [-0.7, 0.8, 5.2, 1.1], [1.7, -0.5, 1.2, 1.25]];
  const em = sent ? poses.slice(0, 4) : poses; const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const v = new THREE.Vector3(), s3 = new THREE.Vector3();
  const gi = new THREE.InstancedMesh(G.gorila, animalMaterial(), em.length); em.forEach(([x, z, a, s], i) => gi.setMatrixAt(i, m4.compose(v.set(cx + x, 0.03, cz + z), q.setFromEuler(e.set(0, a, 0)), s3.setScalar(s))));
  gi.castShadow = true; gi.receiveShadow = true; P.e4.add(gi);
  if (sent) { const [x, z, a, s] = poses[4]; const gs = new THREE.InstancedMesh(sent, animalMaterial(), 1); gs.setMatrixAt(0, m4.compose(v.set(cx + x, 0.03, cz + z), q.setFromEuler(e.set(0, a, 0)), s3.setScalar(s))); gs.castShadow = true; gs.receiveShadow = true; P.e4.add(gs); }
  // visitantes no anel de fora da cerca
  const anel = []; for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2; anel.push([+(cx + Math.cos(a) * (g0.rx + 0.9)).toFixed(2), +(cz + Math.sin(a) * (g0.rz + 0.9)).toFixed(2)]); }
  for (let i = 32; i >= 0; i--) { const a = (i / 32) * Math.PI * 2; anel.push([+(cx + Math.cos(a) * (g0.rx + 0.5)).toFixed(2), +(cz + Math.sin(a) * (g0.rz + 0.5)).toFixed(2)]); }
  P.e2.userData.pessoas = { area: anel, y: 0.03, n: 12 };
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'gorilas', root, partes: P, esqueletos: {}, grua: {}, foco: { x: cx - 0.6, z: cz - 0.8, dist: 10 }, ancora: [cx, 2.2, cz] };
}

// ---------------- Acelerador de Partículas Subterrâneo ----------------
// bacia elíptica escavada em três degraus creme com faixas claras, piso claro, o anel branco grosso e segmentado
// com detectores em camadas, uma galeria envidraçada curva no fundo e o guarda-corpo de vidro na borda
export function acelerador() {
  const a = A.acelerador; const [cx, cz] = a.c; const root = new THREE.Group(); root.name = 'acelerador'; const P = {}; const D = 1.3, NS = 3, st = D / NS, rec = 0.16;
  const rxF = a.rx - (NS - 1) * rec, rzF = a.rz - (NS - 1) * rec; // raio do degrau de baixo
  P.e1 = new THREE.Group(); // escavação: paredes em degraus, patamares, piso e mureta branca da borda
  for (let k = 0; k < NS; k++) {
    const rx = a.rx - k * rec, rz = a.rz - k * rec;
    P.e1.add(ellWall(cx, cz, rx, rz, -(k + 1) * st, st, M.cream, 0, TAU, 80));
    P.e1.add(ellWall(cx, cz, rx + 0.006, rz + 0.006, -k * st - 0.07, 0.07, M.fascia, 0, TAU, 80));
    if (k) P.e1.add(ellFlat(cx, cz, rx, rz, rx + rec, rz + rec, -k * st, M.fascia, 0, TAU, 80));
  }
  P.e1.add(flatShape(ellShape(cx, cz, rxF, rzF), M.caminhoTeto, -D));
  P.e1.add(ellWall(cx, cz, a.rx + 0.08, a.rz + 0.08, -0.02, 0.2, M.whiteSmooth)); P.e1.add(ellFlat(cx, cz, a.rx - 0.01, a.rz - 0.01, a.rx + 0.1, a.rz + 0.1, 0.18, M.whiteSmooth));
  P.e2 = new THREE.Group(); // túnel e anel do acelerador: tubo branco grosso em segmentos, sobre pedestais, com o feixe azul por cima
  const Rx = a.rx * 0.56, Rz = a.rz * 0.52, yR = -D + 0.36;
  const tor = new THREE.TorusGeometry(1, 0.17, 10, 72); tor.rotateX(Math.PI / 2); tor.scale(Rx, 1, Rz); tor.translate(cx, yR, cz); P.e2.add(mesh(tor, M.whiteSmooth));
  const up = new THREE.Vector3(0, 1, 0), tg = new THREE.Vector3();
  for (let i = 0; i < 16; i++) { const t = (i / 16) * TAU; const f = mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.07, 14), M.steelDark); f.position.set(cx + Math.cos(t) * Rx, yR, cz + Math.sin(t) * Rz); f.quaternion.setFromUnitVectors(up, tg.set(-Math.sin(t) * Rx, 0, Math.cos(t) * Rz).normalize()); P.e2.add(f); }
  for (let i = 0; i < 8; i++) { const t = ((i + 0.5) / 8) * TAU; const b = mesh(new THREE.BoxGeometry(0.24, 0.2, 0.2), M.steelDark); b.position.set(cx + Math.cos(t) * Rx, -D + 0.1, cz + Math.sin(t) * Rz); b.rotation.y = -t; P.e2.add(b); }
  const feixe = new THREE.TorusGeometry(1, 0.035, 6, 72); feixe.rotateX(Math.PI / 2); feixe.scale(Rx, 1, Rz); feixe.translate(cx, yR + 0.19, cz); P.e2.add(mesh(feixe, M.blue));
  P.e3 = new THREE.Group(); // detectores em camadas (o grande à esquerda, o menor à direita), racks e luz
  const det = new THREE.Group(); det.position.set(cx - Rx, yR, cz); P.e3.add(det);
  const cols = [M.whiteSmooth, M.steel, M.whiteSmooth, M.steel, M.blue];
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5 - i * 0.025, 0.5 - i * 0.025, 0.16, 18), cols[i]); c.position.z = -0.4 + i * 0.2; c.rotation.x = Math.PI / 2; c.castShadow = true; det.add(c); }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 1.05, 12), M.blue); core.rotation.x = Math.PI / 2; det.add(core);
  const det2 = new THREE.Group(); det2.position.set(cx + Rx, yR, cz); P.e3.add(det2);
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.36 - i * 0.03, 0.36 - i * 0.03, 0.14, 16), i === 1 ? M.steel : M.whiteSmooth); c.position.z = -0.17 + i * 0.17; c.rotation.x = Math.PI / 2; c.castShadow = true; det2.add(c); }
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.46, 0.3), i % 2 ? M.whiteSmooth : M.steelDark); r.position.set(cx - 0.95 + i * 0.26, -D + 0.23, cz + rzF * 0.7 - (i % 2) * 0.08); r.castShadow = true; P.e3.add(r); const s = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.01), M.cyanGlow); s.position.set(r.position.x, -D + 0.34, r.position.z + 0.155); P.e3.add(s); }
  P.e3.add(ellWall(cx, cz, a.rx - rec - 0.03, a.rz - rec - 0.03, -st - 0.12, 0.035, M.lampGlow));
  P.e4 = new THREE.Group(); // Centro de Física Avançada: galeria envidraçada curva no fundo da bacia, pavilhão baixo na borda de trás e guarda-corpo de vidro na frente
  { const gx = rxF - 0.02, gz = rzF - 0.02, pr = 0.36, b0 = Math.PI * 1.1, b1 = Math.PI * 1.9, yg = -D;
    P.e4.add(ellFlat(cx, cz, gx - pr, gz - pr, gx, gz, yg + 0.015, M.whiteSmooth, b0, b1, 40));
    const vid = ellWall(cx, cz, gx - pr, gz - pr, yg + 0.02, 0.4, M.glass, b0, b1, 40); vid.castShadow = false; vid.renderOrder = 3; P.e4.add(vid);
    const mont = []; for (let i = 0; i <= 14; i++) { const t = b0 + ((b1 - b0) * i) / 14; const x = cx + Math.cos(t) * (gx - pr), z = cz + Math.sin(t) * (gz - pr); mont.push([[x, yg + 0.02, z], [x, yg + 0.44, z]]); }
    P.e4.add(beams(mont, 0.012, M.whiteSmooth, 4));
    P.e4.add(ellFlat(cx, cz, gx - pr - 0.03, gz - pr - 0.03, gx, gz, yg + 0.45, M.fascia, b0 - 0.01, b1 + 0.01, 40, true));
    P.e4.add(ellWall(cx, cz, gx - pr - 0.03, gz - pr - 0.03, yg + 0.4, 0.06, M.fascia, b0 - 0.01, b1 + 0.01, 40));
    const gal = []; for (let i = 0; i <= 16; i++) { const t = b0 + ((b1 - b0) * i) / 16; gal.push([+(cx + Math.cos(t) * (gx - 0.06)).toFixed(2), +(cz + Math.sin(t) * (gz - 0.06)).toFixed(2)]); }
    for (let i = 16; i >= 0; i--) { const t = b0 + ((b1 - b0) * i) / 16; gal.push([+(cx + Math.cos(t) * (gx - pr + 0.06)).toFixed(2), +(cz + Math.sin(t) * (gz - pr + 0.06)).toFixed(2)]); }
    P.e4.userData.pessoas = { area: gal, y: yg + 0.03, n: 8 };
  }
  { const back = new THREE.Group(); P.e4.add(back); const px = a.rx + 0.55, pz = a.rz + 0.5, c0 = Math.PI * 1.05, c1 = Math.PI * 1.95;
    back.add(ellWall(cx, cz - 0.1, px, pz, 0.05, 0.4, M.fac_lab, c0, c1, 40, THREE.DoubleSide, true));
    back.add(ellWall(cx, cz - 0.1, px + 0.03, pz + 0.03, 0, 0.06, M.fascia, c0 - 0.01, c1 + 0.01, 40)); back.add(ellWall(cx, cz - 0.1, px + 0.03, pz + 0.03, 0.44, 0.07, M.fascia, c0 - 0.01, c1 + 0.01, 40));
    back.add(ellFlat(cx, cz - 0.1, a.rx + 0.12, a.rz + 0.12, px + 0.03, pz + 0.03, 0.51, M.roof, c0 - 0.01, c1 + 0.01, 40));
  }
  { const fx = a.rx + 0.12, fz = a.rz + 0.12, r0 = Math.PI * 0.05, r1 = Math.PI * 0.95;
    const rail = ellWall(cx, cz, fx, fz, 0.18, 0.34, vidroCerca(), r0, r1, 48); rail.castShadow = false; rail.renderOrder = 3; P.e4.add(rail);
    const cor = new THREE.TorusGeometry(1, 0.012, 4, 60, r1 - r0); cor.rotateX(Math.PI / 2); cor.rotateY(-r0); cor.scale(fx, 1, fz); cor.translate(cx, 0.53, cz); P.e4.add(mesh(cor, M.whiteSmooth));
    const pt = []; for (let i = 0; i <= 14; i++) { const t = r0 + ((r1 - r0) * i) / 14; const x = cx + Math.cos(t) * fx, z = cz + Math.sin(t) * fz; pt.push([[x, 0.18, z], [x, 0.53, z]]); } P.e4.add(beams(pt, 0.01, M.whiteSmooth, 4));
  }
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'acelerador', root, partes: P, esqueletos: {}, grua: { e4: true }, foco: { x: cx, z: cz + 0.5, dist: 9 }, ancora: [cx, 1.4, cz] };
}

// ---------------- Habitats Expandidos (savana) ----------------
// piquetes de pasto separados pelas trilhas, com cerca de madeira clara (postes grossos a cada 0,4 e duas
// travessas) no contorno e ao longo das trilhas
function cerca(linha, fechada, posts, rails, off = 0) {
  const n0 = linha.length; const pts = fechada ? [...linha, linha[0]] : linha;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const nx = (b[1] - a[1]) / L * off, nz = -(b[0] - a[0]) / L * off; const n = Math.max(1, Math.round(L / 0.4));
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; const x0 = a[0] + (b[0] - a[0]) * t0 + nx, z0 = a[1] + (b[1] - a[1]) * t0 + nz, x1 = a[0] + (b[0] - a[0]) * t1 + nx, z1 = a[1] + (b[1] - a[1]) * t1 + nz; const y0 = heightAt(x0, z0), y1 = heightAt(x1, z1); posts.push([[x0, y0, z0], [x0, y0 + 0.3, z0]]); rails.push([[x0, y0 + 0.27, z0], [x1, y1 + 0.27, z1]], [[x0, y0 + 0.14, z0], [x1, y1 + 0.14, z1]]); }
  }
  return n0;
}
export function savana() {
  const sv = A.savana, poly = sv.poly; const root = new THREE.Group(); root.name = 'savana'; const P = {};
  const trilhas = A.savanaTrilhas || []; const pertoTrilha = (x, z, m) => trilhas.some((l) => { for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i]; const vx = b[0] - a[0], vz = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz))); if (Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t) < m) return true; } return false; });
  P.e1 = new THREE.Group(); // cercados de madeira no contorno e dos dois lados das trilhas (os piquetes)
  const posts = [], rails = []; cerca(poly, true, posts, rails); for (const l of trilhas) { cerca(l, false, posts, rails, 0.28); cerca(l, false, posts, rails, -0.28); }
  const madeira = M.madeiraClara || M.woodLight;
  P.e1.add(beams(posts, 0.03, madeira, 4)); P.e1.add(beams(rails, 0.017, madeira, 4));
  P.e2 = new THREE.Group(); // abrigos, rochas e acácias de copa achatada
  const R = rng(733); const rocks = [[13.4, 0.4, 0.45], [18.6, 3.0, 0.5], [15.6, -1.4, 0.4], [19.3, -1.6, 0.35], [16.8, 4.4, 0.42]]; for (const [x, z, s] of rocks) P.e2.add(rocha(x, z, s, (x * 7) | 0));
  const ac = []; for (let i = 0, t = 0; i < 16 && t < 400; t++) { const x = 12 + R() * 9, z = -2.2 + R() * 8.8; if (!inPolyS(x, z, poly) || pertoTrilha(x, z, 0.55)) continue; ac.push({ x, z, s: 0.32 + R() * 0.2, pal: 'savana', trunk: true, h: 1.6 }); i++; }
  // copa em guarda-chuva: achatada (1/3 da altura) e mais larga, um pouco acima do tronco
  const acG = treeGroup(ac, { trunks: true }); acG.traverse((o) => { if (o.isInstancedMesh && o.userData.kind) { const m = new THREE.Matrix4(); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); m.decompose(p, q, s); s.x *= 1.3; s.z *= 1.3; s.y *= 0.34; p.y += 0.16; m.compose(p, q, s); o.setMatrixAt(i, m); } o.instanceMatrix.needsUpdate = true; } }); P.e2.add(acG);
  for (const [x, z, r] of [[13.6, 2.0, 0.4], [19.9, -0.9, 0.35]]) { const s = new THREE.Mesh(new THREE.ConeGeometry(r + 0.15, 0.3, 6), M.woodFrame); s.position.set(x, heightAt(x, z) + 0.35, z); s.castShadow = true; P.e2.add(s); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 4), M.wood); c.position.set(x, heightAt(x, z) + 0.15, z); P.e2.add(c); }
  // e3: elefantes / e4: girafas e rinocerontes (animam no mundo), cada espécie no seu piquete
  const pq = sv.piquetes || [poly, poly, poly];
  P.e3 = new THREE.Group(); P.e4 = new THREE.Group();
  P.e3.userData.manadas = [new Manada('elefante', 4, pq[1], { vel: 0.1, escala: 1.25 })];
  P.e4.userData.manadas = [new Manada('girafa', 3, pq[0], { vel: 0.12, escala: 1.1 }), new Manada('rinoceronte', 2, pq[2], { vel: 0.08, escala: 1.3 })];
  for (const m of P.e3.userData.manadas) P.e3.add(m.mesh); for (const m of P.e4.userData.manadas) P.e4.add(m.mesh);
  for (const k of Object.keys(P)) root.add(P[k]);
  const c = poly.reduce((s, [x, z]) => [s[0] + x / poly.length, s[1] + z / poly.length], [0, 0]);
  return { id: 'savana', root, partes: P, esqueletos: {}, grua: {}, foco: { x: c[0], z: c[1], dist: 13 }, ancora: [c[0], 1.6, c[1]] };
}
function inPolyS(x, z, poly) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; }

// ---------------- Santuário: interior (lagoa, rochas) e o pasto dos resgatados atrás da pista ----------------
export function santuarioInterior() {
  const s = A.santuario; const L = s.lago || { c: [s.c[0] + 0.4, s.c[1] - 1.5], rx: 2, rz: 1.15, rot: 0.2 }; const root = new THREE.Group(); root.name = 'santuarioInt'; const P = {};
  P.e1 = new THREE.Group(); // rochas em volta da lagoa e no pasto, mirantes
  // na beira d'água (meio dentro da lagoa): fora dela a mata interna cobriria as pedras
  const cr = Math.cos(L.rot || 0), sr = Math.sin(L.rot || 0);
  for (const [a, k, sc] of [[3.3, 1.0, 0.45], [0.15, 1.02, 0.4], [4.6, 0.98, 0.32], [1.9, 1.0, 0.35]]) { const u = Math.cos(a) * L.rx * k, v = Math.sin(a) * L.rz * k; const x = L.c[0] + u * cr - v * sr, z = L.c[1] + u * sr + v * cr; P.e1.add(rocha(x, z, sc, (x * 11) | 0)); }
  const [gc, grx, grz] = SANTUARIO_GRAMADO.elipse; for (const [dx, dz, sc] of [[-2.8, 0.4, 0.4], [2.9, -0.3, 0.35]]) P.e1.add(rocha(gc[0] + dx, gc[1] + dz, sc, 60 + dx * 3));
  P.e2 = new THREE.Group(); // fauna resgatada: elefantes e rinocerontes no pasto atrás da pista
  const esq = [[gc[0] - grx * 0.85, gc[1] - grz * 0.4], [gc[0] - 0.3, gc[1] - grz * 0.75], [gc[0] - 0.3, gc[1] + grz * 0.75], [gc[0] - grx * 0.85, gc[1] + grz * 0.4]];
  const dir = [[gc[0] + 0.3, gc[1] - grz * 0.75], [gc[0] + grx * 0.85, gc[1] - grz * 0.4], [gc[0] + grx * 0.85, gc[1] + grz * 0.4], [gc[0] + 0.3, gc[1] + grz * 0.75]];
  P.e2.userData.manadas = [new Manada('elefante', 2, esq, { vel: 0.08, escala: 1.2 }), new Manada('rinoceronte', 2, dir, { vel: 0.07, escala: 1.25 })];
  for (const m of P.e2.userData.manadas) P.e2.add(m.mesh);
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'santuarioInt', root, partes: P, esqueletos: {}, grua: {}, foco: { x: s.c[0] - 1, z: s.c[1] - 2, dist: 18 }, ancora: [L.c[0], 2, L.c[1]] };
}
