// GLSL da neblina de altura com perspectiva aérea (desenho do render 2.4, gancho 'neblina'): extinção exponencial em
// altura integrada em forma fechada ao longo do raio da câmera ao fragmento, por canal (o azul some antes: o longe
// fica azulado), e a luz espalhada é a cor do horizonte do céu na direção do olhar, com o lóbulo do sol. A MESMA
// função de cor (gNeblinaCorVista) é usada pelo céu abaixo do horizonte e na faixa rente a ele: o chão ao longe e o
// céu se encontram na mesma cor, sem costura. Tudo em highp (D44). Fora dos índices: quem usa importa os trechos.

/** Uniformes da cor do horizonte (o céu também declara estes; os valores vêm do mesmo estado do céu). */
export const NEBLINA_COR_PARS = /* glsl */ `
uniform vec3 gNeblinaAnel[ 12 ];
uniform vec3 gNeblinaZenite;
uniform vec3 gNeblinaSolDir;
// cor do horizonte na direção d: 12 azimutes contados a partir do sol, em pi · (i / 11)² (densos perto do sol, onde
// o lóbulo de Mie é estreito), e o alto para quem olha para cima
vec3 gNeblinaCorVista( vec3 d ) {
  vec2 s = normalize( gNeblinaSolDir.xz + vec2( 1e-6, 0.0 ) );
  vec2 h = normalize( d.xz + vec2( 1e-6, 0.0 ) );
  float phi = acos( clamp( dot( h, s ), -1.0, 1.0 ) );
  float t = sqrt( phi / 3.141592653589793 ) * 11.0;
  int i = int( min( floor( t ), 10.0 ) );
  vec3 cor = mix( gNeblinaAnel[ i ], gNeblinaAnel[ i + 1 ], t - float( i ) );
  return mix( cor, gNeblinaZenite, 0.55 * smoothstep( 0.12, 1.0, d.y ) );
}
`;

/** Declarações e a função do gancho (trecho 'pars' do fragmento). vGPosMundo vem do registro de ganchos. */
export const NEBLINA_PARS = /* glsl */ `
uniform vec3 gNeblinaBeta;
uniform float gNeblinaQueda;
uniform float gNeblinaLigada;
${NEBLINA_COR_PARS}
vec3 gNeblina( vec3 cor ) {
  if ( gNeblinaLigada < 0.5 ) return cor;
  vec3 d = vGPosMundo - cameraPosition;
  float dist = length( d );
  float k = gNeblinaQueda;
  float h0 = cameraPosition.y;
  // densidade média ao longo do raio em relação à do nível do mar (exponencial em altura, forma fechada)
  float fator = abs( d.y ) > 0.5 ? ( exp( - k * h0 ) - exp( - k * ( h0 + d.y ) ) ) / ( k * d.y ) : exp( - k * h0 );
  vec3 T = exp( - gNeblinaBeta * ( dist * fator ) );
  vec3 luz = gNeblinaCorVista( d / max( dist, 1e-3 ) );
  return cor * T + luz * ( 1.0 - T );
}
`;

/** Trecho 'fim' (antes da curva de tons, em linear). */
export const NEBLINA_FIM = 'gl_FragColor.rgb = gNeblina( gl_FragColor.rgb );';

export function registrar() {}
