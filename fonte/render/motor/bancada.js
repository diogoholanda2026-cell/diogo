// Bancada e página de teste (A6, A11, 4.6 e 5.3). O domínio 'bancada' publica ctx.bancada(op): mede n quadros da
// vista atual com a resolução travada e o ms de GPU ligado (cerca por fenceSync e, quando há, a consulta de tempo) e
// devolve o relatório do contrato (perfil, sugerido, ms médio, p95, qps, chamadas, triângulos, pior de 120, ms de
// GPU, famílias, programas contados contra a guarda do Mali com o tempo de compilação, capacidades e a sonda).
// Com ?painel=1 abre a página de teste mínima da prévia sobre a cena: a sonda (limites, extensões, precisão), a
// bancada da cena, os programas acima da guarda e "Copiar resultado", que junta as cenas medidas nesta aba (aberta e
// estresse) num texto para o dono mandar. Os textos da página ficam aqui até a ui/textos/r1.js entrar no índice.
import { programasContados } from './capacidades.js';
import { sugerirPerfil } from './perfis.js';

const TXT = Object.freeze({
  titulo: 'Página de teste',
  aparelho: 'Aparelho',
  perfil: 'Perfil',
  sugerido: 'sugerido',
  resolucao: 'Resolução',
  capacidades: 'Capacidades',
  limites: 'Limites',
  bancada: 'Bancada',
  medindo: 'Medindo {n} quadros...',
  msMedio: 'ms médio',
  p95: 'p95',
  qps: 'qps',
  gpu: 'GPU (cerca)',
  gpuTimer: 'GPU (consulta)',
  chamadas: 'chamadas',
  triangulos: 'triângulos',
  sombra: 'sombra',
  programas: 'Programas',
  acima: 'acima da guarda',
  compilacao: 'compilação',
  nenhum: 'nenhum',
  medir: 'Medir de novo',
  copiar: 'Copiar resultado',
  copiado: 'Copiado',
  semCopiar: 'Selecione e copie o texto abaixo',
  cena: 'Cena {nome}',
  sim: 'sim',
  nao: 'não',
});
const t = (k, p = {}) => TXT[k].replace(/\{(\w+)\}/g, (_, x) => String(p[x] ?? ''));

const CHAVE_SESSAO = 'heldopolis.bancada';

/** Mede n quadros a partir do próximo (o laço do app desenha; o domínio lê R.stats a cada quadro). */
function criarMedicao(ctx, quadros) {
  return { n: quadros, amostras: [], tAnt: 0, ok: null, promessa: null };
}

function resumir(ctx, m, sugerido) {
  const ms = m.amostras.map((a) => a.ms).sort((a, b) => a - b);
  const media = ms.reduce((s, x) => s + x, 0) / Math.max(1, ms.length);
  const s = ctx.medidas.stats;
  const pior = { calls: 0, tris: 0, callsSombra: 0, trisSombra: 0, ms: 0 };
  for (const a of m.amostras) for (const k of Object.keys(pior)) pior[k] = Math.max(pior[k], a[k]);
  const programas = programasContados(ctx.capac.programas);
  return {
    cena: ctx.nomeCena ?? (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('cena') : null) ?? 'jogo',
    perfil: ctx.perfil.id,
    sugerido,
    pr: ctx.pr,
    msaa: s.msaa,
    alvo: s.alvo,
    msMedio: +media.toFixed(2),
    p95: +(ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.95))] ?? 0).toFixed(2),
    qps: +(1000 / Math.max(1, media)).toFixed(1),
    calls: s.calls,
    tris: s.tris,
    pior,
    gpuMs: s.gpuMs,
    gpuMsTimer: s.gpuMsTimer,
    familias: { ...s.familias },
    programas,
    capac: { clipControl: ctx.capac.clipControl, invertida: ctx.capac.invertida, multiDraw: ctx.capac.multiDraw, timer: ctx.capac.timer, limites: ctx.capac.limites },
    sonda: ctx.capac.sonda,
    gpu: ctx.gpu,
  };
}

// ------------------------------------------------------------------------------------------------ página de teste

function linha(rotulo, valor) {
  return `<div class="bl"><span>${rotulo}</span><b>${valor}</b></div>`;
}

