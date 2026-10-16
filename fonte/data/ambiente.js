// Ambiente do M1b (seção 10.1 do desenho da simulação, D50; dona: S2b): poluição do ar, ruído e o que eles fazem no
// bem-estar e no valor do terreno. Os números são de partida (calibrar). A parte do jogo em que valem é o M1b: no M1a
// a grade fica em zero e nada muda (ambiente.js confere a parte).
//
// Fonte: { ar, ruido, raio, ... }. `ar` e `ruido` são o índice de pico (0 a 255) perto da fonte com o porte cheio; `raio`
// (m) é o alcance do ruído (o ar anda pelo vento e pela difusão). `porte` é o número de empregos ocupados que dá o
// porte cheio (a fonte fica mais fraca com menos gente e até 1,5 vez mais forte com mais); `nivel` é a fração que cada
// nível acima do 1 tira da fonte (a indústria polui menos quando sobe de nível, seção 6.6).
import { congelar } from '../comum/util.js';

/** A grade: 128 x 128 de 64 m sobre o mapa de 8.192 m, um byte por célula (índice de 0 a 255). */
export const GRADE_AMBIENTE = congelar({ n: 128, passo: 64, origem: [-4096, -4096] });

export const AMBIENTE = congelar({
  /** Fatias por rodada (a grade em faixas de linhas: o tique fica abaixo de 0,5 ms mesmo com a cidade cheia). */
  fatias: 4,
  /** Ar: por rodada sai este tanto da nuvem (decaimento de 10%), uma passada de difusão e o vento do mês a desloca. */
  ar: { decaimento: 0.1, difusao: 0.5, vento: { min: 0.08, max: 0.3 }, emissao: 1.4 },
  /** Bem-estar (D50): do `de` ao `ate` o termo cai linearmente até o máximo. */
  bemEstar: {
    ar: { max: -15, de: 24, ate: 190 },
    ruido: { max: -10, de: 40, ate: 180 },
    esgoto: -15,
  },
  /** Valor do terreno (seção 10.2): pontos tirados por unidade do índice (a razão 1 para 0,6 é a da seção). */
  valor: { ar: 0.6, ruido: 0.36 },
  /** O prédio residencial ganha o aviso de poluição alta com o índice acima destes. */
  aviso: { ar: 110, ruido: 120 },
  /** Alerta da cidade: fração dos moradores sob poluição alta. */
  alerta: { fracao: 0.15 },
});

/** Fontes dos prédios, por chave. A indústria zoneada e o comércio vêm da família da zona. */
export const FONTES = congelar({
  industria: { nome: 'Indústria', ar: 150, ruido: 120, raio: 288, porte: 60, nivel: 0.12 },
  comercio: { nome: 'Comércio', ar: 0, ruido: 46, raio: 128, porte: 30, nivel: 0 },
  // prédios da Holding que cavam e queimam (seção 10.1 e a revisão da linha de corte): porte fixo, funcionando
  pedreira: { nome: 'Pedreira', ar: 125, ruido: 175, raio: 352 },
  mina: { nome: 'Mina de calcário', ar: 105, ruido: 150, raio: 320 },
  cimenteira: { nome: 'Cimenteira', ar: 195, ruido: 130, raio: 320 },
  // serviço
  termica: { nome: 'Termelétrica a gás', ar: 170, ruido: 105, raio: 320 },
});

/** Vias grandes: ruído e ar por amostra de 64 m, vezes o fluxo (1 sem fluxo calculado). */
export const FONTES_VIA = congelar({
  avenida: { ar: 0, ruido: 44, raio: 128 },
  avenidaG: { ar: 18, ruido: 78, raio: 192 },
  rodovia: { ar: 24, ruido: 96, raio: 224 },
});

/** Fluxo (veículos por hora, os dois sentidos) que dá o fator 1; o fator vai de 0,35 a 1,5. */
export const FLUXO_REFERENCIA = 1500;

/** Faixas do índice para a legenda das camadas Ar e Ruído. */
export const FAIXAS_AMBIENTE = congelar([0, 64, 128, 192, 255]);
