// Eixo e ligações da Arcologia (Trevo da Holding, plano mestre revisão 6): a Praça da Entrada, as passarelas e a Ponte
// Coberta. Tudo em coordenadas do mundo, com as medidas de A e PASSARELAS (data/planta.js).
//   praca: e1 pavimentação (o piso é pintado no terreno com A.praca.poly; a parte fica vazia e a obra usa a placa de
//     terra); e2 jardins filtrantes: espelho redondo no centro, com repuxos baixos, e as duas fontes da esplanada (bacia
//     oval de borda clara, orla de juncos e jato de 0,9); e3 o Marco da Holding no centro do espelho (obelisco branco com
//     anéis e guarda-chuva dourados), 4 canteiros em massa, bancos e luminárias; gente na praça e na esplanada (fora do
//     Bulevar e dos canteiros)
//   passarela(id), pelo tipo de PASSARELAS: 'chao' (calçada de pedra clara: Caminho da Frente com meio-fio de granito e
//     Passeio do Santuário), 'deck' (deque elevado: Bulevar branco com jardineiras e rampas suaves, ponte baixa da ilha e
//     Trilha da Cúpula com dossel de vidro), 'faixa' (Faixa sobre pilares: portal do Anel de 2 pavimentos, colunata em 2
//     arcos com colunas brancas e Elo do Santuário em 2 braços; no mapa de alturas, como as fitas) e 'helice' (rampa em
//     espiral aberta com patamar encostado no Anel pela junta, aberto do lado da chegada: Caracol e Rampa da Vila).
//     caminho = a linha média da obra linear (3D); nas de 2 partes, caminhos = uma linha por parte (sem o vão)
//   ponteCoberta: e1 pilares finos fora da pista; e2 tubo de vidro espelhado com costelas brancas, do tambor SE à proa
//     da Ciências
import * as THREE from 'three';
import { A, PASSARELAS, ANEL_MESTRE, J } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { beams, normals } from '../geom.js';
import { treeGroup } from '../forest.js';
import { heightAt } from '../ground.js';
import { Faixa, matDe } from './faixa.js';
import { hash } from '../../core/util.js';

const TAU = Math.PI * 2, RAD = Math.PI / 180;
const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const unit = (a, b) => { const d = dist(a, b) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };
const chao = (x, z) => Math.max(heightAt(x, z), 0);
// polilinha [[x, z, h]] com os trechos longos divididos (passo máximo), h interpolado
function densa(pts, passo) {
  const out = [pts[0].slice()];
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(dist(a, b) / passo)); for (let k = 1; k <= n; k++) out.push(a.map((v, j) => v + ((b[j] - v) * k) / n)); }
  return out;
}

// Peças em coordenadas do mundo, por material (Map material -> BufferGeometry): quadriláteros, leques, anéis e discos
// elípticos e caixas giradas. uv planar (x, z) / 2,2 no plano e (ao longo, y) / 2,2 nas paredes.
class Pecas {
  constructor() { this.m = new Map(); }
  _b(k) { let b = this.m.get(k); if (!b) this.m.set(k, (b = { p: [], n: [], uv: [], i: [] })); return b; }
  // quadrilátero a b c d ([x, y, z], em volta) com a normal n (ou uma por vértice): os triângulos seguem n
  quad(k, a, b, c, d, n) {
    const N = Array.isArray(n[0]) ? n : [n, n, n, n], m = N[0];
    const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], e2 = [d[0] - b[0], d[1] - b[1], d[2] - b[2]]; const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (Math.hypot(cx, cy, cz) < 1e-9) return;
    const B = this._b(k), i0 = B.p.length / 3, hor = Math.abs(m[1]) > 0.7;
    [a, b, c, d].forEach((q, j) => { B.p.push(q[0], q[1], q[2]); B.n.push(N[j][0], N[j][1], N[j][2]); B.uv.push(hor ? q[0] / 2.2 : (q[2] * m[0] - q[0] * m[2]) / 2.2, hor ? q[2] / 2.2 : q[1] / 2.2); });
    if (cx * m[0] + cy * m[1] + cz * m[2] >= 0) B.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); else B.i.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2);
  }
  // triângulo a b c com a normal n
  tri(k, a, b, c, n) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (Math.hypot(cx, cy, cz) < 1e-9) return; const B = this._b(k), i0 = B.p.length / 3;
    for (const q of [a, b, c]) { B.p.push(q[0], q[1], q[2]); B.n.push(n[0], n[1], n[2]); B.uv.push((q[2] * n[0] - q[0] * n[2]) / 2.2, q[1] / 2.2); }
    if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) B.i.push(i0, i0 + 1, i0 + 2); else B.i.push(i0, i0 + 2, i0 + 1);
  }
  // tampo plano de um polígono convexo (leque a partir de c) em y, virado para cima ou para baixo
  leque(k, c, pts, y, cima = true) {
    const B = this._b(k), nv = cima ? 1 : -1, i0 = B.p.length / 3; let s = 0; pts.forEach((p, j) => { const q = pts[(j + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; });
    for (const [x, z] of [c, ...pts]) { B.p.push(x, y, z); B.n.push(0, nv, 0); B.uv.push(x / 2.2, z / 2.2); }
    const N = pts.length; for (let j = 0; j < N; j++) { const a = i0 + 1 + j, b = i0 + 1 + ((j + 1) % N); if (cima === s > 0) B.i.push(i0, b, a); else B.i.push(i0, a, b); }
  }
  // anel elíptico em volta de c, de rx0 x rz0 a rx1 x rz1, entre y0 e y1: tampo e as paredes de fora e de dentro
  anel(k, c, rx0, rz0, rx1, rz1, y0, y1, n = 32) {
    const P = (rx, rz, j) => { const a = (j / n) * TAU; return [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * rz]; };
    const Nr = (rx, rz, j, s) => { const a = (j / n) * TAU, x = Math.cos(a) / rx, z = Math.sin(a) / rz, l = Math.hypot(x, z) || 1; return [(s * x) / l, 0, (s * z) / l]; };
    for (let j = 0; j < n; j++) {
      const i0 = P(rx0, rz0, j), i1 = P(rx0, rz0, j + 1), o0 = P(rx1, rz1, j), o1 = P(rx1, rz1, j + 1);
      this.quad(k, [i0[0], y1, i0[1]], [o0[0], y1, o0[1]], [o1[0], y1, o1[1]], [i1[0], y1, i1[1]], [0, 1, 0]);
      const no = [Nr(rx1, rz1, j, 1), Nr(rx1, rz1, j + 1, 1)]; this.quad(k, [o0[0], y0, o0[1]], [o1[0], y0, o1[1]], [o1[0], y1, o1[1]], [o0[0], y1, o0[1]], [no[0], no[1], no[1], no[0]]);
      if (rx0 > 0.02) { const ni = [Nr(rx0, rz0, j, -1), Nr(rx0, rz0, j + 1, -1)]; this.quad(k, [i1[0], y0, i1[1]], [i0[0], y0, i0[1]], [i0[0], y1, i0[1]], [i1[0], y1, i1[1]], [ni[1], ni[0], ni[0], ni[1]]); }
    }
  }
  disco(k, c, rx, rz, y, n = 32) { this.leque(k, c, Array.from({ length: n }, (_, j) => [c[0] + Math.cos((j / n) * TAU) * rx, c[1] + Math.sin((j / n) * TAU) * rz]), y); }
  // caixa girada: centro c [x, z], eixo u (unitário, largura w) e o perpendicular (fundo d), de y0 a y1
  caixa(k, c, u, w, d, y0, y1, fundo = false) {
    const v = [-u[1], u[0]], P = (su, sv, y) => [c[0] + (u[0] * su * w) / 2 + (v[0] * sv * d) / 2, y, c[1] + (u[1] * su * w) / 2 + (v[1] * sv * d) / 2];
    this.quad(k, P(-1, -1, y1), P(1, -1, y1), P(1, 1, y1), P(-1, 1, y1), [0, 1, 0]); if (fundo) this.quad(k, P(-1, -1, y0), P(1, -1, y0), P(1, 1, y0), P(-1, 1, y0), [0, -1, 0]);
    for (const s of [-1, 1]) { this.quad(k, P(s, -1, y0), P(s, 1, y0), P(s, 1, y1), P(s, -1, y1), [u[0] * s, 0, u[1] * s]); this.quad(k, P(-1, s, y0), P(1, s, y0), P(1, s, y1), P(-1, s, y1), [v[0] * s, 0, v[1] * s]); }
  }
  // malhas (uma por material) num grupo
  grupo(cast = true, nome) {
    const g = new THREE.Group(); if (nome) g.name = nome;
    for (const [k, b] of this.m) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); geo.setIndex(b.i); geo.computeBoundingSphere(); g.add(mesh(geo, matDe(k), cast)); }
    return g;
  }
}

