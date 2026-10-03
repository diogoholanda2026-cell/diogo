// Etapas, fases e efeitos da Arcologia (D26, D49, D51, D59, D88 a D90; dona: X1b). A sede é a v3, Park of Future
// Dreams (data/arcologia-plano.js): no M1a jogam-se o Mirror Lake (lago.e1) e o par Blade Tower e Legacy Tower
// (torre.e1 a torre.e4, as duas sobem juntas, a Legacy um passo atrás); o resto da sede fica em fantasma, com os dados
// das etapas do M2 prontos (D89: o Meridian Ring, as três torres do bosque, o parque e 2 trechos do Horizon Ring até jun.
// 2026; os outros 6 trechos até 2032), sem jogabilidade.
//
// Etapa: { id, parte, nome, marco, requisito (etapa que vem antes), creditos (unidades de desenho, D87), materiais
//          { item: n } (entregues por caminhão do armazém, D47), minutos (min de jogo em 1x, D42), xp, fases (ids das
//          4 fases, textos em ui/textos/x1.js), efeitos [{ tipo, ... }] (D49), alturas? (corte da obra do par) }.
// Progresso = trabalho / duração, e o trabalho só anda enquanto há material para a fase (min de entregue / pedido por
// item) e caixa (D41). Números de partida, marcados (calibrar): a C1 calibra com o robô.
import { congelar } from '../comum/util.js';
import { MINUTO } from '../comum/relogio.js';
import { TORRE_LAMINA, TORRE_IRMA, PAR, TRECHOS_HORIZON } from './arcologia-plano.js';

/** Fases de cada etapa (4, D26): o render sobe a obra por elas; os nomes ficam em ui/textos/x1.js. */
const FASES_LAGO = ['escavacao', 'impermeabilizacao', 'captacao', 'portoes'];
const FASES_TORRE = ['fundacao', 'estrutura', 'fachada', 'acabamento'];

/**
 * Etapas jogáveis do M1a, na ordem da cadeia (cada uma pede a anterior pronta). Efeitos (D49):
 *   vias         as vias internas da sede no grafo (ARESTA.ARCOLOGIA) com os 8 portões ligados
 *   agua         o reservatório do Mirror Lake como produtor da rede (capacidade da captação: 6 por mil moradores)
 *   valor        valor do terreno em volta (sim.cidade.efeito: v no centro, cai com e^(-d/raio))
 *   licenca      licenças de ladrilho
 *   holding      produtividade das linhas e caminhões da frota (sim.holding.efeito)
 *   vagas        vagas de trabalho por nível de estudo (escritórios da Holding, sem salário pago por ela)
 *   moradores    moradores de luxo (pagam a Contribuição na faixa do bem-estar deles)
 *   demanda      bônus de demanda por zona num raio (sim.cidade.efeito)
 *   atratividade atratividade da cidade (sim.cidade.efeito)
 *   legado       Legado da Holding (sim.economia.somarMedidor)
 *   helicoptero  o helicóptero da Holding pousa na Blade Tower (só render, D61)
 */
export const ETAPAS = /* @__PURE__ */ congelar([
  {
    id: 'lago.e1', parte: 'lago', nome: 'Reservatório e portões', marco: 0, requisito: null,
    creditos: 60000, materiais: { brita: 50, areia: 50 }, minutos: 5, xp: 300, fases: FASES_LAGO,
    efeitos: [
      { tipo: 'vias' },
      { tipo: 'agua', capacidade: 36, moradores: 6000 },
      { tipo: 'valor', v: 60, raio: 600 },
    ],
  },
  {
    id: 'torre.e1', parte: 'torre', nome: 'Fundações e pódio', marco: 3, requisito: 'lago.e1',
    creditos: 150000, materiais: { concreto: 60, brita: 60, aco: 20 }, minutos: 10, xp: 600, fases: FASES_TORRE,
    efeitos: [{ tipo: 'licenca', n: 1 }],
  },
  {
    id: 'torre.e2', parte: 'torre', nome: 'Sede operacional', marco: 4, requisito: 'torre.e1',
    creditos: 300000, materiais: { concreto: 120, aco: 60, vidro: 40 }, minutos: 15, xp: 1000, fases: FASES_TORRE,
    efeitos: [
      { tipo: 'holding', produtividade: 0.15, caminhoes: 6 },
      { tipo: 'vagas', vagas: [0, 0, 600, 600] },
    ],
  },
  {
    id: 'torre.e3', parte: 'torre', nome: 'Moradias de luxo', marco: 5, requisito: 'torre.e2',
    creditos: 350000, materiais: { concreto: 100, aco: 60, vidro: 60 }, minutos: 15, xp: 1200, fases: FASES_TORRE,
    efeitos: [
      { tipo: 'moradores', n: 400, bemEstar: 75 },
      // no M1b também a residencial alta e o escritório (D49)
      { tipo: 'demanda', zonas: { resMedia: 20 }, raio: 1500 },
    ],
  },
  {
    id: 'torre.e4', parte: 'torre', nome: 'Coroa e heliponto', marco: 6, requisito: 'torre.e3',
    creditos: 250000, materiais: { vidro: 50, aco: 30, serrada: 20 }, minutos: 10, xp: 1500, fases: FASES_TORRE,
    efeitos: [
      { tipo: 'atratividade', v: 5 },
      { tipo: 'valor', v: 120, raio: 900 },
      { tipo: 'legado', v: 5 },
      { tipo: 'helicoptero' },
    ],
  },
]);

