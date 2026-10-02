// Testes dos prédios colocáveis (R5, D60; A2 "Render em Node"): o modelo de cada tipo de serviço e de prédio da
// Holding em todos os níveis e sementes, no LOD0 (Média e Ultra) e no LOD1: determinismo pela semente, nada de NaN,
// dentro da planta, LOD1 com a mesma caixa do LOD0, triângulos dentro do teto da tabela por perfil; o pedido da
// oficina (malha fundida e quantizada com erro abaixo de 5 mm, faixas por colocável, caixas, árvores para a vegetação);
// o gerador registrado no despachante do worker; a tabela de dados (referência real, pegada igual à planta da
// simulação); a cor da Holding; a seleção pela caixa; e os lugares da cena 'servicos' na cidade sintética.
// Roda sozinho: node ferramentas/testes/geracao-colocaveis.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Construtor, FACHADA } from '../../fonte/render/geracao/malhaPredio.js';
import { deHalf } from '../../fonte/render/geracao/quantizar.js';
import { modelar, gerarColocaveis, pedidoColocaveis, MODELOS, CAIXA_C, NUM_C, INT_C, PASSO_ARV, ESPECIES_ARVORE } from '../../fonte/render/colocaveis/gerador.js';
import { ESPECIE } from '../../fonte/render/geracao/arvores.js';
import { selecionarColocavel, raioNaCaixaDoLote } from '../../fonte/render/colocaveis/index.js';
import { COLOCAVEIS, COLOCAVEIS_ORDEM, DETALHE_COLOCAVEIS, tetoTris, tipoColocavel } from '../../fonte/data/colocaveis.js';
import { SERVICOS, SERVICOS_ORDEM } from '../../fonte/data/servicos.js';
import { PREDIOS_HOLDING, HOLDING_ORDEM } from '../../fonte/data/holding.js';
import { TIPO_PREDIO } from '../../fonte/contratos/flags.js';
import { fnv1aTipado } from '../../fonte/comum/hash.js';

const SEMENTES = [1, 7, 12345, 0x9e3779b9];
/** Folga (m) da caixa do LOD1 contra a do LOD0. */
const FOLGA_CAIXA = 0.02;

/** Desenha um colocável sozinho num construtor (lote na origem, sem giro). */
function desenhar(tipo, op = {}) {
  const K = new Construtor(1024);
  K.predio(0, 0, 0, 0, 9);
  const [w, d] = COLOCAVEIS[tipo].pegada;
  const arvores = [];
  const tris = modelar(K, { tipo, w, d, nivel: 1, semente: 1, lod: 0, detalhe: 'media', arvores, ...op });
  return { K, tris, arvores };
}

function caixaDe(K) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < K.nv; i++) {
    for (let c = 0; c < 3; c++) {
      const v = K.pos[3 * i + c];
      if (v < b[c]) b[c] = v;
      if (v > b[c + 3]) b[c + 3] = v;
    }
  }
  return b;
}

/** Hash da malha e das árvores (para a vegetação) de um desenho. */
const hashDe = ({ K, arvores }) => {
  let h = fnv1aTipado(K.pos, undefined, 3 * K.nv);
  h = fnv1aTipado(K.nor, h, 3 * K.nv);
  h = fnv1aTipado(K.fuv, h, 4 * K.nv);
  h = fnv1aTipado(K.mat, h, 12 * K.nv);
  h = fnv1aTipado(Float32Array.from(arvores), h, arvores.length);
  return fnv1aTipado(K.idx, h, K.ni);
};

test('tabela: um modelo por tipo de serviço e de prédio da Holding, com a referência real e a planta da simulação', () => {
  for (const id of SERVICOS_ORDEM) assert.ok(COLOCAVEIS[id], `serviço sem colocável: ${id}`);
  for (const id of HOLDING_ORDEM) assert.ok(COLOCAVEIS[id], `prédio da Holding sem colocável: ${id}`);
  for (const id of COLOCAVEIS_ORDEM) {
    const c = COLOCAVEIS[id];
    const def = c.familia === 'servico' ? SERVICOS[id] : PREDIOS_HOLDING[id];
    assert.deepEqual(c.pegada, def.planta, `${id}: pegada diferente da planta da simulação`);
    assert.ok(c.referencia.length > 8 && c.modelo.length > 8, `${id}: sem referência ou modelo`);
    for (const t of [c.referencia, c.modelo]) assert.ok(!/[–—]/.test(t), `${id}: travessão no texto`);
    assert.ok(c.tris.media > 0 && c.tris.ultra >= c.tris.media && c.tris.lod1 > 0, `${id}: tetos`);
    assert.ok(typeof MODELOS[id] === 'function', `${id}: sem gerador`);
  }
  // o tipo pelo espelho
  assert.equal(tipoColocavel(TIPO_PREDIO.SERVICO, SERVICOS_ORDEM.indexOf('clinica')), 'clinica');
  assert.equal(tipoColocavel(TIPO_PREDIO.HOLDING, HOLDING_ORDEM.indexOf('olaria')), 'olaria');
  assert.equal(tipoColocavel(TIPO_PREDIO.ZONA, 3), null);
  // o 'pc' herda do Alta (porPerfil): Ultra; Média no celular
  assert.equal(DETALHE_COLOCAVEIS.alta, 'ultra');
  assert.equal(DETALHE_COLOCAVEIS.media, 'media');
});

