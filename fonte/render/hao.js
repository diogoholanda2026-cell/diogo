// Oclusão de ambiente por campo de alturas (HAO): a maquete vista de cima vira um mapa de alturas
// desfocado; cada fragmento compara a própria altura com a do entorno e escurece a luz indireta
// (e um pouco da direta). Na mesma injeção vão a queda de luz nos cantos da mesa (poça do refletor)
// e um véu leve de distância. O mapa só é refeito quando a construção muda, nunca pela câmera.
import * as THREE from 'three';

export const CAMADA_HAO = 5;                 // só o que tem esta camada entra no mapa de alturas
const X0 = -34, X1 = 34, Z0 = -22, Z1 = 22;  // a mesa + 2 unidades
export const HAO_U = { tHAO: { value: null }, haoOn: { value: 0 }, haoP: { value: new THREE.Vector4(X0, Z1, 1 / (X1 - X0), -1 / (Z1 - Z0)) } }; // v cresce para -z (câmera com up -z)
export const haoCfg = { taps: 8 };           // amostras da sombra: entram na chave do programa
const corrigidos = new WeakSet();            // (userData é copiado por clone(), o gancho não)

const VS_DECL = 'varying vec3 vHaoW;';
const VS_POS = /* glsl */`
  { vec4 hw = vec4( transformed, 1.0 );
    #ifdef USE_INSTANCING
      hw = instanceMatrix * hw;
    #endif
    vHaoW = ( modelMatrix * hw ).xyz; }`;
const FS_DECL = 'varying vec3 vHaoW; uniform sampler2D tHAO; uniform vec4 haoP; uniform float haoOn;';
const FS_AO = /* glsl */`
  if ( haoOn > 0.5 ) {
    float hb = texture2D( tHAO, ( vHaoW.xz - haoP.xy ) * haoP.zw ).r;
    float occ = clamp( 1.0 - max( hb - vHaoW.y, 0.0 ) * 0.6, 0.35, 1.0 );
    reflectedLight.indirectDiffuse *= occ; reflectedLight.indirectSpecular *= occ;
    reflectedLight.directDiffuse *= mix( 1.0, occ, 0.35 );
    reflectedLight.directDiffuse *= 1.0 - 0.22 * smoothstep( 0.45, 1.05, length( vHaoW.xz / vec2( 34.0, 22.0 ) ) );
  }`;
const FS_VEU = /* glsl */`
  if ( haoOn > 0.5 ) gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( 0.020, 0.026, 0.040 ), smoothstep( 50.0, 110.0, length( vHaoW - cameraPosition ) ) * 0.18 );`;

// Encadeia o gancho no material (MeshStandard/Physical). Idempotente; a chave do programa passa a
// incluir '|hao' para não dividir programa com um material sem o gancho.
export function haoPatch(mat) {
  if (!mat || !mat.isMeshStandardMaterial || corrigidos.has(mat)) return false;
  if (mat.clippingPlanes && mat.clippingPlanes.length) return false; // clones de obra (temporários)
  corrigidos.add(mat);
  const own = (k) => Object.prototype.hasOwnProperty.call(mat, k);
  const prev = own('onBeforeCompile') ? mat.onBeforeCompile : null;
  const prevKey = own('customProgramCacheKey') ? mat.customProgramCacheKey : null;
  const chave0 = prev ? prev.toString() : '';
  mat.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    if (sh.uniforms.tHAO) return;
    sh.uniforms.tHAO = HAO_U.tHAO; sh.uniforms.haoP = HAO_U.haoP; sh.uniforms.haoOn = HAO_U.haoOn;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VS_DECL).replace('#include <project_vertex>', '#include <project_vertex>' + VS_POS);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FS_DECL).replace('#include <aomap_fragment>', '#include <aomap_fragment>' + FS_AO).replace('#include <opaque_fragment>', '#include <opaque_fragment>' + FS_VEU);
  };
  mat.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : chave0) + '|hao' + haoCfg.taps; };
  mat.needsUpdate = true;
  return true;
}

const HV = /* glsl */`varying float vY; void main() { vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
  #endif
  vec4 w = modelMatrix * p; vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`;
