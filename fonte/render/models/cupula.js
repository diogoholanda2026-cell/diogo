// Cúpula da Vida (quadra leste do plano diretor). Os antigos habitats de animais viraram uma cúpula de vidro fechada:
// por dentro, uma mata tropical com lago, riacho, rochedo e cascata e a névoa no alto (a fauna não aparece); por fora,
// o plinto claro, a malha geodésica branca com as nervuras e a lanterna no topo, a estufa anexa ligada por um tubo de
// vidro e a galeria de entrada no sudoeste, onde chega a Trilha da Cúpula. A fita do Santuário abraça a cúpula pelo
// norte (aneis.js).
//   bioma (4 etapas): plinto e piso; estrutura; vidro; lanterna, luzes e névoa
//   savana (4): chão, lago e riacho; rochedo e cascata; mata; emergentes e o sub-bosque florido
//   gorilas (4): estufa anexa (plinto, estrutura, vidro com o tubo, jardim de dentro)
//   santuarioInt (2): galeria de entrada; passarela nas copas (anel elevado por dentro da cúpula)
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { beams } from '../geom.js';
import { treeGroup } from '../forest.js';
import { deck } from './praca.js';
import { geodome, rocha } from './leste.js';
import { rng, TAU } from '../../core/util.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
const LOCAL = {};
const local = (k, make) => LOCAL[k] || (LOCAL[k] = make());
// vidro da cúpula: claro, levemente azulado, com o reflexo do céu (dá para ver a mata por dentro)
const vidro = () => local('vidro', () => new THREE.MeshStandardMaterial({ color: 0xd4eaf2, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.5 }));
const nevoa = () => local('nevoa', () => new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
const queda = () => local('queda', () => new THREE.MeshBasicMaterial({ color: 0xeef9ff, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));

function disco(r, y, mat, n = 64, x = 0, z = 0, rz = r) { const g = new THREE.CircleGeometry(1, n); g.rotateX(-Math.PI / 2); g.scale(r, 1, rz); g.translate(x, y, z); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); return mesh(g, mat, false); }
function coroa(r0, r1, y, mat, n = 96) { const g = new THREE.RingGeometry(r0, r1, n); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return mesh(g, mat, false); }
function parede(r, h, y, mat, n = 96) { const g = new THREE.CylinderGeometry(r, r, h, n, 1, true); g.translate(0, y + h / 2, 0); return mesh(g, mat); }
// casca geodésica com base de raio r no alto do plinto (y0) e topo em h
function casca(r, h, y0, detail) { const k = 0.12, fb = Math.sqrt(1 - k * k); return { ...geodome(r / fb, r / fb, (h - y0) / (1 + k), k, y0, detail, []), k, rr: r / fb, hy: (h - y0) / (1 + k), y0 }; }
// ponto da casca na longitude a e latitude f (de -k na base até pi/2 no topo)
function naCasca(d, a, f, dr = 0) { const c = Math.cos(f); return [Math.cos(a) * c * (d.rr + dr), (Math.sin(f) + d.k) * d.hy + d.y0, Math.sin(a) * c * (d.rr + dr)]; }

// ---------------- a cúpula (bioma) ----------------
export function bioma() {
  const { c: [cx, cz], r, h } = A.bioma; const y0 = 0.5;
  const root = new THREE.Group(); root.name = 'bioma'; root.position.set(cx, 0, cz); const P = {};
  const d = casca(r, h, y0, 6);
  // e1: plinto de concreto claro com friso branco, piso de terra por dentro e três portas envidraçadas (galeria no
  // sudoeste, Elo no sul, tubo da estufa a leste)
  P.e1 = new THREE.Group();
  P.e1.add(parede(r + 0.12, y0, 0, M.concretoClaro)); P.e1.add(coroa(r - 0.25, r + 0.2, y0, M.whiteSmooth)); P.e1.add(disco(r - 0.05, 0.28, M.soil));
  const portas = [Math.atan2(A.galeria.c[1] - cz, A.galeria.c[0] - cx), Math.PI / 2 - 0.2, Math.atan2(A.gorilas.c[1] - cz, A.gorilas.c[0] - cx)];
  for (const a of portas) { const p = new THREE.Group(); p.position.set(Math.cos(a) * (r + 0.1), 0, Math.sin(a) * (r + 0.1)); p.rotation.y = -a + Math.PI / 2; P.e1.add(p);
    const v = mesh(new THREE.BoxGeometry(1.4, 0.95, 0.5), vidro(), false); v.position.y = 0.48; v.renderOrder = 4; p.add(v); const t = mesh(new THREE.BoxGeometry(1.6, 0.08, 0.7), M.whiteSmooth); t.position.y = 0.99; p.add(t); }
  // e2: malha geodésica branca, oito nervuras meridianas mais grossas e o anel do óculo no topo
  P.e2 = new THREE.Group(); P.e2.add(beams(d.edges.filter(([u, v]) => Math.max(u[1], v[1]) >= y0 + 0.15), 0.035, M.whiteSmooth, 3));
  const nerv = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; for (let j = 0; j < 12; j++) nerv.push([naCasca(d, a, -d.k + (j / 12) * (1.32 + d.k), 0.04), naCasca(d, a, -d.k + ((j + 1) / 12) * (1.32 + d.k), 0.04)]); }
  const ocl = []; for (let i = 0; i < 24; i++) ocl.push([naCasca(d, (i / 24) * TAU, 1.32, 0.04), naCasca(d, ((i + 1) / 24) * TAU, 1.32, 0.04)]);
  P.e2.add(beams([...nerv, ...ocl], 0.08, M.whiteSmooth, 5));
  // e3: vidro
  P.e3 = new THREE.Group(); const gl = mesh(d.glass, vidro(), false); gl.renderOrder = 4; P.e3.add(gl); P.e3.userData.semHAO = true;
  // e4: lanterna no topo (tambor de vidro quente, tampa branca e a ponta dourada), anel de luz na base e a névoa
  P.e4 = new THREE.Group(); const topo = naCasca(d, 0, 1.32)[1]; const rO = Math.cos(1.32) * d.rr;
  const tb = mesh(new THREE.CylinderGeometry(rO * 0.8, rO * 0.9, 0.7, 24, 1, true), M.glassWarm, false); tb.position.y = topo + 0.3; P.e4.add(tb);
  const tampa = mesh(new THREE.ConeGeometry(rO * 0.95, 0.5, 24), M.whiteSmooth); tampa.position.y = topo + 0.9; P.e4.add(tampa);
  const pta = mesh(new THREE.CylinderGeometry(0.02, 0.06, 0.9, 8), M.ouro || M.yellow); pta.position.y = topo + 1.5; P.e4.add(pta);
  const luz = []; for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; luz.push([Math.cos(a) * (r + 0.05), y0 + 0.04, Math.sin(a) * (r + 0.05)]); }
  const li = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 4), M.lampGlow, luz.length); const m4 = new THREE.Matrix4(); luz.forEach((p, i) => li.setMatrixAt(i, m4.makeTranslation(...p))); P.e4.add(li);
  const nv = disco(r * 0.55, h * 0.7, nevoa(), 40); nv.renderOrder = 3; P.e4.add(nv); P.e4.userData.semHAO = true; // névoa rala no alto (a mata continua à vista)
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'bioma', root, partes: P, esqueletos: {}, grua: { e2: true, e4: true }, foco: { x: cx, z: cz + 2, dist: 24 }, ancora: [cx, h + 1.2, cz] };
}

