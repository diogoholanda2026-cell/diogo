// Fila de tarefas do worker com determinismo (D15, contratos/tarefas.js): entrada copiada no tique T, resultado aplicado
// no começo do tique T + K; se não chegou, o tique para; se o worker morreu, a thread principal refaz a conta a partir da
// cópia, em fatias. No Node (sem worker) a mesma função roda na hora.
import { copiaProfunda, buffersDe } from '../comum/util.js';

// número da instância, só para casar as respostas de um worker usado por mais de uma simulação (não é estado)
let instancias = 0;

const ehIterador = (r) => r !== null && typeof r === 'object' && typeof r.next === 'function' && typeof r[Symbol.iterator] === 'function';

/** Roda uma função de tarefa até o fim (a função pode ser um gerador que cede entre fatias). */
export function executarAteOFim(fn, entrada) {
  const r = fn(entrada);
  if (!ehIterador(r)) return r;
  for (;;) {
    const p = r.next();
    if (p.done) return p.value;
  }
}

/**
 * Tarefa de prova do motor ('prova'): soma encadeada determinística, cedendo a cada 1.024 valores.
 * @param {{ valores: Float64Array }} entrada
 */
export function* tarefaProva(entrada) {
  const v = entrada.valores;
  let s = 7;
  for (let i = 0; i < v.length; i++) {
    s = (s * 31 + Math.floor(v[i] * 1000)) % 1000003;
    if ((i & 1023) === 1023) yield;
  }
  return { soma: new Float64Array([s]), n: v.length };
}

export class Tarefas {
  /**
   * @param {object} sim  o núcleo (lê sim.tique; emite tarefaAtrasada)
   * @param {{ trabalhador?: Worker | null }} op  sem trabalhador, a conta roda na hora (Node)
   */
  constructor(sim, { trabalhador = null } = {}) {
    this.sim = sim;
    /** @type {Map<string, { K: number, fn: Function | null, aplicar: Function | null }>} */
    this.defs = new Map();
    /** @type {object[]} pendentes em ordem de id */
    this.pendentes = [];
    this.seq = 0;
    this.trabalhador = null;
    this._ouvintes = null;
    this.sessao = ++instancias;
    this.morto = false;
    this.atrasos = 0;
    this.registrar('prova', { K: 5, fn: tarefaProva });
    if (trabalhador) this.ligar(trabalhador);
  }

  /** Liga um worker (ou um falso, nos testes): { postMessage, onmessage | addEventListener }. */
  ligar(trabalhador) {
    this.desligar();
    this.trabalhador = trabalhador;
    this.morto = false;
    const aoMsg = (ev) => this._resposta(ev.data ?? ev);
    const aoErro = () => this.falhou();
    this._ouvintes = { aoMsg, aoErro };
    if (typeof trabalhador.addEventListener === 'function') {
      trabalhador.addEventListener('message', aoMsg);
      trabalhador.addEventListener('error', aoErro);
    } else {
      trabalhador.onmessage = aoMsg;
      trabalhador.onerror = aoErro;
    }
  }

  /**
   * Solta o worker (o app chama ao trocar de simulação, como depois de carregar um save). Sem isso o worker continua
   * segurando a simulação velha pelos ouvintes. O mesmo worker pode servir a simulação nova: as respostas levam a
   * `sessao` de quem pediu, e cada simulação ignora as da outra.
   */
  desligar() {
    const w = this.trabalhador;
    const o = this._ouvintes;
    if (w && o) {
      if (typeof w.removeEventListener === 'function') {
        w.removeEventListener('message', o.aoMsg);
        w.removeEventListener('error', o.aoErro);
      } else {
        if (w.onmessage === o.aoMsg) w.onmessage = null;
        if (w.onerror === o.aoErro) w.onerror = null;
      }
    }
    this._ouvintes = null;
    this.trabalhador = null;
    // o que estava com o worker passa a ser refeito aqui (senão o tique pararia para sempre)
    for (const p of this.pendentes) if (p.estado === 'enviada') this._refazer(p);
  }

  /**
   * Registra (ou completa) uma tarefa: os campos se juntam por nome.
   * @param {string} nome
   * @param {{ K?: number, fn?: Function, aplicar?: (sim: object, saida: any, pedido: object) => void }} def
   */
  registrar(nome, def = {}) {
    const d = this.defs.get(nome) ?? { K: 1, fn: null, aplicar: null };
    if (def.K !== undefined) {
      if (!Number.isInteger(def.K) || def.K < 1) throw new Error(`tarefa ${nome}: K inteiro >= 1`);
      d.K = def.K;
    }
    if (def.fn) d.fn = def.fn;
    if (def.aplicar) d.aplicar = def.aplicar;
    this.defs.set(nome, d);
  }

