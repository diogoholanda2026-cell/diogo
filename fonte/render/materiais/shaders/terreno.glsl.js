// GLSL do terreno (desenho do render 3.1 e 3.2, D4, D44, D46): a leitura das alturas igual à de comum/altura.js, o
// CDLOD com "morph" no vértice, as camadas do chão (paleta com albedo real e detalhe fino em textura), o mapa de cor
// assado para o longe e as sobreposições no chão (camadas de informação, zonas, ladrilhos e pincel). Fora dos
// índices: exporta os trechos e quem usa importa (mundo/terreno.js, mundo/agua.js, materiais/texturas-chao.js).
// Tudo em highp (D44). Nenhuma textura lida dentro de um "if" que muda de pixel para pixel usa derivada implícita.
//
// Cor da copa da Mata Atlântica vista de cima (R2a), a mesma do chão e das árvores da R2b (folha.glsl.js, que vem sob
// demanda, a importa daqui). Cores em albedo linear (desenho do render 9.2: folhagem de 0,05 a 0,12), nada de
// verde-limão: a mata vista de avião é verde-escuro com copas mais claras (embaúba prateada, brotos) e, rara, uma
// florada de ipê ou quaresmeira.

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

/** Tom por instância para as árvores: varia a cor da folha em torno da copa, sem sair da faixa de albedo. */
export const GLSL_FOLHA_TOM = /* glsl */ `
vec3 folhaTom( vec3 base, float semente ) {
  float a = fract( sin( semente * 12.9898 ) * 43758.5453 );
  float b = fract( sin( semente * 78.233 ) * 24634.6345 );
  return base * ( 0.82 + 0.36 * a ) * mix( vec3( 1.0 ), vec3( 1.06, 1.02, 0.86 ), b );
}
`;

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
/** Folga da leitura da sombra acima da malha grossa, por metro do passo do vértice (até 16 m), só ao sol. */
export const TER_SOMBRA_FOLGA = 0.12;
/** A maior altura das copas grandes (m) que o assado de relevo guarda (copaRelevo sem as pequenas: até 2,6 x 1,4). */
export const TER_RELEVO_MAX = 4;
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
uniform float uTerAssado16;          // 1: o mapa de cor assado tem 16 bits (RGB565, sem a rugosidade no alfa)

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

/**
 * Paleta, pesos e mistura (fragmento do terreno e passe do assado). O que depende só da entrada e do ruído (o costão,
 * o fim da praia, a margem, a parte urbana) sai uma vez por pixel em terPreparar (PC3): antes cada função refazia a
 * conta (o costão, quatro vezes por pixel). A vegetação pintada sai uma vez e vale para o detalhe de perto e para a
 * mata nítida.
 */
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
// o que terPreparar deixa pronto para o pixel (depois de terRuidos)
float terUrb;    // parte urbana do uso do solo (0 a 1)
float terCst;    // costão: o topo recortado em três escalas (manchas de 263 e 71 m e as copas de 4 m)
float terLimP;   // onde a areia da praia acaba (m da água): de 16 a 56 m, recortado em manchas de 263 e 71 m
float terCotaP;  // e a cota em que ela acaba (m), recortada do mesmo jeito
float terMargem; // margem de rio ou lagoa (lodo e capim molhado)
// vegetação pintada que as árvores de perto trocam (R2b): 1 pinta, 0 some (o fragmento acerta pela distância; o
// assado e o longe pintam tudo)
float terKArv = 1.0;
float terKMoita = 1.0;

void terPreparar( TerEntrada e ) {
  terUrb = clamp( e.uso.r + e.uso.g + e.uso.b + e.uso.a, 0.0, 1.0 );
  terCst = terCostaoBase( e.mar, e.agua, 1.0 - e.n.y, e.h, terR3.x * 0.4 + terR2.y * 0.3 + terR3.z * 0.3 );
  terLimP = 16.0 + 30.0 * terR2.x + 10.0 * terR3.y;
  terCotaP = 3.0 + 2.6 * terR3.y + 1.2 * terR2.w;
  terMargem = ( 1.0 - e.mar ) * ( 1.0 - smoothstep( 2.0, 7.0 + 7.0 * terR3.x, e.agua ) ) * ( 1.0 - smoothstep( 1.5, 5.0, e.h ) );
}

void terRuidos( vec2 w ) {
  terR1 = texture( uTerRuido, w * ( 1.0 / 2300.0 ) );
  terR2 = texture( uTerRuido, w * ( 1.0 / 263.0 ) + vec2( 0.31, 0.17 ) );
  terR3 = texture( uTerRuido, w * ( 1.0 / 71.0 ) + vec2( 0.57, 0.83 ) );
}
// a mesma leitura com as derivadas de fora (no chão ela fica dentro de um "if" que muda de pixel para pixel)
void terRuidosGrad( vec2 w, vec2 dx, vec2 dy ) {
  terR1 = textureGrad( uTerRuido, w * ( 1.0 / 2300.0 ), dx * ( 1.0 / 2300.0 ), dy * ( 1.0 / 2300.0 ) );
  terR2 = textureGrad( uTerRuido, w * ( 1.0 / 263.0 ) + vec2( 0.31, 0.17 ), dx * ( 1.0 / 263.0 ), dy * ( 1.0 / 263.0 ) );
  terR3 = textureGrad( uTerRuido, w * ( 1.0 / 71.0 ) + vec2( 0.57, 0.83 ), dx * ( 1.0 / 71.0 ), dy * ( 1.0 / 71.0 ) );
}

// pesos das 8 camadas; asf e jar: a parte do piso que é asfalto e a da grama que é gramado aparado
void terPesos( TerEntrada e, out float p[ ${N_CAMADAS} ], out float asf, out float jar ) {
  float incl = 1.0 - e.n.y;
  float sub = 1.0 - smoothstep( -0.6, 0.4, e.h );
  // praia: a areia acaba numa linha (a frente do jundu), pela distância ou pela cota, não num degradê (vista de
  // cima, 30 m de areia misturada no capim parecem poeira); some onde o costão desce até a água
  float praia = e.mar * ( 1.0 - smoothstep( terLimP - 2.5, terLimP + 2.5, e.agua ) )
    * ( 1.0 - smoothstep( terCotaP - 0.35, terCotaP + 0.35, e.h ) ) * ( 1.0 - smoothstep( 0.3, 0.7, terCst ) );
  float rocha = smoothstep( 0.29, 0.45, incl + ( terR3.x - 0.5 ) * 0.16 )
    + smoothstep( 140.0, 280.0, e.h ) * smoothstep( 0.5, 0.74, terR2.y ) * 0.8;
  rocha = clamp( rocha + terCst * 1.3, 0.0, 1.0 );
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
  float urb = terUrb * ( 1.0 - sub );
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
  // lodo molhado na margem e no barranco que a água cobre e descobre (rio e lagoa; no mar o fundo raso é areia)
  float subRio = ( 1.0 - smoothstep( -0.6, 0.6, e.h ) ) * ( 1.0 - e.mar );
  c[ 3 ] = mix( c[ 3 ], TER_COR[ 3 ] * vec3( 0.36, 0.37, 0.33 ) * ( 0.85 + 0.3 * terR3.y ), clamp( max( terMargem, subRio ) * 1.5, 0.0, 1.0 ) );
  // terra batida da cidade (ruas de terra, terrenos baldios, obras): o barro avermelhado, em manchas
  c[ 3 ] = mix( c[ 3 ], TER_COR[ 2 ] * ( 0.9 + 0.2 * terR3.x ), clamp( e.uso.b * 2.5, 0.0, 1.0 ) * ( 0.35 + 0.35 * terR2.y ) );
  // blocos e fendas de 4 m só onde a encosta é suave (na íngreme a projeção de cima esticaria em listras)
  float plano4 = 1.0 - smoothstep( 0.2, 0.45, 1.0 - e.n.y );
  c[ 4 ] = TER_COR[ 4 ] * mix( 0.85, 0.6 + 0.55 * smoothstep( 0.05, 0.7, terR3.z ), plano4 ) * ( 0.8 + 0.34 * terR2.w );
  // costão: granito mais escuro e pardo (maresia, ferrugem) e a faixa preta de liquens e cianobactérias logo acima da
  // água, de 2 a 5 m conforme a batida das ondas
  float cst = smoothstep( 0.3, 0.7, terCst );
  c[ 4 ] *= mix( vec3( 1.0 ), vec3( 0.78, 0.74, 0.68 ) * ( 0.85 + 0.3 * terR3.y ), cst );
  c[ 4 ] *= 1.0 - 0.62 * cst * ( 1.0 - smoothstep( 1.5 + 1.5 * terR3.x, 3.5 + 2.5 * terR3.x, e.h ) );
  c[ 5 ] = TER_COR[ 5 ] * ( 0.93 + 0.1 * terR2.y );
  c[ 6 ] = TER_COR[ 6 ] * ( 0.9 + 0.2 * terR3.z );
  c[ 7 ] = mix( TER_COR[ 7 ], TER_ASFALTO, asf / max( p[ 7 ], 1e-4 ) );
}

