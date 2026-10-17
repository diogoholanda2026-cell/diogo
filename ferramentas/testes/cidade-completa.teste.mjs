// Testes da cidade completa do M1b (S2b; ficha S2b do PROJETO, D23, D50, D95): os 6 serviços novos (ETE, termelétrica,
// escola de ensino médio, parque, hospital e parque da orla) construídos pelo comando e funcionando nas redes e nas
// coberturas, as 3 zonas novas (residencial alta, comercial alta e escritório) ativas, com a moradia no padrão da D95, e a
// cidade inteira do M1b rodando sem erro, determinística e com o save igual. Antes do M1b esses tipos seguem trancados.
// Roda sozinho: node ferramentas/testes/cidade-completa.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idxDaRef } from '../../fonte/contratos/espelho.js';
import { PREDIO, TIPO_PREDIO } from '../../fonte/contratos/flags.js';
import { ZONAS, zonaNaParte, indiceZona } from '../../fonte/data/zonas.js';
import { PREDIOS, PREDIOS_ORDEM } from '../../fonte/data/predios.js';
import { SERVICOS, SERVICOS_ORDEM, COBERTURAS } from '../../fonte/data/servicos.js';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { zonaAtiva } from '../../fonte/sim/zonas/demanda.js';
import { terminarObra, nascerNaFrente } from '../../fonte/sim/zonas/crescimento.js';
import { sistemaRedes } from '../../fonte/sim/redes.js';
import { sistemaCargas, coberturaPredio, atratividadeDosServicos } from '../../fonte/sim/servicos.js';
import { calcularDemanda } from '../../fonte/sim/zonas/demanda.js';
import { arEm } from '../../fonte/sim/ambiente.js';
import { calcularBemEstar } from '../../fonte/sim/bemestar.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { abrirM1b, ruaComRedes, povoar, pintar, nascerVarios, rodadas } from './apoio-m1b.mjs';
import { criarEstrategia } from '../robo/robo-sim.mjs';
import { definirRegrasDeLugar } from '../../fonte/data/zon2.js';

// D112 (ZON2): este teste monta utilidades e indústria em qualquer ponto do mapa; as regras de lugar têm teste próprio (zon2.teste.mjs)
definirRegrasDeLugar(false);

const NOVOS = ['ete', 'termica', 'escolaM', 'hospital', 'parque', 'parqueG'];

/** Constrói pelo comando, perto de (x, z), e termina a obra. Devolve o idx. */
function construir(sim, tipo, x, z = -520) {
  const p = sim.q.construir.previa({ tipo, x, z, rot: 0 });
  assert.ok(p.ok, `${tipo}: ${p.codigo}`);
  const r = sim.cmd('construir', { tipo, x: p.x, z: p.z, rot: p.rot });
  assert.ok(r.ok, `${tipo}: ${r.codigo}`);
  const i = idxDaRef(r.id);
  terminarObra(sim, i);
  return i;
}

test('antes do M1b os 6 serviços e as 3 zonas novas seguem trancados; com o M1b entram no catálogo e na demanda', () => {
  const sim = criarSimulacao({ semente: 'cc-catalogo', modo: 'livre' });
  const tipos = [...sim.q.catalogo('servicos'), ...sim.q.catalogo('lazer')].map((x) => x.tipo);
  for (const t of NOVOS) assert.ok(!tipos.includes(t), `${t} é do M1b`);
  for (const z of ['resAlta', 'comAlta', 'escritorio']) {
    assert.equal(zonaNaParte(z), false);
    assert.equal(zonaAtiva(sim, z), false);
  }
  const fecha = abrirM1b();
  try {
    const sim2 = criarSimulacao({ semente: 'cc-catalogo', modo: 'livre' });
    const serv = sim2.q.catalogo('servicos');
    const lazer = sim2.q.catalogo('lazer');
    for (const t of ['ete', 'termica', 'escolaM', 'hospital']) assert.ok(serv.find((x) => x.tipo === t)?.liberado, t);
    for (const t of ['parque', 'parqueG']) assert.ok(lazer.find((x) => x.tipo === t)?.liberado, t);
    assert.deepEqual(lazer.map((x) => x.tipo), ['praca', 'parque', 'parqueG']);
    for (const z of ['resAlta', 'comAlta', 'escritorio']) assert.equal(zonaAtiva(sim2, z), true, z);
    assert.deepEqual(sim2.q.demanda().ativas.filter((z) => ['resAlta', 'comAlta', 'escritorio'].includes(z)), ['resAlta', 'comAlta', 'escritorio']);
    // sem o Modo livre o marco e o desbloqueio trancam: tudo no Canteiro (marco 0) fica fechado
    const normal = criarSimulacao({ semente: 'cc-catalogo' });
    const t2 = normal.q.catalogo('servicos');
    for (const t of ['ete']) assert.equal(t2.find((x) => x.tipo === t)?.liberado, true, 'a ETE abre no Canteiro (marco 0)');
    for (const t of ['termica', 'escolaM', 'hospital']) assert.equal(t2.find((x) => x.tipo === t)?.liberado, false, `${t} pede marco`);
    assert.equal(normal.q.catalogo('lazer').find((x) => x.tipo === 'parqueG').liberado, false);
  } finally {
    fecha();
  }
});