const HF = /* glsl */`varying float vY; void main() { gl_FragColor = vec4(vY, 0.0, 0.0, 1.0); }`;
const BV = /* glsl */`varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BF = /* glsl */`uniform sampler2D tMap; uniform vec2 dir; varying vec2 vUv;
  void main() { float s = 0.0, w = 0.0; for (int i = -6; i <= 6; i++) { float k = exp(-float(i * i) / 18.0); s += texture2D(tMap, vUv + dir * float(i)).r * k; w += k; } gl_FragColor = vec4(s / w, 0.0, 0.0, 1.0); }`;

export class HAO {
  constructor(engine) {
    this.e = engine; const r = engine.renderer; this.ativo = false;
    this.ok = !!(r.extensions.has('EXT_color_buffer_float') || r.extensions.has('EXT_color_buffer_half_float'));
    if (!this.ok) return;
    const o = { type: THREE.HalfFloatType, format: THREE.RedFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping };
    this.A = new THREE.WebGLRenderTarget(512, 320, { ...o, depthBuffer: true });
    this.B = new THREE.WebGLRenderTarget(256, 160, { ...o, depthBuffer: false }); this.C = new THREE.WebGLRenderTarget(256, 160, { ...o, depthBuffer: false });
    this.cam = new THREE.OrthographicCamera(X0, X1, -Z0, -Z1, 1, 120); this.cam.position.set(0, 60, 0); this.cam.up.set(0, 0, -1); this.cam.lookAt(0, 0, 0); this.cam.updateMatrixWorld(); this.cam.layers.set(CAMADA_HAO);
    this.mAlt = new THREE.ShaderMaterial({ vertexShader: HV, fragmentShader: HF, side: THREE.DoubleSide });
    this.mBlur = new THREE.ShaderMaterial({ vertexShader: BV, fragmentShader: BF, uniforms: { tMap: { value: null }, dir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const m = new THREE.Mesh(g, this.mBlur); m.frustumCulled = false; this.fs = new THREE.Scene(); this.fs.add(m); this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._cc = new THREE.Color(); HAO_U.tHAO.value = this.C.texture;
  }
  set ativo(v) { this._ativo = v; HAO_U.haoOn.value = v && this._calculado ? 1 : 0; }
  get ativo() { return this._ativo; }
  // gancho em todos os materiais da cena (menos obras em andamento)
  prepararCena() { const n = { v: 0 }; const anda = (o) => { if (o.name === 'obras') return; if (o.material) for (const m of [].concat(o.material)) if (haoPatch(m)) n.v++; for (const c of o.children) anda(c); }; anda(this.e.scene); return n.v; }
  // quem entra no mapa: os opacos das raízes registradas (terreno, mata, mundo); ficam de fora gente,
  // bichos, obras, transparentes, materiais cortados e tudo com userData.semHAO (a queda nos cantos
  // cuida da borda da bandeja)
  _entrada() {
    const marca = (o, ok) => {
      if (o.userData.semHAO || o.name === 'obras' || o.userData.feito === false) ok = false; // peça ainda em obra: só entra aprovada
      if (o.isMesh) {
        const ms = [].concat(o.material); const opaco = ms.every((m) => m && !m.transparent && !m.userData.semHAO && !(m.clippingPlanes && m.clippingPlanes.length));
        if (ok && opaco) o.layers.enable(CAMADA_HAO); else o.layers.disable(CAMADA_HAO);
      }
      for (const c of o.children) marca(c, ok);
    };
    for (const r of this.e.haoRaizes || []) marca(r, true);
  }
  calcular() {
    const e = this.e, r = e.renderer, scene = e.scene;
    this.prepararCena(); this._entrada();
    const bg = scene.background, ov = scene.overrideMaterial, sm = r.shadowMap.enabled, rt = r.getRenderTarget(); r.getClearColor(this._cc); const ca = r.getClearAlpha();
    scene.background = null; scene.overrideMaterial = this.mAlt; r.shadowMap.enabled = false;
    r.setClearColor(0x000000, 1); r.setRenderTarget(this.A); r.clear(); r.render(scene, this.cam);
    scene.overrideMaterial = ov; scene.background = bg; r.shadowMap.enabled = sm;
    const U = this.mBlur.uniforms; const pass = (src, dst, dx, dy) => { U.tMap.value = src.texture; U.dir.value.set(dx, dy); r.setRenderTarget(dst); r.render(this.fs, this.fsCam); };
    pass(this.A, this.B, 1.5 / 512, 0); pass(this.B, this.C, 0, 1.5 / 160); pass(this.C, this.B, 1.5 / 256, 0); pass(this.B, this.C, 0, 1.5 / 160);
    r.setRenderTarget(rt); r.setClearColor(this._cc, ca);
    this._calculado = true; HAO_U.haoOn.value = this._ativo ? 1 : 0;
  }
}
