// Os edifícios-fita da composição (traçados a partir da foto): Anel do Campus, Campus
// Universitário e seu elo, Anel da Biblioteca, Santuário, Sede e a fita da Faculdade de Humanidades.
import { ellipse, curve } from '../geom.js';
import { A } from '../../data/planta.js';
import { Faixa } from './faixa.js';

// pista (retângulo arredondado) para o Santuário
function pista(cx, cz, rx, rz, rot, n = 220) {
  const out = []; const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const ca = Math.cos(a), sa = Math.sin(a); const k = 3.2; const x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / k) * rx, z = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / k) * rz; out.push([cx + x * c - z * s, cz + x * s + z * c]); }
  return out;
}

export function faixas() {
  const a = A.anel, u = A.uni, s = A.santuario, sd = A.sede, b = A.anelBib;
  return {
    anel: new Faixa({ id: 'anel', closed: true, path: ellipse(a.c[0], a.c[1], a.rx, a.rz, a.rot, 260, 0.025, 2), modulos: 8,
      cortes: [0, 0.11, 0.24, 0.37, 0.5, 0.62, 0.75, 0.88, 1].map((v) => v + 0.03),
      prof: { o0: -2.3, o1: 0, setIn: 0.36, setOut: 0.02, fac: 'fac_quente' }, niveis: 5 }),
    uni: new Faixa({ id: 'uni', closed: false, path: ellipse(u.c[0], u.c[1], u.rx, u.rz, u.rot, 160, 0.04, 5, 0.95, 5.35), modulos: 4,
      prof: { o0: -1.7, o1: 0, setIn: 0.24, setOut: 0.02, fac: 'fac_quente' }, niveis: 5 }),
    uniElo: new Faixa({ id: 'uniElo', closed: false, path: curve([[-17.2, 0.4], [-19.6, -2.6], [-18.6, -5.8], [-15.8, -7.6]], false, 90), modulos: 2,
      prof: { o0: -0.55, o1: 0.55, setIn: 0.12, setOut: 0.12, fac: 'fac_quente' }, niveis: 3 }),
    humanidades: new Faixa({ id: 'humanidades', closed: false, path: ellipse(a.c[0] + 0.3, a.c[1] - 0.2, a.rx - 3.6, a.rz - 3.3, a.rot, 90, 0.02, 3, 3.45, 5.55), modulos: 1,
      prof: { o0: -0.95, o1: 0, setIn: 0.24, fac: 'fac_quente' }, niveis: 3, arbustos: true }),
    anelBib: new Faixa({ id: 'anelBib', closed: false, path: ellipse(b.c[0], b.c[1], b.r1, b.r1 * 0.92, 0, 120, 0, 1, b.a0, b.a1), modulos: 3,
      prof: { o0: -(b.r1 - b.r0), o1: 0, setIn: 0, setOut: 0.5, fac: 'fac_quente', facIn: 'fac_madeira' }, niveis: 3 }),
    santuario: new Faixa({ id: 'santuario', closed: true, path: pista(s.c[0], s.c[1], s.rx, s.rz, s.rot), modulos: 5,
      prof: { o0: -1.1, o1: 0, setIn: 0.2, setOut: 0.05, fac: 'fac_escuro', facIn: 'fac_quente' }, niveis: 2 }),
    sede: new Faixa({ id: 'sede', closed: true, path: ellipse(sd.c[0], sd.c[1], sd.rx, sd.rz, sd.rot, 200, 0, 1), modulos: 4,
      prof: { o0: -1.5, o1: 0, setIn: 0.16, setOut: 0.04, fac: 'fac_escuro', facIn: 'fac_escuro' }, niveis: 4, arbustos: false }),
  };
}
