// História do Ato 1 (D35, D67, D77 a D83; docs/desenho/historia.md): calendário com data real, Ato 1 "A Concessão",
// as 3 decisões do M1a e as 3 do M1b (S3b), os eventos do período com nome fictício e as falas do Mural (dona: S3a e S3b).
//
// Calendário (D67): o tique 0 é 1º de jan. 2020; mês = 600 tiques (um ciclo de sol), ano = 7.200 (D7, D42: 1 h de
// jogo = 6 meses). As consultas devolvem { ano, mes } com o ano de 2020 em diante; a interface escreve "jan. 2020".
// O empréstimo continua regido pelo ano de jogo (ano 1 = 2020: as viradas coincidem).
//
// Textos: toda chave 's3.*' citada aqui tem frase em fonte/ui/textos/s3.js (português do Brasil, sem travessão).
// Nenhum nome real de empresa, país, doença ou pessoa: os eventos usam os nomes da seção 7 da história.
import { congelar } from '../comum/util.js';

export const ANO_INICIAL = 2020;
export const MES_TIQUES = 600;
export const ANO_TIQUES = 7200;

/**
 * Data do calendário de um tique.
 * @example dataDoTique(0) // { ano: 2020, mes: 1, fracMes: 0 };  dataDoTique(8400) // { ano: 2021, mes: 3, fracMes: 0 }
 */
export function dataDoTique(tique, frac = 0) {
  const t = Math.max(0, tique + frac);
  const mesAbs = Math.floor(t / MES_TIQUES);
  return { ano: ANO_INICIAL + Math.floor(mesAbs / 12), mes: (mesAbs % 12) + 1, fracMes: (t - mesAbs * MES_TIQUES) / MES_TIQUES };
}

/** Tique do começo de um mês do calendário. @example tiqueDaData(2021, 3) // 8400 */
export const tiqueDaData = (ano, mes) => (ano - ANO_INICIAL) * ANO_TIQUES + (mes - 1) * MES_TIQUES;

/** Ano de jogo (1 em diante) do tique: o que rege o limite anual do empréstimo. */
export const anoDeJogo = (tique) => Math.floor(Math.max(0, tique) / ANO_TIQUES) + 1;

/** Ano do calendário de um ano de jogo. */
export const anoDoCalendario = (anoJogo) => ANO_INICIAL + anoJogo - 1;

/** Atos da campanha; o M1 conta o Ato 1. */
export const ATOS = /* @__PURE__ */ congelar([{ n: 1, id: 'concessao', chave: 's3.ato.1' }]);

/**
 * Decisões do Ato 1 no M1a (D35, D52, D77). Formato:
 *   { id, ato, quando: { marco?, tique? | ano?, mes? }, quem: [ids], prazo (tiques para decidir), padrao (opção que vale
 *     se o prazo passa), adiar (tiques que um adiamento dá; uma vez só), area?, opcoes: [{ id, quem, influencia, legado,
 *     efeitos: [efeito] }] }
 * Efeitos que a S3a aplica: { tipo: 'caixa', v } (negativo é custo, recusado com 'creditos' sem caixa),
 *   { tipo: 'licencas', n }, { tipo: 'produtividade', v, meses } (linhas da Holding), { tipo: 'importacao', fator?,
 *   entregaTiques?, meses } (anula com { tipo: 'semChoque', evento }), { tipo: 'objetivo', dominio, id }.
 * Efeitos que a cidade lê (S2a, por sim.economia.efeitos(tipo)): { tipo: 'bemArea', area, v, meses },
 *   { tipo: 'demanda', zona, v, meses }.
 * Efeitos da S3b: { tipo: 'produtividade', v, meses?, predio? } (com `predio`, um tipo ou lista, vale só para esses
 *   prédios da Holding), { tipo: 'custoLigacao', fator, meses } (o preço da energia que vem da rodovia, no orçamento).
 * `parte: 'M1b'` numa decisão (ou no `m1b` de um evento): só abre com o M1b no jogo (PARTE_ATUAL).
 * Textos: 's3.decisao.<id>.titulo' e '.texto'; por opção 's3.decisao.<id>.<opcao>' e '.ganho' e '.custo'.
 */
