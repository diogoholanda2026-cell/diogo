// Sonda da GPU no Chromium de teste (D33, D44, 5.3): abre uma cena da montagem com ?sonda=1 (o vigia guarda as
// fontes), lê a sonda do render (limites, extensões, precisão, o que o aparelho tem) e conta cada programa
// compilado contra a guarda do Mali (amostradores por estágio, varyings, vetores de uniforme do fragmento, atributos,
// precisão média) com o tempo de compilação e o bloqueio da thread em cada ligação. Desde a PC1 (D66) também: o
// perfil que a escolha automática daria à placa e o motivo, o aquecimento, as compilações depois de pronto e a
// memória de vídeo estimada. A mesma sonda roda na página de teste da prévia (?painel=1).
//   node ferramentas/sonda-gpu.mjs [--pasta previa|<pasta>] [--cena estresse] [--perfil media] [--json <arquivo>]
// Código 1 se a página falhar ou algum programa passar da guarda.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contarPrograma } from '../fonte/render/motor/capacidades.js';
import { escolherPerfil } from '../fonte/render/motor/perfis.js';

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
    // o aquecimento dos programas (motor/quadro.js) termina uns segundos depois da carga
    await page.waitForFunction(() => { const a = window.__held?.R?.stats?.aquecimento; return !a || a.estado === 'pronto'; }, null, { timeout: 60000, polling: 250 }).catch(() => {});
    const lido = await page.evaluate(() => {
      const c = window.__held?.R?._ctx;
      if (!c) return null;
      const s = c.medidas?.stats ?? {};
      return {
        sonda: c.capac.sonda,
        perfil: c.perfil.id,
        invertida: c.capac.invertida,
        aquecimento: s.aquecimento ?? null,
        memoria: s.memoria ?? null,
        programas: c.capac.programas.lista.map((p) => ({ nome: p.nome, msCompilar: p.msCompilar, msBloqueio: p.msBloqueio, depois: !!p.depois, link: p.link, vs: p.vs, fs: p.fs })),
      };
    });
    await ctx.close();
    if (!lido) throw new Error('a página não expôs o render (window.__held.R._ctx)');
    const programas = lido.programas.map((p) => {
      const c = p.vs && p.fs ? contarPrograma(p.vs, p.fs) : { amostradores: null, varyings: null, uniformesF: null, atributos: null, falhas: ['sem as fontes'] };
      return { nome: p.nome, msCompilar: p.msCompilar, msBloqueio: p.msBloqueio, depois: p.depois, link: p.link, amostradores: c.amostradores, varyings: c.varyings, uniformesF: c.uniformesF, atributos: c.atributos, falhas: c.falhas };
    });
    const escolha = escolherPerfil({ gpu: lido.sonda?.gpu ?? '' });
    return { ms: Date.now() - t0, cena: o.cena, perfil: lido.perfil, escolha, invertida: lido.invertida, sonda: lido.sonda, aquecimento: lido.aquecimento, memoria: lido.memoria, programas, erros };
  } finally {
    await browser.close();
    srv.fechar();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let r;
  let o;
  try {
    o = lerArgs(process.argv.slice(2));
    r = await sondar(o);
  } catch (e) {
    console.error('sonda-gpu: ' + e.message);
    process.exit(1);
  }
  if (o.json) writeFileSync(o.json, JSON.stringify(r, null, 1));
  const S = r.sonda;
  const L = S.limites;
  console.log(`GPU: ${S.gpu}`);
  console.log(`escolha automática: ${r.escolha.id} (${r.escolha.motivo})`);
  console.log(`${S.versao} · ${S.glsl} · perfil ${r.perfil} · profundidade invertida: ${r.invertida ? 'sim' : 'não'}`);
  console.log(`limites: amostradores F ${L.amostradoresF} V ${L.amostradoresV} · varyings ${L.varyings} · uniformes F ${L.uniformesF} V ${L.uniformesV} · atributos ${L.atributos} · textura ${L.textura} · MSAA ${L.amostras}`);
  console.log(`tem: ${Object.entries(S.tem).filter(([, v]) => v).map(([k]) => k).join(', ')}`);
  let ruins = 0;
  for (const p of r.programas) {
    const f = p.falhas?.length ? `  FALHA: ${p.falhas.join('; ')}` : '';
    if (f || p.link === false) ruins++;
    console.log(`  ${p.nome.padEnd(28)} ${String(p.msCompilar ?? '?').padStart(7)} ms (bloqueio ${p.msBloqueio ?? '?'})${p.depois ? ' DEPOIS DE PRONTO' : ''} · amostradores ${p.amostradores?.v ?? '?'}/${p.amostradores?.f ?? '?'} · varyings ${p.varyings ?? '?'} · uniformes F ${p.uniformesF ?? '?'} · atributos ${p.atributos ?? '?'}${f}`);
  }
  const A = r.aquecimento;
  if (A) console.log(`aquecimento: ${A.estado}, ${A.programas} programas em ${A.ms} ms; compilações depois de pronto: ${r.programas.filter((p) => p.depois).length}`);
  const M = r.memoria;
  if (M?.videoMB) console.log(`memória de vídeo estimada: ${M.videoMB} MB (texturas ${M.texturasGpuMB}, alvos ${M.alvosMB}, buffers ${M.buffersMB}, tela ${M.telaMB})`);
  for (const e of r.erros) console.log('erro de página: ' + e);
  console.log(ruins || r.erros.length ? `sonda com falhas (${ruins} programas)` : `sonda ok (${r.programas.length} programas)`);
  process.exit(ruins || r.erros.length ? 1 : 0);
}
