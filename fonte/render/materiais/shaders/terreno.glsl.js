// GLSL do terreno (desenho do render 3.1 e 3.2, D4, D44, D46): a leitura das alturas igual à de comum/altura.js, o
// CDLOD com "morph" no vértice, as camadas do chão (paleta com albedo real e detalhe fino em textura), o mapa de cor
// assado para o longe e as sobreposições no chão (camadas de informação, zonas, ladrilhos e pincel). Fora dos
// índices: exporta os trechos e quem usa importa (mundo/terreno.js, mundo/agua.js, materiais/texturas-chao.js).
// Tudo em highp (D44). Nenhuma textura lida dentro de um "if" que muda de pixel para pixel usa derivada implícita.
import { GLSL_COPA, vec3Linear } from './folha.glsl.js';

/**
 * Camadas do chão, na ordem da textura de detalhe (índice da fatia). cor: albedo sRGB médio (desenho do render 9.2);
 * rug: rugosidade; escala: metros por repetição do detalhe; relevo: amplitude do relevo fino em metros (luz rasante).
 */
export const PALETA_CHAO = Object.freeze([
  { id: 'grama', nome: 'grama tropical', cor: '#5f6536', rug: 0.93, escala: 3.1, relevo: 0.05 },
  { id: 'capim', nome: 'capim seco', cor: '#8e8257', rug: 0.94, escala: 3.7, relevo: 0.06 },
  { id: 'terraRoxa', nome: 'terra roxa', cor: '#855a46', rug: 0.96, escala: 4.3, relevo: 0.04 },
  { id: 'terraClara', nome: 'terra clara', cor: '#a48763', rug: 0.95, escala: 4.1, relevo: 0.05 },
  { id: 'granito', nome: 'granito', cor: '#7f7a73', rug: 0.74, escala: 6.3, relevo: 0.14 },
  { id: 'areia', nome: 'areia de praia', cor: '#bba986', rug: 0.9, escala: 2.3, relevo: 0.025 },
  { id: 'folhico', nome: 'folhiço', cor: '#4d4030', rug: 0.95, escala: 2.9, relevo: 0.05 },
  { id: 'concreto', nome: 'piso de concreto', cor: '#9b978f', rug: 0.86, escala: 4.7, relevo: 0.015 },
]);

/** Cores de apoio (sRGB): variações da grama, gramado aparado dos lotes e asfalto das vias pintadas no chão. */
export const CORES_APOIO = Object.freeze({
  gramaVerde: '#56623a',
  gramaSeca: '#6f6a3c',
  gramado: '#66703f',
  asfalto: '#4a4b4c',
  restinga: '#48503a',
});

export const N_CAMADAS = PALETA_CHAO.length;
/** Níveis do CDLOD: nós de 128 m (8 m por vértice) até 32.768 m. */
export const NIVEIS_CDLOD = 9;
/** Quadrados por lado de um nó (grade de 16 x 16, 512 triângulos). */
export const GRADE_NO = 16;
/** O morph de cada nível começa em 0,65 do alcance (terreno.js usa o mesmo número). */
export const MORPH_INICIO = 0.65;
const MORPH_INICIO_GLSL = MORPH_INICIO.toFixed(2);

const f = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));
const lista = (xs) => xs.map(f).join(', ');

// ------------------------------------------------------------------------------------------------ comum

/** Uniformes e funções que o vértice e o fragmento do terreno (e a água e o assado) dividem. */
export const GLSL_TER_COMUM = /* glsl */ `
uniform highp sampler2D uTerDados;   // RGBA8 n x n: normal x, normal z, floresta, distância à água (m / 255)
uniform highp sampler2D uTerRuido;   // RGBA8 periódica (geracao/ruido.js, texturaRuido)
uniform vec4 uTerGrade;              // ox, oz, passo, n da grade de alturas
uniform vec4 uTerMapa;               // ox, oz, lado, 1 / lado do mapa jogável
uniform vec4 uTerFora;               // ligado, faixa (m), amplitude da serra (m), profundidade do mar (m)
uniform float uTerEstacao;           // 0 chuvoso, 1 seco (capim amarela de maio a setembro)

vec2 terUVDados( vec2 w ) { return ( ( w - uTerGrade.xy ) / uTerGrade.z + 0.5 ) / uTerGrade.w; }
vec2 terUVMapa( vec2 w ) { return ( w - uTerMapa.xy ) * uTerMapa.w; }
float terDistFora( vec2 w ) {
  vec2 d = max( uTerMapa.xy - w, w - ( uTerMapa.xy + uTerMapa.z ) );
  return max( d.x, d.y );
}
vec3 terNormalDados( vec4 d ) {
  vec2 t = d.rg * 2.0 - 1.0;
  return vec3( t.x, sqrt( max( 0.0, 1.0 - dot( t, t ) ) ), t.y );
}
// copa da mata: 0 sem copa, 1 mata fechada
float terCopa( float mata ) { return smoothstep( 0.4, 0.66, mata ); }
// paredão: acima de uns 60 graus a mata abre e o granito aparece (os "pães de açúcar" do litoral); abaixo disso a
// Mata Atlântica cobre a encosta, como na Serra do Mar; r varia a borda
float terParedao( float incl, float r ) { return smoothstep( 0.5, 0.7, incl + ( r - 0.5 ) * 0.12 ); }
// costão: a faixa baixa da encosta íngreme junto do mar, lavada pela maresia, onde a mata não fecha e o granito
// aparece; sobe de uns 4 a 30 m (mais no paredão, menos na encosta suave, recortada pelo ruído) e, onde é íngreme,
// desce até a água (na encosta suave, abaixo de 0,8 m, fica a praia); acima dela a mata desce até a pedra
float terCostaoBase( float mar, float agua, float incl, float h, float r ) {
  float topo = 3.0 + 28.0 * r * r + 10.0 * smoothstep( 0.25, 0.55, incl );
  float pe = mix( smoothstep( 0.16, 0.3, incl ), 1.0, smoothstep( 0.5, 1.1, h ) );
  return mar * ( 1.0 - smoothstep( 40.0, 90.0, agua ) ) * ( 1.0 - smoothstep( topo * 0.55, topo, h ) )
    * smoothstep( 0.08, 0.2, incl + ( r - 0.5 ) * 0.08 ) * pe;
}
// água no canal A dos dados: passos de 2 m mais 128 se a água que conta é o mar -> (distância em m, mar 0 ou 1)
vec2 terAgua( float a ) {
  float v = a * 255.0;
  float mar = step( 127.5, v );
  return vec2( ( v - 128.0 * mar ) * 2.0, mar );
}
// A mesma leitura sem a filtragem da textura: a bilinear do hardware mistura a marca do mar com a distância (entre uma
// amostra que conta o mar e outra que conta rio ou lagoa sai lixo, como mar a 126 m numa linha no meio do campo). Aqui
// cada uma das 4 amostras é decodificada antes da bilinear (texelFetch no nível 0, sem derivada: vale dentro de "if").
// Devolve a distância em m e a fração de mar (0 a 1, contínua).
vec2 terAguaExata( vec2 w ) {
  float n = uTerGrade.w;
  vec2 fr = clamp( ( w - uTerGrade.xy ) / uTerGrade.z, vec2( 0.0 ), vec2( n - 1.0 ) );
  vec2 i = min( floor( fr ), vec2( n - 2.0 ) );
  vec2 t = fr - i;
  ivec2 k = ivec2( i );
  vec2 a00 = terAgua( texelFetch( uTerDados, k, 0 ).a );
  vec2 a10 = terAgua( texelFetch( uTerDados, k + ivec2( 1, 0 ), 0 ).a );
  vec2 a01 = terAgua( texelFetch( uTerDados, k + ivec2( 0, 1 ), 0 ).a );
  vec2 a11 = terAgua( texelFetch( uTerDados, k + ivec2( 1, 1 ), 0 ).a );
  return mix( mix( a00, a10, t.x ), mix( a01, a11, t.x ), t.y );
}
`;

/**
 * Altura (vértice, assado e água): bilinear pelas 4 amostras vizinhas, a mesma conta de amostrar() em
 * comum/altura.js (presa à borda). Fora do mapa, se uTerFora.x, a borda continua em serra (terra) ou afunda (mar).
 */
