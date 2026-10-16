// Trânsito agregado com efeitos (dona: S1c; D15, D37, seção 9 do desenho da simulação): a tarefa pura (gravidade, BPR em 3
// passadas, conservação, sem rota, bit a bit), as zonas de 256 e 512 m, o pedido a cada 60 tiques em 6 fatias e a
// aplicação 60 tiques depois (espelho.fluxos, S.agregados.trajeto), o hash igual com worker simulado, worker que morre
// e save no meio, os efeitos da D37 (produtividade pelo trajeto, clientes do comércio, cobertura de saúde e bombeiros
// pelo custo congestionado, bem-estar), a camada, o aviso "trânsito parado" com a aresta e a sugestão e o gargalo que a
// ferramenta de melhorar resolve. Roda sozinho: node ferramentas/testes/transito.teste.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { addNo } from '../../fonte/sim/vias/grafo.js';
import { atribuir, MODELO } from '../../fonte/sim/tarefas/transito.js';
import { executarAteOFim } from '../../fonte/sim/tarefas.js';
import { criarTrabalhadorSimulado } from '../../fonte/sim/trabalhador.js';
import {
  TRANSITO, entradaTransito, aplicarTransito, derivarTransito, capacidade, gargalos, sugestaoPara, resumoTransito,
} from '../../fonte/sim/transito.js';
import * as transitoModulo from '../../fonte/sim/transito.js';
import { calcularBemEstar } from '../../fonte/sim/bemestar.js';
import { calcularDemanda } from '../../fonte/sim/zonas/demanda.js';
import { garantirCobertura, coberturaNoPonto, sistemaCargas } from '../../fonte/sim/servicos.js';
import { terminarObra } from '../../fonte/sim/zonas/crescimento.js';
import { nomeDaAresta } from '../../fonte/sim/vias/nomes.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { idxDaRef, conferirEspelho } from '../../fonte/contratos/espelho.js';
import { TIPO_PREDIO } from '../../fonte/contratos/flags.js';
import { CAMADAS } from '../../fonte/contratos/camadas.js';
import { VIAS_ORDEM } from '../../fonte/data/vias.js';
import { temTexto, t } from '../../fonte/ui/textos.js';
import { gerarCidadeSintetica, SINTETICA } from '../cidade-sintetica.mjs';
import { simS3a, predioHolding } from '../robo/cidade-faz-de-conta.mjs';

const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

// ------------------------------------------------------------------------------------------------ a tarefa pura

/** Grafo de teste no formato da tarefa: arcos { de, para, t0, cap }; a ligação k leva o rótulo 2 x aresta + sentido. */
function grafoDe(n, arcos) {
  const ordem = arcos.map((a, k) => ({ ...a, k })).sort((x, y) => x.de - y.de || x.k - y.k);
  const m = ordem.length;
  const g = {
    n, ini: new Int32Array(n + 1), de: new Int32Array(m), dest: new Int32Array(m), ar: new Int32Array(m), t0: new Float32Array(m),
    cap: new Float32Array(m),
  };
  ordem.forEach((a, k) => {
    g.ini[a.de + 1]++;
    g.de[k] = a.de;
    g.dest[k] = a.para;
    g.ar[k] = a.ar;
    g.t0[k] = a.t0;
    g.cap[k] = a.cap;
  });
  for (let v = 0; v < n; v++) g.ini[v + 1] += g.ini[v];
  return g;
}

/** Linha de nós 0-1-...-(n-1) com uma aresta por trecho (dupla): aresta e liga e e e + 1, ar = 2 e + sentido. */
function linha(n, t0 = 1, cap = 1000) {
  const arcos = [];
  for (let e = 0; e + 1 < n; e++) {
    arcos.push({ de: e, para: e + 1, ar: 2 * e, t0, cap });
    arcos.push({ de: e + 1, para: e, ar: 2 * e + 1, t0, cap });
  }
  return { grafo: grafoDe(n, arcos), nArestas: n - 1 };
}

const entradaDe = (g, nArestas, zonas) => {
  const n = g.n;
  const e = {
    grafo: g, nArestas, Z: zonas.length, noZona: new Int16Array(n).fill(-1), prod: new Float32Array(n), atr: new Float32Array(n),
    atrCom: new Float32Array(n), anterior: new Float32Array(2 * nArestas),
  };
  zonas.forEach((z, k) => {
    for (const [no, p, a, c = 0] of z) {
      e.noZona[no] = k;
      e.prod[no] += p;
      e.atr[no] += a;
      e.atrCom[no] += c;
    }
  });
  return e;
};

const iguais = (a, b) => Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0;

