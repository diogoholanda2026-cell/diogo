// Lado leste da composição, remodelado pela foto limpa: Bioma Aquático (casca ovoide baixa de malha fina com
// grandes círculos, dois portais pequenos, água petróleo deslocada, sebe escura na base e o pasto dos elefantes),
// Vila Estudantil (anfiteatro em ferradura de degraus claros e casas de tamanhos diferentes em faixa diagonal),
// Recinto dos Gorilas (galeria anelar de deque sobre colunas e cerca de vidro deslocada), Acelerador (bacia
// creme com rampa helicoidal, anel azul de colares brancos e injetor reto), Habitats da savana (cercas, muro de
// pedra clara, paliçada e as duas cunhas do Centro de Reabilitação) e o interior do Santuário (margens das
// lagoas, piquete de terra murado e o campo de rúgbi).
import * as THREE from 'three';
import { A, SANTUARIO_GRAMADO } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { beams, curve, sweep, ellipse, normals, terraceProfile, terraceOutline, subPathDenso, pontaFator, merge, BAY, FH } from '../geom.js';
import { matDe } from './faixa.js';
import { deck } from './praca.js';
import { treeGroup } from '../forest.js';
import { Manada, animalGeos, animalMaterial, sombrasContato } from '../animais.js';
import { heightAt } from '../ground.js';
import { hash, rng, TAU, inPoly } from '../../core/util.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
// materiais só do leste (uma instância por módulo, criada quando o materials.js já está pronto)
const LOCAL = {};
const local = (k, make) => LOCAL[k] || (LOCAL[k] = make());
const std = (o) => new THREE.MeshStandardMaterial(o);
// vidro neutro da cúpula (quase incolor, com o reflexo do céu: lavanda de um lado, rosado do outro)
const vidroCupula = () => local('vidroCupula', () => std({ color: 0xdde3ee, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.10, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.0 }));
// guarda-corpo de vidro quase invisível (só o reflexo): borda do acelerador
const vidroCerca = () => local('vidroCerca', () => std({ color: 0xe6f5fb, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.3 }));
// água petróleo fosca do aquário (mesmo mapa de ondas do materials.js), sobre um leito escuro
const aguaAquario = () => local('aguaAquario', () => { const b = M.waterDeep || M.pool || M.water; const m = b.clone(); m.color.set(0x0e6a84); m.transparent = true; m.opacity = 0.72; m.depthWrite = false; m.roughness = 0.35; m.envMapIntensity = 0.25; if (m.emissive) { m.emissive.set(0x000000); m.emissiveIntensity = 0; } return m; });
const leitoAquario = () => local('leitoAquario', () => std({ color: 0x07343d, roughness: 0.95 }));
// rocha clara de maquete (arenito marrom quente, sem o mapa de rocha que escurece demais): escarpa da Vila e rochedos
const rochaClara = () => local('rochaClara', () => { const m = M.sand.clone(); m.color.set(0xcdb08a); m.roughness = 1; return m; });
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
// pousa uma geometria varrida no terreno (cada vértice sobe o heightAt do seu ponto): muros de pedra, margens
function noTerreno(g, dy = 0, minY = -1e9) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.max(minY, heightAt(p.getX(i), p.getZ(i))) + dy); p.needsUpdate = true; g.computeBoundingSphere(); g.computeBoundingBox(); return g; }
// muro de seção retangular (largura w, altura h) ao longo de um caminho, rente ao terreno; o = afastamento lateral do eixo
function muro(path, closed, w, h, mat, o = 0) {
  const E = [{ a: [o - w / 2, 0], b: [o - w / 2, h], mat: 'm', uv: 'run' }, { a: [o - w / 2, h], b: [o + w / 2, h], mat: 'm', uv: 'plan' }, { a: [o + w / 2, h], b: [o + w / 2, 0], mat: 'm', uv: 'run' }];
  return mesh(noTerreno(sweep(path, closed, E, { caps: !closed }).get('m')), mat);
}
// faixa plana rente ao terreno (trilhas claras, margens de pedra): de o0 a o1 do eixo, a y acima do chão
function faixaChao(path, closed, o0, o1, y, mat, minY = -1e9) { return mesh(noTerreno(sweep(path, closed, [{ a: [o0, y], b: [o1, y], mat: 'm', uv: 'plan' }], { caps: false }).get('m'), 0, minY), mat, false); }
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

