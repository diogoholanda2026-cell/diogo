// Ambiente do M1b, dona: S2b. Poluição do ar, ruído e o efeito no bem-estar e no valor do terreno (seção 10.1 do desenho
// da simulação, D50). Duas grades de 128 x 128 (64 m) de um byte, no save e no hash: 'ar' acumula (a nuvem), 'ruido' é refeito
// a cada rodada a partir das fontes. Fontes (data/ambiente.js): a indústria zoneada (cai com o nível), a Pedreira, a
// Mina de calcário e a Cimenteira da Holding, a termelétrica, o comércio (só ruído) e as vias grandes (pelo fluxo da
// S1c quando existe, senão pelo tipo da via).
//
// Cada rodada (20 tiques) a grade é refeita em 4 faixas de linhas, uma por fatia: o tique fica leve com a cidade cheia.
// As fontes são coletadas uma vez por rodada, na faixa 0 (prédios e vias varridos uma vez só), somadas por célula e
// guardadas na seção 'ambienteFontes'; a nuvem da rodada anterior fica na grade 'arAnt' (cópia da 'ar' no começo da
// rodada), e toda faixa lê dela e escreve na 'ar': a emenda entre faixas não conta o decaimento e a emissão duas vezes.
// Uma faixa só depende do que está salvo (as grades, as fontes da rodada, as tabelas e o tique), então salvar e carregar
// no meio da rodada dá a mesma partida. Ar: o vento do mês (sorteado pela semente, fração de célula por rodada) desloca a
// nuvem, uma passada de difusão, decaimento de 10% e a emissão das fontes. Ruído: soma do alcance de cada fonte, com
// queda suave.
//
// Efeitos: bem-estar do prédio residencial (ar até -15 e ruído até -10, seção 7.4), valor do terreno (ar x 1,0 e ruído
// x 0,6, seção 10.2), aviso de poluição alta no prédio e alerta da cidade. Tudo isso só vale com o M1b no jogo
// (m1bAtivo): no M1a as grades ficam em zero, nada rodou e o bem-estar não muda.
import { clamp, sen, cos, TAU } from '../comum/util.js';
import { RODADA, MES } from '../comum/relogio.js';
import { fnv1aTexto, hashCoordF } from '../comum/hash.js';
import { ponto, tDoArco } from '../comum/bezier.js';
import { ORDEM } from '../contratos/interno.js';
import { TIPO_PREDIO } from '../contratos/flags.js';
import { VIAS_ORDEM } from '../data/vias.js';
import { SERVICOS_ORDEM } from '../data/servicos.js';
import { HOLDING_ORDEM } from '../data/holding.js';
import { ZONAS_ORDEM } from '../data/zonas.js';
import { VENTO_PREDOMINANTE } from '../data/zon2.js';
import { AMBIENTE, GRADE_AMBIENTE, FONTES, FONTES_VIA, FLUXO_REFERENCIA } from '../data/ambiente.js';
import {
  prepararCidade, funciona, FAMILIA_ZONA, AV, m1bAtivo, registrarPartePredio, registrarAlertas,
} from './predios.js';
import { registrarParteCidade, ocupacaoDe, desempregoDe } from './cidadaos.js';

const N = GRADE_AMBIENTE.n;
const PASSO = GRADE_AMBIENTE.passo;
const [OX, OZ] = GRADE_AMBIENTE.origem;

// ------------------------------------------------------------------------------------------------ fontes

const FONTE_SERVICO = SERVICOS_ORDEM.map((id) => FONTES[id] ?? null);
const FONTE_HOLDING = HOLDING_ORDEM.map((id) => FONTES[id] ?? null);
const FONTE_ZONA = ZONAS_ORDEM.map((id, z) => {
  const fam = id ? FAMILIA_ZONA[z] : null;
  return fam === 'ind' ? FONTES.industria : fam === 'com' ? FONTES.comercio : null;
});
const FONTE_VIA = VIAS_ORDEM.map((id) => FONTES_VIA[id] ?? null);

