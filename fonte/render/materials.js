// Materiais compartilhados (PBR). A intensidade das luzes internas acompanha o ciclo dia/noite.
import * as THREE from 'three';
import { tex, facadeTextures } from './textures.js';
import { MESA } from '../data/planta.js';

export const M = {};
const litMats = []; // materiais com emissivo que variam com a noite
export let nightLevel = 1, nightExtra = 0;
// água dos lagos: mapa da altura do leito (o terreno preenche) e o tempo em segundos
export const AGUA = { tProf: { value: null }, aguaOn: { value: 0 }, aguaT: { value: 0 }, aguaP: { value: new THREE.Vector4(MESA.x0, MESA.z0, 1 / (MESA.x1 - MESA.x0), 1 / (MESA.z1 - MESA.z0)) },
  raso: { value: new THREE.Color(0x94b0ac) }, fundo: { value: new THREE.Color(0x6a8890) }, margem: { value: new THREE.Color(0xcfd6c8) }, // água turva cinza-esverdeada da foto (#647070)
  turvo: { value: 0 }, lodo: { value: new THREE.Color(0x6b6650) } }; // lago assoreado (turvo 1): lodo pardo, mais escuro e fosco
const MACRO = { tMacro: { value: null } };
const LAMP = new THREE.Color(0xffd9a0);

function std(o) { return new THREE.MeshStandardMaterial(o); }
// posição em mundo no vértice (com instâncias), para o que é amostrado em XZ de mundo
const VPOS = (v) => `{ vec4 pw = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    pw = instanceMatrix * pw;
  #endif
  ${v} = ( modelMatrix * pw ).xz; }`;