// ---------------- Bioma Aquático de Conservação ----------------
// Casca ovoide baixa: esfera unitária cortada na latitude -k (a parte de baixo curva para dentro), esticada em
// rx/rz no plano e hy na vertical, pousada no anel de concreto a y0. bocas: portais {ang, meia, yMax} (setor de
// ângulo ang ± meia até a latitude yMax); a borda de cada portal sai à parte (lábio grosso).
function geodome(rx, rz, hy, k, y0, detail = 4, bocas = []) {
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
export function bioma() {
  const [cx, cz] = A.bioma.c;
  const rx = 3.35, rz = 2.85, hy = 2.4, k = 0.28, y0 = 0.30; // casca: raio no plano rx/rz, vertical hy; anel de concreto de 0,30
  const fb = Math.sqrt(1 - k * k), bx = rx * fb, bz = rz * fb; const h = y0 + (1 + k) * hy; // raio da base da casca e altura total (3,37)
  const fCasca = (y) => Math.sqrt(Math.max(0.04, 1 - ((y - y0) / hy - k) ** 2)); // fração do raio da casca na altura y
  const bocas = [{ ang: 0.60, meia: 0.20, yMax: -0.05 }, { ang: 2.85, meia: 0.20, yMax: -0.05 }]; // dois portais pequenos a ~130 graus
  const root = new THREE.Group(); root.name = 'bioma'; root.position.set(cx, 0, cz); const P = {};
  const yLeito = 0.28, yW = y0 + 1.15, ox = 0.28, oz = 0.4; const rW = 0.85 * fCasca(yW); // lâmina d'água deslocada para o sudeste
  const wx = rW * rx, wz = rW * rz;
  // e1: base de concreto, leito escuro, bancos de areia, recife, crescente noroeste plantado, sebe e o muro do pasto
  P.e1 = new THREE.Group();
  P.e1.add(ellWall(0, 0, bx + 0.04, bz + 0.04, 0, y0, M.concreto, 0, TAU, 64));
  P.e1.add(ellFlat(0, 0, bx - 0.10, bz - 0.10, bx + 0.05, bz + 0.05, y0, M.concreto, 0, TAU, 64));
  P.e1.add(flatShape(ellShape(0, 0, bx - 0.09, bz - 0.09), leitoAquario(), yLeito));
  for (const [x, z, a, b] of [[ox - 0.7, oz + 1.45, 0.9, 0.5], [ox + 0.75, oz + 1.55, 0.7, 0.45]]) P.e1.add(flatShape(ellShape(x, z, a, b, 0.3, 24), M.sand, yLeito + 0.02)); // bancos de areia ao sul
  P.e1.add(flatShape(ellShape(ox - 0.3, oz - 1.55, 1.2, 0.35, -0.2, 24), M.sand, yW - 0.10)); // mancha pálida ao norte, perto da lâmina
  for (const [a, sd] of [[-0.4, 531], [0.4, 532]]) { const q = rocha(Math.cos(a) * bx * 0.8, Math.sin(a) * bz * 0.8, 0.45, sd, yLeito, M.rock); q.scale.y *= 0.8; P.e1.add(q); } // recife escuro a leste (abaixo da lâmina)
  { // crescente noroeste: gramado entre a lâmina e a casca, com copas de mata
    const s = new THREE.Shape(); const a0 = 2.6, a1 = 3.7, n = 20;
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; const x = Math.cos(a) * (bx - 0.12), z = Math.sin(a) * (bz - 0.12); i ? s.lineTo(x, -z) : s.moveTo(x, -z); }
    for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; s.lineTo(ox + Math.cos(a) * (wx - 0.03), -(oz + Math.sin(a) * (wz - 0.03))); }
    s.closePath(); P.e1.add(flatShape(s, M.lawn, yLeito + 0.04));
    const arv = []; for (let i = 0; i < 8; i++) { const a = 2.72 + 0.86 * (i / 7) + (hash(i, 2, 77) - 0.5) * 0.08; const r0 = 0.62 + hash(i, 3, 77) * 0.3; const xo = Math.cos(a) * (bx - 0.12), zo = Math.sin(a) * (bz - 0.12), xi = ox + Math.cos(a) * wx, zi = oz + Math.sin(a) * wz; arv.push({ x: xi + (xo - xi) * r0, z: zi + (zo - zi) * r0, y: yLeito + 0.04, s: 0.25 + hash(i, 1, 77) * 0.1, kind: 'folha', pal: 'mata', h: 1 }); }
    P.e1.add(treeGroup(arv, { name: 'crescente' }));
  }
  { // sebe de copas escuras em duas fileiras coladas na base do vidro (pula os portais)
    const seb = []; const livre = (a) => !bocas.some((b) => { let d = a - b.ang; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return Math.abs(d) < 0.26; });
    [[36, 0.45], [24, 0.85]].forEach(([n, off], f) => { for (let i = 0; i < n; i++) { const a = ((i + f * 0.5) / n) * TAU; if (!livre(a)) continue; seb.push({ x: Math.cos(a) * (bx + off), z: Math.sin(a) * (bz + off), y: 0, s: 0.44 + hash(i, f, 88) * 0.12, kind: 'folha', pal: 'mata', h: 1 }); } });
    P.e1.add(treeGroup(seb, { name: 'sebe' }));
  }
  const pa = A.bioma.pasto ?? { c: [24.3, 8.2], rx: 1.8, rz: 0.8 }; // pasto dos elefantes em frente: muro de pedra só no arco norte
  { const mp = muro(ellipse(pa.c[0], pa.c[1], pa.rx, pa.rz, 0, 24, 0, 1, 3.3, 6.1), false, 0.12, 0.12, M.rock); mp.position.set(-cx, 0, -cz); P.e1.add(mp); }
  // e2: malha geodésica fina, duas famílias de grandes círculos, lábio dos portais e o risco claro a leste
  const d = geodome(rx, rz, hy, k, y0, 8, bocas); P.e2 = new THREE.Group();
  P.e2.add(beams(d.edges.filter(([u, v]) => Math.max(u[1], v[1]) >= 0.5), 0.011, M.whiteSmooth, 3));
  { const arcos = []; for (const th of [0.61, -0.61]) { const dv = [Math.cos(th), 0, Math.sin(th)], dp = [-Math.sin(th), 0, Math.cos(th)];
      for (let j = -3; j <= 3; j++) { const ph = (j * 20 * Math.PI) / 180; const e = [dp[0] * Math.sin(ph), Math.cos(ph), dp[2] * Math.sin(ph)]; let prev = null;
        for (let s = 0; s <= 32; s++) { const t = (s / 32) * TAU; const u = [dv[0] * Math.cos(t) + e[0] * Math.sin(t), e[1] * Math.sin(t), dv[2] * Math.cos(t) + e[2] * Math.sin(t)]; const w = u[1] < -k ? null : d.tf(u); if (w && prev && Math.min(w[1], prev[1]) > y0 + 0.3) arcos.push([prev, w]); prev = w; } } }
    P.e2.add(beams(arcos, 0.02, M.whiteSmooth, 3)); }
  { const lab = [...d.borda]; const b = bocas[0]; const a0 = b.ang + b.meia; let pv = null; for (let i = 0; i <= 4; i++) { const a = a0 + (0.8 / bx) * (i / 4); const q = [Math.cos(a) * bx, y0 + 0.04, Math.sin(a) * bz]; if (pv) lab.push([pv, q]); pv = q; } // lábio prolongado 0,8 pela base no portal direito
    P.e2.add(beams(lab, 0.06, M.whiteSmooth, 5)); }
  { const rf = fCasca(1.4) * 0.9; const ra = -0.2; const risco = mesh(new THREE.BoxGeometry(1.0, 0.06, 0.25), M.whiteSmooth); risco.position.set(Math.cos(ra) * rf * rx, 1.4, Math.sin(ra) * rf * rz); risco.rotation.order = 'YXZ'; risco.rotation.set(Math.PI / 4, ra + Math.PI / 2, 0); P.e2.add(risco); }
  // e3: painéis de vidro neutro
  P.e3 = new THREE.Group(); const gl = mesh(d.glass, vidroCupula(), false); gl.renderOrder = 4; P.e3.add(gl); P.e3.userData.semHAO = true;
  // e4: aquário vivo — lâmina petróleo deslocada para o sudeste, baleia clara na lâmina com sombra no leito, cardume — e a manada do pasto
  P.e4 = new THREE.Group();
  const wg = new THREE.CylinderGeometry(rW, rW, yW - yLeito, 40, 1, false); wg.scale(rx, 1, rz); wg.translate(ox, (yW + yLeito) / 2, oz);
  const water = mesh(wg, aguaAquario(), false); water.renderOrder = 2; P.e4.add(water);
  const faunaW = new THREE.Group(); P.e4.add(faunaW);
  const bal = new THREE.InstancedMesh(animalGeos().baleia, animalMaterial(), 1); const px = new THREE.InstancedMesh(animalGeos().peixe, animalMaterial(), 12);
  faunaW.add(bal, px); P.e4.userData.fauna = { bal, px, rx, rz };
  const blobs = sombrasContato(); const b0 = blobs.reservar(1);
  // objetos reaproveitados a cada quadro (nada é alocado no laço)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), p = new THREE.Vector3(), s = new THREE.Vector3();
  const bxw = bx * 0.40, bzw = bz * 0.35;
  const inner = { update(t) {
    const T = t * 0.00012 * 6.28; const ct = Math.cos(T), st = Math.sin(T); const ang = Math.atan2(-bzw * ct, -bxw * st);
    // baleia clara com o dorso na lâmina: rumo pela tangente da elipse e leve inclinação na curva
    e.set(0.06, ang, Math.sin(t * 0.0008) * 0.05); q.setFromEuler(e); p.set(ox + ct * bxw, yW - 0.05, oz + st * bzw); s.setScalar(0.9); bal.setMatrixAt(0, m4.compose(p, q, s)); bal.instanceMatrix.needsUpdate = true;
    if (b0 >= 0) { e.set(0, ang, 0); q.setFromEuler(e); p.set(cx + ox + ct * bxw, yLeito + 0.02, cz + oz + st * bzw); s.set(1.9, 1, 0.75); blobs.mesh.setMatrixAt(b0, m4.compose(p, q, s)); blobs.mesh.instanceMatrix.needsUpdate = true; }
    e.set(0, 0, 0);
    for (let i = 0; i < 12; i++) { const u = t * 0.00012 * 3 + (i % 4) * 0.02 + ((i / 4) | 0) * 0.33; const rr = 0.3 + ((i * 7) % 5) * 0.07; e.y = -u * 6.28 - Math.PI / 2; q.setFromEuler(e); p.set(ox + Math.cos(u * 6.28) * wx * rr + ((i * 13) % 7) * 0.03, yLeito + 0.3 + ((i * 11) % 6) * 0.14, oz + Math.sin(u * 6.28) * wz * rr); s.setScalar(0.8); px.setMatrixAt(i, m4.compose(p, q, s)); } px.instanceMatrix.needsUpdate = true;
  } };
  P.e4.userData.update = inner.update;
  { // manada do pasto (coordenadas de mundo: o grupo desfaz a translação do root); a quarta é o filhote
    const pastoPoly = anelPts(pa.c[0], pa.c[1], pa.rx - 0.2, pa.rz - 0.15, 12);
    const md = new Manada('elefante', 4, pastoPoly, { vel: 0.08, escala: 1.15 }); md.a[3].s = 0.6; md.update(0, 0);
    const g = new THREE.Group(); g.position.set(-cx, 0, -cz); g.add(md.mesh); P.e4.add(g); P.e4.userData.manadas = [md];
  }
  for (const kk of Object.keys(P)) root.add(P[kk]);
  return { id: 'bioma', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: cx, z: cz, dist: 12 }, ancora: [cx, h + 0.6, cz] };
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

