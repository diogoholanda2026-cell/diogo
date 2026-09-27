// Plano viário e eixo monumental da Arcologia (Trevo da Holding, plano mestre revisão 6). Carro só no anel viário de
// fora; o eixo x = 0 é de pedestres. O anel viário e o começo das saídas são pintados no terreno (A.vias, ground.js) e o
// gabarito da figura também (P9); aqui ficam as peças em 3D.
//   base (sempre): postes no anel viário (lado de dentro, a cada 4,6, fora das saídas e do acesso do canteiro) e as
//     saídas asfaltadas (SAIDAS) da borda de fora do anel viário até as ruas de borda dos bairros e o porto (fora da mesa
//     acompanham o terreno dos arredores), com as bordas claras
//   eixo (com as etapas da praça: jogo.js chama setEixo(n) e mundo.js funde eixo[k] com userData.feito): e1 balizadores
//     de luz, bancos e os dois pilaretes do portão, ao longo do Caminho da Frente, da esplanada do Bulevar e do eixo
//     norte (margem norte, portal da Sede e poço); e2 renques baixos nos bordos da esplanada e do eixo norte; e3
//     luminárias altas dos dois lados do Bulevar e do eixo norte. Nada sobre as fitas, o lago ou a praça (o Marco da
//     Holding mora na praça, praca.e3)
import * as THREE from 'three';
import { A, SAIDAS, MESA, ANEL_MESTRE, J } from '../../data/planta.js';
import { M } from '../materials.js';
import { beams } from '../geom.js';
import { treeGroup } from '../forest.js';
import { heightAt } from '../ground.js';
import { alturaArredor } from '../arredores.js';
import { rng, inPoly } from '../../core/util.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
const distLinha = (x, z, l) => { let d = 1e9; for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i]; const vx = b[0] - a[0], vz = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz || 1))); d = Math.min(d, Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t)); } return d; };
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
// instâncias de uma geometria em [x, y, z] (sem giro)
function inst(geo, mat, pts, sombra = true) { const im = new THREE.InstancedMesh(geo, mat, pts.length); pts.forEach(([x, y, z], i) => im.setMatrixAt(i, _m4.compose(_v.set(x, y, z), _q.identity(), _s))); im.castShadow = sombra; im.receiveShadow = true; im.computeBoundingSphere(); return im; }

// pontos a cada passo ao longo de uma polilinha (fechada ou não): [x, z, tx, tz]
function aoLongo(pts, passo, fechada, fase = 0) {
  const l = fechada ? [...pts, pts[0]] : pts; const out = []; let prox = fase;
  let acc = 0; for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i]; const s = Math.hypot(b[0] - a[0], b[1] - a[1]); while (prox <= acc + s) { const t = (prox - acc) / s; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / s, (b[1] - a[1]) / s]); prox += passo; } acc += s; }
  return out;
}

// eixo x = 0 no chão: faixas livres de cada trecho (medidas de A)
function trechosEixo() {
  const { c, rx, rz, w } = ANEL_MESTRE, col = A.colunata;
  const faceSul = (x) => c[1] + (rz + J) * Math.sqrt(Math.max(0, 1 - (x / (rx + J)) ** 2)); // face externa sul do Anel (mais a junta)
  const faceN = (x, r, rzz) => c[1] - (rzz + J) * Math.sqrt(Math.max(0, 1 - (x / (r + J)) ** 2)); // faces da Sede (norte)
  const colS = (x) => col.c[1] - Math.sqrt(Math.max(0, (col.r + col.w / 2 + J) ** 2 - x * x)); // borda de fora da colunata
  const N = A.eixoN, sedeIn = (x) => c[1] - (rz - w - J) * Math.sqrt(Math.max(0, 1 - (x / (rx - w - J)) ** 2)); // face interna da Sede (menos a junta)
  return { faceSul, colS, sedeIn, sedeOut: (x) => faceN(x, rx, rz), zN0: N.z0, zN1: N.z1, xN: N.x };
}

