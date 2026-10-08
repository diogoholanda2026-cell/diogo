// Comandos da UI e do robô para a simulação (seção 2.5, D16 e D17).
//
// sim.cmd(nome, args) aplica na hora, entre dois tiques, e funciona pausado. Devolve Resposta. Os argumentos são JSON
// puros (arrays tipados viram arrays comuns na cópia do livro). Todo comando com livro: true entra no livro como
// [tique, seq, nome, args] e a reprodução o aplica quando sim.tique chega a `tique`. Na UI a resposta chega sempre como
// Promise (ui/acoes.js), com o idComando ({ sessao, seq }) gerado pela UI; o id da Resposta segue sendo o da simulação.
//
// Registro: sim.registrarComando(nome, fn, { substituto }) só aceita nomes desta tabela. `dono` é a parcela que
// implementa; F0 marca o que o núcleo já faz.
import { congelar } from '../comum/util.js';

/**
 * @typedef {{ ok: true, id?: number, dados?: any } | { ok: false, codigo: string, dados?: any }} Resposta
 * id: ref da coisa criada (prédio, aresta), quando houver.
 */

export const COMANDOS = congelar({
  velocidade: {
    dono: 'F0', livro: false, args: '{ v: 0..3 } (pausa, 1x, 2x, 4x)', codigos: ['valor'], exemplo: { v: 2 },
  },
  'via.construir': {
    dono: 'S1b', args: '{ plano } (o de q.via.previa, conferido de novo)',
    codigos: ['creditos', 'agua', 'vao', 'declive', 'angulo', 'curto', 'raio', 'ladrilho', 'gleba', 'colisao', 'marco'],
    exemplo: { plano: { modo: 'reta', tipo: 'rua', pontos: [[0, 0], [112, 0]], sessao: 1 } },
  },
  // sessao: a chave da sessão da ferramenta (a UI manda '<sessão da página>.<n>', D16 e D32); o desfazer só vale nela
  'via.desfazer': {
    dono: 'S1b', args: '{ sessao } (creditos: desfazer uma demolição sem caixa para pagar a devolução)',
    codigos: ['nada', 'ocupado', 'creditos'], exemplo: { sessao: 'k3x9.1' },
  },
  'via.melhorar': {
    dono: 'S1b', args: '{ arestas: [ref], tipo, sessao? }', codigos: ['creditos', 'marco', 'declive'],
    exemplo: { arestas: [1048577], tipo: 'avenida', sessao: 'k3x9.1' },
  },
  'via.demolir': {
    dono: 'S1b', args: '{ arestas: [ref], sessao? }', codigos: ['arcologia', 'rodovia', 'inexistente'],
    exemplo: { arestas: [3], sessao: 'k3x9.1' },
  },
  'zona.pintar': {
    dono: 'S1b',
    args: "{ pincel: { modo: 'quadra' | 'circulo' | 'retangulo' | 'celulas', x, z, raio?, x2?, z2?, celulas? }, zona } (zona 0 apaga; índice em ZONAS_ORDEM)",
    codigos: ['marco', 'nada'],
    exemplo: { pincel: { modo: 'circulo', x: 120, z: -40, raio: 24 }, zona: 1 },
  },
  construir: {
    dono: 'S2a (serviços) e S3a (Holding)', args: '{ tipo, x, z, rot }',
    codigos: ['creditos', 'marco', 'acesso', 'colisao', 'declive', 'agua', 'recurso', 'ladrilho', 'gleba'],
    exemplo: { tipo: 'clinica', x: 300, z: 120, rot: 0 },
  },
  mover: {
    dono: 'MOV1', args: '{ ref, x, z, rot, giro?, alinhar?, aplainar? }',
    codigos: ['inexistente', 'valor', 'nada', 'arcologia', 'ocupado', 'creditos', 'marco', 'acesso', 'colisao', 'declive', 'agua', 'recurso', 'ladrilho', 'gleba'],
    exemplo: { ref: 5, x: 320, z: 140, rot: 0 },
  },
  'mover.desfazer': { dono: 'MOV1', args: '{ ref }', codigos: ['inexistente', 'ocupado'], exemplo: { ref: 5 } },
  demolir: { dono: 'S2a', args: '{ refs: [ref] }', codigos: ['arcologia', 'inexistente', 'creditos'], exemplo: { refs: [5] } },
  'predio.cor': { dono: 'S2a', args: '{ ref, cor }', codigos: ['inexistente', 'valor'], exemplo: { ref: 5, cor: 3 } },
  'predio.nome': { dono: 'S2a', args: '{ ref, nome }', codigos: ['inexistente', 'valor'], exemplo: { ref: 5, nome: 'Pedreira Norte' } },
  'predio.nivel': {
    dono: 'S3a', args: '{ ref } (prédio da Holding)', codigos: ['creditos', 'estoque', 'marco', 'maximo', 'inexistente'], exemplo: { ref: 9 },
  },
  'ladrilho.comprar': {
    dono: 'S1a', args: '{ i, j }', codigos: ['licenca', 'creditos', 'vizinho', 'comprado'], exemplo: { i: 10, j: 7 },
  },
  'linha.ordem': {
    dono: 'S3a', args: '{ predio, linha, item, n: 1..10, auto }',
    codigos: ['lote', 'estoque', 'trancado', 'ocupado', 'pessoal', 'inexistente'],
    exemplo: { predio: 9, linha: 0, item: 'brita', n: 10, auto: true },
  },
  'linha.parar': { dono: 'S3a', args: '{ predio, linha }', codigos: ['nada', 'inexistente'], exemplo: { predio: 9, linha: 0 } },
  'estoque.reserva': { dono: 'S3a', args: '{ item, n }', codigos: ['valor'], exemplo: { item: 'concreto', n: 40 } },
  'estoque.vendeCidade': { dono: 'S3a', args: '{ item, sim: bool }', codigos: ['valor'], exemplo: { item: 'tijolo', sim: true } },
  'cidade.importarAuto': { dono: 'S3a', args: '{ sim: bool } (D48)', codigos: ['valor'], exemplo: { sim: false } },
  'deposito.vender': { dono: 'S3a', args: '{ item, n }', codigos: ['limite', 'nada', 'valor'], exemplo: { item: 'brita', n: 20 } },
  'deposito.auto': { dono: 'S3a', args: '{ item, acima: n | null }', codigos: ['valor'], exemplo: { item: 'areia', acima: 200 } },
  importar: { dono: 'S3a', args: '{ item, n } (n de 1 a 1.000)', codigos: ['creditos', 'trancado', 'valor'], exemplo: { item: 'aco', n: 10 } },
  'emprestimo.tomar': {
    dono: 'S3a', args: '{ valor } (múltiplo de 1.000)', codigos: ['valor', 'limiteAno', 'limiteDivida'], exemplo: { valor: 50000 },
  },
  'fundo.sacar': {
    dono: 'S3a', args: '{ valor } (inteiro de 1 até o saldo do fundo de teste, D104)', codigos: ['valor', 'limiteFundo', 'inativo'], exemplo: { valor: 1000000 },
  },
  'emprestimo.pagarJuros': { dono: 'S3a', args: '{}', codigos: ['nada', 'creditos'], exemplo: {} },
  'emprestimo.pagarParcela': { dono: 'S3a', args: '{}', codigos: ['nada', 'creditos'], exemplo: {} },
  'emprestimo.quitar': { dono: 'S3a', args: '{}', codigos: ['nada', 'creditos'], exemplo: {} },
  'arcologia.iniciar': {
    dono: 'X1b', args: '{ etapa } (nada: a etapa já está pronta; valor: etapa que não existe)',
    codigos: ['marco', 'creditos', 'emObra', 'trancado', 'nada', 'valor'], exemplo: { etapa: 'lago.e1' },
  },
  acelerar: {
    dono: 'S3a', args: '{ alvo: { predio, linha }, minutos: 1 | 5 | 10 | 30 | 60 } (etapas só se o dono pedir, D13)',
    codigos: ['creditos', 'nada', 'valor', 'inexistente'], exemplo: { alvo: { predio: 9, linha: 0 }, minutos: 5 },
  },
  'decisao.escolher': {
    dono: 'S3a', args: '{ id, opcao } (creditos: a opção custa mais que o caixa)', codigos: ['inexistente', 'prazo', 'creditos'],
    exemplo: { id: 'vila.agua', opcao: 'captacao' },
  },
  'decisao.adiar': { dono: 'S3a', args: '{ id }', codigos: ['inexistente', 'prazo'], exemplo: { id: 'vila.agua' } },
  'holding.identidade': {
    dono: 'S3a (F0 tem o substituto)', args: "{ nome, cor, modo: 'normal' | 'livre' } (nova partida)", codigos: ['valor'],
    exemplo: { nome: 'Held', cor: '#c9a86a', modo: 'normal' },
  },
});

export const LISTA_COMANDOS = Object.freeze(Object.keys(COMANDOS));

/** true se o comando entra no livro (padrão: sim). */
export const vaiNoLivro = (nome) => COMANDOS[nome]?.livro !== false;
