// Gerador xoshiro128** com um fluxo por sistema. O estado são 4 inteiros de 32 bits e vai no save (sim.rng).
import { fnv1aTexto } from './hash.js';

const rotl = (x, k) => (x << k) | (x >>> (32 - k));

/** Próximo número de 32 bits sem sinal; avança o estado (Uint32Array(4)) no lugar. */
export function proximo(s) {
  const r = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
  const t = s[1] << 9;
  s[2] ^= s[0];
  s[3] ^= s[1];
  s[1] ^= s[2];
  s[0] ^= s[3];
  s[2] ^= t;
  s[3] = rotl(s[3], 11);
  return r;
}

/**
 * Estado inicial de um fluxo a partir da semente da partida e do nome do canal (splitmix32 sobre o FNV do texto).
 * @example semear('heldopolis-1', 'crescimento') // Uint32Array(4)
 */
export function semear(semente, canal = '') {
  let a = fnv1aTexto(`${semente}|${canal}`) | 0;
  const s = new Uint32Array(4);
  for (let i = 0; i < 4; i++) {
    a = (a + 0x9e3779b9) | 0;
    let z = a;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    s[i] = (z ^ (z >>> 16)) >>> 0;
  }
  if (!(s[0] | s[1] | s[2] | s[3])) s[0] = 1;
  return s;
}

/**
 * Um fluxo de números. `estado` é o Uint32Array(4) que o núcleo guarda no save; o objeto só o lê e escreve.
 * @example const r = new Rng(semear(1, 'teste')); r.int(1, 6); r.f(); r.escolher([1, 3]);
 */
export class Rng {
  constructor(estado) {
    this.s = estado;
  }
  /** Inteiro de 32 bits sem sinal. */
  u32() {
    return proximo(this.s);
  }
  /** Real em [0, 1). */
  f() {
    return proximo(this.s) / 4294967296;
  }
  /** Inteiro em [a, b] (inclusive). */
  int(a, b) {
    return a + Math.floor(this.f() * (b - a + 1));
  }
  /** Real em [a, b). */
  entre(a, b) {
    return a + this.f() * (b - a);
  }
  /** true com probabilidade p. */
  chance(p) {
    return this.f() < p;
  }
  /** Índice sorteado pelos pesos (não negativos); -1 se todos forem 0. */
  escolher(pesos) {
    let soma = 0;
    for (let i = 0; i < pesos.length; i++) soma += pesos[i] > 0 ? pesos[i] : 0;
    if (soma <= 0) return -1;
    let x = this.f() * soma;
    for (let i = 0; i < pesos.length; i++) {
      const p = pesos[i] > 0 ? pesos[i] : 0;
      if (x < p) return i;
      x -= p;
    }
    return pesos.length - 1;
  }
  /** Um item da lista. */
  item(lista) {
    return lista[Math.floor(this.f() * lista.length)];
  }
  /** Embaralha no lugar (Fisher-Yates). */
  embaralhar(lista) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(this.f() * (i + 1));
      const t = lista[i];
      lista[i] = lista[j];
      lista[j] = t;
    }
    return lista;
  }
}

/** Atalho: fluxo novo direto da semente e do canal. */
export const criarRng = (semente, canal = '') => new Rng(semear(semente, canal));
