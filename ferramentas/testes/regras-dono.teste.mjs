// Regras do dono (A2; dona: S3a): tarifa arredondada, limite anual e dívida do empréstimo, 10% em um ano, mora depois
// de 10 anos, Depósito a 150% com 100 vendas por janela e a virada, lote de 1 a 10 (10 levam 8 vezes 1), caixa nunca
// negativo com 10 mil comandos aleatórios, dívida igual à soma dos contratos, o fator da moeda que só a interface usa
// (D87) e o calendário (D67). Roda só com os domínios da S3a: não depende de nenhuma outra parcela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REGRAS_DONO, tarifaDoBemEstar, faixaDaTarifa, tempoDoLote, loteValido, emDolar, CAIXA_INICIAL, COMPRA_TEMPO,
} from '../../fonte/data/economia.js';
import { dataDoTique, tiqueDaData, anoDeJogo, ANO_INICIAL } from '../../fonte/data/historia.js';
import { ITENS } from '../../fonte/data/holding.js';
import { RODADA } from '../../fonte/comum/relogio.js';
import { usarRegras } from '../../fonte/sim/holding/base.js';
import { porEstoque } from '../../fonte/sim/holding/producao.js';
import { simS3a, predioHolding } from '../robo/cidade-faz-de-conta.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ANO = 7200;

function sorteio(s) {
  let a = s >>> 0 || 1;
  return () => {
    a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0;
    return a / 4294967296;
  };
}

/** Pula o relógio da simulação (o núcleo faz o mesmo ao carregar um save). */
const pular = (sim, tique) => sim.definirNucleo({ ...sim.estadoNucleo(), tique });

test('REGRAS_DONO: os números do dono, congelados', () => {
  const congelado = (o) => Object.isFrozen(o) && Object.values(o).every((v) => typeof v !== 'object' || v === null || congelado(v));
  assert.ok(congelado(REGRAS_DONO));
  assert.deepEqual(REGRAS_DONO.lote, { min: 1, max: 10, fatorTempo: 0.8 });
  assert.equal(REGRAS_DONO.deposito.venda, 1.5);
  assert.equal(REGRAS_DONO.deposito.vendasPorJanela, null);
  assert.equal(REGRAS_DONO.deposito.janelaTiques, 4 * 3600);
  assert.equal(REGRAS_DONO.deposito.precoBase, 'catalogo');
  assert.deepEqual(REGRAS_DONO.emprestimo, { porAno: 167000, taxaAno: 0.03, dividaMax: 1667000, passo: 1000, prazoAnos: 10, mora: 0.2, lombard: { cobertura: 0.6 } });
  assert.deepEqual(REGRAS_DONO.renda.tarifas, [5, 8, 11]);
  assert.equal(REGRAS_DONO.renda.tarifaPor, 'cidade');
  assert.deepEqual(REGRAS_DONO.moeda, { simbolo: 'US$', fator: 600 });
  assert.equal(CAIXA_INICIAL, 300000);
  assert.deepEqual(COMPRA_TEMPO, { 1: 100, 5: 500, 10: 1000, 30: 2500, 60: 5000 });
});

test('tarifa pelo bem-estar arredondado (D11): 30,4 dá 5; 30,5 dá 8; 60,4 dá 8; 60,5 dá 11', () => {
  assert.deepEqual([30.4, 30.5, 60.4, 60.5].map((b) => tarifaDoBemEstar(b)), [5, 8, 8, 11]);
  assert.deepEqual([30, 31, 60, 61, 0, 100, NaN, -5, 120].map((b) => tarifaDoBemEstar(b)), [5, 8, 8, 11, 5, 11, 5, 5, 11]);
  assert.deepEqual(faixaDaTarifa(64), { faixa: [61, 100], margem: { degrau: 61, delta: 3 } });
  assert.deepEqual(faixaDaTarifa(12).margem, { degrau: null, delta: null });
  // a contribuição usa a regra: 1.000 moradores a 61 rendem 11 mil por hora de jogo (aqui 1.080 tiques, antes da
  // Febre Aurora de mar. 2020, que cobra a decisão)
  const sim = simS3a({ populacao: 1000, bemEstar: 60.5 });
  const c0 = sim.holding.caixa();
  sim.rodar(1080, { sincrono: true });
  assert.ok(Math.abs(sim.holding.caixa() - c0 - 3300) < 1e-6, `contribuição de 0,3 h: ${sim.holding.caixa() - c0}`);
  assert.equal(sim.q.orcamento().receitas.moradores, 11000);
});

