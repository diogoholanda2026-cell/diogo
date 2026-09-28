// Testes dos blocos, das células e do pincel (S1b): blocos de 8 m com 6 de fundo dos dois lados, alinhados à via e com
// o passo que atravessa os nós; regra da esquina (fica a de linha menor, depois o bloco mais antigo) sem buraco nem
// sobreposição em cruzamento, T e L (a via que sai do meio de outra anda para o passo das células dela); células
// inválidas (água, declive, ladrilho, gleba, outra via, curva fechada); a divisão da aresta mantém as células e a
// pintura; pincel (quadra, círculo, retângulo, lista), prévia igual à pintura, apagar e marco; prédio marcado para sair
// ao ser abandonado; a pintura passa para a célula nova ao alargar a via; e os invariantes do espelho depois de tudo.
// Roda sozinho: node ferramentas/testes/celulas.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { conferirEspelho, angDaCelula, idxDaRef, refDe, CELULA_M, LINHAS_BLOCO } from '../../fonte/contratos/espelho.js';
import { AGUA, CELULA, PREDIO } from '../../fonte/contratos/flags.js';
import { tabelaArco, tDoArco, ponto, direcao, maisPerto } from '../../fonte/comum/bezier.js';
import { VIAS, VIAS_ORDEM, REGRAS_CELULAS } from '../../fonte/data/vias.js';
import { indiceZona } from '../../fonte/data/zonas.js';
import { celulasDaAresta, MOTIVO } from '../../fonte/sim/zonas/blocos.js';
import { crescerNaFrente } from '../../fonte/sim/substitutos.js';
import { aguaEm } from '../../fonte/sim/mundo/terreno.js';

// ------------------------------------------------------------------------------------------------ apoio

const novaSim = (semente, modo = 'livre') => criarSimulacao({ semente, modo });

function via(sim, tipo, pontos, { modo = 'reta', ...extra } = {}) {
  const args = { modo, tipo, pontos, sessao: 1, encaixe: false, ...extra };
  const p = sim.q.via.previa(args);
  const r = p.ok ? sim.cmd('via.construir', { plano: args }) : null;
  assert.ok(r?.ok, `${tipo} ${JSON.stringify(pontos)}: ${JSON.stringify(p.erros)}`);
  return r.dados.arestas.map((ref) => idxDaRef(ref));
}

const vivas = (sim) => {
  const C = sim.tabelas.celulas;
  const out = [];
  for (let c = 0; c < C.n; c++) if (C.viva[c]) out.push(c);
  return out;
};
const validas = (sim) => vivas(sim).filter((c) => sim.tabelas.celulas.estado[c] !== CELULA.INVALIDA);
const bloco = (C, c) => `${C.aresta[c]}:${C.lado[c]}`;
const invariantes = (sim) => {
  assert.deepEqual(sim.erros, []);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) }), []);
};

/** Pares de células válidas de blocos diferentes a menos de `lim` metros. */
function paresPerto(sim, lim) {
  const C = sim.tabelas.celulas;
  const vs = validas(sim);
  let n = 0;
  for (let i = 0; i < vs.length; i++) {
    for (let j = i + 1; j < vs.length; j++) {
      const a = vs[i];
      const b = vs[j];
      if (bloco(C, a) !== bloco(C, b) && Math.hypot(C.x[a] - C.x[b], C.z[a] - C.z[b]) < lim) n++;
    }
  }
  return n;
}

/** Maior distância de um ponto do retângulo [x0, z0, x1, z1] (a cada 2 m) até a célula válida mais perto. */
function maiorVazio(sim, [x0, z0, x1, z1]) {
  const C = sim.tabelas.celulas;
  const vs = validas(sim);
  let pior = 0;
  for (let x = x0; x <= x1; x += 2) {
    for (let z = z0; z <= z1; z += 2) {
      let m = Infinity;
      for (const c of vs) m = Math.min(m, Math.hypot(C.x[c] - x, C.z[c] - z));
      pior = Math.max(pior, m);
    }
  }
  return pior;
}