export function plano() {
  const root = new THREE.Group(); root.name = 'plano'; const base = new THREE.Group(); base.name = 'plano-base'; root.add(base);
  const eixo = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() }; for (const [k, g] of Object.entries(eixo)) { g.name = 'eixo-' + k; g.visible = false; root.add(g); }
  const R = rng(5150);
  // ---- base: postes no anel viário (lado de dentro), fora das saídas, do acesso do canteiro e do canteiro
  const postes = [], luz = [];
  const poste = (x, z) => { const y = heightAt(x, z); postes.push([[x, y, z], [x, y + 0.95, z]]); luz.push([x, y + 0.98, z]); };
  const anel = A.vias.find((v) => v.id === 'anel'); const [cx, cz] = [(MESA.x0 + MESA.x1) / 2, (MESA.z0 + MESA.z1) / 2]; const ac = A.canteiro.acesso;
  for (const [x, z, tx, tz] of aoLongo(anel.pts, 4.6, true, 1)) {
    let nx = -tz, nz = tx; if (nx * (cx - x) + nz * (cz - z) < 0) { nx = -nx; nz = -nz; } const px = x + nx * 1.05, pz = z + nz * 1.05;
    if (SAIDAS.some((q) => distLinha(px, pz, q.pts) < 1.6) || Math.hypot(px - ac[0], pz - ac[1]) < 1.8 || inPoly(px, pz, A.canteiro.poly)) continue; poste(px, pz);
  }
  base.add(beams(postes, 0.018, M.steelDark, 4));
  { const gl = inst(new THREE.SphereGeometry(0.055, 6, 4), M.lampGlow, luz, false); gl.userData.semHAO = true; base.add(gl); }
  // ---- base: saídas asfaltadas até a cidade (fora da mesa acompanham o terreno dos arredores), com as bordas claras; começam
  //      na borda de fora da pista (o anel viário pintado no terreno fica limpo no encontro)
  for (const q of SAIDAS) {
    const [a0, b] = q.pts; const L0 = Math.hypot(b[0] - a0[0], b[1] - a0[1]); const tx = (b[0] - a0[0]) / L0, tz = (b[1] - a0[1]) / L0; const nx = -tz, nz = tx;
    const a = [a0[0] + (tx * anel.w) / 2, a0[1] + (tz * anel.w) / 2], L = L0 - anel.w / 2;
    const dentro = (x, z) => x > MESA.x0 && x < MESA.x1 && z > MESA.z0 && z < MESA.z1; const n = Math.ceil(L / 0.5);
    for (const [w, mat, dy] of [[0.78, M.whiteSmooth, 0.025], [0.62, M.dark, 0.035]]) {
      const P = [], I = []; for (let i = 0; i <= n; i++) { const x = a[0] + (tx * (L * i)) / n, z = a[1] + (tz * (L * i)) / n; for (const s of [-1, 1]) { const px = x + nx * w * s, pz = z + nz * w * s; P.push(px, (dentro(px, pz) ? heightAt(px, pz) : alturaArredor(px, pz)) + dy, pz); } if (i) { const k = (i - 1) * 2; I.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); if (g.attributes.normal.getY(0) < 0) { g.setIndex(I.map((_, j) => I[j - (j % 3) + [0, 2, 1][j % 3]])); g.computeVertexNormals(); }
      base.add(mesh(g, mat, false));
    }
  }
  // ---- eixo: trechos livres no chão
  const T = trechosEixo(), fr = A.frente.pts, sim = (l) => l.flatMap(([x, ...r]) => [[-x, ...r], [x, ...r]]); // espelha no eixo
  const esp0 = (x) => T.faceSul(x) + 0.3, esp1 = (x) => T.colS(x) - 0.3; // esplanada: da face do Anel até a colunata
  const j0 = T.zN0 - 0.25, j1 = T.sedeIn(T.xN + 0.4) + 0.15, p0 = T.sedeOut(T.xN + 0.4) - 0.15, p1 = T.zN1 + 0.1; // eixo norte: jardim (margem norte -> Sede) e poço (Sede -> poço)
  // e1: balizadores de luz (0,32), bancos brancos com assento de madeira e os pilaretes do portão (0,5)
  { const bal = sim([[3.0, esp0(3.0) + 0.3], [3.0, (esp0(3.0) + esp1(3.0)) / 2], [3.0, esp1(3.0) - 0.3], [0.85, A.colunata.c[1] + A.colunata.r + 0.2], [1.42, j0 - 0.1], [1.42, j1 + 0.35], [1.42, p0 - 0.3], [1.42, (p0 + p1) / 2], [1.42, p1 + 0.25]]);
    const pil = sim([[0.9, fr[0][1] - 0.25]]);
    const ban = sim([[2.15, esp0(2.15) + 1.3], [2.15, esp1(2.15) - 1.2], [1.95, (j0 + j1) / 2], [1.95, p0 - 0.9]]);
    eixo.e1.add(beams([...bal.map(([x, z]) => [[x, -0.02, z], [x, 0.3, z]]), ...pil.map(([x, z]) => [[x, -0.02, z], [x, 0.48, z]])], 0.035, M.whiteSmooth, 6));
    const gl = inst(new THREE.SphereGeometry(0.045, 6, 4), M.lampGlow, [...bal.map(([x, z]) => [x, 0.32, z]), ...pil.map(([x, z]) => [x, 0.52, z])], false); gl.userData.semHAO = true; eixo.e1.add(gl);
    eixo.e1.add(inst(new THREE.BoxGeometry(0.16, 0.1, 0.62), M.whiteSmooth, ban.map(([x, z]) => [x, 0.05, z])), inst(new THREE.BoxGeometry(0.18, 0.03, 0.64), M.madeiraClara, ban.map(([x, z]) => [x, 0.115, z]))); }
  // e2: renques baixos (arbustos em fila) nos bordos da esplanada e dos dois trechos do eixo norte
  { const arb = []; const fila = (x, z0, z1) => { for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += 0.22) for (const s of [-1, 1]) arb.push({ x: s * x + (R() - 0.5) * 0.04, z, y: 0, s: 0.1 + R() * 0.035, kind: 'folhaLow', pal: 'jardim', h: 0.85 }); };
    const xr = 2.45; fila(3.38, esp0(3.38) - 0.1, esp1(3.38)); fila(xr, j0 + 0.1, T.sedeIn(xr + 0.15) + 0.15); fila(xr, T.sedeOut(xr + 0.15) - 0.15, p1); // (as faces da Sede medidas no renque, com a copa)
    eixo.e2.add(treeGroup(arb, { cast: false, name: 'renques-eixo' })); }
  // e3: luminárias altas (poste de 1,15 com a luz em cima) dos dois lados do Bulevar e do eixo norte
  { const lum = sim([[1.5, esp0(1.5) + 0.6], [1.5, (esp0(1.5) + esp1(1.5)) / 2], [1.5, esp1(1.5) - 0.5], [1.58, (j0 + j1) / 2 + 0.3], [1.58, (p0 + p1) / 2 + 0.55]]);
    eixo.e3.add(beams(lum.map(([x, z]) => [[x, -0.02, z], [x, 1.15, z]]), 0.02, M.steelDark, 5), beams(lum.map(([x, z]) => [[x, 1.12, z], [x - Math.sign(x) * 0.14, 1.16, z]]), 0.012, M.steelDark, 4));
    const gl = inst(new THREE.SphereGeometry(0.06, 6, 4), M.lampGlow, lum.map(([x, z]) => [x - Math.sign(x) * 0.14, 1.12, z]), false); gl.userData.semHAO = true; eixo.e3.add(gl); }
  // setEixo(n): as n primeiras partes do eixo prontas (a fusão do mundo esconde a fonte: vale o userData.feito)
  return { root, base, eixo, setEixo(n) { let mudou = false; for (const [k, g] of Object.entries(eixo)) { const f = n >= +k.slice(1); if (!!g.userData.feito !== f) { g.userData.feito = f; g.visible = f; mudou = true; } } return mudou; } };
}
