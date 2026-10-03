// Testes da X3a (camadas, marcadores e rótulos), sem navegador: as rampas de cada camada (categórica, divergente com o
// cinza no meio, sequencial que escurece), o pedido ao render (o 0 de "sem dado" na tabela de prédios, os índices da
// categórica), as legendas com os textos de verdade, o teto de marcadores por perfil e o agrupamento por setor de
// longe, o filtro dos avisos, o gancho 'camada' (nenhuma leitura de textura, tudo atrás do uniforme; o domínio
// desligado não desenha nada), o atlas, os rótulos da sede v3 em inglês e as camadas da simulação de verdade.
// Roda sozinho: node ferramentas/testes/camadas.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { signal } from '@preact/signals';

import { CAMADAS_UI, PALETA, paleta, paraRender, valorNaTabela, modeloLegenda, rampaDivergente, luminancia, contraste, escalaDe } from '../../fonte/ui/mundo/camadas.js';
import { escolherAvisos, AVISOS_DA_CAMADA, GLIFOS_PADRAO, FILTROS_AVISOS, filtroAtual } from '../../fonte/ui/mundo/marcadores.js';
import * as uiMarcadores from '../../fonte/ui/mundo/marcadores.js';
import { dinheiro } from '../../fonte/ui/formato.js';
import { mapaAtlas, GLIFOS_ATLAS, PRIMEIRO_DIGITO, ATLAS } from '../../fonte/ui/glifos/atlas.js';
import { glifo } from '../../fonte/ui/glifos/glifos.js';
import { marcosDaSede, areasDoEspelho, colocar, centroide, valeNaDistancia, ROTULOS } from '../../fonte/ui/mundo/rotulos.js';
import * as renderCamadas from '../../fonte/render/sobreposicoes/camadas.js';
import * as renderMarcadores from '../../fonte/render/sobreposicoes/desenhoMarcadores.js';
import * as cascaMarcadores from '../../fonte/render/sobreposicoes/marcadores.js';
import * as renderAncoras from '../../fonte/render/sobreposicoes/ancoras.js';
import { ganchos } from '../../fonte/render/motor/ganchos.js';
import { PERFIS, porPerfil } from '../../fonte/render/motor/perfis.js';
import { camadaSintetica, avisosSinteticos, CAMADAS_CENA } from '../../fonte/render/cenas/camadas.js';
import { CAMADAS } from '../../fonte/contratos/camadas.js';
import { PARTES_NOMES, TRECHOS_HORIZON, PLANOS } from '../../fonte/data/arcologia-plano.js';
import { t, temTexto, registrarTextos, chavesRepetidas } from '../../fonte/ui/textos.js';
import * as textosX3 from '../../fonte/ui/textos/x3.js';
import * as textosS1 from '../../fonte/ui/textos/s1.js';
import * as textosS2 from '../../fonte/ui/textos/s2.js';
import * as textosU1 from '../../fonte/ui/textos/u1.js';
import { criarSimulacao } from '../../fonte/sim/estado.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8');
for (const m of [textosU1, textosS1, textosS2, textosX3]) m.registrar(registrarTextos);
const num = (n) => new Intl.NumberFormat('pt-BR').format(n);

// ------------------------------------------------------------------------------------------------ apoio

/** Tabela de prédios de teste: uma grade de 40 x 40 prédios a cada 20 m em volta da origem. */
function prediosTeste(lado = 40, passo = 20) {
  const n = lado * lado;
  const P = { n, viva: new Uint8Array(n).fill(1), ger: new Uint16Array(n), x: new Float64Array(n), y: new Float32Array(n), z: new Float64Array(n), nivel: new Uint8Array(n).fill(2), tipo: new Uint8Array(n), zona: new Uint8Array(n).fill(1) };
  for (let j = 0; j < lado; j++) for (let i = 0; i < lado; i++) {
    const k = j * lado + i;
    P.x[k] = (i - lado / 2) * passo;
    P.z[k] = (j - lado / 2) * passo;
  }
  return P;
}

/** Contexto mínimo do render para os domínios das sobreposições (sem WebGL). */
function ctxTeste({ perfil = PERFIS.media, P = prediosTeste(), cam = [0, 700, 900] } = {}) {
  const camera = new THREE.PerspectiveCamera(45, 1376 / 768, 0.5, 20000);
  camera.position.set(...cam);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const ouvintes = new Map();
  const ctx = {
    cena: new THREE.Scene(),
    camera,
    canvas: { clientWidth: 1376, clientHeight: 768 },
    perfil,
    ganchos,
    renderer: { toneMapping: THREE.NoToneMapping },
    ambiente: null,
    stats: { instancias: {} },
    medidas: { familia: (o) => o },
    sobre: {},
    sim: { espelho: { predios: P, terreno: null } },
    dominios: new Map(),
    ouvir(nome, fn) {
      const l = ouvintes.get(nome) ?? [];
      l.push(fn);
      ouvintes.set(nome, l);
      return () => ouvintes.set(nome, (ouvintes.get(nome) ?? []).filter((f) => f !== fn));
    },
    emitir(nome, v) {
      ctx.sobre[nome] = v;
      for (const fn of ouvintes.get(nome) ?? []) fn(v, ctx);
    },
    dominio: (nome) => ctx.dominios.get(nome) ?? null,
  };
  return ctx;
}