// ---------------- o interior (savana) ----------------
export function savana() {
  const { c: [cx, cz], r } = A.savana; const root = new THREE.Group(); root.name = 'savana'; root.position.set(cx, 0, cz); const P = {}; const R = rng(8801);
  const lago = { x: -2.4, z: 2.2, rx: 2.5, rz: 1.5 }, morro = { x: 1.6, z: -3.4 };
  const noLago = (x, z, m = 0) => ((x - lago.x) / (lago.rx + m)) ** 2 + ((z - lago.z) / (lago.rz + m)) ** 2 < 1;
  const riacho = new THREE.CatmullRomCurve3([[morro.x - 0.6, 0.37, morro.z + 1.3], [0.4, 0.37, -0.6], [-0.9, 0.37, 0.6], [lago.x + 1.2, 0.37, lago.z - 0.6]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const rpts = riacho.getSpacedPoints(40); const noRiacho = (x, z, m) => rpts.some((p) => Math.hypot(p.x - x, p.z - z) < m);
  // e1: gramado baixo, o lago de dentro com praia e o riacho que desce do rochedo
  P.e1 = new THREE.Group(); P.e1.add(disco(r - 0.1, 0.32, M.lawn));
  P.e1.add(disco(lago.rx + 0.35, 0.335, M.sand, 40, lago.x, lago.z, lago.rz + 0.35)); P.e1.add(disco(lago.rx, 0.345, M.pool, 40, lago.x, lago.z, lago.rz));
  { const tg = new THREE.TubeGeometry(riacho, 40, 0.16, 4, false); tg.scale(1, 0.12, 1); tg.translate(0, 0.33, 0); P.e1.add(mesh(tg, M.pool, false)); }
  P.e1.userData.pessoas = { area: Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * TAU; return [cx + Math.cos(a) * (r - 1.2), cz + Math.sin(a) * (r - 1.2)]; }), y: 0.33, n: 24 };
  // e2: rochedo com a cascata e o poço ao pé
  P.e2 = new THREE.Group();
  for (const [x, z, s, y] of [[morro.x, morro.z, 1.5, 0.3], [morro.x - 1.1, morro.z + 0.4, 1.0, 0.3], [morro.x + 1.2, morro.z + 0.3, 0.9, 0.3], [morro.x + 0.2, morro.z - 0.3, 1.1, 1.3], [morro.x - 0.5, morro.z + 0.1, 0.7, 2.0]]) P.e2.add(rocha(x, z, s, (x * 37 + z * 11) | 0, y, M.rock));
  { const q = mesh(new THREE.PlaneGeometry(0.55, 2.2), queda(), false); q.position.set(morro.x - 0.6, 1.4, morro.z + 1.15); q.renderOrder = 3; P.e2.add(q); P.e2.add(disco(0.7, 0.36, M.pool, 24, morro.x - 0.6, morro.z + 1.4, 0.45)); }
  // e3: mata tropical (copas largas, palmeiras e folhosas), fora do lago, do riacho e do rochedo
  const livre = (x, z, m = 0.35) => Math.hypot(x, z) < r - 0.7 && !noLago(x, z, 0.35) && !noRiacho(x, z, m) && Math.hypot(x - morro.x, z - morro.z) > 1.9;
  const arv = []; for (let t = 0; arv.length < 110 && t < 2000; t++) { const a = R() * TAU, d = Math.sqrt(R()) * (r - 0.7); const x = Math.cos(a) * d, z = Math.sin(a) * d; if (!livre(x, z) || arv.some((o) => Math.hypot(o.x - x, o.z - z) < 0.5)) continue; const palm = R() < 0.2; const alto = Math.hypot(x, z) < r - 2.2; arv.push({ x, z, y: 0.32, s: palm ? 0.46 + R() * 0.16 : 0.6 + R() * 0.35, kind: palm ? 'palmeira' : R() < 0.5 ? 'folha' : 'folha2', pal: palm ? 'jardim' : R() < 0.12 ? 'outonoClaro' : R() < 0.5 ? 'jardim' : 'mata', h: palm ? 1.8 + R() * 0.6 : (alto ? 1.6 : 1.25) + R() * 0.5 }); } // (perto do vidro a mata é mais baixa)
  P.e3 = new THREE.Group(); P.e3.add(treeGroup(arv, { trunks: true, name: 'mata-cupula' }));
  // e4: emergentes altas (quase tocando a névoa) e o sub-bosque florido na beira do lago e das trilhas
  const emg = []; for (let t = 0; emg.length < 16 && t < 600; t++) { const a = R() * TAU, d = Math.sqrt(R()) * (r - 3.0); const x = Math.cos(a) * d, z = Math.sin(a) * d; if (!livre(x, z, 0.6) || emg.some((o) => Math.hypot(o.x - x, o.z - z) < 1.8)) continue; emg.push({ x, z, y: 0.32, s: 1.05 + R() * 0.4, kind: R() < 0.5 ? 'folha' : 'folha2', pal: R() < 0.3 ? 'jardim' : 'mata', h: 2.3 + R() * 0.7 }); }
  const sub = []; for (let t = 0; sub.length < 70 && t < 900; t++) { const a = R() * TAU, d = Math.sqrt(R()) * (r - 0.5); const x = Math.cos(a) * d, z = Math.sin(a) * d; if (noLago(x, z, 0.05) || !noLago(x, z, 0.9) && !noRiacho(x, z, 0.8) && R() < 0.7) continue; if (noRiacho(x, z, 0.25) || Math.hypot(x, z) > r - 0.4) continue; sub.push({ x, z, y: 0.32, s: 0.14 + R() * 0.1, kind: 'folhaLow', pal: R() < 0.35 ? 'outono' : 'jardim', h: 0.8 }); }
  P.e4 = new THREE.Group(); P.e4.add(treeGroup(emg, { trunks: true, name: 'emergentes' })); P.e4.add(treeGroup(sub, { cast: false, name: 'sub-bosque' }));
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'savana', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'terra', e3: 'crescer', e4: 'crescer' }, foco: { x: cx - 1, z: cz + 1, dist: 16 }, ancora: [cx, 2.2, cz] };
}

