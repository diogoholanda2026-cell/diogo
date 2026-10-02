// Shaders das obras da cidade (R4b, desenho do render 12.1): o esqueleto, as peças do canteiro, o andaime e a tela, a
// grua de torre que sobe com os andares e a móvel, pelo uniforme de tique sobre a textura de obra de predios.js. Vem
// sob demanda (import dinâmico de mundo/obras.js na criação do render: chega antes do aquecimento dos programas e fica
// fora do pacote principal, A1). Os materiais e as peças ficam em mundo/obras.js.
import { OBRA_GLSL, BITS_GLSL } from './fachada.glsl.js';

/** Comum: a obra do prédio pela tabela e a textura de obra (predios.js). */
const COMUM_VERTICE = /* glsl */ `
attribute vec4 aObra;          // idx do prédio, tipo (ou modelo), hash 0..1, parâmetro
uniform highp sampler2D gPredTab;
uniform highp sampler2D gPredObra;
uniform float gTique;
uniform vec3 gCorHolding;
flat varying vec4 vObra;
varying vec3 vFace;
${BITS_GLSL}
${OBRA_GLSL}
// a obra do prédio: x progresso, y cota da base, z altura, w (0 sem obra, 1 obra nova, 2 reforma de nível)
vec4 gDadosObra( float idx, out bool holding ) {
  uint i = uint( idx + 0.5 );
  ivec2 t = ivec2( int( i % 512u ), int( i / 512u ) );
  uint b = uint( texelFetch( gPredTab, t, 0 ).g * 255.0 + 0.5 );
  holding = ( b & B_HOLDING ) != 0u;
  if ( ( b & B_OBRA ) == 0u ) return vec4( 0.0 );
  vec4 ob = texelFetch( gPredObra, t, 0 );
  return vec4( gProgressoObra( ob ), ob.b, ob.a, ( b & B_NIVEL ) != 0u ? 2.0 : 1.0 );
}
vec2 gGira( vec2 v, float a ) { float c = cos( a ); float s = sin( a ); return vec2( c * v.x + s * v.y, -s * v.x + c * v.y ); }
`;

const COMUM_FRAGMENTO = /* glsl */ `
flat varying vec4 vObra;
varying vec3 vFace;
uniform vec3 gCorHolding;
float gObraRug = 0.85;
float gObraMet = 0.0;
vec3 gLinC( vec3 c ) { return pow( c / 255.0, vec3( 2.2 ) ); }
float gIntO( float x, float a, float b ) { return floor( x ) * ( b - a ) + clamp( fract( x ), a, b ) - a; }
float gPulsoO( float x, float a, float b, float dx ) {
  float w = max( dx, 1e-4 );
  return clamp( ( gIntO( x + 0.5 * w, a, b ) - gIntO( x - 0.5 * w, a, b ) ) / w, 0.0, 1.0 );
}
float gLinhaO( float x, float l, float dx ) { return gPulsoO( x + 0.5 * l, 0.0, l, dx ); }
`;

/** Caixas: o esqueleto (pilares e lajes até o topo do esqueleto), as peças do canteiro e a massa (só na sombra). */
const CAIXAS_VERTICE = /* glsl */ `
{
  bool gHold;
  vec4 gD = gDadosObra( aObra.x, gHold );
  float gT = aObra.y;
  float gP = gD.x;
  bool gNova = gD.w > 0.5 && gD.w < 1.5;
  float gTopoEsq = gD.y + gAlturaEsqueleto( gP, gD.z );
  float gY0 = instanceMatrix[ 3 ][ 1 ];
  float gHh = length( instanceMatrix[ 1 ].xyz );
  bool gVer = gD.w > 0.5;
  float gTopo = 1e9;
  if ( gT < 0.5 ) { gVer = gVer && gNova && gP > OBRA_F1; gTopo = gTopoEsq; }
  else if ( gT < 1.5 ) gVer = gVer && gNova && gP > OBRA_F1 && gTopoEsq >= gY0 + gHh - 0.01;
  else if ( gT < 2.5 ) gVer = gVer && gNova;
  else if ( gT < 3.5 ) gVer = gVer && gNova && gP < OBRA_F2;
  else if ( gT < 4.5 ) gVer = gVer && gNova && gP > OBRA_F0 && gP < OBRA_F2;
  else if ( gT > 5.5 ) {
#ifdef OBRA_SOMBRA
    gVer = gVer && gNova;
    gTopo = gD.y + gAlturaPronta( gP, gD.z );
#else
    gVer = false;
#endif
  }
  if ( gTopo < 1e8 ) {
    gVer = gVer && gTopo > gY0 + 0.05;
    if ( position.y > 0.5 ) transformed.y = min( 1.0, ( gTopo - gY0 ) / gHh );
  }
  if ( !gVer ) transformed = vec3( 0.0 );
  vObra = vec4( gT, gHold ? 1.0 : 0.0, aObra.z, aObra.w );
  vec3 gE = vec3( length( instanceMatrix[ 0 ].xyz ), gHh, length( instanceMatrix[ 2 ].xyz ) );
  vFace = vec3( abs( normal.x ) > 0.5 ? position.z * gE.z : position.x * gE.x, transformed.y * gHh, abs( normal.y ) > 0.5 ? 1.0 : 0.0 );
}
`;

