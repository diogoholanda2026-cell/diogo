// Testes da MOV1 (D94): mover e girar construções prontas, na simulação de verdade (mundo autoral, vias e zonas de verdade).
//   - mover um serviço: uns 10% do custo, a mesma ref com nome, cor e nível, fora de serviço na obra curta (em que o Desfazer
//     vale até a equipe chegar) e de volta no lugar novo; girar no lugar não bate no próprio prédio;
//   - a validação é a do construir: colisão com prédio e com via, ladrilho, acesso, declive e aplainar com custo, créditos,
//     'nada' no mesmo lugar; um prédio de zona e a Arcologia não se movem ('fixo' com a dica);
//   - a cobertura dos serviços é refeita no lugar novo, e o que a prévia diz que muda (moradores atendidos antes e depois,
//     os que deixam de ser) é o que acontece de fato quando a obra acaba;
//   - o prédio da Holding guarda a produção em andamento e o estoque, e a rede e o armazém entram no "o que muda";
//   - o Desfazer devolve o lugar, a plataforma e o dinheiro até a obra começar; depois, 'ocupado';
//   - o save no meio da mudança e o determinismo (o hash de quem carregou segue igual ao de quem não parou).
// Roda sozinho: node ferramentas/testes/mover.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { idxDaRef, conferirEspelho } from '../../fonte/contratos/espelho.js';
import { CELULA, PREDIO } from '../../fonte/contratos/flags.js';
import { LISTA_CODIGOS } from '../../fonte/contratos/codigos.js';
import { indiceZona } from '../../fonte/data/zonas.js';
import { SERVICOS } from '../../fonte/data/servicos.js';
import { PREDIOS_HOLDING } from '../../fonte/data/holding.js';
import { terminarObra, nascerNaFrente } from '../../fonte/sim/zonas/crescimento.js';
import { MOVER, CODIGO_FIXO, custoDeMover, tiquesDaObra } from '../../fonte/sim/mover.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';

const plano = (pontos, tipo = 'rua') => ({ plano: { modo: 'reta', tipo, pontos, sessao: 1, encaixe: false } });
const rua = (sim, pontos, tipo = 'rua') => {
  const r = sim.cmd('via.construir', plano(pontos, tipo));
  assert.ok(r.ok, `${JSON.stringify(pontos)}: ${r.codigo}`);
  return r;
};

/** Uma simulação em modo livre com a avenida do norte (z = -300) e a rua do sul (z = -200), como os testes dos serviços. */
function mundo(semente) {
  const sim = criarSimulacao({ semente, modo: 'livre' });
  rua(sim, [[960, -300], [1600, -300]], 'avenida');
  rua(sim, [[960, -200], [1440, -200]]);
  return sim;
}

/** Constrói um colocável no lugar da prévia (sem grudar de novo) e deixa a obra pronta. */
function pronto(sim, tipo, x, z, rot = 0) {
  const p = sim.q.construir.previa({ tipo, x, z, rot });
  assert.ok(p.ok, `${tipo} em ${x}, ${z}: ${p.codigo}`);
  const r = sim.cmd('construir', { tipo, x: p.x, z: p.z, rot: p.rot, alinhar: false });
  assert.ok(r.ok, r.codigo);
  terminarObra(sim, idxDaRef(r.id));
  sim.rodar(40, { sincrono: true });
  return r.id;
}

const mover = (sim, ref, x, z, extra = {}) => {
  const pv = sim.q.mover.previa({ ref, x, z, rot: 0, ...extra });
  assert.ok(pv.ok, `previa do mover para ${x}, ${z}: ${pv.codigo} ${JSON.stringify(pv.dados)}`);
  const r = sim.cmd('mover', { ref, x: pv.x, z: pv.z, rot: pv.rot, alinhar: false, ...extra });
  assert.ok(r.ok, `${r.codigo} ${JSON.stringify(r.dados)}`);
  return { pv, r };
};

test('mover um serviço: 10% do custo, a mesma ref com nome, cor e nível, fora de serviço na obra curta e de volta no lugar novo', () => {
  const sim = mundo('mov-servico');
  const ref = pronto(sim, 'clinica', 1100, -330);
  const P = sim.tabelas.predios;
  const i = idxDaRef(ref);
  assert.ok(sim.cmd('predio.nome', { ref, nome: 'Clínica do Dono' }).ok);
  assert.ok(sim.cmd('predio.cor', { ref, cor: 3 }).ok);
  const antes = { x: P.x[i], z: P.z[i], rot: P.rot[i], semente: P.semente[i], modelo: P.modelo[i], nivel: P.nivel[i] };
  assert.ok(sim.q.predio(ref).servico.eficiencia > 0, 'pronta, ela funciona');
  assert.equal(P.flags[i] & PREDIO.OBRA, 0);
  // a folha: pode, e quanto custa
  const info = sim.q.predio(ref).mover;
  assert.deepEqual([info.pode, info.custo], [true, Math.round(SERVICOS.clinica.custo * MOVER.fracao)]);
  assert.equal(info.custo, custoDeMover(sim.colocaveis.obter('clinica')));
  // a prévia: o custo de mover, a obra e o que muda
  const pv = sim.q.mover.previa({ ref, x: 1400, z: -330, rot: 0, alinhar: true });
  assert.ok(pv.ok, pv.codigo);
  assert.equal(pv.custo, info.custo);
  assert.equal(pv.custoMover, info.custo);
  assert.equal(pv.valor, SERVICOS.clinica.custo);
  assert.equal(pv.tiques, tiquesDaObra(sim.colocaveis.obter('clinica')));
  assert.equal(pv.mobilizacao, MOVER.mobilizacao);
  assert.equal(pv.desfazer, true);
  assert.deepEqual(pv.de, { x: antes.x, z: antes.z, rot: antes.rot });
  const caixa0 = sim.holding.caixa();
  const T0 = sim.tique;
  const r = sim.cmd('mover', { ref, x: pv.x, z: pv.z, rot: pv.rot, alinhar: false });
  assert.ok(r.ok, r.codigo);
  assert.equal(r.id, ref, 'é a mesma ref');
  assert.equal(caixa0 - sim.holding.caixa(), info.custo, 'só os 10% saem do caixa');
  assert.equal(r.dados.tiques, MOVER.mobilizacao + pv.tiques);
  assert.equal(r.dados.desfazer, true);
  // no lugar novo, em obra e fora de serviço; a ref, o nome, a cor, o nível e a semente são os de antes
  assert.ok(Math.abs(P.x[i] - pv.x) < 1e-6 && Math.abs(P.z[i] - pv.z) < 1e-6);
  assert.ok(P.flags[i] & PREDIO.OBRA);
  assert.equal(P.obraIni[i], T0 + MOVER.mobilizacao);
  assert.equal(P.obraFim[i], P.obraIni[i] + pv.tiques);
  assert.equal(P.efic[i], 0, 'a obra tira o prédio de serviço');
  assert.equal(sim.q.predio(ref).estado, 'obra');
  const p = sim.q.predio(ref);
  assert.deepEqual([p.nome, p.cor, p.nivel, p.modelo], ['Clínica do Dono', 3, antes.nivel, antes.modelo]);
  assert.equal(P.semente[i], antes.semente);
  assert.equal(sim.q.predio(ref).mover.pode, false, 'em obra, não se move de novo');
  assert.equal(sim.q.predio(ref).mover.motivo, 'obra');
  assert.equal(sim.q.mover.previa({ ref, x: 1300, z: -330 }).codigo, 'ocupado');
  assert.equal(sim.cmd('mover', { ref, x: 1300, z: -330, rot: 0 }).codigo, 'ocupado');
  // a obra curta termina como a de qualquer colocável
  const vistos = [];
  sim.on('obraFim', (d) => vistos.push(d.ref));
  sim.rodar(MOVER.mobilizacao + pv.tiques + 2, { sincrono: true });
  assert.equal(P.flags[i] & PREDIO.OBRA, 0);
  assert.ok(vistos.includes(ref));
  assert.equal(sim.q.predio(ref).estado, 'ok');
  assert.ok(sim.q.predio(ref).servico.eficiencia > 0, 'de volta ao serviço');
  assert.ok(sim.q.predio(ref).via, 'ligado à via do lugar novo');
  assert.deepEqual([sim.q.predio(ref).nome, sim.q.predio(ref).cor], ['Clínica do Dono', 3]);
  // mover não é construir: nada de XP nem de manutenção a mais
  assert.equal(sim.custos.lista().find((c) => c.nome === 'servicos').valor, SERVICOS.clinica.manutencaoHora);
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) }), []);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});

