// Ações da interface (D16, desenho da UI 12.4): a ÚNICA porta de saída da UI para a simulação. Todo comando devolve
// uma Promise (mesmo resolvida na hora: se a simulação for para um worker no M4, nenhuma tela muda) e leva o id que a
// UI gera, { sessao, seq }, usado no desfazer e para casar a resposta. Recusa vira frase por t('codigo.<código>')
// e, se a ação não for silenciosa, um aviso na loja.
import { t } from './textos.js';
import { avisar } from './loja.js';

/** Sessão desta página (não é estado do jogo: só casa respostas e o desfazer). */
export const SESSAO = (() => {
  try {
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return a[0].toString(36) + a[1].toString(36);
  } catch (e) {
    return Math.floor(Math.random() * 2 ** 32).toString(36);
  }
})();

let obterSim = () => null;
let depois = () => {};
let seq = 0;

/**
 * Liga as ações à simulação atual (o app troca a simulação ao carregar ou começar partida).
 * @param {{ obterSim: () => object, aoComando?: (nome, args, resposta) => void }} op
 */
export function ligarAcoes({ obterSim: fn, aoComando = null }) {
  obterSim = fn;
  depois = aoComando ?? (() => {});
}

/** Frase da recusa de uma resposta ({ ok: false, codigo }). */
export const frase = (r) => (r && !r.ok ? t(`codigo.${r.codigo}`, r.dados ?? null) : '');

/**
 * Manda um comando do contrato (fonte/contratos/comandos.js).
 * @returns {Promise<{ ok: boolean, codigo?: string, dados?: any, id: { sessao: string, seq: number } }>}
 * @example const r = await comando('emprestimo.tomar', { valor: 50000 });
 */
export function comando(nome, args = {}, { silencioso = false } = {}) {
  const id = { sessao: SESSAO, seq: ++seq };
  const sim = obterSim();
  let r;
  if (!sim) r = { ok: false, codigo: 'erro' };
  else {
    try {
      r = sim.cmd(nome, args) ?? { ok: true };
    } catch (e) {
      console.error(`ação ${nome}:`, e);
      r = { ok: false, codigo: 'erro' };
    }
  }
  const resposta = { ...r, id };
  if (!resposta.ok && !silencioso) avisar({ texto: frase(resposta), gravidade: 'atencao', codigo: resposta.codigo });
  try {
    depois(nome, args, resposta);
  } catch (e) {
    console.error('ação: depois do comando', e);
  }
  return Promise.resolve(resposta);
}

/** Velocidade: 0 pausa, 1 1x, 2 2x, 3 4x (D7). */
export const velocidade = (v) => comando('velocidade', { v });
