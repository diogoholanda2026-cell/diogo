// Testes de integração da F0 (fechamento, F0-R): as peças falsas da vitrine seguem os mesmos contratos que a
// simulação e o render de verdade, e a árvore 3.1 das ferramentas existe (as das outras parcelas como esqueleto).
// Roda sozinho: node ferramentas/testes/integracao.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
