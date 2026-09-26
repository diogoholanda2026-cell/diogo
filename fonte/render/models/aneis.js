// Os edifícios-fita da composição (traçados a partir da foto limpa): Anel do Campus (colina verde em anfiteatro, com
// talude interno e a ponta leste em degraus), arena do Campus Universitário (parede de células com cinco torres) e o
// Elo, Anel da Biblioteca, Santuário (fita aberta em "6" com a rampa em patamares), Sede (anel de varandas brancas com
// a fita interna do leste) e a fita da Faculdade de Humanidades. Vegetação e ripas em faixa.js.
import * as THREE from 'three';
import { ellipse, curve, sweep, subPath, subPathDenso, terraceFloor, terraceOutline, pathLength, pontaFator, deckGeo, merge, normals, FH } from '../geom.js';
import { A, SANTUARIO_GRAMADO } from '../../data/planta.js';
import { Faixa, matDe } from './faixa.js';
import { M } from '../materials.js';
import { heightAt } from '../ground.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// funde vários mapas material -> geometria num só (1 Mesh por material)
function fundir(maps) { const por = new Map(); for (const mp of maps) for (const [k, g] of mp) { if (!por.has(k)) por.set(k, []); por.get(k).push([g, new THREE.Matrix4()]); } const out = []; for (const [k, list] of por) out.push(mesh(list.length === 1 ? list[0][0] : merge(list), matDe(k))); return out; }
// ponto da elipse em θ deslocado o pela normal (para fora), como a Faixa faz com o caminho do Anel
function elipsePonto(e, th, o) { const [cx, cz, rx, rz, rot] = e; const c = Math.cos(rot), s = Math.sin(rot); const u = Math.cos(th) * rx, v = Math.sin(th) * rz; let nx = Math.cos(th) * rz, nz = Math.sin(th) * rx; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; const px = u + nx * o, pz = v + nz * o; return [cx + px * c - pz * s, cz + px * s + pz * c]; }

