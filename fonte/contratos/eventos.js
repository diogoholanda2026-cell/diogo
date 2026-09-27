// Eventos da simulação para a UI, o som e o Mural (seção 2.6). sim.on(nome, fn) devolve a função que desliga.
// São entregues no fim do tique ou logo depois de um comando, na ordem em que foram emitidos. Não são estado: nada
// na simulação pode depender de alguém ouvir. sim.emitir(nome, dados) só aceita nomes daqui.
import { congelar } from '../comum/util.js';

export const EVENTOS = congelar({
  marco: '{ n, nome, premios, libera }',
  desbloqueio: '{ ids }',
  decisao: '{ id }',
  mural: '{ post }',
  aviso: '{ id, gravidade, codigo, params, alvo } (da cidade)',
  avisosPredios: '{} (a lista de q.avisosPredios mudou)',
  etapa: '{ id, estado }',
  objetivo: '{ id, estado }',
  financas: '{ tipo }',
  caixaZerado: '{ sim }',
  obraFim: '{ ref }',
  predioNivel: '{ ref, nivel }',
  predioAbandonado: '{ ref }',
  velocidade: '{ v }',
  construido: '{ tipo, refs }',
  demolido: '{ tipo, refs }',
  ladrilho: '{ i, j }',
  tarefaAtrasada: '{ nome, tique } (D15: o tique parou esperando o worker)',
  carregado: '{ tique } (um save foi aplicado nesta simulação)',
});

/**
 * @example const desligar = sim.on('predioNivel', ({ ref, nivel }) => tocarSom('nivel'));
 */
export const LISTA_EVENTOS = Object.freeze(Object.keys(EVENTOS));
