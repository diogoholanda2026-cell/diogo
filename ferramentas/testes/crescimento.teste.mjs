// Testes do crescimento (S2a; seções 6.5 a 6.7 do desenho da simulação, D42, D48, D51): nascimento pela demanda nas
// frentes livres, de frente para a via, até 3 por tique e 60 obras abertas; obra que espera material no canteiro e
// retoma quando a Holding vende; níveis pelos pontos e pelos requisitos (o 3 pede saúde e educação na via); abandono
// da D42 (âmbar aos 180 tiques de problema, vermelho aos 360, abandono aos 600, prédio marcado sai na hora, e o
// abandonado sai 120 tiques depois que o problema some); determinismo (duas partidas e salvar no meio) e o tempo do
// tique com a cidade sintética de 40 mil moradores.
// Roda sozinho: node ferramentas/testes/crescimento.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { noPerto } from '../../fonte/sim/vias/grafo.js';
import { refDe, idxDaRef, conferirEspelho } from '../../fonte/contratos/espelho.js';
import { CELULA, PREDIO, TIPO_PREDIO } from '../../fonte/contratos/flags.js';
import { ORDEM } from '../../fonte/contratos/interno.js';
import { indiceZona } from '../../fonte/data/zonas.js';
import { RODADA } from '../../fonte/comum/relogio.js';
import { CRESCIMENTO, nascerNaFrente, terminarObra, sistemaPredios, frentesLivres } from '../../fonte/sim/zonas/crescimento.js';
import { AV, ABANDONO, acessoDe, piorAviso } from '../../fonte/sim/predios.js';
import { sistemaRedes } from '../../fonte/sim/redes.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { gerarCidadeSintetica, SINTETICA } from '../cidade-sintetica.mjs';

// ------------------------------------------------------------------------------------------------ apoio

const rua = (sim, pontos, tipo = 'rua') => {
  const r = sim.cmd('via.construir', { plano: { modo: 'reta', tipo, pontos, sessao: 1, encaixe: false } });
  assert.ok(r.ok, `${JSON.stringify(pontos)}: ${r.codigo}`);
  return r.dados.arestas.map((x) => idxDaRef(x));
};

const refNo = (sim, x, z) => {
  const n = noPerto(sim.grafo, x, z, 12);
  return refDe(n, sim.tabelas.nos.ger[n]);
};

const pintar = (sim, pincel, zona) => assert.ok(sim.cmd('zona.pintar', { pincel, zona: indiceZona(zona) }).ok);

/** Faz nascer um prédio da zona na primeira frente livre (na ordem dos índices); termina a obra se pedido. */
function nascer(sim, zona, rng, terminar = true) {
  const C = sim.tabelas.celulas;
  const z = indiceZona(zona);
  for (let c = 0; c < C.n; c++) {
    if (!C.viva[c] || C.zona[c] !== z || C.linha[c] !== 0 || C.estado[c] !== CELULA.LIVRE) continue;
    const i = nascerNaFrente(sim, c, z, rng);
    if (i >= 0) {
      if (terminar) terminarObra(sim, i);
      return i;
    }
  }
  return -1;
}

/** Demanda fixa em 100 nas zonas dadas (um sistema do teste antes do crescimento). */
function demandaFixa(sim, zonas) {
  sim.registrarSistema(1, 0, (s) => {
    for (const z of zonas) s.json.cidade.demanda[z] = 100;
  }, 1, { nome: 'teste: demanda fixa', ordem: ORDEM.zonas - 1 });
}

const invariantes = (sim) => {
  assert.deepEqual(sim.erros, []);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) }), []);
};

// ------------------------------------------------------------------------------------------------ nascimento

