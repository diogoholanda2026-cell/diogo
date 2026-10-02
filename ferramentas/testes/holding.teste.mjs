// Holding (dona: S3a): construir pelo substituto, linhas com lote e Auto (D57), armazém, ocupação, compra de tempo
// (D13), subida de nível, mercado da cidade (D48), importação a 160%, Depósito automático, frota e entregas (D47) e o
// efeito de torre.e2 (D49).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addNo, addAresta, removerAresta } from '../../fonte/sim/vias/grafo.js';
import { porEstoque } from '../../fonte/sim/holding/producao.js';
import { obrasEsperando } from '../../fonte/sim/holding/mercado.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { PREDIOS_HOLDING } from '../../fonte/data/holding.js';
import { simS3a, predioHolding, fixarCidade } from '../robo/cidade-faz-de-conta.mjs';

const ok = (r) => assert.equal(r.ok, true, JSON.stringify(r));

/** Dá XP até o marco n (sem requisito). */
function ateMarco(sim, n) {
  const lim = [0, 400, 1500, 3500, 8000, 15000, 25000, 38000];
  sim.progresso.xp(Math.max(0, lim[n] - sim.json.progresso.xp), 'teste');
  sim.rodar(20, { sincrono: true });
  assert.equal(sim.progresso.marco().n, n);
}

test('construir (substituto até a S2a): frente para a via, marco, acesso, créditos; obra e linha 0 em 10 com Auto', () => {
  const sim = simS3a({ semente: 'construir', populacao: 1500, bemEstar: 55 });
  const G = sim.grafo;
  addAresta(G, addNo(G, -400, 0), addNo(G, 400, 0), 'rua');
  assert.equal(sim.cmd('construir', { tipo: 'pedreira', x: 0, z: 400, rot: 0 }).codigo, 'acesso');
  assert.equal(sim.cmd('construir', { tipo: 'concreteira', x: 0, z: 40, rot: 0 }).codigo, 'marco');
  assert.equal(sim.cmd('construir', { tipo: 'inventado', x: 0, z: 40, rot: 0 }).codigo, 'valor');
  assert.equal(sim.cmd('construir', { tipo: 'pedreira', x: 0, z: 0, rot: 0 }).codigo, 'colisao', 'em cima da via');
  const pv = sim.q.construir.previa({ tipo: 'escritorioObra', x: -200, z: 40 });
  assert.equal(pv.ok, true);
  assert.ok(Math.abs(Math.abs(pv.rot) - Math.PI) < 1e-6, 'a frente olha para a via, ao norte');
  const c0 = sim.holding.caixa();
  const r = sim.cmd('construir', { tipo: 'escritorioObra', x: -200, z: 40 });
  ok(r);
  assert.equal(c0 - sim.holding.caixa(), PREDIOS_HOLDING.escritorioObra.custo);
  assert.equal(sim.cmd('construir', { tipo: 'pedreira', x: -190, z: 50 }).codigo, 'colisao');
  const ped = sim.cmd('construir', { tipo: 'pedreira', x: 150, z: 48 }).id;
  const f = sim.q.predio(ped);
  assert.equal(f.tipo, 'holding');
  assert.equal(f.estado, 'obra');
  assert.deepEqual(f.holding.linhas.map((l) => [l.item, l.n, l.auto]), [['brita', 10, true]]);
  sim.rodar(PREDIOS_HOLDING.pedreira.obraTiques + 20, { sincrono: true });
  assert.equal(sim.q.predio(ped).estado, 'ok');
  sim.rodar(400, { sincrono: true });
  assert.ok(sim.json.producao.estoque.brita >= 10, 'a pedreira produz depois da obra');
  // sem caixa
  sim.holding.pagar(sim.holding.caixa(), 'teste');
  assert.equal(sim.cmd('construir', { tipo: 'areal', x: 300, z: -45 }).codigo, 'creditos');
  assert.ok(sim.q.catalogo('empresas').some((c) => c.tipo === 'olaria' && c.liberado === false));
  assert.deepEqual(sim.erros, []);
});