test('modelos: sem NaN, normais unitárias, dentro da planta e no teto de triângulos de cada perfil', () => {
  for (const tipo of COLOCAVEIS_ORDEM) {
    const [w, d] = COLOCAVEIS[tipo].pegada;
    for (const [detalhe, lod] of [['media', 0], ['ultra', 0], ['media', 1], ['ultra', 1]]) {
      for (const nivel of [1, 2, 3]) {
        for (const semente of SEMENTES) {
          const { K, tris } = desenhar(tipo, { detalhe, lod, nivel, semente });
          const onde = `${tipo} ${detalhe} LOD${lod} nível ${nivel} semente ${semente}`;
          assert.ok(K.nv > 0 && tris > 0, `${onde}: vazio`);
          for (let i = 0; i < K.nv; i++) {
            const n = [K.nor[3 * i], K.nor[3 * i + 1], K.nor[3 * i + 2]];
            assert.ok([...n, K.pos[3 * i], K.pos[3 * i + 1], K.pos[3 * i + 2]].every(Number.isFinite), `${onde}: NaN no vértice ${i}`);
            assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-3, `${onde}: normal de tamanho ${Math.hypot(...n)}`);
          }
          for (let i = 0; i < 4 * K.nv; i++) assert.ok(Number.isFinite(K.fuv[i]), `${onde}: NaN na fachada`);
          for (let i = 0; i < K.ni; i++) assert.ok(K.idx[i] < K.nv, `${onde}: índice fora`);
          const b = caixaDe(K);
          assert.ok(b[0] >= -w / 2 - 0.05 && b[3] <= w / 2 + 0.05 && b[2] >= -d / 2 - 0.05 && b[5] <= d / 2 + 0.05, `${onde}: fora da planta ${b.map((v) => v.toFixed(2))}`);
          const teto = tetoTris(tipo, detalhe, lod);
          assert.ok(tris <= teto, `${onde}: ${tris} triângulos (teto ${teto})`);
        }
      }
    }
  }
});

test('determinismo: a mesma semente dá a mesma malha; outra semente muda a variação', () => {
  let mudaram = 0;
  for (const tipo of COLOCAVEIS_ORDEM) {
    for (const lod of [0, 1]) {
      const a = desenhar(tipo, { semente: 42, lod, detalhe: 'ultra', nivel: 2 });
      const b = desenhar(tipo, { semente: 42, lod, detalhe: 'ultra', nivel: 2 });
      assert.equal(hashDe(a), hashDe(b), `${tipo} LOD${lod}: a mesma semente deu outra malha`);
    }
    const c = desenhar(tipo, { semente: 42 });
    const e = desenhar(tipo, { semente: 43 });
    if (hashDe(c) !== hashDe(e)) mudaram++;
  }
  // a semente muda a variação (árvores, pilhas, jitter das bancadas) na maior parte dos tipos
  assert.ok(mudaram >= COLOCAVEIS_ORDEM.length / 2, `só ${mudaram} tipos variam com a semente`);
});

test('LOD1 com a mesma caixa do LOD0 (2 cm), em todo nível e semente, nos dois detalhes', () => {
  for (const tipo of COLOCAVEIS_ORDEM) {
    for (const detalhe of ['media', 'ultra']) {
      for (const nivel of [1, 2, 3]) {
        for (const semente of SEMENTES) {
          const b0 = caixaDe(desenhar(tipo, { lod: 0, detalhe, nivel, semente }).K);
          const b1 = caixaDe(desenhar(tipo, { lod: 1, detalhe, nivel, semente }).K);
          const dif = Math.max(...b0.map((v, k) => Math.abs(v - b1[k])));
          assert.ok(dif <= FOLGA_CAIXA, `${tipo} ${detalhe} nível ${nivel} semente ${semente}: caixa do LOD1 difere ${dif.toFixed(3)} m (LOD0 ${b0.map((v) => v.toFixed(2))} LOD1 ${b1.map((v) => v.toFixed(2))})`);
          // o LOD1 é bem mais leve que o LOD0
          assert.ok(desenhar(tipo, { lod: 1, detalhe, nivel, semente }).tris < desenhar(tipo, { lod: 0, detalhe, nivel, semente }).tris, `${tipo}: LOD1 não é mais leve`);
        }
      }
    }
  }
});