test('nascimento pela demanda: de frente para a via, em obra, até 3 por tique e 60 obras abertas; invariantes', () => {
  const sim = criarSimulacao({ semente: 'cres-nascer', modo: 'livre' });
  const ruas = [-380, -250, -120];
  for (const z of ruas) rua(sim, [[1000, z], [1560, z]]);
  pintar(sim, { modo: 'retangulo', x: 1000, z: -440, x2: 1560, z2: -60 }, 'resBaixa');
  demandaFixa(sim, ['resBaixa']);
  const P = sim.tabelas.predios;
  const vistos = new Set();
  for (let i = 0; i < P.n; i++) if (P.viva[i]) vistos.add(P.ref(i));
  let maxTique = 0;
  let maxObras = 0;
  const novos = [];
  for (let t = 0; t < 400; t++) {
    sim.rodar(1, { sincrono: true });
    let n = 0;
    let obras = 0;
    for (let i = 0; i < P.n; i++) {
      if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA) continue;
      if (P.flags[i] & PREDIO.OBRA && !(P.flags[i] & PREDIO.OBRA_NIVEL)) obras++;
      const ref = P.ref(i);
      if (vistos.has(ref)) continue;
      vistos.add(ref);
      n++;
      novos.push(ref);
      assert.ok(P.flags[i] & PREDIO.OBRA, 'nasce em obra');
      assert.equal(P.moradores[i], 0, 'nasce vazio');
    }
    maxTique = Math.max(maxTique, n);
    maxObras = Math.max(maxObras, obras);
  }
  assert.ok(novos.length > 40, `nasceram ${novos.length}`);
  assert.ok(maxTique <= CRESCIMENTO.maxPorTique, `${maxTique} num tique`);
  assert.ok(maxObras <= CRESCIMENTO.maxObras, `${maxObras} obras abertas`);
  // de frente para a via: a frente (+z girado por rot) aponta para a rua mais perto, e o acesso existe
  const AC = { e: -1, s: 0 };
  let vivos = 0;
  for (const ref of novos) {
    const i = idxDaRef(ref);
    if (!P.viva[i] || P.ref(i) !== ref) continue;
    vivos++;
    const zr = ruas.reduce((a, b) => (Math.abs(b - P.z[i]) < Math.abs(a - P.z[i]) ? b : a));
    assert.ok(Math.sign(zr - P.z[i]) === Math.sign(Math.round(Math.cos(P.rot[i]))), `prédio ${ref} de costas para a via`);
    acessoDe(sim, i, AC);
    assert.ok(AC.e >= 0, `prédio ${ref} sem acesso`);
  }
  assert.ok(vivos > 40);
  // obras terminam: depois de mais tempo há moradores nos novos
  sim.rodar(600, { sincrono: true });
  assert.ok(novos.some((ref) => P.moradores[idxDaRef(ref)] > 0), 'chegaram moradores');
  invariantes(sim);
});

test('zona de uma parte futura (M1b) não nasce, mesmo pintada e com demanda', () => {
  const sim = criarSimulacao({ semente: 'cres-trancada', modo: 'livre' });
  rua(sim, [[1000, -380], [1480, -380]]);
  // resAlta é do M1b: a pintura pode existir, mas nada nasce mesmo com demanda forçada
  const zAlta = indiceZona('resAlta');
  const C = sim.tabelas.celulas;
  const cels = [];
  for (let c = 0; c < C.n; c++) if (C.viva[c] && C.estado[c] === CELULA.LIVRE && Math.abs(C.z[c] + 380) < 60 && C.x[c] < 1460) cels.push(c);
  for (const c of cels) {
    C.zona[c] = zAlta;
    C.marcar(c);
  }
  demandaFixa(sim, ['resAlta']);
  const P = sim.tabelas.predios;
  const n0 = P.n;
  sim.rodar(200, { sincrono: true });
  let nasceu = 0;
  for (let i = n0; i < P.n; i++) if (P.viva[i] && P.zona[i] === zAlta) nasceu++;
  assert.equal(nasceu, 0);
  assert.equal(sim.json.cidade.acum.resAlta, 0);
  assert.ok(frentesLivres(sim).resAlta > 0, 'as frentes existem');
  assert.equal(sim.q.demanda().resAlta, 0);
  assert.ok(!sim.q.demanda().ativas.includes('resAlta'));
});

