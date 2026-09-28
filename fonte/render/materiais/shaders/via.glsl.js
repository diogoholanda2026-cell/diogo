// GLSL das vias (desenho do render 4.4 e 9.1), dos carros e dos objetos da rua. Trechos que entram por onBeforeCompile
// no MeshStandardMaterial (luz, sombra própria, neblina e os outros ganchos seguem do three e de motor/ganchos.js).
//
// Material `via`: tudo no shader, sem textura pintada nem decalque.
//   asfalto   agregado, manchas, remendos retangulares, fissuras, trilha de pneu mais escura e lisa no meio de cada
//             faixa e óleo entre as trilhas; novo (0,05) a gasto (0,12) pelo desgaste da aresta
//   marcas    as do CTB por tipo (tabelas constantes geradas de perfilVia.js): eixo amarelo seccionado, divisão
//             branca seccionada, bordos contínuos, estacionamento, faixa de pedestres (zebra) e linha de retenção
//             nas bocas; filtradas pela área do pixel (caixa integrada com fwidth), gastas com o desgaste
//   calçada   concreto em placas com faixa de serviço, ou pedra portuguesa em ondas (bit PEDRA); meio-fio de
//             concreto; sarjeta de concreto junto do meio-fio; canteiro de grama; barreira; talude; chão batido
//   noite     a luz da rua (mapa de luz, render/mundo/luzRua.js) acende o chão
//   camada    pinta a pista pelo valor da aresta (tabela por aId, X3a) e deixa a calçada neutra
// O vértice leva a via um pouco para a câmera, proporcional à distância (viés de profundidade na faixa de troca com o
// chão pintado, onde o CDLOD grosso pode passar da cota da pista).
import { PERFIS, MAT, ESTILO, COR_LINHA } from '../../geracao/perfilVia.js';
import { BITS } from '../../geracao/malhaVia.js';

const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
const MAX_LINHAS = 8;
const MAX_FAIXAS = 6;

/** Tabelas constantes por tipo (a ordem de VIAS_ORDEM). */
function tabelas() {
  const linhas = [];
  const traco = [];
  const faixas = [];
  const ret = [];
  const sarjeta = [];
  for (const P of PERFIS) {
    for (let k = 0; k < MAX_LINHAS; k++) {
      const l = P.linhas[k];
      linhas.push(l ? `vec4( ${f(+l.u.toFixed(4))}, ${f(l.largura)}, ${f(l.cor)}, ${f(l.estilo)} )` : 'vec4( 0.0, 0.0, 0.0, -1.0 )');
    }
    traco.push(`vec2( ${f(P.tracejado[0])}, ${f(P.tracejado[1])} )`);
    for (let k = 0; k < MAX_FAIXAS; k++) faixas.push(P.faixas[k] ? f(+P.faixas[k].meio.toFixed(4)) : '999.0');
    const rng = (s) => {
      const fx = P.faixas.filter((x) => x.sentido === s);
      if (!fx.length) return [0, 0];
      return [Math.min(...fx.map((x) => x.u0)), Math.max(...fx.map((x) => x.u1))];
    };
    const [a0, a1] = rng(-1);
    const [b0, b1] = rng(1);
    ret.push(`vec4( ${f(a0)}, ${f(a1)}, ${f(b0)}, ${f(b1)} )`);
    sarjeta.push(P.meioFio ? '1.0' : '0.0');
  }
  const n = PERFIS.length;
  return /* glsl */ `
const vec4 VIA_LINHAS[ ${n * MAX_LINHAS} ] = vec4[ ${n * MAX_LINHAS} ]( ${linhas.join(', ')} );
const vec2 VIA_TRACO[ ${n} ] = vec2[ ${n} ]( ${traco.join(', ')} );
const float VIA_FAIXAS[ ${n * MAX_FAIXAS} ] = float[ ${n * MAX_FAIXAS} ]( ${faixas.join(', ')} );
const vec4 VIA_RET[ ${n} ] = vec4[ ${n} ]( ${ret.join(', ')} );
const float VIA_SARJETA[ ${n} ] = float[ ${n} ]( ${sarjeta.join(', ')} );
`;
}

