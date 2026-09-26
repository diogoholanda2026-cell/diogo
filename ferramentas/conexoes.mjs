// Checagem das conexões e interseções da planta (roda em Node, sem navegador, em ~1 s): fitas, lago, modelos,
// passarelas, vias e zonas. Aponta o que se cruza e onde começa e termina cada passarela.
// Uso: node ferramentas/conexoes.mjs        (sai com código 1 se houver cruzamento de passarela ou via)
import { A, PASSARELAS, ZONAS, SANTUARIO_GRAMADO } from '../fonte/data/planta.js';
import { faixas } from '../fonte/render/models/aneis.js';
import { alaOnda } from '../fonte/render/models/centro.js';
import { normals, curve } from '../fonte/render/geom.js';
import { hash } from '../fonte/core/util.js';
import { CatmullRomCurve3, Vector3 } from 'three';

const inPoly = (x, z, p) => { let s = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) s = !s; } return s; };
const segD = (x, z, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz || 1))); return Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t); };
const polyD = (x, z, p, closed = true) => { let d = 1e9; for (let i = closed ? 0 : 1; i < p.length; i++) d = Math.min(d, segD(x, z, p[(i - 1 + p.length) % p.length], p[i])); return closed && inPoly(x, z, p) ? -d : d; };
const ellD = (x, z, c, rx, rz, rot = 0) => { const co = Math.cos(-rot), si = Math.sin(-rot); const dx = x - c[0], dz = z - c[1]; const u = dx * co - dz * si, v = dx * si + dz * co; return (Math.hypot(u / rx, v / rz) - 1) * Math.min(rx, rz); };
const zonaD = (x, z, Z) => (Z.poly ? polyD(x, z, Z.poly) : ellD(x, z, ...Z.elipse));
const out = []; const report = (msg) => out.push(msg); let graves = 0;

