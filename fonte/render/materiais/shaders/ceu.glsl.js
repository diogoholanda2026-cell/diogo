// GLSL do céu (D9, desenho do render 2.1): o Preetham do Sky do three r186 (com as nuvens 2D dele) na unidade do jogo,
// mais o crepúsculo, a noite, a lua no ar e o brilho da cidade, com os mesmos números da conta em JS
// (render/ambiente/ceu.js). Um programa de tela cheia para o fundo, as faces do cubo e o cubo da luz do ambiente;
// a direção de cada pixel é frente + x · direita + y · cima. Abaixo do horizonte e na faixa rente a ele vale a cor da
// neblina (gNeblinaCorVista): o chão ao longe e o céu se encontram. Defines: CEU_DISCOS (fundo: sol, lua e estrelas
// analíticos), CEU_IBL (chão refletido abaixo do horizonte), CEU_NUVENS, CEU_LER_CUBO (o fundo lê o cubo assado).
// Tudo em highp (D44). Fora dos índices: exporta os trechos e quem usa importa.
import { NEBLINA_COR_PARS } from './neblina.glsl.js';

const f = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));
const v3 = (a) => `vec3( ${a.map(f).join(', ')} )`;

/** Vértice de tela cheia com a direção por pixel. */
export const CEU_VERTICE = /* glsl */ `
uniform vec3 uFrente;
uniform vec3 uDireita;
uniform vec3 uCima;
varying vec3 vDir;
void main() {
  vDir = uFrente + position.x * uDireita + position.y * uCima;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

/**
 * Fragmento do céu com as constantes do modelo em JS.
 * @param {{ K_CEU: number, CREPUSCULO: object, NOITE: object, LUA: object }} c
 */
export function fragmentoCeu(c) {
  const C = c.CREPUSCULO;
  return /* glsl */ `
uniform vec3 uSolDir;
uniform vec3 uSolIrr;
uniform vec3 uBetaR;
uniform vec3 uBetaM;
uniform float uSolE;
uniform float uMieG;
uniform float uElev;
uniform vec3 uLuaDir;
uniform float uLuaIlum;
uniform vec3 uLuaIrr;
uniform vec3 uCidade;
uniform float uNoite;
uniform float uEstrelas;
uniform mat3 uGiro;
uniform vec4 uNuvem;
uniform vec2 uNuvemPasso;
uniform vec3 uChao;
uniform float uDisco;
#ifdef CEU_LER_CUBO
uniform samplerCube uCubo;
#endif
varying vec3 vDir;
${NEBLINA_COR_PARS}

const float K_CEU = ${f(c.K_CEU)};

vec3 gcFex( vec3 d ) {
  float za = acos( max( 0.0, d.y ) );
  float inv = 1.0 / ( cos( za ) + 0.15 * pow( 93.885 - za * 57.29577951308232, -1.253 ) );
  return exp( - ( uBetaR * ( 8400.0 * inv ) + uBetaM * ( 1250.0 * inv ) ) );
}

vec3 gcPreetham( vec3 d ) {
  vec3 F = gcFex( d );
  float ct = dot( d, uSolDir );
  float rp = 0.05968310365946075 * ( 1.0 + pow( ct * 0.5 + 0.5, 2.0 ) );
  float g2 = uMieG * uMieG;
  float mp = 0.07957747154594767 * ( 1.0 - g2 ) / pow( 1.0 - 2.0 * uMieG * ct + g2, 1.5 );
  vec3 r = ( uBetaR * rp + uBetaM * mp ) / ( uBetaR + uBetaM );
  vec3 lin = pow( uSolE * r * ( 1.0 - F ), vec3( 1.5 ) );
  lin *= mix( vec3( 1.0 ), pow( uSolE * r * F, vec3( 0.5 ) ), clamp( pow( 1.0 - uSolDir.y, 5.0 ), 0.0, 1.0 ) );
  return K_CEU * ( ( lin + 0.1 * F ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 ) );
}