// ruído: as fontes da mesma célula e do mesmo alcance somam num balde antes de espalhar (a cidade densa tem vários
// prédios por célula de 64 m); um balde por alcance, zerado ao fim da coleta. O ar soma por célula do mesmo jeito.
const ALCANCES = [...new Set([...Object.values(FONTES), ...Object.values(FONTES_VIA)].map((f) => f.raio))].sort((a, b) => a - b);
const BALDES = ALCANCES.map(() => ({ soma: new Float32Array(N * N), usadas: [] }));
const CLASSE_DO_ALCANCE = new Map(ALCANCES.map((r, k) => [r, k]));
const AR_SOMA = new Float64Array(N * N);
const AR_USADAS = [];

/** Junta uma fonte (x, z em metros) aos baldes da coleta; fora da grade não conta. */
function empurrar(x, z, ar, ru, raio) {
  const ci = Math.floor((x - OX) / PASSO);
  const cj = Math.floor((z - OZ) / PASSO);
  if (ci < 0 || cj < 0 || ci >= N || cj >= N) return;
  const c = cj * N + ci;
  if (ru > 0) {
    const b = BALDES[CLASSE_DO_ALCANCE.get(raio)];
    if (b.soma[c] === 0) b.usadas.push(c);
    b.soma[c] += ru;
  }
  if (ar > 0) {
    if (AR_SOMA[c] === 0) AR_USADAS.push(c);
    AR_SOMA[c] += ar;
  }
}

/** Prédios que emitem: indústria e comércio das zonas, Pedreira, Mina e Cimenteira da Holding, termelétrica. */
function coletarPredios(sim) {
  const P = sim.tabelas.predios;
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i]) continue;
    const tp = P.tipo[i];
    const f = tp === TIPO_PREDIO.ZONA ? FONTE_ZONA[P.zona[i]] : tp === TIPO_PREDIO.SERVICO ? FONTE_SERVICO[P.modelo[i]] : FONTE_HOLDING[P.modelo[i]];
    if (!f || !funciona(P, i)) continue;
    let k = 1;
    if (f.porte) k = clamp(P.empregos[i] / f.porte, 0.25, 1.5);
    if (f.nivel && P.nivel[i] > 1) k *= Math.max(0.3, 1 - f.nivel * (P.nivel[i] - 1));
    empurrar(P.x[i], P.z[i], f.ar * k, f.ruido * k, f.raio);
  }
}

/** Fator do fluxo da via (a S1c publica espelho.fluxos; sem ele vale 1). Quantizado: o mesmo número em qualquer máquina. */
function fatorFluxo(sim, e) {
  const F = sim.espelho.fluxos;
  if (!F?.ida || e >= F.ida.length) return 1;
  const f = clamp(0.35 + ((F.ida[e] || 0) + (F.volta?.[e] || 0)) / FLUXO_REFERENCIA, 0.35, 1.5);
  return Math.round(f * 16) / 16;
}

const Q = [0, 0];

/** Amostras de 64 m ao longo das vias grandes (avenida, avenida grande e rodovia). */
function coletarVias(sim) {
  const A = sim.tabelas.arestas;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    const f = FONTE_VIA[A.tipo[e]];
    if (!f) continue;
    const comp = A.arco[17 * e + 16];
    if (!(comp > 0)) continue;
    const o = 8 * e;
    const fator = fatorFluxo(sim, e);
    const tab = A.arco.subarray(17 * e, 17 * e + 17);
    const passos = Math.max(1, Math.round(comp / PASSO));
    for (let s = 0; s < passos; s++) {
      ponto(A.p, tDoArco(tab, ((s + 0.5) * comp) / passos), Q, o);
      empurrar(Q[0], Q[1], f.ar * fator, f.ruido * fator, f.raio);
    }
  }
}

/** A rodada do tique (as fontes guardadas valem para ela). */
const rodadaDe = (tique) => Math.floor(tique / RODADA);

/**
 * Varre os prédios e as vias uma vez e guarda as fontes da rodada somadas por célula (ar) e por célula e alcance (ruído)
 * em sim.json.ambienteFontes. Estado salvo: carregar no meio da rodada usa as mesmas fontes da faixa 0.
 */
