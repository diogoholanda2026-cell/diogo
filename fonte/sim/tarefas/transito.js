// Tarefa pura de atribuição do trânsito agregado (D15, D37; dona: S1c). Roda no worker `tarefas` e no Node com a mesma
// entrada copiada e dá a mesma saída, bit a bit: só aritmética de IEEE e o exp determinístico de comum/util.js, sem
// relógio, sem sorteio e sem ler o estado da simulação.
//
// Modelo (seção 9.2 do desenho da simulação):
//  - zonas de tráfego: grupos de nós da rede (a thread principal junta os nós por células de 256 m, ou de 512 m acima de
//    150 zonas ativas); cada nó leva a produção (prod) e a atração (atr) de viagens por hora de pico dos prédios que
//    têm acesso por ele;
//  - gravidade: T[i][j] = P[i] x A[j] x f(c[i][j]) / soma dos A[k] x f(c[i][k]), com f(c) = exp(-0,08 c) e c em minutos
//    de viagem com o congestionamento (a viagem dentro da zona custa `intra`, sem carregar a rede);
//  - atribuição incremental em 3 passadas (50%, 30% e 20% das viagens): a cada passada o tempo de cada ligação vira
//    t = t0 x (1 + 0,15 x (v/c)^4), com v extrapolado da carga já atribuída (e, na primeira, da passada anterior, que
//    vem em `anterior`); cada zona de origem roda um Dijkstra de várias fontes (todos os nós dela) e o fluxo sobe pela
//    árvore a partir dos destinos (O(nós) por origem). A matriz T sai da primeira passada e fica a mesma nas outras.
//
// Entrada (tudo copiado pela fila de tarefas):
//   grafo     { n, ini: Int32Array(n+1), de: Int32Array(m) (nó de saída), dest: Int32Array(m), ar: Int32Array(m) (2 x aresta +
//               sentido), t0: Float32Array(m) (minutos livres), cap: Float32Array(m) (veículos por hora) }   ligações por
//               sentido permitido (CSR)
//   nArestas  tamanho do vetor de fluxo por aresta
//   Z         número de zonas;  noZona: Int16Array(n) (zona do nó, -1 sem zona)
//   prod, atr, atrCom: Float32Array(n)   viagens por hora de pico que saem, chegam e chegam ao comércio, por nó
//   anterior  Float32Array(2 x nArestas) fluxo da atribuição anterior (a primeira passada parte dele)
// Saída:
//   fluxo     Float32Array(2 x nArestas): veículos por hora de pico, 2 x aresta + sentido (0: a para b, 1: b para a)
//   tSaida    Float32Array(Z): tempo médio, em minutos, das viagens que saem da zona; tDestino: das que chegam
//   viagens   viagens por hora de pico atribuídas entre zonas diferentes;  tempoMedio, tempoCom: minutos médios de todas
//             as viagens e das que chegam ao comércio;  semRota: viagens que não acharam caminho
import { exp } from '../../comum/util.js';

/** Constantes do modelo (calibrar). */
export const MODELO = Object.freeze({
  passadas: Object.freeze([0.5, 0.3, 0.2]),
  bprA: 0.15, // t = t0 x (1 + a x (v/c)^b)
  beta: 0.08, // f(c) = exp(-beta x c), c em minutos
  terminal: 2, // minutos de acesso e de estacionamento somados a toda viagem
  intra: 0.5, // minutos da viagem dentro da própria zona (somados ao terminal)
  limite: 90, // a busca para aos 90 minutos (f já vale 0,07%)
  fatorMax: 10, // o tempo de uma ligação nunca passa de 10 vezes o livre
});

// f(c) em passos de 0,1 minuto; entre dois passos, interpolação linear (só multiplicação e soma)
const PASSO_F = 0.1;
const TAB_F = (() => {
  const n = Math.ceil(MODELO.limite / PASSO_F) + 3;
  const t = new Float64Array(n);
  for (let k = 0; k < n; k++) t[k] = exp(-MODELO.beta * k * PASSO_F);
  return t;
})();

function gravidade(c) {
  const x = c / PASSO_F;
  const k = Math.floor(x);
  if (k + 1 >= TAB_F.length) return 0;
  const f = x - k;
  return TAB_F[k] + (TAB_F[k + 1] - TAB_F[k]) * f;
}

/**
 * Atribuição em 3 passadas. Gerador: cede (yield) a cada zona de origem, para a thread principal refazer em fatias se
 * o worker morrer; no worker e no Node roda até o fim.
 * @example const saida = executarAteOFim(atribuir, entrada)
 */
