// Interruptor (desenho da UI 8.20): trilho de 44 x 26 com o estado escrito ao lado ("Auto: ligado"), role="switch".
import { Botao } from './Botao.jsx';
import { t } from '../textos.js';

export function Interruptor({ ligado, aoTrocar, rotulo, a = 'interruptor', k, class: classe = '' }) {
  const estado = t(ligado ? 'comp.ligado' : 'comp.desligado');
  return (
    <Botao a={a} k={k} rotulo={`${rotulo}: ${estado}`} role="switch" aria-checked={String(!!ligado)} class={`interruptor${ligado ? ' ligado' : ''}${classe ? ` ${classe}` : ''}`} onClick={() => aoTrocar?.(!ligado)}>
      <span class="interruptor-trilho" aria-hidden="true">
        <span class="interruptor-bola" />
      </span>
      <span class="interruptor-texto">
        {rotulo}: <b>{estado}</b>
      </span>
    </Botao>
  );
}
