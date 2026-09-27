// Consultas da UI e do robô (seção 2.6, D16): sim.q.* são puras e síncronas; nunca mudam o estado (um teste confere
// que o hash não muda). Nomes com ponto viram objetos: 'via.previa' é sim.q.via.previa(...). Nenhuma consulta devolve
// "dias": prazos em tiques, e a UI formata (D42). Registro: sim.registrarConsulta(nome, fn) só aceita nomes daqui.
import { congelar } from '../comum/util.js';

/** Exemplo completo de q.barra() (a UI e a sim-falsa seguem este formato). */
export const EXEMPLO_BARRA = congelar({
  creditos: 284500, // caixa da Holding
  saldoHora: 12400, // líquido, por hora de jogo
  populacao: 12480,
  popHora: 310, // moradores por hora de jogo
  bemEstar: 63.2,
  bemEstarTarifa: 64, // média suavizada em 1 mês e arredondada (D11)
  tarifa: 11, // 5 | 8 | 11 créditos por morador por hora de jogo
  faixa: [61, 100],
  margem: { degrau: 61, delta: 3 }, // "+3 acima de 61"; degrau null na faixa de cima sem risco
  demanda: { R: 62, C: 40, I: 18, E: 0 }, // 0 a 100
  data: { mes: 3, ano: 2, fracMes: 0.42, fase: 'tarde' },
  velocidade: 1, // índice: 0 pausa, 1 1x, 2 2x, 3 4x
  mult: 1,
  marco: { n: 2, nome: 'Vila', xp: 1100, xpIni: 400, xpProx: 1500, requisito: null }, // requisito: 'torre.e4' | null
  divida: 0,
  valuation: 284500,
  caixaZerado: false,
  alertas: [{ id: 'caixa', gravidade: 'grave', glifo: 'caixa', codigo: 'caixaZerado', params: {}, alvo: { tela: 'economia' } }],
  decisoesPendentes: 0,
  objetivos: [
    { id: 'cidade.agua', texto: 'agua.vila', quem: 'cida', dominio: 'cidade', feito: 0, total: 1, alvo: { x: 120, z: 40 } },
  ],
});

