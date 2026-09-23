// Animais estilizados em baixa contagem de polígonos (uma geometria com cores por vértice por espécie)
// e manadas instanciadas que pastam, andam devagar e param dentro de uma área.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { inPoly, hash } from '../core/util.js';
import { heightAt } from './ground.js';

function colorize(g, c) { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function join(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
  for (const g of list) { if (!g.attributes.normal) g.computeVertexNormals(); P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3)); out.computeBoundingSphere(); return out;
}
const T = (g, x, y, z) => { g.translate(x, y, z); return g; };
const ell = (rx, ry, rz, seg = 10) => { const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg - 3)); g.scale(rx, ry, rz); return g; };
const cyl = (r0, r1, h, seg = 7) => new THREE.CylinderGeometry(r0, r1, h, seg);
function limb(a, b, r0, r1, seg = 6) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const d = B.clone().sub(A); const L = d.length(); const g = new THREE.CylinderGeometry(r1, r0, L, seg); g.translate(0, L / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.applyQuaternion(q); g.translate(A.x, A.y, A.z); return g; }

// todas as espécies voltadas para +x, com os pés em y = 0
let GEOS = null;
export function animalGeos() {
  if (GEOS) return GEOS;
  const cinza = [0.42, 0.4, 0.39], cinzaE = [0.32, 0.3, 0.3], marfim = [0.92, 0.88, 0.78];
  const eleph = [];
  eleph.push(colorize(T(ell(0.36, 0.26, 0.24), 0, 0.42, 0), cinza));
  eleph.push(colorize(T(ell(0.17, 0.17, 0.15), 0.36, 0.52, 0), cinza));
  for (const s of [-1, 1]) eleph.push(colorize(T(ell(0.03, 0.15, 0.13), 0.3, 0.53, s * 0.16), cinzaE));
  eleph.push(colorize(limb([0.48, 0.5, 0], [0.62, 0.24, 0], 0.06, 0.035), cinza)); eleph.push(colorize(limb([0.62, 0.24, 0], [0.64, 0.08, 0], 0.035, 0.03), cinza));
  for (const s of [-1, 1]) eleph.push(colorize(limb([0.46, 0.42, s * 0.07], [0.6, 0.36, s * 0.1], 0.02, 0.01), marfim));
  for (const [x, z] of [[0.2, 0.12], [0.2, -0.12], [-0.2, 0.12], [-0.2, -0.12]]) eleph.push(colorize(limb([x, 0.36, z], [x, 0, z], 0.075, 0.07), cinza));
  eleph.push(colorize(limb([-0.35, 0.45, 0], [-0.44, 0.25, 0], 0.015, 0.01), cinzaE));
  const gir = []; const am = [0.82, 0.6, 0.3], mar = [0.45, 0.28, 0.14];
  gir.push(colorize(T(ell(0.26, 0.15, 0.13), 0, 0.72, 0), am));
  gir.push(colorize(limb([0.18, 0.78, 0], [0.42, 1.36, 0], 0.07, 0.045), am));
  gir.push(colorize(T(ell(0.1, 0.06, 0.055), 0.47, 1.38, 0), am));
  for (const s of [-1, 1]) gir.push(colorize(limb([0.42, 1.42, s * 0.03], [0.41, 1.5, s * 0.035], 0.012, 0.01), mar));
  for (const [x, z] of [[0.16, 0.08], [0.16, -0.08], [-0.16, 0.08], [-0.16, -0.08]]) gir.push(colorize(limb([x, 0.66, z], [x, 0, z], 0.035, 0.025), am));
  for (let i = 0; i < 9; i++) gir.push(colorize(T(ell(0.035, 0.03, 0.036, 6), -0.15 + (i % 3) * 0.14, 0.78 + ((i / 3) | 0) * 0.04 - 0.04, (i % 2 ? 1 : -1) * 0.12), mar));
  const rino = []; const rc = [0.5, 0.47, 0.44];
  rino.push(colorize(T(ell(0.3, 0.17, 0.15), 0, 0.27, 0), rc)); rino.push(colorize(T(ell(0.14, 0.1, 0.09), 0.3, 0.24, 0), rc));
  rino.push(colorize(limb([0.4, 0.26, 0], [0.47, 0.38, 0], 0.03, 0.005), marfim)); rino.push(colorize(limb([0.34, 0.3, 0], [0.37, 0.36, 0], 0.02, 0.004), marfim));
  for (const [x, z] of [[0.16, 0.08], [0.16, -0.08], [-0.16, 0.08], [-0.16, -0.08]]) rino.push(colorize(limb([x, 0.22, z], [x, 0, z], 0.05, 0.045), rc));
  const gor = []; const gc = [0.1, 0.095, 0.1], gp = [0.2, 0.18, 0.18];
  gor.push(colorize(T(ell(0.32, 0.36, 0.3), 0, 0.5, 0), gc)); gor.push(colorize(T(ell(0.26, 0.2, 0.26), 0.02, 0.78, 0), gc));
  gor.push(colorize(T(ell(0.14, 0.15, 0.14), 0.16, 0.92, 0), gc)); gor.push(colorize(T(ell(0.08, 0.08, 0.1), 0.26, 0.88, 0), gp));
  for (const s of [-1, 1]) { gor.push(colorize(limb([0.08, 0.8, s * 0.27], [0.24, 0.02, s * 0.32], 0.1, 0.08), gc)); gor.push(colorize(limb([-0.12, 0.3, s * 0.16], [0.02, 0.0, s * 0.2], 0.1, 0.09), gc)); }
  const baleia = []; const az = [0.28, 0.36, 0.44], br = [0.85, 0.87, 0.88];
  baleia.push(colorize(T(ell(0.9, 0.24, 0.26, 12), 0, 0, 0), az)); baleia.push(colorize(T(ell(0.7, 0.12, 0.2, 10), 0.1, -0.12, 0), br));
  { const t = new THREE.ConeGeometry(0.28, 0.1, 3); t.rotateZ(Math.PI / 2); t.scale(1, 1, 1.6); baleia.push(colorize(T(t, -0.98, 0.02, 0), az)); }
  for (const s of [-1, 1]) baleia.push(colorize(T(ell(0.22, 0.03, 0.08, 6), 0.3, -0.12, s * 0.28), az));
  const arraia = []; { const g = new THREE.ConeGeometry(0.35, 0.05, 4); g.rotateY(Math.PI / 4); g.scale(1, 1, 1.5); arraia.push(colorize(g, [0.3, 0.3, 0.34])); arraia.push(colorize(limb([-0.2, 0, 0], [-0.6, 0, 0], 0.01, 0.004), [0.3, 0.3, 0.34])); }
  const peixe = []; peixe.push(colorize(T(ell(0.08, 0.035, 0.02, 6), 0, 0, 0), [1, 0.62, 0.2])); { const t = new THREE.ConeGeometry(0.04, 0.05, 3); t.rotateZ(Math.PI / 2); peixe.push(colorize(T(t, -0.1, 0, 0), [1, 0.62, 0.2])); }
  GEOS = { elefante: join(eleph), girafa: join(gir), rinoceronte: join(rino), gorila: join(gor), baleia: join(baleia), arraia: join(arraia), peixe: join(peixe) };
  return GEOS;
}
let MAT = null;
export function animalMaterial() { if (!MAT) MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85 }); return MAT; }