test('tarefa: conserva as viagens, divide pela gravidade (perto e atraente atraem mais) e a carga desce pela árvore', () => {
  // 0 -1 -2 -3 -4 -5: a zona 0 (nó 0) produz 100; as zonas 1 (nó 1, perto) e 2 (nó 5, longe) atraem 100 cada
  const { grafo, nArestas } = linha(6, 2, 5000);
  const e = entradaDe(grafo, nArestas, [[[0, 100, 0]], [[1, 0, 100]], [[5, 0, 100]]]);
  const s = executarAteOFim(atribuir, e);
  assert.equal(s.fluxo.length, 2 * nArestas);
  const f = (aresta, sentido = 0) => s.fluxo[2 * aresta + sentido];
  assert.ok(Math.abs(f(0) - 100) < 1e-3, `toda a produção sai pela primeira aresta: ${f(0)}`);
  assert.ok(Math.abs(s.viagens - 100) < 1e-3);
  assert.equal(s.semRota, 0);
  // o fluxo só cai nos trechos depois da zona 1 (as viagens que acabaram lá saem da árvore)
  assert.ok(f(1) < f(0) && f(1) > 0);
  assert.ok(Math.abs(f(1) - f(4)) < 1e-3, 'depois da zona 1 só segue quem vai à zona 2');
  const longe = f(4) / 100;
  assert.ok(longe < 0.5, `a zona longe recebe menos que a perto (${longe})`);
  // sentido contrário vazio
  for (let a = 0; a < nArestas; a++) assert.equal(f(a, 1), 0);
  // dobrando a atração da zona longe, ela ganha viagens
  const e2 = entradaDe(grafo, nArestas, [[[0, 100, 0]], [[1, 0, 100]], [[5, 0, 200]]]);
  const s2 = executarAteOFim(atribuir, e2);
  assert.ok(s2.fluxo[2 * 4] / 100 > longe + 0.05);
  // tempo médio: terminal de 2 min mais o trecho; a zona longe chega depois
  assert.ok(s.tSaida[0] > MODELO.terminal && s.tDestino[2] > s.tDestino[1]);
  // a viagem dentro da zona não carrega a rede: uma zona que produz e atrai
  const e3 = entradaDe(grafo, nArestas, [[[0, 100, 100]], [[3, 0, 100]]]);
  const s3 = executarAteOFim(atribuir, e3);
  const fora = s3.fluxo[0];
  assert.ok(fora > 0 && fora < 100, `parte das viagens fica na zona (${fora})`);
});

test('tarefa: a curva BPR em 3 passadas tira carga da rota cheia para a livre; sem caminho vira semRota', () => {
  // dois caminhos de 0 a 3: pelo nó 1 (1 min, capacidade 100) e pelo nó 2 (3 min, capacidade 5000)
  const arcos = [
    { de: 0, para: 1, ar: 0, t0: 0.5, cap: 100 }, { de: 1, para: 3, ar: 2, t0: 0.5, cap: 100 },
    { de: 0, para: 2, ar: 4, t0: 1.5, cap: 5000 }, { de: 2, para: 3, ar: 6, t0: 1.5, cap: 5000 },
    { de: 1, para: 0, ar: 1, t0: 0.5, cap: 100 }, { de: 3, para: 1, ar: 3, t0: 0.5, cap: 100 },
    { de: 2, para: 0, ar: 5, t0: 1.5, cap: 5000 }, { de: 3, para: 2, ar: 7, t0: 1.5, cap: 5000 },
  ];
  const g = grafoDe(5, arcos); // o nó 4 não tem ligação
  const e = entradaDe(g, 4, [[[0, 1000, 0]], [[3, 0, 1000]]]);
  const s = executarAteOFim(atribuir, e);
  const rápida = s.fluxo[0];
  const lenta = s.fluxo[4];
  assert.ok(Math.abs(rápida + lenta - 1000) < 1e-2, 'as duas rotas somam as viagens');
  assert.ok(rápida < 1000 && lenta > 0, `a carga se divide (rápida ${rápida}, lenta ${lenta})`);
  assert.ok(Math.abs(rápida - 500) < 1e-2, 'a primeira passada (50%) vai pela rota livre; as outras desviam');
  // sem caminho
  const e2 = entradaDe(g, 4, [[[0, 40, 0]], [[4, 0, 40]]]);
  const s2 = executarAteOFim(atribuir, e2);
  assert.ok(Math.abs(s2.semRota - 40) < 1e-6);
  assert.equal(s2.viagens, 0);
  // o fluxo anterior congestiona a primeira passada: com a rota rápida cheia, os 50% dela vão pela lenta
  const e3 = entradaDe(g, 4, [[[0, 100, 0]], [[3, 0, 100]]]);
  const livre = executarAteOFim(atribuir, e3);
  assert.ok(Math.abs(livre.fluxo[0] - 100) < 1e-2, 'sem fluxo anterior, a rota rápida leva tudo (v/c 1)');
  e3.anterior[0] = 400;
  e3.anterior[2] = 400;
  const s3 = executarAteOFim(atribuir, e3);
  assert.ok(Math.abs(s3.fluxo[4] - 50) < 1e-2 && Math.abs(s3.fluxo[0] - 50) < 1e-2, `rápida ${s3.fluxo[0]}, lenta ${s3.fluxo[4]}`);
});

