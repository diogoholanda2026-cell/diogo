// Motor de renderização: WebGL2, alvo HDR com MSAA, bloom a 1/4, profundidade de campo com autofoco
// (efeito de maquete, só de perto), gradação em linear de cena com PBR Neutral, oclusão por campo de
// alturas, sombras macias, resolução dinâmica em degraus e limite de quadros por estado.
import * as THREE from 'three';
import { HAO, haoCfg } from './hao.js';

// Perfis de qualidade. "alta" é o padrão para celulares intermediários (ex.: Mali-G615 MC2);
// a resolução se ajusta sozinha, em degraus, entre prMin e prMax para manter a taxa de quadros.
export const QUALITY = {
  ultra: { id: 'ultra', label: 'Ultra', prMax: 2.0, prMin: 1.3, msaa: 4, shadow: 2048, radius: 3.2, taps: 8, bloom: true, dof: true, grade: true, treeShadow: true, life: 1.0 },
  alta: { id: 'alta', label: 'Alta', prMax: 1.6, prMin: 1.0, msaa: 4, shadow: 2048, radius: 2.6, taps: 8, bloom: true, dof: true, grade: true, treeShadow: false, life: 1.0 },
  media: { id: 'media', label: 'Média', prMax: 1.3, prMin: 0.85, msaa: 2, shadow: 1024, radius: 1.8, taps: 5, bloom: true, dof: false, grade: true, treeShadow: false, life: 0.7 },
  leve: { id: 'leve', label: 'Leve', prMax: 1.0, prMin: 0.7, msaa: 0, shadow: 1024, radius: 1.2, taps: 5, bloom: false, dof: false, grade: false, treeShadow: false, life: 0.45 },
};
// degraus de resolução (a troca realoca os alvos, então só em passos fixos e com histerese)
const PR_STEPS = [0.7, 0.85, 1, 1.15, 1.3, 1.45, 1.6, 1.8, 2];
// Sugere um perfil pelo processador gráfico informado pelo navegador.
export function guessQuality(renderer) {
  let gpu = '';
  try { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch (_) {}
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  if (/SwiftShader|llvmpipe|Software/i.test(gpu)) return { id: 'media', gpu };
  if (!mobile) return { id: 'ultra', gpu };
  if (/Mali-G(7[1-9]|9|6[1-9]\d)|Immortalis|Adreno \(TM\) (7[3-9]\d|8\d\d)|Apple/i.test(gpu)) return { id: 'alta', gpu };
  if (/Mali-G(5|6)|Adreno \(TM\) (6[4-9]\d|7[0-2]\d)/i.test(gpu)) return { id: 'alta', gpu };
  return { id: 'media', gpu };
}

// PCF do r186 com 5 amostras de Vogel giradas por pixel de TELA: com a sombra parada, o grão
// desliza durante o arrasto. Aqui o giro fica preso ao texel do mapa (estável) e, em alta/ultra,
// são 8 amostras (penumbra larga sem granulado).
const PCF_ORIG = THREE.ShaderChunk.shadowmap_pars_fragment;
const PCF_FASE = 'float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;';
const PCF5_RE = /shadow = \(\s*texture\( shadowMap, vec3\( shadowCoord\.xy \+ vogelDiskSample\( 0, 5, phi \)[\s\S]*?\) \* 0\.2;/;
const PCF_BASE = PCF_ORIG.replace(PCF_FASE, 'float phi = interleavedGradientNoise( shadowCoord.xy * shadowMapSize ) * PI2;');
const PCF = {
  5: PCF_BASE,
  8: PCF_BASE.replace(PCF5_RE, 'float sAcc = 0.0;\n\t\t\t\tfor ( int i = 0; i < 8; i ++ ) sAcc += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, 8, phi ) * radius, shadowCoord.z ) );\n\t\t\t\tshadow = sAcc * 0.125;'),
};
if (!PCF5_RE.test(PCF_ORIG) || !PCF_ORIG.includes(PCF_FASE)) console.warn('sombra: trecho do PCF do three mudou; mantendo o original');

// Descarte por caixa: malhas largas e baixas (o fundido por quadrante) marcadas com userData.cullCaixa
// (Box3 em mundo) passam por um teste de caixa, bem mais justo que a esfera, na câmera e na sombra.
const _intObj = THREE.Frustum.prototype.intersectsObject;
THREE.Frustum.prototype.intersectsObject = function (o) { const b = o.userData.cullCaixa; return b ? this.intersectsBox(b) : _intObj.call(this, o); };

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// prefiltro direto para 1/4: 13 amostras (padrão de Jimenez) com média de Karis por grupo
const PREFILTER = /* glsl */`
  uniform sampler2D tMap; uniform vec2 texel; uniform float threshold; uniform float knee;
  varying vec2 vUv;
  float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  vec3 s(float x, float y) { return texture2D(tMap, vUv + texel * vec2(x, y)).rgb; }
  vec3 grp(vec3 a, vec3 b, vec3 c, vec3 d) { float wa = 1.0 / (1.0 + lum(a)), wb = 1.0 / (1.0 + lum(b)), wc = 1.0 / (1.0 + lum(c)), wd = 1.0 / (1.0 + lum(d)); return (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd); }
  void main() {
    vec3 A = s(-4.0, -4.0), B = s(0.0, -4.0), C = s(4.0, -4.0), D = s(-4.0, 0.0), E = s(0.0, 0.0), F = s(4.0, 0.0), G = s(-4.0, 4.0), H = s(0.0, 4.0), I = s(4.0, 4.0);
    vec3 J = s(-2.0, -2.0), K = s(2.0, -2.0), L = s(-2.0, 2.0), M = s(2.0, 2.0);
    vec3 col = grp(J, K, L, M) * 0.5 + (grp(A, B, D, E) + grp(B, C, E, F) + grp(D, E, G, H) + grp(E, F, H, I)) * 0.125;
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    float contrib = max(soft, br - threshold) / max(br, 1e-4);
    gl_FragColor = vec4(col * contrib, 1.0);
  }`;

const DOWN = /* glsl */`
  uniform sampler2D tMap; uniform vec2 texel; varying vec2 vUv;
  void main() {
    vec3 a = texture2D(tMap, vUv + texel * vec2(-2.0, -2.0)).rgb;
    vec3 b = texture2D(tMap, vUv + texel * vec2( 0.0, -2.0)).rgb;
    vec3 c = texture2D(tMap, vUv + texel * vec2( 2.0, -2.0)).rgb;
    vec3 d = texture2D(tMap, vUv + texel * vec2(-2.0,  0.0)).rgb;
    vec3 e = texture2D(tMap, vUv).rgb;
    vec3 f = texture2D(tMap, vUv + texel * vec2( 2.0,  0.0)).rgb;
    vec3 g = texture2D(tMap, vUv + texel * vec2(-2.0,  2.0)).rgb;
    vec3 h = texture2D(tMap, vUv + texel * vec2( 0.0,  2.0)).rgb;
    vec3 i = texture2D(tMap, vUv + texel * vec2( 2.0,  2.0)).rgb;
    vec3 j = texture2D(tMap, vUv + texel * vec2(-1.0, -1.0)).rgb;
    vec3 k = texture2D(tMap, vUv + texel * vec2( 1.0, -1.0)).rgb;
    vec3 l = texture2D(tMap, vUv + texel * vec2(-1.0,  1.0)).rgb;
    vec3 m = texture2D(tMap, vUv + texel * vec2( 1.0,  1.0)).rgb;
    vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
    gl_FragColor = vec4(col, 1.0);
  }`;

// ampliação em tenda 3x3 = 4 leituras bilineares a meio texel
const UP = /* glsl */`
  uniform sampler2D tMap; uniform vec2 texel; varying vec2 vUv;
  void main() {
    vec2 o = texel * 0.5;
    vec3 col = texture2D(tMap, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tMap, vUv + vec2(o.x, -o.y)).rgb + texture2D(tMap, vUv + vec2(-o.x, o.y)).rgb + texture2D(tMap, vUv + vec2(o.x, o.y)).rgb;
    gl_FragColor = vec4(col * 0.25, 1.0);
  }`;

const BLUR = /* glsl */`
  uniform sampler2D tMap; uniform vec2 dir; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tMap, vUv).rgb * 0.2270270270;
    c += texture2D(tMap, vUv + dir * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tMap, vUv - dir * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tMap, vUv + dir * 3.2307692308).rgb * 0.0702702703;
    c += texture2D(tMap, vUv - dir * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(c, 1.0);
  }`;

const COPY = /* glsl */`
  uniform sampler2D tMap; uniform vec2 texel; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tMap, vUv + texel * vec2(-0.5, -0.5)).rgb + texture2D(tMap, vUv + texel * vec2(0.5, -0.5)).rgb
           + texture2D(tMap, vUv + texel * vec2(-0.5, 0.5)).rgb + texture2D(tMap, vUv + texel * vec2(0.5, 0.5)).rgb;
    gl_FragColor = vec4(c * 0.25, 1.0);
  }`;

// autofoco na GPU: menor distância válida em 5 pontos perto do centro, suavizada (tau 250 ms)
const FOCO = /* glsl */`
  uniform sampler2D tDepth; uniform sampler2D tPrev; uniform float near; uniform float far; uniform float k; uniform float reserva;
  varying vec2 vUv;
  float vd(vec2 p) { float z = texture2D(tDepth, p).x; return (near * far) / (far - z * (far - near)); }
  void main() {
    float lim = far * 0.95; float d = 1e9; float a;
    a = vd(vec2(0.5, 0.5)); if (a < lim) d = min(d, a);
    a = vd(vec2(0.44, 0.5)); if (a < lim) d = min(d, a);
    a = vd(vec2(0.56, 0.5)); if (a < lim) d = min(d, a);
    a = vd(vec2(0.5, 0.44)); if (a < lim) d = min(d, a);
    a = vd(vec2(0.5, 0.56)); if (a < lim) d = min(d, a);
    if (d > 1e8) d = reserva;
    float p = texture2D(tPrev, vec2(0.5)).r; if (p <= 0.0) p = d;
    gl_FragColor = vec4(mix(p, d, k), 0.0, 0.0, 1.0);
  }`;

// Composição: DOF, bloom, gradação em linear de cena (exposição e balanço de branco, vinheta HDR,
// contraste em log com pivô 0,18, saturação que preserva a luminância), PBR Neutral e só então o
// split-tone, sRGB e pontilhado.
const COMPOSITE = /* glsl */`
  uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tBloom1; uniform sampler2D tBlur1; uniform sampler2D tDepth; uniform sampler2D tFocus;
  uniform float useBloom; uniform float useBloom1; uniform float useDof; uniform float useAF; uniform float useGrade; uniform float bloomStrength; uniform float exposure;
  uniform float near; uniform float far; uniform float focus; uniform float focusBand; uniform float focusFall; uniform float dofMax;
  uniform vec2 texB1; uniform vec2 texBlur;
  uniform float time; uniform float vignette; uniform float saturation; uniform float contrast; uniform vec3 wb; uniform float aspect;
  uniform vec3 shadowTint; uniform vec3 highTint;
  uniform float fade; uniform vec3 fadeColor;
  varying vec2 vUv;
  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
  // Khronos PBR Neutral (startCompression 0.76, desaturation 0.15)
  vec3 neutral(vec3 color) {
    const float sc = 0.8 - 0.04; const float des = 0.15;
    float x = min(color.r, min(color.g, color.b)); float off = x < 0.08 ? x - 6.25 * x * x : 0.04; color -= off;
    float peak = max(color.r, max(color.g, color.b)); if (peak < sc) return color;
    const float d = 1.0 - sc; float np = 1.0 - d * d / (peak + d - sc); color *= np / peak;
    float g = 1.0 - 1.0 / (des * (peak - np) + 1.0); return mix(color, vec3(np), g);
  }
  float viewDist(float d) { return (near * far) / (far - d * (far - near)); }
  float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main() {
    vec3 col = texture2D(tScene, vUv).rgb;
    if (useDof > 0.5) {
      float f = useAF > 0.5 ? texture2D(tFocus, vec2(0.5)).r : focus;
      float dist = viewDist(texture2D(tDepth, vUv).x);
      float coc = clamp((abs(dist - f) - f * focusBand) / (f * focusFall), 0.0, 1.0) * dofMax;
      if (coc > 0.0) {
        vec3 b1 = texture2D(tBlur1, vUv).rgb;
        if (coc < 0.5) col = mix(col, b1, coc * 2.0);
        else {
          vec2 o = texBlur * 2.0;
          vec3 b2 = (texture2D(tBlur1, vUv + vec2(o.x, o.y)).rgb + texture2D(tBlur1, vUv + vec2(-o.x, o.y)).rgb + texture2D(tBlur1, vUv + vec2(o.x, -o.y)).rgb + texture2D(tBlur1, vUv - o).rgb) * 0.25;
          col = mix(b1, b2, (coc - 0.5) * 2.0);
        }
      }
    }
    if (useBloom > 0.5) {
      vec3 bl = texture2D(tBloom, vUv).rgb;
      if (useBloom1 > 0.5) { vec2 o = texB1 * 0.5; bl += (texture2D(tBloom1, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tBloom1, vUv + vec2(o.x, -o.y)).rgb + texture2D(tBloom1, vUv + vec2(-o.x, o.y)).rgb + texture2D(tBloom1, vUv + vec2(o.x, o.y)).rgb) * 0.25; }
      col += bl * bloomStrength;
    }
    if (useGrade > 0.5) {
      col *= exposure * wb;
      vec2 q = (vUv - 0.5) * vec2(aspect, 1.0); float r = length(q) / length(vec2(aspect, 1.0) * 0.5);
      col *= mix(1.0, 1.0 - smoothstep(0.35, 1.15, r), vignette); // (bordas em ordem: GLSL ES 3.00 §8.3)
      col = 0.18 * exp2(log2(max(col, vec3(1e-6)) / 0.18) * contrast);
      float L = dot(col, LUMA); col = max(vec3(L) + (col - vec3(L)) * saturation, vec3(0.0));
      col = neutral(col);
      float l2 = dot(col, LUMA);
      col = max(col + shadowTint * (1.0 - smoothstep(0.0, 0.25, l2)) + highTint * smoothstep(0.35, 1.0, l2), vec3(0.0));
    } else col = neutral(col * exposure);
    col = clamp(col, 0.0, 1.0);
    col = toSRGB(col);
    col += (h12(gl_FragCoord.xy + fract(time) * 71.0) - 0.5) / 255.0 * 1.5;
    col = mix(col, fadeColor, fade);
    gl_FragColor = vec4(col, 1.0);
  }`;

function fsMaterial(frag, uniforms, blending = THREE.NoBlending) {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, blending, transparent: blending !== THREE.NoBlending });
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, depth: true, powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false;
    r.localClippingEnabled = true;
    this.hdr = !!(r.extensions.has('EXT_color_buffer_float') || r.extensions.has('EXT_color_buffer_half_float'));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.3, 600);
    this.q = QUALITY[opts.quality] || QUALITY.alta;
    this.fixedPR = opts.fixedPR || 0;        // teste: resolução fixa
    this.fpsCap = opts.fpsCap || 60;
    this.pr = this.fixedPR || this._degrau(Math.min(this.q.prMax, window.devicePixelRatio || 1));
    this._msaa = this.q.msaa;
    // valores padrão = luz de exposição (env.setMode reescreve)
    this.params = { bloomStrength: 0.9, threshold: 1.0, knee: 0.55, exposure: 1.05, focusBand: 0.2, focusFall: 0.75, dofMax: 0.55, vignette: 0.35, saturation: 0.7, contrast: 1.08,
      wb: new THREE.Vector3(1.03, 1.0, 0.93), shadowTint: new THREE.Vector3(0, 0.002, 0.004), highTint: new THREE.Vector3(0.012, 0.004, -0.010) };
    this.focus = 20;
    this.fade = 0; this.fadeColor = new THREE.Vector3(0.02, 0.03, 0.06);
    this.shadowDirty = true;
    this.stats = { ms: 16.7, fps: 60, pr: this.pr, calls: 0, tris: 0, sombras: 0, hao: 0, passes: 0, cap: this.fpsCap, msaa: this._msaa, fmt: '' };
    this._acc = { t: 0, n: 0 };
    this._res = { lento: 0, bom: 0, ultDesce: -1e9, subiu: {}, desfeitas: {}, bloq: {}, msaaCaiu: false };
    this._last = 0;
    // estado para o limite de quadros (escrito pelo laço principal e pela interface)
    this.idle = false; this.ocioso = 0; this.carregando = false; this.ocupado = null; this._acordaAte = 0;
    this.modoLuz = 'exposicao'; this.keyDir = null; // env escreve (mesma referência de env.keyDir)
    this.aoQualidade = [];                    // funções chamadas a cada troca de perfil
    this.lost = false;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.onLost && this.onLost(); });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.onRestored ? this.onRestored() : location.reload(); });
    this._taps();
    this._fmt = this._probarR11() ? { format: THREE.RGBFormat, type: THREE.UnsignedInt101111Type } : null; this.stats.fmt = this._fmt ? 'r11g11b10' : this.hdr ? 'rgba16f' : 'rgba8';
    // oclusão por campo de alturas: os materiais recebem o gancho antes da 1ª compilação
    this.haoRaizes = new Set();             // o que entra no mapa de alturas (o mundo registra)
    this._haoDirty = true; this._haoT = -1e9; this._haoPronto = false; this._configHAO();
    for (const nome of ['compileAsync', 'compile']) { const f = r[nome].bind(r); r[nome] = (...a) => { this.prepararHAO(); return f(...a); }; }
    this._buildPost();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  _degrau(p) { const max = this.fixedPR ? p : Math.min(this.q.prMax, window.devicePixelRatio || 1); const d = this._degraus(); let best = d[0]; for (const s of d) if (s <= Math.min(p, max) + 1e-6) best = s; return best; }
  _degraus() { const max = Math.min(this.q.prMax, window.devicePixelRatio || 1); const d = PR_STEPS.filter((s) => s >= this.q.prMin - 1e-6 && s <= max + 1e-6); return d.length ? d : [Math.max(this.q.prMin, Math.min(1, max))]; }
  _taps() { const n = this.q.taps === 8 ? 8 : 5; THREE.ShaderChunk.shadowmap_pars_fragment = PCF[n]; haoCfg.taps = n; }
  // R11F_G11F_B10F (4 bytes/pixel) com MSAA, se o aparelho renderizar nele; senão HalfFloat
  _probarR11() {
    const r = this.renderer, gl = r.getContext();
    if (!r.extensions.has('EXT_color_buffer_float') || typeof gl.getInternalformatParameter !== 'function') return false;
    try {
      const s = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.R11F_G11F_B10F, gl.SAMPLES); const max = s && s.length ? Math.max(...s) : 0;
      if (max < 4) return false;
      let ok = true;
      for (const samples of [4, 0]) {
        const rt = new THREE.WebGLRenderTarget(8, 8, { format: THREE.RGBFormat, type: THREE.UnsignedInt101111Type, samples, depthBuffer: samples > 0, generateMipmaps: false });
        r.setRenderTarget(rt); r.clear(); ok = ok && gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE && gl.getError() === gl.NO_ERROR;
        r.setRenderTarget(null); rt.dispose();
      }
      return ok;
    } catch (_) { return false; }
  }
  _configHAO() {
    const pode = this.q.grade && this.hdr;
    if (pode && !this.hao) { try { this.hao = new HAO(this); } catch (e) { console.warn('HAO desligado:', e.message); this.hao = null; } }
    if (this.hao) this.hao.ativo = pode && this.hao.ok;
    if (this.hao?.ativo) { this._haoDirty = true; if (this._haoPronto) this.hao.prepararCena(); }
  }
  // chamado antes da 1ª compilação (e de novo por quem cria muitos materiais): corrige os materiais
  prepararHAO() { if (this.hao?.ativo) { this.hao.prepararCena(); this._haoPronto = true; } }
  // a construção mudou: o mapa de alturas é refeito no próximo quadro (no máximo 2 vezes por segundo)
  marcarHAO() { this._haoDirty = true; }
  // pede quadros contínuos por um tempo (animações de câmera ou de obra com o jogo ocioso)
  acordar(ms = 1000) { this._acordaAte = Math.max(this._acordaAte, performance.now() + ms); }
  setQuality(id) {
    this.q = QUALITY[id] || QUALITY.alta; this._msaa = this.q.msaa; this._res.msaaCaiu = false;
    this._taps();
    if (!this.fixedPR) this.pr = this._degrau(this.pr);
    this.renderer.shadowMap.enabled = this.q.shadow > 0;
    this._configHAO();
    this.onQuality && this.onQuality(this.q);
    for (const f of this.aoQualidade) f(this.q);
    this._disposeTargets();
    this.resize();
    this.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    this.shadowDirty = true;
  }
  _buildPost() {
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.fsMesh = new THREE.Mesh(g, null); this.fsMesh.frustumCulled = false;
    this.fsScene = new THREE.Scene(); this.fsScene.add(this.fsMesh);
    this.mPre = fsMaterial(PREFILTER, { tMap: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1 }, knee: { value: 0.5 } });
    this.mDown = fsMaterial(DOWN, { tMap: { value: null }, texel: { value: new THREE.Vector2() } });
    this.mUp = fsMaterial(UP, { tMap: { value: null }, texel: { value: new THREE.Vector2() } }, THREE.AdditiveBlending);
    this.mBlur = fsMaterial(BLUR, { tMap: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mCopy = fsMaterial(COPY, { tMap: { value: null }, texel: { value: new THREE.Vector2() } });
    this.mFoco = fsMaterial(FOCO, { tDepth: { value: null }, tPrev: { value: null }, near: { value: 0.3 }, far: { value: 600 }, k: { value: 1 }, reserva: { value: 20 } });
    this.mComp = fsMaterial(COMPOSITE, {
      tScene: { value: null }, tBloom: { value: null }, tBloom1: { value: null }, tBlur1: { value: null }, tDepth: { value: null }, tFocus: { value: null },
      useBloom: { value: 1 }, useBloom1: { value: 1 }, useDof: { value: 0 }, useAF: { value: 0 }, useGrade: { value: 1 }, bloomStrength: { value: 1 }, exposure: { value: 1 },
      near: { value: 0.3 }, far: { value: 600 }, focus: { value: 20 }, focusBand: { value: 0.2 }, focusFall: { value: 0.75 }, dofMax: { value: 0.55 },
      texB1: { value: new THREE.Vector2() }, texBlur: { value: new THREE.Vector2() },
      time: { value: 0 }, vignette: { value: 0.35 }, saturation: { value: 1 }, contrast: { value: 1 }, wb: { value: new THREE.Vector3(1, 1, 1) }, aspect: { value: 1.7 },
      shadowTint: { value: new THREE.Vector3() }, highTint: { value: new THREE.Vector3() },
      fade: { value: 0 }, fadeColor: { value: new THREE.Vector3() },
    });
    // foco: 1x1 em vai e vem
    if (this.hdr) { const o = { type: THREE.HalfFloatType, format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false }; this.rtFoco = [new THREE.WebGLRenderTarget(1, 1, o), new THREE.WebGLRenderTarget(1, 1, o)]; this._fi = 0; }
    this._dofAntes = false;
  }
  _rt(w, h, extra = {}) {
    const fmt = this._fmt || { type: this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType };
    return new THREE.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), { ...fmt, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false, ...extra });
  }
  _disposeTargets() {
    for (const t of [this.rtScene, ...(this.rtBloom || []), this.rtHalf, this.rtB1a, this.rtB1b]) if (t) t.dispose();
    this.rtScene = null; this.rtBloom = null; this.rtHalf = this.rtB1a = this.rtB1b = null;
  }
  // soPR: só a resolução mudou (a sombra não depende do tamanho da tela)
  resize(soPR = false) {
    const w = window.innerWidth, h = window.innerHeight;
    this.vw = w; this.vh = h;
    const r = this.renderer;
    r.setPixelRatio(this.pr);
    r.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const W = Math.round(w * this.pr), H = Math.round(h * this.pr);
    this.W = W; this.H = H;
    this._disposeTargets();
    if (this.q.bloom || this.q.dof || this.q.grade) {
      const depthTexture = new THREE.DepthTexture(W, H);
      depthTexture.type = THREE.UnsignedIntType;
      this.rtScene = this._rt(W, H, { depthBuffer: true, depthTexture, samples: this._msaa, resolveDepthBuffer: false, storeMultisampledDepthBuffer: false });
      this.rtBloom = [];
      let bw = W >> 2, bh = H >> 2;
      for (let i = 0; i < 5 && bw >= 2 && bh >= 2; i++) { this.rtBloom.push(this._rt(bw, bh)); bw >>= 1; bh >>= 1; }
      if (this.q.dof) { this.rtHalf = this._rt(W >> 1, H >> 1); this.rtB1a = this._rt(W >> 1, H >> 1); this.rtB1b = this._rt(W >> 1, H >> 1); }
    }
    this.stats.pr = this.pr; this.stats.msaa = this._msaa;
    if (!soPR) this.shadowDirty = true;
    this.onResize && this.onResize(w, h);
  }
  _pass(mat, target) {
    this.fsMesh.material = mat;
    this.renderer.setRenderTarget(target || null);
    this.renderer.render(this.fsScene, this.fsCam);
    this._np++;
  }
  // limite de quadros pelo estado: carga 2, ocioso 30 (20 depois de 1 min), modal 30, painel 60
  _cap(t) {
    if (this.carregando) return 2;
    if (t < this._acordaAte) return this.fpsCap;
    if (this.idle) return Math.min(this.fpsCap, (this.ocioso || 0) > 60 ? 20 : 30);
    if (this.ocupado === 'modal') return Math.min(this.fpsCap, 30);
    if (this.ocupado === 'painel') return Math.min(this.fpsCap, 60);
    return this.fpsCap;
  }
  // Decide se este quadro deve ser desenhado (limite de fps) e ajusta a resolução dinâmica.
  shouldRender(t) {
    if (this.lost) return false;
    const cap = this._cap(t); this.stats.cap = cap;
    const min = 1000 / cap - 1.5;
    if (this._last && t - this._last < min) return false;
    const dt = this._last ? t - this._last : 16.7;
    this._last = t;
    if (this._capWas !== cap) { this._capWas = cap; this._acc.t = 0; this._acc.n = 0; this._res.lento = this._res.bom = 0; }
    if (dt < 200 || cap <= 5) {
      const a = this._acc; a.t += dt; a.n++;
      if (a.t > 1000) {
        const avg = a.t / a.n; this.stats.ms = avg; this.stats.fps = 1000 / avg;
        if (!this.fixedPR && !document.hidden && cap > 5) this._ajustarPR(avg, 1000 / cap, t);
        this.stats.pr = this.pr; a.t = 0; a.n = 0;
      }
    }
    return true;
  }
  // Resolução em degraus: desce depois de 2 janelas lentas; sobe depois de 5 boas e 10 s da última
  // descida; subida desfeita 2 vezes em menos de 15 s bloqueia o degrau por 2 min; no degrau mínimo
  // e ainda lento por 3 janelas, o MSAA cai de 4 para 2 (uma vez).
  _ajustarPR(avg, alvo, now) {
    const R = this._res, D = this._degraus(); let i = D.indexOf(this.pr); if (i < 0) { this.pr = this._degrau(this.pr); i = D.indexOf(this.pr); }
    if (avg > alvo * 1.15) { R.lento++; R.bom = 0; } else if (avg < alvo * 1.05) { R.bom++; R.lento = 0; } else { R.lento = 0; R.bom = 0; }
    if (R.lento >= 2 && i > 0) {
      if (now - (R.subiu[i] || -1e9) < 15000) { R.desfeitas[i] = (R.desfeitas[i] || 0) + 1; if (R.desfeitas[i] >= 2) { R.bloq[i] = now + 120000; R.desfeitas[i] = 0; } }
      this.pr = D[i - 1]; R.lento = R.bom = 0; R.ultDesce = now; this.resize(true);
    } else if (R.lento >= 3 && i <= 0 && !R.msaaCaiu && this._msaa > 2) {
      R.msaaCaiu = true; R.lento = 0; this._msaa = 2; this.resize(true);
    } else if (R.bom >= 5 && i < D.length - 1 && now - R.ultDesce > 10000 && !((R.bloq[i + 1] || 0) > now)) {
      this.pr = D[i + 1]; R.subiu[i + 1] = now; R.bom = 0; this.resize(true);
    }
  }
  render(time) {
    const r = this.renderer, P = this.params;
    const dt = this._tr ? Math.min(0.25, Math.max(0, (time - this._tr) / 1000)) : 0.016; this._tr = time;
    this._np = 0;
    if (this.hao?.ativo && this._haoDirty && time - this._haoT >= 500) { this._haoDirty = false; this._haoT = time; this.hao.calcular(); this.stats.hao++; }
    if (this.shadowDirty) { r.shadowMap.needsUpdate = true; this.shadowDirty = false; if (r.shadowMap.enabled) this.stats.sombras++; }
    if (!this.rtScene) {
      r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = P.exposure;
      r.setRenderTarget(null); r.render(this.scene, this.camera);
      this._info(); this.stats.passes = 0; return;
    }
    r.toneMapping = THREE.NoToneMapping;
    // profundidade de campo só de perto (na vista geral ela não aparece e custaria 4 passes)
    const perto = this.focus < 12; const dmax = perto ? 0.45 : P.dofMax; const band = perto ? 0.25 : P.focusBand;
    const dof = this.q.dof && this.rtHalf ? dmax * (1 - sstep(28, 34, this.focus)) : 0; const usaDof = dof > 0.001;
    // resolver a profundidade só quando o DOF a lê (e guardá-la, porque o three invalida a resolvida se não guardar)
    this.rtScene.resolveDepthBuffer = usaDof; this.rtScene.storeMultisampledDepthBuffer = usaDof;
    r.setRenderTarget(this.rtScene);
    r.render(this.scene, this.camera);
    this._info();
    const W = this.W, H = this.H, U = this.mComp.uniforms;
    // bloom: prefiltro em 1/4, 4 reduções e 3 ampliações; a última ampliação vai na composição
    const B = this.q.bloom ? this.rtBloom : null;
    if (B && B.length) {
      this.mPre.uniforms.tMap.value = this.rtScene.texture; this.mPre.uniforms.texel.value.set(1 / W, 1 / H);
      this.mPre.uniforms.threshold.value = P.threshold; this.mPre.uniforms.knee.value = P.knee;
      this._pass(this.mPre, B[0]);
      for (let i = 1; i < B.length; i++) { this.mDown.uniforms.tMap.value = B[i - 1].texture; this.mDown.uniforms.texel.value.set(1 / B[i - 1].width, 1 / B[i - 1].height); this._pass(this.mDown, B[i]); }
      for (let i = B.length - 2; i >= 1; i--) { const s = B[i + 1]; this.mUp.uniforms.tMap.value = s.texture; this.mUp.uniforms.texel.value.set(1 / s.width, 1 / s.height); this._pass(this.mUp, B[i]); }
      U.tBloom.value = B[0].texture; U.useBloom.value = 1;
      if (B.length > 1) { U.tBloom1.value = B[1].texture; U.texB1.value.set(1 / B[1].width, 1 / B[1].height); U.useBloom1.value = 1; } else { U.tBloom1.value = B[0].texture; U.useBloom1.value = 0; }
    } else { U.tBloom.value = U.tBloom1.value = this.rtScene.texture; U.useBloom.value = U.useBloom1.value = 0; }
    // desfoque em 1/2 (cópia + H + V) e autofoco
    U.useDof.value = usaDof ? 1 : 0; U.useAF.value = 0;
    if (usaDof) {
      this.mCopy.uniforms.tMap.value = this.rtScene.texture; this.mCopy.uniforms.texel.value.set(1 / W, 1 / H); this._pass(this.mCopy, this.rtHalf);
      const hw = this.rtHalf.width, hh = this.rtHalf.height;
      this.mBlur.uniforms.tMap.value = this.rtHalf.texture; this.mBlur.uniforms.dir.value.set(1.2 / hw, 0); this._pass(this.mBlur, this.rtB1a);
      this.mBlur.uniforms.tMap.value = this.rtB1a.texture; this.mBlur.uniforms.dir.value.set(0, 1.2 / hh); this._pass(this.mBlur, this.rtB1b);
      U.tBlur1.value = this.rtB1b.texture; U.texBlur.value.set(1 / hw, 1 / hh);
      if (this.rtFoco) {
        const F = this.mFoco.uniforms, src = this.rtFoco[this._fi], dst = this.rtFoco[1 - this._fi];
        F.tDepth.value = this.rtScene.depthTexture; F.tPrev.value = src.texture; F.near.value = this.camera.near; F.far.value = this.camera.far;
        F.k.value = this._dofAntes ? 1 - Math.exp(-dt / 0.25) : 1; F.reserva.value = this.focus;
        this._pass(this.mFoco, dst); this._fi = 1 - this._fi; U.tFocus.value = dst.texture; U.useAF.value = 1;
      }
    } else U.tBlur1.value = this.rtScene.texture;
    this._dofAntes = usaDof;
    U.tScene.value = this.rtScene.texture; U.tDepth.value = this.rtScene.depthTexture; if (!U.tFocus.value) U.tFocus.value = this.rtScene.texture;
    U.useGrade.value = this.q.grade ? 1 : 0;
    U.bloomStrength.value = P.bloomStrength * 0.2; U.exposure.value = P.exposure;
    U.near.value = this.camera.near; U.far.value = this.camera.far; U.focus.value = this.focus;
    U.focusBand.value = band; U.focusFall.value = P.focusFall; U.dofMax.value = dof;
    U.time.value = time / 1000; U.vignette.value = P.vignette; U.saturation.value = P.saturation; U.contrast.value = P.contrast;
    if (P.wb) U.wb.value.copy(P.wb); U.aspect.value = W / H;
    U.shadowTint.value.copy(P.shadowTint); U.highTint.value.copy(P.highTint);
    U.fade.value = this.fade; U.fadeColor.value.copy(this.fadeColor);
    this._pass(this.mComp, null);
    this.stats.passes = this._np;
  }
  _info() { const i = this.renderer.info.render; this.stats.calls = i.calls; this.stats.tris = i.triangles; }
}
