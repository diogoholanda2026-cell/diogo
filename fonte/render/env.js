// Ambiente: céu noturno com aurora em fitas, luz principal quente de exposição, luz de preenchimento,
// mapa de reflexos (PMREM) e ciclo de luz (exposição / dia / noite). A sombra acompanha o ponto de
// interesse da câmera com histerese e penumbra de tamanho fixo em mundo.
import * as THREE from 'three';
import { setNight } from './materials.js';
import { clamp } from '../core/util.js';

const SKY_V = /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_F = /* glsl */`
  uniform float t; uniform float day; uniform float off; uniform float aur; varying vec3 vDir;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  // ruído periódico no azimute: a volta inteira tem N células (a rede em x é tomada módulo N), então
  // o céu não tem costura em lugar nenhum, qualquer que seja a origem do ângulo
  float np(float u, float v, float N){ float i = floor(u), f = fract(u); vec2 j = vec2(floor(v), fract(v)); f = f*f*(3.0-2.0*f); j.y = j.y*j.y*(3.0-2.0*j.y);
    float a = mod(i, N), b = mod(i + 1.0, N); return mix(mix(h(vec2(a, j.x)), h(vec2(b, j.x)), f), mix(h(vec2(a, j.x + 1.0)), h(vec2(b, j.x + 1.0)), f), j.y); }
  // fita de aurora: borda de baixo nítida, topo difuso, verde embaixo e violeta em cima
  vec3 fita(float y, float yc, float k) { float dy = y - yc; float base = smoothstep(-0.02, 0.0, dy) * exp(-max(dy, 0.0) * k);
    return mix(vec3(0.12, 0.95, 0.5), vec3(0.55, 0.25, 0.9), smoothstep(0.0, 0.18, dy)) * base; }
  void main(){
    vec3 d = normalize(vDir); float y = d.y + off; // o céu desce como um painel atrás da mesa
    // noite: azul-marinho (#172337 na foto logo acima da mesa), mais escuro para o alto
    vec3 night = mix(vec3(0.045, 0.056, 0.088), vec3(0.034, 0.045, 0.075), smoothstep(0.0, 0.3, y));
    night = mix(night, vec3(0.012, 0.02, 0.045), smoothstep(0.3, 0.9, y));
    // dia: parede clara de galeria (#b9c4cc embaixo, #e6e2da no alto)
    vec3 dayc = mix(vec3(0.485, 0.552, 0.604), vec3(0.791, 0.762, 0.701), smoothstep(-0.35, 0.45, y));
    vec3 col = mix(night, dayc, day);
    // azimute em voltas (0..1): senos com frequência inteira e ruído periódico (np), sem costura
    float u = atan(d.x, d.z) * 0.15915494;
    // aurora em fitas horizontais, concentrada atrás da mesa (lado -z)
    float yc = 0.30 + 0.08 * sin(u * 12.566371 + t * 0.03) + 0.05 * np(u * 19.0, t * 0.02, 19.0);
    // raios das cortinas: brilho e altura variam pouco de um raio para o outro (fita, não colunas)
    float nr = np(u * 239.0 + t * 0.12, 0.0, 239.0), nr2 = np(u * 609.0 - t * 0.2, 3.0, 609.0);
    float raios = 0.6 + 0.45 * nr * nr + 0.15 * nr2; float k = 10.0 - 3.5 * nr;
    float dobra = 0.5 + 0.5 * sin(u * 12.566371 + 4.0 * np(u * 13.0, t * 0.01, 13.0));
    float mask = smoothstep(-0.2, 0.6, -d.z);
    col += (fita(y, yc, k) + fita(y, yc + 0.12, k) * 0.5) * raios * dobra * mask * aur * (1.0 - day);
    // estrelas com brilhos variados
    vec2 sp = vec2(mod(floor(u * 565.0), 565.0), floor(y * 260.0)); float s = h(sp), s2 = h(sp + 17.31);
    float star = step(0.9975, s) * pow(s2, 8.0) * smoothstep(0.05, 0.2, y) * (0.6 + 0.4 * sin(t * 1.7 + s * 90.0));
    col += vec3(star) * 3.0 * (1.0 - day);
    gl_FragColor = vec4(col, 1.0);
  }`;

