// Os edifícios-fita da composição (traçados a partir da foto): Anel do Campus (aberto ao noroeste e ao sul,
// pontas arredondadas), Campus Universitário e seu elo, Anel da Biblioteca, Santuário (aberto à esquerda),
// Sede (fita clara em terraços, volume mais alto na ponta direita e o "guarda-chuva" junto à piscina) e a
// fita da Faculdade de Humanidades. Todas com beirais, floreiras e vegetação (faixa.js).
import * as THREE from 'three';
import { ellipse, curve, sweep, terraceFloor, terraceOutline, beams, FH } from '../geom.js';
import { A, pistaPts, SANTUARIO_GRAMADO } from '../../data/planta.js';
import { Faixa, matDe } from './faixa.js';
import { M } from '../materials.js';
import { heightAt } from '../ground.js';

const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };

// Volume mais alto na ponta direita da Sede: dois pavimentos extras (o 5º e o 6º da foto) sobre a cobertura do
// último módulo, só na geometria do nível máximo (a mecânica continua com 4 níveis)
function torreSede(F) {
  const m = F.mods[F.mods.length - 1]; const p = F.prof; const fh = p.fh || FH; const out = [];
  const k0 = Math.floor(m.path.length * 0.5); const path = m.path.slice(k0), W = m.W.slice(k0);
  const prof = { ...p, o0: -1.2, o1: 0, setIn: 0.15, setOut: 0, y0: (p.y0 || 0) + F.max * fh + 0.012, passeio: false };
  const E = []; for (let f = 0; f < 2; f++) E.push(...terraceFloor(f, 2, prof));
  const map = sweep(path, false, E, { u0: m.u0 + k0 * 0.22, caps: true, capPoly: terraceOutline(2, prof), width: (t, k) => W[k], widthCenter: F.oc });
  for (const [k, g] of map) out.push(mesh(g, matDe(k)));
  return out;
}
// O "guarda-chuva" da Holding: três placas brancas finas (1,4 x 1,0) sobre pilares de 0,03, ao lado da piscina
function guardaChuva({ c: [x, z], rot }) {
  const out = []; const co = Math.cos(rot), si = Math.sin(rot); const pil = [];
  for (const [dx, dz, h, giro] of [[0, 0, 1.05, 0], [0.8, -0.45, 1.22, 0.4], [-0.7, 0.5, 0.9, -0.35]]) {
    const px = x + dx * co + dz * si, pz = z - dx * si + dz * co;
    const placa = mesh(new THREE.BoxGeometry(1.4, 0.035, 1.0), M.whiteSmooth); placa.position.set(px, h, pz); placa.rotation.y = rot + giro; out.push(placa);
    for (const [u, v] of [[-0.45, -0.3], [0.45, 0.3]]) { const a = rot + giro; const qx = px + u * Math.cos(a) + v * Math.sin(a), qz = pz - u * Math.sin(a) + v * Math.cos(a); pil.push([[qx, 0, qz], [qx, h, qz]]); }
  }
  out.push(beams(pil, 0.03, M.whiteSmooth, 5));
  return out;
}
// Trilhas claras no pasto atrás do Santuário (linhas do campo da foto): fitas finas assentadas no terreno
function trilhasPasto() {
  const out = []; const T = SANTUARIO_GRAMADO.trilhas || []; const mat = M.caminhoTeto || M.concreto;
  for (const t of T) {
    const path = t.elipse ? ellipse(t.elipse[0][0], t.elipse[0][1], t.elipse[1], t.elipse[2], t.elipse[3] || 0, 80) : curve(t.pts, false, 40);
    for (const g of sweep(path, !!t.elipse, [{ a: [0.07, 0.02], b: [-0.07, 0.02], mat: 'c', uv: 'plan' }], { caps: false }).values()) {
      const P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setY(i, Math.max(0, heightAt(P.getX(i), P.getZ(i))) + 0.02);
      out.push(mesh(g, mat, false));
    }
  }
  return out;
}

