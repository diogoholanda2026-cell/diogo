// Trânsito agregado com efeitos (D15, D37; seção 9 do desenho da simulação; dona: S1c). Este módulo roda na thread
// principal: a cada 60 tiques monta a entrada (o grafo por versão, as zonas de tráfego de 256 m e as viagens por hora de
// pico de cada nó) e pede a atribuição à tarefa `transito` (fonte/sim/tarefas/transito.js, no worker); o resultado entra
// exatamente 60 tiques depois e aqui vira os fluxos do espelho, o tempo de viagem por zona e os efeitos da D37.
//
// Estado que vai no save e no hash: a seção JSON 'transito' (fluxo por aresta e sentido da última atribuição, o fator de
// clientes, a versão) e S.agregados.trajeto ({ porZona, destino, medio, comercio }: minutos de viagem por célula de
// 256 m); mais a tarefa pendente (a fila de tarefas guarda a entrada). Tudo o mais é derivado e refeito ao carregar:
// espelho.fluxos, o custo congestionado da aresta e o pior gargalo.
//
// Efeitos (D37), todos lidos de S.agregados.trajeto e da seção 'transito' (calibrar):
//   1. produtividade dos locais de trabalho, inclusive as linhas da Holding: cai até 30% com o tempo médio de quem chega à zona
//   2. clientes do comércio: caem até 25% com o tempo médio das viagens que chegam às zonas comerciais
//   3. cobertura de saúde e bombeiros: a busca pela via usa o comprimento vezes o custo congestionado da aresta
//   4. bem-estar: até -8 pelo tempo médio das viagens de quem mora na zona
// Os outros domínios leem pelo serviço `sim.transito` (fatorTrabalho, fatorClientes, bemEstar, custoAresta), que cada um
// consulta com `?.` (sem este módulo o fator vale 1 e o termo 0).
import { clamp } from '../comum/util.js';
import { ponto } from '../comum/bezier.js';
import { TIPO_PREDIO, ARESTA } from '../contratos/flags.js';
import { ORDEM } from '../contratos/interno.js';
import { VIAS, VIAS_ORDEM } from '../data/vias.js';
import { prepararCidade, funciona, familiaDe, acessoDe, vagasDe, registrarAlertas, registrarPartePredio } from './predios.js';
import { ocupacaoDe, desempregoDe, FRACAO_TRABALHA, registrarParteCidade } from './cidadaos.js';
import { nomeDaAresta } from './vias/nomes.js';

/** Constantes do trânsito (calibrar). */
export const TRANSITO = Object.freeze({
  periodo: 60, // tiques entre dois pedidos (D15, D37)
  fatias: 6, // a varredura dos prédios se divide em 6 tiques do período; o pedido sai na última
  celula: 256, // m: zona de tráfego; acima de zonasMax zonas ativas, 512 m
  lado: 32, // células de 256 m por lado do mapa de 8.192 m
  zonasMax: 150,
  origem: -4096,
  pico: 0.25, // veículos na hora de pico por viagem diária (35% das viagens do pico, 70% de carro)
  compras: 0.3, // viagens de compras por morador; também a parte da vaga do comércio que atrai
  gargalo: 1, // v/c acima disso é gargalo (robô A4, camada)
  parado: 1.25, // v/c do aviso "trânsito parado" (atenção); grave a partir de 1,6 (a velocidade cai abaixo de 50%)
  grave: 1.6,
  custoPasso: 0.25, // o custo congestionado da aresta anda em degraus de 25% do tempo livre
  custoMax: 36,
  trabalho: Object.freeze({ de: 12, ate: 40, perda: 0.3 }), // min de viagem de quem chega: sem perda até `de`, perda máxima em `ate`
  clientes: Object.freeze({ de: 10, ate: 35, perda: 0.25 }),
  bemEstar: Object.freeze({ de: 10, ate: 45, perda: 8 }),
  passosPorTique: 3, // piso das fatias do Node (sem worker) por tique; o necessário sai do número de zonas
});

