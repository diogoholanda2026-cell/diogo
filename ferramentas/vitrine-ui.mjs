// Vitrine da interface sem WebGL (PROJETO 3.2 e A7; ui.md 13.2): monta a interface de verdade (fonte/ui/index.jsx)
// sobre o render falso (vitrine/render-falso.js) e a simulação falsa (vitrine/sim-falsa.js) ou real, abre cada cena,
// captura nos tamanhos pedidos e mede. Cerca de 1 s por captura.
//   node ferramentas/vitrine-ui.mjs <pasta> <cenas | todas> [986x443,915x412,1376x768,1920x1080] [dia | noite]
//   opções: --ui <arquivo> (outra raiz da interface), --cenas-pasta <dir>, --tema <dir> (CSS), --fundo <png>
//   (sem --fundo, usa ferramentas/vitrine/fundos/<dia|noite>.png se existir; senão o mundo de caixas do render falso)
// Cenas: cada parcela registra as suas em ferramentas/vitrine/cenas/<parcela>.js:
//   export function registrar(registrarCenaVitrine) {
//     registrarCenaVitrine('repouso', {
//       sim: 'falsa',            // ou 'real' (criarSimulacao de fonte/sim/estado.js); padrão 'falsa'
//       sintetica: true,         // com sim: 'real', gera a cidade sintética (ferramentas/cidade-sintetica.mjs)
//       cenario: 'meio',         // cenário da simulação falsa: 'inicio' ou 'meio'
//       repouso: true,           // mede a área do HUD, a faixa livre e os nós do DOM (metas de repouso)
//       espera: 300,             // ms antes da captura
//       tamanhos: ['986x443'],   // opcional: só nestes tamanhos
//       async preparar({ sim, R, ui, jogo, raiz, acionar, clicar, esperar, quadro }) { ... },
//       conferir(ctx) { return []; },   // opcional: falhas próprias da cena (texto)
//     });
//   }
// A vitrine já traz 'carga' (a tela de carga do index.html) e 'inicial' (a interface sobre a simulação falsa).
// Convenções que a medida usa: [data-hud] marca cada grupo do HUD (área, sobreposição e faixa livre);
// [data-principal] marca as ações principais (zona do polegar no celular); [data-a] marca o que age.
// Medidas por cena (ui.json): erros de página, alvos abaixo de 44 px no toque e 32 no PC, textos abaixo de 12 px,
// contraste sobre o pior fundo (vidro sobre branco: 4,5:1 abaixo de 17 px e 3:1 acima), transbordo (texto cortado
// sem reticências ou fora da tela), sobreposição entre grupos do HUD, área do HUD (até 15,5% em 986 x 443 e 16,5% em
// 915 x 412), faixa livre (340 e 310 px), travessão, chave faltando ('??'), unidades (D42) e nós do DOM (600).
// Código 1 se alguma cena falhar. ANIMAR=1 deixa as animações de CSS ligadas.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ordenarCss } from './montar.mjs';
import { servir, abrirChromium } from './testar.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TAMANHOS = '986x443,915x412,1376x768,1920x1080';
const METAS = { '986x443': { hud: 15.5, faixa: 340 }, '915x412': { hud: 16.5, faixa: 310 } };
const SEM_ANIMACAO = '*,*::before,*::after{animation:none!important;transition:none!important}';

function lerArgs(argv) {
  const o = { pasta: null, cenas: 'todas', tamanhos: TAMANHOS, tema: 'dia', ui: 'fonte/ui/index.jsx', cenasPasta: 'ferramentas/vitrine/cenas', css: 'fonte/ui/tema', fundo: null };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--ui') o.ui = v();
    else if (k === '--cenas-pasta') o.cenasPasta = v();
    else if (k === '--tema') o.css = v();
    else if (k === '--fundo') o.fundo = v();
    else if (k.startsWith('--')) throw new Error(`opção desconhecida: ${k}`);
    else pos.push(k);
  }
  [o.pasta = '/tmp/vitrine-ui', o.cenas = 'todas', o.tamanhos = TAMANHOS] = pos;
  if (pos[3]) o.tema = pos[3].split(',')[0] === 'noite' ? 'noite' : 'dia';
  return o;
}

