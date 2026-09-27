// Testes do núcleo da simulação (F0): sorteio, tabelas, diário, save, livro, tarefas do worker, aplainar de
// referência, grafo, caminhos, grade espacial, altura, Bézier e relógio. Roda sozinho:
// node ferramentas/testes/nucleo.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proximo, semear, Rng } from '../../fonte/comum/rng.js';
import { fnv1a, fnv1aTexto, hexHash } from '../../fonte/comum/hash.js';
import { calendario, horaDoCeu, faseDaHora, ANO, MES, HORA, VELOCIDADES } from '../../fonte/comum/relogio.js';
import * as bz from '../../fonte/comum/bezier.js';
import { alturaEm, amostrar } from '../../fonte/comum/altura.js';
import { montarCSR, Dijkstra, dijkstra, aEstrela, ORCAMENTO_NOS } from '../../fonte/comum/caminhos.js';
import { HeapMin } from '../../fonte/comum/heap.js';
import { jsonCanonico, sen, cos, atan, atan2, exp, log, pot, hipot } from '../../fonte/comum/util.js';
import { fnv1aTipado } from '../../fonte/comum/hash.js';
import { Tabela, REF_BASE } from '../../fonte/sim/tabela.js';
import { GradeEspacial } from '../../fonte/sim/grade.js';
import { criarSim } from '../../fonte/sim/nucleo.js';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { reproduzir } from '../../fonte/sim/livro.js';
import { aplainarReferencia } from '../../fonte/sim/substitutos.js';
import { normalizarForma } from '../../fonte/sim/formas.js';
import { montarSave, lerSave, migrar, aplicarSave, abrirSave, salvar, comprimir, descomprimir, hashEstado } from '../../fonte/sim/salvar/formato.js';
import { criarTrabalhadorSimulado } from '../../fonte/sim/trabalhador.js';
import * as grafo from '../../fonte/sim/vias/grafo.js';
import { ANEL_DIARIO } from '../../fonte/contratos/espelho.js';

// sorteio próprio dos testes (fora da simulação)
function sorteio(semente = 1) {
  let a = semente >>> 0 || 1;
  return () => {
    a ^= a << 13;
    a >>>= 0;
    a ^= a >>> 17;
    a ^= a << 5;
    a >>>= 0;
    return a / 4294967296;
  };
}

const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

// ------------------------------------------------------------------------------------------------ comum

test('rng: xoshiro128** confere com a referência e os fluxos são independentes', () => {
  const s = new Uint32Array([1, 2, 3, 4]);
  assert.deepEqual([proximo(s), proximo(s), proximo(s)], [11520, 0, 5927040]);
  const a = new Rng(semear('heldopolis-1', 'crescimento'));
  const b = new Rng(semear('heldopolis-1', 'crescimento'));
  const c = new Rng(semear('heldopolis-1', 'cidadaos'));
  const va = Array.from({ length: 50 }, () => a.u32());
  assert.deepEqual(va, Array.from({ length: 50 }, () => b.u32()));
  assert.notDeepEqual(va, Array.from({ length: 50 }, () => c.u32()));
  // o estado continua de onde parou (é o que vai no save)
  const copia = new Rng(Uint32Array.from(a.s));
  assert.equal(copia.u32(), a.u32());
  let min = Infinity;
  let max = -Infinity;
  const cont = [0, 0, 0];
  for (let i = 0; i < 20000; i++) {
    const f = a.f();
    assert.ok(f >= 0 && f < 1);
    const k = a.int(3, 7);
    min = Math.min(min, k);
    max = Math.max(max, k);
    cont[a.escolher([1, 0, 3])]++;
  }
  assert.deepEqual([min, max], [3, 7]);
  assert.equal(cont[1], 0);
  assert.ok(Math.abs(cont[2] / cont[0] - 3) < 0.3);
  assert.equal(a.escolher([0, 0]), -1);
});

test('hash: FNV-1a e JSON canônico', () => {
  assert.equal(fnv1a(new Uint8Array([97])), 0xe40c292c);
  assert.equal(fnv1aTexto('a'), 0xe40c292c);
  assert.equal(fnv1aTexto('é'), fnv1a(new TextEncoder().encode('é')));
  assert.equal(hexHash(255), '000000ff');
  assert.equal(jsonCanonico({ b: 1, a: [2, { d: 0, c: 1 }] }), '{"a":[2,{"c":1,"d":0}],"b":1}');
  assert.throws(() => jsonCanonico({ x: NaN }));
  assert.throws(() => jsonCanonico({ x: new Float32Array(2) }));
});

