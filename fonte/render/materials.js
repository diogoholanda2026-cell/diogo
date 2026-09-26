// Materiais compartilhados (PBR), com a paleta do BuildIt: limpa, clara e saturada (turquesa, verdes vivos,
// brancos e cremes, vidro azul que reflete o céu). À noite as janelas acendem aos poucos, prédio a prédio, e
// postes e passarelas brilham (setNight).
import * as THREE from 'three';
import { tex, facadeTextures } from './textures.js';
import { MESA } from '../data/planta.js';

export const M = {};
const litMats = []; // materiais com emissivo que variam com a noite
export let nightLevel = 0, nightExtra = 0;
// água dos lagos: mapa da altura do leito (o terreno preenche) e o tempo em segundos
export const AGUA = { tProf: { value: null }, aguaOn: { value: 0 }, aguaT: { value: 0 }, aguaP: { value: new THREE.Vector4(MESA.x0, MESA.z0, 1 / (MESA.x1 - MESA.x0), 1 / (MESA.z1 - MESA.z0)) },
  raso: { value: new THREE.Color(0x35aab0) }, fundo: { value: new THREE.Color(0x1f6f96) }, margem: { value: new THREE.Color(0xd6d2c4) }, // turquesa na margem, azul-ardósia no fundo, margem de pedra clara
  turvo: { value: 0 }, lodo: { value: new THREE.Color(0x7a7254) }, // lago assoreado (turvo 1): lodo pardo, mais escuro e fosco
  noite: { value: 0 } }; // à noite, as luzes da cidade tremulam refletidas perto das margens
