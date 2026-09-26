// Aviões e helicópteros da cidade.
// - Aviões (1 por nível do aeroporto): um laço fechado a partir do pátio: taxiam até a cabeceira sul, correm pela pista,
//   decolam para o norte, dão uma volta larga em torno da cidade, voltam em rampa de aproximação pelo sul, pousam e
//   taxiam de volta. Velocidade por trecho (lenta no chão, rápida no ar), inclinação nas curvas.
// - Helicópteros (até 4): vão de um heliponto a outro (residenciais de luxo do nível 3 em diante, hospitais e o
//   heliponto do aeroporto): sobem, cruzam inclinados para a frente, descem e esperam alguns segundos com o rotor girando.
// Cada aeronave é um grupo pequeno de malhas simples (poucos triângulos); tudo anda no update sem alocar.
import * as THREE from 'three';
import { M } from './materials.js';

const caixa = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; return m; };

function aviao() {
  const B = M.whiteSmooth || M.white, g = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 3.2, 12), B); corpo.rotation.x = Math.PI / 2; corpo.castShadow = true; g.add(corpo);
  const nariz = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), B); nariz.position.z = 1.6; nariz.scale.z = 1.6; g.add(nariz);
  g.add(caixa(3.4, 0.05, 0.6, B, 0, -0.05, 0.1)); g.add(caixa(1.2, 0.04, 0.34, B, 0, 0.05, -1.45)); // asas e estabilizador
  g.add(caixa(0.05, 0.6, 0.5, M.teal, 0, 0.32, -1.4)); g.add(caixa(0.3, 0.06, 2.6, M.teal, 0, -0.2, 0.1)); // deriva e faixa na barriga
  for (const x of [-0.8, 0.8]) { const mo = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.45, 10), M.steel); mo.rotation.x = Math.PI / 2; mo.position.set(x, -0.14, 0.3); g.add(mo); }
  g.add(caixa(0.06, 0.06, 0.06, M.redGlow, -1.7, -0.04, 0.1)); g.add(caixa(0.06, 0.06, 0.06, M.cyanGlow, 1.7, -0.04, 0.1)); return g;
}
function helicoptero() {
  const g = new THREE.Group(); const cab = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), M.red); cab.scale.set(0.9, 0.85, 1.3); cab.castShadow = true; g.add(cab);
  const vid = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.glass); vid.rotation.x = Math.PI / 2 - 0.4; vid.position.set(0, 0.04, 0.2); g.add(vid);
  g.add(caixa(0.07, 0.07, 0.9, M.red, 0, 0.06, -0.7)); g.add(caixa(0.03, 0.26, 0.14, M.red, 0, 0.16, -1.12));
  for (const x of [-0.18, 0.18]) g.add(caixa(0.03, 0.03, 0.7, M.steelDark, x, -0.3, 0));
  const rotor = new THREE.Group(); rotor.add(caixa(2.0, 0.015, 0.06, M.dark)); rotor.add(caixa(0.06, 0.015, 2.0, M.dark)); rotor.position.y = 0.34; g.add(rotor);
  const cauda = caixa(0.02, 0.4, 0.04, M.dark, 0.05, 0.16, -1.12); g.add(cauda); g.userData.rotor = rotor; g.userData.cauda = cauda; return g;
}

