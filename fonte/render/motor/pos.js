// Pós (desenho do render 1.4, 2.3, 2.7 e 2.8): a cena é desenhada num alvo HDR com MSAA (R11F_G11F_B10F quando o
// aparelho aceita, senão meia precisão; profundidade de 32 bits em ponto flutuante com a profundidade invertida),
// e a composição leva à tela com bloom por redução dupla a 1/4 (4 níveis no Média, 5 no PC), exposição, AgX, CAS
// sempre que o desenho interno é menor que a tela (forcaCas: a ampliação pelo teto de pixels do 'pc' numa tela de 4K
// ou pela resolução dinâmica; o filtro num espaço perceptivo, composicaoPerceptiva), vinheta leve e pontilhado. O
// Leve desenha direto na tela com o AgX do three (sem pós). Reaproveita a ideia do motor do jogo antigo
// (antigo/fonte/render/engine.js), sem PBR Neutral fixo, sem tintas de sombra e realce, com saturação 1,0.
import * as THREE from 'three';
import { TELA_VERTICE, PREFILTRO, REDUZ, AMPLIA, COMPOSICAO } from '../materiais/shaders/pos.glsl.js';

/**
 * O "look" do AgX (contraste pela curva e saturação em volta da luma; 1 e 1 é o AgX puro): o AgX puro tem o pé longo
 * e deixa a cidade cinza e lavada; a potência de 1,45 devolve o preto da sombra e do asfalto (como o Punchy do
 * Blender), com a saturação quase neutra (1,05). Vale na composição e, no Leve (sem pós), no AgX do próprio three
 * (motor/renderizador.js): os perfis mostram a mesma curva.
 */
export const LOOK = Object.freeze({ potencia: 1.45, saturacao: 1.05 });

/**
 * Nitidez do CAS pela ampliação da tela (PC2): pixels da tela por pixel interno, em cada eixo (o dpr sobre a razão de
 * pixels do desenho). Desligado até 2% de ampliação; sobe na medida dela até 0,85 com o dobro (o CAS limita o reforço
 * onde já há contraste, e o MSAA segura a borda: sem serrilhado nem halo). No PC do dono (tela de 4K a 2,5 de
 * escala, desenho de 2070 x 1001) a ampliação é de 1,85 e o CAS vai a ~0,72.
 * @example forcaCas(3840 / 2070) // ~0.72
 */
export function forcaCas(ampliacao) {
  if (!(ampliacao > 1.02)) return 0;
  return Math.min(0.85, 0.25 + 0.55 * (ampliacao - 1));
}

/**
 * Troca um trecho do GLSL sem depender do espaço: a montagem enxuga os templates marcados como GLSL (tira a indentação
 * e o espaço em volta de ( ) , ; { } =), então o trecho vira uma expressão com \s* entre as palavras. Erro se sumiu.
 */
function trocar(src, trecho, novo) {
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const partes = trecho.trim().split(/\s+/).map((t) => t.split(/([(),;{}=])/).filter(Boolean).map(esc).join('\\s*'));
  const re = new RegExp(partes.join('\\s*'));
  if (!re.test(src)) throw new Error(`pos: trecho da CAS não encontrado: ${trecho.trim().slice(0, 60)}`);
  return src.replace(re, () => novo);
}

/**
 * A composição com a CAS num espaço perceptivo (PC2). A de pos.glsl.js filtra o HDR linear: a janela acesa (10) ao
 * lado da fachada escura (0,05) empurrava o vizinho abaixo de zero, e a CAS sempre ligada desenhava um anel preto em
 * volta de cada luz da cidade à noite. Aqui os 5 texels passam por Reinhard pelo maior canal (com a exposição, tudo em
 * [0, 1)) e pela raiz (perto do sRGB, o domínio para o qual a CAS da AMD foi feita), o filtro roda por canal e a
 * conta volta ao HDR (a volta é exata onde o filtro não mexe). Só o trecho da CAS muda; o integrador pode levar esta
 * versão para pos.glsl.js (da R1a, fora desta parcela).
 */