// ------------------------------------------------------------------------------------------------ blocos

test('blocos: células de 8 m com 6 de fundo dos dois lados, de frente para a via, no passo que atravessa os nós', () => {
  const sim = novaSim('celulas-blocos');
  const A = sim.tabelas.arestas;
  const C = sim.tabelas.celulas;
  const es = via(sim, 'rua', [[-600, -200], [-400, -200]]);
  const meia = VIAS.rua.largura / 2;
  const q = [0, 0];
  const d = [0, 0];
  const mp = { t: 0, d: 0, x: 0, z: 0 };
  let colunasAntes = 0;
  for (const e of es) {
    const cs = celulasDaAresta(sim, e);
    const comp = A.arco[17 * e + 16];
    const fase = ((A.fase[e] % CELULA_M) + CELULA_M) % CELULA_M;
    const ncol = Math.floor((comp - fase) / CELULA_M + 1e-6);
    assert.equal(cs.length, 2 * ncol * LINHAS_BLOCO, `aresta ${e}: ${cs.length} células`);
    for (const c of cs) {
      assert.equal(C.aresta[c], e);
      assert.ok(C.linha[c] < LINHAS_BLOCO && C.coluna[c] < ncol);
      // no eixo: o ponto da coluna e a distância da linha, do lado certo (lado +1 à direita de a para b)
      maisPerto(A.p, C.x[c], C.z[c], 8 * e, mp);
      assert.ok(Math.abs(mp.d - (meia + CELULA_M / 2 + C.linha[c] * CELULA_M)) < 0.05, `célula ${c} a ${mp.d} m`);
      const tab = A.arco.subarray(17 * e, 17 * e + 17);
      const t = tDoArco(tab, fase + CELULA_M * C.coluna[c] + CELULA_M / 2);
      ponto(A.p, t, q, 8 * e);
      direcao(A.p, t, d, 8 * e);
      const lado = Math.sign((C.x[c] - q[0]) * -d[1] + (C.z[c] - q[1]) * d[0]);
      assert.equal(lado, C.lado[c]);
      assert.ok(Math.abs(C.ang[c] - angDaCelula(d[0], d[1], C.lado[c])) < 1e-4, 'a frente olha para a via');
      assert.ok(Math.abs(C.y[c] - sim.alturaEm(C.x[c], C.z[c])) < 1e-3);
      assert.equal(C.estado[c], CELULA.LIVRE, 'rua isolada na planície: todas livres');
    }
    colunasAntes += ncol;
  }
  // o passo de 8 m segue de uma aresta para a próxima (as quebras do greide não abrem vão nem sobrepõem)
  const linha0 = vivas(sim).filter((c) => es.includes(C.aresta[c]) && C.linha[c] === 0 && C.lado[c] === 1).map((c) => C.x[c]).sort((a, b) => a - b);
  for (let k = 1; k < linha0.length; k++) assert.ok(Math.abs(linha0[k] - linha0[k - 1] - CELULA_M) < 0.05, `passo ${linha0[k] - linha0[k - 1]}`);
  assert.equal(linha0.length, colunasAntes);
  invariantes(sim);
});

// ------------------------------------------------------------------------------------------------ esquinas