const CAIXAS_COR = /* glsl */ `
{
  float gT = vObra.x;
  float gK = vObra.w;
  float gH = vObra.z;
  vec3 c = vec3( 0.48, 0.46, 0.43 );
  if ( gT < 1.5 ) {
    // concreto novo, com a marca da fôrma de madeira a cada 1,2 m e manchas de cura
    float forma = gLinhaO( fract( vFace.x / 1.2 + 0.5 ) - 0.5, 0.03, fwidth( vFace.x ) / 1.2 );
    c = vec3( 0.4, 0.39, 0.37 ) * ( 0.9 + 0.12 * gH ) * ( 1.0 - 0.15 * forma );
    gObraRug = 0.9;
  } else if ( gT < 2.5 ) {
    if ( gK < 0.5 ) {
      // contêiner do escritório da obra: chapa ondulada, branco ou azul, porta e janela
      c = gH < 0.55 ? vec3( 0.6, 0.6, 0.58 ) : vec3( 0.06, 0.13, 0.26 );
      c *= 0.9 + 0.1 * cos( vFace.x * 20.94 );
      float jan = gPulsoO( vFace.x * 0.25 + 0.5, 0.55, 0.8, fwidth( vFace.x ) * 0.25 ) * gPulsoO( vFace.y / 2.6, 0.45, 0.8, fwidth( vFace.y ) / 2.6 );
      c = mix( c, vec3( 0.03, 0.035, 0.04 ), jan * ( 1.0 - vFace.z ) );
      gObraMet = 0.3;
      gObraRug = 0.55;
    } else {
      // caçamba de entulho
      c = gH < 0.5 ? vec3( 0.5, 0.25, 0.03 ) : vec3( 0.32, 0.33, 0.12 );
      if ( vFace.z > 0.5 ) c = vec3( 0.22, 0.19, 0.16 );
      gObraMet = 0.35;
      gObraRug = 0.6;
    }
  } else if ( gT < 3.5 ) {
    // pilha de tijolo (paletes) ou de areia
    c = gK < 0.5 ? vec3( 0.36, 0.15, 0.08 ) * ( 0.85 + 0.2 * step( 0.5, fract( vFace.y / 0.2 ) ) ) : vec3( 0.48, 0.4, 0.27 );
  } else if ( gT < 4.5 ) {
    // betoneira: cabine branca e o balão laranja
    c = gK < 0.5 ? vec3( 0.62, 0.62, 0.6 ) : vec3( 0.6, 0.27, 0.04 );
    gObraMet = 0.25;
    gObraRug = 0.45;
  } else if ( gT < 5.5 ) {
    if ( gK < 0.5 ) {
      // tapume de chapa trapezoidal pintada, com a faixa da construtora (a cor da Holding na obra dela)
      vec3 base = vObra.y > 0.5 ? gLinC( gCorHolding ) : gH < 0.6 ? vec3( 0.62, 0.62, 0.6 ) : vec3( 0.05, 0.15, 0.08 );
      float nerv = gPulsoO( vFace.x / 0.25, 0.0, 0.2, fwidth( vFace.x ) / 0.25 );
      c = base * ( 1.0 - 0.14 * nerv );
      float faixa = gPulsoO( vFace.y / 2.2, 0.68, 0.8, fwidth( vFace.y ) / 2.2 );
      c = mix( c, vObra.y > 0.5 ? vec3( 0.62 ) : vec3( 0.03, 0.09, 0.24 ), faixa );
      c *= mix( 0.75, 1.0, smoothstep( 0.0, 0.5, vFace.y ) );
      gObraMet = 0.35;
      gObraRug = 0.5;
    } else if ( gK < 1.5 ) {
      // placa da obra: fundo branco, faixa azul em cima e o bloco do logotipo
      float az = step( 0.72, vFace.y / 2.0 );
      float logo = gPulsoO( vFace.x / 3.0 + 0.5, 0.06, 0.32, fwidth( vFace.x ) / 3.0 ) * gPulsoO( vFace.y / 2.0, 0.1, 0.62, fwidth( vFace.y ) / 2.0 );
      c = mix( vec3( 0.7 ), vObra.y > 0.5 ? gLinC( gCorHolding ) : vec3( 0.02, 0.07, 0.25 ), max( az, logo * 0.85 ) );
      if ( vFace.z > 0.5 ) c = vec3( 0.3 );
      gObraRug = 0.6;
    } else {
      c = vec3( 0.18 );
      gObraMet = 0.6;
      gObraRug = 0.5;
    }
  }
  diffuseColor.rgb = c;
}
`;

