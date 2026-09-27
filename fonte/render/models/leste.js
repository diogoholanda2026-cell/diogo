// Norte e pátio leste do Trevo da Holding (plano mestre, revisão 6), tudo em coordenadas do mundo e medidas de A:
// - Acelerador (fim do eixo norte): e1 poço oval com a parede de contenção clara debaixo de uma coroa branca, rampa na
//   parede leste e guarda-corpo de vidro; e2 anel azul com colares no fundo, a linha de luz ciano em volta do contorno
//   (A.luz) e o injetor reto no piso do eixo norte, numa malha só; e3 detectores em camadas, racks e as 4 claraboias de
//   vidro aceso na linha (a do portão embutida no Caminho da Frente); e4 Centro de Física Avançada: crescente de vidro em fita (Faixa de 1 módulo, teto verde,
//   friso claro) com a seção do Elo do Santuário, cujos braços chegam de ponta, e os dois bosquetes norte.
// - Anfiteatro da Vila (pátio leste, espelho do Pátio da Escola): ferradura de 4 degraus no lado norte, virada para o
//   sul (a câmera vê a plateia), palco de madeira com fundo curvo de vidro e pórtico de luzes.
import * as THREE from 'three';
import { A, FITAS, J } from '../../data/planta.js';
import { M } from '../materials.js';
import { beams, merge, medidas } from '../geom.js';
import { treeGroup } from '../forest.js';
import { heightAt } from '../ground.js';
import { hash, TAU } from '../../core/util.js';
import { Faixa } from './faixa.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
const rad = (a) => (a * Math.PI) / 180;
const _up = new THREE.Vector3(0, 1, 0), _um = new THREE.Vector3(1, 1, 1);
// geometria de listas (posição e índice; uv opcional; normais calculadas se não vierem)
function geo(p, idx, uv = null, n = null) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); if (n) g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); else g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}
// vira todos os triângulos se o maior dos primeiros não olha para quer(centróide) ([x, y, z])
function orienta(p, idx, quer) {
  let best = 0, s = 0;
  for (let t = 0; t < Math.min(idx.length, 90); t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3; const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, m = Math.hypot(nx, ny, nz); if (m <= best) continue;
    const q = quer([(p[a] + p[b] + p[c]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3]); best = m; s = nx * q[0] + ny * q[1] + nz * q[2];
  }
  if (s < 0) for (let t = 0; t < idx.length; t += 3) { const q = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = q; }
  return idx;
}
// faixa vertical numa elipse (c, rx, rz) de y0 a y1, de a0 a a1 (radianos); dentro: face para o centro
function parede(cx, cz, rx, rz, y0, y1, mat, a0 = 0, a1 = TAU, seg = 72, dentro = false) {
  const p = [], uv = [], idx = []; let s = 0, px = 0, pz = 0;
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg, x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz; if (i) s += Math.hypot(x - px, z - pz); px = x; pz = z;
    p.push(x, y0, z, x, y1, z); uv.push(s / 1.5, y0 / 1.5, s / 1.5, y1 / 1.5); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  orienta(p, idx, ([x, , z]) => { const d = [(x - cx) / (rx * rx), 0, (z - cz) / (rz * rz)]; return dentro ? [-d[0], 0, -d[2]] : d; });
  return mesh(geo(p, idx, uv), mat);
}
// coroa horizontal entre as elipses r0 = [rx, rz] e r1 no nível y, de a0 a a1 (radianos), face para cima
function plano(cx, cz, r0, r1, y, mat, a0 = 0, a1 = TAU, seg = 72, cast = false) {
  const p = [], uv = [], n = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg, c = Math.cos(a), s = Math.sin(a); const x0 = cx + c * r0[0], z0 = cz + s * r0[1], x1 = cx + c * r1[0], z1 = cz + s * r1[1];
    p.push(x0, y, z0, x1, y, z1); n.push(0, 1, 0, 0, 1, 0); uv.push(x0 / 2.2, z0 / 2.2, x1 / 2.2, z1 / 2.2); if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
  orienta(p, idx, () => [0, 1, 0]); return mesh(geo(p, idx, uv, n), mat, cast);
}
// disco elíptico plano (piso), face para cima
function disco(cx, cz, rx, rz, y, mat, seg = 64) {
  const p = [cx, y, cz], uv = [cx / 2.2, cz / 2.2], n = [0, 1, 0], idx = [];
  for (let i = 0; i <= seg; i++) { const a = (i / seg) * TAU, x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz; p.push(x, y, z); uv.push(x / 2.2, z / 2.2); n.push(0, 1, 0); if (i) idx.push(0, i + 1, i); }
  orienta(p, idx, () => [0, 1, 0]); return mesh(geo(p, idx, uv, n), mat, false);
}
// rampa elíptica: coroa de r0 a r1 com a altura de y0 (em a0) a y1 (em a1); parapeito: faixa de altura h em cima
// da borda r (rampaParede)
function rampa(cx, cz, r0, r1, y0, y1, a0, a1, seg, mat) {
  const p = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg, a = a0 + (a1 - a0) * t, y = y0 + (y1 - y0) * t, c = Math.cos(a), s = Math.sin(a); p.push(cx + c * r0[0], y, cz + s * r0[1], cx + c * r1[0], y, cz + s * r1[1]); uv.push(t * 12, 0, t * 12, 1); if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } }
  orienta(p, idx, () => [0, 1, 0]); return mesh(geo(p, idx, uv), mat);
}
function rampaParede(cx, cz, r, y0, y1, h, a0, a1, seg, mat, dentro) {
  const p = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg, a = a0 + (a1 - a0) * t, y = y0 + (y1 - y0) * t, x = cx + Math.cos(a) * r[0], z = cz + Math.sin(a) * r[1]; p.push(x, y, z, x, y + h, z); uv.push(t * 12, 0, t * 12, 1); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
  orienta(p, idx, ([x, , z]) => { const d = [(x - cx) / (r[0] * r[0]), 0, (z - cz) / (r[1] * r[1])]; return dentro ? [-d[0], 0, -d[2]] : d; });
  return mesh(geo(p, idx, uv), mat);
}
// faixa plana de largura w ao longo de [[x, z]] (normal para cima), altura yDe(x, z) por vértice; fechada: o 1º ponto
// repete o último e as pontas usam os vizinhos do laço. Acumula em acc { p, n, i } (várias faixas numa geometria)
function faixaPlana(acc, pts, w, yDe, fechada = false) {
  const N = pts.length, h = w / 2, b = acc.p.length / 3;
  for (let k = 0; k < N; k++) {
    const a = pts[k > 0 ? k - 1 : fechada ? N - 2 : 0], c = pts[k < N - 1 ? k + 1 : fechada ? 1 : N - 1]; let tx = c[0] - a[0], tz = c[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const [x, z] = pts[k]; for (const s of [1, -1]) { const px = x + tz * h * s, pz = z - tx * h * s; acc.p.push(px, yDe(px, pz), pz); acc.n.push(0, 1, 0); }
    if (k) { const q = b + k * 2; acc.i.push(q - 2, q - 1, q, q - 1, q + 1, q); }
  }
  return acc;
}
// anel de pontos [x, z] de uma elipse (áreas de pessoas)
function anelPts(cx, cz, rx, rz, n, inverso = false) { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU * (inverso ? -1 : 1); out.push([+(cx + Math.cos(a) * rx).toFixed(3), +(cz + Math.sin(a) * rz).toFixed(3)]); } return out; }
// distância de p a uma polilinha e o ponto mais perto
function maisPerto(p, pts) {
  let d = 1e9, m = null;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], vx = b[0] - a[0], vz = b[1] - a[1], l = vx * vx + vz * vz; const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / l)) : 0; const q = [a[0] + vx * t, a[1] + vz * t], e = Math.hypot(p[0] - q[0], p[1] - q[1]); if (e < d) { d = e; m = q; } }
  return [d, m];
}
// matriz de uma peça em (x, y, z) com o eixo y local na direção dir ([x, y, z])
const pose = (x, y, z, dir) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromUnitVectors(_up, new THREE.Vector3(...dir).normalize()), _um);

