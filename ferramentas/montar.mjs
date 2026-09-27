// Monta o jogo novo (PROJETO 3.2, D38 e A1).
//   node ferramentas/montar.mjs                       monta em previa/ (só o integrador, nas prévias)
//   node ferramentas/montar.mjs --saida <pasta>       monta em qualquer pasta (as parcelas testam numa pasta temporária)
//   node ferramentas/montar.mjs --saida app --publicar-m1   só na publicação do M1 (C2): app/ e arcologia-de-held.html
// Opções: --entrada <arquivo> (padrão fonte/app/main.js), --unico (também <saida>/unico.html fora do app), --dev (sem
// minificar, sem os tetos de tamanho). Importável: montar({ saida, entrada, unico, dev, workers, tema }) para testes.
//
// O que sai na pasta:
//   index.html (de fonte/web, com a carga em HTML e CSS antes do JS), jogo.<carimbo>.js (esbuild, JSX do Preact),
//   estilo.<carimbo>.css (fonte/ui/tema/*.css em ordem fixa), fontes/inter.<carimbo>.woff2 e OFL.txt,
//   tarefas.<carimbo>.js e oficina.<carimbo>.js (workers clássicos em IIFE, com teto de tamanho), materiais/*.<carimbo>.ktx2
//   (se houver arte/materiais), icones/, manifest.webmanifest e sw.js (cache 'heldopolis-previa-' ou 'heldopolis-app-'
//   mais o carimbo, com a lista de arquivos desta montagem).
// No HTML único tudo vai dentro: JS e CSS em linha, a Inter em base64 e cada worker como Blob (URL.createObjectURL); as
// texturas KTX2 não vão (o jogo usa o material procedural, D46).
//
// Contrato com o app: window.__HELD_MONTAGEM__ = { versao, carimbo, app: 'previa' | 'app' | 'teste', unico,
//   workers: { tarefas, oficina } (endereço para new Worker(url), clássico), texturas: { nome: endereço } }.
// Fora da montagem (Node, testes) esse objeto não existe e o app usa o worker simulado.
//
// Falha (código 1) se a guarda de texto falhar, se o esbuild der erro ou aviso (chave duplicada e outros) ou se um
// arquivo passar do teto (A1: JS principal 1,6 MB, tarefas 150 KB, oficina 250 KB, texturas 8 MB).
import { build, transform, formatMessages } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve, relative, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { guardar, relatorio } from './guarda-texto.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KB = 1024;

// ordem fixa do CSS da interface; arquivos fora da lista entram depois, em ordem alfabética
export const ORDEM_CSS = ['tokens', 'base', 'componentes', 'hud', 'folha', 'telas', 'mundo'];
export const WORKERS = [
  { nome: 'tarefas', entrada: 'fonte/sim/trabalhador.js', teto: 150 * KB },
  { nome: 'oficina', entrada: 'fonte/render/mundo/oficina.worker.js', teto: 250 * KB },
];
export const TETO_JS = 1.6 * KB * KB;
export const TETO_TEXTURAS = 8 * KB * KB;
// id do manifesto: o app mantém o id do jogo instalado (o manifesto antigo usava '/diogo/'), então a publicação do
// M1 troca o app no lugar; a prévia tem id próprio e não toma o lugar do jogo instalado
const MANIFESTO = {
  app: { id: '/diogo/', name: 'Arcologia de Held', short_name: 'Held' },
  previa: { id: '/diogo/previa/', name: 'Arcologia de Held (prévia)', short_name: 'Held prévia' },
  teste: { id: '/heldopolis-teste/', name: 'Arcologia de Held (teste)', short_name: 'Held teste' },
};
const PROIBIDAS = ['', 'fonte', 'ferramentas', 'antigo', 'docs', 'node_modules', '.git', '.claude', 'arte', 'jogo-antigo'];
const GERADO = /^(jogo|tarefas|oficina|estilo)\.\d{14}\.(js|css)$/;

export function carimboDe(d = new Date()) {
  return d.toISOString().slice(0, 19).replace(/[-:T]/g, '');
}

export function ordenarCss(nomes) {
  const pos = (n) => { const i = ORDEM_CSS.indexOf(basename(n, '.css')); return i < 0 ? ORDEM_CSS.length : i; };
  return [...nomes].sort((a, b) => pos(a) - pos(b) || (a < b ? -1 : a > b ? 1 : 0));
}

