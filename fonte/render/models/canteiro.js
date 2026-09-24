// Canteiro de obras (canto da frente à esquerda, fora do enquadramento da foto): escritório,
// almoxarifado, usinas de materiais e oficinas. Some no fim, quando a área é reflorestada.
import * as THREE from 'three';
import { M, dupla } from '../materials.js';
import { beams } from '../geom.js';
import { treeGroup } from '../forest.js';

export const LOTES = {
  escritorio: { x: -21.9, z: 17.9, r: 0.15 },
  almox: { x: -24.7, z: 17.7, r: 0.05 },
  usina1: { x: -28.9, z: 17.6, r: 0 }, usina2: { x: -28.9, z: 14.8, r: 0 }, usina3: { x: -28.9, z: 12.0, r: 0 },
  carpintaria: { x: -25.4, z: 14.9, r: 0 }, concreto: { x: -22.9, z: 14.7, r: 0.1 },
  serralheria: { x: -25.4, z: 12.2, r: 0 }, vidracaria: { x: -22.9, z: 12.1, r: 0.1 },
  eletrica: { x: -21.0, z: 15.4, r: 0.3 }, horto: { x: -27.3, z: 10.9, r: 0 }, laboratorio: { x: -24.3, z: 11.0, r: 0 },
};
// Pontos de produção de cada prédio (para a obra/atividade mostrar fumaça, esteira, serra, betoneira e faíscas
// quando o prédio estiver produzindo). Coordenadas do mundo, já com a posição e o giro do lote.
const LOCAIS = {
  usina: [['chamine', 1.45, 1.32, -0.4], ['esteira', 1.1, 0.52, 0.4]], carpintaria: [['serra', 0.2, 0.3, 0.75]], concreto: [['betoneira', 0.95, 0.32, 0.45], ['chamine', 0.95, 1.22, -0.2]],
  serralheria: [['faisca', 0.0, 0.26, 0.75]], vidracaria: [['chamine', -0.5, 0.62, -0.3]], eletrica: [['faisca', -0.1, 0.15, 0.72]], laboratorio: [['chamine', 0.45, 1.0, 0.2]],
};
export const PONTOS_ATIVOS = Object.fromEntries(Object.entries(LOTES).map(([id, l]) => {
  const tipo = id.startsWith('usina') ? 'usina' : id; const c = Math.cos(l.r), s = Math.sin(l.r);
  return [id, (LOCAIS[tipo] || []).map(([t, x, y, z]) => ({ tipo: t, pos: [+(l.x + x * c + z * s).toFixed(3), y, +(l.z - x * s + z * c).toFixed(3)] }))];
}));
const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
const B = (w, h, d, m, x, y, z) => { const o = mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); return o; };
let MT = null;
function mats() {
  if (MT) return MT;
  MT = {
    cont: new THREE.MeshStandardMaterial({ color: 0x2f6f9f, roughness: 0.6, metalness: 0.3 }),
    contB: new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.6, metalness: 0.2 }),
    chapa: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.5, metalness: 0.6 }),
    verde: new THREE.MeshStandardMaterial({ color: 0x3f7a4a, roughness: 0.6, metalness: 0.2 }),
    tora: new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.9 }),
    brita: new THREE.MeshStandardMaterial({ color: 0x9c968c, roughness: 1 }),
    areia: new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 1 }),
  };
  return MT;
}
function galpao(w, d, h, cor, serra = false) {
  const g = new THREE.Group(); const mt = mats();
  g.add(B(w, h, d, cor, 0, 0, 0));
  if (serra) { for (let i = 0; i < 4; i++) { const t = mesh(new THREE.BoxGeometry(w / 4, 0.02, d * 1.02), M.blue); t.position.set(-w / 2 + w / 8 + (i * w) / 4, h + 0.12, 0); t.rotation.z = 0.5; g.add(t); const v = mesh(new THREE.BoxGeometry(0.02, 0.22, d), M.glassWarm, false); v.position.set(-w / 2 + (i + 1) * (w / 4) - 0.02, h + 0.11, 0); g.add(v); } }
  else { const r = new THREE.CylinderGeometry(d * 0.62, d * 0.62, w * 1.02, 16, 1, false, 0, Math.PI); r.rotateZ(Math.PI / 2); r.rotateX(Math.PI / 2); r.scale(1, 0.4, 1); const m = mesh(r, mt.chapa); m.position.y = h; g.add(m); }
  const door = mesh(new THREE.BoxGeometry(w * 0.34, h * 0.7, 0.02), M.glassWarm, false); door.position.set(0, h * 0.35, d / 2 + 0.01); g.add(door);
  return g;
}
export function predioCanteiro(tipo) {
  const g = new THREE.Group(); const mt = mats();
  if (tipo === 'escritorio') {
    for (let f = 0; f < 2; f++) for (let i = 0; i < 2; i++) { const c = B(0.95, 0.34, 0.42, f ? mt.contB : mt.cont, (i - 0.5) * 0.5 + f * 0.15, f * 0.35, (i - 0.5) * 0.45); g.add(c); const w = mesh(new THREE.BoxGeometry(0.6, 0.12, 0.01), M.glassWarm, false); w.position.set(c.position.x, f * 0.35 + 0.2, c.position.z + 0.215); g.add(w); }
    g.add(beams([[[0.55, 0, 0.3], [0.55, 1.4, 0.3]]], 0.012, M.steel, 4)); const flag = mesh(new THREE.BoxGeometry(0.02, 0.18, 0.3), M.teal, false); flag.position.set(0.55, 1.3, 0.45); g.add(flag);
  } else if (tipo === 'almox') {
    g.add(galpao(2.3, 1.3, 0.62, mt.chapa)); const pal = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), M.woodFrame, 12); const m4 = new THREE.Matrix4();
    for (let i = 0; i < 12; i++) pal.setMatrixAt(i, m4.makeTranslation(-0.9 + (i % 6) * 0.36, 0.07 + ((i / 6) | 0) * 0.15, 0.9)); pal.castShadow = true; g.add(pal); g.userData.paletes = pal;
  } else if (tipo.startsWith('usina')) {
    g.add(galpao(2.5, 1.5, 0.7, M.white, true)); const silo = mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 12), mt.chapa); silo.position.set(1.45, 0.55, -0.4); g.add(silo);
    const cone = mesh(new THREE.ConeGeometry(0.22, 0.2, 12), mt.chapa); cone.position.set(1.45, 1.2, -0.4); g.add(cone);
    const belt = mesh(new THREE.BoxGeometry(1.1, 0.04, 0.12), M.dark); belt.position.set(1.1, 0.5, 0.4); belt.rotation.z = 0.5; g.add(belt);
    const pile = mesh(new THREE.ConeGeometry(0.35, 0.3, 10), mt.brita); pile.position.set(1.6, 0.15, 0.55); g.add(pile);
  } else if (tipo === 'carpintaria') {
    g.add(galpao(1.7, 1.1, 0.5, M.woodLight)); for (let i = 0; i < 6; i++) { const l = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 7), mt.tora); l.rotation.z = Math.PI / 2; l.position.set(0.2, 0.05 + ((i / 3) | 0) * 0.09, 0.75 + (i % 3) * 0.1); g.add(l); }
  } else if (tipo === 'concreto') {
    g.add(galpao(1.5, 1.1, 0.5, M.concreto)); const s = mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 12), M.whiteSmooth); s.position.set(0.95, 0.6, -0.2); g.add(s);
    const d = mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.36, 10), M.orange); d.rotation.z = 1.2; d.position.set(0.95, 0.3, 0.45); g.add(d);
  } else if (tipo === 'serralheria') {
    g.add(galpao(1.7, 1.1, 0.5, mt.chapa)); for (let i = 0; i < 5; i++) { const b = mesh(new THREE.BoxGeometry(1.0, 0.04, 0.06), M.steelDark); b.position.set(0, 0.03 + i * 0.045, 0.75); g.add(b); }
  } else if (tipo === 'vidracaria') {
    g.add(galpao(1.5, 1.1, 0.5, M.whiteSmooth)); for (let i = 0; i < 5; i++) { const p = mesh(new THREE.BoxGeometry(0.02, 0.36, 0.42), M.glassDome, false); p.position.set(-0.4 + i * 0.07, 0.2, 0.8); p.rotation.z = 0.12; g.add(p); }
  } else if (tipo === 'eletrica') {
    g.add(galpao(1.3, 1.0, 0.48, M.white)); for (let i = 0; i < 3; i++) { const r = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), M.woodFrame); r.rotation.x = Math.PI / 2; r.position.set(-0.4 + i * 0.3, 0.12, 0.72); g.add(r); }
    const sp = mesh(new THREE.BoxGeometry(0.9, 0.02, 0.5), M.blue); sp.position.set(0, 0.62, 0); sp.rotation.x = 0.3; g.add(sp);
  } else if (tipo === 'laboratorio') {
    g.add(galpao(1.5, 1.0, 0.5, M.whiteSmooth)); const d = mesh(new THREE.SphereGeometry(0.34, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.whiteSmooth); d.position.set(0.45, 0.62, -0.1); g.add(d);
    const fx = mesh(new THREE.BoxGeometry(0.1, 0.36, 0.02), M.dark); fx.position.set(0.45, 0.8, 0.2); fx.rotation.x = -0.4; g.add(fx);
    const tanques = []; for (let i = 0; i < 3; i++) { const t = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10), M.teal); t.position.set(-0.9 + i * 0.2, 0.15, 0.7); g.add(t); }
  } else if (tipo === 'horto') {
    const gh = mesh(new THREE.BoxGeometry(1.8, 0.5, 0.9), dupla(M.glass), false); gh.position.y = 0.25; g.add(gh);
    const roof = new THREE.CylinderGeometry(0.46, 0.46, 1.82, 12, 1, true, 0, Math.PI); roof.rotateZ(Math.PI / 2); roof.rotateX(Math.PI / 2); const rm = mesh(roof, dupla(M.glass), false); rm.position.y = 0.5; g.add(rm);
    const pl = []; for (let i = 0; i < 18; i++) pl.push({ x: -0.75 + (i % 9) * 0.18, z: -0.2 + ((i / 9) | 0) * 0.4, y: 0.02, s: 0.07, pal: 'jardim' }); g.add(treeGroup(pl, { cast: false }));
  }
  return g;
}
// pilhas de material, caminhões e cerca: ambientação permanente do canteiro
export function ambienteCanteiro() {
  const g = new THREE.Group(); g.name = 'canteiroAmb'; const mt = mats();
  for (const [x, z, r, m] of [[-30.2, 19.0, 0.5, mt.areia], [-29.2, 19.1, 0.4, mt.brita], [-26.6, 19.0, 0.45, mt.areia], [-20.4, 12.4, 0.35, mt.brita]]) { const p = mesh(new THREE.ConeGeometry(r, r * 0.8, 12), m); p.position.set(x, r * 0.4, z); g.add(p); }
  const fence = []; for (let x = -31; x <= -20.4; x += 0.5) fence.push([[x, 0, 10.05], [x, 0.25, 10.05]]); g.add(beams(fence, 0.012, M.steel, 3));
  const tape = mesh(new THREE.BoxGeometry(10.6, 0.05, 0.01), M.stripes, false); tape.position.set(-25.7, 0.2, 10.05); g.add(tape);
  return g;
}

