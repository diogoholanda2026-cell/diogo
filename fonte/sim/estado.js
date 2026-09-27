// Montagem da simulação completa: núcleo, tabelas do espelho (células e prédios), grafo das vias, substitutos e o
// ÍNDICE FIXO dos domínios. Cada domínio exporta registrar(sim) e se liga só por registro; a ordem abaixo é a ordem de
// registro (e, dentro da mesma faixa de ORDEM, a ordem dos sistemas no tique). Nenhuma parcela edita este arquivo.
import { criarSim } from './nucleo.js';
import { criarGrafo } from './vias/grafo.js';
import { COLUNAS, TETOS } from '../contratos/espelho.js';
import { CELULA } from '../contratos/flags.js';
import { terrenoPlano, ladrilhosIniciais, definirIdentidade } from './substitutos.js';
import { somarPredios } from './agregados.js';

import * as mundoTerreno from './mundo/terreno.js';
import * as mundoAgua from './mundo/agua.js';
import * as mundoRecursos from './mundo/recursos.js';
import * as mundoFloresta from './mundo/floresta.js';
import * as mundoLadrilhos from './mundo/ladrilhos.js';
import * as mundoAplainar from './mundo/aplainar.js';
import * as mundoVila from './mundo/vila.js';
import * as mundoAreas from './mundo/areas.js';
import * as viasFerramenta from './vias/ferramenta.js';
import * as viasEncaixe from './vias/encaixe.js';
import * as viasValidar from './vias/validar.js';
import * as viasDemolir from './vias/demolir.js';
import * as viasNomes from './vias/nomes.js';
import * as viasPonte from './vias/ponte.js';
import * as zonasBlocos from './zonas/blocos.js';
import * as zonasPincel from './zonas/pincel.js';
import * as zonasDemanda from './zonas/demanda.js';
import * as zonasCrescimento from './zonas/crescimento.js';
import * as predios from './predios.js';
import * as cidadaos from './cidadaos.js';
import * as bemestar from './bemestar.js';
import * as servicos from './servicos.js';
import * as redes from './redes.js';
import * as ambiente from './ambiente.js';
import * as mercadoria from './mercadoria.js';
import * as transito from './transito.js';
import * as tarefasTransito from './tarefas/transito.js';
import * as economia from './economia.js';
import * as progresso from './progresso.js';
import * as objetivos from './objetivos.js';
import * as historia from './historia.js';
import * as holdingProducao from './holding/producao.js';
import * as holdingMercado from './holding/mercado.js';
import * as holdingLogistica from './holding/logistica.js';
import * as arcologia from './arcologia.js';

/** Índice dos domínios, na ordem de registro: [caminho, módulo, parcela dona]. */
export const DOMINIOS = Object.freeze([
  ['mundo/terreno', mundoTerreno, 'S1a'],
  ['mundo/agua', mundoAgua, 'S1a'],
  ['mundo/recursos', mundoRecursos, 'S1a'],
  ['mundo/floresta', mundoFloresta, 'S1a'],
  ['mundo/ladrilhos', mundoLadrilhos, 'S1a'],
  ['mundo/aplainar', mundoAplainar, 'S1a'],
  ['mundo/vila', mundoVila, 'S1a'],
  ['mundo/areas', mundoAreas, 'S1a'],
  ['vias/encaixe', viasEncaixe, 'S1b'],
  ['vias/validar', viasValidar, 'S1b'],
  ['vias/ferramenta', viasFerramenta, 'S1b'],
  ['vias/demolir', viasDemolir, 'S1b'],
  ['vias/nomes', viasNomes, 'S1b'],
  ['vias/ponte', viasPonte, 'X4'],
  ['zonas/blocos', zonasBlocos, 'S1b'],
  ['zonas/pincel', zonasPincel, 'S1b'],
  ['zonas/demanda', zonasDemanda, 'S2a'],
  ['zonas/crescimento', zonasCrescimento, 'S2a'],
  ['predios', predios, 'S2a'],
  ['cidadaos', cidadaos, 'S2a'],
  ['bemestar', bemestar, 'S2a'],
  ['servicos', servicos, 'S2a'],
  ['redes', redes, 'S2a'],
  ['ambiente', ambiente, 'S2b'],
  ['mercadoria', mercadoria, 'S2b'],
  ['tarefas/transito', tarefasTransito, 'S1c'],
  ['transito', transito, 'S1c'],
  ['economia', economia, 'S3a'],
  ['holding/producao', holdingProducao, 'S3a'],
  ['holding/mercado', holdingMercado, 'S3a'],
  ['holding/logistica', holdingLogistica, 'S3a'],
  ['arcologia', arcologia, 'X1b'],
  ['progresso', progresso, 'S3a'],
  ['objetivos', objetivos, 'S3a'],
  ['historia', historia, 'S3a'],
]);

/** Cria as tabelas do espelho que não são do grafo (células e prédios), com o validador células x prédios. */
export function criarTabelasDoEspelho(sim, { capCelulas = 4096, capPredios = 1024 } = {}) {
  const celulas = sim.registrarTabela('celulas', COLUNAS.celulas, capCelulas, { teto: TETOS.celulas, diario: true });
  const predios = sim.registrarTabela('predios', COLUNAS.predios, capPredios, { teto: TETOS.predios, diario: true });
  sim.espelho.celulas = celulas;
  sim.espelho.predios = predios;
  sim.registrarValidador('celulasPredios', () => {
    const erros = [];
    for (let c = 0; c < celulas.n && erros.length < 50; c++) {
      if (!celulas.viva[c]) continue;
      const i = celulas.predio[c];
      const ocupada = celulas.estado[c] === CELULA.OCUPADA;
      if (i < 0 && ocupada) erros.push(`célula ${c} ocupada sem prédio`);
      if (i >= 0 && (!ocupada || i >= predios.n || !predios.viva[i])) erros.push(`célula ${c} com prédio ${i} inválido`);
    }
    return erros;
  });
  return { celulas, predios };
}

/**
 * Cria a simulação do jogo.
 * @param {{ semente?: string | number, mapa?: string, trabalhador?: object | null, cronometro?: () => number,
 *           dominios?: boolean, holding?: { nome: string, cor: string }, modo?: 'normal' | 'livre' }} op
 *   dominios: false monta só a F0 (núcleo, tabelas, grafo e substitutos): é o que a cidade sintética usa.
 * @example const sim = criarSimulacao({ semente: 'heldopolis-1', holding: { nome: 'Held', cor: '#c9a86a' } });
 */
export function criarSimulacao({ semente = 'heldopolis-1', mapa = 'heldopolis', trabalhador = null, cronometro = null, dominios = true, holding = null, modo = null } = {}) {
  const sim = criarSim({ semente, mapa, trabalhador, cronometro });
  criarTabelasDoEspelho(sim);
  criarGrafo(sim);
  if (holding || modo) {
    const id = sim.json.identidade;
    const r = definirIdentidade(sim, { nome: holding?.nome ?? id.nome, cor: holding?.cor ?? id.cor, modo: modo ?? 'normal' });
    if (r !== true && r?.ok !== true) throw new Error(`identidade da Holding inválida (${r})`);
  }
  if (dominios) for (const [, m] of DOMINIOS) m.registrar(sim);
  // substitutos da S1a até ela publicar
  if (!sim.espelho.terreno) sim.espelho.terreno = terrenoPlano();
  if (!sim.espelho.ladrilhos) sim.espelho.ladrilhos = ladrilhosIniciais();
  somarPredios(sim);
  return sim;
}
