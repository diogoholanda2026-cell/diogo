// Testes das zonas e da demanda (S2a; D23, D76, seções 6.4 e 10.2 do desenho da simulação): o registro extensível (4
// zonas no M1a, 3 no M1b, sem código especial por zona), a faixa de andares da D76 no catálogo (residencial média de 3 a
// 6 andares no nível 1 até 12 a 25 no 5, comercial baixa menor, residencial alta de 30 a 60 pronta para o M1b), a
// demanda por zona (trancada pelo marco e pela parte, com os fatores; a indústria sem rodovia perde), o valor do
// terreno (grade de 32 m que sobe perto de serviço) e as camadas Zonas, Nível e Valor.
// Roda sozinho: node ferramentas/testes/zonas.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { idxDaRef } from '../../fonte/contratos/espelho.js';
import { RODADA } from '../../fonte/comum/relogio.js';
import { ZONAS, ZONAS_ORDEM, FAMILIAS_ZONA, PARTE_ATUAL, zonaNaParte, zonasDaFamilia, indiceZona, REQUISITOS_NIVEL } from '../../fonte/data/zonas.js';
import { PREDIOS, modelosDaZona, nivelDoModelo } from '../../fonte/data/predios.js';
import { zonaAtiva, valorEm, VALOR } from '../../fonte/sim/zonas/demanda.js';
import { terminarObra } from '../../fonte/sim/zonas/crescimento.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const rua = (sim, pontos, tipo = 'rua') => {
  const r = sim.cmd('via.construir', { plano: { modo: 'reta', tipo, pontos, sessao: 1, encaixe: false } });
  assert.ok(r.ok, `${JSON.stringify(pontos)}: ${r.codigo}`);
  return r.dados.arestas.map((x) => idxDaRef(x));
};

// ------------------------------------------------------------------------------------------------ registro

test('registro extensível: 4 zonas no M1a e 3 no M1b, cada uma com família, parte, marco, andares e divisão da demanda', () => {
  assert.equal(PARTE_ATUAL, 'M1a');
  assert.equal(ZONAS_ORDEM[0], '');
  const m1a = ZONAS_ORDEM.filter((id) => id && zonaNaParte(id));
  assert.deepEqual(m1a, ['resBaixa', 'resMedia', 'comBaixa', 'industria']);
  assert.deepEqual(ZONAS_ORDEM.filter((id) => id && !zonaNaParte(id)), ['resAlta', 'comAlta', 'escritorio']);
  for (const id of ZONAS_ORDEM.slice(1)) {
    const z = ZONAS[id];
    assert.ok(FAMILIAS_ZONA[z.familia], `${id}: família`);
    assert.ok(Number.isInteger(z.marco) && z.marco >= 0, `${id}: marco`);
    assert.ok(z.andares[0] >= 1 && z.andares[1] >= z.andares[0], `${id}: andares`);
    assert.equal(z.split.length, 4, `${id}: divisão por estudo`);
    assert.ok(z.taxa > 0 && Number.isFinite(z.valor.peso) && Number.isFinite(z.valor.min), `${id}: taxa e valor`);
    assert.ok(typeof z.faz === 'string' && !/[—–]/.test(z.faz) && !/\bdia\b/i.test(z.faz), `${id}: texto`);
  }
  // todas as famílias têm zona; a residencial tem as três densidades
  for (const f of Object.keys(FAMILIAS_ZONA)) assert.ok(zonasDaFamilia(f).length > 0, f);
  assert.deepEqual(zonasDaFamilia('res'), ['resBaixa', 'resMedia', 'resAlta']);
  // requisitos de nível iguais para todas as zonas (2 a 5)
  assert.equal(REQUISITOS_NIVEL.length, 6);
  assert.deepEqual(REQUISITOS_NIVEL[3].servicos, ['saude', 'educacao']);
});

test('sem código especial por zona: a simulação da cidade lê o registro (nenhum id de zona no código da S2a)', () => {
  const arquivos = [
    'fonte/sim/predios.js', 'fonte/sim/cidadaos.js', 'fonte/sim/bemestar.js', 'fonte/sim/servicos.js', 'fonte/sim/redes.js',
    'fonte/sim/zonas/demanda.js', 'fonte/sim/zonas/crescimento.js',
  ];
  const ids = ZONAS_ORDEM.slice(1).join('|');
  const re = new RegExp(`['"\`](${ids})['"\`]`);
  for (const a of arquivos) {
    const txt = readFileSync(join(RAIZ, a), 'utf8');
    const linhas = txt.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && re.test(l));
    assert.deepEqual(linhas, [], `${a} cita uma zona pelo nome`);
  }
});

