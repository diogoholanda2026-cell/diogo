// Noite de metrópole (desenho do render 2.9, gancho 'noite'): a luz que a cidade põe nela mesma, sem luz dinâmica
// real. Três partes, todas por textura e uniforme (zero chamadas no quadro):
//   luz da rua: o mapa de luz da rua (poças dos postes numa textura sobre o mapa) ilumina chão, calçada, lote, o térreo
//     das fachadas (cai com a altura acima do chão) e a água. O mapa é da R3a (render/mundo/luzRua.js, que o publica em
//     ctx.luzRua = { textura, origem: [x, z], tam, ganho, brilho }); até ela publicar, este módulo desenha um
//     substituto a partir das arestas do espelho: postes ao longo das vias, vapor de sódio âmbar nas ruas e LED neutro
//     nas avenidas, cada um uma gaussiana somada numa passada de instâncias, refeita só quando as vias mudam. O gancho
//     lê a luz que chega ao chão: o mapa suavizado (Suavizar, duas chamadas quando ele muda), com as poças emendadas;
//   luz das janelas: a luz quente que sai das janelas acesas e cai na rua entre os prédios, pela oclusão do campo de
//     alturas (onde o céu some atrás de fachadas, há janelas perto), com a agenda da hora;
//   brilho da cidade: a soma das luzes vira o brilho alaranjado do céu e da neblina sobre a área construída
//     (ctx.ambiente.brilhoCidade, que o céu e a luz do ambiente leem).
// O gancho lê o campo (chão da vizinhança e oclusão) da sombra de longe: uma textura a mais só, a da luz no chão.
import * as THREE from 'three';
import { CAMPO_PARS } from '../materiais/shaders/sombra.glsl.js';
import { ponto } from '../../comum/bezier.js';
import { VIAS_ORDEM, VIAS } from '../../data/vias.js';

// ------------------------------------------------------------------------------------------------ GLSL do gancho

/**
 * Declarações do gancho 'noite'. gNoiteParams: força (0 de dia a 1 de noite), altura da lâmpada (m: a luz da rua
 * acende o chão e a parede até ela e some acima), queda da luz das janelas (m). A luz do poste cai de cima: no prédio
 * (EDIFICIO, predio = 1) a face de cima só acende até 3 m acima do chão da vizinhança (marquise, laje baixa), e o
 * telhado fica escuro; no chão, na via e na água a face de cima acende inteira (a encosta não apaga a rua).
 */
export const NOITE_PARS = /* glsl */ `
${CAMPO_PARS}
uniform sampler2D gLuzRuaMapa;
uniform vec4 gLuzRuaParams; // origem x, origem z, 1 / lado, ganho
uniform vec4 gNoiteParams;
uniform vec3 gNoiteJanelas; // irradiância da luz das janelas na rua (cor e força pela hora)
vec3 gNoiteLuz( vec3 nW, float predio ) {
  if ( gNoiteParams.x <= 0.0 ) return vec3( 0.0 );
  // sem o campo (GPU sem alvo em ponto flutuante): o chão e as paredes acendem, o telhado não, e sem a luz das janelas
  vec4 c = gCampoLigado > 0.5 ? gCampo( vGPosMundo.xz + nW.xz * ( 0.6 * gCampoParams.w ) )
    : vec4( 0.0, 0.0, 1.0, vGPosMundo.y - predio * step( 0.5, nW.y ) * 1.0e4 );
  float z = max( 0.0, vGPosMundo.y - c.a );
  vec3 rua = texture( gLuzRuaMapa, ( vGPosMundo.xz + nW.xz * 1.5 - gLuzRuaParams.xy ) * gLuzRuaParams.z ).rgb * gLuzRuaParams.w;
  float cima = clamp( nW.y, 0.0, 1.0 );
  float teto = mix( gNoiteParams.y, mix( 1.0e4, 3.0, predio ), smoothstep( 0.5, 0.8, cima ) );
  vec3 luz = rua * mix( 0.5, 1.0, cima ) * ( 1.0 - smoothstep( 0.3 * teto, teto, z ) );
  float perto = 1.0 - c.b;
  luz += gNoiteJanelas * ( perto * perto ) * exp( - z / gNoiteParams.z ) * mix( 0.7, 1.0, cima );
  return luz * gNoiteParams.x;
}
`;

