// Testes das redes de água e energia (S2a; seção 8.2 do desenho da simulação, D52): oferta e demanda por componente das
// vias com calçada, racionamento dos mais distantes dos produtores (o problema aparece nas pontas), componente sem
// ligação não recebe, rua de terra não leva cano nem cabo (melhorar põe na rede), energia de fora só pelo nó de
// entrada (até 5 MW, a preço por kW) e nenhuma água de fora, produtor registrado por outro domínio (o reservatório da
// X1b), camadas Água e Energia e o determinismo do balanço.
// Roda sozinho: node ferramentas/testes/redes.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { noPerto } from '../../fonte/sim/vias/grafo.js';
import { refDe, idxDaRef } from '../../fonte/contratos/espelho.js';
import { CELULA, PREDIO } from '../../fonte/contratos/flags.js';
import { indiceZona } from '../../fonte/data/zonas.js';
import { LIGACAO_EXTERNA } from '../../fonte/data/servicos.js';
import { nascerNaFrente, terminarObra } from '../../fonte/sim/zonas/crescimento.js';
import { sistemaRedes, consumoDe, garantirRedes, estadoRede } from '../../fonte/sim/redes.js';
import { acessoDe } from '../../fonte/sim/predios.js';
import { noDeEntrada } from '../../fonte/sim/mundo/vila.js';

// ------------------------------------------------------------------------------------------------ apoio

function rua(sim, pontos, tipo = 'rua') {
  const plano = { modo: 'reta', tipo, pontos, sessao: 1, encaixe: false };
  const r = sim.cmd('via.construir', { plano });
  assert.ok(r.ok, `${JSON.stringify(pontos)}: ${r.codigo}`);
  return r;
}

const refNo = (sim, x, z) => {
  const no = noPerto(sim.grafo, x, z, 12);
  assert.ok(no >= 0, `nó em ${x}, ${z}`);
  return refDe(no, sim.tabelas.nos.ger[no]);
};

/** Pinta um trecho e faz nascer (já pronto) prédios residenciais em todas as frentes livres dele. */
function povoar(sim, x, z, raio, max = 40) {
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'circulo', x, z, raio }, zona: indiceZona('resBaixa') }).ok);
  const C = sim.tabelas.celulas;
  const zr = indiceZona('resBaixa');
  const rng = sim.rng('teste');
  const feitos = [];
  for (let c = 0; c < C.n && feitos.length < max; c++) {
    if (!C.viva[c] || C.zona[c] !== zr || C.linha[c] !== 0 || C.estado[c] !== CELULA.LIVRE) continue;
    const i = nascerNaFrente(sim, c, zr, rng);
    if (i >= 0) {
      terminarObra(sim, i);
      feitos.push(i);
    }
  }
  return feitos;
}

const sem = (sim, i, bit) => !!(sim.tabelas.predios.flags[i] & bit);

// ------------------------------------------------------------------------------------------------ balanço

test('oferta e demanda por componente: sem produtor fica sem; com produtor ligado, atende; o reservatório registrado conta', () => {
  const sim = criarSimulacao({ semente: 'redes-basico', modo: 'livre' });
  rua(sim, [[-760, -480], [-280, -480]]);
  const casas = povoar(sim, -520, -460, 60);
  assert.ok(casas.length >= 4, `${casas.length} casas`);
  sistemaRedes(sim);
  for (const i of casas) assert.ok(sem(sim, i, PREDIO.SEM_AGUA) && sem(sim, i, PREDIO.SEM_ENERGIA) && !sem(sim, i, PREDIO.RACIONADO));
  assert.equal(sim.agregados.redes.agua.oferta, 0);
  assert.ok(sim.agregados.redes.agua.demanda > 0);
  // o produtor que outro domínio registra (X1b: o reservatório de lago.e1), no nó oeste
  const id = sim.redes.produtor({ tipo: 'agua', ref: 77, capacidade: 100, no: refNo(sim, -760, -480) });
  sim.redes.produtor({ tipo: 'energia', ref: 78, capacidade: 1e5, no: refNo(sim, -760, -480) });
  sistemaRedes(sim);
  for (const i of casas) assert.ok(!sem(sim, i, PREDIO.SEM_AGUA) && !sem(sim, i, PREDIO.SEM_ENERGIA));
  assert.equal(sim.agregados.redes.agua.oferta, 100);
  // a demanda da cidade soma todos os prédios, ligados ou não (a Vila nas ruas de terra também pede)
  const P = sim.tabelas.predios;
  let dem = 0;
  for (let i = 0; i < P.n; i++) if (P.viva[i]) dem += consumoDe(sim, i, 'agua');
  assert.ok(Math.abs(sim.agregados.redes.agua.demanda - dem) < 0.05, `${sim.agregados.redes.agua.demanda} contra ${dem}`);
  assert.equal(estadoRede(sim, casas[0], 'agua'), 'ok');
  // tirar o produtor volta a faltar
  sim.redes.remover(id);
  sistemaRedes(sim);
  assert.ok(sem(sim, casas[0], PREDIO.SEM_AGUA));
  assert.deepEqual(sim.erros, []);
});

