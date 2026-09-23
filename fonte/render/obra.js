// Canteiro animado de cada etapa: a construção sobe por um plano de corte com borda incandescente,
// primeiro o esqueleto de concreto e depois o acabamento; andaimes acompanham a altura, a grua gira,
// operários circulam e, ao aprovar, os andaimes caem com um leve "salto".
import * as THREE from 'three';
import { M } from './materials.js';
import { Crowd } from './figuras.js';
import { tex, canvasTex } from './textures.js';
import { clamp, lerp, smooth, hash } from '../core/util.js';
import { normals } from './geom.js';

const GLOW = new THREE.Color(1.0, 0.55, 0.18).multiplyScalar(4);
function clipClone(mat, plane) {
  const m = mat.clone(); m.clippingPlanes = [plane]; m.clipShadows = true; m.side = mat.side; m.userData.base = mat;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = { value: GLOW };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uGlow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #if NUM_CLIPPING_PLANES > 0
        float cDist = clippingPlanes[0].w - dot(vClipPosition, clippingPlanes[0].xyz);
        totalEmissiveRadiance += uGlow * (1.0 - smoothstep(0.0, 0.07, cDist));
      #endif`);
  };
  m.customProgramCacheKey = () => 'clipglow';
  return m;
}
const latticeTex = () => canvasTex('grua', 64, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = '#F2BF2A'; g.lineWidth = 7; g.strokeRect(3, 0, w - 6, h);
  g.lineWidth = 5; for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(3, y); g.lineTo(w - 3, y + 32); g.lineTo(3, y + 64); g.stroke(); g.beginPath(); g.moveTo(3, y); g.lineTo(w - 3, y); g.stroke(); }
}, { aniso: 4 });
let SH = null;
function shared() {
  if (SH) return SH;
  const pole = new THREE.CylinderGeometry(0.015, 0.015, 1, 4, 1, true); pole.translate(0, 0.5, 0);
  const plank = new THREE.BoxGeometry(1, 0.012, 0.07); plank.translate(0.5, 0, 0);
  const lat = latticeTex(); lat.wrapT = THREE.RepeatWrapping;
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: lat, alphaTest: 0.4, transparent: false, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.3 });
  const scaffMat = new THREE.MeshStandardMaterial({ color: 0xc7ccd2, roughness: 0.45, metalness: 0.6 });
  const plankMat = new THREE.MeshStandardMaterial({ color: 0xd9a868, roughness: 0.8 });
  const netMat = new THREE.MeshStandardMaterial({ color: 0x2f8f7a, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, roughness: 0.9 });
  SH = { pole, plank, craneMat, scaffMat, plankMat, netMat, lat };
  return SH;
}

// Grua de torre simples (mastro treliçado, lança, contralança, cabine e gancho).
function makeCrane(height, jib) {
  const S = shared(); const g = new THREE.Group(); g.name = 'grua';
  const mastG = new THREE.BoxGeometry(0.22, height, 0.22); const uv = mastG.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * height / 0.9);
  const mast = new THREE.Mesh(mastG, S.craneMat); mast.position.y = height / 2; mast.castShadow = true; g.add(mast);
  const head = new THREE.Group(); head.position.y = height; g.add(head); g.userData.head = head;
  const jibG = new THREE.BoxGeometry(jib + 1.2, 0.16, 0.16); const ju = jibG.attributes.uv; for (let i = 0; i < ju.count; i++) ju.setX(i, ju.getX(i) * (jib + 1.2) / 0.9);
  const jb = new THREE.Mesh(jibG, S.craneMat); jb.position.x = (jib - 1.2) / 2; jb.castShadow = true; head.add(jb);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.26), M.yellow); cab.position.set(0.1, -0.14, 0.2); head.add(cab);
  const cw = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.3), M.concreto); cw.position.set(-1.0, -0.06, 0); cw.castShadow = true; head.add(cw);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 4), S.craneMat); top.position.y = 0.38; head.add(top);
  const trolley = new THREE.Group(); trolley.position.x = jib * 0.6; head.add(trolley); g.userData.trolley = trolley;
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 3), M.dark); cable.position.y = -0.5; trolley.add(cable); g.userData.cable = cable;
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), M.orange); trolley.add(hook); g.userData.hook = hook;
  const load = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.18), M.woodFrame); load.position.y = -0.14; hook.add(load); g.userData.load = load;
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), M.redGlow); light.position.set(jib, 0.1, 0); head.add(light);
  g.userData.jib = jib; g.userData.h = height;
  return g;
}

