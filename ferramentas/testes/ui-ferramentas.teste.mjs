// Testes da X2 (ferramentas de construção), sem navegador: as máquinas de estado puras com sequências de ponteiros
// (via: mirar A, atalho, alças, curva pela alça do meio, Reta que endireita, Contínua, Grade, Melhorar, cancelar, mouse;
// zonas: Preencher, Pincel, Retângulo, Apagar; colocar; demolir; Áreas), o encaixe e o planejador substitutos, o
// pincel substituto, a pilha do Desfazer, a rolagem pela borda, o catálogo da bandeja, a cola da sessão com uma
// simulação e um render de mentira (prévia, construir com o id, desfazer pela sessão, zona desfeita pela zona antiga),
// a geometria das sobreposições do render e os textos, glifos e CSS da parcela.
// Roda sozinho: node ferramentas/testes/ui-ferramentas.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as via from '../../fonte/ui/ferramentas/via.js';
import * as zona from '../../fonte/ui/ferramentas/zona.js';
import * as colocar from '../../fonte/ui/ferramentas/colocar.js';
import * as demolir from '../../fonte/ui/ferramentas/demolir.js';
import * as areas from '../../fonte/ui/ferramentas/areas.js';
import * as sessao from '../../fonte/ui/ferramentas/sessao.js';
import * as loja from '../../fonte/ui/loja.js';
import { t, temTexto, chavesRepetidas } from '../../fonte/ui/textos.js';
import * as fmt from '../../fonte/ui/formato.js';
import { ligarAcoes, comando, frase } from '../../fonte/ui/acoes.js';
import { ligarConsultas, consultar } from '../../fonte/ui/consultas.js';
import { glifo } from '../../fonte/ui/glifos/glifos.js';
import { deQuadratica, ponto as pontoBz, reta } from '../../fonte/comum/bezier.js';
import { VIAS, VIAS_ORDEM } from '../../fonte/data/vias.js';
import { ZONAS_ORDEM } from '../../fonte/data/zonas.js';
import { CELULA, LADRILHO, ARESTA, TIPO_PREDIO, AGUA } from '../../fonte/contratos/flags.js';
import { LISTA_CODIGOS } from '../../fonte/contratos/codigos.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8');
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const pertoP = (p, q, tol = 1e-6) => perto(p[0], q[0], tol) && perto(p[1], q[1], tol);

// câmera de mentira para as alças: 1 px = 1 m, sem giro
const amb = { projetar: (p) => [p[0], p[1]] };
const ev = (tipo, x, z, t = 0, extra = {}) => ({ tipo, ponto: [x, z], tela: [x, z], dedo: [x, z + 56], t, ...extra });
const efeitos = (e) => e.efeitos.map(via.nomeEfeito);

// ------------------------------------------------------------------------------------------------ mundo de teste

/** Espelho mínimo: tabelas com as colunas da 2.4 (nós, arestas, células, prédios), ladrilhos e sem terreno. */
function espelhoTeste() {
  const cap = 64;
  const nos = { n: 0, cap, viva: new Uint8Array(cap), ger: new Uint16Array(cap), x: new Float64Array(cap), y: new Float64Array(cap), z: new Float64Array(cap), grau: new Uint8Array(cap), raio: new Float32Array(cap) };
  const arestas = { n: 0, cap, viva: new Uint8Array(cap), ger: new Uint16Array(cap), a: new Int32Array(cap).fill(-1), b: new Int32Array(cap).fill(-1), tipo: new Uint8Array(cap), p: new Float64Array(8 * cap), y: new Float32Array(2 * cap), comp: new Float32Array(cap), corte: new Float32Array(2 * cap), mao: new Int8Array(cap), flags: new Uint16Array(cap), idade: new Uint32Array(cap) };
  const ladrilhos = { n: 16, estado: new Uint8Array(256), preco: new Float64Array(256) };
  for (let j = 6; j <= 9; j++) for (let i = 6; i <= 9; i++) ladrilhos.estado[j * 16 + i] = LADRILHO.HOLDING;
  ladrilhos.estado[7 * 16 + 10] = LADRILHO.COMPRAVEL;
  ladrilhos.preco[7 * 16 + 10] = 46000;
  const esp = { mapa: { origem: [-4096, -4096], tam: 8192 }, terreno: null, ladrilhos, vias: { nos, arestas }, celulas: null, predios: null, partida: { modo: 'normal' } };
  const no = (x, z) => {
    const i = nos.n++;
    nos.viva[i] = 1;
    nos.x[i] = x;
    nos.z[i] = z;
    return i;
  };
  const aresta = (a, b, tipo = 'rua', flags = 0) => {
    const e = arestas.n++;
    arestas.viva[e] = 1;
    arestas.a[e] = a;
    arestas.b[e] = b;
    arestas.tipo[e] = VIAS_ORDEM.indexOf(tipo);
    arestas.p.set(reta(nos.x[a], nos.z[a], nos.x[b], nos.z[b]), 8 * e);
    arestas.comp[e] = Math.hypot(nos.x[b] - nos.x[a], nos.z[b] - nos.z[a]);
    arestas.corte[2 * e + 1] = 1;
    arestas.flags[e] = flags;
    nos.grau[a]++;
    nos.grau[b]++;
    return e;
  };
  return { esp, no, aresta };
}

/** Células de 8 m dos dois lados de uma aresta leste-oeste (6 linhas), como a S1b faz. */
function celulasTeste(esp, e, colunas = 8) {
  const A = esp.vias.arestas;
  const cap = 512;
  const C = esp.celulas ?? (esp.celulas = { n: 0, cap, viva: new Uint8Array(cap), x: new Float32Array(cap), z: new Float32Array(cap), y: new Float32Array(cap), ang: new Float32Array(cap), zona: new Uint8Array(cap), estado: new Uint8Array(cap), predio: new Int32Array(cap).fill(-1), aresta: new Int32Array(cap).fill(-1), lado: new Int8Array(cap), linha: new Uint8Array(cap), coluna: new Uint16Array(cap) });
  const x0 = A.p[8 * e] + 16;
  const z = A.p[8 * e + 1];
  for (const lado of [1, -1]) {
    for (let col = 0; col < colunas; col++) {
      for (let r = 0; r < 6; r++) {
        const c = C.n++;
        C.viva[c] = 1;
        C.x[c] = x0 + 4 + 8 * col;
        C.z[c] = z + lado * (12 + 8 * r);
        C.ang[c] = lado > 0 ? Math.PI : 0;
        C.aresta[c] = e;
        C.lado[c] = lado;
        C.linha[c] = r;
        C.coluna[c] = col;
      }
    }
  }
  return C;
}

// ------------------------------------------------------------------------------------------------ via: máquina

test('via: mirar A com o dedo parado, soltar, tocar e arrastar até B, soltar dá a prévia', () => {
  let e = via.criarVia();
  e = via.passoVia(e, ev('inicio', 0, 0, 0), amb);
  assert.equal(e.fase, 'mirandoA');
  assert.deepEqual(efeitos(e), ['previa']);
  // parado mais de 220 ms: mexer ajusta A (mira com a lupa), não é o atalho
  e = via.passoVia(e, ev('move', 3, 2, 400), amb);
  assert.equal(e.fase, 'mirandoA');
  assert.deepEqual(e.a, [3, 2]);
  e = via.passoVia(e, ev('fim', 3, 2, 500), amb);
  assert.equal(e.fase, 'aFixo');
  e = via.passoVia(e, ev('inicio', 60, 0, 900), amb);
  assert.equal(e.fase, 'mirandoB');
  e = via.passoVia(e, ev('move', 120, 0, 950), amb);
  e = via.passoVia(e, ev('fim', 120, 0, 1000), amb);
  assert.equal(e.fase, 'previa');
  assert.deepEqual(e.b, [120, 0]);
  const args = via.argsPrevia(e, { tolerancia: 10, sessao: 3 });
  assert.equal(args.modo, 'reta');
  assert.deepEqual(args.pontos, [[3, 2], [120, 0]]);
  assert.equal(args.sessao, 3);
  assert.equal(args.encaixe, true);
  assert.equal(via.argsPrevia(e, { semEncaixe: true }).encaixe, false);
});

test('via: o atalho (arrastar logo depois de tocar) faz A e B num gesto só', () => {
  let e = via.criarVia();
  e = via.passoVia(e, ev('inicio', 0, 0, 0), amb);
  e = via.passoVia(e, ev('move', 40, 0, 90), amb);
  assert.equal(e.fase, 'mirandoB');
  assert.deepEqual(e.a, [0, 0]);
  e = via.passoVia(e, ev('move', 150, 10, 200), amb);
  e = via.passoVia(e, ev('fim', 150, 10, 260), amb);
  assert.equal(e.fase, 'previa');
  assert.deepEqual(e.b, [150, 10]);
});

test('via: soltar B perto demais de A volta a esperar o fim', () => {
  let e = via.criarVia();
  e = via.passoVia(e, ev('inicio', 0, 0, 0), amb);
  e = via.passoVia(e, ev('fim', 0, 0, 300), amb);
  e = via.passoVia(e, ev('inicio', 4, 0, 500), amb);
  e = via.passoVia(e, ev('fim', 4, 0, 600), amb);
  assert.equal(e.fase, 'aFixo');
  assert.equal(e.b, null);
});

function previaReta(a = [0, 0], b = [200, 0], op = {}) {
  let e = via.criarVia(op);
  e = via.passoVia(e, ev('inicio', a[0], a[1], 0), amb);
  e = via.passoVia(e, ev('fim', a[0], a[1], 300), amb);
  e = via.passoVia(e, ev('inicio', b[0], b[1], 600), amb);
  e = via.passoVia(e, ev('fim', b[0], b[1], 700), amb);
  return e;
}

test('via: arrastar a alça do meio curva a via; a curva passa pela alça', () => {
  let e = previaReta();
  const alcas = via.alcas(e).map((h) => h.id);
  assert.deepEqual(alcas, ['a', 'b', 'meio']);
  // pega a alça do meio pelo dedo (o toque cai nela) e arrasta para o sul
  e = via.passoVia(e, { tipo: 'inicio', ponto: [100, -56], tela: [100, -56], dedo: [100, 0], t: 1000 }, amb);
  assert.equal(e.fase, 'arrastando');
  assert.equal(e.alca, 'meio');
  e = via.passoVia(e, { tipo: 'move', ponto: [100, -16], tela: [100, -16], dedo: [100, 40], t: 1100 }, amb);
  e = via.passoVia(e, { tipo: 'fim', ponto: [100, -16], tela: [100, -16], dedo: [100, 40], t: 1200 }, amb);
  assert.equal(e.fase, 'previa');
  assert.ok(pertoP(e.meio, [100, 40]), `alça em ${e.meio}`); // sem salto: a alça anda com o dedo
  const args = via.argsPrevia(e);
  assert.equal(args.modo, 'curva');
  const [a, c, b] = args.pontos;
  const p = deQuadratica(a[0], a[1], c[0], c[1], b[0], b[1]);
  assert.ok(pertoP(pontoBz(p, 0.5, [0, 0]), e.meio, 1e-9));
  assert.ok(pertoP(via.alcaDoControle(a, c, b), e.meio, 1e-9));
});

