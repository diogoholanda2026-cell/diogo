// Capturas de aceite da obra: cada modo (subir, caminho, plantio, caixas, terra, pavimento, draga, desmontar,
// replantar), a montagem do canteiro (0/400/800/1600 ms), o filme de uma etapa (5 a 98% e pronta), a aprovação
// (0/200/400/800/1200/2000 ms, de dia e à noite), 3 obras ao mesmo tempo e o canteiro de produção vivo.
// Uso: node ferramentas/cap-obra.mjs <pasta_saida> [grupos] [largura] [altura]
//   grupos: montagem, filme, aprovacao, modos, lineares, simultaneas, canteiro (padrão: todos)
// Serve app/ (rode antes `node ferramentas/montar.mjs`). O relógio das obras (obras.relogio) fica preso em
// instantes exatos, então as fotos saem no ponto certo mesmo com o WebGL por software (1 a 5 s por quadro).
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(raiz, 'app');
const [saida = '/tmp/cap-obra', gruposArg = 'montagem,filme,aprovacao,modos,lineares,simultaneas,canteiro', LW = '1000', LH = '450'] = process.argv.slice(2);
const grupos = new Set(gruposArg.split(','));
mkdirSync(saida, { recursive: true });
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };
const srv = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = join(app, p); if (!f.startsWith(app) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': tipos[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
}).listen(0);
const porta = srv.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const arqIndice = join(saida, 'indice.json'); const anterior = existsSync(arqIndice) ? JSON.parse(readFileSync(arqIndice, 'utf8')) : { indice: [] };
const indice = anterior.indice.slice(); const erros = [];
const SEM_ANIMACAO = '*,*::before,*::after{animation:none!important;transition:none!important}';

// funções que rodam na página (window.__cap)
const AJUDA = () => {
  const H = window.__held, J = H.J, C = H.C, O = H.obras, R = H.rig; const esp = (ms) => new Promise((r) => setTimeout(r, ms));
  const quadros = async (n = 2) => { const q0 = O._quadro || 0; for (let i = 0; i < 600; i++) { await esp(100); if ((O._quadro || 0) - q0 >= n) return; } };
  const D = 1e8; // etapas longas: o progresso não anda durante a foto
  window.__cap = {
    base(o = {}) {
      J.S.cap = o.cap || 5; J.S.nivel = 30; J.S.xp = 70000; J.S.creditos = 99999;
      for (const k of o.feitas || []) J.S.etapas[k] = { estado: 'feita', entregue: {} };
      if (o.anel) J.S.modulos.anel.forEach((m, i) => (m.nivel = i < 5 ? 3 : 2));
      J._derivar(); C.sincronizar(); C.paineis.fechar(true); for (const s of ['.esq', '.capitulo', '.fala']) document.querySelectorAll(s).forEach((e) => (e.style.display = 'none'));
    },
    obra(key, p, fresca = false) { const ag = Date.now(); const ini = fresca ? ag : ag - p * D; J.S.etapas[key] = { estado: 'obra', entregue: {}, ini, fim: ini + D }; J._derivar(); C.sincronizar(); },
    modulo(f, i, p, para) { const ag = Date.now(); const m = J.S.modulos[f][i]; m.obra = { estado: 'obra', para: para ?? m.nivel + 1, ini: ag - p * D, fim: ag - p * D + D }; J._derivar(); C.sincronizar(); },
    progresso(key, p) { const st = J.S.etapas[key]; st.ini = Date.now() - p * D; st.fim = st.ini + D; },
    pronta(key) { const st = J.S.etapas[key]; st.fim = Date.now() - 10; J.tick(Date.now()); C.sincronizar(); },
    limpa() { for (const k of [...C.sites.keys()]) C._removerSite(k); for (const [k, st] of Object.entries(J.S.etapas)) if (st.estado === 'obra' || st.estado === 'pronta') delete J.S.etapas[k]; for (const a of Object.values(J.S.modulos)) for (const m of a) m.obra = null; J._derivar(); C.sincronizar(); },
    cam(x, z, dist, yaw, pitch = null) { R.anim = null; R.roll = 0; R.pitchFix = pitch; R.target.set(x, 0, z); R.dist = dist; R.yaw = yaw; R.tilt = 0; R.fov = 38; R.apply(); H.engine.shadowDirty = true; },
    foco(id, dist, yaw = 0.62, pitch = null) { const f = H.mundo.modelos[id].foco; this.cam(f.x, f.z, dist ?? f.dist, yaw, pitch); },
    relogio(ms) { O.relogio = (this._r0 ?? (this._r0 = performance.now())) + ms; },
    solta() { O.relogio = null; this._r0 = null; },
    zera() { this._r0 = performance.now() + 5000; O.relogio = this._r0; },
    luz(m) { H.env.setHora(m === 'noite' ? 22 : 11); H.engine.shadowDirty = true; }, // 'dia' (11 h) ou 'noite' (22 h), com o ciclo parado
    quadros,
    stats() { const e = H.engine.stats; return { calls: e.calls, tris: e.tris, sombras: O.stats.sombras, obras: O.sites.size }; },
  };
};