const defs = [
  ...Object.entries(MAT).map(([k, v]) => `#define VM_${k} ${f(v)}`),
  ...Object.entries(BITS).map(([k, v]) => `#define VB_${k} ${v}`),
  `#define VE_CONTINUA ${f(ESTILO.CONTINUA)}`,
  `#define VE_TRACEJADA ${f(ESTILO.TRACEJADA)}`,
  `#define VE_ESTACIONAMENTO ${f(ESTILO.ESTACIONAMENTO)}`,
  `#define VC_AMARELA ${f(COR_LINHA.AMARELA)}`,
  `#define VIA_TERRA ${f(PERFIS.findIndex((p) => p.terra))}`,
  `#define VIA_RODOVIA ${f(PERFIS.findIndex((p) => p.barreira))}`,
].join('\n');

// ------------------------------------------------------------------------------------------------ via: vértice

/** Vértice: declarações (depois do #include <common>). */
export const VIA_VERTICE_PARS = /* glsl */ `
#define VIA
attribute vec4 aUV;         // u lateral, v desde o corte do início, v até o corte do fim, b (distância na banda)
attribute vec4 aDados;      // material, tipo, marcas, AO (0..255)
attribute uint aId;         // idx da aresta
uniform highp sampler2D gViaTab;   // tabela das arestas (RGBA8 256²): camada, bits, desgaste, livre
uniform vec4 gViaLonge;            // esmaecer as marcas de x a y (m); viés: k1, k2
varying vec4 vUV;
flat varying vec4 vDados;          // material, tipo, marcas, desgaste
flat varying vec4 vIdent;          // idx, bits, camada, livre
varying float vAO;
vec3 viaOct( vec2 e ) {
  vec3 v = vec3( e, 1.0 - abs( e.x ) - abs( e.y ) );
  if ( v.z < 0.0 ) v.xy = ( 1.0 - abs( v.yx ) ) * ( step( 0.0, v.xy ) * 2.0 - 1.0 );
  return normalize( v.xzy );
}
`;

/** Vértice: normal octaédrica (troca o #include <beginnormal_vertex>). */
export const VIA_VERTICE_NORMAL = /* glsl */ `
vec3 objectNormal = viaOct( normal.xy );
#ifdef USE_TANGENT
  vec3 objectTangent = vec3( tangent.xyz );
#endif
`;

/** Vértice: leitura da tabela da aresta (depois do #include <begin_vertex>). */
export const VIA_VERTICE_MAIN = /* glsl */ `
{
  vec4 gT = texelFetch( gViaTab, ivec2( int( aId % 256u ), int( aId / 256u ) ), 0 );
  vUV = aUV;
  vDados = vec4( aDados.xyz, gT.b );
  vIdent = vec4( float( aId ), floor( gT.g * 255.0 + 0.5 ), floor( gT.r * 255.0 + 0.5 ), 0.0 );
  vAO = aDados.w / 255.0;
}
`;

/** Vértice: viés de profundidade pela distância (depois do #include <project_vertex>). */
export const VIA_VERTICE_VIES = /* glsl */ `
{
  float gVd = length( mvPosition.xyz );
  mvPosition.xyz *= 1.0 - min( 0.02, gViaLonge.z + gViaLonge.w * gVd );
  gl_Position = projectionMatrix * mvPosition;
}
`;

// ------------------------------------------------------------------------------------------------ via: fragmento