function coletar(sim) {
  coletarPredios(sim);
  coletarVias(sim);
  const F = sim.json.ambienteFontes;
  const nAr = AR_USADAS.length;
  F.arCel = new Uint16Array(nAr);
  F.arVal = new Float32Array(nAr);
  for (let k = 0; k < nAr; k++) {
    const c = AR_USADAS[k];
    F.arCel[k] = c;
    F.arVal[k] = AR_SOMA[c];
    AR_SOMA[c] = 0;
  }
  AR_USADAS.length = 0;
  let nRu = 0;
  for (const b of BALDES) nRu += b.usadas.length;
  F.ruCel = new Uint16Array(nRu);
  F.ruCls = new Uint8Array(nRu);
  F.ruVal = new Float32Array(nRu);
  let k = 0;
  for (let q = 0; q < BALDES.length; q++) {
    const b = BALDES[q];
    for (const c of b.usadas) {
      F.ruCel[k] = c;
      F.ruCls[k] = q;
      F.ruVal[k] = b.soma[c];
      b.soma[c] = 0;
      k++;
    }
    b.usadas.length = 0;
  }
  F.rodada = rodadaDe(sim.tique);
}

// ------------------------------------------------------------------------------------------------ ruído

const RU = new Float32Array(N * Math.ceil(N / AMBIENTE.fatias));

const NUCLEOS = new Map();

/** Pesos (1 - d / raio) ao quadrado por deslocamento de célula, para um alcance (m): tabela (2 Rc + 1) ao quadrado, em cache. */
function nucleoDoRaio(R) {
  let t = NUCLEOS.get(R);
  if (t) return t;
  const Rc = Math.ceil(R / PASSO);
  const lado = 2 * Rc + 1;
  const w = new Float32Array(lado * lado);
  for (let b = -Rc; b <= Rc; b++) {
    for (let a = -Rc; a <= Rc; a++) {
      const d = Math.sqrt(a * a + b * b) * PASSO;
      if (d < R) {
        const q = 1 - d / R;
        w[(b + Rc) * lado + a + Rc] = q * q;
      }
    }
  }
  t = { Rc, lado, w };
  NUCLEOS.set(R, t);
  return t;
}

/**
 * Ruído das linhas [j0, j1): soma do alcance de cada fonte, com queda suave ((1 - d / raio) ao quadrado) contada a partir
 * do centro da célula da fonte (tabela por alcance: sem raiz quadrada no laço).
 */
function ruidoDaFaixa(g, j0, j1, F) {
  const linhas = j1 - j0;
  RU.fill(0, 0, linhas * N);
  for (let k = 0; k < F.ruCel.length; k++) {
    const c = F.ruCel[k];
    const ru = F.ruVal[k];
    const { Rc, lado, w } = nucleoDoRaio(ALCANCES[F.ruCls[k]]);
    const ci = c % N;
    const cj = (c - ci) / N;
    const b0 = Math.max(j0, cj - Rc);
    const b1 = Math.min(j1 - 1, cj + Rc);
    if (b0 > b1) continue;
    const a0 = Math.max(0, ci - Rc);
    const a1 = Math.min(N - 1, ci + Rc);
    for (let jj = b0; jj <= b1; jj++) {
      const lin = (jj - j0) * N;
      const tab = (jj - cj + Rc) * lado + Rc - ci;
      for (let ii = a0; ii <= a1; ii++) RU[lin + ii] += ru * w[tab + ii];
    }
  }
  const d = g.dados;
  for (let jj = j0; jj < j1; jj++) {
    for (let ii = 0; ii < N; ii++) d[jj * N + ii] = Math.min(255, Math.floor(RU[(jj - j0) * N + ii] + 0.5));
  }
}

// ------------------------------------------------------------------------------------------------ ar