/** Monta um domínio do render pelo registrar(api) do módulo. */
function montar(mod, ctx) {
  let fabrica = null;
  let sel = null;
  mod.registrar({ ganchos, registrarDominio: (nome, f) => (fabrica = f), registrarSelecionavel: (nome, fn) => (sel = fn) });
  const inst = fabrica(ctx);
  ctx.dominios.set(inst.nome, inst);
  return { inst, sel };
}

// ------------------------------------------------------------------------------------------------ rampas

test('camadas do M1a no popover: as 6 da D29 no contrato, com glifo e nome', () => {
  for (const id of ['zonas', 'bemEstar', 'agua', 'energia', 'servicos', 'recursos']) {
    assert.equal(CAMADAS[id]?.parte, 'M1a', id);
    const c = CAMADAS_UI.find((x) => x.id === id);
    assert.ok(c, `${id} no popover`);
    assert.ok(glifo(c.glifo), `glifo ${c.glifo}`);
    assert.ok(temTexto(`camada.${id}`), `nome da camada ${id}`);
  }
});

test('rampas: categórica pelas famílias, divergente com o cinza no meio, sequencial que escurece', () => {
  const zonas = paleta(camadaSintetica('zonas', null) ?? { id: 'zonas', tipo: 'cat', escala: { min: 0, max: 7 } });
  assert.equal(zonas.categorico, true);
  assert.equal(zonas.cores.length, 8);
  assert.equal(zonas.cores[2], PALETA.zonas.resMedia);
  assert.equal(zonas.cores[7], PALETA.zonas.industria);
  // água: ok, racionada, sem e produtor, distintas também pela luminância (não só pelo matiz)
  const agua = paleta({ id: 'agua', tipo: 'cat', escala: { min: 0, max: 4 } });
  assert.deepEqual(agua.cores.slice(1, 5), [PALETA.rede.ok, PALETA.rede.racionado, PALETA.rede.sem, PALETA.rede.produtor]);
  assert.ok(contraste(PALETA.rede.racionado, PALETA.rede.ok) > 1.5, 'racionada x ok');
  // o produtor não se confunde com o racionado (a luz e a deuteranopia juntavam o âmbar e o champanhe) nem com o atendido
  assert.ok(contraste(PALETA.rede.produtor, PALETA.rede.racionado) > 3, 'produtor x racionada');
  assert.ok(contraste(PALETA.rede.produtor, PALETA.rede.ok) > 1.8, 'produtor x ok');
  assert.notEqual(PALETA.rede.produtor.toLowerCase(), renderMarcadores.CORES_MARC.aro[3], 'o champanhe é da Holding');
  // bem-estar: divergente com o cinza no 60, vermelho no 0 e azul no 100
  const bem = { id: 'bemEstar', tipo: 'seq', escala: { min: 0, max: 100, meio: 60 } };
  const pb = paleta(bem);
  assert.equal(pb.tipo, 'div');
  assert.equal(pb.cores[0], PALETA.div.ruim);
  assert.equal(pb.cores[7], PALETA.div.bom);
  const r = rampaDivergente(0, 100, 60, PALETA.div, 11); // paradas a cada 10: a 6ª é o 60
  assert.equal(r[6], PALETA.div.meio);
  // para daltonismo o vermelho vira laranja
  assert.equal(paleta(bem, { daltonico: true }).cores[0], PALETA.divDaltonico.ruim);
  // serviços: divergente de 0 a 1; valor: sequencial, cada cor mais escura que a anterior
  assert.equal(paleta({ id: 'servicos', tipo: 'seq', escala: { min: 0, max: 1 } }).tipo, 'div');
  const val = paleta({ id: 'valor', tipo: 'seq', escala: { min: 0, max: 1200 } });
  assert.equal(val.tipo, 'seq');
  for (let k = 1; k < val.cores.length; k++) assert.ok(luminancia(val.cores[k]) < luminancia(val.cores[k - 1]), `seq ${k}`);
  // nada de verde-lima na paleta (estética proibida): o verde das zonas e o da terra fértil são escuros e frios
  for (const h of [...Object.values(PALETA.zonas), ...Object.values(PALETA.recursos)]) {
    const [rr, g, b] = [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
    assert.ok(!(g > 170 && rr > 120 && b < 90), `verde-lima em ${h}`);
  }
});

test('pedido ao render: o 0 de "sem dado" na tabela de prédios e os índices da categórica', () => {
  // contínua por prédio (bem-estar): o mínimo dá 1, o máximo 255, o -1 (sem moradores) e o NaN dão 0
  const bem = { id: 'bemEstar', fonte: 'predios', dados: Float32Array.from([0, 100, -1, NaN, 60]), tipo: 'seq', escala: { min: 0, max: 100, meio: 60 } };
  const p = paraRender(bem);
  assert.equal(p.fonte, 'predios');
  assert.equal(p.categorico, false);
  assert.equal(valorNaTabela(p, 0), 1);
  assert.equal(valorNaTabela(p, 100), 255);
  assert.equal(valorNaTabela(p, -1), 0);
  assert.equal(valorNaTabela(p, NaN), 0);
  // o R4a lê o canal R da tabela com a conta do render: a cor do 60 é a do meio da rampa
  const r60 = valorNaTabela(p, 60);
  assert.ok(Math.abs((r60 - 1) / 254 - 0.6) < 0.01);
  // categórica por prédio (água): o R é o próprio valor (o índice da cor); 0 fica neutro
  const agua = { id: 'agua', fonte: 'predios', dados: Float32Array.from([0, 1, 2, 3, 4]), tipo: 'cat', escala: { min: 0, max: 4 } };
  const pa = paraRender(agua);
  assert.equal(pa.categorico, true);
  assert.deepEqual([0, 1, 2, 3, 4].map((v) => valorNaTabela(pa, v)), [0, 1, 2, 3, 4]);
  assert.ok(pa.cores.length <= renderCamadas.MAX_CORES);
  // arestas, células e grade seguem com a escala da simulação; recursos pela categoria
  const serv = paraRender({ id: 'servicos', fonte: 'arestas', dados: new Float32Array(3), tipo: 'seq', escala: { min: 0, max: 1 } });
  assert.deepEqual([serv.min, serv.max], [0, 1]);
  const rec = paraRender({ id: 'recursos', fonte: 'grade', dados: new Float32Array(4), categoria: Uint8Array.from([0, 1, 4, 6]), grade: { n: 2, passo: 32, origem: [0, 0] }, tipo: 'seq', escala: { min: 0, max: 1 } });
  assert.equal(rec.categorico, true);
  assert.deepEqual(Array.from(rec.dados), [0, 1, 4, 6]);
  assert.equal(rec.cores[4], PALETA.recursos.calcario);
  assert.equal(paraRender(null), null);
  // Zonas: as células no chão e a zona de cada prédio de zona (0 no serviço) para pintar o prédio
  const P = { n: 3, viva: Uint8Array.from([1, 1, 0]), tipo: Uint8Array.from([0, 1, 0]), zona: Uint8Array.from([4, 2, 7]) };
  const pz = paraRender({ id: 'zonas', fonte: 'celulas', dados: new Float32Array(2), tipo: 'cat', escala: { min: 0, max: 7 } }, { predios: P });
  assert.deepEqual(Array.from(pz.porPredio.dados), [4, 0, 0]);
  assert.equal(paraRender({ id: 'agua', fonte: 'predios', dados: new Float32Array(2), tipo: 'cat', escala: { min: 0, max: 4 } }, { predios: P }).porPredio, undefined);
  // por aresta (Serviços): o prédio leva o valor da rua da frente (a célula da linha 0); sem rua, NaN (neutro)
  const C = { n: 3, viva: Uint8Array.from([1, 1, 1]), predio: Int32Array.from([0, 0, 1]), linha: Uint8Array.from([1, 0, 0]), aresta: Int32Array.from([1, 0, -1]) };
  const ps = paraRender({ id: 'servicos', fonte: 'arestas', dados: Float32Array.from([0.25, 0.9]), tipo: 'seq', escala: { min: 0, max: 1 } }, { predios: P, celulas: C });
  assert.equal(ps.porPredio.categorico, false);
  assert.equal(ps.porPredio.dados[0], 0.25);
  assert.ok(Number.isNaN(ps.porPredio.dados[1]) && Number.isNaN(ps.porPredio.dados[2]));
  assert.deepEqual(escalaDe({ escala: { min: 5, max: 5 } }), { min: 5, max: 6 });
});

test('legendas: títulos, pontas, marcas e categorias com os textos de verdade (sem travessão nem chave faltando)', () => {
  const esp = { predios: prediosTeste(10), celulas: null };
  const casos = [
    { id: 'agua', d: camadaSintetica('agua', esp) },
    { id: 'bemEstar', d: camadaSintetica('bemEstar', esp) },
    { id: 'valor', d: camadaSintetica('valor', esp) },
    { id: 'recursos', d: camadaSintetica('recursos', esp) },
    { id: 'servicos', d: { id: 'servicos', fonte: 'arestas', dados: new Float32Array(2), tipo: 'seq', escala: { min: 0, max: 1, unidade: '%' }, legenda: [{ v: 0, chave: 'camada.servicos.sem' }, { v: 1, chave: 'camada.servicos.completo' }], resumo: { chave: 'camada.servicos.resumo', params: { media: 47 } } } },
  ];
  for (const { id, d } of casos) {
    const m = modeloLegenda(d, { t, num });
    const tudo = JSON.stringify(m);
    assert.ok(!tudo.includes('??'), `${id}: chave faltando`);
    assert.ok(!/[—–]/.test(tudo), `${id}: travessão`);
    assert.equal(m.titulo, t(`camada.${id}`));
  }
  const agua = modeloLegenda(casos[0].d, { t, num });
  assert.equal(agua.tipo, 'cat');
  assert.deepEqual(agua.itens.map((i) => i.texto), ['Com água', 'Racionada', 'Sem água', 'Produz água']);
  const bem = modeloLegenda(casos[1].d, { t, num });
  assert.equal(bem.tipo, 'div');
  // a Contribuição do resumo vai em dólar pelo formato da interface (D68, D87), nunca em unidades de desenho
  const bemReal = { ...casos[1].d, resumo: { chave: 'camada.bemEstar.resumo', params: { media: 64.4, tarifa: 11 } } };
  const resumo = modeloLegenda(bemReal, { t, num, dinheiro }).resumo;
  assert.ok(resumo.includes(dinheiro(11)) && resumo.includes('US$'), resumo);
  assert.ok(resumo.includes('Média da cidade 64;'), resumo);
  assert.deepEqual(bem.pontas, ['0', '100']);
  assert.deepEqual(bem.marcas.map((m) => m.texto), ['30', '60']);
  assert.ok(bem.marcas[0].dica.includes('Contribuição de 5'));
  assert.ok(bem.gradiente.startsWith('linear-gradient(90deg,'));
  const serv = modeloLegenda(casos[4].d, { t, num });
  assert.deepEqual(serv.pontas, ['Sem atendimento', 'Bem atendido']);
  assert.equal(serv.resumo, 'Atendimento médio das ruas: 47%');
  const val = modeloLegenda(casos[2].d, { t, num });
  assert.deepEqual(val.pontas, ['Baixo', 'Alto']);
  assert.deepEqual(val.marcas.map((m) => m.texto), ['600']);
  const rec = modeloLegenda(casos[3].d, { t, num, extra: t('x3.legenda.obrasParadas', { n: 3 }) });
  assert.equal(rec.tipo, 'cat');
  assert.equal(rec.itens.length, 6);
  assert.equal(rec.extra, '3 obras paradas por falta de material');
});

// ------------------------------------------------------------------------------------------------ marcadores

test('filtro dos avisos: só os da camada ligada, graves e atenção, nenhum, e a forma da Holding', () => {
  const av = { versao: 3, idx: Int32Array.from([1, 2, 3, 4, 5]), glifo: Uint8Array.from([3, 4, 6, 9, 1]), gravidade: Uint8Array.from([2, 1, 1, 0, 2]), nomes: GLIFOS_PADRAO };
  const todos = escolherAvisos(av);
  assert.equal(todos.length, 5);
  assert.deepEqual(todos.map((m) => m.prioridade), [3, 3, 2, 2, 1]);
  assert.deepEqual(escolherAvisos(av, { camada: 'agua' }).map((m) => m.glifo), ['semAgua']);
  assert.deepEqual(escolherAvisos(av, { camada: 'recursos' }).map((m) => m.idx), [3]);
  assert.equal(escolherAvisos(av, { camada: 'servicos' }).length, 0);
  assert.equal(escolherAvisos(av, { filtro: 'importantes' }).length, 4);
  assert.equal(escolherAvisos(av, { filtro: 'nenhum' }).length, 0);
  const h = escolherAvisos(av, { ehHolding: (i) => i === 3 || i === 1 });
  assert.equal(h.find((m) => m.idx === 3).gravidade, 'holding', 'atenção na Holding: aro duplo');
  assert.equal(h.find((m) => m.idx === 1).gravidade, 'grave', 'grave continua losango');
  assert.equal(escolherAvisos(av, { max: 2 }).length, 2);
  assert.deepEqual(FILTROS_AVISOS, ['todos', 'importantes', 'nenhum']);
  assert.equal(filtroAtual({}), 'todos');
  // todo glifo das camadas e dos avisos tem célula no atlas
  const mapa = mapaAtlas();
  for (const lista of Object.values(AVISOS_DA_CAMADA)) for (const g of lista) assert.ok(mapa[g] !== undefined, `atlas sem ${g}`);
  for (const g of GLIFOS_PADRAO.slice(1)) assert.ok(mapa[g] !== undefined, `atlas sem ${g}`);
});

test('marcadores na interface: refeitos na troca de partida, e pausado nada se consulta', () => {
  const definidos = [];
  const quadros = [];
  let consultas = 0;
  const avisos = { versao: 4, idx: Int32Array.from([1, 2]), glifo: Uint8Array.from([3, 6]), gravidade: Uint8Array.from([2, 1]), nomes: GLIFOS_PADRAO };
  const novaSim = () => ({ espelho: { tempo: { tique: 100 }, predios: { n: 4, tipo: new Uint8Array(4) } } });
  let sim = novaSim();
  const ui = {
    R: { marcadores: { definir: (l) => definidos.push(l) } },
    loja: { eventos: signal([]), camada: signal(null), prefs: signal({}) },
    consultar: (nome) => (nome === 'avisosPredios' ? (consultas++, avisos) : null),
    obterSim: () => sim,
    aoQuadro: (fn) => quadros.push(fn),
  };
  uiMarcadores.registrar(ui);
  const rodar = (tMs) => quadros.forEach((fn) => fn(tMs));
  rodar(1000);
  assert.equal(definidos.length, 1);
  assert.equal(definidos[0].length, 2);
  // pausado (o tique não anda): a conferência de 2 s não refaz a consulta
  const antes = consultas;
  rodar(3500);
  rodar(6000);
  assert.equal(consultas, antes, 'consultou com o relógio parado');
  // o relógio andou, a versão é a mesma: consulta e não manda de novo
  sim.espelho.tempo.tique = 140;
  rodar(8500);
  assert.equal(consultas, antes + 1);
  assert.equal(definidos.length, 1);
  // outra partida com a mesma versão de avisos: a lista vai de novo (a velha apontava para outros prédios)
  sim = novaSim();
  rodar(8800);
  assert.equal(definidos.length, 2, 'a troca de partida não refez os marcadores');
  // a camada ligada filtra na hora (sujo), sem esperar os 2 s
  ui.loja.camada.value = 'agua';
  rodar(9100);
  assert.deepEqual(definidos.at(-1).map((m) => m.glifo), ['semAgua']);
});

test('teto de marcadores por perfil (60 no Média, 200 no PC herdando o Alta, 30 no Leve) e um por setor de longe', () => {
  assert.equal(porPerfil(renderMarcadores.MARC.teto, PERFIS.media), 60);
  assert.equal(porPerfil(renderMarcadores.MARC.teto, PERFIS.pc), 200);
  assert.equal(porPerfil(renderMarcadores.MARC.teto, PERFIS.leve), 30);
  // 1.600 avisos numa grade de 800 x 800 m vistos de perto: o teto corta, os graves primeiro
  const itens = [];
  for (let k = 0; k < 1600; k++) itens.push({ idx: k, x: (k % 40) * 20 - 400, y: 0, z: Math.floor(k / 40) * 20 - 400, celula: 1, forma: k % 3 === 0 ? 0 : 1, prioridade: k % 3 === 0 ? 3 : 2 });
  const perto = renderMarcadores.escolherMarcadores(itens, { cam: [0, 300, 300], teto: 60, longe: 5000 });
  assert.equal(perto.length, 60);
  assert.ok(perto.every((m) => m.forma === 0 && m.n === 1), 'os 60 são graves');
  for (let k = 1; k < perto.length; k++) assert.ok(perto[k].dist >= perto[k - 1].dist, 'mais perto primeiro');
  // de longe: um por setor de 256 m, com a soma e a forma do pior
  const longe = renderMarcadores.escolherMarcadores(itens, { cam: [0, 3000, 6000], teto: 200, longe: 1000 });
  assert.ok(longe.length <= 16, `setores: ${longe.length}`);
  assert.equal(longe.reduce((s, m) => s + m.n, 0), 1600);
  assert.ok(longe.every((m) => m.forma === 0 && m.celula === -1));
  // forma pela gravidade
  assert.deepEqual(['grave', 'atencao', 'info', 'holding', 2, 1, 0].map(renderMarcadores.formaDe), [0, 1, 2, 3, 0, 1, 2]);
});

test('domínio dos marcadores: nada desenhado sem avisos, teto do perfil na instância, seleção pela tela', async () => {
  for (const [perfil, teto] of [[PERFIS.media, 60], [PERFIS.pc, 200]]) {
    const ctx = ctxTeste({ perfil });
    // a casca do índice: registra o domínio e a seleção e busca o desenho sob demanda
    const { inst, sel } = montar(cascaMarcadores, ctx);
    assert.equal(inst.mostrados().length, 0);
    await inst.carregado();
    const malha = ctx.cena.getObjectByName('marcadores');
    assert.ok(malha, 'a malha entrou na cena');
    inst.quadro(0, ctx);
    assert.equal(malha.visible, false, 'sem avisos, nenhuma chamada');
    ctx.emitir('marcadores', Array.from({ length: 1600 }, (_, i) => ({ idx: i, glifo: 'semAgua', gravidade: i % 2 ? 'grave' : 'atencao', prioridade: 3 })));
    inst.quadro(16, ctx);
    assert.equal(malha.visible, true);
    assert.ok(malha.geometry.instanceCount > 0 && malha.geometry.instanceCount <= teto, `${perfil.id}: ${malha.geometry.instanceCount}`);
    assert.equal(ctx.stats.instancias.marcadores, malha.geometry.instanceCount);
    // toque em cima do primeiro marcador desenhado: devolve o prédio dele
    const m = inst.mostrados()[0];
    const v = new THREE.Vector3(m.x, m.y, m.z).project(ctx.camera);
    const xTela = ((v.x + 1) / 2) * 1376;
    const yTela = ((1 - v.y) / 2) * 768 - (0.5 * renderMarcadores.MARC.tamPx + 2);
    const r = sel({ origem: ctx.camera.position.toArray(), dir: [0, -1, 0], xTela, yTela }, ctx);
    assert.equal(r?.tipo, 'marcador');
    assert.equal(r.idx, m.idx);
    assert.equal(sel({ origem: ctx.camera.position.toArray(), dir: [0, -1, 0], xTela: -500, yTela: -500 }, ctx), null);
    // no modo foto some; a lista vazia apaga
    ctx.sobre.estado = 'foto';
    inst.quadro(32, ctx);
    assert.equal(malha.visible, false);
    ctx.sobre.estado = 'livre';
    ctx.emitir('marcadores', []);
    inst.quadro(1000, ctx);
    assert.equal(malha.visible, false);
    inst.descartar();
    assert.equal(ctx.cena.getObjectByName('marcadores'), undefined);
  }
});

// ------------------------------------------------------------------------------------------------ gancho camada

test('gancho camada: nenhuma leitura de textura nem varying, tudo atrás do uniforme, e entra no laço da luz', () => {
  const G = renderCamadas;
  for (const [nome, src] of [['pars', G.CAMADA_PARS], ['sol', G.CAMADA_SOL], ['indireta', G.CAMADA_INDIRETA]]) {
    assert.ok(!/texture\s*\(|texelFetch\s*\(|textureLod\s*\(|textureGrad\s*\(/.test(src), `${nome}: lê textura`);
    assert.ok(!/\bvarying\b|\bflat\b|\bmediump\b/.test(src), `${nome}: varying ou mediump`);
  }
  // o código que roda no main começa pelo teste do uniforme (desligada, um desvio só)
  for (const src of [G.CAMADA_SOL, G.CAMADA_INDIRETA]) {
    const corpo = src.replace(/#if[^\n]*\n/, '').trim();
    assert.ok(corpo.startsWith('if ( gCamada.x > 0.5'), corpo.slice(0, 40));
  }
  // definido e aplicado num MeshStandardMaterial: os trechos vão para dentro do laço da luz direcional
  ganchos.definir('camada', G.ganchoCamada());
  const m = ganchos.aplicar(new THREE.MeshStandardMaterial(), ['camada']);
  const shader = { uniforms: {}, defines: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  m.onBeforeCompile(shader, null);
  assert.ok(shader.defines.G_CAMADA !== undefined);
  assert.ok(shader.uniforms.gCamada && shader.uniforms.gCamadaRampa);
  const fs = shader.fragmentShader;
  const passo = fs.indexOf('getDirectionalLightInfo( directionalLight, directLight );');
  const sol = fs.indexOf('gCamadaFeita = true;');
  assert.ok(passo > 0 && sol > passo, 'a troca do material vem depois da luz do sol ser lida');
  assert.ok(sol < fs.indexOf('RE_Direct( directLight', passo), 'e antes do RE_Direct dela');
  // o three r186 tira o difuso de diffuseContribution e o especular de specularColorBlended: o gancho troca os dois
  const fisico = THREE.ShaderChunk.lights_physical_fragment + THREE.ShaderChunk.lights_physical_pars_fragment;
  for (const campo of ['diffuseContribution', 'specularColorBlended', 'metalness']) {
    assert.ok(fisico.includes(`material.${campo}`), `o three mudou: material.${campo}`);
    assert.ok(G.CAMADA_SOL.includes(`material.${campo}`), `o gancho não troca material.${campo}`);
  }
  // o domínio: o aviso liga e desliga pelo uniforme; desligado, gCamada.x = 0
  const ctx = ctxTeste();
  const { inst } = montar(renderCamadas, ctx);
  const U = ganchos.obter('camada').uniformes;
  ctx.emitir('camadas', { fonte: 'predios', dados: new Float32Array(4), cores: ['#ff0000', '#00ff00'], min: 0, max: 255, categorico: true });
  assert.equal(U.gCamada.value.x, 1);
  assert.equal(U.gCamada.value.y, 2);
  assert.equal(U.gCamada.value.z, 1);
  assert.ok(U.gCamadaRampa.value[0].r > 0.9 && U.gCamadaRampa.value[0].g < 0.01, 'hex em linear');
  // camada do chão com porPredio: o canal R da tabela da R4a recebe o índice da cor de cada prédio
  const tabela = { image: { data: new Uint8Array(4 * 16) }, needsUpdate: false, clearUpdateRanges() {} };
  ctx.dominios.set('predios', { tabela });
  ctx.emitir('camadas', { fonte: 'celulas', dados: new Float32Array(4), cores: ['#000000', '#199e70'], min: 0, max: 7, categorico: true, porPredio: { dados: Float32Array.from([1, 0, 7, 4]) } });
  assert.deepEqual(Array.from(tabela.image.data.filter((_, k) => k % 4 === 0).slice(0, 4)), [1, 0, 7, 4]);
  assert.equal(tabela.needsUpdate, true);
  // contínua (Serviços pela rua da frente): 1 a 255 na rampa, NaN fica 0
  ctx.emitir('camadas', { fonte: 'arestas', dados: new Float32Array(2), cores: ['#e66767', '#3987e5'], min: 0, max: 1, categorico: false, porPredio: { dados: Float32Array.from([0, 1, NaN, 0.5]), categorico: false, min: 0, max: 1 } });
  assert.deepEqual(Array.from(tabela.image.data.filter((_, k) => k % 4 === 0).slice(0, 4)), [1, 255, 0, 128]);
  ctx.emitir('camadas', null);
  assert.equal(U.gCamada.value.x, 0);
  assert.deepEqual(inst.estado().ligada, false);
  assert.deepEqual(G.estadoDoAviso(null), { ligada: false, n: 0, categorico: false, cores: [] });
  assert.equal(G.estadoDoAviso({ cores: Array(12).fill('#ffffff') }).n, G.MAX_CORES);
});

test('âncoras: o morro esconde o rótulo atrás dele; o chão do próprio rótulo não', () => {
  // grade de 64 x 64 a 8 m com um morro de 80 m no meio
  const n = 64;
  const altura = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) altura[j * n + i] = Math.max(0, 80 - Math.hypot(i - 32, j - 32) * 8);
  const T = { n, passo: 8, origem: [-256, -256], altura };
  assert.equal(renderAncoras.ocultoPeloChao(T, [-250, 20, 0], [250, 5, 0]), true);
  assert.equal(renderAncoras.ocultoPeloChao(T, [-250, 400, 0], [250, 5, 0]), false);
  assert.equal(renderAncoras.ocultoPeloChao(T, [0, 300, -250], [0, 82, 0]), false);
  assert.equal(renderAncoras.ocultoPeloChao(null, [0, 0, 0], [1, 1, 1]), false);
});

// ------------------------------------------------------------------------------------------------ atlas e rótulos

test('atlas: células de 64 px num canvas de 512, os glifos de aviso do registro e os algarismos seguidos', () => {
  assert.equal(ATLAS.lado / ATLAS.celula, ATLAS.porLado);
  assert.equal(renderMarcadores.MARC.grade, ATLAS.porLado);
  const mapa = mapaAtlas();
  for (const g of GLIFOS_ATLAS) assert.ok(glifo(g), `glifo ${g} no registro`);
  assert.ok(GLIFOS_ATLAS.length <= PRIMEIRO_DIGITO);
  for (let d = 0; d < 10; d++) assert.equal(mapa[String(d)], PRIMEIRO_DIGITO + d);
  assert.ok(PRIMEIRO_DIGITO + 9 < ATLAS.porLado * ATLAS.porLado);
  assert.equal(new Set(Object.values(mapa)).size, Object.keys(mapa).length, 'células repetidas');
});

test('rótulos: os marcos da sede v3 em inglês, a gleba com o nome da sede, a colisão e o HUD', () => {
  const marcos = marcosDaSede('A');
  const textos = marcos.map((m) => m.texto);
  for (const nome of ['Blade Tower', 'Legacy Tower', 'Mirror Lake', 'Meridian Ring', 'Horizon Ring', 'Codex Tower', 'Helix Labs', 'Compass Tower', 'Park of Future Dreams']) assert.ok(textos.includes(nome), nome);
  for (const tr of TRECHOS_HORIZON) assert.ok(textos.includes(tr.nome), tr.nome);
  assert.equal(PARTES_NOMES.meridian, 'Meridian Ring');
  for (const m of marcos) assert.ok(m.p.every(Number.isFinite) && m.p[1] > 0, m.id);
  // o anel inteiro de longe, os trechos de perto
  const hor = marcos.find((m) => m.id === 'marco.horizon');
  const tr1 = marcos.find((m) => m.id === `marco.${TRECHOS_HORIZON[0].id}`);
  assert.equal(valeNaDistancia(hor, 800), false);
  assert.equal(valeNaDistancia(hor, 2400), true);
  assert.equal(valeNaDistancia(tr1, 800), true);
  assert.equal(valeNaDistancia(tr1, 2400), false);
  // áreas: o centroide e a gleba com o nome da sede
  assert.deepEqual(centroide([0, 0, 10, 0, 10, 10, 0, 10]).map((v) => +v.toFixed(6)), [5, 5]);
  const areas = areasDoEspelho({ areas: [{ id: 'gleba', nome: 'Gleba da Arcologia', contorno: [0, 0, 10, 0, 10, 10, 0, 10] }, { id: 'vila', nome: 'Vila de Santa Cida', contorno: [0, 0, 4, 0, 4, 4] }] });
  assert.equal(areas[0].texto, PLANOS.A.nome);
  assert.equal(areas[1].texto, 'Vila de Santa Cida');
  // colisão: dos dois que se cruzam fica o de maior prioridade; sob o HUD, nenhum; teto de 40
  const c = [
    { x: 100, y: 100, w: 80, h: 18, prioridade: 2, dist: 10 },
    { x: 120, y: 104, w: 80, h: 18, prioridade: 4, dist: 50 },
    { x: 400, y: 300, w: 60, h: 18, prioridade: 3, dist: 20 },
    { x: 700, y: 30, w: 60, h: 18, prioridade: 5, dist: 5 },
  ];
  assert.deepEqual(colocar(c, { hud: [{ x0: 650, x1: 800, y0: 0, y1: 50 }] }).sort(), [1, 2]);
  // inteiro na tela: o que sai pela borda fica de fora
  assert.deepEqual(colocar([{ x: 10, y: 100, w: 80, h: 18, prioridade: 1, dist: 1 }, { x: 300, y: 100, w: 80, h: 18, prioridade: 1, dist: 2 }], { tela: { w: 400, h: 300 } }), [1]);
  const muitos = Array.from({ length: 100 }, (_, k) => ({ x: (k % 10) * 150, y: Math.floor(k / 10) * 40, w: 60, h: 18, prioridade: 1, dist: k }));
  assert.equal(colocar(muitos).length, ROTULOS.max);
});

// ------------------------------------------------------------------------------------------------ textos e fontes

test('textos da X3: sem travessão, sem chave repetida, e toda chave x3 usada no código existe', () => {
  const fonte = ['fonte/ui/telas/Camadas.jsx', 'fonte/ui/telas/corpo/Camadas.jsx', 'fonte/ui/mundo/Rotulos.jsx', 'fonte/ui/mundo/marcadores.js', 'fonte/ui/mundo/camadas.js', 'fonte/render/cenas/camadas.js'].map(ler).join('\n');
  for (const [, chave] of fonte.matchAll(/'(x3\.[a-zA-Z.]+)'/g)) assert.ok(temTexto(chave), `texto faltando: ${chave}`);
  const x3 = ler('fonte/ui/textos/x3.js');
  assert.ok(!/[—–]/.test(x3), 'travessão');
  assert.ok(!/\bdia\b|Aluguel|\/dia/.test(x3));
  assert.deepEqual(chavesRepetidas().filter((k) => k.startsWith('x3.')), []);
  // filtros e camadas com rótulo
  for (const f of FILTROS_AVISOS) assert.ok(temTexto(`x3.filtro.${f}`));
});

// ------------------------------------------------------------------------------------------------ dados de verdade

test('camadas da simulação de verdade (S2a e S1a) passam pelo pedido ao render e pela legenda', () => {
  const sim = criarSimulacao({ semente: 'x3-camadas' });
  for (const id of ['zonas', 'bemEstar', 'agua', 'energia', 'servicos', 'recursos', 'valor']) {
    const d = sim.q.camada(id);
    assert.ok(d, `q.camada(${id})`);
    assert.equal(d.id, id);
    const p = paraRender(d);
    assert.ok(p, `${id}: pedido`);
    assert.ok(['predios', 'arestas', 'grade', 'celulas'].includes(p.fonte));
    assert.ok(p.cores.length >= 2 && p.cores.length <= renderCamadas.MAX_CORES, `${id}: ${p.cores.length} cores`);
    assert.ok(p.cores.every((h) => /^#[0-9a-f]{6}$/.test(h)), `${id}: cores`);
    assert.ok(Number.isFinite(p.min) && Number.isFinite(p.max) && p.max > p.min);
    if (p.fonte === 'grade') assert.equal(p.dados.length, d.grade.n * d.grade.n);
    const m = modeloLegenda(d, { t, num });
    assert.ok(!JSON.stringify(m).includes('??'), `${id}: legenda com chave faltando`);
  }
  // os avisos de verdade viram pedidos de marcador com glifo do atlas
  const av = sim.q.avisosPredios();
  const mapa = mapaAtlas();
  for (const m of escolherAvisos(av)) assert.ok(mapa[m.glifo] !== undefined, `atlas sem ${m.glifo}`);
});

test('dados de prova da cena: todas as camadas da cena e os avisos na cidade de teste', () => {
  const esp = { predios: prediosTeste(20), celulas: { n: 4, viva: Uint8Array.from([1, 1, 1, 0]), zona: Uint8Array.from([1, 4, 7, 2]) }, vias: { arestas: { n: 2, viva: Uint8Array.from([1, 1]), p: new Float64Array(16) } } };
  for (const id of CAMADAS_CENA) {
    const d = camadaSintetica(id, esp);
    assert.ok(d, id);
    assert.ok(paraRender(d), `${id}: pedido`);
  }
  assert.deepEqual(Array.from(camadaSintetica('zonas', esp).dados), [1, 4, 7, 0]);
  const av = avisosSinteticos(esp);
  assert.equal(av.idx.length, av.glifo.length);
  const muitos = avisosSinteticos({ predios: prediosTeste(120) }, { muitos: true });
  assert.ok(muitos.idx.length >= 3000 && muitos.idx.length < 3500, `${muitos.idx.length}`);
});
