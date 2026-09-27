// Indicador (desenho da UI 8.13 e 8.20): rótulo 12/600 em caixa alta, número 17/650 (ou 28/700 com grande) tabular e
// uma linha de apoio em 13/500. estado pinta só o número e sempre vem com glifo (a cor não carrega o sentido sozinha).
import { Glifo } from '../glifos/Glifo.jsx';

export function Indicador({ rotulo, valor, sub = null, glifo = null, estado = null, grande = false, dica = null, class: classe = '' }) {
  return (
    <div class={`indicador${grande ? ' indicador-grande' : ''}${classe ? ` ${classe}` : ''}`}>
      <span class="rot">{rotulo}</span>
      <span class={`indicador-valor num${estado ? ` tx-${estado}` : ''}`} title={dica ?? undefined}>
        {glifo ? <Glifo n={glifo} tam={grande ? 22 : 16} /> : null}
        {valor}
      </span>
      {sub !== null && sub !== undefined ? <span class="indicador-sub">{sub}</span> : null}
    </div>
  );
}
