// Bits e enumerações do espelho (seção 2.4). Números fixos: vão para o save e para as texturas de dados do render.

/**
 * Bits de predios.flags.
 * @example if (esp.predios.flags[i] & PREDIO.OBRA) desenharCanteiro(i);
 */
export const PREDIO = Object.freeze({
  OBRA: 1 << 0,
  ABANDONADO: 1 << 1,
  SEM_AGUA: 1 << 2,
  SEM_ESGOTO: 1 << 3,
  SEM_ENERGIA: 1 << 4,
  SEM_ACESSO: 1 << 5,
  HOLDING: 1 << 6,
  RACIONADO: 1 << 7,
  OBRA_NIVEL: 1 << 8,
  DEMOLIR_AO_ABANDONAR: 1 << 9,
  SEM_MATERIAL: 1 << 10,
});

/** Bits de arestas.flags. */
export const ARESTA = Object.freeze({
  ARCOLOGIA: 1 << 0,
  RODOVIA: 1 << 1,
  PONTE: 1 << 2,
});

/** predios.tipo */
export const TIPO_PREDIO = Object.freeze({ ZONA: 0, SERVICO: 1, HOLDING: 2 });

/** celulas.estado */
export const CELULA = Object.freeze({ LIVRE: 0, OCUPADA: 1, INVALIDA: 2 });

/** terreno.agua */
export const AGUA = Object.freeze({ TERRA: 0, MAR: 1, RIO: 2, LAGOA: 3 });

/** ladrilhos.estado */
export const LADRILHO = Object.freeze({ TRANCADO: 0, COMPRAVEL: 1, HOLDING: 2 });

/** arcologia.etapas[].estado */
export const ETAPA = Object.freeze({ TRANCADA: 0, DISPONIVEL: 1, EM_OBRA: 2, PRONTA: 3 });

/** arestas.mao: 0 mão dupla, 1 só a para b, -1 só b para a. */
export const MAO = Object.freeze({ DUPLA: 0, AB: 1, BA: -1 });

/** Gravidade dos avisos (Uint8 em q.avisosPredios). */
export const GRAVIDADE = Object.freeze({ info: 0, atencao: 1, grave: 2 });
export const GRAVIDADES = Object.freeze(['info', 'atencao', 'grave']);