/** Núcleo 3 x 3 da emissão (soma 16). */
const KERNEL = [1, 2, 1, 2, 4, 2, 1, 2, 1];
const ADV = new Float32Array(N * (Math.ceil(N / AMBIENTE.fatias) + 2)); // linhas j0 - 1 a j1, deslocadas pelo vento
const EMI = new Float32Array(N * Math.ceil(N / AMBIENTE.fatias));

/** Vento do mês em células por rodada: [vx, vz]. Sorteado pela semente e pelo mês (função pura do tique), em torno do predominante. */
export function ventoDoMes(semente, tique) {
  const mes = Math.floor(tique / MES);
  const s = fnv1aTexto(String(semente));
  // D112: o vento do mês foge do predominante (data/zon2.js) por até `dispersao`, para o distrito ficar a sotavento
  const ang = VENTO_PREDOMINANTE.angulo + (hashCoordF(mes, 3, s) - 0.5) * 2 * VENTO_PREDOMINANTE.dispersao;
  const v = AMBIENTE.ar.vento;
  const vel = v.min + (v.max - v.min) * hashCoordF(mes, 5, s);
  return [cos(ang) * vel, sen(ang) * vel];
}

/** Valor da nuvem deslocada em (x, z) em células (interpolação bilinear; fora da grade é zero). */
function amostra(d, x, z) {
  const i0 = Math.floor(x);
  const j0 = Math.floor(z);
  const fx = x - i0;
  const fz = z - j0;
  if (i0 >= 0 && j0 >= 0 && i0 < N - 1 && j0 < N - 1) {
    const k = j0 * N + i0;
    return (d[k] * (1 - fx) + d[k + 1] * fx) * (1 - fz) + (d[k + N] * (1 - fx) + d[k + N + 1] * fx) * fz;
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= N || j >= N ? 0 : d[j * N + i]);
  return (at(i0, j0) * (1 - fx) + at(i0 + 1, j0) * fx) * (1 - fz) + (at(i0, j0 + 1) * (1 - fx) + at(i0 + 1, j0 + 1) * fx) * fz;
}

/**
 * Ar das linhas [j0, j1): o vento desloca, a difusão espalha, 10% some e as fontes soltam fumaça. Lê a nuvem do começo
 * da rodada (a grade `ant`) e escreve na `g`: as linhas que a faixa vizinha já refez não entram na conta.
 */
function arDaFaixa(g, ant, j0, j1, vx, vz, F) {
  const d = g.dados;
  const lido = ant.dados;
  const linhas = j1 - j0;
  // 1. a nuvem deslocada, nas linhas j0 - 1 a j1 (a vizinhança da difusão)
  for (let jj = j0 - 1; jj <= j1; jj++) {
    const base = (jj - j0 + 1) * N;
    for (let ii = 0; ii < N; ii++) ADV[base + ii] = jj < 0 || jj >= N ? 0 : amostra(lido, ii - vx, jj - vz);
  }
  // 2. a emissão das fontes (núcleo 3 x 3 de pesos 1 2 1 / 2 4 2 / 1 2 1, soma 16)
  EMI.fill(0, 0, linhas * N);
  for (let k = 0; k < F.arCel.length; k++) {
    const c = F.arCel[k];
    const ci = c % N;
    const cj = (c - ci) / N;
    if (cj + 1 < j0 || cj - 1 >= j1) continue;
    const massa = (F.arVal[k] * AMBIENTE.ar.emissao) / 16;
    for (let b = 0; b < 3; b++) {
      const jj = cj + b - 1;
      if (jj < j0 || jj >= j1) continue;
      for (let a = 0; a < 3; a++) {
        const ii = ci + a - 1;
        if (ii < 0 || ii >= N) continue;
        EMI[(jj - j0) * N + ii] += massa * KERNEL[b * 3 + a];
      }
    }
  }
  // 3. difusão, decaimento e emissão (o piso do byte limpa o ar fraco: sem fonte a nuvem some)
  const D = AMBIENTE.ar.difusao;
  const sobra = 1 - AMBIENTE.ar.decaimento;
  for (let jj = j0; jj < j1; jj++) {
    const r = (jj - j0 + 1) * N;
    for (let ii = 0; ii < N; ii++) {
      const c = ADV[r + ii];
      const viz = (ii > 0 ? ADV[r + ii - 1] : 0) + (ii < N - 1 ? ADV[r + ii + 1] : 0) + ADV[r - N + ii] + ADV[r + N + ii];
      const v = ((1 - D) * c + (D * viz) / 4) * sobra + EMI[(jj - j0) * N + ii];
      d[jj * N + ii] = v >= 255 ? 255 : Math.floor(v);
    }
  }
}

