// Mercadoria agregada do M1b (seção 6.4 do desenho da simulação, D48; dona: S2b): a indústria zoneada produz, o
// comércio consome, a falta é importada pela rodovia a 160% do preço base (a mesma regra da importação da Holding,
// D25) e aparece no painel de demanda. Números de partida (calibrar). Não mexe em nenhuma regra do dono (REGRAS_DONO):
// é um custo corrente novo, só do M1b.
import { congelar } from '../comum/util.js';
import { ECONOMIA } from './economia.js';

export const MERCADORIA = congelar({
  /** Preço base de uma unidade de mercadoria (unidades de desenho; US$ 1.800 com o fator 600). */
  preco: 3,
  /** Importação: o fator da regra de importação da Holding (160%). */
  fatorImportacao: ECONOMIA.importacao.fator,
  /** Unidades por hora de jogo que um emprego ocupado da indústria faz; sobe 8% por nível acima do 1. */
  producaoPorEmprego: 1,
  nivelProducao: 0.08,
  /** Unidades por hora de jogo que um emprego ocupado do comércio consome (clientes atendidos). */
  consumoPorEmprego: 1,
  /** Alerta da cidade: fração do consumo importada, e consumo mínimo para valer a pena avisar. */
  alerta: { fracao: 0.5, consumoMin: 30 },
});
