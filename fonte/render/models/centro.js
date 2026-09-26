// Centro da composição: Faculdade de Ciências Avançadas (um platô contínuo de bandas boleadas de concreto
// claro com quatro células cobertas por vidraçaria espelhada), a Ala em Onda, o Lago Central e o pátio da
// Sede da Holding.
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { sweep, beams, curve, normals } from '../geom.js';
import { treeGroup } from '../forest.js';
import { heightAt } from '../ground.js';
import { rng, inPoly } from '../../core/util.js';
import { Faixa } from './faixa.js';
import { deck } from './praca.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
function shapeOf(pts, s = new THREE.Shape()) { pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); return s; }
function uvPlano(g) { const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); }
function plate(pts, y, h, mat) { const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); uvPlano(g); return mesh(g, mat); }
// laje com furos (o tampo da rede da Ciências: um só polígono com as células vazadas)
function plateHoles(outer, holes, y, h, mat) {
  const s = shapeOf(outer); for (const hp of holes) s.holes.push(shapeOf(hp, new THREE.Path()));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); uvPlano(g); return mesh(g, mat);
}
const bordaD = (x, z, p) => { let d = 1e9; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [ax, az] = p[j], [bx, bz] = p[i]; const vx = bx - ax, vz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1))); d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t)); } return d; };
const addMap = (grp, map, matFn) => { for (const [k, g] of map) grp.add(mesh(g, matFn(k))); };
// materiais de reserva enquanto a área A não publica os seus (a fusão do mundo junta por material)
const MAT = {};
const espelho = () => M.vidroEspelhado || (MAT.espelho ||= new THREE.MeshStandardMaterial({ color: 0xbfd9ec, metalness: 0.9, roughness: 0.05, envMapIntensity: 1.8 }));
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
// banda grossa e arredondada (as rampas da rede, como um tubo achatado): w = largura, t = espessura;
// os lados são arcos de três segmentos e o tampo tem os cantos boleados
function bandaRedonda(y, t, w) {
  const h = w / 2;
  return [
    { a: [-h + 0.06, y], b: [h - 0.06, y], mat: 'borda', uv: 'plan' },
    { a: [h - 0.06, y], b: [h + 0.02, y + t * 0.22], mat: 'borda', uv: 'run' },
    { a: [h + 0.02, y + t * 0.22], b: [h + 0.03, y + t * 0.55], mat: 'borda', uv: 'run' },
    { a: [h + 0.03, y + t * 0.55], b: [h - 0.04, y + t * 0.86], mat: 'borda', uv: 'run' },
    { a: [h - 0.04, y + t * 0.86], b: [h - 0.16, y + t], mat: 'bandaTopo', uv: 'run' },
    { a: [h - 0.16, y + t], b: [-h + 0.16, y + t], mat: 'bandaTopo', uv: 'plan' },
    { a: [-h + 0.16, y + t], b: [-h + 0.04, y + t * 0.86], mat: 'bandaTopo', uv: 'run' },
    { a: [-h + 0.04, y + t * 0.86], b: [-h - 0.03, y + t * 0.55], mat: 'borda', uv: 'run' },
    { a: [-h - 0.03, y + t * 0.55], b: [-h - 0.02, y + t * 0.22], mat: 'borda', uv: 'run' },
    { a: [-h - 0.02, y + t * 0.22], b: [-h + 0.06, y], mat: 'borda', uv: 'run' },
  ];
}
const matBanda = (k) => (k === 'bandaTopo' ? M.bandaCinza || M.concreto : M.whiteSmooth);
// varredura de um perfil [o, dy] ao longo de um caminho 3D aberto [[x, y, z], ...] (as rampas da rede,
// que descem até o chão): a altura do perfil acompanha a do caminho; o resto é igual a sweep() de geom.js
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
// contorno recuado de d para dentro (os cantos apertados caem fora)
function recuo(poly, d) { const nor = normals(poly, true); const out = []; poly.forEach(([x, z], i) => { const px = x - nor[i][0] * d, pz = z - nor[i][1] * d; if (inPoly(px, pz, poly) && bordaD(px, pz, poly) > d * 0.8) out.push([px, pz]); }); return out; }
// contorno deslocado de d para fora (sem filtro: o furo do tampo em volta de cada célula)
function desloca(poly, d) { const nor = normals(poly, true); return poly.map(([x, z], i) => [x + nor[i][0] * d, z + nor[i][1] * d]); }
// elipse em coordenadas locais (u, v) da Ciências, já levada ao mundo por T
function elipseLocal(T, cu, cv, ru, rv, r, n) { const out = []; const c = Math.cos(r), s = Math.sin(r); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const x = Math.cos(a) * ru, z = Math.sin(a) * rv; out.push(T(cu + x * c - z * s, cv + x * s + z * c)); } return out; }
// pano de vidro espelhado levemente abaulado sobre uma célula: leque a partir do centroide com um anel a 60%
// (calota), normais suavizadas; não projeta sombra (o interior fica em sombra pela própria moldura)
function panoEspelho(poly, y, dome, mat) {
  const n = poly.length; let cx = 0, cz = 0; for (const [x, z] of poly) { cx += x; cz += z; } cx /= n; cz /= n;
  const P = [cx, y + dome, cz], U = [cx / 2.2, cz / 2.2], I = [];
  for (const [x, z] of poly) { const px = cx + (x - cx) * 0.6, pz = cz + (z - cz) * 0.6; P.push(px, y + dome * 0.64, pz); U.push(px / 2.2, pz / 2.2); }
  for (const [x, z] of poly) { P.push(x, y, z); U.push(x / 2.2, z / 2.2); }
  // orientação: o primeiro triângulo do leque decide (normal para cima)
  const e1x = P[3] - cx, e1z = P[5] - cz, e2x = P[6] - cx, e2z = P[8] - cz; const cima = e1z * e2x - e1x * e2z > 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; const a = 1 + i, b = 1 + j, c = 1 + n + i, d = 1 + n + j; if (cima) I.push(0, a, b, a, c, d, a, d, b); else I.push(0, b, a, a, d, c, a, b, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat); m.castShadow = false; m.receiveShadow = true; return m;
}
// espelho d'água em gota (pontas afinadas) com borda, para o vale urbanizado
function gotaPts(cx, cz, rx, rz, rot, n = 48) {
  const out = []; const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = 1 - 0.28 * Math.max(0, Math.cos(a)) ** 3; const x = Math.cos(a) * rx * (1 + 0.15 * Math.cos(a)), z = Math.sin(a) * rz * k; out.push([cx + x * c - z * s, cz + x * s + z * c]); }
  return out;
}