const MACRO = { tMacro: { value: null } };
const LAMP = new THREE.Color(0xffd9a0), LAMP_DIA = new THREE.Color(0xd8d6ce), _lc = new THREE.Color();
// janelas: limiar de acendimento (setNight) de cada vão
const JANELAS = { uAcende: { value: -1 }, uVidroNoite: { value: 0 } };

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
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= 0.93 + 0.14 * texture2D( tMacro, vMacro / 23.0 ).r;');
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
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vAguaW; uniform sampler2D tProf; uniform float aguaOn; uniform float aguaT; uniform vec4 aguaP; uniform vec3 raso; uniform vec3 fundo; uniform vec3 margem; uniform float turvo; uniform vec3 lodo; uniform float noite; float dqAgua = 1.0;\nfloat hAgua( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }\nfloat nAgua( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( hAgua( i ), hAgua( i + vec2( 1, 0 ) ), f.x ), mix( hAgua( i + vec2( 0, 1 ) ), hAgua( i + vec2( 1, 1 ) ), f.x ), f.y ); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float tvAgua = 0.0;
        if ( aguaOn > 0.5 ) { vec2 tp = texture2D( tProf, ( vAguaW.xz - aguaP.xy ) * aguaP.zw ).rg; float dq = vAguaW.y - ( tp.r * 0.5 - 0.45 ); tvAgua = turvo * tp.g; dqAgua = dq;
          diffuseColor.rgb = mix( mix( mix( raso, fundo, smoothstep( 0.0, 0.2, dq ) ), lodo, tvAgua ), margem, 0.35 * ( 1.0 - smoothstep( 0.0, 0.03, dq ) ) ); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix( roughnessFactor, 0.5, tvAgua );')
      // brilhos do sol cintilando nas ondas (pontos que andam; o lago assoreado não brilha)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        { float cint = nAgua( vAguaW.xz * 6.0 + aguaT * vec2( 0.5, 0.25 ) ) * nAgua( vAguaW.xz * 9.5 - aguaT * vec2( 0.35, 0.55 ) );
          reflectedLight.directSpecular *= ( 0.45 + 2.2 * smoothstep( 0.4, 0.78, cint ) ) * ( 1.0 - tvAgua ); }`)
      // reflexo das janelas acesas: traços quentes que tremulam na água, mais fortes perto das margens
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if ( noite > 0.01 ) { // traços compridos na direção da câmera (vista padrão), tremulando devagar
          float tr = sin( vAguaW.x * 13.0 + sin( vAguaW.z * 2.3 + aguaT * 1.1 ) * 2.2 ) * ( 0.55 + 0.45 * sin( vAguaW.z * 4.1 - aguaT * 1.7 + vAguaW.x * 3.0 ) );
          float perto = 1.0 - smoothstep( 0.03, 0.2, dqAgua );
          totalEmissiveRadiance += vec3( 1.0, 0.55, 0.18 ) * noite * ( 1.0 - tvAgua ) * smoothstep( 0.72, 0.98, tr ) * perto * 0.55; }`)
      .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', `vec3 mapN = texture2D( normalMap, vNormalMapUv + aguaT * vec2( 0.012, 0.008 ) ).xyz * 2.0 - 1.0;
        vec3 mapN2 = texture2D( normalMap, vNormalMapUv * 1.73 + aguaT * vec2( -0.007, 0.011 ) ).xyz * 2.0 - 1.0;
        mapN = normalize( vec3( mapN.xy + mapN2.xy, mapN.z * mapN2.z ) );`);
  };
  mat.customProgramCacheKey = () => 'agua';
  return mat;
}
// Fachadas: cada vão acende num limiar próprio, com variação estável: 62% vem do "prédio" (célula de 3
// unidades do mundo) e 38% da janela (vão e andar no mapa da fachada; a grade de vãos vem de cada mapa). Com setNight subindo ao entardecer, a
// cidade acende aos poucos, prédio a prédio, sempre na mesma ordem; de manhã apaga na ordem inversa.
function comJanelas(mat, grade = [32, 4]) {
  const uGrade = { value: new THREE.Vector2(grade[0], grade[1]) };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAcende = JANELAS.uAcende; sh.uniforms.uVidroNoite = JANELAS.uVidroNoite; sh.uniforms.uJanGrade = uGrade;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vJanW;').replace('#include <project_vertex>', '#include <project_vertex>\n' + VPOS('vJanW'));
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vJanW; uniform float uAcende; uniform float uVidroNoite; uniform vec2 uJanGrade;\nfloat hJan( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }')
      // à noite o vidro (onde o emissivo marca janela) escurece: a sala acesa aparece amarela, não lilás
      .replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_EMISSIVEMAP
          diffuseColor.rgb *= 1.0 - uVidroNoite * smoothstep( 0.02, 0.12, dot( texture2D( emissiveMap, vEmissiveMapUv ).rgb, vec3( 0.333 ) ) );
        #endif`)
      // antes do mapa (e do que a obra soma depois dele): o limiar só escala a luz da janela
      .replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP
          { vec2 cel = floor( vJanW / 3.0 ); vec2 jan = floor( vEmissiveMapUv * uJanGrade );
            float lim = 0.62 * hJan( cel ) + 0.38 * hJan( jan + cel * 7.13 );
            totalEmissiveRadiance *= smoothstep( lim - 0.12, lim + 0.12, uAcende ); }
        #endif
        #include <emissivemap_fragment>`);
  };
  mat.customProgramCacheKey = () => 'janelas';
  return mat;
}
// modo: 'janelas' (acende vão a vão), 'noite' (acompanha a noite inteira) ou 'sempre'
function acesa(m, base, modo = 'noite') { m.userData.baseEmissive = base; m.userData.acesa = true; m.userData.modoLuz = modo; m.emissiveIntensity = base; litMats.push(m); return m; }

