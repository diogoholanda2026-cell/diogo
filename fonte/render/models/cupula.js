// Miolo da folha NE do Trevo: a Vida. Em fila no eixo da folha, do tambor NE ao miolo: a Trilha (passarela), a
// Galeria de entrada, a Estufa Anexa e a Cúpula da Vida; as cascas se cruzam de propósito, como as bolhas do Eden
// Project (Galeria na Estufa 0,2; Estufa na Cúpula 0,35; o vidro da Cúpula só se abre dentro da bolha da Estufa). A
// Cúpula é fechada e sem bichos à vista (pedido do dono): por dentro, a mata tropical com lago, riacho, rochedo e
// cascata e a névoa no alto; por fora, o plinto claro, a malha geodésica branca com nervuras e a lanterna no topo (5,2:
// o marco secundário do leste, par da Biblioteca).
//   bioma (4 etapas): plinto e piso, com a porta envidraçada voltada para a Estufa; estrutura; vidro; lanterna, luzes
//     e névoa
//   savana (4): chão, lago e riacho; rochedo e cascata; mata; emergentes e o sub-bosque (a mata antiga em escala 0,6,
//     com cerca de 55% das árvores)
//   gorilas (Estufa Anexa, 4): plinto da Estufa e a laje do tubo que vai da Galeria à porta da Cúpula (o piso que liga
//     as três peças); malha e as costelas do tubo; vidro; jardim de dentro
//   santuarioInt (Galeria da Cúpula, 2): saguão de vidro redondo sobre plinto, onde chega a Trilha; passarela nas
//     copas (anel elevado por dentro da Cúpula, r 3,8 a 2,6 de altura)
// A casca geodésica e os rochedos moram aqui. Tudo sai de A (planta.js). Raiz e partes sem transformação: cada parte
// monta num grupo local posto no lugar.
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { beams } from '../geom.js';
import { treeGroup } from '../forest.js';
import { rng, TAU } from '../../core/util.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
const rad = (a) => (a * Math.PI) / 180;
// grupo local de uma parte: origem em c ([x, z] do mundo) e eixo x no ângulo a (graus, 0 = leste, 90 = sul)
function quadro(parte, c, a = 0) { const g = new THREE.Group(); g.position.set(c[0], 0, c[1]); g.rotation.y = -rad(a); parte.add(g); return g; }
const anelPts = (c, r, n) => Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU; return [+(c[0] + Math.cos(a) * r).toFixed(3), +(c[1] + Math.sin(a) * r).toFixed(3)]; });
function disco(r, y, mat, n = 48, x = 0, z = 0, rz = r) { const g = new THREE.CircleGeometry(1, n); g.rotateX(-Math.PI / 2); g.scale(r, 1, rz); g.translate(x, y, z); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); return mesh(g, mat, false); }
// coroa horizontal de r0 a r1 em y; com vão (graus, centro aV e meia largura mV) opcional
function coroa(r0, r1, y, mat, n = 64, aV = null, mV = 0) { const g = aV === null ? new THREE.RingGeometry(r0, r1, n) : new THREE.RingGeometry(r0, r1, n, 1, -rad(aV) + mV, TAU - 2 * mV); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return mesh(g, mat, false); }
// parede cilíndrica de r, de y a y + h; com vão opcional (como em coroa)
function parede(r, h, y, mat, n = 64, aV = null, mV = 0) { const g = aV === null ? new THREE.CylinderGeometry(r, r, h, n, 1, true) : new THREE.CylinderGeometry(r, r, h, n, 1, true, Math.PI / 2 - rad(aV) + mV, TAU - 2 * mV); g.translate(0, y + h / 2, 0); return mesh(g, mat); }
function caixa(w, h, d, mat, x, y, z, cast = true) { const o = mesh(new THREE.BoxGeometry(w, h, d), mat, cast); o.position.set(x, y + h / 2, z); return o; }

