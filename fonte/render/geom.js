// Geometria procedural: curvas, varredura de perfis (edifícios-fita em terraços), fusão por material.
import * as THREE from 'three';
import { hash, TAU } from '../core/util.js';

export const FH = 0.46;              // altura de um andar (unidades de mundo)
export const BAY = 0.34;             // largura de um vão de janela

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Curva fechada/aberta suave com pontos igualmente espaçados (comprimento de arco).
export function curve(ctrl, closed = true, n = 160, tension = 0.5) {
  const c = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => V3(x, 0, z)), closed, 'catmullrom', tension);
  const pts = c.getSpacedPoints(n).map((v) => [v.x, v.z]);
  if (closed) pts.pop();
  return pts;
}
export function ellipse(cx, cz, rx, rz, rot = 0, n = 160, wob = 0, seed = 1, a0 = 0, a1 = TAU) {
  const out = []; const full = Math.abs(a1 - a0) >= TAU - 1e-6; const cnt = full ? n : n + 1;
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < cnt; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const w = 1 + wob * (Math.sin(a * 3 + seed) * 0.5 + Math.sin(a * 5 + seed * 2.1) * 0.3);
    const x = Math.cos(a) * rx * w, z = Math.sin(a) * rz * w;
    out.push([cx + x * c - z * s, cz + x * s + z * c]);
  }
  return out;
}
export function pathLength(p, closed) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (closed) L += Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]); return L; }
// normais laterais (lado +o) — para curvas fechadas, apontando para fora
export function normals(p, closed) {
  const n = p.length; const out = [];
  for (let i = 0; i < n; i++) {
    const a = p[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = p[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    out.push([tz, -tx]);
  }
  if (closed) {
    let cx = 0, cz = 0; for (const q of p) { cx += q[0]; cz += q[1]; } cx /= n; cz /= n;
    let s = 0; for (let i = 0; i < n; i++) s += out[i][0] * (p[i][0] - cx) + out[i][1] * (p[i][1] - cz);
    if (s < 0) for (const q of out) { q[0] = -q[0]; q[1] = -q[1]; }
  }
  return out;
}

class Buf {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; this.c = null; }
  vert(x, y, z, nx, ny, nz, u, v) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); return this.p.length / 3 - 1; }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// Varre um perfil ao longo de um caminho.
