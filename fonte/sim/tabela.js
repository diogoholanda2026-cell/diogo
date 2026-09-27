// Tabela em colunas (SoA) com vagas, geração e crescimento por dobra (D19, seção 2.2).
//  - idx = vaga (denso). A menor vaga livre sai primeiro: a lista de livres é determinada pelo estado (viva e n), então
//    não vai no save e dá a mesma ordem no Node, no navegador e depois de carregar.
//  - n = maior idx vivo mais 1 (encolhe quando a última vaga é liberada).
//  - ger (Uint16) sobe ao liberar; ref = idx + ger * 2^20 detecta a troca de dono da vaga. `alto` é a maior vaga já
//    usada mais 1: ger vai no save e no hash até ali (uma vaga liberada acima de n guarda a geração).
//  - Crescer troca TODOS os arrays (dobra até o teto) e chama aoCrescer (o diário marca `realocado`). Ninguém guarda
//    referência a coluna entre quadros.
import { HeapMin } from '../comum/heap.js';

export const REF_BASE = 1048576;

/** Tipos de coluna e de grade que o save sabe gravar (contratos/save.js, TIPOS_SECAO). */
export const TIPOS_SALVAVEIS = Object.freeze([
  Float64Array, Float32Array, Int32Array, Uint32Array, Int16Array, Uint16Array, Int8Array, Uint8Array,
]);

/**
 * Spec de coluna: Tipo, [Tipo, por], [Tipo, por, padrao] ou { tipo, por, padrao }.
 * @returns {{ Tipo: Function, por: number, padrao: number }}
 */
function lerSpec(spec) {
  if (typeof spec === 'function') return { Tipo: spec, por: 1, padrao: 0 };
  if (Array.isArray(spec)) return { Tipo: spec[0], por: spec[1] ?? 1, padrao: spec[2] ?? 0 };
  return { Tipo: spec.tipo, por: spec.por ?? 1, padrao: spec.padrao ?? 0 };
}

export class Tabela {
  /**
   * @param {string} nome
   * @param {Record<string, any>} colunas  spec por nome (ver lerSpec)
   * @param {number} cap                   vagas iniciais
   * @param {{ teto?: number, aoCrescer?: (t: Tabela) => void, aoMarcar?: (i: number) => void }} op
   * @example
   * const t = new Tabela('predios', { x: Float64Array, p: [Float64Array, 8], dono: [Int32Array, 1, -1] }, 64);
   * const i = t.alocar(); t.x[i] = 12; t.marcar(i); const r = t.ref(i); t.liberar(i); t.vivaRef(r) // false
   */
  constructor(nome, colunas, cap = 1024, { teto = Infinity, aoCrescer = null, aoMarcar = null } = {}) {
    this.nome = nome;
    this.n = 0;
    this.alto = 0;
    this.cap = 0;
    this.vivos = 0;
    this.teto = Math.min(teto, REF_BASE); // acima de 2^20 vagas a ref (idx + ger * 2^20) repetiria
    this.aoCrescer = aoCrescer;
    this.aoMarcar = aoMarcar;
    this.realocacoes = 0;
    /** @type {Record<string, { Tipo: Function, por: number, padrao: number }>} */
    this.specs = {};
    this.nomes = [];
    this.viva = new Uint8Array(0);
    this.ger = new Uint16Array(0);
    this._livres = new HeapMin(64);
    const c0 = Math.max(1, Math.min(cap, this.teto));
    this._alocarArrays(c0);
    for (const [k, spec] of Object.entries(colunas)) this.novaColuna(k, spec);
  }

  _alocarArrays(cap) {
    const viva = new Uint8Array(cap);
    const ger = new Uint16Array(cap);
    viva.set(this.viva.subarray(0, Math.min(this.viva.length, cap)));
    ger.set(this.ger.subarray(0, Math.min(this.ger.length, cap)));
    this.viva = viva;
    this.ger = ger;
    for (const k of this.nomes) {
      const { Tipo, por, padrao } = this.specs[k];
      const velho = this[k];
      const novo = new Tipo(cap * por);
      novo.set(velho.subarray(0, Math.min(velho.length, cap * por)));
      if (padrao !== 0) novo.fill(padrao, velho.length);
      this[k] = novo;
    }
    this.cap = cap;
  }