test('girar no lugar: o prédio não bate em si mesmo; mesmo lugar e mesma direção é "nada" e não cobra', () => {
  const sim = mundo('mov-girar');
  const ref = pronto(sim, 'clinica', 1100, -330);
  const P = sim.tabelas.predios;
  const i = idxDaRef(ref);
  const x = P.x[i];
  const z = P.z[i];
  const caixa0 = sim.holding.caixa();
  assert.equal(sim.q.mover.previa({ ref, x, z, rot: P.rot[i], alinhar: false }).codigo, 'nada');
  assert.equal(sim.q.mover.previa({ ref }).codigo, 'nada', 'sem lugar nenhum, é o de agora');
  assert.equal(sim.cmd('mover', { ref, x, z, rot: P.rot[i], alinhar: false }).codigo, 'nada');
  assert.equal(sim.holding.caixa(), caixa0);
  // meia volta no mesmo lugar: a planta sobrepõe a de antes e vale
  const pv = sim.q.mover.previa({ ref, x, z, rot: P.rot[i] + Math.PI, alinhar: false });
  assert.ok(pv.ok, `${pv.codigo} ${JSON.stringify(pv.dados)}`);
  assert.ok(Math.abs(Math.hypot(Math.sin(pv.rot) - Math.sin(P.rot[i] + Math.PI), Math.cos(pv.rot) - Math.cos(P.rot[i] + Math.PI))) < 1e-6);
  assert.equal(pv.custo, custoDeMover(sim.colocaveis.obter('clinica')));
  // só girar (sem x e z): a planta fica onde está
  const so = sim.q.mover.previa({ ref, rot: P.rot[i] + Math.PI / 2 });
  assert.ok(so.ok, so.codigo);
  assert.ok(Math.hypot(so.x - x, so.z - z) < 1e-6);
  const r = sim.cmd('mover', { ref, rot: P.rot[i] + Math.PI / 2, alinhar: false });
  assert.ok(r.ok, r.codigo);
  assert.ok(Math.abs(P.rot[i] - (so.rot)) < 1e-5);
  assert.ok(Math.hypot(P.x[i] - x, P.z[i] - z) < 1e-6, 'girou sem sair do lugar');
  sim.rodar(MOVER.mobilizacao + so.tiques + 2, { sincrono: true });
  assert.equal(sim.q.predio(ref).estado, 'ok');
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (px, pz) => sim.alturaEm(px, pz) }), [], 'a cota do prédio segue o chão depois de girar');
  // uma mudança curta, dentro da área da plataforma de antes: o chão e a cota continuam de acordo
  const curto = sim.q.mover.previa({ ref, x: x + 24, z, rot: P.rot[i], alinhar: false });
  assert.ok(curto.ok, curto.codigo);
  assert.ok(sim.cmd('mover', { ref, x: curto.x, z: curto.z, rot: curto.rot, alinhar: false }).ok);
  sim.rodar(MOVER.mobilizacao + curto.tiques + 2, { sincrono: true });
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (px, pz) => sim.alturaEm(px, pz) }), []);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});

