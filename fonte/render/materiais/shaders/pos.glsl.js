// GLSL do pós (desenho do render 2.3, 2.7 e 2.8): bloom por redução dupla a 1/4 (pré-filtro de 13 leituras com média
// de Karis e limiar suave, reduções de 13 leituras, ampliações em tenda somadas), composição com exposição, AgX
// (o do three r186, portado: preserva o matiz nos realces), CAS (nitidez adaptativa de 5 leituras quando a resolução
// dinâmica cai), vinheta leve, pontilhado de 1 nível contra faixas no céu e esmaecer; e a mistura de duas texturas
// texel a texel (os quadros-chave da luz do ambiente, D9). Sem tinta de sombra ou de realce e com saturação 1,0.
// Tudo em highp (D44). Fora dos índices.

/** Vértice de tela cheia (triângulo de -1 a 3). */
export const TELA_VERTICE = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

const LUM = 'vec3( 0.2126, 0.7152, 0.0722 )';

/** Pré-filtro do bloom direto para 1/4: 13 leituras, média de Karis por grupo, exposição e limiar suave. */
export const PREFILTRO = /* glsl */ `
uniform sampler2D tMapa;
uniform vec2 uTexel;
uniform float uLimiar;
uniform float uJoelho;
uniform float uExposicao;
varying vec2 vUv;
float lum( vec3 c ) { return dot( c, ${LUM} ); }
vec3 s( float x, float y ) { return texture( tMapa, vUv + uTexel * vec2( x, y ) ).rgb; }
vec3 grupo( vec3 a, vec3 b, vec3 c, vec3 d ) {
  float wa = 1.0 / ( 1.0 + lum( a ) ), wb = 1.0 / ( 1.0 + lum( b ) ), wc = 1.0 / ( 1.0 + lum( c ) ), wd = 1.0 / ( 1.0 + lum( d ) );
  return ( a * wa + b * wb + c * wc + d * wd ) / ( wa + wb + wc + wd );
}
void main() {
  vec3 A = s( -4.0, -4.0 ), B = s( 0.0, -4.0 ), C = s( 4.0, -4.0 ), D = s( -4.0, 0.0 ), E = s( 0.0, 0.0 ), F = s( 4.0, 0.0 );
  vec3 G = s( -4.0, 4.0 ), H = s( 0.0, 4.0 ), I = s( 4.0, 4.0 );
  vec3 J = s( -2.0, -2.0 ), K = s( 2.0, -2.0 ), L = s( -2.0, 2.0 ), M = s( 2.0, 2.0 );
  vec3 cor = grupo( J, K, L, M ) * 0.5 + ( grupo( A, B, D, E ) + grupo( B, C, E, F ) + grupo( D, E, G, H ) + grupo( E, F, H, I ) ) * 0.125;
  cor *= uExposicao;
  float br = max( cor.r, max( cor.g, cor.b ) );
  float suave = clamp( br - uLimiar + uJoelho, 0.0, 2.0 * uJoelho );
  suave = suave * suave / ( 4.0 * uJoelho + 1e-4 );
  float parte = max( suave, br - uLimiar ) / max( br, 1e-4 );
  gl_FragColor = vec4( min( cor * parte, vec3( 64.0 ) ), 1.0 );
}
`;

/** Redução de 13 leituras (Jimenez). */
export const REDUZ = /* glsl */ `
uniform sampler2D tMapa;
uniform vec2 uTexel;
varying vec2 vUv;
vec3 s( float x, float y ) { return texture( tMapa, vUv + uTexel * vec2( x, y ) ).rgb; }
void main() {
  vec3 cor = s( 0.0, 0.0 ) * 0.125
    + ( s( -2.0, -2.0 ) + s( 2.0, -2.0 ) + s( -2.0, 2.0 ) + s( 2.0, 2.0 ) ) * 0.03125
    + ( s( 0.0, -2.0 ) + s( -2.0, 0.0 ) + s( 2.0, 0.0 ) + s( 0.0, 2.0 ) ) * 0.0625
    + ( s( -1.0, -1.0 ) + s( 1.0, -1.0 ) + s( -1.0, 1.0 ) + s( 1.0, 1.0 ) ) * 0.125;
  gl_FragColor = vec4( cor, 1.0 );
}
`;

