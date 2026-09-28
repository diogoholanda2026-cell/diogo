// Bancada gráfica (PROJETO 3.2, 4.8, A6, D44): roda ?cena=<nome> por perfil no Chromium de teste, grava PNG e JSON,
// guarda o PIOR quadro de 120 com o sol andando e falha se passar do orçamento (total e por família) ou se um programa
// passar da guarda do Mali.
//   node ferramentas/bancada.mjs [--cenas aberta,rua,horizonte] [--perfis leve,media,ultra] [--pasta previa]
//        [--saida <pasta>] [--quadros 120] [--tam 1376x768] [--consulta "sintetica=1"] [--semClip] [--familias] [--voo]
//        [--fontes] (grava o GLSL final de cada programa em <saida>/<cena>-<perfil>-glsl/) [--vel 1|2|4] (padrão 4x)
//        [--compilacoes] (falha com programa compilado depois de pronto; sem ela, só avisa)
// A cena 'jogo' abre o jogo sem ?cena= (a vista de depuração da F0). --familias confere os tetos por família em
// qualquer cena (sem ela, só na 'aberta' do Média e do 'pc', onde a 4.8 e a D66 os fixam). --voo também roda
// R.bancada() e guarda o relatório do render (com o tempo de placa por passe, a memória e as compilações).
//
// Orçamento e guarda do Mali vêm de fonte/contratos/render.js (ORCAMENTO, GUARDA_MALI), também o do 'pc' (PC do dono,
// D66: 800 chamadas, 2,5 milhões de triângulos, 2,5 GB de vídeo). A medida espera o aquecimento dos programas
// (motor/quadro.js) e conta as compilações depois de pronto.
// Como mede: a página abre com ?cena=<nome>&q=<perfil>&pr=1&teste=1&bancada=1&sol=anda (a cena faz a hora andar), a
// velocidade vai a 4x (--vel troca) se houver simulação, e a cada quadro (requestAnimationFrame) lê window.__held.R.stats. O pior
// quadro é o máximo de cada medida na janela. Os programas são capturados por um gancho no WebGL2 (shaderSource,
// attachShader, linkProgram) e contados no GLSL final, depois do pré-processador (#define, #if, #ifdef): amostradores
// por estágio, varyings (saídas do vértice), vetores de uniforme do fragmento e atributos (entradas do vértice), com a
// mesma regra de tamanho do GLSL ES 3.0 (matCxR ocupa C vetores; arranjo multiplica). Declarado conta, mesmo sem uso.
// Uma cena também pode escrever window.__resultado = { ok, falhas: [...] } (a prova-sombra faz isso).
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ORCAMENTO, GUARDA_MALI } from '../fonte/contratos/render.js';
import { orcamentoDoPerfil } from '../fonte/render/motor/perfis.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** --vel (1x, 2x, 4x) para o comando velocidade (D7: v 1, 2 e 3). */
const VELOCIDADES = Object.freeze({ 1: 1, 2: 2, 4: 3 });

// ---------- orçamento (A6 e 4.8) e guarda do Mali (D44): uma fonte só, o contrato do render ----------
export { ORCAMENTO };
export const MALI = { amostradores: GUARDA_MALI.amostradoresPorEstagio, varyings: GUARDA_MALI.varyings, uniformesF: GUARDA_MALI.uniformesF, atributos: GUARDA_MALI.atributos };

// ---------- GLSL: pré-processador e contagem ----------
const semComentariosGlsl = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '');

function expandir(expr, macros, prof = 0) {
  if (prof > 16) return expr;
  return expr.replace(/\b[A-Za-z_]\w*\b/g, (id) => (macros.has(id) && typeof macros.get(id) === 'string' ? expandir(macros.get(id), macros, prof + 1) : id));
}

// avalia a expressão de um #if (defined, &&, ||, !, comparações, inteiros); identificador sem valor vale 0
export function avaliarSe(expr, macros) {
  let e = semComentariosGlsl(expr)
    .replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, n) => (macros.has(n) ? ' 1 ' : ' 0 '))
    .replace(/defined\s+(\w+)/g, (_, n) => (macros.has(n) ? ' 1 ' : ' 0 '));
  e = expandir(e, macros)
    .replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, n) => (macros.has(n) ? ' 1 ' : ' 0 '))
    .replace(/\b(\d+)[uU]\b/g, '$1')
    .replace(/\b(?!0x)[A-Za-z_]\w*\b/g, '0');
  if (!/^[\s\d()+\-*/%<>=!&|^~.xXa-fA-F]*$/.test(e) || !e.trim()) throw new Error(`#if que a bancada não entende: ${expr.trim()}`);
  return !!Number(Function(`"use strict"; return (${e});`)());
}

