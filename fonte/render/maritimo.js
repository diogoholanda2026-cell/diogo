// Barcos do porto: iates navegando em laços ao largo da marina (2 + 2 por nível do porto), o cargueiro que chega do
// alto-mar, fundeia perto do porto e volta (nível 2+) e o navio de cruzeiro numa volta larga (nível 3). Tudo no nível
// do mar, com um leve balanço; poucas malhas simples por barco, atualizadas sem alocar.
import * as THREE from 'three';
import { M } from './materials.js';
import { bake } from './geom.js'; // cada barco vira poucas malhas (uma por material)

const MAR = -0.25;
const caixa = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; return m; };
// iate de luxo (casco branco com proa em cunha, cabine com vidro escuro e deque de madeira); também atracado na marina
export function iate(esc = 1) {
  const g = new THREE.Group(), B = M.whiteSmooth || M.white; const casco = caixa(0.44, 0.22, 1.25, B, 0, -0.1, -0.08); g.add(casco);
  const proa = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 4, 1), B); proa.rotation.set(Math.PI / 2, Math.PI / 4, 0); proa.scale.set(1, 1, 0.5); proa.position.set(0, 0.01, 0.78); g.add(proa);
  g.add(caixa(0.34, 0.14, 0.62, B, 0, 0.12, -0.12)); g.add(caixa(0.36, 0.05, 0.64, M.dark, 0, 0.17, -0.12)); g.add(caixa(0.26, 0.1, 0.34, B, 0, 0.26, -0.18)); g.add(caixa(0.45, 0.03, 1.26, M.madeiraClara, 0, 0.115, -0.08));
  g.scale.setScalar(esc); return g;
}
function cargueiro() {
  const g = new THREE.Group(), COR = [M.orange, M.blue, M.red, M.teal, M.yellow];
  g.add(caixa(2.4, 1.1, 18, M.dark, 0, -0.6)); g.add(caixa(2.42, 0.16, 17.9, M.red, 0, -0.6));
  for (let k = 0; k < 11; k++) for (let c = 0; c < 3; c++) g.add(caixa(0.7, 0.3 * (1 + ((k + c) % 3)), 1.1, COR[(k + c) % 5], -0.75 + c * 0.75, 0.5, -8 + k * 1.25));
  g.add(caixa(2.0, 1.5, 1.5, M.whiteSmooth || M.white, 0, 0.5, 7.8)); g.add(caixa(2.02, 0.12, 1.52, M.dark, 0, 1.6, 7.8)); return g;
}
function cruzeiro() {
  const g = new THREE.Group(), B = M.whiteSmooth || M.white; g.add(caixa(2.8, 1.2, 17, B, 0, -0.7)); g.add(caixa(2.82, 0.14, 16.9, M.blue, 0, -0.4));
  for (let d = 0; d < 5; d++) { const w = 2.6 - d * 0.3, l = 15.5 - d * 1.8; g.add(caixa(w, 0.34, l, B, 0, 0.5 + d * 0.38, 0.4 * d)); g.add(caixa(w + 0.02, 0.09, l - 0.2, M.dark, 0, 0.62 + d * 0.38, 0.4 * d)); }
  const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1.0, 12), M.red); ch.position.set(0, 2.9, 3.6); g.add(ch); return g;
}
export class Maritimo {
  constructor() { this.group = new THREE.Group(); this.group.name = 'maritimo'; this.iates = []; this.carga = null; this.cruz = null; this._chave = ''; this.t = 0; }
  // P: {nivel, x, z} do porto (cais em x, o mar a oeste) ou null
  sincronizar(P) {
    const chave = P ? `${P.nivel}:${P.x}:${P.z}` : '-'; if (chave === this._chave) return; this._chave = chave; this.P = P;
    const nI = P ? 2 + 2 * P.nivel : 0;
    while (this.iates.length < nI) { const k = this.iates.length, g = bake(iate(1.3 + (k % 3) * 0.25)); g.userData = { a: k * 1.7, cx: -30 - (k % 4) * 9, cz: (k % 2 ? 1 : -1) * (12 + k * 3), rx: 12 + (k % 3) * 5, rz: 22 + (k % 4) * 6, v: (0.07 + (k % 3) * 0.018) * (k % 2 ? 1 : -1) }; this.iates.push(g); this.group.add(g); }
    while (this.iates.length > nI) this.group.remove(this.iates.pop());
    if (P && P.nivel >= 2 && !this.carga) { this.carga = bake(cargueiro()); this.group.add(this.carga); } else if ((!P || P.nivel < 2) && this.carga) { this.group.remove(this.carga); this.carga = null; }
    if (P && P.nivel >= 3 && !this.cruz) { this.cruz = bake(cruzeiro()); this.group.add(this.cruz); } else if ((!P || P.nivel < 3) && this.cruz) { this.group.remove(this.cruz); this.cruz = null; }
    this.group.visible = !!P;
  }
  update(dt) {
    const P = this.P; if (!P) return; dt = Math.min(dt, 0.1); this.t += dt; const t = this.t;
    for (const g of this.iates) { const U = g.userData; U.a += U.v * dt; const x = P.x + U.cx + Math.cos(U.a) * U.rx, z = P.z + U.cz + Math.sin(U.a) * U.rz; const dx = -Math.sin(U.a) * U.rx * Math.sign(U.v), dz = Math.cos(U.a) * U.rz * Math.sign(U.v);
      g.position.set(x, MAR + 0.02 + Math.sin(t * 1.3 + U.a * 3) * 0.02, z); g.rotation.set(Math.sin(t * 0.9 + U.a) * 0.03, Math.atan2(dx, dz), Math.sin(t * 1.1 + U.a) * 0.04); }
    // cargueiro: 150 s de ciclo: vem do alto-mar (60 s), fica fundeado (30 s), volta (60 s)
    if (this.carga) { const c = (t % 150) / 150, ida = Math.min(1, c / 0.4), volta = Math.max(0, (c - 0.6) / 0.4), k = c < 0.4 ? ida * ida * (3 - 2 * ida) : c < 0.6 ? 1 : 1 - volta * volta * (3 - 2 * volta);
      const x0 = P.x - 240, z0 = P.z - 150, x1 = P.x - 32, z1 = P.z - 40; this.carga.position.set(x0 + (x1 - x0) * k, MAR + Math.sin(t * 0.6) * 0.03, z0 + (z1 - z0) * k); this.carga.rotation.y = Math.atan2(x1 - x0, z1 - z0) + (c >= 0.6 ? Math.PI : 0); }
    if (this.cruz) { const a = t * 0.012; this.cruz.position.set(P.x - 150 + Math.cos(a) * 80, MAR + Math.sin(t * 0.5) * 0.03, P.z + Math.sin(a) * 110); this.cruz.rotation.y = Math.atan2(-Math.sin(a) * 80, Math.cos(a) * 110); }
  }
}
