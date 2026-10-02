// Catálogo dos prédios da cidade, primeira versão (D20). A capacidade (lares, moradores, empregos) sai daqui por modelo
// e nível; o render escolhe a forma dentro da faixa de andares pela semente (D20). F0 criou; dona: S2a. Números:
// (calibrar).
//
// Modelo: { nome, zona, planta: [colunas ao longo da via, linhas de fundo] (células de 8 m), niveis: [5 níveis] }.
// Os modelos de uma coluna (8 m de frente) são os lotes estreitos das cidades brasileiras; os rasos (bar, casa de
// esquina) ocupam a ponta da quadra, onde o bloco de zona perde fundo.
// Nível: { lares, moradores, empregos: [básico, fundamental, médio, superior], agua (m³/h), energia (kW),
//          materiais: { item: unidades }, andares: [min, max], tipologia }.
import { congelar } from '../comum/util.js';

// fração dos empregos por nível de estudo, do nível 1 ao nível 5 do prédio (interpolado)
const ESTUDO = {
  com: [[0.3, 0.4, 0.25, 0.05], [0.1, 0.3, 0.4, 0.2]],
  esc: [[0.05, 0.15, 0.4, 0.4], [0, 0.1, 0.35, 0.55]],
  ind: [[0.5, 0.35, 0.13, 0.02], [0.25, 0.35, 0.3, 0.1]],
};

// consumo por pessoa (morador ou emprego) por hora de jogo (calibrar)
const CONSUMO = { res: [0.006, 1.2], com: [0.004, 2], esc: [0.004, 2.5], ind: [0.01, 4] };

const TIPOLOGIAS = {
  resBaixa: ['casa', 'casa', 'sobradoGeminado', 'sobradoGeminado', 'casaAltoPadrao'],
  resMedia: ['pilotis', 'pilotis', 'varandas', 'varandas', 'varandaGourmet'],
  resAlta: ['torrePodio', 'torrePodio', 'torreVarandas', 'torreVarandas', 'torreVidro'],
  comBaixa: ['lojaToldo', 'lojaToldo', 'galeriaVitrine', 'galeriaVitrine', 'centroPelePerfurada'],
  comAlta: ['galeriaVitrine', 'galeriaVitrine', 'usoMisto', 'usoMisto', 'centroPelePerfurada'],
  escritorio: ['laminaBrises', 'laminaBrises', 'peleVidro', 'peleVidro', 'torreControleSolar'],
  industria: ['galpaoShed', 'galpaoShed', 'galpaoSilos', 'galpaoSilos', 'fabricaLimpa'],
};

const FAMILIA = { resBaixa: 'res', resMedia: 'res', resAlta: 'res', comBaixa: 'com', comAlta: 'com', escritorio: 'esc', industria: 'ind' };

const interp = ([a, b], k) => a + ((b - a) * k) / 4;

function repartir(total, fr) {
  const v = fr.map((f) => Math.floor(total * f));
  v[0] += total - v.reduce((s, x) => s + x, 0);
  return v;
}

/**
 * Monta os 5 níveis de um modelo. pessoas: [nível 1, nível 5] de moradores (residencial) ou empregos; lares idem.
 * andares: 5 faixas [min, max]; materiais do nível 1, crescendo 50% por nível.
 */
function niveis(zona, { lares = null, pessoas, andares, materiais }) {
  const fam = FAMILIA[zona];
  const out = [];
  for (let k = 0; k < 5; k++) {
    const n = Math.round(interp(pessoas, k));
    const res = fam === 'res';
    const empregos = res ? [0, 0, 0, 0] : repartir(n, ESTUDO[fam][0].map((a, i) => a + ((ESTUDO[fam][1][i] - a) * k) / 4));
    const mats = {};
    for (const [item, q] of Object.entries(materiais)) mats[item] = Math.round(q * (1 + 0.5 * k));
    const [aguaP, kwP] = CONSUMO[fam];
    out.push({
      lares: res ? Math.round(interp(lares, k)) : 0,
      moradores: res ? n : 0,
      empregos,
      agua: Math.round(n * aguaP * 1000) / 1000,
      energia: Math.round(n * kwP * 10) / 10,
      materiais: mats,
      andares: andares[k],
      tipologia: TIPOLOGIAS[zona][k],
    });
  }
  return out;
}

