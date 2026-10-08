// Testes da rede viária (S1b): encaixe (D18) em até 1 ms; cruzamento que divide as duas vias, passagem pelo nó, ângulo
// mínimo, trecho curto e raio mínimo; declive por tipo; água, gleba, portão e ladrilho; custo com declive e demolições;
// "melhorar" de terra para rua; demolir e desfazer (D32, com 'ocupado' quando nasce prédio); a prévia avisa todo prédio
// que a obra derruba (também o da coluna de células que o nó novo corta); a grade encaixa B; argumentos estranhos; nomes,
// q.aresta e q.viasPerto; prévia pura e determinismo com save no meio; e o chão ao menos 5 cm abaixo da pista em toda a
// seção (com as formas do aplainar em dia).
// Roda sozinho: node ferramentas/testes/vias.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { conferirEspelho, refDe, idxDaRef } from '../../fonte/contratos/espelho.js';
import { ARESTA, CELULA, PREDIO } from '../../fonte/contratos/flags.js';
import { tabelaArco, tDoArco, ponto, direcao } from '../../fonte/comum/bezier.js';
import { fnv1aTipado } from '../../fonte/comum/hash.js';
import { VIAS, VIAS_ORDEM, REGRAS_VIAS } from '../../fonte/data/vias.js';
import { indiceZona } from '../../fonte/data/zonas.js';
import { montarSave, lerSave, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { formaDaAresta, pistaDaAresta, FOLGA_CHAO, CHAO_ABAIXO_DA_PISTA } from '../../fonte/sim/mundo/aplainar.js';
import { normalizarForma } from '../../fonte/sim/formas.js';
import { arestasDoNo } from '../../fonte/sim/vias/grafo.js';
import { encaixarTraco } from '../../fonte/sim/vias/encaixe.js';
import { decliveDa } from '../../fonte/sim/vias/validar.js';
import { custoDemolirPredio } from '../../fonte/sim/vias/demolir.js';
import { celulasDaAresta } from '../../fonte/sim/zonas/blocos.js';
import { crescerNaFrente } from '../../fonte/sim/substitutos.js';
import * as validar from '../../fonte/sim/vias/validar.js';
import * as nomes from '../../fonte/sim/vias/nomes.js';
import * as ferramenta from '../../fonte/sim/vias/ferramenta.js';
import * as demolir from '../../fonte/sim/vias/demolir.js';
import * as blocos from '../../fonte/sim/zonas/blocos.js';
import * as pincel from '../../fonte/sim/zonas/pincel.js';
import { gerarCidadeSintetica } from '../cidade-sintetica.mjs';

// ------------------------------------------------------------------------------------------------ apoio

const novaSim = (semente, modo = null) => criarSimulacao({ semente, ...(modo ? { modo } : {}) });

/** Prévia e, se pedido e ok, a obra: { p (prévia), r (resposta do comando) }. */
function via(sim, tipo, pontos, { modo = 'reta', construir = true, sessao = 1, ...extra } = {}) {
  const args = { modo, tipo, pontos, sessao, ...extra };
  const p = sim.q.via.previa(args);
  const r = construir && p.ok ? sim.cmd('via.construir', { plano: args }) : null;
  return { p, r, args };
}

const codigos = (p) => [...new Set(p.erros.map((e) => e.codigo))];
const vivas = (sim) => {
  const A = sim.tabelas.arestas;
  const out = [];
  for (let e = 0; e < A.n; e++) if (A.viva[e]) out.push(e);
  return out;
};
const hashChao = (sim) => {
  const g = sim.espelho.terreno.altura;
  return fnv1aTipado(new Uint8Array(g.buffer, g.byteOffset, g.byteLength));
};
const comp = (p) => tabelaArco(Float64Array.from(p))[16];

/** Arestas criadas pela resposta do comando (idx). */
const criadas = (r) => (r?.dados?.arestas ?? []).map((ref) => idxDaRef(ref));

/**
 * Pior folga do chão sob a pista, a cada `passo` metros ao longo e através da seção de cada aresta (menos pontes):
 * { acima, abaixo } = maior (chão - pista) e menor (chão - pista), com onde aconteceu.
 */
function folgaDoChao(sim, arestas = vivas(sim), passo = 1) {
  const A = sim.tabelas.arestas;
  const G = sim.grafo;
  const q = [0, 0];
  const d = [0, 0];
  let acima = -Infinity;
  let abaixo = Infinity;
  let onde = null;
  let ondeAbaixo = null;
  for (const e of arestas) {
    if (!A.viva[e] || A.flags[e] & ARESTA.PONTE) continue;
    const meia = VIAS[VIAS_ORDEM[A.tipo[e]]].largura / 2;
    const p = A.p.subarray(8 * e, 8 * e + 8);
    const tab = tabelaArco(p);
    const L = tab[16];
    const n = Math.max(1, Math.ceil(L / passo));
    for (let k = 0; k <= n; k++) {
      const s = (L * k) / n;
      const t = tDoArco(tab, s);
      ponto(p, t, q);
      direcao(p, t, d);
      const y = pistaDaAresta(G, e, s);
      for (let u = -meia; u <= meia + 1e-9; u += passo) {
        const x = q[0] - d[1] * u;
        const z = q[1] + d[0] * u;
        const h = sim.alturaEm(x, z) - y;
        if (h > acima) {
          acima = h;
          onde = { e, tipo: VIAS_ORDEM[A.tipo[e]], s: +s.toFixed(1), u, x: +x.toFixed(1), z: +z.toFixed(1) };
        }
        if (h < abaixo) {
          abaixo = h;
          ondeAbaixo = { e, s: +s.toFixed(1), u, x: +x.toFixed(1), z: +z.toFixed(1) };
        }
      }
    }
  }
  return { acima, abaixo, onde, ondeAbaixo };
}

/** Arestas cuja forma registrada no aplainar não é a de agora (patamares e dobras fora de dia). */
function formasForaDeDia(sim) {
  const A = sim.tabelas.arestas;
  const reg = new Map();
  for (const f of sim.formas.porId.values()) if (f.tipo === 'via') reg.set(f.ref, f);
  const ruins = [];
  for (const e of vivas(sim)) {
    if (A.flags[e] & ARESTA.PONTE) continue;
    const f = reg.get(refDe(e, A.ger[e]));
    const g = normalizarForma(formaDaAresta(sim.grafo, e));
    if (!f || f.eixo.length !== g.eixo.length || g.eixo.some((v, k) => Math.abs(v - f.eixo[k]) > 1e-6)) ruins.push(e);
  }
  return ruins;
}

/** Tempos (ms) de fn sobre a lista: o menor de 3 por caso (tira pausas do coletor e da máquina dividida). */
function tempos(lista, fn) {
  for (const a of lista.slice(0, 30)) fn(a);
  const ts = lista.map((a) => {
    let m = Infinity;
    for (let k = 0; k < 3; k++) {
      const t0 = performance.now();
      fn(a);
      m = Math.min(m, performance.now() - t0);
    }
    return m;
  });
  ts.sort((a, b) => a - b);
  const q = (p) => ts[Math.min(ts.length - 1, Math.floor(p * ts.length))];
  return { p50: q(0.5), p95: q(0.95), max: ts[ts.length - 1] };
}

// ------------------------------------------------------------------------------------------------ encaixe

test('encaixe (D18): nó, ponto na aresta, 90 e 45 graus, prolongamento, quadra, passo de 15 graus e múltiplo de 8 m', () => {
  const sim = novaSim('vias-encaixe');
  const { r } = via(sim, 'rua', [[1200, -300], [1400, -300]]);
  assert.ok(r?.ok, 'rua de base');
  const N = sim.tabelas.nos;
  // nó que existe: A cai no nó (a menos da tolerância)
  const fim = [...criadas(r)].flatMap((e) => [sim.tabelas.arestas.a[e], sim.tabelas.arestas.b[e]]).find((n) => N.x[n] === 1400 && N.z[n] === -300);
  assert.ok(fim !== undefined, 'nó no fim da rua');
  let enc = encaixarTraco(sim, { modo: 'reta', tipo: 'rua', pontos: [[1404, -304], [1404, -200]] });
  assert.equal(enc.encaixes[0].tipo, 'no');
  assert.deepEqual(enc.pontos[0], [1400, -300]);
  // ponto sobre a aresta, e dali 90 graus
  enc = encaixarTraco(sim, { modo: 'reta', tipo: 'rua', pontos: [[1248, -304], [1251, -200]] });
  assert.equal(enc.encaixes[0].tipo, 'aresta');
  assert.ok(Math.abs(enc.pontos[0][1] + 300) < 1e-6, 'A no eixo da rua');
  const ang = enc.encaixes.find((x) => x.indice === 1 && x.tipo === 'angulo');
  assert.equal(ang?.valor, 90);
  assert.ok(Math.abs(enc.pontos[1][0] - enc.pontos[0][0]) < 1e-6, 'B na perpendicular');
  // 45 graus a partir do ponto na aresta
  enc = encaixarTraco(sim, { modo: 'reta', tipo: 'rua', pontos: [[1248, -300], [1320, -230]] });
  assert.equal(enc.encaixes.find((x) => x.indice === 1 && x.tipo === 'angulo')?.valor, 45);
  const [ax, az] = enc.pontos[0];
  const [bx, bz] = enc.pontos[1];
  assert.ok(Math.abs(Math.abs(bx - ax) - Math.abs(bz - az)) < 1e-6, 'B a 45 graus');
  // prolongamento da via numa ponta solta, com o comprimento múltiplo de 8 m
  enc = encaixarTraco(sim, { modo: 'reta', tipo: 'rua', pontos: [[1400, -300], [1497, -302]] });
  assert.ok(enc.encaixes.some((x) => x.tipo === 'prolongamento' && x.valor === 0));
  assert.ok(Math.abs(enc.pontos[1][1] + 300) < 1e-6, 'B no prolongamento');
  const L = Math.hypot(enc.pontos[1][0] - 1400, enc.pontos[1][1] + 300);
  assert.ok(Math.abs(L / 8 - Math.round(L / 8)) < 1e-9 && enc.encaixes.some((x) => x.tipo === 'comprimento' && x.valor === L));
  // quadra: paralela à rua a meia largura + 48 m + meia largura (um bloco de 6 células)
  enc = encaixarTraco(sim, { modo: 'reta', tipo: 'rua', pontos: [[1180, -370], [1180, -230]] });
  const quadra = enc.encaixes.find((x) => x.tipo === 'quadra');
  assert.equal(quadra?.valor, 64);
  assert.ok(Math.abs(enc.pontos[1][1] - (-300 + 64)) < 1e-6, 'B a um bloco da rua');
  assert.ok(enc.guias.some((g) => g.tipo === 'quadra'));
  // passo de 15 graus longe de tudo, e o encaixe desligado não mexe no ponto
  enc = encaixarTraco(sim, { modo: 'reta', tipo: 'rua', pontos: [[1100, -50], [1200, -55]] });
  assert.ok(enc.encaixes.some((x) => x.tipo === 'passo'));
  assert.ok(Math.abs(enc.pontos[1][1] + 50) < 1e-6);
  enc = encaixarTraco(sim, { modo: 'reta', tipo: 'rua', pontos: [[1100, -50], [1200, -55]], encaixe: false });
  assert.deepEqual(enc.pontos, [[1100, -50], [1200, -55]]);
  assert.equal(enc.encaixes.length, 0);
});

test('encaixe em até 1 ms e prévia medida na cidade sintética (menor de 3 por caso)', () => {
  const { sim } = gerarCidadeSintetica();
  for (const m of [validar, nomes, ferramenta, demolir, blocos, pincel]) m.registrar(sim);
  sim.json.partida = { modo: 'livre' };
  const N = sim.tabelas.nos;
  let semente = 99;
  const r = () => (semente = (semente * 1103515245 + 12345) >>> 0) / 4294967296;
  const nos = [];
  for (let i = 0; i < N.n; i++) if (N.viva[i]) nos.push(i);
  const casos = [];
  for (let k = 0; k < 200; k++) {
    const i = nos[Math.floor(r() * nos.length)];
    const x = N.x[i] + (r() - 0.5) * 20;
    const z = N.z[i] + (r() - 0.5) * 20;
    const a = r() * 2 * Math.PI;
    const L = 60 + r() * 240;
    const bx = x + Math.cos(a) * L;
    const bz = z + Math.sin(a) * L;
    const modo = ['reta', 'reta', 'curva', 'continua'][k % 4];
    const pontos = modo === 'reta' ? [[x, z], [bx, bz]] : [[x, z], [(x + bx) / 2 + (r() - 0.5) * 60, (z + bz) / 2 + (r() - 0.5) * 60], [bx, bz]];
    casos.push({ modo, tipo: k % 5 === 0 ? 'avenida' : 'rua', pontos, tolerancia: 8 });
  }
  const h0 = sim.hash();
  const te = tempos(casos, (a) => encaixarTraco(sim, a));
  const tp = tempos(casos, (a) => sim.q.via.previa(a));
  console.log(`# ${sim.tabelas.arestas.vivos} arestas, ${sim.tabelas.celulas.vivos} células, ${sim.tabelas.predios.vivos} prédios`);
  console.log(`# encaixe: p50 ${te.p50.toFixed(3)} p95 ${te.p95.toFixed(3)} máx ${te.max.toFixed(3)} ms`);
  console.log(`# prévia: p50 ${tp.p50.toFixed(3)} p95 ${tp.p95.toFixed(3)} máx ${tp.max.toFixed(3)} ms`);
  assert.ok(te.p95 <= 1, `encaixe p95 ${te.p95.toFixed(3)} ms`);
  assert.ok(tp.p50 <= 1, `prévia p50 ${tp.p50.toFixed(3)} ms`);
  assert.equal(sim.hash(), h0, 'a prévia não muda o estado');
});

// ------------------------------------------------------------------------------------------------ geometria

test('cruzamento divide as duas vias; perto do nó passa pelo nó; ângulo mínimo, trecho curto e raio mínimo', () => {
  const sim = novaSim('vias-cruzamento', 'livre');
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const { r } = via(sim, 'rua', [[1200, -300], [1400, -300]]);
  assert.ok(r?.ok);
  // um ponto da rua longe dos nós dela
  const nosRua = new Set(criadas(r).flatMap((e) => [A.a[e], A.b[e]]));
  let xc = 1230;
  while ([...nosRua].some((n) => Math.abs(N.x[n] - xc) < 24)) xc += 4;
  const antes = A.vivos;
  const c = via(sim, 'rua', [[xc, -380], [xc, -220]]);
  assert.ok(c.p.ok, JSON.stringify(c.p.erros));
  assert.equal(c.p.divisoes, 1);
  assert.ok(c.p.segmentos.length >= 2, 'o traço também se divide no cruzamento');
  assert.ok(c.r.ok);
  assert.equal(A.vivos, antes + 1 + c.p.segmentos.length, 'a rua dividida vira duas e o traço entra com os trechos dele');
  const no = [...Array(N.n).keys()].find((n) => N.viva[n] && Math.abs(N.x[n] - xc) < 1e-6 && Math.abs(N.z[n] + 300) < 1e-6);
  assert.ok(no !== undefined, 'nó no cruzamento');
  assert.equal(N.grau[no], 4);
  assert.equal(N.raio[no], VIAS.rua.largura / 2 + 2);
  // perto de um nó (a menos de 8 m) o traço passa por ele em vez de dividir a rua
  const perto = via(sim, 'rua', [[xc + 5, -380], [xc + 5, -220]], { construir: false, encaixe: false });
  assert.equal(perto.p.divisoes, 0);
  // ângulo abaixo de 30 graus com a rua
  const agudo = via(sim, 'rua', [[1280, -300], [1400, -340]], { construir: false });
  assert.ok(codigos(agudo.p).includes('angulo'), JSON.stringify(codigos(agudo.p)));
  // traçado curto (menos de 16 m)
  assert.ok(codigos(via(sim, 'rua', [[1100, -50], [1110, -50]], { construir: false, encaixe: false }).p).includes('curto'));
  // raio mínimo por tipo: a mesma curva serve para a rua (20 m) e não para a avenida grande (60 m)
  const curva = [[1100, -150], [1140, -150], [1140, -110]];
  const pr = via(sim, 'rua', curva, { modo: 'curva', construir: false });
  assert.ok(!codigos(pr.p).includes('raio'), JSON.stringify(pr.p.erros));
  assert.ok(codigos(via(sim, 'avenidaG', curva, { modo: 'curva', construir: false }).p).includes('raio'));
  assert.ok(codigos(via(sim, 'rua', [[1600, -200], [1640, -180], [1600, -160]], { modo: 'curva', construir: false }).p).includes('raio'));
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) }), []);
});

