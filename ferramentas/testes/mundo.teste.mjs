// Testes do mundo (S1a): mapa autoral, grade de alturas no tempo, área inicial num componente de terra (D53), água,
// aplainar puro e comutativo igual ao de referência bit a bit (D5), chão do espelho em dia e depois de carregar, Vila e
// rodovia, ladrilhos (D3), mata e desmate, recursos e camada, áreas e sugestões (D36, D55), save de ida e volta.
// Roda sozinho: node ferramentas/testes/mundo.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { criarSim } from '../../fonte/sim/nucleo.js';
import { conferirEspelho } from '../../fonte/contratos/espelho.js';
import { AGUA, ARESTA, LADRILHO, TIPO_PREDIO } from '../../fonte/contratos/flags.js';
import { CAMADAS } from '../../fonte/contratos/camadas.js';
import { alturaEm } from '../../fonte/comum/altura.js';
import { fnv1aTipado } from '../../fonte/comum/hash.js';
import { pontoNoPoligono } from '../../fonte/comum/vetor.js';
import { aplainarReferencia } from '../../fonte/sim/substitutos.js';
import { normalizarForma } from '../../fonte/sim/formas.js';
import { montarSave, lerSave, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { VIAS_ORDEM } from '../../fonte/data/vias.js';
import { MAPA_HELDOPOLIS } from '../../fonte/data/mapa-heldopolis.js';
import { gerarTerreno, esquecerTerreno, terrenoBase, rioEm, aguaEm } from '../../fonte/sim/mundo/terreno.js';
import { aplainar, aplainarTudo, formaDaAresta } from '../../fonte/sim/mundo/aplainar.js';
import { concederLicencas, preco, ladrilhoDe } from '../../fonte/sim/mundo/ladrilhos.js';
import { extrair, RECURSOS, recursoNoPoligono } from '../../fonte/sim/mundo/recursos.js';
import { densidadeEm } from '../../fonte/sim/mundo/floresta.js';
import { nivelAguaEm, contarAgua } from '../../fonte/sim/mundo/agua.js';
import { conferirMapa } from '../mapa.mjs';

const agora = () => performance.now();

// sorteio próprio dos testes (fora da simulação)
function sorteio(semente = 1) {
  let a = semente >>> 0 || 1;
  return () => {
    a ^= a << 13;
    a >>>= 0;
    a ^= a >>> 17;
    a ^= a << 5;
    a >>>= 0;
    return a / 4294967296;
  };
}

const hashGrade = (g) => fnv1aTipado(new Uint8Array(g.buffer, g.byteOffset, g.byteLength));
const simDoMapa = (semente = 'mundo') => criarSimulacao({ semente });

// ------------------------------------------------------------------------------------------------ grade

test('mapa: grade 1025² a 8 m gerada em até 150 ms (motor aquecido), determinística, finita e em faixas reais', () => {
  const a = gerarTerreno();
  const hA = hashGrade(a.altura);
  // tempo de CPU do processo (a máquina de teste roda outras parcelas junto; o relógio de parede mede a fila)
  const medidas = [];
  const paredes = [];
  let b = null;
  for (let r = 0; r < 4; r++) {
    esquecerTerreno(MAPA_HELDOPOLIS.id);
    const c0 = process.cpuUsage();
    const t0 = agora();
    b = gerarTerreno();
    paredes.push(agora() - t0);
    const c = process.cpuUsage(c0);
    medidas.push((c.user + c.system) / 1000);
  }
  const melhor = Math.min(...medidas);
  console.log(`# grade 1025²: CPU ${medidas.map((m) => m.toFixed(0)).join(', ')} ms; relógio ${paredes.map((m) => m.toFixed(0)).join(', ')} ms`);
  assert.ok(melhor <= 150, `grade em ${melhor.toFixed(0)} ms de CPU (meta 150)`);
  assert.equal(b.n, 1025);
  assert.equal(b.passo, 8);
  assert.deepEqual(b.origem, [-4096, -4096]);
  assert.equal(hashGrade(b.altura), hA, 'duas gerações dão a mesma grade bit a bit');
  assert.equal(hashGrade(b.agua), hashGrade(a.agua));
  let mn = Infinity;
  let mx = -Infinity;
  for (const h of b.altura) {
    assert.ok(Number.isFinite(h));
    if (h < mn) mn = h;
    if (h > mx) mx = h;
  }
  assert.ok(mn > -40 && mn < -10, `fundo do mar ${mn.toFixed(1)} m`);
  assert.ok(mx > 380 && mx < 560, `ponto mais alto ${mx.toFixed(1)} m`);
  const c = contarAgua(b);
  for (const k of ['terra', 'mar', 'rio', 'lagoa']) assert.ok(c[k] > 200, `${k}: ${c[k]} amostras`);
});

test('mapa: morros de 150 a 400 m, Pedra do Farol perto de 396 m, platô da gleba na cota do envelope', () => {
  const T = gerarTerreno();
  const topo = (m) => {
    let h = -Infinity;
    for (let dz = -16; dz <= 16; dz += 8) for (let dx = -16; dx <= 16; dx += 8) h = Math.max(h, alturaEm(T, m.x + dx, m.z + dz));
    return h;
  };
  for (const m of MAPA_HELDOPOLIS.morros) {
    const h = topo(m);
    assert.ok(Math.abs(h - m.h) < Math.max(18, m.h * 0.12), `${m.id}: topo ${h.toFixed(0)} m, esperado ${m.h}`);
  }
  const [x0, z0, x1, z1] = MAPA_HELDOPOLIS.plato.caixa;
  for (const [x, z] of [[x0 + 60, z0 + 60], [(x0 + x1) / 2, (z0 + z1) / 2], [x1 - 60, z0 + 60]]) {
    assert.ok(Math.abs(alturaEm(T, x, z) - MAPA_HELDOPOLIS.plato.cota) < 0.01, `platô em (${x}, ${z})`);
  }
});

test('água: fundo abaixo do nível em toda amostra de água; rio da nascente à foz descendo; lagoa fechada', () => {
  const sim = simDoMapa();
  const T = sim.espelho.terreno;
  const tb = terrenoBase(sim);
  const lagoa = MAPA_HELDOPOLIS.lagoa.nivel;
  let ruins = 0;
  for (let j = 0; j < T.n; j += 3) {
    for (let i = 0; i < T.n; i += 3) {
      const k = j * T.n + i;
      const a = tb.base.agua[k];
      if (!a) continue;
      const h = tb.base.altura[k];
      const x = T.origem[0] + i * T.passo;
      const z = T.origem[1] + j * T.passo;
      const nivel = a === AGUA.MAR ? 0 : a === AGUA.LAGOA ? lagoa : rioEm(tb.base, x, z).nivel;
      if (!(h < nivel)) ruins++;
    }
  }
  assert.equal(ruins, 0, `${ruins} amostras de água com o fundo acima do nível`);
  const R = T.rios[0].pontos;
  assert.ok(R.length / 4 > 50);
  for (let q = 4; q < R.length; q += 4) assert.ok(R[q + 2] <= R[q - 2] + 1e-9, 'o nível do rio só desce');
  assert.equal(T.lagoas[0].nivel, lagoa);
  assert.equal(nivelAguaEm(sim, 600, 2000), 0);
  assert.equal(nivelAguaEm(sim, -600, 820), lagoa);
  assert.equal(nivelAguaEm(sim, 0, 0), null);
});

test('mapa: área inicial num componente só de terra (D53); rocha, areia e argila dentro, calcário e orla fora (D3)', () => {
  const r = conferirMapa(simDoMapa());
  assert.deepEqual(r.falhas, []);
  assert.equal(r.medidas.componentes, 1);
  // o rio é a borda oeste: corre fora da área inicial, com a margem leste encostando nela (a captação e o Areal
  // chegam na água), e nunca entra mais que 30 m
  const T = gerarTerreno();
  let rioLonge = 0;
  let rioMargem = 0;
  let rioFora = 0;
  for (let z = -1024; z < 1024; z += 8) {
    for (let x = -1024; x < 1024; x += 8) {
      if (aguaEm(T, x, z) !== AGUA.RIO) continue;
      if (x < -994) rioMargem++;
      else rioLonge++;
    }
    for (let x = -1300; x < -1024; x += 8) if (aguaEm(T, x, z) === AGUA.RIO) rioFora++;
  }
  assert.equal(rioLonge, 0);
  assert.ok(rioMargem > 20, 'a margem leste do rio chega na área inicial');
  assert.ok(rioFora > rioMargem * 3);
});

// ------------------------------------------------------------------------------------------------ aplainar

test('aplainar: comutativo e igual ao de referência da F0 bit a bit, com save no meio e cava (D5)', () => {
  const T = gerarTerreno();
  const r = sorteio(7);
  const formas = [];
  for (let k = 0; k < 7; k++) {
    const cx = -300 + r() * 600;
    const cz = -400 + r() * 500;
    if (k % 3 === 0) {
      formas.push({ tipo: 'via', ref: 100 + k, eixo: [cx - 120, cz, 12 + r() * 4, cx, cz + 30, 11, cx + 140, cz + 10, 13], meiaLargura: 8 });
    } else {
      const w = 12 + r() * 30;
      formas.push({ tipo: k % 3 === 1 ? 'plataforma' : 'cava', ref: 10 + k, contorno: [cx, cz, cx + w, cz, cx + w, cz + w, cx, cz + w], cota: 8 + r() * 6 });
    }
  }
  const ret = [-600, -700, 600, 400];
  const jogar = (ordem, salvarNoMeio = false) => {
    let sim = criarSim({ semente: 'aplainar' });
    const grade = T.altura.slice();
    let v = sim.mudancas.desde(-1).versao;
    ordem.forEach((k, i) => {
      if (salvarNoMeio && i === 3) {
        const novo = criarSim({ semente: 'aplainar' });
        aplicarSave(novo, lerSave(montarSave(sim)));
        sim = novo;
        v = sim.mudancas.desde(-1).versao;
      }
      sim.formas.registrar(formas[k]);
      const d = sim.mudancas.desde(v);
      v = d.versao;
      for (const q of d.terreno) aplainar(T, sim.formas.porId.values(), q, grade);
    });
    return grade;
  };
  const a = jogar([0, 1, 2, 3, 4, 5, 6]);
  const b = jogar([6, 5, 4, 3, 2, 1, 0]);
  const c = jogar([3, 0, 6, 1, 5, 2, 4], true);
  const norm = formas.map(normalizarForma);
  const ref = aplainarReferencia(T, norm, ret, T.altura.slice());
  const tudo = aplainarTudo(T, norm, new Float32Array(T.altura.length));
  assert.equal(hashGrade(a), hashGrade(b));
  assert.equal(hashGrade(a), hashGrade(c));
  assert.equal(hashGrade(a), hashGrade(ref), 'igual ao aplainar de referência da F0');
  assert.equal(hashGrade(a), hashGrade(tudo), 'refazer tudo dá o mesmo que refazer por retângulos');
});

test('aplainar: o chão do espelho segue as formas na hora, volta ao remover e sai igual depois de carregar', () => {
  const sim = simDoMapa('aplainar-espelho');
  const T = sim.espelho.terreno;
  const antes = T.altura.slice();
  const v = sim.mudancas.desde(-1).versao;
  const id = sim.formas.registrar({ tipo: 'plataforma', ref: 999999, contorno: [100, -300, 160, -300, 160, -250, 100, -250], cota: 30 });
  assert.equal(sim.alturaEm(130, -275), 30);
  assert.ok(sim.mudancas.desde(v).terreno.length > 0);
  sim.formas.remover(id);
  assert.equal(hashGrade(T.altura), hashGrade(antes), 'remover volta ao chão de antes, bit a bit');
  // save e carga: a grade não vai no save e sai igual (base mais as formas)
  sim.formas.registrar({ tipo: 'cava', ref: 999998, contorno: [200, -200, 260, -200, 260, -140, 200, -140], cota: 2 });
  const hGrade = hashGrade(T.altura);
  const nova = criarSimulacao({ semente: 'aplainar-espelho' });
  aplicarSave(nova, lerSave(montarSave(sim)));
  assert.equal(hashGrade(nova.espelho.terreno.altura), hGrade);
  assert.equal(nova.hash(), sim.hash());
  assert.deepEqual(nova.validar(), []);
});

// ------------------------------------------------------------------------------------------------ Vila e rodovia

test('Vila e rodovia: ~60 prédios e ~350 moradores, rua principal e terra, ponte, nó de entrada, invariantes', () => {
  const sim = simDoMapa('vila');
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const P = sim.tabelas.predios;
  const M = sim.json.mapa;
  assert.ok(M.predios.length >= 50 && M.predios.length <= 75, `${M.predios.length} prédios`);
  assert.ok(M.moradores >= 330 && M.moradores <= 380, `${M.moradores} moradores`);
  assert.equal(sim.agregados.populacao, M.moradores);
  assert.deepEqual(sim.erros, []);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) }), []);
  // tipos: rodovia com a flag, uma ponte, rua principal e ruas de terra
  const tipos = {};
  let pontes = 0;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    const t = VIAS_ORDEM[A.tipo[e]];
    tipos[t] = (tipos[t] ?? 0) + 1;
    if (t === 'rodovia') assert.ok(A.flags[e] & ARESTA.RODOVIA);
    if (A.flags[e] & ARESTA.PONTE) {
      pontes++;
      // a ponte passa por cima do rio, com vão livre
      const r = rioEm(terrenoBase(sim).base, (A.p[8 * e] + A.p[8 * e + 6]) / 2, (A.p[8 * e + 1] + A.p[8 * e + 7]) / 2);
      assert.ok(r.a < r.hw, 'a ponte cruza o rio');
      assert.ok(Math.min(A.y[2 * e], A.y[2 * e + 1]) > r.nivel + 6, 'vão livre sobre a água');
    }
  }
  assert.equal(pontes, 1);
  assert.ok(tipos.rodovia > 20 && tipos.terra > 10 && tipos.rua >= 2, JSON.stringify(tipos));
  // greide da rodovia até 6%
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e] || VIAS_ORDEM[A.tipo[e]] !== 'rodovia') continue;
    const g = Math.abs(A.y[2 * e + 1] - A.y[2 * e]) / A.comp[e];
    assert.ok(g <= 0.06, `rodovia com ${(g * 100).toFixed(1)}% na aresta ${e}`);
  }
  // nó de entrada: fim do acesso, ligado à rodovia, dentro da área inicial
  const ent = M.entrada % 1048576;
  assert.ok(N.viva[ent]);
  assert.equal(N.grau[ent], 1);
  const [i, j] = ladrilhoDe(N.x[ent], N.z[ent]);
  assert.equal(sim.espelho.ladrilhos.estado[j * 16 + i], LADRILHO.HOLDING);
  // prédios da Vila: de zona, nível 1 ou 2, sobre terra firme e dentro da área da Vila
  const vila = sim.espelho.areas.find((a) => a.id === 'vila');
  for (const ref of M.predios) {
    const p = ref % 1048576;
    assert.equal(P.tipo[p], TIPO_PREDIO.ZONA);
    assert.ok(P.nivel[p] === 1 || P.nivel[p] === 2);
    assert.ok(pontoNoPoligono(P.x[p], P.z[p], vila.contorno), `prédio ${p} fora da Vila`);
  }
  // determinístico
  const outra = simDoMapa('vila');
  assert.equal(outra.hash(), sim.hash());
});

