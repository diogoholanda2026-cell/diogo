// Anexos do setor (D39, R4b): o prédio que nasce, sobe de nível ou muda não refaz a malha fundida do setor (dezenas de
// MB por minuto em 4x); entra no ANEXO do setor, uma malha pequena com só os prédios que mudaram, refeita na oficina em
// poucos ms. O setor é refundido depois de 5 s sem mudança (ANEXO.refusaoMs), juntando as mudanças, ou antes, se o
// anexo cresce demais ou a primeira diferença passa de 30 s (em 4x a cidade não para de crescer).
//
// Cada prédio vale numa cópia só. A malha da base do setor e a do anexo levam o mesmo idx no aId (a do anexo com o bit
// ID_ANEXO) e o vértice esconde a que não vale pelo bit ANEXO da tabela (fachada.glsl.js). O registro decide o bit:
//   vivo no setor s: ANEXO quando a base de s não tem a versão atual (assinatura) e o anexo montado de s já tem o
//     prédio; enquanto o anexo não chega, a versão velha da base continua à vista (sem buraco)
//   morto (ou a vaga reaproveitada noutro lugar): APAGADO enquanto alguma malha montada ainda tem a cópia velha
// Uma base nova só leva o prédio que nenhuma outra base tem (a vaga que mudou de setor espera a base velha sair), então
// cada idx está no máximo numa base. Puro, sem three: roda no Node (testes) e no navegador; render/mundo/predios.js usa.

/** Refusão (D39): 5 s sem mudança no setor, ou o anexo com prédios demais, ou a diferença mais velha que 30 s. */
export const ANEXO = Object.freeze({ refusaoMs: 5000, maxPredios: 32, maxIdadeMs: 30000 });

export class RegistroAnexos {
  constructor({ refusaoMs = ANEXO.refusaoMs, maxPredios = ANEXO.maxPredios, maxIdadeMs = ANEXO.maxIdadeMs } = {}) {
    this.op = { refusaoMs, maxPredios, maxIdadeMs };
    this.baseSec = new Int32Array(0);
    this.baseSig = new Uint32Array(0);
    this.anexoSec = new Int32Array(0);
    /** @type {Map<number, { s, sujo, urgente, mudouEm, desde, base, anexo, pedidoBase, pedidoAnexo }>} */
    this.setores = new Map();
  }

  crescer(cap) {
    if (this.baseSec.length >= cap) return;
    const a = new Int32Array(cap).fill(-1);
    a.set(this.baseSec);
    this.baseSec = a;
    const b = new Uint32Array(cap);
    b.set(this.baseSig);
    this.baseSig = b;
    const c = new Int32Array(cap).fill(-1);
    c.set(this.anexoSec);
    this.anexoSec = c;
  }

  /** Estado do setor s (criado na primeira vez). base e anexo: { lista: number[], sigs: number[] } montados. */
  setor(s) {
    let e = this.setores.get(s);
    if (!e) {
      e = { s, sujo: false, urgente: false, mudouEm: 0, desde: -1, base: null, anexo: null, pedidoBase: null, pedidoAnexo: null };
      this.setores.set(s, e);
    }
    return e;
  }

  /** O prédio mudou de lugar, de lote ou de aparência (sai de sAntes, entra em sDepois; -1: nenhum) no instante agora. */
  mudou(sAntes, sDepois, agora) {
    for (const s of sAntes === sDepois ? [sAntes] : [sAntes, sDepois]) {
      if (s < 0) continue;
      const e = this.setor(s);
      e.sujo = true;
      e.mudouEm = agora;
      if (e.desde < 0) e.desde = agora;
    }
  }

  /**
   * A vaga i voltou viva fora das malhas dos setores (um colocável da R5 ou da Holding, que usa o mesmo idx no aId): o
   * bit APAGADO esconderia também a malha dele, então as malhas que ainda têm a cópia velha refundem já, sem os 5 s.
   */
  urgente(i, agora) {
    for (const s of new Set([this.baseSec[i], this.anexoSec[i]])) {
      if (s < 0) continue;
      const e = this.setor(s);
      e.sujo = true;
      e.urgente = true;
      if (e.desde < 0) e.desde = agora;
    }
  }

  /** A base montada de s tem a versão sig do prédio i? */
  naBase(i, s, sig) {
    return this.baseSec[i] === s && this.baseSig[i] === sig;
  }

