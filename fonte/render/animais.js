// Animais estilizados em baixa contagem de polígonos (uma geometria com cores por vértice por espécie),
// manadas instanciadas que andam com passo de verdade (pernas em pares diagonais, arranque e parada
// suaves), sombras de contato baratas e um bando de aves. O movimento dos membros é feito no shader
// a partir de um atributo por vértice (aMembro: tipo, pivô x/y, peso) gravado aqui na geração.
import * as THREE from 'three';
import { inPoly, hash } from '../core/util.js';
import { heightAt } from './ground.js';

// tipos de membro (aMembro.x)
const PERNA_A = 1, PERNA_B = 2, TROMBA = 3, CAUDA_V = 4, CAUDA_L = 5, TORAX = 6, ASA = 7, RABO = 8, PESCOCO = 9;

function colorize(g, c) { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
// marca o membro: peso fixo ou função da posição (x, y, z) -> peso
function memb(g, tipo, px = 0, py = 0, peso = 1) {
  const p = g.attributes.position, n = p.count, a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { a[i * 4] = tipo; a[i * 4 + 1] = px; a[i * 4 + 2] = py; a[i * 4 + 3] = typeof peso === 'function' ? peso(p.getX(i), p.getY(i), p.getZ(i)) : peso; }
  g.setAttribute('aMembro', new THREE.BufferAttribute(a, 4)); return g;
}
function join(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), Mb = new Float32Array(n * 4); let o = 0;
  for (const g of list) { if (!g.attributes.normal) g.computeVertexNormals(); P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); if (g.attributes.aMembro) Mb.set(g.attributes.aMembro.array, o * 4); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3)); out.setAttribute('aMembro', new THREE.BufferAttribute(Mb, 4));
  out.computeBoundingSphere(); out.computeBoundingBox(); out.userData.compartilhada = true; return out;
}
const T = (g, x, y, z) => { g.translate(x, y, z); return g; };
const ell = (rx, ry, rz, seg = 10) => { const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg - 3)); g.scale(rx, ry, rz); return g; };
function limb(a, b, r0, r1, seg = 6) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const d = B.clone().sub(A); const L = d.length(); const g = new THREE.CylinderGeometry(r1, r0, L, seg); g.translate(0, L / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.applyQuaternion(q); g.translate(A.x, A.y, A.z); return g; }
// perna em pares diagonais: dianteira esquerda com traseira direita
const par = (x, z) => ((x > 0) === (z > 0) ? PERNA_A : PERNA_B);

