// Avisos curtos (toasts, desenho da UI 8.11): à direita, sob a faixa do alto e à esquerda do trilho, até 2 de cada
// vez, 4 s cada; --s1, forma e glifo da gravidade e texto 13/600; entram descendo 8 px e saem apagando. Nunca para o
// que exige ação (isso vai para a faixa, o marcador ou o Conselho). Vêm de loja.avisar (recusa de comando, limite de
// um passo) e de alguns eventos da simulação (objetivo cumprido, área comprada, tique atrasado). O "Caixa zerado" pede
// ação e fica só na faixa de alerta, com as três saídas (D41). aria-live polite. Tocar dispensa.
import { useEffect } from 'preact/hooks';
import { effect } from '@preact/signals';
import { avisos, dispensar, avisar, eventos, barra } from '../loja.js';
import { t } from '../textos.js';
import { Glifo } from '../glifos/Glifo.jsx';
import { glifo as temGlifo } from '../glifos/glifos.js';
import { FormaGravidade } from '../comp/Aviso.jsx';
import { Botao } from '../comp/Botao.jsx';
import { textoObjetivo } from './Objetivo.jsx';

export const AVISO_MS = 4000;
export const MAX_VISIVEIS = 2;
const GRAVIDADE = { erro: 'grave', grave: 'grave', atencao: 'atencao', info: 'info', holding: 'holding' };
const GLIFO = { grave: 'alerta', atencao: 'alerta', info: 'info', holding: 'holding' };

function Toast({ a }) {
  useEffect(() => {
    const id = setTimeout(() => dispensar(a.id), AVISO_MS);
    return () => clearTimeout(id);
  }, [a.id]);
  const g = GRAVIDADE[a.gravidade] ?? 'info';
  return (
    <Botao a="aviso.toast" k={a.id} rotulo={a.texto} class={`toast toast-${g}`} onClick={() => dispensar(a.id)}>
      <FormaGravidade gravidade={g} />
      <Glifo n={a.glifo && temGlifo(a.glifo) ? a.glifo : GLIFO[g]} tam={18} />
      <span class="toast-texto">{a.texto}</span>
    </Botao>
  );
}

export function Avisos() {
  const l = avisos.value.slice(-MAX_VISIVEIS);
  return (
    <div class="toasts" aria-live="polite">
      {l.map((a) => (
        <Toast key={a.id} a={a} />
      ))}
    </div>
  );
}

/**
 * O aviso curto de um evento da simulação (ou null). Os de decisão, marco e etapa têm modal próprio; o caixa zerado, a
 * faixa. O objetivo cumprido já saiu de q.objetivos quando o evento chega (o seguinte abriu no mesmo tique): a frase
 * vem da última leitura da barra e, sem ela, da chave do id.
 */
export function avisoDoEvento(nome, dados, consultar = () => null, vistos = []) {
  if (nome === 'objetivo' && dados?.estado === 'feito') {
    const o = [...(vistos ?? []), ...(consultar('objetivos') ?? [])].find((x) => x?.id === dados.id) ?? { id: dados.id };
    return { texto: t('aviso.u1b.objetivo', { texto: textoObjetivo(o) }), gravidade: 'info', glifo: 'check' };
  }
  if (nome === 'ladrilho') return { texto: t('aviso.u1b.ladrilho'), gravidade: 'holding', glifo: 'mapa' };
  if (nome === 'tarefaAtrasada') return { texto: t('aviso.u1b.atrasada'), gravidade: 'atencao', glifo: 'relogio' };
  return null;
}

let soltar = null;

export function registrar(ui) {
  soltar?.();
  const vistos = new WeakSet();
  // os eventos chegam pela ponte (loja.eventos); cada um vira no máximo um aviso, uma vez
  soltar = effect(() => {
    for (const e of eventos.value) {
      if (vistos.has(e)) continue;
      vistos.add(e);
      const a = avisoDoEvento(e.nome, e.dados, ui.consultar, barra.peek()?.objetivos);
      if (a) avisar(a);
    }
  });
  ui.registrarHud('sobre', Avisos, { ordem: 30, nome: 'avisos' });
}
