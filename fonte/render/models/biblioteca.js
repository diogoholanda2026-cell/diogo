// Biblioteca Central (torre redonda de madeira e vidro, pilares-árvore e dossel quadrado de vidro)
// e Centro de Recursos Digitais (abóbada de costelas de madeira sobre o bloco de apoio).
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M } from '../materials.js';
import { beamMatrix, beams, box, merge } from '../geom.js';
import { treeGroup } from '../forest.js';
import { hash } from '../../core/util.js';

export const FHB = 1.0; // pé-direito da biblioteca
function tubeCyl(r, h, mat, seg, uRep, vRep, y) {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, uv.getY(i) * vRep);
  g.translate(0, y + h / 2, 0); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function slab(rx, rz, h, mat, y, rot = 0, seg = 56) {
  const g = new THREE.CylinderGeometry(1, 1, h, seg, 1, false); g.scale(rx, 1, rz); g.rotateY(rot); g.translate(0, y + h / 2, 0);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function andares(f0, f1, R) {
  const g = new THREE.Group(); const esq = new THREE.Group();
  for (let f = f0; f < f1; f++) {
    const y = f * FHB; const w = 0.18 * Math.sin(f * 1.7 + 0.4); const rx = R + 0.1 + w, rz = R + 0.1 - w * 0.6; const rot = f * 0.35;
    g.add(slab(rx, rz, 0.1, M.whiteSmooth, y, rot));                                 // laje branca ondulada
    g.add(slab(rx + 0.02, rz + 0.02, 0.05, M.fascia, y + 0.1, rot));                  // friso
    const ri = R - 0.32; g.add(tubeCyl(ri, FHB - 0.1, M.fac_madeira, 48, (2 * Math.PI * ri) / (0.34 * 32), 0.5, y + 0.1)); // estantes iluminadas
    const rail = tubeCyl(Math.min(rx, rz) - 0.03, 0.16, M.glassRail, 40, 1, 1, y + 0.1); rail.castShadow = false; g.add(rail); // guarda-corpo
    // aletas verticais de madeira (brises)
    const fins = []; const n = 36; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + f * 0.09; const r = ri + 0.06; fins.push([[Math.cos(a) * r, y + 0.1, Math.sin(a) * r], [Math.cos(a) * r, y + FHB, Math.sin(a) * r]]); }
    g.add(beams(fins, 0.025, M.woodFrame, 4));
    esq.add(slab(R + 0.05, R + 0.05, 0.1, M.concreto, y, 0));
    const cols = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; cols.push([[Math.cos(a) * (R - 0.4), y, Math.sin(a) * (R - 0.4)], [Math.cos(a) * (R - 0.4), y + FHB, Math.sin(a) * (R - 0.4)]]); }
    esq.add(beams(cols, 0.06, M.concreto, 6));
  }
  esq.visible = false;
  return { g, esq };
}