export function* atribuir(e) {
  const G = e.grafo;
  const n = G.n;
  const m = G.dest.length;
  const Z = e.Z;
  const nE = e.nArestas;
  const { ini, dest, ar, t0, cap } = G;
  const { noZona, prod, atr, atrCom } = e;
  const saida = {
    fluxo: new Float32Array(2 * nE),
    tSaida: new Float32Array(Z),
    tDestino: new Float32Array(Z),
    viagens: 0,
    tempoMedio: 0,
    tempoCom: 0,
    semRota: 0,
  };
  if (Z === 0 || m === 0) return saida;

  // nós de cada zona (em ordem de nó) e totais por zona
  const zIni = new Int32Array(Z + 1);
  for (let v = 0; v < n; v++) if (noZona[v] >= 0) zIni[noZona[v] + 1]++;
  for (let z = 0; z < Z; z++) zIni[z + 1] += zIni[z];
  const zNo = new Int32Array(zIni[Z]);
  const pos = zIni.slice(0, Z);
  for (let v = 0; v < n; v++) if (noZona[v] >= 0) zNo[pos[noZona[v]]++] = v;
  const P = new Float64Array(Z);
  const A = new Float64Array(Z);
  const AC = new Float64Array(Z);
  for (let v = 0; v < n; v++) {
    const z = noZona[v];
    if (z < 0) continue;
    P[z] += prod[v];
    A[z] += atr[v];
    AC[z] += atrCom[v];
  }

  // Dijkstra de várias fontes com heap binário em arrays tipados (as chaves repetidas ficam na ordem do heap)
  const dist = new Float64Array(n);
  const pred = new Int32Array(n);
  const ord = new Int32Array(n);
  const hv = new Int32Array(m + n + 8);
  const hk = new Float64Array(m + n + 8);
  let hn = 0;
  let nOrd = 0;
  const empurrar = (v, k) => {
    let i = hn++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hk[p] <= k) break;
      hv[i] = hv[p];
      hk[i] = hk[p];
      i = p;
    }
    hv[i] = v;
    hk[i] = k;
  };
  let chaveTopo = 0;
  const retirar = () => {
    const topo = hv[0];
    chaveTopo = hk[0];
    const nn = --hn;
    if (nn > 0) {
      const lv = hv[nn];
      const lk = hk[nn];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= nn) break;
        if (c + 1 < nn && hk[c + 1] < hk[c]) c++;
        if (hk[c] >= lk) break;
        hv[i] = hv[c];
        hk[i] = hk[c];
        i = c;
      }
      hv[i] = lv;
      hk[i] = lk;
    }
    return topo;
  };
  const arvore = (z, tm) => {
    dist.fill(Infinity);
    pred.fill(-1);
    hn = 0;
    nOrd = 0;
    for (let k = zIni[z]; k < zIni[z + 1]; k++) {
      const v = zNo[k];
      dist[v] = 0;
      empurrar(v, 0);
    }
    while (hn > 0) {
      const u = retirar();
      const d = chaveTopo;
      if (d > dist[u]) continue;
      if (d > MODELO.limite) break;
      ord[nOrd++] = u;
      for (let k = ini[u]; k < ini[u + 1]; k++) {
        const v = dest[k];
        const nd = d + tm[k];
        if (nd < dist[v]) {
          dist[v] = nd;
          pred[v] = k;
          empurrar(v, nd);
        }
      }
    }
  };

  // tempo de cada ligação com o fluxo `fl` (por 2 x aresta + sentido) dividido por `esc`
  const tm = new Float64Array(m);
  const tempos = (fl, esc) => {
    const a = MODELO.bprA;
    const maximo = MODELO.fatorMax;
    for (let k = 0; k < m; k++) {
      const c = cap[k];
      const x = c > 0 ? fl[ar[k]] / esc / c : 0;
      const x2 = x * x;
      let f = 1 + a * (x2 * x2);
      if (f > maximo) f = maximo;
      tm[k] = t0[k] * f;
    }
  };

  // árvores guardadas (ordem de saída e ligação de chegada) para reaproveitar quando continuam as mais curtas
  const guardaOrd = new Array(Z).fill(null);
  const guardaPred = new Array(Z).fill(null);
  const guardaN = new Int32Array(Z);

  const T = new Float64Array(Z * Z);
  const cmat = new Float64Array(Z * Z);
  const acum = new Float64Array(2 * nE);
  const dem = new Float64Array(n);
  const cvec = new Float64Array(Z);
  const wvec = new Float64Array(Z);
  const ant = new Float64Array(2 * nE);
  for (let k = 0; k < ant.length; k++) ant[k] = e.anterior[k] ?? 0;

  let feito = 0; // fração das viagens já atribuída
  const passadas = MODELO.passadas;
  const intra = MODELO.terminal + MODELO.intra;
  for (let p = 0; p < passadas.length; p++) {
    const parte = passadas[p];
    if (p === 0) tempos(ant, 1);
    else tempos(acum, feito);
    const ultima = p === passadas.length - 1;
    for (let i = 0; i < Z; i++) {
      if (P[i] <= 0) continue;
      // a árvore da passada anterior continua valendo se, com os tempos novos, nenhuma ligação melhora o tempo de
      // ninguém (condição de otimalidade): o resultado é o do Dijkstra, sem rodá-lo
      let reutil = false;
      if (p > 0 && guardaOrd[i]) {
        const o = guardaOrd[i];
        const pr = guardaPred[i];
        const no = guardaN[i];
        dist.fill(Infinity);
        for (let k = zIni[i]; k < zIni[i + 1]; k++) dist[zNo[k]] = 0;
        for (let q = 0; q < no; q++) {
          const v = o[q];
          const k = pr[v];
          if (k >= 0) dist[v] = dist[G.de[k]] + tm[k];
        }
        reutil = true;
        for (let k = 0; k < m; k++) {
          const du = dist[G.de[k]];
          if (du === Infinity) continue;
          const nd = du + tm[k];
          if (nd <= MODELO.limite && nd < dist[dest[k]] - 1e-9) {
            reutil = false;
            break;
          }
        }
        if (reutil) {
          nOrd = no;
          ord.set(o);
          pred.set(pr);
        }
      }
      if (!reutil) {
        arvore(i, tm);
        if (p < passadas.length - 1) {
          guardaOrd[i] = ord.slice(0, nOrd);
          guardaPred[i] = pred.slice();
          guardaN[i] = nOrd;
        }
      }
      // tempo até cada zona de destino: média dos nós alcançados, pesada pela atração
      for (let j = 0; j < Z; j++) {
        let w = 0;
        let s = 0;
        for (let k = zIni[j]; k < zIni[j + 1]; k++) {
          const v = zNo[k];
          const d = dist[v];
          if (d > MODELO.limite) continue; // além do limite (ou sem caminho): fora
          const a = atr[v];
          w += a;
          s += a * d;
        }
        wvec[j] = w;
        cvec[j] = w > 0 ? s / w + MODELO.terminal : (A[j] > 0 ? Infinity : MODELO.terminal);
      }
      if (p === 0) {
        // gravidade: as viagens de i se repartem entre os destinos por atração e custo
        let den = 0;
        for (let j = 0; j < Z; j++) {
          if (A[j] <= 0) continue;
          const c = j === i ? intra : cvec[j];
          if (c === Infinity) continue;
          den += A[j] * gravidade(c);
        }
        for (let j = 0; j < Z; j++) {
          if (A[j] <= 0) continue;
          const c = j === i ? intra : cvec[j];
          if (c === Infinity) continue;
          T[i * Z + j] = den > 0 ? (P[i] * A[j] * gravidade(c)) / den : 0;
        }
        let perdidas = P[i];
        for (let j = 0; j < Z; j++) perdidas -= T[i * Z + j];
        if (perdidas > 1e-9) saida.semRota += perdidas;
      }
      // carga na árvore: a demanda de cada destino sobe até a origem
      dem.fill(0);
      let carrega = false;
      for (let j = 0; j < Z; j++) {
        if (j === i) continue;
        const t = T[i * Z + j];
        if (!(t > 0) || !(wvec[j] > 0)) continue;
        const q = (parte * t) / wvec[j];
        for (let k = zIni[j]; k < zIni[j + 1]; k++) {
          const v = zNo[k];
          if (dist[v] <= MODELO.limite) dem[v] += q * atr[v];
        }
        carrega = true;
      }
      if (carrega) {
        for (let q = nOrd - 1; q >= 0; q--) {
          const v = ord[q];
          const d = dem[v];
          if (d === 0) continue;
          const k = pred[v];
          if (k < 0) continue;
          acum[ar[k]] += d;
          dem[G.de[k]] += d;
        }
      }
      if (ultima) for (let j = 0; j < Z; j++) cmat[i * Z + j] = j === i ? intra : cvec[j];
      yield;
    }
    feito += parte;
  }

  // estatísticas do tempo de viagem (com o congestionamento da última passada)
  let somaT = 0;
  let somaTC = 0;
  let viagens = 0;
  let comT = 0;
  let comW = 0;
  const entrada = new Float64Array(Z);
  const entradaT = new Float64Array(Z);
  for (let i = 0; i < Z; i++) {
    let s = 0;
    let w = 0;
    for (let j = 0; j < Z; j++) {
      const t = T[i * Z + j];
      if (!(t > 0)) continue;
      const c = cmat[i * Z + j];
      if (c === Infinity) continue;
      s += t * c;
      w += t;
      entrada[j] += t;
      entradaT[j] += t * c;
      if (j !== i) viagens += t;
    }
    saida.tSaida[i] = w > 0 ? s / w : 0;
    somaT += w;
    somaTC += s;
  }
  for (let j = 0; j < Z; j++) {
    saida.tDestino[j] = entrada[j] > 0 ? entradaT[j] / entrada[j] : 0;
    if (AC[j] > 0 && entrada[j] > 0) {
      comT += AC[j] * saida.tDestino[j];
      comW += AC[j];
    }
  }
  saida.viagens = viagens;
  saida.tempoMedio = somaT > 0 ? somaTC / somaT : 0;
  saida.tempoCom = comW > 0 ? comT / comW : saida.tempoMedio;
  for (let k = 0; k < acum.length; k++) saida.fluxo[k] = acum[k];
  return saida;
}

export function registrar(sim) {
  sim.tarefas.registrar('transito', { K: 60, fn: atribuir });
}
