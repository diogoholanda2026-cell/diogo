// Camadas de informação (D29): 6 no M1a e mais 7 no M1b. Cada domínio registra a sua com
// sim.camadas.registrar(id, fn) e q.camada(id) devolve o formato abaixo; X3a e X3b mostram.
import { congelar } from '../comum/util.js';

/**
 * @typedef {object} DadosCamada  resposta de q.camada(id)
 * @property {string} id
 * @property {'predios' | 'arestas' | 'grade' | 'celulas'} fonte   o que dados indexa (idx da tabela ou amostra da grade)
 * @property {Float32Array} dados
 * @property {{ n: number, passo: number, origem: number[] } | null} grade
 * @property {'seq' | 'div' | 'cat'} tipo   sequencial, divergente ou categórica
 * @property {{ min: number, max: number, meio?: number, unidade: string }} escala
 * @property {{ v: number, chave: string }[] | null} categorias
 * @property {{ v: number, chave: string }[]} legenda   chaves de texto em ui/textos
 * @property {{ chave: string, params: object }} resumo
 * @property {number} versao   sobe quando os dados mudam
 */

/**
 * Registro: sim.camadas.registrar(id, (sim) => DadosCamada); a consulta é sim.q.camada(id) (null sem registro).
 * @example sim.camadas.registrar('bemEstar', (sim) => ({ id: 'bemEstar', fonte: 'predios', dados, grade: null, tipo: 'seq', escala: { min: 0, max: 100, unidade: '' }, categorias: null, legenda: [], resumo: { chave: 'camada.bemEstar.resumo', params: {} }, versao }));
 */
export const CAMADAS = congelar({
  zonas: { fonte: 'celulas', tipo: 'cat', parte: 'M1a', dono: 'S2a' },
  bemEstar: { fonte: 'predios', tipo: 'seq', parte: 'M1a', dono: 'S2a' },
  agua: { fonte: 'predios', tipo: 'cat', parte: 'M1a', dono: 'S2a' },
  energia: { fonte: 'predios', tipo: 'cat', parte: 'M1a', dono: 'S2a' },
  servicos: { fonte: 'arestas', tipo: 'seq', parte: 'M1a', dono: 'S2a' },
  recursos: { fonte: 'grade', tipo: 'seq', parte: 'M1a', dono: 'S1a (obras paradas: X3a)' },
  valor: { fonte: 'grade', tipo: 'seq', parte: 'M1b', dono: 'S2a' },
  esgoto: { fonte: 'predios', tipo: 'cat', parte: 'M1b', dono: 'S2b' },
  transito: { fonte: 'arestas', tipo: 'seq', parte: 'M1b', dono: 'S1c' },
  ar: { fonte: 'grade', tipo: 'seq', parte: 'M1b', dono: 'S2b' },
  ruido: { fonte: 'grade', tipo: 'seq', parte: 'M1b', dono: 'S2b' },
  nivel: { fonte: 'predios', tipo: 'cat', parte: 'M1b', dono: 'S2a' },
  empregos: { fonte: 'predios', tipo: 'div', parte: 'M1b', dono: 'S2b' },
});

export const LISTA_CAMADAS = Object.freeze(Object.keys(CAMADAS));
