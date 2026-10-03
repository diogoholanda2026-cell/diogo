// Teste de desempenho e painel (desenho da UI 8.17 e 13.5; D66 e D70; dona: U2a). O registro da tela (o corpo vem
// sob demanda: inicio/corpo/TesteDesempenho.jsx), a contagem por cima do mundo enquanto o teste voa (a interface some)
// e o painel de desempenho do F9 (qps, ms, p95, chamadas, triângulos, placa, resolução interna e memória, de R.stats
// duas vezes por segundo).
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { sobDemanda } from './corpo/sobDemanda.jsx';
import { t } from '../textos.js';
import * as fmt from '../formato.js';
import { gravarPrefs } from '../prefs.js';
import { usarEstilo } from '../inicio/estilo.js';

/** null, ou o teste em curso: { fase: 'contagem' | 'voo', resta } (resta em segundos). */
export const testeEmCurso = signal(null);

const CSS_TESTE = `
html[data-teste-desempenho] #ui .ui-raiz>*:not(.lugar-sobre),html[data-teste-desempenho] #ui .lugar-sobre>*:not(.td-contagem){visibility:hidden}
.td-contagem{position:absolute;left:50%;top:calc(var(--mC) + 8px);transform:translateX(-50%);display:flex;align-items:center;gap:var(--e3);
  padding:var(--e2) var(--e4);border-radius:var(--rp);background:var(--s1);box-shadow:var(--luz),var(--sombra2);pointer-events:auto;
  font-size:var(--t13);font-weight:650;letter-spacing:.04em}
.td-contagem b{font-size:var(--t20)}
.td-painel{position:absolute;right:calc(var(--mD) + 56px);top:calc(var(--mC) + 56px);min-width:212px;padding:var(--e2) var(--e3);
  border-radius:var(--r2);background:var(--s1);box-shadow:var(--luz),var(--sombra1);pointer-events:none;font-size:var(--t12);font-weight:600}
.td-painel div{display:flex;justify-content:space-between;gap:var(--e3);line-height:1.6}
.td-painel span{color:var(--t2)}
`;

function Contagem() {
  const c = testeEmCurso.value;
  if (!c) return null;
  return (
    <div class="td-contagem" role="status" aria-live="polite" data-a="teste.contagem">
      <span>{t(c.fase === 'contagem' ? 'u2.td.comeca' : 'u2.td.voando')}</span>
      <b class="num">{c.resta}</b>
    </div>
  );
}

/** Painel de desempenho (F9 ou Configurações, Vídeo): o que o render mede agora. */
function Painel({ ui }) {
  const ligado = !!ui.loja.prefs.value?.painel;
  const [s, setS] = useState(null);
  useEffect(() => {
    if (!ligado) return undefined;
    const ler = () => {
      const x = ui.R?.stats;
      if (!x) return;
      setS({ qps: x.qps, ms: x.ms, p95: x.p95, calls: x.calls, tris: x.tris, gpu: x.gpuMsTimer || x.gpuMs, res: x.resolucao, video: x.memoria?.videoMB ?? x.memoria?.geometriaMB, perfil: x.perfil });
    };
    ler();
    const id = setInterval(ler, 500);
    return () => clearInterval(id);
  }, [ligado]);
  if (!ligado || !s || testeEmCurso.value) return null;
  const n = (v, c = 0) => (Number.isFinite(v) ? fmt.numero(v, c) : '?');
  const linhas = [
    ['perfil', t(`u2.q.${s.perfil ?? 'media'}`)],
    ['qps', n(s.qps)],
    ['ms', `${n(s.ms, 1)} · p95 ${n(s.p95, 1)}`],
    ['placa', Number.isFinite(s.gpu) && s.gpu > 0 ? `${n(s.gpu, 1)} ms` : '?'],
    ['chamadas', n(s.calls)],
    ['triangulos', fmt.curto(s.tris ?? 0)],
    ['resolucao', s.res?.w ? `${s.res.w} x ${s.res.h}` : '?'],
    ['memoria', Number.isFinite(s.video) ? `${n(s.video)} MB` : '?'],
  ];
  return (
    <div class="td-painel" aria-hidden="true" data-painel="desempenho">
      {linhas.map(([k, v]) => (
        <div>
          <span>{t(`u2.painel.${k}`)}</span>
          <b class="num">{v}</b>
        </div>
      ))}
    </div>
  );
}

let soltar = null;

export function registrar(ui) {
  usarEstilo('teste', CSS_TESTE);
  ui.registrarTela('testeDesempenho', sobDemanda(() => import('../inicio/corpo/TesteDesempenho.jsx'), { id: 'testeDesempenho', glifo: 'grafico', titulo: 'u2.td.titulo' }));
  ui.registrarHud('sobre', Contagem, { ordem: 95, nome: 'testeContagem' });
  ui.registrarHud('sobre', Painel, { ordem: 96, nome: 'painelDesempenho' });
  // F9 liga e desliga o painel (desenho da UI 9.5)
  soltar?.();
  const tecla = (ev) => {
    if (ev.key !== 'F9' || ev.repeat) return;
    ev.preventDefault();
    const p = { ...ui.loja.prefs.peek(), painel: !ui.loja.prefs.peek()?.painel };
    if (ui.jogo && !ui.jogo.falso && typeof ui.jogo.gravarPrefs === 'function') ui.jogo.gravarPrefs({ painel: p.painel });
    else {
      ui.loja.prefs.value = p;
      gravarPrefs(p);
    }
  };
  if (typeof addEventListener === 'function') addEventListener('keydown', tecla);
  soltar = () => removeEventListener('keydown', tecla);
}