async function abre(q, W, H) {
  const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  pg.on('pageerror', (e) => erros.push(`${q}: ${e.message} | ${(e.stack || '').split('\n').slice(1, 3).join(' <- ')}`));
  await pg.goto(`http://localhost:${porta}/?${q}`);
  await pg.waitForFunction(() => window.__pronto === true, null, { timeout: 240000 });
  await pg.addStyleTag({ content: SEM_ANIMACAO });
  await pg.evaluate(AJUDA);
  await pg.evaluate(() => window.__cap.luz('dia')); // ciclo parado às 11 h: capturas repetíveis
  await pg.evaluate(() => window.__cap.quadros(6)); // aquecimento da sombra das obras
  return pg;
}
const run = (pg, f, ...a) => pg.evaluate(f, ...a);
async function foto(pg, nome, desc, n = 2) {
  await pg.evaluate((n) => window.__cap.quadros(n), n);
  const arq = join(saida, nome + '.png'); await pg.screenshot({ path: arq, timeout: 240000 });
  const st = await pg.evaluate(() => window.__cap.stats());
  indice.push({ arquivo: nome + '.png', desc, ...st }); console.log(nome, JSON.stringify(st));
}
const W = +LW, H = +LH;
try {
  const pg = await abre('teste=1&novo=1&q=media&pr=1', W, H);
  await run(pg, () => window.__cap.base({ cap: 5, feitas: ['lago.e1', 'sede.e1', 'sede.e2', 'pas_frente.e1', 'biblioteca.e1', 'praca.e1', 'anel.1'], anel: true }));
  if (grupos.has('montagem')) try { // canteiro nasce: estacas, postes em cascata, mastro telescópico, lança abre, caminhão chega
    await run(pg, () => { window.__cap.zera(); window.__cap.foco('biblioteca', 16.5); window.__cap.obra('biblioteca.e2', 0.0, true); });
    for (const ms of [0, 400, 800, 1600]) { await run(pg, (ms) => window.__cap.relogio(ms + 5000 - 5000), ms); await foto(pg, `a-montagem-${String(ms).padStart(4, '0')}`, `Montagem do canteiro da Biblioteca (etapa 2) aos ${ms} ms`); }
    await run(pg, () => { window.__cap.solta(); window.__cap.limpa(); });
  } catch (e) { erros.push('montagem: ' + e.message.split('\n').slice(0, 4).join(' | ')); }
  if (grupos.has('filme')) try { // o filme da etapa 2 da Biblioteca e a obra pronta
    await run(pg, () => { window.__cap.zera(); window.__cap.foco('biblioteca', 16.5); window.__cap.obra('biblioteca.e2', 0.05); });
    let r = 2000;
    // cada salto de progresso vira time-lapse (1,5 s no relógio da obra): 1 quadro para começar, depois +2 s
    for (const p of [0.05, 0.3, 0.55, 0.8, 0.98]) { r += 500; await run(pg, ([p, r]) => { window.__cap.progresso('biblioteca.e2', p); window.__cap.relogio(r); }, [p, r]); await pg.evaluate(() => window.__cap.quadros(2)); r += 2500; await run(pg, (r) => window.__cap.relogio(r), r); await foto(pg, `b-filme-${String(Math.round(p * 100)).padStart(2, '0')}`, `Biblioteca etapa 2 com ${Math.round(p * 100)}%`, 3); }
    await run(pg, () => window.__cap.pronta('biblioteca.e2')); r += 1600; await run(pg, (r) => window.__cap.relogio(r), r); await foto(pg, 'b-pronta-a', 'Pronta: grua estacionada, turma parada olhando, varredura verde', 3);
    r += 500; await run(pg, (r) => window.__cap.relogio(r), r); await foto(pg, 'b-pronta-b', 'Pronta: varredura verde subindo (0,5 s depois)', 2);
    await run(pg, () => { const a = window.__held.obras.ancora('e:biblioteca.e2'); window.__ancora = a; });
  } catch (e) { erros.push('filme: ' + e.message.split('\n').slice(0, 4).join(' | ')); }
  if (grupos.has('aprovacao')) try { // aprovação coreografada (dia) e fogos (noite)
    for (const luz of ['dia', 'noite']) {
      await run(pg, (luz) => { window.__cap.limpa(); window.__cap.luz(luz); window.__cap.zera(); window.__cap.foco('biblioteca', 16.5); window.__cap.obra('biblioteca.e2', 0.98); }, luz);
      await run(pg, () => window.__cap.relogio(4000)); await pg.evaluate(() => window.__cap.quadros(2));
      await run(pg, () => window.__cap.pronta('biblioteca.e2')); await run(pg, () => window.__cap.relogio(6000)); await pg.evaluate(() => window.__cap.quadros(2));
      await run(pg, () => { window.__cap.relogio(10000); window.__held.C.aprovarEtapa('biblioteca.e2'); }); await pg.evaluate(() => window.__cap.quadros(1));
      const tempos = luz === 'noite' ? [900, 1200, 1500, 2000] : [0, 200, 400, 800, 1200, 2000];
      for (const ms of tempos) { await run(pg, (ms) => window.__cap.relogio(10000 + ms), ms); await foto(pg, `c-aprovacao-${luz}-${String(ms).padStart(4, '0')}`, `Aprovação (${luz}) aos ${ms} ms`); }
      await run(pg, () => window.__cap.relogio(16000)); await pg.evaluate(() => window.__cap.quadros(3));
    }
    await run(pg, () => { window.__cap.luz('dia'); window.__cap.solta(); });
  } catch (e) { erros.push('aprovacao: ' + e.message.split('\n').slice(0, 4).join(' | ')); }
  if (grupos.has('modos')) try { // plantio, caixas, terra, pavimento, draga, módulo de fita
    const cenas = [
      ['d-modulo-anel', 'Módulo 5 do Anel subindo ao nível 4 (andaime na fita, turma na laje)', () => { window.__cap.modulo('anel', 5, 0.45, 4); const c = window.__held.mundo.faixas.anel.centro(5); window.__cap.cam(c[0], c[1], 9, 0.4, 0.62); }],
      ['d-pavimento-30', 'Praça: terraplenagem com escavadeira na frente de corte (30%)', () => { delete window.__held.J.S.etapas['praca.e1']; window.__cap.obra('praca.e1', 0.3); window.__cap.foco('praca', 13, 0.45); }],
      ['d-pavimento-75', 'Praça: piso revelado do centro para fora (75%)', () => { window.__cap.progresso('praca.e1', 0.75); }],
      ['d-terra-campo', 'Terraplenagem do campo (corte vertical e escavadeira, 50%)', () => { window.__cap.obra('campo.e1', 0.5); window.__cap.foco('campo', 10, 0.5); }],
      ['d-plantio-praca', 'Palmeiras, bancos e luzes aparecendo um a um (50%)', () => { window.__cap.obra('praca.e3', 0.5); window.__cap.foco('praca', 12, 0.45); }],
      ['d-caixas-gorilas', 'Família de gorilas: caixas de transporte chegando (60%)', () => { for (const k of ['gorilas.e1', 'gorilas.e2', 'gorilas.e3']) window.__held.J.S.etapas[k] = { estado: 'feita', entregue: {} }; window.__cap.obra('gorilas.e4', 0.6); window.__cap.foco('gorilas', 7, 0.5); }],
      ['d-draga-10', 'Desassoreamento: draga no lago turvo (10%)', () => { delete window.__held.J.S.etapas['lago.e1']; window.__held.J._derivar(); window.__cap.obra('lago.e1', 0.1); window.__cap.cam(-1, -7, 17, 0.35); }],
      ['d-draga-50', 'Desassoreamento (50%): monte de lodo crescendo, nível subindo', () => window.__cap.progresso('lago.e1', 0.5)],
      ['d-draga-90', 'Desassoreamento (90%): água clareando', () => window.__cap.progresso('lago.e1', 0.9)],
    ];
    await run(pg, () => { window.__cap.limpa(); window.__cap.solta(); });
    for (const [nome, desc, f] of cenas) { await run(pg, f); await pg.evaluate(() => new Promise((r) => setTimeout(r, 1800))); await foto(pg, nome, desc, 3); if (nome === 'd-caixas-gorilas') { await run(pg, () => { window.__cap.zera(); window.__cap.pronta('gorilas.e4'); }); await pg.evaluate(() => window.__cap.quadros(2)); await run(pg, () => { window.__cap.relogio(9000); window.__held.C.aprovarEtapa('gorilas.e4'); }); await pg.evaluate(() => window.__cap.quadros(1)); for (const ms of [1400, 1700, 2100, 2800]) { await run(pg, (ms) => window.__cap.relogio(9000 + ms), ms); await foto(pg, `d-caixas-abrindo-${ms}`, `Gorilas saindo das caixas aos ${ms} ms da aprovação`); } await run(pg, () => window.__cap.solta()); } }
    await run(pg, () => window.__cap.limpa());
  } catch (e) { erros.push('modos: ' + e.message.split('\n').slice(0, 4).join(' | ')); }
  if (grupos.has('lineares')) try { // caminhos e passarelas avançam do começo ao fim
    await run(pg, () => { delete window.__held.J.S.etapas['pas_frente.e1']; window.__held.J._derivar(); window.__held.C.sincronizar(); });
    for (const p of [0.1, 0.5, 0.9]) { await run(pg, (p) => { if (p === 0.1) { window.__cap.obra('pas_frente.e1', p); const o = window.__held.obras.sites.get('e:pas_frente.e1'); const c = o.box.getCenter(new window.__held.THREE.Vector3()); window.__cap.cam(c.x, c.z, 10, 0.45, 1.1); } else window.__cap.progresso('pas_frente.e1', p); }, p); await foto(pg, `e-caminho-frente-${Math.round(p * 100)}`, `Caminho da Frente com ${Math.round(p * 100)}% (frente de obra andando, rolo e fôrma)`, 3); }
    await run(pg, () => { window.__cap.limpa(); window.__cap.obra('pas_bulevar.e1', 0.5); window.__cap.cam(3.5, 13.5, 11, 0.45); }); await foto(pg, 'e-passarela-bulevar-50', 'Bulevar Verde a 50%: pilares à frente, tabuleiro, guarda-corpo atrás', 3);
    await run(pg, () => { window.__cap.limpa(); for (const k of ['ciencias.e1', 'biblioteca.e2']) window.__held.J.S.etapas[k] = { estado: 'feita', entregue: {} }; window.__cap.obra('ponteCoberta.e2', 0.5); window.__cap.foco('ponteCoberta', 11); }); await foto(pg, 'e-ponte-coberta-50', 'Ponte coberta: tubo de vidro avançando com a grua', 3);
    await run(pg, () => window.__cap.limpa());
  } catch (e) { erros.push('lineares: ' + e.message.split('\n').slice(0, 4).join(' | ')); }
  if (grupos.has('simultaneas')) try { // custo: 3 obras ao mesmo tempo na mesma vista
    await run(pg, () => { window.__cap.limpa(); window.__cap.cam(4, 6, 40, 0.5); }); await foto(pg, 'f-sem-obra', 'Vista geral sem obra (referência de chamadas)', 3);
    await run(pg, () => { window.__cap.obra('biblioteca.e2', 0.4); window.__cap.modulo('anel', 5, 0.4, 4); window.__cap.obra('crd.e1', 0.4); }); await foto(pg, 'f-tres-obras', '3 obras ao mesmo tempo (Biblioteca, módulo do Anel, CRD): chamadas', 4);
    await run(pg, () => window.__cap.limpa());
  } catch (e) { erros.push('simultaneas: ' + e.message.split('\n').slice(0, 4).join(' | ')); }
  if (grupos.has('canteiro')) try { // canteiro de produção vivo, desmontagem e replantio
    await run(pg, () => { const H = window.__held, J = H.J; for (const id of ['usina2', 'carpintaria', 'concreto', 'serralheria', 'vidracaria', 'eletrica', 'horto']) J.S.predios[id].ok = true;
      const ag = Date.now(); J.S.predios.usina1.slots = [{ item: 'madeira', ini: ag, fim: ag + 1e7 }, null, null]; J.S.predios.usina2.slots = [{ item: 'brita', ini: ag - 10, fim: ag - 5 }, { item: 'brita', ini: ag - 10, fim: ag - 5 }, { item: 'aco', ini: ag - 10, fim: ag - 5 }];
      for (const o of ['carpintaria', 'concreto', 'serralheria', 'eletrica', 'horto']) J.S.predios[o].fila = [{ item: o === 'carpintaria' ? 'viga' : o === 'concreto' ? 'cimento' : o === 'serralheria' ? 'perfil' : o === 'eletrica' ? 'fiacao' : 'grama', ini: ag, fim: ag + 1e7 }];
      J.S.predios.vidracaria.prontos = Array(9).fill('painel'); J._derivar(); H.C.sincronizar(); H.C._repasseProducao?.(); window.__cap.cam(-25.2, 15, 13, 0.4); });
    await foto(pg, 'g-canteiro-vivo', 'Canteiro produzindo: fumaça, esteira, serra, faíscas, luz nas portas; bandeja cheia com luz vermelha', 4);
    await run(pg, () => window.__cap.luz('noite')); await foto(pg, 'g-canteiro-vivo-noite', 'Canteiro produzindo à noite', 3); await run(pg, () => window.__cap.luz('dia'));
    await run(pg, () => { for (const k of Object.keys(window.__held.J.S.etapas)) if (!window.__held.J.S.etapas[k].estado) delete window.__held.J.S.etapas[k]; window.__cap.cam(-25.5, 15, 16, 0.4); });
    for (const p of [0.1, 0.5, 0.9]) { await run(pg, (p) => { if (p === 0.1) window.__cap.obra('reflorestar.e0', p); else window.__cap.progresso('reflorestar.e0', p); }, p); await foto(pg, `g-desmontar-${Math.round(p * 100)}`, `Desmontar o canteiro com ${Math.round(p * 100)}% (prédios descem um a um)`, 3); }
    await run(pg, () => { window.__cap.pronta('reflorestar.e0'); window.__held.C.aprovarEtapa('reflorestar.e0'); }); await pg.evaluate(() => window.__cap.quadros(4));
    await run(pg, () => new Promise((r) => setTimeout(r, 4000))); await pg.evaluate(() => window.__cap.quadros(3));
    for (const p of [0.1, 0.5, 0.9]) { await run(pg, (p) => { if (p === 0.1) window.__cap.obra('reflorestar.e1', p); else window.__cap.progresso('reflorestar.e1', p); }, p); await foto(pg, `g-replantar-${Math.round(p * 100)}`, `Replantar a mata com ${Math.round(p * 100)}% (mudas em linhas crescendo)`, 3); }
  } catch (e) { erros.push('canteiro: ' + e.message.split('\n').slice(0, 4).join(' | ')); }
  const anc = await pg.evaluate(() => window.__ancora || null); if (anc) indice.push({ arquivo: '-', desc: 'obras.ancora(e:biblioteca.e2) na obra pronta', ancora: anc });
  await pg.close();
} catch (e) { erros.push('cap-obra: ' + e.message); }
const vistos = new Set(); const unico = indice.reverse().filter((x) => x.arquivo === '-' || (!vistos.has(x.arquivo) && vistos.add(x.arquivo))).reverse();
writeFileSync(arqIndice, JSON.stringify({ indice: unico, erros }, null, 1));
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros');
await browser.close(); srv.close();
