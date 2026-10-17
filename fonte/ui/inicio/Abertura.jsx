// Abertura (desenho da UI 7.6 e 8.19; D67, D88; dona: U2b): 40 s sobre a cena do próprio jogo, depois do "Começar" da
// nova partida. A câmera voa em quatro tempos (a Held Capital sobre a baía, Heldópolis, a Arcologia de Held vista do mar
// e a volta à vista de partida) com barras de cinema e uma legenda por tempo; termina exatamente na câmera da partida,
// então o jogo começa sem corte. Esc, Espaço, Enter ou o botão "Pular abertura" encerram na hora. Não toca na
// simulação (a partida nova abre pausada, D10) e não roda no Continuar nem no Carregar. Preferência `abertura` (padrão
// ligada) nas Configurações desliga. Só no jogo de verdade (com menu inicial): nem a vitrine nem as cenas.
import { signal, effect } from '@preact/signals';
import { t } from '../textos.js';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { registrar as registrarTextosU2b } from '../textos/u2b.js';
import { usarEstilo } from './estilo.js';
import { inicio } from './estado.js';
import { temInicio } from './carga.js';

/** A câmera da partida (a mesma de app/controle.js, CAMERAS.partida): a abertura termina nela. */
export const CAMERA_PARTIDA = Object.freeze({ x: -300, z: -80, dist: 2300, guinada: -14, inclinacao: 33 });

/**
 * Os quatro tempos: a duração (ms), a legenda (chave do título e do texto) e a câmera. `para` pode ser função do centro
 * da Arcologia (x, z do platô da sede, GLEBA_ENVELOPE.centro). Soma 40 s.
 */
export const CENAS = Object.freeze([
  { ms: 10000, chave: 'l1', inicio: (c) => ({ x: c[0] + 500, z: c[1] + 900, dist: 5200, guinada: -38, inclinacao: 19 }), para: () => ({ x: -200, z: 40, dist: 3400, guinada: -18, inclinacao: 27 }) },
  { ms: 12000, chave: 'l2', inicio: null, para: () => ({ x: -300, z: -80, dist: 1000, guinada: -52, inclinacao: 30 }) },
  { ms: 12000, chave: 'l3', inicio: null, para: (c) => ({ x: c[0], z: c[1], dist: 760, guinada: 8, inclinacao: 15 }) },
  { ms: 6000, chave: 'l4', inicio: null, para: () => ({ ...CAMERA_PARTIDA }) },
]);

/** Duração total da abertura. */
export const DURACAO_MS = CENAS.reduce((s, c) => s + c.ms, 0);

/** Em que tempo (índice de CENAS) está a abertura aos `ms` desde o começo; -1 depois do fim. */
export function cenaNoTempo(ms) {
  let acumulado = 0;
  for (let i = 0; i < CENAS.length; i++) {
    acumulado += CENAS[i].ms;
    if (ms < acumulado) return i;
  }
  return -1;
}

/** null fora da abertura; senão { cena, vez } (a vez muda para as legendas reiniciarem o fade). */
export const abertura = signal(null);

let ficha = null; // o roteiro em andamento { cancelado, acordar }

const CSS_ABERTURA = `
html[data-abertura] #ui .ui-raiz>*:not(.lugar-sobre),html[data-abertura] #ui .lugar-sobre>*:not(.abertura):not(.toasts){visibility:hidden;pointer-events:none}
.abertura{position:fixed;inset:0;z-index:6;pointer-events:auto;cursor:default;font-family:var(--fonte);color:var(--t1)}
.ab-barra{position:absolute;left:0;right:0;height:11vh;background:#05070a}
.ab-barra-cima{top:0}.ab-barra-baixo{bottom:0}
.ab-legenda{position:absolute;left:max(var(--mE),7vw);bottom:calc(11vh + var(--e5));max-width:min(560px,60vw);display:flex;flex-direction:column;gap:var(--e2);
  padding:var(--e4) var(--e5);border-radius:var(--r3);background:var(--s1);box-shadow:var(--luz),var(--sombra2);animation:abLegenda var(--ab-dur) ease both}
.ab-titulo{margin:0;font-size:var(--t28);font-weight:650;letter-spacing:.14em;text-transform:uppercase}
.ab-texto{margin:0;font-size:var(--t15);font-weight:500;line-height:1.45;color:var(--t1)}
.ab-fio{width:56px;height:2px;background:var(--ch)}
.ab-pular{position:absolute;right:max(var(--mE),var(--e5));bottom:calc(11vh + var(--e5));display:flex;flex-direction:column;align-items:flex-end;gap:6px;
  padding:var(--e3);border-radius:var(--r3);background:var(--s1);box-shadow:var(--luz),var(--sombra2)}
.ab-pular .bt{min-height:var(--alvo);padding:0 var(--e4)}
.ab-dica{font-size:var(--t12);font-weight:600;color:var(--t2)}
@keyframes abLegenda{0%{opacity:0;transform:translateY(8px)}9%{opacity:1;transform:none}86%{opacity:1;transform:none}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.ab-legenda{animation-name:abLegendaSimples}@keyframes abLegendaSimples{0%{opacity:0}9%{opacity:1}86%{opacity:1}100%{opacity:0}}}
`;