test('matemática determinística: perto do Math e com os mesmos bits sempre (Node x navegador)', () => {
  const ulp = (a, b) => (a === b ? 0 : Math.abs(a - b) / (Math.max(Math.abs(a), Math.abs(b)) * 2.220446049250313e-16));
  const r = sorteio(99);
  let pior = 0;
  for (let i = 0; i < 20000; i++) {
    const x = (r() - 0.5) * 400;
    pior = Math.max(pior, ulp(sen(x), Math.sin(x)), ulp(cos(x), Math.cos(x)), ulp(atan(x), Math.atan(x)));
    pior = Math.max(pior, ulp(atan2(x, 1.3 - x), Math.atan2(x, 1.3 - x)), ulp(exp(x / 10), Math.exp(x / 10)), ulp(log(Math.abs(x) + 1), Math.log(Math.abs(x) + 1)));
  }
  assert.ok(pior <= 2, `erro de ${pior} ulp`);
  assert.equal(atan2(0, -1), Math.PI);
  assert.equal(atan2(-0, -1), -Math.PI);
  assert.equal(pot(2, 10), 1024);
  assert.equal(pot(10, -2), 0.01);
  assert.equal(hipot(3, 4), 5);
  // os bits de saída em pontos fixos (se um motor der outro resultado, o save e o robô divergem)
  const xs = [];
  for (let i = 0; i < 400; i++) xs.push((i - 200) * 0.7310585786300049 + i * i * 1e-3);
  const f = (fn) => fnv1aTipado(Float64Array.from(xs.map(fn)));
  assert.deepEqual(
    { sen: f(sen), cos: f(cos), atan: f(atan), atan2: f((x) => atan2(x, 3.1 - x)), exp: f((x) => exp(x / 10)), log: f((x) => log(Math.abs(x) + 1e-3)), pot: f((x) => pot(Math.abs(x) + 0.5, 0.37)) },
    { sen: 1456433015, cos: 1591809859, atan: 1915970019, atan2: 3303266775, exp: 4045553178, log: 2444835564, pot: 1262109336 },
  );
});

test('relógio: calendário, hora do céu e fases (D7, D9)', () => {
  assert.deepEqual([MES, ANO, HORA], [600, 7200, 3600]);
  assert.deepEqual([...VELOCIDADES], [0, 1, 2, 4]);
  assert.deepEqual(calendario(0), { mes: 1, ano: 1, fracMes: 0, tiqueNoMes: 0, mesAbs: 0 });
  const c = calendario(ANO + MES + 300);
  assert.deepEqual([c.mes, c.ano, c.fracMes], [2, 2, 0.5]);
  assert.equal(horaDoCeu(0), 7);
  assert.equal(horaDoCeu(300), 19);
  assert.equal(faseDaHora(7), 'manha');
  assert.equal(faseDaHora(13), 'tarde');
  assert.equal(faseDaHora(17.5), 'fimDeTarde');
  assert.equal(faseDaHora(21), 'noite');
  assert.equal(faseDaHora(3), 'noite');
});

test('bezier: comprimento, divisão, ponto mais perto e cruzamentos', () => {
  const r = bz.reta(0, 0, 90, 0);
  assert.ok(Math.abs(bz.comprimento(r) - 90) < 1e-6);
  const q = bz.deQuadratica(0, 0, 50, 50, 100, 0);
  const tab = bz.tabelaArco(q);
  assert.ok(tab[16] > 100 && tab[16] < 141.5);
  const t = bz.tDoArco(tab, tab[16] / 2);
  assert.ok(Math.abs(t - 0.5) < 1e-3); // simétrica
  const [a, b] = bz.dividir(q, 0.3);
  const p = bz.ponto(q, 0.3);
  assert.ok(Math.abs(a[6] - p[0]) < 1e-9 && Math.abs(b[1] - p[1]) < 1e-9);
  assert.ok(Math.abs(bz.comprimento(a) + bz.comprimento(b) - tab[16]) < 0.05);
  const m = bz.maisPerto(q, 50, 60);
  assert.ok(Math.abs(m.t - 0.5) < 1e-3 && Math.abs(m.d - 35) < 0.01);
  const x = bz.cruzamentos(bz.reta(-10, 0, 10, 0), bz.reta(0, -10, 0, 10));
  assert.equal(x.length, 1);
  assert.ok(Math.abs(x[0][0] - 0.5) < 1e-3 && Math.abs(x[0][1] - 0.5) < 1e-3);
  assert.equal(bz.cruzamentos(bz.reta(0, 0, 10, 0), bz.reta(0, 5, 10, 5)).length, 0);
});

test('altura: bilinear única (D4)', () => {
  const n = 3;
  const t = { n, passo: 8, origem: [0, 0], altura: Float32Array.from([0, 8, 16, 0, 8, 16, 4, 12, 20]) };
  assert.equal(alturaEm(t, 8, 0), 8); // na amostra
  assert.equal(alturaEm(t, 4, 0), 4); // no meio de x
  assert.equal(alturaEm(t, 8, 12), 10); // no meio de z entre 8 e 12
  assert.equal(alturaEm(t, -100, -100), 0); // fora: borda
  assert.equal(alturaEm(t, 16, 16), 20); // canto de baixo
  assert.equal(amostrar(new Float32Array([0, 1, 2, 3]), 2, 1, 0, 0, 0.5, 0.5), 1.5);
});

