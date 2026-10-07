// Testes da interface e do toque da MOV1 (D94), sem navegador:
//   - a ferramenta de mover é a de colocar: a sessão abre como 'colocar' com a ref do prédio, o fantasma já fica nele (a
//     prévia parada, sem erro e com o custo de mover à vista), arrastar dá a prévia de q.mover.previa, Construir manda o
//     comando `mover` e o Desfazer da sessão manda `mover.desfazer`; zona e Arcologia não abrem, com a dica;
//   - o painel "o que muda" (linhas puras) e os textos da parcela;
//   - a ferramenta aberta volta depois da recarga pela perda do contexto (estadoParaRetomar e retomar, e o armazém da
//     retomada de app/controle.js com o campo `ferramenta`);
//   - a entrada do render: o giro de dois dedos sobre o fantasma (R.entrada.aoGiroDeFerramenta) e segurar e arrastar (o
//     toque longo que abre a ferramenta leva o dedo junto), com a prioridade do ouvinte do toque.
// Roda sozinho: node ferramentas/testes/mover-ui.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { idxDaRef } from '../../fonte/contratos/espelho.js';
import { CELULA } from '../../fonte/contratos/flags.js';
import { indiceZona } from '../../fonte/data/zonas.js';
import { terminarObra, nascerNaFrente } from '../../fonte/sim/zonas/crescimento.js';
import * as sessao from '../../fonte/ui/ferramentas/sessao.js';
import * as moverUI from '../../fonte/ui/ferramentas/mover.js';
import * as colocar from '../../fonte/ui/ferramentas/colocar.js';
import * as loja from '../../fonte/ui/loja.js';
import { t, temTexto, chavesRepetidas } from '../../fonte/ui/textos.js';
import { registrar as registrarTextosMov1 } from '../../fonte/ui/textos/mov1.js';
import { registrarTextos } from '../../fonte/ui/textos.js';
import * as fmt from '../../fonte/ui/formato.js';
import { ligarAcoes, comando, frase } from '../../fonte/ui/acoes.js';
import { ligarConsultas, consultar } from '../../fonte/ui/consultas.js';
import { glifo } from '../../fonte/ui/glifos/glifos.js';
import { criarEntrada } from '../../fonte/render/camera/entrada.js';
import { criarCamera } from '../../fonte/render/camera/camera.js';
import { raioDoContexto } from '../../fonte/render/camera/raio.js';
import { opcoesDoToque } from '../../fonte/render/camera/gesto.js';
import { terrenoPlano } from '../../fonte/sim/substitutos.js';
import { CHAVE_RETOMADA } from '../../fonte/app/estavel.js';

registrarTextosMov1(registrarTextos);

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8');
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// ------------------------------------------------------------------------------------------------ mundo e sessão

const rua = (sim, pontos, tipo = 'rua') => {
  const r = sim.cmd('via.construir', { plano: { modo: 'reta', tipo, pontos, sessao: 1, encaixe: false } });
  assert.ok(r.ok, `${JSON.stringify(pontos)}: ${r.codigo}`);
};

function mundo(semente) {
  const sim = criarSimulacao({ semente, modo: 'livre' });
  rua(sim, [[960, -300], [1600, -300]], 'avenida');
  rua(sim, [[960, -200], [1440, -200]]);
  return sim;
}

function pronto(sim, tipo, x, z) {
  const p = sim.q.construir.previa({ tipo, x, z, rot: 0 });
  assert.ok(p.ok, `${tipo}: ${p.codigo}`);
  const r = sim.cmd('construir', { tipo, x: p.x, z: p.z, rot: p.rot, alinhar: false });
  assert.ok(r.ok, r.codigo);
  terminarObra(sim, idxDaRef(r.id));
  sim.rodar(40, { sincrono: true });
  return r.id;
}

/** Render de mentira: câmera de cima (1 px = 1 m, o chão é y = 0), com os ouvintes da entrada que a MOV1 usa. */
function renderFalso() {
  const log = [];
  const R = {
    log,
    ouvintes: { ferramenta: null, giro: null, toque: [] },
    entrada: {
      modo: (m) => log.push(['modo', m]),
      aoFerramenta: (fn) => (R.ouvintes.ferramenta = fn),
      opcoes: (o) => log.push(['opcoes', o]),
      aoGiroDeFerramenta: (fn) => {
        R.ouvintes.giro = fn;
        return () => (R.ouvintes.giro = null);
      },
      aoToque: (fn, op = {}) => {
        const l = { fn, prioridade: op.prioridade ?? 0 };
        R.ouvintes.toque.push(l);
        R.ouvintes.toque.sort((a, b) => b.prioridade - a.prioridade);
        return () => (R.ouvintes.toque = R.ouvintes.toque.filter((x) => x !== l));
      },
    },
    enviar: (fase, x, y, extra = {}) => R.ouvintes.ferramenta({ fase, x, y, ponto: [x, 0, y], dedos: 1, ...extra }),
    /** O que o render faz num toque longo: chama os ouvintes na ordem da prioridade até um ficar com ele. */
    toqueLongo: (x, y) => {
      for (const l of R.ouvintes.toque) if (l.fn({ x, y, longo: true, botao: 0 }) === true) return true;
      return false;
    },
    alvo: null,
    selecionar: () => R.alvo,
    projetar: ([x, , z]) => ({ x, y: z, visivel: true, dist: 100 }),
    raio: (x, y) => [x, 0, y],
    selecionado: () => {},
    camera: { estado: () => ({ x: 0, z: 0, dist: 500, guinada: 0, inclinacao: 40 }), definir: (e) => log.push(['camera', e]) },
    ferramenta: {
      via: { previa: () => {} },
      zona: { mostrar: () => {}, celulas: () => {} },
      pincel: () => {},
      ladrilhos: () => {},
      fantasma: (f) => log.push(['fantasma', f]),
      demolir: (r) => log.push(['demolir', r]),
      limpar: () => log.push(['limpar']),
    },
  };
  return R;
}

