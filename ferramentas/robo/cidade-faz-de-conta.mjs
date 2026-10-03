// Peças de teste da S3a (dona: S3a; não entra no jogo): a simulação só com os domínios da S3a (para as regras do dono
// não dependerem de nada) e a "cidade de faz de conta" pelos agregados, que roda enquanto a S2a (cidade viva) não
// publica a dela. O robô (robo-sim.mjs) e os testes (ferramentas/testes/*.teste.mjs da S3a) usam.
//
// A cidade de faz de conta desliga o substituto de agregados da F0 e, a cada rodada, escreve sim.agregados a partir
// das células zoneadas de verdade (S1b), dos serviços que o robô "pôs" (pagos e com manutenção por sim.custos) e de um
// crescimento limitado; cada leva de casas compra material pela Holding (D48), então espera quando falta.
import { criarSimulacao } from '../../fonte/sim/estado.js';
import * as economia from '../../fonte/sim/economia.js';
import * as producao from '../../fonte/sim/holding/producao.js';
import * as mercado from '../../fonte/sim/holding/mercado.js';
import * as logistica from '../../fonte/sim/holding/logistica.js';
import * as progresso from '../../fonte/sim/progresso.js';
import * as objetivos from '../../fonte/sim/objetivos.js';
import * as historia from '../../fonte/sim/historia.js';
import { instalarConstruirHolding } from '../../fonte/sim/holding/substituto.js';
import { TIPO_PREDIO, PREDIO } from '../../fonte/contratos/flags.js';
import { refDe } from '../../fonte/contratos/espelho.js';
import { HOLDING_ORDEM, PREDIOS_HOLDING, vagasDoNivel } from '../../fonte/data/holding.js';
import { ZONAS_ORDEM } from '../../fonte/data/zonas.js';
import { tarifaDoBemEstar } from '../../fonte/data/economia.js';
import { SERVICOS } from '../../fonte/data/servicos.js';

/** Domínios da S3a na ordem do índice (fonte/sim/estado.js). */
export const DOMINIOS_S3A = [economia, producao, mercado, logistica, progresso, objetivos, historia];

/** Simulação com o núcleo da F0 e só os domínios da S3a (sem mapa, sem cidade). */
export function simS3a({ semente = 's3a', populacao = 0, bemEstar = 50 } = {}) {
  const sim = criarSimulacao({ semente, dominios: false });
  for (const m of DOMINIOS_S3A) m.registrar(sim);
  instalarConstruirHolding(sim);
  if (populacao || bemEstar !== 50) fixarCidade(sim, { populacao, bemEstar });
  return sim;
}

/** Desliga o substituto de agregados e fixa moradores e bem-estar (testes). */
export function fixarCidade(sim, { populacao = 0, bemEstar = 50, agua = 0, energia = 0 } = {}) {
  sim.implementar('agregados', {});
  const ag = sim.agregados;
  ag.populacao = populacao;
  ag.lares = Math.round(populacao / 3);
  ag.bemEstarMedio = bemEstar;
  ag.bemEstarTarifa = Math.round(bemEstar);
  ag.tarifa = tarifaDoBemEstar(bemEstar);
  ag.redes.agua.oferta = agua;
  ag.redes.energia.oferta = energia;
  return ag;
}

/**
 * Põe um prédio da Holding direto na tabela (sem o comando construir), já pronto. Devolve a ref.
 * @example const ref = predioHolding(sim, 'pedreira', 100, 0)
 */
