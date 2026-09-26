// Árvores instanciadas: floresta ao redor da arcologia (em blocos, com descarte por visão e três níveis
// de detalhe), e grupos de árvores de paisagismo usados pelos modelos (praças, pátios, savana).
import * as THREE from 'three';
import { MESA, A, SANTUARIO_GRAMADO } from '../data/planta.js';
import { hash, vnoise, fbm, clamp, rng, inPoly, inEllipse, smoothstep } from '../core/util.js';
import { isForest, heightAt, clearance, aldeiaCasas } from './ground.js';

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
      const t = clamp((py + 0.4) / 1.3, 0, 1), sp = 0.93 + hash(i + j * 64, seed, 5) * 0.14; let v = (0.16 + 0.94 * t) * sp; if (dentro(px, py, pz, j, 0.98)) v *= 0.45; // sombra própria forte (os vãos da mata da foto são quase pretos); a textura de folhagem faz o resto
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
    const t = clamp((py + 0.4) / 1.1, 0, 1), sp = 0.93 + hash(i, seed, 5) * 0.14; const v = (0.16 + 0.94 * t) * sp * (i === 0 ? 0.8 : 1); C.push(v * 0.94, v, v * 0.9);
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
  // cipreste colunar (quase preto na foto): três saias estreitas de 5 lados, 30 triângulos
  const parts = []; const tiers = [[0.42, 1.1, 0.0], [0.34, 0.9, 0.6], [0.22, 0.7, 1.15]];
  for (const [r, h, y] of tiers) { const c = new THREE.ConeGeometry(r, h, 5, 1, false); c.translate(0, y + h / 2, 0); parts.push(c); } // cones fechados: sem vão por baixo das saias
  const g = mergeGeos(parts);
  const p = g.attributes.position; const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const t = clamp(p.getY(i) / 1.85, 0, 1); const v = 0.45 + 0.5 * t; col[i * 3] = v * 0.85; col[i * 3 + 1] = v; col[i * 3 + 2] = v * 0.92; }
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
  // três níveis de cada copa: folhaPerto (lóbulos redondos), folha (lóbulos de 20 faces) e folhaLow
  // (cacho alongado de 15 tri, para a mata vista de longe); duas sementes, alternadas por bloco da mata
  GEO = { folhaPerto: cachoGeo(3, lobosCacho(3), 0.2, ICO1), folha: cachoGeo(3, lobosCacho(3)), folhaLow: cachoBaixo(5),
    folhaPerto2: cachoGeo(11, lobosCacho(11), 0.2, ICO1), folha2: cachoGeo(11, lobosCacho(11)), folhaLow2: cachoBaixo(13),
    conifera: coniferGeo(), palmeira: palmGeo(), tronco: trunk };
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
  'vec3 wIrr = saturate( ( dot( geometryNormal, directLight.direction ) + 0.3 ) / 1.3 ) * directLight.color; reflectedLight.directDiffuse += wIrr * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );');
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
        diffuseColor.rgb *= 0.72 + 0.56 * fo;
        // copas miúdas da mata da foto: cada copa grande vira várias copinhas de ~0,45 (células de Worley no
        // plano), com o miolo claro e o vão escuro entre elas
        { vec2 q = vFolhaW.xz / 0.45; vec2 iq = floor(q), fq = fract(q); float d1 = 8.0;
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(float(i), float(j)), c = iq + g;
            vec2 o = fract(sin(vec2(dot(c, vec2(127.1, 311.7)), dot(c, vec2(269.5, 183.3)))) * 43758.5453); vec2 r = g + o - fq; d1 = min(d1, dot(r, r)); }
          diffuseColor.rgb *= mix(0.3, 1.14, 1.0 - smoothstep(0.1, 0.6, d1)); }`)
      // de perto, a mesma folhagem vira relevo (normal perturbada pela derivada na tela; some de longe)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float wb = 1.0 - smoothstep(0.012, 0.04, length(fwidth(vFolhaW)));
          if (wb > 0.0) { vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition); vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1);
            vec2 dh = vec2(dFdx(fo), dFdy(fo)) * 0.05 * wb; normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2)); } }`)
      .replace('#include <lights_physical_pars_fragment>', LUZ_FOLHA);
  };
  LEAF.customProgramCacheKey = () => 'folha3';
  return LEAF;
}
export function trunkMaterial() { if (!TRUNK) TRUNK = new THREE.MeshStandardMaterial({ color: 0x6a4a32, roughness: 0.95 }); return TRUNK; }