test('tarefa: mesma entrada, mesma saída bit a bit; o gerador cede a cada origem e a conta em fatias dá o mesmo', () => {
  const { grafo, nArestas } = linha(40, 1.5, 300);
  const zonas = [];
  for (let z = 0; z < 20; z++) zonas.push([[2 * z, 120 + z, 80], [2 * z + 1, 10, 60 + z, 30]]);
  const e = entradaDe(grafo, nArestas, zonas);
  const a = executarAteOFim(atribuir, e);
  const b = executarAteOFim(atribuir, e);
  assert.ok(iguais(a.fluxo, b.fluxo) && iguais(a.tSaida, b.tSaida) && iguais(a.tDestino, b.tDestino));
  assert.equal(a.tempoMedio, b.tempoMedio);
  const it = atribuir(e);
  let cedeu = 0;
  let r = it.next();
  while (!r.done) {
    cedeu++;
    r = it.next();
  }
  assert.ok(cedeu >= 20 && cedeu <= 60, `cedeu ${cedeu} vezes`);
  assert.ok(iguais(r.value.fluxo, a.fluxo));
  // a entrada não é alterada pela tarefa
  const copia = entradaDe(grafo, nArestas, zonas);
  assert.ok(iguais(copia.prod, e.prod) && iguais(copia.anterior, e.anterior));
  assert.ok(a.fluxo.every(Number.isFinite) && a.tSaida.every(Number.isFinite));
});

// ------------------------------------------------------------------------------------------------ zonas e entrada

test('zonas de tráfego: 256 m até 150 zonas ativas, 512 m acima; os nós sem viagens ficam fora', () => {
  const sim = criarSimulacao({ semente: 'transito-zonas' });
  const G = sim.grafo;
  const nos = [];
  for (let j = 0; j < 14; j++) for (let i = 0; i < 14; i++) nos.push(addNo(G, -3900 + 280 * i, -3900 + 280 * j));
  const N = sim.tabelas.nos.n;
  const peso = (lista) => {
    const v = new Float64Array(N);
    for (const k of lista) v[k] = 10;
    return v;
  };
  // 100 nós com viagens em 100 células diferentes: zonas de 256 m
  const poucos = nos.slice(0, 100);
  const e1 = entradaTransito(sim, { prod: peso(poucos), atr: peso(poucos), atrCom: new Float64Array(N) });
  assert.equal(e1.passo, 256);
  assert.equal(e1.Z, 100);
  assert.deepEqual([...e1.zonaCel], [...e1.zonaCel].sort((a, b) => a - b), 'zonas em ordem de célula');
  assert.equal(new Set(e1.noZona).size, 101, '100 zonas e o -1 dos outros nós');
  for (const k of nos.slice(100)) assert.equal(e1.noZona[k], -1);
  // 196 nós em 196 células: mais de 150, juntam em células de 512 m
  const e2 = entradaTransito(sim, { prod: peso(nos), atr: peso(nos), atrCom: new Float64Array(N) });
  assert.equal(e2.passo, 512);
  assert.ok(e2.Z < 150 && e2.Z >= 49, `zonas de 512 m: ${e2.Z}`);
  assert.equal(e2.prod.length, N);
  assert.equal(e2.anterior.length, 2 * sim.tabelas.arestas.n);
  // sem viagens: sem entrada
  assert.equal(entradaTransito(sim, { prod: new Float64Array(N), atr: new Float64Array(N), atrCom: new Float64Array(N) }), null);
});

// ------------------------------------------------------------------------------------------------ cidade completa

/** Cidade de prova: a sintética com `predios` prédios (a sintética enche bairros inteiros com ruas e avenidas). */
function cidade(op = {}, predios = 700) {
  const sim = criarSimulacao({ semente: SINTETICA.semente, ...op });
  gerarCidadeSintetica({ sim, predios });
  sim.espelho.fluxos = null; // a sintética põe fluxos de enfeite para o render; aqui vale só o que a atribuição produz
  return sim;
}

test('pedido a cada 60 tiques em 6 fatias, aplicado 60 depois: espelho.fluxos, trajeto e a tarefa em fatias no Node', () => {
  const sim = cidade();
  const sis = sim._sistemas.find((s) => s.nome === 'transito');
  assert.equal(sis.periodo, TRANSITO.periodo);
  assert.equal(sis.fatias, TRANSITO.fatias);
  assert.equal(sim.espelho.fluxos, null, 'antes da primeira atribuição vale a heurística do render');
  assert.equal(sim.agregados.trajeto, null);
  // durante as fatias a soma parcial está na seção salva; depois do pedido, vazia
  sim.rodar(25, { sincrono: false });
  assert.ok(sim.json.transito.prod instanceof Float64Array, 'varredura em andamento');
  assert.equal(sim.tarefas.pendentes.length, 0);
  sim.rodar(30, { sincrono: false }); // tique 55: o pedido saiu no 50
  assert.equal(sim.json.transito.prod, null);
  assert.equal(sim.tarefas.pendentes.length, 1);
  const p = sim.tarefas.pendentes[0];
  assert.equal(p.nome, 'transito');
  assert.equal(p.tiqueAplicar, p.tique + 60);
  assert.equal(p.tique, 50);
  assert.ok(p.entrada.Z > 5 && p.entrada.grafo.dest.length > 100);
  assert.equal(p.estado, 'refazendo', 'sem worker o Node anda a tarefa em fatias, tique a tique');
  // sem sincrono: nenhum tique para esperando a tarefa, que fica pronta antes do T + K
  const n = sim.rodar(54, { sincrono: false });
  assert.equal(n, 54);
  assert.equal(sim.tarefas.atrasos, 0);
  assert.equal(sim.tique, 109);
  assert.equal(sim.tarefas.pendentes[0].estado, 'pronta', 'pronta antes de vencer');
  assert.equal(sim.espelho.fluxos, null);
  sim.rodar(2, { sincrono: false }); // tique 110: aplica
  const F = sim.espelho.fluxos;
  const A = sim.tabelas.arestas;
  assert.ok(F && F.ida.length === A.n && F.volta.length === A.n && F.vel.length === A.n);
  assert.equal(F.versao, sim.json.transito.versao);
  assert.equal(sim.json.transito.aplicado, 50);
  let soma = 0;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    assert.ok(F.vel[e] > 0 && F.vel[e] <= 1);
    assert.ok(F.ida[e] >= 0 && F.volta[e] >= 0);
    soma += F.ida[e] + F.volta[e];
  }
  assert.ok(soma > 0, 'há fluxo nas vias');
  const tr = sim.agregados.trajeto;
  assert.equal(tr.porZona.length, 1024);
  assert.equal(tr.destino.length, 1024);
  assert.ok(tr.medio > 0 && tr.comercio > 0);
  assert.ok(tr.porZona.some((v) => v > 0));
  assert.ok(sim.json.transito.viagens > 0 && sim.json.transito.zonas > 0);
  // mais um ciclo: o fluxo anterior entra na passada
  sim.rodar(60, { sincrono: false });
  assert.equal(sim.json.transito.aplicado, 110);
  assert.ok(sim.mudancas.desde(0).fluxos);
  assert.deepEqual(conferirEspelho(sim.espelho), []);
  assert.deepEqual(sim.erros, []);
});