export function makeMaterials() {
  MACRO.tMacro.value = tex.macro();
  const conc = tex.concrete(); conc.repeat.set(2, 2);
  M.white = std({ color: 0xf7f5ef, roughness: 0.78, metalness: 0.0, map: conc });
  M.concreto = std({ color: 0xc4c0b6, roughness: 0.92, map: conc });
  M.whiteSmooth = std({ color: 0xf3f0e9, roughness: 0.42, metalness: 0.05 });
  M.fascia = std({ color: 0xf6f3ec, roughness: 0.5, metalness: 0.02 });
  // pacote "fiel à foto": beirais grossos de concreto claro das fitas, ripas de madeira escura dos brises,
  // painéis translúcidos leitosos (dossel da Biblioteca) e madeira laminada clara com veio (treliças, arcos)
  M.fasciaBeiral = std({ color: 0xf2eee6, roughness: 0.62, metalness: 0.0 });
  M.ripa = std({ color: 0x6b5a48, roughness: 0.8 });
  M.vidroLeitoso = std({ color: 0xdfe6ea, roughness: 0.6, metalness: 0.05, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
  M.madeiraClara = std({ color: 0xd9b47a, map: tex.veio(), roughness: 0.68 });
  // borda das passarelas: a mesma faixa branca, com uma fita de luz que acende à noite
  M.fasciaLuz = acesa(std({ color: 0xf6f3ec, roughness: 0.5, metalness: 0.02, emissive: 0xffc47a, emissiveIntensity: 0 }), 1.5);
  M.cream = std({ color: 0xf1e7d3, roughness: 0.8 });
  M.grey = std({ color: 0xa9b0ba, roughness: 0.7 });
  M.dark = std({ color: 0x3a4250, roughness: 0.75 });
  M.steel = std({ color: 0xd2d7de, roughness: 0.32, metalness: 0.75 });
  M.steelDark = std({ color: 0x75808e, roughness: 0.4, metalness: 0.7 });
  M.roofMetal = std({ color: 0x9aa2aa, roughness: 0.45, metalness: 0.6 });
  M.bandaCinza = std({ color: 0xa3b09f, roughness: 0.7 }); // tampo sálvia clara da Ciências
  M.concretoClaro = std({ color: 0xe3dccb, roughness: 0.9 }); // muros de pedra clara, muro do pátio do CRD, margens das lagoas
  M.terracota = std({ color: 0xe0906e, roughness: 0.9 }); // pátios da Escola (salmão da foto, na paleta do BuildIt)
  M.caminhoTeto = std({ color: 0xe0d8c6, roughness: 0.8 });
  M.roof = comMacro(std({ color: 0xffffff, map: tex.roof(), normalMap: tex.roofNormal(), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.95 }));
  M.planter = comMacro(std({ color: 0x4a8432, roughness: 0.95 }));
  M.lawn = comMacro(std({ color: 0xc2d890, map: tex.grass(), roughness: 0.95 }));
  M.grassBright = comMacro(std({ color: 0xd4e89a, map: tex.grass(), roughness: 0.95 }));
  // campo: vence a placa de terra da terraplenagem logo abaixo (que tem desvio de profundidade contra o terreno)
  M.field = std({ color: 0xffffff, map: tex.field(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
  M.track = std({ color: 0xffffff, map: tex.track(), roughness: 0.9 });
  M.pavers = std({ color: 0xffffff, map: tex.pavers(), roughness: 0.86 });
  M.sand = std({ color: 0xffffff, map: tex.sand(), roughness: 1 });
  M.soil = std({ color: 0xffffff, map: tex.soil(), roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }); // placa de terra provisória vence o terreno logo abaixo
  M.rock = std({ color: 0xa89c88, map: tex.rock(), roughness: 0.95 });
  M.wood = std({ color: 0xffffff, map: tex.wood(), roughness: 0.72 });
  M.woodLight = std({ color: 0xffffff, map: tex.woodLight(), roughness: 0.6 });
  M.woodFrame = std({ color: 0xcfad84, map: tex.veio(), roughness: 0.7 });
  M.lattice = comGrade(std({ color: 0xffffff, map: tex.lattice(), alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.6 }));
  const cg = tex.canopyGrid();
  M.canopyGrid = comGrade(std({ color: 0xffffff, map: cg, alphaTest: 0.3, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.55, emissive: 0x3a2a14, emissiveMap: cg, emissiveIntensity: 0.25 }));
  M.mesh = comGrade(std({ color: 0xffffff, map: tex.mesh(), alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.4 }));
  // vidro azul que reflete o céu
  M.glass = std({ color: 0x9ad6f6, roughness: 0.06, metalness: 0.25, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
  // vidraçaria espelhada (células da Ciências): opaca, refletindo o céu do envMap
  M.vidroEspelhado = std({ color: 0xa9c4d6, metalness: 0.9, roughness: 0.08, envMapIntensity: 1.7 });
  M.glassDome = std({ color: 0xd6eef8, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.0 });
  M.glassRail = std({ color: 0xcfe9f5, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2 });
  M.glassWarm = std({ color: 0xffe2b0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false, emissive: 0xffb45a, emissiveIntensity: 0.6, side: THREE.DoubleSide });
  M.vidroDossel = std({ color: 0xd8e6ee, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const wn = tex.waterNormal(); wn.repeat.set(6, 6);
  // lagos opacos: o leito não aparece, a profundidade vem do mapa do leito; as ondas andam no shader
  // (cópia do mapa de normais, com a mesma imagem), enquanto espelhos d'água e aquário andam pelo offset
  M.water = comAgua(std({ color: 0x40605f, roughness: 0.16, metalness: 0.05, normalMap: wn.clone(), normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.6 }));
  // aquário do Bioma: continua translúcido (a fauna nada dentro do volume de água)
  M.waterDeep = std({ color: 0x2294c0, roughness: 0.05, metalness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.25, 0.25), transparent: true, opacity: 0.82, emissive: 0x0d6788, emissiveIntensity: 0.08, envMapIntensity: 1.3 });
  M.pool = std({ color: 0x2699b2, roughness: 0.3, metalness: 0.05, normalMap: wn, normalScale: new THREE.Vector2(0.12, 0.12), envMapIntensity: 1.0 }); // espelhos d'água turquesa, mais escuros que o céu que refletem
  M.yellow = std({ color: 0xf8c83a, roughness: 0.5 });
  M.orange = std({ color: 0xf28a3a, roughness: 0.5 });
  M.red = std({ color: 0xe2543f, roughness: 0.55 });
  M.blue = std({ color: 0x3f88e2, roughness: 0.5 });
  M.teal = std({ color: 0x2ab8a8, roughness: 0.5 });
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
  // fachadas: de dia, vidro azul refletindo o céu com caixilhos brancos; à noite a luz âmbar vem do emissivo,
  // janela a janela
  // ('celular' = parede de células da arena do Campus, 'ambar' = faixas creme e vidro âmbar do Santuário,
  // 'colmeia' = xadrez creme e bronze com células turquesa da Biblioteca)
  const baseFac = { quente: 0.9, lab: 0.8, escuro: 0.5, madeira: 0.95, fita: 0.9, celular: 0.9, ambar: 0.9, colmeia: 0.7 };
  for (const s of ['quente', 'lab', 'escuro', 'madeira', 'fita', 'celular', 'ambar', 'colmeia']) {
    const f = facadeTextures(s);
    M['fac_' + s] = acesa(comJanelas(std({ color: 0xffffff, map: f.map, emissive: 0xffffff, emissiveMap: f.emissive, roughness: 0.22, metalness: 0.15, envMapIntensity: 1.0 }), f.grade || [f.bays, f.floors]), baseFac[s], 'janelas');
  }
  acesa(M.glassWarm, 0.6);
  acesa(M.waterDeep, 0.08, 'sempre');
  setNight(nightLevel, nightExtra);
  return M;
}
// n: 0 (dia) a 1 (noite): limiar das janelas (vão a vão), vidro quente, fitas das passarelas e postes;
// extra: reforço noturno das fachadas e das luminárias
export function setNight(n, extra = 0) {
  nightLevel = n; nightExtra = extra;
  JANELAS.uAcende.value = n * 1.3 - 0.15; JANELAS.uVidroNoite.value = 0.7 * Math.min(1, n * 1.4);
  for (const m of litMats) { const b = m.userData.baseEmissive || 1, modo = m.userData.modoLuz; m.emissiveIntensity = modo === 'sempre' ? b : modo === 'janelas' ? b * (1 + extra) : b * n * (1 + extra); }
  if (M.lampGlow) M.lampGlow.color.copy(LAMP_DIA).lerp(_lc.copy(LAMP).multiplyScalar(3.2 + 2.8 * extra), Math.min(1, n * 1.6));
}
// copia os ganchos de shader de um material para o clone (clone() não copia onBeforeCompile)
function ganchos(de, para) { if (Object.prototype.hasOwnProperty.call(de, 'onBeforeCompile')) para.onBeforeCompile = de.onBeforeCompile; if (Object.prototype.hasOwnProperty.call(de, 'customProgramCacheKey')) para.customProgramCacheKey = de.customProgramCacheKey; return para; }
// versão dupla-face (cache) de um material
const _dupla = new Map();
export function dupla(m) { if (m.side === THREE.DoubleSide) return m; if (!_dupla.has(m)) { const c = ganchos(m, m.clone()); c.side = THREE.DoubleSide; if (m.userData.baseEmissive) { c.userData.baseEmissive = m.userData.baseEmissive; c.userData.modoLuz = m.userData.modoLuz; litMats.push(c); c.emissiveIntensity = m.emissiveIntensity; } _dupla.set(m, c); } return _dupla.get(m); }
// clona um material para uso com plano de corte (obra subindo)
export function clipped(mat, planes) {
  const m = ganchos(mat, mat.clone()); m.clippingPlanes = planes; m.clipShadows = true; return m;
}