export function predioHolding(sim, tipo, x = 0, z = 0, { obra = false } = {}) {
  const P = sim.tabelas.predios;
  const def = PREDIOS_HOLDING[tipo];
  const i = P.alocar();
  P.tipo[i] = TIPO_PREDIO.HOLDING;
  P.modelo[i] = HOLDING_ORDEM.indexOf(tipo);
  P.x[i] = x;
  P.z[i] = z;
  P.w[i] = def.planta[0];
  P.d[i] = def.planta[1];
  P.nivel[i] = 1;
  P.flags[i] = PREDIO.HOLDING | (obra ? PREDIO.OBRA : 0);
  P.obraIni[i] = sim.tique;
  P.obraFim[i] = obra ? sim.tique + def.obraTiques : 0;
  P.empregos[i] = vagasDoNivel(tipo, 1).reduce((a, b) => a + b, 0);
  P.marcar(i);
  producao.sincronizar(sim);
  producao.recalcular(sim);
  return refDe(i, P.ger[i]);
}

/** Serviços que a cidade de faz de conta conhece (custo e manutenção por hora de partida, seção 8.1 do desenho). */
export const SERVICOS_FALSOS = Object.freeze({
  captacao: { custo: 25000, manut: 700, agua: 5000 },
  poco: { custo: 6000, manut: 200, agua: 800 },
  usinaSolar: { custo: 20000, manut: 600, energia: 4000 },
  praca: { custo: 4000, manut: 150, lazer: 3 },
  clinica: { custo: 30000, manut: 800, saude: 8, marco: 1 },
  escolaF: { custo: 30000, manut: 900, educacao: 6, marco: 1 },
  delegacia: { custo: 20000, manut: 700, seguranca: 6, marco: 1 },
  bombeiros: { custo: 25000, manut: 800, bombeiros: 4, marco: 2 },
});

/** Materiais de uma leva de casas (5 moradores) por nível (calibrar com o catálogo da S2a). */
const MATERIAIS_LEVA = [
  { tijolo: 1, cimento: 1 },
  { tijolo: 2, serrada: 1, cimento: 1 },
  { concreto: 1, tijolo: 1, vidro: 1 },
  { concreto: 2, vidro: 1, aco: 1 },
  { concreto: 3, vidro: 1, aco: 1 },
];

/**
 * Liga a cidade de faz de conta. Devolve { estado, porServico(tipo) } para o robô "pôr" serviços.
 * Moradores por célula: residencial baixa 1,3; média 5. Crescimento até `taxa` moradores por rodada.
 */