test('linhas: armazém cheio segura, ocupação abaixo de 50% para, Auto repete, parar devolve os insumos', () => {
  const sim = simS3a({ semente: 'linhas', populacao: 1000, bemEstar: 50 });
  // sem armazém (Escritório de Obra), nada cabe
  const ped = predioHolding(sim, 'pedreira', 200, 0);
  sim.rodar(400, { sincrono: true });
  assert.equal(sim.q.producao().predios[0].linhas[0].parada, 'armazem');
  predioHolding(sim, 'escritorioObra', 0, 0);
  sim.rodar(400, { sincrono: true });
  assert.ok(sim.json.producao.estoque.brita >= 10);
  // ocupação: 40 moradores dão 20 ativos para as 30 vagas (66%); 20 moradores, 10 ativos (33%): para
  fixarCidade(sim, { populacao: 20, bemEstar: 50 });
  sim.rodar(260, { sincrono: true });
  assert.equal(sim.q.producao().predios.find((p) => p.ref === ped).linhas[0].parada, 'pessoal');
  fixarCidade(sim, { populacao: 1000, bemEstar: 50 });
  // olaria: tijolo pede 2 argila por unidade; parar devolve os insumos do lote em andamento
  ateMarco(sim, 1);
  const ola = predioHolding(sim, 'olaria', -200, 0);
  sim.cmd('linha.parar', { predio: ola, linha: 0 });
  porEstoque(sim, 'argila', 20);
  ok(sim.cmd('linha.ordem', { predio: ola, linha: 0, item: 'tijolo', n: 10, auto: false }));
  sim.rodar(1, { sincrono: true });
  assert.equal(sim.json.producao.estoque.argila, 0);
  ok(sim.cmd('linha.parar', { predio: ola, linha: 0 }));
  assert.equal(sim.json.producao.estoque.argila, 20);
  assert.equal(sim.cmd('linha.parar', { predio: ola, linha: 0 }).codigo, 'nada');
  // sugestão de lote menor quando o insumo é curto (D57); ordem sem Auto e sem insumo é recusada
  sim.json.producao.estoque.argila = 6;
  assert.equal(sim.cmd('linha.ordem', { predio: ola, linha: 0, item: 'tijolo', n: 10, auto: false }).codigo, 'estoque');
  ok(sim.cmd('linha.ordem', { predio: ola, linha: 0, item: 'tijolo', n: 10, auto: true }));
  sim.rodar(1, { sincrono: true });
  assert.equal(sim.q.predio(ola).holding.linhas[0].sugestaoLote, 3);
  assert.equal(sim.cmd('linha.ordem', { predio: ola, linha: 0, item: 'concreto', n: 10, auto: true }).codigo, 'trancado');
  assert.equal(sim.cmd('linha.ordem', { predio: ola, linha: 5, item: 'tijolo', n: 10, auto: true }).codigo, 'trancado');
  assert.equal(sim.cmd('linha.ordem', { predio: 12345, linha: 0, item: 'tijolo', n: 10, auto: true }).codigo, 'inexistente');
});

test('compra de tempo (D13) e subida de nível', () => {
  const sim = simS3a({ semente: 'tempo', populacao: 2000, bemEstar: 50 });
  predioHolding(sim, 'escritorioObra', 0, 0);
  const ped = predioHolding(sim, 'pedreira', 200, 0);
  sim.rodar(21, { sincrono: true });
  const antes = sim.q.predio(ped).holding.linhas[0].progresso;
  const c0 = sim.holding.caixa();
  ok(sim.cmd('acelerar', { alvo: { predio: ped, linha: 0 }, minutos: 1 }));
  assert.equal(c0 - sim.holding.caixa(), 100);
  assert.ok(sim.q.predio(ped).holding.linhas[0].progresso - antes > 0.2, '1 min de 240 tiques');
  assert.equal(sim.cmd('acelerar', { alvo: { predio: ped, linha: 0 }, minutos: 7 }).codigo, 'valor');
  assert.equal(sim.cmd('acelerar', { alvo: { predio: ped, linha: 0 }, minutos: 60 }).ok, true);
  sim.cmd('linha.parar', { predio: ped, linha: 0 });
  assert.equal(sim.cmd('acelerar', { alvo: { predio: ped, linha: 0 }, minutos: 5 }).codigo, 'nada');
  // nível 2 pede o marco 2, 10 mil e 30 brita; o nível 3 não passa do máximo
  assert.equal(sim.cmd('predio.nivel', { ref: ped }).codigo, 'marco');
  ateMarco(sim, 2);
  sim.json.producao.estoque.brita = 10;
  assert.equal(sim.cmd('predio.nivel', { ref: ped }).codigo, 'estoque');
  sim.json.producao.estoque.brita = 40;
  ok(sim.cmd('predio.nivel', { ref: ped }));
  assert.equal(sim.json.producao.estoque.brita, 10);
  assert.equal(sim.q.predio(ped).holding.linhas.length, 2);
  assert.equal(sim.tabelas.predios.nivel[ped % 1048576], 2);
  ateMarco(sim, 4);
  porEstoque(sim, 'concreto', 20);
  ok(sim.cmd('predio.nivel', { ref: ped }));
  assert.equal(sim.cmd('predio.nivel', { ref: ped }).codigo, 'maximo');
});