// texto de JS dentro de <script>: sem fechar a tag por engano
const emScript = (s) => s.replace(/<\/script/gi, '<\\/script');
const literalJs = (s) => JSON.stringify(s).replace(/<\//g, '<\\/').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function lerArgs(argv) {
  const a = { saida: 'previa', entrada: 'fonte/app/main.js', unico: false, dev: false, publicar: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--saida') a.saida = argv[++i];
    else if (k === '--entrada') a.entrada = argv[++i];
    else if (k === '--unico') a.unico = true;
    else if (k === '--dev') a.dev = true;
    else if (k === '--publicar-m1') a.publicar = true;
    else throw new Error(`opção desconhecida: ${k}`);
  }
  return a;
}

async function avisosDe(r, onde) {
  const lista = [];
  for (const [tipo, msgs] of [['erro', r.errors || []], ['aviso', r.warnings || []]]) {
    if (!msgs.length) continue;
    const txt = await formatMessages(msgs, { kind: tipo === 'erro' ? 'error' : 'warning', color: false });
    for (const t of txt) lista.push(`${onde}: ${tipo}: ${t.trim()}`);
  }
  return lista;
}

function fonteInter(raiz) {
  const locais = [join(raiz, 'fonte/ui/fontes/inter-latin-wght-normal.woff2'), join(raiz, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')];
  const woff2 = locais.find(existsSync);
  if (!woff2) throw new Error('Inter latina não encontrada (fonte/ui/fontes/ ou node_modules/@fontsource-variable/inter)');
  const ofls = [join(raiz, 'fonte/ui/fontes/OFL.txt'), join(raiz, 'node_modules/@fontsource-variable/inter/LICENSE')];
  return { woff2, ofl: ofls.find(existsSync) };
}

export async function montar(opcoes = {}) {
  const raiz = opcoes.raiz || RAIZ;
  const o = { saida: 'previa', entrada: 'fonte/app/main.js', unico: false, dev: false, publicar: false, ...opcoes };
  const pasta = resolve(raiz, o.saida);
  const rel = relative(raiz, pasta).split('\\').join('/');
  const topo = rel.split('/')[0];
  if (!rel.startsWith('..') && (PROIBIDAS.includes(rel) || (topo !== '' && PROIBIDAS.includes(topo)))) throw new Error(`--saida ${o.saida}: pasta proibida`);
  const ehApp = rel === 'app';
  if (ehApp && !o.publicar) throw new Error('--saida app só na publicação do M1 (acrescente --publicar-m1): app/ guarda o jogo antigo até lá');
  const tipoApp = ehApp ? 'app' : rel === 'previa' ? 'previa' : 'teste';
  const entrada = resolve(raiz, o.entrada);
  if (!existsSync(entrada)) throw new Error(`entrada ausente: ${relative(raiz, entrada)}`);

  const log = [];
  const problemas = [];
  // 1. guarda de texto
  const guarda = guardar({ raiz });
  log.push(relatorio(guarda));
  if (guarda.falhas.length) return { ok: false, log, problemas: ['guarda de texto falhou'] };

  const versao = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')).version;
  const carimbo = o.carimbo || carimboDe();
  const nomes = { jogo: `jogo.${carimbo}.js`, estilo: `estilo.${carimbo}.css`, fonte: `fontes/inter.${carimbo}.woff2` };

  // 2. JS principal (esbuild; JSX automático do Preact)
  const base = {
    bundle: true, write: false, minify: !o.dev, legalComments: 'eof', logLevel: 'silent',
    target: ['es2022', 'chrome110', 'safari16'], jsx: 'automatic', jsxImportSource: 'preact',
    loader: { '.glsl': 'text' }, absWorkingDir: raiz, nodePaths: [join(raiz, 'node_modules')], charset: 'utf8',
  };
  let rjogo;
  try { rjogo = await build({ ...base, entryPoints: [entrada], format: 'esm' }); } catch (e) { rjogo = e; }
  problemas.push(...(await avisosDe(rjogo, 'jogo')));
  if (!rjogo.outputFiles) return { ok: false, log, problemas };
  const js = rjogo.outputFiles[0].text;
  if (!o.dev && Buffer.byteLength(js) > TETO_JS) problemas.push(`jogo: ${(Buffer.byteLength(js) / KB).toFixed(0)} KB passa do teto de ${(TETO_JS / KB).toFixed(0)} KB (A1)`);

  // 3. workers clássicos (IIFE), com teto
  const workers = {};
  for (const w of o.workers || WORKERS) {
    const ent = resolve(raiz, w.entrada);
    if (!existsSync(ent)) { log.push(`worker ${w.nome}: ${w.entrada} ainda não existe (pulado)`); continue; }
    let r;
    try { r = await build({ ...base, entryPoints: [ent], format: 'iife' }); } catch (e) { r = e; }
    problemas.push(...(await avisosDe(r, `worker ${w.nome}`)));
    if (!r.outputFiles) continue;
    const txt = r.outputFiles[0].text;
    const tam = Buffer.byteLength(txt);
    if (!o.dev && tam > w.teto) problemas.push(`worker ${w.nome}: ${(tam / KB).toFixed(1)} KB passa do teto de ${w.teto / KB} KB (A1)`);
    workers[w.nome] = { texto: txt, arquivo: `${w.nome}.${carimbo}.js`, tam };
  }

  // 4. CSS da interface em ordem fixa, com a Inter carimbada
  const pastaTema = resolve(raiz, o.tema || 'fonte/ui/tema');
  const arqsCss = existsSync(pastaTema) ? ordenarCss(readdirSync(pastaTema).filter((f) => f.endsWith('.css'))) : [];
  const cssBruto = arqsCss.map((f) => `/* ${f} */\n` + readFileSync(join(pastaTema, f), 'utf8')).join('\n');
  const trocaFonte = (css, url) => css.replace(/url\(\s*(['"]?)[^'")]*inter[^'")]*\.woff2\1\s*\)/gi, `url(${url})`);
  let css = '';
  if (cssBruto.trim()) {
    let r;
    try { r = await transform(cssBruto, { loader: 'css', minify: !o.dev, logLevel: 'silent', target: ['chrome110', 'safari16'] }); } catch (e) { r = e; }
    problemas.push(...(await avisosDe(r, 'css')));
    css = r.code || '';
  }

  // 5. fonte, ícones e texturas
  const inter = fonteInter(raiz);
  const woff2 = readFileSync(inter.woff2);
  const pastaIcones = join(raiz, 'fonte/web/icones');
  const icones = existsSync(pastaIcones) ? readdirSync(pastaIcones).filter((f) => f.endsWith('.png')).sort() : [];
  const pastaMat = join(raiz, 'arte/materiais');
  const texturas = existsSync(pastaMat) ? readdirSync(pastaMat).filter((f) => f.endsWith('.ktx2')).sort() : [];
  let bytesTex = 0;
  for (const t of texturas) bytesTex += statSync(join(pastaMat, t)).size;
  if (bytesTex > TETO_TEXTURAS) problemas.push(`texturas: ${(bytesTex / KB / KB).toFixed(1)} MB passam do teto de 8 MB (A1)`);
  const nomeTex = (t) => `materiais/${basename(t, '.ktx2')}.${carimbo}.ktx2`;

  // 6. objeto da montagem (lido pelo app) e páginas
  const montagem = (unico) => ({
    versao, carimbo, app: tipoApp, unico,
    workers: unico ? {} : Object.fromEntries(Object.entries(workers).map(([k, w]) => [k, w.arquivo])),
    texturas: unico ? {} : Object.fromEntries(texturas.map((t) => [basename(t, '.ktx2'), nomeTex(t)])),
  });
  const modelo = readFileSync(join(raiz, 'fonte/web/index.html'), 'utf8');
  const pagina = (unico) => {
    const fonteUrl = unico ? `data:font/woff2;base64,${woff2.toString('base64')}` : nomes.fonte;
    const icone = unico ? `data:image/png;base64,${readFileSync(join(pastaIcones, 'icone-192.png')).toString('base64')}` : 'icones/icone-192.png';
    const cssFinal = trocaFonte(css, fonteUrl);
    let h = modelo
      .replaceAll('__FONTE__', () => fonteUrl)
      .replaceAll('__ICONE__', () => icone)
      .replace('__MONTAGEM__', () => JSON.stringify(montagem(unico)))
      .replace('<!--ESTILO-->', () => (cssFinal ? (unico ? `<style>${cssFinal}</style>` : `<link rel="stylesheet" href="${nomes.estilo}">`) : ''));
    const resto = ['__FONTE__', '__ICONE__', '__MONTAGEM__', '<!--ESTILO-->'].filter((m) => h.includes(m));
    if (resto.length || !h.includes('/*WORKERS*/') || !h.includes('src="__JOGO__"')) problemas.push(`index.html: marcador sem troca ou ausente (${resto.join(', ')})`);
    if (unico) {
      const blobs = Object.entries(workers).map(([k, w]) => `window.__HELD_MONTAGEM__.workers.${k} = URL.createObjectURL(new Blob([${literalJs(w.texto)}], { type: 'text/javascript' }));`).join('\n');
      h = h.replace('/*WORKERS*/', () => blobs)
        .replace(/<link rel="preload"[^>]*>\n?/g, '')
        .replace(/<link rel="manifest"[^>]*>\n?/, '')
        .replace('<script type="module" src="__JOGO__"></script>', () => `<script type="module">${emScript(js)}</script>`);
    } else {
      h = h.replace('/*WORKERS*/', '').replace('__JOGO__', nomes.jogo);
    }
    return { html: h, css: cssFinal };
  };

  // 7. grava a pasta (apaga só os arquivos com carimbo de montagens anteriores)
  mkdirSync(join(pasta, 'fontes'), { recursive: true });
  for (const f of readdirSync(pasta)) if (GERADO.test(f)) rmSync(join(pasta, f));
  for (const f of readdirSync(join(pasta, 'fontes'))) if (/^inter\.\d{14}\.woff2$/.test(f)) rmSync(join(pasta, 'fontes', f));
  if (existsSync(join(pasta, 'materiais'))) for (const f of readdirSync(join(pasta, 'materiais'))) if (/\.\d{14}\.ktx2$/.test(f)) rmSync(join(pasta, 'materiais', f));
  const p = pagina(false);
  writeFileSync(join(pasta, 'index.html'), p.html);
  writeFileSync(join(pasta, nomes.jogo), js);
  if (p.css) writeFileSync(join(pasta, nomes.estilo), p.css);
  writeFileSync(join(pasta, nomes.fonte), woff2);
  if (inter.ofl) copyFileSync(inter.ofl, join(pasta, 'fontes/OFL.txt'));
  for (const w of Object.values(workers)) writeFileSync(join(pasta, w.arquivo), w.texto);
  if (icones.length) mkdirSync(join(pasta, 'icones'), { recursive: true });
  for (const f of icones) copyFileSync(join(pastaIcones, f), join(pasta, 'icones', f));
  if (texturas.length) mkdirSync(join(pasta, 'materiais'), { recursive: true });
  for (const t of texturas) copyFileSync(join(pastaMat, t), join(pasta, nomeTex(t)));
  const man = JSON.parse(readFileSync(join(raiz, 'fonte/web/manifest.webmanifest'), 'utf8'));
  Object.assign(man, MANIFESTO[tipoApp]);
  writeFileSync(join(pasta, 'manifest.webmanifest'), JSON.stringify(man, null, 2) + '\n');
  const lista = ['./', './index.html', `./${nomes.jogo}`, './manifest.webmanifest', `./${nomes.fonte}`,
    ...(p.css ? [`./${nomes.estilo}`] : []), ...Object.values(workers).map((w) => `./${w.arquivo}`),
    ...icones.map((f) => `./icones/${f}`), ...texturas.map((t) => `./${nomeTex(t)}`)];
  const prefixo = `heldopolis-${tipoApp === 'app' ? 'app' : 'previa'}-`;
  const sw = readFileSync(join(raiz, 'fonte/web/sw.js'), 'utf8')
    .replace('__PREFIXO__', prefixo).replace('__CARIMBO__', carimbo).replace('__ARQUIVOS__', () => JSON.stringify(lista));
  writeFileSync(join(pasta, 'sw.js'), sw);

  // 8. HTML único
  let unico = null;
  if (ehApp || o.unico) {
    unico = ehApp ? join(raiz, 'arcologia-de-held.html') : join(pasta, 'unico.html');
    writeFileSync(unico, pagina(true).html);
  }

  // 9. relatório
  const kb = (n) => (n / KB).toFixed(1) + ' KB';
  const gz = (s) => gzipSync(Buffer.from(s)).length;
  const onde = (f) => (relative(raiz, f).startsWith('..') ? f : relative(raiz, f));
  log.push(`montado em ${onde(pasta)} (${tipoApp}), versão ${versao}+${carimbo}`);
  log.push(`  jogo ${kb(Buffer.byteLength(js))} (gzip ${kb(gz(js))}) · css ${kb(Buffer.byteLength(p.css))} (${arqsCss.length} arquivos) · inter ${kb(woff2.length)}`);
  for (const w of o.workers || WORKERS) if (workers[w.nome]) log.push(`  worker ${w.nome} ${kb(workers[w.nome].tam)} (teto ${w.teto / KB} KB)`);
  if (texturas.length) log.push(`  texturas ${texturas.length} (${(bytesTex / KB / KB).toFixed(1)} MB)`);
  log.push(`  sw.js: cache ${prefixo}${carimbo}, ${lista.length} arquivos`);
  if (unico) log.push(`  HTML único ${onde(unico)} ${kb(statSync(unico).size)}`);
  return { ok: problemas.length === 0, log, problemas, pasta, carimbo, unico, workers: Object.keys(workers), tamJs: Buffer.byteLength(js) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let r;
  try { r = await montar(lerArgs(process.argv.slice(2))); } catch (e) { console.error('montar: ' + e.message); process.exit(1); }
  for (const l of r.log) console.log(l);
  for (const l of r.problemas) console.error(l);
  if (!r.ok) console.error(`montagem com ${r.problemas.length} problema(s)`);
  process.exit(r.ok ? 0 : 1);
}
