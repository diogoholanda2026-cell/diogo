// Canteiro animado de cada etapa. A construção sobe por andares num plano de corte com tampa de seção
// (o prédio nunca parece oco): primeiro o esqueleto de concreto fresco, com a fôrma de madeira na borda,
// depois o acabamento com a luz de trabalho fria. O andaime fica sempre um lance acima do nível de
// trabalho, com diagonais, rodapé e tela; a grua faz o ciclo de içamento (pega na pilha, gira, pousa a
// carga na laje) com a carga balançando como pêndulo; o caminhão entra de ré no pátio e descarrega os
// materiais que o jogador entregou; os operários vão a postos no andaime, na laje e no pátio.
// Modos: subir (prédios), caminho (passarelas avançam do começo ao fim), plantio (itens um a um),
// caixas (animais chegam em caixas de transporte), terra (corte vertical com escavadeira), pavimento
// (terraplenagem e piso radial), draga (desassoreamento do lago), desmontar (canteiro desfeito peça por
// peça) e replantar (mudas que crescem até virar a mata).
// Custo: as peças de todos os canteiros ficam em poucas malhas instanciadas compartilhadas (treliça,
// caixas, cilindros, montes, luzes, sombras de contato, chão de obra, operários e partículas); cada
// canteiro só tem as 3 do andaime. Nada disso projeta no mapa de sombra: grua, caminhão e máquinas
// usam sombras de contato; o mapa só é refeito quando o corte sobe um degrau visível (até 2 por segundo).
import * as THREE from 'three';
import { M } from './materials.js';
import { Crowd } from './figuras.js';
import { canvasTex, tex } from './textures.js';
import { clamp, lerp, hash, inPoly, fatia, easeOutCubic, easeInCubic, easeInQuad, easeInOutCubic, easeInOutSine, easeOutBack, easeOutBounce } from '../core/util.js';
import { normals, FH } from './geom.js';
import { heightAt } from './ground.js';
import { descartar } from './descartar.js';
import { LOTES, AtividadeCanteiro } from './models/canteiro.js';
import { ITENS } from '../data/itens.js';
import { A, MESA } from '../data/planta.js';
import { PROJETOS, alvoEtapa } from '../data/obras.js';

const SEM_TL = typeof location !== 'undefined' && new URLSearchParams(location.search).has('semTimelapse');
const TAU = Math.PI * 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _c = new THREE.Color(), _fr = new THREE.Frustum(), _mf = new THREE.Matrix4(), _bx = new THREE.Box3(), _v = new THREE.Vector3();
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const chao = (x, z) => Math.max(heightAt(x, z), 0);
const angDif = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
const hstr = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
const rnd = (s) => { s.seed = (s.seed * 1664525 + 1013904223) | 0; return ((s.seed >>> 8) & 0xffff) / 65536; };

// ---------------------------------------------------------------- matrizes (sem alocar)
// caixa centrada, giro ry no eixo vertical
function mCaixa(x, y, z, sx, sy, sz, ry = 0) { _e.set(0, ry, 0); _q.setFromEuler(_e); return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); }
// peça de a até b (eixo Y da geometria ao longo de ab); sx é a espessura no eixo mais perto da vertical
// (peças deitadas) ou de x (em pé); centrada: geometria com a origem no meio
function mSeg(ax, ay, az, bx, by, bz, sx, sz, centrada = false) {
  _y.set(bx - ax, by - ay, bz - az); const L = _y.length() || 1e-6; _y.multiplyScalar(1 / L);
  if (Math.abs(_y.y) < 0.7) _x.set(0, 1, 0).addScaledVector(_y, -_y.y).normalize(); else _x.set(1, 0, 0).addScaledVector(_y, -_y.x).normalize();
  _z.crossVectors(_x, _y); const e = _m.elements;
  e[0] = _x.x * sx; e[1] = _x.y * sx; e[2] = _x.z * sx; e[3] = 0; e[4] = _y.x * L; e[5] = _y.y * L; e[6] = _y.z * L; e[7] = 0;
  e[8] = _z.x * sz; e[9] = _z.y * sz; e[10] = _z.z * sz; e[11] = 0;
  if (centrada) { e[12] = (ax + bx) / 2; e[13] = (ay + by) / 2; e[14] = (az + bz) / 2; } else { e[12] = ax; e[13] = ay; e[14] = az; } e[15] = 1;
  return _m;
}
// postes do andaime em cascata na montagem (450 ms do primeiro ao último, 300 ms cada, easeOutCubic)
function kPoloMontagem(i, A2) { return easeOutCubic(fatia(A2.kpTm - (450 * i) / Math.max(1, A2.polos.length - 1), 0, 300)); }
// alvo da próxima fase da grua (ângulo, raio do carrinho, altura do gancho)
function vaiPara(a, r, hy) { const pa = vaiPara.pa; pa.a = a; pa.r = r; pa.hy = hy; }
// cilindro centrado com o eixo em (dx,dy,dz), girado 'giro' em torno do próprio eixo
function mEixo(x, y, z, dx, dy, dz, diam, len, giro = 0) {
  _y.set(dx, dy, dz).normalize(); if (Math.abs(_y.y) < 0.9) _a.set(0, 1, 0); else _a.set(1, 0, 0);
  _x.crossVectors(_a, _y).normalize(); _z.crossVectors(_x, _y);
  if (giro) { const c = Math.cos(giro), s = Math.sin(giro); _b.copy(_x).multiplyScalar(c).addScaledVector(_z, s); _z.multiplyScalar(c).addScaledVector(_x, -s); _x.copy(_b); }
  const e = _m.elements; e[0] = _x.x * diam; e[1] = _x.y * diam; e[2] = _x.z * diam; e[3] = 0; e[4] = _y.x * len; e[5] = _y.y * len; e[6] = _y.z * len; e[7] = 0;
  e[8] = _z.x * diam; e[9] = _z.y * diam; e[10] = _z.z * diam; e[11] = 0; e[12] = x; e[13] = y; e[14] = z; e[15] = 1; return _m;
}
// altura do corte por andar: parado na laje (fração 'liga' do tempo de cada andar) e subindo no resto
function passoAndar(s, k, liga) { const n = k * s.nAnd; const f = n - Math.floor(n); return s.y0 + s.fh * (Math.floor(n) + (f < liga ? 0 : easeInOutSine((f - liga) / (1 - liga)))); }
// faixa deitada no chão de a até b (decalques: sombra da lança e do mastro)
function mChao(ax, az, bx, bz, y, w) { return mCaixa((ax + bx) / 2, y, (az + bz) / 2, Math.hypot(bx - ax, bz - az), 1, w, Math.atan2(-(bz - az), bx - ax)); }
const RODAS_X = [0.26, -0.08, -0.24], LADOS = [-1, 1], TIROS = [900, 1150, 1400];
const VISTA = [Math.sin(0.55), Math.cos(0.55)]; // de onde o jogador costuma olhar (giro da câmera de jogo)
// matriz de instância escalada k em torno de um pivô (sem mudar giro): src/dst Float32Array, offset o
function escalaPivo(src, so, dst, d, k, px, py, pz) {
  for (let i = 0; i < 12; i++) dst[d + i] = src[so + i] * (i % 4 === 3 ? 1 : k);
  dst[d + 12] = px + k * (src[so + 12] - px); dst[d + 13] = py + k * (src[so + 13] - py); dst[d + 14] = pz + k * (src[so + 14] - pz); dst[d + 15] = 1;
}

// ---------------------------------------------------------------- recursos compartilhados
let R = null;
function recursos() {
  if (R) return R;
  const G = {};
  G.caixa = new THREE.BoxGeometry(1, 1, 1);
  G.trel = new THREE.BoxGeometry(1, 1, 1); G.trel.translate(0, 0.5, 0);
  G.cil = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1);
  G.monte = new THREE.SphereGeometry(0.5, 12, 5, 0, TAU, 0, Math.PI / 2);
  G.luz = new THREE.OctahedronGeometry(0.5, 1);
  G.plano = new THREE.PlaneGeometry(1, 1); G.plano.rotateX(-Math.PI / 2);
  G.tela = new THREE.PlaneGeometry(1, 1); G.tela.translate(0.5, 0.5, 0);
  for (const g of Object.values(G)) g.userData.compartilhada = true;
  const lat = canvasTex('grua', 64, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#F2BF2A'; g.lineWidth = 7; g.strokeRect(3, 0, w - 6, h);
    g.lineWidth = 5; for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(3, y); g.lineTo(w - 3, y + 32); g.lineTo(3, y + 64); g.stroke(); g.beginPath(); g.moveTo(3, y); g.lineTo(w - 3, y); g.stroke(); }
  }, { aniso: 4 });
  // tela de proteção: malha de fios (metade cheia) com alpha-to-coverage: de longe fica translúcida, sem
  // virar parede verde, e deixa ver a obra atrás
  const rede = canvasTex('rede-obra', 32, 32, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < w; i += 4) { g.fillRect(i, 0, 2, h); g.fillRect(0, i + 1, w, 1); } }, { aniso: 2 }); rede.repeat.set(4, 5);
  const MT = {};
  // treliça da grua: a textura repete pelo comprimento da peça (escala Y da instância)
  MT.trel = new THREE.MeshStandardMaterial({ color: 0xffffff, map: lat, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.3 });
  MT.trel.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_INSTANCING\n  vMapUv.y *= length( instanceMatrix[ 1 ].xyz ) / 0.9;\n#endif'); };
  MT.trel.customProgramCacheKey = () => 'obraTrel';
  MT.caixa = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.05 });
  // cilindros: instância com vermelho > 1,5 vira o balão da betoneira (espiral laranja e branca pelo uv)
  MT.cil = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.1 });
  const LAR = new THREE.Color(0xe07a2e), BRA = new THREE.Color(0xf2f2f2);
  MT.cil.onBeforeCompile = (sh) => {
    sh.uniforms.uLar = { value: LAR }; sh.uniforms.uBra = { value: BRA };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vListra; varying vec2 vUvL;')
      .replace('#include <color_vertex>', '#include <color_vertex>\n  vListra = 0.0; vUvL = uv;\n#ifdef USE_INSTANCING_COLOR\n  if ( instanceColor.r > 1.5 ) { vListra = 1.0; vColor = vec4( 1.0 ); }\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vListra; varying vec2 vUvL; uniform vec3 uLar; uniform vec3 uBra;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  if ( vListra > 0.5 ) diffuseColor.rgb = mix( uLar, uBra, step( 0.5, fract( vUvL.x * 3.0 + vUvL.y * 1.4 ) ) );');
  };
  MT.cil.customProgramCacheKey = () => 'obraCil';
  MT.monte = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  MT.luz = new THREE.MeshBasicMaterial({ color: 0xffffff });
  MT.tela = new THREE.MeshStandardMaterial({ color: 0x2f8f7a, map: rede, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.9 });
  // sombra de contato: retângulo macio (veículos, lança e mastro da grua); o vermelho da instância é a força
  MT.sombra = new THREE.ShaderMaterial({ uniforms: { opac: { value: 0.3 } }, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: 'varying vec2 vUv; varying float vA; void main() { vUv = uv; vA = 1.0;\n#ifdef USE_INSTANCING_COLOR\n vA = instanceColor.r;\n#endif\n vec4 p = vec4( position, 1.0 );\n#ifdef USE_INSTANCING\n p = instanceMatrix * p;\n#endif\n gl_Position = projectionMatrix * modelViewMatrix * p; }',
    fragmentShader: 'uniform float opac; varying vec2 vUv; varying float vA; void main() { vec2 q = abs( vUv * 2.0 - 1.0 ); float a = ( 1.0 - smoothstep( 0.45, 1.0, q.x ) ) * ( 1.0 - smoothstep( 0.3, 1.0, q.y ) ); gl_FragColor = vec4( 0.0, 0.0, 0.0, a * opac * vA ); }' });
  // chão de obra: terra batida em coordenadas de mundo (casa com a terra do canteiro) e borda irregular;
  // instância: vermelho = opacidade, verde = forma (0 mancha, 1 faixa), azul = semente
  MT.chao = new THREE.MeshStandardMaterial({ color: 0xe8e0d6, map: tex.soil(), roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  MT.chao.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vChaoF; varying vec2 vChaoW;')
      .replace('#include <color_vertex>', '#include <color_vertex>\n  vChaoF = vec3( 1.0, 0.0, 0.0 );\n#ifdef USE_INSTANCING_COLOR\n  vChaoF = instanceColor; vColor = vec4( 1.0 );\n#endif')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  { vec4 cw = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\n  cw = instanceMatrix * cw;\n#endif\n  vChaoW = ( modelMatrix * cw ).xz; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vChaoF; varying vec2 vChaoW;')
      .replace('#include <map_fragment>', `diffuseColor *= texture2D( map, vChaoW * 0.35 );
        { vec2 q = vMapUv * 2.0 - 1.0; float sd = vChaoF.z * 6.283; float a;
          if ( vChaoF.y < 0.5 ) { float ang = atan( q.y, q.x ); float b = 0.8 + 0.09 * sin( ang * 5.0 + sd ) + 0.05 * sin( ang * 11.0 + sd * 2.0 ); a = 1.0 - smoothstep( b - 0.16, b, length( q ) ); }
          else { float b = 0.8 + 0.1 * sin( q.y * 7.0 + sd ); a = ( 1.0 - smoothstep( b - 0.2, b, abs( q.x ) ) ) * ( 1.0 - smoothstep( 0.75, 1.0, q.y ) ); }
          diffuseColor.a *= a * vChaoF.x; diffuseColor.rgb *= 0.88; }`);
  };
  MT.chao.customProgramCacheKey = () => 'obraChao';
  R = { G, MT };
  return R;
}
// cores (lineares) das peças
const COR = {
  amarelo: lin(0xf2bf2a), concreto: lin(0xa8a49b), escuro: lin(0x2a2f38), laranja: lin(0xee7f33), branco: lin(0xf0eee8), vidroC: lin(0x20262e), pneu: lin(0x1c1c1e),
  cacamba: lin(0xe8b22a), escav: lin(0xf0b429), palete: lin(0xc4a27a), viga: lin(0xb08a5a), saco: lin(0xd8d2c4), laje: lin(0x9a968e), vidro: lin(0xa9d8ee),
  aco: lin(0x6b7482), muda: lin(0x4e7a38), bandeja: lin(0x3a2e22), lodo: lin(0x4a3f2e), terra: lin(0x6e5e4e), forma: lin(0xb8864b), caixa: lin(0xc4a27a), cinza: lin(0x7c8088), tubo: lin(0x9ea4aa), tabua: lin(0xa88a5e),
};
// tipo de volume de cada material entregue (pilhas, carga da grua e do caminhão)
function tipoCarga(k) {
  if (/^(madeira|viga|trelica|deque|estante)$/.test(k)) return 'madeira';
  if (/^(cimento|concreto|brita|argila)$/.test(k)) return 'saco';
  if (/^(premoldado|bloco)$/.test(k)) return 'laje';
  if (/^(painel|duplo|cupula|acrilico|vidro|solar)$/.test(k)) return 'vidro';
  if (/^(perfil|conector|aco|no|guarda|cobre)$/.test(k)) return 'aco';
  if (/^(muda|grama|substrato|jardim|mudas)$/.test(k)) return 'muda';
  return 'caixote';
}
const ALT_CARGA = { madeira: 0.1, saco: 0.1, laje: 0.09, vidro: 0.17, aco: 0.08, muda: 0.07, caixote: 0.12 };

// ---------------------------------------------------------------- lote de instâncias reescrito a cada quadro
class Lote {
  constructor(geo, mat, max, o = {}) {
    const m = (this.mesh = new THREE.InstancedMesh(geo, mat, max)); m.count = 0; m.visible = false; m.castShadow = false; m.receiveShadow = o.recebe ?? true; m.frustumCulled = true; m.name = o.nome || 'obra';
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, _c.setRGB(1, 1, 1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage); m.renderOrder = o.ordem || 0; m.userData.semHAO = true;
    this.max = max; this.n = 0;
  }
  put(mt, cor, g, b) {
    if (this.n >= this.max) return -1; const i = this.n++; mt.toArray(this.mesh.instanceMatrix.array, i * 16); const a = this.mesh.instanceColor.array;
    if (cor === undefined) { a[i * 3] = a[i * 3 + 1] = a[i * 3 + 2] = 1; } else if (typeof cor === 'number') { a[i * 3] = cor; a[i * 3 + 1] = g; a[i * 3 + 2] = b; } else { a[i * 3] = cor[0]; a[i * 3 + 1] = cor[1]; a[i * 3 + 2] = cor[2]; }
    return i;
  }
  fim() {
    const m = this.mesh; m.count = this.n; m.visible = this.n > 0;
    if (this.n) { const a = m.instanceMatrix, c = m.instanceColor; a.clearUpdateRanges(); a.addUpdateRange(0, this.n * 16); a.needsUpdate = true; c.clearUpdateRanges(); c.addUpdateRange(0, this.n * 3); c.needsUpdate = true; }
    this.n = 0;
  }
}

// ---------------------------------------------------------------- partículas (poeira, confete, fogos, terra)
// Tudo no vertex shader a partir do instante de nascimento: a CPU só escreve quando uma rajada nasce.
const PV = /* glsl */`
  attribute vec3 aP0; attribute vec3 aV0; attribute vec4 aT; attribute vec3 aCor;
  uniform float uT; uniform float uEsc; uniform float uPR;
  varying vec3 vCor; varying float vA; varying float vTipo; varying float vAdd;
  void main() {
    float t = uT - aT.x; float vida = aT.y; float tipo = aT.w; vTipo = tipo; vCor = aCor; vAdd = 0.0;
    if ( t < 0.0 || t > vida ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); gl_PointSize = 0.0; vA = 0.0; return; }
    float u = t / vida; vec3 p; float px;
    if ( tipo < 0.5 ) { // poeira: sai devagar, abre de 0,15 a 0,6 e some
      float k = 1.0 - exp( -2.2 * t ); p = aP0 + aV0 * k / 2.2 + vec3( 0.0, 0.06 * t, 0.0 ); vA = 0.45 * ( 1.0 - u ) * smoothstep( 0.0, 0.08, u );
      vec4 mv = modelViewMatrix * vec4( p, 1.0 ); gl_Position = projectionMatrix * mv; gl_PointSize = mix( 0.3, 1.2, sqrt( u ) ) * aT.z * uEsc / -mv.z; return;
    } else if ( tipo < 2.5 ) { // confete (1) e estrela de fogos (2): arrasto e^(-1,6t) e gravidade -2,2 com velocidade terminal
      float k = 1.6; float d = ( 1.0 - exp( -k * t ) ) / k; p = aP0 + aV0 * d + vec3( 0.0, -2.2 * ( t / k - d / k ), 0.0 );
      if ( tipo < 1.5 ) { p.x += 0.04 * sin( t * 9.0 + aV0.z * 7.0 ); vA = 1.0 - smoothstep( 0.8, 1.0, u ); }
      else { vA = 1.0 - u * u; vAdd = 1.0; }
      px = 5.0 * aT.z * uPR * pow( 1.0 - u, 0.5 );
    } else if ( tipo < 3.5 ) { // rastro do foguete (sobe em 0,6 s)
      p = aP0 + aV0 * min( t, 0.6 ); vA = ( 1.0 - u ); vAdd = 1.0; px = 3.0 * uPR * ( 1.0 - u );
    } else { // torrões de terra e respingos: parábola curta
      p = aP0 + aV0 * t + vec3( 0.0, -2.4 * t * t, 0.0 ); vA = 1.0 - u; px = 2.5 * aT.z * uPR;
    }
    vec4 mv = modelViewMatrix * vec4( p, 1.0 ); gl_Position = projectionMatrix * mv; gl_PointSize = px;
  }`;
const PF = /* glsl */`
  varying vec3 vCor; varying float vA; varying float vTipo; varying float vAdd;
  void main() {
    vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot( q, q ); if ( r > 1.0 ) discard;
    float a = vA;
    if ( vTipo < 0.5 ) a *= 1.0 - smoothstep( 0.2, 1.0, r );
    else if ( vTipo > 1.5 && vTipo < 3.5 ) a *= 1.0 - smoothstep( 0.0, 1.0, r );
    vec3 c = vCor * ( vAdd > 0.5 ? 2.2 : 1.0 );
    gl_FragColor = vec4( c * a, a * ( 1.0 - vAdd ) ); // alfa pré-multiplicado: aditivo quando vAdd = 1
  }`;
class Pontos {
  constructor(max = 900) {
    const g = new THREE.BufferGeometry(); this.max = max; this.h = 0; this.fim = 0;
    const at = (n, k) => { const a = new THREE.BufferAttribute(new Float32Array(max * n), n); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); return a; };
    this.P0 = at(3, 'aP0'); this.V0 = at(3, 'aV0'); this.T = at(4, 'aT'); this.C = at(3, 'aCor'); g.setAttribute('position', this.P0);
    for (let i = 0; i < max; i++) this.T.array[i * 4] = -1e6;
    this.mat = new THREE.ShaderMaterial({ vertexShader: PV, fragmentShader: PF, uniforms: { uT: { value: 0 }, uEsc: { value: 400 }, uPR: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
    this.mesh = new THREE.Points(g, this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 6; this.mesh.name = 'obra-particulas'; this.mesh.userData.semHAO = true; g.userData.compartilhada = true;
    this._ini = -1; this._n = 0;
  }
  // uma partícula: origem, velocidade, nascimento (s), vida, tamanho, tipo, cor
  add(x, y, z, vx, vy, vz, t0, vida, tam, tipo, cor) {
    const i = this.h; this.h = (this.h + 1) % this.max; if (this._ini < 0) this._ini = i; this._n++;
    const P = this.P0.array, V = this.V0.array, T = this.T.array, C = this.C.array, j = i * 3;
    P[j] = x; P[j + 1] = y; P[j + 2] = z; V[j] = vx; V[j + 1] = vy; V[j + 2] = vz; T[i * 4] = t0; T[i * 4 + 1] = vida; T[i * 4 + 2] = tam; T[i * 4 + 3] = tipo; C[j] = cor[0]; C[j + 1] = cor[1]; C[j + 2] = cor[2];
    this.fim = Math.max(this.fim, t0 + vida);
  }
  // envia só o trecho escrito neste quadro (o anel pode dar a volta: aí vai tudo)
  enviar(tNow) {
    if (this._n) { const volta = this._ini + this._n > this.max; const o = volta ? 0 : this._ini, n = volta ? this.max : this._n;
      for (const [a, k] of [[this.P0, 3], [this.V0, 3], [this.T, 4], [this.C, 3]]) { a.clearUpdateRanges(); a.addUpdateRange(o * k, n * k); a.needsUpdate = true; } this._ini = -1; this._n = 0; }
    this.mat.uniforms.uT.value = tNow; this.mesh.visible = tNow < this.fim;
  }
}

// ---------------------------------------------------------------- corte (plano ou ao longo do caminho)
// clone do material com plano de corte que ENCADEIA os ganchos do original (macro-variação, água, HAO,
// vento, máscara de roupa) e a chave do programa; U: uniformes do canteiro (mudam sem recompilar)
function uniformes() {
  return { uCap: { value: new THREE.Color(0x8e8a84) }, uCapK: { value: 1 }, uEscuro: { value: 1 }, uEscuroW: { value: 0.12 }, uForma: { value: new THREE.Color(0xb8864b) }, uFormaK: { value: 0 }, uFormaW: { value: 0.03 },
    uFaixa: { value: new THREE.Color(0, 0, 0) }, uFaixaW: { value: 0.025 }, uVarre: { value: new THREE.Color(0, 0, 0) }, uVarreD: { value: -10 }, uBrilho: { value: new THREE.Color(0, 0, 0) },
    uArc: { value: Array.from({ length: 16 }, () => new THREE.Vector3()) }, uArcN: { value: 0 }, uArcS: { value: 0 }, uArcOff: { value: 0 } };
}
const FS_DECL = 'uniform vec3 uCap; uniform float uCapK; uniform float uEscuro; uniform float uEscuroW; uniform vec3 uForma; uniform float uFormaK; uniform float uFormaW; uniform vec3 uFaixa; uniform float uFaixaW; uniform vec3 uVarre; uniform float uVarreD; uniform vec3 uBrilho;';
const FS_DIST = `
  #if NUM_CLIPPING_PLANES > 0
    float cDist = clippingPlanes[ 0 ].w - dot( vClipPosition, clippingPlanes[ 0 ].xyz );
  #else
    float cDist = 1e3;
  #endif`;
function clipClone(base, modo, planos, U, tampaOk = true) {
  const m = base.clone(); m.clippingPlanes = planos; m.clipShadows = true; m.userData.base = base;
  const std = !!(base.isMeshStandardMaterial || base.isMeshLambertMaterial || base.isMeshPhongMaterial);
  const tampa = tampaOk && std && modo === 'clip' && base.side === THREE.FrontSide && !base.transparent && !(base.alphaTest > 0);
  if (tampa) m.side = THREE.DoubleSide;
  const chave = '|obra-' + modo + (tampa ? 'T' : '') + (std ? '' : 'b');
  m.onBeforeCompile = function (sh, r) {
    base.onBeforeCompile.call(this, sh, r);
    if (modo === 'arco') { sh.uniforms.uArc = U.uArc; sh.uniforms.uArcN = U.uArcN; sh.uniforms.uArcS = U.uArcS; sh.uniforms.uArcOff = U.uArcOff; sh.uniforms.uForma = U.uForma; sh.uniforms.uFormaK = U.uFormaK;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObraW;').replace('#include <project_vertex>', '#include <project_vertex>\n  { vec4 ow = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\n  ow = instanceMatrix * ow;\n#endif\n  vObraW = ( modelMatrix * ow ).xyz; }');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObraW; uniform vec3 uArc[ 16 ]; uniform float uArcN; uniform float uArcS; uniform float uArcOff; uniform vec3 uForma; uniform float uFormaK;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float arcoBest = 1e9, arcoS = 0.0;
          for ( int i = 0; i < 15; i ++ ) { if ( float( i ) >= uArcN - 1.0 ) break; vec3 a = uArc[ i ], b = uArc[ i + 1 ]; vec2 ab = b.xy - a.xy;
            float tt = clamp( dot( vObraW.xz - a.xy, ab ) / max( dot( ab, ab ), 1e-6 ), 0.0, 1.0 ); vec2 dd = vObraW.xz - a.xy - ab * tt; float q = dot( dd, dd ); if ( q < arcoBest ) { arcoBest = q; arcoS = mix( a.z, b.z, tt ); } }
          float frente = uArcS + uArcOff - arcoS; if ( frente < 0.0 ) discard;`);
      if (std) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = mix( diffuseColor.rgb, uForma, uFormaK * ( 1.0 - step( 0.3, frente ) ) );');
      return;
    }
    if (!std) return;
    for (const k of ['uCap', 'uCapK', 'uEscuro', 'uEscuroW', 'uForma', 'uFormaK', 'uFormaW', 'uFaixa', 'uFaixaW', 'uVarre', 'uVarreD', 'uBrilho']) sh.uniforms[k] = U[k];
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FS_DECL)
      .replace('#include <color_fragment>', `#include <color_fragment>${FS_DIST}
        diffuseColor.rgb *= mix( uEscuro, 1.0, smoothstep( 0.0, uEscuroW, cDist ) );
        diffuseColor.rgb = mix( diffuseColor.rgb, uForma, uFormaK * ( 1.0 - step( uFormaW, cDist ) ) );`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uFaixa * ( 1.0 - smoothstep( 0.0, uFaixaW, cDist ) ) + uVarre * ( 1.0 - smoothstep( 0.0, 0.03, abs( cDist - uVarreD ) ) ) + uBrilho;`);
    if (tampa) sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  if ( ! gl_FrontFacing ) gl_FragColor.rgb = uCap * uCapK;');
  };
  m.customProgramCacheKey = function () { return base.customProgramCacheKey() + chave; };
  return m;
}

// ---------------------------------------------------------------- casco, contorno e caminhos
// Casco convexo do alvo no plano XZ: andaimes e operários abraçam prédios redondos em vez de seguir a
// caixa envolvente (que atravessaria os vizinhos).
function casco(obj) {
  const P = []; const v = new THREE.Vector3(); const mi = new THREE.Matrix4(); obj.updateWorldMatrix(true, true);
  obj.traverse((o) => {
    const pos = o.isMesh ? o.geometry?.attributes?.position : null; if (!pos) return;
    const n = o.isInstancedMesh ? o.count : 1; const step = Math.max(1, Math.floor(pos.count / (o.isInstancedMesh ? 24 : 1500)));
    for (let k = 0; k < n; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, mi); mi.premultiply(o.matrixWorld); } else mi.copy(o.matrixWorld);
      for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i).applyMatrix4(mi); P.push([v.x, v.z]); }
    }
  });
  if (P.length < 3) return null;
  P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const H = lo.slice(0, -1).concat(up.slice(0, -1)); if (H.length < 3) return null;
  let per = 0; for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return per > 2 ? H : null; // peças pequenas ficam com a caixa envolvente
}
// pontos a cada `passo` ao redor do casco, afastados `m` para fora: [x, z, nx, nz]
function redor(H, m, passo) {
  let cx = 0, cz = 0; for (const [x, z] of H) { cx += x; cz += z; } cx /= H.length; cz /= H.length;
  const out = []; let s = 0;
  for (let i = 0; i < H.length; i++) {
    const a = H[i], b = H[(i + 1) % H.length]; const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (L < 1e-6) continue;
    let nx = dz / L, nz = -dx / L; if (nx * (a[0] + b[0] - 2 * cx) + nz * (a[1] + b[1] - 2 * cz) < 0) { nx = -nx; nz = -nz; }
    for (; s < L; s += passo) out.push([a[0] + (dx * s) / L + nx * m, a[1] + (dz * s) / L + nz * m, nx, nz]);
    s -= L;
  }
  return out;
}
// polilinha reamostrada a cada `passo` com a normal: [x, z, nx, nz, s]
function reamostra(path, passo, o = 0, closed = false) {
  const nor = normals(path, closed); const out = []; let acc = 0, s = 0;
  for (let i = 0; i < path.length; i++) {
    if (i) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); acc += d; s += d; }
    if (i === 0 || acc >= passo || i === path.length - 1) { acc = 0; out.push([path[i][0] + nor[i][0] * o, path[i][1] + nor[i][1] * o, nor[i][0], nor[i][1], s]); }
  }
  return out;
}
const distCaixa = (x, z, b) => Math.hypot(Math.max(b.min.x - x, 0, x - b.max.x), Math.max(b.min.z - z, 0, z - b.max.z));