/** Cascas: o andaime das obras baixas e a tela de proteção das altas (e as da reforma), pela altura do esqueleto. */
const CASCAS_VERTICE = /* glsl */ `
{
  bool gHold;
  vec4 gD = gDadosObra( aObra.x, gHold );
  float gT = aObra.y;
  float gP = gD.x;
  float gB = gD.y;
  float gHp = gD.z;
  float gEsq = gAlturaEsqueleto( gP, gHp );
  float gA = gB;
  float gZ = gB;
  if ( gD.w > 0.5 && gD.w < 1.5 ) {
    if ( gT < 0.5 ) { if ( gP > OBRA_F1 ) { gA = gB - 0.2; gZ = gB + min( gHp, gEsq ) + 1.2; } }
    else if ( gP > OBRA_F2 ) {
      // a tela cobre a frente de trabalho: da fachada pronta até uns três andares acima (o esqueleto nu no alto)
      gA = gB + max( gAlturaPronta( gP, gHp ), 0.0 );
      gZ = min( gB + gEsq + 0.8, gA + 10.0 );
    }
  } else if ( gD.w > 1.5 ) {
    // reforma de nível: a tela cobre o prédio e sai de baixo para cima no fim
    gZ = gB + gHp + 1.0;
    gA = gB + 2.0 + ( gHp - 2.0 ) * smoothstep( 0.6, 1.0, gP );
  }
  // cada casca fica na faixa do seu volume (a instância vai da base ao topo dele): a do pódio não sobe com a torre
  float gHh = length( instanceMatrix[ 1 ].xyz );
  float gIb = instanceMatrix[ 3 ][ 1 ];
  gA = max( gA, gIb - 0.2 );
  gZ = min( gZ, gIb + gHh + 1.2 );
  if ( gZ - gA < 0.3 ) transformed = vec3( 0.0 );
  else transformed.y = ( mix( gA, gZ, position.y ) - gIb ) / gHh;
  vec3 gE = vec3( length( instanceMatrix[ 0 ].xyz ), gHh, length( instanceMatrix[ 2 ].xyz ) );
  vObra = vec4( gT, gHold ? 1.0 : 0.0, aObra.z, 0.0 );
  vFace = vec3( abs( normal.x ) > 0.5 ? position.z * gE.z : position.x * gE.x, mix( gA, gZ, position.y ) - gB, 0.0 );
}
`;