test('hash: igual no Node, com worker simulado de atraso aleatório e com worker que morre no meio (D15)', async () => {
  const N = 200;
  const jogar = async (op) => {
    const sim = cidade(op, 400);
    sim.cmd('velocidade', { v: 3 });
    let paradas = 0;
    let guarda = 0;
    while (sim.tique < N && guarda++ < 30000) {
      const n = sim.avancar(Math.min(500, (N - sim.tique) * 250));
      if (!n) paradas++;
      await dormir(1);
    }
    return { sim, paradas };
  };
  const a = await jogar({ trabalhador: criarTrabalhadorSimulado({ atrasoMax: 15, semente: 'transito-a' }) });
  const b = await jogar({ trabalhador: criarTrabalhadorSimulado({ atrasoMax: 8, morrerDepois: 1, semente: 'transito-b' }) });
  const node = cidade({}, 400);
  node.rodar(a.sim.tique, { sincrono: true });
  const node2 = cidade({}, 400);
  node2.rodar(b.sim.tique, { sincrono: true });
  assert.ok(a.sim.tique >= N && b.sim.tique >= N);
  assert.ok(a.sim.espelho.fluxos, 'o resultado do worker foi aplicado');
  assert.equal(a.sim.q.hash(), node.q.hash());
  assert.equal(b.sim.tarefas.morto, true);
  assert.equal(b.sim.q.hash(), node2.q.hash());
  assert.ok(iguais(a.sim.espelho.fluxos.ida, node.espelho.fluxos.ida));
  assert.deepEqual([...a.sim.erros, ...b.sim.erros, ...node.erros], []);
});

test('save no meio da varredura e com a tarefa pendente: o carregado segue com o mesmo hash e refaz o espelho', () => {
  const A = cidade({}, 500);
  A.rodar(135, { sincrono: true }); // aplicou o 1o pedido (tique 110); a varredura do 2o está na fatia 2 (tique 120-130 ...)
  assert.ok(A.espelho.fluxos);
  assert.ok(A.json.transito.prod, 'varredura do próximo pedido em andamento');
  const bytes = montarSave(A);
  const B = criarSimulacao({ semente: SINTETICA.semente });
  aplicarSave(B, migrar(lerSave(bytes)));
  assert.equal(B.q.hash(), A.q.hash());
  assert.ok(B.espelho.fluxos, 'espelho.fluxos refeito ao carregar');
  assert.ok(iguais(B.espelho.fluxos.vel, A.espelho.fluxos.vel));
  assert.ok(iguais(B.agregados.trajeto.porZona, A.agregados.trajeto.porZona));
  A.rodar(200, { sincrono: true });
  B.rodar(200, { sincrono: true });
  assert.equal(B.q.hash(), A.q.hash());
  assert.deepEqual([...A.erros, ...B.erros], []);
  // com a tarefa pendente no save (pedida no tique 170, aplica no 230)
  const C = cidade({}, 500);
  C.rodar(180, { sincrono: true });
  assert.ok(C.tarefas.pendentes.some((p) => p.nome === 'transito'));
  const D = criarSimulacao({ semente: SINTETICA.semente });
  aplicarSave(D, migrar(lerSave(montarSave(C))));
  assert.equal(D.q.hash(), C.q.hash());
  C.rodar(120, { sincrono: false });
  D.rodar(120, { sincrono: false });
  assert.equal(D.q.hash(), C.q.hash());
  assert.ok(iguais(D.espelho.fluxos.ida, C.espelho.fluxos.ida));
});

