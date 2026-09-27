// Caminhos mínimos num grafo em forma compacta (CSR): Dijkstra de várias origens fatiado por trabalho e A*.
// O orçamento é contado em nós retirados da fila, nunca em tempo, para dar o mesmo resultado no Node e no navegador
// (seção 2.2). O grafo das vias vira CSR por vias/grafo.js (adjacencia).
import { HeapMin } from './heap.js';
import { hipot } from './util.js';

/** Nós retirados da fila por tique nas buscas grandes (cobertura de serviços, racionamento). */
export const ORCAMENTO_NOS = 4000;

/**
 * @typedef {object} GrafoCSR
 * @property {number} n                 número de vértices
 * @property {Int32Array} ini           n + 1 inícios: as ligações do vértice v estão em [ini[v], ini[v + 1])
 * @property {Int32Array} dest          vértice de chegada de cada ligação
 * @property {Int32Array} de            vértice de saída de cada ligação
 * @property {Float64Array} peso        custo de cada ligação (não negativo)
 * @property {Int32Array} [ref]         referência de cada ligação (aresta; ~idx para o sentido b para a)
 */

/**
 * Monta o CSR a partir de listas soltas de ligações (ordem estável: por origem, depois pela ordem de entrada).
 * @example montarCSR(3, [0, 1], [1, 2], [5, 7]) // 0 -> 1 custa 5; 1 -> 2 custa 7
 */
export function montarCSR(n, de, para, peso, ref = null) {
  const m = de.length;
  const ini = new Int32Array(n + 1);
  for (let i = 0; i < m; i++) ini[de[i] + 1]++;
  for (let v = 0; v < n; v++) ini[v + 1] += ini[v];
  const pos = ini.slice(0, n);
  const dest = new Int32Array(m);
  const orig = new Int32Array(m);
  const w = new Float64Array(m);
  const r = ref ? new Int32Array(m) : null;
  for (let i = 0; i < m; i++) {
    const k = pos[de[i]]++;
    dest[k] = para[i];
    orig[k] = de[i];
    w[k] = peso[i];
    if (r) r[k] = ref[i];
  }
  return { n, ini, dest, de: orig, peso: w, ref: r };
}

/**
 * Dijkstra de várias origens que anda em fatias: iniciar() e depois passo(orcamento) a cada tique até terminar.
 * dist[v] é o custo, origem[v] o rótulo da fonte que chegou primeiro e ant[v] a ligação usada para chegar.
 * @example
 * const d = new Dijkstra(g); d.iniciar([0, 9], { limite: 1500 });
 * while (!d.passo(ORCAMENTO_NOS)) {} // num sistema: um passo por tique
 */
export class Dijkstra {
  constructor(g) {
    this.g = g;
    this.dist = new Float64Array(g.n).fill(Infinity);
    this.origem = new Int32Array(g.n).fill(-1);
    this.ant = new Int32Array(g.n).fill(-1);
    this.heap = new HeapMin(Math.max(16, g.n));
    this.limite = Infinity;
    this.retirados = 0;
    this.terminado = true;
  }

  /**
   * Começa uma busca. fontes: lista de vértices; rotulos (opcional): rótulo de cada fonte (padrão: o índice na lista);
   * custos (opcional): custo inicial de cada fonte. Com manter = true a busca parte do resultado anterior e só melhora
   * (atualização incremental de um serviço novo, seção 2.2).
   */
  iniciar(fontes, { limite = Infinity, manter = false, rotulos = null, custos = null } = {}) {
    if (!manter) {
      this.dist.fill(Infinity);
      this.origem.fill(-1);
      this.ant.fill(-1);
    }
    this.heap.limpar();
    this.limite = limite;
    this.retirados = 0;
    for (let i = 0; i < fontes.length; i++) {
      const s = fontes[i];
      const c = custos ? custos[i] : 0;
      if (c < this.dist[s]) {
        this.dist[s] = c;
        this.origem[s] = rotulos ? rotulos[i] : i;
        this.ant[s] = -1;
        this.heap.push(s, c);
      }
    }
    this.terminado = this.heap.vazio;
    return this;
  }

  /** Anda até `orcamento` retiradas; devolve true quando a busca terminou. */
  passo(orcamento = Infinity) {
    if (this.terminado) return true;
    const { ini, dest, peso } = this.g;
    const dist = this.dist;
    const orig = this.origem;
    const ant = this.ant;
    const h = this.heap;
    let feitos = 0;
    while (!h.vazio && feitos < orcamento) {
      const u = h.pop();
      const d = h.ultimaChave;
      if (d > dist[u]) continue; // entrada velha
      if (d > this.limite) {
        h.limpar();
        break;
      }
      feitos++;
      for (let k = ini[u]; k < ini[u + 1]; k++) {
        const v = dest[k];
        const nd = d + peso[k];
        if (nd < dist[v] && nd <= this.limite) {
          dist[v] = nd;
          orig[v] = orig[u];
          ant[v] = k;
          h.push(v, nd);
        }
      }
    }
    this.retirados += feitos;
    this.terminado = h.vazio;
    return this.terminado;
  }

  /** Ligações (índices do CSR) da fonte até v, em ordem; null se v não foi alcançado. */
  caminhoAte(v) {
    if (this.dist[v] === Infinity) return null;
    const lista = [];
    let atual = v;
    let guarda = this.g.n;
    while (this.ant[atual] >= 0 && guarda-- > 0) {
      const k = this.ant[atual];
      lista.push(k);
      atual = this.g.de[k];
    }
    return Int32Array.from(lista.reverse());
  }
}

/** Dijkstra inteiro, de uma vez. */
export function dijkstra(g, fontes, opcoes = {}) {
  const d = new Dijkstra(g).iniciar(fontes, opcoes);
  d.passo(Infinity);
  return d;
}

/**
 * A* de a até b. A heurística é a distância em linha reta vezes `fator` (use o menor custo por metro do grafo para
 * ela nunca passar do custo real). Devolve { custo, ligacoes: Int32Array, refs: Int32Array | null } ou null.
 * @example aEstrela(g, 0, 7, { x, z, fator: 1 / velMax })
 */
export function aEstrela(g, a, b, { x, z, fator = 0 } = {}) {
  const n = g.n;
  const dist = new Float64Array(n).fill(Infinity);
  const ant = new Int32Array(n).fill(-1);
  const fechado = new Uint8Array(n);
  const h = new HeapMin(64);
  const heur = (v) => (fator > 0 && x ? hipot(x[v] - x[b], z[v] - z[b]) * fator : 0);
  dist[a] = 0;
  h.push(a, heur(a));
  const { ini, dest, peso } = g;
  while (!h.vazio) {
    const u = h.pop();
    if (fechado[u]) continue;
    if (u === b) break;
    fechado[u] = 1;
    const du = dist[u];
    for (let k = ini[u]; k < ini[u + 1]; k++) {
      const v = dest[k];
      if (fechado[v]) continue;
      const nd = du + peso[k];
      if (nd < dist[v]) {
        dist[v] = nd;
        ant[v] = k;
        h.push(v, nd + heur(v));
      }
    }
  }
  if (dist[b] === Infinity) return null;
  const ligacoes = [];
  let v = b;
  let guarda = n;
  while (v !== a && guarda-- > 0) {
    const k = ant[v];
    ligacoes.push(k);
    v = g.de[k];
  }
  ligacoes.reverse();
  const lig = Int32Array.from(ligacoes);
  return { custo: dist[b], ligacoes: lig, refs: g.ref ? lig.map((k) => g.ref[k]) : null };
}
