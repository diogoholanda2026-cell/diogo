// Menu de contexto (desenho da UI 8.8 e 9.1): toque longo (450 ms, o render decide e vibra) ou clique direito no mundo
// abre até 4 pétalas de 56 px em arco em volta do dedo, puxadas para cima e para dentro da tela (nunca sob o dedo),
// com rótulo 12/600. Soltar sobre uma pétala executa; tocar fora, Esc ou soltar fora cancela.
//   prédio: Detalhes, Localizar, Cor, Demolir · prédio da Holding: Detalhes, Produção, Cor, Demolir
//   via: Detalhes, Melhorar, Demolir · terreno: Zonear aqui, Construir aqui, Valor do terreno · Arcologia: Detalhes
// O toque longo chega por R.entrada.aoToque (o mesmo que seleciona, D40). abrirMenuContexto(ui, x, y) abre por fora
// (a vitrine e o robô).
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { selecao, ferramenta } from '../loja.js';
import { t } from '../textos.js';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { ferramentas, sessao } from '../ferramentas/sessao.js';
import { manterFolha, ehPredio } from '../selecao/Cartao.jsx';

export const PETALA = 56;
const RAIO = 76;
/** { x, y, sel, itens: [{ id, glifo, rotulo }] } ou null. */
export const menuContexto = signal(null);

/** Tipo do menu pela seleção (e pelo prédio, que diz se é da Holding). */
export function tipoDoMenu(sel, p) {
  if (!sel) return null;
  if (sel.tipo === 'aresta') return 'via';
  if (sel.tipo === 'terreno') return 'terreno';
  if (sel.tipo === 'arcologia') return 'arcologia';
  if (ehPredio(sel)) return p?.tipo === 'holding' || (p?.holding && !p?.servico) ? 'holding' : 'predio';
  return null;
}

const ITENS = {
  predio: [['detalhes', 'info'], ['localizar', 'localizar'], ['cor', 'cor'], ['demolir', 'demolir']],
  holding: [['detalhes', 'info'], ['producao', 'lote'], ['cor', 'cor'], ['demolir', 'demolir']],
  via: [['detalhes', 'info'], ['melhorar', 'avenida'], ['demolir', 'demolir']],
  terreno: [['zonear', 'zonas'], ['construir', 'servicos'], ['valor', 'mapa']],
  arcologia: [['detalhes', 'info']],
};

/**
 * Posições das pétalas (centro, px de tela): em arco acima do ponto, de 150° a 30° (para baixo só se não couber em
 * cima), puxadas para dentro da tela com folga de 8 px.
 */
export function posicoesPetalas(n, x, y, W, H, raio = RAIO, lado = PETALA) {
  const meio = lado / 2 + 8;
  const cima = y - raio - meio >= 0;
  const passo = n > 1 ? Math.min(40, 120 / (n - 1)) : 0;
  const ini = 90 + (passo * (n - 1)) / 2;
  return Array.from({ length: n }, (_, i) => {
    const a = ((ini - passo * i) * Math.PI) / 180;
    const px = x + raio * Math.cos(a);
    const py = cima ? y - raio * Math.sin(a) : y + raio * Math.sin(a);
    return { x: Math.min(W - meio, Math.max(meio, px)), y: Math.min(H - meio, Math.max(meio, py)) };
  });
}

/**
 * As pétalas que valem para o que foi tocado: a via sem melhoria não mostra Melhorar, e a rodovia e as vias da
 * Arcologia não mostram Demolir (como o rodapé da folha).
 */
export function itensDoMenu(tipo, p) {
  return (ITENS[tipo] ?? []).filter(([id]) => {
    if (tipo !== 'via') return true;
    if (id === 'melhorar') return !!p?.melhoraPara?.length;
    if (id === 'demolir') return !p?.rodovia && !p?.arcologia;
    return true;
  });
}

/** Abre o menu no ponto de tela (x, y) do que R.selecionar achar ali; nada útil (água, céu), não abre. */
export function abrirMenuContexto(ui, x, y) {
  if (ferramenta.peek() || sessao.peek()) return false;
  const s = ui.R?.selecionar?.(x, y);
  if (!s || s.tipo === 'agua') return false;
  const sel = s.tipo === 'marcador' ? { ...s, tipo: 'predio' } : s;
  const p = ehPredio(sel) ? ui.consultar('predio', sel.ref) : sel.tipo === 'aresta' ? ui.consultar('aresta', sel.ref) : null;
  const tipo = tipoDoMenu(sel, p);
  if (!tipo) return false;
  const itens = itensDoMenu(tipo, p).map(([id, glifo]) => ({ id, glifo, rotulo: t(`ctx.${id}`) }));
  menuContexto.value = { x, y, sel, tipo, tipoVia: p?.melhoraPara?.[0] ?? null, itens };
  return true;
}

