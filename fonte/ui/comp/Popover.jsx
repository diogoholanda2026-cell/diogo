// Popover (desenho da UI 7.3 e 8.1): ancorado no botão que o abriu, com seta de 8 px; --s1, raio --r2. Fecha com um
// toque fora, com Esc ou pelo próprio botão. Uso: <Ancora> envolve o botão e o <Popover> (a âncora é relativa).
//   <Ancora><Botao .../><Popover aberto={x} aoFechar={...} titulo="Bem-estar 64">...</Popover></Ancora>
// lado: 'esquerda' (alinha pela esquerda da âncora) ou 'direita' (pela direita, para os itens do canto direito).
import { useEffect, useRef } from 'preact/hooks';

export function Ancora({ children, class: classe = '' }) {
  return <div class={`ancora${classe ? ` ${classe}` : ''}`}>{children}</div>;
}

export function Popover({ aberto, aoFechar, titulo = null, lado = 'esquerda', largura = 288, a = 'popover', children }) {
  const ref = useRef(null);
  // os ouvintes vivem enquanto o popover está aberto: chamam o aoFechar mais novo, não o da renderização que abriu
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (ev) => {
      const ancora = ref.current?.parentElement;
      if (ancora && !ancora.contains(ev.target)) fecharRef.current?.();
    };
    const tecla = (ev) => {
      if (ev.key === 'Escape') fecharRef.current?.();
    };
    document.addEventListener('pointerdown', fora, true);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora, true);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);
  if (!aberto) return null;
  return (
    <div ref={ref} class={`popover popover-${lado}`} role="dialog" aria-label={titulo ?? undefined} data-popover={a} style={{ width: `${largura}px` }}>
      {titulo ? <div class="popover-titulo">{titulo}</div> : null}
      {children}
    </div>
  );
}
