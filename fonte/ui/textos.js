// Textos da interface (desenho da UI 12.8, D42): todas as frases por chave, em português do Brasil, sem travessão.
// Cada parcela escreve as suas em fonte/ui/textos/<parcela>.js (registrar(registrarTextos)); este índice é fixo.
// t(chave, params) troca {nome} pelos parâmetros; chave sem texto aparece como '??chave' (a vitrine acusa).
import * as f0 from './textos/f0.js';
import * as r1 from './textos/r1.js';
import * as s1 from './textos/s1.js';
import * as s2 from './textos/s2.js';
import * as s3 from './textos/s3.js';
import * as u1 from './textos/u1.js';
import * as u2 from './textos/u2.js';
import * as x1 from './textos/x1.js';
import * as x2 from './textos/x2.js';
import * as x3 from './textos/x3.js';

const MODULOS = [f0, r1, s1, s2, s3, u1, u2, x1, x2, x3];

const textos = new Map();
const donos = new Map();
const repetidas = [];

/**
 * Registra as frases de uma parcela. Uma chave já registrada por OUTRA parcela é erro de montagem (fica em
 * chavesRepetidas() e o teste acusa); a mesma parcela pode trocar as suas.
 * @param {string} parcela  'f0', 'u1', 's3'...
 * @param {Record<string, string>} mapa
 */
export function registrarTextos(parcela, mapa) {
  for (const [k, v] of Object.entries(mapa)) {
    const dono = donos.get(k);
    if (dono && dono !== parcela) repetidas.push(`${k} (${dono} e ${parcela})`);
    textos.set(k, String(v));
    donos.set(k, parcela);
  }
}

for (const m of MODULOS) m.registrar?.(registrarTextos);

/**
 * Frase da chave com os parâmetros.
 * @example t('data.mesAno', { mes: 3, ano: 2 }) // 'Mês 3 · Ano 2'
 */
export function t(chave, params = null) {
  const s = textos.get(chave);
  if (s === undefined) return `??${chave}`;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] === undefined || params[k] === null ? m : String(params[k])));
}

/** true se a chave tem frase. */
export const temTexto = (chave) => textos.has(chave);

/** Todas as chaves (testes). */
export const chaves = () => [...textos.keys()];

/** Chaves registradas por duas parcelas (testes). */
export const chavesRepetidas = () => [...repetidas];