/** Ampliação em tenda 3 x 3 (4 leituras bilineares a meio texel), somada ao nível de cima. */
export const AMPLIA = /* glsl */ `
uniform sampler2D tMapa;
uniform vec2 uTexel;
uniform float uPeso;
varying vec2 vUv;
void main() {
  vec2 o = uTexel * 0.5;
  vec3 cor = texture( tMapa, vUv + vec2( -o.x, -o.y ) ).rgb + texture( tMapa, vUv + vec2( o.x, -o.y ) ).rgb
    + texture( tMapa, vUv + vec2( -o.x, o.y ) ).rgb + texture( tMapa, vUv + vec2( o.x, o.y ) ).rgb;
  gl_FragColor = vec4( cor * ( 0.25 * uPeso ), 1.0 );
}
`;

/**
 * AgX do three r186 (Filament, primárias rec. 2020), com a exposição como parâmetro e o "look" do ASC CDL no espaço
 * da curva (como o Punchy do Blender, mais brando): potência dá o contraste pela curva, saturação em volta da luma.
 */
export const AGX = /* glsl */ `
vec3 agxContraste( vec3 x ) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agx( vec3 cor, float exposicao, float potencia, float saturacao ) {
  const mat3 SRGB_2020 = mat3( vec3( 0.6274, 0.0691, 0.0164 ), vec3( 0.3293, 0.9195, 0.0880 ), vec3( 0.0433, 0.0113, 0.8956 ) );
  const mat3 R2020_SRGB = mat3( vec3( 1.6605, -0.1246, -0.0182 ), vec3( -0.5876, 1.1329, -0.1006 ), vec3( -0.0728, -0.0083, 1.1187 ) );
  const mat3 ENTRA = mat3( vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ), vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ), vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 ) );
  const mat3 SAI = mat3( vec3( 1.1271005818144368, -0.1413297634984383, -0.14132976349843826 ), vec3( -0.11060664309660323, 1.157823702216272, -0.11060664309660294 ), vec3( -0.016493938717834573, -0.016493938717834257, 1.2519364065950405 ) );
  const float EV_MIN = -12.47393;
  const float EV_MAX = 4.026069;
  cor *= exposicao;
  cor = ENTRA * ( SRGB_2020 * cor );
  cor = clamp( ( log2( max( cor, 1e-10 ) ) - EV_MIN ) / ( EV_MAX - EV_MIN ), 0.0, 1.0 );
  cor = agxContraste( cor );
  cor = pow( max( cor, vec3( 0.0 ) ), vec3( potencia ) );
  float lk = dot( cor, vec3( 0.2126, 0.7152, 0.0722 ) );
  cor = lk + saturacao * ( cor - lk );
  cor = SAI * cor;
  cor = pow( max( vec3( 0.0 ), cor ), vec3( 2.2 ) );
  return clamp( R2020_SRGB * cor, 0.0, 1.0 );
}
`;

/**
 * Composição: cena + bloom, CAS, exposição e AgX, vinheta, sRGB, pontilhado e esmaecer. A CAS roda num espaço
 * perceptivo (PC2, trazida de motor/pos.js na C1b): filtrar o HDR linear empurrava o vizinho da janela acesa (10) ao
 * lado da fachada escura (0,05) abaixo de zero, e a CAS sempre ligada desenhava um anel preto em volta de cada luz da
 * cidade à noite. Os 5 texels passam por Reinhard pelo maior canal (com a exposição, tudo em [0, 1)) e pela raiz
 * (perto do sRGB, o domínio para o qual a CAS da AMD foi feita), o filtro roda por canal e a conta volta ao HDR (a
 * volta é exata onde o filtro não mexe).
 */
