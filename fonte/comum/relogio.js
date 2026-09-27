// Tempo do jogo (D7), calendário e fases do céu (D9). O tique é a unidade inteira da simulação.

export const TIQUE_S = 1; // 1 tique = 1 s de jogo
export const RODADA = 20; // período interno; nunca aparece na interface
export const MES = 600; // um ciclo de sol e lua
export const MESES_ANO = 12;
export const ANO = MES * MESES_ANO; // 7.200 tiques; rege o limite anual do empréstimo
export const HORA = 3600; // hora de jogo: 1 h real em 1x; a "hora" das regras do dono (D8)
export const MINUTO = 60; // minuto de jogo

/** Tiques por segundo real em cada velocidade: pausa, 1x, 2x e 4x. */
export const VELOCIDADES = Object.freeze([0, 1, 2, 4]);
/** Teto de tiques por quadro no laço (sim.avancar). */
export const TIQUES_POR_QUADRO = 8;

export const LATITUDE = -23.5;
/** Hora do céu no começo de cada mês (D9). */
export const HORA_INICIAL = 7;

/** Fases do céu mostradas na interface no lugar da hora (D42). */
export const FASES = Object.freeze(['manha', 'tarde', 'fimDeTarde', 'noite']);
/** Hora (0 a 24) em que cada fase começa. */
export const INICIO_FASE = Object.freeze({ manha: 5, tarde: 12, fimDeTarde: 16.5, noite: 19 });

/**
 * Calendário do tique (mais a fração até o próximo).
 * @example calendario(7800) // { mes: 2, ano: 2, fracMes: 0, tiqueNoMes: 0, mesAbs: 13 }
 */
export function calendario(tique, frac = 0) {
  const t = tique + frac;
  const mesAbs = Math.floor(t / MES); // meses desde o começo, a partir de 0
  const tiqueNoMes = t - mesAbs * MES;
  return {
    mes: (mesAbs % MESES_ANO) + 1,
    ano: Math.floor(mesAbs / MESES_ANO) + 1,
    fracMes: tiqueNoMes / MES,
    tiqueNoMes,
    mesAbs,
  };
}

/** Ano do jogo (1 em diante) de um tique: o que conta o limite anual do empréstimo. */
export const anoDoTique = (tique) => Math.floor(tique / ANO) + 1;

/** Hora do céu, 0 a 24, só para o render (D9): 7h no começo do mês, um ciclo por mês. */
export function horaDoCeu(tique, frac = 0) {
  const { fracMes } = calendario(tique, frac);
  return (HORA_INICIAL + 24 * fracMes) % 24;
}

/** Dia do ano fracionário, 0 a 365, para o astro (D9). */
export function diaDoAno(tique, frac = 0) {
  const { mes, fracMes } = calendario(tique, frac);
  return ((mes - 1 + fracMes) * 365) / 12;
}

/** Fase do céu de uma hora (0 a 24). */
export function faseDaHora(h) {
  if (h >= INICIO_FASE.noite || h < INICIO_FASE.manha) return 'noite';
  if (h >= INICIO_FASE.fimDeTarde) return 'fimDeTarde';
  if (h >= INICIO_FASE.tarde) return 'tarde';
  return 'manha';
}

/**
 * Preenche (ou cria) o objeto espelho.tempo da seção 2.4.
 * @param {number} velocidade índice em VELOCIDADES (0 a 3)
 */
export function tempoDoTique(tique, frac = 0, velocidade = 0, alvo = {}) {
  const c = calendario(tique, frac);
  const hora = (HORA_INICIAL + 24 * c.fracMes) % 24;
  alvo.tique = tique;
  alvo.frac = frac;
  alvo.velocidade = velocidade;
  alvo.mult = VELOCIDADES[velocidade] ?? 0;
  alvo.mes = c.mes;
  alvo.ano = c.ano;
  alvo.fracMes = c.fracMes;
  alvo.hora = hora;
  alvo.fase = faseDaHora(hora);
  alvo.diaDoAno = ((c.mes - 1 + c.fracMes) * 365) / 12;
  if (!alvo.clima) alvo.clima = { nuvens: 0.3, vento: [3, 1] }; // clima fixo no M1
  return alvo;
}

/** Minutos de jogo de uma duração em tiques. */
export const minutosDeJogo = (tiques) => tiques / MINUTO;
/** Tiques de uma duração em minutos de jogo. */
export const tiquesDeMinutos = (min) => Math.round(min * MINUTO);
