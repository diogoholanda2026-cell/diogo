// História do M1a (D35, D67, D77 a D83; docs/desenho/historia.md): calendário com data real, Ato 1 "A Concessão",
// as 3 decisões do M1a, os eventos do período com nome fictício e as falas do Mural (dona: S3a).
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
]);

/**
 * Eventos do calendário (D77; nomes da seção 7 da história). `choque`: efeitos que valem para todos quando o evento
 * chega (a decisão ligada pode anular). `mural`: a fala que entra no Mural. Os de 2022 em diante entram como nota no
 * M1a; a decisão da Crise da Energia de 2022 fica para a S3b (M1b).
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
  { id: 'energia2022', ano: 2022, mes: 2, mural: { autor: 'caio', chave: 's3.mural.evento.energia2022' } },
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