function criarPainel(ctx, sugerido, medir) {
  if (typeof document === 'undefined') return null;
  const el = document.createElement('div');
  el.id = 'bancada-painel';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', TXT.titulo);
  el.innerHTML = `<style>
#bancada-painel{position:fixed;top:8px;right:8px;bottom:8px;width:min(420px,calc(100vw - 16px));z-index:95;overflow:auto;
  background:rgba(11,15,20,.88);color:#EEF2F6;font:13px/1.4 Inter,system-ui,sans-serif;border-radius:10px;padding:12px 14px;
  box-shadow:0 8px 30px rgba(0,0,0,.4);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
#bancada-painel h2{font-size:15px;margin:0 0 8px;letter-spacing:.02em}
#bancada-painel h3{font-size:12px;margin:12px 0 4px;color:#A7B1BD;text-transform:uppercase;letter-spacing:.08em}
#bancada-painel .bl{display:flex;justify-content:space-between;gap:12px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.06)}
#bancada-painel .bl span{color:#A7B1BD}#bancada-painel .bl b{font-weight:600;text-align:right;word-break:break-word}
#bancada-painel .bt{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
#bancada-painel button,#bancada-painel a{min-height:44px;padding:0 14px;border-radius:8px;border:1px solid rgba(255,255,255,.18);
  background:#1C2430;color:#EEF2F6;font:600 13px Inter,system-ui,sans-serif;display:inline-flex;align-items:center;text-decoration:none;cursor:pointer}
#bancada-painel button.pri{background:#2A6FDB;border-color:#2A6FDB}
#bancada-painel textarea{width:100%;height:120px;margin-top:8px;background:#0B0F14;color:#EEF2F6;border:1px solid #333;border-radius:6px;font:11px monospace}
#bancada-painel .falha{color:#FF9B8E}
</style><h2>${TXT.titulo}</h2><div id="bp-corpo"></div><div class="bt">
<button id="bp-medir">${TXT.medir}</button>
<a id="bp-aberta" href="?cena=aberta&painel=1">${t('cena', { nome: 'aberta' })}</a>
<a id="bp-estresse" href="?cena=estresse&painel=1">${t('cena', { nome: 'estresse' })}</a>
<button id="bp-copiar" class="pri">${TXT.copiar}</button></div><textarea id="bp-texto" readonly hidden></textarea>`;
  document.body.appendChild(el);
  const corpo = el.querySelector('#bp-corpo');
  const guardados = () => {
    try {
      return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || '{}');
    } catch (e) {
      return {};
    }
  };
  const guardar = (rel) => {
    try {
      const g = guardados();
      g[rel.cena] = rel;
      sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(g));
    } catch (e) {
      // aba privada: fica só a cena atual
    }
  };
  const sim = (b) => (b ? TXT.sim : TXT.nao);
  function mostrar(rel, estado) {
    const S = ctx.capac.sonda ?? {};
    const L = S.limites ?? {};
    let h = `<h3>${TXT.aparelho}</h3>${linha('GPU', S.gpu || ctx.gpu || '?')}${linha(TXT.perfil, `${ctx.perfil.nome} (${TXT.sugerido}: ${sugerido})`)}`;
    h += linha(TXT.resolucao, `${ctx.tela?.w ?? '?'} x ${ctx.tela?.h ?? '?'} · pr ${ctx.pr} · MSAA ${ctx.medidas.stats.msaa} · ${ctx.medidas.stats.alvo ?? ''}`);
    h += `<h3>${TXT.capacidades}</h3>`;
    const T = S.tem ?? {};
    h += linha('EXT_clip_control', sim(T.clipControl)) + linha('WEBGL_multi_draw', sim(T.multiDraw)) + linha('timer query', sim(T.timer));
    h += linha('KHR_parallel_shader_compile', sim(T.paralelo)) + linha('float RT', sim(T.floatRT)) + linha('ASTC / ETC2', `${sim(T.astc)} / ${sim(T.etc)}`);
    h += `<h3>${TXT.limites}</h3>`;
    h += linha('amostradores F / V', `${L.amostradoresF} / ${L.amostradoresV}`) + linha('varyings', L.varyings) + linha('uniformes F / V', `${L.uniformesF} / ${L.uniformesV}`);
    h += linha('atributos', L.atributos) + linha('textura', L.textura) + linha('MSAA', L.amostras);
    const pf = S.precisao?.fragmento;
    if (pf) h += linha('highp no fragmento', `${pf.bits} bits`);
    h += `<h3>${TXT.bancada}</h3>`;
    if (estado) h += `<div>${estado}</div>`;
    if (rel) {
      h += linha(TXT.msMedio, rel.msMedio) + linha(TXT.p95, rel.p95) + linha(TXT.qps, rel.qps);
      h += linha(TXT.gpu, rel.gpuMs ? `${rel.gpuMs} ms` : '?') + linha(TXT.gpuTimer, rel.gpuMsTimer ? `${rel.gpuMsTimer} ms` : '?');
      h += linha(TXT.chamadas, `${rel.pior.calls} (${TXT.sombra} ${rel.pior.callsSombra})`) + linha(TXT.triangulos, `${(rel.pior.tris / 1000).toFixed(0)} mil (${TXT.sombra} ${(rel.pior.trisSombra / 1000).toFixed(0)} mil)`);
      const acima = rel.programas.filter((p) => p.falhas?.length);
      const comp = rel.programas.map((p) => p.msCompilar || 0);
      const piorComp = rel.programas.reduce((a, p) => ((p.msCompilar || 0) > (a?.msCompilar || 0) ? p : a), null);
      h += `<h3>${TXT.programas}</h3>` + linha(TXT.programas, rel.programas.length);
      h += linha(TXT.compilacao, `${comp.reduce((s, x) => s + x, 0).toFixed(0)} ms${piorComp ? ` (${piorComp.nome} ${piorComp.msCompilar} ms)` : ''}`);
      h += linha(TXT.acima, acima.length ? `<span class="falha">${acima.map((p) => `${p.nome}: ${p.falhas.join(', ')}`).join('; ')}</span>` : TXT.nenhum);
    }
    corpo.innerHTML = h;
  }
  el.querySelector('#bp-medir').addEventListener('click', () => medir());
  el.querySelector('#bp-copiar').addEventListener('click', async () => {
    const g = guardados();
    const texto = JSON.stringify({ gpu: ctx.capac.sonda?.gpu ?? ctx.gpu, sonda: ctx.capac.sonda, cenas: Object.values(g).map((r) => ({ ...r, sonda: undefined, programas: r.programas.map((p) => [p.nome, p.msCompilar, p.amostradores?.f, p.varyings, p.uniformesF, p.atributos, p.falhas?.join('; ') || '']) })) });
    const b = el.querySelector('#bp-copiar');
    try {
      await navigator.clipboard.writeText(texto);
      b.textContent = TXT.copiado;
    } catch (e) {
      const ta = el.querySelector('#bp-texto');
      ta.hidden = false;
      ta.value = texto;
      ta.select();
      b.textContent = TXT.semCopiar;
    }
  });
  return { mostrar, guardar, el };
}