export function biblioteca() {
  const b = A.biblio; const [cx, cz] = b.c; const R = b.r;
  const root = new THREE.Group(); root.name = 'biblioteca'; root.position.set(cx, 0, cz);
  const P = {}; const E = {};
  // e1: fundações e núcleo de concreto (elevadores e escadas)
  P.e1 = new THREE.Group();
  P.e1.add(slab(R + 0.35, R + 0.35, 0.14, M.concreto, -0.04));
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 6.1, 20), M.concreto); core.position.y = 3.05; core.castShadow = true; P.e1.add(core);
  // e2: andares 1 a 3 / e3: andares 4 a 6 (+ terraço-jardim)
  const a1 = andares(0, 3, R); P.e2 = a1.g; E.e2 = a1.esq;
  const a2 = andares(3, 6, R); P.e3 = a2.g; E.e3 = a2.esq;
  P.e3.add(slab(R + 0.05, R + 0.05, 0.12, M.whiteSmooth, 6.0)); const roofG = slab(R - 0.2, R - 0.2, 0.04, M.roof, 6.12); P.e3.add(roofG);
  const sh = []; for (let i = 0; i < 14; i++) { const a = hash(i, 1, 301) * 6.28, r = hash(i, 2, 301) * (R - 0.6) + 0.3; sh.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, y: 6.16, s: 0.16 + hash(i, 3, 301) * 0.12, pal: 'jardim' }); }
  const shrubs = treeGroup(sh, { cast: false }); shrubs.position.set(-cx, 0, -cz); P.e3.add(shrubs);
  // e4: pilares-árvore (troncos inclinados que se abrem em "V" até o dossel)
  P.e4 = new THREE.Group();
  const half = b.canopy / 2, rot = b.canopyRot, top = b.canopyY; const trunks = [], branches = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13; const ar = a - rot; const d = half / Math.max(Math.abs(Math.cos(ar)), Math.abs(Math.sin(ar))) * 0.9;
    const base = [Math.cos(a) * (R + 0.35), 0.1, Math.sin(a) * (R + 0.35)]; const k = 0.62; const rs = R + 0.35 + (d - R - 0.35) * k * 0.8;
    const split = [Math.cos(a) * rs, top * k, Math.sin(a) * rs];
    trunks.push([base, split]);
    for (const da of [-0.13, 0.13]) { const aa = a + da; const ar2 = aa - rot; const d2 = half / Math.max(Math.abs(Math.cos(ar2)), Math.abs(Math.sin(ar2))) * 0.9; branches.push([split, [Math.cos(aa) * d2, top - 0.05, Math.sin(aa) * d2]]); }
  }
  P.e4.add(beams(trunks, 0.1, M.woodFrame, 7)); P.e4.add(beams(branches, 0.065, M.woodFrame, 6));
  // e5: dossel quadrado de vidro com grelha de madeira
  P.e5 = new THREE.Group(); const cano = new THREE.Group(); cano.rotation.y = -rot; cano.position.y = top; P.e5.add(cano);
  const S = b.canopy; const glass = new THREE.Mesh(new THREE.BoxGeometry(S, 0.04, S), M.glass); glass.position.y = 0.1; glass.renderOrder = 3; cano.add(glass);
  const gridG = new THREE.PlaneGeometry(S, S); gridG.rotateX(-Math.PI / 2); const grid = new THREE.Mesh(gridG, M.canopyGrid); grid.position.y = 0.14; grid.castShadow = true; cano.add(grid);
  const beamsC = []; const n = 7; for (let i = 0; i <= n; i++) { const t = -S / 2 + (S * i) / n; beamsC.push([[t, 0, -S / 2], [t, 0, S / 2]]); beamsC.push([[-S / 2, 0, t], [S / 2, 0, t]]); }
  const bm = beams(beamsC, 0.07, M.woodFrame, 4); cano.add(bm);
  for (const [w, d, x, z] of [[S + 0.2, 0.14, 0, S / 2], [S + 0.2, 0.14, 0, -S / 2], [0.14, S, S / 2, 0], [0.14, S, -S / 2, 0]]) { const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), M.woodFrame); e.position.set(x, 0.06, z); e.castShadow = true; cano.add(e); }
  for (const k of Object.keys(P)) root.add(P[k]); for (const k of Object.keys(E)) root.add(E[k]);
  return { id: 'biblioteca', root, partes: P, esqueletos: E, grua: { e2: true, e3: true, e5: true }, foco: { x: cx, z: cz + 1, dist: 18 }, ancora: [cx, 8.2, cz] };
}

