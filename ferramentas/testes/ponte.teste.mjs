// Testes das pontes e viadutos do jogador (D53, D106; PONT2): ponte sobre água com vão máximo e custo 3 vezes, viaduto por
// degraus de cota (rampa, alto, rampa), passagem em desnível sem ligar embaixo, altura livre e greide recusados com o
// motivo, pilares em chão válido, demolir a estrutura inteira, save ida e volta e determinismo.
// Roda sozinho: node ferramentas/testes/ponte.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { conferirEspelho, idxDaRef } from '../../fonte/contratos/espelho.js';
import { ARESTA, AGUA } from '../../fonte/contratos/flags.js';
import { aguaEm } from '../../fonte/sim/mundo/terreno.js';
import { tabelaArco } from '../../fonte/comum/bezier.js';
import { VIAS } from '../../fonte/data/vias.js';
import { montarSave, lerSave, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import {
  COTAS_VIADUTO, DESNIVEL_MINIMO, GREIDE_MAX_ELEVADO, TRAVESSIA_MAX, ESPESSURA_TABULEIRO, alturaDaPista, comprimentoRampa,
  pilaresDaPeca, lerCota,
} from '../../fonte/comum/viaduto.js';
import { estruturaDaPonte } from '../../fonte/sim/vias/ponte.js';

const novaSim = (semente) => criarSimulacao({ semente, modo: 'livre' });
const codigos = (p) => [...new Set(p.erros.map((e) => e.codigo))];
const motivos = (p) => [...new Set(p.erros.map((e) => e.dados?.motivo).filter(Boolean))];
const comp = (p) => tabelaArco(Float64Array.from(p))[16];

/** Prévia e, se ok, a obra. */
function via(sim, pontos, { tipo = 'rua', construir = true, ...extra } = {}) {
  const args = { modo: 'reta', tipo, pontos, sessao: 1, encaixe: false, ...extra };
  const p = sim.q.via.previa(args);
  const r = construir && p.ok ? sim.cmd('via.construir', { plano: args }) : null;
  return { p, r };
}

const arestasVivas = (sim) => {
  const A = sim.tabelas.arestas;
  const out = [];
  for (let e = 0; e < A.n; e++) if (A.viva[e]) out.push(e);
  return out;
};
// tabuleiros do jogador: a ponte da rodovia do mapa (RODOVIA e PONTE) não conta
const comFlag = (sim, flag) => arestasVivas(sim).filter((e) => sim.tabelas.arestas.flags[e] & flag && !(sim.tabelas.arestas.flags[e] & ARESTA.RODOVIA));

// Pontos do mapa de 'vias-regras' (livre): rio estreito em z = 700, lago largo em z = 900, campo plano em x = -900.
const RIO = [[-800, 700], [-450, 700]];
const LAGO = [[-900, 900], [-300, 900]];
const ESTRADA = [[-1000, -100], [-750, -100]];
const VIADUTO = [[-900, -500], [-900, 300]];

// ------------------------------------------------------------------------------------------------ regras comuns

test('degraus de cota, rampa de 6% e desnível mínimo (regras comuns)', () => {
  assert.deepEqual([...COTAS_VIADUTO], [0, 6, 12, 18]);
  assert.equal(lerCota(undefined), 0);
  assert.equal(lerCota(12), 12);
  assert.equal(lerCota(7), null, 'fora dos degraus');
  assert.equal(alturaDaPista(0), 0);
  assert.equal(alturaDaPista(6), 6 + ESPESSURA_TABULEIRO);
  assert.ok(Math.abs(comprimentoRampa(6) * 0.06 - alturaDaPista(6)) < 1e-9, 'a rampa sobe no greide de 6%');
  assert.ok(GREIDE_MAX_ELEVADO <= 0.08 + 1e-9);
  assert.equal(DESNIVEL_MINIMO, 5 + ESPESSURA_TABULEIRO, 'altura livre de 5 m mais o tabuleiro');
  assert.equal(TRAVESSIA_MAX, 200);
});

test('pilares: um a cada ~32 m, fora de via no chão, determinísticos e sem pilar perto do chão', () => {
  const p = Float64Array.from([0, 0, 40, 0, 80, 0, 120, 0]);
  const chao = () => 0;
  const alto = pilaresDaPeca(p, [10, 10], chao);
  assert.equal(alto.length, 5, '120 m em 4 vãos de 30 m: pilares nas duas pontas e três no meio');
  for (const pl of alto) {
    assert.ok(Math.abs(pl.topo - (10 - ESPESSURA_TABULEIRO)) < 1e-9);
    assert.equal(pl.base, 0);
  }
  assert.deepEqual(pilaresDaPeca(p, [10, 10], chao), alto, 'determinístico');
  assert.equal(pilaresDaPeca(p, [1, 1], chao).length, 0, 'a menos de 1,5 m do chão não há pilar');
  // uma via no chão em x = 60 a 70: o pilar do meio anda até o chão livre, ou some se não houver
  const via = (x) => x > 52 && x < 78;
  const desviados = pilaresDaPeca(p, [10, 10], chao, via);
  assert.ok(desviados.every((pl) => !via(pl.x)), 'nenhum pilar em cima da via');
  assert.ok(desviados.length >= 4);
});

// ------------------------------------------------------------------------------------------------ ponte

test('ponte sobre água: automática, tabuleiro acima da água, custo 3 vezes, pilares no leito', () => {
  const sim = novaSim('vias-regras');
  const { p, r } = via(sim, RIO);
  assert.ok(p.ok, JSON.stringify(p.erros));
  const pontes = p.segmentos.filter((s) => s.ponte);
  assert.ok(pontes.length >= 1, 'o trecho sobre a água é ponte');
  assert.ok(p.segmentos.some((s) => s.obra === 'ponte'));
  // o custo é o da via comum vezes 3 nas peças de ponte
  let esperado = 0;
  for (const s of p.segmentos) esperado += comp(s.p) * VIAS.rua.custoM * (1 + 2 * s.declive) * (s.ponte ? 3 : 1);
  assert.ok(Math.abs(p.custo - Math.round(esperado)) <= 1, `custo ${p.custo} contra ${esperado}`);
  // o tabuleiro fica acima da água (nível do mar 0) em toda a ponte
  for (const s of p.segmentos.filter((x) => x.obra === 'ponte')) for (const c of s.cotas) assert.ok(c > 1, `cota ${c}`);
  assert.ok(r?.ok);
  const A = sim.tabelas.arestas;
  const ponte = comFlag(sim, ARESTA.PONTE);
  assert.ok(ponte.length >= 1);
  for (const e of ponte) assert.ok(!(A.flags[e] & ARESTA.RODOVIA));
  // pilares de leito a leito: alguns com base abaixo da água
  let noLeito = 0;
  for (const e of ponte) {
    const pl = pilaresDaPeca(A.p.subarray(8 * e, 8 * e + 8), [A.y[2 * e], A.y[2 * e + 1]], (x, z) => sim.alturaEm(x, z));
    noLeito += pl.filter((x) => aguaEm(sim.espelho.terreno, x.x, x.z) !== AGUA.TERRA).length;
  }
  assert.ok(noLeito >= 1, 'há pilar no leito');
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) }), []);
});