const PADRAO = {
  aplicado: -1, // tique do pedido que a última aplicação trouxe
  versao: 0, // sobe a cada aplicação (versão do espelho.fluxos e da camada)
  nArestas: 0, // arestas.n quando o pedido saiu
  fluxo: null, // Float32Array(2 x nArestas): veículos por hora de pico, 2 x aresta + sentido (0: a para b)
  clientes: 1, // fator dos clientes do comércio, 0,75 a 1
  viagens: 0, // viagens por hora de pico entre zonas
  semRota: 0, // viagens sem caminho
  zonas: 0, // zonas da última atribuição
  passo: 256, // m da zona usada
  // somas da varredura em andamento (viagens por hora de pico por nó); null fora dela
  n0: 0, // prédios.n quando a varredura começou
  prod: null,
  atr: null,
  atrCom: null,
};

const J = (sim) => sim.json.transito;
const rampa = (t, de, ate) => (t <= de ? 0 : t >= ate ? 1 : (t - de) / (ate - de));

// ---------------------------------------------------------------------------------------------------- derivados

const TRANS = new WeakMap();
/** Estado derivado (nunca vai no save; refeito ao aplicar e ao carregar). */
function dev(sim) {
  let t = TRANS.get(sim);
  if (!t) {
    t = { est: null, cong: null, versaoCusto: 0, vc: null, pior: null, gargalos: 0, vcMax: 0, velMedia: 1 };
    TRANS.set(sim, t);
  }
  return t;
}

const via = (A, e) => VIAS[VIAS_ORDEM[A.tipo[e]]] ?? VIAS.rua;

/** Capacidade de um sentido da aresta, em veículos por hora (0 se a mão não deixa). s: 0 de a para b, 1 de b para a. */
export function capacidade(A, e, s) {
  const m = A.mao[e];
  if (s === 0 ? m < 0 : m > 0) return 0;
  const v = via(A, e);
  const faixas = v.mao === 'unica' ? v.faixas[0] : v.faixas[s];
  return faixas * v.capFaixa;
}

/** Tempo livre da aresta, em minutos. */
const tempoLivre = (A, e) => Math.max(0.005, A.comp[e] / ((via(A, e).velocidade * 1000) / 60));

/**
 * O grafo da rede viária no formato da tarefa (CSR por sentido permitido), em cache enquanto a versão do grafo e os
 * tipos e mãos das arestas não mudarem.
 */
function grafoEstatico(sim) {
  const G = sim.grafo;
  const A = G.arestas;
  const N = G.nos;
  let h = (G.versao * 31 + A.n * 17 + N.n) >>> 0;
  for (let e = 0; e < A.n; e++) if (A.viva[e]) h = (Math.imul(h, 16777619) ^ (A.tipo[e] * 4 + A.mao[e] + 1) ^ (e & 255)) >>> 0;
  const t = dev(sim);
  if (t.est && t.est.chave === h) return t.est.grafo;
  const n = N.n;
  const ini = new Int32Array(n + 1);
  let m = 0;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    if (capacidade(A, e, 0) > 0) {
      ini[A.a[e] + 1]++;
      m++;
    }
    if (capacidade(A, e, 1) > 0) {
      ini[A.b[e] + 1]++;
      m++;
    }
  }
  for (let v = 0; v < n; v++) ini[v + 1] += ini[v];
  const pos = ini.slice(0, n);
  const grafo = {
    n, ini, de: new Int32Array(m), dest: new Int32Array(m), ar: new Int32Array(m), t0: new Float32Array(m), cap: new Float32Array(m),
  };
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    for (let s = 0; s < 2; s++) {
      const c = capacidade(A, e, s);
      if (!(c > 0)) continue;
      const de = s === 0 ? A.a[e] : A.b[e];
      const k = pos[de]++;
      grafo.de[k] = de;
      grafo.dest[k] = s === 0 ? A.b[e] : A.a[e];
      grafo.ar[k] = 2 * e + s;
      grafo.t0[k] = tempoLivre(A, e);
      grafo.cap[k] = c;
    }
  }
  const capE = new Float32Array(2 * A.n);
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    capE[2 * e] = capacidade(A, e, 0);
    capE[2 * e + 1] = capacidade(A, e, 1);
  }
  t.est = { chave: h, grafo, capE };
  return grafo;
}

