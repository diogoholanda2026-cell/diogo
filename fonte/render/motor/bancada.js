// Bancada e página de teste (A6, A11, 4.6, 5.3 e D66). O domínio 'bancada' publica ctx.bancada(op): mede n quadros
// da vista atual com a resolução travada e o ms de GPU ligado (cerca por fenceSync e, quando há, o cronômetro da
// placa, também por passe) e devolve o relatório do contrato (perfil, sugerido, ms médio, p95, qps, chamadas,
// triângulos, pior de 120, ms de GPU, famílias, programas contados contra a guarda do Mali com o tempo de compilação,
// capacidades e a sonda) com o que a PC1 acrescentou para a medida no PC do dono: o perfil escolhido e o motivo, a
// resolução interna em pixels, o tempo de placa por passe (sombra, preparo, céu, terreno, água, prédios, vias,
// Arcologia, pós...), a memória de vídeo estimada, o aquecimento e as compilações depois de pronto.
// Com ?painel=1 abre a página de teste sobre a cena: espera o aquecimento, mede (120 quadros; ?quadros= troca), mostra
// tudo e "Copiar resultado" junta as cenas medidas nesta aba (aberta e estresse) num texto para o dono mandar. Os textos ficam em
// ui/textos/r1.js (chaves r1.teste.*); as chaves novas da PC1 têm o texto aqui até o integrador levá-las para lá.
import { programasContados, compilacoesDepois } from './capacidades.js';
import { t as texto, temTexto } from '../../ui/textos.js';
import { numero } from '../../ui/formato.js';
import { escolherPerfil, PERFIS, orcamentoDoPerfil } from './perfis.js';
import { PASSES_GPU } from './medidas.js';

/** Textos novos da PC1 (vão para ui/textos/r1.js; enquanto não estiverem lá, valem estes). */
export const TEXTOS_PC1 = Object.freeze({
  'r1.teste.motivo': 'motivo',
  'r1.teste.interna': 'resolução interna',
  'r1.teste.daNativa': '{pct}% da nativa ({w} x {h})',
  'r1.teste.dinamica': 'resolução dinâmica',
  'r1.teste.dinCronometro': 'pelo cronômetro da placa, alvo de {ms} ms',
  'r1.teste.dinQuadro': 'pelo tempo de quadro',
  'r1.teste.dinFixa': 'travada',
  'r1.teste.teto': 'alvo {alvo} qps, piso {piso}, teto {teto}',
  'r1.teste.passes': 'Tempo de placa por passe',
  'r1.teste.passesNota': 'ms por quadro, média de {n} quadros',
  'r1.teste.semCronometro': 'sem o cronômetro da placa neste aparelho',
  'r1.teste.total': 'total',
  'r1.teste.passe.sombra': 'sombra própria',
  'r1.teste.passe.preparo': 'sombra de longe, HAO e luz da rua',
  'r1.teste.passe.ceu': 'céu e luz do ambiente',
  'r1.teste.passe.terreno': 'terreno',
  'r1.teste.passe.agua': 'água',
  'r1.teste.passe.predios': 'prédios',
  'r1.teste.passe.colocaveis': 'serviços e Holding',
  'r1.teste.passe.arvores': 'árvores',
  'r1.teste.passe.vias': 'vias',
  'r1.teste.passe.vida': 'carros e gente',
  'r1.teste.passe.arcologia': 'Arcologia',
  'r1.teste.passe.resto': 'resto da cena',
  'r1.teste.passe.pos': 'pós e composição',
  'r1.teste.passe.outros': 'outros',
  'r1.teste.memoria': 'Memória de vídeo (estimada)',
  'r1.teste.memTexturas': 'texturas',
  'r1.teste.memAlvos': 'alvos de desenho',
  'r1.teste.memBuffers': 'geometria nos buffers',
  'r1.teste.memTela': 'tela',
  'r1.teste.memCena': 'geometria da cena',
  'r1.teste.memTeto': 'teto do perfil',
  'r1.teste.aquecimento': 'aquecimento',
  'r1.teste.aquecendo': 'aquecendo os programas...',
  'r1.teste.aquecido': '{n} programas em {ms} ms',
  'r1.teste.depois': 'compilações depois de pronto',
  'r1.teste.bloqueio': 'bloqueio',
});

