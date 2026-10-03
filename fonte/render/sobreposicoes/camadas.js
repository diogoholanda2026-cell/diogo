// Camadas de informação no mundo (desenho do render 11.1; D29; X3a): a "info view" do CS2. Com uma camada ligada o
// mundo fica neutro e o dado pinta o prédio inteiro, a pista ou o chão; desligada, nada muda e nada custa.
//
//   gancho 'camada'   (motor/ganchos.js) nos materiais que o pedem (o `edificio` da R4a, os colocáveis da R5, a
//                     Arcologia): a cor base vira um cinza claro pela luminância ANTES da luz (dentro do laço da luz
//                     direcional, a primeira vez), o especular vira o de um dielétrico fosco (sem metal: no three
//                     r186 o difuso sai de diffuseContribution e o especular de specularColorBlended) e o emissivo cai
//                     a 15%.
//                     No `edificio`, o valor da camada vem da tabela de prédios na GPU (canal R, já lido no vértice
//                     para os bits: vIdent.w), sem leitura a mais: 0 é "sem dado" (fica neutro); na categórica o valor
//                     é o índice da cor (1 a 7); na contínua, 1 a 255 percorrem a rampa. Desligada, um uniforme corta
//                     tudo (gCamada.x): nenhuma leitura de textura, nenhum varying novo, nenhum programa novo ao ligar.
//   chão e vias       R2a (terreno.js) e R3a (vias.js) ouvem o mesmo aviso 'camadas' e pintam o deles.
//   prédios           o canal R da tabela é escrito pela R4a (predios.js) no mesmo aviso; o formato de min e max que
//                     ela usa (round((v - min) / (max - min) x 255)) é o que a UI manda (ui/mundo/camadas.js põe o 0
//                     de "sem dado" ajustando o min na contínua e usa min 0 e max 255 na categórica).
//
// Aviso 'camadas' (R.camadas.mostrar): { fonte, dados, grade, cores: ['#rrggbb' x até 8], min, max, categorico,
// porPredio? } ou null (R.camadas.ocultar). porPredio { dados, categorico, min, max } pinta também o prédio numa camada
// do chão ou das vias (a Zonas pela zona do prédio, a Serviços pela rua da frente). O domínio 'camadas' publica
// estado() para as cenas e os testes.
import * as THREE from 'three';

/** Até quantas cores a rampa leva (o mesmo teto do chão e das vias). */
export const MAX_CORES = 8;
/** Quanto do emissivo (janelas acesas, letreiros) fica com a camada ligada. */
export const EMISSIVO_COM_CAMADA = 0.15;

/** Declarações do gancho (depois do #include <common>): os uniformes, a rampa e a cor base neutra ou pintada. */
export const CAMADA_PARS = /* glsl */ `
uniform vec4 gCamada;          // ligada, n cores, categórica, quanto do emissivo fica
uniform vec3 gCamadaRampa[ 8 ]; // linear
bool gCamadaFeita = false;
vec3 gCamadaRampaCor( float v ) {
  if ( gCamada.z > 0.5 ) return gCamadaRampa[ int( clamp( v, 0.0, 7.0 ) ) ];
  float n = clamp( gCamada.y, 1.0, 8.0 );
  float x = clamp( ( v - 1.0 ) / 254.0, 0.0, 1.0 ) * ( n - 1.0 );
  int k0 = int( floor( x ) );
  int k1 = min( k0 + 1, int( n ) - 1 );
  return mix( gCamadaRampa[ k0 ], gCamadaRampa[ k1 ], fract( x ) );
}
// alb: a cor base do material (sem o metal); v: o valor da camada no prédio (0 a 255; 0 sem dado)
vec3 gCamadaBase( vec3 alb, float v ) {
  float l = dot( alb, vec3( 0.2126, 0.7152, 0.0722 ) );
  if ( v > 0.5 ) return gCamadaRampaCor( v ) * mix( 0.62, 1.0, clamp( l / 0.4, 0.0, 1.0 ) );
  return mix( alb, vec3( 0.06 + 1.05 * l ), 0.88 );
}
`;

// o valor da camada só existe no `edificio` (vIdent, declarado depois destas linhas no programa): lido no main
const VALOR = /* glsl */ `
  float gCamV = 0.0;
#ifdef EDIFICIO
  gCamV = vIdent.w;
#endif
`;

/**
 * Dentro do laço da luz direcional, antes do RE_Direct da primeira luz: troca a cor base e o especular do material (o
 * resto da luz, inclusive a do ambiente e a do céu, já usa o material trocado). Só nos materiais com luz do three.
 */
export const CAMADA_SOL = /* glsl */ `
#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG ) || defined( TOON )
if ( gCamada.x > 0.5 && ! gCamadaFeita ) {
  gCamadaFeita = true;
${VALOR}
  vec3 gCamB = gCamadaBase( diffuseColor.rgb, gCamV );
  material.diffuseColor = gCamB;
#ifdef STANDARD
  // three r186: o difuso usa diffuseContribution e o especular specularColorBlended (o metal entra nos dois)
  material.diffuseContribution = gCamB;
  material.metalness = 0.0;
  material.specularColor = vec3( 0.04 );
  material.specularColorBlended = vec3( 0.04 );
  material.roughness = max( material.roughness, 0.6 );
#endif
}
#endif
`;

