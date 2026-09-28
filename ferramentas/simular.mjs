// Simulação sem navegador: testes, determinismo, robô e bancada do tique (PROJETO 3.2, A2, A3, A4 e A5).
//   node ferramentas/simular.mjs --testes [nome ...]
//       roda cada ferramentas/testes/*.teste.mjs num processo à parte (filtro opcional por parte do nome) e a guarda de
//       texto; imprime 'testes ok' ou as falhas, com código 1. Formato de um teste (qualquer um dos dois):
//       a) um módulo que roda sozinho (node ferramentas/testes/x.teste.mjs) e sai com código 0 ou 1; o mais simples é
//          node:test com node:assert/strict, que já sai com código 1 quando algo falha;
//       b) um módulo que exporta os testes: export const testes = [{ nome, fn }] (ou { nome: fn }, ou export default),
//          e o simular roda cada fn (async ou não); uma exceção é falha.
//   node ferramentas/simular.mjs --determinismo [--semente s] [--tiques n]
//       duas partidas iguais (roteiro de comandos do contrato, sorteado pela semente) dão o mesmo hash em 3 pontos;
//       salvar e carregar no meio dá o mesmo hash depois; reproduzir o livro numa simulação nova dá o hash do fim.
//   node ferramentas/simular.mjs --robo [--horas h] [--semente s] [--comprarTempo]
//       chama ferramentas/robo/robo-sim.mjs (da S3a) com os mesmos argumentos.
//   node ferramentas/simular.mjs --bancada [--estresse] [--tiques n]
//       tempo do tique no Node (p95, p99 e máximo), q.barra e mudancas.desde sobre a cidade sintética, com uma via
//       pedida a cada 10 tiques; --estresse usa 3 vezes os prédios. Código 1 fora das metas do A5.
//   node ferramentas/simular.mjs --bancada --grafica [opções da bancada.mjs]
//       repassa para a bancada gráfica (node ferramentas/bancada.mjs), que roda as cenas no Chromium.
// Variáveis: TETO_TESTE (s por teste, padrão 600), PARALELO (processos ao mesmo tempo, padrão 2).
import { spawn } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { guardar, relatorio } from './guarda-texto.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_TESTES = join(RAIZ, 'ferramentas/testes');

function lerArgs(argv) {
  const o = { modo: null, filtros: [], semente: null, tiques: null, horas: null, comprarTempo: false, estresse: false, resto: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (['--testes', '--determinismo', '--robo', '--bancada'].includes(k)) o.modo = k.slice(2);
    else if (k === '--semente') o.semente = argv[++i];
    else if (k === '--tiques') o.tiques = +argv[++i];
    else if (k === '--horas') o.horas = +argv[++i];
    else if (k === '--comprarTempo') o.comprarTempo = true;
    else if (k === '--estresse') o.estresse = true;
    else if (k.startsWith('--')) o.resto.push(k);
    else o.filtros.push(k);
  }
  return o;
}

// Partida de um teste num processo à parte: importa o módulo (que pode rodar sozinho, como com node:test) e, se ele
// exportar testes (export const testes = [{ nome, fn }] ou { nome: fn }, ou export default), roda um por um.
const PARTIDA = `
import { pathToFileURL } from 'node:url';
const m = await import(pathToFileURL(process.argv[1]).href);
const t = m.testes ?? m.default;
const lista = typeof t === 'function' ? [['padrão', t]] : Array.isArray(t) ? t.map((x, i) => [x.nome ?? x.name ?? String(i), x.fn ?? x]) : t && typeof t === 'object' ? Object.entries(t) : [];
let falhas = 0;
for (const [nome, fn] of lista) {
  if (typeof fn !== 'function') continue;
  try { await fn(); console.log('ok ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + ': ' + (e?.stack ?? e)); }
}
if (falhas) process.exitCode = 1;
`;