// Caminhão betoneira / basculante estilizado
function makeTruck(kind = 'betoneira') {
  const g = new THREE.Group(); const cab = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.2), M.white); cab.position.set(0.28, 0.14, 0); g.add(cab);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.17), M.dark); win.position.set(0.385, 0.18, 0); g.add(win);
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.2), M.dark); chassis.position.set(0, 0.07, 0); g.add(chassis);
  if (kind === 'betoneira') { const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.4, 10), M.orange); drum.rotation.z = Math.PI / 2 - 0.25; drum.position.set(-0.1, 0.22, 0); g.add(drum); g.userData.drum = drum; }
  else { const bed = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.22), M.yellow); bed.position.set(-0.1, 0.18, 0); g.add(bed); const load = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.18), M.soil); load.position.set(-0.1, 0.27, 0); g.add(load); }
  const wg = new THREE.CylinderGeometry(0.045, 0.045, 0.22, 8); wg.rotateX(Math.PI / 2);
  for (const x of [0.26, -0.08, -0.24]) { const w = new THREE.Mesh(wg, M.dark); w.position.set(x, 0.045, 0); g.add(w); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}
function makeExcavator() {
  const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.22), M.yellow); body.position.y = 0.15; g.add(body);
  const tr = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.26), M.dark); tr.position.y = 0.04; g.add(tr);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), M.yellow); cab.position.set(0.05, 0.28, 0.04); g.add(cab);
  const arm = new THREE.Group(); arm.position.set(0.12, 0.2, 0); g.add(arm); g.userData.arm = arm;
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.05), M.yellow); boom.position.x = 0.17; arm.add(boom);
  const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), M.dark); bucket.position.set(0.34, -0.06, 0); arm.add(bucket);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Casco convexo do alvo no plano XZ: andaimes e operários abraçam prédios redondos
// em vez de seguir a caixa envolvente (que atravessaria os vizinhos).
function casco(obj) {
  const P = []; const v = new THREE.Vector3(); const mi = new THREE.Matrix4(); obj.updateWorldMatrix(true, true);
  obj.traverse((o) => {
    const pos = o.isMesh ? o.geometry?.attributes?.position : null; if (!pos) return;
    const n = o.isInstancedMesh ? o.count : 1; const step = Math.max(1, Math.floor(pos.count / (o.isInstancedMesh ? 24 : 1500)));
    for (let k = 0; k < n; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, mi); mi.premultiply(o.matrixWorld); } else mi.copy(o.matrixWorld);
      for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i).applyMatrix4(mi); P.push([v.x, v.z]); }
    }
  });
  if (P.length < 3) return null;
  P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const H = lo.slice(0, -1).concat(up.slice(0, -1)); if (H.length < 3) return null;
  let per = 0; for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return per > 2 ? H : null; // peças pequenas ficam com a caixa envolvente
}
// pontos a cada `passo` ao redor do casco, afastados `m` para fora
function redor(H, m, passo) {
  let cx = 0, cz = 0; for (const [x, z] of H) { cx += x; cz += z; } cx /= H.length; cz /= H.length;
  const out = []; let s = 0;
  for (let i = 0; i < H.length; i++) {
    const a = H[i], b = H[(i + 1) % H.length]; const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (L < 1e-6) continue;
    let nx = dz / L, nz = -dx / L; if (nx * (a[0] + b[0] - 2 * cx) + nz * (a[1] + b[1] - 2 * cz) < 0) { nx = -nx; nz = -nz; }
    for (; s < L; s += passo) out.push([a[0] + (dx * s) / L + nx * m, a[1] + (dz * s) / L + nz * m]);
    s -= L;
  }
  return out;
}