const CHAVES = [
  'titulo', 'aparelho', 'perfil', 'sugerido', 'resolucao', 'capacidades', 'limites', 'bancada', 'medindo', 'msMedio',
  'p95', 'qps', 'gpu', 'gpuTimer', 'chamadas', 'triangulos', 'sombra', 'programas', 'acima', 'compilacao', 'nenhum',
  'medir', 'copiar', 'copiado', 'semCopiar', 'cena', 'sim', 'nao',
  ...Object.keys(TEXTOS_PC1).map((k) => k.slice('r1.teste.'.length)),
];
const TXT = Object.freeze(Object.fromEntries(CHAVES.map((k) => {
  const c = `r1.teste.${k}`;
  return [k, temTexto(c) ? texto(c) : TEXTOS_PC1[c] ?? texto(c)];
})));
const t = (k, p = {}) => TXT[k].replace(/\{(\w+)\}/g, (_, x) => String(p[x] ?? ''));

const CHAVE_SESSAO = 'heldopolis.bancada';
/** A página mede quando o aquecimento termina (ou aos 15 s). */
const ESPERA_MAX_MS = 15000;

const movelAgora = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '');

/** Mede n quadros a partir do próximo (o laço do app desenha; o domínio lê R.stats a cada quadro). */
function criarMedicao(quadros) {
  return { n: quadros, amostras: [], tAnt: 0, ok: null, promessa: null, fixaAntes: null };
}

/** Resolução interna em pixels e a escala da nativa (R.stats.resolucao, ou a conta pela tela nos testes). */
function resolucaoDe(ctx) {
  const r = ctx.medidas?.stats?.resolucao;
  if (r) return { ...r };
  const pr = ctx.pr ?? 1;
  const w = Math.round((ctx.tela?.w ?? 0) * pr);
  const h = Math.round((ctx.tela?.h ?? 0) * pr);
  return { w, h, pr, escala: 1, nativa: { w, h }, modo: ctx.quadro?.resolucao?.fixa ? 'fixa' : 'quadro' };
}

function resumir(ctx, m, escolha) {
  const ms = m.amostras.map((a) => a.ms).sort((a, b) => a - b);
  const media = ms.reduce((s, x) => s + x, 0) / Math.max(1, ms.length);
  const s = ctx.medidas.stats;
  const pior = { calls: 0, tris: 0, callsSombra: 0, trisSombra: 0, ms: 0 };
  for (const a of m.amostras) for (const k of Object.keys(pior)) pior[k] = Math.max(pior[k], a[k]);
  const programas = programasContados(ctx.capac.programas);
  const vigia = ctx.capac.programas;
  return {
    cena: ctx.nomeCena ?? (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('cena') : null) ?? 'jogo',
    perfil: ctx.perfil.id,
    sugerido: escolha.id,
    motivo: escolha.motivo,
    pr: ctx.pr,
    msaa: s.msaa,
    alvo: s.alvo,
    resolucao: resolucaoDe(ctx),
    msMedio: +media.toFixed(2),
    p95: +(ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.95))] ?? 0).toFixed(2),
    qps: +(1000 / Math.max(1, media)).toFixed(1),
    calls: s.calls,
    tris: s.tris,
    pior,
    gpuMs: s.gpuMs,
    gpuMsTimer: s.gpuMsTimer,
    gpuPasses: { ...(s.gpuPasses ?? {}) },
    gpuQuadros: s.gpuQuadros ?? 0,
    familias: { ...s.familias },
    memoria: { ...(s.memoria ?? {}) },
    aquecimento: s.aquecimento ?? null,
    compilacoes: { programas: vigia?.lista?.length ?? programas.length, depois: compilacoesDepois(vigia) },
    programas,
    capac: { clipControl: ctx.capac.clipControl, invertida: ctx.capac.invertida, multiDraw: ctx.capac.multiDraw, timer: ctx.capac.timer, paralelo: ctx.capac.paralelo, limites: ctx.capac.limites },
    sonda: ctx.capac.sonda,
    gpu: ctx.gpu,
  };
}

// ------------------------------------------------------------------------------------------------ página de teste

function linha(rotulo, valor) {
  return `<div class="bl"><span>${rotulo}</span><b>${valor}</b></div>`;
}

