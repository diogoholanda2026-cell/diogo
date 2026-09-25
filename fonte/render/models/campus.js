// Interior do Anel do Campus (Escola e Campus para Jovens, campo, faculdades em blocos brancos)
// e o Gramado do Campus Universitário.
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { curve, beams, sweep, FH } from '../geom.js';
import { treeGroup } from '../forest.js';
import { hash, rng } from '../../core/util.js';
import { Faixa } from './faixa.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
const addMap = (grp, map, matFn) => { for (const [k, g] of map) grp.add(mesh(g, matFn(k))); };
function blobPts(cx, cz, rx, rz, rot, seed, n = 60) { const out = []; const c = Math.cos(rot), s = Math.sin(rot); const p1 = hash(seed, 1, 5) * 6; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = 1 + 0.12 * Math.sin(2 * a + p1) + 0.06 * Math.sin(3 * a + p1 * 2); const x = Math.cos(a) * rx * k, z = Math.sin(a) * rz * k; out.push([cx + x * c - z * s, cz + x * s + z * c]); } return out; }
function plate(pts, y, h, mat) { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); return mesh(g, mat); }

// brinquedos coloridos (torres, escorregadores, balanços, domo de escalar) e sombreiros de lona coloridos
// (cones sobre uma haste, como na foto) sobre o parquinho
function playground(cx, cz, y, seed) {
  const g = new THREE.Group(); const R = rng(seed); const cols = [M.orange, M.red, M.yellow, M.blue, M.teal];
  for (let i = 0; i < 3; i++) {
    const x = cx + (R() - 0.5) * 2.2, z = cz + (R() - 0.5) * 1.3, h = 0.34 + R() * 0.12; const c = cols[(R() * cols.length) | 0];
    const cone = mesh(new THREE.ConeGeometry(0.2 + R() * 0.08, 0.1, 7), dupla(c)); cone.position.set(x, y + h, z); cone.rotation.y = R() * 3; g.add(cone);
    g.add(beams([[[x, y, z], [x, y + h, z]]], 0.012, M.whiteSmooth, 4));
  }
  for (let i = 0; i < 4; i++) {
    const x = cx + (R() - 0.5) * 2.1, z = cz + (R() - 0.5) * 1.2; const c = cols[(R() * cols.length) | 0]; const k = R();
    if (k < 0.3) { const t = mesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), c); t.position.set(x, y + 0.13, z); g.add(t); const r = mesh(new THREE.ConeGeometry(0.14, 0.14, 4), M.red); r.position.set(x, y + 0.33, z); r.rotation.y = Math.PI / 4; g.add(r); const s = mesh(new THREE.BoxGeometry(0.34, 0.02, 0.08), M.yellow); s.position.set(x + 0.2, y + 0.12, z); s.rotation.z = -0.55; g.add(s); }
    else if (k < 0.55) { const fr = []; fr.push([[x - 0.2, y, z - 0.08], [x, y + 0.24, z]], [[x - 0.2, y, z + 0.08], [x, y + 0.24, z]], [[x + 0.2, y, z - 0.08], [x, y + 0.24, z]], [[x + 0.2, y, z + 0.08], [x, y + 0.24, z]]); g.add(beams(fr, 0.012, c, 4)); const bar = mesh(new THREE.BoxGeometry(0.42, 0.02, 0.02), c); bar.position.set(x, y + 0.24, z); g.add(bar); }
    else if (k < 0.8) { const d = mesh(new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), dupla(new THREE.MeshStandardMaterial({ color: 0xee7f33, wireframe: true }))); d.position.set(x, y, z); g.add(d); }
    else { const w = mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 16), c); w.position.set(x, y + 0.12, z); w.rotation.y = R() * 3; g.add(w); }
  }
  return g;
}
// aglomerado de blocos brancos (laboratórios / institutos), dividido em duas etapas
// Um bloco branco: caixas empilhadas e deslocadas (2 a 3 por bloco, como na foto), com terraço branco na
// diferença, faixa escura de janelas e cobertura (painéis solares em parte deles); alguns são um "U" de dois
// pavimentos em volta de um pátio interno de areia.
function caixa(grp, px, pz, y, w, h, d, ry, R, faixa = true) {
  const b = mesh(new THREE.BoxGeometry(w, h, d), R() < 0.5 ? M.white : M.whiteSmooth); b.position.set(px, y + h / 2, pz); b.rotation.y = ry; grp.add(b);
  if (faixa) { const win = mesh(new THREE.BoxGeometry(w * 1.01, h * 0.4, d * 1.01), M.fac_escuro || M.fac_lab, false); win.position.set(px, y + h * 0.52, pz); win.rotation.y = ry; const uv = win.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 0.12, 0.3 + uv.getY(k) * 0.12); grp.add(win); }
  const cap = mesh(new THREE.BoxGeometry(w + 0.03, 0.03, d + 0.03), M.fasciaBeiral || M.fascia); cap.position.set(px, y + h - 0.01, pz); cap.rotation.y = ry; grp.add(cap);
}
function bloco(low, high, solar, x, z, ry, bx, bz, floors, R) {
  const c = Math.cos(ry), s = Math.sin(ry); const local = (ox, oz) => [x + ox * c + oz * s, z - ox * s + oz * c];
  if (floors >= 2 && bx > 0.42 && R() < 0.22) { // pátio em U: fundo e duas alas de 2 pavimentos, areia no meio
    const wing = bx * 0.28, back = bz * 0.34;
    for (let f = 0; f < 2; f++) {
      const grp = f === 0 ? low : high; const y = f * FH;
      let [px, pz] = local(0, -bz / 2 + back / 2); caixa(grp, px, pz, y, bx, FH - 0.04, back, ry, R);
      for (const sg of [-1, 1]) { [px, pz] = local(sg * (bx / 2 - wing / 2), back / 2 - 0.01); caixa(grp, px, pz, y, wing, FH - 0.04, bz - back, ry, R); }
    }
    const [qx, qz] = local(0, back / 2); const patio = mesh(new THREE.BoxGeometry(bx - 2 * wing - 0.02, 0.03, bz - back - 0.02), M.sand, false); patio.position.set(qx, 0.02, qz); patio.rotation.y = ry; low.add(patio);
    return;
  }
  let ox = 0, oz = 0, w = bx, d = bz;
  for (let f = 0; f < floors; f++) {
    const grp = f === 0 ? low : high;
    if (f > 0) { w = bx * 0.8; d = bz * 0.8; ox = (R() - 0.5) * bx * 0.34; oz = (R() - 0.5) * bz * 0.34; } // caixa de cima menor e deslocada: sobra o terraço
    const [px, pz] = local(ox, oz); caixa(grp, px, pz, f * FH, w, FH - 0.04, d, ry, R);
    if (f === floors - 1 && R() < 0.6) solar.push([px, (f + 1) * FH, pz, w * 0.7, d * 0.6, ry]);
  }
}
function paineis(high, solar) {
  const sp = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 1), M.blue, solar.length); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const v = new THREE.Vector3(), s3 = new THREE.Vector3();
  solar.forEach(([x, y, z, a, b, ry], i) => sp.setMatrixAt(i, m4.compose(v.set(x, y + 0.05, z), q.setFromEuler(e.set(0.25, ry, 0, 'YXZ')), s3.set(a, 1, b)))); high.add(sp);
}
// aglomerado retangular de blocos (institutos), dividido em duas etapas (térreo / andares de cima)
function blocos(cx, cz, w, d, rot, nx, nz, seed, fMin = 1, fMax = 3) {
  const R = rng(seed); const low = new THREE.Group(), high = new THREE.Group(); const c = Math.cos(rot), s = Math.sin(rot);
  const bw = w / nx, bd = d / nz; const solar = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (R() < 0.12) continue; const u = -w / 2 + bw * (i + 0.5), v = -d / 2 + bd * (j + 0.5); const x = cx + u * c - v * s, z = cz + u * s + v * c;
    const floors = fMin + ((R() * (fMax - fMin + 1)) | 0); const bx = bw * (0.72 + R() * 0.2), bz = bd * (0.72 + R() * 0.2);
    bloco(low, high, solar, x, z, -rot, bx, bz, floors, R);
  }
  paineis(high, solar); return { low, high };
}
// blocos ao longo de um arco de elipse (t0..t1 rad), girados pela tangente, em nAcross fileiras para dentro
function blocosArco(cx, cz, rx, rz, rot, t0, t1, nAlong, nAcross, seed, fMin = 2, fMax = 3, passo = 0.62) {
  const R = rng(seed); const low = new THREE.Group(), high = new THREE.Group(); const c = Math.cos(rot), s = Math.sin(rot); const solar = [];
  for (let i = 0; i < nAlong; i++) for (let j = 0; j < nAcross; j++) {
    if (R() < 0.08) continue; const a = t0 + ((t1 - t0) * (i + 0.5 + (j % 2) * 0.35)) / nAlong; const k = 1 - (j * passo) / Math.min(rx, rz);
    const u = Math.cos(a) * rx * k, v = Math.sin(a) * rz * k; const x = cx + u * c - v * s, z = cz + u * s + v * c;
    const tu = -Math.sin(a) * rx, tv = Math.cos(a) * rz; const tx = tu * c - tv * s, tz = tu * s + tv * c; const ry = -Math.atan2(tz, tx);
    const L = (Math.hypot(tx, tz) * (t1 - t0)) / nAlong * k; const floors = fMin + ((R() * (fMax - fMin + 1)) | 0);
    bloco(low, high, solar, x, z, ry, L * (0.66 + R() * 0.18), passo * (0.7 + R() * 0.15), floors, R);
  }
  paineis(high, solar); return { low, high };
}