// ---------------- Recinto dos Gorilas ----------------
// escarpa contínua de arenito marrom quente: blocos arredondados (sem estratos serrilhados), altura e borda irregulares
function escarpa(linha) {
  const cam = curve(linha, false, Math.max(24, Math.round(linha.length * 8)), 0.5);
  const E = [[0.42, 0], [0.37, 0.45], [0.30, 1.0], [-0.30, 1.0], [-0.37, 0.45], [-0.42, 0]]; // base ±0.42, topo ±0.30
  const ed = []; for (let k = 0; k < E.length - 1; k++) ed.push({ a: E[k], b: E[k + 1], mat: 'r', uv: 'plan' });
  const g = [...sweep(cam, false, ed, { planScale: 1.2 }).values()][0]; const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const alt = 0.45 + 0.25 * (0.5 + 0.5 * Math.sin(x * 0.9 + z * 0.4) * Math.cos(z * 0.7 - x * 0.2)); const nx = (hash(Math.round(x * 7), Math.round(z * 7), 7) - 0.5) * 0.14, nz = (hash(Math.round(z * 7), Math.round(x * 7), 8) - 0.5) * 0.14; p.setXYZ(i, x + nx * (y > 0 ? 1 : 0.4), y * alt + heightAt(x, z), z + nz * (y > 0 ? 1 : 0.4)); }
  g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); return mesh(g, rochaClara());
}
export function gorilas() {
  const g0 = A.gorilas; const [cx, cz] = g0.c; const root = new THREE.Group(); root.name = 'gorilas'; const P = {};
  const fcx = cx - 0.4, fcz = cz, frx = 2.1, frz = 1.75, hf = 1.1; // cerca de vidro deslocada 0,4 para oeste
  const grx = 2.8, grz = 2.3, yg = 1.05; // galeria anelar (anel externo da foto)
  P.e1 = new THREE.Group(); // gramado, rocha pequena a nordeste, rochedo a noroeste, escarpa da Vila com a crista arbustiva e os rochedos
  P.e1.add(flatShape(ellShape(fcx, fcz, frx + 0.05, frz + 0.05), M.lawn, 0.03));
  for (const [x, z, s] of A.rochas || []) P.e1.add(rocha(x, z, s * 0.9, (x * 13) | 0));
  P.e1.add(rocha(fcx + 0.62 * frx, fcz - 0.55 * frz, 0.22, 42, 0.03));
  P.e1.add(rocha(24.1, 15.3, 0.5, 61, 0, rochaClara()));
  if (A.escarpa) {
    P.e1.add(escarpa(A.escarpa));
    // crista a ~0,6 da fachada sul das casas: linha fina de arbustos (sem grama), 3 árvores baixas e 4 rochedos claros
    const cam = curve(A.escarpa, false, 40, 0.5); const nor = normals(cam, false); const vc = A.vila.c; const veg = [];
    const lado = (i) => { const [nx, nz] = nor[i]; const [x, z] = cam[i]; return (vc[0] - x) * nx + (vc[1] - z) * nz > 0 ? 1 : -1; };
    for (let i = 0; i < 8; i++) { const j = 3 + i * 4; const s = lado(j); veg.push({ x: cam[j][0] + nor[j][0] * s * 0.38, z: cam[j][1] + nor[j][1] * s * 0.38, s: 0.10, kind: 'folhaLow', pal: 'jardim', h: 0.8 }); }
    for (const j of [8, 20, 32]) { const s = lado(j); veg.push({ x: cam[j][0] + nor[j][0] * s * 0.42, z: cam[j][1] + nor[j][1] * s * 0.42, s: 0.22, kind: 'folha', pal: 'mata', trunk: true, h: 1 }); }
    P.e1.add(treeGroup(veg, { trunks: true, name: 'crista' }));
    [[5, 51, 0.30], [14, 52, 0.34], [24, 53, 0.28], [35, 54, 0.32]].forEach(([j, sd, s]) => P.e1.add(rocha(cam[j][0], cam[j][1], s, sd, heightAt(cam[j][0], cam[j][1]) + 0.45, rochaClara())));
    const rd = rocha(19.6, 14.2, 0.45, 55, 0, rochaClara()); rd.scale.y *= 1.6; P.e1.add(rd);
  }
  // e2: cerca de vidro com postes finos e topo fosco, galeria anelar de deque escuro sobre colunas claras com corrimão branco, rampa curta ao sul-sudeste
  P.e2 = new THREE.Group();
  P.e2.add(ellWall(fcx, fcz, frx + 0.02, frz + 0.02, 0, 0.1, M.concreto, 0, TAU, 72));
  const fence = ellWall(fcx, fcz, frx, frz, 0.1, hf - 0.1, vidroCerca(), 0, TAU, 72); fence.castShadow = false; fence.renderOrder = 3; P.e2.add(fence);
  { const posts = []; for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; const x = fcx + Math.cos(a) * frx, z = fcz + Math.sin(a) * frz; posts.push([[x, 0.1, z], [x, hf + 0.02, z]]); } P.e2.add(beams(posts, 0.008, M.whiteSmooth, 4)); }
  { const tor = new THREE.TorusGeometry(1, 0.018, 3, 72); tor.rotateX(Math.PI / 2); tor.scale(frx, 1, frz); tor.translate(fcx, hf + 0.02, fcz); P.e2.add(mesh(tor, M.whiteSmooth)); }
  { const sh = ellShape(cx, cz, grx, grz, 0, 96); sh.holes.push(ellShape(fcx, fcz, frx + 0.05, frz + 0.05, 0, 72)); P.e2.add(flatShape(sh, M.ripa || M.dark, yg)); } // deque escuro, como na foto
  P.e2.add(ellWall(cx, cz, grx, grz, yg - 0.1, 0.1, M.whiteSmooth, 0, TAU, 96)); P.e2.add(ellWall(fcx, fcz, frx + 0.05, frz + 0.05, yg - 0.07, 0.07, M.whiteSmooth, 0, TAU, 72));
  { const tor = new THREE.TorusGeometry(1, 0.035, 3, 72); tor.rotateX(Math.PI / 2); tor.scale(grx, 1, grz); tor.translate(cx, yg + 0.13, cz); P.e2.add(mesh(tor, M.whiteSmooth)); }
  { const cols = []; for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU; const x = cx + Math.cos(a) * (grx - 0.06), z = cz + Math.sin(a) * (grz - 0.06); cols.push([[x, -0.02, z], [x, yg - 0.1, z]]); } P.e2.add(beams(cols, 0.012, M.whiteSmooth, 4)); }
  P.e2.add(deck([[27.0, 19.2, 1.05], [26.5, 19.6, 0.55], [25.9, 19.9, 0.08]], 0.5, { jardim: false, borda: 0.09 }));
  P.e2.userData.pessoas = { area: [...anelPts(cx, cz, grx - 0.12, grz - 0.12, 24), ...anelPts(fcx, fcz, frx + 0.2, frz + 0.2, 24, 0, true)], y: yg, n: 8 };
  P.e3 = new THREE.Group(); // árvores encostadas no anel externo (oeste, sudoeste e leste): nenhuma dentro
  { const tr = []; [2.6, 3.15, 3.7, 2.25, -0.4, 0.4].forEach((a, i) => tr.push({ x: cx + Math.cos(a) * (grx + 0.35), z: cz + Math.sin(a) * (grz + 0.35), s: 0.34 + hash(i, 3, 611) * 0.1, pal: 'mata', trunk: true, h: 1.2 })); P.e3.add(treeGroup(tr, { trunks: true })); }
  P.e4 = new THREE.Group(); // família de gorilas: três em pé, um sentado de costas junto à cerca leste e um jovem
  const G = animalGeos(); const sent = G.gorilaSentado; const emPe = [[-0.3, -0.65, 0, 1.3], [-0.85, 0.65, 0.4, 1.25], [1.8, 0.65, 2.36, 1.3], [1.1, -0.15, 4.0, 0.75]];
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const v = new THREE.Vector3(), s3 = new THREE.Vector3();
  const gi = new THREE.InstancedMesh(G.gorila, animalMaterial(), emPe.length); emPe.forEach(([x, z, a, s], i) => gi.setMatrixAt(i, m4.compose(v.set(fcx + x, 0.03, fcz + z), q.setFromEuler(e.set(0, a, 0)), s3.setScalar(s))));
  gi.castShadow = true; gi.receiveShadow = true; P.e4.add(gi);
  if (sent) { const gs = new THREE.InstancedMesh(sent, animalMaterial(), 1); gs.setMatrixAt(0, m4.compose(v.set(fcx + 1.55, 0.03, fcz - 0.5), q.setFromEuler(e.set(0, Math.PI / 2, 0)), s3.setScalar(1.2))); gs.castShadow = true; gs.receiveShadow = true; P.e4.add(gs); }
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'gorilas', root, partes: P, esqueletos: {}, grua: {}, foco: { x: cx - 0.6, z: cz - 0.8, dist: 10 }, ancora: [cx, 2.2, cz] };
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

