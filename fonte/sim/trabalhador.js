// Ponto de entrada do worker `tarefas` (D15, seção 2.8): recebe { id, sessao, nome, tique, entrada } e responde
// { id, sessao, saida } com os arrays transferidos (sessao só volta: casa a resposta com a simulação que pediu).
// Cada módulo de tarefa pura (fonte/sim/tarefas/*.js) é chamado com um registro mínimo: no registrar(sim) desses
// módulos só vale sim.tarefas.registrar(nome, { fn, K }).
import { buffersDe, copiaProfunda } from '../comum/util.js';
import { criarRng } from '../comum/rng.js';
import { executarAteOFim, tarefaProva } from './tarefas.js';
import * as transito from './tarefas/transito.js';

const MODULOS = [transito];

/** Funções puras por nome, como o worker as vê. */
export function funcoesDoTrabalhador(modulos = MODULOS) {
  const fns = { prova: tarefaProva };
  const reg = {
    tarefas: {
      registrar(nome, def) {
        if (def && def.fn) fns[nome] = def.fn;
      },
    },
  };
  for (const m of modulos) m.registrar(reg);
  return fns;
}

/** Responde uma mensagem: { resposta, transferir }. */
export function responder(fns, msg) {
  const fn = fns[msg?.nome];
  const sessao = msg?.sessao;
  if (!fn) return { resposta: { id: msg?.id, sessao, erro: `tarefa desconhecida: ${msg?.nome}` }, transferir: [] };
  try {
    const saida = executarAteOFim(fn, msg.entrada);
    return { resposta: { id: msg.id, sessao, saida }, transferir: buffersDe(saida) };
  } catch (e) {
    return { resposta: { id: msg.id, sessao, erro: String(e?.message ?? e) }, transferir: [] };
  }
}

/** Liga o worker a um escopo (self no worker de verdade). */
export function iniciarTrabalhador(escopo, modulos = MODULOS) {
  const fns = funcoesDoTrabalhador(modulos);
  escopo.onmessage = (ev) => {
    const { resposta, transferir } = responder(fns, ev.data);
    escopo.postMessage(resposta, transferir);
  };
  return fns;
}

/**
 * Worker SIMULADO (testes e parcelas que usam tarefas sem navegador): responde pela mesma função pura com um atraso
 * sorteado de 0 a `atrasoMax` ms (setTimeout) e pode "morrer" depois de `morrerDepois` pedidos (dispara onerror), para
 * provar a D15: o hash sai igual ao da conta na hora.
 * @example const sim = criarSimulacao({ trabalhador: criarTrabalhadorSimulado({ atrasoMax: 15 }) });
 */
export function criarTrabalhadorSimulado({ atrasoMax = 12, morrerDepois = Infinity, semente = 'trabalhador', modulos = MODULOS } = {}) {
  const fns = funcoesDoTrabalhador(modulos);
  const r = criarRng(semente, 'atraso');
  let pedidos = 0;
  const w = {
    onmessage: null,
    onerror: null,
    pedidos: () => pedidos,
    postMessage(msg) {
      pedidos++;
      if (pedidos > morrerDepois) {
        setTimeout(() => w.onerror && w.onerror(new Error('worker simulado morreu')), 1);
        return;
      }
      const copia = copiaProfunda(msg);
      setTimeout(() => {
        const { resposta } = responder(fns, copia);
        if (w.onmessage) w.onmessage({ data: resposta });
      }, r.int(0, atrasoMax));
    },
  };
  return w;
}

// dentro de um worker de verdade, liga sozinho
if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope) {
  iniciarTrabalhador(self);
}
