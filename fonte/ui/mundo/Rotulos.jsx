// Rótulos do mundo pelas âncoras (desenho da UI 8.10; D28; X3a): nomes das áreas de longe, das avenidas de perto, dos
// marcos da sede (em inglês, D88 e D89) e dos prédios da Holding, no DOM (até 40), 13/600 sobre uma etiqueta escura
// translúcida (o halo sem caixa do desenho não passa do contraste de 4,5:1 sobre o mundo claro da camada; A7).
// A posição vem de R.ancoras() a cada quadro e entra só por transform; somem sob o HUD e quando se cruzam (fica o de
// maior prioridade). A lógica (candidatos, colisão e o desenho) vem sob demanda (ui/mundo/rotulos.js).
import { useEffect, useRef } from 'preact/hooks';

const CSS = `
.x3-rotulos{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.x3-rot{position:absolute;left:0;top:0;display:none;white-space:nowrap;font-size:var(--t13);font-weight:600;line-height:18px;
  padding:0 6px;border-radius:5px;background:rgba(10,13,18,.74);color:var(--t1);text-shadow:0 1px 2px rgba(0,0,0,.6);
  will-change:transform}
.x3-rot.area{font-size:var(--t12);letter-spacing:.14em;text-transform:uppercase}
.x3-rot.marco{color:var(--ch)}
.x3-rot.avenida{font-size:var(--t12)}
`;

let pedido = null;
const carregar = () =>
  (pedido ??= import('./rotulos.js').then(
    (m) => m,
    (e) => {
      console.error('interface: os rótulos não carregaram', e);
      pedido = null;
      return null;
    },
  ));

function Rotulos({ ui }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!document.querySelector('style[data-estilo="x3-rotulos"]')) {
      const el = document.createElement('style');
      el.dataset.estilo = 'x3-rotulos';
      el.textContent = CSS;
      document.head.appendChild(el);
    }
    let rot = null;
    let vivo = true;
    carregar().then((M) => {
      if (vivo && M && ref.current) rot = M.criarRotulador(ui, ref.current);
    });
    const soltar = ui.aoQuadro((t) => rot?.quadro(t));
    return () => {
      vivo = false;
      soltar();
      rot?.descartar();
    };
  }, []);
  return <div ref={ref} class="x3-rotulos" aria-hidden="true" />;
}

export function registrar(ui) {
  if (typeof document === 'undefined') return;
  ui.registrarHud('mundo', Rotulos, { ordem: 10, nome: 'x3-rotulos' });
}