// ------------------------------------------------------------------------------------------------ ladrilhos

test('ladrilhos (D3): 4 x 4 iniciais, vizinhos à venda, licença, preço, crédito, Influência e o evento', () => {
  const sim = simDoMapa('ladrilhos');
  const L = sim.espelho.ladrilhos;
  let holding = 0;
  let compraveis = 0;
  for (let k = 0; k < 256; k++) {
    if (L.estado[k] === LADRILHO.HOLDING) holding++;
    if (L.estado[k] === LADRILHO.COMPRAVEL) compraveis++;
  }
  assert.equal(holding, 16);
  assert.equal(compraveis, 16);
  assert.equal(L.estado[6 * 16 + 6], LADRILHO.HOLDING);
  assert.equal(L.estado[7 * 16 + 10], LADRILHO.COMPRAVEL);
  assert.equal(L.preco[7 * 16 + 10], 40000);
  assert.equal(sim.cmd('ladrilho.comprar', { i: 10, j: 7 }).codigo, 'licenca');
  concederLicencas(sim, 2);
  assert.equal(sim.q.ladrilhos().licencas, 2);
  assert.equal(sim.cmd('ladrilho.comprar', { i: 12, j: 7 }).codigo, 'vizinho');
  assert.equal(sim.cmd('ladrilho.comprar', { i: 7, j: 7 }).codigo, 'comprado');
  assert.equal(sim.cmd('ladrilho.comprar', { i: 99, j: 7 }).codigo, 'valor');
  const caixa = sim.holding.caixa();
  const eventos = [];
  sim.on('ladrilho', (d) => eventos.push(d));
  assert.equal(sim.cmd('ladrilho.comprar', { i: 10, j: 7 }).ok, true);
  assert.equal(caixa - sim.holding.caixa(), 40000);
  assert.deepEqual(eventos, [{ i: 10, j: 7 }]);
  assert.equal(L.estado[7 * 16 + 11], LADRILHO.COMPRAVEL, 'o vizinho do novo passa a estar à venda');
  assert.equal(preco(sim), 46000, 'o segundo custa 15% mais');
  // Influência 50 tira 10% (S3a publica q.holding; aqui um substituto)
  sim.registrarConsulta('holding', () => ({ influencia: 50 }));
  assert.equal(preco(sim), 41400);
  // sem crédito
  sim.holding.pagar(sim.holding.caixa(), 'teste');
  assert.equal(sim.cmd('ladrilho.comprar', { i: 11, j: 7 }).codigo, 'creditos');
  assert.equal(sim.q.ladrilhos().licencas, 1, 'a recusa não gasta a licença');
  // Modo livre: sem licença e sem preço
  const livre = criarSimulacao({ semente: 'ladrilhos-livre', modo: 'livre' });
  assert.equal(livre.cmd('ladrilho.comprar', { i: 5, j: 8 }).ok, true);
  // save: a posse e as licenças voltam
  const nova = criarSimulacao({ semente: 'ladrilhos' });
  aplicarSave(nova, lerSave(montarSave(sim)));
  assert.equal(nova.espelho.ladrilhos.estado[7 * 16 + 10], LADRILHO.HOLDING);
  assert.equal(nova.q.ladrilhos().licencas, 1);
});

