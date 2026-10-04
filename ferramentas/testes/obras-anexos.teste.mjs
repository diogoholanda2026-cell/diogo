// Testes da R4b (obras, anexos e lote): as 5 fases da obra pelo uniforme de tique (a mesma conta no GLSL do vértice e
// no JS, conferida pela tradução do GLSL), as peças de cada obra (esqueleto, grua de torre ou móvel, andaime ou tela,
// tapume e canteiro), os anexos do setor (D39: o bit que esconde a cópia velha, a refusão depois de 5 s sem mudança, o
// anexo grande ou velho, a vaga que muda de setor) e o lote (árvores e carros dentro do lote, fora do prédio).
// Roda sozinho: node ferramentas/testes/obras-anexos.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OBRA_GLSL, alturaPronta, ALTURA_LAJE, DEGRAU_FECHAMENTO } from '../../fonte/render/materiais/shaders/fachada.glsl.js';
import { FASES_OBRA, progressoObra, faseObra } from '../../fonte/contratos/espelho.js';
import { RegistroAnexos, ANEXO } from '../../fonte/render/mundo/anexos.js';
import { planoPredio, ARVORE_LOTE } from '../../fonte/render/geracao/planoPredio.js';
import { gerarSetor, gerarAnexo } from '../../fonte/render/geracao/fundir.js';
import { ID_ANEXO, BITS_TABELA } from '../../fonte/render/geracao/malhaPredio.js';
import { PREDIOS, PREDIOS_ORDEM } from '../../fonte/data/predios.js';

