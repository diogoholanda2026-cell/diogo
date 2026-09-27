// Coração do Trevo da Holding (plano mestre, revisão 6): a Torre da Holding na ilha (bolo de noiva em 4 camadas de 24
// lados, creme e champanhe, terraços-jardim com friso de ouro, coroa de vidro âmbar e heliponto: o único pico, 14,0),
// o pátio da Sede (fundações, pórtico sobre o portal, piscinas, ponte privada e o pavilhão guarda-chuva), o Lago
// Central em 4 bacias (margens vivas, renque do jardim, bosquetes, diques-jardim, jardins flutuantes, repuxos,
// calçada e os canais dos vales até os Repuxos) e a Faculdade de Ciências no miolo da folha da Universidade (rede de
// bandas brancas sobre pilotis, laboratórios, casca e vidro espelhado). Medidas de A (planta.js), coordenadas do mundo.
import * as THREE from 'three';
import { A, J, ANEL_MESTRE as AM, trechosDe, trecho } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { sweep, beams, curve, normals, merge, terraceFloor, terraceOutline, medidas, BAY } from '../geom.js';
import { treeGroup } from '../forest.js';
import { heightAt } from '../ground.js';
import { rng, inPoly } from '../../core/util.js';
import { deck } from './praca.js';
import { heliponto } from '../cidade.js';

const PI2 = Math.PI * 2, rad = (g) => (g * Math.PI) / 180;
const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
function shapeOf(pts, s = new THREE.Shape()) { pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); return s; }
function uvPlano(g) { const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); }
function plate(pts, y, h, mat) { const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); uvPlano(g); return mesh(g, mat); }
function flat(pts, y, mat) { const g = new THREE.ShapeGeometry(shapeOf(pts)); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); uvPlano(g); return mesh(g, mat, false); }
// laje com furos (o tampo da rede da Ciências: um só polígono com as células vazadas)
function plateHoles(outer, holes, y, h, mat) {
  const s = shapeOf(outer); for (const hp of holes) s.holes.push(shapeOf(hp, new THREE.Path()));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); uvPlano(g); return mesh(g, mat);
}
const distSeg = (x, z, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1))); return Math.hypot(x - ax - vx * t, z - az - vz * t); };
function distPoly(x, z, p, fechado = true) { let d = 1e9; for (let i = fechado ? 0 : 1, j = fechado ? p.length - 1 : 0; i < p.length; j = i++) d = Math.min(d, distSeg(x, z, p[j][0], p[j][1], p[i][0], p[i][1])); return d; }
const noElipse = (x, z, e, m = 0) => ((x - e.c[0]) / (e.rx + m)) ** 2 + ((z - e.c[1]) / (e.rz + m)) ** 2 < 1;
// mapa material -> geometria vira malhas (chave = nome em M, ou fn)
const addMap = (grp, map, matFn = (k) => M[k]) => { for (const [k, g] of map) grp.add(mesh(g, matFn(k))); };
const elipsePts = (c, rx, rz, n = 40, fase = 0) => Array.from({ length: n }, (_, i) => { const t = fase + (i / n) * PI2; return [c[0] + Math.cos(t) * rx, c[1] + Math.sin(t) * rz]; });
// sólido de revolução em n lados em volta de c: varre as arestas [raio, y] num n-ágono de raio 1 (a normal do caminho é
// radial: o deslocamento o = raio - 1 leva cada vértice ao raio pedido). Nas arestas 'facade' o período da textura
// divide o perímetro (a fachada fecha a volta sem emenda)
function torno(c, n, edges) {
  const path = []; for (let i = 0; i < n; i++) { const t = (i / n) * PI2; path.push([c[0] + Math.cos(t), c[1] + Math.sin(t)]); }
  const per = (r) => n * 2 * r * Math.sin(Math.PI / n);
  return sweep(path, true, edges.map((e) => { const o = { ...e, a: [e.a[0] - 1, e.a[1]], b: [e.b[0] - 1, e.b[1]] }; if (e.uv === 'facade') { const p = per(e.a[0]); o.uRep = p / Math.max(1, Math.ceil(p / (BAY * 32))); } return o; }));
}
// peças repetidas numa geometria só: [geo, x, y, z, giro]
function juntar(geo, itens) { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1); return merge(itens.map(([x, y, z, a = 0]) => [geo, m4.clone().compose(v.set(x, y, z), q.setFromAxisAngle(up, a), s)])); }
const arvores = (lista, o) => treeGroup(lista.map((t) => ({ ...t, y: t.y ?? Math.max(0, heightAt(t.x, t.z)) })), o);