test('andares da D76 no catálogo: residencial média de 3 a 6 no nível 1 até 12 a 25 no 5; comercial baixa menor; alta de 30 a 60', () => {
  const faixa = (zona, n) => {
    let min = Infinity;
    let max = 0;
    for (const m of modelosDaZona(zona)) {
      const nv = nivelDoModelo(m, n);
      min = Math.min(min, nv.andares[0]);
      max = Math.max(max, nv.andares[1]);
    }
    return [min, max];
  };
  assert.deepEqual(faixa('resMedia', 1), [3, 6]);
  assert.deepEqual(faixa('resMedia', 5), [12, 25]);
  for (let n = 1; n < 5; n++) assert.ok(faixa('resMedia', n + 1)[1] >= faixa('resMedia', n)[1], `resMedia cresce do ${n} ao ${n + 1}`);
  // dentro da faixa do registro
  for (const id of ZONAS_ORDEM.slice(1)) {
    const ms = modelosDaZona(id);
    if (!ms.length) continue;
    const [lo, hi] = ZONAS[id].andares;
    for (let n = 1; n <= 5; n++) {
      const [a, b] = faixa(id, n);
      assert.ok(a >= lo && b <= hi, `${id} nível ${n}: ${a} a ${b} fora de ${lo} a ${hi}`);
    }
  }
  // comercial baixa acompanha menor: do térreo a 6 andares
  assert.ok(faixa('comBaixa', 5)[1] <= 6 && faixa('comBaixa', 5)[1] < faixa('resMedia', 5)[1]);
  assert.ok(faixa('comBaixa', 1)[0] >= 1);
  // residencial alta pronta para o M1b
  assert.ok(modelosDaZona('resAlta').length > 0);
  assert.ok(faixa('resAlta', 1)[0] >= 30 && faixa('resAlta', 5)[1] === 60);
  // o prédio maior abriga mais gente: a média nível 5 passa da média nível 1 e da baixa
  const mor = (id, n) => Math.max(...modelosDaZona(id).map((m) => nivelDoModelo(m, n).moradores ?? 0));
  assert.ok(mor('resMedia', 5) > 2 * mor('resMedia', 1));
  assert.ok(mor('resMedia', 1) > mor('resBaixa', 1));
  for (const m of modelosDaZona('resMedia')) assert.equal(PREDIOS[m].niveis.length, 5);
});

// ------------------------------------------------------------------------------------------------ demanda

test('demanda: marco e parte trancam (campanha); no Modo livre o M1a todo abre; fatores por zona e famílias R, C, I', () => {
  const sim = criarSimulacao({ semente: 'zonas-demanda' });
  sim.rodar(2 * RODADA, { sincrono: true });
  const d = sim.q.demanda();
  // marco 0: residencial baixa, comercial baixa e indústria; a média pede o marco 2; o M1b fica fora
  assert.deepEqual(d.ativas, ['resBaixa', 'comBaixa', 'industria']);
  for (const id of ['resMedia', 'resAlta', 'comAlta', 'escritorio']) assert.equal(d[id], 0, id);
  assert.equal(d.E, 0);
  for (const k of ['R', 'C', 'I']) assert.ok(d[k] >= 0 && d[k] <= 100, k);
  const ids = d.fatores.resBaixa.map((f) => f.id);
  for (const f of ['base', 'vagas', 'desemprego', 'vazias', 'impulso', 'parte']) assert.ok(ids.includes(f), `fator ${f}`);
  assert.deepEqual(d.fatores.resMedia, []);
  // a residencial baixa leva toda a fatia da família enquanto a média está trancada
  assert.equal(d.fatores.resBaixa.find((f) => f.id === 'parte').v, 100);
  const livre = criarSimulacao({ semente: 'zonas-demanda', modo: 'livre' });
  livre.rodar(2 * RODADA, { sincrono: true });
  assert.deepEqual(livre.q.demanda().ativas, ['resBaixa', 'resMedia', 'comBaixa', 'industria']);
  assert.ok(zonaAtiva(livre, 'resMedia') && !zonaAtiva(livre, 'resAlta'));
  // a média divide a fatia residencial com a baixa (pelo estudo dos moradores)
  const fl = livre.q.demanda().fatores;
  const parte = (id) => fl[id].find((f) => f.id === 'parte').v;
  assert.ok(parte('resMedia') > 0 && parte('resBaixa') < 100 && parte('resBaixa') + parte('resMedia') >= 99, JSON.stringify(fl.resMedia));
  const h = livre.hash();
  livre.q.demanda();
  assert.equal(livre.hash(), h, 'a consulta não muda o estado');
});

