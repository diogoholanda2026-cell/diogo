// Testes da interface da ZON2 (D112 e D113), sem navegador: validação do campo do lote, áreas que a ferramenta destaca, texto
// da rede de longo alcance, motivos de recusa de lugar, os comandos do painel pela porta da UI (acoes.js) contra a simulação
// de verdade, os textos (sem travessão, chaves usadas existem) e o CSS e as cenas da vitrine.
// Roda sozinho: node ferramentas/testes/ui-zon2.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { criarSimulacao } from '../../fonte/sim/estado.js';
import { t, temTexto } from '../../fonte/ui/textos.js';
import * as fmt from '../../fonte/ui/formato.js';
import { ligarAcoes, comando, frase } from '../../fonte/ui/acoes.js';
import { ligarConsultas, consultar } from '../../fonte/ui/consultas.js';
import { dicaDoBloqueio } from '../../fonte/ui/ferramentas/colocar.js';
import { validarLote, areasDaSessao, densificar, textoLongoAlcance, esperaInteira } from '../../fonte/ui/ferramentas/zon2.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8');

test('validarLote: inteiro de 1 a 1000 e soma ao lote em andamento no máximo 1000', () => {
  assert.deepEqual(validarLote('10'), { n: 10, erro: null });
  assert.deepEqual(validarLote(' 1000 '), { n: 1000, erro: null });
  for (const ruim of ['', '0', '1001', '5000', '1,5', '-3', 'abc', '10 20']) assert.equal(validarLote(ruim).erro, 'invalido', JSON.stringify(ruim));
  assert.equal(validarLote('100', 950).erro, 'maximo');
  assert.deepEqual(validarLote('50', 950), { n: 50, erro: null });
});

test('esperaInteira: arredonda para baixo e limita a 1000', () => {
  assert.equal(esperaInteira({ espera: 37.9 }), 37);
  assert.equal(esperaInteira({ espera: 1500 }), 1000);
  assert.equal(esperaInteira(null), 0);
});

test('areasDaSessao: distrito na indústria, utilidades nas utilidades, nada no resto', () => {
  const regras = { distrito: { tipos: ['pedreira'] }, utilidades: { tipos: ['captacao', 'solar'] } };
  assert.deepEqual(areasDaSessao({ tipo: 'zona', maquina: { zona: 'industria', apagar: false } }, regras), ['distrito']);
  assert.deepEqual(areasDaSessao({ tipo: 'zona', maquina: { zona: 'industria', apagar: true } }, regras), []);
  assert.deepEqual(areasDaSessao({ tipo: 'zona', maquina: { zona: 'resBaixa', apagar: false } }, regras), []);
  assert.deepEqual(areasDaSessao({ tipo: 'colocar', maquina: { tipo: 'solar' }, item: {} }, regras), ['utilidades']);
  assert.deepEqual(areasDaSessao({ tipo: 'colocar', maquina: { tipo: 'x' }, item: { zona: 'utilidades' } }, regras), ['utilidades']);
  assert.deepEqual(areasDaSessao({ tipo: 'colocar', maquina: { tipo: 'pedreira' }, item: {} }, regras), ['distrito']);
  assert.deepEqual(areasDaSessao({ tipo: 'colocar', maquina: { tipo: 'praca' }, item: {} }, regras), []);
  assert.deepEqual(areasDaSessao({ tipo: 'via', maquina: {} }, regras), []);
  assert.deepEqual(areasDaSessao(null, regras), []);
});

test('densificar: quebra as arestas e fecha o contorno', () => {
  const p = densificar([[0, 0], [250, 0], [250, 100], [0, 100]], 100);
  assert.equal(p.length, 3 + 1 + 3 + 1);
  assert.deepEqual(p[0], [0, 0]);
  for (let i = 1; i < p.length; i++) assert.ok(Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) <= 100.001);
});

test('textoLongoAlcance: nome da rede, metros e custo; sem alcance; sem linha', () => {
  const regras = { longoAlcance: { custoPorMetro: { agua: 8, energia: 5, esgoto: 8 } } };
  const lo = { rec: 'agua', metros: 420, custo: 3360, alcanca: true };
  const longo = textoLongoAlcance(lo, regras);
  assert.match(longo, /^Adutora · Linha de 420 m até a rede da cidade: US\$ .+ \(US\$ .+ por metro\)\.$/);
  assert.match(textoLongoAlcance({ ...lo, rec: 'esgoto' }, regras, { curto: true }), /^Emissário: 420 m, US\$ /);
  assert.match(textoLongoAlcance({ rec: 'energia', metros: 3400, custo: 0, alcanca: false }, regras), /3\.400 m/);
  assert.equal(textoLongoAlcance({ rec: 'energia', metros: 0, custo: 0, alcanca: false }, regras), t('zon2.rede.semRede'));
  assert.equal(textoLongoAlcance({ rec: 'energia', metros: 0, custo: 0, alcanca: true }, regras), null);
  assert.equal(textoLongoAlcance(null, regras), null);
});