test('heap e caminhos: Dijkstra fatiado dá o mesmo que o inteiro; A* dá o custo mínimo', () => {
  const h = new HeapMin(2);
  for (const k of [5, 1, 4, 2, 3]) h.push(k * 10, k);
  assert.deepEqual([h.pop(), h.pop(), h.pop(), h.pop(), h.pop(), h.pop()], [10, 20, 30, 40, 50, -1]);
  // grade 40 x 40 com pesos sorteados
  const L = 40;
  const r = sorteio(7);
  const de = [];
  const para = [];
  const peso = [];
  for (let i = 0; i < L * L; i++) {
    const x = i % L;
    const z = (i / L) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= L || nz >= L) continue;
      de.push(i);
      para.push(nz * L + nx);
      peso.push(60 + r() * 60);
    }
  }
  const g = montarCSR(L * L, de, para, peso);
  const inteiro = dijkstra(g, [0, 1234]);
  const fatiado = new Dijkstra(g).iniciar([0, 1234]);
  let passos = 0;
  while (!fatiado.passo(97)) passos++;
  assert.ok(passos > 5);
  assert.deepEqual(Array.from(fatiado.dist), Array.from(inteiro.dist));
  assert.deepEqual(Array.from(fatiado.origem), Array.from(inteiro.origem));
  const x = Float64Array.from({ length: L * L }, (_, i) => (i % L) * 60);
  const z = Float64Array.from({ length: L * L }, (_, i) => ((i / L) | 0) * 60);
  const um = dijkstra(g, [0]);
  const ae = aEstrela(g, 0, L * L - 1, { x, z, fator: 1 });
  assert.ok(Math.abs(ae.custo - um.dist[L * L - 1]) < 1e-9);
  let soma = 0;
  for (const k of ae.ligacoes) soma += g.peso[k];
  assert.ok(Math.abs(soma - ae.custo) < 1e-9);
  assert.equal(g.de[ae.ligacoes[0]], 0);
  // incremental: uma fonte nova só melhora
  const base = dijkstra(g, [0]);
  const inc = new Dijkstra(g);
  inc.dist.set(base.dist);
  inc.origem.set(base.origem);
  inc.iniciar([L * L - 1], { manter: true, rotulos: [1] });
  inc.passo(Infinity);
  assert.deepEqual(Array.from(inc.dist), Array.from(dijkstra(g, [0, L * L - 1]).dist));
  assert.equal(ORCAMENTO_NOS, 4000);
});

test('grade espacial: consulta sem repetição e em ordem crescente', () => {
  const g = new GradeEspacial();
  g.inserir(9, -10, -10, 200, 10);
  g.inserir(2, 0, 0, 5, 5);
  g.inserir(5, 100, 0, 130, 5);
  assert.deepEqual(Array.from(g.consultar(-20, -20, 150, 20)), [2, 5, 9]);
  g.remover(9);
  assert.deepEqual(Array.from(g.consultar(-20, -20, 150, 20)), [2, 5]);
  g.inserir(2, 1000, 1000, 1010, 1010); // reinserir move
  assert.deepEqual(Array.from(g.consultar(-20, -20, 20, 20)), []);
  assert.equal(g.maisPerto(1005, 1005, 30, () => 3).id, 2);
});

// ------------------------------------------------------------------------------------------------ tabelas e diário

test('tabela: menor vaga livre, ger, n e crescimento por dobra no meio (D19)', () => {
  let realocou = 0;
  const t = new Tabela('t', { x: Float64Array, dono: [Int32Array, 1, -1], p: [Float32Array, 3] }, 2, { aoCrescer: () => realocou++ });
  const a = t.alocar();
  const b = t.alocar();
  t.x[a] = 1;
  t.x[b] = 2;
  const ra = t.ref(a);
  const c = t.alocar(); // cresce no meio
  assert.equal(realocou, 1);
  assert.equal(t.cap, 4);
  assert.deepEqual([a, b, c, t.n], [0, 1, 2, 3]);
  assert.deepEqual([t.x[0], t.x[1], t.dono[c]], [1, 2, -1]);
  t.p[3 * c + 2] = 7;
  t.liberar(a);
  assert.equal(t.vivaRef(ra), false);
  assert.equal(t.n, 3);
  const d = t.alocar(); // reaproveita a menor vaga, com a geração nova
  assert.equal(d, 0);
  assert.equal(t.ger[d], 1);
  assert.equal(t.ref(d), REF_BASE);
  assert.equal(t.x[d], 0);
  t.liberar(c);
  assert.equal(t.n, 2); // n encolhe
  t.liberar(b);
  assert.equal(t.n, 1);
  assert.equal(t.alocar(), 1);
  assert.equal(t.alocar(), 2);
  assert.equal(t.ger[2], 1); // a vaga 2 já foi usada
  assert.equal(t.p[3 * 2 + 2], 0);
  const cheia = new Tabela('c', { x: Uint8Array }, 1, { teto: 2 });
  assert.deepEqual([cheia.alocar(), cheia.alocar(), cheia.alocar()], [0, 1, -1]);
});