// Deque elevado ao longo de uma curva 3D (pts [[x, z, h]]): piso cinza-claro de concreto (ou branco, o.topo = 'branco')
// com borda clara grossa (fita de luz à noite), linha verde contínua nas duas bordas, corrimão branco e pilares.
// o.jardim = false: ponte lisa (sem verde nem arbustos); o.borda: altura da borda (0,11); o.vidro: guarda-corpo de vidro;
// o.jardineiras: canteiros elevados nas duas bordas com arbustos (e algumas flores): o Bulevar; o.pilarPasso: distância
// entre pilares (1,5); o.pilares = false: sem pilares (quem chama põe os seus)
export function deck(pts, w, o = {}) {
  const g = new THREE.Group(); const c = new THREE.CatmullRomCurve3(pts.map(([x, z, h]) => new THREE.Vector3(x, chao(x, z) + h, z)));
  const L = c.getLength(); const N = Math.max(8, Math.ceil(L / 0.2)); const S = c.getSpacedPoints(N); const hb = o.borda ?? 0.11;
  const B = { top: [], side: [], rail: [], verde: [] }; const U = { top: [], side: [], rail: [], verde: [] }; const I = { top: [], side: [], rail: [], verde: [] }; const arb = [];
  // quadrilátero a, b, a2, b2 (a e b atravessados; a2 e b2 o passo seguinte); cima = true vira a face para cima
  const quad = (k, a, b, a2, b2, cima = false) => { const arr = B[k], idx = I[k]; const n = arr.length / 3; arr.push(...a, ...b, ...a2, ...b2); for (const p of [a, b, a2, b2]) U[k].push(p[0] / 2.2, p[2] / 2.2); if (cima) idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); else idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); };
  const L2 = [], R2 = [];
  for (let i = 0; i <= N; i++) { const p = S[i], q = S[Math.min(N, i + 1)], r = S[Math.max(0, i - 1)]; let tx = q.x - r.x, tz = q.z - r.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; const nx = tz, nz = -tx; L2.push([p.x + (nx * w) / 2, p.y, p.z + (nz * w) / 2]); R2.push([p.x - (nx * w) / 2, p.y, p.z - (nz * w) / 2]); }
  const m = (p, q, t, h) => [p[0] + (q[0] - p[0]) * t, p[1] + h, p[2] + (q[2] - p[2]) * t];
  const verde = o.jardim !== false; const gb = Math.min(0.3, 0.12 / w); const JD = [[0.02, 0.15], [0.85, 0.98]]; // canteiros das jardineiras (frações da largura)
  for (let i = 0; i < N; i++) {
    const a = L2[i], b = R2[i], a2 = L2[i + 1], b2 = R2[i + 1];
    quad('top', a, b, a2, b2, true);
    const dn = (p) => [p[0], p[1] - hb, p[2]]; const up = (p, h) => [p[0], p[1] + h, p[2]];
    quad('side', dn(a), a, dn(a2), a2); quad('side', b, dn(b), b2, dn(b2)); quad('side', dn(b), dn(a), dn(b2), dn(a2));
    quad('rail', a, up(a, 0.13), a2, up(a2, 0.13)); quad('rail', b, up(b, 0.13), b2, up(b2, 0.13));
    // corrimão branco fino no topo do vidro (dos dois lados)
    quad('side', m(a, b, -0.02, 0.13), m(a, b, 0.03, 0.13), m(a2, b2, -0.02, 0.13), m(a2, b2, 0.03, 0.13)); quad('side', m(a, b, 0.97, 0.13), m(a, b, 1.02, 0.13), m(a2, b2, 0.97, 0.13), m(a2, b2, 1.02, 0.13));
    if (o.jardineiras) for (const [t0, t1] of JD) { quad('verde', m(a, b, t0, 0.05), m(a, b, t1, 0.05), m(a2, b2, t0, 0.05), m(a2, b2, t1, 0.05), true); const tp = t0 < 0.5 ? t1 : t0; quad('side', m(a, b, tp, 0), m(a, b, tp, 0.05), m(a2, b2, tp, 0), m(a2, b2, tp, 0.05)); }
    else if (verde) { quad('verde', m(a, b, 0, 0.02), m(a, b, gb, 0.02), m(a2, b2, 0, 0.02), m(a2, b2, gb, 0.02), true); quad('verde', m(a, b, 1 - gb, 0.02), m(a, b, 1, 0.02), m(a2, b2, 1 - gb, 0.02), m(a2, b2, 1, 0.02), true); }
  }
  // jardineiras: arbustos baixos e densos (linha verde contínua vista de cima)
  const passo = (d) => Math.max(1, Math.round(d / (L / N)));
  if (o.jardineiras) { for (let i = 1, k = 0; i < N; i += passo(0.26), k++) for (const t of [0.085, 0.915]) { const a = L2[i], b = R2[i]; arb.push({ x: a[0] + (b[0] - a[0]) * t, z: a[2] + (b[2] - a[2]) * t, y: a[1] + 0.05, s: 0.1 + hash(k, t * 10, 77) * 0.04, kind: 'folhaLow', pal: hash(k, t * 10, 79) < 0.18 ? 'flores' : 'jardim', h: 0.75 }); } }
  else if (verde) { for (let i = 1, k = 0; i < N; i += passo(0.32), k++) { const a = L2[i], b = R2[i]; for (const t of [0.1, 0.9]) arb.push({ x: a[0] + (b[0] - a[0]) * t, z: a[2] + (b[2] - a[2]) * t, y: a[1] + 0.02, s: 0.09 + hash(k, t * 10, 77) * 0.03, kind: 'folhaLow', pal: 'jardim', h: 0.75 }); } }
  const mk = (k, mat, cast = true) => { const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(B[k], 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(U[k], 2)); bg.setIndex(I[k]); bg.computeVertexNormals(); const mm = mesh(bg, mat, cast); g.add(mm); return mm; };
  mk('top', o.topo === 'branco' ? M.whiteSmooth : M.concreto); mk('side', dupla(M.fasciaLuz || M.fascia)); // borda com fita de luz (acende à noite)
  if (B.verde.length) mk('verde', M.planter, false);
  if (o.vidro) { const rm = mk('rail', M.glassRail, false); rm.renderOrder = 3; } // (o vidro só a pedido: de longe é o corrimão branco que se vê, e custa uma chamada por passarela)
  if (o.pilares !== false) {
    const cols = []; const step = passo(o.pilarPasso ?? 1.5);
    for (let i = step; i < N; i += step) { const p = S[i]; const gy = heightAt(p.x, p.z); if (p.y - gy > 0.25) cols.push([[p.x, gy - 0.05, p.z], [p.x, p.y - hb, p.z]]); }
    if (cols.length) g.add(beams(cols, 0.045, M.whiteSmooth, 6));
  }
  if (arb.length) g.add(treeGroup(arb, { cast: false, name: 'floreiras' }));
  g.userData.caminho = S.map((p) => [p.x, p.y + 0.01, p.z]);
  if (Math.max(...pts.map((p) => p[2])) > 0.5) g.userData.semHAO = true; // passarela alta fica fora do mapa de alturas
  return g;
}