/** O GLSL da obra (OBRA_GLSL) traduzido para JS: a conta que o vértice faz, sem GPU. */
function glslObra(gTique) {
  let js = OBRA_GLSL.replace(/\/\/[^\n]*/g, '')
    .replace(/#define (\w+) ([\d.]+)/g, 'const $1 = $2;')
    .replace(/float (\w+)\( vec4 (\w+) \)/g, 'function $1($2)')
    .replace(/float (\w+)\( float (\w+), float (\w+) \)/g, 'function $1($2, $3)')
    .replace(/\bfloat /g, 'let ')
    .replace(/\bclamp\(/g, 'clampG(')
    .replace(/\b(min|max|floor)\(/g, 'Math.$1(')
    .replace(/(\w+)\.r\b/g, '$1[0]')
    .replace(/(\w+)\.g\b/g, '$1[1]');
  js = `const clampG = (x, a, b) => Math.min(Math.max(x, a), b); const gTique = ${gTique};\n${js}\nreturn { gProgressoObra, gAlturaPronta, gAlturaEsqueleto };`;
  return new Function(js)();
}

test('obra: as 5 fases pelo uniforme de tique (canteiro, fundação, estrutura, fechamento e pronto), GLSL igual ao JS', () => {
  const ini = 1000;
  const fim = 1600;
  const H = 47.3;
  const vistas = new Set();
  let antes = -Infinity;
  for (let T = ini - 60; T <= fim + 60; T += 7) {
    for (const frac of [0, 0.5]) {
      const p = progressoObra(T, frac, ini, fim);
      const g = glslObra(T + frac);
      assert.ok(Math.abs(g.gProgressoObra([ini, fim]) - p) < 1e-9, `progresso no tique ${T}`);
      const y = alturaPronta(p, H);
      assert.ok(Math.abs(g.gAlturaPronta(p, H) - y) < 1e-6, `altura pronta em p ${p}`);
      // a altura só sobe com o tempo (a fachada não desce)
      assert.ok(y >= antes - 1e-9, `a altura desceu em p ${p}`);
      antes = y;
      const f = p >= 1 ? 4 : faseObra(p);
      vistas.add(f);
      if (f === 0) assert.equal(y, -3, 'canteiro: nada acima do chão');
      if (f === 1) assert.ok(y <= ALTURA_LAJE + 1e-9 && y >= -0.6, 'fundação: a laje sobe até 0,3 m');
      if (f === 2) {
        assert.equal(y, ALTURA_LAJE, 'estrutura: a laje');
        const e = g.gAlturaEsqueleto(p, H);
        assert.ok(e > 0 && e <= H, 'estrutura: o esqueleto sobe');
      }
      if (f === 3) {
        assert.ok(y >= ALTURA_LAJE && y <= H, 'fechamento: a fachada até o topo');
        assert.equal(Math.round((y / DEGRAU_FECHAMENTO) * 1e6) % 1e6 === 0 || y === ALTURA_LAJE, true, 'em degraus de 3 m (andar por andar)');
        assert.ok(Math.abs(g.gAlturaEsqueleto(p, H) - H) < 1e-9, 'fechamento: o esqueleto inteiro');
      }
    }
  }
  assert.deepEqual([...vistas].sort(), [0, 1, 2, 3, 4], 'as 5 fases');
  // as fronteiras do contrato (2.4) estão no GLSL
  for (const [k, f] of FASES_OBRA.entries()) assert.ok(OBRA_GLSL.includes(`OBRA_F${k} ${f.ate.toFixed(4)}`), `fronteira ${f.id}`);
  // no fim do fechamento a fachada chega ao topo (o último degrau abaixo de H)
  assert.ok(alturaPronta(1, H) > H - DEGRAU_FECHAMENTO);
});

test('obra: o vértice do edifício corta pela textura de obra e esconde a cópia que não vale (anexo)', async () => {
  const THREE = await import('three');
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const { criarMaterialEdificio } = await import('../../fonte/render/mundo/predios.js');
  const m = criarMaterialEdificio({ ganchos });
  const shader = { uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms), vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader, defines: {} };
  m.onBeforeCompile(shader, null);
  for (const u of ['gPredObra', 'gTique', 'gCorHolding']) assert.ok(u in shader.uniforms, `uniforme ${u}`);
  const vs = shader.vertexShader;
  assert.ok(vs.includes('gAlturaPronta( gProgressoObra( gOb ), gOb.a )'), 'o corte pela altura pronta');
  assert.ok(vs.includes(`aId & ${ID_ANEXO >>> 0}u`) && vs.includes('B_ANEXO'), 'o bit do anexo no aId e na tabela');
  assert.ok(vs.includes('B_APAGADO') || vs.includes('( gBitsT & B_ANEXO )'), 'a cópia que não vale some');
  assert.ok(!/\bmediump\b/.test(vs + shader.fragmentShader));
  // os bits da tabela que o vértice e obras.js leem
  assert.equal(BITS_TABELA.OBRA, 8);
  assert.equal(BITS_TABELA.NIVEL, 32);
  assert.equal(BITS_TABELA.ANEXO, 64);
});

test('obra: peças de cada obra (prédio alto com grua de torre e tela, baixo com grua móvel e andaime, reforma sem esqueleto)', async () => {
  const O = await import('../../fonte/render/mundo/obras.js');
  const base = { idx: 7, x: 100, y: 12, z: -40, rot: 0.4 };
  // alto: predioLargo nível 5 (varanda gourmet, 12 a 25 andares, D76)
  const alto = planoPredio({ w: 40, d: 40, modelo: 'predioLargo', nivel: 5, semente: 11 });
  assert.ok(alto.alturaTopo > O.ALTO);
  const a = O.pecasDaObra({ ...base, w: 40, d: 40, plano: alto, nivel: false });
  assert.equal(a.gruas.length, 1);
  assert.equal(a.gruas[0][4], 0, 'grua de torre');
  assert.ok(a.cascas.every((c) => c[7] === O.CASCA.TELA), 'tela de proteção');
  const pil = a.caixas.filter((c) => c[7] === O.PECA.PILAR);
  const lajes = a.caixas.filter((c) => c[7] === O.PECA.LAJE);
  assert.ok(pil.length >= 4 && lajes.length >= 10, `esqueleto: ${pil.length} pilares e ${lajes.length} lajes`);
  for (const l of lajes) assert.ok(l[1] - base.y <= alto.alturaTopo + 0.01, 'laje dentro da altura');
  assert.equal(a.caixas.filter((c) => c[7] === O.PECA.TAPUME && c[9] === 0).length, 4, 'tapume nos 4 lados');
  assert.ok(a.caixas.some((c) => c[7] === O.PECA.MASSA), 'a massa do prédio para a sombra');
  // baixo: prédio de 3 a 6 andares, grua móvel e andaime
  let baixo = null;
  for (let k = 0; !baixo && k < 120; k++) {
    const pl = planoPredio({ w: 24, d: 32, modelo: ['lojaDupla', 'mercado', 'predioBaixo'][k % 3], nivel: 1 + (k % 4), semente: 5 + k });
    if (pl.alturaTopo > 6 && pl.alturaTopo <= O.ALTO) baixo = pl;
  }
  assert.ok(baixo, 'um prédio baixo de 6 a 14 m');
  const b = O.pecasDaObra({ ...base, w: 24, d: 32, plano: baixo, nivel: false });
  assert.equal(b.gruas.length, 1);
  assert.equal(b.gruas[0][4], 1, 'grua móvel');
  assert.ok(b.cascas.every((c) => c[7] === O.CASCA.ANDAIME), 'andaime');
  // reforma de nível: sem esqueleto nem canteiro, tapume só na frente
  const r = O.pecasDaObra({ ...base, w: 40, d: 40, plano: alto, nivel: true });
  assert.ok(!r.caixas.some((c) => c[7] === O.PECA.PILAR || c[7] === O.PECA.LAJE || c[7] === O.PECA.CONTEINER));
  assert.equal(r.caixas.filter((c) => c[7] === O.PECA.TAPUME && c[9] === 0).length, 1);
  // a visibilidade por fase na CPU (a lista leva só as peças da fase) é a do vértice
  const [f0, f1, f2] = FASES_OBRA.map((f) => f.ate);
  assert.equal(O.VER_CAIXA[O.PECA.PILAR].ver(f1 - 0.01), false);
  assert.equal(O.VER_CAIXA[O.PECA.PILAR].ver(f1 + 0.01), true);
  assert.equal(O.VER_CASCA[O.CASCA.TELA].ver(f2 + 0.01), true);
  assert.equal(O.VER_GRUA[0].ver(f0 + 0.01), true);
  assert.equal(O.VER_GRUA[1].ver(1), false);
  // a máscara das fases decide todas as peças: os blocos prontos de uma obra valem enquanto ela não muda
  const marcos = [0, f0, f1, f2, 1].flatMap((f) => [f - 1e-6, f, f + 1e-6]).filter((p) => p >= 0 && p <= 1);
  for (const p of marcos) {
    for (const q of marcos) {
      if (O.mascaraFase(p) !== O.mascaraFase(q)) continue;
      for (const tab of [O.VER_CAIXA, O.VER_CASCA, O.VER_GRUA]) for (const v of Object.values(tab)) assert.equal(v.ver(p), v.ver(q), `p ${p} e ${q}`);
    }
  }
  // o bloco leva a matriz (giro, escala, posição) e o aObra de cada peça que vale
  const bl = O.blocoDe(a.caixas, (t) => t[7] === O.PECA.TAPUME, 7);
  const tap = a.caixas.filter((t) => t[7] === O.PECA.TAPUME);
  assert.equal(bl.n, tap.length);
  assert.ok(Math.abs(bl.m[12] - tap[0][0]) < 1e-3 && Math.abs(bl.m[5] - tap[0][5]) < 1e-6 && bl.m[15] === 1);
  assert.deepEqual(Array.from(bl.o.subarray(0, 2)), [7, O.PECA.TAPUME]);
  const blg = O.blocoDe(a.gruas, () => true, 7, true);
  assert.equal(blg.o[1], 0, 'modelo da grua de torre no aObra.y');
  assert.ok(Math.abs(blg.o[3] - a.gruas[0][6]) < 1e-4, 'lança no aObra.w');
  // as geometrias unitárias
  assert.equal(O.geometriaCaixa().tris, 12);
  assert.equal(O.geometriaCasca().tris, 8);
  assert.ok(O.geometriaGrua().tris < 260);
});

test('obra: os shaders das obras montam sobre o three, com e sem a sombra, sem mediump', async () => {
  const THREE = await import('three');
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const O = await import('../../fonte/render/mundo/obras.js');
  const S = await import('../../fonte/render/materiais/shaders/obra.glsl.js');
  for (const v of ['caixas', 'cascas', 'gruas']) {
    const m = O.criarMaterialObra(ganchos, v, S);
    const s = { uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms), vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader, defines: {} };
    m.onBeforeCompile(s, null);
    assert.ok(s.vertexShader.includes('gDadosObra(') && s.uniforms.gTique && s.uniforms.gPredObra, v);
    assert.ok(!/\bmediump\b/.test(s.vertexShader + s.fragmentShader), v);
  }
  for (const v of ['caixas', 'gruas']) {
    const m = O.criarMaterialSombraObra(v, S);
    const s = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
    m.onBeforeCompile(s, null);
    assert.ok(s.vertexShader.includes('#define OBRA_SOMBRA'), v);
  }
});

// ------------------------------------------------------------------------------------------------ anexos (D39)

test('anexo: o prédio que muda vai para o anexo e o setor é refundido depois de 5 s sem mudança', () => {
  const reg = new RegistroAnexos();
  reg.crescer(64);
  const s = 3;
  const sig = new Map([[1, 11], [2, 22], [3, 33]]);
  reg.pedirBase(s, [1, 2, 3], [11, 22, 33]);
  reg.baseChegou(s, [1, 2, 3], [11, 22, 33]);
  for (const i of [1, 2, 3]) assert.deepEqual(reg.bits(i, s, sig.get(i)), { anexo: false, apagado: false });
  assert.deepEqual(reg.devidos(0), [], 'nada mudou');
  // o prédio 2 sobe de nível no instante 1000: a base ainda mostra a versão velha até o anexo chegar
  sig.set(2, 23);
  reg.mudou(s, s, 1000);
  assert.deepEqual(reg.desejado(s, [1, 2, 3], (i) => sig.get(i)), [2]);
  assert.equal(reg.bits(2, s, 23).anexo, false, 'sem anexo montado, a base segue à vista (sem buraco)');
  reg.pedirAnexo(s, [2], [23]);
  reg.anexoChegou(s, [2], [23]);
  assert.equal(reg.bits(2, s, 23).anexo, true, 'com o anexo, a cópia da base some');
  assert.equal(reg.bits(1, s, 11).anexo, false);
  // 5 s sem mudança: refunde; uma mudança nova no meio adia
  assert.deepEqual(reg.devidos(1000 + ANEXO.refusaoMs - 1), []);
  reg.mudou(s, s, 3000);
  assert.deepEqual(reg.devidos(1000 + ANEXO.refusaoMs), [], 'a mudança em 3 s adiou');
  assert.deepEqual(reg.devidos(3000 + ANEXO.refusaoMs), [s], '5 s depois da última');
  // a refusão junta as mudanças: a base nova tem a versão atual e o anexo deixa de valer
  reg.pedirBase(s, [1, 2, 3], [11, 23, 33]);
  assert.deepEqual(reg.devidos(1e6), [], 'base no ar: não pede de novo');
  reg.baseChegou(s, [1, 2, 3], [11, 23, 33]);
  assert.equal(reg.bits(2, s, 23).anexo, false);
  assert.deepEqual(reg.desejado(s, [1, 2, 3], (i) => sig.get(i)), []);
  assert.deepEqual(reg.devidos(1e6), []);
});

test('anexo: anexo grande ou velho refunde antes; o morto some até sair da base; a vaga que muda de setor espera', () => {
  const reg = new RegistroAnexos();
  reg.crescer(256);
  const membros = Array.from({ length: 40 }, (_, k) => k);
  reg.baseChegou(1, membros, membros.map((i) => i + 100));
  // crescimento contínuo (uma mudança por segundo): o anexo com mais de 30 s refunde mesmo sem 5 s de calma
  for (let t = 0; t <= 31000; t += 1000) {
    reg.mudou(1, 1, t);
    if (t < ANEXO.maxIdadeMs) assert.deepEqual(reg.devidos(t), [], `${t} ms`);
  }
  assert.deepEqual(reg.devidos(31000), [1], 'a diferença mais velha que 30 s');
  // anexo com prédios demais refunde na hora
  const r2 = new RegistroAnexos();
  r2.crescer(256);
  r2.mudou(2, 2, 0);
  assert.deepEqual(r2.devidos(10, () => ANEXO.maxPredios), [2]);
  // o morto: apagado enquanto a base tem a cópia velha
  const r3 = new RegistroAnexos();
  r3.crescer(16);
  r3.baseChegou(1, [5, 6], [50, 60]);
  r3.mudou(1, -1, 0);
  assert.deepEqual(r3.bits(6, -1, 0), { anexo: false, apagado: true });
  r3.pedirBase(1, [5], [50]);
  r3.baseChegou(1, [5], [50]);
  assert.deepEqual(r3.bits(6, -1, 0), { anexo: false, apagado: false }, 'saiu da base');
  // a vaga 5 vai para o setor 2 (reaproveitada): a base de 2 não a leva enquanto a de 1 tem a cópia velha
  assert.deepEqual(r3.listaDaBase(2, [5, 7]), [7]);
  const { liberados } = (() => {
    r3.pedirAnexo(2, [5], [51]);
    r3.anexoChegou(2, [5], [51]);
    return r3.baseChegou(1, [], []);
  })();
  assert.deepEqual(liberados, [2], 'a base de 1 saiu: o setor 2 pode absorver a vaga');
  assert.deepEqual(r3.listaDaBase(2, [5, 7]), [5, 7]);
  // a vaga morta reaproveitada por um colocável (fora dos setores): a base com a cópia velha refunde já, sem os 5 s
  const r4 = new RegistroAnexos();
  r4.crescer(16);
  r4.baseChegou(3, [8, 9], [80, 90]);
  r4.mudou(3, -1, 1000);
  assert.deepEqual(r4.devidos(1001), [], 'morto comum: espera os 5 s');
  r4.urgente(9, 1001);
  assert.deepEqual(r4.devidos(1002), [3], 'vaga viva fora dos setores: refunde já');
  r4.pedirBase(3, [8], [80]);
  r4.baseChegou(3, [8], [80]);
  assert.deepEqual(r4.bits(9, -1, 0), { anexo: false, apagado: false }, 'o colocável aparece');
  assert.deepEqual(r4.devidos(1e6), []);
});

test('anexo: o gerador marca o aId das malhas e das instâncias do anexo', () => {
  const lista = [0, 1];
  const num = new Float32Array([10, 2, 10, 0, 16, 24, 40, 2, 10, 0, 16, 24]);
  const ints = new Uint32Array([7, 123, PREDIOS_ORDEM.indexOf('casa'), 1, 9, 456, PREDIOS_ORDEM.indexOf('loja'), 1]);
  const dados = () => ({ setor: 0, ox: 0, oz: 0, lod0: true, n: lista.length, num: num.slice(), ints: ints.slice() });
  const s = gerarSetor(dados());
  const a = gerarAnexo(dados());
  assert.ok(s.malhas[0].atributos.id.every((v) => v < ID_ANEXO));
  assert.ok(a.malhas[0].atributos.id.every((v) => v >= ID_ANEXO && [7, 9].includes(v - ID_ANEXO)));
  assert.ok(a.lod1.every((g) => Array.from(g.ids).every((v) => v & ID_ANEXO)));
  assert.equal(a.anexo, true);
  // o lote vai junto no LOD0 (com o idx puro)
  assert.ok(s.lote && Array.isArray(s.lote.carros) && s.lote.carros.length === 4);
});

// ------------------------------------------------------------------------------------------------ lote

test('lote: árvores e carros dentro do lote, fora do prédio, sem carro no abandonado, determinístico', () => {
  let arv = 0;
  let car = 0;
  for (const id of PREDIOS_ORDEM) {
    const m = PREDIOS[id];
    const w = m.planta[0] * 8;
    const d = m.planta[1] * 8;
    for (let nivel = 1; nivel <= 5; nivel++) {
      for (let k = 0; k < 6; k++) {
        const e = { w, d, modelo: id, nivel, semente: 1000 + k * 7919, estilo: k % 4 };
        const pl = planoPredio(e);
        const b = pl.caixa;
        for (const [x, z, esp, esc] of pl.lote.arvores) {
          assert.ok(Math.abs(x) <= w / 2 && Math.abs(z) <= d / 2, `${id} ${nivel}: árvore fora do lote`);
          assert.ok([ARVORE_LOTE.COPA, ARVORE_LOTE.PALMEIRA].includes(esp) && esc > 0.4 && esc < 1.2);
          arv++;
        }
        for (const [x, z] of pl.lote.carros) {
          assert.ok(Math.abs(x) <= w / 2 && Math.abs(z) <= d / 2 + 0.01, `${id} ${nivel}: carro fora do lote`);
          car++;
        }
        assert.deepEqual(planoPredio(e).lote, pl.lote, 'determinismo');
        assert.equal(planoPredio({ ...e, abandonado: true }).lote.carros.length, 0, 'abandonado sem carro');
        void b;
      }
    }
  }
  assert.ok(arv > 200 && car > 80, `${arv} árvores e ${car} carros`);
});

test('lote (VIS1b): as árvores do lote vão para a vegetação da R2b, com espécies variadas e o tamanho do plano', async () => {
  const L = await import('../../fonte/render/mundo/lotes.js');
  const { PASSO_ARVORE, plantaveis } = await import('../../fonte/render/mundo/vegetacao.js');
  const { ESPECIE, ESPECIES } = await import('../../fonte/render/geracao/arvores.js');
  // o setor de verdade: casas e prédios do plano em fila (o gerador veste o lote com copa e palmeira)
  const ids = ['casa', 'sobrado', 'predio', 'loja'].filter((id) => PREDIOS_ORDEM.includes(id));
  const n = 24;
  const num = new Float32Array(n * 6);
  const ints = new Uint32Array(n * 4);
  for (let i = 0; i < n; i++) {
    num.set([(i % 6) * 40, 2, Math.floor(i / 6) * 50, 0, 16, 28], 6 * i);
    ints.set([i, 1000 + i * 7919, PREDIOS_ORDEM.indexOf(ids[i % ids.length]), 1 + (i % 4)], 4 * i);
  }
  const s = gerarSetor({ setor: 0, ox: 0, oz: 0, lod0: true, n, num, ints });
  const grupos = [{ tipo: 'copa', ...s.lote.copa }, { tipo: 'palmeira', ...s.lote.palmeira }];
  const lista = L.arvoresDosLotes(grupos);
  const total = s.lote.copa.n + s.lote.palmeira.n;
  assert.ok(total > 10, `${total} árvores no setor`);
  assert.equal(lista.length, total * PASSO_ARVORE);
  // todas plantáveis (espécie da tabela, tamanho finito), na base do plano, com a altura da escala dele
  assert.equal(plantaveis(lista), lista, 'a vegetação recusaria alguma');
  const esp = new Set();
  for (let k = 0; k < total; k++) {
    const o = k * PASSO_ARVORE;
    const g = k < s.lote.copa.n ? s.lote.copa : s.lote.palmeira;
    const j = k < s.lote.copa.n ? k : k - s.lote.copa.n;
    assert.deepEqual([lista[o], lista[o + 1], lista[o + 2]], [g.mat[16 * j + 12], g.mat[16 * j + 13], g.mat[16 * j + 14]]);
    const e = lista[o + 3];
    esp.add(e);
    if (k >= s.lote.copa.n) assert.equal(e, ESPECIE.palmeira);
    else assert.ok([ESPECIE.oiti, ESPECIE.mata2, ESPECIE.mata3, ESPECIE.embauba].includes(e), `copa do lote com a espécie ${e}`);
    // quintal baixo (4 a 10 m), palmeira de jardim (10 a 20 m); a largura na proporção da espécie
    const alt = lista[o + 4];
    assert.ok(e === ESPECIE.palmeira ? alt > 10 && alt < 20 : alt > 4 && alt < 10, `altura ${alt.toFixed(1)}`);
    assert.ok(Math.abs(lista[o + 5] / alt - ESPECIES[e].largura / ESPECIES[e].altura) < 1e-5);
  }
  assert.ok(esp.size >= 3, `só ${esp.size} espécies no lote`);
  // a escolha da copa cobre as quatro espécies pelo hash do item, nos pesos de COPAS_LOTE
  const conta = new Map();
  for (let b = 0; b < 256; b++) {
    const e = L.copaDoLote(b).especie;
    conta.set(e, (conta.get(e) ?? 0) + 1);
  }
  for (const c of L.COPAS_LOTE) assert.ok(Math.abs(conta.get(ESPECIE[c.especie]) / 256 - c.peso) < 0.02, c.especie);
  // o domínio planta pelo dono 'lotes' (sem malha de árvore na cena) e solta no descarte
  const THREE = await import('three');
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const plantios = [];
  const ctx = {
    cena: new THREE.Scene(), ganchos, perfil: { id: 'pc' }, medidas: { familia: (m) => m },
    sombra: { projetor() {}, soltar() {}, marcar() {} },
    vegetacao: { plantar: (dono, itens) => plantios.push([dono, itens]) },
  };
  let dom = null;
  L.registrar({ registrarDominio: (nome, f) => (dom = f(ctx)) });
  const pred = { lotesVisiveis: () => [{ s: 0, chave: 1, lotes: [s.lote] }] };
  dom.quadro(0, { ...ctx, dominio: (nome) => (nome === 'predios' ? pred : null), sol: { dia: 1 } });
  assert.equal(plantios.length, 1);
  assert.equal(plantios[0][0], 'lotes');
  assert.deepEqual(Array.from(plantios[0][1]), Array.from(lista));
  assert.equal(dom.medidas().arvores.n, total);
  assert.ok(ctx.cena.children.every((o) => o.name.startsWith('lotes:carro')), 'malha de árvore no domínio dos lotes');
  dom.quadro(16, { ...ctx, dominio: (nome) => (nome === 'predios' ? pred : null), sol: { dia: 1 } });
  assert.equal(plantios.length, 1, 'replantou sem mudança nos lotes');
  dom.descartar();
  assert.deepEqual(plantios.at(-1), ['lotes', null]);
});

/** O domínio 'predios' sobre a cidade sintética, com o relógio na mão (performance.now) e a câmera em cima de i. */
async function montarDominio() {
  const THREE = await import('three');
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const { registrar } = await import('../../fonte/render/mundo/predios.js');
  const { oficinaDe } = await import('../../fonte/render/mundo/oficina.js');
  const { PERFIS } = await import('../../fonte/render/motor/perfis.js');
  const { criarSimulacao } = await import('../../fonte/sim/estado.js');
  const { gerarCidadeSintetica, SINTETICA } = await import('../cidade-sintetica.mjs');
  const { PonteRender } = await import('../../fonte/render/ponte.js');
  const sim = criarSimulacao({ semente: SINTETICA.semente, dominios: false });
  gerarCidadeSintetica({ sim, predios: 500 });
  const P = sim.espelho.predios;
  // um prédio vivo da cidade e a câmera em cima dele (o setor fica no LOD0)
  let i = -1;
  for (let k = 0; k < P.n && i < 0; k++) if (P.viva[k] && P.tipo[k] === 0 && P.nivel[k] < 4 && !(P.flags[k] & 1)) i = k;
  assert.ok(i >= 0);
  const camera = new THREE.PerspectiveCamera(40, 1376 / 768, 0.5, 20000);
  camera.position.set(P.x[i] + 120, 160, P.z[i] + 120);
  camera.lookAt(P.x[i], 0, P.z[i]);
  const relogio = { agora: 0 };
  const nowOrig = performance.now;
  performance.now = () => relogio.agora;
  let fabrica = null;
  registrar({ registrarDominio: (n, f) => (fabrica = f), registrarSelecionavel() {} });
  const ctx = {
    cena: new THREE.Scene(), ganchos, perfil: PERFIS.pc, semClip: false, stats: { instancias: {}, setores: {} },
    medidas: { familia: (m) => m }, textura: () => null, ouvir: () => () => {}, renderer: null, THREE,
    sim: { espelho: sim.espelho, mudancas: sim.mudancas },
    sombra: { projetor: (m) => m, soltar() {}, marcar() {}, regiao: null }, camera,
    cameraApi: { estado: () => ({ dist: 220 }), alvo: (v) => v.set(P.x[i], 0, P.z[i]), atualizar() {} },
    sol: { dir: new THREE.Vector3(0.4, 0.8, 0.3).normalize(), dia: 1 }, horaDoCeu: () => 10, dominio: () => null, criarWorker: () => null,
  };
  const dom = fabrica(ctx);
  const ponte = new PonteRender(ctx.sim);
  const oficina = oficinaDe(ctx);
  const quadro = async (n = 1) => {
    for (let k = 0; k < n; k++) {
      ponte.quadro([dom], ctx);
      dom.quadro(relogio.agora, ctx);
      oficina.rodarLocal(16);
      await new Promise((ok) => setTimeout(ok, 0));
      relogio.agora += 16;
    }
  };
  const fim = () => {
    dom.descartar();
    performance.now = nowOrig;
  };
  return { THREE, sim, P, i, ctx, dom, quadro, relogio, fim };
}

test('anexo no domínio: o prédio que sobe de nível vai para o anexo, o setor refunde 5 s depois e a fila esvazia', async () => {
  const { sim, P, i, ctx, dom, quadro, relogio, fim } = await montarDominio();
  try {
    await quadro(40);
    assert.ok(dom.pronto(), 'a vista carregou');
    const s = dom.setorDe(i);
    const reg = dom.registro;
    assert.ok(reg.naBase(i, s, reg.baseSig[i]), 'o prédio está na base do setor');
    const tab = dom.tabela.image.data;
    assert.equal(tab[4 * i + 1] & BITS_TABELA.ANEXO, 0);
    // sobe de nível (reforma): a assinatura muda, o anexo é pedido, chega e o bit passa para ele
    P.nivel[i]++;
    P.flags[i] |= 1 | 256;
    P.obraIni[i] = 0;
    P.obraFim[i] = 100;
    sim.mudancas.marcarIdx('predios', i);
    await quadro(6);
    assert.ok(dom.medidas().anexos >= 1, 'um anexo montado');
    assert.ok(tab[4 * i + 1] & BITS_TABELA.ANEXO, 'a cópia da base some, a do anexo vale');
    assert.ok(tab[4 * i + 1] & BITS_TABELA.NIVEL, 'reforma de nível');
    // sobe de novo antes da refusão: o mesmo anexo (a mesma lista) é trocado pela versão nova
    const sig1 = reg.setores.get(s).anexo.sigs[0];
    P.nivel[i]++;
    sim.mudancas.marcarIdx('predios', i);
    await quadro(6);
    assert.notEqual(reg.setores.get(s).anexo.sigs[0], sig1, 'o anexo traz a versão nova');
    assert.equal(dom.medidas().anexos, 1);
    // 4 s depois: ainda no anexo; 5 s sem mudança: a base é refundida, o bit volta e o anexo sai
    relogio.agora += 4000;
    await quadro(3);
    assert.ok(tab[4 * i + 1] & BITS_TABELA.ANEXO, 'antes de 5 s o setor não refunde');
    relogio.agora += 1200;
    await quadro(8);
    assert.equal(tab[4 * i + 1] & BITS_TABELA.ANEXO, 0, 'refundido: o prédio voltou à base');
    assert.equal(dom.medidas().anexos, 0, 'o anexo saiu');
    assert.equal(ctx.stats.setores.pendentes, 0, 'a fila esvaziou');
  } finally {
    fim();
  }
});

test('obra no domínio: a textura de obra leva início, fim, cota e altura; a altura de fora (R5) morre com a vaga', async () => {
  const { sim, P, i, dom, quadro, fim } = await montarDominio();
  try {
    await quadro(4);
    const ob = dom.obra.image.data;
    // nasce em obra: o corte vem do plano do prédio
    P.flags[i] |= 1;
    P.obraIni[i] = 10;
    P.obraFim[i] = 610;
    sim.mudancas.marcarIdx('predios', i);
    await quadro(1);
    const H = dom.planoObra(i).alturaTopo;
    assert.deepEqual(Array.from(ob.subarray(4 * i, 4 * i + 4)), [10, 610, Math.fround(P.y[i]), Math.fround(H)]);
    assert.ok(dom.tabela.image.data[4 * i + 1] & BITS_TABELA.OBRA);
    // a altura de fora (um colocável da R5 na mesma vaga) manda enquanto a vaga vive
    dom.alturaObra(i, 99);
    assert.equal(ob[4 * i + 3], 99);
    // a vaga morre e volta como prédio da cidade em obra: o corte é o do plano, não o de fora
    P.viva[i] = 0;
    sim.mudancas.marcarIdx('predios', i);
    await quadro(1);
    assert.equal(ob[4 * i + 3], 0, 'morta: sem corte');
    P.viva[i] = 1;
    sim.mudancas.marcarIdx('predios', i);
    await quadro(1);
    assert.equal(ob[4 * i + 3], Math.fround(H), 'a altura de fora não volta com a vaga');
    // fim da obra: a altura zera (sem corte) e o bit sai
    P.flags[i] &= ~1;
    sim.mudancas.marcarIdx('predios', i);
    await quadro(1);
    assert.equal(ob[4 * i + 3], 0);
    assert.equal(dom.tabela.image.data[4 * i + 1] & BITS_TABELA.OBRA, 0);
  } finally {
    fim();
  }
});

test('obra: cada casca fica na faixa do seu volume (a tela do pódio não sobe em volta da torre)', async () => {
  const O = await import('../../fonte/render/mundo/obras.js');
  const S = await import('../../fonte/render/materiais/shaders/obra.glsl.js');
  // torre sobre pódio (D76): a instância de cada casca vai da base ao topo do volume dela
  const plano = planoPredio({ w: 40, d: 40, modelo: 'predioLargo', nivel: 5, semente: 11 });
  const vols = O.volumesDoPlano(plano);
  const r = O.pecasDaObra({ idx: 3, x: 0, y: 5, z: 0, rot: 0, w: 40, d: 40, plano, nivel: false });
  assert.equal(r.cascas.length, vols.length);
  r.cascas.forEach((c, k) => {
    const v = vols[k];
    const y0 = Math.max(0, v.y0);
    assert.ok(Math.abs(c[1] - (5 + y0)) < 1e-6, 'base do volume');
    assert.ok(Math.abs(c[5] - Math.max(0.5, v.y0 + v.h - y0)) < 1e-6, 'altura do volume');
  });
  // o vértice prende a casca na faixa da instância
  const vs = S.GLSL_OBRA.cascas.vertice;
  assert.ok(vs.includes('gA = max( gA, gIb - 0.2 )') && vs.includes('gZ = min( gZ, gIb + gHh + 1.2 )'));
});
