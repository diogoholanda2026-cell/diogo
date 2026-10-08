// Ferramenta de traçado pura (D18; dona: S1b): planejar() faz a prévia inteira (encaixe, cruzamentos, greide, regras,
// demolições e custo) e é a mesma conta que o comando aplica depois de conferir de novo; q.via.previa, via.construir,
// via.melhorar, q.aresta, q.viasPerto e o custo de manutenção das vias.
//
// Um plano é feito de traços (a reta, a curva ou cada lado de quadra da grade) entre vértices (nó existente, ponto sobre
// aresta que será dividida, portão da gleba ou ponto novo). Cada traço é cortado nos cruzamentos com as vias que existem
// (dividindo as duas; perto de um nó, passa pelo nó) e ganha um greide que segue o chão com o declive do tipo; onde o
// greide dobra entra um nó a mais, então cada aresta tem a pista plana nos patamares dos cruzamentos e linear entre
// eles (a forma do aplainar põe o chão ao menos 5 cm abaixo dela em toda a seção). Custo: comprimento x custo por metro
// x (1 + 2 x declive médio) mais as demolições.
//
// Formato da prévia (contrato 2.6, com os acréscimos): { ok, segmentos: [{ p: [8] no sentido do traço, tipo,
// cotas: [y0, y1], ponte, erros, declive }], nosNovos, divisoes (contagens), novos: [[x, z]], dividir: [{ aresta, t,
// ponto }], encaixes: [{ indice, ponto, tipo, valor }], guias, pontos (os encaixados), demolir: { predios: [ref], custo },
// comprimento, custo, manutencaoHora, declive, erros: [{ codigo, trecho, dados? }] } (trecho -1: o plano inteiro).
// Modos: reta [A, B]; curva [A, C, B] (C: controle da quadrática); continua [A, C, B] com `tangente` em A; grade
// [A, B, C] (C: canto oposto, `espacamento` opcional); melhorar { arestas: [ref], tipo }; demolir { arestas: [ref] }.
import {
  reta as retaBz, deQuadratica, dividir as dividirBz, ponto, direcao, tangente, tabelaArco, tDoArco,
  arcoDoT, caixa as caixaBz,
} from '../../comum/bezier.js';
import { hipot, clamp } from '../../comum/util.js';
import { refDe } from '../../contratos/espelho.js';
import { ARESTA, MAO } from '../../contratos/flags.js';
import { VIAS, VIAS_ORDEM, REGRAS_VIAS, FOLGA_NO } from '../../data/vias.js';
import { comprimentoPatamar, patamarNaPonta, patamares, cotaDaPista, PATAMAR, FOLGA_CHAO } from '../mundo/aplainar.js';
import { addNo, addAresta, dividir as dividirAresta, cortes, meiaDa, arestasDoNo } from './grafo.js';
import { encaixarTraco, ancorar, espacamentoDe } from './encaixe.js';
import {
  tipoVia, eixoDeCurva, distEixo, pistaNoT, amostrarCurva, trechosSobreAgua, foraDosLadrilhos, entraNaGleba, raioMinimo,
  greide, quebrasDoGreide, saidaDoNo, viasSobrepostas, prediosNaPista, predioDaCidade, arestaIntocavel, noLigavel,
  COS_ANGULO_MIN, CHAO_ABAIXO_DA_PISTA, decliveDa, eixoDa, cruzamentosDeEixos,
} from './validar.js';
import {
  custoDemolirPredio, manutencaoAresta, devolucaoAresta, registrarAcao, registrarForma, tirarForma,
  fotoAresta, caixaDasArestas, reformarNos, prediosNasCelulas,
} from './demolir.js';
import { nomearTraco, nomeDaAresta } from './nomes.js';
import {
  infoDoTraco, classificarCruzamento, comprimentoParaCota, alvoDaAgua, elevacaoPlanejada, viaNoChao, validarPilares,
  codigoPublico, estruturaDaPonte,
} from './ponte.js';
import { lerCota, comprimentoRampa, TRAVESSIA_MAX, ELEVACAO_PONTE, DESNIVEL_MINIMO, GREIDE_MAX_ELEVADO, MULT_CUSTO_PONTE, MULT_MANUTENCAO_PONTE } from '../../comum/viaduto.js';
import { recolherCelulas, refazerBlocos, removerPredio, celulasNaCaixa, celulasDaAresta } from '../zonas/blocos.js';

const MODOS = Object.freeze(['reta', 'curva', 'continua', 'grade', 'melhorar', 'demolir']);
const PASSO_GREIDE = 8;
/** Seno do ângulo abaixo do qual duas vias que se encontram correm juntas (sobreposição, não cruzamento): ~6 graus. */
const SEN_PARALELAS = 0.1;
const COS_15 = 0.9659258262890683;

// ------------------------------------------------------------------------------------------------ argumentos

const numero = (v) => typeof v === 'number' && Number.isFinite(v);
// só números: o comando chega pelo JSON do livro (NaN vira null, e +null seria 0), então a prévia recusa o mesmo ponto
const par = (p) => Array.isArray(p) && p.length >= 2 && numero(p[0]) && numero(p[1]);

/** Direção unitária de um par (a tangente da Contínua), ou null. */
function unitaria(p) {
  if (!par(p)) return null;
  const L = hipot(p[0], p[1]);
  return L > 1e-9 ? [p[0] / L, p[1] / L] : null;
}

/** Argumentos da prévia normalizados, ou null se o formato não serve. */
function lerArgs(args) {
  if (!args || typeof args !== 'object') return null;
  const modo = MODOS.includes(args.modo) ? args.modo : 'reta';
  const tipo = typeof args.tipo === 'string' && Object.hasOwn(VIAS, args.tipo) ? args.tipo : 'rua';
  const pontos = Array.isArray(args.pontos) ? args.pontos.filter(par).map((p) => [p[0], p[1]]) : [];
  return {
    modo,
    tipo,
    pontos,
    tolerancia: numero(args.tolerancia) ? args.tolerancia : REGRAS_VIAS.tolerancia,
    encaixe: args.encaixe !== false,
    sessao: args.sessao ?? null,
    tangente: unitaria(args.tangente),
    espacamento: args.espacamento,
    arestas: Array.isArray(args.arestas) ? args.arestas.filter((r) => Number.isInteger(r)) : [],
    mao: args.mao === -1 ? -1 : 1,
    cota: lerCota(args.cota), // null: fora dos degraus do viaduto
  };
}

/** true se o tipo pode ser construído agora (marco da D24/D51; no Modo livre, tudo). */
export function viaLiberada(sim, id) {
  const tipo = VIAS[id];
  if (!tipo?.constroi) return false;
  if (sim.json.partida?.modo === 'livre') return true;
  if (sim.progresso?.liberado && sim.progresso.liberado(`via.${id}`) === false) return false;
  const n = sim.progresso?.marco ? sim.progresso.marco().n : 0;
  return n >= (tipo.marco ?? 0);
}

const livre = (sim) => sim.json.partida?.modo === 'livre';
const caixa = (sim) => (sim.holding?.caixa ? sim.holding.caixa() : Infinity);

// ------------------------------------------------------------------------------------------------ vértices e traços

/** Meia largura da via com blocos de zona (0 sem blocos: terra, rodovia). */
const meiaComBlocos = (ti) => {
  const t = tipoVia(ti);
  return t?.zona ? t.largura / 2 : 0;
};

function vertice(sim, plano, x, z, ancora) {
  const N = sim.tabelas.nos;
  const A = sim.tabelas.arestas;
  if (ancora?.tipo === 'no') {
    const n = ancora.no;
    const k = plano.porNo.get(n);
    if (k !== undefined) return k;
    // meia: a maior via com blocos que chega no nó (a fase das células de uma via que sai dali)
    let meia = 0;
    for (const e of arestasDoNo(sim.grafo, n)) meia = Math.max(meia, meiaComBlocos(A.tipo[e]));
    plano.vertices.push({ x: N.x[n], z: N.z[n], no: n, e: -1, t: 0, portao: null, y: N.y[n], fixo: true, ancora: true, meia });
    plano.porNo.set(n, plano.vertices.length - 1);
    return plano.vertices.length - 1;
  }
  if (ancora?.tipo === 'aresta') {
    const meia = meiaComBlocos(A.tipo[ancora.e]);
    plano.vertices.push({ x, z, no: -1, e: ancora.e, t: ancora.t, portao: null, y: pistaNoT(sim, ancora.e, ancora.t), fixo: true, ancora: true, meia });
    return plano.vertices.length - 1;
  }
  if (ancora?.tipo === 'portao') {
    plano.vertices.push({ x, z, no: -1, e: -1, t: 0, portao: ancora.id, y: sim.alturaEm(x, z) + CHAO_ABAIXO_DA_PISTA, fixo: true, ancora: true });
    return plano.vertices.length - 1;
  }
  plano.vertices.push({ x, z, no: -1, e: -1, t: 0, portao: null, y: NaN, fixo: false });
  return plano.vertices.length - 1;
}

function ajustarPontas(p, a, b) {
  const dx0 = a.x - p[0];
  const dz0 = a.z - p[1];
  p[0] = a.x;
  p[1] = a.z;
  p[2] += dx0;
  p[3] += dz0;
  const dx1 = b.x - p[6];
  const dz1 = b.z - p[7];
  p[6] = b.x;
  p[7] = b.z;
  p[4] += dx1;
  p[5] += dz1;
  return p;
}

