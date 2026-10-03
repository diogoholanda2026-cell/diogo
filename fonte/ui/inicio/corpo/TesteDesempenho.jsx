// Teste de desempenho (desenho da UI 8.17; D66 e D70; dona: U2a), sob demanda: "Rodar teste (20 s)" esconde a
// interface, conta 3 segundos e voa pela cidade (a sede, a Vila, a orla e o nó de entrada) enquanto a bancada do
// render (R.bancada) mede; o resultado traz o que a PC1 e a PC2 publicaram: perfil escolhido e o motivo, resolução
// interna e a dinâmica, qps, ms, p95, pior quadro, chamadas, triângulos, tempo de placa (cerca e cronômetro) e por
// passe, aquecimento, compilações depois de pronto, memória de vídeo e as tarefas longas da página. Botões: aplicar o
// perfil sugerido, copiar o resultado e compartilhar (Web Share, para o dono mandar).
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { t } from '../../textos.js';
import * as fmt from '../../formato.js';
import { avisar } from '../../loja.js';
import { Tela, Secao } from '../../comp/Tela.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { Vazio } from '../../comp/Vazio.jsx';
import { testeEmCurso } from '../../telas/TesteDesempenho.jsx';
import { usarEstilo } from '../estilo.js';
import { CSS_CORPO } from './estilo.js';
import { mudarPrefs } from './comum.js';
import { orcamentoEscrito } from './Configuracoes.jsx';

/** Duração do voo do teste (s) e a contagem antes. */
export const VOO_S = 20;
export const CONTAGEM_S = 3;

/** Vistas do voo (graus; a cidade nova: a sede no sul, a Vila no rio, a orla a leste e o nó de entrada ao norte). */
export const VISTAS_TESTE = Object.freeze([
  { x: 200, z: 190, dist: 2400, guinada: 20, inclinacao: 30 },
  { x: -930, z: 250, dist: 900, guinada: -60, inclinacao: 24 },
  { x: 1400, z: 600, dist: 1600, guinada: 120, inclinacao: 22 },
  { x: 60, z: -700, dist: 1200, guinada: 200, inclinacao: 34 },
]);

/** Quadros que a bancada mede: os 20 s no qps de agora (de 120 a 1.200). */
export const quadrosDoTeste = (qps) => Math.max(120, Math.min(1200, Math.round((Number.isFinite(qps) && qps > 0 ? qps : 30) * VOO_S)));

const ultimo = signal(null); // { rel, longas, quando }

const n = (v, c = 0) => (Number.isFinite(v) ? fmt.numero(v, c) : '?');
const ms = (v, c = 1) => (Number.isFinite(v) && v > 0 ? `${fmt.numero(v, c)} ms` : '?');

