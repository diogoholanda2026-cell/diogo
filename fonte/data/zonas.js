// Tipos de zona (D23): 4 no M1a e mais 3 no M1b. Cor por família; escritório é azul com hachura a 45 graus;
// a densidade aparece pela borda (a UI desenha). F0 cria; S2a mantém.
import { congelar } from '../comum/util.js';

export const FAMILIAS_ZONA = congelar({
  res: { nome: 'Residencial', cor: '#199e70' },
  com: { nome: 'Comercial', cor: '#3987e5' },
  ind: { nome: 'Indústria', cor: '#c98500' },
  esc: { nome: 'Escritórios', cor: '#3987e5', hachura: 45 },
});

export const ZONAS = congelar({
  resBaixa: { nome: 'Residencial baixa', familia: 'res', densidade: 1, cor: '#199e70', marco: 0, parte: 'M1a', andares: [1, 3] },
  resMedia: { nome: 'Residencial média', familia: 'res', densidade: 2, cor: '#199e70', marco: 2, parte: 'M1a', andares: [4, 16] },
  resAlta: { nome: 'Residencial alta', familia: 'res', densidade: 3, cor: '#199e70', marco: 4, parte: 'M1b', andares: [15, 60] },
  comBaixa: { nome: 'Comercial baixa', familia: 'com', densidade: 1, cor: '#3987e5', marco: 0, parte: 'M1a', andares: [1, 3] },
  comAlta: { nome: 'Comercial alta', familia: 'com', densidade: 2, cor: '#3987e5', marco: 3, parte: 'M1b', andares: [2, 25] },
  escritorio: { nome: 'Escritórios', familia: 'esc', densidade: 2, cor: '#3987e5', hachura: 45, marco: 3, parte: 'M1b', andares: [6, 45] },
  industria: { nome: 'Indústria', familia: 'ind', densidade: 1, cor: '#c98500', marco: 0, parte: 'M1a', andares: [1, 3] },
});

/** Índice numérico (celulas.zona e predios.zona). 0 = sem zona (apagar). Só se acrescenta no fim. */
export const ZONAS_ORDEM = Object.freeze(['', 'resBaixa', 'resMedia', 'resAlta', 'comBaixa', 'comAlta', 'escritorio', 'industria']);

export const indiceZona = (id) => ZONAS_ORDEM.indexOf(id);
export const zona = (z) => ZONAS[typeof z === 'number' ? ZONAS_ORDEM[z] : z];