// edges: [{a:[o,y], b:[o,y], mat, uv:'facade'|'plan'|'run', vBase}]
// profileFn opcional (i, t) => deslocamento extra de o (para larguras variáveis)
export function sweep(path, closed, edges, opts = {}) {
  const N = path.length; const nor = normals(path, closed);
  const widthFn = opts.width || null; // t -> fator em o
  const out = new Map();
  const planS = opts.planScale || 2.2;
  for (const e of edges) {
    const B = out.get(e.mat) || new Buf(); out.set(e.mat, B);
    const [ao, ay] = e.a, [bo, by] = e.b;
    let dno = by - ay, dny = -(bo - ao); const dl = Math.hypot(dno, dny) || 1; dno /= dl; dny /= dl;
    const base = B.p.length / 3;
    let sa = 0, sb = 0; let pa = null, pb = null;
    const cnt = closed ? N + 1 : N;
    for (let k = 0; k < cnt; k++) {
      const i = k % N; const t = k / (cnt - 1);
      const wf = widthFn ? widthFn(t, i) : 1;
      const [px, pz] = path[i], [nx, nz] = nor[i];
      const oa = ao * wf, ob = bo * wf;
      const Ax = px + nx * oa, Az = pz + nz * oa, Bx = px + nx * ob, Bz = pz + nz * ob;
      if (pa) { sa += Math.hypot(Ax - pa[0], Az - pa[1]); sb += Math.hypot(Bx - pb[0], Bz - pb[1]); }
      pa = [Ax, Az]; pb = [Bx, Bz];
      let wnx = nx * dno, wny = dny, wnz = nz * dno; const wl = Math.hypot(wnx, wny, wnz) || 1; wnx /= wl; wny /= wl; wnz /= wl;
      let ua, va, ub, vb;
      if (e.uv === 'facade') { const s = (sa + sb) / 2 + (opts.u0 || 0); ua = ub = s / (BAY * 32); va = (ay - (e.vBase || 0)) / (FH * 4); vb = (by - (e.vBase || 0)) / (FH * 4); }
      else if (e.uv === 'run') { ua = ub = (sa + (opts.u0 || 0)) / 1.5; va = 0; vb = 1; }
      else { ua = Ax / planS; va = Az / planS; ub = Bx / planS; vb = Bz / planS; }
      B.vert(Ax, ay, Az, wnx, wny, wnz, ua, va);
      B.vert(Bx, by, Bz, wnx, wny, wnz, ub, vb);
    }
    // triângulos; ajusta a orientação para coincidir com a normal pretendida
    for (let k = 0; k < cnt - 1; k++) {
      const a0 = base + k * 2, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3;
      const P = B.p; const ax = P[a0 * 3], ay2 = P[a0 * 3 + 1], az = P[a0 * 3 + 2];
      const e1 = [P[b0 * 3] - ax, P[b0 * 3 + 1] - ay2, P[b0 * 3 + 2] - az], e2 = [P[a1 * 3] - ax, P[a1 * 3 + 1] - ay2, P[a1 * 3 + 2] - az];
      const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
      const Nn = B.n; const dot = cx * Nn[a0 * 3] + cy * Nn[a0 * 3 + 1] + cz * Nn[a0 * 3 + 2];
      if (dot >= 0) B.i.push(a0, b0, a1, b0, b1, a1); else B.i.push(a0, a1, b0, b0, a1, b1);
    }
  }
  if (!closed && opts.caps !== false) capEnds(path, nor, edges, out, widthFn);
  const res = new Map(); for (const [k, b] of out) res.set(k, b.geo());
  return res;
}
// tampa as pontas de caminhos abertos com o polígono do perfil
function capEnds(path, nor, edges, out, widthFn) {
  const poly = []; for (const e of edges) { poly.push(e.a); } if (edges.length) poly.push(edges[edges.length - 1].b);
  if (poly.length < 3) return;
  const mat = edges.find((e) => e.cap)?.mat || edges[0].mat; const B = out.get(mat) || new Buf(); out.set(mat, B);
  for (const end of [0, path.length - 1]) {
    const [px, pz] = path[end], [nx, nz] = nor[end]; const wf = widthFn ? widthFn(end ? 1 : 0, end) : 1;
    const q = path[end === 0 ? 1 : end - 1]; let tx = px - q[0], tz = pz - q[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const shape = new THREE.Shape(poly.map(([o, y]) => new THREE.Vector2(o * wf, y)));
    const sg = new THREE.ShapeGeometry(shape); const sp = sg.attributes.position; const base = B.p.length / 3;
    for (let i = 0; i < sp.count; i++) { const o = sp.getX(i), y = sp.getY(i); B.vert(px + nx * o, y, pz + nz * o, tx, 0, tz, o, y); }
    const idx = sg.index.array; for (let i = 0; i < idx.length; i += 3) { if (end === 0) B.i.push(base + idx[i], base + idx[i + 2], base + idx[i + 1]); else B.i.push(base + idx[i], base + idx[i + 1], base + idx[i + 2]); }
  }
}

// Perfil de um bloco em terraços: n andares, recuos, telhado verde, faixas brancas (lajes).
// o0 = borda interna, o1 = borda externa (no pavimento térreo). recuo por andar em cada lado.
export function terraceProfile(o) {
  const E = []; for (let f = 0; f < o.floors; f++) E.push(...terraceFloor(f, o.floors, o)); return E;
}
// Um andar f de um bloco com F andares (o último recebe a cobertura verde).
export function terraceFloor(f, F, { o0, o1, setOut = 0, setIn = 0, roof = 'roof', fac = 'fac_quente', facIn = null, slab = 0.09, lip = 0.06, planter = true, vBase = 0, y0: base = 0, fh = FH }) {
  const E = []; const fi = facIn || fac;
  const y0 = base + f * fh, y1 = y0 + fh;
  const outer = o1 - setOut * f, inner = o0 + setIn * f;
  const nOuter = o1 - setOut * (f + 1), nInner = o0 + setIn * (f + 1);
  E.push({ a: [outer + lip, y0], b: [outer + lip, y0 + slab], mat: 'fascia', uv: 'run' });
  E.push({ a: [inner - lip, y0 + slab], b: [inner - lip, y0], mat: 'fascia', uv: 'run' });
  E.push({ a: [outer, y0 + slab], b: [outer, y1], mat: fac, uv: 'facade', vBase: base + vBase });
  E.push({ a: [inner, y1], b: [inner, y0 + slab], mat: fi, uv: 'facade', vBase: base + vBase });
  E.push({ a: [outer, y0], b: [outer + lip, y0], mat: 'fascia', uv: 'plan' });
  E.push({ a: [outer + lip, y0 + slab], b: [outer, y0 + slab], mat: 'fascia', uv: 'plan' });
  E.push({ a: [inner - lip, y0], b: [inner, y0], mat: 'fascia', uv: 'plan' });
  E.push({ a: [inner, y0 + slab], b: [inner - lip, y0 + slab], mat: 'fascia', uv: 'plan' });
  if (f < F - 1) {
    if (nOuter < outer - 0.01) { E.push({ a: [outer, y1], b: [nOuter, y1], mat: roof, uv: 'plan' }); if (planter) E.push({ a: [outer, y1], b: [outer, y1 + 0.07], mat: 'planter', uv: 'run' }); }
    if (nInner > inner + 0.01) { E.push({ a: [nInner, y1], b: [inner, y1], mat: roof, uv: 'plan' }); if (planter) E.push({ a: [inner, y1 + 0.07], b: [inner, y1], mat: 'planter', uv: 'run' }); }
  } else {
    E.push({ a: [outer + lip, y1], b: [outer + lip, y1 + 0.08], mat: 'fascia', uv: 'run' });
    E.push({ a: [outer + lip, y1 + 0.08], b: [inner - lip, y1 + 0.08], mat: roof, uv: 'plan' });
    E.push({ a: [inner - lip, y1 + 0.08], b: [inner - lip, y1], mat: 'fascia', uv: 'run' });
  }
  return E;
}
// Esqueleto de concreto de um andar (laje + borda), para a fase de estrutura da obra.
export function skeletonFloor(f, { o0, o1, setOut = 0, setIn = 0, y0: base = 0, fh = FH }) {
  const y0 = base + f * fh; const outer = o1 - setOut * f, inner = o0 + setIn * f; const t = 0.07;
  return [
    { a: [outer, y0], b: [outer, y0 + t], mat: 'concreto', uv: 'run' },
    { a: [outer, y0 + t], b: [inner, y0 + t], mat: 'concreto', uv: 'plan' },
    { a: [inner, y0 + t], b: [inner, y0], mat: 'concreto', uv: 'run' },
    { a: [inner, y0], b: [outer, y0], mat: 'concreto', uv: 'plan' },
  ];
}
// Pilares ao longo de um caminho (pares de pontos para beams()).
export function columnsAlong(path, closed, offsets, y0, y1, step = 0.7) {
  const nor = normals(path, closed); const out = []; let acc = step;
  for (let i = 1; i < path.length + (closed ? 1 : 0); i++) {
    const a = path[i - 1], b = path[i % path.length]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc >= step) { acc = 0; const [nx, nz] = nor[i % path.length]; for (const o of offsets) out.push([[b[0] + nx * o, y0, b[1] + nz * o], [b[0] + nx * o, y1, b[1] + nz * o]]); }
  }
  return out;
}
// Trecho de um caminho entre as frações s0..s1 do comprimento (para dividir anéis em módulos).
export function subPath(path, closed, s0, s1, n = 0) {
  const P = closed ? [...path, path[0]] : path; const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1]; const a = s0 * L, b = s1 * L;
  const at = (d) => { d = ((d % L) + L) % L; let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]; };
  const cnt = n || Math.max(4, Math.ceil((b - a) / 0.25));
  const out = []; for (let k = 0; k <= cnt; k++) out.push(at(a + ((b - a) * k) / cnt));
  return out;
}
export function pointAt(path, closed, s) { return subPath(path, closed, s, s, 1)[0]; }

