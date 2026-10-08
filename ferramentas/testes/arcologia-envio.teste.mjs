// Envio dos materiais da Arcologia, automático ou manual por etapa (D109): o auto igual ao de antes, o manual que não
// pede sozinho, enviar parcial e total, as recusas sem efeito, trocar o modo no meio da obra, o save e o save antigo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { ETAPA } from '../../fonte/contratos/flags.js';
import { LISTA_COMANDOS } from '../../fonte/contratos/comandos.js';

const ok = (r) => assert.equal(r.ok, true, JSON.stringify(r));
const etapa = (sim, id) => sim.q.arcologia().partes.flatMap((p) => p.etapas).find((e) => e.id === id);
const mat = (sim, id, item) => etapa(sim, id).materiais.find((m) => m.item === item);
const estoque = (sim, item, n) => { sim.json.producao.estoque[item] = n; };
const roda = (sim, n) => sim.rodar(n, { sincrono: true });
const novo = (s) => criarSimulacao({ semente: s });

test('contrato: os três comandos existem e a consulta traz envio e os campos por item', () => {
  for (const c of ['arcologia.enviar', 'arcologia.enviarTudo', 'arcologia.envio']) assert.ok(LISTA_COMANDOS.includes(c), c);
  const sim = novo('env-contrato');
  const e = etapa(sim, 'lago.e1');
  assert.equal(e.envio, 'auto', 'padrão');
  assert.deepEqual(Object.keys(e.materiais[0]).filter((k) => ['precisa', 'pedido', 'entregue', 'falta', 'estoque'].includes(k)).sort(), ['entregue', 'estoque', 'falta', 'pedido', 'precisa']);
  assert.equal(e.materiais[0].falta, e.materiais[0].precisa);
});

test('auto: igual ao de antes, pede tudo o que cabe ao começar e o resto quando chega ao estoque', () => {
  const sim = novo('env-auto');
  estoque(sim, 'brita', 30);
  estoque(sim, 'areia', 50);
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  assert.equal(mat(sim, 'lago.e1', 'brita').pedido, 30);
  assert.equal(mat(sim, 'lago.e1', 'areia').pedido, 50);
  estoque(sim, 'brita', 20);
  roda(sim, 40);
  assert.equal(mat(sim, 'lago.e1', 'brita').pedido, 50, 'a rodada completa o que faltava');
  assert.equal(mat(sim, 'lago.e1', 'brita').falta, 0);
});

test('manual: não pede nada sozinho, nem ao começar nem na rodada; a obra espera', () => {
  const sim = novo('env-manual');
  ok(sim.cmd('arcologia.envio', { etapa: 'lago.e1', modo: 'manual' }));
  estoque(sim, 'brita', 100);
  estoque(sim, 'areia', 100);
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  roda(sim, 100);
  const e = etapa(sim, 'lago.e1');
  assert.equal(e.envio, 'manual');
  assert.ok(e.materiais.every((m) => m.pedido === 0 && m.entregue === 0));
  assert.equal(sim.holding.estoque('brita'), 100);
  assert.equal(e.progresso, 0);
  assert.equal(e.parada, 'material');
});

test('manual: enviar parcial, depois o resto; a obra anda só com o que chegou e termina', () => {
  const sim = novo('env-parcial');
  ok(sim.cmd('arcologia.envio', { etapa: 'lago.e1', modo: 'manual' }));
  estoque(sim, 'brita', 100);
  estoque(sim, 'areia', 100);
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  const r = sim.cmd('arcologia.enviar', { etapa: 'lago.e1', item: 'brita', n: 20 });
  ok(r);
  assert.equal(r.dados.falta, 30);
  assert.equal(sim.holding.estoque('brita'), 80);
  assert.equal(mat(sim, 'lago.e1', 'brita').pedido, 20);
  roda(sim, 400);
  assert.equal(mat(sim, 'lago.e1', 'brita').entregue, 20);
  assert.equal(etapa(sim, 'lago.e1').progresso, 0, 'falta areia: sem material para a fase');
  ok(sim.cmd('arcologia.enviar', { etapa: 'lago.e1', item: 'brita', n: 30 }));
  const t = sim.cmd('arcologia.enviarTudo', { etapa: 'lago.e1' });
  ok(t);
  assert.deepEqual(t.dados.enviado, { areia: 50 }, 'só o que ainda faltava');
  for (let k = 0; k < 200 && etapa(sim, 'lago.e1').estado !== ETAPA.PRONTA; k++) roda(sim, 20);
  assert.equal(etapa(sim, 'lago.e1').estado, ETAPA.PRONTA);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});