const CASCAS_COR = /* glsl */ `
{
  vec2 gU = vFace.xy;
  vec2 gDd = max( fwidth( gU ), vec2( 1e-4 ) );
  float gA = 0.0;
  vec3 c = vec3( 0.4 );
  if ( vObra.x < 0.5 ) {
    // andaime tubular: montantes e travessas a cada 2 m, o piso de tábua em cada nível e diagonais alternadas
    vec2 q = gU / 2.0;
    vec2 dq = gDd / 2.0;
    float mont = gLinhaO( fract( q.x + 0.5 ) - 0.5, 0.03, dq.x );
    float trav = gLinhaO( fract( q.y + 0.5 ) - 0.5, 0.03, dq.y );
    float tabua = gPulsoO( q.y, 0.0, 0.11, dq.y );
    float diag = gLinhaO( fract( q.x - q.y + 0.5 ) - 0.5, 0.025, dq.x + dq.y ) * step( 0.5, fract( floor( q.x ) * 0.5 ) );
    gA = max( max( mont, trav ), max( tabua, diag ) );
    c = tabua > max( mont, trav ) ? vec3( 0.3, 0.2, 0.1 ) : vec3( 0.36, 0.37, 0.38 );
    gObraMet = tabua > 0.5 ? 0.0 : 0.6;
    gObraRug = tabua > 0.5 ? 0.9 : 0.45;
    // de longe o andaime vira uma trama
    gA = mix( gA, 0.42, smoothstep( 0.25, 0.8, max( dq.x, dq.y ) * 10.0 ) );
  } else {
    // tela de proteção (polietileno verde ou azul): trama semitransparente (as lajes e os pilares aparecem atrás, como
    // na tela fachadeira de verdade, não uma caixa de cor), rolos de 1,6 m com tom próprio, emendas e a borda de cada
    // laje mais fechadas
    c = vObra.z < 0.6 ? vec3( 0.045, 0.12, 0.065 ) : vec3( 0.035, 0.075, 0.17 );
    float rolo = floor( gU.x / 1.6 );
    c *= 0.82 + 0.3 * fract( sin( rolo * 12.9898 + vObra.z * 78.233 ) * 43758.5453 );
    float emenda = gLinhaO( fract( gU.x / 1.6 + 0.5 ) - 0.5, 0.04, gDd.x / 1.6 );
    float laje = gLinhaO( fract( gU.y / 3.0 + 0.5 ) - 0.5, 0.06, gDd.y / 3.0 );
    float fecha = max( emenda, laje );
    c *= 1.0 - 0.35 * fecha;
    gA = mix( 0.6, 0.95, fecha );
    gObraRug = 0.8;
  }
  if ( gA < 0.03 ) discard;
  diffuseColor = vec4( c, gA );
}
`;

/** Gruas: a de torre (o mastro sobe com o esqueleto, a lança gira) e a móvel (o braço mira o topo da obra). */
const GRUAS_PARS = /* glsl */ `
attribute float aParte;
attribute float aModelo;
attribute vec4 aTrel;
`;

