// Terreno da Arcologia (Trevo da Holding): malha da mesa de 80 x 62 com as 4 bacias do lago rebaixadas (a ilha e a
// faixa dos diques ficam secas; as pontes do eixo passam sobre a água) e o fosso do acelerador. Textura pintada a
// partir do plano mestre: chão de mata em volta, o tapete de grama da figura, o jardim do miolo e os gramados das
// folhas mais claros, o GABARITO da figura (a pegada de toda a construção em grama aparada clara com borda fina de
// piso claro, desde o cap. 1: as peças construídas cobrem e ele nunca some), leito e margem do lago, o anel viário e
// as saídas de asfalto, as zonas que mudam com as etapas (praça e eixo norte pavimentados, pátios, acelerador) e o
// canteiro de obras com o acesso pela pista norte. Duas texturas de detalhe (grão de perto e flocagem que some de
// longe). A água lê um mapa da altura do leito; os canais e repuxos dos vales ganham ali um leito virtual (a placa de
// água deles lê como funda sem o terreno rebaixar antes da obra).
import * as THREE from 'three';
import { MESA, A, ZONAS, FITAS, distAnelViario, ANEL_VIARIO, trechosDe, trecho } from '../data/planta.js';
import { hash, vnoise, fbm, inPoly, clamp, smooth } from '../core/util.js';
import { tex, canvasTex } from './textures.js';
import { AGUA } from './materials.js';

const S = 26; // pixels de textura por unidade: 2080 x 1612 (3,35 Mpx, menos que os 3,5 da mesa antiga de 80 x 56 a 28)
const W = (MESA.x1 - MESA.x0), D = (MESA.z1 - MESA.z0);
const toPx = (x, z) => [(x - MESA.x0) * S, (z - MESA.z0) * S];

function polyDist(x, z, poly) { // distância com sinal até a borda do polígono (negativa dentro); laço único, sem hypot (quente)
  let d2 = 1e18, dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], ax = a[0], az = a[1], bx = b[0], bz = b[1], vx = bx - ax, vz = bz - az, l = vx * vx + vz * vz;
    let t = l > 0 ? ((x - ax) * vx + (z - az) * vz) / l : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - ax - vx * t, dz = z - az - vz * t, q = dx * dx + dz * dz; if (q < d2) d2 = q;
    if ((bz > z) !== (az > z) && x < ((ax - bx) * (z - bz)) / (az - bz) + bx) dentro = !dentro;
  }
  const d = Math.sqrt(d2); return dentro ? -d : d;
}
// elipse (rot em radianos): distância com sinal de primeira ordem ((k - 1) / |grad k|), boa perto da borda
function ellDist(x, z, cx, cz, rx, rz, rot = 0) {
  const c = Math.cos(-rot), s = Math.sin(-rot); const dx = x - cx, dz = z - cz; const u = dx * c - dz * s, v = dx * s + dz * c;
  const p = u / rx, q = v / rz, k = Math.sqrt(p * p + q * q); if (k < 1e-6) return -Math.min(rx, rz);
  const gx = p / rx, gz = q / rz; return ((k - 1) * k) / Math.sqrt(gx * gx + gz * gz);
}
// retângulo alinhado aos eixos (positiva fora)
function retDist(x, z, x0, x1, z0, z1) { const qx = Math.max(x0 - x, x - x1), qz = Math.max(z0 - z, z - z1), px = Math.max(qx, 0), pz = Math.max(qz, 0); return Math.sqrt(px * px + pz * pz) + Math.min(Math.max(qx, qz), 0); }
function distPolilinha(x, z, p) {
  let d2 = 1e18;
  for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i], ax = a[0], az = a[1], vx = b[0] - ax, vz = b[1] - az; const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1), 0, 1); const dx = x - ax - vx * t, dz = z - az - vz * t; d2 = Math.min(d2, dx * dx + dz * dz); }
  return Math.sqrt(d2);
}
const area = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
// cópia [x, z] no sentido das elipses do canvas (área positiva em x, z): subcaminhos somam na união por nonzero
const positivo = (p) => { const q = p.map((v) => [v[0], v[1]]); return area(q) < 0 ? q.reverse() : q; };
// faixa (polígono) de meia largura m ao longo de uma polilinha ([x, z] ou [x, z, altura])
function faixaPoly(pts, m) {
  const E = [], Dr = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l; E.push([pts[i][0] + tz * m, pts[i][1] - tx * m]); Dr.push([pts[i][0] - tz * m, pts[i][1] + tx * m]); }
  return [...E, ...Dr.reverse()];
}

