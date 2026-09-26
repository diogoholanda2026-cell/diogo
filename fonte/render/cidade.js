// Cidade em volta da Arcologia (mundo aberto). Três partes:
// - o chão dos bairros abertos: ruas de asfalto com faixa tracejada, calçadas claras e o gramado de cada lote, numa
//   malha por bairro com textura de canvas, e postes que acendem à noite (duas malhas instanciadas para a cidade toda);
// - os prédios que o jogador coloca: um grupo por tipo (FaixaCidade) com a API de grupo de módulos que as obras usam
//   (mods[i], centro(i), alturaTopo(n), andar(i, de, para), setNivel(i, n)); cada nível é um subgrupo já fundido por
//   material, então a obra mostra só as peças novas e o prédio pronto entra na fusão do mundo por bairro;
// - as marcas dos lotes livres no modo de colocar (duas malhas instanciadas).
// Modelos no padrão da foto: lajes creme, fita de vidro escuro com as salas acesas à noite, canteiros verdes na borda
// dos terraços, coberturas verdes e árvores da mata.
import * as THREE from 'three';
import { M } from './materials.js';
import { FH, bake } from './geom.js';
import { treeGroup } from './forest.js';
import { Crowd } from './figuras.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tex } from './textures.js';
import { BAIRROS, ORDEM_BAIRROS, LOTE, PASSO, areaBairro, loteDe, CIDADE } from '../data/cidade.js';
import { hash } from '../core/util.js';

const FH_C = FH; // altura do pavimento da cidade (a mesma da Arcologia)
const BAY_U = 0.34 * 32, FL_V = FH_C * 4; // uma volta da textura de fachada: 32 vãos e 4 andares

