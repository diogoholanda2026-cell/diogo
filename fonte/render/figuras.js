// Figuras em escala (pessoas, operários) com cor por instância aplicada só às roupas.
// Escala: 1 andar (FH) ~ 3 m, então uma pessoa de 1,75 m tem ~0,27 unidades.
import * as THREE from 'three';

function part(g, col, mask) {
  const n = g.attributes.position.count; const c = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { c[i * 4] = col[0]; c[i * 4 + 1] = col[1]; c[i * 4 + 2] = col[2]; c[i * 4 + 3] = mask; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 4)); if (g.attributes.uv) g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g;
}
function join(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 4); let o = 0;
  for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 4); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 4)); out.computeBoundingSphere(); return out;
}
const SKIN = [0.62, 0.45, 0.34], DARK = [0.08, 0.08, 0.1];
let G = null;
export function figureGeos() {
  if (G) return G;
  const H = 0.27;
  const legs = (w) => { const a = new THREE.BoxGeometry(0.028, H * 0.46, 0.03); a.translate(-0.018, H * 0.23, 0); const b = a.clone(); b.translate(0.036, 0, 0); return [part(a, DARK, 0), part(b, DARK, 0)]; };
  const torso = () => { const t = new THREE.CapsuleGeometry(0.03, H * 0.2, 2, 6); t.scale(1, 1, 0.7); t.translate(0, H * 0.62, 0); return part(t, [1, 1, 1], 1); };
  const head = () => { const h = new THREE.SphereGeometry(0.026, 6, 5); h.translate(0, H * 0.9, 0); return part(h, SKIN, 0); };
  const helmet = () => { const h = new THREE.SphereGeometry(0.03, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2); h.translate(0, H * 0.92, 0); return part(h, [0.95, 0.78, 0.1], 0); };
  const vest = () => { const v = new THREE.BoxGeometry(0.066, H * 0.16, 0.05); v.translate(0, H * 0.64, 0); return part(v, [1.0, 0.42, 0.08], 0); };
  // figura de longe (24 triângulos contra 132): pernas num prisma aberto de 3 faces, tronco em caixa sem
  // fundo e cabeça em octaedro; abaixo de ~12 px de altura não se distingue da figura inteira
  const semFundo = (g, topo) => { g = g.toNonIndexed(); const p = g.attributes.position.array, n = g.attributes.normal.array, P = [], N = [];
    for (let i = 0; i < p.length; i += 9) { const ny = n[i + 1]; if (ny < -0.5 || (!topo && ny > 0.5)) continue; P.push(...p.slice(i, i + 9)); N.push(...n.slice(i, i + 9)); }
    const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return o; };
  const pernasL = () => { const a = new THREE.CylinderGeometry(0.036, 0.03, H * 0.46, 3, 1, true); a.rotateY(Math.PI / 6); a.translate(0, H * 0.23, 0); return part(a, DARK, 0); };
  const troncoL = () => { const t = new THREE.BoxGeometry(0.058, H * 0.38, 0.042); t.translate(0, H * 0.63, 0); return part(semFundo(t, true), [1, 1, 1], 1); };
  const cabecaL = () => { const h = new THREE.OctahedronGeometry(0.028); h.scale(1, 1.1, 1); h.translate(0, H * 0.9, 0); return part(h, SKIN, 0); };
  G = {
    pessoa: join([...legs(), torso(), head()]),
    operario: join([...legs(), torso(), vest(), head(), helmet()]),
    pessoaLonge: join([pernasL(), troncoL(), cabecaL()]),
  };
  return G;
}
let MAT = null;
export function figureMaterial() {
  if (MAT) return MAT;
  MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8 });
  MAT.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('vColor.xyz *= instanceColor.xyz;', 'vColor.xyz = mix(color.xyz, color.xyz * instanceColor.xyz, color.w); vColor.w = 1.0;'); };
  MAT.customProgramCacheKey = () => 'figmask';
  return MAT;
}
export const ROUPAS = [[0.9, 0.9, 0.92], [0.2, 0.35, 0.7], [0.75, 0.2, 0.2], [0.95, 0.75, 0.2], [0.25, 0.55, 0.35], [0.55, 0.3, 0.6], [0.95, 0.55, 0.3], [0.3, 0.3, 0.35], [0.85, 0.6, 0.7]];