// ---------------------------------------------------------------- água
// lago da Sede: a oval menos a ilha e a faixa dos diques (as 4 bacias). Distância com sinal até a margem (negativa na água)
const LAGO = A.lago, ILHA = A.ilha;
const DIQUES = (A.lagoDiques || []).map((q) => ({ x0: Math.min(q.x0, q.x1), x1: Math.max(q.x0, q.x1), z0: q.z - q.w / 2, z1: q.z + q.w / 2 }));
function lagoDist(x, z) {
  let d = ellDist(x, z, LAGO.c[0], LAGO.c[1], LAGO.rx, LAGO.rz); if (d > 0) return d;
  d = Math.max(d, ILHA.r - Math.hypot(x - ILHA.c[0], z - ILHA.c[1]));
  for (const q of DIQUES) d = Math.max(d, -retDist(x, z, q.x0, q.x1, q.z0, q.z1));
  return d;
}
// profundidade da água num ponto (0 = seco; rampa de 1,2 da margem). Os lagos de dentro da Cúpula e os espelhos são peças
export function waterDepth(x, z) {
  if (Math.abs(x - LAGO.c[0]) > LAGO.rx + 0.05 || Math.abs(z - LAGO.c[1]) > LAGO.rz + 0.05) return 0;
  const d = lagoDist(x, z); return d < 0 ? smooth(clamp(-d / 1.2, 0, 1)) : 0;
}
// leito virtual dos canais e repuxos dos vales (lago.e3): distância com sinal (negativa dentro)
function valeDist(x, z) {
  let d = 1e9;
  for (const v of Object.values(A.vales || {})) { const c = v.canal, r = v.repuxo; d = Math.min(d, retDist(x, z, Math.min(c.x0, c.x1), Math.max(c.x0, c.x1), c.z - c.w / 2, c.z + c.w / 2), Math.hypot(x - r.c[0], z - r.c[1]) - r.r); }
  return d;
}
function inPit(x, z) { const p = A.acelerador; const dx = (x - p.c[0]) / p.rx, dz = (z - p.c[1]) / p.rz; return dx * dx + dz * dz <= 1; }

