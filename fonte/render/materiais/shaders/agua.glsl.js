// GLSL do mar, do rio e da lagoa (desenho do render 3.4): uma família de material, sem redesenhar a cena. A
// profundidade sai da grade de alturas (a mesma leitura do terreno); o fundo visto pela água é o mapa de cor assado do
// terreno no mesmo ponto, escurecido pela absorção (Beer) da água de cada tipo; ondas por dois mapas de normal
// rolando; espuma na arrebentação (faixas que andam para a praia) e na linha d'água; reflexo do céu pelo IBL com
// Fresnel (sem IBL, um céu analítico com a cor do horizonte). Fora dos índices: quem usa importa. Tudo em highp.
import { GLSL_TER_COMUM, GLSL_TER_ALTURA, PALETA_CHAO } from './terreno.glsl.js';
import { vec3Linear } from './folha.glsl.js';

/** Óptica de cada água: absorção por metro (rgb), cor do espalhamento no fundo (linear), rugosidade e força das ondas. */
/** Fundo de lodo do rio e da lagoa (linear): a areia do assado é só do mar. */
export const LODO = [0.045, 0.04, 0.03];

export const AGUAS = Object.freeze({
  mar: { tipo: 0, absorcao: [0.42, 0.11, 0.075], espalha: [0.017, 0.066, 0.072], rug: 0.09, ondas: 0.16 },
  rio: { tipo: 1, absorcao: [1.3, 1.05, 0.95], espalha: [0.085, 0.078, 0.048], rug: 0.1, ondas: 0.12 },
  lagoa: { tipo: 2, absorcao: [0.95, 0.8, 0.72], espalha: [0.016, 0.022, 0.016], rug: 0.04, ondas: 0.06 },
});


const v3 = (a) => `vec3( ${a.map((x) => x.toFixed(4)).join(', ')} )`;

export const GLSL_AGUA_VERTICE = {
  pars: /* glsl */ `
attribute float aAgua;
attribute vec2 aFluxo;
flat varying float vAgua;
varying vec2 vFluxo;
`,
  main: /* glsl */ `
vAgua = aAgua;
vFluxo = aFluxo;
`,
};

