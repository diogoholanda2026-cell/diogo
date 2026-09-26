// Interior do Anel do Campus (Escola e Campus para Jovens, campo, faculdades em blocos brancos) e o interior da arena
// do Campus Universitário (campo com pista, bosques, ala do portal, fita da frente, laço com a escadaria-jardim e rampa).
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M } from '../materials.js';
import { curve, ellipse, beams, sweep, tube, deckGeo, FH } from '../geom.js';
import { treeGroup } from '../forest.js';
import { hash, rng } from '../../core/util.js';
import { Faixa, matDe } from './faixa.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
const addMap = (grp, map, matFn) => { for (const [k, g] of map) grp.add(mesh(g, matFn(k))); };
function blobPts(cx, cz, rx, rz, rot, seed, n = 60) { const out = []; const c = Math.cos(rot), s = Math.sin(rot); const p1 = hash(seed, 1, 5) * 6; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = 1 + 0.12 * Math.sin(2 * a + p1) + 0.06 * Math.sin(3 * a + p1 * 2); const x = Math.cos(a) * rx * k, z = Math.sin(a) * rz * k; out.push([cx + x * c - z * s, cz + x * s + z * c]); } return out; }
function plate(pts, y, h, mat) { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); return mesh(g, mat); }
// retângulo arredondado em coordenadas do mundo (raio r, n pontos por canto)
function retRed(c, w, d, rot, r = 0.45, n = 6) {
  const out = []; const co = Math.cos(rot), si = Math.sin(rot); const hx = w / 2 - r, hz = d / 2 - r;
  for (const [cx, cz, a0] of [[hx, hz, 0], [-hx, hz, Math.PI / 2], [-hx, -hz, Math.PI], [hx, -hz, Math.PI * 1.5]]) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); const u = cx + Math.cos(a) * r, v = cz + Math.sin(a) * r; out.push([c[0] + u * co - v * si, c[1] + u * si + v * co]); }
  return out;
}
// brinquedos tubulares laranja (a foto): n tubos em curvas soltas sobre o pátio
function brinquedos(cx, cz, y, seed, n = 3, r = 0.03, esp = 0.9) {
  const g = new THREE.Group(); const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const x0 = cx + (R() - 0.5) * esp * 2, z0 = cz + (R() - 0.5) * esp; const pts = []; const k = 4 + ((R() * 2) | 0);
    for (let j = 0; j < k; j++) pts.push([x0 + (R() - 0.5) * 0.6, y + 0.05 + R() * 0.3, z0 + (R() - 0.5) * 0.5]);
    g.add(tube(pts, r, M.orange, 10, 6));
  }
  return g;
}
// Um bloco branco frio: caixas empilhadas e deslocadas (2 a 3 por bloco), faixa escura de janelas, cobertura cinza
// (M.concreto) com equipamentos brancos; alguns são um "U" de dois pavimentos em volta de um pátio de areia
function caixa(grp, px, pz, y, w, h, d, ry, R, faixa = true) {
  const b = mesh(new THREE.BoxGeometry(w, h, d), M.whiteSmooth); b.position.set(px, y + h / 2, pz); b.rotation.y = ry; grp.add(b);
  if (faixa) { const win = mesh(new THREE.BoxGeometry(w * 1.01, h * 0.28, d * 1.01), M.fac_escuro || M.fac_lab, false); win.position.set(px, y + h * 0.45, pz); win.rotation.y = ry; const uv = win.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 0.12, 0.3 + uv.getY(k) * 0.12); grp.add(win); }
  const cap = mesh(new THREE.BoxGeometry(w + 0.02, 0.03, d + 0.02), M.concreto); cap.position.set(px, y + h - 0.01, pz); cap.rotation.y = ry; grp.add(cap);
}
function bloco(low, high, equip, x, z, ry, bx, bz, floors, R, pU = 0.22) {
  const c = Math.cos(ry), s = Math.sin(ry); const local = (ox, oz) => [x + ox * c + oz * s, z - ox * s + oz * c];
  const plinto = mesh(new THREE.BoxGeometry(bx + 0.1, 0.08, bz + 0.1), M.whiteSmooth); { const [px, pz] = local(0, 0); plinto.position.set(px, 0.04, pz); plinto.rotation.y = ry; low.add(plinto); } // plinto claro
  const topo = (px, pz, w, d) => { const n = 4 + ((R() * 4) | 0); for (let i = 0; i < n; i++) equip.push([px + (R() - 0.5) * (w - 0.16) * c + (R() - 0.5) * (d - 0.16) * s, floors * FH + 0.04, pz - (R() - 0.5) * (w - 0.16) * s + (R() - 0.5) * (d - 0.16) * c, ry]); };
  if (floors >= 2 && bx > 0.42 && R() < pU) { // pátio em U: fundo e duas alas de 2 pavimentos, areia no meio
    const wing = bx * 0.3, back = bz * 0.36;
    for (let f = 0; f < 2; f++) {
      const grp = f === 0 ? low : high; const y = 0.08 + f * FH;
      let [px, pz] = local(0, -bz / 2 + back / 2); caixa(grp, px, pz, y, bx, FH - 0.04, back, ry, R);
      for (const sg of [-1, 1]) { [px, pz] = local(sg * (bx / 2 - wing / 2), back / 2 - 0.01); caixa(grp, px, pz, y, wing, FH - 0.04, bz - back, ry, R); }
    }
    const [qx, qz] = local(0, back / 2); const patio = mesh(new THREE.BoxGeometry(bx - 2 * wing - 0.02, 0.03, bz - back - 0.02), M.sand, false); patio.position.set(qx, 0.1, qz); patio.rotation.y = ry; low.add(patio);
    { const [px, pz] = local(0, -bz / 2 + back / 2); topo(px, pz, bx, back); }
    return;
  }
  let ox = 0, oz = 0, w = bx, d = bz;
  for (let f = 0; f < floors; f++) {
    const grp = f === 0 ? low : high;
    if (f > 0) { w = bx * 0.86; d = bz * 0.86; ox = (R() - 0.5) * bx * 0.2; oz = (R() - 0.5) * bz * 0.2; } // caixa de cima menor e deslocada: sobra o terraço
    const [px, pz] = local(ox, oz); caixa(grp, px, pz, 0.08 + f * FH, w, FH - 0.04, d, ry, R);
    if (f === floors - 1) topo(px, pz, w, d);
  }
}
// equipamentos brancos das coberturas cinza: uma InstancedMesh por conjunto
function equipamentos(high, equip) {
  if (!equip.length) return; const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.07, 0.1), M.whiteSmooth, equip.length); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const v = new THREE.Vector3(), s3 = new THREE.Vector3();
  equip.forEach(([x, y, z, ry], i) => im.setMatrixAt(i, m4.compose(v.set(x, y + 0.035, z), q.setFromEuler(e.set(0, ry, 0)), s3.set(0.8 + hash(i, 1, 9) * 0.6, 0.7 + hash(i, 2, 9) * 0.8, 0.8 + hash(i, 3, 9) * 0.6)))); im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); high.add(im);
}
// blocos ao longo de um arco de elipse (t0..t1 rad), girados pela tangente, em nAcross fileiras para dentro; blocos de
// 2 pavimentos (3 em 15%), largos, quase encostados (vãos até 0,12)
function blocosArco(cx, cz, rx, rz, rot, t0, t1, nAlong, nAcross, seed, fMin = 2, fMax = 3, passo = 0.62, pU = 0.22) {
  const R = rng(seed); const low = new THREE.Group(), high = new THREE.Group(); const c = Math.cos(rot), s = Math.sin(rot); const equip = [];
  for (let i = 0; i < nAlong; i++) for (let j = 0; j < nAcross; j++) {
    if (R() < 0.03) continue; const a = t0 + ((t1 - t0) * (i + 0.5 + (j % 2) * 0.35)) / nAlong; const k = 1 - (j * passo) / Math.min(rx, rz);
    const u = Math.cos(a) * rx * k, v = Math.sin(a) * rz * k; const x = cx + u * c - v * s, z = cz + u * s + v * c;
    const tu = -Math.sin(a) * rx, tv = Math.cos(a) * rz; const tx = tu * c - tv * s, tz = tu * s + tv * c; const ry = -Math.atan2(tz, tx);
    const L = (Math.hypot(tx, tz) * (t1 - t0)) / nAlong * k; const floors = fMax > fMin && R() < 0.15 ? fMin + 1 : fMin;
    bloco(low, high, equip, x, z, ry, L * (0.84 + R() * 0.08), passo * (0.88 + R() * 0.1), floors, R, pU);
  }
  equipamentos(high, equip); return { low, high };
}