export class Aereo {
  constructor() {
    this.group = new THREE.Group(); this.group.name = 'aereo'; this.avioes = []; this.helis = []; this._laco = null; this._pads = []; this._chave = '';
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._m = new THREE.Matrix4(); this._up = new THREE.Vector3(0, 1, 0);
  }
  // laço dos aviões em mundo: pista ao longo de z em (px, z de -L a L), pátio em (ax, az); volta em torno de (cx, cz)
  _fazLaco(A) {
    const px = A.px, L = A.L, ax = A.ax, cx = A.cx, cz = A.cz, R = A.R;
    const P = [], V = []; const p = (x, y, z, v) => { P.push(new THREE.Vector3(x, y, z)); V.push(v); };
    p(ax, 0.3, 4, 1.2); p(ax + 3, 0.3, -L + 2, 1.5); p(px, 0.3, -L - 1, 1.2); // taxia do pátio até a cabeceira sul
    p(px, 0.3, -L + 6, 5); p(px, 0.3, -L + 20, 11); p(px, 2.5, L - 4, 14); p(px, 9, L + 22, 16); // corrida e decolagem para o norte
    // volta em torno da cidade no sentido da decolagem (ângulo crescendo a partir da cabeceira norte), até o sul da pista
    const a0 = Math.atan2((L + 22 - cz) / (R * 0.8), (px - cx) / R), n = 14; for (let k = 1; k < n; k++) { const a = a0 + (k / n) * (Math.PI * 2 - 1.2); p(cx + Math.cos(a) * R, 26 + 6 * Math.sin(k * 0.9), cz + Math.sin(a) * R * 0.8, 18); }
    p(px + 10, 16, -L - 60, 15); p(px, 9, -L - 32, 12); p(px, 3, -L - 10, 10); p(px, 0.3, -L + 4, 8); p(px, 0.3, -L + 22, 4); // aproximação e pouso
    p(px - 2, 0.3, 0, 1.5); p(ax + 3, 0.3, 2, 1.2); // taxia de volta
    const c = new THREE.CatmullRomCurve3(P, true, 'centripetal', 0.5); const N = 600, pts = c.getSpacedPoints(N); const vel = new Float32Array(N + 1);
    // velocidade por ponto: a do ponto de controle mais perto
    for (let i = 0; i <= N; i++) { let best = 0, bd = 1e9; for (let k = 0; k < P.length; k++) { const d = pts[i].distanceToSquared(P[k]); if (d < bd) { bd = d; best = k; } } vel[i] = V[best]; }
    for (let r = 0; r < 3; r++) for (let i = 0; i <= N; i++) vel[i] = (vel[Math.max(0, i - 1)] + vel[i] + vel[Math.min(N, i + 1)]) / 3; // suaviza
    return { curva: c, pts, vel, L: c.getLength(), N };
  }
  // A: {px, L, ax, cx, cz, R, n} (n aviões) ou null; pads: [[x, y, z]]
  sincronizar(A, pads) {
    const chave = (A ? `${A.n}:${A.px}` : '-') + '|' + pads.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(';'); if (chave === this._chave) return; this._chave = chave;
    if (A && !this._laco) this._laco = this._fazLaco(A);
    const nA = A ? A.n : 0; while (this.avioes.length < nA) { const g = aviao(); g.userData.u = this.avioes.length / 3; this.avioes.push(g); this.group.add(g); }
    while (this.avioes.length > nA) this.group.remove(this.avioes.pop());
    this._pads = pads; const nH = pads.length >= 2 ? Math.min(4, pads.length - 1) : 0;
    while (this.helis.length < nH) { const g = helicoptero(); const k = this.helis.length; g.userData.de = k % pads.length; g.userData.para = (k + 1) % pads.length; g.userData.t = -k * 4; this.helis.push(g); this.group.add(g); }
    while (this.helis.length > nH) this.group.remove(this.helis.pop());
    for (const h of this.helis) { h.userData.de %= pads.length; h.userData.para %= pads.length; if (h.userData.de === h.userData.para) h.userData.para = (h.userData.de + 1) % pads.length; }
  }
  update(dt) {
    dt = Math.min(dt, 0.1); const T = this._laco;
    if (T) for (const g of this.avioes) {
      const i = Math.round(g.userData.u * T.N) % (T.N + 1); g.userData.u = (g.userData.u + (T.vel[i] * dt) / T.L) % 1;
      const u = g.userData.u; T.curva.getPointAt(u, this._v); T.curva.getPointAt((u + 0.004) % 1, this._w); g.position.copy(this._v);
      this._m.lookAt(this._w, this._v, this._up); g.quaternion.setFromRotationMatrix(this._m);
      // inclinação na curva: pela mudança de rumo à frente
      T.curva.getPointAt((u + 0.012) % 1, this._v); const a1 = Math.atan2(this._w.x - g.position.x, this._w.z - g.position.z), a2 = Math.atan2(this._v.x - this._w.x, this._v.z - this._w.z);
      let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; g.rotateZ(g.position.y > 3 ? Math.max(-0.5, Math.min(0.5, -d * 6)) : 0);
    }
    const P = this._pads;
    for (const h of this.helis) {
      const U = h.userData; U.rotor.rotation.y += dt * 30; U.cauda.rotation.x += dt * 40; U.t += dt; if (U.t < 0) { const [x, y, z] = P[U.de]; h.position.set(x, y + 0.34, z); continue; }
      const [x0, y0, z0] = P[U.de], [x1, y1, z1] = P[U.para]; const alto = Math.max(y0, y1) + 9, dist = Math.hypot(x1 - x0, z1 - z0), tv = dist / 7, tSobe = (alto - y0) / 3, tDesce = (alto - y1) / 3, tEspera = 6;
      const t = U.t; let x = x0, y = y0, z = z0, incl = 0;
      if (t < tSobe) y = y0 + (alto - y0) * (t / tSobe);
      else if (t < tSobe + tv) { const k = (t - tSobe) / tv, e = k * k * (3 - 2 * k); x = x0 + (x1 - x0) * e; z = z0 + (z1 - z0) * e; y = alto; incl = Math.sin(k * Math.PI) * 0.25; }
      else if (t < tSobe + tv + tDesce) { x = x1; z = z1; y = alto - (alto - y1) * ((t - tSobe - tv) / tDesce); }
      else { x = x1; z = z1; y = y1; if (t > tSobe + tv + tDesce + tEspera) { U.de = U.para; U.para = (U.para + 1 + Math.floor(Math.random() * Math.max(1, P.length - 1))) % P.length; if (U.para === U.de) U.para = (U.de + 1) % P.length; U.t = 0; } }
      h.position.set(x, y + 0.34, z); h.rotation.set(incl, Math.atan2(x1 - x0, z1 - z0), 0, 'YXZ');
    }
  }
}