/** Fragmento: declarações e as funções (depois do #include <common>). */
export const VIA_FRAGMENTO_PARS = /* glsl */ `
#define VIA
${defs}
${tabelas()}
uniform highp sampler2D gViaDetalhe;   // R agregado, G manchas, B fissuras, A pedras (periódica, 4 m)
uniform highp sampler2D gLuzRua;       // luz da rua (RGB linear / 4), mapa inteiro
uniform vec4 gLuzRuaMapa;              // ox, oz, 1 / lado, intensidade (0 de dia)
uniform vec4 gViaLonge;
uniform vec4 gViaCamada;               // ligada, n cores, categórica, livre
uniform vec3 gViaRampa[ 8 ];
uniform float gViaMascara;
varying vec4 vUV;
flat varying vec4 vDados;
flat varying vec4 vIdent;
varying float vAO;
float gViaRug = 0.85;
float gViaGrama = 0.0;

// linha de centro c e largura l filtrada pela área do pixel (caixa integrada)
float viaLinha( float x, float c, float l ) {
  float fw = max( fwidth( x ), 1e-4 );
  float a = max( x - 0.5 * fw, c - 0.5 * l );
  float b = min( x + 0.5 * fw, c + 0.5 * l );
  return clamp( ( b - a ) / fw, 0.0, 1.0 );
}
// integral da onda quadrada (traço t, período p) até x
float viaOndaI( float x, float t, float p ) { return floor( x / p ) * t + min( mod( x, p ), t ); }
// cobertura de um tracejado em x (traço t de período p) na área do pixel
float viaTraco( float x, float t, float p ) {
  float fw = max( fwidth( x ), 1e-4 );
  return clamp( ( viaOndaI( x + 0.5 * fw, t, p ) - viaOndaI( x - 0.5 * fw, t, p ) ) / fw, 0.0, 1.0 );
}
float viaFaixa( float x, float a, float b ) {
  float fw = max( fwidth( x ), 1e-4 );
  return clamp( ( min( x + 0.5 * fw, b ) - max( x - 0.5 * fw, a ) ) / fw, 0.0, 1.0 );
}
float viaHash( vec2 p ) {
  p = fract( p * vec2( 0.1031, 0.1030 ) );
  p += dot( p, p.yx + 33.33 );
  return fract( ( p.x + p.y ) * p.x );
}
bool viaBit( float marcas, int b ) { return ( int( marcas + 0.5 ) & b ) != 0; }

const vec3 VIA_ASF_NOVO = vec3( 0.045, 0.046, 0.05 );
const vec3 VIA_ASF_GASTO = vec3( 0.13, 0.125, 0.117 );
const vec3 VIA_CONCRETO = vec3( 0.34, 0.33, 0.305 );
const vec3 VIA_MEIO_FIO = vec3( 0.42, 0.41, 0.385 );
const vec3 VIA_BRANCA = vec3( 0.72, 0.72, 0.69 );
const vec3 VIA_AMARELA = vec3( 0.78, 0.46, 0.035 );
const vec3 VIA_GRAMA = vec3( 0.075, 0.1, 0.045 );
const vec3 VIA_TERRA_COR = vec3( 0.23, 0.14, 0.09 );
const vec3 VIA_PEDRA_BRANCA = vec3( 0.56, 0.54, 0.5 );
const vec3 VIA_PEDRA_PRETA = vec3( 0.045, 0.045, 0.047 );

// marcas de pista (0 sem marca; cor em rgb, cobertura em a)
vec4 viaMarcas( int tipo, float u, float v, float vf, float marcas, float gasto, float longe ) {
  vec3 cor = vec3( 0.0 );
  float cob = 0.0;
  if ( !viaBit( marcas, VB_CRUZAMENTO ) ) {
    vec2 tr = VIA_TRACO[ tipo ];
    for ( int k = 0; k < ${MAX_LINHAS}; k ++ ) {
      vec4 L = VIA_LINHAS[ tipo * ${MAX_LINHAS} + k ];
      if ( L.w < -0.5 ) break;
      float c = viaLinha( u, L.x, L.y );
      if ( c <= 0.0 ) continue;
      if ( L.w == VE_TRACEJADA ) c *= viaTraco( v + 1.0, tr.x, tr.x + tr.y );
      else if ( L.w == VE_ESTACIONAMENTO ) {
        // linha fina e as marcas das vagas a cada 5,5 m (tê para a calçada)
        float pe = L.x + 2.2 * sign( L.x + 1e-3 );
        float tique = viaTraco( v + 0.05, 0.1, 5.5 ) * viaFaixa( u, min( L.x, pe ), max( L.x, pe ) );
        c = max( c * 0.9, tique );
      }
      vec3 k2 = L.z == VC_AMARELA ? VIA_AMARELA : VIA_BRANCA;
      cor = mix( cor, k2, c );
      cob = max( cob, c );
    }
    // faixa de pedestres (zebra, CTB: barras de 0,40 m a cada 1 m, 4 m de travessia) e retenção nas bocas
    vec4 R = VIA_RET[ tipo ];
    if ( viaBit( marcas, VB_ZEBRA_INI ) || viaBit( marcas, VB_ZEBRA_FIM ) ) {
      float zi = viaBit( marcas, VB_ZEBRA_INI ) ? viaFaixa( v, 0.8, 4.8 ) : 0.0;
      float zf = viaBit( marcas, VB_ZEBRA_FIM ) ? viaFaixa( vf, 0.8, 4.8 ) : 0.0;
      float z = max( zi, zf ) * viaTraco( u + 0.2, 0.4, 1.0 );
      cor = mix( cor, VIA_BRANCA, z );
      cob = max( cob, z );
      float ri = viaFaixa( v, 6.0, 6.4 ) * ( ( viaBit( marcas, VB_RET_INI_A ) ? viaFaixa( u, R.x, R.y ) : 0.0 ) + ( viaBit( marcas, VB_RET_INI_B ) ? viaFaixa( u, R.z, R.w ) : 0.0 ) );
      float rf = viaFaixa( vf, 6.0, 6.4 ) * ( ( viaBit( marcas, VB_RET_FIM_A ) ? viaFaixa( u, R.x, R.y ) : 0.0 ) + ( viaBit( marcas, VB_RET_FIM_B ) ? viaFaixa( u, R.z, R.w ) : 0.0 ) );
      float r = clamp( ri + rf, 0.0, 1.0 );
      cor = mix( cor, VIA_BRANCA, r );
      cob = max( cob, r );
    }
  }
  // tinta gasta: some em manchas onde o pneu passa; de longe as marcas somem com o chão pintado
  vec4 d = texture( gViaDetalhe, vec2( u * 0.37, v * 0.11 ) + 0.13 );
  cob *= 1.0 - gasto * smoothstep( 0.35, 0.8, d.g ) * 0.75;
  cob *= 1.0 - longe;
  return vec4( cor, cob );
}

// trilhas de pneu (0 a 1) e óleo no meio da faixa
vec2 viaTrilhas( int tipo, float u ) {
  float t = 0.0;
  float o = 0.0;
  for ( int k = 0; k < ${MAX_FAIXAS}; k ++ ) {
    float c = VIA_FAIXAS[ tipo * ${MAX_FAIXAS} + k ];
    if ( c > 900.0 ) break;
    float d = abs( u - c );
    t = max( t, 1.0 - smoothstep( 0.18, 0.5, abs( d - 0.85 ) ) );
    o = max( o, 1.0 - smoothstep( 0.1, 0.45, d ) );
  }
  return vec2( t, o );
}

// cor do asfalto (linear) e a rugosidade
vec3 viaAsfalto( vec2 w, vec2 uv, int tipo, float gasto, bool cruzamento, bool acostamento ) {
  vec4 d1 = texture( gViaDetalhe, w * 0.25 );
  vec4 d2 = texture( gViaDetalhe, w * ( 1.0 / 29.0 ) + 0.37 );
  float g = clamp( gasto * 0.85 + ( d2.g - 0.5 ) * 0.35 + ( acostamento ? 0.25 : 0.0 ), 0.0, 1.0 );
  vec3 c = mix( VIA_ASF_NOVO, VIA_ASF_GASTO, g );
  c *= 0.9 + 0.2 * d1.r;                               // agregado
  c *= 0.93 + 0.14 * d2.r;                             // manchas grandes
  // remendos: retângulos de asfalto mais novo em células de 3 x 2 m ao longo da via
  vec2 cel = floor( vec2( uv.x / 3.0, uv.y / 2.2 ) );
  float h = viaHash( cel + float( tipo ) * 17.0 );
  if ( !cruzamento && h < 0.05 * g ) {
    vec2 fr = fract( vec2( uv.x / 3.0, uv.y / 2.2 ) );
    float r = step( 0.12, fr.x ) * step( fr.x, 0.88 ) * step( 0.1, fr.y ) * step( fr.y, 0.9 );
    c = mix( c, VIA_ASF_NOVO * 1.1, r * 0.85 );
  }
  // fissuras
  float fis = smoothstep( 0.72, 0.9, d1.b ) * smoothstep( 0.3, 0.8, g );
  c *= 1.0 - 0.45 * fis;
  // trilhas de pneu e óleo (só nas faixas de trânsito)
  if ( !cruzamento && !acostamento ) {
    vec2 to = viaTrilhas( tipo, uv.x );
    c *= 1.0 - 0.2 * to.x * ( 0.5 + 0.5 * g );
    c *= 1.0 - 0.18 * to.y * smoothstep( 0.4, 0.7, d1.g );
    gViaRug = mix( 0.88, 0.7, to.x );
  } else {
    c *= 1.0 - 0.1 * smoothstep( 0.5, 0.8, d2.g );
    gViaRug = 0.86;
  }
  return c;
}

// calçada: concreto em placas com a faixa de serviço, ou pedra portuguesa em ondas
vec3 viaCalcada( vec2 w, float b, float v, bool pedra ) {
  vec4 d1 = texture( gViaDetalhe, w * 0.5 );
  vec4 d2 = texture( gViaDetalhe, w * ( 1.0 / 23.0 ) + 0.61 );
  gViaRug = 0.82;
  if ( b < 0.15 ) return VIA_MEIO_FIO * ( 0.92 + 0.12 * d1.r ) * ( 0.9 + 0.1 * d2.g );
  if ( pedra ) {
    // Copacabana: ondas ao longo da calçada, pedras de 8 cm com rejunte escuro
    float onda = fract( ( b + 0.55 * sin( v * 0.72 ) ) / 1.7 );
    float preto = smoothstep( 0.46, 0.54, onda ) * ( 1.0 - smoothstep( 0.96, 1.0, onda ) );
    vec3 c = mix( VIA_PEDRA_BRANCA, VIA_PEDRA_PRETA, preto );
    float rej = smoothstep( 0.1, 0.25, d1.a );
    c *= mix( 0.55, 1.0, rej ) * ( 0.9 + 0.15 * d1.r );
    gViaRug = 0.75;
    return c * ( 0.88 + 0.12 * d2.g );
  }
  vec3 c = VIA_CONCRETO * ( 0.9 + 0.14 * d1.r ) * ( 0.86 + 0.16 * d2.g );
  // faixa de serviço junto do meio-fio (onde ficam os postes e as árvores): concreto mais escuro e gasto
  if ( b < 0.95 ) c *= 0.82;
  // juntas das placas a cada 1,5 m e a junta que separa a faixa de serviço
  float j = max( viaTraco( v + 0.02, 0.025, 1.5 ), viaLinha( b, 0.95, 0.03 ) );
  c *= 1.0 - 0.4 * j;
  // encardido junto dos muros e manchas de chuva
  c *= 1.0 - 0.12 * smoothstep( 0.6, 0.95, d2.b );
  return c;
}

vec3 viaTerra( vec2 w, float u ) {
  vec4 d1 = texture( gViaDetalhe, w * 0.3 );
  vec4 d2 = texture( gViaDetalhe, w * ( 1.0 / 19.0 ) + 0.2 );
  vec3 c = mix( VIA_TERRA_COR, vec3( 0.27, 0.22, 0.17 ), 0.35 + 0.4 * d2.g );
  // sulcos das rodas
  float s = 1.0 - smoothstep( 0.15, 0.55, abs( abs( u ) - 1.35 ) );
  c *= ( 1.0 - 0.18 * s ) * ( 0.85 + 0.3 * d1.r );
  gViaRug = 0.95;
  return c;
}

vec3 viaGrama( vec2 w ) {
  vec4 d1 = texture( gViaDetalhe, w * 0.6 );
  vec4 d2 = texture( gViaDetalhe, w * ( 1.0 / 13.0 ) + 0.8 );
  vec3 c = mix( VIA_GRAMA, vec3( 0.19, 0.17, 0.1 ), smoothstep( 0.55, 0.85, d2.g ) * 0.6 );
  gViaRug = 0.92;
  gViaGrama = 1.0;
  return c * ( 0.8 + 0.4 * d1.r );
}

vec3 viaRampa( float t ) {
  float n = max( gViaCamada.y, 1.0 );
  float x = clamp( t, 0.0, 1.0 ) * ( n - 1.0 );
  int i = int( floor( x ) );
  int j = min( i + 1, int( n ) - 1 );
  return mix( gViaRampa[ i ], gViaRampa[ j ], fract( x ) );
}
`;