test('Holding: todo prédio da Holding tem superfície que leva a cor dela (toldo ou letreiro); serviços sem letreiro de marca demais', () => {
  for (const tipo of COLOCAVEIS_ORDEM) {
    const { K } = desenhar(tipo);
    const tipos = new Set();
    for (let i = 0; i < K.nv; i++) tipos.add(K.mat[12 * i]);
    if (COLOCAVEIS[tipo].familia === 'holding') assert.ok(tipos.has(FACHADA.TOLDO) || tipos.has(FACHADA.LETREIRO), `${tipo}: nada na cor da Holding`);
    // nada de cor saturada nem albedo acima de 0,80 (desenho 9.2): o canal mais alto até #e6
    for (let i = 0; i < K.nv; i++) {
      const r = K.mat[12 * i + 4];
      const g = K.mat[12 * i + 5];
      const bl = K.mat[12 * i + 6];
      assert.ok(Math.max(r, g, bl) <= 0xe6, `${tipo}: cor clara demais (${r}, ${g}, ${bl})`);
      // verde-lima proibido: matiz de 68 a 95 graus com saturação acima de 0,55
      const mx = Math.max(r, g, bl);
      const mn = Math.min(r, g, bl);
      if (mx > 0 && (mx - mn) / mx > 0.55) {
        let h = 0;
        if (mx === r) h = (60 * (g - bl)) / (mx - mn);
        else if (mx === g) h = 60 * (2 + (bl - r) / (mx - mn));
        else h = 60 * (4 + (r - g) / (mx - mn));
        h = (h + 360) % 360;
        assert.ok(!(h >= 68 && h <= 95), `${tipo}: verde-lima (${r}, ${g}, ${bl})`);
      }
    }
  }
});

/** Espelho mínimo com n colocáveis em fila (para o pedido da oficina e a seleção). */
function espelhoDeTeste(tipos, { giro = 0.4 } = {}) {
  const n = tipos.length;
  const P = {
    n, viva: new Uint8Array(n).fill(1), ger: new Uint16Array(n), tipo: new Uint8Array(n), modelo: new Uint16Array(n),
    x: new Float64Array(n), z: new Float64Array(n), y: new Float32Array(n), rot: new Float32Array(n), w: new Uint16Array(n),
    d: new Uint16Array(n), nivel: new Uint8Array(n).fill(1), semente: new Uint32Array(n), flags: new Uint32Array(n),
  };
  tipos.forEach((tipo, i) => {
    const c = COLOCAVEIS[tipo];
    P.tipo[i] = c.familia === 'servico' ? TIPO_PREDIO.SERVICO : TIPO_PREDIO.HOLDING;
    P.modelo[i] = c.familia === 'servico' ? SERVICOS_ORDEM.indexOf(tipo) : HOLDING_ORDEM.indexOf(tipo);
    P.x[i] = 40 + (i % 2) * 110;
    P.z[i] = 50 + Math.floor(i / 2) * 110;
    P.y[i] = 6.5;
    P.rot[i] = giro * (i + 1);
    [P.w[i], P.d[i]] = c.pegada;
    P.semente[i] = 1000 + i;
  });
  return { predios: P };
}

