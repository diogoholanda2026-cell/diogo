// Centro da composição: Faculdade de Ciências Avançadas (lóbulos orgânicos sobre pilotis, com
// laboratórios à mostra em corte), a Ala em Onda, o Lago Central e o pátio da Sede da Holding.
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { sweep, subPath, beams, curve, normals, ellipse } from '../geom.js';
import { treeGroup } from '../forest.js';
import { heightAt } from '../ground.js';
import { hash, rng, inPoly } from '../../core/util.js';
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
// banda arredondada (borda de laje "fluida"): w = largura no plano (para dentro), t = espessura;
// o tampo recebe 'bandaTopo' (cinza claro da foto) e o resto 'borda' (branco liso)
function bandEdges(y, t = 0.3, out = 0.12, w = 0.45) {
  return [
    { a: [-w, y], b: [0, y], mat: 'borda', uv: 'plan' },
    { a: [0, y], b: [out, y + t * 0.25], mat: 'borda', uv: 'run' },
    { a: [out, y + t * 0.25], b: [out + 0.02, y + t * 0.6], mat: 'borda', uv: 'run' },
    { a: [out + 0.02, y + t * 0.6], b: [0, y + t], mat: 'borda', uv: 'run' },
    { a: [0, y + t], b: [-w, y + t], mat: 'bandaTopo', uv: 'plan' },
  ];
}
// banda transversal (dos dois lados arredondada), centrada no caminho
function bandaDupla(y, t, w) {
  const h = w / 2; // perfil no sentido anti-horário (base, lado +, tampo, lado -): normais para fora
  return [
    { a: [-h, y], b: [h, y], mat: 'borda', uv: 'plan' },
    { a: [h, y], b: [h + 0.05, y + t * 0.5], mat: 'borda', uv: 'run' }, { a: [h + 0.05, y + t * 0.5], b: [h, y + t], mat: 'borda', uv: 'run' },
    { a: [h, y + t], b: [-h, y + t], mat: 'bandaTopo', uv: 'plan' },
    { a: [-h, y + t], b: [-h - 0.05, y + t * 0.5], mat: 'borda', uv: 'run' }, { a: [-h - 0.05, y + t * 0.5], b: [-h, y], mat: 'borda', uv: 'run' },
  ];
}
const matBanda = (k) => (k === 'bandaTopo' ? M.bandaCinza || M.concreto : M.whiteSmooth);
// caixa de janelas com UV do atlas de fachada na escala certa (sem "hieróglifos")
let _faixaLab = null;
function faixaLabGeo() { if (_faixaLab) return _faixaLab; const g = new THREE.BoxGeometry(1, 1, 1); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 0.1, 0.3 + uv.getY(k) * 0.14); g.userData.compartilhada = true; return (_faixaLab = g); }
// Um lóbulo da faculdade: armação de bandas grossas cinza-claras com 3 células abertas por cima, por onde se
// veem os laboratórios (mini-prédios brancos) em dois pisos; tudo elevado em pilotis altos.
function lobo(P, pts, y0, nLev, lh, corte, seed) {
  const nor = normals(pts, true); const n = pts.length;
  const levels = []; for (let k = 0; k <= nLev; k++) { const f = 1 - 0.035 * k; let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length; levels.push(pts.map(([x, z], i) => [cx + (x - cx) * f + nor[i][0] * 0.08 * Math.sin(k * 1.3 + i * 0.05), cz + (z - cz) * f + nor[i][1] * 0.08 * Math.sin(k * 1.3 + i * 0.05)])); }
  const pisos = Math.min(nLev, 2); // pisos só nos dois primeiros níveis; acima, só o anel da banda
  // e1: pilotis e lajes de concreto
  const cols = []; for (let i = 0; i < pts.length; i += 10) { const [x, z] = levels[0][i], [nx, nz] = nor[i]; cols.push([[x - nx * 0.7, heightAt(x, z), z - nz * 0.7], [x - nx * 0.7, y0, z - nz * 0.7]]); }
  let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; cols.push([[cx + Math.cos(a) * 0.8, 0, cz + Math.sin(a) * 0.5], [cx + Math.cos(a) * 0.8, y0, cz + Math.sin(a) * 0.5]]); }
  P.e1.add(beams(cols, 0.07, M.whiteSmooth, 8));
  for (let k = 0; k < pisos; k++) P.e1.add(plate(levels[k], y0 + k * lh, 0.08, M.concreto));
  const lobby = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, y0, 24, 1, true), dupla(M.glassWarm)); lobby.scale.set(1, 1, 0.6); lobby.position.set(cx, y0 / 2, cz); P.e1.add(lobby);
  // e2: laboratórios (mini-prédios brancos com faixa de janelas) e telas acesas nos dois pisos
  const labs = []; const R = rng(seed * 31 + 7);
  for (let k = 0; k < pisos; k++) for (let q = 0; q < 26; q++) { const i = (R() * n) | 0; const [x, z] = levels[k][i]; const t = 0.18 + R() * 0.62; const px = cx + (x - cx) * t, pz = cz + (z - cz) * t; labs.push([px, y0 + k * lh + 0.08, pz, 0.25 + R() * 0.35, Math.min(lh - 0.14, 0.2 + R() * 0.25), 0.2 + R() * 0.25, R()]); }
  const lb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.whiteSmooth, labs.length); const fx = new THREE.InstancedMesh(faixaLabGeo(), M.fac_lab, labs.length); const sc = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.cyanGlow, labs.length); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const v = new THREE.Vector3(), s3 = new THREE.Vector3(); let ns = 0;
  labs.forEach(([x, y, z, w, h, d, r], i) => { q.setFromEuler(e.set(0, r * 3, 0)); lb.setMatrixAt(i, m4.compose(v.set(x, y + h / 2, z), q, s3.set(w, h, d))); fx.setMatrixAt(i, m4.compose(v.set(x, y + h * 0.55, z), q, s3.set(w + 0.012, h * 0.34, d + 0.012))); if (r < 0.4) sc.setMatrixAt(ns++, m4.compose(v.set(x, y + h + 0.04, z), q, s3.set(w * 0.5, 0.06, 0.012))); });
  sc.count = ns; lb.castShadow = true; P.e2.add(lb, fx, sc);
  for (let k = 0; k < pisos; k++) P.e2.add(plate(levels[k], y0 + k * lh + 0.06, 0.03, M.whiteSmooth));
  // e3: a armação — bandas fluidas em cada nível, banda de topo larga e 2 bandas transversais (3 células)
  const yT = y0 + nLev * lh - 0.02;
  for (let k = 0; k < nLev; k++) addMap(P.e3, sweep(levels[k], true, bandEdges(y0 + k * lh - 0.02, 0.2, 0.1, 0.34)), matBanda); // lajes finas; a armação grossa é a do topo
  addMap(P.e3, sweep(levels[nLev], true, bandEdges(yT, 0.34, 0.14, 0.95)), matBanda);
  const L = levels[nLev];
  for (const [f0, f1, dob] of [[0.19, 0.79, 0.35], [0.31, 0.67, -0.3]]) {
    const a = L[Math.round(n * f0) % n], b = L[Math.round(n * f1) % n]; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; const dx = b[0] - a[0], dz = b[1] - a[1], dl = Math.hypot(dx, dz) || 1;
    const corda = curve([a, [mx - (dz / dl) * dob, mz + (dx / dl) * dob], b], false, 24, 0.5);
    addMap(P.e3, sweep(corda, false, bandaDupla(yT, 0.34, 0.7)), matBanda);
  }
  // e4: vidro recuado (menos na fachada em corte, onde os laboratórios ficam à mostra) e luzes
  const glassPath = subPath(pts, true, corte[1], corte[0] + 1, 120);
  for (let k = 0; k < nLev; k++) { const lv = subPath(levels[k], true, corte[1], corte[0] + 1, 120); addMap(P.e4, sweep(lv, false, [{ a: [-0.28, y0 + k * lh + 0.18], b: [-0.28, y0 + (k + 1) * lh - 0.02], mat: 'fac', uv: 'facade', vBase: y0 }], { caps: false }), () => M.fac_lab); }
  const glow = []; for (let k = 0; k < nLev; k++) { const lv = subPath(levels[k], true, corte[0], corte[1], 40); const nn = normals(lv, false); for (let i = 0; i < lv.length; i += 4) glow.push([lv[i][0] - nn[i][0] * 0.5, y0 + (k + 1) * lh - 0.06, lv[i][1] - nn[i][1] * 0.5]); }
  const gl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.02, 0.06), M.lampGlow, glow.length); glow.forEach((p, i) => gl.setMatrixAt(i, m4.makeTranslation(...p))); P.e4.add(gl);
  return glassPath;
}
// espelho d'água em gota (pontas afinadas) com borda, para o vale urbanizado
function gotaPts(cx, cz, rx, rz, rot, n = 48) {
  const out = []; const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = 1 - 0.28 * Math.max(0, Math.cos(a)) ** 3; const x = Math.cos(a) * rx * (1 + 0.15 * Math.cos(a)), z = Math.sin(a) * rz * k; out.push([cx + x * c - z * s, cz + x * s + z * c]); }
  return out;
}