// Calçada no chão ao longo de pts [[x, z, h]] (h = altura do piso): tampo de pedra clara, meio-fio de granito nas bordas
// (o.meioFio = largura; 0 = sem) e a borda até o chão; userData.caminho = a linha média 0,01 acima do piso
function calcada(pts, w, o = {}) {
  const Q = densa(pts, 0.5), nor = normals(Q.map((p) => [p[0], p[1]]), false), mf = o.meioFio ?? 0, pe = new Pecas(), n = Q.length;
  const at = (i, off, dy) => { const [x, z, h] = Q[i], px = x + nor[i][0] * off, pz = z + nor[i][1] * off; return [px, chao(px, pz) + h + dy, pz]; };
  const ny = (i, s) => [nor[i][0] * s, 0, nor[i][1] * s];
  for (let i = 0; i < n - 1; i++) {
    pe.quad('concretoClaro', at(i, -w / 2 + mf, 0), at(i, w / 2 - mf, 0), at(i + 1, w / 2 - mf, 0), at(i + 1, -w / 2 + mf, 0), [0, 1, 0]);
    for (const s of [-1, 1]) {
      const hE = mf > 0 ? 0.02 : 0; // o meio-fio fica 0,02 acima do piso
      if (mf > 0) { pe.quad('concreto', at(i, s * (w / 2 - mf), hE), at(i, (s * w) / 2, hE), at(i + 1, (s * w) / 2, hE), at(i + 1, s * (w / 2 - mf), hE), [0, 1, 0]); pe.quad('concreto', at(i, s * (w / 2 - mf), 0), at(i + 1, s * (w / 2 - mf), 0), at(i + 1, s * (w / 2 - mf), hE), at(i, s * (w / 2 - mf), hE), ny(i, -s)); }
      const top = (j) => at(j, (s * w) / 2, hE), pe0 = (j) => { const p = top(j); return [p[0], chao(p[0], p[2]) - 0.03, p[2]]; };
      pe.quad(mf > 0 ? 'concreto' : 'concretoClaro', pe0(i), pe0(i + 1), top(i + 1), top(i), ny(i, s));
    }
  }
  for (const [i, s] of [[0, -1], [n - 1, 1]]) { // cabeceiras
    const k = Math.min(n - 1, Math.max(0, i)), t = unit(Q[Math.max(0, k - 1)], Q[Math.min(n - 1, k + 1)]), nt = [t[0] * s, 0, t[1] * s], a = at(k, -w / 2, 0), b = at(k, w / 2, 0);
    pe.quad('concretoClaro', [a[0], a[1] - 0.07, a[2]], [b[0], b[1] - 0.07, b[2]], b, a, nt);
  }
  const g = pe.grupo(true, 'calcada'); g.userData.caminho = Q.map(([x, z, h]) => [x, chao(x, z) + h + 0.01, z]); return g;
}