test('pedido da oficina: malha fundida quantizada (erro abaixo de 5 mm), faixas contínuas por colocável e caixas', () => {
  const tipos = ['clinica', 'escolaF', 'concreteira', 'praca'];
  const esp = espelhoDeTeste(tipos);
  const P = esp.predios;
  const itens = tipos.map((tipo, i) => ({ i, tipo }));
  for (const lod of [0, 1]) {
    const { dados } = pedidoColocaveis(P, itens, { ox: 0, oz: 0, lod, detalhe: 'ultra' });
    assert.equal(dados.num.length, NUM_C * itens.length);
    assert.equal(dados.ints.length, INT_C * itens.length);
    const r = gerarColocaveis(dados);
    const m = r.malhas[0];
    assert.ok(m && m.material === 'edificio');
    const nv = m.nv;
    assert.equal(m.atributos.posicao.length, 3 * nv);
    // faixas: trechos contínuos que cobrem todos os índices, na ordem
    let soma = 0;
    for (let k = 0; k < itens.length; k++) {
      assert.equal(r.faixas[2 * k], soma, `faixa ${k} fora de ordem`);
      soma += r.faixas[2 * k + 1];
      // o aId de todo vértice do trecho é a vaga do colocável
      const a = r.faixas[2 * k];
      for (let j = a; j < a + r.faixas[2 * k + 1]; j++) assert.equal(m.atributos.id[m.indices[j]], itens[k].i);
    }
    assert.equal(soma, m.indices.length);
    // caixa por colocável no espaço do lote, com a altura do modelo
    for (let k = 0; k < itens.length; k++) {
      const c = r.caixas.subarray(CAIXA_C * k, CAIXA_C * k + CAIXA_C);
      const [w, d] = COLOCAVEIS[itens[k].tipo].pegada;
      assert.ok(c[0] >= -w / 2 - 0.06 && c[2] <= w / 2 + 0.06 && c[1] >= -d / 2 - 0.06 && c[3] <= d / 2 + 0.06, `caixa ${itens[k].tipo}: ${Array.from(c)}`);
      assert.ok(c[5] > 3 && c[6] > 0, `altura e triângulos de ${itens[k].tipo}`);
    }
    // quantização: as posições voltam com erro abaixo de 5 mm (no LOD0 de um setor; o LOD1 vai no mapa inteiro)
    if (lod === 0) {
      const [cx, cy, cz, s] = m.escala;
      const K = new Construtor(1024);
      for (const { i, tipo } of itens) {
        K.predio(P.x[i], P.y[i], P.z[i], P.rot[i], i);
        modelar(K, { tipo, w: P.w[i], d: P.d[i], nivel: 1, semente: P.semente[i], lod, detalhe: 'ultra' });
      }
      assert.equal(K.nv, nv);
      let pior = 0;
      for (let v = 0; v < nv; v++) {
        for (let c = 0; c < 3; c++) {
          const volta = [cx, cy, cz][c] + (m.atributos.posicao[3 * v + c] / 32767) * s;
          pior = Math.max(pior, Math.abs(volta - K.pos[3 * v + c]));
        }
      }
      assert.ok(pior < 0.005, `erro de quantização ${pior.toFixed(4)} m`);
      // a fachada em meia precisão
      for (let v = 0; v < nv; v += 97) assert.ok(Number.isFinite(deHalf(m.atributos.facUV[4 * v + 1])));
    }
  }
});

test('árvores: o LOD1 traz as árvores dos lotes para a vegetação (espécies dela, dentro da planta), nada em obra nem no LOD0', () => {
  for (const e of ESPECIES_ARVORE) assert.ok(e in ESPECIE, `espécie ${e} fora da vegetação`);
  const tipos = ['praca', 'parqueG', 'clinica', 'olaria'];
  const esp = espelhoDeTeste(tipos);
  const P = esp.predios;
  const itens = tipos.map((tipo, i) => ({ i, tipo }));
  const r = gerarColocaveis(pedidoColocaveis(P, itens, { lod: 1, detalhe: 'ultra' }).dados);
  const A = r.arvores;
  assert.ok(A.length >= 8 * PASSO_ARV && A.length % PASSO_ARV === 0, `${A.length / PASSO_ARV} árvores`);
  for (let k = 0; k < A.length; k += PASSO_ARV) {
    const [x, y, z, e, alt, larg] = A.subarray(k, k + PASSO_ARV);
    assert.ok([x, y, z, alt, larg].every(Number.isFinite) && alt > 1 && larg > 0.5, `árvore ${k / PASSO_ARV}`);
    assert.ok(Number.isInteger(e) && ESPECIES_ARVORE[e], `espécie ${e}`);
    // dentro da planta de algum lote (no espaço do lote, desfazendo o giro)
    const dentro = itens.some(({ i }) => {
      const dx = x - P.x[i];
      const dz = z - P.z[i];
      const c = Math.cos(P.rot[i]);
      const s = Math.sin(P.rot[i]);
      return Math.abs(dx * c - dz * s) <= P.w[i] / 2 && Math.abs(dx * s + dz * c) <= P.d[i] / 2 && y >= P.y[i];
    });
    assert.ok(dentro, `árvore fora dos lotes em ${x.toFixed(1)}, ${z.toFixed(1)}`);
  }
  // o mesmo pedido dá as mesmas árvores; em obra (SEM_ARVORES) nenhuma; no LOD0 nenhuma
  assert.deepEqual(gerarColocaveis(pedidoColocaveis(P, itens, { lod: 1, detalhe: 'ultra' }).dados).arvores, A);
  assert.equal(gerarColocaveis(pedidoColocaveis(P, itens, { lod: 1, detalhe: 'ultra', semArvores: () => true }).dados).arvores.length, 0);
  assert.equal(gerarColocaveis(pedidoColocaveis(P, itens, { lod: 0, detalhe: 'ultra' }).dados).arvores.length, 0);
});