test('via: na Reta, um toque na alça do meio endireita; na Curva, não', () => {
  let e = previaReta();
  e = { ...e, meio: [100, 30] };
  const toque = (m) => {
    let x = via.passoVia(m, { tipo: 'inicio', ponto: [100, 30], tela: [100, 30], dedo: [100, 86], t: 2000 }, amb);
    return via.passoVia(x, { tipo: 'fim', ponto: [100, 30], tela: [100, 30], dedo: [100, 86], t: 2080 }, amb);
  };
  assert.equal(toque(e).meio, null);
  const curva = { ...e, modo: 'curva' };
  assert.deepEqual(toque(curva).meio, [100, 30]);
});

test('via: tocar fora das alças na prévia leva B até ali', () => {
  let e = previaReta();
  e = via.passoVia(e, ev('inicio', 150, 120, 3000), amb);
  assert.equal(e.alca, 'b');
  e = via.passoVia(e, ev('fim', 150, 120, 3050), amb);
  assert.equal(e.fase, 'previa');
  assert.deepEqual(e.b, [150, 120]);
});

test('via: arrastar a alça de A move A sem salto', () => {
  let e = previaReta();
  e = via.passoVia(e, { tipo: 'inicio', ponto: [2, -50], tela: [2, -50], dedo: [2, 6], t: 0 }, amb);
  assert.equal(e.alca, 'a');
  e = via.passoVia(e, { tipo: 'move', ponto: [22, -40], tela: [22, -40], dedo: [22, 16], t: 50 }, amb);
  e = via.passoVia(e, { tipo: 'fim', ponto: [22, -40], tela: [22, -40], dedo: [22, 16], t: 90 }, amb);
  assert.ok(pertoP(e.a, [20, 10]), `A em ${e.a}`);
});

test('via: Construir com a Contínua liga: B vira A com a tangente; sem ela, volta ao ocioso', () => {
  let e = previaReta([0, 0], [100, 0], { continua: true });
  e = via.passoVia(e, { tipo: 'construido', fim: [100, 0], tangente: [1, 0] }, amb);
  assert.equal(e.fase, 'aFixo');
  assert.deepEqual(e.a, [100, 0]);
  assert.deepEqual(e.tangente, [1, 0]);
  e = via.passoVia(e, ev('inicio', 180, 60, 5000), amb);
  e = via.passoVia(e, ev('fim', 180, 60, 5100), amb);
  const args = via.argsPrevia(e);
  assert.equal(args.modo, 'continua');
  assert.deepEqual(args.tangente, [1, 0]);
  const c = args.pontos[1];
  assert.ok(perto(c[1], 0, 1e-9) && c[0] > 100, `controle na tangente: ${c}`);
  let s = previaReta();
  s = via.passoVia(s, { tipo: 'construido', fim: [200, 0], tangente: [1, 0] }, amb);
  assert.equal(s.fase, 'ocioso');
  assert.deepEqual(efeitos(s), ['limpar']);
});

test('via: Cancelar volta ao ocioso; no ocioso, sai da ferramenta', () => {
  let e = previaReta();
  e = via.passoVia(e, { tipo: 'cancelar' }, amb);
  assert.equal(e.fase, 'ocioso');
  assert.equal(e.a, null);
  assert.deepEqual(efeitos(e), ['limpar']);
  e = via.passoVia(e, { tipo: 'cancelar' }, amb);
  assert.deepEqual(efeitos(e), ['sair']);
});

test('via: mouse clica em A, a prévia segue o cursor, clica em B', () => {
  let e = via.criarVia();
  e = via.passoVia(e, { tipo: 'hover', ponto: [0, 0], tela: [0, 0] }, amb);
  assert.equal(e.fase, 'ocioso');
  e = via.passoVia(e, { tipo: 'inicio', ponto: [0, 0], tela: [0, 0], dedo: [0, 0], t: 0 }, amb);
  e = via.passoVia(e, { tipo: 'fim', ponto: [0, 0], tela: [0, 0], dedo: [0, 0], t: 80 }, amb);
  e = via.passoVia(e, { tipo: 'hover', ponto: [90, 5], tela: [90, 5] }, amb);
  assert.equal(e.fase, 'aFixo');
  assert.deepEqual(e.b, [90, 5]);
  assert.ok(via.argsPrevia(e)); // a prévia já desenha
  e = via.passoVia(e, { tipo: 'inicio', ponto: [96, 5], tela: [96, 5], dedo: [96, 5], t: 900 }, amb);
  e = via.passoVia(e, { tipo: 'fim', ponto: [96, 5], tela: [96, 5], dedo: [96, 5], t: 960 }, amb);
  assert.equal(e.fase, 'previa');
  assert.deepEqual(e.b, [96, 5]);
});

test('via: Grade abre com duas quadras e a alça do fundo em múltiplos do espaçamento', () => {
  let e = previaReta([0, 0], [224, 0], { modo: 'grade' });
  assert.deepEqual(via.alcas(e).map((h) => h.id), ['a', 'b', 'fundo']);
  let args = via.argsPrevia(e);
  assert.equal(args.modo, 'grade');
  assert.equal(args.espacamento, 112);
  assert.deepEqual(args.pontos[2].map((v) => Math.round(v)), [224, 224]);
  e = { ...e, fundo: [224, -300] };
  args = via.argsPrevia(e);
  assert.deepEqual(args.pontos[2].map((v) => Math.round(v)), [224, -336]);
  const ruas = via.ruasDaGrade([0, 0], [224, 0], [224, 224], 'rua');
  assert.equal(ruas.length, 3 + 3); // 3 paralelas e 3 transversais (0, 112 e 224)
  assert.equal(via.espacamentoGrade('avenida'), 120);
});

test('via: trocar Reta e Curva mantém o traçado; Grade e Melhorar recomeçam', () => {
  let e = previaReta();
  e = via.passoVia(e, { tipo: 'opcao', modo: 'curva' }, amb);
  assert.equal(e.fase, 'previa');
  e = via.passoVia(e, { tipo: 'opcao', modo: 'grade' }, amb);
  assert.equal(e.fase, 'ocioso');
  e = via.passoVia(e, { tipo: 'opcao', tipoVia: 'avenida' }, amb);
  assert.equal(e.tipo, 'avenida');
  e = via.passoVia(e, { tipo: 'opcao', tipoVia: 'rodovia' }, amb);
  assert.equal(e.tipo, 'avenida'); // a rodovia é do mapa
});

test('via: Melhorar escolhe arestas por toque (alterna) e por arrasto (só soma)', () => {
  let e = via.criarVia({ modo: 'melhorar', tipo: 'avenida' });
  e = via.passoVia(e, ev('inicio', 10, 0), amb);
  assert.equal(e.efeitos[0].efeito, 'escolher');
  assert.equal(e.efeitos[0].somar, false);
  e = via.passoVia(e, { tipo: 'aresta', ref: 7, somar: false }, amb);
  e = via.passoVia(e, { tipo: 'aresta', ref: 9, somar: true }, amb);
  e = via.passoVia(e, { tipo: 'aresta', ref: 9, somar: true }, amb);
  assert.deepEqual(e.selecao, [7, 9]);
  e = via.passoVia(e, { tipo: 'aresta', ref: 7, somar: false }, amb);
  assert.deepEqual(e.selecao, [9]);
  e = via.passoVia(e, { tipo: 'cancelar' }, amb);
  assert.deepEqual(e.selecao, []);
});

test('via: prévia do Melhorar pelo tipo de cada aresta (terra vira rua; rodovia e Arcologia recusam)', () => {
  const { esp, no, aresta } = espelhoTeste();
  const e0 = aresta(no(0, 0), no(100, 0), 'terra');
  const e1 = aresta(no(0, 50), no(100, 50), 'rodovia');
  const e2 = aresta(no(0, 90), no(100, 90), 'rua', ARESTA.ARCOLOGIA);
  const r = via.previaMelhorar(esp, [e0, e1, e2], 'rua');
  assert.deepEqual(r.arestas.map((a) => a.codigo), [null, 'rodovia', 'arcologia']);
  assert.equal(r.ok, true);
  assert.equal(r.comprimento, 100);
  assert.equal(r.custo, 100 * VIAS.rua.custoM);
  assert.equal(via.previaMelhorar(esp, [e0], 'avenida').ok, false); // terra só melhora para rua
});

// ------------------------------------------------------------------------------------------------ encaixe e plano

test('encaixe substituto: nó, ponto sobre aresta, 90 graus, prolongamento, comprimento de 8 m e quadra', () => {
  const { esp, no, aresta } = espelhoTeste();
  const a = no(0, 0);
  const b = no(112, 0);
  aresta(a, b, 'rua');
  let r = via.encaixarLocal(esp, [110, 3], { tol: 8 });
  assert.equal(r.encaixes[0].tipo, 'no');
  assert.deepEqual(r.ponto, [112, 0]);
  r = via.encaixarLocal(esp, [50, 9], { tol: 8 }); // meia largura 8 + 1 m: em cima da via
  assert.equal(r.encaixes[0].tipo, 'aresta');
  assert.ok(pertoP(r.ponto, [50, 0], 1e-3));
  // saindo da ponta b: prolongamento para o leste e 90 graus para o sul
  const ref = [1, 0];
  r = via.encaixarLocal(esp, [213, 2], { tol: 8, de: [112, 0], ref });
  assert.equal(r.encaixes[0].tipo, 'prolongamento');
  assert.ok(perto(r.ponto[1], 0, 1e-9));
  assert.equal(Math.round(r.ponto[0] - 112) % 8, 0);
  r = via.encaixarLocal(esp, [114, 97], { tol: 8, de: [112, 0], ref });
  assert.equal(r.encaixes[0].tipo, 'angulo');
  assert.equal(r.encaixes[0].valor, 90);
  assert.equal(r.encaixes.at(-1).tipo, 'comprimento');
  assert.equal(r.encaixes.at(-1).valor % 8, 0);
  // quadra: a paralela a 112 m da rua (8 + 48 + 48 + 8)
  r = via.encaixarLocal(esp, [60, 108], { tol: 8, de: [-40, 106], tipo: 'rua' });
  const q = r.encaixes.find((x) => x.tipo === 'quadra');
  assert.ok(q, JSON.stringify(r.encaixes));
  assert.ok(perto(r.ponto[1], 112, 1e-6));
});