// roda um teste num processo à parte; devolve { codigo, ms, saida }
function rodar(arquivo, args = [], teto = 600) {
  return new Promise((ok) => {
    const t0 = Date.now();
    const p = spawn(process.execPath, ['--input-type=module', '-e', PARTIDA, arquivo, ...args], { cwd: RAIZ, env: { ...process.env, HELD_TESTE: '1' } });
    let saida = '';
    const junta = (d) => { saida += d; if (saida.length > 2e6) saida = saida.slice(-1e6); };
    p.stdout.on('data', junta); p.stderr.on('data', junta);
    const t = setTimeout(() => { saida += `\n(passou do teto de ${teto} s)`; p.kill('SIGKILL'); }, teto * 1000);
    p.on('close', (codigo, sinal) => { clearTimeout(t); ok({ codigo: codigo ?? (sinal ? 1 : 0), ms: Date.now() - t0, saida }); });
  });
}

export function listarTestes(filtros = []) {
  if (!existsSync(PASTA_TESTES)) return [];
  return readdirSync(PASTA_TESTES).filter((f) => f.endsWith('.teste.mjs')).sort()
    .filter((f) => !filtros.length || filtros.some((x) => f.includes(x)));
}

async function testes(o) {
  const arquivos = listarTestes(o.filtros);
  const teto = +(process.env.TETO_TESTE || 600);
  const paralelo = Math.max(1, +(process.env.PARALELO || 2));
  const falhas = [];
  // guarda de texto primeiro (rápida, no mesmo processo)
  const g = guardar({ raiz: RAIZ });
  console.log(relatorio(g));
  if (g.falhas.length) falhas.push('guarda-texto');
  if (!arquivos.length) console.log(o.filtros.length ? `nenhum teste com ${o.filtros.join(', ')}` : 'nenhum teste em ferramentas/testes/');
  // fila com poucos processos ao mesmo tempo; o relatório sai na ordem dos nomes
  const res = new Array(arquivos.length);
  let prox = 0;
  const trabalhador = async () => {
    while (prox < arquivos.length) {
      const i = prox++;
      res[i] = await rodar(join(PASTA_TESTES, arquivos[i]), [], teto);
    }
  };
  await Promise.all(Array.from({ length: Math.min(paralelo, arquivos.length) }, trabalhador));
  arquivos.forEach((f, i) => {
    const r = res[i];
    const nome = f.replace(/\.teste\.mjs$/, '');
    if (r.codigo === 0) console.log(`ok      ${nome} (${(r.ms / 1000).toFixed(1)} s)`);
    else {
      falhas.push(nome);
      console.log(`FALHOU  ${nome} (código ${r.codigo}, ${(r.ms / 1000).toFixed(1)} s)`);
      console.log(r.saida.trimEnd().split('\n').slice(-60).map((l) => '    ' + l).join('\n'));
    }
  });
  console.log(falhas.length ? `testes com falhas: ${falhas.join(', ')}` : 'testes ok');
  return falhas.length ? 1 : 0;
}

async function robo(o) {
  const arq = join(RAIZ, 'ferramentas/robo/robo-sim.mjs');
  if (!existsSync(arq)) { console.log('o robô é da S3a: ferramentas/robo/robo-sim.mjs ainda não existe'); return 0; }
  const args = [];
  if (o.horas != null) args.push('--horas', String(o.horas));
  if (o.semente != null) args.push('--semente', String(o.semente));
  if (o.comprarTempo) args.push('--comprarTempo');
  args.push(...o.resto);
  const p = spawn(process.execPath, [arq, ...args], { cwd: RAIZ, stdio: 'inherit' });
  return new Promise((ok) => p.on('close', (c) => ok(c ?? 1)));
}

// ------------------------------------------------------------------------------------------ simulação
const importar = (rel) => import(pathToFileURL(join(RAIZ, rel)).href);
const temSim = () => existsSync(join(RAIZ, 'fonte/sim/estado.js')) && existsSync(join(RAIZ, 'fonte/sim/salvar/formato.js'));

