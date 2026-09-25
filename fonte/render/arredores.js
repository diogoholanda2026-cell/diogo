// Arredores no estilo do SimCity BuildIt: a obra não flutua mais numa mesa no escuro. O terreno continua além
// da planta (até ~10 vezes a largura dela para cada lado, com a borda fundida no chão da obra), com a mata em
// volta (instâncias com nível de detalhe por célula), campos em retalhos com sebes, morros atrás da obra e
// serras ao longe (que a neblina azula), uma praia com coqueiros a oeste (à esquerda na vista padrão e na da
// foto) com mar turquesa → azul, ondas e espuma branca na areia, alguns barcos e nuvens de algodão.
// Orçamento medido: ~12 chamadas e ~64 mil triângulos na vista geral e na do canteiro.
import * as THREE from 'three';
import { MESA } from '../data/planta.js';
import { hash, fbm, clamp, rng } from '../core/util.js';
import { tex } from './textures.js';
import { treeGroup } from './forest.js';
import { comTomDoCeu } from './hao.js';

export const MAR_Y = -0.25;                  // nível do mar (a água dos lagos da obra fica em -0,1)
// linha da costa (oeste): x da água em função de z; a baía se fecha longe da obra, atrás e à frente
export const costaX = (z) => -43 + 0.0007 * z * z + 1.8 * Math.sin(z * 0.07 + 0.5) + 1.0 * Math.sin(z * 0.17 + 2.1);
const GLSL_COSTA = 'float costaX( float z ) { return -43.0 + 0.0007 * z * z + 1.8 * sin( z * 0.07 + 0.5 ) + 1.0 * sin( z * 0.17 + 2.1 ); }';
const CX = (MESA.x0 + MESA.x1) / 2, CZ = (MESA.z0 + MESA.z1) / 2, HX = (MESA.x1 - MESA.x0) / 2, HZ = (MESA.z1 - MESA.z0) / 2;
const EXT = 640;                             // meia largura do terreno (além do plano distante da câmera: sem borda visível)
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// distância até o retângulo da planta (0 dentro e na borda)
export const distPlanta = (x, z) => Math.hypot(Math.max(Math.abs(x - CX) - HX, 0), Math.max(Math.abs(z - CZ) - HZ, 0));
// faixa de mata em volta da planta (largura por lado: oeste até as dunas, atrás mais larga)
const FAIXA = { oeste: 6, leste: 7, fundo: 9, frente: 6 };
const naFaixa = (x, z) => {
  if (distPlanta(x, z) <= 0.05) return false;
  const dx = x < MESA.x0 ? MESA.x0 - x : x > MESA.x1 ? x - MESA.x1 : 0, dz = z < MESA.z0 ? MESA.z0 - z : z > MESA.z1 ? z - MESA.z1 : 0;
  const lx = x < CX ? FAIXA.oeste : FAIXA.leste, lz = z < CZ ? FAIXA.fundo : FAIXA.frente;
  const k = Math.max(dx / lx, dz / lz); return k < 1 + (fbm(x, z, 9, 707, 2) - 0.5) * 0.5;
};
// posição relativa dentro da faixa (0 na borda da planta, 1 na orla de fora)
const borda = (x, z) => { const dx = x < MESA.x0 ? MESA.x0 - x : x > MESA.x1 ? x - MESA.x1 : 0, dz = z < MESA.z0 ? MESA.z0 - z : z > MESA.z1 ? z - MESA.z1 : 0; return Math.max(dx / (x < CX ? FAIXA.oeste : FAIXA.leste), dz / (z < CZ ? FAIXA.fundo : FAIXA.frente)); };
// mancha de mata longe da obra (morros e bosques)
const mataLonge = (x, z) => sm(0.5, 0.62, fbm(x * 0.02 + 3.1, z * 0.02 - 1.7, 1, 717, 3));

