// Marcas da ferramenta no mundo, no DOM (desenho da UI 8.10 e 9.2; D28): a mira de 20 px com o fio até o dedo (só no
// toque, com o dedo apoiado; "estala" no encaixe), as alças de 44 px (A, B, meio, fundo da grade), a cota perto do meio
// do traçado ("124 m · 3.720", vermelha com o motivo quando não dá), o chip do encaixe ("90°", "Cruzamento") e, nas
// Áreas, o preço de cada área comprável. As posições saem de R.projetar a cada quadro e mudam só o transform; o
// conteúdo muda com a sessão. Nada aqui recebe toque (as alças respondem pela entrada do render).
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../textos.js';
import * as fmt from '../formato.js';
import { VIAS } from '../../data/vias.js';
import { alturaEm } from '../../comum/altura.js';
import { ponto as pontoBz } from '../../comum/bezier.js';
import { sessao, vivo } from '../ferramentas/sessao.js';
import { alcas } from '../ferramentas/via.js';
import { centroLadrilho } from '../ferramentas/areas.js';

const ESTALO_MS = 120;
const agora = () => (typeof performance !== 'undefined' ? performance.now() : 0);

/** Ponto do meio do traçado (o segmento do meio em t = 0,5). */
export function meioDoPlano(previa) {
  const segs = previa?.segmentos;
  if (!segs?.length) return null;
  const s = segs[Math.floor((segs.length - 1) / 2)];
  const q = pontoBz(s.p, segs.length % 2 ? 0.5 : 1, [0, 0]);
  return q;
}

/** Texto da cota da via: total ou o motivo (o declive com o número, quando a prévia diz). */
export function textoCota(s) {
  const p = s.previa;
  if (s.erro) {
    if (s.erro.codigo === 'declive') {
      const seg = p?.segmentos?.[s.erro.trecho ?? 0] ?? p?.segmentos?.find((x) => x.erros?.includes('declive'));
      const max = VIAS[s.maquina.tipo]?.declive;
      if (seg && Number.isFinite(seg.declive) && max) return t('x2.motivo.declivePct', { p: Math.round(seg.declive * 100), max: Math.round(max * 100) });
    }
    return s.motivo;
  }
  return t('x2.cota', { m: fmt.numero(p.comprimento), custo: fmt.creditos(p.custo) });
}

/**
 * Marcas da sessão: [{ chave, classe, p?: [x, z] (mundo), texto?, dy? }].
 */
export function montarMarcas(s) {
  if (!s) return [];
  const l = [];
  if (s.tipo === 'via') {
    const m = s.maquina;
    for (const h of alcas(m)) l.push({ chave: `alca-${h.id}`, classe: `alca alca-${h.id}${m.alca === h.id ? ' pega' : ''}`, p: h.p });
    const comTraco = m.modo === 'melhorar' ? s.previa?.segmentos?.length : m.b && s.previa?.segmentos?.length;
    if (comTraco) {
      const q = meioDoPlano(s.previa);
      if (q) l.push({ chave: 'cota', classe: `cota${s.erro ? ' cota-er' : ''}`, p: q, texto: textoCota(s), dy: -34 });
    }
    if (s.encaixe?.ponto) l.push({ chave: 'enc', classe: 'cota cota-enc', p: s.encaixe.ponto, texto: s.encaixe.texto, dy: -40 });
  } else if (s.tipo === 'colocar') {
    const p = s.previa;
    if (p && !p.ok && Number.isFinite(p.x)) l.push({ chave: 'motivo', classe: 'cota cota-er', p: [p.x, p.z], texto: s.motivo, dy: -40 });
  } else if (s.tipo === 'areas') {
    const sel = s.info;
    for (const c of s.resumo?.compraveis ?? []) {
      const escolhido = sel && sel.i === c.i && sel.j === c.j;
      l.push({ chave: `a${c.i}-${c.j}`, classe: `cota cota-area${escolhido ? ' sel' : ''}`, p: centroLadrilho(c.i, c.j), texto: fmt.creditos(c.preco) });
    }
  }
  return l;
}

function Cotas({ ui }) {
  const raiz = useRef(null);
  const marcasRef = useRef([]);
  const s = sessao.value;
  const marcas = montarMarcas(s);
  marcasRef.current = marcas;

  useEffect(
    () =>
      ui.aoQuadro(() => {
        const el = raiz.current;
        if (!el) return;
        const R = ui.R;
        const T = ui.obterSim()?.espelho?.terreno;
        const mira = el.querySelector('.mira');
        const fio = el.querySelector('.mira-fio');
        const comMira = !!(sessao.value && vivo.apoiado && vivo.toque && vivo.mira && vivo.dedo);
        if (mira && fio) {
          if (comMira) {
            const [x, y] = vivo.mira;
            const [fx, fy] = vivo.dedo;
            const k = agora() - vivo.estalo < ESTALO_MS ? 1.15 : 1;
            mira.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${k})`;
            mira.style.opacity = '1';
            const L = Math.hypot(fx - x, fy - y);
            const a = Math.atan2(fy - y, fx - x);
            fio.style.width = `${Math.max(0, L - 12)}px`;
            fio.style.transform = `translate(${x}px, ${y}px) rotate(${a}rad) translateX(10px)`;
            fio.style.opacity = L > 14 ? '1' : '0';
          } else {
            mira.style.opacity = '0';
            fio.style.opacity = '0';
          }
        }
        if (!R?.projetar) return;
        for (const n of el.querySelectorAll('.marca')) {
          const m = marcasRef.current[Number(n.dataset.i)];
          if (!m?.p) continue;
          const y = (T?.altura ? alturaEm(T, m.p[0], m.p[1]) : 0) + 1;
          const q = R.projetar([m.p[0], y, m.p[1]]);
          const ok = q && Number.isFinite(q.x) && q.visivel !== false;
          if (!ok) {
            n.style.visibility = 'hidden';
            continue;
          }
          n.style.visibility = 'visible';
          n.style.transform = `translate(${q.x.toFixed(1)}px, ${(q.y + (m.dy ?? 0)).toFixed(1)}px) translate(-50%, -50%)`;
        }
      }),
    [],
  );

  return (
    <div ref={raiz} class="mundo-marcas" aria-hidden="true">
      <i class="mira-fio" />
      <i class="mira" />
      {marcas.map((m, i) => (
        <div key={m.chave} class={`marca ${m.classe}`} data-i={i}>
          {m.texto ? <span class="num">{m.texto}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function registrar(ui) {
  ui.registrarHud('mundo', Cotas, { ordem: 60, nome: 'x2-cotas' });
}