const GRUAS_VERTICE = /* glsl */ `
{
  bool gHold;
  vec4 gD = gDadosObra( aObra.x, gHold );
  float gP = gD.x;
  float gHp = gD.z;
  float gL = aObra.w;
  float gFase = aObra.z * 6.2832;
  float gEsq = gAlturaEsqueleto( gP, gHp );
  bool gVer = gD.w > 0.5 && abs( aModelo - aObra.y ) < 0.5;
  vec3 gPos = transformed;
  float gAo = 0.0;
  if ( aObra.y < 0.5 ) {
    gVer = gVer && ( gD.w > 1.5 || gP > OBRA_F0 );
    float gHm = max( 14.0, ( gD.w > 1.5 ? gHp : gEsq ) + 7.0 );
    if ( aParte < 0.5 ) {
      gPos.y *= gHm;
      gAo = gPos.y;
    } else {
      float gGiro = gFase + 0.9 * sin( gTique * 0.031 + gFase ) + 0.5 * sin( gTique * 0.013 + 2.0 * gFase );
      // a lança: de 0,8 m (a face do mastro) até L
      if ( aParte > 1.5 && aParte < 2.5 ) gPos.x = 0.8 + gPos.x * ( gL - 0.8 );
      gAo = aTrel.z > 1.5 ? gPos.x : gPos.y + gHm;
      if ( aParte > 2.5 && aParte < 3.5 ) {
        // o cabo e o gancho: o carrinho anda na lança e o gancho desce até a frente de trabalho
        float gCarro = gL * ( 0.3 + 0.25 * ( 1.0 + sin( gTique * 0.047 + 3.0 * gFase ) ) );
        float gDesce = max( 3.0, gHm - max( gEsq, 2.0 ) - 1.0 );
        gPos.x += gCarro;
        if ( gPos.y > -0.95 ) gPos.y *= gDesce; else gPos.y -= gDesce - 1.0;
      }
      gPos.xz = gGira( gPos.xz, gGiro );
      gPos.y += gHm;
    }
  } else {
    gVer = gVer && gD.w < 1.5 && gP > OBRA_F1;
    if ( aParte > 5.5 ) {
      // braço telescópico: comprimento L, eleva até o topo da obra e gira um pouco
      float gAlvo = max( gEsq, 4.0 ) + 4.0;
      float gEl = clamp( atan( gAlvo - 3.2, gL * 0.75 ), 0.35, 1.25 );
      vec2 gXy = vec2( gPos.x * gL, gPos.y );
      gAo = gXy.x;
      gXy = vec2( gXy.x * cos( gEl ) - gXy.y * sin( gEl ), gXy.x * sin( gEl ) + gXy.y * cos( gEl ) );
      gPos = vec3( gXy.x - 1.3, gXy.y + 3.4, gPos.z );
      gPos.xz = gGira( gPos.xz + vec2( 1.3, 0.0 ), 0.25 * sin( gTique * 0.04 + gFase ) ) - vec2( 1.3, 0.0 );
    }
  }
  if ( !gVer ) gPos = vec3( 0.0 );
  transformed = gPos;
  vObra = vec4( aTrel.w, gHold ? 1.0 : 0.0, aObra.z, aTrel.z );
  vFace = vec3( aTrel.x, gAo, aTrel.y );
}
`;

const GRUAS_COR = /* glsl */ `
{
  float gC = vObra.x;
  vec3 c = vObra.y > 0.5 ? gLinC( gCorHolding ) : vObra.z < 0.7 ? vec3( 0.6, 0.38, 0.015 ) : vec3( 0.58, 0.58, 0.56 );
  float gA = 1.0;
  if ( vObra.w > 0.5 ) {
    // treliça: as cordas nas quinas, as travessas a cada 1,6 m e a diagonal, filtradas pela área do pixel
    vec2 d = max( fwidth( vFace.xy ), vec2( 1e-4 ) );
    float m = max( vFace.z, 0.1 );
    float corda = gPulsoO( abs( vFace.x ) / m, 0.82, 1.0, d.x / m );
    float s = vFace.y / 1.6;
    float trav = gLinhaO( fract( s + 0.5 ) - 0.5, 0.07, d.y / 1.6 );
    float diag = gLinhaO( fract( s - ( vFace.x / m ) * 0.5 + 0.5 ) - 0.5, 0.07, ( d.x / m + d.y / 1.6 ) );
    gA = max( corda, max( trav, diag ) );
    gA = mix( gA, 0.6, smoothstep( 0.3, 1.0, d.x / m ) );
    if ( gA < 0.03 ) discard;
    gObraMet = 0.35;
    gObraRug = 0.5;
  }
  if ( gC > 0.5 && gC < 1.5 ) { c = vec3( 0.42, 0.41, 0.39 ); gObraMet = 0.0; gObraRug = 0.9; }
  else if ( gC > 1.5 && gC < 2.5 ) { c = vec3( 0.62, 0.62, 0.6 ); gObraRug = 0.4; }
  else if ( gC > 3.5 ) { c = vec3( 0.02 ); gObraMet = 0.5; gObraRug = 0.5; }
  diffuseColor = vec4( c, gA );
}
`;

/** Os trechos de cada variante (caixas, cascas, gruas) e os comuns. */
export const GLSL_OBRA = Object.freeze({
  comumVertice: COMUM_VERTICE,
  comumFragmento: COMUM_FRAGMENTO,
  caixas: { pars: '', vertice: CAIXAS_VERTICE, cor: CAIXAS_COR },
  cascas: { pars: '', vertice: CASCAS_VERTICE, cor: CASCAS_COR },
  gruas: { pars: GRUAS_PARS, vertice: GRUAS_VERTICE, cor: GRUAS_COR },
});

export function registrar() {}
