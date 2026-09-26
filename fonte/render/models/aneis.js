// Os edifícios-fita da composição (traçados a partir da foto limpa): Anel do Campus (colina verde em anfiteatro, com
// talude interno e a ponta leste em degraus), arena do Campus Universitário (parede de células com cinco torres) e o
// Elo, Anel da Biblioteca, Santuário (fita em arco que abraça a Cúpula), Sede (U de varandas brancas no fim do eixo)
// e a fita da Faculdade de Humanidades. Vegetação e ripas em faixa.js.
import * as THREE from 'three';
import { ellipse, curve, sweep, subPath, subPathDenso, terraceFloor, terraceOutline, pathLength, pontaFator, deckGeo, merge, normals, FH } from '../geom.js';
import { A, arco } from '../../data/planta.js';
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
export function faixas() {
  const a = A.anel, u = A.uni, s = A.santuario, sd = A.sede, b = A.anelBib; const ar = u.arena;
  // caminho do Santuário: arco em volta da cúpula (de oeste a leste, pelo norte); a fita cresce para dentro
  const pS = curve(arco(s.centro[0], s.centro[1], s.r, s.a0, s.a1, 40), false, 220);
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
    anelBib: new Faixa({ id: 'anelBib', closed: false, path: ellipse(b.c[0], b.c[1], b.r1, b.r1 * 0.92, 0, 120, 0, 1, b.a0, b.a1), modulos: 3, ponta: 0.6,
      prof: { o0: -2.8, o1: 0, setIn: 0, setOut: 0.5, fh: 0.55, fac: 'fac_fita', facIn: 'fac_colmeia', caminho: 'grey' }, niveis: 3 }),
    // fita em arco de 4 pavimentos que abraça a Cúpula pelo norte: fachada âmbar, teto verde com friso claro; as duas
    // pontas afinam
    santuario: new Faixa({ id: 'santuario', closed: false, path: pS, modulos: 5, cortes: [0, 0.2, 0.4, 0.6, 0.8, 1], passo: 0.24, ponta: 1.6,
      prof: { o0: -s.largura, o1: 0, setIn: 0.12, setOut: 0.03, curbMat: 'fasciaBeiral', fac: 'fac_ambar', facIn: 'fac_ambar', roof: 'roof', passeio: false }, niveis: 4,
      arbustoPasso: 0.9, arbustoMax: 400 }),
    // Sede da Holding: fita em U aberta para o sul (sobe a perna oeste, contorna o fundo e desce a leste), varandas
    // brancas contínuas (laje creme com parapeito), face interna vertical e cobertura de deque escuro liso; pontas retas
    // nas duas pernas (de frente para o eixo); no nível máximo ganha o 5º pavimento
    sede: new Faixa({ id: 'sede', closed: false, path: curve(sd.path, false, 260), modulos: 4, passo: 0.32, ponta: 0, ponta1: 0, andaresExtra: 1,
      prof: { o0: sd.o0 ?? -2.1, o1: 0, setIn: 0, setOut: 0, beiral: 0.22, slab: 0.07, curb: 0.14, curbW: 0.03, curbMat: 'fasciaBeiral', fac: 'fac_fita', facIn: 'fac_fita', roof: 'roofMetal', passeio: false },
      niveis: 4, arbustos: false, ripas: false }),
  };
}
