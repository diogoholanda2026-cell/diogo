// Material `edificio` (desenho do render 5.2 e 9.1): a fachada é um shader, não uma textura pintada. Grade de andares
// e vãos em metros, janela, caixilho, peitoril, vidro escuro que reflete o céu com a normal inclinada por painel,
// brise, cobogó, pastilha, tijolo, painel, varanda, vitrine do térreo com letreiro, telha, laje, telha metálica e os
// materiais lisos (concreto, metal, madeira, pedra, toldo, verde, piso, água, painel solar). Desgaste (escorrido sob o
// peitoril, pé de parede, sujeira no topo, tom por painel), janelas acesas pela agenda do uso e da hora, filtragem pela
// área do pixel (pulso integrado com fwidth: de longe a fachada vira a média, sem cintilar).
//
// Serve às duas variantes com o mesmo programa-fonte: LOD0 fundido por setor (atributos quantizados por vértice, D39)
// e LOD1/LOD2 instanciado (instanceMatrix e atributos por instância; a posição na fachada sai da forma unitária).
// Tudo em highp (D44). Varyings próprios: 4 (vPF, vFac, vCor, vIdent), 3 deles flat.
//
// Para os ganchos comuns e as outras parcelas (camada da X3a, obra da R4b): o material define EDIFICIO; no fragmento
// valem vIdent (x = idx do prédio, y = bits da tabela, z = agenda, w = valor da camada 0..255) e gMascaraTelhado
// (1 no telhado, 0 no resto), e o uniforme gPredTab é a tabela de prédios (RGBA 512²: camada, bits, agenda, livre).
import { FACHADA, TERREO_ALTURA, BITS_TABELA } from '../../geracao/malhaPredio.js';

const defs = Object.entries(FACHADA).map(([k, v]) => `#define F_${k} ${v}.0`).join('\n');
const alturasTerreo = TERREO_ALTURA.map((h) => h.toFixed(2)).join(', ');

/** Vértice: declarações (depois do #include <common>). */
export const VERTICE_PARS = /* glsl */ `
#define EDIFICIO
${defs}
#ifdef USE_INSTANCING
  attribute vec4 aUnit;     // forma unitária: s (0..1 na face ou no perímetro), t, tipo de face (0 parede, 1 topo, 2 água do telhado), eixo
  attribute vec4 aTopo;     // tipo do topo, rgb do topo (0..255)
#else
  attribute vec4 aFacUV;    // u (vãos), v (m), vTopo (m), largura da face (m)
  attribute float aAO;      // oclusão cozida (0..1)
#endif
attribute vec4 aFac;        // tipo, andar / 0,05 m, vão / 0,1 m, bits (uso 2 | variante 3 | térreo 3)
attribute vec4 aCorA;       // rgb da cor 1, desgaste (0..255)
attribute vec4 aCorB;       // rgb da cor 2, vidro (0..255)
attribute uint aId;         // idx do prédio (vaga da tabela), inteiro
uniform highp sampler2D gPredTab;
varying vec4 vPF;           // u (vãos), v (m), vTopo (m), AO
flat varying vec4 vFac;     // tipo, andar (m), vão (m), bits
flat varying vec4 vCor;     // cor 1 e cor 2 empacotadas (r*65536 + g*256 + b), desgaste, vidro
flat varying vec4 vIdent;   // idx, bits da tabela, agenda, camada
vec3 gOct( vec2 e ) {
  vec3 v = vec3( e, 1.0 - abs( e.x ) - abs( e.y ) );
  if ( v.z < 0.0 ) v.xy = ( 1.0 - abs( v.yx ) ) * ( step( 0.0, v.xy ) * 2.0 - 1.0 );
  return normalize( v.xzy );
}
float gEmp( vec3 c ) { return floor( c.r + 0.5 ) * 65536.0 + floor( c.g + 0.5 ) * 256.0 + floor( c.b + 0.5 ); }
`;

/** Vértice: normal do objeto (troca o #include <beginnormal_vertex>). */
export const VERTICE_NORMAL = /* glsl */ `
#ifdef USE_INSTANCING
  vec3 objectNormal = vec3( normal );
#else
  vec3 objectNormal = gOct( normal.xy );
#endif
#ifdef USE_TANGENT
  vec3 objectTangent = vec3( tangent.xyz );
#endif
`;

