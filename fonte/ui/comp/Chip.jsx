// Chip (desenho da UI 8.20): 28 px de desenho, glifo de 16 e texto 12/600. Com onClick vira botão com alvo de 44 px
// (o ::after estende a área). estado: 'ok' | 'al' | 'er' | 'ac' | 'ch' pinta o glifo e o aro, nunca o texto sozinho.
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';

export function Chip({ glifo = null, texto = null, estado = null, a, k, onClick, titulo, ativo, class: classe = '' }) {
  const cls = `chip${estado ? ` chip-${estado}` : ''}${classe ? ` ${classe}` : ''}`;
  const miolo = [glifo ? <Glifo n={glifo} tam={16} /> : null, texto !== null && texto !== undefined ? <span class="chip-texto">{texto}</span> : null];
  if (onClick || a) {
    return (
      <Botao a={a} k={k} rotulo={titulo ?? (typeof texto === 'string' ? texto : undefined)} ativo={ativo} class={`${cls} chip-bt`} onClick={onClick}>
        {miolo}
      </Botao>
    );
  }
  return (
    <span class={cls} title={titulo}>
      {miolo}
    </span>
  );
}