const modelo = (nome, zona, planta, spec) => ({ nome, zona, planta, niveis: niveis(zona, spec) });

// Faixas de andares da cidade vertical (D76): a residencial média sobe de 3 a 6 andares no nível 1 até 12 a 25 no
// nível 5; a comercial baixa acompanha em escala menor; a residencial alta (M1b) fica pronta com 30 a 60.
const A_RES_MEDIA = [[3, 6], [4, 8], [6, 12], [9, 18], [12, 25]];
// (as tipologias com varanda por andar, níveis 1 a 4, passam do teto de triângulos do LOD0 acima de uns 37 andares;
// a torre de vidro do nível 5 vai a 60)
const A_RES_ALTA = [[30, 34], [30, 36], [32, 37], [34, 37], [45, 60]];
const A_COM_BAIXA = [[1, 2], [1, 3], [2, 4], [2, 5], [3, 6]];

export const PREDIOS = congelar({
  casaEsquina: modelo('Casa de esquina', 'resBaixa', [1, 2], {
    lares: [1, 1], pessoas: [3, 4], andares: [[1, 1], [1, 2], [2, 2], [2, 2], [2, 3]], materiais: { tijolo: 1, cimento: 1 },
  }),
  casaGeminada: modelo('Casa geminada', 'resBaixa', [1, 3], {
    lares: [1, 1], pessoas: [3, 4], andares: [[1, 2], [2, 2], [2, 2], [2, 3], [2, 3]], materiais: { tijolo: 1, serrada: 1, cimento: 1 },
  }),
  casa: modelo('Casa', 'resBaixa', [2, 2], {
    lares: [1, 1], pessoas: [4, 5], andares: [[1, 1], [1, 2], [2, 2], [2, 2], [2, 3]], materiais: { tijolo: 2, serrada: 1, cimento: 1 },
  }),
  casaFundo: modelo('Casa com quintal', 'resBaixa', [2, 3], {
    lares: [1, 1], pessoas: [4, 5], andares: [[1, 1], [1, 2], [2, 2], [2, 2], [2, 3]], materiais: { tijolo: 2, serrada: 1, cimento: 1 },
  }),
  sobrado: modelo('Sobrado geminado', 'resBaixa', [3, 4], {
    lares: [2, 3], pessoas: [8, 12], andares: [[2, 2], [2, 2], [2, 3], [2, 3], [3, 3]], materiais: { tijolo: 4, serrada: 2, cimento: 2 },
  }),
  // residencial média (D76): uns 13 a 15 moradores por andar no lote de 32 x 40 m, metade dele construída
  predioEstreito: modelo('Prédio estreito', 'resMedia', [2, 4], {
    lares: [8, 38], pessoas: [24, 110], andares: A_RES_MEDIA, materiais: { concreto: 4, tijolo: 3, vidro: 1 },
  }),
  predioBaixo: modelo('Prédio baixo', 'resMedia', [3, 4], {
    lares: [12, 58], pessoas: [36, 170], andares: A_RES_MEDIA, materiais: { concreto: 5, tijolo: 4, vidro: 1 },
  }),
  predioMedio: modelo('Prédio médio', 'resMedia', [4, 5], {
    lares: [20, 96], pessoas: [60, 280], andares: A_RES_MEDIA, materiais: { concreto: 8, tijolo: 6, vidro: 2 },
  }),
  predioLargo: modelo('Prédio largo', 'resMedia', [5, 5], {
    lares: [26, 120], pessoas: [75, 350], andares: A_RES_MEDIA, materiais: { concreto: 10, tijolo: 7, vidro: 3 },
  }),
  // residencial alta (M1b): torres de 30 a 60 andares
  torreRes: modelo('Torre residencial', 'resAlta', [5, 6], {
    lares: [140, 300], pessoas: [420, 900], andares: A_RES_ALTA, materiais: { concreto: 24, vidro: 8, aco: 8 },
  }),
  torreEstreita: modelo('Torre estreita', 'resAlta', [4, 6], {
    lares: [110, 240], pessoas: [320, 700], andares: A_RES_ALTA, materiais: { concreto: 18, vidro: 6, aco: 6 },
  }),
  bar: modelo('Bar de esquina', 'comBaixa', [1, 1], {
    pessoas: [2, 6], andares: [[1, 1], [1, 2], [1, 2], [2, 3], [2, 3]], materiais: { tijolo: 1, vidro: 1 },
  }),
  lojaEstreita: modelo('Loja estreita', 'comBaixa', [1, 2], {
    pessoas: [3, 10], andares: A_COM_BAIXA, materiais: { tijolo: 2, vidro: 1 },
  }),
  loja: modelo('Loja', 'comBaixa', [2, 3], {
    pessoas: [6, 24], andares: A_COM_BAIXA, materiais: { tijolo: 3, vidro: 1 },
  }),
  lojaDupla: modelo('Loja dupla', 'comBaixa', [3, 3], {
    pessoas: [10, 40], andares: A_COM_BAIXA, materiais: { tijolo: 4, vidro: 2 },
  }),
  mercado: modelo('Mercado de bairro', 'comBaixa', [4, 4], {
    pessoas: [16, 60], andares: [[1, 1], [1, 2], [2, 3], [2, 4], [3, 5]], materiais: { tijolo: 5, concreto: 2, vidro: 2 },
  }),
  galeria: modelo('Galeria', 'comAlta', [4, 5], {
    pessoas: [30, 100], andares: [[2, 3], [3, 5], [5, 8], [8, 12], [12, 25]], materiais: { concreto: 12, vidro: 6, aco: 3 },
  }),
  centroComercial: modelo('Centro comercial', 'comAlta', [5, 6], {
    pessoas: [60, 200], andares: [[2, 3], [3, 5], [5, 8], [8, 12], [12, 25]], materiais: { concreto: 20, vidro: 10, aco: 6 },
  }),
  lamina: modelo('Lâmina de escritórios', 'escritorio', [4, 5], {
    pessoas: [80, 260], andares: [[6, 10], [8, 12], [12, 20], [18, 25], [30, 40]], materiais: { concreto: 16, vidro: 10, aco: 6 },
  }),
  torreEscritorios: modelo('Torre de escritórios', 'escritorio', [5, 6], {
    pessoas: [150, 500], andares: [[6, 10], [10, 14], [12, 25], [20, 30], [30, 45]], materiais: { concreto: 24, vidro: 14, aco: 10 },
  }),
  galpaoPequeno: modelo('Galpão pequeno', 'industria', [3, 4], {
    pessoas: [15, 40], andares: [[1, 1], [1, 1], [1, 2], [1, 2], [2, 2]], materiais: { concreto: 6, aco: 3 },
  }),
  galpao: modelo('Galpão', 'industria', [4, 5], {
    pessoas: [30, 80], andares: [[1, 1], [1, 1], [1, 2], [1, 2], [2, 3]], materiais: { concreto: 10, aco: 6 },
  }),
  fabrica: modelo('Fábrica', 'industria', [6, 6], {
    pessoas: [60, 160], andares: [[1, 2], [1, 2], [2, 2], [2, 3], [2, 3]], materiais: { concreto: 16, aco: 10, vidro: 2 },
  }),
});