export const DECISOES = /* @__PURE__ */ congelar([
  {
    // D52: dispara no marco 0, no minuto 3, antes do objetivo da água; Dona Cida e Tomé
    id: 'vila.agua', ato: 1, quando: { marco: 0, tique: 180 }, quem: ['cida', 'tome'], prazo: 1800, padrao: 'captacao',
    adiar: 600, area: 'vila',
    opcoes: [
      { id: 'captacao', quem: 'cida', influencia: 0, legado: 5, efeitos: [{ tipo: 'objetivo', dominio: 'cidade', id: 'cidade.captacao' }] },
      { id: 'reservatorio', quem: 'tome', influencia: 5, legado: 0, efeitos: [{ tipo: 'objetivo', dominio: 'arcologia', id: 'arcologia.lago' }] },
    ],
  },
  {
    // mar. 2020: a Febre Aurora; comprar infraestrutura a preço de banana (Influência) ou proteger o canteiro e a
    // Vila (Legado). Oportunidade de compra e obstáculo de logística, sem cenas de doença (D77)
    id: 'febre.aurora', ato: 1, quando: { ano: 2020, mes: 3 }, quem: ['livia', 'cida'], prazo: 1800, padrao: 'proteger',
    adiar: 600, evento: 'febreAurora',
    opcoes: [
      {
        id: 'comprar', quem: 'livia', influencia: 8, legado: 0,
        efeitos: [{ tipo: 'caixa', v: -40000 }, { tipo: 'licencas', n: 1 }, { tipo: 'produtividade', v: -0.1, meses: 6 }],
      },
      {
        id: 'proteger', quem: 'cida', influencia: 0, legado: 8,
        efeitos: [{ tipo: 'caixa', v: -20000 }, { tipo: 'bemArea', area: 'vila', v: 4, meses: 12 }],
      },
    ],
  },
  {
    // mar. 2021: o Bloqueio do Canal de Seshat; a importação fica 25% mais cara (200% do preço base) e leva 3 vezes
    // mais por 6 meses, a não ser que a Holding frete navios próprios (Influência) ou aposte na produção local (Legado)
    id: 'canal.seshat', ato: 1, quando: { ano: 2021, mes: 3 }, quem: ['livia', 'tome'], prazo: 1800, padrao: 'local',
    adiar: 600, evento: 'canalSeshat',
    opcoes: [
      { id: 'navios', quem: 'livia', influencia: 6, legado: 0, efeitos: [{ tipo: 'caixa', v: -50000 }, { tipo: 'semChoque', evento: 'canalSeshat' }] },
      { id: 'local', quem: 'tome', influencia: 0, legado: 6, efeitos: [{ tipo: 'produtividade', v: 0.15, meses: 12 }] },
    ],
  },
  // ---- as 3 decisões do M1b (S3b): com as 3 de cima fecham as 6 do Ato 1, uma voz para cada conselheiro
  {
    // fev. 2022: a Crise da Energia (Guerra de Volkara); a energia da rodovia fica 60% mais cara e a importação 10% por 12
    // meses (choque do evento). Contrato de longo prazo (Influência) anula o choque; a usina solar da Holding (Legado)
    // deixa o choque correr e baixa a conta da energia importada em 30% por 5 anos
    id: 'energia.2022', ato: 1, quando: { ano: 2022, mes: 2 }, quem: ['caio', 'livia'], prazo: 1800, padrao: 'contrato',
    adiar: 600, evento: 'energia2022', parte: 'M1b',
    opcoes: [
      { id: 'contrato', quem: 'livia', influencia: 6, legado: 0, efeitos: [{ tipo: 'caixa', v: -30000 }, { tipo: 'semChoque', evento: 'energia2022' }] },
      { id: 'solar', quem: 'caio', influencia: 0, legado: 6, efeitos: [{ tipo: 'caixa', v: -20000 }, { tipo: 'custoLigacao', fator: 0.7, meses: 60 }] },
    ],
  },
  {
    // marco 2 (Vila): a Mina de calcário abre na encosta da Serra do Held. Lavra em bancadas com a encosta recuperada
    // (Legado, a Mina rende 10% menos) ou lavra aberta com turnos dobrados (Influência, a Mina e a Cimenteira 20% mais)
    id: 'mina.licenca', ato: 1, quando: { marco: 2 }, quem: ['nara', 'tome'], prazo: 1800, padrao: 'recuperar', adiar: 600, parte: 'M1b',
    opcoes: [
      { id: 'recuperar', quem: 'nara', influencia: 0, legado: 6, efeitos: [{ tipo: 'caixa', v: -10000 }, { tipo: 'produtividade', v: -0.1, predio: ['mina'] }] },
      { id: 'acelerar', quem: 'tome', influencia: 5, legado: 0, efeitos: [{ tipo: 'caixa', v: -25000 }, { tipo: 'produtividade', v: 0.2, predio: ['mina', 'cimenteira'] }] },
    ],
  },
  {
    // marco 3 (Vila Próspera): o futuro da Vila de Santa Cida (D95). As duas saídas põem na frente o objetivo de
    // requalificar a Vila pela Holding (cidade.vilaNova); a opção marca o método (custo, prazo e o que ela deixa)
    id: 'vila.futuro', ato: 1, quando: { marco: 3 }, quem: ['cida', 'iris'], prazo: 1800, padrao: 'reformar', adiar: 600, area: 'vila', parte: 'M1b',
    opcoes: [
      {
        id: 'reformar', quem: 'cida', influencia: 0, legado: 3,
        efeitos: [{ tipo: 'bemArea', area: 'vila', v: 3, meses: 24 }, { tipo: 'objetivo', dominio: 'cidade', id: 'cidade.vilaNova' }],
      },
      {
        id: 'substituir', quem: 'iris', influencia: 5, legado: 0,
        efeitos: [{ tipo: 'demanda', zona: 'comBaixa', v: 8, meses: 24 }, { tipo: 'objetivo', dominio: 'cidade', id: 'cidade.vilaNova' }],
      },
    ],
  },
]);

