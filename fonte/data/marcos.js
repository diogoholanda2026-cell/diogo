// Marcos 0 a 7, XP, prêmios, licenças e desbloqueios (D51, seção 15.1 do desenho da simulação; dona: S3a).
// Limiares de partida (o robô calibra os limiares de XP, não os preços). O marco 7 pede a Torre pronta (torre.e4) e
// inaugura a Arcologia "em fase inicial": não é o fim da parte 2 (a sede completa é de jun. 2026, D67).
//
// libera: ids do que o marco desbloqueia, no formato '<domínio>.<id>' ('via.ruaMao', 'zona.resMedia', 'servico.clinica',
// 'holding.olaria', 'item.aco', 'etapa.torre.e1', 'acao.deposito'); progresso.liberado(id) responde por eles. O que
// está na lista de um marco ainda não alcançado fica trancado; o que não está em lista nenhuma fica livre. Os ids M1b
// ficam na lista com a parte para a S3b ligar.
import { congelar } from '../comum/util.js';

/** XP de bem-estar por mês (D51): moradores x (bem-estar − 50) / 2.000, só acima de 50. */
export const XP = /* @__PURE__ */ congelar({
  porMoradorNovo: 1, // acima do maior número já atingido (os moradores da Vila são o ponto de partida)
  bemEstar: { base: 50, divisor: 2000 },
  viaPorCemMetros: 1, // vias novas (o comprimento máximo já construído, sem a rodovia e a terra do mapa)
  servico: 40, // cada serviço novo da cidade (o catálogo da S2a pode trazer o seu, `xp`)
  holding: 30, // cada prédio da Holding novo (o de data/holding.js vale)
  premioPorMarco: 10000, // unidades x n do marco
});

export const MARCOS = /* @__PURE__ */ congelar([
  {
    n: 0, nome: 'Canteiro', xp: 0, licencas: 0,
    libera: [
      'via.rua', 'via.avenida', 'zona.resBaixa', 'zona.comBaixa', 'zona.industria',
      'servico.captacao', 'servico.poco', 'servico.solar', 'servico.praca',
      'holding.escritorioObra', 'holding.pedreira', 'holding.areal', 'item.brita', 'item.areia',
      'acao.deposito', 'acao.emprestimo', 'etapa.lago.e1',
    ],
  },
  {
    n: 1, nome: 'Povoado', xp: 500, licencas: 0,
    libera: ['servico.clinica', 'servico.escolaF', 'servico.delegacia', 'holding.olaria', 'item.argila', 'item.tijolo', 'item.serrada'],
    m1b: ['servico.termica', 'holding.manejo', 'holding.serraria', 'item.madeira'],
  },
  {
    n: 2, nome: 'Vila', xp: 1500, licencas: 1,
    libera: ['servico.bombeiros', 'zona.resMedia', 'via.ruaMao'],
    m1b: ['holding.mina', 'holding.cimenteira', 'item.calcario'],
  },
  {
    n: 3, nome: 'Vila Próspera', xp: 3500, licencas: 1,
    // D48: daqui em diante as obras de nível 3 a 5 da cidade compram só da Holding
    libera: ['holding.concreteira', 'item.concreto', 'item.cimento', 'item.aco', 'etapa.torre.e1', 'regra.dependencia'],
    m1b: ['zona.escritorio', 'zona.comAlta', 'servico.escolaM', 'servico.parque'],
  },
  {
    n: 4, nome: 'Cidade Nova', xp: 8000, licencas: 1,
    libera: ['via.avenidaG', 'item.vidro', 'etapa.torre.e2'],
    m1b: ['zona.resAlta', 'servico.hospital', 'holding.vidraria'],
  },
  {
    n: 5, nome: 'Cidade', xp: 15000, licencas: 1,
    libera: ['etapa.torre.e3', 'nivel.armazem2'],
    m1b: ['servico.parqueG'],
  },
  { n: 6, nome: 'Cidade Grande', xp: 25000, licencas: 1, libera: ['etapa.torre.e4'] },
  {
    n: 7, nome: 'Polo Regional', xp: 38000, licencas: 1, requisito: 'torre.e4',
    // a Torre pronta inaugura a Arcologia em fase inicial (o resto do plano segue no M2)
    libera: ['arcologia.faseInicial'],
  },
]);

/** Nomes dos marcos depois do M1 (M2 a M4), só para a tela Progresso mostrar o caminho. */
export const MARCOS_DEPOIS = /* @__PURE__ */ congelar([
  'Capital Regional', 'Metrópole Nascente', 'Metrópole', 'Grande Metrópole', 'Metrópole Nacional',
  'Metrópole Continental', 'Cidade Global', 'Heldópolis Lendária',
]);

/** Marco (0 a 7) que libera um id, ou -1 se nenhum lista o id (livre). Os ids M1b contam também. */
export function marcoQueLibera(id) {
  for (const m of MARCOS) if (m.libera.includes(id) || m.m1b?.includes(id)) return m.n;
  return -1;
}
