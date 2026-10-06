// Testes dos serviços (S2a; seção 8.1 do desenho da simulação, D50, D54, D60): catálogo pela barra e pelo marco, prévia
// grudada na frente da via (e o comando com o x, z e rot da prévia dá o mesmo lugar), recusas (marco, valor, colisão,
// sem acesso, margem da captação, créditos), obra até ficar pronto, cobertura que cai com a distância
// pela via e não passa para um componente sem ligação, a conta incremental igual à inteira bit a bit, eficiência pela
// carga, manutenção em sim.custos, demolir devolvendo 50% e a camada Serviços.
// Roda sozinho: node ferramentas/testes/servicos.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { idxDaRef, conferirEspelho } from '../../fonte/contratos/espelho.js';
import { CELULA, PREDIO, TIPO_PREDIO } from '../../fonte/contratos/flags.js';
import { indiceZona } from '../../fonte/data/zonas.js';
import { SERVICOS, SERVICOS_ORDEM } from '../../fonte/data/servicos.js';
import { garantirCobertura, coberturaNoPonto, sistemaCargas, buscar, atualizarServico } from '../../fonte/sim/servicos.js';
import { trans, acessoDe, limitesDeclive, COLOCAR, dispensaAcesso } from '../../fonte/sim/predios.js';
import { terminarObra, nascerNaFrente } from '../../fonte/sim/zonas/crescimento.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';

const rua = (sim, pontos, tipo = 'rua') => {
  const r = sim.cmd('via.construir', { plano: { modo: 'reta', tipo, pontos, sessao: 1, encaixe: false } });
  assert.ok(r.ok, `${JSON.stringify(pontos)}: ${r.codigo}`);
  return r.dados.arestas.map((x) => idxDaRef(x));
};

function colocar(sim, tipo, x, z, rot = 0) {
  const p = sim.q.construir.previa({ tipo, x, z, rot });
  if (!p.ok) return { previa: p, r: null };
  const r = sim.cmd('construir', { tipo, x: p.x, z: p.z, rot: p.rot });
  return { previa: p, r };
}

test('catálogo: serviços e lazer do M1a pela barra, o marco tranca, o M1b fica de fora', () => {
  const sim = criarSimulacao({ semente: 'serv-catalogo' });
  const serv = sim.q.catalogo('servicos');
  const lazer = sim.q.catalogo('lazer');
  const tipos = serv.map((x) => x.tipo);
  for (const t of ['captacao', 'poco', 'solar', 'clinica', 'escolaF', 'delegacia', 'bombeiros']) assert.ok(tipos.includes(t), t);
  assert.deepEqual(lazer.map((x) => x.tipo), ['praca']);
  for (const t of ['ete', 'termica', 'escolaM', 'hospital', 'parque', 'parqueG']) assert.ok(!tipos.includes(t) && !lazer.some((x) => x.tipo === t), `${t} é do M1b`);
  const clinica = serv.find((x) => x.tipo === 'clinica');
  assert.equal(clinica.liberado, false, 'clínica no marco 1');
  assert.equal(serv.find((x) => x.tipo === 'captacao').liberado, true);
  assert.deepEqual(clinica.pegada, SERVICOS.clinica.planta);
  assert.equal(clinica.alcance, 1200);
  assert.equal(clinica.grupo, 'saude');
  // a Holding (S3a) entra pelo mesmo registro, na barra Empresas
  const emp = sim.q.catalogo('empresas');
  if (sim.colocaveis.obter('pedreira')) assert.ok(emp.some((x) => x.tipo === 'pedreira'));
});

