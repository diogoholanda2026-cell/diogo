// Momentos (desenho da UI 8.15; D49): marco alcançado e etapa da Arcologia concluída. Título de terço inferior sobre o
// mundo ("MARCO 3 · VILA PRÓSPERA"), uma fala de uma linha, o voo de câmera na etapa e, no marco, o modal compacto com
// os prêmios e o que foi liberado. Sem confete. Pausa o tempo enquanto aparece.
// Fila de modais: decisões do Conselho (Decisao.jsx) e momentos entram na mesma fila e aparecem um de cada vez.
// Contrato publicado (para a X1b e quem mais quiser):
//   ui.momento({ tipo: 'marco' | 'etapa', titulo, sub?, fala?: { quem, texto }, alvo?: { x, z, dist? }, premios?, libera? })
//   registrarEtapaMomento(fn)  fn({ id, estado }, ui) → { titulo?, sub?, fala?, alvo? } completa o momento da etapa
// O evento 'marco' da simulação abre o do marco sozinho; o 'etapa' com estado 3 (pronta) abre o da etapa com os nomes de
// q.arcologia() e o que os registrados completarem. O corpo vem sob demanda (corpo/Momento.jsx).
import { signal, effect } from '@preact/signals';
import { eventos } from '../loja.js';
import { sobDemanda, precarregarNoOcioso } from './corpo/sobDemanda.jsx';
import { pausarPor, soltarPausa } from '../hud/Velocidade.jsx';

/** Fila dos modais: [{ tipo: 'momento', dados, seq } | { tipo: 'decisao', id, seq }]; o primeiro aparece. */
export const filaModal = signal([]);
let seqModal = 0;

/**
 * Põe um modal na fila. A mesma decisão não entra duas vezes: pedida na frente (o jogador tocou em Decidir), a que já
 * esperava na fila passa para a frente.
 */
export function enfileirar(item, { frente = false } = {}) {
  let l = filaModal.peek();
  const igual = (x) => item.tipo === 'decisao' && x.tipo === 'decisao' && x.id === item.id;
  const ja = l.find(igual);
  if (ja && (!frente || l[0] === ja)) return;
  if (ja) l = l.filter((x) => x !== ja);
  const novo = { ...item, seq: ++seqModal };
  filaModal.value = frente ? [novo, ...l] : [...l, novo];
}

/**
 * Tira da fila o modal que fechou (pelo próprio item): um toque duplo em Continuar, ou a escolha que fecha junto com a
 * decisão que sumiu da consulta, nunca leva o modal seguinte junto. Sem item, tira o da frente.
 */
export function tirarModal(item = filaModal.peek()[0]) {
  const l = filaModal.peek();
  if (item && l.includes(item)) filaModal.value = l.filter((x) => x !== item);
}

/** Tira o modal da frente da fila. */
export const proximoModal = () => tirarModal();

const etapas = [];
/** Quem sabe mais da etapa (a X1b) completa o momento dela. */
export function registrarEtapaMomento(fn) {
  if (typeof fn === 'function' && !etapas.includes(fn)) etapas.push(fn);
}

/** Momento da etapa pronta, pelos nomes de q.arcologia() e pelos registrados. */
export function momentoDaEtapa(ui, ev) {
  const arc = ui.consultar('arcologia');
  let titulo = null;
  let sub = null;
  for (const parte of arc?.partes ?? []) {
    const k = (parte.etapas ?? []).findIndex((e) => e.id === ev.id);
    if (k >= 0) {
      titulo = parte.nome;
      sub = { etapa: k + 1, de: parte.etapas.length, nome: parte.etapas[k].nome };
    }
  }
  const m = { tipo: 'etapa', id: ev.id, titulo: titulo ?? ev.id, sub };
  for (const fn of etapas) {
    try {
      Object.assign(m, fn(ev, ui) ?? {});
    } catch (e) {
      console.error('momento da etapa', e);
    }
  }
  return m;
}

const Corpo = sobDemanda(() => import('./corpo/Momento.jsx'), { id: 'momento', moldura: false });

function HostMomento({ ui }) {
  const item = filaModal.value[0];
  if (item?.tipo !== 'momento') return null;
  // a chave do item: o momento seguinte começa do título, com o estado dele
  return <Corpo key={item.seq} ui={ui} m={item.dados} fechar={() => tirarModal(item)} />;
}

let soltar = null;

export function registrar(ui) {
  soltar?.();
  filaModal.value = [];
  ui.momento = (dados) => enfileirar({ tipo: 'momento', dados });
  const vistos = new WeakSet();
  const semEventos = effect(() => {
    for (const e of eventos.value) {
      if (vistos.has(e)) continue;
      vistos.add(e);
      if (e.nome === 'marco') ui.momento({ tipo: 'marco', ...e.dados });
      else if (e.nome === 'etapa' && e.dados?.estado === 3) ui.momento(momentoDaEtapa(ui, e.dados));
    }
  });
  // a fila não vazia pausa o tempo; ao esvaziar, volta a velocidade de antes
  const semPausa = effect(() => {
    if (filaModal.value.length) pausarPor('modal');
    else soltarPausa('modal');
  });
  soltar = () => {
    semEventos();
    semPausa();
  };
  ui.registrarHud('sobre', HostMomento, { ordem: 80, nome: 'momento' });
  // abre sozinho, por evento da simulação: o corpo já vem antes, no ocioso
  precarregarNoOcioso(Corpo);
}
