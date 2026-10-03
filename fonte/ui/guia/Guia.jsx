// Peças da primeira hora no mundo e no HUD (dona: U2a): o anel de guia sobre o botão da categoria e o fantasma
// tracejado das sugestões com o "Usar sugestão". O fantasma segue a câmera: os pontos passam por R.projetar a cada
// quadro (ui.aoQuadro) e vão direto aos atributos do SVG, sem redesenhar o componente.
import { useEffect, useRef, useState } from 'preact/hooks';
import { categoriaAgora, sugestoesAgora, usarSugestao, caixaDaQuadra } from './regras.js';
import { t } from '../textos.js';
import { Glifo } from '../glifos/Glifo.jsx';
import { alturaEm } from '../../comum/altura.js';

/** Anel que pulsa sobre o botão da categoria (a posição sai do retângulo do botão, duas vezes por segundo). */
export function AnelGuia() {
  const cat = categoriaAgora();
  const [r, setR] = useState(null);
  useEffect(() => {
    if (!cat) return setR(null);
    const medir = () => {
      const el = document.querySelector(`[data-a="categoria"][data-k="${cat}"]`);
      const b = el?.getBoundingClientRect();
      setR(b && b.width ? { x: b.left, y: b.top, w: b.width, h: b.height } : null);
    };
    medir();
    const id = setInterval(medir, 500);
    return () => clearInterval(id);
  }, [cat]);
  if (!cat || !r) return null;
  return <div class="guia-anel" data-guia={cat} aria-hidden="true" style={{ left: `${r.x - 3}px`, top: `${r.y - 3}px`, width: `${r.w + 6}px`, height: `${r.h + 6}px` }} />;
}

/** Pontos do mundo de uma sugestão (contorno fechado na quadra; um ponto no prédio). */
export function pontosDaSugestao(s) {
  if (s.tipo === 'via') return s.pontos;
  if (s.tipo === 'zona') {
    const [x0, z0, x1, z1] = caixaDaQuadra(s);
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  }
  return [[s.x, s.z]];
}

function Sugestao({ ui, s, usar }) {
  const forma = useRef(null);
  const chip = useRef(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    const pts = pontosDaSugestao(s);
    const sim = ui.obterSim?.();
    const ter = sim?.espelho?.terreno;
    const mundo = pts.map(([x, z]) => [x, ter?.altura ? alturaEm(ter, x, z) + 1 : 0, z]);
    // ponto do botão: o meio do traçado (ou o próprio lugar)
    const meio = mundo[Math.floor((mundo.length - 1) / 2)];
    const fim = mundo[mundo.length - 1];
    const ancora = s.tipo === 'via' ? [(meio[0] + fim[0]) / 2, (meio[1] + fim[1]) / 2, (meio[2] + fim[2]) / 2] : s.tipo === 'zona' ? [(mundo[0][0] + mundo[2][0]) / 2, mundo[0][1], (mundo[0][2] + mundo[2][2]) / 2] : meio;
    const solta = ui.aoQuadro(() => {
      const R = ui.R;
      if (!R?.projetar || !forma.current) return;
      const tela = mundo.map((p) => R.projetar(p));
      const vis = tela.some((p) => p?.visivel);
      forma.current.style.display = vis ? '' : 'none';
      if (s.tipo === 'construir') {
        forma.current.setAttribute('cx', tela[0].x.toFixed(1));
        forma.current.setAttribute('cy', tela[0].y.toFixed(1));
      } else forma.current.setAttribute('points', tela.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
      if (chip.current) {
        const a = R.projetar(ancora);
        chip.current.style.display = a?.visivel ? '' : 'none';
        chip.current.style.left = `${a.x.toFixed(1)}px`;
        chip.current.style.top = `${(a.y - 14).toFixed(1)}px`;
      }
    });
    return solta;
  }, [s]);
  return (
    <>
      <svg class="sug-svg" aria-hidden="true">
        {s.tipo === 'via' ? <polyline ref={forma} /> : s.tipo === 'zona' ? <polygon ref={forma} /> : <circle ref={forma} r="22" />}
      </svg>
      {usar ? (
        <button
          type="button"
          ref={chip}
          class="bt sug-chip"
          data-a="sugestao.usar"
          data-k={s.id}
          aria-disabled={ocupado ? 'true' : undefined}
          onClick={async () => {
            if (ocupado) return;
            setOcupado(true);
            try {
              await usarSugestao(ui, s);
            } finally {
              setOcupado(false);
            }
          }}
        >
          <Glifo n="check" tam={16} />
          <span>{t('u2.sug.usar')}</span>
        </button>
      ) : null}
    </>
  );
}

/** As sugestões abertas no mundo. */
export function Sugestoes({ ui }) {
  const lista = sugestoesAgora(ui);
  if (!lista.length) return null;
  return (
    <div class="sugestoes" data-guia="sugestoes">
      {lista.map(({ s, usar }) => (
        <Sugestao key={s.id} ui={ui} s={s} usar={usar} />
      ))}
    </div>
  );
}