// crepúsculo, noite, lua no ar e cidade (render/ambiente/ceu.js, somarCrepusculoNoite)
vec3 gcCrepusculoNoite( vec3 d ) {
  float e = uElev;
  float kc = exp( min( e, 0.0 ) * ${f(C.queda)} ) * ( 1.0 - smoothstep( -0.04, 0.14, e ) );
  float az = dot( normalize( uSolDir.xz + vec2( 1e-6, 0.0 ) ), normalize( d.xz + vec2( 1e-6, 0.0 ) ) );
  float y = max( d.y, 0.0 );
  float faixa = exp( - y * 9.0 ) * pow( max( 0.0, az ), 2.0 );
  float venus = exp( - y * 5.0 ) * pow( max( 0.0, - az ), 1.5 );
  float alto = 0.55 + 0.45 * y;
  float hz = 1.0 + ${f(c.NOITE.horizonte)} * exp( - y * 5.0 );
  float luaAr = uLuaIlum * smoothstep( -0.05, 0.3, uLuaDir.y );
  vec3 cor = kc * ( ${v3(C.zenite)} * alto + ${v3(C.faixa)} * faixa + ${v3(C.venus)} * venus );
  cor += uNoite * ( ${v3(c.NOITE.zenite)} * hz + ${v3(c.LUA.ceu)} * ( luaAr * hz ) );
  cor += uCidade * exp( - y * 8.0 );
  return cor;
}

// ruído de gradiente do Sky do three r186 (sem seno: o mesmo resultado em toda GPU)
vec2 gcGradiente( vec2 i ) {
  vec3 p = fract( i.xyx * vec3( 0.1031, 0.1030, 0.0973 ) );
  p += dot( p, p.yzx + 33.33 );
  return fract( ( p.xx + p.yz ) * p.zy ) * 2.0 - 1.0;
}
float gcRuido( vec2 p ) {
  vec2 i = floor( p );
  vec2 fr = fract( p );
  vec2 u = fr * fr * fr * ( fr * ( fr * 6.0 - 15.0 ) + 10.0 );
  float a = dot( gcGradiente( i ), fr );
  float b = dot( gcGradiente( i + vec2( 1.0, 0.0 ) ), fr - vec2( 1.0, 0.0 ) );
  float cc = dot( gcGradiente( i + vec2( 0.0, 1.0 ) ), fr - vec2( 0.0, 1.0 ) );
  float dd = dot( gcGradiente( i + vec2( 1.0, 1.0 ) ), fr - vec2( 1.0, 1.0 ) );
  return mix( mix( a, b, u.x ), mix( cc, dd, u.x ), u.y ) * 1.6;
}
float gcFbm( vec2 p, float deriva ) {
  float t = 0.0;
  float amp = 1.0;
  for ( int i = 0; i < 4; i ++ ) {
    t += amp * gcRuido( p );
    amp *= 0.5;
    p = p * 2.0 + deriva;
  }
  return t;
}

// nuvens: x cobertura, y densidade, z escala, w elevação; devolve (mascara, profundidade, alfa, esmaecer no horizonte)
vec4 gcCampoNuvem( vec3 d ) {
  if ( d.y <= 0.0 || uNuvem.x <= 0.0 ) return vec4( 0.0 );
  float elevacao = mix( 1.0, 0.1, uNuvem.w );
  vec2 uv = d.xz / ( d.y * elevacao ) * uNuvem.z + uNuvemPasso;
  float n = clamp( gcFbm( uv * 1000.0, uNuvemPasso.x * 300.0 ) * 0.7 + 0.5, 0.0, 1.0 );
  float regiao = gcRuido( uv * 300.0 ) * 0.37 + 0.5;
  float cob = clamp( uNuvem.x + ( regiao - 0.5 ) * 0.6, 0.0, 1.0 );
  float lim = 1.0 - cob;
  float esm = smoothstep( 0.0, 0.03 + 0.06 * uNuvem.w, d.y );
  float mascara = smoothstep( lim, lim + 0.3, n ) * esm;
  float prof = max( 0.0, n - lim );
  float alfa = ( 1.0 - exp( - prof * uNuvem.y * 12.0 ) ) * esm;
  return vec4( mascara, prof, alfa, esm );
}