/** Divide a cúbica nos parâmetros ts (crescentes, em (0, 1)): as curvas em ordem. */
function dividirEm(p, ts) {
  const out = [];
  let resto = Float64Array.from(p);
  let t0 = 0;
  for (const t of ts) {
    const local = (t - t0) / (1 - t0);
    const [a, b] = dividirBz(resto, clamp(local, 1e-9, 1 - 1e-9));
    out.push(a);
    resto = b;
    t0 = t;
  }
  out.push(resto);
  return out;
}

/** Pedaço [ta, tb] de uma cúbica. */
function pedaco(p, ta, tb) {
  let q = Float64Array.from(p);
  if (tb < 1) q = dividirBz(q, tb)[0];
  if (ta > 0) q = dividirBz(q, clamp(ta / tb, 1e-9, 1 - 1e-9))[1];
  return q;
}

/**
 * Acerta o cruzamento (t na cúbica p, u na aresta da coluna P) por Newton: P(t) = Q(u) até abaixo de 0,1 mm, para o nó
 * novo ficar em cima das duas curvas.
 */
function refinarCruzamento(p, P, o, t, u) {
  const a = [0, 0];
  const b = [0, 0];
  const da = [0, 0];
  const db = [0, 0];
  for (let k = 0; k < 8; k++) {
    ponto(p, t, a);
    ponto(P, u, b, o);
    const fx = a[0] - b[0];
    const fz = a[1] - b[1];
    if (fx * fx + fz * fz < 1e-8) break;
    tangente(p, t, da);
    tangente(P, u, db, o);
    // [da, -db] [dt, du] = -f
    const det = da[0] * -db[1] - da[1] * -db[0];
    if (Math.abs(det) < 1e-12) break;
    const dt = (-fx * -db[1] - -fz * -db[0]) / det;
    const du = (da[0] * -fz - da[1] * -fx) / det;
    t = clamp(t + dt, 0, 1);
    u = clamp(u + du, 0, 1);
  }
  return [t, u];
}

/**
 * Cruzamentos do traço com as vias que existem: vértices em ordem de t (dividem a aresta ou passam pelo nó). Os
 * vértices só nascem depois de juntar os achados repetidos (o mesmo cruzamento visto por dois segmentos da polilinha,
 * ou por duas arestas no nó delas), para não sobrar vértice solto no plano.
 */
function cruzarTraco(sim, plano, tr) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  const V = plano.vertices;
  const va = V[tr.va];
  const vb = V[tr.vb];
  const bb = caixaBz(tr.p, 0, 1);
  const ids = [...G.gradeArestas.consultar(bb[0], bb[1], bb[2], bb[3])].sort((a, b) => a - b);
  const q = [0, 0];
  const achados = [];
  const lim = REGRAS_VIAS.noNoCruzamento;
  const eixo = eixoDeCurva(tr.p);
  const comp = eixo.comp;
  // viaduto (D106): elevação planejada do traço, e os cruzamentos em que uma via passa por cima da outra sem se ligar
  tr.info = infoDoTraco(sim, plano, tr, comp);
  tr.passagens = [];
  tr.avisos = [];
  for (const e of ids) {
    if (!A.viva[e]) continue;
    const eo = eixoDa(sim, e);
    const xs = cruzamentosDeEixos(eixo, eo).sort((x, y) => x[0] - y[0]);
    let antes = -Infinity;
    for (const [sa, sb, sen] of xs) {
      // o mesmo cruzamento no vértice entre dois segmentos da polilinha
      if (sa - antes < 1) continue;
      antes = sa;
      // nas pontas do traço não é cruzamento (é a ligação no nó ou na aresta)
      if (sa < 1.5 || comp - sa < 1.5) continue;
      // quase paralelas: não é cruzamento, as pistas se sobrepõem
      if (sen < SEN_PARALELAS) {
        tr.erros.add('colisao');
        continue;
      }
      const [t, u] = refinarCruzamento(tr.p, A.p, 8 * e, tDoArco(eixo.tab, sa), tDoArco(eo.tab, sb));
      ponto(tr.p, t, q);
      if (hipot(q[0] - va.x, q[1] - va.z) < 1.5 || hipot(q[0] - vb.x, q[1] - vb.z) < 1.5) continue;
      const cl = classificarCruzamento(sim, tr.info, sa, e, u, q);
      if (cl.tipo !== 'normal') {
        // passa por cima ou por baixo sem ligar; a altura livre da peça pronta decide se serve ('altura')
        tr.passagens.push({ s: sa, e, u, x: q[0], z: q[1], yOutra: cl.yOutra, sen, meia: tipoVia(A.tipo[e]).largura / 2 });
        continue;
      }
      if (arestaIntocavel(sim, e)) {
        tr.erros.add('colisao');
        continue;
      }
      const tab = A.arco.subarray(17 * e, 17 * e + 17);
      const su = arcoDoT(tab, u);
      const ce = tab[16];
      if (su < lim || ce - su < lim) {
        const n = su < lim ? A.a[e] : A.b[e];
        if (!noLigavel(sim, n)) {
          tr.erros.add('colisao');
          continue;
        }
        if (plano.porNo.get(n) === tr.va || plano.porNo.get(n) === tr.vb) continue;
        achados.push({ t, no: n, e: -1, u: 0, meia: tipoVia(A.tipo[e]).largura / 2 });
      } else {
        achados.push({ t, no: -1, e, u, meia: tipoVia(A.tipo[e]).largura / 2 });
      }
    }
  }
  // em ordem ao longo do traço; o nó vem antes da aresta no mesmo ponto
  achados.sort((a, b) => a.t - b.t || b.no - a.no || a.e - b.e);
  const cortes = [];
  for (const c of achados) {
    const ant = cortes[cortes.length - 1];
    if (ant && ((c.no >= 0 && ant.no === c.no) || (c.t - ant.t) * comp < 1)) continue;
    cortes.push(c);
  }
  return cortes.map((c) => {
    if (c.no >= 0) return { t: c.t, meia: c.meia, v: vertice(sim, plano, 0, 0, { tipo: 'no', no: c.no }) };
    ponto(A.p, c.u, q, 8 * c.e);
    return { t: c.t, meia: c.meia, v: vertice(sim, plano, q[0], q[1], { tipo: 'aresta', e: c.e, t: c.u }) };
  });
}

// ------------------------------------------------------------------------------------------------ greide e peças

/**
 * Corta o traço nos cruzamentos, calcula o greide e devolve as peças (as arestas a criar), com os nós de greide.
 */
