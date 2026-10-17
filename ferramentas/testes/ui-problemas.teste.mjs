// Testes da X3b, sem navegador: a lista de problemas (alertas e avisos de prédio agregados, ordem de gravidade, alvos, o
// "Próximo" e o "Ver na camada"), as 7 camadas do M1b com a simulação de verdade (cores, escala, unidade, legenda), os
// glifos próprios e os textos (sem travessão, sem chave faltando). Roda sozinho: node ferramentas/testes/ui-problemas.teste.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listarProblemas, ordenarProblemas, proximoProblema, destinoDoProblema, contarProblemas, GRUPOS_PREDIO, ALERTA_COBRE } from '../../fonte/ui/mundo/problemas.js';
import { CAMADAS_UI, CAMADA_DO_ALERTA, PALETA, paleta, modeloLegenda, contraste, camadasDoPopover, limiteDe } from '../../fonte/ui/mundo/camadas.js';
import { AVISOS_DA_CAMADA } from '../../fonte/ui/mundo/marcadores.js';
import { glifo } from '../../fonte/ui/glifos/glifos.js';
import { definirParteAtual } from '../../fonte/data/zonas.js';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { t, temTexto, registrarTextos } from '../../fonte/ui/textos.js';
import * as x3 from '../../fonte/ui/textos/x3.js';
import * as s1 from '../../fonte/ui/textos/s1.js';
import * as s1c from '../../fonte/ui/textos/s1c.js';
import * as s2 from '../../fonte/ui/textos/s2.js';
import * as s2b from '../../fonte/ui/textos/s2b.js';
for (const m of [s1, s1c, s2, s2b, x3]) m.registrar(registrarTextos);

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const NOMES = ['', 'abandonado', 'alerta', 'semAgua', 'semEnergia', 'semVia', 'semMaterial', 'semTrabalhadores', 'poucosClientes', 'trabalho', 'bemEstarRuim', 'esgoto'];
const nomeIdx = (n) => NOMES.indexOf(n);
const textoAlerta = (a) => `alerta ${a.codigo}`;

function predios(n) {
  return { n, x: Float32Array.from({ length: n }, (_, i) => 100 + i * 10), z: Float32Array.from({ length: n }, (_, i) => 50 + i) };
}
function avisos(lista) {
  return {
    versao: 1, idx: Int32Array.from(lista.map((a) => a[0])), glifo: Uint8Array.from(lista.map((a) => nomeIdx(a[1]))),
    gravidade: Uint8Array.from(lista.map((a) => ({ info: 0, atencao: 1, grave: 2 })[a[2]])), nomes: NOMES,
  };
}

test('problemas: agrupa por tipo e gravidade, ordena do grave ao info e a maior contagem primeiro', () => {
  const av = avisos([[0, 'poucosClientes', 'atencao'], [1, 'poucosClientes', 'atencao'], [2, 'poucosClientes', 'atencao'], [3, 'abandonado', 'grave'], [4, 'bemEstarRuim', 'info'], [5, 'semTrabalhadores', 'atencao']]);
  const l = listarProblemas({ alertas: [], avisos: av, predios: predios(8), textoAlerta, t });
  assert.deepEqual(l.map((p) => p.gravidade), ['grave', 'atencao', 'atencao', 'info']);
  assert.equal(l[0].texto, 'Prédios abandonados: 1');
  assert.equal(l[1].n, 3, 'poucos clientes: 3 prédios, antes dos sem trabalhadores (1)');
  assert.equal(l[1].alvos.length, 3);
  assert.deepEqual(l[1].alvos[0], { x: 100, z: 50 });
  assert.equal(l[1].camada, 'zonas');
  assert.equal(l[3].camada, 'bemEstar');
  for (const p of l) assert.doesNotMatch(p.texto, /—|–|\?\?/);
});

