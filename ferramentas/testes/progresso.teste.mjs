// Progresso (dona: S3a): XP pela D51 (moradores novos, bem-estar por mês, vias, serviços, Holding), marcos 0 a 7 com
// prêmio, licenças e desbloqueios, o requisito do marco 7 (torre.e4) e o liberado(id).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addNo, addAresta } from '../../fonte/sim/vias/grafo.js';
import { MARCOS, marcoQueLibera } from '../../fonte/data/marcos.js';
import { simS3a, fixarCidade, predioHolding, DOMINIOS_S3A } from '../robo/cidade-faz-de-conta.mjs';
import { criarSimulacao } from '../../fonte/sim/estado.js';

test('D51: 20 mil moradores a 65 por 1 h dão de 600 a 1.200 de XP de bem-estar', () => {
  const sim = simS3a({ semente: 'xp-bem', populacao: 20000, bemEstar: 65 });
  sim.rodar(3600, { sincrono: true });
  const xp = sim.json.progresso.motivos.bemEstar;
  assert.ok(xp >= 600 && xp <= 1200, `XP de bem-estar: ${xp}`);
  // os moradores do começo são o ponto de partida: nenhum XP por eles
  assert.equal(sim.json.progresso.motivos.moradores ?? 0, 0);
  // abaixo de 50 não conta
  const b = simS3a({ semente: 'xp-baixo', populacao: 20000, bemEstar: 45 });
  b.rodar(1200, { sincrono: true });
  assert.equal(b.json.progresso.motivos.bemEstar ?? 0, 0);
});

test('XP: +1 por morador acima do recorde, vias a cada 100 m, prédio da Holding +30', () => {
  const sim = simS3a({ semente: 'xp', populacao: 350, bemEstar: 50 });
  sim.rodar(20, { sincrono: true });
  fixarCidade(sim, { populacao: 800, bemEstar: 50 });
  sim.rodar(20, { sincrono: true });
  assert.equal(sim.json.progresso.motivos.moradores, 450);
  fixarCidade(sim, { populacao: 600, bemEstar: 50 });
  sim.rodar(20, { sincrono: true });
  fixarCidade(sim, { populacao: 820, bemEstar: 50 });
  sim.rodar(20, { sincrono: true });
  assert.equal(sim.json.progresso.motivos.moradores, 470, 'só o que passa do recorde');
  const G = sim.grafo;
  addAresta(G, addNo(G, 0, 0), addNo(G, 500, 0), 'rua');
  sim.rodar(20, { sincrono: true });
  assert.ok(Math.abs(sim.json.progresso.motivos.vias - 5) < 0.01, `vias: ${sim.json.progresso.motivos.vias}`);
  predioHolding(sim, 'pedreira', 0, 200);
  assert.equal(sim.json.progresso.motivos.holding, 30);
});

test('marcos: limiares da D51, prêmio de 10 mil x n, licenças a partir do 2 e eventos', () => {
  const sim = simS3a({ semente: 'marcos' });
  // D51 com o marco 1 em 500 (C1a: o robô calibra os limiares; com 400 o marco 1 chegava aos 8 min, a meta é de 10 a 15)
  assert.deepEqual(MARCOS.map((m) => m.xp), [0, 500, 1500, 3500, 8000, 15000, 25000, 38000]);
  const eventos = [];
  sim.on('marco', (d) => eventos.push(d));
  const desbloqueios = [];
  sim.on('desbloqueio', (d) => desbloqueios.push(...d.ids));
  const c0 = sim.holding.caixa();
  sim.progresso.xp(1600, 'teste');
  sim.rodar(20, { sincrono: true });
  assert.deepEqual(eventos.map((e) => e.n), [1, 2]);
  assert.equal(sim.q.orcamento().totais.receitas.marcos, 10000 + 20000);
  assert.ok(sim.holding.caixa() > c0);
  assert.deepEqual(eventos.map((e) => e.premios.licencas), [0, 1]);
  assert.ok(desbloqueios.includes('zona.resMedia') && desbloqueios.includes('holding.olaria'));
  const b = sim.q.barra().marco;
  assert.deepEqual([b.n, b.nome, b.xpIni, b.xpProx, b.requisito], [2, 'Vila', 1500, 3500, null]);
  assert.ok(sim.q.mural().some((p) => p.texto === 's3.mural.marco' && p.params.n === 2));
  const q = sim.q.marcos();
  assert.equal(q.length, 8);
  assert.deepEqual(q.slice(0, 4).map((m) => m.feito), [true, true, true, false]);
  assert.equal(q[7].requisito, 'torre.e4');
});