// ------------------------------------------------------------------------------------------------ obra e material

test('obra sem material (D48): fica no canteiro com o aviso e o alerta da cidade; retoma quando a Holding vende', () => {
  const sim = criarSimulacao({ semente: 'cres-material', modo: 'livre' });
  rua(sim, [[1000, -380], [1480, -380]]);
  pintar(sim, { modo: 'circulo', x: 1240, z: -350, raio: 30 }, 'resBaixa');
  const real = sim.holding.comprarParaObra;
  let pedidos = 0;
  sim.holding.comprarParaObra = () => {
    pedidos++;
    return { espera: true };
  };
  const P = sim.tabelas.predios;
  const i = nascer(sim, 'resBaixa', sim.rng('teste'), false);
  assert.ok(i >= 0);
  const ref = P.ref(i);
  assert.ok(P.flags[i] & PREDIO.SEM_MATERIAL && P.flags[i] & PREDIO.OBRA);
  sim.rodar(5 * RODADA, { sincrono: true });
  assert.ok(P.flags[i] & PREDIO.OBRA, 'segue em obra');
  assert.ok(P.avisos[i] & AV.SEM_MATERIAL, 'aviso de falta de material');
  assert.ok(pedidos >= 5, `tentou de novo a cada rodada (${pedidos})`);
  assert.ok(sim.q.barra().alertas.some((a) => a.codigo === 'obrasParadas'), 'alerta obras paradas');
  // a obra parada não termina: o fim fica sempre à frente
  assert.ok(P.obraFim[i] > sim.tique);
  sim.holding.comprarParaObra = real;
  sim.rodar(RODADA + 200, { sincrono: true });
  assert.equal(P.ref(i), ref);
  assert.ok(!(P.flags[i] & (PREDIO.OBRA | PREDIO.SEM_MATERIAL)), `terminou (flags ${P.flags[i]})`);
  sim.rodar(2 * RODADA, { sincrono: true });
  assert.ok(P.moradores[i] > 0);
  invariantes(sim);
});

// ------------------------------------------------------------------------------------------------ níveis

test('níveis: com água e energia sobe ao 2; o 3 pede saúde e educação na via (q.predio diz o que falta); evento predioNivel', () => {
  const sim = criarSimulacao({ semente: 'cres-nivel', modo: 'livre' });
  rua(sim, [[1000, -380], [1480, -380]]);
  sim.redes.produtor({ tipo: 'agua', ref: 1, capacidade: 1e5, no: refNo(sim, 1000, -380) });
  sim.redes.produtor({ tipo: 'energia', ref: 2, capacidade: 1e6, no: refNo(sim, 1000, -380) });
  pintar(sim, { modo: 'circulo', x: 1240, z: -350, raio: 30 }, 'resBaixa');
  const P = sim.tabelas.predios;
  const i = nascer(sim, 'resBaixa', sim.rng('teste'));
  assert.ok(i >= 0);
  sistemaRedes(sim);
  assert.equal(P.flags[i] & (PREDIO.SEM_AGUA | PREDIO.SEM_ENERGIA), 0);
  sim.json.cidade.desemprego = [0, 0, 0, 0];
  const niveis = [];
  sim.on('predioNivel', (d) => niveis.push(d));
  const rodada = () => sistemaPredios(sim, i % RODADA, RODADA);
  // pontos abaixo da meta: não sobe
  P.pontos[i] = 50;
  rodada();
  assert.equal(P.nivel[i], 1);
  P.pontos[i] = CRESCIMENTO.pontosPorNivel;
  rodada();
  assert.equal(P.nivel[i], 2);
  assert.ok(P.flags[i] & PREDIO.OBRA && P.flags[i] & PREDIO.OBRA_NIVEL, 'obra de nível');
  terminarObra(sim, i);
  sim._entregar(); // fora do tique a fila dos eventos sai aqui (no jogo, no fim do tique)
  assert.deepEqual(niveis, [{ ref: P.ref(i), nivel: 2 }]);
  // o 3 pede saúde e educação
  P.pontos[i] = 2 * CRESCIMENTO.pontosPorNivel;
  rodada();
  assert.equal(P.nivel[i], 2);
  const q = sim.q.predio(P.ref(i));
  assert.ok(q.nivelProx.falta.includes('saude') && q.nivelProx.falta.includes('educacao'), JSON.stringify(q.nivelProx));
  for (const [tipo, x] of [['clinica', 1160], ['escolaF', 1320]]) {
    const p = sim.q.construir.previa({ tipo, x, z: -340 });
    assert.ok(p.ok, `${tipo}: ${p.codigo}`);
    const r = sim.cmd('construir', { tipo, x: p.x, z: p.z, rot: p.rot });
    assert.ok(r.ok, r.codigo);
    terminarObra(sim, idxDaRef(r.id));
  }
  assert.deepEqual(sim.q.predio(P.ref(i)).nivelProx.falta, []);
  P.pontos[i] = 2 * CRESCIMENTO.pontosPorNivel;
  rodada();
  assert.equal(P.nivel[i], 3);
  terminarObra(sim, i);
  sim._entregar();
  assert.equal(niveis.at(-1).nivel, 3);
  // a capacidade cresce com o nível: quem chega enche o prédio maior
  const antes = P.moradores[i];
  rodada();
  assert.ok(P.moradores[i] >= antes);
  invariantes(sim);
});