// ---------------- Habitats Expandidos (savana) ----------------
// cerca de madeira clara (postes e duas travessas) ao longo de uma linha; o = afastamento lateral;
// opções: passo entre postes, altura h, vaos = [[x, z, r]] onde a cerca é interrompida (portões, muro)
function cerca(linha, fechada, posts, rails, off = 0, o = {}) {
  const n0 = linha.length; const pts = fechada ? [...linha, linha[0]] : linha; const passo = o.passo ?? 0.4, h = o.h ?? 0.3, vaos = o.vaos || [];
  const noVao = (x, z) => vaos.some(([vx, vz, r]) => Math.hypot(x - vx, z - vz) < r);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const nx = ((b[1] - a[1]) / L) * off, nz = (-(b[0] - a[0]) / L) * off; const n = Math.max(1, Math.round(L / passo));
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; const x0 = a[0] + (b[0] - a[0]) * t0 + nx, z0 = a[1] + (b[1] - a[1]) * t0 + nz, x1 = a[0] + (b[0] - a[0]) * t1 + nx, z1 = a[1] + (b[1] - a[1]) * t1 + nz; if (noVao((x0 + x1) / 2, (z0 + z1) / 2)) continue; const y0 = heightAt(x0, z0), y1 = heightAt(x1, z1); posts.push([[x0, y0, z0], [x0, y0 + h, z0]]); rails.push([[x0, y0 + h * 0.9, z0], [x1, y1 + h * 0.9, z1]], [[x0, y0 + h * 0.45, z0], [x1, y1 + h * 0.45, z1]]); }
  }
  return n0;
}
// Centro de Reabilitação: duas cunhas de sudoeste para nordeste (a baixa de 1 pavimento ao sul do seu eixo, a alta
// de 2 ao norte do dela), fachada âmbar com faixas creme e teto verde, afinadas na ponta nordeste
function reabilitacao() {
  const g = new THREE.Group(); g.name = 'reabilitacao';
  const prof = { o0: -1.0, o1: 0, setOut: 0.3, setIn: 0, fac: 'fac_ambar', facIn: 'fac_ambar', roof: 'roof', passeio: false };
  const matR = (k) => (k === 'fac_ambar' ? M.fac_ambar || M.fac_fita || matDe('fac_fita') : matDe(k));
  const cunha = (eixo, F, norte) => {
    let path = curve(eixo, false, 16, 0.5); if (norte) path = path.reverse(); // caminho invertido: o lado negativo do perfil cai ao norte
    const { pts, s, L } = subPathDenso(path, false, 0, 1, 0.3, norte ? 0.8 : 0, norte ? 0 : 0.8);
    const wf = (t, i) => pontaFator(norte ? s[i] : L - s[i], 0.8);
    const geos = sweep(pts, false, terraceProfile({ ...prof, floors: F }), { caps: true, capPoly: terraceOutline(F, prof), width: wf, widthCenter: -0.5 });
    for (const [k, ge] of geos) g.add(mesh(ge, matR(k)));
  };
  cunha([[15.8, -1.2], [17.4, -2.0], [18.4, -2.5]], 1, false);
  cunha([[16.3, -1.1], [17.8, -2.0], [18.9, -2.8]], 2, true);
  return g;
}
export function savana() {
  const sv = A.savana, poly = sv.poly; const root = new THREE.Group(); root.name = 'savana'; const P = {};
  const trilhas = A.savanaTrilhas || []; const pertoTrilha = (x, z, m) => trilhas.some((l) => { for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i]; const vx = b[0] - a[0], vz = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz))); if (Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t) < m) return true; } return false; });
  const pedra = M.concretoClaro || M.cream, madeira = M.madeiraClara || M.woodLight;
  P.e1 = new THREE.Group(); // cercados de madeira no contorno e dos dois lados das trilhas, muro de pedra clara e a paliçada alta
  const muroPts = curve([[17.3, 4.8], [20.1, 3.4], [19.6, 2.2], [18.5, 1.4]], false, 30, 0.5);
  const posts = [], rails = []; const op = { passo: 0.5, h: 0.42, vaos: muroPts.filter((_, i) => i % 3 === 0).map(([x, z]) => [x, z, 0.35]) };
  cerca(poly, true, posts, rails, 0, op); for (const l of trilhas) { cerca(l, false, posts, rails, 0.28, op); cerca(l, false, posts, rails, -0.28, op); }
  P.e1.add(beams(posts, 0.03, madeira, 4)); P.e1.add(beams(rails, 0.017, madeira, 4));
  P.e1.add(muro(muroPts, false, 0.3, 0.25, pedra));
  { const tr = []; const Q0 = [17.9, 0.4], Q1 = [19.2, -1.3]; for (let i = 0; i < 30; i++) { const t = i / 29; const x = Q0[0] + (Q1[0] - Q0[0]) * t, z = Q0[1] + (Q1[1] - Q0[1]) * t; const y = heightAt(x, z); tr.push([[x, y - 0.02, z], [x, y + 1.2 + (hash(i, 3, 17) - 0.5) * 0.2, z]]); } P.e1.add(beams(tr, 0.035, madeira, 5)); }
  P.e2 = new THREE.Group(); // rochas, acácias de copa achatada, bebedouro pequeno e o Centro de Reabilitação
  const R = rng(733); const rocks = [[13.4, 0.4, 0.45], [18.6, 3.0, 0.5], [15.6, -1.4, 0.4], [19.3, -1.6, 0.35], [16.8, 4.4, 0.42], [18.9, 2.6, 0.6]]; for (const [x, z, s] of rocks) P.e2.add(rocha(x, z, s, (x * 7) | 0));
  const ac = []; for (let i = 0, t = 0; i < 16 && t < 400; t++) { const x = 12 + R() * 9, z = -2.2 + R() * 8.8; if (!inPoly(x, z, poly) || pertoTrilha(x, z, 0.55) || (x > 15.4 && x < 19.4 && z < -0.6)) continue; ac.push({ x, z, s: 0.32 + R() * 0.2, pal: 'savana', trunk: true, h: 1.6 }); i++; }
  // copa em guarda-chuva: achatada (1/3 da altura) e mais larga, um pouco acima do tronco
  const acG = treeGroup(ac, { trunks: true }); acG.traverse((o) => { if (o.isInstancedMesh && o.userData.kind) { const m = new THREE.Matrix4(); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); m.decompose(p, q, s); s.x *= 1.3; s.z *= 1.3; s.y *= 0.34; p.y += 0.16; m.compose(p, q, s); o.setMatrixAt(i, m); } o.instanceMatrix.needsUpdate = true; } }); P.e2.add(acG);
  { const lg = sv.lago ?? { c: [17.6, 3.4], rx: 0.6, rz: 0.4, rot: 0.2 }; const yl = heightAt(lg.c[0], lg.c[1]); P.e2.add(flatShape(ellShape(lg.c[0], lg.c[1], lg.rx, lg.rz, lg.rot || 0, 32), M.pool, yl + 0.02)); P.e2.add(muro(ellipse(lg.c[0], lg.c[1], lg.rx + 0.04, lg.rz + 0.04, lg.rot || 0, 32), true, 0.08, 0.06, pedra)); }
  P.e2.add(reabilitacao());
  // e3: elefantes / e4: girafas e rinocerontes (animam no mundo), cada espécie no seu piquete
  const pq = sv.piquetes || [poly, poly, poly];
  P.e3 = new THREE.Group(); P.e4 = new THREE.Group();
  P.e3.userData.manadas = [new Manada('elefante', 2, pq[1], { vel: 0.1, escala: 1.25 })];
  P.e4.userData.manadas = [new Manada('girafa', 3, pq[0], { vel: 0.12, escala: 1.1 }), new Manada('rinoceronte', 2, pq[2], { vel: 0.08, escala: 1.3 })];
  for (const m of P.e3.userData.manadas) P.e3.add(m.mesh); for (const m of P.e4.userData.manadas) P.e4.add(m.mesh);
  for (const k of Object.keys(P)) root.add(P[k]);
  const c = poly.reduce((s, [x, z]) => [s[0] + x / poly.length, s[1] + z / poly.length], [0, 0]);
  return { id: 'savana', root, partes: P, esqueletos: {}, grua: {}, foco: { x: c[0], z: c[1], dist: 13 }, ancora: [c[0], 1.6, c[1]] };
}

