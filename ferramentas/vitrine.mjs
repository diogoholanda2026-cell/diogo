// Vitrine: captura um conjunto fixo de telas do jogo para avaliar e comparar versões.
// Uso: node ferramentas/vitrine.mjs <pasta_saida> [grupos]
//   grupos (separados por vírgula): composicao, closes, obra, celular  (padrão: todos)
// Serve app/ (rode antes `node ferramentas/montar.mjs`) e usa o Chromium com WebGL por software.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(raiz, 'app');
const [saida = '/tmp/vitrine', gruposArg = 'composicao,closes,obra,celular'] = process.argv.slice(2);
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
const indice = []; const erros = [];
const espera = (pg, ms) => pg.waitForTimeout(ms);
async function abre(q, W, H, movel = false) {
  const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, ...(movel ? { isMobile: true, hasTouch: true } : {}) });
  pg.on('pageerror', (e) => erros.push(`${q}: ${e.message} | ${(e.stack || '').split('\n').slice(1, 3).join(' <- ')}`));
  await pg.goto(`http://localhost:${porta}/?${q}`);
  await pg.waitForFunction(() => window.__pronto === true, null, { timeout: 240000 });
  return pg;
}
async function foto(pg, nome, desc, ms = 1200) {
  await espera(pg, ms); const arq = join(saida, nome + '.png'); await pg.screenshot({ path: arq });
  const st = await pg.evaluate(() => { const e = window.__held.engine; return { calls: e.stats.calls, tris: e.stats.tris }; });
  indice.push({ arquivo: nome + '.png', desc, ...st }); console.log(nome, JSON.stringify(st));
}
// câmera livre: alvo (x,z), distância, giro, inclinação fixa opcional (rad), campo de visão
const camera = (pg, [x, z, dist, yaw, pitch, fov = 38]) => pg.evaluate(([x, z, dist, yaw, pitch, fov]) => {
  const H = window.__held, r = H.rig; r.roll = 0; r.pitchFix = pitch ?? null; r.target.set(x, 0, z); r.dist = dist; r.yaw = yaw; r.tilt = 0; r.fov = fov; r.apply(); H.engine.shadowDirty = true;
}, [x, z, dist, yaw, pitch, fov]);