test('recusas de lugar viram dica com motivo curto e texto longo', () => {
  for (const codigo of ['distrito', 'utilidades']) {
    const d = dicaDoBloqueio({ ok: false, codigo, dados: { area: 'x', nome: 'Y' } });
    assert.equal(d.chave, `zon2.dica.${codigo}`);
    assert.ok(temTexto(d.chave) && temTexto(d.chave.replace('.dica.', '.curto.')));
    assert.ok(t(d.chave.replace('.dica.', '.curto.')).length <= 32, 'o curto cabe no botão');
    assert.ok(frase({ ok: false, codigo }) && !frase({ ok: false, codigo }).startsWith('??'));
  }
});

test('o painel pela porta da UI: modo, lote, demanda acumulada e recusas com frase', async () => {
  const sim = criarSimulacao({ semente: 'ui-zon2' });
  ligarConsultas(() => sim);
  ligarAcoes({ obterSim: () => sim });
  const regras = consultar('zona.regras');
  assert.ok(regras.distrito.contorno.length >= 3 && regras.utilidades.contorno.length >= 3);
  assert.equal(regras.lote.max, 1000);
  assert.equal(consultar('zona.crescimento', { zona: 'resBaixa' }).modo, 'automatico');
  // lote no Automático: recusa com a frase do código modo
  const semModo = await comando('zona.lote', { zona: 'resBaixa', n: 10 }, { silencioso: true });
  assert.equal(semModo.codigo, 'modo');
  assert.equal(frase(semModo), t('codigo.modo'));
  const m = await comando('zona.modo', { zona: 'resBaixa', modo: 'manual' }, { silencioso: true });
  assert.ok(m.ok && m.idComando);
  assert.equal(consultar('zona.crescimento', { zona: 'resBaixa' }).modo, 'manual');
  const l = await comando('zona.lote', { zona: 'resBaixa', n: 40 }, { silencioso: true });
  assert.ok(l.ok);
  assert.equal(consultar('zona.crescimento', { zona: 'resBaixa' }).pedido, 40);
  assert.equal(validarLote('970', 40).erro, 'maximo');
  assert.equal((await comando('zona.lote', { zona: 'resBaixa', n: 970 }, { silencioso: true })).codigo, 'lote');
  const c = await comando('zona.lote', { zona: 'resBaixa', n: 0 }, { silencioso: true });
  assert.equal(c.dados.cancelados, 40);
  assert.equal(consultar('zona.crescimento', { zona: 'resBaixa' }).pedido, 0);
  assert.equal(esperaInteira(consultar('zona.crescimento', { zona: 'resBaixa' })), 0);
  // indústria fora do distrito: recusa com a frase legível
  const fora = await comando('zona.pintar', { pincel: { modo: 'circulo', x: 200, z: 190, raio: 24 }, zona: 7 }, { silencioso: true });
  assert.equal(fora.ok, false);
  assert.ok(['distrito', 'nada'].includes(fora.codigo), fora.codigo);
  if (fora.codigo === 'distrito') assert.equal(frase(fora), t('codigo.distrito'));
});

test('textos da ZON2: sem travessão, sem chave faltando, unidades com /h e as chaves usadas pelos componentes existem', () => {
  const textos = ler('fonte/ui/textos/zon2.js');
  assert.ok(!/[–—]/.test(textos), 'sem travessão');
  const usadas = new Set();
  for (const f of ['fonte/ui/ferramentas/zon2.js', 'fonte/ui/hud/Zon2.jsx', 'fonte/ui/hud/BarraFerramenta.jsx', 'fonte/ui/mundo/Cotas.jsx', 'fonte/ui/ferramentas/sessao.js', 'fonte/ui/ferramentas/colocar.js']) {
    for (const m of ler(f).matchAll(/'(zon2\.[a-zA-Z.]+)'/g)) usadas.add(m[1]);
  }
  for (const k of ['zon2.modo.automatico', 'zon2.modo.manual', 'zon2.contorno.distrito', 'zon2.contorno.utilidades', 'zon2.rede.agua', 'zon2.rede.energia', 'zon2.rede.esgoto']) usadas.add(k);
  for (const k of usadas) assert.ok(temTexto(k), `falta o texto ${k}`);
  assert.equal(fmt.numero(1000), '1.000');
});

test('CSS e cenas da vitrine da ZON2 existem e o registro dos contornos está na barra da ferramenta', () => {
  const css = ler('fonte/ui/tema/zon2.css');
  for (const c of ['.zon2-painel', '.z2-qtd', '.z2-area', '.z2-rotulo']) assert.ok(css.includes(c), c);
  const cenas = ler('ferramentas/vitrine/cenas/zon2.js');
  for (const c of ['zon2-painel-auto', 'zon2-painel-manual', 'zon2-distrito', 'zon2-utilidades-recusa', 'zon2-rede']) assert.ok(cenas.includes(`'${c}'`), c);
  assert.ok(ler('fonte/ui/hud/BarraFerramenta.jsx').includes('registrarZon2(ui)'));
});