// perfil do Bulevar: os 4 pontos de A em passo de 0,3 com as quinas das rampas arredondadas (o meio fica em 0,75)
function perfil(pts) { const D = densa(pts, 0.3); for (let r = 0; r < 3; r++) { const h = D.map((p) => p[2]); for (let i = 1; i < D.length - 1; i++) D[i][2] = (h[i - 1] + 2 * h[i] + h[i + 1]) / 4; } return D; }

// dossel de vidro leve sobre um deque reto (Trilha da Cúpula): montantes brancos nas bordas, vigas de borda e uma
// abóbada rasa de vidro (de topo - 0,1 nas bordas a topo no meio)
function dossel(pts, w, topo) {
  const a = pts[0], b = pts[pts.length - 1], t = unit(a, b), n = [t[1], -t[0]], L = dist(a, b), yD = chao(a[0], a[1]) + a[2], yB = topo - 0.1, K = 6, pe = new Pecas(), cols = [];
  const P = (s, u) => { const q = (u * w) / 2 + 0.03 * Math.sign(u); return [a[0] + t[0] * s + n[0] * q, yB + 0.1 * (1 - u * u), a[1] + t[1] * s + n[1] * q]; };
  for (let j = 0; j < K; j++) { const u0 = -1 + (2 * j) / K, u1 = -1 + (2 * (j + 1)) / K, um = (u0 + u1) / 2, nn = [n[0] * um * 0.4, 1, n[1] * um * 0.4]; pe.quad('vidroDossel', P(0.05, u0), P(0.05, u1), P(L - 0.05, u1), P(L - 0.05, u0), nn); }
  const nM = Math.max(2, Math.round(L / 0.8)); for (let k = 0; k <= nM; k++) { const s = 0.05 + ((L - 0.1) * k) / nM; for (const u of [-1, 1]) { const p = P(s, u); cols.push([[p[0], yD, p[2]], p]); } }
  for (const u of [-1, 1]) cols.push([P(0.05, u), P(L - 0.05, u)]);
  const g = pe.grupo(false, 'dossel'); g.add(beams(cols, 0.02, M.whiteSmooth, 5)); return g;
}

// ligações com seção de fita (Faixa sobre pilares): perfil de cada uma
const FAIXA_PAS = {
  anel: { beiral: 0.16, passeioW: 0.6, pilares: { pontas: true, passo: 4, r: 0.08 }, arbustoMax: 160, passo: 0.32 }, // portal do Anel: a seção e o passo do Anel, 4 pilares nas quinas da boca
  frente2: { beiral: 0.1, passeioW: 0.4, colunas: 0.52, arbustoMax: 140 },                            // colunata: duas fileiras de colunas brancas e deque claro no teto
  elo: { beiral: 0.1, passeioW: 0.5, pilares: { passo: 1.6, r: 0.07 }, arbustoMax: 170 },               // Elo do Santuário: pilares no eixo e teto verde
};
function pasFaixa(id, d) {
  const cfg = FAIXA_PAS[id] || {}, niveis = Math.max(1, Math.round((d.topo - d.y0) / 0.5)), fh = (d.topo - d.y0) / niveis;
  const prof = { o0: -d.w / 2, o1: d.w / 2, y0: d.y0, fh, setIn: 0, setOut: 0, beiral: cfg.beiral ?? 0.12, slab: 0.05, curb: 0.04, curbW: 0.08, passeioW: cfg.passeioW, passeioAt: 0.5, fac: 'fac_fita', facIn: 'fac_fita', caminho: cfg.caminho || 'caminhoTeto' };
  const e1 = new THREE.Group(), caixa = new THREE.Box3(), cols = [];
  d.partes.forEach((path, k) => {
    const f = new Faixa({ id: 'pas_' + id + (d.partes.length > 1 ? ['O', 'L'][k] : ''), closed: false, path, modulos: 1, ponta: 0, niveis, passo: cfg.passo ?? 0.4, pilares: cfg.pilares, arbustoPasso: 0.7, arbustoMax: cfg.arbustoMax, ripaPasso: 0.3, prof });
    f.setTodos(niveis); e1.add(f.merged, f.extras); caixa.union(f.caixa(0));
    if (cfg.colunas) { // colunata: colunas a cada ~0,62 nas duas bordas, do chão até a laje
      const nor = normals(path, false), cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + dist(path[i - 1], path[i])); const Lp = cum[cum.length - 1], nc = Math.round((Lp - 0.5) / 0.62);
      for (let j = 0; j <= nc; j++) { const s = 0.25 + ((Lp - 0.5) * j) / nc; let i = 1; while (i < path.length - 1 && cum[i] < s) i++; const u = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), p = [0, 1].map((q) => path[i - 1][q] + (path[i][q] - path[i - 1][q]) * u), nv = nor[i];
        for (const o of [-cfg.colunas, cfg.colunas]) { const x = p[0] + nv[0] * o, z = p[1] + nv[1] * o; cols.push([[x, chao(x, z) - 0.02, z], [x, d.y0, z]]); } }
    }
  });
  if (cols.length) { e1.add(beams(cols, 0.05, M.whiteSmooth, 6)); caixa.min.y = -0.05; }
  // (sem semHAO: a ponte-fita entra no mapa de alturas como as fitas e cai nas mesmas malhas fundidas; com a marca,
  // fac_fita, fasciaBeiral, roof, caminhoTeto e ripa virariam 5 chamadas só delas)
  // caminho no teto (a linha média, sobre a laje); o Elo passa pelo teto do Centro de Física entre os braços
  const yT = d.topo + prof.slab, tira = (p) => p.filter((_, i) => i % 2 === 0 || i === p.length - 1).map(([x, z]) => [x, yT, z]);
  const caminhos = d.partes.map(tira), caminho = id === 'elo' ? [...caminhos[0], ...tira(A.acelerador.crescente.caminho), ...caminhos[1]] : caminhos.flat();
  return { e1, caminho, caminhos: caminhos.length > 1 ? caminhos : null, caixa };
}

