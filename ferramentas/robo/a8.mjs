// A8 (robô no navegador; C1a): abre o jogo montado no Chromium de teste com ferramentas/robo-navegador.js, que joga
// pela partida até o tique 1.800 a 4x, e confere no Node: marco 1, erros [], nenhuma linha 'error:' no console e o
// hash igual ao da reprodução do mesmo livro numa simulação nova (D17). Imprime o relatório com a velocidade efetiva.
// Uso: node ferramentas/robo/a8.mjs [--pasta previa|<pasta montada>] [--q leve] [--tam 480x270] [--json arquivo]
//      (480 x 270 por padrão: no Chromium de teste, sem GPU, 960 x 540 dá 0,9 tique por segundo e não chega ao tique
//      1.800 no teto de 15 min reais)
//      node ferramentas/robo/a8.mjs --node   (o mesmo robô no Node, sem navegador: cada espera dele roda 4 tiques; serve
//                                             para conferir a estratégia em segundos)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testar } from '../testar.mjs';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { reproduzir } from '../../fonte/sim/livro.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function lerArgs(argv) {
  const o = { pasta: 'previa', q: 'leve', tam: '480x270', json: null, semente: 'a8', node: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--pasta') o.pasta = argv[++i];
    else if (k === '--q') o.q = argv[++i];
    else if (k === '--tam') o.tam = argv[++i];
    else if (k === '--json') o.json = argv[++i];
    else if (k === '--semente') o.semente = argv[++i];
    else if (k === '--node') o.node = true;
  }
  return o;
}

/** O robô do navegador no Node: window.__held com a simulação e setTimeout que roda tiques (4 por 100 ms, como a 4x). */
export async function rodarNoNode({ semente = 'a8' } = {}) {
  const sim = criarSimulacao({ semente });
  const antes = { window: globalThis.window, setTimeout: globalThis.setTimeout };
  const st = globalThis.setTimeout;
  globalThis.window = { __held: { sim, app: { velocidadeEfetiva: null } } };
  globalThis.setTimeout = (fn, ms) => {
    sim.rodar(Math.max(1, Math.round(ms / 25)), { sincrono: true });
    return st(fn, 0);
  };
  try {
    return await (0, eval)(readFileSync(join(RAIZ, 'ferramentas/robo-navegador.js'), 'utf8'));
  } finally {
    globalThis.window = antes.window;
    globalThis.setTimeout = antes.setTimeout;
  }
}

/** Roda o A8 e devolve { ok, falhas, relatorio }. */
export async function rodarA8(op = {}) {
  const o = { ...lerArgs([]), ...op };
  const { out, logs } = await testar({
    pasta: o.pasta, pagina: 'index.html', saida: null, consulta: `q=${o.q}&semente=${encodeURIComponent(o.semente)}`, tam: o.tam,
    espera: 0, escala: 1, toque: false, webgpu: false, semClip: false, teto: 240,
    script: join(RAIZ, 'ferramentas/robo-navegador.js'), json: null,
  });
  const r = out.resultado ?? {};
  const falhas = [...(r.falhas ?? [])];
  if (!out.pronto) falhas.push('a página não ficou pronta');
  const linhasErro = logs.filter((l) => /^error:|^ERRO:/.test(l));
  if (linhasErro.length) falhas.push(`${linhasErro.length} linha(s) de erro no console: ${linhasErro.slice(0, 3).join(' | ')}`);
  // o mesmo livro numa simulação nova do Node dá o mesmo hash no mesmo tique
  let hashNode = null;
  if (Number.isFinite(r.tique) && Array.isArray(r.livro)) {
    const sim = criarSimulacao({ semente: r.semente ?? o.semente });
    const rep = reproduzir(sim, r.livro, r.tique);
    hashNode = sim.q.hash();
    if (hashNode !== r.hash) falhas.push(`hash do navegador ${r.hash} e do Node ${hashNode} (${rep.aplicados} comandos reproduzidos)`);
  } else falhas.push('o robô não devolveu tique e livro');
  const relatorio = {
    tique: r.tique, marco: r.marco, xp: r.xp, populacao: r.populacao, caixa: r.caixa, nErros: r.nErros, erros: r.erros,
    comandos: r.livro?.length ?? 0, feitos: r.feitos, recusas: r.recusas, hash: r.hash, hashNode,
    minutosReais: r.msReais ? Math.round(r.msReais / 600) / 100 : null, velocidadeEfetiva: r.velocidadeEfetiva,
    velocidadeEfetivaApp: r.velocidadeEfetivaApp, pagina: out.ms,
  };
  return { ok: falhas.length === 0, falhas, relatorio, logs };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const o = lerArgs(process.argv.slice(2));
  if (o.node) {
    const r = await rodarNoNode(o);
    console.log(`A8 no Node: tique ${r.tique}, marco ${r.marco} (${Math.round(r.xp)} XP), ${r.populacao} moradores, caixa ${r.caixa}, ${r.livro.length} comandos; feitos: ${r.feitos.join(', ')}; recusas: ${JSON.stringify(r.recusas)}`);
    console.log(r.ok ? 'A8 no Node ok' : `A8 no Node FALHOU: ${r.falhas.join('; ')}`);
    process.exit(r.ok ? 0 : 1);
  }
  const { ok, falhas, relatorio, logs } = await rodarA8(o);
  const R = relatorio;
  console.log(`A8: tique ${R.tique}, marco ${R.marco} (${R.xp} XP), ${R.populacao} moradores, caixa ${R.caixa}, ${R.comandos} comandos no livro`);
  console.log(`  ${R.minutosReais} min reais, velocidade efetiva ${R.velocidadeEfetiva} tiques/s (o laço mede ${R.velocidadeEfetivaApp}); hash ${R.hash} / Node ${R.hashNode}`);
  console.log(`  feitos: ${(R.feitos ?? []).join(', ')}; recusas: ${JSON.stringify(R.recusas ?? {})}`);
  console.log(ok ? 'A8 ok' : `A8 FALHOU: ${falhas.join('; ')}`);
  if (o.json) writeFileSync(o.json, JSON.stringify({ ok, falhas, relatorio, logs }, null, 1));
  process.exit(ok ? 0 : 1);
}