// vegetação pintada no chão (sem instância): a copa da mata, a capoeira da borda, as moitas e as árvores soltas do
// pasto, a restinga atrás da praia e a mata ciliar. Devolve a cobertura (0 a 1) e a cor (albedo linear) em cor; a
// cobertura também decide o relevo das copas no fragmento. A restinga, a mata ciliar e a encosta do mar só existem a
// menos de 200 m da água: longe dela (quase todo o mapa) o ramo não roda e o resultado é o mesmo.
float terVegetacao( TerEntrada e, out vec3 cor ) {
  float urb = terUrb;
  float costao = terCst;
  float incl = 1.0 - e.n.y;
  float copa = terCopa( e.mata ) * ( 1.0 - urb ) * ( 1.0 - smoothstep( 0.35, 0.8, costao ) ) * ( 1.0 - terParedao( incl, terR3.x ) );
  // borda da mata: capoeira (moitas e arvoretas soltas no capim), não uma faixa de folhiço
  float arb = max( smoothstep( 0.06, 0.42, e.mata ), costao * 0.6 * step( 0.2, e.mata ) ) * ( 1.0 - copa ) * ( 1.0 - urb );
  float moita = arb * smoothstep( 0.5, 0.72, terR3.z * 0.4 + terR3.w * 0.25 + terR2.x * 0.2 + arb * 0.35 );
  // pasto com moitas e arvoretas soltas em manchas (a textura que a foto aérea tem entre 5 e 30 m)
  float areal = 0.0;
  float restinga = 0.0;
  float ciliar = 0.0;
  float encosta = 0.0;
  bool pertoAgua = e.agua < 200.0;
  if ( pertoAgua ) areal = e.mar * ( 1.0 - smoothstep( 25.0, 90.0, e.agua ) );
  float pasto = ( 1.0 - urb ) * ( 1.0 - copa ) * ( 1.0 - areal ) * ( 1.0 - smoothstep( 0.2, 0.35, incl ) ) * step( 0.5, e.h );
  moita = max( moita, pasto * smoothstep( 0.6, 0.76, terR3.z * 0.45 + terR3.w * 0.35 + terR2.w * 0.2 ) * smoothstep( 0.35, 0.75, terR1.y * 0.6 + terR2.x * 0.5 ) );
  // árvores soltas no pasto (copas de 10 a 16 m, em grupos): o que dá escala ao campo visto do alto
  // só as copas mais altas do canal B e só onde as manchas grandes juntam um grupo
  float grupo = smoothstep( 0.5, 0.82, terR1.x * 0.5 + terR2.y * 0.5 );
  float arvore = pasto * grupo * smoothstep( 0.72, 0.84, terR2.z );
  if ( pertoAgua ) {
    // restinga atrás da praia: começa quase fechada na linha em que a areia acaba (o jundu, moitas baixas de 2 a 5 m)
    // e vai abrindo em moitas soltas no capim até uns 60 a 140 m da água (o ruído tem média ~0,45: o corte em volta
    // dela deixa clareiras de capim entre as moitas); começa onde a areia acaba, pela distância ou pela cota (o que
    // vier antes)
    float lim = terLimP;
    float cota = terCotaP;
    float fimAreia = max( smoothstep( lim - 1.5, lim + 2.5, e.agua ), smoothstep( cota - 0.35, cota + 0.35, e.h ) );
    float faixaR = e.mar * fimAreia * ( 1.0 - smoothstep( lim + 40.0 + 45.0 * terR2.x, lim + 80.0 + 60.0 * terR2.x, e.agua ) );
    float frente = ( 1.0 - smoothstep( lim + 3.0, lim + 22.0, e.agua ) ) * ( 1.0 - smoothstep( cota + 0.5, cota + 4.0, e.h ) );
    restinga = faixaR * ( 1.0 - urb ) * ( 1.0 - copa ) * step( 0.6, e.h ) * ( 1.0 - smoothstep( 9.0, 16.0, e.h ) )
      * ( 1.0 - smoothstep( 0.25, 0.45, incl ) )
      * smoothstep( 0.4, 0.56, terR3.x * 0.45 + terR2.w * 0.35 + terR3.z * 0.2 + frente * 0.12 - ( 1.0 - faixaR ) * 0.25 );
    // mata ciliar: rio e lagoa margeados de mata (a margem de lodo fica de fora)
    ciliar = ( 1.0 - e.mar ) * smoothstep( 4.0, 9.0, e.agua ) * ( 1.0 - smoothstep( 22.0 + 20.0 * terR3.x, 40.0 + 30.0 * terR3.x, e.agua ) )
      * ( 1.0 - urb ) * ( 1.0 - copa ) * step( 0.2, e.h ) * smoothstep( 0.35, 0.6, terR3.z * 0.6 + terR2.y * 0.5 );
    // encosta do mar acima do costão: capoeira e mata baixa fechadas até a pedra (sem a faixa de capim entre as duas)
    encosta = e.mar * ( 1.0 - smoothstep( 70.0, 170.0, e.agua ) ) * smoothstep( 0.1, 0.26, incl ) * ( 1.0 - urb )
      * ( 1.0 - smoothstep( 0.2, 0.55, costao ) ) * ( 1.0 - terParedao( incl, terR3.x ) ) * step( 0.5, e.h );
  }
  // de perto as árvores e as moitas de verdade tomam o lugar das pintadas; a copa da mata fica como o sub-bosque
  // escuro entre os troncos (o vértice já baixou a copa) e a encosta, como capoeira rala
  moita *= terKMoita;
  restinga *= terKMoita;
  arvore *= terKArv;
  ciliar *= terKArv;
  encosta *= mix( 0.45, 1.0, terKArv );
  float mata = max( max( max( copa, moita * 0.85 ), max( arvore * 0.92, ciliar * 0.88 ) ), encosta * ( 0.82 + 0.16 * terR3.z ) );
  float rest = restinga * 0.9 * ( 1.0 - mata );
  vec3 cc = copaCor( terR2, terR3, terR1 ) * mix( 0.62, 1.0, terKArv );
  // restinga: verde mais oliva e acinzentado que a mata
  vec3 cr = mix( cc * vec3( 1.05, 1.0, 0.82 ), ${vec3Linear(CORES_APOIO.restinga)}, 0.45 );
  float cob = 1.0 - ( 1.0 - mata ) * ( 1.0 - rest );
  cor = mix( cc, cr, rest / max( cob, 1e-4 ) );
  return cob;
}

// cobertura com que a cor da vegetação entra: na borda (cobertura parcial) o vão escuro entre as copas mostra o chão
// de baixo, não a sombra funda da mata fechada (a mata fechada, cobertura 1, fica igual)
float terCobVeg( float cob, vec3 cor ) {
  float vao = 1.0 - smoothstep( 0.013, 0.026, dot( cor, vec3( 0.2126, 0.7152, 0.0722 ) ) );
  return cob * ( 1.0 - vao * ( 1.0 - smoothstep( 0.4, 0.95, cob ) ) );
}

// o ruído das manchas do campo: 23 m e 8,3 m, girados (a mesma conta no assado e no chão de perto)
const mat2 TER_ROT_A = mat2( 0.866, 0.5, -0.5, 0.866 );
const mat2 TER_ROT_B = mat2( 0.6, -0.8, 0.8, 0.6 );