test('a ETE pede água a 40 m do fundo, como a captação; o resto dos 6 serviços se constrói e termina a obra', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('cc-construir');
    assert.equal(sim.q.construir.previa({ tipo: 'ete', x: -500, z: -520 }).codigo, 'agua');
    // na margem do rio da Vila (a mesma da captação) a ETE é aceita; a estrada de terra não leva canos
    const margem = sim.q.construir.previa({ tipo: 'ete', x: -955, z: 240, rot: 0 });
    assert.ok(margem.ok, margem.codigo);
    assert.equal(margem.semRede, true);
    assert.deepEqual(margem.efeitos, [{ camada: 'esgoto', delta: 0 }]);
    const caixa0 = sim.holding.caixa();
    const ids = {};
    let x = -736;
    let metade = 0;
    for (const t of ['termica', 'escolaM', 'hospital', 'parque', 'parqueG']) {
      const w = SERVICOS[t].planta[0];
      x += metade + w / 2 + 4;
      metade = w / 2;
      ids[t] = construir(sim, t, x);
    }
    const P = sim.tabelas.predios;
    for (const [t, i] of Object.entries(ids)) {
      assert.equal(P.tipo[i], TIPO_PREDIO.SERVICO);
      assert.ok(!(P.flags[i] & PREDIO.OBRA));
      assert.equal(sim.q.predio(P.ref(i)).id, t);
    }
    const gasto = Object.keys(ids).reduce((s, t) => s + SERVICOS[t].custo, 0);
    assert.equal(Math.round(caixa0 - sim.holding.caixa()), gasto);
    // a manutenção entra em sim.custos
    const manut = sim.custos.lista().find((c) => c.nome === 'servicos').valor;
    assert.equal(manut, Object.keys(ids).reduce((s, t) => s + SERVICOS[t].manutencaoHora, 0));
    assert.deepEqual(sim.validar(), []);
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('a termelétrica põe 50 MW na rede de energia, polui e o parque da orla dá atratividade', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('cc-termica', { energia: 0 });
    const casas = povoar(sim, 'resBaixa', -420, -460, 60, 10);
    sistemaRedes(sim);
    // a energia da rodovia não chega a esta rua (a rua não toca o nó de entrada): sem produtor todas ficam sem
    assert.ok(casas.every((i) => sim.tabelas.predios.flags[i] & PREDIO.SEM_ENERGIA));
    const t = construir(sim, 'termica', -700);
    sistemaRedes(sim);
    assert.ok(casas.every((i) => !(sim.tabelas.predios.flags[i] & PREDIO.SEM_ENERGIA)), 'ligadas à termelétrica');
    const P = sim.tabelas.predios;
    const ofer = sim.agregados.redes.energia.oferta;
    assert.ok(ofer > 0 && ofer <= SERVICOS.termica.capacidade, `${ofer} kW`);
    assert.equal(SERVICOS.termica.capacidade, 50000);
    // ela queima gás: é fonte de ar (e de ruído) na vizinhança
    rodadas(sim, 40);
    assert.ok(arEm(sim, P.x[t], P.z[t]) >= 100, `ar ${arEm(sim, P.x[t], P.z[t])}`);
    // o parque da orla: atratividade 3 no fator da demanda residencial
    assert.equal(atratividadeDosServicos(sim), 0);
    construir(sim, 'parqueG', -300);
    assert.equal(atratividadeDosServicos(sim), SERVICOS.parqueG.atratividade);
    const fatores = calcularDemanda(sim).fatores.res;
    assert.equal(fatores.find((f) => f.id === 'atratividade')?.v, 3);
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('hospital, escola de ensino médio e parque cobrem a rua pelo raio deles; a escola médio forma o nível 2', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('cc-cobertura');
    sim._sistemas.find((s) => s.nome === 'cidadaos').ativo = false;
    const casas = povoar(sim, 'resBaixa', -420, -460, 60, 10);
    const P = sim.tabelas.predios;
    for (const i of casas) {
      for (const cat of ['saude', 'educacao', 'lazer']) assert.equal(coberturaPredio(sim, i, cat), 0, cat);
    }
    const h = construir(sim, 'hospital', -700);
    const e = construir(sim, 'escolaM', -620);
    const p = construir(sim, 'parque', -540);
    sistemaCargas(sim);
    for (const i of casas) {
      assert.ok(coberturaPredio(sim, i, 'saude') > 0.5, 'hospital a 3 km pela via');
      assert.ok(coberturaPredio(sim, i, 'educacao') > 0.5, 'escola de ensino médio a 2,5 km');
      assert.ok(coberturaPredio(sim, i, 'lazer') > 0.3, 'parque a 600 m');
    }
    // eficiência: a carga está abaixo da capacidade
    for (const i of [h, e, p]) assert.ok(P.efic[i] > 0, `eficiência ${i}`);
    assert.equal(SERVICOS.escolaM.educa.join(), '1,2');
    // a escola médio leva o fundamental ao médio: o nível 2 dos moradores sobe com as rodadas
    const medio = (i) => P.estudo[4 * i + 2];
    const antes = casas.reduce((s, i) => s + medio(i), 0);
    for (const i of casas) for (let n = 0; n < 4; n++) P.estudo[4 * i + n] = [0, 1, 0, 0][n];
    rodadas(sim, 30);
    const depois = casas.reduce((s, i) => s + medio(i), 0);
    assert.ok(depois > antes + 0.1, `médio ${antes} -> ${depois}`);
    // o bem-estar pesa saúde, educação e lazer pela cobertura (sem rodar a economia)
    const fatores = [];
    calcularBemEstar(sim, casas[0], fatores);
    for (const id of ['saude', 'educacao', 'lazer']) assert.ok(fatores.find((f) => f.id === id)?.v > 0, id);
    assert.ok(COBERTURAS.includes('lazer'));
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('residencial alta, comercial alta e escritório: nascem, no padrão da D95, com as vagas e os andares do catálogo', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('cc-zonas');
    sim._sistemas.find((s) => s.nome === 'cidadaos').ativo = false;
    sim.json.cidade.ocupacao = [1, 1, 1, 1];
    const P = sim.tabelas.predios;
    const alta = povoar(sim, 'resAlta', -700, -460, 60, 3);
    const comAlta = povoar(sim, 'comAlta', -420, -460, 60, 3);
    const escr = povoar(sim, 'escritorio', -560, -460, 50, 3);
    assert.ok(alta.length >= 1 && comAlta.length >= 1 && escr.length >= 1, `${alta.length}, ${comAlta.length}, ${escr.length}`);
    for (const i of alta) {
      assert.equal(PREDIOS[PREDIOS_ORDEM[P.modelo[i]]].zona, 'resAlta');
      const nv = PREDIOS[PREDIOS_ORDEM[P.modelo[i]]].niveis[0];
      // torres: dezenas de andares e centenas de moradores (a faixa de andares da ZONAS é 30 a 60)
      assert.ok(nv.andares[0] >= ZONAS.resAlta.andares[0] && nv.moradores >= 300, `${nv.andares} andares, ${nv.moradores} moradores`);
      // D95: moradia no padrão classe média alta ou acima, nunca a casa de autoconstrução da Vila
      assert.ok(['torreVarandas', 'torreLuxo', 'torreVidro'].includes(nv.tipologia), nv.tipologia);
      assert.ok(P.moradores[i] > 0);
    }
    for (const i of comAlta) assert.ok(P.empregos[i] >= 0 && PREDIOS[PREDIOS_ORDEM[P.modelo[i]]].zona === 'comAlta');
    for (const i of escr) {
      const nv = PREDIOS[PREDIOS_ORDEM[P.modelo[i]]].niveis[0];
      // o escritório emprega quem estudou mais: metade das vagas pede médio ou superior
      assert.ok(nv.empregos[2] + nv.empregos[3] >= 0.7 * nv.empregos.reduce((a, b) => a + b, 0), JSON.stringify(nv.empregos));
    }
    // as zonas novas têm demanda própria: o painel traz os fatores delas
    sim.rodar(60, { sincrono: true });
    const d = sim.q.demanda();
    for (const z of ['resAlta', 'comAlta', 'escritorio']) assert.ok(Number.isFinite(d[z]), z);
    assert.ok(d.fatores.escritorio.length > 0 && d.fatores.comAlta.length > 0 && d.fatores.resAlta.length > 0);
    // a residencial alta só nasce no terreno que vale (valor mínimo 450): a regra da ZONAS
    assert.equal(ZONAS.resAlta.valor.min, 450);
    assert.equal(indiceZona('escritorio'), 6);
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('a cidade do M1b inteira roda sem erro, igual em duas partidas e igual depois de salvar e carregar', () => {
  const fecha = abrirM1b();
  try {
    const partida = () => {
      const { sim } = ruaComRedes('cc-inteira');
      povoar(sim, 'resBaixa', -560, -460, 60, 12);
      povoar(sim, 'resAlta', -440, -460, 40, 2);
      povoar(sim, 'comBaixa', -640, -460, 40, 3);
      povoar(sim, 'industria', -330, -460, 40, 3);
      pintar(sim, -300, -460, 30, 'escritorio');
      construir(sim, 'termica', -720);
      construir(sim, 'hospital', -620);
      construir(sim, 'parque', -500);
      return sim;
    };
    const a = partida();
    const b = partida();
    a.rodar(7 * 20 + 9, { sincrono: true });
    b.rodar(7 * 20 + 9, { sincrono: true });
    assert.equal(a.q.hash(), b.q.hash());
    const C = criarSimulacao({ semente: 'cc-inteira', modo: 'livre' });
    aplicarSave(C, migrar(lerSave(montarSave(a))));
    assert.equal(C.q.hash(), a.q.hash());
    a.rodar(300, { sincrono: true });
    C.rodar(300, { sincrono: true });
    b.rodar(300, { sincrono: true });
    assert.equal(C.q.hash(), a.q.hash());
    assert.equal(b.q.hash(), a.q.hash());
    for (const s of [a, b, C]) {
      assert.deepEqual(s.erros, []);
      assert.deepEqual(s.validar(), []);
    }
    // as camadas do M1b respondem na cidade inteira
    for (const id of ['esgoto', 'ar', 'ruido', 'empregos', 'valor', 'nivel']) assert.ok(a.q.camada(id), id);
    assert.ok(nascerNaFrente && nascerVarios);
  } finally {
    fecha();
  }
});

test('o robô do M1b constrói a ETE logo depois da água e da energia, antes de o bem-estar cair (meia hora de jogo)', () => {
  const fecha = abrirM1b();
  try {
    const sim = criarSimulacao({ semente: 'robo-1' });
    const est = criarEstrategia(sim, { m1b: true });
    const P = sim.tabelas.predios;
    const etes = () => {
      let n = 0;
      for (let i = 0; i < P.n; i++) if (P.viva[i] && P.tipo[i] === TIPO_PREDIO.SERVICO && P.modelo[i] === SERVICOS_ORDEM.indexOf('ete')) n++;
      return n;
    };
    let quando = -1;
    let menor = 100;
    for (let t = 0; t < 1800; t++) {
      if (t % 20 === 0) est.passo();
      sim.rodar(1, { sincrono: true });
      if (quando < 0 && etes() > 0) quando = t;
      if (t > 900 && sim.agregados.populacao > 0) menor = Math.min(menor, sim.agregados.bemEstarMedio);
    }
    assert.ok(quando > 0 && quando < 1200, `a ETE nasce nos primeiros 20 min (foi em ${quando})`);
    assert.ok(sim.agregados.redes.esgoto.oferta > 0, 'a ETE trata esgoto');
    assert.ok(menor >= 35, `o bem-estar não cai por falta de esgoto (menor ${menor})`);
    assert.ok(sim.json.objetivos.feitos.includes('cidade.esgoto'), 'o objetivo da ETE fecha');
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});