test('declive por tipo (greide seguindo o chão), água com ponte, gleba com portão e ladrilho', () => {
  const sim = novaSim('vias-regras', 'livre');
  // subindo o pé do morro: a rua (12%) passa, a avenida grande (8%) não
  const subida = [[-760, -520], [-760, -700]];
  assert.ok(codigos(via(sim, 'avenidaG', subida, { construir: false, encaixe: false }).p).includes('declive'));
  const { p, r } = via(sim, 'rua', subida, { encaixe: false });
  assert.ok(p.ok && r?.ok, JSON.stringify(p.erros));
  for (const e of criadas(r)) assert.ok(decliveDa(sim, e) <= VIAS.rua.declive + 1e-6, `aresta ${e} com ${decliveDa(sim, e)}`);
  assert.ok(p.declive > 0.05, 'a rua sobe de verdade');
  // morro acima do que o tipo aguenta
  assert.ok(codigos(via(sim, 'rua', [[-720, -520], [-720, -720]], { construir: false, encaixe: false }).p).includes('declive'));
  // água: com a travessia registrada pela ponte (X4, D53, PONT2) vira ponte; o resto está em ponte.teste.mjs
  const agua = [[-700, 700], [-700, 950]];
  const pp = via(sim, 'rua', agua, { construir: false }).p;
  assert.ok(!codigos(pp).includes('agua') && pp.segmentos.some((s) => s.ponte), JSON.stringify(pp.erros));
  // gleba: não entra, mas chega ao portão
  assert.ok(codigos(via(sim, 'rua', [[0, 100], [0, 400]], { construir: false }).p).includes('gleba'));
  const portao = via(sim, 'rua', [[200, -720], [200, -622]], { construir: false });
  assert.ok(!codigos(portao.p).includes('gleba'), JSON.stringify(portao.p.erros));
  assert.ok(portao.p.encaixes.some((x) => x.portao === 'norte'));
  // fora dos ladrilhos da Holding
  assert.ok(codigos(via(sim, 'rua', [[1950, -500], [2150, -500]], { construir: false }).p).includes('ladrilho'));
  // marco (fora do Modo livre): mão única e avenida grande ainda trancadas no marco 0
  const normal = novaSim('vias-regras-marco');
  assert.ok(codigos(via(normal, 'ruaMao', [[-500, -200], [-300, -200]], { construir: false }).p).includes('marco'));
  assert.ok(!codigos(via(normal, 'avenida', [[-500, -200], [-300, -200]], { construir: false }).p).includes('marco'));
  // o nó de entrada da rodovia recebe a primeira avenida (sugestão da primeira hora)
  const sug = normal.q.sugestoes().find((x) => x.id === 'avenida');
  const av = via(normal, 'avenida', sug.pontos.slice(0, 2));
  assert.ok(av.r?.ok, JSON.stringify(av.p.erros));
  assert.equal(normal.tabelas.nos.grau[idxDaRef(normal.json.mapa.entrada)], 2);
});

