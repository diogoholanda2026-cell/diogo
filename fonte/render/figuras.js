// Figuras em escala (pessoas, operários) com cor por instância aplicada só às roupas.
// Escala: 1 andar (FH) ~ 3 m, então uma pessoa de 1,75 m tem ~0,27 unidades.
// Pernas e braços giram no vertex shader (atributo aPart por vértice e aAnim por instância: fase do
// passo, amplitude e martelo): a fase anda com a distância percorrida (passo de 0,1 u), então a
// cadência acompanha a velocidade e congela com a figura parada.
import * as THREE from 'three';

const H = 0.27, QUADRIL = H * 0.46, OMBRO = H * 0.78, PASSO = 0.1;
function part(g, col, mask, id = 0) {
  if (g.index) g = g.toNonIndexed();
  const n = g.attributes.position.count; const c = new Float32Array(n * 4), p = new Float32Array(n);
  for (let i = 0; i < n; i++) { c[i * 4] = col[0]; c[i * 4 + 1] = col[1]; c[i * 4 + 2] = col[2]; c[i * 4 + 3] = mask; p[i] = id; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 4)); g.setAttribute('aPart', new THREE.BufferAttribute(p, 1)); if (g.attributes.uv) g.deleteAttribute('uv'); return g;
}
function join(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 4), A = new Float32Array(n); let o = 0;
  for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 4); A.set(g.attributes.aPart.array, o); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 4)); out.setAttribute('aPart', new THREE.BufferAttribute(A, 1));
  out.computeBoundingSphere(); out.userData.compartilhada = true; return out;
}
const SKIN = [0.62, 0.45, 0.34], DARK = [0.08, 0.08, 0.1], CAMISA = [0.34, 0.4, 0.5], CAPACETE = [0.95, 0.78, 0.1];
let G = null;
export function figureGeos() {
  if (G) return G;
  // pernas (1 esquerda, 2 direita) presas no quadril e braços (3, 4) no ombro
  const legs = () => { const a = new THREE.BoxGeometry(0.028, QUADRIL, 0.03); a.translate(-0.018, QUADRIL / 2, 0); const b = new THREE.BoxGeometry(0.028, QUADRIL, 0.03); b.translate(0.018, QUADRIL / 2, 0); return [part(a, DARK, 0, 1), part(b, DARK, 0, 2)]; };
  const arms = (col, mask) => { const a = new THREE.BoxGeometry(0.018, 0.1, 0.018); a.translate(-0.041, OMBRO - 0.05, 0); const b = new THREE.BoxGeometry(0.018, 0.1, 0.018); b.translate(0.041, OMBRO - 0.05, 0); return [part(a, col, mask, 3), part(b, col, mask, 4)]; };
  const torso = (col, mask) => { const t = new THREE.CapsuleGeometry(0.03, H * 0.2, 2, 6); t.scale(1, 1, 0.7); t.translate(0, H * 0.62, 0); return part(t, col, mask); };
  const head = () => { const h = new THREE.SphereGeometry(0.026, 6, 5); h.translate(0, H * 0.9, 0); return part(h, SKIN, 0); };
  const helmet = () => { const h = new THREE.SphereGeometry(0.03, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2); h.translate(0, H * 0.92, 0); return part(h, CAPACETE, 0); };
  const vest = () => { const v = new THREE.BoxGeometry(0.066, H * 0.16, 0.05); v.translate(0, H * 0.64, 0); return part(v, [1, 1, 1], 1); }; // colete: cor da instância
  // figura de longe (24 triângulos contra 156): pernas num prisma aberto de 3 faces, tronco em caixa sem
  // fundo e cabeça em octaedro; abaixo de ~12 px de altura não se distingue da figura inteira
  const semFundo = (g, topo) => { g = g.toNonIndexed(); const p = g.attributes.position.array, n = g.attributes.normal.array, P = [], N = [];
    for (let i = 0; i < p.length; i += 9) { const ny = n[i + 1]; if (ny < -0.5 || (!topo && ny > 0.5)) continue; P.push(...p.slice(i, i + 9)); N.push(...n.slice(i, i + 9)); }
    const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return o; };
  const pernasL = () => { const a = new THREE.CylinderGeometry(0.036, 0.03, QUADRIL, 3, 1, true); a.rotateY(Math.PI / 6); a.translate(0, QUADRIL / 2, 0); return part(a, DARK, 0); };
  const troncoL = () => { const t = new THREE.BoxGeometry(0.058, H * 0.38, 0.042); t.translate(0, H * 0.63, 0); return part(semFundo(t, true), [1, 1, 1], 1); };
  const cabecaL = (col) => { const h = new THREE.OctahedronGeometry(0.028); h.scale(1, 1.1, 1); h.translate(0, H * 0.9, 0); return part(h, col, 0); };
  G = {
    pessoa: join([...legs(), torso([1, 1, 1], 1), ...arms([1, 1, 1], 1), head()]),
    operario: join([...legs(), torso(CAMISA, 0), vest(), ...arms(CAMISA, 0), head(), helmet()]),
    pessoaLonge: join([pernasL(), troncoL(), cabecaL(SKIN)]),
    operarioLonge: join([pernasL(), troncoL(), cabecaL(CAPACETE)]), // de longe o capacete amarelo é a cabeça
  };
  return G;
}
const FIG_T = { value: 0 }; // relógio do martelo (segundos)
let MAT = null;
export function figureMaterial() {
  if (MAT) return MAT;
  MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8 });
  MAT.onBeforeCompile = (sh) => {
    sh.uniforms.uFigT = FIG_T;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPart; attribute vec3 aAnim; uniform float uFigT;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float fAng = 0.0; vec3 fPiv = vec3( 0.0 );
        if ( aPart > 0.5 ) {
          if ( aPart < 2.5 ) { fAng = 0.45 * aAnim.y * sin( aAnim.x ) * ( aPart < 1.5 ? 1.0 : -1.0 ); fPiv.y = ${QUADRIL.toFixed(4)}; }
          else { fAng = 0.35 * aAnim.y * sin( aAnim.x ) * ( aPart < 3.5 ? -1.0 : 1.0 ); fPiv.y = ${OMBRO.toFixed(4)};
            if ( aPart > 3.5 ) fAng -= 1.6 * aAnim.z * pow( max( 0.0, sin( 10.053 * uFigT + aAnim.x ) ), 3.0 ); }
        }
        float fc = cos( fAng ), fs = sin( fAng );
        objectNormal = vec3( objectNormal.x, objectNormal.y * fc - objectNormal.z * fs, objectNormal.y * fs + objectNormal.z * fc );`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec3 q = transformed - fPiv; transformed = fPiv + vec3( q.x, q.y * fc - q.z * fs, q.y * fs + q.z * fc ); transformed.y += 0.006 * abs( sin( aAnim.x ) ) * aAnim.y; }`)
      .replace('vColor.rgb *= instanceColor.rgb;', 'vColor.rgb = mix( color.rgb, color.rgb * instanceColor.rgb, color.a ); vColor.a = 1.0;'); // só as roupas (máscara no alfa)
  };
  MAT.customProgramCacheKey = () => 'figmask2';
  return MAT;
}
export const ROUPAS = [[0.9, 0.9, 0.92], [0.2, 0.35, 0.7], [0.75, 0.2, 0.2], [0.95, 0.75, 0.2], [0.25, 0.55, 0.35], [0.55, 0.3, 0.6], [0.95, 0.55, 0.3], [0.3, 0.3, 0.35], [0.85, 0.6, 0.7]];
// geometria rasa (os mesmos buffers da figura) com o atributo de animação próprio desta multidão
function casca(base, max) {
  const g = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(base.attributes)) g.setAttribute(k, a);
  const an = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); an.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aAnim', an);
  g.boundingSphere = base.boundingSphere; g.userData.compartilhada = true; return g;
}
const TAU = Math.PI * 2;
const angDif = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