/** Vértice: posição na fachada, cores e a leitura da tabela (depois do #include <begin_vertex>). */
export const VERTICE_MAIN = /* glsl */ `
{
  vec4 gTab = texelFetch( gPredTab, ivec2( int( aId % 512u ), int( aId / 512u ) ), 0 );
  vIdent = vec4( float( aId ), floor( gTab.g * 255.0 + 0.5 ), gTab.b, floor( gTab.r * 255.0 + 0.5 ) );
  float gTipo = aFac.x;
  vec3 gC1 = aCorA.rgb;
  vec3 gC2 = aCorB.rgb;
  float gBits = aFac.w;
#ifdef USE_INSTANCING
  vec3 gE = vec3( length( instanceMatrix[ 0 ].xyz ), length( instanceMatrix[ 1 ].xyz ), length( instanceMatrix[ 2 ].xyz ) );
  float gVao = max( aFac.z * 0.1, 0.5 );
  float gK = aUnit.z;
  // bit 7 do tipo do topo: a peça desce 2 m no chão (o v da fachada começa no nível do lote)
  float gEnt = step( 127.5, aTopo.x );
  float gTopoT = aTopo.x - 128.0 * gEnt;
  float gParap = gTopoT == F_LAJE ? 0.9 : 0.0;
  if ( gK > 0.5 && gK < 1.5 ) {
    // topo plano: u e v em metros no plano
    vPF = vec4( position.x * gE.x, position.z * gE.z, 1e4, 1.0 );
    gTipo = gTopoT;
    gC1 = aTopo.yzw;
    gC2 = aTopo.yzw * 0.85;
    gBits = mod( gBits, 32.0 );
  } else if ( gK > 1.5 ) {
    // água de telhado: u ao longo da cumeeira, v ao longo da água
    float gL = length( vec2( 0.5 * gE.z, gE.y ) );
    vPF = vec4( aUnit.x * gE.x, aUnit.y * gL, 1e4, 1.0 );
    gTipo = gTopoT;
    gC1 = aTopo.yzw;
    gC2 = aTopo.yzw * 0.85;
    gBits = mod( gBits, 32.0 );
  } else {
    // parede: vãos inteiros na largura da face (ou no perímetro das formas redondas)
    float gW = aUnit.w < 0.5 ? gE.z : aUnit.w < 1.5 ? gE.x : 1.5708 * ( gE.x + gE.z ) * ( aUnit.w > 2.5 ? 1.0 : 1.12 );
    float gN = max( 1.0, floor( gW / gVao + 0.5 ) );
    float gH = position.y * gE.y - 2.0 * gEnt;
    vPF = vec4( aUnit.x * gN, gH, gE.y - 2.0 * gEnt - gParap, 1.0 );
    // o térreo só na frente (+z local)
    if ( normal.z < 0.5 || aUnit.w > 1.5 ) gBits = mod( gBits, 32.0 );
    // empena da casa (triângulo do telhado de duas águas): parede lisa com a cor da parede
    if ( gTopoT == F_TELHA && aUnit.y > 0.5 ) { gTipo = F_LISO; }
  }
#else
  vPF = vec4( aFacUV.xyz, aAO );
#endif
  vFac = vec4( gTipo, aFac.y * 0.05, aFac.z * 0.1, gBits );
  vCor = vec4( gEmp( gC1 ), gEmp( gC2 ), aCorA.a / 255.0, aCorB.a / 255.0 );
}
`;