// Faculdade de Ciências: UM platô contínuo de concreto (tampo sálvia com lábio boleado claro) elevado sobre
// pilotis, com quatro células de tamanhos diferentes (a maior à direita) cobertas por vidraçaria espelhada que
// reflete o céu; abaixo do tampo, um vão único de vidro escuro recuado entre o lábio de cima e o lábio inferior;
// a proa direita é maciça; nas duas pontas a banda desce em rampas até o chão.
// Etapas: e1 pilotis, forro e árvores; e2 lábio inferior e vidro; e3 platô, lábios e rampas; e4 panos espelhados,
// boca, luzes e o vale (gota e canal).
export function ciencias() {
  const c = A.ciencias; const rot = c.rot; const cr = Math.cos(rot), sr = Math.sin(rot);
  const T = (u, v) => [c.c[0] + u * cr - v * sr, c.c[1] + u * sr + v * cr]; // planta local (u ao longo, v atravessado) -> mundo
  const root = new THREE.Group(); root.name = 'ciencias'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group(), e4: new THREE.Group() };
  const y0 = 0.9, lh = 0.5, yT = y0 + 2 * lh - 0.1; // forro do térreo elevado, pé-direito do vão e base do tampo (topo em yT + 0.4 = 2.2)
  // contorno externo: estreito à esquerda (entre o Anel e a Ala em Onda), bojudo à direita (o lóbulo grande, sobre a margem do lago)
  const ctrl = [[-6.6, -1.6], [-5.6, -0.6], [-3.8, -0.35], [-1.6, -0.25], [0.8, 0.9], [3.0, 2.1], [5.2, 2.0], [6.6, 0.9], [6.9, -0.6], [6.0, -2.4], [3.8, -3.0], [1.4, -3.1], [-1.0, -3.5], [-3.4, -4.0], [-5.8, -3.7]];
  const cont = curve(ctrl.map(([u, v]) => T(u, v)), true, 200, 0.5); const N = cont.length; const nor = normals(cont, true);
  const perto = (u, v) => { const [x, z] = T(u, v); let bi = 0, bd = 1e9; cont.forEach(([px, pz], i) => { const d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; bi = i; } }); return bi; };
  const arco = (i0, i1) => { const out = []; for (let i = i0; ; i = (i + 1) % N) { out.push(cont[i]); if (i === i1) break; } return out; };
  // varredura de um trecho aberto do contorno com o "o" positivo sempre para fora (a orientação do trecho pode
  // inverter a normal de um caminho aberto)
  const sweepArco = (pts, edges, o = {}) => { const nn = normals(pts, false); const k = (pts.length >> 1); let bi = 0, bd = 1e9; cont.forEach(([px, pz], i) => { const d = Math.hypot(px - pts[k][0], pz - pts[k][1]); if (d < bd) { bd = d; bi = i; } }); const s = nn[k][0] * nor[bi][0] + nn[k][1] * nor[bi][1] < 0 ? -1 : 1; return sweep(pts, false, s > 0 ? edges : edges.map((e) => ({ ...e, a: [-e.b[0], e.b[1]], b: [-e.a[0], e.a[1]] })), { caps: false, ...o }); }; // (com a normal invertida, espelha o "o" e inverte a aresta: a face continua virada para fora)
  // as quatro células (A oval no fundo à esquerda, B triângulo boleado à frente de A, C oval pequena no fundo, D grande à direita)
  const cels = [
    elipseLocal(T, -4.5, -2.85, 1.15, 0.62, 0.15, 48),
    curve([[-3.6, -1.0], [-1.3, -0.95], [-0.9, -1.6], [-1.7, -2.2], [-3.0, -2.05]].map(([u, v]) => T(u, v)), true, 48, 0.6),
    elipseLocal(T, -1.5, -2.7, 0.85, 0.38, -0.1, 40),
    elipseLocal(T, 3.2, -0.35, 2.85, 1.55, 0.08, 96),
  ];
  const domes = [0.05, 0.06, 0.03, 0.12];
  const iBoca0 = perto(0.9, 1.0), iBoca1 = perto(5.4, 2.0), iProa1 = perto(6.0, -2.4);
  // e1: forro de concreto sob o térreo, pilotis finos (contorno a cada 1,4 e seis sob D) e as árvores da mata sob a
  // parte esquerda, atrás de D, no canto frente-esquerda de D e à direita da proa
  P.e1.add(plate(recuo(cont, 0.12), y0 - 0.02, 0.06, M.concreto));
  const cols = []; let acc = 0.9; for (let i = 0; i < N; i++) { const a = cont[i], b = cont[(i + 1) % N]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc >= 1.4) { acc = 0; const [x, z] = [a[0] - nor[i][0] * 0.2, a[1] - nor[i][1] * 0.2]; cols.push([[x, heightAt(x, z) - 0.05, z], [x, y0, z]]); } }
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.4; const [x, z] = T(3.2 + Math.cos(a) * 1.7, -0.35 + Math.sin(a) * 0.9); cols.push([[x, heightAt(x, z) - 0.05, z], [x, y0, z]]); }
  P.e1.add(beams(cols, 0.05, M.whiteSmooth, 6));
  const R = rng(7 * 31 + 5); const lagoP = A.lago; const foraAgua = (x, z) => !inPoly(x, z, lagoP) && distPoly(x, z, lagoP) > 0.3;
  const tr = [];
  for (let i = 0, t = 0; i < 10 && t < 60; t++) { const [x, z] = T(-6.0 + R() * 4.8, -1.0 - R() * 2.4); if (!inPoly(x, z, cont) || !foraAgua(x, z)) continue; tr.push({ x, z, s: 0.26 + R() * 0.06, pal: 'mata', h: 1.0 }); i++; }
  for (const [u, v] of [[1.6, -3.7], [2.8, -4.1], [4.2, -3.9], [5.4, -3.5]]) { const [x, z] = T(u, v); if (foraAgua(x, z)) tr.push({ x, z, s: 0.3, pal: 'mata', h: 1.05 }); }
  for (const [u, v] of [[0.9, 1.5], [1.5, 1.9], [0.4, 1.2]]) { const [x, z] = T(u, v); tr.push({ x, z, s: 0.3, pal: 'jardim', h: 1.0 }); }
  for (const [u, v] of [[7.5, -0.8], [8.0, -1.0]]) { const [x, z] = T(u, v); if (foraAgua(x, z)) tr.push({ x, z, s: 0.34, pal: 'mata', h: 1.1 }); }
  P.e1.add(treeGroup(tr.map((t) => ({ ...t, y: Math.max(0, heightAt(t.x, t.z)) }))));
  // e2: lábio inferior boleado em todo o contorno e o vão de vidro escuro recuado entre os dois lábios (menos a boca e a proa)
  addMap(P.e2, sweep(cont, true, bandaDupla(y0 - 0.12, 0.3, 0.45)), () => M.whiteSmooth);
  const vao = arco(iProa1, iBoca0);
  addMap(P.e2, sweepArco(vao, [{ a: [-0.26, y0 + 0.2], b: [-0.26, yT - 0.02], mat: 'vidro', uv: 'facade', vBase: y0 }]), () => M.glass);
  P.e2.traverse((o) => { if (o.isMesh && o.material === M.glass) { o.renderOrder = 3; o.castShadow = false; } });
  // e3: o platô — tampo sálvia com as células vazadas, lábio externo boleado (claro por fora, sálvia no dorso), lábio
  // de cada célula, a proa maciça (com o vão da Ponte Coberta), o visor da frente de D e as duas rampas
  P.e3.add(plateHoles(recuo(cont, 0.12), cels.map((p) => desloca(p, 0.1)), yT, 0.4, M.bandaCinza || M.concreto));
  const labioExt = [
    { a: [0, yT], b: [0.10, yT + 0.09], mat: 'borda', uv: 'run' }, { a: [0.10, yT + 0.09], b: [0.12, yT + 0.22], mat: 'borda', uv: 'run' },
    { a: [0.12, yT + 0.22], b: [0.06, yT + 0.34], mat: 'borda', uv: 'run' }, { a: [0.06, yT + 0.34], b: [-0.08, yT + 0.4], mat: 'borda', uv: 'run' },
    { a: [-0.08, yT + 0.4], b: [-0.16, yT + 0.4], mat: 'bandaTopo', uv: 'plan' },
  ];
  addMap(P.e3, sweep(cont, true, labioExt), matBanda);
  const labioCel = [
    { a: [0.16, yT + 0.4], b: [0.10, yT + 0.4], mat: 'bandaTopo', uv: 'plan' }, { a: [0.10, yT + 0.4], b: [0, yT + 0.37], mat: 'borda', uv: 'run' },
    { a: [0, yT + 0.37], b: [-0.09, yT + 0.29], mat: 'borda', uv: 'run' }, { a: [-0.09, yT + 0.29], b: [-0.13, yT + 0.16], mat: 'borda', uv: 'run' },
    { a: [-0.13, yT + 0.16], b: [-0.11, yT + 0.04], mat: 'borda', uv: 'run' },
  ];
  for (const cel of cels) addMap(P.e3, sweep(cel, true, labioCel), matBanda);
  const [gx, gz] = T(6.76, -0.09); const proa = arco(iBoca1, iProa1); const trechos = []; let atual = [];
  for (const p of proa) { if (Math.hypot(p[0] - gx, p[1] - gz) < 0.4) { if (atual.length > 1) trechos.push(atual); atual = []; } else atual.push(p); } if (atual.length > 1) trechos.push(atual);
  for (const t of trechos) addMap(P.e3, sweepArco(t, [{ a: [-0.02, y0 - 0.12], b: [-0.02, yT + 0.02], mat: 'borda', uv: 'run' }]), () => M.whiteSmooth);
  const boca = arco(iBoca0, iBoca1);
  addMap(P.e3, sweepArco(boca, [{ a: [0.0, yT - 0.15], b: [0.0, yT + 0.01], mat: 'borda', uv: 'run' }]), () => M.whiteSmooth);
  const rampas = [
    [[-6.4, -1.5, yT - 0.02], [-7.1, -1.35, yT - 0.12], [-7.7, -1.7, yT * 0.72], [-7.5, -2.5, yT * 0.48], [-6.6, -2.9, yT * 0.27], [-5.6, -2.8, yT * 0.1], [-4.6, -2.4, -0.5]],
    [[6.6, -0.5, yT - 0.02], [7.4, -0.75, yT - 0.1], [8.3, -0.9, yT * 0.68], [9.3, -0.6, yT * 0.4], [10.0, -0.35, yT * 0.16], [10.6, -0.3, -0.5]], // à direita: desce rumo à cabeceira do lago
  ];
  for (const r of rampas) { const cv = new THREE.CatmullRomCurve3(r.map(([u, v, y]) => { const [x, z] = T(u, v); return new THREE.Vector3(x, y, z); }), false, 'catmullrom', 0.5); const pts = cv.getSpacedPoints(44).map((p) => [p.x, p.y, p.z]); addMap(P.e3, sweep3(pts, bandaRedonda(0, 0.4, 0.6)), matBanda); }
  // e4: panos de vidro espelhado sobre as células (rentes ao tampo, um pouco abaixo da face superior, para a banda
  // ler como moldura), a boca espelhada na frente de D, luzes sob o beiral e o vale urbanizado: gota com repuxo e canal
  cels.forEach((cel, k) => P.e4.add(panoEspelho(recuo(cel, 0.06), yT + 0.26, domes[k], espelho())));
  addMap(P.e4, sweepArco(boca, [{ a: [-0.3, y0 + 0.2], b: [-0.3, yT - 0.02], mat: 'espelho', uv: 'run' }]), espelho);
  const m4 = new THREE.Matrix4(); const glow = []; for (let i = 0; i < N; i += 8) glow.push([cont[i][0] - nor[i][0] * 0.3, yT - 0.03, cont[i][1] - nor[i][1] * 0.3]);
  const gl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.02, 0.06), M.lampGlow, glow.length); glow.forEach((p, i) => gl.setMatrixAt(i, m4.makeTranslation(...p))); P.e4.add(gl);
  const g = A.ciencias.gota;
  P.e4.add(plate(gotaPts(g.c[0], g.c[1], g.rx + 0.14, g.rz + 0.14, g.rot), 0.0, 0.07, M.whiteSmooth));
  P.e4.add(plate(gotaPts(g.c[0], g.c[1], g.rx, g.rz, g.rot), 0.0, 0.075, M.pool));
  const rep = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 8, 1, true), dupla(M.glassRail)); rep.position.set(g.c[0], 0.3, g.c[1]); rep.castShadow = false; P.e4.add(rep);
  const can = [[g.c[0] + 0.1, g.c[1] + g.rz * 0.9], ...g.canal];
  const cp = curve(can, false, 40, 0.5);
  addMap(P.e4, sweep(cp, false, [{ a: [0.22, 0.0], b: [0.22, 0.07], mat: 'borda', uv: 'run' }, { a: [0.22, 0.07], b: [0.15, 0.07], mat: 'borda', uv: 'plan' }, { a: [0.15, 0.065], b: [-0.15, 0.065], mat: 'agua', uv: 'plan' }, { a: [-0.15, 0.07], b: [-0.22, 0.07], mat: 'borda', uv: 'plan' }, { a: [-0.22, 0.07], b: [-0.22, 0.0], mat: 'borda', uv: 'run' }], { caps: false }), (k) => (k === 'agua' ? M.pool : M.whiteSmooth));
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'ciencias', root, partes: P, esqueletos: {}, grua: { e1: true, e3: true }, foco: { x: c.c[0], z: c.c[1] + 1, dist: 15 }, ancora: [c.c[0] + 1.5, 3.6, c.c[1]] };
}
// Ala em Onda: fita em "S" com terraços entre o Campus Universitário e a Faculdade de Ciências
export function alaOnda() {
  return new Faixa({ id: 'onda', closed: false, path: curve([[-15.4, -5.2], [-13.2, -7.6], [-10.8, -6.3], [-8.6, -7.8], [-6.9, -7.3]], false, 120), modulos: 1,
    prof: { o0: -0.5, o1: 0.7, setIn: 0, setOut: 0.28, fac: 'fac_lab', facIn: 'fac_quente' }, niveis: 3 });
}