// devolve { texto, macros } com só as linhas ativas e sem nenhuma diretiva
export function preprocessar(src, iniciais = {}) {
  const macros = new Map(Object.entries(iniciais));
  const linhas = src.replace(/\\\r?\n/g, ' ').split('\n');
  const pilha = [];
  const ativo = () => pilha.every((p) => p.ativo);
  const out = [];
  for (const linha of linhas) {
    const m = linha.match(/^\s*#\s*(\w+)\s*(.*)$/);
    if (!m) { if (ativo()) out.push(linha); continue; }
    const [, dir, resto] = m;
    const nome = resto.trim().split(/[\s(]/)[0];
    if (dir === 'if' || dir === 'ifdef' || dir === 'ifndef') {
      const pai = ativo();
      let v = false;
      if (pai) v = dir === 'if' ? avaliarSe(resto, macros) : dir === 'ifdef' ? macros.has(nome) : !macros.has(nome);
      pilha.push({ ativo: v, tomado: v, pai });
    } else if (dir === 'elif') {
      const t = pilha.at(-1);
      if (t.tomado || !t.pai) t.ativo = false; else { t.ativo = avaliarSe(resto, macros); t.tomado = t.ativo; }
    } else if (dir === 'else') {
      const t = pilha.at(-1); t.ativo = t.pai && !t.tomado; t.tomado = true;
    } else if (dir === 'endif') {
      pilha.pop();
    } else if (dir === 'define') {
      if (!ativo()) continue;
      const fm = resto.match(/^(\w+)(\([^)]*\))?\s*(.*)$/);
      if (fm) macros.set(fm[1], fm[2] ? { funcao: true } : semComentariosGlsl(fm[3]).trim());
    } else if (dir === 'undef') {
      if (ativo()) macros.delete(nome);
    }
    // #version, #extension, #pragma e #line não são declarações: ficam fora do texto
  }
  return { texto: out.join('\n'), macros };
}

// declarações do escopo global (corpos de função fora), como texto sem o ';'
export function declaracoesGlobais(src) {
  const st = [];
  let cur = '';
  let prof = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '{') {
      if (prof === 0 && /\)\s*$/.test(cur)) {
        let d = 0;
        for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
        cur = '';
        continue;
      }
      prof++;
    } else if (c === '}') prof--;
    else if (c === ';' && prof === 0) { if (cur.trim()) st.push(cur.trim().replace(/\s+/g, ' ')); cur = ''; continue; }
    cur += c;
  }
  return st;
}

const QUALIF = new Set(['uniform', 'in', 'out', 'attribute', 'varying', 'const', 'centroid', 'flat', 'smooth', 'invariant', 'highp', 'mediump', 'lowp', 'noperspective', 'precise']);

function vetoresDoTipo(tipo, structs) {
  if (/^[iu]?sampler|^image/.test(tipo)) return { vetores: 0, amostradores: 1 };
  if (structs.has(tipo)) return structs.get(tipo);
  const mat = tipo.match(/^d?mat(\d)(?:x(\d))?$/);
  if (mat) return { vetores: +mat[1], amostradores: 0 };
  return { vetores: 1, amostradores: 0 };
}

function tamanhoArranjo(txt, macros) {
  let n = 1;
  for (const m of txt.matchAll(/\[([^\]]*)\]/g)) {
    const e = expandir(m[1], macros).trim();
    const v = e === '' ? 1 : /^[\d\s()+\-*/]+$/.test(e) ? Function(`return (${e})`)() : NaN;
    n *= Number.isFinite(v) && v > 0 ? Math.floor(v) : 1;
  }
  return n;
}