  /**
   * Acrescenta uma coluna (a parcela dona pode pôr colunas próprias numa tabela da F0). Sai no save e no hash.
   * @returns {ArrayLike<number>} o array atual (releia pela tabela depois de crescer)
   */
  novaColuna(nome, spec, por, padrao) {
    if (this.specs[nome]) throw new Error(`tabela ${this.nome}: coluna repetida ${nome}`);
    if (nome in this && !this.specs[nome]) throw new Error(`tabela ${this.nome}: nome reservado ${nome}`);
    const s = por !== undefined ? { Tipo: spec, por, padrao: padrao ?? 0 } : lerSpec(spec);
    if (!TIPOS_SALVAVEIS.includes(s.Tipo)) throw new Error(`tabela ${this.nome}: coluna ${nome} com tipo que o save não grava`);
    if (!Number.isInteger(s.por) || s.por < 1) throw new Error(`tabela ${this.nome}: coluna ${nome} com por inválido`);
    this.specs[nome] = s;
    this.nomes.push(nome);
    this[nome] = new s.Tipo(this.cap * s.por);
    if (s.padrao !== 0) this[nome].fill(s.padrao);
    return this[nome];
  }

  /** Dobra a capacidade (ou até `cap`), respeitando o teto. Devolve false se já está no teto. */
  crescer(cap = this.cap * 2) {
    const alvo = Math.min(Math.max(cap, this.cap + 1), this.teto);
    if (alvo <= this.cap) return false;
    this._alocarArrays(alvo);
    this.realocacoes++;
    if (this.aoCrescer) this.aoCrescer(this);
    return true;
  }

  _limparLinha(i) {
    for (const k of this.nomes) {
      const { por, padrao } = this.specs[k];
      this[k].fill(padrao, i * por, (i + 1) * por);
    }
  }

  /** Aloca a menor vaga livre; -1 se a tabela está no teto. A linha sai com os padrões das colunas. */
  alocar() {
    let i = -1;
    const h = this._livres;
    while (!h.vazio) {
      const c = h.pop();
      if (c < this.n && !this.viva[c]) {
        i = c;
        break;
      }
    }
    if (i < 0) {
      if (this.n >= this.cap && !this.crescer()) return -1;
      i = this.n++;
    }
    if (i >= this.alto) this.alto = i + 1;
    this.viva[i] = 1;
    this.vivos++;
    this._limparLinha(i);
    this.marcar(i);
    return i;
  }

  /** Libera a vaga i: zera a linha, sobe a geração e encolhe n se for a última. */
  liberar(i) {
    if (i < 0 || i >= this.n || !this.viva[i]) return false;
    this.viva[i] = 0;
    this.ger[i] = (this.ger[i] + 1) & 0xffff;
    this.vivos--;
    this._limparLinha(i);
    this.marcar(i);
    if (i === this.n - 1) {
      while (this.n > 0 && !this.viva[this.n - 1]) this.n--;
    } else {
      this._livres.push(i, i);
    }
    return true;
  }

  /** Avisa o diário que a linha i mudou. */
  marcar(i) {
    if (this.aoMarcar) this.aoMarcar(i);
  }

  ref(i) {
    return i + this.ger[i] * REF_BASE;
  }

  idx(ref) {
    return ref % REF_BASE;
  }

  /** true se a ref ainda aponta para a mesma coisa viva. */
  vivaRef(ref) {
    if (!Number.isInteger(ref) || ref < 0) return false;
    const i = ref % REF_BASE;
    return i < this.n && this.viva[i] === 1 && this.ger[i] === Math.floor(ref / REF_BASE);
  }

  /** idx de uma ref viva, ou -1. */
  idxVivo(ref) {
    return this.vivaRef(ref) ? ref % REF_BASE : -1;
  }

  /** Chama fn(i) para cada vaga viva, em ordem de idx. */
  paraCada(fn) {
    const v = this.viva;
    for (let i = 0; i < this.n; i++) if (v[i]) fn(i);
  }

  /** Refaz a lista de livres a partir de viva e n (depois de carregar). */
  refazerLivres() {
    this._livres.limpar();
    let vivos = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.viva[i]) vivos++;
      else this._livres.push(i, i);
    }
    this.vivos = vivos;
  }

  /** Garante capacidade para pelo menos c vagas (carregar). */
  garantir(c) {
    while (this.cap < c) if (!this.crescer(Math.max(c, this.cap * 2))) throw new Error(`tabela ${this.nome}: acima do teto`);
  }

  /** Colunas em ordem canônica (alfabética): para o save e o hash. */
  colunasOrdenadas() {
    return [...this.nomes].sort();
  }
}

/** Atalho funcional. */
export const criarTabela = (nome, colunas, cap, op) => new Tabela(nome, colunas, cap, op);
