// Vitrine: captura um conjunto fixo de telas do jogo para avaliar e comparar versões.
// Uso: node ferramentas/vitrine.mjs <pasta_saida> [grupos]
//   grupos (separados por vírgula): composicao, closes, obra, celular  (padrão: todos)
// Serve app/ (rode antes `node ferramentas/montar.mjs`) e usa o Chromium com WebGL por software.
// As animações de CSS são zeradas (no SwiftShader elas não terminam a tempo), menos no filme da
// aprovação (o08/o09). Os closes miram o foco de cada modelo (mundo.modelos[id].foco e o centro das
// fitas), com os números antigos como reserva; antes de cada foto a vitrine espera a refusão adiada e o
// time-lapse da obra terminarem (quando o jogo expõe mundo.refusaoPendente e obras.timelapseAtivo).
// O ciclo de dia e noite fica parado às 11 h (env.setHora) para as fotos se repetirem entre versões; a
// composição também sai em quatro horas (7, 12, 18 e 22 h) na vista geral de abertura do jogo.
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
const arqIndice = join(saida, 'indice.json'); const anterior = existsSync(arqIndice) ? JSON.parse(readFileSync(arqIndice, 'utf8')) : { indice: [] };
const indice = anterior.indice.slice(); const erros = [];
const espera = (pg, ms) => pg.waitForTimeout(ms);
// sem animação nenhuma (e não só curta): uma animação que começa no quadro da foto sairia no estado inicial
const SEM_ANIMACAO = '*,*::before,*::after{animation:none!important;transition:none!important}';
// espera o mundo assentar: refusão adiada e time-lapse da obra (se o jogo os expuser)
const assenta = (pg) => pg.waitForFunction(() => { const H = window.__held; return !H || (!H.mundo?.refusaoPendente && !H.obras?.timelapseAtivo); }, null, { timeout: 60000 }).catch(() => {});
async function abre(q, W, H, movel = false, hora = 11) {
  const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, ...(movel ? { isMobile: true, hasTouch: true } : {}) });
  pg.on('pageerror', (e) => erros.push(`${q}: ${e.message} | ${(e.stack || '').split('\n').slice(1, 3).join(' <- ')}`));
  await pg.goto(`http://localhost:${porta}/?${q}`);
  await pg.waitForFunction(() => window.__pronto === true, null, { timeout: 240000 });
  pg._semAnim = await pg.addStyleTag({ content: SEM_ANIMACAO });
  await pg.evaluate((h) => window.__held.env.setHora?.(h), hora); // ciclo parado: fotos repetíveis
  return pg;
}
const hora = (pg, h) => pg.evaluate((h) => { window.__held.env.setHora?.(h); window.__held.engine.shadowDirty = true; }, h);
async function foto(pg, nome, desc, ms = 1200, assentar = true) {
  await espera(pg, ms); if (assentar) await assenta(pg); const arq = join(saida, nome + '.png'); await pg.screenshot({ path: arq, timeout: 240000 });
  const st = await pg.evaluate(() => { const e = window.__held.engine; return { calls: e.stats.calls, tris: e.stats.tris }; });
  indice.push({ arquivo: nome + '.png', desc, ...st, ...(pg._alvo ? { alvo: pg._alvo } : {}) }); console.log(nome, JSON.stringify(st), pg._alvo ? JSON.stringify(pg._alvo) : '');
}
// câmera livre: alvo (x,z), distância, giro, inclinação fixa opcional (rad), campo de visão
// alvo: [x, z] fixo, ou { modelo } / { faixa, i } lido do mundo (com [x, z] de reserva; i: 'perto' escolhe o
// módulo da fita mais perto da reserva, o mesmo quadro de antes enquanto a planta não muda). O alvo usado
// vai para o indice.json (campo alvo: x, z e a origem), para a comparação entre versões saber se o quadro mudou
const camera = async (pg, [x, z, dist, yaw, pitch, fov = 38], alvo = null) => { pg._alvo = await pg.evaluate(([x, z, dist, yaw, pitch, fov, alvo]) => {
  const H = window.__held, r = H.rig, W = H.mundo; let de = 'fixo';
  if (alvo?.modelo) { const f = W?.modelos?.[alvo.modelo]?.foco; if (f && isFinite(f.x) && isFinite(f.z)) { x = f.x; z = f.z; de = 'modelo:' + alvo.modelo; } }
  if (alvo?.faixa) {
    const F = W?.faixas?.[alvo.faixa]; let i = alvo.i ?? 0;
    if (i === 'perto' && F?.mods?.length) { let d = 1e9; F.mods.forEach((m, k) => { const c = F.centro(k); const dd = Math.hypot(c[0] - x, (c[2] ?? c[1]) - z); if (dd < d) { d = dd; i = k; } }); }
    const c = typeof i === 'number' ? F?.centro?.(i) : null; if (c && isFinite(c[0])) { x = c[0]; z = c[2] ?? c[1]; de = 'faixa:' + alvo.faixa + ':' + i; }
  }
  if (alvo?.de) de = alvo.de;
  r.roll = 0; r.pitchFix = pitch ?? null; r.target.set(x, 0, z); r.dist = dist; r.yaw = yaw; r.tilt = 0; r.fov = fov; r.apply(); H.engine.shadowDirty = true;
  return { x: +x.toFixed(2), z: +z.toFixed(2), de };
}, [x, z, dist, yaw, pitch, fov, alvo]); };