vec3 gcNuvens( vec3 d, vec3 fundo ) {
  vec4 cn = gcCampoNuvem( d );
  if ( cn.z <= 0.0 ) return fundo;
  float beer = exp( - cn.y * 4.0 );
  float po = 1.0 - beer * beer;
  float sombra = mix( 0.45, 1.0, clamp( beer * po * 2.6, 0.0, 1.0 ) );
  float ct = dot( d, uSolDir );
  float prata = clamp( 0.51 / pow( 1.49 - ct * 1.4, 1.5 ), 0.0, 3.0 );
  float borda = cn.x * ( 1.0 - cn.x ) * 4.0;
  vec3 luzSol = uSolIrr * 0.22;
  // base da nuvem: luz do céu de lado e de cima, e o chão; de noite a cidade e a lua
  vec3 amb = gNeblinaAnel[ 8 ] * 0.5 + gNeblinaZenite * 0.4 + uChao * 0.6;
  vec3 cor = amb + luzSol * sombra + luzSol * ( prata * borda * 0.6 );
  cor += uCidade * 2.5 + uLuaIrr * ( 0.2 * sombra );
  vec3 aerea = mix( fundo, cor, gcFex( d ) );
  return mix( fundo, aerea, cn.z );
}

vec3 gcCeu( vec3 d ) {
  vec3 dd = normalize( vec3( d.x, max( d.y, 0.001 ), d.z ) );
  vec3 L = gcPreetham( dd ) + gcCrepusculoNoite( dd );
#ifdef CEU_NUVENS
  L = gcNuvens( dd, L );
#endif
  vec3 h = gNeblinaCorVista( vec3( d.x, 0.02, d.z ) );
#ifdef CEU_IBL
  // a luz do céu (não o fundo) com a saturação medida de um céu limpo (render/ambiente/ceu.js, SAT_LUZ_CEU)
  vec3 ceu = mix( h, L, smoothstep( 0.0, 0.035, d.y ) );
  ceu = mix( vec3( dot( ceu, vec3( 0.2126, 0.7152, 0.0722 ) ) ), ceu, ${f(c.SAT_LUZ_CEU ?? 1)} );
  return d.y < 0.0 ? mix( ceu, uChao, smoothstep( 0.0, -0.1, d.y ) ) : ceu;
#endif
  return mix( h, L, smoothstep( 0.0, 0.035, d.y ) );
}

#ifdef CEU_DISCOS
float gcHash( vec2 p ) {
  vec3 q = fract( p.xyx * 0.1031 );
  q += dot( q, q.yzx + 33.33 );
  return fract( ( q.x + q.y ) * q.z );
}