// ---------------- Acelerador de Partículas Subterrâneo e Centro de Física Avançada ----------------
// O terreno (malha de 0,5, recortada pelo centróide de cada triângulo) entra até 0,35 na elipse do poço e o buraco passa
// até 0,27 dela: a parede de contenção fica COROA para dentro da elipse, debaixo da borda da coroa branca, e o piso cinza
// em volta vai até 0,46 para fora.
const COROA = 0.3;
const B_PE = medidas({ o0: 0, o1: 0 }).B; // rodapé (beiral do térreo) padrão das fitas
// crescente do Centro de Física: a seção do Elo do Santuário (praca.js, pasFaixa com FAIXA_PAS.elo: largura 1,5, beiral
// 0,1, laje 0,05, floreira 0,04 x 0,08, passeio de 0,5 no meio do teto verde, topo 1,6), do chão, com vidro nas duas
// faces: laje, floreira e passeio continuam do braço para o crescente na mesma altura (1,65)
const profCrescente = (cr) => ({ o0: -cr.w / 2, o1: cr.w / 2, fh: cr.h, setIn: 0, setOut: 0, beiral: 0.1, slab: 0.05, curb: 0.04, curbW: 0.08, passeioW: 0.5, passeioAt: 0.5,
  fac: 'vidroEspelhado', facIn: 'vidroEspelhado', caminho: 'caminhoTeto' });