/**
 * Depois do aomap: o emissivo cai (janelas e letreiros não competem com a cor da camada) e, num material sem luz
 * direcional (a cena sem sol), a luz difusa já somada troca de cor base pela razão.
 */
export const CAMADA_INDIRETA = /* glsl */ `
#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG ) || defined( TOON )
if ( gCamada.x > 0.5 ) {
  totalEmissiveRadiance *= gCamada.w;
  if ( ! gCamadaFeita ) {
${VALOR}
#ifdef STANDARD
    vec3 gCamK = gCamadaBase( diffuseColor.rgb, gCamV ) / max( material.diffuseContribution, vec3( 0.02 ) );
#else
    vec3 gCamK = gCamadaBase( diffuseColor.rgb, gCamV ) / max( material.diffuseColor, vec3( 0.02 ) );
#endif
    reflectedLight.directDiffuse *= gCamK;
    reflectedLight.indirectDiffuse *= gCamK;
  }
}
#endif
`;

/** Uniformes globais do gancho (o mesmo objeto entra em todo material que pede 'camada'). */
export function uniformesCamada() {
  return {
    gCamada: { value: new THREE.Vector4(0, 0, 0, EMISSIVO_COM_CAMADA) },
    gCamadaRampa: { value: Array.from({ length: MAX_CORES }, () => new THREE.Color(0.5, 0.5, 0.5)) },
  };
}

/** Definição do gancho para ganchos.definir('camada', ...). */
export function ganchoCamada(uniformes = uniformesCamada()) {
  return {
    uniformes,
    vertice: { pars: '', main: '' },
    fragmento: { pars: CAMADA_PARS, sol: CAMADA_SOL, indireta: CAMADA_INDIRETA, fim: '' },
  };
}

/**
 * Valores dos uniformes para um aviso 'camadas' (puro, para os testes): { ligada, n, categorico, cores: [hex] }.
 * Sem aviso (null), desligada.
 */
export function estadoDoAviso(c) {
  if (!c) return { ligada: false, n: 0, categorico: false, cores: [] };
  const cores = (Array.isArray(c.cores) ? c.cores : []).filter((h) => typeof h === 'string').slice(0, MAX_CORES);
  return { ligada: true, n: Math.max(1, cores.length), categorico: !!c.categorico, cores, fonte: c.fonte ?? null };
}

function criarCamadas(ctx) {
  const U = ctx.ganchos.obter('camada')?.uniformes ?? ctx.ganchos.uniformes;
  const gCamada = U.gCamada ?? ctx.ganchos.uniformes.gCamada;
  const rampa = U.gCamadaRampa ?? ctx.ganchos.uniformes.gCamadaRampa;
  let atual = estadoDoAviso(null);
  let trocas = 0;

  function aplicarAviso(c) {
    atual = estadoDoAviso(c);
    trocas++;
    gCamada.value.set(atual.ligada ? 1 : 0, atual.n, atual.categorico ? 1 : 0, EMISSIVO_COM_CAMADA);
    // Color.set(hex) lê o hex em sRGB e guarda em linear (ColorManagement do three)
    atual.cores.forEach((h, k) => rampa.value[k].set(h));
  }

  /**
   * Camada do chão ou das vias que também pinta o prédio (a Zonas e a Serviços): o canal R da tabela de
   * prédios publicada pela R4a (ctx.dominio('predios').tabela), escrito depois do ouvinte dela (que zerou o canal
   * porque a fonte não é 'predios' e já pediu o envio inteiro da tabela).
   */
  function pintarPredios(c) {
    const tab = ctx.dominio('predios')?.tabela;
    const dados = c?.porPredio?.dados;
    if (!tab?.image?.data || !dados || c.fonte === 'predios') return;
    const D = tab.image.data;
    const n = Math.min(dados.length, D.length / 4);
    const cat = c.porPredio.categorico !== false;
    const min = c.porPredio.min ?? 0;
    const max = c.porPredio.max ?? 1;
    for (let i = 0; i < n; i++) {
      const v = dados[i];
      // categórica: o índice da cor; contínua: 1 a 255 na rampa (0 fica para "sem dado"), como nas vias
      if (!Number.isFinite(v)) D[4 * i] = 0;
      else if (cat) D[4 * i] = Math.max(0, Math.min(255, Math.round(v)));
      else D[4 * i] = 1 + Math.round(Math.min(1, Math.max(0, (v - min) / (max - min || 1))) * 254);
    }
    tab.clearUpdateRanges?.();
    tab.needsUpdate = true;
  }

  const soltar = ctx.ouvir('camadas', (c) => {
    aplicarAviso(c);
    pintarPredios(c);
  });
  if (ctx.sobre.camadas !== undefined) aplicarAviso(ctx.sobre.camadas);

  return {
    nome: 'camadas',
    /** Estado da camada ligada (cenas e testes): { ligada, n, categorico, cores, fonte, trocas }. */
    estado: () => ({ ...atual, trocas }),
    descartar() {
      soltar();
      gCamada.value.x = 0;
    },
  };
}

export function registrar(api) {
  api.ganchos.definir('camada', ganchoCamada());
  api.registrarDominio('camadas', criarCamadas);
}