// ------------------------------------------------------------------------------------------------ abandono (D42)

test('abandono (D42): âmbar aos 180 tiques de problema, vermelho aos 360, abandona aos 600; o marcado sai na hora; volta 120 depois', () => {
  const sim = criarSimulacao({ semente: 'cres-abandono', modo: 'livre' });
  rua(sim, [[1000, -380], [1480, -380]]);
  rua(sim, [[1000, -180], [1480, -180]]);
  // energia na rua dos prédios; a água da cidade está na outra rua, sem ligação: a falta é deste bairro
  sim.redes.produtor({ tipo: 'energia', ref: 2, capacidade: 1e6, no: refNo(sim, 1000, -380) });
  sim.redes.produtor({ tipo: 'agua', ref: 3, capacidade: 1e5, no: refNo(sim, 1000, -180) });
  pintar(sim, { modo: 'circulo', x: 1240, z: -350, raio: 40 }, 'resBaixa');
  const P = sim.tabelas.predios;
  const rng = sim.rng('teste');
  const a = nascer(sim, 'resBaixa', rng);
  const b = nascer(sim, 'resBaixa', rng);
  assert.ok(a >= 0 && b >= 0);
  const ra = P.ref(a);
  const rb = P.ref(b);
  P.flags[b] |= PREDIO.DEMOLIR_AO_ABANDONAR;
  const abandonados = [];
  const demolidos = [];
  sim.on('predioAbandonado', (d) => abandonados.push([d.ref, sim.tique]));
  sim.on('demolido', (d) => demolidos.push([d.refs, sim.tique]));
  let ambarCom = -1;
  let vermelhoCom = -1;
  let ultimo = 0;
  for (let t = 0; t < 700 && !(abandonados.some(([r]) => r === ra) && abandonados.some(([r]) => r === rb)); t++) {
    sim.rodar(1, { sincrono: true });
    if (!(P.flags[a] & PREDIO.ABANDONADO)) ultimo = P.problema[a];
    if (ambarCom < 0 && P.avisos[a] & AV.ABANDONO) ambarCom = P.problema[a];
    if (vermelhoCom < 0 && P.avisos[a] & AV.ABANDONO && piorAviso(P.avisos[a], P.problema[a]).g === 'grave') vermelhoCom = P.problema[a];
  }
  assert.equal(ambarCom, ABANDONO.ambar, 'âmbar aos 180');
  assert.equal(vermelhoCom, ABANDONO.vermelho, 'vermelho aos 360');
  assert.equal(ultimo, ABANDONO.abandona - RODADA, 'abandona na rodada em que o contador chega a 600');
  assert.ok(P.flags[a] & PREDIO.ABANDONADO);
  assert.equal(P.moradores[a], 0);
  assert.ok(P.avisos[a] & AV.ABANDONADO);
  // o marcado para sair saiu na hora
  assert.ok(abandonados.some(([r]) => r === rb));
  assert.ok(demolidos.some(([refs]) => refs.includes(rb)));
  assert.ok(!P.viva[idxDaRef(rb)] || P.ref(idxDaRef(rb)) !== rb);
  // enquanto falta água o abandonado fica (o abandonado não consome, mas a rede dele segue sem água): não sai para
  // nascer de novo e abandonar outra vez
  sim.rodar(ABANDONO.volta + 3 * RODADA, { sincrono: true });
  assert.ok(P.viva[a] && P.ref(a) === ra && P.flags[a] & PREDIO.ABANDONADO, 'o abandonado segue enquanto falta água');
  assert.ok(!demolidos.some(([refs]) => refs.includes(ra)));
  // um abandonado que a pintura de outra zona marca depois sai na rodada seguinte
  const outro = [];
  for (let i = 0; i < P.n; i++) if (i !== a && P.viva[i] && P.flags[i] & PREDIO.ABANDONADO) outro.push(i);
  assert.ok(outro.length > 0, 'há outro abandonado');
  const ro = P.ref(outro[0]);
  P.flags[outro[0]] |= PREDIO.DEMOLIR_AO_ABANDONAR;
  sim.rodar(RODADA + 1, { sincrono: true });
  assert.ok(demolidos.some(([refs]) => refs.includes(ro)), 'o abandonado marcado saiu');
  // a água chega ao bairro: 120 tiques depois o abandonado sai (o lote volta a nascer pela demanda)
  sim.redes.produtor({ tipo: 'agua', ref: 4, capacidade: 1e5, no: refNo(sim, 1000, -380) });
  const t0 = sim.tique;
  let saiu = -1;
  for (let t = 0; t < 300 && saiu < 0; t++) {
    sim.rodar(1, { sincrono: true });
    if (demolidos.some(([refs]) => refs.includes(ra))) saiu = sim.tique - t0;
  }
  // o contador anda por rodada: sai na sexta rodada sem problema (entre 100 e 160 tiques, conforme a fatia do prédio)
  assert.ok(saiu > ABANDONO.volta - RODADA && saiu <= ABANDONO.volta + 2 * RODADA, `saiu ${saiu} tiques depois`);
  invariantes(sim);
});

