// Campo do lote de produção (D110, pedido do dono em 08/10/2026): número digitável de 1 a 1000, atalhos 1, 10, 100 e
// 1000 e o − / + de 1 em 1. Só dígitos; a ordem só vai ao sair do campo (ou Enter), não a cada dígito; prende em 1..1000; seleciona ao focar (como o ItemManual do
// EnvioMateriais). Alvos de 44 px (D99). O tempo estimado do lote é o texto `tempo`, quando a tela já tem um.
import { useState, useEffect } from 'preact/hooks';
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { botaoDoPasso } from './Quantidade.jsx';
import { t } from '../textos.js';
import { numero } from '../formato.js';
import { REGRAS_DONO } from '../../data/economia.js';

export const LOTE_MIN = REGRAS_DONO.lote.min;
export const LOTE_MAX = REGRAS_DONO.lote.max;
export const LOTE_PADRAO = REGRAS_DONO.lote.padrao;
export const LOTES_RAPIDOS = Object.freeze([1, 10, 100, 1000]);

/** Prende n em 1..1000 como inteiro; vazio, texto ou NaN valem o mínimo. */
export function limitarLote(n, min = LOTE_MIN, max = LOTE_MAX) {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;
}

/** O que o campo mostra ao digitar: só dígitos, sem zeros à esquerda, no máximo 1000 ('' fica ''). */
export function digitarLote(texto, max = LOTE_MAX) {
  const d = String(texto ?? '').replace(/[^0-9]/g, '');
  return d === '' ? '' : String(Math.min(max, Number(d)));
}

export function LoteCampo({ valor, aoMudar, a = 'lote', k, rotulo, tempo }) {
  const v = limitarLote(valor);
  const [txt, setTxt] = useState(null); // null: mostra o valor; texto: está digitando
  useEffect(() => setTxt(null), [v]);
  const fechar = () => {
    const f = limitarLote(txt === null || txt === '' ? v : txt);
    setTxt(null);
    if (f !== v) aoMudar?.(f);
  };
  return (
    <div class="lote-campo" role="group" aria-label={rotulo}>
      <Botao a={`${a}.menos`} k={k} rotulo={t('comp.menos')} class="bt-glifo bt-sec" {...botaoDoPasso(v <= LOTE_MIN, t('comp.minimo', { n: numero(LOTE_MIN) }), () => aoMudar?.(limitarLote(v - 1)))}>
        <Glifo n="menos" />
      </Botao>
      <input
        class="fl-renomear-campo lote-campo-n num"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        data-a={`${a}.digitar`}
        data-k={k}
        value={txt === null ? String(v) : txt}
        aria-label={t('comp.lote.campo', { max: numero(LOTE_MAX) })}
        onInput={(ev) => setTxt(digitarLote(ev.currentTarget.value))}
        onBlur={fechar}
        onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur?.()}
        onFocus={(ev) => ev.currentTarget.select?.()}
      />
      <Botao a={`${a}.mais`} k={k} rotulo={t('comp.mais')} class="bt-glifo bt-sec" {...botaoDoPasso(v >= LOTE_MAX, t('comp.maximo', { n: numero(LOTE_MAX) }), () => aoMudar?.(limitarLote(v + 1)))}>
        <Glifo n="mais" />
      </Botao>
      <span class="lote-campo-rapidos">
        {LOTES_RAPIDOS.map((n) => (
          <Botao a={`${a}.rapido`} k={k === undefined ? n : `${k}-${n}`} rotulo={t('comp.lote.rapido', { n: numero(n) })} ativo={v === n} class="bt-sec lote-campo-bt" onClick={() => aoMudar?.(n)}>
            <span class="num">{numero(n)}</span>
          </Botao>
        ))}
      </span>
      {tempo ? <span class="fl-nota num">{tempo}</span> : null}
    </div>
  );
}