  /** Pede a tarefa no tique atual; o resultado entra no começo do tique atual + K. Devolve o id. */
  pedir(nome, entrada) {
    const d = this.defs.get(nome);
    if (!d || !d.fn) throw new Error(`tarefa desconhecida: ${nome}`);
    const p = {
      id: ++this.seq,
      nome,
      tique: this.sim.tique,
      tiqueAplicar: this.sim.tique + d.K,
      entrada: copiaProfunda(entrada),
      saida: null,
      estado: 'nova',
      iter: null,
    };
    this.pendentes.push(p);
    this._despachar(p);
    return p.id;
  }

  _despachar(p) {
    const d = this.defs.get(p.nome);
    if (this.trabalhador && !this.morto) {
      const copia = copiaProfunda(p.entrada);
      p.estado = 'enviada';
      try {
        this.trabalhador.postMessage({ id: p.id, sessao: this.sessao, nome: p.nome, tique: p.tique, entrada: copia }, buffersDe(copia));
      } catch {
        this.falhou();
      }
    } else if (this.trabalhador && this.morto) {
      this._refazer(p);
    } else {
      p.saida = executarAteOFim(d.fn, copiaProfunda(p.entrada));
      p.estado = 'pronta';
    }
  }

  _resposta(msg) {
    if (!msg || typeof msg.id !== 'number') return;
    if (msg.sessao !== undefined && msg.sessao !== this.sessao) return; // resposta a outra simulação no mesmo worker
    const p = this.pendentes.find((x) => x.id === msg.id);
    if (!p || p.estado === 'pronta') return;
    if (msg.erro !== undefined) {
      this._refazer(p);
      return;
    }
    p.saida = msg.saida;
    p.estado = 'pronta';
    p.iter = null;
  }

  /** O worker morreu: tudo o que estava com ele passa a ser refeito aqui, em fatias. */
  falhou() {
    this.morto = true;
    for (const p of this.pendentes) if (p.estado !== 'pronta') this._refazer(p);
  }

  _refazer(p) {
    if (p.estado === 'refazendo') return;
    const d = this.defs.get(p.nome);
    const r = d.fn(copiaProfunda(p.entrada));
    if (ehIterador(r)) {
      p.iter = r;
      p.estado = 'refazendo';
    } else {
      p.saida = r;
      p.estado = 'pronta';
    }
  }

  /** Anda `fatias` passos em cada tarefa sendo refeita (chamado pelo laço quando o tique está parado). */
  bombear(fatias = 4) {
    for (const p of this.pendentes) {
      if (p.estado !== 'refazendo') continue;
      for (let k = 0; k < fatias; k++) {
        const r = p.iter.next();
        if (r.done) {
          p.saida = r.value;
          p.estado = 'pronta';
          p.iter = null;
          break;
        }
      }
    }
  }

  /**
   * true se todas as tarefas que vencem no tique T estão prontas. Com sincrono (reprodução, Node) calcula na hora o que
   * faltar, o que dá o mesmo resultado.
   */
  prontas(T, sincrono = false) {
    let ok = true;
    for (const p of this.pendentes) {
      if (p.tiqueAplicar > T || p.estado === 'pronta') continue;
      if (sincrono) {
        const d = this.defs.get(p.nome);
        if (p.estado === 'refazendo') {
          for (;;) {
            const r = p.iter.next();
            if (r.done) {
              p.saida = r.value;
              break;
            }
          }
        } else {
          p.saida = executarAteOFim(d.fn, copiaProfunda(p.entrada));
        }
        p.estado = 'pronta';
        p.iter = null;
      } else {
        ok = false;
      }
    }
    if (!ok) this.atrasos++;
    return ok;
  }

  /** Aplica, em ordem de id, as tarefas que vencem no tique T (todas prontas). */
  aplicarVencidas(T) {
    if (!this.pendentes.length) return;
    const vencidas = this.pendentes.filter((p) => p.tiqueAplicar <= T);
    if (!vencidas.length) return;
    this.pendentes = this.pendentes.filter((p) => p.tiqueAplicar > T);
    for (const p of vencidas) {
      const d = this.defs.get(p.nome);
      if (d.aplicar) d.aplicar(this.sim, p.saida, { id: p.id, nome: p.nome, tique: p.tique, tiqueAplicar: p.tiqueAplicar, entrada: p.entrada });
    }
  }

  /** Estado para o save: pendentes com a entrada copiada (a saída se recalcula). */
  paraSalvar() {
    return {
      seq: this.seq,
      pendentes: this.pendentes.map((p) => ({ id: p.id, nome: p.nome, tique: p.tique, tiqueAplicar: p.tiqueAplicar, entrada: p.entrada })),
    };
  }

  /** Restaura do save e despacha de novo (worker ou conta na hora). */
  deSalvar(d) {
    this.seq = d?.seq ?? 0;
    this.pendentes = [];
    for (const q of d?.pendentes ?? []) {
      if (!this.defs.get(q.nome)?.fn) throw new Error(`save: tarefa pendente desconhecida (${q.nome})`);
      const p = { ...q, saida: null, estado: 'nova', iter: null };
      this.pendentes.push(p);
      this._despachar(p);
    }
  }
}
