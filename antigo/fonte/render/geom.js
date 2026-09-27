// Geometria procedural: curvas, varredura de perfis (edifícios-fita em terraços), fusão por material.
import * as THREE from 'three';
import { hash, TAU } from '../core/util.js';

export const FH = 0.4;               // altura de um andar (unidades de mundo)
export const BAY = 0.34;             // largura de um vão de janela

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Curva fechada/aberta suave com pontos igualmente espaçados (comprimento de arco).
export function curve(ctrl, closed = true, n = 160, tension = 0.5) {
  const c = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => V3(x, 0, z)), closed, 'catmullrom', tension);
  const pts = c.getSpacedPoints(n).map((v) => [v.x, v.z]);
  if (closed) pts.pop();
  return pts;
}
export function ellipse(cx, cz, rx, rz, rot = 0, n = 160, wob = 0, seed = 1, a0 = 0, a1 = TAU) {
  const out = []; const full = Math.abs(a1 - a0) >= TAU - 1e-6; const cnt = full ? n : n + 1;
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < cnt; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const w = 1 + wob * (Math.sin(a * 3 + seed) * 0.5 + Math.sin(a * 5 + seed * 2.1) * 0.3);
    const x = Math.cos(a) * rx * w, z = Math.sin(a) * rz * w;
    out.push([cx + x * c - z * s, cz + x * s + z * c]);
  }
  return out;
}
export function pathLength(p, closed) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (closed) L += Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]); return L; }
// normais laterais (lado +o) — para curvas fechadas, apontando para fora
export function normals(p, closed) {
  const n = p.length; const out = [];
  for (let i = 0; i < n; i++) {
    const a = p[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = p[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    out.push([tz, -tx]);
  }
  if (closed) {
    let cx = 0, cz = 0; for (const q of p) { cx += q[0]; cz += q[1]; } cx /= n; cz /= n;
    let s = 0; for (let i = 0; i < n; i++) s += out[i][0] * (p[i][0] - cx) + out[i][1] * (p[i][1] - cz);
    if (s < 0) for (const q of out) { q[0] = -q[0]; q[1] = -q[1]; }
  }
  return out;
}

class Buf {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; this.c = null; }
  vert(x, y, z, nx, ny, nz, u, v) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); return this.p.length / 3 - 1; }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// Varre um perfil ao longo de um caminho.