// ---------------------------------------------------------------- peças
// paredes (4 faces, sem tampa) de uma caixa w x h x d com a base em y0 e o centro em (x, z), com UV de fachada (u em
// vãos, v em andares): as janelas acendem vão a vão como nos prédios da Arcologia
function paredesGeo(w, h, d, x, y0, z) {
  const P = [], N = [], U = [], I = []; const hw = w / 2, hd = d / 2;
  const face = (ax, az, bx, bz, nx, nz, s0) => {
    const b = P.length / 3, L = Math.hypot(bx - ax, bz - az);
    P.push(x + ax, y0, z + az, x + bx, y0, z + bz, x + bx, y0 + h, z + bz, x + ax, y0 + h, z + az);
    for (let k = 0; k < 4; k++) N.push(nx, 0, nz);
    const u0 = s0 / BAY_U, u1 = (s0 + L) / BAY_U, v0 = y0 / FL_V, v1 = (y0 + h) / FL_V;
    U.push(u0, v0, u1, v0, u1, v1, u0, v1); I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  face(-hw, hd, hw, hd, 0, 1, x); face(hw, hd, hw, -hd, 1, 0, z + 7); face(hw, -hd, -hw, -hd, 0, -1, x + 13); face(-hw, -hd, -hw, hd, -1, 0, z + 19);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  return g;
}
const malha = (geo, mat, x = 0, y = 0, z = 0, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true; return m; };
const caixa = (w, h, d, mat, x, y, z, sombra = true) => malha(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, sombra);
const cilindro = (r, h, mat, x, y, z, seg = 20) => malha(new THREE.CylinderGeometry(r, r, h, seg), mat, x, y + h / 2, z);

// Construtor de um nível: junta as peças num grupo e funde por material; árvores entram instanciadas (a fusão do mundo
// as achata quando o prédio fica pronto)
class Nivel {
  constructor(n) { this.g = new THREE.Group(); this.g.userData.nivel = n; this.arv = []; }
  add(o) { this.g.add(o); return o; }
  // pavimento com fachada (paredes) e laje creme de beiral no alto
  pav(w, d, x, y, z, o = {}) {
    const h = o.h ?? FH_C, lj = o.laje ?? 0.07, b = o.beiral ?? 0.08;
    this.add(malha(paredesGeo(w, h - lj, d, x, y, z), o.fac || M.fac_fita));
    this.add(caixa(w + 2 * b, lj, d + 2 * b, o.lajeMat || M.fasciaBeiral, x, y + h - lj, z));
    return y + h;
  }
  // canteiro na borda de um terraço (faixa de 0,14 de largura, 0,1 de altura) nos lados pedidos ('f' frente, 't' fundo, 'e', 'd')
  canteiro(w, d, x, y, z, lados = 'fted') {
    const t = 0.14, hh = 0.1;
    if (lados.includes('f')) this.add(caixa(w, hh, t, M.planter, x, y, z + d / 2 - t / 2, false));
    if (lados.includes('t')) this.add(caixa(w, hh, t, M.planter, x, y, z - d / 2 + t / 2, false));
    if (lados.includes('e')) this.add(caixa(t, hh, d, M.planter, x - w / 2 + t / 2, y, z, false));
    if (lados.includes('d')) this.add(caixa(t, hh, d, M.planter, x + w / 2 - t / 2, y, z, false));
  }
  teto(w, d, x, y, z) { this.add(caixa(w, 0.04, d, M.roof, x, y, z, false)); } // cobertura verde
  arvore(x, y, z, s = 0.34, pal = 'jardim') { this.arv.push({ x, z, y, s: s * 1.35, kind: 'folha', pal, h: 1, trunk: true }); }
  fim() {
    bake(this.g);
    if (this.arv.length) { const t = treeGroup(this.arv, { name: 'arvores-cidade', trunks: true }); this.g.add(t); }
    this.g.traverse((o) => { if (o.isMesh) o.userData.nivel = this.g.userData.nivel; });
    return this.g;
  }
}
const sorte = (seed, k) => hash(seed, k, 9151);

// ---------------------------------------------------------------- modelos (lote de 4 x 4, centro na origem, frente +z)
// Casas com jardim: duas casas na frente (nível 1), duas no fundo (2), terceiro andar com terraço e placas solares (3)
function casas(n, seed) {
  const N = new Nivel(n); const P = [[-0.95, 0.75], [0.95, 0.75], [-0.95, -0.95], [0.95, -0.95]];
  const casa = (k, pisos, base = 0) => { const [x, z] = P[k]; const w = 1.35, d = 1.1; let y = base * FH_C; for (let f = base; f < pisos; f++) y = N.pav(w, d, x, y, z, { beiral: 0.06 }); return y; };
  if (n === 1) { for (const k of [0, 1]) { const y = casa(k, 2); N.teto(1.35, 1.1, P[k][0], y, P[k][1]); } N.canteiro(3.6, 3.6, 0, 0, 0, 'f'); N.arvore(-1.7, 0, 1.65, 0.3); N.arvore(1.7, 0, 1.65, 0.28); N.arvore(0, 0, 1.7, 0.24); }
  if (n === 2) { for (const k of [2, 3]) { const y = casa(k, 2); N.teto(1.35, 1.1, P[k][0], y, P[k][1]); } N.arvore(0, 0, -0.1, 0.36); N.arvore(-1.75, 0, -1.75, 0.3); }
  if (n === 3) {
    for (const k of [0, 3]) { const y = casa(k, 3, 2); N.teto(1.35, 1.1, P[k][0], y, P[k][1]); N.canteiro(1.35, 1.1, P[k][0], y, P[k][1], 'fe'); }
    for (const k of [1, 2]) { const [x, z] = P[k]; for (let q = 0; q < 2; q++) N.add(caixa(0.5, 0.03, 0.9, M.solar, x - 0.3 + q * 0.6, 2 * FH_C + 0.05, z, false)); }
    N.arvore(1.75, 0, 0, 0.3); N.arvore(-1.75, 0, 0.1, 0.28);
  }
  return N.fim();
}
// Edifício em terraços: dois pavimentos de base (nível 1) e um pavimento a mais por nível, cada um recuado na frente
// (terraço com canteiro), jardim de cobertura com árvores no 5
function terraco(n, seed) {
  const N = new Nivel(n); const piso = (f) => { const w = 3.4 - f * 0.14, d = 3.0 - f * 0.34, z = -f * 0.17; return { w, d, z }; };
  const faz = (f) => { const p = piso(f); N.pav(p.w, p.d, 0, f * FH_C, p.z); };
  const topo = (f) => { const p = piso(f); const y = (f + 1) * FH_C; N.teto(p.w - 0.1, p.d - 0.1, 0, y, p.z); N.canteiro(p.w, p.d, 0, y, p.z, 'fed'); return { ...p, y }; };
  if (n === 1) { faz(0); faz(1); const p = piso(1); N.canteiro(p.w, 0.34, 0, FH_C, piso(0).d / 2 - 0.17, 'f'); N.arvore(-1.6, 0, 1.75, 0.3); N.arvore(1.6, 0, 1.75, 0.28); }
  else { faz(n); const p = piso(n - 1); N.canteiro(p.w, 0.34, 0, n * FH_C, p.z + p.d / 2 - 0.17, 'f'); }
  if (n === 5) { const t = topo(5); for (let k = 0; k < 3; k++) N.arvore(-0.9 + k * 0.9, t.y, t.z - 0.2, 0.26); }
  else { const t = topo(n === 1 ? 1 : n); if (sorte(seed, n) < 0.5) N.arvore(t.w / 2 - 0.4, t.y, t.z, 0.2); }
  return N.fim();
}
// Torre-jardim: pódio de dois pavimentos (1) e quatro pavimentos de torre por nível (2 a 5), com varandas e canteiros
// em todas as bordas (floresta vertical); coroa com jardim e pavilhão de vidro no 5
function torre(n, seed) {
  const N = new Nivel(n); const tw = 1.9;
  if (n === 1) { let y = 0; for (let f = 0; f < 2; f++) y = N.pav(3.4, 3.4, 0, y, 0); N.teto(3.3, 3.3, 0, y, 0); N.canteiro(3.4, 3.4, 0, y, 0); N.arvore(-1.3, y, 1.3, 0.24); N.arvore(1.3, y, -1.3, 0.24); N.arvore(1.3, y, 1.3, 0.22); return N.fim(); }
  const f0 = 2 + (n - 2) * 4;
  for (let f = f0; f < f0 + 4; f++) {
    const y = f * FH_C; N.pav(tw, tw, 0, y, 0, { beiral: 0.2 });
    const lados = ['fe', 'td', 'fd', 'te'][f % 4]; N.canteiro(tw + 0.4, tw + 0.4, 0, y + FH_C, 0, lados);
    if (sorte(seed, f) < 0.45) N.arvore((sorte(seed, f + 50) - 0.5) * 1.6, y + FH_C, tw / 2 + 0.1, 0.16);
  }
  if (n === 5) { const y = (f0 + 4) * FH_C; N.teto(tw, tw, 0, y, 0); N.add(caixa(0.9, 0.36, 0.9, M.glass, 0.2, y, -0.2, false)); N.arvore(-0.55, y, 0.55, 0.22); N.arvore(0.6, y, 0.6, 0.18); }
  return N.fim();
}
// serviços e lazer (um nível só)
function agua(seed) {
  const N = new Nivel(1);
  for (const [x, z] of [[-0.9, -0.8], [0.9, -0.8]]) { N.add(cilindro(0.72, 1.0, M.concretoClaro, x, 0, z, 24)); N.add(cilindro(0.76, 0.06, M.fasciaBeiral, x, 1.0, z, 24)); }
  N.pav(1.8, 0.9, 0, 0, 0.9, { h: 0.5 }); N.teto(1.7, 0.8, 0, 0.5, 0.9);
  N.add(caixa(3.2, 0.06, 0.9, M.concretoClaro, 0, 0, 0.35, false)); N.add(caixa(3.0, 0.02, 0.7, M.pool, 0, 0.06, 0.35, false));
  N.arvore(-1.7, 0, 1.7, 0.26); N.arvore(1.7, 0, 1.7, 0.26); return N.fim();
}
function energia(seed) {
  const N = new Nivel(1);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    const x = -0.85 + c * 1.7, z = -1.2 + r * 1.0; N.add(caixa(0.06, 0.6, 0.06, M.steel, x - 0.6, 0, z)); N.add(caixa(0.06, 0.6, 0.06, M.steel, x + 0.6, 0, z));
    const p = caixa(1.5, 0.03, 0.8, M.solar, x, 0.62, z); p.rotation.x = -0.28; N.add(p);
  }
  N.pav(1.2, 0.6, 1.0, 0, 1.55, { h: 0.45 }); N.teto(1.1, 0.5, 1.0, 0.45, 1.55); N.arvore(-1.6, 0, 1.65, 0.26); return N.fim();
}
function saneamento(seed) {
  const N = new Nivel(1);
  for (const [x, z] of [[-0.95, -0.9], [0.95, -0.9]]) { const aro = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 6, 28), M.concretoClaro); aro.rotation.x = Math.PI / 2; aro.position.set(x, 0.12, z); N.add(aro); N.add(malha(new THREE.CircleGeometry(0.68, 28).rotateX(-Math.PI / 2), M.pool, x, 0.1, z, false)); }
  for (let k = 0; k < 3; k++) N.add(caixa(3.0, 0.08, 0.32, M.planter, 0, 0, 0.55 + k * 0.45, false));
  N.pav(1.0, 0.7, 1.3, 0, 1.55, { h: 0.45 }); N.teto(0.9, 0.6, 1.3, 0.45, 1.55); return N.fim();
}
function saude(seed) {
  const N = new Nivel(1); let y = 0; for (let f = 0; f < 2; f++) y = N.pav(3.2, 1.2, 0, f * FH_C, -0.9); N.teto(3.1, 1.1, 0, y, -0.9);
  y = N.pav(1.2, 1.6, -1.0, 0, 0.55); N.teto(1.1, 1.5, -1.0, y, 0.55);
  N.add(caixa(0.36, 0.1, 0.1, M.cruzVerde, 0.6, 2 * FH_C + 0.05, -0.28, false)); N.add(caixa(0.1, 0.36, 0.1, M.cruzVerde, 0.6, 2 * FH_C - 0.08, -0.28, false));
  N.add(caixa(1.4, 0.03, 1.2, M.concretoClaro, 0.8, 0, 0.9, false)); N.arvore(1.6, 0, 1.7, 0.26); return N.fim();
}
function escola(seed) {
  const N = new Nivel(1); let y;
  y = N.pav(3.4, 0.9, 0, 0, -1.25); y = N.pav(3.4, 0.9, 0, y, -1.25); N.teto(3.3, 0.8, 0, y, -1.25);
  for (const x of [-1.25, 1.25]) { y = N.pav(0.9, 1.9, x, 0, 0.35); N.teto(0.8, 1.8, x, y, 0.35); }
  N.add(malha(new THREE.PlaneGeometry(1.4, 1.6).rotateX(-Math.PI / 2), M.field, 0, 0.03, 0.4, false)); N.arvore(0, 0, 1.75, 0.28); return N.fim();
}
function seguranca(seed) {
  const N = new Nivel(1); let y = N.pav(2.6, 1.6, -0.3, 0, -0.6); y = N.pav(2.6, 1.6, -0.3, y, -0.6); N.teto(2.5, 1.5, -0.3, y, -0.6);
  for (let k = 0; k < 3; k++) N.add(caixa(0.6, 0.34, 0.02, M.dark, -1.1 + k * 0.8, 0, 0.21, false));
  N.add(caixa(0.5, 1.9, 0.5, M.fasciaBeiral, 1.45, 0, -1.3)); N.add(caixa(0.12, 0.08, 0.12, M.redGlow, 1.45, 1.9, -1.3, false));
  N.add(caixa(3.4, 0.03, 1.3, M.concretoClaro, 0, 0, 1.2, false)); return N.fim();
}
function praca(seed) {
  const N = new Nivel(1); N.add(caixa(3.8, 0.04, 3.8, M.pavers, 0, 0, 0, false));
  N.add(cilindro(0.55, 0.12, M.fasciaBeiral, 0, 0.04, 0, 24)); N.add(malha(new THREE.CircleGeometry(0.48, 24).rotateX(-Math.PI / 2), M.pool, 0, 0.17, 0, false));
  for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3], [0, -1.5], [-1.5, 0]]) N.arvore(x, 0.04, z, 0.3);
  for (const [x, z, r] of [[0, 1.0, 0], [1.0, 0, 1.57]]) { const b = caixa(0.5, 0.08, 0.14, M.madeiraClara, x, 0.04, z, false); b.rotation.y = r; N.add(b); }
  return N.fim();
}
function parque(seed) {
  const N = new Nivel(1); N.add(caixa(3.9, 0.03, 3.9, M.lawn, 0, 0, 0, false));
  const lago = new THREE.Mesh(new THREE.CircleGeometry(1.0, 28).rotateX(-Math.PI / 2), M.pool); lago.scale.set(1.3, 1, 0.8); lago.position.set(0.3, 0.05, 0.4); N.add(lago);
  N.add(caixa(0.4, 0.02, 3.6, M.pavers, -1.35, 0.03, 0, false)); N.add(caixa(3.6, 0.02, 0.4, M.pavers, 0, 0.03, -1.35, false));
  for (let k = 0; k < 9; k++) { const x = -1.6 + sorte(seed, k) * 3.2, z = -1.6 + sorte(seed, k + 20) * 3.2; if (Math.hypot((x - 0.3) / 1.3, (z - 0.4) / 0.8) < 1.15 || Math.abs(x + 1.35) < 0.3 || Math.abs(z + 1.35) < 0.3) continue; N.arvore(x, 0.03, z, 0.26 + sorte(seed, k + 40) * 0.14, sorte(seed, k + 60) < 0.15 ? 'outono' : 'jardim'); }
  return N.fim();
}
// Rua comercial: três lojas com toldo e vitrine acesa (nível 1); escritórios em cima (2) e cobertura verde com placas (3)
function comercio(n, seed) {
  const N = new Nivel(n); const TOLDO = [M.terracota, M.teal, M.orange];
  if (n === 1) {
    for (let k = 0; k < 3; k++) { const x = -1.2 + k * 1.2; N.add(caixa(1.1, FH_C * 0.95, 2.2, M.fasciaBeiral, x, 0, -0.1)); N.add(caixa(1.0, FH_C * 0.7, 0.04, M.glassWarm, x, 0.02, 1.02, false));
      const t = caixa(1.12, 0.03, 0.42, TOLDO[(k + seed) % 3], x, FH_C * 0.78, 1.2, false); t.rotation.x = 0.28; N.add(t); }
    N.add(caixa(3.6, 0.06, 2.4, M.fasciaBeiral, 0, FH_C * 0.95, -0.1)); N.arvore(-1.75, 0, 1.75, 0.26); N.arvore(1.75, 0, 1.75, 0.26);
  } else { const y = (n - 1) * FH_C + 0.02; N.pav(3.3, 2.0, 0, y, -0.25); if (n === 3) { N.teto(3.2, 1.9, 0, y + FH_C, -0.25); N.canteiro(3.3, 2.0, 0, y + FH_C, -0.25, 'f'); for (let q = 0; q < 2; q++) N.add(caixa(0.9, 0.03, 0.7, M.solar, -0.7 + q * 1.4, y + FH_C + 0.06, -0.5, false)); } else N.canteiro(3.3, 0.3, 0, y, 0.75, 'f'); }
  return N.fim();
}
// Centro de negócios: pódio com saguão de vidro (1) e três pavimentos de vidro espelhado por nível (2 a 5), com lajes
// creme e um terraço verde a cada nível; coroa com jardim no 5
function escritorio(n, seed) {
  const N = new Nivel(n); const w = 2.3, d = 2.3;
  if (n === 1) { N.add(caixa(3.4, FH_C, 3.4, M.glass, 0, 0, 0, false)); N.add(caixa(3.5, 0.07, 3.5, M.fasciaBeiral, 0, FH_C - 0.07, 0)); N.teto(3.3, 3.3, 0, FH_C, 0); N.canteiro(3.4, 3.4, 0, FH_C, 0); N.arvore(-1.4, FH_C, 1.4, 0.22); N.arvore(1.4, FH_C, -1.4, 0.2); return N.fim(); }
  const f0 = 1 + (n - 2) * 3;
  for (let f = f0; f < f0 + 3; f++) { const y = f * FH_C; N.add(caixa(w, FH_C - 0.06, d, M.vidroEspelhado, 0, y, 0)); N.add(caixa(w + 0.12, 0.06, d + 0.12, M.fasciaBeiral, 0, y + FH_C - 0.06, 0)); }
  const yt = (f0 + 3) * FH_C; N.canteiro(w + 0.1, d + 0.1, 0, yt, 0, ['fe', 'td', 'fd', 'te'][n % 4]);
  if (n === 5) { N.teto(w, d, 0, yt, 0); N.arvore(-0.6, yt, 0.6, 0.2); N.arvore(0.6, yt, -0.5, 0.18); N.add(caixa(0.9, 0.3, 0.6, M.fasciaBeiral, 0.3, yt, 0.2)); }
  return N.fim();
}
// Mercado municipal: galpão creme com abóbada de vidro em arcos de aço e barracas coloridas em volta
function mercado(seed) {
  const N = new Nivel(1); N.add(caixa(3.4, 0.5, 2.2, M.fasciaBeiral, 0, 0, -0.3));
  const ab = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.3, 16, 1, true, 0, Math.PI), M.glass); ab.position.set(0, 0.5, -0.3); ab.rotation.set(0, 0, Math.PI / 2); N.add(ab); // meia casca virada para cima, ao longo de x
  for (let k = 0; k < 5; k++) { const arco = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.035, 5, 16, Math.PI), M.steelDark); arco.position.set(-1.6 + k * 0.8, 0.5, -0.3); arco.rotation.y = Math.PI / 2; N.add(arco); }
  const COR = [M.terracota, M.teal, M.yellow, M.orange]; for (let k = 0; k < 5; k++) { N.add(caixa(0.5, 0.26, 0.4, M.fasciaBeiral, -1.6 + k * 0.8, 0, 1.35, false)); N.add(caixa(0.56, 0.04, 0.46, COR[(k + seed) % 4], -1.6 + k * 0.8, 0.3, 1.35, false)); }
  N.arvore(-1.75, 0, 1.8, 0.24); N.arvore(1.75, 0, 1.8, 0.24); return N.fim();
}
// Estação de VLT: cobertura ondulada sobre a plataforma, trilhos cruzando o lote e o bonde parado
function estacao(seed) {
  const N = new Nivel(1); for (const x of [-0.35, 0.35]) N.add(caixa(4.0, 0.03, 0.06, M.steel, 0, 0.02, x, false));
  N.add(caixa(3.4, 0.14, 0.9, M.concretoClaro, 0, 0, -1.1)); for (const x of [-1.4, -0.45, 0.45, 1.4]) N.add(caixa(0.06, 0.62, 0.06, M.steel, x, 0.14, -1.1));
  const cob = caixa(3.8, 0.05, 1.4, M.fasciaBeiral, 0, 0.78, -0.9); cob.rotation.x = -0.08; N.add(cob);
  N.add(caixa(2.6, 0.34, 0.5, M.white, -0.2, 0.06, 0)); N.add(caixa(2.5, 0.12, 0.52, M.fac_escuro || M.dark, -0.2, 0.22, 0, false)); N.add(caixa(2.64, 0.04, 0.54, M.teal, -0.2, 0.06, 0, false));
  N.arvore(-1.7, 0, 1.6, 0.26); N.arvore(1.7, 0, 1.6, 0.26); return N.fim();
}
// Hospital: dois blocos brancos (3 e 4 pavimentos) ligados por passarela, heliponto na cobertura e jardim na frente
function hospital(seed) {
  const N = new Nivel(1); let y = 0; for (let f = 0; f < 4; f++) y = N.pav(1.5, 3.0, -0.9, f * FH_C, -0.2, { fac: M.fac_lab || M.fac_fita });
  N.add(caixa(1.5, 0.05, 3.0, M.fasciaBeiral, -0.9, y, -0.2)); N.add(malha(new THREE.CircleGeometry(0.55, 24).rotateX(-Math.PI / 2), M.dark, -0.9, y + 0.06, -0.2, false)); N.add(caixa(0.08, 0.02, 0.5, M.white, -1.05, y + 0.07, -0.2, false)); N.add(caixa(0.08, 0.02, 0.5, M.white, -0.75, y + 0.07, -0.2, false)); N.add(caixa(0.3, 0.02, 0.08, M.white, -0.9, y + 0.07, -0.2, false));
  y = 0; for (let f = 0; f < 3; f++) y = N.pav(1.4, 2.4, 1.0, f * FH_C, -0.5, { fac: M.fac_lab || M.fac_fita }); N.teto(1.3, 2.3, 1.0, y, -0.5);
  N.add(caixa(0.5, 0.28, 0.4, M.glass, 0.05, 2 * FH_C, -0.5, false)); N.add(caixa(0.3, 0.09, 0.06, M.cruzVerde, 1.0, 2 * FH_C + 0.12, 0.72, false)); N.add(caixa(0.09, 0.3, 0.06, M.cruzVerde, 1.0, 2 * FH_C + 0.02, 0.72, false));
  N.add(caixa(3.6, 0.03, 0.9, M.lawn, 0, 0, 1.45, false)); N.arvore(-1.4, 0, 1.5, 0.26); N.arvore(0.2, 0, 1.55, 0.24); N.arvore(1.6, 0, 1.45, 0.26); return N.fim();
}
// Centro cultural: tambor do teatro em madeira e vidro, museu branco com rasgos e praça com escultura
function cultura(seed) {
  const N = new Nivel(1); const tb = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.05, 1.1, 24), M.madeiraClara); tb.position.set(-0.8, 0.55, -0.6); tb.castShadow = tb.receiveShadow = true; N.add(tb);
  N.add(caixa(2.2, 0.08, 2.2, M.fasciaBeiral, -0.8, 1.1, -0.6)); N.add(new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.06, 0.3, 24, 1, true), M.glassWarm)).position.set(-0.8, 0.2, -0.6);
  let y = 0; for (let f = 0; f < 2; f++) y = N.pav(1.4, 1.8, 1.1, f * FH_C, -0.8, { fac: M.fac_escuro || M.fac_fita }); N.add(caixa(1.4, 0.06, 1.8, M.white, 1.1, y, -0.8));
  N.add(caixa(3.8, 0.03, 1.5, M.pavers, 0, 0, 1.2, false)); N.add(caixa(0.2, 0.5, 0.2, M.steel, 0.3, 0.03, 1.2)); N.add(malha(new THREE.TorusKnotGeometry(0.16, 0.05, 32, 6), M.steel, 0.3, 0.72, 1.2));
  N.arvore(-1.6, 0, 1.6, 0.24); N.arvore(1.6, 0, 1.6, 0.24); return N.fim();
}
// Arena esportiva: campo com pista, arquibancadas cobertas nos lados compridos e quatro torres de luz
function estadio(seed) {
  const N = new Nivel(1); N.add(malha(new THREE.PlaneGeometry(2.4, 1.5).rotateX(-Math.PI / 2), M.field, 0, 0.03, 0, false)); N.add(caixa(3.0, 0.02, 2.1, M.track, 0, 0, 0, false));
  for (const z of [-1.4, 1.4]) { for (let k = 0; k < 3; k++) N.add(caixa(3.4, 0.14, 0.2, M.white, 0, k * 0.14, z + Math.sign(z) * k * 0.18)); const cob = caixa(3.6, 0.04, 0.8, M.fasciaBeiral, 0, 0.72, z + Math.sign(z) * 0.2); cob.rotation.x = Math.sign(z) * 0.12; N.add(cob); }
  for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) { N.add(caixa(0.06, 1.3, 0.06, M.steel, x, 0, z)); N.add(caixa(0.3, 0.12, 0.08, M.lampGlow, x, 1.3, z, false)); }
  return N.fim();
}
const MODELOS = { cidCasas: casas, cidTerraco: terraco, cidTorre: torre, cidAgua: agua, cidEnergia: energia, cidSaneamento: saneamento, cidSaude: saude, cidEscola: escola, cidSeguranca: seguranca, cidPraca: praca, cidParque: parque,
  cidComercio: comercio, cidEscritorio: escritorio, cidMercado: mercado, cidEstacao: estacao, cidHospital: hospital, cidCultura: cultura, cidEstadio: estadio };