/** Capacidade por aresta e sentido (2 x aresta + sentido), no cache do grafo (refeito se o tipo ou a mão mudou). */
function capacidades(sim) {
  grafoEstatico(sim);
  return dev(sim).est.capE;
}

// ---------------------------------------------------------------------------------------------------- entrada

const AC = { e: -1, s: 0 };
const VG = [0, 0, 0, 0];

/**
 * Soma a produção e a atração de viagens dos prédios [ini, fim) nos nós da rede (por hora de pico). O prédio dá a sua
 * parte aos dois nós da aresta de acesso, pela posição dele no arco.
 */
function somarViagens(sim, ini, fim, prod, atr, atrCom) {
  const P = sim.tabelas.predios;
  const A = sim.tabelas.arestas;
  const hold = sim.json.producao?.ocupacao;
  const holdFrac = Number.isFinite(hold) ? clamp(hold, 0, 1) : 1;
  for (let i = ini; i < fim && i < P.n; i++) {
    if (!funciona(P, i)) continue;
    const tipo = P.tipo[i];
    let p = 0;
    let a = 0;
    let c = 0;
    if (tipo === TIPO_PREDIO.ZONA && familiaDe(sim, i) === 'res') {
      const m = P.moradores[i];
      if (!m) continue;
      p = (m * FRACAO_TRABALHA * (1 - desempregoDe(sim, i)) + TRANSITO.compras * m) * TRANSITO.pico;
    } else {
      const com = tipo === TIPO_PREDIO.ZONA && familiaDe(sim, i) === 'com';
      let ocupadas;
      let vagas;
      if (tipo === TIPO_PREDIO.HOLDING) {
        vagasDe(sim, i, VG);
        vagas = VG[0] + VG[1] + VG[2] + VG[3];
        ocupadas = vagas * holdFrac;
      } else {
        const oc = ocupacaoDe(sim, i);
        ocupadas = oc.ocupadas;
        vagas = oc.vagas;
      }
      a = (ocupadas + (com ? TRANSITO.compras * vagas : 0)) * TRANSITO.pico;
      if (com) c = a;
    }
    if (!(p > 0) && !(a > 0)) continue;
    acessoDe(sim, i, AC);
    const e = AC.e;
    if (e < 0 || e >= A.n || !A.viva[e]) continue;
    const comp = A.arco[17 * e + 16];
    const w = comp > 0 ? clamp(AC.s / comp, 0, 1) : 0.5;
    const na = A.a[e];
    const nb = A.b[e];
    if (na >= prod.length || nb >= prod.length) continue; // nó criado depois do começo da varredura
    prod[na] += p * (1 - w);
    prod[nb] += p * w;
    atr[na] += a * (1 - w);
    atr[nb] += a * w;
    atrCom[na] += c * (1 - w);
    atrCom[nb] += c * w;
  }
}

/** Índice da célula de 256 m do ponto (0 a 1.023), preso ao mapa. */
function celulaDe(x, z) {
  const a = clamp(Math.floor((x - TRANSITO.origem) / TRANSITO.celula), 0, TRANSITO.lado - 1);
  const b = clamp(Math.floor((z - TRANSITO.origem) / TRANSITO.celula), 0, TRANSITO.lado - 1);
  return b * TRANSITO.lado + a;
}