test('manual: enviarTudo manda o que couber (estoque curto) e recusa sem estoque', () => {
  const sim = novo('env-tudo');
  ok(sim.cmd('arcologia.envio', { etapa: 'lago.e1', modo: 'manual' }));
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  assert.equal(sim.cmd('arcologia.enviarTudo', { etapa: 'lago.e1' }).codigo, 'estoque');
  estoque(sim, 'brita', 10);
  const r = sim.cmd('arcologia.enviarTudo', { etapa: 'lago.e1' });
  ok(r);
  assert.deepEqual(r.dados.enviado, { brita: 10 });
  assert.equal(mat(sim, 'lago.e1', 'brita').falta, 40);
});

test('recusas sem efeito: valor, inexistente, nada, estoque e trancado', () => {
  const sim = novo('env-recusas');
  estoque(sim, 'brita', 100);
  ok(sim.cmd('arcologia.envio', { etapa: 'lago.e1', modo: 'manual' }));
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  const foto = () => JSON.stringify([sim.json.arcologia, sim.json.producao.estoque, sim.q.producao().frota.fila]);
  const antes = foto();
  const c = (a) => sim.cmd('arcologia.enviar', { etapa: 'lago.e1', item: 'brita', ...a }).codigo;
  assert.equal(c({ n: 0 }), 'valor');
  assert.equal(c({ n: -1 }), 'valor');
  assert.equal(c({ n: 1.5 }), 'valor');
  assert.equal(c({ n: '3' }), 'valor');
  assert.equal(c({ n: 51 }), 'valor', 'mais que o que falta');
  assert.equal(c({ etapa: 7, n: 1 }), 'valor');
  assert.equal(c({ etapa: 'nao.existe', n: 1 }), 'inexistente');
  assert.equal(c({ item: 'ouro', n: 1 }), 'inexistente');
  assert.equal(c({ item: 'concreto', n: 1 }), 'inexistente', 'a etapa não pede concreto');
  assert.equal(c({ item: 'areia', n: 5 }), 'estoque');
  assert.equal(c({ etapa: 'torre.e2', n: 1 }), 'trancado');
  assert.equal(sim.cmd('arcologia.enviarTudo', { etapa: 'torre.e2' }).codigo, 'trancado');
  assert.equal(sim.cmd('arcologia.enviarTudo', {}).codigo, 'valor');
  assert.equal(sim.cmd('arcologia.envio', { etapa: 'lago.e1', modo: 'outro' }).codigo, 'valor');
  assert.equal(sim.cmd('arcologia.envio', { etapa: 'nao.existe', modo: 'auto' }).codigo, 'inexistente');
  assert.equal(foto(), antes, 'nada mudou');
  ok(sim.cmd('arcologia.enviar', { etapa: 'lago.e1', item: 'brita', n: 50 }));
  assert.equal(c({ n: 1 }), 'nada', 'já foi tudo');
  estoque(sim, 'areia', 50);
  ok(sim.cmd('arcologia.enviarTudo', { etapa: 'lago.e1' }));
  assert.equal(sim.cmd('arcologia.enviarTudo', { etapa: 'lago.e1' }).codigo, 'nada');
});