// manchas de 1 a 25 m fora da vegetação: touceiras, falhas e o amarelado do capim onde a mancha sobe; o solo; a areia
// pisada, varrida e mais úmida (sem isto a praia de perto era um plano bege liso, de maquete); e os pisos dos lotes
// (cimentado, cerâmica e sujeira variam de quintal para quintal). Multiplicador do albedo; veg: cobertura da vegetação
vec3 terManchas( float p[ ${N_CAMADAS} ], float asf, float veg, vec4 mA, vec4 mB ) {
  float ps = 0.0;
  for ( int i = 0; i < ${N_CAMADAS}; i ++ ) ps += p[ i ];
  ps = max( ps, 1e-4 );
  float campo = ( p[ 0 ] + p[ 1 ] ) / ps * ( 1.0 - veg );
  float solo = ( p[ 2 ] + p[ 3 ] ) / ps * ( 1.0 - veg );
  float v = mA.x * 0.4 + mA.y * 0.25 + mB.x * 0.2 + mB.w * 0.15;
  vec3 mCampo = vec3( 0.74 + 0.52 * v ) * mix( vec3( 1.0 ), vec3( 1.12, 1.04, 0.74 ), smoothstep( 0.55, 0.78, mA.y * 0.6 + mB.y * 0.4 ) * 0.7 );
  vec3 mSolo = vec3( 0.84 + 0.32 * ( mA.x * 0.5 + mB.w * 0.5 ) );
  float areia = p[ 5 ] / ps * ( 1.0 - veg );
  vec3 mAreia = vec3( 0.91 + 0.18 * ( mA.y * 0.55 + mB.x * 0.45 ) )
    * mix( vec3( 1.0 ), vec3( 0.95, 0.96, 1.0 ), smoothstep( 0.58, 0.8, mA.x ) * 0.7 );
  float piso = p[ 7 ] / ps * ( 1.0 - asf / max( p[ 7 ], 1e-4 ) );
  vec3 mPiso = vec3( 0.8 + 0.34 * mA.y ) * mix( vec3( 1.0 ), vec3( 1.14, 0.96, 0.84 ), smoothstep( 0.6, 0.8, mA.x ) * 0.8 )
    * mix( vec3( 1.0 ), vec3( 0.82, 0.86, 0.8 ), smoothstep( 0.62, 0.82, mB.y ) * 0.6 );
  return mix( vec3( 1.0 ), mCampo, campo ) * mix( vec3( 1.0 ), mSolo, solo ) * mix( vec3( 1.0 ), mPiso, piso )
    * mix( vec3( 1.0 ), mAreia, areia );
}

// areia molhada na linha da água e a vegetação por cima de tudo (vegBruta e cv: terVegetacao, já feita); manchas (o
// assado): as do campo antes da vegetação
void terAcabamentoV( TerEntrada e, inout vec3 alb, inout float rug, bool manchas, float p[ ${N_CAMADAS} ], float asf, vec4 mA, vec4 mB, float vegBruta, vec3 cv ) {
  float sub = 1.0 - smoothstep( -0.6, 0.4, e.h );
  // areia molhada: pela cota junto do mar (a linha d'água da malha não segue a grade de 8 m) e pela distância à água
  float molhado = max( ( 1.0 - smoothstep( 1.5, 9.0, e.agua ) ) * ( 1.0 - smoothstep( 0.3, 1.6, e.h ) ),
    e.mar * ( 1.0 - smoothstep( 20.0, 40.0, e.agua ) ) * ( 1.0 - smoothstep( 0.5, 1.3, e.h ) ) ) * ( 1.0 - sub );
  alb *= 1.0 - 0.36 * molhado;
  rug = mix( rug, 0.4, molhado );
  if ( manchas ) alb *= terManchas( p, asf, vegBruta, mA, mB );
  float veg = terCobVeg( vegBruta, cv );
  alb = mix( alb, cv, veg );
  rug = mix( rug, 0.82, veg );
}
void terAcabamentoM( TerEntrada e, inout vec3 alb, inout float rug, bool manchas, float p[ ${N_CAMADAS} ], float asf, vec4 mA, vec4 mB ) {
  vec3 cv;
  float vegBruta = terVegetacao( e, cv );
  terAcabamentoV( e, alb, rug, manchas, p, asf, mA, mB, vegBruta, cv );
}

// mistura de todas as camadas pelos pesos (o longe e o assado): rgb albedo linear, a rugosidade; com as manchas do
// campo (o assado: o chão de longe não as pinta por pixel). Chama terPreparar (quem chama já leu o ruído)
vec4 terMistura( TerEntrada e, bool manchas, vec4 mA, vec4 mB ) {
  terPreparar( e );
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
  terAcabamentoM( e, alb, r, manchas, p, asf, mA, mB );
  return vec4( alb, r );
}
vec4 terMisturaLinear( TerEntrada e ) { return terMistura( e, false, vec4( 0.5 ), vec4( 0.5 ) ); }

// fração de gramado (grama e capim, sem copa): a máscara do aceite de cor (terPreparar já feito)
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
uniform vec4 uTerCopaV;                 // altura da copa (m), distância em que ela baixa (0: nunca), faixa, elevação do sol (rad)
varying vec4 vTer;                      // cota do chão, copa (m), distância à câmera, folga da sombra (m)
// o campo da sombra de longe (R1b, sombra.glsl.js: os mesmos uniformes do gancho), lido no vértice só para a folga
uniform sampler2D gCampoMapa;
uniform vec4 gCampoParams;
uniform float gCampoT;
uniform float gCampoLigado;
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
// passo efetivo do vértice (m) e o nível de mip das amostras que ele cobre
float tPassoEf = max( uTerGrade.z, uTerGrade.z * tD * ${MORPH_INICIO_GLSL} / uTerMorph[ 0 ].x );
float tNivelMin = min( log2( tPassoEf / uTerGrade.z ), 8.0 );
// a mata e a inclinação na média do passo do vértice: de longe, um vértice que caía numa amostra de 8 m íngreme (o
// paredão corta a copa) ou numa clareira afundava a copa num buraco do tamanho do triângulo, com as paredes escuras
// (as manchas pretas nos morros, vistas do mapa inteiro)
vec4 tDadosC = tNivelMin > 0.5 ? textureLod( uTerDados, terUVDados( tW ), tNivelMin ) : tDados;
vec3 tNC = terNormalDados( tDadosC );
// a copa sobe devagar com a densidade e não sobe no costão nem logo acima dele (o corte do fragmento tem ruído: aqui
// vale o costão mais alto que ele pode dar, senão a copa levantada faz uma parede escura na borda da pedra)
float tCopa = smoothstep( 0.42, 0.85, tDadosC.b ) * ( 1.0 - smoothstep( 0.02, 0.3, terCostaoBase( tAguaV.y, tAguaV.x, 1.0 - tNC.y, tH, 0.85 ) ) )
  * ( 1.0 - terParedao( 1.0 - tNC.y, 0.5 ) );
