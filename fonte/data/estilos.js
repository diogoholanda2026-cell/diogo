// Paletas e tipologias de Heldópolis para o gerador de prédios (R4a; desenho do render 5.1, D20 e D39). Só dados: o
// gerador (render/geracao/planoPredio.js) lê daqui e escolhe pela semente. O M1 tem só Heldópolis; as outras
// metrópoles entram no M5 como outras tabelas com o mesmo formato.
//
// Cores em sRGB (como se veem na foto); o shader da fachada converte para linear. Albedo real: nada acima de 0,80
// linear (#e6 em sRGB) e nada saturado (seção 9.2 do desenho). Tons tirados de fachadas brasileiras reais: reboco de
// casa (branco-gelo, areia, ocre, rosa antigo, verde acinzentado), concreto aparente, pastilha dos prédios dos anos 60
// a 80, tijolo baiano, telha cerâmica envelhecida, caixilho de alumínio e vidro de controle solar.
import { congelar } from '../comum/util.js';

/** Paletas por material. */
export const PALETAS = congelar({
  // reboco pintado claro (prédios, casas de alto padrão): branco-gelo, areia, palha, cinza claro
  rebocoClaro: ['#e2ddd2', '#ddd5c4', '#d8cfbd', '#e0dbd1', '#d3cdc2', '#cfc6b4', '#dad2c0', '#cdcdc6', '#d6d0c2'],
  // reboco colorido de casa e de comércio de rua (tons gastos pelo sol)
  rebocoCor: ['#cfae83', '#c49a78', '#bd8c73', '#c9a99a', '#a8b3a0', '#a2b1b6', '#d3c28f', '#b9ae9c', '#c8b59a', '#b8a58c', '#c7b9a6', '#b4a98f'],
  // chapisco e reboco sem pintura (casa em construção, muro de autoconstrução)
  chapisco: ['#9e9a92', '#a8a298', '#938f88', '#aaa396'],
  concreto: ['#aaa59c', '#9f9a90', '#b4afa5', '#a39f97'],
  // pastilha: os tons dos prédios dos anos 60 a 90 (bege, branca gasta, cinza-azulada, verde-oliva, marrom)
  pastilha: ['#c9c3b5', '#d0ccc2', '#a8b1b4', '#b8a68b', '#94a095', '#9ea8ab', '#c4b8a2', '#a78e77', '#b9bcb6'],
  tijolo: ['#9a5d45', '#a4684b', '#8e5641'],
  madeira: ['#7b5b40', '#8e6c4c', '#6e5039'],
  pedra: ['#8e8a84', '#b3aa9b', '#6f6c69', '#a39b8e'],
  caixilho: ['#cfd1cf', '#3b3d3f', '#5c4b3b', '#dedfdb', '#8a8d8e'],
  vidro: ['#2b3a45', '#343f3a', '#3d3631', '#2a2f35', '#324251'],
  telha: ['#94604c', '#8a5846', '#9b6853', '#7e5244', '#8f5f4e', '#86604f'],
  // fibrocimento ondulado, cinza e escurecido pelo tempo
  fibro: ['#8e8d88', '#9a9892', '#85847e', '#a19f98'],
  telhaMetal: ['#9ea4a7', '#8b9296', '#a7a59d'],
  // caixa d'água de fibra (azul desbotado pelo sol) ou de polietileno cinza
  caixaAgua: ['#557a93', '#5e7f96', '#6b8698', '#aeb1ae'],
  laje: ['#8f8b84', '#a09a8f', '#7d7973', '#978f82'],
  toldo: ['#4b5b4f', '#6b3b35', '#3f4b58', '#857655', '#5e5e5c', '#7a5a3a'],
  galpao: ['#b9bcbb', '#a6adb0', '#c1bdb1', '#8f999d', '#aeb3a8', '#c6c7c2'],
  letreiro: ['#8e3a2e', '#2e4a63', '#9a7a3a', '#3d5c48', '#6b3a48', '#c9c4b8', '#3a3a3a'],
  metal: ['#8e9396', '#6f7477', '#a3a6a4'],
  piso: ['#8a857c', '#77736c', '#9a948a'],
  verde: ['#4c5a3a', '#56603f', '#465236'],
});

/**
 * Estilos de bairro (predios.estilo, 0 a 3): puxam a escolha de fachada e de paleta dentro da tipologia. O CS2 muda o
 * visual a cada dois níveis; aqui o estilo do bairro muda o sotaque (modernista carioca, contemporâneo paulista,
 * popular de autoconstrução, orla de Santos e Balneário) e o nível muda a tipologia.
 */