// modos antigos aceitos
const MODOS = { crescer: 'plantio', surgir: 'caixas', nivel: 'draga', reflorestar: 'replantar' };
const DUR_GRUA = [1.2, 1.8, 3.0, 1.5, 1.0, 1.2, 3.0, 1.3]; // pegar, içar, girar, baixar, soltar, subir, voltar, pausa (14 s)

export class Obras {
  constructor(engine) {
    this.e = engine; this.sites = new Map(); this.festas = []; this.ergue = []; this.group = new THREE.Group(); this.group.name = 'obras'; engine.scene.add(this.group);
    this.onTimelapse = null; this.onEvento = null; this.rig = null; this.stats = { sombras: 0, pedidos: 0 };
    this._tSombra = -1e9; this._pedeSombra = false; this._tl = 0; this._luz = null; this._tMartelo = 0;
    const { G, MT } = recursos();
    this.L = {
      trel: new Lote(G.trel, MT.trel, 96, { nome: 'obra-trelica' }), caixa: new Lote(G.caixa, MT.caixa, 1600, { nome: 'obra-caixas' }), cil: new Lote(G.cil, MT.cil, 320, { nome: 'obra-cilindros' }),
      monte: new Lote(G.monte, MT.monte, 400, { nome: 'obra-montes' }), luz: new Lote(G.luz, MT.luz, 96, { nome: 'obra-luzes', recebe: false }),
      sombra: new Lote(G.plano, MT.sombra, 160, { nome: 'obra-sombras', recebe: false, ordem: 1 }), chao: new Lote(G.plano, MT.chao, 320, { nome: 'obra-chao', ordem: 1 }),
    };
    this._lotes = Object.values(this.L); for (const l of this._lotes) this.group.add(l.mesh);
    this.crowd = new Crowd('operario', 160, { lod: true }); this.crowd.mesh.frustumCulled = true; this.crowd.perto.frustumCulled = true; this.group.add(this.crowd.mesh);
    this.pontos = new Pontos(); this.group.add(this.pontos.mesh);
    this._esfera = new THREE.Sphere(new THREE.Vector3(), 1); for (const l of Object.values(this.L)) l.mesh.boundingSphere = this._esfera; this.crowd.mesh.boundingSphere = this._esfera; this.crowd.perto.boundingSphere = this._esfera;
    this._andaimes = new THREE.Group(); this._andaimes.name = 'obra-andaimes'; this.group.add(this._andaimes);
  }
  get ativo() { return this.sites.size > 0 || this.festas.length > 0; }
  get timelapseAtivo() { for (const s of this.sites.values()) if (s.tl) return true; return false; }
  _evento(tipo, k, d) { try { this.onEvento?.(tipo, k, d); } catch (_) {} }

