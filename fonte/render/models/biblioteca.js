// Miolo da folha NO do Trevo: a Biblioteca Central no centro da folha (A.biblio.c) e o Centro de Recursos Digitais
// no pescoço, no eixo da folha, entre os dois rabos do Anel da Biblioteca.
//   biblioteca (5 etapas): a torre-vaso (seis lajes brancas onduladas com floreiras e fachada em xadrez de células,
//   núcleo r 2,3 até 4,1) sobre plinto de pedra r 2,7 no meio de um espelho d'água redondo r 4,4, com a ponte curta
//   até o CRD; terraço-jardim no topo do vaso; pilares-árvore de madeira em V (4,1 a 5,6) e o dossel quadrado de
//   vidro solar sobre grelha de madeira (r 3,2, de 5,6 a 6,2): o marco secundário do oeste. Os lados do dossel seguem
//   o eixo da folha e o setor sem hastes fica voltado para o CRD (sudeste).
//   crd (3 etapas): leque de vidro com costelas de madeira laminada, de 4,52 a 11,78 do centro da folha (da borda do
//   espelho até a junta do tambor NO), meia largura 1,9 no espelho e 0,62 no tambor, 1,6 de altura. O bloco de apoio
//   branco (3 pisos e terraço de trabalho) fica na ponta larga, junto do espelho; o bico redondo aponta o tambor.
// Tudo sai de A (planta.js). Raiz e partes sem transformação: cada parte monta num grupo local posto no lugar.
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { beams, beamGeo, beamMatrix, sweep, flat, slabPoly } from '../geom.js';
import { treeGroup } from '../forest.js';
import { hash, TAU } from '../../core/util.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
const rad = (a) => (a * Math.PI) / 180;
// grupo local de uma parte: origem em c ([x, z] do mundo) e eixo x no ângulo a (graus, 0 = leste, 90 = sul)
function quadro(parte, c, a = 0) { const g = new THREE.Group(); g.position.set(c[0], 0, c[1]); g.rotation.y = -rad(a); parte.add(g); return g; }
// ponto local (x, z) do quadro em c girado a -> [x, z] do mundo
const noMundo = (c, a, x, z) => { const ca = Math.cos(rad(a)), sa = Math.sin(rad(a)); return [c[0] + x * ca - z * sa, c[1] + x * sa + z * ca]; };
function cilindro(r, h, y, mat, seg = 32, aberto = false, rTopo = r) { const g = new THREE.CylinderGeometry(rTopo, r, h, seg, 1, aberto); g.translate(0, y + h / 2, 0); return mesh(g, mat); }
function disco(r, y, mat, seg = 48) { const g = new THREE.CircleGeometry(r, seg); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return mesh(g, mat, false); }
function tubeCyl(r, h, mat, seg, uRep, vRep, y) {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, uv.getY(i) * vRep);
  g.translate(0, y + h / 2, 0); return mesh(g, mat);
}
function caixa(w, h, d, mat, x, y, z, cast = true) { const o = mesh(new THREE.BoxGeometry(w, h, d), mat, cast); o.position.set(x, y + h / 2, z); return o; }
// contorno [x, z] em Shape (a extrusão sobe em y depois do giro)
function forma(pts, P = new THREE.Shape()) { pts.forEach(([x, z], i) => (i ? P.lineTo(x, -z) : P.moveTo(x, -z))); P.closePath(); return P; }
// laje extrudada (com furo opcional: floreira e parapeito são anéis), y = base
function lajeAnel(fora, dentro, y, h, mat) {
  const s = forma(fora); if (dentro) s.holes.push(forma(dentro, new THREE.Path()));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  return mesh(g, mat);
}
// barras retas numa só malha instanciada: lista de [a, b, raio] (o cilindro unitário é escalado em cada eixo)
function barrasR(lista, mat, seg = 4) {
  const im = new THREE.InstancedMesh(beamGeo(1, seg), mat, lista.length); const m = new THREE.Matrix4();
  lista.forEach(([a, b, r], i) => { beamMatrix(a, b, m); const e = m.elements; e[0] *= r; e[1] *= r; e[2] *= r; e[8] *= r; e[9] *= r; e[10] *= r; im.setMatrixAt(i, m); });
  im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); return im;
}
// caixas iguais numa malha instanciada: lista de [x, y, z, giro]
// coroa de r0 a r1 em volta de c ([x, z] do mundo) como um polígono só (área de gente sem o miolo)
function coroaPts(c, r0, r1, n = 32) { const anel = (r) => Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU; return [+(c[0] + Math.cos(a) * r).toFixed(3), +(c[1] + Math.sin(a) * r).toFixed(3)]; }); const f = anel(r1), d = anel(r0); return [...f, f[0], d[0], ...d.slice(1).reverse(), d[0]]; }
function caixasI(w, h, d, mat, lista, cast = true) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), mat, lista.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), um = new THREE.Vector3(1, 1, 1), e = new THREE.Euler();
  lista.forEach(([x, y, z, r = 0], i) => im.setMatrixAt(i, m4.compose(v.set(x, y, z), q.setFromEuler(e.set(0, r, 0)), um)));
  im.castShadow = cast; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); return im;
}

