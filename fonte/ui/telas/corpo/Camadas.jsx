// Corpo das camadas (desenho da UI 8.12 e 8.9; D29; X3a), sob demanda: vem na primeira vez que o trilho abre o popover
// ou que alguém liga uma camada (a folha, a faixa de alerta, a ferramenta de colocar). Três peças:
//   ligar(ui)        ouve loja.camada e manda o pedido ao render (R.camadas.mostrar / ocultar); quadro(ui, t) confere a
//                    versão do dado quando a rodada vira (no máximo a cada 2 s) e quando o diário (sim.mudancas) marca
//                    o domínio da camada (até 4 vezes por segundo: a zona pintada com o jogo pausado aparece na hora), e
//                    manda de novo quando mudou
//   PopoverCamadas   grade de 2 colunas com as camadas (glifo e nome) e, embaixo, o filtro dos avisos
//   LegendaCamada    chip de até 360 px embaixo ao centro: a rampa com o mínimo e o máximo (e a unidade) ou as
//                    categorias, a frase do resumo (dinheiro em dólar, D68), o X para desligar; no Bem-estar, a
//                    Contribuição por morador de cada faixa em dólar por hora sob a rampa (a da cidade agora em
//                    destaque); na Recursos, as obras paradas por falta de material (pela flag do prédio) com "Próxima"
import { signal, effect } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { Botao } from '../../comp/Botao.jsx';
import { Segmentado } from '../../comp/Segmentado.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { CAMADAS_UI, paraRender, modeloLegenda, criarVigiaDiario } from '../../mundo/camadas.js';
import { FILTROS_AVISOS, filtroAtual, mudarFiltro } from '../../mundo/marcadores.js';
import { PREDIO } from '../../../contratos/flags.js';
import { RODADA } from '../../../comum/relogio.js';

const CSS = `
.x3-pop{position:absolute;top:calc(var(--mC) + 48px);right:calc(var(--mD) + 56px);width:288px;max-height:calc(100% - var(--mC) - 64px);
  overflow:auto;padding:var(--e3);border-radius:var(--r2);background:var(--s1);box-shadow:var(--luz),var(--sombra2);pointer-events:auto;
  color:var(--t1);z-index:var(--z-popover)}
.x3-pop h2,.x3-pop .x3-sec{margin:0 0 var(--e2);font-size:var(--t12);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t2)}
.x3-pop .x3-sec{margin-top:var(--e3)}
.x3-grade{display:grid;grid-template-columns:1fr 1fr;gap:var(--e1)}
.x3-cam{display:flex;align-items:center;gap:var(--e2);min-height:var(--alvo);padding:0 var(--e2);border-radius:var(--r1);
  background:var(--s2);color:var(--t1);font-size:var(--t13);font-weight:600;text-align:left;line-height:1.15}
.x3-cam .glifo{flex:none;color:var(--t2)}
.x3-cam[aria-pressed='true']{background:var(--acF);box-shadow:inset 0 0 0 1px var(--ac)}
.x3-cam[aria-pressed='true'] .glifo{color:var(--ac)}
.x3-pop .segmentado{width:100%}
.x3-pop .segmentado .seg{flex:1;font-size:var(--t12)}
/* a legenda fica no mundo (sem zoom): a folga sobre a barra de construção e sob a barra de cima acompanha o zoom do HUD
   (1,25 em 1080 p: com 60 px fixos ela encostava na barra de construção) */
.x3-leg{position:absolute;left:50%;bottom:calc(var(--mB) + 60px * var(--zoom, 1));transform:translateX(-50%);width:min(360px,calc(100% - 32px));
  padding:var(--e2) var(--e3) var(--e3);border-radius:var(--r2);background:var(--s0);box-shadow:var(--luz),var(--sombra1);pointer-events:auto;
  color:var(--t1)}
.x3-leg.x3-alto{bottom:auto;top:calc(var(--mC) + 100px * var(--zoom, 1))}
.x3-leg-cab{display:flex;align-items:center;gap:var(--e2);min-height:32px}
.x3-leg-cab .glifo{color:var(--ac);flex:none}
.x3-leg-tit{flex:1;font-size:var(--t12);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t2)}
.x3-leg-x{width:32px;height:32px;display:grid;place-items:center;border-radius:var(--r1);color:var(--t2)}
.x3-leg-x::after{content:'';position:absolute;inset:-6px}
.x3-rampa{position:relative;height:10px;border-radius:5px;margin:var(--e1) 0 2px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.x3-marca{position:absolute;top:-2px;bottom:-2px;width:2px;margin-left:-1px;background:var(--t1);border-radius:1px;opacity:.85}
.x3-escala{position:relative;display:flex;justify-content:space-between;font-size:var(--t12);font-weight:600;color:var(--t2);min-height:16px}
.x3-escala .x3-meio{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap}
.x3-cats{display:flex;flex-wrap:wrap;gap:var(--e1) var(--e3);margin:var(--e1) 0 2px;font-size:var(--t12);font-weight:600}
.x3-cat{display:flex;align-items:center;gap:6px}
.x3-cat i{width:12px;height:12px;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
.x3-faixas{display:flex;margin-top:2px;font-size:var(--t12);font-weight:600;color:var(--ch)}
.x3-faixa{position:relative;flex:none;min-width:0;padding:4px 2px 0;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.x3-faixa::before{content:'';position:absolute;top:0;left:3px;right:3px;height:2px;border-radius:1px;background:var(--fio2)}
.x3-faixa.x3-atual{font-weight:750}
.x3-faixa.x3-atual::before{background:var(--ch)}
.x3-resumo{margin-top:var(--e1);font-size:var(--t12);font-weight:500;color:var(--t2);line-height:1.3}
.x3-extra{display:flex;align-items:center;gap:var(--e2);margin-top:var(--e2);font-size:var(--t12);font-weight:600}
.x3-extra .glifo{color:var(--al);flex:none}
.x3-extra span{flex:1}
.x3-extra .bt{min-height:32px;padding:0 var(--e3);border-radius:var(--rp);background:var(--s3);font-size:var(--t12);font-weight:650}
.x3-extra .bt::after{content:'';position:absolute;top:-6px;bottom:-6px;left:0;right:0}
`;