test('empréstimo Lombard: passo, limite anual de 167 mil, virada do ano e dívida até 1.667 mil (D103)', () => {
  const sim = simS3a({ semente: 'emprestimo' });
  for (const v of [0, 999, 1500, -1000, 50000.5, '1000']) assert.equal(sim.cmd('emprestimo.tomar', { valor: v }).codigo, 'valor', String(v));
  assert.equal(sim.cmd('emprestimo.tomar', { valor: 100000 }).ok, true);
  assert.equal(sim.cmd('emprestimo.tomar', { valor: 68000 }).codigo, 'limiteAno');
  assert.equal(sim.cmd('emprestimo.tomar', { valor: 67000 }).ok, true);
  assert.equal(sim.q.emprestimo().disponivelAno, 0);
  assert.equal(sim.cmd('emprestimo.tomar', { valor: 1000 }).codigo, 'limiteAno');
  // o ano de jogo vira: mais 167 mil (o crédito renova todo ano)
  pular(sim, ANO);
  assert.equal(sim.q.emprestimo().ano, ANO_INICIAL + 1);
  assert.equal(sim.cmd('emprestimo.tomar', { valor: 167000 }).ok, true);
  // até a dívida (principal + juros devidos) chegar a 1.667 mil
  for (let ano = 2; ano < 12; ano++) {
    pular(sim, ano * ANO);
    const e = sim.q.emprestimo();
    const pode = Math.min(167000, Math.floor((1667000 - e.divida) / 1000) * 1000);
    if (pode <= 0) {
      assert.equal(sim.cmd('emprestimo.tomar', { valor: 1000 }).codigo, 'limiteDivida');
      break;
    }
    assert.equal(e.disponivelAno, pode);
    if (pode < 167000) assert.equal(sim.cmd('emprestimo.tomar', { valor: pode + 1000 }).codigo, 'limiteDivida');
    assert.equal(sim.cmd('emprestimo.tomar', { valor: pode }).ok, true);
  }
  const e = sim.q.emprestimo();
  assert.ok(e.divida <= 1667000 + 1e-6, `dívida ${e.divida}`);
  assert.equal(sim.cmd('emprestimo.tomar', { valor: 1000 }).codigo, 'limiteDivida');
  assert.deepEqual(sim.validar(), []);
});