test('ponte: travessia acima de 200 m é recusada com vão', () => {
  const sim = novaSim('vias-regras');
  const p = via(sim, LAGO, { construir: false }).p;
  assert.ok(!p.ok);
  assert.ok(codigos(p).includes('vao'), JSON.stringify(p.erros));
  // a mesma água com um traço que a cruza em menos de 200 m passa
  const ok = via(sim, RIO, { construir: false }).p;
  assert.ok(!codigos(ok).includes('vao'));
});

// ------------------------------------------------------------------------------------------------ viaduto

test('viaduto: rampa, alto e rampa; passa por cima da estrada sem se ligar; pilares fora da pista', () => {
  const sim = novaSim('vias-regras');
  const estrada = via(sim, ESTRADA);
  assert.ok(estrada.r?.ok, JSON.stringify(estrada.p.erros));
  const antes = arestasVivas(sim);
  const daEstrada = estrada.r.dados.arestas.map(idxDaRef);
  const hEstrada = sim.hash();
  const { p, r } = via(sim, VIADUTO, { cota: 6 });
  assert.ok(p.ok, JSON.stringify(p.erros));
  assert.ok(p.segmentos.every((s) => s.ponte && s.obra === 'viaduto'), 'o traço inteiro é tabuleiro');
  assert.ok(p.segmentos.some((s) => s.altura >= 6), 'sobe até a cota');
  assert.equal(p.divisoes, 0, 'nenhuma via é dividida: não se liga embaixo');
  assert.ok(r?.ok);
  assert.notEqual(sim.hash(), hEstrada);
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const tab = comFlag(sim, ARESTA.PONTE);
  assert.ok(tab.length >= 3);
  // as arestas da estrada continuam as mesmas e nenhum nó do viaduto é dela
  for (const e of antes) assert.ok(A.viva[e], 'nenhuma via foi dividida ou perdida');
  const nosEstrada = new Set(daEstrada.flatMap((e) => [A.a[e], A.b[e]]));
  const nosViaduto = new Set(tab.flatMap((e) => [A.a[e], A.b[e]]));
  const juntos = [...nosViaduto].filter((n) => nosEstrada.has(n));
  assert.equal(juntos.length, 0, 'viaduto e estrada não compartilham nó');
  // altura livre sobre a estrada: o tabuleiro passa a pelo menos o desnível mínimo da pista de baixo
  const ys = (e) => [A.y[2 * e], A.y[2 * e + 1]];
  const noCruzamento = tab.find((e) => Math.min(N.z[A.a[e]], N.z[A.b[e]]) <= -100 && Math.max(N.z[A.a[e]], N.z[A.b[e]]) >= -100);
  assert.ok(noCruzamento !== undefined, 'uma peça do viaduto cobre o cruzamento');
  const [y0, y1] = ys(noCruzamento);
  const yEstrada = sim.alturaEm(-900, -100);
  assert.ok(Math.min(y0, y1) - yEstrada >= DESNIVEL_MINIMO - 1.5, `pista ${y0}, ${y1} sobre o chão ${yEstrada}`);
  // pilares: nenhum em cima da estrada
  for (const e of tab) {
    const pl = pilaresDaPeca(A.p.subarray(8 * e, 8 * e + 8), ys(e), (x, z) => sim.alturaEm(x, z), (x, z) => Math.abs(z + 100) < 10 && x < -750 && x > -1000);
    for (const q of pl) assert.ok(Math.abs(q.z + 100) >= 10);
  }
  // sem ligação: uma via no chão que passa por baixo não divide o viaduto
  const embaixo = via(sim, [[-1000, 100], [-800, 100]], { construir: false }).p;
  assert.ok(embaixo.ok, JSON.stringify(embaixo.erros));
  for (const d of embaixo.dividir) assert.ok(!tab.includes(idxDaRef(d.aresta)), 'não divide o viaduto');
  // e uma via nova não pode partir do meio do viaduto
  const ligando = via(sim, [[-1000, 0], [-900, 0]], { construir: false, encaixe: true }).p;
  for (const d of ligando.dividir) assert.ok(!tab.includes(idxDaRef(d.aresta)));
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) }), []);
});