export function faixas() {
  const a = A.anel, u = A.uni, s = A.santuario, sd = A.sede, b = A.anelBib;
  return {
    // anel de 5 pavimentos com dois vãos (cortes 2 e 5: ao sul, na frente, e ao noroeste), pontas arredondadas
    anel: new Faixa({ id: 'anel', closed: true, path: ellipse(a.c[0], a.c[1], a.rx, a.rz, a.rot, 260, 0.025, 2), modulos: 8,
      cortes: [0, 0.11, 0.24, 0.37, 0.5, 0.62, 0.75, 0.88, 1].map((v) => v + 0.03), aberturas: a.aberturas || [2, 5], abertura: 1.2,
      prof: { o0: -2.3, o1: 0, setIn: 0.36, setOut: 0.02, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 5, arbustoPasso: 0.66, arbustoMax: 1200 }),
    // fita longa em "C" que desce do fundo à esquerda; terraços voltados para o campo, por dentro da curva
    uni: new Faixa({ id: 'uni', closed: false, path: ellipse(u.arena.c[0], u.arena.c[1], u.arena.rx, u.arena.rz, u.arena.rot, 200, 0, 1, u.arena.a0, u.arena.a1), modulos: 4, ponta: 0,
      prof: { o0: -1.4, o1: 0, setIn: 0, setOut: 0, fh: 0.44, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 5 }),
    // Elo Norte: o trecho final da fita do Campus Universitário, que desce até encostar no Anel (pontas retas)
    uniElo: new Faixa({ id: 'uniElo', closed: false, path: curve(u.elo, false, 90), modulos: 2, ponta: 0,
      prof: { o0: -0.55, o1: 0.55, setIn: 0.12, setOut: 0.12, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 3 }),
    humanidades: new Faixa({ id: 'humanidades', closed: false, path: ellipse(a.c[0] + 0.3, a.c[1] - 0.2, a.rx - 3.6, a.rz - 3.3, a.rot, 90, 0.02, 3, 3.45, 5.55), modulos: 1,
      prof: { o0: -0.95, o1: 0, setIn: 0.24, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 3, arbustos: true }),
    anelBib: new Faixa({ id: 'anelBib', closed: false, path: ellipse(b.c[0], b.c[1], b.r1, b.r1 * 0.92, 0, 120, 0, 1, b.a0, b.a1), modulos: 3,
      prof: { o0: -(b.r1 - b.r0), o1: 0, setIn: 0, setOut: 0.5, fac: 'fac_fita', facIn: 'fac_madeira' }, niveis: 3 }),
    // pista de 4 andares com passeio no teto (a mecânica libera até 4 níveis), aberta à esquerda (corte 2, a
    // oeste), por onde entra a fita da Sede; atrás, as trilhas do pasto
    santuario: new Faixa({ id: 'santuario', closed: true, path: pistaPts(s.c[0], s.c[1], s.rx, s.rz, s.rot), modulos: 5,
      cortes: [0.1, 0.3, 0.5, 0.7, 0.9, 1.1], aberturas: [2], abertura: s.abertura ?? 1.4,
      prof: { o0: -1.3, o1: 0, setIn: 0.15, setOut: 0.03, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 4, decor: () => trilhasPasto() }),
    // fita clara em terraços verdes que abraça o lago pelo fundo e pela direita; na ponta direita o volume mais
    // alto, e o guarda-chuva (cobertura leve sobre pilares) junto à piscina
    sede: new Faixa({ id: 'sede', closed: false, path: ellipse(sd.c[0], sd.c[1], sd.rx, sd.rz, sd.rot, 200, 0, 1, sd.a0, sd.a1), modulos: 4,
      prof: { o0: sd.o0, o1: 0, setIn: 0.3, setOut: 0, fac: 'fac_fita', facIn: 'fac_fita', roof: 'roof' }, niveis: 4,
      decor: (F) => [...torreSede(F), ...(sd.guardaChuva ? guardaChuva(sd.guardaChuva) : [])] }),
  };
}