/** Zonas de tráfego: os nós com viagens, por célula de 256 m (ou 512 m acima de 150 zonas ativas), em ordem de célula. */
function zonar(sim, prod, atr) {
  const N = sim.tabelas.nos;
  const L = TRANSITO.lado;
  const ativos = new Uint8Array(L * L);
  let nAtivas = 0;
  const cel = new Int16Array(N.n).fill(-1);
  for (let v = 0; v < N.n; v++) {
    if (!(prod[v] > 0) && !(atr[v] > 0)) continue;
    const c = celulaDe(N.x[v], N.z[v]);
    cel[v] = c;
    if (!ativos[c]) {
      ativos[c] = 1;
      nAtivas++;
    }
  }
  const passo = nAtivas > TRANSITO.zonasMax ? 2 * TRANSITO.celula : TRANSITO.celula;
  const grossa = passo > TRANSITO.celula;
  const chaveDe = (c) => (grossa ? (c >> 6 << 4) + ((c & 31) >> 1) : c); // (b>>1) x 16 + (a>>1); c = b x 32 + a
  const marca = new Int32Array(grossa ? 256 : L * L).fill(-1);
  for (let v = 0; v < N.n; v++) if (cel[v] >= 0) marca[chaveDe(cel[v])] = 0;
  let Z = 0;
  const zonaCel = [];
  for (let k = 0; k < marca.length; k++) {
    if (marca[k] < 0) continue;
    marca[k] = Z++;
    zonaCel.push(k);
  }
  const noZona = new Int16Array(N.n).fill(-1);
  for (let v = 0; v < N.n; v++) if (cel[v] >= 0) noZona[v] = marca[chaveDe(cel[v])];
  return { Z, passo, noZona, zonaCel: Int32Array.from(zonaCel) };
}

/**
 * Monta a entrada da tarefa a partir do estado de agora. `somas` (opcional) são as somas já acumuladas por nós; sem elas
 * varre todos os prédios. Devolve null se não há viagens (nenhuma zona ativa).
 */
export function entradaTransito(sim, somas = null) {
  const N = sim.tabelas.nos;
  const A = sim.tabelas.arestas;
  const aN = (v) => {
    if (v && v.length === N.n) return v;
    const o = new Float64Array(N.n);
    if (v) o.set(v.length > N.n ? v.subarray(0, N.n) : v);
    return o;
  };
  let prod;
  let atr;
  let atrCom;
  if (somas) {
    prod = aN(somas.prod);
    atr = aN(somas.atr);
    atrCom = aN(somas.atrCom);
  } else {
    prod = new Float64Array(N.n);
    atr = new Float64Array(N.n);
    atrCom = new Float64Array(N.n);
    somarViagens(sim, 0, sim.tabelas.predios.n, prod, atr, atrCom);
  }
  const z = zonar(sim, prod, atr);
  if (z.Z === 0) return null;
  const f = J(sim).fluxo;
  const anterior = new Float32Array(2 * A.n);
  if (f) anterior.set(f.length > anterior.length ? f.subarray(0, anterior.length) : f);
  return {
    grafo: grafoEstatico(sim),
    nArestas: A.n,
    Z: z.Z,
    passo: z.passo,
    zonaCel: z.zonaCel,
    noZona: z.noZona,
    prod: Float32Array.from(prod),
    atr: Float32Array.from(atr),
    atrCom: Float32Array.from(atrCom),
    anterior,
  };
}

// ---------------------------------------------------------------------------------------------------- saída

/** Reinicia o que a atribuição produz (cidade sem viagens ou sem aresta). */
function limpar(sim) {
  const j = J(sim);
  j.fluxo = null;
  j.nArestas = 0;
  j.clientes = 1;
  j.viagens = 0;
  j.semRota = 0;
  j.zonas = 0;
  j.versao++;
  sim.agregados.trajeto = null;
  derivar(sim);
}

/** Escreve o tempo de cada zona nas células de 256 m (a zona de 512 m cobre 4). */
function porCelula(zonaCel, valores, passo) {
  const L = TRANSITO.lado;
  const out = new Float32Array(L * L);
  for (let z = 0; z < zonaCel.length; z++) {
    const k = zonaCel[z];
    if (passo === TRANSITO.celula) out[k] = valores[z];
    else {
      const a = (k & 15) * 2;
      const b = (k >> 4) * 2;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) out[(b + dy) * L + a + dx] = valores[z];
    }
  }
  return out;
}