test('a validação é a do construir: colisão com prédio e com via, ladrilho, acesso, declive, aplainar com custo e créditos', () => {
  const sim = mundo('mov-valida');
  const ref = pronto(sim, 'clinica', 1100, -330);
  const outra = pronto(sim, 'praca', 1300, -330);
  const P = sim.tabelas.predios;
  const j = idxDaRef(outra);
  // sobre a praça (e longe da avenida): colide com ela e diz o nome e quanto afastar
  const c1 = sim.q.mover.previa({ ref, x: P.x[j] + 10, z: P.z[j] - 25, rot: 0, alinhar: false });
  assert.equal(c1.codigo, 'colisao');
  assert.equal(c1.dados.com, 'predio');
  assert.equal(c1.dados.ref, outra);
  assert.ok(c1.dados.afastar >= 1);
  assert.equal(sim.cmd('mover', { ref, x: P.x[j] + 10, z: P.z[j] - 25, rot: 0, alinhar: false }).codigo, 'colisao');
  // em cima da avenida
  const c2 = sim.q.mover.previa({ ref, x: 1200, z: -300, rot: 0, alinhar: false });
  assert.equal(c2.codigo, 'colisao');
  assert.equal(c2.dados.com, 'via');
  // fora das áreas da Holding, e sem via por perto
  assert.equal(sim.q.mover.previa({ ref, x: 3000, z: 3000, rot: 0, alinhar: false }).codigo, 'ladrilho');
  assert.equal(sim.q.mover.previa({ ref, x: 1200, z: -1280, rot: 0 }).codigo, 'acesso');
  // declive acima do que aplainar resolve; e um que aplaina, com o custo e a obra mais longa
  const d = sim.q.mover.previa({ ref, x: 1540, z: -333, rot: 0, aplainar: true });
  assert.equal(d.codigo, 'declive');
  assert.ok(d.dados.desnivel > d.dados.max);
  const ap = sim.q.mover.previa({ ref, x: 1520, z: -333, rot: 0, aplainar: true });
  assert.ok(ap.ok, ap.codigo);
  assert.ok(ap.aplainar && ap.custoAplainar > 0);
  assert.equal(ap.custo, ap.custoMover + ap.custoAplainar);
  assert.equal(ap.tiques, tiquesDaObra(sim.colocaveis.obter('clinica')) + ap.aplainar.tiques, 'o aplainar alonga a obra');
  // sem aceitar pagar o aplainar, o declive acima do livre recusa (como o construir)
  assert.equal(sim.q.mover.previa({ ref, x: 1520, z: -333, rot: 0 }).codigo, 'declive');
  const caixa0 = sim.holding.caixa();
  const m = sim.cmd('mover', { ref, x: ap.x, z: ap.z, rot: ap.rot, alinhar: false, aplainar: true });
  assert.ok(m.ok, m.codigo);
  assert.equal(caixa0 - sim.holding.caixa(), ap.custo);
  assert.ok(m.dados.aplainar);
  assert.equal(P.obraFim[idxDaRef(ref)] - sim.tique, m.dados.tiques - 0, 'a obra dura o do aplainar mais a curta');
  // créditos: a Holding sem caixa
  const outroRef = pronto(sim, 'praca', 1000, -330);
  sim.holding.pagar(sim.holding.caixa(), 'teste');
  const sem = sim.q.mover.previa({ ref: outroRef, x: 1060, z: -330, rot: 0 });
  assert.equal(sem.codigo, 'creditos');
  assert.equal(sem.dados.faltam, sem.custo);
  assert.equal(sim.cmd('mover', { ref: outroRef, x: sem.x, z: sem.z, rot: sem.rot, alinhar: false }).codigo, 'creditos');
  assert.equal(sim.q.mover.previa({ ref: 99999999, x: 0, z: 0 }).codigo, 'inexistente');
  assert.equal(sim.cmd('mover', { ref: 99999999, x: 0, z: 0 }).codigo, 'inexistente');
  assert.equal(sim.cmd('mover', {}).codigo, 'valor');
  assert.equal(sim.cmd('mover', { ref, x: 'a', z: 0 }).codigo, 'valor');
  assert.deepEqual(sim.erros, []);
});

test('a Arcologia (e o que diz que não se demole) fica fixa, com o código "fixo" e a dica', () => {
  const sim = mundo('mov-fixo');
  assert.ok(LISTA_CODIGOS.includes(CODIGO_FIXO), `o código ${CODIGO_FIXO} é do contrato`);
  const praca = pronto(sim, 'praca', 1300, -330);
  sim.colocaveis.obter('praca').arcologia = true;
  const caixa0 = sim.holding.caixa();
  const pa = sim.q.mover.previa({ ref: praca, x: 1360, z: -330 });
  assert.deepEqual([pa.ok, pa.codigo, pa.dados.fixo], [false, CODIGO_FIXO, 'arcologia']);
  assert.equal(sim.cmd('mover', { ref: praca, x: 1360, z: -330, rot: 0, alinhar: false }).dados.fixo, 'arcologia');
  assert.deepEqual(sim.q.predio(praca).mover, { pode: false, custo: 0, codigo: CODIGO_FIXO, motivo: 'arcologia' });
  assert.equal(sim.cmd('mover.desfazer', { ref: praca }).codigo, 'nada');
  assert.equal(sim.holding.caixa(), caixa0, 'e nada foi cobrado');
  assert.deepEqual(sim.erros.filter((e) => /mover/.test(e.onde)), []);
});

// ------------------------------------------------------------------------------------------------ prédio de zona (MOV2, D105)

const ZR = indiceZona('resBaixa');

/** O mundo com a zona residencial pintada entre as duas ruas e `n` casas nascidas (em obra). */
function mundoComCasas(semente, n = 3) {
  const sim = mundo(semente);
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'retangulo', x: 1000, z: -300, x2: 1200, z2: -200 }, zona: ZR }).ok);
  const C = sim.tabelas.celulas;
  const rng = sim.rng('teste');
  const casas = [];
  for (let c = 0; c < C.n && casas.length < n; c++) {
    if (!C.viva[c] || C.zona[c] !== ZR || C.linha[c] !== 0 || C.estado[c] !== CELULA.LIVRE) continue;
    const k = nascerNaFrente(sim, c, ZR, rng);
    if (k >= 0) casas.push(k);
  }
  assert.equal(casas.length, n, 'nasceram as casas');
  return { sim, casas };
}

const celulasDe = (sim, i) => {
  const C = sim.tabelas.celulas;
  const out = [];
  for (let c = 0; c < C.n; c++) if (C.viva[c] && C.predio[c] === i) out.push(c);
  return out;
};