export const ESTILOS_BAIRRO = congelar([
  { id: 'modernista', nome: 'Modernista', paredes: ['pastilha', 'rebocoClaro', 'concreto'], fachadas: { fita: 1.5, janela: 3, briseH: 1.2, briseV: 1.5, cobogo: 1.5, painel: 1, cortina: 1, pastilha: 2 }, telha: 0.45, popular: 0.3 },
  { id: 'contemporaneo', nome: 'Contemporâneo', paredes: ['rebocoClaro', 'concreto', 'pastilha'], fachadas: { cortina: 3, janela: 3, fita: 0.5, briseV: 2, painel: 2, cobogo: 0.5 }, telha: 0.35, popular: 0.2 },
  { id: 'popular', nome: 'Popular', paredes: ['rebocoCor', 'rebocoClaro', 'tijolo'], fachadas: { janela: 5, fita: 0.5, pastilha: 1, cobogo: 1 }, telha: 0.6, popular: 0.8 },
  { id: 'orla', nome: 'Orla', paredes: ['rebocoClaro', 'pastilha', 'rebocoCor'], fachadas: { janela: 3, fita: 1, cortina: 2, briseV: 1, varanda: 3, pastilha: 1 }, telha: 0.4, popular: 0.25 },
]);

/**
 * Parâmetros de cada tipologia (os nomes são os de data/predios.js). pe: pé-direito dos andares de cima; terreo: altura
 * do térreo (ou dos pilotis); recuo: frente [min, max] em metros; paredes: paletas possíveis; alturaMax: fator sobre o
 * teto de andares do catálogo para os testes (topo com casa de máquinas e coroa).
 */
export const TIPOLOGIAS = congelar({
  casa: { pe: 2.9, recuo: [2.5, 5], telha: 0.62 },
  sobradoGeminado: { pe: 2.9, recuo: [2, 4], telha: 0.5 },
  casaAltoPadrao: { pe: 3.2, recuo: [4, 7], telha: 0.05 },
  pilotis: { pe: 2.9, terreo: [3.6, 4.4], recuo: [3, 6] },
  varandas: { pe: 2.9, terreo: [3.2, 4], recuo: [3, 5] },
  varandaGourmet: { pe: 3.0, terreo: [4, 5], recuo: [4, 6] },
  torrePodio: { pe: 2.9, terreo: [4, 5], recuo: [4, 6] },
  torreVarandas: { pe: 2.9, terreo: [4.5, 5.5], recuo: [4, 6] },
  torreVidro: { pe: 3.2, terreo: [5.5, 7], recuo: [5, 8] },
  lojaToldo: { pe: 3.0, terreo: [4.2, 4.8], recuo: [0, 0] },
  galeriaVitrine: { pe: 3.8, terreo: [4.5, 5.2], recuo: [0, 2] },
  usoMisto: { pe: 3.2, terreo: [4.8, 5.4], recuo: [0, 2] },
  centroPelePerfurada: { pe: 4.2, terreo: [5.5, 6.5], recuo: [3, 6] },
  laminaBrises: { pe: 3.6, terreo: [4.5, 6], recuo: [4, 8] },
  peleVidro: { pe: 3.8, terreo: [5, 6.5], recuo: [4, 8] },
  torreControleSolar: { pe: 4.0, terreo: [6, 8], recuo: [5, 8] },
  galpaoShed: { pe: 8, recuo: [3, 6] },
  galpaoSilos: { pe: 9, recuo: [3, 6] },
  fabricaLimpa: { pe: 7, recuo: [4, 8] },
});

/** Cores que o jogador escolhe para um prédio (predios.cor, 1 a 6; 0 = a do gerador). Tons nobres e gastos. */
export const CORES_PREDIO = congelar([null, '#c9b38a', '#4a4f55', '#3f5b66', '#6f7a5a', '#a0654a', '#6e3b3f']);

/** Distâncias de troca de LOD por perfil (metros da câmera à caixa do setor); lod0 fica em render/motor/perfis.js. */
export const LOD_PREDIOS = congelar({
  ultra: { lod2: 6000, cache: 64, memoriaMB: 400 },
  alta: { lod2: 4000, cache: 32, memoriaMB: 160 },
  media: { lod2: 2500, cache: 16, memoriaMB: 64 },
  leve: { lod2: 1500, cache: 12, memoriaMB: 48 },
});

/** O que o M1 tem: só Heldópolis. */
export const ESTILOS = congelar({
  heldopolis: { nome: 'Heldópolis', paletas: 'PALETAS', bairros: ESTILOS_BAIRRO.map((b) => b.id), tipologias: Object.keys(TIPOLOGIAS) },
});
