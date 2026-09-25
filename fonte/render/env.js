// Ambiente: ciclo de dia e noite no estilo do SimCity BuildIt. Sol em arco (leste → oeste) que à noite dá lugar
// a uma lua fria e alta; céu em gradiente com disco do sol, nuvens, lua e estrelas; neblina com a cor do
// horizonte; reflexos de um céu ao ar livre (céu, sol e chão verde) refeitos só quando o dia muda de faixa, com
// um tom contínuo por cima (sem degraus); gradação e bloom por hora; janelas, postes e passarelas acendendo.
// A sombra acompanha o ponto de interesse da câmera com histerese; com o sol andando, ela é refeita no máximo a
// cada ~2 s, e só quando a luz girou mais de ~0,5°.
//
// Contrato com a interface (chamado com ?.):
//   env.setCiclo('acelerado'|'relogio'|'dia'), env.ciclo, env.hora (0..24), env.fase ('amanhecer'|'dia'|'entardecer'|'noite'),
//   env.setHora(h) (fixa e pausa; setCiclo volta a andar). env.setMode é só um apelido antigo ('dia', 'noite').
import * as THREE from 'three';
import { setNight, AGUA } from './materials.js';
import { HAO_U } from './hao.js';
import { clamp } from '../core/util.js';
import { amostrar, luzPrincipal, dirSol, dirLua, faseDe, I, N_PARAM, FRONTEIRAS } from './ciclo.js';
import { tex } from './textures.js';