test('viaduto: cada degrau de cota sobe até a altura livre pedida', () => {
  for (const cota of [6, 12, 18]) {
    const sim = novaSim('vias-regras');
    const { p } = via(sim, VIADUTO, { cota, construir: false });
    assert.ok(p.ok, `cota ${cota}: ${JSON.stringify(p.erros)}`);
    const alto = Math.max(...p.segmentos.map((s) => s.altura));
    assert.ok(alto >= cota * 0.9, `cota ${cota}: pista a ${alto} m do chão`);
    assert.ok(alto <= alturaDaPista(cota) + 3, `cota ${cota}: pista a ${alto} m do chão, alta demais`);
    for (const s of p.segmentos) assert.ok(s.declive <= GREIDE_MAX_ELEVADO + 1e-6, `rampa de ${s.declive}`);
  }
  // cota 0 não é viaduto: via comum no chão, sem tabuleiro
  const sim = novaSim('vias-regras');
  const chao = via(sim, [[-900, -500], [-900, 300]], { cota: 0, construir: false }).p;
  assert.ok(chao.ok && chao.segmentos.every((s) => !s.ponte));
  // cota fora dos degraus
  assert.ok(codigos(via(sim, VIADUTO, { cota: 7, construir: false }).p).includes('valor'));
});

