// Painel do fantasma e puxador de giro da ferramenta de colocar (D98; dona: UX1). Vem sob demanda de sessao.js (um
// import() no registrar) e se registra no HUD (o painel em 'baixo', acima da barra da ferramenta; o puxador em 'mundo'). O painel diz o motivo de cada vermelho e o que fazer (a dica da
// sessão, com o texto de ui/textos/ux1.js; a via também tem a dela), o que o aplainar custa, e leva o "Alinhar à via" e os
// giros de 15 graus (só no colocar); o
// puxador fica na frente da planta e gira o fantasma pelo ímã de 15 graus (Shift solta o ímã no mouse). As posições saem
// de R.projetar a cada quadro e só o transform muda, como as cotas do mundo.
import { useEffect, useRef } from 'preact/hooks';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { t } from '../textos.js';
import { alturaEm } from '../../comum/altura.js';
import { sessao, ferramentas } from './sessao.js';
import { graus, azimuteDe, puxadorVisivel, PASSO_IMA } from './colocar.js';

const mouse = () => typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
const noColocar = (s) => (s && s.tipo === 'colocar' ? s : null);

/** Controles do colocar: o Alinhar à via e o giro de 15 em 15 graus (o ímã). */
function Controles({ s }) {
  const m = s.maquina;
  const g = graus(s.previa?.rot ?? m.rot);
  const pc = mouse();
  return (
    <div class="ux1-ctl vidro">
      <Botao
        a="colocar.alinhar"
        rotulo={t('ux1.alinhar')}
        ativo={m.alinhar}
        dica={m.alinhar ? (pc ? t('ux1.alinhar.dicaPc') : t('ux1.alinhar.dica')) : t('ux1.alinhar.desligado')}
        class={`chip chip-bt ux1-alinhar${m.alinhar ? ' ligado' : ''}`}
        onClick={() => ferramentas.alinhar()}
      >
        <Glifo n="encaixe" tam={16} />
        <span class="chip-texto">{t('ux1.alinhar')}</span>
      </Botao>
      <Botao a="colocar.giro.menos" rotulo={t('ux1.giro.menos')} dica={pc ? t('ux1.giro.dicaPc') : t('ux1.giro.menos')} class="bt-glifo ux1-giro-bt ux1-espelho" onClick={() => ferramentas.girar(-1, PASSO_IMA)}>
        <Glifo n="girar" tam={18} />
      </Botao>
      <span class="ux1-giro num" aria-label={t('ux1.giro.rotulo', { g })}>
        {t('ux1.giro', { g })}
      </span>
      <Botao a="colocar.giro.mais" rotulo={t('ux1.giro.mais')} dica={pc ? t('ux1.giro.dicaPc') : t('ux1.giro.mais')} class="bt-glifo ux1-giro-bt" onClick={() => ferramentas.girar(1, PASSO_IMA)}>
        <Glifo n="girar" tam={18} />
      </Botao>
    </div>
  );
}

/** Painel: a dica do bloqueio (ou do aplainar) e, no colocar, os controles. A via só mostra a dica. */
export function Painel() {
  const s = sessao.value;
  if (!s || (s.tipo !== 'colocar' && !(s.tipo === 'via' && s.dica))) return null;
  const d = s.dica;
  return (
    <div class="ux1-painel" data-hud="ux1" role="group" aria-label={t('ux1.painel')}>
      {d ? (
        <p class={`ux1-dica ux1-${d.tom}`} role="status" data-codigo={d.codigo}>
          <Glifo n={d.tom === 'er' ? 'alerta' : 'info'} tam={16} />
          <span>{d.texto}</span>
        </p>
      ) : null}
      {s.tipo === 'colocar' ? <Controles s={s} /> : null}
    </div>
  );
}

/** Ponto do chão sob o ponteiro, ou null (R.raio devolve [x, y, z]). */
function chaoSob(ui, ev) {
  const canvas = typeof document !== 'undefined' ? document.getElementById('mundo') : null;
  const r = canvas?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
  const p = ui.R?.raio?.(ev.clientX - r.left, ev.clientY - r.top);
  return p ? [p[0], p[2]] : null;
}

/** Puxador na frente do fantasma: arrastar gira a planta em volta do centro dela. */
export function Puxador({ ui }) {
  const no = useRef(null);
  const puxando = useRef(false);
  const s = noColocar(sessao.value);

  useEffect(
    () =>
      ui.aoQuadro(() => {
        const el = no.current;
        if (!el) return;
        const p = noColocar(sessao.peek())?.previa;
        if (!puxadorVisivel(p, mouse()) || !ui.R?.projetar) {
          el.style.visibility = 'hidden';
          return;
        }
        const d = p.pegada?.[1] ?? 24;
        const off = d / 2 + 14;
        const x = p.x + Math.sin(p.rot) * off;
        const z = p.z + Math.cos(p.rot) * off;
        const T = ui.obterSim()?.espelho?.terreno;
        const q = ui.R.projetar([x, (T?.altura ? alturaEm(T, x, z) : 0) + 1, z]);
        if (!q || !Number.isFinite(q.x) || q.visivel === false) {
          el.style.visibility = 'hidden';
          return;
        }
        el.style.visibility = 'visible';
        el.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -50%)`;
      }),
    [],
  );

  if (!s) return null;
  const gira = (ev) => {
    if (!puxando.current) return;
    const p = noColocar(sessao.peek())?.previa;
    const g = chaoSob(ui, ev);
    if (!p || !g) return;
    const az = azimuteDe([p.x, p.z], g);
    if (az !== null) ferramentas.girarPara(az, { livre: !!ev.shiftKey });
  };
  return (
    <button
      ref={no}
      type="button"
      class="ux1-puxador"
      data-a="colocar.puxador"
      aria-label={t('ux1.giro.puxador')}
      title={t('ux1.giro.puxador')}
      onPointerDown={(ev) => {
        ev.preventDefault();
        puxando.current = true;
        try {
          ev.currentTarget.setPointerCapture(ev.pointerId);
        } catch (e) {
          // sem captura o arrasto segue pelo move da página
        }
      }}
      onPointerMove={gira}
      onPointerUp={() => (puxando.current = false)}
      onPointerCancel={() => (puxando.current = false)}
      onLostPointerCapture={() => (puxando.current = false)}
    >
      <Glifo n="girar" tam={22} />
    </button>
  );
}

export function registrar(ui) {
  // o painel mora na linha de baixo, onde está a barra da ferramenta, e sobe acima dela (bottom: 100%), qualquer que seja a altura
  ui.registrarHud('baixo', Painel, { ordem: 95, nome: 'ux1-painel' });
  ui.registrarHud('mundo', Puxador, { ordem: 81, nome: 'ux1-puxador' });
}