let estiloPosto = false;
function usarEstilo() {
  if (estiloPosto || typeof document === 'undefined') return;
  estiloPosto = true;
  const el = document.createElement('style');
  el.dataset.estilo = 'x3-camadas';
  el.textContent = CSS;
  document.head.appendChild(el);
}

// ------------------------------------------------------------------------------------------------ dado e render

/** O dado da camada ligada: { id, d (q.camada), versao, daltonico } ou null. */
const atual = signal(null);
/** Obras paradas por falta de material (idx dos prédios), para a legenda da Recursos. */
const paradas = signal([]);
let ligado = false;
let tConferido = -Infinity;
let tDiario = -Infinity;
let rodadaConferida = -1;
/** Olha o diário da simulação (células, prédios, vias) desde a última consulta da camada. */
const vigia = criarVigiaDiario();
/**
 * Intervalo (ms) entre duas olhadas no diário: pausado, a pintura aparece em até um quarto de segundo; com o relógio
 * andando, em até 1 s (a cidade crescendo marca células e a Zonas de uma cidade grande custa alguns ms por consulta).
 */
const MS_DIARIO = 250;
const MS_DIARIO_RODANDO = 1000;
let tiqueDiario = null;
const daltonicoDe = (p) => !!(p?.daltonismo ?? p?.paletaDaltonismo);
/** A rodada da simulação (os dados das camadas mudam na virada dela); -1 sem relógio. */
const rodadaDe = (ui) => {
  const tq = ui.obterSim()?.espelho?.tempo?.tique;
  return Number.isFinite(tq) ? Math.floor(tq / RODADA) : -1;
};

/**
 * Obras paradas por falta de material, pela flag do prédio no espelho (a obra de nível também; o aviso do marcador só
 * traz o pior aviso, e uma obra parada sem água sairia da conta). Troca o sinal só quando a lista muda.
 */
function conferirParadas(ui) {
  const P = ui.obterSim()?.espelho?.predios;
  const out = [];
  if (P?.flags) for (let i = 0; i < P.n; i++) if (P.viva[i] && P.flags[i] & PREDIO.SEM_MATERIAL) out.push(i);
  const ant = paradas.peek();
  if (out.length !== ant.length || out.some((v, k) => v !== ant[k])) paradas.value = out;
}