test('prévia grudada na frente da via; o comando com a prévia dá o mesmo lugar; obra até ficar pronto; invariantes', () => {
  const sim = criarSimulacao({ semente: 'serv-colocar', modo: 'livre' });
  const [e] = rua(sim, [[960, -300], [1440, -300]]);
  const caixa0 = sim.holding.caixa();
  const { previa, r } = colocar(sim, 'clinica', 1200, -330, 0);
  assert.ok(previa.ok, previa.codigo);
  // ao norte da via (-z), a frente encosta na calçada e olha para ela (+z): rot = 0
  assert.ok(Math.abs(previa.z - (-300 - 8 - SERVICOS.clinica.planta[1] / 2 - 1)) < 0.5, `z ${previa.z}`);
  assert.ok(Math.abs(Math.cos(previa.rot) - 1) < 1e-6, `rot ${previa.rot}`);
  assert.equal(previa.custo, SERVICOS.clinica.custo);
  assert.ok(r.ok, r.codigo);
  assert.equal(sim.holding.caixa(), caixa0 - SERVICOS.clinica.custo);
  const P = sim.tabelas.predios;
  const i = idxDaRef(r.id);
  assert.equal(P.tipo[i], TIPO_PREDIO.SERVICO);
  assert.equal(SERVICOS_ORDEM[P.modelo[i]], 'clinica');
  assert.ok(Math.abs(P.x[i] - previa.x) < 1e-6 && Math.abs(P.z[i] - previa.z) < 1e-6 && Math.abs(P.rot[i] - previa.rot) < 1e-6);
  assert.ok(P.flags[i] & PREDIO.OBRA);
  assert.equal(P.obraFim[i] - P.obraIni[i], SERVICOS.clinica.obraTiques);
  // a prévia de novo no mesmo lugar bate na clínica
  assert.equal(sim.q.construir.previa({ tipo: 'clinica', x: 1200, z: -330, rot: 0 }).codigo, 'colisao');
  const vistos = [];
  sim.on('obraFim', (d) => vistos.push(d.ref));
  sim.rodar(SERVICOS.clinica.obraTiques + 1, { sincrono: true });
  assert.ok(!(P.flags[i] & PREDIO.OBRA));
  assert.ok(vistos.includes(r.id));
  assert.ok(sim.q.predio(r.id).servico.alcance === 1200);
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) }), []);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
  // manutenção da clínica pronta em sim.custos
  assert.equal(sim.custos.lista().find((c) => c.nome === 'servicos').valor, SERVICOS.clinica.manutencaoHora);
  assert.ok(e >= 0);
});

test('recusas: marco, valor, sem acesso, captação longe da água e créditos', () => {
  const sim = criarSimulacao({ semente: 'serv-recusas' });
  rua(sim, [[960, -300], [1440, -300]]);
  assert.equal(sim.q.construir.previa({ tipo: 'clinica', x: 1200, z: -330 }).codigo, 'marco');
  assert.equal(sim.q.construir.previa({ tipo: 'nada', x: 0, z: 0 }).codigo, 'valor');
  assert.equal(sim.cmd('construir', { tipo: 'praca', x: NaN, z: 0 }).codigo, 'valor');
  // fora das áreas da Holding o motivo é o ladrilho (D98: o motivo mais básico primeiro); sem via por perto, o acesso
  const fora = sim.q.construir.previa({ tipo: 'praca', x: 3000, z: 3000 });
  assert.equal(fora.codigo, 'ladrilho');
  assert.equal(fora.dados.estado, 'trancado');
  assert.equal(sim.q.construir.previa({ tipo: 'praca', x: 2200, z: -300 }).dados.estado, 'compravel');
  const sem = sim.q.construir.previa({ tipo: 'praca', x: 1200, z: -1280 });
  assert.equal(sem.codigo, 'acesso');
  assert.deepEqual(sem.dados, { max: 60, alinhar: true });
  // a captação pede água a até 40 m do fundo: no meio da rua, longe do rio, não
  assert.equal(sim.q.construir.previa({ tipo: 'captacao', x: 1200, z: -330 }).codigo, 'agua');
  // créditos: a Holding sem caixa
  sim.holding.pagar(sim.holding.caixa(), 'teste');
  const p = sim.q.construir.previa({ tipo: 'praca', x: 1200, z: -330 });
  assert.equal(p.codigo, 'creditos');
  assert.equal(sim.cmd('construir', { tipo: 'praca', x: p.x, z: p.z, rot: p.rot }).codigo, 'creditos');
  assert.deepEqual(sim.erros, []);
});

test('cobertura cai com a distância pela via e não passa para um componente sem ligação', () => {
  const sim = criarSimulacao({ semente: 'serv-cobertura', modo: 'livre' });
  const es = rua(sim, [[960, -300], [1600, -300]], 'avenida');
  const solta = rua(sim, [[960, -200], [1440, -200]]);
  const { r } = colocar(sim, 'praca', 1020, -330);
  assert.ok(r?.ok);
  terminarObra(sim, idxDaRef(r.id));
  sistemaCargas(sim);
  const A = sim.tabelas.arestas;
  const xPraca = sim.tabelas.predios.x[idxDaRef(r.id)];
  // pontos da avenida a leste da praça, pelo x do mundo (a aresta pode ir de leste para oeste): a cobertura não cresce
  const amostras = [];
  for (const e of es.filter((x) => A.viva[x])) {
    const comp = A.arco[17 * e + 16];
    for (let k = 0; k <= 8; k++) {
      const s = (comp * k) / 8;
      const x = A.p[8 * e] + ((A.p[8 * e + 6] - A.p[8 * e]) * s) / comp;
      if (x > xPraca + 2) amostras.push({ x, c: coberturaNoPonto(sim, 'lazer', e, s), e, s });
    }
  }
  amostras.sort((a, b) => a.x - b.x);
  let ant = Infinity;
  let zerou = false;
  for (const a of amostras) {
    assert.ok(a.c <= ant + 1e-9, `cobertura subiu em ${a.e}:${a.s} (x ${a.x})`);
    ant = a.c;
    if (a.c === 0) zerou = true;
  }
  assert.ok(zerou, 'além de 300 m a praça não cobre');
  // a rua solta fica a 100 m em linha reta, mas sem ligação pela via
  for (const e of solta) assert.equal(coberturaNoPonto(sim, 'lazer', e, 10), 0);
});