/** Linhas do resultado ([grupo, [[rótulo, valor, falha?]]]), a mesma lista da tela e do texto copiado. */
export function linhasDoResultado({ rel, longas = 0 }) {
  const r = rel ?? {};
  const res = r.resolucao ?? {};
  const pct = res.nativa?.w ? Math.round((100 * res.w) / res.nativa.w) : null;
  const din = res.modo === 'fixa' ? t('u2.td.dinFixa') : res.modo === 'cronometro' ? t('u2.td.dinCronometro', { ms: n(res.alvoGpu, 1) }) : res.modo ? t('u2.td.dinQuadro') : '?';
  const perfil = [
    [t('u2.td.perfil'), t(`u2.q.${r.perfil ?? 'media'}`)],
    [t('u2.td.sugerido'), t(`u2.q.${r.sugerido ?? 'media'}`)],
    [t('u2.td.motivo'), r.motivo || '?'],
    [t('u2.td.interna'), res.w ? `${res.w} x ${res.h}${pct ? ` (${pct}% ${t('u2.td.daNativa')})` : ''}` : '?'],
    [t('u2.td.dinamica'), din],
    [t('u2.td.nitidez'), Number.isFinite(res.cas) ? n(res.cas, 2) : '?'],
  ];
  const quadro = [
    [t('u2.td.qps'), n(r.qps, 1)],
    [t('u2.td.msMedio'), ms(r.msMedio, 2)],
    [t('u2.td.p95'), ms(r.p95, 2)],
    [t('u2.td.pior'), ms(r.pior?.ms, 1)],
    [t('u2.td.chamadas'), `${n(r.pior?.calls ?? r.calls)}${Number.isFinite(r.pior?.callsSombra) ? ` (${t('u2.td.sombra')} ${n(r.pior.callsSombra)})` : ''}`],
    [t('u2.td.triangulos'), `${fmt.curto(r.pior?.tris ?? r.tris ?? 0)}${Number.isFinite(r.pior?.trisSombra) ? ` (${t('u2.td.sombra')} ${fmt.curto(r.pior.trisSombra)})` : ''}`],
    [t('u2.td.orcamento'), orcamentoEscrito(r.perfil) || '?'],
    [t('u2.td.longas'), n(longas), longas > 0],
  ];
  const G = r.gpuPasses ?? {};
  const passes = Object.keys(G).filter((k) => G[k] > 0).sort((a, b) => G[b] - G[a]);
  const total = passes.reduce((s, k) => s + G[k], 0);
  const placa = [
    [t('u2.td.gpuCerca'), ms(r.gpuMs, 2)],
    [t('u2.td.gpuCronometro'), ms(r.gpuMsTimer, 2)],
    ...(passes.length
      ? passes.map((k) => [t(`r1.teste.passe.${k}`), `${ms(G[k], 2)} · ${Math.round((100 * G[k]) / Math.max(1e-6, total))}%`])
      : [[t('u2.td.passes'), t('u2.td.semCronometro')]]),
  ];
  const aq = r.aquecimento;
  const depois = Array.isArray(r.compilacoes?.depois) ? r.compilacoes.depois : [];
  const M = r.memoria ?? {};
  const carga = [
    [t('u2.td.aquecimento'), aq?.estado === 'pronto' ? t('u2.td.aquecido', { n: n(aq.programas), ms: n(aq.ms) }) : aq ? t('u2.td.aquecendo') : '?'],
    [t('u2.td.depois'), depois.length ? depois.map((p) => p.nome).join(', ') : t('u2.td.nenhuma'), depois.length > 0],
    [t('u2.td.video'), Number.isFinite(M.videoMB) ? `${n(M.videoMB)} MB` : Number.isFinite(M.geometriaMB) ? `${n(M.geometriaMB)} MB` : '?'],
    [t('u2.td.programas'), n(r.compilacoes?.programas ?? r.programas?.length)],
    [t('u2.td.placa'), r.gpu || r.sonda?.gpu || '?'],
  ];
  return [
    ['perfil', perfil],
    ['quadro', quadro],
    ['placa', placa],
    ['carga', carga],
  ];
}

/** Texto para copiar e compartilhar: as linhas legíveis e o relatório inteiro em JSON (sem a lista de programas). */
export function textoDoResultado(res) {
  const partes = [`${t('u2.jogo')} · ${t('u2.td.titulo')}`, new Date(res.quando ?? Date.now()).toISOString()];
  for (const [g, linhas] of linhasDoResultado(res)) {
    partes.push('', t(`u2.td.grupo.${g}`).toUpperCase());
    for (const [k, v] of linhas) partes.push(`${k}: ${v}`);
  }
  const { programas, ...resto } = res.rel ?? {};
  partes.push('', 'JSON', JSON.stringify({ ...resto, programas: (programas ?? []).map((p) => [p.nome, p.msCompilar, p.msBloqueio, p.falhas?.join('; ') || '']), longas: res.longas ?? 0 }));
  return partes.join('\n');
}

/** Roda o teste: esconde a interface, conta, voa e mede. Devolve { rel, longas, quando }. */
export async function rodarTeste(ui) {
  const R = ui.R;
  if (!R?.bancada) throw new Error('sem bancada no render');
  const raiz = document.documentElement;
  const cam = R.camera?.estado?.() ?? null;
  let longas = 0;
  let obs = null;
  try {
    obs = new PerformanceObserver((l) => (longas += l.getEntries().length));
    obs.observe({ type: 'longtask', buffered: false });
  } catch (e) {
    obs = null;
  }
  raiz.dataset.testeDesempenho = '1';
  R.estado?.('teste');
  try {
    for (let s = CONTAGEM_S; s > 0; s--) {
      testeEmCurso.value = { fase: 'contagem', resta: s };
      await new Promise((ok) => setTimeout(ok, 1000));
    }
    const fim = performance.now() + VOO_S * 1000;
    const relogio = setInterval(() => (testeEmCurso.value = { fase: 'voo', resta: Math.max(0, Math.ceil((fim - performance.now()) / 1000)) }), 250);
    testeEmCurso.value = { fase: 'voo', resta: VOO_S };
    const medida = R.bancada({ quadros: quadrosDoTeste(R.stats?.qps) });
    const passo = (VOO_S * 1000) / VISTAS_TESTE.length;
    const voo = (async () => {
      for (const v of VISTAS_TESTE) await Promise.race([R.camera?.irPara?.(v, passo) ?? null, new Promise((ok) => setTimeout(ok, passo + 200))]);
    })();
    const [rel] = await Promise.all([medida, voo]);
    clearInterval(relogio);
    return { rel, longas, quando: Date.now() };
  } finally {
    testeEmCurso.value = null;
    delete raiz.dataset.testeDesempenho;
    obs?.disconnect();
    if (cam) R.camera?.definir?.(cam);
    R.estado?.('coberto');
  }
}

