// <Glifo n="creditos" tam={20} /> desenha um glifo do registro (glifos.js) em SVG com currentColor. Sem título, é
// decorativo (aria-hidden): o rótulo fica no botão que o contém.
import { glifo } from './glifos.js';

const faltando = new Set();

export function Glifo({ n, tam = 20, class: classe = '', titulo = null }) {
  const g = glifo(n);
  if (!g && !faltando.has(n)) {
    faltando.add(n);
    console.warn(`glifo sem desenho: ${n}`);
  }
  return (
    <svg
      class={`glifo ${classe}`}
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
      focusable="false"
    >
      {titulo ? <title>{titulo}</title> : null}
      {g ? g.cheios.map((d) => <path d={d} fill="currentColor" stroke="none" opacity="0.35" />) : <rect x="5" y="5" width="14" height="14" rx="2" />}
      {g ? g.tracos.map((d) => <path d={d} />) : null}
    </svg>
  );
}
