// Cartão da dica e a mão fantasma (desenho da UI 10.3; dona: U2a): quem fala (o conselheiro, D83), duas linhas no
// máximo, "Entendi" e "Não mostrar dicas"; a mão faz o gesto 3 vezes por cima do botão (alvo) ou do mundo. A posição
// sai do retângulo do alvo uma vez por meio segundo (nada de leitura de layout por quadro).
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { DEDO } from './estilo.js';
import { t } from '../textos.js';
import { Botao } from '../comp/Botao.jsx';
import { CONSELHEIROS } from '../../data/nomes.js';

/** A dica à vista: { id, quem, gesto, alvo } ou null. */
export const dicaAtual = signal(null);

/** Marca a dica como vista (uma vez só) e, com "não mostrar", desliga todas. */
export function dispensarDica(ui, { desligar = false } = {}) {
  const d = dicaAtual.peek();
  dicaAtual.value = null;
  const p = ui.loja.prefs.peek() ?? {};
  const vistas = [...new Set([...(p.dicasVistas ?? []), ...(d ? [d.id] : [])])];
  const novo = { dicasVistas: vistas, ...(desligar ? { dicas: false } : {}) };
  if (ui.jogo && !ui.jogo.falso && typeof ui.jogo.gravarPrefs === 'function') ui.jogo.gravarPrefs(novo);
  else ui.loja.prefs.value = { ...p, ...novo };
}

const ehToque = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Onde ficam o cartão e a mão: perto do alvo (acima se ele está embaixo) ou no meio do mundo. */
export function posicaoDaDica(rect, W, H) {
  if (!rect) return { mao: { x: W / 2, y: H * 0.46 }, cartao: { x: Math.max(16, W / 2 - 180), y: H * 0.18 } };
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const embaixo = cy > H / 2;
  const x = Math.min(Math.max(16, cx - 180), Math.max(16, W - 376));
  return { mao: { x: cx, y: cy }, cartao: { x, y: embaixo ? Math.max(56, rect.top - 150) : rect.bottom + 16 } };
}

export function Mao({ x, y, gesto = 'toque' }) {
  return (
    <svg class={`mao mao-${gesto}`} style={{ left: `${x}px`, top: `${y}px` }} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {DEDO.map((d) => <path d={d} />)}
    </svg>
  );
}

export function CartaoDica({ ui }) {
  const d = dicaAtual.value;
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!d) return undefined;
    const medir = () => {
      const el = d.alvo ? document.querySelector(d.alvo) : null;
      setPos(posicaoDaDica(el ? el.getBoundingClientRect() : null, innerWidth, innerHeight));
    };
    medir();
    const id = setInterval(medir, 500);
    return () => clearInterval(id);
  }, [d]);
  if (!d || !pos) return null;
  const mouse = !ehToque() && d.mouse;
  const quem = CONSELHEIROS[d.quem];
  return (
    <>
      <Mao x={pos.mao.x} y={pos.mao.y} gesto={d.gesto} />
      <section class="dica-cartao" style={{ left: `${pos.cartao.x}px`, top: `${pos.cartao.y}px` }} data-hud="dica" data-dica={d.id} role="status" aria-live="polite">
        {quem ? <span class="dica-quem">{quem.nome}</span> : null}
        <p class="dica-texto">{t(mouse ? `u2.dica.${d.id}.mouse` : `u2.dica.${d.id}`)}</p>
        <div class="dica-acoes">
          <Botao a="dica.entendi" rotulo={t('u2.dica.entendi')} class="bt-pri" onClick={() => dispensarDica(ui)}>
            {t('u2.dica.entendi')}
          </Botao>
          <Botao a="dica.desligar" rotulo={t('u2.dica.desligar')} class="bt-fan" onClick={() => dispensarDica(ui, { desligar: true })}>
            {t('u2.dica.desligar')}
          </Botao>
        </div>
      </section>
    </>
  );
}
