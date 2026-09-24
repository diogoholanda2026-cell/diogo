// Árvores instanciadas: floresta ao redor da arcologia (em blocos, com descarte por visão e dois níveis
// de detalhe), e grupos de árvores de paisagismo usados pelos modelos (praças, pátios, savana).
import * as THREE from 'three';
import { MESA, A } from '../data/planta.js';
import { hash, vnoise, fbm, clamp, rng, inPoly } from '../core/util.js';
import { isForest, heightAt, clearance } from './ground.js';

// ---------- geometrias base (compartilhadas) ----------
let GEO = null;
function noise3(x, y, z, s) { return vnoise(x * 3 + z * 1.7, y * 3 - z * 2.3, 1, s) * 0.6 + vnoise(x * 7 - y * 2, z * 7 + y, 1, s + 9) * 0.4; }
// icosaedro com um vértice para baixo (a calota de baixo sai inteira quando fica abaixo de y = -0,3)
const ICO = (() => {
  const v = [[0, 1, 0]]; const k = 1 / Math.sqrt(5), rr = 2 / Math.sqrt(5);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; v.push([Math.cos(a) * rr, k, Math.sin(a) * rr]); }
  for (let i = 0; i < 5; i++) { const a = ((i + 0.5) / 5) * Math.PI * 2; v.push([Math.cos(a) * rr, -k, Math.sin(a) * rr]); }
  v.push([0, -1, 0]); const f = [];
  for (let i = 0; i < 5; i++) { const a = 1 + i, b = 1 + ((i + 1) % 5), c = 6 + i, d = 6 + ((i + 1) % 5); f.push([0, b, a], [a, b, c], [b, d, c], [11, c, d]); }
  return { v, f };
})();
// o mesmo icosaedro subdividido uma vez (42 vértices, 80 faces): lóbulos redondos para a copa de perto
const ICO1 = (() => {
  const v = ICO.v.map((p) => p.slice()), f = [], meio = new Map();
  const m = (a, b) => { const k = a < b ? a + ',' + b : b + ',' + a; if (!meio.has(k)) { const p = [0, 1, 2].map((i) => (v[a][i] + v[b][i]) / 2); const l = Math.hypot(...p); v.push(p.map((x) => x / l)); meio.set(k, v.length - 1); } return meio.get(k); };
  for (const [a, b, c] of ICO.f) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); f.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]); }
  return { v, f };
})();
// Copa em cacho: lóbulos de icosaedro (20 tri) com normais esféricas, sem as faces de baixo (invisíveis
// de cima) nem as enterradas noutro lóbulo; vértices dentro de outro lóbulo escurecem (cavidade).
// lobos: [[x, y, z, r], ...]
function cachoGeo(seed, lobos, lump = 0.16, B = ICO) {
  const P = [], N = [], C = [], I = [];
  const dentro = (x, y, z, j, k) => lobos.some((o, i) => i !== j && Math.hypot(x - o[0], y - o[1], z - o[2]) < o[3] * k);
  lobos.forEach(([cx, cy, cz, r], j) => {
    const base = P.length / 3; const vs = [];
    B.v.forEach(([x, y, z], i) => {
      const n = noise3(x + j, y, z, seed); const kk = 1 + (n - 0.5) * 2 * lump;
      const px = cx + x * r * kk, py = cy + y * r * kk * 0.9, pz = cz + z * r * kk; vs.push([px, py, pz]);
      // normal esférica inclinada para cima: copa macia sob a luz
      let nx = x, ny = y + 0.35, nz = z; const l = Math.hypot(nx, ny, nz); P.push(px, py, pz); N.push(nx / l, ny / l, nz / l);
      const t = clamp((py + 0.4) / 1.3, 0, 1), sp = 0.93 + hash(i + j * 64, seed, 5) * 0.14; let v = (0.42 + 0.66 * t) * sp; if (dentro(px, py, pz, j, 0.98)) v *= 0.7; // a textura de folhagem faz o resto
      C.push(v * 0.94, v, v * 0.9);
    });
    for (const [a, b, c] of B.f) {
      const A = vs[a], Bv = vs[b], Cc = vs[c];
      if (a === 11 || b === 11 || c === 11 || (A[1] < -0.3 && Bv[1] < -0.3 && Cc[1] < -0.3)) continue; // calota de baixo
      if (dentro(...A, j, 0.97) && dentro(...Bv, j, 0.97) && dentro(...Cc, j, 0.97)) continue; // enterrada
      I.push(base + a, base + b, base + c);
    }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  g.computeBoundingSphere(); return g;
}
// nível simples (15 tri): um icosaedro alongado com o topo afundado no meio, lido de longe como
// cacho de dois lóbulos
function cachoBaixo(seed) {
  const P = [], N = [], C = [], I = [];
  ICO.v.forEach(([x, y, z], i) => {
    const n = noise3(x, y, z, seed); const kk = 1 + (n - 0.5) * 0.2; let px = x * 1.28 * kk * 0.78, py = y * kk * 0.7 + 0.04, pz = z * kk * 0.78;
    if (i === 0) py -= 0.16; else if (i < 6) py += 0.08 * Math.abs(x);
    let nx = x / 1.28, ny = y + 0.35, nz = z; const l = Math.hypot(nx, ny, nz); P.push(px, py, pz); N.push(nx / l, ny / l, nz / l);
    const t = clamp((py + 0.4) / 1.1, 0, 1), sp = 0.93 + hash(i, seed, 5) * 0.14; const v = (0.42 + 0.66 * t) * sp * (i === 0 ? 0.8 : 1); C.push(v * 0.94, v, v * 0.9);
  });
  for (const [a, b, c] of ICO.f) if (a !== 11 && b !== 11 && c !== 11) I.push(a, b, c);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  g.computeBoundingSphere(); return g;
}
// três lóbulos: central (r 0,8) e dois laterais (r 0,5 a 0,6) a 0,45 do centro, em ângulos sorteados
function lobosCacho(seed) {
  const a0 = hash(seed, 1, 7) * 6.28, a1 = a0 + 2.1 + hash(seed, 2, 7) * 1.4;
  return [[0, 0.05, 0, 0.8], [Math.cos(a0) * 0.45, -0.02 + hash(seed, 3, 7) * 0.12, Math.sin(a0) * 0.45, 0.5 + hash(seed, 4, 7) * 0.1], [Math.cos(a1) * 0.45, -0.04 + hash(seed, 5, 7) * 0.12, Math.sin(a1) * 0.45, 0.5 + hash(seed, 6, 7) * 0.1]];
}
function coniferGeo() {
  const parts = []; const tiers = [[0.62, 0.9, 0.0], [0.48, 0.8, 0.5], [0.3, 0.7, 0.95]];
  for (const [r, h, y] of tiers) { const c = new THREE.ConeGeometry(r, h, 6, 1, false); c.translate(0, y + h / 2, 0); parts.push(c); } // cones fechados: sem vão por baixo das saias
  const g = mergeGeos(parts);
  const p = g.attributes.position; const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const t = clamp(p.getY(i) / 1.6, 0, 1); const v = 0.45 + 0.5 * t; col[i * 3] = v * 0.85; col[i * 3 + 1] = v; col[i * 3 + 2] = v * 0.92; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function palmGeo() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2; const f = new THREE.PlaneGeometry(0.16, 0.9, 1, 3); f.translate(0, 0.45, 0);
    const p = f.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setZ(k, -y * y * 0.35); }
    f.rotateX(-Math.PI / 2 + 0.5); f.rotateY(a); parts.push(f);
  }
  const g = mergeGeos(parts); const p = g.attributes.position; const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = 0.75 + hash(i, 3, 3) * 0.25; col[i * 3] = v * 0.9; col[i * 3 + 1] = v; col[i * 3 + 2] = v * 0.8; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}
