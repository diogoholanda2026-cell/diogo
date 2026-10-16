// Itens, receitas, prédios de produção, armazéns e frota da Holding (seção 13 do desenho da simulação, D47, D48, D57;
// dona: S3a). Números marcados (calibrar) são de partida; a C1 calibra com o robô.
//
// Item: { base: preço de catálogo em unidades (o "preço base" da D25: venda à cidade a 100%, Depósito a 150%,
//         importação a 160%), t: tiques de 1 unidade em 1x na produtividade 1, req: insumos por unidade,
//         predio: quem produz, marco: a partir de quando a Holding produz ou importa, recurso: o recurso natural
//         que a extração tira da planta (unidades da grade de recursos por unidade de item), parte: 'M1a' | 'M1b' }.
// A unidade é a de catálogo (D47): um caminhão leva até 10. Em US$ (fator 600) os preços ficam muito acima do frete
// real de uma carga; a nota da S3a lista os desvios para a C1 (proposta: a unidade como lote industrial).
import { congelar } from '../comum/util.js';

export const ITENS = /* @__PURE__ */ congelar({
  brita: { base: 20, t: 30, req: {}, predio: 'pedreira', marco: 0, recurso: { tipo: 'rocha', porUnidade: 1 }, parte: 'M1a' },
  areia: { base: 15, t: 25, req: {}, predio: 'areal', marco: 0, recurso: { tipo: 'areia', porUnidade: 1 }, parte: 'M1a' },
  argila: { base: 18, t: 30, req: {}, predio: 'olaria', marco: 1, recurso: { tipo: 'argila', porUnidade: 1 }, parte: 'M1a' },
  tijolo: { base: 50, t: 40, req: { argila: 2 }, predio: 'olaria', marco: 1, parte: 'M1a' },
  madeira: { base: 30, t: 45, req: {}, predio: 'manejo', marco: 1, parte: 'M1b' },
  serrada: { base: 80, t: 50, req: { madeira: 2 }, predio: 'serraria', marco: 1, parte: 'M1b' },
  // o calcário rende 2 por unidade da grade: a lavra em bancadas tira mais de cada célula de 32 m (a faixa da Mina é pequena)
  calcario: { base: 22, t: 35, req: {}, predio: 'mina', marco: 2, recurso: { tipo: 'calcario', porUnidade: 0.5 }, parte: 'M1b' },
  // M1a: cimento importado (item liberado no marco 3, com a Concreteira); M1b: a Cimenteira (marco 2) o faz com calcário
  // da Mina e argila da Olaria e abre a cadeia que alimenta o concreto e as obras da cidade
  cimento: { base: 90, t: 60, req: { calcario: 2, argila: 1 }, predio: 'cimenteira', marco: 2, parte: 'M1b' },
  concreto: { base: 170, t: 70, req: { cimento: 1, brita: 2, areia: 1 }, predio: 'concreteira', marco: 3, parte: 'M1a' },
  vidro: { base: 140, t: 90, req: { areia: 3, calcario: 1 }, predio: 'vidraria', marco: 4, parte: 'M1b' },
  // aço: só importado no M1 (siderúrgica e reciclagem no M3)
  aco: { base: 160, t: 0, req: {}, predio: null, marco: 3, parte: 'M1a' },
  // cadeia de alimentos para o comércio (S3b, linha de corte do M1b): a Fazenda colhe na terra fértil (que renova, então
  // a extração não gasta a grade) e a Agroindústria beneficia; o comércio da cidade compra a 100% (ALIMENTOS)
  graos: { base: 12, t: 40, req: {}, predio: 'fazenda', marco: 2, recurso: { tipo: 'fertil', porUnidade: 1, renova: true }, parte: 'M1b' },
  alimentos: { base: 70, t: 55, req: { graos: 2 }, predio: 'agroindustria', marco: 3, parte: 'M1b' },
});

/** Ordem fixa dos itens (telas, relatórios, laços determinísticos). Só se acrescenta no fim. */
export const ITENS_ORDEM = Object.freeze(Object.keys(ITENS));

/**
 * Prédios da Holding (colocados à mão, de frente para uma via, dentro de ladrilho da Holding). `nome` e `faz` aparecem
 * na folha do prédio como os dos serviços em data/servicos.js (as mesmas frases ficam em ui/textos/s3.js). Nível 1 a 3: linhas 1,
 * 2 e 3; subir custa unidades e materiais do estoque (comando predio.nivel). `vagas` por nível de estudo (básico,
 * fundamental, médio, superior) no nível 1, crescendo 60% por nível. `planta` em metros [frente, fundo]. `armazem`:
 * capacidade de estoque por nível (o primeiro vem no Escritório de Obra). `caminhoes`: frota por nível de armazém
 * (D47: 6 no começo, +6 por nível). Custos (calibrar).
 */