// ================================================================ Torre da Holding
// Bolo de noiva na ilha: pódio claro (a base do bolo, na altura das duas pontes que chegam nele) e 4 camadas de
// A.torre. Cada andar: faixa creme (laje e peitoril) com beiral e faixa de vidro âmbar aceso recuada (a textura de
// fachada casa um andar por fileira); no topo de cada camada o terraço-jardim: borda da laje, friso de ouro,
// floreira, jardim e passeio junto ao vidro da camada de cima, com arbustos (alguns floridos). Coroa de vidro âmbar
// com aletas de ouro e a laje do heliponto (borda de metal champanhe com friso de ouro, tampo de laca preta com o H
// e o aro do heliponto de cidade.js, luzes de balizamento). Uma varredura só no n-ágono de 24 lados (lajes e vidros
// por material) e poucas peças à parte.
function torreHolding() {
  const T = A.torre, c = T.c, cam = T.camadas, g = new THREE.Group(); g.name = 'torre-holding';
  const s = 0.07, hC = 0.18, b = 0.14, FL = 0.14, FH = 0.55; // laje, faixa creme de cada andar (laje e peitoril), beiral (recuo do vidro), floreira, pé-direito alvo
  const pte = A.ponte.pts[A.ponte.pts.length - 1], rP = Math.hypot(pte[0] - c[0], pte[1] - c[1]), yP = A.sedePatio.pontePrivada.h; // pódio: até onde pousam as pontes
  const [rC, yC0, yC1] = T.coroa, [rH, , yH] = T.heliponto, gC = rC - 0.09; // vidro da coroa (as aletas vão até rC)
  const E = []; const vidro = (r, y0, y1, vBase, vRep) => E.push({ a: [r, y0], b: [r, y1], mat: 'fac_ambar', uv: 'facade', vBase, vRep });
  E.push({ a: [rP, -0.12], b: [rP, yP - 0.03], mat: 'whiteSmooth', uv: 'run' }, { a: [rP, yP - 0.03], b: [rP, yP], mat: 'ouro', uv: 'run' }, { a: [rP, yP], b: [cam[0][0] - b, yP], mat: 'caminhoTeto', uv: 'plan' });
  const terracos = [], lobby = []; // faixas de jardim [r0, r1, y] e altura do saguão
  cam.forEach(([r, y0, y1], k) => {
    const yb = k ? y0 : yP, n = Math.max(1, Math.round((y1 - yb) / FH)), fh = (y1 - yb) / n, gV = r - b;
    for (let j = 0; j < n; j++) {
      const yj = yb + j * fh;
      if (k === 0 && j === 0) { vidro(gV, yb, yb + 2 * fh, yb, 8 * fh); lobby.push(yb + 2 * fh); continue; } // saguão de pé-direito duplo
      if (k === 0 && j === 1) continue;
      if (j === 0) { vidro(gV, yb + s + 0.12, yb + fh, yb, 4 * fh); E.push({ a: [gV, yb + s], b: [gV, yb + s + 0.12], mat: 'whiteSmooth', uv: 'run' }); continue; } // a laje de baixo é o terraço da camada de baixo (peitoril creme atrás do passeio)
      E.push({ a: [r, yj], b: [r, yj + hC], mat: 'whiteSmooth', uv: 'run' }, { a: [r, yj + hC], b: [gV, yj + hC], mat: 'whiteSmooth', uv: 'plan' });
      vidro(gV, yj + hC, yj + fh, yb, 4 * fh);
    }
    // terraço no topo da camada: até o vidro da camada de cima (ou da coroa)
    const gN = k < cam.length - 1 ? cam[k + 1][0] - b : gC, yt = y1 + s, w = r - FL - gN, walk = w > 0.5 ? 0.2 : 0;
    E.push({ a: [r, y1], b: [r, yt], mat: 'whiteSmooth', uv: 'run' }, { a: [r, yt], b: [r, yt + 0.03], mat: 'ouro', uv: 'run' }, { a: [r, yt + 0.03], b: [r, yt + 0.12], mat: 'whiteSmooth', uv: 'run' },
      { a: [r, yt + 0.12], b: [r - FL, yt + 0.12], mat: 'planter', uv: 'plan' }, { a: [r - FL, yt + 0.12], b: [r - FL, yt], mat: 'whiteSmooth', uv: 'run' },
      { a: [r - FL, yt], b: [gN + walk, yt], mat: 'roof', uv: 'plan' });
    if (walk) E.push({ a: [gN + walk, yt], b: [gN, yt], mat: 'caminhoTeto', uv: 'plan' });
    terracos.push([r - FL, gN + walk, yt]);
  });
  vidro(gC, yC0 + s, yC1, yC0 + s, 4 * (yC1 - yC0 - s));
  E.push({ a: [gC, yC1], b: [rH, yC1], mat: 'roofMetal', uv: 'plan' }, { a: [rH, yC1], b: [rH, yH - 0.04], mat: 'roofMetal', uv: 'run' }, { a: [rH, yH - 0.04], b: [rH, yH], mat: 'ouro', uv: 'run' }, { a: [rH, yH], b: [0.001, yH], mat: 'laca', uv: 'plan' });
  addMap(g, torno(c, 24, E));
  // aletas de ouro da coroa (16) e marquises das duas entradas (a ponte do pavilhão ao sul, a ponte privada ao norte)
  const nA = 16, hA = yC1 - yC0 - s; g.add(mesh(juntar(new THREE.BoxGeometry(rC - gC + 0.01, hA, 0.035), Array.from({ length: nA }, (_, i) => { const a = (i / nA) * PI2 + Math.PI / nA; const rm = (rC + gC) / 2; return [c[0] + Math.cos(a) * rm, yC0 + s + hA / 2, c[1] + Math.sin(a) * rm, -a]; })), M.ouro));
  const dM = rP - 0.08 - (cam[0][0] - b); g.add(mesh(juntar(new THREE.BoxGeometry(1.5, 0.06, dM), [1, -1].map((sz) => [c[0], lobby[0] - 0.09, c[1] + sz * (cam[0][0] - b + dM / 2)])), M.whiteSmooth));
  // heliponto (o de cidade.js, em escala, com o aro em ouro) e 8 luzes de balizamento na borda
  const hp = heliponto(0, 0.55); const kH = (rH - 0.1) / 0.55; hp.scale.set(kH, 1, kH); hp.position.set(c[0], yH, c[1]); const troca = new Map([[M.yellow, M.ouro], [M.dark, M.laca], [M.white, M.whiteSmooth]]); hp.traverse((o) => { if (troca.has(o.material)) o.material = troca.get(o.material); }); g.add(hp); // (materiais que a Torre já usa)
  g.add(mesh(juntar(new THREE.OctahedronGeometry(0.035), Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * PI2; return [c[0] + Math.cos(a) * (rH - 0.05), yH - 0.012, c[1] + Math.sin(a) * (rH - 0.05)]; })), M.redGlow, false));
  // arbustos dos terraços (1 em 5 florido) e do pódio (fora das duas pontes)
  const R = rng(4417), arb = [];
  terracos.forEach(([r0, r1, y], k) => { const rm = (r0 + r1) / 2, n = Math.floor((PI2 * rm) / 0.55); for (let i = 0; i < n; i++) { const a = ((i + 0.5 * (k & 1)) / n) * PI2; arb.push({ x: c[0] + Math.cos(a) * rm, z: c[1] + Math.sin(a) * rm, y, s: 0.1 + R() * 0.04, kind: 'folhaLow', pal: R() < 0.2 ? 'flores' : 'jardim', h: 0.8 }); } });
  const rA = (rP + cam[0][0]) / 2 + 0.05; for (let i = 0; i < 20; i++) { const a = (i / 20) * PI2 + 0.08; if (Math.abs(Math.sin(a)) > 0.9) continue; arb.push({ x: c[0] + Math.cos(a) * rA, z: c[1] + Math.sin(a) * rA, y: yP, s: 0.16 + R() * 0.04, kind: 'folhaLow', pal: 'jardim', h: 1.1 }); }
  g.add(treeGroup(arb, { cast: false, name: 'terracos-torre' }));
  g.userData.heliponto = T.pouso.slice();
  return g;
}

