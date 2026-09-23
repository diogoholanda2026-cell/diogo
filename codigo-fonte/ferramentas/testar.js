// Teste de fumaça: abre arcologia-de-held.html num Chromium móvel (Playwright),
// exercita os fluxos principais e lista erros de execução.
// Uso: npm install playwright && node codigo-fonte/ferramentas/testar.js [caminho-do-chromium]
const { chromium, devices } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', '..', 'arcologia-de-held.html');
(async () => {
  const opts = process.argv[2] ? { executablePath: process.argv[2] } : {};
  const browser = await chromium.launch(opts);
  const ctx = await browser.newContext({ ...devices['Pixel 5'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|ERR_FILE|ERR_INTERNET|ERR_NAME/.test(m.text())) errors.push(m.text()); });
  await page.goto(FILE); await page.waitForTimeout(1500);
  const closeModal = () => page.evaluate(() => { for (let i = 0; i < 6; i++) { const b = document.querySelector('#mCard [data-close]'); if (b) b.click(); } });
  await closeModal();
  const r = await page.evaluate(() => {
    const h = window.__held; const S = h.S; const out = {};
    out.inicio = { nivel: S.level, construcoes: S.bld.length, pop: h.D.pop, felicidade: Math.round(h.D.joy * 100) };
    // produção
    const fab = S.bld.find(b => b.t === 'fab1'); h.queueItem(fab, 'ligas'); h.queueItem(fab, 'ligas');
    h.catchUp(120, false); out.coletados = h.collect(fab);
    // ruas e construção
    h.startRoads(); h.roadTool = 'draw'; for (let x = 16; x < 30; x++) h.roadApply(x, 27); h.endRoads();
    h.startPlace('zona'); h.setGhost(16, 25); out.ghostErro = h.ghost.err; h.confirmPlace(); h.endPlace();
    h.catchUp(30, false);
    // melhoria com cristais
    const z = S.bld.find(b => b.t === 'zona' && b.need); S.gems += 50; h.startUpgrade(z, true); h.catchUp(30, false);
    out.estagio = z.lvl;
    // recursos e sistemas
    S.credits += 100000; S.keys += 30; S.pecas += 10; h.addXP(5000);
    h.newCargo(); S.cargo.order.forEach(l => { S.items[l.k] = (S.items[l.k] || 0) + l.n; }); h.recalc();
    S.cargo.order.forEach((l, i) => h.fillCargo(i)); h.dispatchCargo(); out.cargas = S.stats.cargo;
    h.buyOffer(0); h.listDepot(0, 'ligas', 1); h.expandLand(); h.upgradeStore();
    out.terreno = S.land; out.armazem = h.D.cap;
    // salvar e carregar
    const a = h.serialize(); h.loadState(JSON.parse(JSON.stringify(a))); const b = h.serialize();
    out.salvamento = a.bld.length === b.bld.length && a.level === b.level && JSON.stringify(a.items) === JSON.stringify(b.items);
    h.catchUp(3600, true);
    out.fim = { nivel: S.level, pop: h.D.pop, impostosAcumulados: Math.round(S.taxAcc) };
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await page.waitForTimeout(500);
  console.log('erros de execução:', errors.length); for (const e of errors) console.log(' -', e);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FALHA', e); process.exit(1); });