export const GLSL_TER_ALTURA = /* glsl */ `
uniform highp sampler2D uTerAltura;  // R32F n x n (espelho.terreno.altura)

float terAlturaBase( vec2 w ) {
  float n = uTerGrade.w;
  vec2 fr = clamp( ( w - uTerGrade.xy ) / uTerGrade.z, vec2( 0.0 ), vec2( n - 1.0 ) );
  vec2 i = min( floor( fr ), vec2( n - 2.0 ) );
  vec2 t = fr - i;
  ivec2 k = ivec2( i );
  float h00 = texelFetch( uTerAltura, k, 0 ).r;
  float h10 = texelFetch( uTerAltura, k + ivec2( 1, 0 ), 0 ).r;
  float h01 = texelFetch( uTerAltura, k + ivec2( 0, 1 ), 0 ).r;
  float h11 = texelFetch( uTerAltura, k + ivec2( 1, 1 ), 0 ).r;
  return ( h00 * ( 1.0 - t.x ) + h10 * t.x ) * ( 1.0 - t.y ) + ( h01 * ( 1.0 - t.x ) + h11 * t.x ) * t.y;
}

// mínimo das alturas numa vizinhança de 2^l amostras (mips da textura de alturas), bilinear, l fracionário
float terMinimoNivel( vec2 w, int l ) {
  ivec2 tam = textureSize( uTerAltura, l );
  float esc = exp2( float( l ) );
  vec2 fr = clamp( ( w - uTerGrade.xy ) / ( uTerGrade.z * esc ) - 0.5, vec2( 0.0 ), vec2( tam - 1 ) );
  vec2 i = min( floor( fr ), vec2( max( tam - 2, ivec2( 0 ) ) ) );
  vec2 t = fr - i;
  ivec2 k = ivec2( i );
  ivec2 k1 = min( k + 1, tam - 1 );
  float h00 = texelFetch( uTerAltura, k, l ).r;
  float h10 = texelFetch( uTerAltura, ivec2( k1.x, k.y ), l ).r;
  float h01 = texelFetch( uTerAltura, ivec2( k.x, k1.y ), l ).r;
  float h11 = texelFetch( uTerAltura, k1, l ).r;
  return mix( mix( h00, h10, t.x ), mix( h01, h11, t.x ), t.y );
}
float terMinimo( vec2 w, float nivel ) {
  float l0 = floor( nivel );
  return mix( terMinimoNivel( w, int( l0 ) ), terMinimoNivel( w, int( l0 ) + 1 ), nivel - l0 );
}

float terAltura( vec2 w ) {
  float h = terAlturaBase( w );
  float fo = terDistFora( w );
  if ( uTerFora.x < 0.5 || fo <= 0.0 ) return h;
  float k = smoothstep( 0.0, uTerFora.y, fo );
  vec4 r1 = textureLod( uTerRuido, w * ( 1.0 / 5300.0 ), 0.0 );
  vec4 r2 = textureLod( uTerRuido, w * ( 1.0 / 1700.0 ) + vec2( 0.19, 0.41 ), 0.0 );
  float terra = smoothstep( -2.0, 8.0, h );
  float serra = uTerFora.z * smoothstep( 0.2, 0.85, r1.x * 0.7 + r2.y * 0.3 );
  float mar = -uTerFora.w * ( 0.6 + 0.4 * r1.y );
  return h + k * mix( mar, serra, terra );
}
`;

// ------------------------------------------------------------------------------------------------ camadas

const PAL = PALETA_CHAO;
const cores = PAL.map((c) => vec3Linear(c.cor));

