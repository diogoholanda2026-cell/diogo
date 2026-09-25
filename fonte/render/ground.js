// Terreno da maquete: malha com lagos rebaixados e o fosso do acelerador, textura pintada a partir
// da planta mestra (floresta, gramados, praça, pastos, trilhas, vias) e duas texturas de detalhe (grão
// de perto e flocagem que some de longe). A água dos lagos lê um mapa da distância até a margem.
import * as THREE from 'three';
import { MESA, A, ZONAS, SANTUARIO_GRAMADO } from '../data/planta.js';
import { hash, vnoise, fbm, inPoly, inEllipse, clamp, smooth } from '../core/util.js';
import { tex, canvasTex } from './textures.js';
import { AGUA } from './materials.js';

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
// lagoa do Santuário (da planta, se houver) e bebedouro da savana
const lagoSant = () => { const s = A.santuario; return s.lago || { c: [s.c[0] + 2.4, s.c[1] + 0.2], rx: 2.2, rz: 1.3, rot: 0.3 }; };
const bebedouro = () => A.savana.lago || { c: [16.8, -0.4], rx: 1.3, rz: 0.7, rot: 0.2 };
// profundidade da água num ponto (0 = seco)
export function waterDepth(x, z) {
  let d = polyDist(x, z, A.lago);
  const di = Math.hypot(x - A.ilha.c[0], z - A.ilha.c[1]) - A.ilha.r;
  if (d < 0 && di < 0) d = Math.max(d, -di);
  let wd = d < 0 ? smooth(clamp(-d / 1.2, 0, 1)) : 0;
  const s = lagoSant(); const ls = ellDist(x, z, s.c[0], s.c[1], s.rx, s.rz, s.rot || 0); if (ls < 0) wd = Math.max(wd, smooth(clamp(-ls / 0.8, 0, 1)) * 0.8);
  const b = bebedouro(); const lp = ellDist(x, z, b.c[0], b.c[1], b.rx, b.rz, b.rot || 0); if (lp < 0) wd = Math.max(wd, smooth(clamp(-lp / 0.5, 0, 1)) * 0.6);
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
// polilinha suave (Catmull-Rom) para caminhos e trilhas
function suave(pts, n = 8) {
  if (pts.length < 3) return pts; const out = []; const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; const a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2); out.push([0, 1].map((j) => 0.5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3))); }
  out.push(pts[pts.length - 1]); return out;
}
// caminhos em leque da praça: da planta ou curvas do bulevar ao acelerador, ao Anel e à frente
function caminhosPraca() {
  if (A.pracaCaminhos) return A.pracaCaminhos;
  const o = [2.2, 13.6]; const curva = (b, k) => { const m = [(o[0] + b[0]) / 2 + (b[1] - o[1]) * k, (o[1] + b[1]) / 2 - (b[0] - o[0]) * k]; return [o, m, b]; };
  return [curva(A.acelerador.c, 0.12), curva([-2.0, 13.0], 0.1), curva([1.0, 19.2], -0.14), curva([5.5, 19.4], 0.12), curva([9.0, 12.6], -0.08)];
}

