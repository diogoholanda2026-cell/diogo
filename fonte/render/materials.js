// Materiais compartilhados (PBR). A intensidade das luzes internas acompanha o ciclo dia/noite.
import * as THREE from 'three';
import { tex, facadeTextures } from './textures.js';

export const M = {};
const litMats = []; // materiais com emissivo que variam com a noite
export let nightLevel = 1;

function std(o) { return new THREE.MeshStandardMaterial(o); }

export function makeMaterials() {
  const conc = tex.concrete(); conc.repeat.set(2, 2);
  M.white = std({ color: 0xf3f0e8, roughness: 0.78, metalness: 0.0, map: conc });
  M.concreto = std({ color: 0xa8a49b, roughness: 0.92, map: conc });
  M.whiteSmooth = std({ color: 0xf6f4ee, roughness: 0.42, metalness: 0.05 });
  M.fascia = std({ color: 0xf7f5ef, roughness: 0.5, metalness: 0.02 });
  M.cream = std({ color: 0xe9e0cf, roughness: 0.8 });
  M.grey = std({ color: 0x9aa0a8, roughness: 0.7 });
  M.dark = std({ color: 0x2a2f38, roughness: 0.75 });
  M.steel = std({ color: 0xc9ced6, roughness: 0.32, metalness: 0.75 });
  M.steelDark = std({ color: 0x6b7482, roughness: 0.4, metalness: 0.7 });
  const roof = tex.roof(); roof.repeat.set(1, 1);
  M.roof = std({ color: 0xffffff, map: roof, roughness: 0.95 });
  M.planter = std({ color: 0x5f8f3e, roughness: 0.95 });
  M.lawn = std({ color: 0x8fc46e, map: tex.grass(), roughness: 0.95 });
  M.grassBright = std({ color: 0x9fd27a, map: tex.grass(), roughness: 0.95 });
  M.field = std({ color: 0xffffff, map: tex.field(), roughness: 0.9 });
  M.track = std({ color: 0xffffff, map: tex.track(), roughness: 0.9 });
  M.pavers = std({ color: 0xffffff, map: tex.pavers(), roughness: 0.86 });
  M.sand = std({ color: 0xffffff, map: tex.sand(), roughness: 1 });
  M.soil = std({ color: 0xffffff, map: tex.soil(), roughness: 1 });
  M.rock = std({ color: 0xd8b48a, map: tex.rock(), roughness: 0.95 });
  M.wood = std({ color: 0xffffff, map: tex.wood(), roughness: 0.72 });
  M.woodLight = std({ color: 0xffffff, map: tex.woodLight(), roughness: 0.6 });
  M.woodFrame = std({ color: 0xd9a868, roughness: 0.55 });
  M.lattice = std({ color: 0xffffff, map: tex.lattice(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.6 });
  const cg = tex.canopyGrid();
  M.canopyGrid = std({ color: 0xffffff, map: cg, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.55, emissive: 0x6a4a20, emissiveMap: cg, emissiveIntensity: 0.25 });
  M.mesh = std({ color: 0xffffff, map: tex.mesh(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.4 });
  M.glass = std({ color: 0xa9d8ee, roughness: 0.06, metalness: 0.25, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
  M.glassDome = std({ color: 0xbfe6f5, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.8 });
  M.glassRail = std({ color: 0xcfe9f5, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2 });
  M.glassWarm = std({ color: 0xffe2b0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false, emissive: 0xffb45a, emissiveIntensity: 0.6, side: THREE.DoubleSide });
  const wn = tex.waterNormal(); wn.repeat.set(6, 6);
  M.water = std({ color: 0x2f7f93, roughness: 0.08, metalness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.9, envMapIntensity: 1.4 });
  M.waterDeep = std({ color: 0x1f7fa0, roughness: 0.05, metalness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.25, 0.25), transparent: true, opacity: 0.82, emissive: 0x0d6788, emissiveIntensity: 0.55, envMapIntensity: 1.3 });
  M.pool = std({ color: 0x2f7d8e, roughness: 0.06, metalness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.2, 0.2), emissive: 0x0b4654, emissiveIntensity: 0.3, envMapIntensity: 1.3 });
  M.yellow = std({ color: 0xf2bf2a, roughness: 0.5 });
  M.orange = std({ color: 0xee7f33, roughness: 0.5 });
  M.red = std({ color: 0xd4503e, roughness: 0.55 });
  M.blue = std({ color: 0x3c7bd0, roughness: 0.5 });
  M.teal = std({ color: 0x2aa39a, roughness: 0.5 });
  M.skin = std({ color: 0xe0b894, roughness: 0.8 });
  M.stripes = std({ color: 0xffffff, map: tex.stripes(), roughness: 0.7 });
  M.animal = std({ color: 0x8c8580, roughness: 0.9 });
  M.gorilla = std({ color: 0x2e2a28, roughness: 0.95 });
  M.giraffe = std({ color: 0xd9a24e, roughness: 0.9 });
  M.trunk = std({ color: 0x5a3e28, roughness: 0.95 });
  M.leaf = std({ color: 0xffffff, vertexColors: true, roughness: 0.92 });
  M.lampGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(3.2) });
  M.cyanGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe9ff).multiplyScalar(2.2) });
  M.redGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a4a).multiplyScalar(2.5) });
  M.blueprint = new THREE.MeshBasicMaterial({ color: 0x57d8ff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  M.blueprintLine = new THREE.LineBasicMaterial({ color: new THREE.Color(0x7fe9ff).multiplyScalar(1.4), transparent: true, opacity: 0.55, depthWrite: false });
  M.loteLinha = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fe8ff).multiplyScalar(1.6), transparent: true, opacity: 0.8, depthWrite: false });
  M.loteFill = new THREE.MeshBasicMaterial({ color: 0x57d8ff, transparent: true, opacity: 0.2, depthWrite: false });
  M.ghostOk = new THREE.MeshBasicMaterial({ color: 0x46e3b5, transparent: true, opacity: 0.35, depthWrite: false });
  M.sel = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd98a).multiplyScalar(1.6), transparent: true, opacity: 0.5, depthWrite: false });
  M.shadowBlob = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  // fachadas
  for (const s of ['quente', 'lab', 'escuro', 'madeira']) {
    const f = facadeTextures(s);
    const m = std({ color: 0xffffff, map: f.map, emissive: 0xffffff, emissiveMap: f.emissive, emissiveIntensity: 0.6, roughness: 0.28, metalness: 0.15, envMapIntensity: 0.8 });
    m.userData.baseEmissive = s === 'escuro' ? 0.45 : s === 'lab' ? 0.55 : s === 'madeira' ? 0.75 : 0.6;
    M['fac_' + s] = m; litMats.push(m);
  }
  M.glassWarm.userData.baseEmissive = 0.6; litMats.push(M.glassWarm);
  M.waterDeep.userData.baseEmissive = 0.55; litMats.push(M.waterDeep);
  M.pool.userData.baseEmissive = 0.3; litMats.push(M.pool);
  return M;
}
export function setNight(n) {
  nightLevel = n;
  for (const m of litMats) m.emissiveIntensity = (m.userData.baseEmissive || 1) * (0.25 + 0.75 * n);
}
// versão dupla-face (cache) de um material
const _dupla = new Map();
export function dupla(m) { if (m.side === THREE.DoubleSide) return m; if (!_dupla.has(m)) { const c = m.clone(); c.side = THREE.DoubleSide; if (m.userData.baseEmissive) { c.userData.baseEmissive = m.userData.baseEmissive; litMats.push(c); } _dupla.set(m, c); } return _dupla.get(m); }
// clona um material para uso com plano de corte (obra subindo)
export function clipped(mat, planes) {
  const m = mat.clone(); m.clippingPlanes = planes; m.clipShadows = true; return m;
}
