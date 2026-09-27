// Grade espacial de 64 m (128 x 128 baldes no mapa de 8.192 m) em listas encadeadas em arrays, para arestas, prédios e
// blocos: encaixe, colisão, toque e consultas "perto de". É derivada (refeita ao carregar) e as consultas devolvem os
// ids em ordem crescente, para nenhum sistema depender da ordem de inserção.

export class GradeEspacial {
  /**
   * @param {{ tam?: number, passo?: number, origem?: number[] }} op
   * @example const g = new GradeEspacial(); g.inserir(7, 0, 0, 30, 10); g.consultar(-5, -5, 5, 5) // Int32Array [7]
   */
  constructor({ tam = 8192, passo = 64, origem = [-4096, -4096] } = {}) {
    this.passo = passo;
    this.lado = Math.ceil(tam / passo);
    this.ox = origem[0];
    this.oz = origem[1];
    this.cabeca = new Int32Array(this.lado * this.lado).fill(-1);
    // entradas: uma por (item, balde)
    this.eItem = new Int32Array(1024);
    this.eBalde = new Int32Array(1024);
    this.eProx = new Int32Array(1024);
    this.eAnt = new Int32Array(1024);
    this.eProxItem = new Int32Array(1024);
    this.livreE = -1;
    this.nE = 0;
    this.primeira = new Int32Array(256).fill(-1); // primeira entrada de cada item
    this.visto = new Uint32Array(256);
    this.carimbo = 0;
    this.resultado = new Int32Array(256);
    this.itens = 0;
  }

  _garantirItem(id) {
    if (id < this.primeira.length) return;
    let c = this.primeira.length;
    while (c <= id) c *= 2;
    const p = new Int32Array(c).fill(-1);
    p.set(this.primeira);
    this.primeira = p;
    const v = new Uint32Array(c);
    v.set(this.visto);
    this.visto = v;
  }

  _novaEntrada() {
    if (this.livreE >= 0) {
      const e = this.livreE;
      this.livreE = this.eProx[e];
      return e;
    }
    if (this.nE === this.eItem.length) {
      const c = this.nE * 2;
      for (const k of ['eItem', 'eBalde', 'eProx', 'eAnt', 'eProxItem']) {
        const a = new Int32Array(c);
        a.set(this[k]);
        this[k] = a;
      }
    }
    return this.nE++;
  }

  _baldes(x0, z0, x1, z1) {
    const L = this.lado - 1;
    const i0 = Math.max(0, Math.min(L, Math.floor((x0 - this.ox) / this.passo)));
    const j0 = Math.max(0, Math.min(L, Math.floor((z0 - this.oz) / this.passo)));
    const i1 = Math.max(0, Math.min(L, Math.floor((x1 - this.ox) / this.passo)));
    const j1 = Math.max(0, Math.min(L, Math.floor((z1 - this.oz) / this.passo)));
    return [i0, j0, i1, j1];
  }

  /** Insere o item id na caixa [x0, z0, x1, z1] (remove antes se já estava). */
  inserir(id, x0, z0, x1, z1) {
    this._garantirItem(id);
    if (this.primeira[id] >= 0) this.remover(id);
    const [i0, j0, i1, j1] = this._baldes(x0, z0, x1, z1);
    let ultima = -1;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const b = j * this.lado + i;
        const e = this._novaEntrada();
        this.eItem[e] = id;
        this.eBalde[e] = b;
        this.eAnt[e] = -1;
        this.eProx[e] = this.cabeca[b];
        if (this.cabeca[b] >= 0) this.eAnt[this.cabeca[b]] = e;
        this.cabeca[b] = e;
        this.eProxItem[e] = ultima;
        ultima = e;
      }
    }
    this.primeira[id] = ultima;
    this.itens++;
  }

  /** Remove o item id (sem efeito se não está). */
  remover(id) {
    if (id >= this.primeira.length) return;
    let e = this.primeira[id];
    if (e < 0) return;
    while (e >= 0) {
      const prox = this.eProxItem[e];
      const b = this.eBalde[e];
      const a = this.eAnt[e];
      const p = this.eProx[e];
      if (a >= 0) this.eProx[a] = p;
      else this.cabeca[b] = p;
      if (p >= 0) this.eAnt[p] = a;
      this.eProx[e] = this.livreE;
      this.livreE = e;
      e = prox;
    }
    this.primeira[id] = -1;
    this.itens--;
  }

  /** true se o item está na grade. */
  tem(id) {
    return id < this.primeira.length && this.primeira[id] >= 0;
  }

  /**
   * Ids cujas caixas tocam os baldes da caixa [x0, z0, x1, z1], sem repetição e em ordem crescente.
   * Devolve uma vista de this.resultado (válida até a próxima consulta).
   */
  consultar(x0, z0, x1, z1) {
    const [i0, j0, i1, j1] = this._baldes(x0, z0, x1, z1);
    this.carimbo = (this.carimbo + 1) >>> 0;
    if (this.carimbo === 0) {
      this.visto.fill(0);
      this.carimbo = 1;
    }
    const c = this.carimbo;
    let k = 0;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        for (let e = this.cabeca[j * this.lado + i]; e >= 0; e = this.eProx[e]) {
          const id = this.eItem[e];
          if (this.visto[id] === c) continue;
          this.visto[id] = c;
          if (k === this.resultado.length) {
            const r = new Int32Array(k * 2);
            r.set(this.resultado);
            this.resultado = r;
          }
          this.resultado[k++] = id;
        }
      }
    }
    return this.resultado.subarray(0, k).sort();
  }

  /** Item mais perto de (x, z) até `raio`, pela distância que `distancia(id)` devolve (Infinity descarta). */
  maisPerto(x, z, raio, distancia) {
    const ids = this.consultar(x - raio, z - raio, x + raio, z + raio);
    let melhor = -1;
    let dm = raio;
    for (let k = 0; k < ids.length; k++) {
      const d = distancia(ids[k]);
      if (d <= dm && (d < dm || melhor < 0)) {
        dm = d;
        melhor = ids[k];
      }
    }
    return melhor < 0 ? null : { id: melhor, d: dm };
  }

  limpar() {
    this.cabeca.fill(-1);
    this.primeira.fill(-1);
    this.nE = 0;
    this.livreE = -1;
    this.itens = 0;
  }
}
