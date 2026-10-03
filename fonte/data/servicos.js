// Serviços e utilidades (seção 8.1 do desenho da simulação, D50, D52, D60): os 8 do M1a (captação, poço, usina solar,
// praça, clínica, escola fundamental, delegacia e bombeiros) e os 6 do M1b, que ficam prontos nos dados e trancados
// pela parte. Dona: S2a. Custos, capacidades e alcances: (calibrar). Custos de construção do M1a calibrados pelo robô na
// C1a (eram captação 25 mil, poço 8, usina 30, praça 3, clínica 20, escola 25, delegacia 20 e bombeiros 25 mil: a
// cidade gastava o caixa da primeira hora em poucos prédios e não cobria os bairros; em US$, a clínica de 10 mil dá
// US$ 6 milhões, a usina de 8 MW, US$ 9,6 milhões).
//
// Serviço: { nome, categoria, barra: 'servicos' | 'lazer' (a categoria da barra de construção, D24), custo,
//   manutencaoHora (unidades por hora de jogo), capacidade (água em m³/h, energia em kW, cobertura em moradores ou
//   vagas, null no lazer), raio (m pela via; null nas redes), carga: 'moradores' | 'estudantes', empregos: [básico,
//   fundamental, médio, superior], planta: [frente, fundo] em metros, marco, parte, xp (XP ativo ao construir),
//   obraTiques, consumo: { agua, energia } do próprio prédio, margem (precisa de água a até 40 m: captação), recurso
//   (precisa do recurso na planta: poço), educa: [de, para] (passa moradores de um nível de estudo ao seguinte), faz }.
// A cobertura anda pela via (Dijkstra de várias origens, raio dela), a carga é a dos moradores atendidos e a eficiência
// é min(1, capacidade / carga) vezes o quadro de pessoal.
import { congelar } from '../comum/util.js';

/** Categorias: as de rede (água, energia, esgoto) e as de cobertura com o peso no bem-estar (D50). */
export const CATEGORIAS_SERVICO = congelar({
  agua: { rede: true },
  energia: { rede: true },
  esgoto: { rede: true },
  saude: { bemEstar: 8 },
  educacao: { bemEstar: 6 },
  seguranca: { bemEstar: 6 },
  bombeiros: { bemEstar: 4 },
  lazer: { bemEstar: 6 },
});

/** Categorias de cobertura pela via, na ordem das contas e da camada Serviços. */
export const COBERTURAS = Object.freeze(['saude', 'educacao', 'seguranca', 'bombeiros', 'lazer']);

/** Fração dos moradores que estuda (a carga das escolas, seção 7.2). (calibrar) */
export const FRACAO_ESTUDANTES = 0.12;