// ================================================================ Pátio da Sede
// Perfil da Sede do plano (seção 8: varandas brancas, teto roofMetal, terraços que descem para o lago): o pórtico
// repete os dois últimos andares dele sobre o portal. (Se a fita da Sede mudar de perfil em aneis.js, mudar aqui.)
const PROF_SEDE = { setIn: 0.18, setOut: 0, beiral: 0.22, slab: 0.07, curb: 0.14, curbW: 0.03, curbMat: 'fasciaBeiral', fac: 'fac_fita', facIn: 'fac_fita', roof: 'roofMetal', passeio: false };
function portico() {
  const p = A.sedePatio.portico, sd = A.sede, F = Math.round(sd.hMax / sd.fh), f0 = Math.round(p.y0 / sd.fh); const prof = { ...PROF_SEDE, o0: sd.o0, o1: sd.o1, fh: sd.fh }; const m = medidas(prof);
  const E = []; for (let f = f0; f < F; f++) E.push(...terraceFloor(f, F, prof));
  E.push({ a: [m.gI(f0 - 1), p.y0], b: [m.gO(f0 - 1), p.y0], mat: 'whiteSmooth', uv: 'plan' }); // forro sobre o portal
  E.push({ a: [m.eO(f0) + 0.005, p.y0], b: [m.eO(f0) + 0.005, p.y0 + 0.045], mat: 'ouro', uv: 'run' }, { a: [m.eI(f0) - 0.005, p.y0 + 0.045], b: [m.eI(f0) - 0.005, p.y0], mat: 'ouro', uv: 'run' }); // friso de ouro que emoldura o eixo
  return sweep(p.caminho, false, E, { caps: true, capPoly: terraceOutline(F, prof, f0, F), capMat: 'fasciaBeiral' });
}
// piscina do jardim norte: deque de madeira, borda clara e a água turquesa
function piscina(pc, grp) {
  grp.add(plate(elipsePts(pc.c, pc.rx + pc.deck, pc.rz + pc.deck, 40), 0, 0.05, M.madeiraClara));
  grp.add(plate(elipsePts(pc.c, pc.rx + 0.06, pc.rz + 0.06, 40), 0.05, 0.025, M.whiteSmooth));
  grp.add(flat(elipsePts(pc.c, pc.rx, pc.rz, 40), 0.08, M.pool));
  const R = rng(pc.c[0] > 0 ? 31 : 37); for (const sx of [-0.45, 0, 0.45]) { const x = pc.c[0] + sx, z = pc.c[1] + pc.rz + pc.deck * 0.5; grp.add(mesh(juntar(new THREE.BoxGeometry(0.1, 0.03, 0.2), [[x + (R() - 0.5) * 0.05, 0.065, z]]), M.whiteSmooth, false)); } // espreguiçadeiras no deque do lado do lago
}
// Pavilhão guarda-chuva (a marca da Holding, na margem sul, no eixo): plataforma redonda de pedra clara com deque de
// madeira (avança sobre a água como píer), salão de vidro com montantes, coluna central e o dossel em guarda-chuva de
// 16 panos com o aro de ouro
function pavilhao() {
  const pv = A.sedePatio.pavilhao, c = pv.c, g = new THREE.Group(); g.name = 'pavilhao'; const [piso, vid, dos] = pv.niveis; const [rp, , yp] = piso, [rv, yv0, yv1] = vid, [rd, yd0, yd1] = dos;
  addMap(g, torno(c, 40, [{ a: [rp, -0.12], b: [rp, yp], mat: 'whiteSmooth', uv: 'run' }, { a: [rp, yp], b: [rp - 0.1, yp], mat: 'whiteSmooth', uv: 'plan' }, { a: [rp - 0.1, yp], b: [0.001, yp], mat: 'madeiraClara', uv: 'plan' }]));
  const sal = torno(c, 24, [{ a: [rv, yv0], b: [rv, yv1], mat: 'glass', uv: 'run' }, { a: [rv + 0.05, yv1], b: [rv + 0.05, yd0 + 0.02], mat: 'whiteSmooth', uv: 'run' }]);
  for (const [k, geo] of sal) { const o = mesh(geo, M[k], k !== 'glass'); if (k === 'glass') o.renderOrder = 3; g.add(o); }
  g.add(beams(Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * PI2; const x = c[0] + Math.cos(a) * rv, z = c[1] + Math.sin(a) * rv; return [[x, yv0, z], [x, yv1, z]]; }), 0.012, M.whiteSmooth, 4));
  g.add(beams([[[c[0], yp, c[1]], [c[0], yd0 + 0.05, c[1]]]], 0.06, M.whiteSmooth, 10));
  addMap(g, torno(c, 16, [{ a: [rd, yd0], b: [rd, yd0 + 0.025], mat: 'ouro', uv: 'run' }, { a: [rd, yd0 + 0.025], b: [rd * 0.55, yd1 - 0.035], mat: 'whiteSmooth', uv: 'plan' }, { a: [rd * 0.55, yd1 - 0.035], b: [0.001, yd1], mat: 'whiteSmooth', uv: 'plan' },
    { a: [0.07, yd0 + 0.05], b: [rd, yd0], mat: 'whiteSmooth', uv: 'plan' }]));
  return g;
}
// e1: fundações (faixa de concreto ao longo de cada trecho da Sede, discos dos tambores NO e NE e o radier da Torre);
// e4: a Torre (a obra usa a caixa dela: grua e andaime na ilha), o pórtico, as piscinas, a ponte privada e o pavilhão
export function sedePatio() {
  const sd = A.sede, T = A.torre, root = new THREE.Group(); root.name = 'sedePatio'; const P = { e1: new THREE.Group(), e4: new THREE.Group() };
  const fund = (o0, o1) => [{ a: [o1, -0.06], b: [o1, 0.03], mat: 'concreto', uv: 'run' }, { a: [o1, 0.03], b: [o0, 0.03], mat: 'concreto', uv: 'plan' }, { a: [o0, 0.03], b: [o0, -0.06], mat: 'concreto', uv: 'run' }];
  for (const [f0, f1] of trechosDe(sd)) addMap(P.e1, sweep(trecho(sd.caminho, f0, f1), false, fund(sd.o0 - 0.15, sd.o1 + 0.15), { caps: true, capMat: 'concreto' }));
  for (const fd of A.sedePatio.fundacoes) addMap(P.e1, torno(fd.c, 40, [{ a: [fd.r, -0.06], b: [fd.r, 0.03], mat: 'concreto', uv: 'run' }, { a: [fd.r, 0.03], b: [0.001, 0.03], mat: 'concreto', uv: 'plan' }]));
  const torre = torreHolding(); P.e4.add(torre); P.e4.userData.heliponto = torre.userData.heliponto;
  torre.updateMatrixWorld(true); P.e4.userData.caixaObra = new THREE.Box3().setFromObject(torre);
  addMap(P.e4, portico());
  for (const pc of A.sedePatio.piscinas) piscina(pc, P.e4);
  const pp = A.sedePatio.pontePrivada, [pa, pb] = pp, dz = pb[1] - pa[1]; // ponte privada: 0,5 sobre a água; desce ao piso do eixo norte já em terra
  const zM = A.lago.c[1] - A.lago.rz - 0.15; P.e4.add(deck([[pa[0], pa[1], pp.h], [pa[0], pa[1] + dz * 0.45, pp.h], [pa[0], zM, pp.h], [pb[0], pb[1], 0.05]], pp.w, { jardim: false, topo: 'branco' }));
  P.e4.add(pavilhao());
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'sedePatio', root, partes: P, esqueletos: {}, grua: { e4: true }, foco: { x: T.c[0], z: T.c[1] + 2, dist: 30 }, ancora: [T.c[0], T.topo + 0.6, T.c[1]] };
}