test('planejador substituto: custo, manutenção, curto, fora das áreas, água, declive e raio', () => {
  const { esp } = espelhoTeste();
  let r = via.planejarLocal({ modo: 'reta', tipo: 'rua', pontos: [[0, 0], [200, 0]], encaixe: false }, esp);
  assert.equal(r.ok, true);
  assert.equal(r.segmentos.length, 1);
  assert.equal(r.comprimento, 200);
  assert.equal(r.custo, 200 * VIAS.rua.custoM);
  assert.equal(r.manutencaoHora, Math.round(0.2 * VIAS.rua.manutKmH));
  assert.ok(r.substituto);
  r = via.planejarLocal({ modo: 'reta', tipo: 'rua', pontos: [[0, 0], [10, 0]], encaixe: false }, esp);
  assert.deepEqual(r.erros.map((x) => x.codigo), ['curto']);
  r = via.planejarLocal({ modo: 'reta', tipo: 'rua', pontos: [[900, 0], [1200, 0]], encaixe: false }, esp);
  assert.ok(r.erros.some((x) => x.codigo === 'ladrilho'));
  // terreno: rampa de 20% a leste de x = 100 e água ao sul de z = 300
  const n = 1025;
  const T = { n, passo: 8, origem: [-4096, -4096], altura: new Float32Array(n * n), agua: new Uint8Array(n * n) };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -4096 + 8 * i;
    const z = -4096 + 8 * j;
    T.altura[j * n + i] = x > 100 ? (x - 100) * 0.2 : 0;
    if (z > 300) T.agua[j * n + i] = AGUA.MAR;
  }
  const e2 = { ...esp, terreno: T };
  r = via.planejarLocal({ modo: 'reta', tipo: 'avenida', pontos: [[100, 0], [300, 0]], encaixe: false }, e2);
  assert.ok(r.erros.some((x) => x.codigo === 'declive'));
  assert.ok(r.custo > 200 * VIAS.avenida.custoM * 1.3); // declive encarece
  r = via.planejarLocal({ modo: 'reta', tipo: 'rua', pontos: [[-100, 200], [-100, 400]], encaixe: false }, e2);
  assert.ok(r.erros.some((x) => x.codigo === 'agua'));
  r = via.planejarLocal({ modo: 'curva', tipo: 'avenidaG', pontos: [[0, 0], [30, 0], [30, 30]], encaixe: false }, esp);
  assert.ok(r.erros.some((x) => x.codigo === 'raio'));
});

test('planejador substituto: encaixa as pontas nos nós e a Grade gera as ruas', () => {
  const { esp, no, aresta } = espelhoTeste();
  aresta(no(0, 0), no(112, 0));
  let r = via.planejarLocal({ modo: 'reta', tipo: 'rua', pontos: [[3, 2], [112 + 2, 150]], tolerancia: 8 }, esp);
  assert.deepEqual(r.segmentos[0].p.slice(0, 2), [0, 0]);
  assert.ok(r.encaixes.some((x) => x.tipo === 'no'));
  r = via.planejarLocal({ modo: 'grade', tipo: 'rua', pontos: [[0, 200], [224, 200], [224, 424]], encaixe: false }, esp);
  assert.equal(r.segmentos.length, 6);
  assert.equal(r.comprimento, 6 * 224);
  const fim = via.fimDoPlano({ segmentos: [{ p: Array.from(deQuadratica(0, 0, 50, 0, 100, 50)) }] });
  assert.deepEqual(fim.fim, [100, 50]);
  assert.ok(fim.tangente[1] > 0.5);
});

// ------------------------------------------------------------------------------------------------ zonas

test('zona: Preencher pinta a quadra no toque; Pincel pinta pelo caminho; Retângulo normaliza; Apagar é a zona 0', () => {
  let e = zona.criarZona({ zona: 'comBaixa' });
  e = zona.passoZona(e, ev('inicio', 10, 20));
  e = zona.passoZona(e, ev('fim', 10, 20));
  const pint = e.efeitos.filter((x) => x.efeito === 'pintar');
  assert.equal(pint.length, 1);
  assert.deepEqual(pint[0].pincel, { modo: 'quadra', x: 10, z: 20 });
  assert.equal(zona.zonaAplicada(e), ZONAS_ORDEM.indexOf('comBaixa'));
  assert.ok(e.efeitos.some((x) => x.efeito === 'fimTraco'));

  e = zona.passoZona(e, { tipo: 'opcao', modo: 'pincel', tamanho: 'G' });
  assert.equal(zona.raioPincel(e), 32);
  e = zona.passoZona(e, ev('inicio', 0, 0));
  assert.equal(e.efeitos.filter((x) => x.efeito === 'pintar').length, 1);
  e = zona.passoZona(e, ev('move', 64, 0));
  const passos = e.efeitos.filter((x) => x.efeito === 'pintar');
  assert.equal(passos.length, 4); // a cada meio raio (16 m) pelo caminho
  assert.ok(passos.every((x) => x.traco === e.traco));
  e = zona.passoZona(e, ev('fim', 64, 0));

  e = zona.passoZona(e, { tipo: 'opcao', modo: 'retangulo' });
  e = zona.passoZona(e, ev('inicio', 50, 40));
  e = zona.passoZona(e, ev('move', 10, 0));
  e = zona.passoZona(e, ev('fim', 10, 0));
  assert.deepEqual(e.efeitos.find((x) => x.efeito === 'pintar').pincel, { modo: 'retangulo', x: 10, z: 0, x2: 50, z2: 40 });

  e = zona.passoZona(e, { tipo: 'opcao', apagar: true });
  assert.equal(zona.zonaAplicada(e), 0);
  e = zona.passoZona(e, { tipo: 'opcao', zona: 'industria' });
  assert.equal(e.apagar, false);
  assert.deepEqual(zona.zonasDaParte(), ['resBaixa', 'resMedia', 'comBaixa', 'industria']);
});

test('zona: pincel substituto pega as células que mudam; a quadra é o bloco da célula mais perto', () => {
  const { esp, no, aresta } = espelhoTeste();
  const e0 = aresta(no(0, 0), no(96, 0));
  const C = celulasTeste(esp, e0, 8);
  C.zona[0] = 1;
  C.estado[1] = CELULA.OCUPADA;
  C.zona[1] = 4;
  C.estado[2] = CELULA.INVALIDA;
  let r = zona.previaZonaLocal(esp, { modo: 'circulo', x: 20, z: 12, raio: 8 }, 1);
  assert.ok(r.celulas.length > 0);
  assert.ok(![...r.celulas].includes(0)); // já é da zona 1
  assert.ok(![...r.celulas].includes(2)); // inválida
  r = zona.previaZonaLocal(esp, { modo: 'quadra', x: 30, z: 30 }, 4);
  assert.equal(r.celulas.length, 8 * 6 - 2); // o bloco do lado sul, só as livres que mudam (sem a ocupada e a inválida)
  assert.ok([...r.celulas].every((c) => C.lado[c] === 1));
  const g = zona.zonasAntigas(esp, [0, 1, 3]);
  assert.deepEqual([...g.keys()].sort(), [0, 1, 4]);
});

// ------------------------------------------------------------------------------------------------ colocar, demolir, áreas

test('colocar: Girar vira 90 graus e o substituto gruda a planta na frente da via, virada para ela', () => {
  let e = colocar.criarColocar({ tipo: 'clinica', item: { tipo: 'clinica', pegada: [24, 32], custo: 25000 } });
  e = colocar.passoColocar(e, ev('move', 10, 30));
  assert.deepEqual(e.efeitos[0], { efeito: 'previa', x: 10, z: 30, rot: 0, giro: 0, alinhar: true });
  e = colocar.passoColocar(e, { tipo: 'girar', sentido: 1 });
  assert.ok(perto(e.rot, Math.PI / 2));
  e = colocar.passoColocar(e, { tipo: 'girar', sentido: -1 });
  assert.ok(perto(e.rot, 0));
  const { esp, no, aresta } = espelhoTeste();
  aresta(no(-100, 0), no(100, 0), 'rua');
  const r = colocar.previaColocarLocal(esp, { tipo: 'clinica', x: 10, z: 30, rot: 0 }, { pegada: [24, 32], custo: 25000 });
  assert.equal(r.ok, true);
  assert.ok(perto(r.z, 8 + 16 + 1, 1e-3), `z ${r.z}`); // meia largura + meio fundo + 1
  assert.ok(perto(r.x, 10, 1e-3), `x ${r.x}`);
  // a frente (sen rot, cos rot) olha para a via (norte, -z)
  assert.ok(perto(Math.sin(r.rot), 0, 1e-6) && perto(Math.cos(r.rot), -1, 1e-6));
  const longe = colocar.previaColocarLocal(esp, { tipo: 'clinica', x: 10, z: 400, rot: 0 });
  assert.equal(longe.ok, false);
  assert.equal(longe.codigo, 'acesso');
});

test('colocar (D98): gira a qualquer ângulo, com o ímã de 15 graus, os quartos de volta do botão e o alinhar à via', () => {
  let e = colocar.criarColocar({ tipo: 'clinica', item: { tipo: 'clinica', pegada: [40, 48], custo: 1000 } });
  assert.equal(e.alinhar, true);
  // sem ponto ainda: girar só muda o ângulo, não pede prévia
  e = colocar.passoColocar(e, { tipo: 'girar', sentido: 1, passo: colocar.PASSO_IMA });
  assert.deepEqual(e.efeitos, []);
  assert.equal(colocar.graus(e.rot), 15);
  e = colocar.passoColocar(e, ev('move', 50, 80));
  e = colocar.passoColocar(e, { tipo: 'girar', sentido: 1, passo: colocar.PASSO_IMA });
  assert.equal(colocar.graus(e.rot), 30);
  assert.equal(colocar.graus(e.giro), 30);
  assert.deepEqual(e.efeitos[0], { efeito: 'previa', x: 50, z: 80, rot: e.rot, giro: e.giro, alinhar: true });
  // o botão continua em quartos de volta, e dá a volta sem passar de 360
  for (let k = 0; k < 4; k++) e = colocar.passoColocar(e, { tipo: 'girar', sentido: 1 });
  assert.equal(colocar.graus(e.rot), 30);
  e = colocar.passoColocar(e, { tipo: 'girar', sentido: -1, passo: colocar.PASSO_IMA });
  e = colocar.passoColocar(e, { tipo: 'girar', sentido: -1, passo: colocar.PASSO_IMA });
  assert.equal(colocar.graus(e.rot), 0);
  e = colocar.passoColocar(e, { tipo: 'girar', sentido: -1, passo: colocar.PASSO_IMA });
  assert.equal(colocar.graus(e.rot), 345);
  // o puxador manda o ângulo absoluto; o ímã arredonda de 15 em 15 e o livre deixa como está
  assert.equal(colocar.graus(colocar.imantar((37 * Math.PI) / 180)), 30);
  assert.equal(colocar.graus(colocar.imantar((38 * Math.PI) / 180)), 45);
  assert.equal(colocar.graus(colocar.imantar((359 * Math.PI) / 180)), 0);
  e = colocar.passoColocar(e, { tipo: 'angulo', rot: (37 * Math.PI) / 180, giro: 0.5 });
  assert.equal(colocar.graus(e.rot), 37);
  assert.ok(perto(e.giro, 0.5));
  // alinhar à via liga e desliga; desligando guarda o ângulo efetivo que a prévia mostrava
  e = colocar.passoColocar(e, { tipo: 'alinhar', rot: 1 });
  assert.equal(e.alinhar, false);
  assert.ok(perto(e.rot, 1));
  assert.equal(e.efeitos[0].alinhar, false);
  e = colocar.passoColocar(e, { tipo: 'alinhar', valor: true });
  assert.equal(e.alinhar, true);
  // a frente do puxador: o azimute da frente (sen rot, cos rot) do centro até o ponto do chão
  assert.ok(perto(colocar.azimuteDe([0, 0], [0, 10]), 0));
  assert.ok(perto(colocar.azimuteDe([0, 0], [10, 0]), Math.PI / 2));
  assert.ok(perto(colocar.azimuteDe([5, 5], [5, -5]), Math.PI));
  assert.equal(colocar.azimuteDe([0, 0], [0.2, 0.2]), null, 'o dedo em cima do centro não gira à toa');
});