// paletas de verde (instanceColor multiplica a cor de vértice)
// (a mata da foto, medida: verdes-oliva fundos e pouco saturados, média #32302a com os vãos quase pretos;
// 2,5% de copas ocre)
export const VERDES = { // albedo linear
  mata: [[0.044, 0.102, 0.025], [0.034, 0.084, 0.023], [0.058, 0.12, 0.028], [0.076, 0.144, 0.033], [0.028, 0.068, 0.021], [0.05, 0.089, 0.037], [0.093, 0.141, 0.042]], // #3b5a2c #34522a #44612f #4e6a33 #2f4a28 #3f5436 #56693a
  jardim: [[0.12, 0.24, 0.045], [0.085, 0.2, 0.04], [0.15, 0.26, 0.055], [0.19, 0.25, 0.045]],
  outono: [[0.479, 0.144, 0.023], [0.584, 0.254, 0.037], [0.333, 0.195, 0.023]], // #b86a2a #c98a36 #9c7a2a
  outonoClaro: [[0.397, 0.479, 0.048], [0.333, 0.423, 0.04]], // amarelo-esverdeado do miolo do Santuário
  savana: [[0.17, 0.21, 0.06], [0.21, 0.22, 0.07], [0.13, 0.19, 0.055]],
  conifera: [[0.014, 0.033, 0.019], [0.017, 0.04, 0.023], [0.011, 0.027, 0.018]], // #1f3326 #23382a #1b2e24
  flores: [[0.55, 0.08, 0.05], [0.6, 0.22, 0.04], [0.5, 0.09, 0.2]], // jardineiras (vermelho, laranja, rosa)
};
const ORLA = [0.114, 0.195, 0.045]; // #5f7a3c, só na faixa de 1,2 da borda das clareiras

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
    if (t.orla !== undefined && k !== 'conifera') { if (t.orla < 1.2) { v *= 1.12; r = r * 0.8 + ORLA[0] * 0.2; g = g * 0.8 + ORLA[1] * 0.2; b = b * 0.8 + ORLA[2] * 0.2; } else if (t.orla > 3) v *= 0.75; } // miolo da mata mais fundo
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

// ---------- aldeia ----------
// casinha de 0,9 x 0,7 x 0,4 (paredes creme) com telhado de duas águas de 0,25 e beiral de 0,08 (terracota):
// 14 triângulos com cor por vértice; as 9 casas numa InstancedMesh (uma chamada)
let ALDEIA_GEO = null;
function aldeiaGeo() {
  if (ALDEIA_GEO) return ALDEIA_GEO;
  const P = [], C = []; const par = [0.896, 0.822, 0.686], tel = [0.578, 0.133, 0.043]; // #f3ead8 e #c8663a em linear
  const tri = (a, b, c, col) => { P.push(...a, ...b, ...c); C.push(...col, ...col, ...col); };
  const quad = (a, b, c, d, col) => { tri(a, b, c, col); tri(a, c, d, col); };
  const w = 0.45, d = 0.35, h = 0.4, hr = 0.25, e = 0.08, ye = h - (e * hr) / d;
  quad([-w, 0, d], [w, 0, d], [w, h, d], [-w, h, d], par); quad([w, 0, -d], [-w, 0, -d], [-w, h, -d], [w, h, -d], par);
  quad([w, 0, d], [w, 0, -d], [w, h, -d], [w, h, d], par); quad([-w, 0, -d], [-w, 0, d], [-w, h, d], [-w, h, -d], par);
  tri([w, h, d], [w, h, -d], [w, h + hr, 0], par); tri([-w, h, -d], [-w, h, d], [-w, h + hr, 0], par);
  quad([-w - e, ye, d + e], [w + e, ye, d + e], [w + e, h + hr, 0], [-w - e, h + hr, 0], tel); quad([w + e, ye, -d - e], [-w - e, ye, -d - e], [-w - e, h + hr, 0], [w + e, h + hr, 0], tel);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
  g.userData.compartilhada = true; return (ALDEIA_GEO = g);
}
function aldeiaMesh(casas) {
  const im = new THREE.InstancedMesh(aldeiaGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), casas.length);
  casas.forEach(([x, z, rot], i) => { const k = 0.88 + hash(i, 3, 2727) * 0.24; _p.set(x, heightAt(x, z) - 0.04, z); _e.set(0, rot, 0); _q.setFromEuler(_e); _s.set(k, 0.92 + hash(i, 4, 2727) * 0.16, k); im.setMatrixAt(i, _m4.compose(_p, _q, _s)); });
  im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); im.name = 'aldeia'; return im;
}