// Multidão simples: instâncias que andam ao longo de caminhos (listas de pontos [x,y,z]).
// Com { lod: true } (e update com a câmera), quem está longe usa a figura barata (this.mesh) e quem
// está perto a figura inteira (this.perto, filho de this.mesh: 1 chamada a mais só quando há alguém perto).
export class Crowd {
  constructor(kind = 'pessoa', max = 200, o = {}) {
    const G = figureGeos(); this.lod = !!(o.lod && G[kind + 'Longe']);
    this.mesh = new THREE.InstancedMesh(this.lod ? G[kind + 'Longe'] : G[kind], figureMaterial(), max); this.mesh.count = 0; this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.max = max; this.walkers = []; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._c = new THREE.Color(1, 1, 1); this._e = new THREE.Euler();
    if (this.lod) { // as duas já com cor por instância: o mesmo programa desde a 1ª compilação
      const p = (this.perto = new THREE.InstancedMesh(G[kind], figureMaterial(), max)); p.count = 0; p.visible = false; p.castShadow = false; p.receiveShadow = true; p.frustumCulled = false; this.mesh.add(p);
      this.mesh.setColorAt(0, this._c); p.setColorAt(0, this._c);
    }
  }
  add(path, o = {}) { // path: [[x,y,z],...], o: {speed, loop, color, idle}
    if (this.walkers.length >= this.max) return null;
    const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]));
    const w = { path, cum, L: cum[cum.length - 1] || 0.001, s: (o.phase ?? Math.random()) * (cum[cum.length - 1] || 0), v: o.speed ?? 0.12 + Math.random() * 0.08, dir: 1, loop: o.loop ?? 'pingpong', idle: o.idle || 0, col: o.color || ROUPAS[(Math.random() * ROUPAS.length) | 0], bob: Math.random() * 6 };
    const i = this.walkers.length; this.walkers.push(w); w.slot = -1; w.perto = false;
    if (!this.lod) { this.mesh.count = this.walkers.length; this._c.setRGB(w.col[0], w.col[1], w.col[2]); this.mesh.setColorAt(i, this._c); this.mesh.instanceColor.needsUpdate = true; }
    return w;
  }
  clear() { this.walkers.length = 0; this.mesh.count = 0; if (this.perto) { this.perto.count = 0; this.perto.visible = false; } }
  // cam: posição da câmera; dPerto: distância abaixo da qual a figura inteira aparece (histerese de 15%)
  update(dt, t, cam = null, dPerto = 0) {
    const W = this.walkers; if (!W.length) return;
    const lod = this.lod; let kl = 0, kp = 0, corL = false, corP = false;
    for (let i = 0; i < W.length; i++) {
      const w = W[i]; let moving = true;
      if (w.idle > 0 && Math.sin(t * 0.0003 + w.bob) > 0.6) moving = false;
      if (moving) { w.s += w.v * dt * w.dir; if (w.s > w.L) { if (w.loop === 'loop') w.s -= w.L; else { w.s = w.L; w.dir = -1; } } else if (w.s < 0) { if (w.loop === 'loop') w.s += w.L; else { w.s = 0; w.dir = 1; } } }
      let k = 1; while (k < w.cum.length - 1 && w.cum[k] < w.s) k++;
      const a = w.path[k - 1], b = w.path[k] || a; const seg = w.cum[k] - w.cum[k - 1] || 1; const f = (w.s - w.cum[k - 1]) / seg;
      this._p.set(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f + (moving ? Math.abs(Math.sin(t * 0.012 + w.bob)) * 0.008 : 0), a[2] + (b[2] - a[2]) * f);
      const ang = Math.atan2((b[0] - a[0]) * w.dir, (b[2] - a[2]) * w.dir);
      this._e.set(0, ang, 0); this._q.setFromEuler(this._e); this._m.compose(this._p, this._q, this._s);
      if (!lod) { this.mesh.setMatrixAt(i, this._m); continue; }
      const d2 = cam ? this._p.distanceToSquared(cam) : Infinity, lim = w.perto ? dPerto * 1.15 : dPerto; w.perto = d2 < lim * lim;
      const alvo = w.perto ? this.perto : this.mesh, j = w.perto ? kp++ : kl++, slot = w.perto ? -2 - j : j;
      alvo.setMatrixAt(j, this._m);
      if (w.slot !== slot) { w.slot = slot; this._c.setRGB(w.col[0], w.col[1], w.col[2]); alvo.setColorAt(j, this._c); if (w.perto) corP = true; else corL = true; }
    }
    if (!lod) { this.mesh.instanceMatrix.needsUpdate = true; return; }
    this.mesh.count = kl; this.perto.count = kp; this.perto.visible = kp > 0;
    if (kl) this.mesh.instanceMatrix.needsUpdate = true; if (kp) this.perto.instanceMatrix.needsUpdate = true;
    if (corL) this.mesh.instanceColor.needsUpdate = true; if (corP) this.perto.instanceColor.needsUpdate = true;
  }
}