// lista de { qualif: Set, tipo, nome, vetores, amostradores } das declarações globais de um estágio
export function declaracoes(texto, estagio, macros = new Map()) {
  const structs = new Map();
  const out = [];
  const membros = (corpo) => {
    let vetores = 0, amostradores = 0;
    for (const d of corpo.split(';').map((x) => x.trim()).filter(Boolean)) {
      const toks = d.replace(/,/g, ' , ').split(/\s+/).filter((t) => !QUALIF.has(t));
      const tipo = toks[0];
      const nomes = toks.slice(1).join(' ').split(',').map((x) => x.trim()).filter(Boolean);
      const t = vetoresDoTipo(tipo, structs);
      for (const nm of nomes) { const k = tamanhoArranjo(nm, macros); vetores += t.vetores * k; amostradores += t.amostradores * k; }
    }
    return { vetores, amostradores };
  };
  for (let d of declaracoesGlobais(semComentariosGlsl(texto))) {
    d = d.replace(/layout\s*\([^)]*\)\s*/g, '');
    const st = d.match(/^struct\s+(\w+)\s*\{([\s\S]*)\}\s*(.*)$/);
    if (st) { structs.set(st[1], membros(st[2])); continue; }
    const bloco = d.match(/^uniform\s+(\w+)\s*\{([\s\S]*)\}\s*(\w*)/);
    if (bloco) { out.push({ qualif: new Set(['uniform']), tipo: bloco[1], nome: bloco[3] || bloco[1], ...membros(bloco[2]) }); continue; }
    if (/^precision\b/.test(d) || d.includes('(')) continue;
    const toks = d.replace(/=.*$/, '').replace(/,/g, ' , ').split(/\s+/).filter(Boolean);
    const qualif = new Set();
    let i = 0;
    for (; i < toks.length && QUALIF.has(toks[i]); i++) {
      let q = toks[i];
      if (q === 'attribute') q = 'in';
      if (q === 'varying') q = estagio === 'v' ? 'out' : 'in';
      qualif.add(q);
    }
    if (!qualif.has('uniform') && !qualif.has('in') && !qualif.has('out')) continue;
    const tipo = toks[i];
    const t = vetoresDoTipo(tipo, structs);
    for (const nm of toks.slice(i + 1).join(' ').split(',').map((x) => x.trim()).filter(Boolean)) {
      const nome = nm.split(/[\s[]/)[0];
      if (nome.startsWith('gl_')) continue;
      const k = tamanhoArranjo(nm, macros);
      out.push({ qualif, tipo, nome, vetores: t.vetores * k, amostradores: t.amostradores * k });
    }
  }
  return out;
}