test('diário: deduplicação no lote, anel cheio vira tudo, realocado e releitura do espelho', () => {
  const sim = criarSim({ semente: 'diario' });
  const t = sim.registrarTabela('predios', { x: Float64Array }, 4, { diario: true });
  sim.espelho.predios = t;
  const v0 = sim.mudancas.desde(-1).versao;
  for (let i = 0; i < 10; i++) t.alocar();
  for (let k = 0; k < 50; k++) t.marcar(3); // mesmo lote: uma marca só
  const d1 = sim.mudancas.desde(v0);
  assert.deepEqual(Array.from(d1.predios), [...Array(10).keys()]);
  assert.ok(d1.realocado.includes('predios'));
  assert.equal(d1.n.predios, 10);
  assert.equal(d1.versao - v0, 10 + t.realocacoes); // 10 marcas e as dobras
  // lotes diferentes: sem repetição na saída
  sim.rodar(1);
  t.marcar(3);
  sim.rodar(1);
  t.marcar(3);
  t.marcar(4);
  const d2 = sim.mudancas.desde(d1.versao);
  assert.deepEqual(Array.from(d2.predios).sort((a, b) => a - b), [3, 4]);
  assert.equal(d2.realocado.length, 0);
  // um consumidor que relê o espelho a cada quadro vê os valores certos mesmo com a tabela crescendo no meio
  const copia = new Map();
  let versao = -1;
  sim.registrarSistema(1, 0, (s) => {
    const i = t.alocar();
    t.x[i] = s.tique * 10;
    t.marcar(i);
  }, 1, { nome: 'cresce' });
  for (let q = 0; q < 40; q++) {
    sim.rodar(3);
    const d = sim.mudancas.desde(versao);
    versao = d.versao;
    const P = sim.espelho.predios; // relido a cada quadro
    if (d.tudo.predios) for (let i = 0; i < P.n; i++) copia.set(i, P.x[i]);
    else for (const i of d.predios) copia.set(i, P.x[i]);
  }
  for (let i = 0; i < t.n; i++) if (i >= 10) assert.equal(copia.get(i), t.x[i]);
  assert.ok(t.realocacoes >= 4);
  // anel estourado: o domínio pede refazer tudo
  const vel = sim.mudancas.versao;
  for (let k = 0; k < ANEL_DIARIO + 10; k++) {
    sim.mudancas.marcarRet('terreno', 0, 0, k, k);
  }
  const d3 = sim.mudancas.desde(vel);
  assert.equal(d3.tudo.terreno, true);
  assert.equal(d3.terreno.length, 0);
  assert.equal(d3.tudo.predios, false);
  assert.equal(sim.mudancas.desde(-1).tudo.predios, true);
  // versão de outra simulação (o app trocou a partida): acima da atual, pede tudo
  assert.equal(sim.mudancas.desde(sim.mudancas.versao + 1000).tudo.predios, true);
  assert.equal(sim.mudancas.desde(sim.mudancas.versao).tudo.predios, false);
});

// ------------------------------------------------------------------------------------------------ simulação de teste

/**
 * Monta uma simulação de teste com estado de vários tipos: tabela, JSON, sorteio, grafo, formas, comando e uma tarefa
 * do worker pedida a cada 7 tiques.
 */
function simDeTeste({ trabalhador = null, semente = 'teste-nucleo' } = {}) {
  const sim = criarSimulacao({ semente, trabalhador, dominios: false });
  const est = sim.registrarJson('teste', { soma: 0, n: 0, lista: [] });
  const vals = sim.registrarTabela('valores', { v: Float64Array, k: [Int32Array, 2, -1] }, 8);
  sim.tarefas.registrar('prova', {
    aplicar: (s, saida, pedido) => {
      est.soma = (est.soma * 31 + saida.soma[0] + pedido.tique) % 1000000007;
      est.n++;
    },
  });
  sim.registrarSistema(1, 0, (s) => {
    const r = s.rng('mexe');
    const i = vals.alocar();
    vals.v[i] = r.f() * 100;
    vals.k[2 * i] = s.tique;
    if (vals.vivos > 30) vals.liberar(r.int(0, vals.n - 1));
  }, 1, { nome: 'mexe', ordem: 100 });
  sim.registrarSistema(7, 3, (s) => {
    const r = s.rng('pede');
    const valores = new Float64Array(3000);
    for (let i = 0; i < valores.length; i++) valores[i] = r.f() * 1000 + vals.v[i % Math.max(1, vals.n)];
    s.tarefas.pedir('prova', { valores, tique: s.tique });
  }, 1, { nome: 'pede', ordem: 200 });
  sim.registrarComando('teste.soma', (s, { n }) => {
    if (!Number.isInteger(n)) return 'valor';
    est.soma += n * s.rng('comando').int(1, 9);
    est.lista.push(n);
    s.holding.pagar(n, 'teste');
    return { ok: true };
  }, { foraDoContrato: true });
  const G = sim.grafo;
  const a = grafo.addNo(G, 0, 0);
  const b = grafo.addNo(G, 112, 0);
  const c = grafo.addNo(G, 112, 112);
  grafo.addAresta(G, a, b, 'rua');
  grafo.addAresta(G, b, c, 'avenida', [150, 40]);
  sim.formas.registrar({ tipo: 'plataforma', ref: 3, contorno: [10, 10, 30, 10, 30, 40, 10, 40], cota: 4.5 });
  return sim;
}