export function composicaoPerceptiva(fonte) {
  let f = trocar(
    fonte,
    'void main() { vec3 cor = texture( tCena, vUv ).rgb;',
    `// CAS num espaço perceptivo (motor/pos.js): Reinhard pelo maior canal com a exposição e a raiz; casDe desfaz
vec3 casPara( vec3 c ) { vec3 e = max( c, vec3( 0.0 ) ) * uExposicao; return sqrt( e / ( 1.0 + max( e.r, max( e.g, e.b ) ) ) ); }
vec3 casDe( vec3 p ) { vec3 t = p * p; float m = min( max( t.r, max( t.g, t.b ) ), 0.999 ); return t / ( ( 1.0 - m ) * uExposicao ); }
void main() {
  vec3 cor = texture( tCena, vUv ).rgb;`,
  );
  f = trocar(
    f,
    `float c0 = comprime( cor ), c1 = comprime( n ), c2 = comprime( sl ), c3 = comprime( l ), c4 = comprime( r );
    float mn = min( c0, min( min( c1, c2 ), min( c3, c4 ) ) );
    float mx = max( c0, max( max( c1, c2 ), max( c3, c4 ) ) );
    float amp = sqrt( clamp( min( mn, 1.0 - mx ) / max( mx, 1e-4 ), 0.0, 1.0 ) );
    float w = - amp / mix( 8.0, 5.0, uCas );
    cor = max( ( cor + w * ( n + sl + l + r ) ) / ( 1.0 + 4.0 * w ), vec3( 0.0 ) );`,
    `vec3 p0 = casPara( cor ), p1 = casPara( n ), p2 = casPara( sl ), p3 = casPara( l ), p4 = casPara( r );
    vec3 mn = min( p0, min( min( p1, p2 ), min( p3, p4 ) ) );
    vec3 mx = max( p0, max( max( p1, p2 ), max( p3, p4 ) ) );
    vec3 amp = sqrt( clamp( min( mn, 1.0 - mx ) / max( mx, vec3( 1e-4 ) ), 0.0, 1.0 ) );
    vec3 w = - amp / mix( 8.0, 5.0, uCas );
    cor = casDe( clamp( ( p0 + w * ( p1 + p2 + p3 + p4 ) ) / ( 1.0 + 4.0 * w ), 0.0, 1.0 ) );`,
  );
  return f;
}
const COMPOSICAO_CAS = composicaoPerceptiva(COMPOSICAO);

function materialTela(nome, frag, uniforms, blending = THREE.NoBlending) {
  return new THREE.ShaderMaterial({
    name: nome,
    vertexShader: TELA_VERTICE, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, blending,
    transparent: blending !== THREE.NoBlending, toneMapped: false,
  });
}

/** R11F_G11F_B10F com MSAA e sem, se o aparelho desenhar nele (4 bytes por pixel); senão meia precisão. */
export function formatoHdr(renderer, amostras) {
  const gl = renderer.getContext();
  if (!renderer.extensions.has('EXT_color_buffer_float') || typeof gl.getInternalformatParameter !== 'function') return null;
  try {
    const s = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.R11F_G11F_B10F, gl.SAMPLES);
    const max = s && s.length ? Math.max(...s) : 0;
    if (amostras > 0 && max < amostras) return null;
    let ok = true;
    for (const n of amostras > 0 ? [amostras, 0] : [0]) {
      const rt = new THREE.WebGLRenderTarget(8, 8, { format: THREE.RGBFormat, type: THREE.UnsignedInt101111Type, samples: n, depthBuffer: n > 0, generateMipmaps: false });
      const antes = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.clear();
      ok = ok && gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE && gl.getError() === gl.NO_ERROR;
      renderer.setRenderTarget(antes);
      rt.dispose();
    }
    return ok ? { format: THREE.RGBFormat, type: THREE.UnsignedInt101111Type } : null;
  } catch (e) {
    return null;
  }
}