test('problemas: o alerta da cidade absorve o grupo de prédios que ele já diz e ganha os prédios como alvos', () => {
  const alertas = [
    { id: 'agua', gravidade: 'grave', glifo: 'semAgua', codigo: 'faltaAgua', params: { n: 2 } },
    { id: 'transito', gravidade: 'atencao', glifo: 'transito', codigo: 'transitoParado', params: { via: 'Rua 1' }, alvo: { x: 300, z: 400 } },
    { id: 'caixa', gravidade: 'grave', glifo: 'caixa', codigo: 'caixaZerado', params: {}, alvo: { tela: 'economia' } },
  ];
  const av = avisos([[1, 'semAgua', 'grave'], [2, 'semAgua', 'grave'], [3, 'esgoto', 'grave']]);
  const l = listarProblemas({ alertas, avisos: av, predios: predios(6), textoAlerta, t });
  const agua = l.find((p) => p.id === 'alerta.faltaAgua');
  assert.equal(agua.n, 2);
  assert.deepEqual(agua.alvos, [{ x: 110, z: 51 }, { x: 120, z: 52 }]);
  assert.equal(agua.camada, 'agua');
  assert.ok(!l.some((p) => p.id === 'predios.semAgua.grave'), 'o grupo de água não aparece duas vezes');
  assert.ok(l.some((p) => p.id === 'predios.esgoto.grave'), 'o grupo sem alerta fica');
  const via = l.find((p) => p.id === 'alerta.transitoParado');
  assert.deepEqual(via.alvos, [{ x: 300, z: 400 }]);
  assert.equal(via.camada, 'transito');
  const caixa = l.find((p) => p.id === 'alerta.caixaZerado');
  assert.equal(caixa.camada, null);
  assert.equal(caixa.tela, 'economia');
  // grave primeiro; empate de gravidade, mais prédios primeiro
  assert.equal(l[0].gravidade, 'grave');
  assert.ok(l.findIndex((p) => p.id === 'alerta.transitoParado') > l.findIndex((p) => p.id === 'predios.esgoto.grave'));
});

test('problemas: "Próximo" dá a volta e "Ver na camada" anda pelos alvos e cai na tela quando não há ponto', () => {
  assert.equal(proximoProblema([], 0), -1);
  assert.deepEqual([0, 1, 2].map((k) => proximoProblema([1, 2, 3], k)), [1, 2, 0]);
  const p = { id: 'a', camada: 'agua', alvos: [{ x: 1, z: 2 }, { x: 3, z: 4 }], tela: null };
  assert.deepEqual([0, 1, 2].map((v) => destinoDoProblema(p, v).alvo), [{ x: 1, z: 2 }, { x: 3, z: 4 }, { x: 1, z: 2 }]);
  assert.equal(destinoDoProblema(p).camada, 'agua');
  assert.deepEqual(destinoDoProblema({ id: 'b', camada: null, alvos: [], tela: 'economia' }), { camada: null, alvo: null, tela: 'economia' });
  assert.equal(destinoDoProblema(null), null);
  assert.deepEqual(contarProblemas([{ gravidade: 'grave' }, { gravidade: 'info' }, { gravidade: 'grave' }]), { grave: 2, atencao: 0, info: 1, total: 3 });
  assert.deepEqual(ordenarProblemas([{ gravidade: 'info', n: 9 }, { gravidade: 'grave', n: 1 }]).map((p) => p.gravidade), ['grave', 'info']);
});

test('problemas: cada grupo e cada alerta apontam uma camada que existe e um texto que existe', () => {
  const ids = new Set(CAMADAS_UI.map((c) => c.id));
  for (const [chave, g] of Object.entries(GRUPOS_PREDIO)) {
    assert.ok(ids.has(g.camada), `${chave}: camada ${g.camada}`);
    assert.ok(temTexto(g.texto), g.texto);
    assert.match(t(g.texto, { n: 3 }), /3/);
  }
  for (const g of ['grave', 'atencao', 'info']) assert.ok(temTexto(`x3.prob.generico.${g}`) && temTexto(`x3.prob.grav.${g}`) && temTexto(`x3.prob.plural.${g}`));
  for (const [alerta, grupos] of Object.entries(ALERTA_COBRE)) {
    assert.ok(CAMADA_DO_ALERTA[alerta], `o alerta ${alerta} leva a uma camada`);
    for (const g of grupos) assert.ok(GRUPOS_PREDIO[g], `${alerta} cobre ${g}`);
  }
});

