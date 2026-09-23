// Edifício-fita em terraços dividido em módulos (como as zonas residenciais do BuildIt):
// cada módulo sobe um andar por nível. Os módulos estáveis são fundidos por material.
import * as THREE from 'three';
import { sweep, terraceFloor, skeletonFloor, subPath, pathLength, normals, merge, beams, FH } from '../geom.js';
import { M } from '../materials.js';
import { treeGroup } from '../forest.js';
import { hash } from '../../core/util.js';

export class Faixa {
  // def: { id, path, closed, prof:{o0,o1,setIn,setOut,fac,facIn,roof,y0,fh}, modulos|cortes, arbustos }
  constructor(def) {
    this.def = def; this.id = def.id; this.group = new THREE.Group(); this.group.name = def.id;
    this.L = pathLength(def.path, def.closed);
    const n = def.modulos || 1; const cuts = def.cortes || Array.from({ length: n + 1 }, (_, i) => i / n);
    this.mods = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const s0 = cuts[i], s1 = cuts[i + 1]; const gap = def.gap ?? 0;
      const path = subPath(def.path, def.closed, s0 + gap / this.L, s1 - gap / this.L, Math.max(6, Math.ceil(((s1 - s0) * this.L) / 0.22)));
      this.mods.push({ i, s0, s1, path, u0: s0 * this.L, nivel: 0, emObra: false });
    }
    this.prof = { fac: 'fac_quente', roof: 'roof', ...def.prof };
    this.cache = new Map();
    this.merged = new THREE.Group(); this.merged.name = def.id + '-fundido'; this.group.add(this.merged);
    this.soltos = new THREE.Group(); this.group.add(this.soltos);
    this.lotes = new THREE.Group(); this.lotes.name = def.id + '-lotes'; this.group.add(this.lotes);
    this.extras = new THREE.Group(); this.group.add(this.extras);
  }
  get max() { return this.def.niveis || 5; }
  _geo(i, F) {
    const k = i + ':' + F; if (this.cache.has(k)) return this.cache.get(k);
    const m = this.mods[i]; const E = []; for (let f = 0; f < F; f++) E.push(...terraceFloor(f, F, this.prof));
    const map = sweep(m.path, false, E, { u0: m.u0 }); this.cache.set(k, map); return map;
  }
  // reconstrói a malha fundida com todos os módulos que não estão em obra
  refresh() {
    for (const c of this.merged.children.slice()) { this.merged.remove(c); c.geometry.dispose(); }
    const by = new Map();
    for (const m of this.mods) { if (m.nivel <= 0) continue; for (const [k, g] of this._geo(m.i, m.nivel)) { if (!by.has(k)) by.set(k, []); by.get(k).push([g, new THREE.Matrix4()]); } }
    for (const [k, list] of by) { const mesh = new THREE.Mesh(merge(list), M[k] || M.white); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.matKey = k; this.merged.add(mesh); }
    this._extras(); this._lotes();
  }
  setNivel(i, n) { this.mods[i].nivel = n; this.refresh(); }
  setTodos(n) { for (const m of this.mods) m.nivel = n; this.refresh(); }
  // peças para a obra do andar f (0..) de um módulo que terá F andares
  andar(i, f, F) {
    const m = this.mods[i]; const acabado = new THREE.Group(); const esqueleto = new THREE.Group();
    for (const [k, g] of sweep(m.path, false, terraceFloor(f, F, this.prof), { u0: m.u0 })) { const mesh = new THREE.Mesh(g, M[k] || M.white); mesh.castShadow = true; mesh.receiveShadow = true; acabado.add(mesh); }
    const p = this.prof; const fh = p.fh || FH; const y0 = (p.y0 || 0) + f * fh;
    for (const [k, g] of sweep(m.path, false, skeletonFloor(f, p))) { const mesh = new THREE.Mesh(g, M.concreto); mesh.castShadow = true; esqueleto.add(mesh); }
    const outer = p.o1 - (p.setOut || 0) * f - 0.06, inner = p.o0 + (p.setIn || 0) * f + 0.06;
    const nor = normals(m.path, false); const pairs = [];
    for (let k = 0; k < m.path.length; k += 3) { const [x, z] = m.path[k], [nx, nz] = nor[k]; for (const o of [outer, inner]) pairs.push([[x + nx * o, y0, z + nz * o], [x + nx * o, y0 + fh, z + nz * o]]); }
    esqueleto.add(beams(pairs, 0.035, M.concreto, 5));
    esqueleto.visible = false;
    return { acabado, esqueleto, caminho: { path: m.path, closed: false, o: p.o1 + 0.2 } };
  }
  // contorno do lote vazio (planta no chão)
  _lotes() {
    for (const c of this.lotes.children.slice()) { this.lotes.remove(c); c.geometry?.dispose(); }
    const p = this.prof; const y = (p.y0 || 0) + 0.035;
    for (const m of this.mods) {
      if (m.nivel > 0 || m.emObra || !m.lote) continue;
      const E = [{ a: [p.o0, y], b: [p.o1, y], mat: 'fill', uv: 'plan' }];
      const E2 = [{ a: [p.o1 - 0.16, y + 0.003], b: [p.o1, y + 0.003], mat: 'line', uv: 'plan' }, { a: [p.o0, y + 0.003], b: [p.o0 + 0.16, y + 0.003], mat: 'line', uv: 'plan' }];
      for (const [k, g] of sweep(m.path, false, [...E, ...E2], { caps: false })) { const mesh = new THREE.Mesh(g, k === 'line' ? M.loteLinha : M.loteFill); mesh.renderOrder = 3; this.lotes.add(mesh); }
    }
  }
  // arbustos nos terraços e pessoas (a partir do nível 3)
  _extras() {
    for (const c of this.extras.children.slice()) this.extras.remove(c);
    if (this.def.arbustos === false) return;
    const p = this.prof; const fh = p.fh || FH; const list = [];
    for (const m of this.mods) {
      if (m.nivel < 3) continue; const nor = normals(m.path, false); const F = m.nivel;
      for (let f = 0; f < F - 1; f++) {
        const yT = (p.y0 || 0) + (f + 1) * fh; const inA = p.o0 + (p.setIn || 0) * f, inB = p.o0 + (p.setIn || 0) * (f + 1);
        const ouA = p.o1 - (p.setOut || 0) * f, ouB = p.o1 - (p.setOut || 0) * (f + 1);
        for (let k = 1; k < m.path.length - 1; k += 2) {
          const h = hash(k, f * 7 + m.i, 91); if (h < 0.45) continue; const [x, z] = m.path[k], [nx, nz] = nor[k];
          if (inB - inA > 0.12) { const o = (inA + inB) / 2 + (hash(k, f, 92) - 0.5) * (inB - inA) * 0.5; list.push({ x: x + nx * o, z: z + nz * o, y: yT, s: 0.09 + hash(k, f, 93) * 0.07, kind: 'folha', pal: 'jardim', h: 0.9 }); }
          if (ouA - ouB > 0.12 && h > 0.7) { const o = (ouA + ouB) / 2; list.push({ x: x + nx * o, z: z + nz * o, y: yT, s: 0.08 + hash(k, f, 94) * 0.05, kind: 'folha', pal: 'jardim' }); }
        }
      }
      if (m.nivel >= 5) { const yR = (p.y0 || 0) + F * fh + 0.08; const oo = (p.o0 + (p.setIn || 0) * (F - 1) + p.o1 - (p.setOut || 0) * (F - 1)) / 2; for (let k = 2; k < m.path.length - 2; k += 5) { if (hash(k, m.i, 95) < 0.5) continue; const [x, z] = m.path[k], [nx, nz] = nor[k]; list.push({ x: x + nx * oo, z: z + nz * oo, y: yR, s: 0.1 + hash(k, 1, 96) * 0.06, kind: 'folha', pal: 'jardim' }); } }
    }
    if (list.length) this.extras.add(treeGroup(list, { name: this.id + '-arbustos', cast: false }));
  }
  // centro aproximado de um módulo (para balões e câmera)
  centro(i) { const m = this.mods[i]; const q = m.path[(m.path.length / 2) | 0]; const nor = normals(m.path, false)[(m.path.length / 2) | 0]; const o = (this.prof.o0 + this.prof.o1) / 2; return [q[0] + nor[0] * o, q[1] + nor[1] * o]; }
  alturaTopo(n) { const p = this.prof; return (p.y0 || 0) + n * (p.fh || FH) + 0.1; }
}
