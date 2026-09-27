// Livro de comandos (D17): cada comando aplicado entra como [tique, seq, nome, args]; a reprodução aplica o comando
// quando sim.tique chega a `tique`, antes de rodar esse tique. Serve ao diário do app (D31), ao robô e aos testes.
import { cortarInicio } from '../comum/util.js';

export class Livro {
  /** @param {{ max?: number }} op  guarda os últimos `max` comandos (2.000 no save) */
  constructor({ max = 2000 } = {}) {
    this.max = max;
    /** @type {[number, number, string, object][]} */
    this.entradas = [];
  }

  /** Anota um comando (args já copiados como JSON puro). */
  anotar(tique, seq, nome, args) {
    this.entradas.push([tique, seq, nome, args]);
    if (this.entradas.length > this.max + 64) cortarInicio(this.entradas, this.max);
  }

  /** Comandos com seq maior que `seq`. */
  desde(seq) {
    return this.entradas.filter((e) => e[1] > seq);
  }

  /** Último seq anotado (0 se vazio). */
  get ultimoSeq() {
    return this.entradas.length ? this.entradas[this.entradas.length - 1][1] : 0;
  }

  paraJSON() {
    return cortarInicio(this.entradas.slice(), this.max);
  }

  deJSON(lista) {
    this.entradas = Array.isArray(lista) ? lista.map((e) => [e[0], e[1], e[2], e[3]]) : [];
  }
}

/**
 * Reproduz uma lista de comandos numa simulação e para no tique `ateTique` (sim.tique === ateTique no fim).
 * As tarefas do worker são calculadas na hora (sincrono), o que dá o mesmo resultado (D15).
 * @returns {{ aplicados: number, recusados: { entrada: any[], resposta: object }[] }}
 * @example reproduzir(simNova, livro.entradas, 1800)
 */
export function reproduzir(sim, entradas, ateTique = null, { aoComando = null } = {}) {
  let aplicados = 0;
  const recusados = [];
  const lista = [...entradas].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const e of lista) {
    const [tique, , nome, args] = e;
    if (ateTique !== null && tique > ateTique) break;
    if (tique < sim.tique) throw new Error(`reproduzir: comando no tique ${tique}, a simulação já está em ${sim.tique}`);
    sim.rodar(tique - sim.tique, { sincrono: true });
    const r = sim.cmd(nome, args);
    aplicados++;
    if (!r.ok) recusados.push({ entrada: e, resposta: r });
    if (aoComando) aoComando(e, r);
  }
  if (ateTique !== null && ateTique > sim.tique) sim.rodar(ateTique - sim.tique, { sincrono: true });
  return { aplicados, recusados };
}