if ( tCopa > 0.0 ) {
  vec4 tRc = textureLod( uTerRuido, tW * ( 1.0 / 263.0 ) + vec2( 0.31, 0.17 ), 0.0 );
  // as copas de 16 m só no relevo de perto: de longe o vértice cai num ponto qualquer delas, e a altura da copa
  // sorteada vértice a vértice recortava a sombra de longe (que vem do terreno sem a copa) em manchas ovais escuras
  tCopa *= uTerCopaV.x * ( 0.72 + 0.5 * mix( tRc.z, 0.5, smoothstep( 1.0, 2.5, tNivelMin ) ) );
  if ( uTerCopaV.y > 0.0 ) tCopa *= smoothstep( uTerCopaV.y - uTerCopaV.z, uTerCopaV.y, tD );
}
// de longe, perto de rio ou lagoa (o mar é largo), o vértice desce ao mínimo da vizinhança do tamanho do seu passo (senão a malha
// grossa passa por cima do rio e da lagoa); função contínua da posição e da distância: nós vizinhos não racham
// a distância à água vem codificada até 254 m: o corte fica abaixo disso (sem ele, de longe, todo vértice do mapa
// "estava perto da água" e descia ao mínimo da vizinhança, abrindo buracos escuros nos morros)
float tPertoAgua = ( 1.0 - smoothstep( min( tPassoEf, 110.0 ), min( 2.0 * tPassoEf, 230.0 ), tAguaV.x ) ) * smoothstep( 1.0, 2.0, tNivelMin ) * ( 1.0 - tAguaV.y );
float tHChao = tH;
if ( tPertoAgua > 0.0 ) {
  float tHMin = terMinimo( tW, tNivelMin );
  // só a várzea desce; a encosta de um vale estreito (o mínimo bem abaixo) afundaria num buraco visto de longe
  tPertoAgua *= 1.0 - smoothstep( 6.0, 18.0, tH - tHMin );
  tH = mix( tH, min( tH, tHMin ), tPertoAgua );
}
// mar, de longe: o fundo junto da costa desce pela distância à terra, então a linha d'água da malha grossa cai perto
// da costa de verdade (com o fundo raso, o triângulo grande furava a água num polígono de areia em volta das ilhas)
if ( tAguaV.y > 0.5 && tH < -0.2 ) tH = min( tH, mix( tH, -0.3 * tAguaV.x - 1.0, smoothstep( 1.0, 2.0, tNivelMin ) ) );
vec3 objectNormal = tNV;
// fora do mapa (a moldura de serra e mar) não há normal nos dados: sai das alturas, por diferenças no passo do vértice,
// e o fragmento a interpola (a normal da face, de longe, virava facetas claras e escuras vistas do mapa inteiro)
if ( terDistFora( tW ) > 0.0 ) {
  float tE = max( tPassoEf, 8.0 );
  float tHx = terAltura( tW + vec2( tE, 0.0 ) ) - terAltura( tW - vec2( tE, 0.0 ) );
  float tHz = terAltura( tW + vec2( 0.0, tE ) ) - terAltura( tW - vec2( 0.0, tE ) );
  objectNormal = normalize( vec3( -tHx, 2.0 * tE, -tHz ) );
}
// onde a sombra de longe, o HAO e a sombra própria leem (a folga acima do chão, em vTer.w; GLSL_TER_VERTICE.fim). O
// campo de alturas é o chão sem a copa. Com o sol baixo, e no vértice que o campo põe na sombra, a leitura fica rente
// ao chão e a sombra longa dos morros sai inteira (lida no topo da copa, ou com folga, a sombra rasa se recortava em
// manchas ovais escuras). Com o sol alto e o vértice ao sol, a leitura sobe 1/5 da copa (rente ao chão, cada
// buraquinho se sombreava sozinho) e mais a flecha da malha grossa (no alto de um morro a corda do triângulo passa por
// baixo do chão de verdade e o campo sombreava o próprio morro)
float tLuzV = smoothstep( 0.4, 0.65, uTerCopaV.w );
if ( gCampoLigado > 0.5 ) {
  vec2 tUVC = ( tW - gCampoParams.xy ) * gCampoParams.z;
  if ( all( greaterThanEqual( tUVC, vec2( 0.0 ) ) ) && all( lessThanEqual( tUVC, vec2( 1.0 ) ) ) ) {
    vec4 tCampo = textureLod( gCampoMapa, tUVC, 0.0 );
    tLuzV *= 1.0 - smoothstep( 1.0, 4.0, mix( tCampo.r, tCampo.g, gCampoT ) - tHChao );
  }
}
vTer = vec4( tHChao, tCopa, tD, tLuzV * ( ${(1 - 0.8).toFixed(2)} * tCopa + min( ${f(TER_SOMBRA_FOLGA)} * tPassoEf, 16.0 ) ) );
`,
  // no lugar de begin_vertex
  posicao: /* glsl */ `
vec3 transformed = vec3( tW.x, tH + tCopa, tW.y );
`,
  // depois do vGPosMundo dos ganchos: a posição que a sombra de longe, o HAO, a sombra própria e a neblina leem fica
  // no chão debaixo da copa, mais a folga do vértice (vTer.w, ver acima). O fragmento refaz a posição desenhada
  // (terPos) para as derivadas e as projeções laterais.
  fim: /* glsl */ `
vGPosMundo.y += vTer.w - vTer.y;
`,
};

/**
 * Trechos do fragmento (pars e os pedaços que entram no MeshStandardMaterial). Três programas (PC3), um por malha do
 * CDLOD (terreno.js): o de perto (TER_DETALHE, nós a menos de uTerDetalhe.x da câmera) com as camadas do chão e as
 * manchas por pixel; o médio (sem TER_DETALHE) com a mata nítida, os tufos, o relevo das copas, a encosta e a pedra; e
 * o de longe (TER_LONGE) só com o mapa assado. O de perto e o médio dão a mesma imagem onde os dois valem: o médio só
 * não carrega o que é zero fora do alcance do detalhe.
 */
export const GLSL_TER_FRAGMENTO = {
  pars: /* glsl */ `
${GLSL_TER_COMUM}
${GLSL_TER_CAMADAS}
uniform highp sampler2D uTerCor;        // mapa de cor assado (sqrt do albedo, rugosidade)
uniform highp sampler2D uTerUso;        // uso do solo a 4 m: via, piso, terra batida, gramado
uniform highp sampler2D uTerSobre;      // sobreposição: células de zona, campo de camada ou ladrilhos
uniform vec4 uTerDetalhe;               // distância do detalhe, faixa, força do relevo, distância do relevo da copa
uniform vec4 uTerLonge;                 // caminho de longe: distância (m) em que começa e em que fica inteiro; alcance do relevo das copas (início, fim)
#ifdef TER_RELEVO_ASSADO
uniform highp sampler2D uTerRelevo;     // altura das copas grandes assada (vezes 1 / TER_RELEVO_MAX), para onde o caminho completo não chega
#endif
uniform vec4 uTerVegPerto;              // árvores de perto (R2b): alcance e faixa das árvores, alcance e faixa das moitas (0: nada)
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
varying vec4 vTer;
const float TER_RELEVO_MAX = ${f(TER_RELEVO_MAX)};
// inclinação (1 - normal y) a partir da qual o caminho completo roda também de longe (a mata e a pedra na projeção
// lateral); o perfil com o assado de 1 m por texel só precisa disso nas paredes (terreno.js, PERFIL_TERRENO.encosta)
#ifndef TER_INCL_ENCOSTA
#define TER_INCL_ENCOSTA 0.2
#endif

vec3 terNormalFinal;
vec3 terPos; // a posição desenhada (com a copa): vGPosMundo é a do chão (GLSL_TER_VERTICE.fim)
float terRug;
float terMasc;
vec3 terLinha;

// relevo fino por derivadas de tela (Mikkelsen), no espaço do mundo. A inclinação fica em até ~50 graus: onde a malha
// fica de lado para a normal do chão (a parede da copa levantada na borda da mata, a quina do costão) o det vai a zero
// e qualquer degrau do relevo dentro de um pixel deitaria a normal de vez; com det zero e relevo zero, o normalize de
// um vetor nulo dava NaN. dpx e dpy: as derivadas de terPos, já feitas no começo do fragmento
vec3 terRelevo( vec3 n, float h, vec3 dpx, vec3 dpy ) {
  float dhx = dFdx( h );
  float dhy = dFdy( h );
  // sem relevo na quadra de pixels (o longe, o campo raso), a normal fica a do chão (a mesma conta daria n)
  if ( dhx == 0.0 && dhy == 0.0 ) return n;
  vec3 r1 = cross( dpy, n );
  vec3 r2 = cross( n, dpx );
  float det = dot( dpx, r1 );
  vec3 g = sign( det ) * ( dhx * r1 + dhy * r2 );
  float ad = abs( det );
  float lg = length( g );
  if ( lg > 1.2 * ad ) g *= 1.2 * ad / lg;
  vec3 r = ad * n - g;
  return dot( r, r ) > 1e-24 ? normalize( r ) : n;
}