// ------------------------------------------------------------------------------------------------ custo e obra

test('custo: comprimento x custo por metro x (1 + 2 x declive) mais demolições; paga do caixa; manutenção', () => {
  const sim = novaSim('vias-custo');
  const caixa0 = sim.holding.caixa();
  const { p, r } = via(sim, 'rua', [[-800, -520], [-800, -700]]);
  assert.ok(p.ok && r?.ok, JSON.stringify(p.erros));
  let esperado = 0;
  for (const s of p.segmentos) esperado += comp(s.p) * VIAS.rua.custoM * (1 + 2 * s.declive);
  assert.ok(Math.abs(p.custo - Math.round(esperado)) <= 1, `${p.custo} x ${esperado}`);
  assert.equal(sim.holding.caixa(), caixa0 - p.custo);
  assert.ok(p.manutencaoHora > 0 && Math.abs(p.manutencaoHora - (p.comprimento / 1000) * VIAS.rua.manutKmH) < 0.1);
  const lista = sim.custos.lista().find((x) => x.nome === 'vias');
  let manut = 0;
  for (const e of vivas(sim)) manut += (sim.tabelas.arestas.arco[17 * e + 16] / 1000) * (VIAS[VIAS_ORDEM[sim.tabelas.arestas.tipo[e]]].manutKmH ?? 0);
  assert.ok(Math.abs(lista.valor - manut) < 1e-6, 'manutenção das vias registrada nos custos');
  // demolições: uma rua cortando a Vila derruba as casas no caminho e soma o valor dos materiais (D54)
  const P = sim.tabelas.predios;
  const vila = sim.json.mapa.predios.map((ref) => idxDaRef(ref)).filter((i) => P.viva[i]);
  const alvo = vila[Math.floor(vila.length / 2)];
  const d = [Math.sin(P.rot[alvo]), Math.cos(P.rot[alvo])];
  const pts = [[P.x[alvo] - d[1] * 60 - d[0] * 2, P.z[alvo] + d[0] * 60 - d[1] * 2], [P.x[alvo] + d[1] * 60 - d[0] * 2, P.z[alvo] - d[0] * 60 - d[1] * 2]];
  const dem = via(sim, 'rua', pts, { construir: false, encaixe: false });
  assert.ok(dem.p.demolir.predios.length >= 1, 'a rua passa por cima de uma casa');
  let custoDem = 0;
  for (const ref of dem.p.demolir.predios) custoDem += custoDemolirPredio(sim, idxDaRef(ref));
  assert.equal(dem.p.demolir.custo, Math.round(custoDem));
  let via0 = 0;
  for (const s of dem.p.segmentos) via0 += comp(s.p) * VIAS.rua.custoM * (1 + 2 * s.declive);
  assert.ok(Math.abs(dem.p.custo - Math.round(via0 + custoDem)) <= 1);
  // sem créditos: recusa com o quanto falta, e nada muda
  sim.holding.pagar(sim.holding.caixa() - 100, 'teste');
  const n = sim.tabelas.arestas.vivos;
  const sem = via(sim, 'rua', [[1200, -300], [1400, -300]]);
  const erro = sem.p.erros.find((x) => x.codigo === 'creditos');
  assert.ok(erro && erro.dados.faltam > 0);
  assert.equal(sim.cmd('via.construir', { plano: sem.args }).codigo, 'creditos');
  assert.equal(sim.tabelas.arestas.vivos, n);
  assert.equal(sim.holding.caixa(), 100);
});