// Gorila de maquete: preto, sela prateada no dorso. Em pé anda sobre os nós dos dedos (ombros mais
// altos que o quadril, tronco inclinado para a frente); a variante sentada tem o tronco ereto.
function gorila(sentado) {
  // quase preto e neutro sob o sol (a luz do dia já é fria nas sombras), sela prateada clara no dorso, como na foto
  const gc = [0.042, 0.042, 0.046], gp = [0.066, 0.063, 0.062], prata = [0.16, 0.16, 0.17]; const out = [];
  if (!sentado) {
    const tronco = ell(0.36, 0.30, 0.28); tronco.rotateZ(0.5); out.push(memb(colorize(T(tronco, 0.05, 0.55, 0), gc), TORAX, 0.05, 0.55));
    out.push(memb(colorize(T(ell(0.22, 0.2, 0.24), 0.18, 0.5, 0), gc), TORAX, 0.05, 0.55)); // peito
    out.push(memb(colorize(T(ell(0.18, 0.18, 0.22), -0.2, 0.45, 0), gc), TORAX, 0.05, 0.55)); // quadril
    out.push(memb(colorize(T(ell(0.2, 0.1, 0.18), -0.08, 0.72, 0), prata), TORAX, 0.05, 0.55)); // sela prateada
    out.push(colorize(T(ell(0.13, 0.14, 0.13), 0.34, 0.78, 0), gc));
    out.push(colorize(T(ell(0.08, 0.07, 0.08), 0.3, 0.9, 0), gc)); // crista
    out.push(colorize(T(ell(0.05, 0.03, 0.11), 0.42, 0.83, 0), gc)); // arco das sobrancelhas
    out.push(colorize(T(ell(0.07, 0.065, 0.09), 0.44, 0.74, 0), gp)); // focinho
    for (const s of [-1, 1]) { // braços longos com cotovelo, apoiados nos nós dos dedos; pernas curtas dobradas
      const A = par(1, s), B = par(-1, s);
      out.push(memb(colorize(T(ell(0.12, 0.12, 0.12), 0.22, 0.72, s * 0.22), gc), A, 0.22, 0.72));
      out.push(memb(colorize(limb([0.22, 0.72, s * 0.24], [0.3, 0.36, s * 0.3], 0.095, 0.085), gc), A, 0.22, 0.72));
      out.push(memb(colorize(limb([0.3, 0.36, s * 0.3], [0.36, 0.04, s * 0.3], 0.085, 0.07), gc), A, 0.22, 0.72));
      out.push(memb(colorize(T(ell(0.07, 0.04, 0.08, 6), 0.38, 0.03, s * 0.3), gp), A, 0.22, 0.72)); // nós dos dedos
      out.push(memb(colorize(limb([-0.2, 0.42, s * 0.17], [-0.06, 0.22, s * 0.2], 0.1, 0.085), gc), B, -0.2, 0.42));
      out.push(memb(colorize(limb([-0.06, 0.22, s * 0.2], [-0.14, 0.03, s * 0.2], 0.08, 0.07), gc), B, -0.2, 0.42));
      out.push(memb(colorize(T(ell(0.1, 0.03, 0.06, 6), -0.08, 0.02, s * 0.2), gp), B, -0.2, 0.42));
    }
  } else { // sentado: tronco ereto, mãos nos joelhos
    const tronco = ell(0.27, 0.34, 0.27); tronco.rotateZ(-0.15); out.push(memb(colorize(T(tronco, 0.0, 0.5, 0), gc), TORAX, 0, 0.5));
    out.push(memb(colorize(T(ell(0.12, 0.17, 0.2), -0.14, 0.44, 0), prata), TORAX, 0, 0.5));
    out.push(colorize(T(ell(0.22, 0.15, 0.25), -0.02, 0.17, 0), gc)); // quadril
    out.push(memb(colorize(T(ell(0.12, 0.14, 0.12), 0.06, 0.92, 0), gc), TORAX, 0, 0.5));
    out.push(colorize(T(ell(0.08, 0.06, 0.1), 0.03, 1.04, 0), gc));
    out.push(colorize(T(ell(0.06, 0.065, 0.085), 0.16, 0.88, 0), gp));
    for (const s of [-1, 1]) {
      out.push(colorize(T(ell(0.11, 0.11, 0.11), 0.02, 0.74, s * 0.24), gc));
      out.push(colorize(limb([0.02, 0.74, s * 0.25], [0.16, 0.44, s * 0.3], 0.09, 0.08), gc));
      out.push(colorize(limb([0.16, 0.44, s * 0.3], [0.3, 0.22, s * 0.24], 0.08, 0.065), gc));
      out.push(colorize(T(ell(0.06, 0.04, 0.07, 6), 0.32, 0.2, s * 0.24), gp));
      out.push(colorize(limb([0.0, 0.2, s * 0.15], [0.28, 0.26, s * 0.2], 0.1, 0.085), gc));
      out.push(colorize(limb([0.28, 0.26, s * 0.2], [0.34, 0.02, s * 0.2], 0.08, 0.07), gc));
      out.push(colorize(T(ell(0.1, 0.03, 0.06, 6), 0.38, 0.02, s * 0.2), gp));
    }
  }
  return join(out);
}
// ave em V: 4 triângulos com normais para cima, pontas das asas escuras; peso da asa = distância ao corpo
function aveGeo() {
  const N = [0.06, 0, 0], Tt = [-0.05, 0, 0], P = [], C = [], Mb = [];
  const cb = [0.86, 0.86, 0.84], cp = [0.3, 0.3, 0.32];
  for (const s of [-1, 1]) {
    const E = [-0.005, 0.012, s * 0.09], W = [-0.06, 0.02, s * 0.19];
    const tri = s > 0 ? [[N, Tt, E], [E, Tt, W]] : [[N, E, Tt], [E, W, Tt]];
    for (const t of tri) for (const v of t) { P.push(...v); C.push(...(v === W ? cp : cb)); Mb.push(ASA, 0, 0, Math.abs(v[2]) / 0.19); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('aMembro', new THREE.Float32BufferAttribute(Mb, 4));
  g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); g.userData.compartilhada = true; return g;
}

// todas as espécies voltadas para +x, com os pés em y = 0
let GEOS = null;
export function animalGeos() {
  if (GEOS) return GEOS;
  const cinza = [0.25, 0.24, 0.235], cinzaE = [0.18, 0.17, 0.17], marfim = [0.92, 0.88, 0.78]; // cinza médio sob o sol forte
  const eleph = [];
  eleph.push(colorize(T(ell(0.36, 0.26, 0.24), 0, 0.42, 0), cinza));
  eleph.push(colorize(T(ell(0.17, 0.17, 0.15), 0.36, 0.52, 0), cinza));
  for (const s of [-1, 1]) eleph.push(colorize(T(ell(0.03, 0.15, 0.13), 0.3, 0.53, s * 0.16), cinzaE));
  // tromba: ondula mais na ponta (peso cresce a partir da base)
  const pesoTromba = (x, y) => Math.min(1, Math.max(0, (0.52 - y) / 0.44 + (x - 0.48) * 0.5));
  eleph.push(memb(colorize(limb([0.48, 0.5, 0], [0.62, 0.24, 0], 0.06, 0.035), cinza), TROMBA, 0.48, 0.5, pesoTromba)); eleph.push(memb(colorize(limb([0.62, 0.24, 0], [0.64, 0.08, 0], 0.035, 0.03), cinza), TROMBA, 0.48, 0.5, pesoTromba));
  for (const s of [-1, 1]) eleph.push(colorize(limb([0.46, 0.42, s * 0.07], [0.6, 0.36, s * 0.1], 0.02, 0.01), marfim));
  for (const [x, z] of [[0.2, 0.12], [0.2, -0.12], [-0.2, 0.12], [-0.2, -0.12]]) eleph.push(memb(colorize(limb([x, 0.36, z], [x, 0, z], 0.075, 0.07), cinza), par(x, z), x, 0.36));
  eleph.push(memb(colorize(limb([-0.35, 0.45, 0], [-0.44, 0.25, 0], 0.015, 0.01), cinzaE), RABO, -0.35, 0.45, (x) => Math.min(1, Math.max(0, (-x - 0.35) / 0.09))));
  const gir = []; const am = [0.82, 0.6, 0.3], mar = [0.45, 0.28, 0.14];
  gir.push(colorize(T(ell(0.26, 0.15, 0.13), 0, 0.72, 0), am));
  // pescoço e cabeça acenam no ritmo do passo
  const pesoPesc = (x, y) => Math.min(1, Math.max(0, (y - 0.78) / 0.6));
  gir.push(memb(colorize(limb([0.18, 0.78, 0], [0.42, 1.36, 0], 0.07, 0.045), am), PESCOCO, 0.18, 0.78, pesoPesc));
  gir.push(memb(colorize(T(ell(0.1, 0.06, 0.055), 0.47, 1.38, 0), am), PESCOCO, 0.18, 0.78, 1));
  for (const s of [-1, 1]) gir.push(memb(colorize(limb([0.42, 1.42, s * 0.03], [0.41, 1.5, s * 0.035], 0.012, 0.01), mar), PESCOCO, 0.18, 0.78, 1));
  for (const [x, z] of [[0.16, 0.08], [0.16, -0.08], [-0.16, 0.08], [-0.16, -0.08]]) gir.push(memb(colorize(limb([x, 0.66, z], [x, 0, z], 0.035, 0.025), am), par(x, z), x, 0.66));
  for (let i = 0; i < 9; i++) gir.push(colorize(T(ell(0.035, 0.03, 0.036, 6), -0.15 + (i % 3) * 0.14, 0.78 + ((i / 3) | 0) * 0.04 - 0.04, (i % 2 ? 1 : -1) * 0.12), mar));
  const rino = []; const rc = [0.3, 0.28, 0.26];
  rino.push(colorize(T(ell(0.3, 0.17, 0.15), 0, 0.27, 0), rc)); rino.push(colorize(T(ell(0.14, 0.1, 0.09), 0.3, 0.24, 0), rc));
  rino.push(colorize(limb([0.4, 0.26, 0], [0.47, 0.38, 0], 0.03, 0.005), marfim)); rino.push(colorize(limb([0.34, 0.3, 0], [0.37, 0.36, 0], 0.02, 0.004), marfim));
  for (const [x, z] of [[0.16, 0.08], [0.16, -0.08], [-0.16, 0.08], [-0.16, -0.08]]) rino.push(memb(colorize(limb([x, 0.22, z], [x, 0, z], 0.05, 0.045), rc), par(x, z), x, 0.22));
  const baleia = []; const az = [0.74, 0.78, 0.82], br = [0.92, 0.93, 0.94]; // baleia branca, como a da maquete
  const pesoCauda = (x) => Math.max(0, -x - 0.5); // cauda sobe e desce (cetáceo)
  baleia.push(memb(colorize(T(ell(0.9, 0.24, 0.26, 12), 0, 0, 0), az), CAUDA_V, 0, 0, pesoCauda)); baleia.push(memb(colorize(T(ell(0.7, 0.12, 0.2, 10), 0.1, -0.12, 0), br), CAUDA_V, 0, 0, pesoCauda));
  { const t = new THREE.ConeGeometry(0.28, 0.1, 3); t.rotateZ(Math.PI / 2); t.scale(1, 1, 1.6); baleia.push(memb(colorize(T(t, -0.98, 0.02, 0), az), CAUDA_V, 0, 0, pesoCauda)); }
  for (const s of [-1, 1]) baleia.push(colorize(T(ell(0.22, 0.03, 0.08, 6), 0.3, -0.12, s * 0.28), az));
  const arraia = []; { const g = new THREE.ConeGeometry(0.35, 0.05, 4); g.rotateY(Math.PI / 4); g.scale(1, 1, 1.5); arraia.push(memb(colorize(g, [0.3, 0.3, 0.34]), ASA, 0, 0, (x, y, z) => Math.min(1, Math.abs(z) / 0.5) * 0.4)); arraia.push(colorize(limb([-0.2, 0, 0], [-0.6, 0, 0], 0.01, 0.004), [0.3, 0.3, 0.34])); }
  const peixe = []; peixe.push(memb(colorize(T(ell(0.08, 0.035, 0.02, 6), 0, 0, 0), [1, 0.62, 0.2]), CAUDA_L, 0, 0, (x) => Math.min(1, Math.max(0, (-x - 0.03) / 0.08)))); { const t = new THREE.ConeGeometry(0.04, 0.05, 3); t.rotateZ(Math.PI / 2); peixe.push(memb(colorize(T(t, -0.1, 0, 0), [1, 0.62, 0.2]), CAUDA_L, 0, 0, 1)); }
  GEOS = { elefante: join(eleph), girafa: join(gir), rinoceronte: join(rino), gorila: gorila(false), gorilaSentado: gorila(true), baleia: join(baleia), arraia: join(arraia), peixe: join(peixe), ave: aveGeo() };
  return GEOS;
}

// relógio dos animais em segundos (o mundo escreve a cada quadro)
export const tempoAnimais = { value: 0 };
const VS_DECL = /* glsl */`
  attribute vec4 aMembro; uniform float uTime;
  #ifdef USE_GAIT
    attribute vec2 aGait;
  #endif
  // ângulo das pernas no plano x-y: pares diagonais em oposição de fase
  float membroAng(float fase, float anda) { float t = aMembro.x; return (t > 0.5 && t < 2.5) ? sin(fase + (t > 1.5 ? 3.14159 : 0.0)) * 0.3 * anda : 0.0; }
  vec2 gira(vec2 p, vec2 pv, float a) { vec2 d = p - pv; float c = cos(a), s = sin(a); return pv + vec2(c * d.x - s * d.y, s * d.x + c * d.y); }`;
const VS_FASE = /* glsl */`
  #ifdef USE_GAIT
    float gFase = aGait.x, gAnda = aGait.y;
  #else
    float gFase = 0.0, gAnda = 0.0;
  #endif
  float gId = float(gl_InstanceID);`;
const VS_NORMAL = /* glsl */`
  { float a = membroAng(gFase, gAnda); if (a != 0.0) objectNormal.xy = gira(objectNormal.xy, vec2(0.0), a); }`;
const VS_POS = /* glsl */`
  {
    float tp = aMembro.x, w = aMembro.w; vec2 pv = aMembro.yz;
    float a = membroAng(gFase, gAnda);
    if (a != 0.0) transformed.xy = gira(transformed.xy, pv, a);
    else if (tp > 2.5 && tp < 3.5) transformed.z += sin(uTime * 1.3 + gId * 1.7) * 0.08 * w * w;
    else if (tp > 3.5 && tp < 4.5) transformed.y += sin(1.8 * uTime + 3.0 * position.x + gId) * 0.07 * w;
    else if (tp > 4.5 && tp < 5.5) transformed.z += sin(14.0 * uTime + gId) * 0.012 * w;
    else if (tp > 5.5 && tp < 6.5) transformed.xy = pv + (transformed.xy - pv) * (1.0 + 0.015 * sin(uTime * 1.5708 + gId * 1.3));
    else if (tp > 6.5 && tp < 7.5) {
      // asas: 3,5 batidas por segundo em 60% do ciclo, planando no resto
      float ciclo = fract(uTime * 0.23 + gId * 0.137); float bate = 1.0 - smoothstep(0.52, 0.6, ciclo) + smoothstep(0.96, 1.0, ciclo);
      transformed.y += (sin(uTime * 22.0 + gId * 1.9) * 0.9 * bate + 0.25) * 0.12 * w;
    }
    else if (tp > 7.5 && tp < 8.5) transformed.z += sin(uTime * 2.1 + gId) * 0.04 * w;
    else if (tp > 8.5) transformed.xy = gira(transformed.xy, pv, (sin(gFase * 2.0) * 0.06 * gAnda + sin(uTime * 0.7 + gId) * 0.02) * w);
    #ifdef USE_GAIT
      if (tp < 0.5 || tp > 2.5) transformed.y += abs(sin(gFase)) * 0.008 * gAnda;
    #endif
  }`;
function comGancho(m, passo) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = tempoAnimais;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VS_DECL)
      .replace('#include <beginnormal_vertex>', VS_FASE + '\n#include <beginnormal_vertex>' + VS_NORMAL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>' + VS_POS);
  };
  m.customProgramCacheKey = () => (passo ? 'animalPasso' : 'animal');
  if (passo) m.defines = { USE_GAIT: '' };
  // bicho se move no shader: fora do mapa de alturas (mas recebe a oclusão) e fora da fusão do mundo
  // (o fundido não leva aMembro nem gl_InstanceID)
  m.userData.movel = true;
  return m;
}
let MAT = null, MATP = null;
// material das estátuas, do aquário e das aves (sem passo: cauda, respiração, asas)
export function animalMaterial() { if (!MAT) MAT = comGancho(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85 }), false); return MAT; }
// material das manadas (com o passo por instância)
export function animalMaterialPasso() { if (!MATP) MATP = comGancho(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85 }), true); return MATP; }