test('comandos entre tiques e reprodução do livro dão o mesmo hash (D17)', () => {
  const A = simDeTeste();
  const r = sorteio(3);
  assert.equal(A.cmd('teste.soma', { n: 1 }).ok, true); // pausado também aplica
  for (let k = 0; k < 40; k++) {
    A.rodar(1 + Math.floor(r() * 9));
    A.cmd('teste.soma', { n: Math.floor(r() * 100) });
    if (k % 5 === 0) A.cmd('velocidade', { v: k % 4 }); // não entra no livro nem no estado
    if (k % 7 === 0) assert.equal(A.cmd('teste.soma', { n: 0.5 }).codigo, 'valor');
  }
  A.rodar(13);
  assert.equal(A.cmd('nao.existe', {}).codigo, 'comando');
  assert.ok(A.livro.entradas.every((e) => e[2] === 'teste.soma'));
  const B = simDeTeste();
  const rep = reproduzir(B, A.livro.entradas, A.tique);
  assert.equal(B.tique, A.tique);
  assert.equal(rep.recusados.length, 6);
  assert.equal(B.q.hash(), A.q.hash());
  assert.deepEqual(A.erros, []);
});

test('consultas não mudam o hash', () => {
  const sim = simDeTeste();
  sim.rodar(30);
  const h = sim.q.hash();
  sim.q.barra();
  sim.q.hash();
  sim.q.camada('zonas');
  sim.mudancas.desde(-1);
  assert.equal(sim.q.hash(), h);
});

test('caixa nunca negativo no substituto da Holding (D41)', () => {
  const sim = simDeTeste();
  const r = sorteio(11);
  for (let i = 0; i < 10000; i++) {
    const v = Math.floor(r() * 200000);
    const antes = sim.holding.caixa();
    if (r() < 0.6) {
      const ok = sim.holding.pagar(v, 'teste');
      assert.equal(ok, v <= antes);
    } else sim.holding.receber(v / 3, 'teste');
    assert.ok(sim.holding.caixa() >= 0);
  }
  assert.equal(sim.holding.pagar(-5), false);
  assert.equal(sim.holding.pagar(NaN), false);
  assert.deepEqual(sim.validar(), []);
});

test('save: ida e volta com hash igual, seguindo igual depois; save danificado é recusado', async () => {
  const A = simDeTeste();
  A.rodar(95);
  A.cmd('teste.soma', { n: 42 });
  A.rodar(3);
  assert.ok(A.tarefas.pendentes.length > 0); // tarefa pendente no meio do save
  const gz = await salvar(A, { nome: 'teste', criado: 1 });
  const cru = montarSave(A);
  assert.equal(gz[0], 0x1f);
  assert.ok(gz.length < cru.length);
  const { sim: B, cab, erros } = await abrirSave(gz, (op) => simDeTeste(op));
  assert.deepEqual(erros, []);
  assert.equal(cab.tique, 98);
  assert.equal(B.tique, A.tique);
  assert.equal(B.q.hash(), A.q.hash());
  assert.equal(B.velocidade, 0); // abre pausado (D10)
  assert.deepEqual(B.livro.entradas, A.livro.entradas);
  A.rodar(200);
  B.rodar(200);
  assert.equal(B.q.hash(), A.q.hash());
  // o mesmo pelas funções soltas e com a semente conferida
  const C = simDeTeste();
  aplicarSave(C, migrar(lerSave(montarSave(A))));
  assert.equal(C.q.hash(), A.q.hash());
  assert.throws(() => aplicarSave(simDeTeste({ semente: 'outra' }), lerSave(montarSave(A))), /semente/);
  // danificado
  const ruim = cru.slice();
  ruim[0] = 0;
  assert.throws(() => lerSave(ruim), /não é um save/);
  assert.throws(() => lerSave(cru.subarray(0, 100)), /cortado/);
  const truncado = await comprimir(cru.subarray(0, cru.length - 64));
  await assert.rejects(() => abrirSave(truncado, (op) => simDeTeste(op)), /cortado/);
  assert.deepEqual(await descomprimir(await comprimir(cru)), cru);
  assert.equal(hashEstado(A), A.hash());
});

test('save: os agregados lidos entre uma soma e outra voltam iguais (economia segue igual depois de carregar)', () => {
  // prédios mudam depois da soma da rodada (tique 19) e o save sai no meio da rodada seguinte: a partida carregada
  // precisa dos agregados salvos, não de uma soma nova
  const criar = (op = {}) => criarSimulacao({ semente: 'agregados', dominios: false, ...op });
  const A = criar();
  const P = A.tabelas.predios;
  const novo = (moradores) => {
    const i = P.alocar();
    P.tipo[i] = 0;
    P.nivel[i] = 1;
    P.moradores[i] = moradores;
    P.marcar(i);
  };
  for (let k = 0; k < 5; k++) novo(100);
  A.rodar(22);
  assert.equal(A.agregados.populacao, 500);
  for (let k = 0; k < 3; k++) novo(100); // entra na soma só no tique 39
  A.rodar(3);
  const B = criar();
  aplicarSave(B, lerSave(montarSave(A)));
  assert.equal(B.agregados, B.json.agregados);
  assert.equal(B.agregados.populacao, 500);
  assert.equal(B.q.hash(), A.q.hash());
  A.rodar(40);
  B.rodar(40);
  assert.equal(A.agregados.populacao, 800);
  assert.equal(B.q.hash(), A.q.hash());
  assert.equal(B.holding.caixa(), A.holding.caixa());
});

