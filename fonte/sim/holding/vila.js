// Requalificação da Vila de Santa Cida pela Holding (D95, objetivo de Legado `cidade.vilaNova` do Ato 1; dona: S3b).
//
// A Vila nasce com as casas de autoconstrução (modelos com area 'vila' em data/predios.js). Quando o objetivo se cumpre
// (as casas ligadas às redes, bem-estar médio e caixa para a reforma), a Holding paga e as casas passam ao padrão alto
// pelo mapa REQUALIFICACAO_VILA (casaEsquina, casaGeminada e casa viram casaJardim; casaFundo e sobrado viram casaPatio):
// troca o modelo, mantém o lote, a semente, o nível e os moradores (a família continua em casa durante a obra), e abre uma
// obra de reforma (OBRA e OBRA_NIVEL: o prédio segue funcionando, a S2a fecha a obra no fim). O método (reformar ou
// substituir) vem da decisão `vila.futuro`: define o custo por casa e o prazo. Determinístico: nada sorteia, a ordem é a
// da tabela de prédios.
import { VILA_NOVA } from '../../data/historia.js';
import { REQUALIFICACAO_VILA, PREDIOS_ORDEM, PREDIOS, ehDaVila, nivelDoModelo } from '../../data/predios.js';
import { PREDIO, TIPO_PREDIO } from '../../contratos/flags.js';
import { finito, postarMural } from './base.js';

const H = (sim) => sim.json.historia;

/** Método escolhido na decisão vila.futuro ('reformar' | 'substituir'); sem decisão, o padrão. */
export function metodoDaVila(sim) {
  const marcas = H(sim)?.marcas ?? [];
  for (const m of Object.keys(VILA_NOVA.metodos)) if (marcas.includes(`vila.futuro:${m}`)) return m;
  return VILA_NOVA.padrao;
}

/** Índices (idx) das casas da Vila que ainda são de autoconstrução e têm modelo de destino. Ordem da tabela. */
export function casasDaVila(sim) {
  const P = sim.tabelas.predios;
  const out = [];
  if (!P) return out;
  for (const ref of sim.json.mapa?.predios ?? []) {
    if (!P.vivaRef?.(ref)) continue;
    const i = ref % 1048576;
    const id = PREDIOS_ORDEM[P.modelo[i]];
    if (P.tipo[i] === TIPO_PREDIO.ZONA && ehDaVila(P.modelo[i]) && REQUALIFICACAO_VILA[id]) out.push(i);
  }
  return out.sort((a, b) => a - b);
}

/** Todas as casas da Vila vivas (para a taxa de ligação às redes): as de autoconstrução e as já reformadas. */
function casasVivas(sim) {
  const P = sim.tabelas.predios;
  const out = [];
  if (!P) return out;
  for (const ref of sim.json.mapa?.predios ?? []) {
    if (!P.vivaRef?.(ref)) continue;
    const i = ref % 1048576;
    if (P.tipo[i] !== TIPO_PREDIO.ZONA || PREDIOS[PREDIOS_ORDEM[P.modelo[i]]]?.zona !== 'resBaixa') continue;
    out.push(i);
  }
  return out;
}

/**
 * Situação da requalificação (puro): { restantes (casas a reformar), reformadas, servidas, total, rede (fração),
 * bemEstar (média das casas da Vila), custo (créditos), metodo, obraTiques, pronta (os três critérios), requalificada }.
 */
export function estadoVila(sim) {
  const P = sim.tabelas.predios;
  const ag = sim.agregados;
  const metodo = metodoDaVila(sim);
  const m = VILA_NOVA.metodos[metodo];
  const restantes = casasDaVila(sim);
  const vivas = casasVivas(sim);
  let servidas = 0;
  let soma = 0;
  for (const i of vivas) {
    if (!(P.flags[i] & (PREDIO.SEM_AGUA | PREDIO.SEM_ENERGIA | PREDIO.ABANDONADO))) servidas++;
    soma += P.bemEstar ? finito(P.bemEstar[i]) : finito(ag.bemEstarMedio);
  }
  const total = vivas.length;
  const redes = finito(ag.redes?.agua?.oferta) > 0 && finito(ag.redes?.energia?.oferta) > 0;
  const rede = total > 0 && redes ? servidas / total : 0;
  const bemEstar = total > 0 ? soma / total : 0;
  const custo = restantes.length * m.custoPorCasa;
  const criterios = {
    rede: rede >= VILA_NOVA.redeMin,
    bemEstar: bemEstar >= VILA_NOVA.bemEstarMin,
    caixa: sim.holding.caixa() >= custo,
  };
  const requalificada = !!H(sim)?.vilaNova;
  return {
    restantes: restantes.length, total, servidas, rede, bemEstar, custo, metodo, obraTiques: m.obraTiques, criterios,
    pronta: restantes.length > 0 && criterios.rede && criterios.bemEstar && criterios.caixa,
    requalificada,
  };
}

/**
 * Requalifica a Vila: a Holding paga a reforma de todas as casas de autoconstrução e elas passam ao padrão alto. Devolve
 * true se fez; false se faltou caixa (nada muda) ou não há o que reformar.
 */
export function requalificarVila(sim) {
  const P = sim.tabelas.predios;
  const h = H(sim);
  const casas = casasDaVila(sim);
  if (!h || !casas.length) return false;
  const metodo = metodoDaVila(sim);
  const m = VILA_NOVA.metodos[metodo];
  const custo = casas.length * m.custoPorCasa;
  if (!sim.holding.pagar(custo, 'vilaNova')) return false;
  for (const i of casas) {
    const novo = REQUALIFICACAO_VILA[PREDIOS_ORDEM[P.modelo[i]]];
    P.modelo[i] = PREDIOS_ORDEM.indexOf(novo);
    const nv = nivelDoModelo(P.modelo[i], P.nivel[i] || 1);
    // a família fica (até a capacidade da casa nova); o resto chega pela demanda, como em qualquer casa
    P.moradores[i] = Math.min(P.moradores[i], nv.moradores);
    if (P.pontos) P.pontos[i] = 0;
    P.flags[i] |= PREDIO.OBRA | PREDIO.OBRA_NIVEL;
    P.flags[i] &= ~PREDIO.SEM_MATERIAL;
    P.obraIni[i] = sim.tique;
    P.obraFim[i] = sim.tique + m.obraTiques;
    P.marcar(i);
  }
  h.vilaNova = { tique: sim.tique, casas: casas.length, metodo, custo };
  postarMural(sim, 'cida', `s3.mural.vilaNova.${metodo}`, { n: casas.length }, null, 200);
  sim.mudancas.marcar('holding');
  return true;
}

/** q.vilaNova(): a situação para o cartão do objetivo e a tela Cidade (puro). */
export function consultaVilaNova(sim) {
  const e = estadoVila(sim);
  const h = H(sim)?.vilaNova ?? null;
  return { ...e, criterios: { ...e.criterios }, feita: h ? { ...h } : null, objetivo: VILA_NOVA.objetivo };
}