export function escola() {
  const root = new THREE.Group(); root.name = 'escola'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  // e1: bloco escolar em "S" (3 andares) — é uma fita própria, com beirais e vegetação como as outras
  const bloco = new Faixa({ id: 'escolaBloco', closed: false, path: curve([[-17.0, 10.4], [-15.4, 12.0], [-13.4, 11.7], [-11.9, 12.8]], false, 60), modulos: 1, prof: { o0: -0.45, o1: 0.45, setIn: 0.1, setOut: 0.1, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 3 });
  bloco.setTodos(3); P.e1.add(bloco.group);
  // e2: pátios em plataformas orgânicas (20% maiores) com parquinhos e sombreiros, sobre praças de piso
  // terracota, e o caminho claro sinuoso que liga os pátios ao campo
  const terracota = M.terracota || M.pavers; // piso de praça (sem material novo: nenhuma chamada a mais)
  for (const [x, z, rx, rz, r, sd] of [[-16.9, 6.4, 1.92, 1.14, 0.9, 11], [-15.2, 9.0, 1.62, 1.02, 0.4, 12]]) {
    P.e2.add(plate(blobPts(x, z, rx * 1.3, rz * 1.3, r, sd + 5), 0.0, 0.02, terracota));
    const pts = blobPts(x, z, rx, rz, r, sd); P.e2.add(plate(pts, 0.0, 0.3, M.whiteSmooth)); P.e2.add(plate(blobPts(x, z, rx - 0.08, rz - 0.08, r, sd), 0.3, 0.02, M.sand)); P.e2.add(playground(x, z, 0.32, sd));
  }
  addMap(P.e2, sweep(curve([[-17.8, 4.6], [-16.6, 7.4], [-15.3, 8.9], [-13.5, 9.6], [-11.7, 9.3]], false, 50), false, [{ a: [0.16, 0.035], b: [-0.16, 0.035], mat: 'c', uv: 'plan' }], { caps: false }), () => M.caminhoTeto || M.concreto);
  // e3: piscina com deque
  const px = -15.9, pz = 4.3, rot = 0.55; const pool = plate(blobPts(px, pz, 1.25, 0.55, rot, 21), 0.16, 0.02, M.pool); P.e3.add(plate(blobPts(px, pz, 1.55, 0.8, rot, 21), 0.0, 0.17, M.woodLight)); P.e3.add(pool);
  const lg = []; for (let i = 0; i < 5; i++) lg.push(mesh(new THREE.BoxGeometry(0.16, 0.03, 0.07), M.white));
  lg.forEach((l, i) => { l.position.set(px - 0.9 + i * 0.42, 0.2, pz + 0.72 - i * 0.18); l.rotation.y = -rot; P.e3.add(l); });
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'escola', root, partes: P, esqueletos: {}, grua: { e1: true }, foco: { x: -15.2, z: 8.6, dist: 12 }, ancora: [-15.2, 2.2, 9] };
}
// setor de coroa circular (degrau curvo) no plano, de r0 a r1 e de a0 a a1, com altura h
function setor(r0, r1, a0, a1, h, y, mat, seg = 16) {
  const s = new THREE.Shape(); for (let i = 0; i <= seg; i++) { const a = a0 + ((a1 - a0) * i) / seg; i ? s.lineTo(Math.cos(a) * r1, -Math.sin(a) * r1) : s.moveTo(Math.cos(a) * r1, -Math.sin(a) * r1); }
  for (let i = seg; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / seg; s.lineTo(Math.cos(a) * r0, -Math.sin(a) * r0); }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2);
  return mesh(g, mat);
}
export function campo() {
  const c = A.campo; const root = new THREE.Group(); root.name = 'campo'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  const g = new THREE.PlaneGeometry(c.w + 0.6, c.d + 0.6); g.rotateX(-Math.PI / 2);
  const soil = mesh(g, M.soil, false); soil.position.set(c.c[0], 0.03, c.c[1]); soil.rotation.y = -c.rot; P.e1.add(soil);
  const f = new THREE.PlaneGeometry(c.w, c.d); f.rotateX(-Math.PI / 2); const field = mesh(f, M.field, false); field.position.set(c.c[0], 0.045, c.c[1]); field.rotation.y = -c.rot; P.e2.add(field);
  // arquibancada: 8 degraus curvos de frente para o campo (grama e concreto alternados) e torres de luz
  const st = new THREE.Group(); st.position.set(c.c[0], 0, c.c[1]); st.rotation.y = -c.rot; P.e3.add(st);
  const deg = A.campo.degraus || [2.25, 3.55];
  for (let k = 0; k < 8; k++) st.add(setor(3.2 + k * 0.16, 3.2 + k * 0.16 + 0.14, deg[0], deg[1], 0.06 * (k + 1), 0, k % 2 ? M.concreto : M.lawn));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const px = (x * c.w) / 2 + x * 0.25, pz = (z * c.d) / 2 + z * 0.25; st.add(beams([[[px, 0, pz], [px, 1.3, pz]]], 0.025, M.steel, 5)); const l = mesh(new THREE.BoxGeometry(0.2, 0.08, 0.05), M.lampGlow, false); l.position.set(px, 1.32, pz); l.lookAt(0, 0, 0); st.add(l); }
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'campo', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'terra', e2: 'crescer' }, foco: { x: c.c[0], z: c.c[1], dist: 11 }, ancora: [c.c[0], 1.2, c.c[1]] };
}
// Faculdade de Engenharia: ~22 blocos brancos de laboratório ao longo da borda interna da frente do Anel (com o
// Instituto, ~40 blocos maiores e com pátios, como na foto)
export function engenharia() {
  const a = A.anel; const root = new THREE.Group(); root.name = 'engenharia'; const b = blocosArco(a.c[0], a.c[1], a.rx - 3.4, a.rz - 3.2, a.rot, 0.55, 1.75, 8, 3, 31, 2, 3);
  const P = { e1: b.low, e2: b.high }; root.add(P.e1, P.e2);
  const m = [a.c[0] + Math.cos(1.15) * (a.rx - 4.0), a.c[1] + Math.sin(1.15) * (a.rz - 3.8)];
  return { id: 'engenharia', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: m[0], z: m[1], dist: 11 }, ancora: [m[0], 1.8, m[1]] };
}
// Instituto de Estudos Urbanos: a mesma cidade de blocos, continuando pela borda interna da direita do Anel
export function instituto() {
  const a = A.anel; const root = new THREE.Group(); root.name = 'instituto'; const b = blocosArco(a.c[0], a.c[1], a.rx - 3.4, a.rz - 3.2, a.rot, -0.55, 0.5, 6, 3, 47, 2, 4);
  const P = { e1: b.low, e2: b.high }; root.add(P.e1, P.e2);
  const m = [a.c[0] + (a.rx - 4.3) * Math.cos(a.rot), a.c[1] + (a.rx - 4.3) * Math.sin(a.rot)];
  return { id: 'instituto', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: m[0], z: m[1], dist: 10 }, ancora: [m[0], 2.2, m[1]] };
}
// retângulo arredondado (planta da ala alta), em coordenadas do mundo
function retRed(c, w, d, rot, r = 0.45, n = 6) {
  const out = []; const co = Math.cos(rot), si = Math.sin(rot); const hx = w / 2 - r, hz = d / 2 - r;
  for (const [cx, cz, a0] of [[hx, hz, 0], [-hx, hz, Math.PI / 2], [-hx, -hz, Math.PI], [hx, -hz, Math.PI * 1.5]]) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); const u = cx + Math.cos(a) * r, v = cz + Math.sin(a) * r; out.push([c[0] + u * co - v * si, c[1] + u * si + v * co]); }
  return out;
}
// Gramado do Campus Universitário: o campo dentro do "C", árvores e a ala alta de 8 andares com brises
export function gramadoUni() {
  const u = A.uni, cp = u.campo, al = u.ala; const root = new THREE.Group(); root.name = 'gramadoUni'; const P = { e1: new THREE.Group() };
  const f = new THREE.PlaneGeometry(cp.w, cp.d); f.rotateX(-Math.PI / 2); const field = mesh(f, M.field, false); field.position.set(cp.c[0], 0.04, cp.c[1]); field.rotation.y = -cp.rot; P.e1.add(field);
  const tr = []; const R = rng(88); for (let i = 0, t = 0; i < 12 && t < 80; t++) { const a = R() * 6.28; const x = cp.c[0] + Math.cos(a) * (cp.w / 2 + 0.7), z = cp.c[1] + Math.sin(a) * (cp.d / 2 + 0.6); if (Math.hypot(x - al.c[0], z - al.c[1]) < al.w / 2 + 0.6) continue; tr.push({ x, z, s: 0.22 + R() * 0.1, pal: 'jardim' }); i++; }
  P.e1.add(treeGroup(tr));
  // ala alta: 8 andares com brises horizontais fortes (lajes claras avançando 0,25 a cada andar), vidro escuro
  // recuado entre elas, montantes finos e topo verde (o último andar mais alto)
  const plano = retRed(al.c, al.w, al.d, al.rot); const n = al.andares || 8; let y = 0; const LJ = 0.08, AV = 0.25; const laje = M.fasciaBeiral || M.fascia;
  for (let f = 0; f < n; f++) {
    const h = f === n - 1 ? FH * 1.15 : FH;
    const E = [{ a: [AV, y], b: [AV, y + LJ], mat: 'laje', uv: 'run' }, { a: [AV, y + LJ], b: [0, y + LJ], mat: 'laje', uv: 'plan' }, { a: [0, y + LJ], b: [0, y + h], mat: 'fac', uv: 'facade', vBase: 0 }];
    if (f > 0) E.push({ a: [0, y], b: [AV, y], mat: 'laje', uv: 'plan' });
    addMap(P.e1, sweep(plano, true, E), (k) => (k === 'laje' ? laje : M.fac_escuro || M.fac_lab));
    y += h;
  }
  addMap(P.e1, sweep(plano, true, [{ a: [AV, y], b: [AV, y + 0.1], mat: 'laje', uv: 'run' }, { a: [0, y], b: [AV, y], mat: 'laje', uv: 'plan' }, { a: [AV, y + 0.1], b: [0, y + 0.1], mat: 'laje', uv: 'plan' }]), () => laje);
  const tampa = new THREE.Shape(plano.map(([x, z]) => new THREE.Vector2(x, -z))); const tg = new THREE.ExtrudeGeometry(tampa, { depth: 0.12, bevelEnabled: false, curveSegments: 1 }); tg.rotateX(-Math.PI / 2); tg.translate(0, y, 0);
  { const uv = tg.attributes.uv, p = tg.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); } P.e1.add(mesh(tg, M.roof));
  const bri = []; const L = plano.length; let acc = 0; for (let i = 1; i <= L; i++) { const a = plano[i - 1], b = plano[i % L]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = (0.45 - acc) / d; while (t <= 1) { const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; const cx = x - al.c[0], cz = z - al.c[1], l = Math.hypot(cx, cz) || 1; bri.push([[x + (cx / l) * 0.05, 0, z + (cz / l) * 0.05], [x + (cx / l) * 0.05, y + 0.1, z + (cz / l) * 0.05]]); t += 0.45 / d; } acc = (acc + d) % 0.45; }
  P.e1.add(beams(bri, 0.014, M.whiteSmooth, 4));
  root.add(P.e1);
  return { id: 'gramadoUni', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'crescer' }, foco: { x: (cp.c[0] + al.c[0]) / 2, z: (cp.c[1] + al.c[1]) / 2, dist: 14 }, ancora: [al.c[0], y + 0.8, al.c[1]] };
}