// Converte o mapa material->geometria em malhas.
export function meshes(map, mats, opts = {}) {
  const g = new THREE.Group();
  for (const [k, geo] of map) {
    const m = new THREE.Mesh(geo, mats[k] || mats.white);
    m.castShadow = opts.cast !== false; m.receiveShadow = true; m.userData.matKey = k;
    g.add(m);
  }
  return g;
}

// Funde as malhas de um grupo por material (menos chamadas de desenho).
export function bake(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map(); const kill = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
    let p = o.parent; while (p && p !== root) { if (p.userData.keep) return; p = p.parent; }
    const key = o.material.uuid + (o.castShadow ? 'c' : 'n');
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, list: [] });
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    groups.get(key).list.push([o.geometry, m]); kill.push(o);
  });
  for (const o of kill) o.parent.remove(o);
  const prune = (n) => { for (const c of n.children.slice()) { prune(c); if (c.isGroup && !c.children.length && !c.userData.keep) n.remove(c); } };
  prune(root);
  for (const { mat, cast, list } of groups.values()) {
    const g = merge(list); const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true; root.add(m);
  }
  return root;
}
export function merge(list) {
  let vCount = 0, iCount = 0; const hasColor = list.some(([g]) => g.attributes.color);
  for (const [g] of list) { vCount += g.attributes.position.count; iCount += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(vCount * 3), Nn = new Float32Array(vCount * 3), U = new Float32Array(vCount * 2), C = hasColor ? new Float32Array(vCount * 3) : null;
  const I = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const [g, m] of list) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, col = g.attributes.color; nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); P[(vo + i) * 3] = v.x; P[(vo + i) * 3 + 1] = v.y; P[(vo + i) * 3 + 2] = v.z;
      if (n) { v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); Nn[(vo + i) * 3] = v.x; Nn[(vo + i) * 3 + 1] = v.y; Nn[(vo + i) * 3 + 2] = v.z; }
      if (uv) { U[(vo + i) * 2] = uv.getX(i); U[(vo + i) * 2 + 1] = uv.getY(i); }
      if (C) { if (col) { C[(vo + i) * 3] = col.getX(i); C[(vo + i) * 3 + 1] = col.getY(i); C[(vo + i) * 3 + 2] = col.getZ(i); } else { C[(vo + i) * 3] = C[(vo + i) * 3 + 1] = C[(vo + i) * 3 + 2] = 1; } }
    }
    if (g.index) { const idx = g.index.array; for (let k = 0; k < idx.length; k++) I[io + k] = idx[k] + vo; io += idx.length; }
    else { for (let k = 0; k < p.count; k++) I[io + k] = vo + k; io += p.count; }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  if (C) out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.setIndex(new THREE.BufferAttribute(I, 1)); out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