test('conta incremental igual à inteira, bit a bit; eficiência cai com a carga acima da capacidade', () => {
  const sim = criarSimulacao({ semente: 'serv-incremental', modo: 'livre' });
  rua(sim, [[960, -300], [1440, -300]]);
  rua(sim, [[1200, -300], [1200, 100]]);
  const a = colocar(sim, 'clinica', 1020, -330).r;
  terminarObra(sim, idxDaRef(a.id));
  garantirCobertura(sim);
  const b = colocar(sim, 'clinica', 1240, -100).r;
  assert.ok(b?.ok);
  terminarObra(sim, idxDaRef(b.id));
  // a segunda clínica entra pela conta incremental (só a origem nova)
  const inc = garantirCobertura(sim).tipos.clinica;
  const dInc = Float64Array.from(inc.dist);
  const rInc = Int32Array.from(inc.rot);
  // a conta inteira do zero
  trans(sim).grafoSujo = true;
  const tudo = garantirCobertura(sim).tipos.clinica;
  assert.deepEqual(Array.from(tudo.dist), Array.from(dInc));
  assert.deepEqual(Array.from(tudo.rot), Array.from(rInc));
  // a função de busca: o empate fica com o rótulo menor, em qualquer ordem das fontes
  const csr = garantirCobertura(sim).csr;
  const n = csr.n;
  const d1 = new Float64Array(n);
  const r1 = new Int32Array(n);
  const d2 = new Float64Array(n);
  const r2 = new Int32Array(n);
  buscar(csr, [[0, 0, 5], [1, 0, 3]], Infinity, d1, r1);
  buscar(csr, [[1, 0, 3], [0, 0, 5]], Infinity, d2, r2);
  assert.deepEqual(Array.from(r1), Array.from(r2));
  // eficiência: carga de moradores acima da capacidade derruba
  const P = sim.tabelas.predios;
  const ia = idxDaRef(a.id);
  sim.json.cidade.ocupacao = [1, 1, 1, 1];
  sistemaCargas(sim);
  assert.ok(P.efic[ia] > 0.99, `sem carga: ${P.efic[ia]}`);
  // a carga vem da rodada; aqui a conta da eficiência com a carga dada
  atualizarServico(sim, ia, 2 * SERVICOS.clinica.capacidade);
  assert.ok(Math.abs(P.efic[ia] - 0.5) < 0.01, `com o dobro da carga: ${P.efic[ia]}`);
});

test('demolir: o serviço devolve 50%; a zona custa os materiais (D54); Arcologia e ref velha recusadas', () => {
  const sim = criarSimulacao({ semente: 'serv-demolir', modo: 'livre' });
  rua(sim, [[960, -300], [1440, -300]]);
  const { r } = colocar(sim, 'delegacia', 1200, -330);
  const caixa = sim.holding.caixa();
  const d = sim.cmd('demolir', { refs: [r.id] });
  assert.ok(d.ok, d.codigo);
  assert.equal(sim.holding.caixa(), caixa + SERVICOS.delegacia.custo / 2);
  assert.equal(sim.cmd('demolir', { refs: [r.id] }).codigo, 'inexistente');
  // zona: a casa da Vila custa o valor dos materiais do nível dela
  const casa = sim.json.mapa.predios[0];
  const q = sim.q.predio(casa);
  assert.ok(q.custoDemolir > 0);
  const c0 = sim.holding.caixa();
  assert.ok(sim.cmd('demolir', { refs: [casa] }).ok);
  assert.equal(sim.holding.caixa(), c0 - q.custoDemolir);
  // sem caixa não demole
  sim.holding.pagar(sim.holding.caixa(), 'teste');
  assert.equal(sim.cmd('demolir', { refs: [sim.json.mapa.predios[1]] }).codigo, 'creditos');
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});