// rampa em hélice (Caracol e Rampa da Vila): deque de 0,55 com floreira na linha média de A (do chão ao patamar),
// pilares (do chão ou do deque da volta de baixo), patamar de 1,5 encostado na fachada do Anel com a junta (guarda-corpo
// na cabeceira oposta à chegada da rampa e na borda de fora, até o meio) e um canteiro redondo com uma árvore no meio
function pasHelice(d) {
  const e1 = new THREE.Group(), hb = 0.11, pt = d.pts, n = pt.length - 1, varre = Math.abs(d.a1 - d.a0), dh = ((pt[n][2] - pt[0][2]) * 360) / varre; // dh = subida numa volta
  const rampa = deck(pt, d.w, { pilares: false }); e1.add(rampa); e1.userData.semHAO = true; // (o bake do mundo funde a rampa em e1: a marca fica na parte)
  const cols = []; for (let i = 2; i < n; i += 3) { const [x, z, h] = pt[i]; const y0 = (i * varre) / n >= 360 ? h - dh : chao(x, z) - 0.05; if (h - hb - y0 > 0.15) cols.push([[x, y0, z], [x, h - hb, z]]); }
  // patamar: laje girada (lado w em rot graus), pilares nas quinas fora da rampa; a rampa entra pela cabeceira ch (±1 em u)
  const p = d.patamar, u = [Math.cos(p.rot * RAD), Math.sin(p.rot * RAD)], v0 = [-u[1], u[0]], C = A.anel.c; const sv = v0[0] * (C[0] - p.c[0]) + v0[1] * (C[1] - p.c[1]) > 0 ? 1 : -1, v = [v0[0] * sv, v0[1] * sv]; // v aponta para a fachada
  const y = chao(p.c[0], p.c[1]) + p.h, pe = new Pecas(), q4 = pt[Math.max(0, n - 4)], ch = (q4[0] - p.c[0]) * u[0] + (q4[1] - p.c[1]) * u[1] > 0 ? 1 : -1;
  const L = (su, sv2) => [p.c[0] + u[0] * su + v[0] * sv2, p.c[1] + u[1] * su + v[1] * sv2];
  pe.caixa('whiteSmooth', p.c, u, p.w, p.d, y - 0.08, y, true);
  pe.caixa('whiteSmooth', L(-ch * (p.w / 2 - 0.015), 0), u, 0.03, p.d, y, y + 0.14); // cabeceira do outro lado
  pe.caixa('whiteSmooth', L((-ch * p.w) / 4, -(p.d / 2 - 0.015)), u, p.w / 2, 0.03, y, y + 0.14); // borda de fora (a fachada fica em +v)
  for (const su of [-1, 1]) for (const s of [-1, 1]) { const x = p.c[0] + u[0] * su * (p.w / 2 - 0.08) + v[0] * s * (p.d / 2 - 0.08), z = p.c[1] + u[1] * su * (p.w / 2 - 0.08) + v[1] * s * (p.d / 2 - 0.08), r = dist([x, z], d.c); if (r > d.r + 0.1 || r < d.r - d.w - 0.1) cols.push([[x, chao(x, z) - 0.05, z], [x, y - 0.08, z]]); }
  // canteiro no meio da espiral (terra e copas sem sombra: caem nas malhas dos deques, que também ficam fora do mapa de alturas)
  const pt0 = new Pecas(); pe.anel('whiteSmooth', d.c, 0.5, 0.5, 0.56, 0.56, 0, 0.08, 24); pt0.disco('planter', d.c, 0.5, 0.5, 0.07, 24);
  e1.add(pe.grupo(true, 'patamar'), pt0.grupo(false, 'canteiro')); e1.add(beams(cols, 0.04, M.whiteSmooth, 6));
  const arv = [{ x: d.c[0], z: d.c[1], y: 0.07, s: 0.3, kind: 'folha', pal: 'jardim', h: 1.0 }]; for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + 0.3; arv.push({ x: d.c[0] + Math.cos(a) * 0.38, z: d.c[1] + Math.sin(a) * 0.38, y: 0.07, s: 0.09 + hash(k, 3, 91) * 0.03, kind: 'folhaLow', pal: k % 3 ? 'jardim' : 'flores', h: 0.75 }); }
  e1.add(treeGroup(arv, { trunks: true, cast: false, name: 'canteiro-helice' }));
  const caminho = [...rampa.userData.caminho, [p.c[0], y + 0.01, p.c[1]]];
  return { e1, caminho };
}