// Altura do terreno (a planta é o retângulo MESA; nas bordas a altura é 0, igual ao chão da obra)
export function alturaArredor(x, z) {
  const d = distPlanta(x, z); const c = x - costaX(z);
  if (c < 0) return MAR_Y - 0.08 - Math.min(9, -c * 0.5);          // fundo do mar
  // morros: ondulação que cresce com a distância; atrás da obra, morros mais altos (o alto da vista da foto)
  const k = sm(3.5, 28, d) * sm(6, 26, c);
  let h = (fbm(x * 0.022, z * 0.022, 1, 727, 4) - 0.42) * 7 * k;
  h += Math.max(0, fbm(x * 0.03 + 5, z * 0.03, 1, 737, 3) - 0.3) * 22 * sm(-24, -58, z) * k;
  // serras ao longe (fundo e leste), cristas pelo ruído
  const serra = Math.max(sm(-120, -230, z), sm(150, 260, x) * 0.8) * sm(10, 40, c);
  if (serra > 0) { const r = 1 - Math.abs(fbm(x * 0.011, z * 0.011, 1, 747, 4) * 2 - 1); h += serra * (18 + 52 * r * r); }
  h = Math.max(h, -0.1 * k);
  // praia: sobe do nível do mar a +0,15 em 4 unidades e encontra o chão
  const praia = MAR_Y + Math.min(c, 4) * 0.1;
  return c < 9 ? praia + (Math.max(praia, h) - praia) * sm(3, 9, c) : h;
}

// ---------------------------------------------------------------- terreno
// Grade com espaçamento que cresce para longe da planta (fina perto da borda, grossa na neblina) e um furo no
// retângulo da planta. Cor de vértice = chão (grama, areia, rocha); máscaras em aTipo: campos (x) e mata (y).
function eixos(a0, a1) { // posições de a0 (borda negativa da planta) para fora e de a1 para fora, e o miolo
  const fora = []; let p = 0, dp = 1.0; while (p < EXT) { p += dp; fora.push(Math.min(p, EXT + 1)); if (p > 12) dp *= 1.16; }
  const miolo = []; const n = Math.round((a1 - a0) / 2); for (let i = 0; i <= n; i++) miolo.push(a0 + ((a1 - a0) * i) / n);
  return [...fora.map((q) => a0 - q).reverse(), ...miolo, ...fora.map((q) => a1 + q)];
}
const COR = { grama: [0.2, 0.3, 0.058], duna: [0.38, 0.45, 0.13], areia: [0.86, 0.72, 0.42], molhada: [0.62, 0.52, 0.33], rocha: [0.34, 0.34, 0.3], serra: [0.1, 0.24, 0.07] }; // albedo linear
function terreno() {
  const xs = eixos(MESA.x0, MESA.x1), zs = eixos(MESA.z0, MESA.z1); const nx = xs.length, nz = zs.length;
  const P = new Float32Array(nx * nz * 3), C = new Float32Array(nx * nz * 3), T = new Float32Array(nx * nz * 2);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = xs[i], z = zs[j], k = j * nx + i, h = alturaArredor(x, z), c = x - costaX(z), d = distPlanta(x, z);
    P[k * 3] = x; P[k * 3 + 1] = h; P[k * 3 + 2] = z;
    // cor do chão: areia da praia, dunas com capim, grama; rocha no alto das serras
    let col = COR.grama; const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    col = mix(COR.duna, col, sm(5.5, 8, c)); col = mix(COR.areia, col, sm(3.2, 4.6, c)); col = mix(COR.molhada, col, sm(0.2, 1.1, c));
    col = mix(col, COR.serra, sm(8, 22, h)); col = mix(col, COR.rocha, sm(34, 56, h) * 0.8);
    const v = 0.93 + 0.14 * hash(i, j, 757); C[k * 3] = col[0] * v; C[k * 3 + 1] = col[1] * v; C[k * 3 + 2] = col[2] * v;
    // máscaras: mata (faixa em volta da obra, manchas e encostas) e campos (planície longe da obra e da praia)
    const faixa = d < 0.1 || naFaixa(x, z) ? 1 : 0;
    const mata = c < 7 ? 0 : Math.max(faixa, mataLonge(x, z) * sm(8, 16, d), sm(6, 16, h) * 0.9);
    const campo = (1 - mata) * sm(14, 22, d) * sm(12, 18, c) * (1 - sm(4, 10, h)) * sm(0.35, 0.45, fbm(x * 0.012, z * 0.012, 1, 767, 2));
    T[k * 2] = campo; T[k * 2 + 1] = mata;
  }
  const I = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const x0 = xs[i], x1 = xs[i + 1], z0 = zs[j], z1 = zs[j + 1];
    if (x0 >= MESA.x0 - 1e-6 && x1 <= MESA.x1 + 1e-6 && z0 >= MESA.z0 - 1e-6 && z1 <= MESA.z1 + 1e-6) continue; // furo da planta
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; I.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('aTipo', new THREE.BufferAttribute(T, 2));
  g.setIndex(nx * nz > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1)); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