test('colocar (D98): o substituto gira a planta de verdade ao lado de uma via diagonal e mede o acesso', () => {
  const { esp, no, aresta } = espelhoTeste();
  // via diagonal de 37 graus (rua: 16 m, meia largura 8)
  const a = [0, 0];
  const b = [Math.cos((37 * Math.PI) / 180) * 400, Math.sin((37 * Math.PI) / 180) * 400];
  aresta(no(a[0], a[1]), no(b[0], b[1]), 'rua');
  const dir = [Math.cos((37 * Math.PI) / 180), Math.sin((37 * Math.PI) / 180)];
  const distVia = (x, z) => Math.abs((x - a[0]) * -dir[1] + (z - a[1]) * dir[0]);
  const item = { pegada: [40, 48], custo: 1 };
  for (const g of [0, 15, 37, 90, 135, 180, 253]) {
    const giro = (g * Math.PI) / 180;
    const r = colocar.previaColocarLocal(esp, { tipo: 'clinica', x: 200, z: 160, rot: 0, giro, alinhar: true }, item);
    assert.equal(r.ok, true, `giro ${g}`);
    assert.equal(r.alinhado, true);
    assert.equal(colocar.graus(r.giro), g);
    // os cantos da planta girada: o mais perto fica a 1 m da pista (meia largura 8 + 1), nenhum entra nela
    const c = cantos(r.x, r.z, r.rot, 40, 48);
    const menor = Math.min(...c.map(([x, z]) => distVia(x, z)));
    assert.ok(perto(menor, 8 + 1, 1e-6), `giro ${g}: canto mais perto a ${menor.toFixed(3)} m do eixo`);
    // a frente com giro 0 olha para a via (a rotação da via soma o giro)
    assert.ok(perto(colocar.normalizarRot(r.rotVia + giro), r.rot, 1e-9));
  }
  // livre: fica onde está, no ângulo dado, sem grudar
  const l = colocar.previaColocarLocal(esp, { tipo: 'clinica', x: 200, z: 160, rot: 1.1, alinhar: false }, item);
  assert.equal(l.alinhado, false);
  assert.ok(perto(l.x, 200) && perto(l.z, 160) && perto(l.rot, 1.1));
  assert.equal(l.ok, true, 'a via está a menos de 24 m da planta');
  // longe de toda via: acesso, com a distância que valeu (60 m com alinhar, 24 m sem)
  const longe = colocar.previaColocarLocal(esp, { tipo: 'clinica', x: 900, z: -900, rot: 0.3 }, item);
  assert.equal(longe.ok, false);
  assert.equal(longe.codigo, 'acesso');
  assert.equal(longe.dados.max, 60);
  assert.ok(perto(longe.x, 900) && perto(longe.rot, 0.3), 'sem via no ímã, o fantasma fica onde está');
  assert.equal(colocar.previaColocarLocal(esp, { tipo: 'clinica', x: 900, z: -900, rot: 0, alinhar: false }, item).dados.max, 24);
  // o tipo que dispensa a via nasce longe dela
  assert.equal(colocar.previaColocarLocal(esp, { tipo: 'captacao', x: 900, z: -900, rot: 0 }, { ...item, acesso: 'livre' }).ok, true);
});

/** Os 4 cantos (x, z) de uma planta [w, d] centrada em (cx, cz) com a rotação do espelho. */
function cantos(cx, cz, rot, w, d) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => [cx + c * x + s * z, cz - s * x + c * z]);
}

test('colocar (D98): a dica de cada bloqueio diz o motivo e o que fazer, com o texto em português e os números certos', () => {
  const casos = [
    [{ ok: false, codigo: 'marco', dados: { marco: 4 } }, /marco 4, Vila Próspera|marco 4/, 'ux1.dica.marco'],
    [{ ok: false, codigo: 'ladrilho', dados: { estado: 'compravel' } }, /compre este ladrilho/, 'ux1.dica.ladrilho.compravel'],
    [{ ok: false, codigo: 'ladrilho', dados: { estado: 'trancado' } }, /ainda não está à venda/, 'ux1.dica.ladrilho.trancado'],
    [{ ok: false, codigo: 'gleba' }, /gleba da Arcologia/, 'ux1.dica.gleba'],
    [{ ok: false, codigo: 'agua', dados: { sobre: true } }, /Em cima da água/, 'ux1.dica.agua.sobre'],
    [{ ok: false, codigo: 'agua', dados: { margem: 40 } }, /água a até 40 m/, 'ux1.dica.agua.margem'],
    [{ ok: false, codigo: 'acesso', dados: { max: 60, alinhar: true } }, /Sem via a menos de 60 m: ligue uma via/, 'ux1.dica.acesso.via'],
    [{ ok: false, codigo: 'acesso', dados: { max: 24, alinhar: false } }, /menos de 24 m da planta/, 'ux1.dica.acesso.livre'],
    [{ ok: false, codigo: 'colisao', dados: { com: 'via', ref: 7, afastar: 6 } }, /Colide com a via: afaste 6 m/, 'ux1.dica.colisao.via'],
    [{ ok: false, codigo: 'colisao', dados: { com: 'predio', ref: 9, afastar: 3, nome: 'Clínica' } }, /Colide com Clínica: afaste 3 m/, 'ux1.dica.colisao.predioNome'],
    [{ ok: false, codigo: 'colisao', dados: { com: 'predio', ref: 9, afastar: 3 } }, /Colide com outro prédio: afaste 3 m/, 'ux1.dica.colisao.predio'],
    [{ ok: false, codigo: 'declive', dados: { desnivel: 11.4, max: 9.6 } }, /11,4 m de desnível.*9,6 m/, 'ux1.dica.declive'],
    [{ ok: false, codigo: 'recurso', dados: { recurso: 'rocha' } }, /Pouca rocha/, 'ux1.dica.recurso'],
    [{ ok: false, codigo: 'creditos', dados: { faltam: 1000 } }, /Faltam US\$/, 'ux1.dica.creditos'],
    [{ ok: false, codigo: 'valor' }, /Não dá para construir aqui/, 'ux1.dica.outro'],
    [{ ok: true, aplainar: { custo: 2000, tiques: 30, desnivel: 6 }, custoAplainar: 2000 }, /aplainar por US\$.*0,5 min de jogo/, 'ux1.dica.aplainar'],
  ];
  const { montarDica } = sessao;
  for (const [previa, texto, chave] of casos) {
    const d = montarDica(previa, { t, fmt });
    assert.ok(d, previa.codigo ?? 'aplainar');
    assert.equal(d.chave, chave);
    assert.match(d.texto, texto, `${previa.codigo}: ${d.texto}`);
    assert.ok(!d.texto.includes('??') && !/\{\w+\}/.test(d.texto), `texto sem lacuna: ${d.texto}`);
    assert.ok(d.curto && !d.curto.includes('??') && !/\{\w+\}/.test(d.curto), `curto sem lacuna: ${d.curto}`);
    assert.ok(d.curto.length <= 28, `o curto cabe no botão: ${d.curto}`);
    assert.equal(d.tom, previa.ok ? 'info' : 'er');
  }
  // a parte que colide vai junto, para o mundo mostrar
  assert.deepEqual(montarDica(casos[8][0], { t, fmt }).colide, { com: 'via', ref: 7 });
  assert.deepEqual(montarDica(casos[10][0], { t, fmt }).colide, { com: 'predio', ref: 9 });
  assert.equal(montarDica({ ok: true }, { t, fmt }), null, 'prévia boa sem aplainar não tem dica');
  // a via também diz o motivo e o que fazer, com o declive e o máximo do tipo
  const { dicaDaVia } = sessao;
  const dv = dicaDaVia({ codigo: 'declive', trecho: 0 }, { segmentos: [{ declive: 0.15, erros: ['declive'] }] }, 'rua', { t, fmt });
  assert.match(dv.texto, /Declive de 15% e esta via aceita até 12%/);
  assert.match(dicaDaVia({ codigo: 'declive' }, null, 'rua', { t, fmt }).texto, /Declive acima do que esta via aceita/);
  for (const c of ['agua', 'vao', 'angulo', 'curto', 'raio', 'ladrilho', 'gleba', 'colisao', 'marco', 'creditos', 'invencao']) {
    const d = dicaDaVia({ codigo: c, dados: { faltam: 1000 } }, null, 'avenida', { t, fmt });
    assert.ok(d && !d.texto.includes('??') && !/\{\w+\}/.test(d.texto), `${c}: ${d?.texto}`);
    assert.equal(d.tom, 'er');
  }
  assert.equal(dicaDaVia(null, null, 'rua', { t, fmt }), null);
  // todo código de recusa do contrato que a ferramenta mostra tem dica (nenhum cai no texto de erro genérico sem querer)
  for (const c of ['marco', 'ladrilho', 'gleba', 'agua', 'acesso', 'colisao', 'declive', 'recurso', 'creditos']) {
    assert.notEqual(colocar.dicaDoBloqueio({ ok: false, codigo: c, dados: {} }).chave, 'ux1.dica.outro', c);
  }
});

