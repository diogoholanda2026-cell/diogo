// Tarefas pesadas no worker `tarefas` com determinismo (D15). Implementação: fonte/sim/tarefas.js e trabalhador.js.
//
// 1. No tique T a simulação pede: sim.tarefas.pedir(nome, entrada). A entrada é COPIADA (arrays tipados inclusive);
//    a cópia fica guardada até T + K e vai no save; uma segunda cópia é transferida ao worker.
// 2. Mensagem ao worker: { id, sessao, nome, tique, entrada }. Resposta: { id, sessao, saida } com os arrays
//    transferidos. `sessao` identifica a simulação que pediu: um worker reaproveitado depois de carregar um save
//    responde às duas, e cada uma ignora a resposta da outra. Ao descartar uma simulação: sim.tarefas.desligar().
// 3. No Node (sem worker) a mesma função pura roda na hora, sobre a mesma cópia.
// 4. No começo do tique T + K a saída é aplicada (aplicar(sim, saida, pedido)) antes dos sistemas. Se ainda não chegou,
//    O TIQUE PARA até chegar (sim.avancar devolve 0 e emite tarefaAtrasada); a interface mostra a velocidade efetiva.
// 5. Se o worker morreu (erro), a thread principal refaz a conta a partir da cópia, em fatias: a função pode ser um
//    gerador (function*) que cede (yield) entre fatias; no worker e no Node ela roda até o fim.
// 6. A função é pura: mesma entrada, mesma saída, sem relógio, sem sorteio e sem ler o estado.
//
// Registro (no registrar(sim) do domínio e do módulo puro):
//   sim.tarefas.registrar(nome, { K, fn, aplicar })   // os campos se juntam por nome; fn também é registrada no worker
// No worker (fonte/sim/trabalhador.js) cada módulo de tarefa pura é chamado com um registro mínimo
// { tarefas: { registrar(nome, { fn }) } }; os outros campos são ignorados lá.
import { congelar } from '../comum/util.js';

/**
 * @example
 * sim.tarefas.registrar('transito', { K: 60, fn: atribuir, aplicar: (sim, saida) => usarFluxos(sim, saida) });
 * sim.registrarSistema(60, 0, (sim) => sim.tarefas.pedir('transito', entradaDoTransito(sim)), 1, { ordem: ORDEM.transito });
 */
export const TAREFAS = congelar({
  transito: { K: 60, dono: 'S1c', desc: 'atribuição agregada a cada 60 tiques (D37)' },
  prova: { K: 5, dono: 'F0', desc: 'tarefa de prova do motor (testes e página de teste)' },
});

/**
 * @typedef {object} PedidoTarefa
 * @property {number} id
 * @property {string} nome
 * @property {number} tique          T
 * @property {number} tiqueAplicar   T + K
 * @property {object} entrada        a cópia guardada
 */

/** Mensagens entre a simulação e o worker. */
export const MENSAGENS = congelar({
  pedido: '{ id, sessao, nome, tique, entrada }',
  resposta: '{ id, sessao, saida } | { id, sessao, erro }',
});