/** Trecho 'indireta' (depois do HAO): a luz da noite entra como luz difusa, na cor do material. */
export const NOITE_INDIRETA = /* glsl */ `
#ifdef G_ILUMINADO
#ifdef EDIFICIO
reflectedLight.indirectDiffuse += gNoiteLuz( G_NORMAL_MUNDO, 1.0 ) * BRDF_Lambert( material.diffuseColor );
#else
reflectedLight.indirectDiffuse += gNoiteLuz( G_NORMAL_MUNDO, 0.0 ) * BRDF_Lambert( material.diffuseColor );
#endif
#endif
`;

// ------------------------------------------------------------------------------------------------ postes (puro)

/** Cor linear (por unidade de irradiância) do vapor de sódio (2.000 K) e do LED de rua (4.000 K). */
export const LUZES = Object.freeze({ sodio: [1.0, 0.48, 0.14], led: [1.0, 0.84, 0.64] });

/**
 * Postes por tipo de via: espaçamento (m), lados (1 alterna, 2 os dois), força no centro da poça, raio da poça (m,
 * desvio da gaussiana) e a fração de LED (o resto é sódio). Rodovia só com poucos postes (acessos).
 */
export const POSTES = Object.freeze({
  rua: { passo: 28, lados: 1, forca: 1.1, raio: 6, led: 0.3 },
  ruaMao: { passo: 28, lados: 1, forca: 1.1, raio: 6, led: 0.3 },
  avenida: { passo: 32, lados: 2, forca: 1.3, raio: 7, led: 0.5 },
  avenidaG: { passo: 32, lados: 2, forca: 1.45, raio: 8, led: 0.6 },
  rodovia: { passo: 60, lados: 1, forca: 0.8, raio: 8, led: 1 },
  terra: { passo: 44, lados: 1, forca: 0.7, raio: 6, led: 0 },
});

/** Distância (m) do centro da poça ao eixo, por dentro do meio-fio: o braço do poste joga a luz sobre a pista. */
const POCA_DENTRO = 3.5;

const hash = (a, b) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  return ((h ^ (h >>> 12)) >>> 0) / 4294967296;
};

/**
 * Postes das arestas vivas do espelho: Float32Array com 6 números por poste (x, z, raio, r, g, b), a cor já vezes a
 * força. Determinístico pela ordem das arestas.
 * @param {object} A  espelho.vias.arestas
 */
export function postesDasVias(A) {
  const out = [];
  if (!A) return new Float32Array(0);
  const q = [0, 0];
  const t = [0, 0];
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    const tipo = VIAS_ORDEM[A.tipo[e]] ?? 'rua';
    const P = POSTES[tipo] ?? POSTES.rua;
    const meia = Math.max(1, (VIAS[tipo]?.largura ?? 16) / 2 - POCA_DENTRO);
    const comp = A.comp[e] || 1;
    const n = Math.max(1, Math.round(comp / P.passo));
    const t0 = A.corte ? A.corte[2 * e] : 0;
    const t1 = A.corte ? A.corte[2 * e + 1] : 1;
    const led = hash(e, 7) < P.led;
    const cor = led ? LUZES.led : LUZES.sodio;
    for (let k = 0; k < n; k++) {
      const u = t0 + ((t1 - t0) * (k + 0.5)) / n;
      ponto(A.p, u, q, 8 * e);
      const d = u + 1e-3 <= 1 ? u + 1e-3 : u - 1e-3;
      ponto(A.p, d, t, 8 * e);
      let dx = (t[0] - q[0]) * (d > u ? 1 : -1);
      let dz = (t[1] - q[1]) * (d > u ? 1 : -1);
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const lados = P.lados === 2 ? [1, -1] : [k % 2 ? 1 : -1];
      const f = P.forca * (0.85 + 0.3 * hash(e, k));
      for (const s of lados) {
        out.push(q[0] - dz * meia * s, q[1] + dx * meia * s, P.raio, cor[0] * f, cor[1] * f, cor[2] * f);
      }
    }
  }
  return Float32Array.from(out);
}