export class Pos {
  /** @param {object} ctx  contexto do render (renderer, capac, perfil) */
  constructor(ctx) {
    this.ctx = ctx;
    const r = ctx.renderer;
    this.hdr = !!(r.extensions.has('EXT_color_buffer_float') || r.extensions.has('EXT_color_buffer_half_float'));
    this.cena = new THREE.Scene();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.malha = new THREE.Mesh(g, null);
    this.malha.frustumCulled = false;
    this.cena.add(this.malha);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mPre = materialTela('pos-prefiltro', PREFILTRO, { tMapa: { value: null }, uTexel: { value: new THREE.Vector2() }, uLimiar: { value: 1.1 }, uJoelho: { value: 0.5 }, uExposicao: { value: 1 } });
    this.mReduz = materialTela('pos-reduz', REDUZ, { tMapa: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mAmplia = materialTela('pos-amplia', AMPLIA, { tMapa: { value: null }, uTexel: { value: new THREE.Vector2() }, uPeso: { value: 1 } }, THREE.AdditiveBlending);
    this.mComp = materialTela('pos-composicao', COMPOSICAO_CAS, {
      tCena: { value: null }, tBloom: { value: null }, uTexel: { value: new THREE.Vector2() }, uBloom: { value: 0.05 },
      uExposicao: { value: 1 }, uPotencia: { value: LOOK.potencia }, uSaturacao: { value: LOOK.saturacao }, uCas: { value: 0 }, uVinheta: { value: 0.12 }, uAspecto: { value: 1.7 }, uTempo: { value: 0 },
      uEsmaecer: { value: 0 }, uCorEsmaecer: { value: new THREE.Vector3(0.02, 0.03, 0.05) },
    });
    this.alvo = null;
    this.bloom = [];
    this.w = 0;
    this.h = 0;
    this.amostras = 0;
    this.forcaBloom = 0.05;
    this.look = { ...LOOK }; // o modo foto pode trocar
    this.esmaecer = 0;
    this.passes = 0;
  }

  /** O perfil desenha com pós? (Leve: não). */
  get ligado() {
    return this.hdr && (this.ctx.perfil.pos ?? true);
  }

  /** Cria ou refaz os alvos para o tamanho em pixels de desenho e o perfil. */
  garantir(W, H) {
    const p = this.ctx.perfil;
    const amostras = Math.min(p.msaa ?? 0, this.ctx.capac?.limites?.amostras || 4);
    const niveis = p.bloom ?? 4;
    const inv = !!this.ctx.renderer.state?.buffers?.depth?.getReversed?.();
    if (this.alvo && W === this.w && H === this.h && amostras === this.amostras && niveis === this._niveis && inv === this._inv) return;
    this.descartarAlvos();
    this.w = W;
    this.h = H;
    this.amostras = amostras;
    this._niveis = niveis;
    this._inv = inv;
    if (this._fmt === undefined || this._fmtAmostras !== amostras) {
      this._fmt = formatoHdr(this.ctx.renderer, amostras);
      this._fmtAmostras = amostras;
    }
    const fmt = this._fmt ?? { type: THREE.HalfFloatType };
    const op = { ...fmt, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false };
    // profundidade só para o teste (nenhum passe a lê): não é resolvida; com a invertida, 32 bits em ponto flutuante
    const prof = inv ? new THREE.DepthTexture(W, H, THREE.FloatType) : null;
    this.alvo = new THREE.WebGLRenderTarget(W, H, { ...op, depthBuffer: true, samples: amostras, resolveDepthBuffer: false, depthTexture: prof });
    this.alvo.texture.name = 'pos.cena';
    this.formato = this._fmt ? 'r11g11b10' : 'rgba16f';
    this.bloom = [];
    let bw = W >> 2;
    let bh = H >> 2;
    for (let i = 0; i < niveis && bw >= 2 && bh >= 2; i++) {
      this.bloom.push(new THREE.WebGLRenderTarget(bw, bh, op));
      bw >>= 1;
      bh >>= 1;
    }
  }

  _passe(mat, alvo) {
    this.malha.material = mat;
    const r = this.ctx.renderer;
    r.setRenderTarget(alvo ?? null);
    r.render(this.cena, this.cam);
    this.passes++;
  }

  /**
   * Compõe a cena do alvo HDR na tela: bloom, exposição, AgX, CAS e pontilhado.
   * @param {{ exposicao: number, limiarBloom: number, cas: number, tMs: number }} op
   */
  compor({ exposicao = 1, limiarBloom = 1.1, cas = 0, tMs = 0 } = {}) {
    const r = this.ctx.renderer;
    const autoLimpa = r.autoClear;
    r.autoClear = true;
    this.passes = 0;
    const W = this.w;
    const H = this.h;
    const B = this.bloom;
    const U = this.mComp.uniforms;
    if (B.length) {
      const pre = this.mPre.uniforms;
      pre.tMapa.value = this.alvo.texture;
      pre.uTexel.value.set(1 / W, 1 / H);
      pre.uLimiar.value = limiarBloom;
      pre.uExposicao.value = exposicao;
      this._passe(this.mPre, B[0]);
      for (let i = 1; i < B.length; i++) {
        this.mReduz.uniforms.tMapa.value = B[i - 1].texture;
        this.mReduz.uniforms.uTexel.value.set(1 / B[i - 1].width, 1 / B[i - 1].height);
        this._passe(this.mReduz, B[i]);
      }
      r.autoClear = false;
      for (let i = B.length - 2; i >= 0; i--) {
        const s = B[i + 1];
        this.mAmplia.uniforms.tMapa.value = s.texture;
        this.mAmplia.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
        this._passe(this.mAmplia, B[i]);
      }
      r.autoClear = true;
      U.tBloom.value = B[0].texture;
      U.uBloom.value = this.forcaBloom;
    } else {
      U.tBloom.value = this.alvo.texture;
      U.uBloom.value = 0;
    }
    U.tCena.value = this.alvo.texture;
    U.uTexel.value.set(1 / W, 1 / H);
    U.uExposicao.value = exposicao;
    U.uPotencia.value = this.look.potencia;
    U.uSaturacao.value = this.look.saturacao;
    U.uCas.value = cas;
    U.uAspecto.value = W / Math.max(1, H);
    U.uTempo.value = tMs / 1000;
    U.uVinheta.value = this.ctx.perfil.vinheta ?? 0.12;
    U.uEsmaecer.value = this.esmaecer;
    this._passe(this.mComp, null);
    r.autoClear = autoLimpa;
    return this.passes;
  }

  /** Memória dos alvos (MB), para R.stats.memoria. */
  get memoriaMB() {
    if (!this.alvo) return 0;
    const bpp = this.formato === 'r11g11b10' ? 4 : 8;
    let b = this.w * this.h * (bpp * Math.max(1, this.amostras) + bpp + 4 * Math.max(1, this.amostras));
    for (const t of this.bloom) b += t.width * t.height * bpp;
    return b / 1048576;
  }

  descartarAlvos() {
    this.alvo?.dispose();
    this.alvo = null;
    for (const t of this.bloom) t.dispose();
    this.bloom = [];
  }

  descartar() {
    this.descartarAlvos();
    for (const m of [this.mPre, this.mReduz, this.mAmplia, this.mComp]) m.dispose();
    this.malha.geometry.dispose();
  }
}

export function registrar() {}