export function passarela(id) {
  const d = PASSARELAS[id]; const root = new THREE.Group(); root.name = 'passarela-' + id; let r;
  if (d.tipo === 'faixa') r = pasFaixa(id, d);
  else if (d.tipo === 'helice') r = pasHelice(d);
  else if (d.tipo === 'chao') { const e1 = calcada(d.pts, d.w, { meioFio: d.w >= 1 ? 0.08 : 0 }); r = { e1, caminho: e1.userData.caminho }; }
  else { // deque: o Bulevar em rampas suaves, branco e com jardineiras; a Trilha com o dossel de vidro
    const e1 = deck(id === 'bulevar' ? perfil(d.pts) : d.pts, d.w, id === 'bulevar' ? { topo: 'branco', jardineiras: true, pilarPasso: 2.0 } : d.dossel ? { jardim: false } : {});
    if (d.dossel) e1.add(dossel(d.pts, d.w, d.dossel.topo));
    r = { e1, caminho: e1.userData.caminho };
  }
  const { e1, caminho, caminhos, caixa } = r; if (caixa) e1.userData.caixaObra = caixa; root.add(e1);
  // foco no meio da caixa do caminho; balão no meio da primeira parte
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, , z] of caminho) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const l0 = caminhos ? caminhos[0] : caminho, m = l0[(l0.length / 2) | 0];
  return { id: 'pas_' + id, root, partes: { e1 }, esqueletos: {}, grua: {}, foco: { x: (x0 + x1) / 2, z: (z0 + z1) / 2, dist: Math.min(28, Math.max(9, Math.max(x1 - x0, z1 - z0) * 0.75 + 4)) }, ancora: [m[0], m[1] + 1.0, m[2]], caminho, ...(caminhos ? { caminhos } : {}) };
}

// Ponte Coberta: do tambor SE à proa da Faculdade de Ciências (reta no eixo da folha), por cima da pista de atletismo.
// e1: pares de pilares finos nas bordas do piso, fora da faixa da pista; e2: laje do piso (bordas com fita de luz),
// paredes e abóbada de vidro espelhado, costelas brancas a cada 0,55 e as duas cabeceiras fechadas
export function ponteCoberta() {
  const D = A.ponteCoberta, [a, b] = D.pts, w = D.w, y0 = D.y0, y1 = D.topo, L = dist(a, b), t = unit(a, b), n = [t[1], -t[0]];
  const root = new THREE.Group(); root.name = 'ponteCoberta'; const P = { e1: new THREE.Group(), e2: new THREE.Group() };
  const Q = (s, u, y) => [a[0] + t[0] * s + n[0] * u, y, a[1] + t[1] * s + n[1] * u];
  // e1: pilares a cada ~1,5, fora da pista (raio de fora r, largura w) com folga de 0,25
  const pi = A.gramadoUni.pista, cols = [], ns = Math.round((L - 0.8) / 1.5);
  for (let k = 0; k <= ns; k++) { const s = 0.5 + ((L - 0.8) * k) / ns; for (const u of [-w / 2 + 0.15, w / 2 - 0.15]) { const p = Q(s, u, 0), r = dist([p[0], p[2]], pi.c); if (r > pi.r - pi.w - 0.25 && r < pi.r + 0.25) continue; cols.push([[p[0], chao(p[0], p[2]) - 0.05, p[2]], [p[0], y0, p[2]]]); } }
  P.e1.add(beams(cols, 0.05, M.whiteSmooth, 6));
  // e2: perfil do tubo (u, y): paredes retas até yP e abóbada elíptica até o topo
  const yL = y0 + 0.08, yP = y1 - 0.27, ru = w / 2 - 0.05, K = 8, prof = [[ru, yL], [ru, yP]]; for (let j = 1; j <= K; j++) { const th = (j / K) * Math.PI; prof.push([ru * Math.cos(th), yP + 0.27 * Math.sin(th)]); } prof.push([-ru, yL]);
  const nP = (j) => { const [u, y] = prof[j]; if (y <= yP + 1e-6) return [Math.sign(u), 0]; const nu = u / (ru * ru), ny = (y - yP) / (0.27 * 0.27), l = Math.hypot(nu, ny); return [nu / l, ny / l]; };
  const pe = new Pecas(), N3 = ([nu, ny]) => [n[0] * nu, ny, n[1] * nu];
  for (let j = 0; j < prof.length - 1; j++) { const [u0, v0] = prof[j], [u1, v1] = prof[j + 1]; pe.quad('vidroEspelhado', Q(0, u0, v0), Q(L, u0, v0), Q(L, u1, v1), Q(0, u1, v1), [N3(nP(j)), N3(nP(j)), N3(nP(j + 1)), N3(nP(j + 1))]); }
  for (const [s, sg] of [[0, -1], [L, 1]]) { const c = Q(s, 0, (yL + y1) / 2); for (let j = 0; j < prof.length; j++) pe.tri('vidroEspelhado', c, Q(s, ...prof[j]), Q(s, ...prof[(j + 1) % prof.length]), [t[0] * sg, 0, t[1] * sg]); } // cabeceiras
  pe.caixa('whiteSmooth', [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], t, L, w, y0, yL, true); // laje do piso
  for (const u of [-1, 1]) pe.quad('fasciaLuz', Q(0, (u * w) / 2 + 0.005, y0 + 0.01), Q(L, (u * w) / 2 + 0.005, y0 + 0.01), Q(L, (u * w) / 2 + 0.005, yL - 0.01), Q(0, (u * w) / 2 + 0.005, yL - 0.01), N3([u, 0]));
  const nc = Math.round(L / 0.55); for (let k = 1; k < nc; k++) { const s = (L * k) / nc; for (let j = 0; j < prof.length - 1; j++) { const [u0, v0] = prof[j], [u1, v1] = prof[j + 1], [a0, c0] = nP(j), [a1, c1] = nP(j + 1), e = 0.015; pe.quad('whiteSmooth', Q(s - 0.025, u0 + a0 * e, v0 + c0 * e), Q(s + 0.025, u0 + a0 * e, v0 + c0 * e), Q(s + 0.025, u1 + a1 * e, v1 + c1 * e), Q(s - 0.025, u1 + a1 * e, v1 + c1 * e), N3([(a0 + a1) / 2, (c0 + c1) / 2])); } }
  P.e2.add(pe.grupo(true, 'tubo')); P.e2.userData.semHAO = true;
  P.e2.userData.caixaObra = new THREE.Box3().setFromPoints([Q(0, -w / 2, 0), Q(0, w / 2, y1), Q(L, -w / 2, 0), Q(L, w / 2, y1)].map((p) => new THREE.Vector3(...p)));
  root.add(P.e1, P.e2); const m = Q(L / 2, 0, y1);
  return { id: 'ponteCoberta', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: m[0], z: m[2], dist: 10 }, ancora: [m[0], y1 + 0.6, m[2]] };
}

