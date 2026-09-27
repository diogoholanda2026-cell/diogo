// Dica (desenho da UI 7.4 e 8.20): um glifo de informação com alvo de 44 px que mostra uma frase curta. No toque abre
// e fecha; no PC abre ao passar o mouse (400 ms). É a dica fixa da D42 ("/h" é hora de jogo) e o "de onde vem".
import { useState, useRef, useEffect } from 'preact/hooks';
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';

export function Dica({ texto, rotulo = null, a = 'dica', k, lado = 'esquerda' }) {
  const [aberta, setAberta] = useState(false);
  const espera = useRef(0);
  const raiz = useRef(null);
  useEffect(() => {
    if (!aberta) return undefined;
    const fora = (ev) => {
      if (raiz.current && !raiz.current.contains(ev.target)) setAberta(false);
    };
    document.addEventListener('pointerdown', fora, true);
    return () => document.removeEventListener('pointerdown', fora, true);
  }, [aberta]);
  useEffect(() => () => clearTimeout(espera.current), []);
  return (
    <span
      ref={raiz}
      class="dica ancora"
      onPointerEnter={(ev) => {
        if (ev.pointerType !== 'mouse') return;
        clearTimeout(espera.current);
        espera.current = setTimeout(() => setAberta(true), 400);
      }}
      onPointerLeave={(ev) => {
        if (ev.pointerType !== 'mouse') return;
        clearTimeout(espera.current);
        setAberta(false);
      }}
    >
      <Botao a={a} k={k} rotulo={rotulo ?? texto} ativo={aberta} class="bt-glifo dica-bt" onClick={() => setAberta(!aberta)}>
        <Glifo n="info" tam={16} />
      </Botao>
      {aberta ? (
        <span class={`dica-balao popover-${lado}`} role="tooltip">
          {texto}
        </span>
      ) : null}
    </span>
  );
}