// altura do topo de um prédio no nível n (âncora de balão e placa da obra)
function alturaDe(f, n) {
  if (f === 'cidCasas') return (n >= 3 ? 3 : 2) * FH_C + 0.1; if (f === 'cidTerraco') return (Math.max(2, n + 1)) * FH_C + 0.1;
  if (f === 'cidTorre') return (n <= 1 ? 2 : 2 + (n - 1) * 4) * FH_C + 0.1; if (f === 'cidComercio') return n * FH_C + 0.1;
  if (f === 'cidEscritorio') return (n <= 1 ? 1 : 1 + (n - 1) * 3) * FH_C + 0.1; if (f === 'cidHospital') return 4 * FH_C + 0.2; if (f === 'cidEstadio' || f === 'cidCultura') return 1.4; return 1.1;
}

// ---------------------------------------------------------------- grupo de um tipo (API de grupo de módulos)
export class FaixaCidade {
  constructor(cidade, f) { this.c = cidade; this.f = f; this.id = f; this.group = new THREE.Group(); this.group.name = 'cidade-' + f; this.mods = []; this.max = CIDADE[f].max; }
  // garante o item i no lote (posição e giro vêm do lote)
  garantir(i, loteId) {
    let m = this.mods[i]; if (m && m.loteId === loteId) return m;
    if (m?.g) this.group.remove(m.g);
    const l = loteDe(loteId); const rot = CIDADE[this.f].cat === 'moradia' ? 0 : [0, Math.PI / 2, Math.PI, -Math.PI / 2][(hash(l.i, l.j, 77) * 4) | 0];
    m = this.mods[i] = { i, loteId, bairro: l.bairro, x: l.x, z: l.z, rot, nivel: 0, g: null, lote: false, seed: (l.i * 31 + l.j * 7 + 3) | 0 };
    return m;
  }
  cortar(n) { for (let i = n; i < this.mods.length; i++) if (this.mods[i]?.g) this.group.remove(this.mods[i].g); this.mods.length = Math.min(this.mods.length, n); }
  _nivelGeo(m, n) { const g = MODELOS[this.f](n, m.seed); g.position.set(m.x, 0, m.z); g.rotation.y = m.rot; g.userData.bairro = m.bairro; return g; }
  // prédio inteiro no nível n: os subgrupos 1..n (no terraço, o teto verde de cada nível some quando o seguinte o cobre)
  _predio(m, n) {
    const g = new THREE.Group(); g.name = this.f + ':' + m.loteId; g.userData.bairro = m.bairro; g.userData.pick = { tipo: 'modulos', id: this.f };
    for (let k = 1; k <= n; k++) { const s = this._nivelGeo(m, k); if (this.f === 'cidTerraco' && k < n) s.traverse((o) => { if (o.isMesh && o.material === M.roof) o.visible = false; }); g.add(s); }
    return g;
  }
  setNivel(i, n) { const m = this.mods[i]; if (!m) return; if (m.g) this.group.remove(m.g); m.nivel = n; m.g = n > 0 ? this._predio(m, n) : null; if (m.g) this.group.add(m.g); this.c.sujo = true; }
  setTodos(n) { for (const m of this.mods) if (m) this.setNivel(m.i, Math.min(n, this.max)); }
  // peças do nível "para" (a obra revela de baixo para cima); o teto verde do nível de baixo fica até a aprovação
  andar(i, de, para) { const m = this.mods[i]; return { acabado: this._nivelGeo(m, para), esqueleto: null }; }
  centro(i) { const m = this.mods[i]; return m ? [m.x, m.z] : [0, 0]; }
  alturaTopo(n) { return alturaDe(this.f, n); }
  refresh() {}
}