test('viaduto recusado: trecho curto para a cota, altura livre e greide, cada um com o seu motivo', () => {
  const sim = novaSim('vias-regras');
  assert.ok(via(sim, ESTRADA).r?.ok);
  // curto: as duas rampas de +12 pedem uns 440 m
  const curto = via(sim, [[-900, -300], [-900, 100]], { cota: 12, construir: false }).p;
  assert.ok(!curto.ok && motivos(curto).includes('rampa'), JSON.stringify(curto.erros));
  // altura livre: cruzar a estrada a 50 m do pé da rampa (a pista ainda está baixa)
  const baixo = via(sim, [[-900, -150], [-900, 400]], { cota: 6, construir: false }).p;
  assert.ok(!baixo.ok && motivos(baixo).includes('altura'), JSON.stringify(baixo.erros));
  // a mesma travessia no alto passa
  assert.ok(via(sim, VIADUTO, { cota: 6, construir: false }).p.ok);
  // greide: morro íngreme, a rampa mais o chão passam de 8%
  const morro = via(sim, [[-760, -380], [-760, -700]], { cota: 6, construir: false }).p;
  assert.ok(!morro.ok);
  assert.ok(codigos(morro).includes('declive'), JSON.stringify(morro.erros));
  // pilar em água funda: ponte de viaduto sobre o lago largo cai no vão antes
  assert.ok(codigos(via(sim, LAGO, { cota: 6, construir: false }).p).includes('vao'));
});

test('uma via no chão pode passar por baixo de um viaduto que já existe, e sem altura livre é recusada', () => {
  const sim = novaSim('vias-regras');
  assert.ok(via(sim, VIADUTO, { cota: 6 }).r?.ok);
  const hash = sim.hash();
  const por = via(sim, [[-1000, 100], [-800, 100]], { construir: false }).p;
  assert.ok(por.ok, JSON.stringify(por.erros));
  assert.equal(sim.hash(), hash, 'a prévia não muda o estado');
  // no pé da rampa (a pista ainda baixa) não passa por baixo
  const pe = via(sim, [[-1000, -480], [-800, -480]], { construir: false }).p;
  assert.ok(!pe.ok, 'sem altura livre no pé da rampa');
});

// ------------------------------------------------------------------------------------------------ demolir, save, determinismo

test('demolir um pedaço derruba a estrutura inteira e devolve parte do custo; a estrada fica', () => {
  const sim = novaSim('vias-regras');
  assert.ok(via(sim, ESTRADA).r?.ok);
  const vivasChao = arestasVivas(sim);
  const construido = via(sim, VIADUTO, { cota: 6 });
  assert.ok(construido.r?.ok);
  const A = sim.tabelas.arestas;
  const tab = comFlag(sim, ARESTA.PONTE);
  assert.ok(tab.length >= 3);
  assert.deepEqual(estruturaDaPonte(sim, tab[1]), [...tab].sort((a, b) => a - b), 'a estrutura é a cadeia inteira');
  const ref = construido.r.dados.arestas[1];
  const prev = sim.q.via.previa({ modo: 'demolir', arestas: [ref], sessao: 2 });
  assert.ok(prev.ok && prev.segmentos.length >= tab.length, JSON.stringify(prev.erros));
  const r = sim.cmd('via.demolir', { arestas: [ref], sessao: 2 });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(comFlag(sim, ARESTA.PONTE).length, 0, 'todo o tabuleiro caiu');
  for (const e of vivasChao) assert.ok(A.viva[e], 'a estrada continua');
  assert.deepEqual(sim.validar(), []);
  // desfazer traz a estrutura de volta com a flag
  const d = sim.cmd('via.desfazer', { sessao: 2 });
  assert.ok(d.ok, JSON.stringify(d));
  assert.ok(comFlag(sim, ARESTA.PONTE).length >= 3);
  assert.deepEqual(sim.validar(), []);
});