test('esquinas: cruzamento, T e L sem sobreposição (7 m) nem buraco; fica a de linha menor e depois o bloco mais antigo', () => {
  // grade: as colunas de cada rua caem nas linhas da outra, e a esquina fecha certinho
  const g = novaSim('celulas-esquinas-grade');
  via(g, 'rua', [[-600, -300], [-376, -300], [-376, -76]], { modo: 'grade' });
  assert.equal(paresPerto(g, REGRAS_CELULAS.esquina), 0, 'células de blocos diferentes a menos de 7 m');
  const m = VIAS.rua.largura / 2 + REGRAS_CELULAS.folgaVia;
  const cx = -488;
  const cz = -188;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const q = [Math.min(cx + sx * m, cx + sx * 40), Math.min(cz + sz * m, cz + sz * 40), Math.max(cx + sx * m, cx + sx * 40), Math.max(cz + sz * m, cz + sz * 40)];
    assert.ok(maiorVazio(g, q) <= 5.7, `vão na esquina da grade ${JSON.stringify(q)}: ${maiorVazio(g, q).toFixed(2)} m`);
  }
  invariantes(g);
  // traçado livre: cruzamento, T e L. A via nova alinha as colunas com as linhas da que ela cruza; as colunas da via que
  // já existia não andam (a pintura e os prédios ficam), e onde elas caem entre as linhas da nova sobra no máximo um
  // recorte de meia célula no degrau da esquina.
  const sim = novaSim('celulas-esquinas');
  const C = sim.tabelas.celulas;
  const A = sim.tabelas.arestas;
  via(sim, 'rua', [[-600, -200], [-400, -200]]);
  via(sim, 'rua', [[-500, -300], [-500, -100]]); // cruzamento
  via(sim, 'rua', [[-300, -300], [-300, -100]]); // a haste do T
  via(sim, 'rua', [[-300, -300], [-160, -300]], { encaixe: true }); // o L na ponta dela
  via(sim, 'rua', [[-400, -200], [-300, -200]], { encaixe: true }); // o T
  assert.equal(paresPerto(sim, REGRAS_CELULAS.esquina), 0, 'células de blocos diferentes a menos de 7 m');
  for (const q of [
    [-500 + m, -200 + m, -500 + 40, -200 + 40], [-500 - 40, -200 - 40, -500 - m, -200 - m],
    [-300 - 40, -200 + m, -300 - m, -200 + 40], [-300 + m, -300 + m, -300 + 40, -300 + 40],
  ]) assert.ok(maiorVazio(sim, q) <= 6.4, `vão na esquina ${JSON.stringify(q)}: ${maiorVazio(sim, q).toFixed(2)} m`);
  // nenhuma célula válida a menos de meia largura + 4 m de outra via; toda célula que caiu na esquina tem uma válida de
  // outro bloco a menos de 7 m que vem antes dela (linha menor; mesma linha: aresta mais antiga)
  let naEsquina = 0;
  for (const c of vivas(sim)) {
    if (C.estado[c] !== CELULA.INVALIDA) {
      for (const o of sim.q.viasPerto(C.x[c], C.z[c], 20)) {
        if (idxDaRef(o.ref) === C.aresta[c]) continue;
        assert.ok(o.d >= o.meia + REGRAS_CELULAS.folgaVia - 1e-2, `célula ${c} a ${o.d} m de outra via`);
      }
      continue;
    }
    if (C.motivo[c] !== MOTIVO.ESQUINA) continue;
    naEsquina++;
    const antes = validas(sim).some((o) => {
      if (bloco(C, o) === bloco(C, c) || Math.hypot(C.x[o] - C.x[c], C.z[o] - C.z[c]) >= REGRAS_CELULAS.esquina) return false;
      if (C.linha[o] !== C.linha[c]) return C.linha[o] < C.linha[c];
      return A.idade[C.aresta[o]] < A.idade[C.aresta[c]] || (A.idade[C.aresta[o]] === A.idade[C.aresta[c]] && C.aresta[o] <= C.aresta[c]);
    });
    assert.ok(antes, `célula ${c} na esquina sem vizinha que venha antes`);
  }
  assert.ok(naEsquina > 10, `${naEsquina} células resolvidas pela esquina`);
  invariantes(sim);
});