test('juros: 3% em um ano com erro abaixo de 0,1%; Lombard rola o contrato com cobertura e a mora de 20% vale sem ela', () => {
  const sim = simS3a({ semente: 'juros' });
  assert.equal(sim.cmd('emprestimo.tomar', { valor: 50000 }).ok, true);
  sim.rodar(ANO, { sincrono: true });
  const j = sim.q.emprestimo().jurosDevidos;
  assert.ok(Math.abs(j - 1500) / 1500 < 0.001, `juros de 1 ano: ${j}`);
  assert.ok(Math.abs(sim.q.emprestimo().jurosHora - 750) < 1e-6, 'juros por hora de jogo: 1,5% do saldo (o ano tem 2 h)');
  // Lombard: com ativos que cobrem a dívida, o contrato de 10 anos se renova e segue a 3%
  const L = simS3a({ semente: 'lombard' });
  L.cmd('emprestimo.tomar', { valor: 50000 });
  pular(L, 10 * ANO);
  L.rodar(RODADA + 2, { sincrono: true });
  assert.equal(L.q.emprestimo().contratos[0].mora, false, 'rolou: sem mora');
  assert.equal(L.q.emprestimo().lombard.cobertura, 0.6);
  // sem cobertura (dívida acima de 60% dos ativos) o contrato vencido cai na mora de 20%
  const m = simS3a({ semente: 'mora' });
  m.cmd('emprestimo.tomar', { valor: 50000 });
  m.json.economia.emprestimo.contratos[0].saldo = 5e9; // dívida enorme, ativos pequenos
  m.json.economia.emprestimo.principal = 5e9;
  pular(m, 10 * ANO);
  m.rodar(RODADA + 2, { sincrono: true });
  assert.equal(m.q.emprestimo().contratos[0].mora, true);
  // pagar juros, parcela (juros + 10% do principal, mínimo 1.000) e quitar, num contrato comum
  const q = simS3a({ semente: 'quitar' });
  q.cmd('emprestimo.tomar', { valor: 50000 });
  q.rodar(ANO, { sincrono: true });
  assert.equal(q.cmd('emprestimo.pagarJuros').ok, true);
  assert.ok(q.q.emprestimo().jurosDevidos < 1e-6);
  const antes = q.q.emprestimo().divida;
  assert.equal(q.cmd('emprestimo.pagarParcela').ok, true);
  assert.equal(antes - q.q.emprestimo().divida, 5000);
  assert.equal(q.cmd('emprestimo.quitar').ok, true);
  assert.equal(q.q.emprestimo().divida, 0);
  for (const c of ['emprestimo.pagarJuros', 'emprestimo.pagarParcela', 'emprestimo.quitar']) assert.equal(q.cmd(c).codigo, 'nada', c);
  assert.deepEqual(q.validar(), []);
});

test('Depósito: 150% do preço de catálogo, sem limite de vendas (D103)', () => {
  const sim = simS3a({ semente: 'deposito' });
  porEstoque(sim, 'brita', 150);
  porEstoque(sim, 'concreto', 20);
  const c0 = sim.holding.caixa();
  const r = sim.cmd('deposito.vender', { item: 'brita', n: 120 });
  assert.equal(r.ok, true);
  assert.equal(r.dados.vendidas, 120, 'sem limite por janela');
  assert.equal(sim.holding.caixa() - c0, 120 * ITENS.brita.base * 1.5);
  assert.equal(sim.q.deposito().janela.vendidas, 120);
  assert.equal(sim.q.deposito().janela.max, null);
  assert.equal(sim.q.deposito().itens.find((i) => i.item === 'concreto').precoVenda, 255);
  assert.equal(sim.cmd('deposito.vender', { item: 'concreto', n: 20 }).dados.vendidas, 20);
  assert.equal(sim.cmd('deposito.vender', { item: 'brita', n: 0 }).codigo, 'valor');
  assert.equal(sim.cmd('deposito.vender', { item: 'ouro', n: 1 }).codigo, 'valor');
  // a janela de 14.400 tiques só zera o contador
  pular(sim, 14400);
  assert.equal(sim.q.deposito().janela.vendidas, 0);
  assert.equal(sim.cmd('deposito.vender', { item: 'brita', n: 60 }).dados.vendidas, 30);
  assert.equal(sim.cmd('deposito.vender', { item: 'brita', n: 1 }).codigo, 'nada');
});

