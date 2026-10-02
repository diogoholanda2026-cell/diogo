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
import { trans, acessoDe } from '../../fonte/sim/predios.js';
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
  const [e] = rua(sim, [[-760, -300], [-280, -300]]);
  const caixa0 = sim.holding.caixa();
  const { previa, r } = colocar(sim, 'clinica', -520, -330, 0);
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
  assert.equal(sim.q.construir.previa({ tipo: 'clinica', x: -520, z: -330, rot: 0 }).codigo, 'colisao');
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
  rua(sim, [[-760, -300], [-280, -300]]);
  assert.equal(sim.q.construir.previa({ tipo: 'clinica', x: -520, z: -330 }).codigo, 'marco');
  assert.equal(sim.q.construir.previa({ tipo: 'nada', x: 0, z: 0 }).codigo, 'valor');
  assert.equal(sim.cmd('construir', { tipo: 'praca', x: NaN, z: 0 }).codigo, 'valor');
  assert.equal(sim.q.construir.previa({ tipo: 'praca', x: 3000, z: 3000 }).codigo, 'acesso');
  // a captação pede água a até 40 m do fundo: no meio da rua, longe do rio, não
  assert.equal(sim.q.construir.previa({ tipo: 'captacao', x: -520, z: -330 }).codigo, 'agua');
  // créditos: a Holding sem caixa
  sim.holding.pagar(sim.holding.caixa(), 'teste');
  const p = sim.q.construir.previa({ tipo: 'praca', x: -520, z: -330 });
  assert.equal(p.codigo, 'creditos');
  assert.equal(sim.cmd('construir', { tipo: 'praca', x: p.x, z: p.z, rot: p.rot }).codigo, 'creditos');
  assert.deepEqual(sim.erros, []);
});

test('cobertura cai com a distância pela via e não passa para um componente sem ligação', () => {
  const sim = criarSimulacao({ semente: 'serv-cobertura', modo: 'livre' });
  const es = rua(sim, [[-760, -300], [-120, -300]], 'avenida');
  const solta = rua(sim, [[-760, -200], [-280, -200]]);
  const { r } = colocar(sim, 'praca', -700, -330);
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
  rua(sim, [[-760, -300], [-280, -300]]);
  rua(sim, [[-520, -300], [-520, 100]]);
  const a = colocar(sim, 'clinica', -700, -330).r;
  terminarObra(sim, idxDaRef(a.id));
  garantirCobertura(sim);
  const b = colocar(sim, 'clinica', -480, -100).r;
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
  rua(sim, [[-760, -300], [-280, -300]]);
  const { r } = colocar(sim, 'delegacia', -520, -330);
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
  assert.ok(sim.cmd('via.construir', plano([[-760, -300], [-280, -300]])).ok);
  const A = sim.tabelas.arestas;
  // a clínica fica a leste do ponto onde o T vai chegar, do outro lado da rua
  const { r } = colocar(sim, 'clinica', -425, -330);
  assert.ok(r?.ok, r?.codigo);
  const i = idxDaRef(r.id);
  terminarObra(sim, i);
  sim.rodar(40, { sincrono: true });
  const AC = { e: -1, s: 0 };
  acessoDe(sim, i, AC);
  const antes = AC.e;
  assert.ok(antes >= 0);
  // o T parte a aresta da clínica: o pedaço que fica com o idx encurta e o acesso tem de ir para o pedaço novo
  assert.ok(sim.cmd('via.construir', plano([[-450, -100], [-450, -300]])).ok);
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
  const r1 = sim.cmd('via.construir', plano([[-760, -300], [-280, -300]]));
  assert.ok(r1.ok && sim.cmd('via.construir', plano([[-760, -240], [-280, -240]])).ok);
  const zr = indiceZona('resBaixa');
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'retangulo', x: -760, z: -300, x2: -280, z2: -240 }, zona: zr }).ok);
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
  rua(sim, [[-760, -300], [-280, -300]]);
  const zr = indiceZona('resBaixa');
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'circulo', x: -520, z: -330, raio: 40 }, zona: zr }).ok);
  const C = sim.tabelas.celulas;
  const P = sim.tabelas.predios;
  const rng = sim.rng('teste');
  for (let c = 0; c < C.n; c++) {
    if (!C.viva[c] || C.zona[c] !== zr || C.linha[c] !== 0 || C.estado[c] !== CELULA.LIVRE) continue;
    const i = nascerNaFrente(sim, c, zr, rng);
    if (i >= 0) terminarObra(sim, i);
  }
  const p = sim.q.construir.previa({ tipo: 'praca', x: -520, z: -330 });
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
  rua(sim, [[-760, -300], [-280, -300]]);
  const p = sim.q.construir.previa({ tipo: 'escolaF', x: -520, z: -330 });
  assert.ok(Array.isArray(p.efeitos) && p.efeitos[0].camada === 'servicos');
  const { r } = colocar(sim, 'escolaF', -520, -330);
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