test('T com encaixe: a via que sai do meio de outra anda para o passo das células dela e as duas esquinas fecham', () => {
  for (const [base, haste] of [['avenida', 'rua'], ['rua', 'avenida'], ['avenida', 'avenida']]) {
    const sim = novaSim('celulas-esquinas-t');
    via(sim, base, [[-600, -200], [-280, -200]]);
    // o toque cai fora do passo; o começo anda até 4 m ao longo da via de baixo
    const args = { modo: 'reta', tipo: haste, pontos: [[-437, -200], [-437, -60]], sessao: 1, encaixe: true };
    const p = sim.q.via.previa(args);
    assert.ok(p.ok, JSON.stringify(p.erros));
    const a = p.encaixes.find((x) => x.indice === 0);
    assert.ok(a?.tipo === 'aresta' && a.passo, JSON.stringify(p.encaixes));
    const X = p.pontos[0][0];
    assert.ok(X !== -437 && Math.abs(X + 437) <= 4, `A em ${X}`);
    assert.ok(sim.cmd('via.construir', { plano: args }).ok);
    const mb = VIAS[base].largura / 2 + REGRAS_CELULAS.folgaVia;
    const mh = VIAS[haste].largura / 2 + REGRAS_CELULAS.folgaVia;
    for (const q of [[X + mh, -200 + mb, X + 40, -200 + 40], [X - 40, -200 + mb, X - mh, -200 + 40]]) {
      assert.ok(maiorVazio(sim, q) <= 5.7, `${base} e ${haste}: vão na esquina ${JSON.stringify(q)} de ${maiorVazio(sim, q).toFixed(2)} m`);
    }
    assert.equal(paresPerto(sim, REGRAS_CELULAS.esquina), 0, `${base} e ${haste}: células de blocos diferentes a menos de 7 m`);
    invariantes(sim);
  }
});

// ------------------------------------------------------------------------------------------------ inválidas

test('células inválidas: água, declive, ladrilho, gleba, curva fechada e outra via perto', () => {
  const sim = novaSim('celulas-invalidas');
  const C = sim.tabelas.celulas;
  const contar = (es) => {
    const n = {};
    for (const e of es) {
      for (const c of celulasDaAresta(sim, e)) {
        for (const [k, b] of Object.entries(MOTIVO)) {
          if (!(C.motivo[c] & b)) continue;
          n[k] = (n[k] ?? 0) + 1;
          assert.equal(C.estado[c], CELULA.INVALIDA, `célula ${c} com ${k} e estado ${C.estado[c]}`);
        }
      }
    }
    return n;
  };
  assert.ok(contar(via(sim, 'rua', [[-700, 650], [-500, 650]])).AGUA > 10, 'beira da lagoa');
  assert.ok(contar(via(sim, 'rua', [[-700, -570], [-500, -570]])).DECLIVE > 10, 'pé do morro');
  assert.ok(contar(via(sim, 'rua', [[990, 0], [990, 200]])).LADRILHO > 10, 'divisa dos ladrilhos');
  assert.ok(contar(via(sim, 'rua', [[-380, 300], [-380, 500]])).GLEBA > 10, 'beira da gleba');
  assert.ok(contar(via(sim, 'rua', [[-300, 0], [-270, 30], [-300, 60]], { modo: 'curva' })).CURVA > 5, 'lado de dentro da curva');
  // duas ruas paralelas a 40 m: as células do meio ficam inválidas pela outra via
  const a = via(sim, 'rua', [[-200, -450], [0, -450]]);
  const b = via(sim, 'rua', [[-200, -410], [0, -410]]);
  assert.ok((contar([...a, ...b]).VIA ?? 0) > 10);
  // nenhuma célula válida com o centro na água ou fora dos ladrilhos
  const T = sim.espelho.terreno;
  for (const c of validas(sim)) {
    assert.equal(aguaEm(T, C.x[c], C.z[c]), AGUA.TERRA, `célula ${c} válida na água`);
    assert.ok(Math.abs(C.x[c]) < 1024 && Math.abs(C.z[c]) < 1024, `célula ${c} fora dos ladrilhos`);
  }
  invariantes(sim);
});

// ------------------------------------------------------------------------------------------------ pintura e divisão