test('as 7 camadas do M1b com a simulação de verdade: glifo, nome, cores, escala, unidade e legenda', () => {
  const antes = definirParteAtual('M1b');
  try {
    const sim = criarSimulacao({ semente: 'x3b-camadas', modo: 'livre' });
    const noPopover = camadasDoPopover(sim.camadas.ids()).map((c) => c.id);
    for (const id of ['valor', 'esgoto', 'transito', 'ar', 'ruido', 'nivel', 'empregos']) {
      assert.ok(noPopover.includes(id), `${id} no popover`);
      const c = CAMADAS_UI.find((x) => x.id === id);
      assert.ok(glifo(c.glifo), `glifo ${c.glifo}`);
      const d = sim.q.camada(id);
      assert.ok(d?.dados, `${id} tem dados`);
      const p = paleta(d);
      assert.ok(p.cores.length >= (p.categorico ? 3 : 8), `${id} tem cores`);
      assert.ok(p.cores.every((h) => /^#[0-9a-f]{6}$/.test(h)), `${id}: cores hex`);
      const m = modeloLegenda(d, { t, num: (n) => String(n) });
      assert.ok(m.titulo && !m.titulo.startsWith('??'), `${id}: título`);
      assert.ok(m.unidade, `${id}: unidade por extenso`);
      assert.ok(m.resumo, `${id}: resumo`);
      const texto = JSON.stringify(m);
      assert.doesNotMatch(texto, /\?\?|—|–|NaN|undefined/, `${id}: texto limpo`);
      if (m.tipo === 'cat') assert.ok(m.itens.length >= 4 && m.itens.every((i) => i.texto && i.cor), `${id}: itens`);
      else assert.ok(m.pontas[0] && m.pontas[1] && m.gradiente.includes('linear-gradient'), `${id}: rampa`);
    }
    // trânsito, ar e ruído: do cinza ao âmbar no limite e ao vermelho; o limite cai na posição certa da rampa
    for (const id of ['transito', 'ar', 'ruido']) {
      const d = sim.q.camada(id);
      const p = paleta(d);
      assert.equal(p.tipo, 'ale', id);
      assert.equal(p.cores[0], PALETA.alerta.livre);
      assert.equal(p.cores[7], PALETA.alerta.pesado);
      const lim = limiteDe(d);
      const pos = (lim - d.escala.min) / (d.escala.max - d.escala.min);
      assert.ok(pos > 0.3 && pos < 0.8, `${id}: limite em ${pos}`);
      // a rampa escurece do começo ao fim (3:1 entre as pontas), então se lê também sem cor
      assert.ok(contraste(p.cores[0], p.cores[7]) >= 3, `${id}: pontas`);
      assert.ok(contraste(paleta(d, { daltonico: true }).cores[7], PALETA.alerta.limite) >= 2, `${id}: daltônico`);
    }
    // empregos: dois lados (âmbar e azul) com o cinza no equilíbrio
    const emp = paleta(sim.q.camada('empregos'));
    assert.equal(emp.tipo, 'div');
    assert.equal(emp.cores[0], PALETA.empregos.ruim);
    assert.equal(emp.cores[7], PALETA.empregos.bom);
    const le = modeloLegenda(sim.q.camada('empregos'), { t, num: (n) => String(n) });
    assert.deepEqual(le.pontas, ['Sem emprego', 'Vagas abertas'], 'as pontas dizem o que cada lado é');
    assert.equal(le.marcas[0].texto, 'Equilibrado');
    // o trânsito diz "Na capacidade" no 1
    assert.equal(modeloLegenda(sim.q.camada('transito'), { t, num: (n) => String(n) }).marcas[0].texto, 'Na capacidade');
    // a escala de ar e ruído tem as palavras no meio
    assert.equal(modeloLegenda(sim.q.camada('ar'), { t, num: (n) => String(n) }).marcas[0].texto, 'Ar pesado');
  } finally {
    definirParteAtual(antes);
  }
});

test('glifos próprios das camadas: fumaca, ruido, vagas e nivel existem, são traços curtos e não repetem os antigos', () => {
  for (const [id, g] of [['ar', 'fumaca'], ['ruido', 'ruido'], ['empregos', 'vagas'], ['nivel', 'nivel']]) {
    assert.equal(CAMADAS_UI.find((c) => c.id === id).glifo, g);
    const d = glifo(g);
    assert.ok(d && d.tracos.length >= 1 && d.tracos.length <= 5, g);
    for (const traco of d.tracos) assert.match(traco, /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/, `${g}: só caminho SVG`);
  }
  for (const g of ['nuvem', 'som', 'trabalho']) assert.notEqual(glifo(g).tracos.join(), glifo(g === 'nuvem' ? 'fumaca' : g === 'som' ? 'ruido' : 'vagas').tracos.join());
  // o aviso do esgoto, do ar e dos empregos aparece nos marcadores da camada
  assert.deepEqual(AVISOS_DA_CAMADA.esgoto, ['esgoto']);
  assert.ok(AVISOS_DA_CAMADA.empregos.includes('trabalho'));
});

test('a aba Problemas está no corpo da Cidade e o código da aba usa só textos que existem', () => {
  const cidade = readFileSync(join(RAIZ, 'fonte/ui/telas/corpo/Cidade.jsx'), 'utf8');
  assert.match(cidade, /'servicos', 'problemas'/);
  const corpo = readFileSync(join(RAIZ, 'fonte/ui/telas/corpo/Problemas.jsx'), 'utf8');
  for (const [, k] of corpo.matchAll(/\bt\('([\w.]+)'/g)) assert.ok(temTexto(k), `texto ${k}`);
  for (const k of ['x3.prob.grav.', 'x3.prob.plural.']) for (const g of ['grave', 'atencao', 'info']) assert.ok(temTexto(`${k}${g}`));
  assert.ok(temTexto('cid.aba.problemas'));
  for (const a of ['problema', 'problema.ver', 'problema.proximo']) assert.ok(corpo.includes(`a="${a}"`), `data-a ${a}`);
});
