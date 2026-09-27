// GLSL do gancho 'sombra' (D43, D9): lê o mapa da sombra própria (uma cascata no Média, duas num atlas no Alta e no
// Ultra), com PCF de 5 a 8 amostras num disco de Vogel girado por texel do mapa (o grão fica preso ao mundo e não
// desliza com a câmera), mistura na borda entre as cascatas e some na borda de fora; e multiplica a luz do sol pela
// sombra das nuvens (uma leitura de uma textura de ruído que anda com o vento, coerente com a cobertura do céu).
// Com a profundidade invertida (EXT_clip_control) o mapa guarda 1 perto da luz: o viés troca de sinal e a comparação
// do amostrador também (quem troca é render/sombra/mapa.js). Tudo em highp (D44). Fora dos índices.

/** Declarações e funções (trecho 'pars' do fragmento). vGPosMundo vem do registro de ganchos. */
export const SOMBRA_PARS = /* glsl */ `
uniform highp sampler2DShadow gSombraMapa;
uniform mat4 gSombraMatriz;
uniform mat4 gSombraMatriz1;
uniform float gSombraLigada;
uniform float gSombraCascatas;
uniform float gSombraTexel;
uniform float gSombraVies;
uniform float gSombraNormal;
uniform float gSombraNormal1;
uniform float gSombraRaioPcf;
uniform float gSombraAmostras;
uniform float gSombraForca;
uniform sampler2D gNuvemMapa;
uniform vec4 gNuvemParams;
uniform vec4 gNuvemDesloc;

// PCF num disco de Vogel; s em [0, 1]³ da cascata c (0 ou 1), dentro do atlas de n cascatas lado a lado
float gSombraPcf( vec3 s, float c, float n ) {
  float z = s.z - gSombraVies;
  vec2 texel = vec2( gSombraTexel / n, gSombraTexel );
  vec2 lim0 = vec2( c / n, 0.0 ) + 0.5 * texel;
  vec2 lim1 = vec2( ( c + 1.0 ) / n, 1.0 ) - 0.5 * texel;
  vec2 uv = vec2( ( s.x + c ) / n, s.y );
  vec2 cel = floor( s.xy / gSombraTexel );
  float fase = fract( 52.9829189 * fract( dot( cel, vec2( 0.06711056, 0.00583715 ) ) ) ) * 6.2831853;
  vec2 raio = texel * gSombraRaioPcf;
  float soma = 0.0;
  float k = 0.0;
  for ( int i = 0; i < 8; i ++ ) {
    if ( float( i ) >= gSombraAmostras ) break;
    float r = sqrt( ( float( i ) + 0.5 ) / gSombraAmostras );
    float a = float( i ) * 2.39996323 + fase;
    vec2 o = vec2( cos( a ), sin( a ) ) * r * raio;
    soma += texture( gSombraMapa, vec3( clamp( uv + o, lim0, lim1 ), z ) );
    k += 1.0;
  }
  return soma / max( k, 1.0 );
}

// distância à borda da cascata ([0, 0,5]; negativa fora)
float gSombraBorda( vec3 s ) {
  vec2 b = min( s.xy, 1.0 - s.xy );
  return s.z <= 0.0 || s.z >= 1.0 ? -1.0 : min( b.x, b.y );
}

float gSombraSol( vec3 nMundo ) {
  if ( gSombraLigada < 0.5 ) return 1.0;
  vec3 s0 = ( gSombraMatriz * vec4( vGPosMundo + nMundo * gSombraNormal, 1.0 ) ).xyz;
  float b0 = gSombraBorda( s0 );
  float luz = 1.0;
  if ( gSombraCascatas < 1.5 ) {
    if ( b0 > 0.0 ) luz = mix( 1.0, gSombraPcf( s0, 0.0, 1.0 ), smoothstep( 0.0, 0.05, b0 ) );
  } else {
    vec3 s1 = ( gSombraMatriz1 * vec4( vGPosMundo + nMundo * gSombraNormal1, 1.0 ) ).xyz;
    float b1 = gSombraBorda( s1 );
    float longe = b1 > 0.0 ? mix( 1.0, gSombraPcf( s1, 1.0, 2.0 ), smoothstep( 0.0, 0.05, b1 ) ) : 1.0;
    if ( b0 > 0.0 ) luz = mix( longe, gSombraPcf( s0, 0.0, 2.0 ), smoothstep( 0.0, 0.08, b0 ) );
    else luz = longe;
  }
  return mix( 1.0, luz, gSombraForca );
}

// sombra das nuvens no chão: a nuvem a ~1.500 m projetada pela direção do sol (desvio = sol.xz / sol.y)
float gNuvemSombra() {
  if ( gNuvemParams.y <= 0.0 ) return 1.0;
  vec2 xz = vGPosMundo.xz + ( 1500.0 - vGPosMundo.y ) * gNuvemDesloc.zw;
  float n = texture( gNuvemMapa, xz * gNuvemParams.x + gNuvemDesloc.xy ).r;
  return 1.0 - gNuvemParams.y * smoothstep( gNuvemParams.z, gNuvemParams.z + 0.12, n );
}
`;

/** Trecho 'sol' (dentro do laço da luz direcional: multiplica a cor da luz). */
export const SOMBRA_SOL = 'directLight.color *= gSombraSol( inverseTransformDirection( geometryNormal, viewMatrix ) ) * gNuvemSombra();';

export function registrar() {}