// ------------------------------------------------------------------------------------------------ mata e recursos

test('floresta (D6): mata fechada nas serras, praia sem mata, cidade aberta; desmate sob as formas', () => {
  const sim = simDoMapa('mata');
  const F = sim.espelho.floresta;
  assert.equal(F.n, 1024);
  assert.equal(F.passo, 8);
  const media = (x0, z0, x1, z1) => {
    let s = 0;
    let n = 0;
    for (let z = z0; z < z1; z += 16) for (let x = x0; x < x1; x += 16) {
      s += densidadeEm(F, x, z);
      n++;
    }
    return s / n;
  };
  assert.ok(media(-1500, -2500, 1500, -2000) > 0.7, 'serra do Held coberta');
  assert.ok(media(-300, -300, 300, 100) < 0.3, 'planície da cidade aberta');
  assert.ok(media(-300, 998, 300, 1000) < 0.1, 'praia sem mata');
  // desmate: uma plataforma nova limpa a mata sob ela e marca o diário
  const v = sim.mudancas.desde(-1).versao;
  const x = -1000;
  const z = -2200;
  assert.ok(densidadeEm(F, x, z) > 0.5);
  sim.formas.registrar({ tipo: 'plataforma', ref: 424242, contorno: [x - 20, z - 20, x + 20, z - 20, x + 20, z + 20, x - 20, z + 20], cota: 300 });
  assert.equal(densidadeEm(F, x, z), 0);
  assert.ok(sim.mudancas.desde(v).floresta.length > 0);
});