// ---------------- Biblioteca: torre-vaso ----------------
const BIB = A.biblio, ALT = BIB.alturas;                 // { nucleo 4,1, pilares 5,6, topo 6,2 }
const EIXO = BIB.crd;                                     // direção do CRD (graus): eixo da folha, rumo ao tambor NO
const PLINTO = 0.2, Y0 = 0.55, LJ = 0.16;                 // topo do plinto, base da 1ª laje e espessura das lajes
const TETO = ALT.nucleo - 0.15;                           // base da laje de cobertura (o terraço fica em 4,1)
const PASSO = (TETO - Y0) / 6;                            // seis pavimentos de leitura
const yAndar = (f) => Y0 + f * PASSO;                     // f = 6: a cobertura
const ONDA = 1.13;                                        // raio máximo da onda sobre o raio base
const raioAndar = (f) => (BIB.nucleo / ONDA) * (0.68 + (0.32 * f) / 6); // vaso: 1,38 embaixo a 2,04 no topo (2,3 com a onda)
// contorno ondulado: lóbulos de 10% nos eixos do dossel (não rodam) e uma onda fraca de 3 que muda a cada andar
const raioOnda = (r0, a, f) => r0 * (1 + 0.1 * Math.cos(4 * (a - rad(EIXO))) + 0.03 * Math.sin(3 * a + 1.1 * f));
function ondaPts(r0, f, n = 56) { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const r = raioOnda(r0, a, f); out.push([Math.cos(a) * r, Math.sin(a) * r]); } return out; }

// pavimentos f0 a f1 - 1 (laje, floreira pendente e fachada de células) e o esqueleto de obra (disco e pilares)
function andares(g, esq, f0, f1) {
  const arb = [], cols = [];
  for (let f = f0; f < f1; f++) {
    const y = yAndar(f), r0 = raioAndar(f), hF = yAndar(f + 1) - y - LJ, ri = r0 - 0.26;
    g.add(lajeAnel(ondaPts(r0, f), null, y, LJ, M.whiteSmooth));                                         // laje branca ondulada
    g.add(lajeAnel(ondaPts(r0 - 0.16, f), ondaPts(r0 - 0.36, f), y + LJ, 0.08, M.planter));              // floreira (borda branca livre por fora)
    g.add(tubeCyl(ri, hF, M.fac_colmeia, 40, (TAU * ri) / (16 * 0.14), hF / (14 * 0.12), y + LJ));            // fachada em xadrez de células
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU + hash(i, f, 311) * 0.3; const pende = hash(i, f, 313) < 0.5; const r = raioOnda(r0, a, f) - 0.26 + (pende ? 0.07 : 0); arb.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: y + LJ + 0.06 - (pende ? 0.08 : 0), s: 0.12 + hash(i, f, 312) * 0.06, kind: 'folhaLow', pal: 'jardim', h: 0.8 }); }
    esq.add(cilindro(r0 + 0.04, 0.08, y, M.concreto, 32));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; cols.push([[Math.cos(a) * (r0 - 0.36), y, Math.sin(a) * (r0 - 0.36)], [Math.cos(a) * (r0 - 0.36), y + LJ + hF, Math.sin(a) * (r0 - 0.36)]]); }
  }
  esq.add(beams(cols, 0.05, M.concreto, 5)); g.add(treeGroup(arb, { cast: false, name: 'floreiras' }));
}