function pecasDoTraco(sim, plano, tr, ti) {
  const V = plano.vertices;
  const tipo = tipoVia(ti);
  const cortesT = tr.cortes;
  const vs = [tr.va, ...cortesT.map((c) => c.v), tr.vb];
  const curvas = dividirEm(tr.p, cortesT.map((c) => c.t));
  const arcos = curvas.map((p, k) => {
    ajustarPontas(p, V[vs[k]], V[vs[k + 1]]);
    const tab = tabelaArco(p);
    return { p, tab, comp: tab[16], va: vs[k], vb: vs[k + 1] };
  });
  // amostras do greide pelo traço inteiro (as pontas de cada arco são vértices)
  const S = [];
  const X = [];
  const Z = [];
  const ARC = [];
  const SL = [];
  const fixas = new Map();
  const deVertice = new Map();
  const q = [0, 0];
  let acum = 0;
  arcos.forEach((a, k) => {
    const n = Math.max(1, Math.ceil(a.comp / PASSO_GREIDE));
    for (let i = k === 0 ? 0 : 1; i <= n; i++) {
      const s = (a.comp * i) / n;
      ponto(a.p, i === 0 ? 0 : i === n ? 1 : tDoArco(a.tab, s), q);
      const idx = S.length;
      S.push(acum + s);
      X.push(q[0]);
      Z.push(q[1]);
      ARC.push(k);
      SL.push(s);
      if (i === 0 || i === n) {
        const vi = i === 0 ? a.va : a.vb;
        deVertice.set(idx, vi);
        if (V[vi].fixo) fixas.set(idx, V[vi].y);
      }
    }
    acum += a.comp;
  });
  const s = Float64Array.from(S);
  const alvo = new Float64Array(S.length);
  for (let i = 0; i < S.length; i++) alvo[i] = sim.alturaEm(X[i], Z[i]) + CHAO_ABAIXO_DA_PISTA;
  // ponte e viaduto (D53, D106): sobre a água o tabuleiro vai na cota das margens com um leve arco; com cota escolhida,
  // o alvo sobe pelas rampas até o alto. `terra` é o chão com a folga da pista, para medir a elevação depois.
  const terra = Float64Array.from(alvo);
  const info = tr.info ?? infoDoTraco(sim, plano, tr, S[S.length - 1]);
  const { agua, trechos: aguas } = alvoDaAgua(sim, X, Z, s, alvo, tipo.largura / 2);
  const emRampa = new Uint8Array(S.length);
  if (info.cota > 0) {
    for (let i = 0; i < S.length; i++) {
      const el = elevacaoPlanejada(info, S[i]);
      alvo[i] += el;
      if (el > 0) emRampa[i] = 1;
    }
    const preciso = comprimentoParaCota(info);
    if (preciso !== null && S[S.length - 1] < preciso * 0.98) tr.erros.add('rampa');
  }
  // arco reduzido: a pista fica plana nos patamares dos cruzamentos (raio do nó + 8 m, mais com via em ângulo agudo)
  const zonas = [];
  const dir = [0, 0];
  for (const [idx, vi] of deVertice) {
    if (!(plano.raios[vi] > 0)) continue;
    const k = ARC[idx];
    const noInicio = SL[idx] === 0;
    const a = arcos[k];
    direcao(a.p, noInicio ? 0 : 1, dir);
    const tras = idx > 0 ? patamarNoVertice(plano, vi, -dir[0], -dir[1], tipo.largura / 2) : 0;
    const frente = idx < S.length - 1 ? patamarNoVertice(plano, vi, dir[0], dir[1], tipo.largura / 2) : 0;
    if (tras > 0 || frente > 0) zonas.push([Math.max(0, S[idx] - tras), Math.min(acum, S[idx] + frente)]);
  }
  const sr = reduzir(s, zonas);
  const gr = greide(s, alvo, fixas, tipo.declive, REGRAS_VIAS.greideJanela, sr);
  // o corte e o aterro só contam onde a pista segue o chão (no tabuleiro ela anda no alto)
  let piorNoChao = 0;
  for (let i = 0; i < S.length; i++) if (!agua[i] && !emRampa[i]) piorNoChao = Math.max(piorNoChao, Math.abs(gr.y[i] - alvo[i]));
  if (!gr.ok || piorNoChao > REGRAS_VIAS.corteMax) tr.erros.add('declive');
  // elevação: a pista do viaduto menos o greide que a mesma via teria no chão (o aterro de uma via comum não é tabuleiro)
  const elev = new Float64Array(S.length);
  const chaoBase = info.cota > 0 ? greide(s, terra, new Map(), tipo.declive, REGRAS_VIAS.greideJanela, sr).y : null;
  let temTabuleiro = false;
  for (let i = 0; i < S.length; i++) {
    elev[i] = agua[i] ? Infinity : chaoBase ? gr.y[i] - chaoBase[i] : 0;
    if (elev[i] >= ELEVACAO_PONTE) temTabuleiro = true;
  }
  if (aguas.length) temTabuleiro = true;
  for (const [idx, vi] of deVertice) if (!V[vi].fixo && !Number.isFinite(V[vi].y)) V[vi].y = gr.y[idx];
  // quebras: vértices sempre; mais os nós de greide
  const todas = new Map(fixas);
  for (const idx of deVertice.keys()) if (!todas.has(idx)) todas.set(idx, gr.y[idx]);
  if (temTabuleiro) {
    // quebras obrigatórias para o tabuleiro ter peças exatas: as margens, o pé e o topo das rampas e o fim dos
    // patamares dos cruzamentos (a peça do tabuleiro é linear de ponta a ponta, como o render e o trânsito leem)
    const marcar = (i) => {
      if (i <= 0 || i >= S.length - 1 || todas.has(i)) return;
      // peça de menos de 8 m seria 'curto': não marca a menos de 8,5 m de outra quebra
      for (const k of todas.keys()) if (Math.abs(S[k] - S[i]) < REGRAS_VIAS.compMinTrecho + 0.5) return;
      todas.set(i, gr.y[i]);
    };
    const perto = (alvoS) => {
      let m = 0;
      for (let i = 1; i < S.length; i++) if (Math.abs(S[i] - alvoS) < Math.abs(S[m] - alvoS)) m = i;
      return m;
    };
    for (const a of aguas) {
      marcar(a.margemA);
      marcar(a.margemB);
    }
    for (let i = 1; i < S.length - 1; i++) {
      if ((emRampa[i] !== emRampa[i - 1] || emRampa[i] !== emRampa[i + 1]) && elev[i] < Infinity) marcar(i);
    }
    if (info.cota > 0) {
      const Lr = comprimentoRampa(info.cota);
      if (!info.iniAlto) marcar(perto(Lr));
      if (!info.fimAlto) marcar(perto(S[S.length - 1] - Lr));
    }
    for (const [a, b] of zonas) {
      if (b <= a) continue;
      let ia = 0;
      for (let i = 0; i < S.length; i++) if (S[i] <= a) ia = i;
      let ib = S.length - 1;
      for (let i = S.length - 1; i >= 0; i--) if (S[i] >= b) ib = i;
      marcar(ia);
      marcar(ib);
    }
  }
  const quebras = quebrasDoGreide(s, gr.y, todas, REGRAS_VIAS.greideTolerancia, REGRAS_VIAS.greideTrechoMin, sr);
  const pecas = [];
  for (let k = 0; k + 1 < quebras.length; k++) {
    const i = quebras[k];
    const j = quebras[k + 1];
    const arco = arcos[ARC[j]];
    const si = ARC[i] === ARC[j] ? SL[i] : 0;
    const sj = SL[j];
    const ta = si <= 0 ? 0 : tDoArco(arco.tab, si);
    const tb = sj >= arco.comp ? 1 : tDoArco(arco.tab, sj);
    const vi = deVertice.has(i) ? deVertice.get(i) : novoNoDeGreide(plano, X[i], Z[i], gr.y[i]);
    deVertice.set(i, vi);
    const vj = deVertice.has(j) ? deVertice.get(j) : novoNoDeGreide(plano, X[j], Z[j], gr.y[j]);
    deVertice.set(j, vj);
    const p = ajustarPontas(pedaco(arco.p, ta, tb), V[vi], V[vj]);
    // tabuleiro: alguma amostra da peça a ELEVACAO_PONTE ou mais do chão, ou sobre a água
    let alta = 0;
    let sobreAgua = false;
    for (let k = i; k <= j; k++) {
      if (agua[k]) sobreAgua = true;
      else alta = Math.max(alta, elev[k]);
    }
    const pc = {
      p, va: vi, vb: vj, traco: tr.id, s0: S[i], comp: S[j] - S[i], rampa: sr[j] - sr[i], erros: new Set(),
      sobreAgua, elevada: sobreAgua || alta >= ELEVACAO_PONTE, altura: sobreAgua ? 0 : Math.max(0, alta), passagens: [],
    };
    pecas.push(pc);
  }
  // a passagem vale para a peça que a contém (confere a altura livre) e para as vizinhas até 40 m (a sobreposição das
  // pistas é esperada ali)
  for (const ps of tr.passagens ?? []) {
    for (const pc of pecas) {
      if (ps.s >= pc.s0 - 40 && ps.s <= pc.s0 + pc.comp + 40) pc.passagens.push({ ...ps, dentro: ps.s >= pc.s0 - 1e-6 && ps.s <= pc.s0 + pc.comp + 1e-6 });
    }
  }
  // travessia sobre a água de ponta a ponta (a D53 fala do vão do traço, não de cada peça)
  for (const a of aguas) {
    if (S[a.i1] - S[a.i0] > TRAVESSIA_MAX + 1e-6) tr.avisos.push({ s: S[a.i0], s1: S[a.i1], codigo: 'vao' });
  }
  for (const av of tr.avisos ?? []) {
    const s1 = av.s1 ?? av.s;
    const alvos = pecas.filter((x) => s1 >= x.s0 - 1e-6 && av.s <= x.s0 + x.comp + 1e-6);
    for (const pc of alvos.length ? alvos : pecas.slice(0, 1)) pc.erros.add(av.codigo);
  }
  return pecas;
}

/** Arco reduzido: s menos o que ficou dentro das zonas planas até ali. */
function reduzir(s, zonas) {
  const z = zonas.filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  const juntas = [];
  for (const [a, b] of z) {
    const u = juntas[juntas.length - 1];
    if (u && a <= u[1]) u[1] = Math.max(u[1], b);
    else juntas.push([a, b]);
  }
  const sr = new Float64Array(s.length);
  for (let i = 0; i < s.length; i++) {
    let dentro = 0;
    for (const [a, b] of juntas) {
      if (s[i] <= a) break;
      dentro += Math.min(s[i], b) - a;
    }
    sr[i] = s[i] - dentro;
  }
  return sr;
}

/**
 * Raio que cada vértice vai ter com o plano construído (a mesma conta de grafo.cortes): as vias que já chegam nele mais
 * os traços do plano (que passam pelos cruzamentos nos dois sentidos).
 */
function calcularRaios(sim, plano, ti) {
  const A = sim.tabelas.arestas;
  const V = plano.vertices;
  const dirs = V.map(() => []);
  V.forEach((v, vi) => {
    for (const x of saidasExistentes(sim, v)) dirs[vi].push({ d: x.d, tipo: A.tipo[x.e] });
  });
  const d = [0, 0];
  for (const tr of plano.tracos) {
    direcao(tr.p, 0, d);
    dirs[tr.va].push({ d: [d[0], d[1]], tipo: ti });
    direcao(tr.p, 1, d);
    dirs[tr.vb].push({ d: [-d[0], -d[1]], tipo: ti });
    for (const c of tr.cortes) {
      direcao(tr.p, c.t, d);
      dirs[c.v].push({ d: [d[0], d[1]], tipo: ti }, { d: [-d[0], -d[1]], tipo: ti });
    }
  }
  plano.dirs = dirs;
  plano.raios = dirs.map((l) => {
    if (l.length < 2) return 0;
    if (l.length === 2 && l[0].tipo === l[1].tipo && -(l[0].d[0] * l[1].d[0] + l[0].d[1] * l[1].d[1]) >= COS_15) return 0;
    let m = 0;
    for (const x of l) m = Math.max(m, VIAS[VIAS_ORDEM[x.tipo]].largura / 2);
    return m + FOLGA_NO;
  });
}

/**
 * Patamar que a via de meia largura `meia` que sai do vértice vi na direção (dx, dz) vai ter com o plano construído (a
 * mesma conta de patamarNaPonta sobre o grafo pronto).
 */
function patamarNoVertice(plano, vi, dx, dz, meia) {
  const r = plano.raios[vi];
  if (!(r > 0)) return 0;
  const l = plano.dirs[vi];
  let propria = -1;
  let melhor = 0.999;
  for (let k = 0; k < l.length; k++) {
    const c = l[k].d[0] * dx + l[k].d[1] * dz;
    if (c > melhor) {
      melhor = c;
      propria = k;
    }
  }
  const outras = [];
  for (let k = 0; k < l.length; k++) {
    if (k !== propria) outras.push(VIAS[VIAS_ORDEM[l[k].tipo]].largura / 2, l[k].d[0] * dx + l[k].d[1] * dz);
  }
  return comprimentoPatamar(r, meia, outras);
}

