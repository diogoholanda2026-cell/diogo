// GLSL das sombras (D43, D9, desenho do render 2.5 e 2.6).
// 'sombra': lê o mapa da sombra própria (uma cascata no Média, duas num atlas no Alta e no Ultra), com PCF de 5 a 8
// amostras num disco de Vogel girado por texel do mapa (o grão fica preso ao mundo e não desliza com a câmera), mistura
// na borda entre as cascatas e, fora delas, entrega à sombra de longe (sem ela, some na borda); e multiplica a luz do
// sol pela sombra das nuvens (uma leitura de uma textura de ruído que anda com o vento, coerente com o céu).
// 'sombraLonge' e 'hao' (R1b) leem uma textura só, o campo (RGBA16F sobre o mapa, ambiente/sombraLonge.js): R e G são
// a altura da sombra no degrau do sol e no seguinte (degraus de 3 graus, misturados por gCampoT: a sombra anda sem
// salto), B a visibilidade do céu no chão da vizinhança e A a cota desse chão. Um fragmento está na sombra de longe
// quando fica abaixo da altura da sombra; o HAO escurece a luz do ambiente perto do chão entre prédios e no pé deles.
// Também aqui o passe que escreve o campo na GPU (CAMPO_PASSE). Com a profundidade invertida (EXT_clip_control) o
// mapa de perto guarda 1 perto da luz: o viés troca de sinal e a comparação do amostrador também (quem troca é
// render/sombra/mapa.js). Tudo em highp (D44). Fora dos índices.

/**
 * Normal do fragmento no mundo: a da luz nos materiais iluminados; nos outros, a da face pelas derivadas.
 */
export const NORMAL_MUNDO = /* glsl */ `
#ifndef G_NORMAL_MUNDO
#if defined( STANDARD ) || defined( PHYSICAL ) || defined( LAMBERT ) || defined( PHONG ) || defined( TOON )
#define G_NORMAL_MUNDO inverseTransformDirection( geometryNormal, viewMatrix )
#define G_ILUMINADO
#else
#define G_NORMAL_MUNDO normalize( cross( dFdx( vGPosMundo ), dFdy( vGPosMundo ) ) )
#endif
#endif
`;

/** Declarações do campo (uma vez só, mesmo com vários ganchos que o leem). */
export const CAMPO_PARS = /* glsl */ `
${NORMAL_MUNDO}
#ifndef G_CAMPO_PARS
#define G_CAMPO_PARS
uniform sampler2D gCampoMapa;
uniform vec4 gCampoParams; // origem x, origem z, 1 / lado do mapa, metros por célula
uniform float gCampoLigado;
vec4 gCampo( vec2 xz ) { return texture( gCampoMapa, ( xz - gCampoParams.xy ) * gCampoParams.z ); }
#endif
`;

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

// sombra de perto e o peso dela (0 fora das cascatas: ali vale a sombra de longe); v sem a força
float gSombraPerto( vec3 nMundo, out float w ) {
  w = 0.0;
  if ( gSombraLigada < 0.5 ) return 1.0;
  vec3 s0 = ( gSombraMatriz * vec4( vGPosMundo + nMundo * gSombraNormal, 1.0 ) ).xyz;
  float b0 = gSombraBorda( s0 );
  if ( gSombraCascatas < 1.5 ) {
    if ( b0 <= 0.0 ) return 1.0;
    w = smoothstep( 0.0, 0.05, b0 );
    return gSombraPcf( s0, 0.0, 1.0 );
  }
  vec3 s1 = ( gSombraMatriz1 * vec4( vGPosMundo + nMundo * gSombraNormal1, 1.0 ) ).xyz;
  float b1 = gSombraBorda( s1 );
  float w1 = b1 > 0.0 ? smoothstep( 0.0, 0.05, b1 ) : 0.0;
  float w0 = b0 > 0.0 ? smoothstep( 0.0, 0.08, b0 ) : 0.0;
  float a = w1 * ( 1.0 - w0 );
  w = a + w0;
  if ( w <= 0.0 ) return 1.0;
  float v1 = a > 0.0 ? gSombraPcf( s1, 1.0, 2.0 ) : 1.0;
  float v0 = w0 > 0.0 ? gSombraPcf( s0, 0.0, 2.0 ) : 1.0;
  return ( v1 * a + v0 * w0 ) / w;
}