test('acesso pela frente segue a via partida por um cruzamento; salvar e carregar continua com o mesmo hash', () => {
  const sim = criarSimulacao({ semente: 'serv-partida', modo: 'livre' });
  const plano = (pontos) => ({ plano: { modo: 'reta', tipo: 'rua', pontos, sessao: 1, encaixe: true } });
  assert.ok(sim.cmd('via.construir', plano([[960, -300], [1440, -300]])).ok);
  const A = sim.tabelas.arestas;
  // a clínica fica a leste do ponto onde o T vai chegar, do outro lado da rua
  const { r } = colocar(sim, 'clinica', 1295, -330);
  assert.ok(r?.ok, r?.codigo);
  const i = idxDaRef(r.id);
  terminarObra(sim, i);
  sim.rodar(40, { sincrono: true });
  const AC = { e: -1, s: 0 };
  acessoDe(sim, i, AC);
  const antes = AC.e;
  assert.ok(antes >= 0);
  // o T parte a aresta da clínica: o pedaço que fica com o idx encurta e o acesso tem de ir para o pedaço novo
  assert.ok(sim.cmd('via.construir', plano([[1270, -100], [1270, -300]])).ok);
  sim.rodar(40, { sincrono: true });
  acessoDe(sim, i, AC);
  assert.ok(AC.e >= 0 && A.viva[AC.e]);
  assert.ok(AC.s >= 0 && AC.s <= A.arco[17 * AC.e + 16] + 1e-3, `arco ${AC.s} fora da aresta ${AC.e}`);
  // a conta do zero (o carregar) dá o mesmo acesso, e a partida carregada segue igual
  const C = criarSimulacao({ semente: 'serv-partida', modo: 'livre' });
  aplicarSave(C, migrar(lerSave(montarSave(sim))));
  const AC2 = { e: -1, s: 0 };
  acessoDe(C, i, AC2);
  assert.deepEqual([AC2.e, AC2.s], [AC.e, AC.s]);
  sim.rodar(200, { sincrono: true });
  C.rodar(200, { sincrono: true });
  assert.equal(C.q.hash(), sim.q.hash());
  assert.deepEqual(sim.erros, []);
});

test('prédios soltos pela via demolida: o acesso refeito na hora é o mesmo da conta do zero (carregar)', () => {
  const sim = criarSimulacao({ semente: 'serv-soltos', modo: 'livre' });
  const plano = (pontos) => ({ plano: { modo: 'reta', tipo: 'rua', pontos, sessao: 1, encaixe: false } });
  const r1 = sim.cmd('via.construir', plano([[960, -300], [1440, -300]]));
  assert.ok(r1.ok && sim.cmd('via.construir', plano([[960, -240], [1440, -240]])).ok);
  const zr = indiceZona('resBaixa');
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'retangulo', x: 960, z: -300, x2: 1440, z2: -240 }, zona: zr }).ok);
  const C = sim.tabelas.celulas;
  const P = sim.tabelas.predios;
  const rng = sim.rng('teste');
  const feitos = [];
  for (let c = 0; c < C.n; c++) {
    if (!C.viva[c] || C.zona[c] !== zr || C.linha[c] !== 0 || C.estado[c] !== CELULA.LIVRE) continue;
    const i = nascerNaFrente(sim, c, zr, rng);
    if (i >= 0) {
      terminarObra(sim, i);
      feitos.push(i);
    }
  }
  sim.rodar(40, { sincrono: true });
  const AC = { e: -1, s: 0 };
  for (const i of feitos) acessoDe(sim, i, AC);
  assert.ok(sim.cmd('via.demolir', { arestas: r1.dados.arestas, sessao: 1 }).ok);
  sim.rodar(5, { sincrono: true });
  const soltos = feitos.filter((i) => P.viva[i] && P.flags[i] & PREDIO.SEM_ACESSO);
  assert.ok(soltos.length > 0, 'a via demolida solta prédios');
  const B = criarSimulacao({ semente: 'serv-soltos', modo: 'livre' });
  aplicarSave(B, migrar(lerSave(montarSave(sim))));
  const AB = { e: -1, s: 0 };
  for (const i of feitos) {
    if (!P.viva[i]) continue;
    acessoDe(sim, i, AC);
    acessoDe(B, i, AB);
    assert.deepEqual([AC.e, AC.s], [AB.e, AB.s], `prédio ${P.ref(i)}`);
  }
  sim.rodar(300, { sincrono: true });
  B.rodar(300, { sincrono: true });
  assert.equal(B.q.hash(), sim.q.hash());
});

