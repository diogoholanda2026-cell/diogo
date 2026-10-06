// Testes de integração da F0 (fechamento, F0-R): as peças falsas da vitrine seguem os mesmos contratos que a
// simulação e o render de verdade, e a árvore 3.1 das ferramentas existe (as das outras parcelas como esqueleto).
// Roda sozinho: node ferramentas/testes/integracao.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { CONSULTAS, EXEMPLO_BARRA } from '../../fonte/contratos/consultas.js';
import { COMANDOS } from '../../fonte/contratos/comandos.js';
import { ehCodigo } from '../../fonte/contratos/codigos.js';
import { API_RENDER, statsVazio } from '../../fonte/contratos/render.js';
import { criarSimFalsa } from '../vitrine/sim-falsa.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// forma de um objeto: caminho -> tipo (arrays e arrays tipados contam como folha)
function forma(v, p = '', out = new Map()) {
  if (v && typeof v === 'object' && !Array.isArray(v) && !ArrayBuffer.isView(v)) {
    for (const k of Object.keys(v)) forma(v[k], p ? `${p}.${k}` : k, out);
  } else out.set(p, Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
  return out;
}
const funcoes = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'function' ? [p + k] : v && typeof v === 'object' ? funcoes(v, `${p}${k}.`) : []));

test('vitrine: a simulação falsa tem a barra da real, só consultas do contrato e todo comando do contrato', () => {
  const real = criarSimulacao({ semente: 'integracao' });
  for (const cenario of ['inicio', 'meio']) {
    const falsa = criarSimFalsa({ cenario });
    const a = forma(real.q.barra());
    const b = forma(falsa.q.barra());
    const e = forma(EXEMPLO_BARRA);
    assert.deepEqual([...b.keys()].sort(), [...a.keys()].sort(), `${cenario}: chaves da barra`);
    assert.deepEqual([...b.keys()].sort(), [...e.keys()].sort(), `${cenario}: chaves do EXEMPLO_BARRA`);
    const difere = [...a.keys()].filter((k) => a.get(k) !== 'null' && b.get(k) !== 'null' && a.get(k) !== b.get(k));
    assert.deepEqual(difere, [], `${cenario}: tipos da barra`);
    const fora = funcoes(falsa.q).filter((k) => !CONSULTAS[k]);
    assert.deepEqual(fora, [], `${cenario}: consultas fora do contrato`);
    for (const nome of Object.keys(COMANDOS)) {
      const r = falsa.cmd(nome, structuredClone(COMANDOS[nome].exemplo ?? {}));
      assert.equal(typeof r?.ok, 'boolean', `${nome}: resposta sem ok`);
      if (!r.ok) assert.ok(ehCodigo(r.codigo), `${nome}: código ${r.codigo} fora do contrato`);
    }
    // comando desconhecido: o mesmo código do núcleo
    assert.equal(falsa.cmd('inventado', {}).codigo, real.cmd('inventado', {}).codigo);
  }
});

test('vitrine: o render falso implementa toda a API do render (API_RENDER) e o formato de R.stats', async () => {
  // o render falso desenha num canvas 2D; aqui basta um canvas e um navegador de mentira que aceitam tudo
  const nada = new Proxy(function () {}, {
    get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : nada),
    apply: () => nada,
    construct: () => nada,
    set: () => true,
  });
  const antes = {};
  const falsos = {
    window: globalThis, document: nada, Image: function () { return nada; }, addEventListener: () => {},
    innerWidth: 986, innerHeight: 443, devicePixelRatio: 1, requestAnimationFrame: () => 0,
  };
  for (const [k, v] of Object.entries(falsos)) {
    antes[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  }
  try {
    const { criarRenderFalso } = await import('../vitrine/render-falso.js');
    const canvas = { getContext: () => nada, width: 986, height: 443, clientWidth: 986, clientHeight: 443, style: {},
      addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 986, height: 443 }) };
    const sim = criarSimulacao({ semente: 'integracao' });
    const R = await criarRenderFalso(canvas, { sim });
    const pega = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
    assert.deepEqual(Object.keys(API_RENDER).filter((p) => pega(R, p) === undefined), [], 'métodos faltando no render falso');
    assert.deepEqual(Object.keys(API_RENDER).filter((p) => p !== 'stats' && typeof pega(R, p) !== 'function'), [], 'não são funções');
    const s = forma(R.stats);
    const faltam = [...forma(statsVazio()).keys()].filter((k) => !s.has(k) && !k.startsWith('capac.limites'));
    assert.deepEqual(faltam, [], 'R.stats do render falso');
  } finally {
    for (const [k, d] of Object.entries(antes)) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
});