function novoNoDeGreide(plano, x, z, y) {
  plano.vertices.push({ x, z, no: -1, e: -1, t: 0, portao: null, y, fixo: true });
  return plano.vertices.length - 1;
}

// ------------------------------------------------------------------------------------------------ validação

/** Direção de saída de uma peça a partir de um dos seus vértices. */
function saidaDaPeca(pc, vi, out = [0, 0]) {
  if (pc.va === vi) return direcao(pc.p, 0, out);
  direcao(pc.p, 1, out);
  out[0] = -out[0];
  out[1] = -out[1];
  return out;
}

/** Direções das vias que já existem num vértice (nó: as saídas; ponto de divisão: os dois lados da tangente). */
function saidasExistentes(sim, v) {
  const A = sim.tabelas.arestas;
  const out = [];
  if (v.no >= 0) {
    for (const e of arestasDoNo(sim.grafo, v.no)) out.push({ e, d: saidaDoNo(sim, e, v.no, [0, 0]) });
  } else if (v.e >= 0) {
    const d = direcao(A.p, v.t, [0, 0], 8 * v.e);
    out.push({ e: v.e, d }, { e: v.e, d: [-d[0], -d[1]] });
  }
  return out;
}

function validar(sim, plano, ti) {
  const A = sim.tabelas.arestas;
  const C = sim.tabelas.celulas;
  const V = plano.vertices;
  const tipo = tipoVia(ti);
  const meia = tipo.largura / 2;
  // por vértice: peças que chegam
  const porVertice = new Map();
  plano.pecas.forEach((pc, k) => {
    for (const vi of [pc.va, pc.vb]) {
      const l = porVertice.get(vi);
      if (l) l.push(k);
      else porVertice.set(vi, [k]);
    }
  });
  // ângulos e grau
  for (const [vi, lista] of porVertice) {
    const v = V[vi];
    const exist = saidasExistentes(sim, v);
    const grau = (v.no >= 0 ? sim.tabelas.nos.grau[v.no] : v.e >= 0 ? 2 : 0) + lista.length;
    if (grau > REGRAS_VIAS.grauMax) for (const k of lista) plano.pecas[k].erros.add('colisao');
    const dirs = lista.map((k) => saidaDaPeca(plano.pecas[k], vi));
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        if (dirs[i][0] * dirs[j][0] + dirs[i][1] * dirs[j][1] > COS_ANGULO_MIN + 1e-9) {
          plano.pecas[lista[i]].erros.add('angulo');
          plano.pecas[lista[j]].erros.add('angulo');
        }
      }
      for (const x of exist) {
        if (dirs[i][0] * x.d[0] + dirs[i][1] * x.d[1] > COS_ANGULO_MIN + 1e-9) plano.pecas[lista[i]].erros.add('angulo');
      }
    }
  }
  // divisões: cada pedaço da aresta dividida com o mínimo
  const porAresta = new Map();
  V.forEach((v, vi) => {
    if (v.e < 0) return;
    const l = porAresta.get(v.e);
    if (l) l.push(vi);
    else porAresta.set(v.e, [vi]);
  });
  for (const [e, lista] of porAresta) {
    const tab = A.arco.subarray(17 * e, 17 * e + 17);
    const ss = lista.map((vi) => arcoDoT(tab, V[vi].t)).sort((a, b) => a - b);
    let ant = 0;
    for (const x of [...ss, tab[16]]) {
      if (x - ant < REGRAS_VIAS.compMinTrecho) for (const vi of lista) for (const k of porVertice.get(vi) ?? []) plano.pecas[k].erros.add('curto');
      ant = x;
    }
  }
  // cada peça
  const demolir = new Set();
  const bloqueiaPilar = viaNoChao(sim);
  plano.pecas.forEach((pc) => {
    const a = amostrarCurva(pc.p);
    pc.amostras = a;
    if (pc.comp < REGRAS_VIAS.compMinTrecho - 1e-6) pc.erros.add('curto');
    const g = Math.abs(V[pc.vb].y - V[pc.va].y) / Math.max(1, pc.rampa);
    pc.declive = g;
    // tabuleiro (ponte ou viaduto): rampa de até 8% (D106); no chão, o declive do tipo
    if (pc.elevada) {
      if (g > Math.min(tipo.declive, GREIDE_MAX_ELEVADO) + 1e-6) pc.erros.add('greide');
    } else if (g > tipo.declive + 1e-6) pc.erros.add('declive');
    // água: ponte se houver travessia registrada (X4, D53)
    const agua = trechosSobreAgua(sim, a, meia);
    pc.ponte = pc.elevada;
    if (agua.length) {
      const r = sim.travessia.consultar({ tipo: VIAS_ORDEM[ti], p: Array.from(pc.p), trechos: agua, comprimento: pc.comp, cotas: [V[pc.va].y, V[pc.vb].y] });
      if (r) {
        pc.ponte = true;
        if (r.codigo) pc.erros.add(r.codigo);
      } else pc.erros.add('agua');
    }
    if (foraDosLadrilhos(sim, a, meia)) pc.erros.add('ladrilho');
    if (entraNaGleba(sim, a, meia)) pc.erros.add('gleba');
    // sobreposição com outras vias, fora da junção nos vértices da peça
    const excl = new Map();
    for (const vi of [pc.va, pc.vb]) {
      const v = V[vi];
      const d = saidaDaPeca(pc, vi);
      for (const x of saidasExistentes(sim, v)) {
        const mo = tipoVia(A.tipo[x.e]).largura / 2;
        const sin = Math.abs(d[0] * x.d[1] - d[1] * x.d[0]);
        const r = (meia + mo) / Math.max(sin, 0.5) + 2;
        // a mesma via segue depois de um nó de grau 2 sem raio (quebra do greide): a junção vale para ela também
        for (const o of [x.e, ...continuacoes(sim, x.e)]) {
          const l = excl.get(o);
          if (l) l.push([v.x, v.z, r]);
          else excl.set(o, [[v.x, v.z, r]]);
        }
      }
    }
    // passagens: onde a pista passa por cima (ou por baixo) de outra via sem se ligar, a sobreposição é esperada e a
    // altura livre real da peça pronta é conferida (a estimada do cruzamento usava o perfil planejado)
    for (const ps of pc.passagens ?? []) {
      const r = (meia + ps.meia) / Math.max(ps.sen, 0.3) + 4;
      const l = excl.get(ps.e);
      if (l) l.push([ps.x, ps.z, r]);
      else excl.set(ps.e, [[ps.x, ps.z, r]]);
      if (!ps.dentro) continue;
      const f = pc.comp > 0 ? Math.min(1, Math.max(0, (ps.s - pc.s0) / pc.comp)) : 0;
      const y = V[pc.va].y + (V[pc.vb].y - V[pc.va].y) * f;
      if (Math.abs(y - ps.yOutra) < DESNIVEL_MINIMO - 0.05) pc.erros.add('altura');
    }
    if (viasSobrepostas(sim, a, meia, excl).length) pc.erros.add('colisao');
    // prédios na pista: os da cidade saem (custo), os outros barram; o tabuleiro no alto não derruba nada, recusa
    for (const i of prediosNaPista(sim, a, meia)) {
      if (pc.elevada) pc.erros.add('colisao');
      else if (predioDaCidade(sim, i)) demolir.add(i);
      else pc.erros.add('colisao');
    }
    // pilar em chão válido: fora da pista de via no chão, de prédio e de água funda demais
    if (pc.elevada) for (const c of validarPilares(sim, pc, V[pc.va].y, V[pc.vb].y, bloqueiaPilar)) pc.erros.add(c);
    // prédios da cidade cujas células ficam a menos de meia largura + 4 m da pista nova
    const eixo = eixoDeCurva(pc.p);
    const r = meia + 4;
    const cx = eixo.caixa;
    if (C.motivo && !pc.elevada) {
      for (const c of celulasNaCaixa(sim, cx[0] - r, cx[1] - r, cx[2] + r, cx[3] + r)) {
        const i = C.predio[c];
        if (i < 0 || demolir.has(i)) continue;
        if (distEixo(eixo, C.x[c], C.z[c], DEX, r).d < r) demolir.add(i);
      }
    }
  });
  // a coluna de células que o nó novo corta não cabe inteira em nenhuma das metades da aresta dividida: o prédio da
  // cidade nela sai com a obra (refazerBlocos não acha as células dele), e a prévia avisa
  for (const [e, lista] of porAresta) {
    const cortadas = colunasCortadas(sim, plano, e, lista);
    if (!cortadas.size) continue;
    for (const c of celulasDaAresta(sim, e)) {
      const i = C.predio[c];
      if (i >= 0 && cortadas.has(C.coluna[c]) && predioDaCidade(sim, i)) demolir.add(i);
    }
  }
  plano.demolir = [...demolir].sort((a, b) => a - b);
  decliveDasVizinhas(sim, plano, porVertice, porAresta);
}

/**
 * Colunas de células da aresta e que a divisão nos vértices dados tira. A mesma conta de dividirNosVertices (divisões
 * do fim para o começo, a fase de cada metade pelo comprimento da anterior, em Float32 como no grafo) e de gerar em
 * blocos.js (só colunas inteiras a partir da fase).
 */
