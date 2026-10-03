// Entrada do jogo (desenho da UI 8.19; D66 e D70; dona: U2a): depois da carga (as fases ficam no index.html e no
// main.js), a mesma tela com "Clique para entrar" quando o ponteiro é mouse e "Toque para entrar" no toque: o gesto
// libera o som e, no toque, a tela cheia em paisagem. Depois, o menu inicial com a capa do último save, que vem sob
// demanda (corpo/Inicio.jsx) junto com Nova partida, Carregar, Configurações e Créditos.
import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { inicio, capaFundo, irPara, ehToque, teclas } from './estado.js';
import { t } from '../textos.js';
import { liberar } from '../../som/som.js';
import { tocar } from '../../som/interface.js';

let Corpo = null;
let promessa = null;
/** Busca o corpo do início (o pedaço do pacote com o menu, a nova partida, o carregar e as configurações). */
export const buscarCorpo = () =>
  (promessa ??= import('./corpo/Inicio.jsx').then(
    (m) => (Corpo = m.default),
    (e) => {
      promessa = null;
      throw e;
    },
  ));

/** Marca da Holding (o H no anel champanhe da carga). */
export function Marca({ class: classe = 'inicio-marca' }) {
  return (
    <svg class={classe} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3" />
      <path fill="currentColor" d="M34 30h7v17h18V30h7v40h-7V53H41v17h-7z" />
    </svg>
  );
}

/** Tela cheia e paisagem no toque (o navegador pode recusar: o jogo segue). */
export function telaCheia() {
  try {
    const el = document.documentElement;
    const p = el.requestFullscreen?.({ navigationUI: 'hide' });
    p?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  } catch (e) {
    // sem tela cheia neste navegador
  }
}

/** O gesto de entrada: som, tela cheia no toque, armazenamento persistente e o menu. */
export function entrar(ui) {
  liberar();
  tocar('confirmar');
  if (ehToque()) telaCheia();
  ui.jogo?.persistir?.();
  irPara('menu');
}

function Entrada({ ui }) {
  const toque = ehToque();
  useLayoutEffect(() => {
    teclas.atual = (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return false;
      ev.preventDefault();
      entrar(ui);
      return true;
    };
    const fn = teclas.atual;
    return () => {
      if (teclas.atual === fn) teclas.atual = null;
    };
  }, []);
  return (
    <div class="inicio inicio-entrada" role="dialog" aria-label={t('u2.jogo')} data-inicio="entrada" tabIndex={-1} onClick={() => entrar(ui)}>
      <Marca />
      <h1 class="inicio-titulo">{t('u2.jogo').toUpperCase()}</h1>
      <p class="inicio-cidade">{t('u2.cidade')}</p>
      <button type="button" class="bt inicio-entrar" data-a="inicio.entrar" autofocus>
        {t(toque ? 'u2.entrar.toque' : 'u2.entrar.clique')}
      </button>
      <p class="inicio-aviso">{t(toque ? 'u2.entrar.notaToque' : 'u2.entrar.notaMouse')}</p>
    </div>
  );
}

/** O início inteiro: a entrada aqui; as outras etapas no corpo sob demanda, sobre a capa. */
export function Inicio({ ui }) {
  const estado = inicio.value;
  const [, setVez] = useState(0);
  const [erro, setErro] = useState(false);
  const etapa = estado?.etapa ?? null;
  useEffect(() => {
    if (etapa && etapa !== 'entrada' && !Corpo) buscarCorpo().then(() => setVez((v) => v + 1), () => setErro(true));
  }, [etapa]);
  // com o início aberto o HUD do jogo some (nada por trás é tocável nem entra no Tab)
  useEffect(() => {
    const raiz = document.documentElement;
    if (etapa) raiz.dataset.inicio = '1';
    else delete raiz.dataset.inicio;
  }, [!!etapa]);
  if (!estado) return null;
  if (etapa === 'entrada') return <Entrada ui={ui} />;
  const capa = capaFundo.value;
  return (
    <div class="inicio" data-inicio={etapa} tabIndex={-1}>
      {capa ? <img class="inicio-capa" src={capa} alt="" /> : null}
      <div class="inicio-veu" />
      {Corpo ? <Corpo ui={ui} etapa={etapa} estado={estado} /> : <p class="inicio-espera" role="status">{t(erro ? 'tela.erro' : 'tela.carregando')}</p>}
    </div>
  );
}