// ================================================================ Lago Central
// Oval de A.lago em 4 bacias (a ilha no meio, os diques leste-oeste e as pontes do eixo). e1: desassoreamento (o
// nível da água sobe; a água é do ground.js e a draga da obra.js); e2: margens vivas (juncos e pedras claras na borda
// e em volta da ilha, o renque de árvores no jardim junto à face interna do Anel e os 4 bosquetes nas diagonais);
// e3: estação natural (diques-jardim, jardins flutuantes, repuxos ao lado das pontes do eixo, calçada clara da margem
// e, fora do Anel, os canais dos vales até os Repuxos oeste e leste com os bosquetes em massa)
export function lago() {
  const L = A.lago, C = L.c, ilha = A.ilha, jd = A.jardim, pv = A.sedePatio.pavilhao, root = new THREE.Group(); root.name = 'lago'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  P.e1.userData.nivel = true;
  const R = rng(77), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s3 = new THREE.Vector3();
  const margem = curve(L, true, 144), nor = normals(margem, true); const zD = A.lagoDiques[0].z, wD = A.lagoDiques[0].w;
  const noEixo = (x, m = 1.7) => Math.abs(x - C[0]) < m, noDique = (z, m = 0.7) => Math.abs(z - zD) < wD / 2 + m;
  // e2: juncos e pedras na borda da água (pedras claras meio submersas); juncos também em volta do pódio da ilha
  const reeds = [], pedras = [];
  margem.forEach(([x, z], i) => { if (noEixo(x) || noDique(z)) return; const [nx, nz] = nor[i]; for (let k = 0; k < 1 + (R() < 0.5); k++) { const o = -0.12 - R() * 0.3; reeds.push([x + nx * o + (R() - 0.5) * 0.12, z + nz * o + (R() - 0.5) * 0.12, 0.15 + R() * 0.2]); } if (R() < 0.28) { const o = -0.14 - R() * 0.2; pedras.push([x + nx * o, z + nz * o, 0.12 + R() * 0.1, R() * 6]); } });
  for (let i = 0; i < 56; i++) { const a = (i / 56) * PI2, r = ilha.r + 0.1 + R() * 0.25, x = C[0] + Math.cos(a) * r, z = C[1] + Math.sin(a) * r; if (noEixo(x, 1.1) || noDique(z, 0.35)) continue; reeds.push([x, z, 0.12 + R() * 0.16]); }
  const rg = new THREE.ConeGeometry(0.03, 1, 4, 1, true); rg.translate(0, 0.5, 0); const rim = new THREE.InstancedMesh(rg, M.planter, reeds.length); // (cone sem a base: o pé fica na água)
  reeds.forEach(([x, z, h], i) => rim.setMatrixAt(i, m4.compose(v.set(x, -0.12, z), q.identity(), s3.set(1, h * 1.5, 1)))); rim.castShadow = false; rim.receiveShadow = true; P.e2.add(rim);
  const pim = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), M.concretoClaro, pedras.length);
  pedras.forEach(([x, z, s, r], i) => pim.setMatrixAt(i, m4.compose(v.set(x, Math.max(heightAt(x, z), -0.14) + s * 0.15, z), q.setFromEuler(e.set(0, r, 0)), s3.set(s, s * 0.6, s * 0.8)))); pim.castShadow = true; pim.receiveShadow = true; P.e2.add(pim);
  // renque no anel de jardim, a 0,85 da face interna do Anel Mestre: fora dos tambores, do eixo (portais, pavilhão,
  // ponte privada; ao norte também os renques baixos e os bancos que o plano.js põe nos bordos do eixo norte, x 2,45),
  // das piscinas, dos diques, dos bosquetes e da calçada da margem
  const tb = Object.values(A.tambores), bq = A.bosquetes, pisc = A.sedePatio.piscinas; const tr = [];
  const livre = (x, z) => tb.every((t) => Math.hypot(x - t.c[0], z - t.c[1]) > t.r + 0.75) && !noEixo(x, z > C[1] ? 2.0 : 3.1) && !noDique(z, 0.45) && pisc.every((p) => !noElipse(x, z, p, p.deck + 0.45)) && bq.every((b) => !noElipse(x, z, b, 0.35)) && !noElipse(x, z, L, 0.95);
  for (const [d, n, s0] of [[0.85, 96, 0.28], [1.5, 72, 0.23]]) { const rx = jd.rx - d, rz = jd.rz - d; for (let i = 0; i < n; i++) { const a = ((i + (d > 1 ? 0.5 : 0)) / n) * PI2, x = C[0] + Math.cos(a) * rx, z = C[1] + Math.sin(a) * rz; if (livre(x, z)) tr.push({ x, z, s: s0 + R() * 0.07, pal: R() < 0.15 ? 'mata' : 'jardim', h: 1.05 }); } } // duas fileiras desencontradas
  // bosquetes das diagonais: 7 copas em massa dentro de cada elipse
  for (const b of bq) { tr.push({ x: b.c[0], z: b.c[1], s: 0.4, pal: 'jardim', h: 1.1 }); for (let k = 0; k < 6; k++) { const a = (k / 6) * PI2 + 0.3; tr.push({ x: b.c[0] + Math.cos(a) * (b.rx - 0.42), z: b.c[1] + Math.sin(a) * (b.rz - 0.36), s: 0.3 + R() * 0.06, pal: R() < 0.3 ? 'mata' : 'jardim', h: 1.0 }); } }
  P.e2.add(arvores(tr));
  // e3: diques-jardim (da ilha, a uma junta do pódio da Torre, até a face interna do Anel): muretas claras, jardim e
  // arbustos com árvores pequenas a cada 2,1
  const rPod = Math.hypot(A.ponte.pts[A.ponte.pts.length - 1][0] - C[0], A.ponte.pts[A.ponte.pts.length - 1][1] - C[1]) + J; const arb = [];
  for (const d of A.lagoDiques) {
    const sx = Math.sign(d.x1), hw = d.w / 2, x0 = C[0] + sx * Math.max(Math.abs(d.x0 - C[0]), rPod), x1 = C[0] + sx * Math.min(Math.abs(d.x1 - C[0]), AM.rxIn * Math.sqrt(1 - (hw / AM.rzIn) ** 2) - J); // nas quinas a face do Anel já curva: a junta vale nelas
    addMap(P.e3, sweep([[x0, d.z], [x1, d.z]], false, [{ a: [hw, -0.45], b: [hw, d.h], mat: 'whiteSmooth', uv: 'run' }, { a: [hw, d.h], b: [hw - 0.1, d.h], mat: 'whiteSmooth', uv: 'plan' }, { a: [hw - 0.1, d.h], b: [-hw + 0.1, d.h], mat: 'roof', uv: 'plan' },
      { a: [-hw + 0.1, d.h], b: [-hw, d.h], mat: 'whiteSmooth', uv: 'plan' }, { a: [-hw, d.h], b: [-hw, -0.45], mat: 'whiteSmooth', uv: 'run' }], { caps: true, capMat: 'whiteSmooth' }));
    const Ld = Math.abs(x1 - x0); for (let t = 0.25, k = 0; t < Ld - 0.2; t += 0.42, k++) { const x = x0 + sx * t; if (k % 5 === 2) arb.push({ x, z: d.z, y: d.h, s: 0.22, pal: 'jardim', h: 1 }); else arb.push({ x, z: d.z + (k & 1 ? 0.14 : -0.14), y: d.h, s: 0.11 + R() * 0.03, kind: 'folhaLow', pal: k % 7 === 3 ? 'flores' : 'jardim', h: 0.8 }); }
  }
  // jardins flutuantes (um em cada bacia, a meio caminho entre a ilha e a margem) e repuxos ao lado das pontes do eixo
  const bacia = (sx, sz) => { const x = C[0] + sx * (ilha.r + L.rx) / 2 * 0.9, zm = C[1] + sz * (wD / 2 + L.rz * Math.sqrt(1 - ((x - C[0]) / L.rx) ** 2)) / 2; return [x, zm]; };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [x, z] = bacia(sx, sz); const fg = new THREE.CylinderGeometry(1, 1, 0.05, 20); fg.scale(1.1, 1, 0.55); fg.translate(x, -0.07, z); P.e3.add(mesh(fg, M.planter, false));
    arb.push({ x, z, y: -0.05, s: 0.2, pal: 'jardim', h: 1 }); for (let i = 0; i < 6; i++) { const a = (i / 6) * PI2 + 0.3; arb.push({ x: x + Math.cos(a) * 0.72, z: z + Math.sin(a) * 0.3, y: -0.05, s: 0.1 + R() * 0.04, kind: 'folhaLow', pal: i === 2 ? 'flores' : 'jardim', h: 0.8 }); }
  }
  const jato = dupla(M.glassRail), jatos = [], bases = [];
  const zS = (C[1] + ilha.r + L.c[1] + L.rz) / 2, zN = (C[1] - ilha.r + L.c[1] - L.rz) / 2, xJ = A.ponte.w / 2 + 1.0;
  for (const z of [zS, zN]) for (const sx of [-1, 1]) { bases.push([C[0] + sx * xJ, -0.07, z]); jatos.push([C[0] + sx * xJ, z, 0.85, 0.07, -0.05]); }
  P.e3.add(mesh(juntar(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 14), bases), M.whiteSmooth));
  // calçada clara da margem (sem passar sob o pavilhão nem sob a ponte privada)
  const corta = (x, z) => (z > C[1] ? Math.abs(x - pv.c[0]) < pv.r + 0.25 : Math.abs(x - C[0]) < A.sedePatio.pontePrivada.w / 2 + 0.3);
  const cal = curve(L, true, 160); let k0 = cal.findIndex(([x, z]) => corta(x, z)); const trechos = []; let cur = [];
  for (let i = 0; i <= cal.length; i++) { const p = cal[(k0 + i) % cal.length]; if (corta(p[0], p[1])) { if (cur.length > 1) trechos.push(cur); cur = []; } else cur.push(p); } if (cur.length > 1) trechos.push(cur);
  for (const t of trechos) { const nn = normals(t, false), mid = t[t.length >> 1], ni = nn[t.length >> 1], fora = inPoly(mid[0] + ni[0] * 0.3, mid[1] + ni[1] * 0.3, L) ? -1 : 1; const Ec = [{ a: [-0.05, 0.03], b: [-0.05, -0.12], mat: 'whiteSmooth', uv: 'run' }, { a: [0.45, 0.03], b: [-0.05, 0.03], mat: 'caminhoTeto', uv: 'plan' }]; // (o > 0 = terra)
    addMap(P.e3, sweep(t, false, fora > 0 ? Ec : Ec.map((x) => ({ ...x, a: [-x.b[0], x.b[1]], b: [-x.a[0], x.a[1]] })), { caps: false })); }
  // canais dos vales (da face externa do Anel até o Repuxo), repuxos (bacia de pedra, água, pedestal, jato de A e 8
  // jatinhos) e os bosquetes em massa, duas fileiras desencontradas em cada elipse
  for (const [nome, vl] of Object.entries(A.vales)) {
    const cn = vl.canal, rp = vl.repuxo, sx = Math.sign(cn.x1), hw = cn.w / 2, yA = 0.07, fo = A[nome]; const rB = fo?.F ? Math.min(rp.r, Math.hypot(rp.c[0] - fo.F[0], rp.c[1] - fo.F[1]) - fo.R - fo.w / 2 - J) : rp.r; // a junta vale no ponto da bacia mais perto da fita
    addMap(P.e3, sweep([[cn.x0, cn.z], [cn.x1 + sx * 0.08, cn.z]], false, [{ a: [hw, -0.05], b: [hw, 0.12], mat: 'whiteSmooth', uv: 'run' }, { a: [hw, 0.12], b: [hw - 0.12, 0.12], mat: 'whiteSmooth', uv: 'plan' }, { a: [hw - 0.12, 0.12], b: [hw - 0.12, yA], mat: 'whiteSmooth', uv: 'run' },
      { a: [hw - 0.12, yA], b: [-hw + 0.12, yA], mat: 'water', uv: 'plan' }, { a: [-hw + 0.12, yA], b: [-hw + 0.12, 0.12], mat: 'whiteSmooth', uv: 'run' }, { a: [-hw + 0.12, 0.12], b: [-hw, 0.12], mat: 'whiteSmooth', uv: 'plan' }, { a: [-hw, 0.12], b: [-hw, -0.05], mat: 'whiteSmooth', uv: 'run' }], { caps: 'ini', capMat: 'whiteSmooth' }));
    addMap(P.e3, torno(rp.c, 40, [{ a: [rB, -0.05], b: [rB, 0.16], mat: 'whiteSmooth', uv: 'run' }, { a: [rB, 0.16], b: [rB - 0.14, 0.16], mat: 'whiteSmooth', uv: 'plan' }, { a: [rB - 0.14, 0.16], b: [rB - 0.14, 0.09], mat: 'whiteSmooth', uv: 'run' }, { a: [rB - 0.14, 0.09], b: [0.001, 0.09], mat: 'water', uv: 'plan' }]));
    P.e3.add(mesh(juntar(new THREE.CylinderGeometry(0.3, 0.34, 0.1, 16), [[rp.c[0], 0.12, rp.c[1]]]), M.whiteSmooth));
    jatos.push([rp.c[0], rp.c[1], rp.jato.h, rp.jato.r, 0.17]); for (let i = 0; i < 8; i++) { const a = (i / 8) * PI2; jatos.push([rp.c[0] + Math.cos(a) * 0.9, rp.c[1] + Math.sin(a) * 0.9, 0.4, 0.04, 0.09]); }
    for (const b of vl.bosquetes) for (const fila of [-1, 1]) for (let x = -b.rx + 0.4 + (fila > 0 ? 0.3 : 0); x < b.rx - 0.35; x += 0.62) { const k = Math.sqrt(Math.max(0, 1 - (x / b.rx) ** 2)); arb.push({ x: b.c[0] + x, z: b.c[1] + fila * 0.26 * k, s: 0.3 + R() * 0.08, pal: R() < 0.25 ? 'jardim' : 'mata', h: 1.05 }); }
  }
  // jatos (cones de vidro claro, sem sombra): no eixo sobem da água, nos Repuxos do pedestal
  const jg = []; for (const [x, z, h, r, y0] of jatos) { const cg = new THREE.ConeGeometry(r, h, 10, 1, true); cg.translate(x, y0 + h / 2, z); jg.push([cg, new THREE.Matrix4()]); } // [x, z, altura, raio, base]
  const jm = new THREE.Mesh(merge(jg), jato); jm.castShadow = false; jm.renderOrder = 3; P.e3.add(jm);
  P.e3.add(arvores(arb, { name: 'lago-arvores' }));
  for (const k of Object.keys(P)) root.add(P[k]);
  const [ax, az] = bacia(-1, 1);
  // e2 e e3 são paisagem espalhada (a e3 vai de um Repuxo ao outro, 60 de largura): obra de plantio, peça a peça, sem o
  // andaime em volta do casco que o modo 'subir' poria em volta do lago, do Anel e dos vales
  return { id: 'lago', root, partes: P, esqueletos: {}, grua: {}, modos: { e2: 'crescer', e3: 'crescer' }, foco: { x: C[0], z: C[1] + 1.5, dist: 26 }, ancora: [ax, 1.4, az] };
}

