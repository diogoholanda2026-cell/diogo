// Testes do bem-estar (S2a; D50, D11, D51): o A2 do bem-estar (água, energia, praça e comércio dão 60 ou menos; com
// saúde e educação passa de 61), a falta de água e de energia, a tarifa pela média do mês arredondada (30,4 dá 5; 30,5
// dá 8; 60,4 dá 8; 60,5 dá 11), a coluna predios.bemEstar que a tarifa por prédio lê, o efeito previsto da pintura na
// média, e o XP de bem-estar da D51 (20 mil moradores a 65 por 1 h dão de 600 a 1.200) com a S3a.
// Roda sozinho: node ferramentas/testes/bemestar.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { noPerto } from '../../fonte/sim/vias/grafo.js';
import { refDe, idxDaRef } from '../../fonte/contratos/espelho.js';
import { CELULA, PREDIO, TIPO_PREDIO } from '../../fonte/contratos/flags.js';
import { ORDEM } from '../../fonte/contratos/interno.js';
import { indiceZona } from '../../fonte/data/zonas.js';
import { HORA, RODADA } from '../../fonte/comum/relogio.js';
import { nascerNaFrente, terminarObra } from '../../fonte/sim/zonas/crescimento.js';
import { calcularBemEstar, sistemaBemEstar, BEM } from '../../fonte/sim/bemestar.js';
import { sistemaCargas } from '../../fonte/sim/servicos.js';
import { sistemaRedes } from '../../fonte/sim/redes.js';
import { familiaDe } from '../../fonte/sim/predios.js';
import { gerarCidadeSintetica, SINTETICA } from '../cidade-sintetica.mjs';

// ------------------------------------------------------------------------------------------------ apoio

/** Uma rua reta de 480 m com água e energia de produtores registrados no nó oeste (como o reservatório da X1b). */
function ruaComRedes(semente, { agua = 1000, energia = 1e6 } = {}) {
  const sim = criarSimulacao({ semente, modo: 'livre' });
  const plano = { modo: 'reta', tipo: 'rua', pontos: [[-760, -300], [-280, -300]], sessao: 1, encaixe: false };
  assert.ok(sim.cmd('via.construir', { plano }).ok);
  const N = sim.tabelas.nos;
  const no = noPerto(sim.grafo, -760, -300, 12);
  const ref = refDe(no, N.ger[no]);
  const prod = {};
  if (agua) prod.agua = sim.redes.produtor({ tipo: 'agua', ref: 1, capacidade: agua, no: ref });
  if (energia) prod.energia = sim.redes.produtor({ tipo: 'energia', ref: 2, capacidade: energia, no: ref });
  return { sim, prod };
}

const pintar = (sim, x, z, raio, zona) => assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'circulo', x, z, raio }, zona: indiceZona(zona) }).ok);

/** Faz nascer e termina na hora um prédio da zona numa frente livre (na ordem dos índices). */
function nascer(sim, zona, rng) {
  const C = sim.tabelas.celulas;
  const z = indiceZona(zona);
  for (let c = 0; c < C.n; c++) {
    if (!C.viva[c] || C.zona[c] !== z || C.linha[c] !== 0 || C.estado[c] !== CELULA.LIVRE) continue;
    const i = nascerNaFrente(sim, c, z, rng);
    if (i >= 0) {
      terminarObra(sim, i);
      return i;
    }
  }
  return -1;
}

/** Constrói um serviço perto de (x, z) pela prévia e termina a obra. */
function servico(sim, tipo, x, z) {
  const p = sim.q.construir.previa({ tipo, x, z, rot: 0 });
  assert.ok(p.ok, `${tipo}: ${p.codigo}`);
  const r = sim.cmd('construir', { tipo, x: p.x, z: p.z, rot: p.rot });
  assert.ok(r.ok, `${tipo}: ${r.codigo}`);
  terminarObra(sim, idxDaRef(r.id));
  return idxDaRef(r.id);
}

// ------------------------------------------------------------------------------------------------ D50