test('o hash cobre o estado novo: o fluxo da seção, o trajeto, as somas da varredura', () => {
  const sim = cidade({}, 400);
  sim.rodar(115, { sincrono: true });
  const h0 = sim.q.hash();
  sim.json.transito.fluxo[10] += 1;
  const h1 = sim.q.hash();
  assert.notEqual(h1, h0);
  sim.json.transito.fluxo[10] -= 1;
  assert.equal(sim.q.hash(), h0);
  sim.agregados.trajeto.porZona[300] += 1;
  assert.notEqual(sim.q.hash(), h0);
  sim.agregados.trajeto.porZona[300] -= 1;
  sim.json.transito.clientes = 0.9;
  assert.notEqual(sim.q.hash(), h0);
});

// ------------------------------------------------------------------------------------------------ efeitos (D37)

/** Põe um fluxo na seção salva e refaz o derivado, como a aplicação faz. */
function injetar(sim, fn) {
  const A = sim.tabelas.arestas;
  const f = new Float32Array(2 * A.n);
  fn(f, A);
  sim.json.transito.fluxo = f;
  sim.json.transito.nArestas = A.n;
  sim.json.transito.versao++;
  derivarTransito(sim);
}

function trajetoUniforme(sim, minutos, comercio = minutos) {
  sim.agregados.trajeto = {
    porZona: new Float32Array(1024).fill(minutos), destino: new Float32Array(1024).fill(minutos), medio: minutos, comercio,
  };
}

test('produtividade do trabalho pelo trajeto: de 12 a 40 min tira até 30%, no prédio da cidade e no da Holding', () => {
  const sim = cidade({}, 600);
  sim.rodar(5, { sincrono: true });
  const P = sim.tabelas.predios;
  let i = 0;
  while (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA) i++;
  assert.equal(sim.transito.fatorTrabalho(i), 1, 'sem atribuição vale 1');
  for (const [min, esperado] of [[5, 1], [12, 1], [26, 0.85], [40, 0.7], [90, 0.7]]) {
    trajetoUniforme(sim, min);
    assert.ok(Math.abs(sim.transito.fatorTrabalho(i) - esperado) < 1e-9, `${min} min: ${sim.transito.fatorTrabalho(i)}`);
  }
  // a eficiência do local de trabalho (zona) acompanha, na rodada do crescimento
  const igual = cidade({}, 600);
  const lento = cidade({}, 600);
  igual.rodar(5, { sincrono: true });
  lento.rodar(5, { sincrono: true });
  trajetoUniforme(lento, 40);
  igual.rodar(40, { sincrono: true });
  lento.rodar(40, { sincrono: true });
  let n = 0;
  for (let k = 0; k < P.n; k++) {
    if (!P.viva[k] || P.tipo[k] !== TIPO_PREDIO.ZONA || !(igual.tabelas.predios.efic[k] > 0)) continue;
    const a = igual.tabelas.predios.efic[k];
    const b = lento.tabelas.predios.efic[k];
    if (!(b < a - 1e-6)) continue;
    assert.ok(Math.abs(b - 0.7 * a) < 1e-4 * Math.max(1, a), `efic ${b} contra ${a}`);
    n++;
  }
  assert.ok(n > 5, `locais de trabalho com a eficiência menor: ${n}`);
  // as linhas da Holding: o prédio que produz leva o mesmo fator
  const h = simS3a({ semente: 'transito-holding', populacao: 2000, bemEstar: 50 });
  transitoModulo.registrar(h);
  predioHolding(h, 'escritorioObra', 0, 0);
  const ped = predioHolding(h, 'pedreira', 200, 0);
  h.rodar(20, { sincrono: true });
  const base = h.q.predio(ped).holding.produtividade;
  assert.ok(base > 0);
  trajetoUniforme(h, 40);
  h.rodar(20, { sincrono: true });
  assert.ok(Math.abs(h.q.predio(ped).holding.produtividade - 0.7 * base) < 1e-9, `${h.q.predio(ped).holding.produtividade} contra ${0.7 * base}`);
  trajetoUniforme(h, 26);
  h.rodar(20, { sincrono: true });
  assert.ok(Math.abs(h.q.predio(ped).holding.produtividade - 0.85 * base) < 1e-9);
});

test('clientes do comércio pelo tempo de viagem: de 10 a 35 min tira até 25% da fração de clientes', () => {
  const sim = cidade({}, 600);
  sim.rodar(5, { sincrono: true });
  const base = calcularDemanda(sim).clientes;
  assert.equal(sim.transito.fatorClientes(), 1);
  const saida = (comercio) => {
    const A = sim.tabelas.arestas;
    const Z = 3;
    return {
      fluxo: new Float32Array(2 * A.n), tSaida: new Float32Array(Z).fill(comercio), tDestino: new Float32Array(Z).fill(comercio),
      viagens: 10, tempoMedio: comercio, tempoCom: comercio, semRota: 0,
    };
  };
  const pedido = { tique: 0, entrada: { nArestas: sim.tabelas.arestas.n, Z: 3, passo: 256, zonaCel: Int32Array.from([100, 101, 102]) } };
  for (const [min, fator] of [[8, 1], [10, 1], [22.5, 0.875], [35, 0.75], [60, 0.75]]) {
    aplicarTransito(sim, saida(min), pedido);
    assert.ok(Math.abs(sim.transito.fatorClientes() - fator) < 1e-4, `${min} min: ${sim.transito.fatorClientes()}`);
    const c = calcularDemanda(sim).clientes;
    if (base < 1) assert.ok(Math.abs(c - base * sim.transito.fatorClientes()) < 1e-9);
    else assert.ok(Math.abs(c - sim.transito.fatorClientes()) < 1e-9 || c === 1);
  }
});

