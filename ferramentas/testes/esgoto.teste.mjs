// Testes do esgoto separado e da ETE (S2b; D50, seção 8.2 do desenho da simulação): a terceira rede (a água devolvida),
// que só existe com o M1b; sem ETE todo prédio fica sem esgoto (alerta da cidade, sem abandono), com a ETE ligada o
// esgoto é tratado, o racionamento corta os mais distantes, o bem-estar perde 15 sem esgoto, o nível 2 pede esgoto e a
// camada Esgoto mostra o estado de cada prédio. Antes do M1b nada disso existe (nenhum prédio fica sem esgoto).
// Roda sozinho: node ferramentas/testes/esgoto.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREDIO } from '../../fonte/contratos/flags.js';
import { SERVICOS } from '../../fonte/data/servicos.js';
import { sistemaRedes, consumoDe, estadoRede } from '../../fonte/sim/redes.js';
import { calcularBemEstar, BEM } from '../../fonte/sim/bemestar.js';
import { faltaParaNivel } from '../../fonte/sim/zonas/crescimento.js';
import { AV } from '../../fonte/sim/predios.js';
import { abrirM1b, ruaComRedes, povoar, servicoPronto, rodadas } from './apoio-m1b.mjs';

const sem = (sim, i, bit) => !!(sim.tabelas.predios.flags[i] & bit);
const soma = (sim, lista, rec) => lista.reduce((s, i) => s + consumoDe(sim, i, rec), 0);

test('antes do M1b a rede de esgoto não existe: nenhum prédio fica sem esgoto e o bem-estar não muda', () => {
  const { sim } = ruaComRedes('esgoto-m1a');
  const casas = povoar(sim, 'resBaixa', -520, -460, 60, 12);
  assert.ok(casas.length >= 4);
  sistemaRedes(sim);
  for (const i of casas) assert.ok(!sem(sim, i, PREDIO.SEM_ESGOTO) && !sem(sim, i, PREDIO.SEM_AGUA));
  assert.deepEqual(sim.agregados.redes.esgoto, { oferta: 0, demanda: 0 });
  assert.equal(sim.q.predio(sim.tabelas.predios.ref(casas[0])).servicos.esgoto, null);
  const fatores = [];
  calcularBemEstar(sim, casas[0], fatores);
  assert.ok(!fatores.some((f) => f.id === 'esgoto'));
  const c = sim.q.camada('esgoto');
  assert.equal(c.id, 'esgoto');
  assert.ok(c.dados.every((v) => v === 0), 'a camada vem vazia');
});

