// Ambiente: céu noturno com aurora, luz principal quente de exposição, luz de preenchimento,
// mapa de reflexos (PMREM) e ciclo de luz (exposição / dia / noite).
import * as THREE from 'three';
import { setNight } from './materials.js';
import { clamp, lerp } from '../core/util.js';

const SKY_V = /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_F = /* glsl */`
  uniform float t; uniform float day; varying vec3 vDir;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  void main(){
    vec3 d = normalize(vDir); float y = d.y + 0.42 * (1.0 - day); // o céu noturno desce como um painel atrás da mesa
    vec3 night = mix(vec3(0.030,0.045,0.090), vec3(0.008,0.014,0.032), smoothstep(0.0, 0.8, y));
    night = mix(vec3(0.07,0.09,0.16), night, smoothstep(-0.1, 0.22, y));
    vec3 dayc = mix(vec3(0.62,0.74,0.86), vec3(0.28,0.46,0.74), smoothstep(0.0, 0.7, y));
    vec3 col = mix(night, dayc, day);
    float ang = atan(d.x, d.z);
    // cortinas da aurora
    float band = smoothstep(0.0, 0.2, y) * (1.0 - smoothstep(0.45, 0.9, y));
    float w1 = n2(vec2(ang * 3.0 + t * 0.05, y * 2.0 - t * 0.02));
    float w2 = n2(vec2(ang * 7.0 - t * 0.04, y * 5.0));
    float curtain = pow(max(0.0, sin(ang * 4.0 + w1 * 3.0 + t * 0.06) * 0.5 + 0.5), 3.0) * (0.6 + 0.4 * w2);
    float rays = pow(n2(vec2(ang * 40.0, t * 0.08)), 2.0);
    vec3 aur = mix(vec3(0.10, 0.85, 0.55), vec3(0.45, 0.25, 0.85), smoothstep(0.12, 0.5, y + w2 * 0.2));
    col += aur * band * curtain * (0.35 + 0.65 * rays) * 0.55 * (1.0 - day);
    // estrelas
    vec2 sp = floor(vec2(ang * 90.0, y * 260.0)); float s = h(sp);
    float star = step(0.9965, s) * smoothstep(0.05, 0.2, y) * (0.55 + 0.45 * sin(t * 1.7 + s * 90.0));
    col += vec3(star) * 1.6 * (1.0 - day);
    gl_FragColor = vec4(col, 1.0);
  }`;

export class Environment {
  constructor(engine) {
    this.e = engine; const scene = engine.scene;
    this.mode = 'exposicao';
    this.hemi = new THREE.HemisphereLight(0x7fa0d8, 0x3a2a1c, 0.55); scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffd6a6, 2.6);
    this.key.castShadow = true;
    const s = this.key.shadow; s.mapSize.set(2048, 2048); s.bias = -0.00025; s.normalBias = 0.035; s.radius = 2.5;
    s.camera.near = 1; s.camera.far = 160;
    scene.add(this.key); scene.add(this.key.target);
    this.rim = new THREE.DirectionalLight(0x86b8ff, 0.55); this.rim.position.set(20, 30, -40); scene.add(this.rim);
    this.keyDir = new THREE.Vector3(-0.42, 0.78, 0.46).normalize();
    this.skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, uniforms: { t: { value: 0 }, day: { value: 0 } }, side: THREE.BackSide, depthWrite: false, fog: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), this.skyMat); this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    scene.add(this.sky);
    this.buildEnvMap();
    this.setMode('exposicao');
  }
  // reflexos: uma "sala de exposição" escura com painéis de luz quentes e o céu frio
  buildEnvMap() {
    const r = this.e.renderer; const pm = new THREE.PMREMGenerator(r);
    const room = new THREE.Scene();
    room.background = new THREE.Color(0x0b0f1a);
    const box = new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: 0x141a28, side: THREE.BackSide }));
    room.add(box);
    const panel = (w, h, x, y, z, col, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); room.add(m); };
    panel(22, 8, -12, 12, 16, 0xffd4a0, 3.2);
    panel(14, 6, 18, 10, 8, 0xffe8c8, 2.0);
    panel(40, 12, 0, 14, -26, 0x5a9ad8, 1.1);
    panel(30, 6, 0, 14.9, 0, 0x3fd6a8, 0.6);
    this.envTex = pm.fromScene(room, 0.03).texture;
    this.e.scene.environment = this.envTex;
    this.e.scene.environmentIntensity = 0.75;
    pm.dispose();
  }
  setMode(m) {
    this.mode = m;
    const P = this.e.params;
    if (m === 'dia') {
      this.key.color.set(0xfff1dc); this.key.intensity = 3.4; this.hemi.color.set(0xbcd8ff); this.hemi.groundColor.set(0x5a4a38); this.hemi.intensity = 1.0;
      this.rim.intensity = 0.4; this.skyMat.uniforms.day.value = 1; setNight(0.05); P.exposure = 0.95; P.bloomStrength = 0.45; this.keyDir.set(-0.35, 0.86, 0.36).normalize();
      this.e.scene.environmentIntensity = 1.0;
    } else if (m === 'noite') {
      this.key.color.set(0x9fb8ff); this.key.intensity = 0.55; this.hemi.color.set(0x3d5a8a); this.hemi.groundColor.set(0x1a140e); this.hemi.intensity = 0.35;
      this.rim.intensity = 0.7; this.skyMat.uniforms.day.value = 0; setNight(1); P.exposure = 1.25; P.bloomStrength = 1.25; this.keyDir.set(0.3, 0.8, -0.5).normalize();
      this.e.scene.environmentIntensity = 0.45;
    } else { // exposição: como na foto — maquete iluminada por refletores quentes sob o céu com aurora
      this.key.color.set(0xffd6a6); this.key.intensity = 2.6; this.hemi.color.set(0x7fa0d8); this.hemi.groundColor.set(0x3a2a1c); this.hemi.intensity = 0.62;
      this.rim.intensity = 0.55; this.skyMat.uniforms.day.value = 0; setNight(1); P.exposure = 1.22; P.bloomStrength = 0.9; this.keyDir.set(-0.42, 0.78, 0.46).normalize();
      this.e.scene.environmentIntensity = 0.75;
    }
    this.e.shadowDirty = true;
  }
  // a sombra acompanha o ponto de interesse da câmera para manter a resolução alta
  update(t, target, viewSize) {
    this.skyMat.uniforms.t.value = t / 1000;
    const span = clamp(viewSize, 10, 90);
    const sc = this.key.shadow.camera; const half = span * 0.62;
    if (Math.abs(sc.right - half) > 0.5) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); this.e.shadowDirty = true; }
    // encaixa o alvo da sombra na grade de texels (evita tremulação)
    const tex = (half * 2) / this.key.shadow.mapSize.x; const tx = Math.round(target.x / tex) * tex, tz = Math.round(target.z / tex) * tex;
    const k = this.key; if (k.target.position.x !== tx || k.target.position.z !== tz) {
      k.target.position.set(tx, 0, tz); k.position.set(tx + this.keyDir.x * 60, this.keyDir.y * 60, tz + this.keyDir.z * 60); k.target.updateMatrixWorld(); this.e.shadowDirty = true;
    }
    this.sky.position.copy(this.e.camera.position);
  }
  setShadowSize(n) { const s = this.key.shadow; if (!n) { this.key.castShadow = false; return; } this.key.castShadow = true; if (s.mapSize.x !== n) { s.mapSize.set(n, n); if (s.map) { s.map.dispose(); s.map = null; } } }
}