/** Pede o dado (ou usa o já pedido) e manda ao render; sem dado, avisa e desliga. */
function aplicar(ui, id, dado = null) {
  const R = ui.R;
  if (!id) {
    atual.value = null;
    R?.camadas?.ocultar?.();
    return;
  }
  const d = dado ?? ui.consultar('camada', id);
  rodadaConferida = rodadaDe(ui);
  vigia.base(ui.obterSim());
  if (id === 'recursos') conferirParadas(ui);
  if (!d?.dados) {
    atual.value = null;
    R?.camadas?.ocultar?.();
    ui.loja.avisar({ texto: ui.t('x3.camadas.indisponivel'), gravidade: 'info', glifo: 'camadas' });
    // fora do efeito que lê a camada (escrever nela aqui dentro faria o efeito se chamar de novo na mesma volta)
    queueMicrotask(() => {
      if (ui.loja.camada.peek() === id) ui.loja.camada.value = null;
    });
    return;
  }
  const daltonico = daltonicoDe(ui.loja.prefs.peek());
  R?.camadas?.mostrar?.(paraRender(d, { daltonico, predios: ui.obterSim()?.espelho?.predios, celulas: ui.obterSim()?.espelho?.celulas }));
  atual.value = { id, d, versao: d.versao ?? 0, daltonico };
}

/** Liga a ponte entre loja.camada e o render (uma vez). */
export function ligar(ui) {
  if (ligado) return;
  ligado = true;
  usarEstilo();
  let antes = null;
  effect(() => {
    const id = ui.loja.camada.value;
    const dalt = daltonicoDe(ui.loja.prefs.value); // a paleta para daltonismo
    // outra preferência mudou (o som, o tamanho): nada a mandar de novo
    if (antes && antes.id === id && antes.dalt === dalt) return;
    antes = { id, dalt };
    aplicar(ui, id);
  });
}

/** Consulta a camada de novo e manda ao render se o dado mudou (a versão subiu). */
function reconsultar(ui, a) {
  if (a.id === 'recursos') conferirParadas(ui);
  const d = ui.consultar('camada', a.id);
  vigia.base(ui.obterSim());
  if (d && (d.versao ?? 0) !== a.versao) aplicar(ui, a.id, d);
}

/**
 * Com a camada ligada: a cada 250 ms (pausado) ou 1 s (rodando) olha o diário, e se ele marcou o domínio da camada (a
 * zona pintada, o prédio feito ou demolido com o jogo pausado, a via) consulta de novo; a cada 2 s, quando a rodada
 * virou, também. Pausado e sem comando, nada se consulta. A consulta refaz a camada inteira (a Recursos custa uns 7 a
 * 15 ms; ela é por grade e não olha o diário), e o dado só vai ao render quando a versão muda.
 */
export function quadro(ui, tMs) {
  const a = atual.peek();
  if (!a) return;
  const tique = ui.obterSim()?.espelho?.tempo?.tique ?? null;
  if (tMs - tDiario >= (tique === tiqueDiario ? MS_DIARIO : MS_DIARIO_RODANDO)) {
    tDiario = tMs;
    tiqueDiario = tique;
    if (vigia.olhar(ui.obterSim(), a.d?.fonte)) {
      rodadaConferida = rodadaDe(ui);
      tConferido = tMs;
      reconsultar(ui, a);
      return;
    }
  }
  if (tMs - tConferido < 2000) return;
  tConferido = tMs;
  const rodada = rodadaDe(ui);
  if (rodada >= 0 && rodada === rodadaConferida) return;
  rodadaConferida = rodada;
  reconsultar(ui, a);
}

// ------------------------------------------------------------------------------------------------ popover

