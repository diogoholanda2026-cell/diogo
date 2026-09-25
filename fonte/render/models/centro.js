// Centro da composição: Faculdade de Ciências Avançadas (uma rede contínua de bandas brancas em casca, com
// laboratórios à mostra dentro das células), a Ala em Onda, o Lago Central e o pátio da Sede da Holding.
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { sweep, beams, curve, normals, ellipse } from '../geom.js';
import { treeGroup } from '../forest.js';
import { heightAt } from '../ground.js';
import { hash, rng, inPoly } from '../../core/util.js';
import { Faixa } from './faixa.js';
import { deck } from './praca.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
function shapeOf(pts) { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); return s; }
function plate(pts, y, h, mat) { const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); return mesh(g, mat); }
const bordaD = (x, z, p) => { let d = 1e9; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [ax, az] = p[j], [bx, bz] = p[i]; const vx = bx - ax, vz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1))); d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t)); } return d; };
const addMap = (grp, map, matFn) => { for (const [k, g] of map) grp.add(mesh(g, matFn(k))); };
// banda transversal (dos dois lados arredondada), centrada no caminho: a borda das lajes
function bandaDupla(y, t, w) {
  const h = w / 2; // perfil no sentido anti-horário (base, lado +, tampo, lado -): normais para fora
  return [
    { a: [-h, y], b: [h, y], mat: 'borda', uv: 'plan' },
    { a: [h, y], b: [h + 0.05, y + t * 0.5], mat: 'borda', uv: 'run' }, { a: [h + 0.05, y + t * 0.5], b: [h, y + t], mat: 'borda', uv: 'run' },
    { a: [h, y + t], b: [-h, y + t], mat: 'bandaTopo', uv: 'plan' },
    { a: [-h, y + t], b: [-h - 0.05, y + t * 0.5], mat: 'borda', uv: 'run' }, { a: [-h - 0.05, y + t * 0.5], b: [-h, y], mat: 'borda', uv: 'run' },
  ];
}
// banda grossa e arredondada (a casca da rede, como um tubo achatado): w = largura, t = espessura;
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
// contorno recuado de d para dentro (os cantos apertados, onde a divisória encontra o contorno, caem fora)
function recuo(poly, d) { const nor = normals(poly, true); const out = []; poly.forEach(([x, z], i) => { const px = x - nor[i][0] * d, pz = z - nor[i][1] * d; if (inPoly(px, pz, poly) && bordaD(px, pz, poly) > d * 0.8) out.push([px, pz]); }); return out; }
// caixa de janelas com UV do atlas de fachada na escala certa (sem "hieróglifos")
let _faixaLab = null;
function faixaLabGeo() { if (_faixaLab) return _faixaLab; const g = new THREE.BoxGeometry(1, 1, 1); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 0.1, 0.3 + uv.getY(k) * 0.14); g.userData.compartilhada = true; return (_faixaLab = g); }
// espelho d'água em gota (pontas afinadas) com borda, para o vale urbanizado
function gotaPts(cx, cz, rx, rz, rot, n = 48) {
  const out = []; const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = 1 - 0.28 * Math.max(0, Math.cos(a)) ** 3; const x = Math.cos(a) * rx * (1 + 0.15 * Math.cos(a)), z = Math.sin(a) * rz * k; out.push([cx + x * c - z * s, cz + x * s + z * c]); }
  return out;
}