// ---------------- a estufa anexa (gorilas) ----------------
export function gorilas() {
  const { c: [cx, cz], r, h } = A.gorilas; const B = A.bioma; const y0 = 0.35;
  const root = new THREE.Group(); root.name = 'gorilas'; root.position.set(cx, 0, cz); const P = {}; const d = casca(r, h, y0, 4);
  // tubo de vidro entre as duas cascas (coordenadas locais da estufa)
  const ux = cx - B.c[0], uz = cz - B.c[1], L = Math.hypot(ux, uz); const dx = ux / L, dz = uz / L;
  const a0 = [B.c[0] + dx * (B.r - 0.4) - cx, B.c[1] + dz * (B.r - 0.4) - cz], a1 = [-dx * (r - 0.3), -dz * (r - 0.3)]; const tl = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), tc = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2], ta = Math.atan2(a1[0] - a0[0], a1[1] - a0[1]);
  // e1: plinto, piso gramado e a laje do tubo
  P.e1 = new THREE.Group(); P.e1.add(parede(r + 0.1, y0, 0, M.concretoClaro, 64)); P.e1.add(coroa(r - 0.2, r + 0.16, y0, M.whiteSmooth, 64)); P.e1.add(disco(r - 0.05, 0.3, M.lawn, 48));
  { const lj = mesh(new THREE.BoxGeometry(1.3, 0.3, tl), M.concretoClaro); lj.position.set(tc[0], 0.15, tc[1]); lj.rotation.y = ta; P.e1.add(lj); }
  // e2: estrutura
  P.e2 = new THREE.Group(); P.e2.add(beams(d.edges.filter(([u, v]) => Math.max(u[1], v[1]) >= y0 + 0.1), 0.03, M.whiteSmooth, 3));
  { const cost = []; for (let i = 0; i <= 6; i++) { const t = i / 6; const x = a0[0] + (a1[0] - a0[0]) * t, z = a0[1] + (a1[1] - a0[1]) * t; cost.push([[x - Math.cos(ta) * 0.55, 0.3, z + Math.sin(ta) * 0.55], [x - Math.cos(ta) * 0.55, 1.05, z + Math.sin(ta) * 0.55]], [[x + Math.cos(ta) * 0.55, 0.3, z - Math.sin(ta) * 0.55], [x + Math.cos(ta) * 0.55, 1.05, z - Math.sin(ta) * 0.55]]); } P.e2.add(beams(cost, 0.035, M.whiteSmooth, 4)); }
  // e3: vidro da estufa e do tubo (abóbada)
  P.e3 = new THREE.Group(); const gl = mesh(d.glass, vidro(), false); gl.renderOrder = 4; P.e3.add(gl); P.e3.userData.semHAO = true;
  { const tg = new THREE.CylinderGeometry(0.6, 0.6, tl, 16, 1, true, 0, Math.PI); tg.rotateX(Math.PI / 2); tg.rotateZ(Math.PI / 2); const t = mesh(tg, vidro(), false); t.position.set(tc[0], 1.0, tc[1]); t.rotation.y = ta; t.renderOrder = 4; P.e3.add(t); }
  // e4: jardim de dentro (estufa de orquídeas): copas baixas floridas, samambaias e o repuxo no meio
  P.e4 = new THREE.Group(); const R = rng(8802); const arv = [];
  for (let t = 0; arv.length < 22 && t < 400; t++) { const a = R() * TAU, dd = 0.6 + Math.sqrt(R()) * (r - 1.1); const x = Math.cos(a) * dd, z = Math.sin(a) * dd; if (arv.some((o) => Math.hypot(o.x - x, o.z - z) < 0.45)) continue; const flor = R() < 0.4; arv.push({ x, z, y: 0.3, s: flor ? 0.16 + R() * 0.08 : 0.34 + R() * 0.16, kind: flor ? 'folhaLow' : R() < 0.3 ? 'palmeira' : 'folha', pal: flor ? 'outono' : 'jardim', h: flor ? 0.8 : 1.2 + R() * 0.3 }); }
  P.e4.add(treeGroup(arv, { trunks: true, name: 'estufa' }));
  { const b = mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.12, 24), M.whiteSmooth); b.position.y = 0.36; P.e4.add(b); P.e4.add(disco(0.42, 0.43, M.pool, 24)); const j = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.7, 8, 1, true), dupla(M.glassRail)); j.position.y = 0.78; P.e4.add(j); }
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'gorilas', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: cx - 1.5, z: cz - 1.5, dist: 13 }, ancora: [cx, h + 0.8, cz] };
}