// pegadas das fitas: amostras do chão (o0..o1) de cada módulo
const F = { ...faixas(), onda: alaOnda() }; const pegada = {};
for (const [k, f] of Object.entries(F)) { const pts = []; const p = f.prof; for (const m of f.mods) { const nor = normals(m.path, false); m.path.forEach(([x, z], i) => { const w = m.afina ? m.W[i] : 1; for (let t = 0; t <= 1.0001; t += 0.25) { const o = f.oc + (p.o0 + (p.o1 - p.o0) * t - f.oc) * w; pts.push([x + nor[i][0] * o, z + nor[i][1] * o]); } }); } pegada[k] = pts; }
// rampa do Santuário (três patamares da ponta oeste da fita até a Sede), com o mesmo perfil da fita
if (A.santuario.rampa) { const eixo = curve([...A.santuario.rampa].reverse(), false, 40); const nor = normals(eixo, false); const p = F.santuario.prof; const pts = []; eixo.forEach(([x, z], i) => { for (let t = 0; t <= 1.0001; t += 0.25) { const o = p.o0 + (p.o1 - p.o0) * t; pts.push([x + nor[i][0] * o, z + nor[i][1] * o]); } }); pegada.rampaSantuario = pts; }
// modelos circulares/elípticos (raio de chão); a torre da Biblioteca pelo andar mais largo até 2.5 de altura
const Rb = A.biblio.r * 0.91 + 0.4;
const circ = {
  biblio: [A.biblio.c, Rb, Rb, 0], bioma: [A.bioma.c, A.bioma.r + 0.65, A.bioma.r * 0.84 + 0.35, 0],
  galeriaGorilas: [A.gorilas.c, 3.1, 2.6, 0], acelerador: [A.acelerador.c, A.acelerador.rx + 0.7, A.acelerador.rz + 0.6, 0],
  anfiteatro: [A.anfiteatro.c, A.anfiteatro.r, A.anfiteatro.r, 0],
};
if (A.bioma.pasto) circ.pastoBioma = [A.bioma.pasto.c, A.bioma.pasto.rx + 0.1, A.bioma.pasto.rz + 0.1, 0]; // pasto dos elefantes (com o muro), em frente ao Bioma
if (A.ciencias.gota) { const g = A.ciencias.gota; circ.gota = [g.c, g.rx * 1.15 + 0.14, g.rz + 0.14, g.rot]; }
// contornos precisos: platô da Ciências (contorno da especificação em u,v da Ciências), casas da vila (pegadas de
// A.vila.mods), cerca de vidro dos gorilas, CRD (casco em leque), ala do portal, Centro de Reabilitação e piquete
const cc = A.ciencias; const T = (u, v) => { const c = Math.cos(cc.rot), s = Math.sin(cc.rot); return [cc.c[0] + u * c - v * s, cc.c[1] + u * s + v * c]; };
const ciencias = curve([[-6.6, -1.6], [-5.6, -0.6], [-3.8, -0.35], [-1.6, -0.25], [0.8, 0.9], [3.0, 2.1], [5.2, 2.0], [6.6, 0.9], [6.9, -0.6], [6.0, -2.4], [3.8, -3.0], [1.4, -3.1], [-1.0, -3.5], [-3.4, -4.0], [-5.8, -3.7]], true, 60, 0.5).map(([u, v]) => T(u, v));
const v = A.vila; const mods = v.mods || [[-1.9, 0.2], [-1.15, -0.25], [-0.4, 0.25], [0.4, -0.2], [1.15, 0.3], [1.9, -0.1]].map(([x, z]) => ({ c: [x, z], w: 1.24, d: 0.84 }));
const casas = mods.map((md) => { const r = v.rot, co = Math.cos(r), si = Math.sin(r); const hw = md.w / 2, hd = md.d / 2; return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, w]) => { const lx = md.c[0] + u, lz = md.c[1] + w; return [v.c[0] + lx * co + lz * si, v.c[1] - lx * si + lz * co]; }); });
const g = A.gorilas; const cerca = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; cerca.push([g.c[0] - 0.4 + Math.cos(a) * 2.2, g.c[1] + Math.sin(a) * 1.85]); }
const cr = A.biblio.crd; const crdPoly = [[-4.6, -1.5], [3.4, -2.3], [5.6, -0.8], [5.6, 2.0], [3.2, 2.0], [3.2, 2.5], [1.45, 2.17], [-0.5, 1.9], [-2.45, 1.45], [-4.6, 0.95]].map(([lx, lz]) => { const co = Math.cos(cr.rot), si = Math.sin(cr.rot); return [cr.c[0] + lx * co + lz * si, cr.c[1] - lx * si + lz * co]; });
const al = A.uni.ala; const ala = al ? [[-al.w / 2, -al.d / 2], [al.w / 2, -al.d / 2], [al.w / 2, al.d / 2], [-al.w / 2, al.d / 2]].map(([u, w]) => { const co = Math.cos(al.rot), si = Math.sin(al.rot); return [al.c[0] + u * co - w * si, al.c[1] + u * si + w * co]; }) : null;
// Reabilitação: cunha baixa (eixo, o0 -1.0 com setOut 0.3) e cunha alta recuada 0,4 para o norte
const reab = (() => { const baixa = [[15.8, -1.2], [17.4, -2.0], [18.4, -2.5]], alta = [[16.3, -1.5], [17.8, -2.4], [18.9, -3.2]]; const off = (pts, o) => { const nor = normals(pts, false); return pts.map(([x, z], i) => [x + nor[i][0] * o, z + nor[i][1] * o]); }; return [...off(alta, 0.3), ...off(baixa, -1.3).reverse()]; })();
const polys = { ciencias, cerca, crd: crdPoly, ...(ala ? { ala } : {}), reabilitacao: reab, ...(A.santuario.piquete ? { piquete: A.santuario.piquete } : {}), ...Object.fromEntries(casas.map((p, i) => ['casa' + i, p])) };
const polyPoly = (P, Q) => { let m = 1e9; for (const [x, z] of P) m = Math.min(m, polyD(x, z, Q)); for (const [x, z] of Q) m = Math.min(m, polyD(x, z, P)); return m; };
const esc = A.escarpa || []; const escD = (x, z) => { let d = 1e9; for (let i = 1; i < esc.length; i++) d = Math.min(d, segD(x, z, esc[i - 1], esc[i])); return d; };

