// Testes da rodovia ligável (D108): via nova em T no meio de uma aresta da rodovia, cruzamento em X, ligação a nó da
// rodovia (o da Vila, o de entrada e os do meio), recusa na ponte e a menos de 25 m das pontas dela, divisão que preserva
// tipo, flag RODOVIA e cota, demolir a ligação (a rodovia segue inteira), demolir a rodovia (segue recusado), save e hash
// ida e volta, grafo e redes coerentes.
// Roda sozinho: node ferramentas/testes/rodovia-ligar.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { conferirEspelho, refDe, idxDaRef } from '../../fonte/contratos/espelho.js';
import { ARESTA } from '../../fonte/contratos/flags.js';
import { montarSave, lerSave, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { VIAS_ORDEM } from '../../fonte/data/vias.js';
import { arestasDoNo } from '../../fonte/sim/vias/grafo.js';
import { noLigavel, rodoviaLigavelEm, FOLGA_PONTE_RODOVIA } from '../../fonte/sim/vias/validar.js';
import { encaixarTraco } from '../../fonte/sim/vias/encaixe.js';

const novaSim = (semente = 'rodovia-ligar') => criarSimulacao({ semente, modo: 'livre' });

function via(sim, tipo, pontos, extra = {}) {
  const args = { modo: 'reta', tipo, pontos, sessao: 1, ...extra };
  const p = sim.q.via.previa(args);
  const r = p.ok ? sim.cmd('via.construir', { plano: args }) : null;
  return { p, r };
}
const codigos = (p) => [...new Set(p.erros.map((e) => e.codigo))];
const vivasRodovia = (sim) => {
  const A = sim.tabelas.arestas;
  const out = [];
  for (let e = 0; e < A.n; e++) if (A.viva[e] && A.flags[e] & ARESTA.RODOVIA) out.push(e);
  return out;
};
const limpo = (sim) => {
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) }), []);
};
/** Aresta da rodovia (sem ponte) que contém o ponto x do eixo (pelo nó de partida e de chegada). */
const arestaEm = (sim, x) => {
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  return vivasRodovia(sim).find((e) => N.x[A.a[e]] < x && x < N.x[A.b[e]]);
};
const ponte = (sim) => vivasRodovia(sim).filter((e) => sim.tabelas.arestas.flags[e] & ARESTA.PONTE);

// Pontos conhecidos do mapa: a aresta de x = -401 a -220 (z ~ -1204), a ponte entre x = -1375 e -1225.
const T_MEIO = [[-310, -1084], [-310, -1204]];

test('T no meio de uma aresta da rodovia: divide em duas arestas rodovia com a flag, o tipo e a cota', () => {
  const sim = novaSim();
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const e0 = arestaEm(sim, -310);
  const [y0, y1] = [A.y[2 * e0], A.y[2 * e0 + 1]];
  const n0 = vivasRodovia(sim).length;
  const { p, r } = via(sim, 'avenida', T_MEIO);
  assert.ok(p.ok, JSON.stringify(p.erros));
  assert.equal(p.divisoes, 1);
  assert.ok(r?.ok, JSON.stringify(r));
  assert.equal(vivasRodovia(sim).length, n0 + 1, 'a aresta virou duas, ambas rodovia');
  const meio = N.n && [...Array(N.n).keys()].find((n) => N.viva[n] && Math.abs(N.x[n] + 310) < 2 && Math.abs(N.z[n] + 1204) < 3);
  assert.ok(meio !== undefined);
  const ls = arestasDoNo(sim.grafo, meio);
  assert.equal(ls.length, 3, 'rodovia dividida e a avenida');
  const rod = ls.filter((e) => A.flags[e] & ARESTA.RODOVIA);
  assert.equal(rod.length, 2);
  for (const e of rod) assert.equal(VIAS_ORDEM[A.tipo[e]], 'rodovia');
  // a cota do nó novo fica entre as pontas da aresta dividida e as metades encaixam nela
  assert.ok(N.y[meio] <= Math.max(y0, y1) + 1e-6 && N.y[meio] >= Math.min(y0, y1) - 1e-6);
  const cotas = rod.map((e) => (A.a[e] === meio ? A.y[2 * e] : A.y[2 * e + 1]));
  for (const c of cotas) assert.ok(Math.abs(c - N.y[meio]) < 1e-3);
  limpo(sim);
});