/** Brilho da cidade (0 a 1) pelo número de postes: a cidade sintética de 12 mil prédios passa de 0,9. */
export const brilhoDosPostes = (n) => Math.min(1, Math.max(0.04, Math.sqrt(n / 3000)));

/**
 * Luz que sai das janelas e cai na rua, pela hora do céu (irradiância na rua mais escondida, antes da oclusão):
 * cresce do fim de tarde às 20h e cai de madrugada, como a agenda das fachadas.
 */
export function forcaJanelas(hora) {
  const h = ((hora % 24) + 24) % 24;
  if (h >= 17 && h < 20) return 0.3 + 0.7 * ((h - 17) / 3);
  if (h >= 20 && h < 23) return 1 - 0.3 * ((h - 20) / 3);
  if (h >= 23 || h < 5) return 0.45;
  if (h < 7) return 0.45 + 0.1 * ((h - 5) / 2);
  return 0.3;
}

// ------------------------------------------------------------------------------------------------ substituto na GPU

const POSTE_VERTICE = /* glsl */ `
attribute vec3 aPoste;
attribute vec3 aCor;
uniform vec4 uMapa; // origem x, origem z, 1 / lado
varying vec2 vQ;
varying vec3 vCor;
void main() {
  vQ = position.xy * 3.0;
  vCor = aCor;
  vec2 xz = aPoste.xy + position.xy * aPoste.z * 3.0;
  vec2 uv = ( xz - uMapa.xy ) * uMapa.z;
  gl_Position = vec4( uv * 2.0 - 1.0, 0.0, 1.0 );
}
`;

const POSTE_FRAGMENTO = /* glsl */ `
uniform float uGanho;
varying vec2 vQ;
varying vec3 vCor;
void main() {
  gl_FragColor = vec4( vCor * ( exp( - 0.5 * dot( vQ, vQ ) ) / uGanho ), 1.0 );
}
`;

/** Ganho do mapa: 1 na textura vale esta irradiância (o RGBA8 satura em 1 onde as poças se somam). */
export const GANHO_RUA = 2.2;