// estrelas presas ao céu que gira (um ponto por célula de uma grade cúbica); as derivadas saem antes de qualquer
// desvio (fwidth só vale em fluxo uniforme)
vec3 gcEstrelas( vec3 d ) {
  vec3 p = uGiro * d;
  vec3 a = abs( p );
  vec2 uv;
  float face;
  if ( a.x >= a.y && a.x >= a.z ) { uv = p.yz / a.x; face = sign( p.x ); }
  else if ( a.y >= a.z ) { uv = p.xz / a.y; face = 2.0 + sign( p.y ); }
  else { uv = p.xy / a.z; face = 4.0 + sign( p.z ); }
  vec2 g = uv * 110.0;
  float px = max( fwidth( g.x ), fwidth( g.y ) );
  vec2 cel = floor( g ) + face * 131.0;
  float h = gcHash( cel );
  vec2 o = vec2( gcHash( cel + 3.1 ), gcHash( cel + 7.7 ) ) * 0.7 + 0.15;
  float dist = length( fract( g ) - o );
  float brilho = pow( max( 0.0, h - 0.9 ) * 10.0, 5.0 ) * 1.6 + 0.12;
  float k = ( 1.0 - smoothstep( 0.0, max( px * 0.9, 0.03 ), dist ) ) * step( 0.9, h );
  vec3 cor = mix( vec3( 1.0, 0.86, 0.72 ), vec3( 0.78, 0.86, 1.0 ), gcHash( cel + 5.3 ) );
  float cidade = 1.0 - 0.8 * smoothstep( 0.0, 0.004, uCidade.r ) * exp( - max( d.y, 0.0 ) * 3.0 );
  return cor * ( brilho * k * uEstrelas * 0.03 * cidade ) * smoothstep( 0.0, 0.2, d.y );
}

// discos do sol e da lua (analíticos, nítidos), atrás das nuvens
vec3 gcDiscos( vec3 d ) {
  vec3 r = vec3( 0.0 );
  float as = sqrt( max( 0.0, 2.0 - 2.0 * dot( d, uSolDir ) ) );
  float al = sqrt( max( 0.0, 2.0 - 2.0 * dot( d, uLuaDir ) ) );
  float pxs = fwidth( as );
  float pxl = fwidth( al );
  const float RSOL = 0.0052;
  if ( as < RSOL * 1.6 && uSolDir.y > -0.02 ) {
    float k = 1.0 - smoothstep( RSOL - pxs, RSOL + pxs, as );
    float mu = sqrt( max( 0.0, 1.0 - ( as * as ) / ( RSOL * RSOL ) ) );
    float borda = 0.45 + 0.55 * mu;
    float lum = max( dot( uSolIrr, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-4 );
    r += uSolIrr / lum * ( uDisco * min( lum, 3.0 ) * borda * k );
  }
  const float RLUA = 0.0058;
  if ( al < RLUA * 1.5 && uLuaDir.y > -0.02 ) {
    vec3 t1 = normalize( cross( uLuaDir, vec3( 1e-4, 1.0, 0.0 ) ) );
    vec3 t2 = cross( t1, uLuaDir );
    vec3 o = d - uLuaDir * dot( d, uLuaDir );
    vec2 q = vec2( dot( o, t1 ), dot( o, t2 ) ) / RLUA;
    float px = pxl / RLUA;
    float k = 1.0 - smoothstep( 1.0 - px, 1.0 + px, length( q ) );
    float z = sqrt( max( 0.0, 1.0 - dot( q, q ) ) );
    vec3 n = q.x * t1 + q.y * t2 - z * uLuaDir;
    float luz = smoothstep( -0.03, 0.08, dot( n, uSolDir ) );
    float mar = 0.72 + 0.28 * smoothstep( 0.25, 0.65, gcRuido( q * 2.3 + 4.0 ) * 0.5 + 0.5 );
    r += vec3( 0.95, 0.93, 0.88 ) * ( 0.42 * mar * luz * k ) + vec3( 0.05, 0.06, 0.09 ) * ( 0.03 * k );
  }
#ifdef CEU_NUVENS
  if ( r.r + r.g + r.b > 0.0 ) r *= 1.0 - gcCampoNuvem( d ).z;
#endif
  return r * smoothstep( -0.002, 0.004, d.y );
}
#endif

void main() {
  vec3 d = normalize( vDir );
#ifdef CEU_LER_CUBO
  vec3 cor = texture( uCubo, d ).rgb;
#else
  vec3 cor = gcCeu( d );
#endif
#ifdef CEU_DISCOS
  cor += gcEstrelas( d ) + gcDiscos( d );
#endif
  gl_FragColor = vec4( cor, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
}

export function registrar() {}