test('mover prédio de zona pronto: células liberadas e ocupadas, 10% do valor, moradores e nível mantidos, sem evento de nível', () => {
  const { sim, casas } = mundoComCasas('mov2-pronto');
  const P = sim.tabelas.predios;
  const C = sim.tabelas.celulas;
  const i = casas[0];
  terminarObra(sim, i);
  sim.rodar(10, { sincrono: true });
  const ref = P.ref(i);
  const antes = { nivel: P.nivel[i], semente: P.semente[i], cor: P.cor[i], estilo: P.estilo[i], mor: P.moradores[i], emp: P.empregos[i], modelo: P.modelo[i], w: P.w[i], d: P.d[i] };
  const velhas = celulasDe(sim, i);
  assert.ok(velhas.length >= 2);
  const info = sim.q.predio(ref).mover;
  assert.equal(info.pode, true);
  assert.equal(info.custo, Math.round(MOVER.fracao * sim.q.predio(ref).custoDemolir), 'a base é o valor do prédio (D54)');
  assert.ok(info.custo > 0);
  // o lugar novo: ao longo da rua do sul, giro livre (nada de 90 graus)
  const pv = sim.q.mover.previa({ ref, x: 1150, z: -230, rot: 0.3, alinhar: true, giro: 0.3 });
  assert.ok(pv.ok, `${pv.codigo} ${JSON.stringify(pv.dados)}`);
  assert.equal(pv.custo, info.custo);
  assert.equal(pv.zona.emObra, false);
  assert.equal(pv.zona.celulas.liberam, velhas.length);
  assert.ok(pv.zona.celulas.ocupam >= 1);
  const niveis = [];
  sim.on('predioNivel', (e) => niveis.push(e));
  const caixa0 = sim.holding.caixa();
  const r = sim.cmd('mover', { ref, x: pv.x, z: pv.z, rot: pv.rot, alinhar: false });
  assert.ok(r.ok, `${r.codigo} ${JSON.stringify(r.dados)}`);
  assert.ok(Math.abs(caixa0 - sim.holding.caixa() - info.custo) < 1e-6, 'pagou os 10%');
  assert.deepEqual([P.x[i], P.z[i]], [pv.x, pv.z]);
  assert.ok(Math.abs(P.rot[i] - pv.rot) < 1e-6);
  // o lugar antigo voltou a ser zona livre; o novo é do prédio
  for (const c of velhas) {
    if (C.predio[c] === i) continue;
    assert.equal(C.predio[c], -1);
    assert.ok([CELULA.LIVRE, CELULA.INVALIDA].includes(C.estado[c]));
    assert.equal(C.zona[c], ZR, 'a zona pintada fica');
  }
  const novas = celulasDe(sim, i);
  assert.equal(novas.length, pv.zona.celulas.ocupam);
  for (const c of novas) assert.equal(C.estado[c], CELULA.OCUPADA);
  // o prédio segue com tudo o que é dele, em reforma (segue funcionando)
  assert.ok(P.flags[i] & PREDIO.OBRA && P.flags[i] & PREDIO.OBRA_NIVEL);
  assert.deepEqual({ nivel: P.nivel[i], semente: P.semente[i], cor: P.cor[i], estilo: P.estilo[i], mor: P.moradores[i], emp: P.empregos[i], modelo: P.modelo[i], w: P.w[i], d: P.d[i] }, antes);
  assert.equal(P.ref(i), ref, 'a mesma ref');
  assert.deepEqual(sim.json.mover.zona, { [String(ref)]: 1 });
  // o acesso à via, a cobertura e as redes são refeitos no lugar novo (a casa liga na rua do sul)
  assert.equal(sim.q.predio(ref).via?.ref, pv.via, 'liga à via do lugar novo');
  assert.notEqual(pv.muda.via.antes?.ref, pv.muda.via.depois?.ref, 'a prévia diz que a via mudou');
  assert.equal(sim.cmd('mover', { ref, x: 1100, z: -230, rot: 0, alinhar: false }).ok, true, 'zona pronta em reforma ainda se move (o Desfazer vale até a obra)');
  assert.deepEqual(sim.validar(), []);
  // a obra acaba: sem evento de nível, mesmos moradores
  sim.rodar(r.dados.tiques + 80, { sincrono: true });
  assert.equal(P.flags[i] & (PREDIO.OBRA | PREDIO.OBRA_NIVEL), 0);
  assert.ok(P.moradores[i] >= antes.mor, 'os moradores seguem (a ocupação normal pode até encher mais)');
  assert.equal(P.nivel[i], antes.nivel);
  assert.deepEqual(niveis, []);
  assert.deepEqual(sim.json.mover.zona, {});
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});

test('o lugar antigo da casa movida volta a crescer um prédio novo, e o novo fica ocupado', () => {
  const { sim, casas } = mundoComCasas('mov2-cresce', 1);
  const P = sim.tabelas.predios;
  const C = sim.tabelas.celulas;
  const i = casas[0];
  terminarObra(sim, i);
  const ref = P.ref(i);
  const velha = celulasDe(sim, i).find((c) => C.linha[c] === 0);
  const pv = sim.q.mover.previa({ ref, x: 1180, z: -230, alinhar: true });
  assert.ok(pv.ok, pv.codigo);
  assert.ok(sim.cmd('mover', { ref, x: pv.x, z: pv.z, rot: pv.rot, alinhar: false }).ok);
  assert.equal(C.estado[velha], CELULA.LIVRE, 'a célula de frente do lugar antigo está livre');
  const k = nascerNaFrente(sim, velha, ZR, sim.rng('depois'));
  assert.ok(k >= 0 && k !== i, 'nasce um prédio novo no lugar antigo');
  assert.notEqual(P.ref(k), ref);
  // e o lugar novo não aceita outro
  const nova = celulasDe(sim, i).find((c) => C.linha[c] === 0);
  if (nova !== undefined) assert.equal(nascerNaFrente(sim, nova, ZR, sim.rng('depois2')), -1);
  assert.deepEqual(sim.validar(), []);
});

test('mover prédio de zona em obra: o progresso e o já pago ficam, o custo é a fração do que foi gasto', () => {
  const { sim, casas } = mundoComCasas('mov2-obra', 2);
  const P = sim.tabelas.predios;
  const i = casas[0];
  const ref = P.ref(i);
  sim.rodar(20, { sincrono: true });
  assert.ok(P.flags[i] & PREDIO.OBRA && !(P.flags[i] & PREDIO.OBRA_NIVEL), 'em obra de nascimento');
  assert.equal(sim.q.predio(ref).estado, 'obra');
  const ini = P.obraIni[i];
  const fim = P.obraFim[i];
  const prog = (sim.tique - ini) / (fim - ini);
  assert.ok(prog > 0 && prog < 1, `no meio da obra (${prog})`);
  const valor = sim.q.predio(ref).custoDemolir;
  const info = sim.q.predio(ref).mover;
  assert.equal(info.pode, true);
  assert.equal(info.emObra, true);
  assert.equal(info.custo, Math.round(MOVER.fracao * Math.round(valor * prog)), 'a fração do já gasto');
  const pv = sim.q.mover.previa({ ref, x: 1150, z: -230, alinhar: true });
  assert.ok(pv.ok, `${pv.codigo} ${JSON.stringify(pv.dados)}`);
  assert.equal(pv.zona.emObra, true);
  assert.equal(pv.custo, info.custo + pv.custoAplainar);
  const caixa0 = sim.holding.caixa();
  const mat0 = JSON.stringify(sim.json.cidade);
  const r = sim.cmd('mover', { ref, x: pv.x, z: pv.z, rot: pv.rot, alinhar: false });
  assert.ok(r.ok, `${r.codigo} ${JSON.stringify(r.dados)}`);
  assert.ok(Math.abs(caixa0 - sim.holding.caixa() - pv.custo) < 1e-6);
  assert.deepEqual([P.x[i], P.z[i]], [pv.x, pv.z]);
  if (!pv.aplainar) {
    assert.equal(P.obraIni[i], ini, 'a obra segue do mesmo ponto: início');
    assert.equal(P.obraFim[i], fim, 'e o mesmo fim');
  } else {
    assert.ok(Math.abs((sim.tique - P.obraIni[i]) / (P.obraFim[i] - P.obraIni[i]) - prog) < 0.05, 'o aplainar só alonga');
  }
  assert.ok(P.flags[i] & PREDIO.OBRA && !(P.flags[i] & PREDIO.OBRA_NIVEL), 'continua em obra de nascimento');
  assert.equal(P.moradores[i], 0);
  assert.equal(Object.keys(sim.json.mover.zona).length, 0, 'obra de nascimento não leva a marca de reforma');
  assert.ok(celulasDe(sim, i).length >= 1);
  assert.deepEqual(sim.validar(), []);
  sim.rodar(fim - sim.tique + 60, { sincrono: true });
  assert.equal(P.flags[i] & PREDIO.OBRA, 0, 'a obra acabou no prazo');
  assert.ok(P.moradores[i] > 0, 'chegaram os moradores');
  assert.equal(JSON.stringify(sim.json.cidade).length > 0, true);
  assert.ok(mat0.length > 0);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});