test('M1b sem ETE: todo prédio fica sem esgoto, a falta é um alerta da cidade e não conta para o abandono', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('esgoto-sem-ete');
    const casas = povoar(sim, 'resBaixa', -520, -460, 60, 12);
    assert.ok(casas.length >= 4);
    sistemaRedes(sim);
    const P = sim.tabelas.predios;
    for (const i of casas) {
      assert.ok(sem(sim, i, PREDIO.SEM_ESGOTO) && !sem(sim, i, PREDIO.SEM_AGUA) && !sem(sim, i, PREDIO.SEM_ENERGIA));
      assert.equal(estadoRede(sim, i, 'esgoto'), 'sem');
    }
    const ag = sim.agregados.redes;
    assert.equal(ag.esgoto.oferta, 0);
    // o esgoto é a água devolvida: a demanda da rede de esgoto é a da água (menos a de quem a rede de água não atende)
    const dem = soma(sim, [...Array(P.n).keys()].filter((i) => P.viva[i]), 'esgoto');
    assert.ok(Math.abs(ag.esgoto.demanda - dem) < 0.05 && ag.esgoto.demanda > 0, `${ag.esgoto.demanda} contra ${dem}`);
    assert.equal(consumoDe(sim, casas[0], 'esgoto'), consumoDe(sim, casas[0], 'agua'));
    // alerta da cidade (um só)
    const alerta = sim.q.avisos({ limite: 50 }).filter((a) => a.id === 'esgoto');
    assert.equal(alerta.length, 1);
    assert.equal(alerta[0].codigo, 'faltaEsgoto');
    assert.equal(alerta[0].glifo, 'esgoto');
    assert.equal(alerta[0].params.n >= casas.length, true);
    // o bem-estar do prédio perde 15 (o fator aparece)
    const fatores = [];
    calcularBemEstar(sim, casas[0], fatores);
    assert.equal(fatores.find((f) => f.id === 'esgoto')?.v, BEM.semEsgoto);
    assert.equal(BEM.semEsgoto, -15);
    // sem nenhuma ETE a falta é da cidade inteira: o contador do abandono não anda (10 minutos de jogo e mais um pouco)
    rodadas(sim, 40);
    for (const i of casas) {
      assert.ok(P.viva[i] && !sem(sim, i, PREDIO.ABANDONADO), 'não abandona');
      assert.equal(P.problema[i] ?? 0, 0);
      // o aviso do prédio só vale com ETE na cidade
      assert.ok(!(P.avisos[i] & AV.SEM_ESGOTO));
    }
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('com a ETE ligada o esgoto é tratado, a camada mostra o produtor e demolir a ETE volta a faltar', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('esgoto-ete');
    const casas = povoar(sim, 'resBaixa', -520, -460, 60, 12);
    const ete = servicoPronto(sim, 'ete', -300);
    sistemaRedes(sim);
    const P = sim.tabelas.predios;
    for (const i of casas) assert.ok(!sem(sim, i, PREDIO.SEM_ESGOTO) && !sem(sim, i, PREDIO.RACIONADO), `casa ${i}`);
    const ag = sim.agregados.redes.esgoto;
    // a oferta é a capacidade da ETE vezes o quadro de pessoal (0,6 a 1)
    assert.ok(ag.oferta > 0 && ag.oferta <= SERVICOS.ete.capacidade, `${ag.oferta}`);
    assert.ok(ag.demanda > 0 && ag.demanda < ag.oferta);
    assert.equal(estadoRede(sim, casas[0], 'esgoto'), 'ok');
    // a camada: a ETE é o produtor (4), as casas estão com esgoto (1)
    const camada = sim.q.camada('esgoto');
    assert.equal(camada.dados[ete], 4);
    assert.ok(casas.every((i) => camada.dados[i] === 1));
    assert.equal(camada.resumo.chave, 'camada.esgoto.resumo');
    assert.equal(camada.escala.unidade, 'm³/h');
    // com a ETE o bem-estar não tem o termo do esgoto
    const fatores = [];
    calcularBemEstar(sim, casas[0], fatores);
    assert.ok(!fatores.some((f) => f.id === 'esgoto'));
    // demolir a ETE: volta a faltar para todos
    assert.ok(sim.cmd('demolir', { refs: [P.ref(ete)] }).ok);
    sistemaRedes(sim);
    for (const i of casas) assert.ok(sem(sim, i, PREDIO.SEM_ESGOTO));
    assert.equal(sim.agregados.redes.esgoto.oferta, 0);
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('ETE pequena para a cidade: racionamento dos mais distantes; e com falta de verdade o abandono conta', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('esgoto-racao');
    const casas = povoar(sim, 'resBaixa', -520, -460, 90, 40);
    assert.ok(casas.length >= 10);
    const ete = servicoPronto(sim, 'ete', -760 + 60); // junto da ponta oeste
    const P = sim.tabelas.predios;
    // o pagamento da manutenção (D41) em fração: a ETE trata 40% do que as casas devolvem
    const total = soma(sim, casas, 'esgoto');
    sim.economia.eficiencia = () => (0.4 * total) / (0.6 * SERVICOS.ete.capacidade);
    sistemaRedes(sim);
    const cortadas = casas.filter((i) => sem(sim, i, PREDIO.SEM_ESGOTO));
    const ligadas = casas.filter((i) => !sem(sim, i, PREDIO.SEM_ESGOTO));
    assert.ok(cortadas.length > 0 && ligadas.length > 0, `${cortadas.length} cortadas, ${ligadas.length} ligadas`);
    for (const i of cortadas) assert.ok(sem(sim, i, PREDIO.RACIONADO), 'racionado, não sem rede');
    // o corte vai dos mais distantes da ETE: toda casa ligada está mais perto (em x) do que a mais próxima das cortadas
    const dist = (i) => Math.abs(P.x[i] - P.x[ete]);
    assert.ok(Math.max(...ligadas.map(dist)) <= Math.min(...cortadas.map(dist)) + 24, 'as pontas ficam sem');
    // com ETE na cidade a falta já conta: o aviso do prédio aparece depois de uma rodada dos prédios
    rodadas(sim, 2);
    assert.ok(cortadas.some((i) => P.avisos[i] & AV.SEM_ESGOTO), 'o aviso do prédio');
    assert.ok(cortadas.some((i) => P.problema[i] > 0), 'o contador do abandono anda');
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('o nível 2 pede esgoto, como a água e a energia', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('esgoto-nivel');
    const casas = povoar(sim, 'resBaixa', -520, -460, 40, 4);
    sistemaRedes(sim);
    assert.deepEqual(faltaParaNivel(sim, casas[0], 2), ['esgoto']);
    servicoPronto(sim, 'ete', -300);
    sistemaRedes(sim);
    assert.deepEqual(faltaParaNivel(sim, casas[0], 2), []);
  } finally {
    fecha();
  }
});