// Faculdade de Ciências: UMA casca contínua de concreto branco em rede, elevada sobre pilotis, com quatro
// células de tamanhos diferentes (a maior à direita) por onde se veem os laboratórios brancos em dois pisos.
// As bandas da rede são grossas e arredondadas; nas duas pontas a rede desce em rampas até o chão.
// Etapas: e1 pilotis + lajes; e2 laboratórios; e3 a rede de bandas; e4 vidro, luzes e o vale (gota e canal).
export function ciencias() {
  const c = A.ciencias; const rot = c.rot; const cr = Math.cos(rot), sr = Math.sin(rot);
  const T = (u, v) => [c.c[0] + u * cr - v * sr, c.c[1] + u * sr + v * cr]; // planta local (u ao longo, v atravessado) -> mundo
  const root = new THREE.Group(); root.name = 'ciencias'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group(), e4: new THREE.Group() };
  const y0 = 1.2, lh = 0.72, yT = y0 + 2 * lh - 0.1; // piso térreo elevado, pé-direito e base da banda de topo
  // contorno externo da rede: estreito à esquerda (entre o Anel e a Ala em Onda), bojudo à direita (o lóbulo grande, sobre a margem do lago)
  const ctrl = [[-6.4, -1.1], [-5.4, -0.4], [-3.6, -0.3], [-1.4, -0.2], [0.8, 0.9], [3.0, 2.1], [5.2, 2.0], [6.6, 0.9], [6.9, -0.6], [6.0, -2.4], [3.8, -3.1], [1.2, -3.0], [-1.2, -3.3], [-3.6, -3.5], [-5.6, -2.9]];
  const cont = curve(ctrl.map(([u, v]) => T(u, v)), true, 280, 0.5); const N = cont.length; const nor = normals(cont, true);
  const perto = (u, v) => { const [x, z] = T(u, v); let bi = 0, bd = 1e9; cont.forEach(([px, pz], i) => { const d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; bi = i; } }); return bi; };
  // três divisórias (frente -> fundo), curvas, que separam as quatro células: [uF, vF, uB, vB, bojo]
  const divs = [[-3.7, -0.3, -3.4, -3.5, 0.35], [-1.3, -0.2, -1.5, -3.3, -0.3], [1.3, 1.0, 1.4, -3.0, 0.3]].map(([uF, vF, uB, vB, bojo]) => {
    const iF = perto(uF, vF), iB = perto(uB, vB); const a = cont[iF], b = cont[iB]; const dx = b[0] - a[0], dz = b[1] - a[1], dl = Math.hypot(dx, dz) || 1;
    return { iF, iB, path: curve([a, [(a[0] + b[0]) / 2 - (dz / dl) * bojo, (a[1] + b[1]) / 2 + (dx / dl) * bojo], b], false, 30, 0.5) };
  });
  const arco = (i0, i1) => { const out = []; for (let i = i0; i <= i1; i++) out.push(cont[i]); return out; };
  const celulas = []; // polígonos das células (banda a banda), da esquerda para a direita
  celulas.push([...arco(0, divs[0].iF), ...divs[0].path.slice(1, -1), ...arco(divs[0].iB, N - 1)]);
  for (let k = 0; k < 2; k++) celulas.push([...arco(divs[k].iF, divs[k + 1].iF), ...divs[k + 1].path.slice(1, -1), ...arco(divs[k + 1].iB, divs[k].iB), ...divs[k].path.slice(1, -1).reverse()]);
  celulas.push([...arco(divs[2].iF, divs[2].iB), ...divs[2].path.slice(1, -1).reverse()]);
  // e1: pilotis finos (sob a banda, sob as divisórias e sob as lajes), lajes de concreto dos dois pisos e o saguão de vidro
  const cols = []; const m4 = new THREE.Matrix4();
  let acc = 0.7; for (let i = 0; i < N; i++) { const a = cont[i], b = cont[(i + 1) % N]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc >= 1.3) { acc = 0; cols.push([[a[0], heightAt(a[0], a[1]) - 0.05, a[1]], [a[0], y0, a[1]]]); } }
  for (const d of divs) for (let i = 6; i < d.path.length - 6; i += 8) { const [x, z] = d.path[i]; cols.push([[x, heightAt(x, z) - 0.05, z], [x, y0, z]]); }
  const pisos = celulas.map((cel, k) => [recuo(cel, 0.22), recuo(cel, k === 3 ? 0.62 : 0.5)]); // térreo quase cheio; piso de cima recuado (vão em volta, vê-se o de baixo)
  const R = rng(7 * 31 + 5);
  celulas.forEach((cel, k) => { const p1 = pisos[k][1]; for (let i = 0; i < p1.length; i += Math.max(6, Math.round(p1.length / 6))) { const [x, z] = p1[i]; const px = x + (R() - 0.5) * 0.1, pz = z + (R() - 0.5) * 0.1; if (!inPoly(px, pz, p1)) continue; cols.push([[px, y0 + 0.1, pz], [px, y0 + lh, pz]]); cols.push([[px, heightAt(px, pz) - 0.05, pz], [px, y0, pz]]); } });
  P.e1.add(beams(cols, 0.05, M.whiteSmooth, 6));
  for (const [p0, p1] of pisos) { P.e1.add(plate(p0, y0, 0.1, M.concreto)); P.e1.add(plate(p1, y0 + lh, 0.1, M.concreto)); }
  for (const [u, v, rx] of [[4.0, -0.4, 1.0], [-2.4, -1.8, 0.7]]) { const [x, z] = T(u, v); const lobby = new THREE.Mesh(new THREE.CylinderGeometry(rx, rx, y0, 24, 1, true), dupla(M.glassWarm)); lobby.scale.set(1, 1, 0.65); lobby.position.set(x, y0 / 2, z); lobby.rotation.y = -rot; P.e1.add(lobby); }
  // e2: laboratórios (mini-prédios brancos com faixa de janelas e telas) em grade com jitter dentro de cada célula,
  // nos dois pisos; o piso de cima, visto pelas células abertas, é o mais denso; pisos com acabamento branco
  const labs = []; const ca = Math.cos(rot), sa = Math.sin(rot);
  celulas.forEach((cel, k) => {
    for (let f = 0; f < 2; f++) {
      const reg = recuo(cel, f ? (k === 3 ? 0.85 : 0.72) : 0.5); if (reg.length < 8) continue; const passo = f ? 0.56 : 0.72;
      let umin = 1e9, umax = -1e9, vmin = 1e9, vmax = -1e9;
      for (const [x, z] of reg) { const u = (x - c.c[0]) * ca + (z - c.c[1]) * sa, v = -(x - c.c[0]) * sa + (z - c.c[1]) * ca; umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); }
      for (let u = umin + passo / 2; u < umax; u += passo) for (let v = vmin + passo / 2; v < vmax; v += passo) {
        const uu = u + (R() - 0.5) * passo * 0.3, vv = v + (R() - 0.5) * passo * 0.3; const [px, pz] = T(uu, vv);
        if (!inPoly(px, pz, reg) || bordaD(px, pz, reg) < 0.14 || R() < 0.14) continue;
        const h = f ? 0.2 + R() * 0.38 : Math.min(lh - 0.2, 0.18 + R() * 0.3);
        labs.push([px, y0 + f * lh + 0.1, pz, 0.3 + R() * 0.28, h, 0.24 + R() * 0.2, rot + (R() - 0.5) * 0.3]);
      }
    }
  });
  const lb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.whiteSmooth, labs.length); const fx = new THREE.InstancedMesh(faixaLabGeo(), M.fac_lab, labs.length); const sc = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.cyanGlow, labs.length); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const v = new THREE.Vector3(), s3 = new THREE.Vector3(); let ns = 0;
  labs.forEach(([x, y, z, w, h, d, r], i) => { q.setFromEuler(e.set(0, -r, 0)); lb.setMatrixAt(i, m4.compose(v.set(x, y + h / 2, z), q, s3.set(w, h, d))); fx.setMatrixAt(i, m4.compose(v.set(x, y + h * 0.55, z), q, s3.set(w + 0.012, h * 0.34, d + 0.012))); if (hash(i, 3, 5) < 0.4) sc.setMatrixAt(ns++, m4.compose(v.set(x, y + h + 0.04, z), q, s3.set(w * 0.5, 0.06, 0.012))); });
  sc.count = ns; lb.castShadow = true; P.e2.add(lb, fx, sc);
  for (const [p0, p1] of pisos) { P.e2.add(plate(p0, y0 + 0.1, 0.03, M.whiteSmooth)); P.e2.add(plate(p1, y0 + lh + 0.1, 0.03, M.whiteSmooth)); }
  // e3: a rede — banda de topo grossa e boleada no contorno e nas divisórias, banda fina na borda do térreo, e
  // as duas rampas: à esquerda a banda sai da ponta, dá a volta e desce até o chão sob o prédio; à direita ela
  // sai da ponta sobre a Ponte Coberta e desce a leste até a cabeceira da ponte comprida do lago
  addMap(P.e3, sweep(cont, true, bandaRedonda(yT, 0.55, 0.6)), matBanda);
  addMap(P.e3, sweep(cont, true, bandaDupla(y0 - 0.12, 0.22, 0.42)), matBanda);
  for (const d of divs) { addMap(P.e3, sweep(d.path, false, bandaRedonda(yT, 0.55, 0.6), { caps: false }), matBanda); addMap(P.e3, sweep(d.path, false, bandaDupla(y0 - 0.12, 0.22, 0.42), { caps: false }), matBanda); }
  const rampas = [
    [[-6.1, -1.15, yT - 0.02], [-6.9, -1.1, yT - 0.12], [-7.6, -1.4, yT * 0.72], [-7.5, -2.3, yT * 0.48], [-6.6, -2.8, yT * 0.27], [-5.6, -2.7, yT * 0.1], [-4.6, -2.3, -0.5]],
    [[6.3, -0.4, yT - 0.02], [7.3, -0.7, yT - 0.1], [8.3, -0.9, yT * 0.68], [9.3, -0.6, yT * 0.4], [10.0, -0.35, yT * 0.16], [10.6, -0.3, -0.5]], // à direita: desce rumo à ponte do lago
  ];
  for (const r of rampas) { const cv = new THREE.CatmullRomCurve3(r.map(([u, v, y]) => { const [x, z] = T(u, v); return new THREE.Vector3(x, y, z); }), false, 'catmullrom', 0.5); const pts = cv.getSpacedPoints(44).map((p) => [p.x, p.y, p.z]); addMap(P.e3, sweep3(pts, bandaRedonda(0, 0.5, 0.6)), matBanda); }
  // e4: vidro transparente recuado sob a banda de topo (os laboratórios dos dois pisos ficam à vista, como na foto),
  // paredes de vidro sob as divisórias, luzes sob a banda, e o vale urbanizado à frente: espelho em gota com repuxo e
  // o canal até o bulevar
  const ya = y0 + 0.1, yb = yT + 0.03; const vidro = () => M.glass;
  addMap(P.e4, sweep(cont, true, [{ a: [-0.26, ya], b: [-0.26, yb], mat: 'vidro', uv: 'facade', vBase: y0 }]), vidro);
  for (const d of divs) addMap(P.e4, sweep(d.path, false, [{ a: [0, ya], b: [0, yb], mat: 'vidro', uv: 'facade', vBase: y0 }], { caps: false }), vidro);
  P.e4.traverse((o) => { if (o.isMesh && o.material === M.glass) { o.renderOrder = 3; o.castShadow = false; } });
  const glow = []; for (let i = 0; i < N; i += 5) glow.push([cont[i][0] - nor[i][0] * 0.3, yT - 0.03, cont[i][1] - nor[i][1] * 0.3]);
  const gl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.02, 0.06), M.lampGlow, glow.length); glow.forEach((p, i) => gl.setMatrixAt(i, m4.makeTranslation(...p))); P.e4.add(gl);
  const g = A.ciencias.gota;
  P.e4.add(plate(gotaPts(g.c[0], g.c[1], g.rx + 0.14, g.rz + 0.14, g.rot), 0.0, 0.07, M.whiteSmooth));
  P.e4.add(plate(gotaPts(g.c[0], g.c[1], g.rx, g.rz, g.rot), 0.0, 0.075, M.pool));
  const rep = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 8, 1, true), dupla(M.glassRail)); rep.position.set(g.c[0], 0.3, g.c[1]); rep.castShadow = false; P.e4.add(rep);
  const can = [[g.c[0] + 0.1, g.c[1] + g.rz * 0.9], ...g.canal];
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
const MPedra = new THREE.MeshStandardMaterial({ color: 0xe2dccd, roughness: 0.92 }); // pedras claras da margem
export function lago(ground) {
  const root = new THREE.Group(); root.name = 'lago'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  // e1: desassoreamento (o nível da água sobe; animação no mundo)
  P.e1.userData.nivel = true;
  // e2: margens vivas — juncos, pedras claras, árvores na ilha e nas margens
  const reeds = []; const pedras = []; const poly = A.lago; const R = rng(77);
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; for (let k = 0; k < 7; k++) { const t = R(); const x = a[0] + (b[0] - a[0]) * t + (R() - 0.5) * 0.4, z = a[1] + (b[1] - a[1]) * t + (R() - 0.5) * 0.4; reeds.push([x, z, 0.15 + R() * 0.2]); } for (let k = 0; k < 3; k++) { const t = R(); pedras.push([a[0] + (b[0] - a[0]) * t + (R() - 0.5) * 0.3, a[1] + (b[1] - a[1]) * t + (R() - 0.5) * 0.3, 0.13 + R() * 0.2, R() * 6.28]); } }
  const rg = new THREE.ConeGeometry(0.03, 1, 4); rg.translate(0, 0.5, 0); const rim = new THREE.InstancedMesh(rg, M.planter, reeds.length); const m4 = new THREE.Matrix4();
  reeds.forEach(([x, z, h], i) => rim.setMatrixAt(i, m4.compose(new THREE.Vector3(x, -0.12, z), new THREE.Quaternion(), new THREE.Vector3(1, h * 1.5, 1)))); P.e2.add(rim);
  const pim = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), MPedra, pedras.length); const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s3 = new THREE.Vector3();
  pedras.forEach(([x, z, s, r], i) => pim.setMatrixAt(i, m4.compose(v.set(x, Math.max(heightAt(x, z), -0.14) + s * 0.15, z), q.setFromEuler(e.set(0, r, 0)), s3.set(s, s * 0.6, s * 0.8)))); pim.castShadow = true; pim.receiveShadow = true; P.e2.add(pim);
  const tr = []; for (let i = 0; i < 10; i++) { const a = R() * 6.28, r = R() * (A.ilha.r - 0.3); tr.push({ x: A.ilha.c[0] + Math.cos(a) * r, z: A.ilha.c[1] + Math.sin(a) * r, s: 0.3 + R() * 0.15, pal: 'jardim', h: 1.1 }); }
  // árvores na margem: fora da água e fora da faixa da Sede (fita + orla)
  const sd = A.sede; const arco = ellipse(sd.c[0], sd.c[1], sd.rx, sd.rz, sd.rot, 60, 0, 1, sd.a0, sd.a1); const naSede = (x, z) => distPoly(x, z, arco, false) < -sd.o0 + 0.9;
  for (let i = 0, t = 0; i < 18 && t < 300; t++) { const k = (R() * poly.length) | 0; const a = poly[k], b = poly[(k + 1) % poly.length]; const u = R(); const x = a[0] + (b[0] - a[0]) * u + (R() - 0.5) * 1.6, z = a[1] + (b[1] - a[1]) * u + (R() - 0.5) * 1.6; if (inPoly(x, z, poly) || distPoly(x, z, poly) < 0.35 || naSede(x, z)) continue; tr.push({ x, z, s: 0.28 + R() * 0.16, pal: 'jardim' }); i++; }
  P.e2.add(treeGroup(tr.map((t) => ({ ...t, y: Math.max(0, heightAt(t.x, t.z)) }))));
  // e3: estação natural de água — ilhas flutuantes filtrantes (jardins baixos), píer de madeira, casa de bombas e as duas
  // pontes brancas finas sobre o lago: a comprida, do pátio da Sede à margem sul (rumo à Biblioteca), e a curta até a ilha
  for (const [x, z, rx, rz] of [[-3.8, -8.6, 0.42, 0.24], [3.4, -8.0, 0.36, 0.21], [1.6, -9.6, 0.3, 0.18], [-3.4, -5.4, 0.33, 0.18]]) { const g = new THREE.CylinderGeometry(1, 1, 0.05, 20); g.scale(rx, 1, rz); const m = mesh(g, M.planter, false); m.position.set(x, -0.07, z); P.e3.add(m); const sh = []; for (let i = 0; i < 4; i++) sh.push({ x: x + (R() - 0.5) * rx, z: z + (R() - 0.5) * rz, y: -0.05, s: 0.07 + R() * 0.04, pal: 'jardim' }); P.e3.add(treeGroup(sh, { cast: false })); }
  const deckM = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.3), M.woodLight); deckM.position.set(6.45, 0.02, -6.7); deckM.rotation.y = -0.53; deckM.castShadow = true; P.e3.add(deckM);
  const house = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.45), M.white); house.position.set(7.9, 0.18, -5.2); house.rotation.y = -0.5; house.castShadow = true; P.e3.add(house);
  const hr = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.04, 0.49), M.roof); hr.position.set(7.9, 0.37, -5.2); hr.rotation.y = -0.5; P.e3.add(hr);
  for (const pts of [[[1.3, -11.5, 0.1], [1.8, -9.4, 0.34], [2.7, -6.6, 0.4], [3.6, -4.6, 0.34], [4.3, -3.3, 0.1]], [[-3.7, -4.35, 0.08], [-2.9, -5.0, 0.28], [-2.1, -5.7, 0.1]]]) P.e3.add(deck(pts, 0.42, { jardim: false }));
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