// primitivas posicionadas
export function box(w, h, d, mat, x = 0, y = 0, z = 0, ry = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; return m; }
export function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 24, open = false) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; return m; }
export function disc(r, mat, x = 0, y = 0, z = 0, seg = 40) { const g = new THREE.CircleGeometry(r, seg); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.receiveShadow = true; return m; }
export function flat(poly, mat, y = 0, planS = 2.2) {
  const s = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(s, 24); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / planS, p.getZ(i) / planS);
  const m = new THREE.Mesh(g, mat); m.position.y = y; m.receiveShadow = true; return m;
}
export function slabPoly(poly, h, mat, y = 0, planS = 2.2) {
  const s = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 24 }); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + p.getY(i) * 0.3) / planS, (p.getZ(i) + p.getY(i) * 0.3) / planS);
  const m = new THREE.Mesh(g, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; return m;
}
// tubo ao longo de pontos 3D
export function tube(pts, r, mat, seg = 64, radial = 8) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => V3(p[0], p[1], p[2])));
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, radial, false), mat); m.castShadow = true; m.receiveShadow = true; return m;
}
// barra entre dois pontos (vigas, pilares, treliças)
const _up = new THREE.Vector3(0, 1, 0);
export function beamGeo(r = 0.02, seg = 5) { const g = new THREE.CylinderGeometry(r, r, 1, seg, 1, true); g.translate(0, 0.5, 0); return g; }
export function beamMatrix(a, b, out = new THREE.Matrix4()) {
  const A = V3(a[0], a[1], a[2]), Bv = V3(b[0], b[1], b[2]); const d = Bv.clone().sub(A); const L = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(_up, d.normalize());
  return out.compose(A, q, V3(1, L, 1));
}
export function beams(pairs, r, mat, seg = 5) {
  const g = beamGeo(r, seg); const im = new THREE.InstancedMesh(g, mat, pairs.length); const m = new THREE.Matrix4();
  pairs.forEach(([a, b], i) => im.setMatrixAt(i, beamMatrix(a, b, m)));
  im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); return im;
}
export function jitter(i, s, amp) { return (hash(i, s, 3) - 0.5) * 2 * amp; }