/** Aplica a saída da atribuição pedida no tique `pedido.tique` (chamada pela fila de tarefas, K = 60 depois). */
export function aplicarTransito(sim, saida, pedido) {
  const e = pedido.entrada;
  const j = J(sim);
  j.fluxo = saida.fluxo;
  j.nArestas = e.nArestas;
  j.aplicado = pedido.tique;
  j.versao++;
  j.viagens = Math.round(saida.viagens * 10) / 10;
  j.semRota = Math.round(saida.semRota * 10) / 10;
  j.zonas = e.Z;
  j.passo = e.passo;
  sim.agregados.trajeto = {
    porZona: porCelula(e.zonaCel, saida.tSaida, e.passo),
    destino: porCelula(e.zonaCel, saida.tDestino, e.passo),
    medio: saida.tempoMedio,
    comercio: saida.tempoCom,
  };
  j.clientes = Math.round((1 - TRANSITO.clientes.perda * rampa(saida.tempoCom, TRANSITO.clientes.de, TRANSITO.clientes.ate)) * 10000) / 10000;
  derivar(sim);
}

/**
 * Refaz o que se deriva da seção salva: espelho.fluxos, o custo congestionado por aresta, o pior gargalo. A versão do
 * custo só sobe se algum degrau mudou (a cobertura de saúde e bombeiros refaz a busca nesse caso).
 */
export function derivarTransito(sim) {
  derivar(sim);
}

function derivar(sim) {
  const j = J(sim);
  const t = dev(sim);
  const A = sim.tabelas.arestas;
  const n = A.n;
  const f = j.fluxo;
  t.pior = null;
  t.gargalos = 0;
  t.vcMax = 0;
  t.vc = null;
  let algum = false;
  let nova = null;
  if (f) {
    // os arrays do espelho e da conta são reaproveitados enquanto o tamanho for o mesmo (sem lixo a cada aplicação)
    const reusa = t.buf && t.buf.n === n;
    const b = reusa ? t.buf : { n, ida: new Float32Array(n), volta: new Float32Array(n), vel: new Float32Array(n), vc: new Float32Array(n), congA: new Uint8Array(n), congB: new Uint8Array(n) };
    b.ida.fill(0);
    b.volta.fill(0);
    b.vel.fill(1);
    b.vc.fill(0);
    nova = b.congA === t.cong ? b.congB : b.congA;
    nova.fill(0);
    const cap = capacidades(sim);
    const lim = Math.min(n, j.nArestas, f.length >> 1);
    let soma = 0;
    let cont = 0;
    for (let e = 0; e < lim; e++) {
      if (!A.viva[e]) continue;
      const qa = f[2 * e];
      const qb = f[2 * e + 1];
      const ca = cap[2 * e];
      const cb = cap[2 * e + 1];
      b.ida[e] = qa;
      b.volta[e] = qb;
      const va = ca > 0 ? qa / ca : 0;
      const vb = cb > 0 ? qb / cb : 0;
      const v = va > vb ? va : vb;
      b.vc[e] = v;
      const x2 = v * v;
      const fator = Math.min(10, 1 + 0.15 * (x2 * x2));
      b.vel[e] = 1 / fator;
      const c = Math.min(TRANSITO.custoMax, Math.round((fator - 1) / TRANSITO.custoPasso));
      if (c > 0) {
        nova[e] = c;
        algum = true;
      }
      if (qa > 0 || qb > 0) {
        soma += b.vel[e];
        cont++;
      }
      if (v > TRANSITO.gargalo) t.gargalos++;
      if (v > t.vcMax) {
        t.vcMax = v;
        t.pior = e;
      }
    }
    t.buf = b;
    t.vc = b.vc;
    t.velMedia = cont ? soma / cont : 1;
    const F = sim.espelho.fluxos;
    if (F && F.ida === b.ida) F.versao = j.versao;
    else sim.espelho.fluxos = { versao: j.versao, ida: b.ida, volta: b.volta, vel: b.vel };
  } else {
    sim.espelho.fluxos = null;
    t.velMedia = 1;
  }
  // custo congestionado: só conta se algum degrau saiu de 0; a versão sobe quando algum degrau muda
  const velho = t.cong;
  const novo = algum ? nova : null;
  let mudou = (velho === null) !== (novo === null);
  if (!mudou && velho && novo) {
    if (velho.length !== novo.length) mudou = true;
    else for (let e = 0; e < novo.length; e++) if (velho[e] !== novo[e]) { mudou = true; break; }
  }
  t.cong = novo;
  if (mudou) t.versaoCusto++;
  sim.mudancas.marcar('fluxos');
}

