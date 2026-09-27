// Plano da Arcologia. A F0 grava o ENVELOPE da gleba no platô, a Torre Lâmina da D27 e a câmera; o integrador grava o
// plano escolhido no portão 1 (gleba, portões, vias internas, posição e orientação da Torre, D59); X1a e X1b detalham.
// mapa-heldopolis.js (S1a) importa a gleba daqui e assenta o platô em volta dela. Metros; x leste, z sul.
import { congelar } from '../comum/util.js';

/**
 * Envelope da gleba: retângulo no platô entre a lagoa (sudoeste) e a baía (sul e leste), dentro da área inicial de
 * 4 x 4 ladrilhos ([-1024, 1024] nos dois eixos). Cabe qualquer um dos três planos (A Baía, B Parque-canal, C Orla).
 * A cota é a do platô que S1a assenta; cidade e vias não entram (código 'gleba').
 */
export const GLEBA_ENVELOPE = congelar({
  contorno: [-340, 180, 660, 180, 660, 940, -340, 940], // pares x, z, sentido horário visto de cima
  caixa: [-340, 180, 660, 940],
  centro: [160, 560],
  cota: 12,
  nota: 'provisório até o portão 1; o plano escolhido pode encolher, nunca sair do envelope',
});

/**
 * Torre Lâmina (D27): planta de 36 x 50 m com o lado estreito (36 m) para a baía; três lâminas verticais coladas pelo
 * lado comprido, a mais alta na face lisa e a mais baixa do lado das penas (terraços para a baía). Cotas em metros.
 * Conta das alturas: pódio 16 + 35 pavimentos até 163 (terraço da lâmina 3) + andar de vento 1 (163 a 169)
 * + 15 pavimentos até 232 + andar de vento 2 (232 a 238, terraço da lâmina 2) + 15 pavimentos até 301 = 65 pavimentos.
 */
export const TORRE_LAMINA = congelar({
  planta: { largura: 36, comprimento: 50, ladoEstreitoPara: 'baia' },
  podio: { altura: 16, marquise: 12 },
  // da face lisa para as penas: fundo de cada lâmina ao longo dos 50 m e cota do terraço-jardim que a fecha
  laminas: [
    { largura: 36, fundo: 26, topo: 301 },
    { largura: 36, fundo: 14, topo: 238 },
    { largura: 36, fundo: 10, topo: 163 },
  ],
  pavimentos: { n: 65, altura: 4.2 },
  andaresDeVento: [
    { base: 163, altura: 6, recuo: 2 },
    { base: 232, altura: 6, recuo: 2 },
  ],
  // andares de vento com vidro claro, forro claro iluminado e montantes contínuos: nunca mais escuros que o corpo
  faceLisa: { costura: 6, vidro: 'escuro', aletas: 'densas' },
  aletas: { passo: 1.5, material: 'bronze', faces: 'laterais' },
  coroa: { base: 301, altura: 29, oca: 12 },
  heliponto: { cota: 330, balanco: 16 },
  mastro: { topo: 350 },
  triangulos: {
    lod0: { media: [12000, 20000], alta: [40000, 80000], ultra: [40000, 80000] },
    lod1: [3000, 5000],
  },
});

/**
 * Posição provisória da Torre (até o integrador gravar o plano): no envelope, perto da borda da baía.
 * rot na convenção do three; com rot = 0 a frente (lado das penas) olha para +z (sul, a baía).
 */
export const TORRE_POSICAO = congelar({ x: 160, z: 700, rot: 0, provisoria: true });

/** Ponto de pouso do helicóptero da Holding (D61): o heliponto em balanço sobre a baía. */
export const POUSO = congelar({ x: 160, y: 330, z: 700 + 25 + 8, provisorio: true });

/** Câmera da Arcologia (voos e o botão da barra). Ângulos em graus (contratos/render.js). */
export const CAMERA_ARCOLOGIA = congelar({ x: 160, z: 640, dist: 1100, guinada: 340, inclinacao: 18 });

/** Os três planos candidatos da D59, como dados (X1a preenche; o integrador escolhe no portão 1). */
export const PLANOS = congelar({ A: null, B: null, C: null });

/** Plano escolhido ('A' | 'B' | 'C'); null até o portão 1. */
export const PLANO_ESCOLHIDO = null;
