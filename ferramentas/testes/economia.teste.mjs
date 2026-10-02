// Economia (dona: S3a): a ordem de pagamento e o caixa zerado da D41, o orçamento por hora de jogo, a contribuição
// por prédio (proposta da pergunta 3), a série mensal, a barra, as consultas puras e o save de ida e volta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGRAS_DONO } from '../../fonte/data/economia.js';
import { contribuicaoHora } from '../../fonte/sim/economia.js';
import { porEstoque } from '../../fonte/sim/holding/producao.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { simS3a, predioHolding, fixarCidade } from '../robo/cidade-faz-de-conta.mjs';

test('D41: paga manutenção, depois salários; o que falta não vira dívida e o caixa nunca fica negativo', () => {
  const sim = simS3a({ semente: 'd41', populacao: 600, bemEstar: 50 });
  predioHolding(sim, 'escritorioObra', 0, 0);
  const ped = predioHolding(sim, 'pedreira', 200, 0);
  const eventos = [];
  sim.on('caixaZerado', (d) => eventos.push(d.sim));
  // custos de 10 mil por hora e uma contribuição de 600 x 8 = 4.800 por hora
  sim.custos.registrar('servicos.teste', () => 10000);
  sim.custos.registrar('vias', () => 2000);
  sim.holding.pagar(sim.holding.caixa() - 50, 'teste');
  sim.rodar(200, { sincrono: true });
  assert.ok(sim.holding.caixa() >= 0 && sim.holding.caixa() < 1, `caixa ${sim.holding.caixa()}`);
  const efic = sim.economia.eficiencia();
  assert.ok(efic > 0.3 && efic < 0.45, `eficiência ${efic} (4.800 / 12.000)`);
  const o = sim.q.orcamento();
  assert.ok(o.naoPago.servicos > 0);
  assert.ok(o.naoPago.salarios > 0, 'os salários ficam sem pagar quando a manutenção leva tudo');
  assert.equal(o.caixaZerado, true);
  assert.deepEqual(eventos, [true]);
  assert.equal(sim.q.emprestimo().divida, 0, 'o que não se paga não vira dívida');
  // linhas da Holding param sem o salário
  const l = sim.q.producao().predios.find((p) => p.ref === ped).linhas[0];
  assert.equal(l.parada, 'creditos');
  // a barra mostra o alerta grave
  const b = sim.q.barra();
  assert.equal(b.caixaZerado, true);
  assert.equal(b.alertas[0].codigo, 'caixaZerado');
  assert.equal(b.alertas[0].gravidade, 'grave');
  // um empréstimo tira do zero
  assert.equal(sim.cmd('emprestimo.tomar', { valor: 50000 }).ok, true);
  sim.rodar(40, { sincrono: true });
  assert.equal(sim.q.orcamento().caixaZerado, false);
  assert.deepEqual(eventos, [true, false]);
  assert.equal(sim.economia.eficiencia(), 1);
  assert.deepEqual(sim.validar(), []);
});

test('aviso antes de zerar: saldo negativo com menos de 15 min de caixa', () => {
  const sim = simS3a({ semente: 'aviso', populacao: 100, bemEstar: 50 });
  sim.custos.registrar('servicos.teste', () => 40000);
  sim.holding.pagar(sim.holding.caixa() - 5000, 'teste');
  sim.rodar(20, { sincrono: true });
  const a = sim.q.barra().alertas.find((x) => x.id === 'caixa');
  assert.equal(a?.codigo, 'caixaVaiZerar');
  assert.equal(a.gravidade, 'atencao');
  assert.ok(a.params.minutos >= 1 && a.params.minutos <= 15);
});

test('orçamento: formato da seção 2.6, saldo = receitas − despesas, vendas da última hora', () => {
  const sim = simS3a({ semente: 'orcamento', populacao: 2000, bemEstar: 64 });
  sim.custos.registrar('vias', () => 360);
  sim.custos.registrar('servicos.clinica', () => 700);
  sim.custos.registrar('ligacao.energia', () => 1200);
  porEstoque(sim, 'brita', 40);
  sim.rodar(20, { sincrono: true });
  sim.cmd('deposito.vender', { item: 'brita', n: 10 });
  const o = sim.q.orcamento();
  assert.deepEqual(Object.keys(o.receitas).sort(), ['cidade', 'deposito', 'marcos', 'moradores']);
  assert.deepEqual(Object.keys(o.despesas).sort(), ['importacao', 'importacaoCidade', 'juros', 'ligacao', 'salarios', 'servicos', 'vias']);
  assert.deepEqual(Object.keys(o.naoPago).sort(), ['salarios', 'servicos']);
  assert.equal(o.receitas.moradores, 2000 * 11);
  assert.equal(o.receitas.deposito, 10 * 20 * 1.5);
  assert.deepEqual([o.despesas.vias, o.despesas.servicos, o.despesas.ligacao], [360, 700, 1200]);
  const soma = (x) => Object.values(x).reduce((a, v) => a + v, 0);
  assert.ok(Math.abs(o.saldoHora - (soma(o.receitas) - soma(o.despesas))) < 1e-9);
  assert.equal(sim.q.barra().saldoHora, o.saldoHora);
  // a venda sai da janela de 1 hora
  sim.rodar(3700, { sincrono: true });
  assert.equal(sim.q.orcamento().receitas.deposito, 0);
  assert.equal(sim.q.orcamento().totais.receitas.deposito, 300);
});