// luz e gradação de cada modo
const MODOS = {
  exposicao: { key: [0xffd6a4, 2.6], dir: [-0.30, 0.90, 0.30], sombra: 0.85, hemi: [0x8aa8dc, 0x6a4a2c, 0.95], envI: 0.8, rim: [0x6fdcc0, 0.35], night: [1, 0], day: 0, off: 0.62, aur: 0.24,
    P: { exposure: 1.05, saturation: 0.7, contrast: 1.08, vignette: 0.35, wb: [1.03, 1.0, 0.93], shadowTint: [0, 0.002, 0.004], highTint: [0.012, 0.004, -0.010], threshold: 1.0, bloomStrength: 0.9 } },
  dia: { key: [0xfff1dc, 3.0], dir: [-0.35, 0.86, 0.36], sombra: 0.8, hemi: [0xbcd8ff, 0x6a5a44, 1.1], envI: 1.0, rim: [0x9fc4ff, 0.3], night: [0.05, 0], day: 1, off: 0, aur: 0,
    P: { exposure: 1.0, saturation: 0.9, contrast: 1.06, vignette: 0.25, wb: [0.98, 1.0, 1.02], shadowTint: [0, 0.001, 0.003], highTint: [0.006, 0.003, -0.004], threshold: 1.0, bloomStrength: 0.45 } },
  noite: { key: [0x9fb8ff, 0.9], dir: [0.3, 0.8, -0.5], sombra: 0.7, hemi: [0x2a3f6a, 0x1a140e, 0.7], envI: 0.45, rim: [0x5fe0b0, 0.4], night: [1, 1], day: 0, off: 0.62, aur: 0.2,
    P: { exposure: 1.5, saturation: 0.65, contrast: 1.05, vignette: 0.4, wb: [0.97, 1.0, 1.04], shadowTint: [0, 0.002, 0.006], highTint: [0.004, 0.004, 0.0], threshold: 0.8, bloomStrength: 1.2 } },
};