/** Fragmento: a cor (troca o #include <color_fragment>). */
export const VIA_FRAGMENTO_COR = /* glsl */ `
{
  float mat = vDados.x;
  int tipo = int( vDados.y + 0.5 );
  float marcas = vDados.z;
  float gasto = vDados.w;
  vec2 w = vGPosMundo.xz;
  float dist = length( vGPosMundo - cameraPosition );
  float longe = smoothstep( gViaLonge.x, gViaLonge.y, dist );
  bool cruz = viaBit( marcas, VB_CRUZAMENTO );
  vec3 c;
  if ( mat == VM_PISTA || mat == VM_ACOSTAMENTO ) {
    c = viaAsfalto( w, vUV.xy, tipo, gasto, cruz, mat == VM_ACOSTAMENTO );
    // sarjeta de concreto junto do meio-fio
    if ( VIA_SARJETA[ tipo ] > 0.5 ) {
      float s = viaFaixa( vUV.w, -1.0, 0.32 );
      c = mix( c, VIA_CONCRETO * 0.78, s * ( 1.0 - longe ) );
    }
    vec4 m = viaMarcas( tipo, vUV.x, vUV.y, vUV.z, marcas, gasto, longe );
    c = mix( c, m.rgb, m.a );
    gViaRug = mix( gViaRug, 0.6, m.a );
  } else if ( mat == VM_CALCADA ) {
    c = viaCalcada( w, vUV.w, vUV.y, viaBit( marcas, VB_PEDRA ) );
  } else if ( mat == VM_MEIO_FIO || mat == VM_BARREIRA || mat == VM_TABULEIRO ) {
    vec4 d1 = texture( gViaDetalhe, w * 0.5 + vUV.y * 0.1 );
    c = VIA_MEIO_FIO * ( 0.9 + 0.14 * d1.r );
    gViaRug = 0.8;
  } else if ( mat == VM_CANTEIRO || mat == VM_TALUDE ) {
    c = viaGrama( w );
    if ( mat == VM_TALUDE ) c = mix( c, vec3( 0.2, 0.16, 0.11 ), 0.35 );
  } else if ( mat == VM_TERRA ) {
    c = viaTerra( w, vUV.x );
  } else {
    // saia: a lateral da calçada (concreto), da terra ou do talude
    c = tipo == int( VIA_TERRA ) ? VIA_TERRA_COR * 0.8 : VIA_CONCRETO * 0.8;
    gViaRug = 0.9;
  }
  // de longe tudo converge para a média (a troca com o chão pintado não salta)
  c = mix( c, mat == VM_CALCADA ? VIA_CONCRETO * 0.95 : c, longe * 0.5 );
  // camada: a pista pintada pelo valor da aresta, o resto neutro
  if ( gViaCamada.x > 0.5 ) {
    float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
    vec3 neutro = vec3( 0.18 + 0.5 * l );
    float val = vIdent.z;
    if ( ( mat == VM_PISTA || mat == VM_ACOSTAMENTO ) && val > 0.5 ) {
      vec3 rc = gViaCamada.z > 0.5 ? gViaRampa[ int( min( val, 7.0 ) ) ] : viaRampa( ( val - 1.0 ) / 254.0 );
      c = mix( neutro, rc, 0.9 );
    } else c = neutro;
  }
  diffuseColor.rgb = c;
}
`;

