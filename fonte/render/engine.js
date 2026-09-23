// Motor de renderização: WebGL2, alvo HDR com MSAA, bloom, profundidade de campo
// (efeito de maquete), gradação de cor, resolução dinâmica e limite de quadros.
import * as THREE from 'three';
import { clamp } from '../core/util.js';

// Perfis de qualidade. "alta" é o padrão para celulares intermediários (ex.: Mali-G615 MC2);
// a resolução se ajusta sozinha entre prMin e prMax para manter a taxa de quadros.
export const QUALITY = {
  ultra: { id: 'ultra', label: 'Ultra', prMax: 2.0, prMin: 1.25, msaa: 4, shadow: 2048, radius: 3.2, bloom: true, dof: true, grade: true, treeShadow: true, life: 1.0 },
  alta: { id: 'alta', label: 'Alta', prMax: 1.6, prMin: 1.0, msaa: 4, shadow: 2048, radius: 2.6, bloom: true, dof: true, grade: true, treeShadow: false, life: 1.0 },
  media: { id: 'media', label: 'Média', prMax: 1.3, prMin: 0.85, msaa: 2, shadow: 1024, radius: 1.8, bloom: true, dof: false, grade: true, treeShadow: false, life: 0.7 },
  leve: { id: 'leve', label: 'Leve', prMax: 1.0, prMin: 0.7, msaa: 0, shadow: 1024, radius: 1.2, bloom: false, dof: false, grade: false, treeShadow: false, life: 0.45 },
};
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

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const PREFILTER = /* glsl */`
  uniform sampler2D tMap; uniform vec2 texel; uniform float threshold; uniform float knee;
  varying vec2 vUv;
  float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  vec3 kar(vec3 c) { return c / (1.0 + lum(c)); }
  void main() {
    vec3 a = texture2D(tMap, vUv + texel * vec2(-1.0, -1.0)).rgb;
    vec3 b = texture2D(tMap, vUv + texel * vec2( 1.0, -1.0)).rgb;
    vec3 c = texture2D(tMap, vUv + texel * vec2(-1.0,  1.0)).rgb;
    vec3 d = texture2D(tMap, vUv + texel * vec2( 1.0,  1.0)).rgb;
    // média de Karis: evita vaga-lumes (pixels isolados muito brilhantes)
    vec3 wa = kar(a), wb = kar(b), wc = kar(c), wd = kar(d);
    float sa = 1.0 / (1.0 + lum(a)), sb = 1.0 / (1.0 + lum(b)), sc = 1.0 / (1.0 + lum(c)), sd = 1.0 / (1.0 + lum(d));
    vec3 col = (a * sa + b * sb + c * sc + d * sd) / (sa + sb + sc + sd);
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

const UP = /* glsl */`
  uniform sampler2D tMap; uniform vec2 texel; uniform float radius; uniform float weight; varying vec2 vUv;
  void main() {
    vec2 o = texel * radius;
    vec3 col = texture2D(tMap, vUv).rgb * 4.0;
    col += (texture2D(tMap, vUv + vec2(-o.x, 0.0)).rgb + texture2D(tMap, vUv + vec2(o.x, 0.0)).rgb + texture2D(tMap, vUv + vec2(0.0, -o.y)).rgb + texture2D(tMap, vUv + vec2(0.0, o.y)).rgb) * 2.0;
    col += texture2D(tMap, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tMap, vUv + vec2(o.x, -o.y)).rgb + texture2D(tMap, vUv + vec2(-o.x, o.y)).rgb + texture2D(tMap, vUv + vec2(o.x, o.y)).rgb;
    gl_FragColor = vec4(col / 16.0 * weight, 1.0);
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

const COMPOSITE = /* glsl */`
  uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tBlur1; uniform sampler2D tBlur2; uniform sampler2D tDepth;
  uniform float useBloom; uniform float useDof; uniform float useGrade; uniform float bloomStrength; uniform float exposure;
  uniform float near; uniform float far; uniform float focus; uniform float focusBand; uniform float focusFall; uniform float dofMax;
  uniform float time; uniform float vignette; uniform float saturation; uniform float contrast; uniform vec3 shadowTint; uniform vec3 highTint;
  uniform float fade; uniform vec3 fadeColor;
  varying vec2 vUv;
  vec3 aces(vec3 x) { const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
  float viewDist(float d) { return (near * far) / (far - d * (far - near)); }
  float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main() {
    vec3 col = texture2D(tScene, vUv).rgb;
    if (useDof > 0.5) {
      float dist = viewDist(texture2D(tDepth, vUv).x);
      float coc = clamp((abs(dist - focus) - focus * focusBand) / (focus * focusFall), 0.0, 1.0) * dofMax;
      vec3 b1 = texture2D(tBlur1, vUv).rgb; vec3 b2 = texture2D(tBlur2, vUv).rgb;
      vec3 bl = coc < 0.5 ? mix(col, b1, coc * 2.0) : mix(b1, b2, (coc - 0.5) * 2.0);
      col = bl;
    }
    if (useBloom > 0.5) col += texture2D(tBloom, vUv).rgb * bloomStrength;
    col *= exposure;
    col = aces(col);
    if (useGrade > 0.5) {
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      col += shadowTint * (1.0 - smoothstep(0.0, 0.45, l)) + highTint * smoothstep(0.55, 1.0, l);
      vec2 q = vUv - 0.5; float v = 1.0 - dot(q, q) * vignette * 1.6;
      col *= clamp(v, 0.0, 1.0);
    }
    col = clamp(col, 0.0, 1.0);
    col = toSRGB(col);
    col += (h12(gl_FragCoord.xy + fract(time) * 71.0) - 0.5) / 255.0 * 1.5;
    col = mix(col, fadeColor, fade);
    gl_FragColor = vec4(col, 1.0);
  }`;

function fsMaterial(frag, uniforms, blending = THREE.NoBlending) {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, blending, transparent: blending !== THREE.NoBlending });
}

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
    this.pr = this.fixedPR || Math.min(this.q.prMax, window.devicePixelRatio || 1);
    this.params = { bloomStrength: 0.9, threshold: 1.0, knee: 0.55, exposure: 1.0, focusBand: 0.2, focusFall: 0.75, dofMax: 0.55, vignette: 0.55, saturation: 1.08, contrast: 1.04, shadowTint: new THREE.Vector3(-0.006, 0.004, 0.018), highTint: new THREE.Vector3(0.02, 0.008, -0.012) };
    this.focus = 20;
    this.fade = 0; this.fadeColor = new THREE.Vector3(0.02, 0.03, 0.06);
    this.shadowDirty = true;
    this.stats = { ms: 16.7, fps: 60, pr: this.pr, calls: 0, tris: 0 };
    this._acc = { t: 0, n: 0, good: 0 };
    this._last = 0;
    this.idle = false;                         // sem interação: limita a 30 qps para poupar bateria
    this.lost = false;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.onLost && this.onLost(); });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.onRestored ? this.onRestored() : location.reload(); });
    this._buildPost();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  setQuality(id) {
    this.q = QUALITY[id] || QUALITY.alta;
    if (!this.fixedPR) this.pr = Math.min(this.q.prMax, Math.max(this.q.prMin, this.pr));
    this.renderer.shadowMap.enabled = this.q.shadow > 0;
    this.onQuality && this.onQuality(this.q);
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
    this.mUp = fsMaterial(UP, { tMap: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 }, weight: { value: 1 } }, THREE.AdditiveBlending);
    this.mBlur = fsMaterial(BLUR, { tMap: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mCopy = fsMaterial(COPY, { tMap: { value: null }, texel: { value: new THREE.Vector2() } });
    this.mComp = fsMaterial(COMPOSITE, {
      tScene: { value: null }, tBloom: { value: null }, tBlur1: { value: null }, tBlur2: { value: null }, tDepth: { value: null },
      useBloom: { value: 1 }, useDof: { value: 1 }, useGrade: { value: 1 }, bloomStrength: { value: 1 }, exposure: { value: 1 },
      near: { value: 0.3 }, far: { value: 600 }, focus: { value: 20 }, focusBand: { value: 0.1 }, focusFall: { value: 0.5 }, dofMax: { value: 1 },
      time: { value: 0 }, vignette: { value: 0.5 }, saturation: { value: 1 }, contrast: { value: 1 }, shadowTint: { value: new THREE.Vector3() }, highTint: { value: new THREE.Vector3() },
      fade: { value: 0 }, fadeColor: { value: new THREE.Vector3() },
    });
  }
  _rt(w, h, extra = {}) {
    return new THREE.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), { type: this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false, ...extra });
  }
  _disposeTargets() {
    for (const t of [this.rtScene, ...(this.rtBloom || []), this.rtHalf, this.rtB1a, this.rtB1b, this.rtB2a, this.rtB2b]) if (t) t.dispose();
    this.rtScene = null; this.rtBloom = null;
  }
  resize() {
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
      this.rtScene = this._rt(W, H, { depthBuffer: true, depthTexture, samples: this.q.msaa });
      this.rtBloom = [];
      let bw = W >> 1, bh = H >> 1;
      for (let i = 0; i < 6 && bw > 4 && bh > 4; i++) { this.rtBloom.push(this._rt(bw, bh)); bw >>= 1; bh >>= 1; }
      this.rtHalf = this._rt(W >> 1, H >> 1);
      this.rtB1a = this._rt(W >> 1, H >> 1); this.rtB1b = this._rt(W >> 1, H >> 1);
      this.rtB2a = this._rt(W >> 2, H >> 2); this.rtB2b = this._rt(W >> 2, H >> 2);
    }
    this.shadowDirty = true;
    this.onResize && this.onResize(w, h);
  }
  _pass(mat, target) {
    this.fsMesh.material = mat;
    this.renderer.setRenderTarget(target || null);
    this.renderer.render(this.fsScene, this.fsCam);
  }
  // Decide se este quadro deve ser desenhado (limite de fps) e ajusta a resolução dinâmica.
  shouldRender(t) {
    if (this.lost) return false;
    const cap = this.idle ? Math.min(30, this.fpsCap) : this.fpsCap;
    const min = 1000 / cap - 1.5;
    if (this._last && t - this._last < min) return false;
    const dt = this._last ? t - this._last : 16.7;
    this._last = t;
    if (this._capWas !== cap) { this._capWas = cap; this._acc.t = 0; this._acc.n = 0; }
    if (dt < 200) {
      const a = this._acc; a.t += dt; a.n++;
      if (a.t > 1000) {
        const avg = a.t / a.n; this.stats.ms = avg; this.stats.fps = 1000 / avg;
        const target = 1000 / cap;
        if (!this.fixedPR && !document.hidden) {
          if (avg > target * 1.18 && this.pr > this.q.prMin) { this.pr = Math.max(this.q.prMin, this.pr * 0.88); a.good = 0; this.resize(); }
          else if (avg < target * 1.05) { a.good++; if (a.good >= 3 && this.pr < Math.min(this.q.prMax, window.devicePixelRatio || 1)) { this.pr = Math.min(this.q.prMax, this.pr * 1.07); a.good = 0; this.resize(); } }
          else a.good = 0;
        }
        this.stats.pr = this.pr; a.t = 0; a.n = 0;
      }
    }
    return true;
  }
  render(time) {
    const r = this.renderer, P = this.params;
    if (this.shadowDirty) { r.shadowMap.needsUpdate = true; this.shadowDirty = false; }
    if (!this.rtScene) {
      r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = P.exposure;
      r.setRenderTarget(null); r.render(this.scene, this.camera);
      this._info(); return;
    }
    r.toneMapping = THREE.NoToneMapping;
    r.setRenderTarget(this.rtScene);
    r.render(this.scene, this.camera);
    this._info();
    const W = this.W, H = this.H;
    // bloom
    if (this.q.bloom && this.rtBloom.length) {
      const B = this.rtBloom;
      this.mPre.uniforms.tMap.value = this.rtScene.texture; this.mPre.uniforms.texel.value.set(1 / W, 1 / H);
      this.mPre.uniforms.threshold.value = P.threshold; this.mPre.uniforms.knee.value = P.knee;
      this._pass(this.mPre, B[0]);
      for (let i = 1; i < B.length; i++) { this.mDown.uniforms.tMap.value = B[i - 1].texture; this.mDown.uniforms.texel.value.set(1 / B[i - 1].width, 1 / B[i - 1].height); this._pass(this.mDown, B[i]); }
      for (let i = B.length - 2; i >= 0; i--) { const s = B[i + 1]; this.mUp.uniforms.tMap.value = s.texture; this.mUp.uniforms.texel.value.set(1 / s.width, 1 / s.height); this.mUp.uniforms.radius.value = 1.0; this.mUp.uniforms.weight.value = 1.0; this._pass(this.mUp, B[i]); }
    }
    // desfoque para profundidade de campo
    if (this.q.dof) {
      this.mCopy.uniforms.tMap.value = this.rtScene.texture; this.mCopy.uniforms.texel.value.set(1 / W, 1 / H); this._pass(this.mCopy, this.rtHalf);
      const hw = this.rtHalf.width, hh = this.rtHalf.height;
      this.mBlur.uniforms.tMap.value = this.rtHalf.texture; this.mBlur.uniforms.dir.value.set(1.2 / hw, 0); this._pass(this.mBlur, this.rtB1a);
      this.mBlur.uniforms.tMap.value = this.rtB1a.texture; this.mBlur.uniforms.dir.value.set(0, 1.2 / hh); this._pass(this.mBlur, this.rtB1b);
      const qw = this.rtB2a.width, qh = this.rtB2a.height;
      this.mCopy.uniforms.tMap.value = this.rtB1b.texture; this.mCopy.uniforms.texel.value.set(1 / hw, 1 / hh); this._pass(this.mCopy, this.rtB2a);
      this.mBlur.uniforms.tMap.value = this.rtB2a.texture; this.mBlur.uniforms.dir.value.set(2.2 / qw, 0); this._pass(this.mBlur, this.rtB2b);
      this.mBlur.uniforms.tMap.value = this.rtB2b.texture; this.mBlur.uniforms.dir.value.set(0, 2.2 / qh); this._pass(this.mBlur, this.rtB2a);
    }
    const U = this.mComp.uniforms;
    U.tScene.value = this.rtScene.texture; U.tDepth.value = this.rtScene.depthTexture;
    U.tBloom.value = this.q.bloom && this.rtBloom.length ? this.rtBloom[0].texture : this.rtScene.texture;
    U.tBlur1.value = this.q.dof ? this.rtB1b.texture : this.rtScene.texture; U.tBlur2.value = this.q.dof ? this.rtB2a.texture : this.rtScene.texture;
    U.useBloom.value = this.q.bloom ? 1 : 0; U.useDof.value = this.q.dof ? 1 : 0; U.useGrade.value = this.q.grade ? 1 : 0;
    U.bloomStrength.value = P.bloomStrength * 0.18; U.exposure.value = P.exposure;
    U.near.value = this.camera.near; U.far.value = this.camera.far; U.focus.value = this.focus;
    U.focusBand.value = P.focusBand; U.focusFall.value = P.focusFall; U.dofMax.value = P.dofMax;
    U.time.value = time / 1000; U.vignette.value = P.vignette; U.saturation.value = P.saturation; U.contrast.value = P.contrast;
    U.shadowTint.value.copy(P.shadowTint); U.highTint.value.copy(P.highTint);
    U.fade.value = this.fade; U.fadeColor.value.copy(this.fadeColor);
    this._pass(this.mComp, null);
  }
  _info() { const i = this.renderer.info.render; this.stats.calls = i.calls; this.stats.tris = i.triangles; }
}