function mergeGeos(list) {
  let n = 0, ni = 0; for (const g of list) { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), I = []; let o = 0;
  for (const g of list) {
    if (!g.attributes.normal) g.computeVertexNormals();
    P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3);
    if (g.index) for (const i of g.index.array) I.push(i + o); else for (let i = 0; i < g.attributes.position.count; i++) I.push(i + o);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setIndex(I); return out;
}
export function treeGeos() {
  if (GEO) return GEO;
  const trunk = new THREE.CylinderGeometry(0.05, 0.08, 1, 5, 1, true); trunk.translate(0, 0.5, 0);
  // três níveis da mesma copa: folhaPerto (lóbulos redondos), folha (lóbulos de 20 faces) e folhaLow
  // (cacho alongado de 15 tri, para a mata vista de longe)
  GEO = { folhaPerto: cachoGeo(3, lobosCacho(3), 0.2, ICO1), folha: cachoGeo(3, lobosCacho(3)), folha2: cachoGeo(11, lobosCacho(11)), folhaLow: cachoBaixo(5), conifera: coniferGeo(), palmeira: palmGeo(), tronco: trunk };
  for (const g of Object.values(GEO)) g.userData.compartilhada = true; // não descartar com a peça
  return GEO;
}

// ---------- material das copas: vento, folhagem em mundo e luz envolvente ----------
let LEAF = null, TRUNK = null, FOLHAGEM = null; export const windU = { value: 0 };
// ruído de valor 3D periódico (32³, 32 KB) para a textura de folhagem em coordenadas de mundo
function folhagem() {
  if (FOLHAGEM) return FOLHAGEM;
  const N = 32, d = new Uint8Array(N * N * N); for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) d[(z * N + y) * N + x] = hash(x + z * 57, y, 811) * 255;
  const t = new THREE.Data3DTexture(d, N, N, N); t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType; t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping; t.unpackAlignment = 1; t.needsUpdate = true; return (FOLHAGEM = t);
}
// luz envolvente só no difuso (a sombra própria da copa fica macia, sem fundo preto); o especular
// continua com o dotNL original (evita faíscas na silhueta)
const LUZ_FOLHA = THREE.ShaderChunk.lights_physical_pars_fragment.replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );',
  'vec3 wIrr = saturate( ( dot( geometryNormal, directLight.direction ) + 0.5 ) / 1.5 ) * directLight.color; reflectedLight.directDiffuse += wIrr * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );');