test('a rodovia do mapa continua intocável', () => {
  const sim = novaSim('vias-regras');
  const rod = arestasVivas(sim).find((e) => sim.tabelas.arestas.flags[e] & ARESTA.RODOVIA);
  assert.ok(rod !== undefined);
  const ref = sim.q.viasPerto ? null : null;
  assert.equal(ref, null);
  const A = sim.tabelas.arestas;
  const r = sim.cmd('via.demolir', { arestas: [(A.ger[rod] << 20) | rod], sessao: 1 });
  assert.ok(!r.ok);
});

test('a ponte da rodovia do mapa não se demole (nem pela ponte, nem pela estrutura)', () => {
  const sim = novaSim('vias-regras');
  const A = sim.tabelas.arestas;
  const pontes = arestasVivas(sim).filter((e) => A.flags[e] & ARESTA.PONTE && A.flags[e] & ARESTA.RODOVIA);
  assert.ok(pontes.length >= 1, 'a vila inicial traz a ponte sobre o rio');
  const n0 = arestasVivas(sim).length;
  for (const e of pontes) {
    const r = sim.cmd('via.demolir', { arestas: [(A.ger[e] << 20) | e], sessao: 1 });
    assert.deepEqual([r.ok, r.codigo], [false, 'rodovia']);
  }
  assert.equal(arestasVivas(sim).length, n0, 'nada foi demolido');
});

test('uma via no chão cruza o pé da rampa (elevação abaixo do limiar) como via comum; a rodovia segue intocável', () => {
  const sim = novaSim('vias-regras');
  assert.ok(via(sim, [[-700, -500], [-700, 300]], { cota: 6 }).r?.ok);
  const tab = comFlag(sim, ARESTA.PONTE);
  // a 12 m do começo da rampa a pista está a menos de ELEVACAO_PONTE do chão: cruzamento normal, divide a rampa
  const { p, r } = via(sim, [[-740, -488], [-660, -488]]);
  assert.ok(p.ok, JSON.stringify(p.erros));
  assert.equal(p.divisoes, 1);
  assert.ok(r?.ok);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) }), []);
  assert.ok(comFlag(sim, ARESTA.PONTE).length > tab.length, 'a rampa dividida segue tabuleiro');
  // mais acima na rampa (elevação maior que o limiar) a regra é a da passagem: sem altura livre, recusa
  assert.ok(!via(sim, [[-740, -478], [-660, -478]], { construir: false }).p.ok);
});

test('save ida e volta e determinismo com ponte e viaduto', () => {
  const jogar = (sim) => {
    assert.ok(via(sim, ESTRADA).r?.ok);
    assert.ok(via(sim, VIADUTO, { cota: 12 }).r?.ok || via(sim, VIADUTO, { cota: 6 }).r?.ok);
    assert.ok(via(sim, RIO).r?.ok);
  };
  const a = novaSim('pont2-det');
  jogar(a);
  const b = novaSim('pont2-det');
  jogar(b);
  assert.equal(a.hash(), b.hash(), 'determinístico');
  const c = novaSim('pont2-det');
  aplicarSave(c, lerSave(montarSave(a)));
  assert.equal(c.hash(), a.hash(), 'save e carga');
  assert.equal(comFlag(c, ARESTA.PONTE).length, comFlag(a, ARESTA.PONTE).length);
  for (const s of [a, c]) {
    assert.deepEqual(s.erros, []);
    assert.deepEqual(s.validar(), []);
    assert.deepEqual(conferirEspelho(s.espelho, { alturaEm: (x, z) => s.alturaEm(x, z) }), []);
  }
  // as prévias não mudam o estado
  const h = a.hash();
  via(a, VIADUTO, { cota: 18, construir: false });
  via(a, LAGO, { construir: false });
  assert.equal(a.hash(), h);
});