// conta um programa (fontes finais do vértice e do fragmento) contra a guarda do Mali
export function contarPrograma(vs, fs) {
  const v = preprocessar(vs);
  const f = preprocessar(fs);
  const dv = declaracoes(v.texto, 'v', v.macros);
  const df = declaracoes(f.texto, 'f', f.macros);
  const soma = (l, ch) => l.reduce((a, d) => a + d[ch], 0);
  const uni = (l) => l.filter((d) => d.qualif.has('uniform'));
  const r = {
    nome: [/#define SHADER_NAME[ \t]+(\S+)/, /#define SHADER_TYPE[ \t]+(\S+)/].map((re) => (fs.match(re) || vs.match(re) || [])[1]).find(Boolean) || '(sem nome)',
    amostradores: { v: soma(uni(dv), 'amostradores'), f: soma(uni(df), 'amostradores') },
    varyings: soma(dv.filter((d) => d.qualif.has('out')), 'vetores'),
    varyingsF: soma(df.filter((d) => d.qualif.has('in')), 'vetores'),
    uniformesV: soma(uni(dv), 'vetores'),
    uniformesF: soma(uni(df), 'vetores'),
    atributos: soma(dv.filter((d) => d.qualif.has('in')), 'vetores'),
    mediump: /\bmediump\s+float\b/.test(v.texto + f.texto),
  };
  r.falhas = [];
  if (r.amostradores.v > MALI.amostradores) r.falhas.push(`${r.amostradores.v} amostradores no vértice`);
  if (r.amostradores.f > MALI.amostradores) r.falhas.push(`${r.amostradores.f} amostradores no fragmento`);
  if (Math.max(r.varyings, r.varyingsF) > MALI.varyings) r.falhas.push(`${Math.max(r.varyings, r.varyingsF)} varyings`);
  if (r.uniformesF > MALI.uniformesF) r.falhas.push(`${r.uniformesF} vetores de uniforme no fragmento`);
  if (r.atributos > MALI.atributos) r.falhas.push(`${r.atributos} atributos`);
  return r;
}

// confere o pior quadro contra o orçamento do perfil (e os tetos por família do Média e do 'pc'); devolve a lista de
// falhas
export function conferirOrcamento(pior, perfil, { familias = false, memoria = null } = {}) {
  const lim = orcamentoDoPerfil(perfil);
  const f = [];
  if (!lim) return [`perfil desconhecido: ${perfil}`];
  if (pior.calls > lim.calls) f.push(`${pior.calls} chamadas (teto ${lim.calls})`);
  if (pior.tris > lim.tris) f.push(`${pior.tris} triângulos (teto ${lim.tris})`);
  if (lim.geometriaMB && memoria?.geometriaMB > lim.geometriaMB) f.push(`${memoria.geometriaMB.toFixed(1)} MB de geometria (teto ${lim.geometriaMB})`);
  if (lim.videoMB && memoria?.videoMB > lim.videoMB) f.push(`${Math.round(memoria.videoMB)} MB de vídeo estimados (teto ${lim.videoMB})`);
  if (familias && lim.familias) {
    const fam = { ...(pior.familias || {}) };
    if (pior.trisSombra != null) fam.sombra = Math.max(fam.sombra || 0, pior.trisSombra);
    for (const [k, v] of Object.entries(fam)) {
      const teto = lim.familias[k]?.teto;
      if (teto == null) f.push(`família desconhecida em R.stats.familias: ${k}`);
      else if (v > teto) f.push(`família ${k}: ${v} triângulos (teto ${teto})`);
    }
  }
  return f;
}

// ---------- página ----------
// gancho no WebGL2: guarda a fonte de cada programa ligado
const GANCHO = `(() => {
  const P = WebGL2RenderingContext.prototype;
  const fontes = new WeakMap(), tipos = new WeakMap(), anexos = new WeakMap();
  const lista = []; window.__programasGL = lista;
  const cs = P.createShader; P.createShader = function (t) { const s = cs.call(this, t); if (s) tipos.set(s, t); return s; };
  const ss = P.shaderSource; P.shaderSource = function (s, src) { fontes.set(s, src); return ss.call(this, s, src); };
  const at = P.attachShader; P.attachShader = function (p, s) { const l = anexos.get(p) || []; l.push(s); anexos.set(p, l); return at.call(this, p, s); };
  const lk = P.linkProgram; P.linkProgram = function (p) {
    const r = lk.call(this, p);
    const sh = anexos.get(p) || [];
    const vs = sh.find((s) => tipos.get(s) === this.VERTEX_SHADER), fs = sh.find((s) => tipos.get(s) === this.FRAGMENT_SHADER);
    lista.push({ vs: fontes.get(vs) || '', fs: fontes.get(fs) || '', p, gl: this });
    return r;
  };
})();`;

// roda na página: espera o aquecimento dos programas, amostra n quadros e devolve o pior e a média
async function amostrarNaPagina({ n, v, esperaAquecer }) {
  const R = window.__held?.R;
  const sim = window.__held?.sim;
  const quadro = () => new Promise((ok) => requestAnimationFrame(() => ok()));
  const t0 = performance.now();
  while (R?.stats?.aquecimento && R.stats.aquecimento.estado !== 'pronto' && performance.now() - t0 < esperaAquecer) await quadro();
  const aquecido = R?.stats?.aquecimento?.estado === 'pronto';
  try { sim?.cmd?.('velocidade', { v }); } catch (e) { /* sem simulação: a cena anda a hora sozinha */ }
  const lidos = [];
  for (let i = 0; i < n; i++) {
    await quadro();
    const s = R?.stats;
    if (!s) continue;
    lidos.push({ calls: s.calls | 0, tris: s.tris | 0, callsSombra: s.callsSombra | 0, trisSombra: s.trisSombra | 0, ms: +s.ms || 0, familias: s.familias ? { ...s.familias } : null });
  }
  const pior = { calls: 0, tris: 0, callsSombra: 0, trisSombra: 0, ms: 0, familias: {} };
  const soma = { calls: 0, tris: 0 };
  for (const q of lidos) {
    for (const k of ['calls', 'tris', 'callsSombra', 'trisSombra', 'ms']) pior[k] = Math.max(pior[k], q[k]);
    for (const [k, v] of Object.entries(q.familias || {})) pior.familias[k] = Math.max(pior.familias[k] || 0, +v || 0);
    soma.calls += q.calls; soma.tris += q.tris;
  }
  const rp = R?.stats?.pior;
  if (rp) { pior.calls = Math.max(pior.calls, rp.calls | 0); pior.tris = Math.max(pior.tris, rp.tris | 0); }
  const limpo = (x) => { try { return x == null ? null : JSON.parse(JSON.stringify(x)); } catch (e) { return null; } };
  const programas = [];
  const vistos = new Set();
  for (const pr of window.__programasGL || []) {
    const chave = pr.vs.length + ':' + pr.fs.length + ':' + pr.vs.slice(-200) + pr.fs.slice(-200);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const gl = pr.gl;
    programas.push({ vs: pr.vs, fs: pr.fs, link: !!gl.getProgramParameter(pr.p, gl.LINK_STATUS), atributosGl: gl.getProgramParameter(pr.p, gl.ACTIVE_ATTRIBUTES) });
  }
  const vigia = R?._ctx?.capac?.programas;
  const depois = (vigia?.depois || []).map((p) => ({ nome: p.nome, msBloqueio: p.msBloqueio, msCompilar: p.msCompilar, quadro: p.quadro }));
  return {
    quadros: lidos.length, pior, medio: lidos.length ? { calls: Math.round(soma.calls / lidos.length), tris: Math.round(soma.tris / lidos.length) } : null,
    stats: limpo(R?.stats), resultado: limpo(window.__resultado), programas, temR: !!R, aquecido, depois,
  };
}

function lerArgs(argv) {
  const o = { cenas: ['aberta', 'rua', 'horizonte'], perfis: ['leve', 'media', 'pc'], pasta: 'previa', saida: join(tmpdir(), 'heldopolis-bancada'),
    quadros: 120, tam: '1376x768', consulta: '', semClip: false, familias: false, voo: false, fontes: false, teto: 300, vel: 4, compilacoes: false, aquecer: 60 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--cenas') o.cenas = v().split(',');
    else if (k === '--perfis') o.perfis = v().split(',');
    else if (k === '--pasta') o.pasta = v();
    else if (k === '--saida') o.saida = v();
    else if (k === '--quadros') o.quadros = +v();
    else if (k === '--tam') o.tam = v();
    else if (k === '--consulta') o.consulta = v();
    else if (k === '--semClip') o.semClip = true;
    else if (k === '--familias') o.familias = true;
    else if (k === '--voo') o.voo = true;
    else if (k === '--fontes') o.fontes = true;
    else if (k === '--teto') o.teto = +v();
    else if (k === '--vel') o.vel = +v();
    else if (k === '--compilacoes') o.compilacoes = true;
    else if (k === '--aquecer') o.aquecer = +v();
    else throw new Error(`opção desconhecida: ${k}`);
  }
  if (!(o.vel in VELOCIDADES)) throw new Error(`--vel ${o.vel}: use 1, 2 ou 4`);
  return o;
}

export async function rodarBancada(o) {
  const { servir, pastaDe, abrirChromium } = await import('./testar.mjs');
  const pasta = pastaDe(o.pasta);
  if (!existsSync(join(pasta, 'index.html'))) throw new Error(`${pasta}/index.html não existe (monte antes)`);
  mkdirSync(o.saida, { recursive: true });
  const [W, H] = o.tam.split('x').map(Number);
  const srv = servir(pasta);
  const browser = await abrirChromium();
  const resumo = [];
  let falhou = false;
  try {
    for (const cena of o.cenas) for (const perfil of o.perfis) {
      const q = [cena !== 'jogo' && `cena=${cena}`, `q=${perfil}`, 'pr=1', 'teste=1', 'bancada=1', 'sol=anda', o.semClip && 'semClip=1', o.consulta].filter(Boolean).join('&');
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, serviceWorkers: 'block' });
      await ctx.addInitScript(GANCHO);
      const page = await ctx.newPage();
      const erros = [];
      page.on('pageerror', (e) => erros.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
      const t0 = Date.now();
      await page.goto(`http://localhost:${srv.porta}/index.html?${q}`);
      let pronto = true;
      try { await page.waitForFunction(() => window.__pronto === true, null, { timeout: o.teto * 1000, polling: 250 }); } catch (e) { pronto = false; }
      const med = pronto ? await page.evaluate(amostrarNaPagina, { n: o.quadros, v: VELOCIDADES[o.vel ?? 4], esperaAquecer: (o.aquecer ?? 60) * 1000 }) : null;
      let voo = null;
      if (pronto && o.voo) voo = await page.evaluate(async () => { try { return JSON.parse(JSON.stringify(await window.__held.R.bancada())); } catch (e) { return { erro: String(e) }; } });
      const base = `${cena}-${perfil}${o.semClip ? '-semClip' : ''}`;
      await page.screenshot({ path: join(o.saida, base + '.png'), timeout: 240000 }).catch((e) => erros.push('captura: ' + e.message));
      await ctx.close();

      const falhas = [];
      if (!pronto) falhas.push('a página não ficou pronta (window.__pronto)');
      if (med && !med.temR) falhas.push('sem window.__held.R');
      if (med && !med.quadros) falhas.push('nenhum quadro com R.stats');
      falhas.push(...erros.map((e) => 'erro de página: ' + e));
      const programas = (med?.programas || []).map((p) => ({ ...contarPrograma(p.vs, p.fs), link: p.link, atributosGl: p.atributosGl }));
      if (o.fontes && med) {
        const dir = join(o.saida, `${cena}-${perfil}-glsl`);
        mkdirSync(dir, { recursive: true });
        med.programas.forEach((p, i) => { const n = `${String(i).padStart(2, '0')}-${programas[i].nome}`; writeFileSync(join(dir, n + '.vert'), p.vs); writeFileSync(join(dir, n + '.frag'), p.fs); });
      }
      for (const p of programas) {
        if (!p.link) falhas.push(`programa ${p.nome} não ligou`);
        for (const x of p.falhas) falhas.push(`guarda do Mali: ${p.nome}: ${x}`);
      }
      if (med?.quadros) {
        const familias = o.familias || (cena === 'aberta' && (perfil === 'media' || perfil === 'pc'));
        falhas.push(...conferirOrcamento(med.pior, perfil, { familias, memoria: med.stats?.memoria }));
      }
      // nenhuma compilação depois de pronto (D66): aviso, ou falha com --compilacoes
      const avisos = [];
      if (med && med.aquecido === false && med.stats?.aquecimento) avisos.push(`o aquecimento não terminou em ${o.aquecer ?? 60} s`);
      for (const d of med?.depois || []) avisos.push(`programa compilado depois de pronto: ${d.nome} (bloqueio ${d.msBloqueio ?? '?'} ms, quadro ${d.quadro})`);
      if (o.compilacoes) falhas.push(...avisos.filter((a) => a.startsWith('programa')));
      const res = med?.resultado;
      if (res && (res.ok === false || res.falhas?.length)) falhas.push(...(res.falhas?.length ? res.falhas.map((x) => 'cena: ' + x) : ['cena: ok = false']));
      const rel = { cena, perfil, semClip: o.semClip, vel: o.vel ?? 4, ms: Date.now() - t0, quadros: med?.quadros || 0, pior: med?.pior || null, medio: med?.medio || null,
        orcamento: orcamentoDoPerfil(perfil), stats: med?.stats || null, resultado: res || null, voo, compilacoesDepois: med?.depois || [], avisos,
        programas: programas.map(({ nome, amostradores, varyings, varyingsF, uniformesV, uniformesF, atributos, atributosGl, link, falhas: fp }) => ({ nome, amostradores, varyings, varyingsF, uniformesV, uniformesF, atributos, atributosGl, link, falhas: fp })),
        falhas };
      writeFileSync(join(o.saida, base + '.json'), JSON.stringify(rel, null, 1));
      resumo.push(rel);
      if (falhas.length) falhou = true;
      const p = rel.pior;
      const mil = (n) => (n / 1000).toFixed(0) + ' mil';
      const mem = rel.stats?.memoria?.videoMB;
      console.log(`${base.padEnd(22)} ${p ? `pior ${p.calls} chamadas, ${mil(p.tris)} tri (sombra ${p.callsSombra} / ${mil(p.trisSombra)})` : 'sem medida'} · ${rel.quadros} quadros · ${programas.length} programas${mem ? ` · ${Math.round(mem)} MB de vídeo` : ''} · ${(med?.depois || []).length} depois de pronto · ${falhas.length ? 'FALHOU' : 'ok'}`);
      for (const f of falhas) console.log('    ' + f);
      for (const a of avisos) if (!falhas.includes(a)) console.log('    aviso: ' + a);
    }
  } finally {
    await browser.close();
    srv.fechar();
  }
  writeFileSync(join(o.saida, 'bancada.json'), JSON.stringify(resumo, null, 1));
  console.log(falhou ? 'bancada com falhas' : 'bancada ok', `(${o.saida})`);
  return falhou ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let codigo;
  try { codigo = await rodarBancada(lerArgs(process.argv.slice(2))); } catch (e) { console.error('bancada: ' + e.message); codigo = 1; }
  process.exit(codigo);
}