// ---------- página ----------
function entradaDa(o, modulosCenas, temUI) {
  const abs = (p) => JSON.stringify(resolve(RAIZ, p));
  return `
import { criarRenderFalso } from ${abs('ferramentas/vitrine/render-falso.js')};
import { criarSimFalsa, criarJogoFalso } from ${abs('ferramentas/vitrine/sim-falsa.js')};
${temUI ? `import * as UI from ${abs(o.ui)};` : 'const UI = null;'}
${modulosCenas.map((f, i) => `import * as cenas${i} from ${JSON.stringify(f)};`).join('\n')}
const CENAS = {};
const repetidas = [];
function registrarCenaVitrine(nome, def) {
  if (CENAS[nome]) repetidas.push(nome);
  CENAS[nome] = typeof def === 'function' ? { preparar: def } : { ...def };
}
registrarCenaVitrine('carga', { semUI: true, carga: true, espera: 200 });
registrarCenaVitrine('inicial', { repouso: true });
for (const m of [${modulosCenas.map((_, i) => `cenas${i}`).join(', ')}]) {
  if (typeof m.registrar === 'function') m.registrar(registrarCenaVitrine);
  else if (typeof m.default === 'function') m.default(registrarCenaVitrine);
  else for (const [k, v] of Object.entries(m.cenas || m.default || {})) registrarCenaVitrine(k, v);
}
async function simReal(def) {
  ${existsSync(join(RAIZ, 'fonte/sim/estado.js')) ? `const { criarSimulacao } = await import(${abs('fonte/sim/estado.js')});
  const sim = criarSimulacao({ semente: def.semente ?? 'heldopolis-1', ...(def.opcoesSim || {}) });
  if (def.sintetica) {
    ${existsSync(join(RAIZ, 'ferramentas/cidade-sintetica.mjs')) ? `const { gerarCidadeSintetica } = await import(${abs('ferramentas/cidade-sintetica.mjs')});
    gerarCidadeSintetica({ sim });` : `throw new Error('a cidade sintética ainda não existe');`}
  }
  return sim;` : `throw new Error('a simulação real ainda não existe (fonte/sim/estado.js)');`}
}
const quadro = () => new Promise((ok) => requestAnimationFrame(() => ok()));
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
window.__vitrine = {
  cenas: CENAS, repetidas,
  async abrir(nome, { tema, fundo }) {
    const def = CENAS[nome];
    if (!def) throw new Error('cena desconhecida: ' + nome);
    const carga = document.getElementById('carga');
    if (!def.carga && carga) carga.remove();
    const sim = def.sim === 'real' ? await simReal(def) : criarSimFalsa({ cenario: def.cenario || 'meio' });
    const R = await criarRenderFalso(document.getElementById('mundo'), { sim, tema, fundo });
    const jogo = criarJogoFalso(sim);
    const raiz = document.getElementById('ui');
    let ui = null;
    if (!def.semUI && UI) ui = await UI.criarUI(raiz, { sim, R, jogo });
    const laco = (t) => { R.quadro(t); ui?.quadro?.(t); requestAnimationFrame(laco); };
    requestAnimationFrame(laco);
    const alvo = (a, k) => raiz.querySelector('[data-a="' + a + '"]' + (k != null ? '[data-k="' + k + '"]' : ''));
    const ctx = { sim, R, ui, jogo, raiz, esperar, quadro,
      acionar: (a, k) => { const e = alvo(a, k); if (!e) throw new Error('sem [data-a=' + a + ']'); e.click(); return e; },
      clicar: (sel) => { const e = document.querySelector(sel); if (!e) throw new Error('sem ' + sel); e.click(); return e; } };
    await quadro();
    if (def.preparar) await def.preparar(ctx);
    await quadro(); await quadro();
    window.__ctx = ctx;
    return { espera: def.espera ?? 300, repouso: !!def.repouso, temUI: !!ui };
  },
  conferir(nome) { const def = CENAS[nome]; return def?.conferir ? def.conferir(window.__ctx) || [] : []; },
};
window.__pronto = true;
`;
}

