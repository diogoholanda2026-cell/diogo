// Os edifícios-fita da composição (traçados a partir da foto): Anel do Campus, Campus
// Universitário e seu elo, Anel da Biblioteca, Santuário, Sede e a fita da Faculdade de Humanidades.
import { ellipse, curve } from '../geom.js';
import { A, pistaPts } from '../../data/planta.js';
import { Faixa } from './faixa.js';

export function faixas() {
  const a = A.anel, u = A.uni, s = A.santuario, sd = A.sede, b = A.anelBib;
  return {
    anel: new Faixa({ id: 'anel', closed: true, path: ellipse(a.c[0], a.c[1], a.rx, a.rz, a.rot, 260, 0.025, 2), modulos: 8,
      cortes: [0, 0.11, 0.24, 0.37, 0.5, 0.62, 0.75, 0.88, 1].map((v) => v + 0.03),
      prof: { o0: -2.3, o1: 0, setIn: 0.36, setOut: 0.02, fac: 'fac_quente' }, niveis: 5 }),
    // fita longa em "C" que desce do fundo à esquerda; terraços voltados para o campo, por dentro da curva
    uni: new Faixa({ id: 'uni', closed: false, path: curve(u.path, false, 200), modulos: 4,
      prof: { o0: -1.0, o1: 0, setIn: 0.12, setOut: 0.02, fac: 'fac_quente' }, niveis: 5 }),
    // Elo Norte: o trecho final da fita do Campus Universitário, que desce até encostar no Anel
    uniElo: new Faixa({ id: 'uniElo', closed: false, path: curve(u.elo, false, 90), modulos: 2,
      prof: { o0: -0.55, o1: 0.55, setIn: 0.12, setOut: 0.12, fac: 'fac_quente' }, niveis: 3 }),
    humanidades: new Faixa({ id: 'humanidades', closed: false, path: ellipse(a.c[0] + 0.3, a.c[1] - 0.2, a.rx - 3.6, a.rz - 3.3, a.rot, 90, 0.02, 3, 3.45, 5.55), modulos: 1,
      prof: { o0: -0.95, o1: 0, setIn: 0.24, fac: 'fac_quente' }, niveis: 3, arbustos: true }),
    anelBib: new Faixa({ id: 'anelBib', closed: false, path: ellipse(b.c[0], b.c[1], b.r1, b.r1 * 0.92, 0, 120, 0, 1, b.a0, b.a1), modulos: 3,
      prof: { o0: -(b.r1 - b.r0), o1: 0, setIn: 0, setOut: 0.5, fac: 'fac_quente', facIn: 'fac_madeira' }, niveis: 3 }),
    // pista de 4 andares de vidro quente com passeio no teto (a mecânica libera até 4 níveis)
    santuario: new Faixa({ id: 'santuario', closed: true, path: pistaPts(s.c[0], s.c[1], s.rx, s.rz, s.rot), modulos: 5,
      prof: { o0: -1.3, o1: 0, setIn: 0.15, setOut: 0.03, fac: 'fac_quente', facIn: 'fac_quente' }, niveis: 4 }),
    // fita aberta (estilo anel de vidro) que abraça o lago pelo fundo e pela direita; terraços descem para a água
    sede: new Faixa({ id: 'sede', closed: false, path: ellipse(sd.c[0], sd.c[1], sd.rx, sd.rz, sd.rot, 200, 0, 1, sd.a0, sd.a1), modulos: 4,
      prof: { o0: sd.o0, o1: 0, setIn: 0.3, setOut: 0, fac: 'fac_escuro', facIn: 'fac_quente', roof: 'roofMetal' }, niveis: 4, arbustos: false }),
  };
}