export class Ground {
  constructor(engine) {
    this.e = engine; this.group = new THREE.Group(); engine.scene.add(this.group);
    this.canvas = document.createElement('canvas'); this.canvas.width = W * S; this.canvas.height = D * S;
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.flags = {}; this._sujo = false; this.adiarAte = 0; this.stats = { pinturas: 0, ms: 0 }; // adiarAte: a festa da aprovação segura a pintura
    this._buildMesh();
    this._buildWater();
    this._pintar();
  }
  _buildMesh() {
    const SX = 160, SZ = 100; const g = new THREE.PlaneGeometry(W, D, SX, SZ); g.rotateX(-Math.PI / 2); g.translate((MESA.x0 + MESA.x1) / 2, 0, (MESA.z0 + MESA.z1) / 2);
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
    }, { linear: true }); // (usada a meia força: grão fino, sem manchas)
    // flocagem de maquete: grão fino e fiapos, visto só de perto (9 repetições por unidade)
    const floc = canvasTex('gfloc', 256, 256, (c, w, h) => {
      const img = c.createImageData(w, h); const d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = 150 + (hash(x, y, 71) - 0.5) * 90 + (hash(x >> 1, y >> 1, 72) - 0.5) * 50; const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = clamp(v, 0, 255); d[i + 3] = 255; }
      c.putImageData(img, 0, 0);
      c.lineCap = 'round'; for (let i = 0; i < 900; i++) { const x = hash(i, 1, 73) * w, y = hash(i, 2, 73) * h, a = hash(i, 3, 73) * 6.28, l = 1.5 + hash(i, 4, 73) * 3; c.strokeStyle = hash(i, 5, 73) < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(40,40,40,.3)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
    }, { linear: true });
    const mat = new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.96, metalness: 0 });
    // detalhe e flocagem a meia força (chão limpo, sem manchas)
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.detailMap = { value: detail }; sh.uniforms.flocMap = { value: floc };
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        vec3 dtl = texture2D(detailMap, vMapUv * vec2(${(W * 1.6).toFixed(2)}, ${(D * 1.6).toFixed(2)})).rgb;
        diffuseColor.rgb *= 0.575 + dtl * 0.85;
        vec2 fuv = vMapUv * vec2(${(W * 9).toFixed(1)}, ${(D * 9).toFixed(1)});
        float wfl = 1.0 - smoothstep(0.5, 2.0, length(fwidth(fuv)));
        if (wfl > 0.0) diffuseColor.rgb *= mix(1.0, 0.9 + 0.2 * texture2D(flocMap, fuv).r, wfl);`).replace('void main() {', 'uniform sampler2D detailMap; uniform sampler2D flocMap;\nvoid main() {');
    };
    mat.customProgramCacheKey = () => 'chao';
    this.mesh = new THREE.Mesh(g, mat); this.mesh.receiveShadow = true; this.group.add(this.mesh);
    // tampa do poço do acelerador (terreno intacto até a escavação)
    const a = A.acelerador; const tg = new THREE.CircleGeometry(1, 48); tg.rotateX(-Math.PI / 2); tg.scale(a.rx + 0.15, 1, a.rz + 0.15); tg.translate(a.c[0], 0.004, a.c[1]);
    const tp = tg.attributes.position, tuv = tg.attributes.uv; for (let i = 0; i < tp.count; i++) tuv.setXY(i, (tp.getX(i) - MESA.x0) / W, 1 - (tp.getZ(i) - MESA.z0) / D);
    this.tampa = new THREE.Mesh(tg, mat); this.tampa.receiveShadow = true; this.group.add(this.tampa);
  }
  _buildWater() {
    const mk = (shape, mat, y) => { const g = new THREE.ShapeGeometry(shape, 32); g.rotateX(-Math.PI / 2); const pa = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < pa.count; i++) uv.setXY(i, pa.getX(i) / 6, pa.getZ(i) / 6); const m = new THREE.Mesh(g, mat); m.position.y = y; m.receiveShadow = true; this.group.add(m); return m; };
    const shp = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const lago = shp(A.lago);
    const ilha = new THREE.Path(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; const x = A.ilha.c[0] + Math.cos(a) * (A.ilha.r - 0.05), z = A.ilha.c[1] + Math.sin(a) * (A.ilha.r - 0.05); i ? ilha.lineTo(x, -z) : ilha.moveTo(x, -z); }
    lago.holes.push(ilha);
    this.waterMat = this.e.mats.water;
    this.lake = mk(lago, this.waterMat, -0.1);
    const ell = ({ c: [cx, cz], rx, rz, rot = 0 }) => { const s = new THREE.Shape(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; const u = Math.cos(a) * (rx + 0.05), v = Math.sin(a) * (rz + 0.05); const x = cx + u * Math.cos(rot) - v * Math.sin(rot), z = cz + u * Math.sin(rot) + v * Math.cos(rot); i ? s.lineTo(x, -z) : s.moveTo(x, -z); } return s; };
    mk(ell(lagoSant()), this.waterMat, -0.08);
    mk(ell(bebedouro()), this.waterMat, -0.06);
    // mapa da altura do leito sob a água (0,25 unidade por texel; -0,45 a 0,05): a lâmina d'água é a
    // altura da superfície menos o leito, então a margem acompanha o nível (lago assoreado ou cheio);
    // no verde, a máscara do lago central (o único que assoreia)
    const NX = 256, NZ = 160, dat = new Uint8Array(NX * NZ * 2);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const x = MESA.x0 + ((i + 0.5) * W) / NX, z = MESA.z0 + ((j + 0.5) * D) / NZ; const wd = waterDepth(x, z), k = (j * NX + i) * 2;
      dat[k] = clamp(((wd > 0 ? -0.42 * wd : 0.05) + 0.45) / 0.5, 0, 1) * 255; dat[k + 1] = polyDist(x, z, A.lago) < 0.3 ? 255 : 0;
    }
    const t = new THREE.DataTexture(dat, NX, NZ, THREE.RGFormat, THREE.UnsignedByteType); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
    AGUA.tProf.value = t; AGUA.aguaOn.value = 1; this.agua = AGUA; // uniformes da água (cores e tempo), para ajuste
  }
  // Pede uma nova pintura do chão (feita no próximo quadro, no máximo uma por quadro; durante a festa de uma aprovação,
  // só depois dela: adiarAte, em ms de performance.now).
  // flags: { praca, verde: {zona: true}, reflorestado, vias: {id: false} }
  paint(flags = this.flags) { this.flags = flags; this._sujo = true; }
  // camada fixa: chão de floresta e manchas de copa vistas de cima (meia resolução, desenhada uma vez)
  _camadaFixa() {
    if (this._fixo) return this._fixo;
    const f = document.createElement('canvas'); f.width = (W * S) >> 1; f.height = (D * S) >> 1; const c = f.getContext('2d'); const w = f.width, h = f.height;
    c.fillStyle = c.createPattern(tex.forestFloor().userData.canvas, 'repeat'); c.save(); c.scale(0.5, 0.5); c.fillRect(0, 0, w * 2, h * 2); c.restore();
    for (let i = 0; i < 2600; i++) { const x = hash(i, 1, 501) * w, y = hash(i, 2, 501) * h, r = (6 + hash(i, 3, 501) * 22) / 2; c.fillStyle = `rgba(${34 + hash(i, 4, 501) * 30},${82 + hash(i, 5, 501) * 44},${28 + hash(i, 6, 501) * 20},0.45)`; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    return (this._fixo = f);
  }
  _pintar() {
    const t0 = performance.now(); const flags = this.flags;
    const c = this.canvas.getContext('2d'); const w = this.canvas.width, h = this.canvas.height;
    const P = (x, z) => toPx(x, z);
    const pat = (t) => c.createPattern(t.userData.canvas || t.image, 'repeat');
    const path = (poly, g = c, k = 1) => { g.beginPath(); poly.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g.lineTo(px * k, py * k) : g.moveTo(px * k, py * k); }); g.closePath(); };
    const ell = ([cx, cz], rx, rz, rot = 0, g = c, k = 1) => { g.beginPath(); const [px, py] = P(cx, cz); g.ellipse(px * k, py * k, rx * S * k, rz * S * k, rot, 0, Math.PI * 2); };
    const zona = (Z, g = c, k = 1, m = 0) => { if (Z.poly) path(Z.poly, g, k); else { const [cc, rx, rz, rot] = Z.elipse; ell(cc, rx + m, rz + m, rot, g, k); } };
    const linha = (pts, g = c) => { g.beginPath(); suave(pts).forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); };
    const V = flags.verde || {}; const ligado = (id) => !!(V[id] || Object.keys(V).some((k) => V[k] && id.startsWith(k)));
    const pronta = (Z) => (Z.id === 'praca' ? !!flags.praca : ligado(Z.id) || (Z.id === 'corredor' && !!V.ciencias)); // zona pavimentada já feita
    // 1) chão de floresta (copas escuras vistas de cima), da camada fixa
    c.filter = 'none'; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(this._camadaFixa(), 0, 0, w, h);
    // 2) clareiras: halo desfocado (desenhado a 1/4 e ampliado), depois pasto degradado no início e
    //    gramado quando a obra da área começa
    if (!this._zonas) { this._zonas = document.createElement('canvas'); this._zonas.width = w >> 2; this._zonas.height = h >> 2; }
    const zc = this._zonas.getContext('2d'); zc.clearRect(0, 0, w >> 2, h >> 2); zc.filter = 'blur(2.5px)'; zc.fillStyle = '#7c8e4c';
    for (const Z of ZONAS) { zona(Z, zc, 0.25, Z.poly ? 0 : 0.5); zc.fill(); }
    zc.filter = 'none'; c.drawImage(this._zonas, 0, 0, w, h);
    c.save(); c.globalAlpha = 0.95;
    // (praça por fazer = pasto)
    for (const Z of ZONAS) { if (Z.tipo === 'canteiro' || (Z.tipo === 'praca' && pronta(Z))) continue; const on = ligado(Z.id) && Z.tipo !== 'praca'; if (Z.tipo === 'areia' && on) continue; c.fillStyle = pat(on && Z.tipo === 'grama' ? tex.grass() : tex.pasto()); zona(Z); c.fill(); }
    { const [cc, rx, rz, rot] = SANTUARIO_GRAMADO.elipse; c.fillStyle = pat(V.santuario ? tex.grass() : tex.pasto()); ell(cc, rx, rz, rot); c.fill(); }
    c.restore();
    // 2b) variação ampla nas clareiras: manchas de 3 a 8 unidades (±10%), mais verdes nas baixadas (os
    //     gradientes são criados na origem porque a mancha é desenhada já transladada e girada);
    //     o raio encolhe perto da borda para a mancha não invadir a mata
    for (let i = 0, n = 0; i < 400 && n < 60; i++) {
      const x = MESA.x0 + hash(i, 1, 601) * W, z = MESA.z0 + hash(i, 2, 601) * D; const cl = clearance(x, z); if (cl > -0.3) continue; n++;
      const r = Math.min((3 + hash(i, 3, 601) * 5) * 0.5, 0.6 - cl) * S, [px, py] = P(x, z); const baixo = heightAt(x, z) < 0 || waterDepth(x, z) > 0;
      const cor = baixo ? '90,150,56' : hash(i, 4, 601) < 0.5 ? '255,250,220' : '40,76,20'; const a = baixo ? 0.07 : 0.045;
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `rgba(${cor},${a})`); gr.addColorStop(1, `rgba(${cor},0)`);
      c.fillStyle = gr; c.save(); c.translate(px, py); c.rotate(hash(i, 6, 601) * 3); c.scale(1, 0.55 + hash(i, 5, 601) * 0.45); c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.restore();
    }
    // 2c) pasto degradado (antes da obra de cada área): manchas de terra nua, capim seco e rebrota de
    //     1 a 3 unidades, que somem quando a área vira gramado (zonas de grama ligadas e o pasto do
    //     Santuário, coberto pelo gramado dele)
    for (const [zi, Z] of ZONAS.entries()) {
      if (!(Z.tipo === 'grama' || Z.tipo === 'pasto' || Z.tipo === 'areia' || (Z.tipo === 'praca' && !pronta(Z))) || (ligado(Z.id) && (Z.tipo === 'grama' || Z.id.startsWith('santuario')))) continue;
      const dentro = Z.poly ? (x, z) => inPoly(x, z, Z.poly) : (x, z) => inEllipse(x, z, Z.elipse[0][0], Z.elipse[0][1], Z.elipse[1], Z.elipse[2], Z.elipse[3]);
      let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9; if (Z.poly) for (const [x, z] of Z.poly) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); } else { const [[cx, cz], rx, rz] = Z.elipse; const r = Math.max(rx, rz); bx0 = cx - r; bx1 = cx + r; bz0 = cz - r; bz1 = cz + r; }
      const n = Math.min(60, Math.max(5, ((bx1 - bx0) * (bz1 - bz0)) / 3)) | 0;
      for (let i = 0, k = 0; i < n * 4 && k < n; i++) {
        const x = bx0 + hash(i, zi, 611) * (bx1 - bx0), z = bz0 + hash(i, zi, 612) * (bz1 - bz0); if (!dentro(x, z)) continue; k++;
        const [px, py] = P(x, z), r = (0.8 + hash(i, zi, 613) * 1.8) * S, t = hash(i, zi, 614); const cor = t < 0.4 ? '150,118,78' : t < 0.75 ? '206,190,128' : '96,146,58'; const a = 0.24 + hash(i, zi, 615) * 0.12;
        const gr = c.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `rgba(${cor},${a})`); gr.addColorStop(0.6, `rgba(${cor},${a * 0.6})`); gr.addColorStop(1, `rgba(${cor},0)`);
        c.fillStyle = gr; c.save(); c.translate(px, py); c.rotate(hash(i, zi, 616) * 3); c.scale(1, 0.5 + hash(i, zi, 617) * 0.5); c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.restore();
      }
    }
    // 3) savana em piquetes de pasto (terra batida escura e capim), com trilhas entre eles
    if (V.savana) {
      c.save(); const piq = A.savana.piquetes || [A.savana.poly];
      piq.forEach((poly, i) => { c.fillStyle = pat(tex.pasto()); path(poly); c.fill(); const k = [1, 0.9, 1.08][i % 3], q = [1, 1.06, 0.95][i % 3]; c.fillStyle = `rgba(${196 * k * q | 0},${176 * k | 0},${96 * k / q | 0},0.32)`; path(poly); c.fill(); }); // capim de savana dourado
      c.restore();
    }
    // 4) margens e leitos d'água (areia clara nas bordas, fundo escuro sob a água)
    // (o leito, lodo, só aparece na encosta do lago assoreado; a faixa de areia cobre a margem)
    c.save(); c.filter = 'blur(3px)'; c.fillStyle = '#8a8a66'; path(A.lago); c.fill(); for (const l of [lagoSant(), bebedouro()]) { ell(l.c, l.rx + 0.1, l.rz + 0.1, l.rot || 0); c.fill(); }
    c.lineWidth = 0.75 * S; c.strokeStyle = '#e8d6a6'; path(A.lago); c.stroke(); c.lineWidth = 0.5 * S; for (const l of [lagoSant(), bebedouro()]) { ell(l.c, l.rx, l.rz, l.rot || 0); c.stroke(); } c.restore();
    // 5) trilhas de terra/cascalho pelos gramados e pela savana
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.filter = 'blur(1px)';
    c.strokeStyle = 'rgba(240,230,204,0.95)'; c.lineWidth = 0.32 * S;
    const s = A.santuario, rel = (pts) => pts.map(([u, v]) => [s.c[0] + u * s.rx, s.c[1] + v * s.rz]);
    const T = [
      ['bioma', [[20.4, 9.8], [22.6, 9.0], [25.2, 8.4], [26.6, 6.0]]], ['vila', [[17.2, 12.0], [18.4, 11.2], [21.0, 11.4], [23.4, 12.0]]],
      ['acelerador', [[8.6, 14.2], [10.4, 15.4], [11.9, 15.8]]], ['ciencias', [[-3.6, -2.4], [0.8, -2.8], [5.4, -2.2], [8.6, -0.6]]],
      ['uni', [[-15.6, -6.8], [-12.4, -5.6], [-9.8, -4.8]]], ['santuario', rel([[-0.77, 0.38], [-0.59, -0.23], [-0.34, -0.69]])],
    ];
    for (const [id, pts] of T) if (V[id]) linha(pts);
    if (V.savana) {
      c.strokeStyle = '#dcc89e'; c.lineWidth = 0.35 * S;
      for (const pts of A.savanaTrilhas || [[[11.6, -2.6], [14.2, 0.4], [13.6, 3.4], [16.8, 5.0], [19.4, 3.0]], [[18.2, -2.0], [19.6, 0.6], [18.6, 4.4]]]) linha(pts);
    }
    c.restore();
    // 5b) vias de asfalto no nível do chão (da planta); terra batida enquanto a obra vizinha não sai
    if (A.vias) {
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      for (const v of A.vias) {
        const asfalto = !v.quando || ligado(v.quando) || flags.reflorestado; if (flags.vias && flags.vias[v.id] === false) continue;
        c.strokeStyle = asfalto ? 'rgba(244,244,236,.85)' : 'rgba(196,172,136,.6)'; c.lineWidth = v.w * S + 2; linha(v.pts);
        c.strokeStyle = asfalto ? '#52565e' : '#a8886a'; c.lineWidth = v.w * S - 1; linha(v.pts);
      }
      c.restore();
    }
    // 6) praça central e demais zonas pavimentadas (vale urbanizado): piso cinza-rosado com caminhos
    //    curvos em leque e canteiros; antes da obra, o pasto degradado dos passos 2 e 2c
    for (const Z of ZONAS) {
      if (Z.tipo !== 'praca' || !pronta(Z)) continue;
      c.save(); zona(Z);
      c.fillStyle = pat(tex.pavers()); c.fill(); c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgb(238,236,244)'; c.fill(); c.globalCompositeOperation = 'source-over';
      c.clip();
      if (Z.id === 'praca') {
        const cam = caminhosPraca(); c.lineCap = 'round'; c.lineJoin = 'round';
        // três canteiros curvos entre caminhos vizinhos (grama com borda escura), longe dos caminhos
        // e dos espelhos d'água
        const lagos = A.lagosPraca || [], lin = cam.map((p) => suave(p)); const o = cam[0][0];
        const ang = (p) => Math.atan2(p[p.length - 1][1] - o[1], p[p.length - 1][0] - o[0]);
        const ord = lin.map((p, i) => [ang(p), i]).sort((u, v) => u[0] - v[0]).map((u) => lin[u[1]]);
        const dLin = (x, z, p) => { let d = 1e9; for (let i = 1; i < p.length; i++) { const [ax, az] = p[i - 1], [bx, bz] = p[i]; const vx = bx - ax, vz = bz - az; const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1), 0, 1); d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t)); } return d; };
        let nc = 0;
        for (let i = 0; i + 1 < ord.length && nc < 3; i++) for (const f of [0.6, 0.45, 0.75, 0.85]) {
          const a = ord[i], b = ord[i + 1]; const pa = a[Math.min(a.length - 1, (a.length * f) | 0)], pb = b[Math.min(b.length - 1, (b.length * f) | 0)];
          const x = (pa[0] + pb[0]) / 2, z = (pa[1] + pb[1]) / 2; const folga = Math.min(...lin.map((p) => dLin(x, z, p)));
          if (!inPoly(x, z, Z.poly) || polyDist(x, z, Z.poly) > -0.7 || folga < 0.75 || lagos.some((l) => inEllipse(x, z, l.c[0], l.c[1], l.rx + 0.9, l.rz + 0.9, l.rot || 0))) continue;
          const an = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) + Math.PI / 2, L = Math.min(1.5, folga * 1.6);
          const [px, py] = P(x, z); c.save(); c.translate(px, py); c.rotate(an); c.beginPath(); c.moveTo(-L * S, 0); c.quadraticCurveTo(0, -0.7 * folga * S, L * S, 0); c.quadraticCurveTo(0, 0.3 * folga * S, -L * S, 0); c.closePath();
          c.fillStyle = pat(tex.grass()); c.fill(); c.strokeStyle = 'rgba(90,110,70,.5)'; c.lineWidth = 2; c.stroke(); c.restore(); nc++; break;
        }
        c.strokeStyle = 'rgba(246,240,228,.95)'; c.lineWidth = 0.5 * S; for (const pts of cam) linha(pts);
      }
      c.restore();
    }
    // 7) canteiro de obras (terra batida) ou reflorestamento
    c.save(); path(A.canteiro.poly);
    if (!flags.reflorestado) { c.filter = 'blur(2px)'; c.fillStyle = pat(tex.soil()); c.fill(); c.strokeStyle = 'rgba(80,60,40,.5)'; c.lineWidth = 2; for (let i = 0; i < 40; i++) { const [px, py] = P(-30 + hash(i, 1, 77) * 9, 11 + hash(i, 2, 77) * 8); c.beginPath(); c.moveTo(px, py); c.lineTo(px + 40, py + 6); c.stroke(); } }
    c.restore();
    this.tex.needsUpdate = true;
    this.stats.pinturas++; this.stats.ms = performance.now() - t0;
  }
  // tempo da água, turbidez do lago central pelo nível (assoreado em -0,32, limpo em -0,1), ondas dos
  // espelhos d'água e do aquário pelo offset do mapa de normais, e a pintura pendente
  update(t) {
    AGUA.aguaT.value = t / 1000; AGUA.turvo.value = clamp((-0.1 - this.lake.position.y) / 0.2, 0, 1);
    const n = this.e.mats.pool?.normalMap; if (n) { n.offset.x = t * 0.000012; n.offset.y = t * 0.000008; }
    if (this._sujo && performance.now() >= this.adiarAte) { this._sujo = false; this._pintar(); }
  }
}