test('A2 do bem-estar (D50): água, energia, praça e comércio dão 60 ou menos; com saúde e educação passa de 61', () => {
  const { sim } = ruaComRedes('bem-a2');
  pintar(sim, -520, -270, 30, 'resBaixa');
  pintar(sim, -650, -270, 60, 'comBaixa');
  const rng = sim.rng('teste');
  const res = nascer(sim, 'resBaixa', rng);
  assert.ok(res >= 0);
  for (let k = 0; k < 8; k++) nascer(sim, 'comBaixa', rng);
  sistemaRedes(sim);
  const P = sim.tabelas.predios;
  assert.equal(P.flags[res] & (PREDIO.SEM_AGUA | PREDIO.SEM_ENERGIA), 0, 'com água e energia');
  // serviço ideal: a cidade toda empregada e o quadro de pessoal completo
  sim.json.cidade.desemprego = [0, 0, 0, 0];
  sim.json.cidade.ocupacao = [1, 1, 1, 1];
  servico(sim, 'praca', -500, -340);
  sistemaCargas(sim);
  const f1 = [];
  const b1 = calcularBemEstar(sim, res, f1);
  const termo = (f, id) => f.find((x) => x.id === id)?.v ?? 0;
  assert.ok(termo(f1, 'lazer') > 0 && termo(f1, 'comercio') > 0, JSON.stringify(f1));
  assert.ok(b1 <= 60, `sem saúde e educação: ${b1}`);
  servico(sim, 'clinica', -560, -340);
  servico(sim, 'escolaF', -420, -350);
  sistemaCargas(sim);
  const f2 = [];
  const b2 = calcularBemEstar(sim, res, f2);
  assert.ok(termo(f2, 'saude') > 7 && termo(f2, 'educacao') > 5, JSON.stringify(f2));
  assert.ok(b2 > 61, `com saúde e educação: ${b2} ${JSON.stringify(f2)}`);
  // o teto teórico sem saúde e educação é 40 + 6 + 4 = 50 (e os pesos da D50)
  assert.equal(BEM.base + 6 + BEM.comercio, 50);
  assert.deepEqual(sim.erros, []);
});

test('falta de água e de energia: -25 cada; a falta da cidade inteira não abandona a Vila (alerta da cidade)', () => {
  const { sim, prod } = ruaComRedes('bem-redes');
  pintar(sim, -520, -270, 30, 'resBaixa');
  const res = nascer(sim, 'resBaixa', sim.rng('teste'));
  sistemaRedes(sim);
  sim.json.cidade.desemprego = [0, 0, 0, 0];
  const com = calcularBemEstar(sim, res);
  sim.redes.remover(prod.agua);
  sistemaRedes(sim);
  const P = sim.tabelas.predios;
  assert.ok(P.flags[res] & PREDIO.SEM_AGUA);
  assert.equal(Math.round(calcularBemEstar(sim, res)), Math.round(Math.max(0, com - 25)));
  sim.redes.remover(prod.energia);
  sistemaRedes(sim);
  assert.ok(P.flags[res] & PREDIO.SEM_ENERGIA);
  assert.equal(calcularBemEstar(sim, res), Math.max(0, com - 50));
  // a Vila nasce sem água e sem energia: 10 min de jogo depois ninguém abandonou (a cidade não produz nada)
  const sim2 = criarSimulacao({ semente: 'bem-vila' });
  const pop = sim2.agregados.populacao;
  sim2.rodar(700, { sincrono: true });
  assert.equal(sim2.agregados.populacao, pop, 'a Vila segue inteira');
  const b = sim2.q.barra();
  assert.ok(b.alertas.some((a) => a.codigo === 'faltaAgua') && b.alertas.some((a) => a.codigo === 'faltaEnergia'));
  assert.equal(b.tarifa, 5, 'Vila sem água nem energia paga 5');
  assert.deepEqual(sim2.erros, []);
});

// ------------------------------------------------------------------------------------------------ D11