/** Paleta, pesos e mistura (fragmento do terreno e passe do assado). */
export const GLSL_TER_CAMADAS = /* glsl */ `
${GLSL_COPA}
const vec3 TER_COR[ ${N_CAMADAS} ] = vec3[ ${N_CAMADAS} ]( ${cores.join(', ')} );
const float TER_RUG[ ${N_CAMADAS} ] = float[ ${N_CAMADAS} ]( ${lista(PAL.map((c) => c.rug))} );
const float TER_ESC[ ${N_CAMADAS} ] = float[ ${N_CAMADAS} ]( ${lista(PAL.map((c) => c.escala))} );
const float TER_RELEVO[ ${N_CAMADAS} ] = float[ ${N_CAMADAS} ]( ${lista(PAL.map((c) => c.relevo))} );
const vec3 TER_GRAMA_VERDE = ${vec3Linear(CORES_APOIO.gramaVerde)};
const vec3 TER_GRAMA_SECA = ${vec3Linear(CORES_APOIO.gramaSeca)};
const vec3 TER_GRAMADO = ${vec3Linear(CORES_APOIO.gramado)};
const vec3 TER_ASFALTO = ${vec3Linear(CORES_APOIO.asfalto)};

struct TerEntrada {
  vec2 w;      // x, z do mundo
  float h;     // cota do chão
  vec3 n;      // normal do chão (mundo)
  float mata;  // densidade de floresta, 0 a 1
  float agua;  // distância à água, m (na água: distância à terra)
  float mar;   // 1 se a água que conta é o mar
  vec4 uso;    // uso do solo: via, piso, terra batida, gramado
};

vec4 terR1;  // manchas de 2,3 km
vec4 terR2;  // manchas de 263 m (e as copas, de 16 m)
vec4 terR3;  // manchas de 71 m (e o grão das copas)
// o topo do costão recortado em três escalas: manchas de 263 e 71 m e as copas de 4 m (pedra e moita alternando)
float terCostao( TerEntrada e ) { return terCostaoBase( e.mar, e.agua, 1.0 - e.n.y, e.h, terR3.x * 0.4 + terR2.y * 0.3 + terR3.z * 0.3 ); }
float terMargem; // margem de rio ou lagoa (lodo e capim molhado)
// onde a areia da praia acaba (m da água): de 16 a 56 m, recortado em manchas de 263 e 71 m (depois de terRuidos)
float terLimitePraia() { return 16.0 + 30.0 * terR2.x + 10.0 * terR3.y; }
// e a cota em que ela acaba (m), recortada do mesmo jeito
float terCotaPraia() { return 3.0 + 2.6 * terR3.y + 1.2 * terR2.w; }

void terRuidos( vec2 w ) {
  terR1 = texture( uTerRuido, w * ( 1.0 / 2300.0 ) );
  terR2 = texture( uTerRuido, w * ( 1.0 / 263.0 ) + vec2( 0.31, 0.17 ) );
  terR3 = texture( uTerRuido, w * ( 1.0 / 71.0 ) + vec2( 0.57, 0.83 ) );
}

// pesos das 8 camadas; asf e jar: a parte do piso que é asfalto e a da grama que é gramado aparado
void terPesos( TerEntrada e, out float p[ ${N_CAMADAS} ], out float asf, out float jar ) {
  float incl = 1.0 - e.n.y;
  float sub = 1.0 - smoothstep( -0.6, 0.4, e.h );
  float cst = terCostao( e );
  // praia: a areia acaba numa linha (a frente do jundu), pela distância ou pela cota, não num degradê (vista de
  // cima, 30 m de areia misturada no capim parecem poeira); some onde o costão desce até a água
  float lim = terLimitePraia();
  float cotaPraia = terCotaPraia();
  float praia = e.mar * ( 1.0 - smoothstep( lim - 2.5, lim + 2.5, e.agua ) )
    * ( 1.0 - smoothstep( cotaPraia - 0.35, cotaPraia + 0.35, e.h ) ) * ( 1.0 - smoothstep( 0.3, 0.7, cst ) );
  terMargem = ( 1.0 - e.mar ) * ( 1.0 - smoothstep( 3.0, 14.0 + 12.0 * terR3.x, e.agua ) ) * ( 1.0 - smoothstep( 2.5, 7.0, e.h ) );
  float rocha = smoothstep( 0.29, 0.45, incl + ( terR3.x - 0.5 ) * 0.16 )
    + smoothstep( 140.0, 280.0, e.h ) * smoothstep( 0.5, 0.74, terR2.y ) * 0.8;
  rocha = clamp( rocha + cst * 1.3, 0.0, 1.0 );
  // terra exposta na encosta: em manchas (voçorocas, trilhas de gado), não uma faixa contínua
  float erosao = smoothstep( 0.12, 0.3, incl ) * ( 1.0 - rocha ) * smoothstep( 0.5, 0.75, terR2.x * 0.6 + terR3.y * 0.4 );
  // terra roxa exposta: rara, em manchas de pasto gasto (não em pintas por todo o campo)
  float roxa = smoothstep( 0.74, 0.9, terR2.x * 0.45 + terR1.y * 0.35 + terR3.y * 0.2 ) * smoothstep( 0.45, 0.7, terR1.x ) * ( 1.0 - smoothstep( 0.07, 0.2, incl ) );
  float capim = smoothstep( 0.55, 0.8, terR1.x * 0.5 + terR2.y * 0.3 + terR3.w * 0.2 + uTerEstacao * 0.18 + incl * 0.45 );
  float folhico = smoothstep( 0.35, 0.62, e.mata );
  p[ 0 ] = 1.0;
  p[ 1 ] = capim * 1.1;
  p[ 2 ] = roxa * 1.2;
  p[ 3 ] = erosao * 0.9 + roxa * 0.15 + terMargem * 1.8;
  p[ 4 ] = rocha * 2.4;
  p[ 5 ] = praia * 2.8 + sub * 4.0 * e.mar;
  p[ 3 ] += sub * 4.0 * ( 1.0 - e.mar );
  p[ 6 ] = folhico * 2.2;
  p[ 7 ] = 0.0;
  float urb = clamp( e.uso.r + e.uso.g + e.uso.b + e.uso.a, 0.0, 1.0 ) * ( 1.0 - sub );
  for ( int i = 0; i < 7; i ++ ) p[ i ] *= 1.0 - urb;
  asf = e.uso.r * 4.0;
  jar = e.uso.a * 4.0;
  p[ 7 ] = e.uso.g * 4.0 + asf;
  p[ 3 ] += e.uso.b * 4.0;
  p[ 0 ] += jar;
}

void terCores( TerEntrada e, float p[ ${N_CAMADAS} ], float asf, float jar, out vec3 c[ ${N_CAMADAS} ] ) {
  vec3 grama = mix( TER_GRAMA_VERDE, TER_GRAMA_SECA, smoothstep( 0.35, 0.8, terR1.y * 0.65 + terR3.y * 0.2 + uTerEstacao * 0.35 ) );
  grama = mix( grama, TER_COR[ 0 ], 0.45 ) * ( 0.86 + 0.28 * terR2.w );
  c[ 0 ] = mix( grama, TER_GRAMADO, jar / max( p[ 0 ], 1e-4 ) );
  c[ 1 ] = TER_COR[ 1 ] * ( 0.9 + 0.2 * terR2.x );
  c[ 2 ] = TER_COR[ 2 ] * ( 0.88 + 0.24 * terR3.y );
  c[ 3 ] = mix( TER_COR[ 3 ], TER_COR[ 2 ], smoothstep( 0.55, 0.78, terR1.y ) * 0.45 ) * ( 0.92 + 0.16 * terR3.x );
  c[ 3 ] = mix( c[ 3 ], TER_COR[ 3 ] * vec3( 0.52, 0.55, 0.5 ), clamp( terMargem * 1.5, 0.0, 1.0 ) );
  // terra batida da cidade (ruas de terra, terrenos baldios, obras): o barro avermelhado, em manchas
  c[ 3 ] = mix( c[ 3 ], TER_COR[ 2 ] * ( 0.9 + 0.2 * terR3.x ), clamp( e.uso.b * 2.5, 0.0, 1.0 ) * ( 0.35 + 0.35 * terR2.y ) );
  // blocos e fendas de 4 m só onde a encosta é suave (na íngreme a projeção de cima esticaria em listras)
  float plano4 = 1.0 - smoothstep( 0.2, 0.45, 1.0 - e.n.y );
  c[ 4 ] = TER_COR[ 4 ] * mix( 0.85, 0.6 + 0.55 * smoothstep( 0.05, 0.7, terR3.z ), plano4 ) * ( 0.8 + 0.34 * terR2.w );
  // costão: granito mais escuro e pardo (maresia, ferrugem) e a faixa preta de liquens e cianobactérias logo acima da
  // água, de 2 a 5 m conforme a batida das ondas
  float cst = smoothstep( 0.3, 0.7, terCostao( e ) );
  c[ 4 ] *= mix( vec3( 1.0 ), vec3( 0.78, 0.74, 0.68 ) * ( 0.85 + 0.3 * terR3.y ), cst );
  c[ 4 ] *= 1.0 - 0.62 * cst * ( 1.0 - smoothstep( 1.5 + 1.5 * terR3.x, 3.5 + 2.5 * terR3.x, e.h ) );
  c[ 5 ] = TER_COR[ 5 ] * ( 0.93 + 0.1 * terR2.y );
  c[ 6 ] = TER_COR[ 6 ] * ( 0.9 + 0.2 * terR3.z );
  c[ 7 ] = mix( TER_COR[ 7 ], TER_ASFALTO, asf / max( p[ 7 ], 1e-4 ) );
}

// vegetação pintada no chão (sem instância): a copa da mata, a capoeira da borda, as moitas e as árvores soltas do
// pasto, a restinga atrás da praia e a mata ciliar. Devolve a cobertura (0 a 1) e a cor (albedo linear) em cor; a
// cobertura também decide o relevo das copas no fragmento.
float terVegetacao( TerEntrada e, out vec3 cor ) {
  float urb = clamp( e.uso.r + e.uso.g + e.uso.b + e.uso.a, 0.0, 1.0 );
  float costao = terCostao( e );
  float incl = 1.0 - e.n.y;
  float copa = terCopa( e.mata ) * ( 1.0 - urb ) * ( 1.0 - smoothstep( 0.35, 0.8, costao ) ) * ( 1.0 - terParedao( incl, terR3.x ) );
  // borda da mata: capoeira (moitas e arvoretas soltas no capim), não uma faixa de folhiço
  float arb = max( smoothstep( 0.06, 0.42, e.mata ), costao * 0.6 * step( 0.2, e.mata ) ) * ( 1.0 - copa ) * ( 1.0 - urb );
  float moita = arb * smoothstep( 0.5, 0.72, terR3.z * 0.4 + terR3.w * 0.25 + terR2.x * 0.2 + arb * 0.35 );
  // pasto com moitas e arvoretas soltas em manchas (a textura que a foto aérea tem entre 5 e 30 m)
  float areal = e.mar * ( 1.0 - smoothstep( 25.0, 90.0, e.agua ) );
  float pasto = ( 1.0 - urb ) * ( 1.0 - copa ) * ( 1.0 - areal ) * ( 1.0 - smoothstep( 0.2, 0.35, incl ) ) * step( 0.5, e.h );
  moita = max( moita, pasto * smoothstep( 0.6, 0.76, terR3.z * 0.45 + terR3.w * 0.35 + terR2.w * 0.2 ) * smoothstep( 0.35, 0.75, terR1.y * 0.6 + terR2.x * 0.5 ) );
  // árvores soltas no pasto (copas de 10 a 16 m, em grupos): o que dá escala ao campo visto do alto
  // só as copas mais altas do canal B e só onde as manchas grandes juntam um grupo
  float grupo = smoothstep( 0.5, 0.82, terR1.x * 0.5 + terR2.y * 0.5 );
  float arvore = pasto * grupo * smoothstep( 0.72, 0.84, terR2.z );
  // restinga atrás da praia: começa quase fechada na linha em que a areia acaba (o jundu, moitas baixas de 2 a 5 m)
  // e vai abrindo em moitas soltas no capim até uns 60 a 140 m da água (o ruído tem média ~0,45: o corte em volta
  // dela deixa clareiras de capim entre as moitas)
  float lim = terLimitePraia();
  float cota = terCotaPraia();
  // começa onde a areia acaba, pela distância ou pela cota (o que vier antes)
  float fimAreia = max( smoothstep( lim - 1.5, lim + 2.5, e.agua ), smoothstep( cota - 0.35, cota + 0.35, e.h ) );
  float faixaR = e.mar * fimAreia * ( 1.0 - smoothstep( lim + 40.0 + 45.0 * terR2.x, lim + 80.0 + 60.0 * terR2.x, e.agua ) );
  float frente = ( 1.0 - smoothstep( lim + 3.0, lim + 22.0, e.agua ) ) * ( 1.0 - smoothstep( cota + 0.5, cota + 4.0, e.h ) );
  float restinga = faixaR * ( 1.0 - urb ) * ( 1.0 - copa ) * step( 0.6, e.h ) * ( 1.0 - smoothstep( 9.0, 16.0, e.h ) )
    * ( 1.0 - smoothstep( 0.25, 0.45, incl ) )
    * smoothstep( 0.4, 0.56, terR3.x * 0.45 + terR2.w * 0.35 + terR3.z * 0.2 + frente * 0.12 - ( 1.0 - faixaR ) * 0.25 );
  // mata ciliar: rio e lagoa margeados de mata (a margem de lodo fica de fora)
  float ciliar = ( 1.0 - e.mar ) * smoothstep( 4.0, 9.0, e.agua ) * ( 1.0 - smoothstep( 22.0 + 20.0 * terR3.x, 40.0 + 30.0 * terR3.x, e.agua ) )
    * ( 1.0 - urb ) * ( 1.0 - copa ) * step( 0.2, e.h ) * smoothstep( 0.35, 0.6, terR3.z * 0.6 + terR2.y * 0.5 );
  // encosta do mar acima do costão: capoeira e mata baixa fechadas até a pedra (sem a faixa de capim entre as duas)
  float encosta = e.mar * ( 1.0 - smoothstep( 70.0, 170.0, e.agua ) ) * smoothstep( 0.1, 0.26, incl ) * ( 1.0 - urb )
    * ( 1.0 - smoothstep( 0.2, 0.55, costao ) ) * ( 1.0 - terParedao( incl, terR3.x ) ) * step( 0.5, e.h );
  float mata = max( max( max( copa, moita * 0.85 ), max( arvore * 0.92, ciliar * 0.88 ) ), encosta * ( 0.82 + 0.16 * terR3.z ) );
  float rest = restinga * 0.9 * ( 1.0 - mata );
  vec3 cc = copaCor( terR2, terR3, terR1 );
  // restinga: verde mais oliva e acinzentado que a mata
  vec3 cr = mix( cc * vec3( 1.05, 1.0, 0.82 ), ${vec3Linear(CORES_APOIO.restinga)}, 0.45 );
  float cob = 1.0 - ( 1.0 - mata ) * ( 1.0 - rest );
  cor = mix( cc, cr, rest / max( cob, 1e-4 ) );
  return cob;
}

// areia molhada na linha da água e a vegetação por cima de tudo
void terAcabamento( TerEntrada e, inout vec3 alb, inout float rug ) {
  float sub = 1.0 - smoothstep( -0.6, 0.4, e.h );
  // areia molhada: pela cota junto do mar (a linha d'água da malha não segue a grade de 8 m) e pela distância à água
  float molhado = max( ( 1.0 - smoothstep( 1.5, 9.0, e.agua ) ) * ( 1.0 - smoothstep( 0.3, 1.6, e.h ) ),
    e.mar * ( 1.0 - smoothstep( 20.0, 40.0, e.agua ) ) * ( 1.0 - smoothstep( 0.5, 1.3, e.h ) ) ) * ( 1.0 - sub );
  alb *= 1.0 - 0.36 * molhado;
  rug = mix( rug, 0.4, molhado );
  vec3 cv;
  float veg = terVegetacao( e, cv );
  alb = mix( alb, cv, veg );
  rug = mix( rug, 0.82, veg );
}

// mistura de todas as camadas pelos pesos (o longe e o assado): rgb albedo linear, a rugosidade
vec4 terMisturaLinear( TerEntrada e ) {
  float p[ ${N_CAMADAS} ];
  vec3 c[ ${N_CAMADAS} ];
  float asf;
  float jar;
  terPesos( e, p, asf, jar );
  terCores( e, p, asf, jar, c );
  vec3 soma = vec3( 0.0 );
  float ps = 0.0;
  float r = 0.0;
  for ( int i = 0; i < ${N_CAMADAS}; i ++ ) {
    soma += c[ i ] * p[ i ];
    r += TER_RUG[ i ] * p[ i ];
    ps += p[ i ];
  }
  vec3 alb = soma / max( ps, 1e-4 );
  r /= max( ps, 1e-4 );
  terAcabamento( e, alb, r );
  return vec4( alb, r );
}

// fração de gramado (grama e capim, sem copa): a máscara do aceite de cor
float terGramado( TerEntrada e ) {
  float p[ ${N_CAMADAS} ];
  float asf;
  float jar;
  terPesos( e, p, asf, jar );
  float ps = 0.0;
  for ( int i = 0; i < ${N_CAMADAS}; i ++ ) ps += p[ i ];
  return ( p[ 0 ] + p[ 1 ] ) / max( ps, 1e-4 ) * ( 1.0 - terCopa( e.mata ) );
}
`;

