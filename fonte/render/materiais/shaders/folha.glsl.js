// GLSL das folhas: a cor da Mata Atlântica vista de cima, usada pela copa da mata no terreno (R2a) e pelas árvores
// de R2b (tom por instância e o mesmo verde da copa, para a troca de perto para longe não mudar a cor). Fora dos
// índices: exporta os trechos GLSL e quem usa importa. Tudo em highp (D44).
//
// Cores em albedo linear (desenho do render 9.2: folhagem de 0,05 a 0,12), nada de verde-limão: a mata vista de avião
// é verde-escuro com copas mais claras (embaúba prateada, brotos) e, rara, uma florada de ipê ou quaresmeira.

/** Albedos da copa (sRGB), fonte única para o GLSL e para os testes. */
export const CORES_COPA = Object.freeze({
  sombra: '#141c0f',
  escura: '#27351d',
  media: '#344428',
  clara: '#4a5731',
  embauba: '#626b52',
  ipe: '#9c873f',
  quaresmeira: '#65465f',
});

const linear = (hex) => {
  const v = (k) => {
    const c = parseInt(hex.slice(1 + 2 * k, 3 + 2 * k), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [v(0), v(1), v(2)];
};

/** vec3 GLSL de uma cor sRGB (em linear). */
export const vec3Linear = (hex) => `vec3(${linear(hex).map((x) => x.toFixed(5)).join(', ')})`;

/**
 * Cor da copa (albedo linear): manchas de mata fechada e secundária, copas grandes e pequenas, embaúbas, florada
 * rara e os vãos escuros entre as copas. copaRelevo dá a altura das copas para o relevo por derivadas.
 */
export const GLSL_COPA = /* glsl */ `
// rc: ruído de 263 m (copas grandes, 16 m); rf: de 71 m (copas pequenas, 4,4 m); rm: manchas de 2,3 km
float copaSecundaria( vec4 rc, vec4 rm ) { return smoothstep( 0.42, 0.78, rm.x * 0.6 + rc.y * 0.4 ); }
vec3 copaCor( vec4 rc, vec4 rf, vec4 rm ) {
  float sec = copaSecundaria( rc, rm );
  vec3 c = mix( ${vec3Linear(CORES_COPA.escura)}, ${vec3Linear(CORES_COPA.media)}, smoothstep( 0.25, 0.75, rc.y * 0.5 + rf.y * 0.5 ) );
  c = mix( c, ${vec3Linear(CORES_COPA.clara)}, sec * 0.55 + smoothstep( 0.7, 0.92, rf.w ) * 0.25 );
  c = mix( c, ${vec3Linear(CORES_COPA.embauba)}, smoothstep( 0.78, 0.95, rf.x * 0.5 + rc.x * 0.5 ) * 0.5 );
  float flor = smoothstep( 0.9, 0.97, rf.w * 0.5 + rc.w * 0.5 );
  c = mix( c, mix( ${vec3Linear(CORES_COPA.ipe)}, ${vec3Linear(CORES_COPA.quaresmeira)}, step( 0.5, rm.y ) ), flor * 0.55 );
  // copas grandes na mata fechada, pequenas na secundária; vãos entre elas mais escuros
  float coroa = mix( rc.z, rf.z, sec );
  return mix( ${vec3Linear(CORES_COPA.sombra)}, c, 0.3 + 0.7 * smoothstep( 0.04, 0.5, coroa ) );
}
// relevo da copa em metros (para o relevo por derivadas); kf (0 a 1) é a parte das copas pequenas (4 m), que o relevo
// por derivada de tela só desenha com o pixel bem menor que elas (senão, com o sol baixo, vira chuvisco em quadradinhos)
float copaRelevo( vec4 rc, vec4 rf, vec4 rm, float kf ) {
  float sec = copaSecundaria( rc, rm );
  return ( mix( 2.6 * rc.z + 0.7 * rf.z * kf, 1.6 * rf.z * kf + 0.6 * rc.z, sec ) + 0.3 * rf.w * kf ) * ( 0.6 + 0.8 * rf.y );
}
float copaRelevo( vec4 rc, vec4 rf, vec4 rm ) { return copaRelevo( rc, rf, rm, 1.0 ); }
`;

/** Tom por instância para as árvores (R2b): varia a cor da folha em torno da copa, sem sair da faixa de albedo. */
export const GLSL_FOLHA_TOM = /* glsl */ `
vec3 folhaTom( vec3 base, float semente ) {
  float a = fract( sin( semente * 12.9898 ) * 43758.5453 );
  float b = fract( sin( semente * 78.233 ) * 24634.6345 );
  return base * ( 0.82 + 0.36 * a ) * mix( vec3( 1.0 ), vec3( 1.06, 1.02, 0.86 ), b );
}
`;

/** Registro vazio (fora dos índices: quem usa importa os trechos). */
export function registrar() {}