// ferramentas da árvore 3.1: [arquivo, dona]
const FERRAMENTAS = [
  ['montar.mjs', 'F0'], ['testar.mjs', 'F0'], ['simular.mjs', 'F0'], ['bancada.mjs', 'F0'], ['vitrine-ui.mjs', 'F0'],
  ['cidade-sintetica.mjs', 'F0'], ['vitrine/render-falso.js', 'F0'], ['vitrine/sim-falsa.js', 'F0'], ['guarda-texto.mjs', 'F0'],
  ['mapa.mjs', 'S1a'], ['codificar-texturas.mjs', 'R2a'], ['sonda-gpu.mjs', 'R1a'], ['robo/robo-sim.mjs', 'S3a'],
  ['robo-navegador.js', 'C1'], ['aceite-cor.mjs', 'C1'],
];

test('árvore 3.1: as ferramentas existem; um esqueleto diz a dona', () => {
  for (const [f, dona] of FERRAMENTAS) {
    const arq = join(RAIZ, 'ferramentas', f);
    assert.ok(existsSync(arq), `falta ferramentas/${f}`);
    const txt = readFileSync(arq, 'utf8');
    if (/Esqueleto da F0/.test(txt)) assert.match(txt, new RegExp(`dona: ${dona}\\b`), `ferramentas/${f}: esqueleto sem a dona ${dona}`);
  }
});

test("perfil 'pc' (D66, I2): está no contrato e as tabelas dos domínios dão a ele o que dão ao Alta", async () => {
  const { PERFIS: IDS, ORCAMENTO, TETO_ARCOLOGIA, FAMILIAS } = await import('../../fonte/contratos/render.js');
  const { PERFIS, porPerfil, orcamentoDoPerfil } = await import('../../fonte/render/motor/perfis.js');
  assert.deepEqual([...IDS].sort(), Object.keys(PERFIS).sort(), 'os ids do contrato são os perfis do motor');
  assert.equal(orcamentoDoPerfil('pc'), ORCAMENTO.pc);
  assert.equal(PERFIS.pc.orcamento, ORCAMENTO.pc, 'uma fonte só para o orçamento do PC');
  assert.deepEqual(Object.keys(ORCAMENTO.pc.familias).sort(), [...FAMILIAS].sort());
  assert.equal(ORCAMENTO.pc.familias.arcologia.teto, TETO_ARCOLOGIA.aberta);
  for (const id of IDS.filter((i) => i !== 'leve')) assert.ok(TETO_ARCOLOGIA.perto[id] > 0, `teto de perto da Arcologia no ${id}`);
  const tabelas = {
    LADO_CAMPO: (await import('../../fonte/render/ambiente/campoAlturas.js')).LADO_CAMPO,
    PERFIL_PROPS: (await import('../../fonte/render/mundo/props.js')).PERFIL_PROPS,
    PERFIL_TRAFEGO: (await import('../../fonte/render/mundo/trafego.js')).PERFIL_TRAFEGO,
    PERFIL_TERRENO: (await import('../../fonte/render/mundo/terreno.js')).PERFIL_TERRENO,
    PERFIL_VIAS: (await import('../../fonte/render/mundo/vias.js')).PERFIL_VIAS,
    LOD_PREDIOS: (await import('../../fonte/data/estilos.js')).LOD_PREDIOS,
    LADO_DETALHE: (await import('../../fonte/render/materiais/texturas-chao.js')).LADO_DETALHE,
  };
  for (const [nome, T] of Object.entries(tabelas)) assert.deepEqual(porPerfil(T, PERFIS.pc), T.alta, nome);
  // e ninguém mais lê essas tabelas pelo id (o 'pc' cairia no Média)
  const leitura = /\b(LADO_CAMPO|PERFIL_PROPS|PERFIL_TRAFEGO|PERFIL_TERRENO|PERFIL_VIAS|LOD_PREDIOS|LADO_DETALHE)\[[^\]]*perfil/;
  for (const arq of ['ambiente/campoAlturas.js', 'mundo/props.js', 'mundo/trafego.js', 'mundo/terreno.js', 'mundo/vias.js', 'mundo/predios.js', 'materiais/texturas-chao.js']) {
    assert.ok(!leitura.test(readFileSync(join(RAIZ, 'fonte/render', arq), 'utf8')), arq);
  }
});