/** Fragmento: rugosidade (troca o #include <roughnessmap_fragment>). */
export const VIA_FRAGMENTO_RUGOSIDADE = /* glsl */ `
float roughnessFactor = gViaRug;
`;

/** Fragmento: a luz da rua e a seleção (depois do #include <emissivemap_fragment>). */
export const VIA_FRAGMENTO_EMISSIVO = /* glsl */ `
{
  if ( gLuzRuaMapa.w > 0.0 ) {
    vec2 luv = ( vGPosMundo.xz - gLuzRuaMapa.xy ) * gLuzRuaMapa.z;
    if ( all( greaterThanEqual( luv, vec2( 0.0 ) ) ) && all( lessThanEqual( luv, vec2( 1.0 ) ) ) ) {
      vec3 lr = texture( gLuzRua, luv ).rgb * 4.0;
      totalEmissiveRadiance += diffuseColor.rgb * lr * gLuzRuaMapa.w;
    }
  }
  if ( ( int( vIdent.y + 0.5 ) & 1 ) != 0 ) totalEmissiveRadiance += vec3( 0.25, 0.2, 0.08 ) * 0.6;
}
`;

/** Fragmento: AO cozida (troca o #include <aomap_fragment>). */
export const VIA_FRAGMENTO_AO = /* glsl */ `
#include <aomap_fragment>
reflectedLight.indirectDiffuse *= vAO;
reflectedLight.directDiffuse *= mix( 1.0, vAO, 0.35 );
`;