// edges: [{a:[o,y], b:[o,y], mat, uv:'facade'|'plan'|'run', vBase, uRep, vRep}] (uRep/vRep = período do mapa da fachada em
// unidades de mundo; por padrão 32 vãos de BAY por 4 andares de FH). opts.capMat = material das tampas (senão o da aresta
// marcada com cap, ou a primeira)
// opts.width (t, i) => fator de largura do perfil nesse ponto (pontas afinadas), aplicado em torno de
// opts.widthCenter (o do eixo do perfil; 0 por padrão)
export function sweep(path, closed, edges, opts = {}) {
  const N = path.length; const nor = normals(path, closed);
  const widthFn = opts.width || null; // t -> fator em o
  const oc = opts.widthCenter || 0;
  const out = new Map();
  const planS = opts.planScale || 2.2;
  for (const e of edges) {
    const B = out.get(e.mat) || new Buf(); out.set(e.mat, B);
    const [ao, ay] = e.a, [bo, by] = e.b;
    let dno = by - ay, dny = -(bo - ao); const dl = Math.hypot(dno, dny) || 1; dno /= dl; dny /= dl;
    const base = B.p.length / 3;
    let sa = 0, sb = 0; let pa = null, pb = null;
    const cnt = closed ? N + 1 : N;
    for (let k = 0; k < cnt; k++) {
      const i = k % N; const t = k / (cnt - 1);
      const wf = widthFn ? widthFn(t, i) : 1;
      const [px, pz] = path[i], [nx, nz] = nor[i];
      const oa = oc + (ao - oc) * wf, ob = oc + (bo - oc) * wf;
      const Ax = px + nx * oa, Az = pz + nz * oa, Bx = px + nx * ob, Bz = pz + nz * ob;
      if (pa) { sa += Math.hypot(Ax - pa[0], Az - pa[1]); sb += Math.hypot(Bx - pb[0], Bz - pb[1]); }
      pa = [Ax, Az]; pb = [Bx, Bz];
      let wnx = nx * dno, wny = dny, wnz = nz * dno; const wl = Math.hypot(wnx, wny, wnz) || 1; wnx /= wl; wny /= wl; wnz /= wl;
      let ua, va, ub, vb;
      if (e.uv === 'facade') { const s = (sa + sb) / 2 + (opts.u0 || 0); const uR = e.uRep || BAY * 32, vR = e.vRep || FH * 4; ua = ub = s / uR; va = (ay - (e.vBase || 0)) / vR; vb = (by - (e.vBase || 0)) / vR; }
      else if (e.uv === 'run') { ua = ub = (sa + (opts.u0 || 0)) / 1.5; va = 0; vb = 1; }
      else { ua = Ax / planS; va = Az / planS; ub = Bx / planS; vb = Bz / planS; }
      B.vert(Ax, ay, Az, wnx, wny, wnz, ua, va);
      B.vert(Bx, by, Bz, wnx, wny, wnz, ub, vb);
    }
    // triângulos; ajusta a orientação para coincidir com a normal pretendida
    for (let k = 0; k < cnt - 1; k++) {
      const a0 = base + k * 2, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3;
      const P = B.p; const ax = P[a0 * 3], ay2 = P[a0 * 3 + 1], az = P[a0 * 3 + 2];
      const e1 = [P[b0 * 3] - ax, P[b0 * 3 + 1] - ay2, P[b0 * 3 + 2] - az], e2 = [P[a1 * 3] - ax, P[a1 * 3 + 1] - ay2, P[a1 * 3 + 2] - az];
      const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
      const Nn = B.n; const dot = cx * Nn[a0 * 3] + cy * Nn[a0 * 3 + 1] + cz * Nn[a0 * 3 + 2];
      if (dot >= 0) B.i.push(a0, b0, a1, b0, b1, a1); else B.i.push(a0, a1, b0, b0, a1, b1);
    }
  }
  // tampas: true = as duas pontas, 'ini'/'fim' = só uma; capPoly = contorno [o, y] do perfil (anti-horário)
  if (!closed && opts.caps !== false) capEnds(path, nor, edges, out, widthFn, oc, opts.caps === 'ini' ? [0] : opts.caps === 'fim' ? [N - 1] : [0, N - 1], opts.capPoly, opts.capMat);
  const res = new Map(); for (const [k, b] of out) res.set(k, b.geo());
  return res;
}
// tampa as pontas de caminhos abertos com o polígono do perfil
function capEnds(path, nor, edges, out, widthFn, oc, ends, polyIn, capMat) {
  const poly = polyIn || []; if (!polyIn) { for (const e of edges) { poly.push(e.a); } if (edges.length) poly.push(edges[edges.length - 1].b); }
  if (poly.length < 3) return;
  const mat = capMat || edges.find((e) => e.cap)?.mat || edges[0]?.mat || 'fasciaBeiral'; const B = out.get(mat) || new Buf(); out.set(mat, B);
  for (const end of ends) {
    const [px, pz] = path[end], [nx, nz] = nor[end]; const wf = widthFn ? widthFn(end ? 1 : 0, end) : 1;
    const q = path[end === 0 ? 1 : end - 1]; let tx = px - q[0], tz = pz - q[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const shape = new THREE.Shape(poly.map(([o, y]) => new THREE.Vector2(oc + (o - oc) * wf, y)));
    const sg = new THREE.ShapeGeometry(shape); const sp = sg.attributes.position; const base = B.p.length / 3;
    for (let i = 0; i < sp.count; i++) { const o = sp.getX(i), y = sp.getY(i); B.vert(px + nx * o, y, pz + nz * o, tx, 0, tz, o, y); }
    const idx = sg.index.array; for (let i = 0; i < idx.length; i += 3) { if (end === 0) B.i.push(base + idx[i], base + idx[i + 2], base + idx[i + 1]); else B.i.push(base + idx[i], base + idx[i + 1], base + idx[i + 2]); }
  }
}

// Perfil de um bloco em terraços: n andares, recuos, telhado verde, faixas brancas (lajes).
// o0 = borda interna, o1 = borda externa (no pavimento térreo). recuo por andar em cada lado.
export function terraceProfile(o) {
  const E = []; for (let f = 0; f < o.floors; f++) E.push(...terraceFloor(f, o.floors, o)); return E;
}
// Medidas da fita em terraços (linguagem da foto: Bosco Verticale / BIG): cada laje é um beiral grosso de
// concreto claro que avança `beiral` além do vidro do andar de baixo, com uma floreira contínua (degrau de
// curbW x curb, material 'planter') na borda; o vidro fica recuado na sombra. lip (antigo) vale como beiral.
export function medidas({ o0, o1, setOut = 0, setIn = 0, slab = 0.09, beiral, lip, curb = 0.06, curbW = 0.15, y0: base = 0, fh = FH }) {
  const B = beiral ?? (lip != null && lip > 0.1 ? lip : 0.28);
  const gO = (f) => o1 - setOut * f, gI = (f) => o0 + setIn * f; // linha do vidro do andar f (fora, dentro)
  const eO = (f) => gO(Math.max(0, f - 1)) + B, eI = (f) => gI(Math.max(0, f - 1)) - B; // borda do beiral no nível f
  return { B, slab, curb, curbW, base, fh, gO, gI, eO, eI, y: (f) => base + f * fh };
}
// Passeio claro na cobertura de um bloco com F andares: [o de fora, o de dentro] da faixa do meio (verde 35%,
// passeio 30%, verde 35%), ou null se a cobertura (entre as floreiras) tem 0.5 ou menos de largura. A cobertura
// (terraceFloor) e o caminho das pessoas (Faixa.caminhoTeto) usam o mesmo critério.
// prof.passeioW = largura do passeio (padrão 30% da cobertura); prof.passeioAt = posição do eixo do passeio, como
// fração da largura a partir do lado de fora (0.5 = meio; 0.25 = a um quarto do lado externo).
export function passeioTeto(F, prof) {
  const m = medidas(prof); const outer = m.eO(F) - m.curbW, inner = m.eI(F) + m.curbW, w = outer - inner;
  if (w <= 0.5) return null; const wp = prof.passeioW ?? w * 0.3, c = outer - w * (prof.passeioAt ?? 0.5); return [c + wp / 2, c - wp / 2];
}
// Talude interno (prof.taludeAndares = T): com a fita mais alta que T, os T andares de baixo não têm fachada nem terraços
// do lado de dentro: uma rampa de grama sobe do chão (0,12 para dentro do beiral do térreo) até o beiral do nível T.
// Devolve { T, base, topo, oAt(y) } ou null.
export function talude(prof, F) {
  const T = prof.taludeAndares || 0; if (!T || F <= T) return null; const m = medidas(prof);
  const base = m.eI(0) - 0.12, topo = m.eI(T), yB = m.y(0), yT = m.y(T);
  return { T, base, topo, yB, yT, oAt: (y) => base + ((topo - base) * (y - yB)) / (yT - yB) };
}
// Um andar f de um bloco com F andares: o beiral com floreira na base (nos dois lados), o vidro recuado e, no
// último, a cobertura verde com o beiral do topo (com o telhado 'roof' e largura suficiente, o passeio claro
// no meio). Materiais: 'fasciaBeiral' (lajes), 'planter' (floreiras), roof, fac/facIn.
// prof.curbMat = material das floreiras ('planter'; 'fasciaBeiral' = parapeito claro); prof.caminho = material do passeio
// do teto ('caminhoTeto'; 'grey' = deque cinza); prof.taludeAndares = andares de baixo enterrados no talude interno.
export function terraceFloor(f, F, prof) {
  const { roof = 'roof', fac = 'fac_quente', facIn = null, vBase = 0, passeio = true, y0: base = 0, curbMat = 'planter', caminho = 'caminhoTeto' } = prof; const fi = facIn || fac;
  const m = medidas(prof); const { slab, curb, curbW } = m; const E = []; const tl = talude(prof, F);
  const nivel = (lv, topo) => { // beiral + floreira no nível lv (a base do andar lv, ou o topo quando lv === F)
    const y = m.y(lv), yS = y + slab, yC = yS + curb; const eO = m.eO(lv), eI = m.eI(lv);
    E.push({ a: [eO, y], b: [eO, yC], mat: 'fasciaBeiral', uv: 'run', cap: lv === 0 });
    if (lv > 0) E.push({ a: [m.gO(lv - 1), y], b: [eO, y], mat: 'fasciaBeiral', uv: 'plan' });
    E.push({ a: [eO, yC], b: [eO - curbW, yC], mat: curbMat, uv: 'plan' });
    if (!topo && eO - curbW - m.gO(lv) < 0.08) E.push({ a: [eO - curbW, yC], b: [m.gO(lv), yS], mat: curbMat, uv: 'run' }); // laje estreita: a floreira desce em chanfro até o vidro
    else E.push({ a: [eO - curbW, yC], b: [eO - curbW, yS], mat: curbMat, uv: 'run' });
    if (!topo) { const g = m.gO(lv), w = eO - curbW - g; if (w >= 0.08) E.push({ a: [eO - curbW, yS], b: [g, yS], mat: w > 0.2 ? roof : 'fasciaBeiral', uv: 'plan' }); } // bancada clara do beiral ou terraço verde
    else { // cobertura: das floreiras de fora até as de dentro, com o passeio claro no meio
      const pt = roof === 'roof' && passeio ? passeioTeto(F, prof) : null; const a = eO - curbW, b = eI + curbW;
      if (pt) E.push({ a: [a, yS], b: [pt[0], yS], mat: roof, uv: 'plan' }, { a: [pt[0], yS], b: [pt[1], yS], mat: caminho, uv: 'plan' }, { a: [pt[1], yS], b: [b, yS], mat: roof, uv: 'plan' });
      else E.push({ a: [a, yS], b: [b, yS], mat: roof, uv: 'plan' });
    }
    if (tl && !topo && lv < tl.T) return; // dentro do talude: nem beiral, nem floreira, nem terraço do lado de dentro
    if (!topo) { const g = m.gI(lv), w = g - eI - curbW; if (w >= 0.08) E.push({ a: [g, yS], b: [eI + curbW, yS], mat: w > 0.2 ? roof : 'fasciaBeiral', uv: 'plan' }); }
    if (!topo && m.gI(lv) - eI - curbW < 0.08) E.push({ a: [m.gI(lv), yS], b: [eI + curbW, yC], mat: curbMat, uv: 'run' });
    else E.push({ a: [eI + curbW, yS], b: [eI + curbW, yC], mat: curbMat, uv: 'run' });
    E.push({ a: [eI + curbW, yC], b: [eI, yC], mat: curbMat, uv: 'plan' });
    if (lv > 0 && !(tl && lv === tl.T)) E.push({ a: [eI, y], b: [m.gI(lv - 1), y], mat: 'fasciaBeiral', uv: 'plan' });
    E.push({ a: [eI, yC], b: [eI, y], mat: 'fasciaBeiral', uv: 'run' });
  };
  nivel(f, false);
  const y0 = m.y(f), y1 = y0 + m.fh;
  E.push({ a: [m.gO(f), y0 + slab], b: [m.gO(f), y1], mat: fac, uv: 'facade', vBase: base + vBase });
  if (tl && f < tl.T) E.push({ a: [tl.oAt(y1), y1], b: [tl.oAt(y0), y0], mat: roof, uv: 'plan' }); // a faixa do talude deste andar (grama inclinada)
  else E.push({ a: [m.gI(f), y1], b: [m.gI(f), y0 + slab], mat: fi, uv: 'facade', vBase: base + vBase });
  if (f === F - 1) nivel(F, true);
  return E;
}
// Contorno do perfil em terraços (para tampar as pontas de uma fita aberta sem estilhaços): sobe pela fachada
// externa beiral a beiral, cruza a cobertura e desce pela interna. f0..f1 = andares incluídos.
export function terraceOutline(F, prof, f0 = 0, f1 = F) {
  const m = medidas(prof); const { slab, curb, curbW } = m; const P = []; const tl = talude(prof, F);
  const fora = (lv) => { const y = m.y(lv), e = m.eO(lv); P.push([e, y], [e, y + slab + curb], [e - curbW, y + slab + curb], [e - curbW, y + slab]); };
  const dentro = (lv) => { const y = m.y(lv), e = m.eI(lv); P.push([e + curbW, y + slab], [e + curbW, y + slab + curb], [e, y + slab + curb], [e, y]); };
  if (f0 > 0) P.push([m.gO(f0 - 1), m.y(f0)]);
  for (let f = f0; f < f1; f++) { fora(f); P.push([m.gO(f), m.y(f) + slab], [m.gO(f), m.y(f + 1)]); }
  if (f1 === F) { fora(F); dentro(F); } else if (tl && f1 <= tl.T) P.push([m.gI(f1 - 1), m.y(f1)], [tl.oAt(m.y(f1)), m.y(f1)]); else P.push([m.gI(f1 - 1), m.y(f1)]);
  for (let f = f1 - 1; f >= f0; f--) {
    if (tl && f < tl.T) { P.push([tl.oAt(m.y(f)), m.y(f)]); continue; } // pela rampa do talude até o chão
    P.push([m.gI(f), m.y(f + 1)], [m.gI(f), m.y(f) + slab]); dentro(f); if (f > 0 && !(tl && f === tl.T)) P.push([m.gI(f - 1), m.y(f)]);
  }
  // tira pontos repetidos e colineares (a triangulação fica limpa)
  const Q = P.filter((p, i) => { const a = P[(i - 1 + P.length) % P.length]; return Math.hypot(p[0] - a[0], p[1] - a[1]) > 1e-4; });
  return Q.filter((p, i) => { const a = Q[(i - 1 + Q.length) % Q.length], b = Q[(i + 1) % Q.length]; return Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) > 1e-6; });
}
// Parede de células da arena do Campus (fachada 'celular' dos dois lados, vertical, sem terraços): rodapé de 0,06 em
// fasciaBeiral (com tampa no térreo), platibanda de 0,10 sobre a cobertura em F*fh + 0.09, com o passeio claro
// (passeioTeto; prof.curbW = aba da platibanda). Funciona com F = 1 (aquecimento da obra). prof.celRep = período do
// mapa de células em unidades de mundo (32 x 10 células de 0,22).
export function cellFloor(f, F, prof) {
  const { o0, o1, fh = FH, y0: base = 0, fac = 'fac_celular', facIn = null, roof = 'roof', caminho = 'caminhoTeto', celRep = [7.04, 2.2], celTopo = 0.09, celPlat = 0.1 } = prof; const fi = facIn || fac; const aba = prof.curbW ?? 0.14;
  const E = []; const y0 = base + f * fh, y1 = y0 + fh; const rod = 0.06;
  if (f === 0) E.push({ a: [o1, base], b: [o1, base + rod], mat: 'fasciaBeiral', uv: 'run', cap: true }, { a: [o0, base + rod], b: [o0, base], mat: 'fasciaBeiral', uv: 'run' });
  const yb = f === 0 ? base + rod : y0;
  E.push({ a: [o1, yb], b: [o1, y1], mat: fac, uv: 'facade', vBase: base, uRep: celRep[0], vRep: celRep[1] }, { a: [o0, y1], b: [o0, yb], mat: fi, uv: 'facade', vBase: base, uRep: celRep[0], vRep: celRep[1] });
  if (f === F - 1) { // platibanda e cobertura
    const yt = base + F * fh, yS = yt + celTopo, yP = yS + celPlat; const pt = passeioTeto(F, prof);
    E.push({ a: [o1, yt], b: [o1, yP], mat: 'fasciaBeiral', uv: 'run' }, { a: [o1, yP], b: [o1 - aba, yP], mat: 'fasciaBeiral', uv: 'plan' }, { a: [o1 - aba, yP], b: [o1 - aba, yS], mat: 'fasciaBeiral', uv: 'run' });
    if (pt) E.push({ a: [o1 - aba, yS], b: [pt[0], yS], mat: roof, uv: 'plan' }, { a: [pt[0], yS], b: [pt[1], yS], mat: caminho, uv: 'plan' }, { a: [pt[1], yS], b: [o0 + aba, yS], mat: roof, uv: 'plan' });
    else E.push({ a: [o1 - aba, yS], b: [o0 + aba, yS], mat: roof, uv: 'plan' });
    E.push({ a: [o0 + aba, yS], b: [o0 + aba, yP], mat: 'fasciaBeiral', uv: 'run' }, { a: [o0 + aba, yP], b: [o0, yP], mat: 'fasciaBeiral', uv: 'plan' }, { a: [o0, yP], b: [o0, yt], mat: 'fasciaBeiral', uv: 'run' });
  }
  return E;
}
// Contorno do perfil da parede de células (tampas das pontas), andares f0..f1
export function cellOutline(F, prof, f0 = 0, f1 = F) {
  const { o0, o1, fh = FH, y0: base = 0, celTopo = 0.09, celPlat = 0.1 } = prof; const aba = prof.curbW ?? 0.14;
  const P = [[o1, base + f0 * fh], [o1, base + f1 * fh]];
  if (f1 === F) { const yS = base + F * fh + celTopo, yP = yS + celPlat; P.push([o1, yP], [o1 - aba, yP], [o1 - aba, yS], [o0 + aba, yS], [o0 + aba, yP], [o0, yP]); }
  P.push([o0, base + f1 * fh], [o0, base + f0 * fh]);
  return P;
}
// Fator de largura de uma ponta arredondada: d = distância até a ponta, Lt = comprimento do afinamento;
// vai de wmin (na ponta) a 1 em quarto de elipse (a ponta fica fluida, sem corte reto)
export function pontaFator(d, Lt, wmin = 0.22) { if (d >= Lt) return 1; const u = 1 - d / Lt; return wmin + (1 - wmin) * Math.sqrt(Math.max(0, 1 - u * u)); }
// Esqueleto de concreto de um andar (laje + borda), para a fase de estrutura da obra.
export function skeletonFloor(f, { o0, o1, setOut = 0, setIn = 0, y0: base = 0, fh = FH }) {
  const y0 = base + f * fh; const outer = o1 - setOut * f, inner = o0 + setIn * f; const t = 0.07;
  return [
    { a: [outer, y0], b: [outer, y0 + t], mat: 'concreto', uv: 'run' },
    { a: [outer, y0 + t], b: [inner, y0 + t], mat: 'concreto', uv: 'plan' },
    { a: [inner, y0 + t], b: [inner, y0], mat: 'concreto', uv: 'run' },
    { a: [inner, y0], b: [outer, y0], mat: 'concreto', uv: 'plan' },
  ];
}
// Pilares ao longo de um caminho (pares de pontos para beams()).
export function columnsAlong(path, closed, offsets, y0, y1, step = 0.7) {
  const nor = normals(path, closed); const out = []; let acc = step;
  for (let i = 1; i < path.length + (closed ? 1 : 0); i++) {
    const a = path[i - 1], b = path[i % path.length]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc >= step) { acc = 0; const [nx, nz] = nor[i % path.length]; for (const o of offsets) out.push([[b[0] + nx * o, y0, b[1] + nz * o], [b[0] + nx * o, y1, b[1] + nz * o]]); }
  }
  return out;
}
// Trecho de um caminho entre as frações s0..s1 do comprimento (para dividir anéis em módulos).
export function subPath(path, closed, s0, s1, n = 0) {
  const P = closed ? [...path, path[0]] : path; const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1]; const a = s0 * L, b = s1 * L;
  // caminho aberto: a ponta final fica no fim (sem dar a volta até o começo)
  const at = (d) => { d = closed ? ((d % L) + L) % L : Math.min(L, Math.max(0, d)); let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]; };
  const cnt = n || Math.max(4, Math.ceil((b - a) / 0.25));
  const out = []; for (let k = 0; k <= cnt; k++) out.push(at(a + ((b - a) * k) / cnt));
  return out;
}
export function pointAt(path, closed, s) { return subPath(path, closed, s, s, 1)[0]; }
// Como subPath, mas com espaçamento `passo` e as pontas mais densas (d0 e d1 = comprimento do afinamento em
// cada ponta, com 8 amostras cada, mais juntas perto da ponta): devolve { pts, s } com a distância de cada ponto
// ao começo do trecho (para o fator de largura) e o comprimento L.
export function subPathDenso(path, closed, s0, s1, passo = 0.22, d0 = 0, d1 = 0) {
  const P = closed ? [...path, path[0]] : path; const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1]; const a = s0 * L, b = s1 * L, len = b - a;
  const at = (d) => { d = closed ? ((d % L) + L) % L : Math.min(L, Math.max(0, d)); let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]; };
  d0 = Math.min(d0, len * 0.4); d1 = Math.min(d1, len * 0.4); const S = []; const g = (u) => u * u * 0.6 + u * 0.4; // mais junto perto de u = 0
  if (d0 > 0) for (let k = 0; k < 8; k++) S.push(d0 * g(k / 8));
  const m0 = d0, m1 = len - d1; const n = Math.max(4, Math.ceil((m1 - m0) / passo)); for (let k = 0; k <= n; k++) S.push(m0 + ((m1 - m0) * k) / n);
  if (d1 > 0) for (let k = 1; k <= 8; k++) S.push(m1 + d1 * (1 - g(1 - k / 8)));
  const s = S.filter((v, i) => i === 0 || v - S[i - 1] > 1e-4); return { pts: s.map((v) => at(a + v)), s, L: len };
}

