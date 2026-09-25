// Testes visuais: serve app/ localmente e captura telas no Chromium (WebGL por software).
// Uso: node ferramentas/testar.mjs [saida] [consulta] [largura] [altura] [espera_ms] [script_js]
// As animações e transições de CSS são zeradas (no SwiftShader cada quadro leva ~1 s e elas não
// terminariam); com ANIMAR=1 no ambiente elas ficam como no jogo.
// MEDIR=1 acrescenta ao JSON: 'fase' (#ui[data-fase] contra env.fase, com hora=12 ou hora=22 na consulta) e 'contraste'
// (razão entre o branco do texto do HUD e a média de 5 pontos ao redor de cada texto, lidos da própria captura; a
// especificação pede 3:1 no mínimo), com a lista do que ficou abaixo de 3.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(raiz, 'app');
const [saida = '/tmp/tela.png', consulta = 'vista=foto&pr=1', W = '1376', H = '768', espera = '1500', script = ''] = process.argv.slice(2);
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };
const srv = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = join(app, p); if (!f.startsWith(app) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': tipos[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
}).listen(0);
const porta = srv.address().port;
// sem animação nenhuma (e não só curta): uma animação que começa no quadro da foto sairia no estado inicial
const SEM_ANIMACAO = '*,*::before,*::after{animation:none!important;transition:none!important}';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('ERRO: ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 4).join(' <- ')));
const t0 = Date.now();
await page.goto(`http://localhost:${porta}/?${consulta}`);
try { await page.waitForFunction(() => window.__pronto === true, null, { timeout: 240000 }); } catch (e) { logs.push('sem __pronto: ' + e.message); }
if (!process.env.ANIMAR) await page.addStyleTag({ content: SEM_ANIMACAO });
if (script) { try { await page.evaluate(script); } catch (e) { logs.push('script: ' + e.message); } }
await page.waitForTimeout(+espera);
await page.screenshot({ path: saida, timeout: 240000 });
const st = await page.evaluate(() => { const e = window.__held?.engine; return e ? { ...e.stats, gpu: e.gpu, q: e.q.id, W: e.W, H: e.H } : null; });
const res = await page.evaluate(() => window.__resultado || null);
let med = null;
if (process.env.MEDIR) {
  const b64 = readFileSync(saida).toString('base64');
  med = await page.evaluate(async (b64) => { try {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const c2 = cv.getContext('2d'); c2.drawImage(img, 0, 0);
    const kx = img.width / innerWidth, ky = img.height / innerHeight; const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = (x, y) => { const d = c2.getImageData(Math.max(0, Math.min(img.width - 1, Math.round(x * kx))), Math.max(0, Math.min(img.height - 1, Math.round(y * ky))), 1, 1).data; return 0.2126 * f(d[0]) + 0.7152 * f(d[1]) + 0.0722 * f(d[2]); };
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
    const sels = '.hud-txt, .stat span, .bt span, .obras-bt span, .cap .c, .cap .prog, .nivel .nv, .proximo span, .agora .ir, .balao .n';
    const out = [];
    for (const el of document.querySelectorAll(sels)) { if (!vis(el) || el.closest('.folha, .modal, .cartao, .info-pop, .oculto, .escondido')) continue; const r = el.getBoundingClientRect(); if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
      const pts = [[r.left - 3, r.top + r.height / 2], [r.right + 3, r.top + r.height / 2], [r.left + r.width / 2, r.top - 3], [r.left + r.width / 2, r.bottom + 3], [r.left + r.width * 0.25, r.bottom + 3]]; let L = 0; for (const [x, y] of pts) L += lum(x, y); L /= pts.length; out.push({ t: (el.textContent || '').trim().slice(0, 14), c: +(1.05 / (L + 0.05)).toFixed(2) }); }
    const ui = document.getElementById('ui'); const H = window.__held;
    return { fase: { ui: ui?.dataset.fase || null, env: H?.env?.fase || null }, contraste: { n: out.length, min: out.length ? Math.min(...out.map((o) => o.c)) : null, abaixo3: out.filter((o) => o.c < 3) } };
  } catch (err) { return { erro: String(err) }; } }, b64);
}
console.log(JSON.stringify({ ms: Date.now() - t0, st, res, ...(med ? { med } : {}) }));
for (const l of logs) console.log(l);
await browser.close(); srv.close();