/** Ids das etapas jogáveis, na ordem (o espelho e o save só têm estas). */
export const ETAPAS_ORDEM = Object.freeze(ETAPAS.map((e) => e.id));

/** Etapa jogável pelo id (null se não for do M1a). */
export const etapaDe = (id) => ETAPAS.find((e) => e.id === id) ?? null;

/** Duração da etapa em tiques (1x). */
export const duracaoDe = (et) => Math.max(1, Math.round(et.minutos * MINUTO));

// ------------------------------------------------------------------------------------------------ M2 (só dados)

/**
 * Etapas do resto da sede (D89), prontas para o M2 e sem jogabilidade no M1a: o id segue a regra de partesProntas do
 * render ('<parte>.eN', e 'horizon.K.e1' trecho a trecho). prazo: o mês do calendário em que a história as conclui
 * (jun. 2026 para a primeira fase, 2032 para os outros 6 trechos do Horizon Ring). Créditos e materiais (calibrar).
 */
const futura = (id, parte, nome, prazo, creditos, materiais) => ({ id, parte, nome, prazo, creditos, materiais, m2: true });
const JUN_2026 = { ano: 2026, mes: 6 };
const DEZ_2032 = { ano: 2032, mes: 12 };
export const ETAPAS_M2 = /* @__PURE__ */ congelar([
  futura('meridian.e1', 'meridian', 'Estrutura do anel', JUN_2026, 900000, { concreto: 400, aco: 200 }),
  futura('meridian.e2', 'meridian', 'Escritórios e jardim do teto', JUN_2026, 700000, { vidro: 300, aco: 80 }),
  futura('codex.e1', 'codex', 'Biblioteca e átrio de livros', JUN_2026, 600000, { concreto: 150, vidro: 200, aco: 90 }),
  futura('helix.e1', 'helix', 'Laboratórios', JUN_2026, 450000, { concreto: 120, vidro: 120, aco: 70 }),
  futura('compass.e1', 'compass', 'Administração', JUN_2026, 450000, { concreto: 120, vidro: 120, aco: 70 }),
  futura('parque.e1', 'parque', 'Parque, floresta e Supertrees', JUN_2026, 300000, { brita: 100, areia: 100, aco: 40 }),
  ...TRECHOS_HORIZON.map((t) =>
    futura(`${t.id}.e1`, 'horizon', `${t.nome}: faculdade e escola`, t.fase === 1 ? JUN_2026 : DEZ_2032, 500000, { concreto: 220, vidro: 160, aco: 90 }),
  ),
]);

// ------------------------------------------------------------------------------------------------ a obra do par

/**
 * Alturas da obra do par (o corte por altura, torre.corte): a Blade sobe do chão ao topo do mastro em 4 etapas, a
 * Legacy acompanha na mesma proporção até o aro da coroa, um quarto de etapa atrás do pódio em diante (a distância
 * fecha na torre.e4: as duas ficam prontas juntas). Metros acima da gleba.
 */
const PODIO = PAR.podio;
const TOPO_BLADE = TORRE_LAMINA.mastro.topo;
const TOPO_LEGACY = TORRE_IRMA.altura;
/** Altura da Blade no fim de cada etapa da torre (e1 o pódio; e4 o mastro). */
export const ALTURAS_BLADE = congelar([0, PODIO, 210, 390, TOPO_BLADE]);
/** Atraso da Legacy (fração de etapa) do pódio em diante. */
export const ATRASO_LEGACY = 0.25;
/** A Dream Bridge entra quando as duas passam do piso do jardim com a folga das árvores dele. */
export const ALTURA_PONTE = PAR.ponte.cota + 8;

const interp = (tab, g) => {
  const k = Math.min(tab.length - 2, Math.max(0, Math.floor(g)));
  const f = Math.min(1, Math.max(0, g - k));
  return tab[k] + (tab[k + 1] - tab[k]) * f;
};

/** Altura da Blade (m) no avanço g da obra da torre (0 a 4: etapa concluída mais o progresso da em obra). */
export const alturaBlade = (g) => interp(ALTURAS_BLADE, Math.min(4, Math.max(0, g)));

/** Avanço da Legacy: igual no pódio, um quarto de etapa atrás no corpo, alcançando a Blade no fim da torre.e4. */
export function avancoLegacy(g) {
  if (g <= 1) return g;
  if (g <= 3) return Math.max(1, g - ATRASO_LEGACY);
  return g - ATRASO_LEGACY * (4 - g);
}

/** Altura da Legacy (m) no avanço g: a proporção da Blade acima do pódio, até o aro da coroa. */
export function alturaLegacy(g) {
  const hb = alturaBlade(avancoLegacy(g));
  if (hb <= PODIO) return hb;
  return PODIO + ((hb - PODIO) * (TOPO_LEGACY - PODIO)) / (TOPO_BLADE - PODIO);
}

/**
 * Avanço da obra da torre (0 a 4) pelas etapas do espelho: as prontas mais o progresso da em obra. -1 sem obra.
 * @param {{ id: string, estado: number, progresso: number }[]} etapas
 */
export function avancoDaTorre(etapas) {
  let g = 0;
  let algum = false;
  for (let k = 1; k <= 4; k++) {
    const e = etapas.find((x) => x.id === `torre.e${k}`);
    if (!e) break;
    if (e.estado === 3) {
      g = k;
      algum = true;
    } else if (e.estado === 2) {
      g = k - 1 + Math.min(1, Math.max(0, e.progresso ?? 0));
      algum = true;
      break;
    } else break;
  }
  return algum ? g : -1;
}