// 0) contornos precisos x fitas / entre si / escarpa / torre da Biblioteca
for (const [n, P] of Object.entries(polys)) { for (const [k, pts] of Object.entries(pegada)) { let m = 1e9, at; for (const [x, z] of pts) { const d = polyD(x, z, P); if (d < m) { m = d; at = [x, z]; } } if (m < 0.25) report(`${n} x fita ${k}: ${m.toFixed(2)} em ${at.map((q) => q.toFixed(1))}`); } }
{ const ns = Object.keys(polys); for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { const d = polyPoly(polys[ns[i]], polys[ns[j]]); if (d < 0.15 && !(ns[i].startsWith('casa') && ns[j].startsWith('casa'))) report(`${ns[i]} x ${ns[j]}: ${d.toFixed(2)}`); } }
for (const [n, P] of Object.entries(polys)) { let m = 1e9; for (const [x, z] of P) m = Math.min(m, escD(x, z) - 0.3 - 0.05); if (m < 0.1) report(`escarpa x ${n}: folga ${m.toFixed(2)}`); } // crista da escarpa a 0,6 da fachada sul das casas (topo ±0,30)
for (const [n, P] of Object.entries(polys)) { let m = 1e9; for (const [x, z] of P) m = Math.min(m, ellD(x, z, ...circ.biblio)); if (m < 0.1) report(`torre da Biblioteca x ${n}: folga ${m.toFixed(2)}`); }
// 1) fitas x lago (folga)
for (const [k, pts] of Object.entries(pegada)) { let m = 1e9, at = null; for (const [x, z] of pts) { const d = polyD(x, z, A.lago); if (d < m) { m = d; at = [x.toFixed(1), z.toFixed(1)]; } } if (m < 1.0) report(`fita ${k} x lago: folga ${m.toFixed(2)} em ${at}`); }
// 2) fitas x fitas
const ks = Object.keys(pegada);
for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = pegada[ks[i]], b = pegada[ks[j]]; let m = 1e9, at = null; for (let p = 0; p < a.length; p += 2) for (let q = 0; q < b.length; q += 2) { const d = Math.hypot(a[p][0] - b[q][0], a[p][1] - b[q][1]); if (d < m) { m = d; at = a[p]; } } if (m < 0.3) report(`fita ${ks[i]} x fita ${ks[j]}: ${m.toFixed(2)} em ${at.map((v) => v.toFixed(1))}`); }
// 3) fitas x modelos
for (const [k, pts] of Object.entries(pegada)) for (const [n, [c, rx, rz, rot]] of Object.entries(circ)) { let m = 1e9, at; for (const [x, z] of pts) { const d = ellD(x, z, c, rx, rz, rot); if (d < m) { m = d; at = [x, z]; } } if (m < 0.2) report(`fita ${k} x ${n}: ${m.toFixed(2)} em ${at.map((v) => v.toFixed(1))}`); }
// 4) modelos x modelos
const cn = Object.keys(circ); for (let i = 0; i < cn.length; i++) for (let j = i + 1; j < cn.length; j++) { if ((cn[i] === 'bioma' && cn[j] === 'pastoBioma') || (cn[i] === 'pastoBioma' && cn[j] === 'bioma')) continue; const [c1, a1, b1] = circ[cn[i]], [c2, a2, b2] = circ[cn[j]]; const d = Math.hypot(c1[0] - c2[0], c1[1] - c2[1]) - Math.max(a1, b1) - Math.max(a2, b2); if (d < 0) report(`modelo ${cn[i]} x ${cn[j]}: ${d.toFixed(2)} (aprox. por círculos)`); }
// 5) passarelas: cruzamentos com fitas e modelos (sem as pontas, que pousam nos prédios) e o que há em cada ponta
const zonas = [...ZONAS, { id: 'santuarioPasto', elipse: SANTUARIO_GRAMADO.elipse }];
// ponta: a estrutura mais próxima (fita, modelo, contorno) se estiver a menos de 0.4; senão, a zona de chão
// que a contém (clareira), ou 'mata' com a distância até a zona mais próxima
const ponta = (p) => {
  let best = null; const ve = (n, d) => { if (!best || d < best[1]) best = [n, d]; };
  for (const [k, pts] of Object.entries(pegada)) for (const q of pts) ve('fita:' + k, Math.hypot(q[0] - p[0], q[1] - p[1]));
  for (const [n, [c, rx, rz, rot]] of Object.entries(circ)) ve(n, Math.max(0, ellD(p[0], p[1], c, rx, rz, rot)));
  for (const [n, P] of Object.entries(polys)) ve(n, Math.max(0, polyD(p[0], p[1], P)));
  if (best[1] <= 0.4) return best;
  let zb = null; for (const Z of zonas) { const d = zonaD(p[0], p[1], Z); if (!zb || d < zb[1]) zb = [Z.id, d]; }
  if (zb[1] < 0.25) return ['chão (zona ' + zb[0] + ')', Math.max(0, zb[1])]; // a mata só nasce a 0.25 ou mais das zonas
  graves++; return ['MATA (zona ' + zb[0] + ' a', zb[1]];
};
for (const [id, d] of Object.entries(PASSARELAS)) {
  const c = new CatmullRomCurve3(d.pts.map(([x, z, h]) => new Vector3(x, h, z))); const S = c.getSpacedPoints(80);
  const hits = new Set(); for (const p of S.slice(7, -7)) { for (const [k, pts] of Object.entries(pegada)) for (const q of pts) if (Math.hypot(q[0] - p.x, q[1] - p.z) < d.w / 2 + 0.05 && p.y < 2.2) hits.add('fita:' + k); for (const [n, [cc, rx, rz, rot]] of Object.entries(circ)) if (ellD(p.x, p.z, cc, rx, rz, rot) < d.w / 2) hits.add(n); if (polyD(p.x, p.z, A.lago) < 0) hits.add('lago'); }
  const txt = (p, i) => { const [n, dd] = ponta(p); const pat = d.patamar && i === d.pts.length - 1 ? ` + patamar de ${d.patamar.d} até ${d.patamar.em}` : ''; return `${n} ${dd.toFixed(2)} h${p[2]}${pat}`; };
  for (const p of [d.pts[0], d.pts[d.pts.length - 1]]) hits.delete(ponta(p)[0]); // a própria estrutura onde pousa
  if (hits.size) graves++;
  report(`passarela ${id}: cruza [${[...hits].join(', ')}]; início ${txt(d.pts[0], 0)}; fim ${txt(d.pts[d.pts.length - 1], d.pts.length - 1)}`);
}
// 6) passarela x passarela (planta, com as larguras) e diferença de altura
const amostra = {}; for (const [id, d] of Object.entries(PASSARELAS)) { const c = new CatmullRomCurve3(d.pts.map(([x, z, h]) => new Vector3(x, h, z))); amostra[id] = c.getSpacedPoints(120).map((p) => [p.x, p.z, p.y, d.w]); }
const ids = Object.keys(amostra); for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { let m = 1e9, at = null; for (const a of amostra[ids[i]]) for (const b of amostra[ids[j]]) { const dd = Math.hypot(a[0] - b[0], a[1] - b[1]) - a[3] / 2 - b[3] / 2; if (dd < m) { m = dd; at = [a[0].toFixed(1), a[1].toFixed(1), a[2].toFixed(2), b[2].toFixed(2)]; } } if (m < 0.1) report(`passarela ${ids[i]} x ${ids[j]}: folga ${m.toFixed(2)} em ${at}`); }
// 7) vias x fitas/modelos
// (a via leste morre sob a galeria dos gorilas, de propósito: o fim dentro de galeriaGorilas é aceito)
for (const v of A.vias || []) { const hits = new Set(); for (let i = 1; i < v.pts.length; i++) for (let t = 0; t <= 1; t += 0.1) { const x = v.pts[i - 1][0] + (v.pts[i][0] - v.pts[i - 1][0]) * t, z = v.pts[i - 1][1] + (v.pts[i][1] - v.pts[i - 1][1]) * t; for (const [k, pts] of Object.entries(pegada)) for (const q of pts) if (Math.hypot(q[0] - x, q[1] - z) < v.w / 2 + 0.1) hits.add('fita:' + k); for (const [n, [cc, rx, rz, rot]] of Object.entries(circ)) if (ellD(x, z, cc, rx, rz, rot) < v.w / 2) { if (v.id === 'leste' && n === 'galeriaGorilas' && i === v.pts.length - 1) continue; hits.add(n); } } if (hits.size) graves++; report(`via ${v.id}: cruza [${[...hits].join(', ')}]`); }
// 8) balão dos repasses sobre a Sede (o jogo usa A.sede.repasse)
if (A.sede.repasse) { const [x, y, z] = A.sede.repasse; const [cx, cz] = F.sede.centro(1); const d = Math.hypot(x - cx, z - cz); report(`repasse: a ${d.toFixed(2)} do meio do 2º módulo da Sede, ${(y - F.sede.alturaTopo(F.sede.max)).toFixed(2)} acima do teto`); if (d > 0.3) graves++; }
console.log(out.join('\n'));
process.exit(graves ? 1 : 0);