// Multidão: instâncias que andam ao longo de caminhos (listas de pontos [x,y,z]) ou vão a postos de
// trabalho (setPosto). Com { lod: true } (e update com a câmera), quem está longe usa a figura barata
// (this.mesh) e quem está perto a figura inteira (this.perto, filho de this.mesh: 1 chamada a mais só
// quando há alguém perto). Parado, a figura para de balançar; nas pontas de um vai e vem, pausa de 1,5 a 4 s.
export class Crowd {
  constructor(kind = 'pessoa', max = 200, o = {}) {
    const G = figureGeos(); this.lod = !!(o.lod && G[kind + 'Longe']);
    this.mesh = new THREE.InstancedMesh(casca(this.lod ? G[kind + 'Longe'] : G[kind], max), figureMaterial(), max); this.mesh.count = 0; this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.max = max; this.walkers = []; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._c = new THREE.Color(1, 1, 1); this._e = new THREE.Euler();
    this.mesh.setColorAt(0, this._c);
    if (this.lod) { // as duas já com cor por instância: o mesmo programa desde a 1ª compilação
      const p = (this.perto = new THREE.InstancedMesh(casca(G[kind], max), figureMaterial(), max)); p.count = 0; p.visible = false; p.castShadow = false; p.receiveShadow = true; p.frustumCulled = false; this.mesh.add(p);
      p.setColorAt(0, this._c);
    }
  }
  // path: [[x,y,z],...]; o: {speed, loop ('pingpong'|'loop'), phase, color, idle, trabalho (martela nas pontas)}
  add(path, o = {}) {
    if (this.walkers.length >= this.max) return null;
    const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]));
    const L = cum[cum.length - 1] || 0.001;
    const w = { path, cum, L, s: (o.phase ?? Math.random()) * L, v: o.speed ?? 0.12 + Math.random() * 0.08, dir: 1, loop: o.loop ?? 'pingpong', idle: o.idle || 0, trabalho: o.trabalho ? 1 : 0, col: o.color || ROUPAS[(Math.random() * ROUPAS.length) | 0], bob: Math.random() * 6,
      x: path[0][0], y: path[0][1], z: path[0][2], ang: null, fase: Math.random() * 6, passo: 0, trab: 0, pausa: 0, esc: 1, posto: null, livre: false, slot: -1, perto: false };
    this._pos(w); this.walkers.push(w);
    if (!this.lod) this._cor(this.mesh, this.walkers.length - 1, w);
    return w;
  }
  // tira uma figura (a última toma o lugar dela)
  remover(w) {
    const W = this.walkers, i = W.indexOf(w); if (i < 0) return; const u = W.pop();
    if (u !== w) { W[i] = u; u.slot = -1; if (!this.lod) this._cor(this.mesh, i, u); }
    if (!this.lod) this.mesh.count = W.length;
  }
  // manda a figura a um posto: {x, y, z}, estado 'trabalhar' (martelo) ou 'parado', olhar [x, z] e dur
  // (segundos de trabalho; ao fim, w.livre = true para quem controla escolher o próximo). Anda no
  // nível em que está e sobe ou desce na vertical só no fim (a escada do andaime).
  setPosto(w, pos, estado = 'trabalhar', o = {}) {
    if (typeof w === 'number') w = this.walkers[w]; if (!w) return;
    const p = w.posto || (w.posto = { x: 0, y: 0, z: 0, olhar: null, dur: 0 });
    p.x = pos[0]; p.y = pos[1]; p.z = pos[2]; p.estado = estado; p.olhar = o.olhar || null; p.dur = o.dur ?? Infinity; p.t = 0; p.chegou = false; w.livre = false;
    if (o.speed) w.v = o.speed; if (o.pular) { w.x = p.x; w.y = p.y; w.z = p.z; }
  }
  soltarPosto(w) { w.posto = null; }
  clear() { this.walkers.length = 0; this.mesh.count = 0; if (this.perto) { this.perto.count = 0; this.perto.visible = false; } }
  _cor(mesh, j, w) { this._c.setRGB(w.col[0], w.col[1], w.col[2]); mesh.setColorAt(j, this._c); mesh.instanceColor.needsUpdate = true; }
  // posição no caminho (e o rumo do trecho)
  _pos(w) {
    let k = 1; while (k < w.cum.length - 1 && w.cum[k] < w.s) k++;
    const a = w.path[k - 1], b = w.path[k] || a; const seg = w.cum[k] - w.cum[k - 1] || 1; const f = Math.min(1, Math.max(0, (w.s - w.cum[k - 1]) / seg));
    w.x = a[0] + (b[0] - a[0]) * f; w.y = a[1] + (b[1] - a[1]) * f; w.z = a[2] + (b[2] - a[2]) * f;
    const dx = (b[0] - a[0]) * w.dir, dz = (b[2] - a[2]) * w.dir; if (dx * dx + dz * dz > 1e-8) { const alvo = Math.atan2(dx, dz); if (w.ang === null) w.ang = alvo; w._alvoAng = alvo; }
  }
  _anda(w, dt, t, vel) {
    let dist = 0, querPasso = 0, trab = 0;
    if (w.posto) {
      const p = w.posto, dx = p.x - w.x, dz = p.z - w.z, d = Math.hypot(dx, dz);
      if (d > 0.015) { const st = Math.min(d, w.v * vel * dt); w.x += (dx / d) * st; w.z += (dz / d) * st; dist = st; querPasso = 1; w._alvoAng = Math.atan2(dx, dz); }
      else if (Math.abs(p.y - w.y) > 0.12) { const st = Math.min(Math.abs(p.y - w.y), 0.3 * vel * dt); w.y += Math.sign(p.y - w.y) * st; dist = st * 0.5; querPasso = 0.5; } // escada
      else {
        if (!p.chegou) { p.chegou = true; p.t = 0; }
        w.y += (p.y - w.y) * (1 - Math.exp(-3 * dt)); // o nível sobe devagar com a obra
        if (p.olhar) w._alvoAng = Math.atan2(p.olhar[0] - w.x, p.olhar[1] - w.z);
        trab = p.estado === 'trabalhar' ? 1 : 0; p.t += dt * vel; if (p.t >= p.dur) w.livre = true;
      }
      if (d > 0.015 && Math.abs(p.y - w.y) <= 0.12) w.y += (p.y - w.y) * (1 - Math.exp(-3 * dt)); // pequenos degraus: acompanha andando
    } else {
      let moving = w.pausa <= 0;
      if (w.pausa > 0) { w.pausa -= dt; trab = w.trabalho; }
      if (moving && w.idle > 0 && Math.sin(t * 0.0003 + w.bob) > 0.6) moving = false;
      if (moving) {
        const s0 = w.s; w.s += w.v * vel * dt * w.dir;
        if (w.s > w.L) { if (w.loop === 'loop') w.s -= w.L; else { w.s = w.L; w.dir = -1; w.pausa = 1.5 + Math.random() * 2.5; } }
        else if (w.s < 0) { if (w.loop === 'loop') w.s += w.L; else { w.s = 0; w.dir = 1; w.pausa = 1.5 + Math.random() * 2.5; } }
        dist = Math.abs(w.s - s0); if (dist > w.L * 0.5) dist = w.v * vel * dt; querPasso = 1;
      }
      this._pos(w);
    }
    w.fase += (dist / PASSO) * Math.PI;
    w.passo += (querPasso - w.passo) * (1 - Math.exp(-8 * dt));
    w.trab = trab;
    if (w.ang === null) w.ang = w._alvoAng ?? 0;
    if (w._alvoAng !== undefined) w.ang += angDif(w.ang, w._alvoAng) * (1 - Math.exp(-10 * dt));
  }
  // cam: posição da câmera; dPerto: distância abaixo da qual a figura inteira aparece (histerese de 15%);
  // vel: multiplicador de velocidade (time-lapse)
  update(dt, t, cam = null, dPerto = 0, vel = 1) {
    FIG_T.value = t / 1000;
    const W = this.walkers; if (!W.length) { this.mesh.count = 0; this.mesh.visible = false; if (this.perto) { this.perto.count = 0; this.perto.visible = false; } return; }
    const lod = this.lod; let kl = 0, kp = 0; const aL = this.mesh.geometry.attributes.aAnim, aP = lod ? this.perto.geometry.attributes.aAnim : null;
    for (let i = 0; i < W.length; i++) {
      const w = W[i]; this._anda(w, dt, t, vel);
      this._p.set(w.x, w.y, w.z); this._e.set(0, w.ang, 0); this._q.setFromEuler(this._e); this._s.setScalar(w.esc); this._m.compose(this._p, this._q, this._s);
      let alvo = this.mesh, j = i, an = aL;
      if (lod) {
        const d2 = cam ? this._p.distanceToSquared(cam) : Infinity, lim = w.perto ? dPerto * 1.15 : dPerto; w.perto = d2 < lim * lim;
        alvo = w.perto ? this.perto : this.mesh; j = w.perto ? kp++ : kl++; an = w.perto ? aP : aL; const slot = w.perto ? -2 - j : j;
        if (w.slot !== slot) { w.slot = slot; this._cor(alvo, j, w); }
      }
      alvo.setMatrixAt(j, this._m); const A = an.array; A[j * 3] = w.fase; A[j * 3 + 1] = w.passo; A[j * 3 + 2] = w.trab;
    }
    if (!lod) { this.mesh.count = W.length; this.mesh.visible = true; this.mesh.instanceMatrix.needsUpdate = true; aL.needsUpdate = true; return; }
    this.mesh.count = kl; this.mesh.visible = true; this.mesh.material.visible = kl > 0; this.perto.count = kp; this.perto.visible = kp > 0; // longe vazio: sem chamada (a de perto é filha da malha)
    if (kl) { this.mesh.instanceMatrix.needsUpdate = true; aL.needsUpdate = true; } if (kp) { this.perto.instanceMatrix.needsUpdate = true; aP.needsUpdate = true; }
  }
}
