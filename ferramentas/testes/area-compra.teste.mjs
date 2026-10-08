// Testes da compra de área inteira (D107): area.comprar e q.area.compra na simulação (preço igual à soma sequencial
// do D3, uma licença só, recusas sem efeito, Influência, Modo livre, save de ida e volta, evento por ladrilho) e a
// interface pura (toque dentro do contorno, ladrilho da área fora dele, critérios, barra, textos).
// Roda sozinho: node ferramentas/testes/area-compra.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { LADRILHO } from '../../fonte/contratos/flags.js';
import { montarSave, lerSave, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { concederLicencas, ladrilhosDoContorno, PRECO_BASE } from '../../fonte/sim/mundo/ladrilhos.js';
import { AREAS_COMPRAVEIS } from '../../fonte/data/areas-compraveis.js';
import * as areas from '../../fonte/ui/ferramentas/areas.js';
import { t, temTexto, chavesRepetidas } from '../../fonte/ui/textos.js';

const novo = (semente = 'area-compra', op = {}) => criarSimulacao({ semente, ...op });
const dinheiro = (sim, v) => sim.holding.receber(v, 'teste');
const zerar = (sim) => sim.holding.pagar(sim.holding.caixa(), 'teste');
const posse = (sim) => sim.espelho.ladrilhos.estado.slice();

test('consulta: faltam os ladrilhos que o contorno toca, em ordem de adjacência, e o preço é a soma sequencial (D3)', () => {
  const sim = novo();
  assert.deepEqual(AREAS_COMPRAVEIS, ['varzea']);
  const c = sim.q.area.compra({ id: 'varzea' });
  assert.equal(c.ok, true);
  assert.ok(c.ladrilhos.length >= 12, 'a Várzea toca vários ladrilhos fora da área inicial');
  const L = sim.espelho.ladrilhos;
  const area = sim.espelho.areas.find((a) => a.id === 'varzea');
  const tocados = ladrilhosDoContorno(area.contorno);
  const faltam = tocados.filter(({ i, j }) => L.estado[j * 16 + i] !== LADRILHO.HOLDING);
  assert.equal(c.ladrilhos.length, faltam.length);
  // ordem: cada um encosta na Holding ou num anterior
  const dono = new Set();
  for (let k = 0; k < 256; k++) if (L.estado[k] === LADRILHO.HOLDING) dono.add(k);
  for (const { i, j } of c.ladrilhos) {
    const viz = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => dono.has((j + b) * 16 + i + a));
    assert.ok(viz, `(${i}, ${j}) encosta`);
    dono.add(j * 16 + i);
  }
  let soma = 0;
  for (let k = 0; k < c.ladrilhos.length; k++) soma += Math.round(PRECO_BASE * (1 + 0.15 * k));
  assert.equal(c.preco, soma);
  assert.deepEqual(c.criterios.map((x) => x.id), ['vizinho', 'licenca', 'creditos']);
  assert.equal(c.criterios[0].ok, true);
  assert.equal(c.criterios[1].ok, false, 'sem licença');
  assert.equal(c.pode, false);
  assert.equal(c.codigo, 'licenca');
  for (const x of c.criterios) assert.ok(temTexto(x.chave), x.chave);
  // áreas fora da lista e ids soltos
  assert.equal(sim.q.area.compra({ id: 'vila' }).codigo, 'inexistente');
  assert.equal(sim.q.area.compra({ id: 'nada' }).ok, false);
});