export const SERVICOS = congelar({
  captacao: {
    nome: 'Captação de água', categoria: 'agua', barra: 'servicos', custo: 15000, manutencaoHora: 800, capacidade: 30,
    raio: null, empregos: [4, 4, 2, 0], planta: [24, 32], marco: 0, parte: 'M1a', xp: 40, obraTiques: 60,
    consumo: { agua: 0, energia: 60 }, margem: 40, faz: 'tira água do rio e põe na rede, para uns 5 mil moradores',
  },
  poco: {
    nome: 'Poço artesiano', categoria: 'agua', barra: 'servicos', custo: 5000, manutencaoHora: 300, capacidade: 4.8,
    raio: null, empregos: [2, 1, 0, 0], planta: [16, 16], marco: 0, parte: 'M1a', xp: 20, obraTiques: 40,
    consumo: { agua: 0, energia: 15 }, recurso: 'subterranea', faz: 'bombeia o lençol para a rede, uns 800 moradores',
  },
  solar: {
    nome: 'Usina solar', categoria: 'energia', barra: 'servicos', custo: 16000, manutencaoHora: 600, capacidade: 8000,
    raio: null, empregos: [2, 2, 2, 0], planta: [48, 48], marco: 0, parte: 'M1a', xp: 40, obraTiques: 90,
    consumo: { agua: 0.01, energia: 0 }, faz: 'gera 8 MW, com bateria para a noite',
  },
  praca: {
    nome: 'Praça', categoria: 'lazer', barra: 'lazer', custo: 1500, manutencaoHora: 60, capacidade: null, raio: 300,
    empregos: [0, 0, 0, 0], planta: [32, 32], marco: 0, parte: 'M1a', xp: 20, obraTiques: 30,
    consumo: { agua: 0.02, energia: 5 }, faz: 'dá lazer a quem mora a até 300 m pela rua',
  },
  clinica: {
    nome: 'Clínica', categoria: 'saude', barra: 'servicos', custo: 10000, manutencaoHora: 700, capacidade: 8000,
    raio: 1200, carga: 'moradores', empregos: [5, 10, 8, 2], planta: [40, 48], marco: 1, parte: 'M1a', xp: 50, obraTiques: 90,
    consumo: { agua: 0.15, energia: 60 }, faz: 'atende a saúde de até 8 mil moradores a 1,2 km pela rua',
  },
  escolaF: {
    nome: 'Escola fundamental', categoria: 'educacao', barra: 'servicos', custo: 12000, manutencaoHora: 900,
    capacidade: 600, raio: 1500, carga: 'estudantes', educa: [0, 1], empregos: [5, 10, 12, 3], planta: [48, 64], marco: 1,
    parte: 'M1a', xp: 50, obraTiques: 90, consumo: { agua: 0.2, energia: 50 },
    faz: 'ensina 600 alunos a até 1,5 km pela rua',
  },
  delegacia: {
    nome: 'Delegacia', categoria: 'seguranca', barra: 'servicos', custo: 10000, manutencaoHora: 800, capacidade: 10000,
    raio: 1500, carga: 'moradores', empregos: [6, 12, 10, 2], planta: [32, 40], marco: 1, parte: 'M1a', xp: 50,
    obraTiques: 90, consumo: { agua: 0.08, energia: 40 }, faz: 'cuida da segurança de até 10 mil moradores',
  },
  bombeiros: {
    nome: 'Quartel de bombeiros', categoria: 'bombeiros', barra: 'servicos', custo: 12000, manutencaoHora: 900,
    capacidade: 12000, raio: 1800, carga: 'moradores', empregos: [8, 14, 6, 2], planta: [32, 40], marco: 2, parte: 'M1a',
    xp: 60, obraTiques: 90, consumo: { agua: 0.3, energia: 40 }, faz: 'protege até 12 mil moradores a 1,8 km pela rua',
  },
  // M1b (S2b liga): prontos nos dados para a R5 desenhar
  ete: {
    nome: 'Estação de tratamento de esgoto', categoria: 'esgoto', barra: 'servicos', custo: 30000, manutencaoHora: 1000,
    capacidade: 30, raio: null, empregos: [5, 4, 2, 1], planta: [48, 56], marco: 0, parte: 'M1b', xp: 50, obraTiques: 120,
    consumo: { agua: 0, energia: 120 }, margem: 40, faz: 'trata o esgoto antes de devolver ao rio',
  },
  termica: {
    nome: 'Termelétrica a gás', categoria: 'energia', barra: 'servicos', custo: 60000, manutencaoHora: 2000,
    capacidade: 50000, raio: null, empregos: [10, 12, 6, 2], planta: [56, 64], marco: 1, parte: 'M1b', xp: 80,
    obraTiques: 150, consumo: { agua: 1, energia: 0 }, faz: 'gera 50 MW a gás',
  },
  escolaM: {
    nome: 'Escola de ensino médio', categoria: 'educacao', barra: 'servicos', custo: 45000, manutencaoHora: 1500,
    capacidade: 1200, raio: 2500, carga: 'estudantes', educa: [1, 2], empregos: [6, 12, 24, 8], planta: [56, 72], marco: 3,
    parte: 'M1b', xp: 70, obraTiques: 120, consumo: { agua: 0.3, energia: 80 }, faz: 'ensina 1.200 alunos do ensino médio',
  },
  parque: {
    nome: 'Parque', categoria: 'lazer', barra: 'lazer', custo: 12000, manutencaoHora: 250, capacidade: null, raio: 600,
    empregos: [3, 1, 0, 0], planta: [64, 64], marco: 3, parte: 'M1b', xp: 40, obraTiques: 60,
    consumo: { agua: 0.2, energia: 10 }, faz: 'dá lazer a quem mora a até 600 m pela rua',
  },
  hospital: {
    nome: 'Hospital', categoria: 'saude', barra: 'servicos', custo: 90000, manutencaoHora: 3000, capacidade: 40000,
    raio: 3000, carga: 'moradores', empregos: [40, 60, 70, 30], planta: [72, 88], marco: 4, parte: 'M1b', xp: 80,
    obraTiques: 180, consumo: { agua: 1, energia: 400 }, faz: 'atende a saúde de até 40 mil moradores',
  },
  parqueG: {
    nome: 'Parque da orla', categoria: 'lazer', barra: 'lazer', custo: 40000, manutencaoHora: 800, capacidade: null,
    raio: 1200, empregos: [8, 3, 1, 0], planta: [96, 64], marco: 5, parte: 'M1b', xp: 60, obraTiques: 120,
    consumo: { agua: 0.5, energia: 30 }, atratividade: 3, faz: 'dá lazer à cidade e atrai moradores',
  },
});

/** Índice numérico de cada serviço (predios.modelo quando predios.tipo é SERVICO). Só se acrescenta no fim. */
export const SERVICOS_ORDEM = Object.freeze(Object.keys(SERVICOS));

/** Serviços de uma categoria, na ordem do índice. */
export const servicosDaCategoria = (cat) => SERVICOS_ORDEM.filter((id) => SERVICOS[id].categoria === cat);

/** Ligação externa pela rodovia (D52): só energia, até 5 MW, a preço por kW por hora de jogo. (calibrar) */
export const LIGACAO_EXTERNA = congelar({ energia: 5000, precoKwHora: 0.5, agua: 0 });
