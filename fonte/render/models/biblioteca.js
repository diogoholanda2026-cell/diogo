// Biblioteca Central (torre em vaso: cinco lajes brancas onduladas e grossas com floreiras pendentes, fachada em
// xadrez de células, hastes esbeltas pelo perímetro e um jardim denso de cobertura com passeio perimetral e
// pavilhão-estufa) e Centro de Recursos Digitais (casco baixo em leque com bico arredondado, grelha de madeira
// laminada clara, vidro ardósia com caixilhos claros e escritório aberto à mostra, encostado no bloco branco de
// escritório com terraço de trabalho).
import * as THREE from 'three';
import { A } from '../../data/planta.js';
import { M, dupla } from '../materials.js';
import { tex } from '../textures.js';
import { beams, beamGeo, beamMatrix, sweep, flat, slabPoly, disc } from '../geom.js';
import { treeGroup } from '../forest.js';
import { hash, clamp, TAU } from '../../core/util.js';

export const FHB = 0.83; // (legado: pé-direito médio da torre; as cotas reais estão em Y_ANDAR)
const Y_ANDAR = [0.55, 1.25, 2.15, 3.05, 3.95]; const TOPO = 5.0; // base de cada laje e topo do último pavimento
const yAndar = (f) => Y_ANDAR[f];
const raioAndar = (R, f) => R * (0.62 + 0.09 * f); // torre em vaso: 1,70 embaixo a 2,70 em cima (R 2,75)
// materiais próprios (uma instância por módulo); os de materials.js têm preferência quando existem
const MAT = {};
const madeira = () => M.madeiraClara || (MAT.madeira ||= new THREE.MeshStandardMaterial({ color: 0xd9b47a, map: tex.veio(), roughness: 0.7 }));
const fachada = () => M.fac_colmeia || M.fac_madeira;
const vidroCasco = () => { if (MAT.casco) return MAT.casco; const map = tex.vidroGrade?.() || null; return (MAT.casco = new THREE.MeshStandardMaterial({ color: map ? 0xffffff : 0x46586a, map, transparent: true, opacity: 0.55, roughness: 0.08, metalness: 0.35, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide })); };
const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
function tubeCyl(r, h, mat, seg, uRep, vRep, y) {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, uv.getY(i) * vRep);
  g.translate(0, y + h / 2, 0); return mesh(g, mat);
}
function slab(rx, rz, h, mat, y, rot = 0, seg = 56) {
  const g = new THREE.CylinderGeometry(1, 1, h, seg, 1, false); g.scale(rx, 1, rz); g.rotateY(rot); g.translate(0, y + h / 2, 0); return mesh(g, mat);
}
// contorno ondulado de uma laje: lóbulos de 10% fixos nos eixos da cobertura (não rodam) e uma onda fraca de 3
// que muda um pouco a cada andar
const raioOnda = (r0, a, f, rot) => r0 * (1 + 0.1 * Math.cos(4 * (a - rot)) + 0.03 * Math.sin(3 * a + 1.1 * f));
function ondaPts(r0, f, rot, n = 72) { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const r = raioOnda(r0, a, f, rot); out.push([Math.cos(a) * r, Math.sin(a) * r]); } return out; }
function caminho(pts, P = new THREE.Shape()) { pts.forEach(([x, z], i) => (i ? P.lineTo(x, -z) : P.moveTo(x, -z))); P.closePath(); return P; }
// laje extrudada (com furo opcional: a floreira é um anel), y = base
function lajeOnda(outer, inner, y, h, mat) {
  const s = caminho(outer); if (inner) s.holes.push(caminho(inner, new THREE.Path()));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  return mesh(g, mat);
}
// (a fusão do mundo junta as malhas de cada parte por material; os arbustos de todos os andares da parte vão
// num só grupo de instâncias, para a obra não custar uma chamada por andar)
function andares(f0, f1, R, rot) {
  const g = new THREE.Group(); const esq = new THREE.Group(); const arb = [], cols = [];
  for (let f = f0; f < f1; f++) {
    const y = yAndar(f); const r0 = raioAndar(R, f);
    g.add(lajeOnda(ondaPts(r0, f, rot), null, y, 0.22, M.whiteSmooth));                                        // laje branca ondulada e grossa
    g.add(lajeOnda(ondaPts(r0 - 0.2, f, rot), ondaPts(r0 - 0.46, f, rot), y + 0.22, 0.1, M.planter));         // floreira (faixa branca de 0,2 livre por fora)
    const hF = (f < 4 ? yAndar(f + 1) : TOPO) - y - 0.22; const ri = r0 - 0.3;                                 // fachada em xadrez de células
    g.add(tubeCyl(ri, hF, fachada(), 48, (TAU * ri) / (16 * 0.14), hF / (14 * 0.12), y + 0.22));
    // arbustos na floreira (seguem a onda da laje); metade pende para fora da borda
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU + hash(i, f, 311) * 0.2; const pende = hash(i, f, 313) < 0.5; const r = raioOnda(r0, a, f, rot) - 0.26 + (pende ? 0.08 : 0); arb.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: y + 0.32 - (pende ? 0.1 : 0), s: 0.12 + hash(i, f, 312) * 0.08, pal: 'jardim', h: 0.8 }); }
    esq.add(slab(r0 + 0.05, r0 + 0.05, 0.1, M.concreto, y, 0));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; cols.push([[Math.cos(a) * (r0 - 0.4), y, Math.sin(a) * (r0 - 0.4)], [Math.cos(a) * (r0 - 0.4), y + hF + 0.22, Math.sin(a) * (r0 - 0.4)]]); }
  }
  esq.add(beams(cols, 0.06, M.concreto, 6)); g.add(treeGroup(arb, { cast: false }));
  esq.visible = false;
  return { g, esq };
}