#ifdef TER_DETALHE
// detalhe de uma camada (índice da fatia, metros por repetição e o ganho que leva a média a 1)
vec4 terDetalhe( float fatia, float esc, vec3 ganho, vec3 ganhoB, vec2 w, vec2 dx, vec2 dy, bool ladoB ) {
  float s = 1.0 / esc;
  vec2 uv1 = w * s;
  mat2 rot = mat2( 0.8, -0.6, 0.6, 0.8 );
  float s2 = s * 0.38;
  vec2 uv2 = rot * w * s2 + vec2( 0.37, 0.71 );
  vec4 a;
  vec4 b;
#ifdef TER_AB
  if ( ladoB ) {
    a = textureGrad( uTerCamadasB, vec3( uv1, fatia ), dx * s, dy * s );
    b = textureGrad( uTerCamadasB, vec3( uv2, fatia ), rot * dx * s2, rot * dy * s2 );
    vec4 m = mix( a, b, smoothstep( 0.3, 0.7, terR3.w ) );
    return vec4( m.rgb * 2.0 * ganhoB, m.a );
  }
#endif
  a = textureGrad( uTerCamadas, vec3( uv1, fatia ), dx * s, dy * s );
  b = textureGrad( uTerCamadas, vec3( uv2, fatia ), rot * dx * s2, rot * dy * s2 );
  vec4 m = mix( a, b, smoothstep( 0.3, 0.7, terR3.w ) );
  return vec4( m.rgb * 2.0 * ganho, m.a );
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

  // no lugar de map_fragment: albedo, rugosidade, normal e sobreposições. Nível de detalhe do sombreador pela
  // distância (PC2): o caminho completo perto; de longe (de uTerLonge.x a uTerLonge.y, onde o pixel no chão já passou
  // do texel do assado) só o mapa assado, a normal dos dados, as encostas íngremes (mata e pedra na projeção lateral,
  // que de cima virariam listras) e as sobreposições. O que só existe perto (detalhe, tufos, relevo das copas e dos
  // matacões, a mata nítida, as manchas por pixel) entra com o peso kP, que cai a zero de longe. Cada parte cara fica
  // num ramo pela distância ou pelo tamanho do pixel (PC3): onde o peso dela é zero ela não roda, com a mesma imagem.
  cor: /* glsl */ `
terPos = vGPosMundo + vec3( 0.0, vTer.y - vTer.w, 0.0 );
vec2 tW = terPos.xz;
float tDist = vTer.z;
vec4 tDados = texture( uTerDados, terUVDados( tW ) );
vec2 tUVM = terUVMapa( tW );
bool tDentro = all( greaterThanEqual( tUVM, vec2( 0.0 ) ) ) && all( lessThanEqual( tUVM, vec2( 1.0 ) ) );
vec3 tN = terNormalDados( tDados );
// derivadas de tela, todas aqui (fora de qualquer "if": os dois caminhos desviam de pixel para pixel)
vec3 tPx = dFdx( terPos );
vec3 tPy = dFdy( terPos );
vec2 tDx = tPx.xz;
vec2 tDy = tPy.xz;
// normal da malha pelas derivadas; num triângulo visto de lado (a parede fina da copa levantada na borda da mata) o
// produto vetorial pode sair nulo ou infinito e o normalize dá NaN, que o mix com peso 0 não apaga (NaN vezes 0 é NaN)
vec3 tNFc = cross( tPx, tPy );
float tNFq = dot( tNFc, tNFc );
vec3 tNF = tNFq > 1e-24 && tNFq < 1e30 ? tNFc * inversesqrt( tNFq ) : tN;
tNF *= sign( tNF.y + 1e-5 );
// fora do mapa (a moldura de serra e mar) a normal vem do vértice
float tFora = smoothstep( 0.0, 200.0, terDistFora( tW ) );
if ( tFora > 0.0 ) tN = normalize( mix( tN, inverseTransformDirection( normalize( vNormal ), viewMatrix ), tFora ) );
float tIncl = 1.0 - tN.y;
// tamanho do pixel no chão em 3D (na encosta, a projeção em x e z subestima o pixel): decide até onde entra o relevo
// fino, que só vale com uns 4 pixels por forma (a normal por derivada é uma só em cada quadra de 2 x 2 pixels; com
// formas do tamanho do pixel ela vira chuvisco em quadradinhos), e o caminho de longe
float tPix = max( length( tPx ), length( tPy ) );
// o mapa assado: o chão inteiro de longe (camadas, vegetação e as manchas do campo) e a base do de perto
vec4 tCorLonge = texture( uTerCor, tUVM );
vec3 tAlb = tCorLonge.rgb * tCorLonge.rgb;
float tRug = uTerAssado16 > 0.5 ? 0.9 : tCorLonge.a;
// peso do caminho completo: 1 perto, 0 de longe (fora do mapa não há assado; o passe da máscara quer tudo). A malha
// dos nós de longe (TER_LONGE, terreno.js) só tem o caminho barato: kP constante e o compilador tira o resto
#ifdef TER_LONGE
const float kP = 0.0;
#else
float kP = tDentro && uTerMascara < 0.5 ? 1.0 - smoothstep( uTerLonge.x, uTerLonge.y, tDist ) : 1.0;
#endif
// médio (até uTerDetalhe.w): a mata nítida, as copas e o granito; o granito das paredes vai mais longe (são poucos
// pixels, e no assado de cima a parede vira listra)
float tMed = 1.0 - smoothstep( uTerDetalhe.w * 0.6, uTerDetalhe.w, tDist );
float tMedR = 1.0 - smoothstep( uTerDetalhe.w * 1.5, uTerDetalhe.w * 2.5, tDist );
// encosta íngreme o bastante para a mata na projeção lateral ou a pedra do paredão (o limiar mais baixo das duas; a
// malha de longe não tem encosta: terreno.js manda o nó íngreme para a de perto, INCL_ENCOSTA)
#ifdef TER_LONGE
const bool tEncosta = false;
#else
bool tEncosta = tDentro && tIncl > TER_INCL_ENCOSTA && tMedR > 0.0;
#endif
// a copa levantada faz paredes na borda da mata: ali (a normal da malha bem mais em pé que a do chão), tom de sombra e
// sem o relevo das copas (que esticaria); a encosta natural, mesmo íngreme, não entra
float tParede = smoothstep( 0.12, 0.35, tN.y - tNF.y ) * smoothstep( 0.5, 3.0, vTer.y );
float tRelH = 0.0; // altura do relevo fino (m) para a normal por derivadas lá embaixo
terMasc = 0.0;
// relevo das copas: os fatores que não dependem do caminho (só até a média, nada com o pixel acima de 2,5 m, nem na
// encosta íngreme, onde a projeção de cima as esticaria em riscos, nem na parede da copa levantada). Onde o caminho
// completo não chega (o assado do perfil é mais fino que o alcance do relevo, PC3: uTerLonge.zw vai além de .xy), a
// altura das copas grandes vem do assado de relevo, com o peso que falta até o alcance de antes; sem o assado de
// relevo, zw = xy e o peso dele é zero
float tFatorCopa = tMed * ( 1.0 - smoothstep( 0.9, 2.5, tPix ) ) * ( 1.0 - smoothstep( 0.22, 0.45, tIncl ) ) * ( 1.0 - tParede );
float tWRel = tDentro && uTerMascara < 0.5 ? 1.0 - smoothstep( uTerLonge.z, uTerLonge.w, tDist ) : 0.0;
float tCopaRel = 0.0;
#ifdef TER_RELEVO_ASSADO
float tWAssado = max( tWRel - kP, 0.0 ) * tFatorCopa;
if ( tWAssado > 0.0 ) tCopaRel = textureGrad( uTerRelevo, tUVM, tDx * uTerMapa.w, tDy * uTerMapa.w ).r * TER_RELEVO_MAX * tWAssado;
#endif
#ifndef TER_LONGE
if ( uTerVegPerto.x > 0.0 && uTerMascara < 0.5 ) {
  terKArv = smoothstep( uTerVegPerto.x - uTerVegPerto.y, uTerVegPerto.x, tDist );
  terKMoita = smoothstep( uTerVegPerto.z - uTerVegPerto.w, uTerVegPerto.z, tDist );
}
if ( kP > 0.0 || tEncosta ) {
  terRuidosGrad( tW, tDx, tDy );
  // (sem mipmaps: a leitura não depende das derivadas; a R3a reconhece esta linha para apagar a via perto da câmera)
  vec4 tUso = texture( uTerUso, tUVM );
  // a água filtrada serve longe dela (a distância satura em 254 m); perto da água, e onde a filtragem mistura a marca
  // do mar com a distância (a linha de "mar a 126 m" no meio do campo), a leitura é a exata
  vec2 tAgua = terAgua( tDados.a );
  if ( tDentro && tAgua.x < 250.0 ) tAgua = terAguaExata( tW );
  TerEntrada tE = TerEntrada( tW, vTer.x, tN, tDados.b, tAgua.x, tAgua.y, tDentro ? tUso : vec4( 0.0 ) );
  terPreparar( tE );
  float tParedao = terParedao( tIncl, terR3.x );
  if ( !tDentro ) {
    vec4 tm = terMisturaLinear( tE );
    tAlb = tm.rgb;
    tRug = tm.a;
  }
  // a vegetação pintada, uma vez: o detalhe de perto e a mata nítida usam a mesma
  bool tComVeg = tMed > 0.0 && tDentro;
  vec3 cVeg = vec3( 0.0 );
  float tVeg = 0.0;
  if ( tComVeg ) tVeg = terVegetacao( tE, cVeg );
  float tRel = 0.0;
  float tPerto = 0.0;
  vec3 aPerto = vec3( 0.0 );
#ifdef TER_DETALHE
  float p[ ${N_CAMADAS} ];
  vec3 c[ ${N_CAMADAS} ];
  float asf = 0.0;
  float jar = 0.0;
  tPerto = ( 1.0 - smoothstep( uTerDetalhe.x - uTerDetalhe.y, uTerDetalhe.x, tDist ) ) * kP;
  if ( tPerto > 0.0 && tDentro ) {
    terPesos( tE, p, asf, jar );
    terCores( tE, p, asf, jar, c );
    // as duas camadas de maior peso, escolhidas com índices fixos (o laço desenrolado vira seleção; sem vetor indexado
    // por variável, que no Direct3D vai para a memória temporária): a primeira com o maior peso, a segunda com o
    // maior entre as outras (empate: a de menor índice, como antes)
    float m1 = p[ 0 ];
    float k1 = 0.0;
    vec3 c1 = c[ 0 ];
    float rug1 = TER_RUG[ 0 ];
    float rel1 = TER_RELEVO[ 0 ];
    float esc1 = TER_ESC[ 0 ];
    vec3 g1 = uTerGanho[ 0 ];
    vec3 gB1 = vec3( 1.0 );
#ifdef TER_AB
    gB1 = uTerGanhoB[ 0 ];
#endif
    for ( int i = 1; i < ${N_CAMADAS}; i ++ ) {
      if ( p[ i ] > m1 ) {
        m1 = p[ i ];
        k1 = float( i );
        c1 = c[ i ];
        rug1 = TER_RUG[ i ];
        rel1 = TER_RELEVO[ i ];
        esc1 = TER_ESC[ i ];
        g1 = uTerGanho[ i ];
#ifdef TER_AB
        gB1 = uTerGanhoB[ i ];
#endif
      }
    }
    float m2 = -1.0;
    float k2 = 0.0;
    vec3 c2 = vec3( 0.0 );
    float rug2 = 0.0;
    float rel2 = 0.0;
    float esc2 = 1.0;
    vec3 g2 = vec3( 1.0 );
    vec3 gB2 = vec3( 1.0 );
    for ( int i = 0; i < ${N_CAMADAS}; i ++ ) {
      if ( float( i ) != k1 && p[ i ] > m2 ) {
        m2 = p[ i ];
        k2 = float( i );
        c2 = c[ i ];
        rug2 = TER_RUG[ i ];
        rel2 = TER_RELEVO[ i ];
        esc2 = TER_ESC[ i ];
        g2 = uTerGanho[ i ];
#ifdef TER_AB
        gB2 = uTerGanhoB[ i ];
#endif
      }
    }
    bool ladoB = false;
#ifdef TER_AB
    ladoB = uTerAB.y > 0.5 && gl_FragCoord.x > uTerAB.x;
#endif
    vec4 d1 = terDetalhe( k1, esc1, g1, gB1, tW, tDx, tDy, ladoB );
    vec4 d2 = terDetalhe( k2, esc2, g2, gB2, tW, tDx, tDy, ladoB );
    float q = m1 + m2;
    float a1 = m1 / q + d1.a * 0.6;
    float a2 = m2 / q + d2.a * 0.6;
    float corte = max( a1, a2 ) - 0.22;
    float b1 = max( a1 - corte, 0.0 );
    float b2 = max( a2 - corte, 0.0 );
    float bs = b1 + b2;
    aPerto = ( c1 * d1.rgb * b1 + c2 * d2.rgb * b2 ) / bs;
    float rPerto = ( rug1 * b1 + rug2 * b2 ) / bs;
    terAcabamentoV( tE, aPerto, rPerto, false, p, 0.0, vec4( 0.5 ), vec4( 0.5 ), tVeg, cVeg );
    float copaP = terCopa( tE.mata );
    tRel = mix( ( d1.a * rel1 * b1 + d2.a * rel2 * b2 ) / bs, 0.0, copaP ) * tPerto;
    tAlb = mix( tAlb, aPerto, tPerto );
    tRug = mix( tRug, rPerto, tPerto );
  }
#endif
  // médio: por pixel entram a mata nítida (o assado a borra), as copas e, de perto, a textura do campo entre 1 e 25 m e
  // os tufos; de longe, só nas encostas íngremes (a mata na projeção lateral)
  float tRelVeg = 0.0; // relevo dos tufos da vegetação de perto (m)
  if ( tComVeg ) {
    // mata na encosta íngreme: a cor das copas numa projeção lateral pelas duas faces (de cima ela esticaria em
    // manchas verticais, como tinta escorrendo); 4 leituras só nesses pixels, com as derivadas de fora do "if"
    float tIngreme = smoothstep( 0.22, 0.42, tIncl ) * step( 0.001, tVeg );
    if ( tIngreme > 0.0 ) {
      float lx = abs( tN.x ) / ( abs( tN.x ) + abs( tN.z ) + 1e-4 );
      const float e2 = 1.0 / 263.0;
      const float e3 = 1.0 / 71.0;
      vec4 r2 = mix( textureGrad( uTerRuido, terPos.xy * e2 + vec2( 0.31, 0.17 ), tPx.xy * e2, tPy.xy * e2 ),
        textureGrad( uTerRuido, terPos.zy * e2 + vec2( 0.31, 0.17 ), tPx.zy * e2, tPy.zy * e2 ), lx );
      vec4 r3 = mix( textureGrad( uTerRuido, terPos.xy * e3 + vec2( 0.57, 0.83 ), tPx.xy * e3, tPy.xy * e3 ),
        textureGrad( uTerRuido, terPos.zy * e3 + vec2( 0.57, 0.83 ), tPx.zy * e3, tPy.zy * e3 ), lx );
      cVeg = mix( cVeg, copaCor( r2, r3, terR1 ), tIngreme );
    }
    // os tufos (até o pixel de 1,4 m) e, no alcance do detalhe, as manchas do campo: as duas leituras do ruído fino só
    // onde uma delas vale
#ifdef TER_DETALHE
    bool tComManchas = kP > 0.0 && ( tPix < 1.4 || tPerto > 0.0 );
#else
    bool tComManchas = kP > 0.0 && tPix < 1.4;
#endif
    if ( tComManchas ) {
      vec4 mA = textureGrad( uTerRuido, TER_ROT_A * tW * ( 1.0 / 23.0 ) + vec2( 0.13, 0.71 ), TER_ROT_A * tDx * ( 1.0 / 23.0 ), TER_ROT_A * tDy * ( 1.0 / 23.0 ) );
      vec4 mB = textureGrad( uTerRuido, TER_ROT_B * tW * ( 1.0 / 8.3 ) + vec2( 0.52, 0.09 ), TER_ROT_B * tDx * ( 1.0 / 8.3 ), TER_ROT_B * tDy * ( 1.0 / 8.3 ) );
#ifdef TER_DETALHE
      // as manchas do campo, do solo, da areia e dos pisos já estão no assado: por pixel só na parte pintada pelas
      // camadas de perto
      if ( tPerto > 0.0 ) tAlb += aPerto * ( terManchas( p, asf, tVeg, mA, mB ) - 1.0 ) * ( tPerto * tMed );
#endif
      // de perto, os tufos de 1 a 2 m das moitas e das copas, com o vão escuro entre eles (senão a moita pintada vira
      // um feltro liso); vêm de cima: na encosta íngreme esticariam em riscos, então ali saem
      float tufoV = smoothstep( 0.0, 0.55, mA.z ) * ( 0.8 + 0.4 * mB.w );
      float planoV = 1.0 - smoothstep( 0.22, 0.42, tIncl );
      float pertoV = ( 1.0 - smoothstep( 0.4, 1.4, tPix ) ) * planoV * kP;
      cVeg *= mix( 1.0, 0.62 + 0.55 * tufoV, pertoV );
      // relevo dos tufos de ~1,4 m: só com o pixel abaixo de ~0,3 m
      tRelVeg = tVeg * tMed * planoV * ( 1.0 - smoothstep( 0.12, 0.35, tPix ) ) * ( 0.9 * tufoV + 0.25 * mB.x ) * kP;
    }
    // a mata nítida perto; de longe, só onde a encosta pede a projeção lateral
    tAlb = mix( tAlb, cVeg, terCobVeg( tVeg, cVeg ) * tMed * max( kP, tIngreme ) );
  }
  // granito do paredão e do costão: projeção lateral onde é íngreme (riscos verticais da chuva, líquen, mato nas
  // fendas) e de cima onde é suave (matacões de 1 a 3 m); a faixa molhada escurece junto da água
  float tCostaoP = terCst;
  float pr = max( tParedao * tMedR, smoothstep( 0.3, 0.7, tCostaoP ) * tMed * kP ) * ( 1.0 - terUrb ) * ( tDentro ? 1.0 : 0.0 );
  float tRelRocha = 0.0; // relevo dos matacões do costão (m)
  if ( pr > 0.0 ) {
    vec3 an = abs( tN );
    float wx = an.x / ( an.x + an.z + 1e-4 );
    float wy = smoothstep( 0.55, 0.85, an.y );
    const vec2 esc = vec2( 1.0 / 19.0, 1.0 / 83.0 );
    vec4 sX = textureGrad( uTerRuido, terPos.zy * esc, tPx.zy * esc, tPy.zy * esc );
    vec4 sZ = textureGrad( uTerRuido, terPos.xy * esc + vec2( 0.37, 0.11 ), tPx.xy * esc, tPy.xy * esc );
    vec4 sY = textureGrad( uTerRuido, tW * ( 1.0 / 41.0 ) + vec2( 0.71, 0.29 ), tDx * ( 1.0 / 41.0 ), tDy * ( 1.0 / 41.0 ) );
    vec4 sR = mix( mix( sZ, sX, wx ), sY, wy );
    // costão (a pedra da maresia) em vez de paredão: blocos em qualquer inclinação, menos risco de chuva
    float kc = smoothstep( 0.3, 0.7, tCostaoP );
    float risco = smoothstep( 0.45, 0.78, sR.y ) * ( 1.0 - wy ) * ( 1.0 - 0.7 * kc );
    float liquen = smoothstep( 0.6, 0.82, sR.x );
    float mato = smoothstep( 0.6, 0.78, sR.z * 0.6 + terR3.z * 0.4 ) * ( 1.0 - smoothstep( 0.5, 0.72, tIncl ) ) * ( 1.0 - smoothstep( 0.5, 0.9, tCostaoP ) );
    // matacões de 3 a 6 m: as "copas" do canal B numa projeção pela face dominante (a mistura das coordenadas torce
    // um pouco a textura onde a face gira, o que na pedra passa por natural), fresta escura entre os blocos
    const float escM = 1.0 / 90.0;
    vec2 uvM = mix( mix( terPos.xy, terPos.zy, wx ), tW, wy ) * escM + vec2( 0.13, 0.57 );
    vec4 sM = textureGrad( uTerRuido, uvM, mix( mix( tPx.xy, tPx.zy, wx ), tDx, wy ) * escM, mix( mix( tPy.xy, tPy.zy, wx ), tDy, wy ) * escM );
    float bloco = mix( mix( 1.0, 0.55 + 0.6 * smoothstep( 0.02, 0.35, sR.z ), wy ), 0.5 + 0.62 * smoothstep( 0.0, 0.32, sM.z ), kc );
    // na parede, o escorrimento e o líquen preto riscam o granito de cima a baixo (como no Pão de Açúcar)
    vec3 granito = TER_COR[ 4 ] * ( 0.66 + 0.46 * sR.w ) * ( 1.0 - ( 0.3 + 0.28 * ( 1.0 - wy ) ) * risco ) * bloco;
    granito = mix( granito, TER_COR[ 4 ] * mix( vec3( 1.2, 1.18, 1.1 ), vec3( 0.42, 0.42, 0.4 ), 1.0 - wy ), liquen * 0.3 );
    // costão: pardo de maresia e ferrugem em manchas e a faixa preta de liquens logo acima da água (2 a 5 m)
    granito *= mix( vec3( 1.0 ), vec3( 0.8, 0.75, 0.68 ) * ( 0.82 + 0.36 * sM.x ), kc );
    granito *= 1.0 - 0.62 * kc * ( 1.0 - smoothstep( 1.5 + 1.5 * sM.y, 3.5 + 2.5 * sM.y, vTer.x ) );
    granito *= 1.0 - 0.45 * ( 1.0 - smoothstep( 0.4, 2.2, vTer.x ) ) * tCostaoP;
    // mato nas fendas: o verde das copas sem os vãos escuros entre elas (a mancha tem ~1 m; o vão de mata fechada
    // pintava parte delas quase preta)
    vec3 matoCor = copaCor( vec4( terR2.xy, 0.6, terR2.w ), vec4( terR3.xy, 0.6, terR3.w ), terR1 ) * ( 0.8 + 0.3 * sR.w );
    granito = mix( granito, matoCor, mato * 0.85 );
    tAlb = mix( tAlb, granito, pr );
    tRug = mix( tRug, mix( 0.68, 0.82, mato ), pr );
    // os blocos têm volume: a luz do sol modela cada um (e quebra as faixas das linhas da malha na parede); a borda
    // de um bloco de 3 a 6 m tem ~1 m, então o relevo some com o pixel acima de ~0,3 m (a 330 m, com 1.376 pixels,
    // o pixel já tem ~0,37 m e o relevo desenhava tracinhos pretos e brancos na pedra)
    tRelRocha = 1.6 * smoothstep( 0.0, 0.32, sM.z ) * kc * pr * ( 1.0 - mato ) * ( 1.0 - smoothstep( 0.12, 0.3, tPix ) );
  }
  // relevo das copas (só no caminho completo): some quando um pixel cobre mais que uns 2 m (derivada de tela
  // serrilharia com o sol baixo); na encosta a projeção de cima estica as copas em riscos (escamas com o sol rasante):
  // ali o relevo delas some; as copas pequenas (4 m) só com o pixel abaixo de ~0,5 m (a 700 m, com o sol baixo, a
  // normal por quadra de 2 x 2 pixels desenhava um xadrez claro e escuro na encosta); as grandes (16 m) seguem até o
  // pixel de ~2 m (de 2,5 m para cima o peso é zero e a conta não roda)
  // sem o assado de relevo (o de perto e os perfis sem ele) o pixel faz também a parte do assado: kP + max( tWRel - kP, 0 )
  if ( kP > 0.0 && tPix < 2.5 ) {
#ifdef TER_RELEVO_ASSADO
    float tPesoCopa = kP;
#else
    float tPesoCopa = max( kP, tWRel );
#endif
    tCopaRel += copaRelevo( terR2, terR3, terR1, 1.0 - smoothstep( 0.3, 0.8, tPix ) ) * max( terCopa( tE.mata ) * ( 1.0 - smoothstep( 0.35, 0.8, tCostaoP ) ) * ( 1.0 - tParedao ), tVeg * 0.8 )
      * tFatorCopa * tPesoCopa;
  }
  tRelH = tRel + tRelRocha + tRelVeg;
  if ( uTerMascara > 0.5 ) terMasc = terGramado( tE );
}
#endif
// o relevo por derivada não faz sombra própria: as copas ficam em 0,65 da altura para não virarem escamas no sol baixo
tRelH += tCopaRel * 0.65;
tAlb *= 1.0 - 0.45 * tParede;
terNormalFinal = terRelevo( tN, tRelH * uTerDetalhe.z, tPx, tPy );
terRug = tRug;

// sobreposições no chão (0 chamadas: tudo por uniforme e textura; nada lido sem uma ligada)
terLinha = vec3( 0.0 );
if ( uTerSobreModo.z > 0.0 ) {
  float lum = dot( tAlb, vec3( 0.2126, 0.7152, 0.0722 ) );
  tAlb = mix( tAlb, vec3( lum * 1.1 + 0.04 ), 0.82 * uTerSobreModo.z );
}
float tModo = uTerSobreModo.x;
if ( tModo > 0.5 ) {
  vec2 tUVS = ( tW - uTerSobreRet.xy ) * uTerSobreRet.zw;
  bool tNaSobre = all( greaterThanEqual( tUVS, vec2( 0.0 ) ) ) && all( lessThan( tUVS, vec2( 1.0 ) ) );
  vec4 tS = texture( uTerSobre, tUVS );
  float tNivel = abs( fract( tS.r * 10.0 + 0.5 ) - 0.5 ) / max( fwidth( tS.r * 10.0 ), 1e-4 );
  if ( tModo < 1.5 && tNaSobre ) {
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

/** Vértice dos passes em tela cheia (assado, ambiente, geração). */
const GLSL_ASSAR_VERTICE = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

// ------------------------------------------------------------------------------------------------ luz do ambiente

/**
 * Luz do ambiente do chão (PC3): a mesma conta do three (getIBLIrradiance e getIBLRadiance sobre o PMREM em cubo UV),
 * com o cubo lido antes, uma vez por quadro, num atlas pequeno: AMB_NIVEIS níveis de desfoque do PMREM (os mips -2 a 2
 * do textureCubeUV, as rugosidades de 1 a 0,4 que o chão usa) em octaedros de AMB_LADO x AMB_LADO (y para cima no
 * centro). No pixel ficam três leituras simples (a irradiância e os dois níveis da reflexão) no lugar das contas de
 * face e de mip do cubo UV, com a mesma imagem.
 */
export const AMB_LADO = 32;
export const AMB_NIVEIS = 5;

/** Direção do octaedro (y para cima no centro) e o caminho de volta, iguais no passe e no chão. */
const GLSL_OCTAEDRO = /* glsl */ `
vec2 terOct( vec3 d ) {
  vec3 a = abs( d );
  vec2 p = d.xz / ( a.x + a.y + a.z );
  if ( d.y < 0.0 ) p = ( 1.0 - abs( p.yx ) ) * vec2( p.x >= 0.0 ? 1.0 : -1.0, p.y >= 0.0 ? 1.0 : -1.0 );
  return p * 0.5 + 0.5;
}
vec3 terOctDir( vec2 o ) {
  vec2 p = o * 2.0 - 1.0;
  vec3 d = vec3( p.x, 1.0 - abs( p.x ) - abs( p.y ), p.y );
  if ( d.y < 0.0 ) d.xz = ( 1.0 - abs( d.zx ) ) * vec2( d.x >= 0.0 ? 1.0 : -1.0, d.z >= 0.0 ? 1.0 : -1.0 );
  return normalize( d );
}
`;

/** Passe do atlas (ShaderMaterial em tela cheia; os defines do cubo UV vêm do PMREM, como no three). */
export const GLSL_AMB_PASSE = {
  vertice: GLSL_ASSAR_VERTICE,
  fragmento: /* glsl */ `
uniform sampler2D envMap;
uniform mat3 envMapRotation;
uniform float envMapIntensity;
in vec2 vUv;
#include <cube_uv_reflection_fragment>
${GLSL_OCTAEDRO}
void main() {
  float x = vUv.x * ${f(AMB_NIVEIS)};
  float nivel = floor( x );
  // centro do texel nas bordas do octaedro (o chão lê do mesmo jeito)
  vec2 t = vec2( x - nivel, vUv.y ) * ${f(AMB_LADO)};
  vec2 o = clamp( ( t - 0.5 ) / ${f(AMB_LADO - 1)}, 0.0, 1.0 );
  vec3 c = bilinearCubeUV( envMap, envMapRotation * terOctDir( o ), nivel - 2.0 ) * envMapIntensity;
  gl_FragColor = vec4( c, 1.0 );
}
`,
};

/** O que o chão lê do atlas (no lugar de lights_fragment_maps do MeshStandardMaterial). */
export const GLSL_AMB_CHAO = {
  pars: /* glsl */ `
uniform highp sampler2D uTerAmb;  // atlas da luz do ambiente (GLSL_AMB_PASSE)
${GLSL_OCTAEDRO}
vec3 terAmb( vec3 d, float nivel ) {
  vec2 t = ( terOct( d ) * ${f(AMB_LADO - 1)} + 0.5 ) / ${f(AMB_LADO)};
  return textureLod( uTerAmb, vec2( ( nivel + t.x ) / ${f(AMB_NIVEIS)}, t.y ), 0.0 ).rgb;
}
// o mip do PMREM pela rugosidade (roughnessToMip do three, nos trechos de 1 a 0,4), contado do nível 0 do atlas
float terAmbNivel( float r ) {
  return clamp( r >= 0.8 ? ( 1.0 - r ) * 5.0 : ( 0.8 - r ) * 7.5 + 1.0, 0.0, ${f(AMB_NIVEIS - 1)} );
}
`,
  luz: /* glsl */ `
#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
#if defined( RE_IndirectDiffuse )
iblIrradiance += 3.141592653589793 * terAmb( inverseTransformDirection( geometryNormal, viewMatrix ), 0.0 );
#endif
#if defined( RE_IndirectSpecular )
{
  vec3 tRefl = reflect( - geometryViewDir, geometryNormal );
  tRefl = inverseTransformDirection( normalize( mix( tRefl, geometryNormal, pow4( material.roughness ) ) ), viewMatrix );
  float tNv = terAmbNivel( material.roughness );
  float tN0 = floor( tNv );
  radiance += mix( terAmb( tRefl, tN0 ), terAmb( tRefl, min( tN0 + 1.0, ${f(AMB_NIVEIS - 1)} ) ), tNv - tN0 );
}
#endif
#endif
`,
};

// ------------------------------------------------------------------------------------------------ passe do assado

/**
 * Mapa de cor assado: um quadrado na tela inteira do alvo; cada texel é um ponto do mapa (4 m no Média, 2 m no PC),
 * com as camadas, a vegetação e as manchas do campo: é o chão de longe inteiro (PC2).
 */
export const GLSL_ASSAR = {
  vertice: GLSL_ASSAR_VERTICE,
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
  vec4 mA = texture( uTerRuido, TER_ROT_A * w * ( 1.0 / 23.0 ) + vec2( 0.13, 0.71 ) );
  vec4 mB = texture( uTerRuido, TER_ROT_B * w * ( 1.0 / 8.3 ) + vec2( 0.52, 0.09 ) );
  vec4 m = terMistura( e, true, mA, mB );
  vec3 c = sqrt( clamp( m.rgb, 0.0, 1.0 ) );
  // 16 bits (RGB565): pontilhado de um degrau antes de cortar para 5 bits (vermelho e azul) e 6 (verde): o degrau vira
  // grão, não faixa
  if ( uTerAssado16 > 0.5 ) {
    float hd = fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) - 0.5;
    c = clamp( c + hd * vec3( 1.0 / 31.0, 1.0 / 63.0, 1.0 / 31.0 ), 0.0, 1.0 );
  }
  gl_FragColor = vec4( c, m.a );
}
`,
};

/**
 * Assado do relevo das copas (PC3): a altura das copas grandes (16 m) onde a vegetação cobre, a mesma conta do
 * caminho completo sem as copas pequenas (que só valem com o pixel abaixo de 0,8 m, sempre no caminho completo). O
 * caminho barato lê dela o relevo das copas até o alcance que ele tinha (uTerLonge.zw).
 */
export const GLSL_ASSAR_RELEVO = {
  vertice: GLSL_ASSAR_VERTICE,
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
  terPreparar( e );
  vec3 cv;
  float veg = terVegetacao( e, cv );
  float cob = max( terCopa( e.mata ) * ( 1.0 - smoothstep( 0.35, 0.8, terCst ) ) * ( 1.0 - terParedao( 1.0 - e.n.y, terR3.x ) ), veg * 0.8 );
  gl_FragColor = vec4( clamp( copaRelevo( terR2, terR3, terR1, 0.0 ) * cob / ${f(TER_RELEVO_MAX)}, 0.0, 1.0 ), 0.0, 0.0, 1.0 );
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
