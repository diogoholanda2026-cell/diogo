// Tipos de via do M1 (seção 2.3, D22) com o perfil transversal e as regras do traçado e das células. Uma fonte só para
// a simulação (custo, regras), o render (perfil) e a UI (catálogo). F0 criou; dona: S1b. Custos e manutenção:
// (calibrar).
//
// Perfil: da borda ESQUERDA para a direita, olhando de a para b. Cada parte: { parte, largura, sentido?, piso?, detalhe? }.
// sentido +1 = faixa de a para b; -1 = de b para a (mão à direita). O meio-fio (0,15 m) fica dentro da calçada.
import { congelar } from '../comum/util.js';

export const MEIO_FIO = congelar({ largura: 0.15, altura: 0.15 });

const calcada = (l) => ({ parte: 'calcada', largura: l });
const faixa = (sentido, l = 3.5, piso = 'asfalto') => ({ parte: 'faixa', largura: l, sentido, piso });

export const VIAS = congelar({
  rua: {
    nome: 'Rua', largura: 16, faixas: [1, 1], mao: 'dupla',
    perfil: [calcada(3), { parte: 'estacionamento', largura: 3 }, faixa(-1), faixa(1), calcada(3)],
    velocidade: 40, capFaixa: 700, custoM: 30, manutKmH: 150, declive: 0.12, raioMin: 20, marco: 0,
    zona: true, redes: true, constroi: true, melhoraPara: ['ruaMao', 'avenida', 'avenidaG'],
  },
  ruaMao: {
    nome: 'Rua de mão única', largura: 16, faixas: [2, 0], mao: 'unica',
    perfil: [calcada(3), { parte: 'estacionamento', largura: 3 }, faixa(1), faixa(1), calcada(3)],
    velocidade: 40, capFaixa: 700, custoM: 32, manutKmH: 150, declive: 0.12, raioMin: 20, marco: 2,
    zona: true, redes: true, constroi: true, melhoraPara: ['rua', 'avenida', 'avenidaG'],
  },
  avenida: {
    nome: 'Avenida', largura: 24, faixas: [2, 2], mao: 'dupla',
    perfil: [calcada(3), faixa(-1), faixa(-1), { parte: 'canteiro', largura: 4, detalhe: 'palmeiras' }, faixa(1), faixa(1), calcada(3)],
    velocidade: 50, capFaixa: 800, custoM: 70, manutKmH: 300, declive: 0.1, raioMin: 40, marco: 0,
    zona: true, redes: true, constroi: true, melhoraPara: ['avenidaG'],
  },
  avenidaG: {
    nome: 'Avenida grande', largura: 32, faixas: [3, 3], mao: 'dupla',
    perfil: [
      calcada(3.5), faixa(-1), faixa(-1), faixa(-1), { parte: 'canteiro', largura: 4, detalhe: 'arvores' },
      faixa(1), faixa(1), faixa(1), calcada(3.5),
    ],
    velocidade: 60, capFaixa: 850, custoM: 130, manutKmH: 500, declive: 0.08, raioMin: 60, marco: 4,
    zona: true, redes: true, constroi: true, melhoraPara: [],
  },
  rodovia: {
    nome: 'Rodovia', largura: 28, faixas: [2, 2], mao: 'dupla',
    perfil: [
      { parte: 'talude', largura: 3 }, { parte: 'acostamento', largura: 2.5 }, faixa(-1), faixa(-1),
      { parte: 'barreira', largura: 3 }, faixa(1), faixa(1), { parte: 'acostamento', largura: 2.5 }, { parte: 'talude', largura: 3 },
    ],
    velocidade: 100, capFaixa: 1800, custoM: null, manutKmH: 0, declive: 0.06, raioMin: 250, marco: null,
    zona: false, redes: false, constroi: false, melhoraPara: [], doMapa: true,
  },
  terra: {
    nome: 'Rua de terra', largura: 10, faixas: [1, 1], mao: 'dupla',
    perfil: [faixa(-1, 5, 'terra'), faixa(1, 5, 'terra')],
    velocidade: 30, capFaixa: 400, custoM: null, manutKmH: 20, declive: 0.15, raioMin: 15, marco: null,
    zona: false, redes: false, constroi: false, melhoraPara: ['rua'], doMapa: true,
  },
});

/** Índice numérico de cada tipo (arestas.tipo no espelho e no save). Só se acrescenta no fim. */
export const VIAS_ORDEM = Object.freeze(['rua', 'ruaMao', 'avenida', 'avenidaG', 'rodovia', 'terra']);

/** Índice do tipo (ou -1). */
export const indiceVia = (id) => VIAS_ORDEM.indexOf(id);

/** Tipo de via de um índice ou id. */
export const via = (tipo) => VIAS[typeof tipo === 'number' ? VIAS_ORDEM[tipo] : tipo];

/** Meia largura em metros. */
export const meiaLargura = (tipo) => via(tipo).largura / 2;

/** Grade de ruas: distância entre eixos que dá 6 células de cada lado (seção 2.3). */
export const GRADE_EIXOS = congelar({ rua: 112, ruaMao: 112, avenida: 120, avenidaG: 128 });

/** Folga do raio do nó: maior meia largura que chega mais 2 m (seção 5.3 do desenho da simulação). */
export const FOLGA_NO = 2;

/**
 * Regras do traçado (seção 5 do desenho da simulação, D18, D32). Metros e graus; os números marcados são ponto de
 * partida (calibrar).
 */
export const REGRAS_VIAS = congelar({
  anguloMin: 30, // entre duas vias no mesmo nó (e no cruzamento)
  grauMax: 6,
  compMinTrecho: 8, // cada trecho depois de dividir
  compMinTracado: 16, // a via nova inteira
  noNoCruzamento: 8, // um cruzamento a menos disto de um nó passa pelo nó
  tolerancia: 8, // encaixe padrão; a UI manda a sua (20 px do polegar em metros)
  folgaAngulo: 3, // encaixe de ângulo, prolongamento e passo
  passoAngulo: 15,
  passoComprimento: 8, // comprimento múltiplo da célula
  fundoZona: 48, // 6 células de 8 m: as guias de quadra ficam a uma ou duas quadras da via vizinha
  alcanceGuias: 160,
  folgaPredio: 0.5, // prédio a menos disto da pista sai na demolição da via (calibrar)
  corteMax: 10, // corte ou aterro máximo no eixo; acima disso o terreno é íngreme demais ('declive', calibrar)
  amostra: 4, // passo das amostras da validação
  greideJanela: 40, // média móvel do chão para o greide
  greideTolerancia: 0.35, // desvio máximo do greide linear de cada aresta
  greideTrechoMin: 32, // aresta mínima entre dois nós de greide
  vizinhanca: 60, // células revalidadas em volta da via que mudou
  desfazerMax: 10,
  devolucao: 0.5, // demolir devolve 50% (100% se a via é da mesma sessão da ferramenta)
});

/** Regras das células de zona (seção 6.1 do desenho da simulação). Metros. */
export const REGRAS_CELULAS = congelar({
  desnivelMax: 4, // chão variando mais que isto na célula: inválida
  folgaVia: 4, // centro a menos de meia largura + 4 m de outra via: inválida
  folgaCurva: 4, // lado de dentro da curva com raio menor que o deslocamento + 4 m: inválida
  folgaGleba: 4,
  esquina: 7, // duas células de blocos diferentes a menos disto: fica a de linha menor (empate: bloco mais antigo)
  transferencia: 4, // a pintura passa para a célula nova mais perto até esta distância
  folgaPredio: 3, // centro a menos disto da planta de um prédio que não é dela: inválida
});