// Manada: instâncias que se movem devagar para pontos aleatórios dentro de um polígono.
export class Manada {
  constructor(especie, n, area, o = {}) {
    this.area = area; this.o = o; this.escala = o.escala || 1;
    this.mesh = new THREE.InstancedMesh(animalGeos()[especie], animalMaterial(), n); this.mesh.castShadow = o.sombra ?? true; this.mesh.receiveShadow = true;
    this.a = []; const bb = area.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [1e9, 1e9, -1e9, -1e9]); this.bb = bb;
    for (let i = 0; i < n; i++) { const p = this._rand(i * 7 + 1); this.a.push({ x: p[0], z: p[1], tx: p[0], tz: p[1], ang: hash(i, 3, 5) * 6.28, wait: hash(i, 4, 5) * 6, v: (o.vel || 0.12) * (0.7 + hash(i, 5, 5) * 0.6), s: (0.85 + hash(i, 6, 5) * 0.3) * this.escala, y: o.y }); }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this.k = 0;
    this.update(0, 0);
  }
  _rand(seed) { const [x0, z0, x1, z1] = this.bb; for (let k = 0; k < 40; k++) { const x = x0 + Math.random() * (x1 - x0), z = z0 + Math.random() * (z1 - z0); if (inPoly(x, z, this.area)) return [x, z]; } return [(x0 + x1) / 2, (z0 + z1) / 2]; }
  update(dt, t) {
    for (let i = 0; i < this.a.length; i++) {
      const a = this.a[i];
      if (a.wait > 0) a.wait -= dt; else {
        const dx = a.tx - a.x, dz = a.tz - a.z; const d = Math.hypot(dx, dz);
        if (d < 0.05) { a.wait = 3 + Math.random() * 8; const p = this._rand(i); a.tx = p[0]; a.tz = p[1]; }
        else { const want = Math.atan2(-dz, dx); let da = want - a.ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; a.ang += da * Math.min(1, dt * 1.5); if (Math.abs(da) < 0.6) { a.x += Math.cos(a.ang) * a.v * dt; a.z -= Math.sin(a.ang) * a.v * dt; } }
      }
      const y = a.y ?? heightAt(a.x, a.z);
      this._e.set(0, a.ang, 0); this._q.setFromEuler(this._e); this._p.set(a.x, y + (this.o.flutua ? Math.sin(t * 0.001 + i) * 0.05 : 0), a.z); this._s.setScalar(a.s);
      this.mesh.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