// Converte o mapa material->geometria em malhas.
export function meshes(map, mats, opts = {}) {
  const g = new THREE.Group();
  for (const [k, geo] of map) {
    const m = new THREE.Mesh(geo, mats[k] || mats.white);
    m.castShadow = opts.cast !== false; m.receiveShadow = true; m.userData.matKey = k;
    g.add(m);
  }
  return g;
}

// Funde as malhas de um grupo por material (menos chamadas de desenho).
export function bake(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map(); const kill = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
    let p = o.parent; while (p && p !== root) { if (p.userData.keep) return; p = p.parent; }
    const key = o.material.uuid + (o.castShadow ? 'c' : 'n');
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, list: [] });
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    groups.get(key).list.push([o.geometry, m]); kill.push(o);
  });
  for (const o of kill) o.parent.remove(o);
  const prune = (n) => { for (const c of n.children.slice()) { prune(c); if (c.isGroup && !c.children.length && !c.userData.keep) n.remove(c); } };
  prune(root);
  for (const { mat, cast, list } of groups.values()) {
    const g = merge(list); const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true; root.add(m);
  }
  return root;
}
export function merge(list) {
  let vCount = 0, iCount = 0; const hasColor = list.some(([g]) => g.attributes.color);
  for (const [g] of list) { vCount += g.attributes.position.count; iCount += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(vCount * 3), Nn = new Float32Array(vCount * 3), U = new Float32Array(vCount * 2), C = hasColor ? new Float32Array(vCount * 3) : null;
  const I = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const [g, m] of list) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, col = g.attributes.color; nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); P[(vo + i) * 3] = v.x; P[(vo + i) * 3 + 1] = v.y; P[(vo + i) * 3 + 2] = v.z;
      if (n) { v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); Nn[(vo + i) * 3] = v.x; Nn[(vo + i) * 3 + 1] = v.y; Nn[(vo + i) * 3 + 2] = v.z; }
      if (uv) { U[(vo + i) * 2] = uv.getX(i); U[(vo + i) * 2 + 1] = uv.getY(i); }
      if (C) { if (col) { C[(vo + i) * 3] = col.getX(i); C[(vo + i) * 3 + 1] = col.getY(i); C[(vo + i) * 3 + 2] = col.getZ(i); } else { C[(vo + i) * 3] = C[(vo + i) * 3 + 1] = C[(vo + i) * 3 + 2] = 1; } }
    }
    if (g.index) { const idx = g.index.array; for (let k = 0; k < idx.length; k++) I[io + k] = idx[k] + vo; io += idx.length; }
    else { for (let k = 0; k < p.count; k++) I[io + k] = vo + k; io += p.count; }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  if (C) out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.setIndex(new THREE.BufferAttribute(I, 1)); out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

