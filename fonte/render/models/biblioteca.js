// Biblioteca Central (torre em vaso de madeira: lajes brancas onduladas e grossas com floreiras, fachada de
// estantes de madeira atrás de uma treliça diagonal de ripas cruzadas, pilares-árvore inclinados que se abrem
// em "V" e um dossel quadrado de grelha de madeira clara com painéis translúcidos leitosos) e Centro de
// Recursos Digitais (casco longo e baixo de arcos grossos de madeira clara com vidro por cima, apoiado no
// bloco branco de escritório com terraço de trabalho).
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M } from '../materials.js';
import { tex } from '../textures.js';
import { beams, merge } from '../geom.js';
import { treeGroup } from '../forest.js';
import { hash } from '../../core/util.js';

export const FHB = 0.83; // pé-direito da biblioteca (6 andares: a cobertura fica a ~5.1, logo abaixo do dossel)
const raioAndar = (R, f) => R * (0.84 + 0.035 * f); // torre em vaso: mais estreita embaixo
// materiais próprios (uma instância por módulo); os de materials.js têm preferência quando existem
const MAT = {};
const madeira = () => M.madeiraClara || (MAT.madeira ||= new THREE.MeshStandardMaterial({ color: 0xd9b47a, map: tex.veio(), roughness: 0.7 }));
const leitoso = () => M.vidroLeitoso || (MAT.leitoso ||= new THREE.MeshStandardMaterial({ color: 0xaebcc6, roughness: 0.6, metalness: 0.05, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide }));
const vidroCasco = () => (MAT.casco ||= new THREE.MeshStandardMaterial({ color: 0xc8e8f6, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4 }));
function tubeCyl(r, h, mat, seg, uRep, vRep, y) {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, uv.getY(i) * vRep);
  g.translate(0, y + h / 2, 0); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function slab(rx, rz, h, mat, y, rot = 0, seg = 56) {
  const g = new THREE.CylinderGeometry(1, 1, h, seg, 1, false); g.scale(rx, 1, rz); g.rotateY(rot); g.translate(0, y + h / 2, 0);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
// contorno ondulado de uma laje (raio r0 com duas ondas suaves, diferentes a cada andar)
function ondaPts(r0, f, n = 72, k = 1) { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const r = r0 * (1 + k * (0.075 * Math.sin(3 * a + f * 1.1) + 0.04 * Math.sin(5 * a - f * 0.7 + 1))); out.push([Math.cos(a) * r, Math.sin(a) * r]); } return out; }
const raioOnda = (r0, a, f, k = 1) => r0 * (1 + k * (0.075 * Math.sin(3 * a + f * 1.1) + 0.04 * Math.sin(5 * a - f * 0.7 + 1)));
function caminho(pts, P = new THREE.Shape()) { pts.forEach(([x, z], i) => (i ? P.lineTo(x, -z) : P.moveTo(x, -z))); P.closePath(); return P; }
// laje extrudada (com furo opcional: a floreira é um anel), y = base
function lajeOnda(outer, inner, y, h, mat) {
  const s = caminho(outer); if (inner) s.holes.push(caminho(inner, new THREE.Path()));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
// (a fusão do mundo junta as malhas de cada parte por material; as aletas, os pilares e os arbustos de todos os
// andares da parte vão num só grupo de instâncias cada, para a obra não custar uma chamada por andar)
function andares(f0, f1, R, cx, cz) {
  const g = new THREE.Group(); const esq = new THREE.Group(); const arb = [], fins = [], cols = [];
  for (let f = f0; f < f1; f++) {
    const y = f * FHB; const Rf = raioAndar(R, f); const r0 = Rf + 0.14;
    g.add(lajeOnda(ondaPts(r0, f), null, y, 0.15, M.whiteSmooth));                                       // laje branca ondulada e grossa
    g.add(lajeOnda(ondaPts(r0 - 0.02, f), ondaPts(r0 - 0.24, f), y + 0.15, 0.08, M.planter));            // floreira contínua na borda
    const ri = Rf - 0.3; // fachada de estantes (janelas com caixilhos de madeira) atrás de uma treliça fina de madeira
    g.add(tubeCyl(ri, FHB - 0.15, M.fac_madeira, 48, (2 * Math.PI * ri) / (0.34 * 32), 0.5, y + 0.15));
    g.add(tubeCyl(ri + 0.03, FHB - 0.15, M.lattice, 48, (2 * Math.PI * ri) / 0.6, (FHB - 0.15) / 0.6, y + 0.15));
    for (const t of [0.36, 0.68]) g.add(tubeCyl(ri + 0.05, 0.045, madeira(), 40, 1, 1, y + 0.15 + (FHB - 0.15) * t)); // prateleiras (linhas horizontais de madeira)
    // montantes verticais de madeira (brises)
    const n = 44; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + f * 0.09; const r = ri + 0.07; fins.push([[Math.cos(a) * r, y + 0.15, Math.sin(a) * r], [Math.cos(a) * r, y + FHB, Math.sin(a) * r]]); }
    // arbustos na floreira (seguem a onda da laje); parte deles pende para fora da borda
    for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2 + hash(i, f, 311) * 0.2; const pende = hash(i, f, 313) < 0.4; const r = raioOnda(r0, a, f) - 0.13 + (pende ? 0.06 : 0); arb.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, y: y + 0.23 - (pende ? 0.05 : 0), s: 0.085 + hash(i, f, 312) * 0.05, pal: 'jardim', h: 0.8 }); }
    esq.add(slab(Rf + 0.05, Rf + 0.05, 0.1, M.concreto, y, 0));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; cols.push([[Math.cos(a) * (Rf - 0.4), y, Math.sin(a) * (Rf - 0.4)], [Math.cos(a) * (Rf - 0.4), y + FHB, Math.sin(a) * (Rf - 0.4)]]); }
  }
  g.add(beams(fins, 0.024, madeira(), 4)); esq.add(beams(cols, 0.06, M.concreto, 6));
  const ag = treeGroup(arb, { cast: false }); ag.position.set(-cx, 0, -cz); g.add(ag);
  esq.visible = false;
  return { g, esq };
}

