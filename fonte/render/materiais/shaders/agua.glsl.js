// GLSL do mar, do rio e da lagoa (desenho do render 3.4): uma família de material, sem redesenhar a cena. A
// profundidade sai da grade de alturas (a mesma leitura do terreno); o fundo visto pela água é o mapa de cor assado do
// terreno no mesmo ponto, escurecido pela absorção (Beer) da água de cada tipo; ondas por um mapa de normal em quatro
// escalas rolando (as que o pixel não resolve viram rugosidade); espuma na arrebentação (faixas que andam para a
// praia) e na linha d'água; reflexo do céu pelo IBL com Fresnel (sem IBL, um céu analítico com a cor do horizonte).
// O rio (R2b) corre: as ondas e a espuma andam nas coordenadas dele (ao longo e através, aRio), mais rápidas no meio,
// em duas fases que se revezam (o desenho não estica para sempre); água barrenta e turva, com plumas de sedimento e o
// talvegue mais escuro; espuma em renda nas margens, fios de correnteza no meio e pedras com a esteira rio abaixo
// (mais nas corredeiras). Fora dos índices: quem usa importa. Tudo em highp.
import { GLSL_TER_COMUM, GLSL_TER_ALTURA, PALETA_CHAO, vec3Linear } from './terreno.glsl.js';

/** Fundo de lodo do rio e da lagoa (linear): a areia do assado é só do mar. LODO_RASO: o lodo claro e a areia da
 * margem, onde a água tem menos de um metro. */
export const LODO = [0.045, 0.04, 0.03];
export const LODO_RASO = [0.13, 0.115, 0.08];
/** Tapete de algas e folhas no fundo do rio e da lagoa (linear). */
export const ALGA = [0.014, 0.022, 0.011];
/** Rio: velocidade (m/s) no meio e junto da margem, período das fases do fluxo (s) e pedras (granito molhado, linear). */
export const RIO = Object.freeze({ velMeio: 1.35, velMargem: 0.25, fase: 8, pedra: [0.13, 0.12, 0.1], celulaPedra: 7 });

/** Óptica de cada água: absorção por metro (rgb), cor do espalhamento no fundo (linear), rugosidade e força das ondas. */
export const AGUAS = Object.freeze({
  mar: { tipo: 0, absorcao: [0.42, 0.11, 0.075], espalha: [0.017, 0.066, 0.072], rug: 0.09, ondas: 0.16 },
  rio: { tipo: 1, absorcao: [2.4, 2.0, 1.75], espalha: [0.098, 0.086, 0.048], rug: 0.11, ondas: 0.16 },
  lagoa: { tipo: 2, absorcao: [1.5, 1.2, 1.05], espalha: [0.02, 0.031, 0.025], rug: 0.04, ondas: 0.06 },
});

const v3 = (a) => `vec3( ${a.map((x) => x.toFixed(4)).join(', ')} )`;