test('comprar: tudo de uma vez, uma licença, um pagamento igual à soma, histórico e comprados como compras normais', () => {
  const sim = novo();
  const c = sim.q.area.compra({ id: 'varzea' });
  const n = c.ladrilhos.length;
  concederLicencas(sim, 2);
  dinheiro(sim, 10000000);
  const caixa = sim.holding.caixa();
  const eventos = [];
  sim.on('ladrilho', (d) => eventos.push(d));
  const r = sim.cmd('area.comprar', { id: 'varzea' });
  assert.equal(r.ok, true);
  assert.equal(r.dados.valor, c.preco);
  assert.equal(r.dados.n, n);
  assert.equal(caixa - sim.holding.caixa(), c.preco);
  const q = sim.q.ladrilhos();
  assert.equal(q.licencas, 1, 'consome UMA licença');
  assert.equal(q.comprados, n);
  const H = sim.json.ladrilhos.historico;
  assert.equal(H.length, n);
  assert.deepEqual(H.map(({ i, j }) => ({ i, j })), c.ladrilhos);
  assert.equal(H.reduce((a, x) => a + x.valor, 0), c.preco);
  assert.deepEqual(eventos, c.ladrilhos);
  for (const { i, j } of c.ladrilhos) assert.equal(sim.espelho.ladrilhos.estado[j * 16 + i], LADRILHO.HOLDING);
  // nada mais a comprar; o próximo ladrilho avulso custa pela conta cheia
  const depois = sim.q.area.compra({ id: 'varzea' });
  assert.equal(depois.ladrilhos.length, 0);
  assert.equal(depois.codigo, 'comprado');
  assert.equal(sim.cmd('area.comprar', { id: 'varzea' }).codigo, 'comprado');
  assert.equal(sim.q.ladrilhos().proximo, Math.round(PRECO_BASE * (1 + 0.15 * n)));
  assert.equal(sim.q.ladrilhos().licencas, 1, 'a recusa não gasta licença');
});

test('a soma por área é a mesma de comprar um a um, na mesma ordem', () => {
  const a = novo('um-a-um');
  const b = novo('um-a-um');
  const c = a.q.area.compra({ id: 'varzea' });
  concederLicencas(a, 50);
  dinheiro(a, 50000000);
  dinheiro(b, 50000000);
  concederLicencas(b, 1);
  const antesA = a.holding.caixa();
  const antesB = b.holding.caixa();
  for (const { i, j } of c.ladrilhos) {
    concederLicencas(a, 0);
    assert.equal(a.cmd('ladrilho.comprar', { i, j }).ok, true);
  }
  assert.equal(b.cmd('area.comprar', { id: 'varzea' }).ok, true);
  assert.equal(antesA - a.holding.caixa(), antesB - b.holding.caixa());
  assert.deepEqual(posse(a), posse(b));
  assert.equal(a.json.ladrilhos.comprados, b.json.ladrilhos.comprados);
});

test('recusas sem efeito: licença, créditos, id desconhecido, área da lista fechada', () => {
  const sim = novo();
  const c = sim.q.area.compra({ id: 'varzea' });
  const p0 = posse(sim);
  assert.equal(sim.cmd('area.comprar', { id: 'varzea' }).codigo, 'licenca');
  concederLicencas(sim, 1);
  zerar(sim);
  const J = () => JSON.stringify([sim.json.ladrilhos, sim.holding.caixa()]);
  const j1 = J();
  const r = sim.cmd('area.comprar', { id: 'varzea' });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'creditos');
  const q = sim.q.area.compra({ id: 'varzea' });
  assert.equal(q.criterios.find((x) => x.id === 'creditos').ok, false);
  assert.equal(q.criterios.find((x) => x.id === 'creditos').dados.preco, c.preco);
  assert.equal(J(), j1, 'a recusa por créditos não muda nada (nem a licença nem o caixa)');
  assert.deepEqual(posse(sim), p0);
  assert.equal(sim.q.ladrilhos().licencas, 1);
  assert.equal(sim.cmd('area.comprar', { id: 'orla' }).codigo, 'inexistente');
  assert.equal(sim.cmd('area.comprar', { id: 'vila' }).codigo, 'inexistente');
  assert.equal(sim.cmd('area.comprar', {}).codigo, 'inexistente');
  assert.equal(J(), j1);
  // créditos de um tostão a menos
  dinheiro(sim, c.preco - 1);
  assert.equal(sim.cmd('area.comprar', { id: 'varzea' }).codigo, 'creditos');
  dinheiro(sim, 1);
  assert.equal(sim.cmd('area.comprar', { id: 'varzea' }).ok, true);
});