test('bem-estar: até -8 pelo tempo de viagem de quem mora na zona, como fator "transito"', () => {
  const sim = cidade({}, 600);
  sim.rodar(5, { sincrono: true });
  const P = sim.tabelas.predios;
  let i = 0;
  while (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA || !P.moradores[i]) i++;
  const f0 = [];
  const b0 = calcularBemEstar(sim, i, f0);
  assert.ok(!f0.some((f) => f.id === 'transito'), 'sem atribuição o termo não aparece');
  for (const [min, esperado] of [[8, 0], [10, 0], [27.5, -4], [45, -8], [120, -8]]) {
    trajetoUniforme(sim, min);
    const f = [];
    const b = calcularBemEstar(sim, i, f);
    assert.ok(Math.abs(sim.transito.bemEstar(i) - esperado) < 1e-9, `${min} min: ${sim.transito.bemEstar(i)}`);
    const fator = f.find((x) => x.id === 'transito');
    if (esperado === 0) assert.equal(fator, undefined);
    else assert.ok(fator && Math.abs(fator.v - esperado) < 0.06);
    if (b0 > 8) assert.ok(Math.abs(b - (b0 + esperado)) < 0.06, `bem-estar ${b} contra ${b0 + esperado}`);
  }
  assert.ok(temTexto('fator.transito'));
});

test('cobertura de saúde e bombeiros usa o custo congestionado da aresta; a segurança segue pela distância', () => {
  const sim = criarSimulacao({ semente: 'transito-cobertura', modo: 'livre' });
  const rua = (pontos, tipo) => {
    const r = sim.cmd('via.construir', { plano: { modo: 'reta', tipo, pontos, sessao: 1, encaixe: false } });
    assert.ok(r.ok, r.codigo);
    return r.dados.arestas.map((x) => idxDaRef(x));
  };
  const es = rua([[960, -300], [1680, -300]], 'avenida');
  assert.ok(es.length >= 4, `a avenida tem ${es.length} trechos`);
  const colocar = (tipo, x, z) => {
    const p = sim.q.construir.previa({ tipo, x, z, rot: 0 });
    assert.ok(p.ok, `${tipo}: ${p.codigo}`);
    const r = sim.cmd('construir', { tipo, x: p.x, z: p.z, rot: p.rot });
    assert.ok(r.ok, r.codigo);
    terminarObra(sim, idxDaRef(r.id));
  };
  colocar('clinica', 1020, -330);
  colocar('bombeiros', 1020, -270);
  colocar('delegacia', 1100, -330);
  sistemaCargas(sim);
  const A = sim.tabelas.arestas;
  // o ponto do meio da última aresta (a leste)
  const ultima = es.filter((e) => A.viva[e]).sort((a, b) => Math.max(A.p[8 * b], A.p[8 * b + 6]) - Math.max(A.p[8 * a], A.p[8 * a + 6]))[0];
  const s = A.arco[17 * ultima + 16] / 2;
  const antes = { saude: coberturaNoPonto(sim, 'saude', ultima, s), bombeiros: coberturaNoPonto(sim, 'bombeiros', ultima, s), seguranca: coberturaNoPonto(sim, 'seguranca', ultima, s) };
  assert.ok(antes.saude > 0 && antes.bombeiros > 0 && antes.seguranca > 0, JSON.stringify(antes));
  const versao0 = garantirCobertura(sim).versao;
  assert.equal(sim.transito.versaoCusto(), 0);
  // todo trecho com v/c 1,8: o tempo vira 2,6 vezes o livre (degraus de 0,25)
  injetar(sim, (f, a) => {
    for (let e = 0; e < a.n; e++) if (a.viva[e]) f[2 * e] = f[2 * e + 1] = 1.8 * capacidade(a, e, 0);
  });
  assert.ok(sim.transito.versaoCusto() > 0);
  assert.ok(Math.abs(sim.transito.custoAresta(es[0]) - 2.5) < 0.3, `custo ${sim.transito.custoAresta(es[0])}`);
  const cob1 = garantirCobertura(sim);
  assert.notEqual(cob1.versao, versao0, 'a cobertura foi refeita');
  const depois = { saude: coberturaNoPonto(sim, 'saude', ultima, s), bombeiros: coberturaNoPonto(sim, 'bombeiros', ultima, s), seguranca: coberturaNoPonto(sim, 'seguranca', ultima, s) };
  assert.ok(depois.saude < antes.saude - 0.05, `saúde ${antes.saude} -> ${depois.saude}`);
  assert.ok(depois.bombeiros < antes.bombeiros - 0.02, `bombeiros ${antes.bombeiros} -> ${depois.bombeiros}`);
  assert.equal(depois.seguranca, antes.seguranca, 'a delegacia não usa o custo congestionado');
  // o trânsito livre de novo devolve a cobertura
  injetar(sim, () => {});
  const volta = coberturaNoPonto(sim, 'saude', ultima, s);
  assert.ok(Math.abs(volta - antes.saude) < 1e-9, `${volta} contra ${antes.saude}`);
  // a mesma conta feita do zero (carregar) dá a mesma cobertura
  injetar(sim, (f, a) => {
    for (let e = 0; e < a.n; e++) if (a.viva[e]) f[2 * e] = f[2 * e + 1] = 1.8 * capacidade(a, e, 0);
  });
  const c1 = coberturaNoPonto(sim, 'saude', ultima, s);
  const novo = criarSimulacao({ semente: 'transito-cobertura', modo: 'livre' });
  aplicarSave(novo, migrar(lerSave(montarSave(sim))));
  assert.ok(Math.abs(coberturaNoPonto(novo, 'saude', ultima, s) - c1) < 1e-9);
  assert.deepEqual([...sim.erros, ...novo.erros], []);
});

