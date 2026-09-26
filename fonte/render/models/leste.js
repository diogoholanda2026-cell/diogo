// Lado leste e fundo: Vila Estudantil (anfiteatro em ferradura de degraus claros e casas de tamanhos diferentes em
// faixa diagonal) e o Acelerador (bacia creme com rampa helicoidal, anel azul de colares brancos e injetor reto). A
// casca geodésica e os rochedos servem à Cúpula da Vida (cupula.js), que substituiu os habitats de animais.
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { beams, merge, BAY, FH } from '../geom.js';
import { treeGroup } from '../forest.js';
import { heightAt } from '../ground.js';
import { hash, rng, TAU } from '../../core/util.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
// materiais só do leste (uma instância por módulo, criada quando o materials.js já está pronto)
const LOCAL = {};
const local = (k, make) => LOCAL[k] || (LOCAL[k] = make());
const std = (o) => new THREE.MeshStandardMaterial(o);
// guarda-corpo de vidro quase invisível (só o reflexo): borda do acelerador
const vidroCerca = () => local('vidroCerca', () => std({ color: 0xe6f5fb, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.3 }));
export function rocha(x, z, s, seed = 1, y = null, mat = null) {
  const g = new THREE.DodecahedronGeometry(1, 1); const p = g.attributes.position; const R = rng(seed * 97 + 5);
  const k = new Map(); for (let i = 0; i < p.count; i++) { const key = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); if (!k.has(key)) k.set(key, 0.75 + R() * 0.5); const f = k.get(key); p.setXYZ(i, p.getX(i) * f, Math.max(-0.2, p.getY(i)) * f * 0.8, p.getZ(i) * f); }
  g.computeVertexNormals(); const m = mesh(g, mat || M.rock); m.scale.set(s, s * (0.7 + R() * 0.5), s * (0.8 + R() * 0.3)); m.rotation.y = R() * 6; m.position.set(x, (y ?? heightAt(x, z)) + s * 0.1, z); return m;
}
function ellShape(cx, cz, rx, rz, rot = 0, n = 64) { const s = new THREE.Shape(); for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; const u = Math.cos(a) * rx, v = Math.sin(a) * rz; const x = cx + u * Math.cos(rot) - v * Math.sin(rot), z = cz + u * Math.sin(rot) + v * Math.cos(rot); i ? s.lineTo(x, -z) : s.moveTo(x, -z); } return s; }
// polígono [x, z] em Shape (mesma convenção de ellShape)
function polyShape(pts) { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); return s; }
function flatShape(shape, mat, y) { const g = new THREE.ShapeGeometry(shape, 48); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); const m = mesh(g, mat, false); m.position.y = y; return m; }
// anel elíptico vertical (paredes, guarda-corpos); uvFac: mapa de fachada na escala dos vãos (BAY x FH)
function ellWall(cx, cz, rx, rz, y0, h, mat, a0 = 0, a1 = Math.PI * 2, seg = 72, side = THREE.DoubleSide, uvFac = false) {
  const pos = [], idx = [], uv = []; let arc = 0, px = 0, pz = 0;
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg; const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz; if (i) arc += Math.hypot(x - px, z - pz); px = x; pz = z;
    pos.push(x, y0, z, x, y0 + h, z); if (i) { const k = i * 2; if (side === THREE.BackSide) idx.push(k - 2, k, k - 1, k - 1, k, k + 1); else idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    if (uvFac) uv.push(arc / (BAY * 32), 0, arc / (BAY * 32), h / (FH * 4)); else { const u = (i / seg) * (rx + rz) * 1.2; uv.push(u, 0, u, 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return mesh(g, side === THREE.DoubleSide ? dupla(mat) : mat);
}
// coroa elíptica horizontal (patamares, lajes de galeria, topo de muretas), normal para cima
function ellFlat(cx, cz, rx0, rz0, rx1, rz1, y, mat, a0 = 0, a1 = Math.PI * 2, seg = 72, cast = false) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg; const c = Math.cos(a), s = Math.sin(a); const x0 = cx + c * rx0, z0 = cz + s * rz0, x1 = cx + c * rx1, z1 = cz + s * rz1;
    pos.push(x0, y, z0, x1, y, z1); nor.push(0, 1, 0, 0, 1, 0); uv.push(x0 / 2.2, z0 / 2.2, x1 / 2.2, z1 / 2.2);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere();
  return mesh(g, mat, cast);
}
// rampa elíptica: coroa com a altura interpolada de y0 (em a0) a y1 (em a1) — deque helicoidal encostado na parede
function ellRampa(cx, cz, rx0, rz0, rx1, rz1, y0, y1, a0, a1, seg, mat) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, a = a0 + (a1 - a0) * t, y = y0 + (y1 - y0) * t; const c = Math.cos(a), s = Math.sin(a);
    pos.push(cx + c * rx0, y, cz + s * rz0, cx + c * rx1, y, cz + s * rz1); uv.push(t * 12, 0, t * 12, 1);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  return mesh(g, mat);
}
// parede baixa que acompanha a rampa (parapeito), y interpolado como em ellRampa
function ellRampaWall(cx, cz, rx, rz, y0, y1, h, a0, a1, seg, mat) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg, a = a0 + (a1 - a0) * t, y = y0 + (y1 - y0) * t; const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz; pos.push(x, y, z, x, y + h, z); uv.push(t * 12, 0, t * 12, 1); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  return mesh(g, dupla(mat));
}
// fitas entre polilinhas 3D (deques em hélice): a orientação de cada quadrilátero segue a normal pretendida (sem uso hoje)
class Fitas {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  strip(P0, P1, nrm, us = 1) {
    const base = this.p.length / 3; let s = 0;
    for (let j = 0; j < P0.length; j++) { if (j) s += Math.hypot(P0[j][0] - P0[j - 1][0], P0[j][1] - P0[j - 1][1], P0[j][2] - P0[j - 1][2]); const nn = nrm(j); this.p.push(...P0[j], ...P1[j]); this.n.push(...nn, ...nn); this.uv.push(s * us, 0, s * us, 1); }
    const P = this.p, N = this.n;
    for (let j = 0; j < P0.length - 1; j++) {
      const a0 = base + j * 2, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3;
      const e1 = [P[b0 * 3] - P[a0 * 3], P[b0 * 3 + 1] - P[a0 * 3 + 1], P[b0 * 3 + 2] - P[a0 * 3 + 2]], e2 = [P[a1 * 3] - P[a0 * 3], P[a1 * 3 + 1] - P[a0 * 3 + 1], P[a1 * 3 + 2] - P[a0 * 3 + 2]];
      const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
      if (cx * N[a0 * 3] + cy * N[a0 * 3 + 1] + cz * N[a0 * 3 + 2] >= 0) this.i.push(a0, b0, a1, b0, b1, a1); else this.i.push(a0, a1, b0, b0, a1, b1);
    }
  }
  geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setIndex(this.i); g.computeBoundingSphere(); g.computeBoundingBox(); return g; }
}
void Fitas;
// triângulos soltos (lista de coordenadas) com a orientação virada para fora de um centro: telhadinhos
function orientar(P, c) {
  for (let i = 0; i < P.length; i += 9) { const ax = P[i + 3] - P[i], ay = P[i + 4] - P[i + 1], az = P[i + 5] - P[i + 2], bx = P[i + 6] - P[i], by = P[i + 7] - P[i + 1], bz = P[i + 8] - P[i + 2]; const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const gx = (P[i] + P[i + 3] + P[i + 6]) / 3 - c[0], gy = (P[i + 1] + P[i + 4] + P[i + 7]) / 3 - c[1], gz = (P[i + 2] + P[i + 5] + P[i + 8]) / 3 - c[2]; if (nx * gx + ny * gy + nz * gz < 0) for (let k = 0; k < 3; k++) { const t = P[i + 3 + k]; P[i + 3 + k] = P[i + 6 + k]; P[i + 6 + k] = t; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
}
// anel de pontos [x, z] de uma elipse (áreas de pessoas, polígonos das manadas)
function anelPts(cx, cz, rx, rz, n, rot = 0, inverso = false) { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU * (inverso ? -1 : 1); const u = Math.cos(a) * rx, v = Math.sin(a) * rz; out.push([+(cx + u * Math.cos(rot) - v * Math.sin(rot)).toFixed(3), +(cz + u * Math.sin(rot) + v * Math.cos(rot)).toFixed(3)]); } return out; }

// ---------------- casca geodésica (usada pela Cúpula da Vida, cupula.js) ----------------
// Casca ovoide baixa: esfera unitária cortada na latitude -k (a parte de baixo curva para dentro), esticada em
// rx/rz no plano e hy na vertical, pousada no anel de concreto a y0. bocas: portais {ang, meia, yMax} (setor de
// ângulo ang ± meia até a latitude yMax); a borda de cada portal sai à parte (lábio grosso).
export function geodome(rx, rz, hy, k, y0, detail = 4, bocas = []) {
  const ico = new THREE.IcosahedronGeometry(1, detail); const p = ico.attributes.position; const tri = []; const edges = new Map(); const fb = Math.sqrt(1 - k * k);
  const V = (i) => [p.getX(i), p.getY(i), p.getZ(i)];
  const tf = ([x, y, z]) => { const yy = Math.max(-k, y); const f = yy > y ? fb / (Math.hypot(x, z) || 1) : 1; return [x * f * rx, (yy + k) * hy + y0, z * f * rz]; };
  const naBoca = (x, y, z) => bocas.some((b) => { if (y > b.yMax) return false; let d = Math.atan2(z * rz, x * rx) - b.ang; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return Math.abs(d) < b.meia; });
  const key = (u, v) => { const k1 = u.map((q) => q.toFixed(3)).join(), k2 = v.map((q) => q.toFixed(3)).join(); return k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1; };
  const daBoca = new Set();
  for (let i = 0; i < p.count; i += 3) {
    const a = V(i), b = V(i + 1), c = V(i + 2); if (Math.max(a[1], b[1], c[1]) < -k + 0.002) continue;
    const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3; const A2 = tf(a), B2 = tf(b), C2 = tf(c);
    if (naBoca(cx, cy, cz)) { for (const [u, v] of [[A2, B2], [B2, C2], [C2, A2]]) daBoca.add(key(u, v)); continue; }
    tri.push(...A2, ...B2, ...C2);
    for (const [u, v] of [[A2, B2], [B2, C2], [C2, A2]]) { const kk = key(u, v); const e = edges.get(kk); if (e) e.n++; else edges.set(kk, { u, v, n: 1 }); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals();
  const all = [], borda = []; for (const [kk, { u, v }] of edges) { all.push([u, v]); if (daBoca.has(kk)) borda.push([u, v]); }
  return { glass: g, edges: all, borda, tf };
}
// ---------------- Vila Estudantil Expandida ----------------
function sector(r0, r1, a0, a1, h, y, mat, seg = 40) {
  const s = new THREE.Shape(); for (let i = 0; i <= seg; i++) { const a = a0 + ((a1 - a0) * i) / seg; const x = Math.cos(a) * r1, z = Math.sin(a) * r1; i ? s.lineTo(x, -z) : s.moveTo(x, -z); }
  for (let i = seg; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / seg; s.lineTo(Math.cos(a) * r0, -Math.sin(a) * r0); }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 4 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  return mesh(g, mat);
}
// perfil em escada [r, y] de N fileiras (piso de cada fileira em (k + 1) dh, do raio r0 ao RA)
function perfilDegraus(r0, RA, N, dh, up = 0) { const dr = (RA - r0) / N; const P = [[r0, 0]]; for (let k = 0; k < N; k++) P.push([r0 + k * dr, (k + 1) * dh + up], [r0 + (k + 1) * dr, (k + 1) * dh + up]); return P; }
// polígono [r, y] posto no plano vertical do ângulo a (ShapeGeometry → malha), com material de dupla face
// lado = 0: dupla face; +1/-1: face única virada para o sentido de ângulo crescente/decrescente
function paredeRadial(poly, a, mat, lado = 0) {
  const sg = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([r, y]) => new THREE.Vector2(r, y)))); const p = sg.attributes.position; const c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < p.count; i++) { const r = p.getX(i), y = p.getY(i); p.setXYZ(i, r * c, y, r * s); }
  if (lado) { const ix = sg.index.array; const n = new THREE.Vector3(), A2 = new THREE.Vector3(), B2 = new THREE.Vector3(), C2 = new THREE.Vector3(); A2.fromBufferAttribute(p, ix[0]); B2.fromBufferAttribute(p, ix[1]); C2.fromBufferAttribute(p, ix[2]); n.subVectors(B2, A2).cross(C2.sub(A2)); if (n.x * -s * lado + n.z * c * lado < 0) for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
  sg.computeVertexNormals(); sg.computeBoundingSphere(); return mesh(sg, lado ? mat : dupla(mat));
}
// Anfiteatro em ferradura (260 graus, boca para sudeste): 12 fileiras de degraus claros uniformes, uma escada
// radial, uma cunha lisa entre dois parapeitos radiais, muro externo alto só no setor leste, mureta fina do
// lado da mata, orquestra plana com tablado, canteiro curvo arborizado na boca e público sentado.
export function anfiteatro() {
  const [cx, cz] = A.anfiteatro.c; const root = new THREE.Group(); root.name = 'anfiteatro'; root.position.set(cx, 0, cz); const ry = -0.75; root.rotation.y = ry; const P = {};
  const a0 = Math.PI * 0.28, a1 = Math.PI * 1.72, c0 = Math.PI * 1.30, c1 = Math.PI * 1.39; // ferradura; cunha lisa entre c0 e c1
  const RA = A.anfiteatro.r, r0 = 1.05, N = 12, dr = (RA - r0) / N, dh = 0.075, topo = N * dh;
  P.e1 = new THREE.Group();
  { // arquibancada: pisos (creme, normal para cima) e espelhos (brancos) numa geometria cada, em dois arcos
    const fp = [], fi = [], fn = [], ep = [], ei = [];
    const arco = (b0, b1, seg) => { for (let k = 0; k < N; k++) { const ri = r0 + k * dr, ro = ri + dr, y = (k + 1) * dh; const bf = fp.length / 3, be = ep.length / 3;
        for (let i = 0; i <= seg; i++) { const a = b0 + ((b1 - b0) * i) / seg, c = Math.cos(a), s = Math.sin(a); fp.push(c * ri, y, s * ri, c * ro, y, s * ro); fn.push(0, 1, 0, 0, 1, 0); ep.push(c * ri, y - dh, s * ri, c * ri, y, s * ri);
          if (i) { const q = bf + i * 2; fi.push(q - 2, q, q - 1, q - 1, q, q + 1); const w = be + i * 2; ei.push(w - 2, w - 1, w, w - 1, w + 1, w); } } } };
    arco(a0, c0, 34); arco(c1, a1, 8);
    const gf = new THREE.BufferGeometry(); gf.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); gf.setAttribute('normal', new THREE.Float32BufferAttribute(fn, 3)); gf.setIndex(fi); gf.computeBoundingSphere(); P.e1.add(mesh(gf, M.cream));
    const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3)); ge.setIndex(ei); ge.computeVertexNormals(); ge.computeBoundingSphere(); P.e1.add(mesh(ge, M.whiteSmooth));
    const perfil = [...perfilDegraus(r0, RA, N, dh), [RA, 0]]; P.e1.add(paredeRadial(perfil, a0, M.cream, 1)); P.e1.add(paredeRadial(perfil, a1, M.cream, -1)); // tampas das pontas (as da cunha ficam atrás dos parapeitos)
  }
  P.e1.add(ellWall(0, 0, RA + 0.02, RA + 0.02, 0, topo, M.cream, a0, c0, 40, THREE.FrontSide)); // tardoz (face única para fora)
  P.e1.add(ellWall(0, 0, RA + 0.06, RA + 0.06, 0, 1.30, M.concreto, c1, a1, 32)); // muro externo alto só no setor leste
  { const g = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(r0, 0), new THREE.Vector2(RA + 0.06, 0), new THREE.Vector2(RA + 0.06, 1.30), new THREE.Vector2(r0, 0.55)]), { depth: 0.08, bevelEnabled: false }); g.translate(0, 0, -0.04); const w = mesh(g, M.concreto); w.rotation.y = -a1; P.e1.add(w); } // parede radial na ponta leste, topo inclinado
  { // cunha lisa inclinada entre dois parapeitos radiais
    const pos = [], idx = []; for (let i = 0; i <= 2; i++) { const a = c0 + ((c1 - c0) * i) / 2, c = Math.cos(a), s = Math.sin(a); pos.push(c * r0, dh, s * r0, c * (RA + 0.06), topo, s * (RA + 0.06)); if (i) { const q = i * 2; idx.push(q - 2, q, q - 1, q - 1, q, q + 1); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere(); P.e1.add(mesh(g, M.bandaCinza));
    const par = [[r0, 0], [RA + 0.06, 0], [RA + 0.06, topo + 0.35], ...perfilDegraus(r0, RA, N, dh, 0.35).slice(1).reverse(), [r0, dh + 0.35]]; for (const a of [c0, c1]) P.e1.add(paredeRadial(par, a, M.whiteSmooth));
  }
  P.e1.add(ellFlat(0, 0, RA + 0.02, RA + 0.02, RA + 0.14, RA + 0.14, 0.92, M.whiteSmooth, a0, c0, 40)); P.e1.add(ellWall(0, 0, RA + 0.14, RA + 0.14, 0.86, 0.06, M.whiteSmooth, a0, c0, 40)); // mureta fina do lado da mata
  P.e1.add(flatShape(ellShape(0, 0, r0, r0), M.pavers, 0.02)); // orquestra
  { // escada radial: 24 subdegraus de 0,0375 numa faixa de 0,12
    const ae = Math.PI * 0.72, pos = [], idx = []; const quad = (r1, y1, r2, y2) => { const b = pos.length / 3; for (const [r, y] of [[r1, y1], [r2, y2]]) { const w = 0.06 / r; for (const da of [-w, w]) pos.push(Math.cos(ae + da) * r, y, Math.sin(ae + da) * r); } idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); };
    for (let k = 0; k < N; k++) for (let j = 0; j < 2; j++) { const rr = r0 + k * dr + (j * dr) / 2, yb = k * dh + (j * dh) / 2, yt = yb + dh / 2; quad(rr, yb, rr, yt + 0.004); quad(rr, yt + 0.004, rr + dr / 2, yt + 0.004); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere(); P.e1.add(mesh(g, dupla(M.whiteSmooth)));
  }
  { // público sentado: 40 caixinhas escuras em grupos, quase todas nos setores oeste e norte, fundidas numa malha
    const bg = new THREE.BoxGeometry(0.06, 0.11, 0.06); const lista = []; const grupos = [3, 4, 3, 2, 4, 3, 3, 4, 2, 3, 4, 5]; const m = new THREE.Matrix4();
    grupos.forEach((n, gi) => { const k = 3 + ((gi * 5) % 9); const ab = Math.PI * (0.55 + 0.9 * hash(gi, 1, 91)); const r = r0 + (k + 0.5) * dr; for (let j = 0; j < n; j++) { const a = ab + (j - (n - 1) / 2) * (0.07 / r) * 1.4; lista.push([bg, m.clone().makeTranslation(Math.cos(a) * r, (k + 1) * dh + 0.055, Math.sin(a) * r)]); } });
    P.e1.add(mesh(merge(lista), M.dark, false));
  }
  { const area = []; for (let i = 0; i < 12; i++) { const a = 1.35 + ((4.93 - 1.35) * i) / 11; const x = Math.cos(a) * 0.95, z = Math.sin(a) * 0.95; area.push([+(cx + x * Math.cos(ry) + z * Math.sin(ry)).toFixed(3), +(cz - x * Math.sin(ry) + z * Math.cos(ry)).toFixed(3)]); } P.e1.userData.pessoas = { area, y: 0.03, n: 14 }; }
  P.e2 = new THREE.Group(); // tablado baixo, canteiro curvo arborizado na boca e três luminárias no muro
  const tab = mesh(new THREE.BoxGeometry(1.2, 0.06, 0.6), M.woodLight); tab.position.set(0.55, 0.03, 0); P.e2.add(tab);
  P.e2.add(sector(1.10, 1.36, -Math.PI * 0.30, Math.PI * 0.30, 0.15, 0, M.cream, 24));
  { const veg = []; for (let i = 0; i < 10; i++) { const a = -0.27 * Math.PI + (0.54 * Math.PI * i) / 9; const r = 1.17 + hash(i, 1, 93) * 0.12; veg.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.15, s: 0.10 + hash(i, 2, 93) * 0.03, kind: 'folhaLow', pal: 'jardim', h: 0.8 }); }
    for (let i = 0; i < 5; i++) { const a = -0.24 * Math.PI + (0.48 * Math.PI * i) / 4; veg.push({ x: Math.cos(a) * 1.23, z: Math.sin(a) * 1.23, y: 0.15, s: 0.25 + hash(i, 3, 93) * 0.07, kind: 'folha', pal: 'jardim', trunk: true, h: 1.1 }); }
    P.e2.add(treeGroup(veg, { trunks: true, name: 'canteiro' })); }
  { const lamps = []; for (const a of [1.45, 1.55, 1.65]) { const x = Math.cos(a * Math.PI) * (RA + 0.06), z = Math.sin(a * Math.PI) * (RA + 0.06); lamps.push([[x, 1.30, z], [x, 1.80, z]]); }
    P.e2.add(beams(lamps, 0.015, M.steelDark, 4)); for (const [, b] of lamps) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), M.lampGlow); l.position.set(...b); P.e2.add(l); } }
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'anfiteatro', root, partes: P, esqueletos: {}, grua: {}, foco: { x: cx + 0.8, z: cz + 0.6, dist: 11 }, ancora: [cx, 1.6, cz] };
}
// Casas da Vila (módulos residenciais, nível 1 a 3): faixa diagonal de 6 caixas de tamanhos diferentes, do
// penhasco (sudoeste) ao Bioma (nordeste): barra da frente de 3 pavimentos com 2 fileiras de 4 janelas,
// casinha de duas águas íngreme, caixas de 2 pavimentos com balanço, bloco do meio e bloco grande de 3
// pavimentos com platibanda e tabuleiro de recortes escuros no telhado. Lajes brancas são a superfície mais
// clara; paredes brancas; janelas escuras mais altas que largas, só nas faces sul e oeste.
const MODS_VILA = [
  { c: [-1.3, 0.5], w: 1.0, d: 0.55, tipo: 'barra' }, { c: [-0.35, 0.55], w: 0.5, d: 0.6, tipo: 'gable' }, { c: [0.5, 0.55], w: 0.8, d: 0.8 },
  { c: [-1.35, -0.5], w: 0.8, d: 0.8 }, { c: [-0.3, -0.5], w: 1.1, d: 0.9 }, { c: [1.05, -0.5], w: 1.4, d: 1.1, tipo: 'grande' },
];
const PISOS_VILA = { barra: 3, gable: 2, grande: 3, caixa: 2 };
export class CasasVila {
  constructor() {
    const v = A.vila; this.group = new THREE.Group(); this.group.name = 'casas'; this.id = 'casas'; this.group.position.set(v.c[0], 0, v.c[1]); this.group.rotation.y = v.rot ?? 0.62;
    const lista = v.mods?.length === 6 ? v.mods : MODS_VILA;
    this.mods = lista.map((m, i) => ({ i, x: m.c[0], z: m.c[1], w: m.w, d: m.d, tipo: m.tipo || 'caixa', pisos: PISOS_VILA[m.tipo || 'caixa'] || 2, nivel: 0, g: null, lado: i % 2 ? 1 : -1, frente: i < 3 ? 1 : -1, escura: true }));
    this.max = 3;
  }
  // caixa do andar f (extensões x0, x1, z0, z1 relativas ao centro do módulo): balanço de 0,2 nos andares 2 e 3, só para fora do aglomerado
  _caixa(m, f) {
    const { w, d } = m; const B = f >= 1 ? 0.2 : 0; const ex = Math.abs(m.x) >= Math.abs(m.z) * 1.6;
    const x0 = -w / 2 - (ex && m.x < 0 ? B : 0), x1 = w / 2 + (ex && m.x > 0 ? B : 0), z0 = -d / 2 - (!ex && m.z < 0 ? B : 0), z1 = d / 2 + (!ex && m.z > 0 ? B : 0);
    return [x0, x1, z0, z1];
  }
  _casa(m, n) {
    const g = new THREE.Group(); const fh = 0.44; const jan = M.dark; const F = Math.min(n, m.pisos);
    const add = (geo, mat, x, y, z, cast = true) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; g.add(o); return o; };
    for (let f = 0; f < F; f++) {
      const [x0, x1, z0, z1] = this._caixa(m, f); const bw = x1 - x0, bd = z1 - z0, mx = m.x + (x0 + x1) / 2, mz = m.z + (z0 + z1) / 2; const yb = f * fh;
      add(new THREE.BoxGeometry(bw, fh, bd), M.white, mx, yb + fh / 2, mz);
      // janelas: mais altas que largas, só nas faces sul (+z) e oeste (-x); a barra com 4 por fileira nos andares 2 e 3, o bloco grande com fendas
      if (m.tipo === 'barra') { if (f >= 1) for (let j = 0; j < 4; j++) add(new THREE.BoxGeometry(0.09, 0.12, 0.012), jan, mx - 0.33 + j * 0.22, yb + 0.24, m.z + z1 + 0.006, false); }
      else if (m.tipo === 'grande') { for (let j = 0; j < 3; j++) add(new THREE.BoxGeometry(0.06, 0.36, 0.012), jan, mx - 0.4 + j * 0.4, yb + 0.22, m.z + z1 + 0.006, false); }
      else { const nz = Math.min(3, Math.max(1, Math.floor(bw / 0.24))), nx = Math.min(3, Math.max(1, Math.floor(bd / 0.24)));
        for (let j = 0; j < nz; j++) add(new THREE.BoxGeometry(0.07, 0.12, 0.012), jan, mx - ((nz - 1) * 0.22) / 2 + j * 0.22, yb + 0.24, m.z + z1 + 0.006, false);
        for (let j = 0; j < nx; j++) add(new THREE.BoxGeometry(0.012, 0.12, 0.07), jan, m.x + x0 - 0.006, yb + 0.24, mz - ((nx - 1) * 0.22) / 2 + j * 0.22, false); }
      add(new THREE.BoxGeometry(bw + 0.04, 0.035, bd + 0.04), M.whiteSmooth, mx, yb + fh, mz); // laje clara em todos os andares
      if (f === F - 1) { // cobertura: recortes escuros (tabuleiro no bloco grande), platibanda no grande, telhado na casinha
        const yt = yb + fh + 0.028;
        if (m.tipo === 'grande') { for (let j = 0; j < 6; j++) add(new THREE.BoxGeometry(0.3, 0.02, 0.3), M.dark, mx - 0.45 + (j % 2) * 0.36, yt, mz - 0.36 + ((j / 2) | 0) * 0.36, false);
          for (const [x, z, w2, d2] of [[0, -bd / 2, bw + 0.04, 0.05], [0, bd / 2, bw + 0.04, 0.05], [-bw / 2, 0, 0.05, bd + 0.04], [bw / 2, 0, 0.05, bd + 0.04]]) add(new THREE.BoxGeometry(w2, 0.08, d2), M.bandaCinza, mx + x, yb + fh + 0.05, mz + z, false); }
        else if (m.tipo === 'barra') add(new THREE.BoxGeometry(0.6, 0.02, 0.2), M.dark, mx + 0.1, yt, mz, false);
        else if (m.i === 4) add(new THREE.BoxGeometry(0.3, 0.02, 0.3), M.dark, mx - 0.2, yt, mz + 0.1, false);
        if (m.tipo === 'gable' && n >= 2) { // telhado de duas águas íngreme: cumeeira 0,38 acima do beiral, empenas brancas com janelinha
          const hw = bw / 2 + 0.04, hd = bd / 2 + 0.04, rp = 0.38; const P0 = [-hw, 0, -hd], P1 = [hw, 0, -hd], P2 = [hw, 0, hd], P3 = [-hw, 0, hd], R0 = [0, rp, -hd], R1 = [0, rp, hd];
          const aguas = orientar([...P0, ...R0, ...P3, ...R0, ...R1, ...P3, ...P1, ...P2, ...R0, ...R0, ...P2, ...R1], [0, rp * 0.3, 0]);
          const emp = orientar([...P0, ...P1, ...R0, ...P3, ...R1, ...P2], [0, rp * 0.3, 0]);
          add(aguas, M.concreto, mx, F * fh, mz); add(emp, M.white, mx, F * fh, mz); add(new THREE.BoxGeometry(0.08, 0.08, 0.012), jan, mx, F * fh + 0.12, mz + hd + 0.006, false);
        }
      }
    }
    if ((m.i === 2 || m.i === 3) && n >= 1) { // anexo baixo de um pavimento no desnível, com um arbusto no terraço
      const sx = m.i === 2 ? 1 : -1; const ax = m.x + sx * (m.w / 2 + 0.225), az = m.z;
      add(new THREE.BoxGeometry(0.45, fh, 0.6), M.white, ax, fh / 2, az); add(new THREE.BoxGeometry(0.49, 0.035, 0.64), M.whiteSmooth, ax, fh, az);
      add(new THREE.IcosahedronGeometry(0.09, 0), M.grassBright, ax + sx * 0.1, fh + 0.09, az + 0.12, false);
    }
    return g;
  }
  setNivel(i, n) { const m = this.mods[i]; if (m.g) this.group.remove(m.g); m.nivel = n; m.g = n > 0 ? this._casa(m, n) : null; if (m.g) this.group.add(m.g); }
  setTodos(n) { for (const m of this.mods) this.setNivel(m.i, n); }
  andar(i, f, F) { const m = this.mods[i]; const full = this._casa(m, F); const acabado = new THREE.Group(); const ch = full.children.filter((c) => c.position.y >= f * 0.44 - 0.01); for (const c of ch) acabado.add(c); return { acabado, esqueleto: null }; }
  centro(i) { const m = this.mods[i]; const v = new THREE.Vector3(m.x, 0, m.z).applyMatrix4(this.group.matrixWorld); return [v.x, v.z]; }
  alturaTopo(n) { return n * 0.44 + 0.1; }
  refresh() {}
}