// ------------------------------------------------------------------------------------------------ material do terreno

/** Trechos do vértice: CDLOD (posição e morph), normal pelos dados e a copa da mata levantando o chão. */
export const GLSL_TER_VERTICE = {
  pars: /* glsl */ `
${GLSL_TER_COMUM}
${GLSL_TER_ALTURA}
attribute vec4 aNo;                     // x0, z0, lado do nó, nível
uniform vec2 uTerMorph[ ${NIVEIS_CDLOD} ];  // início do morph, 1 / largura da faixa (por nível)
uniform vec4 uTerCopaV;                 // altura da copa (m), distância em que ela baixa (0: nunca), faixa, 0
varying vec3 vTer;                      // cota do chão, copa (m), distância à câmera
`,
  // no lugar de beginnormal_vertex (que vem antes de begin_vertex no MeshStandardMaterial)
  normal: /* glsl */ `
vec2 tG = position.xz;
float tPasso = aNo.z / ${f(GRADE_NO)};
int tNivel = int( aNo.w + 0.5 );
vec2 tW = aNo.xy + tG * tPasso;
float tH = terAltura( tW );
float tD = distance( cameraPosition, vec3( tW.x, tH, tW.y ) );
// morph em cascata: o nível do nó e os dois de cima (o pedaço de um pai e o canto longe de um nó chegam até lá);
// a distância é refeita depois de cada passo, então dois nós vizinhos levam o mesmo vértice ao mesmo lugar
for ( int s = 0; s < 3; s ++ ) {
  int l = min( tNivel + s, ${NIVEIS_CDLOD - 1} );
  float k = clamp( ( tD - uTerMorph[ l ].x ) * uTerMorph[ l ].y, 0.0, 1.0 );
  if ( k > 0.0 ) {
    float e = float( 1 << s );
    vec2 gs = tG / e;
    gs -= fract( gs * 0.5 ) * 2.0 * k;
    tG = gs * e;
    tW = aNo.xy + tG * tPasso;
    tH = terAltura( tW );
    tD = distance( cameraPosition, vec3( tW.x, tH, tW.y ) );
  }
}
vec4 tDados = textureLod( uTerDados, terUVDados( tW ), 0.0 );
vec3 tNV = terNormalDados( tDados );
vec2 tAguaV = terAguaExata( tW );
// a copa sobe devagar com a densidade e não sobe no costão nem logo acima dele (o corte do fragmento tem ruído: aqui
// vale o costão mais alto que ele pode dar, senão a copa levantada faz uma parede escura na borda da pedra)
float tCopa = smoothstep( 0.42, 0.85, tDados.b ) * ( 1.0 - smoothstep( 0.02, 0.3, terCostaoBase( tAguaV.y, tAguaV.x, 1.0 - tNV.y, tH, 0.85 ) ) )
  * ( 1.0 - terParedao( 1.0 - tNV.y, 0.5 ) );
if ( tCopa > 0.0 ) {
  vec4 tRc = textureLod( uTerRuido, tW * ( 1.0 / 263.0 ) + vec2( 0.31, 0.17 ), 0.0 );
  tCopa *= uTerCopaV.x * ( 0.72 + 0.5 * tRc.z );
  if ( uTerCopaV.y > 0.0 ) tCopa *= smoothstep( uTerCopaV.y - uTerCopaV.z, uTerCopaV.y, tD );
}
// de longe, perto de rio ou lagoa (o mar é largo), o vértice desce ao mínimo da vizinhança do tamanho do seu passo (senão a malha
// grossa passa por cima do rio e da lagoa); função contínua da posição e da distância: nós vizinhos não racham
float tPassoEf = max( uTerGrade.z, uTerGrade.z * tD * ${MORPH_INICIO_GLSL} / uTerMorph[ 0 ].x );
float tNivelMin = min( log2( tPassoEf / uTerGrade.z ), 8.0 );
float tPertoAgua = ( 1.0 - smoothstep( tPassoEf, 2.0 * tPassoEf, tAguaV.x ) ) * smoothstep( 1.0, 2.0, tNivelMin ) * ( 1.0 - tAguaV.y );
float tHChao = tH;
if ( tPertoAgua > 0.0 ) tH = mix( tH, min( tH, terMinimo( tW, tNivelMin ) ), tPertoAgua );
vec3 objectNormal = tNV;
vTer = vec3( tHChao, tCopa, tD );
`,
  // no lugar de begin_vertex
  posicao: /* glsl */ `
vec3 transformed = vec3( tW.x, tH + tCopa, tW.y );
`,
};

