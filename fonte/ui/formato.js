// Formatação dos números e unidades da interface (D42, desenho da UI 5): pt-BR com formatadores guardados; taxas só
// em "/h" (hora de jogo, com a dica fixa); a hora do céu nunca aparece em número (fase: manhã, tarde, fim de tarde,
// noite); calendário com data real, "jan. 2020" (D67); durações de catálogo em "min de jogo"; contagens regressivas
// em mm:ss reais na velocidade atual (pausado: o valor em 1x). Sinal de menos é o U+2212. A palavra "dia" não aparece.
// Dinheiro (D68 e D87): as consultas mandam unidades de desenho e TODA tela mostra em dólar por aqui, pelo fator único
// REGRAS_DONO.moeda ("US$ 30 mi", "US$ 1,2 bi", "US$ 4.800/h"). Nenhuma tela multiplica por conta própria.
import { t } from './textos.js';
import { REGRAS_DONO } from '../data/economia.js';
import { ANO_INICIAL } from '../data/historia.js';

export const MENOS = '−';
/** Moeda da interface (D87): símbolo e quantos dólares vale uma unidade de desenho. */
export const MOEDA = Object.freeze(REGRAS_DONO.moeda ?? { simbolo: 'US$', fator: 600 });

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

/**
 * Número curto em pt-BR, sem sinal: cheio até 9.999 e, daí em diante, mil, mi, bi e tri com uma casa abaixo de 100
 * ('4.800', '12,5 mil', '480 mil', '1,2 mi', '30 mi', '180 mi', '1,2 bi'). O arredondamento que chega a 1.000 passa
 * para a escala de cima ('1 mi', nunca '1.000 mil').
 */
export function curto(a) {
  const v = Math.abs(finito(a));
  if (Math.round(v) < 1e4) return numero(Math.round(v));
  const escalas = [[1e3, 'unid.mil'], [1e6, 'unid.mi'], [1e9, 'unid.bi'], [1e12, 'unid.tri']];
  let k = escalas.findLastIndex(([base]) => v >= base);
  for (;;) {
    const x = v / escalas[k][0];
    const casas = x < 99.95 ? 1 : 0;
    const r = Math.round(x * 10 ** casas) / 10 ** casas;
    if (r >= 1000 && k < escalas.length - 1) {
      k++;
      continue;
    }
    return `${numero(r, r % 1 ? casas : 0)} ${t(escalas[k][1])}`;
  }
}

/** Dólares de um valor em unidades de desenho (D87; só a exibição usa). */
export const dolares = (unidades) => finito(unidades) * MOEDA.fator;

/**
 * Dinheiro em dólar, curto, com o menos quando negativo (D68, D87).
 * @example [dinheiro(50000), dinheiro(8), dinheiro(-2e6)] // ['US$ 30 mi', 'US$ 4.800', '−US$ 1,2 bi']
 */
export function dinheiro(unidades) {
  const v = dolares(unidades);
  const s = `${MOEDA.simbolo} ${curto(v)}`;
  return v < 0 && Math.round(Math.abs(v)) ? MENOS + s : s;
}

/**
 * Dinheiro por hora de jogo, com o sinal sempre (D42): '+US$ 82,4 mi/h', '−US$ 9,6 mi/h', 'US$ 0/h'.
 */
export function dinheiroHora(unidades) {
  const v = dolares(unidades);
  const sinal = Math.round(Math.abs(v)) === 0 ? '' : v < 0 ? MENOS : '+';
  return `${sinal}${MOEDA.simbolo} ${curto(v)}${t('unid.porHora')}`;
}

/** Valor por hora sem sinal, para preços e regras ('US$ 6.600/h'). */
export const dinheiroPorHora = (unidades) => `${MOEDA.simbolo} ${curto(dolares(unidades))}${t('unid.porHora')}`;

/**
 * Unidades de desenho (créditos antigos), sem moeda: só as telas da X2 ainda usam (pendência da U1b: passar para
 * dinheiro). Tela nova não usa.
 */
export const creditos = (n) => numero(Math.round(finito(n)));

/**
 * Unidades de desenho na forma da barra antiga (pendência da X2, como creditos): cheio até 9.999.999, curto depois.
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
 * Ano do calendário (D67): as consultas já mandam 2020 em diante; um ano de jogo (1, 2...) de quem ainda não mandou
 * a data real vira o ano do calendário (o ano 1 é 2020).
 */
export const anoCalendario = (ano) => {
  const a = Math.floor(finito(ano));
  return a >= 1000 ? a : ANO_INICIAL + Math.max(1, a) - 1;
};

/** Mês abreviado ('jan.'), de 1 a 12. */
export const mesCurto = (mes) => t(`cal.mes.${Math.min(12, Math.max(1, Math.floor(finito(mes)) || 1))}`);

/**
 * Calendário (D67): 'jan. 2020'.
 * @param {{ mes: number, ano: number }} data
 */
export const dataCalendario = ({ mes, ano } = {}) => t('cal.data', { mes: mesCurto(mes ?? 1), ano: anoCalendario(ano ?? 1) });

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
