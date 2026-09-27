// Testes da casca da F0 (app, render e interface), sem navegador: unidades da D42, textos e códigos, ações com
// Promise e id, consultas, ponte da interface, glifos, perfis (D33), despachante da oficina (D45), ponte do render
// (troca de simulação), registro da seleção, ganchos GLSL (D44), registro de cenas, sol e raio da depuração, canteiro
// de prova e os índices fixos (todo módulo de render e de interface ligado a um índice). Roda sozinho:
// node ferramentas/testes/casca.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fonte = (p) => join(RAIZ, 'fonte', p);

// ------------------------------------------------------------------------------------------------ interface

test('formato: unidades da D42 (pt-BR, /h com sinal, calendário, fase, min de jogo, mm:ss)', async () => {
  const f = await import('../../fonte/ui/formato.js');
  assert.equal(f.numero(12480), '12.480');
  assert.equal(f.numero(-3.5, 1), '\u22123,5');
  assert.equal(f.creditosBarra(9999999), '9.999.999');
  assert.equal(f.creditosBarra(128400000), '128,4 mi');
  assert.equal(f.porHora(3840), '+3.840/h');
  assert.equal(f.porHora(-12300), '\u221212.300/h');
  assert.equal(f.porHora(0), '0/h');
  assert.equal(f.dataCalendario({ mes: 3, ano: 2 }), 'Mês 3 · Ano 2');
  assert.equal(f.fase('fimDeTarde'), 'Fim de tarde');
  assert.equal(f.glifoDaFase('noite'), 'lua');
  assert.equal(f.minutosDeJogo(300), '5 min de jogo');
  assert.equal(f.contagem(120, 2), '01:00');
  assert.equal(f.contagem(120, 0), '02:00', 'pausado conta em 1x');
  assert.equal(f.contagem(7322, 1), '2:02:02');
  assert.equal(f.duracaoReal(126), '2 min 6 s');
  assert.equal(f.pct(0.72), '72%');
  for (const s of [f.porHora(1), f.minutosDeJogo(60), f.dicaHora(), f.duracaoReal(90000)]) assert.doesNotMatch(s, /(?<![\p{L}])dias?(?![\p{L}])/iu);
});

test('textos: todo código de recusa tem frase; nada proibido; parâmetros; chave faltando', async () => {
  const { t, temTexto, chaves, chavesRepetidas } = await import('../../fonte/ui/textos.js');
  const { LISTA_CODIGOS } = await import('../../fonte/contratos/codigos.js');
  const { verificarConteudo } = await import('../guarda-texto.mjs');
  for (const c of LISTA_CODIGOS) assert.ok(temTexto(`codigo.${c}`), `código sem frase: ${c}`);
  assert.deepEqual(chavesRepetidas(), []);
  for (const k of chaves()) {
    const falhas = verificarConteudo(t(k), ['travessao', 'aluguel', 'porDia', 'dia'], { js: false });
    assert.deepEqual(falhas, [], `texto proibido em ${k}: ${t(k)}`);
  }
  assert.equal(t('data.mesAno', { mes: 7, ano: 3 }), 'Mês 7 · Ano 3');
  assert.equal(t('nao.existe'), '??nao.existe');
});

function simDeMentira() {
  const ouvintes = new Map();
  const estado = { v: 0 };
  return {
    estado,
    q: {
      barra: () => ({ creditos: 10, velocidade: estado.v }),
      via: { previa: (a) => ({ eco: a }) },
      quebra: () => {
        throw new Error('de propósito');
      },
    },
    cmd(nome, args) {
      if (nome === 'velocidade') {
        if (![0, 1, 2, 3].includes(args.v)) return { ok: false, codigo: 'valor' };
        estado.v = args.v;
        for (const fn of ouvintes.get('*') ?? []) fn({ v: args.v }, 'velocidade');
        return { ok: true };
      }
      return { ok: false, codigo: 'comando' };
    },
    on(nome, fn) {
      ouvintes.set(nome, [...(ouvintes.get(nome) ?? []), fn]);
      return () => {};
    },
  };
}