test('melhorar: a rua de terra da Vila vira rua com calçada sem derrubar casa, paga a diferença e ganha células', () => {
  const sim = novaSim('vias-melhorar');
  const A = sim.tabelas.arestas;
  const P = sim.tabelas.predios;
  const praia = sim.json.mapa.ruas.praia;
  assert.ok(praia.every((ref) => VIAS_ORDEM[A.tipo[idxDaRef(ref)]] === 'terra'));
  const nPredios = P.vivos;
  const caixa0 = sim.holding.caixa();
  const pv = sim.q.via.previa({ modo: 'melhorar', arestas: praia, tipo: 'rua' });
  assert.ok(pv.ok, JSON.stringify(pv.erros));
  assert.equal(pv.demolir.predios.length, 0, 'nenhuma casa da Vila sai');
  let esperado = 0;
  for (const ref of praia) esperado += A.arco[17 * idxDaRef(ref) + 16] * VIAS.rua.custoM * (1 + 2 * decliveDa(sim, idxDaRef(ref)));
  assert.ok(Math.abs(pv.custo - Math.round(esperado)) <= 1);
  const r = sim.cmd('via.melhorar', { arestas: praia, tipo: 'rua', sessao: 3 });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(sim.holding.caixa(), caixa0 - pv.custo);
  assert.equal(P.vivos, nPredios);
  for (const ref of praia) {
    const e = idxDaRef(ref);
    assert.equal(VIAS_ORDEM[A.tipo[e]], 'rua');
    assert.ok(celulasDaAresta(sim, e).length > 0, 'a rua com calçada tem blocos de zona');
  }
  assert.equal(sim.q.aresta(praia[0]).nome, 'Rua da Praia');
  // rodovia não se melhora nem se demole
  const rod = sim.json.mapa.rodovia[0];
  assert.equal(sim.cmd('via.melhorar', { arestas: [rod], tipo: 'avenida' }).codigo, 'rodovia');
  assert.equal(sim.cmd('via.demolir', { arestas: [rod] }).codigo, 'rodovia');
  assert.equal(sim.cmd('via.demolir', { arestas: [refDe(A.n + 5, 0)] }).codigo, 'inexistente');
  // desfazer a melhoria devolve tudo e a rua volta a ser de terra, sem células
  const d = sim.cmd('via.desfazer', { sessao: 3 });
  assert.ok(d.ok, JSON.stringify(d));
  assert.equal(sim.holding.caixa(), caixa0);
  for (const ref of praia) {
    assert.equal(VIAS_ORDEM[A.tipo[idxDaRef(ref)]], 'terra');
    assert.equal(celulasDaAresta(sim, idxDaRef(ref)).length, 0);
  }
  assert.deepEqual(formasForaDeDia(sim), []);
  assert.deepEqual(sim.validar(), []);
});