  /**
   * Bits do prédio i: { anexo, apagado }. s: setor atual (-1 morto ou fora do domínio), sig: assinatura atual.
   */
  bits(i, s, sig) {
    if (s < 0) return { anexo: false, apagado: this.baseSec[i] >= 0 || this.anexoSec[i] >= 0 };
    return { anexo: !this.naBase(i, s, sig) && this.anexoSec[i] === s, apagado: false };
  }

  /** Prédios do setor que a base não tem na versão atual (o que o anexo tem de levar). */
  desejado(s, membros, sigDe) {
    const out = [];
    for (const i of membros) if (!this.naBase(i, s, sigDe(i))) out.push(i);
    return out;
  }

  /**
   * Lista para a próxima base de s: os membros, menos a vaga que ainda está na base de outro setor (a cópia velha de
   * lá apareceria quando o bit voltasse a 0).
   */
  listaDaBase(s, membros) {
    return membros.filter((i) => !(this.baseSec[i] >= 0 && this.baseSec[i] !== s));
  }

  /** Setores que pedem refusão agora (sujos, sem base no ar, quietos por refusaoMs, ou anexo grande ou velho). */
  devidos(agora, tamanhoAnexo = () => 0) {
    const out = [];
    const { refusaoMs, maxPredios, maxIdadeMs } = this.op;
    for (const e of this.setores.values()) {
      if (!e.sujo || e.pedidoBase) continue;
      if (e.urgente || agora - e.mudouEm >= refusaoMs || tamanhoAnexo(e.s) >= maxPredios || (e.desde >= 0 && agora - e.desde >= maxIdadeMs)) out.push(e.s);
    }
    return out;
  }

  /** Marca o pedido da base de s (a lista e as assinaturas pedidas). */
  pedirBase(s, lista, sigs) {
    const e = this.setor(s);
    e.pedidoBase = { lista, sigs };
    e.sujo = false;
    e.urgente = false;
    e.desde = -1;
  }

  /** Marca o pedido do anexo de s. */
  pedirAnexo(s, lista, sigs) {
    this.setor(s).pedidoAnexo = { lista, sigs };
  }

  /**
   * A base de s chegou com a lista e as assinaturas pedidas. Devolve os idx cujo bit pode ter mudado (os que saíram
   * da base velha e os da nova) e os setores que ficaram livres para absorver uma vaga que estava presa aqui.
   */
  baseChegou(s, lista, sigs) {
    const e = this.setor(s);
    const tocados = new Set();
    const liberados = new Set();
    if (e.base) {
      for (const j of e.base.lista) {
        if (this.baseSec[j] === s) {
          this.baseSec[j] = -1;
          tocados.add(j);
        }
      }
    }
    lista.forEach((i, k) => {
      this.baseSec[i] = s;
      this.baseSig[i] = sigs[k];
      tocados.add(i);
    });
    // a vaga que saiu daqui e mora noutro setor: aquele setor pode refundir com ela agora
    for (const j of tocados) if (this.baseSec[j] < 0 && this.anexoSec[j] >= 0 && this.anexoSec[j] !== s) liberados.add(this.anexoSec[j]);
    e.base = { lista: lista.slice(), sigs: Array.from(sigs) };
    e.pedidoBase = null;
    for (const t of liberados) {
      const o = this.setor(t);
      o.sujo = true;
      if (o.desde < 0) o.desde = o.mudouEm;
    }
    return { tocados: [...tocados], liberados: [...liberados] };
  }

  /** O anexo de s chegou (lista e assinaturas). Devolve os idx cujo bit pode ter mudado. */
  anexoChegou(s, lista, sigs) {
    const e = this.setor(s);
    const tocados = new Set();
    if (e.anexo) {
      for (const j of e.anexo.lista) {
        if (this.anexoSec[j] === s) {
          this.anexoSec[j] = -1;
          tocados.add(j);
        }
      }
    }
    for (const i of lista) {
      this.anexoSec[i] = s;
      tocados.add(i);
    }
    e.anexo = { lista: lista.slice(), sigs: Array.from(sigs) };
    e.pedidoAnexo = null;
    return [...tocados];
  }

  /** O anexo de s saiu (setor vazio, ou refundido sem diferença): solta as marcas. */
  soltarAnexo(s) {
    const e = this.setores.get(s);
    if (!e?.anexo) return [];
    const tocados = [];
    for (const j of e.anexo.lista) {
      if (this.anexoSec[j] === s) {
        this.anexoSec[j] = -1;
        tocados.push(j);
      }
    }
    e.anexo = null;
    return tocados;
  }
}

/** Os anexos não registram domínio: o domínio 'predios' (mundo/predios.js) usa o registro. */
export function registrar() {}