// Cinco torres prismáticas na platibanda da arena (fachada celular alinhada com a parede, leve batimento para dentro,
// tampa creme); a quinta, rente à ponta NE, tem o rosto externo liso (tampa)
function torresArena(F) {
  const ar = A.uni.arena; const path = F.def.path; const L = pathLength(path, false); const p = F.prof; const fh = p.fh || FH; const y0 = (p.y0 || 0) + F.max * fh; const maps = [];
  ar.torres.forEach((t, k) => {
    const w = ar.torreW[k] / 2, h = ar.torreH[k]; const sp = subPath(path, false, Math.max(0, t - w / L), Math.min(1, t + w / L), 5); const y1 = y0 + h;
    const rep = p.celRep || [7.04, 2.2]; const fac = (a, b) => ({ a, b, mat: 'fac_celular', uv: 'facade', vBase: p.y0 || 0, uRep: rep[0], vRep: rep[1] });
    const E = [fac([p.o1 + 0.06, y0], [p.o1 - 0.02, y1]), { a: [p.o1 - 0.02, y1], b: [p.o1 - 0.02, y1 + 0.04], mat: 'fasciaBeiral', uv: 'run' }, { a: [p.o1 - 0.02, y1 + 0.04], b: [p.o0 + 0.02, y1 + 0.04], mat: 'fasciaBeiral', uv: 'plan' }, { a: [p.o0 + 0.02, y1 + 0.04], b: [p.o0 + 0.02, y1], mat: 'fasciaBeiral', uv: 'run' }, fac([p.o0 + 0.02, y1], [p.o0 - 0.06, y0])];
    maps.push(sweep(sp, false, E, { caps: true, capMat: 'fasciaBeiral', u0: t * L - w }));
  });
  return fundir(maps);
}
// Ponte em Y do Anel (nível máximo): tronco claro de 0,5 do campo até a bifurcação, dois braços de 0,35 que sobem
// pelo talude noroeste até o terraço do 4º nível; geometria fundida no lote 'caminhoTeto' (0 chamadas)
function rampasAnel(F) {
  const a = A.anel; const e = [a.c[0], a.c[1], a.rx, a.rz, a.rot]; const p = F.prof; const fh = p.fh || FH; const yT = 4 * fh + 0.05 + 0.06;
  const linha = (t0, t1, n) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n; const th = t0[0] + (t1[0] - t0[0]) * t, o = t0[1] + (t1[1] - t0[1]) * t, y = t0[2] + (t1[2] - t0[2]) * t; const [x, z] = elipsePonto(e, th, o); out.push([x, y, z]); } return out; };
  const bif = [3.75, -2.15, 0.98], pe = [3.98, -3.5, 0.06];
  const g = merge([[deckGeo(linha(pe, bif, 8), 0.5), new THREE.Matrix4()], [deckGeo(linha(bif, [3.5, -1.3, yT], 8), 0.35), new THREE.Matrix4()], [deckGeo(linha(bif, [4.0, -1.3, yT], 8), 0.35), new THREE.Matrix4()]]);
  return new Map([['caminhoTeto', g]]);
}
// Fitas internas da Sede: a alta (4 pavimentos) por dentro do anel no leste, com a ponta NE afinada, e a baixa (2
// pavimentos) que contorna o canto SE e segue até a Ciências, terminando reta encostada na Ponte Coberta
function frenteSede(F) {
  const sd = A.sede; const prof = { ...F.prof, passeio: false }; const maps = [];
  const alta = subPathDenso(curve(sd.interna.alta, false, 120), false, 0, 1, 0.4, 1.0, 0); const pa = { ...prof, o0: -1.4 }; const Wa = alta.s.map((d) => pontaFator(d, 1.0));
  const Ea = []; for (let f = 0; f < 4; f++) Ea.push(...terraceFloor(f, 4, pa));
  maps.push(sweep(alta.pts, false, Ea, { caps: 'ini', capPoly: terraceOutline(4, pa), width: (t, k) => Wa[k], widthCenter: (pa.o0 + pa.o1) / 2 }));
  const baixa = subPathDenso(curve(sd.interna.baixa, false, 200), false, 0, 1, 0.4).pts; const pb = { ...prof, o0: -1.3 };
  const Eb = []; for (let f = 0; f < 2; f++) Eb.push(...terraceFloor(f, 2, pb));
  maps.push(sweep(baixa, false, Eb, { caps: 'fim', capPoly: terraceOutline(2, pb) }));
  return fundir(maps);
}
// Rampa do Santuário: três patamares (3, 2 e 1 andares) que descem da ponta oeste da fita, ao longo do campo de
// rúgbi, até a Sede; o mesmo perfil da fita (beirais alinhados), cada patamar tampado nas duas pontas
function rampaSantuario(F) {
  const eixo = curve([...A.santuario.rampa].reverse(), false, 60); const L = pathLength(eixo, false); const prof = { ...F.prof, passeio: false }; const maps = [];
  [[3, 0, 1 / 3], [2, 1 / 3, 2 / 3], [1, 2 / 3, 1]].forEach(([Fd, s0, s1]) => {
    const { pts } = subPathDenso(eixo, false, s0, s1, 0.22); const E = []; for (let f = 0; f < Fd; f++) E.push(...terraceFloor(f, Fd, prof));
    maps.push(sweep(pts, false, E, { caps: true, capPoly: terraceOutline(Fd, prof), u0: s0 * L }));
  });
  return fundir(maps);
}
// Campo de rúgbi da foto: 9 linhas brancas (e a curta do meio) e a orla clara pela elipse, assentadas no terreno
function trilhasPasto() {
  const G = SANTUARIO_GRAMADO; const [[cx, cz], rx, rz, rot] = G.elipse; const c = Math.cos(rot), s = Math.sin(rot); const maps = [];
  const P = (u, v) => [cx + u * c - v * s, cz + u * s + v * c];
  for (const u of G.linhas || []) { const v = Math.abs(u - (G.curta ?? 99)) < 1e-6 ? 0.42 : 0.85; maps.push(sweep([P(u * rx, -v * rz), P(u * rx, v * rz)], false, [{ a: [0.03, 0.02], b: [-0.03, 0.02], mat: 'c', uv: 'plan' }], { caps: false })); }
  for (const t of G.trilhas || []) { const path = t.elipse ? ellipse(t.elipse[0][0], t.elipse[0][1], t.elipse[1], t.elipse[2], t.elipse[3] || 0, 80) : curve(t.pts, false, 40); const w = t.w ?? 0.07; maps.push(sweep(path, !!t.elipse, [{ a: [w, 0.02], b: [-w, 0.02], mat: 'c', uv: 'plan' }], { caps: false })); }
  const out = [];
  for (const [, g] of fundir(maps).map((m) => [null, m.geometry])) { const Pp = g.attributes.position; for (let i = 0; i < Pp.count; i++) Pp.setY(i, Math.max(0, heightAt(Pp.getX(i), Pp.getZ(i))) + 0.02); out.push(mesh(g, M.whiteSmooth, false)); }
  return out;
}