// ---------------- Santuário: interior (margens das lagoas, piquete murado, campo) e a fauna do piquete ----------------
export function santuarioInterior() {
  const s = A.santuario; const L = s.lago || { c: [21.5, -9.7], rx: 1.0, rz: 0.85, rot: 0.3 }; const L2 = s.lago2 || { c: [21.7, -11.6], rx: 1.45, rz: 0.7, rot: -0.1 };
  const piq = s.piquete || [[19.9, -5.0], [21.0, -6.4], [22.1, -6.3], [22.7, -4.5], [22.7, -2.7], [22.2, -0.4], [21.6, 0.1], [20.6, -0.8], [19.7, -3.0]];
  const root = new THREE.Group(); root.name = 'santuarioInt'; const P = {}; const pedra = M.concretoClaro || M.caminhoTeto;
  P.e1 = new THREE.Group(); // margens de pedra clara das duas lagoas, rochas na beira da lagoa sul, o piquete de terra e o campo
  for (const lg of [L, L2]) P.e1.add(faixaChao(ellipse(lg.c[0], lg.c[1], lg.rx + 0.02, lg.rz + 0.02, lg.rot || 0, 48), true, -0.03, 0.14, 0.02, pedra, 0));
  const cr = Math.cos(L.rot || 0), sr = Math.sin(L.rot || 0);
  for (const [a, k, sc] of [[3.3, 1.08, 0.3], [0.15, 1.1, 0.26], [4.6, 1.06, 0.22], [1.9, 1.08, 0.24]]) { const u = Math.cos(a) * L.rx * k, v = Math.sin(a) * L.rz * k; const x = L.c[0] + u * cr - v * sr, z = L.c[1] + u * sr + v * cr; P.e1.add(rocha(x, z, sc, (x * 11) | 0)); }
  { // piquete: muro de pedra clara no sul e no oeste, trilha clara no norte e no leste, rochedo, poça e copas
    const n = piq.length; const idx = (k) => piq[((k % n) + n) % n];
    P.e1.add(muro([5, 6, 7, 8, 9, 10].map(idx), false, 0.3, 0.25, pedra));
    P.e1.add(faixaChao([1, 2, 3, 4, 5].map(idx), false, -0.08, 0.07, 0.015, M.caminhoTeto));
    const rd = rocha(21.0, -6.2, 0.5, 71, 0, M.rock); rd.scale.x *= 1.3; rd.scale.y *= 0.8; P.e1.add(rd);
    P.e1.add(flatShape(ellShape(21.8, -2.0, 0.28, 0.2, 0.3, 24), M.pool, 0.02));
    const seg = (x, z, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz))); return Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t); };
    const longe = (x, z) => piq.every((p, i) => seg(x, z, p, idx(i + 1)) > 0.5);
    const R = rng(4711); const copas = []; for (let i = 0, t = 0; i < 9 && t < 300; t++) { const x = 19.7 + R() * 3.0, z = -6.4 + R() * 6.5; if (!inPoly(x, z, piq) || !longe(x, z) || Math.hypot(x - 21.8, z + 2.0) < 0.5) continue; copas.push({ x, z, s: 0.3 + R() * 0.1, pal: 'jardim', trunk: true, h: 1.2 }); i++; }
    P.e1.add(treeGroup(copas, { trunks: true, name: 'piquete' }));
  }
  const [gc, grx, grz, grot] = SANTUARIO_GRAMADO.elipse; P.e1.userData.pessoas = { area: anelPts(gc[0], gc[1], grx * 0.85, grz * 0.85, 16, grot || 0), y: 0.03, n: 6 };
  P.e2 = new THREE.Group(); // fauna resgatada: elefantes e rinocerontes no piquete de terra
  P.e2.userData.manadas = [new Manada('elefante', 2, piq, { vel: 0.08, escala: 1.2 }), new Manada('rinoceronte', 2, piq, { vel: 0.07, escala: 1.25 })];
  for (const m of P.e2.userData.manadas) P.e2.add(m.mesh);
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'santuarioInt', root, partes: P, esqueletos: {}, grua: {}, foco: { x: s.c[0] - 1, z: s.c[1] - 2, dist: 18 }, ancora: [L.c[0], 2, L.c[1]] };
}