test('mercado da cidade (D48): até o marco 2 vende o que há; do 3 em diante a Holding importa a 160% e vende a 100%', () => {
  const sim = simS3a({ semente: 'mercado', populacao: 3000, bemEstar: 62 });
  porEstoque(sim, 'tijolo', 5);
  const c0 = sim.holding.caixa();
  // nível 1, marco 0: vende 5 do estoque e a cidade importa o resto sozinha
  assert.deepEqual(sim.holding.comprarParaObra(-1, 1, { tijolo: 8 }), { espera: false, vendidas: 5, importadas: 0 });
  assert.equal(sim.holding.caixa() - c0, 5 * 50);
  // reserva e "não vender à cidade" seguram o estoque
  porEstoque(sim, 'tijolo', 10);
  ok(sim.cmd('estoque.reserva', { item: 'tijolo', n: 6 }));
  assert.equal(sim.holding.comprarParaObra(-1, 2, { tijolo: 8 }).vendidas, 4);
  ok(sim.cmd('estoque.vendeCidade', { item: 'tijolo', sim: false }));
  assert.equal(sim.holding.comprarParaObra(-1, 2, { tijolo: 8 }).vendidas, 0);
  // marco 3: obra de nível 3 sem estoque de concreto: a Holding importa (perde 60%) e a obra não espera
  ateMarco(sim, 3);
  const c1 = sim.holding.caixa();
  assert.deepEqual(sim.holding.comprarParaObra(-1, 3, { concreto: 2 }), { espera: false, vendidas: 0, importadas: 2 });
  assert.ok(Math.abs(c1 - sim.holding.caixa() - 2 * 170 * 0.6) < 1e-9);
  assert.ok(sim.q.orcamento().despesas.importacaoCidade > 0);
  // desligada a importação para a cidade, a obra espera e o aviso aparece
  ok(sim.cmd('cidade.importarAuto', { sim: false }));
  assert.equal(sim.holding.comprarParaObra(-1, 4, { concreto: 3 }).espera, true);
  sim.rodar(20, { sincrono: true });
  assert.deepEqual(obrasEsperando(sim), { item: 'concreto', n: 3 });
  assert.ok(sim.q.barra().alertas.some((a) => a.codigo === 'obrasSemMaterial' && a.params.item === 'concreto'));
  // nível 2 continua importando sozinho
  assert.equal(sim.holding.comprarParaObra(-1, 2, { concreto: 3 }).espera, false);
  // sem caixa, também espera
  ok(sim.cmd('cidade.importarAuto', { sim: true }));
  sim.holding.pagar(sim.holding.caixa(), 'teste');
  assert.equal(sim.holding.comprarParaObra(-1, 5, { concreto: 1 }).espera, true);
  assert.ok(sim.q.producao().itens.find((i) => i.item === 'concreto').cidadeHora > 0, 'a demanda da cidade por hora');
});

