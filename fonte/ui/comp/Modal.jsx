// Modal (desenho da UI 7.3, 8.14 e 8.15): véu --veu e caixa de até 620 px (92% no celular); sobretítulo em caixa alta,
// título 20/650, corpo e ações. Esc fecha quando há aoFechar. Quem abre um modal pausa o tempo (U1b).
import { useEffect } from 'preact/hooks';
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { t } from '../textos.js';

export function Modal({ sobretitulo = null, titulo, aoFechar = null, acoes = null, largura = 620, a = 'modal', children }) {
  useEffect(() => {
    if (!aoFechar) return undefined;
    // Esc fecha só o modal (a tela de gestão embaixo dele fica; ui/index.jsx ouve na janela)
    const tecla = (ev) => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation();
      aoFechar();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [aoFechar]);
  return (
    <div class="veu" data-modal={a}>
      <div class="modal" role="dialog" aria-modal="true" aria-label={titulo} style={{ maxWidth: `${largura}px` }}>
        <header class="modal-cab">
          <div class="modal-titulos">
            {sobretitulo ? <span class="rot">{sobretitulo}</span> : null}
            <h2 class="modal-titulo">{titulo}</h2>
          </div>
          {aoFechar ? (
            <Botao a={`${a}.fechar`} rotulo={t('comp.fechar')} class="bt-glifo" onClick={aoFechar}>
              <Glifo n="fechar" />
            </Botao>
          ) : null}
        </header>
        <div class="modal-corpo">{children}</div>
        {acoes ? <footer class="modal-acoes">{acoes}</footer> : null}
      </div>
    </div>
  );
}