// roda na página: as medidas da 13.2
function medirNaPagina({ toque, repouso }) {
  const W = innerWidth, H = innerHeight;
  const raizes = ['ui', 'carga'].map((id) => document.getElementById(id)).filter(Boolean);
  const oculto = (e) => { for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return true; } return false; };
  const visivel = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < W && r.top < H && !oculto(e); };
  const rotulo = (e) => (e.dataset?.a ? `[${e.dataset.a}${e.dataset.k != null ? ':' + e.dataset.k : ''}]` : '') + (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  const todos = (sel) => raizes.flatMap((r) => [...r.querySelectorAll(sel)]);

  // alvos de toque (o de fora conta; ::before e ::after absolutos com margem negativa aumentam a área)
  const SEL = 'button, [data-a], input, select, textarea, a[href], [role=button], [role=tab], [role=switch], [role=slider], [role=menuitem]';
  const minimo = toque ? 44 : 32;
  const folga = (e) => { let fx = 0, fy = 0; for (const ps of ['::after', '::before']) { const cs = getComputedStyle(e, ps); if (cs.content === 'none' || cs.position !== 'absolute') continue; fy = Math.max(fy, -parseFloat(cs.top) - parseFloat(cs.bottom) || 0); fx = Math.max(fx, -parseFloat(cs.left) - parseFloat(cs.right) || 0); } return [fx, fy]; };
  const alvos = todos(SEL).filter((e) => visivel(e) && getComputedStyle(e).pointerEvents !== 'none' && !e.parentElement?.closest(SEL) && !e.disabled);
  const pequenos = alvos.map((e) => { const r = e.getBoundingClientRect(); const [fx, fy] = folga(e); return { alvo: rotulo(e), w: Math.round(r.width + Math.max(0, fx)), h: Math.round(r.height + Math.max(0, fy)) }; })
    .filter((x) => x.w < minimo || x.h < minimo);

  // textos: tamanho e contraste sobre o pior fundo (o mundo branco atrás do vidro)
  const cor = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; } const c = s.match(/color\(srgb ([^)]+)\)/); if (c) { const p = c[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; } return [0, 0, 0, 0]; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mistura = (fundo, c) => [0, 1, 2].map((k) => c[3] * c[k] + (1 - c[3]) * fundo[k]);
  const fundoDe = (e, texto) => {
    // do elemento até a raiz da camada (#ui ou #carga): atrás dela está o mundo, que no pior caso é branco
    const cadeia = [];
    for (let x = e; x; x = x.parentElement) { cadeia.unshift(x); if (raizes.includes(x)) break; }
    let f = [255, 255, 255];
    for (const x of cadeia) {
      const cs = getComputedStyle(x);
      const op = +cs.opacity;
      const img = cs.backgroundImage;
      if (img && img !== 'none' && /gradient/.test(img)) {
        const paradas = [...img.matchAll(/rgba?\([^)]+\)/g)].map((m) => cor(m[0]));
        if (paradas.length) {
          const cands = paradas.map((p) => mistura(f, [...p.slice(0, 3), p[3] * op]));
          f = cands.reduce((pior, c) => (razao(c, texto) < razao(pior, texto) ? c : pior));
        }
      }
      const b = cor(cs.backgroundColor);
      if (b[3] > 0) f = mistura(f, [...b.slice(0, 3), b[3] * op]);
    }
    return f;
  };
  const opacidade = (e) => { let o = 1; for (let x = e; x && x !== document.documentElement; x = x.parentElement) o *= +getComputedStyle(x).opacity; return o; };
  const textosPequenos = [], contraste = [];
  const vistos = new Set();
  for (const r of raizes) {
    const wk = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = wk.nextNode())) {
      const t = n.textContent.trim();
      const p = n.parentElement;
      if (!t || !p || vistos.has(p) || !visivel(p)) continue;
      vistos.add(p);
      const cs = getComputedStyle(p);
      const tam = parseFloat(cs.fontSize);
      if (tam < 12) textosPequenos.push({ texto: t.slice(0, 24), tam });
      if (p.closest('[disabled], [aria-disabled="true"]')) continue;
      const c = cor(cs.color);
      const f = fundoDe(p, c);
      const fg = mistura(f, [...c.slice(0, 3), c[3] * opacidade(p)]);
      const k = razao(fg, f);
      const meta = tam >= 17 ? 3 : 4.5;
      if (k < meta) contraste.push({ texto: t.slice(0, 24), razao: +k.toFixed(2), meta, tam });
    }
  }

  // transbordo: texto cortado sem reticências, ou fora da tela
  const transbordo = [];
  for (const e of vistos) {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (e.scrollWidth > e.clientWidth + 1 && /hidden|clip/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis') transbordo.push({ texto: rotulo(e), motivo: 'cortado' });
    const rola = e.parentElement?.closest('*') && (() => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { if (/auto|scroll/.test(getComputedStyle(x).overflow)) return true; } return false; })();
    if (!rola && (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1)) transbordo.push({ texto: rotulo(e), motivo: 'fora da tela' });
  }

  // HUD: grupos [data-hud], área, sobreposição e faixa livre no meio da tela
  const grupos = todos('[data-hud]').filter(visivel).map((e) => ({ nome: e.dataset.hud, r: e.getBoundingClientRect() }));
  const sobrepoe = [];
  for (let i = 0; i < grupos.length; i++) for (let j = i + 1; j < grupos.length; j++) {
    const a = grupos[i].r, b = grupos[j].r;
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > 1 && h > 1) sobrepoe.push(`${grupos[i].nome} x ${grupos[j].nome}`);
  }
  const area = grupos.reduce((s, g) => s + Math.max(0, Math.min(g.r.right, W) - Math.max(g.r.left, 0)) * Math.max(0, Math.min(g.r.bottom, H) - Math.max(g.r.top, 0)), 0);
  const meio = grupos.filter((g) => g.r.right > W * 0.3 && g.r.left < W * 0.7).map((g) => [Math.max(0, g.r.top), Math.min(H, g.r.bottom)]).sort((a, b) => a[0] - b[0]);
  let faixa = 0, y = 0;
  for (const [a, b] of meio) { faixa = Math.max(faixa, a - y); y = Math.max(y, b); }
  faixa = Math.max(faixa, H - y);

  // textos proibidos e chaves
  const visto = raizes.map((r) => r.innerText || '').join('\n');
  const proibidos = [];
  if (/[\u2014\u2013]/.test(visto)) proibidos.push('travessão');
  if (/\?\?/.test(visto)) proibidos.push('chave faltando (??)');
  if (/aluguel/i.test(visto)) proibidos.push('"Aluguel"');
  if (/(?<![\p{L}\p{N}_])dias?(?![\p{L}\p{N}_])/iu.test(visto)) proibidos.push('a palavra "dia"');
  const unid = visto.match(/\d\s*\/\s*(dia|d|s|seg|min|m[eê]s|ano)\b/i);
  if (unid) proibidos.push(`unidade fora da D42: ${unid[0]}`);

  const principais = toque ? todos('[data-principal]').filter(visivel).map((e) => { const r = e.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; return { alvo: rotulo(e), ok: cy > H * 0.35 && (cx < W * 0.4 || cx > W * 0.6) }; }).filter((x) => !x.ok) : [];
  const nos = document.getElementById('ui')?.querySelectorAll('*').length || 0;
  return { alvos: alvos.length, pequenos, textosPequenos, contraste, transbordo, grupos: grupos.map((g) => g.nome), sobrepoe,
    hudPct: +((area / (W * H)) * 100).toFixed(1), faixa: Math.round(faixa), proibidos, principais, nos, repouso };
}