function esperar(ms, f) {
  return new Promise((ok) => {
    const id = setTimeout(ok, ms);
    f.acordar = () => {
      clearTimeout(id);
      ok();
    };
  });
}

/** Encerra a abertura (acabou ou o jogador pulou): a câmera cai na da partida e a interface volta. */
export function encerrarAbertura(ui, { pulou = false } = {}) {
  if (!abertura.peek()) return;
  if (ficha) {
    ficha.cancelado = true;
    ficha.acordar?.();
    ficha = null;
  }
  abertura.value = null;
  if (typeof document !== 'undefined') delete document.documentElement.dataset.abertura;
  const cam = ui.R?.camera;
  if (pulou) cam?.irPara?.({ ...CAMERA_PARTIDA }, 900);
  else cam?.definir?.({ ...CAMERA_PARTIDA });
  ui.R?.estado?.('livre');
}

/** Roda a abertura: quatro voos de câmera de tempo marcado, uma legenda por voo. */
export async function iniciarAbertura(ui) {
  if (abertura.peek() || !ui.R?.camera) return;
  let centro = [0, 0];
  try {
    centro = (await import('../../data/arcologia-plano.js')).GLEBA_ENVELOPE.centro;
  } catch (e) {
    console.error('abertura: sem o centro da Arcologia', e);
  }
  if (abertura.peek()) return;
  const f = { cancelado: false, acordar: null };
  ficha = f;
  document.documentElement.dataset.abertura = '1';
  ui.R.estado?.('coberto');
  for (let i = 0; i < CENAS.length && !f.cancelado; i++) {
    const c = CENAS[i];
    abertura.value = { cena: i, vez: i };
    if (c.inicio) ui.R.camera.definir?.(c.inicio(centro));
    ui.R.camera.irPara?.(c.para(centro), c.ms);
    await esperar(c.ms, f);
  }
  if (!f.cancelado) encerrarAbertura(ui);
}

export function Abertura({ ui }) {
  const a = abertura.value;
  if (!a) return null;
  const c = CENAS[a.cena];
  return (
    <div class="abertura" data-hud="abertura" role="dialog" aria-label={t('u2b.abertura.aria')} onClick={(ev) => ev.stopPropagation()}>
      <div class="ab-barra ab-barra-cima" />
      <div class="ab-barra ab-barra-baixo" />
      <div class="ab-legenda" key={a.vez} style={{ '--ab-dur': `${c.ms}ms` }} aria-live="polite">
        <span class="ab-fio" />
        <h2 class="ab-titulo">{t(`u2b.abertura.${c.chave}.titulo`)}</h2>
        <p class="ab-texto">{t(`u2b.abertura.${c.chave}.texto`)}</p>
      </div>
      <div class="ab-pular">
        <Botao a="abertura.pular" rotulo={t('u2b.abertura.pular')} class="bt-sec" principal onClick={() => encerrarAbertura(ui, { pulou: true })}>
          <Glifo n="ir" tam={18} />
          <span>{t('u2b.abertura.pular')}</span>
        </Botao>
        <span class="ab-dica">{t('u2b.abertura.dica')}</span>
      </div>
    </div>
  );
}

let soltar = null;

/** Os textos, o estilo e a peça do HUD da abertura (a vitrine liga só isto para mostrar a legenda). */
export function ligarAbertura(ui) {
  registrarTextosU2b(ui.registrarTextos);
  usarEstilo('abertura', CSS_ABERTURA);
  ui.registrarHud('sobre', Abertura, { ordem: 92, nome: 'abertura' });
}

export function registrar(ui) {
  if (!temInicio(ui)) return;
  ligarAbertura(ui);
  soltar?.();
  const pulo = (ev) => {
    if (!abertura.peek()) return;
    if (ev.key === 'Escape' || ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      encerrarAbertura(ui, { pulou: true });
    } else if (!ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      // nenhuma outra tecla vale durante a abertura (nada de velocidade, ferramenta ou menu por trás)
      ev.stopImmediatePropagation();
    }
  };
  addEventListener('keydown', pulo, true);
  // a nova partida nasceu: a abertura começa quando o início já se fechou (o 'novaPartida' sai antes dele fechar)
  let pendente = false;
  const solta = ui.jogo?.on?.('novaPartida', () => {
    if (ui.loja.prefs.peek()?.abertura === false) return;
    pendente = true;
  });
  const sem = effect(() => {
    if (pendente && inicio.value === null) {
      pendente = false;
      iniciarAbertura(ui);
    }
  });
  // voltar ao menu inicial no meio da abertura a encerra sem mexer na câmera
  const solta2 = ui.jogo?.on?.('menuInicial', () => encerrarAbertura(ui));
  soltar = () => {
    removeEventListener('keydown', pulo, true);
    solta?.();
    solta2?.();
    sem();
  };
}
