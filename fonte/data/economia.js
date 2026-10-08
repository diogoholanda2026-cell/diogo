// Regras do dono (seção 12.1 do desenho da simulação, D8, D11, D25, D68 e D87): constante congelada e testada. Não
// mudar sem pedido do dono. F0 criou com os números; S3a é a dona do resto deste arquivo (moeda, custos gerais, compra
// de tempo, importação, salários e a ordem de pagamento da D41).
//
// Dinheiro (D87): a simulação guarda TUDO em unidades de desenho (o crédito antigo). A interface mostra em dólar pelo
// fator único REGRAS_DONO.moeda (1 unidade = US$ 600; ui/formato.js converte). Nenhum arquivo de fonte/sim lê o fator:
// trocar o fator muda só a exibição (teste em ferramentas/testes/regras-dono.teste.mjs).
import { congelar } from '../comum/util.js';

export const REGRAS_DONO = /* @__PURE__ */ congelar({
  // lote de n unidades leva t x max(1, 0,8 x n): 10 levam 8 vezes o tempo de 1
  lote: { min: 1, max: 10, fatorTempo: 0.8 },
  // Depósito: 150% do preço base = preço de catálogo do item (o mesmo da venda à cidade a 100%, D25). O limite de 100
  // vendas por janela de 4 h saiu a pedido do dono (07/10/2026, D103): vendasPorJanela null = sem limite (a janela de
  // 14.400 tiques segue só para o contador de vendas)
  deposito: { venda: 1.5, precoBase: 'catalogo', vendasPorJanela: null, janelaHoras: 4, janelaTiques: 14400 },
  // empréstimo Lombard (pedido do dono em 07/10/2026, D103): 3% ao ano, até 167 mil unidades por ano de jogo (US$ 100
  // milhões) e dívida até 1.667 mil (US$ 1 bilhão em dez anos), passo de 1.000; crédito com garantia dos ativos da
  // Holding: ao fim dos 10 anos o contrato se renova (rolagem) enquanto a dívida couber em `cobertura` dos ativos; sem
  // cobertura, mora de 20% ao ano. O limite anual renova todo ano, então dá para tomar sempre (antes: 50 mil por ano,
  // 10% ao ano e dívida até 500 mil)
  emprestimo: { porAno: 167000, taxaAno: 0.03, dividaMax: 1667000, passo: 1000, prazoAnos: 10, mora: 0.2, lombard: { cobertura: 0.6 } },
  // contribuição: unidades por morador por hora de jogo (3.600 tiques) pelo bem-estar médio da cidade suavizado em
  // 1 mês e arredondado para o inteiro mais próximo antes da faixa (D11): 30,4 dá 5; 30,5 dá 8; 60,4 dá 8; 60,5 dá 11
  // (em US$: 3.000, 4.800 e 6.600 por morador por hora de jogo, D68)
  renda: {
    tarifas: [5, 8, 11],
    limiares: [30.5, 60.5],
    faixas: [[0, 30, 5], [31, 60, 8], [61, 100, 11]],
    arredondar: 'inteiroMaisProximo',
    tarifaPor: 'cidade', // 'predio' fica pronto e testado como proposta (pergunta 3)
    horaTiques: 3600,
  },
  // D68 e D87: só a interface usa; 1 unidade de desenho = US$ 600
  moeda: { simbolo: 'US$', fator: 600 },
});

/**
 * Tarifa da regra do dono para um bem-estar (0 a 100): arredonda e aplica os limiares. O segundo argumento só vale se
 * for um objeto de regras (sim.economia.regras()); um número (o índice de lista.map) é ignorado.
 * @example [tarifaDoBemEstar(30.4), tarifaDoBemEstar(30.5), tarifaDoBemEstar(60.4), tarifaDoBemEstar(60.5)] // [5, 8, 8, 11]
 */
export const tarifaDoBemEstar = (b, regras) => tarifaPelasRegras(regras?.renda ? regras : REGRAS_DONO, b);