/** Trechos do fragmento (pars e os pedaços que entram no MeshStandardMaterial). */
export const GLSL_TER_FRAGMENTO = {
  pars: /* glsl */ `
${GLSL_TER_COMUM}
${GLSL_TER_CAMADAS}
uniform highp sampler2D uTerCor;        // mapa de cor assado (sqrt do albedo, rugosidade)
uniform highp sampler2D uTerUso;        // uso do solo a 4 m: via, piso, terra batida, gramado
uniform highp sampler2D uTerSobre;      // sobreposição: células de zona, campo de camada ou ladrilhos
uniform vec4 uTerDetalhe;               // distância do detalhe, faixa, força do relevo, distância do relevo da copa
uniform vec3 uTerGanho[ ${N_CAMADAS} ]; // corrige a média de cada fatia do detalhe para 1
uniform vec4 uTerSobreModo;             // modo (0 nada, 1 zonas, 2 contínuo, 3 categorias, 4 ladrilhos), n cores, neutro, 0
uniform vec4 uTerSobreRet;              // ox, oz, 1 / lado x, 1 / lado z
uniform vec3 uTerSobreRampa[ 8 ];
uniform vec4 uTerPincel;                // x, z, raio, ligado
uniform vec4 uTerLadrilho;              // ligado, ox, oz, lado
uniform float uTerMascara;              // 1: passe da máscara de gramado (aceite de cor)
#ifdef TER_DETALHE
uniform highp sampler2DArray uTerCamadas;  // detalhe (rgb em torno de 0,5; a altura)
#endif
#ifdef TER_AB
uniform highp sampler2DArray uTerCamadasB; // o lado B (CC0) do A/B
uniform vec3 uTerGanhoB[ ${N_CAMADAS} ];
uniform vec4 uTerAB;                        // x da divisa em pixels do alvo, ligado
#endif
varying vec3 vTer;

vec3 terNormalFinal;
float terRug;
float terMasc;
vec3 terLinha;

// relevo fino por derivadas de tela (Mikkelsen), no espaço do mundo
vec3 terRelevo( vec3 n, float h ) {
  vec3 dpx = dFdx( vGPosMundo );
  vec3 dpy = dFdy( vGPosMundo );
  float dhx = dFdx( h );
  float dhy = dFdy( h );
  vec3 r1 = cross( dpy, n );
  vec3 r2 = cross( n, dpx );
  float det = dot( dpx, r1 );
  vec3 g = sign( det ) * ( dhx * r1 + dhy * r2 );
  return normalize( abs( det ) * n - g );
}

#ifdef TER_DETALHE
vec4 terDetalhe( int i, vec2 w, vec2 dx, vec2 dy, bool ladoB ) {
  float s = 1.0 / TER_ESC[ i ];
  vec2 uv1 = w * s;
  mat2 rot = mat2( 0.8, -0.6, 0.6, 0.8 );
  float s2 = s * 0.38;
  vec2 uv2 = rot * w * s2 + vec2( 0.37, 0.71 );
  vec4 a;
  vec4 b;
#ifdef TER_AB
  if ( ladoB ) {
    a = textureGrad( uTerCamadasB, vec3( uv1, float( i ) ), dx * s, dy * s );
    b = textureGrad( uTerCamadasB, vec3( uv2, float( i ) ), rot * dx * s2, rot * dy * s2 );
    vec4 m = mix( a, b, smoothstep( 0.3, 0.7, terR3.w ) );
    return vec4( m.rgb * 2.0 * uTerGanhoB[ i ], m.a );
  }
#endif
  a = textureGrad( uTerCamadas, vec3( uv1, float( i ) ), dx * s, dy * s );
  b = textureGrad( uTerCamadas, vec3( uv2, float( i ) ), rot * dx * s2, rot * dy * s2 );
  vec4 m = mix( a, b, smoothstep( 0.3, 0.7, terR3.w ) );
  return vec4( m.rgb * 2.0 * uTerGanho[ i ], m.a );
}
#endif

vec3 terRampa( float t ) {
  float n = max( uTerSobreModo.y, 1.0 );
  float x = clamp( t, 0.0, 1.0 ) * ( n - 1.0 );
  int i = int( floor( x ) );
  int j = min( i + 1, int( n ) - 1 );
  return mix( uTerSobreRampa[ i ], uTerSobreRampa[ j ], fract( x ) );
}
`,

  // no lugar de map_fragment: albedo, rugosidade, normal e sobreposições
  cor: /* glsl */ `
vec2 tW = vGPosMundo.xz;
float tDist = vTer.z;
vec4 tDados = texture( uTerDados, terUVDados( tW ) );
vec2 tUVM = terUVMapa( tW );
vec4 tUso = texture( uTerUso, tUVM );
terRuidos( tW );
bool tDentro = all( greaterThanEqual( tUVM, vec2( 0.0 ) ) ) && all( lessThanEqual( tUVM, vec2( 1.0 ) ) );
vec3 tN = terNormalDados( tDados );
vec3 tNF = normalize( cross( dFdx( vGPosMundo ), dFdy( vGPosMundo ) ) );
tNF *= sign( tNF.y + 1e-5 );
float tFora = smoothstep( 0.0, 200.0, terDistFora( tW ) );
tN = normalize( mix( tN, tNF, tFora ) );
vec2 tDx = dFdx( tW );
vec2 tDy = dFdy( tW );
// a água filtrada serve de longe; onde o chão é pintado por pixel (até a camada média) a leitura é a exata
vec2 tAgua = terAgua( tDados.a );
if ( tDentro && tDist < uTerDetalhe.w ) tAgua = terAguaExata( tW );
TerEntrada tE = TerEntrada( tW, vTer.x, tN, tDados.b, tAgua.x, tAgua.y, tDentro ? tUso : vec4( 0.0 ) );
// longe: o mapa assado; fora do mapa, a mistura na hora
vec4 tCorLonge = texture( uTerCor, tUVM );
vec3 tAlb = tCorLonge.rgb * tCorLonge.rgb;
float tRug = tCorLonge.a;
if ( !tDentro ) {
  vec4 tm = terMisturaLinear( tE );
  tAlb = tm.rgb;
  tRug = tm.a;
}
float tRel = 0.0;
#ifdef TER_DETALHE
float tPerto = 1.0 - smoothstep( uTerDetalhe.x - uTerDetalhe.y, uTerDetalhe.x, tDist );
if ( tPerto > 0.0 && tDentro ) {
  float p[ ${N_CAMADAS} ];
  vec3 c[ ${N_CAMADAS} ];
  float asf;
  float jar;
  terPesos( tE, p, asf, jar );
  terCores( tE, p, asf, jar, c );
  int i1 = 0;
  float m1 = p[ 0 ];
  for ( int i = 1; i < ${N_CAMADAS}; i ++ ) if ( p[ i ] > m1 ) { m1 = p[ i ]; i1 = i; }
  int i2 = i1 == 0 ? 1 : 0;
  float m2 = p[ i2 ];
  for ( int i = 0; i < ${N_CAMADAS}; i ++ ) if ( i != i1 && p[ i ] > m2 ) { m2 = p[ i ]; i2 = i; }
  bool ladoB = false;
#ifdef TER_AB
  ladoB = uTerAB.y > 0.5 && gl_FragCoord.x > uTerAB.x;
#endif
  vec4 d1 = terDetalhe( i1, tW, tDx, tDy, ladoB );
  vec4 d2 = terDetalhe( i2, tW, tDx, tDy, ladoB );
  float q = m1 + m2;
  float a1 = m1 / q + d1.a * 0.6;
  float a2 = m2 / q + d2.a * 0.6;
  float corte = max( a1, a2 ) - 0.22;
  float b1 = max( a1 - corte, 0.0 );
  float b2 = max( a2 - corte, 0.0 );
  float bs = b1 + b2;
  vec3 aPerto = ( c[ i1 ] * d1.rgb * b1 + c[ i2 ] * d2.rgb * b2 ) / bs;
  float rPerto = ( TER_RUG[ i1 ] * b1 + TER_RUG[ i2 ] * b2 ) / bs;
  terAcabamento( tE, aPerto, rPerto );
  float copaP = terCopa( tE.mata );
  tRel = mix( ( d1.a * TER_RELEVO[ i1 ] * b1 + d2.a * TER_RELEVO[ i2 ] * b2 ) / bs, 0.0, copaP ) * tPerto;
  tAlb = mix( tAlb, aPerto, tPerto );
  tRug = mix( tRug, rPerto, tPerto );
}
#endif
// médio (até uTerDetalhe.w): o assado tem 4 m por texel no Média; por pixel entram a textura do campo entre 1 e 25 m,
// as copas nítidas e o granito dos paredões em projeção lateral (ali a projeção de cima esticaria em listras)
vec3 tPx = dFdx( vGPosMundo );
vec3 tPy = dFdy( vGPosMundo );
// tamanho do pixel no chão em 3D (na encosta, a projeção em x e z subestima o pixel): decide até onde entra o relevo
// fino, que só vale com uns 4 pixels por forma (a normal por derivada é uma só em cada quadra de 2 x 2 pixels; com
// formas do tamanho do pixel ela vira chuvisco em quadradinhos)
float tPix = max( length( tPx ), length( tPy ) );
float tMed = 1.0 - smoothstep( uTerDetalhe.w * 0.6, uTerDetalhe.w, tDist );
// o granito das paredes vai mais longe (são poucos pixels, e no assado de cima a parede vira listra)
float tMedR = 1.0 - smoothstep( uTerDetalhe.w * 1.5, uTerDetalhe.w * 2.5, tDist );
float tParedao = terParedao( 1.0 - tN.y, terR3.x );
float tVeg = 0.0;
float tRelRocha = 0.0; // relevo dos matacões do costão (m), para a normal por derivadas lá embaixo
float tRelVeg = 0.0;   // relevo dos tufos da vegetação de perto (m)
if ( ( tMed > 0.0 || tParedao * tMedR > 0.0 ) && tDentro ) {
  float p[ ${N_CAMADAS} ];
  float asf;
  float jar;
  terPesos( tE, p, asf, jar );
  float ps = 0.0;
  for ( int i = 0; i < ${N_CAMADAS}; i ++ ) ps += p[ i ];
  ps = max( ps, 1e-4 );
  float urb = clamp( tE.uso.r + tE.uso.g + tE.uso.b + tE.uso.a, 0.0, 1.0 );
  vec3 cVeg;
  tVeg = terVegetacao( tE, cVeg );
  // mata na encosta íngreme: a cor das copas numa projeção lateral pelas duas faces (de cima ela esticaria em
  // manchas verticais, como tinta escorrendo); 4 leituras só nesses pixels, com as derivadas de fora do "if"
  float tIngreme = smoothstep( 0.22, 0.42, 1.0 - tN.y ) * step( 0.001, tVeg );
  if ( tIngreme > 0.0 ) {
    float lx = abs( tN.x ) / ( abs( tN.x ) + abs( tN.z ) + 1e-4 );
    const float e2 = 1.0 / 263.0;
    const float e3 = 1.0 / 71.0;
    vec4 r2 = mix( textureGrad( uTerRuido, vGPosMundo.xy * e2 + vec2( 0.31, 0.17 ), tPx.xy * e2, tPy.xy * e2 ),
      textureGrad( uTerRuido, vGPosMundo.zy * e2 + vec2( 0.31, 0.17 ), tPx.zy * e2, tPy.zy * e2 ), lx );
    vec4 r3 = mix( textureGrad( uTerRuido, vGPosMundo.xy * e3 + vec2( 0.57, 0.83 ), tPx.xy * e3, tPy.xy * e3 ),
      textureGrad( uTerRuido, vGPosMundo.zy * e3 + vec2( 0.57, 0.83 ), tPx.zy * e3, tPy.zy * e3 ), lx );
    cVeg = mix( cVeg, copaCor( r2, r3, terR1 ), tIngreme );
  }
  float campo = ( p[ 0 ] + p[ 1 ] ) / ps * ( 1.0 - tVeg );
  float solo = ( p[ 2 ] + p[ 3 ] ) / ps * ( 1.0 - tVeg );
  mat2 rA = mat2( 0.866, 0.5, -0.5, 0.866 );
  mat2 rB = mat2( 0.6, -0.8, 0.8, 0.6 );
  vec4 mA = textureGrad( uTerRuido, rA * tW * ( 1.0 / 23.0 ) + vec2( 0.13, 0.71 ), rA * tDx * ( 1.0 / 23.0 ), rA * tDy * ( 1.0 / 23.0 ) );
  vec4 mB = textureGrad( uTerRuido, rB * tW * ( 1.0 / 8.3 ) + vec2( 0.52, 0.09 ), rB * tDx * ( 1.0 / 8.3 ), rB * tDy * ( 1.0 / 8.3 ) );
  // campo: touceiras e falhas de 1 a 6 m e o amarelado do capim onde a mancha sobe
  float v = mA.x * 0.4 + mA.y * 0.25 + mB.x * 0.2 + mB.w * 0.15;
  vec3 mCampo = vec3( 0.74 + 0.52 * v ) * mix( vec3( 1.0 ), vec3( 1.12, 1.04, 0.74 ), smoothstep( 0.55, 0.78, mA.y * 0.6 + mB.y * 0.4 ) * 0.7 );
  vec3 mSolo = vec3( 0.84 + 0.32 * ( mA.x * 0.5 + mB.w * 0.5 ) );
  // pisos dos lotes: cimentado, cerâmica e sujeira variam de quintal para quintal (manchas de 5 a 20 m)
  float piso = p[ 7 ] / ps * ( 1.0 - asf / max( p[ 7 ], 1e-4 ) );
  vec3 mPiso = vec3( 0.8 + 0.34 * mA.y ) * mix( vec3( 1.0 ), vec3( 1.14, 0.96, 0.84 ), smoothstep( 0.6, 0.8, mA.x ) * 0.8 )
    * mix( vec3( 1.0 ), vec3( 0.82, 0.86, 0.8 ), smoothstep( 0.62, 0.82, mB.y ) * 0.6 );
  vec3 tM = mix( vec3( 1.0 ), mCampo, campo ) * mix( vec3( 1.0 ), mSolo, solo ) * mix( vec3( 1.0 ), mPiso, piso );
  tAlb *= mix( vec3( 1.0 ), tM, tMed );
  // vegetação nítida (o assado de 4 m borra as copas de 3 a 16 m); de perto, os tufos de 1 a 2 m das moitas e das
  // copas, com o vão escuro entre eles (senão a moita pintada vira um feltro liso)
  // (os tufos vêm de cima: na encosta íngreme esticariam em riscos, então ali saem)
  float tufoV = smoothstep( 0.0, 0.55, mA.z ) * ( 0.8 + 0.4 * mB.w );
  float planoV = 1.0 - smoothstep( 0.22, 0.42, 1.0 - tN.y );
  float pertoV = ( 1.0 - smoothstep( 0.4, 1.4, tPix ) ) * planoV;
  cVeg *= mix( 1.0, 0.62 + 0.55 * tufoV, pertoV );
  // relevo dos tufos de ~1,4 m: só com o pixel abaixo de ~0,3 m
  tRelVeg = tVeg * tMed * planoV * ( 1.0 - smoothstep( 0.12, 0.35, tPix ) ) * ( 0.9 * tufoV + 0.25 * mB.x );
  tAlb = mix( tAlb, cVeg, tVeg * tMed );
  // granito do paredão e do costão: projeção lateral onde é íngreme (riscos verticais da chuva, líquen, mato nas
  // fendas) e de cima onde é suave (matacões de 1 a 3 m); a faixa molhada escurece junto da água
  float tCostaoP = terCostao( tE );
  float pr = max( tParedao * tMedR, smoothstep( 0.3, 0.7, tCostaoP ) * tMed ) * ( 1.0 - urb );
  if ( pr > 0.0 ) {
    vec3 an = abs( tN );
    float wx = an.x / ( an.x + an.z + 1e-4 );
    float wy = smoothstep( 0.55, 0.85, an.y );
    const vec2 esc = vec2( 1.0 / 19.0, 1.0 / 83.0 );
    vec4 sX = textureGrad( uTerRuido, vGPosMundo.zy * esc, tPx.zy * esc, tPy.zy * esc );
    vec4 sZ = textureGrad( uTerRuido, vGPosMundo.xy * esc + vec2( 0.37, 0.11 ), tPx.xy * esc, tPy.xy * esc );
    vec4 sY = textureGrad( uTerRuido, tW * ( 1.0 / 41.0 ) + vec2( 0.71, 0.29 ), tDx * ( 1.0 / 41.0 ), tDy * ( 1.0 / 41.0 ) );
    vec4 sR = mix( mix( sZ, sX, wx ), sY, wy );
    // costão (a pedra da maresia) em vez de paredão: blocos em qualquer inclinação, menos risco de chuva
    float kc = smoothstep( 0.3, 0.7, tCostaoP );
    float risco = smoothstep( 0.45, 0.78, sR.y ) * ( 1.0 - wy ) * ( 1.0 - 0.7 * kc );
    float liquen = smoothstep( 0.6, 0.82, sR.x );
    float mato = smoothstep( 0.6, 0.78, sR.z * 0.6 + terR3.z * 0.4 ) * ( 1.0 - smoothstep( 0.5, 0.72, 1.0 - tN.y ) ) * ( 1.0 - smoothstep( 0.5, 0.9, tCostaoP ) );
    // matacões de 3 a 6 m: as "copas" do canal B numa projeção pela face dominante (a mistura das coordenadas torce
    // um pouco a textura onde a face gira, o que na pedra passa por natural), fresta escura entre os blocos
    const float escM = 1.0 / 90.0;
    vec2 uvM = mix( mix( vGPosMundo.xy, vGPosMundo.zy, wx ), tW, wy ) * escM + vec2( 0.13, 0.57 );
    vec4 sM = textureGrad( uTerRuido, uvM, mix( mix( tPx.xy, tPx.zy, wx ), tDx, wy ) * escM, mix( mix( tPy.xy, tPy.zy, wx ), tDy, wy ) * escM );
    float bloco = mix( mix( 1.0, 0.55 + 0.6 * smoothstep( 0.02, 0.35, sR.z ), wy ), 0.5 + 0.62 * smoothstep( 0.0, 0.32, sM.z ), kc );
    // na parede, o escorrimento e o líquen preto riscam o granito de cima a baixo (como no Pão de Açúcar)
    vec3 granito = TER_COR[ 4 ] * ( 0.66 + 0.46 * sR.w ) * ( 1.0 - ( 0.3 + 0.28 * ( 1.0 - wy ) ) * risco ) * bloco;
    granito = mix( granito, TER_COR[ 4 ] * mix( vec3( 1.2, 1.18, 1.1 ), vec3( 0.42, 0.42, 0.4 ), 1.0 - wy ), liquen * 0.3 );
    // costão: pardo de maresia e ferrugem em manchas e a faixa preta de liquens logo acima da água (2 a 5 m)
    granito *= mix( vec3( 1.0 ), vec3( 0.8, 0.75, 0.68 ) * ( 0.82 + 0.36 * sM.x ), kc );
    granito *= 1.0 - 0.62 * kc * ( 1.0 - smoothstep( 1.5 + 1.5 * sM.y, 3.5 + 2.5 * sM.y, vTer.x ) );
    granito *= 1.0 - 0.45 * ( 1.0 - smoothstep( 0.4, 2.2, vTer.x ) ) * tCostaoP;
    granito = mix( granito, copaCor( terR2, terR3, terR1 ), mato * 0.85 );
    tAlb = mix( tAlb, granito, pr );
    tRug = mix( tRug, mix( 0.68, 0.82, mato ), pr );
    // os blocos têm volume: a luz do sol modela cada um (e quebra as faixas das linhas da malha na parede); a borda
    // de um bloco de 3 a 6 m tem ~1 m, então o relevo some com o pixel acima de ~0,3 m (a 330 m, com 1.376 pixels,
    // o pixel já tem ~0,37 m e o relevo desenhava tracinhos pretos e brancos na pedra)
    tRelRocha = 1.6 * smoothstep( 0.0, 0.32, sM.z ) * kc * pr * ( 1.0 - mato ) * ( 1.0 - smoothstep( 0.12, 0.3, tPix ) );
  }
}
// relevo: detalhe de perto e as copas até mais longe (fora de qualquer "if": derivadas de tela)
// o relevo das copas some quando um pixel cobre mais que uns 2 m (derivada de tela serrilharia com o sol baixo)
// na encosta a projeção de cima estica as copas em riscos (escamas com o sol rasante): ali o relevo delas some
float tCopaRel = copaRelevo( terR2, terR3, terR1 ) * max( terCopa( tE.mata ) * ( 1.0 - smoothstep( 0.35, 0.8, terCostao( tE ) ) ) * ( 1.0 - tParedao ), tVeg * 0.8 )
  * ( 1.0 - smoothstep( uTerDetalhe.w * 0.6, uTerDetalhe.w, tDist ) ) * ( 1.0 - smoothstep( 0.9, 2.5, tPix ) )
  * ( 1.0 - smoothstep( 0.22, 0.45, 1.0 - tN.y ) );
// a copa levantada faz paredes na borda da mata: ali (a normal da malha bem mais em pé que a do chão), tom de sombra e
// sem o relevo das copas (que esticaria); a encosta natural, mesmo íngreme, não entra
float tParede = smoothstep( 0.12, 0.35, tN.y - tNF.y ) * smoothstep( 0.5, 3.0, vTer.y );
tCopaRel *= 1.0 - tParede;
tAlb *= 1.0 - 0.45 * tParede;
// o relevo por derivada não faz sombra própria: as copas ficam em 0,65 da altura para não virarem escamas no sol baixo
terNormalFinal = terRelevo( tN, ( tRel + tCopaRel * 0.65 + tRelRocha + tRelVeg ) * uTerDetalhe.z );
terRug = tRug;

// sobreposições no chão (0 chamadas: tudo por uniforme e textura)
terLinha = vec3( 0.0 );
if ( uTerSobreModo.z > 0.0 ) {
  float lum = dot( tAlb, vec3( 0.2126, 0.7152, 0.0722 ) );
  tAlb = mix( tAlb, vec3( lum * 1.1 + 0.04 ), 0.82 * uTerSobreModo.z );
}
vec2 tUVS = ( tW - uTerSobreRet.xy ) * uTerSobreRet.zw;
bool tNaSobre = all( greaterThanEqual( tUVS, vec2( 0.0 ) ) ) && all( lessThan( tUVS, vec2( 1.0 ) ) );
vec4 tS = texture( uTerSobre, tUVS );
float tNivel = abs( fract( tS.r * 10.0 + 0.5 ) - 0.5 ) / max( fwidth( tS.r * 10.0 ), 1e-4 );
float tModo = uTerSobreModo.x;
if ( tModo > 0.5 && tModo < 1.5 && tNaSobre ) {
  float v = floor( tS.r * 255.0 + 0.5 );
  float z = mod( v, 8.0 );
  if ( z > 0.5 ) tAlb = mix( tAlb, uTerSobreRampa[ int( z ) ], v >= 8.0 ? 0.3 : 0.62 );
} else if ( tModo > 1.5 && tModo < 2.5 && tNaSobre ) {
  vec3 rc = terRampa( tS.r );
  tAlb = mix( tAlb, rc * 0.8, 0.86 ) * mix( 0.72, 1.0, smoothstep( 0.5, 1.5, tNivel ) );
} else if ( tModo > 2.5 && tModo < 3.5 && tNaSobre ) {
  int k = int( floor( tS.r * 255.0 + 0.5 ) );
  if ( k > 0 ) tAlb = mix( tAlb, uTerSobreRampa[ min( k, 7 ) ] * 0.8, 0.86 );
}
if ( uTerLadrilho.x > 0.5 ) {
  vec2 lq = ( tW - uTerLadrilho.yz ) / uTerLadrilho.w;
  float est = floor( texture( uTerSobre, ( floor( lq ) + 0.5 ) / 16.0 ).r * 255.0 + 0.5 );
  bool noMapa = all( greaterThanEqual( lq, vec2( 0.0 ) ) ) && all( lessThan( lq, vec2( 16.0 ) ) );
  if ( noMapa && est < 0.5 ) tAlb = mix( tAlb, vec3( dot( tAlb, vec3( 0.3333 ) ) ) * 0.55, 0.7 );
  if ( noMapa && est > 0.5 && est < 1.5 ) terLinha += vec3( 0.06, 0.05, 0.03 );
  vec2 dl = abs( fract( lq + 0.5 ) - 0.5 ) / max( fwidth( lq ), vec2( 1e-4 ) );
  float linha = 1.0 - smoothstep( 0.5, 1.6, min( dl.x, dl.y ) );
  terLinha += vec3( 0.85, 0.78, 0.6 ) * linha * 0.6 * ( noMapa ? 1.0 : 0.0 );
}
if ( uTerPincel.w > 0.5 ) {
  float dp = length( tW - uTerPincel.xy );
  float px = max( fwidth( dp ), 1e-3 );
  float anel = 1.0 - smoothstep( px, px * 2.5, abs( dp - uTerPincel.z ) );
  float dentro = 1.0 - smoothstep( uTerPincel.z - px, uTerPincel.z, dp );
  terLinha += vec3( 0.95, 0.88, 0.68 ) * ( anel * 0.9 + dentro * 0.06 );
}
terMasc = uTerMascara > 0.5 ? terGramado( tE ) : 0.0;
diffuseColor.rgb = tAlb;
`,

  // no lugar de roughnessmap_fragment
  rugosidade: /* glsl */ `
float roughnessFactor = terRug;
`,

  // depois de normal_fragment_maps: a normal final em espaço de vista
  normal: /* glsl */ `
normal = normalize( ( viewMatrix * vec4( terNormalFinal, 0.0 ) ).xyz );
`,

  // depois de emissivemap_fragment: linhas das ferramentas acesas (vistas também à noite)
  emissivo: /* glsl */ `
totalEmissiveRadiance += terLinha;
`,

  // depois de dithering_fragment: o passe da máscara sobrescreve tudo
  mascara: /* glsl */ `
if ( uTerMascara > 0.5 ) gl_FragColor = vec4( vec3( step( 0.5, terMasc ) ), 1.0 );
`,
};