test('lote: 0 e 11 recusados; o de 10 leva 8 vezes o de 1', () => {
  assert.equal(tempoDoLote(30, 10), 8 * tempoDoLote(30, 1));
  assert.deepEqual([0, 11, 1.5, -1, '10'].map((n) => loteValido(n)), [false, false, false, false, false]);
  assert.deepEqual([1, 5, 10].map((n) => loteValido(n)), [true, true, true]);
  const sim = simS3a({ semente: 'lote', populacao: 2000, bemEstar: 50 });
  predioHolding(sim, 'escritorioObra', 0, 0);
  const ped = predioHolding(sim, 'pedreira', 200, 0);
  assert.equal(sim.cmd('linha.ordem', { predio: ped, linha: 0, item: 'brita', n: 0, auto: false }).codigo, 'lote');
  assert.equal(sim.cmd('linha.ordem', { predio: ped, linha: 0, item: 'brita', n: 11, auto: false }).codigo, 'lote');
  // medida em tiques: lote de 1 e lote de 10, na produtividade 1
  const medir = (n) => {
    const s = simS3a({ semente: `lote${n}`, populacao: 2000, bemEstar: 50 });
    predioHolding(s, 'escritorioObra', 0, 0);
    const p = predioHolding(s, 'pedreira', 200, 0);
    s.cmd('linha.parar', { predio: p, linha: 0 });
    assert.equal(s.cmd('linha.ordem', { predio: p, linha: 0, item: 'brita', n, auto: false }).ok, true);
    let t = 0;
    while (s.json.producao.estoque.brita < n && t < 5000) {
      s.rodar(1, { sincrono: true });
      t++;
    }
    return t;
  };
  const t1 = medir(1);
  const t10 = medir(10);
  assert.ok(Math.abs(t10 - 8 * t1) <= 2, `lote de 1 em ${t1} tiques, de 10 em ${t10}`);
});

test('caixa nunca negativo e dívida igual à soma dos contratos (10 mil comandos aleatórios)', () => {
  const sim = simS3a({ semente: 'aleatorio', populacao: 800, bemEstar: 40 });
  const esc = predioHolding(sim, 'escritorioObra', 0, 0);
  const ped = predioHolding(sim, 'pedreira', 200, 0);
  const are = predioHolding(sim, 'areal', -200, 0);
  // custos que apertam o caixa (D41: o que não dá para pagar não vira dívida)
  let custo = 20000;
  sim.custos.registrar('servicos.teste', () => custo);
  const r = sorteio(42);
  const itens = Object.keys(ITENS);
  const pega = (l) => l[Math.floor(r() * l.length)];
  const cmds = [
    () => ['emprestimo.tomar', { valor: pega([1000, 5000, 20000, 50000, 60000, 1500]) }],
    () => ['emprestimo.pagarJuros', {}],
    () => ['emprestimo.pagarParcela', {}],
    () => ['emprestimo.quitar', {}],
    () => ['deposito.vender', { item: pega(itens), n: 1 + Math.floor(r() * 40) }],
    () => ['importar', { item: pega(itens), n: 1 + Math.floor(r() * 30) }],
    () => ['linha.ordem', { predio: pega([esc, ped, are, 77]), linha: Math.floor(r() * 3), item: pega(itens), n: Math.floor(r() * 12), auto: r() < 0.5 }],
    () => ['linha.parar', { predio: pega([ped, are]), linha: 0 }],
    () => ['acelerar', { alvo: { predio: pega([ped, are]), linha: 0 }, minutos: pega([1, 5, 10, 30, 60, 7]) }],
    () => ['predio.nivel', { ref: pega([esc, ped, are]) }],
    () => ['estoque.reserva', { item: pega(itens), n: Math.floor(r() * 50) }],
    () => ['deposito.auto', { item: pega(itens), acima: r() < 0.5 ? null : Math.floor(r() * 100) }],
    () => ['cidade.importarAuto', { sim: r() < 0.5 }],
    () => ['decisao.escolher', { id: pega(['vila.agua', 'febre.aurora', 'canal.seshat']), opcao: pega(['captacao', 'reservatorio', 'comprar', 'proteger', 'navios', 'local']) }],
  ];
  for (let k = 0; k < 10000; k++) {
    const [nome, args] = pega(cmds)();
    const res = sim.cmd(nome, args);
    assert.equal(typeof res.ok, 'boolean');
    if (k % 7 === 0) sim.rodar(1 + Math.floor(r() * 40), { sincrono: true });
    if (k % 1000 === 0) custo = pega([0, 2000, 20000, 200000]);
    if (k % 13 === 0) sim.holding.comprarParaObra(-1, 1 + Math.floor(r() * 5), { [pega(itens)]: 1 + Math.floor(r() * 5) });
    assert.ok(sim.holding.caixa() >= 0, `caixa negativo depois de ${nome}`);
    if (k % 50 === 0) {
      const e = sim.q.emprestimo();
      const soma = e.contratos.reduce((a, c) => a + c.saldo + c.juros, 0);
      assert.ok(Math.abs(e.divida - soma) < 1e-6, `dívida ${e.divida} x contratos ${soma}`);
      assert.deepEqual(sim.validar(), []);
    }
  }
  assert.deepEqual(sim.erros, []);
});