export const GLSL_AGUA_FRAGMENTO = {
  pars: /* glsl */ `
${GLSL_TER_COMUM}
${GLSL_TER_ALTURA}
uniform highp sampler2D uTerCor;
uniform highp sampler2D uAguaOndas;
uniform float uAguaTempo;
uniform vec3 uAguaCeuH;   // cor do céu no horizonte (sem IBL)
uniform vec3 uAguaCeuZ;   // cor do céu no zênite (sem IBL)
uniform float uTerMascara;
flat varying float vAgua;
varying vec2 vFluxo;

vec3 aguaNormal;
float aguaRug;
float aguaEspuma;
`,
  // no lugar de map_fragment
  cor: /* glsl */ `
vec2 aW = vGPosMundo.xz;
float aDist = length( vGPosMundo - cameraPosition );
float aFundo = terAltura( aW );
float aProf = max( vGPosMundo.y - aFundo, 0.0 );
vec2 aUV = terUVMapa( aW );
bool aDentro = all( greaterThanEqual( aUV, vec2( 0.0 ) ) ) && all( lessThanEqual( aUV, vec2( 1.0 ) ) );
vec4 aDados = texture( uTerDados, terUVDados( aW ) );
float aTerra = aDentro ? terAgua( aDados.a ).x : 255.0;
vec3 aLeito = texture( uTerCor, aUV ).rgb;
aLeito = aDentro ? aLeito * aLeito : ${vec3Linear(PALETA_CHAO[5].cor)} * 0.8;
if ( vAgua > 0.5 ) aLeito = ${v3(LODO)};
// ondas: dois mapas rolando em direções diferentes, e rajadas de vento (manchas de 180 m)
vec4 aVento = texture( uTerRuido, aW * ( 1.0 / 180.0 ) + uAguaTempo * vec2( 0.0021, 0.0013 ) );
vec4 aQuebra = texture( uTerRuido, aW * ( 1.0 / 47.0 ) + uAguaTempo * vec2( 0.006, -0.004 ) );
vec2 aCorre = vAgua > 0.5 && vAgua < 1.5 ? vFluxo * uAguaTempo * 0.35 : vec2( 0.0 );
vec3 aN1 = texture( uAguaOndas, aW * ( 1.0 / 61.0 ) + uAguaTempo * vec2( 0.008, 0.005 ) - aCorre / 61.0 ).xyz;
vec3 aN2 = texture( uAguaOndas, mat2( 0.6, -0.8, 0.8, 0.6 ) * aW * ( 1.0 / 19.0 ) - uAguaTempo * vec2( 0.011, 0.019 ) - aCorre / 19.0 ).xyz;
vec3 aSigma;
vec3 aEspalha;
float aRugBase;
float aForca;
if ( vAgua < 0.5 ) {
  aSigma = ${v3(AGUAS.mar.absorcao)}; aEspalha = ${v3(AGUAS.mar.espalha)}; aRugBase = ${AGUAS.mar.rug.toFixed(3)}; aForca = ${AGUAS.mar.ondas.toFixed(3)};
} else if ( vAgua < 1.5 ) {
  aSigma = ${v3(AGUAS.rio.absorcao)}; aEspalha = ${v3(AGUAS.rio.espalha)}; aRugBase = ${AGUAS.rio.rug.toFixed(3)}; aForca = ${AGUAS.rio.ondas.toFixed(3)};
} else {
  aSigma = ${v3(AGUAS.lagoa.absorcao)}; aEspalha = ${v3(AGUAS.lagoa.espalha)}; aRugBase = ${AGUAS.lagoa.rug.toFixed(3)}; aForca = ${AGUAS.lagoa.ondas.toFixed(3)};
}
// absorção na ida e na volta: o fundo some com a profundidade, fica a cor do espalhamento
vec3 aTrans = exp( -aSigma * aProf * 1.6 );
vec3 aCor = aLeito * aTrans + aEspalha * ( 1.0 - aTrans );
// espuma: faixas da arrebentação andando para a praia e a lavagem na linha d'água (só no mar; fraca na lagoa)
float aFase = fract( aTerra / 21.0 + uAguaTempo * 0.085 + aVento.x * 0.6 );
float aCrista = smoothstep( 0.8, 0.95, aFase ) * ( 1.0 - smoothstep( 0.95, 1.0, aFase ) );
float aZona = exp( -aTerra / 26.0 ) * smoothstep( 0.2, 1.2, aProf );
float aEsp = aCrista * aZona * smoothstep( 0.38, 0.72, aQuebra.w * 0.75 + aVento.w * 0.45 ) * step( vAgua, 0.5 );
aEsp += ( 1.0 - smoothstep( 0.04, 0.4, aProf ) ) * ( 0.35 + 0.65 * aQuebra.z ) * smoothstep( 0.2, 0.5, aVento.w + aQuebra.x * 0.4 );
// rio: a espuma dele (correnteza) é da R2b; lagoa: só um fio na margem
aEsp *= vAgua < 0.5 ? 1.0 : vAgua < 1.5 ? 0.0 : 0.25;
aguaEspuma = clamp( aEsp, 0.0, 1.0 );
float aLonge = 1.0 - smoothstep( 500.0, 5000.0, aDist );
float aF = aForca * ( 0.6 + 0.7 * aVento.y ) * ( 0.25 + 0.75 * aLonge );
vec2 aInc = ( aN1.xy * 2.0 - 1.0 ) * 0.65 + ( aN2.xy * 2.0 - 1.0 ) * 0.5 * ( 0.4 + 0.6 * aVento.z );
aguaNormal = normalize( vec3( aInc.x * aF, 1.0, aInc.y * aF ) );
aguaNormal = normalize( mix( aguaNormal, vec3( 0.0, 1.0, 0.0 ), aguaEspuma * 0.7 ) );
aguaRug = mix( aRugBase * ( 0.7 + 0.8 * aVento.y ) + 0.06 * smoothstep( 300.0, 3000.0, aDist ), 0.75, aguaEspuma );
diffuseColor.rgb = mix( aCor, vec3( 0.74, 0.76, 0.75 ), aguaEspuma * 0.9 );
`,
  rugosidade: /* glsl */ `
float roughnessFactor = aguaRug;
`,
  normal: /* glsl */ `
normal = normalize( ( viewMatrix * vec4( aguaNormal, 0.0 ) ).xyz );
`,
  // sem IBL: reflexo de um céu analítico com o Fresnel de Schlick (F0 = 0,02)
  indireta: /* glsl */ `
#ifndef USE_ENVMAP
{
  vec3 aV = normalize( cameraPosition - vGPosMundo );
  vec3 aR = reflect( -aV, aguaNormal );
  float aFr = 0.02 + 0.98 * pow( 1.0 - max( dot( aguaNormal, aV ), 0.0 ), 5.0 );
  vec3 aCeu = mix( uAguaCeuH, uAguaCeuZ, smoothstep( 0.0, 0.6, aR.y ) );
  reflectedLight.indirectSpecular += aCeu * aFr * ( 1.0 - aguaEspuma );
}
#endif
`,
  mascara: /* glsl */ `
if ( uTerMascara > 0.5 ) gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
`,
};

/** Registro vazio (fora dos índices: quem usa importa os trechos). */
export function registrar() {}