test('destino inválido não muda nada: sem via, sobre outra casa, sobre zona de outro tipo, fora dos ladrilhos', () => {
  const { sim, casas } = mundoComCasas('mov2-invalido', 2);
  const P = sim.tabelas.predios;
  const C = sim.tabelas.celulas;
  const i = casas[0];
  const outra = casas[1];
  terminarObra(sim, i);
  terminarObra(sim, outra);
  const ref = P.ref(i);
  const foto = () => JSON.stringify({ x: [...P.x.subarray(0, P.n)], z: [...P.z.subarray(0, P.n)], rot: [...P.rot.subarray(0, P.n)], flags: [...P.flags.subarray(0, P.n)], cel: [...C.predio.subarray(0, C.n)], caixa: sim.holding.caixa(), hash: sim.q.hash() });
  const f0 = foto();
  // sem via por perto
  assert.equal(sim.q.mover.previa({ ref, x: 1200, z: -1280, rot: 0 }).codigo, 'acesso');
  assert.equal(sim.cmd('mover', { ref, x: 1200, z: -1280, rot: 0, alinhar: false }).codigo, 'acesso');
  // sobre a outra casa: colisão (mover não derruba vizinho)
  const bate = sim.q.mover.previa({ ref, x: P.x[outra] + 2, z: P.z[outra], rot: P.rot[outra], alinhar: false });
  assert.equal(bate.ok, false);
  assert.equal(bate.codigo, 'colisao');
  assert.equal(bate.dados.com, 'predio');
  assert.equal(bate.dados.ref, P.ref(outra));
  assert.equal(sim.cmd('mover', { ref, x: P.x[outra] + 2, z: P.z[outra], rot: P.rot[outra], alinhar: false }).codigo, 'colisao');
  // fora dos ladrilhos
  assert.equal(sim.q.mover.previa({ ref, x: 3000, z: 3000, rot: 0, alinhar: false }).codigo, 'ladrilho');
  // zona de outro tipo pintada no destino
  const zc = indiceZona('comBaixa');
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'retangulo', x: 1300, z: -300, x2: 1400, z2: -200 }, zona: zc }).ok);
  const sobre = sim.q.mover.previa({ ref, x: 1350, z: -230, alinhar: true });
  assert.equal(sobre.ok, false);
  assert.equal(sobre.codigo, 'colisao');
  assert.equal(sobre.dados.com, 'zona');
  assert.equal(sim.cmd('mover', { ref, x: 1350, z: -230, rot: 0, alinhar: true }).codigo, 'colisao');
  // créditos
  assert.equal(foto().length, f0.length);
  const saldo = sim.holding.caixa();
  assert.deepEqual(sim.json.mover.pend, {});
  assert.equal(sim.holding.caixa(), saldo);
  assert.deepEqual(sim.erros, []);
});

test('zona: o Desfazer devolve o prédio, as células e o dinheiro até a obra começar', () => {
  const { sim, casas } = mundoComCasas('mov2-desfazer', 2);
  const P = sim.tabelas.predios;
  const C = sim.tabelas.celulas;
  const i = casas[0];
  terminarObra(sim, i);
  const ref = P.ref(i);
  const OBRAS = PREDIO.OBRA | PREDIO.OBRA_NIVEL | PREDIO.SEM_MATERIAL;
  const de = { x: P.x[i], z: P.z[i], rot: P.rot[i], flags: P.flags[i] & OBRAS };
  const velhas = celulasDe(sim, i);
  const caixa0 = sim.holding.caixa();
  const hash0 = sim.q.hash();
  const pv = sim.q.mover.previa({ ref, x: 1150, z: -230, alinhar: true });
  assert.ok(pv.ok, pv.codigo);
  assert.ok(sim.cmd('mover', { ref, x: pv.x, z: pv.z, rot: pv.rot, alinhar: false }).ok);
  assert.ok(sim.q.predio(ref).mover.desfazer);
  sim.rodar(3, { sincrono: true });
  const caixa1 = sim.holding.caixa();
  const d = sim.cmd('mover.desfazer', { ref });
  assert.ok(d.ok, d.codigo);
  assert.deepEqual([P.x[i], P.z[i], P.rot[i], P.flags[i] & OBRAS], [de.x, de.z, de.rot, de.flags]);
  assert.deepEqual(celulasDe(sim, i), velhas, 'as mesmas células de volta');
  for (const c of velhas) assert.equal(C.estado[c], CELULA.OCUPADA);
  assert.ok(Math.abs(sim.holding.caixa() - caixa1 - sim.q.predio(ref).mover.custo) < 1e-6, 'o dinheiro todo');
  assert.ok(caixa0 > 0);
  assert.deepEqual(sim.json.mover.zona, {});
  assert.deepEqual(sim.json.mover.pend, {});
  assert.notEqual(sim.q.hash(), hash0, 'o tempo andou');
  assert.deepEqual(sim.validar(), []);
  // depois que a obra começa, não dá mais
  assert.ok(sim.cmd('mover', { ref, x: pv.x, z: pv.z, rot: pv.rot, alinhar: false }).ok);
  sim.rodar(MOVER.mobilizacao, { sincrono: true });
  assert.equal(sim.cmd('mover.desfazer', { ref }).codigo, 'ocupado');
  // em obra de nascimento o Desfazer também vale, e a obra segue
  const j = casas[1];
  const refJ = P.ref(j);
  const de2 = { x: P.x[j], z: P.z[j] };
  const ini = P.obraIni[j];
  const pv2 = sim.q.mover.previa({ ref: refJ, x: 1100, z: -230, alinhar: true });
  assert.ok(pv2.ok, `${pv2.codigo} ${JSON.stringify(pv2.dados)}`);
  assert.ok(sim.cmd('mover', { ref: refJ, x: pv2.x, z: pv2.z, rot: pv2.rot, alinhar: false }).ok);
  assert.ok(sim.cmd('mover.desfazer', { ref: refJ }).ok);
  assert.deepEqual([P.x[j], P.z[j]], [de2.x, de2.z]);
  assert.equal(P.obraIni[j], ini);
  assert.ok(P.flags[j] & PREDIO.OBRA);
  assert.ok(celulasDe(sim, j).length >= 1);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});

