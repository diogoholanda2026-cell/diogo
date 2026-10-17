// Dados da parcela ZON2 (D112 e D113): o Distrito Industrial, a Zona de Utilidades, o vento predominante, as redes de
// longo alcance e os modos de crescimento da zona. Só dados: a regra mora em fonte/sim/zon2.js. Metros; x leste, z sul.
//
// Onde ficam (mapa de Heldópolis, centro da sede em (200, 190)):
//  - Distrito Industrial: o corredor plano da rodovia, ao norte do Maciço da Pedreira e do Mirante, e a planície alta do
//    calcário a noroeste: de x = -1540 a -120, de z = -1400 a -1080 (e a planície do calcário, até z = -1530). É o único chão
//    plano e seco da região (os morros ao sul passam de 30% de declive), fica a 1,5 km ou mais do centro da sede e a
//    sotavento (o vento predominante sopra do sul-sudeste para o norte-noroeste, e o distrito está nessa direção). Cobre o
//    ladrilho (5, 5) do calcário, então a Mina continua onde sempre esteve (CALCARIO em mapa-heldopolis.js), e a estrada de
//    terra da Vila, que chega à rodovia pelo meio dele.
//  - Zona de Utilidades: a margem leste do Rio Held e o trecho da várzea logo a oeste, de x = -1560 a -900 e de
//    z = -640 a 364, rio acima da Vila (a captação "acima da Vila" da decisão vila.agua, que fica na ponta sul). Fica a
//    mais de 1 km do centro da sede e termina antes da borda da Vila. A Vila e a orla ficam de fora das duas áreas.
import { congelar } from '../comum/util.js';

/** Vento predominante: sopra do sul-sudeste (a brisa do mar) para o norte-noroeste. `angulo` em radianos, no sentido
 * de +x para +z (o do deslocamento da nuvem de ar, sim/ambiente.js); `dispersao` é o quanto o vento do mês foge dele. */
export const VENTO_PREDOMINANTE = congelar({
  de: 'sul-sudeste',
  para: 'norte-noroeste',
  angulo: -1.9,
  dispersao: 1.1,
});

/** Distrito Industrial (área nomeada do mapa, id 'distritoIndustrial'): a única parte do mapa onde se pinta indústria. */
export const DISTRITO_INDUSTRIAL = congelar({
  id: 'distritoIndustrial',
  nome: 'Distrito Industrial',
  contorno: [[-1540, -1530], [-1040, -1530], [-1040, -1400], [-120, -1400], [-120, -1080], [-1540, -1080]],
});

/** Zona de Utilidades (área nomeada do mapa, id 'zonaUtilidades'): a única parte do mapa onde se põem as utilidades. */
export const ZONA_UTILIDADES = congelar({
  id: 'zonaUtilidades',
  nome: 'Zona de Utilidades',
  contorno: [[-1560, -640], [-900, -640], [-900, 364], [-1560, 364]],
});

/**
 * Tipos que só podem ser colocados na Zona de Utilidades. Entram pelo campo `zona: 'utilidades'` do catálogo (captação,
 * poço, usina solar, ETE e termelétrica já trazem) e por esta lista, que reserva os ids dos que ainda vão entrar
 * (tratamento de água, hidrelétrica, subestação e data center): o tipo que aparecer no catálogo com um desses ids já
 * obedece à regra, sem tocar no código.
 */
export const TIPOS_UTILIDADES = congelar([
  'captacao', 'poco', 'tratamentoAgua', 'solar', 'ete', 'hidreletrica', 'termica', 'subestacao', 'dataCenter',
]);

/**
 * Rede de longo alcance: o produtor da Zona de Utilidades que não está numa via com canos e cabos liga à rede da cidade
 * por uma linha reta até o nó mais perto de uma via com redes. A linha se paga na obra: metros x custo por metro da
 * categoria dele (unidades por metro). Além de `alcanceMax` não há linha (o aviso de sem rede segue). (calibrar)
 */
export const LONGO_ALCANCE = congelar({
  custoPorMetro: { agua: 8, energia: 5, esgoto: 8 },
  alcanceMax: 3000,
});

/** Modos de crescimento da zona pintada (D113) e os limites do lote do modo Manual (D110: de 1 a 1000). */
export const MODOS_CRESCIMENTO = congelar(['automatico', 'manual']);
export const MODO_PADRAO = 'automatico';
export const LOTE_MIN = 1;
export const LOTE_MAX = 1000;

/**
 * As regras de lugar (indústria só no distrito, utilidades só na zona) estão ligadas? Binding vivo, como PARTE_ATUAL: só os
 * testes de outras parcelas, que montam ruas e prédios em qualquer ponto do mapa, desligam (definirRegrasDeLugar(false))
 * e devolvem o valor no fim. No jogo ficam sempre ligadas, também no Modo livre.
 */
export let REGRAS_DE_LUGAR = true;

/** Liga ou desliga as regras de lugar (só os testes). Devolve o valor anterior. */
export function definirRegrasDeLugar(ligadas) {
  const antes = REGRAS_DE_LUGAR;
  REGRAS_DE_LUGAR = !!ligadas;
  return antes;
}

/**
 * O vento do mês segue o predominante (padrão) ou sorteia a direção inteira, como antes da ZON2? Binding vivo: só os testes do
 * ambiente, que montam fontes e casas em qualquer lado, ligam o vento aleatório. Devolve o valor anterior.
 */
export let VENTO_ALEATORIO = false;
export function definirVentoAleatorio(ligado) {
  const antes = VENTO_ALEATORIO;
  VENTO_ALEATORIO = !!ligado;
  return antes;
}