test('sessão (D98): o painel recebe a dica, a colisão fica em vermelho no mundo, e alinhar e giro vão para a prévia e para o comando', async () => {
  const { esp, no, aresta } = espelhoTeste();
  aresta(no(-200, 0), no(200, 0), 'rua');
  const cmds = [];
  const previas = [];
  let devolve = null;
  const sim = {
    espelho: esp,
    q: { construir: { previa: (args) => (previas.push(args), devolve ? { ...devolve(args) } : null) } },
    cmd: (nome, args) => (cmds.push([nome, args]), { ok: true, dados: { ref: 1048600 } }),
  };
  const { R, soltar } = montarSessao(sim);
  try {
    const item = { tipo: 'clinica', nome: 'Clínica', custo: 1000, pegada: [40, 48] };
    sessao.ferramentas.abrir('colocar', { item });
    // colisão com a via de ref 5: a dica diz quanto afastar e o mundo marca a via
    devolve = (a) => ({ ok: false, codigo: 'colisao', dados: { com: 'via', ref: 1048581, afastar: 6 }, x: a.x, z: a.z, rot: a.rot, alinhado: false, pegada: [40, 48], custo: 1000 });
    R.enviar('inicio', 10, 40);
    R.enviar('fim', 10, 40);
    let s = sessao.sessao.value;
    assert.equal(s.valido, false);
    assert.equal(s.dica.codigo, 'colisao');
    assert.match(s.dica.texto, /afaste 6 m/);
    assert.match(s.motivo, /Colide: afaste 6 m/, 'o botão e a cota dizem o motivo curto');
    assert.deepEqual(R.log.filter(([k]) => k === 'demolir').at(-1)[1], [{ tipo: 'aresta', ref: 1048581 }]);
    // a prévia leva o alinhar e o giro da máquina
    assert.equal(previas.at(-1).alinhar, true);
    sessao.ferramentas.girar(1, colocar.PASSO_IMA);
    sessao.ferramentas.girar(1, colocar.PASSO_IMA);
    assert.ok(perto(previas.at(-1).rot, (30 * Math.PI) / 180, 1e-9));
    assert.ok(perto(previas.at(-1).giro, (30 * Math.PI) / 180, 1e-9));
    // o puxador aponta o chão: sem alinhar à via, o ímã vale para o azimute (47 graus vira 45)
    sessao.ferramentas.alinhar(false);
    assert.equal(sessao.sessao.value.maquina.alinhar, false);
    assert.equal(previas.at(-1).alinhar, false);
    sessao.ferramentas.girarPara((47 * Math.PI) / 180);
    assert.equal(colocar.graus(previas.at(-1).rot), 45);
    sessao.ferramentas.girarPara((47 * Math.PI) / 180, { livre: true });
    assert.equal(colocar.graus(previas.at(-1).rot), 47);
    // alinhado e com a via: o ímã vale para o ângulo em relação à via
    devolve = (a) => ({ ok: true, x: a.x, z: a.z, rot: a.alinhar ? Math.PI + (a.giro ?? 0) : a.rot, alinhado: !!a.alinhar, rotVia: Math.PI, giro: a.giro ?? 0, pegada: [40, 48], custo: 1000 });
    sessao.ferramentas.alinhar(true);
    sessao.ferramentas.girarPara(Math.PI + (22 * Math.PI) / 180);
    assert.equal(colocar.graus(previas.at(-1).giro), 15, '22 graus em relação à via viram 15');
    // sem colisão a marca do mundo sai
    assert.deepEqual(R.log.filter(([k]) => k === 'demolir').at(-1)[1], []);
    // construir manda alinhar como a prévia dizia, e livre põe exatamente onde o fantasma está
    await sessao.ferramentas.construir();
    assert.equal(cmds.at(-1)[0], 'construir');
    assert.equal(cmds.at(-1)[1].alinhar, true);
    sessao.ferramentas.alinhar(false);
    devolve = (a) => ({ ok: true, x: a.x, z: a.z, rot: a.rot, alinhado: false, pegada: [40, 48], custo: 1000 });
    sessao.ferramentas.girarPara(0.5, { livre: true });
    await sessao.ferramentas.construir();
    assert.equal(cmds.at(-1)[1].alinhar, false);
    assert.ok(perto(cmds.at(-1)[1].rot, 0.5, 1e-9));
    sessao.ferramentas.fechar();
  } finally {
    soltar();
  }
});

test('demolir: toque alterna, arrasto só soma, Arcologia e rodovia recusam, Holding pede dois toques', () => {
  const { esp, no, aresta } = espelhoTeste();
  const rod = aresta(no(0, 0), no(100, 0), 'rodovia', ARESTA.RODOVIA);
  const rua = aresta(no(0, 50), no(80, 50), 'rua');
  const cap = 4;
  esp.predios = { n: 2, cap, viva: new Uint8Array([1, 1, 0, 0]), ger: new Uint16Array(cap), tipo: new Uint8Array([TIPO_PREDIO.ZONA, TIPO_PREDIO.HOLDING, 0, 0]), flags: new Uint32Array(cap), moradores: new Uint16Array([40, 0, 0, 0]), empregos: new Uint16Array([2, 30, 0, 0]) };
  let e = demolir.criarDemolir();
  e = demolir.passoDemolir(e, ev('inicio', 0, 0));
  assert.equal(e.efeitos[0].efeito, 'escolher');
  const pr = demolir.alvoDe(esp, { tipo: 'predio', ref: 0 });
  const ho = demolir.alvoDe(esp, { tipo: 'colocavel', ref: 1 });
  assert.equal(ho.holding, true);
  e = demolir.passoDemolir(e, { tipo: 'alvo', alvo: pr, somar: false });
  e = demolir.passoDemolir(e, { tipo: 'alvo', alvo: pr, somar: true });
  assert.equal(e.marcados.length, 1);
  e = demolir.passoDemolir(e, { tipo: 'alvo', alvo: pr, somar: false });
  assert.equal(e.marcados.length, 0);
  e = demolir.passoDemolir(e, { tipo: 'alvo', alvo: demolir.alvoDe(esp, { tipo: 'arcologia', ref: null }), somar: false });
  assert.deepEqual(e.efeitos, [{ efeito: 'recusa', codigo: 'arcologia' }]);
  e = demolir.passoDemolir(e, { tipo: 'alvo', alvo: demolir.alvoDe(esp, { tipo: 'aresta', ref: rod }), somar: false });
  assert.equal(e.efeitos[0].codigo, 'rodovia');
  e = demolir.passoDemolir(e, { tipo: 'alvo', alvo: pr, somar: false });
  e = demolir.passoDemolir(e, { tipo: 'alvo', alvo: ho, somar: true });
  e = demolir.passoDemolir(e, { tipo: 'alvo', alvo: demolir.alvoDe(esp, { tipo: 'aresta', ref: rua }), somar: true });
  assert.equal(demolir.pedeDoisToques(e), true);
  assert.deepEqual(demolir.refsMarcadas(e), { predios: [0, 1], arestas: [rua] }); // a ref 1 de prédio e a de aresta não se confundem
  assert.deepEqual(demolir.marcasParaRender(e), [0, 1, { tipo: 'aresta', ref: rua }]);
  const r = demolir.resumoDemolir(esp, e);
  assert.equal(r.moradores, 40);
  assert.equal(r.empregos, 32);
  assert.equal(r.metros, 80);
  assert.equal(r.voltaVias, Math.round(0.5 * 80 * VIAS.rua.custoM));
  e = demolir.passoDemolir(e, { tipo: 'cancelar' });
  assert.equal(e.marcados.length, 0);
  assert.deepEqual(demolir.passoDemolir(e, { tipo: 'cancelar' }).efeitos, ['sair']);
});

test('áreas: ladrilho do ponto, preço com o desconto da Influência, compráveis e escolha', () => {
  assert.deepEqual(areas.ladrilhoDoPonto(0, 0), [8, 8]);
  assert.deepEqual(areas.ladrilhoDoPonto(-4096, 4095), [0, 15]);
  assert.equal(areas.ladrilhoDoPonto(5000, 0), null);
  assert.deepEqual(areas.centroLadrilho(8, 8), [256, 256]);
  const { esp } = espelhoTeste();
  const info = areas.infoLadrilho(esp.ladrilhos, 10, 7, 0.08);
  assert.equal(info.estado, 'compravel');
  assert.equal(info.preco, 46000);
  assert.equal(info.precoCheio, 50000);
  assert.equal(areas.infoLadrilho(esp.ladrilhos, 7, 7).estado, 'holding');
  assert.deepEqual(areas.compraveis(esp.ladrilhos), [{ i: 10, j: 7, preco: 46000 }]);
  let e = areas.criarAreas();
  const [x, z] = areas.centroLadrilho(10, 7);
  e = areas.passoAreas(e, ev('fim', x, z));
  assert.deepEqual(e.sel, [10, 7]);
  e = areas.passoAreas(e, ev('fim', x, z));
  assert.equal(e.sel, null);
  assert.deepEqual(areas.passoAreas(e, { tipo: 'cancelar' }).efeitos, ['sair']);
});

test('áreas: os preços que se empilham na tela somem; fica o escolhido e o mais perto da câmera', () => {
  const c = (x, y, pri = 0) => ({ x, y, w: 70, h: 26, pri });
  // três em fila encostados (o do meio é o escolhido), um longe de todos
  const fica = areas.rotulosSemSobrepor([c(100, 100), c(130, 104, 1), c(160, 108), c(400, 300)]);
  assert.deepEqual(fica, [false, true, false, true]);
  // sem escolhido: o mais embaixo (mais perto) ganha; lado a lado com folga ficam os dois
  assert.deepEqual(areas.rotulosSemSobrepor([c(100, 100), c(110, 120)]), [false, true]);
  assert.deepEqual(areas.rotulosSemSobrepor([c(100, 100), c(180, 100)]), [true, true]);
  assert.deepEqual(areas.rotulosSemSobrepor([]), []);
});

// ------------------------------------------------------------------------------------------------ sessão (puras)

test('rótulos do mundo: a cota sai de baixo do HUD (desce da barra de cima, sobe da de baixo) ou some', () => {
  const hud = [
    { l: 0, t: 8, r: 986, b: 48, cima: true }, // barra de cima
    { l: 440, t: 56, r: 546, b: 80, cima: true }, // pílula de pausa
    { l: 8, t: 365, r: 978, b: 435, cima: false }, // barra da ferramenta
  ];
  assert.equal(areas.fugirDoHud(300, 200, 120, 26, hud), 200, 'longe do HUD fica onde está');
  assert.equal(areas.fugirDoHud(300, 40, 120, 26, hud), 48 + 4 + 13, 'desce da barra de cima');
  assert.equal(areas.fugirDoHud(490, 60, 120, 26, hud), 80 + 4 + 13, 'desce da pílula também');
  assert.equal(areas.fugirDoHud(300, 360, 120, 26, hud), 365 - 4 - 13, 'sobe da barra de baixo');
  // sem lugar entre as barras: some
  assert.equal(areas.fugirDoHud(300, 50, 120, 26, [{ l: 0, t: 0, r: 986, b: 60, cima: true }, { l: 0, t: 70, r: 986, b: 443, cima: false }]), null);
});