// área da gente na praça e na esplanada: o disco, a passagem norte e a esplanada, sem o eixo da boca e com o rasgo do
// Bulevar (da cabeceira dele até a face do Anel); os canteiros viram furos ligados à borda por um corte de largura zero
// (o inPoly de mundo.povoar deixa os furos de fora; o espelho sai por A.lagosPraca)
function areaGente() {
  const Pr = A.praca, c = Pr.c, col = A.colunata, An = ANEL_MESTRE, xp = Pr.passoNorte[1][0], xe = Math.max(...Pr.esplanada.map((p) => p[0])), xb = A.bulevar.w / 2 + J, zb = A.bulevar.pts[0][1] - J;
  const face = (x) => An.c[1] + (An.rz + J) * Math.sqrt(1 - (x / (An.rx + J)) ** 2), colE = (x) => col.c[1] - Math.sqrt((col.r + col.w / 2 + J) ** 2 - x * x);
  const lin = (f, x0, x1, n = 6) => Array.from({ length: n + 1 }, (_, i) => { const x = x0 + ((x1 - x0) * i) / n; return [x, f(x)]; });
  const a0 = Math.atan2(-Math.sqrt(Pr.r * Pr.r - xp * xp), xp), disco = Array.from({ length: 33 }, (_, i) => { const a = a0 + ((Math.PI - 2 * a0) * i) / 32; return [c[0] + Math.cos(a) * Pr.r, c[1] + Math.sin(a) * Pr.r]; });
  const borda = [...disco, ...lin(colE, -xp, -xe), ...lin(face, -xe, -xb), [-xb, zb], [xb, zb], ...lin(face, xb, xe), ...lin(colE, xe, xp)], furos = borda.map(() => []);
  for (const k of Pr.canteiros) { // furo: do vértice da borda mais perto, a volta no canteiro e de volta ao mesmo vértice
    const H = Array.from({ length: 12 }, (_, j) => [k.c[0] + Math.cos((j / 12) * TAU) * (k.rx + J), k.c[1] + Math.sin((j / 12) * TAU) * (k.rz + J)]);
    let iv = 0; borda.forEach((p, i) => { if (dist(p, k.c) < dist(borda[iv], k.c)) iv = i; }); let ih = 0; H.forEach((p, i) => { if (dist(p, borda[iv]) < dist(H[ih], borda[iv])) ih = i; });
    furos[iv].push(...H.slice(ih), ...H.slice(0, ih), H[ih], borda[iv].slice());
  }
  return borda.flatMap((p, i) => [p, ...furos[i]]);
}