test('tarifa pela média do mês arredondada (D11): 30,4 dá 5; 30,5 dá 8; 60,4 dá 8; 60,5 dá 11; a média anda em 30 rodadas', () => {
  const sim = criarSimulacao({ semente: 'bem-d11' });
  const P = sim.tabelas.predios;
  const res = [];
  for (let i = 0; i < P.n; i++) if (P.viva[i] && familiaDe(sim, i) === 'res' && P.moradores[i]) res.push(i);
  assert.ok(res.length > 20);
  const fixar = (v) => {
    for (const i of res) P.bemEstar[i] = v;
  };
  for (const [v, tarifa] of [[30.4, 5], [30.5, 8], [60.4, 8], [60.5, 11]]) {
    sim.json.cidade.bemHist = [];
    fixar(v);
    for (let k = 0; k < BEM.rodadasMes; k++) sistemaBemEstar(sim);
    assert.equal(sim.agregados.tarifa, tarifa, `média ${v}`);
    assert.equal(sim.agregados.bemEstarTarifa, Math.round(v));
  }
  // suavizada em 1 mês: um salto de 70 para 20 só derruba a tarifa quando a média das 30 rodadas cai
  fixar(70);
  for (let k = 0; k < BEM.rodadasMes; k++) sistemaBemEstar(sim);
  fixar(20);
  sistemaBemEstar(sim);
  assert.equal(sim.agregados.tarifa, 11, 'uma rodada ruim não derruba a faixa');
  for (let k = 0; k < BEM.rodadasMes; k++) sistemaBemEstar(sim);
  assert.equal(sim.agregados.tarifa, 5);
  assert.equal(sim.json.cidade.bemHist.length, BEM.rodadasMes);
});

test('coluna predios.bemEstar (a tarifa por prédio da S3a lê) e o efeito previsto de uma pintura na média (q.zona.previa)', () => {
  const { sim } = ruaComRedes('bem-coluna');
  const P = sim.tabelas.predios;
  assert.ok(P.bemEstar instanceof Float32Array);
  sim.rodar(3 * RODADA, { sincrono: true });
  // a Vila (sem água nem energia) fica em 0; uma rua com redes promete 40 ou mais: a média sobe
  const pv = sim.q.zona.previa({ pincel: { modo: 'circulo', x: -520, z: -270, raio: 30 }, zona: indiceZona('resBaixa') });
  assert.ok(pv.celulas.length > 0);
  assert.ok(pv.efeitoMedia > 0, `efeito ${pv.efeitoMedia}`);
  const com = sim.q.zona.previa({ pincel: { modo: 'circulo', x: -520, z: -270, raio: 30 }, zona: indiceZona('comBaixa') });
  assert.equal(com.efeitoMedia, 0, 'comércio não entra na média do bem-estar');
  const h = sim.hash();
  sim.q.zona.previa({ pincel: { modo: 'circulo', x: -520, z: -270, raio: 30 }, zona: indiceZona('resBaixa') });
  assert.equal(sim.hash(), h, 'a prévia não muda o estado');
});

// ------------------------------------------------------------------------------------------------ D51

test('XP de bem-estar (D51): 20 mil moradores a 65 por 1 h de jogo dão de 600 a 1.200', () => {
  const sim = criarSimulacao({ semente: SINTETICA.semente });
  if (!sim.json.progresso || sim.json.progresso.bemMes === undefined) return; // sem a S3a: pendência dela
  gerarCidadeSintetica({ sim, predios: 1300 });
  const P = sim.tabelas.predios;
  // a cidade fica parada em 65: bem-estar e moradores fixos nos prédios residenciais (sem nascer, sem sair)
  const fixos = [];
  for (let i = 0; i < P.n; i++) if (P.viva[i] && P.tipo[i] === TIPO_PREDIO.ZONA && familiaDe(sim, i) === 'res') fixos.push([i, P.moradores[i]]);
  sim.registrarSistema(1, 0, (s) => {
    for (const [i, m] of fixos) {
      P.bemEstar[i] = 65;
      P.moradores[i] = m;
      P.flags[i] &= ~(PREDIO.ABANDONADO | PREDIO.OBRA);
    }
  }, 1, { nome: 'teste: cidade parada', ordem: ORDEM.cidade - 1 });
  sim.rodar(2 * RODADA, { sincrono: true });
  const pop = sim.agregados.populacao;
  assert.ok(pop > 16000 && pop < 24000, `moradores ${pop}`);
  const antes = sim.json.progresso.motivos.bemEstar ?? 0;
  sim.rodar(HORA, { sincrono: true });
  const xp = (sim.json.progresso.motivos.bemEstar ?? 0) - antes;
  const esperado = (sim.agregados.populacao * 15) / 2000 * 6; // 6 meses de calendário numa hora de jogo
  assert.ok(xp >= 600 && xp <= 1200, `XP de bem-estar ${xp.toFixed(0)} (conta ${esperado.toFixed(0)})`);
  assert.deepEqual(sim.erros, []);
});