// ---------------------------------------------------------------- canteiro vivo
// Usinas e oficinas mostram quando estão produzindo: fumaça nas chaminés, brita subindo a esteira, pó de
// serra, pó de cimento na betoneira, faíscas de solda, luz âmbar na porta (roxa de cultivo no horto) e,
// com a bandeja cheia, uma luz vermelha piscando no telhado. Tudo num só THREE.Points animado no shader
// (cada partícula nasce de novo a cada volta); a CPU só suaviza a intensidade de cada emissor (1 chamada).
const TIPO = { chamine: 0, esteira: 1, serra: 2, betoneira: 3, faisca: 4, luz: 5, alerta: 6, cultivo: 7 };
const POR = [10, 6, 8, 6, 12, 1, 1, 1]; // partículas por emissor
const GALPAO = { usina: [1.5, 0.7], carpintaria: [1.1, 0.5], concreto: [1.1, 0.5], serralheria: [1.1, 0.5], vidracaria: [1.1, 0.5], eletrica: [1.0, 0.48], laboratorio: [1.0, 0.5] }; // [fundo, altura]
const AV = /* glsl */`
  attribute vec3 aOrig; attribute vec3 aDir; attribute vec3 aInfo; // tipo, semente, emissor
  uniform float uT; uniform float uOn[ 48 ]; uniform float uEsc; uniform float uPR;
  varying vec3 vCor; varying float vA; varying float vAdd; varying float vQuad;
  void main() {
    int e = int( aInfo.z + 0.5 ); float on = uOn[ e ]; float tipo = aInfo.x, sd = aInfo.y; vAdd = 0.0; vQuad = 0.0;
    vec3 p = aOrig; float tam = 0.1; float mundo = 1.0; vA = on;
    if ( tipo < 0.5 ) { float u = fract( uT / 3.2 + sd ); p += vec3( 0.25 * u + 0.05 * sin( sd * 40.0 ), 1.0 * u, 0.12 * sin( u * 3.0 + sd * 9.0 ) ); tam = mix( 0.12, 0.42, u ); vA *= 0.32 * ( 1.0 - u ) * smoothstep( 0.0, 0.12, u ); vCor = vec3( 0.8, 0.78, 0.74 ); }
    else if ( tipo < 1.5 ) { float u = fract( uT / 2.0 + sd ); p += aDir * ( u - 0.5 ) * 1.0 + vec3( 0.0, 0.035, 0.0 ); tam = 0.05; vA *= smoothstep( 0.0, 0.08, u ) * ( 1.0 - smoothstep( 0.92, 1.0, u ) ); vCor = vec3( 0.42, 0.4, 0.37 ); vQuad = 1.0; }
    else if ( tipo < 2.5 ) { float u = fract( uT / 0.9 + sd ); float t = u * 0.9; float a = sd * 37.0; p += vec3( cos( a ) * 0.35 * t, 0.5 * t - 1.2 * t * t, sin( a ) * 0.35 * t + 0.25 * t ); tam = 0.025; vA *= 0.85 * ( 1.0 - u ); vCor = vec3( 0.86, 0.72, 0.48 ); }
    else if ( tipo < 3.5 ) { float u = fract( uT / 2.4 + sd ); p += vec3( 0.1 * sin( sd * 20.0 ), 0.45 * u, 0.1 * cos( sd * 20.0 ) ); tam = mix( 0.06, 0.2, u ); vA *= 0.3 * ( 1.0 - u ); vCor = vec3( 0.72, 0.72, 0.7 ); }
    else if ( tipo < 4.5 ) { float u = fract( uT / 0.7 + sd ); float t = u * 0.7; float a = sd * 53.0; p += vec3( cos( a ) * 0.5 * t, 0.6 * t - 2.4 * t * t, sin( a ) * 0.5 * t ); mundo = 0.0; tam = 2.5; vA *= ( 1.0 - u ) * step( 0.3, fract( sd * 7.0 + floor( uT * 3.0 ) * 0.37 ) ); vCor = vec3( 1.7, 1.05, 0.45 ); vAdd = 1.0; }
    else if ( tipo < 5.5 ) { tam = 0.55; vA *= 0.5 * ( 0.9 + 0.1 * sin( uT * 7.0 + sd * 30.0 ) ); vCor = vec3( 1.2, 0.72, 0.32 ); vAdd = 1.0; }
    else if ( tipo < 6.5 ) { tam = 0.16; vA *= step( 0.5, fract( uT ) ); vCor = vec3( 2.2, 0.25, 0.18 ); vAdd = 1.0; }
    else { tam = 0.9; vA *= 0.45; vCor = vec3( 0.9, 0.45, 1.2 ); vAdd = 1.0; }
    vec4 mv = modelViewMatrix * vec4( p, 1.0 ); gl_Position = projectionMatrix * mv;
    gl_PointSize = vA < 0.003 ? 0.0 : ( mundo > 0.5 ? tam * uEsc / -mv.z : tam * uPR );
  }`;