/** Passe de máscara (?passe=mascara, aceite de cor): o gramado do canteiro e do talude em branco. */
export const VIA_FRAGMENTO_MASCARA = /* glsl */ `
#include <dithering_fragment>
if ( gViaMascara > 0.5 ) gl_FragColor = vec4( vec3( gViaGrama ), 1.0 );
`;

// ------------------------------------------------------------------------------------------------ carros

/** Carros instanciados: a parte de cada vértice e a cor, os faróis e as lanternas da instância. */
export const CARRO_VERTICE_PARS = /* glsl */ `
attribute float aParte;     // PARTE de veiculos.js
attribute vec4 aCarro;      // rgb da pintura (sRGB 0..255), luzes (bit 0 farol, bit 1 freio)
flat varying vec4 vCarro;
flat varying float vParte;
`;
export const CARRO_VERTICE_MAIN = /* glsl */ `
vCarro = aCarro;
vParte = aParte;
`;
export const CARRO_FRAGMENTO_PARS = /* glsl */ `
flat varying vec4 vCarro;
flat varying float vParte;
uniform float gCarroNoite;
float gCarroRug = 0.35;
float gCarroMetal = 0.0;
vec3 carroLinear( vec3 s ) { return pow( s / 255.0, vec3( 2.2 ) ); }
`;
export const CARRO_FRAGMENTO_COR = /* glsl */ `
{
  int p = int( vParte + 0.5 );
  vec3 c;
  if ( p == 0 ) { c = min( carroLinear( vCarro.rgb ), vec3( 0.78 ) ); gCarroRug = 0.32; }
  else if ( p == 1 ) { c = vec3( 0.02, 0.025, 0.03 ); gCarroRug = 0.06; }
  else if ( p == 2 ) { c = vec3( 0.025 ); gCarroRug = 0.85; }
  else if ( p == 3 ) { c = vec3( 0.55, 0.55, 0.52 ); gCarroRug = 0.15; }
  else if ( p == 4 ) { c = vec3( 0.25, 0.01, 0.01 ); gCarroRug = 0.2; }
  else if ( p == 5 ) { c = vec3( 0.62, 0.62, 0.6 ); gCarroRug = 0.45; }
  else if ( p == 6 ) { c = vec3( 0.32, 0.32, 0.33 ); gCarroRug = 0.3; gCarroMetal = 0.8; }
  else { c = vec3( 0.0 ); gCarroRug = 1.0; }
  diffuseColor.rgb = c;
}
`;
export const CARRO_FRAGMENTO_RUGOSIDADE = /* glsl */ `
float roughnessFactor = gCarroRug;
`;
export const CARRO_FRAGMENTO_METAL = /* glsl */ `
float metalnessFactor = gCarroMetal;
`;
export const CARRO_FRAGMENTO_EMISSIVO = /* glsl */ `
{
  int p = int( vParte + 0.5 );
  int luz = int( vCarro.a + 0.5 );
  if ( p == 3 && ( luz & 1 ) != 0 ) totalEmissiveRadiance += vec3( 1.0, 0.88, 0.7 ) * 9.0 * gCarroNoite;
  if ( p == 4 ) totalEmissiveRadiance += vec3( 1.0, 0.04, 0.02 ) * ( ( ( luz & 2 ) != 0 ? 5.0 : 0.0 ) + 2.5 * gCarroNoite * float( luz & 1 ) );
}
`;