// ---------- floresta da mesa ----------
// Blocos de 16 x 10 unidades para o descarte por visão, cada um com três malhas de copa (lóbulos
// redondos bem de perto, lóbulos simples a meia distância e cacho alongado de longe) no mesmo material.
// O nível de detalhe é escolhido por célula de 8 x 5 dentro do bloco (raio da copa em pixels no ponto da
// célula mais perto da câmera, com histerese): cada malha do bloco desenha só as células do seu nível,
// e um bloco custa 1 chamada (2 ou 3 só quando mistura níveis). As coníferas ficam em 3 faixas (fundo e
// laterais), uma chamada cada.
const BLOCO_X = 16, BLOCO_Z = 10, CEL_X = 8, CEL_Z = 5, RAIO_COPA = 0.45;
const LOD = [[15, 13.5], [31, 27]]; // [entra, sai] do nível 1 e do 2 (na vista da foto a 1376x768 quase tudo fica no nível de 15 triângulos)
export class Forest {
  constructor(engine) {
    this.e = engine; this.group = new THREE.Group(); this.group.name = 'floresta'; engine.scene.add(this.group);
    this.chunks = []; this.lods = []; this.canteiro = null; this.cast = false; this.stats = { trocas: 0, alto: 0, perto: 0, refeitos: 0 };
    this._cam = [NaN, 0, 0, 0, 0]; this._build();
  }
  _build() {
    const step = 0.5; const R = rng(4242); const trees = []; const cant = []; // (mata 44% mais densa: o dono liberou o triplo do volume)
    const semMata = A.semMata || []; const aldeia = aldeiaCasas(); const ca = (A.aldeia || { c: [-27.5, 3.0] }).c; const ilha = A.santuario.lago?.ilha;
    // três classes em manchas de 3 a 6 unidades: arbusto (30%), média (50%) e emergente (20%); perto da aldeia só as duas primeiras
    const classe = (jx, jz, pertoAldeia) => { let f = fbm(jx, jz, 4, 22, 2); if (pertoAldeia && f > 0.62) f = 0.55; return f < 0.41 ? [0.3 + R() * 0.1, 0.7] : f > 0.62 ? [0.72 + R() * 0.23, 1.25 + R() * 0.15] : [0.48 + R() * 0.18, 1.0]; };
    const noLaco = (x, z) => inEllipse(x, z, 23.8, -9.0, 3.6, 2.9, 0); // miolo do laço do Santuário: 1,3x mais denso, 15% amarelo-esverdeado
    for (let z = MESA.z0 + 0.35; z < MESA.z1 - 0.3; z += step) {
      for (let x = MESA.x0 + 0.35; x < MESA.x1 - 0.3; x += step) {
        const jx = x + (R() - 0.5) * step * 0.9, jz = z + (R() - 0.5) * step * 0.9;
        const inCant = inPoly(jx, jz, A.canteiro.poly);
        if (!inCant && !isForest(jx, jz)) continue;
        if (!inCant && semMata.some((p) => inPoly(jx, jz, p))) continue; // pegada da fita e da rampa do Santuário
        if (ilha && Math.hypot(jx - ilha.c[0], jz - ilha.c[1]) < 0.4) continue; // (a copa da ilhota é posta à mão)
        const cl = inCant ? 2 : clearance(jx, jz); const edge = clamp(cl, 0, 3); const laco = !inCant && noLaco(jx, jz);
        // ciprestes em grupos de 3 a 8 na orla oeste, na leste e no fundo (4% soltos em toda parte)
        const largo = Math.abs(jx) > 22 || jz < -14; const pc = (largo ? 0.55 * smoothstep(0.55, 0.72, fbm(jx, jz, 5, 23, 2)) : 0) + 0.04;
        const conif = !inCant && R() < pc;
        const [s0, h] = classe(jx, jz, Math.hypot(jx - ca[0], jz - ca[1]) < 2); const s = s0 * (0.8 + 0.2 * clamp(edge / 1.5, 0, 1));
        const kind = inCant ? 'folha' : conif ? 'conifera' : R() < 0.5 ? 'folha' : 'folha2';
        const pal = inCant ? 'mata' : conif ? 'conifera' : laco && R() < 0.15 ? 'outonoClaro' : R() < 0.02 ? 'outono' : 'mata';
        const t = { x: jx, z: jz, s: conif ? 0.42 + R() * 0.12 : s, kind, pal, h: conif ? 1.1 + R() * 0.4 : h, orla: inCant ? undefined : cl };
        (inCant ? cant : trees).push(t);
        if (laco && !conif && R() < 0.3) trees.push({ ...t, x: jx + (R() - 0.5) * 0.5, z: jz + (R() - 0.5) * 0.5, kind: R() < 0.5 ? 'folha' : 'folha2', pal: 'mata' });
      }
    }
    // sebe de folhosas altas ao norte do campo do Santuário, copa da ilhota da lagoa e 6 ciprestes altos junto à aldeia
    { const [cc, rx] = SANTUARIO_GRAMADO.elipse; for (let x = cc[0] - rx; x <= cc[0] + rx; x += 0.7) { const jx = x + (R() - 0.5) * 0.3, jz = -18.3 + (R() - 0.5) * 0.3; if (!isForest(jx, jz)) continue; trees.push({ x: jx, z: jz, s: 0.7 + R() * 0.2, kind: R() < 0.5 ? 'folha' : 'folha2', pal: 'mata', h: 1.2 + R() * 0.15, orla: clearance(jx, jz) }); } }
    if (ilha) trees.push({ x: ilha.c[0], z: ilha.c[1], s: 0.3, kind: 'folha', pal: 'jardim', h: 1.0, orla: 0.5 });
    for (let i = 0, n = 0; i < 12 && n < 6; i++) { const [hx, hz] = aldeia[i % aldeia.length] || ca; const a = (i / 6) * 6.283 + R() * 0.5, r = 1.0 + R() * 0.8; const jx = hx + Math.cos(a) * r, jz = hz + Math.sin(a) * r; if (!isForest(jx, jz)) continue; n++; trees.push({ x: jx, z: jz, s: 0.46 + R() * 0.1, kind: 'conifera', pal: 'conifera', h: 1.35 + R() * 0.15, orla: clearance(jx, jz) }); }
    const G = treeGeos();
    // folhosas: blocos de descarte, com as árvores em ordem de célula
    const blocos = new Map();
    for (const t of trees) { if (t.kind === 'conifera') continue; const bx = Math.floor((t.x - MESA.x0) / BLOCO_X), bz = Math.floor((t.z - MESA.z0) / BLOCO_Z), k = bx * 64 + bz; if (!blocos.has(k)) blocos.set(k, { bx, bz, l: [] }); blocos.get(k).l.push(t); }
    for (const { bx, bz, l } of blocos.values()) this.group.add(this._bloco(l, (bx + bz) & 1));
    // ciprestes: três faixas (fundo e laterais), uma chamada cada
    const faixas = [[], [], []]; for (const t of trees) if (t.kind === 'conifera') faixas[t.z < -14 ? 0 : t.x < 0 ? 1 : 2].push(t);
    for (const l of faixas) { if (!l.length) continue; const g = new THREE.Group(); g.name = 'mata'; const cm = this._nova(G.conifera, l.length); preencher(cm, l, 'conifera'); cm.computeBoundingSphere(); cm.userData.kind = 'conifera'; g.add(cm); this.group.add(g); this.chunks.push(g); }
    this.count = trees.length; this.coniferas = faixas[0].length + faixas[1].length + faixas[2].length;
    // aldeia de telhados terracota (uma chamada)
    if (aldeia.length) { this.aldeia = aldeiaMesh(aldeia); this.group.add(this.aldeia); }
    this.canteiro = treeGroup(cant, { name: 'reflorestamento', cast: this.cast }); this.canteiro.visible = false; this.group.add(this.canteiro);
    this.canteiroN = cant.length;
  }
  _nova(geo, n) { const m = new THREE.InstancedMesh(geo, leafMaterial(), n); m.castShadow = this.cast; m.receiveShadow = true; return m; }
  // Bloco de descarte com três malhas de copa (longe, meia distância e perto) e as árvores em ordem de célula de
  // CEL_X x CEL_Z; par alterna as duas formas de copa (quebra a repetição sem chamada a mais). geos: as três
  // geometrias, de longe para perto (padrão: as da mata da planta)
  _bloco(l, par, geos = null) {
    const G = treeGeos(); const cel = (t) => Math.floor((t.x + 1000) / CEL_X) * 4096 + Math.floor((t.z + 1000) / CEL_Z);
    l.sort((a, b) => cel(a) - cel(b)); const n = l.length; const g = new THREE.Group(); g.name = 'mata';
    const [gLo, gHi, gPe] = geos || (par ? [G.folhaLow2, G.folha2, G.folhaPerto2] : [G.folhaLow, G.folha, G.folhaPerto]);
    const hi = this._nova(gHi, n); preencher(hi, l, 'folha');
    const lo = this._nova(gLo, n), pe = this._nova(gPe, n);
    const M0 = hi.instanceMatrix.array.slice(), C0 = hi.instanceColor.array.slice(); // matrizes e cores de referência, em ordem de célula
    for (const m of [lo, pe]) { m.instanceMatrix = new THREE.InstancedBufferAttribute(M0.slice(), 16); m.instanceColor = new THREE.InstancedBufferAttribute(C0.slice(), 3); }
    const niveis = [lo, hi, pe]; for (const m of niveis) { m.computeBoundingSphere(); m.userData.kind = 'folha'; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor.setUsage(THREE.DynamicDrawUsage); g.add(m); }
    // células: faixa [a, b) das instâncias e caixa das árvores
    const cels = []; for (let i = 0; i < n; i++) { const t = l[i]; let c = cels[cels.length - 1]; if (!c || c.k !== cel(t)) { c = { k: cel(t), a: i, b: i, bx: [1e9, -1e9, 1e9, -1e9], n: 0 }; cels.push(c); } c.b = i + 1; c.bx[0] = Math.min(c.bx[0], t.x); c.bx[1] = Math.max(c.bx[1], t.x); c.bx[2] = Math.min(c.bx[2], t.z); c.bx[3] = Math.max(c.bx[3], t.z); }
    const L = { niveis, cels, M0, C0 }; this._preencher(L); this.lods.push(L); this.chunks.push(g);
    return g;
  }
  // Mata dos arredores (fora da planta): os mesmos blocos com nível de detalhe por célula, num grupo que some no
  // modo exposição. lados: listas de árvores (um bloco por lado, para o descarte por visão)
  arredores(lados) {
    if (this.fora) return this.fora;
    const G = treeGeos(); this.fora = new THREE.Group(); this.fora.name = 'mata-arredores'; const n0 = this.lods.length;
    lados.forEach((l, i) => { if (l.length) this.fora.add(this._bloco(l, i & 1, i & 1 ? [G.folhaLow2, G.folhaLow2, G.folha2] : [G.folhaLow, G.folhaLow, G.folha])); }); // fora da planta, o nível médio também usa o cacho de 15 triângulos
    this.lodsFora = this.lods.slice(n0); this.group.add(this.fora); this._cam[0] = NaN; this.e.shadowDirty = true;
    return this.fora;
  }
  mostrarArredores(on) { if (!this.fora) return; this.fora.visible = on; for (const L of this.lodsFora) L.oculto = !on; this._cam[0] = NaN; this.e.shadowDirty = true; }
  // cada malha do bloco recebe, em sequência, as células do seu nível (cópia das referências; sem alocar)
  _preencher(L) {
    for (let v = 0; v < 3; v++) {
      const m = L.niveis[v], dm = m.instanceMatrix.array, dc = m.instanceColor.array; let k = 0;
      for (const c of L.cels) {
        if (c.n !== v) continue;
        for (let i = c.a * 16, f = c.b * 16; i < f; i++) dm[k * 16 + i - c.a * 16] = L.M0[i];
        for (let i = c.a * 3, f = c.b * 3; i < f; i++) dc[k * 3 + i - c.a * 3] = L.C0[i];
        k += c.b - c.a;
      }
      m.count = k; m.visible = k > 0; if (k) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    }
  }
  setShadows(on) { this.cast = on; this.group.traverse((o) => { if (o.isInstancedMesh) o.castShadow = on; }); this.e.shadowDirty = true; }
  // crescimento do reflorestamento do canteiro (0..1)
  setReflorestamento(k) {
    this.canteiro.visible = k > 0.001;
    this.canteiro.scale.setScalar(1); this.canteiro.traverse((o) => { if (o.isInstancedMesh) o.material = leafMaterial(); });
    this.canteiro.position.y = -(1 - k) * 1.4; this.e.shadowDirty = true;
  }
  // nível de detalhe por célula: raio de copa projetado (pixels da imagem renderizada) no ponto da célula
  // mais perto da câmera, com histerese; só recalcula quando a câmera anda, e só refaz o bloco que mudou
  _lod() {
    const cam = this.e.camera; if (!cam) return; const p = cam.position; const hpx = this.e.H || 720; const U = this._cam;
    if (U[0] === p.x && U[1] === p.y && U[2] === p.z && U[3] === cam.fov && U[4] === hpx) return;
    U[0] = p.x; U[1] = p.y; U[2] = p.z; U[3] = cam.fov; U[4] = hpx;
    const k = (RAIO_COPA * hpx * 0.5) / Math.tan((cam.fov * Math.PI) / 360); let alto = 0, perto = 0; const dy = Math.max(p.y - 1.2, 0);
    for (const L of this.lods) {
      if (L.oculto) continue;
      let mudou = false;
      for (const c of L.cels) {
        const dx = Math.max(c.bx[0] - p.x, 0, p.x - c.bx[1]), dz = Math.max(c.bx[2] - p.z, 0, p.z - c.bx[3]);
        const px = k / Math.max(0.5, Math.hypot(dx, dy, dz));
        const n = px > LOD[1][c.n >= 2 ? 1 : 0] ? 2 : px > LOD[0][c.n >= 1 ? 1 : 0] ? 1 : 0;
        if (n !== c.n) { c.n = n; mudou = true; this.stats.trocas++; }
        if (n >= 1) alto++; if (n === 2) perto++;
      }
      if (mudou) { this._preencher(L); this.stats.refeitos++; }
    }
    this.stats.alto = alto; this.stats.perto = perto;
  }
  update(t) { windU.value = t / 1000; this._lod(); }
}