test('colocar sobre prédios de zona cobra a demolição deles (D54), como a via', () => {
  const sim = criarSimulacao({ semente: 'serv-d54', modo: 'livre' });
  rua(sim, [[960, -300], [1440, -300]]);
  const zr = indiceZona('resBaixa');
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'circulo', x: 1200, z: -330, raio: 40 }, zona: zr }).ok);
  const C = sim.tabelas.celulas;
  const P = sim.tabelas.predios;
  const rng = sim.rng('teste');
  for (let c = 0; c < C.n; c++) {
    if (!C.viva[c] || C.zona[c] !== zr || C.linha[c] !== 0 || C.estado[c] !== CELULA.LIVRE) continue;
    const i = nascerNaFrente(sim, c, zr, rng);
    if (i >= 0) terminarObra(sim, i);
  }
  const p = sim.q.construir.previa({ tipo: 'praca', x: 1200, z: -330 });
  assert.ok(p.ok, p.codigo);
  assert.ok(p.demolir.length > 0, 'a praça cai sobre as casas');
  const esperado = p.demolir.reduce((s, ref) => s + sim.q.predio(ref).custoDemolir, 0);
  assert.ok(esperado > 0);
  assert.equal(p.custoDemolir, esperado);
  assert.equal(p.custo, SERVICOS.praca.custo + esperado);
  const caixa = sim.holding.caixa();
  const r = sim.cmd('construir', { tipo: 'praca', x: p.x, z: p.z, rot: p.rot });
  assert.ok(r.ok, r.codigo);
  assert.equal(sim.holding.caixa(), caixa - p.custo);
  for (const ref of p.demolir) assert.ok(!P.viva[idxDaRef(ref)] || P.ref(idxDaRef(ref)) !== ref);
  assert.deepEqual(sim.validar(), []);
});

test('camada Serviços por aresta, efeitos da prévia e q.cidade com a lista dos serviços', () => {
  const sim = criarSimulacao({ semente: 'serv-camada', modo: 'livre' });
  rua(sim, [[960, -300], [1440, -300]]);
  const p = sim.q.construir.previa({ tipo: 'escolaF', x: 1200, z: -330 });
  assert.ok(Array.isArray(p.efeitos) && p.efeitos[0].camada === 'servicos');
  const { r } = colocar(sim, 'escolaF', 1200, -330);
  terminarObra(sim, idxDaRef(r.id));
  sistemaCargas(sim);
  const c = sim.q.camada('servicos');
  assert.equal(c.fonte, 'arestas');
  assert.equal(c.dados.length, sim.tabelas.arestas.n);
  assert.ok([...c.dados].some((v) => v > 0));
  const cid = sim.q.cidade();
  assert.ok(cid.servicos.some((x) => x.tipo === 'escolaF' && x.prontos === 1));
  assert.ok('educacao' in cid.cobertura);
});


// C1a: o A8 pegou uma consulta que mudava a partida. O custo dos serviços ficava em cache pelo tique e pela contagem de
// prédios; um q.barra entre dois tiques guardava o valor de antes de a obra de um serviço terminar no tique seguinte, e
// a economia pagava esse valor. Agora a versão do diário entra na chave.
test('q.barra entre os tiques não muda a partida (custo dos serviços em cache)', () => {
  const jogar = (consultar) => {
    const sim = criarSimulacao({ semente: 'pureza-servicos' });
    for (const id of ['captacao', 'usina']) {
      const s = sim.q.sugestoes().find((x) => x.id === id);
      const pv = sim.q.construir.previa({ tipo: s.construir, x: s.x, z: s.z, rot: s.rot });
      assert.equal(sim.cmd('construir', { tipo: s.construir, x: pv.x, z: pv.z, rot: pv.rot }).ok, true, id);
    }
    for (let t = 0; t < 400; t++) {
      sim.rodar(1, { sincrono: true });
      if (consultar) sim.q.barra();
    }
    return { hash: sim.q.hash(), caixa: sim.holding.caixa() };
  };
  assert.deepEqual(jogar(true), jogar(false));
});

// ------------------------------------------------------------------------------------------------ colocar com giro livre (D98)

/** Terreiro de teste: 32 x 32 m, livre de via (dispensa o acesso), para medir o declive e o aplainar sem rua. */
function comTerreiro(sim) {
  sim.colocaveis.registrar('terreiro', { nome: 'Terreiro', custo: 1000, planta: [32, 32], marco: 0, parte: 'M1a', holding: true, acesso: 'livre', obraTiques: 40, modelo: 0, tipoPredio: TIPO_PREDIO.HOLDING });
}

/** Varre o mapa (a leste da gleba) até achar um ponto onde a prévia livre do tipo satisfaz o filtro. */
function achar(sim, tipo, filtro, { rot = 0, x0 = 1100, x1 = 2000, z0 = -1400, z1 = 900, passo = 40 } = {}) {
  for (let z = z0; z <= z1; z += passo) {
    for (let x = x0; x <= x1; x += passo) {
      const p = sim.q.construir.previa({ tipo, x, z, rot, alinhar: false, aplainar: true });
      if (filtro(p)) return { x, z, p };
    }
  }
  return null;
}