export function biblioteca() {
  const [cx, cz] = BIB.c; const R4 = BIB.espelho.r, RP = BIB.plinto.r, RD = BIB.dossel;
  const root = new THREE.Group(); root.name = 'biblioteca'; const P = {}, E = {};
  for (const k of ['e1', 'e2', 'e3', 'e4', 'e5']) { P[k] = new THREE.Group(); root.add(P[k]); }
  // e1: espelho d'água redondo com borda de pedra clara, plinto de pedra no meio, térreo recuado escuro, núcleo de
  // concreto (escadas e elevadores) e a ponte baixa do plinto até a borda do espelho, rumo ao CRD
  const L1 = quadro(P.e1, BIB.c);
  L1.add(disco(R4 - 0.1, 0.05, M.pool, 64)); L1.add(cilindro(R4, 0.1, 0, M.concretoClaro, 64, true)); { const g = new THREE.RingGeometry(R4 - 0.1, R4, 64); g.rotateX(-Math.PI / 2); g.translate(0, 0.1, 0); L1.add(mesh(g, M.concretoClaro, false)); }
  L1.add(cilindro(RP, PLINTO, 0, M.concretoClaro, 48));
  L1.add(cilindro(1.2, Y0 - PLINTO, PLINTO, M.dark, 32)); L1.add(cilindro(0.86, ALT.nucleo - Y0, Y0, M.concreto, 20));
  { const pt = quadro(L1, [0, 0], EIXO); const lp = R4 - RP + 0.07; pt.add(caixa(lp, 0.08, 1.0, M.whiteSmooth, RP - 0.1 + lp / 2, 0.13, 0)); for (const z of [-0.47, 0.47]) pt.add(caixa(lp, 0.12, 0.05, M.whiteSmooth, RP - 0.1 + lp / 2, 0.21, z)); }
  P.e1.userData.pessoas = { area: coroaPts(BIB.c, 1.4, RP - 0.25), y: PLINTO + 0.01, n: 10 }; // no plinto, em volta do térreo
  P.e1.userData.caixaObra = new THREE.Box3(new THREE.Vector3(cx - RP, 0, cz - RP), new THREE.Vector3(cx + RP, ALT.nucleo, cz + RP)); // a obra cerca o plinto, não o espelho
  // e2: pavimentos 1 a 3 / e3: pavimentos 4 a 6 e o terraço-jardim no topo do vaso (4,1)
  E.e2 = new THREE.Group(); E.e3 = new THREE.Group(); for (const k of ['e2', 'e3']) { E[k].visible = false; root.add(E[k]); }
  andares(quadro(P.e2, BIB.c), quadro(E.e2, BIB.c), 0, 3);
  const L3 = quadro(P.e3, BIB.c); andares(L3, quadro(E.e3, BIB.c), 3, 6);
  const r6 = raioAndar(6), PE = 1.35;                  // raio do vaso no topo e dos pés das hastes no terraço
  L3.add(lajeAnel(ondaPts(r6, 6), null, TETO, ALT.nucleo - TETO, M.whiteSmooth));
  L3.add(lajeAnel(ondaPts(r6 - 0.12, 6), ondaPts(r6 - 0.34, 6), ALT.nucleo, 0.1, M.planter));
  L3.add(flat(ondaPts(r6 - 0.34, 6), M.lawn, ALT.nucleo + 0.004));
  { const g = new THREE.RingGeometry(PE - 0.22, PE + 0.22, 40); g.rotateX(-Math.PI / 2); g.translate(0, ALT.nucleo + 0.012, 0); L3.add(mesh(g, M.whiteSmooth, false)); } // passeio claro na roda das hastes
  { const arb = [], copas = [];
    for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU + hash(i, 9, 321) * 0.2; const r = raioOnda(r6, a, 6) - 0.24; arb.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: ALT.nucleo + 0.08, s: 0.13 + hash(i, 9, 322) * 0.05, kind: 'folhaLow', pal: 'jardim', h: 0.8 }); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.35; copas.push({ x: Math.cos(a) * 0.72, z: Math.sin(a) * 0.72, y: ALT.nucleo, s: 0.22 + hash(i, 4, 323) * 0.07, kind: i % 2 ? 'folha2' : 'folha', pal: 'jardim', h: 0.9 }); }
    L3.add(treeGroup(arb, { cast: false, name: 'floreira-terraco' })); L3.add(treeGroup(copas, { cast: false, name: 'terraco' })); }
  P.e3.userData.pessoas = { area: coroaPts(BIB.c, PE - 0.2, PE + 0.2), y: ALT.nucleo + 0.02, n: 8 }; // no passeio claro
  // e4: pilares-árvore de madeira laminada: tronco curto no terraço que se abre em V até a grelha do dossel, nos 8
  // rumos dos lados e cantos, menos o que olha o CRD; mastro fino no meio
  const L4 = quadro(P.e4, BIB.c, EIXO); const borda = (a) => RD / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
  { const troncos = [], bracos = []; const yV = ALT.nucleo + 0.45;
    for (let k = 1; k < 8; k++) { const a = (k * Math.PI) / 4; const pe = [Math.cos(a) * PE, ALT.nucleo, Math.sin(a) * PE], nodo = [Math.cos(a) * (PE + 0.12), yV, Math.sin(a) * (PE + 0.12)];
      troncos.push([pe, nodo]); for (const d of [-0.24, 0.24]) { const aa = a + d, rt = borda(aa) * 0.8; bracos.push([nodo, [Math.cos(aa) * rt, ALT.pilares, Math.sin(aa) * rt]]); } }
    L4.add(beams(troncos, 0.075, M.madeiraClara, 6)); L4.add(beams(bracos, 0.05, M.madeiraClara, 6)); L4.add(cilindro(0.16, ALT.pilares - ALT.nucleo, ALT.nucleo, M.madeiraClara, 12)); }
  // e5: dossel quadrado: moldura branca, grelha de madeira, vidro com a coroa contínua de painéis solares e a lanterna de vidro
  // no meio (o topo da Biblioteca, 6,2)
  const L5 = quadro(P.e5, BIB.c, EIXO); const yD = ALT.pilares, yV = yD + 0.22, TP = ALT.topo;
  { const f = 0.16; for (const [w, d, x, z] of [[2 * RD, f, 0, RD - f / 2], [2 * RD, f, 0, -RD + f / 2], [f, 2 * RD - 2 * f, RD - f / 2, 0], [f, 2 * RD - 2 * f, -RD + f / 2, 0]]) L5.add(caixa(w, 0.26, d, M.whiteSmooth, x, yD, z)); }
  { const vg = []; for (let i = -3; i <= 3; i++) { const p = i * 0.8; vg.push([0, yD + 0.07, p, 0], [p, yD + 0.07, 0, Math.PI / 2]); } L5.add(caixasI(2 * RD - 0.2, 0.12, 0.07, M.madeiraClara, vg)); }
  { const g = new THREE.PlaneGeometry(2 * RD - 0.3, 2 * RD - 0.3); g.rotateX(-Math.PI / 2); g.translate(0, yV, 0); const v = mesh(g, M.vidroDossel, false); v.renderOrder = 3; L5.add(v); }
  { const pl = []; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { if (i > 0 && i < 7 && j > 0 && j < 7) continue; pl.push([-RD + 0.4 + i * 0.8, yV + 0.02, -RD + 0.4 + j * 0.8, 0]); } L5.add(caixasI(0.56, 0.02, 0.56, M.solar, pl, false)); }
  { const lw = 1.7; L5.add(caixa(lw, TP - 0.07 - yV, lw, M.glass, 0, yV, 0, false)); L5.children[L5.children.length - 1].renderOrder = 3; L5.add(caixa(lw + 0.2, 0.07, lw + 0.2, M.whiteSmooth, 0, TP - 0.07, 0));
    const mont = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) mont.push([[sx * lw / 2, yV, sz * lw / 2], [sx * lw / 2, TP - 0.07, sz * lw / 2]]); L5.add(beams(mont, 0.03, M.madeiraClara, 5)); }
  P.e5.userData.semHAO = true;
  return { id: 'biblioteca', root, partes: P, esqueletos: E, grua: { e2: true, e3: true, e4: true, e5: true }, foco: { x: cx, z: cz + 1, dist: 20 }, ancora: [cx, TP + 0.6, cz] };
}

