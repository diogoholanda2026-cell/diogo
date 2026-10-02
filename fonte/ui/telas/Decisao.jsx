// Decisão do Conselho (desenho da UI 8.14; D35, D77, D78): o modal de até 620 px que pausa o tempo, com a situação e 2 a
// 4 cartões lado a lado (quem propõe, ganho, custo em dólar, Influência ou Legado), "Escolher" e "Decidir depois"
// enquanto houver prazo. O evento 'decisao' da simulação abre sozinho; o Conselho abre pelo cartão. A escolha vira
// marca no Histórico e fala no Mural (a simulação). Corpo sob demanda (corpo/Decisao.jsx); a fila é a de Momento.jsx.
import { effect } from '@preact/signals';
import { eventos } from '../loja.js';
import { sobDemanda, precarregarNoOcioso } from './corpo/sobDemanda.jsx';
import { filaModal, enfileirar, tirarModal } from './Momento.jsx';

/** Abre a decisão (na frente da fila quando o jogador pediu). */
export const abrirDecisao = (id, { frente = true } = {}) => enfileirar({ tipo: 'decisao', id }, { frente });

const Corpo = sobDemanda(() => import('./corpo/Decisao.jsx'), { id: 'decisao', moldura: false });

function HostDecisao({ ui }) {
  const item = filaModal.value[0];
  if (item?.tipo !== 'decisao') return null;
  return <Corpo key={item.seq} ui={ui} id={item.id} fechar={() => tirarModal(item)} />;
}

let soltar = null;

export function registrar(ui) {
  soltar?.();
  const vistos = new WeakSet();
  soltar = effect(() => {
    for (const e of eventos.value) {
      if (vistos.has(e)) continue;
      vistos.add(e);
      if (e.nome === 'decisao' && e.dados?.id) abrirDecisao(e.dados.id, { frente: false });
    }
  });
  ui.registrarHud('sobre', HostDecisao, { ordem: 70, nome: 'decisao' });
  // abre sozinho, por evento da simulação: o corpo já vem antes, no ocioso
  precarregarNoOcioso(Corpo);
}