test('Influência entra no preço de cada ladrilho; Modo livre não pede licença nem paga', () => {
  const sim = novo('area-influencia');
  sim.registrarConsulta('holding', () => ({ influencia: 50 }));
  const c = sim.q.area.compra({ id: 'varzea' });
  let soma = 0;
  for (let k = 0; k < c.ladrilhos.length; k++) soma += Math.round(PRECO_BASE * (1 + 0.15 * k) * 0.9);
  assert.equal(c.preco, soma);
  const livre = novo('area-livre', { modo: 'livre' });
  const l = livre.q.area.compra({ id: 'varzea' });
  assert.equal(l.criterios.find((x) => x.id === 'licenca').ok, true);
  assert.equal(l.preco, 0);
  assert.equal(l.pode, true);
  const caixa = livre.holding.caixa();
  assert.equal(livre.cmd('area.comprar', { id: 'varzea' }).ok, true);
  assert.equal(livre.holding.caixa(), caixa);
  assert.equal(livre.q.ladrilhos().licencas, 0);
  assert.equal(livre.q.ladrilhos().comprados, l.ladrilhos.length);
});

test('save de ida e volta: posse, licenças e histórico; o hash bate e dá para continuar', () => {
  const sim = novo('area-save');
  concederLicencas(sim, 2);
  dinheiro(sim, 10000000);
  assert.equal(sim.cmd('area.comprar', { id: 'varzea' }).ok, true);
  const nova = novo('area-save');
  aplicarSave(nova, lerSave(montarSave(sim)));
  assert.deepEqual(posse(nova), posse(sim));
  assert.equal(nova.q.ladrilhos().licencas, 1);
  assert.equal(nova.q.ladrilhos().comprados, sim.q.ladrilhos().comprados);
  assert.deepEqual(nova.json.ladrilhos.historico, sim.json.ladrilhos.historico);
  assert.equal(nova.hash(), sim.hash());
  assert.equal(nova.q.area.compra({ id: 'varzea' }).ladrilhos.length, 0);
  // a mesma sequência dá o mesmo hash (determinismo)
  const outra = novo('area-save');
  concederLicencas(outra, 2);
  dinheiro(outra, 10000000);
  outra.cmd('area.comprar', { id: 'varzea' });
  assert.equal(outra.hash(), sim.hash());
});

// ------------------------------------------------------------------------------------------------ interface pura

const COMPRA = {
  ok: true, codigo: 'licenca', id: 'varzea', nome: 'Várzea do Held', preco: 1000000,
  ladrilhos: [{ i: 5, j: 7 }, { i: 4, j: 7 }],
  criterios: [
    { id: 'vizinho', ok: true, chave: 'area.criterio.vizinho', dados: null },
    { id: 'licenca', ok: false, chave: 'area.criterio.licenca', dados: { tem: 0 } },
    { id: 'creditos', ok: false, chave: 'area.criterio.creditos', dados: { preco: 1000000, caixa: 400000 } },
  ],
  pode: false,
};