function colunasCortadas(sim, plano, e, lista) {
  const A = sim.tabelas.arestas;
  const V = plano.vertices;
  const fase0 = A.fase ? A.fase[e] : 0;
  const pecas = [];
  let atual = Float64Array.from(A.p.subarray(8 * e, 8 * e + 8));
  let uFim = 1;
  for (const vi of [...lista].sort((a, b) => V[b].t - V[a].t)) {
    const [h1, h2] = dividirBz(atual, clamp(V[vi].t / uFim, 1e-6, 1 - 1e-6));
    pecas.unshift({ p: h2, fase: A.fase ? Math.fround(mod8(fase0 - tabelaArco(h1)[16])) : 0 });
    atual = h1;
    uFim = V[vi].t;
  }
  pecas.unshift({ p: atual, fase: fase0 });
  const colunas = (comp, fase) => Math.max(0, Math.floor((comp - mod8(fase)) / 8 + 1e-6));
  const total = colunas(A.arco[17 * e + 16], fase0);
  const ficam = new Uint8Array(total);
  let s = 0;
  for (const pc of pecas) {
    const comp = tabelaArco(pc.p)[16];
    const k0 = Math.round((s + mod8(pc.fase) - mod8(fase0)) / 8);
    const n = colunas(comp, pc.fase);
    for (let k = Math.max(0, k0); k < Math.min(total, k0 + n); k++) ficam[k] = 1;
    s += comp;
  }
  const out = new Set();
  for (let k = 0; k < total; k++) if (!ficam[k]) out.add(k);
  return out;
}

/**
 * O patamar novo de um cruzamento encurta a rampa das vias que já existem (as metades de uma aresta dividida e as que
 * chegam num nó que ganha via). O patamar cede para a rampa não passar do declive do tipo; se com isso o cruzamento
 * ficar desnivelado (a pista sai mais de 10 cm da cota do nó antes de as pistas se separarem, e o chão passaria da
 * folga sob a pista), ou se a rampa passar do declive do tipo, o trecho do plano que chega ali leva 'declive'.
 */
function decliveDasVizinhas(sim, plano, porVertice, porAresta) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const V = plano.vertices;
  const d = [0, 0];
  const folga = CHAO_ABAIXO_DA_PISTA - FOLGA_CHAO;
  const marcar = (vis) => {
    for (const vi of vis) for (const k of porVertice.get(vi) ?? []) plano.pecas[k].erros.add('declive');
  };
  // trecho de comprimento comp da aresta e, de p (cota yp, patamar pp) a q; vp e vq: vértices do plano nas pontas
  const conferir = (e, comp, yp, yq, pp, pq, vp, vq) => {
    const tipo = tipoVia(A.tipo[e]);
    const [a, b] = patamares(comp, pp, pq, yq - yp, tipo.declive);
    const g = Math.abs(yq - yp) / Math.max(1, comp - a - b);
    let ruim = g > tipo.declive + 1e-6 && g > decliveDa(sim, e) + 1e-6;
    // desnível dentro do cruzamento: até onde o patamar pedido chegaria sem a folga de 8 m
    for (const [vi, pedido, s] of [[vp, pp, (x) => x], [vq, pq, (x) => comp - x]]) {
      if (vi === undefined || ruim) continue;
      const D = Math.min(comp, Math.max(0, pedido - PATAMAR));
      const y = cotaDaPista(yp, yq, comp, a, b, s(D));
      if (Math.abs(y - V[vi].y) > folga) ruim = true;
    }
    if (ruim) marcar([vp, vq].filter((x) => x !== undefined));
  };
  // patamar da aresta e na ponta do nó n: o do plano, se o nó é vértice dele, senão o de agora
  const patamarNo = (e, n) => {
    const vi = plano.porNo.get(n);
    if (vi === undefined) return patamarNaPonta(G, e, n);
    saidaDoNo(sim, e, n, d);
    return patamarNoVertice(plano, vi, d[0], d[1], tipoVia(A.tipo[e]).largura / 2);
  };
  // vias que chegam num nó que já existe
  for (const [n] of plano.porNo) {
    for (const e of arestasDoNo(G, n)) {
      if (porAresta.has(e)) continue;
      const a = A.a[e];
      const b = A.b[e];
      conferir(e, A.arco[17 * e + 16], N.y[a], N.y[b], patamarNo(e, a), patamarNo(e, b), plano.porNo.get(a), plano.porNo.get(b));
    }
  }
  // metades das arestas divididas
  for (const [e, lista] of porAresta) {
    const tab = A.arco.subarray(17 * e, 17 * e + 17);
    const pts = lista.map((vi) => ({ vi, s: arcoDoT(tab, V[vi].t), y: V[vi].y })).sort((x, y) => x.s - y.s);
    const a = A.a[e];
    const b = A.b[e];
    const seq = [{ vi: plano.porNo.get(a), s: 0, y: N.y[a], pat: patamarNo(e, a) }, ...pts, { vi: plano.porNo.get(b), s: tab[16], y: N.y[b], pat: patamarNo(e, b) }];
    const meia = tipoVia(A.tipo[e]).largura / 2;
    for (let k = 0; k + 1 < seq.length; k++) {
      const p = seq[k];
      const q = seq[k + 1];
      let pp = p.pat;
      let pq = q.pat;
      if (pp === undefined) {
        direcao(A.p, V[p.vi].t, d, 8 * e);
        pp = patamarNoVertice(plano, p.vi, d[0], d[1], meia);
      }
      if (pq === undefined) {
        direcao(A.p, V[q.vi].t, d, 8 * e);
        pq = patamarNoVertice(plano, q.vi, -d[0], -d[1], meia);
      }
      conferir(e, q.s - p.s, p.y, q.y, pp, pq, p.vi, q.vi);
    }
  }
}

/** Arestas que continuam a aresta e depois de nós de grau 2 sem raio (até dois nós adiante, dos dois lados). */
function continuacoes(sim, e) {
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const out = [];
  for (const n0 of [A.a[e], A.b[e]]) {
    let atual = e;
    let n = n0;
    for (let passo = 0; passo < 2; passo++) {
      if (N.grau[n] !== 2 || N.raio[n] > 0) break;
      const prox = arestasDoNo(sim.grafo, n).find((o) => o !== atual);
      if (prox === undefined || prox === e || out.includes(prox)) break;
      out.push(prox);
      n = A.a[prox] === n ? A.b[prox] : A.a[prox];
      atual = prox;
    }
  }
  return out;
}

const DEX = { d: 0, s: 0 };
const mod8 = (x) => {
  const m = x % 8;
  return m < 0 ? m + 8 : m;
};

// ------------------------------------------------------------------------------------------------ planejar

/**
 * Planeja um traço. Puro: não muda o estado (os índices derivados podem ser refeitos).
 * @returns {{ saida: object, interno: object | null }}
 */
export function planejar(sim, argsBrutos) {
  const args = lerArgs(argsBrutos);
  if (!args) return { saida: vazia([{ codigo: 'valor', trecho: -1 }]), interno: null };
  if (args.modo === 'melhorar') return planejarMelhoria(sim, args);
  if (args.modo === 'demolir') return planejarDemolicao(sim, args);
  if (args.cota === null) return { saida: vazia([{ codigo: 'valor', trecho: -1 }]), interno: null };
  if (!args.pontos.length) return { saida: vazia([{ codigo: 'valor', trecho: -1 }]), interno: null };
  const ti = VIAS_ORDEM.indexOf(args.tipo);
  const tipo = VIAS[args.tipo];
  const enc = encaixarTraco(sim, args);
  const pts = enc.pontos;
  if (pts.length === 1) {
    const s = vazia([]);
    s.encaixes = enc.encaixes;
    s.pontos = pts;
    return { saida: s, interno: null };
  }
  // cota do viaduto (D106): a grade de quadras é sempre no chão
  const plano = { vertices: [], porNo: new Map(), tracos: [], pecas: [], demolir: [], sessao: args.sessao, modo: args.modo, ti, cota: args.modo === 'grade' ? 0 : args.cota };
  const ult = pts.length - 1;
  const novoTraco = (p, va, vb, linha) => {
    const tr = { id: plano.tracos.length, p: ajustarPontas(Float64Array.from(p), plano.vertices[va], plano.vertices[vb]), va, vb, linha, erros: new Set() };
    plano.tracos.push(tr);
    return tr;
  };
  if (args.modo === 'grade') {
    montarGrade(sim, plano, args, enc, novoTraco);
  } else {
    const va = vertice(sim, plano, pts[0][0], pts[0][1], enc.ancoras[0]);
    const vb = vertice(sim, plano, pts[ult][0], pts[ult][1], enc.ancoras[ult]);
    let p;
    if (args.modo === 'curva' && pts.length >= 3) {
      p = deQuadratica(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[ult][0], pts[ult][1]);
    } else if (args.modo === 'continua' && pts.length >= 3) {
      const tan = args.tangente ?? continuacao(enc.refsA);
      const c = tan ? controleTangente(pts[0], tan, pts[ult]) : pts[1];
      p = deQuadratica(pts[0][0], pts[0][1], c[0], c[1], pts[ult][0], pts[ult][1]);
    } else {
      p = retaBz(pts[0][0], pts[0][1], pts[ult][0], pts[ult][1]);
    }
    if (va === vb || hipot(pts[ult][0] - pts[0][0], pts[ult][1] - pts[0][1]) < 1) {
      const s = vazia([{ codigo: 'curto', trecho: -1 }]);
      s.encaixes = enc.encaixes;
      s.pontos = pts;
      return { saida: s, interno: null };
    }
    const tr = novoTraco(p, va, vb, 0);
    if ((args.modo === 'curva' || args.modo === 'continua') && raioMinimo(tr.p) < tipo.raioMin) tr.erros.add('raio');
  }
  for (const tr of plano.tracos) tr.cortes = cruzarTraco(sim, plano, tr);
  calcularRaios(sim, plano, ti);
  for (const tr of plano.tracos) {
    for (const pc of pecasDoTraco(sim, plano, tr, ti)) {
      for (const c of tr.erros) pc.erros.add(c);
      plano.pecas.push(pc);
    }
  }
  validar(sim, plano, ti);
  return { saida: saidaDoPlano(sim, plano, args, enc), interno: plano };
}