test('sessão: Desfazer guarda até 10 ações; borda, encaixe e catálogo', () => {
  const p = sessao.criarPilha();
  for (let i = 0; i < 12; i++) sessao.empilhar(p, { i });
  assert.equal(p.lista.length, 10);
  assert.equal(sessao.desempilhar(p).i, 11);
  assert.equal(p.lista[0].i, 2);
  const area = { x0: 8, y0: 56, x1: 978, y1: 363 };
  assert.equal(sessao.velocidadeBorda([500, 200], area), null);
  assert.deepEqual(sessao.velocidadeBorda([978, 200], area), [1, 0]);
  const v = sessao.velocidadeBorda([30, 80], area);
  assert.ok(v[0] < 0 && v[1] < 0 && v[0] > -1);
  const enc = sessao.escolherEncaixe([{ ponto: [0, 0], tipo: 'comprimento', valor: 40 }, { ponto: [1, 0], tipo: 'angulo', valor: 90 }, { ponto: [200, 0], tipo: 'no', valor: 3 }], [0, 0], 20);
  assert.equal(enc.tipo, 'angulo');
  const vias = sessao.itensDaCategoria('vias', { marco: 0 });
  assert.deepEqual(vias.itens.map((i) => i.id), ['rua', 'ruaMao', 'avenida', 'avenidaG']);
  assert.deepEqual(vias.itens.filter((i) => i.trancado).map((i) => i.id), ['ruaMao', 'avenidaG']);
  assert.equal(sessao.itensDaCategoria('vias', { marco: 0, livre: true }).itens.some((i) => i.trancado), false);
  const zonas = sessao.itensDaCategoria('zonas', { marco: 2 });
  assert.equal(zonas.itens.at(-1).id, 'apagar');
  assert.equal(zonas.itens.some((i) => i.trancado), false);
  assert.equal(sessao.categoriaVisivel('servicos', { consultar: () => null }), false);
  const cat = (nome) => (nome === 'catalogo' ? [{ tipo: 'clinica', nome: 'Clínica', custo: 8000, marco: 1, grupo: 'Saúde' }, { tipo: 'escolaF', nome: 'Escola', custo: 9000, marco: 3, grupo: 'Educação' }] : null);
  assert.equal(sessao.categoriaVisivel('servicos', { consultar: cat }), true);
  const serv = sessao.itensDaCategoria('servicos', { consultar: cat, marco: 2 });
  assert.deepEqual(serv.abas.map((a) => a.id), ['Saúde', 'Educação']);
  assert.deepEqual(serv.itens.map((i) => i.trancado), [false, true]);
  assert.deepEqual(sessao.estadoArcologia({ espelho: { arcologia: { plano: 'A', etapas: [{ estado: 3 }, { estado: 1 }, { estado: 0 }, { estado: 0 }] } } }), { progresso: 0.25, pode: true });
});

// ------------------------------------------------------------------------------------------------ sessão (cola)

/** Render de mentira: grava os pedidos; câmera de cima, 1 px = 1 m; o chão é y = 0. */
function renderFalso() {
  const log = [];
  let aoFerr = null;
  const R = {
    log,
    entrada: { modo: (m) => log.push(['modo', m]), aoFerramenta: (fn) => (aoFerr = fn), opcoes: (o) => log.push(['opcoes', o]) },
    enviar: (fase, x, y, extra = {}) => aoFerr({ fase, x, y, ponto: [x, 0, y], dedos: 1, ...extra }),
    projetar: ([x, , z]) => ({ x, y: z, visivel: true, dist: 100 }),
    raio: (x, y) => [x, 0, y],
    selecionar: () => null,
    selecionado: () => {},
    camera: { estado: () => ({ x: 0, z: 0, dist: 500, guinada: 0, inclinacao: 40 }), definir: (e) => log.push(['camera', e]) },
    ferramenta: {
      via: { previa: (p, estilo) => log.push(['via', p, estilo]) },
      zona: { mostrar: (b) => log.push(['zona.mostrar', b]), celulas: (c, z) => log.push(['celulas', c, z]) },
      pincel: (p) => log.push(['pincel', p]),
      ladrilhos: (b) => log.push(['ladrilhos', b]),
      fantasma: (f) => log.push(['fantasma', f]),
      demolir: (r) => log.push(['demolir', r]),
      limpar: () => log.push(['limpar']),
    },
  };
  return R;
}

function montarSessao(sim) {
  const R = renderFalso();
  const quadros = [];
  ligarConsultas(() => sim);
  ligarAcoes({ obterSim: () => sim });
  loja.reiniciarLoja();
  loja.barra.value = { ...loja.BARRA_VAZIA, creditos: 100000, marco: { ...loja.BARRA_VAZIA.marco, n: 2 } };
  const ui = { R, loja, t, fmt, consultar, comando, frase, obterSim: () => sim, aoQuadro: (f) => quadros.push(f), telas: () => [], abrirTela: () => true };
  const soltar = sessao.registrar(ui);
  return { R, ui, soltar, quadros };
}

test('sessão: via com o planejador substituto, Construir manda o plano com a sessão, Desfazer pela sessão', async () => {
  const { esp, no, aresta } = espelhoTeste();
  aresta(no(0, 0), no(112, 0));
  const cmds = [];
  const sim = { espelho: esp, q: {}, cmd: (nome, args) => (cmds.push([nome, args]), { ok: true, id: 5 }) };
  const { R, soltar } = montarSessao(sim);
  try {
    sessao.ferramentas.abrir('via', { tipoVia: 'rua' });
    assert.equal(loja.ferramenta.value.tipo, 'via');
    assert.ok(R.log.some(([k, m]) => k === 'modo' && m === 'ferramenta'));
    R.enviar('inicio', 112, 0);
    R.enviar('fim', 112, 0);
    R.enviar('inicio', 114, 150);
    R.enviar('fim', 114, 150);
    const s = sessao.sessao.value;
    assert.equal(s.maquina.fase, 'previa');
    assert.ok(s.previa.substituto);
    assert.equal(s.valido, true);
    const ult = R.log.filter(([k]) => k === 'via').at(-1);
    assert.equal(ult[2], 'normal');
    assert.equal(ult[1].segmentos.length, 1);
    assert.ok(Math.abs(s.maquina.b[0] - 112) < 1e-6, `B encaixado a 90 graus: ${s.maquina.b}`);
    await sessao.ferramentas.construir();
    const [nome, args] = cmds.at(-1);
    assert.equal(nome, 'via.construir');
    assert.equal(args.plano.modo, 'reta');
    // a sessão da simulação leva a da página (D16): recarregar a página não emenda a sessão nova na velha do save
    assert.equal(args.plano.sessao, sessao.sessao.value.chave);
    assert.equal(sessao.sessao.value.chave, sessao.chaveDaSessao(sessao.sessao.value.id));
    assert.notEqual(sessao.chaveDaSessao(1, 'pagina1'), sessao.chaveDaSessao(1, 'pagina2'));
    assert.equal(sessao.sessao.value.desfazer, 1);
    assert.equal(sessao.sessao.value.maquina.fase, 'ocioso');
    await sessao.ferramentas.desfazer();
    assert.deepEqual(cmds.at(-1), ['via.desfazer', { sessao: sessao.sessao.value.chave }]);
    assert.equal(sessao.sessao.value.desfazer, 0);
    sessao.ferramentas.fechar();
    assert.equal(loja.ferramenta.value, null);
    assert.ok(R.log.some(([k]) => k === 'limpar'));
  } finally {
    soltar();
  }
});

test('sessão: sem créditos a prévia fica inválida com "Faltam" e o Construir não manda nada', async () => {
  const { esp } = espelhoTeste();
  const cmds = [];
  const sim = { espelho: esp, q: {}, cmd: (nome, args) => (cmds.push([nome, args]), { ok: true }) };
  const { R, soltar } = montarSessao(sim);
  try {
    loja.barra.value = { ...loja.barra.value, creditos: 1000 };
    sessao.ferramentas.abrir('via', { tipoVia: 'avenida' });
    R.enviar('inicio', 0, 0);
    R.enviar('fim', 0, 0);
    R.enviar('inicio', 200, 0);
    R.enviar('fim', 200, 0);
    const s = sessao.sessao.value;
    assert.equal(s.valido, false);
    assert.equal(s.codigo, 'creditos');
    assert.match(s.motivo, /^Faltam /);
    assert.equal(R.log.filter(([k]) => k === 'via').at(-1)[2], 'invalido');
    await sessao.ferramentas.construir();
    assert.equal(cmds.length, 0);
    sessao.ferramentas.fechar();
  } finally {
    soltar();
  }
});

test('sessão: a prévia da simulação (q.via.previa) manda quando existe', () => {
  const { esp } = espelhoTeste();
  const pedidos = [];
  const plano = { ok: true, segmentos: [{ p: [0, 0, 30, 0, 60, 0, 96, 0], tipo: 'rua', cotas: [0, 0], ponte: false, erros: [] }], nosNovos: 2, divisoes: 0, encaixes: [{ ponto: [96, 0], tipo: 'comprimento', valor: 96 }], guias: [], demolir: { predios: [], custo: 0 }, comprimento: 96, custo: 2880, manutencaoHora: 14, erros: [] };
  const sim = { espelho: esp, q: { via: { previa: (a) => (pedidos.push(a), plano) } }, cmd: () => ({ ok: true }) };
  const { R, soltar } = montarSessao(sim);
  try {
    sessao.ferramentas.abrir('via');
    R.enviar('inicio', 0, 0);
    R.enviar('fim', 0, 0);
    R.enviar('inicio', 97, 3);
    R.enviar('fim', 97, 3);
    assert.ok(pedidos.length >= 2);
    assert.equal(pedidos.at(-1).modo, 'reta');
    assert.equal(typeof pedidos.at(-1).tolerancia, 'number');
    const s = sessao.sessao.value;
    assert.equal(s.previa, plano);
    assert.deepEqual(s.maquina.b, [96, 0]); // as alças passam para o ponto encaixado ao soltar
    sessao.ferramentas.fechar();
  } finally {
    soltar();
  }
});

test('sessão: zonas pintam na hora e o Desfazer devolve a zona antiga de cada célula', async () => {
  const { esp, no, aresta } = espelhoTeste();
  const e0 = aresta(no(0, 0), no(96, 0));
  const C = celulasTeste(esp, e0, 8);
  C.zona[1] = 4; // a célula (20, 20), no caminho do pincel
  const cmds = [];
  const sim = {
    espelho: esp,
    q: {},
    cmd(nome, args) {
      cmds.push([nome, args]);
      if (nome === 'zona.pintar') {
        const r = zona.previaZonaLocal(esp, args.pincel, args.zona);
        for (const c of r.celulas) C.zona[c] = args.zona;
        return r.celulas.length ? { ok: true } : { ok: false, codigo: 'nada' };
      }
      return { ok: true };
    },
  };
  const { R, soltar } = montarSessao(sim);
  try {
    sessao.ferramentas.abrir('zona', { zona: 'resBaixa', modo: 'pincel', tamanho: 'M' });
    assert.ok(R.log.some(([k, b]) => k === 'zona.mostrar' && b === true));
    R.enviar('inicio', 20, 20);
    R.enviar('move', 40, 20);
    R.enviar('fim', 40, 20);
    await new Promise((ok) => setTimeout(ok, 0));
    const pintadas = [...Array(C.n).keys()].filter((c) => C.zona[c] === 1);
    assert.ok(pintadas.length > 4);
    assert.equal(C.zona[1], 1);
    assert.equal(sessao.sessao.value.desfazer, 1);
    await sessao.ferramentas.desfazer();
    assert.equal(C.zona[1], 4, 'a célula comercial volta a ser comercial');
    assert.equal([...Array(C.n).keys()].filter((c) => C.zona[c] === 1).length, 0);
    assert.equal(cmds.at(-1)[1].pincel.modo, 'celulas');
    sessao.ferramentas.construir(); // Pronto fecha
    assert.equal(sessao.sessao.value, null);
    assert.ok(R.log.some(([k, b]) => k === 'zona.mostrar' && b === false));
  } finally {
    soltar();
  }
});

