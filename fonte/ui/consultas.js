// Consultas da interface (D16): síncronas, puras, pela API sim.q da simulação atual (ou da simulação falsa da vitrine).
// Uma consulta que ninguém registrou ainda (a parcela dona não chegou) devolve null, e a tela mostra o vazio.
import { LISTA_CONSULTAS } from '../contratos/consultas.js';

let obterSim = () => null;

/** Liga as consultas à simulação atual. */
export function ligarConsultas(fn) {
  obterSim = fn;
}

/**
 * Chama sim.q.<nome>(...args); nomes com ponto ('via.previa') andam pelos objetos. null se não existir ou falhar.
 * @example consultar('predio', ref)
 */
export function consultar(nome, ...args) {
  const q = obterSim()?.q;
  if (!q) return null;
  let fn = q;
  for (const parte of nome.split('.')) fn = fn?.[parte];
  if (typeof fn !== 'function') return null;
  try {
    return fn(...args);
  } catch (e) {
    console.error(`consulta ${nome}:`, e);
    return null;
  }
}

/** Atalhos com os nomes do contrato: consultas.predio(ref), consultas.via.previa(plano)... */
export const consultas = {};
for (const nome of LISTA_CONSULTAS) {
  const partes = nome.split('.');
  let alvo = consultas;
  for (let i = 0; i < partes.length - 1; i++) alvo = alvo[partes[i]] ?? (alvo[partes[i]] = {});
  alvo[partes[partes.length - 1]] = (...args) => consultar(nome, ...args);
}
