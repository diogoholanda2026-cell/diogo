// GLSL das árvores da R2b (mundo/vegetacao.js): o atlas de folhas feito na GPU na carga (desenho do render 9.3:
// cachos de folhas, a folha palmada da embaúba, a palma pinada e a casca), o material das árvores (vento no vértice,
// recorte por alfa com o alfa por cobertura no MSAA, translucidez contra o sol), o assado e o desenho dos impostores
// (geracao/impostor.js) e o recorte da sombra própria. Vem sob demanda (import dinâmico do domínio 'vegetacao'): a
// cor da copa que o chão também usa (CORES_COPA, GLSL_COPA) mora em terreno.glsl.js e sai daqui de novo, para quem
// já importava daqui. Fora dos índices: exporta os trechos GLSL e quem usa importa. Tudo em highp (D44).
import { AZIMUTES, ANEIS, QUADROS, TROCA_ANEL, TROCA_TOPO } from '../../geracao/impostor.js';
import { CORES_COPA, vec3Linear, GLSL_COPA, GLSL_FOLHA_TOM } from './terreno.glsl.js';

export { CORES_COPA, vec3Linear, GLSL_COPA, GLSL_FOLHA_TOM };

// ------------------------------------------------------------------------------------------------ atlas de folhas

/** Lado do atlas de folhas (largura; a altura é a metade) por perfil. */
export const LADO_FOLHAS = Object.freeze({ ultra: 2048, alta: 1024, media: 1024, leve: 512 });

/**
 * Atlas de folhas (4 x 2 células), feito na GPU num passe: rgb é o multiplicador da cor da espécie (0,5 = 1) e a é o
 * recorte. Células: 0 oiti (folhinhas ovais, densas), 1 mata fina (folíolos miúdos), 2 mata média, 3 a folha palmada
 * da embaúba, 4 a palma pinada (u ao longo da raque, v da raque à ponta dos folíolos), 5 moita (folhas e gravetos),
 * 6 mata de folha larga e 7 a casca (opaca, repete nos dois sentidos). Os cachos são folhas sorteadas numa grade, cada
 * pixel olha as 9 células em volta (custo fixo por pixel), presas numa mancha de borda irregular.
 */