test('dividir a aresta mantém as células e a pintura; alargar a via passa a pintura para a célula nova (até 4 m)', () => {
  const sim = novaSim('celulas-divisao');
  const C = sim.tabelas.celulas;
  const es = via(sim, 'rua', [[-600, -200], [-400, -200]]);
  const z = indiceZona('resBaixa');
  const r = sim.cmd('zona.pintar', { pincel: { modo: 'retangulo', x: -610, z: -260, x2: -390, z2: -140 }, zona: z });
  assert.ok(r.ok && r.dados.n > 100);
  const chave = (c) => `${Math.round(C.x[c] * 10)},${Math.round(C.z[c] * 10)}`;
  const antes = new Map(vivas(sim).filter((c) => C.aresta[c] >= 0 && es.includes(C.aresta[c])).map((c) => [chave(c), C.zona[c]]));
  // uma rua cruza no meio: a rua de antes se divide
  via(sim, 'rua', [[-492, -300], [-492, -100]]);
  let iguais = 0;
  let mudou = 0;
  for (const c of vivas(sim)) {
    const k = chave(c);
    if (!antes.has(k)) continue;
    iguais++;
    if (C.zona[c] !== antes.get(k)) mudou++;
  }
  // só a coluna cortada pelo nó novo sai (dos dois lados)
  assert.ok(iguais >= antes.size - 2 * LINHAS_BLOCO, `${iguais} de ${antes.size} células no mesmo lugar depois de dividir`);
  assert.equal(mudou, 0, 'a pintura fica nas células');
  // alargar a rua (16 para 24 m) afasta as células 4 m: a pintura vai junto
  const A = sim.tabelas.arestas;
  const ruas = [...new Set(vivas(sim).map((c) => C.aresta[c]))].filter((e) => A.viva[e] && Math.abs(A.p[8 * e + 1] + 200) < 1e-6 && Math.abs(A.p[8 * e + 7] + 200) < 1e-6);
  const pintadas = vivas(sim).filter((c) => ruas.includes(C.aresta[c]) && C.zona[c] === z).length;
  assert.ok(sim.cmd('via.melhorar', { arestas: ruas.map((e) => refDe(e, A.ger[e])), tipo: 'avenida' }).ok);
  const depois = vivas(sim).filter((c) => ruas.includes(C.aresta[c]) && C.zona[c] === z);
  assert.ok(depois.length >= pintadas - 12, `${depois.length} de ${pintadas} células pintadas depois de alargar`);
  for (const c of depois) {
    const mp = maisPerto(A.p, C.x[c], C.z[c], 8 * C.aresta[c], { t: 0, d: 0, x: 0, z: 0 });
    assert.ok(Math.abs(mp.d - (VIAS.avenida.largura / 2 + CELULA_M / 2 + C.linha[c] * CELULA_M)) < 0.05);
  }
  invariantes(sim);
});

// ------------------------------------------------------------------------------------------------ pincel