test('desfazer (D32): até 10 ações da sessão com reembolso integral; ocupado com prédio; demolir devolve 50% ou 100%', () => {
  const sim = novaSim('vias-desfazer');
  const A = sim.tabelas.arestas;
  const C = sim.tabelas.celulas;
  const caixa0 = sim.holding.caixa();
  const chao0 = hashChao(sim);
  const n0 = A.vivos;
  const c0 = C.vivos;
  const s = 11;
  const a = via(sim, 'rua', [[1200, -300], [1400, -300]], { sessao: s });
  const b = via(sim, 'rua', [[1248, -380], [1248, -220]], { sessao: s });
  assert.ok(a.r?.ok && b.r?.ok && b.p.divisoes === 1);
  assert.equal(sim.cmd('via.desfazer', { sessao: 99 }).codigo, 'nada', 'outra sessão não desfaz');
  assert.ok(sim.cmd('via.desfazer', { sessao: s }).ok);
  assert.ok(sim.cmd('via.desfazer', { sessao: s }).ok);
  assert.equal(sim.cmd('via.desfazer', { sessao: s }).codigo, 'nada');
  assert.equal(sim.holding.caixa(), caixa0, 'reembolso integral');
  assert.equal(A.vivos, n0);
  assert.equal(C.vivos, c0);
  assert.equal(hashChao(sim), chao0, 'o chão volta bit a bit (aplainar puro)');
  // só as 10 últimas ações
  for (let k = 0; k < 12; k++) assert.ok(via(sim, 'rua', [[1100 + k * 24, -150], [1100 + k * 24, -110]], { sessao: 12, encaixe: false }).r?.ok);
  let desfeitas = 0;
  while (sim.cmd('via.desfazer', { sessao: 12 }).ok) desfeitas++;
  assert.equal(desfeitas, REGRAS_VIAS.desfazerMax);
  // com prédio nascido nas células criadas: ocupado
  const c = via(sim, 'rua', [[1200, -250], [1400, -250]], { sessao: 13 });
  assert.ok(c.r?.ok);
  const e = criadas(c.r)[0];
  const lado = celulasDaAresta(sim, e).filter((x) => C.lado[x] === 1 && C.linha[x] < 2 && C.estado[x] === CELULA.LIVRE);
  const col = Math.min(...lado.map((x) => C.coluna[x]).filter((k) => lado.some((y) => C.coluna[y] === k + 1)));
  const planta = lado.filter((x) => C.coluna[x] === col || C.coluna[x] === col + 1);
  for (const x of planta) C.zona[x] = indiceZona('resBaixa');
  const i = crescerNaFrente(sim, planta, { modelo: 'casa' });
  assert.ok(i >= 0, 'casa sobre as células');
  assert.equal(sim.cmd('via.desfazer', { sessao: 13 }).codigo, 'ocupado');
  // demolir: a via da sessão devolve 100%; demolir e desfazer a demolição deixa o prédio ligado de novo
  const q = sim.q.aresta(refDe(e, A.ger[e]));
  const cheio = Math.round(A.arco[17 * e + 16] * VIAS.rua.custoM * (1 + 2 * decliveDa(sim, e)));
  assert.equal(q.devolve, cheio);
  const caixa1 = sim.holding.caixa();
  const dm = sim.cmd('via.demolir', { arestas: [refDe(e, A.ger[e])], sessao: 13 });
  assert.ok(dm.ok);
  assert.equal(sim.holding.caixa(), caixa1 + cheio);
  const P = sim.tabelas.predios;
  assert.ok(P.flags[i] & PREDIO.SEM_ACESSO, 'o prédio fica sem acesso');
  assert.ok(sim.cmd('via.desfazer', { sessao: 13 }).ok);
  assert.equal(sim.holding.caixa(), caixa1);
  assert.ok(!(P.flags[i] & PREDIO.SEM_ACESSO), 'a via volta e o prédio liga de novo');
  // fora da sessão, demolir devolve 50%
  const deC = new Set(criadas(c.r));
  const outra = vivas(sim).find((x) => VIAS_ORDEM[A.tipo[x]] === 'rua' && !A.flags[x] && !deC.has(x) && sim.q.aresta(refDe(x, A.ger[x])).devolve > 0);
  const q2 = sim.q.aresta(refDe(outra, A.ger[outra]));
  const custoOutra = Math.round(A.arco[17 * outra + 16] * VIAS.rua.custoM * (1 + 2 * decliveDa(sim, outra)));
  assert.equal(q2.devolve, Math.round(custoOutra * REGRAS_VIAS.devolucao));
  assert.deepEqual(formasForaDeDia(sim), []);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) }), []);
});