export function faixas() {
  const a = A.anel, u = A.uni, s = A.santuario, sd = A.sede, b = A.anelBib; const ar = u.arena;
  // caminho do Santuário: volta interna, U e volta externa (o eixo corre na fresta entre as duas voltas encostadas)
  const l = s.laco; const pI = curve(l.interna, false, 60), pE = curve(l.externa, false, 110); const pU = curve([pI[pI.length - 1], l.u[0], l.u[1], pE[0]], false, 10).slice(1, -1);
  const sApex = pathLength(pI, false) + pathLength([pI[pI.length - 1], ...pU], false) / 2;
  return {
    // anel de 5 pavimentos com dois vãos (cortes 2 e 5: ao sul, na frente, e ao noroeste); lajes finas, terraços
    // internos largos e verdes, os 2 andares de baixo enterrados no talude, passeio claro na borda externa do teto;
    // só a ponta leste (do lado do Instituto) desce em degraus; ponte em Y no noroeste no nível máximo
    anel: new Faixa({ id: 'anel', closed: true, path: ellipse(a.c[0], a.c[1], a.rx, a.rz, a.rot, 260, 0.025, 2), modulos: 8,
      cortes: [0, 0.11, 0.24, 0.37, 0.5, 0.62, 0.75, 0.88, 1].map((v) => v + 0.03), aberturas: a.aberturas || [2, 5], abertura: 1.2, passo: 0.32, ponta: 2.4, pontaDegrau: { leste: true },
      prof: { o0: -3.0, o1: 0, setIn: 0.5, setOut: 0.02, beiral: 0.16, slab: 0.05, curb: 0.04, curbW: 0.08, passeioW: 0.22, passeioAt: 0.25, taludeAndares: 2, fac: 'fac_fita', facIn: 'fac_fita' },
      niveis: 5, arbustoPasso: 0.8, arbustoMax: 900, arbustoFora: 0.4, moitas: true, ripaPasso: 0.2, extraGeo: (F) => rampasAnel(F) }),
    // arena elíptica rasa do Campus Universitário: parede vertical de células (2 fileiras por nível de 0,44), aberta
    // para a frente, com as cinco torres na platibanda no nível máximo
    uni: new Faixa({ id: 'uni', closed: false, path: ellipse(ar.c[0], ar.c[1], ar.rx, ar.rz, ar.rot, 200, 0, 1, ar.a0, ar.a1), modulos: 4, ponta: 0,
      prof: { o0: -1.4, o1: 0, setIn: 0, setOut: 0, fh: 0.44, beiral: 0, curb: 0, curbW: 0.14, celular: true, fac: 'fac_celular', facIn: 'fac_celular', roof: 'roof' },
      niveis: 5, ripas: false, arbustoPasso: 1.2, decor: (F) => torresArena(F) }),
    // Elo Norte: terraços verdes que saem da ponta sudoeste da arena, por trás da ala, e descem pelo oeste até o Anel
    uniElo: new Faixa({ id: 'uniElo', closed: false, path: curve(u.elo, false, 90), modulos: 2, ponta: 0,
      prof: { o0: -0.55, o1: 0.55, setIn: 0.12, setOut: 0.12, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 3 }),
    humanidades: new Faixa({ id: 'humanidades', closed: false, path: ellipse(a.c[0] + 0.3, a.c[1] - 0.2, a.rx - 3.95, a.rz - 3.65, a.rot, 90, 0.02, 3, 3.9, 5.55), modulos: 1,
      prof: { o0: -0.95, o1: 0, setIn: 0.24, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 3, arbustos: true }),
    // Anel da Biblioteca: 3 pavimentos de 0,55 em degraus para fora, fachada interna em colmeia, passeio de deque cinza
    anelBib: new Faixa({ id: 'anelBib', closed: false, path: ellipse(b.c[0], b.c[1], b.r1, b.r1 * 0.92, 0, 120, 0, 1, b.a0, b.a1), modulos: 3,
      prof: { o0: -2.8, o1: 0, setIn: 0, setOut: 0.5, fh: 0.55, fac: 'fac_fita', facIn: 'fac_colmeia', caminho: 'grey' }, niveis: 3 }),
    // fita aberta em "6" de 4 pavimentos: nasce na ponta livre da volta interna, dá a volta no U (onde as duas faixas
    // se estreitam e se fundem) e segue pela externa até a ponta reta onde encosta a rampa; fachada âmbar, teto verde
    // com friso claro e sem caminho; atrás, a rampa em patamares e o campo de rúgbi
    santuario: new Faixa({ id: 'santuario', closed: false, path: [...pI, ...pU, ...pE], modulos: 5, cortes: [0, 0.2, 0.36, 0.55, 0.78, 1], passo: 0.22, ponta: 1.2, pontas: { 5: 0 },
      centroLargura: 0, largura: (d) => 0.5 + 0.5 * smoothstep(0, 2.0, Math.abs(d - sApex)),
      prof: { o0: -1.2, o1: 0, setIn: 0.12, setOut: 0.03, curbMat: 'fasciaBeiral', fac: 'fac_ambar', facIn: 'fac_ambar', roof: 'roof', passeio: false }, niveis: 4,
      arbustoPasso: 0.9, arbustoMax: 400, decor: (F) => [...rampaSantuario(F), ...trilhasPasto()] }),
    // anel elíptico aberto da Sede: varandas brancas contínuas (laje creme com parapeito), face interna vertical,
    // cobertura de deque escuro liso; proa de altura cheia à esquerda, ponta reta no canto SE; no nível máximo a
    // geometria ganha o 5º pavimento e as fitas internas do leste
    sede: new Faixa({ id: 'sede', closed: false, path: curve(sd.path, false, 260), modulos: 4, passo: 0.32, ponta1: 0, andaresExtra: 1,
      prof: { o0: sd.o0 ?? -2.1, o1: 0, setIn: 0, setOut: 0, beiral: 0.22, slab: 0.07, curb: 0.14, curbW: 0.03, curbMat: 'fasciaBeiral', fac: 'fac_fita', facIn: 'fac_fita', roof: 'roofMetal', passeio: false },
      niveis: 4, arbustos: false, ripas: false, decor: (F) => frenteSede(F) }),
  };
}