// Praça da Entrada (lobo sul, dentro da colunata) e as fontes da esplanada
export function praca() {
  const root = new THREE.Group(); root.name = 'praca'; const P = { e1: new THREE.Group(), e2: new THREE.Group(), e3: new THREE.Group() };
  P.e1.userData.chao = 'praca'; // o piso (disco, passagem norte, esplanada e eixo da boca) é pintado no terreno ao concluir
  const Pr = A.praca, c = Pr.c, esp = Pr.espelho; const m4 = new THREE.Matrix4();
  // e2: espelho redondo (borda clara, água turquesa e 8 repuxos baixos) e as duas fontes da esplanada: bacia oval de
  // borda clara, orla de juncos (jardim filtrante) e o jato de 0,9 numa taça no meio
  const p2 = new Pecas(), jat = [], junc = [];
  p2.anel('whiteSmooth', esp.c, esp.r - 0.12, esp.r - 0.12, esp.r, esp.r, 0, 0.1, 36); p2.disco('pool', esp.c, esp.r - 0.12, esp.r - 0.12, 0.07, 36);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + TAU / 16; jat.push([esp.c[0] + Math.cos(a) * 0.74, 0.07, esp.c[1] + Math.sin(a) * 0.74, 0.04, 0.35]); }
  for (const f of A.fontes) {
    const { rx, rz } = f; p2.anel('whiteSmooth', f.c, rx - 0.12, rz - 0.12, rx, rz, 0, 0.12, 32); p2.anel('planter', f.c, rx - 0.42, rz - 0.42, rx - 0.12, rz - 0.12, 0.02, 0.1, 32); p2.disco('pool', f.c, rx - 0.42, rz - 0.42, 0.08, 32);
    p2.anel('whiteSmooth', f.c, 0.22, 0.22, 0.32, 0.32, 0, 0.2, 12); p2.disco('pool', f.c, 0.22, 0.22, 0.17, 12);
    jat.push([f.c[0], 0.18, f.c[1], f.jato.r, f.jato.h - 0.18]);
    for (let k = 0; k < 22; k++) { const a = (k / 22) * TAU + hash(k, 5, 61) * 0.2; junc.push({ x: f.c[0] + Math.cos(a) * (rx - 0.27), z: f.c[1] + Math.sin(a) * (rz - 0.27), y: 0.1, s: 0.09 + hash(k, f.c[0], 62) * 0.04, kind: 'folhaLow', pal: 'jardim', h: 0.9 }); }
  }
  P.e2.add(p2.grupo(true, 'espelhos'));
  const jg = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 10, 1, true), dupla(M.glassRail), jat.length); jat.forEach(([x, y, z, r, h], i) => jg.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(r, h, r)))); jg.castShadow = false; jg.renderOrder = 3; jg.computeBoundingSphere(); P.e2.add(jg);
  P.e2.add(treeGroup(junc, { cast: false, name: 'juncos' }));
  // e3: o Marco da Holding no centro do espelho: pedestal quadrado, obelisco branco, dois anéis e o guarda-chuva dourado
  const mc = Pr.marco, g = new THREE.Group(); g.position.set(mc.c[0], 0, mc.c[1]); P.e3.add(g);
  const yP = 0.22, yT = mc.h - 0.28, raio = (y) => mc.r + ((0.075 - mc.r) * (y - yP)) / (yT - yP);
  const ped = mesh(new THREE.CylinderGeometry(mc.r + 0.06, mc.r + 0.12, yP, 4), M.whiteSmooth); ped.rotation.y = Math.PI / 4; ped.position.y = yP / 2; g.add(ped);
  const ob = mesh(new THREE.CylinderGeometry(0.075, mc.r, yT - yP, 4), M.whiteSmooth); ob.rotation.y = Math.PI / 4; ob.position.y = (yP + yT) / 2; g.add(ob);
  for (const y of [1.0, 1.75]) { const an = mesh(new THREE.TorusGeometry(raio(y) + 0.012, 0.022, 4, 16), M.ouro); an.rotation.x = Math.PI / 2; an.position.y = y; g.add(an); }
  const gc = mesh(new THREE.ConeGeometry(0.34, 0.16, 12), M.ouro); gc.position.y = yT + 0.08; g.add(gc); const cabo = mesh(new THREE.CylinderGeometry(0.014, 0.014, mc.h - yT - 0.14, 6), M.ouro); cabo.position.y = (yT + 0.16 + mc.h) / 2; g.add(cabo);
  // 4 canteiros em massa (borda clara, terra plantada, árvores escuras e orla de arbustos)
  const p3 = new Pecas(), arv = [];
  Pr.canteiros.forEach((k, i) => {
    p3.anel('concretoClaro', k.c, k.rx - 0.06, k.rz - 0.06, k.rx, k.rz, 0, 0.12, 20); p3.disco('planter', k.c, k.rx - 0.06, k.rz - 0.06, 0.1, 20);
    arv.push({ x: k.c[0], z: k.c[1], y: 0.1, s: 0.4, kind: 'folha', pal: 'mata', h: 1.0 });
    for (let j = 0; j < 3; j++) { const a = (j / 3) * TAU + i; arv.push({ x: k.c[0] + Math.cos(a) * k.rx * 0.48, z: k.c[1] + Math.sin(a) * k.rz * 0.48, y: 0.1, s: 0.28 + hash(i, j, 63) * 0.06, kind: 'folha', pal: 'mata', h: 0.9 }); }
    for (let j = 0; j < 9; j++) { const a = (j / 9) * TAU + i * 0.7; arv.push({ x: k.c[0] + Math.cos(a) * (k.rx - 0.16), z: k.c[1] + Math.sin(a) * (k.rz - 0.16), y: 0.1, s: 0.1 + hash(i, j, 64) * 0.04, kind: 'folhaLow', pal: j % 4 ? 'jardim' : 'flores', h: 0.8 }); }
  });
  P.e3.add(p3.grupo(true, 'canteiros')); P.e3.add(treeGroup(arv, { trunks: true, name: 'canteiros-massa' }));
  // bancos em volta do espelho (virados para o Marco) e luminárias no anel de fora do piso (fora do Caminho e do Bulevar)
  const bancos = [0, 15, 165, 180, 195, 345].map((a) => [c[0] + Math.cos(a * RAD) * 2.45, c[1] + Math.sin(a * RAD) * 2.45, a]);
  const bs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.12, 0.5), M.madeiraClara, bancos.length); bancos.forEach(([x, z, a], i) => bs.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a * RAD, 0)), new THREE.Vector3(1, 1, 1)))); bs.castShadow = true; bs.receiveShadow = true; bs.computeBoundingSphere(); P.e3.add(bs);
  const bp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.05, 0.42), M.whiteSmooth, bancos.length); bancos.forEach(([x, z, a], i) => bp.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0.025, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a * RAD, 0)), new THREE.Vector3(1, 1, 1)))); bp.receiveShadow = true; bp.computeBoundingSphere(); P.e3.add(bp);
  const luz = [0, 30, 60, 120, 150, 180, 210, 240, 300, 330].map((a) => [c[0] + Math.cos(a * RAD) * 3.5, c[1] + Math.sin(a * RAD) * 3.5]);
  P.e3.add(beams(luz.map(([x, z]) => [[x, 0, z], [x, 0.92, z]]), 0.016, M.steelDark, 5));
  const lg = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), M.lampGlow, luz.length); luz.forEach(([x, z], i) => lg.setMatrixAt(i, m4.makeTranslation(x, 0.95, z))); lg.userData.semHAO = true; lg.computeBoundingSphere(); P.e3.add(lg);
  P.e3.userData.pessoas = { area: areaGente(), n: 90 }; // a praça e a esplanada, fora do Bulevar e dos canteiros
  for (const k of Object.keys(P)) root.add(P[k]);
  return { id: 'praca', root, partes: P, esqueletos: {}, grua: {}, modos: { e1: 'terra', e3: 'crescer' }, foco: { x: c[0], z: c[1] - 1.2, dist: 14 }, ancora: [c[0], 1.4, c[1] - 1.5] };
}
