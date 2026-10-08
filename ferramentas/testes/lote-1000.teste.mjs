// Lote digitado de 1 a 1000 (D110, pedido do dono em 08/10/2026): a regra, o código 'lote', o tempo t x 0,8 x n, o
// insumo do lote cheio, o armazém que não comporta, o save de ida e volta e o clamp puro do campo da interface.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGRAS_DONO, loteValido, tempoDoLote } from '../../fonte/data/economia.js';
import { ITENS } from '../../fonte/data/holding.js';
import { MARCOS } from '../../fonte/data/marcos.js';
import { porEstoque } from '../../fonte/sim/holding/producao.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { simS3a, predioHolding, fixarCidade } from '../robo/cidade-faz-de-conta.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function cidade(semente, armazens = 2) {
  const sim = simS3a({ semente, populacao: 4000, bemEstar: 50 });
  for (let k = 0; k < armazens; k++) predioHolding(sim, 'escritorioObra', k * 300, 0);
  const ped = predioHolding(sim, 'pedreira', 200, 300);
  sim.rodar(20, { sincrono: true });
  return { sim, ped };
}
const linha0 = (sim) => sim.json.producao.predios.find((e) => e.tipo === 'pedreira').linhas[0];

test('regra: lote de 1 a 1000, padrão 10, tempo t x max(1, 0,8 x n)', () => {
  assert.deepEqual(REGRAS_DONO.lote, { min: 1, max: 1000, padrao: 10, fatorTempo: 0.8 });
  assert.deepEqual([1, 10, 999, 1000].map(loteValido), [true, true, true, true]);
  assert.deepEqual([0, 1001, 1.5, -1, '10', NaN, 1e9].map(loteValido), [false, false, false, false, false, false, false]);
  assert.equal(tempoDoLote(30, 1000), 30 * 0.8 * 1000);
  assert.equal(tempoDoLote(30, 1), 30);
  assert.equal(tempoDoLote(30, 10), 8 * 30);
});

test('linha.ordem: 1000 aceito; 1001, 0 e 1.5 recusados com lote; a meta é t x 0,8 x 1000', () => {
  const { sim, ped } = cidade('lote1000');
  sim.cmd('linha.parar', { predio: ped, linha: 0 });
  const ord = (n) => sim.cmd('linha.ordem', { predio: ped, linha: 0, item: 'brita', n, auto: false });
  for (const n of [1001, 0, 1.5, -3, 1e6]) assert.equal(ord(n).codigo, 'lote', `n=${n}`);
  assert.equal(ord(1000).ok, true);
  sim.rodar(5, { sincrono: true });
  const l = linha0(sim);
  assert.equal(l.rodando, true);
  assert.equal(l.nLote, 1000);
  assert.equal(l.meta, ITENS.brita.t * 0.8 * 1000);
  assert.equal(sim.json.producao.predios.find((e) => e.tipo === 'pedreira').linhas[0].n, 1000);
});

test('armazém: lote maior que a capacidade recusa com lote; com Auto que passou a não caber, para sem gastar', () => {
  const { sim, ped } = cidade('loteArm', 1); // um Escritório de Obra: 600
  assert.equal(sim.json.producao.cap, 600);
  sim.cmd('linha.parar', { predio: ped, linha: 0 });
  assert.equal(sim.cmd('linha.ordem', { predio: ped, linha: 0, item: 'brita', n: 601, auto: false }).codigo, 'lote');
  assert.equal(sim.cmd('linha.ordem', { predio: ped, linha: 0, item: 'brita', n: 600, auto: false }).ok, true);
  sim.cmd('linha.parar', { predio: ped, linha: 0 });
  // a frase do código explica as duas razões
});

test('insumos e estoque: o lote cheio consome n vezes e a falta recusa com estoque', () => {
  const { sim } = cidade('loteInsumo');
  const lim = MARCOS.map((m) => m.xp);
  sim.progresso.xp(Math.max(0, lim[3] - sim.json.progresso.xp), 'teste');
  sim.rodar(20, { sincrono: true });
  const con = predioHolding(sim, 'concreteira', -300, 300);
  sim.rodar(5, { sincrono: true });
  sim.cmd('linha.parar', { predio: con, linha: 0 });
  const ord = (n) => sim.cmd('linha.ordem', { predio: con, linha: 0, item: 'concreto', n, auto: false });
  assert.equal(ord(1000).codigo, 'estoque');
  porEstoque(sim, 'cimento', 1000);
  porEstoque(sim, 'brita', 2000);
  porEstoque(sim, 'areia', 999);
  assert.equal(ord(1000).codigo, 'estoque', 'falta 1 de areia');
  porEstoque(sim, 'areia', 1);
  assert.equal(ord(1000).ok, true);
  sim.rodar(5, { sincrono: true });
  const e = sim.json.producao.estoque;
  assert.deepEqual([e.cimento, e.brita, e.areia], [0, 0, 0]);
  assert.equal(sim.json.producao.predios.find((x) => x.tipo === 'concreteira').linhas[0].meta, ITENS.concreto.t * 0.8 * 1000);
  // parar devolve os insumos do lote inteiro
  sim.cmd('linha.parar', { predio: con, linha: 0 });
  assert.deepEqual([e.cimento, e.brita, e.areia], [1000, 2000, 1000]);
});

test('save: a linha de lote 1000 em andamento volta igual e o hash segue igual', () => {
  const { sim, ped } = cidade('loteSave');
  sim.cmd('linha.parar', { predio: ped, linha: 0 });
  assert.equal(sim.cmd('linha.ordem', { predio: ped, linha: 0, item: 'brita', n: 1000, auto: true }).ok, true);
  sim.rodar(30, { sincrono: true });
  const nova = simS3a({ semente: 'loteSave' });
  fixarCidade(nova, { populacao: 4000, bemEstar: 50 });
  aplicarSave(nova, migrar(lerSave(montarSave(sim))));
  const a = linha0(sim);
  const b = linha0(nova);
  assert.equal(b.n, 1000);
  assert.equal(b.auto, true);
  assert.equal(b.nLote, 1000);
  assert.equal(b.meta, a.meta);
  assert.equal(b.trabalho, a.trabalho);
  assert.equal(nova.q.hash(), sim.q.hash());
  sim.rodar(200, { sincrono: true });
  nova.rodar(200, { sincrono: true });
  assert.equal(nova.q.hash(), sim.q.hash());
});

test('interface: o campo do lote prende em 1..1000 e só aceita dígitos; o padrão sugerido é 10', async () => {
  const { build } = await import('esbuild');
  const r = await build({
    stdin: { contents: `export * from ${JSON.stringify(resolve(RAIZ, 'fonte/ui/comp/LoteCampo.jsx'))};`, resolveDir: RAIZ, loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic', jsxImportSource: 'preact', loader: { '.jsx': 'jsx' },
    nodePaths: [resolve(RAIZ, 'node_modules')],
  });
  const { limitarLote, digitarLote, LOTE_PADRAO, LOTES_RAPIDOS } = await import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
  assert.deepEqual([0, -5, 1, 7.9, 1000, 1001, 99999, NaN, '', 'abc', '250'].map((n) => limitarLote(n)), [1, 1, 1, 7, 1000, 1000, 1000, 1, 1, 1, 250]);
  assert.deepEqual(['', 'a1b0', '0007', '12345', '-3', '1.5', '１２'].map((s) => digitarLote(s)), ['', '10', '7', '1000', '3', '15', '']);
  assert.equal(LOTE_PADRAO, 10);
  assert.deepEqual([...LOTES_RAPIDOS], [1, 10, 100, 1000]);
});
