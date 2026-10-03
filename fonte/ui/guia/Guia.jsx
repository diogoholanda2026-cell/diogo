// Peças da primeira hora no mundo e no HUD (dona: U2a; C1d): o anel de guia sobre o botão da categoria e o fantasma
// tracejado das sugestões com o "Usar sugestão" (a via, a quadra, o prédio e as ruas de terra da Vila a melhorar, uma
// linha por rua). O fantasma segue a câmera: os pontos passam por R.projetar a cada quadro (ui.aoQuadro) e vão direto
// aos atributos do SVG, sem redesenhar o componente.
import { useEffect, useRef, useState } from 'preact/hooks';
import { categoriaAgora, sugestoesAgora, usarSugestao, caixaDaQuadra, recortarNaFrente, tracosDaMelhoria } from './regras.js';
import { t } from '../textos.js';
import { Glifo } from '../glifos/Glifo.jsx';
import { alturaEm } from '../../comum/altura.js';

/** Anel que pulsa sobre o botão da categoria (a posição sai do retângulo do botão, duas vezes por segundo). */
export function AnelGuia({ ui }) {
  const cat = categoriaAgora(ui);
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

const xy = (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

/** Pontos do mundo de uma sugestão (contorno fechado na quadra; um ponto no prédio; os nós das ruas a melhorar). */
export function pontosDaSugestao(s) {
  if (s.tipo === 'via' || s.tipo === 'melhorar') return s.pontos;
  if (s.tipo === 'zona') {
    const [x0, z0, x1, z1] = caixaDaQuadra(s);
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  }
  return [[s.x, s.z]];
}

/** O ponto da lista mais perto do centro dela (o botão das ruas a melhorar fica sobre uma rua no meio da Vila). */
function pontoDoMeio(pts) {
  const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[2] / pts.length], [0, 0]);
  let melhor = pts[0];
  for (const p of pts) if (Math.hypot(p[0] - c[0], p[2] - c[1]) < Math.hypot(melhor[0] - c[0], melhor[2] - c[1])) melhor = p;
  return melhor;
}

function Sugestao({ ui, s, usar }) {
  const forma = useRef(null);
  const chip = useRef(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    const sim = ui.obterSim?.();
    const ter = sim?.espelho?.terreno;
    const noMundo = ([x, z]) => [x, ter?.altura ? alturaEm(ter, x, z) + 1 : 0, z];
    // as ruas a melhorar: uma linha por rua (a curva do espelho), não um traçado só pelos nós
    const tracos = s.tipo === 'melhorar' ? tracosDaMelhoria(s, sim?.espelho?.vias?.arestas).map((tr) => tr.map(noMundo)) : null;
    const mundo = tracos ? tracos.flat() : pontosDaSugestao(s).map(noMundo);
    if (!mundo.length) return undefined;
    // ponto do botão: o meio do traçado (ou o próprio lugar; nas ruas a melhorar, o ponto de rua mais perto do centro)
    const meio = mundo[Math.floor((mundo.length - 1) / 2)];
    const fim = mundo[mundo.length - 1];
    const ancora = tracos ? pontoDoMeio(mundo) : s.tipo === 'via' ? [(meio[0] + fim[0]) / 2, (meio[1] + fim[1]) / 2, (meio[2] + fim[2]) / 2] : s.tipo === 'zona' ? [(mundo[0][0] + mundo[2][0]) / 2, mundo[0][1], (mundo[0][2] + mundo[2][2]) / 2] : meio;
    const solta = ui.aoQuadro(() => {
      const R = ui.R;
      if (!R?.projetar || !forma.current) return;
      const tela = mundo.map((p) => R.projetar(p));
      const vis = tela.some((p) => p?.visivel);
      forma.current.style.display = vis ? '' : 'none';
      if (s.tipo === 'construir') {
        forma.current.setAttribute('cx', tela[0].x.toFixed(1));
        forma.current.setAttribute('cy', tela[0].y.toFixed(1));
      } else if (s.tipo === 'zona') {
        // o contorno da quadra cortado no plano da câmera (sem o canto espelhado)
        const [c] = recortarNaFrente(R.projetar, mundo, true);
        forma.current.setAttribute('points', c ? c.map(xy).join(' ') : '');
      } else {
        const d = (tracos ?? [mundo]).flatMap((tr) => recortarNaFrente(R.projetar, tr)).map((t) => `M${t.map(xy).join('L')}`).join('');
        forma.current.setAttribute('d', d || 'M0,0');
      }
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
        {s.tipo === 'via' || s.tipo === 'melhorar' ? <path ref={forma} /> : s.tipo === 'zona' ? <polygon ref={forma} /> : <circle ref={forma} r="22" />}
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