/** Direção da continuação numa âncora de uma via só (para a Contínua sem tangente). */
function continuacao(refs) {
  const r = refs.find((x) => x.continua);
  return r ? [r.dx, r.dz] : null;
}

/** Controle da quadrática que sai de a na direção tan e chega em b num arco quase circular (o mesmo da UI). */
export function controleTangente(a, tan, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const L = hipot(dx, dz) || 1;
  const cosT = (dx * tan[0] + dz * tan[1]) / L;
  const s = L / (2 * Math.max(0.18, cosT));
  const k = Math.min(s, L * 1.5);
  return [a[0] + tan[0] * k, a[1] + tan[1] * k];
}

/** Grade: vértices nos cruzamentos das ruas do retângulo A, B, C e um traço por lado de quadra. */
function montarGrade(sim, plano, args, enc, novoTraco) {
  const pts = enc.pontos;
  const [ax, az] = pts[0];
  const [bx, bz] = pts[1];
  const c = pts[2] ?? [bx, bz];
  const W = hipot(bx - ax, bz - az);
  if (W < 1) return;
  const ux = (bx - ax) / W;
  const uz = (bz - az) / W;
  let vx = c[0] - bx;
  let vz = c[1] - bz;
  const D = hipot(vx, vz);
  vx = D > 1e-9 ? vx / D : -uz;
  vz = D > 1e-9 ? vz / D : ux;
  const esp = espacamentoDe(args);
  const nd = Math.max(1, Math.round(D / esp));
  const pos = [];
  for (let s = 0; s < W - esp / 3; s += esp) pos.push(s);
  pos.push(W);
  const grade = [];
  for (let j = 0; j < pos.length; j++) {
    const coluna = [];
    for (let k = 0; k <= nd; k++) {
      const o = Math.min(D, k * esp);
      const x = ax + ux * pos[j] + vx * o;
      const z = az + uz * pos[j] + vz * o;
      let anc = null;
      if (j === 0 && k === 0) anc = enc.ancoras[0];
      else if (j === pos.length - 1 && k === 0) anc = enc.ancoras[1];
      else anc = ancorar(sim, x, z, { tol: 1, tolNo: 2 }).ancora;
      const vi = vertice(sim, plano, x, z, anc);
      const v = plano.vertices[vi];
      if (!v.fixo) {
        v.y = sim.alturaEm(v.x, v.z) + CHAO_ABAIXO_DA_PISTA;
        v.fixo = true;
      }
      coluna.push(vi);
    }
    grade.push(coluna);
  }
  const V = plano.vertices;
  // paralelas a AB (uma linha de nomes cada) e perpendiculares
  for (let k = 0; k <= nd; k++) {
    for (let j = 0; j + 1 < pos.length; j++) {
      const a = V[grade[j][k]];
      const b = V[grade[j + 1][k]];
      novoTraco(retaBz(a.x, a.z, b.x, b.z), grade[j][k], grade[j + 1][k], 1000 + k);
    }
  }
  for (let j = 0; j < pos.length; j++) {
    for (let k = 0; k < nd; k++) {
      const a = V[grade[j][k]];
      const b = V[grade[j][k + 1]];
      novoTraco(retaBz(a.x, a.z, b.x, b.z), grade[j][k], grade[j][k + 1], 2000 + j);
    }
  }
}

function vazia(erros) {
  return {
    ok: false, segmentos: [], nosNovos: 0, divisoes: 0, novos: [], dividir: [], encaixes: [], guias: [], pontos: [],
    demolir: { predios: [], custo: 0 }, comprimento: 0, custo: 0, manutencaoHora: 0, declive: 0, erros,
  };
}

function saidaDoPlano(sim, plano, args, enc) {
  const A = sim.tabelas.arestas;
  const P = sim.tabelas.predios;
  const V = plano.vertices;
  const tipo = VIAS[args.tipo];
  const erros = [];
  let comprimento = 0;
  let custoVia = 0;
  let manutencao = 0;
  let declive = 0;
  const segmentos = plano.pecas.map((pc, k) => {
    comprimento += pc.comp;
    // ponte e viaduto custam MULT_CUSTO_PONTE vezes a via comum por metro (D53, D106)
    custoVia += pc.comp * (tipo.custoM ?? 0) * (1 + 2 * pc.declive) * (pc.ponte ? MULT_CUSTO_PONTE : 1);
    manutencao += (pc.comp / 1000) * (tipo.manutKmH ?? 0) * (pc.ponte ? MULT_MANUTENCAO_PONTE : 1);
    declive = Math.max(declive, pc.declive);
    const publicos = [...pc.erros].map(codigoPublico);
    for (const c of publicos) erros.push(c.dados ? { codigo: c.codigo, trecho: k, dados: c.dados } : { codigo: c.codigo, trecho: k });
    return {
      p: Array.from(pc.p), tipo: args.tipo, cotas: [V[pc.va].y, V[pc.vb].y], ponte: pc.ponte, erros: publicos.map((c) => c.codigo),
      declive: pc.declive, obra: pc.ponte ? (pc.sobreAgua ? 'ponte' : 'viaduto') : null, altura: pc.ponte ? Math.round(pc.altura * 10) / 10 : 0,
    };
  });
  let custoDemolir = 0;
  for (const i of plano.demolir) custoDemolir += custoDemolirPredio(sim, i);
  if ((!segmentos.length || (args.modo !== 'grade' && comprimento < REGRAS_VIAS.compMinTracado)) && !erros.some((e) => e.codigo === 'curto')) {
    erros.push({ codigo: 'curto', trecho: -1 });
  }
  if (!viaLiberada(sim, args.tipo)) erros.push({ codigo: 'marco', trecho: -1 });
  const custo = Math.round(custoVia + custoDemolir);
  const cx = caixa(sim);
  if (!livre(sim) && custo > cx) erros.push({ codigo: 'creditos', trecho: -1, dados: { faltam: Math.ceil(custo - cx) } });
  const novos = [];
  const dividir = [];
  for (const v of V) {
    if (v.no >= 0) continue;
    if (v.e >= 0) dividir.push({ aresta: refDe(v.e, A.ger[v.e]), t: v.t, ponto: [v.x, v.z] });
    else novos.push([v.x, v.z]);
  }
  plano.custo = custo;
  plano.custoVia = custoVia;
  return {
    ok: erros.length === 0,
    segmentos,
    nosNovos: novos.length,
    divisoes: dividir.length,
    novos,
    dividir,
    encaixes: enc.encaixes,
    guias: enc.guias,
    pontos: enc.pontos,
    demolir: { predios: plano.demolir.map((i) => refDe(i, P.ger[i])), custo: Math.round(custoDemolir) },
    comprimento: Math.round(comprimento * 10) / 10,
    custo,
    manutencaoHora: Math.round(manutencao * 10) / 10,
    declive: Math.round(declive * 1000) / 1000,
    erros,
  };
}

// ------------------------------------------------------------------------------------------------ aplicar

/** Divide a aresta e nos vértices dados (u crescente): acerta a cota, a fase e o nome das metades e as formas. */
function dividirNosVertices(sim, plano, e, lista) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const V = plano.vertices;
  const foto = fotoAresta(sim, e);
  tirarForma(sim, foto.ref);
  let atual = e;
  let uFim = 1;
  const pecas = [];
  const ordem = [...lista].sort((a, b) => V[b].t - V[a].t);
  for (const vi of ordem) {
    const v = V[vi];
    const fase = A.fase ? A.fase[atual] : 0;
    const n = dividirAresta(G, atual, clamp(v.t / uFim, 1e-6, 1 - 1e-6));
    if (n < 0) return null;
    let h1 = -1;
    let h2 = -1;
    for (const x of arestasDoNo(G, n)) {
      if (A.b[x] === n) h1 = x;
      else if (A.a[x] === n) h2 = x;
    }
    N.y[n] = v.y;
    N.marcar(n);
    A.y[2 * h1 + 1] = v.y;
    A.y[2 * h2] = v.y;
    if (A.fase) {
      A.fase[h1] = fase;
      A.fase[h2] = mod8(fase - A.arco[17 * h1 + 16]);
    }
    if (A.nomeVia) {
      A.nomeVia[h1] = foto.nome;
      A.nomeVia[h2] = foto.nome;
    }
    A.marcar(h1);
    A.marcar(h2);
    v.no = n;
    pecas.unshift(h2);
    atual = h1;
    uFim = v.t;
  }
  pecas.unshift(atual);
  // as formas das metades saem depois, com o grafo pronto (o patamar do nó novo depende das vias que chegam nele)
  return { original: foto, pecas: pecas.map((x) => refDe(x, A.ger[x])), idx: pecas };
}

/**
 * Fase das células de um traço novo: saindo de uma via (nó ou ponto sobre ela), as colunas começam a meia largura dela
 * mais 8 m x k do eixo, alinhadas com as linhas dela; saindo do nada, as colunas se alinham com as linhas da primeira via
 * que o traço cruza (centro a meia largura dela + 4 m + 8 m x linha), para a esquina fechar sem vão.
 */