export const PREDIOS_HOLDING = /* @__PURE__ */ congelar({
  escritorioObra: {
    nome: 'Escritório de Obra', faz: 'guarda o estoque da Holding e mantém a frota de caminhões',
    produz: [], custo: 15000, marco: 0, planta: [48, 40], vagas: [4, 4, 2, 1], obraTiques: 60, xp: 30,
    armazem: [600, 1200, 2000], caminhoes: [6, 12, 18], parte: 'M1a',
    // armazém nível 2 no marco 5 (seção 15.1 do desenho: 'nivel.armazem2' em data/marcos.js); antes disso, mais
    // estoque é outro Escritório de Obra
    niveis: [null, { custo: 12000, materiais: { tijolo: 20, brita: 20 }, marco: 5 }, { custo: 25000, materiais: { concreto: 30, aco: 10 }, marco: 5 }],
  },
  pedreira: {
    nome: 'Pedreira', faz: 'tira brita do granito',
    produz: ['brita'], custo: 12000, marco: 0, planta: [64, 56], vagas: [8, 3, 1, 0], obraTiques: 60, xp: 30,
    recurso: 'rocha', parte: 'M1a',
    niveis: [null, { custo: 10000, materiais: { brita: 30 }, marco: 2 }, { custo: 20000, materiais: { concreto: 20 }, marco: 4 }],
  },
  areal: {
    nome: 'Areal', faz: 'tira areia da margem do rio',
    produz: ['areia'], custo: 8000, marco: 0, planta: [48, 40], vagas: [5, 2, 1, 0], obraTiques: 60, xp: 30,
    // a draga fica na margem: até 150 m da água
    recurso: 'areia', margem: 150, parte: 'M1a',
    niveis: [null, { custo: 8000, materiais: { brita: 20 }, marco: 2 }, { custo: 16000, materiais: { concreto: 15 }, marco: 4 }],
  },
  olaria: {
    nome: 'Olaria', faz: 'tira argila da várzea e queima tijolos',
    produz: ['argila', 'tijolo'], custo: 15000, marco: 1, planta: [56, 48], vagas: [6, 4, 1, 0], obraTiques: 90, xp: 30,
    recurso: 'argila', parte: 'M1a',
    niveis: [null, { custo: 12000, materiais: { brita: 20, areia: 20 }, marco: 2 }, { custo: 24000, materiais: { concreto: 20 }, marco: 4 }],
  },
  concreteira: {
    nome: 'Concreteira', faz: 'mistura concreto com cimento, brita e areia',
    produz: ['concreto'], custo: 30000, marco: 3, planta: [56, 48], vagas: [4, 5, 3, 1], obraTiques: 120, xp: 40,
    // D47: a produtividade cai 1% a cada 100 m além de 500 m do armazém, até 30%
    distanciaArmazem: { livre: 500, porCem: 0.01, max: 0.3 }, parte: 'M1a',
    niveis: [null, { custo: 20000, materiais: { concreto: 20, aco: 5 }, marco: 4 }, { custo: 40000, materiais: { concreto: 40, aco: 10 }, marco: 5 }],
  },
  // M1b (S3b): ligados quando o integrador abre o M1b (PARTE_ATUAL); o marco de cada um segue a tabela do desenho
  mina: {
    nome: 'Mina de calcário', faz: 'tira calcário para o cimento', produz: ['calcario'], custo: 15000, marco: 2, planta: [64, 56],
    vagas: [8, 3, 1, 0], obraTiques: 90, xp: 30, recurso: 'calcario', parte: 'M1b',
    niveis: [null, { custo: 10000, materiais: { brita: 20 }, marco: 3 }, { custo: 20000, materiais: { concreto: 15 }, marco: 5 }],
  },
  cimenteira: {
    nome: 'Cimenteira', faz: 'faz cimento com calcário e argila', produz: ['cimento'], custo: 40000, marco: 2, planta: [72, 56],
    vagas: [6, 6, 3, 1], obraTiques: 150, xp: 40, parte: 'M1b',
    niveis: [null, { custo: 25000, materiais: { concreto: 20, aco: 5 }, marco: 4 }, { custo: 50000, materiais: { concreto: 40, aco: 10 }, marco: 6 }],
  },
  vidraria: {
    nome: 'Vidraria', faz: 'faz vidro com areia e calcário', produz: ['vidro'], custo: 35000, marco: 4, planta: [80, 40],
    vagas: [5, 6, 3, 1], obraTiques: 150, xp: 40, parte: 'M1b',
    niveis: [null, { custo: 22000, materiais: { concreto: 20, aco: 5 }, marco: 5 }, { custo: 44000, materiais: { concreto: 40, aco: 10 }, marco: 6 }],
  },
  serraria: {
    nome: 'Serraria', faz: 'serra madeira para obras', produz: ['serrada'], custo: 14000, marco: 1, planta: [56, 40],
    vagas: [6, 3, 1, 0], obraTiques: 90, xp: 30, parte: 'M1b',
    niveis: [null, { custo: 9000, materiais: { brita: 15, tijolo: 10 }, marco: 2 }, { custo: 18000, materiais: { concreto: 10 }, marco: 4 }],
  },
  manejo: {
    nome: 'Manejo florestal', faz: 'tira madeira da mata com reposição', produz: ['madeira'], custo: 9000, marco: 1, planta: [40, 32],
    vagas: [6, 2, 0, 0], obraTiques: 60, xp: 30, parte: 'M1b',
    niveis: [null, { custo: 6000, materiais: { brita: 10 }, marco: 2 }, { custo: 12000, materiais: { tijolo: 20 }, marco: 4 }],
  },
  // cadeia de alimentos (S3b): a Fazenda na terra fértil da planície, a Agroindústria perto do armazém e do comércio
  fazenda: {
    nome: 'Fazenda', faz: 'colhe grãos na terra fértil da planície', produz: ['graos'], custo: 12000, marco: 2, planta: [88, 72],
    vagas: [10, 3, 1, 0], obraTiques: 90, xp: 30, recurso: 'fertil', parte: 'M1b',
    niveis: [null, { custo: 8000, materiais: { brita: 15, serrada: 10 }, marco: 3 }, { custo: 16000, materiais: { concreto: 10 }, marco: 5 }],
  },
  agroindustria: {
    nome: 'Agroindústria', faz: 'beneficia grãos em alimentos para o comércio', produz: ['alimentos'], custo: 30000, marco: 3, planta: [72, 56],
    vagas: [6, 6, 3, 1], obraTiques: 120, xp: 40, parte: 'M1b',
    niveis: [null, { custo: 20000, materiais: { concreto: 15, aco: 5 }, marco: 5 }, { custo: 40000, materiais: { concreto: 30, aco: 10 }, marco: 6 }],
  },
});