// sorteio próprio da ferramenta (não entra na simulação): o roteiro de comandos sai igual para a mesma semente
function sorteioDe(semente) {
  let h = 0x811c9dc5;
  for (const c of String(semente)) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  let a = h || 1;
  return () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
}

// roteiro: a cada 20 a 200 tiques um comando do contrato com os argumentos de exemplo (recusas contam igual)
function roteiroDe(semente, tiques, COMANDOS) {
  const sortear = sorteioDe(semente);
  const nomes = Object.keys(COMANDOS).sort();
  const out = [];
  for (let t = 1 + Math.floor(sortear() * 20); t < tiques; t += 20 + Math.floor(sortear() * 180)) {
    const nome = sortear() < 0.3 ? 'velocidade' : nomes[Math.floor(sortear() * nomes.length)];
    const args = nome === 'velocidade' ? { v: Math.floor(sortear() * 4) } : JSON.parse(JSON.stringify(COMANDOS[nome].exemplo ?? {}));
    out.push({ tique: t, nome, args });
  }
  return out;
}

// joga o roteiro até `ate` (comandos do tique t entram quando sim.tique === t, antes de rodar o tique); anota o hash
// em cada marca (antes dos comandos daquele tique)
function jogar(sim, roteiro, ate, marcas, hashes) {
  const avancarAte = (t) => {
    for (const m of marcas) if (m > sim.tique && m <= t) { sim.rodar(m - sim.tique, { sincrono: true }); hashes.set(m, sim.q.hash()); }
    if (t > sim.tique) sim.rodar(t - sim.tique, { sincrono: true });
  };
  if (sim.tique === 0 && marcas.includes(0)) hashes.set(0, sim.q.hash());
  for (const c of roteiro) {
    if (c.tique < sim.tique) continue;
    if (c.tique >= ate) break;
    avancarAte(c.tique);
    sim.cmd(c.nome, c.args);
  }
  avancarAte(ate);
}