export function PopoverCamadas({ ui, aberto }) {
  usarEstilo();
  const ref = useRef(null);
  useEffect(() => {
    const fora = (ev) => {
      if (!ref.current || ref.current.contains(ev.target)) return;
      // o próprio botão do trilho troca o estado: aqui não fecha, para ele não reabrir
      if (ev.target?.closest?.('[data-a="trilho"][data-k="camadas"]')) return;
      aberto.value = false;
    };
    const tecla = (ev) => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation();
      aberto.value = false;
    };
    document.addEventListener('pointerdown', fora, true);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora, true);
      document.removeEventListener('keydown', tecla);
    };
  }, []);
  const { t, loja } = ui;
  const ligada = loja.camada.value;
  const ids = ui.obterSim()?.camadas?.ids?.() ?? null;
  const filtro = filtroAtual(loja.prefs.value);
  const lista = CAMADAS_UI.filter((c) => !ids || ids.includes(c.id) || c.id !== 'valor');
  return (
    <div ref={ref} class="x3-pop" role="dialog" aria-label={t('x3.camadas.titulo')} data-popover="camadas">
      <h2>{t('x3.camadas.titulo')}</h2>
      <div class="x3-grade" role="group" aria-label={t('x3.camadas.grade')}>
        {lista.map((c) => {
          const nome = t(`camada.${c.id}`);
          const on = ligada === c.id;
          return (
            <Botao a="camada" k={c.id} rotulo={on ? t('x3.camadas.ligada', { nome }) : nome} ativo={on} class="x3-cam" onClick={() => (loja.camada.value = on ? null : c.id)}>
              <Glifo n={c.glifo} tam={20} />
              <span>{nome}</span>
            </Botao>
          );
        })}
      </div>
      <div class="x3-sec">{t('x3.camadas.avisos')}</div>
      <Segmentado a="x3.filtro" rotulo={t('x3.camadas.avisos')} valor={filtro} aoTrocar={(v) => mudarFiltro(ui, v)} opcoes={FILTROS_AVISOS.map((v) => ({ v, rotulo: t(`x3.filtro.${v}`) }))} />
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ legenda

let proxima = 0;

function irParaObra(ui, lista) {
  const P = ui.obterSim()?.espelho?.predios;
  if (!lista.length || !P || !ui.R?.camera?.irPara) return;
  const i = lista[proxima++ % lista.length];
  if (i < P.n) ui.R.camera.irPara({ x: P.x[i], z: P.z[i], dist: 260 }, 900);
}

export function LegendaCamada({ ui }) {
  usarEstilo();
  const a = atual.value;
  const { t, fmt, loja } = ui;
  if (!a || a.id !== loja.camada.value) return null;
  const obras = a.id === 'recursos' ? paradas.value : null;
  const extra = obras ? (obras.length === 1 ? t('x3.legenda.obraParada') : obras.length ? t('x3.legenda.obrasParadas', { n: fmt.numero(obras.length) }) : t('x3.legenda.semObrasParadas')) : null;
  const m = modeloLegenda(a.d, { t, num: (n) => fmt.numero(n), dinheiro: fmt.dinheiro, porHora: fmt.dinheiroPorHora, daltonico: a.daltonico, extra });
  if (!m) return null;
  const glifo = CAMADAS_UI.find((c) => c.id === a.id)?.glifo ?? 'camadas';
  const alto = !!loja.ferramenta.value;
  return (
    <section class={`x3-leg${alto ? ' x3-alto' : ''}`} data-hud="legenda" aria-label={t('x3.legenda.rotulo', { nome: m.titulo })}>
      <div class="x3-leg-cab">
        <Glifo n={glifo} tam={18} />
        <span class="x3-leg-tit">{m.titulo}</span>
        <Botao a="x3.legenda.fechar" rotulo={t('x3.legenda.fechar')} dica={t('x3.legenda.fechar')} class="x3-leg-x" onClick={() => (loja.camada.value = null)}>
          <Glifo n="fechar" tam={18} />
        </Botao>
      </div>
      {m.tipo === 'cat' ? (
        <div class="x3-cats">
          {m.itens.map((it) => (
            <span class="x3-cat">
              <i style={{ background: it.cor }} />
              {it.texto}
            </span>
          ))}
        </div>
      ) : (
        <div>
          <div class="x3-rampa" style={{ background: m.gradiente }}>
            {m.marcas.map((k) => (
              <span class="x3-marca" style={{ left: `${(100 * k.pos).toFixed(1)}%` }} title={k.dica} />
            ))}
          </div>
          <div class="x3-escala">
            <span>{m.pontas[0]}</span>
            {m.marcas.map((k) => (
              <span class="x3-meio" style={{ left: `${(100 * k.pos).toFixed(1)}%` }} title={k.dica}>
                {k.texto}
              </span>
            ))}
            <span>{m.pontas[1]}</span>
          </div>
          {m.faixas ? (
            <div class="x3-faixas" role="list" aria-label={t('x3.legenda.faixas')} data-faixas="contribuicao">
              {m.faixas.map((f) => (
                <span role="listitem" class={`x3-faixa num${f.atual ? ' x3-atual' : ''}`} style={{ width: `${(100 * (f.fim - f.ini)).toFixed(1)}%` }} title={`${f.dica} (${fmt.dicaHora()})`} data-dica="hora" data-tarifa={f.tarifa}>
                  {f.texto}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
      {m.resumo ? <div class="x3-resumo">{m.resumo}</div> : null}
      {m.extra ? (
        <div class="x3-extra">
          <Glifo n="semMaterial" tam={18} />
          <span>{m.extra}</span>
          {obras?.length ? (
            <Botao a="x3.legenda.proxima" rotulo={t('x3.legenda.proxima')} onClick={() => irParaObra(ui, obras)}>
              {t('x3.legenda.proxima')}
            </Botao>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