test('marco 7 pede a Torre pronta (torre.e4): pelo requisito da X1b ou pelo espelho da Arcologia', () => {
  const sim = simS3a({ semente: 'marco7' });
  sim.progresso.xp(40000, 'teste');
  sim.rodar(20, { sincrono: true });
  assert.equal(sim.progresso.marco().n, 6);
  assert.equal(sim.progresso.marco().requisito, 'torre.e4');
  // sem a X1b: a etapa pronta no espelho
  sim.espelho.arcologia.etapas = [{ id: 'torre.e4', parte: 'torre', estado: 3, fase: 3, progresso: 1 }];
  sim.rodar(20, { sincrono: true });
  assert.equal(sim.progresso.marco().n, 7);
  // com o requisito registrado, vale o dele
  const b = simS3a({ semente: 'marco7b' });
  let pronta = false;
  b.progresso.requisito(7, () => pronta);
  b.espelho.arcologia.etapas = [{ id: 'torre.e4', parte: 'torre', estado: 3, fase: 3, progresso: 1 }];
  b.progresso.xp(40000, 'teste');
  b.rodar(20, { sincrono: true });
  assert.equal(b.progresso.marco().n, 6);
  pronta = true;
  b.rodar(20, { sincrono: true });
  assert.equal(b.progresso.marco().n, 7);
  assert.equal(b.progresso.marco().xpProx, null);
});

test('liberado(id): trancado até o marco que lista; o M1b fica trancado; livre o que nenhum marco lista', () => {
  const sim = simS3a({ semente: 'liberado' });
  assert.equal(marcoQueLibera('via.ruaMao'), 2);
  assert.equal(sim.progresso.liberado('via.rua'), true);
  assert.equal(sim.progresso.liberado('via.ruaMao'), false);
  assert.equal(sim.progresso.liberado('holding.concreteira'), false);
  assert.equal(sim.progresso.liberado('zona.resAlta'), false, 'M1b');
  assert.equal(sim.progresso.liberado('qualquer.coisa'), true);
  sim.progresso.xp(3600, 'teste');
  sim.rodar(20, { sincrono: true });
  assert.equal(sim.progresso.liberado('via.ruaMao'), true);
  assert.equal(sim.progresso.liberado('holding.concreteira'), true);
  assert.equal(sim.progresso.liberado('zona.resAlta'), false);
});

test('revisão: as vias que já existem no começo (ruas da Vila, do mapa) não dão XP', () => {
  // como no jogo: as ruas da Vila entram no grafo antes do registrar da S3a
  const sim = criarSimulacao({ semente: 'xp-vias-iniciais', dominios: false });
  const G = sim.grafo;
  addAresta(G, addNo(G, 0, 0), addNo(G, 800, 0), 'rua');
  for (const m of DOMINIOS_S3A) m.registrar(sim);
  fixarCidade(sim, { populacao: 350, bemEstar: 50 });
  sim.rodar(40, { sincrono: true });
  assert.equal(sim.json.progresso.motivos.vias ?? 0, 0);
  addAresta(G, addNo(G, 0, 100), addNo(G, 300, 100), 'rua');
  sim.rodar(20, { sincrono: true });
  assert.ok(Math.abs(sim.json.progresso.motivos.vias - 3) < 0.01, `vias: ${sim.json.progresso.motivos.vias}`);
});
