// Lista fechada dos códigos de recusa dos comandos (seção 2.5). A UI traduz cada um por t() em fonte/ui/textos/;
// um teste confere que todo código tem frase. Mudar esta lista é pedido ao integrador.
import { congelar } from '../comum/util.js';

/** Código: o que quer dizer (para quem programa; a frase da interface fica nos textos). */
export const CODIGOS = congelar({
  valor: 'argumento fora do formato ou do intervalo',
  creditos: 'caixa insuficiente',
  agua: 'trecho ou planta sobre água, sem travessia registrada',
  vao: 'vão de ponte acima do máximo (D53)',
  declive: 'declive acima do máximo do tipo',
  angulo: 'ângulo abaixo de 30 graus entre duas vias no mesmo nó',
  curto: 'trecho abaixo do comprimento mínimo depois de dividir',
  raio: 'curva mais fechada que o raio mínimo do tipo',
  ladrilho: 'fora dos ladrilhos da Holding',
  gleba: 'dentro da gleba da Arcologia',
  colisao: 'bate em prédio, via ou colocável que não será demolido',
  fixo: 'construção que não pode ser movida (Arcologia e indemolíveis)',
  marco: 'ainda não liberado pelo marco',
  nada: 'nada a fazer',
  ocupado: 'já ocupado ou em uso',
  arcologia: 'parte da Arcologia (não se demole)',
  rodovia: 'rodovia do mapa (não se demole)',
  inexistente: 'referência que não existe mais',
  acesso: 'sem frente para uma via',
  recurso: 'sem o recurso natural na planta',
  estoque: 'estoque insuficiente',
  maximo: 'já está no máximo',
  licenca: 'sem licença de ladrilho',
  vizinho: 'ladrilho sem vizinho comprado',
  comprado: 'ladrilho já é da Holding',
  lote: 'lote fora de 1 a 10 (regra do dono)',
  trancado: 'item ou linha trancada',
  pessoal: 'sem trabalhadores para a linha',
  limite: 'limite da janela do Depósito atingido',
  limiteFundo: 'saldo do fundo de teste (D104)',
  inativo: 'recurso temporário desligado',
  limiteAno: 'limite anual do empréstimo (50 mil por ano)',
  limiteDivida: 'dívida acima do máximo (500 mil)',
  emObra: 'etapa já em obra',
  prazo: 'fora do prazo da decisão',
  comando: 'comando desconhecido (núcleo)',
  erro: 'falha interna ao aplicar o comando (núcleo; vai para sim.erros)',
});

export const LISTA_CODIGOS = Object.freeze(Object.keys(CODIGOS));

/**
 * true se c é um código do contrato.
 * @example const r = sim.cmd('emprestimo.tomar', { valor: 60000 }); if (!r.ok && ehCodigo(r.codigo)) mostrar(t(`codigo.${r.codigo}`));
 */
export const ehCodigo = (c) => Object.prototype.hasOwnProperty.call(CODIGOS, c);