test('prévia (C1b): o índice das cenas só aponta para cenas, vistas e telas que existem, com os nomes da D88 e D89', async () => {
  const html = readFileSync(join(RAIZ, 'fonte/web/cenas.html'), 'utf8');
  assert.doesNotMatch(html, /Sede v2|sede v2|Torre Lâmina/, 'nomes velhos: a sede v3 é o Park of Future Dreams e a torre, a Blade Tower');
  assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->/g, ''), /[—–]/, 'travessão');
  const { listarCenas } = await import('../../fonte/render/cenas/index.js');
  const { VISTAS_SEDE, etapasDaCena } = await import('../../fonte/render/cenas/planos.js');
  const { VISTAS: VISTAS_BAIRRO } = await import('../../fonte/render/cenas/bairro.js');
  const { VISTAS_RUA } = await import('../../fonte/render/cenas/rua.js');
  const { VISTAS_CAMADAS, CAMADAS_CENA } = await import('../../fonte/render/cenas/camadas.js');
  const { VISTAS_COSTA } = await import('../../fonte/render/cenas/costa.js');
  const vistas = { planos: VISTAS_SEDE, bairro: VISTAS_BAIRRO, rua: VISTAS_RUA, camadas: VISTAS_CAMADAS, costa: VISTAS_COSTA };
  // as telas registradas em qualquer arquivo da interface
  const telas = new Set();
  const dir = join(RAIZ, 'fonte/ui');
  for (const f of readdirSync(dir, { recursive: true })) {
    if (!/\.jsx?$/.test(f)) continue;
    for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/registrarTela\('([^']+)'/g)) telas.add(m[1]);
  }
  const cenas = new Set(listarCenas());
  const links = [...html.matchAll(/href="index\.html(\?[^"]*)?"/g)].map((m) => new URLSearchParams((m[1] ?? '').replace(/&amp;/g, '&')));
  assert.ok(links.length >= 40, `${links.length} links`);
  for (const q of links) {
    const cena = q.get('cena');
    if (cena) assert.ok(cenas.has(cena), `cena ${cena} não existe`);
    const v = q.get('vista');
    if (v && vistas[cena]) assert.ok(Object.hasOwn(vistas[cena], v), `vista ${v} não existe na cena ${cena}`);
    if (q.get('etapas')) assert.ok(etapasDaCena(q.get('etapas')), `etapas ${q.get('etapas')}`);
    // a cena das camadas cai na Zonas com um id que não conhece: o link mostraria outra camada
    if (cena === 'camadas' && q.get('camada')) assert.ok(CAMADAS_CENA.includes(q.get('camada')), `camada ${q.get('camada')} não existe na cena`);
    if (q.get('tela')) assert.ok(telas.has(q.get('tela')), `tela ${q.get('tela')} não registrada`);
    if (q.get('menu')) assert.ok(['0', 'nova', 'continuar'].includes(q.get('menu')), `menu=${q.get('menu')}`);
  }
  // em destaque o que é novo desde a Prévia 1c (C1b, item 4)
  const destaque = html.slice(0, html.indexOf('<div class="anterior">'));
  for (const [rotulo, re] of [
    ['jogo do começo', /menu=nova/],
    ['sede v3 aérea, avenida, mar e noite', /vista=aerea[\s\S]*vista=avenida[\s\S]*vista=mar[\s\S]*vista=noite/],
    ['obra das torres', /etapas=torre\.e\d:[\d.]+&amp;vista=obra/],
    ['Dream Bridge e helicóptero', /vista=ponte[\s\S]*heli=\d+/],
    ['colocáveis', /cena=servicos/],
    ['rua com gente e caminhões', /cena=rua/],
    ['camadas', /cena=camadas/],
    ['Teste de desempenho', /tela=testeDesempenho/],
  ]) assert.match(destaque, re, rotulo);
  // a página de teste com o perfil escolhido (?q= pelo seletor): um link dela sem data-auto
  assert.match(destaque, /<a class="c"(?![^>]*data-auto)[^>]*href="index\.html\?cena=aberta&amp;painel=1"/);
});

test('traçado sugerido (C1b): com a câmera rente ao chão o trecho atrás dela é cortado no plano, sem espelhar', async () => {
  const THREE = await import('three');
  const { projetarNaTela } = await import('../../fonte/render/camera/raio.js');
  const { recortarNaFrente } = await import('../../fonte/ui/guia/regras.js');
  // a 2 m do chão, olhando para -z; a via vai de 200 m na frente a 200 m atrás
  const cam = new THREE.PerspectiveCamera(50, 2, 0.5, 5000);
  cam.position.set(0, 2, 0);
  cam.lookAt(0, 2, -100);
  cam.updateMatrixWorld();
  const projetar = (p) => projetarNaTela(cam, 1000, 500, p);
  const via = [[3, 0, -200], [3, 0, -50], [3, 0, 50], [3, 0, 200]];
  // o ponto de trás projeta espelhado (do outro lado da tela): ligado, cruzaria a tela
  assert.equal(projetar(via[2]).frente, false);
  const [trecho, ...resto] = recortarNaFrente(projetar, via);
  assert.equal(resto.length, 0, 'um trecho só');
  assert.equal(trecho.length, 3, 'os dois pontos da frente e o corte');
  for (const p of trecho) assert.ok(p.frente && p.prof > 0.99, 'nada atrás da câmera');
  // o corte fica no plano de 1 m e à direita do centro, como a via (x = 3), longe de y espelhado
  const c = trecho[2];
  assert.ok(Math.abs(c.prof - 1) < 1e-6 && c.x > 500, JSON.stringify(c));
  // fechado (a quadra): o contorno cortado continua um polígono só, sem os cantos de trás
  const quadra = [[-20, 0, -60], [20, 0, -60], [20, 0, 40], [-20, 0, 40]];
  const [poli] = recortarNaFrente(projetar, quadra, true);
  assert.equal(poli.length, 4);
  for (const p of poli) assert.ok(p.prof > 0.99);
  // tudo atrás: nada a desenhar
  assert.deepEqual(recortarNaFrente(projetar, [[0, 0, 20], [0, 0, 80]]), []);
});