test('indústria sem ligação com a rodovia perde demanda (D52); sem indústria pintada não há o fator', () => {
  const sim = criarSimulacao({ semente: 'zonas-rodovia', modo: 'livre' });
  sim.rodar(RODADA, { sincrono: true });
  assert.ok(!sim.q.demanda().fatores.industria.some((f) => f.id === 'rodovia'));
  // uma rua solta, sem ligação com a Vila nem com a rodovia, pintada de indústria
  rua(sim, [[-760, -300], [-280, -300]]);
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'circulo', x: -520, z: -270, raio: 60 }, zona: indiceZona('industria') }).ok);
  sim.rodar(RODADA, { sincrono: true });
  const f = sim.q.demanda().fatores.industria;
  assert.ok(f.some((x) => x.id === 'rodovia' && x.v < 0), JSON.stringify(f));
  // o fator é da família que pede a rodovia (a residencial não perde)
  assert.ok(!sim.q.demanda().fatores.resBaixa.some((x) => x.id === 'rodovia'));
});

// ------------------------------------------------------------------------------------------------ valor do terreno

test('valor do terreno: grade de 256 x 256 de 32 m, base 100; sobe perto de um serviço pela via; longe não muda', () => {
  const sim = criarSimulacao({ semente: 'zonas-valor', modo: 'livre' });
  const g = sim.grades.valor;
  assert.equal(g.n, VALOR.n);
  assert.equal(g.passo, 32);
  assert.equal(g.dados.length, 256 * 256);
  rua(sim, [[-760, -300], [-280, -300]]);
  sim.rodar(3 * RODADA, { sincrono: true });
  const perto = valorEm(sim, -520, -330);
  const longe = valorEm(sim, 3000, -3000);
  assert.ok(perto >= VALOR.base, `perto da via ${perto}`);
  const p = sim.q.construir.previa({ tipo: 'clinica', x: -520, z: -330 });
  const r = sim.cmd('construir', { tipo: 'clinica', x: p.x, z: p.z, rot: p.rot });
  assert.ok(r.ok, r.codigo);
  terminarObra(sim, idxDaRef(r.id));
  sim.rodar(6 * RODADA, { sincrono: true });
  assert.ok(valorEm(sim, -520, -270) > perto + 10, `com a clínica: ${valorEm(sim, -520, -270)} (antes ${perto})`);
  assert.ok(Math.abs(valorEm(sim, 3000, -3000) - longe) < 1e-3, 'longe não muda');
  assert.equal(valorEm(sim, 1e6, 0), 0, 'fora da grade');
  // efeito de área com número inválido não envenena a grade (o NaN ficaria nela para sempre pela suavização)
  sim.cidade.efeito('teste', { valor: NaN, bemEstar: '5', demanda: { resBaixa: Infinity, comBaixa: 2 } });
  assert.deepEqual(sim.cidade.lista(), [{ id: 'teste', demanda: { comBaixa: 2 } }]);
  sim.rodar(RODADA, { sincrono: true });
  assert.ok(g.dados.every((v) => Number.isFinite(v)));
  sim.cidade.remover('teste');
  // camada Valor: a grade inteira, de 0 a 1.000, com a marca do nível 5
  const c = sim.q.camada('valor');
  assert.equal(c.fonte, 'grade');
  assert.equal(c.dados.length, 256 * 256);
  assert.ok(c.legenda.some((x) => x.v === REQUISITOS_NIVEL[5].valor));
  assert.deepEqual(sim.erros, []);
});

test('camadas Zonas e Nível: só as zonas da parte atual na legenda; contagem por nível; pintura aparece na camada', () => {
  const sim = criarSimulacao({ semente: 'zonas-camadas', modo: 'livre' });
  rua(sim, [[-760, -300], [-280, -300]]);
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'circulo', x: -520, z: -270, raio: 40 }, zona: indiceZona('resMedia') }).ok);
  const z = sim.q.camada('zonas');
  assert.equal(z.fonte, 'celulas');
  assert.deepEqual(z.legenda.map((x) => x.chave), ['zona.resBaixa', 'zona.resMedia', 'zona.comBaixa', 'zona.industria']);
  assert.ok([...z.dados].some((v) => v === indiceZona('resMedia')));
  assert.ok(z.resumo.params.pintadas > 0);
  const n = sim.q.camada('nivel');
  assert.equal(n.fonte, 'predios');
  const P = sim.tabelas.predios;
  let zona = 0;
  for (let i = 0; i < P.n; i++) if (P.viva[i] && P.tipo[i] === 0) zona++;
  const p = n.resumo.params;
  assert.equal(p.n1 + p.n2 + p.n3 + p.n4 + p.n5, zona);
});