const SKY_V = /* glsl */`varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_F = /* glsl */`
  uniform float t; uniform vec3 zen; uniform vec3 hor; uniform vec3 baixo; uniform vec3 solDir; uniform vec3 solCor; uniform float solK; uniform float solDisco;
  uniform vec3 luaDir; uniform float lua; uniform float estrelas; uniform float nuvens; uniform vec3 nuvemCor; uniform vec3 nuvemSombra; uniform float cidade;
  varying vec3 vDir;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  void main(){
    vec3 d = normalize(vDir); float y = d.y;
    // gradiente do horizonte ao zênite; abaixo do horizonte, o tom do chão distante
    vec3 col = mix(hor, zen, pow(clamp(y, 0.0, 1.0), 0.55));
    col = mix(col, baixo, smoothstep(0.0, -0.22, y));
    // brilho do sol: halo, faixa no horizonte do lado do sol (forte com o sol baixo) e disco
    float cs = dot(d, solDir);
    vec2 dh = normalize(d.xz + vec2(1e-5)), sh = normalize(solDir.xz + vec2(1e-5));
    float halo = pow(max(cs, 0.0), 5.0) * 0.45 + pow(max(cs, 0.0), 42.0) * 0.9;
    float faixa = pow(dot(dh, sh) * 0.5 + 0.5, 4.0) * exp(-max(y, 0.0) * 5.0) * (1.0 - smoothstep(0.05, 0.45, solDir.y));
    col += solCor * solK * (halo + faixa);
    col += solCor * solDisco * 6.0 * smoothstep(0.99935, 0.9996, cs);
    // brilho quente da cidade no horizonte (noite), lua com halo frio e estrelas
    col += vec3(1.0, 0.6, 0.28) * cidade * 0.05 * exp(-abs(y) * 9.0);
    float cl = dot(d, luaDir);
    col += vec3(0.85, 0.9, 1.0) * lua * (smoothstep(0.99955, 0.9998, cl) * 2.5 + pow(max(cl, 0.0), 300.0) * 0.25);
    if (estrelas > 0.001) { float u = atan(d.x, d.z) * 0.15915494; vec2 sp = vec2(mod(floor(u * 565.0), 565.0), floor(y * 260.0)); float s = h(sp), s2 = h(sp + 17.31);
      col += vec3(step(0.9975, s) * pow(s2, 8.0) * (0.6 + 0.4 * sin(t * 1.7 + s * 90.0)) * smoothstep(0.05, 0.25, y)) * 2.5 * estrelas; }
    // nuvens: ruído projetado num teto, andando devagar; mais claras no miolo e do lado do sol
    if (nuvens > 0.001 && y > 0.0) {
      vec2 p = d.xz / (y + 0.1) * 0.7 + vec2(t * 0.004, t * 0.0016);
      float n = fbm(p); float c = smoothstep(0.5, 0.74, n) * smoothstep(0.02, 0.2, y);
      vec3 cc = mix(nuvemSombra, nuvemCor, 0.45 + 0.55 * smoothstep(0.52, 0.85, n)) + solCor * solK * halo * 0.35;
      col = mix(col, cc, c * nuvens);
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

const ENV_TAM = 64;                          // cubo dos reflexos: o céu é liso, 64 basta
const COS_SOMBRA = Math.cos(0.5 * Math.PI / 180), INTERVALO_SOMBRA = 2000; // sombra: > 0,5° e no máximo a cada 2 s
const CICLOS = ['acelerado', 'relogio', 'dia'];
const HORA_DIA = 11.5;                       // 'dia': sempre dia, com o sol alto à esquerda
const HORA_INICIO = 10;                      // o jogo abre de manhã, com o dia claro
// faixas do dia para os reflexos (as fronteiras são as dos quadros-chave): o céu dos reflexos é o do meio da faixa
const FAIXAS = FRONTEIRAS;
const faixaDe = (h) => { let k = 0; while (k < FAIXAS.length && h >= FAIXAS[k]) k++; return k % FAIXAS.length; }; // 0 = noite (19,7 → 4,4)
const meioDaFaixa = (k) => { const a = FAIXAS[(k + FAIXAS.length - 1) % FAIXAS.length], b = FAIXAS[k % FAIXAS.length]; const l = ((b - a) % 24 + 24) % 24; return (a + l / 2) % 24; };

export class Environment {
  constructor(engine) {
    this.e = engine; const scene = engine.scene;
    this.mode = 'ciclo'; this._ciclo = 'acelerado'; this._hora = HORA_INICIO; this._pausa = false; this._ref = { t: Date.now(), h: HORA_INICIO };
    this.V = new Float32Array(N_PARAM); this._Venv = new Float32Array(N_PARAM); this._info = { lua: false, el: 0 };
    this.noite = 0;                             // 0 dia … 1 noite (janelas, postes, aves): lido por quem precisa
    this.ajuste = null;                         // testes: { exp, sat, con, key, hemi, envi, bloom, vin } multiplicam os da hora
    // luzes
    this.hemi = new THREE.HemisphereLight(0xa9d4ff, 0x8aa860, 1.1); scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xfff3de, 3.3); this.key.castShadow = true;
    const s = this.key.shadow; s.mapSize.set(2048, 2048); s.bias = -0.00025; s.normalBias = 0.035; s.radius = 2.5; s.camera.near = 1; s.camera.far = 160;
    scene.add(this.key); scene.add(this.key.target);
    this.rim = new THREE.DirectionalLight(0xa9d4ff, 0.22); this.rim.position.set(20, 30, -40); scene.add(this.rim); // contraluz suave do céu
    this.keyDir = new THREE.Vector3(-0.38, 0.86, 0.32).normalize(); engine.keyDir = this.keyDir; // direção da luz (a obra desloca sombras de contato por ela)
    this._dirSombra = this.keyDir.clone(); this._tSombra = -1e9; this._sc = { x: 0, z: 0, ok: false };
    this.solDir = new THREE.Vector3(); this.luaDir = new THREE.Vector3(); this._d = new THREE.Vector3();
    // céu (desenhado por último entre os opacos: só onde nada cobre, então custa quase nada na vista de cima)
    const U = (v) => ({ value: v });
    this.skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { t: U(0), zen: U(new THREE.Color()), hor: U(new THREE.Color()), baixo: U(new THREE.Color()), solDir: U(new THREE.Vector3(0, 1, 0)), solCor: U(new THREE.Color()), solK: U(0), solDisco: U(1),
        luaDir: U(new THREE.Vector3(0, 1, 0)), lua: U(0), estrelas: U(0), nuvens: U(0.55), nuvemCor: U(new THREE.Color(1, 1, 1)), nuvemSombra: U(new THREE.Color(0.7, 0.75, 0.85)), cidade: U(0) } });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), this.skyMat); this.sky.frustumCulled = false; this.sky.renderOrder = 1e4; this.sky.userData.semHAO = true; this.sky.name = 'ceu';
    scene.add(this.sky);
    // neblina (a cor é o horizonte do céu: o terreno distante some no céu)
    scene.fog = new THREE.Fog(0xd2e8fa, 115, 470);
    // cores atuais que outros módulos leem (nuvens dos arredores)
    this.cores = { nuvem: new THREE.Color(1, 1, 1), nuvemSombra: new THREE.Color(0.7, 0.75, 0.85) };
    this._prepEnv();
    HAO_U.tNuvemSombra.value = tex.macro(); // ruído suave sem emenda (o da macro-variação) para as sombras das nuvens
    this.U = HAO_U;                             // uniformes compartilhados com os materiais (oclusão, tom do céu, recorte, nuvens): para ajuste
    this._forcar = true;
  }
  // ---------------------------------------------------------------- API do ciclo
  get ciclo() { return this._ciclo; }
  get hora() { return this._hora; }
  get fase() { return faseDe(this._hora); }
  // 'acelerado': 1 min real = 1 h de jogo (continua da hora atual); 'relogio': hora do aparelho; 'dia': sempre dia
  setCiclo(m) {
    if (!CICLOS.includes(m)) m = 'acelerado';
    this._ciclo = m; this._pausa = false;
    if (m === 'dia') this._hora = HORA_DIA; else if (m === 'relogio') this._hora = this._relogio();
    this._ref.t = Date.now(); this._ref.h = this._hora; this._forcar = true; this.e.acordar?.(600);
    return m;
  }
  // fixa uma hora e pausa o ciclo (setCiclo volta a andar)
  setHora(h) { h = +h; if (!isFinite(h)) return; this._hora = ((h % 24) + 24) % 24; this._pausa = true; this._forcar = true; this.e.acordar?.(600); }
  _relogio() { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; }
  // apelido da interface antiga: 'dia' = ciclo sempre dia; 'noite' = ciclo parado às 22 h; o resto é o ciclo
  setMode(m) { if (m === 'dia') this.setCiclo('dia'); else if (m === 'noite') this.setHora(22); return this.mode; }
  // ---------------------------------------------------------------- reflexos (PMREM)
  // Céu ao ar livre (gradiente, brilho do sol, lua, chão verde) renderizado num cubo e filtrado para os
  // reflexos só quando o dia muda de faixa; entre uma faixa e outra, o tom médio do céu corrige os reflexos
  // continuamente (HAO_U.ceuTint, no gancho dos materiais), então a troca não aparece.
  _prepEnv() {
    const r = this.e.renderer;
    this._pm = new THREE.PMREMGenerator(r);
    this._cubo = new THREE.WebGLCubeRenderTarget(ENV_TAM, { type: this.e.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, generateMipmaps: false });
    this._cubeCam = new THREE.CubeCamera(0.1, 200, this._cubo);
    this._envMat = this.skyMat.clone(); const EU = this._envMat.uniforms; EU.nuvens.value = 0; EU.estrelas.value = 0; EU.solDisco.value = 0;
    this._envCena = new THREE.Scene(); this._envCena.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), this._envMat));
    this._envRT = null; this._faixaEnv = -1; this._eGen = new THREE.Vector3(1, 1, 1); this._eCur = new THREE.Vector3(); this._solEnv = new THREE.Vector3(); this._luaEnv = new THREE.Vector3();
    this.stats = { reflexos: 0 };
  }
  // irradiância média aproximada de uma superfície virada para cima (zênite, horizonte, chão e brilho do sol)
  _media(V, out) {
    for (let j = 0; j < 3; j++) out.setComponent(j, 0.42 * V[I.zen + j] + 0.38 * V[I.hor + j] + 0.12 * V[I.chaoH + j] * 0.8 + 0.2 * V[I.brilho + j] * V[I.brilhoK] + 0.02);
    return out;
  }
  _gerarEnv(faixa) {
    const h = meioDaFaixa(faixa), Ve = amostrar(h, this._Venv), EU = this._envMat.uniforms;
    dirSol(h, this._solEnv); dirLua(h, this._luaEnv);
    EU.zen.value.setRGB(Ve[I.zen], Ve[I.zen + 1], Ve[I.zen + 2]); EU.hor.value.setRGB(Ve[I.hor], Ve[I.hor + 1], Ve[I.hor + 2]);
    EU.baixo.value.setRGB(Ve[I.chaoH] * 0.8, Ve[I.chaoH + 1] * 0.8, Ve[I.chaoH + 2] * 0.8); // chão verde (de dia) nos reflexos
    EU.solDir.value.copy(this._solEnv); EU.solCor.value.setRGB(Ve[I.brilho], Ve[I.brilho + 1], Ve[I.brilho + 2]); EU.solK.value = Ve[I.brilhoK] * 0.35; // halo fraco: o brilho do sol na água e no vidro já vem da luz principal
    EU.luaDir.value.copy(this._luaEnv); EU.lua.value = Ve[I.lua] * 0.5; EU.cidade.value = Ve[I.cidade] * 6;
    this._media(Ve, this._eGen); this._faixaEnv = faixa;
    const r = this.e.renderer;
    try { this._cubeCam.update(r, this._envCena); this._envRT = this._pm.fromCubemap(this._cubo.texture, this._envRT); this.e.scene.environment = this._envRT.texture; this.stats.reflexos++; } catch (e) { console.warn('reflexos:', e.message); }
  }
  // ---------------------------------------------------------------- quadro a quadro
  _aplicar(V, agora) {
    const e = this.e, P = e.params, s = this.key.shadow, U = this.skyMat.uniforms;
    // luz principal: sol ou lua (intensidade zero na troca), direção contínua; sombra em degraus de 0,5°
    const k = luzPrincipal(this._hora, this._d, this._info);
    this.keyDir.copy(this._d);
    this.key.color.setRGB(V[I.luz], V[I.luz + 1], V[I.luz + 2]); this.key.intensity = V[I.luzK] * k; s.intensity = V[I.sombra];
    this.hemi.color.setRGB(V[I.ceuH], V[I.ceuH + 1], V[I.ceuH + 2]); this.hemi.groundColor.setRGB(V[I.chaoH], V[I.chaoH + 1], V[I.chaoH + 2]); this.hemi.intensity = V[I.hemi];
    this.rim.color.setRGB(V[I.ceuH], V[I.ceuH + 1], V[I.ceuH + 2]);
    e.scene.environmentIntensity = V[I.env];
    const f = e.scene.fog; f.color.setRGB(V[I.hor], V[I.hor + 1], V[I.hor + 2]); f.near = V[I.nevoaPerto]; f.far = V[I.nevoaLonge];
    // céu
    const elSol = dirSol(this._hora, this.solDir); dirLua(this._hora, this.luaDir);
    U.zen.value.setRGB(V[I.zen], V[I.zen + 1], V[I.zen + 2]); U.hor.value.copy(f.color); U.baixo.value.setRGB(V[I.baixo], V[I.baixo + 1], V[I.baixo + 2]);
    U.solDir.value.copy(this.solDir); U.solCor.value.setRGB(V[I.brilho], V[I.brilho + 1], V[I.brilho + 2]); U.solK.value = V[I.brilhoK]; U.solDisco.value = clamp((elSol * 180 / Math.PI + 3) / 4, 0, 1);
    U.luaDir.value.copy(this.luaDir); U.lua.value = V[I.lua]; U.estrelas.value = V[I.estrelas]; U.cidade.value = V[I.cidade];
    U.nuvemCor.value.setRGB(V[I.nuvem], V[I.nuvem + 1], V[I.nuvem + 2]); U.nuvemSombra.value.setRGB(V[I.nuvemSombra], V[I.nuvemSombra + 1], V[I.nuvemSombra + 2]);
    this.cores.nuvem.copy(U.nuvemCor.value); this.cores.nuvemSombra.copy(U.nuvemSombra.value);
    // gradação e bloom
    P.exposure = V[I.exposure]; P.saturation = V[I.saturation]; P.contrast = V[I.contrast]; P.vignette = V[I.vignette]; P.threshold = V[I.threshold]; P.bloomStrength = V[I.bloomStrength];
    P.wb.set(V[I.wb], V[I.wb + 1], V[I.wb + 2]); P.shadowTint.set(V[I.shadowTint], V[I.shadowTint + 1], V[I.shadowTint + 2]); P.highTint.set(V[I.highTint], V[I.highTint + 1], V[I.highTint + 2]);
    HAO_U.haoK.value = V[I.hao];
    HAO_U.rimCor.value.setRGB(V[I.rim] * V[I.rimK], V[I.rim + 1] * V[I.rimK], V[I.rim + 2] * V[I.rimK]); HAO_U.nuvemK.value = V[I.nuvK];
    const a = this.ajuste; // ajustes de teste pela URL (multiplicam os da hora)
    if (a) { P.exposure *= a.exp ?? 1; P.saturation *= a.sat ?? 1; P.contrast *= a.con ?? 1; P.bloomStrength *= a.bloom ?? 1; P.vignette *= a.vin ?? 1; this.key.intensity *= a.key ?? 1; this.hemi.intensity *= a.hemi ?? 1; e.scene.environmentIntensity *= a.envi ?? 1; }
    // luzes da cidade: janelas acendem prédio a prédio, postes e passarelas
    const n = V[I.noite]; if (Math.abs(n - this.noite) > 0.002 || this._forcar) { this.noite = n; e.noite = n; setNight(n, 0.1 * n); }
    e.modoLuz = n >= 0.5 ? 'noite' : 'dia';
    // reflexos: céu da faixa (refeito só na troca de faixa) e o tom contínuo por cima
    const fx = faixaDe(this._hora); if (fx !== this._faixaEnv) this._gerarEnv(fx);
    this._media(V, this._eCur); AGUA.noite.value = n; HAO_U.ceuTint.value.set(clamp(this._eCur.x / this._eGen.x, 0.2, 5), clamp(this._eCur.y / this._eGen.y, 0.2, 5), clamp(this._eCur.z / this._eGen.z, 0.2, 5));
    // sombra: refeita quando a luz girou mais de 0,5° (no máximo a cada 2 s) ou trocou de astro
    const troca = this._info.lua !== this._luaAntes; this._luaAntes = this._info.lua;
    if (this._forcar || troca || (this.keyDir.dot(this._dirSombra) < COS_SOMBRA && agora - this._tSombra >= INTERVALO_SOMBRA)) this._sombraJa();
  }
  _sombraJa() { this._dirSombra.copy(this.keyDir); this._tSombra = performance.now(); this._sc.ok = false; this.e.shadowDirty = true; }
  // A sombra acompanha o ponto de interesse da câmera: só recentra quando o alvo sai de 20% do quadro de
  // sombra, e o tamanho do quadro anda em degraus de 2^(1/4) (sem refazer a cada quadro).
  update(t, target, viewSize) {
    const agora = performance.now();
    this.skyMat.uniforms.t.value = t / 1000;
    // sombras das nuvens rolando com o vento (~1,2 unidade por segundo, para leste-nordeste)
    const NP = HAO_U.nuvemP.value; NP.x = (t / 1000) * 0.017 % 1; NP.y = (t / 1000) * 0.0065 % 1;
    if (!this._pausa) {
      if (this._ciclo === 'acelerado') this._hora = (((this._ref.h + (Date.now() - this._ref.t) / 60000) % 24) + 24) % 24;
      else if (this._ciclo === 'relogio') { // hora do aparelho: referência + tempo corrido (sem Date por quadro), ressincroniza a cada 10 min
        const dt = Date.now() - this._ref.t; if (dt > 600000 || dt < 0) { this._ref.t = Date.now(); this._ref.h = this._relogio(); }
        this._hora = (this._ref.h + (Date.now() - this._ref.t) / 3600000) % 24;
      } else this._hora = HORA_DIA;
    }
    if (this._forcar || this._hora !== this._horaAplicada) { amostrar(this._hora, this.V); this._aplicar(this.V, agora); this._horaAplicada = this._hora; this._forcar = false; }
    const s = this.key.shadow, sc = s.camera, C = this._sc;
    const span = clamp(viewSize, 10, 90);
    const half = Math.pow(2, Math.ceil(Math.log2(0.62 * span * 1.25) * 4) / 4);
    const tex = (half * 2) / s.mapSize.x;
    let suja = false;
    if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); suja = true; C.ok = false; }
    if (!C.ok || Math.hypot(target.x - C.x, target.z - C.z) > 0.2 * half) { C.x = Math.round(target.x / tex) * tex; C.z = Math.round(target.z / tex) * tex; C.ok = true; suja = true; } // encaixe na grade de texels
    // a luz anda todo quadro (sombreado contínuo); o mapa de sombra só é refeito quando suja
    const k = this.key, d = this.keyDir; k.target.position.set(C.x, 0, C.z); k.position.set(C.x + d.x * 60, d.y * 60, C.z + d.z * 60); k.target.updateMatrixWorld();
    this.rim.position.set(C.x - d.x * 40, 26, C.z - d.z * 40);
    // penumbra de ~0,14 unidade em mundo, qualquer que seja o zoom; viés normal de 0,9 texel
    s.radius = clamp(0.14 / tex, 1.5, 7); s.normalBias = 0.9 * tex;
    if (suja) { this.e.shadowDirty = true; this._dirSombra.copy(this.keyDir); this._tSombra = agora; }
    this.sky.position.copy(this.e.camera.position);
  }
  setShadowSize(n) { const s = this.key.shadow; if (!n) { this.key.castShadow = false; return; } this.key.castShadow = true; if (s.mapSize.x !== n) { s.mapSize.set(n, n); if (s.map) { s.map.dispose(); s.map = null; } this._sc.ok = false; } }
}