// ---------------- Acelerador de Partículas Subterrâneo ----------------
// bacia elíptica escavada em creme (dois degraus baixos com faixa clara), rampa helicoidal com corrimãos na parede
// leste, anel azul cobalto com colares brancos sobre plinto branco, injetor reto com galeria de vidro até um portal
// escuro no muro nordeste, detector bronze, caminhão, módulo branco, luminárias globo e o guarda-corpo de vidro em volta
export function acelerador() {
  const a = A.acelerador; const [cx, cz] = a.c; const root = new THREE.Group(); root.name = 'acelerador'; const P = {}; const D = 1.3, NS = 2, st = D / NS, rec = 0.10;
  const rxF = a.rx - (NS - 1) * rec, rzF = a.rz - (NS - 1) * rec; // raio do degrau de baixo
  P.e1 = new THREE.Group(); // escavação: paredes creme, patamar, piso, mureta baixa com banda pavimentada e a rampa helicoidal
  for (let k = 0; k < NS; k++) {
    const rx = a.rx - k * rec, rz = a.rz - k * rec;
    P.e1.add(ellWall(cx, cz, rx, rz, -(k + 1) * st, st, M.sand, 0, TAU, 64, THREE.BackSide));
    P.e1.add(ellWall(cx, cz, rx + 0.006, rz + 0.006, -k * st - 0.05, 0.05, M.fascia, 0, TAU, 64));
    if (k) P.e1.add(ellFlat(cx, cz, rx, rz, rx + rec, rz + rec, -k * st, M.sand, 0, TAU, 64));
  }
  P.e1.add(flatShape(ellShape(cx, cz, rxF, rzF), M.sand, -D));
  P.e1.add(ellWall(cx, cz, a.rx + 0.08, a.rz + 0.08, -0.02, 0.08, M.whiteSmooth, 0, TAU, 64)); P.e1.add(ellFlat(cx, cz, a.rx - 0.01, a.rz - 0.01, a.rx + 0.1, a.rz + 0.1, 0.06, M.whiteSmooth, 0, TAU, 64));
  P.e1.add(ellFlat(cx, cz, a.rx + 0.05, a.rz + 0.05, a.rx + 0.4, a.rz + 0.4, 0.012, M.bandaCinza, 0, TAU, 64));
  { // rampa: deque cinza de rx - 0,42 a rx - 0,10 descendo do nor-nordeste (y 0) ao sudeste (y -D), parapeito interno e dois corrimãos
    const q0 = -1.396, q1 = 0.698, ri = [a.rx - 0.42, a.rz - 0.42], ro = [a.rx - 0.10, a.rz - 0.10];
    P.e1.add(ellRampa(cx, cz, ri[0], ri[1], ro[0], ro[1], 0, -D, q0, q1, 40, M.bandaCinza));
    P.e1.add(ellRampaWall(cx, cz, ri[0], ri[1], 0, -D, 0.12, q0, q1, 40, M.fascia));
    const cor = [], pst = []; const pt = (r, t, dy) => { const an = q0 + (q1 - q0) * t; return [cx + Math.cos(an) * r[0], -D * t + dy, cz + Math.sin(an) * r[1]]; };
    for (let i = 0; i < 20; i++) { const t0 = i / 20, t1 = (i + 1) / 20; cor.push([pt(ri, t0, 0.34), pt(ri, t1, 0.34)], [pt(ro, t0, 0.34), pt(ro, t1, 0.34)]); }
    for (let i = 0; i <= 11; i++) { const t = i / 11; pst.push([pt(ri, t, 0.12), pt(ri, t, 0.34)], [pt(ro, t, 0), pt(ro, t, 0.34)]); }
    P.e1.add(beams(cor, 0.01, M.whiteSmooth, 4)); P.e1.add(beams(pst, 0.01, M.whiteSmooth, 4));
  }
  P.e1.userData.pessoas = { area: [...anelPts(cx, cz, a.rx + 0.40, a.rz + 0.40, 24), ...anelPts(cx, cz, a.rx + 0.12, a.rz + 0.12, 24, 0, true)], y: 0.012, n: 10 };
  // e2: anel azul quase circular com colares brancos regulares sobre plinto branco, e o tubo do injetor
  P.e2 = new THREE.Group(); const ax = cx - 0.1, az = cz + 0.2, Rx = 1.3, Rz = 1.05;
  P.e2.add(ellFlat(ax, az, Rx - 0.17, Rz - 0.17, Rx + 0.17, Rz + 0.17, -D + 0.02, M.whiteSmooth, 0, TAU, 72));
  { const tor = new THREE.TorusGeometry(1, 0.11, 8, 72); tor.rotateX(Math.PI / 2); tor.scale(Rx, 1, Rz); tor.translate(ax, -D + 0.17, az); P.e2.add(mesh(tor, M.blue)); }
  { const up = new THREE.Vector3(0, 1, 0), tg = new THREE.Vector3(); for (let i = 0; i < 24; i++) { const t = (i / 24) * TAU; const f = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 10), M.whiteSmooth); f.position.set(ax + Math.cos(t) * Rx, -D + 0.17, az + Math.sin(t) * Rz); f.quaternion.setFromUnitVectors(up, tg.set(-Math.sin(t) * Rx, 0, Math.cos(t) * Rz).normalize()); P.e2.add(f); } }
  const I0 = [cx - 0.9, cz + 0.75], I1 = [cx + 1.83, cz - 1.09]; const IL = Math.hypot(I1[0] - I0[0], I1[1] - I0[1]), Ic = [(I0[0] + I1[0]) / 2, (I0[1] + I1[1]) / 2], Ir = Math.atan2(-(I1[1] - I0[1]), I1[0] - I0[0]);
  const inj = (w, h, d, mat, y, cast = true) => { const m = mesh(new THREE.BoxGeometry(w, h, d), mat, cast); m.position.set(Ic[0], y, Ic[1]); m.rotation.y = Ir; return m; };
  P.e2.add(inj(IL, 0.03, 0.34, M.whiteSmooth, -D + 0.015)); P.e2.add(inj(IL, 0.16, 0.16, M.blue, -D + 0.12));
  // e3: detector bronze alto com o cilindro azul e a esfera dourada, racks, caminhão branco, módulo branco e luminárias globo
  P.e3 = new THREE.Group();
  { const det = mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.9, 20), M.madeiraClara || M.giraffe); det.position.set(cx - 1.15, -D + 0.45, cz - 0.35); P.e3.add(det);
    const tp = new THREE.TorusGeometry(0.3, 0.04, 6, 20); tp.rotateX(Math.PI / 2); tp.translate(cx - 1.15, -D + 0.9, cz - 0.35); P.e3.add(mesh(tp, M.whiteSmooth));
    const az2 = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 12), M.blue); az2.position.set(cx - 1.45, -D + 0.3, cz - 0.15); P.e3.add(az2);
    const esf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M.lampGlow); esf.position.set(cx - 1.3, -D + 0.35, cz + 0.05); P.e3.add(esf);
    const postes = [[[cx - 1.3, -D, cz + 0.05], [cx - 1.3, -D + 0.3, cz + 0.05]]]; for (const [x, z] of [[cx - 1.9, cz - 0.1], [cx - 1.75, cz + 0.35]]) { postes.push([[x, -D, z], [x, -D + 0.6, z]]); const gl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.lampGlow); gl.position.set(x, -D + 0.64, z); P.e3.add(gl); }
    P.e3.add(beams(postes, 0.012, M.whiteSmooth, 4)); }
  for (let i = 0; i < 6; i++) { const r = mesh(new THREE.BoxGeometry(0.16, 0.3, 0.2), i % 2 ? M.blue : M.whiteSmooth); r.position.set(cx - 1.3 + i * 0.22, -D + 0.15, cz + 1.0); P.e3.add(r); const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.01), M.cyanGlow); s.position.set(r.position.x, -D + 0.22, cz + 1.105); P.e3.add(s); }
  { const cam = new THREE.Group(); cam.position.set(cx + 1.85, -D, cz + 0.3); cam.rotation.y = -0.61; P.e3.add(cam);
    const plat = mesh(new THREE.BoxGeometry(0.6, 0.05, 0.42), M.fascia); plat.position.y = 0.025; cam.add(plat);
    const cor = mesh(new THREE.BoxGeometry(0.5, 0.28, 0.26), M.whiteSmooth); cor.position.set(-0.02, 0.19, 0); cam.add(cor);
    const cab = mesh(new THREE.BoxGeometry(0.16, 0.2, 0.26), M.blue); cab.position.set(0.3, 0.15, 0); cam.add(cab);
    const luz = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.05), M.cyanGlow); luz.position.set(0.3, 0.29, 0); cam.add(luz); }
  { const mod = mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), M.whiteSmooth); mod.position.set(cx + 0.35, -D + 0.09, cz + 0.95); P.e3.add(mod); }
  { const g = new THREE.CircleGeometry(0.5, 24); g.rotateX(-Math.PI / 2); const ap = mesh(g, M.bandaCinza, false); ap.position.set(cx - 1.7, -D + 0.012, cz + 0.4); P.e3.add(ap); }
  // e4: Centro de Física — galeria de vidro do injetor até o portal escuro no muro nordeste e o guarda-corpo de vidro em toda a borda
  P.e4 = new THREE.Group();
  { const vid = inj(IL - 0.3, 0.36, 0.38, M.glass, -D + 0.2, false); vid.renderOrder = 3; P.e4.add(vid); P.e4.add(inj(IL - 0.3, 0.04, 0.4, M.fascia, -D + 0.4));
    const mont = []; for (let i = 0; i < 9; i++) { const t = 0.06 + (0.84 * i) / 8; const x = I0[0] + (I1[0] - I0[0]) * t, z = I0[1] + (I1[1] - I0[1]) * t; const nx = Math.sin(Ir) * 0.19, nz = Math.cos(Ir) * 0.19; mont.push([[x + nx, -D, z + nz], [x + nx, -D + 0.38, z + nz]], [[x - nx, -D, z - nz], [x - nx, -D + 0.38, z - nz]]); } P.e4.add(beams(mont, 0.012, M.whiteSmooth, 4));
    const por = mesh(new THREE.BoxGeometry(0.25, 0.5, 0.5), M.dark); por.position.set(I1[0], -D + 0.25, I1[1]); por.rotation.y = Ir; P.e4.add(por); const ver = mesh(new THREE.BoxGeometry(0.3, 0.06, 0.6), M.fascia); ver.position.set(I1[0], -D + 0.53, I1[1]); ver.rotation.y = Ir; P.e4.add(ver); }
  { const fx = a.rx + 0.14, fz = a.rz + 0.14;
    const rail = ellWall(cx, cz, fx, fz, 0.06, 0.36, vidroCerca(), 0, TAU, 72); rail.castShadow = false; rail.renderOrder = 3; P.e4.add(rail);
    const cor = new THREE.TorusGeometry(1, 0.012, 3, 72); cor.rotateX(Math.PI / 2); cor.scale(fx, 1, fz); cor.translate(cx, 0.42, cz); P.e4.add(mesh(cor, M.whiteSmooth));
    const pt = []; for (let i = 0; i < 20; i++) { const t = (i / 20) * TAU; const x = cx + Math.cos(t) * fx, z = cz + Math.sin(t) * fz; pt.push([[x, 0.02, z], [x, 0.42, z]]); } P.e4.add(beams(pt, 0.01, M.whiteSmooth, 4));
    P.e4.userData.pessoas = { area: [...anelPts(cx, cz, rxF - 0.25, rzF - 0.25, 24), ...anelPts(ax, az, Rx + 0.35, Rz + 0.35, 24, 0, true)], y: -D + 0.03, n: 8 }; }
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'acelerador', root, partes: P, esqueletos: {}, grua: { e4: true }, foco: { x: cx, z: cz + 0.5, dist: 9 }, ancora: [cx, 1.4, cz] };
}
