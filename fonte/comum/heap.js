// Fila de prioridade mínima em arrays tipados (Dijkstra, A*, livres das tabelas). Cresce por dobra.

export class HeapMin {
  constructor(cap = 1024) {
    this.v = new Int32Array(cap);
    this.k = new Float64Array(cap);
    this.n = 0;
    this.ultimaChave = 0;
  }

  get vazio() {
    return this.n === 0;
  }

  /** Chave do topo (Infinity se vazio). */
  get topoChave() {
    return this.n ? this.k[0] : Infinity;
  }

  /** Valor do topo (-1 se vazio). */
  get topo() {
    return this.n ? this.v[0] : -1;
  }

  limpar() {
    this.n = 0;
  }

  _crescer() {
    const v = new Int32Array(this.v.length * 2);
    const k = new Float64Array(this.k.length * 2);
    v.set(this.v);
    k.set(this.k);
    this.v = v;
    this.k = k;
  }

  /** Insere o valor v com a chave k. */
  push(v, k) {
    if (this.n === this.v.length) this._crescer();
    const V = this.v;
    const K = this.k;
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= k) break;
      V[i] = V[p];
      K[i] = K[p];
      i = p;
    }
    V[i] = v;
    K[i] = k;
  }

  /** Retira o menor; a chave dele fica em ultimaChave. Devolve -1 se vazio. */
  pop() {
    if (!this.n) return -1;
    const V = this.v;
    const K = this.k;
    const topo = V[0];
    this.ultimaChave = K[0];
    const n = --this.n;
    if (n > 0) {
      const lv = V[n];
      const lk = K[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && K[c + 1] < K[c]) c++;
        if (K[c] >= lk) break;
        V[i] = V[c];
        K[i] = K[c];
        i = c;
      }
      V[i] = lv;
      K[i] = lk;
    }
    return topo;
  }
}