test('sessão: Melhorar e Demolir vias mandam a sessão, e o Desfazer volta pela mesma sessão', async () => {
  const { esp, no, aresta } = espelhoTeste();
  const e0 = aresta(no(0, 0), no(112, 0), 'terra');
  const e1 = aresta(no(0, 112), no(112, 112), 'rua');
  const cmds = [];
  const pedidos = [];
  // a prévia do Melhorar da simulação (S1b): o formato de q.via.previa com modo 'melhorar'
  const planoMelhorar = (a) => ({ ok: true, arestas: a.arestas.map((ref) => ({ ref, ok: true, erros: [] })), segmentos: [], comprimento: 112, custo: 900, manutencaoHora: 3, erros: [], demolir: { predios: [], custo: 0 } });
  const sim = {
    espelho: esp,
    q: { via: { previa: (a) => (pedidos.push(a), a.modo === 'melhorar' ? planoMelhorar(a) : a.modo === 'demolir' ? { ok: true, arestas: [], segmentos: [], erros: [], devolve: 1234, custo: -1234 } : null) } },
    cmd: (nome, args) => (cmds.push([nome, args]), { ok: true }),
  };
  const { R, soltar } = montarSessao(sim);
  try {
    sessao.ferramentas.abrir('via', { tipoVia: 'rua', modo: 'melhorar' });
    R.enviar('inicio', 56, 0);
    R.enviar('fim', 56, 0);
    let s = sessao.sessao.value;
    assert.deepEqual(s.maquina.selecao, [e0]);
    assert.equal(pedidos.at(-1).modo, 'melhorar');
    assert.equal(s.previa.custo, 900, 'a prévia do Melhorar é a da simulação');
    assert.equal(s.previa.estimado, undefined);
    assert.equal(s.valido, true);
    await sessao.ferramentas.construir();
    const [nome, args] = cmds.at(-1);
    assert.equal(nome, 'via.melhorar');
    assert.equal(args.sessao, sessao.sessao.value.chave, 'a melhoria entra na sessão para o via.desfazer achar');
    await sessao.ferramentas.desfazer();
    assert.deepEqual(cmds.at(-1), ['via.desfazer', { sessao: args.sessao }]);

    sessao.ferramentas.abrir('demolir');
    R.enviar('inicio', 56, 112);
    R.enviar('fim', 56, 112);
    s = sessao.sessao.value;
    assert.equal(s.maquina.marcados.length, 1);
    assert.equal(s.resumo.voltaVias, 1234, 'o que volta é o que a simulação diz');
    await sessao.ferramentas.construir();
    const dem = cmds.find(([n]) => n === 'via.demolir');
    assert.deepEqual(dem[1].arestas, [e1]);
    assert.equal(dem[1].sessao, sessao.sessao.value.chave);
    assert.equal(sessao.sessao.value.desfazer, 1);
    await sessao.ferramentas.desfazer();
    assert.deepEqual(cmds.at(-1), ['via.desfazer', { sessao: dem[1].sessao }]);
    sessao.ferramentas.fechar();
  } finally {
    soltar();
  }
});

test('sessão: o Desfazer do Colocar entra com a ref do prédio (Resposta.id ou dados.ref; o id do comando não serve)', async () => {
  assert.equal(sessao.refCriada({ ok: true, id: { sessao: 'abc', seq: 3 } }), null);
  assert.equal(sessao.refCriada({ ok: true, id: { sessao: 'abc', seq: 3 }, dados: { ref: 1048583 } }), 1048583);
  assert.equal(sessao.refCriada({ ok: true, ref: 9 }), 9);
  assert.equal(sessao.refCriada({ ok: false, codigo: 'creditos', dados: { ref: 9 } }), null);
  const { esp, no, aresta } = espelhoTeste();
  aresta(no(0, 0), no(112, 0));
  const cmds = [];
  let resposta = { ok: true }; // sem ref nenhuma
  const sim = { espelho: esp, q: {}, cmd: (nome, args) => (cmds.push([nome, args]), resposta) };
  const { R, soltar } = montarSessao(sim);
  try {
    const item = { tipo: 'clinica', nome: 'Clínica', custo: 1000, pegada: [24, 24] };
    sessao.ferramentas.abrir('colocar', { item });
    R.enviar('inicio', 50, 30);
    R.enviar('fim', 50, 30);
    assert.equal(sessao.sessao.value.valido, true);
    await sessao.ferramentas.construir();
    assert.equal(sessao.sessao.value.desfazer, 0, 'sem a ref do prédio, nada para desfazer');
    resposta = { ok: true, dados: { ref: 1048583 } };
    await sessao.ferramentas.construir();
    assert.equal(sessao.sessao.value.desfazer, 1);
    await sessao.ferramentas.desfazer();
    assert.deepEqual(cmds.at(-1), ['demolir', { refs: [1048583] }]);
    // ui/acoes.js deixa o Resposta.id do contrato intacto (o id do comando vai em idComando)
    resposta = { ok: true, id: 77 };
    await sessao.ferramentas.construir();
    await sessao.ferramentas.desfazer();
    assert.deepEqual(cmds.at(-1), ['demolir', { refs: [77] }]);
    sessao.ferramentas.fechar();
  } finally {
    soltar();
  }
});

test('sessão: o gesto que vira câmera (fim cancelado) não fixa ponto, não pinta nem escolhe', async () => {
  const { esp, no, aresta } = espelhoTeste();
  const e0 = aresta(no(0, 0), no(96, 0));
  celulasTeste(esp, e0, 8);
  const cmds = [];
  const sim = { espelho: esp, q: {}, cmd: (nome, args) => (cmds.push([nome, args]), { ok: true }) };
  const { R, soltar } = montarSessao(sim);
  try {
    sessao.ferramentas.abrir('via');
    R.enviar('inicio', 300, 300);
    R.enviar('fim', 300, 300);
    assert.equal(sessao.sessao.value.maquina.fase, 'aFixo');
    // o dedo apoia (mirando B) e um segundo dedo chega depois dos 80 ms: o gesto vira câmera
    R.enviar('inicio', 400, 300, { tipo: 'toque' });
    R.enviar('move', 420, 310, { tipo: 'toque' });
    R.enviar('fim', 420, 310, { tipo: 'toque', cancelado: true });
    let s = sessao.sessao.value;
    assert.equal(s.maquina.fase, 'aFixo');
    assert.equal(s.maquina.b, null);
    assert.equal(s.dedo, false);
    // Preencher: o toque cancelado não pinta a quadra
    sessao.ferramentas.abrir('zona', { zona: 'resBaixa', modo: 'preencher' });
    R.enviar('inicio', 20, 20, { tipo: 'toque' });
    R.enviar('fim', 20, 20, { tipo: 'toque', cancelado: true });
    await new Promise((ok) => setTimeout(ok, 0));
    assert.equal(cmds.filter(([n]) => n === 'zona.pintar').length, 0);
    s = sessao.sessao.value;
    assert.equal(s.tipo, 'zona', 'a ferramenta continua aberta');
    assert.equal(s.maquina.dedo, false);
    // o mesmo toque sem cancelar pinta
    R.enviar('inicio', 20, 20, { tipo: 'toque' });
    R.enviar('fim', 20, 20, { tipo: 'toque' });
    await new Promise((ok) => setTimeout(ok, 0));
    assert.equal(cmds.filter(([n]) => n === 'zona.pintar').length, 1);
    // Áreas: o toque cancelado não escolhe o ladrilho
    sessao.ferramentas.abrir('areas');
    R.enviar('inicio', 1400, -300, { tipo: 'toque' });
    R.enviar('fim', 1400, -300, { tipo: 'toque', cancelado: true });
    assert.equal(sessao.sessao.value.info, null);
    sessao.ferramentas.fechar();
  } finally {
    soltar();
  }
});

test('sessão: fechar no meio de um gesto não deixa a prévia desenhada (o fim cancelado do render chega depois)', () => {
  const { esp } = espelhoTeste();
  const sim = { espelho: esp, q: {}, cmd: () => ({ ok: true }) };
  const { R, soltar } = montarSessao(sim);
  try {
    // como o render: trocar para a câmera com o dedo apoiado manda o 'fim' cancelado do gesto
    let apoiado = null;
    const modo = R.entrada.modo;
    R.entrada.modo = (m) => {
      modo(m);
      if (m === 'camera' && apoiado) R.enviar('fim', apoiado[0], apoiado[1], { cancelado: true });
    };
    sessao.ferramentas.abrir('via');
    R.enviar('inicio', 0, 0);
    R.enviar('fim', 0, 0);
    R.enviar('inicio', 150, 20);
    R.enviar('fim', 150, 20);
    assert.equal(sessao.sessao.value.maquina.fase, 'previa');
    // pega a alça de B e arrasta; a ferramenta fecha com o dedo apoiado
    const b = sessao.sessao.value.maquina.b;
    apoiado = [b[0] + 10, b[1]];
    R.enviar('inicio', b[0], b[1]);
    R.enviar('move', b[0] + 10, b[1]);
    assert.equal(sessao.sessao.value.maquina.fase, 'arrastando');
    assert.ok(R.log.filter(([k, p]) => k === 'via' && p).length > 0);
    sessao.ferramentas.fechar();
    const ultLimpar = R.log.map(([k]) => k).lastIndexOf('limpar');
    assert.ok(ultLimpar >= 0);
    assert.equal(R.log.slice(ultLimpar).filter(([k, p]) => k === 'via' && p).length, 0, 'nada redesenha depois do limpar');
    assert.equal(sessao.sessao.value, null);
  } finally {
    soltar();
  }
});

test('sessão: o cursor parado do render (move sem dedo) é passar o mouse: não apoia nem rola a câmera pela borda', () => {
  const { esp } = espelhoTeste();
  const sim = { espelho: esp, q: {}, cmd: () => ({ ok: true }) };
  const { R, soltar, quadros } = montarSessao(sim);
  try {
    sessao.ferramentas.abrir('via');
    R.enviar('inicio', 300, 200, { tipo: 'mouse' });
    R.enviar('fim', 300, 200, { tipo: 'mouse' });
    // o mouse vai para perto da barra de cima: o render manda 'move' com dedos 0 a cada quadro
    R.enviar('move', 400, 20, { tipo: 'mouse', dedos: 0 });
    assert.equal(sessao.vivo.apoiado, false);
    const s = sessao.sessao.value;
    assert.equal(s.maquina.fase, 'aFixo');
    assert.deepEqual(s.maquina.b, [400, 20], 'a prévia segue o cursor');
    for (const [i, f] of quadros.entries()) f(1000 + i * 16), f(1016 + i * 16), f(1032 + i * 16);
    assert.equal(R.log.filter(([k]) => k === 'camera').length, 0, 'a câmera não anda sozinha com o mouse parado');
    sessao.ferramentas.fechar();
  } finally {
    soltar();
  }
});

