// Testes visuais: serve app/ localmente e captura telas no Chromium (WebGL por software).
// Uso: node ferramentas/testar.mjs [saida] [consulta] [largura] [altura] [espera_ms] [script_js]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(raiz, 'app');
const [saida = '/tmp/tela.png', consulta = 'vista=foto&pr=1', W = '1376', H = '768', espera = '1500', script = ''] = process.argv.slice(2);
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };
const srv = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = join(app, p); if (!f.startsWith(app) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': tipos[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
}).listen(0);
const porta = srv.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('ERRO: ' + e.message));
const t0 = Date.now();
await page.goto(`http://localhost:${porta}/?${consulta}`);
try { await page.waitForFunction(() => window.__pronto === true, null, { timeout: 180000 }); } catch (e) { logs.push('sem __pronto: ' + e.message); }
if (script) { try { await page.evaluate(script); } catch (e) { logs.push('script: ' + e.message); } }
await page.waitForTimeout(+espera);
await page.screenshot({ path: saida });
const st = await page.evaluate(() => { const e = window.__held?.engine; return e ? { ...e.stats, gpu: e.gpu, q: e.q.id, W: e.W, H: e.H } : null; });
console.log(JSON.stringify({ ms: Date.now() - t0, st }));
for (const l of logs) console.log(l);
await browser.close(); srv.close();