// Fita de piso ao longo de pontos 3D (rampas e pontes claras): tampo de largura w com y interpolado ponto a ponto,
// duas bordas de altura esp e o fundo. Devolve uma BufferGeometry (uv planar / uvScale).
export function deckGeo(pts, w, esp = 0.05, uvScale = 2.2) {
  const B = new Buf(); const N = pts.length; const h = w / 2;
  const dir = (i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)]; let tx = b[0] - a[0], tz = b[2] - a[2]; const l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l]; };
  const faces = [[h, 0, h, -esp, 1, 0], [-h, -esp, -h, 0, -1, 0], [h, -esp, -h, -esp, 0, -1], [-h, 0, h, 0, 0, 1]]; // [oA, yA, oB, yB, nO, nY]: bordas, fundo, tampo
  for (const [oA, yA, oB, yB, nO, nY] of faces) {
    const base = B.p.length / 3;
    for (let i = 0; i < N; i++) { const [tx, tz] = dir(i); const nx = tz, nz = -tx; const [x, y, z] = pts[i]; B.vert(x + nx * oA, y + yA, z + nz * oA, nx * nO, nY, nz * nO, (x + nx * oA) / uvScale, (z + nz * oA) / uvScale); B.vert(x + nx * oB, y + yB, z + nz * oB, nx * nO, nY, nz * nO, (x + nx * oB) / uvScale, (z + nz * oB) / uvScale); }
    for (let i = 0; i < N - 1; i++) { const a = base + i * 2; B.i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return B.geo();
}
// primitivas posicionadas
export function box(w, h, d, mat, x = 0, y = 0, z = 0, ry = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; return m; }
export function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 24, open = false) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; return m; }
export function disc(r, mat, x = 0, y = 0, z = 0, seg = 40) { const g = new THREE.CircleGeometry(r, seg); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.receiveShadow = true; return m; }
export function flat(poly, mat, y = 0, planS = 2.2) {
  const s = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(s, 24); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / planS, p.getZ(i) / planS);
  const m = new THREE.Mesh(g, mat); m.position.y = y; m.receiveShadow = true; return m;
}
export function slabPoly(poly, h, mat, y = 0, planS = 2.2) {
  const s = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 24 }); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + p.getY(i) * 0.3) / planS, (p.getZ(i) + p.getY(i) * 0.3) / planS);
  const m = new THREE.Mesh(g, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; return m;
}
// tubo ao longo de pontos 3D
export function tube(pts, r, mat, seg = 64, radial = 8) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => V3(p[0], p[1], p[2])));
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, radial, false), mat); m.castShadow = true; m.receiveShadow = true; return m;
}
// barra entre dois pontos (vigas, pilares, treliças)
const _up = new THREE.Vector3(0, 1, 0);
export function beamGeo(r = 0.02, seg = 5) { const g = new THREE.CylinderGeometry(r, r, 1, seg, 1, true); g.translate(0, 0.5, 0); return g; }
export function beamMatrix(a, b, out = new THREE.Matrix4()) {
  const A = V3(a[0], a[1], a[2]), Bv = V3(b[0], b[1], b[2]); const d = Bv.clone().sub(A); const L = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(_up, d.normalize());
  return out.compose(A, q, V3(1, L, 1));
}
export function beams(pairs, r, mat, seg = 5) {
  const g = beamGeo(r, seg); const im = new THREE.InstancedMesh(g, mat, pairs.length); const m = new THREE.Matrix4();
  pairs.forEach(([a, b], i) => im.setMatrixAt(i, beamMatrix(a, b, m)));
  im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); return im;
}
export function jitter(i, s, amp) { return (hash(i, s, 3) - 0.5) * 2 * amp; }
