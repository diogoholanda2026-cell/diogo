// Terreno da maquete: malha com lagos rebaixados e o fosso do acelerador, textura pintada
// a partir da planta mestra (floresta, gramados, praça, areia, trilhas) e textura de detalhe.
import * as THREE from 'three';
import { MESA, A, ZONAS, SANTUARIO_GRAMADO } from '../data/planta.js';
import { hash, vnoise, fbm, inPoly, inEllipse, clamp, smooth } from '../core/util.js';
import { tex, canvasTex } from './textures.js';

const S = 32; // pixels de textura por unidade
const W = (MESA.x1 - MESA.x0), D = (MESA.z1 - MESA.z0);
export const toPx = (x, z) => [(x - MESA.x0) * S, (z - MESA.z0) * S];

function polyDist(x, z, poly) { // distância com sinal até a borda do polígono (negativa dentro)
  let d = 1e9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i]; const vx = bx - ax, vz = bz - az; const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
    d = Math.min(d, Math.hypot(x - (ax + vx * t), z - (az + vz * t)));
  }
  return inPoly(x, z, poly) ? -d : d;
}
function ellDist(x, z, cx, cz, rx, rz, rot = 0) {
  const c = Math.cos(-rot), s = Math.sin(-rot); const dx = x - cx, dz = z - cz; const u = dx * c - dz * s, v = dx * s + dz * c;
  const k = Math.hypot(u / rx, v / rz); return (k - 1) * Math.min(rx, rz);
}
// profundidade da água num ponto (0 = seco)
export function waterDepth(x, z) {
  let d = polyDist(x, z, A.lago);
  const di = Math.hypot(x - A.ilha.c[0], z - A.ilha.c[1]) - A.ilha.r;
  if (d < 0 && di < 0) d = Math.max(d, -di);
  let wd = d < 0 ? smooth(clamp(-d / 1.2, 0, 1)) : 0;
  const s = A.santuario; const ls = ellDist(x, z, s.c[0] + 2.4, s.c[1] + 0.2, 2.2, 1.3, 0.3); if (ls < 0) wd = Math.max(wd, smooth(clamp(-ls / 0.8, 0, 1)) * 0.8);
  const lp = ellDist(x, z, 16.8, -0.4, 1.3, 0.7, 0.2); if (lp < 0) wd = Math.max(wd, smooth(clamp(-lp / 0.5, 0, 1)) * 0.6);
  return wd;
}
export function inPit(x, z) { const p = A.acelerador; return inEllipse(x, z, p.c[0], p.c[1], p.rx, p.rz); }
export function heightAt(x, z) {
  const w = waterDepth(x, z); if (w > 0) return -0.42 * w;
  let h = 0;
  // relevo suave apenas na floresta (longe das clareiras)
  const clear = clearance(x, z); if (clear > 0) h += (fbm(x, z, 5, 3, 3) - 0.45) * 0.35 * clamp(clear / 2, 0, 1);
  const edge = Math.min(x - MESA.x0, MESA.x1 - x, z - MESA.z0, MESA.z1 - z); h *= clamp(edge / 1.5, 0, 1);
  return h;
}
// distância até a clareira mais próxima (>0 dentro da floresta)
export function clearance(x, z) {
  let d = 1e9;
  for (const Z of ZONAS) {
    if (Z.poly) d = Math.min(d, polyDist(x, z, Z.poly));
    else { const [c, rx, rz, rot] = Z.elipse; d = Math.min(d, ellDist(x, z, c[0], c[1], rx, rz, rot)); }
  }
  return d;
}
export function isForest(x, z) {
  if (waterDepth(x, z) > 0.02) return false;
  if (clearance(x, z) < 0.25) return false;
  return true;
}