// ---------------------------------------------------------------- clareiras, vias e canteiro
// Zonas que desenham a borda da clareira: o tapete e o que sai dele (o canteiro). Uma zona inteira dentro do tapete
// nunca muda a menor distância com sinal (dentro dela a do tapete é mais negativa; fora, a dela é maior), então sai
// da conta
const zonaDist = (Z, x, z) => (Z.poly ? polyDist(x, z, Z.poly) : ellDist(x, z, Z.elipse[0][0], Z.elipse[0][1], Z.elipse[1], Z.elipse[2], Z.elipse[3] || 0));
let _zb = null;
function zonasBorda() {
  if (_zb) return _zb; const T = ZONAS.find((Z) => Z.id === 'tapete' && Z.poly); if (!T) return (_zb = ZONAS.map((Z) => ({ Z })));
  const dentro = (Z) => { if (Z === T) return false; const pts = Z.poly || Array.from({ length: 32 }, (_, i) => { const [c, rx, rz, rot = 0] = Z.elipse, a = (i / 32) * Math.PI * 2, u = Math.cos(a) * rx, v = Math.sin(a) * rz; return [c[0] + u * Math.cos(rot) - v * Math.sin(rot), c[1] + u * Math.sin(rot) + v * Math.cos(rot)]; }); return pts.every(([x, z]) => polyDist(x, z, T.poly) < -0.05); };
  const caixa = (Z) => { if (!Z.poly) return null; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of Z.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return [x0, x1, z0, z1]; };
  return (_zb = ZONAS.filter((Z) => !dentro(Z)).map((Z) => ({ Z, bx: caixa(Z) })).sort((a, b) => (b.Z === T) - (a.Z === T)));
}
// distância até a clareira mais próxima (>0 dentro da mata); a caixa de cada polígono descarta os que não chegam perto
export function clearance(x, z) {
  let d = 1e9;
  for (const { Z, bx } of zonasBorda()) { if (bx && d < 1e9 && retDist(x, z, bx[0], bx[1], bx[2], bx[3]) >= d) continue; d = Math.min(d, zonaDist(Z, x, z)); }
  return d;
}
// distância até a borda da via mais perto (anel viário e o começo das saídas; 0 em cima dela)
const SAIDAS_MESA = (A.vias || []).filter((v) => !v.fechada);
export function distVias(x, z) {
  let d = distAnelViario(x, z) - ANEL_VIARIO.w / 2;
  for (const v of SAIDAS_MESA) d = Math.min(d, distPolilinha(x, z, v.pts) - v.w / 2);
  return Math.max(0, d);
}
// acesso do canteiro: corredor de 1,8 da borda da pista norte (A.canteiro.acesso) para dentro do pátio de obras, na
// normal da pista ({ a, u, L, m, poly }; canteiro.js põe ali o portão e o piso)
export const ACESSO_CANTEIRO = (() => {
  const [ax, az] = A.canteiro.acesso, e = 0.01; const gx = distAnelViario(ax + e, az) - distAnelViario(ax - e, az), gz = distAnelViario(ax, az + e) - distAnelViario(ax, az - e), l = Math.hypot(gx, gz) || 1;
  const u = [gx / l, gz / l], L = 1.6, m = 0.9; return { a: [ax, az], u, L, m, poly: positivo([[ax - u[1] * m, az + u[0] * m], [ax + u[0] * L - u[1] * m, az + u[1] * L + u[0] * m], [ax + u[0] * L + u[1] * m, az + u[1] * L - u[0] * m], [ax + u[1] * m, az - u[0] * m]]) };
})();
const ACESSO = ACESSO_CANTEIRO, CANTEIRO = positivo(A.canteiro.poly);
function naAcessoCanteiro(x, z) { const dx = x - ACESSO.a[0], dz = z - ACESSO.a[1]; const t = dx * ACESSO.u[0] + dz * ACESSO.u[1]; return t > -0.05 && t < ACESSO.L && Math.abs(dx * ACESSO.u[1] - dz * ACESSO.u[0]) < ACESSO.m; }
// pátio de obras (o polígono e o corredor do acesso): sem mata até o reflorestamento
export const noCanteiro = (x, z) => inPoly(x, z, A.canteiro.poly) || naAcessoCanteiro(x, z);
export function heightAt(x, z) {
  const w = waterDepth(x, z); if (w > 0) return -0.42 * w;
  // relevo suave apenas na mata (longe das clareiras), plano sob as vias e na borda da mesa
  const clear = clearance(x, z); if (clear <= 0) return 0;
  const h = (fbm(x, z, 5, 3, 3) - 0.45) * 0.35 * clamp(clear / 2, 0, 1) * clamp(distVias(x, z) / 1.5, 0, 1);
  const edge = Math.min(x - MESA.x0, MESA.x1 - x, z - MESA.z0, MESA.z1 - z); return h * clamp(edge / 1.5, 0, 1);
}
// mata: fora do tapete, do canteiro e do acesso, das vias e da água
export function isForest(x, z) {
  if (distVias(x, z) < 0.35) return false;
  if (clearance(x, z) < 0.25) return false;
  if (naAcessoCanteiro(x, z)) return false;
  return waterDepth(x, z) <= 0.02;
}
// etapas que mudam o chão (zonas com quando/ate e vias com quando): flags.feitas só precisa delas
export const ETAPAS_CHAO = [...new Set([...ZONAS.flatMap((Z) => [Z.quando, Z.ate]), ...(A.vias || []).map((v) => v.quando)].filter(Boolean))];