/** Consultas do contrato: dono e formato (texto da seção 2.6). */
export const CONSULTAS = congelar({
  barra: { dono: 'F0 (S2a e S3a completam por registrarParteBarra)', formato: 'EXEMPLO_BARRA' },
  hash: { dono: 'F0', formato: 'número de 32 bits: hash do estado (salvar/formato.js)' },
  retomar: { dono: 'S3a', formato: '{ objetivo, problema: { codigo, params, alvo } | null, desde /* tique do último save */ }' },
  'via.previa': {
    dono: 'S1b',
    formato:
      "({ modo: 'reta' | 'curva' | 'continua' | 'grade', tipo, pontos: [[x, z]], tolerancia, encaixe, sessao }) → { ok, segmentos: [{ p: [8], tipo, cotas: [y0, y1], ponte, erros: [codigo] }], nosNovos, divisoes, encaixes: [{ ponto, tipo, valor }], guias: [{ tipo, a, b }], demolir: { predios: [ref], custo }, comprimento, custo, manutencaoHora, erros: [{ codigo, trecho }] }; até 1 ms",
  },
  'zona.previa': { dono: 'S1b', formato: '({ pincel, zona }) → { celulas: Int32Array, comPredio, efeitoMedia }' },
  'construir.previa': {
    dono: 'S2a e S3a', formato: '({ tipo, x, z, rot }) → { ok, codigo?, x, z, rot, custo, manutencaoHora, alcance, efeitos: [{ camada, delta }] }',
  },
  predio: {
    dono: 'S2a (S3a a parte holding)',
    formato:
      "(ref) → { ref, tipo, modelo, nome, zona, nivel, estado: 'obra' | 'ok' | 'abandonado', obra, moradia, trabalho, nivelProx, servicos, servico, holding, avisos: [{ codigo, gravidade, desde, acao }], cor, via: { ref, nome }, faz }",
  },
  camada: {
    dono: 'por camada (contratos/camadas.js); X3a mostra',
    formato:
      "(id) → { id, fonte: 'predios' | 'arestas' | 'grade' | 'celulas', dados: Float32Array, grade: { n, passo, origem } | null, tipo: 'seq' | 'div' | 'cat', escala: { min, max, meio?, unidade }, categorias: [{ v, chave }] | null, legenda: [{ v, chave }], resumo: { chave, params }, versao }",
  },
  avisosPredios: { dono: 'S2a', formato: '() → { versao, idx: Int32Array, glifo: Uint8Array, gravidade: Uint8Array }' },
  deposito: {
    dono: 'S3a',
    formato: '() → { janela: { fimTique, vendidas, max: 100 }, itens: [{ item, estoque, reserva, precoBase, precoVenda, vendeCidade, auto }] }',
  },
  emprestimo: {
    dono: 'S3a',
    formato:
      '() → { disponivelAno, tomadoAno, limiteAno: 50000, divida, dividaMax: 500000, taxa: 0.10, jurosDevidos, contratos: [{ id, ano, valor, saldo, ini, fim, mora }] }',
  },
  orcamento: {
    dono: 'S3a',
    formato:
      '() → { receitas: { moradores, cidade, deposito, marcos }, despesas: { servicos, vias, ligacao, salarios, juros, importacao, importacaoCidade }, naoPago: { servicos, salarios }, saldoHora, caixa, serie: [{ mes, caixa, receitas, despesas, moradores, bemEstar, desemprego }] }',
  },
  producao: {
    dono: 'S3a',
    formato:
      '() → { itens: [{ item, estoque, produzHora, consomeHora, cidadeHora, reserva }], predios: [{ ref, tipo, nivel, linhas }], frota: { usados, total, fila, atrasoMedio } }',
  },
  arcologia: {
    dono: 'X1b',
    formato:
      '() → { plano, partes: [{ id, nome, etapas: [{ id, nome, estado, marco, creditos, materiais: [{ item, pede, entregue, estoque }], minutos, fase, progresso, efeitos }] }], progressoTotal }',
  },
  holding: { dono: 'S3a', formato: '() → { nome, cor, influencia, legado, efeitos: { descontoLadrilho, atratividade }, divisoes, valuation }' },
  marcos: { dono: 'S3a', formato: 'seção 16.4 do desenho da simulação' },
  objetivos: { dono: 'S3a', formato: '() → [{ id, texto, quem, dominio, feito, total, alvo, recompensa }]' },
  decisoes: { dono: 'S3a', formato: 'seção 15.3 do desenho da simulação' },
  mural: { dono: 'S3a', formato: '({ desde }) → [post]' },
  demanda: { dono: 'S2a', formato: '() → { resBaixa, resMedia, resAlta, comBaixa, comAlta, escritorio, industria, fatores: { zona: [{ id, v }] } }' },
  cidade: { dono: 'S2a', formato: 'seção 16.4 do desenho da simulação' },
  catalogo: { dono: 'S2a e S3a', formato: '(categoria) → [{ tipo, nome, custo, manutencaoHora, marco, liberado }]' },
  ladrilhos: { dono: 'S1a', formato: '() → { estado: Uint8Array(256), preco: Float64Array(256), licencas }' },
  sugestoes: { dono: 'S1a', formato: '() → [{ id, tipo, pontos | x, z }] (primeira hora, D36)' },
  aresta: { dono: 'S1b', formato: '(ref) → { ref, tipo, nome, comprimento, fluxo?, manutencaoHora }' },
  avisos: { dono: 'S2a e X3b', formato: '({ perto, limite }) → [{ id, gravidade, codigo, params, alvo }]' },
  viasPerto: { dono: 'S1b', formato: '(x, z, raio) → [{ ref, t, d }]' },
});

export const LISTA_CONSULTAS = Object.freeze(Object.keys(CONSULTAS));