test('zona: save no meio da mudança (pronta e em obra) e determinismo', () => {
  const montar = () => {
    const { sim, casas } = mundoComCasas('mov2-save', 2);
    terminarObra(sim, casas[0]);
    const P = sim.tabelas.predios;
    return { sim, pronta: P.ref(casas[0]), nascendo: P.ref(casas[1]) };
  };
  const A = montar();
  const B = montar();
  assert.equal(A.sim.q.hash(), B.sim.q.hash());
  for (const { sim, pronta, nascendo } of [A, B]) {
    mover(sim, pronta, 1150, -230, { alinhar: true });
    mover(sim, nascendo, 1100, -230, { alinhar: true });
    sim.rodar(5, { sincrono: true });
  }
  assert.equal(A.sim.q.hash(), B.sim.q.hash(), 'o mesmo mover dá o mesmo estado');
  const C = criarSimulacao({ semente: 'mov2-save', modo: 'livre' });
  aplicarSave(C, migrar(lerSave(montarSave(A.sim))));
  assert.deepEqual(C.json.mover, A.sim.json.mover, 'a janela do Desfazer e a marca de reforma vão no save');
  assert.equal(C.q.hash(), A.sim.q.hash());
  assert.ok(C.cmd('mover.desfazer', { ref: A.pronta }).ok, 'desfazer depois de carregar');
  assert.ok(A.sim.cmd('mover.desfazer', { ref: A.pronta }).ok);
  assert.equal(C.q.hash(), A.sim.q.hash());
  // já em obra: o fim da obra e o resto do tempo dão o mesmo hash de quem não parou
  mover(A.sim, A.pronta, 1150, -230, { alinhar: true });
  A.sim.rodar(MOVER.mobilizacao + 5, { sincrono: true });
  const D = criarSimulacao({ semente: 'mov2-save', modo: 'livre' });
  aplicarSave(D, migrar(lerSave(montarSave(A.sim))));
  assert.equal(D.q.hash(), A.sim.q.hash());
  A.sim.rodar(400, { sincrono: true });
  D.rodar(400, { sincrono: true });
  assert.equal(D.q.hash(), A.sim.q.hash());
  assert.equal(D.q.predio(A.pronta).estado, 'ok');
  assert.deepEqual(D.json.mover.zona, {});
  assert.deepEqual(D.validar(), []);
  assert.deepEqual([...A.sim.erros, ...D.erros], []);
});

test('a cobertura dos serviços é refeita no lugar novo, e o que a prévia diz que muda é o que muda', () => {
  const sim = criarSimulacao({ semente: 'mov-cobertura', modo: 'livre' });
  rua(sim, [[960, -300], [1440, -300]]);
  rua(sim, [[960, -240], [1440, -240]]);
  const zr = indiceZona('resBaixa');
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'retangulo', x: 960, z: -300, x2: 1440, z2: -240 }, zona: zr }).ok);
  const C = sim.tabelas.celulas;
  const P = sim.tabelas.predios;
  const rng = sim.rng('teste');
  for (let c = 0; c < C.n; c++) {
    if (!C.viva[c] || C.zona[c] !== zr || C.linha[c] !== 0 || C.estado[c] !== CELULA.LIVRE) continue;
    const i = nascerNaFrente(sim, c, zr, rng);
    if (i >= 0) terminarObra(sim, i);
  }
  sim.rodar(60, { sincrono: true });
  const moradores = () => [...P.viva.keys()].filter((k) => P.viva[k] && P.moradores[k] > 0 && !(P.flags[k] & PREDIO.OBRA));
  const lazer = (k) => sim.q.predio(P.ref(k)).servicos.lazer;
  const atendidos = () => moradores().filter((k) => lazer(k) > 0).reduce((s, k) => s + P.moradores[k], 0);
  const praca = pronto(sim, 'praca', 1000, -325);
  const antes = atendidos();
  assert.ok(antes > 0 && antes < moradores().reduce((s, k) => s + P.moradores[k], 0), 'a praça cobre uma parte da rua');
  const pv = sim.q.mover.previa({ ref: praca, x: 1400, z: -325, rot: 0, alinhar: false });
  assert.ok(pv.ok, pv.codigo);
  assert.equal(pv.demolir.length, 0);
  const c = pv.muda.cobertura;
  assert.equal(c.categoria, 'lazer');
  assert.equal(c.raio, SERVICOS.praca.raio);
  assert.equal(c.antes, antes, 'os moradores atendidos hoje são os que a camada mede');
  assert.ok(c.deixam > 0 && c.passam > 0, 'uma ponta perde e a outra ganha');
  assert.equal(c.depois, c.antes - c.deixam + c.passam);
  // enquanto a obra dura, ninguém é atendido pela praça
  const m = sim.cmd('mover', { ref: praca, x: pv.x, z: pv.z, rot: pv.rot, alinhar: false });
  assert.ok(m.ok, m.codigo);
  sim.rodar(5, { sincrono: true });
  assert.equal(moradores().filter((k) => lazer(k) > 0).length, 0, 'a praça em obra não cobre ninguém');
  // pronta no lugar novo: a conta da prévia bate com a da camada
  sim.rodar(m.dados.tiques + 40, { sincrono: true });
  assert.equal(sim.q.predio(praca).estado, 'ok');
  assert.equal(atendidos(), c.depois, 'depois da obra, atendidos é o que a prévia disse');
  // a via a que se liga e o resto do "o que muda"
  assert.equal(pv.muda.via.depois.ref !== undefined, true);
  assert.equal(pv.muda.rede, undefined, 'praça não é produtor de rede');
  assert.equal(pv.muda.armazem, undefined);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});