// ---------------- Centro de Recursos Digitais: leque de vidro no pescoço ----------------
// Quadro local: x = distância ao centro da folha no eixo (rumo ao tambor NO), z = lado (+z é a frente, virada para o
// sul e para a câmera). O casco vai do bloco (u = 1) ao bico (u = 0); a frente é de vidro vertical com as lajes à
// vista e a cobertura em domo baixo sobe para o fundo.
export function crd() {
  const K = A.crd, S = K.eixo.c, AX = K.eixo.ang; const root = new THREE.Group(); root.name = 'crd'; const P = {};
  for (const k of ['e1', 'e2', 'e3']) { P[k] = new THREE.Group(); root.add(P[k]); }
  const W = (x, z) => noMundo(S, AX, x, z).map((v) => +v.toFixed(3));
  const G_ = (K.m0 - K.m1) / (K.r1 - K.r0); const m = (s) => K.m1 + G_ * (K.r1 - s); // meia largura do leque em s
  const F = 0.05;                                         // folga para dentro do leque
  const S0 = K.r0 + 0.04, SB = S0 + 1.66, XC = SB + 0.04, S1 = K.r1 - 0.04; // bloco de S0 a SB; casco de XC ao bico S1
  const LC = S1 - XC; const rT = (K.m1 - F + G_ * (K.r1 - S1)) / (1 - G_); const uT = rT / LC; // bico: círculo tangente às bordas
  const HB = K.h - 0.45;                                  // beiral da frente (1,15); a cobertura sobe até ~1,5 no fundo
  const xu = (u) => S1 - LC * u;
  const wu = (u) => (u < uT ? rT * Math.sqrt(Math.max(0, 1 - ((uT - u) / uT) ** 2)) : m(xu(u)) - F);
  const US = [0, 0.12, 0.3, 0.55, 0.8, 1].map((k) => k * uT); for (let k = 1; k <= 10; k++) US.push(uT + ((1 - uT) * k) / 10); const iT = 5;
  const yS = (s) => 1.3 + 0.18 * s + 0.08 * Math.sin(Math.PI * s);
  const linhas = [{ d: 0, y: HB }, { d: 0.1, y: HB + 0.12 }]; for (let j = 0; j <= 8; j++) linhas.push({ s: j / 8, y: yS(j / 8) }); // ombro arredondado (2 anéis) e 9 vigas
  const ponto = (u, l) => { const f = wu(u), bk = -f; const Wd = f - bk; const omb = Math.min(0.36, Wd * 0.3); const k = Math.min(1, Math.sqrt(Wd / 1.3)); const y = HB + (l.y - HB) * k; const z = l.s === undefined ? f - l.d * (omb / 0.36) : f - omb - (f - omb - bk) * l.s; return [xu(u), y, z]; };
  const G = US.map((u) => linhas.map((l) => ponto(u, l))); const NC = US.length, NL = linhas.length;
  // contorno: frente (do bloco ao bico), a volta do bico e o fundo (do bico ao bloco)
  const fr = []; for (let c = NC - 1; c >= iT; c--) fr.push([xu(US[c]), wu(US[c])]);
  const xT = xu(uT); for (let k = 1; k < 12; k++) { const p = (Math.PI * k) / 12; fr.push([xT + rT * Math.sin(p), rT * Math.cos(p)]); }
  const fd = []; for (let c = iT; c < NC; c++) fd.push([xu(US[c]), -wu(US[c])]);
  const contorno = (ins) => { const out = []; const cs = US.filter((u) => wu(u) > ins + 0.03); for (const u of cs) out.push([xu(u), wu(u) - ins]); for (let i = cs.length - 1; i >= 0; i--) out.push([xu(cs[i]), -wu(cs[i]) + ins]); return out; };
  const trap = (s0, s1, ins) => [[s0 + ins, m(s0 + ins) - F - ins], [s1 - ins, m(s1 - ins) - F - ins], [s1 - ins, -(m(s1 - ins) - F - ins)], [s0 + ins, -(m(s0 + ins) - F - ins)]];
  // e1: bloco de apoio na ponta larga (3 pisos de 0,4 com faixa de janela escura, teto de concreto com platibanda
  // branca e terraço de trabalho com mesas longas) e a parede de junção com o casco
  const L1 = quadro(P.e1, S, AX); const fl = 0.4, topoB = 3 * fl + 0.06;
  for (let f = 0; f < 3; f++) { const y = f * fl; L1.add(slabPoly(trap(S0, SB, 0), 0.06, M.whiteSmooth, y)); L1.add(slabPoly(trap(S0, SB, 0.05), fl - 0.06, M.whiteSmooth, y + 0.06)); L1.add(slabPoly(trap(S0, SB, 0.03), 0.15, M.dark, y + 0.2)); }
  L1.add(slabPoly(trap(S0, SB, 0), 0.06, M.concreto, 3 * fl)); L1.add(lajeAnel(trap(S0, SB, 0), trap(S0, SB, 0.05), topoB, 0.07, M.whiteSmooth));
  { const pf = [[wu(1), 0], ...G[NC - 1].map((p) => [p[2], p[1] + 0.02]), [-wu(1), 0]]; const g = new THREE.ShapeGeometry(new THREE.Shape(pf.map(([z, y]) => new THREE.Vector2(-z, y)))); g.rotateY(Math.PI / 2); g.translate(SB + 0.02, 0, 0); L1.add(mesh(g, dupla(M.whiteSmooth))); } // parede de junção no perfil do casco
  { const mz = [-0.8, -0.27, 0.27, 0.8], sc = (S0 + SB) / 2; L1.add(caixasI(1.1, 0.03, 0.26, M.whiteSmooth, mz.map((z) => [sc, topoB + 0.1, z, 0])));
    const cad = []; for (const z of mz) for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) cad.push([sc - 0.44 + i * 0.22, topoB + 0.04, z + sd * 0.19, 0]); L1.add(caixasI(0.07, 0.07, 0.07, M.dark, cad, false)); }
  P.e1.userData.pessoas = { area: trap(S0, SB, 0.25).map(([x, z]) => W(x, z)), y: topoB + 0.01, n: 10 };
  // e2: costelas de madeira laminada clara (vigas da frente ao fundo, 9 mais os 2 anéis do ombro), terças, montantes da
  // frente e do fundo e o beiral em volta do bico: uma só malha instanciada
  const L2 = quadro(P.e2, S, AX); const barras = []; const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (let r = 0; r < NL; r++) for (let c = 0; c < NC - 1; c++) { const a = G[c][r], b = G[c + 1][r]; if (d3(a, b) > 0.05) barras.push([a, b, r === 0 ? 0.04 : 0.032]); }
  for (let c = 1; c < NC; c++) for (let r = 0; r < NL - 1; r++) { const a = G[c][r], b = G[c][r + 1]; if (d3(a, b) > 0.03) barras.push([a, b, 0.022]); }
  for (let c = iT + 1; c < NC; c += 2) { const x = xu(US[c]), z = wu(US[c]); barras.push([[x, 0, z], [x, HB, z], 0.03], [[x, 0, -z], [x, G[c][NL - 1][1], -z], 0.03]); } // montantes da frente e do fundo
  for (const k of [3, 6, 9]) { const p = fr[NC - iT + k - 1]; barras.push([[p[0], 0, p[1]], [p[0], HB, p[1]], 0.03]); }
  for (let i = NC - iT - 1; i < fr.length - 1; i++) barras.push([[fr[i][0], HB, fr[i][1]], [fr[i + 1][0], HB, fr[i + 1][1]], 0.04]);
  L2.add(barrasR(barras, M.madeiraClara)); P.e2.userData.semHAO = true;
  // e3: vidro do casco (3 painéis claros opacos no meio), fachada da frente com as lajes à vista, parede do fundo até a
  // cobertura, lajes internas, piso de madeira e o escritório aberto do último piso com os computadores acesos
  const L3 = quadro(P.e3, S, AX); const pos = [], uv = [], idx = [], idxC = []; const claros = new Set(['9:4', '9:5', '10:5']);
  for (let c = 0; c < NC; c++) for (let r = 0; r < NL; r++) { const p = G[c][r]; pos.push(p[0], p[1] + 0.01, p[2]); uv.push((US[c] * LC) / 2.4, ((r / (NL - 1)) * wu(US[c])) / 2.4); }
  for (let c = 0; c < NC - 1; c++) for (let r = 0; r < NL - 1; r++) { const a = c * NL + r, b = a + 1, cc = a + NL, d = cc + 1; (claros.has(c + ':' + r) ? idxC : idx).push(a, cc, b, b, cc, d); }
  const geoCasco = (ix) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ix); g.computeVertexNormals(); return g; };
  { const vm = mesh(geoCasco(idx), M.glass, false); vm.renderOrder = 3; L3.add(vm); L3.add(mesh(geoCasco(idxC), dupla(M.concretoClaro))); }
  const fach = sweep(fr, false, [{ a: [0, 0], b: [0, HB], mat: 'vidro', uv: 'facade' }, { a: [0.02, 0.38], b: [0.02, 0.44], mat: 'clara', uv: 'run' }, { a: [0.02, 0.76], b: [0.02, 0.82], mat: 'clara', uv: 'run' }], { caps: false });
  for (const [k, g] of fach) { const o = mesh(g, k === 'clara' ? M.whiteSmooth : M.glass, k === 'clara'); if (k !== 'clara') o.renderOrder = 3; L3.add(o); }
  { const pf = [], ix = []; fd.forEach(([x, z], i) => { const c = iT + i; pf.push(x, 0, z, x, G[c][NL - 1][1], z); if (i) { const k = i * 2; ix.push(k - 2, k, k - 1, k - 1, k, k + 1); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pf, 3)); g.setIndex(ix); g.computeVertexNormals(); const o = mesh(g, M.glass, false); o.renderOrder = 3; L3.add(o); }
  for (const y of [0.38, 0.76]) L3.add(slabPoly(contorno(0.2), 0.05, M.whiteSmooth, y));
  L3.add(flat(contorno(0), M.madeiraClara, 0.03));
  const yE = 0.81; const mesas = [], cad = [], tela = [];
  for (let j = 0; j < 4; j++) { const sj = 0.18 + 0.21 * j; for (let i = 0; i < 6; i++) { const u = 0.3 + i * 0.11; const zz = (uu) => (wu(uu) - 0.3) * (1 - 2 * sj); const x = xu(u), z = zz(u); const r = -Math.atan2(zz(u + 0.02) - z, xu(u + 0.02) - x); mesas.push([x, yE + 0.07, z, r]); cad.push([x, yE + 0.045, z - 0.13, r]); tela.push([x, yE + 0.13, z + 0.05, r]); } }
  L3.add(caixasI(0.28, 0.03, 0.14, M.whiteSmooth, mesas)); L3.add(caixasI(0.08, 0.08, 0.08, M.dark, cad, false)); L3.add(caixasI(0.12, 0.08, 0.012, M.cyanGlow, tela, false));
  for (const u of [0.4, 0.55, 0.7]) L3.add(caixa(0.6, 0.36, 0.03, M.whiteSmooth, xu(u), yE, -wu(u) * 0.45));
  L3.add(caixa(0.5, 0.36, 0.6, M.whiteSmooth, xu(0.9), yE, wu(0.9) * 0.45));
  P.e3.userData.pessoas = { area: contorno(0.35).map(([x, z]) => W(x, z)), y: yE, n: 12 };
  return { id: 'crd', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: K.c[0], z: K.c[1] + 0.5, dist: 13 }, ancora: [K.c[0], K.h + 0.6, K.c[1]] };
}