function faseDoTraco(plano, tr) {
  const v = plano.vertices[tr.va];
  if (v.ancora) return mod8(v.meia ?? 0);
  if (!tr.cortes?.length) return 0;
  const c = tr.cortes[0];
  return mod8(arcoDoT(tabelaArco(tr.p), c.t) + c.meia);
}

/** Fase e nome herdados da via que o traço continua em linha reta a partir de um nó que já existe. */
function herancaNoInicio(sim, plano, tr, pc0) {
  const A = sim.tabelas.arestas;
  const v = plano.vertices[tr.va];
  if (v.no < 0 || !pc0) return null;
  const d = saidaDaPeca(pc0, tr.va);
  const tipoNovo = tipoVia(plano.ti);
  for (const e of arestasDoNo(sim.grafo, v.no)) {
    if (plano.criadas?.includes(e)) continue;
    const s = saidaDoNo(sim, e, v.no, [0, 0]);
    if (-(s[0] * d[0] + s[1] * d[1]) < COS_15) continue;
    const t = tipoVia(A.tipo[e]);
    if (!t.zona || !tipoNovo.zona) return { nome: A.nomeVia ? A.nomeVia[e] : 0, fase: 0 };
    // as colunas da via continuada seguem no mesmo passo de 8 m depois do nó
    const comp = A.arco[17 * e + 16];
    const f = A.fase ? A.fase[e] : 0;
    const atras = mod8(A.b[e] === v.no ? comp - f : f);
    return { nome: A.nomeVia ? A.nomeVia[e] : 0, fase: mod8(-atras) };
  }
  return null;
}

/**
 * Aplica um plano sem erros: demolições, divisões, nós e arestas novas, formas, nomes e blocos; guarda a ação para
 * desfazer. Devolve a resposta do comando.
 */
export function aplicar(sim, plano) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  const V = plano.vertices;
  const pago = livre(sim) ? 0 : plano.custo;
  if (pago > 0 && !sim.holding.pagar(pago, 'vias')) return { ok: false, codigo: 'creditos' };
  // prédios na pista
  const P = sim.tabelas.predios;
  let cx = [Infinity, Infinity, -Infinity, -Infinity];
  const juntarCaixa = (k) => {
    cx = [Math.min(cx[0], k[0]), Math.min(cx[1], k[1]), Math.max(cx[2], k[2]), Math.max(cx[3], k[3])];
  };
  const demolidos = [];
  for (const i of plano.demolir) {
    if (!P.viva[i]) continue;
    const r = (P.w[i] + P.d[i]) / 2;
    juntarCaixa([P.x[i] - r, P.z[i] - r, P.x[i] + r, P.z[i] + r]);
    demolidos.push(removerPredio(sim, i));
  }
  // divisões (as células das arestas divididas saem antes e a pintura volta nas metades)
  const porAresta = new Map();
  V.forEach((v, vi) => {
    if (v.e < 0) return;
    const l = porAresta.get(v.e);
    if (l) l.push(vi);
    else porAresta.set(v.e, [vi]);
  });
  const divididas = [...porAresta.keys()].sort((a, b) => a - b);
  juntarCaixa(caixaDasArestas(sim, divididas));
  const pool = recolherCelulas(sim, divididas);
  const divisoes = [];
  const metades = [];
  for (const e of divididas) {
    const d = dividirNosVertices(sim, plano, e, porAresta.get(e));
    if (!d) continue;
    divisoes.push({ original: d.original, pecas: d.pecas });
    metades.push(...d.idx);
  }
  // nós novos (pontos livres, portões e nós de greide)
  for (const v of V) if (v.no < 0) v.no = addNo(G, v.x, v.z, v.y);
  // arestas novas
  const criadas = [];
  plano.criadas = criadas;
  const porTraco = new Map();
  const mao = VIAS[VIAS_ORDEM[plano.ti]].mao === 'unica' ? MAO.AB : MAO.DUPLA;
  for (const pc of plano.pecas) {
    const e = addAresta(G, V[pc.va].no, V[pc.vb].no, plano.ti, [pc.p[2], pc.p[3]], [pc.p[4], pc.p[5]], { mao, flags: pc.ponte ? ARESTA.PONTE : 0 });
    if (e < 0) continue;
    criadas.push(e);
    pc.e = e;
    const l = porTraco.get(pc.traco);
    if (l) l.push(pc);
    else porTraco.set(pc.traco, [pc]);
  }
  // fase contínua pelo traço, nomes por linha (herdados da via continuada) e formas
  const nomePorLinha = new Map();
  for (const tr of plano.tracos) {
    const pcs = (porTraco.get(tr.id) ?? []).filter((pc) => pc.e >= 0);
    if (!pcs.length) continue;
    const h = herancaNoInicio(sim, plano, tr, pcs[0]);
    const fase0 = h?.fase ?? faseDoTraco(plano, tr);
    for (const pc of pcs) {
      if (A.fase) A.fase[pc.e] = mod8(fase0 - pc.s0);
    }
    let nome = nomePorLinha.get(tr.linha) ?? h?.nome ?? 0;
    nome = nomearTraco(sim, pcs.map((pc) => pc.e), nome);
    nomePorLinha.set(tr.linha, nome);
    for (const pc of pcs) registrarForma(sim, pc.e);
  }
  // os nós do plano mudaram de raio e de ângulos: os patamares das vias ligadas a eles mudam (as metades das divididas
  // ganham a forma aqui)
  const tocados = new Set();
  for (const v of V) if (v.no >= 0) tocados.add(v.no);
  for (const e of [...criadas, ...metades]) {
    tocados.add(A.a[e]);
    tocados.add(A.b[e]);
  }
  reformarNos(sim, tocados, new Set(criadas));
  juntarCaixa(caixaDasArestas(sim, [...criadas, ...metades]));
  const r = refazerBlocos(sim, { gerar: [...metades, ...criadas], registros: pool.registros, predios: pool.predios, caixa: cx, modo: 'demolir' });
  const todosDemolidos = [...demolidos, ...r.demolidos];
  const refs = criadas.map((e) => refDe(e, A.ger[e]));
  registrarAcao(sim, plano.sessao, { tipo: 'construir', custo: pago, arestas: refs, divisoes, predios: todosDemolidos });
  sim.emitir('construido', { tipo: 'via', refs });
  if (todosDemolidos.length) sim.emitir('demolido', { tipo: 'predio', refs: todosDemolidos.map((x) => x.ref) });
  return { ok: true, id: refs[0], dados: { arestas: refs, custo: pago, demolidos: todosDemolidos.length } };
}

function construir(sim, { plano } = {}) {
  const { saida, interno } = planejar(sim, plano);
  if (!interno || !saida.ok) return { ok: false, codigo: saida.erros[0]?.codigo ?? 'valor', dados: { erros: saida.erros } };
  if (!interno.pecas.length) return { ok: false, codigo: 'curto' };
  return aplicar(sim, interno);
}

// ------------------------------------------------------------------------------------------------ melhorar

function planejarMelhoria(sim, args) {
  const A = sim.tabelas.arestas;
  const P = sim.tabelas.predios;
  const novo = VIAS[args.tipo];
  const ti = VIAS_ORDEM.indexOf(args.tipo);
  const erros = [];
  const lista = [];
  const itens = [];
  const demolir = new Set();
  let custoVia = 0;
  let comprimento = 0;
  const segmentos = [];
  if (!args.arestas.length) erros.push({ codigo: 'valor', trecho: -1 });
  for (const ref of args.arestas) {
    const e = A.idxVivo(ref);
    const er = [];
    if (e < 0) {
      itens.push({ ref, ok: false, erros: ['inexistente'] });
      erros.push({ codigo: 'inexistente', trecho: itens.length - 1 });
      continue;
    }
    if (lista.includes(e)) continue;
    const velho = tipoVia(A.tipo[e]);
    if (A.flags[e] & ARESTA.ARCOLOGIA) er.push('arcologia');
    else if (A.flags[e] & (ARESTA.RODOVIA | ARESTA.PONTE)) er.push('rodovia');
    else if (!velho.melhoraPara?.includes(args.tipo)) er.push('valor');
    if (decliveDa(sim, e) > novo.declive + 1e-6) er.push('declive');
    const comp = A.arco[17 * e + 16];
    const g = decliveDa(sim, e);
    const a = amostrarCurva(A.p.subarray(8 * e, 8 * e + 8));
    const meia = novo.largura / 2;
    if (novo.largura > velho.largura) {
      // a pista mais larga não pode cobrir outra via fora dos nós dela, nem prédio que não seja da cidade
      const excl = new Map();
      for (const n of [A.a[e], A.b[e]]) {
        for (const o of arestasDoNo(sim.grafo, n)) {
          if (o === e) continue;
          const r = (meia + tipoVia(A.tipo[o]).largura / 2) * 2 + 2;
          const l = excl.get(o);
          if (l) l.push([sim.tabelas.nos.x[n], sim.tabelas.nos.z[n], r]);
          else excl.set(o, [[sim.tabelas.nos.x[n], sim.tabelas.nos.z[n], r]]);
        }
      }
      if (viasSobrepostas(sim, a, meia, excl, e).length) er.push('colisao');
      for (const i of prediosNaPista(sim, a, meia)) {
        if (predioDaCidade(sim, i)) demolir.add(i);
        else er.push('colisao');
      }
    }
    lista.push(e);
    comprimento += comp;
    custoVia += comp * Math.max(0, (novo.custoM ?? 0) - (velho.custoM ?? 0)) * (1 + 2 * g);
    itens.push({ ref, ok: !er.length, erros: er });
    for (const c of er) erros.push({ codigo: c, trecho: itens.length - 1 });
    segmentos.push({ p: Array.from(A.p.subarray(8 * e, 8 * e + 8)), tipo: args.tipo, cotas: [A.y[2 * e], A.y[2 * e + 1]], ponte: false, erros: er, declive: g });
  }
  if (!viaLiberada(sim, args.tipo)) erros.push({ codigo: 'marco', trecho: -1 });
  let custoDemolir = 0;
  for (const i of demolir) custoDemolir += custoDemolirPredio(sim, i);
  const custo = Math.round(custoVia + custoDemolir);
  const cx = caixa(sim);
  if (!livre(sim) && custo > cx) erros.push({ codigo: 'creditos', trecho: -1, dados: { faltam: Math.ceil(custo - cx) } });
  const saida = {
    ...vazia(erros),
    ok: erros.length === 0,
    arestas: itens,
    segmentos,
    demolir: { predios: [...demolir].sort((a, b) => a - b).map((i) => refDe(i, P.ger[i])), custo: Math.round(custoDemolir) },
    comprimento: Math.round(comprimento * 10) / 10,
    custo,
    manutencaoHora: Math.round((comprimento / 1000) * (novo.manutKmH ?? 0) * 10) / 10,
  };
  return { saida, interno: { melhorar: true, arestas: lista, ti, mao: args.mao, demolir: [...demolir].sort((a, b) => a - b), custo, sessao: args.sessao } };
}