/** Fragmento: declarações e a função da fachada (depois do #include <common>). */
export const FRAGMENTO_PARS = /* glsl */ `
#define EDIFICIO
${defs}
varying vec4 vPF;
flat varying vec4 vFac;
flat varying vec4 vCor;
flat varying vec4 vIdent;
uniform highp sampler2D gDetalhe;
uniform float gHora;
uniform float gNoite;
uniform float gSelecionado;
uniform float gPrediosMascara;
uniform float gCeuLigado;
uniform vec3 gCeuZen;
uniform vec3 gCeuHor;
uniform vec3 gCeuChao;
float gMascaraTelhado = 0.0;
const float G_TERREO_H[ 8 ] = float[ 8 ]( ${alturasTerreo} );

struct GSup { vec3 alb; float rug; float met; vec3 emi; vec2 inc; float ao; };

float gH1( vec3 p ) {
  p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) );
  p += dot( p, p.yxz + 33.33 );
  return fract( ( p.x + p.y ) * p.z );
}
vec2 gH2( vec3 p ) {
  p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) );
  p += dot( p, p.yxz + 33.33 );
  return fract( ( p.xx + p.yz ) * p.zy );
}
vec3 gRGB( float p ) { return vec3( floor( p / 65536.0 ), floor( mod( p, 65536.0 ) / 256.0 ), mod( p, 256.0 ) ) / 255.0; }
vec3 gLin( vec3 c ) { return pow( c, vec3( 2.2 ) ); }
float gLum( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
// integral do pulso [a, b] repetido a cada 1; o pulso filtrado é a média na área do pixel (de longe vira b - a)
float gInt( float x, float a, float b ) { return floor( x ) * ( b - a ) + clamp( fract( x ), a, b ) - a; }
float gPulso( float x, float a, float b, float dx ) {
  float w = max( dx, 1e-4 );
  return ( gInt( x + 0.5 * w, a, b ) - gInt( x - 0.5 * w, a, b ) ) / w;
}
// linha fina (junta, montante) de largura l (fração da célula) centrada em 0
float gLinha( float x, float l, float dx ) { return gPulso( x + 0.5 * l, 0.0, l, dx ); }
// mistura pelo tamanho do pixel na célula: 0 de perto, 1 quando a célula some
float gLonge( vec2 d ) { return smoothstep( 0.1, 0.45, max( d.x, d.y ) ); }

// fração de janelas acesas pela hora do céu e pelo uso (desenho do render 2.9)
float gAgenda( float uso, float h ) {
  if ( uso < 0.5 ) {
    if ( h < 5.0 ) return mix( 0.14, 0.06, h / 5.0 );
    if ( h < 7.0 ) return mix( 0.06, 0.32, ( h - 5.0 ) / 2.0 );
    if ( h < 9.0 ) return mix( 0.32, 0.08, ( h - 7.0 ) / 2.0 );
    if ( h < 17.0 ) return 0.08;
    if ( h < 20.0 ) return mix( 0.08, 0.56, ( h - 17.0 ) / 3.0 );
    if ( h < 23.0 ) return mix( 0.56, 0.38, ( h - 20.0 ) / 3.0 );
    return mix( 0.38, 0.12, h - 23.0 );
  }
  if ( uso < 1.5 ) return ( h > 7.5 && h < 22.0 ) ? 0.7 : 0.05;
  if ( uso < 2.5 ) {
    if ( h < 7.0 ) return 0.1;
    if ( h < 9.0 ) return mix( 0.1, 0.85, ( h - 7.0 ) / 2.0 );
    if ( h < 18.0 ) return 0.8;
    if ( h < 21.0 ) return mix( 0.8, 0.2, ( h - 18.0 ) / 3.0 );
    return 0.14;
  }
  return 0.42;
}

// cor da luz de uma janela: 2.700 K a 5.000 K, algumas com a luz azulada de tela, cortina filtrando
vec3 gLuz( float h ) {
  vec3 c = h < 0.45 ? vec3( 1.0, 0.66, 0.38 ) : h < 0.8 ? vec3( 1.0, 0.8, 0.6 ) : h < 0.94 ? vec3( 1.0, 0.92, 0.84 ) : vec3( 0.62, 0.74, 1.0 );
  return c;
}

// vidro de uma célula (i, j): reflexo, interior e luz acesa pela agenda
void gVidro( inout GSup s, float m, vec2 cel, vec2 f, vec3 tinta, float lonje, float uso, float esp ) {
  if ( m <= 0.0 ) return;
  vec2 h = gH2( vec3( cel, vIdent.x ) );
  // vidro com película: espelho escuro tingido (F0 0,13 a 0,25); algumas janelas deixam ver a cortina ou a persiana
  float cortina = ( h.x < 0.12 ? 1.0 : 0.0 ) * ( 1.0 - lonje ) + 0.12 * lonje;
  vec3 pano = mix( vec3( 0.3, 0.28, 0.24 ), vec3( 0.2, 0.2, 0.19 ), step( 0.06, h.x ) );
  vec3 alb = tinta * 1.3 * ( 0.97 + 0.06 * mix( h.y, 0.5, lonje ) );
  alb = mix( alb, mix( tinta, pano, 0.35 ), cortina );
  float met = mix( 0.86, 0.6, cortina ) * mix( 1.0, 0.85, 1.0 - esp );
  s.alb = mix( s.alb, alb, m );
  s.rug = mix( s.rug, 0.05 + 0.03 * h.y, m );
  s.met = mix( s.met, met, m );
  // a ondulação da chapa de vidro quebra o reflexo em mosaico de perto e some de longe
  s.inc = mix( s.inc, ( gH2( vec3( cel * 1.7, vIdent.x + 3.1 ) ) - 0.5 ) * 0.035 * ( 1.0 - lonje ), m );
  // janela acesa (a hora de acender de cada uma anda com a semente: a cidade acende janela a janela)
  float hora = mod( gHora + ( h.y - 0.5 ) * 1.6 + ( vIdent.z - 0.5 ) * 1.2 + 24.0, 24.0 );
  float fr = gAgenda( uso, hora );
  float acesa = mix( step( h.x, fr ), fr, lonje );
  if ( mod( vIdent.y, 2.0 ) > 0.5 ) acesa = 0.0; // abandonado
  vec3 luz = mix( gLuz( fract( h.x * 7.13 + h.y ) ), vec3( 1.0, 0.8, 0.6 ), lonje );
  float filtro = h.y > 0.55 ? 0.55 : 1.0;
  s.emi += luz * acesa * m * filtro * ( 0.02 + 1.15 * gNoite );
}

// parede com a grade de janelas: tipo da janela pela variante, peitoril, caixilho, escorrido
void gGrade( inout GSup s, vec2 uv, vec2 duv, float andar, float vari, vec3 c2, vec3 tinta, float uso, float desg, float tipo ) {
  float fv = uv.y / andar;
  vec2 cel = vec2( floor( uv.x ), floor( fv ) );
  vec2 d = vec2( duv.x, duv.y / andar );
  float lonje = gLonge( d );
  // proporções por variante: largura (fração do vão), peitoril e altura (fração do andar)
  float ww = vari < 0.5 ? 0.46 : vari < 1.5 ? 0.54 : vari < 2.5 ? 0.62 : vari < 3.5 ? 0.7 : vari < 4.5 ? 0.38 : vari < 5.5 ? 0.78 : vari < 6.5 ? 0.86 : 0.8;
  float y0 = vari > 6.5 ? 0.04 : ( vari > 4.5 ? 0.24 : 0.31 );
  float y1 = vari > 6.5 ? 0.8 : 0.78;
  float x0 = 0.5 - ww * 0.5;
  float x1 = 0.5 + ww * 0.5;
  if ( tipo == F_FITA ) { x0 = 0.0; x1 = 1.0; y0 = 0.3; y1 = 0.8; }
  if ( tipo == F_CASA ) {
    // casa: janelas menores, mais parede
    x0 = 0.5 - min( ww, 0.46 ) * 0.5;
    x1 = 1.0 - x0;
    y0 = 0.34;
    y1 = 0.72;
  }
  float mx = gPulso( uv.x, x0, x1, d.x );
  float my = gPulso( fv, y0, y1, d.y );
  float jan = mx * my;
  // vidro dentro do caixilho (6 cm)
  float ci = 0.07 / andar;
  float cx = 0.07 / max( 1.0, vFac.z );
  float gv = gPulso( uv.x, x0 + cx, x1 - cx, d.x ) * gPulso( fv, y0 + ci, y1 - ci, d.y );
  if ( tipo == F_FITA ) gv = gPulso( fv, y0 + ci, y1 - ci, d.y ) * ( 1.0 - gLinha( fract( uv.x * 3.0 + 0.5 ) - 0.5, 0.05, d.x * 3.0 ) );
  // caixilho
  s.alb = mix( s.alb, c2, max( jan - gv, 0.0 ) );
  s.rug = mix( s.rug, 0.4, max( jan - gv, 0.0 ) );
  // peitoril: pingadeira clara sob a janela
  float pe = gPulso( uv.x, x0 - 0.02, x1 + 0.02, d.x ) * gPulso( fv, y0 - 0.035, y0, d.y );
  if ( tipo != F_FITA ) s.alb = mix( s.alb, s.alb * 1.12 + 0.03, pe );
  // escorrido de sujeira sob o peitoril (desgaste), mais forte perto do peitoril
  float fy = fract( fv );
  float esc = smoothstep( y0, y0 - 0.45, fy ) * step( fy, y0 ) * gPulso( uv.x, x0 + 0.05, x1 - 0.05, d.x );
  s.alb *= 1.0 - desg * 0.22 * esc * ( 1.0 - lonje );
  gVidro( s, gv, cel, vec2( 0.0 ), tinta, lonje, uso, 1.0 );
  // grade de ferro na janela da casa (variante 4 a 7): barras verticais e uma travessa
  if ( tipo == F_CASA && vari > 3.5 ) {
    float lw = max( x1 - x0, 0.01 );
    float bx = gLinha( fract( ( uv.x - x0 ) / lw * 5.0 + 0.5 ) - 0.5, 0.1, d.x * 5.0 / lw );
    float by = gLinha( fract( ( fy - y0 ) / max( y1 - y0, 0.01 ) + 0.5 ) - 0.5, 0.04, d.y / max( y1 - y0, 0.01 ) );
    float barra = max( bx, by ) * jan * ( 1.0 - lonje );
    s.alb = mix( s.alb, vec3( 0.03 ), barra );
    s.met = mix( s.met, 0.3, barra );
    s.rug = mix( s.rug, 0.6, barra );
  }
  // profundidade do vão: a verga faz sombra no alto do vidro (a janela fica recuada na parede)
  float verga = smoothstep( y1 - ci - 0.16 / andar, y1 - ci, fy ) * gv * ( 1.0 - lonje );
  s.ao *= 1.0 - 0.45 * verga;
  s.alb *= 1.0 - 0.35 * verga;
}

GSup gFachada() {
  GSup s;
  float tipo = vFac.x;
  float andar = max( vFac.y, 0.5 );
  float vao = max( vFac.z, 0.4 );
  float bits = vFac.w;
  float uso = mod( bits, 4.0 );
  float vari = mod( floor( bits / 4.0 ), 8.0 );
  float terreo = floor( bits / 32.0 );
  vec3 c1 = gLin( gRGB( vCor.x ) );
  vec3 c2 = gLin( gRGB( vCor.y ) );
  float desg = vCor.z;
  float vid = vCor.w;
  vec2 uv = vPF.xy;
  vec2 duv = max( fwidth( uv ), vec2( 1e-4 ) );
  float um = uv.x * vao;
  float id = vIdent.x;
  vec4 dt = texture( gDetalhe, vec2( um * 0.11 + id * 0.173, uv.y * 0.11 ) );
  vec4 df = texture( gDetalhe, vec2( um * 0.53, uv.y * 0.53 + id * 0.07 ) );
  // vidro: azul-acinzentado, verde, bronze ou cinza, pelo índice
  // vidro (F0 linear): azul-acinzentado, cinza, verde, bronze (raro) ou azul, pelo índice do prédio
  vec3 tinta = vid < 0.3 ? vec3( 0.085, 0.1, 0.115 ) : vid < 0.5 ? vec3( 0.095, 0.098, 0.1 ) : vid < 0.62 ? vec3( 0.085, 0.1, 0.092 ) : vid < 0.72 ? vec3( 0.11, 0.095, 0.08 ) : vec3( 0.075, 0.095, 0.12 );
  s.alb = c1;
  s.rug = 0.82;
  s.met = 0.0;
  s.emi = vec3( 0.0 );
  s.inc = vec2( 0.0 );
  s.ao = vPF.w;
  float tH = G_TERREO_H[ int( terreo ) ];

  // ------------------------------------------------------------------ telhados, pisos e materiais lisos
  if ( tipo >= F_TELHA || tipo == F_LISO ) {
    if ( tipo == F_TELHA ) {
      // telha cerâmica: fiadas ao longo da água (v) e capas ao longo da cumeeira (u)
      vec2 t = vec2( uv.x / 0.21, uv.y / 0.33 );
      vec2 dd = duv / vec2( 0.21, 0.33 );
      float l = gLonge( dd );
      float fiada = gPulso( t.y, 0.0, 0.16, dd.y );
      float capa = 0.5 + 0.5 * cos( 6.2832 * t.x );
      float tom = gH1( vec3( floor( t ), id ) );
      vec3 c = c1 * ( 0.86 + 0.26 * tom ) * mix( 0.82 + 0.25 * capa, 1.0, l ) * mix( 1.0 - 0.3 * fiada, 0.93, l );
      c *= 0.8 + 0.35 * dt.r;
      s.alb = mix( c, c * vec3( 0.78, 0.8, 0.78 ), desg * dt.g );
      s.rug = 0.72;
      s.inc = vec2( 0.0, ( capa - 0.5 ) * 0.25 * ( 1.0 - l ) );
      gMascaraTelhado = 1.0;
    } else if ( tipo == F_LAJE ) {
      // laje impermeabilizada: placas de 1 m, manchas de umidade e sujeira
      vec2 dd = duv;
      float jt = max( gLinha( fract( uv.x + 0.5 ) - 0.5, 0.03, dd.x ), gLinha( fract( uv.y + 0.5 ) - 0.5, 0.03, dd.y ) );
      float tom = gH1( vec3( floor( uv ), id ) );
      s.alb = c1 * ( 0.9 + 0.14 * tom ) * ( 0.78 + 0.35 * dt.r ) * ( 1.0 - 0.18 * jt );
      s.alb *= 1.0 - 0.25 * desg * smoothstep( 0.55, 0.8, dt.g );
      s.rug = 0.9;
      gMascaraTelhado = 1.0;
    } else if ( tipo == F_TELHA_METAL ) {
      // telha metálica ondulada a cada 0,2 m
      float o = uv.x / 0.2;
      float l = gLonge( vec2( duv.x / 0.2 ) );
      s.alb = c1 * ( 0.85 + 0.2 * dt.r ) * mix( 0.9 + 0.1 * cos( 6.2832 * o ), 1.0, l );
      s.rug = 0.45;
      s.met = 0.55;
      s.inc = vec2( sin( 6.2832 * o ) * 0.35 * ( 1.0 - l ), 0.0 );
      s.alb *= 1.0 - 0.3 * desg * smoothstep( 0.5, 0.85, dt.b );
      gMascaraTelhado = 1.0;
    } else if ( tipo == F_CONCRETO || tipo == F_LISO ) {
      s.alb = c1 * ( 0.84 + 0.3 * dt.r ) * ( 0.95 + 0.1 * df.g );
      s.rug = tipo == F_CONCRETO ? 0.88 : 0.8;
    } else if ( tipo == F_METAL ) {
      s.alb = c1 * ( 0.9 + 0.15 * dt.r );
      s.rug = 0.38;
      s.met = 0.8;
    } else if ( tipo == F_VIDRO ) {
      s.alb = mix( tinta, c1 * 0.5, 0.25 );
      s.rug = 0.06;
      s.met = 0.85;
    } else if ( tipo == F_MADEIRA ) {
      float veio = gPulso( uv.x * vao / 0.14, 0.0, 0.1, duv.x * vao / 0.14 );
      s.alb = c1 * ( 0.8 + 0.3 * df.r ) * ( 1.0 - 0.25 * veio );
      s.rug = 0.7;
    } else if ( tipo == F_PEDRA ) {
      vec2 p = vec2( um / 0.6, uv.y / 0.3 );
      p.x += step( 0.5, fract( p.y * 0.5 ) ) * 0.5;
      vec2 dd = vec2( duv.x * vao / 0.6, duv.y / 0.3 );
      float jt = max( gLinha( fract( p.x + 0.5 ) - 0.5, 0.05, dd.x ), gLinha( fract( p.y + 0.5 ) - 0.5, 0.08, dd.y ) );
      s.alb = c1 * ( 0.8 + 0.35 * gH1( vec3( floor( p ), id ) ) ) * ( 1.0 - 0.3 * jt );
      s.rug = 0.7;
    } else if ( tipo == F_TOLDO ) {
      s.alb = c1 * ( 0.85 + 0.2 * df.r );
      s.rug = 0.85;
    } else if ( tipo == F_VERDE ) {
      s.alb = c1 * ( 0.55 + 0.7 * df.r ) * ( 0.7 + 0.5 * dt.g );
      s.rug = 0.92;
      s.inc = ( df.gb - 0.5 ) * 0.6;
    } else if ( tipo == F_PISO ) {
      float jt = max( gLinha( fract( uv.x * 1.25 + 0.5 ) - 0.5, 0.04, duv.x * 1.25 ), gLinha( fract( uv.y * 1.25 + 0.5 ) - 0.5, 0.04, duv.y * 1.25 ) );
      s.alb = c1 * ( 0.82 + 0.3 * dt.r ) * ( 1.0 - 0.2 * jt );
      s.rug = 0.9;
    } else if ( tipo == F_AGUA ) {
      s.alb = vec3( 0.02, 0.07, 0.075 );
      s.rug = 0.04;
      s.met = 0.25;
      s.inc = ( df.rg - 0.5 ) * 0.12;
    } else if ( tipo == F_LETREIRO ) {
      s.alb = c1 * 0.9;
      s.rug = 0.5;
      float aberto = step( 7.5, gHora ) * step( gHora, 23.0 );
      s.emi = mix( c1, vec3( 1.0 ), 0.3 ) * ( 0.2 + 1.1 * gNoite ) * aberto * gNoite;
    } else if ( tipo == F_SOLAR ) {
      vec2 p = vec2( uv.x / 1.0, uv.y / 1.65 );
      vec2 dd = duv / vec2( 1.0, 1.65 );
      float mold = max( gLinha( fract( p.x + 0.5 ) - 0.5, 0.05, dd.x ), gLinha( fract( p.y + 0.5 ) - 0.5, 0.04, dd.y ) );
      s.alb = mix( vec3( 0.015, 0.02, 0.035 ), c2, mold );
      s.rug = mix( 0.12, 0.4, mold );
      s.met = mix( 0.5, 0.7, mold );
      gMascaraTelhado = 1.0;
    } else if ( tipo == F_PORTA ) {
      float fr = gPulso( uv.x, 0.06, 0.94, duv.x );
      s.alb = mix( c2, c1 * ( 0.8 + 0.2 * df.r ), fr );
      s.rug = 0.6;
    } else if ( tipo == F_GARAGEM ) {
      float ripa = gLinha( fract( uv.y / 0.12 + 0.5 ) - 0.5, 0.25, duv.y / 0.12 );
      s.alb = c1 * ( 0.9 - 0.25 * ripa );
      s.rug = 0.45;
      s.met = 0.6;
    }
    s.alb = clamp( s.alb, 0.0, 0.8 );
    return s;
  }

  // ------------------------------------------------------------------ paredes com fachada
  // pé de parede mais escuro e tom por pano (desgaste)
  float pano = gH1( vec3( floor( um / 3.6 ), floor( uv.y / 6.0 ), id ) );
  s.alb = c1 * ( 0.9 + 0.2 * dt.r ) * ( 1.0 + ( pano - 0.5 ) * 0.07 * desg );
  bool noTerreo = terreo > 0.5 && uv.y < tH;
  bool platibanda = uv.y > vPF.z;
  vec2 uvA = vec2( uv.x, uv.y - ( terreo > 0.5 ? tH : 0.0 ) );

  if ( noTerreo ) {
    // ---------------- térreo
    float fv = uv.y / tH;
    vec2 d = vec2( duv.x, duv.y / tH );
    // 6 (vitrine alta) e 7 (portaria alta) desenham como 1 e 2
    float tt = terreo > 5.5 ? terreo - 5.0 : terreo;
    if ( tt < 1.5 ) {
      // vitrine: pilar no limite do vão, vidro, letreiro e verga
      float pil = gPulso( uv.x, 0.0, 0.08, d.x ) + gPulso( uv.x, 0.92, 1.0, d.x );
      float vg = gPulso( fv, 0.08, 0.66, d.y ) * ( 1.0 - pil );
      float letr = gPulso( fv, 0.72, 0.93, d.y ) * ( 1.0 - pil );
      // letreiro: um por fachada, em tons gastos (vinho, azul-petróleo, ocre, grafite ou a cor do caixilho)
      vec3 cl = gLin( gRGB( vCor.y ) );
      float hl = gH1( vec3( 7.0, 3.0, id ) );
      vec3 corLetreiro = hl < 0.2 ? vec3( 0.2, 0.045, 0.035 ) : hl < 0.4 ? vec3( 0.03, 0.075, 0.11 ) : hl < 0.6 ? cl * 0.8 : hl < 0.8 ? vec3( 0.26, 0.17, 0.05 ) : vec3( 0.06, 0.06, 0.06 );
      s.alb = mix( s.alb, c1 * 0.85, pil );
      s.alb = mix( s.alb, corLetreiro, letr );
      s.rug = mix( s.rug, 0.5, letr );
      // vidro da vitrine: iluminado por dentro das 8 às 22 h
      // o vidro da vitrine deixa ver a loja (escura de dia, com o balcão e as prateleiras mais claros embaixo)
      vec2 h = gH2( vec3( floor( uv.x ), 3.0, id ) );
      float prat = gPulso( fv * 4.0, 0.0, 0.18, d.y * 4.0 ) * step( fv, 0.5 );
      vec3 loja = mix( vec3( 0.09, 0.085, 0.075 ), vec3( 0.05, 0.055, 0.06 ), h.x ) + prat * vec3( 0.08, 0.07, 0.055 );
      s.alb = mix( s.alb, mix( loja, tinta, 0.35 ), vg );
      s.rug = mix( s.rug, 0.07, vg );
      s.met = mix( s.met, 0.22, vg );
      float aberta = ( gHora > 8.0 + 2.0 * h.y && gHora < 21.0 + 1.5 * h.x ) ? 1.0 : 0.0;
      // loja aberta: a luz de dentro aparece mesmo de dia, atrás do reflexo
      s.emi += vec3( 1.0, 0.88, 0.72 ) * vg * aberta * ( 0.1 + 0.8 * gNoite ) * ( 0.7 + 0.6 * prat + 0.3 * h.y );
      s.emi += corLetreiro * 1.6 * letr * aberta * gNoite;
    } else if ( tt < 2.5 ) {
      // portaria: vidro alto com montantes finos, luz de hall
      float mont = gLinha( fract( uv.x * 2.0 + 0.5 ) - 0.5, 0.06, d.x * 2.0 );
      float vg = gPulso( fv, 0.02, 0.86, d.y ) * ( 1.0 - mont );
      s.alb = mix( c1 * 0.95, mix( vec3( 0.3, 0.26, 0.2 ), tinta, 0.55 ), vg );
      s.alb = mix( s.alb, c2, mont * gPulso( fv, 0.02, 0.86, d.y ) );
      s.rug = mix( s.rug, 0.08, vg );
      s.met = mix( s.met, 0.7, vg );
      s.emi += vec3( 1.0, 0.85, 0.65 ) * vg * ( 0.02 + 0.6 * gNoite );
    } else if ( tt < 3.5 ) {
      // garagem: aberturas com grade e ventilação
      float ab = gPulso( uv.x, 0.12, 0.88, d.x ) * gPulso( fv, 0.0, 0.8, d.y );
      float grade = gLinha( fract( um / 0.15 + 0.5 ) - 0.5, 0.2, duv.x * vao / 0.15 );
      s.alb = mix( s.alb * 0.9, mix( vec3( 0.03 ), c2 * 0.6, grade * 0.8 ), ab );
      s.rug = mix( s.rug, 0.5, ab * grade );
    } else if ( tt < 4.5 ) {
      // pilotis (visto de longe): recuo escuro com pilares no ritmo dos vãos
      float pil = gPulso( uv.x, 0.44, 0.56, d.x );
      s.alb = mix( vec3( 0.05, 0.05, 0.048 ), c1 * 0.7, pil );
      s.ao *= 0.6;
    } else {
      // doca de galpão: portas de enrolar a cada dois vãos
      float porta = gPulso( uv.x * 0.5, 0.12, 0.88, d.x * 0.5 ) * gPulso( fv, 0.0, 0.78, d.y );
      float ripa = gLinha( fract( uv.y / 0.1 + 0.5 ) - 0.5, 0.3, duv.y / 0.1 );
      s.alb = mix( s.alb, c2 * ( 0.9 - 0.2 * ripa ), porta );
      s.met = mix( s.met, 0.6, porta );
      s.rug = mix( s.rug, 0.45, porta );
    }
    s.alb *= mix( 0.72, 1.0, smoothstep( 0.0, 0.5, uv.y ) );
  } else if ( platibanda ) {
    // ---------------- platibanda: pano liso, sujeira escorrendo da borda
    float topo = smoothstep( vPF.z + 0.9, vPF.z + 0.5, uv.y );
    s.alb = c1 * ( 0.88 + 0.2 * dt.r );
    s.alb *= 1.0 - desg * 0.18 * ( 1.0 - topo ) * dt.g;
    // pingadeira (faixa) no pé da platibanda
    s.alb *= 1.0 - 0.2 * gPulso( uv.y - vPF.z, 0.0, 0.12, duv.y );
  } else if ( tipo == F_CORTINA ) {
    // ---------------- pele de vidro: montante vertical a cada 1/2 vão, travessa e peitoril opaco na laje
    float fv = uvA.y / andar;
    vec2 d = vec2( duv.x * 2.0, duv.y / andar );
    float lonje = gLonge( vec2( duv.x, d.y ) );
    float mont = gLinha( fract( uv.x * 2.0 + 0.5 ) - 0.5, 0.05 + 0.02 * mod( vari, 2.0 ), d.x );
    float trav = gLinha( fract( fv + 0.5 ) - 0.5, 0.04, d.y );
    float esp = gPulso( fv, 0.0, 0.22 + 0.06 * mod( vari, 3.0 ), d.y );
    vec2 cel = vec2( floor( uv.x * 2.0 ), floor( fv ) );
    s.alb = c2;
    s.rug = 0.35;
    s.met = 0.6;
    float vg = ( 1.0 - max( mont, trav ) );
    // peitoril opaco (vidro serigrafado) mais escuro que a visão, nunca mais escuro que o caixilho
    vec3 opaco = mix( tinta * 1.1, c1 * 0.4, 0.15 );
    s.alb = mix( s.alb, opaco, vg * esp );
    s.rug = mix( s.rug, 0.12, vg * esp );
    s.met = mix( s.met, 0.85, vg * esp );
    gVidro( s, vg * ( 1.0 - esp ), cel, vec2( 0.0 ), tinta, lonje, uso, 1.0 );
  } else if ( tipo == F_BRISE_H || tipo == F_BRISE_V ) {
    // ---------------- brise-soleil diante do vidro (Capanema): lâminas de concreto ou metal
    vec2 d = vec2( duv.x, duv.y / andar );
    float lonje = gLonge( d );
    float fv = uvA.y / andar;
    vec2 cel = vec2( floor( uv.x ), floor( fv ) );
    gVidro( s, gPulso( fv, 0.06, 0.94, d.y ), cel, vec2( 0.0 ), tinta, lonje, uso, 0.8 );
    float lam;
    if ( tipo == F_BRISE_H ) {
      float p = uvA.y / 0.55;
      lam = gPulso( p, 0.0, 0.34, duv.y / 0.55 );
      s.inc = mix( s.inc, vec2( 0.0, ( fract( p ) < 0.17 ? 0.5 : -0.5 ) * ( 1.0 - lonje ) ), lam );
    } else {
      float p = uv.x * 4.0;
      lam = gPulso( p, 0.0, 0.3, duv.x * 4.0 );
      s.inc = mix( s.inc, vec2( ( fract( p ) < 0.15 ? -0.5 : 0.5 ) * ( 1.0 - lonje ), 0.0 ), lam );
    }
    // laje aparente em cada andar
    float laje = gPulso( fv, 0.0, 0.06, d.y );
    lam = max( lam, laje );
    s.alb = mix( s.alb, c2 * ( 0.9 + 0.2 * dt.r ), lam );
    s.rug = mix( s.rug, 0.75, lam );
    s.met = mix( s.met, 0.0, lam );
    s.emi *= 1.0 - lam;
  } else if ( tipo == F_COBOGO ) {
    // ---------------- cobogó: blocos vazados de 0,4 m com o fundo escuro
    vec2 p = vec2( um / 0.4, uvA.y / 0.4 );
    vec2 dd = vec2( duv.x * vao / 0.4, duv.y / 0.4 );
    float fu = gPulso( p.x, 0.18, 0.82, dd.x ) * gPulso( p.y, 0.18, 0.82, dd.y );
    float cruz = gPulso( p.x, 0.44, 0.56, dd.x ) + gPulso( p.y, 0.44, 0.56, dd.y );
    float furo = clamp( fu - cruz * 0.6, 0.0, 1.0 );
    s.alb = mix( c1 * ( 0.9 + 0.2 * dt.r ), vec3( 0.03, 0.03, 0.028 ), furo );
    s.ao *= 1.0 - 0.3 * furo;
    // luz da escada à noite, pelos furos
    s.emi += vec3( 1.0, 0.82, 0.6 ) * furo * 0.12 * gNoite * step( 0.65, gH1( vec3( floor( uv.x ), floor( uvA.y / 3.0 ), id ) ) );
  } else if ( tipo == F_VARANDA ) {
    // ---------------- varandas desenhadas (LOD1 e faces sem geometria): laje, guarda-corpo e o recuo escuro
    float fv = uvA.y / andar;
    vec2 d = vec2( duv.x, duv.y / andar );
    float lonje = gLonge( d );
    vec2 cel = vec2( floor( uv.x ), floor( fv ) );
    float div = gPulso( uv.x, 0.0, 0.06, d.x );
    float laje = gPulso( fv, 0.0, 0.07, d.y );
    float gc = gPulso( fv, 0.07, 0.43, d.y ) * ( 1.0 - div );
    float fundo = gPulso( fv, 0.43, 1.0, d.y ) * ( 1.0 - div );
    // o fundo: portas de vidro na sombra da laje de cima
    gVidro( s, fundo * gPulso( uv.x, 0.1, 0.9, d.x ), cel, vec2( 0.0 ), tinta, lonje, uso, 0.7 );
    s.ao *= 1.0 - 0.35 * fundo;
    // guarda-corpo: vidro claro (variante par) ou pano cheio
    vec3 gcCor = mod( vari, 2.0 ) < 0.5 ? mix( tinta * 1.3, vec3( 0.35, 0.38, 0.38 ), 0.35 ) : c1;
    s.alb = mix( s.alb, gcCor, gc );
    s.met = mix( s.met, mod( vari, 2.0 ) < 0.5 ? 0.7 : 0.0, gc );
    s.rug = mix( s.rug, mod( vari, 2.0 ) < 0.5 ? 0.12 : 0.8, gc );
    s.alb = mix( s.alb, c2 * 1.05, laje );
    s.rug = mix( s.rug, 0.8, laje );
    s.emi *= 1.0 - max( laje, gc * 0.7 );
  } else if ( tipo == F_GALPAO ) {
    // ---------------- galpão: chapa ondulada vertical e faixa de janelas alta
    float o = um / 0.25;
    float l = gLonge( vec2( duv.x * vao / 0.25 ) );
    s.alb = c1 * mix( 0.9 + 0.12 * cos( 6.2832 * o ), 1.0, l ) * ( 0.85 + 0.2 * dt.r );
    s.inc = vec2( sin( 6.2832 * o ) * 0.4 * ( 1.0 - l ), 0.0 );
    s.met = 0.5;
    s.rug = 0.5;
    float fv = uvA.y / andar;
    vec2 d = vec2( duv.x, duv.y / andar );
    float jan = gPulso( fv, 0.72, 0.88, d.y ) * gPulso( uv.x, 0.06, 0.94, d.x );
    gVidro( s, jan, vec2( floor( uv.x ), floor( fv ) ), vec2( 0.0 ), tinta, gLonge( d ), uso, 0.6 );
    // rodapé de concreto
    float rod = gPulso( uv.y / 100.0, 0.0, 0.012, duv.y / 100.0 );
    s.alb = mix( s.alb, vec3( 0.34, 0.33, 0.31 ) * ( 0.8 + 0.3 * dt.r ), rod );
    s.met = mix( s.met, 0.0, rod );
  } else {
    // ---------------- grade de janelas sobre o material da parede
    if ( tipo == F_PASTILHA ) {
      // pastilha de 5 cm: rejunte que de longe some na média
      vec2 p = vec2( um / 0.05, uv.y / 0.05 );
      vec2 dd = vec2( duv.x * vao / 0.05, duv.y / 0.05 );
      float rj = max( gLinha( fract( p.x + 0.5 ) - 0.5, 0.12, dd.x ), gLinha( fract( p.y + 0.5 ) - 0.5, 0.12, dd.y ) );
      float tom = gH1( vec3( floor( p ), id ) );
      s.alb = c1 * ( 0.92 + 0.16 * mix( tom, 0.5, gLonge( dd ) ) ) * ( 1.0 - 0.2 * rj ) * ( 0.9 + 0.2 * dt.r );
      s.rug = 0.45;
    } else if ( tipo == F_TIJOLO ) {
      vec2 p = vec2( um / 0.24, uv.y / 0.09 );
      p.x += step( 0.5, fract( p.y * 0.5 ) ) * 0.5;
      vec2 dd = vec2( duv.x * vao / 0.24, duv.y / 0.09 );
      float rj = max( gLinha( fract( p.x + 0.5 ) - 0.5, 0.06, dd.x ), gLinha( fract( p.y + 0.5 ) - 0.5, 0.12, dd.y ) );
      float tom = gH1( vec3( floor( p ), id ) );
      s.alb = c1 * ( 0.85 + 0.3 * mix( tom, 0.5, gLonge( dd ) ) ) * ( 1.0 - 0.25 * rj );
      s.rug = 0.88;
    } else if ( tipo == F_PAINEL ) {
      // painel pré-moldado: juntas no vão e a cada andar
      float fv = uvA.y / andar;
      vec2 d = vec2( duv.x, duv.y / andar );
      float jt = max( gLinha( fract( uv.x + 0.5 ) - 0.5, 0.02, d.x ), gLinha( fract( fv + 0.5 ) - 0.5, 0.02, d.y ) );
      s.alb *= 1.0 - 0.28 * jt;
      s.rug = 0.8;
    }
    gGrade( s, uvA, duv, andar, vari, c2, tinta, uso, desg, tipo );
  }
  // pé de parede escuro (umidade e respingo) e sujeira sob a platibanda
  s.alb *= mix( 1.0 - 0.25 * desg, 1.0, smoothstep( 0.0, 0.7, uv.y ) );
  s.alb = clamp( s.alb, 0.0, 0.8 );
  s.ao *= mix( 0.7, 1.0, smoothstep( 0.0, 1.6, uv.y ) );
  return s;
}
`;