export const GLSL_AGUA_VERTICE = {
  pars: /* glsl */ `
attribute float aAgua;
attribute vec2 aFluxo;
attribute vec3 aRio;
flat varying float vAgua;
varying vec2 vFluxo;
varying vec3 vRio;
`,
  main: /* glsl */ `
vAgua = aAgua;
vFluxo = aFluxo;
vRio = aRio;
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
varying vec3 vRio;

vec3 aguaNormal;
float rioHash( vec2 c ) { return fract( sin( dot( c, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
const float RIO_VEL_MEIO = ${RIO.velMeio.toFixed(3)};
const float RIO_VEL_MARGEM = ${RIO.velMargem.toFixed(3)};
const float RIO_FASE = ${RIO.fase.toFixed(3)};
const float RIO_CELULA = ${RIO.celulaPedra.toFixed(3)};
float aguaRug;
float aguaEspuma;
`,
  // no lugar de map_fragment
  cor: /* glsl */ `
vec2 aW = vGPosMundo.xz;
float aFundo = terAltura( aW );
float aProf = max( vGPosMundo.y - aFundo, 0.0 );
vec2 aUV = terUVMapa( aW );
bool aDentro = all( greaterThanEqual( aUV, vec2( 0.0 ) ) ) && all( lessThanEqual( aUV, vec2( 1.0 ) ) );
vec4 aDados = texture( uTerDados, terUVDados( aW ) );
// distância à terra: a leitura filtrada basta na água (a marca do mar só troca na foz, onde o rio encontra o mar, e ali
// a espuma de arrebentação some numa faixa de poucos metros); terAguaExata custaria 4 leituras por pixel de água
float aTerra = aDentro ? terAgua( aDados.a ).x : 255.0;
vec3 aLeito = texture( uTerCor, aUV ).rgb;
aLeito = aDentro ? aLeito * aLeito : ${vec3Linear(PALETA_CHAO[5].cor)} * 0.8;
// rio e lagoa: fundo de lodo com manchas paradas (tapetes de alga e folhas, escuros; lodo e areia, claros), que
// aparecem onde a água é rasa; a leitura fica fora do "if" (derivada implícita)
vec4 aFundoR = texture( uTerRuido, aW * ( 1.0 / 57.0 ) + vec2( 0.61, 0.23 ) );
if ( vAgua > 0.5 ) {
  aLeito = mix( ${v3(LODO_RASO)}, ${v3(LODO)}, smoothstep( 0.15, 1.1, aProf ) ) * ( 0.8 + 0.4 * aFundoR.x );
  aLeito = mix( aLeito, ${v3(ALGA)}, smoothstep( 0.55, 0.8, aFundoR.y * 0.7 + aFundoR.z * 0.3 ) * 0.5 );
}
// ondas: três escalas rolando em direções diferentes, rajadas de vento (manchas de 180 m) e, de longe, as faixas de
// água lisa que o vento deixa (manchas de 1,9 km). A escala menor some quando o pixel cobre mais do que ela resolve:
// senão o azulejo de 19 m vira uma cintilação repetida de longe.
vec4 aVento = texture( uTerRuido, aW * ( 1.0 / 180.0 ) + uAguaTempo * vec2( 0.0021, 0.0013 ) );
vec4 aQuebra = texture( uTerRuido, aW * ( 1.0 / 47.0 ) + uAguaTempo * vec2( 0.006, -0.004 ) );
vec4 aLiso = texture( uTerRuido, mat2( 0.8, 0.6, -0.6, 0.8 ) * aW * ( 1.0 / 1900.0 ) + vec2( 0.3, 0.6 ) );
vec2 aCorre = vAgua > 0.5 && vAgua < 1.5 ? vFluxo * uAguaTempo * 0.35 : vec2( 0.0 );
vec2 aPe2 = fwidth( aW );
float aPe = max( aPe2.x, aPe2.y );
vec3 aN0 = texture( uAguaOndas, mat2( 0.8, 0.6, -0.6, 0.8 ) * aW * ( 1.0 / 233.0 ) + uAguaTempo * vec2( 0.0023, -0.0016 ) - aCorre / 233.0 ).xyz;
vec3 aN1 = texture( uAguaOndas, aW * ( 1.0 / 61.0 ) + uAguaTempo * vec2( 0.008, 0.005 ) - aCorre / 61.0 ).xyz;
vec4 aN2 = texture( uAguaOndas, mat2( 0.6, -0.8, 0.8, 0.6 ) * aW * ( 1.0 / 19.0 ) - uAguaTempo * vec2( 0.011, 0.019 ) - aCorre / 19.0 );
vec4 aN3 = texture( uAguaOndas, mat2( -0.28, 0.96, -0.96, -0.28 ) * aW * ( 1.0 / 5.3 ) + uAguaTempo * vec2( 0.021, -0.013 ) );
float aK2 = 1.0 - smoothstep( 0.35, 2.0, aPe );
float aK1 = 1.0 - smoothstep( 0.9, 4.0, aPe );
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
// rio e lagoa: manchas de sedimento e alga na água (tom de 150 a 400 m), sem mexer no mar
if ( vAgua > 0.5 ) aEspalha *= 0.65 + 0.7 * smoothstep( 0.25, 0.75, aVento.x * 0.6 + aLiso.y * 0.4 );
// absorção na ida e na volta: o fundo some com a profundidade, fica a cor do espalhamento
vec3 aTrans = exp( -aSigma * aProf * 1.6 );
vec3 aCor = aLeito * aTrans + aEspalha * ( 1.0 - aTrans );
// espuma: as cristas da arrebentação andando para a praia e a lavagem na linha d'água (só no mar; fraca na lagoa).
// As duas em renda (as cristas das ondas curtas recortam a mancha), não em nuvem; a lavagem é fina, onde a água
// tem poucos centímetros, e vai e volta.
float aRenda = smoothstep( 0.5, 0.72, aN2.w * 0.55 + aN3.w * 0.45 ) * ( 0.55 + 0.45 * aK2 ) + ( 1.0 - aK2 ) * 0.35;
float aFase = fract( aTerra / 21.0 + uAguaTempo * 0.085 + aVento.x * 0.6 );
float aCrista = smoothstep( 0.8, 0.95, aFase ) * ( 1.0 - smoothstep( 0.95, 1.0, aFase ) );
float aZona = exp( -aTerra / 26.0 ) * smoothstep( 0.2, 1.2, aProf );
float aEsp = aCrista * aZona * smoothstep( 0.38, 0.72, aQuebra.w * 0.75 + aVento.w * 0.45 ) * step( vAgua, 0.5 ) * ( 0.35 + 0.9 * aRenda );
float aVai = 0.06 + 0.05 * sin( uAguaTempo * 0.9 + aVento.x * 6.2831 );
aEsp += ( 1.0 - smoothstep( aVai * 0.3, aVai, aProf ) ) * smoothstep( 0.3, 0.6, aQuebra.z * 0.5 + aRenda * 0.5 ) * 0.85;
// rio: a espuma dele (correnteza) é da R2b; lagoa: só um fio na margem
aEsp *= vAgua < 0.5 ? 1.0 : vAgua < 1.5 ? 0.0 : 0.25;
aguaEspuma = clamp( aEsp, 0.0, 1.0 );
// água lisa: faixas onde o vento cai (mais espelhada e mais escura de perto do zênite)
float aCalma = smoothstep( 0.55, 0.75, aLiso.x ) * ( vAgua < 0.5 ? 1.0 : 0.4 );
float aF = aForca * ( 0.6 + 0.7 * aVento.y ) * ( 1.0 - 0.65 * aCalma );
// lagoa: sem vento a água vira espelho; as rajadas riscam manchas foscas e crespas (as "patas de gato" de uns 50 a
// 150 m), que é o que mostra de cima que a água é água e não um disco liso
float aPata = smoothstep( 0.45, 0.8, aVento.y * 0.7 + aQuebra.x * 0.3 );
if ( vAgua > 1.5 ) aF = aForca * mix( 0.3, 1.7, aPata ) * ( 1.0 - 0.5 * aCalma );
// ondas longas têm inclinação pequena (a maior parte da inclinação vem das curtas): pesos 0,12, 0,24, 0,6 e 0,4. A
// inclinação lida num mapa girado volta para o mundo pela transposta do giro (v * M), senão o brilho do sol corre
// numa direção e as cristas em outra
float aK3 = 1.0 - smoothstep( 0.06, 0.3, aPe );
vec2 aInc = ( aN0.xy * 2.0 - 1.0 ) * mat2( 0.8, 0.6, -0.6, 0.8 ) * 0.12 + ( aN1.xy * 2.0 - 1.0 ) * 0.24 * aK1
  + ( aN2.xy * 2.0 - 1.0 ) * mat2( 0.6, -0.8, 0.8, 0.6 ) * 0.6 * ( 0.5 + 0.5 * aVento.z ) * aK2
  + ( aN3.xy * 2.0 - 1.0 ) * mat2( -0.28, 0.96, -0.96, -0.28 ) * 0.4 * aK3;
aguaNormal = normalize( vec3( aInc.x * aF, 1.0, aInc.y * aF ) );
aguaNormal = normalize( mix( aguaNormal, vec3( 0.0, 1.0, 0.0 ), aguaEspuma * 0.7 ) );
// as ondas que o pixel não resolve viram rugosidade (o brilho do sol se espalha em vez de cintilar)
float aNaoResolve = ( 1.0 - aK3 ) * 0.03 + ( 1.0 - aK2 ) * 0.05 + ( 1.0 - aK1 ) * 0.05;
aguaRug = mix( aRugBase * ( 0.7 + 0.8 * aVento.y ) * ( 1.0 - 0.5 * aCalma ) + aNaoResolve, 0.75, aguaEspuma );
if ( vAgua > 1.5 ) aguaRug = mix( 0.02, 0.16, aPata ) + aNaoResolve;
// rio (R2b): correnteza, cor barrenta, espuma das margens, fios e pedras. As derivadas ficam fora do "if" (o vAgua é o
// mesmo no triângulo, mas a quadra de 2 x 2 pixels pode pegar o mar na foz)
#ifdef AGUA_RIO
float rMeia = max( vRio.z, 1.0 );
vec2 rCoord = vec2( vRio.x, vRio.y * rMeia );
vec2 rDx = dFdx( rCoord );
vec2 rDy = dFdy( rCoord );
if ( vAgua > 0.5 && vAgua < 1.5 ) {
  float rLat = vRio.y;
  float rVel = mix( RIO_VEL_MARGEM, RIO_VEL_MEIO, max( 0.0, 1.0 - rLat * rLat ) );
  // duas fases do fluxo: cada uma volta ao começo quando a outra está no meio (peso zero)
  float rT = uAguaTempo / RIO_FASE;
  float rF0 = fract( rT );
  float rF1 = fract( rT + 0.5 );
  float rW = abs( 2.0 * rF0 - 1.0 );
  vec2 rU0 = rCoord - vec2( rVel * rF0 * RIO_FASE, 0.0 );
  vec2 rU1 = rCoord - vec2( rVel * rF1 * RIO_FASE, 0.0 ) + vec2( 17.3, 5.1 );
  // ondinhas alongadas na correnteza: o mapa de ondas em 9 por 4 m e em 3,2 por 1,6 m
  vec2 rE1 = vec2( 1.0 / 9.0, 1.0 / 4.0 );
  vec2 rE2 = vec2( 1.0 / 3.2, 1.0 / 1.6 );
  vec2 rI = mix( textureGrad( uAguaOndas, rU0 * rE1, rDx * rE1, rDy * rE1 ).xy, textureGrad( uAguaOndas, rU1 * rE1, rDx * rE1, rDy * rE1 ).xy, rW ) * 2.0 - 1.0;
  float rPe = max( length( rDx ), length( rDy ) );
  float rK2 = 1.0 - smoothstep( 0.25, 1.2, rPe );
  // de longe (o pixel maior que a renda e as pedras: rPerto 0) só as ondas longas e as plumas: 3 leituras em vez de 10
  float rPerto = 1.0 - smoothstep( 0.6, 2.2, rPe );
  vec2 rI2 = vec2( 0.0 );
  vec4 rRe = vec4( 0.5 );
  vec4 rFi = vec4( 0.5 );
  float rCorr = 0.0;
  if ( rPerto > 0.0 ) {
    rI2 = mix( textureGrad( uAguaOndas, rU0 * rE2 + 0.37, rDx * rE2, rDy * rE2 ).xy, textureGrad( uAguaOndas, rU1 * rE2 + 0.37, rDx * rE2, rDy * rE2 ).xy, rW ) * 2.0 - 1.0;
    vec2 rEr = vec2( 1.0 / 23.0, 1.0 / 6.0 );
    rRe = mix( textureGrad( uTerRuido, rU0 * rEr, rDx * rEr, rDy * rEr ), textureGrad( uTerRuido, rU1 * rEr, rDx * rEr, rDy * rEr ), rW );
    vec2 rEf = vec2( 1.0 / 120.0, 1.0 / 1.6 );
    rFi = mix( textureGrad( uTerRuido, rU0 * rEf, rDx * rEf, rDy * rEf ), textureGrad( uTerRuido, rU1 * rEf, rDx * rEf, rDy * rEf ), rW );
    rCorr = smoothstep( 0.55, 0.75, textureGrad( uTerRuido, vec2( rCoord.x / 300.0, 0.71 ), vec2( rDx.x / 300.0, 0.0 ), vec2( rDy.x / 300.0, 0.0 ) ).z );
  }
  vec2 rIncl = ( rI * rE1 * 4.0 + rI2 * rE2 * 1.6 * rK2 ) * ( 0.55 + 0.6 * rVel / RIO_VEL_MEIO );
  // do espaço do rio (ao longo, através) para o mundo
  vec2 rAo = normalize( vFluxo + vec2( 1e-5 ) );
  vec2 rAt = vec2( rAo.y, -rAo.x );
  vec2 rInclW = rAo * rIncl.x + rAt * rIncl.y;
  // o que anda com a água: plumas de sedimento (160 m), a renda da margem (23 por 6 m) e os fios (90 por 3,5 m)
  vec4 rPl = textureGrad( uTerRuido, ( rCoord - vec2( uAguaTempo * RIO_VEL_MEIO * 0.6, 0.0 ) ) / 160.0, rDx / 160.0, rDy / 160.0 );
  // cor barrenta e turva: o talvegue mais fundo que a grade (escuro no meio, o lodo aparecendo na beira) e as plumas
  float rProf = aProf + 2.4 * max( 0.0, 1.0 - rLat * rLat );
  vec3 rTr = exp( -aSigma * rProf * 1.6 );
  vec3 rEsp = aEspalha * ( 0.84 + 0.32 * smoothstep( 0.3, 0.75, rPl.x * 0.7 + rPl.y * 0.3 ) ) * mix( 1.0, 0.86, max( 0.0, 1.0 - rLat * rLat ) );
  aCor = aLeito * rTr + rEsp * ( 1.0 - rTr );
  // espuma: um fio em renda na linha d'água (onde a água fica rasa junto da margem) e os fios da correnteza no meio
  // de longe (o pixel maior que a renda e as pedras) a espuma vira só um tom mais claro e contínuo na beira, e as
  // pedras saem (sem o laço delas): senão a margem tracejada parece a faixa de uma estrada
  float rMargem = smoothstep( 0.8, 1.0, abs( rLat ) ) * ( 1.0 - smoothstep( 0.08, 0.5, aProf ) );
  float rEspuma = rMargem * mix( 0.25, smoothstep( 0.45, 0.75, rRe.x * 0.55 + rRe.w * 0.45 ), rPerto ) * mix( 0.3, 0.75, rPerto );
  rEspuma = max( rEspuma, smoothstep( 0.86, 0.96, rFi.y ) * ( 1.0 - smoothstep( 0.6, 0.9, abs( rLat ) ) ) * smoothstep( 0.5, 1.0, rVel / RIO_VEL_MEIO ) * 0.32 * rPerto );
  // pedras numa grade de 7 m nas coordenadas do rio: mais junto da margem e nas corredeiras (trechos de 300 m);
  // colar de espuma em volta e a esteira rio abaixo, abrindo e se desfazendo
  vec2 rCel = floor( rCoord / RIO_CELULA );
  float rPedra = 0.0;
  vec3 rNP = vec3( 0.0, 1.0, 0.0 );
  for ( int j = -1; j <= 1; j ++ ) {
    if ( rPerto <= 0.0 ) break;
    for ( int i = -2; i <= 0; i ++ ) {
      vec2 c = rCel + vec2( float( i ), float( j ) );
      vec2 cp = ( c + vec2( rioHash( c ), rioHash( c + 19.7 ) ) ) * RIO_CELULA;
      float latC = cp.y / rMeia;
      // junto da margem e nas corredeiras (onde ficam em grupo); no meio do rio manso, quase nenhuma
      float prob = ( 0.004 + 0.13 * smoothstep( 0.65, 0.95, abs( latC ) ) ) * ( 0.6 + 3.0 * rCorr ) * step( abs( latC ), 1.05 );
      if ( rioHash( c + 7.3 ) > prob ) continue;
      float hr = rioHash( c + 3.1 );
      float r = 0.5 + 1.3 * hr * hr;
      vec2 d = rCoord - cp;
      // contorno de pedra (não um círculo): o raio varia com o ângulo
      float ang = atan( d.y, d.x );
      float dist = length( d / vec2( 1.3, 1.0 ) ) / ( 1.0 + 0.22 * sin( 3.0 * ang + hr * 6.0 ) + 0.12 * sin( 5.0 * ang + hr * 11.0 ) );
      if ( dist < r ) {
        rPedra = max( rPedra, 1.0 - smoothstep( r - 0.12, r, dist ) );
        vec2 q = d / r;
        rNP = normalize( vec3( q.x * 0.9, sqrt( max( 0.0, 1.0 - dot( q, q ) ) ) + 0.2, q.y * 0.9 ) );
      }
      // a água bate rio acima (d.x < 0): o colar é mais forte ali
      float anel = ( 1.0 - smoothstep( r, r + 0.3 + 0.35 * rVel, dist ) ) * step( r * 0.95, dist ) * ( 0.35 + 0.65 * smoothstep( 0.4, -0.6, d.x / r ) );
      float u = d.x - r * 0.4;
      float esteira = step( 0.0, u ) * ( 1.0 - smoothstep( 0.0, 1.5 + 2.5 * r, u ) ) * ( 1.0 - smoothstep( r * 0.5 + u * 0.2, r * 0.8 + u * 0.28, abs( d.y ) ) );
      rEspuma = max( rEspuma, max( anel * 0.8 * smoothstep( 0.3, 0.6, rRe.w + 0.25 ), esteira * smoothstep( 0.45, 0.75, rRe.y * 0.6 + rFi.x * 0.4 ) * 0.55 ) * rPerto );
    }
  }
  rPedra *= rPerto;
  aguaEspuma = clamp( rEspuma, 0.0, 1.0 ) * ( 1.0 - rPedra );
  vec2 rInc2 = rInclW * aForca * 2.5;
  aguaNormal = normalize( vec3( rInc2.x, 1.0, rInc2.y ) );
  aguaNormal = normalize( mix( aguaNormal, vec3( 0.0, 1.0, 0.0 ), aguaEspuma * 0.6 ) );
  vec3 rNPw = normalize( vec3( dot( rNP.xz, vec2( rAo.x, rAt.x ) ), rNP.y, dot( rNP.xz, vec2( rAo.y, rAt.y ) ) ) );
  aguaNormal = normalize( mix( aguaNormal, rNPw, rPedra ) );
  aguaRug = mix( mix( aRugBase + rPe * 0.02, 0.75, aguaEspuma ), 0.55, rPedra );
  aCor = mix( aCor, ${v3(RIO.pedra)} * ( 0.8 + 0.4 * rRe.z ), rPedra );
}
#endif
diffuseColor.rgb = mix( aCor, vec3( 0.74, 0.76, 0.75 ), aguaEspuma * 0.9 );
`,
  rugosidade: /* glsl */ `
float roughnessFactor = aguaRug;
`,
  normal: /* glsl */ `
normal = normalize( ( viewMatrix * vec4( aguaNormal, 0.0 ) ).xyz );
`,
  // sem IBL: reflexo de um céu analítico com o Fresnel de Schlick (F0 = 0,02); com ou sem IBL, a água de poucos
  // centímetros reflete menos (a linha d'água some na areia molhada em vez de riscar a praia)
  indireta: /* glsl */ `
reflectedLight.indirectSpecular *= mix( 0.3, 1.0, smoothstep( 0.0, 0.35, aProf ) );
// rio e lagoa: junto da margem, o reflexo rasante é o da mata e do barranco, mais escuros que o céu; olhando de
// cima o reflexo é o do céu até a beira (senão um anel escuro contorna a lagoa inteira, como uma vinheta)
if ( vAgua > 0.5 ) {
  float aRasante = 1.0 - smoothstep( 0.12, 0.42, reflect( -normalize( cameraPosition - vGPosMundo ), aguaNormal ).y );
  reflectedLight.indirectSpecular *= mix( 1.0, mix( 0.4, 1.0, smoothstep( 6.0, 45.0, aTerra ) ), aRasante );
}
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