// ---------------------------------------------------------------- chão dos bairros
const PX = 8; // pixels por unidade na textura do chão
function chaoBairro(b) {
  const a = areaBairro(b), W = a.x1 - a.x0, D = a.z1 - a.z0, B = BAIRROS[b];
  const w = Math.ceil(W * PX), h = Math.ceil(D * PX);
  const t = tex.grass(); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
  c.fillStyle = '#3a3d42'; c.fillRect(0, 0, w, h); // asfalto
  // manchas do asfalto
  for (let k = 0; k < 900; k++) { c.fillStyle = hash(k, 1, 404) < 0.5 ? 'rgba(20,22,26,.18)' : 'rgba(120,120,118,.10)'; c.fillRect(hash(k, 2, 404) * w, hash(k, 3, 404) * h, 2 + hash(k, 4, 404) * 6, 2 + hash(k, 5, 404) * 4); }
  const px = (x) => (x - a.x0) * PX, pz = (z) => (z - a.z0) * PX;
  // faixa tracejada no meio das ruas
  c.strokeStyle = 'rgba(226,218,196,.75)'; c.lineWidth = 1; c.setLineDash([6, 6]);
  for (let i = 0; i <= B.nx; i++) { const x = px(B.x0 + i * PASSO - LOTE.rua / 2); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let j = 0; j <= B.nz; j++) { const z = pz(B.z0 + j * PASSO - LOTE.rua / 2); c.beginPath(); c.moveTo(0, z); c.lineTo(w, z); c.stroke(); }
  c.setLineDash([]);
  // quadras: calçada clara e o gramado do lote (textura da grama)
  const pat = c.createPattern(t.userData.canvas, 'repeat');
  for (let j = 0; j < B.nz; j++) for (let i = 0; i < B.nx; i++) {
    const x0 = B.x0 + i * PASSO, z0 = B.z0 + j * PASSO;
    c.fillStyle = '#b8b2a4'; c.beginPath(); c.roundRect(px(x0 - 0.12), pz(z0 - 0.12), (LOTE.tam + 0.24) * PX, (LOTE.tam + 0.24) * PX, 3); c.fill();
    c.save(); c.fillStyle = pat; c.translate(px(x0), pz(z0)); c.scale(0.35, 0.35); c.fillRect(0.3 * PX / 0.35, 0.3 * PX / 0.35, (LOTE.tam - 0.6) * PX / 0.35, (LOTE.tam - 0.6) * PX / 0.35); c.restore();
  }
  const mapa = new THREE.CanvasTexture(cv); mapa.colorSpace = THREE.SRGBColorSpace; mapa.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(W, D); geo.rotateX(-Math.PI / 2); geo.translate((a.x0 + a.x1) / 2, 0.03, (a.z0 + a.z1) / 2);
  const mat = new THREE.MeshStandardMaterial({ map: mapa, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); mat.userData.semHAO = true;
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.name = 'chao-' + b; m.userData.semHAO = true; return m;
}
// postes nos cruzamentos dos bairros abertos (duas malhas instanciadas: haste e luminária)
function postes(abertos) {
  const pts = []; for (const b of abertos) { const B = BAIRROS[b]; for (let j = 0; j <= B.nz; j += 1) for (let i = 0; i <= B.nx; i += 2) pts.push([B.x0 + i * PASSO - LOTE.rua / 2 - 0.45, B.z0 + j * PASSO - LOTE.rua / 2 - 0.45]); }
  if (!pts.length) return null;
  const g = new THREE.Group(); g.name = 'postes'; const m4 = new THREE.Matrix4();
  const haste = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.035, 0.9, 5).translate(0, 0.45, 0), M.steelDark, pts.length);
  const luz = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 0).translate(0, 0.92, 0), M.lampGlow, pts.length); // 20 triângulos por luminária
  pts.forEach(([x, z], k) => { m4.makeTranslation(x, 0, z); haste.setMatrixAt(k, m4); luz.setMatrixAt(k, m4); });
  haste.castShadow = true; for (const im of [haste, luz]) { im.computeBoundingSphere(); im.userData.semHAO = true; g.add(im); }
  return g;
}