/** Casas 2 x 2 (linhas 0 e 1) nas células livres das arestas: quantas nasceram. */
function casasNasArestas(sim, es) {
  const C = sim.tabelas.celulas;
  let n = 0;
  for (const e of es) {
    for (const lado of [1, -1]) {
      const porCol = new Map();
      for (const c of celulasDaAresta(sim, e)) {
        if (C.lado[c] === lado && C.linha[c] < 2 && C.estado[c] === CELULA.LIVRE) porCol.set(C.coluna[c], [...(porCol.get(C.coluna[c]) ?? []), c]);
      }
      for (const k of [...porCol.keys()].sort((a, b) => a - b)) {
        const planta = [...(porCol.get(k) ?? []), ...(porCol.get(k + 1) ?? [])];
        if (planta.length !== 4 || planta.some((c) => C.predio[c] >= 0 || !C.zona[c])) continue;
        if (crescerNaFrente(sim, planta, { modelo: 'casa' }) >= 0) n++;
      }
    }
  }
  return n;
}

test('prévia igual à obra: a coluna que o nó novo corta, a grade encaixada em B, desfazer ocupado e argumentos estranhos', () => {
  const sim = novaSim('vias-previa-obra', 'livre');
  const C = sim.tabelas.celulas;
  const P = sim.tabelas.predios;
  const A = sim.tabelas.arestas;
  // avenida com casas dos dois lados; ruas cruzando a 70 e 110 graus: a prévia avisa toda casa que a obra derruba,
  // inclusive a da coluna de células que o nó novo corta (ela fica a mais de meia largura + 4 m da rua nova)
  const av = via(sim, 'avenida', [[1100, -300], [1400, -300]], { encaixe: false });
  assert.ok(av.r?.ok);
  sim.cmd('zona.pintar', { pincel: { modo: 'retangulo', x: 1080, z: -360, x2: 1420, z2: -240 }, zona: indiceZona('resBaixa') });
  assert.ok(casasNasArestas(sim, criadas(av.r)) >= 20, 'casas na avenida');
  let foraDaFaixa = 0;
  for (const [x, ang] of [[1140, 70], [1195, 70], [1228, 110], [1272, 110], [1305, 70], [1349, 110]]) {
    const a = (ang * Math.PI) / 180;
    const args = { modo: 'reta', tipo: 'rua', pontos: [[x, -360], [x + Math.cos(a) * 120, -360 + Math.sin(a) * 120]], encaixe: false, sessao: 21 };
    const pv = sim.q.via.previa(args);
    assert.ok(pv.ok, JSON.stringify(pv.erros));
    const avisadas = pv.demolir.predios.map((ref) => idxDaRef(ref));
    const longe = avisadas.filter((i) => {
      const cs = [];
      for (let c = 0; c < C.n; c++) if (C.viva[c] && C.predio[c] === i) cs.push(c);
      return cs.every((c) => Math.abs((C.x[c] - x) * Math.sin(a) - (C.z[c] + 360) * Math.cos(a)) >= VIAS.rua.largura / 2 + 4);
    });
    foraDaFaixa += longe.length;
    const v0 = P.vivos;
    const r = sim.cmd('via.construir', { plano: args });
    assert.ok(r.ok);
    assert.equal(v0 - P.vivos, avisadas.length, `rua em x ${x} a ${ang} graus: a obra derrubou ${v0 - P.vivos} e a prévia avisou ${avisadas.length}`);
    assert.equal(r.dados.demolidos, avisadas.length);
    assert.ok(sim.cmd('via.desfazer', { sessao: 21 }).ok);
  }
  assert.ok(foraDaFaixa > 0, 'algum cruzamento cortou a coluna de uma casa fora da faixa da rua nova');
  // grade: B encaixa como na reta (nó que existe, ângulo, múltiplo de 8 m) e C anda na perpendicular do AB encaixado
  const N = sim.tabelas.nos;
  let enc = encaixarTraco(sim, { modo: 'grade', tipo: 'rua', pontos: [[900, -400], [1097, -303], [1097, -190]] });
  const noB = enc.encaixes.find((x) => x.indice === 1 && x.tipo === 'no');
  assert.ok(noB && enc.ancoras[1]?.tipo === 'no' && N.x[enc.ancoras[1].no] === 1100, JSON.stringify(enc.encaixes));
  assert.ok(!enc.encaixes.some((x) => x.indice === 2), 'o canto C não recebe encaixe de B');
  enc = encaixarTraco(sim, { modo: 'grade', tipo: 'rua', pontos: [[-900, 300], [-702, 303], [-702, 420]] });
  assert.deepEqual(enc.pontos[1], [-700, 300]);
  assert.deepEqual(enc.pontos[2], [-700, 412]);
  // desfazer a melhoria recusa com prédio nascido nas células que ela criou (D32), e nada muda
  const vila = novaSim('vias-previa-obra-vila');
  const praia = vila.json.mapa.ruas.praia;
  const caixa0 = vila.holding.caixa();
  assert.ok(vila.cmd('via.melhorar', { arestas: praia, tipo: 'rua', sessao: 22 }).ok);
  const eP = praia.map((ref) => idxDaRef(ref));
  for (const e of eP) vila.cmd('zona.pintar', { pincel: { modo: 'celulas', celulas: celulasDaAresta(vila, e) }, zona: indiceZona('resBaixa') });
  assert.ok(casasNasArestas(vila, eP) >= 1, 'casa nas células da rua melhorada');
  const pagos = vila.holding.caixa();
  assert.equal(vila.cmd('via.desfazer', { sessao: 22 }).codigo, 'ocupado');
  assert.equal(vila.holding.caixa(), pagos);
  assert.ok(pagos < caixa0);
  for (const ref of praia) assert.equal(VIAS_ORDEM[vila.tabelas.arestas.tipo[idxDaRef(ref)]], 'rua');
  // desfazer a demolição recusa se nasceu prédio onde a via passava (ela voltaria por cima dele)
  const b = via(sim, 'rua', [[1100, -160], [1300, -160]], { encaixe: false, sessao: 23 });
  const a2 = via(sim, 'rua', [[1100, -120], [1300, -120]], { encaixe: false, sessao: 23 });
  assert.ok(b.r?.ok && a2.r?.ok);
  assert.ok(sim.cmd('via.demolir', { arestas: b.r.dados.arestas, sessao: 24 }).ok);
  const ea = criadas(a2.r)[0];
  const livres = celulasDaAresta(sim, ea).filter((c) => C.estado[c] === CELULA.LIVRE && C.z[c] < -120 && C.linha[c] <= 4);
  let alto = -1;
  for (const k of [...new Set(livres.map((c) => C.coluna[c]))].sort((x, y) => x - y)) {
    const planta = livres.filter((c) => C.coluna[c] === k || C.coluna[c] === k + 1);
    if (planta.length !== 10) continue;
    sim.cmd('zona.pintar', { pincel: { modo: 'celulas', celulas: planta }, zona: indiceZona('resMedia') });
    alto = crescerNaFrente(sim, planta, { modelo: 'predioBaixo' });
    if (alto >= 0) break;
  }
  assert.ok(alto >= 0, 'prédio na faixa da rua demolida');
  const nA = A.vivos;
  assert.equal(sim.cmd('via.desfazer', { sessao: 24 }).codigo, 'ocupado');
  assert.equal(A.vivos, nA);
  assert.ok(P.viva[alto]);
  // argumentos estranhos: nada de exceção, e a prévia recusa o mesmo que o comando (que chega pelo JSON do livro)
  const h = sim.hash();
  for (const tipo of ['toString', '__proto__', 'constructor']) {
    const p = sim.q.via.previa({ modo: 'reta', tipo, pontos: [[-600, 600], [-500, 600]] });
    assert.ok(Array.isArray(p.erros));
  }
  const comNaN = { modo: 'reta', tipo: 'rua', pontos: [[NaN, 0], [-500, -600]], sessao: 25 };
  assert.equal(sim.q.via.previa(comNaN).ok, false);
  assert.equal(sim.q.zona.previa(null).celulas.length, 0);
  assert.equal(sim.hash(), h, 'consultas não mudam o estado');
  const nA2 = A.vivos;
  assert.equal(sim.cmd('via.construir', { plano: comNaN }).ok, false, 'o NaN vira null no livro e não pode virar 0');
  assert.equal(A.vivos, nA2);
  assert.deepEqual(sim.erros, []);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(formasForaDeDia(sim), []);
});