export function escola() {
  const root = new THREE.Group(); root.name = 'escola'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  // e1: bloco escolar em "S" (3 andares) — é uma fita própria, com beirais finos como o Anel
  const bloco = new Faixa({ id: 'escolaBloco', closed: false, path: curve([[-16.6, 10.5], [-15.4, 12.0], [-13.4, 11.7], [-11.9, 12.8]], false, 60), modulos: 1, ponta: 1.0, passo: 0.26,
    prof: { o0: -0.5, o1: 0.5, setIn: 0.12, setOut: 0.12, beiral: 0.12, slab: 0.05, curb: 0.04, curbW: 0.08, passeioW: 0.12, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 3 });
  bloco.setTodos(3); P.e1.add(bloco.group);
  // e2: pátios de piso terracota salmão: dois em plataformas altas (no nível dos terraços do setor oeste do Anel) e um
  // no chão, com brinquedos tubulares laranja; rampa clara da plataforma A ao campo
  const terracota = M.terracota || M.pavers; const aro = M.fasciaBeiral || M.fascia;
  const A1 = { x: -16.4, z: 6.2, rx: 2.0, rz: 1.25, rot: 0.9, h: 1.6, sd: 11 }, B1 = { x: -14.9, z: 8.9, rx: 1.5, rz: 1.0, rot: 0.4, h: 1.2, sd: 12 };
  for (const q of [A1, B1]) {
    const pts = blobPts(q.x, q.z, q.rx, q.rz, q.rot, q.sd); P.e2.add(plate(pts, 0, q.h, M.roof)); P.e2.add(plate(blobPts(q.x, q.z, q.rx + 0.04, q.rz + 0.04, q.rot, q.sd), q.h, 0.04, aro)); P.e2.add(plate(blobPts(q.x, q.z, q.rx - 0.05, q.rz - 0.05, q.rot, q.sd), q.h + 0.04, 0.02, terracota));
  }
  { const co = Math.cos(A1.rot), si = Math.sin(A1.rot); P.e2.add(brinquedos(A1.x + 0.8 * co, A1.z + 0.8 * si, A1.h + 0.06, 11, 3, 0.03, 0.6)); }
  P.e2.add(brinquedos(B1.x, B1.z, B1.h + 0.06, 12, 3, 0.03, 0.7));
  P.e2.add(plate(blobPts(-11.4, 7.6, 0.9, 0.6, 0.2, 13), 0, 0.03, terracota)); P.e2.add(brinquedos(-11.4, 7.6, 0.03, 13, 4, 0.045, 0.5));
  P.e2.add(mesh(deckGeo([[-14.75, A1.h + 0.02, 6.95], [-13.7, 1.15, 7.5], [-12.6, 0.6, 8.1], [-11.6, 0.04, 8.75]], 0.28, 0.05), M.caminhoTeto || M.concreto));
  // e3: piscina afunilada turquesa na plataforma A, com aro claro e 4 ilhas de areia
  { const co = Math.cos(A1.rot), si = Math.sin(A1.rot); const pc = [A1.x - 0.55 * co, A1.z - 0.55 * si]; const y = A1.h + 0.02;
    P.e3.add(plate(retRed(pc, 1.85, 0.9, A1.rot, 0.3, 4), y, 0.03, aro)); P.e3.add(plate(retRed(pc, 1.7, 0.75, A1.rot, 0.28, 4), y + 0.01, 0.03, M.pool));
    for (const [u, v, r] of [[-0.55, 0.05, 0.2], [-0.1, -0.15, 0.24], [0.3, 0.12, 0.3], [0.62, -0.1, 0.18]]) P.e3.add(plate(blobPts(pc[0] + u * co - v * si, pc[1] + u * si + v * co, r, r * 0.7, 0.3, 21 + (r * 10 | 0)), y + 0.03, 0.03, M.sand)); }
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
  // e3: 7 degraus verdes estreitos com lábio claro, só no arco oeste do campo (sem torres de luz)
  const st = new THREE.Group(); st.position.set(c.c[0], 0, c.c[1]); st.rotation.y = -c.rot; P.e3.add(st);
  const deg = A.campo.degraus || [2.4, 3.4];
  for (let k = 0; k < 7; k++) { const r0 = 3.0 + k * 0.3; st.add(setor(r0, r0 + 0.3, deg[0], deg[1], 0.09 * (k + 1), 0, M.lawn, 12)); st.add(setor(r0 + 0.26, r0 + 0.3, deg[0], deg[1], 0.03, 0.09 * (k + 1), M.fasciaBeiral || M.fascia, 12)); }
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'campo', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'terra', e2: 'crescer' }, foco: { x: c.c[0], z: c.c[1], dist: 11 }, ancora: [c.c[0], 1.2, c.c[1]] };
}
// Faculdade de Engenharia: fileira sul de 9 blocos largos sobre plinto claro, junto à borda interna da frente do Anel
export function engenharia() {
  const a = A.anel; const root = new THREE.Group(); root.name = 'engenharia'; const b = blocosArco(a.c[0], a.c[1], a.rx - 3.85, a.rz - 3.75, a.rot, 0.55, 1.75, 9, 1, 31, 2, 3, 0.95);
  const P = { e1: b.low, e2: b.high }; root.add(P.e1, P.e2);
  const m = [a.c[0] + Math.cos(1.15) * (a.rx - 4.0), a.c[1] + Math.sin(1.15) * (a.rz - 3.8)];
  return { id: 'engenharia', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: m[0], z: m[1], dist: 11 }, ancora: [m[0], 1.8, m[1]] };
}
// Instituto de Estudos Urbanos: agrupamento leste de 3 fileiras irregulares, vários blocos em U
export function instituto() {
  const a = A.anel; const root = new THREE.Group(); root.name = 'instituto'; const b = blocosArco(a.c[0], a.c[1], a.rx - 3.85, a.rz - 3.75, a.rot, -0.55, 0.5, 5, 3, 47, 2, 3, 0.8, 0.4);
  const P = { e1: b.low, e2: b.high }; root.add(P.e1, P.e2);
  const m = [a.c[0] + (a.rx - 4.3) * Math.cos(a.rot), a.c[1] + (a.rx - 4.3) * Math.sin(a.rot)];
  return { id: 'instituto', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: m[0], z: m[1], dist: 10 }, ancora: [m[0], 2.2, m[1]] };
}
// perfil de uma fita baixa de 2 pavimentos (0,8): lajes claras finas avançando 0,08 e vidro entre elas, topo claro
function perfilFita(meia) {
  const E = []; const lado = (sg) => { const o = sg * meia, oa = sg * (meia + 0.08);
    const seq = [[oa, 0, oa, 0.06, 'fasciaBeiral', 'run'], [oa, 0.06, o, 0.06, 'fasciaBeiral', 'plan'], [o, 0.06, o, 0.4, 'fac_fita', 'facade'], [o, 0.4, oa, 0.4, 'fasciaBeiral', 'plan'], [oa, 0.4, oa, 0.46, 'fasciaBeiral', 'run'], [oa, 0.46, o, 0.46, 'fasciaBeiral', 'plan'], [o, 0.46, o, 0.8, 'fac_fita', 'facade'], [o, 0.8, oa, 0.8, 'fasciaBeiral', 'plan'], [oa, 0.8, oa, 0.86, 'fasciaBeiral', 'run']];
    for (const [a0, a1, b0, b1, mat, uv] of seq) E.push(sg > 0 ? { a: [a0, a1], b: [b0, b1], mat, uv, cap: mat === 'fasciaBeiral' } : { a: [b0, b1], b: [a0, a1], mat, uv }); };
  lado(1); lado(-1); E.push({ a: [meia + 0.08, 0.86], b: [-meia - 0.08, 0.86], mat: 'caminhoTeto', uv: 'plan' });
  const poly = [[meia + 0.08, 0], [meia + 0.08, 0.06], [meia, 0.06], [meia, 0.4], [meia + 0.08, 0.4], [meia + 0.08, 0.46], [meia, 0.46], [meia, 0.8], [meia + 0.08, 0.8], [meia + 0.08, 0.86], [-meia - 0.08, 0.86], [-meia - 0.08, 0.8], [-meia, 0.8], [-meia, 0.46], [-meia - 0.08, 0.46], [-meia - 0.08, 0.4], [-meia, 0.4], [-meia, 0.06], [-meia - 0.08, 0.06], [-meia - 0.08, 0]];
  return { E, poly };
}
// Ala do portal: bloco de 8 faixas finas (lajes claras avançando 0,10 sobre vidro escuro), cobertura clara com
// platibanda, ponta leste em plano inclinado liso com um tambor de meio cilindro no pé
function alaPortal(al, grp) {
  const plano = retRed(al.c, al.w, al.d, al.rot, 0.12, 3); const n = al.faixas || 8, fh = 2.2 / n, LJ = 0.06, AV = 0.1; const laje = M.fasciaBeiral || M.fascia; let y = 0;
  const E = [];
  for (let f = 0; f < n; f++) { E.push({ a: [AV, y], b: [AV, y + LJ], mat: 'laje', uv: 'run' }, { a: [AV, y + LJ], b: [0, y + LJ], mat: 'laje', uv: 'plan' }, { a: [0, y + LJ], b: [0, y + fh], mat: 'fac', uv: 'facade', vBase: 0 }); if (f > 0) E.push({ a: [0, y], b: [AV, y], mat: 'laje', uv: 'plan' }); y += fh; }
  E.push({ a: [AV, y], b: [AV, y + 0.05], mat: 'laje', uv: 'run' }, { a: [0, y], b: [AV, y], mat: 'laje', uv: 'plan' }, { a: [AV, y + 0.05], b: [0, y + 0.05], mat: 'laje', uv: 'plan' });
  addMap(grp, sweep(plano, true, E), (k) => (k === 'laje' ? laje : M.fac_fita || M.fac_escuro));
  grp.add(plate(plano, y, 0.03, laje));
  // plano inclinado da ponta leste (rampa 1.1 além do bloco), com as cunhas laterais, e o tambor no pé
  const co = Math.cos(al.rot), si = Math.sin(al.rot); const L = (u, v) => [al.c[0] + u * co - v * si, al.c[1] + u * si + v * co]; const hw = al.w / 2, hd = al.d / 2, r = al.rampa || 1.1;
  const P = [], I = []; const push = (u, v, yy) => { const [x, z] = L(u, v); P.push(x, yy, z); return P.length / 3 - 1; };
  const a0 = push(hw - 0.02, -hd, y + 0.03), a1 = push(hw - 0.02, hd, y + 0.03), a2 = push(hw + r, hd, 0), a3 = push(hw + r, -hd, 0), b0 = push(hw, -hd, 0), b1 = push(hw, hd, 0);
  I.push(a0, a2, a1, a0, a3, a2, a1, a2, b1, a0, b0, a3); // plano e cunhas (a orientação é conferida abaixo)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  { const nrm = g.attributes.normal; const [ex, ez] = [co, si]; const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const k = idx[i]; const fora = nrm.getX(k) * ex + nrm.getZ(k) * ez + nrm.getY(k) * 0.3; if (fora < 0) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } } g.computeVertexNormals(); }
  const ug = new Float32Array((P.length / 3) * 2); g.setAttribute('uv', new THREE.BufferAttribute(ug, 2)); grp.add(mesh(g, laje));
  const tb = al.tambor || { r: 0.5, h: 1.0 }; const [tx, tz] = L(hw + r - tb.r * 0.4, 0); const tam = mesh(new THREE.CylinderGeometry(tb.r, tb.r, tb.h, 16, 1, false, 0, Math.PI), laje); tam.position.set(tx, tb.h / 2, tz); tam.rotation.y = -al.rot - Math.PI / 2; grp.add(tam);
  const tampa = mesh(new THREE.CircleGeometry(tb.r, 16, 0, Math.PI), laje); tampa.rotation.x = -Math.PI / 2; tampa.rotation.z = -al.rot - Math.PI / 2; tampa.position.set(tx, tb.h, tz); grp.add(tampa);
}
// laço em U de 2 pavimentos aberto para a frente (+z), com a escadaria-jardim de 8 degraus no meio
function lacoEscada(la, grp) {
  const [cx, cz] = la.c; const hw = la.w / 2, hd = la.d / 2, m = (la.fita || 0.9) / 2, r = 0.55;
  const pts = []; const arco = (ax, az, a0, a1, n = 6) => { for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([ax + Math.cos(a) * r, az + Math.sin(a) * r]); } };
  pts.push([cx - hw + m, cz + hd]); arco(cx - hw + m + r, cz - hd + m + r, Math.PI, Math.PI * 1.5); arco(cx + hw - m - r, cz - hd + m + r, Math.PI * 1.5, Math.PI * 2); pts.push([cx + hw - m, cz + hd]);
  const { E, poly } = perfilFita(m); addMap(grp, sweep(pts, false, E, { caps: true, capPoly: poly, capMat: 'fasciaBeiral' }), (k) => matDe(k));
  // escadaria-jardim: patamar de grama e 8 degraus (grama e concreto alternados) descendo para a frente
  const n = la.degraus || 8, w = la.w - 2 * (la.fita || 0.9); const z0 = cz - hd + 2 * m;
  const pat = mesh(new THREE.BoxGeometry(w, 0.8, 0.4), M.lawn); pat.position.set(cx, 0.4, z0 + 0.2); grp.add(pat);
  for (let k = 0; k < n; k++) { const h = 0.8 - (k + 1) * 0.075; const d = mesh(new THREE.BoxGeometry(w, h, 0.2), k % 2 ? M.concreto : M.lawn); d.position.set(cx, h / 2, z0 + 0.4 + 0.1 + k * 0.2); grp.add(d); }
}
// Interior da arena do Campus Universitário: campo com pista, cordão de árvores junto à parede, bosque no lóbulo
// leste, a ala do portal, a fita reta da frente, o laço com a escadaria e a rampa clara da ponta NE ao laço
export function gramadoUni() {
  const u = A.uni, cp = u.campo, al = u.ala, ar = u.arena; const root = new THREE.Group(); root.name = 'gramadoUni'; const P = { e1: new THREE.Group() };
  const f = new THREE.PlaneGeometry(cp.w, cp.d); f.rotateX(-Math.PI / 2); const field = mesh(f, M.field, false); field.position.set(cp.c[0], 0.03, cp.c[1]); field.rotation.y = -cp.rot; P.e1.add(field);
  if (cp.pista) { const ps = cp.pista; addMap(P.e1, sweep(ellipse(ps.c[0], ps.c[1], ps.rx, ps.rz, ps.rot, 64), true, [{ a: [0.1, 0.045], b: [-0.1, 0.045], mat: 'c', uv: 'plan' }]), () => M.caminhoTeto || M.concreto); }
  const tr = []; const R = rng(88);
  for (const [x, z] of ellipse(ar.c[0], ar.c[1], ar.rx - 1.95, ar.rz - 1.9, ar.rot, 24, 0, 1, ar.a0 + 0.08, ar.a1 - 0.08)) tr.push({ x: x + (R() - 0.5) * 0.2, z: z + (R() - 0.5) * 0.2, s: 0.16 + R() * 0.06, pal: 'jardim' });
  for (let i = 0; i < 9; i++) tr.push({ x: -15.2 + R() * 1.4, z: -13.0 + R() * 1.8, s: 0.2 + R() * 0.06, pal: 'jardim' });
  P.e1.add(treeGroup(tr));
  alaPortal(al, P.e1);
  if (u.frente) { const { E, poly } = perfilFita((u.laco?.fita || 0.9) / 2); addMap(P.e1, sweep(curve(u.frente, false, 12), false, E, { caps: true, capPoly: poly, capMat: 'fasciaBeiral' }), (k) => matDe(k)); }
  if (u.laco) lacoEscada(u.laco, P.e1);
  if (u.rampa) { const [a, b] = u.rampa; P.e1.add(mesh(deckGeo([[a[0], 0.04, a[1]], [(a[0] + b[0]) / 2, 0.45, (a[1] + b[1]) / 2], [b[0], 0.86, b[1]]], 0.6, 0.05), M.caminhoTeto || M.concreto)); }
  root.add(P.e1);
  return { id: 'gramadoUni', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'crescer' }, foco: { x: (cp.c[0] + al.c[0]) / 2, z: (cp.c[1] + al.c[1]) / 2, dist: 14 }, ancora: [al.c[0], 3.0, al.c[1]] };
}