export const fecharMenuContexto = () => (menuContexto.value = null);

/** Faz a ação de uma pétala. */
export function executarPetala(ui, id, m = menuContexto.peek()) {
  if (!m) return;
  fecharMenuContexto();
  const { sel } = m;
  const selecionar = (folha) => {
    manterFolha.proxima = folha;
    selecao.value = sel;
    if (sel.tipo !== 'terreno') ui.R?.selecionado?.({ tipo: sel.tipo, ref: sel.ref });
  };
  if (id === 'detalhes' || id === 'cor' || id === 'valor') return selecionar(true);
  if (id === 'localizar') {
    selecionar(false);
    if (sel.ponto) ui.R?.camera?.irPara?.({ x: sel.ponto[0], z: sel.ponto[2], dist: 220 }, 900);
    return;
  }
  if (id === 'producao') {
    selecionar(true);
    return;
  }
  if (id === 'demolir') return (ferramenta.value = { tipo: 'demolir' });
  // a melhoria para o tipo seguinte da via tocada (a mesma que o rodapé da folha abre)
  if (id === 'melhorar') return (ferramenta.value = { tipo: 'via', modo: 'melhorar', ...(m.tipoVia ? { tipoVia: m.tipoVia } : {}) });
  if (id === 'zonear') return ferramentas.escolherCategoria('zonas');
  if (id === 'construir') return ferramentas.escolherCategoria('servicos');
}

export function MenuContexto({ ui }) {
  const m = menuContexto.value;
  useEffect(() => {
    if (!m) return undefined;
    const t0 = performance.now();
    const petalaEm = (ev) => document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('[data-petala]');
    // soltar o dedo do toque longo sobre uma pétala executa; soltar fora logo depois de abrir deixa o menu aberto
    // (o dedo pode tocar a pétala em seguida); soltar fora depois cancela
    const solta = (ev) => {
      const p = petalaEm(ev);
      if (p) {
        ev.preventDefault();
        executarPetala(ui, p.dataset.petala, m);
      } else if (performance.now() - t0 > 600) fecharMenuContexto();
    };
    const desce = (ev) => {
      if (!petalaEm(ev)) fecharMenuContexto();
    };
    const tecla = (ev) => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation();
      fecharMenuContexto();
    };
    document.addEventListener('pointerup', solta, true);
    document.addEventListener('pointerdown', desce, true);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerup', solta, true);
      document.removeEventListener('pointerdown', desce, true);
      document.removeEventListener('keydown', tecla);
    };
  }, [m]);
  if (!m) return null;
  const W = typeof innerWidth === 'number' ? innerWidth : 1000;
  const H = typeof innerHeight === 'number' ? innerHeight : 500;
  const pos = posicoesPetalas(m.itens.length, m.x, m.y, W, H);
  return (
    <div class="ctx" role="menu" aria-label={t('ctx.rotulo')}>
      <i class="ctx-dedo" style={{ transform: `translate(${m.x}px, ${m.y}px)` }} aria-hidden="true" />
      {m.itens.map((it, i) => (
        <Botao a="ctx" k={it.id} rotulo={it.rotulo} role="menuitem" data-petala={it.id} class="ctx-petala" style={{ transform: `translate(${pos[i].x}px, ${pos[i].y}px)` }} onClick={() => executarPetala(ui, it.id, m)}>
          <span class="ctx-bola">
            <Glifo n={it.glifo} tam={22} />
          </span>
          <span class="ctx-rot">{it.rotulo}</span>
        </Botao>
      ))}
    </div>
  );
}

let soltar = null;

export function registrar(ui) {
  soltar?.();
  soltar = ui.R?.entrada?.aoToque?.(({ x, y, longo, botao }) => {
    if (longo || botao === 2) abrirMenuContexto(ui, x, y);
  });
  ui.registrarHud('sobre', MenuContexto, { ordem: 60, nome: 'menu-contexto' });
}