// macro-variação em mundo: manchas de 23 unidades que quebram a repetição de gramados e coberturas
function comMacro(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tMacro = MACRO.tMacro;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vMacro;').replace('#include <project_vertex>', '#include <project_vertex>\n' + VPOS('vMacro'));
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vMacro; uniform sampler2D tMacro;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= 0.88 + 0.24 * texture2D( tMacro, vMacro / 23.0 ).r;');
  };
  mat.customProgramCacheKey = () => 'macro';
  return mat;
}
// grades com alfa (dossel, treliça, telas): alpha-to-coverage suaviza a borda com o MSAA e o alfa
// cresce com o nível de mipmap para as linhas não sumirem de longe (sem MSAA vira alphaTest comum)
function comGrade(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_MAP
        { vec2 gt = vMapUv * vec2( textureSize( map, 0 ) ); float mip = max( 0.0, 0.5 * log2( max( max( dot( dFdx( gt ), dFdx( gt ) ), dot( dFdy( gt ), dFdy( gt ) ) ), 1e-8 ) ) );
          diffuseColor.a *= 1.0 + mip * 0.3; }
      #endif`);
  };
  mat.customProgramCacheKey = () => 'grade';
  return mat;
}
// lagos: cor pela altura da lâmina d'água sobre o leito (raso, fundo e margem clara na linha d'água,
// que acompanha o nível do lago) e duas camadas de ondas em direções diferentes. O canal verde do mapa
// marca o lago central: assoreado (AGUA.turvo), ele fica pardo, mais escuro e fosco
function comAgua(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, AGUA);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAguaW;').replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 aw = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          aw = instanceMatrix * aw;
        #endif
        vAguaW = ( modelMatrix * aw ).xyz; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vAguaW; uniform sampler2D tProf; uniform float aguaOn; uniform float aguaT; uniform vec4 aguaP; uniform vec3 raso; uniform vec3 fundo; uniform vec3 margem; uniform float turvo; uniform vec3 lodo;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float tvAgua = 0.0;
        if ( aguaOn > 0.5 ) { vec2 tp = texture2D( tProf, ( vAguaW.xz - aguaP.xy ) * aguaP.zw ).rg; float dq = vAguaW.y - ( tp.r * 0.5 - 0.45 ); tvAgua = turvo * tp.g;
          diffuseColor.rgb = mix( mix( mix( raso, fundo, smoothstep( 0.0, 0.2, dq ) ), lodo, tvAgua ), margem, 0.35 * ( 1.0 - smoothstep( 0.0, 0.03, dq ) ) ); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix( roughnessFactor, 0.5, tvAgua );')
      .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', `vec3 mapN = texture2D( normalMap, vNormalMapUv + aguaT * vec2( 0.012, 0.008 ) ).xyz * 2.0 - 1.0;
        vec3 mapN2 = texture2D( normalMap, vNormalMapUv * 1.73 + aguaT * vec2( -0.007, 0.011 ) ).xyz * 2.0 - 1.0;
        mapN = normalize( vec3( mapN.xy + mapN2.xy, mapN.z * mapN2.z ) );`);
  };
  mat.customProgramCacheKey = () => 'agua';
  return mat;
}
function acesa(m, base) { m.userData.baseEmissive = base; m.userData.acesa = true; m.emissiveIntensity = base; litMats.push(m); return m; }

export function makeMaterials() {
  MACRO.tMacro.value = tex.macro();
  const conc = tex.concrete(); conc.repeat.set(2, 2);
  M.white = std({ color: 0xf3f0e8, roughness: 0.78, metalness: 0.0, map: conc });
  M.concreto = std({ color: 0xa8a49b, roughness: 0.92, map: conc });
  M.whiteSmooth = std({ color: 0xe6e1d6, roughness: 0.42, metalness: 0.05 });
  M.fascia = std({ color: 0xece8df, roughness: 0.5, metalness: 0.02 });
  M.cream = std({ color: 0xe9e0cf, roughness: 0.8 });
  M.grey = std({ color: 0x9aa0a8, roughness: 0.7 });
  M.dark = std({ color: 0x2a2f38, roughness: 0.75 });
  M.steel = std({ color: 0xc9ced6, roughness: 0.32, metalness: 0.75 });
  M.steelDark = std({ color: 0x6b7482, roughness: 0.4, metalness: 0.7 });
  M.roofMetal = std({ color: 0x8f959c, roughness: 0.45, metalness: 0.6 });
  M.bandaCinza = std({ color: 0xcdc8bf, roughness: 0.55 });
  M.caminhoTeto = std({ color: 0xbdb6a6, roughness: 0.8 });
  M.roof = comMacro(std({ color: 0xffffff, map: tex.roof(), normalMap: tex.roofNormal(), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.95 }));
  M.planter = comMacro(std({ color: 0x4d6b35, roughness: 0.95 }));
  M.lawn = comMacro(std({ color: 0x7fa060, map: tex.grass(), roughness: 0.95 }));
  M.grassBright = comMacro(std({ color: 0x9fd27a, map: tex.grass(), roughness: 0.95 }));
  M.field = std({ color: 0xffffff, map: tex.field(), roughness: 0.9 });
  M.track = std({ color: 0xffffff, map: tex.track(), roughness: 0.9 });
  M.pavers = std({ color: 0xffffff, map: tex.pavers(), roughness: 0.86 });
  M.sand = std({ color: 0xffffff, map: tex.sand(), roughness: 1 });
  M.soil = std({ color: 0xffffff, map: tex.soil(), roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }); // placa de terra provisória vence o terreno logo abaixo
  M.rock = std({ color: 0x8d8170, map: tex.rock(), roughness: 0.95 });
  M.wood = std({ color: 0xffffff, map: tex.wood(), roughness: 0.72 });
  M.woodLight = std({ color: 0xffffff, map: tex.woodLight(), roughness: 0.6 });
  M.woodFrame = std({ color: 0xc4a27a, map: tex.veio(), roughness: 0.7 });
  M.lattice = comGrade(std({ color: 0xffffff, map: tex.lattice(), alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.6 }));
  const cg = tex.canopyGrid();
  M.canopyGrid = comGrade(std({ color: 0xffffff, map: cg, alphaTest: 0.3, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.55, emissive: 0x3a2a14, emissiveMap: cg, emissiveIntensity: 0.25 }));
  M.mesh = comGrade(std({ color: 0xffffff, map: tex.mesh(), alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.4 }));
  M.glass = std({ color: 0xa9d8ee, roughness: 0.06, metalness: 0.25, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
  M.glassDome = std({ color: 0xd6eef8, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.9 });
  M.glassRail = std({ color: 0xcfe9f5, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2 });
  M.glassWarm = std({ color: 0xffe2b0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false, emissive: 0xffb45a, emissiveIntensity: 0.6, side: THREE.DoubleSide });
  M.vidroDossel = std({ color: 0xcfc9bd, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const wn = tex.waterNormal(); wn.repeat.set(6, 6);
  // lagos opacos: o leito não aparece, a profundidade vem do mapa do leito; as ondas andam no shader
  // (cópia do mapa de normais, com a mesma imagem), enquanto espelhos d'água e aquário andam pelo offset
  M.water = comAgua(std({ color: 0x40605f, roughness: 0.1, metalness: 0.1, normalMap: wn.clone(), normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.2 }));
  // aquário do Bioma: continua translúcido (a fauna nada dentro do volume de água)
  M.waterDeep = std({ color: 0x1f7fa0, roughness: 0.05, metalness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.25, 0.25), transparent: true, opacity: 0.82, emissive: 0x0d6788, emissiveIntensity: 0.08, envMapIntensity: 1.3 });
  M.pool = std({ color: 0x4c6a6a, roughness: 0.4, metalness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.2, 0.2), envMapIntensity: 1.2 }); // espelhos d'água escuros (#3e4d43 na foto)
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
  M.lampGlow = new THREE.MeshBasicMaterial({ color: LAMP.clone().multiplyScalar(3.2) });
  M.cyanGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe9ff).multiplyScalar(2.2) });
  M.redGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a4a).multiplyScalar(2.5) });
  M.blueprint = new THREE.MeshBasicMaterial({ color: 0x57d8ff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  M.blueprintLine = new THREE.LineBasicMaterial({ color: new THREE.Color(0x7fe9ff).multiplyScalar(1.4), transparent: true, opacity: 0.55, depthWrite: false });
  M.loteLinha = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fe8ff).multiplyScalar(1.6), transparent: true, opacity: 0.8, depthWrite: false });
  M.loteFill = new THREE.MeshBasicMaterial({ color: 0x57d8ff, transparent: true, opacity: 0.2, depthWrite: false });
  M.ghostOk = new THREE.MeshBasicMaterial({ color: 0x46e3b5, transparent: true, opacity: 0.35, depthWrite: false });
  M.sel = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd98a).multiplyScalar(1.6), transparent: true, opacity: 0.5, depthWrite: false });
  M.shadowBlob = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  // fachadas: a luz âmbar vem do emissivo; à noite ele cresce (setNight com extra)
  const baseFac = { quente: 0.9, lab: 0.8, escuro: 0.5, madeira: 0.95 };
  for (const s of ['quente', 'lab', 'escuro', 'madeira']) {
    const f = facadeTextures(s);
    M['fac_' + s] = acesa(std({ color: 0xffffff, map: f.map, emissive: 0xffffff, emissiveMap: f.emissive, roughness: 0.28, metalness: 0.15, envMapIntensity: 0.8 }), baseFac[s]);
  }
  acesa(M.glassWarm, 0.6);
  M.waterDeep.userData.baseEmissive = 0.08; litMats.push(M.waterDeep);
  setNight(nightLevel, nightExtra);
  return M;
}
// n: 0 (dia) a 1 (noite/exposição); extra: reforço noturno das fachadas, do vidro quente e das luminárias
export function setNight(n, extra = 0) {
  nightLevel = n; nightExtra = extra;
  for (const m of litMats) m.emissiveIntensity = (m.userData.baseEmissive || 1) * (0.25 + 0.75 * n) * (m.userData.acesa ? 1 + extra : 1);
  if (M.lampGlow) M.lampGlow.color.copy(LAMP).multiplyScalar(3.2 + 2.8 * extra);
}
// copia os ganchos de shader de um material para o clone (clone() não copia onBeforeCompile)
function ganchos(de, para) { if (Object.prototype.hasOwnProperty.call(de, 'onBeforeCompile')) para.onBeforeCompile = de.onBeforeCompile; if (Object.prototype.hasOwnProperty.call(de, 'customProgramCacheKey')) para.customProgramCacheKey = de.customProgramCacheKey; return para; }
// versão dupla-face (cache) de um material
const _dupla = new Map();
export function dupla(m) { if (m.side === THREE.DoubleSide) return m; if (!_dupla.has(m)) { const c = ganchos(m, m.clone()); c.side = THREE.DoubleSide; if (m.userData.baseEmissive) { c.userData.baseEmissive = m.userData.baseEmissive; litMats.push(c); c.emissiveIntensity = m.emissiveIntensity; } _dupla.set(m, c); } return _dupla.get(m); }
// clona um material para uso com plano de corte (obra subindo)
export function clipped(mat, planes) {
  const m = ganchos(mat, mat.clone()); m.clippingPlanes = planes; m.clipShadows = true; return m;
}