// ------------------------------------------------------------------------------------------------ nomes e consultas

test('nomes, q.aresta e q.viasPerto: o nome passa para as metades, continua em linha reta e troca o prefixo', () => {
  const sim = novaSim('vias-nomes', 'livre');
  const A = sim.tabelas.arestas;
  const { r } = via(sim, 'rua', [[1200, -300], [1400, -300]]);
  const e0 = criadas(r)[0];
  const nome = sim.q.aresta(refDe(e0, A.ger[e0])).nome;
  assert.match(nome, /^Rua /);
  for (const e of criadas(r)) assert.equal(sim.q.aresta(refDe(e, A.ger[e])).nome, nome);
  // cruzar divide a rua: as metades ficam com o nome
  via(sim, 'rua', [[1248, -380], [1248, -220]]);
  const perto = sim.q.viasPerto(1230, -300, 20);
  assert.ok(perto.length >= 1 && perto.every((x, k) => k === 0 || x.d >= perto[k - 1].d) && perto.every((x) => x.d <= 20));
  assert.equal(sim.q.aresta(perto[0].ref).nome, nome);
  // continuar em linha reta a partir da ponta mantém o nome
  const cont = via(sim, 'rua', [[1400, -300], [1500, -300]]);
  assert.equal(sim.q.aresta(cont.r.dados.arestas[0]).nome, nome);
  // melhorar para avenida troca o prefixo
  const refs = vivas(sim).filter((e) => sim.q.aresta(refDe(e, A.ger[e])).nome === nome).map((e) => refDe(e, A.ger[e]));
  assert.ok(sim.cmd('via.melhorar', { arestas: refs, tipo: 'avenida' }).ok);
  assert.equal(sim.q.aresta(refs[0]).nome, nome.replace(/^Rua/, 'Avenida'));
  const q = sim.q.aresta(refs[0]);
  for (const k of ['ref', 'tipo', 'nome', 'comprimento', 'declive', 'mao', 'manutencaoHora', 'devolve', 'melhoraPara']) assert.ok(k in q, k);
  assert.equal(sim.q.aresta(refDe(A.n + 3, 0)), null);
});

// ------------------------------------------------------------------------------------------------ determinismo

test('prévia pura; duas partidas iguais dão o mesmo hash; save e carga no meio dão o mesmo fim', () => {
  const roteiro = [
    ['via.construir', { plano: { modo: 'reta', tipo: 'avenida', pontos: [[1100, -340], [1420, -340]], sessao: 1 } }],
    ['via.construir', { plano: { modo: 'grade', tipo: 'rua', pontos: [[1100, -300], [1324, -300], [1324, -76]], sessao: 1 } }],
    ['via.construir', { plano: { modo: 'curva', tipo: 'rua', pontos: [[1420, -340], [1510, -300], [1540, -180]], sessao: 1 } }],
    ['zona.pintar', { pincel: { modo: 'circulo', x: 1210, z: -250, raio: 60 }, zona: 1 }],
    ['via.demolir', { arestas: null, sessao: 1 }],
    ['via.desfazer', { sessao: 1 }],
    ['via.melhorar', { arestas: null, tipo: 'avenida', sessao: 1 }],
  ];
  const jogar = (sim, de = 0, ate = roteiro.length) => {
    const A = sim.tabelas.arestas;
    for (let k = de; k < ate; k++) {
      const [nome, args0] = roteiro[k];
      const args = structuredClone(args0);
      if (args.arestas === null) {
        // a última rua viva (mesma escolha nas duas partidas)
        const e = vivas(sim).filter((x) => VIAS_ORDEM[A.tipo[x]] === 'rua' && !A.flags[x]).pop();
        args.arestas = [refDe(e, A.ger[e])];
      }
      const r = sim.cmd(nome, args);
      assert.ok(r.ok, `${nome}: ${JSON.stringify(r)}`);
    }
  };
  const a = novaSim('vias-determinismo');
  const h0 = a.hash();
  for (const [, args] of roteiro.slice(0, 3)) a.q.via.previa(args.plano);
  a.q.zona.previa({ pincel: { modo: 'circulo', x: 0, z: 0, raio: 50 }, zona: 1 });
  assert.equal(a.hash(), h0, 'consultas não mudam o estado');
  jogar(a);
  const b = novaSim('vias-determinismo');
  jogar(b);
  assert.equal(a.hash(), b.hash());
  const c = novaSim('vias-determinismo');
  jogar(c, 0, 3);
  const d = novaSim('vias-determinismo');
  aplicarSave(d, lerSave(montarSave(c)));
  assert.equal(d.hash(), c.hash());
  jogar(d, 3);
  assert.equal(d.hash(), a.hash(), 'save e carga no meio');
  assert.equal(hashChao(d), hashChao(a));
  for (const s of [a, d]) {
    assert.deepEqual(s.erros, []);
    assert.deepEqual(s.validar(), []);
    assert.deepEqual(conferirEspelho(s.espelho, { alturaEm: (x, z) => s.alturaEm(x, z) }), []);
    assert.deepEqual(formasForaDeDia(s), []);
  }
});