function montarSessao(sim) {
  const R = renderFalso();
  ligarConsultas(() => sim);
  ligarAcoes({ obterSim: () => sim });
  loja.reiniciarLoja();
  loja.barra.value = { ...loja.BARRA_VAZIA, creditos: 1e9, marco: { ...loja.BARRA_VAZIA.marco, n: 7 } };
  const ui = { R, loja, t, fmt, consultar, comando, frase, obterSim: () => sim, aoQuadro: () => {}, telas: () => [], abrirTela: () => true, registrarTextos };
  const soltar = sessao.registrar(ui);
  return { R, ui, soltar };
}

const ultimoFantasma = (R) => R.log.filter(([k]) => k === 'fantasma').at(-1)?.[1];

// ------------------------------------------------------------------------------------------------ sessão

test('sessão: mover abre o colocar no prédio (prévia parada, sem erro), arrastar dá a prévia do mover, Construir manda o comando e o Desfazer desfaz', async () => {
  const sim = mundo('mov-ui-sessao');
  const ref = pronto(sim, 'clinica', 1100, -330);
  const P = sim.tabelas.predios;
  const i = idxDaRef(ref);
  const x0 = P.x[i];
  const z0 = P.z[i];
  const { R, soltar } = montarSessao(sim);
  try {
    assert.equal(sessao.ferramentas.abrir('mover', { ref }), true);
    assert.deepEqual(loja.ferramenta.value, { tipo: 'mover', ref }, 'a loja guarda o pedido do mover');
    let s = sessao.sessao.value;
    assert.equal(s.tipo, 'colocar', 'a barra, o painel do fantasma e o puxador são os do colocar');
    assert.equal(s.maquina.mover.ref, ref);
    assert.equal(s.maquina.alinhar, false, 'o prédio só anda quando o jogador mexe');
    assert.equal(s.item.nomeReal, 'Clínica');
    assert.equal(s.item.nome, t('mov1.barra.nome', { nome: 'Clínica' }));
    assert.equal(s.item.manutencaoHora, 0);
    assert.equal(s.previa.parado, true);
    assert.equal(s.previa.ok, true, 'a prévia parada não é erro');
    assert.equal(s.valido, false, 'mas ainda não há o que confirmar');
    assert.equal(s.dica.codigo, 'nada');
    assert.equal(s.dica.tom, 'info');
    assert.equal(s.dica.texto, t('mov1.dica.nada'));
    assert.equal(s.previa.custo, 1000, 'o custo de mover já aparece');
    let f = ultimoFantasma(R);
    assert.ok(perto(f.x, x0) && perto(f.z, z0) && f.ok === true, 'o fantasma está no prédio');
    assert.ok(R.log.some(([k, o]) => k === 'opcoes' && o.giroFerramenta && perto(o.giroFerramenta.x, x0)), 'a entrada sabe onde está a planta para o giro de dois dedos');
    assert.equal(R.log.filter(([k, m]) => k === 'modo' && m === 'ferramenta').length, 1);
    // arrasta para 300 m de lá: a prévia do mover, com o custo de 10% e o que muda
    R.enviar('inicio', 1400, -337);
    R.enviar('fim', 1400, -337);
    s = sessao.sessao.value;
    assert.equal(s.previa.ok, true);
    assert.equal(s.previa.parado, undefined);
    assert.equal(s.valido, true);
    assert.equal(s.previa.custo, 1000);
    assert.ok(s.previa.muda?.via, 'o que muda vem da simulação');
    assert.equal(s.dica, null);
    f = ultimoFantasma(R);
    assert.ok(perto(f.x, 1400, 1e-3) && f.ok === true);
    // gira 90 graus no lugar: continua válido e o fantasma gira
    sessao.ferramentas.girar(1);
    s = sessao.sessao.value;
    assert.ok(s.valido, s.motivo);
    assert.ok(perto(ultimoFantasma(R).rot, (P.rot[i] + Math.PI / 2) % (2 * Math.PI), 1e-5));
    sessao.ferramentas.girar(-1);
    // Construir: o comando mover com o lugar da prévia, sem grudar de novo
    const caixa0 = sim.holding.caixa();
    await sessao.ferramentas.construir();
    assert.ok(perto(P.x[i], 1400, 1e-3), 'o prédio foi para onde o fantasma estava');
    assert.ok(caixa0 - sim.holding.caixa() >= 1000 - 1e-6);
    assert.equal(sim.q.predio(ref).estado, 'obra');
    assert.equal(sessao.sessao.value.desfazer, 1);
    assert.ok(loja.avisos.value.some((a) => a.texto.includes('em obra por')), 'o aviso diz quanto dura a obra');
    // a ferramenta fica aberta com o fantasma no prédio em obra (não se move de novo até acabar)
    s = sessao.sessao.value;
    assert.equal(s.previa.codigo, 'ocupado');
    assert.equal(s.dica.chave, 'mov1.dica.fixo.obra');
    assert.equal(s.valido, false);
    // Desfazer: o prédio volta e o fantasma vai atrás
    await sessao.ferramentas.desfazer();
    assert.ok(perto(P.x[i], x0, 1e-6) && perto(P.z[i], z0, 1e-6));
    assert.equal(sim.q.predio(ref).estado, 'ok');
    s = sessao.sessao.value;
    assert.equal(s.desfazer, 0);
    assert.equal(s.previa.parado, true);
    assert.ok(perto(ultimoFantasma(R).x, x0, 1e-6));
    sessao.ferramentas.fechar();
    assert.equal(sessao.sessao.value, null);
    assert.equal(loja.ferramenta.value, null);
    assert.ok(R.log.some(([k, o]) => k === 'opcoes' && o.giroFerramenta === null), 'fechar solta o giro de dois dedos');
    assert.deepEqual(sim.erros, []);
  } finally {
    soltar();
  }
});