test('pincel: quadra, círculo, retângulo e lista; prévia igual à pintura; apagar; nada; marco da zona', () => {
  const sim = novaSim('celulas-pincel', 'normal');
  const C = sim.tabelas.celulas;
  // uma quadra fechada de 112 m entre eixos (grade de 1 x 1)
  const g = sim.q.via.previa({ modo: 'grade', tipo: 'rua', pontos: [[-600, -300], [-488, -300], [-488, -188]], sessao: 1 });
  assert.ok(g.ok, JSON.stringify(g.erros));
  assert.ok(sim.cmd('via.construir', { plano: { modo: 'grade', tipo: 'rua', pontos: [[-600, -300], [-488, -300], [-488, -188]], sessao: 1 } }).ok);
  const z = indiceZona('resBaixa');
  // quadra: o toque no miolo pega os quatro blocos de dentro até o fundo pedido
  const miolo = { modo: 'quadra', x: -544, z: -244 };
  const pv = sim.q.zona.previa({ pincel: miolo, zona: z });
  assert.ok(pv.celulas instanceof Int32Array && pv.celulas.length > 50);
  assert.equal(pv.comPredio, 0);
  assert.equal(pv.efeitoMedia, 0, 'sem a S2a o efeito é 0');
  const centro = [-544, -244];
  for (const c of pv.celulas) {
    assert.ok(Math.abs(C.x[c] - centro[0]) < 56 && Math.abs(C.z[c] - centro[1]) < 56, `célula ${c} fora da quadra`);
    assert.equal(C.estado[c], CELULA.LIVRE);
  }
  const raso = sim.q.zona.previa({ pincel: { ...miolo, fundo: 2 }, zona: z });
  assert.ok(raso.celulas.length < pv.celulas.length && [...raso.celulas].every((c) => C.linha[c] < 2));
  const r = sim.cmd('zona.pintar', { pincel: miolo, zona: z });
  assert.ok(r.ok);
  assert.equal(r.dados.n, pv.celulas.length, 'a prévia diz as células que a pintura muda');
  for (const c of pv.celulas) assert.equal(C.zona[c], z);
  assert.equal(sim.cmd('zona.pintar', { pincel: miolo, zona: z }).codigo, 'nada');
  // círculo e retângulo (girado) pegam só células válidas dentro da forma
  const circ = sim.q.zona.previa({ pincel: { modo: 'circulo', x: -600, z: -250, raio: 30 }, zona: indiceZona('comBaixa') });
  assert.ok(circ.celulas.length > 0);
  for (const c of circ.celulas) assert.ok(Math.hypot(C.x[c] + 600, C.z[c] + 250) <= 30 && C.estado[c] !== CELULA.INVALIDA);
  const ret = sim.q.zona.previa({ pincel: { modo: 'retangulo', x: -700, z: -320, x2: -620, z2: -170, rot: 0 }, zona: indiceZona('industria') });
  assert.ok(ret.celulas.length > 0);
  for (const c of ret.celulas) assert.ok(C.x[c] >= -700 && C.x[c] <= -620 && C.z[c] >= -320 && C.z[c] <= -170);
  // lista de células; apagar é a zona 0
  const lista = [...pv.celulas].slice(0, 5);
  assert.equal(sim.cmd('zona.pintar', { pincel: { modo: 'celulas', celulas: lista }, zona: 0 }).dados.n, 5);
  for (const c of lista) assert.equal(C.zona[c], 0);
  // zona trancada pelo marco (residencial alta no marco 4)
  assert.equal(sim.cmd('zona.pintar', { pincel: miolo, zona: indiceZona('resAlta') }).codigo, 'marco');
  assert.equal(sim.q.zona.previa({ pincel: miolo, zona: indiceZona('resAlta') }).liberada, false);
  assert.equal(sim.cmd('zona.pintar', { pincel: { modo: 'nada' }, zona: z }).codigo, 'valor');
  invariantes(sim);
});

test('prédio: pintar outra zona marca para sair ao ser abandonado e voltar à zona tira a marca', () => {
  const sim = novaSim('celulas-predio');
  const C = sim.tabelas.celulas;
  const P = sim.tabelas.predios;
  const [e] = via(sim, 'rua', [[-600, -200], [-500, -200]]);
  const z = indiceZona('resBaixa');
  const lado = celulasDaAresta(sim, e).filter((c) => C.lado[c] === 1 && C.linha[c] < 2 && C.coluna[c] < 2);
  assert.equal(lado.length, 4);
  sim.cmd('zona.pintar', { pincel: { modo: 'celulas', celulas: lado }, zona: z });
  const i = crescerNaFrente(sim, lado, { modelo: 'casa' });
  assert.ok(i >= 0);
  const pv = sim.q.zona.previa({ pincel: { modo: 'celulas', celulas: lado }, zona: indiceZona('comBaixa') });
  assert.equal(pv.comPredio, 4);
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'celulas', celulas: lado }, zona: indiceZona('comBaixa') }).ok);
  assert.ok(P.flags[i] & PREDIO.DEMOLIR_AO_ABANDONAR, 'marcado, não demolido');
  assert.ok(P.viva[i]);
  assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'celulas', celulas: lado }, zona: z }).ok);
  assert.ok(!(P.flags[i] & PREDIO.DEMOLIR_AO_ABANDONAR));
  // a quadra não pinta por cima de célula ocupada
  const q = sim.q.zona.previa({ pincel: { modo: 'quadra', x: -550, z: -180 }, zona: indiceZona('industria') });
  assert.ok([...q.celulas].every((c) => C.predio[c] < 0));
  invariantes(sim);
});