test('ações: Promise sempre, id (sessao, seq) crescente, recusa vira frase e aviso', async () => {
  const acoes = await import('../../fonte/ui/acoes.js');
  const loja = await import('../../fonte/ui/loja.js');
  const sim = simDeMentira();
  let depois = 0;
  acoes.ligarAcoes({ obterSim: () => sim, aoComando: () => depois++ });
  const p = acoes.velocidade(3);
  assert.ok(p instanceof Promise);
  const r = await p;
  assert.equal(r.ok, true);
  assert.equal(sim.estado.v, 3, 'o comando aplica na hora (D17)');
  assert.equal(typeof r.id.sessao, 'string');
  const r2 = await acoes.comando('velocidade', { v: 9 });
  assert.equal(r2.ok, false);
  assert.equal(r2.codigo, 'valor');
  assert.equal(r2.id.seq, r.id.seq + 1);
  assert.equal(acoes.frase(r2), 'Valor fora do permitido.');
  assert.equal(loja.avisos.value.at(-1).codigo, 'valor');
  assert.equal(depois, 2);
  acoes.ligarAcoes({ obterSim: () => null });
  assert.equal((await acoes.comando('velocidade', { v: 1 }, { silencioso: true })).codigo, 'erro');
});

test('consultas: nomes com ponto, ausente e erro dão null', async () => {
  const { ligarConsultas, consultar, consultas } = await import('../../fonte/ui/consultas.js');
  const sim = simDeMentira();
  ligarConsultas(() => sim);
  assert.deepEqual(consultar('via.previa', 1), { eco: 1 });
  assert.deepEqual(consultas.via.previa(2), { eco: 2 });
  assert.equal(consultar('predio', 5), null);
  assert.equal(consultar('quebra'), null);
  assert.equal(typeof consultas.emprestimo, 'function');
});

test('ponte da interface: lê a barra, e de novo depois de um comando; troca de simulação', async () => {
  const { criarPonte } = await import('../../fonte/ui/ponte.js');
  const loja = await import('../../fonte/ui/loja.js');
  const { ligarConsultas } = await import('../../fonte/ui/consultas.js');
  const { criarSimulacao } = await import('../../fonte/sim/estado.js');
  let sim = criarSimulacao({ semente: 'ponte-ui' });
  ligarConsultas(() => sim);
  const ponte = criarPonte({ obterSim: () => sim });
  ponte.quadro(0);
  assert.equal(loja.barra.value.velocidade, 0);
  assert.equal(loja.barra.value.data.mes, 1);
  sim.cmd('velocidade', { v: 2 });
  ponte.quadro(10); // o evento marcou: relê antes dos 250 ms
  assert.equal(loja.barra.value.velocidade, 2);
  sim = criarSimulacao({ semente: 'ponte-ui-2' });
  ponte.quadro(20);
  assert.equal(loja.barra.value.velocidade, 0, 'a simulação nova começa pausada (D10)');
});

test('glifos: os da barra existem e são só caminhos SVG', async () => {
  const { glifo, nomesGlifos } = await import('../../fonte/ui/glifos/glifos.js');
  for (const n of ['holding', 'creditos', 'populacao', 'pausa', 'vel1', 'vel2', 'vel3', 'sol', 'solBaixo', 'lua', 'alerta']) {
    const g = glifo(n);
    assert.ok(g && g.tracos.length, `glifo ${n}`);
    for (const d of [...g.tracos, ...g.cheios]) assert.match(d, /^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-]+$/, `${n}: ${d}`);
  }
  // a barra e o formato só pedem glifos registrados
  const usados = [...readFileSync(fonte('ui/hud/BarraCima.jsx'), 'utf8').matchAll(/n="(\w+)"/g)].map((m) => m[1]);
  for (const n of usados) assert.ok(nomesGlifos().includes(n), `BarraCima usa ${n}`);
});