const mb = (x) => (Number.isFinite(x) ? `${numero(x)} MB` : '?');
/** Milissegundos em pt-BR ('15,5 ms'). */
const emMs = (x, casas = 1) => (Number.isFinite(x) ? `${numero(x, casas)} ms` : '?');

/**
 * Liga da página de teste com os parâmetros que valem manter: o perfil desta página (o pedido ou o da escolha
 * automática, porque a cena estresse fixa o Média quando não há ?q=: as duas cenas medem no mesmo perfil) e ?quadros=.
 */
export function ligacao(cena, perfil = null, busca = typeof location !== 'undefined' ? location.search : '') {
  const qs = new URLSearchParams(busca || '');
  const q = new URLSearchParams({ cena, painel: '1' });
  const pq = qs.get('q') || perfil;
  if (pq) q.set('q', pq);
  if (qs.get('quadros')) q.set('quadros', qs.get('quadros'));
  return `?${q}`;
}

function criarPainel(ctx, escolha, medir) {
  if (typeof document === 'undefined') return null;
  const el = document.createElement('div');
  el.id = 'bancada-painel';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', TXT.titulo);
  el.innerHTML = `<style>
#bancada-painel{position:fixed;top:8px;right:8px;bottom:8px;width:min(440px,calc(100vw - 16px));z-index:95;overflow:auto;
  background:rgba(11,15,20,.88);color:#EEF2F6;font:13px/1.4 Inter,system-ui,sans-serif;border-radius:10px;padding:12px 14px;
  box-shadow:0 8px 30px rgba(0,0,0,.4);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
#bancada-painel h2{font-size:15px;margin:0 0 8px;letter-spacing:.02em}
#bancada-painel h3{font-size:12px;margin:12px 0 4px;color:#A7B1BD;text-transform:uppercase;letter-spacing:.08em}
#bancada-painel .bl{display:flex;justify-content:space-between;gap:12px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.06)}
#bancada-painel .bl span{color:#A7B1BD}#bancada-painel .bl b{font-weight:600;text-align:right;word-break:break-word}
#bancada-painel .nota{color:#A7B1BD;font-size:12px;margin:2px 0}
#bancada-painel .bt{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
#bancada-painel button,#bancada-painel a{min-height:44px;padding:0 14px;border-radius:8px;border:1px solid rgba(255,255,255,.18);
  background:#1C2430;color:#EEF2F6;font:600 13px Inter,system-ui,sans-serif;display:inline-flex;align-items:center;text-decoration:none;cursor:pointer}
#bancada-painel button.pri{background:#2A6FDB;border-color:#2A6FDB}
#bancada-painel textarea{width:100%;height:120px;margin-top:8px;background:#0B0F14;color:#EEF2F6;border:1px solid #333;border-radius:6px;font:11px monospace}
#bancada-painel .falha{color:#FF9B8E}
</style><h2>${TXT.titulo}</h2><div id="bp-vivo"></div><div id="bp-corpo"></div><div class="bt">
<button id="bp-medir">${TXT.medir}</button>
<a id="bp-aberta" href="${ligacao('aberta', ctx.perfil?.id)}">${t('cena', { nome: 'aberta' })}</a>
<a id="bp-estresse" href="${ligacao('estresse', ctx.perfil?.id)}">${t('cena', { nome: 'estresse' })}</a>
<button id="bp-copiar" class="pri">${TXT.copiar}</button></div><textarea id="bp-texto" readonly hidden></textarea>`;
  document.body.appendChild(el);
  const corpo = el.querySelector('#bp-corpo');
  const vivo = el.querySelector('#bp-vivo');
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
  const nomePerfil = (id) => PERFIS[id]?.nome ?? id;

  // o que muda sozinho: perfil, resolução, aquecimento e as compilações depois de pronto
  function mostrarVivo() {
    const s = ctx.medidas?.stats ?? {};
    const P = ctx.perfil;
    let h = `<h3>${TXT.perfil}</h3>${linha(TXT.perfil, `${P.nome} (${TXT.sugerido}: ${nomePerfil(escolha.id)})`)}`;
    h += linha(TXT.motivo, escolha.motivo);
    if (P.qps) h += linha('qps', t('teto', { alvo: P.qps, piso: P.qpsPiso ?? '?', teto: P.tetoQps ?? '?' }));
    const r = resolucaoDe(ctx);
    const pct = r.nativa?.w ? Math.round((100 * r.w) / r.nativa.w) : 100;
    h += linha(TXT.interna, `${r.w} x ${r.h} px · ${t('daNativa', { pct, w: r.nativa?.w ?? '?', h: r.nativa?.h ?? '?' })}`);
    h += linha(TXT.resolucao, `pr ${numero(r.pr, 2)} · MSAA ${s.msaa ?? '?'} · ${s.alvo ?? ''}${r.cas ? ` · CAS ${numero(r.cas, 2)}` : ''}`);
    const din = r.modo === 'fixa' ? TXT.dinFixa : r.modo === 'cronometro' ? t('dinCronometro', { ms: numero(r.alvoGpu, 1) }) : TXT.dinQuadro;
    h += linha(TXT.dinamica, din);
    const aq = s.aquecimento;
    h += linha(TXT.aquecimento, !aq || aq.estado !== 'pronto' ? TXT.aquecendo : t('aquecido', { n: aq.programas, ms: numero(aq.ms) }));
    const depois = compilacoesDepois(ctx.capac.programas);
    const nomes = depois.map((p) => `${p.nome}${p.msBloqueio != null ? ` (${TXT.bloqueio} ${emMs(p.msBloqueio)})` : ''}`).join('; ');
    h += linha(`${TXT.depois}: ${depois.length}`, depois.length ? `<span class="falha">${nomes}</span>` : TXT.nenhum);
    vivo.innerHTML = h;
  }

  function mostrar(rel, estado) {
    const S = ctx.capac.sonda ?? {};
    const L = S.limites ?? {};
    let h = `<h3>${TXT.aparelho}</h3>${linha('GPU', S.gpu || ctx.gpu || '?')}`;
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
      h += linha(TXT.msMedio, numero(rel.msMedio, 2)) + linha(TXT.p95, numero(rel.p95, 2)) + linha(TXT.qps, numero(rel.qps, 1));
      h += linha(TXT.gpu, rel.gpuMs ? emMs(rel.gpuMs, 2) : '?') + linha(TXT.gpuTimer, rel.gpuMsTimer ? emMs(rel.gpuMsTimer, 2) : '?');
      h += linha(TXT.chamadas, `${rel.pior.calls} (${TXT.sombra} ${rel.pior.callsSombra})`) + linha(TXT.triangulos, `${numero(rel.pior.tris / 1000)} mil (${TXT.sombra} ${numero(rel.pior.trisSombra / 1000)} mil)`);
      // o que pesa na placa
      h += `<h3>${TXT.passes}</h3>`;
      const G = rel.gpuPasses ?? {};
      const passes = PASSES_GPU.filter((k) => G[k] > 0);
      if (!passes.length) h += `<div class="nota">${TXT.semCronometro}</div>`;
      else {
        h += `<div class="nota">${t('passesNota', { n: rel.gpuQuadros })}</div>`;
        const total = passes.reduce((a, k) => a + G[k], 0);
        for (const k of [...passes].sort((a, b) => G[b] - G[a])) h += linha(TXT[`passe.${k}`] ?? k, `${emMs(G[k], 2)} · ${Math.round((100 * G[k]) / Math.max(1e-6, total))}%`);
        h += linha(TXT.total, emMs(total, 2));
      }
      // memória de vídeo
      const M = rel.memoria ?? {};
      const teto = orcamentoDoPerfil(rel.perfil)?.videoMB;
      h += `<h3>${TXT.memoria}</h3>`;
      h += linha(TXT.total, `${mb(M.videoMB)}${teto ? ` · ${TXT.memTeto} ${mb(teto)}` : ''}`);
      h += linha(TXT.memTexturas, mb(M.texturasGpuMB)) + linha(TXT.memAlvos, mb(M.alvosMB)) + linha(TXT.memBuffers, mb(M.buffersMB)) + linha(TXT.memTela, mb(M.telaMB));
      h += linha(TXT.memCena, mb(M.geometriaMB));
      // programas
      const acima = rel.programas.filter((p) => p.falhas?.length);
      const comp = rel.programas.map((p) => p.msCompilar || 0);
      const piorComp = rel.programas.reduce((a, p) => ((p.msCompilar || 0) > (a?.msCompilar || 0) ? p : a), null);
      h += `<h3>${TXT.programas}</h3>` + linha(TXT.programas, rel.programas.length);
      h += linha(TXT.compilacao, `${emMs(comp.reduce((s, x) => s + x, 0), 0)}${piorComp ? ` (${piorComp.nome} ${emMs(piorComp.msCompilar)})` : ''}`);
      const bloq = rel.programas.reduce((a, p) => a + (p.msBloqueio || 0), 0);
      h += linha(TXT.bloqueio, emMs(bloq, 0));
      h += linha(TXT.acima, acima.length ? `<span class="falha">${acima.map((p) => `${p.nome}: ${p.falhas.join(', ')}`).join('; ')}</span>` : TXT.nenhum);
    }
    corpo.innerHTML = h;
    mostrarVivo();
  }
  el.querySelector('#bp-medir').addEventListener('click', () => medir());
  el.querySelector('#bp-copiar').addEventListener('click', async () => {
    const g = guardados();
    const texto = JSON.stringify({
      gpu: ctx.capac.sonda?.gpu ?? ctx.gpu,
      escolha,
      sonda: ctx.capac.sonda,
      compilacoesDepois: compilacoesDepois(ctx.capac.programas),
      cenas: Object.values(g).map((r) => ({ ...r, sonda: undefined, programas: r.programas.map((p) => [p.nome, p.msCompilar, p.msBloqueio, p.amostradores?.f, p.varyings, p.uniformesF, p.atributos, p.falhas?.join('; ') || '']) })),
    });
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
  mostrarVivo();
  return { mostrar, mostrarVivo, guardar, el };
}

// ------------------------------------------------------------------------------------------------ domínio

export function registrar(api) {
  api.registrarDominio('bancada', (ctx) => {
    let med = null;
    const escolha = escolherPerfil({ gpu: ctx.gpu, movel: movelAgora() });
    const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
    ctx.nomeCena = qs.get('cena');
    let painel = null;
    let espera = 0;
    let relogio = 0;
    /**
     * Mede n quadros da vista atual (resolução travada, ms de GPU ligado) e devolve o relatório.
     * @returns {Promise<object>}
     */
    ctx.bancada = ({ quadros = 120 } = {}) => {
      if (med?.promessa) return med.promessa;
      med = criarMedicao(quadros);
      ctx.medirGpu = true;
      // a resolução fica travada só durante a medida (depois volta a dinâmica, ou a fixa do ?pr=); guarda só a trava
      // da consulta (travada): a preferência do jogador (dinamica) não muda com a medida
      const res = ctx.quadro?.resolucao;
      if (res) {
        med.fixaAntes = res.travada ?? res.fixa;
        res.fixa = true;
      }
      painel?.mostrar(null, t('medindo', { n: quadros }));
      med.promessa = new Promise((ok) => (med.ok = ok));
      return med.promessa;
    };
    if (qs.get('painel') === '1') {
      // ?quadros= troca os 120 quadros da medida (uma olhada rápida)
      const quadros = Math.max(2, Math.min(1200, Number(qs.get('quadros')) || 120));
      const medir = () => ctx.bancada({ quadros }).then((rel) => (painel.guardar(rel), painel.mostrar(rel)));
      painel = criarPainel(ctx, escolha, medir);
      // mede depois do aquecimento (os programas prontos; o pior quadro sem a compilação da carga), ou aos 15 s
      const t0 = Date.now();
      const esperar = () => {
        if (ctx.quadro?.aquecimento?.pronto || Date.now() - t0 > ESPERA_MAX_MS) medir();
        else espera = setTimeout(esperar, 250);
      };
      espera = setTimeout(esperar, 1500);
      relogio = setInterval(() => painel?.mostrarVivo(), 1000);
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
          const rel = resumir(ctx, med, escolha);
          const { ok, fixaAntes } = med;
          med = null;
          ctx.medirGpu = false;
          if (ctx.quadro?.resolucao && fixaAntes !== null) ctx.quadro.resolucao.fixa = fixaAntes;
          ok(rel);
        }
      },
      descartar() {
        clearTimeout(espera);
        clearInterval(relogio);
        if (med && ctx.quadro?.resolucao && med.fixaAntes !== null) ctx.quadro.resolucao.fixa = med.fixaAntes;
        ctx.medirGpu = false;
        med = null;
        painel?.el.remove();
        if (ctx.bancada) delete ctx.bancada;
      },
    };
  });
}
