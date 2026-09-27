// Ponte com o worker `oficina` (seção 2.8, D39, D45): pedidos { id, tipo, chave, dados } com os arrays transferidos e a
// resposta como Promise. Uma oficina por render (oficinaDe(ctx)), compartilhada por quem gera malha fora da thread
// principal (prédios aqui; vias, árvores e colocáveis quando as donas quiserem). Sem worker (fora da montagem, ou se
// ele não abrir), os mesmos geradores rodam aqui, um pedido por quadro, pelo despachante da F0.
import { criarDespachante } from './oficina.worker.js';

export class Oficina {
  constructor(ctx) {
    this.worker = ctx.criarWorker?.('oficina') ?? null;
    this.esperando = new Map();
    this.seq = 1;
    this.local = [];
    this._desp = null;
    this.feitos = 0;
    if (this.worker) {
      this.worker.onmessage = (ev) => this._resposta(ev.data);
      this.worker.onerror = (e) => {
        console.warn('oficina: o worker falhou; os pedidos seguem na thread principal', e?.message ?? e);
        this._semWorker();
      };
    }
  }

  /** Quantos pedidos esperam resposta. */
  get pendentes() {
    return this.esperando.size;
  }

  /**
   * Pede uma malha. `transferir` são os ArrayBuffer dos dados (a oficina fica com eles).
   * @returns {Promise<object>} a resposta do gerador ({ ..., erro } se falhou)
   */
  pedir(tipo, dados, { chave = null, transferir = [] } = {}) {
    const id = this.seq++;
    return new Promise((ok) => {
      const msg = { id, tipo, chave, dados };
      this.esperando.set(id, { ok, msg });
      if (this.worker) {
        try {
          this.worker.postMessage(msg, transferir);
          return;
        } catch (e) {
          console.warn('oficina: postMessage falhou; segue na thread principal', e);
          this._semWorker();
          return;
        }
      }
      this.local.push(id);
    });
  }

  _resposta(r) {
    const e = this.esperando.get(r?.id);
    if (!e) return;
    this.esperando.delete(r.id);
    this.feitos++;
    if (r.erro) console.error(`oficina: ${e.msg.tipo}: ${r.erro}`);
    e.ok(r);
  }

  _semWorker() {
    try {
      this.worker?.terminate();
    } catch (e) {
      // já morto
    }
    this.worker = null;
    // o que estava no worker volta para a fila local (os dados não foram transferidos se o envio falhou; se foram,
    // o pedido volta sem dados e o dono pede de novo)
    for (const [id, e] of this.esperando) if (!this.local.includes(id)) this.local.push(id);
  }

  /** Sem worker: roda até `max` pedidos da fila (o domínio que chama decide quantos cabem no quadro). */
  rodarLocal(max = 1) {
    let n = 0;
    while (this.local.length && n < max) {
      const id = this.local.shift();
      const e = this.esperando.get(id);
      if (!e) continue;
      this._desp ??= criarDespachante();
      const { resposta } = this._desp.responder(e.msg);
      this._resposta(resposta);
      n++;
    }
    return n;
  }

  descartar() {
    try {
      this.worker?.terminate();
    } catch (e) {
      // já morto
    }
    this.worker = null;
    this.esperando.clear();
  }
}

/** A oficina do render (criada na primeira vez). */
export function oficinaDe(ctx) {
  ctx._oficina ??= new Oficina(ctx);
  return ctx._oficina;
}

/** Domínio 'oficina': sem worker, roda um pedido local por quadro; mostra a fila em R.stats.setores. */
export function registrar(api) {
  api.registrarDominio('oficina', (ctx) => {
    const o = oficinaDe(ctx);
    return {
      nome: 'oficina',
      quadro(t, c) {
        o.rodarLocal(1);
        c.stats.setores.fila = o.pendentes;
      },
      descartar() {
        o.descartar();
      },
    };
  });
}