export function ciencias() {
  const c = A.ciencias; const root = new THREE.Group(); root.name = 'ciencias'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group(), e4: new THREE.Group() };
  const loboA = blob(c.c[0] + 2.6, c.c[1] - 0.9, 4.3, 2.7, c.rot - 0.12, 4);
  const loboB = blob(c.c[0] - 3.2, c.c[1] - 1.6, 2.7, 1.8, c.rot + 0.3, 9);
  lobo(P, loboA, 1.25, 3, 0.7, [0.1, 0.42], 1);
  lobo(P, loboB, 1.05, 2, 0.7, [0.12, 0.36], 2);
  // vale urbanizado à frente: espelho em gota com repuxo e o canal que desce até o bulevar
  const g = A.ciencias.gota || { c: [5.0, 3.4], rx: 1.3, rz: 0.85, rot: 0.25 };
  P.e4.add(plate(gotaPts(g.c[0], g.c[1], g.rx + 0.14, g.rz + 0.14, g.rot), 0.0, 0.07, M.whiteSmooth));
  P.e4.add(plate(gotaPts(g.c[0], g.c[1], g.rx, g.rz, g.rot), 0.0, 0.075, M.pool));
  const rep = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 8, 1, true), dupla(M.glassRail)); rep.position.set(g.c[0], 0.3, g.c[1]); rep.castShadow = false; P.e4.add(rep);
  const can = [[g.c[0] + 0.1, g.c[1] + g.rz * 0.9], [g.c[0] + 0.3, g.c[1] + 3.0], [5.2, 9.6]];
  const cp = curve(can, false, 40, 0.5);
  addMap(P.e4, sweep(cp, false, [{ a: [0.22, 0.0], b: [0.22, 0.07], mat: 'borda', uv: 'run' }, { a: [0.22, 0.07], b: [0.15, 0.07], mat: 'borda', uv: 'plan' }, { a: [0.15, 0.065], b: [-0.15, 0.065], mat: 'agua', uv: 'plan' }, { a: [-0.15, 0.07], b: [-0.22, 0.07], mat: 'borda', uv: 'plan' }, { a: [-0.22, 0.07], b: [-0.22, 0.0], mat: 'borda', uv: 'run' }], { caps: false }), (k) => (k === 'agua' ? M.pool : M.whiteSmooth));
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'ciencias', root, partes: P, esqueletos: {}, grua: { e1: true, e3: true }, foco: { x: c.c[0], z: c.c[1] + 1, dist: 15 }, ancora: [c.c[0] + 1.5, 4.2, c.c[1]] };
}
// Ala em Onda: fita em "S" com terraços entre o Campus Universitário e a Faculdade de Ciências
export function alaOnda() {
  return new Faixa({ id: 'onda', closed: false, path: curve([[-15.4, -5.2], [-13.2, -7.6], [-10.8, -6.3], [-8.6, -7.8], [-6.9, -7.3]], false, 120), modulos: 1,
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
  // árvores na margem: fora da água e fora da faixa da Sede (fita + orla)
  const sd = A.sede; const arco = ellipse(sd.c[0], sd.c[1], sd.rx, sd.rz, sd.rot, 60, 0, 1, sd.a0, sd.a1); const naSede = (x, z) => distPoly(x, z, arco, false) < -sd.o0 + 0.9;
  for (let i = 0, t = 0; i < 18 && t < 300; t++) { const k = (R() * poly.length) | 0; const a = poly[k], b = poly[(k + 1) % poly.length]; const u = R(); const x = a[0] + (b[0] - a[0]) * u + (R() - 0.5) * 1.6, z = a[1] + (b[1] - a[1]) * u + (R() - 0.5) * 1.6; if (inPoly(x, z, poly) || distPoly(x, z, poly) < 0.35 || naSede(x, z)) continue; tr.push({ x, z, s: 0.28 + R() * 0.16, pal: 'jardim' }); i++; }
  P.e2.add(treeGroup(tr.map((t) => ({ ...t, y: Math.max(0, heightAt(t.x, t.z)) }))));
  // e3: estação natural de água — ilhas flutuantes filtrantes (jardins baixos), píer de madeira e casa de bombas
  for (const [x, z, rx, rz] of [[-3.8, -8.6, 0.42, 0.24], [3.4, -8.0, 0.36, 0.21], [1.6, -9.6, 0.3, 0.18], [-3.4, -5.4, 0.33, 0.18]]) { const g = new THREE.CylinderGeometry(1, 1, 0.05, 20); g.scale(rx, 1, rz); const m = mesh(g, M.planter, false); m.position.set(x, -0.07, z); P.e3.add(m); const sh = []; for (let i = 0; i < 4; i++) sh.push({ x: x + (R() - 0.5) * rx, z: z + (R() - 0.5) * rz, y: -0.05, s: 0.07 + R() * 0.04, pal: 'jardim' }); P.e3.add(treeGroup(sh, { cast: false })); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.3), M.woodLight); deck.position.set(6.45, 0.02, -6.7); deck.rotation.y = -0.53; deck.castShadow = true; P.e3.add(deck);
  const house = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.45), M.white); house.position.set(7.9, 0.18, -5.2); house.rotation.y = -0.5; house.castShadow = true; P.e3.add(house);
  const hr = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.04, 0.49), M.roof); hr.position.set(7.9, 0.37, -5.2); hr.rotation.y = -0.5; P.e3.add(hr);
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'lago', root, partes: P, esqueletos: {}, grua: {}, foco: { x: 0.6, z: -7.4, dist: 17 }, ancora: [0.6, 1.4, -7.4] };
}