export class Ground {
  constructor(engine) {
    this.e = engine; this.group = new THREE.Group(); engine.scene.add(this.group);
    this.canvas = document.createElement('canvas'); this.canvas.width = W * S; this.canvas.height = D * S;
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.flags = {};
    this._buildMesh();
    this._buildWater();
    this.paint();
  }
  _buildMesh() {
    const SX = 256, SZ = 160; const g = new THREE.PlaneGeometry(W, D, SX, SZ); g.rotateX(-Math.PI / 2); g.translate((MESA.x0 + MESA.x1) / 2, 0, (MESA.z0 + MESA.z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, heightAt(x, z)); uv.setXY(i, (x - MESA.x0) / W, 1 - (z - MESA.z0) / D); }
    // remove os triângulos do fosso do acelerador
    const idx = g.index.array; const keep = [];
    for (let k = 0; k < idx.length; k += 3) { const a = idx[k], b = idx[k + 1], c = idx[k + 2]; const cx = (p.getX(a) + p.getX(b) + p.getX(c)) / 3, cz = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3; if (!inPit(cx, cz)) keep.push(a, b, c); }
    g.setIndex(keep); g.computeVertexNormals();
    const detail = canvasTex('gdetail', 256, 256, (c, w, h) => {
      const img = c.createImageData(w, h); const d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = vnoise(x, y, 6, 5) * 0.5 + hash(x, y, 6) * 0.3 + vnoise(x, y, 23, 7) * 0.2; const v = 108 + n * 40; const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      c.putImageData(img, 0, 0);
    }, { linear: true });
    const mat = new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.96, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.detailMap = { value: detail };
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        vec3 dtl = texture2D(detailMap, vMapUv * vec2(${(W * 1.6).toFixed(2)}, ${(D * 1.6).toFixed(2)})).rgb;
        diffuseColor.rgb *= dtl * 1.7;`).replace('void main() {', 'uniform sampler2D detailMap;\nvoid main() {');
    };
    this.mesh = new THREE.Mesh(g, mat); this.mesh.receiveShadow = true; this.group.add(this.mesh);
    // tampa do poço do acelerador (terreno intacto até a escavação)
    const a = A.acelerador; const tg = new THREE.CircleGeometry(1, 48); tg.rotateX(-Math.PI / 2); tg.scale(a.rx + 0.15, 1, a.rz + 0.15); tg.translate(a.c[0], 0.004, a.c[1]);
    const tp = tg.attributes.position, tuv = tg.attributes.uv; for (let i = 0; i < tp.count; i++) tuv.setXY(i, (tp.getX(i) - MESA.x0) / W, 1 - (tp.getZ(i) - MESA.z0) / D);
    this.tampa = new THREE.Mesh(tg, mat); this.tampa.receiveShadow = true; this.group.add(this.tampa);
  }
  _buildWater() {
    const mk = (shape, mat, y) => { const g = new THREE.ShapeGeometry(shape, 32); g.rotateX(-Math.PI / 2); const pa = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < pa.count; i++) uv.setXY(i, pa.getX(i) / 6, pa.getZ(i) / 6); const m = new THREE.Mesh(g, mat); m.position.y = y; m.receiveShadow = true; this.group.add(m); return m; };
    const shp = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const lago = shp(A.lago); const hole = new THREE.Path(); for (let i = 0; i < 24; i++) { const a = -(i / 24) * Math.PI * 2; hole.lineTo ? 0 : 0; }
    const ilha = new THREE.Path(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; const x = A.ilha.c[0] + Math.cos(a) * (A.ilha.r - 0.05), z = A.ilha.c[1] + Math.sin(a) * (A.ilha.r - 0.05); i ? ilha.lineTo(x, -z) : ilha.moveTo(x, -z); }
    lago.holes.push(ilha);
    this.waterMat = this.e.mats.water;
    this.lake = mk(lago, this.waterMat, -0.1);
    const ell = (cx, cz, rx, rz, rot) => { const s = new THREE.Shape(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; const u = Math.cos(a) * rx, v = Math.sin(a) * rz; const x = cx + u * Math.cos(rot) - v * Math.sin(rot), z = cz + u * Math.sin(rot) + v * Math.cos(rot); i ? s.lineTo(x, -z) : s.moveTo(x, -z); } return s; };
    const s = A.santuario; mk(ell(s.c[0] + 2.4, s.c[1] + 0.2, 2.25, 1.35, 0.3), this.waterMat, -0.08);
    mk(ell(16.8, -0.4, 1.35, 0.75, 0.2), this.waterMat, -0.06);
  }
  // Pinta a textura do chão. flags: { praca, canteiro, reflorestado }
  paint(flags = this.flags) {
    this.flags = flags; const c = this.canvas.getContext('2d'); const w = this.canvas.width, h = this.canvas.height;
    const P = (x, z) => toPx(x, z);
    const pat = (t) => c.createPattern(t.userData.canvas || t.image, 'repeat');
    const path = (poly) => { c.beginPath(); poly.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); };
    const ell = ([cx, cz], rx, rz, rot = 0) => { c.beginPath(); const [px, py] = P(cx, cz); c.ellipse(px, py, rx * S, rz * S, rot, 0, Math.PI * 2); };
    // 1) chão de floresta (copas escuras vistas de cima)
    c.filter = 'none'; c.globalAlpha = 1;
    c.fillStyle = pat(tex.forestFloor()); c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const x = hash(i, 1, 501) * w, y = hash(i, 2, 501) * h, r = 6 + hash(i, 3, 501) * 22; c.fillStyle = `rgba(${14 + hash(i, 4, 501) * 30},${40 + hash(i, 5, 501) * 40},${16 + hash(i, 6, 501) * 20},0.55)`; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    // 2) clareiras: pasto degradado no início; gramado quando a obra da área começa
    const V = flags.verde || {};
    c.filter = 'blur(10px)'; c.fillStyle = '#6a6440';
    for (const Z of ZONAS) { if (Z.poly) path(Z.poly); else { const [cc, rx, rz, rot] = Z.elipse; ell(cc, rx + 0.5, rz + 0.5, rot); } c.fill(); }
    c.filter = 'none';
    const zona = (Z) => { if (Z.poly) path(Z.poly); else { const [cc, rx, rz, rot] = Z.elipse; ell(cc, rx, rz, rot); } };
    c.save(); c.globalAlpha = 0.95;
    for (const Z of ZONAS) { if (Z.tipo === 'praca' || Z.tipo === 'canteiro') continue; if (Z.tipo === 'areia' && V[Z.id]) continue; c.fillStyle = pat(V[Z.id] ? tex.grass() : tex.pasto()); zona(Z); c.fill(); }
    { const [cc, rx, rz, rot] = SANTUARIO_GRAMADO.elipse; c.fillStyle = pat(V.santuario ? tex.grass() : tex.pasto()); ell(cc, rx, rz, rot); c.fill(); }
    c.restore();
    // 3) savana
    if (V.savana) { c.save(); c.filter = 'blur(4px)'; c.fillStyle = pat(tex.sand()); path(A.savana.poly); c.fill(); c.restore(); }
    // 4) margens e leitos d'água (areia clara nas bordas, fundo escuro)
    c.save(); c.filter = 'blur(3px)'; c.lineWidth = 0.9 * S; c.strokeStyle = '#b9a47c'; path(A.lago); c.stroke(); c.fillStyle = '#1f4a4a'; path(A.lago); c.fill(); c.restore();
    c.save(); const sa = A.santuario; c.filter = 'blur(3px)'; c.fillStyle = '#1f4a4a'; ell([sa.c[0] + 2.4, sa.c[1] + 0.2], 2.3, 1.4, 0.3); c.fill(); ell([16.8, -0.4], 1.4, 0.8, 0.2); c.fill(); c.restore();
    // 5) trilhas de terra/cascalho pelos gramados e pela savana
    c.save(); c.strokeStyle = 'rgba(214,196,160,0.85)'; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 0.32 * S; c.filter = 'blur(1px)';
    const trail = (pts) => { c.beginPath(); pts.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.stroke(); };
    const T = [
      ['savana', [[11.6, -2.6], [14.2, 0.4], [13.6, 3.4], [16.8, 5.0], [19.4, 3.0]]], ['savana', [[18.2, -2.0], [19.6, 0.6], [18.6, 4.4]]],
      ['bioma', [[20.4, 9.8], [22.6, 9.0], [25.2, 8.4], [26.6, 6.0]]], ['vila', [[17.2, 12.0], [18.4, 11.2], [21.0, 11.4], [23.4, 12.0]]],
      ['acelerador', [[9.8, 14.6], [12.4, 16.2], [14.0, 18.8]]], ['ciencias', [[-3.6, -2.4], [0.8, -2.8], [5.4, -2.2], [8.6, -0.6]]],
      ['uni', [[-15.6, -6.8], [-12.4, -5.6], [-9.8, -4.8]]], ['santuario', [[8.4, -8.2], [10.6, -11.4], [13.6, -13.8]]],
    ];
    for (const [id, pts] of T) if (V[id]) trail(pts);
    c.restore();
    // 6) praça central (pavimento) ou área gramada provisória
    c.save(); path(A.praca.poly);
    if (flags.praca) { c.fillStyle = pat(tex.pavers()); c.fill(); c.strokeStyle = 'rgba(120,96,70,.35)'; c.lineWidth = 3; const [cx, cy] = P(4.8, 15.6); for (let r = 1; r < 5; r++) { c.beginPath(); c.arc(cx, cy, r * 1.1 * S, 0, 7); c.stroke(); } }
    else { c.fillStyle = pat(tex.grass()); c.fill(); }
    c.restore();
    // 7) canteiro de obras (terra batida) ou reflorestamento
    c.save(); path(A.canteiro.poly);
    if (!flags.reflorestado) { c.filter = 'blur(2px)'; c.fillStyle = pat(tex.soil()); c.fill(); c.strokeStyle = 'rgba(80,60,40,.5)'; c.lineWidth = 2; for (let i = 0; i < 40; i++) { const [px, py] = P(-30 + hash(i, 1, 77) * 9, 11 + hash(i, 2, 77) * 8); c.beginPath(); c.moveTo(px, py); c.lineTo(px + 40, py + 6); c.stroke(); } }
    c.restore();
    // 8) sombreamento de oclusão sob as bordas da floresta
    this.tex.needsUpdate = true;
  }
  update(t) { const n = this.waterMat.normalMap; if (n) { n.offset.x = t * 0.000012; n.offset.y = t * 0.000008; } }
}
