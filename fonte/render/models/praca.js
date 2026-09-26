// Praça central (piso plano em leque, dois espelhos d'água de meio-fio claro e água escura, espelho retangular
// turquesa sob o Bulevar com totens, faixa diagonal de copas grandes, laços brancos em gota com jardineiras
// floridas sobre a via do sul), passarelas elevadas com piso cinza-claro, borda verde e jardineiras contínuas,
// a ponte coberta e o caminho da frente.
import * as THREE from 'three';
import { A, PASSARELAS } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { beams } from '../geom.js';
import { treeGroup } from '../forest.js';
import { heightAt } from '../ground.js';
import { rng, hash } from '../../core/util.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
function plate(pts, y, h, mat) { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); return mesh(g, mat); }
const distSeg = (x, z, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz || 1))); return Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t); };
const distLinha = (x, z, l) => { let d = 1e9; for (let i = 1; i < l.length; i++) d = Math.min(d, distSeg(x, z, l[i - 1], l[i])); return d; };
// via do sul (planta da área A; enquanto não existe, o traçado da especificação)
const viaSul = () => (A.vias || []).find((v) => v.id === 'sul')?.pts || [[-3.2, 19.95], [0.5, 19.75], [4.0, 19.5], [7.0, 19.35], [8.9, 19.6], [9.8, 20.0]];