export class Environment {
  constructor(engine) {
    this.e = engine; const scene = engine.scene;
    this.mode = 'exposicao';
    this.hemi = new THREE.HemisphereLight(0x8aa8dc, 0x6a4a2c, 0.95); scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffd6a4, 2.6);
    this.key.castShadow = true;
    const s = this.key.shadow; s.mapSize.set(2048, 2048); s.bias = -0.00025; s.normalBias = 0.035; s.radius = 2.5;
    s.camera.near = 1; s.camera.far = 160;
    scene.add(this.key); scene.add(this.key.target);
    this.rim = new THREE.DirectionalLight(0x6fdcc0, 0.35); this.rim.position.set(20, 30, -40); scene.add(this.rim);
    this.keyDir = new THREE.Vector3(-0.30, 0.90, 0.30).normalize(); engine.keyDir = this.keyDir;
    this._sc = { x: 0, z: 0, ok: false };
    this.skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, uniforms: { t: { value: 0 }, day: { value: 0 }, off: { value: 0.62 }, aur: { value: 0.24 } }, side: THREE.BackSide, depthWrite: false, fog: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), this.skyMat); this.sky.frustumCulled = false; this.sky.renderOrder = -10; this.sky.userData.semHAO = true;
    scene.add(this.sky);
    this.buildEnvMap();
    this.setMode('exposicao');
  }
  // reflexos: uma "sala de exposição" escura com refletores quentes, um softbox no teto, piso de
  // madeira escura (as faces de baixo recebem rebote quente, não azul) e um painel frio discreto
  buildEnvMap() {
    const r = this.e.renderer; const pm = new THREE.PMREMGenerator(r);
    const room = new THREE.Scene();
    room.background = new THREE.Color(0x0b0f1a);
    const box = new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: 0x141a28, side: THREE.BackSide }));
    room.add(box);
    const panel = (w, h, x, y, z, col, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); room.add(m); };
    panel(22, 8, -12, 12, 16, 0xffd4a0, 3.2);
    panel(14, 6, 18, 10, 8, 0xffe8c8, 2.0);
    panel(40, 12, 0, 14, -26, 0x5a9ad8, 0.5);
    panel(60, 60, 0, -14, 0, 0x2a1e14, 1.0);     // piso quente
    panel(20, 20, 0, 14.9, 3, 0xffe6c8, 1.5);    // softbox do teto
    panel(30, 6, 0, 14.85, -18, 0x3fd6a8, 0.6);  // reflexo da aurora
    this.envTex = pm.fromScene(room, 0.03).texture;
    this.e.scene.environment = this.envTex;
    this.e.scene.environmentIntensity = 0.8;
    room.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    pm.dispose();
  }
  setMode(m) {
    const M = MODOS[m] || MODOS.exposicao; if (!MODOS[m]) m = 'exposicao';
    this.mode = m; this.e.modoLuz = m;
    const P = this.e.params, s = this.key.shadow;
    this.key.color.set(M.key[0]); this.key.intensity = M.key[1]; s.intensity = M.sombra;
    this.hemi.color.set(M.hemi[0]); this.hemi.groundColor.set(M.hemi[1]); this.hemi.intensity = M.hemi[2];
    this.rim.color.set(M.rim[0]); this.rim.intensity = M.rim[1];
    this.keyDir.set(...M.dir).normalize(); this.e.scene.environmentIntensity = M.envI;
    this.skyMat.uniforms.day.value = M.day; this.skyMat.uniforms.off.value = M.off; this.skyMat.uniforms.aur.value = M.aur;
    setNight(M.night[0], M.night[1]);
    for (const [k, v] of Object.entries(M.P)) { if (Array.isArray(v)) { if (P[k]) P[k].set(...v); else P[k] = new THREE.Vector3(...v); } else P[k] = v; }
    this._sc.ok = false; // recentra a sombra com a nova direção
    this.e.shadowDirty = true;
  }
  // A sombra acompanha o ponto de interesse da câmera: só recentra quando o alvo sai de 20% do
  // quadro de sombra, e o tamanho do quadro anda em degraus de 2^(1/4) (sem refazer a cada quadro).
  update(t, target, viewSize) {
    this.skyMat.uniforms.t.value = t / 1000;
    const s = this.key.shadow, sc = s.camera, C = this._sc;
    const span = clamp(viewSize, 10, 90);
    const half = Math.pow(2, Math.ceil(Math.log2(0.62 * span * 1.25) * 4) / 4);
    const tex = (half * 2) / s.mapSize.x;
    let suja = false;
    if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); suja = true; C.ok = false; }
    if (!C.ok || Math.hypot(target.x - C.x, target.z - C.z) > 0.2 * half) {
      C.x = Math.round(target.x / tex) * tex; C.z = Math.round(target.z / tex) * tex; C.ok = true; // encaixe na grade de texels
      const k = this.key, d = this.keyDir; k.target.position.set(C.x, 0, C.z); k.position.set(C.x + d.x * 60, d.y * 60, C.z + d.z * 60); k.target.updateMatrixWorld(); suja = true;
    }
    // penumbra de ~0,14 unidade em mundo, qualquer que seja o zoom; viés normal de 0,9 texel
    s.radius = clamp(0.14 / tex, 1.5, 7); s.normalBias = 0.9 * tex;
    if (suja) this.e.shadowDirty = true;
    this.sky.position.copy(this.e.camera.position);
  }
  setShadowSize(n) { const s = this.key.shadow; if (!n) { this.key.castShadow = false; return; } this.key.castShadow = true; if (s.mapSize.x !== n) { s.mapSize.set(n, n); if (s.map) { s.map.dispose(); s.map = null; } this._sc.ok = false; } }
}
