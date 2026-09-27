// Regras do dono (seção 12.1 do desenho da simulação, D8, D11 e D25): constante congelada e testada. Não mudar sem
// pedido do dono. F0 cria com os números; S3a é a dona do resto deste arquivo (custos gerais, compra de tempo).
import { congelar } from '../comum/util.js';

export const REGRAS_DONO = congelar({
  // lote de n unidades leva t x max(1, 0,8 x n): 10 levam 8 vezes o tempo de 1
  lote: { min: 1, max: 10, fatorTempo: 0.8 },
  // Depósito: 150% do preço base = preço de catálogo do item (o mesmo da venda à cidade a 100%, D25);
  // até 100 vendas por janela de 4 h de jogo (14.400 tiques); janela = floor(tique / 14.400)
  deposito: { venda: 1.5, precoBase: 'catalogo', vendasPorJanela: 100, janelaHoras: 4, janelaTiques: 14400 },
  // empréstimo igual ao de hoje: 50 mil por ano de jogo, 10% ao ano, dívida até 500 mil, passo de 1.000,
  // prazo de 10 anos e mora de 20% ao ano depois do prazo
  emprestimo: { porAno: 50000, taxaAno: 0.1, dividaMax: 500000, passo: 1000, prazoAnos: 10, mora: 0.2 },
  // contribuição: créditos por morador por hora de jogo (3.600 tiques) pelo bem-estar médio da cidade suavizado em
  // 1 mês e arredondado para o inteiro mais próximo antes da faixa (D11): 30,4 dá 5; 30,5 dá 8; 60,4 dá 8; 60,5 dá 11
  renda: {
    tarifas: [5, 8, 11],
    limiares: [30.5, 60.5],
    faixas: [[0, 30, 5], [31, 60, 8], [61, 100, 11]],
    arredondar: 'inteiroMaisProximo',
    tarifaPor: 'cidade', // 'predio' fica pronto e testado como proposta (pergunta 3)
    horaTiques: 3600,
  },
});

/**
 * Tarifa da regra do dono para um bem-estar (0 a 100): arredonda e aplica os limiares.
 * @example [tarifaDoBemEstar(30.4), tarifaDoBemEstar(30.5), tarifaDoBemEstar(60.4), tarifaDoBemEstar(60.5)] // [5, 8, 8, 11]
 */
export function tarifaDoBemEstar(b) {
  const r = bemEstarArredondado(b);
  const { tarifas, limiares } = REGRAS_DONO.renda;
  return r < limiares[0] ? tarifas[0] : r < limiares[1] ? tarifas[1] : tarifas[2];
}

/**
 * Bem-estar arredondado para o inteiro mais próximo e preso em 0 a 100. Sem número (NaN, cidade vazia) vale 0: a
 * tarifa de 5, nunca a de 11.
 */
export function bemEstarArredondado(b) {
  if (!Number.isFinite(b)) return 0;
  const r = Math.round(b);
  return r < 0 ? 0 : r > 100 ? 100 : r;
}

/** Faixa [de, até] e margem até o degrau de baixo (null na faixa de 5), para a barra (D11). */
export function faixaDaTarifa(b) {
  const r = bemEstarArredondado(b);
  const f = REGRAS_DONO.renda.faixas.find(([de, ate]) => r >= de && r <= ate) ?? REGRAS_DONO.renda.faixas[0];
  const degrau = f[0] > 0 ? f[0] : null;
  return { faixa: [f[0], f[1]], margem: { degrau, delta: degrau === null ? null : r - degrau } };
}

/** Tempo de um lote de n pela regra do dono (t = tempo de 1 unidade). */
export const tempoDoLote = (t, n) => t * Math.max(1, REGRAS_DONO.lote.fatorTempo * n);

/** Caixa inicial da partida (calibrar; S3a). */
export const CAIXA_INICIAL = 300000;