export default function TesteDesempenho({ ui, fechar }) {
  const [rodando, setRodando] = useState(false);
  const [copia, setCopia] = useState(null); // texto quando a área de transferência recusou
  const res = ultimo.value;
  useEffect(() => usarEstilo('corpo-u2', CSS_CORPO), []);
  const rodar = async () => {
    if (rodando) return;
    setRodando(true);
    setCopia(null);
    try {
      ultimo.value = await rodarTeste(ui);
    } catch (e) {
      console.error('teste de desempenho', e);
      avisar({ texto: t('u2.td.falhou'), gravidade: 'atencao', glifo: 'grafico' });
    } finally {
      setRodando(false);
    }
  };
  const copiar = async () => {
    const texto = textoDoResultado(res);
    try {
      await navigator.clipboard.writeText(texto);
      avisar({ texto: t('u2.td.copiado'), gravidade: 'info', glifo: 'copiar' });
    } catch (e) {
      setCopia(texto);
    }
  };
  const compartilhar = async () => {
    const texto = textoDoResultado(res);
    try {
      if (navigator.share) await navigator.share({ title: `${t('u2.jogo')} · ${t('u2.td.titulo')}`, text: texto });
      else setCopia(texto);
    } catch (e) {
      if (e?.name !== 'AbortError') setCopia(texto);
    }
  };
  const rel = res?.rel;
  const sugerido = rel?.sugerido && rel.sugerido !== rel.perfil ? rel.sugerido : null;
  return (
    <Tela id="testeDesempenho" glifo="grafico" titulo={t('u2.td.titulo')} aoFechar={fechar}>
      <div class="td-intro">
        <p class="ini-nota">{t('u2.td.intro', { s: VOO_S })}</p>
        <div class="ini-acoes">
          <Botao a="td.rodar" rotulo={t('u2.td.rodar', { s: VOO_S })} class="bt-pri" principal desligado={rodando} onClick={rodar}>
            <Glifo n="vel1" tam={18} />
            <span>{t(rodando ? 'u2.td.rodando' : res ? 'u2.td.deNovo' : 'u2.td.rodar', { s: VOO_S })}</span>
          </Botao>
          {res ? (
            <>
              {sugerido ? (
                <Botao a="td.aplicar" rotulo={t('u2.td.aplicar', { nome: t(`u2.q.${sugerido}`) })} class="bt-sec" onClick={() => (mudarPrefs(ui, { qualidade: sugerido }), avisar({ texto: t('u2.td.aplicado', { nome: t(`u2.q.${sugerido}`) }), gravidade: 'info', glifo: 'ajustes' }))}>
                  {t('u2.td.aplicar', { nome: t(`u2.q.${sugerido}`) })}
                </Botao>
              ) : null}
              <Botao a="td.copiar" rotulo={t('u2.td.copiar')} class="bt-sec" onClick={copiar}>
                <Glifo n="copiar" tam={18} />
                <span>{t('u2.td.copiar')}</span>
              </Botao>
              <Botao a="td.compartilhar" rotulo={t('u2.td.compartilhar')} class="bt-sec" onClick={compartilhar}>
                <Glifo n="compartilhar" tam={18} />
                <span>{t('u2.td.compartilhar')}</span>
              </Botao>
            </>
          ) : null}
        </div>
        {copia ? (
          <>
            <p class="ini-nota">{t('u2.td.selecione')}</p>
            <textarea class="td-texto" readOnly value={copia} onFocus={(ev) => ev.currentTarget.select()} />
          </>
        ) : null}
      </div>
      {res ? (
        <div class="td-cartao" data-a="td.resultado">
          {linhasDoResultado(res).map(([g, linhas]) => (
            <Secao titulo={t(`u2.td.grupo.${g}`)} class="td-grupo">
              {linhas.map(([k, v, falha]) => (
                <div class="td-par">
                  <span>{k}</span>
                  <b class={falha ? 'td-falha num' : 'num'}>{v}</b>
                </div>
              ))}
            </Secao>
          ))}
        </div>
      ) : (
        <Vazio glifo="grafico" texto={t('u2.td.vazio')} />
      )}
    </Tela>
  );
}

/** Para a vitrine: um resultado pronto sem rodar o voo. */
export function mostrarResultado(res) {
  ultimo.value = res;
}