// ---------------- planta da Sede (valores da especificação enquanto a área A não publica os campos novos) ----------------
const SEDE_PATH = [[-6.6, -9.6], [-5.6, -11.6], [-3.0, -13.3], [0.3, -13.9], [3.8, -13.8], [7.2, -12.8], [10.0, -10.8], [11.9, -8.5], [12.4, -5.9], [12.9, -3.6], [12.5, -2.2]];
const SEDE_INTERNA = { alta: [[8.2, -12.8], [9.0, -11.0], [9.4, -8.6], [9.2, -5.8], [8.6, -3.6]], baixa: [[8.6, -3.6], [7.6, -1.9], [6.4, -1.0], [4.8, -0.8], [3.2, -1.3], [1.5, -1.9]] };
const SEDE_PISCINA = { c: [5.1, -8.9], r: 1.3 };
const SEDE_PAVILHAO = { c: [1.2, -10.7], w: 1.8, d: 1.0, rot: 0.05, h: 0.6 };
function plantaSede() { const s = A.sede; const novo = !!s.path; return { path: s.path || SEDE_PATH, interna: s.interna || SEDE_INTERNA, piscina: novo ? s.piscina : SEDE_PISCINA, pavilhao: s.pavilhao || SEDE_PAVILHAO, o0: novo ? s.o0 : -2.1 }; }