// ------------------------------------------------------------------------------------------------ camada, aviso e gargalo

test('camada Trânsito (v/c por aresta) segue o contrato e tem texto', () => {
  assert.equal(CAMADAS.transito.fonte, 'arestas');
  const sim = cidade({}, 500);
  const vazia = sim.q.camada('transito');
  assert.equal(vazia.dados.length, sim.tabelas.arestas.n);
  assert.ok(vazia.dados.every((v) => v === 0));
  sim.rodar(115, { sincrono: true });
  const c = sim.q.camada('transito');
  assert.equal(c.id, 'transito');
  assert.equal(c.fonte, 'arestas');
  assert.equal(c.tipo, 'seq');
  assert.ok(c.dados instanceof Float32Array && c.dados.length === sim.tabelas.arestas.n);
  assert.ok(c.dados.some((v) => v > 0));
  assert.ok(c.escala.max > c.escala.min);
  for (const l of c.legenda) assert.ok(temTexto(l.chave), l.chave);
  assert.ok(temTexto(c.resumo.chave));
  assert.ok(temTexto('camada.transito'));
  assert.ok(t(c.resumo.chave, c.resumo.params).includes('min'));
  assert.equal(c.versao, sim.json.transito.versao);
  // v/c da camada bate com o fluxo e a capacidade
  const A = sim.tabelas.arestas;
  const F = sim.espelho.fluxos;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    const ca = capacidade(A, e, 0);
    const cb = capacidade(A, e, 1);
    const vc = Math.max(ca > 0 ? F.ida[e] / ca : 0, cb > 0 ? F.volta[e] / cb : 0);
    assert.ok(Math.abs(c.dados[e] - vc) < 1e-4);
  }
});

test('aviso "trânsito parado": a aresta mais cheia, o nome, o ponto e a sugestão (melhorar, mão única ou via paralela)', () => {
  const sim = cidade({}, 500);
  sim.rodar(5, { sincrono: true });
  const A = sim.tabelas.arestas;
  const achar = (tipo) => {
    for (let e = 0; e < A.n; e++) if (A.viva[e] && VIAS_ORDEM[A.tipo[e]] === tipo && A.comp[e] > 30) return e;
    return -1;
  };
  const aviso = () => sim.q.avisos({ limite: 50 }).find((a) => a.id === 'transito') ?? null;
  assert.equal(aviso(), null, 'sem atribuição não há aviso');
  const e = achar('rua');
  assert.ok(e >= 0);
  // v/c de 1,1: gargalo, mas ainda sem aviso
  injetar(sim, (f, a) => {
    f[2 * e] = 1.1 * capacidade(a, e, 0);
  });
  assert.equal(aviso(), null);
  assert.deepEqual(gargalos(sim).map((g) => g.e), [e]);
  // v/c de 1,4 em um sentido só: atenção, rua que pede mão única
  injetar(sim, (f, a) => {
    f[2 * e] = 1.4 * capacidade(a, e, 0);
    f[2 * e + 1] = 0.1 * capacidade(a, e, 1);
  });
  let a = aviso();
  assert.equal(a.gravidade, 'atencao');
  assert.equal(a.codigo, 'transitoParadoMao');
  assert.equal(a.params.sugestao, 'maoUnica');
  assert.equal(a.params.ref, A.ref(e));
  assert.equal(a.params.via, nomeDaAresta(sim, e));
  assert.ok(a.alvo && Number.isFinite(a.alvo.x) && Number.isFinite(a.alvo.z));
  // o ponto fica sobre a aresta (no máximo meio comprimento do meio)
  const mx = (A.p[8 * e] + A.p[8 * e + 6]) / 2;
  const mz = (A.p[8 * e + 1] + A.p[8 * e + 7]) / 2;
  assert.ok(Math.hypot(a.alvo.x - mx, a.alvo.z - mz) < A.comp[e] / 2);
  // dos dois lados cheios: melhorar, para uma avenida; v/c de 2: grave
  injetar(sim, (f, aa) => {
    f[2 * e] = 2 * capacidade(aa, e, 0);
    f[2 * e + 1] = 1.8 * capacidade(aa, e, 1);
  });
  a = aviso();
  assert.equal(a.gravidade, 'grave');
  assert.equal(a.codigo, 'transitoParado');
  assert.equal(a.params.sugestao, 'melhorar');
  assert.ok(['avenida', 'avenidaG'].includes(a.params.para));
  assert.ok(a.params.n >= 1);
  // avenida grande já cheia: só resta uma via paralela
  const tipoVelho = A.tipo[e];
  A.tipo[e] = VIAS_ORDEM.indexOf('avenidaG');
  injetar(sim, (f, aa) => {
    f[2 * e] = 1.5 * capacidade(aa, e, 0);
    f[2 * e + 1] = 1.5 * capacidade(aa, e, 1);
  });
  a = aviso();
  assert.equal(a.codigo, 'transitoParadoParalela');
  assert.equal(sugestaoPara(sim, e).sugestao, 'paralela');
  A.tipo[e] = tipoVelho;
  // todas as frases existem e trazem a via
  for (const c of ['transitoParado', 'transitoParadoMao', 'transitoParadoParalela']) {
    assert.ok(temTexto(`aviso.${c}`), c);
    assert.ok(t(`aviso.${c}`, { via: 'Rua Tal' }).includes('Rua Tal'));
  }
  // o evento de aviso da cidade sai quando o trânsito piora (via bem-estar, a cada rodada)
  const vistos = [];
  sim.on('aviso', (d) => vistos.push(d.id));
  sim.rodar(40, { sincrono: true });
  assert.ok(vistos.includes('transito'));
});