// árvores de rua: duas na calçada da frente de cada lote dos bairros abertos (uma malha instanciada)
function arvoresRua(abertos) {
  const l = []; for (const b of abertos) for (const q of lotesDoBairroLocal(b)) for (const dx of [-1.25, 1.25]) l.push({ x: q.x + dx + (hash(q.i, q.j, 5 + dx) - 0.5) * 0.3, z: q.z + LOTE.tam / 2 + 0.36, y: 0.03, s: 0.36 + hash(q.i, q.j, 9 + dx) * 0.12, kind: 'folha', pal: hash(q.i, q.j, 13 + dx) < 0.08 ? 'outono' : 'jardim', h: 1, trunk: true });
  if (!l.length) return null; const g = treeGroup(l, { name: 'arvores-rua', trunks: true }); return g;
}
const lotesDoBairroLocal = (b) => { const B = BAIRROS[b], out = []; for (let j = 0; j < B.nz; j++) for (let i = 0; i < B.nx; i++) out.push({ i, j, x: B.x0 + i * PASSO + LOTE.tam / 2, z: B.z0 + j * PASSO + LOTE.tam / 2 }); return out; };

// ---------------------------------------------------------------- vida na cidade
// gente nas calçadas (três por prédio pronto, dando a volta no lote) e carros nas ruas dos bairros abertos, pela
// qualidade (o dono liberou o triplo do volume)
const GENTE_CIDADE = { ultra: 420, alta: 320, media: 200, leve: 100 };
const CARROS_CIDADE = { ultra: 120, alta: 90, media: 60, leve: 30 };
const COR_CARRO = [0xf4f4f0, 0xe2543f, 0x3f88e2, 0x3a4250, 0xd8d8d0, 0xe8c840, 0x2a2e36, 0x8a2e2e, 0x2e7a5a];
function carrosCidade(max) {
  const pinta = (g, c) => { g = g.toNonIndexed(); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const corpo = pinta(new THREE.BoxGeometry(0.42, 0.15, 0.2).translate(0, 0.1, 0), [1, 1, 1]), cab = pinta(new THREE.BoxGeometry(0.22, 0.1, 0.18).translate(-0.03, 0.22, 0), [0.04, 0.05, 0.07]);
  const farol = pinta(new THREE.BoxGeometry(0.02, 0.04, 0.16).translate(0.21, 0.12, 0), [2.2, 2.0, 1.6]);
  const geo = mergeGeometries([corpo, cab, farol]); const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 });
  const mesh = new THREE.InstancedMesh(geo, mat, max); mesh.count = 0; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.userData.semHAO = true; mesh.name = 'carros-cidade';
  const lista = []; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  return {
    mesh,
    // ruas dos bairros abertos (linhas e colunas da grade) e n carros sorteados nelas
    rotas(abertos, n) {
      const ruas = []; for (const b of abertos) { const B = BAIRROS[b], x0 = B.x0 - LOTE.rua / 2, x1 = B.x0 + B.nx * PASSO - LOTE.rua / 2, z0 = B.z0 - LOTE.rua / 2, z1 = B.z0 + B.nz * PASSO - LOTE.rua / 2;
        for (let j = 0; j <= B.nz; j++) ruas.push({ h: true, a: x0, b: x1, f: z0 + j * PASSO }); for (let i = 0; i <= B.nx; i++) ruas.push({ h: false, a: z0, b: z1, f: x0 + i * PASSO }); }
      lista.length = 0; const N = ruas.length ? Math.min(max, n, abertos.length * 14) : 0;
      for (let k = 0; k < N; k++) { const r = ruas[(hash(k, 3, 881) * ruas.length) | 0]; lista.push({ r, s: hash(k, 5, 881) * (r.b - r.a), dir: hash(k, 7, 881) < 0.5 ? 1 : -1, v: 0.8 + hash(k, 9, 881) * 0.6 }); mesh.setColorAt(k, c.setHex(COR_CARRO[(hash(k, 11, 881) * COR_CARRO.length) | 0])); }
      mesh.count = lista.length; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; this.update(0);
    },
    update(dt) {
      for (let k = 0; k < lista.length; k++) {
        const o = lista[k], r = o.r, L = r.b - r.a; o.s += o.dir * o.v * dt; if (o.s > L) { o.s = L; o.dir = -1; } else if (o.s < 0) { o.s = 0; o.dir = 1; }
        const lane = 0.24 * o.dir;
        if (r.h) { p.set(r.a + o.s, 0.03, r.f + lane); e.set(0, o.dir > 0 ? 0 : Math.PI, 0); } else { p.set(r.f - lane, 0.03, r.a + o.s); e.set(0, o.dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0); }
        q.setFromEuler(e); mesh.setMatrixAt(k, m4.compose(p, q, s1));
      }
      if (lista.length) mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- cidade
export class Cidade {
  constructor(engine) {
    this.e = engine; this.group = new THREE.Group(); this.group.name = 'cidade';
    this.chao = new THREE.Group(); this.chao.name = 'chao-cidade'; this.group.add(this.chao);
    this.faixas = {}; for (const f of Object.keys(CIDADE)) { this.faixas[f] = new FaixaCidade(this, f); this.group.add(this.faixas[f].group); }
    this.abertos = []; this._postes = null; this.sujo = false;
    // marcas dos lotes livres (modo de colocar): placa translúcida e contorno, instanciadas
    const q = new THREE.PlaneGeometry(LOTE.tam - 0.3, LOTE.tam - 0.3).rotateX(-Math.PI / 2);
    const mm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5fd8ff).multiplyScalar(1.25), transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 });
    this.marcas = new THREE.InstancedMesh(q, mm, 400); this.marcas.count = 0; this.marcas.renderOrder = 5; this.marcas.userData.semHAO = true; this.marcas.frustumCulled = false; this.marcas.visible = false;
    this.group.add(this.marcas);
    // vida: gente nas calçadas e carros nas ruas (refeitos quando a cidade muda, no máximo a cada 1,5 s)
    this.povo = new Crowd('pessoa', 420, { lod: true }); this.povo.mesh.userData.semHAO = true; this.group.add(this.povo.mesh);
    this.carros = carrosCidade(120); this.group.add(this.carros.mesh); this._tPovo = -1e9; this.sujo = true;
  }
  _povoar() {
    const C = this.povo; C.clear(); const q = this.e.q?.id || 'alta', lim = GENTE_CIDADE[q] || 300;
    for (const fx of Object.values(this.faixas)) for (const m of fx.mods) {
      if (!m || m.nivel < 1) continue;
      for (let k = 0; k < 3 && C.walkers.length < lim; k++) {
        const o = LOTE.tam / 2 + 0.16 + (hash(m.seed, k, 3) - 0.5) * 0.14, x = m.x, z = m.z, y = 0.04;
        const path = [[x - o, y, z + o], [x + o, y, z + o], [x + o, y, z - o], [x - o, y, z - o], [x - o, y, z + o]];
        C.add(k % 2 ? path.slice().reverse() : path, { loop: 'loop', speed: 0.1 + hash(m.seed, k, 5) * 0.06, phase: hash(m.seed, k, 7), idle: hash(m.seed, k, 9) < 0.2 ? 1 : 0 });
      }
    }
    this.carros.rotas(this.abertos, CARROS_CIDADE[q] || 90);
  }
  update(dt, t) {
    if (this.sujo && t - this._tPovo > 1500) { this.sujo = false; this._tPovo = t; this._povoar(); }
    const cam = this.e.camera; if (this.povo.walkers.length) this.povo.update(dt, t, cam.position, (0.27 * (this.e.H || 720)) / (2 * Math.tan((cam.fov * Math.PI) / 360) * 12));
    this.carros.update(Math.min(dt, 0.1));
  }
  faixa(f) { return this.faixas[f]; }
  centroLote(id) { const l = loteDe(id); return l ? { x: l.x, z: l.z } : null; }
  // chão e postes dos bairros abertos (refeitos só quando muda a lista)
  bairros(abertos) {
    const k = abertos.join(); if (k === this._chaveBairros) return; this._chaveBairros = k; this.abertos = abertos.slice();
    for (const c of this.chao.children.slice()) { this.chao.remove(c); c.geometry.dispose(); c.material.map?.dispose(); c.material.dispose(); }
    for (const b of ORDEM_BAIRROS) if (abertos.includes(b)) this.chao.add(chaoBairro(b));
    if (this._postes) { this.group.remove(this._postes); this._postes = null; } this._postes = postes(abertos); if (this._postes) this.group.add(this._postes);
    if (this._arvRua) { this.group.remove(this._arvRua); this._arvRua = null; } this._arvRua = arvoresRua(abertos); if (this._arvRua) this.group.add(this._arvRua);
    this.e.shadowDirty = true; this.sujo = true;
  }
  // os prédios de cada tipo seguem o estado (quantidade, lote e nível; o nível de quem está em obra é o de antes)
  sincronizar(modulos) {
    for (const [f, F] of Object.entries(this.faixas)) {
      const arr = modulos[f] || []; F.cortar(arr.length);
      arr.forEach((m, i) => { const mod = F.garantir(i, m.lote); if (mod.nivel !== m.nivel || (m.nivel > 0 && !mod.g)) F.setNivel(i, m.nivel); });
    }
  }
  // lotes livres destacados no modo de colocar (lista de ids; vazio esconde)
  mostrarLotes(ids) {
    const m4 = new THREE.Matrix4(); let n = 0;
    for (const id of ids || []) { const l = loteDe(id); if (!l || n >= 400) continue; m4.makeTranslation(l.x, 0.1, l.z); this.marcas.setMatrixAt(n++, m4); }
    this.marcas.count = n; this.marcas.instanceMatrix.needsUpdate = true; this.marcas.visible = n > 0; this.e.acordar?.(400);
  }
  // fontes da fusão do mundo: cada prédio pronto (assinatura pelo uuid do grupo)
  fontes(F) { for (const fx of Object.values(this.faixas)) for (const m of fx.mods) if (m?.g && m.nivel > 0) F.set(m.g, m.g.uuid); }
  picks(P, caixa) { for (const fx of Object.values(this.faixas)) for (const m of fx.mods) if (m?.g) P.push({ box: caixa(m.g, true), pick: m.g.userData.pick, fonte: m.g }); }
}