test('cruzamento em X: a via que atravessa a rodovia ganha um nó e a rodovia segue dividida', () => {
  const sim = novaSim();
  const n0 = vivasRodovia(sim).length;
  const { p, r } = via(sim, 'avenida', [[-310, -1084], [-310, -1324]]);
  assert.ok(p.ok, JSON.stringify(p.erros));
  assert.ok(r?.ok, JSON.stringify(r));
  assert.equal(vivasRodovia(sim).length, n0 + 1);
  const N = sim.tabelas.nos;
  const x = [...Array(N.n).keys()].find((n) => N.viva[n] && Math.abs(N.x[n] + 310) < 2 && Math.abs(N.z[n] + 1204) < 3);
  assert.equal(N.grau[x], 4);
  limpo(sim);
});

test('ligação ao nó do meio da rodovia, ao da Vila (junção) e ao de entrada', () => {
  const sim = novaSim();
  const N = sim.tabelas.nos;
  const A = sim.tabelas.arestas;
  const noEm = (x, z) => [...Array(N.n).keys()].find((n) => N.viva[n] && Math.abs(N.x[n] - x) < 2 && Math.abs(N.z[n] - z) < 2);
  const no22 = noEm(-90, -1205);
  assert.ok(no22 !== undefined && noLigavel(sim, no22));
  const { p, r } = via(sim, 'avenida', [[-90, -1105], [-90, -1205]]);
  assert.ok(p.ok, JSON.stringify(p.erros));
  assert.ok(p.encaixes.some((x) => x.tipo === 'no'));
  assert.ok(r?.ok);
  assert.equal(N.grau[no22], 3);
  // a junção da Vila (grau 3) e o nó de entrada (ponta, grau 1) seguem ligáveis
  const entrada = idxDaRef(sim.json.mapa.entrada);
  assert.ok(noLigavel(sim, entrada));
  const juncao = noEm(40, -1203);
  assert.ok(noLigavel(sim, juncao));
  const e = encaixarTraco(sim, { modo: 'reta', tipo: 'avenida', pontos: [[160, -700], [60, -700]] });
  assert.equal(e.ancoras[1]?.no, entrada);
  limpo(sim);
  void A;
});

test('a ponte da rodovia e os 25 m das pontas dela não recebem ligação; a ponte não se divide nem se cruza', () => {
  const sim = novaSim();
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const pt = ponte(sim);
  assert.ok(pt.length >= 1);
  const e = pt[0];
  for (const n of [A.a[e], A.b[e]]) assert.ok(!noLigavel(sim, n), 'nó da ponta da ponte');
  assert.ok(!rodoviaLigavelEm(sim, e, 70), 'no meio da ponte');
  // aresta vizinha (fim a oeste da ponte): a menos de 25 m da ponta não, a mais disso sim
  const viz = vivasRodovia(sim).find((x) => A.b[x] === A.a[e]);
  const comp = A.arco[17 * viz + 16];
  assert.ok(!rodoviaLigavelEm(sim, viz, comp - FOLGA_PONTE_RODOVIA + 1));
  assert.ok(rodoviaLigavelEm(sim, viz, comp - FOLGA_PONTE_RODOVIA - 1));
  const p = sim.q.via.previa({ modo: 'reta', tipo: 'avenida', pontos: [[N.x[A.a[e]] + 60, N.z[A.a[e]] + 100], [N.x[A.a[e]] + 60, N.z[A.a[e]]]], sessao: 1 });
  assert.ok(!p.ok);
  assert.ok(!p.encaixes.some((x) => x.tipo === 'aresta'));
  // via que cruzaria a ponte no nível: recusa por colisão
  const x = sim.q.via.previa({ modo: 'reta', tipo: 'avenida', pontos: [[N.x[A.a[e]] + 70, N.z[A.a[e]] - 100], [N.x[A.a[e]] + 70, N.z[A.a[e]] + 100]], sessao: 1 });
  assert.ok(!x.ok);
  assert.ok(codigos(x).includes('colisao'), JSON.stringify(x.erros));
  // cruzar a 15 m da ponta (aresta vizinha): recusa por colisão
  const cx = N.x[A.a[viz]] + 0;
  void cx;
  const nx = N.x[A.a[e]] - 15;
  const nz = N.z[A.a[e]];
  const q = sim.q.via.previa({ modo: 'reta', tipo: 'avenida', pontos: [[nx, nz - 100], [nx, nz + 100]], sessao: 1, encaixe: false });
  assert.ok(codigos(q).includes('colisao'), JSON.stringify(q.erros));
  limpo(sim);
});