export function biblioteca() {
  const b = A.biblio; const [cx, cz] = b.c; const R = b.r; const rot = b.canopyRot; const half = b.canopy / 2, top = b.canopyY;
  const root = new THREE.Group(); root.name = 'biblioteca'; root.position.set(cx, 0, cz);
  const P = {}; const E = {};
  // e1: térreo recuado escuro, núcleo de concreto (elevadores e escadas) e a rampa branca curva da base
  P.e1 = new THREE.Group();
  const terreo = mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.5, 32), M.dark); terreo.position.y = 0.25; P.e1.add(terreo);
  const core = mesh(new THREE.CylinderGeometry(0.75, 0.75, TOPO, 20), M.concreto); core.position.y = TOPO / 2; P.e1.add(core);
  // rampa: sai da laje de baixo pela direita da vista (raio 2,0, y 0,77) e desce em arco até o chão (raio 2,8, y 0,05)
  const NR = 30, A0 = 0.45, A1 = -0.55; const rp = []; for (let i = 0; i <= NR; i++) { const t = i / NR; const a = A0 + (A1 - A0) * t; const r = 2.0 + 0.8 * t; rp.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const rg = sweep(rp, false, [{ a: [0.25, 0], b: [-0.25, 0], mat: 'p', uv: 'plan' }, { a: [-0.25, 0], b: [-0.25, -0.08], mat: 'p', uv: 'run' }, { a: [0.25, -0.08], b: [0.25, 0], mat: 'p', uv: 'run' }, { a: [-0.25, 0], b: [-0.25, 0.4], mat: 'p', uv: 'run' }], { caps: false });
  for (const g of rg.values()) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = clamp((A0 - Math.atan2(p.getZ(i), p.getX(i))) / (A0 - A1), 0, 1); p.setY(i, p.getY(i) + 0.77 - 0.72 * t); } g.computeVertexNormals(); g.computeBoundingSphere(); P.e1.add(mesh(g, dupla(M.whiteSmooth))); }
  P.e1.add(disc(0.6, M.whiteSmooth, Math.cos(A1) * 2.8, 0.05, Math.sin(A1) * 2.8));
  // e2: andares 1 a 3 / e3: andares 4 e 5
  const a1 = andares(0, 3, R, rot); P.e2 = a1.g; E.e2 = a1.esq;
  const a2 = andares(3, 5, R, rot); P.e3 = a2.g; E.e3 = a2.esq;
  // e4: hastes esbeltas pelo perímetro da cobertura: 8 nas arestas (pé afastado das lajes) e 4 pares em V nos cantos;
  // as que cairiam na pegada do CRD saem
  P.e4 = new THREE.Group();
  const borda = (a) => { const ar = a - rot; return half / Math.max(Math.abs(Math.cos(ar)), Math.abs(Math.sin(ar))); }; // distância até a borda da cobertura
  const noCRD = (a) => { const n = ((a % TAU) + TAU) % TAU; return n > 1.2 && n < 2.0; };
  const pares = [];
  for (let k = 0; k < 4; k++) for (const d of [-0.3, 0.3]) { const a = rot + (k * Math.PI) / 2 + d; if (noCRD(a)) continue; const rt = borda(a) - 0.08; pares.push([[Math.cos(a) * 3.1, 0.05, Math.sin(a) * 3.1], [Math.cos(a) * rt, top, Math.sin(a) * rt]]); }
  for (let k = 0; k < 4; k++) { const a = rot + Math.PI / 4 + (k * Math.PI) / 2; if (noCRD(a)) continue; const pe = [Math.cos(a) * 3.55, 0.05, Math.sin(a) * 3.55]; for (const d of [-0.12, 0.12]) { const aa = a + d; const rt = borda(aa) - 0.08; pares.push([pe, [Math.cos(aa) * rt, top, Math.sin(aa) * rt]]); } }
  P.e4.add(beams(pares, 0.045, madeira(), 6));
  // e5: jardim de cobertura — laje quadrada de cantos boleados com moldura clara, gramado, passeio perimetral e três
  // caminhos até o pavilhão-estufa no fundo (o jardim fica fora do mapa de alturas; o pavilhão não)
  P.e5 = new THREE.Group(); const S = b.canopy, h2 = S / 2, rc = 0.3;
  const jd = new THREE.Group(); jd.rotation.y = -rot; jd.userData.semHAO = true; P.e5.add(jd);
  const pav = new THREE.Group(); pav.rotation.y = -rot; P.e5.add(pav);
  const sh = new THREE.Shape(); sh.moveTo(-h2 + rc, -h2); sh.lineTo(h2 - rc, -h2); sh.absarc(h2 - rc, -h2 + rc, rc, -Math.PI / 2, 0, false); sh.lineTo(h2, h2 - rc); sh.absarc(h2 - rc, h2 - rc, rc, 0, Math.PI / 2, false); sh.lineTo(-h2 + rc, h2); sh.absarc(-h2 + rc, h2 - rc, rc, Math.PI / 2, Math.PI, false); sh.lineTo(-h2, -h2 + rc); sh.absarc(-h2 + rc, -h2 + rc, rc, Math.PI, Math.PI * 1.5, false);
  const lg = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false, curveSegments: 6 }); lg.rotateX(-Math.PI / 2); lg.translate(0, TOPO, 0); jd.add(mesh(lg, M.whiteSmooth));
  for (const [w, d, x, z] of [[S, 0.14, 0, h2 - 0.07], [S, 0.14, 0, -h2 + 0.07], [0.14, S, h2 - 0.07, 0], [0.14, S, -h2 + 0.07, 0]]) { const e = mesh(new THREE.BoxGeometry(w, 0.14, d), M.whiteSmooth); e.position.set(x, top + 0.07, z); jd.add(e); }
  const plano = (w, d, mat, x, y, z) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); const m = mesh(g, mat, false); m.position.set(x, y, z); return m; };
  jd.add(plano(S - 0.3, S - 0.3, M.roof, 0, top + 0.025, 0));
  for (const [w, d, x, z] of [[S - 0.8, 0.35, 0, h2 - 0.575], [S - 0.8, 0.35, 0, -h2 + 0.575], [0.35, S - 0.8, h2 - 0.575, 0], [0.35, S - 0.8, -h2 + 0.575, 0]]) jd.add(plano(w, d, M.caminhoTeto, x, top + 0.035, z));
  const PX = 0.3, PZ = -1.5; // pavilhão no fundo (oposto à câmera), quase centrado
  for (const x of [-1.4, 0.3, 2.0]) jd.add(plano(0.3, 2.7, M.caminhoTeto, x, top + 0.035, 1.15));
  jd.add(plano(3.2, 2.6, M.caminhoTeto, PX, top + 0.035, PZ));
  const copas = []; let ic = 0;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
    const x = -2.4 + i * 0.8 + (hash(i, j, 501) - 0.5) * 0.5, z = -2.4 + j * 0.8 + (hash(i, j, 502) - 0.5) * 0.5;
    if (Math.abs(x - PX) < 1.75 && Math.abs(z - PZ) < 1.45) continue; if (z > -0.2 && [-1.4, 0.3, 2.0].some((cxp) => Math.abs(x - cxp) < 0.28)) continue;
    copas.push({ x, z, y: top + 0.03, s: 0.42 + hash(i, j, 503) * 0.14, kind: ic++ % 2 ? 'folha2' : 'folha', pal: 'jardim', h: 1.0 });
  }
  jd.add(treeGroup(copas, { cast: false, name: 'jardim' }));
  // pavilhão-estufa: caixa de vidro turquesa em grelha, telhado em placa com a ponta direita erguida em curva e borda clara
  const caixa = mesh(new THREE.BoxGeometry(2.4, 0.65, 1.8), M.glass, false); caixa.position.set(PX, top + 0.325, PZ); caixa.renderOrder = 3; pav.add(caixa);
  const grG = new THREE.BoxGeometry(2.44, 0.67, 1.84); { const uv = grG.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i)); } const grelha = mesh(grG, M.canopyGrid, false); grelha.position.set(PX, top + 0.325, PZ); pav.add(grelha);
  const tg = new THREE.PlaneGeometry(2.7, 2.1, 3, 1); tg.rotateX(-Math.PI / 2); { const p = tg.attributes.position; const sobe = [0, 0.03, 0.14, 0.4]; for (let i = 0; i < p.count; i++) p.setY(i, sobe[Math.round((p.getX(i) + 1.35) / 0.9)]); tg.computeVertexNormals(); }
  const telhado = mesh(tg, M.canopyGrid); telhado.position.set(PX, top + 0.69, PZ); pav.add(telhado);
  const xs = [-1.35, -0.45, 0.45, 1.35], ys = [0, 0.03, 0.14, 0.4]; const bord = [];
  for (const sz of [-1, 1]) for (let k = 0; k < 3; k++) bord.push([[PX + xs[k], top + 0.69 + ys[k], PZ + sz * 1.05], [PX + xs[k + 1], top + 0.69 + ys[k + 1], PZ + sz * 1.05]]);
  for (const k of [0, 3]) bord.push([[PX + xs[k], top + 0.69 + ys[k], PZ - 1.05], [PX + xs[k], top + 0.69 + ys[k], PZ + 1.05]]);
  pav.add(beams(bord, 0.02, M.whiteSmooth, 4));
  const mont = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) mont.push([[PX + sx * 1.15, top, PZ + sz * 0.85], [PX + sx * 1.15, top + 0.66, PZ + sz * 0.85]]); pav.add(beams(mont, 0.03, madeira(), 5));
  for (const k of Object.keys(P)) root.add(P[k]); for (const k of Object.keys(E)) root.add(E[k]);
  return { id: 'biblioteca', root, partes: P, esqueletos: E, grua: { e2: true, e3: true, e5: true }, foco: { x: cx, z: cz + 1, dist: 18 }, ancora: [cx, 6.5, cz] };
}