// ---------------- casca geodésica ----------------
// Casca ovoide baixa: esfera unitária cortada na latitude -k (a parte de baixo curva para dentro), esticada em rx/rz no
// plano e hy na vertical, pousada no plinto a y0. tira(x, y, z): o triângulo cujo centro (já no lugar) dá true sai da
// casca (o portal onde outra bolha entra); a borda do buraco sai à parte (lábio grosso).
function geodome(rx, rz, hy, k, y0, detail = 4, tira = null) {
  const ico = new THREE.IcosahedronGeometry(1, detail); const p = ico.attributes.position; const tri = []; const edges = new Map(); const fb = Math.sqrt(1 - k * k);
  const V = (i) => [p.getX(i), p.getY(i), p.getZ(i)];
  const tf = ([x, y, z]) => { const yy = Math.max(-k, y); const f = yy > y ? fb / (Math.hypot(x, z) || 1) : 1; return [x * f * rx, (yy + k) * hy + y0, z * f * rz]; };
  const key = (u, v) => { const k1 = u.map((q) => q.toFixed(3)).join(), k2 = v.map((q) => q.toFixed(3)).join(); return k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1; };
  const daBoca = new Set();
  for (let i = 0; i < p.count; i += 3) {
    const a = V(i), b = V(i + 1), c = V(i + 2); if (Math.max(a[1], b[1], c[1]) < -k + 0.002) continue;
    const A2 = tf(a), B2 = tf(b), C2 = tf(c);
    if (tira && tira((A2[0] + B2[0] + C2[0]) / 3, (A2[1] + B2[1] + C2[1]) / 3, (A2[2] + B2[2] + C2[2]) / 3)) { for (const [u, v] of [[A2, B2], [B2, C2], [C2, A2]]) daBoca.add(key(u, v)); continue; }
    tri.push(...A2, ...B2, ...C2);
    for (const [u, v] of [[A2, B2], [B2, C2], [C2, A2]]) { const kk = key(u, v); const e = edges.get(kk); if (e) e.n++; else edges.set(kk, { u, v, n: 1 }); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals();
  const all = [], borda = []; for (const [kk, { u, v }] of edges) { all.push([u, v]); if (daBoca.has(kk)) borda.push([u, v]); }
  return { glass: g, edges: all, borda };
}
// medidas de uma casca com base de raio r no alto do plinto (y0) e topo em h, e a casca pronta (vidro e barras)
const medCasca = (r, h, y0) => { const k = 0.12; return { k, rr: r / Math.sqrt(1 - k * k), hy: (h - y0) / (1 + k), y0 }; };
function casca(r, h, y0, detail, tira) { const m = medCasca(r, h, y0); return { ...geodome(m.rr, m.rr, m.hy, m.k, y0, detail, tira), ...m }; }
// ponto da casca na longitude a e latitude f (de -k na base até pi/2 no topo)
function naCasca(d, a, f, dr = 0) { const c = Math.cos(f); return [Math.cos(a) * c * (d.rr + dr), (Math.sin(f) + d.k) * d.hy + d.y0, Math.sin(a) * c * (d.rr + dr)]; }
// ponto (x, y, z) dentro da casca m de centro (cx, cz), nas mesmas coordenadas
const naBolha = (m, cx, cz, x, y, z) => { const q = Math.hypot(x - cx, z - cz) / m.rr; return q < 1 && y >= m.y0 && y <= (Math.sqrt(1 - q * q) + m.k) * m.hy + m.y0; };
// rochedo: dodecaedro amassado (vértices puxados ao acaso, base achatada)
function rocha(x, z, s, seed, y) {
  const g = new THREE.DodecahedronGeometry(1, 1); const p = g.attributes.position; const R = rng(seed * 97 + 5);
  const k = new Map(); for (let i = 0; i < p.count; i++) { const key = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); if (!k.has(key)) k.set(key, 0.75 + R() * 0.5); const f = k.get(key); p.setXYZ(i, p.getX(i) * f, Math.max(-0.2, p.getY(i)) * f * 0.8, p.getZ(i) * f); }
  g.computeVertexNormals(); const m = mesh(g, M.rock); m.scale.set(s, s * (0.7 + R() * 0.5), s * (0.8 + R() * 0.3)); m.rotation.y = R() * 6; m.position.set(x, y + s * 0.1, z); return m;
}

// medidas da Cúpula: base da casca (RB) e topo do vidro (HC); a lanterna e a ponta vão até A.bioma.h
const CUP = (() => { const B = A.bioma; return { B, RB: B.r - 0.12, HC: B.h - 0.35, aP: B.portaAng, mV: 0.1 }; })();
const PISO = 0.32;                                        // chão de dentro da Cúpula (o plinto é de 0,5)
const PATAMAR = A.bioma.plinto + 0.05;                    // piso da porta da Cúpula e da laje do tubo da Estufa
const EST = { r: A.gorilas.r - 0.08, h: A.gorilas.h - 0.03, y0: 0.3 }; // casca da Estufa (a malha fecha em h) e o plinto

// ---------------- a cúpula (bioma) ----------------
export function bioma() {
  const { B, RB, HC, aP, mV } = CUP; const [cx, cz] = B.c, R = B.r, y0 = B.plinto;
  // portal: sai da casca só o que fica dentro da bolha da Estufa (a Cúpula continua fechada para fora)
  const mE = medCasca(EST.r, EST.h, EST.y0), eX = A.gorilas.c[0] - cx, eZ = A.gorilas.c[1] - cz;
  const d = casca(RB, HC, y0, 4, (x, y, z) => naBolha(mE, eX, eZ, x, y, z));
  const root = new THREE.Group(); root.name = 'bioma'; const P = {}; for (const k of ['e1', 'e2', 'e3', 'e4']) { P[k] = new THREE.Group(); root.add(P[k]); }
  // e1: plinto de concreto claro com friso branco (aberto na porta), piso de terra por dentro, a porta envidraçada
  // voltada para a Estufa com o patamar na altura do plinto
  const L1 = quadro(P.e1, B.c);
  L1.add(parede(R, y0, 0, M.concretoClaro, 72, aP, mV)); L1.add(parede(RB - 0.2, y0 - PISO, PISO, dupla(M.concretoClaro), 72, aP, mV * 1.05)); L1.add(coroa(RB - 0.2, R, y0, M.whiteSmooth, 72, aP, mV));
  L1.add(disco(RB - 0.2, PISO - 0.04, M.soil, 48));
  { const pt = quadro(L1, [0, 0], aP);
    pt.add(caixa(0.55, PATAMAR, 0.9, M.concretoClaro, R - 0.325, 0, 0)); pt.add(caixa(0.04, 0.62, 0.8, M.glass, R - 0.08, PATAMAR, 0, false)); pt.children[pt.children.length - 1].renderOrder = 4;
    pt.add(caixa(0.27, 0.07, 0.92, M.whiteSmooth, R - 0.215, PATAMAR + 0.62, 0)); for (const z of [-0.43, 0.43]) pt.add(caixa(0.27, 0.62, 0.06, M.whiteSmooth, R - 0.215, PATAMAR, z)); }
  // e2: malha geodésica branca, o lábio do portal, oito nervuras meridianas mais grossas e o anel do óculo no topo
  const L2 = quadro(P.e2, B.c);
  L2.add(beams(d.edges.filter(([u, v]) => Math.max(u[1], v[1]) >= y0 + 0.1), 0.022, M.whiteSmooth, 3)); if (d.borda.length) L2.add(beams(d.borda, 0.032, M.whiteSmooth, 4));
  const nerv = []; for (let i = 0; i < 8; i++) { const a = rad(aP) + ((i + 0.5) / 8) * TAU; for (let j = 0; j < 10; j++) nerv.push([naCasca(d, a, -d.k + (j / 10) * (1.32 + d.k), 0.03), naCasca(d, a, -d.k + ((j + 1) / 10) * (1.32 + d.k), 0.03)]); }
  const ocl = []; for (let i = 0; i < 20; i++) ocl.push([naCasca(d, (i / 20) * TAU, 1.32, 0.03), naCasca(d, ((i + 1) / 20) * TAU, 1.32, 0.03)]);
  L2.add(beams([...nerv, ...ocl], 0.045, M.whiteSmooth, 5));
  // e3: vidro claro azulado (o mesmo do CRD e da Galeria: a casca se lê como massa de longe e a mata aparece por dentro)
  { const L3 = quadro(P.e3, B.c); const gl = mesh(d.glass, M.glass, false); gl.renderOrder = 4; L3.add(gl); P.e3.userData.semHAO = true; }
  // e4: lanterna no topo (tambor de vidro quente, tampa branca e a ponta dourada até a altura da Cúpula), luzes na base
  // por dentro do vidro e a névoa rala no alto (a mata continua à vista)
  const L4 = quadro(P.e4, B.c); const yO = naCasca(d, 0, 1.32)[1], rO = Math.cos(1.32) * d.rr, yT = B.h - 0.23;
  L4.add(parede(rO * 0.82, yT - yO + 0.02, yO - 0.02, M.glassWarm, 24)); L4.children[L4.children.length - 1].renderOrder = 4;
  { const g = new THREE.ConeGeometry(rO * 0.94, 0.16, 24); g.translate(0, yT + 0.08, 0); L4.add(mesh(g, M.whiteSmooth)); }
  { const g = new THREE.CylinderGeometry(0.012, 0.04, B.h - yT - 0.1, 6); g.translate(0, yT + 0.1 + (B.h - yT - 0.1) / 2, 0); L4.add(mesh(g, M.ouro)); }
  { const luz = []; for (let i = 0; i < 24; i++) { const a = ((i + 0.5) / 24) * TAU; luz.push([Math.cos(a) * (RB - 0.12), y0 + 0.05, Math.sin(a) * (RB - 0.12)]); }
    const li = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.05), M.lampGlow, luz.length); const m4 = new THREE.Matrix4(); luz.forEach((p, i) => li.setMatrixAt(i, m4.makeTranslation(...p))); li.computeBoundingSphere(); L4.add(li); }
  { const nv = disco(RB * 0.5, HC * 0.72, M.glassDome, 32); nv.renderOrder = 3; L4.add(nv); } P.e4.userData.semHAO = true;
  return { id: 'bioma', root, partes: P, esqueletos: {}, grua: { e2: true, e4: true }, foco: { x: cx, z: cz + 1.5, dist: 20 }, ancora: [cx, B.h + 0.6, cz] };
}