test('sessão: o Desfazer depois que a obra começou diz por quê; um mover que derrubou casas não entra no Desfazer', async () => {
  const sim = mundo('mov-ui-tarde');
  const ref = pronto(sim, 'praca', 1100, -330);
  const { R, soltar } = montarSessao(sim);
  try {
    sessao.ferramentas.abrir('mover', { ref });
    R.enviar('inicio', 1300, -337);
    R.enviar('fim', 1300, -337);
    await sessao.ferramentas.construir();
    assert.equal(sessao.sessao.value.desfazer, 1);
    sim.rodar(20, { sincrono: true }); // a equipe chegou
    await sessao.ferramentas.desfazer();
    assert.ok(loja.avisos.value.some((a) => a.texto === t('mov1.desfazer.tarde')));
    assert.equal(sessao.sessao.value.desfazer, 0);
    sessao.ferramentas.fechar();
  } finally {
    soltar();
  }
});

test('sessão: zona e Arcologia não abrem a ferramenta; a dica diz o motivo', () => {
  const sim = mundo('mov-ui-fixo');
  const zr = indiceZona('resBaixa');
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'retangulo', x: 1000, z: -300, x2: 1100, z2: -200 }, zona: zr }).ok);
  const C = sim.tabelas.celulas;
  const rng = sim.rng('teste');
  let casa = -1;
  for (let c = 0; c < C.n && casa < 0; c++) {
    if (!C.viva[c] || C.zona[c] !== zr || C.linha[c] !== 0 || C.estado[c] !== CELULA.LIVRE) continue;
    casa = nascerNaFrente(sim, c, zr, rng);
  }
  terminarObra(sim, casa);
  const ref = sim.tabelas.predios.ref(casa);
  const { soltar } = montarSessao(sim);
  try {
    assert.equal(sessao.ferramentas.abrir('mover', { ref }), false);
    assert.equal(sessao.sessao.value, null);
    assert.equal(loja.avisos.value.at(-1).texto, t('mov1.fixo.zona'));
    assert.equal(moverUI.podeAbrir(sim.q.predio(ref)).chave, 'mov1.fixo.zona');
    // pela loja (a folha e o menu abrem assim): o pedido que falha é limpo
    loja.ferramenta.value = { tipo: 'mover', ref };
    assert.equal(sessao.sessao.value, null);
    assert.equal(loja.ferramenta.value, null, 'o pedido recusado não fica na loja');
    // a Arcologia (fixa pelo catálogo)
    const praca = pronto(sim, 'praca', 1300, -330);
    sim.colocaveis.obter('praca').arcologia = true;
    assert.equal(moverUI.podeAbrir(sim.q.predio(praca)).chave, 'mov1.fixo.arcologia');
    assert.equal(sessao.ferramentas.abrir('mover', { ref: praca }), false);
    assert.equal(loja.avisos.value.at(-1).texto, t('mov1.fixo.arcologia'));
    // o prédio em obra aparece apagado na folha e não abre
    sim.colocaveis.obter('praca').arcologia = false;
    assert.equal(moverUI.podeAbrir(null).ok, false);
  } finally {
    soltar();
  }
});

test('sessão: o botão Mover da folha só aparece para colocável (em obra, apagado)', async () => {
  const { mostraMover } = await importarBotao();
  assert.equal(mostraMover(null), false);
  assert.equal(mostraMover({ mover: { pode: false, codigo: 'fixo', motivo: 'zona' } }), false, 'zona: sem botão');
  assert.equal(mostraMover({ mover: { pode: false, codigo: 'fixo', motivo: 'arcologia' } }), false, 'Arcologia: sem botão');
  assert.equal(mostraMover({ mover: { pode: false, codigo: 'ocupado', motivo: 'obra' } }), true, 'em obra: apagado, com o porquê');
  assert.equal(mostraMover({ mover: { pode: true, custo: 1000 } }), true);
  assert.equal(mostraMover({}), false);
  // a folha chama o botão e não carrega texto nenhum da parcela (o índice de textos é fixo)
  const folha = ler('fonte/ui/selecao/Folha.jsx');
  assert.match(folha, /<BotaoMover p=\{p\}/);
  assert.doesNotMatch(folha, /mov1\./);
});