test('gargalo (v/c acima de 1) numa cidade cheia aparece sem mexer nas vias e a ferramenta de melhorar o resolve', () => {
  const sim = cidade({}, 2500);
  sim.holding.receber(5e7, 'teste');
  sim.rodar(120, { sincrono: true });
  const g = gargalos(sim);
  assert.ok(g.length >= 1, 'a cidade de dezenas de milhares tem ao menos um gargalo');
  assert.ok(g[0].vc > 1.2);
  assert.equal(resumoTransito(sim).gargalos, g.length);
  const alvo = g[0];
  const q = sim.q.aresta(alvo.ref);
  assert.equal(q.fluxo.vel < 1, true);
  assert.equal(q.tipo, 'rua');
  const r = sim.cmd('via.melhorar', { arestas: [alvo.ref], tipo: sugestaoPara(sim, alvo.e).para ?? 'avenida', sessao: 'teste.gargalo' });
  assert.equal(r.ok, true, JSON.stringify(r));
  sim.rodar(120, { sincrono: true });
  const depois = gargalos(sim).find((x) => x.e === alvo.e);
  assert.ok(!depois || depois.vc < alvo.vc * 0.7, `a aresta passou de ${alvo.vc} para ${depois?.vc}`);
  assert.ok(!depois || depois.vc <= 1.0, 'saiu da lista de gargalos');
  assert.deepEqual(sim.erros, []);
});

test('tempo de viagem e partes das consultas: q.predio traz o trajeto, q.cidade o resumo', () => {
  const sim = cidade({}, 600);
  sim.rodar(115, { sincrono: true });
  const c = sim.q.cidade();
  assert.ok(c.transito && c.transito.zonas > 0 && c.transito.tempoMedio > 0);
  assert.equal(c.transito.aplicado, 50);
  const P = sim.tabelas.predios;
  let res = -1;
  let trab = -1;
  for (let i = 0; i < P.n && (res < 0 || trab < 0); i++) {
    if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA) continue;
    if (P.moradores[i] && res < 0) res = i;
    else if (!P.moradores[i] && trab < 0) trab = i;
  }
  const fr = sim.q.predio(P.ref(res));
  assert.ok(fr.transito && fr.transito.minutos > 0 && fr.transito.bemEstar <= 0);
  const ft = sim.q.predio(P.ref(trab));
  assert.ok(ft.transito && ft.transito.produtividade > 0 && ft.transito.produtividade <= 1);
});

test('partida nova (a Vila) tem viagens e nenhum gargalo; sem gente a atribuição velha é limpa e nada quebra', () => {
  const sim = criarSimulacao({ semente: 'transito-vazio' });
  sim.rodar(130, { sincrono: true });
  const r = resumoTransito(sim);
  assert.ok(r.zonas >= 1 && r.viagens >= 0, 'a Vila já gera viagens');
  assert.equal(r.gargalos, 0);
  assert.deepEqual(gargalos(sim), []);
  assert.ok(sim.espelho.fluxos);
  // a cidade esvazia: a próxima varredura não acha viagens e zera o que sobrou
  const P = sim.tabelas.predios;
  for (let i = 0; i < P.n; i++) if (P.viva[i]) P.moradores[i] = 0;
  for (let k = 0; k < 4; k++) sim.rodar(20, { sincrono: true }); // a rodada do mercado de trabalho refaz a ocupação
  sim.rodar(120, { sincrono: true });
  assert.equal(sim.json.transito.fluxo, null);
  assert.equal(sim.agregados.trajeto, null);
  assert.equal(sim.espelho.fluxos, null);
  assert.equal(sim.transito.fatorTrabalho(0), 1);
  assert.equal(sim.q.camada('transito').dados.every((v) => v === 0), true);
  assert.deepEqual(sim.erros, []);
});