export function leafMaterial() {
  if (LEAF) return LEAF;
  LEAF = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.88, metalness: 0, envMapIntensity: 0.35 });
  const tF = { value: folhagem() };
  LEAF.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windU; sh.uniforms.tFolha = tF;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind; varying vec3 vFolhaW;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float sw = sin(uWind * 1.3 + ip.x * 0.7 + ip.z * 0.9) * 0.035 + sin(uWind * 2.9 + ip.x * 1.9) * 0.012;
          transformed.x += sw * max(position.y + 0.3, 0.0); transformed.z += sw * 0.6 * max(position.y + 0.3, 0.0);
        #endif`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 fw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            fw = instanceMatrix * fw;
          #endif
          vFolhaW = (modelMatrix * fw).xyz; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler3D tFolha; varying vec3 vFolhaW;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float fo = texture(tFolha, vFolhaW * ${(1 / (0.16 * 32)).toFixed(4)}).r * 0.6 + texture(tFolha, vFolhaW * ${(1 / (0.37 * 32)).toFixed(4)} + 0.37).r * 0.4;
        diffuseColor.rgb *= 0.62 + 0.76 * fo;`)
      // de perto, a mesma folhagem vira relevo (normal perturbada pela derivada na tela; some de longe)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float wb = 1.0 - smoothstep(0.012, 0.04, length(fwidth(vFolhaW)));
          if (wb > 0.0) { vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition); vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1);
            vec2 dh = vec2(dFdx(fo), dFdy(fo)) * 0.05 * wb; normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2)); } }`)
      .replace('#include <lights_physical_pars_fragment>', LUZ_FOLHA);
  };
  LEAF.customProgramCacheKey = () => 'folha2';
  return LEAF;
}
export function trunkMaterial() { if (!TRUNK) TRUNK = new THREE.MeshStandardMaterial({ color: 0x4d3626, roughness: 0.95 }); return TRUNK; }