// ---------------------------------------------------------------- gabarito da figura
// A pegada de toda a construção: { poly } ou { elipse: [c, rx, rz, rot (rad)] }, polígonos no sentido das elipses do
// canvas (área positiva em x, z), para a união por nonzero num caminho só. As fitas vão por trecho (os portais ficam
// abertos; nas aberturas dos tambores fica o disco do tambor)
const GAB = { m: 0.04, b: 0.1, piso: '#e2dccb' }; // grama além da face (m) e a borda de piso claro (b)
let _gab = null;
function formasGabarito() {
  if (_gab) return _gab; const G = [];
  const P = (p) => { if (p && p.length > 2) G.push({ poly: positivo(p) }); };
  const E = (c, rx, rz = rx, rot = 0) => G.push({ elipse: [c, rx, rz, rot] });
  const faixa = (pts, w) => pts && pts.length > 1 && P(faixaPoly(pts, w / 2));
  for (const k of FITAS) { const f = A[k]; if (!f?.caminho) continue; for (const [f0, f1] of trechosDe(f)) faixa(trecho(f.caminho, f0, f1), f.w); }
  // ligações com seção de fita: colunata, Elo do Santuário, crescente do Centro de Física, portal do Anel, pórtico da Sede
  for (const k of ['O', 'L']) { faixa(A.colunata?.caminhos?.[k], A.colunata?.w); faixa(A.eloSant?.caminhos?.[k], A.eloSant?.w); }
  const cr = A.acelerador?.crescente; if (cr) faixa(cr.caminho, cr.w);
  faixa(A.portal?.caminho, A.portal?.w); faixa(A.sede?.portico?.caminho, A.sede?.portico?.w);
  // tambores, ilha (com o radier da Torre), diques, pavilhão e piscinas da Sede
  for (const t of Object.values(A.tambores || {})) E(t.c, t.r);
  E(ILHA.c, ILHA.r); for (const q of A.lagoDiques || []) P(q.poly);
  const pv = A.sedePatio?.pavilhao; if (pv) E(pv.c, pv.r); for (const p of A.sedePatio?.piscinas || []) E(p.c, p.rx + (p.deck || 0), p.rz + (p.deck || 0));
  // eixo: praça (disco, passagem norte, esplanada e eixo da boca) com as 2 fontes da esplanada, eixo norte, Caminho da
  // Frente e Bulevar
  P(A.praca?.poly); for (const f of A.fontes || []) E(f.c, f.rx, f.rz); P(A.eixoN?.poly); faixa(A.frente?.pts, A.frente?.w); faixa(A.bulevar?.pts, A.bulevar?.w);
  // pátios da boca, rampas em hélice (com o patamar: lado w na direção rot, em graus) e o poço do acelerador
  for (const b of [A.patios?.escola?.base, A.anfiteatro?.base]) if (b) E(b.c, b.rx, b.rz);
  for (const h of Object.values(A.patios?.rampas || {})) {
    E(h.c, h.r); const q = h.patamar; if (!q) continue;
    const a = (q.rot * Math.PI) / 180, ux = (Math.cos(a) * q.w) / 2, uz = (Math.sin(a) * q.w) / 2, vx = (-Math.sin(a) * q.d) / 2, vz = (Math.cos(a) * q.d) / 2, [cx, cz] = q.c;
    P([[cx - ux - vx, cz - uz - vz], [cx + ux - vx, cz + uz - vz], [cx + ux + vx, cz + uz + vz], [cx - ux + vx, cz - uz + vz]]);
  }
  const po = A.acelerador?.poco; if (po) E(po.c, po.rx, po.rz);
  // miolos das folhas: campo, Ciências e Ponte Coberta, espelho da Biblioteca e CRD, Cúpula, Estufa, Galeria e Trilha
  P(A.campo?.poly); P(A.ciencias?.poly); faixa(A.ponteCoberta?.pts, A.ponteCoberta?.w);
  if (A.biblio?.espelho) E(A.biblio.espelho.c, A.biblio.espelho.r); P(A.crd?.poly);
  for (const k of ['bioma', 'gorilas', 'galeria']) if (A[k]?.c) E(A[k].c, A[k].r);
  faixa(A.trilha?.pts, A.trilha?.w);
  // vales: canais e repuxos
  for (const v of Object.values(A.vales || {})) { P(v.canal.poly); E(v.repuxo.c, v.repuxo.r); }
  return (_gab = G);
}
// gramados claros (sempre): os miolos das folhas (o jardim do miolo do Anel é a zona 'jardim', com claro)
const GRAMADOS = [A.campo?.gramado, A.gramadoUni, A.biblio?.gramado, A.savana?.gramado].filter((g) => g?.c && g.r);

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
    const SX = W * 2, SZ = D * 2; const g = new THREE.PlaneGeometry(W, D, SX, SZ); g.rotateX(-Math.PI / 2); g.translate((MESA.x0 + MESA.x1) / 2, 0, (MESA.z0 + MESA.z1) / 2); // células de 0,5 (o leito do lago ainda cabe na rampa de 1,2)
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
    // lâmina d'água: as bacias (norte e sul, cada uma em volta de meia ilha, recortadas pelos diques) numa malha só
    const shp = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry((LAGO.bacias || [LAGO]).map(shp), 32); g.rotateX(-Math.PI / 2);
    const pa = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < pa.count; i++) uv.setXY(i, pa.getX(i) / 6, pa.getZ(i) / 6);
    this.waterMat = this.e.mats.water;
    this.lake = new THREE.Mesh(g, this.waterMat); this.lake.position.y = -0.1; this.lake.receiveShadow = true; this.group.add(this.lake);
    // mapa da altura do leito sob a água (0,25 unidade por texel; -0,45 a 0,05): a lâmina d'água é a altura da superfície
    // menos o leito, então a margem acompanha o nível (lago assoreado ou cheio). Nos canais e repuxos dos vales, um leito
    // virtual de -0,25 (a placa d'água da obra lê como funda). No verde, a máscara do lago central (o único que assoreia)
    const NX = W * 4, NZ = D * 4, dat = new Uint8Array(NX * NZ * 2);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const x = MESA.x0 + ((i + 0.5) * W) / NX, z = MESA.z0 + ((j + 0.5) * D) / NZ; const wd = waterDepth(x, z), k = (j * NX + i) * 2;
      let leito = wd > 0 ? -0.42 * wd : 0.05; if (wd <= 0) { const dv = valeDist(x, z); if (dv < 0) leito = 0.05 - 0.3 * clamp(-dv / 0.2, 0, 1); }
      dat[k] = clamp((leito + 0.45) / 0.5, 0, 1) * 255; dat[k + 1] = ellDist(x, z, LAGO.c[0], LAGO.c[1], LAGO.rx, LAGO.rz) < 0.3 ? 255 : 0;
    }
    const t = new THREE.DataTexture(dat, NX, NZ, THREE.RGFormat, THREE.UnsignedByteType); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
    AGUA.tProf.value = t; AGUA.aguaOn.value = 1; this.agua = AGUA; // uniformes da água (cores e tempo), para ajuste
  }
  // Pede uma nova pintura do chão (feita no próximo quadro, no máximo uma por quadro; durante a festa de uma aprovação,
  // só depois dela: adiarAte, em ms de performance.now).
  // flags: { feitas: {etapa: true} (as de ETAPAS_CHAO), tudo (todas feitas), reflorestado, vias: {id: false} } e, do
  // contrato antigo, praca (praca.e1 feita) e verde: {projeto: true} (qualquer etapa do projeto conta como feita)
  paint(flags = this.flags) { this.flags = flags; this._sujo = true; }
  // camada fixa: chão de floresta e manchas de copa vistas de cima (meia resolução, desenhada uma vez)
  _camadaFixa() {
    if (this._fixo) return this._fixo;
    const f = document.createElement('canvas'); f.width = (W * S) >> 1; f.height = (D * S) >> 1; const c = f.getContext('2d'); const w = f.width, h = f.height;
    c.fillStyle = c.createPattern(tex.forestFloor().userData.canvas, 'repeat'); c.save(); c.scale(0.5, 0.5); c.fillRect(0, 0, w * 2, h * 2); c.restore();
    // chão de mata escuro (a foto nunca mostra o chão): a base [66,94,40] da textura cai aqui mesmo, sem mexer na textura
    c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgb(96,120,108)'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; // ~[17,26,14]: fundo escuro da mata da foto
    for (let i = 0; i < 2800; i++) { const x = hash(i, 1, 501) * w, y = hash(i, 2, 501) * h, r = (6 + hash(i, 3, 501) * 22) / 2; c.fillStyle = `rgba(${16 + hash(i, 4, 501) * 22},${58 + hash(i, 5, 501) * 40},${18 + hash(i, 6, 501) * 16},0.6)`; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    return (this._fixo = f);
  }
  // borda das clareiras em sombra: faixa de ~0,7 para dentro do tapete e do canteiro (distância com sinal, a 1/8 da
  // resolução e desfocada ao desenhar), calculada uma vez
  _bordaClareiras() {
    if (this._borda) return this._borda;
    const k = 8, bw = Math.round((W * S) / k), bh = Math.round((D * S) / k); const f = document.createElement('canvas'); f.width = bw; f.height = bh; const c = f.getContext('2d');
    const img = c.createImageData(bw, bh), d = img.data;
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      const x = MESA.x0 + ((i + 0.5) / bw) * W, z = MESA.z0 + ((j + 0.5) / bh) * D; const cl = clearance(x, z); if (cl >= 0.05 || cl <= -0.95) continue;
      const a = clamp((0.05 - cl) / 0.2, 0, 1) * clamp((cl + 0.95) / 0.35, 0, 1); const o = (j * bw + i) * 4; d[o] = 24; d[o + 1] = 40; d[o + 2] = 16; d[o + 3] = a * 0.22 * 255;
    }
    c.putImageData(img, 0, 0); return (this._borda = f);
  }
  // grama aparada do gabarito: a grama clareada, com faixas de corte leste-oeste de 0,6 (32 px), num ladrilho opaco de
  // 512 px (sem alfa: as bordas de dentro da união não dobram a cor)
  _padraoGab(c) {
    if (!this._gabTile) {
      const g0 = tex.grass(), t = document.createElement('canvas'); t.width = t.height = 512; const g = t.getContext('2d');
      g.drawImage(g0.userData.canvas || g0.image, 0, 0, 512, 512); g.fillStyle = 'rgba(214,232,168,0.40)'; g.fillRect(0, 0, 512, 512);
      g.fillStyle = 'rgba(240,248,214,0.10)'; for (let y = 0; y < 512; y += 32) g.fillRect(0, y, 512, 16); this._gabTile = t;
    }
    return c.createPattern(this._gabTile, 'repeat');
  }
  _pintar() {
    const t0 = performance.now(); const flags = this.flags;
    const c = this.canvas.getContext('2d'); const w = this.canvas.width, h = this.canvas.height;
    const P = (x, z) => toPx(x, z);
    const pat = (t) => c.createPattern(t.userData.canvas || t.image, 'repeat');
    const sub = (poly, g = c, k = 1) => poly.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g.lineTo(px * k, py * k) : g.moveTo(px * k, py * k); });
    // elipse como subcaminho (sem a reta do ponto anterior): começa no ângulo 0 da elipse girada
    const subEll = ([cx, cz], rx, rz, rot = 0, g = c, k = 1) => { const [px, py] = P(cx, cz); g.moveTo((px + Math.cos(rot) * rx * S) * k, (py + Math.sin(rot) * rx * S) * k); g.ellipse(px * k, py * k, rx * S * k, rz * S * k, rot, 0, Math.PI * 2); };
    const forma = (F, g = c, k = 1, m = 0) => { if (F.poly) { sub(F.poly, g, k); g.closePath(); } else { const [cc, rx, rz, rot] = F.elipse; subEll(cc, rx + m, rz + m, rot, g, k); } };
    const zona = (Z, g = c, k = 1, m = 0) => { g.beginPath(); forma(Z, g, k, m); };
    const linhaCrua = (pts, g = c) => { g.beginPath(); pts.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); };
    // etapas feitas: flags.feitas (contrato novo), flags.tudo, e o contrato antigo (praca e verde por projeto)
    const Fe = flags.feitas || {}, V = flags.verde || {};
    const feita = (k) => !!k && !!(flags.tudo || Fe[k] || (k === 'praca.e1' && flags.praca) || V[k.split('.')[0]]);
    const ativa = (Z) => (Z.sempre || !Z.quando || feita(Z.quando)) && !(Z.ate && feita(Z.ate));
    const tapete = ZONAS.filter((Z) => Z.sempre && Z.tipo === 'grama' && !Z.claro), claras = ZONAS.filter((Z) => Z.sempre && Z.claro);
    // 1) chão de mata (copas escuras vistas de cima), da camada fixa
    c.filter = 'none'; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(this._camadaFixa(), 0, 0, w, h);
    // 2) clareiras: halo desfocado do tapete e do canteiro (desenhado a 1/4 e ampliado) e o tapete de grama
    if (!this._zonas) { this._zonas = document.createElement('canvas'); this._zonas.width = w >> 2; this._zonas.height = h >> 2; }
    const zc = this._zonas.getContext('2d'); zc.clearRect(0, 0, w >> 2, h >> 2); zc.filter = 'blur(2.5px)'; zc.fillStyle = '#7c8e4c';
    for (const Z of ZONAS) { if (!(Z.sempre || Z.tipo === 'canteiro') || (Z.tipo === 'canteiro' && flags.reflorestado)) continue; zona(Z, zc, 0.25, Z.poly ? 0 : 0.5); zc.fill(); }
    zc.filter = 'none'; c.drawImage(this._zonas, 0, 0, w, h);
    c.save(); c.globalAlpha = 0.95; c.fillStyle = pat(tex.grass()); for (const Z of tapete) { zona(Z); c.fill(); } c.restore();
    // 2b) variação ampla no tapete: manchas de 3 a 8 unidades (±10%), mais verdes nas baixadas (os gradientes são criados
    //     na origem porque a mancha é desenhada já transladada e girada); o raio encolhe perto da borda da clareira
    for (let i = 0, n = 0; i < 400 && n < 60; i++) {
      const x = MESA.x0 + hash(i, 1, 601) * W, z = MESA.z0 + hash(i, 2, 601) * D; const cl = clearance(x, z); if (cl > -0.3) continue; n++;
      const r = Math.min((3 + hash(i, 3, 601) * 5) * 0.5, 0.6 - cl) * S, [px, py] = P(x, z); const baixo = waterDepth(x, z) > 0;
      const cor = baixo ? '90,150,56' : hash(i, 4, 601) < 0.5 ? '255,250,220' : '40,76,20'; const a = baixo ? 0.07 : 0.045;
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `rgba(${cor},${a})`); gr.addColorStop(1, `rgba(${cor},0)`);
      c.fillStyle = gr; c.save(); c.translate(px, py); c.rotate(hash(i, 6, 601) * 3); c.scale(1, 0.55 + hash(i, 5, 601) * 0.45); c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.restore();
    }
    // 2c) jardim do miolo do Anel e gramados das folhas: grama mais clara
    c.save(); c.beginPath(); for (const Z of claras) forma(Z); for (const g of GRAMADOS) subEll(g.c, g.r, g.r);
    c.fillStyle = pat(tex.grass()); c.fill(); c.fillStyle = 'rgba(200,226,140,0.2)'; c.fill(); c.restore();
    // 2d) borda das clareiras em sombra (a mata projeta sombra no gramado)
    c.save(); c.filter = 'blur(3px)'; c.drawImage(this._bordaClareiras(), 0, 0, w, h); c.restore();
    // 3) gabarito: a união das pegadas num caminho só (nonzero). Borda: tudo afastado m + b em piso claro; depois a
    //    grama aparada afastada m por cima (as bordas de dentro somem e fica só a de fora da união)
    const gab = formasGabarito();
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); for (const F of gab) forma(F);
    c.fillStyle = c.strokeStyle = GAB.piso; c.lineWidth = 2 * (GAB.m + GAB.b) * S; c.fill(); c.stroke();
    c.fillStyle = c.strokeStyle = this._padraoGab(c); c.lineWidth = 2 * GAB.m * S; c.fill(); c.stroke();
    c.restore();
    // 4) leito do lago (as 4 bacias; opaco sob a água, à vista na margem e no lago assoreado) e a linha de pedra da margem
    const bacias = LAGO.bacias || [LAGO];
    c.save(); c.filter = 'blur(1.5px)'; c.fillStyle = '#7d7d5e'; c.beginPath(); for (const b of bacias) { sub(b); c.closePath(); } c.fill(); c.restore();
    c.save(); c.lineJoin = 'round'; c.lineWidth = 0.12 * S; c.strokeStyle = '#d6d0bf'; c.beginPath(); for (const b of bacias) { sub(b); c.closePath(); } c.stroke(); c.restore();
    // 5) vias de asfalto no nível do chão (anel viário e o começo das saídas): bordas claras, asfalto e faixa tracejada,
    //    em três passadas (os encontros das saídas com o anel ficam limpos); terra batida enquanto a obra vizinha não sai
    const vias = (A.vias || []).filter((v) => !(flags.vias && flags.vias[v.id] === false)); const asf = (v) => !v.quando || feita(v.quando) || flags.reflorestado;
    const traco = (v) => linhaCrua(v.fechada ? [...v.pts, v.pts[0]] : v.pts);
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    for (const v of vias) { c.strokeStyle = asf(v) ? 'rgba(244,244,236,.85)' : 'rgba(196,172,136,.6)'; c.lineWidth = v.w * S + 3; traco(v); }
    for (const v of vias) { c.strokeStyle = asf(v) ? '#52565e' : '#a8886a'; c.lineWidth = v.w * S - 2; traco(v); }
    c.setLineDash([0.45 * S, 0.45 * S]); c.strokeStyle = 'rgba(250,246,230,.75)'; c.lineWidth = 0.06 * S;
    for (const v of vias) {
      if (!asf(v) || v.w < 1.2) continue; if (v.fechada) { traco(v); continue; }
      const [a, b] = v.pts, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, o = Math.min(v.w * 0.6, L); linhaCrua([[a[0] + ((b[0] - a[0]) * o) / L, a[1] + ((b[1] - a[1]) * o) / L], b]); // a faixa da saída começa depois da pista do anel
    }
    c.restore();
    // 6) zonas que mudam com as etapas (por cima do gabarito, que segue à vista na borda): praça e eixo norte
    //    pavimentados, pátios e o gramado do acelerador; terra batida no poço antes da escavação
    const centro = A.praca?.centro || A.praca?.c;
    for (const Z of ZONAS) {
      if (Z.sempre || Z.tipo === 'canteiro' || !ativa(Z)) continue;
      c.save(); zona(Z);
      if (Z.tipo === 'praca') {
        c.fillStyle = pat(tex.pavers()); c.fill(); c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgb(226,224,232)'; c.fill(); c.globalCompositeOperation = 'source-over';
        if (centro && Z.poly && inPoly(centro[0], centro[1], Z.poly)) for (const cam of A.pracaCaminhos || []) { // anel de piso mais escuro em volta do espelho
          c.lineWidth = (cam.w || 0.8) * S; c.lineJoin = 'round'; c.strokeStyle = pat(tex.pavers()); linhaCrua(cam); c.globalCompositeOperation = 'multiply'; c.strokeStyle = 'rgb(184,176,170)'; linhaCrua(cam); c.globalCompositeOperation = 'source-over';
        }
        if (centro && Z.poly && inPoly(centro[0], centro[1], Z.poly)) for (const l of A.lagosPraca || []) { // lugar do espelho d'água: pedra mais escura com a borda clara (o espelho é peça da praça)
          c.beginPath(); subEll(l.c, l.rx, l.rz, l.rot || 0); c.fillStyle = 'rgba(120,116,112,0.35)'; c.fill(); c.lineWidth = 0.08 * S; c.strokeStyle = GAB.piso; c.stroke();
        }
      } else if (Z.tipo === 'terra') { c.fillStyle = pat(tex.soil()); c.fill(); c.fillStyle = 'rgba(184,134,90,0.35)'; c.fill(); } // piquete de terra
      else if (Z.tipo === 'areia') { c.fillStyle = pat(tex.sand()); c.fill(); }
      else { c.fillStyle = pat(tex.grass()); c.fill(); }
      c.restore();
    }
    // 7) canteiro de obras (terra batida, com o acesso até a pista norte) ou reflorestamento
    if (!flags.reflorestado) {
      c.save(); c.beginPath(); sub(CANTEIRO); c.closePath(); sub(ACESSO.poly); c.closePath();
      c.filter = 'blur(2px)'; c.fillStyle = pat(tex.soil()); c.fill(); c.filter = 'none'; c.clip(); c.strokeStyle = 'rgba(80,60,40,.5)'; c.lineWidth = 2;
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of A.canteiro.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      for (let i = 0; i < 40; i++) { const [px, py] = P(x0 + 1 + hash(i, 1, 77) * (x1 - x0 - 3), z0 + 0.8 + hash(i, 2, 77) * (z1 - z0 - 1.6)); c.beginPath(); c.moveTo(px, py); c.lineTo(px + 40, py + 6); c.stroke(); }
      c.restore();
    }
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