/**
 * Requalificação da Vila de Santa Cida pela Holding (D95, objetivo de Legado `cidade.vilaNova`). Quando o objetivo se
 * cumpre (a Vila ligada às redes, bem-estar médio e caixa para a reforma), as casas de autoconstrução passam ao padrão
 * alto (data/predios.js: REQUALIFICACAO_VILA) numa obra de reforma. O método vem da decisão `vila.futuro`. Créditos de
 * desenho (calibrar).
 */
export const VILA_NOVA = /* @__PURE__ */ congelar({
  objetivo: 'cidade.vilaNova',
  /** Fração das casas da Vila com água e energia que o objetivo pede. */
  redeMin: 0.9,
  /** Bem-estar médio das casas da Vila que o objetivo pede. */
  bemEstarMin: 56,
  /** Por casa: créditos que a Holding paga e tiques da obra de reforma, por método. */
  metodos: {
    reformar: { custoPorCasa: 600, obraTiques: 120 },
    substituir: { custoPorCasa: 1000, obraTiques: 300 },
  },
  /** Método quando nenhuma decisão foi tomada (o padrão da decisão). */
  padrao: 'reformar',
  /** Legado que o objetivo dá ao se cumprir. */
  legado: 8,
});

/**
 * Modo livre (D56): o caixa fica sempre neste valor (créditos de desenho; US$ 600 bilhões com o fator 600), então nada
 * pede licença nem falta crédito. Fora de REGRAS_DONO (as regras do dono seguem as mesmas).
 */
export const MODO_LIVRE = /* @__PURE__ */ congelar({ caixa: 1e9 });

/**
 * Eventos do calendário (D77; nomes da seção 7 da história). `choque`: efeitos que valem para todos quando o evento
 * chega (a decisão ligada pode anular). `mural`: a fala que entra no Mural. Os de 2022 em diante entram como nota no
 * M1a; a Crise da Energia de 2022 ganhou o choque e a decisão no M1b (`m1b`, S3b).
 */
export const EVENTOS = /* @__PURE__ */ congelar([
  { id: 'inicio', ano: 2020, mes: 1, mural: { autor: 'iris', chave: 's3.mural.evento.inicio' } },
  { id: 'febreAurora', ano: 2020, mes: 3, decisao: 'febre.aurora', mural: { autor: 'livia', chave: 's3.mural.evento.febreAurora' } },
  { id: 'dinheiroBarato', ano: 2020, mes: 9, mural: { autor: 'livia', chave: 's3.mural.evento.dinheiroBarato' } },
  { id: 'rivais', ano: 2020, mes: 11, mural: { autor: 'livia', chave: 's3.mural.evento.rivais' } },
  {
    id: 'canalSeshat', ano: 2021, mes: 3, decisao: 'canal.seshat',
    choque: [{ tipo: 'importacao', fator: 1.25, entregaTiques: 120, meses: 6 }],
    mural: { autor: 'tome', chave: 's3.mural.evento.canalSeshat' },
  },
  {
    id: 'energia2022', ano: 2022, mes: 2, mural: { autor: 'caio', chave: 's3.mural.evento.energia2022' },
    // M1b: o choque (energia da rodovia e importação mais caras) e a decisão entram só com o M1b no jogo
    m1b: { decisao: 'energia.2022', choque: [{ tipo: 'custoLigacao', fator: 1.6, meses: 12 }, { tipo: 'importacao', fator: 1.1, meses: 12 }] },
  },
  { id: 'ondaAssistentes', ano: 2022, mes: 11, mural: { autor: 'caio', chave: 's3.mural.evento.ondaAssistentes' } },
  { id: 'bancoValePrata', ano: 2023, mes: 3, mural: { autor: 'livia', chave: 's3.mural.evento.bancoValePrata' } },
]);

/** Influência e Legado (D55): 0 a 100; Influência tira até 20% do ladrilho, Legado soma até 5 de atratividade. */
export const MEDIDORES = /* @__PURE__ */ congelar({
  max: 100,
  inicial: { influencia: 0, legado: 0 },
  descontoLadrilhoMax: 0.2,
  atratividadeMax: 5,
});

/** Mural: quantas falas guardar (as mais antigas saem). */
export const MURAL_MAX = 200;