// Sombras de contato: um disco escuro e macio sob cada bicho que anda (1 chamada para todos). Quem se
// move não projeta no mapa de sombra, que só é refeito quando a construção muda.
const BLOB_V = /* glsl */`varying vec2 vUv; void main() { vUv = uv; vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * p; }`;
const BLOB_F = /* glsl */`uniform float opac; varying vec2 vUv; void main() { float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - smoothstep(0.25, 1.0, r)) * opac); }`;
let BLOBS = null;
export function sombrasContato(max = 64) {
  if (BLOBS) return BLOBS;
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.userData.compartilhada = true;
  const mat = new THREE.ShaderMaterial({ vertexShader: BLOB_V, fragmentShader: BLOB_F, uniforms: { opac: { value: 0.35 } }, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.InstancedMesh(g, mat, max); mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.userData.semHAO = true; mesh.renderOrder = 1; mesh.name = 'sombras-contato';
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  BLOBS = { mesh, max, usado: 0, zero,
    reservar(n) { const i0 = this.usado; if (i0 + n > max) return -1; this.usado += n; mesh.count = this.usado; for (let i = i0; i < i0 + n; i++) mesh.setMatrixAt(i, zero); mesh.instanceMatrix.needsUpdate = true; return i0; },
    esconder(i0, n) { if (i0 < 0) return; for (let i = i0; i < i0 + n; i++) mesh.setMatrixAt(i, zero); mesh.instanceMatrix.needsUpdate = true; } };
  return BLOBS;
}

// Manada: instâncias que andam devagar até pontos aleatórios dentro de um polígono, com passo.
export class Manada {
  constructor(especie, n, area, o = {}) {
    this.area = area; this.o = o; this.escala = o.escala || 1;
    const base = animalGeos()[especie];
    // geometria rasa própria (os mesmos buffers da espécie) com o passo por instância
    const g = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(base.attributes)) g.setAttribute(k, a); g.boundingSphere = base.boundingSphere; g.boundingBox = base.boundingBox; g.userData.compartilhada = true;
    this.gait = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2); this.gait.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aGait', this.gait);
    this.mesh = new THREE.InstancedMesh(g, animalMaterialPasso(), n); this.mesh.castShadow = o.sombra ?? false; this.mesh.receiveShadow = true; this.mesh.userData.semHAO = true;
    this.a = []; const bb = area.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [1e9, 1e9, -1e9, -1e9]); this.bb = bb;
    // esfera fixa da área (os bichos andam: a esfera calculada das instâncias ficaria velha)
    this.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3((bb[0] + bb[2]) / 2, 0.6, (bb[1] + bb[3]) / 2), Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2 + 1.5);
    const bx = base.boundingBox; this.blobL = (bx.max.x - bx.min.x) * 1.05; this.blobW = (bx.max.z - bx.min.z) * 1.25;
    this.passo = (bx.max.y - bx.min.y) * 0.4; // comprimento de um ciclo de passo, pela altura do bicho
    for (let i = 0; i < n; i++) { const p = this._rand(i * 7 + 1); this.a.push({ x: p[0], z: p[1], tx: p[0], tz: p[1], ang: hash(i, 3, 5) * 6.28, wait: hash(i, 4, 5) * 6, v: (o.vel || 0.12) * (0.7 + hash(i, 5, 5) * 0.6), s: (0.85 + hash(i, 6, 5) * 0.3) * this.escala, y: o.y, anda: 0, fase: hash(i, 7, 5) * 6.28 }); }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this.k = 0;
    this.blobs = o.contato === false ? null : sombrasContato(); this.b0 = this.blobs ? this.blobs.reservar(n) : -1;
    this.update(0, 0);
  }
  _rand(seed) { const [x0, z0, x1, z1] = this.bb; for (let k = 0; k < 40; k++) { const x = x0 + Math.random() * (x1 - x0), z = z0 + Math.random() * (z1 - z0); if (inPoly(x, z, this.area)) return [x, z]; } return [(x0 + x1) / 2, (z0 + z1) / 2]; }
  // manada fora de cena (parte escondida): some a sombra de contato
  esconder() { this.blobs?.esconder(this.b0, this.a.length); }
  update(dt, t) {
    const G = this.gait.array;
    for (let i = 0; i < this.a.length; i++) {
      const a = this.a[i]; let quer = 0;
      if (a.wait > 0) a.wait -= dt; else {
        const dx = a.tx - a.x, dz = a.tz - a.z; const d = Math.hypot(dx, dz);
        if (d < 0.05 + a.v * 0.4 * a.anda) { if (a.anda < 0.05) { a.wait = 3 + Math.random() * 8; const p = this._rand(i); a.tx = p[0]; a.tz = p[1]; } }
        else { const want = Math.atan2(-dz, dx); let da = want - a.ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; a.ang += da * Math.min(1, dt * 1.5); quer = Math.abs(da) < 0.6 ? 1 : 0.35; }
      }
      // arranque e parada em 0,8 s, com curva suave na velocidade
      a.anda += Math.max(-dt / 0.8, Math.min(dt / 0.8, quer - a.anda)); const k = a.anda * a.anda * (3 - 2 * a.anda);
      if (k > 0) { a.x += Math.cos(a.ang) * a.v * k * dt; a.z -= Math.sin(a.ang) * a.v * k * dt; }
      a.fase += (dt * 6.2832 * a.v * k) / (this.passo * a.s);
      G[i * 2] = a.fase; G[i * 2 + 1] = k;
      const y = a.y ?? heightAt(a.x, a.z);
      this._e.set(0, a.ang, 0); this._q.setFromEuler(this._e); this._p.set(a.x, y + (this.o.flutua ? Math.sin(t * 0.001 + i) * 0.05 : 0), a.z); this._s.setScalar(a.s);
      this.mesh.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
      if (this.b0 >= 0) { this._p.y = y + 0.02; this._s.set(this.blobL * a.s, 1, this.blobW * a.s); this.blobs.mesh.setMatrixAt(this.b0 + i, this._m.compose(this._p, this._q, this._s)); }
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.gait.needsUpdate = true;
    if (this.b0 >= 0) this.blobs.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Bando de aves em V sobre o lago e a mata: trajetória de Lissajous (70 s), sobe e desce entre 5 e 7 e
// inclina nas curvas; as asas batem no shader. Some à noite (o mundo cuida disso).
export class Bando {
  constructor(n = 14, o = {}) {
    this.n = n; this.c = o.centro || [1.5, -6]; this.R = o.raio || [16, 10];
    this.mesh = new THREE.InstancedMesh(animalGeos().ave, animalMaterial(), n); this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = false; this.mesh.userData.semHAO = true; this.mesh.name = 'bando';
    this.off = []; for (let i = 0; i < n; i++) { const r = Math.ceil(i / 2), s = i % 2 ? 1 : -1; this.off.push([-r * 0.34 + (hash(i, 1, 81) - 0.5) * 0.08, (hash(i, 2, 81) - 0.5) * 0.12, s * r * 0.3]); }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this._a = [0, 0, 0]; this._b = [0, 0, 0]; this._c = [0, 0, 0];
    this.update(0, 0);
  }
  _pos(T, out) { const w = (Math.PI * 2) / 70; out[0] = this.c[0] + this.R[0] * Math.sin(w * T); out[1] = 6 + Math.sin(w * T * 1.3); out[2] = this.c[1] + this.R[1] * Math.sin(2 * w * T + 0.7); }
  update(dt, t) {
    const T = t / 1000, a = this._a, b = this._b, c = this._c;
    this._pos(T, a); this._pos(T + 0.5, b); this._pos(T + 1.0, c);
    const h0 = Math.atan2(-(b[2] - a[2]), b[0] - a[0]), h1 = Math.atan2(-(c[2] - b[2]), c[0] - b[0]); let dh = h1 - h0; while (dh > Math.PI) dh -= 6.283; while (dh < -Math.PI) dh += 6.283;
    const roll = Math.max(-0.5, Math.min(0.5, -dh * 2.2)), ch = Math.cos(h0), sh = Math.sin(h0);
    for (let i = 0; i < this.n; i++) {
      const [ox, oy, oz] = this.off[i]; // no referencial do bando: x para a frente, z para o lado
      this._p.set(a[0] + ox * ch + oz * sh, a[1] + oy + Math.sin(T * 1.1 + i * 0.9) * 0.05, a[2] - ox * sh + oz * ch);
      this._e.set(roll, h0, 0); this._q.setFromEuler(this._e); this.mesh.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