// ---------------- o interior (savana) ----------------
export function savana() {
  const { c, r } = A.savana; const [cx, cz] = c; const E = 0.6; // escala da mata antiga (cúpula de r 8)
  const root = new THREE.Group(); root.name = 'savana'; const P = {}; for (const k of ['e1', 'e2', 'e3', 'e4']) { P[k] = new THREE.Group(); root.add(P[k]); }
  const R = rng(8801);
  const lago = { x: -2.4 * E, z: 2.2 * E, rx: 2.5 * E, rz: 1.5 * E }, morro = { x: 1.6 * E, z: -3.4 * E }; // lago do lado da porta, rochedo no fundo
  const noLago = (x, z, m = 0) => ((x - lago.x) / (lago.rx + m)) ** 2 + ((z - lago.z) / (lago.rz + m)) ** 2 < 1;
  const riacho = new THREE.CatmullRomCurve3([[morro.x - 0.36, PISO + 0.05, morro.z + 0.78], [0.24, PISO + 0.05, -0.36], [-0.54, PISO + 0.05, 0.36], [lago.x + 0.72, PISO + 0.05, lago.z - 0.36]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const rpts = riacho.getSpacedPoints(30); const noRiacho = (x, z, m) => rpts.some((p) => Math.hypot(p.x - x, p.z - z) < m);
  // e1: gramado baixo sobre a borda de terra (a mata pode vir antes do plinto da Cúpula), o lago de dentro com praia e
  // o riacho que desce do rochedo; a gente anda num anel perto do vidro, fora do rochedo, aberto no rumo do lago
  const L1 = quadro(P.e1, c);
  L1.add(disco(r - 0.06, PISO, M.lawn, 48)); L1.add(parede(r - 0.06, PISO, 0, M.soil, 48));
  L1.add(disco(lago.rx + 0.2, PISO + 0.015, M.sand, 32, lago.x, lago.z, lago.rz + 0.2)); L1.add(disco(lago.rx, PISO + 0.025, M.pool, 32, lago.x, lago.z, lago.rz));
  { const tg = new THREE.TubeGeometry(riacho, 24, 0.1, 4, false); tg.scale(1, 0.12, 1); tg.translate(0, PISO * 0.88, 0); L1.add(mesh(tg, M.pool, false)); }
  { const aL = Math.atan2(lago.z, lago.x), gap = rad(50); const arco = (rr, a0, a1) => Array.from({ length: 33 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 32; return [+(cx + Math.cos(a) * rr).toFixed(3), +(cz + Math.sin(a) * rr).toFixed(3)]; });
    P.e1.userData.pessoas = { area: [...arco(r - 0.6, aL + gap, aL + TAU - gap), ...arco(r - 1.05, aL + TAU - gap, aL + gap)], y: PISO + 0.01, n: 14 }; }
  // e2: rochedo com a cascata e o poço ao pé
  const L2 = quadro(P.e2, c);
  for (const [x, z, s, y] of [[morro.x, morro.z, 0.9, PISO], [morro.x - 0.66, morro.z + 0.24, 0.6, PISO], [morro.x + 0.72, morro.z + 0.18, 0.55, PISO], [morro.x + 0.12, morro.z - 0.18, 0.66, 0.9], [morro.x - 0.3, morro.z + 0.06, 0.42, 1.3]]) L2.add(rocha(x, z, s, ((x * 37 + z * 11) / E) | 0, y));
  { const q = mesh(new THREE.PlaneGeometry(0.33, 1.3), M.vidroLeitoso, false); q.position.set(morro.x - 0.36, 0.95, morro.z + 0.69); q.renderOrder = 3; L2.add(q); L2.add(disco(0.42, PISO + 0.04, M.pool, 20, morro.x - 0.36, morro.z + 0.84, 0.27)); }
  // e3: mata tropical (copas largas, palmeiras e folhosas), fora do lago, do riacho e do rochedo; perto do vidro, mais
  // baixa (e abaixo da passarela nas copas)
  const livre = (x, z, m = 0.21) => Math.hypot(x, z) < r - 0.55 && !noLago(x, z, 0.2) && !noRiacho(x, z, m) && Math.hypot(x - morro.x, z - morro.z) > 1.15;
  const arv = []; for (let t = 0; arv.length < 60 && t < 2000; t++) { const a = R() * TAU, dd = Math.sqrt(R()) * (r - 0.55); const x = Math.cos(a) * dd, z = Math.sin(a) * dd; if (!livre(x, z) || arv.some((o) => Math.hypot(o.x - x, o.z - z) < 0.36)) continue; const palm = R() < 0.2; const alto = dd < r - 1.3; arv.push({ x, z, y: PISO, s: (palm ? 0.46 + R() * 0.16 : 0.6 + R() * 0.35) * E, kind: palm ? 'palmeira' : R() < 0.5 ? 'folha' : 'folha2', pal: palm ? 'jardim' : R() < 0.12 ? 'outonoClaro' : R() < 0.5 ? 'jardim' : 'mata', h: palm ? 1.8 + R() * 0.6 : (alto ? 1.6 : 1.25) + R() * 0.5 }); }
  quadro(P.e3, c).add(treeGroup(arv, { trunks: true, name: 'mata-cupula' }));
  // e4: emergentes altas (quase tocando a névoa) e o sub-bosque florido na beira do lago e do riacho
  const emg = []; for (let t = 0; emg.length < 9 && t < 600; t++) { const a = R() * TAU, dd = Math.sqrt(R()) * (r - 1.8); const x = Math.cos(a) * dd, z = Math.sin(a) * dd; if (!livre(x, z, 0.36) || emg.some((o) => Math.hypot(o.x - x, o.z - z) < 1.1)) continue; emg.push({ x, z, y: PISO, s: (1.05 + R() * 0.4) * E, kind: R() < 0.5 ? 'folha' : 'folha2', pal: R() < 0.3 ? 'jardim' : 'mata', h: 2.3 + R() * 0.7 }); }
  const sub = []; for (let t = 0; sub.length < 38 && t < 900; t++) { const a = R() * TAU, dd = Math.sqrt(R()) * (r - 0.3); const x = Math.cos(a) * dd, z = Math.sin(a) * dd; if (noLago(x, z, 0.03) || (!noLago(x, z, 0.54) && !noRiacho(x, z, 0.48) && R() < 0.7)) continue; if (noRiacho(x, z, 0.15) || Math.hypot(x, z) > r - 0.25) continue; sub.push({ x, z, y: PISO, s: (0.14 + R() * 0.1) * E, kind: 'folhaLow', pal: R() < 0.35 ? 'outono' : 'jardim', h: 0.8 }); }
  const L4 = quadro(P.e4, c); L4.add(treeGroup(emg, { trunks: true, name: 'emergentes' })); L4.add(treeGroup(sub, { cast: false, name: 'sub-bosque' }));
  return { id: 'savana', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'terra', e3: 'crescer', e4: 'crescer' }, foco: { x: cx, z: cz + 0.5, dist: 13 }, ancora: [cx, 2.4, cz] };
}

// ---------------- a Estufa Anexa (gorilas) ----------------
export function gorilas() {
  const G = A.gorilas, B = A.bioma; const [cx, cz] = G.c, r = G.r, h = G.h, y0 = EST.y0, yL = PATAMAR; // plinto e laje do tubo
  const root = new THREE.Group(); root.name = 'gorilas'; const P = {}; for (const k of ['e1', 'e2', 'e3', 'e4']) { P[k] = new THREE.Group(); root.add(P[k]); }
  // quadro local: x da Estufa para a Cúpula; o tubo vai do centro da Galeria (xG) à porta da Cúpula (xP)
  const aC = (Math.atan2(B.c[1] - cz, B.c[0] - cx) * 180) / Math.PI; const [pG, pP] = G.tubo.pts; const xG = -Math.hypot(pG[0] - cx, pG[1] - cz), xP = Math.hypot(pP[0] - cx, pP[1] - cz); const wT = G.tubo.w;
  const d = casca(EST.r, EST.h, y0, 3);
  // e1: plinto, piso gramado e a laje do tubo (passadiço de 0,55 que atravessa a Estufa da Galeria à porta da Cúpula)
  const L1 = quadro(P.e1, G.c, aC);
  L1.add(parede(r, y0, 0, M.concretoClaro, 48)); L1.add(coroa(r - 0.16, r, y0, M.whiteSmooth, 48)); L1.add(disco(r - 0.16, y0 - 0.005, M.lawn, 32));
  L1.add(caixa(xP - xG, yL, wT, M.concretoClaro, (xG + xP) / 2, 0, 0)); L1.add(caixa(xP - xG, 0.02, wT - 0.12, M.whiteSmooth, (xG + xP) / 2, yL, 0, false));
  // e2: malha da Estufa e as costelas do tubo (arcos brancos sobre o passadiço)
  const L2 = quadro(P.e2, G.c, aC); L2.add(beams(d.edges.filter(([u, v]) => Math.max(u[1], v[1]) >= y0 + 0.08), 0.02, M.whiteSmooth, 3));
  const cost = []; for (const x of [-0.9, -0.3, 0.3, 0.9]) for (let j = 0; j < 6; j++) { const a0 = (Math.PI * j) / 6, a1 = (Math.PI * (j + 1)) / 6; cost.push([[x, yL + Math.sin(a0) * 0.62, Math.cos(a0) * (wT / 2)], [x, yL + Math.sin(a1) * 0.62, Math.cos(a1) * (wT / 2)]]); }
  L2.add(beams(cost, 0.025, M.whiteSmooth, 4));
  // e3: vidro da Estufa e a abóbada do tubo
  const L3 = quadro(P.e3, G.c, aC); { const gl = mesh(d.glass, M.glass, false); gl.renderOrder = 4; L3.add(gl); }
  { const tg = new THREE.CylinderGeometry(wT / 2, wT / 2, 2.0, 12, 1, true, 0, Math.PI); tg.rotateZ(Math.PI / 2); tg.scale(1, 0.62 / (wT / 2), 1); tg.translate(0, yL, 0); const t = mesh(tg, M.glass, false); t.renderOrder = 4; L3.add(t); }
  P.e3.userData.semHAO = true;
  // e4: jardim de dentro (orquídeas): copas baixas floridas, samambaias e palmeirinhas dos dois lados do passadiço e o
  // repuxo do lado da câmera
  const L4 = quadro(P.e4, G.c, aC); const R = rng(8802); const arv = [];
  for (let t = 0; arv.length < 12 && t < 400; t++) { const a = R() * TAU, dd = 0.3 + Math.sqrt(R()) * (r - 0.55); const x = Math.cos(a) * dd, z = Math.sin(a) * dd; if (Math.abs(z) < wT / 2 + 0.15 || Math.hypot(x, z - 0.95) < 0.45 || arv.some((o) => Math.hypot(o.x - x, o.z - z) < 0.3)) continue; const flor = R() < 0.4; arv.push({ x, z, y: y0, s: (flor ? 0.16 + R() * 0.08 : 0.34 + R() * 0.16) * 0.5, kind: flor ? 'folhaLow' : R() < 0.3 ? 'palmeira' : 'folha', pal: flor ? 'outono' : 'jardim', h: flor ? 0.8 : 1.2 + R() * 0.3 }); }
  L4.add(treeGroup(arv, { trunks: true, name: 'estufa' }));
  { const bg = new THREE.CylinderGeometry(0.28, 0.3, 0.1, 20); bg.translate(0, y0 + 0.05, 0.95); L4.add(mesh(bg, M.whiteSmooth)); L4.add(disco(0.24, y0 + 0.105, M.pool, 20, 0, 0.95)); const j = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.45, 8, 1, true), dupla(M.glassRail)); j.position.set(0, y0 + 0.33, 0.95); L4.add(j); }
  return { id: 'gorilas', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: cx, z: cz + 1, dist: 10 }, ancora: [cx, h + 0.6, cz] };
}

