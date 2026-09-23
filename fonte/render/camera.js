// Câmera orbital no estilo SimCity BuildIt: um dedo arrasta (com inércia), pinça aproxima,
// torcer com dois dedos gira, mover dois dedos na vertical inclina. A inclinação acompanha o zoom.
import * as THREE from 'three';
import { clamp, lerp, damp } from '../core/util.js';

export class CameraRig {
  constructor(engine, dom, bounds) {
    this.e = engine; this.cam = engine.camera; this.dom = dom;
    this.bounds = bounds; // {x0,x1,z0,z1}
    this.target = new THREE.Vector3(0, 0, 4);
    this.dist = 34; this.yaw = 0; this.tilt = 0; this.fov = 38; this.roll = 0; this.pitchFix = null;
    this.minDist = 3.2; this.maxDist = 78;
    this.vel = new THREE.Vector2(); this.yawVel = 0;
    this.anim = null;
    this.ptrs = new Map(); this.g = null;
    this.onTap = null; this.onLong = null; this.onMove = null; this.enabled = true; this.dragHook = null;
    this._ray = new THREE.Raycaster(); this._ndc = new THREE.Vector2(); this._pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); this._hit = new THREE.Vector3();
    this.moved = true;
    this._bind();
  }
  zoomT() { return clamp((this.dist - this.minDist) / (this.maxDist - this.minDist), 0, 1); }
  pitch() {
    if (this.pitchFix != null) return this.pitchFix;
    const t = Math.pow(this.zoomT(), 0.62);
    return clamp(lerp(0.62, 1.05, t) + this.tilt, 0.22, 1.42);
  }
  apply() {
    const p = this.pitch(), c = this.cam;
    c.position.set(this.target.x + Math.sin(this.yaw) * Math.cos(p) * this.dist, this.target.y + Math.sin(p) * this.dist, this.target.z + Math.cos(this.yaw) * Math.cos(p) * this.dist);
    c.lookAt(this.target); if (this.roll) c.rotateZ(this.roll);
    if (c.fov !== this.fov) { c.fov = this.fov; c.updateProjectionMatrix(); }
    this.e.focus = this.dist;
  }
  ground(sx, sy, h = 0) {
    this._ndc.set((sx / this.e.vw) * 2 - 1, -(sy / this.e.vh) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.cam);
    this._pl.constant = -h;
    return this._ray.ray.intersectPlane(this._pl, this._hit) ? this._hit.clone() : null;
  }
  ray(sx, sy) { this._ndc.set((sx / this.e.vw) * 2 - 1, -(sy / this.e.vh) * 2 + 1); this._ray.setFromCamera(this._ndc, this.cam); return this._ray; }
  clampTarget() {
    const b = this.bounds, m = 2;
    this.target.x = clamp(this.target.x, b.x0 - m, b.x1 + m); this.target.z = clamp(this.target.z, b.z0 - m, b.z1 + m);
    this.dist = clamp(this.dist, this.minDist, this.maxDist);
  }
  flyTo(o, ms = 900) {
    const from = { x: this.target.x, z: this.target.z, dist: this.dist, yaw: this.yaw, tilt: this.tilt, fov: this.fov, roll: this.roll };
    let yaw = o.yaw != null ? o.yaw : this.yaw;
    while (yaw - from.yaw > Math.PI) yaw -= Math.PI * 2; while (yaw - from.yaw < -Math.PI) yaw += Math.PI * 2;
    this.anim = { t0: performance.now(), ms, from, to: { x: o.x ?? from.x, z: o.z ?? from.z, dist: o.dist ?? from.dist, yaw, tilt: o.tilt ?? from.tilt, fov: o.fov ?? from.fov, roll: o.roll ?? 0 }, done: o.done };
    this.vel.set(0, 0); this.yawVel = 0;
  }
  update(dt) {
    if (this.anim) {
      const a = this.anim; let t = clamp((performance.now() - a.t0) / a.ms, 0, 1); const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.target.x = lerp(a.from.x, a.to.x, k); this.target.z = lerp(a.from.z, a.to.z, k); this.dist = lerp(a.from.dist, a.to.dist, k);
      this.yaw = lerp(a.from.yaw, a.to.yaw, k); this.tilt = lerp(a.from.tilt, a.to.tilt, k); this.fov = lerp(a.from.fov, a.to.fov, k); this.roll = lerp(a.from.roll, a.to.roll, k);
      this.moved = true;
      if (t >= 1) { this.anim = null; a.done && a.done(); }
    } else if (!this.g) {
      if (this.vel.lengthSq() > 1e-5) { this.target.x += this.vel.x * dt; this.target.z += this.vel.y * dt; this.vel.multiplyScalar(Math.exp(-5.5 * dt)); this.moved = true; }
      if (Math.abs(this.yawVel) > 1e-4) { this.yaw += this.yawVel * dt; this.yawVel *= Math.exp(-6 * dt); this.moved = true; }
    }
    this.clampTarget();
    this.apply();
    const m = this.moved; this.moved = false; return m;
  }
  _bind() {
    const d = this.dom;
    d.addEventListener('pointerdown', (e) => this._down(e));
    d.addEventListener('pointermove', (e) => this._move(e));
    d.addEventListener('pointerup', (e) => this._up(e, false));
    d.addEventListener('pointercancel', (e) => this._up(e, true));
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    d.addEventListener('wheel', (e) => { e.preventDefault(); if (!this.enabled) return; this.anim = null; this._zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1 / 1.12 : 1.12); }, { passive: false });
  }
  _zoomAt(sx, sy, f) {
    const before = this.ground(sx, sy);
    this.dist = clamp(this.dist * f, this.minDist, this.maxDist); this.apply();
    const after = this.ground(sx, sy);
    if (before && after) { this.target.x += before.x - after.x; this.target.z += before.z - after.z; }
    this.moved = true;
  }
  _down(e) {
    try { this.dom.setPointerCapture(e.pointerId); } catch (_) {}
    if (this.roll && !this.travada) { this.roll = 0; this.pitchFix = null; this.moved = true; }
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    this.anim = null;
    if (this.ptrs.size === 1) {
      this.g = { type: 'pending', sx: e.clientX, sy: e.clientY, t0: performance.now(), moved: false, button: e.button, hist: [] };
      if (e.button === 2 || e.button === 1) this.g.type = 'orbit';
      else if (this.dragHook && this.dragHook.down(e.clientX, e.clientY)) this.g.type = 'hook';
      this.vel.set(0, 0); this.yawVel = 0;
      clearTimeout(this._lt);
      this._lt = setTimeout(() => { if (this.g && this.g.type === 'pending' && !this.g.moved) { this.g.long = true; this.onLong && this.onLong(this.g.sx, this.g.sy); } }, 520);
    } else if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()];
      this.g = { type: 'two', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, dist0: this.dist, ang0: Math.atan2(b.y - a.y, b.x - a.x), yaw0: this.yaw, my0: (a.y + b.y) / 2, mx0: (a.x + b.x) / 2, tilt0: this.tilt, moved: true, lastAng: 0 };
      this.g.anchor = this.ground(this.g.mx0, this.g.my0);
      clearTimeout(this._lt);
    }
  }
  _move(e) {
    const p = this.ptrs.get(e.pointerId); if (!p) return;
    const px = p.x, py = p.y; p.x = e.clientX; p.y = e.clientY;
    const g = this.g; if (!g || !this.enabled) return;
    if (g.type === 'two') {
      if (this.ptrs.size < 2) return;
      const [a, b] = [...this.ptrs.values()];
      const dd = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      this.dist = clamp(g.dist0 * g.d0 / dd, this.minDist, this.maxDist);
      const ang = Math.atan2(b.y - a.y, b.x - a.x); let da = ang - g.ang0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      this.yaw = g.yaw0 - da; this.yawVel = -(da - g.lastAng) * 30; g.lastAng = da;
      const my = (a.y + b.y) / 2; this.tilt = clamp(g.tilt0 + (my - g.my0) / this.e.vh * 1.4, -0.6, 0.5);
      this.apply();
      const mx = (a.x + b.x) / 2; const cur = this.ground(mx, my);
      if (g.anchor && cur) { this.target.x += g.anchor.x - cur.x; this.target.z += g.anchor.z - cur.z; }
      this.moved = true; this.onMove && this.onMove(); return;
    }
    if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 9) g.moved = true;
    if (!g.moved) return;
    clearTimeout(this._lt);
    if (g.type === 'hook') { this.dragHook.move(e.clientX, e.clientY); return; }
    if (g.type === 'orbit') { this.yaw -= (e.clientX - px) * 0.006; this.tilt = clamp(this.tilt + (e.clientY - py) * 0.004, -0.6, 0.5); this.moved = true; return; }
    g.type = 'pan'; this.dom.classList.add('drag');
    const a = this.ground(px, py), b = this.ground(e.clientX, e.clientY);
    if (a && b) {
      const dx = a.x - b.x, dz = a.z - b.z; this.target.x += dx; this.target.z += dz;
      const t = performance.now(); g.hist.push([t, dx, dz]); while (g.hist.length && t - g.hist[0][0] > 90) g.hist.shift();
    }
    this.moved = true; this.onMove && this.onMove();
  }
  _up(e, cancel) {
    if (!this.ptrs.has(e.pointerId)) return;
    this.ptrs.delete(e.pointerId); this.dom.classList.remove('drag');
    clearTimeout(this._lt);
    const g = this.g; if (!g) return;
    if (g.type === 'two') { this.g = this.ptrs.size ? { type: 'pan', moved: true, sx: 0, sy: 0, hist: [] } : null; return; }
    if (g.type === 'hook') { this.dragHook.up(e.clientX, e.clientY, cancel || !g.moved); if (!g.moved && !cancel) this.onTap && this.onTap(e.clientX, e.clientY, true); this.g = null; return; }
    if (g.type === 'pan' && g.hist.length > 1) {
      const t0 = g.hist[0][0], t1 = performance.now(); const span = Math.max(16, t1 - t0) / 1000;
      let sx = 0, sz = 0; for (const h of g.hist) { sx += h[1]; sz += h[2]; }
      if (t1 - g.hist[g.hist.length - 1][0] < 60) this.vel.set(sx / span, sz / span);
    }
    if (!cancel && !g.moved && !g.long && g.type === 'pending') {
      const now = performance.now();
      if (this._lastTap && now - this._lastTap.t < 300 && Math.hypot(e.clientX - this._lastTap.x, e.clientY - this._lastTap.y) < 30) {
        this._lastTap = null; this._zoomAtAnim(e.clientX, e.clientY);
      } else {
        this._lastTap = { t: now, x: e.clientX, y: e.clientY };
        this.onTap && this.onTap(e.clientX, e.clientY, false);
      }
    }
    this.g = null;
  }
  _zoomAtAnim(sx, sy) {
    const p = this.ground(sx, sy); if (!p) return;
    this.flyTo({ x: p.x, z: p.z, dist: Math.max(this.minDist, this.dist * 0.55) }, 520);
  }
}