// ------------------------------------------------------------------------------------------------ interface e render

test('ferramenta de via: a cota e a ponte automática vão na prévia; textos dos motivos existem', async () => {
  const via = await import('../../fonte/ui/ferramentas/via.js');
  const { t, temTexto } = await import('../../fonte/ui/textos.js');
  let m = via.criarVia({ tipo: 'rua' });
  assert.equal(m.cota, 0);
  assert.equal(m.ponte, true);
  m = via.passoVia(m, { tipo: 'opcao', cota: 12 });
  assert.equal(m.cota, 12);
  m = via.passoVia(m, { tipo: 'opcao', cota: 7 });
  assert.equal(m.cota, 12, 'cota fora dos degraus é ignorada');
  m = via.passoVia(m, { tipo: 'opcao', ponte: false });
  assert.equal(m.ponte, false);
  const args = via.argsPrevia({ ...m, a: [0, 0], b: [100, 0], meio: null }, { sessao: 1 });
  assert.equal(args.cota, 12);
  assert.equal(args.ponte, false);
  const grade = via.argsPrevia({ ...m, modo: 'grade', a: [0, 0], b: [100, 0], fundo: null }, { sessao: 1 });
  assert.equal(grade.cota, undefined, 'a grade fica no chão');
  for (const k of ['pont2.cota', 'pont2.cota.0', 'pont2.cota.6', 'pont2.cota.12', 'pont2.cota.18', 'pont2.ponte', 'pont2.motivo.altura', 'pont2.motivo.pilar',
    'pont2.motivo.rampa', 'pont2.motivo.greide', 'pont2.dica.altura', 'pont2.dica.pilar', 'pont2.dica.rampa', 'pont2.dica.greide', 'pont2.linha.ponte', 'pont2.linha.viaduto']) {
    assert.ok(temTexto(k), k);
    assert.ok(!t(k).includes('—') && !t(k).includes('–'), `${k} sem travessão`);
  }
});

test('ponte automática desligada: a água barra a via', () => {
  const sim = novaSim('vias-regras');
  const p = via(sim, RIO, { ponte: false, construir: false }).p;
  assert.ok(!p.ok && codigos(p).includes('agua'), JSON.stringify(p.erros));
});

test('render: a estrutura do tabuleiro (viga, guarda-corpo, pilares) sai pura, determinística e dentro do orçamento', async () => {
  const { geometriaDaEstrutura } = await import('../../fonte/render/vias/viaduto.js');
  const pecas = [
    { p: Float64Array.from([0, 0, 40, 0, 80, 0, 120, 0]), cotas: [8, 8], meia: 8, e: 1 },
    { p: Float64Array.from([120, 0, 160, 0, 200, 0, 240, 0]), cotas: [8, 2], meia: 8, e: 2 },
  ];
  const op = { chao: () => 0, bloqueia: null };
  const g = geometriaDaEstrutura(pecas, op);
  assert.ok(g.triangulos > 100 && g.triangulos < 3000, `${g.triangulos} triângulos`);
  assert.equal(g.pos.length, g.nor.length);
  assert.ok(g.idx.every((i) => i < g.pos.length / 3));
  for (const v of g.pos) assert.ok(Number.isFinite(v));
  const h = geometriaDaEstrutura(pecas, op);
  assert.deepEqual(h.pos, g.pos, 'determinística');
  // o pilar do nó entre as duas peças não se repete
  const sem = geometriaDaEstrutura([pecas[0]], op).triangulos + geometriaDaEstrutura([pecas[1]], op).triangulos;
  assert.ok(g.triangulos < sem, 'o pilar do nó comum entra uma vez só');
  // a pista nunca fica abaixo de 1,5 m do chão sem pilar: peça rasteira só tem viga e guarda-corpo
  const baixa = geometriaDaEstrutura([{ p: pecas[0].p, cotas: [1, 1], meia: 8, e: 3 }], op);
  assert.ok(baixa.triangulos < g.triangulos);
});