// ---------------- Galeria de entrada e passarela nas copas (santuarioInt) ----------------
export function santuarioInterior() {
  const g = A.galeria, B = A.bioma; const root = new THREE.Group(); root.name = 'santuarioInt'; const P = {}; for (const k of ['e1', 'e2']) { P[k] = new THREE.Group(); root.add(P[k]); }
  // e1: saguão de vidro redondo sobre plinto (piso na altura da Trilha, 0,6), pilares finos, laje branca do teto com
  // friso dourado (só a borda aparece)
  const L1 = quadro(P.e1, g.c); const yP = A.trilha.y0, rG = g.r;
  L1.add(parede(rG, yP, 0, M.concretoClaro, 32)); L1.add(disco(rG, yP, M.whiteSmooth, 32));
  { const v = parede(rG - 0.1, g.h - 0.12 - yP, yP, M.glass, 32); v.renderOrder = 4; v.castShadow = false; L1.add(v); }
  { const pil = []; for (let i = 0; i < 8; i++) { const a = ((i + 0.5) / 8) * TAU; pil.push([[Math.cos(a) * (rG - 0.06), yP, Math.sin(a) * (rG - 0.06)], [Math.cos(a) * (rG - 0.06), g.h - 0.12, Math.sin(a) * (rG - 0.06)]]); } L1.add(beams(pil, 0.025, M.whiteSmooth, 4)); }
  { const tg = new THREE.CylinderGeometry(rG, rG - 0.04, 0.12, 32); tg.translate(0, g.h - 0.06, 0); L1.add(mesh(tg, M.whiteSmooth)); L1.add(parede(rG - 0.02, 0.04, g.h - 0.16, M.ouro, 32)); }
  P.e1.userData.pessoas = { area: anelPts(g.c, rG - 0.3, 10), y: yP + 0.01, n: 5 };
  // e2: passarela nas copas: anel elevado por dentro da Cúpula (piso branco com a borda de luz, guarda-corpo de
  // vidro, pilares do chão, que somem sob a mata, e o elevador de vidro junto da porta
  const L2 = quadro(P.e2, B.c); const rA = 3.8, wA = 0.4, yA = 2.6, r0 = rA - wA / 2, r1 = rA + wA / 2;
  { const tg = new THREE.RingGeometry(r0, r1, 72); tg.rotateX(-Math.PI / 2); tg.translate(0, yA, 0); L2.add(mesh(tg, M.whiteSmooth)); const bg = new THREE.RingGeometry(r0, r1, 72); bg.rotateX(Math.PI / 2); bg.translate(0, yA - 0.08, 0); L2.add(mesh(bg, M.concreto, false)); }
  for (const rr of [r0, r1]) { L2.add(parede(rr, 0.08, yA - 0.08, dupla(M.fasciaLuz), 72)); const v = parede(rr + (rr === r0 ? 0.02 : -0.02), 0.13, yA, M.glassRail, 72); v.renderOrder = 3; v.castShadow = false; L2.add(v); }
  { const pil = []; for (let i = 0; i < 10; i++) { const a = ((i + 0.25) / 10) * TAU; pil.push([[Math.cos(a) * rA, 0, Math.sin(a) * rA], [Math.cos(a) * rA, yA - 0.08, Math.sin(a) * rA]]); } L2.add(beams(pil, 0.04, M.whiteSmooth, 6)); }
  { const a = rad(B.portaAng) + 0.3, ex = Math.cos(a) * (rA - 0.02), ez = Math.sin(a) * (rA - 0.02); const el = new THREE.CylinderGeometry(0.2, 0.2, yA + 0.2, 16, 1, true); el.translate(ex, (yA + 0.2) / 2, ez); const o = mesh(el, M.glass, false); o.renderOrder = 4; L2.add(o);
    const tp = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 16); tp.translate(ex, yA + 0.23, ez); L2.add(mesh(tp, M.whiteSmooth)); }
  { const cf = anelPts(B.c, r1 - 0.08, 48), cd = anelPts(B.c, r0 + 0.08, 48); P.e2.userData.pessoas = { area: [...cf, cf[0], cd[0], ...cd.slice(1).reverse(), cd[0]], y: yA + 0.01, n: 8 }; } // gente no anel
  P.e2.userData.semHAO = true;
  return { id: 'santuarioInt', root, partes: P, esqueletos: {}, grua: {}, foco: { x: g.c[0], z: g.c[1] + 1, dist: 12 }, ancora: [g.c[0], g.h + 0.6, g.c[1]] };
}