/** Índice numérico (predios.modelo quando predios.tipo é HOLDING). Só se acrescenta no fim. */
export const HOLDING_ORDEM = Object.freeze(Object.keys(PREDIOS_HOLDING));

/** Tipos da Holding que o M1a constrói. */
export const HOLDING_M1A = Object.freeze(HOLDING_ORDEM.filter((id) => PREDIOS_HOLDING[id].parte === 'M1a'));

/** Tipos da Holding do M1b (S3b): Mina, Cimenteira, Vidraria, Serraria, Manejo, Fazenda e Agroindústria. */
export const HOLDING_M1B = Object.freeze(HOLDING_ORDEM.filter((id) => PREDIOS_HOLDING[id].parte === 'M1b'));

/** Linhas por nível do prédio (1, 2 e 3). */
export const LINHAS_POR_NIVEL = Object.freeze([1, 2, 3]);

/** Vagas de um nível (1 a 3): as do nível 1 crescendo 60% por nível. */
export function vagasDoNivel(tipo, nivel) {
  const def = PREDIOS_HOLDING[tipo];
  if (!def) return [0, 0, 0, 0];
  const f = 1 + 0.6 * (Math.max(1, Math.min(3, nivel)) - 1);
  return def.vagas.map((v) => Math.round(v * f));
}

/**
 * Produção e logística (calibrar): a linha para abaixo de 50% de ocupação; o caminhão leva até 10 unidades; a
 * velocidade dele é a da via vezes `fatorVelocidade` (2 km dão uns 160 tiques numa avenida); sem caminho pelo grafo,
 * linha reta vezes 1,4 a 12,5 m/s. `frotaInicial`: sem Escritório de Obra ainda, a frota é esta.
 */
export const PRODUCAO = /* @__PURE__ */ congelar({
  ocupacaoMinima: 0.5,
  loteInicial: 10,
  autoInicial: true,
  caminhao: { capacidade: 10, fatorVelocidade: 0.9, velocidadeSemVia: 12.5, desvioSemVia: 1.4 },
  frotaInicial: 6,
  // sugestão de lote menor (D57): só quando ajuda
  sugestao: { insumoCurto: true, etapaPoucas: true },
});

/** Preço base de um item (D25), ou 0 se não existe. */
export const precoBase = (item) => ITENS[item]?.base ?? 0;

/**
 * Cadeia de alimentos para o comércio (S3b, linha de corte do M1b): o comércio zoneado da cidade pede mercadoria (S2b,
 * sim.agregados.mercadoria.consumo, em unidades por hora de jogo); uma fração dela é comida. A Holding fornece o que o
 * estoque de alimentos cobre, a 100% do preço base, e o fornecido abate o que a cidade importaria. Uma unidade de
 * alimentos (um lote de caminhão) cobre `mercadoriaPorUnidade` unidades de mercadoria. (calibrar)
 */
export const ALIMENTOS = /* @__PURE__ */ congelar({
  item: 'alimentos',
  fracaoDoConsumo: 0.35,
  mercadoriaPorUnidade: 20,
});

/**
 * Os itens da cadeia da Holding no M1a (D92): a obra da cidade de nível 3 a 5 compra só da Holding o que vem daqui. No
 * M1b o item de um prédio da Holding que já existe na partida entra também (cimento com a Cimenteira, serrada com a
 * Serraria...), pelo estado: ver itensDaCadeia em sim/holding/mercado.js.
 */
export const CADEIA_M1A = Object.freeze(['brita', 'areia', 'argila', 'tijolo', 'concreto']);