// ------------------------------------------------------------------------------------------------ objetos da rua

/**
 * Postes e semáforos: aParte 0 metal (cinza), 1 concreto, 2 lâmpada (acende à noite), 3 foco vermelho, 4 amarelo,
 * 5 verde (o semáforo acende o foco da fase: aObj.x grupo, aObj.y defasagem).
 */
export const OBJ_VERTICE_PARS = /* glsl */ `
attribute float aParte;
attribute vec4 aObj;
flat varying float vParte;
flat varying vec4 vObj;
`;
export const OBJ_VERTICE_MAIN = /* glsl */ `
vParte = aParte;
vObj = aObj;
`;
export const OBJ_FRAGMENTO_PARS = /* glsl */ `
flat varying float vParte;
flat varying vec4 vObj;
uniform float gObjNoite;
uniform float gObjTempo;       // s (a fase dos semáforos)
uniform vec3 gObjLuz;          // cor da lâmpada do poste (linear)
float gObjRug = 0.6;
float gObjMetal = 0.0;
// fase do semáforo: 0 verde, 1 amarelo, 2 vermelho para o grupo g (ciclo de 40 s, defasado por cruzamento)
int objFase( float g, float defas ) {
  float t = mod( gObjTempo + defas * 0.16, 40.0 );
  float m = g < 0.5 ? t : mod( t + 20.0, 40.0 );
  return m < 16.0 ? 0 : m < 19.0 ? 1 : 2;
}
`;
export const OBJ_FRAGMENTO_COR = /* glsl */ `
{
  int p = int( vParte + 0.5 );
  vec3 c;
  if ( p == 0 ) { c = vec3( 0.3, 0.31, 0.32 ); gObjRug = 0.45; gObjMetal = 0.6; }
  else if ( p == 1 ) { c = vec3( 0.36, 0.35, 0.33 ); gObjRug = 0.85; }
  else if ( p == 2 ) { c = vec3( 0.7, 0.7, 0.66 ); gObjRug = 0.3; }
  else if ( p == 6 ) { c = vec3( 0.03, 0.03, 0.03 ); gObjRug = 0.5; }
  else { c = vec3( 0.04 ); gObjRug = 0.2; }
  diffuseColor.rgb = c;
}
`;
export const OBJ_FRAGMENTO_RUGOSIDADE = /* glsl */ `
float roughnessFactor = gObjRug;
`;
export const OBJ_FRAGMENTO_METAL = /* glsl */ `
float metalnessFactor = gObjMetal;
`;
export const OBJ_FRAGMENTO_EMISSIVO = /* glsl */ `
{
  int p = int( vParte + 0.5 );
  if ( p == 2 ) totalEmissiveRadiance += gObjLuz * 14.0 * gObjNoite;
  if ( p >= 3 && p <= 5 ) {
    int f = objFase( vObj.x, vObj.y );
    vec3 k = p == 3 ? vec3( 1.0, 0.06, 0.03 ) : p == 4 ? vec3( 1.0, 0.55, 0.05 ) : vec3( 0.1, 1.0, 0.45 );
    bool aceso = ( p == 3 && f == 2 ) || ( p == 4 && f == 1 ) || ( p == 5 && f == 0 );
    if ( aceso ) totalEmissiveRadiance += k * ( 3.0 + 6.0 * gObjNoite );
  }
}
`;

/** Os trechos são importados por quem monta os materiais (render/mundo/vias.js, trafego.js, props.js). */
export function registrar() {}