test('a primeira água na rua principal da Vila não abandona as casas das ruas de terra (D52: sem canos, a falta é da rua)', () => {
  const sim = criarSimulacao({ semente: 'cres-vila-agua' });
  const A = sim.tabelas.arestas;
  const P = sim.tabelas.predios;
  const e0 = idxDaRef(sim.json.mapa.ruas.principal[0]);
  sim.redes.produtor({ tipo: 'agua', ref: 1, capacidade: 30, no: refDe(A.a[e0], sim.tabelas.nos.ger[A.a[e0]]) });
  const pop = sim.agregados.populacao;
  sim.rodar(ABANDONO.abandona + 5 * RODADA, { sincrono: true });
  const vila = sim.json.mapa.predios.map((r) => idxDaRef(r));
  const naTerra = vila.filter((i) => P.flags[i] & PREDIO.SEM_AGUA);
  assert.ok(naTerra.length > 0, 'há casas da Vila sem canos na rua');
  for (const i of vila) assert.ok(!(P.flags[i] & PREDIO.ABANDONADO), `casa ${P.ref(i)} abandonada`);
  // o aviso aparece nelas (a água existe na cidade), mas o contador do abandono não anda
  for (const i of naTerra) {
    assert.ok(P.avisos[i] & AV.SEM_AGUA, 'aviso de falta de água');
    assert.equal(P.problema[i], 0);
  }
  assert.equal(sim.agregados.populacao, pop);
  assert.deepEqual(sim.erros, []);
});