test('save: seção JSON com Map, Set ou objeto de classe é recusada (sumiria sem mudar o hash)', () => {
  const sim = criarSim({ semente: 'mapa' });
  const est = sim.registrarJson('teste', { lista: [] });
  est.porNome = new Map([['a', 1]]);
  assert.throws(() => montarSave(sim), /Map/);
  assert.throws(() => sim.q.hash(), /Map/);
  est.porNome = { a: 1 };
  est.conjunto = new Set([1]);
  assert.throws(() => montarSave(sim), /Set/);
  delete est.conjunto;
  assert.ok(montarSave(sim).length > 0);
});

test('comando dentro do tique é recusado (D17); de um ouvinte, entre tiques, vale', () => {
  const sim = simDeTeste();
  let dentro = null;
  sim.registrarSistema(10, 4, (s) => {
    dentro = s.cmd('teste.soma', { n: 1 });
  }, 1, { nome: 'mau' });
  let fora = null;
  sim.on('velocidade', () => {
    fora = sim.cmd('teste.soma', { n: 2 });
  });
  sim.rodar(10);
  assert.equal(dentro.ok, false);
  assert.equal(dentro.codigo, 'erro');
  assert.ok(sim.erros.some((e) => /dentro do tique/.test(e.mensagem)));
  assert.ok(!sim.livro.entradas.some((e) => e[3].n === 1));
  sim.cmd('velocidade', { v: 1 });
  assert.equal(fora.ok, true);
});

test('registros: camada fora do contrato, tabela com o nome de um sinal do diário, coluna que o save não grava', () => {
  const sim = criarSim({ semente: 'registros' });
  assert.throws(() => sim.camadas.registrar('inventada', () => null), /fora do contrato/);
  sim.camadas.registrar('zonas', () => ({ id: 'zonas' }));
  assert.equal(sim.q.camada('zonas').id, 'zonas');
  assert.throws(() => sim.registrarTabela('entregas', { item: Uint16Array }, 8, { diario: true }), /diário já tem/);
  assert.ok(sim.registrarTabela('entregas', { item: Uint16Array }, 8)); // sem diário, vale
  assert.throws(() => new Tabela('t', { x: Array }), /save não grava/);
  assert.throws(() => new Tabela('t', { x: Uint8ClampedArray }), /save não grava/);
  assert.equal(new Tabela('t', { x: Uint8Array }).teto, REF_BASE); // ref = idx + ger x 2^20 não repete
  assert.throws(() => sim.registrarGrade('g', { dados: new BigInt64Array(4) }), /array tipado do save/);
});

test('tempo do espelho anda com a fração entre tiques (sol sem degrau)', () => {
  const sim = criarSim({ semente: 'tempo' });
  sim.cmd('velocidade', { v: 1 });
  assert.equal(sim.avancar(500), 0);
  const t = sim.espelho.tempo;
  assert.equal(t.frac, 0.5);
  assert.equal(t.tique, 0);
  assert.ok(Math.abs(t.hora - (7 + (24 * 0.5) / 600)) < 1e-12);
  assert.equal(sim.avancar(600), 1);
  assert.equal(t.tique, 1);
  assert.ok(Math.abs(t.frac - 0.1) < 1e-9);
  assert.ok(Math.abs(t.hora - (7 + (24 * 1.1) / 600)) < 1e-9);
});

test('tarefas: a resposta de outra simulação no mesmo worker é ignorada; desligar solta o worker', () => {
  const ouvintes = new Set();
  const enviados = [];
  const w = {
    addEventListener: (tipo, fn) => tipo === 'message' && ouvintes.add(fn),
    removeEventListener: (tipo, fn) => tipo === 'message' && ouvintes.delete(fn),
    postMessage: (msg) => enviados.push(msg),
  };
  const A = simDeTeste({ trabalhador: w });
  const B = simDeTeste({ trabalhador: w });
  assert.equal(ouvintes.size, 2);
  const valores = new Float64Array([1, 2, 3]);
  A.tarefas.pedir('prova', { valores });
  B.tarefas.pedir('prova', { valores: new Float64Array([9]) });
  assert.equal(enviados.length, 2);
  assert.notEqual(enviados[0].sessao, enviados[1].sessao);
  // o worker responde ao pedido de A: só A aceita, mesmo com o mesmo id em B
  const resposta = { id: enviados[0].id, sessao: enviados[0].sessao, saida: { soma: new Float64Array([5]), n: 3 } };
  for (const fn of ouvintes) fn({ data: resposta });
  assert.equal(A.tarefas.pendentes.at(-1).estado, 'pronta');
  assert.equal(B.tarefas.pendentes.at(-1).estado, 'enviada');
  // B descartada: sai dos ouvintes e o que estava com o worker é refeito aqui
  B.tarefas.desligar();
  assert.equal(ouvintes.size, 1);
  assert.equal(B.tarefas.trabalhador, null);
  assert.notEqual(B.tarefas.pendentes.at(-1).estado, 'enviada');
});

// o worker simulado da F0: responde pela mesma função pura, com atraso sorteado, e pode morrer depois de n pedidos
const trabalhadorFalso = ({ atrasoMax = 12, morrerDepois = Infinity, semente = 5 } = {}) =>
  criarTrabalhadorSimulado({ atrasoMax, morrerDepois, semente: `teste-${semente}` });

async function jogarComTrabalhador(sim, N) {
  sim.cmd('velocidade', { v: 3 });
  let paradas = 0;
  let guarda = 0;
  while (sim.tique < N && guarda++ < 20000) {
    const n = sim.avancar(Math.min(500, (N - sim.tique) * 250));
    if (!n) paradas++;
    await dormir(1);
  }
  return paradas;
}

