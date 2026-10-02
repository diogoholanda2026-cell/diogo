// Tipos de zona (D23): 4 no M1a e mais 3 no M1b, num registro extensível (uma entrada por zona; a moradia social da
// D72 e o turismo entram depois como entradas novas, sem código especial). Cor por família; escritório é azul com
// hachura a 45 graus; a densidade aparece pela borda (a UI desenha). F0 criou; dona: S2a.
//
// Cada zona diz a família (res, com, ind, esc: o papel na demanda e no mercado de trabalho), a parte do jogo em que
// entra, o marco, a faixa de andares (D76), o ritmo de nascimento e como a demanda da família se divide entre as zonas
// dela (seção 6.4 do desenho da simulação). Números de crescimento e demanda: (calibrar).
import { congelar } from '../comum/util.js';

export const FAMILIAS_ZONA = congelar({
  res: { nome: 'Residencial', cor: '#199e70' },
  com: { nome: 'Comercial', cor: '#3987e5' },
  ind: { nome: 'Indústria', cor: '#c98500' },
  esc: { nome: 'Escritórios', cor: '#3987e5', hachura: 45 },
});

/** Parte do jogo em curso: zona de uma parte depois desta fica trancada (sem demanda e sem nascimento). */
export const PARTE_ATUAL = 'M1a';
const PARTES = ['M1a', 'M1b', 'M2', 'M3', 'M4'];

// split: peso de cada nível de estudo (básico, fundamental, médio, superior) na divisão da demanda da família;
// valor: peso do valor do terreno (0 a 1000, normalizado) e o mínimo para a zona nascer; taxa: prédios por tique com
// demanda 100 (o acumulador da seção 6.5); rodovia: prefere frentes ligadas à rodovia (indústria, D52)
export const ZONAS = congelar({
  resBaixa: {
    nome: 'Residencial baixa', familia: 'res', densidade: 1, cor: '#199e70', marco: 0, parte: 'M1a', andares: [1, 3],
    taxa: 0.4, split: [1, 0.9, 0.3, 0.1], valor: { peso: -0.3, min: 0 },
    faz: 'abriga famílias que pagam a Contribuição',
  },
  resMedia: {
    nome: 'Residencial média', familia: 'res', densidade: 2, cor: '#199e70', marco: 2, parte: 'M1a', andares: [3, 25],
    taxa: 0.4, split: [0.5, 0.8, 1, 0.8], valor: { peso: 0.6, min: 0 },
    faz: 'abriga famílias em apartamentos e paga a Contribuição',
  },
  resAlta: {
    nome: 'Residencial alta', familia: 'res', densidade: 3, cor: '#199e70', marco: 4, parte: 'M1b', andares: [30, 60],
    taxa: 0.4, split: [0, 0.2, 0.7, 1], valor: { peso: 1, min: 450 },
    faz: 'abriga famílias em torres e paga a Contribuição',
  },
  comBaixa: {
    nome: 'Comercial baixa', familia: 'com', densidade: 1, cor: '#3987e5', marco: 0, parte: 'M1a', andares: [1, 6],
    taxa: 0.2, split: [1, 1, 1, 1], valor: { peso: 0.2, min: 0 },
    faz: 'vende para os moradores e emprega o bairro',
  },
  comAlta: {
    nome: 'Comercial alta', familia: 'com', densidade: 2, cor: '#3987e5', marco: 3, parte: 'M1b', andares: [2, 25],
    taxa: 0.2, split: [0.4, 0.8, 1, 1], valor: { peso: 1, min: 400 },
    faz: 'reúne lojas e serviços para a cidade inteira',
  },
  escritorio: {
    nome: 'Escritórios', familia: 'esc', densidade: 2, cor: '#3987e5', hachura: 45, marco: 3, parte: 'M1b', andares: [6, 45],
    taxa: 0.1, split: [1, 1, 1, 1], valor: { peso: 0.8, min: 0 },
    faz: 'emprega quem estudou mais',
  },
  industria: {
    nome: 'Indústria', familia: 'ind', densidade: 1, cor: '#c98500', marco: 0, parte: 'M1a', andares: [1, 3],
    taxa: 0.15, split: [1, 1, 1, 1], valor: { peso: -0.2, min: 0 }, rodovia: true,
    faz: 'fabrica mercadoria para o comércio',
  },
});

/** Índice numérico (celulas.zona e predios.zona). 0 = sem zona (apagar). Só se acrescenta no fim. */
export const ZONAS_ORDEM = Object.freeze(['', 'resBaixa', 'resMedia', 'resAlta', 'comBaixa', 'comAlta', 'escritorio', 'industria']);

export const indiceZona = (id) => ZONAS_ORDEM.indexOf(id);
export const zona = (z) => ZONAS[typeof z === 'number' ? ZONAS_ORDEM[z] : z];

/** true se a zona já existe na parte do jogo (padrão: a atual). */
export function zonaNaParte(z, parte = PARTE_ATUAL) {
  const def = zona(z);
  return !!def && PARTES.indexOf(def.parte) <= PARTES.indexOf(parte);
}

/** Zonas de uma família, na ordem do índice. */
export const zonasDaFamilia = (fam) => ZONAS_ORDEM.filter((id) => id && ZONAS[id].familia === fam);

/**
 * Requisitos para subir ao nível n (2 a 5), iguais para todas as zonas (seção 6.6 do desenho da simulação): redes
 * (água e energia; esgoto no M1b), serviços na via do prédio, lazer a até 600 m, valor do terreno e bem-estar
 * (moradia) ou ocupação (trabalho). (calibrar)
 */
export const REQUISITOS_NIVEL = congelar([
  null,
  null,
  { redes: true },
  { redes: true, servicos: ['saude', 'educacao'] },
  { redes: true, servicos: ['saude', 'educacao', 'seguranca', 'bombeiros', 'lazer'] },
  { redes: true, servicos: ['saude', 'educacao', 'seguranca', 'bombeiros', 'lazer'], valor: 600, bemEstar: 70, ocupacao: 0.9 },
]);