// sombra das nuvens no chão: a nuvem a ~1.500 m projetada pela direção do sol (desvio = sol.xz / sol.y)
float gNuvemSombra() {
  if ( gNuvemParams.y <= 0.0 ) return 1.0;
  vec2 xz = vGPosMundo.xz + ( 1500.0 - vGPosMundo.y ) * gNuvemDesloc.zw;
  float n = texture( gNuvemMapa, xz * gNuvemParams.x + gNuvemDesloc.xy ).r;
  return 1.0 - gNuvemParams.y * smoothstep( gNuvemParams.z, gNuvemParams.z + 0.12, n );
}
`;

/**
 * Trecho 'sol' (dentro do laço da luz direcional: multiplica a cor da luz). A sombra de perto vale onde as cascatas
 * cobrem; fora delas, a de longe (quando o material liga o gancho 'sombraLonge'); a força cai com a luz.
 */
export const SOMBRA_SOL = /* glsl */ `
{
  vec3 gSN = inverseTransformDirection( geometryNormal, viewMatrix );
  float gSW = 0.0;
  float gSL = gSombraPerto( gSN, gSW );
#ifdef G_SOMBRALONGE
  gSL = mix( gSombraLonge( gSN ), gSL, gSW );
#endif
  directLight.color *= mix( 1.0, gSL, gSombraForca ) * gNuvemSombra();
}
`;

/**
 * 'sombraLonge': um fragmento em (x, y, z) está na sombra quando y fica abaixo da altura da sombra do campo, com o
 * viés e a meia penumbra em metros (gCampoVies); o ponto anda 3/4 de célula pela normal (a parede lê a rua na frente
 * dela, não o próprio telhado). Fora do mapa, sem sombra.
 */
export const SOMBRA_LONGE_PARS = /* glsl */ `
${CAMPO_PARS}
uniform float gCampoT;
uniform vec2 gCampoVies;
float gSombraLonge( vec3 nW ) {
  if ( gCampoLigado < 0.5 ) return 1.0;
  vec2 uv = ( vGPosMundo.xz + nW.xz * ( 0.75 * gCampoParams.w ) - gCampoParams.xy ) * gCampoParams.z;
  if ( uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ) return 1.0;
  vec4 c = texture( gCampoMapa, uv );
  float s = mix( c.r, c.g, gCampoT ) - gCampoVies.x;
  return smoothstep( s - gCampoVies.y, s + gCampoVies.y, vGPosMundo.y + nW.y * 0.4 );
}
`;

/**
 * 'hao': oclusão do céu pelo campo de alturas. B é a visibilidade no chão da vizinhança (A); ela vale inteira no chão
 * e no pé das paredes e some com a altura acima desse chão: rápido nas faces de cima (o telhado não suja) e ao longo
 * de uma altura que cresce com a oclusão nas paredes (o fundo de uma rua estreita entre torres fica escuro até alto).
 * gHaoParams: força, visibilidade mínima, parte que vale na luz direta, ligado.
 */
export const HAO_PARS = /* glsl */ `
${CAMPO_PARS}
uniform vec4 gHaoParams;
float gHao( vec3 nW ) {
  if ( gHaoParams.w < 0.5 || gCampoLigado < 0.5 ) return 1.0;
  vec4 c = gCampo( vGPosMundo.xz + nW.xz * ( 0.6 * gCampoParams.w ) );
  float z = max( 0.0, vGPosMundo.y - c.a );
  float v = max( c.b, gHaoParams.y );
  float cima = smoothstep( 0.5, 0.8, nW.y );
  float alt = mix( mix( 6.0, 30.0, 1.0 - v ), 2.2, cima );
  float ao = mix( v, 1.0, smoothstep( 0.6 * cima, alt, z ) );
  // junta da parede com o chão (o vinco que o campo de 4 a 8 m não resolve): o pé da parede assenta no chão
  ao *= mix( 1.0, mix( 0.8, 1.0, smoothstep( 0.0, 2.5, z ) ), ( 1.0 - cima ) * step( abs( nW.y ), 0.5 ) );
  return mix( 1.0, ao, gHaoParams.x );
}
`;

/** Trecho 'indireta' do HAO (depois do aomap_fragment): a luz do ambiente e um pouco da direta. */
export const HAO_INDIRETA = /* glsl */ `
{
  float gAo = gHao( G_NORMAL_MUNDO );
  reflectedLight.indirectDiffuse *= gAo;
  reflectedLight.indirectSpecular *= mix( 1.0, gAo, 0.6 );
  reflectedLight.directDiffuse *= mix( 1.0, gAo, gHaoParams.z );
}
`;

/** Passos da marcha da sombra de longe e o alcance: de 4 m a 48 m, cerca de 900 m ao todo. */
export const MARCHA = Object.freeze({ passos: 48, primeiro: 4, ultimo: 48 });

/** Distância andada até o passo k (1 a MARCHA.passos), igual à do GLSL. */
export function distanciaDaMarcha(k) {
  let t = 0;
  for (let i = 0; i < k; i++) {
    const f = i / (MARCHA.passos - 1);
    t += MARCHA.primeiro + (MARCHA.ultimo - MARCHA.primeiro) * f * f;
  }
  return t;
}

/**
 * Nos passos maiores que isto (em células do campo), a marcha também lê a célula do nível 1 (o maior de 2 x 2
 * células) em cada amostra: a torre fina entre duas amostras não some, e a sombra engorda no máximo uma célula do
 * nível 1 (16 m no Média, 8 m no Alta), em vez de virar um borrão nos passos longos.
 */
export const PASSO_NIVEL1 = 2;

/**
 * Passe do campo (uma chamada por ladrilho, com viewport e tesoura no alvo): cada texel é uma célula do mapa. A
 * marcha lê o campo bilinear no fim de cada passo e no meio dele e, nos passos longos, também a célula do nível 1 que
 * contém cada uma dessas amostras (texelFetch): medido no campo da cidade sintética às 17h30, fica a menos de 1% da
 * marcha fina de 2 m, e a torre de 8 m a 400 m não some.
 * uModo 0 (completo): R e G marcham para o sol nas duas direções, B é a visibilidade do céu no chão (o menor dos 9
 * vizinhos) e A esse chão. uModo 1 (passo do sol): R copia o G do campo anterior, G marcha para a direção nova, B e A
 * copiam. uDirA e uDirB: xy a direção do sol no chão (unitária), z a tangente da elevação, w 1 se há sol. uHMax: o
 * maior do campo na região que a marcha alcança (com folga para a meia precisão); a marcha para quando nem ele, mais à
 * frente, subiria a sombra (com o sol alto, antes da metade dos passos; o resultado é o mesmo).
 */
export const CAMPO_PASSE = /* glsl */ `
uniform sampler2D uAlturas;
uniform sampler2D uAnterior;
uniform float uN;
uniform float uPassoM;
uniform float uTam;
uniform vec4 uDirA;
uniform vec4 uDirB;
uniform float uModo;
uniform float uHMax;
float gH( vec2 uv ) { return textureLod( uAlturas, uv, 0.0 ).r; }
// a célula do nível 1 (o maior de 2 x 2 células) que contém o ponto
float gH1( vec2 uv ) {
  ivec2 n = textureSize( uAlturas, 1 );
  return texelFetch( uAlturas, clamp( ivec2( uv * vec2( n ) ), ivec2( 0 ), n - 1 ), 1 ).r;
}
float marchar( vec2 uv, vec4 d ) {
  if ( d.w < 0.5 ) return -1.0e4;
  float s = -1.0e4;
  float t = 0.0;
  vec2 duv = d.xy / uTam;
  for ( int k = 0; k < ${MARCHA.passos}; k ++ ) {
    float f = float( k ) / ${MARCHA.passos - 1}.0;
    float p = ${MARCHA.primeiro}.0 + ${MARCHA.ultimo - MARCHA.primeiro}.0 * f * f;
    t += p;
    vec2 q = uv + duv * t;
    if ( q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0 ) break;
    float tm = t - 0.5 * p;
    vec2 m = uv + duv * tm;
    float hq = gH( q );
    float hm = gH( m );
    if ( p > ${PASSO_NIVEL1}.0 * uPassoM ) {
      hq = max( hq, gH1( q ) );
      hm = max( hm, gH1( m ) );
    }
    s = max( s, max( hq - t * d.z, hm - tm * d.z ) );
    if ( uHMax - t * d.z <= s ) break;
  }
  return s;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uN;
  if ( uModo > 0.5 ) {
    vec4 a = texelFetch( uAnterior, ivec2( gl_FragCoord.xy ), 0 );
    gl_FragColor = vec4( a.g, marchar( uv, uDirB ), a.b, a.a );
    return;
  }
  float tx = 1.0 / uN;
  float h0 = gH( uv );
  float hs[ 8 ];
  float chao = h0;
  for ( int i = 0; i < 8; i ++ ) {
    float a = float( i ) * 0.7853981633974483;
    hs[ i ] = gH( uv + vec2( cos( a ), sin( a ) ) * tx );
    chao = min( chao, hs[ i ] );
  }
  float soma = 0.0;
  for ( int i = 0; i < 8; i ++ ) {
    float a = float( i ) * 0.7853981633974483;
    vec2 dd = vec2( cos( a ), sin( a ) ) * tx;
    float m = max( 0.0, ( hs[ i ] - chao ) / uPassoM );
    m = max( m, ( gH( uv + dd * 2.0 ) - chao ) / ( 2.0 * uPassoM ) );
    m = max( m, ( gH( uv + dd * 4.0 ) - chao ) / ( 4.0 * uPassoM ) );
    m = max( m, ( gH( uv + dd * 8.0 ) - chao ) / ( 8.0 * uPassoM ) );
    soma += m * inversesqrt( 1.0 + m * m );
  }
  gl_FragColor = vec4( marchar( uv, uDirA ), marchar( uv, uDirB ), 1.0 - soma / 8.0, chao );
}
`;

export function registrar() {}