// ================================================================ Faculdade de Ciências
// banda transversal (dos dois lados arredondada), centrada no caminho: o lábio inferior da rede
function bandaDupla(y, t, w) {
  const h = w / 2; // perfil no sentido anti-horário (base, lado +, tampo, lado -): normais para fora
  return [
    { a: [-h, y], b: [h, y], mat: 'borda', uv: 'plan' },
    { a: [h, y], b: [h + 0.05, y + t * 0.5], mat: 'borda', uv: 'run' }, { a: [h + 0.05, y + t * 0.5], b: [h, y + t], mat: 'borda', uv: 'run' },
    { a: [h, y + t], b: [-h, y + t], mat: 'bandaTopo', uv: 'plan' },
    { a: [-h, y + t], b: [-h - 0.05, y + t * 0.5], mat: 'borda', uv: 'run' }, { a: [-h - 0.05, y + t * 0.5], b: [-h, y], mat: 'borda', uv: 'run' },
  ];
}
// banda grossa e arredondada (as rampas da rede, como um tubo achatado): w = largura, t = espessura
function bandaRedonda(y, t, w) {
  const h = w / 2;
  return [
    { a: [-h + 0.06, y], b: [h - 0.06, y], mat: 'borda', uv: 'plan' },
    { a: [h - 0.06, y], b: [h + 0.02, y + t * 0.22], mat: 'borda', uv: 'run' }, { a: [h + 0.02, y + t * 0.22], b: [h + 0.03, y + t * 0.55], mat: 'borda', uv: 'run' },
    { a: [h + 0.03, y + t * 0.55], b: [h - 0.04, y + t * 0.86], mat: 'borda', uv: 'run' }, { a: [h - 0.04, y + t * 0.86], b: [h - 0.14, y + t], mat: 'bandaTopo', uv: 'run' },
    { a: [h - 0.14, y + t], b: [-h + 0.14, y + t], mat: 'bandaTopo', uv: 'plan' }, { a: [-h + 0.14, y + t], b: [-h + 0.04, y + t * 0.86], mat: 'bandaTopo', uv: 'run' },
    { a: [-h + 0.04, y + t * 0.86], b: [-h - 0.03, y + t * 0.55], mat: 'borda', uv: 'run' }, { a: [-h - 0.03, y + t * 0.55], b: [-h - 0.02, y + t * 0.22], mat: 'borda', uv: 'run' },
    { a: [-h - 0.02, y + t * 0.22], b: [-h + 0.06, y], mat: 'borda', uv: 'run' },
  ];
}
const matBanda = (k) => (k === 'bandaTopo' ? M.caminhoTeto : k === 'labs' ? M.fac_fita : M.whiteSmooth);
// varredura de um perfil [o, dy] ao longo de um caminho 3D aberto [[x, y, z], ...] (as rampas da rede, que descem até
// o chão): a altura do perfil acompanha a do caminho; o resto é igual a sweep() de geom.js
function sweep3(path, edges) {
  const N = path.length; const nor = normals(path.map((p) => [p[0], p[2]]), false); const bufs = new Map();
  for (const e of edges) {
    let B = bufs.get(e.mat); if (!B) bufs.set(e.mat, (B = { p: [], n: [], uv: [], i: [] }));
    const [ao, ay] = e.a, [bo, by] = e.b; let dno = by - ay, dny = -(bo - ao); const dl = Math.hypot(dno, dny) || 1; dno /= dl; dny /= dl;
    const base = B.p.length / 3; let s = 0;
    for (let i = 0; i < N; i++) {
      const [px, py, pz] = path[i], [nx, nz] = nor[i]; if (i) s += Math.hypot(px - path[i - 1][0], py - path[i - 1][1], pz - path[i - 1][2]);
      let wx = nx * dno, wy = dny, wz = nz * dno; const wl = Math.hypot(wx, wy, wz) || 1; wx /= wl; wy /= wl; wz /= wl;
      const Ax = px + nx * ao, Az = pz + nz * ao, Bx = px + nx * bo, Bz = pz + nz * bo;
      B.p.push(Ax, py + ay, Az, Bx, py + by, Bz); B.n.push(wx, wy, wz, wx, wy, wz);
      if (e.uv === 'plan') B.uv.push(Ax / 2.2, Az / 2.2, Bx / 2.2, Bz / 2.2); else B.uv.push(s / 1.5, 0, s / 1.5, 1);
    }
    for (let k = 0; k < N - 1; k++) {
      const a0 = base + k * 2, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3; const P = B.p;
      const e1 = [P[b0 * 3] - P[a0 * 3], P[b0 * 3 + 1] - P[a0 * 3 + 1], P[b0 * 3 + 2] - P[a0 * 3 + 2]], e2 = [P[a1 * 3] - P[a0 * 3], P[a1 * 3 + 1] - P[a0 * 3 + 1], P[a1 * 3 + 2] - P[a0 * 3 + 2]];
      const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
      const dot = cx * B.n[a0 * 3] + cy * B.n[a0 * 3 + 1] + cz * B.n[a0 * 3 + 2];
      if (dot >= 0) B.i.push(a0, b0, a1, b0, b1, a1); else B.i.push(a0, a1, b0, b0, a1, b1);
    }
  }
  const res = new Map();
  for (const [k, B] of bufs) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2)); g.setIndex(B.i); g.computeBoundingSphere(); g.computeBoundingBox(); res.set(k, g); }
  return res;
}
// contorno recuado de d para dentro (os cantos apertados caem fora) e deslocado de d para fora (o furo do tampo)
function recuo(poly, d) { const nor = normals(poly, true); const out = []; poly.forEach(([x, z], i) => { const px = x - nor[i][0] * d, pz = z - nor[i][1] * d; if (inPoly(px, pz, poly) && distPoly(px, pz, poly) > d * 0.8) out.push([px, pz]); }); return out; }
function desloca(poly, d) { const nor = normals(poly, true); return poly.map(([x, z], i) => [x + nor[i][0] * d, z + nor[i][1] * d]); }
// pano de vidro espelhado abaulado sobre uma célula: leque a partir do centroide com um anel a 60% (calota), normais
// suavizadas; não projeta sombra
function panoEspelho(poly, y, dome, mat) {
  const n = poly.length; let cx = 0, cz = 0; for (const [x, z] of poly) { cx += x; cz += z; } cx /= n; cz /= n;
  const P = [cx, y + dome, cz], U = [cx / 2.2, cz / 2.2], I = [];
  for (const [x, z] of poly) { const px = cx + (x - cx) * 0.6, pz = cz + (z - cz) * 0.6; P.push(px, y + dome * 0.64, pz); U.push(px / 2.2, pz / 2.2); }
  for (const [x, z] of poly) { P.push(x, y, z); U.push(x / 2.2, z / 2.2); }
  const e1x = P[3] - cx, e1z = P[5] - cz, e2x = P[6] - cx, e2z = P[8] - cz; const cima = e1z * e2x - e1x * e2z > 0; // o primeiro triângulo do leque decide (normal para cima)
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; const a = 1 + i, b = 1 + j, c = 1 + n + i, d = 1 + n + j; if (cima) I.push(0, a, b, a, c, d, a, d, b); else I.push(0, b, a, a, d, c, a, b, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
  return mesh(g, mat, false);
}
// Faculdade de Ciências: UM platô de bandas boleadas de concreto claro sobre pilotis na elipse de A.ciencias (eixo
// longo apontando a proa para o tambor SE), com 4 células de tamanhos diferentes cobertas por vidro espelhado (a maior,
// uma lente que chega à altura de A); sob o tampo, os laboratórios em 2 andares de vidro escuro recuado entre o lábio de
// cima e o de baixo; na frente (o lado sul, que a câmera vê) a boca espelhada da célula grande; a proa é maciça, com a
// porta da Ponte Coberta no piso dos laboratórios; do lado da popa, duas bandas descem em rampas até o gramado.
// Etapas: e1 pilotis e laje; e2 laboratórios (lábio inferior, vidro e laje do meio); e3 casca de bandas (tampo, lábios,
// proa e rampas); e4 vidro espelhado (células e boca) e luzes.
export function ciencias() {
  const c = A.ciencias, pc = A.ponteCoberta, a = rad(c.rot); const U = [Math.cos(a), Math.sin(a)], V = [Math.sin(a), -Math.cos(a)]; // U: rumo à proa (tambor SE); V: a frente (sul)
  const T = (u, w) => [c.c[0] + u * U[0] + w * V[0], c.c[1] + u * U[1] + w * V[1]], loc = ([x, z]) => { const dx = x - c.c[0], dz = z - c.c[1]; return [dx * U[0] + dz * U[1], dx * V[0] + dz * V[1]]; };
  const root = new THREE.Group(); root.name = 'ciencias'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group(), e4: new THREE.Group() };
  const y0 = pc.y0, tT = 0.6, yS = c.h - 0.15, yT = yS - tT, lh = (yT - y0) / 2; // piso dos laboratórios = piso da Ponte Coberta; tampo de yT a yS; a lente da célula grande chega a c.h
  const N = 96, cont = Array.from({ length: N }, (_, i) => { const f = (i / N) * PI2; return T(c.rx * Math.cos(f), c.rz * Math.sin(f)); }); const nor = normals(cont, true);
  const idx = (f) => ((Math.round((f / 360) * N) % N) + N) % N, arco = (f0, f1) => { const out = []; for (let i = idx(f0); ; i = (i + 1) % N) { out.push(cont[i]); if (i === idx(f1)) break; } return out; };
  // varredura de um trecho aberto do contorno com o "o" positivo sempre para fora
  const sweepArco = (pts, edges, o = {}) => { const nn = normals(pts, false), k = pts.length >> 1; let bi = 0, bd = 1e9; cont.forEach(([px, pz], i) => { const d = Math.hypot(px - pts[k][0], pz - pts[k][1]); if (d < bd) { bd = d; bi = i; } });
    const ok = nn[k][0] * nor[bi][0] + nn[k][1] * nor[bi][1] >= 0; return sweep(pts, false, ok ? edges : edges.map((e) => ({ ...e, a: [-e.b[0], e.b[1]], b: [-e.a[0], e.a[1]] })), { caps: false, ...o }); };
  const elipse = (cu, cw, ru, rw, r, n) => Array.from({ length: n }, (_, i) => { const t = (i / n) * PI2, x = Math.cos(t) * ru, z = Math.sin(t) * rw; return T(cu + x * Math.cos(r) - z * Math.sin(r), cw + x * Math.sin(r) + z * Math.cos(r)); });
  // células: D grande (centro, rumo à proa), A oval ao fundo da popa, C pequena ao fundo, B triângulo boleado à frente da popa
  const cels = [elipse(0.85, 0.05, 1.6, 1.3, 0.08, 64), elipse(-2.2, -0.8, 0.72, 0.48, 0.2, 36), elipse(-0.95, -1.62, 0.42, 0.26, -0.1, 28),
    curve([[-2.55, 0.55], [-1.05, 0.4], [-0.95, 1.05], [-1.65, 1.5], [-2.45, 1.15]].map(([u, w]) => T(u, w)), true, 36, 0.6)];
  const domes = [c.h - yT - 0.1, 0.28, 0.16, 0.24]; // a lente de D chega a c.h; as outras ficam fundas no tampo
  const BOCA = [44, 96], PROA = [-36, 36], porta = pc.w / 2 + 0.08; // arcos (graus da elipse) da boca (frente de D) e da proa; meia largura da porta
  const naPorta = ([x, z]) => { const [u, w] = loc([x, z]); return u > 0 && Math.abs(w) < porta; };
  // e1: laje sob os laboratórios (forro dos pilotis) e pilotis finos (no contorno a cada ~1,2 e 5 sob a célula grande)
  P.e1.add(plate(recuo(cont, 0.12), y0 - 0.1, 0.08, M.concreto));
  const cols = []; for (let i = 0; i < N; i += 6) { const x = cont[i][0] - nor[i][0] * 0.25, z = cont[i][1] - nor[i][1] * 0.25; cols.push([[x, heightAt(x, z) - 0.05, z], [x, y0 - 0.1, z]]); }
  for (let k = 0; k < 5; k++) { const t = (k / 5) * PI2 + 0.4; const [x, z] = T(0.85 + Math.cos(t) * 0.9, 0.05 + Math.sin(t) * 0.7); cols.push([[x, heightAt(x, z) - 0.05, z], [x, y0 - 0.1, z]]); }
  P.e1.add(beams(cols, 0.045, M.whiteSmooth, 6));
  // e2: lábio inferior boleado (aberto na porta da Ponte Coberta), vidro escuro dos laboratórios recuado (menos a boca) e
  // a laje do meio
  const semPorta = []; { let cur = []; for (let i = 0; i <= N; i++) { const p = cont[(idx(PROA[1]) + i) % N]; if (naPorta(p)) { if (cur.length > 1) semPorta.push(cur); cur = []; } else cur.push(p); } if (cur.length > 1) semPorta.push(cur); }
  for (const t of semPorta) addMap(P.e2, sweepArco(t, bandaDupla(y0 - 0.12, 0.26, 0.38)), matBanda);
  const vao = arco(BOCA[1], BOCA[0] + 360);
  addMap(P.e2, sweepArco(vao, [{ a: [-0.22, y0 + 0.14], b: [-0.22, yT - 0.02], mat: 'labs', uv: 'facade', vBase: y0, vRep: 4 * lh }, { a: [-0.18, y0 + lh - 0.03], b: [-0.18, y0 + lh + 0.03], mat: 'borda', uv: 'run' }]), matBanda);
  // e3: o platô (tampo com as células vazadas), lábio externo boleado, lábio de cada célula, a proa maciça com a porta,
  // a banda fina sobre a boca e as duas rampas da popa
  P.e3.add(plateHoles(recuo(cont, 0.12), cels.map((p) => desloca(p, 0.1)), yT, tT, M.caminhoTeto));
  const k = tT / 0.4; // perfis do modelo antigo (tampo de 0,4) esticados para o tampo de agora
  addMap(P.e3, sweep(cont, true, [
    { a: [0, yT], b: [0.10, yT + 0.09 * k], mat: 'borda', uv: 'run' }, { a: [0.10, yT + 0.09 * k], b: [0.12, yT + 0.22 * k], mat: 'borda', uv: 'run' },
    { a: [0.12, yT + 0.22 * k], b: [0.06, yT + 0.34 * k], mat: 'borda', uv: 'run' }, { a: [0.06, yT + 0.34 * k], b: [-0.08, yS], mat: 'borda', uv: 'run' }, { a: [-0.08, yS], b: [-0.16, yS], mat: 'bandaTopo', uv: 'plan' }]), matBanda);
  const labioCel = [{ a: [0.16, yS], b: [0.10, yS], mat: 'bandaTopo', uv: 'plan' }, { a: [0.10, yS], b: [0, yS - 0.03 * k], mat: 'borda', uv: 'run' }, { a: [0, yS - 0.03 * k], b: [-0.09, yS - 0.11 * k], mat: 'borda', uv: 'run' },
    { a: [-0.09, yS - 0.11 * k], b: [-0.13, yS - 0.24 * k], mat: 'borda', uv: 'run' }, { a: [-0.13, yS - 0.24 * k], b: [-0.11, yT + 0.04], mat: 'borda', uv: 'run' }];
  for (const cel of cels) addMap(P.e3, sweep(cel, true, labioCel), matBanda);
  const proa = arco(PROA[0], PROA[1]), pp = []; { let cur = []; for (const p of proa) { if (naPorta(p)) { if (cur.length > 1) pp.push(cur); cur = []; } else cur.push(p); } if (cur.length > 1) pp.push(cur); }
  for (const t of pp) addMap(P.e3, sweepArco(t, [{ a: [-0.02, y0 - 0.12], b: [-0.02, yT + 0.02], mat: 'borda', uv: 'run' }]), matBanda);
  const pv = proa.filter(naPorta); if (pv.length > 1) addMap(P.e3, sweepArco(pv, [{ a: [-0.02, y0 - 0.12], b: [-0.02, y0], mat: 'borda', uv: 'run' }, { a: [-0.02, pc.topo], b: [-0.02, yT + 0.02], mat: 'borda', uv: 'run' }]), matBanda);
  const boca = arco(BOCA[0], BOCA[1]);
  addMap(P.e3, sweepArco(boca, [{ a: [0.0, yT - 0.15], b: [0.0, yT + 0.01], mat: 'borda', uv: 'run' }]), matBanda);
  const tb = 0.34; for (const [f0, f1] of [[176, 96], [184, 262]]) { // rampas: saem do tampo na popa e descem pelos flancos (dentro da pista do gramado)
    const n = 44, pts = []; for (let i = 0; i <= n; i++) { const t = i / n, f = rad(f0 + (f1 - f0) * t), d = 0.08 + 0.34 * t; const u = Math.cos(f) * c.rx, w = Math.sin(f) * c.rz; const gl = Math.hypot(Math.cos(f) / c.rx, Math.sin(f) / c.rz), nu = Math.cos(f) / c.rx / gl, nw = Math.sin(f) / c.rz / gl;
      const [x, z] = T(u + nu * d, w + nw * d); const e = t * t * (3 - 2 * t); pts.push([x, yS - tb + (-0.35 - (yS - tb)) * (t * 0.35 + e * 0.65), z]); }
    addMap(P.e3, sweep3(pts, bandaRedonda(0, tb, 0.5)), matBanda); }
  // e4: vidro espelhado nas células (no fundo do tampo; a de D vira lente), a boca espelhada e as luzes sob o beiral
  cels.forEach((cel, i) => P.e4.add(panoEspelho(recuo(cel, 0.06), yT + 0.1, domes[i], M.vidroEspelhado)));
  addMap(P.e4, sweepArco(boca, [{ a: [-0.3, y0 + 0.16], b: [-0.3, yT - 0.02], mat: 'espelho', uv: 'run' }]), () => M.vidroEspelhado);
  const m4 = new THREE.Matrix4(), glow = []; for (let i = 0; i < N; i += 5) glow.push([cont[i][0] - nor[i][0] * 0.3, yT - 0.03, cont[i][1] - nor[i][1] * 0.3]);
  const gl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.02, 0.05), M.lampGlow, glow.length); glow.forEach((p, i) => gl.setMatrixAt(i, m4.makeTranslation(...p))); gl.castShadow = false; P.e4.add(gl);
  for (const kk of Object.keys(P)) root.add(P[kk]);
  return { id: 'ciencias', root, partes: P, esqueletos: {}, grua: { e1: true, e3: true }, foco: { x: c.c[0], z: c.c[1] + 1, dist: 14 }, ancora: [c.c[0], c.h + 0.5, c.c[1]] };
}