/** Tarifa de um bem-estar pelas regras dadas (a simulação passa as dela; os testes trocam). */
export function tarifaPelasRegras(regras, b) {
  const r = bemEstarArredondado(b);
  const { tarifas, limiares } = regras.renda;
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
export const tempoDoLote = (t, n) => tempoPelasRegras(REGRAS_DONO, t, n);
export const tempoPelasRegras = (regras, t, n) => t * Math.max(1, regras.lote.fatorTempo * n);

/** true se n é um lote da regra do dono (inteiro de 1 a 10). */
export const loteValido = (n) => lotePelasRegras(REGRAS_DONO, n);
export const lotePelasRegras = (regras, n) => Number.isInteger(n) && n >= regras.lote.min && n <= regras.lote.max;

/**
 * Valor em dólar de um valor em unidades (só para a interface e a nota de calibração; a simulação não chama).
 * @example emDolar(50000) // 30000000
 */
export const emDolar = (unidades) => unidades * REGRAS_DONO.moeda.fator;

/**
 * Fundo de teste (pedido do dono em 08/10/2026, D104): US$ 25 bilhões (41.667 mil unidades) de onde ele saca a qualquer
 * hora, o valor que quiser, para pagar as construções e testar o jogo mais rápido. Temporário: o dono pede quando tirar
 * (ativo: false desliga o comando e a tela; nada mais depende dele). Entra no livro como financiamento, não como renda.
 */
export const FUNDO_TESTE = /* @__PURE__ */ congelar({ ativo: true, total: 41667000, passo: 1000 });

/** Caixa inicial da partida (calibrar). Em US$: 180 milhões, a primeira tranche da obra (historia.md, seção 3). */
export const CAIXA_INICIAL = 300000;

/**
 * Compra de tempo (D13): minutos de jogo e o preço em unidades, só nas linhas da Holding (nunca na cidade; nas etapas
 * da Arcologia só se o dono pedir). O tempo comprado é trabalho feito na hora na produtividade 1.
 */
export const COMPRA_TEMPO = /* @__PURE__ */ congelar({ 1: 100, 5: 500, 10: 1000, 30: 2500, 60: 5000 });

/**
 * Números gerais da economia (calibrar). Receitas e despesas por categoria como em q.orcamento (seção 2.6); `aporte`
 * é o ponto de entrada das tranches dos sócios (depois do M1a; nada usa ainda).
 */
export const ECONOMIA = /* @__PURE__ */ congelar({
  // importação a 160% do preço base com entrega em 40 s de jogo (D25): acima dos 150% do Depósito, sem arbitragem
  importacao: { fator: 1.6, entregaTiques: 40 },
  // ordem de pagamento de cada tique (D41): o que não dá para pagar não vira dívida
  ordemPagamento: ['manutencao', 'salarios', 'importacaoCidade'],
  // salário por trabalhador ocupado da Holding por hora de jogo, por nível de estudo (básico a superior)
  salarioHora: [3, 4, 6, 9],
  // fração dos moradores que trabalha (para a ocupação das vagas da Holding enquanto a S2a não publica a dela)
  fracaoAtiva: 0.5,
  // receitas e despesas da tela Economia; `aporte` fica para as tranches (depois do M1a)
  receitas: ['moradores', 'cidade', 'deposito', 'marcos', 'aporte'],
  despesas: ['servicos', 'vias', 'ligacao', 'salarios', 'juros', 'importacao', 'importacaoCidade'],
  // série mensal: 240 pontos = 20 anos de jogo
  serieMax: 240,
  // aviso âmbar quando o caixa zera em menos que isto (minutos de jogo) com o saldo negativo: "o jogo avisa antes"
  avisoCaixaMinutos: 15,
  // abaixo disto o caixa conta como zerado
  caixaZeradoAbaixo: 1,
});

/** Categorias de pagamento que entram como despesa corrente (o resto de pagar() é investimento: obra, ladrilho). */
export const DESPESAS_CORRENTES = /* @__PURE__ */ congelar(['servicos', 'vias', 'ligacao', 'salarios', 'juros', 'importacao', 'importacaoCidade']);