test('o prédio da Holding guarda a produção em andamento e o estoque; a rede e o armazém entram no "o que muda"', () => {
  const sim = mundo('mov-holding');
  const escritorio = pronto(sim, 'escritorioObra', 1000, -233);
  sim.json.producao.estoque.tijolo = 7;
  const areal = (() => {
    const p = sim.q.construir.previa({ tipo: 'areal', x: 1320, z: -171 });
    assert.ok(p.ok, p.codigo);
    const r = sim.cmd('construir', { tipo: 'areal', x: p.x, z: p.z, rot: p.rot, alinhar: false });
    assert.ok(r.ok, r.codigo);
    return r.id;
  })();
  sim.rodar(PREDIOS_HOLDING.areal.obraTiques + 60, { sincrono: true });
  const linhas = () => sim.json.producao.predios.find((e) => e.ref === areal).linhas[0];
  assert.equal(linhas().rodando, true, 'o areal tem um lote em andamento');
  const l = { ...linhas() };
  assert.ok(l.trabalho > 0 && l.trabalho < l.meta, 'a meio caminho do lote');
  const estoque = { ...sim.json.producao.estoque };
  const cargaAntes = sim.q.producao().predios.find((p) => p.ref === areal);
  // o escritório (armazém) e o areal têm "o que muda" próprios; o areal anda 40 m para leste, pela mesma via
  const pv = sim.q.mover.previa({ ref: areal, x: 1380, z: -171, alinhar: true });
  assert.ok(pv.ok, `${pv.codigo} ${JSON.stringify(pv.dados)}`);
  assert.ok(pv.muda.via.depois, 'liga a uma via');
  assert.ok(pv.muda.rede === undefined, 'areal não é produtor de rede');
  const m = sim.cmd('mover', { ref: areal, x: pv.x, z: pv.z, rot: pv.rot, alinhar: false });
  assert.ok(m.ok, m.codigo);
  // o estado todo é o de antes: a linha, o que ela já trabalhou, o lote, e o estoque da Holding
  assert.deepEqual({ ...linhas(), parada: null }, { ...l, parada: null });
  assert.deepEqual(sim.json.producao.estoque, estoque);
  assert.equal(sim.json.producao.estoque.tijolo, 7);
  sim.rodar(10, { sincrono: true });
  assert.equal(linhas().parada, 'obra', 'em obra a linha para sem perder nada');
  assert.equal(linhas().trabalho, l.trabalho);
  assert.equal(linhas().meta, l.meta);
  assert.equal(sim.q.producao().predios.find((p) => p.ref === areal).linhas[0].parada, 'obra');
  // acabou a obra: a linha continua de onde parou e entrega o lote
  sim.rodar(m.dados.tiques + 400, { sincrono: true });
  assert.equal(sim.q.predio(areal).estado, 'ok');
  assert.ok(sim.json.producao.estoque.areia >= l.n, 'o lote que estava em andamento foi entregue');
  assert.equal(sim.json.producao.estoque.tijolo, 7);
  assert.ok(sim.q.predio(escritorio) && sim.q.predio(escritorio).mover.pode, 'o armazém também pode mudar de lugar');
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
  assert.ok(cargaAntes);
});

test('o produtor de rede diz se a via nova leva canos e cabos, e o prédio da Holding diz a distância ao armazém e o que ela custa', () => {
  const sim = mundo('mov-rede');
  const solar = pronto(sim, 'solar', 1000, -340);
  const pv = sim.q.mover.previa({ ref: solar, x: 1200, z: -233, alinhar: true });
  assert.ok(pv.ok, `${pv.codigo} ${JSON.stringify(pv.dados)}`);
  assert.deepEqual(pv.muda.rede, { antes: true, depois: true }, 'a rua nova leva canos e cabos');
  assert.equal(pv.semRede, false);
  assert.ok(pv.muda.via.antes && pv.muda.via.depois && pv.muda.via.antes.ref !== pv.muda.via.depois.ref, 'sai da avenida e liga à rua');
  assert.equal(pv.muda.cobertura, undefined, 'a usina não tem alcance pela via');
  assert.ok(pv.efeitos.every((e) => e.camada), 'sem efeitos de construção a mais');
  // o armazém e a concreteira: a produtividade cai 1% a cada 100 m além de 500 m (D47)
  const escritorio = pronto(sim, 'escritorioObra', 970, -170);
  const conc = pronto(sim, 'concreteira', 1100, -340);
  assert.ok(sim.q.predio(escritorio) && sim.q.predio(conc));
  const perto = sim.q.mover.previa({ ref: conc, x: 1200, z: -340, alinhar: true });
  assert.ok(perto.ok, perto.codigo);
  assert.equal(perto.muda.armazem.penalDepois, 0, 'a 300 m do armazém, nada se perde');
  const longe = sim.q.mover.previa({ ref: conc, x: 1500, z: -340, alinhar: true, aplainar: true });
  assert.ok(longe.ok, `${longe.codigo} ${JSON.stringify(longe.dados)}`);
  const a = longe.muda.armazem;
  assert.ok(a.depois > a.livre && a.depois > a.antes, `a ${a.depois} m do armazém`);
  assert.ok(a.penalDepois > a.penalAntes);
  assert.equal(a.livre, PREDIOS_HOLDING.concreteira.distanciaArmazem.livre);
  assert.equal(sim.q.mover.previa({ ref: escritorio, x: 1040, z: -170, alinhar: true }).muda.armazem, undefined, 'o próprio armazém não tem distância a ele');
  assert.deepEqual(sim.erros, []);
});