// ---------------------------------------------------------------------------------------------------- pedido

/**
 * Sistema do pedido (período de 60 tiques em 6 fatias): cada fatia soma as viagens de um sexto dos prédios nos nós da
 * rede; a última monta a entrada e pede a atribuição, que entra 60 tiques depois. As somas ficam na seção salva
 * enquanto a varredura anda (um save no meio dela continua do mesmo ponto).
 */
function sistemaTransito(sim, fatia, fatias) {
  const j = J(sim);
  const P = sim.tabelas.predios;
  const n = sim.tabelas.nos.n;
  if (fatia === 0 || !j.prod) {
    j.prod = new Float64Array(n);
    j.atr = new Float64Array(n);
    j.atrCom = new Float64Array(n);
    j.n0 = P.n;
  }
  const ini = Math.floor((fatia * j.n0) / fatias);
  const fim = fatia === fatias - 1 ? P.n : Math.floor(((fatia + 1) * j.n0) / fatias);
  somarViagens(sim, ini, fim, j.prod, j.atr, j.atrCom);
  if (fatia < fatias - 1) return;
  const entrada = entradaTransito(sim, { prod: j.prod, atr: j.atr, atrCom: j.atrCom });
  j.prod = null;
  j.atr = null;
  j.atrCom = null;
  if (!entrada) {
    // nada a atribuir (cidade sem gente ou sem rede): zera o que sobrou da atribuição velha
    if (j.fluxo || sim.agregados.trajeto) limpar(sim);
    return;
  }
  sim.tarefas.pedir('transito', entrada);
}

/** Sistema de cada tique: no Node (sem worker) a tarefa anda em fatias, para o pedido não pesar num tique só. */
function andarTransito(sim) {
  const p = sim.tarefas.pendentes;
  if (!p.length) return;
  let Z = 0;
  for (const x of p) if (x.nome === 'transito' && x.estado === 'refazendo') Z = Math.max(Z, x.entrada.Z);
  if (!Z) return;
  // 3 passadas por zona de origem, em até 50 dos 60 tiques
  sim.tarefas.andar('transito', Math.max(TRANSITO.passosPorTique, Math.ceil((3 * Z) / 50)));
}

// ---------------------------------------------------------------------------------------------------- efeitos (D37)

/** Minutos de viagem da célula do ponto no vetor, ou o médio da cidade se a célula não tem zona. */
function tempoNoPonto(sim, vetor, x, z) {
  const tr = sim.agregados.trajeto;
  if (!tr || !vetor) return null;
  const t = vetor[celulaDe(x, z)];
  return t > 0 ? t : tr.medio > 0 ? tr.medio : null;
}

/** Produtividade do local de trabalho i: 1 sem atribuição; cai até 30% com o tempo médio de quem chega à zona dele. */
function fatorTrabalho(sim, i) {
  const P = sim.tabelas.predios;
  const t = tempoNoPonto(sim, sim.agregados.trajeto?.destino, P.x[i], P.z[i]);
  if (t === null) return 1;
  return 1 - TRANSITO.trabalho.perda * rampa(t, TRANSITO.trabalho.de, TRANSITO.trabalho.ate);
}

/** Termo do trânsito no bem-estar do prédio residencial i: de -8 a 0 pelo tempo médio das viagens de quem mora na zona. */
function bemEstarTransito(sim, i) {
  const P = sim.tabelas.predios;
  return bemEstarNoPonto(sim, P.x[i], P.z[i]);
}