// ------------------------------------------------------------------------------------------------ sistema

/** Resumo salvo da última rodada: o que a camada, o alerta e a cidade leem sem varrer os prédios. */
function resumir(sim) {
  const P = sim.tabelas.predios;
  const J = sim.json.ambiente;
  const ga = sim.grades.ar.dados;
  const gr = sim.grades.ruido.dados;
  let picoAr = 0;
  let picoRu = 0;
  for (let k = 0; k < ga.length; k++) {
    if (ga[k] > picoAr) picoAr = ga[k];
    if (gr[k] > picoRu) picoRu = gr[k];
  }
  let morAr = 0;
  let morRu = 0;
  let morTotal = 0;
  let alvo = null;
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA || !P.moradores[i] || FAMILIA_ZONA[P.zona[i]] !== 'res' || !funciona(P, i)) continue;
    const m = P.moradores[i];
    morTotal += m;
    const a = celula(ga, P.x[i], P.z[i]);
    const r = celula(gr, P.x[i], P.z[i]);
    if (a >= AMBIENTE.aviso.ar) morAr += m;
    if (r >= AMBIENTE.aviso.ruido) morRu += m;
    if (!alvo && (a >= AMBIENTE.aviso.ar || r >= AMBIENTE.aviso.ruido)) alvo = { x: Math.round(P.x[i]), z: Math.round(P.z[i]) };
  }
  J.picoAr = picoAr;
  J.picoRuido = picoRu;
  J.moradores = morTotal;
  J.moradoresAr = morAr;
  J.moradoresRuido = morRu;
  J.alvo = alvo;
}

/** Uma fatia da rodada do ambiente (4 faixas de linhas). */
export function sistemaAmbiente(sim, fatia, fatias) {
  if (!m1bAtivo()) return;
  const j0 = Math.floor((fatia * N) / fatias);
  const j1 = Math.floor(((fatia + 1) * N) / fatias);
  const F = sim.json.ambienteFontes;
  // a faixa 0 abre a rodada: guarda a nuvem de antes e coleta as fontes (uma carga antiga no meio da rodada coleta aqui)
  if (fatia === 0) sim.grades.arAnt.dados.set(sim.grades.ar.dados);
  if (fatia === 0 || F.rodada !== rodadaDe(sim.tique)) coletar(sim);
  const [vx, vz] = ventoDoMes(sim.semente, sim.tique);
  arDaFaixa(sim.grades.ar, sim.grades.arAnt, j0, j1, vx, vz, F);
  ruidoDaFaixa(sim.grades.ruido, j0, j1, F);
  if (fatia === fatias - 1) {
    resumir(sim);
    sim.mudancas.marcar('ar');
    sim.mudancas.marcar('ruido');
  }
}

// ------------------------------------------------------------------------------------------------ efeitos

/** Índice (0 a 255) da grade em (x, z): a célula de 64 m que contém o ponto (0 fora do mapa). */
function celula(dados, x, z) {
  const i = Math.floor((x - OX) / PASSO);
  const j = Math.floor((z - OZ) / PASSO);
  return i < 0 || j < 0 || i >= N || j >= N ? 0 : dados[j * N + i];
}

/** Poluição do ar em (x, z), de 0 a 255 (0 antes do M1b). */
export const arEm = (sim, x, z) => (sim.grades.ar && m1bAtivo() ? celula(sim.grades.ar.dados, x, z) : 0);