class MapaSubstituto {
  constructor(ctx) {
    this.ctx = ctx;
    const tam = ctx.sim?.espelho?.mapa?.tam ?? 8192;
    this.origem = ctx.sim?.espelho?.mapa?.origem ?? [-tam / 2, -tam / 2];
    this.tam = tam;
    this.N = 1024;
    this.alvo = new THREE.WebGLRenderTarget(this.N, this.N, { type: THREE.UnsignedByteType, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.alvo.texture.name = 'noite:luzRua';
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      name: 'noite-postes',
      uniforms: { uMapa: { value: new THREE.Vector4(this.origem[0], this.origem[1], 1 / tam, 0) }, uGanho: { value: GANHO_RUA } },
      vertexShader: POSTE_VERTICE,
      fragmentShader: POSTE_FRAGMENTO,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.malha = new THREE.Mesh(g, this.mat);
    this.malha.frustumCulled = false;
    this.cena = new THREE.Scene();
    this.cena.add(this.malha);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postes = 0;
    this.sujo = true;
    this.vezes = 0; // desenhos feitos (a luz no chão refaz quando muda)
  }

  /** Refaz o mapa com os postes das vias do espelho (uma chamada). */
  desenhar(renderer, medidas) {
    const A = this.ctx.sim?.espelho?.vias?.arestas;
    const p = postesDasVias(A);
    const n = p.length / 6;
    this.postes = n;
    const pos = new Float32Array(n * 3);
    const cor = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([p[6 * i], p[6 * i + 1], p[6 * i + 2]], 3 * i);
      cor.set([p[6 * i + 3], p[6 * i + 4], p[6 * i + 5]], 3 * i);
    }
    // os atributos trocam a cada desenho: solta os buffers velhos na GPU antes (o quadrado volta a subir, 48 bytes)
    if (this.geo.getAttribute('aPoste')) this.geo.dispose();
    this.geo.setAttribute('aPoste', new THREE.InstancedBufferAttribute(pos, 3));
    this.geo.setAttribute('aCor', new THREE.InstancedBufferAttribute(cor, 3));
    this.geo.instanceCount = n;
    const antes = renderer.getRenderTarget();
    const limpa = renderer.autoClear;
    const cc = renderer.getClearColor(new THREE.Color());
    const ca = renderer.getClearAlpha();
    renderer.setRenderTarget(this.alvo);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    renderer.autoClear = false;
    const fazer = () => n && renderer.render(this.cena, this.cam);
    if (medidas) medidas.passe(fazer);
    else fazer();
    renderer.autoClear = limpa;
    renderer.setClearColor(cc, ca);
    renderer.setRenderTarget(antes);
    this.sujo = false;
    this.vezes++;
  }

  descartar() {
    this.alvo.dispose();
    this.geo.dispose();
    this.mat.dispose();
  }
}

// ------------------------------------------------------------------------------------------------ domínio

const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Força da noite pela elevação do sol (rad): os postes acendem com o sol a ~3 graus e ficam cheios a ~3 abaixo. */
export const forcaNoite = (elevacao) => 1 - suave(-0.06, 0.05, elevacao);

/**
 * Números da noite: altura da lâmpada e queda da luz das janelas com a altura (m), cor e força da luz das janelas na
 * rua e a escala da luz da rua (vale para o mapa da R3a e para o substituto): com 0,5 o asfalto sob o poste fica perto
 * de 0,4 na tela e a calçada perto de 0,65 na exposição mínima da noite (14), laranja sem estourar em branco.
 */
export const NOITE_LUZ = Object.freeze({ alturaRua: 9, alturaJanelas: 9, janelas: [1.0, 0.7, 0.42], forcaJanelas: 0.35, rua: 0.5 });

// ------------------------------------------------------------------------------------------------ luz no chão

/**
 * A luz que chega ao chão (o mapa suavizado): cada poste do mapa é uma poça estreita (gaussiana de 6 a 7 m), mas a
 * luz de uma lâmpada a 9 m de altura cai com o cosseno ao cubo e tem cauda longa (meia força a 7 m, 14% a 15 m), e as
 * poças de postes a 30 m se emendam na rua inteira. Uma suavização separável (11 amostras a 4 m, desvio de 7 m) leva o
 * mapa da R3a (ou o substituto) a uma textura de 1.024² (8 m) que o gancho lê: de perto ainda se vê poste a poste, de
 * longe a rua vira uma linha de luz contínua, sem o colar de contas. Refeita só quando o mapa muda (duas chamadas).
 */
export const SUAVE = Object.freeze({ lado: 1024, amostras: 11, passo: 4, desvio: 7, ganho: 2 });

/** Pesos da suavização (normalizados), os mesmos do GLSL. */
export function pesosSuaves(S = SUAVE) {
  const m = (S.amostras - 1) / 2;
  const w = Array.from({ length: S.amostras }, (_, k) => Math.exp(-0.5 * (((k - m) * S.passo) / S.desvio) ** 2));
  const t = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / t);
}

const SUAVE_FRAGMENTO = /* glsl */ `
uniform sampler2D uFonte;
uniform vec2 uPasso;   // passo das amostras em uv da fonte
uniform float uGanho;  // da fonte para a saída
const float PESOS[ ${SUAVE.amostras} ] = float[]( ${pesosSuaves().map((x) => x.toFixed(6)).join(', ')} );
void main() {
  vec2 uv = gl_FragCoord.xy / ${SUAVE.lado}.0;
  vec3 s = vec3( 0.0 );
  for ( int k = 0; k < ${SUAVE.amostras}; k ++ ) s += texture( uFonte, uv + uPasso * float( k - ${(SUAVE.amostras - 1) / 2} ) ).rgb * PESOS[ k ];
  gl_FragColor = vec4( s * uGanho, 1.0 );
}
`;

