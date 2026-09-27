// Fantasma do plano (D26): as partes que ainda não foram construídas aparecem com a silhueta LOD1 de verdade, em
// holograma champanhe: borda acesa pelo ângulo (Fresnel), linhas finas de andar e de montante, quase transparente no
// miolo. Uma chamada para o plano inteiro (vidro e opaco das partes fundidos numa malha só). Sem sombra própria.
import * as THREE from 'three';
import { geometriaDe, Malha } from './torre.js';

const VERT = /* glsl */ `
attribute vec2 aUvM;
varying vec2 vUvM;
varying vec3 vN;
varying vec3 vV;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vUvM = aUvM;
  vec4 mp = modelMatrix * vec4( position, 1.0 );
  vGPosMundo = mp.xyz;
  vN = normalize( mat3( modelMatrix ) * normal );
  vV = cameraPosition - mp.xyz;
  gl_Position = projectionMatrix * viewMatrix * mp;
  #include <logdepthbuf_vertex>
}
`;

const FRAG = /* glsl */ `
uniform vec3 uCor;
uniform float uForca;
uniform float uNoiteF;
varying vec2 vUvM;
varying vec3 vN;
varying vec3 vV;
#include <common>
#include <logdepthbuf_pars_fragment>
float gLinhaF( float x, float w ) {
  float fw = max( fwidth( x ), 1e-4 );
  float d = abs( fract( x + 0.5 ) - 0.5 );
  return ( 1.0 - smoothstep( w * 0.5 - fw, w * 0.5 + fw, d ) ) * ( 1.0 - smoothstep( 0.2, 0.5, fw ) );
}
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize( vN );
  vec3 v = normalize( vV );
  float fr = pow( 1.0 - abs( dot( n, v ) ), 2.2 );
  float linhas = max( gLinhaF( vUvM.y / 4.2, 0.05 ), gLinhaF( vUvM.x / 6.0, 0.04 ) ) * step( abs( n.y ), 0.7 );
  float a = ( 0.05 + 0.55 * fr + 0.35 * linhas ) * uForca;
  // à noite a exposição sobe até 8 (R1a): o holograma baixa a luz para não estourar
  vec3 c = uCor * ( 0.6 + 0.8 * fr + 1.2 * linhas ) * mix( 1.0, 0.3, uNoiteF );
  gl_FragColor = vec4( c, clamp( a, 0.0, 0.85 ) );
  G_FIM
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Material do holograma (transparente, sem gravar profundidade, com a neblina dos ganchos). */
export function materialFantasma(ganchos, { cor = '#e6c996', forca = 1 } = {}) {
  const t = ganchos.trechos(['neblina']);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...ganchos.uniformes, uCor: { value: new THREE.Color(cor) }, uForca: { value: forca }, uNoiteF: { value: 0 } },
    defines: t.defines,
    vertexShader: VERT.replace('#include <common>', `#include <common>\n${t.verticePars}`),
    fragmentShader: FRAG.replace('#include <common>', `#include <common>\n${t.fragmentoPars}`).replace('G_FIM', t.fim),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
  mat.name = 'arcologia:fantasma';
  return mat;
}

/** Junta malhas (vidro e opaco das partes) numa só para o fantasma. */
export function malhaFantasma(...malhas) {
  const m = new Malha('fantasma');
  for (const x of malhas) if (x?.vertices) m.juntar(x);
  return m;
}

/** Objeto do fantasma (null se não houver nada a mostrar). */
export function criarFantasma(ctx, malha, material) {
  if (!malha?.triangulos) return null;
  const o = new THREE.Mesh(geometriaDe(malha), material);
  o.name = 'arcologia:fantasma';
  o.renderOrder = 10;
  ctx.medidas.familia(o, 'arcologia');
  return o;
}

export function registrar() {}