/** Ruído em (x, z), de 0 a 255 (0 antes do M1b). */
export const ruidoEm = (sim, x, z) => (sim.grades.ruido && m1bAtivo() ? celula(sim.grades.ruido.dados, x, z) : 0);

const rampa = (v, de, ate, max) => (v <= de ? 0 : v >= ate ? max : (max * (v - de)) / (ate - de));
const TERMO = { ar: 0, ruido: 0 };

/** Termos do bem-estar em (x, z): { ar (até -15), ruido (até -10) }. Objeto reaproveitado: leia na hora. */
export function termoAmbiente(sim, x, z) {
  TERMO.ar = 0;
  TERMO.ruido = 0;
  if (!m1bAtivo() || !sim.grades.ar) return TERMO;
  const B = AMBIENTE.bemEstar;
  TERMO.ar = rampa(celula(sim.grades.ar.dados, x, z), B.ar.de, B.ar.ate, B.ar.max);
  TERMO.ruido = rampa(celula(sim.grades.ruido.dados, x, z), B.ruido.de, B.ruido.ate, B.ruido.max);
  return TERMO;
}

/** Pontos que o ar e o ruído tiram do valor do terreno em (x, z) (a grade do valor tem 32 m, a daqui 64 m). */
export function penalidadeValor(sim, x, z) {
  if (!m1bAtivo() || !sim.grades.ar) return 0;
  const V = AMBIENTE.valor;
  return V.ar * celula(sim.grades.ar.dados, x, z) + V.ruido * celula(sim.grades.ruido.dados, x, z);
}

/** Bit AV.POLUICAO se o ar ou o ruído no prédio i passam do limite do aviso (0 se não). */
export function avisoDeAmbiente(sim, i) {
  if (!m1bAtivo() || !sim.grades.ar) return 0;
  const P = sim.tabelas.predios;
  const a = celula(sim.grades.ar.dados, P.x[i], P.z[i]);
  const r = celula(sim.grades.ruido.dados, P.x[i], P.z[i]);
  return a >= AMBIENTE.aviso.ar || r >= AMBIENTE.aviso.ruido ? AV.POLUICAO : 0;
}

// ------------------------------------------------------------------------------------------------ camadas

function camadaGrade(id) {
  return (sim) => {
    const g = sim.grades[id];
    const J = sim.json.ambiente;
    return {
      id, fonte: 'grade', dados: Float32Array.from(g.dados), grade: { n: g.n, passo: g.passo, origem: [...g.origem] }, tipo: 'seq',
      escala: { min: 0, max: 255, unidade: '' }, categorias: null,
      legenda: [
        { v: 0, chave: `camada.${id}.limpo` }, { v: id === 'ar' ? AMBIENTE.aviso.ar : AMBIENTE.aviso.ruido, chave: `camada.${id}.aviso` },
        { v: 255, chave: `camada.${id}.alto` },
      ],
      resumo: {
        chave: `camada.${id}.resumo`,
        params: { pico: id === 'ar' ? J.picoAr : J.picoRuido, moradores: id === 'ar' ? J.moradoresAr : J.moradoresRuido },
      },
      versao: sim.json.cidade.rodada,
    };
  };
}

/**
 * Camada Empregos (seção 11.1, divergente): nos locais de trabalho, a fração das vagas abertas (0 a 1, falta gente); nas
 * moradias, menos a fração desempregada (-1 a 0, falta emprego). -2 é "sem dado" (abaixo do mínimo da escala).
 */