// ---------------- Pátio da Sede ----------------
// A Sede é a fita aberta (aneis.js). O pátio é o que acompanha a fita: o anel de fundações (e1) e, por dentro
// da curva, a orla de deque voltada para o lago, a piscina redonda de borda branca e as árvores (e4).
export function sedePatio() {
  const s = A.sede; const root = new THREE.Group(); root.name = 'sedePatio'; const P = { e1: new THREE.Group(), e4: new THREE.Group() };
  const arco = ellipse(s.c[0], s.c[1], s.rx, s.rz, s.rot, 200, 0, 1, s.a0, s.a1); const nor = normals(arco, false); const o0 = s.o0;
  // e1: fundações (faixa de concreto um pouco mais larga que a fita)
  addMap(P.e1, sweep(arco, false, [{ a: [0.15, -0.06], b: [0.15, 0.03], mat: 'c', uv: 'run' }, { a: [0.15, 0.03], b: [o0 - 0.15, 0.03], mat: 'c', uv: 'plan' }, { a: [o0 - 0.15, 0.03], b: [o0 - 0.15, -0.06], mat: 'c', uv: 'run' }]), () => M.concreto);
  // e4: orla de deque de 0.35 junto à borda interna
  addMap(P.e4, sweep(arco, false, [{ a: [o0 - 0.2, 0.0], b: [o0 - 0.2, 0.05], mat: 'd', uv: 'run' }, { a: [o0 - 0.2, 0.05], b: [o0 - 0.55, 0.05], mat: 'd', uv: 'plan' }, { a: [o0 - 0.55, 0.05], b: [o0 - 0.55, 0.0], mat: 'd', uv: 'run' }]), () => M.woodLight);
  // piscina redonda de borda branca entre a fita e o lago (a da foto, à direita do lago)
  const pc = s.piscina; if (pc) { const rim = new THREE.Mesh(new THREE.CylinderGeometry(pc.r + 0.12, pc.r + 0.12, 0.1, 40), M.whiteSmooth); rim.position.set(pc.c[0], 0.03, pc.c[1]); rim.castShadow = true; rim.receiveShadow = true; P.e4.add(rim); const w = new THREE.Mesh(new THREE.CircleGeometry(pc.r, 40), M.pool); w.rotation.x = -Math.PI / 2; w.position.set(pc.c[0], 0.085, pc.c[1]); w.receiveShadow = true; P.e4.add(w); }
  // 16 árvores na faixa entre a orla e o lago (nunca dentro da água nem da piscina)
  const tr = []; const R = rng(41); const lago = A.lago;
  for (let t = 0; tr.length < 16 && t < 200; t++) {
    const k = 4 + ((R() * (arco.length - 8)) | 0); const o = o0 - 0.8 - R() * 0.9; const x = arco[k][0] + nor[k][0] * o, z = arco[k][1] + nor[k][1] * o;
    if (inPoly(x, z, lago) || distPoly(x, z, lago) < 0.55) continue; if (pc && Math.hypot(x - pc.c[0], z - pc.c[1]) < pc.r + 0.5) continue;
    tr.push({ x, z, s: 0.22 + R() * 0.1, pal: 'jardim', h: 1.1 });
  }
  P.e4.add(treeGroup(tr));
  for (const k of Object.keys(P)) root.add(P[k]);
  const meio = arco[(arco.length * 0.55) | 0];
  return { id: 'sedePatio', root, partes: P, esqueletos: {}, grua: {}, foco: { x: s.c[0] + 1.5, z: s.c[1] - 1.0, dist: 19 }, ancora: [meio[0], 2.6, meio[1]] };
}
function distPoly(x, z, p, fechado = true) { let d = 1e9; for (let i = fechado ? 0 : 1, j = fechado ? p.length - 1 : 0; i < p.length; j = i++) { const [ax, az] = p[j], [bx, bz] = p[i]; const vx = bx - ax, vz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))); d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t)); } return d; }