// Centro de Recursos Digitais: abóbada larga de costelas de madeira à frente da torre (eixo
// esquerda-direita) e o bloco de apoio branco na ponta direita, com terraço de trabalho.
export function crd() {
  const [cx, cz] = A.biblio.c; const root = new THREE.Group(); root.name = 'crd';
  const o = [cx - 0.2, cz + 4.9]; const ang = -0.32; root.position.set(o[0], 0, o[1]); root.rotation.y = ang;
  const P = {}; const X0 = -3.9, X1 = 2.6, Wd = 4.6;
  // e1: bloco de apoio (3 andares) na ponta direita, avançando para a frente
  P.e1 = new THREE.Group(); const bx = 3.0, bz = 0.7, bw = 3.2, bd = 3.4; const fl = 0.5;
  for (let f = 0; f < 3; f++) {
    const y = f * fl; const sl = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.08, 0.07, bd + 0.08), M.fascia); sl.position.set(bx, y + 0.035, bz); sl.castShadow = true; sl.receiveShadow = true; P.e1.add(sl);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.1, fl - 0.07, bd - 0.1), M.fac_lab); gl.position.set(bx, y + 0.07 + (fl - 0.07) / 2, bz); gl.castShadow = true; P.e1.add(gl);
    const uv = gl.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.33, uv.getY(i) * 0.25);
  }
  const roofS = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.1, 0.08, bd + 0.1), M.whiteSmooth); roofS.position.set(bx, 1.54, bz); roofS.castShadow = true; P.e1.add(roofS);
  const desks = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) desks.push([bx - 1.1 + i * 0.72, bz - 1.2 + j * 0.78]);
  const dim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.05, 0.22), M.whiteSmooth, desks.length); const sim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.1, 0.015), M.cyanGlow, desks.length); const m4 = new THREE.Matrix4();
  desks.forEach(([x, z], i) => { dim.setMatrixAt(i, m4.makeTranslation(x, 1.66, z)); sim.setMatrixAt(i, m4.makeTranslation(x, 1.75, z - 0.08)); }); dim.castShadow = true; P.e1.add(dim);
  // e2: costelas (arcos transversais) com altura em onda ao longo do eixo e terças
  P.e2 = new THREE.Group(); const NR = 15; const arc = []; const ribs = [];
  for (let i = 0; i < NR; i++) {
    const t = i / (NR - 1); const x = X0 + (X1 - X0) * t; const h = 1.35 + 1.05 * Math.sin(Math.PI * Math.pow(t, 0.8)); const w = Wd / 2 * (0.86 + 0.14 * Math.sin(Math.PI * t)); const pts = [];
    for (let k = 0; k <= 16; k++) { const v = -1 + (2 * k) / 16; pts.push(new THREE.Vector3(x + v * 0.35, h * Math.sqrt(Math.max(0, 1 - v * v)) + 0.05, v * w)); }
    arc.push(pts); ribs.push([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.05, 5, false), new THREE.Matrix4()]);
  }
  const ribMesh = new THREE.Mesh(merge(ribs), M.woodFrame); ribMesh.castShadow = true; P.e2.add(ribMesh);
  const purl = []; for (let k = 1; k <= 15; k += 2) for (let i = 1; i < NR; i++) { const a = arc[i - 1][k], c = arc[i][k]; purl.push([[a.x, a.y, a.z], [c.x, c.y, c.z]]); }
  P.e2.add(beams(purl, 0.028, M.woodFrame, 4));
  // e3: vidro da abóbada, mesas internas e telas acesas
  P.e3 = new THREE.Group(); const pos = [], idx = [];
  for (let i = 0; i < NR; i++) for (let k = 0; k <= 16; k++) { const p = arc[i][k]; pos.push(p.x, p.y + 0.01, p.z); }
  for (let i = 0; i < NR - 1; i++) for (let k = 0; k < 16; k++) { const a = i * 17 + k, b2 = a + 1, c = a + 17, d = c + 1; idx.push(a, c, b2, b2, c, d); }
  const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); vg.setIndex(idx); vg.computeVertexNormals();
  const vm = new THREE.Mesh(vg, M.glass); vm.renderOrder = 3; P.e3.add(vm); P.e3.add(sim);
  const inner = []; for (let i = 0; i < 18; i++) inner.push([X0 + 0.6 + (i % 6) * 0.9, -1.2 + ((i / 6) | 0) * 1.2]);
  const it = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.06, 0.3), M.woodLight, inner.length); inner.forEach(([x, z], i) => it.setMatrixAt(i, m4.makeTranslation(x, 0.3, z))); P.e3.add(it);
  const floorV = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Wd * 0.95), M.woodLight); floorV.rotation.x = -Math.PI / 2; floorV.position.set((X0 + X1) / 2, 0.05, 0); floorV.receiveShadow = true; P.e1.add(floorV);
  for (const k of Object.keys(P)) root.add(P[k]);
  const c = new THREE.Vector3(0, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang).add(new THREE.Vector3(o[0], 0, o[1]));
  return { id: 'crd', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: c.x, z: c.z, dist: 12 }, ancora: [c.x, 3.2, c.z] };
}
