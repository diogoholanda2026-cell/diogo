// Câmera orbital no estilo SimCity BuildIt: um dedo arrasta (com inércia), pinça aproxima (com inércia),
// torcer com dois dedos gira, mover dois dedos na vertical inclina. A inclinação acompanha o zoom.
// Voos por toque respondem na hora (easeOutQuint, duração pela distância) e fazem arco nas viagens longas;
// voos de cinema (vista da foto, introdução) usam easeInOutSine. Bordas e zoom são elásticos: passam um
// pouco do limite com resistência e voltam macios. Extras: deslocamento lateral do centro (painel aberto),
// baque na aprovação, órbita de cinema e passeio lento no modo Apreciar.
import * as THREE from 'three';
import { clamp, lerp, damp, easeOutQuint, easeInOutSine, mola } from '../core/util.js';

const BORDA = 2, RES_BORDA = 0.35, RES_ZOOM = 0.4;
export class CameraRig {
  constructor(engine, dom, bounds) {
    this.e = engine; this.cam = engine.camera; this.dom = dom;
    this.bounds = bounds; // {x0,x1,z0,z1}
    this.target = new THREE.Vector3(0, 0, 4);
    this.dist = 34; this.yaw = 0; this.tilt = 0; this.fov = 38; this.roll = 0; this.pitchFix = null;
    this.minDist = 3.2; this.maxDist = 78;
    this.vel = new THREE.Vector2(); this.yawVel = 0; this._zv = 0;
    this.anim = null;
    this.ptrs = new Map(); this.g = null;
    this.onTap = null; this.onLong = null; this.onMove = null; this.enabled = true; this.dragHook = null;
    this._ray = new THREE.Raycaster(); this._ndc = new THREE.Vector2(); this._pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); this._hit = new THREE.Vector3();
    this.moved = true;
    // deslocamento lateral do centro (px, escrito pela interface: folha lateral aberta), baque, órbita e passeio
    this.deslocAlvo = 0; this.deslocX = 0; this._baque = { x: 0, v: 0 }; this._orb = null; this._pass = { on: false, k: 0, t: 0 }; this._toque = performance.now();
    this._bind();
  }
  zoomT() { return clamp((this.dist - this.minDist) / (this.maxDist - this.minDist), 0, 1); }
  pitch() {
    if (this.pitchFix != null) return this.pitchFix;
    const t = Math.pow(this.zoomT(), 0.62);
    return clamp(lerp(0.62, 1.05, t) + this.tilt, 0.22, 1.42);
  }
  // distância efetiva: baque da aprovação e respiração do passeio (sem mexer em this.dist)
  _kDist() { const P = this._pass; return (1 + this._baque.x) * (1 + (P.k > 0 ? 0.025 * Math.sin((P.t * Math.PI * 2) / 24) * P.k : 0)); }
  apply() {
    const p = this.pitch(), c = this.cam, d = this.dist * this._kDist();
    c.position.set(this.target.x + Math.sin(this.yaw) * Math.cos(p) * d, this.target.y + Math.sin(p) * d, this.target.z + Math.cos(this.yaw) * Math.cos(p) * d);
    c.lookAt(this.target); if (this.roll) c.rotateZ(this.roll);
    if (c.fov !== this.fov) { c.fov = this.fov; c.updateProjectionMatrix(); }
    // centro da imagem deslocado para a direita (a área livre ao lado da folha): o raio do toque e os
    // balões usam a mesma matriz de projeção, então continuam certos
    const W = this.e.vw || innerWidth, H = this.e.vh || innerHeight, dx = this.deslocX;
    if (Math.abs(dx) >= 0.5) { const v = c.view; if (!v || !v.enabled || v.offsetX !== -dx || v.fullWidth !== W || v.fullHeight !== H) c.setViewOffset(W, H, -dx, 0, W, H); }
    else if (c.view?.enabled) c.clearViewOffset();
    this.e.focus = this.dist;
  }
  ground(sx, sy, h = 0) {
    this._ndc.set((sx / this.e.vw) * 2 - 1, -(sy / this.e.vh) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.cam);
    this._pl.constant = -h;
    return this._ray.ray.intersectPlane(this._pl, this._hit) ? this._hit.clone() : null;
  }
  ray(sx, sy) { this._ndc.set((sx / this.e.vw) * 2 - 1, -(sy / this.e.vh) * 2 + 1); this._ray.setFromCamera(this._ndc, this.cam); return this._ray; }
  // limites duros (com a folga elástica): o alvo pode passar BORDA além da mesa + 2, e o zoom 15% e 10%
  clampTarget() {
    const b = this.bounds, m = 2 + BORDA;
    this.target.x = clamp(this.target.x, b.x0 - m, b.x1 + m); this.target.z = clamp(this.target.z, b.z0 - m, b.z1 + m);
    this.dist = clamp(this.dist, this.minDist * 0.85, this.maxDist * 1.1);
  }
  // quanto de um arrasto d vale com o alvo em v (limites lo, hi): além da borda, resistência que cresce
  _volta(v, lo, hi, dt) { return v < lo ? damp(v, lo, 12, dt) : v > hi ? damp(v, hi, 12, dt) : v; }
  _elast(v, d, lo, hi) {
    if (d > 0 && v >= hi) return d * RES_BORDA * Math.max(0, 1 - (v - hi) / BORDA);
    if (d < 0 && v <= lo) return d * RES_BORDA * Math.max(0, 1 - (lo - v) / BORDA);
    return d;
  }
  _zoomElast(raw) {
    const a = this.minDist, b = this.maxDist;
    if (raw < a) return Math.max(a * 0.85, a - (a - raw) * RES_ZOOM);
    if (raw > b) return Math.min(b * 1.1, b + (raw - b) * RES_ZOOM);
    return raw;
  }
  // o: {x, z, dist, yaw, tilt, fov, roll, cine, ms, done}; opt.cine (compatível com o 3º argumento antigo).
  // Voo por toque: easeOutQuint com duração pela distância (d = trajeto + 0,6 |Δdist|), 450 a 1300 ms, e
  // arco (afasta no meio) acima de 12 unidades; voo de cinema: easeInOutSine com a duração pedida.
  flyTo(o, ms = 900, opt = {}) {
    const from = { x: this.target.x, z: this.target.z, dist: this.dist, yaw: this.yaw, tilt: this.tilt, fov: this.fov, roll: this.roll };
    let yaw = o.yaw != null ? o.yaw : this.yaw;
    while (yaw - from.yaw > Math.PI) yaw -= Math.PI * 2; while (yaw - from.yaw < -Math.PI) yaw += Math.PI * 2;
    const to = { x: o.x ?? from.x, z: o.z ?? from.z, dist: o.dist ?? from.dist, yaw, tilt: o.tilt ?? from.tilt, fov: o.fov ?? from.fov, roll: o.roll ?? 0 };
    const cine = !!(o.cine || opt.cine); const d = Math.hypot(to.x - from.x, to.z - from.z) + 0.6 * Math.abs(to.dist - from.dist);
    const dur = cine ? ms : o.ms ?? clamp(380 + 170 * Math.log2(1 + d / 3), 450, 1300);
    this.anim = { t0: performance.now(), ms: dur, from, to, done: o.done, cine, arco: !cine && d > 12 ? Math.min(0.35 * d, 22) : 0 };
    this.vel.set(0, 0); this.yawVel = 0; this._zv = 0; this._orb = null;
  }
  // baque de câmera (aprovação): distância x k e volta com mola crítica (ω 18), só sem dedo na tela
  baque(k = 0.97) { if (this.ptrs.size) return; this._baque.x = k - 1; this._baque.v = 0; this.moved = true; }
  // órbita de cinema (fim de um projeto): gira 'yaw' em ms, easeInOutSine; um toque cancela
  orbitaCine(ms = 3200, yaw = 0.5, done = null) { this._orb = { t0: performance.now(), ms, y0: this.yaw, dy: yaw, done }; }
  // passeio do modo Apreciar: 4 s sem toque, gira 0,04 rad/s e respira ±2,5% (24 s); o toque para em 300 ms
  passeio(on) { this._pass.on = !!on; if (!on) this._pass.k = Math.min(this._pass.k, 1); }
  update(dt) {
    const agora = performance.now();
    if (Math.abs(this.deslocAlvo - this.deslocX) > 0.01) { this.deslocX = damp(this.deslocX, this.deslocAlvo, 14, dt); if (Math.abs(this.deslocAlvo - this.deslocX) < 0.3) this.deslocX = this.deslocAlvo; this.moved = true; }
    if (this.anim) {
      const a = this.anim; const t = clamp((agora - a.t0) / a.ms, 0, 1); const k = a.cine ? easeInOutSine(t) : easeOutQuint(t);
      this.target.x = lerp(a.from.x, a.to.x, k); this.target.z = lerp(a.from.z, a.to.z, k); this.dist = lerp(a.from.dist, a.to.dist, k) + a.arco * Math.sin(Math.PI * k);
      this.yaw = lerp(a.from.yaw, a.to.yaw, k); this.tilt = lerp(a.from.tilt, a.to.tilt, k); this.fov = lerp(a.from.fov, a.to.fov, k); this.roll = lerp(a.from.roll, a.to.roll, k);
      this.moved = true;
      if (t >= 1) { this.anim = null; a.done && a.done(); }
    } else if (!this.g) {
      const b = this.bounds, m = 2;
      if (this.vel.lengthSq() > 1e-5) {
        // inércia: além da borda a velocidade que empurra para fora morre
        if ((this.target.x > b.x1 + m && this.vel.x > 0) || (this.target.x < b.x0 - m && this.vel.x < 0)) this.vel.x *= Math.exp(-20 * dt);
        if ((this.target.z > b.z1 + m && this.vel.y > 0) || (this.target.z < b.z0 - m && this.vel.y < 0)) this.vel.y *= Math.exp(-20 * dt);
        this.target.x += this.vel.x * dt; this.target.z += this.vel.y * dt; this.vel.multiplyScalar(Math.exp(-5.5 * dt)); this.moved = true;
      }
      if (Math.abs(this.yawVel) > 1e-4) { this.yaw += this.yawVel * dt; this.yawVel *= Math.exp(-6 * dt); this.moved = true; }
      if (Math.abs(this._zv) > 1e-3) { this.dist *= Math.exp(this._zv * dt); this._zv *= Math.exp(-8 * dt); if (this.dist < this.minDist || this.dist > this.maxDist) this._zv *= Math.exp(-25 * dt); this.moved = true; } // inércia da pinça
      // volta elástica da borda (λ 12) e do zoom (λ 14)
      const tx = this._volta(this.target.x, b.x0 - m, b.x1 + m, dt), tz = this._volta(this.target.z, b.z0 - m, b.z1 + m, dt); if (tx !== this.target.x || tz !== this.target.z) { this.target.x = tx; this.target.z = tz; this.moved = true; }
      if (this.dist < this.minDist) { this.dist = damp(this.dist, this.minDist, 14, dt); if (this.minDist - this.dist < 1e-3) this.dist = this.minDist; this.moved = true; }
      else if (this.dist > this.maxDist) { this.dist = damp(this.dist, this.maxDist, 14, dt); if (this.dist - this.maxDist < 1e-3) this.dist = this.maxDist; this.moved = true; }
      if (this._orb) { const o = this._orb; const t = clamp((agora - o.t0) / o.ms, 0, 1); this.yaw = o.y0 + o.dy * easeInOutSine(t); this.moved = true; if (t >= 1) { this._orb = null; o.done && o.done(); } }
    }
    // passeio (Apreciar)
    const P = this._pass; const quer = P.on && !this.g && !this.anim && !this._orb && agora - this._toque > 4000 ? 1 : 0;
    if (quer || P.k > 0) { P.k = quer ? Math.min(1, P.k + dt / 1.5) : Math.max(0, P.k - dt / 0.3); if (P.k > 0) { P.t += dt; this.yaw += 0.04 * P.k * dt; this.moved = true; } }
    // baque (mola crítica)
    const B = this._baque; if (Math.abs(B.x) > 1e-5 || Math.abs(B.v) > 1e-5) { if (this.ptrs.size) { B.x = 0; B.v = 0; } else mola(B, 0, 18, 1, dt); this.moved = true; if (Math.abs(B.x) < 1e-5 && Math.abs(B.v) < 1e-4) B.x = B.v = 0; }
    this.clampTarget();
    this.apply();
    const mv = this.moved; this.moved = false; return mv;
  }
  _bind() {
    const d = this.dom;
    d.addEventListener('pointerdown', (e) => this._down(e));
    d.addEventListener('pointermove', (e) => this._move(e));
    d.addEventListener('pointerup', (e) => this._up(e, false));
    d.addEventListener('pointercancel', (e) => this._up(e, true));
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    d.addEventListener('wheel', (e) => { e.preventDefault(); if (!this.enabled) return; this.anim = null; this._orb = null; this._toque = performance.now(); this._zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1 / 1.12 : 1.12); }, { passive: false });
  }
  _zoomAt(sx, sy, f) {
    const before = this.ground(sx, sy);
    this.dist = this._zoomElast(this.dist * f); this.apply();
    const after = this.ground(sx, sy);
    if (before && after) { this.target.x += before.x - after.x; this.target.z += before.z - after.z; }
    this.moved = true;
  }
  _down(e) {
    try { this.dom.setPointerCapture(e.pointerId); } catch (_) {}
    if (this.roll && !this.travada) { this.roll = 0; this.pitchFix = null; this.moved = true; }
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    this.anim = null; this._orb = null; this._zv = 0; this._toque = performance.now();
    if (this.ptrs.size === 1) {
      this.g = { type: 'pending', sx: e.clientX, sy: e.clientY, t0: performance.now(), moved: false, button: e.button, hist: [] };
      if (e.button === 2 || e.button === 1) this.g.type = 'orbit';
      else if (this.dragHook && this.dragHook.down(e.clientX, e.clientY)) this.g.type = 'hook';
      this.vel.set(0, 0); this.yawVel = 0;
      clearTimeout(this._lt);
      this._lt = setTimeout(() => { if (this.g && this.g.type === 'pending' && !this.g.moved) { this.g.long = true; this.onLong && this.onLong(this.g.sx, this.g.sy); } }, 520);
    } else if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()];
      this.g = { type: 'two', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, dist0: this.dist, ang0: Math.atan2(b.y - a.y, b.x - a.x), yaw0: this.yaw, my0: (a.y + b.y) / 2, mx0: (a.x + b.x) / 2, tilt0: this.tilt, moved: true, lastAng: 0, zh: [] };
      this.g.anchor = this.ground(this.g.mx0, this.g.my0);
      clearTimeout(this._lt);
    }
  }
  _move(e) {
    const p = this.ptrs.get(e.pointerId); if (!p) return;
    const px = p.x, py = p.y; p.x = e.clientX; p.y = e.clientY;
    const g = this.g; if (!g || !this.enabled) return;
    this._toque = performance.now();
    const B = this.bounds, m = 2;
    if (g.type === 'two') {
      if (this.ptrs.size < 2) return;
      const [a, b] = [...this.ptrs.values()];
      const dd = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      this.dist = this._zoomElast((g.dist0 * g.d0) / dd);
      const t = performance.now(); g.zh.push([t, Math.log(this.dist)]); while (g.zh.length && t - g.zh[0][0] > 80) g.zh.shift();
      const ang = Math.atan2(b.y - a.y, b.x - a.x); let da = ang - g.ang0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      this.yaw = g.yaw0 - da; this.yawVel = -(da - g.lastAng) * 30; g.lastAng = da;
      const my = (a.y + b.y) / 2; this.tilt = clamp(g.tilt0 + (my - g.my0) / this.e.vh * 1.4, -0.6, 0.5);
      this.apply();
      const mx = (a.x + b.x) / 2; const cur = this.ground(mx, my);
      if (g.anchor && cur) { this.target.x += this._elast(this.target.x, g.anchor.x - cur.x, B.x0 - m, B.x1 + m); this.target.z += this._elast(this.target.z, g.anchor.z - cur.z, B.z0 - m, B.z1 + m); }
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
      const dx = this._elast(this.target.x, a.x - b.x, B.x0 - m, B.x1 + m), dz = this._elast(this.target.z, a.z - b.z, B.z0 - m, B.z1 + m); this.target.x += dx; this.target.z += dz;
      const t = performance.now(); g.hist.push([t, dx, dz]); while (g.hist.length && t - g.hist[0][0] > 90) g.hist.shift();
    }
    this.moved = true; this.onMove && this.onMove();
  }
  _up(e, cancel) {
    if (!this.ptrs.has(e.pointerId)) return;
    this.ptrs.delete(e.pointerId); this.dom.classList.remove('drag');
    clearTimeout(this._lt);
    const g = this.g; if (!g) return;
    if (g.type === 'two') {
      // inércia da pinça: velocidade (log da distância) dos últimos 80 ms
      const z = g.zh; if (z.length > 1 && performance.now() - z[z.length - 1][0] < 60) { const dt = (z[z.length - 1][0] - z[0][0]) / 1000; if (dt > 0.008) this._zv = clamp((z[z.length - 1][1] - z[0][1]) / dt, -4, 4); }
      this.g = this.ptrs.size ? { type: 'pan', moved: true, sx: 0, sy: 0, hist: [] } : null; return;
    }
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
    this.flyTo({ x: p.x, z: p.z, dist: Math.max(this.minDist, this.dist * 0.55) });
  }
}