test('recursos: grades 256², extração baixa o valor e a camada Recursos segue o contrato', () => {
  const sim = simDoMapa('recursos');
  const E = sim.espelho.recursos;
  assert.equal(E.n, 256);
  assert.equal(E.passo, 32);
  for (const r of RECURSOS) assert.equal(E[r].length, 65536);
  // pedreira sugerida fica sobre rocha, areal sobre areia, olaria sobre argila
  const S = Object.fromEntries(sim.q.sugestoes().map((s) => [s.id, s]));
  const quadrado = (s, r) => [s.x - r, s.z - r, s.x + r, s.z - r, s.x + r, s.z + r, s.x - r, s.z + r];
  assert.ok(recursoNoPoligono(E, 'rocha', quadrado(S.pedreira, 40)).media > 90);
  assert.ok(recursoNoPoligono(E, 'areia', quadrado(S.areal, 40)).media > 90);
  assert.ok(recursoNoPoligono(E, 'argila', quadrado(S.olaria, 40)).media > 90);
  const pol = quadrado(S.pedreira, 40);
  const antes = recursoNoPoligono(E, 'rocha', pol).soma;
  const v0 = sim.q.camada('recursos').versao;
  assert.equal(extrair(sim, 'rocha', pol, 300), 300);
  assert.equal(recursoNoPoligono(E, 'rocha', pol).soma, antes - 300);
  const c = sim.q.camada('recursos');
  assert.ok(c.versao > v0);
  assert.equal(c.id, 'recursos');
  assert.equal(c.fonte, CAMADAS.recursos.fonte);
  assert.equal(c.tipo, CAMADAS.recursos.tipo);
  assert.ok(c.dados instanceof Float32Array && c.dados.length === 65536);
  assert.deepEqual(c.grade, { n: 256, passo: 32, origem: [-4096, -4096] });
  assert.equal(c.legenda.length, 6);
  // save: a extração fica
  const nova = criarSimulacao({ semente: 'recursos' });
  aplicarSave(nova, lerSave(montarSave(sim)));
  assert.equal(recursoNoPoligono(nova.espelho.recursos, 'rocha', pol).soma, antes - 300);
});