export class Obras {
  constructor(engine) { this.e = engine; this.sites = new Map(); this.group = new THREE.Group(); this.group.name = 'obras'; engine.scene.add(this.group); this._shT = 0; }
  // opts: { alvo, esqueleto, modo:'subir'|'crescer'|'terra'|'surgir', box, caminho:{path, closed, o, y0, y1}, grua, anim(p) }
  iniciar(key, opts) {
    if (this.sites.has(key)) this.remover(key, true);
    const S = shared(); const site = { key, opts, p: 0, state: 'obra', t: 0, mats: [], group: new THREE.Group(), drop: 0 };
    this.group.add(site.group);
    const alvo = opts.alvo; const box = opts.box || new THREE.Box3().setFromObject(alvo);
    site.box = box; site.y0 = box.min.y; site.y1 = box.max.y;
    const modo = opts.modo || 'subir'; site.modo = modo;
    if (modo === 'subir' || modo === 'surgir') {
      site.plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), site.y0);
      const swap = (root, list) => root.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { const mats = Array.isArray(o.material) ? o.material : [o.material]; const nm = mats.map((m) => clipClone(m, site.plane)); list.push([o, o.material]); o.material = Array.isArray(o.material) ? nm : nm[0]; } });
      swap(alvo, site.mats);
      if (opts.esqueleto) { site.skPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), site.y0); site.skMats = []; opts.esqueleto.visible = true; opts.esqueleto.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { site.skMats.push([o, o.material]); o.material = clipClone(o.material, site.skPlane); } }); }
    } else if (modo === 'crescer') { alvo.scale.y = 0.001; }
    alvo.visible = true;
    site.casco = !opts.caminho && modo !== 'terra' ? casco(alvo) : null;
    // andaimes
    if (opts.andaime !== false && modo !== 'crescer' && modo !== 'terra') site.scaff = this._scaffold(site, opts);
    // grua
    if (opts.grua) {
      const c = box.getCenter(new THREE.Vector3()); const sz = box.getSize(new THREE.Vector3());
      const pos = opts.gruaPos || [box.max.x + 0.6, box.min.z - 0.4];
      const crane = makeCrane(Math.max(2.2, site.y1 - site.y0 + 1.6) + (site.y0 > 0 ? site.y0 : 0), clamp(Math.max(sz.x, sz.z) * 0.6, 2.2, 4.2));
      crane.position.set(pos[0], Math.min(0, site.y0), pos[1]); crane.userData.aim = Math.atan2(-(c.z - pos[1]), c.x - pos[0]);
      crane.userData.head.rotation.y = crane.userData.aim; site.group.add(crane); site.crane = crane;
    }
    // operários
    const nW = opts.operarios ?? 8; site.crowd = new Crowd('operario', nW + 2); site.group.add(site.crowd.mesh);
    const ring = site.casco ? this._anel(site.casco, 0.42, Math.max(0, box.min.y)) : this._perimeter(box, 0.35); for (let i = 0; i < nW; i++) site.crowd.add(ring, { speed: 0.08 + hash(i, 2, 9) * 0.06, loop: 'loop', phase: i / nW, color: [1, 1, 1], idle: 1 });
    // veículos
    const truck = makeTruck(modo === 'terra' ? 'basculante' : 'betoneira'); truck.position.set(box.min.x - 0.5, Math.max(0, site.y0 < 0 ? 0 : 0), box.max.z + 0.3); truck.rotation.y = 0.4; site.group.add(truck); site.truck = truck;
    if (modo === 'terra') { const ex = makeExcavator(); const c = box.getCenter(new THREE.Vector3()); ex.position.set(c.x, 0, c.z); site.group.add(ex); site.exc = ex; }
    site.group.scale.y = 0.001; site.pop = 0;
    this.sites.set(key, site); this.e.shadowDirty = true;
    return site;
  }
  _anel(H, m, y) { const r = redor(H, m, 0.5).map(([x, z]) => [x, y, z]); r.push(r[0]); return r; }
  _perimeter(box, m) { const y = Math.max(0, box.min.y); return [[box.min.x - m, y, box.min.z - m], [box.max.x + m, y, box.min.z - m], [box.max.x + m, y, box.max.z + m], [box.min.x - m, y, box.max.z + m], [box.min.x - m, y, box.min.z - m]]; }
  _scaffold(site, opts) {
    const S = shared(); const poles = [], planks = []; const y0 = site.y0, y1 = site.y1 + 0.25; const lift = 0.42;
    const addLine = (pts, fechado) => { // pts: [[x,z],...] ao longo do andaime
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i]; poles.push([x, z]);
        if (i > 0 || fechado) { const [px, pz] = pts[(i - 1 + pts.length) % pts.length]; for (let y = y0 + lift; y < y1; y += lift) planks.push([px, y, pz, x, z]); }
      }
    };
    if (opts.caminho) {
      const { path, closed, o } = opts.caminho; const nor = normals(path, closed); const pts = []; let acc = 0;
      for (let i = 0; i < path.length; i++) { if (i) acc += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); if (i === 0 || acc > 0.55 || i === path.length - 1) { acc = 0; pts.push([path[i][0] + nor[i][0] * o, path[i][1] + nor[i][1] * o]); } }
      addLine(pts);
    } else if (site.casco) {
      addLine(redor(site.casco, 0.22, 0.6), true);
    } else {
      const b = site.box, m = 0.22; const X0 = b.min.x - m, X1 = b.max.x + m, Z0 = b.min.z - m, Z1 = b.max.z + m;
      const side = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.round(L / 0.6)); const pts = []; for (let i = 0; i <= n; i++) pts.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]); addLine(pts); };
      side(X0, Z1, X1, Z1); side(X1, Z1, X1, Z0); if (opts.andaime === 'total') { side(X1, Z0, X0, Z0); side(X0, Z0, X0, Z1); }
    }
    const g = new THREE.Group(); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler();
    const pm = new THREE.InstancedMesh(S.pole, S.scaffMat, poles.length); poles.forEach(([x, z], i) => pm.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0, z), q.identity(), new THREE.Vector3(1, y1 - y0, 1)))); pm.position.y = y0; pm.castShadow = true;
    planks.sort((a, b) => a[1] - b[1]);
    const km = new THREE.InstancedMesh(S.plank, S.plankMat, Math.max(1, planks.length)); planks.forEach(([ax, y, az, bx, bz], i) => { const L = Math.hypot(bx - ax, bz - az); e.set(0, -Math.atan2(bz - az, bx - ax), 0); km.setMatrixAt(i, m4.compose(new THREE.Vector3(ax, y, az), q.setFromEuler(e), new THREE.Vector3(L, 1, 1))); }); km.castShadow = true; km.computeBoundingSphere(); km.count = 0; // esfera calculada com todas as tábuas, antes de zerar a contagem
    km.userData.ys = planks.map((p) => p[1]);
    g.add(pm, km); site.group.add(g); g.userData = { pm, km, y0, y1 }; pm.userData.full = y1 - y0;
    return g;
  }
  progresso(key, p) { const s = this.sites.get(key); if (s) s.p = clamp(p, 0, 1); }
  pronta(key) { const s = this.sites.get(key); if (s) { s.p = 1; s.state = 'pronta'; } }
  // aprovação: andaimes caem, materiais voltam ao normal
  concluir(key, cb) { const s = this.sites.get(key); if (!s) { cb && cb(); return; } if (s.state === 'fim') return; s.state = 'fim'; s.drop = 0; s.cb = cb; this._restore(s); }
  _restore(s) {
    for (const [o, m] of s.mats) o.material = m; s.mats.length = 0;
    if (s.skMats) { for (const [o, m] of s.skMats) o.material = m; s.skMats.length = 0; }
    if (s.opts.esqueleto) s.opts.esqueleto.visible = false;
    s.opts.alvo.scale.y = 1; s.opts.alvo.visible = true; this.e.shadowDirty = true;
  }
  remover(key, now) { const s = this.sites.get(key); if (!s) return; this._restore(s); this.group.remove(s.group); s.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); this.sites.delete(key); }
  get ativo() { return this.sites.size > 0; }
  update(dt, t) {
    let dirty = false;
    for (const s of this.sites.values()) {
      s.t += dt;
      // entrada com "salto"
      if (s.pop < 1) { s.pop = Math.min(1, s.pop + dt * 2.2); const k = s.pop; s.group.scale.y = k < 0.7 ? smooth(k / 0.7) * 1.08 : lerp(1.08, 1, (k - 0.7) / 0.3); }
      const p = s.p; const H = s.y1 - s.y0;
      if (s.modo === 'subir' || s.modo === 'surgir') {
        const sk = s.opts.esqueleto; const fin = sk ? clamp((p - 0.42) / 0.58, 0, 1) : p; const pk = sk ? clamp(p / 0.5, 0, 1) : 0;
        const hy = s.y0 + H * smooth(fin) * 1.001 + (fin >= 1 ? 1 : 0);
        if (s.plane.constant !== hy) { s.plane.constant = hy; dirty = true; }
        if (sk) { const sy = s.y0 + H * pk + (pk >= 1 ? 1 : 0); s.skPlane.constant = sy; }
      } else if (s.modo === 'crescer') { s.opts.alvo.scale.y = Math.max(0.001, smooth(p)); dirty = true; }
      if (s.opts.anim) s.opts.anim(p, s);
      // andaimes acompanham a altura
      if (s.scaff) { const { km, pm } = s.scaff.userData; const top = s.y0 + H * Math.min(1, p * 1.15) + 0.3; let n = 0; const ys = km.userData.ys; while (n < ys.length && ys[n] <= top) n++; km.count = n; pm.scale.y = clamp((top + 0.12 - s.y0) / pm.userData.full, 0.05, 1); }
      // grua
      if (s.crane) { const u = s.crane.userData; const a = u.aim + Math.sin(s.t * 0.35) * 0.9; u.head.rotation.y = a; u.trolley.position.x = u.jib * (0.45 + 0.35 * Math.sin(s.t * 0.5)); const drop = 0.4 + (Math.sin(s.t * 0.8) * 0.5 + 0.5) * (u.h - 0.6); u.hook.position.y = -drop; u.cable.scale.y = drop; u.cable.position.y = -drop / 2; }
      if (s.truck && s.truck.userData.drum) s.truck.userData.drum.rotation.x += dt * 3;
      if (s.exc) { s.exc.userData.arm.rotation.z = Math.sin(s.t * 1.6) * 0.35 - 0.2; s.exc.rotation.y = Math.sin(s.t * 0.3) * 0.8; }
      s.crowd.update(dt, t);
      if (s.state === 'fim') {
        s.drop += dt * 2.6; const k = Math.min(1, s.drop); s.group.scale.y = Math.max(0.001, 1 - smooth(k)); s.group.position.y = -k * 0.2;
        if (k >= 1) { this.group.remove(s.group); this.sites.delete(s.key); const cb = s.cb; s.cb = null; cb && cb(); dirty = true; }
      }
    }
    // sombras: atualiza no máximo 5 vezes por segundo durante as obras
    this._shT += dt; if (dirty && this._shT > 0.2) { this._shT = 0; this.e.shadowDirty = true; }
  }
}
