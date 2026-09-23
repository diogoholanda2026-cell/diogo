// Árvores instanciadas: floresta ao redor da arcologia (em blocos para descarte por visão),
// e grupos de árvores de paisagismo usados pelos modelos (praças, pátios, savana).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MESA, A } from '../data/planta.js';
import { hash, vnoise, fbm, clamp, rng, inPoly } from '../core/util.js';
import { isForest, heightAt, clearance } from './ground.js';

// ---------- geometrias base (compartilhadas) ----------
let GEO = null;
function noise3(x, y, z, s) { return vnoise(x * 3 + z * 1.7, y * 3 - z * 2.3, 1, s) * 0.6 + vnoise(x * 7 - y * 2, z * 7 + y, 1, s + 9) * 0.4; }
function canopyGeo(seed, detail = 1, lump = 0.28) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position; const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = noise3(x, y, z, seed); const k = 1 + (n - 0.5) * 2 * lump;
    x *= k; z *= k; y = y * k * 0.78 + 0.1; if (y < -0.35) y = -0.35 + (y + 0.35) * 0.4; // base achatada
    p.setXYZ(i, x, y, z);
    const t = clamp((y + 0.4) / 1.3, 0, 1); const sp = 0.86 + hash(i, seed, 5) * 0.28;
    const v = (0.42 + 0.66 * t) * sp; col[i * 3] = v * 0.94; col[i * 3 + 1] = v; col[i * 3 + 2] = v * 0.9;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  // inclina as normais para cima: copa mais "macia" sob a luz
  const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) { const x = nn.getX(i), y = nn.getY(i) + 0.35, z = nn.getZ(i); const l = Math.hypot(x, y, z); nn.setXYZ(i, x / l, y / l, z / l); }
  return g;
}
function coniferGeo() {
  const parts = []; const tiers = [[0.62, 0.9, 0.0], [0.48, 0.8, 0.5], [0.3, 0.7, 0.95]];
  for (const [r, h, y] of tiers) { const c = new THREE.ConeGeometry(r, h, 7, 1, true); c.translate(0, y + h / 2, 0); parts.push(c); }
  const g = mergeGeos(parts);
  const p = g.attributes.position; const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const t = clamp(p.getY(i) / 1.6, 0, 1); const v = 0.45 + 0.5 * t; col[i * 3] = v * 0.85; col[i * 3 + 1] = v; col[i * 3 + 2] = v * 0.92; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function palmGeo() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2; const f = new THREE.PlaneGeometry(0.16, 0.9, 1, 3); f.translate(0, 0.45, 0);
    const p = f.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setZ(k, -y * y * 0.35); }
    f.rotateX(-Math.PI / 2 + 0.5); f.rotateY(a); parts.push(f);
  }
  const g = mergeGeos(parts); const p = g.attributes.position; const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = 0.75 + hash(i, 3, 3) * 0.25; col[i * 3] = v * 0.9; col[i * 3 + 1] = v; col[i * 3 + 2] = v * 0.8; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}
function mergeGeos(list) {
  let n = 0, ni = 0; for (const g of list) { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), I = []; let o = 0;
  for (const g of list) {
    if (!g.attributes.normal) g.computeVertexNormals();
    P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3);
    if (g.index) for (const i of g.index.array) I.push(i + o); else for (let i = 0; i < g.attributes.position.count; i++) I.push(i + o);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setIndex(I); return out;
}
export function treeGeos() {
  if (GEO) return GEO;
  const trunk = new THREE.CylinderGeometry(0.05, 0.08, 1, 5, 1, true); trunk.translate(0, 0.5, 0);
  GEO = { folha: canopyGeo(3, 1), folha2: canopyGeo(11, 1, 0.34), folhaLow: canopyGeo(5, 0, 0.2), conifera: coniferGeo(), palmeira: palmGeo(), tronco: trunk };
  return GEO;
}

// ---------- material das copas com leve balanço ao vento ----------
let LEAF = null, TRUNK = null; export const windU = { value: 0 };
export function leafMaterial() {
  if (LEAF) return LEAF;
  LEAF = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.88, metalness: 0, envMapIntensity: 0.35 });
  LEAF.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float sw = sin(uWind * 1.3 + ip.x * 0.7 + ip.z * 0.9) * 0.035 + sin(uWind * 2.9 + ip.x * 1.9) * 0.012;
          transformed.x += sw * max(position.y + 0.3, 0.0); transformed.z += sw * 0.6 * max(position.y + 0.3, 0.0);
        #endif`);
  };
  LEAF.customProgramCacheKey = () => 'leafwind';
  return LEAF;
}
export function trunkMaterial() { if (!TRUNK) TRUNK = new THREE.MeshStandardMaterial({ color: 0x4d3626, roughness: 0.95 }); return TRUNK; }

// paletas de verde (instanceColor multiplica a cor de vértice)
const VERDES = { // albedo linear
  mata: [[0.035, 0.075, 0.022], [0.028, 0.062, 0.02], [0.05, 0.095, 0.028], [0.062, 0.085, 0.022], [0.03, 0.07, 0.04], [0.07, 0.098, 0.03]],
  jardim: [[0.07, 0.16, 0.04], [0.05, 0.13, 0.035], [0.09, 0.18, 0.05], [0.11, 0.17, 0.04]],
  outono: [[0.16, 0.1, 0.03], [0.2, 0.08, 0.03], [0.13, 0.12, 0.04]],
  savana: [[0.1, 0.14, 0.04], [0.13, 0.15, 0.05], [0.08, 0.12, 0.04]],
  conifera: [[0.018, 0.05, 0.025], [0.014, 0.04, 0.02], [0.025, 0.06, 0.03]],
};