test('oficina: o despachante do worker registra o gerador "colocavel" e responde depois de o módulo chegar', async () => {
  const { criarDespachante } = await import('../../fonte/render/mundo/oficina.worker.js');
  const ind = await import('../../fonte/render/colocaveis/index.js');
  const d = criarDespachante();
  assert.ok(d.tipos().includes('colocavel'));
  await ind.carregarGerador();
  const esp = espelhoDeTeste(['poco']);
  const { dados } = pedidoColocaveis(esp.predios, [{ i: 0, tipo: 'poco' }], { lod: 1 });
  const { resposta } = d.responder({ id: 7, tipo: 'colocavel', chave: 3, dados });
  assert.equal(resposta.erro, undefined, resposta.erro);
  assert.equal(resposta.id, 7);
  assert.ok(resposta.malhas[0].indices.length > 0);
});

test('seleção: o raio acerta o colocável pela caixa girada e pela planta antes da malha', () => {
  const esp = espelhoDeTeste(['delegacia', 'bombeiros'], { giro: 0.7 });
  const P = esp.predios;
  // de cima, no centro do segundo
  const raio = { origem: [P.x[1], 300, P.z[1]], dir: [0, -1, 0] };
  const s = selecionarColocavel(raio, esp);
  assert.equal(s?.tipo, 'colocavel');
  assert.equal(s.idx, 1);
  assert.ok(Math.abs(s.ponto[1] - (P.y[1] + COLOCAVEIS.bombeiros.altura)) < 1e-6);
  // pela caixa do modelo (mais baixa)
  const s2 = selecionarColocavel(raio, esp, (i) => (i === 1 ? [-10, -10, 10, 10, 0, 4] : null));
  assert.ok(Math.abs(s2.ponto[1] - (P.y[1] + 4)) < 1e-6);
  // fora da caixa girada: nada
  assert.equal(raioNaCaixaDoLote([P.x[1] + 60, 300, P.z[1]], [0, -1, 0], P.x[1], P.y[1], P.z[1], P.rot[1], [-10, -10, 10, 10, 0, 4]), null);
});

test('cena servicos: os 24 tipos ganham lugar na cidade sintética, de frente para a via, sem água nem sobreposição', async () => {
  const { gerarCidadeSintetica } = await import('../cidade-sintetica.mjs');
  const { escolherLugares, construirNaCena, BAIRROS } = await import('../../fonte/render/cenas/servicos.js');
  const { sim } = gerarCidadeSintetica({});
  const esp = sim.espelho;
  const lugS = escolherLugares(esp, BAIRROS.servicos.tipos.map((tipo) => ({ tipo })), BAIRROS.servicos);
  const lugH = escolherLugares(esp, BAIRROS.holding.tipos.map((tipo) => ({ tipo })), BAIRROS.holding, lugS);
  const todos = [...lugS, ...lugH];
  assert.deepEqual(todos.map((l) => l.tipo).sort(), [...COLOCAVEIS_ORDEM].sort());
  // a captação e a ETE na margem do rio (água até 90 m atrás)
  for (const l of todos.filter((x) => ['captacao', 'ete', 'areal'].includes(x.tipo))) assert.ok(l.custo < 5000, `${l.tipo} longe da água`);
  const feitos = [...construirNaCena(esp, lugS, { mudancas: sim.mudancas }), ...construirNaCena(esp, lugH, { mudancas: sim.mudancas })];
  const P = esp.predios;
  assert.equal(feitos.length, COLOCAVEIS_ORDEM.length);
  for (const f of feitos) {
    assert.equal(tipoColocavel(P.tipo[f.i], P.modelo[f.i]), f.tipo);
    assert.deepEqual([P.w[f.i], P.d[f.i]], COLOCAVEIS[f.tipo].pegada);
  }
  // nenhum prédio da cidade com o centro dentro de uma planta
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA) continue;
    for (const f of feitos) {
      const dx = P.x[i] - f.x;
      const dz = P.z[i] - f.z;
      const c = Math.cos(f.rot);
      const s = Math.sin(f.rot);
      assert.ok(Math.abs(dx * c - dz * s) > f.w / 2 || Math.abs(dx * s + dz * c) > f.d / 2, `prédio ${i} dentro de ${f.tipo}`);
    }
  }
});
