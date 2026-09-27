// Abas (desenho da UI 8.13 e 12.7): role="tablist" com botões role="tab" de 44 px; a ativa em --t1 com traço de 2 px
// --ac embaixo. abas = [{ id, rotulo, glifo?, selo? }]; aoTrocar(id). Setas do teclado andam entre as abas e levam o
// foco junto (tabindex móvel: só a ativa entra no Tab).
import { useRef } from 'preact/hooks';
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';

export function Abas({ abas, ativa, aoTrocar, a = 'aba', rotulo, class: classe = '' }) {
  const raiz = useRef(null);
  const mover = (ev) => {
    const i = abas.findIndex((x) => x.id === ativa);
    const passo = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    if (!passo || i < 0) return;
    ev.preventDefault();
    const prox = (i + passo + abas.length) % abas.length;
    aoTrocar?.(abas[prox].id);
    raiz.current?.querySelectorAll('[role="tab"]')[prox]?.focus();
  };
  return (
    <div ref={raiz} class={`abas${classe ? ` ${classe}` : ''}`} role="tablist" aria-label={rotulo} onKeyDown={mover}>
      {abas.map((x) => (
        <Botao a={a} k={x.id} rotulo={x.rotulo} role="tab" aria-selected={String(x.id === ativa)} tabIndex={x.id === ativa ? 0 : -1} class={`aba${x.id === ativa ? ' ativa' : ''}`} onClick={() => aoTrocar?.(x.id)}>
          {x.glifo ? <Glifo n={x.glifo} tam={18} /> : null}
          <span>{x.rotulo}</span>
          {x.selo ? <span class="aba-selo num">{x.selo}</span> : null}
        </Botao>
      ))}
    </div>
  );
}