// ---------------- galeria de entrada e passarela nas copas (santuarioInt) ----------------
export function santuarioInterior() {
  const g = A.galeria, B = A.bioma; const root = new THREE.Group(); root.name = 'santuarioInt'; const P = {};
  // e1: galeria envidraçada de frente para a Trilha da Cúpula: salão baixo de vidro, laje branca em balanço, pilares
  // finos e a praça redonda de chegada
  P.e1 = new THREE.Group(); const gp = new THREE.Group(); gp.position.set(g.c[0], 0, g.c[1]); gp.rotation.y = g.rot; P.e1.add(gp);
  gp.add(disco(2.0, 0.02, M.pavers, 40, -1.8, 0)); const sal = mesh(new THREE.BoxGeometry(2.8, 0.9, 1.5), vidro(), false); sal.position.set(0, 0.47, 0); sal.renderOrder = 4; gp.add(sal);
  const laje = mesh(new THREE.BoxGeometry(3.8, 0.1, 2.3), M.whiteSmooth); laje.position.set(-0.4, 0.97, 0); gp.add(laje); const faixa = mesh(new THREE.BoxGeometry(3.86, 0.04, 2.36), M.ouro || M.yellow); faixa.position.set(-0.4, 0.97, 0); gp.add(faixa); // (friso dourado: só a borda aparece sob a laje)
  const pil = []; for (const x of [-2.2, -0.9, 0.4, 1.35]) for (const z of [-1.05, 1.05]) pil.push([[x, 0, z], [x, 0.93, z]]); gp.add(beams(pil, 0.03, M.whiteSmooth, 4));
  P.e1.userData.pessoas = { area: Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * TAU; const lx = -1.8 + Math.cos(a) * 1.6, lz = Math.sin(a) * 1.6; return [g.c[0] + lx * Math.cos(g.rot) + lz * Math.sin(g.rot), g.c[1] - lx * Math.sin(g.rot) + lz * Math.cos(g.rot)]; }), y: 0.03, n: 10 };
  // e2: passarela nas copas: anel elevado por dentro da cúpula (piso branco, guarda-corpo de vidro)
  const rS = B.r * 0.62; const pts = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU + 0.3; pts.push([B.c[0] + Math.cos(a) * rS, B.c[1] + Math.sin(a) * rS, 2.4]); }
  P.e2 = new THREE.Group(); P.e2.add(deck(pts, 0.5, { jardim: false, topo: 'branco', vidro: true, pilarPasso: 2.4 }));
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'santuarioInt', root, partes: P, esqueletos: {}, grua: {}, foco: { x: g.c[0] + 1.5, z: g.c[1] - 1.5, dist: 14 }, ancora: [g.c[0], 2.0, g.c[1]] };
}