// Cria um grupo instanciado a partir de uma lista de árvores [{x,z,y?,s,h?,kind,pal,rot}]
export function treeGroup(list, opts = {}) {
  const G = treeGeos(); const g = new THREE.Group(); g.name = opts.name || 'arvores';
  const by = new Map();
  for (const t of list) { const k = t.kind || 'folha'; if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const trunks = [];
  for (const [k, arr] of by) {
    const geo = G[k] || G.folha;
    const im = new THREE.InstancedMesh(geo, leafMaterial(), arr.length);
    arr.forEach((t, i) => {
      const s = t.s || 0.5; const h = t.h || 1; const y = t.y ?? heightAt(t.x, t.z);
      let lift = k === 'conifera' ? 0.25 * s : k === 'palmeira' ? 1.5 * s * h : (0.75 * s) * h;
      e.set((hash(i, 7, 3) - 0.5) * 0.25, t.rot ?? hash(i, 9, 3) * 6.28, (hash(i, 8, 3) - 0.5) * 0.25); q.setFromEuler(e);
      pos.set(t.x, y + lift, t.z); sc.set(s * (0.9 + hash(i, 1, 5) * 0.2), s * (k === 'conifera' ? 1.6 * h : 1) , s * (0.9 + hash(i, 2, 5) * 0.2));
      im.setMatrixAt(i, m4.compose(pos, q, sc));
      const pal = VERDES[t.pal || (k === 'conifera' ? 'conifera' : 'mata')]; const c = pal[(hash(i, 4, 11) * pal.length) | 0]; const v = 0.85 + hash(i, 5, 11) * 0.3;
      col.setRGB(c[0] * v * 1.15, c[1] * v * 1.15, c[2] * v * 1.15); im.setColorAt(i, col);
      if (t.trunk || k === 'palmeira' || (k === 'folha' && opts.trunks)) trunks.push({ x: t.x, z: t.z, y, len: k === 'palmeira' ? 1.55 * s * h : lift, r: k === 'palmeira' ? 0.6 : 1 });
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = opts.cast ?? true; im.receiveShadow = true; im.computeBoundingSphere(); im.userData.kind = k;
    g.add(im);
  }
  if (trunks.length) {
    const im = new THREE.InstancedMesh(G.tronco, trunkMaterial(), trunks.length);
    trunks.forEach((t, i) => { pos.set(t.x, t.y, t.z); q.identity(); sc.set(t.r, t.len, t.r); im.setMatrixAt(i, m4.compose(pos, q, sc)); });
    im.instanceMatrix.needsUpdate = true; im.castShadow = opts.cast ?? true; im.receiveShadow = true; im.computeBoundingSphere(); g.add(im);
  }
  return g;
}

// ---------- floresta da mesa ----------
export class Forest {
  constructor(engine) {
    this.e = engine; this.group = new THREE.Group(); this.group.name = 'floresta'; engine.scene.add(this.group);
    this.chunks = []; this.canteiro = null; this.cast = false;
    this._build();
  }
  _build() {
    const step = 0.56; const R = rng(4242); const trees = []; const cant = [];
    for (let z = MESA.z0 + 0.35; z < MESA.z1 - 0.3; z += step) {
      for (let x = MESA.x0 + 0.35; x < MESA.x1 - 0.3; x += step) {
        const jx = x + (R() - 0.5) * step * 0.9, jz = z + (R() - 0.5) * step * 0.9;
        const inCant = inPoly(jx, jz, A.canteiro.poly);
        if (!inCant && !isForest(jx, jz)) continue;
        const dens = fbm(jx, jz, 6, 21, 3);
        if (dens < 0.33 && R() < 0.6) continue; // pequenas falhas na mata
        const edge = inCant ? 2 : clamp(clearance(jx, jz), 0, 3);
        const big = 0.34 + dens * 0.26 + R() * 0.1; const s = big * (0.7 + 0.3 * clamp(edge / 1.5, 0, 1));
        const back = jz < -16.5 || jx > 29.5 || jx < -29.5; // bordas: mais coníferas (como no fundo da foto)
        const kind = back && R() < 0.45 ? 'conifera' : R() < 0.5 ? 'folha' : 'folha2';
        const t = { x: jx, z: jz, s, kind, pal: kind === 'conifera' ? 'conifera' : R() < 0.006 ? 'outono' : 'mata', h: 0.9 + R() * 0.35 };
        (inCant ? cant : trees).push(t);
      }
    }
    // blocos de 16 x 10 unidades (descarte por visão)
    const CW = 16, CD = 10; const map = new Map();
    for (const t of trees) { const k = Math.floor((t.x - MESA.x0) / CW) + ',' + Math.floor((t.z - MESA.z0) / CD); if (!map.has(k)) map.set(k, []); map.get(k).push(t); }
    for (const list of map.values()) { const g = treeGroup(list, { name: 'mata', cast: this.cast }); this.group.add(g); this.chunks.push(g); }
    this.count = trees.length;
    this.canteiro = treeGroup(cant, { name: 'reflorestamento', cast: this.cast }); this.canteiro.visible = false; this.group.add(this.canteiro);
    this.canteiroN = cant.length;
  }
  setShadows(on) { this.cast = on; this.group.traverse((o) => { if (o.isInstancedMesh) o.castShadow = on; }); this.e.shadowDirty = true; }
  // crescimento do reflorestamento do canteiro (0..1)
  setReflorestamento(k) {
    this.canteiro.visible = k > 0.001;
    this.canteiro.scale.setScalar(1); this.canteiro.traverse((o) => { if (o.isInstancedMesh) o.material = leafMaterial(); });
    this.canteiro.position.y = -(1 - k) * 1.4; this.e.shadowDirty = true;
  }
  update(t) { windU.value = t / 1000; }
}