// a linha de luz passa por cima do Caminho da Frente (faixa embutida no piso); fora dele, a luzH do chão
const naFrente = (x, z) => { const f = A.frente; return maisPerto([x, z], f.pts)[0] <= f.w / 2 + 0.02; };
const yLuz = (x, z) => Math.max(0, heightAt(x, z)) + (naFrente(x, z) ? Math.max(A.acelerador.luzH, A.frente.h + 0.006) : A.acelerador.luzH);
// Claraboia: os pontos de A caem na linha de luz, 0,25 fora da face da fita (o raio de 0,5 entraria no rodapé dela). Cada
// uma sai ao longo da reta que vem do caminho mais perto até ficar a J do rodapé padrão (B_PE, o maior; colunata, Elo e
// crescente têm 0,1) das fitas, da colunata, do Elo e do crescente. Com B_PE o aro sai inteiro da linha e um ramal liga os
// dois; se a planta afastar a linha, o empurrão zera sozinho (e a linha passa sob o disco, que fica acima dela).
function lugarClaraboia(p, r) {
  const cams = [...FITAS.map((k) => [A[k].caminho, A[k].w]), ...Object.values(A.colunata.caminhos).map((c) => [c, A.colunata.w]), ...Object.values(A.eloSant.caminhos).map((c) => [c, A.eloSant.w]), [A.acelerador.crescente.caminho, A.acelerador.crescente.w]];
  let q = [p[0], p[1]];
  for (let it = 0; it < 4; it++) {
    let falta = 0, dir = null;
    for (const [cam, w] of cams) { const [d, m] = maisPerto(q, cam); const f = w / 2 + B_PE + J + r - d; if (f > falta && d > 1e-6) { falta = f; dir = [(q[0] - m[0]) / d, (q[1] - m[1]) / d]; } }
    if (!dir) break; q = [q[0] + dir[0] * (falta + 0.005), q[1] + dir[1] * (falta + 0.005)];
  }
  return q;
}
// crescente de vidro (Faixa de 1 módulo no nível 1): malhas por material, arbustos das floreiras e a caixa pronta
function crescente() {
  const cr = A.acelerador.crescente; const F = new Faixa({ id: 'crescente', closed: false, path: cr.caminho, modulos: 1, ponta: 0, passo: 0.4, niveis: 1, andaresExtra: 0, prof: profCrescente(cr), ripas: false, arbustoPasso: 0.7, arbustoMax: 60 });
  F.setTodos(1); const g = new THREE.Group(); for (const o of [...F.merged.children, ...F.extras.children]) g.add(o);
  return { g, caixa: F.caixa(0, 1), prof: F.prof };
}
// Acelerador: poço (A.acelerador.poco), anel e detectores no fundo, linha de luz (A.luz) com o injetor, claraboias,
// crescente e bosquetes norte
export function acelerador() {
  const a = A.acelerador, po = a.poco, [cx, cz] = po.c, D = po.fundo; const root = new THREE.Group(); root.name = 'acelerador'; const P = {};
  const ex = po.rx - COROA, ez = po.rz - COROA, rxB = po.rx + 0.1, rzB = po.rz + 0.1; // parede de contenção e borda de fora da coroa
  // ---- e1: escavação: parede clara com duas faixas brancas, piso, coroa, piso cinza em volta, rampa e guarda-corpo
  P.e1 = new THREE.Group();
  P.e1.add(parede(cx, cz, ex, ez, -D, 0.06, M.fasciaBeiral, 0, TAU, 72, true));
  P.e1.add(parede(cx, cz, ex - 0.006, ez - 0.006, -0.08, 0.06, M.whiteSmooth, 0, TAU, 72, true)); P.e1.add(parede(cx, cz, ex - 0.006, ez - 0.006, -D / 2 - 0.03, -D / 2 + 0.03, M.whiteSmooth, 0, TAU, 72, true));
  P.e1.add(disco(cx, cz, ex, ez, -D, M.concreto));
  P.e1.add(plano(cx, cz, [ex, ez], [rxB, rzB], 0.06, M.whiteSmooth)); P.e1.add(parede(cx, cz, rxB, rzB, -0.02, 0.06, M.whiteSmooth));
  P.e1.add(plano(cx, cz, [rxB, rzB], [po.rx + 0.46, po.rz + 0.46], 0.012, M.caminhoTeto));
  const q0 = rad(-80), q1 = rad(40), ri = [ex - 0.34, ez - 0.34], ro = [ex - 0.02, ez - 0.02]; // rampa: do nor-nordeste (coroa) ao sudeste (fundo)
  { P.e1.add(rampa(cx, cz, ri, ro, 0.06, -D, q0, q1, 40, M.caminhoTeto)); P.e1.add(rampaParede(cx, cz, ri, 0.06, -D, 0.12, q0, q1, 40, M.whiteSmooth, true));
    const pt = (r, t, dy) => { const an = q0 + (q1 - q0) * t; return [cx + Math.cos(an) * r[0], 0.06 + (-D - 0.06) * t + dy, cz + Math.sin(an) * r[1]]; }; const cor = [], pst = [];
    for (let i = 0; i < 16; i++) { const t0 = i / 16, t1 = (i + 1) / 16; cor.push([pt(ri, t0, 0.34), pt(ri, t1, 0.34)], [pt(ro, t0, 0.34), pt(ro, t1, 0.34)]); }
    for (let i = 0; i <= 10; i++) pst.push([pt(ri, i / 10, 0.12), pt(ri, i / 10, 0.34)]);
    P.e1.add(beams([...cor, ...pst], 0.01, M.whiteSmooth, 4)); }
  { // guarda-corpo de vidro na borda, aberto na chegada da rampa
    const g0 = q0 + rad(14), g1 = q0 - rad(4) + TAU, rg = [ex + 0.03, ez + 0.03]; const vid = parede(cx, cz, rg[0], rg[1], 0.06, 0.4, M.glassRail, g0, g1, 64); vid.castShadow = false; P.e1.add(vid);
    const pp = (t, y) => [cx + Math.cos(g0 + (g1 - g0) * t) * rg[0], y, cz + Math.sin(g0 + (g1 - g0) * t) * rg[1]]; const par = [];
    for (let i = 0; i < 28; i++) par.push([pp(i / 28, 0.42), pp((i + 1) / 28, 0.42)]); for (let i = 0; i <= 14; i++) par.push([pp(i / 14, 0.06), pp(i / 14, 0.42)]);
    P.e1.add(beams(par, 0.012, M.whiteSmooth, 4)); }
  P.e1.userData.pessoas = { area: [...anelPts(cx, cz, po.rx + 0.42, po.rz + 0.42, 28), ...anelPts(cx, cz, po.rx + 0.14, po.rz + 0.14, 28, true)], y: 0.012, n: 10 };
  // ---- e2: anel azul com colares sobre apoios brancos, o tubo até a parede sul, e a linha de luz com o injetor (1 malha)
  P.e2 = new THREE.Group(); const ax = cx - 0.1, az = cz, Rx = 1.2, Rz = 0.92, yA = -D + 0.3;
  P.e2.add(plano(ax, az, [Rx - 0.16, Rz - 0.16], [Rx + 0.16, Rz + 0.16], -D + 0.012, M.whiteSmooth));
  { const tor = new THREE.TorusGeometry(1, 0.09, 8, 64); tor.rotateX(Math.PI / 2); tor.scale(Rx, 1, Rz); tor.translate(ax, yA, az); P.e2.add(mesh(tor, M.blue)); }
  { const col = new THREE.CylinderGeometry(0.13, 0.13, 0.07, 10), apo = new THREE.BoxGeometry(0.07, 1, 0.07); const lc = [], la = [];
    for (let i = 0; i < 20; i++) { const t = (i / 20) * TAU, x = ax + Math.cos(t) * Rx, z = az + Math.sin(t) * Rz; lc.push([col, pose(x, yA, z, [-Math.sin(t) * Rx, 0, Math.cos(t) * Rz])]); if (i % 2 === 0) la.push([apo, new THREE.Matrix4().makeScale(1, yA - 0.1 + D, 1).setPosition(x, -D + (yA - 0.1 + D) / 2, z)]); }
    P.e2.add(mesh(merge(lc), M.whiteSmooth)); P.e2.add(mesh(merge(la), M.whiteSmooth)); }
  { const zS = cz + ez, zR = az + Rz; const tb = new THREE.CylinderGeometry(0.05, 0.05, zS - zR, 8); tb.rotateX(Math.PI / 2); tb.translate(ax, yA, (zS + zR) / 2); P.e2.add(mesh(tb, M.blue));
    const pl = new THREE.BoxGeometry(0.34, 0.34, 0.04); pl.translate(ax, yA, zS - 0.03); P.e2.add(mesh(pl, M.whiteSmooth)); }
  { const acc = faixaPlana({ p: [], n: [], i: [] }, a.luz, a.luzW, yLuz, true); faixaPlana(acc, a.injetor.pts, a.injetor.w, yLuz);
    const luz = mesh(geo(acc.p, acc.i, null, acc.n), M.cyanGlow, false); luz.name = 'linha-de-luz'; P.e2.add(luz); }
  const caixaPoco = new THREE.Box3(new THREE.Vector3(cx - po.rx - 0.5, -D, cz - po.rz - 0.5), new THREE.Vector3(cx + po.rx + 0.5, 0.6, cz + po.rz + 0.5));
  P.e2.userData.caixaObra = caixaPoco.clone().expandByPoint(new THREE.Vector3(a.injetor.pts[0][0], 0, a.injetor.pts[0][1])); // a obra fica no poço e no eixo, não no contorno inteiro
  // ---- e3: detectores em camadas (barris coaxiais no feixe) nos pontos oeste e norte do anel, racks, luminárias e as 4
  // claraboias de vidro aceso na linha de luz
  P.e3 = new THREE.Group(); const cam = new Map(); const pc = (mat, g, m) => { if (!cam.has(mat)) cam.set(mat, []); cam.get(mat).push([g, m]); };
  const detector = (x, z, eixo, camadas) => { // camadas: [raio, comprimento, material, lados], de fora para dentro
    for (const [r, l, mat, n] of camadas) { const g = new THREE.CylinderGeometry(r, r, l, n); pc(mat, g, pose(x, yA, z, eixo)); }
    const r0 = camadas[0][0], berco = new THREE.BoxGeometry(eixo[0] ? camadas[0][1] * 0.8 : r0 * 1.5, yA - r0 + D + 0.02, eixo[0] ? r0 * 1.5 : camadas[0][1] * 0.8); pc(M.whiteSmooth, berco, new THREE.Matrix4().makeTranslation(x, -D + (yA - r0 + D + 0.02) / 2, z));
  };
  detector(ax - Rx, az, [0, 0, 1], [[0.3, 0.5, M.whiteSmooth, 8], [0.23, 0.66, M.blue, 12], [0.16, 0.8, M.ouro, 12], [0.05, 1.0, M.steelDark, 8]]);
  detector(ax, az - Rz, [1, 0, 0], [[0.25, 0.42, M.ouro, 8], [0.19, 0.56, M.whiteSmooth, 12], [0.12, 0.7, M.blue, 12], [0.05, 0.86, M.steelDark, 8]]);
  for (let i = 0; i < 4; i++) { // racks de computação com a tela ciano voltada para o anel
    const t = rad(108 + i * 12), x = cx + Math.cos(t) * ex * 0.84, z = cz + Math.sin(t) * ez * 0.84, ry = Math.atan2(-Math.cos(t) * ez, -Math.sin(t) * ex);
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, -D + 0.15, z); pc(i % 2 ? M.blue : M.whiteSmooth, new THREE.BoxGeometry(0.16, 0.3, 0.18), m);
    pc(M.cyanGlow, new THREE.BoxGeometry(0.1, 0.05, 0.01), new THREE.Matrix4().makeRotationY(ry).setPosition(x - Math.cos(t) * 0.095, -D + 0.22, z - Math.sin(t) * 0.095));
  }
  for (const t of [rad(225), rad(60)]) { const x = cx + Math.cos(t) * ex * 0.85, z = cz + Math.sin(t) * ez * 0.85; pc(M.steelDark, new THREE.CylinderGeometry(0.012, 0.012, 0.6, 5), new THREE.Matrix4().makeTranslation(x, -D + 0.3, z)); pc(M.lampGlow, new THREE.SphereGeometry(0.06, 8, 6), new THREE.Matrix4().makeTranslation(x, -D + 0.64, z)); }
  { const r = a.claraboiaR, rv = r * 0.8, ciano = { p: [], n: [], i: [] }; const L = [];
    for (const p0 of a.claraboias) {
      const q = lugarClaraboia(p0, r), piso = naFrente(q[0], q[1]), yb = Math.max(0, heightAt(q[0], q[1])) + (piso ? A.frente.h : 0); L.push(q);
      const dq = Math.hypot(q[0] - p0[0], q[1] - p0[1]); if (dq > r) faixaPlana(ciano, [p0, [q[0] + ((p0[0] - q[0]) * r) / dq, q[1] + ((p0[1] - q[1]) * r) / dq]], a.luzW, yLuz); // ramal da linha até o aro
      const yl = yb + a.luzH; // aro e disco acima da linha: se ela passar por baixo (empurrão menor que o raio), não disputam a altura
      P.e3.add(plano(q[0], q[1], [rv, rv], [r, r], yl + 0.012, M.whiteSmooth, 0, TAU, 28)); P.e3.add(parede(q[0], q[1], r, r, yb - 0.01, yl + 0.012, M.whiteSmooth, 0, TAU, 28));
      P.e3.add(disco(q[0], q[1], rv, rv, yl + 0.004, M.cyanGlow, 28));
      if (piso) continue; // no Caminho da Frente (portão) a claraboia fica embutida no piso: sem cúpula no caminho de quem chega
      const dom = new THREE.SphereGeometry(rv, 20, 4, 0, TAU, 0, Math.PI / 2); dom.scale(1, 0.14 / rv, 1); dom.translate(q[0], yl + 0.006, q[1]); P.e3.add(mesh(dom, M.glass, false));
    }
    if (ciano.p.length) P.e3.add(mesh(geo(ciano.p, ciano.i, null, ciano.n), M.cyanGlow, false)); P.e3.userData.claraboias = L; }
  for (const [mat, l] of cam) P.e3.add(mesh(merge(l), mat, mat !== M.cyanGlow && mat !== M.lampGlow));
  P.e3.userData.caixaObra = caixaPoco.clone();
  // ---- e4: Centro de Física Avançada: o crescente (Faixa), montantes claros no vidro, friso aceso sob a laje de cima, e os
  // bosquetes norte (massas de copas no jardim entre a Sede e os braços do Elo)
  P.e4 = new THREE.Group(); const cr = a.crescente, C4 = crescente(); P.e4.add(C4.g);
  { const md = medidas(C4.prof), yv = md.slab, yt = md.y(1), rb = md.B + 0.05; const m0 = rad(cr.a0) + rb / cr.r, m1 = rad(cr.a1) - rb / cr.r; // o vidro recua rb nas pontas
    const rO = cr.r + cr.w / 2, rI = cr.r - cr.w / 2; P.e4.add(parede(cr.c[0], cr.c[1], rO + 0.008, rO + 0.008, yt - 0.16, yt, M.fasciaLuz, m0, m1, 40)); P.e4.add(parede(cr.c[0], cr.c[1], rI - 0.008, rI - 0.008, yt - 0.16, yt, M.fasciaLuz, m0, m1, 30, true));
    const mt = new THREE.BoxGeometry(0.035, yt - yv, 0.035), l = []; const n = Math.max(2, Math.round(((m1 - m0) * rO) / 0.5));
    for (let i = 0; i <= n; i++) { const t = m0 + ((m1 - m0) * i) / n; for (const r of [rO + 0.017, rI - 0.017]) l.push([mt, new THREE.Matrix4().makeRotationY(-t).setPosition(cr.c[0] + Math.cos(t) * r, (yv + yt) / 2, cr.c[1] + Math.sin(t) * r)]); }
    P.e4.add(mesh(merge(l), M.whiteSmooth)); }
  { const arv = [];
    for (const [bi, b] of a.bosquesN.entries()) { const n = 11; for (let i = 0; i < n; i++) {
      const u = -0.86 + (1.72 * i) / (n - 1) + (hash(i, bi, 311) - 0.5) * 0.06, meia = b.rz * Math.sqrt(Math.max(0, 1 - u * u)); const s = Math.min(0.36, meia * 0.92); if (s < 0.14) continue;
      const v = (i % 2 ? 1 : -1) * Math.max(0, meia - s) * 0.6; arv.push({ x: b.c[0] + u * b.rx, z: b.c[1] + v, y: 0, s: s * (0.9 + hash(i, bi, 312) * 0.12), h: 1.2 + (meia / b.rz) * 0.5 + hash(i, bi, 313) * 0.2, kind: 'folha', pal: hash(i, bi, 314) < 0.25 ? 'jardim' : 'mata' }); } }
    P.e4.add(treeGroup(arv, { name: 'bosques-norte' })); }
  { const cm = cr.caminho, e = [], d = []; cm.forEach((p, i) => { const q = cm[Math.min(i + 1, cm.length - 1)], o = cm[Math.max(i - 1, 0)], tx = q[0] - o[0], tz = q[1] - o[1], l = Math.hypot(tx, tz); e.push([p[0] + (tz / l) * 0.2, p[1] - (tx / l) * 0.2]); d.push([p[0] - (tz / l) * 0.2, p[1] + (tx / l) * 0.2]); });
    P.e4.userData.pessoas = { area: [...e, ...d.reverse()].map(([x, z]) => [+x.toFixed(3), +z.toFixed(3)]), y: medidas(C4.prof).y(1) + medidas(C4.prof).slab + 0.005, n: 6 }; } // no passeio do teto, entre os braços do Elo
  P.e4.userData.caixaObra = C4.caixa.clone(); // grua e canteiro no crescente
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'acelerador', root, partes: P, esqueletos: {}, grua: { e4: true }, foco: { x: cx, z: cz - 0.8, dist: 13 }, ancora: [cx, 2.4, cz - 0.4] };
}