test('colocar (D98): a planta gira de verdade na colisão com a via e a recusa diz quanto afastar', () => {
  const sim = criarSimulacao({ semente: 'ux1-giro', modo: 'livre' });
  rua(sim, [[960, -300], [1440, -300]]);
  // praça 32 x 32 sem alinhar, a 25 m do eixo: de lado cabe (a pista acaba a 8 m do eixo), em losango o canto invade
  const livre = (rot) => sim.q.construir.previa({ tipo: 'praca', x: 1200, z: -325, rot, alinhar: false });
  assert.equal(livre(0).ok, true);
  const losango = livre(Math.PI / 4);
  assert.equal(losango.codigo, 'colisao');
  assert.equal(losango.dados.com, 'via');
  assert.ok(Number.isInteger(losango.dados.ref));
  // o canto entra uns 5,6 m na pista: afastar 7 m (a invasão mais 1 m de folga)
  assert.ok(losango.dados.afastar >= 6 && losango.dados.afastar <= 8, `afastar ${losango.dados.afastar}`);
  // alinhada, a planta girada 45 graus por cima da via encosta o canto a 1 m da pista e vale
  const alin = sim.q.construir.previa({ tipo: 'praca', x: 1200, z: -325, rot: 0, giro: Math.PI / 4 });
  assert.equal(alin.ok, true);
  assert.equal(alin.alinhado, true);
  // o centro afasta o raio da planta girada na direção da via: meia largura 8 + 1 + (16 cos 45 + 16 sen 45)
  assert.ok(Math.abs(-300 - alin.z - (8 + 1 + 16 * Math.SQRT2)) < 0.05, `z ${alin.z}`);
  assert.ok(Math.abs(alin.rot - (alin.rotVia + Math.PI / 4)) < 1e-9);
  // o quarto de volta de antes (giro como rot, sem giro) continua dando o mesmo lugar
  const quarto = sim.q.construir.previa({ tipo: 'clinica', x: 1200, z: -330, rot: Math.PI / 2 });
  const quarto2 = sim.q.construir.previa({ tipo: 'clinica', x: 1200, z: -330, rot: 0, giro: Math.PI / 2 });
  assert.equal(quarto.ok, true);
  assert.deepEqual([quarto.x, quarto.z, quarto.rot], [quarto2.x, quarto2.z, quarto2.rot]);
  assert.ok(Math.abs(-300 - quarto.z - (8 + 1 + 40 / 2)) < 0.05, 'de lado: a largura (40) é a que encosta na via');
  // sem `giro` o ângulo em relação à via arredonda ao quarto de volta, como antes (o robô e as sugestões chamam assim)
  const antiga = sim.q.construir.previa({ tipo: 'praca', x: 1200, z: -325, rot: Math.PI / 4 });
  const zero = sim.q.construir.previa({ tipo: 'praca', x: 1200, z: -325, rot: 0 });
  assert.equal(antiga.ok, true);
  assert.ok(Math.abs(antiga.giro - Math.PI / 2) < 1e-9, `45 graus sem giro arredondam para ${antiga.giro}`);
  assert.equal(zero.giro, 0);
  // o comando põe onde a prévia mostrou, a qualquer ângulo (com o giro da prévia), e a obra guarda a rotação
  const r = sim.cmd('construir', { tipo: 'praca', x: alin.x, z: alin.z, rot: alin.rot, giro: alin.giro, alinhar: true });
  assert.equal(r.ok, true, r.codigo);
  const i = idxDaRef(r.id);
  assert.ok(Math.abs(sim.tabelas.predios.rot[i] - alin.rot) < 1e-6);
  assert.ok(Math.abs(sim.tabelas.predios.x[i] - alin.x) < 1e-6);
  assert.deepEqual(sim.erros, []);
});

