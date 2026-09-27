// Segmentado (desenho da UI 8.20): 36 px de desenho com alvo de 44; o segmento ligado em --s3 com traço --ac. O
// estado é sempre o que está marcado (a lição do play e pausa do CS2). opcoes = [{ v, rotulo, glifo? }].
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';

export function Segmentado({ opcoes, valor, aoTrocar, a = 'segmento', rotulo, soGlifo = false, class: classe = '' }) {
  return (
    <div class={`segmentado${classe ? ` ${classe}` : ''}`} role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => (
        <Botao a={a} k={o.v} rotulo={o.rotulo} role="radio" aria-checked={String(o.v === valor)} class={`seg${o.v === valor ? ' ligado' : ''}`} onClick={() => aoTrocar?.(o.v)}>
          {o.glifo ? <Glifo n={o.glifo} tam={18} /> : null}
          {soGlifo && o.glifo ? null : <span>{o.rotulo}</span>}
        </Botao>
      ))}
    </div>
  );
}