export async function vitrine(o) {
  const pasta = resolve(o.pasta);
  mkdirSync(pasta, { recursive: true });
  const dirCenas = resolve(RAIZ, o.cenasPasta);
  const modulos = existsSync(dirCenas) ? readdirSync(dirCenas).filter((f) => /\.m?jsx?$/.test(f)).sort().map((f) => join(dirCenas, f)) : [];
  const temUI = existsSync(resolve(RAIZ, o.ui));
  if (!temUI) console.log(`${o.ui} ainda não existe: vitrine sem interface (só as cenas sem UI e o mundo falso)`);
  const js = (await build({
    stdin: { contents: entradaDa(o, modulos, temUI), resolveDir: RAIZ, loader: 'js', sourcefile: 'vitrine-entrada.js' },
    bundle: true, format: 'esm', write: false, logLevel: 'silent', target: ['es2022'], jsx: 'automatic', jsxImportSource: 'preact',
    nodePaths: [join(RAIZ, 'node_modules')], loader: { '.glsl': 'text' },
  })).outputFiles[0].text;
  // a página é o index.html do jogo, com o CSS da interface e a Inter em linha
  const dirCss = resolve(RAIZ, o.css);
  const css = existsSync(dirCss) ? ordenarCss(readdirSync(dirCss).filter((f) => f.endsWith('.css'))).map((f) => readFileSync(join(dirCss, f), 'utf8')).join('\n') : '';
  const woff2 = [join(RAIZ, 'fonte/ui/fontes/inter-latin-wght-normal.woff2'), join(RAIZ, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')].find(existsSync);
  const fonte = `data:font/woff2;base64,${readFileSync(woff2).toString('base64')}`;
  const cssFinal = css.replace(/url\(\s*(['"]?)[^'")]*inter[^'")]*\.woff2\1\s*\)/gi, `url(${fonte})`);
  const html = readFileSync(join(RAIZ, 'fonte/web/index.html'), 'utf8')
    .replaceAll('__FONTE__', fonte).replaceAll('__ICONE__', '')
    .replace('__MONTAGEM__', JSON.stringify({ app: 'vitrine', unico: false, workers: {}, texturas: {} }))
    .replace('<!--ESTILO-->', () => `<style>${cssFinal}</style>`).replace('/*WORKERS*/', '')
    .replace(/<link rel="(manifest|preload|icon|apple-touch-icon)"[^>]*>\n?/g, '')
    .replace('__JOGO__', 'vitrine.js');
  writeFileSync(join(pasta, 'vitrine.html'), html);
  writeFileSync(join(pasta, 'vitrine.js'), js);
  // fundo: --fundo, ou a captura guardada em ferramentas/vitrine/fundos/<dia|noite>.png, ou o mundo de caixas
  let fundo = null;
  const arqFundo = o.fundo || [join(RAIZ, `ferramentas/vitrine/fundos/${o.tema}.png`)].find(existsSync);
  if (arqFundo) { writeFileSync(join(pasta, 'fundo.png'), readFileSync(arqFundo)); fundo = 'fundo.png'; }

  const srv = servir(pasta);
  const browser = await abrirChromium({ gl: false });
  const rel = { cenas: {}, erros: [] };
  let falhas = 0;
  try {
    // lista das cenas registradas
    const pg0 = await browser.newPage();
    const erros0 = [];
    pg0.on('pageerror', (e) => erros0.push(e.message));
    await pg0.goto(`http://localhost:${srv.porta}/vitrine.html?cena=lista`);
    await pg0.waitForFunction(() => window.__pronto === true, null, { timeout: 30000 }).catch(() => {});
    const registradas = await pg0.evaluate(() => (window.__vitrine ? { nomes: Object.keys(window.__vitrine.cenas), tamanhos: Object.fromEntries(Object.entries(window.__vitrine.cenas).map(([k, v]) => [k, v.tamanhos || null])), repetidas: window.__vitrine.repetidas } : null));
    await pg0.close();
    if (!registradas) throw new Error('a página da vitrine não abriu: ' + erros0.join('; '));
    if (registradas.repetidas.length) { rel.erros.push('cenas repetidas: ' + registradas.repetidas.join(', ')); falhas++; }
    const nomes = o.cenas === 'todas' ? registradas.nomes : o.cenas.split(',');
    for (const n of nomes) if (!registradas.nomes.includes(n)) { rel.erros.push(`cena desconhecida: ${n}`); falhas++; }
    const tamanhos = o.tamanhos.split(',');
    for (const tam of tamanhos) {
      const [w, h] = tam.split('x').map(Number);
      const toque = Math.min(w, h) < 600;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: toque, hasTouch: toque, serviceWorkers: 'block' });
      for (const nome of nomes) {
        if (!registradas.nomes.includes(nome)) continue;
        const so = registradas.tamanhos[nome];
        if (so && !so.includes(tam)) continue;
        const pg = await ctx.newPage();
        const erros = [];
        pg.on('pageerror', (e) => erros.push(e.message));
        pg.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
        await pg.goto(`http://localhost:${srv.porta}/vitrine.html?cena=${encodeURIComponent(nome)}`);
        await pg.waitForFunction(() => window.__pronto === true, null, { timeout: 30000 }).catch((e) => erros.push('sem __pronto'));
        if (!process.env.ANIMAR) await pg.addStyleTag({ content: SEM_ANIMACAO });
        let info = { espera: 300, repouso: false };
        try { info = await pg.evaluate(([n, tema, f]) => window.__vitrine.abrir(n, { tema, fundo: f }), [nome, o.tema, fundo]); } catch (e) { erros.push('preparar: ' + e.message.split('\n')[0]); }
        await pg.waitForTimeout(info.espera);
        await pg.screenshot({ path: join(pasta, `${tam}-${nome}.png`) });
        const m = await pg.evaluate(medirNaPagina, { toque, repouso: info.repouso });
        let proprias = [];
        try { proprias = await pg.evaluate((n) => window.__vitrine.conferir(n), nome); } catch (e) { proprias = ['conferir: ' + e.message.split('\n')[0]]; }
        await pg.close();
        const f = [];
        if (erros.length) f.push(...erros.map((e) => 'erro de página: ' + e));
        if (m.pequenos.length) f.push(`alvos abaixo de ${toque ? 44 : 32} px: ${m.pequenos.map((x) => `${x.alvo} ${x.w}x${x.h}`).join(', ')}`);
        if (m.textosPequenos.length) f.push(`textos abaixo de 12 px: ${m.textosPequenos.map((x) => `${x.texto} (${x.tam})`).join(', ')}`);
        if (m.contraste.length) f.push(`contraste: ${m.contraste.map((x) => `${x.texto} ${x.razao}:1 (meta ${x.meta})`).join(', ')}`);
        if (m.transbordo.length) f.push(`transbordo: ${m.transbordo.map((x) => `${x.texto} (${x.motivo})`).join(', ')}`);
        if (m.sobrepoe.length) f.push(`grupos do HUD sobrepostos: ${m.sobrepoe.join(', ')}`);
        if (m.proibidos.length) f.push(...m.proibidos);
        if (m.principais.length) f.push(`ações principais fora da zona do polegar: ${m.principais.map((x) => x.alvo).join(', ')}`);
        const meta = METAS[tam];
        if (info.repouso && meta && m.hudPct > meta.hud) f.push(`HUD em repouso ${m.hudPct}% (meta ${meta.hud}%)`);
        if (info.repouso && meta && m.faixa < meta.faixa) f.push(`faixa livre ${m.faixa} px (meta ${meta.faixa})`);
        if (info.repouso && m.nos > 600) f.push(`${m.nos} nós no DOM em repouso (meta 600)`);
        f.push(...proprias);
        rel.cenas[`${tam}-${nome}`] = { ...m, falhas: f };
        if (f.length) falhas++;
        rel.erros.push(...erros.map((e) => `${tam} ${nome}: ${e}`));
        console.log(`${(tam + ' ' + nome).padEnd(34)} hud ${String(m.hudPct).padStart(4)}% faixa ${String(m.faixa).padStart(4)} px · alvos ${m.alvos} · nós ${m.nos} · ${f.length ? 'FALHOU' : 'ok'}`);
        for (const x of f) console.log('    ' + x);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    srv.fechar();
  }
  writeFileSync(join(pasta, 'ui.json'), JSON.stringify(rel, null, 1));
  console.log(rel.erros.length ? 'ERROS:\n' + rel.erros.join('\n') : 'sem erros de página');
  console.log(falhas ? `vitrine com ${falhas} cena(s) fora das medidas (${pasta})` : `vitrine ok (${pasta})`);
  return falhas ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let codigo;
  try { codigo = await vitrine(lerArgs(process.argv.slice(2))); } catch (e) { console.error('vitrine: ' + e.message); codigo = 1; }
  process.exit(codigo);
}