test('importação a 160% com entrega em 40 s; Depósito automático acima de N', () => {
  const sim = simS3a({ semente: 'importar', populacao: 500, bemEstar: 50 });
  assert.equal(sim.cmd('importar', { item: 'aco', n: 5 }).codigo, 'trancado', 'aço só no marco 3');
  const c0 = sim.holding.caixa();
  ok(sim.cmd('importar', { item: 'brita', n: 10 }));
  assert.equal(c0 - sim.holding.caixa(), 10 * 20 * 1.6);
  sim.rodar(39, { sincrono: true });
  assert.equal(sim.json.producao.estoque.brita, 0);
  sim.rodar(2, { sincrono: true });
  assert.equal(sim.json.producao.estoque.brita, 10);
  assert.equal(sim.cmd('importar', { item: 'brita', n: 0 }).codigo, 'valor');
  sim.holding.pagar(sim.holding.caixa() - 10, 'teste');
  assert.equal(sim.cmd('importar', { item: 'brita', n: 1 }).codigo, 'creditos');
  // Depósito automático: vende o que passa de 4 a cada rodada
  ok(sim.cmd('deposito.auto', { item: 'brita', acima: 4 }));
  sim.rodar(20, { sincrono: true });
  assert.equal(sim.json.producao.estoque.brita, 4);
  assert.equal(sim.q.deposito().janela.vendidas, 6);
  assert.equal(sim.q.deposito().itens.find((i) => i.item === 'brita').auto, 4);
  ok(sim.cmd('deposito.auto', { item: 'brita', acima: null }));
  assert.equal(sim.cmd('deposito.auto', { item: 'brita', acima: -1 }).codigo, 'valor');
});

test('frota (D47): 6 caminhões, o resto na fila; entrega tira do estoque; tratador pelo nome sobrevive ao save', () => {
  const sim = simS3a({ semente: 'frota', populacao: 2000, bemEstar: 50 });
  predioHolding(sim, 'escritorioObra', 0, 0);
  porEstoque(sim, 'brita', 100);
  const chegou = [];
  sim.holding.registrarChegada('arcologia', (e) => chegou.push(e.n));
  const id = sim.holding.entregar({ item: 'brita', n: 75, destino: 'torre.e1', aoChegar: 'arcologia' });
  assert.ok(id > 0);
  assert.equal(sim.json.producao.estoque.brita, 25, 'as 75 saem do estoque no pedido');
  let f = sim.q.producao().frota;
  assert.deepEqual([f.usados, f.total, f.fila], [6, 6, 2], '8 viagens de até 10 para 6 caminhões');
  assert.equal(sim.holding.entregar({ item: 'brita', n: 30, destino: 'torre.e1' }), -1, 'sem estoque bastante');
  assert.equal(sim.espelho.entregas.length, 6);
  assert.ok(sim.espelho.entregas[0].caminho instanceof Int32Array);
  // visual: fora do teto
  sim.holding.entregar({ item: 'areia', n: 5, origem: 'entrada', destino: 'armazem', visual: true });
  assert.equal(sim.q.producao().frota.usados, 6);
  // salvar no meio da viagem: o tratador pelo nome continua
  const nova = simS3a({ semente: 'frota' });
  fixarCidade(nova, { populacao: 2000, bemEstar: 50 });
  aplicarSave(nova, migrar(lerSave(montarSave(sim))));
  const chegouNova = [];
  nova.holding.registrarChegada('arcologia', (e) => chegouNova.push(e.n));
  sim.rodar(1200, { sincrono: true });
  nova.rodar(1200, { sincrono: true });
  assert.equal(chegou.reduce((a, b) => a + b, 0), 75);
  assert.deepEqual(chegouNova, chegou);
  assert.equal(nova.q.hash(), sim.q.hash());
  f = sim.q.producao().frota;
  assert.equal(f.fila, 0);
  assert.ok(f.atrasoMedio > 0, 'as duas da fila esperaram');
  assert.ok(f.porDestino['torre.e1'].viagens === 8);
});

test('torre.e2 (D49): +15% de produtividade e +6 caminhões pelo efeito da Holding', () => {
  const sim = simS3a({ semente: 'efeito', populacao: 2000, bemEstar: 50 });
  predioHolding(sim, 'escritorioObra', 0, 0);
  const ped = predioHolding(sim, 'pedreira', 200, 0);
  sim.holding.efeito('torre.e2', { produtividade: 0.15, caminhoes: 6 });
  sim.rodar(20, { sincrono: true });
  assert.ok(Math.abs(sim.q.predio(ped).holding.produtividade - 1.15) < 1e-9);
  assert.equal(sim.q.producao().frota.total, 12);
  // a Concreteira longe do armazém perde 1% a cada 100 m além de 500 m, até 30%
  const conc = predioHolding(sim, 'concreteira', 1500, 0);
  sim.rodar(20, { sincrono: true });
  assert.ok(Math.abs(sim.q.predio(conc).holding.produtividade - 1.15 * 0.9) < 1e-9);
});

