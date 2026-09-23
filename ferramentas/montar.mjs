// Monta o jogo: empacota fonte/ com esbuild em app/ (PWA) e gera uma versão de arquivo único.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(raiz, 'app');
const versao = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')).version;
const carimbo = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const dev = process.argv.includes('--dev');

if (existsSync(join(app, 'jogo.js'))) rmSync(join(app, 'jogo.js'));
mkdirSync(app, { recursive: true });
const r = await build({
  entryPoints: [join(raiz, 'fonte/main.js')], bundle: true, format: 'esm', target: ['chrome110', 'safari16'],
  minify: !dev, sourcemap: false, write: false, legalComments: 'eof',
  define: { __VERSAO__: JSON.stringify(versao + '+' + carimbo) },
});
const js = r.outputFiles[0].text;
const css = readFileSync(join(raiz, 'fonte/ui/estilo.css'), 'utf8');
let html = readFileSync(join(raiz, 'fonte/web/index.html'), 'utf8').replace('/*CSS*/', () => css);
writeFileSync(join(app, 'jogo.js'), js);
writeFileSync(join(app, 'index.html'), html);
// PWA: manifesto, service worker (versão no nome do cache) e ícones
for (const f of ['manifest.webmanifest', 'foto.webp']) cpSync(join(raiz, 'fonte/web', f), join(app, f));
writeFileSync(join(app, 'sw.js'), readFileSync(join(raiz, 'fonte/web/sw.js'), 'utf8').replace('__CACHE__', 'held-' + versao + '-' + carimbo));
if (existsSync(join(raiz, 'fonte/web/icones'))) cpSync(join(raiz, 'fonte/web/icones'), join(app, 'icones'), { recursive: true });
// arquivo único (abre direto no navegador, sem servidor)
const foto64 = 'data:image/webp;base64,' + readFileSync(join(raiz, 'fonte/web/foto.webp')).toString('base64');
const unico = html.replace('<script type="module" src="jogo.js"></script>', () => `<script>window.__FOTO__='${foto64}'</script><script type="module">` + js.replace(/<\/script/g, '<\\/script') + '</script>')
  .replace('<link rel="manifest" href="manifest.webmanifest">', '');
writeFileSync(join(raiz, 'arcologia-de-held.html'), unico);
console.log('app/ montado', (js.length / 1024).toFixed(0) + ' KB', 'versão', versao + '+' + carimbo);
