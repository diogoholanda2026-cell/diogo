// Formato do save (seção 2.9, D31). Implementação: fonte/sim/salvar/formato.js (F0); IndexedDB e diário: U2a.
//
// Arquivo .held = gzip (ou cru, no segundo plano) de:
//   'HELD' (4 bytes) | u16 formato = 1 | u16 bandeiras (bit 0: comprimido) | u32 bytes do JSON   (little-endian)
//   JSON UTF-8 (CABECALHO abaixo) | zeros até múltiplo de 8
//   área binária: seções alinhadas em 8; offset de cada seção relativo ao começo da área binária.
// A grade de alturas não vai: sai da semente e do aplainar() sobre as formas salvas.
import { congelar } from '../comum/util.js';

/**
 * @example
 * const bytes = await salvar(sim, { nome: 'Partida 1', criado: Date.now() });   // no app (fonte/sim não lê relógio)
 * const { sim: nova, erros } = await abrirSave(bytes, (op) => criarSimulacao(op));
 */
export const SAVE = congelar({
  magica: 'HELD',
  formato: 1, // leiaute binário
  versaoSave: 1, // versão dos dados; MIGRACOES[v] leva de v para v + 1
  bandeiras: { comprimido: 1 },
  jogo: 'arcologia-de-held',
  alinhamento: 8,
  cabecalhoBytes: 12,
  banco: 'heldopolis', // IndexedDB (U2a): lojas saves e meta
  lojas: ['saves', 'meta'],
  chaves: { ultimo: 'heldopolis.ultimo', prefs: 'heldopolis.prefs', diario: 'heldopolis.diario' },
  vagas: { automaticos: 3, manuais: 8 },
  capa: [640, 288],
  extensao: '.held',
});

/** Tipos das seções binárias. */
export const TIPOS_SECAO = congelar({
  f64: 'Float64Array', f32: 'Float32Array', i32: 'Int32Array', u32: 'Uint32Array',
  i16: 'Int16Array', u16: 'Uint16Array', i8: 'Int8Array', u8: 'Uint8Array',
});

/**
 * @typedef {object} Secao
 * @property {string} nome     'tabela.coluna' (ex.: 'predios.x', 'predios.viva'), 'grade.floresta', 'est.<caminho>'
 * @property {string} tipo     chave de TIPOS_SECAO
 * @property {number} n        elementos
 * @property {number} bytes
 * @property {number} offset   relativo ao começo da área binária, múltiplo de 8
 */

/**
 * @typedef {object} Cabecalho   JSON do save
 * @property {number} versaoSave
 * @property {'arcologia-de-held'} jogo
 * @property {string} mapa
 * @property {string | number} semente
 * @property {number} tique
 * @property {number} criado       carimbo do app (a simulação não lê relógio)
 * @property {string} nome
 * @property {{ nome: string, cor: string }} holding
 * @property {{ modo: 'normal' | 'livre' }} partida
 * @property {{ plano: string | null }} arcologia
 * @property {{ tique: number, seq: number, rng: Record<string, number[]> }} nucleo   estado do núcleo e dos sorteios
 * @property {Record<string, object>} json   seções registradas com registrarJson (arrays tipados viram { $bin: nome })
 * @property {Record<string, { n: number, alto: number, cap: number, colunas: string[] }>} tabelas
 * @property {Record<string, { n: number | null, passo: number | null, tamanho: number }>} grades
 * @property {{ seq: number, lista: object[] }} formas         formas do aplainar (D5)
 * @property {{ seq: number, pendentes: object[] }} tarefas    tarefas pendentes do worker (D15), com a entrada copiada
 * @property {object[]} livro      últimos comandos [tique, seq, nome, args]
 * @property {{ camera: object | null, velocidade: number }} vista
 * @property {number} hash         hash do estado no momento do save (conferido ao carregar)
 * @property {Secao[]} secoes
 */

/**
 * Carregar (U2a usa, a F0 implementa em salvar/formato.js): confere cabeçalho e versão, aplica MIGRACOES em ordem, monta
 * numa simulação NOVA com a mesma semente, roda validar(sim) (células x prédios, grafo sem aresta órfã, dívida igual à
 * soma dos contratos, caixa não negativo), reproduz o diário até o tique gravado e só então troca.
 */
export const REGRAS_CARREGAR = congelar(['cabecalho', 'versao', 'migrar', 'simulacaoNova', 'validar', 'diario', 'trocar']);