/** O mesmo termo para um ponto (x, z) em metros: a prévia da pintura de zona usa para as células que ainda não têm prédio. */
function bemEstarNoPonto(sim, x, z) {
  const t = tempoNoPonto(sim, sim.agregados.trajeto?.porZona, x, z);
  if (t === null) return 0;
  return -TRANSITO.bemEstar.perda * rampa(t, TRANSITO.bemEstar.de, TRANSITO.bemEstar.ate);
}

// ---------------------------------------------------------------------------------------------------- gargalos e avisos

/** Sugestão para uma aresta cheia: 'melhorar' (e para qual tipo), 'maoUnica' ou 'paralela'. */
export function sugestaoPara(sim, e) {
  const A = sim.tabelas.arestas;
  const id = VIAS_ORDEM[A.tipo[e]];
  const v = VIAS[id];
  const f = J(sim).fluxo;
  const qa = f ? f[2 * e] : 0;
  const qb = f ? f[2 * e + 1] : 0;
  const maior = Math.max(qa, qb);
  const menor = Math.min(qa, qb);
  const total = (tipo) => VIAS[tipo].faixas[0] * VIAS[tipo].capFaixa;
  const acima = (v.melhoraPara ?? []).filter((tipo) => tipo !== 'ruaMao' && total(tipo) > total(id));
  // fluxo de um sentido só: a mão única dá as duas faixas a ele, mas só serve se o sentido maior cabe nelas (2 x 700 = 1.400
  // veículos/h); acima disso a mão única já nasce cheia e a sugestão é a avenida (ou a paralela, se não houver via acima)
  if (id === 'rua' && maior > 0 && menor < 0.4 * maior && maior <= total('ruaMao')) return { sugestao: 'maoUnica', para: 'ruaMao' };
  if (acima.length) {
    const preciso = maior;
    const serve = acima.find((tipo) => total(tipo) >= preciso) ?? acima[acima.length - 1];
    return { sugestao: 'melhorar', para: serve };
  }
  return { sugestao: 'paralela', para: null };
}

/** Arestas com v/c acima do limiar, da mais cheia: [{ e, ref, vc, ida, volta, nome }]. */
export function gargalos(sim, limiar = TRANSITO.gargalo) {
  const t = dev(sim);
  const A = sim.tabelas.arestas;
  const j = J(sim);
  const out = [];
  if (!t.vc || !j.fluxo) return out;
  for (let e = 0; e < t.vc.length; e++) {
    if (!A.viva[e] || !(t.vc[e] > limiar)) continue;
    out.push({ e, ref: A.ref(e), vc: t.vc[e], ida: j.fluxo[2 * e], volta: j.fluxo[2 * e + 1], nome: nomeDaAresta(sim, e), rodovia: !!(A.flags[e] & ARESTA.RODOVIA) });
  }
  return out.sort((a, b) => b.vc - a.vc || a.e - b.e);
}

/** Resumo para o robô, a tela da cidade e os testes. */
export function resumoTransito(sim) {
  const j = J(sim);
  const t = dev(sim);
  const tr = sim.agregados.trajeto;
  return {
    aplicado: j.aplicado, zonas: j.zonas, passo: j.passo, viagens: j.viagens, semRota: j.semRota,
    tempoMedio: tr ? Math.round(tr.medio * 100) / 100 : 0, tempoComercio: tr ? Math.round(tr.comercio * 100) / 100 : 0,
    gargalos: t.gargalos, vcMax: Math.round(t.vcMax * 100) / 100, velocidadeMedia: Math.round(t.velMedia * 1000) / 1000,
    clientes: j.clientes,
  };
}

const MID = [0, 0];
function alertasTransito(sim) {
  const t = dev(sim);
  const A = sim.tabelas.arestas;
  if (t.pior === null || t.pior >= A.n || !A.viva[t.pior] || t.vcMax < TRANSITO.parado) return [];
  const e = t.pior;
  const s = sugestaoPara(sim, e);
  ponto(A.p, 0.5, MID, 8 * e);
  const codigo = s.sugestao === 'melhorar' ? 'transitoParado' : s.sugestao === 'maoUnica' ? 'transitoParadoMao' : 'transitoParadoParalela';
  return [{
    id: 'transito', gravidade: t.vcMax >= TRANSITO.grave ? 'grave' : 'atencao', glifo: 'transito', codigo,
    params: { via: nomeDaAresta(sim, e), ref: A.ref(e), vc: Math.round(t.vcMax * 100) / 100, sugestao: s.sugestao, para: s.para, n: t.gargalos },
    alvo: { x: MID[0], z: MID[1] },
  }];
}