export function biblioteca() {
  const b = A.biblio; const [cx, cz] = b.c; const R = b.r;
  const root = new THREE.Group(); root.name = 'biblioteca'; root.position.set(cx, 0, cz);
  const P = {}; const E = {};
  // e1: fundações e núcleo de concreto (elevadores e escadas)
  P.e1 = new THREE.Group();
  P.e1.add(slab(raioAndar(R, 0) + 0.35, raioAndar(R, 0) + 0.35, 0.14, M.concreto, -0.04));
  const HT = 6 * FHB; const core = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, HT + 0.1, 20), M.concreto); core.position.y = (HT + 0.1) / 2; core.castShadow = true; P.e1.add(core);
  // e2: andares 1 a 3 / e3: andares 4 a 6 (+ terraço-jardim)
  const a1 = andares(0, 3, R, cx, cz); P.e2 = a1.g; E.e2 = a1.esq;
  const a2 = andares(3, 6, R, cx, cz); P.e3 = a2.g; E.e3 = a2.esq;
  const Rt = raioAndar(R, 6); P.e3.add(lajeOnda(ondaPts(Rt + 0.1, 6), null, HT, 0.15, M.whiteSmooth)); P.e3.add(lajeOnda(ondaPts(Rt - 0.1, 6), null, HT + 0.15, 0.04, M.roof));
  // e4: pilares-árvore (10 troncos de madeira laminada que sobem inclinados e se abrem em três galhos em "V" sob o
  // dossel) e a treliça diagonal: duas famílias de ripas helicoidais (24 para cada lado) do chão ao dossel, cruzadas em
  // losangos na linha da fachada — uma só malha instanciada
  P.e4 = new THREE.Group();
  const half = b.canopy / 2, rot = b.canopyRot, top = b.canopyY; const trunks = [], branches = [];
  const borda = (a) => { const ar = a - rot; return half / Math.max(Math.abs(Math.cos(ar)), Math.abs(Math.sin(ar))); }; // distância até a borda do dossel
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.13; const k = 0.7; const rs = R + 1.0;
    const base = [Math.cos(a) * (R + 0.45), 0.05, Math.sin(a) * (R + 0.45)]; const split = [Math.cos(a) * rs, top * k, Math.sin(a) * rs];
    trunks.push([base, split]);
    for (const da of [-0.14, 0, 0.14]) { const aa = a + da; const d2 = borda(aa) * (da ? 0.96 : 0.8); branches.push([split, [Math.cos(aa) * d2, top - 0.05, Math.sin(aa) * d2]]); }
  }
  P.e4.add(beams(trunks, 0.085, madeira(), 7)); P.e4.add(beams(branches, 0.055, madeira(), 6));
  const ripas = []; const NS = 24, SEG = 16, yTop = top - 0.12;
  for (let s = 0; s < NS; s++) for (const dir of [1, -1]) {
    const a0 = (s / NS) * Math.PI * 2 + (dir > 0 ? 0 : 0.13); let prev = null;
    for (let k = 0; k <= SEG; k++) { const y = 0.05 + ((yTop - 0.05) * k) / SEG; const a = a0 + (dir * y) / 2.4; const r = raioAndar(R, y / FHB) - 0.18; const p = [Math.cos(a) * r, y, Math.sin(a) * r]; if (prev) ripas.push([prev, p]); prev = p; }
  }
  P.e4.add(beams(ripas, 0.035, madeira(), 4));
  // e5: dossel quadrado — painéis translúcidos leitosos (cinza-azulado) numa grelha de madeira clara com vigas
  // principais e secundárias, beiral generoso e fascia de madeira; apoiado nos pilares-árvore, acima da torre
  P.e5 = new THREE.Group(); const cano = new THREE.Group(); cano.rotation.y = -rot; cano.position.y = top; P.e5.add(cano);
  const S = b.canopy; const glass = new THREE.Mesh(new THREE.BoxGeometry(S, 0.04, S), leitoso()); glass.position.y = 0.1; glass.renderOrder = 3; cano.add(glass);
  const gridG = new THREE.PlaneGeometry(S, S); gridG.rotateX(-Math.PI / 2); const grid = new THREE.Mesh(gridG, M.canopyGrid); grid.position.y = 0.14; grid.castShadow = true; cano.add(grid);
  const beamsC = []; const n = 12; for (let i = 0; i <= n; i++) { const t = -S / 2 + (S * i) / n; beamsC.push([[t, 0, -S / 2], [t, 0, S / 2]]); beamsC.push([[-S / 2, 0, t], [S / 2, 0, t]]); }
  const beamsS = []; for (let i = 0; i < n; i++) { const t = -S / 2 + (S * (i + 0.5)) / n; beamsS.push([[t, 0.06, -S / 2], [t, 0.06, S / 2]]); beamsS.push([[-S / 2, 0.06, t], [S / 2, 0.06, t]]); }
  cano.add(beams(beamsC, 0.045, madeira(), 4)); cano.add(beams(beamsS, 0.02, madeira(), 3));
  for (const [w, d, x, z] of [[S + 0.14, 0.14, 0, S / 2], [S + 0.14, 0.14, 0, -S / 2], [0.14, S, S / 2, 0], [0.14, S, -S / 2, 0]]) { const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), madeira()); e.position.set(x, 0.07, z); e.castShadow = true; cano.add(e); }
  P.e5.userData.semHAO = true; // o dossel fica fora do mapa de alturas (senão escurece a praça embaixo)
  for (const k of Object.keys(P)) root.add(P[k]); for (const k of Object.keys(E)) root.add(E[k]);
  return { id: 'biblioteca', root, partes: P, esqueletos: E, grua: { e2: true, e3: true, e5: true }, foco: { x: cx, z: cz + 1, dist: 18 }, ancora: [cx, top + 0.6, cz] };
}