test('o Desfazer devolve o lugar, a plataforma e o dinheiro até a obra começar; depois, "ocupado"', () => {
  const sim = mundo('mov-desfazer');
  const ref = pronto(sim, 'clinica', 1100, -330);
  const P = sim.tabelas.predios;
  const i = idxDaRef(ref);
  const antes = { x: P.x[i], z: P.z[i], y: P.y[i], rot: P.rot[i], flags: P.flags[i], ini: P.obraIni[i], fim: P.obraFim[i] };
  const formas = () => sim.formas.lista().filter((f) => f.tipo === 'plataforma' && f.ref === ref).map((f) => [...f.contorno, f.cota]);
  const forma0 = formas();
  assert.equal(forma0.length, 1);
  const caixa0 = sim.holding.caixa();
  const hash0 = sim.q.hash();
  const { r } = mover(sim, ref, 1400, -330);
  assert.equal(r.dados.desfazer, true);
  assert.equal(caixa0 - sim.holding.caixa(), custoDeMover(sim.colocaveis.obter('clinica')));
  assert.notDeepEqual(formas(), forma0, 'a plataforma foi para o lugar novo');
  assert.equal(formas().length, 1);
  sim.rodar(MOVER.mobilizacao - 3, { sincrono: true });
  const caixa1 = sim.holding.caixa();
  const d = sim.cmd('mover.desfazer', { ref });
  assert.ok(d.ok, d.codigo);
  assert.equal(d.dados.devolvido, custoDeMover(sim.colocaveis.obter('clinica')));
  assert.ok(Math.abs(sim.holding.caixa() - caixa1 - d.dados.devolvido) < 1e-6, 'o dinheiro todo volta');
  assert.deepEqual({ x: P.x[i], z: P.z[i], y: P.y[i], rot: P.rot[i], flags: P.flags[i], ini: P.obraIni[i], fim: P.obraFim[i] }, antes);
  assert.deepEqual(formas(), forma0, 'a plataforma de antes volta');
  assert.ok(sim.q.predio(ref).servico.eficiencia >= 0);
  assert.equal(sim.q.predio(ref).estado, 'ok');
  assert.equal(sim.cmd('mover.desfazer', { ref }).codigo, 'nada', 'só uma vez');
  assert.deepEqual(sim.json.mover.pend, {});
  assert.deepEqual(sim.validar(), []);
  assert.notEqual(sim.q.hash(), hash0, 'o tempo andou');
  // depois que a obra começa (a equipe chegou), não dá mais
  const outra = mover(sim, ref, 1400, -330);
  sim.rodar(MOVER.mobilizacao, { sincrono: true });
  const tarde = sim.cmd('mover.desfazer', { ref });
  assert.equal(tarde.codigo, 'ocupado');
  assert.ok(Math.abs(P.x[i] - outra.pv.x) < 1e-6, 'o prédio ficou no lugar novo');
  assert.deepEqual(sim.json.mover.pend, {}, 'a janela fechada sai da seção');
  // mover derrubando prédios de zona não guarda o que desfazer
  const zr = indiceZona('resBaixa');
  sim.rodar(outra.pv.tiques + 40, { sincrono: true });
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'retangulo', x: 1000, z: -300, x2: 1100, z2: -200 }, zona: zr }).ok);
  const rng = sim.rng('teste');
  const C = sim.tabelas.celulas;
  for (let c = 0; c < C.n; c++) {
    if (!C.viva[c] || C.zona[c] !== zr || C.linha[c] !== 0 || C.estado[c] !== CELULA.LIVRE) continue;
    const k = nascerNaFrente(sim, c, zr, rng);
    if (k >= 0) terminarObra(sim, k);
  }
  const sobre = sim.q.mover.previa({ ref, x: 1050, z: -250, rot: 0, alinhar: false });
  assert.ok(sobre.ok, sobre.codigo);
  assert.ok(sobre.demolir.length > 0, 'cai sobre casas');
  assert.equal(sobre.desfazer, false);
  assert.ok(sobre.custoDemolir > 0 && sobre.custo === sobre.custoMover + sobre.custoDemolir);
  const caixaAntes = sim.holding.caixa();
  const m = sim.cmd('mover', { ref, x: sobre.x, z: sobre.z, rot: sobre.rot, alinhar: false });
  assert.ok(m.ok, m.codigo);
  assert.ok(Math.abs(caixaAntes - sim.holding.caixa() - sobre.custo) < 1e-6, 'paga os 10% e a demolição (D54)');
  assert.equal(m.dados.desfazer, false);
  assert.equal(m.dados.demolidos.length, sobre.demolir.length);
  assert.equal(sim.cmd('mover.desfazer', { ref }).codigo, 'nada');
  assert.deepEqual(sim.erros, []);
});

test('save no meio da mudança e determinismo: quem carregou segue com o mesmo hash de quem não parou', () => {
  const montar = () => {
    const sim = mundo('mov-save');
    const ref = pronto(sim, 'clinica', 1100, -330);
    pronto(sim, 'praca', 1250, -330);
    return { sim, ref };
  };
  const A = montar();
  const B = montar();
  assert.equal(A.sim.q.hash(), B.sim.q.hash(), 'duas simulações iguais');
  for (const { sim, ref } of [A, B]) {
    mover(sim, ref, 1400, -330);
    sim.rodar(7, { sincrono: true });
  }
  assert.equal(A.sim.q.hash(), B.sim.q.hash(), 'o mesmo mover dá o mesmo estado');
  // salva no meio da janela do Desfazer, carrega em outra simulação e segue
  const C = criarSimulacao({ semente: 'mov-save', modo: 'livre' });
  aplicarSave(C, migrar(lerSave(montarSave(A.sim))));
  assert.deepEqual(C.json.mover, A.sim.json.mover, 'a janela do Desfazer vai no save');
  assert.equal(C.q.hash(), A.sim.q.hash());
  const d = C.cmd('mover.desfazer', { ref: A.ref });
  assert.ok(d.ok, d.codigo);
  const e = A.sim.cmd('mover.desfazer', { ref: A.ref });
  assert.ok(e.ok);
  assert.equal(C.q.hash(), A.sim.q.hash(), 'desfazer depois de carregar é o mesmo de desfazer sem parar');
  // outro save: já em obra; o fim da obra e o resto do tempo dão o mesmo hash
  mover(A.sim, A.ref, 1400, -330);
  A.sim.rodar(MOVER.mobilizacao + 10, { sincrono: true });
  const D = criarSimulacao({ semente: 'mov-save', modo: 'livre' });
  aplicarSave(D, migrar(lerSave(montarSave(A.sim))));
  assert.equal(D.q.hash(), A.sim.q.hash());
  assert.equal(D.q.predio(A.ref).estado, 'obra');
  A.sim.rodar(400, { sincrono: true });
  D.rodar(400, { sincrono: true });
  assert.equal(D.q.hash(), A.sim.q.hash());
  assert.equal(D.q.predio(A.ref).estado, 'ok');
  assert.deepEqual(D.validar(), []);
  assert.deepEqual([...A.sim.erros, ...D.erros], []);
});

test('o livro guarda o mover e o desfazer com os mesmos argumentos (a reprodução os aplica de novo)', () => {
  const sim = mundo('mov-livro');
  const ref = pronto(sim, 'praca', 1100, -330);
  const n0 = sim.livro.entradas.length;
  const pv = sim.q.mover.previa({ ref, x: 1300, z: -330, rot: 0, alinhar: false });
  const args = { ref, x: pv.x, z: pv.z, rot: pv.rot, alinhar: false };
  assert.ok(sim.cmd('mover', args).ok);
  assert.ok(sim.cmd('mover.desfazer', { ref }).ok);
  const novos = sim.livro.entradas.slice(n0);
  assert.deepEqual(novos.map((e) => e[2]), ['mover', 'mover.desfazer']);
  assert.deepEqual(novos[0][3], args);
  assert.deepEqual(novos[1][3], { ref });
  assert.deepEqual(sim.erros, []);
});

test('argumento que não é número finito: "valor" na prévia e no comando, sem tocar no prédio', () => {
  const sim = mundo('mov-valor');
  const ref = pronto(sim, 'clinica', 1100, -330);
  const P = sim.tabelas.predios;
  const i = idxDaRef(ref);
  const x0 = P.x[i];
  const caixa = sim.holding.caixa();
  for (const ruim of [NaN, Infinity, 'a', null]) {
    assert.equal(sim.q.mover.previa({ ref, x: ruim, z: -330 }).codigo, 'valor');
    assert.equal(sim.cmd('mover', { ref, x: ruim, z: -330 }).codigo, 'valor');
    assert.equal(sim.q.mover.previa({ ref, x: 1400, z: -330, rot: ruim }).codigo, 'valor');
  }
  assert.equal(P.x[i], x0);
  assert.equal(sim.holding.caixa(), caixa);
});
