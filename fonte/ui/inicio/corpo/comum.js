// Peças comuns das telas do sistema (dona: U2a), sob demanda: os textos das telas (u2-telas.js), o rótulo dos espaços
// de save, "há quanto tempo" sem a palavra proibida pela D42, o resumo de um save para o menu, as preferências (gravar
// e aplicar no app, no som, na entrada e no render) e a entrega do arquivo exportado.
import { useEffect, useState } from 'preact/hooks';
import { t, registrarTextos } from '../../textos.js';
import { registrar as registrarTextosTelas } from '../../textos/u2-telas.js';
import * as fmt from '../../formato.js';
import { gravarPrefs, aplicarPrefs } from '../../prefs.js';
import { definirPrefs } from '../../../som/som.js';
import { aplicarNoRender } from '../../telas/Configuracoes.jsx';

// os textos das telas chegam com elas (o pacote principal leva só os da carga, ui/textos/u2.js)
registrarTextosTelas(registrarTextos);

/** 'Automático 2', 'Espaço 3' ou 'Cópia guardada'. */
export function rotuloSlot(slot = '') {
  const m = /^(auto|manual)(\d+)$/.exec(slot);
  if (!m) return t('u2.slot.quarentena');
  return t(m[1] === 'auto' ? 'u2.slot.auto' : 'u2.slot.manual', { n: m[2] });
}

/**
 * Há quanto tempo (relógio real): 'agora há pouco', 'há 12 min', 'há 3 h' e, passado um ciclo de 24 h, a data
 * ('em 28/09/2026'), nunca a palavra da D42.
 */
export function haQuanto(data, agora = Date.now()) {
  if (!Number.isFinite(data) || data <= 0) return '';
  const s = Math.max(0, (agora - data) / 1000);
  if (s < 90) return t('u2.tempo.agora');
  if (s < 3600) return t('u2.tempo.min', { n: Math.round(s / 60) });
  if (s < 86400) return t('u2.tempo.h', { n: Math.round(s / 3600) });
  const d = new Date(data);
  const dd = (x) => String(x).padStart(2, '0');
  return t('u2.tempo.data', { data: `${dd(d.getDate())}/${dd(d.getMonth() + 1)}/${d.getFullYear()}` });
}

/** Data do calendário do save ('mar. 2021', D67). */
export const dataDoSave = (s) => fmt.dataCalendario({ mes: s?.mes ?? 1, ano: s?.ano ?? 1 });

/** '12.480 moradores · mar. 2021'. */
export const subSave = (s) => `${t('u2.moradores', { n: fmt.populacao(s?.populacao ?? 0) })} · ${dataDoSave(s)}`;

/** 'Holding Held · 12.480 moradores · mar. 2021'. */
export const resumoSave = (s) => `${s?.nome || t('u2.holdingSemNome')} · ${subSave(s)}`;

/** Endereço de uma capa (Blob) enquanto o componente vive. */
export function useCapa(blob) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!(typeof Blob !== 'undefined' && blob instanceof Blob)) return setUrl(null);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

const CHAVES_SOM = ['som', 'musica', 'ambiente', 'efeitos', 'interface', 'silenciarFundo', 'vibrar'];

/**
 * Muda preferências: pelo app quando ele existe (grava, aplica na página, troca a qualidade e o "Sempre dia" e põe
 * na loja); senão direto (vitrine). Depois o som, a entrada e o render.
 */
export function mudarPrefs(ui, parcial) {
  const jogo = ui.jogo;
  if (jogo && !jogo.falso && typeof jogo.gravarPrefs === 'function') jogo.gravarPrefs(parcial);
  else {
    const p = { ...ui.loja.prefs.peek(), ...parcial };
    ui.loja.prefs.value = p;
    gravarPrefs(p);
    aplicarPrefs(p);
    if ('qualidade' in parcial) ui.R?.qualidade?.(parcial.qualidade);
    if ('sempreDia' in parcial) ui.R?.sempreDia?.(!!parcial.sempreDia);
  }
  if (CHAVES_SOM.some((k) => k in parcial)) definirPrefs(ui.loja.prefs.peek());
  aplicarNoRender(ui.R, { ...ui.loja.prefs.peek(), ...parcial });
}

/** Baixa um arquivo (exportar) ou compartilha no Android quando o navegador deixa. */
export async function entregarArquivo(bytes, nome, { compartilhar = false } = {}) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: 'application/octet-stream' });
  if (compartilhar && typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const arq = new File([blob], nome, { type: 'application/octet-stream' });
      if (navigator.canShare({ files: [arq] })) {
        await navigator.share({ files: [arq], title: nome });
        return true;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return false;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1500);
  return true;
}

/** Exporta pelo app e entrega o arquivo (baixa no PC; no toque, compartilha quando o navegador deixa). */
export async function exportarSave(jogo, slot = null, { compartilhar = false } = {}) {
  let r = await jogo?.exportar?.(slot);
  if (typeof Blob !== 'undefined' && r instanceof Blob) r = { ok: true, bytes: r, nome: 'heldopolis.held' }; // jogo falso da vitrine
  if (r?.ok) await entregarArquivo(r.bytes, r.nome, { compartilhar });
  return r ?? { ok: false, codigo: 'nada' };
}