/** Índice numérico de cada modelo (predios.modelo para tipo 0). Só se acrescenta no fim. */
export const PREDIOS_ORDEM = Object.freeze(Object.keys(PREDIOS));

export const indicePredio = (id) => PREDIOS_ORDEM.indexOf(id);
export const modeloPredio = (m) => PREDIOS[typeof m === 'number' ? PREDIOS_ORDEM[m] : m];

/** Modelos de uma zona (ids), na ordem do catálogo. */
export const modelosDaZona = (z) => PREDIOS_ORDEM.filter((id) => PREDIOS[id].zona === z);

/** Pé-direito de referência por família, em metros (render). */
export const PE_DIREITO = congelar({ res: 3, com: 4.2, esc: 3.8, ind: 8 });

/** Nível n (1 a 5) de um modelo (id ou índice), ou null. */
export const nivelDoModelo = (m, n) => modeloPredio(m)?.niveis[Math.max(1, Math.min(5, n)) - 1] ?? null;

/** Soma das vagas de um nível do catálogo. */
export const somaVagas = (nv) => (nv ? nv.empregos[0] + nv.empregos[1] + nv.empregos[2] + nv.empregos[3] : 0);

/** Níveis de cada modelo pelo índice (predios.modelo): NIVEIS[modelo][nivel - 1]. */
export const NIVEIS = Object.freeze(PREDIOS_ORDEM.map((id) => PREDIOS[id].niveis));