// o botão é JSX: pelo esbuild, como na montagem
async function importarBotao() {
  const { build } = await import('esbuild');
  const r = await build({
    entryPoints: [join(RAIZ, 'fonte/ui/ferramentas/BotaoMover.jsx')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    jsx: 'automatic', jsxImportSource: 'preact', nodePaths: [join(RAIZ, 'node_modules')],
  });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}

// ------------------------------------------------------------------------------------------------ painel e textos

test('o painel "o que muda": as linhas de uma prévia, em ordem, com o tom de cada uma', () => {
  assert.deepEqual(moverUI.linhasDoQueMuda(null, { t, fmt }), []);
  assert.deepEqual(moverUI.linhasDoQueMuda({ parado: true, ok: true }, { t, fmt }), [], 'parado: só a instrução do painel');
  const previa = {
    ok: true, custoMover: 1000, valor: 10000, custoDemolir: 4000, demolir: [1, 2], tiques: 36, mobilizacao: 12, desfazer: false,
    muda: {
      cobertura: { categoria: 'saude', raio: 1200, antes: 4200, depois: 3100, deixam: 1400, passam: 300 },
      via: { antes: { ref: 1, nome: 'Rua das Flores' }, depois: { ref: 2, nome: 'Avenida das Palmeiras' } },
      rede: { antes: true, depois: false },
      armazem: { antes: 210, depois: 640, livre: 500, penalAntes: 0, penalDepois: 0.014 },
    },
  };
  const l = moverUI.linhasDoQueMuda(previa, { t, fmt });
  assert.deepEqual(l.map((x) => x.id), ['custo', 'demolir', 'obra', 'cobertura', 'deixam', 'passam', 'via', 'rede', 'armazem']);
  const por = Object.fromEntries(l.map((x) => [x.id, x]));
  assert.equal(por.custo.texto, `Mover custa ${fmt.dinheiro(1000)}, 10% do valor`);
  assert.match(por.demolir.texto, /Derruba 2 prédios de zona/);
  assert.equal(por.demolir.tom, 'al');
  assert.match(por.obra.texto, /Fica fora de serviço por 0,8 min de jogo/);
  assert.match(por.cobertura.texto, /Atende 4\.200 moradores hoje e 3\.100 depois \(Saúde\)/);
  assert.equal(por.cobertura.tom, 'al');
  assert.match(por.deixam.texto, /1\.400 moradores deixam de ser atendidos/);
  assert.match(por.passam.texto, /300 moradores passam a ser atendidos/);
  assert.equal(por.passam.tom, 'ok');
  assert.match(por.via.texto, /Liga à Avenida das Palmeiras, hoje na Rua das Flores/);
  assert.match(por.rede.texto, /não leva canos nem cabos/);
  assert.equal(por.rede.tom, 'al');
  assert.match(por.armazem.texto, /Fica a 640 m do armazém \(hoje a 210 m\): produtividade −1%/);
  // sem via, sem demolição e podendo desfazer
  const so = moverUI.linhasDoQueMuda({ ok: true, custoMover: 1000, valor: 10000, demolir: [], tiques: 36, mobilizacao: 12, desfazer: true, muda: { via: { antes: null, depois: null } } }, { t, fmt });
  assert.deepEqual(so.map((x) => x.id), ['custo', 'obra', 'via', 'desfazer']);
  assert.equal(so.find((x) => x.id === 'via').tom, 'er');
  assert.match(so.find((x) => x.id === 'desfazer').texto, /desfazer até a obra começar, em 0,2 min de jogo/);
  // vermelho: sem custo nem obra; só o que a prévia sabe
  assert.deepEqual(moverUI.linhasDoQueMuda({ ok: false, codigo: 'colisao' }, { t, fmt }), []);
});

test('textos: todas as chaves da MOV1 existem, sem travessão nem "dia", sem repetir chave de outra parcela', async () => {
  const { verificarConteudo } = await import('../guarda-texto.mjs');
  const chaves = [...ler('fonte/ui/textos/mov1.js').matchAll(/'((?:mov1|codigo)\.[\w.]+)':/g)].map((m) => m[1]);
  assert.ok(chaves.length > 30, `${chaves.length} chaves`);
  for (const k of chaves) {
    assert.ok(temTexto(k), k);
    assert.deepEqual(verificarConteudo(t(k), ['travessao', 'aluguel', 'porDia', 'dia'], { js: false }), [], `${k}: ${t(k)}`);
  }
  assert.deepEqual(chavesRepetidas(), []);
  // toda chave que o código usa existe: as da interface, do painel e do botão
  const fontes = ['fonte/ui/ferramentas/mover.js', 'fonte/ui/ferramentas/PainelMover.jsx', 'fonte/ui/ferramentas/BotaoMover.jsx', 'fonte/ui/ferramentas/sessao.js'];
  for (const f of fontes) for (const m of ler(f).matchAll(/\bt\(\s*'(mov1\.[\w.]+)'/g)) assert.ok(temTexto(m[1]), `${f}: ${m[1]}`);
  // o código de recusa 'fixo' tem a frase (e o contrato ganha o código quando o integrador o listar)
  assert.ok(temTexto('codigo.fixo'));
  // o glifo de mover existe no registro
  assert.ok(glifo('mover')?.tracos.length >= 5);
  // a dica de cada impedimento
  for (const f of ['zona', 'arcologia', 'obra']) {
    assert.ok(temTexto(`mov1.fixo.${f}`) && temTexto(`mov1.dica.fixo.${f}`) && temTexto(`mov1.curto.fixo.${f}`), f);
  }
  // o css e o painel estão no pacote
  assert.match(ler('fonte/ui/tema/mov1.css'), /\.mov1-painel/);
});

// ------------------------------------------------------------------------------------------------ retomada

test('retomada: a ferramenta aberta (via, zona, colocar, mover) volta pela recarga; estado inválido não abre nada', () => {
  const sim = mundo('mov-ui-retomada');
  const ref = pronto(sim, 'clinica', 1100, -330);
  const { soltar } = montarSessao(sim);
  try {
    assert.equal(sessao.estadoParaRetomar(), null, 'sem ferramenta, nada a retomar');
    // via
    sessao.ferramentas.abrir('via', { tipoVia: 'avenida', modo: 'curva' });
    const ev = sessao.estadoParaRetomar();
    assert.deepEqual(ev, { tipo: 'via', tipoVia: 'avenida', modo: 'curva', continua: false, encaixe: true });
    sessao.ferramentas.fechar();
    assert.equal(sessao.estadoParaRetomar(), null);
    assert.equal(sessao.retomar(JSON.parse(JSON.stringify(ev))), true);
    assert.deepEqual([sessao.sessao.value.tipo, sessao.sessao.value.maquina.tipo, sessao.sessao.value.maquina.modo], ['via', 'avenida', 'curva']);
    assert.equal(sessao.retomar(ev), false, 'com uma ferramenta aberta, não abre outra por cima');
    sessao.ferramentas.fechar();
    // zona
    sessao.ferramentas.abrir('zona', { zona: 'comBaixa', modo: 'pincel', tamanho: 'G' });
    const ez = sessao.estadoParaRetomar();
    assert.deepEqual(ez, { tipo: 'zona', zona: 'comBaixa', modo: 'pincel', tamanho: 'G', apagar: false });
    sessao.ferramentas.fechar();
    assert.equal(sessao.retomar(ez), true);
    assert.deepEqual([sessao.sessao.value.maquina.zona, sessao.sessao.value.maquina.modo, sessao.sessao.value.maquina.tamanho], ['comBaixa', 'pincel', 'G']);
    sessao.ferramentas.fechar();
    // colocar um item do catálogo, com o giro que o jogador já deu
    const item = consultar('catalogo', 'lazer').find((x) => x.tipo === 'praca');
    sessao.ferramentas.abrir('colocar', { item });
    sessao.ferramentas.girar(1);
    sessao.ferramentas.alinhar(false);
    const ec = sessao.estadoParaRetomar();
    assert.equal(ec.tipo, 'colocar');
    assert.equal(ec.item, 'praca');
    assert.ok(perto(ec.rot, Math.PI / 2) && perto(ec.giro, Math.PI / 2) && ec.alinhar === false);
    sessao.ferramentas.fechar();
    assert.equal(sessao.retomar(JSON.parse(JSON.stringify(ec))), true);
    let m = sessao.sessao.value.maquina;
    assert.deepEqual([m.tipo, m.alinhar], ['praca', false]);
    assert.ok(perto(m.rot, Math.PI / 2));
    sessao.ferramentas.fechar();
    // mover um prédio
    sessao.ferramentas.abrir('mover', { ref });
    sessao.ferramentas.girar(1);
    const em = sessao.estadoParaRetomar();
    assert.equal(em.tipo, 'mover');
    assert.equal(em.ref, ref);
    sessao.ferramentas.fechar();
    assert.equal(sessao.retomar(JSON.parse(JSON.stringify(em))), true);
    m = sessao.sessao.value.maquina;
    assert.equal(m.mover.ref, ref);
    assert.ok(perto(m.rot, sim.tabelas.predios.rot[idxDaRef(ref)] + Math.PI / 2, 1e-5), 'volta virado como estava');
    assert.equal(sessao.sessao.value.previa.ok && !sessao.sessao.value.previa.parado, true, 'a prévia é a de uma meia volta no lugar');
    sessao.ferramentas.fechar();
    // demolir
    sessao.ferramentas.abrir('demolir');
    const ed = sessao.estadoParaRetomar();
    sessao.ferramentas.fechar();
    assert.equal(sessao.retomar(ed), true);
    sessao.ferramentas.fechar();
    // o que não serve não abre nada
    for (const ruim of [null, undefined, 5, 'via', {}, { tipo: 'nada' }, { tipo: 'via', tipoVia: 'estrada-de-ouro' }, { tipo: 'zona', zona: 'inventada' }, { tipo: 'colocar', item: 'palacio' }, { tipo: 'mover' }, { tipo: 'mover', ref: 99999999 }]) {
      assert.equal(sessao.retomar(ruim), false, JSON.stringify(ruim));
      assert.equal(sessao.sessao.value, null);
    }
    assert.deepEqual(sim.erros, []);
  } finally {
    soltar();
  }
  assert.equal(sessao.estadoParaRetomar(), null, 'desligada a interface, nada a retomar');
});

test('retomada: o armazém da retomada leva a ferramenta no mesmo registro da câmera e da velocidade', async () => {
  const { armazemComFerramenta, ferramentaDaRetomada } = await importarControle();
  const guardado = new Map();
  const base = { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, v), removeItem: (k) => guardado.delete(k) };
  let ferramenta = { tipo: 'mover', ref: 7, rot: 1, giro: 0, alinhar: false };
  const a = armazemComFerramenta(base, () => ferramenta);
  // o que estavel.js grava (câmera e velocidade) ganha o campo da ferramenta
  const registro = { v: 1, camera: { x: 1, z: 2, dist: 3, guinada: 4, inclinacao: 5 }, velocidade: 2, t: 1000 };
  a.setItem(CHAVE_RETOMADA, JSON.stringify(registro));
  assert.deepEqual(JSON.parse(base.getItem(CHAVE_RETOMADA)), { ...registro, ferramenta });
  assert.deepEqual(ferramentaDaRetomada(a), ferramenta);
  // outras chaves passam como estão, e sem ferramenta o registro não muda
  a.setItem('heldopolis.recargas', '[1]');
  assert.equal(base.getItem('heldopolis.recargas'), '[1]');
  ferramenta = null;
  a.setItem(CHAVE_RETOMADA, JSON.stringify(registro));
  assert.deepEqual(JSON.parse(base.getItem(CHAVE_RETOMADA)), registro);
  assert.equal(ferramentaDaRetomada(a), null);
  // um estado que falha ou um registro quebrado não derruba a gravação
  const quebrado = armazemComFerramenta(base, () => {
    throw new Error('sem sessão');
  });
  assert.doesNotThrow(() => quebrado.setItem(CHAVE_RETOMADA, JSON.stringify(registro)));
  assert.deepEqual(JSON.parse(base.getItem(CHAVE_RETOMADA)), registro);
  assert.doesNotThrow(() => a.setItem(CHAVE_RETOMADA, 'isto não é json'));
  assert.equal(base.getItem(CHAVE_RETOMADA), 'isto não é json');
  assert.equal(ferramentaDaRetomada(a), null);
  assert.equal(ferramentaDaRetomada({ getItem: () => { throw new Error('bloqueado'); } }), null);
  base.setItem(CHAVE_RETOMADA, JSON.stringify({ ...registro, ferramenta: 'texto' }));
  assert.equal(ferramentaDaRetomada(base), null);
  // o controle usa os dois no lugar certo
  const fonte = ler('fonte/app/controle.js');
  assert.match(fonte, /storage: armazemComFerramenta\(armazem\)/);
  assert.match(fonte, /retomarFerramenta\(ferramenta\)/);
});

// o controle importa a interface (JSX): vai pelo esbuild, como na montagem
async function importarControle() {
  const { build } = await import('esbuild');
  const r = await build({
    entryPoints: [join(RAIZ, 'fonte/app/controle.js')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    jsx: 'automatic', jsxImportSource: 'preact', nodePaths: [join(RAIZ, 'node_modules')],
  });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}

// ------------------------------------------------------------------------------------------------ giro e toque longo na sessão

test('sessão: o giro de dois dedos (aoGiroDeFerramenta) gira o fantasma com o ímã e o toque longo no prédio selecionado abre o mover', () => {
  const sim = mundo('mov-ui-toque');
  const ref = pronto(sim, 'clinica', 1100, -330);
  const outra = pronto(sim, 'praca', 1300, -330);
  const { R, soltar } = montarSessao(sim);
  try {
    // sem ferramenta, o giro não faz nada
    R.ouvintes.giro({ delta: 1, fim: true });
    assert.equal(sessao.sessao.value, null);
    sessao.ferramentas.abrir('mover', { ref });
    const rot0 = sessao.sessao.value.maquina.rot;
    // 33 graus de giro acumulado: o ímã de 15 graus põe em 30
    R.ouvintes.giro({ delta: (33 * Math.PI) / 180, fim: false });
    assert.ok(perto(colocar.graus(sessao.sessao.value.maquina.rot), colocar.graus(rot0 + (30 * Math.PI) / 180), 1), `${colocar.graus(sessao.sessao.value.maquina.rot)} graus`);
    R.ouvintes.giro({ delta: (-50 * Math.PI) / 180, fim: true });
    const depois = sessao.sessao.value.maquina.rot;
    assert.ok(perto(colocar.graus(depois), colocar.graus(rot0 - (45 * Math.PI) / 180), 1), 'ímã em 45 para trás (50 arredonda para 45)');
    // o outro gesto parte do ângulo de agora
    R.ouvintes.giro({ delta: (15 * Math.PI) / 180, fim: true });
    assert.ok(perto(colocar.graus(sessao.sessao.value.maquina.rot), colocar.graus(depois + (15 * Math.PI) / 180), 1));
    assert.ok(perto(colocar.graus(sessao.sessao.value.previa.rot), colocar.graus(sessao.sessao.value.maquina.rot), 1), 'a prévia segue o giro (torta na calçada ela bate na via, e o vermelho diz por quê)');
    assert.ok(sessao.sessao.value.previa.parado !== true);
    sessao.ferramentas.fechar();
    // toque longo: o ouvinte de prioridade 10 fica com o toque quando o prédio tocado é o selecionado e dá para mover
    assert.equal(R.ouvintes.toque[0].prioridade, 10);
    const sel = { tipo: 'predio', ref, ponto: [1100, 0, -330] };
    R.alvo = sel;
    assert.equal(R.toqueLongo(1100, -330), false, 'sem seleção, o toque longo é do menu de contexto');
    loja.selecao.value = sel;
    assert.equal(R.toqueLongo(1100, -330), true, 'prédio selecionado: abre o mover e fica com o toque');
    assert.equal(sessao.sessao.value.maquina.mover.ref, ref);
    assert.equal(loja.selecao.value, null, 'a ferramenta recolhe a seleção');
    assert.equal(R.toqueLongo(1100, -330), false, 'com a ferramenta aberta, não abre outra');
    sessao.ferramentas.fechar();
    loja.selecao.value = sel;
    R.alvo = { tipo: 'predio', ref: outra, ponto: [1300, 0, -330] };
    assert.equal(R.toqueLongo(1300, -330), false, 'tocou em outro prédio: segue o menu de contexto');
    R.alvo = { tipo: 'aresta', ref: 1 };
    assert.equal(R.toqueLongo(10, 10), false, 'via não é prédio');
    assert.equal(sessao.sessao.value, null);
    assert.deepEqual(sim.erros, []);
  } finally {
    soltar();
  }
});

// ------------------------------------------------------------------------------------------------ a entrada do render

const L = 986;
const A = 443;

function montarEntrada({ cam0 = { x: 0, z: 0, dist: 1500, guinada: 0, inclinacao: 45 } } = {}) {
  const ouvintes = new Map();
  const canvas = {
    clientWidth: L, clientHeight: A, getBoundingClientRect: () => ({ left: 0, top: 0, width: L, height: A }), setPointerCapture() {},
    addEventListener: (n, fn) => ouvintes.set(n, fn), removeEventListener: (n) => ouvintes.delete(n),
  };
  const camera3 = new THREE.PerspectiveCamera(40, L / A, 1, 20000);
  const ctx = { canvas, tela: { w: L, h: A }, camera: camera3, sim: { espelho: { terreno: terrenoPlano(), mapa: { tam: 8192 } } }, semClip: false, pr: 1 };
  const cam = criarCamera(ctx, cam0);
  cam.atualizar(0);
  ctx.raio = (x, y) => raioDoContexto(ctx, x, y);
  const E = criarEntrada(ctx, cam);
  E.opcoes(opcoesDoToque({}));
  const ev = (tipo, id, x, y, t) => ouvintes.get(tipo)?.({ type: tipo, pointerId: id, clientX: x, clientY: y, timeStamp: t, pointerType: 'touch', button: 0, isPrimary: id === 1, preventDefault() {} });
  const quadro = (t) => {
    cam.atualizar(t);
    E.quadro(t);
  };
  return { E, cam, ctx, ev, quadro };
}

/** Dois dedos em volta do ponto (cx, cy) que giram `graus` (positivo é horário na tela) em passos, com quadros de 33 ms. */
function giroDeDoisDedos(M, { cx = L / 2, cy = A / 2, raio = 70, graus = 40, passos = 14, t0 = 1000, soltar = true } = {}) {
  const pos = (ang) => [[cx - raio * Math.cos(ang), cy - raio * Math.sin(ang)], [cx + raio * Math.cos(ang), cy + raio * Math.sin(ang)]];
  let t = t0;
  const [a0, b0] = pos(0);
  M.ev('pointerdown', 1, a0[0], a0[1], t);
  M.ev('pointerdown', 2, b0[0], b0[1], t + 5);
  for (let k = 1; k <= passos; k++) {
    t += 33;
    const [a, b] = pos((((graus * Math.PI) / 180) * k) / passos);
    M.ev('pointermove', 1, a[0], a[1], t);
    M.ev('pointermove', 2, b[0], b[1], t);
    M.quadro(t);
  }
  if (soltar) {
    t += 33;
    const [a, b] = pos((graus * Math.PI) / 180);
    M.ev('pointerup', 2, b[0], b[1], t);
    M.quadro(t);
    M.ev('pointerup', 1, a[0], a[1], t + 5);
    M.quadro(t + 40);
  }
  return t;
}

test('entrada: dois dedos sobre o fantasma giram o fantasma (no chão) e não a câmera; fora dele, giram a câmera', () => {
  const M = montarEntrada();
  const centro = M.ctx.raio(L / 2, A / 2);
  const eventos = [];
  const desliga = M.E.aoGiroDeFerramenta((d) => eventos.push(d));
  assert.equal(typeof desliga, 'function');
  M.E.modo('ferramenta');
  M.E.opcoes({ giroFerramenta: { x: centro[0], z: centro[2], raio: 60 } });
  const g0 = M.cam.estado().guinada;
  giroDeDoisDedos(M, { graus: 40 });
  assert.ok(eventos.length >= 5, `${eventos.length} eventos`);
  assert.equal(eventos.filter((e) => e.fim).length, 1, 'um fim só');
  assert.equal(eventos.at(-1).fim, true);
  assert.ok(eventos.slice(0, -1).every((e) => e.fim === false));
  // o ângulo acumulado cresce no sentido do giro, com o sinal da rotação do prédio (horário na tela é para trás)
  const deltas = eventos.map((e) => e.delta);
  assert.ok(deltas.at(-1) < 0, `delta final ${deltas.at(-1)}`);
  assert.ok(Math.abs(deltas.at(-1)) > (15 * Math.PI) / 180 && Math.abs(deltas.at(-1)) < (80 * Math.PI) / 180, `${(deltas.at(-1) * 180) / Math.PI} graus para 40 na tela`);
  for (let k = 1; k < deltas.length; k++) assert.ok(deltas[k] <= deltas[k - 1] + 1e-9, 'sem recuo no meio do giro');
  assert.ok(perto(M.cam.estado().guinada, g0, 1e-6), 'a câmera não girou');
  // o mesmo giro para o outro lado muda o sinal
  eventos.length = 0;
  giroDeDoisDedos(M, { graus: -40, t0: 5000 });
  assert.ok(eventos.at(-1).delta > 0);
  assert.ok(perto(M.cam.estado().guinada, g0, 1e-6));
  // fora da planta: gira a câmera, como sempre, e o ouvinte não ouve
  eventos.length = 0;
  M.E.opcoes({ giroFerramenta: { x: centro[0] + 900, z: centro[2], raio: 60 } });
  giroDeDoisDedos(M, { graus: 40, t0: 9000 });
  assert.equal(eventos.length, 0);
  assert.ok(Math.abs(M.cam.estado().guinada - g0) > 5, 'a câmera girou');
  // sem a opção (ferramenta sem planta), também gira a câmera
  const g1 = M.cam.estado().guinada;
  M.E.opcoes({ giroFerramenta: null });
  giroDeDoisDedos(M, { graus: 40, t0: 13000 });
  assert.equal(eventos.length, 0);
  assert.ok(Math.abs(M.cam.estado().guinada - g1) > 5);
  // desligar o ouvinte
  desliga();
  M.E.opcoes({ giroFerramenta: { x: centro[0], z: centro[2], raio: 60 } });
  const g2 = M.cam.estado().guinada;
  giroDeDoisDedos(M, { graus: 40, t0: 17000 });
  assert.ok(Math.abs(M.cam.estado().guinada - g2) > 5, 'sem ouvinte a câmera volta a girar');
  M.E.descartar();
});

test('entrada: a pinça sobre o fantasma segue aproximando a câmera, e o giro interrompido por cancelar fecha com o último ângulo', () => {
  const M = montarEntrada();
  const centro = M.ctx.raio(L / 2, A / 2);
  const eventos = [];
  M.E.aoGiroDeFerramenta((d) => eventos.push(d));
  M.E.modo('ferramenta');
  M.E.opcoes({ giroFerramenta: { x: centro[0], z: centro[2], raio: 60 } });
  // gira e deixa o gesto aberto; a aba vai para o fundo (cancelar): o fim chega uma vez, com o ângulo de antes
  giroDeDoisDedos(M, { graus: 35, soltar: false });
  assert.ok(eventos.length > 3 && eventos.every((e) => e.fim === false));
  const ultimo = eventos.at(-1).delta;
  M.E.cancelar();
  assert.equal(eventos.filter((e) => e.fim).length, 1);
  assert.equal(eventos.at(-1).delta, ultimo);
  // trocar de modo no meio do giro também fecha
  eventos.length = 0;
  M.E.modo('ferramenta');
  giroDeDoisDedos(M, { graus: 35, t0: 6000, soltar: false });
  M.E.modo('camera');
  assert.equal(eventos.filter((e) => e.fim).length, 1);
  M.E.descartar();
});

test('entrada: segurar e arrastar: o toque longo que abre a ferramenta leva o dedo (o gesto vira o da ferramenta, a câmera não anda)', () => {
  const M = montarEntrada();
  const recebidos = [];
  M.E.aoFerramenta((e) => recebidos.push(e));
  const ordem = [];
  // o menu (prioridade 0) e o mover (prioridade 10): o do mover fala primeiro e fica com o toque
  M.E.aoToque((e) => {
    ordem.push(['menu', e.longo]);
    return false;
  });
  M.E.aoToque(
    (e) => {
      ordem.push(['mover', e.longo]);
      if (!e.longo) return false;
      M.E.modo('ferramenta');
      return true;
    },
    { prioridade: 10 },
  );
  const cam0 = M.cam.estado();
  M.ev('pointerdown', 1, 500, 260, 1000);
  for (let t = 1033; t <= 1560; t += 33) M.quadro(t);
  assert.deepEqual(ordem, [['mover', true]], 'o menu nem chegou a ouvir o toque longo');
  assert.equal(M.E.estado, 'ferramenta');
  assert.equal(M.E.gesto, 'ferramenta');
  assert.deepEqual(recebidos.map((e) => e.fase), ['inicio'], 'a ferramenta começa no dedo que segura');
  assert.ok(recebidos[0].dedoX === 500 && recebidos[0].dedoY === 260 && recebidos[0].dedos === 1);
  // arrasta: a ferramenta recebe os movimentos e a câmera fica parada
  for (let k = 1; k <= 6; k++) {
    M.ev('pointermove', 1, 500 + 40 * k, 260 - 10 * k, 1560 + 33 * k);
    M.quadro(1560 + 33 * k);
  }
  assert.ok(recebidos.filter((e) => e.fase === 'move').length >= 6);
  assert.ok(Math.hypot(recebidos.at(-1).dedoX - 740, recebidos.at(-1).dedoY - 200) < 1);
  M.ev('pointerup', 1, 740, 200, 1800);
  M.quadro(1840);
  assert.deepEqual(recebidos.at(-1).fase, 'fim');
  assert.ok(!recebidos.at(-1).cancelado);
  const cam1 = M.cam.estado();
  assert.ok(perto(cam1.x, cam0.x, 1e-6) && perto(cam1.z, cam0.z, 1e-6), 'a câmera não andou');
  M.E.descartar();
  // se nenhum ouvinte abre ferramenta, o toque longo é só um toque longo: o gesto acaba e o dedo não vira ferramenta
  const N = montarEntrada();
  const ouvidos = [];
  const sobra = [];
  N.E.aoFerramenta((e) => sobra.push(e));
  N.E.aoToque((e) => ouvidos.push(e.longo) && false);
  N.ev('pointerdown', 1, 300, 200, 3000);
  for (let t = 3033; t <= 3560; t += 33) N.quadro(t);
  assert.deepEqual(ouvidos, [true]);
  assert.equal(N.E.estado, 'camera');
  assert.equal(N.E.gesto, 'nada');
  N.ev('pointermove', 1, 400, 220, 3600);
  N.quadro(3633);
  N.ev('pointerup', 1, 400, 220, 3700);
  assert.deepEqual(sobra, [], 'a ferramenta não recebeu nada');
  N.E.descartar();
});

test('entrada: o ouvinte do toque que devolve true segura o toque, em qualquer ordem de registro; toque curto e longo comuns seguem iguais', () => {
  const M = montarEntrada();
  const vistos = [];
  M.E.aoToque((e) => vistos.push(['a', e.longo]) && false);
  const desliga = M.E.aoToque((e) => vistos.push(['b', e.longo]) && false, { prioridade: 5 });
  M.ev('pointerdown', 1, 400, 200, 1000);
  M.quadro(1050);
  M.ev('pointerup', 1, 400, 200, 1100);
  assert.deepEqual(vistos, [['b', false], ['a', false]], 'o de prioridade maior primeiro');
  vistos.length = 0;
  M.ev('pointerdown', 1, 400, 200, 2000);
  for (let t = 2033; t <= 2560; t += 33) M.quadro(t);
  assert.deepEqual(vistos, [['b', true], ['a', true]], 'toque longo: os dois ouvem, a câmera não vira ferramenta');
  assert.equal(M.E.estado, 'camera');
  M.ev('pointerup', 1, 400, 200, 2600);
  desliga();
  vistos.length = 0;
  M.ev('pointerdown', 1, 400, 200, 4000);
  M.quadro(4050);
  M.ev('pointerup', 1, 400, 200, 4100);
  assert.deepEqual(vistos, [['a', false]]);
  M.E.descartar();
});