// material do terreno: retalhos de campos com sebes (bordas nítidas a qualquer distância) e copas da mata com
// relevo, sobre a cor de vértice; grão fino de perto
function materialTerreno() {
  const copas = tex.copas(), copasN = tex.copasN();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tCopas = { value: copas }; sh.uniforms.tCopasN = { value: copasN }; comTomDoCeu(sh, 'vTerW');
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aTipo; varying vec2 vTipo; varying vec3 vTerW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vTipo = aTipo; vTerW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vTipo; varying vec3 vTerW; uniform sampler2D tCopas; uniform sampler2D tCopasN;
      float hT( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if ( vTipo.x > 0.01 ) { // campos: grade girada, cor por retalho, fileiras em alguns e sebe escura nas bordas
          vec2 q = mat2( 0.94, -0.34, 0.34, 0.94 ) * vTerW.xz; vec2 tam = vec2( 21.0, 14.0 ); vec2 cel = floor( q / tam ); vec2 f = fract( q / tam );
          float id = hT( cel ); vec3 cor = id < 0.3 ? vec3( 0.2, 0.32, 0.06 ) : id < 0.55 ? vec3( 0.28, 0.36, 0.07 ) : id < 0.8 ? vec3( 0.42, 0.42, 0.1 ) : vec3( 0.55, 0.42, 0.12 );
          cor *= id > 0.5 ? 0.93 + 0.07 * step( 0.5, fract( q.x * 0.8 ) ) : 1.0;
          float borda = min( min( f.x, 1.0 - f.x ) * tam.x, min( f.y, 1.0 - f.y ) * tam.y );
          cor = mix( cor, vec3( 0.06, 0.16, 0.035 ), ( 1.0 - smoothstep( 0.3, 0.75, borda ) ) * 0.85 );
          diffuseColor.rgb = mix( diffuseColor.rgb, cor, vTipo.x );
        }
        float mataK = vTipo.y;
        if ( mataK > 0.01 ) diffuseColor.rgb = mix( diffuseColor.rgb, texture2D( tCopas, vTerW.xz / 16.0 ).rgb, mataK );
        diffuseColor.rgb *= 0.95 + 0.1 * hT( floor( vTerW.xz * 3.0 ) );`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if ( mataK > 0.01 ) { vec3 nc = texture2D( tCopasN, vTerW.xz / 16.0 ).xyz * 2.0 - 1.0; // relevo das copas: u → +x, v → +z
          vec3 nw = ( vec4( normal, 0.0 ) * viewMatrix ).xyz; nw = normalize( nw + vec3( nc.x, 0.0, nc.y ) * 0.9 * mataK );
          normal = normalize( ( viewMatrix * vec4( nw, 0.0 ) ).xyz ); }`);
  };
  m.customProgramCacheKey = () => 'arredores-chao';
  m.userData.semHAO = true;
  return m;
}