test('sessão: loja.ferramenta abre a ferramenta pedida por outra parcela e null fecha', () => {
  const { esp } = espelhoTeste();
  const sim = { espelho: esp, q: {}, cmd: () => ({ ok: true }) };
  const { R, soltar } = montarSessao(sim);
  try {
    loja.ferramenta.value = { tipo: 'areas' };
    assert.equal(sessao.sessao.value.tipo, 'areas');
    assert.ok(R.log.some(([k, b]) => k === 'ladrilhos' && b === true));
    assert.equal(sessao.sessao.value.resumo.compraveis.length, 1);
    loja.ferramenta.value = null;
    assert.equal(sessao.sessao.value, null);
  } finally {
    soltar();
  }
});

// ------------------------------------------------------------------------------------------------ render (geometria)

test('render: a fita segue a curva na largura do tipo, colada no chão; o círculo e as cores das células', async () => {
  const sob = await import('../../fonte/render/sobreposicoes/ferramentas.js');
  const p = reta(0, 0, 100, 0);
  const f = sob.fitaDaCurva(p, 16, (x) => x * 0.1);
  const n = f.posicoes.length / 6;
  assert.ok(n >= 25);
  assert.equal(f.indices.length, (n - 1) * 6);
  assert.ok(perto(f.posicoes[2], -8, 1e-6) && perto(f.posicoes[5], 8, 1e-6)); // as duas bordas em z = -8 e 8
  assert.ok(perto(f.posicoes.at(-2), 100 * 0.1 + sob.SOBRE.acimaVia, 1e-4)); // cota do chão mais a folga
  const c = sob.circuloNoChao(0, 0, 50, () => 0, { n: 32 });
  assert.equal(c.length, 32 * 6);
  const verde = sob.corDaCelula(1, CELULA.LIVRE);
  assert.ok(verde.g > verde.r && verde.g > verde.b);
  const inv = sob.corDaCelula(0, CELULA.INVALIDA);
  assert.ok(inv.r > inv.g && inv.r > inv.b);
});

test('render: a grade das células anda por célula tocada; pintar só troca as cores, sem refazer as instâncias', async () => {
  const sob = await import('../../fonte/render/sobreposicoes/ferramentas.js');
  const THREE = await import('three');
  const { esp, no, aresta } = espelhoTeste();
  const e0 = aresta(no(0, 0), no(96, 0));
  const C = celulasTeste(esp, e0, 8);
  // grade pura: cada célula uma vez, a que anda sai do balde velho, nada repetido
  const G = sob.criarGradeCelulas(C);
  for (let c = 0; c < C.n; c++) sob.porNaGrade(G, c);
  const ver = (x, z, r) => {
    const l = [];
    sob.celulasNoRaio(G, x, z, r, (c) => l.push(c));
    return l.sort((a, b) => a - b);
  };
  const todas = ver(50, 0, 200);
  assert.equal(todas.length, C.n);
  assert.equal(new Set(todas).size, C.n);
  C.x[0] = 900;
  C.z[0] = 900;
  assert.equal(sob.porNaGrade(G, 0), true);
  assert.equal(sob.porNaGrade(G, 0), false, 'no mesmo balde, nada muda');
  assert.ok(!ver(50, 0, 200).includes(0));
  assert.deepEqual(ver(900, 900, 10), [0]);
  C.x[0] = 20; // volta: o balde velho ainda tem a célula, mas ela não aparece duas vezes
  C.z[0] = 12;
  sob.porNaGrade(G, 0);
  assert.equal(ver(50, 0, 200).filter((c) => c === 0).length, 1);

  // o domínio: com a zona ligada, pintar (o diário traz as células) troca a cor no lugar
  const ouvintes = new Map();
  const ctx = { cena: new THREE.Scene(), medidas: { familia: (o) => o }, sim: { espelho: esp }, ouvir: (n, f) => (ouvintes.set(n, f), () => {}), cameraApi: { alvo: (v) => v.set(50, 0, 0) } };
  let criar = null;
  sob.registrar({ registrarDominio: (n, f) => (criar = f) });
  const dom = criar(ctx);
  const cels = ctx.cena.getObjectByName('ferramentas:celulas');
  ouvintes.get('ferramenta.zona')(true);
  ouvintes.get('ferramenta.pincel')({ x: 50, z: 0, raio: 16 });
  const n0 = dom.medidas().celulas;
  assert.equal(n0, C.n);
  let matrizes = 0;
  const setMatrixAt = cels.setMatrixAt.bind(cels);
  cels.setMatrixAt = (...a) => (matrizes++, setMatrixAt(...a));
  const alvo = 5;
  C.zona[alvo] = ZONAS_ORDEM.indexOf('comBaixa');
  dom.aplicar({ celulas: Int32Array.of(alvo) });
  assert.equal(matrizes, 0, 'pintar não refaz as instâncias');
  const cor = new THREE.Color();
  const k = [...Array(cels.count).keys()].find((i) => {
    cels.getColorAt(i, cor);
    return cor.b > cor.g && cor.b > cor.r; // comercial é azul
  });
  assert.ok(k !== undefined, 'a célula pintada ficou azul');
  // a prévia do pincel acende e apaga sem refazer
  ouvintes.get('ferramenta.celulas')({ celulas: Int32Array.of(1, 2), zona: 0 });
  ouvintes.get('ferramenta.celulas')({ celulas: Int32Array.of(3), zona: 0 });
  assert.equal(matrizes, 0);
  // uma célula que morre sai do desenho (aí sim refaz)
  C.viva[7] = 0;
  dom.aplicar({ celulas: Int32Array.of(7) });
  assert.ok(matrizes > 0);
  assert.equal(dom.medidas().celulas, n0 - 1);
  dom.descartar();
});

// ------------------------------------------------------------------------------------------------ textos, glifos, CSS

const ARQUIVOS_X2 = [
  'fonte/ui/ferramentas/via.js', 'fonte/ui/ferramentas/zona.js', 'fonte/ui/ferramentas/colocar.js', 'fonte/ui/ferramentas/demolir.js',
  'fonte/ui/ferramentas/areas.js', 'fonte/ui/ferramentas/sessao.js', 'fonte/ui/hud/Construcao.jsx', 'fonte/ui/hud/Bandeja.jsx',
  'fonte/ui/hud/BarraFerramenta.jsx', 'fonte/ui/mundo/Lupa.jsx', 'fonte/ui/mundo/Cotas.jsx',
];

test('textos da X2: toda chave usada existe, motivos e encaixes cobertos, nada proibido pela D42', () => {
  assert.deepEqual(chavesRepetidas().filter((k) => k.includes('x2')), []);
  const usadas = new Set();
  for (const f of ARQUIVOS_X2) for (const m of ler(f).matchAll(/\bt\(\s*'(x2\.[\w.]+)'/g)) usadas.add(m[1]);
  assert.ok(usadas.size > 40, `${usadas.size} chaves`);
  for (const k of usadas) assert.ok(temTexto(k), `sem texto: ${k}`);
  for (const c of ['agua', 'vao', 'declive', 'angulo', 'curto', 'raio', 'ladrilho', 'gleba', 'colisao', 'marco', 'creditos', 'acesso', 'arcologia', 'rodovia']) assert.ok(temTexto(`x2.motivo.${c}`), c);
  for (const c of LISTA_CODIGOS) assert.ok(temTexto(`codigo.${c}`), c);
  for (const tipo of ['no', 'aresta', 'angulo', 'prolongamento', 'quadra', 'passo', 'comprimento']) assert.ok(temTexto(`x2.enc.${tipo}`), tipo);
  for (const z of ['resBaixa', 'resMedia', 'resAlta', 'comBaixa', 'comAlta', 'escritorio', 'industria']) assert.ok(temTexto(`x2.zonaCurta.${z}`), z);
  const fonte = ler('fonte/ui/textos/x2.js');
  const valores = [...fonte.matchAll(/'x2\.[\w.]+':\s*'([^']*)'/g)].map((m) => m[1]);
  assert.ok(valores.length > 100);
  for (const v of valores) {
    assert.ok(!/[—–]/.test(v), `travessão: ${v}`);
    assert.ok(!/(?<![\p{L}\p{N}_])dias?(?![\p{L}\p{N}_])/iu.test(v), `"dia": ${v}`);
    assert.ok(!/aluguel|\/dia/i.test(v), v);
  }
  assert.equal(t('x2.via.total', { m: fmt.numero(124), custo: fmt.creditos(3720) }), '124 m · 3.720 créditos');
});

test('glifos da X2: todo glifo usado existe no registro (ou é registrado pela barra)', () => {
  const nomes = new Set();
  for (const f of ARQUIVOS_X2) {
    for (const m of ler(f).matchAll(/<Glifo n="(\w+)"/g)) nomes.add(m[1]);
    for (const m of ler(f).matchAll(/glifo: '(\w+)'/g)) nomes.add(m[1]);
  }
  for (const v of VIAS_ORDEM.filter((k) => VIAS[k].constroi)) nomes.add(v);
  for (const n of ['vias', 'zonas', 'servicos', 'lazer', 'empresas', 'arcologia', 'demolir', 'residencial', 'comercial', 'industrial', 'escritorio', 'preencher', 'pincel', 'retangulo', 'reta', 'curva', 'grade']) nomes.add(n);
  const proprios = new Set(['melhorar']);
  for (const n of nomes) assert.ok(glifo(n) || proprios.has(n), `glifo sem desenho: ${n}`);
  assert.match(ler('fonte/ui/hud/BarraFerramenta.jsx'), /registrarGlifos\(\{ melhorar:/);
});

test('CSS da X2: sem desfoque, animação e transição só com transform e opacity', () => {
  const css = ler('fonte/ui/tema/mundo.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/backdrop-filter/.test(css));
  for (const m of css.matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?)\}\s*\}/g)) {
    const props = [...m[1].matchAll(/([\w-]+)\s*:/g)].map((x) => x[1]);
    for (const p of props) assert.ok(['opacity', 'transform'].includes(p), `keyframes com ${p}`);
  }
  for (const m of css.matchAll(/transition\s*:\s*([^;]+);/g)) {
    for (const parte of m[1].split(',')) assert.ok(/^\s*(transform|opacity)\b/.test(parte), `transição: ${parte}`);
  }
  // alvos: as peças tocáveis da barra têm 44 px (ou o ::after que estende)
  assert.match(css, /\.bf-zona::after/);
  assert.match(css, /\.construcao-grupo \{[^}]*height: var\(--alvo\)/);
});

test('guarda: nada de three nas máquinas da interface', () => {
  for (const f of readdirSync(join(RAIZ, 'fonte/ui/ferramentas'))) {
    const s = ler(`fonte/ui/ferramentas/${f}`);
    assert.ok(!/from\s+['"]three/.test(s), f);
  }
});