// paletas de verde (instanceColor multiplica a cor de vértice)
const VERDES = { // albedo linear
  mata: [[0.035, 0.075, 0.022], [0.028, 0.062, 0.02], [0.05, 0.095, 0.028], [0.062, 0.085, 0.022], [0.03, 0.07, 0.04], [0.07, 0.098, 0.03]],
  jardim: [[0.07, 0.16, 0.04], [0.05, 0.13, 0.035], [0.09, 0.18, 0.05], [0.11, 0.17, 0.04]],
  outono: [[0.16, 0.1, 0.03], [0.2, 0.08, 0.03], [0.13, 0.12, 0.04]],
  savana: [[0.1, 0.14, 0.04], [0.13, 0.15, 0.05], [0.08, 0.12, 0.04]],
  conifera: [[0.035, 0.07, 0.04], [0.03, 0.06, 0.035], [0.045, 0.08, 0.045]],
};
const ORLA = [0.09, 0.11, 0.035];

// matriz e cor de cada árvore numa InstancedMesh (t.orla = distância até a clareira: orla mais clara e
// oliva, miolo da mata mais escuro)
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function preencher(im, arr, k) {
  arr.forEach((t, i) => {
    const s = t.s || 0.5; const h = t.h || 1; const y = t.y ?? heightAt(t.x, t.z);
    const lift = k === 'conifera' ? 0.25 * s : k === 'palmeira' ? 1.5 * s * h : (0.75 * s) * h; t._y = y; t._lift = lift;
    _e.set((hash(i, 7, 3) - 0.5) * 0.25, t.rot ?? hash(i, 9, 3) * 6.28, (hash(i, 8, 3) - 0.5) * 0.25); _q.setFromEuler(_e);
    _p.set(t.x, y + lift, t.z); _s.set(s * (0.88 + hash(i, 1, 5) * 0.24), s * (k === 'conifera' ? 1.6 * h : 0.92 + hash(i, 3, 5) * 0.16), s * (0.88 + hash(i, 2, 5) * 0.24));
    im.setMatrixAt(i, _m4.compose(_p, _q, _s));
    const pal = VERDES[t.pal || (k === 'conifera' ? 'conifera' : 'mata')]; const c = pal[(hash(i, 4, 11) * pal.length) | 0]; let v = 0.85 + hash(i, 5, 11) * 0.3;
    let r = c[0], g = c[1], b = c[2];
    if (t.orla !== undefined && k !== 'conifera') { if (t.orla < 1.2) { v *= 1.15; r = r * 0.8 + ORLA[0] * 0.2; g = g * 0.8 + ORLA[1] * 0.2; b = b * 0.8 + ORLA[2] * 0.2; } else if (t.orla > 3) v *= 0.85; }
    _c.setRGB(r * v, g * v, b * v); im.setColorAt(i, _c);
  });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
}

