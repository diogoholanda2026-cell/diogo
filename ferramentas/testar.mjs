// Abre o jogo montado no Chromium de teste (WebGL por software, SwiftShader), roda um script, captura e mede.
// Uso: node ferramentas/testar.mjs [opções] [saida.png] [consulta] [largura] [altura] [espera_ms] [script]
// Opções (valem também no lugar dos posicionais):
//   --pasta previa|app|<pasta>  pasta servida (padrão previa); --pagina <arquivo> dentro dela (padrão index.html)
//   --saida <png>  --consulta "cena=aberta&q=media"  --tam 1376x768  --espera <ms>  --escala <n>  --toque
//   --script <arquivo.js | código>  roda depois de window.__pronto (se devolver Promise, espera)
//   --webgpu  liga o WebGPU (adaptador SwiftShader) e acrescenta webgpu=1 à consulta
//   --semClip acrescenta semClip=1 (força as duas faixas de profundidade)
//   --teto <s> espera máxima por window.__pronto (padrão 240)   --json <arquivo> grava o resultado
// Saída: uma linha JSON { ms, stats, resultado, montagem } e depois o console da página. stats é o R.stats do render
// (window.__held.R.stats); resultado é window.__resultado. Código 1 se a página deu erro ou não ficou pronta.
// As animações e transições de CSS são zeradas (no SwiftShader cada quadro é lento); ANIMAR=1 deixa como no jogo.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const ARGS_GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
export const ARGS_WEBGPU = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-webgpu-adapter=swiftshader'];
export const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.ktx2': 'image/ktx2', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.held': 'application/octet-stream',
};
const SEM_ANIMACAO = '*,*::before,*::after{animation:none!important;transition:none!important}';

// Servidor estático de uma pasta (sem cache); devolve { porta, fechar }
export function servir(pasta) {
  const base = resolve(pasta);
  const srv = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = resolve(join(base, p));
    if ((f !== base && !f.startsWith(base + sep)) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TIPOS[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(f));
  }).listen(0);
  return { porta: srv.address().port, fechar: () => srv.close() };
}

export function pastaDe(nome) {
  if (!nome || nome === 'previa' || nome === 'app') return join(RAIZ, nome || 'previa');
  return resolve(nome);
}

export async function abrirChromium({ webgpu = false, gl = true } = {}) {
  const { chromium } = await import('playwright');
  return chromium.launch({ executablePath: CHROME, args: [...(gl ? ARGS_GL : []), ...(webgpu ? ARGS_WEBGPU : [])] });
}

function lerArgs(argv) {
  const o = { pasta: 'previa', pagina: 'index.html', saida: null, consulta: null, tam: null, espera: null, script: null,
    webgpu: false, semClip: false, teto: 240, json: null, toque: false, escala: 1 };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--pasta') o.pasta = v();
    else if (k === '--pagina') o.pagina = v();
    else if (k === '--saida') o.saida = v();
    else if (k === '--consulta') o.consulta = v();
    else if (k === '--tam') o.tam = v();
    else if (k === '--espera') o.espera = +v();
    else if (k === '--script') o.script = v();
    else if (k === '--webgpu') o.webgpu = true;
    else if (k === '--semClip') o.semClip = true;
    else if (k === '--teto') o.teto = +v();
    else if (k === '--json') o.json = v();
    else if (k === '--toque') o.toque = true;
    else if (k === '--escala') o.escala = +v();
    else if (k.startsWith('--')) throw new Error(`opção desconhecida: ${k}`);
    else pos.push(k);
  }
  const [saida, consulta, w, h, espera, script] = pos;
  o.saida ??= saida || '/tmp/tela.png';
  o.consulta ??= consulta ?? '';
  o.tam ??= w && h ? `${w}x${h}` : '1376x768';
  o.espera ??= espera != null ? +espera : 1500;
  o.script ??= script || '';
  return o;
}

export async function testar(o) {
  const pasta = pastaDe(o.pasta);
  if (!existsSync(join(pasta, o.pagina))) throw new Error(`${join(pasta, o.pagina)} não existe (monte antes com node ferramentas/montar.mjs)`);
  const extra = [o.webgpu && 'webgpu=1', o.semClip && 'semClip=1'].filter(Boolean);
  const consulta = [o.consulta, ...extra].filter(Boolean).join('&');
  const [W, H] = o.tam.split('x').map(Number);
  let script = o.script || '';
  if (script && !script.includes('\n') && existsSync(script) && statSync(script).isFile()) script = readFileSync(script, 'utf8');

  const srv = servir(pasta);
  const browser = await abrirChromium({ webgpu: o.webgpu });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: o.escala, isMobile: o.toque, hasTouch: o.toque, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const logs = [];
  let erros = 0;
  page.on('console', (m) => { logs.push(m.type() + ': ' + m.text()); if (m.type() === 'error') erros++; });
  page.on('pageerror', (e) => { erros++; logs.push('ERRO: ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 4).join(' <- ')); });
  const t0 = Date.now();
  let pronto = true;
  try {
    // a carga também espera até o teto: com a máquina ocupada (outra bancada ou robô junto), os 30 s do padrão não bastam
    await page.goto(`http://localhost:${srv.porta}/${o.pagina}${consulta ? '?' + consulta : ''}`, { timeout: o.teto * 1000 });
    try { await page.waitForFunction(() => window.__pronto === true, null, { timeout: o.teto * 1000, polling: 250 }); } catch (e) { pronto = false; logs.push('sem __pronto: ' + e.message.split('\n')[0]); }
    if (!process.env.ANIMAR) await page.addStyleTag({ content: SEM_ANIMACAO });
    if (script) { try { await page.evaluate(script); } catch (e) { erros++; logs.push('script: ' + e.message); } }
    await page.waitForTimeout(o.espera);
    if (o.saida) await page.screenshot({ path: o.saida, timeout: 240000 });
    const lido = await page.evaluate(() => {
      const limpo = (x) => { try { return x == null ? null : JSON.parse(JSON.stringify(x)); } catch (e) { return String(e); } };
      const R = window.__held?.R;
      return { stats: limpo(R?.stats), resultado: limpo(window.__resultado), montagem: limpo(window.__HELD_MONTAGEM__) };
    });
    const out = { ms: Date.now() - t0, pronto, erros, ...lido };
    if (o.json) writeFileSync(o.json, JSON.stringify({ ...out, logs }, null, 1));
    return { out, logs, ok: pronto && erros === 0 };
  } finally {
    await browser.close();
    srv.fechar();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let r;
  try { r = await testar(lerArgs(process.argv.slice(2))); } catch (e) { console.error('testar: ' + e.message); process.exit(1); }
  console.log(JSON.stringify(r.out));
  for (const l of r.logs) console.log(l);
  process.exit(r.ok ? 0 : 1);
}