// ------------------------------------------------------------------------------------------------ domínio

export function registrar(api) {
  api.registrarDominio('bancada', (ctx) => {
    let med = null;
    const movel = typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '');
    const sugerido = sugerirPerfil({ gpu: ctx.gpu, movel });
    const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
    ctx.nomeCena = qs.get('cena');
    let painel = null;
    /**
     * Mede n quadros da vista atual (resolução travada, ms de GPU ligado) e devolve o relatório.
     * @returns {Promise<object>}
     */
    ctx.bancada = ({ quadros = 120 } = {}) => {
      if (med?.promessa) return med.promessa;
      med = criarMedicao(ctx, quadros);
      ctx.medirGpu = true;
      if (ctx.quadro?.resolucao) ctx.quadro.resolucao.fixa = true;
      painel?.mostrar(null, t('medindo', { n: quadros }));
      med.promessa = new Promise((ok) => (med.ok = ok));
      return med.promessa;
    };
    if (qs.get('painel') === '1') {
      painel = criarPainel(ctx, sugerido, () => ctx.bancada().then((rel) => (painel.guardar(rel), painel.mostrar(rel))));
      // espera a compilação e o primeiro cubo do céu antes de medir
      setTimeout(() => ctx.bancada().then((rel) => (painel.guardar(rel), painel.mostrar(rel))), 1500);
    }
    return {
      nome: 'bancada',
      quadro(tMs) {
        if (!med) return;
        if (med.tAnt) {
          const s = ctx.medidas.stats;
          med.amostras.push({ ms: tMs - med.tAnt, calls: s.calls, tris: s.tris, callsSombra: s.callsSombra, trisSombra: s.trisSombra });
        }
        med.tAnt = tMs;
        if (med.amostras.length >= med.n) {
          const rel = resumir(ctx, med, sugerido);
          const ok = med.ok;
          med = null;
          ctx.medirGpu = false;
          ok(rel);
        }
      },
      descartar() {
        painel?.el.remove();
        if (ctx.bancada) delete ctx.bancada;
      },
    };
  });
}