test('escolha livre (D98): o catálogo mostra tudo o que o marco liberou, o trancado diz o marco, e o objetivo só destaca', async () => {
  const { itensDaCategoria } = await import('../../fonte/ui/ferramentas/sessao.js');
  const { categoriaGuiada } = await import('../../fonte/ui/guia/regras.js');
  const { MARCOS } = await import('../../fonte/data/marcos.js');
  const sim = criarSimulacao({ semente: 'ux1-livre' });
  const objetivos = sim.q.barra().objetivos;
  assert.ok(objetivos.length >= 2, 'a partida abre com objetivos de áreas diferentes');
  const consultar = (nome, ...a) => sim.q[nome]?.(...a);
  const itens = (cat) => itensDaCategoria(cat, { consultar, marco: 0 }).itens;
  const todos = [...itens('servicos'), ...itens('lazer'), ...itens('empresas')];
  // tudo o que o marco 0 libera está aberto, qualquer que seja o objetivo da vez
  const liberados = MARCOS[0].libera.filter((id) => /^(servico|holding)\./.test(id)).map((id) => id.split('.')[1]);
  assert.ok(liberados.length >= 6);
  for (const tipo of liberados) {
    const c = todos.find((x) => x.id === tipo);
    assert.ok(c, `${tipo} está no catálogo`);
    assert.equal(c.trancado, false, `${tipo} aberto no marco 0`);
  }
  // o trancado diz o marco que falta: o da tabela dos marcos (e não só o do catálogo)
  for (const [tipo, marco] of [['clinica', 1], ['bombeiros', 2], ['olaria', 1], ['concreteira', 3]]) {
    const c = todos.find((x) => x.id === tipo);
    assert.equal(c.trancado, true, tipo);
    assert.equal(c.marco, marco, `${tipo} abre no marco ${marco}`);
  }
  // os três objetivos abertos não impedem construir o que nenhum deles pede, e continuam abertos
  const abertos = objetivos.map((o) => o.id);
  const areal = sim.q.construir.previa({ tipo: 'areal', x: -942, z: -205 });
  assert.equal(areal.ok, true, areal.codigo);
  assert.equal(sim.cmd('construir', { tipo: 'areal', x: areal.x, z: areal.z, rot: areal.rot }).ok, true);
  // uma rua de terra batida de ligação não é o objetivo da avenida: a praça ao lado dela também sai
  assert.equal(sim.cmd('via.construir', { plano: { modo: 'reta', tipo: 'rua', pontos: [[1100, -300], [1500, -300]], sessao: 1, encaixe: false } }).ok, true);
  const praca = sim.q.construir.previa({ tipo: 'praca', x: 1300, z: -330 });
  assert.equal(praca.ok, true, praca.codigo);
  assert.equal(sim.cmd('construir', { tipo: 'praca', x: praca.x, z: praca.z, rot: praca.rot }).ok, true);
  const depois = sim.q.barra().objetivos.map((o) => o.id);
  for (const id of abertos.filter((x) => x !== 'holding.escritorio')) assert.ok(depois.includes(id), `${id} segue aberto`);
  // o anel do guia só aponta quando nenhuma ferramenta nem bandeja está aberta: com qualquer uma, o jogador escolhe
  const guiados = objetivos.map((o) => ({ ...o, feito: 0, total: o.total || 1 }));
  assert.ok(categoriaGuiada({ objetivos: guiados }), 'o anel destaca a categoria do objetivo');
  assert.equal(categoriaGuiada({ objetivos: guiados, ferramenta: 'colocar' }), null);
  assert.equal(categoriaGuiada({ objetivos: guiados, categoriaAberta: 'empresas' }), null);
  assert.deepEqual(sim.erros, []);
});