export const COMPOSICAO = /* glsl */ `
uniform sampler2D tCena;
uniform sampler2D tBloom;
uniform vec2 uTexel;
uniform float uBloom;
uniform float uExposicao;
uniform float uPotencia;
uniform float uSaturacao;
uniform float uCas;
uniform float uVinheta;
uniform float uAspecto;
uniform float uTempo;
uniform float uEsmaecer;
uniform vec3 uCorEsmaecer;
varying vec2 vUv;
${AGX}
float h12( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
vec3 paraSrgb( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }
// CAS num espaço perceptivo: Reinhard pelo maior canal com a exposição e a raiz; casDe desfaz
vec3 casPara( vec3 c ) { vec3 e = max( c, vec3( 0.0 ) ) * uExposicao; return sqrt( e / ( 1.0 + max( e.r, max( e.g, e.b ) ) ) ); }
vec3 casDe( vec3 p ) { vec3 t = p * p; float m = min( max( t.r, max( t.g, t.b ) ), 0.999 ); return t / ( ( 1.0 - m ) * uExposicao ); }
void main() {
  vec3 cor = texture( tCena, vUv ).rgb;
  if ( uCas > 0.0 ) {
    // CAS: vizinhos em cruz; o peso negativo encolhe onde já há contraste (por canal, no espaço perceptivo)
    vec3 n = texture( tCena, vUv + vec2( 0.0, uTexel.y ) ).rgb;
    vec3 sl = texture( tCena, vUv - vec2( 0.0, uTexel.y ) ).rgb;
    vec3 l = texture( tCena, vUv - vec2( uTexel.x, 0.0 ) ).rgb;
    vec3 r = texture( tCena, vUv + vec2( uTexel.x, 0.0 ) ).rgb;
    vec3 p0 = casPara( cor ), p1 = casPara( n ), p2 = casPara( sl ), p3 = casPara( l ), p4 = casPara( r );
    vec3 mn = min( p0, min( min( p1, p2 ), min( p3, p4 ) ) );
    vec3 mx = max( p0, max( max( p1, p2 ), max( p3, p4 ) ) );
    vec3 amp = sqrt( clamp( min( mn, 1.0 - mx ) / max( mx, vec3( 1e-4 ) ), 0.0, 1.0 ) );
    vec3 w = - amp / mix( 8.0, 5.0, uCas );
    cor = casDe( clamp( ( p0 + w * ( p1 + p2 + p3 + p4 ) ) / ( 1.0 + 4.0 * w ), 0.0, 1.0 ) );
  }
  if ( uBloom > 0.0 ) cor += texture( tBloom, vUv ).rgb * ( uBloom / uExposicao );
  cor = agx( cor, uExposicao, uPotencia, uSaturacao );
  vec2 q = ( vUv - 0.5 ) * vec2( uAspecto, 1.0 );
  float rr = length( q ) / length( vec2( uAspecto, 1.0 ) * 0.5 );
  cor *= mix( 1.0, 1.0 - smoothstep( 0.45, 1.2, rr ), uVinheta );
  cor = paraSrgb( cor );
  cor += ( h12( gl_FragCoord.xy + fract( uTempo ) * 71.0 ) - 0.5 ) / 255.0;
  cor = mix( cor, uCorEsmaecer, uEsmaecer );
  gl_FragColor = vec4( cor, 1.0 );
}
`;

/** Mistura texel a texel de duas texturas do mesmo tamanho (quadros-chave da luz do ambiente). */
export const MISTURA = /* glsl */ `
uniform sampler2D tA;
uniform sampler2D tB;
uniform float uT;
void main() {
  ivec2 p = ivec2( gl_FragCoord.xy );
  gl_FragColor = mix( texelFetch( tA, p, 0 ), texelFetch( tB, p, 0 ), uT );
}
`;

export function registrar() {}
