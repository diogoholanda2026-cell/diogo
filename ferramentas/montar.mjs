// Monta o jogo: empacota fonte/ com esbuild em app/ (PWA) e gera uma versão de arquivo único.
// O jogo sai como app/jogo.<carimbo>.js (os antigos são apagados); o index.html e o sw.js recebem o
// nome certo (marcador __JOGO__), e o cache do service worker leva a versão e o carimbo no nome.
// A fonte da interface (Baloo 2, OFL) vai em app/fontes/; no arquivo único ela entra no CSS em base64.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(raiz, 'app');
const versao = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')).version;
const carimbo = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
const JOGO = `jogo.${carimbo}.js`;
const dev = process.argv.includes('--dev');

mkdirSync(app, { recursive: true });
for (const f of readdirSync(app)) if (/^jogo(\.\d+)?\.js$/.test(f)) rmSync(join(app, f));
const r = await build({
  entryPoints: [join(raiz, 'fonte/main.js')], bundle: true, format: 'esm', target: ['chrome110', 'safari16'],
  minify: !dev, sourcemap: false, write: false, legalComments: 'eof',
  define: { __VERSAO__: JSON.stringify(versao + '+' + carimbo) },
});
const js = r.outputFiles[0].text;
const css = readFileSync(join(raiz, 'fonte/ui/estilo.css'), 'utf8');
const html = readFileSync(join(raiz, 'fonte/web/index.html'), 'utf8').replace('/*CSS*/', () => css);
writeFileSync(join(app, JOGO), js);
writeFileSync(join(app, 'index.html'), html.replace('src="__JOGO__"', `src="${JOGO}"`));
// PWA: manifesto, service worker (versão no nome do cache) e ícones
for (const f of ['manifest.webmanifest', 'foto.webp']) cpSync(join(raiz, 'fonte/web', f), join(app, f));
writeFileSync(join(app, 'sw.js'), readFileSync(join(raiz, 'fonte/web/sw.js'), 'utf8').replace('__CACHE__', 'held-' + versao + '-' + carimbo).replace('__JOGO__', './' + JOGO));
if (existsSync(join(raiz, 'fonte/web/icones'))) cpSync(join(raiz, 'fonte/web/icones'), join(app, 'icones'), { recursive: true });
if (existsSync(join(raiz, 'fonte/web/fontes'))) cpSync(join(raiz, 'fonte/web/fontes'), join(app, 'fontes'), { recursive: true });
// arquivo único (abre direto no navegador, sem servidor)
const foto64 = 'data:image/webp;base64,' + readFileSync(join(raiz, 'fonte/web/foto.webp')).toString('base64');
// (a fonte vira data: no CSS e os <link rel="preload"> dela saem: não há pasta fontes/ ao lado do arquivo)
const fonte64 = (f) => 'data:font/woff2;base64,' + readFileSync(join(raiz, 'fonte/web/fontes', f)).toString('base64');
const unico = html.replace(/<link rel="preload"[^>]*fontes\/[^>]*>\n?/g, '').replace(/url\(fontes\/([\w.-]+\.woff2)\)/g, (m, f) => `url(${fonte64(f)})`)
  .replace('<script type="module" src="__JOGO__"></script>', () => `<script>window.__FOTO__='${foto64}'</script><script type="module">` + js.replace(/<\/script/g, '<\\/script') + '</script>')
  .replace('<link rel="manifest" href="manifest.webmanifest">', '');
writeFileSync(join(raiz, 'arcologia-de-held.html'), unico);
console.log('app/ montado', JOGO, (js.length / 1024).toFixed(0) + ' KB', 'versão', versao + '+' + carimbo);