test('demolir a via ligada devolve a rodovia inteira (duas arestas, nó de grau 2); demolir a rodovia segue recusado', () => {
  const sim = novaSim();
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const { r } = via(sim, 'avenida', T_MEIO);
  assert.ok(r?.ok);
  const nRod = vivasRodovia(sim).length;
  const d = sim.cmd('via.demolir', { arestas: r.dados.arestas, sessao: 1 });
  assert.ok(d.ok, JSON.stringify(d));
  assert.equal(vivasRodovia(sim).length, nRod, 'as duas metades continuam');
  const meio = [...Array(N.n).keys()].find((n) => N.viva[n] && Math.abs(N.x[n] + 310) < 2 && Math.abs(N.z[n] + 1204) < 3);
  assert.equal(N.grau[meio], 2);
  for (const e of arestasDoNo(sim.grafo, meio)) assert.ok(A.flags[e] & ARESTA.RODOVIA);
  limpo(sim);
  // a rodovia (inteira, dividida ou ponte) segue sem demolir nem melhorar
  for (const e of vivasRodovia(sim).slice(0, 3)) {
    const ref = refDe(e, A.ger[e]);
    assert.equal(sim.cmd('via.demolir', { arestas: [ref] }).codigo, 'rodovia');
    assert.equal(sim.cmd('via.melhorar', { arestas: [ref], tipo: 'avenida' }).codigo, 'rodovia');
  }
  // desfazer a obra e a demolição traz a rodovia como estava
  assert.ok(sim.cmd('via.desfazer', { sessao: 1 }).ok);
  limpo(sim);
});

test('desfazer a ligação refaz a aresta original da rodovia', () => {
  const sim = novaSim();
  const n0 = vivasRodovia(sim).length;
  const h0 = sim.hash();
  assert.ok(via(sim, 'avenida', T_MEIO).r?.ok);
  assert.ok(sim.cmd('via.desfazer', { sessao: 1 }).ok);
  assert.equal(vivasRodovia(sim).length, n0);
  limpo(sim);
  void h0;
});

test('save e hash ida e volta, determinismo, redes e trânsito seguem com a rodovia dividida', () => {
  const jogar = (sim) => {
    assert.ok(via(sim, 'avenida', T_MEIO).r?.ok);
    assert.ok(via(sim, 'rua', [[-90, -1105], [-90, -1205]]).r?.ok);
    sim.rodar(40, { sincrono: true });
  };
  const a = novaSim('rod-det');
  jogar(a);
  const b = novaSim('rod-det');
  jogar(b);
  assert.equal(a.hash(), b.hash(), 'determinístico');
  const c = novaSim('rod-det');
  aplicarSave(c, lerSave(montarSave(a)));
  assert.equal(c.hash(), a.hash(), 'save ida e volta');
  limpo(c);
  assert.deepEqual(c.validar(), []);
  c.rodar(40, { sincrono: true });
  assert.deepEqual(c.erros, []);
  assert.ok(c.q.camada('energia'), 'a camada de energia responde');
});
