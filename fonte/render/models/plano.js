// Plano diretor em 3D: o que dá forma às quadras e liga a Arcologia à cidade.
//   base (sempre): postes no anel viário e na avenida, renques de árvores na avenida e ao longo do eixo, o meio-fio da
//     ilha da rotatória e as saídas asfaltadas do anel viário até os bairros e o porto (fora da mesa)
//   eixo (com as etapas da praça): e1 bancos e postes do eixo monumental; e2 os espelhos d'água com repuxos dos dois
//     lados do Bulevar e do Passeio da Holding; e3 o Marco da Holding na ilha da rotatória (chafariz redondo e a agulha
//     branca com o guarda-chuva dourado no topo)
import * as THREE from 'three';
import { A, PASSARELAS, ZONAS, EIXO, AVENIDA, ROTATORIA, SAIDAS, MESA } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { beams } from '../geom.js';
import { treeGroup } from '../forest.js';
import { heightAt } from '../ground.js';
import { alturaArredor } from '../arredores.js';
import { rng, inPoly, inEllipse } from '../../core/util.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
function plate(pts, y, h, mat) { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2); return mesh(g, mat); }
const ret = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const distLinha = (x, z, l) => { let d = 1e9; for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i]; const vx = b[0] - a[0], vz = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz || 1))); d = Math.min(d, Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t)); } return d; };
const asfalto = () => M._asfalto || (M._asfalto = new THREE.MeshStandardMaterial({ color: 0x52565e, roughness: 0.92 }));

// pontos a cada passo ao longo de uma polilinha (fechada ou não): [x, z, tx, tz]
function aoLongo(pts, passo, fechada, fase = 0) {
  const l = fechada ? [...pts, pts[0]] : pts; const out = []; let prox = fase;
  let acc = 0; for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i]; const s = Math.hypot(b[0] - a[0], b[1] - a[1]); while (prox <= acc + s) { const t = (prox - acc) / s; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / s, (b[1] - a[1]) / s]); prox += passo; } acc += s; }
  return out;
}

