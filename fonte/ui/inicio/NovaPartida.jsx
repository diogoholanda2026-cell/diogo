// Nova partida (desenho da UI 8.19 e 10.2; D34, D67, D77 a D83; dona: U2a): a Holding Held e o criador, Diogo
// Holanda, já preenchidos e editáveis, e a cor da marca (6 opções que o render usa em bandeiras, helicóptero e na cor
// padrão da Holding). O calendário começa em jan. 2020 (D67). A tela vem sob demanda com o menu (corpo/Inicio.jsx);
// aqui ficam só os padrões, que a carga também usa (?menu=nova).
import { JOGADOR, MUNDO } from '../../data/nomes.js';

/** Cores da marca: champanhe (padrão), bronze, platina, safira, esmeralda e bordô (nada de verde-lima). */
export const CORES_HOLDING = Object.freeze([
  { id: 'champanhe', cor: '#c9a86a' },
  { id: 'bronze', cor: '#b07d4f' },
  { id: 'platina', cor: '#aeb7c1' },
  { id: 'safira', cor: '#3f6fb5' },
  { id: 'esmeralda', cor: '#2f8f6f' },
  { id: 'bordo', cor: '#8e3b46' },
]);

/** Limite do nome da Holding (o mesmo da simulação: holding.identidade recusa acima de 32). */
export const MAX_NOME = 32;

/** O que a nova partida traz preenchido. */
export const PARTIDA_PADRAO = Object.freeze({ nome: MUNDO.holding, criador: JOGADOR.nome, cor: CORES_HOLDING[0].cor, modo: 'normal' });

/** Confere o formulário: devolve { ok, nome, criador } aparados ou o campo com problema. */
export function conferirPartida({ nome = '', criador = '' } = {}) {
  const n = String(nome).trim();
  const c = String(criador).trim();
  if (!n || n.length > MAX_NOME) return { ok: false, campo: 'nome' };
  if (!c || c.length > 40) return { ok: false, campo: 'criador' };
  return { ok: true, nome: n, criador: c };
}

export function registrar() {}