function camadaEmpregos(sim) {
  const P = sim.tabelas.predios;
  const dados = new Float32Array(P.n).fill(-2);
  let abertas = 0;
  let vagas = 0;
  for (let i = 0; i < P.n; i++) {
    if (!funciona(P, i)) continue;
    if (P.tipo[i] === TIPO_PREDIO.ZONA && FAMILIA_ZONA[P.zona[i]] === 'res') {
      if (P.moradores[i]) dados[i] = 0 - Math.round(desempregoDe(sim, i) * 1000) / 1000;
      continue;
    }
    const oc = ocupacaoDe(sim, i);
    if (!oc.vagas) continue;
    dados[i] = Math.round((1 - oc.frac) * 1000) / 1000;
    vagas += oc.vagas;
    abertas += oc.vagas - oc.ocupadas;
  }
  const ag = sim.agregados;
  return {
    id: 'empregos', fonte: 'predios', dados, grade: null, tipo: 'div', escala: { min: -1, max: 1, meio: 0, unidade: '' }, categorias: null,
    legenda: [{ v: -1, chave: 'camada.empregos.semEmprego' }, { v: 0, chave: 'camada.empregos.equilibrado' }, { v: 1, chave: 'camada.empregos.semGente' }],
    resumo: {
      chave: 'camada.empregos.resumo',
      params: { desemprego: Math.round((ag.empregos.taxa ?? 0) * 100), abertas: Math.round(abertas), vagas },
    },
    versao: sim.json.cidade.rodada,
  };
}

// ------------------------------------------------------------------------------------------------ alerta, partes

function alertasAmbiente(sim) {
  if (!m1bAtivo() || !sim.json.ambiente) return [];
  const J = sim.json.ambiente;
  if (!(J.moradores > 0)) return [];
  const f = Math.max(J.moradoresAr, J.moradoresRuido) / J.moradores;
  if (f < AMBIENTE.alerta.fracao) return [];
  const ar = J.moradoresAr >= J.moradoresRuido;
  return [{
    id: 'poluicao', gravidade: f > 0.4 ? 'grave' : 'atencao', glifo: 'alerta', codigo: ar ? 'poluicaoAr' : 'poluicaoRuido',
    params: { pct: Math.round(f * 100) }, alvo: J.alvo ?? null,
  }];
}

function partePredio(sim, i, out) {
  if (!m1bAtivo() || !sim.grades.ar) return;
  const P = sim.tabelas.predios;
  out.ambiente = { ar: celula(sim.grades.ar.dados, P.x[i], P.z[i]), ruido: celula(sim.grades.ruido.dados, P.x[i], P.z[i]) };
}

function parteCidade(sim, out) {
  if (!m1bAtivo() || !sim.json.ambiente) return;
  const J = sim.json.ambiente;
  out.ambiente = {
    ar: { pico: J.picoAr, moradores: J.moradoresAr }, ruido: { pico: J.picoRuido, moradores: J.moradoresRuido }, moradores: J.moradores,
  };
}

// ------------------------------------------------------------------------------------------------ registro

export function registrar(sim) {
  if (!sim.tabelas.predios || !sim.grafo) return;
  prepararCidade(sim);
  for (const id of ['ar', 'ruido']) {
    const grade = { n: N, passo: PASSO, origem: [...GRADE_AMBIENTE.origem], dados: new Uint8Array(N * N) };
    sim.registrarGrade(id, grade);
    sim.espelho.grades[id] = grade;
  }
  // a nuvem do começo da rodada (a leitura das faixas) e as fontes da rodada: estado salvo, não derivado
  sim.registrarGrade('arAnt', { n: N, passo: PASSO, origem: [...GRADE_AMBIENTE.origem], dados: new Uint8Array(N * N) });
  sim.registrarJson('ambienteFontes', {
    rodada: -1, arCel: new Uint16Array(0), arVal: new Float32Array(0), ruCel: new Uint16Array(0), ruCls: new Uint8Array(0), ruVal: new Float32Array(0),
  });
  sim.registrarJson('ambiente', { picoAr: 0, picoRuido: 0, moradores: 0, moradoresAr: 0, moradoresRuido: 0, alvo: null });
  sim.registrarSistema(RODADA, 3, sistemaAmbiente, AMBIENTE.fatias, { nome: 'ambiente', ordem: ORDEM.servicos + 70 });
  sim.camadas.registrar('ar', camadaGrade('ar'));
  sim.camadas.registrar('ruido', camadaGrade('ruido'));
  sim.camadas.registrar('empregos', camadaEmpregos);
  registrarAlertas(alertasAmbiente);
  registrarPartePredio(partePredio);
  registrarParteCidade(parteCidade);
}