// Deque elevado ao longo de uma curva 3D: piso cinza-claro de concreto (ou branco, o.topo = 'branco') com borda
// clara grossa (fita de luz à noite), linha verde contínua nas duas bordas, corrimão branco e pilares.
// o.jardim = false: ponte lisa (sem verde nem arbustos); o.borda: altura da borda (0.11); o.vidro: guarda-corpo de vidro;
// o.faixaVerde: canteiro contínuo só no lado sul (o Bulevar: o lado norte fica livre para as pessoas), pilares a cada 2,2;
// o.flores: jardineiras floridas (metade das copas em paleta quente); o.via: polilinha a evitar com os pilares;
// o.pilarPasso: distância entre pilares (1.5)
export function deck(pts, w, o = {}) {
  const g = new THREE.Group(); const c = new THREE.CatmullRomCurve3(pts.map(([x, z, h]) => new THREE.Vector3(x, Math.max(heightAt(x, z), 0) + h, z)));
  const L = c.getLength(); const N = Math.max(8, Math.ceil(L / 0.2)); const S = c.getSpacedPoints(N); const hb = o.borda ?? 0.11;
  const B = { top: [], side: [], rail: [], verde: [] }; const U = { top: [], side: [], rail: [], verde: [] }; const I = { top: [], side: [], rail: [], verde: [] }; const arb = [];
  // quadrilátero a, b, a2, b2 (a e b atravessados; a2 e b2 o passo seguinte); cima = true vira a face para cima
  const quad = (k, a, b, a2, b2, cima = false) => { const arr = B[k], idx = I[k]; const n = arr.length / 3; arr.push(...a, ...b, ...a2, ...b2); for (const p of [a, b, a2, b2]) U[k].push(p[0] / 2.2, p[2] / 2.2); if (cima) idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); else idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); };
  const L2 = [], R2 = [];
  for (let i = 0; i <= N; i++) { const p = S[i], q = S[Math.min(N, i + 1)], r = S[Math.max(0, i - 1)]; let tx = q.x - r.x, tz = q.z - r.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; const nx = tz, nz = -tx; L2.push([p.x + nx * w / 2, p.y, p.z + nz * w / 2]); R2.push([p.x - nx * w / 2, p.y, p.z - nz * w / 2]); }
  const m = (p, q, t, h) => [p[0] + (q[0] - p[0]) * t, p[1] + h, p[2] + (q[2] - p[2]) * t];
  const verde = o.jardim !== false; const gb = Math.min(0.3, 0.12 / w);
  for (let i = 0; i < N; i++) {
    const a = L2[i], b = R2[i], a2 = L2[i + 1], b2 = R2[i + 1];
    quad('top', a, b, a2, b2, true);
    const dn = (p) => [p[0], p[1] - hb, p[2]]; const up = (p, h) => [p[0], p[1] + h, p[2]];
    quad('side', dn(a), a, dn(a2), a2); quad('side', b, dn(b), b2, dn(b2)); quad('side', dn(b), dn(a), dn(b2), dn(a2));
    quad('rail', a, up(a, 0.13), a2, up(a2, 0.13)); quad('rail', b, up(b, 0.13), b2, up(b2, 0.13));
    // corrimão branco fino no topo do vidro (dos dois lados)
    quad('side', m(a, b, -0.02, 0.13), m(a, b, 0.03, 0.13), m(a2, b2, -0.02, 0.13), m(a2, b2, 0.03, 0.13)); quad('side', m(a, b, 0.97, 0.13), m(a, b, 1.02, 0.13), m(a2, b2, 0.97, 0.13), m(a2, b2, 1.02, 0.13));
    if (o.faixaVerde) quad('verde', m(a, b, 0.62, 0.03), m(a, b, 0.98, 0.03), m(a2, b2, 0.62, 0.03), m(a2, b2, 0.98, 0.03), true);
    else if (verde) { quad('verde', m(a, b, 0, 0.02), m(a, b, gb, 0.02), m(a2, b2, 0, 0.02), m(a2, b2, gb, 0.02), true); quad('verde', m(a, b, 1 - gb, 0.02), m(a, b, 1, 0.02), m(a2, b2, 1 - gb, 0.02), m(a2, b2, 1, 0.02), true); }
  }
  // jardineiras: arbustos baixos e densos (linha verde contínua vista de cima); no Bulevar só no canteiro do sul;
  // nos laços, metade das copas em paleta quente (flores vermelhas e laranja)
  if (o.faixaVerde) { const passo = Math.max(1, Math.round(0.28 / (L / N))); for (let i = 1, k = 0; i < N; i += passo, k++) { const a = L2[i], b = R2[i]; arb.push({ x: a[0] + (b[0] - a[0]) * 0.8, z: a[2] + (b[2] - a[2]) * 0.8, y: a[1] + 0.03, s: 0.13 + hash(k, 8, 77) * 0.04, kind: 'folhaLow', pal: 'jardim', h: 0.75 }); } }
  else if (verde) { const passo = Math.max(1, Math.round(0.32 / (L / N))); for (let i = 1, k = 0; i < N; i += passo, k++) { const a = L2[i], b = R2[i]; for (const t of [0.1, 0.9]) { const flor = o.flores && hash(k, t * 10, 79) < 0.5; arb.push({ x: a[0] + (b[0] - a[0]) * t, z: a[2] + (b[2] - a[2]) * t, y: a[1] + 0.02, s: (o.flores ? 0.11 : 0.09) + hash(k, t * 10, 77) * 0.03, kind: 'folhaLow', pal: flor ? 'outono' : 'jardim', h: 0.75 }); } } }
  const mk = (k, mat, cast = true) => { const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(B[k], 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(U[k], 2)); bg.setIndex(I[k]); bg.computeVertexNormals(); const mm = mesh(bg, mat, cast); g.add(mm); return mm; };
  mk('top', o.topo === 'branco' ? M.whiteSmooth : M.concreto); mk('side', dupla(M.fasciaLuz || M.fascia)); // borda com fita de luz (acende à noite)
  if (B.verde.length) mk('verde', M.planter, false);
  if (o.vidro) { const rm = mk('rail', M.glassRail, false); rm.renderOrder = 3; } // (o vidro só a pedido: de longe é o corrimão branco que se vê, e custa uma chamada por passarela)
  const cols = []; const step = Math.max(1, Math.round((o.pilarPasso ?? (o.faixaVerde ? 2.2 : 1.5)) / (L / N)));
  for (let i = step; i < N; i += step) { const p = S[i]; const gy = heightAt(p.x, p.z); if (o.via && distLinha(p.x, p.z, o.via) < 0.45) continue; if (p.y - gy > 0.25) cols.push([[p.x, gy - 0.05, p.z], [p.x, p.y - hb, p.z]]); }
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
  const d = PASSARELAS[id]; const root = new THREE.Group(); root.name = 'passarela-' + id;
  // o Bulevar Verde atravessa a praça mais alto (os pontos do meio sobem 0.2; as pontas continuam onde pousam)
  const pts = id === 'bulevar' ? d.pts.map((p, i) => (i === 0 || i === d.pts.length - 1 ? p : [p[0], p[1], p[2] + 0.2])) : d.pts;
  const P = { e1: deck(pts, d.w, id === 'bulevar' ? { faixaVerde: true } : {}) }; root.add(P.e1);
  if (d.patamar) { const f = pts[pts.length - 1]; P.e1.add(patamar(d.patamar, Math.max(heightAt(f[0], f[1]), 0) + f[2])); }
  const m = pts[(pts.length / 2) | 0];
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
// ponto a uma distância d ao longo de uma polilinha, e a normal ali
function aoLongo(l, d) { for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i]; const s = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= s || i === l.length - 1) { const t = Math.min(1, d / s); return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], n: [(b[1] - a[1]) / s, -(b[0] - a[0]) / s] }; } d -= s; } return null; }
const compr = (l) => { let s = 0; for (let i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return s; };
// canteiros orgânicos de grama da praça: [x, z, rx, rz, rot]; o primeiro é a faixa diagonal de copas escuras entre os
// espelhos; os que caem em cima de um espelho saem
const CANTEIROS = [[3.4, 15.3, 1.7, 0.45, -0.55], [-0.7, 14.8, 0.8, 0.5, 0.3], [6.3, 14.2, 0.7, 0.4, 0.5], [8.4, 15.5, 0.5, 0.35, 0.8], [0.3, 12.5, 0.55, 0.38, 0.1], [3.6, 18.0, 0.6, 0.35, 0.05]];
// laços brancos em gota sobre a via do sul (rampas de passeio com jardineiras floridas)
const LACOS = [
  [[-1.2, 17.9, 0.08], [-2.6, 18.9, 0.45], [-2.2, 19.75, 0.55], [-0.4, 19.7, 0.5], [0.5, 19.0, 0.3], [0.2, 18.2, 0.08]],
  [[7.0, 18.1, 0.08], [8.2, 19.0, 0.45], [8.0, 19.8, 0.55], [6.4, 19.9, 0.5], [5.6, 19.2, 0.3], [6.0, 18.4, 0.08]],
];
function lacos() { const g = new THREE.Group(); g.name = 'lacos'; const via = viaSul(); for (const pts of LACOS) g.add(deck(pts, 0.45, { flores: true, topo: 'branco', via })); return g; }

export function praca() {
  const root = new THREE.Group(); root.name = 'praca'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  P.e1.userData.chao = 'praca'; // o piso (com os caminhos em leque) é pintado no terreno ao concluir
  const poly = A.praca.poly; const cam = A.pracaCaminhos || [];
  const inP = (x, z) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; };
  const nearPool = (x, z, m = 0.5) => A.lagosPraca.some((l) => { const c = Math.cos(-l.rot), s = Math.sin(-l.rot); const dx = x - l.c[0], dz = z - l.c[1]; const u = dx * c - dz * s, v = dx * s + dz * c; return Math.hypot(u / (l.rx * 1.18 + m), v / (l.rz * 1.18 + m)) < 1; });
  const noCaminho = (x, z, m) => cam.some((l) => distLinha(x, z, l) < m);
  const RET = [[3.6, 12.3], [4.7, 12.3], [4.55, 14.7], [3.75, 14.7]]; const noRet = (x, z) => x > 3.3 && x < 5.0 && z > 12.0 && z < 15.0;
  // e2: espelhos d'água orgânicos com meio-fio claro fino e água escura espelhada (arbustos só no lado norte), a ilha
  // arborizada do espelho grande, o espelho retangular afunilado sob o Bulevar e os canteiros de grama
  const R = rng(19); const arb = [], ilhaArv = [];
  A.lagosPraca.forEach((l, li) => {
    P.e2.add(plate(blobPts(l.c[0], l.c[1], l.rx + 0.12, l.rz + 0.12, l.rot, 30 + li), 0.0, 0.06, M.whiteSmooth));
    P.e2.add(plate(blobPts(l.c[0], l.c[1], l.rx, l.rz, l.rot, 30 + li), 0.0, 0.07, M.pool));
    const b = blobPts(l.c[0], l.c[1], l.rx + 0.16, l.rz + 0.16, l.rot, 30 + li, 24);
    for (let i = 0, k = 0; i < 24 && k < 12; i++) { const [x, z] = b[i]; if (z > l.c[1] - 0.1) continue; k++; arb.push({ x: x + (R() - 0.5) * 0.1, z: z + (R() - 0.5) * 0.1, y: 0.06, s: 0.1 + R() * 0.05, kind: 'folhaLow', pal: 'jardim', h: 0.8 }); }
    if (li === 0) { const ix = l.c[0] - l.rx * 0.35, iz = l.c[1] + 0.05; P.e2.add(plate(blobPts(ix, iz, 0.42, 0.26, l.rot, 77), 0.0, 0.09, M.planter)); for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.28 + 0.4; ilhaArv.push({ x: ix + Math.cos(a) * 0.18, z: iz + Math.sin(a) * 0.1, y: 0.09, s: 0.34, kind: 'folha', pal: 'jardim', h: 1.1 }); } }
  });
  P.e2.add(plate([[3.5, 12.2], [4.8, 12.2], [4.65, 14.8], [3.65, 14.8]], 0.0, 0.075, M.whiteSmooth)); P.e2.add(plate(RET, 0.0, 0.06 + 0.02, M.pool));
  const canteiros = CANTEIROS.filter(([x, z, rx, rz], i) => inP(x, z) && !nearPool(x, z, 0.3) && !noRet(x, z) && (i === 0 || !noCaminho(x, z, Math.min(rx, rz) * 0.9 + 0.15))); // (a faixa diagonal atravessa um caminho do leque, como na foto)
  canteiros.forEach(([x, z, rx, rz, rot], i) => { P.e2.add(plate(blobPts(x, z, rx, rz, rot, 50 + i, 40), 0.0, 0.08, M.planter)); const b = blobPts(x, z, rx - 0.06, rz - 0.06, rot, 50 + i, 10); for (const [bx, bz] of b) arb.push({ x: bx, z: bz, y: 0.07, s: 0.08 + R() * 0.05, kind: 'folhaLow', pal: 'jardim', h: 0.8 }); });
  P.e2.add(treeGroup(arb, { cast: false, name: 'borda-lagos' })); P.e2.add(treeGroup(ilhaArv, { name: 'ilha-praca' }));
  // e3: a faixa diagonal de copas escuras grandes (canteiro 0, duas linhas), árvores de copa larga em grupos junto aos
  // caminhos (poucas palmeiras), os totens do espelho retangular, pontos de luz baixos no piso e os laços do sul
  const trees = []; const livre = (x, z) => inP(x, z) && !nearPool(x, z, 0.25) && !noRet(x, z) && !noCaminho(x, z, 0.36) && trees.every((t) => Math.hypot(t.x - x, t.z - z) > 0.35);
  canteiros.forEach(([x, z, rx, rz, rot], ci) => {
    const c = Math.cos(rot), s = Math.sin(rot); const i0 = CANTEIROS.findIndex((k) => k[0] === x && k[1] === z);
    if (i0 === 0) { for (let k = 0; k < 9; k++) { const u = -1.52 + k * 0.38, v = (k % 2 ? 0.14 : -0.14); trees.push({ x: x + u * c - v * s, z: z + u * s + v * c, y: 0.07, s: 0.38 + R() * 0.08, kind: 'folha', pal: 'mata', h: 1.0 }); } return; }
    const n = 2 + ((R() * 2) | 0); for (let k = 0; k < n; k++) { const a = R() * 6.28, d = R() * 0.6; const u = Math.cos(a) * rx * d, v = Math.sin(a) * rz * d; const px = x + u * c - v * s, pz = z + u * s + v * c; if (trees.some((t) => Math.hypot(t.x - px, t.z - pz) < 0.3)) continue; const palm = R() < 0.15; trees.push({ x: px, z: pz, y: 0.07, s: palm ? 0.24 + R() * 0.08 : 0.32 + R() * 0.14, kind: palm ? 'palmeira' : 'folha', pal: i0 === 2 && k === 0 ? 'outono' : 'jardim', h: palm ? 1.2 : 1.0 }); }
  });
  for (let t = 0; trees.length < 34 && t < 900; t++) {
    const l = cam[(R() * cam.length) | 0]; if (!l) break; const q = aoLongo(l, R() * compr(l)); if (!q) continue; const lado = R() < 0.5 ? -1 : 1; const off = 0.65 + R() * 0.8;
    const cx = q.p[0] + q.n[0] * off * lado, cz = q.p[1] + q.n[1] * off * lado; if (!livre(cx, cz)) continue;
    const n = 3 + ((R() * 3) | 0);
    for (let k = 0, u = 0; k < n && trees.length < 34 && u < 20; u++) { const x = cx + (R() - 0.5) * 1.2, z = cz + (R() - 0.5) * 1.2; if (!livre(x, z)) continue; k++; const palm = R() < 0.12; trees.push({ x, z, y: 0.02, s: palm ? 0.24 + R() * 0.06 : 0.32 + R() * 0.14, kind: palm ? 'palmeira' : 'folha', pal: 'jardim', h: palm ? 1.2 : 1.0 }); }
  }
  P.e3.add(treeGroup(trees, { trunks: true }));
  const TOTENS = [[3.2, 12.2], [5.1, 12.15]];
  P.e3.add(beams(TOTENS.map(([x, z]) => [[x, 0, z], [x, 1.2, z]]), 0.03, M.whiteSmooth, 6));
  const lamps = []; const total = cam.reduce((s, l) => s + compr(l), 0);
  for (let i = 0; i < 20; i++) { let d = ((i + 0.5) / 20) * total; let l = null; for (const c of cam) { const L = compr(c); if (d <= L) { l = c; break; } d -= L; } if (!l) continue; const q = aoLongo(l, d); const lado = i % 2 ? 1 : -1; const x = q.p[0] + q.n[0] * 0.38 * lado, z = q.p[1] + q.n[1] * 0.38 * lado; if (!inP(x, z) || nearPool(x, z, 0.1) || noRet(x, z)) continue; lamps.push([x, 0.12, z]); }
  for (const [x, z] of TOTENS) lamps.push([x, 1.22, z]);
  const lg = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), M.lampGlow, lamps.length); const m4 = new THREE.Matrix4(); lamps.forEach((p, i) => lg.setMatrixAt(i, m4.makeTranslation(...p))); P.e3.add(lg);
  P.e3.add(lacos());
  P.e3.userData.pessoas = { area: poly, n: 90 };
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'praca', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'terra', e3: 'crescer' }, foco: { x: 4.2, z: 15.8, dist: 13 }, ancora: [4.2, 1.2, 15.8] };
}