test('worker simulado com atraso aleatório dá o hash do Node (D15)', async () => {
  const N = 240;
  const comAtraso = simDeTeste({ trabalhador: trabalhadorFalso({ atrasoMax: 15 }) });
  const paradas = await jogarComTrabalhador(comAtraso, N);
  const node = simDeTeste();
  node.rodar(comAtraso.tique);
  assert.ok(comAtraso.tique >= N);
  assert.equal(comAtraso.q.hash(), node.q.hash());
  assert.ok(paradas > 0, 'o tique devia ter parado esperando o worker ao menos uma vez');
  // o worker morre no meio: a thread principal refaz em fatias e o resultado é o mesmo
  const morto = simDeTeste({ trabalhador: trabalhadorFalso({ atrasoMax: 8, morrerDepois: 6, semente: 9 }) });
  await jogarComTrabalhador(morto, N);
  const node2 = simDeTeste();
  node2.rodar(morto.tique);
  assert.equal(morto.tarefas.morto, true);
  assert.equal(morto.q.hash(), node2.q.hash());
  assert.deepEqual([...node.erros, ...comAtraso.erros, ...morto.erros], []);
});

// ------------------------------------------------------------------------------------------------ aplainar

test('aplainar de referência: comutativo bit a bit, com save no meio e cava (D5)', () => {
  const n = 65;
  const r = sorteio(21);
  const base = { n, passo: 8, origem: [-256, -256], altura: Float32Array.from({ length: n * n }, () => 5 + r() * 10) };
  const formas = [
    { tipo: 'plataforma', ref: 10, contorno: [-60, -40, -10, -40, -10, 10, -60, 10], cota: 7.25 },
    { tipo: 'via', ref: 4, eixo: [-200, -20, 6, 0, -5, 9, 200, 30, 11], meiaLargura: 8 },
    { tipo: 'cava', ref: 99, contorno: [20, -80, 120, -80, 140, 20, 30, 40], cota: -3 },
    { tipo: 'plataforma', ref: 11, contorno: [-12, -30, 18, -30, 18, 5, -12, 5], cota: 8 },
  ];
  // estado incremental: registra uma forma e recalcula só o retângulo que ela suja
  const jogar = (ordem, { salvarNoMeio = false } = {}) => {
    let sim = criarSim({ semente: 'aplainar' });
    const grade = base.altura.slice();
    const refazer = (ret) => aplainarReferencia(base, sim.formas.tocando(...ret), ret, grade);
    let v = sim.mudancas.desde(-1).versao;
    const sujos = () => {
      const d = sim.mudancas.desde(v);
      v = d.versao;
      for (const ret of d.terreno) refazer(ret);
    };
    ordem.forEach((k, i) => {
      if (salvarNoMeio && i === 2) {
        const bytes = montarSave(sim);
        const novo = criarSim({ semente: 'aplainar' });
        aplicarSave(novo, lerSave(bytes));
        sim = novo;
        v = sim.mudancas.desde(-1).versao;
      }
      sim.formas.registrar(formas[k]);
      sujos();
    });
    return { grade, sim };
  };
  const a = jogar([0, 1, 2, 3]).grade;
  const b = jogar([3, 2, 1, 0]).grade;
  const c = jogar([2, 0, 3, 1], { salvarNoMeio: true }).grade;
  const d = aplainarReferencia(base, formas.map(normalizarForma), [-256, -256, 256, 256], base.altura.slice());
  assert.deepEqual(new Uint8Array(a.buffer), new Uint8Array(b.buffer));
  assert.deepEqual(new Uint8Array(a.buffer), new Uint8Array(c.buffer));
  assert.deepEqual(new Uint8Array(a.buffer), new Uint8Array(d.buffer));
  // a cava baixa o chão e a plataforma fica na cota
  const idx = (x, z) => ((z + 256) / 8) * n + (x + 256) / 8;
  assert.equal(a[idx(80, -40)], -3);
  assert.equal(a[idx(-40, -24)], 7.25);
  assert.notEqual(a[idx(-240, 240)], 0);
  assert.equal(a[idx(-240, 240)], base.altura[idx(-240, 240)]); // longe de tudo, a base
  // demolir recalcula: tirar uma forma e refazer dá o mesmo que nunca ter tido
  const { grade: g2, sim: s2 } = jogar([0, 1, 2, 3]);
  let v = s2.mudancas.desde(-1).versao;
  s2.formas.removerRef('via', 4);
  for (const ret of s2.mudancas.desde(v).terreno) aplainarReferencia(base, s2.formas.tocando(...ret), ret, g2);
  const semVia = jogar([0, 2, 3]).grade;
  assert.deepEqual(new Uint8Array(g2.buffer), new Uint8Array(semVia.buffer));
});

// ------------------------------------------------------------------------------------------------ grafo

