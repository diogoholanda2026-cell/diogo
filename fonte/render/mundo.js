// Mundo: monta todas as estruturas da composição, liga cada etapa à sua peça 3D, mostra/esconde
// conforme o progresso e anima o que tem vida (fauna, manadas, água).
import * as THREE from 'three';
import { faixas } from './models/aneis.js';
import { biblioteca, crd } from './models/biblioteca.js';
import { bioma, anfiteatro, gorilas, acelerador, savana, santuarioInterior, CasasVila } from './models/leste.js';
import { ciencias, alaOnda, lago, sedePatio } from './models/centro.js';
import { escola, campo, engenharia, instituto, gramadoUni } from './models/campus.js';
import { praca, passarela, ponteCoberta } from './models/praca.js';
import { LOTES, predioCanteiro, ambienteCanteiro } from './models/canteiro.js';
import { PASSARELAS } from '../data/planta.js';
import { Crowd } from './figuras.js';
import { inPoly } from '../core/util.js';
import { bake } from './geom.js';

// junta geometrias (com matrizes e cor opcional por item) numa só
function fundirLista(list) {
  let nv = 0, ni = 0; const temCor = list.some(([g, , c]) => c || (g.attributes.color && g.attributes.color.itemSize === 3));
  for (const [g] of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), C = temCor ? new Float32Array(nv * 3) : null; const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3(); let vo = 0, io = 0;
  for (const [g, m, c] of list) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, col = g.attributes.color && g.attributes.color.itemSize === 3 ? g.attributes.color : null; nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); P[(vo + i) * 3] = v.x; P[(vo + i) * 3 + 1] = v.y; P[(vo + i) * 3 + 2] = v.z;
      if (n) { v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); N[(vo + i) * 3] = v.x; N[(vo + i) * 3 + 1] = v.y; N[(vo + i) * 3 + 2] = v.z; }
      if (uv) { U[(vo + i) * 2] = uv.getX(i); U[(vo + i) * 2 + 1] = uv.getY(i); }
      if (C) { let r = 1, gg = 1, b = 1; if (col) { r = col.getX(i); gg = col.getY(i); b = col.getZ(i); } if (c) { r *= c[0]; gg *= c[1]; b *= c[2]; } C[(vo + i) * 3] = r; C[(vo + i) * 3 + 1] = gg; C[(vo + i) * 3 + 2] = b; }
    }
    if (g.index) { const idx = g.index.array; for (let k = 0; k < idx.length; k++) I[io + k] = idx[k] + vo; io += idx.length; } else { for (let k = 0; k < p.count; k++) I[io + k] = vo + k; io += p.count; }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); if (C) out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.setIndex(new THREE.BufferAttribute(I, 1)); out.computeBoundingSphere(); out.computeBoundingBox(); return out;
}