export const GLSL_GERAR_FOLHAS = {
  vertice: /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`,
  fragmento: /* glsl */ `
uniform float uSemente;
in vec2 vUv;
uint fHashU( uvec3 v ) {
  uint h = ( v.x * 1597334677u ) ^ ( v.y * 3812015801u ) ^ ( v.z * 2654435769u );
  h ^= h >> 16u;
  h *= 2246822519u;
  h ^= h >> 13u;
  h *= 3266489917u;
  h ^= h >> 16u;
  return h;
}
float fHash( vec2 c, float s ) { return float( fHashU( uvec3( uvec2( ivec2( c ) + 4096 ), uint( s ) ) ) ) * ( 1.0 / 4294967295.0 ); }
// ruído de valor periódico (per células por lado) e fbm
float fValor( vec2 p, vec2 per, float s ) {
  vec2 i = floor( p );
  vec2 f = p - i;
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  float a = fHash( mod( i, per ), s );
  float b = fHash( mod( i + vec2( 1.0, 0.0 ), per ), s );
  float c = fHash( mod( i + vec2( 0.0, 1.0 ), per ), s );
  float d = fHash( mod( i + vec2( 1.0, 1.0 ), per ), s );
  return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}
float fFbm( vec2 p, vec2 per, float s ) {
  float t = 0.0;
  float a = 0.5;
  for ( int o = 0; o < 4; o ++ ) {
    t += a * fValor( p, per, s + float( o ) * 13.0 );
    p *= 2.0;
    per *= 2.0;
    a *= 0.5;
  }
  return t / 0.9375;
}
// folha lanceolada no espaço dela (x ao longo, de -L a L; y de través): 1 dentro, borda de um pixel
float folhaForma( vec2 q, float L, float W, float ponta ) {
  float t = q.x / L;
  float larg = W * pow( max( 0.0, 1.0 - t * t ), 0.55 ) * ( 1.0 - ponta * max( t, 0.0 ) );
  float px = fwidth( q.y ) + 1e-4;
  return ( 1.0 - smoothstep( larg - px, larg + px, abs( q.y ) ) ) * step( abs( t ), 1.0 );
}
// mancha de borda irregular do cacho (raio por direção, contínuo em volta)
float cachoRaio( vec2 d, float s ) {
  vec2 dir = d / max( length( d ), 1e-4 );
  return 0.36 + 0.11 * fFbm( dir * 1.6 + vec2( 3.1, 1.7 ), vec2( 64.0 ), s + 91.0 );
}
// cacho de folhas: G células por lado, folhas de meio comprimento L e meia largura W, até duas por célula
vec4 cacho( vec2 uv, float G, float L, float W, float ponta, float dens2, float gravetos, vec3 tintura, float s ) {
  vec2 p = uv * G;
  vec2 ip = floor( p );
  float melhorZ = -1.0;
  vec3 cor = vec3( 0.0 );
  float alfa = 0.0;
  for ( int j = -1; j <= 1; j ++ ) {
    for ( int i = -1; i <= 1; i ++ ) {
      vec2 c = ip + vec2( float( i ), float( j ) );
      for ( int k = 0; k < 2; k ++ ) {
        float sk = s + float( k ) * 31.0;
        float h1 = fHash( c, sk );
        float h2 = fHash( c, sk + 1.0 );
        float h3 = fHash( c, sk + 2.0 );
        float h4 = fHash( c, sk + 3.0 );
        if ( k == 1 && h4 > dens2 ) continue;
        vec2 base = ( c + vec2( h1, h2 ) ) / G;
        vec2 dd = base - 0.5;
        float rr = length( dd ) / cachoRaio( dd, s );
        if ( rr > 1.0 - 0.25 * h3 ) continue;
        // a folha sai da base para fora do cacho, com desvio
        float a0 = atan( dd.y, dd.x + 1e-5 ) + ( h3 - 0.5 ) * 2.4;
        vec2 dir = vec2( cos( a0 ), sin( a0 ) );
        float Lk = L * ( 0.75 + 0.5 * h4 );
        vec2 q = uv - base - dir * Lk;
        vec2 ql = vec2( dot( q, dir ), dot( q, vec2( -dir.y, dir.x ) ) );
        float f = folhaForma( ql, Lk, W * ( 0.8 + 0.4 * h1 ), ponta );
        if ( f <= 0.0 ) continue;
        // as de fora do cacho ficam por cima; as de dentro, na sombra das outras
        float z = h2 * 0.5 + ( 1.0 - rr ) * 0.25 + h4 * 0.25;
        alfa = max( alfa, f );
        if ( z > melhorZ ) {
          melhorZ = z;
          float claro = 0.7 + 0.5 * h1;
          float nervura = 1.0 - 0.22 * ( 1.0 - smoothstep( 0.0, W * 0.12, abs( ql.y ) ) );
          float dobra = ql.y > 0.0 ? 1.08 : 0.9;
          vec3 t = mix( vec3( 1.0 ), tintura, step( 0.86, h3 ) );
          cor = vec3( 0.5 ) * claro * nervura * dobra * t * ( 0.72 + 0.4 * z );
        }
      }
    }
  }
  // gravetos do centro para fora, por baixo das folhas
  for ( int g = 0; g < 5; g ++ ) {
    if ( float( g ) >= gravetos ) break;
    float ag = fHash( vec2( float( g ), 7.0 ), s + 5.0 ) * 6.2831;
    vec2 dg = vec2( cos( ag ), sin( ag ) );
    vec2 q = uv - 0.5;
    float t = clamp( dot( q, dg ), 0.0, 0.33 );
    float dist = length( q - dg * t );
    float largura = 0.006 * ( 1.0 - t * 2.0 ) + 0.002;
    float gv = 1.0 - smoothstep( largura, largura + fwidth( dist ) + 1e-4, dist );
    if ( gv > 0.0 && melhorZ < 0.0 ) {
      cor = vec3( 0.42, 0.33, 0.24 );
      alfa = max( alfa, gv );
    }
  }
  return vec4( cor, alfa );
}
// folha palmada da embaúba: lobos compridos em volta do pecíolo (que fica embaixo), face prateada e nervuras claras
vec4 palmada( vec2 uv, float s ) {
  vec2 d = uv - vec2( 0.5, 0.44 );
  float r = length( d );
  float ang = atan( d.y, d.x );
  const float N = 9.0;
  float melhor = 0.0;
  float nerv = 0.0;
  for ( int k = 0; k < 9; k ++ ) {
    float fk = -1.5708 + 0.5236 + float( k ) * ( 5.236 / ( N - 1.0 ) );
    float dif = abs( mod( ang - fk + 3.14159, 6.28318 ) - 3.14159 );
    float Lk = 0.42 * ( 0.72 + 0.28 * cos( fk - 1.5708 ) ) * ( 0.9 + 0.2 * fHash( vec2( float( k ), 3.0 ), s ) );
    float t = clamp( r / Lk, 0.0, 1.0 );
    float meia = 0.075 * pow( sin( 3.14159 * min( 1.0, t * 0.92 + 0.08 ) ), 0.7 ) + 0.02 * ( 1.0 - t );
    float lat = dif * r;
    float px = fwidth( lat ) + 1e-4;
    float dentro = ( 1.0 - smoothstep( meia - px, meia + px, lat ) ) * step( r, Lk );
    melhor = max( melhor, dentro );
    nerv = max( nerv, ( 1.0 - smoothstep( 0.0, 0.005 + px, lat ) ) * dentro );
  }
  melhor = max( melhor, 1.0 - smoothstep( 0.07, 0.075, r ) );
  // pecíolo para baixo
  float pec = ( 1.0 - smoothstep( 0.008, 0.012, abs( d.x ) ) ) * step( -0.42, d.y ) * step( d.y, 0.0 );
  float n = fFbm( uv * 6.0, vec2( 6.0 ), s + 4.0 );
  vec3 cor = vec3( 0.5 ) * ( 0.85 + 0.3 * n ) * ( 0.92 + 0.12 * r );
  cor = mix( cor, vec3( 0.66, 0.68, 0.64 ), nerv * 0.6 );
  cor = mix( cor, vec3( 0.45, 0.42, 0.34 ), pec );
  return vec4( cor, max( melhor, pec ) );
}
// palma pinada: u ao longo da raque, v da raque (0) à ponta dos folíolos (1); folíolos oblíquos e afinando
vec4 palma( vec2 uv, float s ) {
  float u2 = uv.x * 1.0 - uv.y * 0.12;
  float per = 64.0;
  float i = floor( u2 * per );
  float f = fract( u2 * per );
  float h = fHash( vec2( i, 1.0 ), s );
  float compr = 0.82 + 0.18 * h;
  float larg = 0.2 * ( 1.0 - 0.7 * uv.y / compr ) + 0.04;
  float px = fwidth( f ) + 1e-4;
  float fol = ( 1.0 - smoothstep( larg - px, larg + px, abs( f - 0.5 ) ) ) * step( uv.y, compr );
  float raque = 1.0 - smoothstep( 0.03, 0.05, uv.y );
  vec3 cor = vec3( 0.5 ) * ( 0.85 + 0.3 * h ) * ( 0.85 + 0.25 * uv.y ) * ( 1.0 - 0.25 * ( 1.0 - smoothstep( 0.0, 0.06, abs( f - 0.5 ) ) ) );
  cor = mix( cor, vec3( 0.55, 0.52, 0.4 ), raque );
  return vec4( cor, max( fol, raque ) );
}
// casca: fissuras verticais, placas e anéis claros (periódica nos dois sentidos)
vec4 casca( vec2 uv, float s ) {
  float n = fFbm( vec2( uv.x * 7.0, uv.y * 2.0 ), vec2( 7.0, 2.0 ), s );
  float fis = smoothstep( 0.04, 0.0, abs( fFbm( vec2( uv.x * 11.0, uv.y * 1.5 ), vec2( 11.0, 3.0 ), s + 9.0 ) - 0.5 ) );
  float anel = smoothstep( 0.92, 1.0, fValor( vec2( uv.x * 3.0, uv.y * 24.0 ), vec2( 3.0, 24.0 ), s + 2.0 ) ) * 0.3;
  vec3 cor = vec3( 0.5 ) * ( 0.75 + 0.5 * n ) * ( 1.0 - 0.45 * fis ) * ( 1.0 + anel );
  return vec4( cor, 1.0 );
}
void main() {
  vec2 g = vUv * vec2( 4.0, 2.0 );
  vec2 cel = floor( g );
  vec2 uv = fract( g );
  int k = int( cel.x + cel.y * 4.0 + 0.5 );
  float s = uSemente + float( k ) * 101.0;
  vec4 c;
  if ( k == 0 ) c = cacho( uv, 13.0, 0.032, 0.014, 0.35, 0.9, 3.0, vec3( 1.05, 1.05, 0.8 ), s );
  else if ( k == 1 ) c = cacho( uv, 18.0, 0.022, 0.008, 0.5, 0.8, 4.0, vec3( 1.12, 1.06, 0.78 ), s );
  else if ( k == 2 ) c = cacho( uv, 10.0, 0.045, 0.019, 0.45, 0.7, 4.0, vec3( 1.1, 1.0, 0.75 ), s );
  else if ( k == 3 ) c = palmada( uv, s );
  else if ( k == 4 ) c = palma( uv, s );
  else if ( k == 5 ) c = cacho( uv, 12.0, 0.03, 0.013, 0.4, 0.45, 5.0, vec3( 1.15, 1.05, 0.72 ), s );
  else if ( k == 6 ) c = cacho( uv, 7.0, 0.07, 0.03, 0.3, 0.55, 3.0, vec3( 1.1, 1.02, 0.8 ), s );
  else c = casca( uv, s );
  // margem de 2% da célula sem folha: os mipmaps não puxam a vizinha
  vec2 m = step( vec2( 0.02 ), uv ) * step( uv, vec2( 0.98 ) );
  if ( k < 7 ) c.a *= m.x * m.y;
  // cor multiplicada pelo alfa: os mipmaps fazem a média ponderada pela cobertura e arvCor divide de volta, sem
  // escurecer (a média com o vazio) nem clarear (a borda e o fundo de cor cheia da palma e da embaúba)
  gl_FragColor = vec4( clamp( c.rgb, 0.0, 1.0 ) * c.a, c.a );
}
`,
};

// ------------------------------------------------------------------------------------------------ árvores

/** Uniformes das árvores (um objeto só: LOD0, LOD1, sombra e impostores). */
export const UNIFORMES_ARVORE = ['gArvFolhas', 'gArvTempo', 'gArvVento', 'gArvLado'];
/** Quanto o recorte do LOD1 (poucas cartas grandes) é mais cheio que o do LOD0. */
export const ARV_DENS_LOD1 = 1.7;

/**
 * Coordenada do atlas de folhas: célula (0 a 7), uv local (a casca repete; as folhas ficam na célula) e o recorte
 * por alfa que guarda a cobertura nos mipmaps (sem isto a copa some de longe: a média do alfa cai abaixo do corte).
 * arvCor: a cor da folha sem a cobertura. O atlas guarda a cor multiplicada pelo alfa (GLSL_GERAR_FOLHAS), então
 * cada mip tem a média ponderada pela cobertura e a divisão devolve a cor da folha em qualquer mip: com o reforço do
 * alfa os texels de pouca cobertura passam no recorte, e sem a divisão a folha de longe saía escura. (Dividir um atlas
 * de cor cheia, só a partir do mip 1, clareava demais as bordas das folhas finas e as cartas da palma e da embaúba,
 * que têm cor em toda a célula: o sub-bosque e as palmeiras ficavam verde-amarelados de média distância.)
 */
export const GLSL_ARV_ATLAS = /* glsl */ `
uniform highp sampler2D gArvFolhas;
uniform float gArvLado;   // largura do atlas em pixels
vec4 arvFolha( float cel, vec2 uvL, out float mip ) {
  vec2 c = vec2( mod( cel, 4.0 ), floor( cel / 4.0 + 0.01 ) );
  vec2 dx = dFdx( uvL ) * vec2( 0.25, 0.5 ) * 0.96;
  vec2 dy = dFdy( uvL ) * vec2( 0.25, 0.5 ) * 0.96;
  vec2 u = cel > 6.5 ? fract( uvL ) : clamp( uvL, 0.0, 1.0 );
  vec2 uv = ( c + vec2( 0.02 ) + u * 0.96 ) * vec2( 0.25, 0.5 );
  vec2 t = vec2( gArvLado, gArvLado * 0.5 );
  mip = max( 0.0, 0.5 * log2( max( dot( dx * t, dx * t ), dot( dy * t, dy * t ) ) ) );
  return textureGrad( gArvFolhas, uv, dx, dy );
}
vec3 arvCor( vec4 t ) {
  return t.rgb / max( t.a, 1e-3 );
}
`;

/** Trechos do material das árvores (LOD0 e LOD1) sobre o MeshStandardMaterial com cor por vértice e instâncias. */
export const GLSL_ARVORE = {
  verticePars: /* glsl */ `
attribute vec2 aArv;      // célula do atlas, peso do vento
attribute vec4 aInst;     // tom, semente, esmaecer, espécie (bytes)
uniform float gArvTempo;
uniform vec2 gArvVento;   // direção do vento (xz) vezes a força
varying vec2 vArvUv;
flat varying float vArvCel;
varying float vArvFade;
`,
  // depois de begin_vertex (transformed = position, no espaço do modelo)
  vertice: /* glsl */ `
vArvUv = uv;
vArvCel = aArv.x;
vArvFade = aInst.z;
{
  vec3 aOrig = vec3( instanceMatrix[ 3 ].x, instanceMatrix[ 3 ].y, instanceMatrix[ 3 ].z );
  float fase = dot( aOrig.xz, vec2( 0.131, 0.071 ) ) + aInst.y * 6.2831;
  float w = aArv.y;
  float onda = sin( gArvTempo * 1.1 + fase ) * 0.6 + sin( gArvTempo * 2.3 + fase * 1.7 ) * 0.3;
  transformed.xz += gArvVento * ( w * w * onda * 0.22 );
  // as folhas tremem um pouco mais, cada carta na sua fase
  if ( aArv.x < 6.5 ) transformed += objectNormal * ( sin( gArvTempo * 4.7 + fase + position.y * 1.9 + position.x ) * 0.035 * w * length( gArvVento ) );
}
`,
  // depois de color_vertex: o tom da instância (claro ou escuro, mais seco ou mais verde)
  cor: /* glsl */ `
vColor.rgb *= ( 0.84 + 0.32 * aInst.x ) * mix( vec3( 1.0 ), vec3( 1.07, 1.03, 0.82 ), aInst.y * aInst.y );
`,
  fragmentoPars: /* glsl */ `
${GLSL_ARV_ATLAS}
varying vec2 vArvUv;
flat varying float vArvCel;
varying float vArvFade;
float arvTrans;
`,
  // no lugar de map_fragment: a cor e o recorte da folha, e o esmaecer (pontilhado) da troca de LOD
  mapa: /* glsl */ `
float aMip;
vec4 aT = arvFolha( vArvCel, vArvUv, aMip );
diffuseColor.rgb *= arvCor( aT ) * 2.0;
// o LOD1 tem poucas cartas grandes: com o recorte do LOD0 a copa ficava rala (gravetos e pontos); mais cheia, ela
// fica da densidade do LOD0 e do impostor (assado do LOD0)
#ifdef ARV_LOD1
const float aDens = ${ARV_DENS_LOD1.toFixed(2)};
#else
const float aDens = 1.0;
#endif
diffuseColor.a = vArvCel > 6.5 ? 1.0 : clamp( aT.a * ( 1.0 + aMip * 0.45 ) * aDens, 0.0, 1.0 );
arvTrans = vArvCel > 6.5 ? 0.0 : 1.0;
if ( vArvFade < 0.999 ) {
  float aH = fract( sin( dot( floor( gl_FragCoord.xy ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  if ( aH > vArvFade ) discard;
}
`,
  // depois de lights_fragment_end: a luz do sol que atravessa a folha (a câmera olhando contra o sol; vViewPosition
  // aponta para a câmera e a direção da luz, para o sol) e a que a copa espalha por dentro: a folha na sombra das
  // outras ainda recebe uns 5% do sol, verde-escura e não preta (sem isso o miolo da copa salpicava de pontos pretos)
  luz: /* glsl */ `
#if NUM_DIR_LIGHTS > 0
{
  float aTr = pow( max( dot( -normalize( vViewPosition ), directionalLights[ 0 ].direction ), 0.0 ), 4.0 ) * 0.4 * arvTrans;
  reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[ 0 ].color * aTr;
  reflectedLight.indirectDiffuse += diffuseColor.rgb * directionalLights[ 0 ].color * ( 0.05 * arvTrans );
}
#endif
`,
};

/** Recorte da sombra própria (o gêmeo projetor usa este material): a mesma folha e o mesmo corte do desenho. */
export const GLSL_ARV_SOMBRA = {
  verticePars: /* glsl */ `
attribute vec2 aArv;
varying vec2 vArvUv;
flat varying float vArvCel;
`,
  vertice: /* glsl */ `
vArvUv = uv;
vArvCel = aArv.x;
`,
  fragmentoPars: /* glsl */ `
${GLSL_ARV_ATLAS}
varying vec2 vArvUv;
flat varying float vArvCel;
`,
  fragmento: /* glsl */ `
{
  float aMip;
  vec4 aT = arvFolha( vArvCel, vArvUv, aMip );
  // a sombra sai sempre da malha do LOD1: o mesmo recorte cheio dele
  if ( vArvCel < 6.5 && aT.a * ( 1.0 + aMip * 0.45 ) * ${ARV_DENS_LOD1.toFixed(2)} < 0.5 ) discard;
}
`,
};

// ------------------------------------------------------------------------------------------------ impostores

const f1 = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));

/**
 * Escolha das vistas no GLSL (a mesma conta de quadrosDaVista em geracao/impostor.js): d é a direção de onde a
 * câmera olha, no espaço da árvore. Devolve (a, b, peso).
 */
export const GLSL_IMP_QUADROS = /* glsl */ `
const float IMP_AZ = ${f1(AZIMUTES)};
const float IMP_QUADROS = ${f1(QUADROS)};
vec3 impostorQuadros( vec3 d ) {
  float el = degrees( asin( clamp( d.y, -1.0, 1.0 ) ) );
  if ( el >= ${f1(TROCA_TOPO)} ) return vec3( IMP_QUADROS - 1.0, IMP_QUADROS - 1.0, 0.0 );
  float anel = el < ${f1(TROCA_ANEL)} ? 0.0 : 1.0;
  float az = atan( d.z, d.x ) / 6.2831853;
  if ( az < 0.0 ) az += 1.0;
  float x = az * IMP_AZ;
  float i = mod( floor( x ), IMP_AZ );
  return vec3( anel * IMP_AZ + i, anel * IMP_AZ + mod( i + 1.0, IMP_AZ ), x - floor( x ) );
}
// direção de onde a vista k foi assada
vec3 impostorDirecao( float k ) {
  if ( k > IMP_QUADROS - 1.5 ) return vec3( 0.0, 1.0, 0.0 );
  float anel = floor( k / IMP_AZ + 0.01 );
  float az = mod( k, IMP_AZ ) / IMP_AZ * 6.2831853;
  float el = radians( anel < 0.5 ? ${f1(ANEIS[0])} : ${f1(ANEIS[1])} );
  return vec3( cos( el ) * cos( az ), sin( el ), cos( el ) * sin( az ) );
}
// uv (0 a 1) do ponto L (espaço da árvore, em raios a partir do centro da esfera) na vista k; d: de onde a câmera olha
vec2 impostorUv( float k, vec3 L, vec3 d ) {
  if ( k > IMP_QUADROS - 1.5 ) {
    vec3 q = L - d * ( L.y / max( d.y, 0.2 ) );
    return 0.5 + 0.5 * vec2( q.x, -q.z );
  }
  vec3 dk = impostorDirecao( k );
  vec3 dir = normalize( cross( vec3( 0.0, 1.0, 0.0 ), dk ) );
  vec3 cima = cross( dk, dir );
  return 0.5 + 0.5 * vec2( dot( L, dir ), dot( L, cima ) );
}
`;

/** Assado das vistas (ShaderMaterial): albedo na raiz quadrada e alfa, ou a normal da copa no espaço da árvore. */
export const GLSL_IMP_ASSAR = {
  vertice: /* glsl */ `
attribute vec2 aArv;
varying vec2 vArvUv;
flat varying float vArvCel;
varying vec3 vCor;
varying vec3 vNormalArv;
void main() {
  vArvUv = uv;
  vArvCel = aArv.x;
  vCor = color;
  vNormalArv = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`,
  fragmento: /* glsl */ `
${GLSL_ARV_ATLAS}
uniform float uModoNormal;
varying vec2 vArvUv;
flat varying float vArvCel;
varying vec3 vCor;
varying vec3 vNormalArv;
void main() {
  float aMip;
  vec4 aT = arvFolha( vArvCel, vArvUv, aMip );
  // o mesmo recorte do LOD0 e do LOD1, com o reforço do alfa pelo mip: o quadro do assado é pequeno (128 px no PC) e,
  // sem o reforço, a média do alfa das cartas de folha cai abaixo do corte e só o tronco e os galhos ficam
  if ( vArvCel < 6.5 && aT.a * ( 1.0 + aMip * 0.45 ) < 0.5 ) discard;
  if ( uModoNormal > 0.5 ) gl_FragColor = vec4( normalize( vNormalArv ) * 0.5 + 0.5, 1.0 );
  else gl_FragColor = vec4( sqrt( clamp( vCor * arvCor( aT ) * 2.0, 0.0, 1.0 ) ), 1.0 );
}
`,
};

/**
 * A carta de cada árvore no vértice (o desenho e a sombra própria): os atributos da instância, o centro e o raio da
 * esfera do modelo no mundo e a carta virada para quem olha, com as duas vistas do atlas mais perto da direção e o uv
 * nelas.
 */
export const GLSL_IMP_CARTA = /* glsl */ `
attribute vec4 aImpPos;   // x, y, z da base, giro
attribute vec2 aImpEsc;   // escala horizontal e vertical
attribute vec4 aInst;     // tom, semente, esmaecer, espécie (bytes)
uniform vec2 gImpEsfera[ 8 ];   // por espécie: centro da esfera em y e raio (modelo)
${GLSL_IMP_QUADROS}
float impEsp;      // espécie
vec3 impCentro;    // centro da esfera no mundo
float impRaio;     // raio da esfera no mundo
void impEsfera() {
  impEsp = floor( aInst.w * 255.0 + 0.5 );
  vec2 e = gImpEsfera[ int( impEsp ) ];
  impCentro = aImpPos.xyz + vec3( 0.0, e.x * aImpEsc.y, 0.0 );
  impRaio = e.y * max( aImpEsc.x, aImpEsc.y );
}
// o vértice da carta virada para v (unitário, de onde se olha) em volta do centro da esfera; q: as duas vistas e o
// peso, uv: o uv do vértice nas duas
vec3 impCarta( vec3 v, out vec3 q, out vec4 uv ) {
  vec3 aDir = cross( vec3( 0.0, 1.0, 0.0 ), v );
  aDir = dot( aDir, aDir ) > 1e-6 ? normalize( aDir ) : vec3( 1.0, 0.0, 0.0 );
  vec3 aCima = cross( v, aDir );
  vec3 aP = impCentro + ( aDir * position.x + aCima * position.y ) * impRaio;
  // para o espaço da árvore: desfaz o giro e a escala. A instância do LOD0 e do LOD1 gira em volta de y por
  // matrizArvore (mundo.xz = (c x + s z, -s x + c z)); aqui vai a inversa (local.xz = (c x - s z, s x + c z)), senão o
  // impostor mostra a árvore girada ao contrário e a copa pula de lado na troca do LOD1 para o impostor
  float aCg = cos( aImpPos.w );
  float aSg = sin( aImpPos.w );
  mat2 aRot = mat2( aCg, aSg, -aSg, aCg );
  vec3 aDl = v;
  aDl.xz = aRot * aDl.xz;
  aDl = normalize( aDl / vec3( aImpEsc.x, aImpEsc.y, aImpEsc.x ) );
  vec3 aL = aP - impCentro;
  aL.xz = aRot * aL.xz;
  aL /= vec3( aImpEsc.x, aImpEsc.y, aImpEsc.x ) * gImpEsfera[ int( impEsp ) ].y;
  q = impostorQuadros( aDl );
  uv = vec4( impostorUv( q.x, aL, aDl ), impostorUv( q.y, aL, aDl ) );
  return aP;
}
`;

/** Trechos do material dos impostores (MeshStandardMaterial sobre uma carta instanciada por árvore). */
export const GLSL_IMPOSTOR = {
  verticePars: /* glsl */ `
${GLSL_IMP_CARTA}
flat varying vec4 vImpQ;    // vista a, vista b, peso, espécie
varying vec4 vImpUv;        // uv local nas vistas a e b
flat varying vec2 vImpGiro;
flat varying vec2 vImpTom;
varying float vImpFade;
`,
  // no lugar de begin_vertex: a carta virada para a câmera em volta do centro da esfera, e as vistas
  vertice: /* glsl */ `
impEsfera();
vec3 aParaCam = normalize( cameraPosition - impCentro );
vec3 aQ;
vec4 aUv;
vec3 transformed = impCarta( aParaCam, aQ, aUv );
vImpQ = vec4( aQ, impEsp );
vImpUv = aUv;
vImpGiro = vec2( cos( aImpPos.w ), sin( aImpPos.w ) );
vImpTom = aInst.xy;
vImpFade = aInst.z;
objectNormal = aParaCam;
`,
  fragmentoPars: /* glsl */ `
uniform highp sampler2D gImpCor;
uniform highp sampler2D gImpNormal;
uniform vec2 gImpAtlas;   // vistas por linha, espécies
flat varying vec4 vImpQ;
varying vec4 vImpUv;
flat varying vec2 vImpGiro;
flat varying vec2 vImpTom;
varying float vImpFade;
vec3 impNormal;
vec4 impLer( highp sampler2D t, float k, vec2 uv, float lod ) {
  if ( any( lessThan( uv, vec2( 0.0 ) ) ) || any( greaterThan( uv, vec2( 1.0 ) ) ) ) return vec4( 0.0 );
  return textureLod( t, ( vec2( k, vImpQ.w ) + uv ) / gImpAtlas, lod );
}
`,
  // no lugar de map_fragment
  mapa: /* glsl */ `
vec2 aDx = dFdx( vImpUv.xy ) * vec2( textureSize( gImpCor, 0 ) ) / gImpAtlas;
vec2 aDy = dFdy( vImpUv.xy ) * vec2( textureSize( gImpCor, 0 ) ) / gImpAtlas;
float aLod = clamp( 0.5 * log2( max( dot( aDx, aDx ), dot( aDy, aDy ) ) ), 0.0, 3.5 );
vec4 aCa = impLer( gImpCor, vImpQ.x, vImpUv.xy, aLod );
vec4 aCb = impLer( gImpCor, vImpQ.y, vImpUv.zw, aLod );
vec4 aNa = impLer( gImpNormal, vImpQ.x, vImpUv.xy, aLod );
vec4 aNb = impLer( gImpNormal, vImpQ.y, vImpUv.zw, aLod );
vec4 aCor = mix( aCa, aCb, vImpQ.z );
vec4 aNor = mix( aNa, aNb, vImpQ.z );
float aA = aCor.a;
vec3 aAlb = aCor.rgb / max( aA, 1e-3 );
diffuseColor.rgb *= aAlb * aAlb * ( 0.84 + 0.32 * vImpTom.x ) * mix( vec3( 1.0 ), vec3( 1.07, 1.03, 0.82 ), vImpTom.y * vImpTom.y );
diffuseColor.a = clamp( aA * ( 1.0 + aLod * 0.35 ), 0.0, 1.0 );
vec3 aNl = aNor.rgb / max( aNor.a, 1e-3 ) * 2.0 - 1.0;
// a normal assada (espaço da árvore) volta ao mundo pelo giro da instância (o mesmo de matrizArvore)
aNl.xz = mat2( vImpGiro.x, -vImpGiro.y, vImpGiro.y, vImpGiro.x ) * aNl.xz;
impNormal = normalize( aNl );
if ( vImpFade < 0.999 ) {
  float aH = fract( sin( dot( floor( gl_FragCoord.xy ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  if ( aH > vImpFade ) discard;
}
`,
  // depois de normal_fragment_maps
  normal: /* glsl */ `
normal = normalize( ( viewMatrix * vec4( impNormal, 0.0 ) ).xyz );
`,
  luz: /* glsl */ `
#if NUM_DIR_LIGHTS > 0
{
  float aTr = pow( max( dot( -normalize( vViewPosition ), directionalLights[ 0 ].direction ), 0.0 ), 4.0 ) * 0.3;
  reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[ 0 ].color * aTr;
  // a luz que a copa espalha por dentro, como no LOD0 e no LOD1 (a troca não muda o tom)
  reflectedLight.indirectDiffuse += diffuseColor.rgb * directionalLights[ 0 ].color * 0.05;
}
#endif
`,
};

/**
 * Quanto a carta da sombra recua para longe do sol, em raios da esfera da árvore. O recuo é ao longo da luz: a sombra
 * no chão não muda, e a carta do desenho (que passa pelo centro, virada para a câmera) não cai na sombra da própria
 * árvore numa linha reta no meio da copa. Meio raio: com o sol a pino o chão debaixo da copa (a uns 0,6 raio abaixo do
 * centro) segue na sombra.
 */
export const IMP_RECUO_SOMBRA = 0.5;

/**
 * Sombra própria dos impostores (o gêmeo projetor, só profundidade): a carta de cada árvore virada para o sol, com a
 * vista do atlas mais perto da direção dele (o desenho da copa, não um disco), recortada pelo alfa do assado com o
 * mesmo reforço pelo mip do desenho e o mesmo esmaecer da troca. A câmera da sombra é ortográfica: a direção para o sol
 * é o eixo z dela, a mesma para todas as árvores. Uma leitura de textura por pixel, sem laço.
 */
export const GLSL_IMP_SOMBRA = {
  verticePars: /* glsl */ `
${GLSL_IMP_CARTA}
flat varying vec2 vImpS;    // vista, espécie
varying vec2 vImpUvS;
varying float vImpFade;
`,
  // no lugar de begin_vertex
  vertice: /* glsl */ `
impEsfera();
vec3 aParaSol = normalize( vec3( viewMatrix[ 0 ][ 2 ], viewMatrix[ 1 ][ 2 ], viewMatrix[ 2 ][ 2 ] ) );
vec3 aQ;
vec4 aUv;
vec3 transformed = impCarta( aParaSol, aQ, aUv ) - aParaSol * ( impRaio * ${f1(IMP_RECUO_SOMBRA)} );
// só a vista mais perto do sol (uma leitura no fragmento)
bool aPrimeira = aQ.z < 0.5;
vImpS = vec2( aPrimeira ? aQ.x : aQ.y, impEsp );
vImpUvS = aPrimeira ? aUv.xy : aUv.zw;
vImpFade = aInst.z;
`,
  fragmentoPars: /* glsl */ `
uniform highp sampler2D gImpCor;
uniform vec2 gImpAtlas;   // vistas por linha, espécies
flat varying vec2 vImpS;
varying vec2 vImpUvS;
varying float vImpFade;
`,
  // depois de clipping_planes_fragment
  fragmento: /* glsl */ `
{
  vec2 aDx = dFdx( vImpUvS ) * vec2( textureSize( gImpCor, 0 ) ) / gImpAtlas;
  vec2 aDy = dFdy( vImpUvS ) * vec2( textureSize( gImpCor, 0 ) ) / gImpAtlas;
  float aLod = clamp( 0.5 * log2( max( dot( aDx, aDx ), dot( aDy, aDy ) ) ), 0.0, 3.5 );
  float aA = textureLod( gImpCor, ( vImpS + clamp( vImpUvS, 0.0, 1.0 ) ) / gImpAtlas, aLod ).a;
  if ( any( lessThan( vImpUvS, vec2( 0.0 ) ) ) || any( greaterThan( vImpUvS, vec2( 1.0 ) ) ) ) aA = 0.0;
  if ( aA * ( 1.0 + aLod * 0.35 ) < 0.5 ) discard;
  if ( vImpFade < 0.999 && fract( sin( dot( floor( gl_FragCoord.xy ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) > vImpFade ) discard;
}
`,
};

/** Registro vazio (fora dos índices: quem usa importa os trechos). */
export function registrar() {}
