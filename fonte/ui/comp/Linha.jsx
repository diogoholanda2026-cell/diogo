// Linha (desenho da UI 8.20): 48 px no toque e 36 no PC; glifo num chip de 32, título 15/600, subtítulo 13/500 e,
// à direita, o valor 15/650 tabular ou uma ação. Com onClick a linha inteira é um botão.
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';

export function Linha({ glifo = null, cor = null, titulo, sub = null, valor = null, valorEstado = null, a, k, onClick, children, class: classe = '' }) {
  const miolo = [
    glifo ? (
      <span class="linha-glifo" style={cor ? { color: cor } : null}>
        <Glifo n={glifo} tam={18} />
      </span>
    ) : null,
    <span class="linha-textos">
      <span class="linha-titulo">{titulo}</span>
      {sub !== null && sub !== undefined ? <span class="linha-sub">{sub}</span> : null}
    </span>,
    valor !== null && valor !== undefined ? <span class={`linha-valor num${valorEstado ? ` tx-${valorEstado}` : ''}`}>{valor}</span> : null,
    children,
  ];
  if (onClick) {
    return (
      <Botao a={a} k={k} rotulo={typeof titulo === 'string' ? titulo : undefined} class={`linha linha-bt${classe ? ` ${classe}` : ''}`} onClick={onClick}>
        {miolo}
      </Botao>
    );
  }
  return <div class={`linha${classe ? ` ${classe}` : ''}`}>{miolo}</div>;
}
