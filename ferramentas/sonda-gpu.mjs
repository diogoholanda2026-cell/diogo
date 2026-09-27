// Sonda da GPU no Chromium de teste (D33, D44, 5.3): abre uma cena da montagem com ?sonda=1 (o vigia guarda as
// fontes), lê a sonda do render (limites, extensões, precisão, o que o aparelho tem) e conta cada programa
// compilado contra a guarda do Mali (amostradores por estágio, varyings, vetores de uniforme do fragmento, atributos,
// precisão média) com o tempo de compilação. A mesma sonda roda na página de teste da prévia (?painel=1).
//   node ferramentas/sonda-gpu.mjs [--pasta previa|<pasta>] [--cena estresse] [--perfil media] [--json <arquivo>]
// Código 1 se a página falhar ou algum programa passar da guarda.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contarPrograma } from '../fonte/render/motor/capacidades.js';

function lerArgs(argv) {
  const o = { pasta: 'previa', cena: 'estresse', perfil: 'media', json: null, tam: '1376x768', teto: 300 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--pasta') o.pasta = v();
    else if (k === '--cena') o.cena = v();
    else if (k === '--perfil') o.perfil = v();
    else if (k === '--json') o.json = v();
    else if (k === '--tam') o.tam = v();
    else if (k === '--teto') o.teto = +v();
    else throw new Error(`opção desconhecida: ${k}`);
  }
  return o;
}

export async function sondar(o) {
  const { servir, pastaDe, abrirChromium } = await import('./testar.mjs');
  const srv = servir(pastaDe(o.pasta));
  const browser = await abrirChromium();
  const [W, H] = o.tam.split('x').map(Number);
  try {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    const t0 = Date.now();
    await page.goto(`http://localhost:${srv.porta}/index.html?cena=${o.cena}&q=${o.perfil}&pr=1&sonda=1`);
    await page.waitForFunction(() => window.__pronto === true, null, { timeout: o.teto * 1000, polling: 250 });
    const lido = await page.evaluate(() => {
      const c = window.__held?.R?._ctx;
      if (!c) return null;
      return {
        sonda: c.capac.sonda,
        perfil: c.perfil.id,
        invertida: c.capac.invertida,
        programas: c.capac.programas.lista.map((p) => ({ nome: p.nome, msCompilar: p.msCompilar, link: p.link, vs: p.vs, fs: p.fs })),
      };
    });
    await ctx.close();
    if (!lido) throw new Error('a página não expôs o render (window.__held.R._ctx)');
    const programas = lido.programas.map((p) => {
      const c = p.vs && p.fs ? contarPrograma(p.vs, p.fs) : { amostradores: null, varyings: null, uniformesF: null, atributos: null, falhas: ['sem as fontes'] };
      return { nome: p.nome, msCompilar: p.msCompilar, link: p.link, amostradores: c.amostradores, varyings: c.varyings, uniformesF: c.uniformesF, atributos: c.atributos, falhas: c.falhas };
    });
    return { ms: Date.now() - t0, cena: o.cena, perfil: lido.perfil, invertida: lido.invertida, sonda: lido.sonda, programas, erros };
  } finally {
    await browser.close();
    srv.fechar();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let r;
  try {
    r = await sondar(lerArgs(process.argv.slice(2)));
  } catch (e) {
    console.error('sonda-gpu: ' + e.message);
    process.exit(1);
  }
  const o = lerArgs(process.argv.slice(2));
  if (o.json) writeFileSync(o.json, JSON.stringify(r, null, 1));
  const S = r.sonda;
  const L = S.limites;
  console.log(`GPU: ${S.gpu}`);
  console.log(`${S.versao} · ${S.glsl} · perfil ${r.perfil} · profundidade invertida: ${r.invertida ? 'sim' : 'não'}`);
  console.log(`limites: amostradores F ${L.amostradoresF} V ${L.amostradoresV} · varyings ${L.varyings} · uniformes F ${L.uniformesF} V ${L.uniformesV} · atributos ${L.atributos} · textura ${L.textura} · MSAA ${L.amostras}`);
  console.log(`tem: ${Object.entries(S.tem).filter(([, v]) => v).map(([k]) => k).join(', ')}`);
  let ruins = 0;
  for (const p of r.programas) {
    const f = p.falhas?.length ? `  FALHA: ${p.falhas.join('; ')}` : '';
    if (f || p.link === false) ruins++;
    console.log(`  ${p.nome.padEnd(28)} ${String(p.msCompilar ?? '?').padStart(7)} ms · amostradores ${p.amostradores?.v ?? '?'}/${p.amostradores?.f ?? '?'} · varyings ${p.varyings ?? '?'} · uniformes F ${p.uniformesF ?? '?'} · atributos ${p.atributos ?? '?'}${f}`);
  }
  for (const e of r.erros) console.log('erro de página: ' + e);
  console.log(ruins || r.erros.length ? `sonda com falhas (${ruins} programas)` : `sonda ok (${r.programas.length} programas)`);
  process.exit(ruins || r.erros.length ? 1 : 0);
}