export function ligarCidadeFalsa(sim, { moradoresIniciais = 350, taxa = 22 } = {}) {
  sim.implementar('agregados', {});
  // com a cidade da S2a no índice, os sistemas dela (zonas, cidade, serviços: ordem 300 a 599) também escreveriam os
  // agregados e comprariam material: a de faz de conta os desliga
  for (const s of sim._sistemas ?? []) if (s.ordem >= 300 && s.ordem < 600) s.ativo = false;
  const E = { pop: moradoresIniciais, servicos: {}, levas: 0, esperas: 0, compradas: 0, capacidade: moradoresIniciais };
  const ag = sim.agregados;
  const rz = ZONAS_ORDEM.indexOf('resBaixa');
  const rm = ZONAS_ORDEM.indexOf('resMedia');
  const cb = ZONAS_ORDEM.indexOf('comBaixa');
  const ind = ZONAS_ORDEM.indexOf('industria');
  const soma = (k) => Object.entries(E.servicos).reduce((a, [t, n]) => a + (SERVICOS_FALSOS[t][k] ?? 0) * Math.min(n, 1 + Math.floor(E.pop / 6000)), 0);
  sim.custos.registrar('servicos.fazDeConta', () => Object.entries(E.servicos).reduce((a, [t, n]) => a + SERVICOS_FALSOS[t].manut * n, 0));

  function rodada() {
    // sem os sistemas da S2a, as obras dos colocáveis terminam aqui
    const P = sim.tabelas.predios;
    for (let i = 0; i < P.n; i++) {
      if (P.viva[i] && P.tipo[i] !== TIPO_PREDIO.ZONA && P.flags[i] & PREDIO.OBRA && P.obraFim[i] && sim.tique >= P.obraFim[i]) {
        P.flags[i] &= ~PREDIO.OBRA;
        P.marcar(i);
      }
    }
    const C = sim.tabelas.celulas;
    let celRb = 0;
    let celRm = 0;
    let celCom = 0;
    if (C) {
      for (let i = 0; i < C.n; i++) {
        if (!C.viva[i]) continue;
        const z = C.zona[i];
        if (z === rz) celRb++;
        else if (z === rm) celRm++;
        else if (z === cb || z === ind) celCom++;
      }
    }
    // os produtores registrados na rede (o reservatório do Mirror Lake, lago.e1) contam na escala da captação: a
    // capacidade em m³/h da S2a vezes o que a captação de faz de conta dá por m³/h
    const extra = (rec) => (sim.redes?.produtores ? sim.redes.produtores(rec).reduce((a, p) => a + (+p.capacidade || 0), 0) : 0);
    const agua = soma('agua') + extra('agua') * (SERVICOS_FALSOS.captacao.agua / (SERVICOS.captacao?.capacidade || 30));
    const energia = soma('energia') + extra('energia') * (SERVICOS_FALSOS.usinaSolar.energia / (SERVICOS.solar?.capacidade || 8000));
    const temAgua = agua > 0 && agua >= E.pop * 0.5;
    const temEnergia = energia > 0;
    let be = 40 - (temAgua ? 0 : 25) - (temEnergia ? 0 : 25);
    be += Math.min(8, soma('saude')) + Math.min(6, soma('educacao')) + Math.min(6, soma('seguranca')) + Math.min(4, soma('bombeiros'));
    be += Math.min(6, soma('lazer'));
    be += celCom > 0 ? 4 : 0;
    be = Math.max(0, Math.min(100, be));
    // a Vila conta como capacidade desde o começo
    E.capacidade = moradoresIniciais + celRb * 1.3 + celRm * 5;
    const demanda = temAgua && temEnergia ? 1 : 0.15;
    let cresce = Math.min(E.capacidade - E.pop, taxa * demanda);
    if (cresce > 0) {
      const levas = Math.max(1, Math.round(cresce / 5));
      const marco = sim.progresso.marco().n;
      for (let k = 0; k < levas; k++) {
        E.levas++;
        const nivel = marco >= 3 && E.levas % 3 === 0 ? 3 + (E.levas % 2) : 1 + (E.levas % 2);
        const r = sim.holding.comprarParaObra(-1, nivel, MATERIAIS_LEVA[nivel - 1]);
        if (r.espera) {
          E.esperas++;
          cresce = (k * cresce) / levas;
          break;
        }
        E.compradas++;
      }
      E.pop += cresce;
    }
    const pop = Math.floor(E.pop);
    ag.populacao = pop;
    ag.lares = Math.round(pop / 3);
    // média suavizada (D11): aproxima o bem-estar de agora em 1 mês de jogo
    ag.bemEstarMedio += (be - ag.bemEstarMedio) * (20 / 600) * 3;
    if (!(ag.bemEstarMedio > 0)) ag.bemEstarMedio = be;
    ag.bemEstarTarifa = Math.round(ag.bemEstarMedio);
    ag.tarifa = tarifaDoBemEstar(ag.bemEstarTarifa);
    ag.redes.agua.oferta = agua;
    ag.redes.agua.demanda = pop * 0.5;
    ag.redes.energia.oferta = energia;
    ag.redes.energia.demanda = pop * 0.6;
  }
  ag.bemEstarMedio = 20;
  sim.registrarSistema(20, 10, rodada, 1, { nome: 'cidade (faz de conta)', ordem: 450 });

  /** O robô "põe" um serviço: paga o custo; a manutenção entra pelos custos. Devolve true se pagou. */
  function porServico(tipo) {
    const s = SERVICOS_FALSOS[tipo];
    if (!s || (s.marco ?? 0) > sim.progresso.marco().n) return false;
    if (!sim.holding.pagar(s.custo, 'construir')) return false;
    E.servicos[tipo] = (E.servicos[tipo] ?? 0) + 1;
    return true;
  }
  return { estado: E, porServico };
}