// Centro de Recursos Digitais: casco longo e baixo de arcos grossos de madeira clara à frente da torre (eixo
// esquerda-direita), com vidro bem transparente por cima e um prédio de 3 pisos por dentro; os últimos arcos passam
// por cima do bloco branco de 4 andares (faixas de janela escuras), cujo terraço de trabalho tem mesas e gente.
export function crd() {
  const cr = A.biblio.crd || { c: [A.biblio.c[0] - 0.2, A.biblio.c[1] + 4.9], rot: -0.32 }; const root = new THREE.Group(); root.name = 'crd';
  const o = cr.c; const ang = cr.rot; root.position.set(o[0], 0, o[1]); root.rotation.y = ang;
  const P = {}; const X0 = -4.6, X1 = 4.2, Wd = 4.2;
  // e1: bloco de apoio (4 andares) na ponta direita, avançando para a frente, e o piso do casco
  P.e1 = new THREE.Group(); const bx = 4.5, bz = 1.4, bw = 2.6, bd = 2.8; const fl = 0.5; const topoB = 4 * fl + 0.04;
  for (let f = 0; f < 4; f++) {
    const y = f * fl; const sl = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.08, 0.07, bd + 0.08), M.fascia); sl.position.set(bx, y + 0.035, bz); sl.castShadow = true; sl.receiveShadow = true; P.e1.add(sl);
    const wb = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.1, fl - 0.07, bd - 0.1), M.whiteSmooth); wb.position.set(bx, y + 0.07 + (fl - 0.07) / 2, bz); wb.castShadow = true; P.e1.add(wb);
    const jan = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.08, 0.17, bd - 0.08), M.dark); jan.position.set(bx, y + 0.3, bz); P.e1.add(jan); // faixa de janela escura
  }
  const roofS = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.1, 0.08, bd + 0.1), M.whiteSmooth); roofS.position.set(bx, topoB - 0.04, bz); roofS.castShadow = true; P.e1.add(roofS);
  const desks = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) desks.push([bx - 0.95 + i * 0.63, bz - 1.1 + j * 0.44]);
  const dim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.05, 0.18), M.whiteSmooth, desks.length); const sim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.09, 0.015), M.cyanGlow, desks.length); const m4 = new THREE.Matrix4();
  desks.forEach(([x, z], i) => { dim.setMatrixAt(i, m4.makeTranslation(x, topoB + 0.12, z)); sim.setMatrixAt(i, m4.makeTranslation(x, topoB + 0.2, z - 0.07)); }); dim.castShadow = true; P.e1.add(dim);
  // escada externa no canto do bloco (lances de degraus brancos)
  const deg = []; for (let k = 0; k < 16; k++) deg.push([bx + bw / 2 + 0.16, 0.06 + k * (topoB / 16), bz - bd / 2 + 0.2 + k * 0.14]);
  const dg = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.04, 0.16), M.whiteSmooth, deg.length); deg.forEach((p, i) => dg.setMatrixAt(i, m4.makeTranslation(...p))); dg.castShadow = true; P.e1.add(dg);
  // gente no terraço (área em coordenadas do mundo; o mundo povoa se a parte estiver pronta)
  const w = (x, z) => { const c = Math.cos(ang), s = Math.sin(ang); return [+(o[0] + x * c + z * s).toFixed(2), +(o[1] - x * s + z * c).toFixed(2)]; };
  P.e1.userData.pessoas = { area: [w(bx - 1.2, bz - 1.2), w(bx + 1.2, bz - 1.2), w(bx + 1.2, bz + 1.2), w(bx - 1.2, bz + 1.2)], y: topoB + 0.02, n: 20 };
  // e2: arcos grossos de madeira clara (transversais, achatados) com altura em onda suave ao longo do eixo, e terças
  P.e2 = new THREE.Group(); const NR = 28, NK = 16; const arc = []; const ribs = [];
  const noBloco = (x, z) => x > bx - bw / 2 - 0.05 && x < bx + bw / 2 + 0.05 && z > bz - bd / 2 - 0.05 && z < bz + bd / 2 + 0.05;
  for (let i = 0; i < NR; i++) {
    const t = i / (NR - 1); const x = X0 + (X1 - X0) * t; const h = 1.9 + 0.5 * Math.sin(Math.PI * Math.pow(t, 0.8)); const wd = Wd / 2 * (0.86 + 0.14 * Math.sin(Math.PI * t)); const pts = [];
    for (let k = 0; k <= NK; k++) { const v = -1 + (2 * k) / NK; const z = v * wd; let y = h * Math.pow(Math.max(0, 1 - v ** 4), 0.25) + 0.05; if (noBloco(x + v * 0.25, z)) y = Math.max(y, topoB + 0.06); pts.push(new THREE.Vector3(x + v * 0.25, y, z)); }
    arc.push(pts); ribs.push([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.045, 5, false), new THREE.Matrix4()]);
  }
  const ribMesh = new THREE.Mesh(merge(ribs), madeira()); ribMesh.castShadow = true; P.e2.add(ribMesh);
  const purl = []; for (let k = 1; k < NK; k++) for (let i = 1; i < NR; i++) { const a = arc[i - 1][k], c = arc[i][k]; purl.push([[a.x, a.y, a.z], [c.x, c.y, c.z]]); }
  P.e2.add(beams(purl, 0.02, madeira(), 3));
  P.e2.userData.semHAO = true;
  // e3: vidro do casco (bem transparente: vê-se o piso de trabalho), o prédio de 3 pisos por dentro (lajes brancas e
  // faixas de vidro), mesas e telas
  P.e3 = new THREE.Group(); const pos = [], idx = [];
  for (let i = 0; i < NR; i++) for (let k = 0; k <= NK; k++) { const p = arc[i][k]; pos.push(p.x, p.y + 0.01, p.z); }
  for (let i = 0; i < NR - 1; i++) for (let k = 0; k < NK; k++) { const a = i * (NK + 1) + k, b2 = a + 1, c = a + NK + 1, d = c + 1; idx.push(a, c, b2, b2, c, d); }
  const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); vg.setIndex(idx); vg.computeVertexNormals();
  const vm = new THREE.Mesh(vg, vidroCasco()); vm.renderOrder = 3; P.e3.add(vm); P.e3.add(sim);
  const xa = X0 + 0.3, xb = X1 - 1.8, lw = Wd * 0.7; // lajes a 0.6 e 1.2 e cobertura a 1.66, com faixas de vidro entre elas
  for (const [y, hf] of [[0.05, 0.5], [0.6, 0.5], [1.2, 0.4]]) {
    if (y > 0.1) { const l = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, 0.06, lw), M.whiteSmooth); l.position.set((xa + xb) / 2, y, 0); l.castShadow = true; l.receiveShadow = true; P.e3.add(l); }
    const fx = new THREE.Mesh(new THREE.BoxGeometry(xb - xa - 0.1, hf, lw - 0.1), M.fac_lab); fx.position.set((xa + xb) / 2, y + 0.03 + hf / 2, 0); const uv = fx.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.55, 0.25 + uv.getY(i) * 0.25); P.e3.add(fx);
  }
  const cob = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, 0.05, lw), M.whiteSmooth); cob.position.set((xa + xb) / 2, 1.66, 0); cob.castShadow = true; cob.receiveShadow = true; P.e3.add(cob);
  const inner = []; for (let i = 0; i < 18; i++) inner.push([xa + 0.5 + (i % 6) * ((xb - xa - 1) / 5), -1.0 + ((i / 6) | 0) * 1.0]);
  const it = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.06, 0.3), M.woodLight, inner.length); inner.forEach(([x, z], i) => it.setMatrixAt(i, m4.makeTranslation(x, 1.72, z * 0.9))); P.e3.add(it);
  const floorV = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Wd * 0.95), M.woodLight); floorV.rotation.x = -Math.PI / 2; floorV.position.set((X0 + X1) / 2, 0.05, 0); floorV.receiveShadow = true; P.e1.add(floorV);
  for (const k of Object.keys(P)) root.add(P[k]);
  const c = new THREE.Vector3(0, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang).add(new THREE.Vector3(o[0], 0, o[1]));
  return { id: 'crd', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: c.x, z: c.z, dist: 12 }, ancora: [c.x, 3.2, c.z] };
}
