// Mercadoria agregada do M1b, dona: S2b (seção 6.4 do desenho da simulação, D48). A indústria zoneada produz mercadoria
// (empregos ocupados x unidades por hora de jogo, mais 8% por nível), o comércio consome (empregos ocupados x unidades por
// hora) e a falta é importada pela rodovia a 160% do preço base, uma despesa corrente da ligação externa (a mesma conta
// da importação da Holding, D25). O que a cidade não produz entra em S.agregados.mercadoria { producao, consumo,
// importada, excedente } (unidades por hora), alimenta o fator "mercadoria que o comércio pede" da demanda da indústria
// (zonas/demanda.js) e aparece no painel de demanda (q.demanda().mercadoria) e na tela Cidade. Uma vez por rodada.
// Só vale com o M1b no jogo (m1bAtivo): antes dele a mercadoria é null, nada se cobra e a demanda da indústria segue a
// regra das vagas do M1a. Nenhuma regra do dono (REGRAS_DONO) muda.
import { RODADA } from '../comum/relogio.js';
import { TIPO_PREDIO } from '../contratos/flags.js';
import { ORDEM } from '../contratos/interno.js';
import { MERCADORIA } from '../data/mercadoria.js';
import { prepararCidade, funciona, FAMILIA_ZONA, m1bAtivo, registrarAlertas } from './predios.js';
import { ocupacaoDe } from './cidadaos.js';

const arred = (v) => Math.round(v * 10) / 10;

/** Produção e consumo da cidade agora (puro): { producao, consumo, importada, excedente } em unidades por hora de jogo. */
export function balancoMercadoria(sim) {
  const P = sim.tabelas.predios;
  let producao = 0;
  let consumo = 0;
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA || !funciona(P, i)) continue;
    const fam = FAMILIA_ZONA[P.zona[i]];
    if (fam !== 'ind' && fam !== 'com') continue;
    const oc = ocupacaoDe(sim, i).ocupadas;
    if (fam === 'ind') producao += oc * MERCADORIA.producaoPorEmprego * (1 + MERCADORIA.nivelProducao * (P.nivel[i] - 1));
    else consumo += oc * MERCADORIA.consumoPorEmprego;
  }
  return {
    producao: arred(producao), consumo: arred(consumo), importada: arred(Math.max(0, consumo - producao)),
    excedente: arred(Math.max(0, producao - consumo)),
  };
}

/** Despesa por hora de jogo com a mercadoria importada (unidades de desenho; 0 antes do M1b). */
export function custoImportacao(sim) {
  const m = sim.agregados.mercadoria;
  return m && m1bAtivo() ? m.importada * MERCADORIA.preco * MERCADORIA.fatorImportacao : 0;
}

/** Uma vez por rodada: refaz o balanço e o escreve em S.agregados.mercadoria. */
export function sistemaMercadoria(sim) {
  if (!m1bAtivo()) {
    if (sim.agregados.mercadoria) sim.agregados.mercadoria = null;
    return;
  }
  sim.agregados.mercadoria = balancoMercadoria(sim);
}

function alertasMercadoria(sim) {
  const m = m1bAtivo() ? sim.agregados.mercadoria : null;
  if (!m || m.consumo < MERCADORIA.alerta.consumoMin || m.importada < MERCADORIA.alerta.fracao * m.consumo) return [];
  return [{
    id: 'mercadoria', gravidade: 'atencao', glifo: 'semMercadoria', codigo: 'mercadoriaImportada',
    params: { pct: Math.round((100 * m.importada) / m.consumo), importada: m.importada, consumo: m.consumo }, alvo: { tela: 'cidade' },
  }];
}

export function registrar(sim) {
  if (!sim.tabelas.predios || !sim.grafo) return;
  prepararCidade(sim);
  // depois do mercado de trabalho (cidadaos, fase 5) e antes da economia: as vagas ocupadas já são as desta rodada
  sim.registrarSistema(RODADA, 12, sistemaMercadoria, 1, { nome: 'mercadoria', ordem: ORDEM.servicos + 60 });
  // despesa corrente da ligação externa (a rodovia): a economia soma em "ligação"
  sim.custos.registrar('ligacao.mercadoria', custoImportacao);
  registrarAlertas(alertasMercadoria);
}