// barras retas numa só malha instanciada: lista de [a, b, raio] (o cilindro unitário é escalado em cada eixo)
function barrasR(lista, mat) {
  const im = new THREE.InstancedMesh(beamGeo(1, 4), mat, lista.length); const m = new THREE.Matrix4();
  lista.forEach(([a, b, r], i) => { beamMatrix(a, b, m); const e = m.elements; e[0] *= r; e[1] *= r; e[2] *= r; e[8] *= r; e[9] *= r; e[10] *= r; im.setMatrixAt(i, m); });
  im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); return im;
}
function pedra(x, y, z, s, rot = 0) { const m = mesh(new THREE.DodecahedronGeometry(1, 0), M.rock); m.scale.set(s, s * 0.65, s * 0.85); m.position.set(x, y + s * 0.3, z); m.rotation.y = rot; return m; }

// Centro de Recursos Digitais: cunha em leque (bico arredondado à esquerda, 1,6 de largura na ponta e 4,8 no
// bloco) com cobertura em domo baixo de grelha de madeira laminada clara e vidro ardósia, fachada frontal
// vertical de 4 níveis, escritório aberto no último piso, encostada ao bloco branco de escritório (4 pisos, teto
// cinza-claro com platibanda, terraço de trabalho); base com talude de grama e pátio rebaixado de muro curvo.
export function crd() {
  const cr = A.biblio.crd || { c: [A.biblio.c[0] - 0.2, A.biblio.c[1] + 4.9], rot: -0.32 }; const root = new THREE.Group(); root.name = 'crd';
  const o = cr.c; const ang = cr.rot; root.position.set(o[0], 0, o[1]); root.rotation.y = ang;
  const w2 = (x, z) => { const c = Math.cos(ang), s = Math.sin(ang); return [+(o[0] + x * c + z * s).toFixed(2), +(o[1] - x * s + z * c).toFixed(2)]; };
  const P = {}; const X0 = -4.6, X1 = 3.4;
  // parametrização única do casco: u ao longo (ponta -> bloco), s da frente ao fundo
  const US = [0, 0.012, 0.03, 0.055, 0.08, 0.1]; for (let k = 1; k <= 12; k++) US.push(0.1 + (0.9 * k) / 12);
  const wu = (u) => (u < 0.1 ? 0.8 * Math.sqrt(Math.max(0, 1 - ((0.1 - u) / 0.1) ** 2)) : 0.8 + (1.6 * (u - 0.1)) / 0.9); // meia-largura (ponta em semicírculo)
  const zc = (u) => 0.45 - 0.35 * u + 0.12 * Math.sin(Math.PI * u); // eixo (a frente bojuda, o fundo quase reto)
  const xu = (u) => X0 + (X1 - X0) * u;
  const frente = (u) => zc(u) + wu(u), fundo = (u) => zc(u) - wu(u);
  const HB = 1.46; const yS = (s) => 1.68 + 0.25 * s + 0.12 * Math.sin(Math.PI * s); // beiral e altura da cobertura
  const linhas = [{ d: 0, y: HB }, { d: 0.13, y: 1.63 }]; for (let j = 0; j <= 8; j++) linhas.push({ s: j / 8, y: yS(j / 8) }); // ombro arredondado (2 anéis) + 9 vigas
  const ponto = (u, l) => { const f = frente(u), bk = fundo(u); const W = f - bk; const omb = Math.min(0.45, W * 0.3); const k = Math.min(1, Math.sqrt(W / 1.6)); const y = HB + (l.y - HB) * k; const z = l.s === undefined ? f - l.d * (omb / 0.45) : f - omb - (f - omb - bk) * l.s; return [xu(u), y, z]; };
  const G = US.map((u) => linhas.map((l) => ponto(u, l))); const NC = US.length, NL = linhas.length;
  // contorno da frente (do bloco à ponta, dando a volta no bico até o fundo) e do fundo
  const fr = []; for (let c = NC - 1; c >= 5; c--) fr.push([xu(US[c]), frente(US[c])]);
  const cxT = xu(0.1), czT = zc(0.1); for (let k = 1; k <= 12; k++) { const th = Math.PI / 2 + (Math.PI * k) / 12; fr.push([cxT + 0.8 * Math.cos(th), czT + 0.8 * Math.sin(th)]); }
  const fd = []; for (let c = 5; c < NC; c++) fd.push([xu(US[c]), fundo(US[c])]);
  const contorno = (ins) => { const out = []; const cs = US.filter((u) => wu(u) > ins + 0.03); for (const u of cs) out.push([xu(u), frente(u) - ins]); for (let i = cs.length - 1; i >= 0; i--) out.push([xu(cs[i]), fundo(cs[i]) + ins]); return out; };
  // e1: bloco de apoio (4 pisos de 0,42, teto de concreto com platibanda, parede de junção), terraço com mesas longas e
  // cadeiras, e a base: talude de grama, pátio rebaixado com muro curvo, pedras e árvores escuras no pé do bloco
  P.e1 = new THREE.Group(); const bx = 4.4, bz = 1.1, bw = 2.4, bd = 2.8, fl = 0.42, topoB = 4 * fl;
  for (let f = 0; f < 4; f++) {
    const y = f * fl; const sl = mesh(new THREE.BoxGeometry(bw + 0.08, 0.06, bd + 0.08), M.whiteSmooth); sl.position.set(bx, y + 0.03, bz); P.e1.add(sl);
    const wb = mesh(new THREE.BoxGeometry(bw - 0.1, fl - 0.06, bd - 0.1), M.whiteSmooth); wb.position.set(bx, y + 0.06 + (fl - 0.06) / 2, bz); P.e1.add(wb);
    const jan = mesh(new THREE.BoxGeometry(bw - 0.06, 0.17, bd - 0.06), M.dark, false); jan.position.set(bx, y + 0.25, bz); P.e1.add(jan); // faixa de janela escura
  }
  const teto = mesh(new THREE.BoxGeometry(bw + 0.08, 0.06, bd + 0.08), M.concreto); teto.position.set(bx, topoB - 0.03, bz); P.e1.add(teto);
  for (const [w, d, x, z] of [[bw + 0.08, 0.05, bx, bz + bd / 2 + 0.015], [bw + 0.08, 0.05, bx, bz - bd / 2 - 0.015], [0.05, bd + 0.08, bx + bw / 2 + 0.015, bz], [0.05, bd + 0.08, bx - bw / 2 - 0.015, bz]]) { const pl = mesh(new THREE.BoxGeometry(w, 0.06, d), M.whiteSmooth); pl.position.set(x, topoB + 0.03, z); P.e1.add(pl); }
  const junta = mesh(new THREE.BoxGeometry(0.08, 1.9, 2.2), M.whiteSmooth); junta.position.set(3.2, 0.95, -1.25); P.e1.add(junta);
  const mesasT = [], cadT = []; for (let k = 0; k < 5; k++) { const mz = bz - 0.9 + k * 0.45, mx = bx - 0.15 + (k >= 3 ? 0.3 : 0); mesasT.push([mx, mz]); for (let i = 0; i < 6; i++) for (const sz of [-1, 1]) cadT.push([mx - 0.5 + i * 0.2, mz + sz * 0.22]); }
  const m4 = new THREE.Matrix4();
  const mim = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.03, 0.3), M.whiteSmooth, mesasT.length); mesasT.forEach(([x, z], i) => mim.setMatrixAt(i, m4.makeTranslation(x, topoB + 0.28, z))); mim.castShadow = true; P.e1.add(mim);
  const cim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), M.dark, cadT.length); cadT.forEach(([x, z], i) => cim.setMatrixAt(i, m4.makeTranslation(x, topoB + 0.04, z))); P.e1.add(cim);
  P.e1.userData.pessoas = { area: [w2(bx - 1.15, bz - 1.25), w2(bx + 1.15, bz - 1.25), w2(bx + 1.15, bz + 1.25), w2(bx - 1.15, bz + 1.25)], y: topoB + 0.02, n: 12 };
  // talude de grama em cunha (mais alto na ponta), cortado pelo pátio rebaixado no meio da frente
  const hTal = (u) => (u < 0.5 ? 0.5 - 0.16 * u : 0.42 - 0.24 * (u - 0.5)); const pc = [xu(0.5), frente(0.5)];
  const trechos = []; let atual = []; for (const p of fr) { if (Math.hypot(p[0] - pc[0], p[1] - pc[1]) < 0.95) { if (atual.length > 1) trechos.push(atual); atual = []; } else atual.push(p); } if (atual.length > 1) trechos.push(atual);
  for (const t of trechos) for (const g of sweep(t, false, [{ a: [0.95, 0], b: [-0.02, 1], mat: 'g', uv: 'plan' }], { caps: false }).values()) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * hTal(clamp((p.getX(i) - X0) / (X1 - X0), 0, 1))); g.computeVertexNormals(); g.computeBoundingSphere(); P.e1.add(mesh(g, M.lawn, false)); }
  const muro = mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.42, 24, 1, true, -Math.PI / 2, Math.PI), dupla(M.concretoClaro || M.concreto)); muro.position.set(pc[0], 0.21, pc[1]); P.e1.add(muro);
  for (const [u, k, s] of [[0.28, 0, 0.14], [0.2, 1, 0.17], [0.12, 2, 0.13], [0.06, 3, 0.16], [0.03, 4, 0.12]]) P.e1.add(pedra(xu(u) - (u < 0.1 ? 0.35 : 0), hTal(u) * 0.5, frente(u) + 0.4, s, k * 1.3));
  for (const [u, s] of [[0.45, 0.24], [0.6, 0.27]]) P.e1.add(pedra(xu(u), 0, frente(u) + 1.15, s, u * 9));
  P.e1.add(treeGroup([{ x: 5.85, z: 0.3, y: 0, s: 0.3, pal: 'mata' }, { x: 5.95, z: 1.5, y: 0, s: 0.32, pal: 'mata' }, { x: 5.7, z: 2.8, y: 0, s: 0.28, pal: 'mata' }]));
  const porta = mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), M.whiteSmooth); porta.position.set(-4.45, 0.56, 0.75); P.e1.add(porta); // patamar da Passarela do Bulevar na baía da ponta
  // e2: grelha de madeira laminada clara — vigas principais (linhas da frente ao fundo, 9 mais os 2 anéis do ombro),
  // terças (colunas u), montantes da fachada e viga de beiral em volta do bico; uma só malha instanciada
  P.e2 = new THREE.Group(); const barras = []; const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (let r = 0; r < NL; r++) for (let c = 0; c < NC - 1; c++) { const a = G[c][r], b = G[c + 1][r]; if (d3(a, b) > 0.05) barras.push([a, b, r === 0 ? 0.05 : 0.04]); }
  for (let c = 1; c < NC; c++) for (let r = 0; r < NL - 1; r++) { const a = G[c][r], b = G[c][r + 1]; if (d3(a, b) > 0.03) barras.push([a, b, 0.026]); }
  for (let c = 6; c < NC; c += 2) { const x = xu(US[c]), z = frente(US[c]); barras.push([[x, 0, z], [x, HB, z], 0.035]); }
  for (const k of [3, 6, 9]) { const p = fr[NC - 5 + k - 1]; barras.push([[p[0], 0, p[1]], [p[0], HB, p[1]], 0.035]); }
  for (let i = NC - 6; i < fr.length - 1; i++) barras.push([[fr[i][0], HB, fr[i][1]], [fr[i + 1][0], HB, fr[i + 1][1]], 0.05]);
  P.e2.add(barrasR(barras, madeira()));
  P.e2.userData.semHAO = true;
  // e3: vidro ardósia do casco (com 3 painéis opacos claros no terço esquerdo), fachada frontal com lajes claras finas,
  // empena do fundo, lajes internas, piso e o escritório aberto do último piso (mesas, cadeiras, divisórias e uma sala)
  P.e3 = new THREE.Group(); const pos = [], uv = [], idx = [], idxC = []; const claros = new Set(['6:3', '6:4', '7:4']);
  for (let c = 0; c < NC; c++) for (let r = 0; r < NL; r++) { const p = G[c][r]; pos.push(p[0], p[1] + 0.01, p[2]); uv.push((US[c] * 7.8) / 2.4, ((r / (NL - 1)) * wu(US[c])) / 2.4); }
  for (let c = 0; c < NC - 1; c++) for (let r = 0; r < NL - 1; r++) { const a = c * NL + r, b = a + 1, cc = a + NL, d = cc + 1; (claros.has(c + ':' + r) ? idxC : idx).push(a, cc, b, b, cc, d); }
  const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); vg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); vg.setIndex(idx); vg.computeVertexNormals();
  const vm = new THREE.Mesh(vg, vidroCasco()); vm.renderOrder = 3; vm.receiveShadow = true; P.e3.add(vm);
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); cg.setIndex(idxC); cg.computeVertexNormals(); P.e3.add(mesh(cg, M.bandaCinza || M.concreto));
  const matF = (k) => (k === 'clara' ? M.whiteSmooth : vidroCasco());
  const fach = sweep(fr, false, [{ a: [0, 0], b: [0, HB], mat: 'vidro', uv: 'facade' }, { a: [0.02, 0.42], b: [0.02, 0.48], mat: 'clara', uv: 'run' }, { a: [0.02, 0.84], b: [0.02, 0.9], mat: 'clara', uv: 'run' }, { a: [0.02, 1.26], b: [0.02, 1.32], mat: 'clara', uv: 'run' }], { caps: false });
  for (const [k, g] of fach) { const m = mesh(g, matF(k), k === 'clara'); if (k !== 'clara') m.renderOrder = 3; P.e3.add(m); }
  for (const g of sweep(fd, false, [{ a: [0, 0], b: [0, 1.93], mat: 'vidro', uv: 'facade' }], { caps: false }).values()) { const m = mesh(g, vidroCasco(), false); m.renderOrder = 3; P.e3.add(m); }
  for (const y of [0.42, 0.84, 1.26]) P.e3.add(slabPoly(contorno(0.25), 0.06, M.whiteSmooth, y));
  P.e3.add(flat(contorno(0), M.woodLight, 0.03));
  const mesas = [], cad = []; const yE = 1.32;
  for (let j = 0; j < 5; j++) { const sj = 0.14 + 0.18 * j; for (let i = 0; i < 7; i++) { const u = 0.36 + i * 0.095; const zz = (uu) => zc(uu) + (wu(uu) - 0.3) * (1 - 2 * sj); const x = xu(u), z = zz(u); const r = -Math.atan2(zz(u + 0.02) - z, xu(u + 0.02) - x); mesas.push([x, z, r]); cad.push([x, z - 0.14, r]); } }
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const dim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.03, 0.16), M.whiteSmooth, mesas.length); mesas.forEach(([x, z, r], i) => dim.setMatrixAt(i, m4.compose(v.set(x, yE + 0.07, z), q.setFromEuler(e.set(0, r, 0)), one))); dim.castShadow = true; P.e3.add(dim);
  const chm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), M.dark, cad.length); cad.forEach(([x, z, r], i) => chm.setMatrixAt(i, m4.compose(v.set(x, yE + 0.045, z), q.setFromEuler(e.set(0, r, 0)), one))); P.e3.add(chm);
  for (const u of [0.45, 0.6, 0.75, 0.9]) { const dv = mesh(new THREE.BoxGeometry(0.03, 0.5, 0.8), M.whiteSmooth); dv.position.set(xu(u), yE + 0.25, zc(u) - wu(u) * 0.45); P.e3.add(dv); }
  const sala = mesh(new THREE.BoxGeometry(0.6, 0.45, 0.8), M.whiteSmooth); sala.position.set(xu(0.94), yE + 0.225, zc(0.94) + wu(0.94) * 0.5); P.e3.add(sala);
  P.e3.userData.pessoas = { area: contorno(0.4).map(([x, z]) => w2(x, z)), y: yE, n: 14 };
  for (const k of Object.keys(P)) root.add(P[k]);
  const c = new THREE.Vector3(0, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang).add(new THREE.Vector3(o[0], 0, o[1]));
  return { id: 'crd', root, partes: P, esqueletos: {}, grua: { e2: true }, foco: { x: c.x, z: c.z, dist: 12 }, ancora: [c.x, 2.7, c.z] };
}