// ---------------------------------------------------------------------------------------------------- camada e partes

function camadaTransito(sim) {
  const t = dev(sim);
  const A = sim.tabelas.arestas;
  const dados = new Float32Array(A.n);
  if (t.vc) dados.set(t.vc.subarray(0, Math.min(A.n, t.vc.length)));
  const r = resumoTransito(sim);
  return {
    id: 'transito', fonte: 'arestas', dados, grade: null, tipo: 'seq', escala: { min: 0, max: 1.5, meio: 1, unidade: '' }, categorias: null,
    legenda: [{ v: 0, chave: 'camada.transito.livre' }, { v: 1, chave: 'camada.transito.cheio' }, { v: 1.5, chave: 'camada.transito.parado' }],
    resumo: { chave: 'camada.transito.resumo', params: { gargalos: r.gargalos, minutos: Math.round(r.tempoMedio), vel: Math.round(100 * r.velocidadeMedia) } },
    versao: J(sim).versao,
  };
}

function partePredio(sim, i, out) {
  const P = sim.tabelas.predios;
  const ag = sim.agregados.trajeto;
  if (!ag) return;
  if (P.tipo[i] === TIPO_PREDIO.ZONA && familiaDe(sim, i) === 'res') {
    const t = tempoNoPonto(sim, ag.porZona, P.x[i], P.z[i]);
    out.transito = { minutos: t === null ? null : Math.round(t * 10) / 10, bemEstar: Math.round(bemEstarTransito(sim, i) * 10) / 10 };
  } else {
    const t = tempoNoPonto(sim, ag.destino, P.x[i], P.z[i]);
    out.transito = { minutos: t === null ? null : Math.round(t * 10) / 10, produtividade: Math.round(fatorTrabalho(sim, i) * 1000) / 1000 };
  }
}

function parteCidade(sim, out) {
  out.transito = resumoTransito(sim);
}

// ---------------------------------------------------------------------------------------------------- registro

export function registrar(sim) {
  if (!sim.tabelas.predios || !sim.tabelas.arestas || !sim.grafo) return;
  prepararCidade(sim);
  sim.registrarJson('transito', PADRAO);
  sim.tarefas.registrar('transito', { K: TRANSITO.periodo, aplicar: aplicarTransito, fatiado: true });
  sim.registrarSistema(TRANSITO.periodo, 0, sistemaTransito, TRANSITO.fatias, { nome: 'transito', ordem: ORDEM.transito });
  sim.registrarSistema(1, 0, andarTransito, 1, { nome: 'transitoFila', ordem: ORDEM.transito });
  // o serviço que os outros domínios consultam (sem este módulo valem 1 e 0)
  sim.transito = {
    custoAresta: (e) => {
      const c = dev(sim).cong;
      return c && e < c.length ? 1 + c[e] * TRANSITO.custoPasso : 1;
    },
    versaoCusto: () => dev(sim).versaoCusto,
    fatorTrabalho: (i) => fatorTrabalho(sim, i),
    bemEstar: (i) => bemEstarTransito(sim, i),
    bemEstarNoPonto: (x, z) => bemEstarNoPonto(sim, x, z),
    fatorClientes: () => J(sim).clientes,
    gargalos: (limiar) => gargalos(sim, limiar),
    resumo: () => resumoTransito(sim),
    sugestao: (e) => sugestaoPara(sim, e),
  };
  sim.camadas.registrar('transito', camadaTransito);
  registrarAlertas(alertasTransito);
  registrarPartePredio(partePredio);
  registrarParteCidade(parteCidade);
  sim.aoCarregar(() => derivar(sim));
}