test('UI: toque dentro do contorno escolhe a área; no ladrilho dela fora do contorno oferece os dois; cancelar limpa', () => {
  const quadrado = Float64Array.from([-2000, -500, -1500, -500, -1500, 500, -2000, 500]);
  const lista = [{ id: 'varzea', contorno: quadrado, faltam: [{ i: 4, j: 7 }, { i: 3, j: 7 }] }];
  const ponto = (x, z) => ({ tipo: 'fim', ponto: [x, z] });
  let e = areas.passoAreas(areas.criarAreas(), ponto(-1700, 0), { areas: lista });
  assert.equal(e.area, 'varzea');
  assert.equal(e.modo, 'area');
  assert.deepEqual(e.sel, areas.ladrilhoDoPonto(-1700, 0));
  // troca para o ladrilho só
  e = areas.passoAreas(e, { tipo: 'modo', modo: 'ladrilho' }, { areas: lista });
  assert.equal(e.modo, 'ladrilho');
  assert.equal(e.area, 'varzea');
  // ladrilho (4, 7) é x -2048..-1536, z -512..0: ponto fora do contorno (z -510) mas num ladrilho que falta
  e = areas.passoAreas(areas.criarAreas(), ponto(-1600, -510), { areas: lista });
  assert.equal(e.area, 'varzea');
  assert.equal(e.modo, 'ladrilho');
  // fora de tudo: comportamento antigo de ladrilho
  e = areas.passoAreas(areas.criarAreas(), ponto(500, 500), { areas: lista });
  assert.equal(e.area, null);
  assert.equal(areas.passoAreas(e, { tipo: 'modo', modo: 'area' }, { areas: lista }).modo, 'ladrilho', 'sem área não há modo área');
  // tocar de novo no mesmo lugar desmarca; cancelar limpa e depois sai
  let f = areas.passoAreas(areas.criarAreas(), ponto(-1700, 0), { areas: lista });
  f = areas.passoAreas(f, ponto(-1700, 0), { areas: lista });
  assert.equal(f.sel, null);
  assert.equal(f.area, null);
  f = areas.passoAreas(areas.criarAreas(), ponto(-1700, 0), { areas: lista });
  f = areas.passoAreas(f, { tipo: 'cancelar' });
  assert.equal(f.area, null);
  assert.deepEqual(areas.passoAreas(f, { tipo: 'cancelar' }).efeitos, ['sair']);
  // área sem nada a comprar não é oferecida
  const vazia = [{ ...lista[0], faltam: [] }];
  assert.equal(areas.passoAreas(areas.criarAreas(), ponto(-1700, 0), { areas: vazia }).area, null);
});

test('UI: infoArea, critérios com o motivo, o que falta e o rótulo do botão', () => {
  assert.equal(areas.infoArea(null), null);
  assert.equal(areas.infoArea({ ...COMPRA, ladrilhos: [] }), null);
  const a = areas.infoArea(COMPRA);
  assert.equal(a.faltam, 2);
  assert.equal(a.pode, false);
  assert.equal(a.falha, 'licenca');
  assert.equal(a.falta, 600000);
  assert.match(areas.faltaDaArea(a), /licença de ladrilho/);
  assert.match(areas.faltaDaArea({ ...a, falha: 'creditos' }), /Faltam .* em créditos/);
  assert.match(areas.faltaDaArea({ ...a, falha: 'vizinho' }), /encostar/);
  assert.equal(areas.faltaDaArea(areas.infoArea({ ...COMPRA, pode: true, criterios: COMPRA.criterios.map((c) => ({ ...c, ok: true })) })), '');
  const s = { tipo: 'areas', maquina: { modo: 'area' }, areaInfo: a, info: null, valido: false };
  const [titulo, resumo, falta] = areas.linhasArea(s);
  assert.equal(titulo, 'Várzea do Held');
  assert.match(resumo, /faltam 2 ladrilhos/);
  assert.ok(falta);
  assert.equal(areas.rotuloArea(s), 'Comprar Várzea do Held');
  assert.equal(areas.rotuloArea({ ...s, maquina: { modo: 'ladrilho' } }), t('x2.comprar'));
  assert.match(t('area.comprada', { nome: 'Várzea do Held', n: 12 }), /12 ladrilhos/);
  assert.deepEqual(chavesRepetidas(), []);
});

test('UI: os textos da parcela não têm travessão', () => {
  for (const k of ['area.criterio.vizinho', 'area.criterio.licenca', 'area.criterio.licencaLivre', 'area.criterio.creditos', 'area.falta.vizinho', 'area.falta.licenca', 'area.falta.creditos', 'area.comprar', 'area.comprada', 'area.comprada1', 'area.modo.area', 'area.modo.ladrilho', 'area.faltam', 'area.faltam1', 'area.preco']) {
    assert.ok(temTexto(k), k);
    assert.ok(!/[–—]/.test(t(k)), k);
  }
});