test('colocar (D98): o declive da planta girada e a faixa de aplainar com custo pelo volume e obra mais longa', () => {
  const sim = criarSimulacao({ semente: 'ux1-aplainar', modo: 'livre' });
  comTerreiro(sim);
  const lim = limitesDeclive(32, 32);
  assert.deepEqual(lim, { livre: 4, aplainar: 8 });
  assert.deepEqual(limitesDeclive(64, 48), { livre: 7.68, aplainar: 12.8 });
  const a = achar(sim, 'terreiro', (p) => p.ok && p.aplainar);
  assert.ok(a, 'o mapa tem lugar que pede aplainar');
  const ap = a.p.aplainar;
  assert.ok(ap.desnivel > lim.livre && ap.desnivel <= lim.aplainar, `desnível ${ap.desnivel}`);
  assert.equal(ap.livre, 4);
  assert.equal(ap.max, 8);
  assert.ok(ap.volume > 0);
  assert.equal(ap.custo, Math.round(ap.volume * COLOCAR.aplainar.custoM3), 'custo proporcional ao volume movido');
  assert.ok(ap.tiques >= COLOCAR.aplainar.tiquesMin && ap.tiques <= COLOCAR.aplainar.tiquesMax);
  assert.equal(a.p.custoAplainar, ap.custo);
  assert.equal(a.p.custo, 1000 + ap.custo, 'o custo da prévia já soma o aplainar');
  // a pegada gira de verdade na medida do declive: o mesmo centro, outro ângulo, outro desnível
  const girada = sim.q.construir.previa({ tipo: 'terreiro', x: a.x, z: a.z, rot: Math.PI / 4, alinhar: false, aplainar: true });
  const igual = girada.ok && girada.aplainar && Math.abs(girada.aplainar.desnivel - ap.desnivel) < 1e-9;
  assert.ok(!igual, 'a pegada girada mede outro terreno (o desnível muda com o ângulo)');
  // acima do máximo: declive, com o desnível e o máximo na recusa
  const d = achar(sim, 'terreiro', (p) => p.codigo === 'declive');
  assert.ok(d);
  const semAplainar = sim.q.construir.previa({ tipo: 'terreiro', x: a.x, z: a.z, rot: 0, alinhar: false });
  assert.equal(semAplainar.codigo, 'declive', 'sem aceitar o aplainar a prévia de antes recusa');
  assert.ok(d.p.dados.desnivel > d.p.dados.max && d.p.dados.max === 8, JSON.stringify(d.p.dados));
  // abaixo do livre: sem custo de aplainar
  const plano = achar(sim, 'terreiro', (p) => p.ok && !p.aplainar);
  assert.ok(plano);
  assert.equal(plano.p.custoAplainar, 0);
  assert.equal(plano.p.custo, 1000);
  // construir paga o aplainar, alonga a obra e deixa a plataforma plana na cota
  const caixa0 = sim.holding.caixa();
  // quem chama sem aceitar o aplainar (o robô, as sugestões) continua recusando o declive acima do livre, como antes
  const sem = sim.cmd('construir', { tipo: 'terreiro', x: a.p.x, z: a.p.z, rot: a.p.rot, alinhar: false });
  assert.equal(sem.codigo, 'declive');
  assert.equal(sem.dados.max, 4, 'o máximo sem aplainar é o livre');
  assert.equal(sim.holding.caixa(), caixa0, 'a recusa não cobra');
  const r = sim.cmd('construir', { tipo: 'terreiro', x: a.p.x, z: a.p.z, rot: a.p.rot, alinhar: false, aplainar: true });
  assert.equal(r.ok, true, r.codigo);
  assert.equal(r.dados.aplainar.custo, ap.custo);
  assert.equal(caixa0 - sim.holding.caixa(), 1000 + ap.custo);
  const P = sim.tabelas.predios;
  const i = idxDaRef(r.id);
  assert.equal(P.obraFim[i] - P.obraIni[i], 40 + ap.tiques, 'a obra curta do aplainar soma os tiques de terraplenagem');
  for (const [dx, dz] of [[-12, -12], [12, -12], [-12, 12], [12, 12], [0, 0]]) assert.ok(Math.abs(sim.alturaEm(a.p.x + dx, a.p.z + dz) - P.y[i]) < 0.05, `plano em ${dx},${dz}`);
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) }), []);
  assert.deepEqual(sim.validar(), []);
  // sem caixa para o aplainar: recusa com o que falta, sem mudar nada
  sim.holding.pagar(sim.holding.caixa() - 1000, 'teste');
  const b = achar(sim, 'terreiro', (p) => p.codigo === 'creditos' && p.aplainar, { x0: 1300 });
  assert.ok(b, 'um lugar que pede aplainar e o caixa não paga');
  assert.equal(b.p.dados.faltam, b.p.custo - 1000);
  assert.deepEqual(sim.erros, []);
});