const AF = /* glsl */`
  varying vec3 vCor; varying float vA; varying float vAdd; varying float vQuad;
  void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot( q, q ); if ( vQuad < 0.5 && r > 1.0 ) discard;
    float a = vA * ( vQuad > 0.5 ? 1.0 : 1.0 - smoothstep( 0.1, 1.0, r ) ); gl_FragColor = vec4( vCor * a, a * ( 1.0 - vAdd ) ); }`;
export class AtividadeCanteiro {
  constructor() {
    this.estado = {}; this.em = []; // emissores: {id, tipo, k}
    const O = [], D = [], I = [];
    const add = (id, tipo, pos, dir = [0, 0, 0]) => { const e = this.em.length; if (e >= 48) return; this.em.push({ id, tipo, k: 0 }); for (let i = 0; i < POR[TIPO[tipo]]; i++) { O.push(...pos); D.push(...dir); I.push(TIPO[tipo], (i + 0.5) / POR[TIPO[tipo]] + (e * 0.137) % 1, e); } };
    for (const [id, l] of Object.entries(LOTES)) {
      const tipo = id.startsWith('usina') ? 'usina' : id; const c = Math.cos(l.r), s = Math.sin(l.r); const W = (x, y, z) => [l.x + x * c + z * s, y, l.z - x * s + z * c];
      for (const p of PONTOS_ATIVOS[id] || []) add(id, p.tipo, p.pos, p.tipo === 'esteira' ? [0.878 * c, 0.479, -0.878 * s] : [0, 0, 0]);
      const g = GALPAO[tipo]; if (g) { add(id, 'luz', W(0, g[1] * 0.35, g[0] / 2 + 0.07)); add(id, 'alerta', W(0, g[1] + (tipo === 'usina' ? 0.3 : 0.28), 0)); }
      if (tipo === 'horto') { add(id, 'cultivo', W(0, 0.28, 0)); add(id, 'alerta', W(0.8, 0.62, 0)); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(O, 3)); geo.setAttribute('aOrig', new THREE.Float32BufferAttribute(O, 3)); geo.setAttribute('aDir', new THREE.Float32BufferAttribute(D, 3)); geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(I, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(-25.6, 0.8, 14.8), 8);
    this.on = new Float32Array(48);
    this.mat = new THREE.ShaderMaterial({ vertexShader: AV, fragmentShader: AF, uniforms: { uT: { value: 0 }, uOn: { value: this.on }, uEsc: { value: 400 }, uPR: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
    this.pontos = new THREE.Points(geo, this.mat); this.pontos.name = 'canteiro-vivo'; this.pontos.renderOrder = 5; this.pontos.userData.semHAO = true; this.pontos.visible = false;
    this.group = new THREE.Group(); this.group.name = 'atividade'; this.group.add(this.pontos);
  }
  // 'produzindo' | 'parado' | 'cheio' | 'fora'
  set(id, estado) { this.estado[id] = estado; }
  update(dt, t, engine) {
    let algum = false; const k = 1 - Math.exp(-2.5 * dt);
    for (let i = 0; i < this.em.length; i++) {
      const e = this.em[i], st = this.estado[e.id]; const alvo = e.tipo === 'alerta' ? (st === 'cheio' ? 1 : 0) : st === 'produzindo' ? 1 : 0;
      e.k += (alvo - e.k) * k; if (e.k < 0.002 && alvo === 0) e.k = 0; this.on[i] = e.k; if (e.k > 0) algum = true;
    }
    this.pontos.visible = algum; if (!algum) return;
    const c = engine.camera; const U = this.mat.uniforms; U.uT.value = t / 1000; U.uPR.value = engine.pr || 1; U.uEsc.value = (engine.H || 720) / (2 * Math.tan((c.fov * Math.PI) / 360));
  }
}

// Modelo do epílogo (etapas sem peça própria): foco e âncora sobre o canteiro, para a prancha e os balões
export function modeloReflorestar() {
  const root = new THREE.Group(); root.name = 'reflorestar'; const e0 = new THREE.Group(), e1 = new THREE.Group(); root.add(e0, e1);
  return { id: 'reflorestar', root, partes: { e0, e1 }, esqueletos: {}, grua: {}, foco: { x: -25.5, z: 15, dist: 16 }, ancora: [-25.5, 2.2, 15] };
}