try {
  if (grupos.has('composicao')) try {
    const pg = await abre('vista=foto&tudo=1&q=alta&pr=1', 1376, 768);
    await pg.evaluate(() => { document.getElementById('ui').style.display = 'none'; });
    // (c01 mantém o nome antigo: a luz de exposição e a mesa saíram do jogo; é o enquadramento da foto, de dia)
    await foto(pg, 'c01-foto-exposicao', 'Composição completa, enquadramento da foto (11 h), para comparar com a foto', 2500);
    await hora(pg, 22); await foto(pg, 'c02-foto-noite', 'Composição completa, enquadramento da foto, noite (22 h)', 3000);
    await hora(pg, 15); await foto(pg, 'c03-foto-dia', 'Composição completa, enquadramento da foto, tarde (15 h)', 3000);
    await hora(pg, 11);
    await camera(pg, [2, 2, 62, -0.55, 0.78, 36]); await foto(pg, 'c04-geral-outro-angulo', 'Composição completa vista do outro lado', 2000);
    await camera(pg, [4, 0, 44, 0.2, 1.35, 36]); await foto(pg, 'c05-planta-de-cima', 'Composição quase de cima (leitura da planta)', 2000);
    // o ciclo de dia e noite na vista geral de abertura (C.vistaGeral): amanhecer, meio-dia, pôr do sol e noite
    await pg.evaluate(() => window.__held.C.vistaGeral?.(false)); pg._alvo = { de: 'vistaGeral' };
    for (const [n, h, d] of [['c06-geral-07h', 7, 'amanhecer'], ['c07-geral-12h', 12, 'meio-dia'], ['c08-geral-18h', 18, 'pôr do sol'], ['c09-geral-22h', 22, 'noite']]) { await hora(pg, h); await foto(pg, n, `Composição completa na vista geral, ${d} (${h} h)`, 3000); }
    await pg.close();
  } catch (e) { erros.push('grupo: ' + e.message.split('\n')[0]); }
  if (grupos.has('closes')) try {
    const pg = await abre('vista=foto&tudo=1&q=alta&pr=1', 1200, 675);
    await pg.evaluate(() => { document.getElementById('ui').style.display = 'none'; });
    const closes = [
      ['k01-anel-campus', 'Anel do Campus (edifício-fita em terraços)', [-9.6, 8.4, 16, 0.5, null], { faixa: 'anel', i: 'perto' }],
      ['k02-campus-universitario', 'Campus Universitário e faculdades', [-19.5, -10.8, 15, 0.45, null], { modelo: 'gramadoUni' }],
      ['k03-sede-holding', 'Sede da Holding e pátio', [4.8, -14.2, 15, 0.5, null], { modelo: 'sedePatio' }],
      ['k04-biblioteca', 'Biblioteca Central com dossel', [13.4, 7.9, 15, 0.5, null], { modelo: 'biblioteca' }],
      ['k05-faculdade-ciencias-lago', 'Faculdade de Ciências e lago central', [-5.5, -1.4, 14, 0.5, null], { modelo: 'ciencias' }],
      ['k06-praca', 'Praça Central', [4.4, 15.6, 12, 0.45, null], { modelo: 'praca' }],
      ['k07-acelerador', 'Acelerador de partículas em corte', [14.3, 17.4, 8, 0.5, null], { modelo: 'acelerador' }],
      ['k08-bioma', 'Bioma aquático (cúpula)', [23.0, 4.6, 10, 0.5, null], { modelo: 'bioma' }],
      ['k09-santuario-savana', 'Santuário e savana', [18.8, -9.2, 17, 0.5, null], null], // entre o Santuário e a savana (abaixo)
      ['k10-vila-anfiteatro', 'Vila Estudantil e anfiteatro', [22.2, 13.3, 11, 0.5, null], { modelo: 'anfiteatro' }],
      ['k11-gorilas', 'Recinto dos gorilas', [26.2, 16.6, 9, 0.5, null], { modelo: 'gorilas' }],
      ['k12-escola-campo', 'Escola, campo de futebol', [-15.2, 9.6, 13, 0.45, null], { modelo: 'escola' }],
      ['k13-rua-nivel-baixo', 'Vista baixa, quase no chão, pelo bulevar', [3.0, 6.0, 7, 0.9, 0.3, 45]],
      ['k14-rua-anel', 'Vista baixa junto ao Anel do Campus', [-6.0, 12.0, 6, 0.3, 0.28, 45]],
    ];
    const meio = await pg.evaluate(() => { const W = window.__held.mundo, a = W?.modelos?.santuarioInt?.foco, b = W?.modelos?.savana?.foco; return a && b ? [(a.x + b.x) / 2, (a.z + b.z) / 2] : null; });
    if (meio) { closes[8][2][0] = meio[0]; closes[8][2][1] = meio[1]; closes[8][3] = { de: 'meio:santuarioInt+savana' }; }
    for (const [nome, desc, cam, alvo] of closes) { await camera(pg, cam, alvo); await foto(pg, nome, desc, 1500); }
    await pg.close();
  } catch (e) { erros.push('grupo: ' + e.message.split('\n')[0]); }
  if (grupos.has('obra')) try {
    const pg = await abre('teste=1&novo=1&q=alta&pr=1&semTimelapse=1', 1232, 555);
    await pg.evaluate(() => { const H = window.__held, J = H.J, C = H.C; J.S.cap = 3; J.S.nivel = 16; J.S.xp = 9420; J.S.creditos = 9840;
      for (const k of ['lago.e1', 'sede.e1', 'sede.e2', 'pas_frente.e1', 'biblioteca.e1']) J.S.etapas[k] = { estado: 'feita', entregue: {} };
      J.S.modulos.anel.forEach((m, i) => (m.nivel = i < 5 ? 3 : 2)); J.S.modulos.anelBib.forEach((m) => (m.nivel = 1));
      const agora = Date.now(); J.S.etapas['biblioteca.e2'] = { estado: 'obra', entregue: {}, ini: agora - 600000, fim: agora + 500000 };
      J.S.modulos.anel[5].obra = { estado: 'obra', para: 3, ini: agora - 60000, fim: agora + 60000 };
      J._derivar(); C.sincronizar(); C.paineis.fechar(true); document.querySelector('.esq').style.display = 'none'; });
    await camera(pg, [13.0, 7.8, 16.5, 0.62, null], { modelo: 'biblioteca' }); await foto(pg, 'o01-biblioteca-andares', 'Biblioteca, etapa 2 em obra (esqueleto, andaimes, grua, operários)', 5000);
    // filme: a mesma obra de 5% a 100%
    for (const [i, p] of [[1, 0.05], [2, 0.3], [3, 0.55], [4, 0.8], [5, 0.98]]) {
      await pg.evaluate((p) => { const st = window.__held.J.S.etapas['biblioteca.e2']; const d = 1100000; st.ini = Date.now() - p * d; st.fim = st.ini + d; }, p);
      await foto(pg, `o0${i + 1}-filme-${Math.round(p * 100)}`, `Biblioteca etapa 2 com ${Math.round(p * 100)}% de progresso`, 1500);
    }
    // aprovação: andaimes caem
    await pg.evaluate(() => { const H = window.__held; const st = H.J.S.etapas['biblioteca.e2']; st.fim = Date.now() - 10; H.J.tick(Date.now()); H.C.sincronizar(); });
    await foto(pg, 'o07-pronta', 'Etapa pronta, balão de aprovar', 1500);
    // o filme da aprovação mede o tempo do carimbo: aqui as animações de CSS voltam a valer
    await pg.evaluate((el) => el.remove(), pg._semAnim);
    await pg.evaluate(() => window.__held.C.aprovarEtapa('biblioteca.e2'));
    await foto(pg, 'o08-aprovando-0_3s', 'Aprovação: 0,3 s (carimbo, andaimes caindo)', 300, false);
    await foto(pg, 'o09-aprovando-1s', 'Aprovação: cerca de 1 s', 700, false);
    pg._semAnim = await pg.addStyleTag({ content: SEM_ANIMACAO });
    await foto(pg, 'o10-aprovada', 'Depois da aprovação', 2500);
    // o módulo 5 do Anel está em obra (subindo do nível 2 ao 3): a câmera mira o centro dele
    await pg.evaluate(() => { const H = window.__held, m = H.J.S.modulos.anel[5]; const agora = Date.now(); m.obra = { estado: 'obra', para: 3, ini: agora - 90000, fim: agora + 120000 }; H.J._derivar?.(); H.C.sincronizar(); });
    await camera(pg, [-9.0, 13.0, 9, 0.4, 0.62], { faixa: 'anel', i: 5 }); await foto(pg, 'o11-modulo-anel', 'Módulo do Anel subindo de nível (andaime ao longo da fita)', 3000);
    // terraplenagem
    await pg.evaluate(() => { const H = window.__held, J = H.J; J.S.etapas['praca.e1'] = { estado: 'obra', entregue: {}, ini: Date.now() - 100000, fim: Date.now() + 100000 }; H.C.sincronizar(); });
    await camera(pg, [4.4, 15.6, 12, 0.45, null], { modelo: 'praca' }); await foto(pg, 'o12-terraplenagem-praca', 'Praça em terraplenagem (escavadeira, caminhão)', 3000);
    await pg.close();
  } catch (e) { erros.push('grupo: ' + e.message.split('\n')[0]); }
  if (grupos.has('celular')) try {
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
  } catch (e) { erros.push('grupo: ' + e.message.split('\n')[0]); }
} catch (e) { erros.push('vitrine: ' + e.message); }
const vistos = new Set(); const unico = indice.reverse().filter((x) => !vistos.has(x.arquivo) && vistos.add(x.arquivo)).reverse();
writeFileSync(arqIndice, JSON.stringify({ indice: unico, erros }, null, 1));
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros');
await browser.close(); srv.close();