  // ================================================================ início
  // opts: { alvo, alvos (desmontar), esqueleto, modo, box, caminho:{path, closed, o, o0, o1}, grua, gruaPos, operarios,
  //         andaime, itens:[ids], obstaculos:[Box3], anim(p, s), nivelAgua(), floresta, poligono, centro, rig }
  iniciar(key, opts = {}) {
    if (this.sites.has(key)) this.remover(key);
    const modo = MODOS[opts.modo] || opts.modo || 'subir';
    const s = { key, opts, modo, estado: 'obra', p: clamp(opts.p ?? 0, 0, 1), pv: opts.p != null ? clamp(opts.p, 0, 1) : null, t: 0, tm: 0, tf: -1, trocas: [], sombras: [], clones: new Map(), ops: [], chao: [], seed: hstr(key) || 1, U: uniformes(), Usk: uniformes(), vel: 1, velOps: 1 };
    const alvo = opts.alvo || new THREE.Group(); s.alvo = alvo; s.vis0 = alvo.visible; // remover (sem concluir) devolve a visibilidade
    const box = opts.box ? opts.box.clone() : new THREE.Box3().setFromObject(alvo); if (box.isEmpty()) box.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
    s.box = box; s.y0 = box.min.y; s.y1 = box.max.y; s.H = Math.max(0.05, s.y1 - s.y0); s.cx = (box.min.x + box.max.x) / 2; s.cz = (box.min.z + box.max.z) / 2;
    s.nAnd = Math.max(1, Math.round(s.H / FH)); s.fh = s.H / s.nAnd; s.itens = (opts.itens && opts.itens.length ? opts.itens : ['concreto', 'viga', 'painel']).slice(0, 3);
    s.casco = !opts.caminho && ['subir', 'plantio', 'caixas'].includes(modo) ? casco(alvo) : null;
    s.hull = s.casco || [[box.min.x, box.min.z], [box.max.x, box.min.z], [box.max.x, box.max.z], [box.min.x, box.max.z]];
    s.raio = 0; for (const [x, z] of s.hull) s.raio = Math.max(s.raio, Math.hypot(x - s.cx, z - s.cz));
    s.wl = s.y0; s.skY = s.y0; s.hy = s.y0; s.hyS = -1e9; s.yb = Math.min(s.y0, 0);
    this.sites.set(key, s);
    // preparação por modo
    if (modo === 'subir') this._prepSubir(s);
    else if (modo === 'caminho') this._prepCaminho(s);
    else if (modo === 'plantio') this._prepPlantio(s);
    else if (modo === 'caixas') this._prepCaixas(s);
    else if (modo === 'terra' || modo === 'pavimento') this._prepTerra(s);
    else if (modo === 'draga') this._prepDraga(s);
    else if (modo === 'desmontar') this._prepDesmontar(s);
    else if (modo === 'replantar') this._prepReplantar(s);
    if (modo === 'subir') { this._cortes(s, s.p); if (s.and) s.and.Lv = clamp(Math.floor((Math.min(s.y1 + 0.2, s.wl + 0.42) - s.and.yb) / s.and.lift + 1e-4), 1, s.and.K); }
    // pátio, grua, caminhão, operários e chão
    this._patio(s);
    if (opts.grua && ['subir', 'caminho'].includes(modo)) this._prepGrua(s);
    this._prepCaminhao(s);
    this._prepOperarios(s);
    this._prepChao(s);
    this._limites(); this._pedirSombra(true);
    this.e.acordar?.(2200); this._evento('montagem', key);
    return s;
  }
  // ---------------------------------------------------------------- troca de materiais (corte)
  _cortar(s, raiz, planos, U, modo = 'clip', tag = '', tampa = true) {
    raiz.traverse((o) => {
      if (!(o.isMesh || o.isInstancedMesh) || !o.material) return;
      const troca = (m) => { const k = m.uuid + '|' + modo + '|' + tag; let c = s.clones.get(k); if (!c) { c = clipClone(m, modo, planos, U, tampa); s.clones.set(k, c); } return c; };
      s.trocas.push([o, o.material]); o.material = Array.isArray(o.material) ? o.material.map(troca) : troca(o.material);
      if (modo === 'arco' && o.castShadow) { s.sombras.push(o); o.castShadow = false; } // o descarte no shader não vale no mapa de sombra
    });
  }
  _restaurar(s) {
    for (const [o, m] of s.trocas) o.material = m; s.trocas.length = 0;
    for (const o of s.sombras) o.castShadow = true; s.sombras.length = 0;
    for (const c of s.clones.values()) c.dispose(); s.clones.clear();
    if (s.opts.esqueleto) s.opts.esqueleto.visible = false;
    if (s.itensP) this._plantioRestaurar(s);
    s.alvo.scale.y = 1;
  }
  // ---------------------------------------------------------------- subir
  _prepSubir(s) {
    const o = s.opts; s.plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), s.y0);
    const U = s.U; U.uCap.value.set(0xcfc7ba); U.uFaixa.value.setRGB(0, 0, 0);
    this._cortar(s, s.alvo, [s.plane], U, 'clip', 'fin'); s.alvo.visible = true;
    if (o.esqueleto) { s.skPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), s.y0); const K = s.Usk; K.uCap.value.set(0x8e8a84); K.uEscuro.value = 0.72; K.uFormaK.value = 1; o.esqueleto.visible = true; this._cortar(s, o.esqueleto, [s.skPlane], K, 'clip', 'esq'); }
    if (o.andaime !== false) this._prepAndaime(s);
  }
  // ---------------------------------------------------------------- caminho (passarelas e trechos lineares)
  _prepCaminho(s) {
    const o = s.opts; let pts = o.caminho?.path3 || null;
    if (!pts) { // sem caminho: o maior eixo do casco (ponte coberta)
      const H = casco(s.alvo) || s.hull; let best = 0, a = H[0], b = H[1] || H[0]; for (const p of H) for (const q of H) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > best) { best = d; a = p; b = q; } }
      pts = [[a[0], s.y1, a[1]], [b[0], s.y1, b[1]]];
    }
    // até 16 pontos (x, z, comprimento acumulado) para o shader
    const n = Math.min(16, pts.length), U = s.U; let acc = 0; s.arco = [];
    for (let i = 0; i < n; i++) { const j = Math.round((i * (pts.length - 1)) / Math.max(1, n - 1)); const p = pts[j]; if (i) { const q = s.arco[i - 1]; acc += Math.hypot(p[0] - q[0], p[2] - q[2]); } s.arco.push([p[0], p[1], p[2], acc]); U.uArc.value[i].set(p[0], p[2], acc); }
    U.uArcN.value = n; s.arcoL = acc || 1; U.uFormaK.value = 1;
    // pilares 0,6 à frente do tabuleiro; guarda-corpo e floreiras 0,3 atrás
    s.alvo.traverse((m) => { if (!m.isMesh && !m.isInstancedMesh) return; m.userData._obraOff = m.isInstancedMesh && m.material?.isMeshStandardMaterial && !m.material.transparent && m.geometry?.parameters?.openEnded ? 0.6 : m.material?.transparent || m.isInstancedMesh ? -0.3 : 0; });
    for (const off of [0.6, 0, -0.3]) {
      const Uo = off === 0 ? U : { ...U, uArcOff: { value: off } };
      const grupo = new THREE.Group(); // só para filtrar: troca material a material
      s.alvo.traverse((m) => { if ((m.isMesh || m.isInstancedMesh) && (m.userData._obraOff ?? 0) === off) grupo.children.push(m); });
      for (const m of grupo.children) this._cortar(s, m, [], Uo, 'arco', 'o' + off);
      grupo.children.length = 0;
    }
    s.alvo.visible = true; s.baixo = Math.max(...s.arco.map((p) => p[1] - chao(p[0], p[2]))) < 0.35;
  }
  // ---------------------------------------------------------------- plantio: itens um a um, pela distância à entrada
  _itens(raiz) {
    const lista = []; raiz.updateWorldMatrix(true, true);
    raiz.traverse((o) => {
      if (o.isInstancedMesh) { const b = o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, _m); _m.premultiply(o.matrixWorld); _p.setFromMatrixPosition(_m); lista.push({ im: o, i, x: _p.x, y: _p.y, z: _p.z, base: b.min.y }); } return; }
      if (!o.isMesh || o.parent?.isInstancedMesh) return;
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); _bx.copy(g.boundingBox).applyMatrix4(o.matrixWorld); _bx.getSize(_s);
      const grande = _s.x * _s.z > 1.5 && _s.y < 0.2; _bx.getCenter(_p);
      lista.push({ mesh: o, grande, x: _p.x, y: _bx.min.y, z: _p.z, cx: _p.x, cy: _bx.min.y, cz: _p.z });
    });
    return lista;
  }
  _prepPlantio(s, raiz = s.alvo) {
    const it = this._itens(raiz); const ent = this._entrada(s);
    const peq = it.filter((x) => !x.grande).sort((a, b) => Math.hypot(a.x - ent[0], a.z - ent[1]) - Math.hypot(b.x - ent[0], b.z - ent[1]));
    const N = Math.max(1, peq.length); peq.forEach((x, r) => { x.pi = 0.04 + (0.9 * (r + 0.5)) / N; x.tPop = -1; });
    // instanciadas: reordenadas pela vez de cada uma (count = quantas já apareceram); guardam o original
    const porIm = new Map(); for (const x of peq) if (x.im) { let l = porIm.get(x.im); if (!l) porIm.set(x.im, (l = [])); l.push(x); }
    s.itensP = { peq, ims: [], meshes: peq.filter((x) => x.mesh), grandes: it.filter((x) => x.grande) };
    for (const [im, l] of porIm) {
      l.sort((a, b) => a.pi - b.pi); const M0 = im.instanceMatrix.array.slice(), C0 = im.instanceColor ? im.instanceColor.array.slice() : null, n0 = im.count;
      const Ms = new Float32Array(l.length * 16), Cs = C0 ? new Float32Array(l.length * 3) : null;
      l.forEach((x, k) => { Ms.set(M0.subarray(x.i * 16, x.i * 16 + 16), k * 16); if (Cs) Cs.set(C0.subarray(x.i * 3, x.i * 3 + 3), k * 3); x.k = k; });
      im.instanceMatrix.array.set(Ms); if (Cs) im.instanceColor.array.set(Cs); im.instanceMatrix.needsUpdate = true; if (Cs) im.instanceColor.needsUpdate = true;
      s.itensP.ims.push({ im, l, M0, C0, n0, Ms }); im.count = 0;
    }
    for (const x of s.itensP.meshes) { x.v0 = x.mesh.visible; x.p0 = x.mesh.position.clone(); x.s0 = x.mesh.scale.clone(); x.mesh.visible = false; }
    // peças grandes e baixas (gramados, placas): varridas por um plano vertical da entrada para o fundo
    if (s.itensP.grandes.length) {
      _a.set(s.cx - ent[0], 0, s.cz - ent[1]).normalize(); if (_a.lengthSq() < 0.5) _a.set(1, 0, 0);
      let dmin = 1e9, dmax = -1e9; for (const [x, z] of s.hull) { const d = x * _a.x + z * _a.z; dmin = Math.min(dmin, d); dmax = Math.max(dmax, d); }
      s.varre = { n: _a.clone().negate(), d0: dmin - 0.05, d1: dmax + 0.05 }; s.plane = new THREE.Plane(s.varre.n, s.varre.d0);
      const U = s.U; U.uEscuro.value = 0.8; U.uEscuroW.value = 0.25; U.uCap.value.set(0x6e5e4e);
      for (const x of s.itensP.grandes) this._cortar(s, x.mesh, [s.plane], U, 'clip', 'gr', false);
    }
    raiz.visible = true;
  }
  _plantioRestaurar(s) {
    const P = s.itensP; if (!P) return;
    for (const g of P.ims) { g.im.instanceMatrix.array.set(g.M0); if (g.C0) g.im.instanceColor.array.set(g.C0); g.im.count = g.n0; g.im.instanceMatrix.needsUpdate = true; if (g.C0) g.im.instanceColor.needsUpdate = true; }
    for (const x of P.meshes) { x.mesh.visible = x.v0; x.mesh.position.copy(x.p0); x.mesh.scale.copy(x.s0); }
    s.itensP = null;
  }
  // entrada do canteiro (de onde vêm os materiais): o lado da caixa voltado para o canteiro de obras
  _entrada(s) { const dx = A.canteiro.c[0] - s.cx, dz = A.canteiro.c[1] - s.cz, d = Math.hypot(dx, dz) || 1; return [s.cx + (dx / d) * s.raio, s.cz + (dz / d) * s.raio]; }
  // ---------------------------------------------------------------- caixas de transporte (animais)
  _prepCaixas(s) {
    const bichos = []; const al = s.alvo; al.updateWorldMatrix(true, true);
    for (const md of al.userData.manadas || []) for (let i = 0; i < (md.a?.length || 0); i++) { const a = md.a[i]; const b = md.mesh.geometry.boundingBox; bichos.push({ md, i, x: a.x, z: a.z, tam: b ? Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * a.s : 0.4, s0: a.s }); }
    al.traverse((o) => { if (!o.isInstancedMesh || (al.userData.manadas || []).some((m) => m.mesh === o)) return; const b = o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, _m); _m.premultiply(o.matrixWorld); _p.setFromMatrixPosition(_m); const k = _s.setFromMatrixScale(_m).x; bichos.push({ im: o, i, x: _p.x, z: _p.z, tam: Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * k, M0: o.instanceMatrix.array.slice(i * 16, i * 16 + 16) }); } });
    const ent = this._entrada(s); bichos.sort((a, b) => Math.hypot(a.x - ent[0], a.z - ent[1]) - Math.hypot(b.x - ent[0], b.z - ent[1]));
    bichos.forEach((b, k) => { b.pi = 0.05 + (0.85 * (k + 0.5)) / bichos.length; b.tPop = -1; b.ang = hash(k, 3, s.seed) * TAU; b.w = clamp(b.tam * 0.8, 0.32, 0.62); b.y = chao(b.x, b.z); });
    s.bichos = bichos; al.visible = false;
  }
  // ---------------------------------------------------------------- terra e pavimento (corte vertical, escavadeira)
  _prepTerra(s) {
    s.plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), s.box.min.x - 0.01); const U = s.U; U.uEscuro.value = 0.6; U.uEscuroW.value = 0.35; U.uCap.value.set(0x5a4c3e);
    this._cortar(s, s.alvo, [s.plane], U, 'clip', 'terra', false); s.alvo.visible = true;
    s.escav = { x: s.box.min.x, z: s.cz, zb: s.cz, ciclo: rnd(s) * 4, giro: 0, b1: 0.4, b2: -1.0, b3: 0, h: 0 };
    // pontos do alvo (por x) para a máquina andar sobre o terreno cortado, e não no meio do lago
    const P = []; s.alvo.updateWorldMatrix(true, true); s.alvo.traverse((o) => { const pa = o.isMesh ? o.geometry?.attributes?.position : null; if (!pa) return; const st = Math.max(1, Math.floor(pa.count / 800)); for (let i = 0; i < pa.count; i += st) { _p.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); P.push(_p.x, _p.z); } });
    const ord = []; for (let i = 0; i < P.length; i += 2) ord.push(i); ord.sort((a, b) => P[a] - P[b]); s.terraPts = Float32Array.from(ord.flatMap((i) => [P[i], P[i + 1]]));
    if (s.modo === 'pavimento') this._prepPiso(s);
  }
  // piso da praça revelado do centro para fora (1 chamada só nesta obra)
  _prepPiso(s) {
    const poly = s.opts.poligono || s.hull; const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z))); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
    const c = s.opts.centro || [s.cx, s.cz]; let rMax = 0; for (const [x, z] of poly) rMax = Math.max(rMax, Math.hypot(x - c[0], z - c[1]));
    const U = { uC: { value: new THREE.Vector2(c[0], c[1]) }, uR: { value: 0 }, uBorda: { value: new THREE.Color(0x8c7a5e) } };
    const mat = new THREE.MeshStandardMaterial({ color: 0xd6d6e3, map: tex.pavers(), roughness: 0.86, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vPisoW;').replace('#include <project_vertex>', '#include <project_vertex>\n  vPisoW = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vPisoW; uniform vec2 uC; uniform float uR; uniform vec3 uBorda;')
        .replace('#include <map_fragment>', '{ float r = length( vPisoW - uC ); if ( r > uR ) discard; diffuseColor *= texture2D( map, vPisoW * 0.45 ); diffuseColor.rgb = mix( diffuseColor.rgb, uBorda, 1.0 - smoothstep( 0.0, 0.08, uR - r ) ); }');
    };
    mat.customProgramCacheKey = () => 'obraPiso'; mat.userData.base = M.pavers; // descartado junto com o canteiro
    const mesh = new THREE.Mesh(g, mat); mesh.position.y = 0.022; mesh.receiveShadow = true; mesh.name = 'obra-piso'; this.group.add(mesh);
    s.piso = { mesh, U, rMax: rMax + 0.1, c };
  }
  // ---------------------------------------------------------------- draga (desassoreamento do lago)
  _prepDraga(s) {
    const L = A.lago, il = A.ilha; let z0 = 1e9, z1 = -1e9; for (const [, z] of L) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    // faixas de norte a sul dentro do lago (0,7 da margem e fora da ilha), em zigue-zague
    const pts = []; let lado = 0;
    for (let z = z0 + 0.9; z < z1 - 0.6; z += 1.15) {
      const seg = []; let ini = null;
      for (let x = -9; x <= 10; x += 0.2) { const ok = inPoly(x, z, L) && inPoly(x - 0.7, z, L) && inPoly(x + 0.7, z, L) && inPoly(x, z - 0.6, L) && inPoly(x, z + 0.6, L) && Math.hypot(x - il.c[0], z - il.c[1]) > il.r + 0.7; if (ok && ini === null) ini = x; if (!ok && ini !== null) { seg.push([ini, x - 0.2]); ini = null; } }
      for (const [a, b] of lado ? seg.reverse() : seg) { if (b - a < 0.6) continue; pts.push(lado ? [b, z] : [a, z], lado ? [a, z] : [b, z]); }
      lado = 1 - lado;
    }
    if (pts.length < 2) pts.push([s.cx - 1, s.cz], [s.cx + 1, s.cz]);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    // saída do recalque: a margem voltada para o canteiro de obras; o lodo seca num monte na terra
    let best = null, bd = 1e9; for (const [x, z] of L) { const d = Math.hypot(x - A.canteiro.c[0], z - A.canteiro.c[1]); if (d < bd) { bd = d; best = [x, z]; } }
    let cx = 0, cz = 0; for (const [x, z] of L) { cx += x; cz += z; } cx /= L.length; cz /= L.length; const ox = best[0] - cx, oz = best[1] - cz, ol = Math.hypot(ox, oz) || 1;
    s.draga = { pts, cum, L: cum[cum.length - 1], saida: [best[0] + (ox / ol) * 0.35, best[1] + (oz / ol) * 0.35], monte: [best[0] + (ox / ol) * 1.5, best[1] + (oz / ol) * 1.5], dir: [ox / ol, oz / ol], x: pts[0][0], z: pts[0][1], h: 0, t: 0 };
    s.patioFixo = { x: s.draga.monte[0] + (oz / ol) * 1.2, z: s.draga.monte[1] - (ox / ol) * 1.2, ox: ox / ol, oz: oz / ol };
  }
  // ---------------------------------------------------------------- desmontar o canteiro
  _prepDesmontar(s) {
    const alvos = (s.opts.alvos || [s.alvo]).filter(Boolean); const ac = s.opts.acesso || [-19.6, 16.4];
    s.pecas = alvos.map((o) => { const b = new THREE.Box3().setFromObject(o); const c = b.getCenter(new THREE.Vector3()); return { o, b, x: c.x, z: c.z, y0: Math.min(b.min.y, 0) - 0.02, y1: b.max.y + 0.02, d: Math.hypot(c.x - ac[0], c.z - ac[1]) }; })
      .filter((p) => !p.b.isEmpty()).sort((a, b) => a.d - b.d);
    const N = s.pecas.length || 1;
    s.pecas.forEach((p, i) => { p.plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), p.y1); p.U = uniformes(); p.U.uCap.value.set(0x8e8a84); p.U.uEscuro.value = 0.8; p.U.uFormaK.value = 0; p.k0 = i / N; p.k1 = (i + 1) / N; this._cortar(s, p.o, [p.plane], p.U, 'clip', 'd' + i); p.o.visible = true; });
    s.alvo = s.pecas[0]?.o || s.alvo;
  }
  // ---------------------------------------------------------------- replantar: mudas em linhas que crescem até virar a mata
  _prepReplantar(s) {
    const F = s.opts.floresta; const src = F?.canteiro?.children?.find((o) => o.isInstancedMesh); if (!src) return;
    const n = src.count; const M0 = src.instanceMatrix.array; const im = new THREE.InstancedMesh(src.geometry, src.material, n); im.castShadow = false; im.receiveShadow = true;
    if (src.instanceColor) { im.setColorAt(0, _c.setRGB(1, 1, 1)); im.instanceColor.array.set(src.instanceColor.array.subarray(0, n * 3)); im.instanceColor.needsUpdate = true; }
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.boundingSphere = src.boundingSphere?.clone() || null; im.name = 'obra-mudas'; im.count = 0;
    // ordem de plantio: linhas de 0,56 (a malha da mata), em zigue-zague a partir da entrada
    const ord = []; for (let i = 0; i < n; i++) { const x = M0[i * 16 + 12], z = M0[i * 16 + 14]; const lin2 = Math.round(z / 0.56); ord.push({ i, x, z, y: chao(x, z), k: lin2 * 1000 + (lin2 % 2 ? -x : x) }); }
    ord.sort((a, b) => a.k - b.k); ord.forEach((o, r) => { o.pi = 0.04 + (0.8 * r) / n; o.tPop = -1; });
    s.muda = { im, ord, M0: M0.slice(0, n * 16), n }; s.mudaK = 0; this.group.add(im);
  }

  // ================================================================ pátio, grua, caminhão, operários e chão
  // lado mais livre: pontuação por distância aos vizinhos (outras obras, prédios do canteiro, caixas passadas),
  // fora do lago e da borda da mesa, com preferência pelo fundo (a grua não tapa o prédio na vista de jogo)
  _livre(s, x, z, ignora = null) {
    let d = 3; const ob = s.opts.obstaculos || [];
    for (const b of ob) d = Math.min(d, distCaixa(x, z, b));
    for (const o of this.sites.values()) { if (o === s || o === ignora) continue; d = Math.min(d, distCaixa(x, z, o.box)); if (o.grua) d = Math.min(d, Math.hypot(x - o.grua.x, z - o.grua.z) - 0.6); }
    for (const l of Object.values(LOTES)) d = Math.min(d, Math.hypot(x - l.x, z - l.z) - 1.2);
    let pen = 0; if (inPoly(x, z, A.lago)) pen += 4; if (x < MESA.x0 + 1 || x > MESA.x1 - 1 || z < MESA.z0 + 1 || z > MESA.z1 - 1) pen += 6;
    return d - pen;
  }
  // candidatos em volta da obra: [x, z, ox, oz, bônus] (ponto na borda e a direção para fora)
  _bordas(s) {
    if (s.arco) { const out = []; s.arco.forEach((p, i, arr) => { if (i % 2) return; const q = arr[Math.min(arr.length - 1, i + 1)], r = arr[Math.max(0, i - 1)]; const tx = q[0] - r[0], tz = q[2] - r[2], l = Math.hypot(tx, tz) || 1; for (const sg of LADOS) out.push([p[0], p[2], (sg * tz) / l, (-sg * tx) / l, i === 0 ? 1.2 : 0]); }); return out; }
    const out = []; for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, ox = Math.cos(a), oz = Math.sin(a); let sp = -1e9; for (const [x, z] of s.hull) sp = Math.max(sp, (x - s.cx) * ox + (z - s.cz) * oz); out.push([s.cx + ox * sp, s.cz + oz * sp, ox, oz, 0]); } return out;
  }
  // pátio (pilhas e caminhão): no lado mais livre e à vista da câmera de jogo
  _patio(s) {
    if (s.patioFixo) { const f = s.patioFixo; s.patio = { x: f.x, z: f.z, ox: f.ox, oz: f.oz, lx: -f.oz, lz: f.ox }; }
    else {
      let best = -1e9, B = null;
      for (const c of this._bordas(s)) { const [px, pz, ox, oz, bonus] = c; const x = px + ox * 1.3, z = pz + oz * 1.3; const sc = Math.min(this._livre(s, x, z), this._livre(s, x + ox * 0.9, z + oz * 0.9)) + 0.45 * (ox * VISTA[0] + oz * VISTA[1]) + bonus; if (sc > best) { best = sc; B = c; } }
      const [px, pz, ox, oz] = B; s.patio = { x: px + ox * 1.35, z: pz + oz * 1.35, ox, oz, lx: -oz, lz: ox };
    }
    // pilha: ao lado do pátio (a grua pega aqui); o estoque diminui com a obra
    s.pilha = { n: s.opts.novo === false ? Math.round(12 * (1 - 0.85 * s.p) * 0.7) : 0, cap: 12, pop: new Float32Array(12).fill(-1), x: s.patio.x + s.patio.lx * 0.55, z: s.patio.z + s.patio.lz * 0.55 };
  }
  // grua: a 1,2 da obra, perto o bastante da pilha (a lança alcança as duas), de preferência atrás
  // em relação à câmera (não tapa o prédio) e fora da rota do caminhão
  _prepGrua(s) {
    const P = s.patio, pl = s.pilha; let gx, gz;
    if (s.opts.gruaPos) [gx, gz] = s.opts.gruaPos;
    else {
      let best = -1e9; const ux = P.x + P.ox * 0.7, uz = P.z + P.oz * 0.7;
      for (const [px, pz, ox, oz] of this._bordas(s)) {
        const x = px + ox * 1.25, z = pz + oz * 1.25; const d = Math.hypot(x - pl.x, z - pl.z); if (d < 0.9 || d > 5.2) continue;
        const sc = this._livre(s, x, z) + 0.35 * -(ox * VISTA[0] + oz * VISTA[1]) - 0.15 * Math.abs(d - 2.4) - (Math.hypot(x - ux, z - uz) < 1.2 ? 3 : 0);
        if (sc > best) { best = sc; gx = x; gz = z; }
      }
      if (gx === undefined) { gx = P.x - P.lx * 0.55; gz = P.z - P.lz * 0.55; }
    }
    const gy = chao(gx, gz);
    let far = Math.hypot(pl.x - gx, pl.z - gz); const pts = s.arco ? s.arco.map((p) => [p[0], p[2]]) : s.hull; for (const [x, z] of pts) { const d = Math.hypot(x - gx, z - gz); if (d < 6.5) far = Math.max(far, d); }
    const jib = clamp(far + 0.4, 2.2, 6); const hm = Math.max(2.2, s.y1 - gy + 1.2);
    const aim = Math.atan2(-(s.cz - gz), s.cx - gx);
    s.grua = { x: gx, z: gz, y: gy, hm, jib, aim, a: aim, r: jib * 0.5, hy: gy + hm - 0.5, fase: 7, tf: 0, carga: false, cargaT: 'caixote', thx: 0, thz: 0, wx: 0, wz: 0, pvx: 0, pvz: 0, ax: 0, az: 0, px: null, pz: 0, k: 0, de: { a: aim, r: jib * 0.5, hy: gy + hm - 0.5 }, para: {} };
    this._gruaAlvo(s);
  }
  // novo ponto de pouso: casco a 60% do raio (ou um ponto do caminho) ao alcance da lança
  _gruaAlvo(s) {
    const g = s.grua; let x, z;
    for (let k = 0; k < 8; k++) {
      if (s.arco) { const p = s.arco[(rnd(s) * s.arco.length) | 0]; const f = Math.min(1, (s.U.uArcS.value + 0.2) / s.arcoL); const q = s.arco[Math.min(s.arco.length - 1, Math.round(f * (s.arco.length - 1)))]; x = lerp(p[0], q[0], 0.7); z = lerp(p[2], q[2], 0.7); }
      else { const h = s.hull[(rnd(s) * s.hull.length) | 0]; x = s.cx + (h[0] - s.cx) * 0.6; z = s.cz + (h[1] - s.cz) * 0.6; }
      if (Math.hypot(x - g.x, z - g.z) < g.jib - 0.15) break;
    }
    const d = Math.hypot(x - g.x, z - g.z); g.aDrop = Math.atan2(-(z - g.z), x - g.x); g.rDrop = clamp(d, 0.6, g.jib - 0.15);
    const p = s.pilha; g.aPick = Math.atan2(-(p.z - g.z), p.x - g.x); g.rPick = clamp(Math.hypot(p.x - g.x, p.z - g.z), 0.5, g.jib - 0.15);
  }
  _prepCaminhao(s) {
    const P = s.patio, tipo = s.modo === 'terra' || s.modo === 'pavimento' || s.modo === 'draga' || s.modo === 'desmontar' ? 'basculante' : 'plataforma';
    s.cam = { tipo, fase: 'fora', t: 7.5, x: 0, z: 0, h: 0, roda: 0, tambor: 0, carga: 0, enche: 0, ciclo: 0, vis: false, bascula: 0, curva: null, sentido: 1 };
    this._rotaCaminhao(s);
    // montagem: o primeiro chega junto com o canteiro, 2 u pela rota final, com a turma (obra que já
    // existia: o caminhão está em algum ponto do ciclo)
    const c = s.cam; if (s.opts.novo === false) { c.fase = 'fora'; c.t = rnd(s) * 8; return; } c.fase = 'chega'; c.t = 0; c.carga = tipo === 'plataforma' ? 3 : 0;
  }
  // rota: entra pela frente do pátio (ou pela direção 'dir' dada), faz a curva e dá ré até (ux, uz)
  _rotaCaminhao(s, ux, uz, dir = null) {
    const P0 = s.patio, c = s.cam; ux = ux ?? P0.x + P0.ox * 0.7 + P0.lx * 0.25; uz = uz ?? P0.z + P0.oz * 0.7 + P0.lz * 0.25;
    const P = dir ? { ox: dir[0], oz: dir[1], lx: -dir[1], lz: dir[0] } : P0;
    const V = (x, z) => new THREE.Vector3(x, 0, z);
    c.U = [ux, uz];
    c.entra = new THREE.CatmullRomCurve3([V(ux + P.ox * 3.6 + P.lx * 1.6, uz + P.oz * 3.6 + P.lz * 1.6), V(ux + P.ox * 2.0 + P.lx * 1.1, uz + P.oz * 2.0 + P.lz * 1.1), V(ux + P.ox * 0.9 + P.lx * 0.95, uz + P.oz * 0.9 + P.lz * 0.95)]);
    c.re = new THREE.CatmullRomCurve3([V(ux + P.ox * 0.9 + P.lx * 0.95, uz + P.oz * 0.9 + P.lz * 0.95), V(ux + P.ox * 0.55 + P.lx * 0.35, uz + P.oz * 0.55 + P.lz * 0.35), V(ux, uz)]);
    c.sai = new THREE.CatmullRomCurve3([V(ux, uz), V(ux + P.ox * 1.4 - P.lx * 0.2, uz + P.oz * 1.4 - P.lz * 0.2), V(ux + P.ox * 3.6 - P.lx * 1.4, uz + P.oz * 3.6 - P.lz * 1.4)]);
  }
  _prepOperarios(s) {
    const n = s.opts.operarios ?? 8; const P = s.patio; const C = this.crowd;
    const cats = ['mestre']; const resto = n - 1;
    const modos = s.modo === 'subir' ? [['andaime', 0.4], ['laje', 0.3], ['patio', 0.3]] : s.modo === 'draga' ? [['frente', 0.35], ['patio', 0.65]] : [['frente', 0.7], ['patio', 0.3]];
    for (const [c, f] of modos) for (let i = 0; i < Math.round(resto * f); i++) cats.push(c);
    while (cats.length < n) cats.push('patio');
    const faixa = s.opts.caminho && s.modo === 'subir' ? this._faixaOperarios(s) : null;
    cats.forEach((cat, i) => {
      const x0 = P.x + P.ox * 0.7 + (rnd(s) - 0.5) * 0.3, z0 = P.z + P.oz * 0.7 + (rnd(s) - 0.5) * 0.3; // descem do caminhão
      let w;
      if (faixa && cat !== 'mestre' && cat !== 'patio') { const L = faixa[i % faixa.length]; w = C.add(L, { speed: 0.1 + rnd(s) * 0.04, phase: rnd(s), trabalho: true, color: [1, 0.42, 0.08] }); if (!w) return; w.cat = 'faixa'; }
      else { w = C.add([[x0, chao(x0, z0), z0], [x0, chao(x0, z0), z0]], { speed: 0.1 + rnd(s) * 0.04, color: cat === 'mestre' ? [0.95, 0.95, 0.95] : [1, 0.42, 0.08] }); if (!w) return; w.cat = cat; w.x = x0; w.z = z0; w.y = chao(x0, z0); this._posto(s, w, true); if (s.opts.novo === false && w.posto) { w.x = w.posto.x; w.y = w.posto.y; w.z = w.posto.z; } }
      w.esc = s.opts.novo === false ? 1 : 0; w.nasce = 0.9 + i * 0.08; s.ops.push(w);
    });
  }
  // vai e vem dos operários nos módulos de fita: trechos do caminho no meio da laje, no nível de baixo
  _faixaOperarios(s) {
    const c = s.opts.caminho; const mid = c.o0 != null && c.o1 != null ? (c.o0 + c.o1) / 2 : c.o - 0.5; const pts = reamostra(c.path, 0.3, mid, c.closed);
    const y = s.y0 + 0.01; const out = []; const n = Math.max(1, Math.min(6, Math.floor(pts.length / 6)));
    for (let k = 0; k < n; k++) { const a = Math.floor((k * pts.length) / n), b = Math.min(pts.length - 1, a + Math.max(3, Math.floor(pts.length / n) - 1)); const L = []; for (let i = a; i <= b; i++) L.push([pts[i][0], y, pts[i][1]]); if (L.length > 1) out.push(L); }
    return out.length ? out : [[[s.cx, y, s.cz], [s.cx + 0.5, y, s.cz]]];
  }
  // próximo posto de um operário (andaime: baia vizinha; laje: ponto no casco encolhido; pátio: junto das pilhas)
  _posto(s, w, primeiro = false) {
    const C = this.crowd, P = s.patio; const dur = 2.5 + rnd(s) * 3.5;
    if (s.estado === 'pronta' || s.estado === 'fim') return;
    if (w.cat === 'mestre') { C.setPosto(w, [P.x + P.ox * 0.2 - P.lx * 0.5, chao(P.x, P.z), P.z + P.oz * 0.2 - P.lz * 0.5], 'parado', { olhar: [s.cx, s.cz], dur: 8 + rnd(s) * 6 }); return; }
    if (w.cat === 'andaime' && s.and) {
      const A2 = s.and, n = A2.pts.length; let b = w.baia ?? ((rnd(s) * n) | 0); if (!primeiro) b = A2.fechado ? (b + (rnd(s) < 0.5 ? -1 : 1) * (1 + ((rnd(s) * 3) | 0)) + n) % n : clamp(b + (rnd(s) < 0.5 ? -2 : 2), 0, n - 1); w.baia = b;
      const q = A2.pts[b]; C.setPosto(w, [q[0], this._yDeck(s), q[1]], 'trabalhar', { olhar: [s.cx, s.cz], dur }); return;
    }
    if (w.cat === 'laje' && s.modo === 'subir') {
      const h = s.hull[(rnd(s) * s.hull.length) | 0]; const dx = h[0] - s.cx, dz = h[1] - s.cz, d = Math.hypot(dx, dz) || 1; const u = rnd(s) * Math.max(0, (d - 0.35) / d);
      C.setPosto(w, [s.cx + dx * u, this._yLaje(s), s.cz + dz * u], 'trabalhar', { dur }); return;
    }
    if (w.cat === 'frente') { const f = this._frente(s, w); if (f) { C.setPosto(w, f, 'trabalhar', { olhar: f.olhar, dur: f.dur ?? dur }); return; } }
    // pátio: entre a pilha e o caminhão
    const a = rnd(s) * TAU, r = 0.25 + rnd(s) * 0.7; const x = (rnd(s) < 0.5 ? s.pilha.x : P.x) + Math.cos(a) * r, z = (rnd(s) < 0.5 ? s.pilha.z : P.z) + Math.sin(a) * r;
    C.setPosto(w, [x, chao(x, z), z], rnd(s) < 0.6 ? 'trabalhar' : 'parado', { olhar: [s.pilha.x, s.pilha.z], dur });
  }
  _yDeck(s) { const A2 = s.and; if (!A2) return s.y0; const L = Math.max(1, Math.min(A2.K, A2.Lv)); return A2.yb + L * A2.lift + 0.018; }
  // laje: no topo do corte visível (a tampa de seção), sem passar do prédio
  _yLaje(s) { const y = s.opts.esqueleto ? Math.max(s.skY, Math.min(s.hy, s.y1)) : s.hy; return clamp(y, s.y0, s.y1) + 0.005; }
  // postos da frente de trabalho de cada modo
  _frente(s, w) {
    const r = () => rnd(s) - 0.5;
    if (s.modo === 'caminho') { const f = Math.min(s.arcoL, s.U.uArcS.value); const q = this._noArco(s, f + r() * 0.4); return Object.assign([q[0] + r() * 0.3, q[1] + 0.012, q[2] + r() * 0.3], { olhar: [q[0], q[2]] }); }
    if (s.modo === 'plantio' || s.modo === 'caixas') { const L = s.itensP?.peq || s.bichos || []; const k = L.findIndex((x) => x.pi > s.pv); const x = L[k < 0 ? L.length - 1 : Math.min(L.length - 1, k + ((rnd(s) * 3) | 0))]; if (!x) return null; const a = rnd(s) * TAU; return Object.assign([x.x + Math.cos(a) * 0.22, chao(x.x, x.z), x.z + Math.sin(a) * 0.22], { olhar: [x.x, x.z] }); }
    if (s.modo === 'terra' || s.modo === 'pavimento') {
      if (s.modo === 'pavimento' && s.piso && s.pv > 0.4) { const a = rnd(s) * TAU, R2 = s.piso.U.uR.value + 0.1; const x = s.piso.c[0] + Math.cos(a) * R2, z = s.piso.c[1] + Math.sin(a) * R2; if (inPoly(x, z, s.opts.poligono || s.hull)) return Object.assign([x, 0.03, z], { olhar: [s.piso.c[0], s.piso.c[1]] }); }
      const fx = s.plane.constant; const z = s.box.min.z + rnd(s) * (s.box.max.z - s.box.min.z); return Object.assign([fx - 0.25 - rnd(s) * 0.5, chao(fx, z) + 0.02, z], { olhar: [fx + 1, z] });
    }
    if (s.modo === 'draga') { const m = s.draga.monte; const a = rnd(s) * TAU; return Object.assign([m[0] + Math.cos(a) * 0.9, chao(m[0], m[1]) + 0.01, m[1] + Math.sin(a) * 0.9], { olhar: [m[0], m[1]] }); }
    if (s.modo === 'desmontar') { const p = s.pecaAtual; if (!p) return null; const a = rnd(s) * TAU; const rx = (p.b.max.x - p.b.min.x) / 2 + 0.3, rz = (p.b.max.z - p.b.min.z) / 2 + 0.3; return Object.assign([p.x + Math.cos(a) * rx, 0.01, p.z + Math.sin(a) * rz], { olhar: [p.x, p.z] }); }
    if (s.modo === 'replantar' && s.muda?.ord.length) { const o = s.muda.ord; const k = clamp((s.mudaK | 0) + ((rnd(s) * 6) | 0), 0, o.length - 1); const t = o[k]; return Object.assign([t.x + 0.18, t.y + 0.01, t.z], { olhar: [t.x, t.z], dur: 1.6 + rnd(s) * 1.4 }); }
    return null;
  }
  _noArco(s, f, out = [0, 0, 0, 0]) { const P = s.arco; f = clamp(f, 0, s.arcoL); for (let i = 1; i < P.length; i++) if (P[i][3] >= f || i === P.length - 1) { const a = P[i - 1], b = P[i]; const t = clamp((f - a[3]) / (b[3] - a[3] || 1), 0, 1); out[0] = lerp(a[0], b[0], t); out[1] = lerp(a[1], b[1], t); out[2] = lerp(a[2], b[2], t); out[3] = Math.atan2(b[2] - a[2], b[0] - a[0]); return out; } out[0] = P[0][0]; out[1] = P[0][1]; out[2] = P[0][2]; out[3] = 0; return out; }
  // chão de obra: manchas de terra batida ao redor e um corredor até a entrada do caminhão
  _prepChao(s) {
    const L = []; const sd = (k) => hash(k, 5, s.seed);
    if (s.modo === 'subir' || s.modo === 'caixas' || s.modo === 'plantio') {
      const per = s.hull.reduce((a, p, i, H) => a + Math.hypot(p[0] - H[(i + 1) % H.length][0], p[1] - H[(i + 1) % H.length][1]), 0);
      if (s.opts.caminho) for (const [x, z, nx, nz] of reamostra(s.opts.caminho.path, 1.1, s.opts.caminho.o + 0.2, s.opts.caminho.closed)) L.push([x, z, 2.4, 1.5, Math.atan2(nx, nz), 0, sd(L.length)]);
      else if (per < 7) L.push([s.cx, s.cz, s.box.max.x - s.box.min.x + 2, s.box.max.z - s.box.min.z + 2, 0, 0, sd(0)]);
      else for (const [x, z, nx, nz] of redor(s.hull, 0.45, 1.1)) L.push([x, z, 2.4, 1.7, Math.atan2(nx, nz), 0, sd(L.length)]); // faixa contínua: manchas alongadas na tangente
    } else if (s.modo === 'caminho') for (const p of s.arco) L.push([p[0], p[2], 1.4, 1.4, 0, 0, sd(L.length)]);
    const P = s.patio; L.push([P.x + P.ox * 0.2, P.z + P.oz * 0.2, 2.8, 2.6, Math.atan2(-P.oz, P.ox), 0, sd(99)]);
    if (s.modo !== 'draga') L.push([P.x + P.ox * 2.6, P.z + P.oz * 2.6, 0.9, 5.2, Math.atan2(P.ox, P.oz) + Math.PI, 1, sd(98)]); // corredor (faixa ao longo da rota)
    s.chao = L;
  }

  // ================================================================ andaime
  _prepAndaime(s) {
    const o = s.opts; let pts, fechado = false;
    if (o.caminho) { pts = reamostra(o.caminho.path, 0.6, o.caminho.o, o.caminho.closed).map(([x, z, nx, nz]) => [x, z, nx, nz]); fechado = !!o.caminho.closed; }
    else if (s.casco) { pts = redor(s.casco, 0.3, 0.6); fechado = true; }
    else { const b = s.box, m = 0.3; const X0 = b.min.x - m, X1 = b.max.x + m, Z1 = b.max.z + m, Z0 = b.min.z - m; pts = []; const lado = (ax, az, bx, bz, nx, nz) => { const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 0.6)); for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, nx, nz]); }; lado(X0, Z1, X1, Z1, 0, 1); lado(X1, Z1, X1, Z0, 1, 0); lado(X1, Z0, X0, Z0, 0, -1); lado(X0, Z0, X0, Z1, -1, 0); fechado = true; }
    if (pts.length < 2) return;
    const yb = s.yb, lift = 0.42, K = Math.max(1, Math.ceil((s.y1 + 0.2 - yb) / lift)); const { G, MT } = recursos();
    const nb = fechado ? pts.length : pts.length - 1;
    const T = Array.from({ length: K + 1 }, () => []), B = Array.from({ length: K + 1 }, () => []);
    const f16 = () => Float32Array.from(_m.elements);
    for (let i = 0; i < nb; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05 || L > 1.4) continue;
      const nx = (a[2] + b[2]) / 2, nz = (a[3] + b[3]) / 2; const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      for (let k = 1; k <= K; k++) {
        const y = yb + k * lift; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        B[k].push(mCaixa(mx, y, mz, L + 0.02, 0.012, 0.15, ang) && f16());                                                     // tábuas do piso
        B[k].push(mCaixa(mx + nx * 0.085, y + 0.022, mz + nz * 0.085, L, 0.035, 0.008, ang) && f16());                         // rodapé
        T[k].push(mSeg(a[0] + a[2] * 0.09, y + 0.13, a[1] + a[3] * 0.09, b[0] + b[2] * 0.09, y + 0.13, b[1] + b[3] * 0.09, 0.018, 0.018, true) && f16()); // guarda-corpo
        if (i % 2 === 0 && k % 2 === 0) { // diagonais em X na face de fora, a cada 2 vãos e 2 lances
          const y0 = y - 2 * lift; T[k].push(mSeg(a[0] + a[2] * 0.09, y0, a[1] + a[3] * 0.09, b[0] + b[2] * 0.09, y, b[1] + b[3] * 0.09, 0.014, 0.014, true) && f16());
          T[k].push(mSeg(b[0] + b[2] * 0.09, y0, b[1] + b[3] * 0.09, a[0] + a[2] * 0.09, y, a[1] + a[3] * 0.09, 0.014, 0.014, true) && f16());
        }
      }
    }
    const polos = []; for (let i = 0; i < pts.length; i++) { const p = pts[i]; polos.push([p[0] - p[2] * 0.08, p[1] - p[3] * 0.08], [p[0] + p[2] * 0.09, p[1] + p[3] * 0.09]); }
    let nT = polos.length, nB = 0; for (let k = 1; k <= K; k++) { nT += T[k].length; nB += B[k].length; }
    // tubos (postes, guarda-corpos, diagonais) e tábuas numa malha só: caixas com a cor por instância e o
    // material das caixas compartilhadas (mesmo programa); a tela é a segunda malha do andaime
    const est = new THREE.InstancedMesh(G.caixa, MT.caixa, nT + Math.max(1, nB)), tela = new THREE.InstancedMesh(G.tela, MT.tela, Math.max(1, nb * 2));
    est.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((nT + Math.max(1, nB)) * 3), 3); est.name = 'andaime'; tela.name = 'andaime-tela';
    for (const m of [est, tela]) { m.count = 0; m.castShadow = m !== tela; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.userData.semHAO = true; }
    _bx.copy(s.box).expandByScalar(0.6); _bx.min.y = yb; _bx.max.y = yb + K * lift + 0.2; const esf = _bx.getBoundingSphere(new THREE.Sphere()); est.boundingSphere = tela.boundingSphere = esf;
    const g = new THREE.Group(); g.name = 'andaime-' + s.key; g.add(est, tela); this._andaimes.add(g);
    s.and = { g, est, tela, pts, fechado, polos, T, B, K, lift, yb, Lv: -1, nb, aplicado: -1, nTu: -1 };
  }
  // postes até o lance LvPolo (fração), cada um na altura relativa kPolo(i) (cascata da montagem); pisos,
  // guarda-corpos, diagonais e tela até o lance Ldeck
  _andaimeAplicar(s, LvPolo, kPolo = null, Ldeck = LvPolo) {
    const A2 = s.and; if (!A2) return; const Lint = Math.max(0, Math.min(A2.K, Math.floor(Ldeck + 1e-4)));
    const topo = A2.yb + Math.min(LvPolo, A2.K) * A2.lift + 0.16; const es = A2.est, te = A2.tela;
    let n = 0; const arr = es.instanceMatrix.array;
    for (let i = 0; i < A2.polos.length; i++) { const k = kPolo ? kPolo(i, A2) : 1; const h = (topo - A2.yb) * k; if (h < 0.01) continue; const [x, z] = A2.polos[i]; mSeg(x, A2.yb, z, x, A2.yb + h, z, 0.02, 0.02, true).toArray(arr, n * 16); n++; }
    for (let k = 1; k <= Lint; k++) for (const m of A2.T[k]) { arr.set(m, n * 16); n++; }
    const nTu = n; for (let k = 1; k <= Lint; k++) for (const m of A2.B[k]) { arr.set(m, n * 16); n++; }
    es.count = n; es.instanceMatrix.needsUpdate = true; const nb = n - nTu;
    // cor: tubos de aço #9EA4AA, tábuas e rodapés #A88A5E (só reescreve quando a divisão muda)
    if (nTu !== A2.nTu || n > (A2.nCor || 0)) { A2.nTu = nTu; A2.nCor = n; const ca = es.instanceColor.array; const cT = COR.tubo, cB = COR.tabua; for (let i = 0; i < n; i++) { const c = i < nTu ? cT : cB; ca[i * 3] = c[0]; ca[i * 3 + 1] = c[1]; ca[i * 3 + 2] = c[2]; } es.instanceColor.needsUpdate = true; }
    // tela nos 2 lances de cima, na face de fora (a obra pronta tira a tela e mostra a fachada)
    let nt = 0; const at = te.instanceMatrix.array;
    if (Lint >= 1 && s.estado === 'obra') {
      const y0 = A2.yb + Math.max(0, Lint - 2) * A2.lift + 0.02, hT = (Lint - Math.max(0, Lint - 2)) * A2.lift + 0.1;
      for (let i = 0; i < A2.nb; i++) { const a = A2.pts[i], b = A2.pts[(i + 1) % A2.pts.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1.4) continue;
        const ax = a[0] + a[2] * 0.12, az = a[1] + a[3] * 0.12, bx = b[0] + b[2] * 0.12, bz = b[1] + b[3] * 0.12; const e = _m.elements; const L = Math.hypot(bx - ax, bz - az) || 1;
        e[0] = bx - ax; e[1] = 0; e[2] = bz - az; e[3] = 0; e[4] = 0; e[5] = hT; e[6] = 0; e[7] = 0; e[8] = -(bz - az) / L; e[9] = 0; e[10] = (bx - ax) / L; e[11] = 0; e[12] = ax; e[13] = y0; e[14] = az; e[15] = 1; _m.toArray(at, nt * 16); nt++; }
    }
    te.count = nt; te.instanceMatrix.needsUpdate = true;
    es.visible = n > 0; te.visible = nt > 0; void nb;
  }

  // ================================================================ progresso, pronta, âncora
  progresso(key, p) { const s = this.sites.get(key); if (!s) return; s.p = clamp(p, 0, 1); if (s.pv === null) s.pv = s.p; }
  pronta(key) { const s = this.sites.get(key); if (!s || s.estado !== 'obra') return; s.p = 1; if (s.pv === null) s.pv = 1; s.estado = 'pronta'; s.tP0 = null; this._evento('pronta', key); for (const w of s.ops) this._postoPronta(s, w); }
  _postoPronta(s, w) {
    const P = s.patio, i = s.ops.indexOf(w) % 3 - 1; if (w.cat === 'faixa') { this.crowd.soltarPosto(w); w.posto = null; }
    const x = P.x - P.ox * 0.35 + P.lx * i * 0.32 + (w.cat === 'mestre' ? P.ox * 0.25 : 0), z = P.z - P.oz * 0.35 + P.lz * i * 0.32;
    this.crowd.setPosto(w, [x, chao(x, z), z], 'parado', { olhar: [s.cx, s.cz] });
  }
  // ponto do balão da obra: logo acima do nível de trabalho (ou do topo, pronta)
  ancora(key) {
    const s = this.sites.get(key) || this.festas.find((f) => f.key === key); if (!s) return null;
    const y = s.modo === 'subir' && s.estado === 'obra' ? Math.max(s.wl, this._yDeck(s) - 0.4) : s.y1; return [s.cx, y + 0.8, s.cz];
  }

  // ================================================================ aprovação coreografada
  // obras.concluir(k, cb, {aoImpacto, baque, rig}): 380 ms impacto (rig.baque 0,97), andaime desmonta de
  // cima, grua estaciona e recolhe o mastro, caminhão e turma saem, poeira, o prédio assenta com brilho,
  // três rajadas de confete (fogos à noite); cb em ~1200 ms e a festa segue sozinha até ~2,8 s
  concluir(key, cb, o = {}) {
    const s = this.sites.get(key); if (!s) { cb && cb(); return; } if (s.estado === 'fim') return;
    s.estado = 'fim'; s.tf = 0; s.tf0 = null; s.cb = cb; s.oFim = o; s.impacto = false; s.rajadas = 0; s.cbFeito = false; s.assentou = false;
    if (o.rig) this.rig = o.rig;
    s.andLv0 = s.and ? Math.max(0, s.and.Lv) : 0; s.mast0 = s.grua ? s.grua.k : 0;
    this.e.acordar?.(3200);
  }
  _festa(s, dt, tNow) {
    if (s.tf0 == null) s.tf0 = tNow; const tf = (s.tf = tNow - s.tf0); const o = s.oFim || {};
    if (!s.impacto && tf >= 380) {
      s.impacto = true; try { o.aoImpacto?.(); } catch (_) {} if (o.baque !== false) (o.rig || this.rig)?.baque?.(0.97); this._evento('impacto', s.key);
      // turma anda 0,6 para fora e some; caminhão sai
      for (const w of s.ops) { const dx = w.x - s.cx, dz = w.z - s.cz, d = Math.hypot(dx, dz) || 1; if (w.cat === 'faixa') this.crowd.setPosto(w, [w.x + (dx / d) * 0.6, w.y, w.z + (dz / d) * 0.6], 'parado'); else this.crowd.setPosto(w, [w.x + (dx / d) * 0.6, w.posto?.y ?? w.y, w.z + (dz / d) * 0.6], 'parado'); w.v = 0.7; }
      const c = s.cam; if (c.vis) { c.fase = 'sai'; c.t = 0; c.saiRapido = true; }
      this._poeira(s, 24, 0.42);
    }
    // andaime desmonta de cima para baixo (380-830 ms); postes 80 ms depois
    if (s.and) { const k = easeInQuad(fatia(tf, 380, 830)), kp = easeInQuad(fatia(tf, 460, 910)); this._andaimeAplicar(s, s.andLv0 * (1 - kp), null, s.andLv0 * (1 - k)); if (tf > 920) s.and.g.visible = false; }
    // prédio assenta (mola ω 14, ζ 0,45: 1 → 1,035 → 0,99 → 1) com brilho quente
    const ta = (tf - 700) / 1000;
    if (ta > 0 && tf <= 1150) { const a = 6.3, b = 12.5; s.alvo.scale.y = 1 + 0.0684 * Math.exp(-a * ta) * Math.sin(b * ta); } else if (tf > 1150) s.alvo.scale.y = 1;
    const br = tf > 700 && tf < 1150 ? 0.6 * (1 - fatia(tf, 700, 1150)) : 0; s.U.uBrilho.value.setRGB(1.0 * br, 0.8 * br, 0.43 * br); s.Usk.uBrilho.value.copy(s.U.uBrilho.value);
    // rajadas de 900, 1150 e 1400 ms
    const noite = this.e.modoLuz === 'noite';
    for (let i = 0; i < 3; i++) if (tf >= TIROS[i] && s.rajadas === i) { s.rajadas++; this._rajada(s, noite); this._evento(noite ? 'fogos' : 'confete', s.key); }
    // antes do cb: materiais de volta (o que for fundido depois usa os originais)
    if (!s.cbFeito && tf >= 1200) {
      s.cbFeito = true; this._restaurar(s); if (s.modo === 'caixas') this._abreCaixas(s);
      if (s.muda) { this.group.remove(s.muda.im); s.muda.im.dispose(); s.muda = null; } // a mata de verdade entra no mesmo lugar
      this.sites.delete(s.key); this.festas.push(s); const cb = s.cb; s.cb = null; try { cb && cb(); } catch (e) { console.error(e); }
      this._pedirSombra(true);
    }
    // turma some nos últimos 150 ms da saída
    const kv = 1 - fatia(tf, 1130, 1280); for (const w of s.ops) w.esc = Math.min(w.esc, kv);
    if (tf >= 900 && !s.somem) { s.somem = true; this._pedirSombra(true); }
    return tf > 3000 && (!s.caixasAbrindo || tf > 4200);
  }
  _rajada(s, noite) {
    const Pt = this.pontos, t0 = this._tl; const y = s.y1 + 0.3; const cores = noite ? [lin(0xffd27a), lin(0x7fe9ff), lin(0xb69cff)] : [lin(0xf0c46a), lin(0x6fd39a), lin(0xfff4d8)];
    const r = Math.min(1.2, s.raio * 0.4);
    if (!noite) for (let i = 0; i < 90; i++) { const a = rnd(s) * TAU, v = 0.6 + rnd(s) * 1.1; Pt.add(s.cx + Math.cos(a) * r * rnd(s), y, s.cz + Math.sin(a) * r * rnd(s), Math.cos(a) * v, 2.2 + rnd(s) * 1.6, Math.sin(a) * v, t0, 1.4 + rnd(s) * 0.3, 0.8 + rnd(s) * 0.5, 1, cores[i % 3]); }
    else {
      const x0 = s.cx + (rnd(s) - 0.5) * r, z0 = s.cz + (rnd(s) - 0.5) * r, alt = 2.7;
      for (let k = 0; k < 10; k++) Pt.add(x0, y, z0, 0, alt / 0.6, 0, t0 + k * 0.05, 0.6, 1, 3, cores[1]);
      for (let i = 0; i < 90; i++) { const u = rnd(s) * 2 - 1, a = rnd(s) * TAU, q = Math.sqrt(1 - u * u), v = 1.3 + rnd(s) * 0.5; Pt.add(x0, y + alt, z0, q * Math.cos(a) * v, u * v + 0.3, q * Math.sin(a) * v, t0 + 0.6, 1.4, 0.9 + rnd(s) * 0.4, 2, cores[i % 3]); }
    }
  }
  _poeira(s, n, alfa = 0.45, cx = null, cz = null, raio = null) {
    const Pt = this.pontos, t0 = this._tl, cor = lin(0xcdbfa6);
    for (let i = 0; i < n; i++) { let x, z; if (cx !== null) { const a = rnd(s) * TAU, rr = (raio ?? 0.5) * (0.4 + rnd(s) * 0.6); x = cx + Math.cos(a) * rr; z = cz + Math.sin(a) * rr; } else { const h = s.hull[(rnd(s) * s.hull.length) | 0]; x = h[0] + (h[0] - s.cx) * 0.05; z = h[1] + (h[1] - s.cz) * 0.05; }
      const dx = x - (cx ?? s.cx), dz = z - (cz ?? s.cz), d = Math.hypot(dx, dz) || 1; Pt.add(x, chao(x, z) + 0.05, z, (dx / d) * 0.25, 0.05, (dz / d) * 0.25, t0 + rnd(s) * 0.25, 0.9 + rnd(s) * 0.5, 0.5 * (alfa / 0.45), 0, cor); }
  }
  // caixas dos animais: tampa abre (280 ms, quique), bicho aparece (420 ms) e anda 0,5 para fora, 160 ms entre eles
  _abreCaixas(s) {
    s.caixasAbrindo = true; s.tCaixa = 0; s.tc0 = null;
    for (const b of s.bichos || []) { if (b.md) { const a = b.md.a[b.i]; if (a) { a.s = 0.0001; a.wait = 99; } } else if (b.im) { escalaPivo(b.M0, 0, b.im.instanceMatrix.array, b.i * 16, 0.0001, b.x, b.y, b.z); b.im.instanceMatrix.needsUpdate = true; } }
  }
  _caixasFesta(s, tNow) {
    if (!s.caixasAbrindo) return; if (s.tc0 == null) s.tc0 = tNow; s.tCaixa = (tNow - s.tc0) / 1000; const B = s.bichos || []; const t = s.tCaixa;
    B.forEach((b, k) => {
      const t0 = 0.15 + k * 0.16; const kt = fatia(t, t0 + 0.2, t0 + 0.62); const ks = kt > 0 ? easeOutBack(kt) : 0;
      if (b.md) { const a = b.md.a[b.i]; if (!a) return; a.s = Math.max(0.0001, b.s0 * ks); if (kt > 0 && !b.saiu) { b.saiu = true; const dx = Math.cos(b.ang), dz = Math.sin(b.ang); a.tx = b.x + dx * 0.5; a.tz = b.z + dz * 0.5; a.wait = 0; } if (kt >= 1) a.s = b.s0; }
      else if (b.im) { escalaPivo(b.M0, 0, b.im.instanceMatrix.array, b.i * 16, Math.max(0.0001, ks), b.x, b.y, b.z); b.im.instanceMatrix.needsUpdate = true; }
    });
    if (t > 0.15 + B.length * 0.16 + 1.4) { s.caixasAbrindo = false; for (const b of B) if (b.im) { b.im.instanceMatrix.array.set(b.M0, b.i * 16); b.im.instanceMatrix.needsUpdate = true; } else if (b.md?.a[b.i]) b.md.a[b.i].s = b.s0; }
  }

  // ================================================================ remover
  remover(key) {
    const s = this.sites.get(key); if (!s) return;
    this._restaurar(s); if (s.vis0 !== undefined && s.modo !== 'desmontar') s.alvo.visible = s.vis0; this._descartarSite(s); this.sites.delete(key); this._limites(); this._pedirSombra(true);
  }
  _descartarSite(s) {
    if (s.and) { this._andaimes.remove(s.and.g); descartar(s.and.g); s.and = null; }
    if (s.piso) { this.group.remove(s.piso.mesh); descartar(s.piso.mesh); s.piso = null; }
    if (s.muda) { this.group.remove(s.muda.im); s.muda.im.dispose(); s.muda = null; }
    for (const w of s.ops) this.crowd.remover(w); s.ops.length = 0;
    if (s.caixasAbrindo) { s.tc0 = -1e9; this._caixasFesta(s, 0); }
  }
  // limites das malhas compartilhadas (descarte por visão só quando nenhuma obra aparece)
  _limites() {
    _bx.makeEmpty(); for (const s of this.sites.values()) _bx.union(s.box); for (const s of this.festas) _bx.union(s.box);
    if (_bx.isEmpty()) { this._esfera.radius = 0.001; return; }
    _bx.expandByScalar(7); _bx.getBoundingSphere(this._esfera);
  }
  // sombra: no máximo 2 vezes por segundo (4 no time-lapse), só com a caixa da obra no alcance da luz
  _pedirSombra(forcar = false, s = null) {
    if (!forcar && s) { if (!this._luz) this.e.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) this._luz = o; }); const L = this._luz; if (L) { const c = L.shadow.camera; _mf.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse); _fr.setFromProjectionMatrix(_mf); if (!_fr.intersectsBox(s.box)) return; } }
    this._pedeSombra = true; this.stats.pedidos++; if (forcar) this._pedeHAO = true;
  }

  // ================================================================ canteiro de produção e prédios novos
  // estado de produção de um prédio do canteiro: 'produzindo' | 'parado' | 'cheio' | 'fora'
  producao(id, estado) { if (!this.atividade) { this.atividade = new AtividadeCanteiro(this.e); this.group.add(this.atividade.group); } this.atividade.set(id, estado); }
  // prédio novo do canteiro sobe por um plano de corte em 3 lances (1,4 s), sem esticar
  erguer(obj, o = {}) {
    const b = new THREE.Box3().setFromObject(obj); if (b.isEmpty()) { o.aoFim?.(); return; }
    const s = { key: 'erguer', trocas: [], sombras: [], clones: new Map(), U: uniformes(), alvo: obj, opts: {}, t: 0, ms: o.ms || 1400, aoFim: o.aoFim, y0: Math.min(b.min.y, 0), y1: b.max.y + 0.02, box: b, cx: (b.min.x + b.max.x) / 2, cz: (b.min.z + b.max.z) / 2, seed: 17, hull: [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.max.x, b.max.z], [b.min.x, b.max.z]] };
    s.plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), s.y0); s.U.uEscuro.value = 0.75; s.U.uFormaK.value = 1; s.U.uCap.value.set(0x8e8a84);
    this._cortar(s, obj, [s.plane], s.U, 'clip', 'erg'); obj.visible = true; this._poeira(s, 18, 0.4); this.ergue.push(s); this.e.acordar?.(s.ms + 400);
  }

  // ================================================================ quadro a quadro
  // relogio (ms): quando definido, substitui o tempo real de montagem, festa, partículas e estalos
  // (capturas de aceite em instantes exatos, mesmo com poucos quadros por segundo)
  update(dt, t) {
    if (this.relogio != null) t = this.relogio; this._tl = t / 1000; const L = this.L; this._quadro = (this._quadro || 0) + 1;
    const noite = this.e.modoLuz === 'noite', dia = this.e.modoLuz === 'dia'; this._noite = noite; this._dia = dia;
    L.sombra.mesh.material.uniforms.opac.value = noite ? 0.16 : 0.3;
    for (const s of this.sites.values()) this._site(s, dt, t);
    for (let i = this.festas.length - 1; i >= 0; i--) { const s = this.festas[i]; if (s.quadro === this._quadro) continue; const fim = this._site(s, dt, t); if (fim) { this._descartarSite(s); this.festas.splice(i, 1); this._limites(); } }
    for (let i = this.ergue.length - 1; i >= 0; i--) { const s = this.ergue[i]; if (s.t0 == null) s.t0 = t; s.t = t - s.t0; const k = fatia(s.t, 0, s.ms), n = k * 3; s.plane.constant = s.y0 + (s.y1 - s.y0) * ((Math.floor(n) + easeInOutSine(fatia(n - Math.floor(n), 0.35, 1))) / 3); if (k >= 1) { this._restaurar(s); this.ergue.splice(i, 1); s.aoFim?.(); this._pedirSombra(true); } }
    for (const l of this._lotes) l.fim();
    // operários: figura inteira de perto (como a gente da praça)
    const c = this.e.camera; this.crowd.update(dt, t, c.position, (0.27 * (this.e.H || 720)) / (2 * Math.tan((c.fov * Math.PI) / 360) * 12), 1);
    const P = this.pontos; P.mat.uniforms.uPR.value = this.e.pr || 1; P.mat.uniforms.uEsc.value = (this.e.H || 720) / (2 * Math.tan((c.fov * Math.PI) / 360)); P.enviar(this._tl);
    if (this.atividade) this.atividade.update(dt, t, this.e);
    if (this._aq) this._aquecerSombra();
    // sombra pedida: respeita o intervalo (0,5 s; 0,25 s durante time-lapse)
    const intervalo = this.timelapseAtivo ? 250 : 500;
    if (this._pedeSombra && t - this._tSombra >= intervalo) { this._pedeSombra = false; this._tSombra = t; this.e.shadowDirty = true; this.stats.sombras++; }
    // mapa de alturas (HAO): peças cortadas ficam fora dele; ao começar/terminar uma obra, refaz no máximo a cada 0,5 s
    if (this._pedeHAO && t - (this._tHAO ?? -1e9) >= 500) { this._pedeHAO = false; this._tHAO = t; this.e.marcarHAO?.(); }
    // som das marteladas (a interface decide o que tocar)
    if (this.onEvento) { this._tMartelo += dt; if (this._tMartelo > 0.6) { this._tMartelo = 0; let k = null; for (const s of this.sites.values()) { for (const w of s.ops) if (w.trab > 0.5 && w.esc > 0.5) { k = s.key; break; } if (k) break; } if (k) this._evento('martelo', k); } }
  }
  // um canteiro: devolve true quando a festa terminou
  // relógios de montagem, festa e time-lapse em tempo real (com poucos quadros por segundo a animação
  // pula etapas mas termina na hora certa); ciclos de grua, caminhão e máquinas andam com o dt
  _site(s, dt, t) {
    if (s.t0 == null) s.t0 = t - (s.opts.novo === false ? 12000 : 0); s.tm = (t - s.t0) / 1000; s.quadro = this._quadro; // obra que já existia (carga): sem montagem
    // time-lapse: salto maior que 8% passa em 1,5 s (grua 4x, turma 3x)
    if (s.pv === null) s.pv = s.p;
    if (s.estado !== 'fim') {
      if (!s.tl && s.p - s.pv > 0.08 && !SEM_TL) { s.tl = { de: s.pv, para: s.p, t: 0, t0: t }; this.e.acordar?.(1800); }
      if (s.tl) { s.tl.para = Math.max(s.tl.para, s.p); s.tl.t = (t - s.tl.t0) / 1000; const k = easeInOutCubic(Math.min(1, s.tl.t / 1.5)); s.pv = lerp(s.tl.de, s.tl.para, k); s.vel = 4; s.velOps = 3; if (s.tl.t >= 1.5) { const tl = s.tl; s.tl = null; s.pv = tl.para; try { this.onTimelapse?.(s.key, tl.de, tl.para); } catch (_) {} } }
      else { s.pv = SEM_TL || s.p < s.pv ? s.p : s.pv + (s.p - s.pv) * (1 - Math.exp(-3 * dt)); s.vel = 1; s.velOps = 1; }
    }
    const dts = dt * s.vel; s.t += dts; const p = s.pv;
    // corte e nível de trabalho
    if (s.modo === 'subir') this._cortes(s, p);
    else if (s.modo === 'caminho') { s.U.uArcS.value = s.arcoL * (s.estado === 'obra' ? p : 1) + (s.estado === 'obra' ? 0 : 1); s.wl = s.y1; }
    else if (s.modo === 'terra' || s.modo === 'pavimento') this._terra(s, p, dts);
    else if (s.modo === 'plantio') this._plantio(s, p, dt);
    else if (s.modo === 'draga') this._draga(s, p, dts);
    else if (s.modo === 'desmontar') this._desmontar(s, p, dts);
    else if (s.modo === 'replantar') this._replantar(s, p, dt);
    if (s.opts.anim) try { s.opts.anim(p, s); } catch (_) {}
    // varredura verde quando pronta (a cada 2,8 s, 900 ms subindo)
    if (s.estado === 'pronta' && s.modo === 'subir') { if (s.tP0 == null) s.tP0 = t; const k = (((t - s.tP0) / 1000) % 2.8) / 0.9; const v = k < 1 ? Math.sin(Math.PI * k) * 0.9 : 0; s.U.uVarre.value.setRGB(0.16 * v, 0.64 * v, 0.33 * v); s.U.uVarreD.value = s.plane.constant - (s.y0 + (s.y1 - s.y0) * Math.min(1, k)); }
    else s.U.uVarre.value.setRGB(0, 0, 0);
    // montagem (1,6 s) e andaime
    const tm = s.tm * 1000;
    if (s.and && s.estado !== 'fim') {
      const top = s.estado === 'pronta' ? s.y1 + 0.2 : Math.min(s.y1 + 0.2, s.wl + 0.42); const Lv = clamp(Math.floor((top - s.and.yb) / s.and.lift + 1e-4), 1, s.and.K) + (s.estado === 'pronta' ? 1000 : 0); // (pronta: reaplica sem tela)
      if (tm < 1000) { s.and.kpTm = tm; this._andaimeAplicar(s, Lv, kPoloMontagem, tm < 550 ? 0 : Lv * fatia(tm, 550, 1000) + 0.999); s.and.Lv = Lv; s.and.aplicado = -2; }
      else if (s.and.aplicado !== Lv) { s.and.aplicado = Lv; s.and.Lv = Lv % 1000; this._andaimeAplicar(s, Lv % 1000); this._pedirSombra(false, s); for (const w of s.ops) if (w.cat === 'andaime' && w.posto) w.posto.y = this._yDeck(s); }
    }
    if (tm >= 1600 && !s.montado) { s.montado = true; this._pedirSombra(true); }
    // estacas laranja nos cantos (pop de 200 ms) até o andaime assumir
    if (tm < 2200 && s.modo !== 'draga') { const kE = easeOutBack(fatia(tm, 0, 200), 2) * (1 - fatia(tm, 1700, 2200)); if (!s.poeira0) { s.poeira0 = true; this._poeira(s, 24, 0.4); }
      const b = s.box; if (kE > 0.01) for (let i = 0; i < 4; i++) { const x = (i === 0 || i === 3 ? b.min.x : b.max.x) + (i === 0 || i === 3 ? -0.25 : 0.25), z = (i < 2 ? b.min.z : b.max.z) + (i < 2 ? -0.25 : 0.25); this.L.cil.put(mEixo(x, chao(x, z) + 0.12 * kE, z, 0, 1, 0, 0.03, 0.24 * kE), COR.laranja); } }
    // festa
    let fim = false; if (s.estado === 'fim') fim = this._festa(s, dt, t); this._caixasFesta(s, t);
    // grua, caminhão, pilha, máquinas, operários e chão
    if (s.grua) this._grua(s, dts, dt);
    this._caminhao(s, dts, dt);
    this._pilha(s, dt);
    this._chaoDesenha(s);
    if (s.escav) this._escavadeira(s, dts);
    if (s.bichos && s.estado !== 'fim' && !s.caixasAbrindo) this._caixas(s, p, dt); else if (s.caixasAbrindo || (s.bichos && s.estado === 'fim')) this._caixasDesenha(s, true);
    if (s.draga) this._dragaDesenha(s);
    if (s.modo === 'caminho' && s.baixo && s.estado === 'obra') this._rolo(s);
    this._operarios(s, dt);
    return fim;
  }
  // planos por andar: 70% do tempo instalando, 30% subindo (a sombra só muda nas subidas)
  _cortes(s, p) {
    const sk = s.opts.esqueleto; const fin = sk ? clamp((p - 0.42) / 0.58, 0, 1) : p; const pk = sk ? clamp(p / 0.5, 0, 1) : 0;
    s.nF = fin * s.nAnd; s.nS = pk * s.nAnd;
    const hy = s.estado !== 'obra' || fin >= 1 ? s.y1 + 1 : passoAndar(s, fin, 0.7); const sy = sk ? (s.estado !== 'obra' || pk >= 1 ? s.y1 + 1 : passoAndar(s, pk, 0.6)) : s.y0;
    s.plane.constant = hy; if (s.skPlane) s.skPlane.constant = sy; s.hy = hy; s.skY = sy;
    s.wl = clamp(Math.max(Math.min(hy, s.y1), sk ? Math.min(sy, s.y1) : s.y0), s.y0, s.y1);
    // luz de trabalho fria no acabamento (fraca de dia) e tampa acompanhando a luz do ambiente
    const fx = this._dia ? 0.25 : 0.8; s.U.uFaixa.value.setRGB(0.52 * fx, 0.77 * fx, 1.0 * fx); s.U.uCapK.value = s.Usk.uCapK.value = this._noite ? 0.3 : this._dia ? 1 : 0.8;
    // sombra: só quando o corte sobe um degrau visível
    const chave = Math.min(hy, s.y1 + 0.1) + Math.min(sy, s.y1 + 0.1); if (Math.abs(chave - s.hyS) > 0.04) { s.hyS = chave; this._pedirSombra(false, s); }
    // o emissivo dos clones acompanha o original (fachadas acendem à noite)
    for (const c of s.clones.values()) { const b = c.userData.base; if (b.emissiveIntensity !== undefined && c.emissiveIntensity !== b.emissiveIntensity) c.emissiveIntensity = b.emissiveIntensity; }
  }
  // ---------------------------------------------------------------- grua
  _grua(s, dts, dt) {
    const g = s.grua, tm = s.tm * 1000; const Lc = this.L;
    // montagem: mastro telescópico 200-900 ms, lança abre 900-1400 ms; na festa estaciona e recolhe
    let kM = easeOutCubic(fatia(tm, 200, 900)), elev = (Math.PI / 2) * (1 - easeOutBack(fatia(tm, 900, 1400), 1.2));
    if (s.estado === 'fim') { const tf = s.tf; kM = 1 - easeInCubic(fatia(tf, 600, 1100)); elev = 0; if (tf > 1100) return; }
    g.k = kM; const hm = g.hm * kM; const Ty = g.y + hm;
    // estados: ciclo de 14 s; pronta e festa: estaciona (lança no rumo do prédio, gancho no alto)
    const parar = s.estado !== 'obra' || tm < 1600;
    if (parar) { if (g.fase !== 9) { g.fase = 9; g.tf = 0; g.de.a = g.a; g.de.r = g.r; g.de.hy = g.hy; } g.tf += dt; const k = easeInOutSine(Math.min(1, g.tf / (s.estado === 'fim' ? 0.68 : 1.2))); g.a = g.de.a + angDif(g.de.a, g.aim) * k; g.r = lerp(g.de.r, 0.7, k); g.hy = lerp(g.de.hy, Ty - 0.35, k); g.carga = false; }
    else {
      if (g.fase === 9) { g.fase = 7; g.tf = DUR_GRUA[7]; }
      g.tf += dts; if (g.tf >= DUR_GRUA[g.fase]) { g.tf = 0; g.fase = (g.fase + 1) % 8; this._gruaFase(s); }
      const k = g.tf / DUR_GRUA[g.fase], d = g.de, q = g.para; const ke = g.fase === 2 || g.fase === 6 ? easeInOutSine(k) : easeInOutCubic(k);
      if (q.a !== undefined) { g.a = d.a + angDif(d.a, q.a) * ke; g.r = lerp(d.r, q.r, ke); g.hy = lerp(d.hy, q.hy, ke); }
    }
    g.hy = Math.min(g.hy, Ty - 0.3);
    // carrinho e pêndulo: θ'' = -(g/L)θ - 2ζω θ' - a/L (semi-implícito)
    const Dx = Math.cos(g.a), Dz = -Math.sin(g.a); const trx = g.x + Dx * g.r, trz = g.z + Dz * g.r, trY = Ty - 0.1;
    if (g.px === null) { g.px = trx; g.pz = trz; }
    const vx = (trx - g.px) / Math.max(dt, 1e-3), vz = (trz - g.pz) / Math.max(dt, 1e-3); const ax = (vx - g.pvx) / Math.max(dt, 1e-3), az = (vz - g.pvz) / Math.max(dt, 1e-3);
    g.ax += (clamp(ax, -6, 6) - g.ax) * (1 - Math.exp(-18 * dt)); g.az += (clamp(az, -6, 6) - g.az) * (1 - Math.exp(-18 * dt)); g.px = trx; g.pz = trz; g.pvx = vx; g.pvz = vz;
    const Lp = Math.max(0.2, trY - g.hy), w0 = Math.sqrt(9.8 / Lp); const n = Math.max(1, Math.ceil(dt / 0.01)), h = dt / n;
    for (let i = 0; i < n; i++) { g.wx += (-(9.8 / Lp) * g.thx - 0.24 * w0 * g.wx - g.ax / Lp) * h; g.thx = clamp(g.thx + g.wx * h, -0.5, 0.5); g.wz += (-(9.8 / Lp) * g.thz - 0.24 * w0 * g.wz - g.az / Lp) * h; g.thz = clamp(g.thz + g.wz * h, -0.5, 0.5); }
    const hx = trx + Lp * Math.sin(g.thx), hz = trz + Lp * Math.sin(g.thz), hY = trY - Lp * Math.cos(g.thx) * Math.cos(g.thz);
    // peças
    const T = Lc.trel, Cx = Lc.caixa;
    if (hm > 0.02) T.put(mSeg(g.x, g.y, g.z, g.x, Ty, g.z, 0.22, 0.22));
    Cx.put(mCaixa(g.x, g.y + 0.03, g.z, 0.5, 0.06, 0.5), COR.concreto);
    if (hm < 0.3) return;
    const ce = Math.cos(elev), se = Math.sin(elev); const jx = Dx * ce, jy = se, jz = Dz * ce; const J = g.jib;
    T.put(mSeg(g.x, Ty, g.z, g.x + jx * J, Ty + jy * J, g.z + jz * J, 0.16, 0.16));
    T.put(mSeg(g.x, Ty, g.z, g.x - Dx * 1.2, Ty, g.z - Dz * 1.2, 0.14, 0.14));
    T.put(mSeg(g.x, Ty, g.z, g.x, Ty + 0.6, g.z, 0.12, 0.12));
    const ang = g.a; Cx.put(mCaixa(g.x, Ty + 0.02, g.z, 0.3, 0.06, 0.3, ang), COR.escuro);
    Cx.put(mCaixa(g.x + Dx * 0.08 + Dz * 0.2, Ty - 0.13, g.z + Dz * 0.08 - Dx * 0.2, 0.26, 0.22, 0.22, ang), COR.amarelo); // cabine
    Cx.put(mCaixa(g.x - Dx * 1.05, Ty - 0.08, g.z - Dz * 1.05, 0.34, 0.26, 0.3, ang), COR.concreto); // contrapeso
    Cx.put(mSeg(g.x, Ty + 0.6, g.z, g.x + jx * J * 0.98, Ty + jy * J * 0.98 + 0.08, g.z + jz * J * 0.98, 0.008, 0.008, true), COR.escuro); // tirantes
    Cx.put(mSeg(g.x, Ty + 0.6, g.z, g.x - Dx * 1.15, Ty + 0.08, g.z - Dz * 1.15, 0.008, 0.008, true), COR.escuro);
    // luz da ponta: vermelha; à noite pisca 120 ms a cada 1 s (de dia é só uma caixa vermelha: sem chamada de luz)
    const pisca = this._noite ? ((this._tl % 1) < 0.12 ? 3.2 : 0.15) : 0.9; (this._noite ? Lc.luz : Lc.caixa).put(mCaixa(g.x + jx * J, Ty + jy * J + 0.1, g.z + jz * J, 0.05, 0.05, 0.05), 1.0 * pisca, 0.18 * pisca, 0.12 * pisca);
    // sombra de contato do mastro e da lança (deslocada pela direção da luz)
    const kd = this.e.keyDir; const sx = kd ? -kd.x / Math.max(0.2, kd.y) : 0.3, sz = kd ? -kd.z / Math.max(0.2, kd.y) : -0.3; const Sh = Lc.sombra;
    Sh.put(mChao(g.x, g.z, g.x + sx * hm, g.z + sz * hm, g.y + 0.012, 0.26), 0.9, 0, 0);
    if (elev < 0.2) { const ox = sx * hm, oz = sz * hm; Sh.put(mChao(g.x - Dx * 1.2 + ox, g.z - Dz * 1.2 + oz, g.x + Dx * J + ox, g.z + Dz * J + oz, g.y + 0.013, 0.2), 0.75, 0, 0); }
    if (elev > 0.15) return;
    // carrinho, cabo, gancho e carga
    Cx.put(mCaixa(trx, Ty - 0.1, trz, 0.14, 0.05, 0.12, ang), COR.escuro);
    Cx.put(mSeg(trx, trY - 0.02, trz, hx, hY + 0.06, hz, 0.008, 0.008, true), COR.escuro);
    Cx.put(mCaixa(hx, hY, hz, 0.08, 0.1, 0.08, ang), COR.laranja);
    if (g.carga) this._unidade(hx, hY - 0.08 - ALT_CARGA[g.cargaT], hz, ang + 0.3, g.cargaT, 1);
  }
  _gruaFase(s) {
    const g = s.grua, F = g.fase, Ty = g.y + g.hm; const pilhaTop = chao(s.pilha.x, s.pilha.z) + 0.25; const nivel = Math.max(s.wl, s.y0) + 0.02;
    const alto = Math.min(Ty - 0.45, Math.max(nivel + 0.9, pilhaTop + 0.6));
    const de = g.de, pa = g.para; de.a = g.a; de.r = g.r; de.hy = g.hy;
    const vai = vaiPara; vaiPara.pa = pa; // sem fechamento novo a cada fase
    if (F === 0) vai(g.aPick, g.rPick, pilhaTop + 0.15); // pegar
    else if (F === 1) { if (s.pilha.n > 0) { s.pilha.n--; g.carga = true; g.cargaT = tipoCarga(s.itens[(s.pilha.n + s.seed) % s.itens.length] || 'caixote'); } vai(g.aPick, g.rPick, alto); } // içar
    else if (F === 2) vai(g.aDrop, g.rDrop, alto); // girar
    else if (F === 3) vai(g.aDrop, g.rDrop, nivel + 0.08 + (g.carga ? ALT_CARGA[g.cargaT] + 0.08 : 0)); // baixar
    else if (F === 4) vai(g.aDrop, g.rDrop, g.hy); // soltar
    else if (F === 5) { if (g.carga) { g.carga = false; this._evento('pouso', s.key); } vai(g.aDrop, g.rDrop, alto); } // subir vazio
    else if (F === 6) vai(g.aPick, g.rPick, alto); // voltar
    else { vai(g.aPick, g.rPick, alto); this._gruaAlvo(s); } // pausa
  }
  // ---------------------------------------------------------------- caminhão (24 s: entra 4, ré 1,2, descarga 6, sai 4, fora 8,8)
  _caminhao(s, dts, dt) {
    const c = s.cam; if (!c) return; c.t += dts; const P = s.patio;
    if (c.fase === 'chega') { const k = easeOutCubic(fatia(c.t, 0.3, 1.2)); const [ux, uz] = c.U; c.x = ux + P.ox * 2 * (1 - k); c.z = uz + P.oz * 2 * (1 - k); c.h = Math.atan2(-P.oz, P.ox); c.vis = true; c.roda -= (dts * 2 * easeOutCubic(1 - fatia(c.t, 0.3, 1.2))) / 0.045; if (c.t > 1.2) { c.fase = 'descarga'; c.t = 0; } }
    else if (c.fase === 'fora') { c.vis = false; if (c.t > 8.8 && s.estado === 'obra') this._caminhaoVem(s); }
    else if (c.fase === 'entra' || c.fase === 're' || c.fase === 'sai') {
      const dur = c.fase === 'entra' ? 4 : c.fase === 're' ? 1.2 : c.saiRapido ? 0.9 : 4; const k = Math.min(1, c.t / dur); const kk = c.fase === 'entra' ? easeOutCubic(k) : c.fase === 're' ? easeInOutSine(k) : c.saiRapido ? easeInQuad(k) : easeInCubic(k);
      const cur = c[c.fase]; const L = cur.getLength(); cur.getPointAt(kk, _a); cur.getTangentAt(Math.min(0.999, Math.max(0.001, kk)), _b);
      const ds = Math.hypot(_a.x - c.x, _a.z - c.z); c.x = _a.x; c.z = _a.z; c.roda += (c.fase === 're' ? -ds : ds) / 0.045;
      c.h = c.fase === 're' ? Math.atan2(_b.z, -_b.x) : Math.atan2(-_b.z, _b.x); c.vis = true;
      if (c.saiRapido && c.fase === 'sai') { c.x = lerp(c.U[0], c.U[0] + P.ox * 1.5, kk); c.z = lerp(c.U[1], c.U[1] + P.oz * 1.5, kk); c.h = Math.atan2(-P.oz, P.ox); }
      if (k >= 1) { if (c.fase === 'entra') { c.fase = 're'; c.t = 0; } else if (c.fase === 're') { c.fase = 'descarga'; c.t = 0; this._evento('caminhao', s.key); } else { c.fase = 'fora'; c.t = 0; c.vis = false; if (c.saiRapido) c.fim = true; } }
      void L;
    } else if (c.fase === 'descarga') {
      c.vis = true;
      if (c.tipo === 'plataforma') { const n0 = c.carga; if (c.t > 1 && n0 === 3 || c.t > 3 && n0 === 2 || c.t > 5 && n0 === 1) { c.carga--; const p = s.pilha; if (p.n < 12) { p.pop[p.n] = this._tl; p.n++; } } }
      else if (c.tipo === 'betoneira') c.tambor += dts * 5;
      else if (c.tipo === 'basculante') c.enche = Math.min(1, c.enche + dts / 6);
      if (c.t > 6 && s.estado === 'obra') { c.fase = 'sai'; c.t = 0; }
      if (s.estado === 'pronta' && c.t > 6) { c.fase = 'sai'; c.t = 0; }
    }
    if (c.tipo === 'betoneira' && c.fase !== 'descarga') c.tambor += dts * 2.4;
    if (!c.vis || c.fim) return;
    this._desenhaCaminhao(c);
  }
  _caminhaoVem(s) {
    const c = s.cam; c.ciclo++; c.fase = 'entra'; c.t = 0; c.enche = 0; c.saiRapido = false;
    const concreto = s.itens.some((k) => /concreto|cimento/.test(k)); const p = s.pilha, cap = Math.round(12 * (1 - 0.85 * s.pv));
    if (c.tipo === 'plataforma' || c.tipo === 'betoneira') { c.tipo = concreto && c.ciclo % 2 === 0 ? 'betoneira' : 'plataforma'; c.carga = c.tipo === 'plataforma' ? (p.n >= cap ? 0 : 3) : 0; c.tipoCarga = tipoCarga(s.itens[c.ciclo % s.itens.length]); }
    if (c.tipo === 'basculante') { if (s.escav) { const e = s.escav; this._rotaCaminhao(s, e.x - 0.95, e.z, [-1, 0]); } /* atrás da escavadeira, no lado já cortado */ else if (s.draga) this._rotaCaminhao(s, s.draga.monte[0] + s.patio.lx * 0.9, s.draga.monte[1] + s.patio.lz * 0.9); else if (s.pecaAtual) { const pc = s.pecaAtual, ac = s.opts.acesso || [-19.6, 16.4]; const dx = ac[0] - pc.x, dz = ac[1] - pc.z, d = Math.hypot(dx, dz) || 1; const r = Math.max(pc.b.max.x - pc.b.min.x, pc.b.max.z - pc.b.min.z) / 2 + 0.5; this._rotaCaminhao(s, pc.x + (dx / d) * r, pc.z + (dz / d) * r, [dx / d, dz / d]); } }
    c.x = c.entra.points[0].x; c.z = c.entra.points[0].z;
  }
  _desenhaCaminhao(c) {
    const Cx = this.L.caixa, Ci = this.L.cil; const h = c.h, fx = Math.cos(h), fz = -Math.sin(h), rx = Math.sin(h), rz = Math.cos(h); const y0 = chao(c.x, c.z);
    const W = this._local(c.x, y0, c.z, h);
    let v = W(0.28, 0.14, 0); Cx.put(mCaixa(v.x, v.y, v.z, 0.2, 0.18, 0.2, h), COR.branco);
    v = W(0.385, 0.18, 0); Cx.put(mCaixa(v.x, v.y, v.z, 0.02, 0.07, 0.17, h), COR.vidroC);
    v = W(0, 0.07, 0); Cx.put(mCaixa(v.x, v.y, v.z, 0.72, 0.06, 0.2, h), COR.escuro);
    for (const lx of RODAS_X) for (const sg of LADOS) { v = W(lx, 0.045, sg * 0.105); Ci.put(mEixo(v.x, v.y, v.z, rx, 0, rz, 0.09, 0.05, c.roda), COR.pneu); }
    if (c.tipo === 'betoneira') { v = W(-0.1, 0.25, 0); const e = 0.25; Ci.put(mEixo(v.x, v.y, v.z, fx * Math.cos(e), Math.sin(e), fz * Math.cos(e), 0.24, 0.42, c.tambor), 2, 2, 2); }
    else if (c.tipo === 'basculante') { const b = c.fase === 'sai' || c.fase === 'fora' ? 0 : 0; v = W(-0.1, 0.19 + b, 0); Cx.put(mCaixa(v.x, v.y, v.z, 0.44, 0.14, 0.22, h), COR.cacamba); if (c.enche > 0.02) { v = W(-0.1, 0.22 + 0.05 * c.enche, 0); this.L.monte.put(mCaixa(v.x, v.y, v.z, 0.4, 0.1 * c.enche, 0.2, h), c.lodo ? COR.lodo : COR.terra); } }
    else { v = W(-0.1, 0.115, 0); Cx.put(mCaixa(v.x, v.y, v.z, 0.46, 0.03, 0.22, h), COR.cacamba); for (let k = 0; k < c.carga; k++) { v = W(-0.28 + k * 0.18, 0.13, 0); this._unidade(v.x, v.y, v.z, h, c.tipoCarga || 'palete', 1); } }
    if (this._noite) for (const sg of LADOS) { v = W(0.39, 0.1, sg * 0.07); this.L.luz.put(mCaixa(v.x, v.y, v.z, 0.03, 0.03, 0.03, h), 3.0, 2.5, 1.6); }
    v = W(0, 0.012, 0); this.L.sombra.put(mCaixa(v.x, y0 + 0.012, v.z, 0.86, 1, 0.32, h), 1, 0, 0);
  }
  // ponto no referencial de um veículo (x para a frente, z para o lado), sem alocar: devolve uma função
  // reaproveitada que escreve em _v
  _local(x, y, z, h) {
    const L = this._loc || (this._loc = { x: 0, y: 0, z: 0, fx: 1, fz: 0, rx: 0, rz: 1, f: null }); L.x = x; L.y = y; L.z = z; L.fx = Math.cos(h); L.fz = -Math.sin(h); L.rx = Math.sin(h); L.rz = Math.cos(h);
    return L.f || (L.f = (lx, ly, lz) => _v.set(L.x + L.fx * lx + L.rx * lz, L.y + ly, L.z + L.fz * lx + L.rz * lz));
  }
  // uma unidade de material (pilha, gancho, caçamba)
  _unidade(x, y, z, ang, tipo, k = 1) {
    const Cx = this.L.caixa; const s = k;
    if (tipo === 'madeira') { Cx.put(mCaixa(x, y + 0.015 * s, z, 0.2 * s, 0.03 * s, 0.2 * s, ang), COR.palete); for (let i = 0; i < 3; i++) Cx.put(mCaixa(x, y + (0.045 + i * 0.028) * s, z, 0.36 * s, 0.026 * s, 0.16 * s, ang), COR.viga); }
    else if (tipo === 'saco') { Cx.put(mCaixa(x, y + 0.015 * s, z, 0.2 * s, 0.03 * s, 0.2 * s, ang), COR.palete); Cx.put(mCaixa(x, y + 0.07 * s, z, 0.18 * s, 0.08 * s, 0.17 * s, ang), COR.saco); }
    else if (tipo === 'laje') { for (let i = 0; i < 3; i++) Cx.put(mCaixa(x, y + (0.015 + i * 0.03) * s, z, 0.3 * s, 0.026 * s, 0.18 * s, ang), COR.laje); }
    else if (tipo === 'vidro') { Cx.put(mCaixa(x, y + 0.015 * s, z, 0.24 * s, 0.03 * s, 0.14 * s, ang), COR.escuro); for (let i = -1; i <= 1; i++) { const c = Math.cos(ang), sn = Math.sin(ang); Cx.put(mCaixa(x + sn * i * 0.03 * s, y + 0.1 * s, z + c * i * 0.03 * s, 0.22 * s, 0.15 * s, 0.012 * s, ang), COR.vidro); } }
    else if (tipo === 'aco') { for (let i = 0; i < 2; i++) for (let j = -1; j <= 1; j++) { const c = Math.cos(ang), sn = Math.sin(ang); Cx.put(mCaixa(x + sn * j * 0.045 * s, y + (0.02 + i * 0.035) * s, z + c * j * 0.045 * s, 0.4 * s, 0.03 * s, 0.035 * s, ang), COR.aco); } }
    else if (tipo === 'muda') { Cx.put(mCaixa(x, y + 0.015 * s, z, 0.2 * s, 0.03 * s, 0.2 * s, ang), COR.bandeja); Cx.put(mCaixa(x, y + 0.045 * s, z, 0.18 * s, 0.035 * s, 0.18 * s, ang), COR.muda); }
    else { Cx.put(mCaixa(x, y + 0.06 * s, z, 0.2 * s, 0.12 * s, 0.2 * s, ang), COR.palete); }
  }
  // ---------------------------------------------------------------- pilha (12 lugares, 3 x 2 x 2)
  _pilha(s, dt) {
    const p = s.pilha; if (!p || s.modo === 'draga' || s.modo === 'desmontar' || s.modo === 'replantar') return;
    // sem grua, a turma consome a pilha à mão (uma unidade a cada 10 s de obra)
    if (!s.grua && s.estado === 'obra') { p.tc = (p.tc || 0) + dt * s.vel; if (p.tc > 10 && p.n > 0) { p.tc = 0; p.n--; } }
    const cap = s.estado === 'fim' ? p.n : Math.round(12 * (1 - 0.85 * s.pv)); if (p.n > cap) p.n = cap;
    const P = s.patio, ang = Math.atan2(-P.lz, P.lx); const kf = s.estado === 'fim' ? 1 - easeInQuad(fatia(s.tf, 1300, 1800)) : 1; if (kf <= 0.01) return;
    for (let i = 0; i < p.n; i++) { const col = i % 3, row = ((i / 3) | 0) % 2, lay = (i / 6) | 0; const ox = (col - 1) * 0.3, oz = (row - 0.5) * 0.28; const x = p.x + P.lx * ox + P.ox * oz, z = p.z + P.lz * ox + P.oz * oz;
      const tipo = tipoCarga(s.itens[(i + s.seed) % s.itens.length] || 'caixote'); const kp = p.pop[i] > 0 ? easeOutBack(fatia(this._tl - p.pop[i], 0, 0.2), 1.7) : 1;
      this._unidade(x, chao(x, z) + lay * (ALT_CARGA[tipo] + 0.04) * kf, z, ang, tipo, Math.max(0.01, kp * kf)); }
  }
  // ---------------------------------------------------------------- chão de obra (entra em 600 ms, sai na festa)
  _chaoDesenha(s) {
    const a = s.estado === 'fim' ? 1 - fatia(s.tf, 1300, 1900) : fatia(s.tm * 1000, 0, 600); if (a <= 0.01) return;
    for (const [x, z, w, d, ang, forma, sd] of s.chao) this.L.chao.put(mCaixa(x, chao(x, z) + 0.012, z, w, 1, d, ang), a, forma, sd);
  }
  // ---------------------------------------------------------------- terra: corte vertical e escavadeira
  _terra(s, p, dts) {
    const b = s.box; const pt = s.modo === 'pavimento' ? clamp(p / 0.45, 0, 1) : p; const fim = s.estado !== 'obra';
    s.plane.constant = fim || pt >= 1 ? b.max.x + 1 : lerp(b.min.x - 0.01, b.max.x + 0.02, pt); s.wl = s.y1;
    const e = s.escav; if (e) {
      e.x = clamp(s.plane.constant, b.min.x, b.max.x) - 0.3;
      // z: o ponto do alvo perto da frente mais próximo do anterior (a máquina segue a frente sobre o terreno)
      const T = s.terraPts; if (T && T.length) { let lo = 0, hi = T.length / 2; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m * 2] < e.x - 0.25) lo = m + 1; else hi = m; } let best = 1e9; for (let i = lo; i < T.length / 2 && T[i * 2] < e.x + 0.35; i++) { const dz = Math.abs(T[i * 2 + 1] - e.zb); if (dz < best) { best = dz; if (best < 1e8) e.zN = T[i * 2 + 1]; } } if (e.zN !== undefined) e.zb += (e.zN - e.zb) * Math.min(1, dts * 2); }
      e.z = e.zb + 0.35 * Math.sin(TAU * 6 * pt); e.ativa = !fim && pt < 1;
    }
    if (s.piso) { const k = fim ? 1 : clamp((p - 0.4) / 0.6, 0, 1); s.piso.U.uR.value = s.piso.rMax * easeInOutSine(k) + (fim ? 1 : 0); s.piso.mesh.visible = k > 0 || fim; }
    const chave = Math.round(s.plane.constant * 4); if (chave !== s.hyS) { s.hyS = chave; this._pedirSombra(false, s); }
  }
  _escavadeira(s, dts) {
    const e = s.escav; const Cx = this.L.caixa; const tm = s.tm * 1000; if (s.estado === 'fim' && s.tf > 1300) return;
    // ciclo de 4 s: desce 0,6, fecha a caçamba 0,4, ergue 0,6, gira 1,0, despeja 0,4, volta 1,0
    if (e.ativa) e.ciclo = (e.ciclo + dts) % 4; const c = e.ciclo; let giro, b1, b2, b3;
    const G0 = 0, G1 = 1.35 * (e.z > s.cz ? -1 : 1);
    if (!e.ativa) { giro = 0; b1 = 0.5; b2 = -1.4; b3 = 0.6; }
    else if (c < 0.6) { const k = easeInOutSine(c / 0.6); giro = G0; b1 = lerp(0.4, -0.3, k); b2 = lerp(-1.0, -0.6, k); b3 = -0.4; }
    else if (c < 1.0) { const k = easeInOutSine((c - 0.6) / 0.4); giro = G0; b1 = -0.3; b2 = lerp(-0.6, -1.3, k); b3 = lerp(-0.4, 0.9, k); if (!e.cavou) { e.cavou = true; this._torroes(s, e.x + 0.55, e.z, 5); } }
    else if (c < 1.6) { const k = easeInOutSine((c - 1.0) / 0.6); giro = G0; b1 = lerp(-0.3, 0.5, k); b2 = -1.3; b3 = 0.9; }
    else if (c < 2.6) { const k = easeInOutSine((c - 1.6) / 1.0); giro = lerp(G0, G1, k); b1 = 0.5; b2 = -1.3; b3 = 0.9; }
    else if (c < 3.0) { const k = easeInOutSine((c - 2.6) / 0.4); giro = G1; b1 = 0.5; b2 = lerp(-1.3, -0.8, k); b3 = lerp(0.9, -0.6, k); if (e.cavou) { e.cavou = false; const c2 = s.cam; if (c2?.fase === 'descarga') c2.enche = Math.min(1, c2.enche + 0.2); } }
    else { const k = easeInOutSine((c - 3.0) / 1.0); giro = lerp(G1, G0, k); b1 = lerp(0.5, 0.4, k); b2 = lerp(-0.8, -1.0, k); b3 = -0.4; }
    const hT = 0, hs = hT + giro; const y = chao(e.x, e.z); const fx = Math.cos(hT), fz = -Math.sin(hT); const rx = Math.sin(hT), rz = Math.cos(hT);
    const kIn = easeOutCubic(fatia(tm, 300, 1200)); const x0 = e.x - 1.5 * (1 - kIn);
    for (const sg of LADOS) Cx.put(mCaixa(x0 + rx * sg * 0.1, y + 0.04, e.z + rz * sg * 0.1, 0.36, 0.07, 0.08, hT), COR.pneu);
    Cx.put(mCaixa(x0, y + 0.1, e.z, 0.2, 0.05, 0.2, hT), COR.escuro);
    const ux = Math.cos(hs), uz = -Math.sin(hs), vx = Math.sin(hs), vz = Math.cos(hs);
    Cx.put(mCaixa(x0 - ux * 0.02, y + 0.17, e.z - uz * 0.02, 0.28, 0.1, 0.22, hs), COR.escav);
    Cx.put(mCaixa(x0 + ux * 0.02 + vx * 0.06, y + 0.28, e.z + uz * 0.02 + vz * 0.06, 0.11, 0.12, 0.1, hs), COR.escav);
    Cx.put(mCaixa(x0 + ux * 0.07 + vx * 0.06, y + 0.28, e.z + uz * 0.07 + vz * 0.06, 0.02, 0.08, 0.08, hs), COR.vidroC);
    const px = x0 + ux * 0.1 - vx * 0.03, py = y + 0.2, pz = e.z + uz * 0.1 - vz * 0.03;
    const a1x = px + ux * Math.cos(b1) * 0.34, a1y = py + Math.sin(b1) * 0.34, a1z = pz + uz * Math.cos(b1) * 0.34;
    const a2x = a1x + ux * Math.cos(b1 + b2) * 0.27, a2y = a1y + Math.sin(b1 + b2) * 0.27, a2z = a1z + uz * Math.cos(b1 + b2) * 0.27;
    Cx.put(mSeg(px, py, pz, a1x, a1y, a1z, 0.05, 0.045, true), COR.escav); Cx.put(mSeg(a1x, a1y, a1z, a2x, a2y, a2z, 0.04, 0.035, true), COR.escav);
    const b3a = b1 + b2 + b3; Cx.put(mSeg(a2x, a2y, a2z, a2x + ux * Math.cos(b3a) * 0.09, a2y + Math.sin(b3a) * 0.09, a2z + uz * Math.cos(b3a) * 0.09, 0.07, 0.09, true), COR.escuro);
    this.L.sombra.put(mCaixa(x0, y + 0.012, e.z, 0.5, 1, 0.34, hT), 1, 0, 0);
    if (this._noite) this.L.luz.put(mCaixa(x0 - ux * 0.1, y + 0.36, e.z - uz * 0.1, 0.03, 0.03, 0.03), (this._tl % 0.8) < 0.4 ? 3 : 0.3, 1.2, 0.1);
    void fx; void fz;
  }
  _torroes(s, x, z, n) { const cor = COR.terra; for (let i = 0; i < n; i++) this.pontos.add(x, chao(x, z) + 0.05, z, (rnd(s) - 0.5) * 0.5, 0.5 + rnd(s) * 0.4, (rnd(s) - 0.5) * 0.5, this._tl, 0.55, 1, 5, cor); }
  // ---------------------------------------------------------------- rolo compactador e fôrma na frente das passarelas baixas
  _rolo(s) {
    const f = Math.min(s.arcoL, s.U.uArcS.value); const q = this._noArco(s, f + 0.25, this._na || (this._na = [0, 0, 0, 0])); const Cx = this.L.caixa; const y = chao(q[0], q[2]); const h = -q[3];
    Cx.put(mCaixa(q[0], y + 0.1, q[2], 0.2, 0.12, 0.18, h), COR.amarelo); this.L.cil.put(mEixo(q[0] + Math.cos(q[3]) * 0.16, y + 0.06, q[2] + Math.sin(q[3]) * 0.16, -Math.sin(q[3]), 0, Math.cos(q[3]), 0.12, 0.2, -s.U.uArcS.value / 0.06), COR.cinza);
    const r = this._noArco(s, f - 0.05, this._nb || (this._nb = [0, 0, 0, 0])); Cx.put(mCaixa(r[0], r[1] - 0.02, r[2], 0.4, 0.04, 0.62, h), COR.forma);
    this.L.sombra.put(mCaixa(q[0], y + 0.012, q[2], 0.5, 1, 0.3, h), 0.8, 0, 0);
  }
  // ---------------------------------------------------------------- plantio
  _plantio(s, p, dt) {
    const P = s.itensP; if (!P) return; const fim = s.estado !== 'obra'; const t = this._tl; let muda = false;
    for (const g of P.ims) {
      let n = 0; while (n < g.l.length && (fim || g.l[n].pi <= p)) n++;
      if (n !== g.im.count) { for (let k = g.im.count; k < n; k++) g.l[k].tPop = s.pv > 0 && s.tm > 0.3 ? t : -1; g.im.count = n; muda = true; }
      const A2 = g.im.instanceMatrix.array; let sujo = false;
      for (let k = Math.max(0, n - 12); k < n; k++) { const x = g.l[k]; if (x.tPop < 0) continue; const u = (t - x.tPop) / 0.35; const kk = u >= 1 ? 1 : easeOutBack(Math.max(0, u), 1.7); escalaPivo(g.Ms, k * 16, A2, k * 16, Math.max(0.001, kk), x.x, chao(x.x, x.z), x.z); sujo = true; if (u >= 1) x.tPop = -1; }
      if (sujo) g.im.instanceMatrix.needsUpdate = true;
    }
    for (const x of P.meshes) { const on = fim || x.pi <= p; if (on && !x.mesh.visible) { x.mesh.visible = true; x.tPop = s.tm > 0.3 ? t : -1; muda = true; } if (!on) x.mesh.visible = false;
      if (x.tPop >= 0) { const u = (t - x.tPop) / 0.35; const kk = u >= 1 ? 1 : easeOutBack(Math.max(0, u), 1.7); x.mesh.scale.copy(x.s0).multiplyScalar(Math.max(0.001, kk)); x.mesh.position.set(x.cx + kk * (x.p0.x - x.cx), x.cy + kk * (x.p0.y - x.cy), x.cz + kk * (x.p0.z - x.cz)); if (u >= 1) { x.tPop = -1; x.mesh.scale.copy(x.s0); x.mesh.position.copy(x.p0); } } }
    // montinhos de terra dos que acabaram de aparecer (somem em 600 ms)
    for (const x of P.peq) { if (x.tPop < 0 && !(x.mt > t)) continue; if (x.tPop >= 0 && !x.mt) x.mt = x.tPop + 0.6; const k = 1 - fatia(t, x.mt - 0.6, x.mt); if (k <= 0) { x.mt = 0; continue; } this.L.monte.put(mCaixa(x.x, chao(x.x, x.z), x.z, 0.2 * k, 0.07 * k, 0.2 * k), COR.terra); }
    if (s.plane && s.varre) { const v = s.varre; s.plane.constant = fim ? v.d1 + 1 : lerp(v.d0, v.d1, p); const ch = Math.round(s.plane.constant * 3); if (ch !== s.hyS) { s.hyS = ch; this._pedirSombra(false, s); } }
    if (muda) this._pedirSombra(false, s); s.wl = s.y1;
  }
  // ---------------------------------------------------------------- caixas de transporte
  _caixas(s, p, dt) { for (const b of s.bichos) { if (b.pi <= p && b.tPop < 0 && !b.pop) { b.pop = true; b.tPop = s.tm > 0.3 ? this._tl : this._tl - 1; } } this._caixasDesenha(s, false); s.wl = s.y1; }
  _caixasDesenha(s, abrindo) {
    const Cx = this.L.caixa; const tc = s.tCaixa || 0;
    for (let k = 0; k < s.bichos.length; k++) { const b = s.bichos[k];
      if (!abrindo && !b.pop) continue; const kp = abrindo ? 1 : easeOutBack(fatia(this._tl - b.tPop, 0, 0.35), 1.7); const w = b.w * kp, hgt = w * 0.9, d = w * 0.8;
      const t0 = 0.15 + k * 0.16; const kt = abrindo ? easeOutBounce(fatia(tc, t0, t0 + 0.28)) : 0; const some = abrindo ? 1 - fatia(tc, t0 + 1.0, t0 + 1.4) : 1; if (some <= 0.01) continue;
      const c = Math.cos(b.ang), sn = Math.sin(b.ang); const y = b.y; const W2 = w * some;
      // caixa aberta de um lado (a frente vira rampa): fundos, laterais e porta que cai 90° para fora
      // eixos locais com giro -b.ang: x local = (c, sn) (frente, para onde o bicho sai), z local = (-sn, c)
      const bd = d * 0.45 * some, hs = hgt * some;
      Cx.put(mCaixa(b.x - c * bd, y + hs * 0.5, b.z - sn * bd, 0.03 * some, hs, W2, -b.ang), COR.caixa);
      for (const sg of LADOS) Cx.put(mCaixa(b.x - sn * sg * W2 * 0.5, y + hs * 0.5, b.z + c * sg * W2 * 0.5, d * some, hs, 0.03 * some, -b.ang), COR.caixa);
      const fa = kt * Math.PI / 2; const fx = b.x + c * bd, fz = b.z + sn * bd; const sf = Math.sin(fa) * hs * 0.5;
      _e.set(0, -b.ang, -fa, 'YXZ'); _q.setFromEuler(_e); _p.set(fx + c * sf, y + Math.cos(fa) * hs * 0.5, fz + sn * sf); _m.compose(_p, _q, _s.set(0.03 * some, hs, W2)); Cx.put(_m, COR.caixa); _e.order = 'XYZ';
      Cx.put(mCaixa(b.x, y + hgt * some + 0.012, b.z, d * some, 0.025 * some, W2, -b.ang), COR.viga);
      if (!abrindo) this.L.sombra.put(mCaixa(b.x, y + 0.01, b.z, d * 1.3, 1, W2 * 1.3, -b.ang), 0.7, 0, 0);
    }
  }
  // ---------------------------------------------------------------- draga
  _draga(s, p, dts) {
    const D = s.draga; const f = (s.estado === 'obra' ? p : 1) * D.L; let i = 1; while (i < D.cum.length - 1 && D.cum[i] < f) i++;
    const a = D.pts[i - 1], b = D.pts[i]; const t = clamp((f - D.cum[i - 1]) / (D.cum[i] - D.cum[i - 1] || 1), 0, 1); D.x = lerp(a[0], b[0], t); D.z = lerp(a[1], b[1], t); D.h = Math.atan2(-(b[1] - a[1]), b[0] - a[0]); D.t += dts;
    s.wl = s.y1; D.y = s.opts.nivelAgua ? s.opts.nivelAgua() : -0.1;
    if (s.estado === 'obra' && (D.tp = (D.tp || 0) + dts) > 0.5) { D.tp = 0; const cx = D.x + Math.cos(D.h) * 0.7, cz = D.z - Math.sin(D.h) * 0.7; for (let k = 0; k < 3; k++) this.pontos.add(cx, D.y + 0.02, cz, (rnd(s) - 0.5) * 0.3, 0.02, (rnd(s) - 0.5) * 0.3, this._tl, 1.4, 0.5, 0, COR.lodo); }
  }
  _dragaDesenha(s) {
    const D = s.draga, Cx = this.L.caixa, Ci = this.L.cil; if (s.estado === 'fim' && s.tf > 1300) return; const y = D.y, h = D.h, fx = Math.cos(h), fz = -Math.sin(h), rx = Math.sin(h), rz = Math.cos(h);
    const W = this._local(D.x, y, D.z, h);
    let v = W(0, 0.03, 0); Cx.put(mCaixa(v.x, v.y, v.z, 0.9, 0.1, 0.4, h), COR.branco);
    v = W(-0.25, 0.16, 0); Cx.put(mCaixa(v.x, v.y, v.z, 0.26, 0.16, 0.22, h), COR.branco); v = W(-0.13, 0.18, 0); Cx.put(mCaixa(v.x, v.y, v.z, 0.02, 0.07, 0.18, h), COR.vidroC);
    v = W(0.25, 0.2, 0); Cx.put(mCaixa(v.x, v.y, v.z, 0.05, 0.3, 0.32, h), COR.laranja);
    const sw = Math.sin(D.t * 0.9) * 0.35; const ex = fx * Math.cos(sw) + rx * Math.sin(sw), ez = fz * Math.cos(sw) + rz * Math.sin(sw); const p0 = W(0.4, 0.08, 0).clone();
    Cx.put(mSeg(p0.x, p0.y, p0.z, p0.x + ex * 0.55, y - 0.12, p0.z + ez * 0.55, 0.05, 0.06, true), COR.laranja); Ci.put(mEixo(p0.x + ex * 0.6, y - 0.08, p0.z + ez * 0.6, ex, 0, ez, 0.09, 0.12, D.t * 6), COR.escuro);
    for (const sg of LADOS) { v = W(-0.42, 0.15, sg * 0.15); Ci.put(mEixo(v.x, v.y, v.z, 0, 1, 0, 0.035, 0.5), COR.escuro); }
    this.L.sombra.put(mCaixa(D.x, y + 0.01, D.z, 1.0, 1, 0.5, h), 0.5, 0, 0);
    // recalque: 12 boias até a margem e o tubo até o monte de lodo, que cresce
    const sx = D.saida[0], sz = D.saida[1]; const st = W(-0.45, 0.05, 0); const bx = st.x, bz = st.z;
    for (let k = 0; k < 12; k++) { const u = (k + 0.5) / 12; const mx = lerp(bx, sx, u) + Math.sin(u * Math.PI) * (sz - bz) * 0.12, mz = lerp(bz, sz, u) - Math.sin(u * Math.PI) * (sx - bx) * 0.12; Ci.put(mEixo(mx, y + 0.02, mz, sx - bx, 0, sz - bz, 0.08, 0.14), COR.laranja); }
    const m = D.monte; Cx.put(mSeg(sx, chao(sx, sz) + 0.04, sz, m[0], chao(m[0], m[1]) + 0.1, m[1], 0.05, 0.05, true), COR.escuro);
    const g = s.estado === 'obra' ? 0.2 + 0.8 * s.pv : 1; this.L.monte.put(mCaixa(m[0], chao(m[0], m[1]) - 0.02, m[1], 1.6 * g, 0.5 * g, 1.1 * g, Math.atan2(-D.dir[1], D.dir[0])), COR.lodo);
    this.L.monte.put(mCaixa(m[0] + D.dir[1] * 0.9, chao(m[0], m[1]) - 0.02, m[1] - D.dir[0] * 0.9, 0.9 * g, 0.3 * g, 0.7 * g), COR.lodo);
    if (s.cam) s.cam.lodo = true;
  }
  // ---------------------------------------------------------------- desmontar
  _desmontar(s, p, dts) {
    const fim = s.estado !== 'obra'; let atual = null;
    for (const pc of s.pecas) {
      const k = fim ? 1 : fatia(p, pc.k0, pc.k1); const n = k * 4; const f = n - Math.floor(n); const kk = (Math.floor(n) + (f < 0.6 ? 0 : easeInOutSine((f - 0.6) / 0.4))) / 4; // em 4 lances, peça por peça
      const y = lerp(pc.y1, pc.y0, kk); if (y !== pc.plane.constant) { pc.plane.constant = y; if (Math.abs(y - (pc.yS ?? 1e9)) > 0.05) { pc.yS = y; this._pedirSombra(false, s); } }
      pc.o.visible = k < 1; if (k > 0 && k < 1) atual = pc;
    }
    if (atual && atual !== s.pecaAtual) { s.pecaAtual = atual; this._poeira(s, 14, 0.35, atual.x, atual.z, 0.9); }
    s.wl = s.y1;
  }
  // ---------------------------------------------------------------- replantar
  _replantar(s, p, dt) {
    const Mu = s.muda; if (!Mu) return; const fim = s.estado !== 'obra'; const t = this._tl; const A2 = Mu.im.instanceMatrix.array; let n = 0; s.mudaK = 0;
    for (const o of Mu.ord) {
      if (!fim && o.pi > p) break; if (o.tPop < 0 && !o.feito) { o.tPop = s.tm > 0.3 ? t : t - 1; o.feito = true; }
      const g = fim ? 1 : clamp((p - o.pi) / Math.max(0.05, 1 - o.pi), 0, 1); const pop = easeOutBack(clamp((t - o.tPop) / 0.35, 0, 1), 1.7);
      const k = Math.max(0.001, (0.14 + 0.86 * g * g * (3 - 2 * g)) * pop); escalaPivo(Mu.M0, o.i * 16, A2, n * 16, k, o.x, o.y, o.z); n++;
      if (t - o.tPop < 0.6) this.L.monte.put(mCaixa(o.x, o.y, o.z, 0.16, 0.05 * (1 - (t - o.tPop) / 0.6), 0.16), COR.terra);
      if (!fim) this.L.cil.put(mEixo(o.x + 0.07, o.y + 0.08, o.z, 0, 1, 0, 0.012, 0.16), COR.viga); // tutor da muda
    }
    s.mudaK = n; Mu.im.count = n; Mu.im.instanceMatrix.needsUpdate = true; s.wl = 0.5;
    if (n !== Mu.nS && (n % 8 === 0)) { Mu.nS = n; this._pedirSombra(false, s); }
  }
  // ---------------------------------------------------------------- operários
  _operarios(s, dt) {
    const C = this.crowd; const tm = s.tm * 1000;
    for (const w of s.ops) {
      if (s.estado !== 'fim') { if (w.esc < 1 && tm > w.nasce * 1000) w.esc = Math.min(1, w.esc + dt * 6); }
      if (s.estado === 'obra' && w.livre) this._posto(s, w);
      if (s.estado === 'pronta' && w.cat === 'faixa' && !w.posto) this._postoPronta(s, w);
      if (s.velOps > 1 && w.posto) w.v = (w.v0 || (w.v0 = w.v)) * s.velOps; else if (w.v0) { w.v = w.v0; w.v0 = 0; }
      if (s.estado === 'obra' && w.cat === 'laje' && w.posto && Math.abs(w.posto.y - this._yLaje(s)) > 0.05) w.posto.y = this._yLaje(s);
    }
    void C;
  }

  // quadros de aquecimento da sombra: as peças aparecem minúsculas sob a mesa com o mapa de sombra sujo.
  // O three desenha a sombra antes de montar as luzes do quadro, então o programa de profundidade sai com as
  // luzes do desenho anterior da cena: depois de um quadro normal (2 direcionais) ou logo depois do mapa de
  // alturas (câmera própria, sem luzes). Os dois casos acontecem no jogo; aquecemos os dois.
  _aquecerSombra() {
    const A2 = this._aq; A2.n++;
    // (o material de profundidade guarda o programa da 1ª vez: cada grupo tem os seus clones)
    if (A2.n === 4) { A2.g.visible = false; A2.ga.visible = false; A2.g2.visible = true; try { if (this.e.hao?.ativo) this.e.hao.calcular(); } catch (_) {} this.e.shadowDirty = true; return; }
    if (A2.n === 3) {
      A2.g.visible = true; A2.gs.visible = true; A2.ga.visible = true; mCaixa(0, -3, 0, 0.001, 0.001, 0.001);
      this.pontos.mesh.visible = true; if (this.atividade) this.atividade.pontos.visible = true; // pontos: o pipeline nasce num quadro normal, não na festa
      for (const m of [...this._lotes.map((l) => l.mesh), this.crowd.mesh, this.crowd.perto]) if (!m.count) { m.count = 1; m.visible = true; m.material.visible = true; m.setMatrixAt(0, _m); m.instanceMatrix.needsUpdate = true; A2.ligados = (A2.ligados || []).concat(m); }
      this.e.shadowDirty = true;
    } else if (A2.n >= 5) {
      for (const g of [A2.g, A2.g2, A2.ga, A2.gs]) { this.group.remove(g); g.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); } A2.geoS.dispose(); for (const c of A2.temp) descartar(c);
      for (const m of A2.ligados || []) { m.count = 0; m.visible = false; }
      this.e.shadowDirty = true; this._aq = null;
    }
  }
  // ================================================================ aquecimento dos programas (na carga)
  // Uma malha pequena por combinação (material das partes, esqueletos, fitas e canteiro x instanciada x cor
  // por instância x recebe sombra) com o corte de obra, mais as malhas da própria obra, compiladas no alvo
  // HDR. Os programas de profundidade (sombra com corte) saem em 2 quadros normais logo depois da carga
  // (_aquecerSombra). Os materiais de aquecimento ficam vivos: sem eles o three apagaria
  // os programas compilados.
  async aquecer(mundo = null) {
    const e = this.e, r = e.renderer; const t0 = performance.now(); const p0 = r.info.programs?.length;
    const grupo = (nome, vis = true) => { const g = new THREE.Group(); g.name = nome; g.position.set(0, -3, 0); g.visible = vis; return g; };
    const g = grupo('obra-aquecer'), g2 = grupo('obra-aquecer2', false), ga = grupo('obra-aquecer-arco'), gs = grupo('obra-aquecer-andaime');
    const vistos = new Set(), temp = []; const geoS = new THREE.BoxGeometry(0.01, 0.01, 0.01); const U = uniformes(), plano = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    this._aquecidos = this._aquecidos || [];
    // a geometria é a da própria peça: no ANGLE/Vulkan o pipeline depende também dos atributos de vértice
    // (cor por vértice, uv, atributos próprios), e não só do programa
    const malha = (grp, c, inst, cor, recebe, sombra, geo) => { const m = inst ? new THREE.InstancedMesh(geo || geoS, c, 1) : new THREE.Mesh(geo || geoS, c); if (inst && cor) m.setColorAt(0, _c.setRGB(1, 1, 1)); if (inst) m.setMatrixAt(0, _m.identity()); m.castShadow = sombra; m.receiveShadow = recebe; m.frustumCulled = false; grp.add(m); };
    const combo = (mat, inst, cor, recebe, modo, tampa = true, geo = null) => {
      if (!mat || Array.isArray(mat)) return; const k = mat.uuid + (inst ? 'i' : '') + (cor ? 'c' : '') + (recebe ? 'r' : '') + modo + (tampa ? 'T' : ''); if (vistos.has(k)) return; vistos.add(k);
      if (modo === 'arco') { const c = clipClone(mat, 'arco', [], U, false); this._aquecidos.push(c); malha(ga, c, inst, cor, recebe, false, geo); return; }
      for (const gg of [g, g2]) { const c = clipClone(mat, modo, [plano], U, tampa); this._aquecidos.push(c); malha(gg, c, inst, cor, recebe, true, geo); } // g2: 2ª variante de profundidade
    };
    const anda = (raiz, modo, tampa = true) => raiz?.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && !o.isPoints) for (const mt of [].concat(o.material)) combo(mt, o.isInstancedMesh, !!o.instanceColor, o.receiveShadow, modo, tampa, o.geometry); });
    if (mundo) {
      // o modo de cada etapa decide a variante: subir (com tampa), terra e plantio (sem), passarelas (arco)
      for (const p of PROJETOS) for (const et of p.etapas) {
        if (p.faixa && et.nivel) continue; const a = alvoEtapa(p, et); const md = mundo.modelos?.[a.modelo]; const pt = md?.partes?.[a.parte]; if (!pt || pt.userData.manadas) continue;
        const modo = et.modo || md.modos?.[a.parte] || 'subir';
        if (a.modelo.startsWith('pas_') || a.modelo === 'ponteCoberta') anda(pt, 'arco');
        else if (modo === 'terra' || modo === 'crescer') anda(pt, 'clip', false);
        else if (modo === 'subir') { anda(pt, 'clip'); anda(md.esqueletos?.[a.parte], 'clip'); }
      }
      combo(M.soil, false, false, true, 'clip', false); // placa de terra da praça
      for (const f of Object.values(mundo.faixas || {})) { f.merged?.traverse((o) => { if (o.isMesh) combo(o.material, false, false, true, 'clip', true, o.geometry); }); if (f.mods?.length) { try { const a = f.andar(0, 0, 1); anda(a.acabado, 'clip'); anda(a.esqueleto, 'clip'); a.esqueleto?.traverse((o) => o.isInstancedMesh && o.dispose()); } catch (_) {} } }
      if (mundo.casas?._casa) { try { const c = mundo.casas._casa(mundo.casas.mods[1], 3); anda(c, 'clip'); temp.push(c); } catch (_) {} } // descartada depois do quadro de aquecimento
      for (const p of Object.values(mundo.predios || {})) anda(p, 'clip');
      anda(mundo.canteiro, 'clip');
    }
    // malhas da obra (sem corte)
    const vis = []; const liga = (o) => { vis.push([o, o.visible, o.count, o.frustumCulled]); o.visible = true; o.frustumCulled = false; if (o.isInstancedMesh && !o.count) o.count = 1; };
    if (!this.atividade) { this.atividade = new AtividadeCanteiro(this.e); this.group.add(this.atividade.group); } // canteiro vivo (pontos)
    for (const l of this._lotes) liga(l.mesh); liga(this.crowd.mesh); liga(this.crowd.perto); liga(this.pontos.mesh); liga(this.atividade.pontos);
    const { G, MT } = recursos(); for (const m of [MT.caixa, MT.tela]) { const im = new THREE.InstancedMesh(m === MT.tela ? G.tela : G.caixa, m, 1); im.setMatrixAt(0, _m.identity()); if (m === MT.caixa) im.setColorAt(0, _c.setRGB(1, 1, 1)); im.castShadow = m !== MT.tela; im.receiveShadow = true; im.frustumCulled = false; gs.add(im); }
    this.group.add(ga, gs);
    this.group.add(g); const rt = r.getRenderTarget(); if (e.rtScene) r.setRenderTarget(e.rtScene); // no alvo HDR (espaço de cor linear, como no jogo)
    try { await r.compileAsync(this.group, e.camera, e.scene); } catch (err) { console.warn('aquecer', err); }
    r.setRenderTarget(rt);
    for (const [o, v, n, fc] of vis) { o.visible = v; o.frustumCulled = fc; if (o.isInstancedMesh) o.count = n; }
    g.visible = false; ga.visible = false; this.group.add(g2);
    gs.visible = false; this._aq = { g, g2, ga, gs, geoS, temp, n: 0 };
    this.stats.aquecer = { ms: Math.round(performance.now() - t0), combinacoes: vistos.size, programas: r.info.programs?.length, novos: (r.info.programs?.length || 0) - (p0 || 0) };
    return this.stats.aquecer;
  }
}