/** Fragmento: a superfície calculada (troca o #include <color_fragment>). */
export const FRAGMENTO_COR = /* glsl */ `
#include <color_fragment>
GSup gS = gFachada();
diffuseColor.rgb = gS.alb;
// abandonado: mais escuro e sujo
if ( mod( vIdent.y, 2.0 ) > 0.5 ) diffuseColor.rgb *= vec3( 0.62, 0.6, 0.57 );
`;

export const FRAGMENTO_RUGOSIDADE = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = gS.rug;
`;

export const FRAGMENTO_METAL = /* glsl */ `
#include <metalnessmap_fragment>
metalnessFactor = gS.met;
`;

/** Normal inclinada por painel (depois do #include <normal_fragment_maps>): tangente horizontal da face. */
export const FRAGMENTO_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
  vec3 gCima = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
  vec3 gT = cross( gCima, normal );
  float gTl = length( gT );
  gT = gTl > 0.1 ? gT / gTl : normalize( cross( normalize( ( viewMatrix * vec4( 1.0, 0.0, 0.0, 0.0 ) ).xyz ), normal ) );
  vec3 gB = cross( normal, gT );
  normal = normalize( normal + gT * gS.inc.x + gB * gS.inc.y );
}
`;

export const FRAGMENTO_EMISSIVO = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += gS.emi;
if ( abs( vIdent.x - gSelecionado ) < 0.5 ) {
  float gFr = pow( 1.0 - abs( dot( normalize( vViewPosition ), normal ) ), 3.0 );
  totalEmissiveRadiance += vec3( 0.9, 0.72, 0.42 ) * ( 0.12 + 1.4 * gFr );
}
`;

/** Céu de reserva no reflexo quando não há mapa de ambiente (depois do #include <lights_fragment_maps>). */
export const FRAGMENTO_CEU = /* glsl */ `
#include <lights_fragment_maps>
#if defined( RE_IndirectSpecular ) && !defined( USE_ENVMAP )
{
  vec3 gR = inverseTransformDirection( reflect( - geometryViewDir, geometryNormal ), viewMatrix );
  vec3 gCeu = gR.y > 0.0 ? mix( gCeuHor, gCeuZen, pow( gR.y, 0.55 ) ) : mix( gCeuHor, gCeuChao, smoothstep( 0.0, 0.2, - gR.y ) );
  radiance += gCeu * gCeuLigado;
}
#endif
`;

/** Oclusão cozida e do shader (depois do #include <aomap_fragment>). */
export const FRAGMENTO_AO = /* glsl */ `
#include <aomap_fragment>
reflectedLight.indirectDiffuse *= gS.ao;
reflectedLight.indirectSpecular *= mix( 1.0, gS.ao, 0.6 );
reflectedLight.directDiffuse *= mix( 1.0, gS.ao, 0.3 );
`;

/** Passe de máscara (?passe=mascara, aceite de cor A9): telhado branco, o resto do prédio preto. */
export const FRAGMENTO_MASCARA = /* glsl */ `
#include <dithering_fragment>
if ( gPrediosMascara > 0.5 ) gl_FragColor = vec4( vec3( gMascaraTelhado ), 1.0 );
`;

export { BITS_TABELA };