// ---------------------------------------------------------------- mar
// Faixa de água presa à costa (de 3 unidades terra adentro até o horizonte): turquesa no raso, azul no fundo,
// espuma na linha da areia que vai e volta, faixas de onda andando para a praia e duas camadas de ondinhas
function mar() {
  const cols = [3, 1.5, 0, -1, -2.2, -3.6, -5.5, -8, -12, -18, -27, -40, -60, -90, -140, -220, -340, -520, -760];
  const zs = []; for (let z = -EXT; z <= EXT + 1e-6;) { zs.push(z); const a = Math.abs(z); z += a < 90 ? 3 : a < 200 ? 10 : 40; }
  const P = [], UV = [], I = []; const nc = cols.length;
  for (const z of zs) { const cx = costaX(z); for (const o of cols) { P.push(cx + o, MAR_Y, z); UV.push((cx + o) * 0.11, z * 0.11); } } // UV = mundo (o referencial do mapa de normais)
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < nc - 1; i++) { const a = j * nc + i, b = a + 1, c = a + nc, d = c + 1; I.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
  const wn = tex.waterNormal();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.0, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.5 });
  const U = { marT: { value: 0 }, raso: { value: new THREE.Color(0x2ec4bc) }, meio: { value: new THREE.Color(0x1692ba) }, fundo: { value: new THREE.Color(0x0d5c9e) }, espuma: { value: new THREE.Color(0xffffff) } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U); comTomDoCeu(sh, 'vMarW');
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMarW;').replace('#include <project_vertex>', '#include <project_vertex>\n  vMarW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vMarW; uniform float marT; uniform vec3 raso; uniform vec3 meio; uniform vec3 fundo; uniform vec3 espuma;
      ${GLSL_COSTA}
      float hM( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
      float nM( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( hM( i ), hM( i + vec2( 1, 0 ) ), f.x ), mix( hM( i + vec2( 0, 1 ) ), hM( i + vec2( 1, 1 ) ), f.x ), f.y ); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float cM = costaX( vMarW.z ) - vMarW.x;                     // distância da costa, mar adentro
        vec3 agua = mix( raso, meio, smoothstep( 0.5, 9.0, cM ) ); agua = mix( agua, fundo, smoothstep( 12.0, 70.0, cM ) );
        float ruido = nM( vMarW.xz * 0.35 + marT * 0.05 );
        float vai = 0.45 + 0.35 * sin( marT * 0.9 + vMarW.z * 0.15 ) + 0.25 * ruido;       // a espuma da areia vai e volta
        float esp = 1.0 - smoothstep( vai - 0.1, vai + 0.35, cM );
        float faixa = smoothstep( 0.82, 0.97, sin( cM * 1.25 - marT * 1.6 + ruido * 2.5 ) ) * ( 1.0 - smoothstep( 1.0, 7.0, cM ) ) * step( 0.9, cM ); // ondas chegando
        float espK = clamp( esp + faixa * 0.7, 0.0, 1.0 );
        diffuseColor.rgb = mix( agua, espuma, espK );`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix( roughnessFactor, 0.85, espK );')
      // brilho do sol na água: cintila em pontos que andam com as ondas, sem virar um clarão
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        { float cint = nM( vMarW.xz * 2.7 + marT * vec2( 0.55, 0.2 ) ) * nM( vMarW.xz * 4.3 - marT * vec2( 0.3, 0.5 ) );
          reflectedLight.directSpecular *= 0.16 + 2.6 * smoothstep( 0.42, 0.8, cint ); }`)
      .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', `vec3 mapN = texture2D( normalMap, vMarW.xz * 0.11 + marT * vec2( 0.012, 0.008 ) ).xyz * 2.0 - 1.0;
        vec3 mapN2 = texture2D( normalMap, vMarW.xz * 0.043 + marT * vec2( -0.006, 0.01 ) ).xyz * 2.0 - 1.0;
        mapN = normalize( vec3( ( mapN.xy + mapN2.xy ) * ( 1.0 - espK ), mapN.z * mapN2.z ) );`);
  };
  m.customProgramCacheKey = () => 'arredores-mar';
  m.userData.semHAO = true;
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.name = 'mar'; mesh.userData.U = U;
  return mesh;
}

// ---------------------------------------------------------------- nuvens
// quadros virados para a câmera (no shader), com a cor do céu da hora e a neblina da cena
const NUV_V = /* glsl */`
  attribute vec4 aNuvem; // x, z, tamanho, fase
  uniform float nuvT; varying vec2 vUv; varying float vFogDepth; varying float vSome;
  #include <common>
  void main() {
    // anda devagar para leste e, a cada 80 unidades, volta ao começo (some e reaparece nas pontas)
    float m = mod( nuvT * 0.6 + aNuvem.w * 80.0, 80.0 ); vSome = smoothstep( 0.0, 10.0, m ) * ( 1.0 - smoothstep( 70.0, 80.0, m ) );
    vUv = uv; vec3 c = vec3( aNuvem.x + m - 40.0, instanceMatrix[3][1], aNuvem.y );
    vec4 mv = viewMatrix * vec4( c, 1.0 ); mv.xy += position.xy * vec2( aNuvem.z, aNuvem.z * 0.55 );
    gl_Position = projectionMatrix * mv; vFogDepth = -mv.z;
  }`;
const NUV_F = /* glsl */`
  uniform sampler2D tNuvem; uniform vec3 corLuz; uniform vec3 corSombra; uniform float opac;
  uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
  varying vec2 vUv; varying float vFogDepth; varying float vSome;
  void main() {
    vec4 t = texture2D( tNuvem, vUv ); if ( t.a * vSome < 0.02 ) discard;
    vec3 col = mix( corSombra, corLuz, clamp( t.r / max( t.a, 0.05 ), 0.0, 1.0 ) );
    col = mix( col, fogColor, smoothstep( fogNear, fogFar, vFogDepth ) * 0.8 );
    gl_FragColor = vec4( col, t.a * opac * vSome );
  }`;
function nuvens() {
  const R = rng(9091); const lista = [];
  // anel largo em volta da obra, baixo o bastante para aparecer nas bordas da vista (fora da planta, nunca entre a
  // câmera e a obra nas vistas de cima)
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + R() * 0.4, r = 72 + R() * 55; lista.push([Math.cos(a) * r * 1.2, Math.sin(a) * r, 12 + R() * 9, 26 + R() * 22, R()]); }
  const g = new THREE.PlaneGeometry(1, 1); g.userData.compartilhada = true;
  const mat = new THREE.ShaderMaterial({ vertexShader: NUV_V, fragmentShader: NUV_F, transparent: true, depthWrite: false, fog: false,
    uniforms: { tNuvem: { value: tex.nuvem() }, nuvT: { value: 0 }, corLuz: { value: new THREE.Color(1, 1, 1) }, corSombra: { value: new THREE.Color(0.75, 0.8, 0.9) }, opac: { value: 0.92 },
      fogColor: { value: new THREE.Color() }, fogNear: { value: 100 }, fogFar: { value: 500 } } });
  const im = new THREE.InstancedMesh(g, mat, lista.length); const a = new Float32Array(lista.length * 4); const m4 = new THREE.Matrix4();
  lista.forEach(([x, z, y, s, f], i) => { im.setMatrixAt(i, m4.makeTranslation(0, y, 0)); a.set([x, z, s, f], i * 4); });
  g.setAttribute('aNuvem', new THREE.InstancedBufferAttribute(a, 4)); im.frustumCulled = false; im.renderOrder = 5; im.name = 'nuvens'; im.userData.semHAO = true;
  return im;
}

// ---------------------------------------------------------------- barcos
// veleiros e lanchas ao largo (uma malha instanciada, cores por vértice), balançando devagar
function barcos() {
  const partes = [];
  const casco = new THREE.BoxGeometry(1.6, 0.28, 0.55); casco.translate(0, 0.08, 0); pinta(casco, [0.95, 0.95, 0.96]); partes.push(casco);
  const faixa = new THREE.BoxGeometry(1.62, 0.07, 0.57); faixa.translate(0, 0.0, 0); pinta(faixa, [0.1, 0.35, 0.75]); partes.push(faixa);
  const vela = new THREE.BufferGeometry(); vela.setAttribute('position', new THREE.Float32BufferAttribute([0.1, 0.25, 0, 0.1, 2.2, 0, -0.75, 0.3, 0, 0.1, 0.25, 0, -0.75, 0.3, 0, 0.1, 2.2, 0], 3)); vela.computeVertexNormals(); pinta(vela, [1, 0.98, 0.94]); partes.push(vela);
  const mastro = new THREE.CylinderGeometry(0.03, 0.03, 2.1, 4); mastro.translate(0.1, 1.2, 0); pinta(mastro, [0.6, 0.6, 0.62]); partes.push(mastro);
  const geo = juntar(partes);
  const R = rng(5150); const pos = [];
  for (let i = 0; i < 7; i++) { const z = -70 + R() * 130, off = 12 + R() * 40; pos.push([costaX(z) - off, z, R() * 6.28, 0.8 + R() * 0.5]); }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }); mat.userData.semHAO = true;
  const im = new THREE.InstancedMesh(geo, mat, pos.length); im.castShadow = false; im.receiveShadow = true; im.name = 'barcos'; im.userData.pos = pos;
  return im;
}
function pinta(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.index) { const ng = g.toNonIndexed(); g.copy(ng); } return g; }
function juntar(lista) {
  let n = 0; for (const g of lista) n += g.attributes.position.count; const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
  for (const g of lista) { if (!g.attributes.normal) g.computeVertexNormals(); P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.computeBoundingSphere(); return g;
}

// ---------------------------------------------------------------- árvores
// Faixa de mata em volta da obra (um bloco por lado, para o descarte por visão, com nível de detalhe por
// célula), coqueiros nas dunas e bosques soltos nos campos
function arvoresFaixa() {
  const R = rng(6161); const lados = [[], [], [], []]; const passo = 0.8;
  const x0 = MESA.x0 - FAIXA.oeste - 3, x1 = MESA.x1 + FAIXA.leste + 3, z0 = MESA.z0 - FAIXA.fundo - 3, z1 = MESA.z1 + FAIXA.frente + 3;
  for (let z = z0; z < z1; z += passo) for (let x = x0; x < x1; x += passo) {
    const jx = x + (R() - 0.5) * passo * 0.9, jz = z + (R() - 0.5) * passo * 0.9; const d = distPlanta(jx, jz);
    if (d < 0.15 || !naFaixa(jx, jz) || jx - costaX(jz) < 7.5) continue;
    const dens = fbm(jx, jz, 6, 21, 3); if (dens < 0.3 && R() < 0.5) continue;
    if (R() < sm(0.6, 1.25, borda(jx, jz))) continue; // a mata rareia na orla de fora
    const s = (0.5 + dens * 0.3 + R() * 0.12) * (0.85 + 0.15 * sm(0, 3, d));
    const t = { x: jx, z: jz, y: alturaArredor(jx, jz), s, kind: 'folha', pal: R() < 0.012 ? 'outono' : 'mata', h: 0.9 + R() * 0.35, orla: d > 4 ? 0.5 : 3 };
    lados[jx < MESA.x0 ? 0 : jx > MESA.x1 ? 2 : jz < MESA.z0 ? 1 : 3].push(t);
  }
  return lados;
}
function coqueiros() {
  const R = rng(7171); const l = [];
  for (let z = -46; z < 46; z += 1.4) { if (R() < 0.35) continue; const c = 4.4 + R() * 2.2, x = costaX(z) + c; l.push({ x, z: z + (R() - 0.5) * 0.8, y: alturaArredor(x, z), s: 0.55 + R() * 0.3, h: 0.85 + R() * 0.4, kind: 'palmeira', pal: 'jardim', rot: R() * 6.28 }); }
  return treeGroup(l, { name: 'coqueiros', cast: false });
}
function bosques() {
  const R = rng(8181); const l = [];
  for (let i = 0; i < 1400 && l.length < 520; i++) {
    const x = -150 + R() * 300, z = -120 + R() * 190; const d = distPlanta(x, z), c = x - costaX(z);
    if (d < 11 || c < 10 || naFaixa(x, z)) continue;
    const g = fbm(x * 0.05, z * 0.05, 1, 818, 2); if (g < 0.56) continue; // bosques em grupos
    const h = alturaArredor(x, z); if (h > 20) continue;
    l.push({ x, z, y: h, s: 0.7 + R() * 0.5, kind: 'folhaLow', pal: R() < 0.1 ? 'savana' : 'mata', h: 1 });
  }
  return treeGroup(l, { name: 'bosques', cast: false });
}

export class Arredores {
  constructor(engine, forest) {
    this.e = engine; this.forest = forest; this.group = new THREE.Group(); this.group.name = 'arredores'; engine.scene.add(this.group);
    this.chao = new THREE.Mesh(terreno(), materialTerreno()); this.chao.receiveShadow = true; this.chao.name = 'chao-arredores'; this.group.add(this.chao);
    this.mar = mar(); this.group.add(this.mar);
    this.nuvens = nuvens(); this.group.add(this.nuvens);
    this.barcos = barcos(); this.group.add(this.barcos);
    this.coqueiros = coqueiros(); this.group.add(this.coqueiros);
    this.bosques = bosques(); this.group.add(this.bosques);
    forest.arredores(arvoresFaixa());
    this._m4 = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this._barcos(0);
  }
  mostrar(on) { this.group.visible = on; this.forest.mostrarArredores(on); }
  _barcos(t) {
    const im = this.barcos, pos = im.userData.pos; // (laço simples: nada alocado por quadro)
    for (let i = 0; i < pos.length; i++) {
      const b = pos[i], f = t * 0.6 + i * 1.7; this._e.set(Math.sin(f) * 0.04, b[2] + Math.sin(f * 0.3) * 0.05, Math.cos(f * 1.3) * 0.05); this._q.setFromEuler(this._e);
      this._p.set(b[0], MAR_Y + Math.sin(f * 1.1) * 0.03, b[1]); this._s.setScalar(b[3]); im.setMatrixAt(i, this._m4.compose(this._p, this._q, this._s));
    }
    im.instanceMatrix.needsUpdate = true;
  }
  // tempo do mar, nuvens com a cor do céu da hora (env.cores) e barcos balançando (a cada 2 quadros)
  update(t, env) {
    if (!this.group.visible) return;
    const s = t / 1000; this.mar.userData.U.marT.value = s;
    const U = this.nuvens.material.uniforms; U.nuvT.value = s; const f = this.e.scene.fog;
    if (env?.cores) { U.corLuz.value.copy(env.cores.nuvem); U.corSombra.value.copy(env.cores.nuvemSombra); }
    if (f) { U.fogColor.value.copy(f.color); U.fogNear.value = f.near; U.fogFar.value = f.far; }
    if ((this._q2 = (this._q2 || 0) + 1) % 2 === 0) this._barcos(s);
  }
}