function melhorar(sim, args) {
  const r = lerArgs({ ...args, modo: 'melhorar' });
  if (!r) return { ok: false, codigo: 'valor' };
  const { saida, interno } = planejarMelhoria(sim, r);
  if (!saida.ok) return { ok: false, codigo: saida.erros[0]?.codigo ?? 'valor', dados: { erros: saida.erros } };
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  const P = sim.tabelas.predios;
  const pago = livre(sim) ? 0 : interno.custo;
  if (pago > 0 && !sim.holding.pagar(pago, 'vias')) return { ok: false, codigo: 'creditos' };
  let cx = caixaDasArestas(sim, interno.arestas);
  const demolidos = [];
  for (const i of interno.demolir) {
    if (!P.viva[i]) continue;
    const q = (P.w[i] + P.d[i]) / 2;
    cx = [Math.min(cx[0], P.x[i] - q), Math.min(cx[1], P.z[i] - q), Math.max(cx[2], P.x[i] + q), Math.max(cx[3], P.z[i] + q)];
    demolidos.push(removerPredio(sim, i));
  }
  const antes = interno.arestas.map((e) => ({ ref: refDe(e, A.ger[e]), tipo: A.tipo[e], mao: A.mao[e] }));
  const pool = recolherCelulas(sim, interno.arestas);
  const nos = new Set();
  const unica = VIAS[VIAS_ORDEM[interno.ti]].mao === 'unica';
  for (const e of interno.arestas) {
    tirarForma(sim, refDe(e, A.ger[e]));
    A.tipo[e] = interno.ti;
    A.mao[e] = unica ? interno.mao : MAO.DUPLA;
    const c = caixaBz(A.p, 8 * e, meiaDa(G, e));
    G.gradeArestas.inserir(e, c[0], c[1], c[2], c[3]);
    A.marcar(e);
    nos.add(A.a[e]);
    nos.add(A.b[e]);
  }
  for (const n of nos) cortes(G, n);
  G.versao++;
  // as formas saem com os raios novos (a largura mudou o raio dos nós e os patamares das vizinhas)
  reformarNos(sim, nos);
  const k = caixaDasArestas(sim, interno.arestas);
  cx = [Math.min(cx[0], k[0]), Math.min(cx[1], k[1]), Math.max(cx[2], k[2]), Math.max(cx[3], k[3])];
  const rb = refazerBlocos(sim, { gerar: interno.arestas, registros: pool.registros, predios: pool.predios, caixa: cx, modo: 'demolir' });
  const todos = [...demolidos, ...rb.demolidos];
  registrarAcao(sim, r.sessao, { tipo: 'melhorar', arestas: antes, custo: pago, predios: todos, ocupantes: prediosNasCelulas(sim, interno.arestas) });
  sim.emitir('construido', { tipo: 'via', refs: antes.map((x) => x.ref) });
  if (todos.length) sim.emitir('demolido', { tipo: 'predio', refs: todos.map((x) => x.ref) });
  return { ok: true, dados: { custo: pago, arestas: antes.map((x) => x.ref) } };
}

// ------------------------------------------------------------------------------------------------ prévia da demolição

function planejarDemolicao(sim, args) {
  const A = sim.tabelas.arestas;
  const erros = [];
  let devolve = 0;
  let comprimento = 0;
  const segmentos = [];
  const itens = [];
  const vistas = new Set();
  for (const ref of args.arestas) {
    const e = A.idxVivo(ref);
    let c = null;
    if (e < 0) c = 'inexistente';
    else if (A.flags[e] & ARESTA.ARCOLOGIA) c = 'arcologia';
    else if (A.flags[e] & ARESTA.RODOVIA) c = 'rodovia';
    itens.push({ ref, ok: !c, erros: c ? [c] : [] });
    if (c) {
      erros.push({ codigo: c, trecho: itens.length - 1 });
      continue;
    }
    // ponte ou viaduto do jogador cai inteiro: as peças encadeadas entram na conta (D106)
    for (const x of estruturaDaPonte(sim, e)) {
      if (vistas.has(x)) continue;
      vistas.add(x);
      devolve += devolucaoAresta(sim, x, args.sessao);
      comprimento += A.arco[17 * x + 16];
      segmentos.push({ p: Array.from(A.p.subarray(8 * x, 8 * x + 8)), tipo: VIAS_ORDEM[A.tipo[x]], cotas: [A.y[2 * x], A.y[2 * x + 1]], ponte: !!(A.flags[x] & ARESTA.PONTE), erros: [], declive: decliveDa(sim, x) });
    }
  }
  if (!args.arestas.length) erros.push({ codigo: 'valor', trecho: -1 });
  return {
    saida: { ...vazia(erros), ok: !erros.length, arestas: itens, segmentos, comprimento: Math.round(comprimento * 10) / 10, custo: -devolve, devolve },
    interno: null,
  };
}

// ------------------------------------------------------------------------------------------------ consultas

/** q.aresta(ref): tipo, nome, comprimento, declive, mão, fluxo (M1b) e manutenção por hora. */
function consultaAresta(sim, ref) {
  const A = sim.tabelas.arestas;
  const e = A.idxVivo(ref);
  if (e < 0) return null;
  const F = sim.espelho.fluxos;
  return {
    ref,
    tipo: VIAS_ORDEM[A.tipo[e]],
    nome: nomeDaAresta(sim, e),
    comprimento: Math.round(A.arco[17 * e + 16] * 10) / 10,
    declive: Math.round(decliveDa(sim, e) * 1000) / 1000,
    mao: A.mao[e],
    ponte: !!(A.flags[e] & ARESTA.PONTE),
    rodovia: !!(A.flags[e] & ARESTA.RODOVIA),
    arcologia: !!(A.flags[e] & ARESTA.ARCOLOGIA),
    fluxo: F?.ida ? { ida: F.ida[e] ?? 0, volta: F.volta?.[e] ?? 0, vel: F.vel?.[e] ?? 1 } : null,
    manutencaoHora: Math.round(manutencaoAresta(sim, e) * 10) / 10,
    devolve: devolucaoAresta(sim, e, sim.json.vias?.sessao),
    melhoraPara: [...(tipoVia(A.tipo[e]).melhoraPara ?? [])],
  };
}

/** q.viasPerto(x, z, raio): arestas com o eixo até `raio` de (x, z), da mais perto: [{ ref, t, d, meia }]. */
function viasPerto(sim, x, z, raio = 40) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  if (!numero(x) || !numero(z)) return [];
  const r = clamp(numero(raio) ? raio : 40, 0, 2000);
  const ids = G.gradeArestas.consultar(x - r, z - r, x + r, z + r);
  const out = [];
  const q = { d: 0, s: 0 };
  for (let k = 0; k < ids.length; k++) {
    const e = ids[k];
    if (!A.viva[e]) continue;
    const c = eixoDa(sim, e);
    distEixo(c, x, z, q, r);
    if (!(q.d <= r)) continue;
    out.push({ ref: refDe(e, A.ger[e]), t: tDoArco(A.arco.subarray(17 * e, 17 * e + 17), q.s), d: Math.round(q.d * 100) / 100, meia: tipoVia(A.tipo[e]).largura / 2 });
  }
  return out.sort((a, b) => a.d - b.d || a.ref - b.ref);
}

// ------------------------------------------------------------------------------------------------ manutenção

function manutencaoTotal(sim) {
  const G = sim.grafo;
  const A = sim.tabelas.arestas;
  const d = MANUT.get(sim);
  if (d && d.versao === G.versao && d.n === A.n) return d.valor;
  let s = 0;
  for (let e = 0; e < A.n; e++) if (A.viva[e]) s += manutencaoAresta(sim, e);
  MANUT.set(sim, { versao: G.versao, n: A.n, valor: s });
  return s;
}
const MANUT = new WeakMap();

// ------------------------------------------------------------------------------------------------ registro

export function registrar(sim) {
  if (!sim.grafo) return;
  if (!sim.json.vias) sim.registrarJson('vias', { sessao: null, acoes: [], nome: 0 });
  sim.registrarConsulta('via.previa', (s, args) => planejar(s, args).saida);
  sim.registrarConsulta('aresta', consultaAresta);
  sim.registrarConsulta('viasPerto', viasPerto);
  sim.registrarComando('via.construir', construir);
  sim.registrarComando('via.melhorar', melhorar);
  sim.custos.registrar('vias', manutencaoTotal);
}