test('racionamento dos mais distantes: com oferta para metade, ficam sem as casas da ponta, longe do produtor', () => {
  const sim = criarSimulacao({ semente: 'redes-racionar', modo: 'livre' });
  rua(sim, [[-760, -480], [-280, -480]]);
  const casas = povoar(sim, -520, -460, 240, 60);
  assert.ok(casas.length >= 10, `${casas.length} casas`);
  const total = casas.reduce((s, i) => s + consumoDe(sim, i, 'agua'), 0);
  sim.redes.produtor({ tipo: 'agua', ref: 1, capacidade: total / 2, no: refNo(sim, -760, -480) });
  sistemaRedes(sim);
  const P = sim.tabelas.predios;
  const cortadas = casas.filter((i) => sem(sim, i, PREDIO.SEM_AGUA));
  const atendidas = casas.filter((i) => !sem(sim, i, PREDIO.SEM_AGUA));
  assert.ok(cortadas.length && atendidas.length);
  for (const i of cortadas) assert.ok(sem(sim, i, PREDIO.RACIONADO), 'racionada, não sem ligação');
  // pela rede o produtor está na ponta oeste: quem fica sem está mais a leste que todos os atendidos
  const maxAtendida = Math.max(...atendidas.map((i) => P.x[i]));
  const minCortada = Math.min(...cortadas.map((i) => P.x[i]));
  assert.ok(minCortada >= maxAtendida - 8, `cortada em ${minCortada}, atendida até ${maxAtendida}`);
  const servida = atendidas.reduce((s, i) => s + consumoDe(sim, i, 'agua'), 0);
  assert.ok(servida <= total / 2 + 1e-6, 'a demanda servida cabe na oferta');
  const alerta = sim.q.barra().alertas.find((a) => a.codigo === 'faltaAgua');
  assert.ok(alerta && alerta.params.racionados === cortadas.length);
});

test('componente sem ligação não recebe; rua de terra não leva rede e melhorar para rua liga (D52)', () => {
  const sim = criarSimulacao({ semente: 'redes-vila', modo: 'livre' });
  // a rua principal da Vila é rua (com calçada): um produtor nela atende só quem tem acesso por ela
  const A = sim.tabelas.arestas;
  const principal = sim.json.mapa.ruas.principal.map((r) => idxDaRef(r));
  const e0 = principal[0];
  sim.redes.produtor({ tipo: 'agua', ref: 1, capacidade: 1000, no: refDe(A.a[e0], sim.tabelas.nos.ger[A.a[e0]]) });
  sistemaRedes(sim);
  const P = sim.tabelas.predios;
  const AC = { e: -1, s: 0 };
  const naPrincipal = [];
  const naTerra = [];
  for (const r of sim.json.mapa.predios) {
    const i = idxDaRef(r);
    acessoDe(sim, i, AC);
    if (principal.includes(AC.e)) naPrincipal.push(i);
    else if (AC.e >= 0 && A.tipo[AC.e] === 5) naTerra.push(i);
  }
  assert.ok(naPrincipal.length && naTerra.length, `${naPrincipal.length} na principal, ${naTerra.length} na terra`);
  for (const i of naPrincipal) assert.ok(!sem(sim, i, PREDIO.SEM_AGUA), 'casa da rua principal com água');
  for (const i of naTerra) assert.ok(sem(sim, i, PREDIO.SEM_AGUA) && !sem(sim, i, PREDIO.RACIONADO), 'casa da rua de terra sem ligação');
  // outra rua solta, longe: sem ligação com o produtor
  rua(sim, [[-760, -480], [-280, -480]]);
  const soltas = povoar(sim, -520, -460, 40);
  sistemaRedes(sim);
  for (const i of soltas) assert.ok(sem(sim, i, PREDIO.SEM_AGUA));
  // melhorar a rua da praia (terra) para rua: as casas dela entram na rede da principal
  const praia = sim.json.mapa.ruas.praia;
  assert.ok(sim.cmd('via.melhorar', { arestas: praia, tipo: 'rua', sessao: 9 }).ok);
  sistemaRedes(sim);
  const praiaIdx = praia.map((r) => idxDaRef(r));
  const daPraia = sim.json.mapa.predios.map((r) => idxDaRef(r)).filter((i) => {
    acessoDe(sim, i, AC);
    return praiaIdx.includes(AC.e);
  });
  const R = garantirRedes(sim);
  const ligada = praiaIdx.some((e) => A.viva[e] && R.comp[A.a[e]] === R.comp[A.a[e0]]);
  if (ligada) for (const i of daPraia) assert.ok(!sem(sim, i, PREDIO.SEM_AGUA), 'casa da praia ligada depois de melhorar');
  assert.deepEqual(sim.erros, []);
});