test('etapa pronta recusa com nada', () => {
  const sim = novo('env-pronta');
  estoque(sim, 'brita', 50);
  estoque(sim, 'areia', 50);
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  for (let k = 0; k < 200 && etapa(sim, 'lago.e1').estado !== ETAPA.PRONTA; k++) roda(sim, 20);
  assert.equal(sim.cmd('arcologia.enviar', { etapa: 'lago.e1', item: 'brita', n: 1 }).codigo, 'nada');
  assert.equal(sim.cmd('arcologia.enviarTudo', { etapa: 'lago.e1' }).codigo, 'nada');
});

test('trocar o modo no meio da obra: manual para de pedir; auto volta a pedir o que falta, na hora', () => {
  const sim = novo('env-troca');
  estoque(sim, 'brita', 20);
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  assert.equal(mat(sim, 'lago.e1', 'brita').pedido, 20);
  ok(sim.cmd('arcologia.envio', { etapa: 'lago.e1', modo: 'manual' }));
  estoque(sim, 'brita', 30);
  estoque(sim, 'areia', 50);
  roda(sim, 60);
  assert.equal(mat(sim, 'lago.e1', 'brita').pedido, 20, 'manual: nada novo');
  assert.equal(mat(sim, 'lago.e1', 'areia').pedido, 0);
  ok(sim.cmd('arcologia.envio', { etapa: 'lago.e1', modo: 'auto' }));
  assert.equal(mat(sim, 'lago.e1', 'brita').pedido, 50, 'auto pede o que falta na hora');
  assert.equal(mat(sim, 'lago.e1', 'areia').pedido, 50);
  assert.equal(etapa(sim, 'lago.e1').envio, 'auto');
  assert.deepEqual(sim.validar(), []);
});

test('o modo é por etapa', () => {
  const sim = novo('env-por-etapa');
  ok(sim.cmd('arcologia.envio', { etapa: 'lago.e1', modo: 'manual' }));
  assert.equal(etapa(sim, 'lago.e1').envio, 'manual');
  assert.equal(etapa(sim, 'torre.e1').envio, 'auto');
});

test('save ida e volta no meio da obra, em manual: mesmo hash e mesmo fim', () => {
  const A = novo('env-save');
  ok(A.cmd('arcologia.envio', { etapa: 'lago.e1', modo: 'manual' }));
  estoque(A, 'brita', 50);
  estoque(A, 'areia', 50);
  ok(A.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  ok(A.cmd('arcologia.enviar', { etapa: 'lago.e1', item: 'brita', n: 50 }));
  roda(A, 30);
  const C = novo('env-save');
  aplicarSave(C, migrar(lerSave(montarSave(A))));
  assert.equal(C.q.hash(), A.q.hash());
  assert.equal(etapa(C, 'lago.e1').envio, 'manual');
  assert.equal(mat(C, 'lago.e1', 'brita').pedido, 50);
  for (const s of [A, C]) {
    ok(s.cmd('arcologia.enviar', { etapa: 'lago.e1', item: 'areia', n: 50 }));
    for (let k = 0; k < 200 && etapa(s, 'lago.e1').estado !== ETAPA.PRONTA; k++) roda(s, 20);
  }
  assert.equal(C.tique, A.tique);
  assert.equal(C.q.hash(), A.q.hash());
  assert.deepEqual(C.erros, []);
});

test('migração silenciosa: save sem o campo envio carrega como auto e segue pedindo sozinho', () => {
  const A = novo('env-velho');
  estoque(A, 'brita', 50);
  estoque(A, 'areia', 50);
  ok(A.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  roda(A, 10);
  for (const e of Object.values(A.json.arcologia.etapas)) delete e.envio; // como um save de antes da D109
  const C = novo('env-velho');
  aplicarSave(C, migrar(lerSave(montarSave(A))));
  assert.equal(C.json.arcologia.etapas['lago.e1'].envio, 'auto');
  assert.equal(etapa(C, 'torre.e1').envio, 'auto');
  assert.deepEqual(C.validar(), []);
  estoque(C, 'brita', 5);
  C.json.arcologia.etapas['lago.e1'].pedido.brita = 45;
  roda(C, 40);
  assert.equal(mat(C, 'lago.e1', 'brita').pedido, 50, 'o auto do save antigo continua');
});