// Cria um grupo instanciado a partir de uma lista de árvores [{x,z,y?,s,h?,kind,pal,rot}]
export function treeGroup(list, opts = {}) {
  const G = treeGeos(); const g = new THREE.Group(); g.name = opts.name || 'arvores';
  const by = new Map();
  for (const t of list) { const k = t.kind || 'folha'; if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
  const trunks = [];
  for (const [k, arr] of by) {
    const im = new THREE.InstancedMesh(G[k] || G.folha, leafMaterial(), arr.length); preencher(im, arr, k);
    for (const t of arr) if (t.trunk || k === 'palmeira' || (k === 'folha' && opts.trunks)) trunks.push({ x: t.x, z: t.z, y: t._y, len: k === 'palmeira' ? 1.55 * (t.s || 0.5) * (t.h || 1) : t._lift, r: k === 'palmeira' ? 0.6 : 1 });
    im.castShadow = opts.cast ?? true; im.receiveShadow = true; im.computeBoundingSphere(); im.userData.kind = k;
    g.add(im);
  }
  if (trunks.length) {
    const im = new THREE.InstancedMesh(G.tronco, trunkMaterial(), trunks.length);
    trunks.forEach((t, i) => { _p.set(t.x, t.y, t.z); _q.identity(); _s.set(t.r, t.len, t.r); im.setMatrixAt(i, _m4.compose(_p, _q, _s)); });
    im.instanceMatrix.needsUpdate = true; im.castShadow = opts.cast ?? true; im.receiveShadow = true; im.computeBoundingSphere(); g.add(im);
  }
  return g;
}

// ---------- floresta da mesa ----------
// Blocos de 8 x 8 unidades (descarte por visão e nível de detalhe). Em cada bloco, as copas têm três
// malhas que dividem as mesmas instâncias (matrizes e cores) e o mesmo material: o cacho de lóbulos
// redondos bem de perto, o de lóbulos simples a meia distância e o alongado de longe. A troca segue o
// raio da copa em pixels na tela (no ponto do bloco mais perto da câmera), com histerese.
const BLOCO = 8, RAIO_COPA = 0.45;
const LOD = [[12.5, 11.5], [28, 24]]; // [entra, sai] do nível 1 e do 2 (na vista da foto a 1376x768 só a frente fica no 1)
export class Forest {
  constructor(engine) {
    this.e = engine; this.group = new THREE.Group(); this.group.name = 'floresta'; engine.scene.add(this.group);
    this.chunks = []; this.lods = []; this.canteiro = null; this.cast = false; this.stats = { trocas: 0, alto: 0 };
    this._build();
  }
  _build() {
    const step = 0.56; const R = rng(4242); const trees = []; const cant = [];
    for (let z = MESA.z0 + 0.35; z < MESA.z1 - 0.3; z += step) {
      for (let x = MESA.x0 + 0.35; x < MESA.x1 - 0.3; x += step) {
        const jx = x + (R() - 0.5) * step * 0.9, jz = z + (R() - 0.5) * step * 0.9;
        const inCant = inPoly(jx, jz, A.canteiro.poly);
        if (!inCant && !isForest(jx, jz)) continue;
        const dens = fbm(jx, jz, 6, 21, 3);
        if (dens < 0.33 && R() < 0.6) continue; // pequenas falhas na mata
        const cl = inCant ? 2 : clearance(jx, jz); const edge = clamp(cl, 0, 3);
        const big = 0.34 + dens * 0.26 + R() * 0.1; const s = big * (0.7 + 0.3 * clamp(edge / 1.5, 0, 1));
        const back = jz < -16.5 || jx > 29.5 || jx < -29.5; // bordas: mais coníferas (como no fundo da foto)
        const kind = back && R() < 0.45 ? 'conifera' : R() < 0.5 ? 'folha' : 'folha2';
        const t = { x: jx, z: jz, s, kind, pal: kind === 'conifera' ? 'conifera' : R() < 0.006 ? 'outono' : 'mata', h: 0.9 + R() * 0.35, orla: inCant ? undefined : cl };
        (inCant ? cant : trees).push(t);
      }
    }
    const G = treeGeos(), mat = leafMaterial(); const map = new Map();
    for (const t of trees) { const k = Math.floor((t.x - MESA.x0) / BLOCO) + ',' + Math.floor((t.z - MESA.z0) / BLOCO); if (!map.has(k)) map.set(k, []); map.get(k).push(t); }
    for (const list of map.values()) {
      const g = new THREE.Group(); g.name = 'mata'; const fol = list.filter((t) => t.kind !== 'conifera'), con = list.filter((t) => t.kind === 'conifera');
      if (fol.length) {
        const hi = new THREE.InstancedMesh(G.folha, mat, fol.length); preencher(hi, fol, 'folha');
        const lo = new THREE.InstancedMesh(G.folhaLow, mat, fol.length), pe = new THREE.InstancedMesh(G.folhaPerto, mat, fol.length);
        for (const m of [lo, pe]) { m.instanceMatrix = hi.instanceMatrix; m.instanceColor = hi.instanceColor; } // mesmas instâncias, um envio só
        const niveis = [lo, hi, pe]; for (const m of niveis) { m.castShadow = this.cast; m.receiveShadow = true; m.computeBoundingSphere(); m.userData.kind = 'folha'; m.visible = m === lo; g.add(m); }
        const bx = [1e9, -1e9, 1e9, -1e9]; for (const t of fol) { bx[0] = Math.min(bx[0], t.x); bx[1] = Math.max(bx[1], t.x); bx[2] = Math.min(bx[2], t.z); bx[3] = Math.max(bx[3], t.z); }
        this.lods.push({ niveis, bx, n: 0, hi, lo });
      }
      if (con.length) { const cm = new THREE.InstancedMesh(G.conifera, mat, con.length); preencher(cm, con, 'conifera'); cm.castShadow = this.cast; cm.receiveShadow = true; cm.computeBoundingSphere(); cm.userData.kind = 'conifera'; g.add(cm); }
      this.group.add(g); this.chunks.push(g);
    }
    this.count = trees.length;
    this.canteiro = treeGroup(cant, { name: 'reflorestamento', cast: this.cast }); this.canteiro.visible = false; this.group.add(this.canteiro);
    this.canteiroN = cant.length;
  }
  setShadows(on) { this.cast = on; this.group.traverse((o) => { if (o.isInstancedMesh) o.castShadow = on; }); this.e.shadowDirty = true; }
  // crescimento do reflorestamento do canteiro (0..1)
  setReflorestamento(k) {
    this.canteiro.visible = k > 0.001;
    this.canteiro.scale.setScalar(1); this.canteiro.traverse((o) => { if (o.isInstancedMesh) o.material = leafMaterial(); });
    this.canteiro.position.y = -(1 - k) * 1.4; this.e.shadowDirty = true;
  }
  // nível de detalhe por bloco: raio de copa projetado (pixels da imagem renderizada) no ponto do
  // bloco mais perto da câmera, com histerese; as duas malhas usam o mesmo programa
  _lod() {
    const cam = this.e.camera; if (!cam) return; const p = cam.position; const hpx = this.e.H || 720;
    const k = (RAIO_COPA * hpx * 0.5) / Math.tan((cam.fov * Math.PI) / 360); let alto = 0, perto = 0;
    for (const L of this.lods) {
      const dx = Math.max(L.bx[0] - p.x, 0, p.x - L.bx[1]), dz = Math.max(L.bx[2] - p.z, 0, p.z - L.bx[3]), dy = Math.max(p.y - 1.2, 0);
      const px = k / Math.max(0.5, Math.hypot(dx, dy, dz));
      const n = px > LOD[1][L.n >= 2 ? 1 : 0] ? 2 : px > LOD[0][L.n >= 1 ? 1 : 0] ? 1 : 0;
      if (n !== L.n) { L.niveis[L.n].visible = false; L.niveis[n].visible = true; L.n = n; this.stats.trocas++; }
      if (n >= 1) alto++; if (n === 2) perto++;
    }
    this.stats.alto = alto; this.stats.perto = perto;
  }
  update(t) { windU.value = t / 1000; this._lod(); }
}