async function determinismo(o) {
  if (!temSim()) { console.log('determinismo: a simulação ainda não existe (fonte/sim/estado.js e salvar/formato.js)'); return 0; }
  const { criarSimulacao } = await importar('fonte/sim/estado.js');
  const { montarSave, lerSave, migrar, aplicarSave } = await importar('fonte/sim/salvar/formato.js');
  const { reproduzir } = await importar('fonte/sim/livro.js');
  const { COMANDOS } = await importar('fonte/contratos/comandos.js');
  const semente = String(o.semente ?? 'determinismo-1');
  const T = o.tiques ?? 3600;
  const marcas = [Math.floor(T / 3), Math.floor((2 * T) / 3), T];
  const meio = Math.floor(T / 2);
  const roteiro = roteiroDe(semente, T, COMANDOS);
  const criar = () => criarSimulacao({ semente });
  const falhas = [];
  const t0 = performance.now();

  // 1. duas partidas iguais
  const hA = new Map(), hB = new Map();
  const A = criar(); jogar(A, roteiro, T, marcas, hA);
  const B = criar(); jogar(B, roteiro, T, marcas, hB);
  for (const m of marcas) if (hA.get(m) !== hB.get(m)) falhas.push(`partidas iguais divergem no tique ${m}: ${hA.get(m)} x ${hB.get(m)}`);
  // 2. salvar no meio, carregar numa simulação nova e seguir
  const hC = new Map(), hD = new Map();
  const C = criar(); jogar(C, roteiro, meio, marcas, hC);
  const bytes = montarSave(C, { nome: 'determinismo' });
  const D = criar();
  aplicarSave(D, migrar(lerSave(bytes)));
  if (D.q.hash() !== C.q.hash()) falhas.push(`o save carregado no tique ${meio} não tem o hash de antes`);
  jogar(D, roteiro, T, marcas, hD);
  for (const m of marcas) if (m > meio && hD.get(m) !== hA.get(m)) falhas.push(`depois de salvar e carregar, diverge no tique ${m}`);
  // 3. reproduzir o livro numa simulação nova
  const E = criar();
  const rep = reproduzir(E, A.livro.entradas, T);
  if (E.q.hash() !== hA.get(T)) falhas.push(`a reprodução do livro (${rep.aplicados} comandos) não dá o hash do fim`);
  const erros = [...new Set([...A.erros, ...D.erros, ...E.erros].map((e) => String(e?.mensagem ?? e?.message ?? JSON.stringify(e))))];

  console.log(`determinismo: semente ${semente}, ${T} tiques, ${roteiro.length} comandos no roteiro (${A.livro.entradas.length} no livro), save de ${(bytes.length / 1024).toFixed(0)} KB`);
  for (const m of marcas) console.log(`  tique ${String(m).padStart(6)}: ${hA.get(m)}  ${hB.get(m) === hA.get(m) ? 'igual' : 'DIFERENTE'}${m > meio ? `, depois do save ${hD.get(m) === hA.get(m) ? 'igual' : 'DIFERENTE'}` : ''}`);
  if (erros.length) console.log(`  erros anotados pela simulação (${erros.length}):\n` + erros.slice(0, 8).map((e) => '    ' + e).join('\n'));
  console.log(`  ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  for (const f of falhas) console.log('  FALHOU: ' + f);
  console.log(falhas.length ? 'determinismo com falhas' : 'determinismo ok');
  return falhas.length ? 1 : 0;
}

const pct = (v, p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];

// bancada do tique (A5): cidade sintética pela API; mede o tique um por um, q.barra e mudancas.desde
async function bancada(o) {
  if (!temSim() || !existsSync(join(RAIZ, 'ferramentas/cidade-sintetica.mjs'))) { console.log('bancada do tique: a simulação ou a cidade sintética ainda não existem'); return 0; }
  const { criarSimulacao } = await importar('fonte/sim/estado.js');
  const { gerarCidadeSintetica, SINTETICA } = await importar('ferramentas/cidade-sintetica.mjs');
  const { COMANDOS } = await importar('fonte/contratos/comandos.js');
  const predios = o.estresse ? SINTETICA.predios * 3 : SINTETICA.predios;
  const agora = () => performance.now();
  const t0 = agora();
  const sim = criarSimulacao({ semente: SINTETICA.semente, cronometro: agora });
  const { resumo } = gerarCidadeSintetica({ sim, predios, cronometro: agora });
  const tGerar = agora() - t0;
  const N = o.tiques ?? 600;
  const via = COMANDOS['via.construir']?.exemplo;
  sim.cmd('velocidade', { v: 3 });
  // aquece: a primeira obra monta os índices preguiçosos (prédios e células da sintética, gerada por fora da S1b), o
  // que depois de carregar um save já sai na carga; fica fora da medida
  const plano = (i) => ({ plano: { ...via.plano, pontos: [[2400, -2000 + i * 6], [2512, -2000 + i * 6]], sessao: `bancada.${i}` } });
  let msAquece = 0;
  if (via) {
    const a = agora();
    sim.cmd('via.construir', plano(-40));
    msAquece = agora() - a;
  }
  const tempos = new Float64Array(N);
  const tCmd = [];
  for (let i = 0; i < N; i++) {
    // cenário do A5: o robô constrói uma via a cada 10 tiques (fora da cidade, para não colidir). O comando aplica
    // entre dois tiques (D17) e é medido à parte; o tique mede o que a obra deixa para ele
    if (via && i % 10 === 0) {
      const c = agora();
      sim.cmd('via.construir', plano(i));
      tCmd.push(agora() - c);
    }
    const a = agora();
    sim.rodar(1, { sincrono: true });
    tempos[i] = agora() - a;
  }
  const v = [...tempos].sort((x, y) => x - y);
  const vc = tCmd.sort((x, y) => x - y);
  const medir = (fn, n) => { const a = agora(); for (let i = 0; i < n; i++) fn(); return (agora() - a) / n; };
  const msBarra = medir(() => sim.q.barra(), 200);
  const msDesdeTudo = medir(() => sim.mudancas.desde(0), 20);
  let vv = sim.mudancas.versao;
  const msDesde = medir(() => { sim.rodar(1, { sincrono: true }); sim.mudancas.desde(vv); vv = sim.mudancas.versao; }, 60);
  const memMB = process.memoryUsage().heapUsed / 1048576;
  const meta = o.estresse ? { p95: 3, p99: null, max: null, rotulo: '100 mil moradores' } : { p95: 1, p99: 2, max: 4, rotulo: '30 mil moradores' };
  const falhas = [];
  const p95 = pct(v, 0.95), p99 = pct(v, 0.99), max = v[v.length - 1];
  if (p95 > meta.p95) falhas.push(`p95 ${p95.toFixed(3)} ms (meta ${meta.p95})`);
  if (meta.p99 && p99 > meta.p99) falhas.push(`p99 ${p99.toFixed(3)} ms (meta ${meta.p99})`);
  if (meta.max && max > meta.max) falhas.push(`máximo ${max.toFixed(3)} ms (meta ${meta.max})`);
  if (memMB > 48) falhas.push(`memória ${memMB.toFixed(1)} MB (meta 48)`);
  console.log(`bancada do tique${o.estresse ? ' (estresse)' : ''}: ${resumo.predios} prédios, ${resumo.populacao} moradores, ${resumo.arestas} arestas, ${resumo.celulas?.total ?? 0} células; cidade gerada em ${(tGerar / 1000).toFixed(1)} s`);
  if (vc.length) console.log(`  via.construir (${vc.length}, entre tiques): p50 ${pct(vc, 0.5).toFixed(3)} · p95 ${pct(vc, 0.95).toFixed(3)} · máximo ${vc[vc.length - 1].toFixed(3)} ms · primeira obra (índices) ${msAquece.toFixed(1)} ms`);
  console.log(`  tique (${N}, com via a cada 10): média ${(v.reduce((a, b) => a + b, 0) / N).toFixed(3)} ms · p50 ${pct(v, 0.5).toFixed(3)} · p95 ${p95.toFixed(3)} · p99 ${p99.toFixed(3)} · máximo ${max.toFixed(3)} ms`);
  console.log(`  q.barra ${msBarra.toFixed(3)} ms · desde(0) ${msDesdeTudo.toFixed(3)} ms · tique + desde(v) ${msDesde.toFixed(3)} ms · memória ${memMB.toFixed(1)} MB`);
  const sis = Object.entries(sim.medidas?.sistemas ?? {}).map(([k, x]) => [k, x.msTotal ?? x.ms ?? 0]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (sis.length) console.log('  sistemas (ms somados): ' + sis.map(([k, ms]) => `${k} ${(+ms).toFixed(1)}`).join(' · '));
  console.log(`  metas do A5 (${meta.rotulo}): ${falhas.length ? 'FORA: ' + falhas.join('; ') : 'dentro'}`);
  if (resumo.populacao < (o.estresse ? 80000 : 25000)) console.log(`  aviso: a cidade sintética tem ${resumo.populacao} moradores, abaixo do cenário da meta`);
  return falhas.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  const g = argv.indexOf('--grafica');
  if (argv.includes('--bancada') && g >= 0) {
    const p = spawn(process.execPath, [join(RAIZ, 'ferramentas/bancada.mjs'), ...argv.slice(g + 1)], { cwd: RAIZ, stdio: 'inherit' });
    process.exit(await new Promise((ok) => p.on('close', (c) => ok(c ?? 1))));
  }
  const o = lerArgs(argv);
  const modos = { testes, robo, determinismo, bancada };
  if (!o.modo) {
    console.log('uso: node ferramentas/simular.mjs --testes | --determinismo | --robo [--horas h] [--semente s] [--comprarTempo] | --bancada [--estresse]');
    process.exit(1);
  }
  process.exit(await modos[o.modo](o));
}