test('energia de fora só pelo nó de entrada, até 5 MW e a preço por kW; nenhuma água de fora (D52)', () => {
  const sim = criarSimulacao({ semente: 'redes-entrada', modo: 'livre' });
  const ent = noDeEntrada(sim);
  assert.ok(ent >= 0);
  const N = sim.tabelas.nos;
  const x = N.x[ent];
  const z = N.z[ent];
  // a avenida sugerida sai do nó de entrada (D36); aqui uma rua reta dele, para o leste (para o sul ela entra no disco
  // da sede, D90)
  rua(sim, [[x, z], [x + 200, z]]);
  const casas = povoar(sim, x + 100, z, 80);
  assert.ok(casas.length >= 3);
  sistemaRedes(sim);
  for (const i of casas) {
    assert.ok(!sem(sim, i, PREDIO.SEM_ENERGIA), 'energia da rodovia');
    assert.ok(sem(sim, i, PREDIO.SEM_AGUA), 'água de fora não vem');
  }
  const imp = sim.agregados.redes.importado.energia;
  const dem = casas.reduce((s, i) => s + consumoDe(sim, i, 'energia'), 0);
  assert.ok(imp > 0 && Math.abs(imp - dem) < 0.2, `importado ${imp}, demanda ${dem}`);
  const custo = sim.custos.lista().find((c) => c.nome === 'ligacao');
  assert.ok(custo && Math.abs(custo.valor - imp * LIGACAO_EXTERNA.precoKwHora) < 1e-6, 'a ligação custa por kW por hora');
  // o teto da ligação é 5 MW; sem consumo, nada vem de fora
  const P = sim.tabelas.predios;
  assert.equal(LIGACAO_EXTERNA.energia, 5000);
  for (const i of casas) P.moradores[i] = 0;
  sistemaRedes(sim);
  assert.equal(sim.agregados.redes.importado.energia, 0, 'sem consumo, nada importado');
  // sem ligação ao nó de entrada (a Vila), nada de energia
  const vila = sim.json.mapa.predios.map((r) => idxDaRef(r)).find((i) => consumoDe(sim, i, 'energia') > 0);
  assert.ok(vila >= 0 && sem(sim, vila, PREDIO.SEM_ENERGIA));
});

test('produtor de frente para a estrada de terra: a prévia avisa (semRede, nada na rede) e o prédio pronto mostra o aviso', () => {
  const sim = criarSimulacao({ semente: 'redes-terra', modo: 'livre' });
  // a estrada de terra da Vila sai do fim da rua principal, em (-935, 300), para o norte; perto de z = 280 o rio acima
  // da Vila ainda fica na margem da captação
  const p = sim.q.construir.previa({ tipo: 'captacao', x: -955, z: 280, rot: 0 });
  assert.ok(p.ok, p.codigo);
  assert.equal(p.semRede, true);
  assert.deepEqual(p.efeitos, [{ camada: 'agua', delta: 0 }]);
  const r = sim.cmd('construir', { tipo: 'captacao', x: p.x, z: p.z, rot: p.rot });
  assert.ok(r.ok, r.codigo);
  terminarObra(sim, idxDaRef(r.id));
  sim.rodar(2 * 20, { sincrono: true });
  assert.equal(sim.agregados.redes.agua.oferta, 0, 'nada chega à rede');
  const q = sim.q.predio(r.id);
  assert.ok(q.avisos.some((a) => a.codigo === 'semRede' && a.gravidade === 'grave'), JSON.stringify(q.avisos));
  // numa rua com calçada a prévia promete a capacidade
  rua(sim, [[-760, -480], [-280, -480]]);
  const s = sim.q.construir.previa({ tipo: 'solar', x: -520, z: -520 });
  assert.ok(s.ok, s.codigo);
  assert.equal(s.semRede, false);
  assert.deepEqual(s.efeitos, [{ camada: 'energia', delta: 8000 }]);
  // serviço que não é produtor não leva a marca
  assert.equal(sim.q.construir.previa({ tipo: 'praca', x: -520, z: -520 }).semRede, false);
  assert.deepEqual(sim.erros, []);
});

test('camadas Água e Energia (categóricas por prédio) e o balanço não muda o hash duas vezes seguidas', () => {
  const sim = criarSimulacao({ semente: 'redes-camadas', modo: 'livre' });
  rua(sim, [[-760, -480], [-280, -480]]);
  povoar(sim, -520, -460, 60);
  sim.redes.produtor({ tipo: 'energia', ref: 1, capacidade: 1e5, no: refNo(sim, -760, -480) });
  sim.rodar(40, { sincrono: true });
  for (const id of ['agua', 'energia']) {
    const c = sim.q.camada(id);
    assert.equal(c.fonte, 'predios');
    assert.equal(c.tipo, 'cat');
    assert.equal(c.dados.length, sim.tabelas.predios.n);
    assert.ok(c.categorias.length === 4 && c.resumo.chave === `camada.${id}.resumo`);
  }
  const ag = sim.q.camada('agua').dados;
  const en = sim.q.camada('energia').dados;
  assert.ok([...ag].some((v) => v === 3) && [...en].some((v) => v === 1), 'sem água e com energia aparecem');
  sistemaRedes(sim);
  const h = sim.hash();
  sistemaRedes(sim);
  assert.equal(sim.hash(), h, 'balanço idempotente');
});