// ------------------------------------------------------------------------------------------------ determinismo

/** Uma partida com o mesmo roteiro: vias, pintura, produtores e serviços; cresce pela demanda. */
function partida(semente) {
  const sim = criarSimulacao({ semente, modo: 'livre' });
  for (const z of [-380, -250]) rua(sim, [[1000, z], [1560, z]]);
  rua(sim, [[1280, -380], [1280, -250]]);
  sim.redes.produtor({ tipo: 'agua', ref: 1, capacidade: 5000, no: refNo(sim, 1000, -380) });
  sim.redes.produtor({ tipo: 'energia', ref: 2, capacidade: 50000, no: refNo(sim, 1000, -380) });
  pintar(sim, { modo: 'retangulo', x: 1000, z: -440, x2: 1270, z2: -190 }, 'resBaixa');
  pintar(sim, { modo: 'retangulo', x: 1290, z: -440, x2: 1560, z2: -190 }, 'comBaixa');
  const p = sim.q.construir.previa({ tipo: 'praca', x: 1160, z: -320 });
  if (p.ok) sim.cmd('construir', { tipo: 'praca', x: p.x, z: p.z, rot: p.rot });
  return sim;
}

test('determinismo: duas partidas iguais dão o mesmo hash; salvar no meio e carregar segue igual', () => {
  const A = partida('cres-det');
  const B = partida('cres-det');
  A.rodar(900, { sincrono: true });
  B.rodar(900, { sincrono: true });
  assert.equal(A.q.hash(), B.q.hash());
  assert.ok(A.agregados.populacao > 0);
  // save no meio: a partida carregada tem o mesmo hash e segue igual
  const C = criarSimulacao({ semente: 'cres-det', modo: 'livre' });
  aplicarSave(C, migrar(lerSave(montarSave(A))));
  assert.equal(C.q.hash(), A.q.hash());
  A.rodar(700, { sincrono: true });
  C.rodar(700, { sincrono: true });
  assert.equal(C.q.hash(), A.q.hash());
  assert.equal(C.agregados.populacao, A.agregados.populacao);
  assert.deepEqual(C.erros, []);
  assert.deepEqual(A.erros, []);
});

// ------------------------------------------------------------------------------------------------ tempo do tique

test('tempo do tique com a cidade sintética de uns 40 mil moradores (meta p95 abaixo de 4 ms no Node; anotado)', (t) => {
  const agora = () => performance.now();
  const sim = criarSimulacao({ semente: SINTETICA.semente, cronometro: agora });
  gerarCidadeSintetica({ sim, predios: 2600, cronometro: agora });
  sim.rodar(1, { sincrono: true }); // primeiro tique: monta os índices (cobertura, redes, frentes)
  const tempos = [];
  for (let k = 0; k < 400; k++) {
    const a = agora();
    sim.rodar(1, { sincrono: true });
    tempos.push(agora() - a);
  }
  const v = tempos.sort((x, y) => x - y);
  const p95 = v[Math.floor(0.95 * v.length)];
  t.diagnostic(`${sim.agregados.populacao} moradores: p95 ${p95.toFixed(2)} ms, máximo ${v.at(-1).toFixed(2)} ms`);
  assert.ok(sim.agregados.populacao > 30000, `moradores ${sim.agregados.populacao}`);
  // folga de 3 vezes sobre a meta para não falhar numa máquina ocupada (a bancada da entrega mede de verdade)
  assert.ok(p95 < 12, `p95 ${p95.toFixed(2)} ms`);
  assert.deepEqual(sim.erros, []);
});