test('grafo: addAresta, dividir, fundir, remover, componentes e cortes pelo raio do nó', () => {
  const sim = criarSimulacao({ semente: 'grafo', dominios: false });
  const G = sim.grafo;
  const A = G.arestas;
  const N = G.nos;
  const a = grafo.addNo(G, 0, 0);
  const b = grafo.addNo(G, 224, 0);
  const e = grafo.addAresta(G, a, b, 'rua');
  assert.equal(A.comp[e], 224);
  assert.deepEqual([A.corte[2 * e], A.corte[2 * e + 1]], [0, 1]); // pontas: raio 0
  const m = grafo.dividir(G, e, 0.5);
  assert.equal(N.x[m], 112);
  assert.equal(N.grau[m], 2);
  assert.equal(N.raio[m], 0); // segue reto com o mesmo tipo
  const c = grafo.addNo(G, 112, 112);
  const e3 = grafo.addAresta(G, m, c, 'avenida', [100, 40], [120, 80]);
  assert.equal(N.raio[m], 12 + 2); // cruzamento: maior meia largura (avenida) + 2 m
  for (const x of grafo.arestasDoNo(G, m)) {
    const t = A.a[x] === m ? A.corte[2 * x] : 1 - A.corte[2 * x + 1];
    assert.ok(t > 0.05, 'a pista recua do nó');
  }
  assert.ok(A.corte[2 * e3] < A.corte[2 * e3 + 1]);
  // componente separado e fusão
  const d = grafo.addNo(G, 500, 500);
  const f = grafo.addNo(G, 600, 500);
  grafo.addAresta(G, d, f, 'rua');
  assert.equal(grafo.componentes(G).n, 2);
  const perto = grafo.addNo(G, 112.5, 112.3);
  grafo.addAresta(G, perto, d, 'rua');
  grafo.fundir(G, c, perto);
  assert.equal(N.viva[perto], 0);
  assert.equal(grafo.componentes(G).n, 1);
  assert.deepEqual(grafo.validarGrafo(G), []);
  // mão única no CSR
  const e4 = grafo.arestasDoNo(G, d).find((x) => grafo.outroNo(G, x, d) === f);
  A.mao[e4] = 1;
  const g = grafo.adjacencia(G);
  let sentidos = 0;
  for (let k = 0; k < g.ref.length; k++) if (g.ref[k] === e4 || g.ref[k] === ~e4) sentidos++;
  assert.equal(sentidos, 1);
  // remover leva os nós soltos
  const vivosAntes = N.vivos;
  grafo.removerAresta(G, e4);
  assert.equal(N.vivos, vivosAntes - 1);
  assert.equal(grafo.noPerto(G, 111, 1, 5), m);
  assert.ok(Math.abs(grafo.arestaPerto(G, 50, 3, 10).d - 3) < 1e-6);
  assert.deepEqual(sim.validar(), []);
});

test('grafo: bordas (fundir além do grau 6 não perde aresta, nós no mesmo ponto, dividir no teto)', () => {
  const sim = criarSimulacao({ semente: 'grafo-bordas', dominios: false });
  const G = sim.grafo;
  const centro = grafo.addNo(G, 0, 0);
  for (let k = 0; k < 5; k++) grafo.addAresta(G, centro, grafo.addNo(G, 100 * cos((k * 2 * Math.PI) / 5), 100 * sen((k * 2 * Math.PI) / 5)), 'rua');
  const outro = grafo.addNo(G, 3, 2);
  grafo.addAresta(G, outro, grafo.addNo(G, 3, 200), 'rua');
  grafo.addAresta(G, outro, grafo.addNo(G, 200, 2), 'rua');
  const antes = G.arestas.vivos;
  assert.equal(grafo.fundir(G, centro, outro), -1); // 5 + 2 > 6: recusa sem mexer
  assert.equal(G.arestas.vivos, antes);
  assert.equal(G.nos.viva[outro], 1);
  assert.deepEqual(grafo.validarGrafo(G), []);
  const junto = grafo.addNo(G, 0, 0);
  assert.equal(grafo.addAresta(G, centro, junto, 'rua'), -1); // comprimento 0
  // no teto de arestas, dividir recusa em vez de apagar a aresta
  const cheio = criarSimulacao({ semente: 'grafo-teto', dominios: false });
  const H = cheio.grafo;
  H.arestas.teto = 1;
  const e = grafo.addAresta(H, grafo.addNo(H, 0, 0), grafo.addNo(H, 100, 0), 'rua');
  assert.equal(grafo.dividir(H, e, 0.5), -1);
  assert.equal(H.arestas.viva[e], 1);
  assert.deepEqual(grafo.validarGrafo(H), []);
});

test('matemática determinística: exp perto do teto não estoura antes da hora', () => {
  for (const x of [709.4, 709.5, 709.7, 709.78]) assert.ok(Math.abs(exp(x) / Math.exp(x) - 1) < 1e-15, `exp(${x})`);
  assert.equal(exp(710), Infinity);
});

test('desempenho do núcleo (anotado)', () => {
  const sim = criarSim({ semente: 'medida' });
  const t0 = performance.now();
  sim.rodar(20000);
  const tique = (performance.now() - t0) / 20000;
  const t1 = performance.now();
  for (let i = 0; i < 2000; i++) sim.q.barra();
  const barra = (performance.now() - t1) / 2000;
  console.log(`tique vazio ${(tique * 1000).toFixed(2)} µs · q.barra ${(barra * 1000).toFixed(2)} µs`);
  assert.ok(tique < 0.05 && barra < 0.2);
});