export class Mundo {
  constructor(engine, ground, forest) {
    this.e = engine; this.ground = ground; this.forest = forest; const scene = engine.scene;
    this.root = new THREE.Group(); this.root.name = 'mundo'; scene.add(this.root);
    // edifícios-fita (módulos por nível)
    this.faixas = faixas(); this.faixas.onda = alaOnda(); this.casas = new CasasVila();
    const FP = { sede: 'sede', humanidades: 'humanidades', onda: 'onda', uniElo: 'uniElo' };
    for (const [k, f] of Object.entries(this.faixas)) { this.root.add(f.group); f.refresh(); f.group.userData.pick = FP[k] ? { tipo: 'proj', id: FP[k] } : { tipo: 'modulos', id: k }; }
    this.root.add(this.casas.group); this.casas.group.userData.pick = { tipo: 'modulos', id: 'casas' };
    // marcos com etapas
    const list = [biblioteca(), crd(), bioma(), anfiteatro(), gorilas(), acelerador(), savana(), santuarioInterior(), ciencias(), lago(ground), sedePatio(), escola(), campo(), engenharia(), instituto(), gramadoUni(), praca(), ponteCoberta()];
    for (const id of Object.keys(PASSARELAS)) list.push(passarela(id));
    const PROJ_DE = { sedePatio: 'sede' };
    this.modelos = {}; for (const m of list) { this.modelos[m.id] = m; this.root.add(m.root); m.root.userData.pick = { tipo: 'proj', id: PROJ_DE[m.id] || m.id }; for (const p of Object.values(m.partes)) { bake(p); p.visible = false; } for (const s of Object.values(m.esqueletos || {})) { bake(s); s.visible = false; } }
    // canteiro de obras
    this.canteiro = new THREE.Group(); this.canteiro.name = 'canteiro'; this.root.add(this.canteiro); this.canteiro.add(ambienteCanteiro()); this.predios = {};
    for (const [id, l] of Object.entries(LOTES)) { const g = predioCanteiro(id.startsWith('usina') ? 'usina' : id); g.position.set(l.x, 0, l.z); g.rotation.y = l.r; g.visible = false; g.userData.pick = { tipo: 'predio', id }; this.canteiro.add(g); this.predios[id] = g; }
    // pessoas na praça e nas passarelas
    this.povo = new Crowd('pessoa', 260); this.povo.mesh.visible = false; this.root.add(this.povo.mesh); this.povoAreas = [];
    this.animados = [];
  }
  parte(modelo, etapa) { return this.modelos[modelo]?.partes[etapa]; }
  setEtapa(modelo, etapa, feito) {
    const p = this.parte(modelo, etapa); if (!p) return; p.visible = feito; p.userData.feito = feito;
    if (feito && p.userData.chao) { this.ground.flags[p.userData.chao] = true; this.ground.paint(); }
    if (feito && p.userData.nivel && modelo === 'lago') this.ground.lake.position.y = -0.1;
    if (!feito && p.userData.nivel && modelo === 'lago') this.ground.lake.position.y = -0.3;
    this._animados(); this.e.shadowDirty = true;
  }
  _animados() { this.animados = []; for (const m of Object.values(this.modelos)) for (const p of Object.values(m.partes)) if (p.visible && (p.userData.manadas || p.userData.update)) this.animados.push(p); }
  // tudo concluído (a composição da foto)
  tudoPronto() {
    for (const f of Object.values(this.faixas)) f.setTodos(f.max); this.casas.setTodos(this.casas.max);
    for (const [id, m] of Object.entries(this.modelos)) for (const k of Object.keys(m.partes)) this.setEtapa(id, k, true);
    this.refundir();
    this.ground.flags.praca = true; this.ground.flags.verde = Object.fromEntries(['anel', 'uni', 'ciencias', 'sede', 'biblio', 'savana', 'bioma', 'vila', 'gorilas', 'acelerador', 'santuario'].map((k) => [k, true])); this.ground.paint(); this.ground.lake.position.y = -0.1; this.ground.tampa.visible = false;
    this.povoar();
  }
  povoar() {
    this.povo.clear(); const pr = this.modelos.praca.partes.e3;
    if (pr.visible) { const poly = pr.userData.pessoas.area; for (let i = 0; i < 70; i++) { const pts = []; let x = 4, z = 15; for (let k = 0; k < 4; k++) { let nx, nz, t = 0; do { nx = -2.5 + Math.random() * 14; nz = 12 + Math.random() * 7; t++; } while (!inPoly(nx, nz, poly) && t < 30); pts.push([nx, 0.03, nz]); } this.povo.add(pts, { speed: 0.1 + Math.random() * 0.08, idle: 1 }); } }
    for (const m of Object.values(this.modelos)) if (m.caminho && m.partes.e1.visible) for (let i = 0; i < 6; i++) this.povo.add(m.caminho, { speed: 0.12 + Math.random() * 0.06, phase: Math.random() });
    this.povo.mesh.visible = this.povo.walkers.length > 0;
  }
  // Funde tudo o que está pronto e parado num punhado de malhas por material (poucas chamadas
  // de desenho no celular). As peças originais ficam guardadas e escondidas.
  refundir() {
    if (this.fundido) { this.root.remove(this.fundido); for (const c of this.fundido.children) c.geometry.dispose(); }
    const fontes = [];
    for (const m of Object.values(this.modelos)) for (const p of Object.values(m.partes)) if (p.userData.feito && !p.userData.manadas && !p.userData.update) { p.visible = true; fontes.push(p); }
    for (const f of Object.values(this.faixas)) { f.merged.visible = true; f.extras.visible = true; fontes.push(f.merged, f.extras); }
    this.casas.group.visible = true; fontes.push(this.casas.group);
    for (const g of Object.values(this.predios)) if (g.userData.pronto) { g.visible = true; fontes.push(g); }
    this.root.updateMatrixWorld(true);
    const grupos = new Map(); const m4 = new THREE.Matrix4(), mi = new THREE.Matrix4(), cor = new THREE.Color();
    const add = (geo, mat, matrix, cast, c) => { if (Array.isArray(mat)) return false; const k = mat.uuid + (cast ? 'c' : 'n'); let g = grupos.get(k); if (!g) grupos.set(k, (g = { mat, cast, list: [] })); g.list.push([geo, matrix, c]); return true; };
    const anda = (o) => { if (!o.visible) return; if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, mi); const w = new THREE.Matrix4().multiplyMatrices(o.matrixWorld, mi); let c = null; if (o.instanceColor) { o.getColorAt(i, cor); c = [cor.r, cor.g, cor.b]; } add(o.geometry, o.material, w, o.castShadow, c); } return; } if (o.isMesh && !o.material.transparent) add(o.geometry, o.material, o.matrixWorld.clone(), o.castShadow, null); else if (o.isMesh) add(o.geometry, o.material, o.matrixWorld.clone(), o.castShadow, null); for (const c of o.children) anda(c); };
    for (const f of fontes) anda(f);
    this.fundido = new THREE.Group(); this.fundido.name = 'fundido';
    for (const { mat, cast, list } of grupos.values()) { const g = fundirLista(list); const mesh = new THREE.Mesh(g, mat); mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; this.fundido.add(mesh); }
    this.root.add(this.fundido);
    for (const f of fontes) f.visible = false;
    this.e.shadowDirty = true;
    return this.fundido.children.length;
  }
  // Planta holográfica da composição total (tudo pronto), numa única malha azul translúcida.
  fantasma() {
    if (this._fantasma) return this._fantasma;
    this.root.updateMatrixWorld(true); const list = []; const mi = new THREE.Matrix4(); const I = new THREE.Matrix4();
    const anda = (o) => { if (o.isInstancedMesh) { if (o.count > 400) return; for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, mi); list.push([o.geometry, new THREE.Matrix4().multiplyMatrices(o.matrixWorld, mi), null]); } return; } if (o.isMesh && !o.material.transparent) list.push([o.geometry, o.matrixWorld.clone(), null]); for (const c of o.children) anda(c); };
    for (const m of Object.values(this.modelos)) for (const p of Object.values(m.partes)) anda(p);
    for (const f of Object.values(this.faixas)) for (let i = 0; i < f.mods.length; i++) for (const g of f._geo(i, f.max).values()) list.push([g, I, null]);
    const casas = new THREE.Group(); casas.position.copy(this.casas.group.position); casas.rotation.copy(this.casas.group.rotation); for (const m of this.casas.mods) casas.add(this.casas._casa(m, this.casas.max)); casas.updateMatrixWorld(true); anda(casas);
    const geo = fundirLista(list); geo.deleteAttribute('uv'); if (geo.attributes.color) geo.deleteAttribute('color');
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4fc8ff), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 6; mesh.frustumCulled = false; mesh.visible = false; this.root.add(mesh); this._fantasma = mesh; return mesh;
  }
  mostrarFantasma(on, ms = 900) {
    const f = this.fantasma(); const mat = f.material; const de = f.visible ? mat.opacity : 0, para = on ? 0.16 : 0; f.visible = true; const t0 = performance.now();
    const passo = (t) => { const k = Math.min(1, (t - t0) / ms); mat.opacity = de + (para - de) * k; if (k < 1) requestAnimationFrame(passo); else if (!on) f.visible = false; }; requestAnimationFrame(passo);
  }
  update(dt, t) {
    for (const p of this.animados) { if (p.userData.manadas) for (const m of p.userData.manadas) m.update(dt, t); if (p.userData.update) p.userData.update(t); }
    if (this.povo.mesh.visible) this.povo.update(dt, t);
  }
}