// ---------------- Lago Central ----------------
const MPedra = new THREE.MeshStandardMaterial({ color: 0xe2dccd, roughness: 0.92 }); // pedras claras da margem
export function lago(ground) {
  const root = new THREE.Group(); root.name = 'lago'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  // e1: desassoreamento (o nível da água sobe; animação no mundo)
  P.e1.userData.nivel = true;
  const sd = plantaSede(); const arcoSede = curve(sd.path, false, 60); const altaSede = curve(sd.interna.alta, false, 30);
  const naSede = (x, z) => distPoly(x, z, arcoSede, false) < 3.0 || distPoly(x, z, altaSede, false) < 1.7;
  const pc = sd.piscina; const pertoPiscina = (x, z, m) => !!pc && Math.hypot(x - pc.c[0], z - pc.c[1]) < m;
  // e2: margens vivas — juncos, pedras claras, a península de mata a leste e árvores soltas na margem
  const reeds = []; const pedras = []; const poly = A.lago; const R = rng(77);
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; for (let k = 0; k < 7; k++) { const t = R(); const x = a[0] + (b[0] - a[0]) * t + (R() - 0.5) * 0.4, z = a[1] + (b[1] - a[1]) * t + (R() - 0.5) * 0.4; if (pertoPiscina(x, z, 1.6)) continue; reeds.push([x, z, 0.15 + R() * 0.2]); } for (let k = 0; k < 3; k++) { const t = R(); pedras.push([a[0] + (b[0] - a[0]) * t + (R() - 0.5) * 0.3, a[1] + (b[1] - a[1]) * t + (R() - 0.5) * 0.3, 0.13 + R() * 0.2, R() * 6.28]); } }
  const rg = new THREE.ConeGeometry(0.03, 1, 4); rg.translate(0, 0.5, 0); const rim = new THREE.InstancedMesh(rg, M.planter, reeds.length); const m4 = new THREE.Matrix4();
  reeds.forEach(([x, z, h], i) => rim.setMatrixAt(i, m4.compose(new THREE.Vector3(x, -0.12, z), new THREE.Quaternion(), new THREE.Vector3(1, h * 1.5, 1)))); P.e2.add(rim);
  const pim = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), MPedra, pedras.length); const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s3 = new THREE.Vector3();
  pedras.forEach(([x, z, s, r], i) => pim.setMatrixAt(i, m4.compose(v.set(x, Math.max(heightAt(x, z), -0.14) + s * 0.15, z), q.setFromEuler(e.set(0, r, 0)), s3.set(s, s * 0.6, s * 0.8)))); pim.castShadow = true; pim.receiveShadow = true; P.e2.add(pim);
  const tr = []; const foraAgua = (x, z, m = 0.35) => !inPoly(x, z, poly) && distPoly(x, z, poly) > m;
  // península de mata a leste (contínua com a mata do pé do anel), sem entrar na água nem na fita interna
  for (let i = 0, t = 0; i < 16 && t < 200; t++) { const x = 6.0 + R() * 1.9, z = -8.5 + R() * 3.5; if (!foraAgua(x, z, 0.3) || pertoPiscina(x, z, pc ? pc.r + 0.4 : 0) || distPoly(x, z, altaSede, false) < 1.7) continue; tr.push({ x, z, s: 0.3 + R() * 0.15, pal: 'mata', h: 1.05 }); i++; }
  // árvores soltas na margem: fora da água, fora da faixa da Sede e longe da piscina
  for (let i = 0, t = 0; i < 18 && t < 300; t++) { const k = (R() * poly.length) | 0; const a = poly[k], b = poly[(k + 1) % poly.length]; const u = R(); const x = a[0] + (b[0] - a[0]) * u + (R() - 0.5) * 1.6, z = a[1] + (b[1] - a[1]) * u + (R() - 0.5) * 1.6; if (!foraAgua(x, z) || naSede(x, z) || pertoPiscina(x, z, pc ? pc.r + 0.6 : 0)) continue; tr.push({ x, z, s: 0.28 + R() * 0.16, pal: 'jardim' }); i++; }
  P.e2.add(treeGroup(tr.map((t) => ({ ...t, y: Math.max(0, heightAt(t.x, t.z)) }))));
  // e3: estação natural de água — ilhas flutuantes filtrantes (jardins baixos), píer de madeira na margem oeste, casa
  // de bombas, o passeio em S que separa o corpo principal da baía a leste e a calçada clara fina de toda a margem
  for (const [x, z, rx, rz] of [[-1.8, -7.6, 0.42, 0.24], [0.2, -6.6, 0.36, 0.21], [-1.4, -9.2, 0.3, 0.18], [0.6, -5.2, 0.33, 0.18]]) { const g = new THREE.CylinderGeometry(1, 1, 0.05, 20); g.scale(rx, 1, rz); const m = mesh(g, M.planter, false); m.position.set(x, -0.07, z); P.e3.add(m); const sh = []; for (let i = 0; i < 4; i++) sh.push({ x: x + (R() - 0.5) * rx, z: z + (R() - 0.5) * rz, y: -0.05, s: 0.07 + R() * 0.04, pal: 'jardim' }); P.e3.add(treeGroup(sh, { cast: false })); }
  const deckM = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.3), M.woodLight); deckM.position.set(-2.6, 0.02, -6.4); deckM.rotation.y = 1.3; deckM.castShadow = true; P.e3.add(deckM);
  const house = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.45), M.white); house.position.set(7.4, 0.18, -4.4); house.rotation.y = -0.5; house.castShadow = true; P.e3.add(house);
  const hr = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.04, 0.49), M.roof); hr.position.set(7.4, 0.37, -4.4); hr.rotation.y = -0.5; P.e3.add(hr);
  P.e3.add(deck([[1.1, -9.9, 0.1], [1.6, -8.8, 0.1], [2.2, -7.7, 0.1], [2.6, -6.9, 0.1], [4.0, -6.2, 0.1], [5.2, -5.8, 0.1], [6.0, -5.5, 0.1]], 0.3, { jardim: false, topo: 'branco' }));
  addMap(P.e3, sweep(curve(poly, true, 120), true, [{ a: [0.02, 0.03], b: [-0.3, 0.03], mat: 'c', uv: 'plan' }], { caps: false }), () => M.caminhoTeto);
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'lago', root, partes: P, esqueletos: {}, grua: {}, foco: { x: 0.6, z: -7.4, dist: 17 }, ancora: [0.6, 1.4, -7.4] };
}