test('moeda (D87): trocar o fator não muda nenhum número da simulação; nenhum arquivo da simulação lê o fator', () => {
  assert.equal(emDolar(167000), 100200000, 'empréstimo de 167 mil por ano = US$ 100 milhões');
  assert.equal(emDolar(1667000), 1000200000);
  assert.deepEqual(REGRAS_DONO.renda.tarifas.map((t) => emDolar(t)), [3000, 4800, 6600]);
  const jogar = (fator) => {
    const sim = simS3a({ semente: 'moeda', populacao: 1200, bemEstar: 62 });
    if (fator !== null) usarRegras(sim, { ...REGRAS_DONO, moeda: { simbolo: 'US$', fator } });
    const ped = predioHolding(sim, 'pedreira', 200, 0);
    predioHolding(sim, 'escritorioObra', 0, 0);
    sim.cmd('emprestimo.tomar', { valor: 20000 });
    sim.rodar(1800, { sincrono: true });
    sim.cmd('deposito.vender', { item: 'brita', n: 30 });
    sim.cmd('acelerar', { alvo: { predio: ped, linha: 0 }, minutos: 5 });
    sim.rodar(3000, { sincrono: true });
    return [sim.q.hash(), sim.holding.caixa(), JSON.stringify(sim.q.orcamento())];
  };
  const a = jogar(null);
  assert.deepEqual(jogar(1), a);
  assert.deepEqual(jogar(5.5), a);
  // conferência de texto: fonte/sim e fonte/comum não leem `moeda`
  const arquivos = [];
  const andar = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) andar(p);
      else if (f.endsWith('.js')) arquivos.push(p);
    }
  };
  andar(join(RAIZ, 'fonte/sim'));
  andar(join(RAIZ, 'fonte/comum'));
  const leem = arquivos.filter((f) => /\.moeda\b|\bmoeda\s*[:.]/.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
  assert.deepEqual(leem, []);
});

test('calendário (D67): o tique 0 é jan. 2020; mês de 600 e ano de 7.200 tiques', () => {
  assert.deepEqual(dataDoTique(0), { ano: 2020, mes: 1, fracMes: 0 });
  assert.equal(dataDoTique(599).mes, 1);
  assert.deepEqual([dataDoTique(600).ano, dataDoTique(600).mes], [2020, 2]);
  assert.deepEqual([dataDoTique(7199).ano, dataDoTique(7199).mes], [2020, 12]);
  assert.deepEqual([dataDoTique(7200).ano, dataDoTique(7200).mes], [2021, 1]);
  assert.equal(tiqueDaData(2021, 3), 8400);
  assert.equal(tiqueDaData(2026, 6), 6 * 7200 + 5 * 600);
  assert.deepEqual([anoDeJogo(0), anoDeJogo(7199), anoDeJogo(7200)], [1, 1, 2]);
  const sim = simS3a({ semente: 'calendario' });
  assert.deepEqual([sim.q.barra().data.ano, sim.q.barra().data.mes], [2020, 1]);
  sim.rodar(600 * 14, { sincrono: true });
  assert.deepEqual([sim.q.barra().data.ano, sim.q.barra().data.mes], [2021, 3]);
  assert.equal(sim.q.orcamento().serie.length, 14);
  assert.deepEqual([sim.q.orcamento().serie[13].ano, sim.q.orcamento().serie[13].mes], [2021, 2]);
});
