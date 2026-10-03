// GLSL da gente (material `pessoa`, desenho do render 9.1): MeshStandardMaterial com a caminhada no vértice e as cores
// da instância. Quem usa importa os trechos (mundo/pedestres.js); este arquivo não registra nada.
//   aCorpo    parte e membro do vértice (geracao/pessoas.js)
//   aVar      deslocamento da silhueta feminina, vezes aPessoa.z
//   aPessoa   fase do passo (0 a 1), amplitude (0 parado, 1 andando), feminino (0 a 1), livre
//   aRoupa    cor de cima (sRGB 0 a 255) e os bits (cabelo, longo, pernas de fora, saia, manga longa, bolsa)
//   aRoupa2   cor de baixo (sRGB 0 a 255) e o tom de pele (0 claro a 255 escuro)
// A perna gira no quadril e a canela dobra no joelho quando a perna vem para a frente; o braço balança no ombro, ao
// contrário da perna do mesmo lado; o corpo sobe e desce um pouco a cada passo. A cor sai pronta do vértice.
// As articulações repetem JUNTA de geracao/pessoas.js (o teste confere): o gerador vem sob demanda e o GLSL não.

/** Quadril, joelho e ombro (m, na figura de 1,70 m), iguais a JUNTA de geracao/pessoas.js. */
export const JUNTAS_GLSL = Object.freeze({ quadril: 0.9, joelho: 0.48, ombro: 1.39 });
const f = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));
const JUNTA = JUNTAS_GLSL;

/** Vértice: declarações (depois do #include <common>). */
export const PESSOA_VERTICE_PARS = /* glsl */ `
attribute vec2 aCorpo;
attribute vec3 aVar;
attribute vec4 aPessoa;
attribute vec4 aRoupa;
attribute vec4 aRoupa2;
flat varying vec4 vPessoa;   // albedo linear e rugosidade
const float PESSOA_QUADRIL = ${f(JUNTA.quadril)};
const float PESSOA_JOELHO = ${f(JUNTA.joelho)};
const float PESSOA_OMBRO = ${f(JUNTA.ombro)};
vec3 pessoaLinear( vec3 s ) { return pow( s / 255.0, vec3( 2.2 ) ); }
// gira p em volta do eixo x que passa por (0, y0, 0)
vec3 pessoaGira( vec3 p, float y0, float a ) {
  float c = cos( a );
  float s = sin( a );
  float y = p.y - y0;
  return vec3( p.x, y0 + y * c - p.z * s, y * s + p.z * c );
}
vec3 pessoaGiraN( vec3 n, float a ) {
  float c = cos( a );
  float s = sin( a );
  return vec3( n.x, n.y * c - n.z * s, n.y * s + n.z * c );
}
// tom de pele: 5 tons reais, do claro ao escuro
vec3 pessoaPele( float t ) {
  vec3 k0 = vec3( 236.0, 196.0, 166.0 );
  vec3 k1 = vec3( 214.0, 167.0, 132.0 );
  vec3 k2 = vec3( 176.0, 124.0, 88.0 );
  vec3 k3 = vec3( 129.0, 86.0, 58.0 );
  vec3 k4 = vec3( 86.0, 57.0, 40.0 );
  float x = clamp( t, 0.0, 1.0 ) * 4.0;
  vec3 c = x < 1.0 ? mix( k0, k1, x ) : x < 2.0 ? mix( k1, k2, x - 1.0 ) : x < 3.0 ? mix( k2, k3, x - 2.0 ) : mix( k3, k4, x - 3.0 );
  return pessoaLinear( c );
}
vec3 pessoaCabelo( int k ) {
  return k == 0 ? pessoaLinear( vec3( 24.0, 20.0, 18.0 ) ) : k == 1 ? pessoaLinear( vec3( 58.0, 40.0, 30.0 ) )
    : k == 2 ? pessoaLinear( vec3( 120.0, 88.0, 58.0 ) ) : pessoaLinear( vec3( 150.0, 148.0, 144.0 ) );
}
`;