class Suavizar {
  constructor() {
    const op = { type: THREE.UnsignedByteType, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.a = new THREE.WebGLRenderTarget(SUAVE.lado, SUAVE.lado, op);
    this.b = new THREE.WebGLRenderTarget(SUAVE.lado, SUAVE.lado, op);
    this.a.texture.name = 'noite:luzChaoMeia';
    this.b.texture.name = 'noite:luzChao';
    this.mat = new THREE.ShaderMaterial({
      name: 'noite-suave',
      uniforms: { uFonte: { value: null }, uPasso: { value: new THREE.Vector2() }, uGanho: { value: 1 } },
      vertexShader: 'void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }',
      fragmentShader: SUAVE_FRAGMENTO,
      depthTest: false,
      depthWrite: false,
    });
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const m = new THREE.Mesh(this.geo, this.mat);
    m.frustumCulled = false;
    this.cena = new THREE.Scene();
    this.cena.add(m);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.versao = null; // versão da fonte já suavizada
    this.vezes = 0;
  }

  get textura() {
    return this.b.texture;
  }

  /** Suaviza a fonte { textura, tam, ganho }: horizontal para a, vertical para b (as duas chamadas contam em R.stats). */
  refazer(renderer, medidas, fonte) {
    const U = this.mat.uniforms;
    const du = SUAVE.passo / fonte.tam;
    const passe = (alvo, tex, dx, dy, ganho) => {
      U.uFonte.value = tex;
      U.uPasso.value.set(dx, dy);
      U.uGanho.value = ganho;
      renderer.setRenderTarget(alvo);
      const fazer = () => renderer.render(this.cena, this.cam);
      if (medidas) medidas.passe(fazer);
      else fazer();
    };
    const antes = renderer.getRenderTarget();
    const limpa = renderer.autoClear;
    renderer.autoClear = false;
    passe(this.a, fonte.textura, du, 0, fonte.ganho / SUAVE.ganho);
    passe(this.b, this.a.texture, 0, du, 1);
    renderer.autoClear = limpa;
    renderer.setRenderTarget(antes);
    this.versao = fonte.versao;
    this.vezes++;
  }

  descartar() {
    this.a.dispose();
    this.b.dispose();
    this.mat.dispose();
    this.geo.dispose();
  }
}

// ------------------------------------------------------------------------------------------------ domínio

/** A fonte da luz no chão a partir do mapa publicado pela R3a (ctx.luzRua). */
const daR3a = (real) => ({
  textura: real.textura, origem: real.origem ?? [-4096, -4096], tam: real.tam ?? 8192, ganho: real.ganho ?? GANHO_RUA, versao: `r${real.versao ?? 0}`,
});

function criarDominio(ctx) {
  const u = ctx.ganchos.uniformes;
  let subst = null;
  let suave = null;
  let fonte = null; // { textura, origem, tam, ganho, versao } do mapa em uso
  let ultimoSubst = -Infinity;
  let ultimoSuave = -Infinity;
  let brilho = null;
  let forca = 0;
  // entre os passes do quadro (contam em R.stats), só com a noite chegando: o substituto quando as vias mudam (no
  // máximo a cada 2 s) e a luz no chão quando o mapa muda (no máximo a cada 1 s)
  const passe = (renderer, medidas, tMs) => {
    if (forca <= 0) return;
    if (subst?.sujo && fonte?.textura === subst.alvo.texture && tMs - ultimoSubst >= 2000) {
      ultimoSubst = tMs;
      subst.desenhar(renderer, medidas);
      brilho = brilhoDosPostes(subst.postes);
      fonte.versao = `s${subst.vezes}`;
    }
    if (fonte && suave && suave.versao !== fonte.versao && tMs - ultimoSuave >= 1000) {
      ultimoSuave = tMs;
      suave.refazer(renderer, medidas, fonte);
    }
  };
  ctx.quadro?.antes?.add(passe);
  // a suavização só desenha com a noite chegando: o programa dela compila na carga (aquecimento, D66), não na primeira
  // noite do jogo
  const aquecer = () => suave?.cena;
  ctx.quadro?.aquecer?.add(aquecer);
  return {
    nome: 'luzNoite',
    aplicar(d) {
      if (subst && (d.tudo?.vias || d.arestas?.length)) subst.sujo = true;
    },
    quadro(tMs, c) {
      const amb = c.ambiente;
      forca = forcaNoite(amb?.ast?.sol?.elevacao ?? 1);
      u.gNoiteParams.value.set(forca, NOITE_LUZ.alturaRua, NOITE_LUZ.alturaJanelas, 0);
      const fj = forcaJanelas(amb?.hora ?? 12) * NOITE_LUZ.forcaJanelas;
      u.gNoiteJanelas.value.set(NOITE_LUZ.janelas[0] * fj, NOITE_LUZ.janelas[1] * fj, NOITE_LUZ.janelas[2] * fj);
      // o mapa de luz da rua: o da R3a, se publicado (ela publica depois do primeiro desenho: com o domínio dela
      // registrado, espera sem substituto); sem a R3a, o substituto
      const real = c.luzRua;
      if (real?.textura) {
        // um objeto novo só quando o mapa muda (não um por quadro)
        if (fonte?.textura !== real.textura || fonte.versao !== `r${real.versao ?? 0}`) fonte = daR3a(real);
        if (Number.isFinite(real.brilho)) brilho = real.brilho;
        if (subst) {
          subst.descartar();
          subst = null;
        }
      } else if (c.dominio?.('luzRua')) {
        fonte = null;
      } else {
        subst ??= new MapaSubstituto(c);
        const v = `s${subst.vezes}`;
        if (fonte?.textura !== subst.alvo.texture || fonte.versao !== v) fonte = { textura: subst.alvo.texture, origem: subst.origem, tam: subst.tam, ganho: GANHO_RUA, versao: v };
      }
      suave ??= new Suavizar();
      u.gLuzRuaMapa.value = suave.textura;
      if (fonte) u.gLuzRuaParams.value.set(fonte.origem[0], fonte.origem[1], 1 / fonte.tam, SUAVE.ganho * NOITE_LUZ.rua);
      else u.gLuzRuaParams.value.w = 0;
      if (amb && Number.isFinite(brilho) && Math.abs(amb.brilhoCidade - brilho) > 0.02) amb.brilhoCidade = brilho;
    },
    /** Desenha o substituto e a luz no chão agora (cenas e capturas). */
    preparar() {
      const real = ctx.luzRua;
      if (real?.textura) fonte = daR3a(real);
      else if (!ctx.dominio?.('luzRua')) {
        subst ??= new MapaSubstituto(ctx);
        subst.desenhar(ctx.renderer, null);
        brilho = brilhoDosPostes(subst.postes);
        if (ctx.ambiente) ctx.ambiente.brilhoCidade = brilho;
        fonte = { textura: subst.alvo.texture, origem: subst.origem, tam: subst.tam, ganho: GANHO_RUA, versao: `s${subst.vezes}` };
      }
      suave ??= new Suavizar();
      if (fonte) suave.refazer(ctx.renderer, null, fonte);
      return { postes: subst?.postes ?? null, brilho };
    },
    get postes() {
      return subst?.postes ?? 0;
    },
    /** Estado para as cenas e os testes: fonte do mapa e quantas vezes a luz no chão foi refeita. */
    get estado() {
      return { fonte: fonte ? (fonte.textura === subst?.alvo.texture ? 'substituto' : 'R3a') : null, versao: fonte?.versao ?? null, suavizacoes: suave?.vezes ?? 0 };
    },
    descartar() {
      ctx.quadro?.antes?.delete(passe);
      ctx.quadro?.aquecer?.delete(aquecer);
      subst?.descartar();
      subst = null;
      suave?.descartar();
      suave = null;
    },
  };
}

export function registrar(api) {
  api.registrarDominio('luzNoite', criarDominio);
}