test('revisão: trocar o lote com a linha rodando muda só o próximo; parar devolve o que o lote consumiu', () => {
  const sim = simS3a({ semente: 'troca-lote', populacao: 2000, bemEstar: 50 });
  predioHolding(sim, 'escritorioObra', 0, 0);
  ateMarco(sim, 1);
  const ola = predioHolding(sim, 'olaria', 200, 0);
  sim.cmd('linha.parar', { predio: ola, linha: 0 });
  porEstoque(sim, 'argila', 2);
  ok(sim.cmd('linha.ordem', { predio: ola, linha: 0, item: 'tijolo', n: 1, auto: false }));
  sim.rodar(1, { sincrono: true });
  assert.equal(sim.json.producao.estoque.argila, 0, 'o lote de 1 consumiu 2 argila');
  ok(sim.cmd('linha.ordem', { predio: ola, linha: 0, item: 'tijolo', n: 10, auto: false }));
  ok(sim.cmd('linha.parar', { predio: ola, linha: 0 }));
  assert.equal(sim.json.producao.estoque.argila, 2, 'volta só o que o lote em andamento consumiu');
  assert.ok(sim.json.producao.consumidos.argila >= 0);
  assert.deepEqual(sim.validar(), []);
});

test('revisão: chaves herdadas não viram item; entregar recusa n fora de 1 a 1.000', () => {
  const sim = simS3a({ semente: 'chaves', populacao: 2000, bemEstar: 50 });
  predioHolding(sim, 'escritorioObra', 0, 0);
  for (const item of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(sim.cmd('importar', { item, n: 5 }).codigo, 'valor', item);
    assert.equal(sim.cmd('estoque.reserva', { item, n: 5 }).codigo, 'valor', item);
    assert.equal(sim.cmd('deposito.vender', { item, n: 5 }).codigo, 'valor', item);
    assert.equal(sim.cmd('deposito.auto', { item, acima: 1 }).codigo, 'valor', item);
    assert.equal(sim.cmd('estoque.vendeCidade', { item, sim: false }).codigo, 'valor', item);
    assert.equal(sim.holding.entregar({ item, n: 1, destino: 'torre.e1' }), -1, item);
  }
  porEstoque(sim, 'brita', 5);
  assert.equal(sim.holding.entregar({ item: 'brita', n: 0, destino: 'torre.e1' }), -1, 'n = 0 não leva nada');
  assert.equal(sim.holding.entregar({ item: null, n: 5000, origem: 'entrada', destino: 'torre.e1' }), -1);
  assert.equal(sim.json.producao.estoque.brita, 5);
  sim.rodar(60, { sincrono: true });
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});

test('revisão: a rota do caminhão segue o grafo de agora (trocar a via no mesmo lugar refaz o tempo)', () => {
  const sim = simS3a({ semente: 'rota', populacao: 2000, bemEstar: 50 });
  const G = sim.grafo;
  const a = addNo(G, 0, 0);
  const b = addNo(G, 2000, 0);
  const e = addAresta(G, a, b, 'rua');
  const pedir = () => {
    sim.holding.entregar({ item: null, n: 1, origem: { x: 0, z: 0 }, destino: { x: 2000, z: 0 } });
    const v = sim.espelho.entregas[sim.espelho.entregas.length - 1];
    return v.tFim - v.tIni;
  };
  const naRua = pedir();
  // mesma vaga, mesmas contagens, outro tipo: a avenida é mais rápida
  removerAresta(G, e, { manterNos: true });
  addAresta(G, a, b, 'avenida');
  const naAvenida = pedir();
  assert.ok(naAvenida < naRua, `rua ${naRua} tiques, avenida ${naAvenida}`);
});