// ------------------------------------------------------------------------------------------------ passe do assado

/** Mapa de cor assado: um quadrado na tela inteira do alvo; cada texel é um ponto do mapa (4 m no Média). */
export const GLSL_ASSAR = {
  vertice: /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`,
  fragmento: /* glsl */ `
${GLSL_TER_COMUM}
${GLSL_TER_ALTURA}
${GLSL_TER_CAMADAS}
uniform highp sampler2D uTerUso;
in vec2 vUv;
void main() {
  vec2 w = uTerMapa.xy + vUv * uTerMapa.z;
  vec4 d = texture( uTerDados, terUVDados( w ) );
  terRuidos( w );
  vec2 ag = terAguaExata( w );
  TerEntrada e = TerEntrada( w, terAlturaBase( w ), terNormalDados( d ), d.b, ag.x, ag.y, texture( uTerUso, vUv ) );
  vec4 m = terMisturaLinear( e );
  gl_FragColor = vec4( sqrt( clamp( m.rgb, 0.0, 1.0 ) ), m.a );
}
`,
};

// ------------------------------------------------------------------------------------------------ geração do detalhe

/**
 * Detalhe procedural de cada camada, periódico (emenda nas bordas), feito na GPU na carga (desenho do render 9.3):
 * rgb é o multiplicador da cor da paleta (0,5 = 1) e a é a altura do relevo fino. A média de cada fatia é medida
 * depois (texturas-chao.js) e corrigida por uTerGanho, então o detalhe nunca muda o albedo médio da paleta.
 */
/** Ruído periódico na GPU (hash inteiro, valor, fbm e Worley com id), para os passes de geração. */
export const GLSL_RUIDO_PERIODICO = /* glsl */ `
float gHash( vec2 c, vec2 per, float s ) {
  c = mod( c, per );
  uvec2 q = uvec2( c + 0.5 );
  uint h = ( q.x * 1597334677u ) ^ ( q.y * 3812015801u ) ^ ( uint( s ) * 2654435769u );
  h ^= h >> 16u;
  h *= 2246822519u;
  h ^= h >> 13u;
  h *= 3266489917u;
  h ^= h >> 16u;
  return float( h ) * ( 1.0 / 4294967295.0 );
}
float gValor( vec2 uv, vec2 per, float s ) {
  vec2 p = uv * per;
  vec2 i = floor( p );
  vec2 fr = p - i;
  vec2 u = fr * fr * fr * ( fr * ( fr * 6.0 - 15.0 ) + 10.0 );
  float a = gHash( i, per, s );
  float b = gHash( i + vec2( 1.0, 0.0 ), per, s );
  float c = gHash( i + vec2( 0.0, 1.0 ), per, s );
  float d = gHash( i + vec2( 1.0, 1.0 ), per, s );
  return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}
float gFbm( vec2 uv, vec2 per, float s, int oit ) {
  float t = 0.0;
  float a = 0.5;
  float n = 0.0;
  for ( int o = 0; o < 6; o ++ ) {
    if ( o >= oit ) break;
    t += a * gValor( uv, per, s + float( o ) * 17.0 );
    n += a;
    a *= 0.5;
    per *= 2.0;
  }
  return t / n;
}
// Worley periódico: f1, f2 e o id da célula mais perto
vec3 gWorley( vec2 uv, vec2 per, float s ) {
  vec2 p = uv * per;
  vec2 i = floor( p );
  float f1 = 9.0;
  float f2 = 9.0;
  float id = 0.0;
  for ( int b = -1; b <= 1; b ++ ) {
    for ( int a = -1; a <= 1; a ++ ) {
      vec2 c = i + vec2( float( a ), float( b ) );
      vec2 pc = c + vec2( gHash( c, per, s ), gHash( c, per, s + 7.0 ) );
      float d = length( pc - p );
      if ( d < f1 ) {
        f2 = f1;
        f1 = d;
        id = gHash( c, per, s + 13.0 );
      } else if ( d < f2 ) {
        f2 = d;
      }
    }
  }
  return vec3( f1, f2, id );
}
`;

export const GLSL_GERAR_CAMADAS = {
  vertice: GLSL_ASSAR.vertice,
  fragmento: /* glsl */ `
uniform int uCamada;
uniform float uSemente;
in vec2 vUv;
${GLSL_RUIDO_PERIODICO}

vec4 camada( int k, vec2 uv ) {
  float s = uSemente + float( k ) * 101.0;
  vec3 m = vec3( 1.0 );
  float h = 0.5;
  if ( k == 0 ) {
    // grama tropical: touceiras, lâminas com ponta seca, falhas com terra (de cima as lâminas não têm direção: um
    // ruído alongado desenhava pentes na borda com a areia)
    float tufo = gFbm( uv, vec2( 14.0 ), s, 5 );
    float lam = gFbm( uv, vec2( 64.0, 48.0 ), s + 3.0, 3 );
    float falha = smoothstep( 0.64, 0.82, gFbm( uv, vec2( 5.0 ), s + 5.0, 4 ) );
    m = vec3( 0.66 + 0.62 * tufo );
    m *= mix( vec3( 1.0 ), vec3( 1.22, 1.12, 0.78 ), smoothstep( 0.52, 0.8, lam ) * 0.8 );
    m *= mix( vec3( 1.0 ), vec3( 0.7, 0.82, 0.7 ), smoothstep( 0.3, 0.1, tufo ) );
    m = mix( m, vec3( 1.75, 1.05, 1.5 ), falha * 0.55 );
    h = tufo * 0.6 + lam * 0.4 - falha * 0.4;
  } else if ( k == 1 ) {
    // capim seco: fibras compridas, tufos e restos verdes
    float fib = gFbm( uv, vec2( 128.0, 18.0 ), s, 3 );
    float tufo = gFbm( uv, vec2( 12.0 ), s + 1.0, 4 );
    float verde = smoothstep( 0.6, 0.8, gFbm( uv, vec2( 6.0 ), s + 2.0, 3 ) );
    m = vec3( 0.72 + 0.56 * tufo ) * mix( vec3( 0.9 ), vec3( 1.14, 1.1, 0.98 ), fib );
    m *= mix( vec3( 1.0 ), vec3( 0.8, 0.96, 0.84 ), verde * 0.7 );
    h = tufo * 0.5 + fib * 0.5;
  } else if ( k == 2 || k == 3 ) {
    // terra: torrões com trincas, grão e pedrisco
    vec3 wv = gWorley( uv, vec2( 22.0 ), s );
    float torrao = smoothstep( 0.0, 0.35, wv.y - wv.x );
    float grao = gFbm( uv, vec2( 48.0 ), s + 1.0, 3 );
    float mancha = gFbm( uv, vec2( 4.0 ), s + 2.0, 4 );
    vec3 sx = gWorley( uv, vec2( 64.0 ), s + 3.0 );
    float seixo = ( 1.0 - smoothstep( 0.18, 0.3, sx.x ) ) * step( k == 3 ? 0.55 : 0.8, sx.z );
    m = vec3( 0.7 + 0.5 * grao ) * mix( 0.62, 1.05, torrao ) * ( 0.85 + 0.3 * mancha );
    m = mix( m, k == 3 ? vec3( 1.35, 1.35, 1.4 ) : vec3( 1.2, 1.35, 1.5 ), seixo * 0.8 );
    h = torrao * 0.5 + grao * 0.3 + seixo * 0.4;
  } else if ( k == 4 ) {
    // granito: mancha grande, pontos de biotita e feldspato, líquen e fendas
    float base = gFbm( uv, vec2( 6.0 ), s, 5 );
    float bio = step( 0.8, gValor( uv, vec2( 170.0 ), s + 1.0 ) );
    float fel = step( 0.82, gValor( uv, vec2( 130.0 ), s + 2.0 ) );
    float liquen = smoothstep( 0.62, 0.78, gFbm( uv, vec2( 5.0 ), s + 3.0, 4 ) );
    // fraturas: as cristas de um fbm (linhas sinuosas e esparsas), não a rede de polígonos de lama seca
    float fr = abs( gFbm( uv, vec2( 3.0 ), s + 4.0, 4 ) - 0.5 );
    float fenda = ( 1.0 - smoothstep( 0.0, 0.022, fr ) ) * smoothstep( 0.35, 0.6, gValor( uv, vec2( 4.0 ), s + 6.0 ) );
    m = vec3( 0.78 + 0.44 * base );
    m *= 1.0 - 0.38 * bio;
    m *= mix( vec3( 1.0 ), vec3( 1.2, 1.06, 0.98 ), fel );
    m = mix( m, vec3( 0.95, 1.06, 0.82 ), liquen * 0.55 );
    m *= 1.0 - 0.45 * fenda;
    h = base * 0.7 - fenda * 0.4 + 0.3;
  } else if ( k == 5 ) {
    // areia: grão, pegadas e marcas de vento só em manchas (a areia seca varrida), algum fragmento de concha; as
    // marcas em toda a praia viravam um veludo cotelê repetido
    float grao = gValor( uv, vec2( 256.0 ), s );
    float torce = gFbm( uv, vec2( 3.0 ), s + 1.0, 3 );
    float onda = sin( 6.2831853 * ( uv.x * 9.0 + uv.y * 2.0 + torce * 2.5 ) );
    float varrida = smoothstep( 0.52, 0.72, gFbm( uv, vec2( 2.0 ), s + 4.0, 3 ) );
    float pisada = smoothstep( 0.55, 0.8, gFbm( uv, vec2( 24.0 ), s + 5.0, 3 ) ) * ( 1.0 - varrida );
    float concha = step( 0.985, gValor( uv, vec2( 200.0 ), s + 2.0 ) );
    float mancha = gFbm( uv, vec2( 4.0 ), s + 3.0, 4 );
    m = vec3( 0.9 + 0.16 * grao ) * ( 1.0 + 0.03 * onda * varrida ) * ( 0.92 + 0.16 * mancha ) * ( 1.0 - 0.06 * pisada );
    m = mix( m, vec3( 1.5 ), concha * 0.7 );
    h = 0.5 + 0.14 * onda * varrida + 0.25 * grao - 0.15 * pisada;
  } else if ( k == 6 ) {
    // folhiço: folhas caídas de vários tons e gravetos
    vec3 wv = gWorley( uv, vec2( 36.0 ), s );
    vec3 folha = mix( vec3( 0.8, 0.85, 0.9 ), vec3( 1.45, 1.1, 0.7 ), wv.z );
    folha = mix( folha, vec3( 1.05, 1.3, 0.8 ), step( 0.86, wv.z ) );
    float borda = smoothstep( 0.02, 0.14, wv.y - wv.x );
    float galho = 1.0 - smoothstep( 0.0, 0.04, abs( gFbm( uv, vec2( 8.0, 40.0 ), s + 1.0, 2 ) - 0.5 ) );
    m = mix( vec3( 0.5 ), folha, borda );
    m = mix( m, vec3( 0.7, 0.62, 0.55 ), galho * 0.6 );
    h = ( 1.0 - wv.x ) * borda;
  } else {
    // piso de concreto: agregado fino, manchas e desgaste
    float ag = gFbm( uv, vec2( 64.0 ), s, 3 );
    float mancha = gFbm( uv, vec2( 4.0 ), s + 1.0, 4 );
    float sujo = smoothstep( 0.6, 0.82, gFbm( uv, vec2( 3.0 ), s + 2.0, 4 ) );
    m = vec3( 0.88 + 0.24 * ag ) * ( 0.88 + 0.24 * mancha ) * ( 1.0 - 0.22 * sujo );
    h = ag * 0.6 + mancha * 0.4;
  }
  return vec4( clamp( m * 0.5, 0.0, 1.0 ), clamp( h, 0.0, 1.0 ) );
}

void main() {
  gl_FragColor = camada( uCamada, vUv );
}
`,
};

/**
 * Textura de ruído do chão (RGBA8 periódica), feita na GPU na carga: R e G manchas (fbm de valor, períodos 4 e 6,
 * contraste esticado), B as copas da mata vistas de cima (duas camadas de Worley, 16 e 26 células, altura e raio
 * sorteados por copa: a mais alta vence), A grão fino (período 32).
 */
export const GLSL_GERAR_RUIDO = {
  vertice: GLSL_ASSAR.vertice,
  fragmento: /* glsl */ `
uniform float uSemente;
in vec2 vUv;
${GLSL_RUIDO_PERIODICO}
float copaCamada( vec2 uv, float per, float raio, float s ) {
  vec3 w = gWorley( uv, vec2( per ), s );
  float alt = 0.45 + 0.55 * fract( w.z * 7.13 );
  float r = raio * ( 0.8 + 0.5 * fract( w.z * 13.7 ) );
  return alt * max( 0.0, 1.0 - w.x * r );
}
void main() {
  vec2 uv = vUv;
  float r = clamp( 0.5 + ( gFbm( uv, vec2( 4.0 ), uSemente, 5 ) - 0.5 ) * 1.7, 0.0, 1.0 );
  float g = clamp( 0.5 + ( gFbm( uv, vec2( 6.0 ), uSemente + 101.0, 5 ) - 0.5 ) * 1.5, 0.0, 1.0 );
  float b = max( copaCamada( uv, 16.0, 1.25, uSemente + 202.0 ), copaCamada( uv, 26.0, 1.5, uSemente + 259.0 ) );
  float a = gFbm( uv, vec2( 32.0 ), uSemente + 303.0, 4 );
  gl_FragColor = vec4( r, g, b, a );
}
`,
};

/** Média de uma fatia pela mip de 16 x 16 (lida de volta para corrigir o ganho). */
export const GLSL_MEDIA_FATIA = {
  vertice: GLSL_ASSAR.vertice,
  fragmento: /* glsl */ `
uniform highp sampler2DArray uFonte;
uniform float uFatia;
uniform float uNivel;
in vec2 vUv;
void main() {
  gl_FragColor = textureLod( uFonte, vec3( vUv, uFatia ), uNivel );
}
`,
};

/** Registro vazio (fora dos índices: quem usa importa os trechos). */
export function registrar() {}