// ---------------- Pátio da Sede ----------------
// A Sede é a fita aberta (aneis.js). O pátio é o que acompanha a fita: as fundações (e1) do arco e dos dois
// trechos da fita interna e, por dentro da curva, a piscina redonda de borda branca na água do lago, o pavilhão de
// placa plana na margem norte e as árvores do pé do anel e da península (e4).
export function sedePatio() {
  const s = A.sede; const sd = plantaSede(); const root = new THREE.Group(); root.name = 'sedePatio'; const P = { e1: new THREE.Group(), e4: new THREE.Group() };
  const arco = curve(sd.path, false, 200); const nor = normals(arco, false); const o0 = sd.o0;
  // e1: fundações (faixa de concreto um pouco mais larga que cada fita)
  const fund = (path, oi) => sweep(path, false, [{ a: [0.15, -0.06], b: [0.15, 0.03], mat: 'c', uv: 'run' }, { a: [0.15, 0.03], b: [oi - 0.15, 0.03], mat: 'c', uv: 'plan' }, { a: [oi - 0.15, 0.03], b: [oi - 0.15, -0.06], mat: 'c', uv: 'run' }]);
  addMap(P.e1, fund(arco, o0), () => M.concreto);
  addMap(P.e1, fund(curve(sd.interna.alta, false, 60), -1.4), () => M.concreto);
  addMap(P.e1, fund(curve(sd.interna.baixa, false, 80), -1.3), () => M.concreto);
  // e4: piscina redonda de borda branca no nordeste da água (plataforma que desce até o leito) e o pavilhão
  const pc = sd.piscina; if (pc) { const rim = new THREE.Mesh(new THREE.CylinderGeometry(pc.r + 0.15, pc.r + 0.15, 0.4, 40), M.whiteSmooth); rim.position.set(pc.c[0], -0.12, pc.c[1]); rim.castShadow = true; rim.receiveShadow = true; P.e4.add(rim); const w = new THREE.Mesh(new THREE.CircleGeometry(pc.r, 40), M.pool); w.rotation.x = -Math.PI / 2; w.position.set(pc.c[0], 0.0, pc.c[1]); w.receiveShadow = true; P.e4.add(w); }
  const pv = sd.pavilhao; if (pv) {
    const gpv = new THREE.Group(); gpv.position.set(pv.c[0], 0, pv.c[1]); gpv.rotation.y = -(pv.rot || 0); P.e4.add(gpv);
    const placa = mesh(new THREE.BoxGeometry(pv.w, 0.05, pv.d), M.whiteSmooth); placa.position.y = pv.h + 0.025; gpv.add(placa);
    const caixa = mesh(new THREE.BoxGeometry(pv.w * 0.72, pv.h - 0.1, pv.d * 0.7), M.glass, false); caixa.position.y = (pv.h - 0.1) / 2 + 0.05; caixa.renderOrder = 3; gpv.add(caixa);
    const pil = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) pil.push([[sx * (pv.w / 2 - 0.1), -0.05, sz * (pv.d / 2 - 0.1)], [sx * (pv.w / 2 - 0.1), pv.h, sz * (pv.d / 2 - 0.1)]]); gpv.add(beams(pil, 0.03, M.whiteSmooth, 6));
  }
  // árvores: 28 no pé interno do anel (fora do lago, longe da piscina e da fita interna) e 16 na península
  const tr = []; const R = rng(41); const lago = A.lago; const alta = curve(sd.interna.alta, false, 30); const baixa = curve(sd.interna.baixa, false, 30);
  const livre = (x, z) => !inPoly(x, z, lago) && distPoly(x, z, lago) > 0.4 && !(pc && Math.hypot(x - pc.c[0], z - pc.c[1]) < 1.6) && distPoly(x, z, alta, false) > 1.75 && distPoly(x, z, baixa, false) > 1.65;
  for (let t = 0; tr.length < 28 && t < 400; t++) { const k = 4 + ((R() * (arco.length - 8)) | 0); const o = o0 - 0.45 - R() * 0.55; const x = arco[k][0] + nor[k][0] * o, z = arco[k][1] + nor[k][1] * o; if (!livre(x, z)) continue; tr.push({ x, z, s: 0.24 + R() * 0.12, pal: 'mata', h: 1.05 }); }
  for (let t = 0; tr.length < 44 && t < 300; t++) { const x = 6.0 + R() * 1.9, z = -8.5 + R() * 3.5; if (!livre(x, z)) continue; tr.push({ x, z, s: 0.3 + R() * 0.15, pal: 'mata', h: 1.05 }); }
  P.e4.add(treeGroup(tr.map((t) => ({ ...t, y: Math.max(0, heightAt(t.x, t.z)) }))));
  for (const k of Object.keys(P)) root.add(P[k]);
  const meio = arco[(arco.length * 0.55) | 0];
  return { id: 'sedePatio', root, partes: P, esqueletos: {}, grua: {}, foco: { x: s.c[0] + 1.5, z: s.c[1] - 1.0, dist: 19 }, ancora: [meio[0], 2.6, meio[1]] };
}
function distPoly(x, z, p, fechado = true) { let d = 1e9; for (let i = fechado ? 0 : 1, j = fechado ? p.length - 1 : 0; i < p.length; j = i++) { const [ax, az] = p[j], [bx, bz] = p[i]; const vx = bx - ax, vz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1))); d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t)); } return d; }
