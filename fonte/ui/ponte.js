// Ponte da simulação para a interface (seção 2.8): lê q.barra() 4 vezes por segundo e depois de cada comando (a
// ação marca), aplica nos sinais com batch() e guarda os eventos da simulação na loja. Não guarda nada da simulação
// entre leituras; se o app trocar de simulação, liga os ouvintes na nova.
import { consultar } from './consultas.js';
import { aplicarBarra, registrarEvento, avisar } from './loja.js';
import { t } from './textos.js';

export const PERIODO_MS = 250;

/**
 * @param {{ obterSim: () => object }} op
 * @returns {{ quadro(tMs): void, atualizar(): void, marcar(): void, ligar(sim): void }}
 */
export function criarPonte({ obterSim }) {
  let sim = null;
  let desligar = null;
  let tUltimo = -Infinity;
  let sujo = true;

  function aoEvento(dados, nome) {
    sujo = true;
    registrarEvento(nome, dados);
    if (nome === 'aviso' && dados?.codigo) avisar({ texto: t(`aviso.${dados.codigo}`, dados.params), gravidade: dados.gravidade, alvo: dados.alvo, codigo: dados.codigo });
  }

  function ligar(s) {
    desligar?.();
    desligar = null;
    sim = s;
    sujo = true;
    if (!s?.on) return;
    try {
      desligar = s.on('*', aoEvento);
    } catch (e) {
      console.error('ponte da interface: a simulação não aceitou ouvinte', e);
    }
  }

  function atualizar() {
    const b = consultar('barra');
    if (b) aplicarBarra(b);
    sujo = false;
  }

  return {
    ligar,
    atualizar,
    marcar() {
      sujo = true;
    },
    quadro(tMs) {
      const s = obterSim();
      if (s !== sim) ligar(s);
      if (sujo || tMs - tUltimo >= PERIODO_MS) {
        atualizar();
        tUltimo = tMs;
      }
    },
  };
}