export function plano() {
  const root = new THREE.Group(); root.name = 'plano'; const base = new THREE.Group(); base.name = 'plano-base'; root.add(base);
  const eixo = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() }; for (const g of Object.values(eixo)) { g.visible = false; root.add(g); }
  const R = rng(5150); const pass = Object.values(PASSARELAS).map((p) => p.pts);
  const fora = ['gorilas', 'bioma', 'santuario', 'sede', 'canteiro', 'acelerador', 'praca'].map((id) => ZONAS.filter((Z) => Z.id === id)).flat();
  const naZona = (x, z) => fora.some((Z) => (Z.poly ? inPoly(x, z, Z.poly) : inEllipse(x, z, Z.elipse[0][0], Z.elipse[0][1], Z.elipse[1], Z.elipse[2], Z.elipse[3] || 0)));
  const livre = (x, z, m = 1.2) => !naZona(x, z) && pass.every((l) => distLinha(x, z, l) > m) && distLinha(x, z, A.uni.elo) > 1.4 && x > MESA.x0 + 0.6 && x < MESA.x1 - 0.6 && z > MESA.z0 + 0.6 && z < MESA.z1 - 0.6;
  // postes: anel viário (lado de dentro) e avenida (dos dois lados)
  const postes = [], luz = [];
  const poste = (x, z) => { const y = heightAt(x, z); postes.push([[x, y, z], [x, y + 0.95, z]]); luz.push([x, y + 0.98, z]); };
  const anel = A.vias.find((v) => v.id === 'anel'); const [cx, cz] = [(MESA.x0 + MESA.x1) / 2, (MESA.z0 + MESA.z1) / 2];
  for (const [x, z, tx, tz] of aoLongo(anel.pts, 4.6, true, 1)) { let nx = -tz, nz = tx; if (nx * (cx - x) + nz * (cz - z) < 0) { nx = -nx; nz = -nz; } const px = x + nx * 1.05, pz = z + nz * 1.05; if (SAIDAS.some((q) => distLinha(px, pz, q.pts) < 1.6)) continue; poste(px, pz); }
  for (const lado of [-1, 1]) for (let x = -37; x <= 37; x += 4.2) { if (Math.abs(x) < 5.2) continue; const z = AVENIDA.z + lado * (AVENIDA.w / 2 + 0.55); if (!naZona(x, z)) poste(x, z); }
  base.add(beams(postes, 0.018, M.steelDark, 4));
  const gl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 8, 6), M.lampGlow, luz.length); const m4 = new THREE.Matrix4(); luz.forEach((p, i) => gl.setMatrixAt(i, m4.makeTranslation(...p))); gl.userData.semHAO = true; base.add(gl);
  // renques: avenida (dos dois lados, por fora dos postes) e o eixo (entre o piso e a margem verde)
  const arv = [];
  for (const lado of [-1, 1]) for (let x = -36.2; x <= 36.2; x += 2.4) { if (Math.abs(x) < 6.2) continue; const z = AVENIDA.z + lado * (AVENIDA.w / 2 + 1.45); if (livre(x, z)) arv.push({ x, z, y: heightAt(x, z), s: 0.36 + R() * 0.06, kind: 'folha', pal: 'jardim', h: 1.15 }); }
  for (const lado of [-1, 1]) for (const [z0, z1] of [[5.4, 14.2], [EIXO.z0 + 0.8, -3.4]]) for (let z = z0; z <= z1 + 0.01; z += 1.5) { const x = lado * (EIXO.meia + 0.75); arv.push({ x, z, y: 0, s: 0.32 + R() * 0.05, kind: 'folha', pal: 'jardim', h: 1.1 }); }
  base.add(treeGroup(arv, { trunks: true, name: 'renques' }));
  // meio-fio branco da ilha da rotatória
  { const g = new THREE.RingGeometry(ROTATORIA.ilha - 0.1, ROTATORIA.ilha + 0.04, 64); g.rotateX(-Math.PI / 2); const m = mesh(g, M.whiteSmooth, false); m.position.set(ROTATORIA.c[0], 0.03, ROTATORIA.c[1]); base.add(m); }
  // saídas asfaltadas até a cidade (fora da mesa: acompanham o terreno dos arredores), com as bordas claras
  for (const q of SAIDAS) {
    const [a, b] = q.pts; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L; const nx = -tz, nz = tx;
    const dentro = (x, z) => x > MESA.x0 && x < MESA.x1 && z > MESA.z0 && z < MESA.z1; const n = Math.ceil(L / 0.5);
    for (const [w, mat, dy] of [[0.78, M.whiteSmooth, 0.025], [0.62, asfalto(), 0.035]]) {
      const P = [], I = []; for (let i = 0; i <= n; i++) { const x = a[0] + tx * (L * i) / n, z = a[1] + tz * (L * i) / n; for (const s of [-1, 1]) { const px = x + nx * w * s, pz = z + nz * w * s; P.push(px, (dentro(px, pz) ? heightAt(px, pz) : alturaArredor(px, pz)) + dy, pz); } if (i) { const k = (i - 1) * 2; I.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); if (g.attributes.normal.getY(0) < 0) { g.setIndex(I.map((_, j) => I[j - (j % 3) + [0, 2, 1][j % 3]])); g.computeVertexNormals(); }
      base.add(mesh(g, mat, false));
    }
  }
  // e1: bancos brancos e postes baixos ao longo do eixo (dos dois lados do piso)
  { const pos = [], lz = []; for (const lado of [-1, 1]) for (const [z0, z1] of [[5.6, 14.0], [EIXO.z0 + 0.6, -3.4]]) for (let z = z0; z <= z1 + 0.01; z += 2.1) { pos.push([lado * (EIXO.meia - 0.35), z]); lz.push([[lado * (EIXO.meia - 0.1), 0, z + 1.05], [lado * (EIXO.meia - 0.1), 0.62, z + 1.05]]); }
    const bg = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.12, 0.62), M.whiteSmooth, pos.length); pos.forEach(([x, z], i) => bg.setMatrixAt(i, m4.makeTranslation(x, 0.06, z))); bg.castShadow = true; bg.receiveShadow = true; eixo.e1.add(bg);
    eixo.e1.add(beams(lz, 0.014, M.steelDark, 4)); const lg = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), M.lampGlow, lz.length); lz.forEach(([, [x, y, z]], i) => lg.setMatrixAt(i, m4.makeTranslation(x, y + 0.03, z))); lg.userData.semHAO = true; eixo.e1.add(lg); }
  // e2: espelhos d'água dos dois lados do Bulevar e do Passeio da Holding, com repuxos
  { const jatos = []; const jato = dupla(M.glassRail);
    for (const lado of [-1, 1]) for (const [z0, z1] of [[5.8, 13.8], [EIXO.z0 + 0.9, -3.8]]) {
      const x0 = lado > 0 ? 1.25 : -2.35, x1 = x0 + 1.1; eixo.e2.add(plate(ret(x0 - 0.1, z0 - 0.1, x1 + 0.1, z1 + 0.1), 0, 0.07, M.whiteSmooth)); eixo.e2.add(plate(ret(x0, z0, x1, z1), 0, 0.075, M.pool));
      for (let z = z0 + 0.5; z < z1; z += 1.1) jatos.push([(x0 + x1) / 2, z]);
    }
    const jg = new THREE.InstancedMesh(new THREE.ConeGeometry(0.035, 0.55, 6, 1, true), jato, jatos.length); jatos.forEach(([x, z], i) => jg.setMatrixAt(i, m4.makeTranslation(x, 0.35, z))); jg.castShadow = false; eixo.e2.add(jg); }
  // e3: Marco da Holding: chafariz redondo na ilha, agulha branca de base quadrada, anéis e o guarda-chuva dourado
  { const [mx, mz] = ROTATORIA.c; const g = new THREE.Group(); g.position.set(mx, 0, mz); eixo.e3.add(g);
    const b = mesh(new THREE.CylinderGeometry(ROTATORIA.ilha - 0.35, ROTATORIA.ilha - 0.3, 0.22, 48), M.whiteSmooth); b.position.y = 0.11; g.add(b);
    const w = new THREE.Mesh(new THREE.CircleGeometry(ROTATORIA.ilha - 0.5, 48), M.pool); w.rotation.x = -Math.PI / 2; w.position.y = 0.2; w.receiveShadow = true; g.add(w);
    const pe = mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.35, 4), M.whiteSmooth); pe.rotation.y = Math.PI / 4; pe.position.y = 0.3; g.add(pe);
    const ag = mesh(new THREE.CylinderGeometry(0.09, 0.3, 3.2, 4), M.whiteSmooth); ag.rotation.y = Math.PI / 4; ag.position.y = 0.45 + 1.6; g.add(ag);
    for (const y of [1.2, 2.4]) { const an = new THREE.Mesh(new THREE.TorusGeometry(0.24 - y * 0.05, 0.025, 4, 16), M.ouro || M.yellow); an.rotation.x = Math.PI / 2; an.position.y = 0.45 + y; g.add(an); }
    const gc = mesh(new THREE.ConeGeometry(0.42, 0.22, 8), M.ouro || M.yellow); gc.position.y = 3.78; g.add(gc); const cabo = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), M.ouro || M.yellow); cabo.position.y = 3.95; g.add(cabo);
    const jt = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; jt.push([Math.cos(a) * 1.3, Math.sin(a) * 1.3]); }
    const jg = new THREE.InstancedMesh(new THREE.ConeGeometry(0.04, 0.8, 6, 1, true), dupla(M.glassRail), jt.length); jt.forEach(([x, z], i) => jg.setMatrixAt(i, m4.makeTranslation(x, 0.6, z))); jg.castShadow = false; g.add(jg); }
  // setEixo(n): as n primeiras partes do eixo prontas (a fusão do mundo esconde a fonte: vale o userData.feito)
  return { root, base, eixo, setEixo(n) { let mudou = false; for (const [k, g] of Object.entries(eixo)) { const f = n >= +k.slice(1); if (!!g.userData.feito !== f) { g.userData.feito = f; g.visible = f; mudou = true; } } return mudou; } };
}