// ------------------------------------------------------------------------------------------------ chão sob a pista

test('chão ao menos 5 cm abaixo da pista em toda a seção: vias do mapa, rampas, cruzamentos em vários ângulos, curvas', () => {
  const sim = novaSim('vias-chao', 'livre');
  const feitas = [];
  const fazer = (tipo, pontos, extra = {}) => {
    const { p, r } = via(sim, tipo, pontos, extra);
    if (r?.ok) feitas.push(...criadas(r));
    return p.ok;
  };
  // rampa no pé do morro e travessas: a 90 graus e oblíqua
  assert.ok(fazer('rua', [[-800, -520], [-800, -700]]));
  assert.ok(fazer('rua', [[-880, -560], [-700, -620]]));
  fazer('rua', [[-480, -600], [-360, -610]]);
  // na planície do leste e no bolsão plano do nordeste (fora do disco da sede, D90): cruzamentos a 90, 60, 45 e 30
  // graus, avenida, curvas e pontas soltas
  assert.ok(fazer('avenida', [[1080, -260], [1480, -260]]));
  assert.ok(fazer('rua', [[1160, -360], [1160, -110]], { encaixe: false }));
  assert.ok(fazer('rua', [[1240, -380], [1240 + 140, -380 + 242]], { encaixe: false }));
  assert.ok(fazer('rua', [[1320, -360], [1320 + 150, -360 + 150]], { encaixe: false }));
  fazer('rua', [[1360, -340], [1360 + 190, -340 + 110]], { encaixe: false });
  assert.ok(fazer('rua', [[1080, -110], [1160, -80], [1210, 0]], { modo: 'curva', encaixe: false }));
  assert.ok(fazer('rua', [[900, -800], [1010, -760], [1030, -650]], { modo: 'curva', encaixe: false }));
  assert.ok(fazer('rua', [[700, -700], [700 + 16, -700 + 112], [700 + 112, -700 + 112]], { modo: 'grade' }));
  assert.ok(feitas.length >= 20, `${feitas.length} arestas`);
  assert.deepEqual(formasForaDeDia(sim), [], 'toda forma registrada é a de agora');
  // vias novas: o chão fica abaixo da pista menos 5 cm e a seção não afunda
  const novas = folgaDoChao(sim, feitas);
  assert.ok(novas.acima <= -FOLGA_CHAO, `chão ${novas.acima.toFixed(3)} m em ${JSON.stringify(novas.onde)}`);
  assert.ok(novas.abaixo >= -CHAO_ABAIXO_DA_PISTA - 0.4, `chão ${novas.abaixo.toFixed(3)} m em ${JSON.stringify(novas.ondeAbaixo)}`);
  // todas as vias da partida, as do mapa inclusive (Vila e rodovia)
  const todas = folgaDoChao(sim);
  console.log(`# ${feitas.length} arestas novas: chão de ${(-novas.acima).toFixed(3)} a ${(-novas.abaixo).toFixed(3)} m abaixo da pista`);
  console.log(`# todas as ${vivas(sim).length} arestas: chão de ${(-todas.acima).toFixed(3)} a ${(-todas.abaixo).toFixed(3)} m abaixo da pista`);
  assert.ok(todas.acima <= -FOLGA_CHAO, `chão ${todas.acima.toFixed(3)} m em ${JSON.stringify(todas.onde)}`);
  assert.ok(todas.abaixo >= -CHAO_ABAIXO_DA_PISTA - 0.6, `chão ${todas.abaixo.toFixed(3)} m em ${JSON.stringify(todas.ondeAbaixo)}`);
  // faixa plana de 8 m: as amostras da grade até 8 m além da pista de uma via reta isolada têm a cota dela
  const iso = via(sim, 'rua', [[900, -880], [1160, -880]], { encaixe: false });
  assert.ok(iso.r?.ok);
  const T = sim.espelho.terreno;
  let conferidas = 0;
  for (const e of criadas(iso.r)) {
    for (let x = -4096; x <= 4096; x += 8) {
      if (x < 940 || x > 1120) continue;
      for (const dz of [-16, -8, 0, 8, 16]) {
        const z = -880 + dz;
        const i = (x + 4096) / 8;
        const j = (z + 4096) / 8;
        const A = sim.tabelas.arestas;
        const s = x - A.p[8 * e];
        if (s < 0 || s > A.arco[17 * e + 16]) continue;
        const alvo = pistaDaAresta(sim.grafo, e, s) - CHAO_ABAIXO_DA_PISTA;
        assert.ok(Math.abs(T.altura[j * T.n + i] - alvo) < 2e-3, `amostra (${x}, ${z}): ${T.altura[j * T.n + i]} x ${alvo}`);
        conferidas++;
      }
    }
  }
  assert.ok(conferidas > 50);
  // demolir tudo o que foi feito devolve o chão da partida bit a bit
  const limpo = novaSim('vias-chao', 'livre');
  const A = sim.tabelas.arestas;
  const M = sim.json.mapa;
  const doMapa = new Set([...Object.values(M.ruas).flat(), ...M.rodovia, ...M.acesso]);
  const minhas = vivas(sim).filter((e) => !doMapa.has(refDe(e, A.ger[e])));
  assert.ok(sim.cmd('via.demolir', { arestas: minhas.map((e) => refDe(e, A.ger[e])) }).ok);
  assert.equal(hashChao(sim), hashChao(limpo));
});