try {
  if (grupos.has('composicao')) {
    const pg = await abre('vista=foto&tudo=1&q=alta&pr=1', 1376, 768);
    await pg.evaluate(() => { document.getElementById('ui').style.display = 'none'; });
    await foto(pg, 'c01-foto-exposicao', 'Composição completa, enquadramento da foto, luz de exposição', 2500);
    await pg.evaluate(() => window.__held.env.setMode('noite')); await foto(pg, 'c02-foto-noite', 'Composição completa, noite', 2000);
    await pg.evaluate(() => window.__held.env.setMode('dia')); await foto(pg, 'c03-foto-dia', 'Composição completa, dia', 2000);
    await pg.evaluate(() => window.__held.env.setMode('exposicao'));
    await camera(pg, [2, 2, 62, -0.55, 0.78, 36]); await foto(pg, 'c04-geral-outro-angulo', 'Composição completa vista do outro lado', 2000);
    await camera(pg, [4, 0, 44, 0.2, 1.35, 36]); await foto(pg, 'c05-planta-de-cima', 'Composição quase de cima (leitura da planta)', 2000);
    await pg.close();
  }
  if (grupos.has('closes')) {
    const pg = await abre('vista=foto&tudo=1&q=alta&pr=1', 1200, 675);
    await pg.evaluate(() => { document.getElementById('ui').style.display = 'none'; });
    const closes = [
      ['k01-anel-campus', 'Anel do Campus (edifício-fita em terraços)', [-9.6, 8.4, 16, 0.5, null]],
      ['k02-campus-universitario', 'Campus Universitário e faculdades', [-19.5, -10.8, 15, 0.45, null]],
      ['k03-sede-holding', 'Sede da Holding e pátio', [4.8, -14.2, 15, 0.5, null]],
      ['k04-biblioteca', 'Biblioteca Central com dossel', [13.4, 7.9, 15, 0.5, null]],
      ['k05-faculdade-ciencias-lago', 'Faculdade de Ciências e lago central', [-5.5, -1.4, 14, 0.5, null]],
      ['k06-praca', 'Praça Central', [4.4, 15.6, 12, 0.45, null]],
      ['k07-acelerador', 'Acelerador de partículas em corte', [14.3, 17.4, 8, 0.5, null]],
      ['k08-bioma', 'Bioma aquático (cúpula)', [23.0, 4.6, 10, 0.5, null]],
      ['k09-santuario-savana', 'Santuário e savana', [18.8, -9.2, 17, 0.5, null]],
      ['k10-vila-anfiteatro', 'Vila Estudantil e anfiteatro', [22.2, 13.3, 11, 0.5, null]],
      ['k11-gorilas', 'Recinto dos gorilas', [26.2, 16.6, 9, 0.5, null]],
      ['k12-escola-campo', 'Escola, campo de futebol', [-15.2, 9.6, 13, 0.45, null]],
      ['k13-rua-nivel-baixo', 'Vista baixa, quase no chão, pelo bulevar', [3.0, 6.0, 7, 0.9, 0.3, 45]],
      ['k14-rua-anel', 'Vista baixa junto ao Anel do Campus', [-6.0, 12.0, 6, 0.3, 0.28, 45]],
    ];
    for (const [nome, desc, cam] of closes) { await camera(pg, cam); await foto(pg, nome, desc, 1500); }
    await pg.close();
  }
  if (grupos.has('obra')) {
    const pg = await abre('teste=1&novo=1&q=alta&pr=1', 1232, 555);
    await pg.evaluate(() => { const H = window.__held, J = H.J, C = H.C; J.S.cap = 3; J.S.nivel = 16; J.S.xp = 9420; J.S.creditos = 9840;
      for (const k of ['lago.e1', 'sede.e1', 'sede.e2', 'pas_frente.e1', 'biblioteca.e1']) J.S.etapas[k] = { estado: 'feita', entregue: {} };
      J.S.modulos.anel.forEach((m, i) => (m.nivel = i < 5 ? 3 : 2)); J.S.modulos.anelBib.forEach((m) => (m.nivel = 1));
      const agora = Date.now(); J.S.etapas['biblioteca.e2'] = { estado: 'obra', entregue: {}, ini: agora - 600000, fim: agora + 500000 };
      J.S.modulos.anel[5].obra = { estado: 'obra', para: 3, ini: agora - 60000, fim: agora + 60000 };
      J._derivar(); C.sincronizar(); C.paineis.fechar(true); document.querySelector('.esq').style.display = 'none'; });
    await camera(pg, [13.0, 7.8, 16.5, 0.62, null]); await foto(pg, 'o01-biblioteca-andares', 'Biblioteca, etapa 2 em obra (esqueleto, andaimes, grua, operários)', 5000);
    // filme: a mesma obra de 5% a 100%
    for (const [i, p] of [[1, 0.05], [2, 0.3], [3, 0.55], [4, 0.8], [5, 0.98]]) {
      await pg.evaluate((p) => { const st = window.__held.J.S.etapas['biblioteca.e2']; const d = 1100000; st.ini = Date.now() - p * d; st.fim = st.ini + d; }, p);
      await foto(pg, `o0${i + 1}-filme-${Math.round(p * 100)}`, `Biblioteca etapa 2 com ${Math.round(p * 100)}% de progresso`, 1500);
    }
    // aprovação: andaimes caem
    await pg.evaluate(() => { const H = window.__held; const st = H.J.S.etapas['biblioteca.e2']; st.fim = Date.now() - 10; H.J.tick(Date.now()); H.C.sincronizar(); });
    await foto(pg, 'o07-pronta', 'Etapa pronta, balão de aprovar', 1500);
    await pg.evaluate(() => window.__held.C.aprovarEtapa('biblioteca.e2'));
    await foto(pg, 'o08-aprovando-0_3s', 'Aprovação: 0,3 s (carimbo, andaimes caindo)', 300);
    await foto(pg, 'o09-aprovando-1s', 'Aprovação: cerca de 1 s', 700);
    await foto(pg, 'o10-aprovada', 'Depois da aprovação', 2500);
    await camera(pg, [-9.0, 13.0, 11, 0.4, null]); await foto(pg, 'o11-modulo-anel', 'Módulo do Anel subindo de nível (andaime ao longo da fita)', 3000);
    // terraplenagem
    await pg.evaluate(() => { const H = window.__held, J = H.J; J.S.etapas['praca.e1'] = { estado: 'obra', entregue: {}, ini: Date.now() - 100000, fim: Date.now() + 100000 }; H.C.sincronizar(); });
    await camera(pg, [4.4, 15.6, 12, 0.45, null]); await foto(pg, 'o12-terraplenagem-praca', 'Praça em terraplenagem (escavadeira, caminhão)', 3000);
    await pg.close();
  }
  if (grupos.has('celular')) {
    const pg = await abre('teste=1&novo=1&q=media&pr=1', 986, 443, true);
    await foto(pg, 'm01-inicio', 'Celular 986x443: início do jogo com HUD', 2000);
    await pg.evaluate(() => { const H = window.__held, J = H.J, C = H.C; J.S.nivel = 9; J.S.xp = 1700; J.S.creditos = 12000; J.S.predios.carpintaria.ok = true; J.S.predios.concreto.ok = true; J.S.predios.usina2.ok = true;
      J.produzir('usina1', 'madeira'); J.produzir('usina1', 'brita'); J.produzir('usina1', 'aco'); J.S.predios.usina1.slots[0].fim = Date.now() - 10; J.S.itens.viga = 2; J.S.itens.cimento = 3; J._derivar(); C.sincronizar(); });
    await foto(pg, 'm02-canteiro-balões', 'Canteiro com balões de coleta e obras disponíveis', 2500);
    const paineis = [['m03-painel-usina', 'usina', 'usina1'], ['m04-painel-oficina', 'oficina', 'carpintaria'], ['m05-painel-almox', 'almox'], ['m06-painel-obras', 'obras'], ['m07-prancha', 'etapa', 'sede.e1'], ['m08-painel-modulo', 'modulo', ['anel', 0]], ['m09-painel-pedidos', 'pedidos'], ['m10-painel-producao', 'producao']];
    for (const [nome, t, arg] of paineis) { await pg.evaluate(([t, arg]) => { const C = window.__held.C; C.paineis.fechar(true); C.paineis.abrir(t, arg); }, [t, arg]); await foto(pg, nome, `Celular: painel ${t}`, 1200); }
    await pg.evaluate(() => { const C = window.__held.C; C.paineis.fechar(true); C.config(); }); await foto(pg, 'm11-configuracoes', 'Celular: configurações', 1000);
    await pg.evaluate(() => { document.querySelector('.veu')?.remove(); const C = window.__held.C; C.modalCapitulo(C.J.capitulo()); }); await foto(pg, 'm12-modal-capitulo', 'Celular: apresentação ao Conselho (fim de capítulo)', 1000);
    await pg.evaluate(() => { document.querySelector('.veu')?.remove(); window.__held.C._modalCap = false; window.__held.C.apreciar(true); }); await foto(pg, 'm13-apreciar', 'Celular: modo Apreciar', 1500);
    await pg.close();
  }
} catch (e) { erros.push('vitrine: ' + e.message); }
writeFileSync(join(saida, 'indice.json'), JSON.stringify({ indice, erros }, null, 1));
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros');
await browser.close(); srv.close();