test("contribuição por prédio (tarifaPor 'predio', pergunta 3): cada prédio paga pela sua faixa", () => {
  const regras = { ...REGRAS_DONO, renda: { ...REGRAS_DONO.renda, tarifaPor: 'predio' } };
  const predios = [[100, 30.4], [100, 30.5], [100, 60.4], [100, 60.5]];
  assert.equal(contribuicaoHora(regras, { populacao: 400, bemEstarTarifa: 45 }, predios), 100 * (5 + 8 + 8 + 11));
  assert.equal(contribuicaoHora(REGRAS_DONO, { populacao: 400, bemEstarTarifa: 45 }, predios), 400 * 8);
  // sem a coluna de bem-estar por prédio, a conta é a da cidade
  assert.equal(contribuicaoHora(regras, { populacao: 400, bemEstarTarifa: 61 }, null), 400 * 11);
  assert.equal(contribuicaoHora(REGRAS_DONO, { populacao: 0, bemEstarTarifa: 80 }), 0);
});

test('série mensal: um ponto por mês com data, caixa, receitas, moradores e dívida; até 240', () => {
  const sim = simS3a({ semente: 'serie', populacao: 500, bemEstar: 55 });
  sim.rodar(1200, { sincrono: true });
  const s = sim.q.orcamento().serie;
  assert.equal(s.length, 2);
  assert.deepEqual(Object.keys(s[0]).sort(), ['ano', 'bemEstar', 'caixa', 'desemprego', 'despesas', 'divida', 'investimentos', 'mes', 'moradores', 'receitas']);
  assert.deepEqual([s[0].ano, s[0].mes, s[1].mes], [2020, 1, 2]);
  assert.ok(Math.abs(s[0].receitas - (500 * 8 * 600) / 3600) < 1e-6);
  assert.equal(s[0].moradores, 500);
});

test('consultas são puras e o save de ida e volta dá o mesmo hash, seguindo igual', () => {
  const sim = simS3a({ semente: 'save', populacao: 900, bemEstar: 58 });
  predioHolding(sim, 'escritorioObra', 0, 0);
  const ped = predioHolding(sim, 'pedreira', 200, 0);
  sim.cmd('emprestimo.tomar', { valor: 30000 });
  sim.rodar(777, { sincrono: true });
  sim.cmd('acelerar', { alvo: { predio: ped, linha: 0 }, minutos: 1 });
  const h = sim.q.hash();
  for (const q of ['barra', 'orcamento', 'emprestimo', 'deposito', 'producao', 'holding', 'marcos', 'objetivos', 'retomar', 'decisoes']) sim.q[q]();
  sim.q.mural({ desde: 0 });
  sim.q.decisoes({ historico: true });
  assert.equal(sim.q.hash(), h, 'consultas não mudam o estado');
  const nova = simS3a({ semente: 'save' });
  fixarCidade(nova, { populacao: 900, bemEstar: 58 });
  aplicarSave(nova, migrar(lerSave(montarSave(sim))));
  assert.equal(nova.q.hash(), h);
  sim.rodar(900, { sincrono: true });
  nova.rodar(900, { sincrono: true });
  assert.equal(nova.q.hash(), sim.q.hash());
  assert.deepEqual(nova.q.orcamento(), sim.q.orcamento());
  assert.deepEqual(nova.validar(), []);
});

test('q.holding: Influência e Legado com o efeito escrito (D55), valuation e o conselho', () => {
  const sim = simS3a({ semente: 'holding' });
  sim.economia.somarMedidor('influencia', 50, 'teste');
  sim.economia.somarMedidor('legado', 140, 'teste');
  const h = sim.q.holding();
  assert.equal(h.influencia, 50);
  assert.equal(h.legado, 100, 'Legado vai até 100');
  assert.equal(h.efeitos.descontoLadrilho, 0.1);
  assert.equal(h.efeitos.atratividade, 5);
  assert.equal(h.jogador, 'Diogo Holanda');
  assert.equal(h.conselheiros.length, 6);
  assert.equal(h.conselheiros.find((c) => c.id === 'livia').nome, 'Lívia Andrade');
  assert.equal(h.valuation, sim.holding.caixa());
  porEstoque(sim, 'concreto', 10);
  assert.equal(sim.q.holding().valuation, sim.holding.caixa() + 1700);
  sim.cmd('emprestimo.tomar', { valor: 10000 });
  assert.equal(sim.q.barra().valuation, sim.holding.caixa() + 1700 - 10000);
});

test('revisão: os juros viram dívida e não saem do caixa, então não disparam "o caixa zera em"', () => {
  const sim = simS3a({ semente: 'juros-aviso', populacao: 100, bemEstar: 50 });
  // contribuição de 800/h (100 moradores a 8), custos de 400/h: o caixa cresce; os juros de 50 mil são 2.500/h de dívida
  sim.custos.registrar('servicos.teste', () => 400);
  assert.equal(sim.cmd('emprestimo.tomar', { valor: 50000 }).ok, true);
  sim.holding.pagar(sim.holding.caixa() - 300, 'teste');
  sim.rodar(40, { sincrono: true });
  const o = sim.q.orcamento();
  assert.ok(o.saldoHora < 0, 'o saldo do orçamento conta os juros');
  assert.ok(o.fluxoCaixaHora > 0, 'o caixa cresce');
  assert.equal(sim.q.barra().alertas.some((a) => a.id === 'caixa'), false);
  const c0 = sim.holding.caixa();
  sim.rodar(600, { sincrono: true });
  assert.ok(sim.holding.caixa() > c0);
  assert.equal(sim.q.orcamento().caixaZerado, false);
});