test('prefs: sem localStorage vale o padrão', async () => {
  const { lerPrefs, PREFS_PADRAO } = await import('../../fonte/ui/prefs.js');
  assert.deepEqual(lerPrefs(), { ...PREFS_PADRAO });
});

// ------------------------------------------------------------------------------------------------ render

test('perfis: a regra do Poco X7 (D33) e a escolha automática', async () => {
  const { sugerirPerfil, PERFIS, razaoDePixels } = await import('../../fonte/render/motor/perfis.js');
  assert.equal(sugerirPerfil({ gpu: 'Mali-G615 MC2', movel: true }), 'media');
  assert.equal(sugerirPerfil({ gpu: 'ANGLE (ARM, Mali-G615 MC2, OpenGL ES 3.2)', movel: true }), 'media');
  assert.equal(sugerirPerfil({ gpu: 'Adreno (TM) 740', movel: true }), 'alta');
  assert.equal(sugerirPerfil({ gpu: 'Adreno (TM) 650', movel: true }), 'media');
  assert.equal(sugerirPerfil({ gpu: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))', movel: false }), 'leve');
  assert.equal(sugerirPerfil({ gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)', movel: false }), 'ultra');
  assert.equal(razaoDePixels(PERFIS.media, 2.75), 1.3);
  assert.equal(razaoDePixels(PERFIS.media, 2.75, 1), 1, '?pr=1 fixa');
});

test('oficina: despachante (D45) com a caixa de prova, tipo desconhecido e registro fora do contrato', async () => {
  const { criarDespachante } = await import('../../fonte/render/mundo/oficina.worker.js');
  const d = criarDespachante();
  const { resposta, transferir } = d.responder({ id: 7, tipo: 'prova', chave: 's1', dados: { w: 4, h: 2, d: 6 } });
  assert.equal(resposta.id, 7);
  assert.equal(resposta.chave, 's1');
  assert.equal(resposta.malhas[0].indices.length, 36);
  assert.equal(Math.max(...resposta.malhas[0].atributos.posicao.filter((_, i) => i % 3 === 1)), 2);
  assert.equal(transferir.length, 2);
  assert.match(d.responder({ id: 8, tipo: 'setor', chave: 'x', dados: {} }).resposta.erro, /nenhum gerador/);
  assert.throws(() => d.registrarGeradorOficina('inventado', () => ({})), /fora do contrato/);
  d.registrarGeradorOficina('setor', { gerar: (dados) => ({ malhas: [], eco: dados.n }) });
  assert.equal(d.responder({ id: 9, tipo: 'setor', chave: 'y', dados: { n: 3 } }).resposta.eco, 3);
});

test('oficina: o worker não leva o three (teto de 250 KB, A1)', async () => {
  const { build } = await import('esbuild');
  const r = await build({ entryPoints: [fonte('render/mundo/oficina.worker.js')], bundle: true, write: false, format: 'iife', metafile: true, logLevel: 'silent' });
  const entradas = Object.keys(r.metafile.inputs);
  assert.ok(!entradas.some((e) => /node_modules[\\/]three/.test(e)), 'o worker oficina importa o three');
});

test('ponte do render: tudo na primeira leitura, só o novo depois, e tudo de novo ao trocar de simulação', async () => {
  const { PonteRender } = await import('../../fonte/render/ponte.js');
  const { criarSimulacao } = await import('../../fonte/sim/estado.js');
  let sim = criarSimulacao({ semente: 'ponte-render', dominios: false });
  const fonte2 = { get espelho() { return sim.espelho; }, get mudancas() { return sim.mudancas; } };
  const ponte = new PonteRender(fonte2);
  const vistos = [];
  const dom = { nome: 'teste', aplicar: (d) => vistos.push(d) };
  ponte.quadro([dom], {});
  assert.equal(vistos[0].tudo.predios, true, 'primeira leitura pede tudo');
  const P = sim.tabelas.predios;
  const i = P.alocar();
  P.x[i] = 10;
  P.marcar(i);
  ponte.quadro([dom], {});
  assert.equal(vistos[1].tudo.predios, false);
  assert.deepEqual([...vistos[1].predios], [i]);
  // simulação nova com MAIS marcas que a velha: sem a troca, a versão velha pareceria válida
  sim = criarSimulacao({ semente: 'ponte-render-2', dominios: false });
  for (let k = 0; k < 50; k++) sim.tabelas.predios.marcar(sim.tabelas.predios.alocar());
  ponte.quadro([dom], {});
  assert.equal(vistos[2].tudo.predios, true, 'troca de simulação pede tudo');
});

test('seleção: marcador ganha de prédio mais perto; o formato do contrato', async () => {
  const s = await import('../../fonte/render/camera/selecao.js');
  s.registrarSelecionavel('t-predio', () => ({ tipo: 'predio', ref: 5, idx: 5, ponto: [0, 0, 0], dist: 10 }));
  s.registrarSelecionavel('t-marcador', () => ({ tipo: 'marcador', ref: 9, idx: 9, ponto: [0, 5, 0], dist: 40 }), { prioridade: s.PRIORIDADE.marcador });
  assert.deepEqual(s.selecionarPorRaio({ origem: [0, 0, 0], dir: [0, 0, 1] }, {}), { tipo: 'marcador', ref: 9, idx: 9, ponto: [0, 5, 0] });
  s.removerSelecionavel('t-marcador');
  assert.equal(s.selecionarPorRaio({}, {}).tipo, 'predio');
  s.removerSelecionavel('t-predio');
});

test('ganchos: nomes do contrato, highp, sem precisão média, definir troca e sobe a versão', async () => {
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const { GANCHOS } = await import('../../fonte/contratos/render.js');
  assert.deepEqual(ganchos.nomes(), [...GANCHOS]);
  const t = ganchos.trechos(['sombra', 'neblina']);
  const tudo = Object.values(t).filter((x) => typeof x === 'string').join('\n');
  assert.match(tudo, /uniform highp sampler2DShadow gSombraMapa/);
  assert.doesNotMatch(tudo, new RegExp('\\bmed' + 'iump\\b'));
  assert.deepEqual(Object.keys(t.defines).sort(), ['G_NEBLINA', 'G_SOMBRA']);
  assert.ok(t.fim.indexOf('gNeblina') >= 0);
  const v = ganchos.versao;
  ganchos.definir('hao', { fragmento: { pars: 'float gHao() { return 1.0; }', indireta: 'reflectedLight.indirectDiffuse *= gHao();' } });
  assert.equal(ganchos.versao, v + 1);
  assert.match(ganchos.trechos(['hao']).indireta, /gHao/);
  assert.throws(() => ganchos.definir('inventado', {}), /fora do contrato/);
});

test('cenas: a prova da sombra está registrada; os nomes batem com o contrato', async () => {
  const { listarCenas, obterCena } = await import('../../fonte/render/cenas/index.js');
  const { CENAS } = await import('../../fonte/contratos/render.js');
  const c = obterCena('prova-sombra');
  assert.ok(c, 'prova-sombra registrada');
  assert.equal(c.sim, 'vazia');
  assert.equal(c.dominios, false);
  for (const n of listarCenas()) assert.ok(n in CENAS, `cena fora do contrato: ${n}`);
  assert.equal(obterCena('inventada'), null);
});

test('depuração: sol pela latitude (D9), caixa pelo catálogo e raio no chão', async () => {
  const d = await import('../../fonte/render/depuracao.js');
  const meioDia = d.direcaoDoSol(12, 355, -23.5); // solstício de verão do sul: sol quase a pino no trópico
  assert.ok(meioDia.y > 0.99, `meio-dia: ${meioDia.y}`);
  const manha = d.direcaoDoSol(7, 80, -23.5);
  assert.ok(manha.x > 0.5 && manha.y > 0 && manha.y < 0.4, 'às 7 h o sol está baixo a leste');
  const tarde = d.direcaoDoSol(17, 80, -23.5);
  assert.ok(tarde.x < -0.5, 'às 17 h a oeste');
  assert.ok(d.direcaoDoSol(12, 172, -23.5).z < 0, 'no inverno do sul, ao meio-dia o sol fica ao norte (-z)');
  assert.ok(d.direcaoDoSol(0, 80, -23.5).y < 0, 'à meia-noite abaixo do horizonte');
  const { terrenoPlano } = await import('../../fonte/sim/substitutos.js');
  const T = terrenoPlano({ cota: 5 });
  const p = d.raioNoChao(T, { origem: [0, 105, 0], dir: [0.6, -0.8, 0] });
  assert.ok(Math.abs(p[1] - 5) < 1e-3 && Math.abs(p[0] - 75) < 0.01, JSON.stringify(p));
  assert.equal(d.raioNoChao(T, { origem: [0, 105, 0], dir: [0, 1, 0] }, 2000), null);
});

test('câmera básica: voo interrompido resolve a Promise; o alvo não sai do mapa', async () => {
  const THREE = await import('three');
  const d = await import('../../fonte/render/depuracao.js');
  const { terrenoPlano } = await import('../../fonte/sim/substitutos.js');
  const ctx = { camera: new THREE.PerspectiveCamera(40, 2, 1, 20000), sim: { espelho: { terreno: terrenoPlano(), mapa: { tam: 8192 } } } };
  const cam = d.criarCameraBasica(ctx, { x: 0, z: 0, dist: 500 });
  let a = false;
  let b = false;
  cam.irPara({ x: 100 }, 5000).then(() => (a = true));
  cam.irPara({ x: 200 }, 5000).then(() => (b = true)); // o segundo voo interrompe o primeiro
  await Promise.resolve();
  assert.equal(a, true, 'o voo interrompido por outro resolve');
  cam.definir({ dist: 300 }); // definir interrompe o segundo
  await Promise.resolve();
  assert.equal(b, true, 'o voo interrompido por definir resolve');
  cam.definir({ x: 1e6, z: -1e6 });
  assert.deepEqual([cam.estado().x, cam.estado().z], [4096, -4096]);
  cam.definir({ x: Number.NaN });
  assert.equal(cam.estado().x, 4096, 'NaN não entra');
});

test('entrada básica: vários movimentos entre dois quadros deixam o chão sob o cursor', async () => {
  const THREE = await import('three');
  const d = await import('../../fonte/render/depuracao.js');
  const { terrenoPlano } = await import('../../fonte/sim/substitutos.js');
  const W = 1000;
  const H = 500;
  const ouvintes = {};
  const canvas = { addEventListener: (n, fn) => (ouvintes[n] = fn), getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const ctx = { canvas, camera: new THREE.PerspectiveCamera(40, W / H, 1, 20000), sim: { espelho: { terreno: terrenoPlano(), mapa: { tam: 8192 } } } };
  const cam = d.criarCameraBasica(ctx, { x: 0, z: 0, dist: 600, guinada: 20, inclinacao: 35 });
  cam.atualizar(0);
  ctx.raio = (x, y) => d.raioNoChao(ctx.sim.espelho.terreno, d.raioDaTela(ctx.camera, W, H, x, y));
  const toques = [];
  const ent = d.criarEntradaBasica(ctx, cam);
  ent.aoToque((t) => toques.push(t));
  const ev = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, button: 0, pointerType: 'mouse' });
  const p0 = ctx.raio(500, 250);
  ouvintes.pointerdown(ev(500, 250));
  for (let k = 1; k <= 10; k++) ouvintes.pointermove(ev(500 + 12 * k, 250 + 3 * k)); // sem quadro no meio
  ouvintes.pointerup(ev(620, 280));
  cam.atualizar(1);
  const p1 = ctx.raio(620, 280);
  assert.ok(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) < 0.5, `o chão escorregou ${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(1)} m`);
  assert.equal(toques.length, 0, 'arrastar não é toque');
  ouvintes.pointerdown(ev(300, 200));
  ouvintes.pointercancel({ ...ev(300, 200), type: 'pointercancel' });
  assert.equal(toques.length, 0, 'cancelado não é toque');
  ouvintes.pointerdown(ev(300, 200));
  ouvintes.pointerup({ ...ev(301, 200), type: 'pointerup' });
  assert.equal(toques.length, 1, 'toque curto');
});

test('sombra própria: encaixe no texel ao mudar o centro; troca de tamanho', async () => {
  const THREE = await import('three');
  const { SombraPropria } = await import('../../fonte/render/motor/quadro.js');
  const s = new SombraPropria({ tam: 1024 });
  const sol = new THREE.Vector3(-0.3, 0.7, 0.6).normalize();
  const fase = () => {
    // a origem do mundo no mapa, em texels: a parte fracionária não muda quando só o centro anda
    const p = new THREE.Vector3(0, 0, 0).applyMatrix4(s.matriz);
    return [p.x * s.tam, p.y * s.tam].map((v) => v - Math.floor(v));
  };
  s.acompanhar(new THREE.Vector3(0, 0, 0), 400, sol);
  const f0 = fase();
  s.acompanhar(new THREE.Vector3(133.37, 0, -71.9), 400, sol);
  const f1 = fase();
  for (let k = 0; k < 2; k++) assert.ok(Math.abs(f1[k] - f0[k]) < 1e-3 || Math.abs(Math.abs(f1[k] - f0[k]) - 1) < 1e-3, `fração ${f0} contra ${f1}`);
  const alvo = s.alvo;
  s.redimensionar(2048);
  assert.equal(s.tam, 2048);
  assert.notEqual(s.alvo, alvo);
  assert.equal(s.alvo.depthTexture.image.width, 2048);
  assert.equal(s.sujo, true);
  s.descartar();
});

test('chão da depuração: plano em 2 triângulos e moldura virada para cima', async () => {
  const THREE = await import('three');
  const d = await import('../../fonte/render/depuracao.js');
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const { Medidas } = await import('../../fonte/render/motor/medidas.js');
  const { criarSimulacao } = await import('../../fonte/sim/estado.js');
  const sim = criarSimulacao({ semente: 'chao-plano', dominios: false });
  const cena = new THREE.Scene();
  const medidas = new Medidas({ info: { render: { calls: 0, triangles: 0 }, memory: {}, reset() {} } });
  const ctx = { cena, ganchos, medidas, sombra: { marcar() {} } };
  const doms = [];
  d.registrar({ registrarDominio: (nome, fabrica) => doms.push({ nome, fabrica }), registrarSelecionavel() {} });
  const terreno = doms.find((x) => x.nome === 'terreno').fabrica(ctx);
  terreno.aplicar(sim.mudancas.desde(-1), sim.espelho, ctx);
  const chao = cena.getObjectByName('depuracao:chao');
  assert.equal(chao.geometry.index.count / 3, 2, 'chão liso em 2 triângulos');
  const moldura = cena.getObjectByName('depuracao:moldura');
  assert.ok(moldura, 'moldura em volta do mapa sem mar');
  const g = moldura.geometry;
  const P = g.attributes.position;
  const v = (i) => new THREE.Vector3().fromBufferAttribute(P, g.index.getX(i));
  for (let t = 0; t < g.index.count; t += 3) {
    const n = new THREE.Vector3().subVectors(v(t + 1), v(t)).cross(new THREE.Vector3().subVectors(v(t + 2), v(t)));
    assert.ok(n.y > 0, `triângulo ${t / 3} virado para baixo`);
  }
  terreno.descartar();
});

// ------------------------------------------------------------------------------------------------ app

// o controle importa a interface (JSX): vai pelo esbuild, como na montagem
async function importarControle() {
  const { build } = await import('esbuild');
  const r = await build({
    entryPoints: [fonte('app/controle.js')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    jsx: 'automatic', jsxImportSource: 'preact', nodePaths: [join(RAIZ, 'node_modules')],
  });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}

test('canteiro de prova: ruas e prédios pelas APIs, invariantes do espelho, determinístico, sai com o mapa', async () => {
  const { criarSimulacao } = await import('../../fonte/sim/estado.js');
  const { conferirEspelho } = await import('../../fonte/contratos/espelho.js');
  const { semearCanteiro } = await importarControle();
  const a = criarSimulacao({ semente: 'canteiro-teste' });
  const n = semearCanteiro(a);
  assert.ok(n > 80, `${n} prédios`);
  assert.deepEqual(conferirEspelho(a.espelho, { alturaEm: (x, z) => a.alturaEm(x, z) }), []);
  assert.deepEqual(a.validar(), []);
  assert.ok(a.agregados.populacao > 0);
  const b = criarSimulacao({ semente: 'canteiro-teste' });
  semearCanteiro(b);
  assert.equal(a.hash(), b.hash());
  assert.equal(semearCanteiro(a), 0, 'com o mundo ocupado (o mapa da S1a) o canteiro não roda');
});

// ------------------------------------------------------------------------------------------------ índices fixos

function listar(dir, ext) {
  const out = [];
  for (const n of readdirSync(dir).sort()) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) out.push(...listar(f, ext));
    else if (ext.test(n)) out.push(f);
  }
  return out;
}
const importados = (arquivo) => [...readFileSync(arquivo, 'utf8').matchAll(/^import\s[^'"]*['"](\.[^'"]+)['"]/gm)].map((m) => resolve(dirname(arquivo), m[1]));

test('índices: todo módulo do render e da interface está ligado a um índice fixo (esqueletos inclusive)', () => {
  const r = (p) => fonte(`render/${p}`);
  const indicesRender = [r('index.js'), r('cenas/index.js'), r('mundo/oficina.worker.js')].flatMap(importados);
  const semIndice = [];
  for (const f of listar(fonte('render'), /\.js$/)) {
    const rel = relative(fonte('render'), f).split('\\').join('/');
    if (/^(index|ponte|depuracao)\.js$|^motor\/(renderizador|perfis|quadro|medidas|ganchos)\.js$|^cenas\/index\.js$|^mundo\/oficina\.worker\.js$|^materiais\/texturas\.js$|^camera\/selecao\.js$|\.glsl\.js$/.test(rel)) continue;
    if (!indicesRender.includes(f)) semIndice.push(`render/${rel}`);
  }
  const u = (p) => fonte(`ui/${p}`);
  const indicesUI = [u('index.jsx'), u('textos.js')].flatMap(importados);
  for (const f of listar(fonte('ui'), /\.(js|jsx)$/)) {
    const rel = relative(fonte('ui'), f).split('\\').join('/');
    if (/^(index\.jsx|ponte|loja|acoes|consultas|textos|formato|prefs)\.js$|^index\.jsx$|^comp\/|^glifos\/(glifos\.js|Glifo\.jsx)$/.test(rel)) continue;
    if (!indicesUI.includes(f)) semIndice.push(`ui/${rel}`);
  }
  assert.deepEqual(semIndice, []);
});

test('esqueletos: exportam registrar() e dizem o dono numa linha', () => {
  const faltam = [];
  for (const f of [...listar(fonte('render'), /\.js$/), ...listar(fonte('ui'), /\.(js|jsx)$/), ...listar(fonte('som'), /\.js$/), ...listar(fonte('app'), /\.js$/)]) {
    const txt = readFileSync(f, 'utf8');
    if (!/Esqueleto da F0/.test(txt)) continue;
    if (!/^export function registrar\(\) \{\}$/m.test(txt) || !/dona?:? /.test(txt.split('\n')[0])) faltam.push(relative(RAIZ, f));
  }
  assert.deepEqual(faltam, []);
});