/** Vértice: troca o #include <beginnormal_vertex> (calcula a pose, a normal e a cor). */
export const PESSOA_VERTICE_NORMAL = /* glsl */ `
vec3 objectNormal = normal;
vec3 pessoaPos = position + aVar * aPessoa.z;
{
  int parte = int( aCorpo.x + 0.5 );
  int membro = int( aCorpo.y + 0.5 );
  int bits = int( aRoupa.a + 0.5 );
  float fase = aPessoa.x * 6.2831853;
  float amp = aPessoa.y;
  // lado A (perna 1 e 2, braço 6 em fase com ela) e lado B
  float lado = ( membro == 1 || membro == 2 || membro == 6 ) ? 1.0 : -1.0;
  if ( membro >= 1 && membro <= 4 ) {
    // a canela dobra no joelho enquanto a perna vem para a frente, depois a perna gira no quadril
    if ( membro == 2 || membro == 4 ) {
      float dobra = 0.75 * amp * max( 0.0, cos( fase ) * lado );
      pessoaPos = pessoaGira( pessoaPos, PESSOA_JOELHO, dobra );
      objectNormal = pessoaGiraN( objectNormal, dobra );
    }
    float a = -0.42 * amp * sin( fase ) * lado;
    pessoaPos = pessoaGira( pessoaPos, PESSOA_QUADRIL, a );
    objectNormal = pessoaGiraN( objectNormal, a );
  } else if ( membro >= 5 ) {
    float a = 0.32 * amp * sin( fase ) * lado;
    pessoaPos = pessoaGira( pessoaPos, PESSOA_OMBRO, a );
    objectNormal = pessoaGiraN( objectNormal, a );
  }
  // o corpo sobe no meio do passo
  pessoaPos.y += 0.018 * amp * abs( sin( fase ) );
  // as partes de cada um: cabelo longo, saia e bolsa só em quem tem
  bool some = ( parte == 8 && ( bits & 4 ) == 0 ) || ( parte == 9 && ( bits & 16 ) == 0 ) || ( parte == 10 && ( bits & 64 ) == 0 );
  if ( some ) pessoaPos = vec3( 0.0 );
  vec3 pele = pessoaPele( aRoupa2.a / 255.0 );
  vec3 cima = pessoaLinear( aRoupa.rgb );
  vec3 baixo = pessoaLinear( aRoupa2.rgb );
  vec3 c = pele;
  float rug = 0.62;
  bool pernas = ( bits & 8 ) != 0;
  bool saia = ( bits & 16 ) != 0;
  if ( parte == 1 || parte == 8 ) { c = pessoaCabelo( bits & 3 ); rug = 0.5; }
  else if ( parte == 2 ) { c = cima; rug = 0.85; }
  else if ( parte == 3 ) { c = ( saia && membro >= 1 ) ? pele : baixo; rug = ( saia && membro >= 1 ) ? 0.62 : 0.88; }
  else if ( parte == 4 ) { c = pernas ? vec3( 0.52, 0.5, 0.47 ) : vec3( 0.035 ); rug = 0.55; }
  else if ( parte == 5 ) { c = cima; rug = 0.85; }
  else if ( parte == 6 ) { c = ( bits & 32 ) != 0 ? cima : pele; rug = ( bits & 32 ) != 0 ? 0.85 : 0.62; }
  else if ( parte == 7 ) { c = pernas ? pele : baixo; rug = pernas ? 0.62 : 0.88; }
  else if ( parte == 9 ) { c = baixo; rug = 0.85; }
  else if ( parte == 10 ) { c = pessoaLinear( vec3( 62.0, 44.0, 34.0 ) ); rug = 0.45; }
  // manga curta: o braço de cima é pele abaixo da manga (a manga fica no anel do ombro, parte 2)
  if ( parte == 5 && ( bits & 32 ) == 0 ) c = pele;
  vPessoa = vec4( c, rug );
}
`;

/** Vértice: troca o #include <begin_vertex>. */
export const PESSOA_VERTICE_MAIN = /* glsl */ `
vec3 transformed = pessoaPos;
`;

/** Fragmento: declarações. */
export const PESSOA_FRAGMENTO_PARS = /* glsl */ `
flat varying vec4 vPessoa;
`;
/** Fragmento: a cor (troca o #include <color_fragment>). */
export const PESSOA_FRAGMENTO_COR = /* glsl */ `
diffuseColor.rgb = vPessoa.rgb;
`;
/** Fragmento: a rugosidade (troca o #include <roughnessmap_fragment>). */
export const PESSOA_FRAGMENTO_RUGOSIDADE = /* glsl */ `
float roughnessFactor = vPessoa.a;
`;

/** Os trechos são importados por quem usa; nada a registrar. */
export function registrar() {}
