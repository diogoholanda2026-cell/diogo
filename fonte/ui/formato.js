// Formatação dos números e unidades da interface (D42, desenho da UI 5): pt-BR com formatadores guardados; taxas só
// em "/h" (hora de jogo, com a dica fixa); a hora do céu nunca aparece em número (fase: manhã, tarde, fim de tarde,
// noite); calendário "Mês 3 · Ano 2"; durações de catálogo em "min de jogo"; contagens regressivas em mm:ss reais na
// velocidade atual (pausado: o valor em 1x). Sinal de menos é o U+2212. A palavra "dia" não aparece.
import { t } from './textos.js';

export const MENOS = '−';

const formatadores = new Map();
function nf(casas) {
  let f = formatadores.get(casas);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    formatadores.set(casas, f);
  }
  return f;
}

const finito = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/**
 * Número em pt-BR, com o menos tipográfico.
 * @example numero(12480) // '12.480'
 */
export function numero(n, casas = 0) {
  const v = finito(n);
  const s = nf(casas).format(Math.abs(v));
  return v < 0 && s !== nf(casas).format(0) ? MENOS + s : s;
}

/** Créditos cheios ('284.500'). */
export const creditos = (n) => numero(Math.round(finito(n)));

/**
 * Créditos na barra de cima: cheio até 9.999.999, curto a partir de 10 milhões ('128,4 mi').
 * @example creditosBarra(128400000) // '128,4 mi'
 */
export function creditosBarra(n) {
  const v = finito(n);
  const a = Math.abs(v);
  if (a >= 1e10) return `${numero(v / 1e9, 1)} ${t('unid.bi')}`;
  if (a >= 1e7) return `${numero(v / 1e6, 1)} ${t('unid.mi')}`;
  return numero(Math.round(v));
}

/** Sinal sempre visível ('+3.840', '−12.300', '0'). */
export function comSinal(n, casas = 0) {
  const v = finito(n);
  const s = numero(Math.abs(v), casas);
  if (s === numero(0, casas)) return s;
  return (v < 0 ? MENOS : '+') + s;
}

/**
 * Taxa por hora de jogo (D42), com sinal ('+3.840/h').
 * @example porHora(-12300) // '−12.300/h'
 */
export function porHora(n) {
  const v = finito(n);
  const a = Math.abs(v);
  const corpo = a >= 1e7 ? `${numero(a / 1e6, 1)} ${t('unid.mi')}` : numero(Math.round(a));
  const sinal = Math.round(a) === 0 ? '' : v < 0 ? MENOS : '+';
  return `${sinal}${corpo}${t('unid.porHora')}`;
}

/** População ('12.480'). */
export const populacao = (n) => numero(Math.round(finito(n)));

/** Fração 0..1 em porcentagem ('72%'). */
export const pct = (x, casas = 0) => `${numero(finito(x) * 100, casas)}%`;

/**
 * Calendário (D42): 'Mês 3 · Ano 2'.
 * @param {{ mes: number, ano: number }} data
 */
export const dataCalendario = ({ mes, ano } = {}) => t('data.mesAno', { mes: mes ?? 1, ano: ano ?? 1 });

/** Nome da fase do céu ('Fim de tarde'). */
export const fase = (f) => t(`fase.${f || 'manha'}`);

/** Glifo da fase: sol de manhã e à tarde, sol baixo no fim de tarde, lua à noite. */
export const glifoDaFase = (f) => (f === 'noite' ? 'lua' : f === 'fimDeTarde' ? 'solBaixo' : 'sol');

/**
 * Duração de catálogo em minutos de jogo (60 tiques por minuto): '5 min de jogo'.
 * @example minutosDeJogo(300) // '5 min de jogo'
 */
export function minutosDeJogo(tiques) {
  const m = finito(tiques) / 60;
  return t('unid.minJogo', { n: numero(m, m < 10 && m % 1 ? 1 : 0) });
}

/**
 * Contagem regressiva em tempo REAL na velocidade atual: 'mm:ss' (ou 'h:mm:ss'). mult 0 (pausado) conta como 1x.
 * @param {number} tiques  tiques de jogo que faltam
 * @param {number} mult    tiques por segundo real (0, 1, 2 ou 4)
 */
export function contagem(tiques, mult = 1) {
  const seg = Math.max(0, Math.ceil(finito(tiques) / (mult > 0 ? mult : 1)));
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  const dd = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${dd(m)}:${dd(s)}` : `${dd(m)}:${dd(s)}`;
}

/** Duração real curta: '2 min 6 s', '45 s', '1 h 5 min'. */
export function duracaoReal(seg) {
  const v = Math.max(0, Math.round(finito(seg)));
  const h = Math.floor(v / 3600);
  const m = Math.floor((v % 3600) / 60);
  const s = v % 60;
  if (h) return `${h} ${t('unid.h')}${m ? ` ${m} ${t('unid.min')}` : ''}`;
  if (m) return `${m} ${t('unid.min')}${s ? ` ${s} ${t('unid.s')}` : ''}`;
  return `${s} ${t('unid.s')}`;
}

/** A dica fixa de toda taxa "/h" (D42). */
export const dicaHora = () => t('dica.hora');