// ------------------------------------------------------------------------------------------------ áreas e sugestões

test('áreas (D55) e sugestões (D36): formato, dentro da área inicial, avenida do nó de entrada ao portão norte', () => {
  const sim = simDoMapa('sugestoes');
  const ids = sim.espelho.areas.map((a) => a.id).sort();
  assert.deepEqual(ids, ['gleba', 'morros', 'orla', 'varzea', 'vila']);
  for (const a of sim.espelho.areas) assert.ok(a.contorno instanceof Float64Array && a.contorno.length >= 6 && a.nome);
  const S = sim.q.sugestoes();
  const h0 = sim.hash();
  sim.q.sugestoes();
  assert.equal(sim.hash(), h0, 'consulta pura');
  const porId = Object.fromEntries(S.map((s) => [s.id, s]));
  for (const id of ['avenida', 'quadra1', 'entrada', 'captacao', 'usina', 'escritorio', 'pedreira', 'areal', 'olaria']) assert.ok(porId[id], id);
  const N = sim.tabelas.nos;
  const ent = sim.json.mapa.entrada % 1048576;
  assert.deepEqual(porId.avenida.pontos[0], [N.x[ent], N.z[ent]]);
  assert.equal(porId.entrada.ref, sim.json.mapa.entrada);
  const T = sim.espelho.terreno;
  for (const s of S) {
    const pts = s.pontos ?? [[s.x, s.z]];
    for (const [x, z] of pts) {
      assert.ok(x >= -1024 && x <= 1024 && z >= -1024 && z <= 1024, `${s.id} fora da área inicial`);
      assert.equal(aguaEm(T, x, z), AGUA.TERRA, `${s.id} na água`);
    }
  }
  // a captação fica na beira do rio, acima da Vila
  const r = rioEm(terrenoBase(sim).base, porId.captacao.x, porId.captacao.z);
  assert.ok(r.a - r.hw < 60, 'captação na margem');
  assert.ok(porId.captacao.z < 560, 'rio acima da Vila');
});

// ------------------------------------------------------------------------------------------------ save

test('save: ida e volta com o mapa (hash, chão, mata, recursos, ladrilhos) e tiques sem erro', () => {
  const sim = simDoMapa('save-mundo');
  sim.rodar(40);
  const nova = criarSimulacao({ semente: 'save-mundo' });
  aplicarSave(nova, lerSave(montarSave(sim)));
  assert.equal(nova.hash(), sim.hash());
  assert.equal(hashGrade(nova.espelho.terreno.altura), hashGrade(sim.espelho.terreno.altura));
  assert.equal(hashGrade(nova.espelho.floresta.dens), hashGrade(sim.espelho.floresta.dens));
  assert.deepEqual(nova.validar(), []);
  nova.rodar(40);
  sim.rodar(40);
  assert.equal(nova.hash(), sim.hash());
  assert.deepEqual([...sim.erros, ...nova.erros], []);
});