// ---------------- Anfiteatro da Vila (pátio leste) ----------------
// tampa de uma arquibancada elíptica no ângulo a (graus): polígono [d, y] (d = recuo da borda de fora), face no sentido
// do ângulo crescente (para = 1) ou decrescente (-1)
function tampaRadial(c, rx, rz, poly, a, para, mat) {
  const t = rad(a), ca = Math.cos(t), sa = Math.sin(t); const sg = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([d, y]) => new THREE.Vector2(d, y))));
  const p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const d = p.getX(i), y = p.getY(i); p.setXYZ(i, c[0] + ca * (rx - d), y, c[1] + sa * (rz - d)); }
  orienta(p.array, sg.index.array, () => [-sa * rx * para, 0, ca * rz * para]); sg.deleteAttribute('normal'); sg.computeVertexNormals(); return mesh(sg, mat);
}
// Ferradura rx x rz (largura w) com os degraus de a0 a a1 (lado norte): cada degrau sobe h / degraus, espelhos brancos
// virados para o palco e para a câmera do sul, pisos de concreto, encosto branco atrás, dois corredores de
// meio-degrau, orquestra de piso e público sentado; e2 palco de madeira com fundo curvo de vidro e pórtico de luzes
export function anfiteatro() {
  const an = A.anfiteatro, c = an.c, [cx, cz] = c, n = an.degraus, dr = an.w / n, dh = an.h / n, A0 = rad(an.a0), A1 = rad(an.a1); const root = new THREE.Group(); root.name = 'anfiteatro'; const P = {};
  const ENC = 0.06, HE = 0.15; // encosto (espessura e altura acima do último degrau)
  P.e1 = new THREE.Group();
  for (let k = 0; k < n; k++) { // degrau k (0 = o de dentro, mais baixo): piso e espelho
    const r0 = an.w - k * dr, r1 = Math.max(an.w - (k + 1) * dr, k === n - 1 ? ENC : 0); // recuos da borda de fora
    P.e1.add(plano(cx, cz, [an.rx - r0, an.rz - r0], [an.rx - r1, an.rz - r1], (k + 1) * dh, M.concreto, A0, A1, 48, true));
    P.e1.add(parede(cx, cz, an.rx - r0, an.rz - r0, k * dh, (k + 1) * dh, M.whiteSmooth, A0, A1, 48, true));
  }
  P.e1.add(parede(cx, cz, an.rx, an.rz, 0, an.h + HE, M.concreto, A0, A1, 48)); // costas (para o norte)
  P.e1.add(parede(cx, cz, an.rx - ENC, an.rz - ENC, an.h, an.h + HE, M.whiteSmooth, A0, A1, 48, true)); P.e1.add(plano(cx, cz, [an.rx - ENC, an.rz - ENC], [an.rx, an.rz], an.h + HE, M.whiteSmooth, A0, A1, 48));
  { const poly = [[an.w, 0]]; for (let k = 0; k < n; k++) poly.push([an.w - k * dr, (k + 1) * dh], [k === n - 1 ? ENC : an.w - (k + 1) * dr, (k + 1) * dh]); poly.push([ENC, an.h + HE], [0, an.h + HE], [0, 0]);
    P.e1.add(tampaRadial(c, an.rx, an.rz, poly, an.a0, -1, M.concreto)); P.e1.add(tampaRadial(c, an.rx, an.rz, poly, an.a1, 1, M.concreto)); }
  const CORR = [an.a0 + (an.a1 - an.a0) * 0.3, an.a0 + (an.a1 - an.a0) * 0.7]; // ângulos dos corredores
  { const l = []; // corredores: faixa branca no piso de cada degrau e meio-degrau na metade de trás (escada de 0,1)
    for (const ag of CORR) { const t = rad(ag), ca = Math.cos(t), sa = Math.sin(t), ry = Math.atan2(-ca * an.rz, -sa * an.rx); const em = (d, y, h, p) => [new THREE.BoxGeometry(0.18, h, p), new THREE.Matrix4().makeRotationY(ry).setPosition(cx + ca * (an.rx - d), y, cz + sa * (an.rz - d))];
      for (let k = 0; k < n; k++) { l.push(em(an.w - (k + 0.5) * dr, (k + 1) * dh + 0.004, 0.008, dr)); if (k < n - 1) l.push(em(an.w - (k + 0.75) * dr, (k + 1) * dh + dh / 4, dh / 2, dr / 2)); }
      l.push(em(an.w + 0.12, 0.02, 0.04, 0.24)); } // soleira na orquestra
    P.e1.add(mesh(merge(l), M.whiteSmooth)); }
  P.e1.add(disco(cx, cz, an.rx - an.w, an.rz - an.w, 0.015, M.caminhoTeto)); // orquestra
  { const g = new THREE.BoxGeometry(0.06, 0.11, 0.06), l = []; const grupos = [3, 4, 2, 4, 3, 5, 3, 4, 2, 3, 4, 3]; // público sentado, em grupos
    grupos.forEach((q, gi) => { const k = 1 + (gi % (n - 1)), ab = an.a0 + 10 + ((an.a1 - an.a0 - 20) * (gi + hash(gi, 1, 91) * 0.6)) / grupos.length; const d = an.w - (k + 0.4) * dr;
      for (let j = 0; j < q; j++) { const ag = ab + (j - (q - 1) / 2) * 3.2, t = rad(ag); if (CORR.some((cg) => Math.abs(ag - cg) < 5)) continue; l.push([g, new THREE.Matrix4().makeTranslation(cx + Math.cos(t) * (an.rx - d), (k + 1) * dh + 0.055, cz + Math.sin(t) * (an.rz - d))]); } });
    P.e1.add(mesh(merge(l), M.steelDark, false)); }
  { const area = []; const ri = [an.rx - an.w - 0.08, an.rz - an.w - 0.08], zp = an.palco.c[1] - an.palco.d / 2 - 0.1; for (let i = 0; i <= 12; i++) { const t = A0 + ((A1 - A0) * i) / 12; area.push([+(cx + Math.cos(t) * ri[0]).toFixed(3), +(cz + Math.sin(t) * ri[1]).toFixed(3)]); }
    area.push([+(cx + ri[0] * 0.95).toFixed(3), zp], [+(cx - ri[0] * 0.95).toFixed(3), zp]); P.e1.userData.pessoas = { area, y: 0.03, n: 14 }; }
  // ---- e2: palco (o retângulo de A sem o canto sudeste, que entraria no rodapé do lado de dentro da Vila: fica fora do
  // círculo de F com R + w/2 + B_PE + J), degrau da frente, fundo curvo de vidro com aro branco e pórtico de luzes
  P.e2 = new THREE.Group(); const pa = an.palco, [px, pz] = pa.c; const V = A.casas, RV = V.R + V.w / 2 + B_PE + J;
  const livre = ([x, z]) => { const dx = x - V.F[0], dz = z - V.F[1], d = Math.hypot(dx, dz); return d >= RV ? [x, z] : [V.F[0] + (dx / d) * RV, V.F[1] + (dz / d) * RV]; };
  { const x0 = px - pa.w / 2, x1 = px + pa.w / 2, z0 = pz - pa.d / 2, z1 = pz + pa.d / 2, cont = []; const lado = (a, b, n) => { for (let i = 0; i < n; i++) cont.push(livre([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n])); };
    lado([x0, z0], [x1, z0], 22); lado([x1, z0], [x1, z1], 10); lado([x1, z1], [x0, z1], 22); lado([x0, z1], [x0, z0], 10);
    const sh = new THREE.Shape(cont.filter((p, i) => i === 0 || Math.hypot(p[0] - cont[i - 1][0], p[1] - cont[i - 1][1]) > 1e-3).map(([x, z]) => new THREE.Vector2(x, -z)));
    const laje = (y0, h, mat) => { const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return mesh(g, mat); };
    P.e2.add(laje(0, pa.h - 0.03, M.whiteSmooth)); P.e2.add(laje(pa.h - 0.03, 0.03, M.madeiraClara));
    const dg = new THREE.BoxGeometry(0.7, pa.h / 2, 0.18); dg.translate(px, pa.h / 4, z0 - 0.09); P.e2.add(mesh(dg, M.madeiraClara)); }
  const fx = pa.w / 2 - 0.06, fz = pa.d * 0.42, fc = [px, pz]; // fundo: meia elipse do lado sul do palco, côncava para a plateia
  P.e2.add(parede(fc[0], fc[1], fx, fz, pa.h, pa.h + 0.6, M.vidroDossel, 0, Math.PI, 24));
  { const pp = (t, y) => [fc[0] + Math.cos(t) * fx, y, fc[1] + Math.sin(t) * fz]; const l = []; for (let i = 0; i < 12; i++) l.push([pp((i / 12) * Math.PI, pa.h + 0.6), pp(((i + 1) / 12) * Math.PI, pa.h + 0.6)]);
    for (const t of [0, Math.PI / 2, Math.PI]) l.push([pp(t, pa.h), pp(t, pa.h + 0.62)]);
    const xL = fx * 0.86, zL = pz + fz * Math.sqrt(1 - 0.86 * 0.86), yL = 1.35; for (const s of [-1, 1]) l.push([[px + s * xL, pa.h, zL], [px + s * xL, yL, zL]]); // pórtico de luzes nos montantes do fundo
    l.push([[px - xL, yL, zL], [px + xL, yL, zL]], [[px - xL, yL - 0.08, zL], [px + xL, yL - 0.08, zL]]);
    P.e2.add(beams(l.slice(0, 15), 0.015, M.whiteSmooth, 4)); P.e2.add(beams(l.slice(15), 0.025, M.steelDark, 5));
    const sg = [], sp = new THREE.BoxGeometry(0.08, 0.07, 0.1); for (let i = 0; i < 4; i++) sg.push([sp, new THREE.Matrix4().makeRotationX(0.5).setPosition(px - xL * 0.75 + (i * xL * 1.5) / 3, yL - 0.14, zL - 0.02)]); P.e2.add(mesh(merge(sg), M.lampGlow, false)); }
  { const x0 = px - pa.w / 2 + 0.2, x1 = px + pa.w / 2 - 0.2, z0 = pz - pa.d / 2 + 0.15, z1 = pz; P.e2.userData.pessoas = { area: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y: pa.h + 0.01, n: 4 }; }
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'anfiteatro', root, partes: P, esqueletos: {}, grua: {}, foco: { x: cx, z: cz + 0.4, dist: 10 }, ancora: [cx, 1.4, cz] };
}