test('colocar (D98): cada código de vermelho traz o seu dado (marco, gleba, água, acesso, recurso, colisão com prédio)', () => {
  const sim = criarSimulacao({ semente: 'ux1-codigos' });
  comTerreiro(sim);
  rua(sim, [[1100, -300], [1500, -300]]);
  // marco: a clínica abre no marco 1 (o catálogo diz o mesmo)
  const m = sim.q.construir.previa({ tipo: 'clinica', x: 1300, z: -330 });
  assert.equal(m.codigo, 'marco');
  assert.equal(m.dados.marco, 1);
  assert.equal(sim.q.catalogo('servicos').find((x) => x.tipo === 'clinica').marcoLibera, 1);
  assert.equal(sim.q.catalogo('lazer').find((x) => x.tipo === 'praca').marcoLibera, 0);
  // gleba: o centro do disco da sede
  assert.equal(sim.q.construir.previa({ tipo: 'terreiro', x: 200, z: 190, rot: 0, alinhar: false }).codigo, 'gleba');
  // água: em cima do mar
  const ag = achar(sim, 'terreiro', (p) => p.codigo === 'agua');
  assert.ok(ag && ag.p.dados.sobre === true);
  // acesso: a praça sem via a 60 m (alinhar) e a 24 m (livre), e o que dispensa a via vale
  const sem = sim.q.construir.previa({ tipo: 'praca', x: 1300, z: -1280 });
  assert.equal(sem.codigo, 'acesso');
  assert.deepEqual(sem.dados, { max: 60, alinhar: true });
  assert.equal(sim.q.construir.previa({ tipo: 'praca', x: 1300, z: -1280, alinhar: false }).dados.max, 24);
  assert.equal(dispensaAcesso(sim.colocaveis.obter('terreiro')), true);
  assert.equal(dispensaAcesso(sim.colocaveis.obter('praca')), false);
  assert.equal(dispensaAcesso(sim.colocaveis.obter('captacao')), true, 'o que só vale na margem da água dispensa a via');
  assert.equal(dispensaAcesso(sim.colocaveis.obter('pedreira')), true, 'o que só vale sobre o recurso dispensa a via');
  // recurso: a pedreira numa planície sem rocha diz o recurso e quanto tem
  const rec = sim.q.construir.previa({ tipo: 'pedreira', x: 1200, z: -330 });
  assert.equal(rec.codigo, 'recurso');
  assert.equal(rec.dados.recurso, 'rocha');
  assert.ok(rec.dados.media < rec.dados.minimo);
  // colisão com prédio: a segunda praça em cima da primeira diz qual é e quanto afastar
  const um = sim.q.construir.previa({ tipo: 'praca', x: 1300, z: -330 });
  assert.equal(um.ok, true);
  const feito = sim.cmd('construir', { tipo: 'praca', x: um.x, z: um.z, rot: um.rot });
  assert.equal(feito.ok, true);
  const dois = sim.q.construir.previa({ tipo: 'praca', x: 1304, z: -330 });
  assert.equal(dois.codigo, 'colisao');
  assert.equal(dois.dados.com, 'predio');
  assert.equal(dois.dados.ref, feito.id);
  assert.ok(dois.dados.afastar >= 1 && dois.dados.afastar <= 40, `afastar ${dois.dados.afastar}`);
  assert.equal(dois.dados.nome, SERVICOS.praca.nome);
  // e o comando recusa com o mesmo código e os mesmos dados
  const c = sim.cmd('construir', { tipo: 'praca', x: dois.x, z: dois.z, rot: dois.rot });
  assert.equal(c.codigo, 'colisao');
  assert.equal(c.dados.com, 'predio');
  assert.deepEqual(sim.erros, []);
});

test('colocar (D98): o colocável girado vê a via por qualquer lado, e o que dispensa a via nasce sem ela com o aviso de sem acesso', () => {
  const sim = criarSimulacao({ semente: 'ux1-acesso', modo: 'livre' });
  comTerreiro(sim);
  rua(sim, [[960, -300], [1440, -300]]);
  // clínica livre, de costas para a via (rot 180 graus), a 30 m dela: a frente olha para longe, o fundo vê a via
  const p = sim.q.construir.previa({ tipo: 'clinica', x: 1200, z: -335, rot: Math.PI, alinhar: false });
  assert.equal(p.ok, true, p.codigo);
  assert.ok(p.via !== null, 'a prévia diz a via do acesso');
  const r = sim.cmd('construir', { tipo: 'clinica', x: p.x, z: p.z, rot: p.rot, alinhar: false });
  assert.equal(r.ok, true, r.codigo);
  const ac = acessoDe(sim, idxDaRef(r.id));
  assert.ok(ac.e >= 0, 'o prédio construído de costas também tem acesso (cobertura e redes saem da via)');
  assert.equal(sim.q.predio(r.id).avisos.some((a) => a.codigo === 'semAcesso'), false);
  // o terreiro longe de toda via: nasce, e a folha avisa que falta a via
  const lugar = achar(sim, 'terreiro', (p) => p.ok && !p.aplainar && p.via === null, { rot: 0.4, z0: -1100, z1: -700 });
  assert.ok(lugar, 'um lugar plano longe de via');
  const t = lugar.p;
  assert.equal(t.via, null);
  const r2 = sim.cmd('construir', { tipo: 'terreiro', x: t.x, z: t.z, rot: t.rot, alinhar: false });
  assert.equal(r2.ok, true, r2.codigo);
  assert.equal(acessoDe(sim, idxDaRef(r2.id)).e, -1);
  assert.equal(sim.q.predio(r2.id).avisos.some((a) => a.codigo === 'semAcesso' && a.acao === 'construirVia'), true);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});
