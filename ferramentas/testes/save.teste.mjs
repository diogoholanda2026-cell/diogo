// Testes da U2a (save, diário, menus, configurações e primeira hora), sem navegador: armazém com o banco na memória
// (espaços, rodízio, quarentena, trava da importação), diário síncrono (carimbo, outra página, base), salvamento de
// ponta a ponta com a simulação de verdade (nova partida, save, comandos, "matar a página" no meio de um save e
// continuar sem perder tique nem estado; carregar volta no tempo; save danificado vai para a quarentena; exportar e
// importar), as regras da primeira hora sobre o mapa novo da SEDE3 (a avenida sugerida constrói do nó de entrada ao
// portão norte), a nova partida (Holding Held, Diogo Holanda, jan. 2020) e os textos da U2.
//   node ferramentas/testes/save.teste.mjs                 (o simular --testes descobre)
//   node ferramentas/testes/save.teste.mjs --chromium <pasta montada>
//       no Chromium de teste: nova partida, comandos, pausa, save segurado no meio, a página morre (Page.crash) e a
//       página nova continua: o mesmo tique, o mesmo livro e o mesmo hash.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { SAVE } from '../../fonte/contratos/save.js';
import { bancoNaMemoria, localSeguro, criarArmazem, proximoAuto, proximoManual, SLOTS_AUTO, SLOTS_MANUAIS, nomeArquivo, MAX_QUARENTENA } from '../../fonte/app/armazem.js';
import { criarDiario, lerDiario } from '../../fonte/app/diario.js';
import { criarSalvamento, ordemContinuar, serveAoDiario, resumoContinuar } from '../../fonte/app/salvamento.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fonte = (p) => join(RAIZ, 'fonte', p);
const SEMENTE = 'heldopolis-1';

/** localStorage de mentira, compartilhado entre "páginas". */
function armazenamento() {
  const m = new Map();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

/** Uma "página": a simulação dela e o salvamento sobre o banco e o localStorage compartilhados. */
function pagina({ banco, ls, sessao, relogio, sim = null }) {
  const p = { sim: sim ?? criarSimulacao({ semente: SEMENTE }) };
  p.S = criarSalvamento({ obterSim: () => p.sim, trocarSim: (s) => (p.sim = s), banco, local: localSeguro(ls), agora: () => (relogio.t += 1000), sessao });
  return p;
}

/** A avenida sugerida pelo mapa, trecho a trecho (o caminho do "Usar sugestão" e do robô). */
function construirAvenida(sim) {
  const av = sim.q.sugestoes().find((s) => s.id === 'avenida');
  const r = [];
  for (let k = 0; k + 1 < av.pontos.length; k++) r.push(sim.cmd('via.construir', { plano: { modo: 'reta', tipo: av.via ?? 'avenida', pontos: [av.pontos[k], av.pontos[k + 1]], sessao: `teste.${k}` } }).ok);
  return r;
}

// ------------------------------------------------------------------------------------------------ armazém

test('armazém: 3 automáticos em rodízio, 8 manuais, a partida no seu espaço, nada além dos 11', async () => {
  assert.deepEqual(SLOTS_AUTO, ['auto1', 'auto2', 'auto3']);
  assert.equal(SLOTS_MANUAIS.length, 8);
  const metas = [];
  for (let i = 0; i < 5; i++) {
    const s = proximoAuto(metas);
    const m = metas.find((x) => x.slot === s);
    if (m) m.data = 100 + i;
    else metas.push({ slot: s, data: 100 + i });
  }
  assert.deepEqual(metas.map((m) => m.slot), ['auto1', 'auto2', 'auto3'], 'rodízio só nos 3');
  assert.equal(proximoAuto(metas), 'auto3', 'o mais velho (auto3 tinha 102)');
  assert.equal(proximoAuto(metas, ['auto3']), 'auto1', 'o que está sendo gravado fica de fora');
  const manuais = [{ slot: 'manual1', partida: 'a', data: 1 }, { slot: 'manual2', partida: 'b', data: 2 }];
  assert.equal(proximoManual(manuais, 'b'), 'manual2', 'o espaço da própria partida');
  assert.equal(proximoManual(manuais, 'c'), 'manual3', 'senão o primeiro livre');
  assert.equal(proximoManual(SLOTS_MANUAIS.map((slot, i) => ({ slot, partida: 'x', data: i })), 'c'), null, 'cheio: o jogador escolhe');
  const arm = criarArmazem({ banco: bancoNaMemoria(), local: localSeguro(armazenamento()) });
  await assert.rejects(() => arm.gravar('auto9', new Uint8Array(4), {}), /espaço desconhecido/);
  assert.match(nomeArquivo('Holding Held', Date.UTC(2026, 9, 3, 12)), /^heldopolis-holding-held-2026-10-03\.held$/);
});

test('armazém: bytes e resumo juntos; quarentena guarda as 3 cópias mais novas e nunca apaga sem guardar; trava da importação', async () => {
  let agora = 1000;
  const ls = armazenamento();
  const ses = armazenamento();
  const arm = criarArmazem({ banco: bancoNaMemoria(), local: localSeguro(ls), agora: () => (agora += 10), sessao: localSeguro(ses) });
  await arm.gravar('manual1', new Uint8Array([1, 2, 3]), { nome: 'A', data: 5 });
  assert.equal(ls.getItem(SAVE.chaves.ultimo), 'manual1');
  const l = await arm.ler('manual1');
  assert.deepEqual([...l.bytes], [1, 2, 3]);
  assert.equal(l.meta.bytes, 3);
  for (let i = 0; i < 5; i++) {
    await arm.gravar('auto1', new Uint8Array([i]), { nome: `q${i}`, data: i });
    const r = await arm.quarentena('auto1', `motivo ${i}`);
    assert.ok(r.ok);
  }
  const q = await arm.listarQuarentena();
  assert.equal(q.length, MAX_QUARENTENA);
  assert.deepEqual(q.map((x) => x.nome), ['q4', 'q3', 'q2'], 'as mais novas ficam');
  assert.equal(q[0].origem, 'auto1');
  assert.deepEqual([...(await arm.bytes(q[0].slot))], [4], 'a cópia guarda os bytes');
  assert.equal(await arm.ler('auto1'), null, 'o espaço fica livre');
  assert.deepEqual((await arm.listar()).map((m) => m.slot), ['manual1'], 'a quarentena não aparece na lista');
  arm.travar('importacao');
  assert.equal(arm.importacaoInterrompida(), true, 'a marca fica na sessão (a página que cair sabe)');
  assert.deepEqual(await arm.gravar('manual2', new Uint8Array(1), {}), { ok: false, codigo: 'ocupado', motivo: 'importacao' });
  assert.ok((await arm.gravar('manual2', new Uint8Array(1), {}, { ignorarTrava: true })).ok, 'só o arquivo importado passa');
  arm.destravar();
  assert.equal(arm.importacaoInterrompida(), false);
});

// ------------------------------------------------------------------------------------------------ diário

test('diário: grava na hora com o carimbo, junta o livro, solta a base velha; outra página que gravou depois para esta', () => {
  const ls = armazenamento();
  let relogio = 100;
  const A = criarDiario({ local: localSeguro(ls), sessao: 'A', agora: () => (relogio += 1) });
  const livro = { entradas: [], get ultimoSeq() { return this.entradas.length ? this.entradas[this.entradas.length - 1][1] : 0; }, desde(s) { return this.entradas.filter((e) => e[1] > s); } };
  const sim = { tique: 0, livro };
  A.comecar({ partida: 'p1', ramo: 'r1', base: { slot: 'auto1', criado: 7, tique: 0, seq: 0 }, tique: 0 });
  const d0 = lerDiario(ls.getItem(SAVE.chaves.diario));
  assert.equal(d0.partida, 'p1');
  assert.equal(d0.carimbo.sessao, 'A');
  livro.entradas.push([3, 1, 'via.construir', { x: 1 }], [5, 2, 'zona.pintar', { y: 2 }]);
  sim.tique = 9;
  assert.equal(A.acompanhar(sim), true);
  assert.equal(A.talvez(0), true, 'comando novo: grava');
  assert.equal(A.talvez(500), false, 'menos de 1 s depois e nada novo: não grava');
  sim.tique = 10;
  A.acompanhar(sim);
  assert.equal(A.talvez(1200), true, 'o tique anda: grava a cada segundo');
  const d1 = lerDiario(ls.getItem(SAVE.chaves.diario));
  assert.equal(d1.tique, 10);
  assert.deepEqual(d1.cmds.map((e) => e[1]), [1, 2]);
  assert.ok(A.fixarBase({ slot: 'auto2', criado: 9, tique: 4, seq: 1 }));
  assert.deepEqual(lerDiario(ls.getItem(SAVE.chaves.diario)).cmds.map((e) => e[1]), [2], 'o que o save já tem sai');
  assert.equal(A.fixarBase({ slot: 'auto3', criado: 1, tique: 2, seq: 0 }), false, 'base mais velha não troca');
  // outra aba assume a mesma partida e grava depois: A para de gravar (e o app recarrega ao voltar)
  const B = criarDiario({ local: localSeguro(ls), sessao: 'B', agora: () => (relogio += 1) });
  B.comecar({ partida: 'p1', ramo: 'r1', base: { slot: 'auto2', criado: 9, tique: 4, seq: 1 }, cmds: [[5, 2, 'zona.pintar', { y: 2 }]], tique: 10 });
  assert.equal(A.outraPagina(), true);
  assert.equal(A.gravar(), false);
  assert.equal(A.parado, 'outraPagina');
  assert.equal(lerDiario(ls.getItem(SAVE.chaves.diario)).carimbo.sessao, 'B', 'o diário da aba nova fica');
  assert.equal(lerDiario('{"v":1}'), null);
  assert.equal(lerDiario('nao e json'), null);
  // o localStorage cheio recusa a gravação: o diário pede um save (que o esvazia) e volta a gravar quando cabe
  let cabe = false;
  const C = criarDiario({ local: { get: () => null, set: () => cabe, remove() {} }, sessao: 'C', agora: () => (relogio += 1) });
  C.comecar({ partida: 'p2', ramo: 'r2', base: { slot: 'auto1', criado: 1, tique: 0, seq: 0 }, tique: 0 });
  assert.equal(C.cheio(), true, 'recusou: pede save');
  cabe = true;
  assert.equal(C.gravar(), true);
  assert.equal(C.cheio(), false);
});

// ------------------------------------------------------------------------------------------------ salvamento

test('salvamento: nova partida, save, comandos e a página morre no meio de um save: continuar volta ao mesmo tique e estado', async () => {
  const banco = bancoNaMemoria();
  const ls = armazenamento();
  const relogio = { t: 1e6 };
  const A = pagina({ banco, ls, sessao: 'A', relogio, sim: criarSimulacao({ semente: SEMENTE, holding: { nome: 'Holding Held', cor: '#c9a86a' }, modo: 'normal' }) });
  const r0 = await A.S.comecarNova({ semente: SEMENTE, nome: 'Holding Held', cor: '#c9a86a', criador: 'Diogo Holanda' });
  assert.ok(r0.ok && r0.slot === 'auto1', 'o primeiro save sai na hora');
  assert.equal(r0.meta.nome, 'Holding Held');
  assert.equal(r0.meta.mes, 1);
  assert.deepEqual(construirAvenida(A.sim), [true, true, true], 'a avenida sugerida do nó de entrada ao portão norte constrói');
  A.sim.rodar(90, { sincrono: true });
  const r1 = await A.S.salvar('manual');
  assert.ok(r1.ok);
  assert.equal(r1.slot, 'manual1');
  assert.equal(A.S.diario.atual.cmds.length, 0, 'o save leva os comandos e o diário esvazia');
  A.sim.cmd('emprestimo.tomar', { valor: 1000 });
  A.sim.rodar(45, { sincrono: true });
  A.S.diario.acompanhar(A.sim);
  // o save começa (o retrato e o diário saem na hora) e a página morre antes do IndexedDB terminar
  const gravarDeVerdade = banco.gravar;
  banco.gravar = () => new Promise(() => {});
  A.S.salvar('auto');
  await new Promise((ok) => setTimeout(ok, 50));
  banco.gravar = gravarDeVerdade;
  const antes = { tique: A.sim.tique, seq: A.sim.livro.ultimoSeq, hash: A.sim.hash(), creditos: A.sim.q.barra().creditos };
  // página nova, mesmo banco e mesmo localStorage
  const B = pagina({ banco, ls, sessao: 'B', relogio });
  const r2 = await B.S.continuar();
  assert.ok(r2.ok, JSON.stringify(r2));
  assert.equal(r2.slot, 'manual1', 'a base é o último save que terminou');
  assert.equal(r2.reproduzidos, 1, 'o empréstimo veio do diário');
  assert.deepEqual({ tique: B.sim.tique, seq: B.sim.livro.ultimoSeq, hash: B.sim.hash(), creditos: B.sim.q.barra().creditos }, antes, 'nenhum tique nem comando perdido');
  assert.equal(B.S.E.partida, A.S.E.partida, 'a mesma partida');
  assert.equal(B.S.E.ramo, A.S.E.ramo, 'a mesma linhagem');
});

test('salvamento: o save que terminou mas não fixou a base também serve; carregar um espaço velho abre outra linhagem', async () => {
  const banco = bancoNaMemoria();
  const ls = armazenamento();
  const relogio = { t: 2e6 };
  const A = pagina({ banco, ls, sessao: 'A', relogio });
  await A.S.comecarNova({ semente: SEMENTE, nome: 'Held', cor: '#3f6fb5' });
  A.sim.rodar(30, { sincrono: true });
  A.sim.cmd('emprestimo.tomar', { valor: 2000 });
  // o save entra no banco mas a página morre antes de o diário trocar a base
  const fixar = A.S.diario.fixarBase;
  A.S.diario.fixarBase = () => false;
  const r = await A.S.salvar('auto');
  A.S.diario.fixarBase = fixar;
  assert.ok(r.ok);
  A.sim.rodar(20, { sincrono: true });
  A.S.diario.acompanhar(A.sim);
  A.S.diario.gravar();
  const d = A.S.diario.ler();
  const metas = await A.S.listarSaves();
  assert.ok(serveAoDiario(metas.find((m) => m.slot === r.slot), d), 'o save novo é da linhagem e está entre a base e o tique');
  assert.equal(ordemContinuar(metas, d)[0].meta.slot, r.slot, 'o mais adiantado da linhagem primeiro');
  const hash = A.sim.hash();
  const B = pagina({ banco, ls, sessao: 'B', relogio });
  const c = await B.S.continuar();
  assert.equal(c.slot, r.slot);
  assert.equal(B.sim.tique, A.sim.tique);
  assert.equal(B.sim.hash(), hash);
  // carregar o primeiro save (volta no tempo): sem o diário, linhagem nova
  const c2 = await B.S.carregar('auto1');
  assert.ok(c2.ok);
  assert.equal(B.sim.tique, 0);
  assert.notEqual(B.S.E.ramo, A.S.E.ramo, 'outro futuro');
  assert.equal(B.S.E.partida, A.S.E.partida, 'a mesma partida');
});

test('salvamento: save danificado vai para a quarentena e o anterior abre; a partida que caiu antes do primeiro save volta pelo diário', async () => {
  const banco = bancoNaMemoria();
  const ls = armazenamento();
  const relogio = { t: 3e6 };
  const A = pagina({ banco, ls, sessao: 'A', relogio });
  await A.S.comecarNova({ semente: SEMENTE, nome: 'Held', cor: '#c9a86a' });
  A.sim.rodar(10, { sincrono: true });
  const r = await A.S.salvar('manual');
  // estraga o save mais novo (o do diário)
  const ruim = new Uint8Array(banco.lojas.saves.get(r.slot));
  ruim[ruim.length - 9] ^= 0xff;
  banco.lojas.saves.set(r.slot, ruim);
  const B = pagina({ banco, ls, sessao: 'B', relogio });
  const c = await B.S.continuar();
  assert.ok(c.ok);
  assert.deepEqual(c.danificados, [r.slot]);
  assert.equal(c.slot, 'auto1', 'abriu o anterior');
  assert.equal(B.sim.tique, 10, 'e o diário levou ao tique gravado');
  assert.equal((await B.S.quarentena()).length, 1);
  // partida sem save nenhum: a semente, a identidade e os comandos do diário
  const ls2 = armazenamento();
  const C = pagina({ banco: bancoNaMemoria(), ls: ls2, sessao: 'C', relogio });
  C.S.diario.comecar({ partida: 'px', ramo: 'rx', base: { nova: { semente: SEMENTE, holding: { nome: 'Held', cor: '#c9a86a' }, modo: 'normal' } }, tique: 0 });
  C.S.E.ativo = true;
  construirAvenida(C.sim);
  C.sim.rodar(15, { sincrono: true });
  C.S.diario.acompanhar(C.sim);
  C.S.diario.gravar();
  const hash = C.sim.hash();
  // os saves de outra partida no banco não passam na frente: o diário é da última partida jogada
  const bancoD = bancoNaMemoria();
  await bancoD.gravar([{ loja: 'saves', chave: 'auto1', valor: banco.lojas.saves.get('auto1') }, { loja: 'meta', chave: 'auto1', valor: { ...banco.lojas.meta.get('auto1') } }]);
  const D = pagina({ banco: bancoD, ls: ls2, sessao: 'D', relogio });
  const c2 = await D.S.continuar();
  assert.ok(c2.ok);
  assert.equal(c2.slot, null, 'voltou pelo diário, não pelo save da outra partida');
  assert.equal(D.sim.tique, 15);
  assert.equal(D.sim.hash(), hash);
  let daPartida = [];
  for (let i = 0; i < 200 && !daPartida.length; i++) {
    await new Promise((ok) => setTimeout(ok, 10));
    daPartida = (await D.S.listarSaves()).filter((m) => m.partida === 'px');
  }
  assert.equal(daPartida.length, 1, 'e já salvou a partida reconstruída');
  assert.equal(daPartida[0].tique, 15);
});

test('salvamento: carregar o automático mais velho não grava por cima dele; a identidade da nova partida volta pelo diário; apagar a base salva de novo', async () => {
  const banco = bancoNaMemoria();
  const ls = armazenamento();
  const relogio = { t: 5e6 };
  const A = pagina({ banco, ls, sessao: 'A', relogio });
  await A.S.comecarNova({ semente: SEMENTE, nome: 'Held', cor: '#c9a86a' });
  for (let i = 0; i < 2; i++) {
    A.sim.rodar(10, { sincrono: true });
    await A.S.salvar('auto');
  }
  A.sim.rodar(10, { sincrono: true });
  assert.deepEqual((await A.S.listarSaves()).map((m) => [m.slot, m.tique]), [['auto3', 20], ['auto2', 10], ['auto1', 0]]);
  // o save de segurança (tique 30) vai para o rodízio sem o auto1, que é o que o jogador quer abrir
  const c = await A.S.carregar('auto1');
  assert.ok(c.ok);
  assert.equal(A.sim.tique, 0, 'abriu o save velho, não o de segurança');
  assert.deepEqual((await A.S.listarSaves()).map((m) => [m.slot, m.tique]), [['auto2', 30], ['auto3', 20], ['auto1', 0]]);
  // apagar a base do diário da partida em jogo: um save novo vira a base
  const base = A.S.diario.atual.base.slot;
  A.sim.rodar(5, { sincrono: true });
  await A.S.apagarSave(base);
  assert.notEqual(A.S.diario.atual.base.slot, base, 'o diário tem base de novo');
  assert.ok((await A.S.listarSaves()).some((m) => m.slot === A.S.diario.atual.base.slot && m.tique === 5));
  // nova partida do app: a identidade (com o criador) entra antes do diário; a aba cai antes do primeiro save
  const banco2 = bancoNaMemoria();
  const ls2 = armazenamento();
  const B = pagina({ banco: banco2, ls: ls2, sessao: 'B', relogio, sim: criarSimulacao({ semente: SEMENTE, holding: { nome: 'Holding Held', cor: '#c9a86a' }, modo: 'normal' }) });
  B.sim.cmd('holding.identidade', { nome: 'Holding Held', cor: '#c9a86a', modo: 'normal', criador: 'Diogo Holanda' });
  const gravar = banco2.gravar;
  banco2.gravar = () => new Promise(() => {});
  B.S.comecarNova({ semente: SEMENTE, nome: 'Holding Held', cor: '#c9a86a', criador: 'Diogo Holanda' });
  await new Promise((ok) => setTimeout(ok, 30));
  banco2.gravar = gravar;
  B.sim.cmd('emprestimo.tomar', { valor: 1000 });
  B.sim.rodar(12, { sincrono: true });
  B.S.diario.acompanhar(B.sim);
  B.S.diario.gravar();
  const antes = { tique: B.sim.tique, seq: B.sim.livro.ultimoSeq, hash: B.sim.hash() };
  // o menu mostra o que o Continuar abre: a partida do diário (sem save ainda), não o último save de outra partida
  const resumo = resumoContinuar(await A.S.listarSaves(), B.S.diario.ler());
  assert.deepEqual([resumo.nome, resumo.populacao, resumo.mes, resumo.ano, resumo.data], ['Holding Held', null, 1, 1, null]);
  const doA = resumoContinuar(await A.S.listarSaves(), A.S.diario.ler());
  assert.equal(doA.slot, A.S.diario.atual.base.slot, 'com save: o da linhagem do diário');
  const C = pagina({ banco: banco2, ls: ls2, sessao: 'C', relogio });
  const r = await C.S.continuar();
  assert.ok(r.ok && r.slot === null, 'voltou pelo diário');
  assert.deepEqual({ tique: C.sim.tique, seq: C.sim.livro.ultimoSeq, hash: C.sim.hash() }, antes, 'a identidade não se perde: mesmo seq e mesmo hash');
});

test('salvamento: exportar e importar (conferido inteiro, abre na hora); arquivo estranho não entra', async () => {
  const relogio = { t: 4e6 };
  const A = pagina({ banco: bancoNaMemoria(), ls: armazenamento(), sessao: 'A', relogio, sim: criarSimulacao({ semente: SEMENTE, holding: { nome: 'Exportada', cor: '#8e3b46' } }) });
  await A.S.comecarNova({ semente: SEMENTE, nome: 'Exportada', cor: '#8e3b46' });
  A.sim.rodar(25, { sincrono: true });
  await A.S.salvar('manual');
  const ex = await A.S.exportar();
  assert.ok(ex.ok);
  assert.match(ex.nome, /^heldopolis-exportada-\d{4}-\d{2}-\d{2}\.held$/);
  const B = pagina({ banco: bancoNaMemoria(), ls: armazenamento(), sessao: 'B', relogio });
  const r = await B.S.importar(ex.bytes);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.slot, 'manual1');
  assert.equal(B.sim.tique, 25);
  assert.equal(B.sim.hash(), A.sim.hash());
  assert.equal(B.S.arm.travado(), null, 'a trava solta no fim');
  assert.equal((await B.S.importar(new TextEncoder().encode('não é um save'))).codigo, 'valor');
});

// ------------------------------------------------------------------------------------------------ interface

let pacote = null;
async function ui() {
  if (pacote) return pacote;
  const { build } = await import('esbuild');
  const abs = (p) => JSON.stringify(fonte(p));
  const entrada = `
    export * as regras from ${abs('ui/guia/regras.js')};
    export * as loja from ${abs('ui/loja.js')};
    export * as dicas from ${abs('ui/guia/dicas.js')};
    export * as nova from ${abs('ui/inicio/NovaPartida.jsx')};
    export * as carga from ${abs('ui/inicio/carga.js')};
    export * as comum from ${abs('ui/inicio/corpo/comum.js')};
    export * as cfg from ${abs('ui/inicio/corpo/Configuracoes.jsx')};
    export * as td from ${abs('ui/inicio/corpo/TesteDesempenho.jsx')};
    export * as textos from ${abs('ui/textos.js')};
    export * as fmt from ${abs('ui/formato.js')};
  `;
  const r = await build({
    stdin: { contents: entrada, resolveDir: RAIZ, loader: 'js' }, bundle: true, write: false, format: 'esm', platform: 'node',
    logLevel: 'silent', jsx: 'automatic', jsxImportSource: 'preact', nodePaths: [join(RAIZ, 'node_modules')],
  });
  pacote = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  return pacote;
}

test('primeira hora: o mapa da SEDE3 sugere a avenida até o portão norte, as quadras, a captação e a usina; os comandos passam na prévia', async () => {
  const { regras } = await ui();
  const sim = criarSimulacao({ semente: SEMENTE });
  const lista = sim.q.sugestoes();
  const av = lista.find((s) => s.id === 'avenida');
  assert.deepEqual(av.pontos[0], [60, -700], 'sai do nó de entrada');
  assert.ok(Math.abs(av.pontos.at(-1)[0] - 200) < 1 && av.pontos.at(-1)[1] < -600, 'chega ao portão norte da sede');
  const objetivos = [{ id: 'cidade.avenida', feito: 0, total: 1 }, { id: 'holding.escritorio', feito: 0, total: 1 }];
  const abertas = regras.sugestoesAbertas({ objetivos, lista });
  assert.deepEqual(abertas.map((s) => s.id), ['avenida', 'escritorio']);
  assert.deepEqual(regras.sugestoesAbertas({ objetivos, lista, dicas: false }), [], 'sem dicas, sem traçado');
  assert.deepEqual(regras.sugestoesAbertas({ objetivos: [{ id: 'cidade.avenida', feito: 1, total: 1 }], lista }), [], 'feito some');
  assert.equal(regras.ferramentaServe(av, { tipo: 'via' }), true);
  assert.equal(regras.ferramentaServe(av, { tipo: 'zona' }), false);
  assert.equal(regras.ferramentaServe(lista.find((s) => s.id === 'captacao'), { tipo: 'colocar', item: { tipo: 'captacao' } }), true);
  // a avenida e a primeira quadra pelos comandos do "Usar sugestão": a prévia aceita cada trecho
  for (const [nome, args] of regras.comandosDaSugestao(av)) {
    assert.equal(nome, 'via.construir');
    const pv = sim.q.via.previa(args.plano);
    assert.ok(pv.ok, `trecho ${JSON.stringify(args.plano.pontos)}: ${JSON.stringify(pv.erros)}`);
    assert.ok(sim.cmd(nome, args).ok);
  }
  const quadra = lista.find((s) => s.id === 'quadra1');
  const cmds = regras.comandosDaSugestao(quadra);
  assert.deepEqual(cmds.map((c) => c[0]), ['via.construir', 'zona.pintar']);
  assert.ok(sim.q.via.previa(cmds[0][1].plano).ok, 'a grade da primeira quadra cabe fora do disco da sede');
  // a captação e a usina na rua da Vila: o "Usar sugestão" encaixa pela prévia (de frente para a via), como a ferramenta
  const previa = (p) => sim.q.construir.previa(p);
  for (const id of ['captacao', 'usina']) {
    const [[nome, args]] = regras.comandosDaSugestao(lista.find((s) => s.id === id), 'teste', previa);
    const r = sim.cmd(nome, args);
    assert.ok(r.ok, `${id}: ${JSON.stringify(r)}`);
  }
  assert.equal(regras.categoriaGuiada({ objetivos }), 'vias', 'o anel aponta Vias');
  assert.equal(regras.categoriaGuiada({ objetivos, ferramenta: 'via' }), null, 'com a ferramenta aberta, o anel sai');
});

test('primeira hora: a avenida sugerida fecha o objetivo e o anel e o traçado saem', async () => {
  const { regras } = await ui();
  const sim = criarSimulacao({ semente: SEMENTE });
  const av = sim.q.sugestoes().find((s) => s.id === 'avenida');
  for (const [nome, args] of regras.comandosDaSugestao(av)) assert.ok(sim.cmd(nome, args).ok);
  sim.rodar(40, { sincrono: true });
  const objetivos = sim.q.barra().objetivos;
  const o = objetivos.find((x) => x.id === 'cidade.avenida');
  assert.ok(!o || o.feito >= o.total, `objetivo da avenida: ${JSON.stringify(o)}`);
  assert.deepEqual(regras.sugestoesAbertas({ objetivos, lista: sim.q.sugestoes() }).map((s) => s.id).includes('avenida'), false);
});

/** A interface mínima do "Usar sugestão" sobre a simulação de verdade (consultas e comandos síncronos, Promise na volta). */
function uiDaSim(sim, pedidos = [], avisos = []) {
  return {
    SESSAO: 'teste',
    obterSim: () => sim,
    consultar: (nome, ...a) => nome.split('.').reduce((o, k) => o?.[k], sim.q)?.(...a) ?? null,
    comando: async (nome, args) => (pedidos.push([nome, args]), sim.cmd(nome, args)),
    loja: { avisar: (x) => avisos.push(x) },
    frase: (r) => r.codigo,
  };
}

test('primeira hora (C1d): a Vila e a ligação no guia; as ruas de terra num via.melhorar com as arestas relidas na hora', async () => {
  const { regras } = await ui();
  const sim = criarSimulacao({ semente: SEMENTE });
  assert.equal(regras.SUGESTAO_DO_OBJETIVO['cidade.vila'], 'vila');
  assert.equal(regras.SUGESTAO_DO_OBJETIVO['cidade.ligacao'], 'ligacao');
  const vila = [{ id: 'cidade.vila', feito: 0, total: 60 }];
  assert.equal(regras.categoriaGuiada({ objetivos: vila }), 'vias', 'a Vila na rede aponta Vias');
  assert.equal(regras.categoriaGuiada({ objetivos: [{ id: 'cidade.ligacao', feito: 0, total: 1 }] }), 'vias');
  const lista = sim.q.sugestoes();
  const v = lista.find((s) => s.id === 'vila');
  assert.equal(v.tipo, 'melhorar');
  assert.ok(v.arestas.length >= 4, `ruas de terra: ${v.arestas.length}`);
  assert.deepEqual(regras.sugestoesAbertas({ objetivos: vila, lista }).map((s) => s.id), ['vila']);
  assert.deepEqual(regras.sugestoesAbertas({ objetivos: [{ id: 'cidade.ligacao', feito: 0, total: 1 }], lista }).map((s) => s.id), ['ligacao']);
  assert.equal(regras.ferramentaServe(v, { tipo: 'via', maquina: { modo: 'melhorar' } }), true, 'a ferramenta de via serve');
  assert.equal(regras.ferramentaServe(v, { tipo: 'zona' }), false);
  assert.deepEqual(regras.comandosDaSugestao(v, 'teste'), [['via.melhorar', { arestas: v.arestas, tipo: v.via, sessao: 'teste.melhorar' }]]);
  // o traçado de cada rua: a curva do espelho (9 pontos, nas pontas os nós da sugestão)
  const tracos = regras.tracosDaMelhoria(v, sim.espelho.vias.arestas);
  assert.equal(tracos.length, v.arestas.length);
  for (const [k, tr] of tracos.entries()) {
    assert.equal(tr.length, 9);
    const ponta = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.5;
    assert.ok((ponta(tr[0], v.pontos[2 * k]) && ponta(tr[8], v.pontos[2 * k + 1])) || (ponta(tr[0], v.pontos[2 * k + 1]) && ponta(tr[8], v.pontos[2 * k])), `rua ${k}`);
  }
  assert.equal(regras.tracosDaMelhoria(v, null).length, v.arestas.length, 'sem o espelho, o par de nós');
  // o jogador melhora uma rua antes: o "Usar sugestão" relê as arestas na hora e não manda a que já é rua
  const [primeira] = v.arestas;
  assert.ok(sim.cmd('via.melhorar', { arestas: [primeira], tipo: v.via, sessao: 'jogador' }).ok);
  const pedidos = [];
  const avisos = [];
  const r = await regras.usarSugestao(uiDaSim(sim, pedidos, avisos), v);
  assert.ok(r.ok, JSON.stringify({ r, pedidos: pedidos.map((p) => p[0]), avisos }));
  assert.equal(pedidos[0][0], 'via.melhorar');
  assert.ok(!pedidos[0][1].arestas.includes(primeira), 'a rua já melhorada saiu da lista relida');
  assert.deepEqual(avisos, []);
  assert.equal(sim.q.sugestoes().find((s) => s.id === 'vila'), undefined, 'sem rua de terra, a sugestão some');
  // de novo, sem nada a melhorar: nada a mandar e nenhum aviso
  const r2 = await regras.usarSugestao(uiDaSim(sim, pedidos, avisos), v);
  assert.deepEqual(r2, { ok: false, feitos: 0 });
  assert.equal(pedidos.length, 1);
  assert.deepEqual(avisos, []);
});

test('primeira hora (C1d): a Pedreira sem acesso aponta a avenida (Vias); com a avenida, a Pedreira; construída, sai', async () => {
  const { regras } = await ui();
  const sim = criarSimulacao({ semente: SEMENTE });
  const lista = sim.q.sugestoes();
  const pedreira = lista.find((s) => s.id === 'pedreira');
  const av = lista.find((s) => s.id === 'avenida');
  let consultas = 0;
  const previaDe = (s) => (consultas++, sim.q.construir.previa({ tipo: s.construir, x: s.x, z: s.z, rot: s.rot ?? 0 }));
  assert.equal(previaDe(pedreira).codigo, 'acesso', 'antes da avenida, a Pedreira não tem via');
  assert.equal(regras.viaQueServe(pedreira, lista), av, 'a avenida passa ao lado dela');
  const objetivos = [{ id: 'cidade.zonas', feito: 0, total: 300 }, { id: 'holding.pedreiraAreal', feito: 0, total: 2 }];
  let itens = regras.resolverSugestoes({ objetivos, lista, previaDe });
  assert.deepEqual(itens.map((x) => [x.objetivo, x.s.id, x.de?.id ?? null]), [['cidade.zonas', 'quadra1', null], ['holding.pedreiraAreal', 'avenida', 'pedreira']]);
  assert.deepEqual(regras.sugestoesAbertas({ objetivos, lista, previaDe }).map((s) => s.id), ['quadra1', 'avenida']);
  // o anel: com a troca, a Holding aponta Vias (a avenida primeiro), não Empresas
  const so = [objetivos[1]];
  assert.equal(regras.categoriaGuiada({ objetivos: so }), 'empresas');
  assert.equal(regras.categoriaGuiada({ objetivos: so, trocas: { 'holding.pedreiraAreal': 'vias' } }), 'vias');
  // com a avenida e a avenida aberta junto, a troca não repete o traçado
  assert.deepEqual(regras.sugestoesAbertas({ objetivos: [{ id: 'cidade.avenida', feito: 0, total: 1 }, ...so], lista, previaDe }).map((s) => s.id), ['avenida']);
  for (const [nome, args] of regras.comandosDaSugestao(av)) assert.ok(sim.cmd(nome, args).ok);
  itens = regras.resolverSugestoes({ objetivos: so, lista, previaDe });
  assert.deepEqual(itens.map((x) => x.s.id), ['pedreira'], 'com a avenida, a Pedreira volta');
  // construída no lugar sugerido: a prévia recusa o lugar e o fantasma sai (o objetivo espera as linhas)
  const [[nome, args]] = regras.comandosDaSugestao(pedreira, 'teste', (p) => sim.q.construir.previa(p));
  assert.ok(sim.cmd(nome, args).ok);
  assert.deepEqual(regras.resolverSugestoes({ objetivos: so, lista, previaDe }), []);
  // sem dinheiro a sugestão fica (o jogador junta); o 'acesso' sem via sugerida perto some
  assert.deepEqual(regras.resolverSugestoes({ objetivos: so, lista, previaDe: () => ({ ok: false, codigo: 'creditos' }) }).map((x) => x.s.id), ['pedreira']);
  assert.deepEqual(regras.resolverSugestoes({ objetivos: so, lista: [pedreira], previaDe: () => ({ ok: false, codigo: 'acesso' }) }), []);
  assert.ok(consultas > 0);
});

test('primeira hora (C1d): a lista do mapa é relida quando os objetivos mudam ou chega um evento que muda o mapa, nunca por quadro', async () => {
  const { regras, loja } = await ui();
  const sim = criarSimulacao({ semente: SEMENTE });
  let nSug = 0;
  let nPrevia = 0;
  const q0 = sim.q.sugestoes;
  const p0 = sim.q.construir.previa;
  sim.q.sugestoes = (...a) => (nSug++, q0(...a));
  sim.q.construir.previa = (...a) => (nPrevia++, p0(...a));
  const ui1 = { obterSim: () => sim };
  loja.reiniciarLoja();
  loja.aplicarBarra({ ...loja.barra.peek(), objetivos: [{ id: 'cidade.vila', feito: 0, total: 60 }, { id: 'holding.pedreiraAreal', feito: 0, total: 2 }] });
  const ids = () => regras.sugestoesAgora(ui1).map((x) => x.s.id);
  assert.deepEqual(ids(), ['vila', 'avenida']);
  const n0 = regras.sugestoesAgora(ui1).find((x) => x.s.id === 'vila').s.arestas.length;
  for (let k = 0; k < 30; k++) regras.sugestoesAgora(ui1);
  assert.equal(regras.categoriaAgora(ui1), 'vias', 'o anel aponta Vias');
  assert.equal(nSug, 1, 'a lista não é relida a cada quadro');
  assert.equal(nPrevia, 1, 'nem a prévia da Pedreira');
  // um evento que não muda o mapa: nada
  loja.registrarEvento('financas', {});
  regras.sugestoesAgora(ui1);
  assert.equal(nSug, 1);
  // duas ruas melhoradas pelo jogador: o evento 'construido' faz reler, e a sugestão 'vila' encolhe
  const v = sim.q.sugestoes().find((s) => s.id === 'vila');
  nSug = 0;
  assert.ok(sim.cmd('via.melhorar', { arestas: v.arestas.slice(0, 2), tipo: v.via, sessao: 'jogador' }).ok);
  loja.registrarEvento('construido', { tipo: 'via', refs: v.arestas.slice(0, 2) });
  const v2 = regras.sugestoesAgora(ui1).find((x) => x.s.id === 'vila').s;
  assert.equal(v2.arestas.length, n0 - 2);
  assert.equal(nSug, 1);
  // o objetivo da Vila fechou e abriu a ligação: relê pela chave dos objetivos
  loja.aplicarBarra({ ...loja.barra.peek(), objetivos: [{ id: 'cidade.ligacao', feito: 0, total: 1 }] });
  assert.deepEqual(ids(), ['ligacao']);
  assert.equal(nSug, 2);
  // outra partida: lista própria
  const outra = criarSimulacao({ semente: SEMENTE });
  assert.deepEqual(regras.sugestoesAgora({ obterSim: () => outra }).map((x) => x.s.id), ['ligacao']);
  loja.reiniciarLoja();
});

test('dicas: uma por vez, cada uma uma vez, a da velocidade só no mouse; nova partida e textos da U2', async () => {
  const { dicas, nova, comum, textos, fmt, cfg, td } = await ui();
  const e = { ferramenta: 'via', alertas: [], velocidade: 0, tique: 0, segundos: 30, caixaBaixo: false, toque: false };
  assert.equal(dicas.proximaDica(e).id, 'via');
  assert.equal(dicas.proximaDica(e, ['via']), null);
  assert.equal(dicas.proximaDica({ ...e, ferramenta: null }).id, 'velocidade');
  assert.equal(dicas.proximaDica({ ...e, ferramenta: null, toque: true }), null);
  assert.equal(dicas.proximaDica({ ...e, ferramenta: null, alertas: [{ codigo: 'semAgua' }] }).id, 'avisos');
  assert.equal(nova.PARTIDA_PADRAO.nome, 'Holding Held');
  assert.equal(nova.PARTIDA_PADRAO.criador, 'Diogo Holanda');
  assert.equal(nova.CORES_HOLDING.length, 6);
  for (const c of nova.CORES_HOLDING) assert.match(c.cor, /^#[0-9a-f]{6}$/);
  assert.deepEqual(nova.conferirPartida({ nome: '  ', criador: 'x' }), { ok: false, campo: 'nome' });
  assert.deepEqual(nova.conferirPartida({ nome: ' Held ', criador: ' Diogo ' }), { ok: true, nome: 'Held', criador: 'Diogo' });
  assert.equal(fmt.dataCalendario({ mes: 1, ano: 1 }), 'jan. 2020', 'D67: começa em jan. 2020');
  const agora = Date.UTC(2026, 9, 3, 12);
  assert.equal(comum.haQuanto(agora - 30e3, agora), 'agora há pouco');
  assert.equal(comum.haQuanto(agora - 12 * 60e3, agora), 'há 12 min');
  assert.equal(comum.haQuanto(agora - 3 * 3600e3, agora), 'há 3 h');
  assert.match(comum.haQuanto(agora - 50 * 3600e3, agora), /^em \d{2}\/\d{2}\/\d{4}$/, 'passado um ciclo, a data (sem a palavra da D42)');
  assert.equal(comum.rotuloSlot('auto2'), 'Automático 2');
  assert.equal(comum.rotuloSlot('manual7'), 'Espaço 7');
  assert.equal(comum.resumoSave({ nome: 'Holding Held', populacao: 12480, mes: 3, ano: 2021 }), 'Holding Held · 12.480 moradores · mar. 2021');
  assert.deepEqual(cfg.QUALIDADES, ['auto', 'ultra', 'alta', 'pc', 'media', 'leve'], 'o PC no seletor (pendência da I2)');
  assert.match(cfg.orcamentoEscrito('pc'), /800 chamadas e 2,5 mi triângulos/);
  assert.equal(cfg.abaVizinha('video', -1), 'sobre');
  // "Manter esta qualidade?": a contagem é do módulo (trocar de aba ou fechar a tela não confirma); sem "Manter", volta
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const pedidos = [];
    const prefs = { value: { qualidade: 'auto' }, peek() { return this.value; } };
    const uiFalsa = { jogo: { falso: true }, loja: { prefs }, R: { qualidade: (q) => pedidos.push(q) } };
    cfg.trocarQualidade(uiFalsa, 'pc');
    assert.deepEqual(cfg.manter.peek(), { de: 'auto', para: 'pc', resta: cfg.MANTER_S });
    cfg.trocarQualidade(uiFalsa, 'alta');
    assert.equal(cfg.manter.peek().de, 'auto', 'a de antes continua a primeira');
    mock.timers.tick(3000);
    assert.equal(cfg.manter.peek().resta, cfg.MANTER_S - 3);
    cfg.trocarQualidade(uiFalsa, 'auto');
    assert.equal(cfg.manter.peek(), null, 'de volta à de antes: nada a confirmar');
    cfg.trocarQualidade(uiFalsa, 'leve');
    mock.timers.tick(cfg.MANTER_S * 1000);
    assert.equal(prefs.value.qualidade, 'auto', 'sem confirmar, volta sozinha');
    assert.deepEqual(pedidos, ['pc', 'alta', 'auto', 'leve', 'auto']);
    assert.equal(cfg.manter.peek(), null);
  } finally {
    mock.timers.reset();
  }
  assert.equal(td.quadrosDoTeste(60), 1200);
  assert.equal(td.quadrosDoTeste(5), 120);
  const texto = td.textoDoResultado({ rel: { perfil: 'pc', sugerido: 'pc', motivo: 'RX 550: faixa do PC', qps: 41.2, resolucao: { w: 1536, h: 864, nativa: { w: 1920, h: 1080 }, modo: 'cronometro', alvoGpu: 15.5 }, gpuPasses: { terreno: 5.2, predios: 8 }, compilacoes: { programas: 58, depois: [] }, programas: [] }, longas: 2, quando: agora });
  for (const k of ['qualidade em uso: PC', 'motivo: RX 550: faixa do PC', 'resolução interna: 1536 x 864 (80% da nativa)', 'pelo cronômetro da placa, alvo de 15,5 ms', 'prédios: 8,00 ms', 'tarefas longas: 2', 'JSON']) assert.ok(texto.includes(k), `falta "${k}" no texto copiado`);
  // textos: toda chave u2 usada nos arquivos da parcela existe, nada proibido, nenhuma repetida
  const { verificarConteudo } = await import('../guarda-texto.mjs');
  assert.deepEqual(textos.chavesRepetidas(), []);
  const u2 = textos.chaves().filter((k) => k.startsWith('u2.'));
  for (const k of u2) assert.deepEqual(verificarConteudo(textos.t(k), ['travessao', 'aluguel', 'porDia', 'dia'], { js: false }), [], `texto proibido em ${k}`);
  const arquivos = ['app', 'som', 'ui/inicio', 'ui/guia'].flatMap((d) => listar(fonte(d))).concat([fonte('ui/telas/Configuracoes.jsx'), fonte('ui/telas/TesteDesempenho.jsx')]);
  const faltam = [];
  for (const f of arquivos) {
    for (const m of readFileSync(f, 'utf8').matchAll(/['`](u2\.[a-zA-Z0-9.]+)['`]/g)) if (!textos.temTexto(m[1])) faltam.push(`${m[1]} (${f.slice(RAIZ.length + 1)})`);
  }
  assert.deepEqual(faltam, []);
  const dinamicas = { 'u2.q': ['auto', 'ultra', 'alta', 'pc', 'media', 'leve'], 'u2.cfg.aba': cfg.ABAS, 'u2.cor': nova.CORES_HOLDING.map((c) => c.id), 'u2.dica': dicas.DICAS.map((d) => d.id) };
  for (const [pre, ids] of Object.entries(dinamicas)) for (const id of ids) assert.ok(textos.temTexto(`${pre}.${id}`), `${pre}.${id}`);
  for (const d of dicas.DICAS.filter((x) => x.mouse)) assert.ok(textos.temTexto(`u2.dica.${d.id}.mouse`), d.id);
});

function listar(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) out.push(...listar(f));
    else if (/\.(js|jsx)$/.test(n)) out.push(f);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ Chromium

const iChromium = process.argv.indexOf('--chromium');
if (iChromium >= 0) {
  test('Chromium: a página morre no meio de um save e a nova continua no mesmo tique, com o mesmo livro e hash', { timeout: 600000 }, async () => {
    const pasta = resolve(process.argv[iChromium + 1] || '');
    const { servir, abrirChromium } = await import('../testar.mjs');
    const srv = servir(pasta);
    const browser = await abrirChromium({ gl: true });
    try {
      const ctx = await browser.newContext({ viewport: { width: 1376, height: 768 }, serviceWorkers: 'block' });
      const url = (menu) => `http://localhost:${srv.porta}/index.html?menu=${menu}&q=leve`;
      // pronta: a carga saiu, a partida está ligada e o primeiro save (ou o carregado) já é a base do diário
      const pronto = (pg) => pg.waitForFunction(() => window.__pronto === true && window.__held?.app?.temPartida?.() && !!window.__held.app.salvamento.estado().marca, null, { timeout: 240000 });
      const pg = await ctx.newPage();
      const erros = [];
      pg.on('pageerror', (e) => erros.push(e.message));
      await pg.goto(url('nova'));
      await pronto(pg);
      const antes = await pg.evaluate(async () => {
        const { app } = window.__held;
        const sim = app.sim;
        const av = sim.q.sugestoes().find((s) => s.id === 'avenida');
        for (let k = 0; k + 1 < av.pontos.length; k++) sim.cmd('via.construir', { plano: { modo: 'reta', tipo: 'avenida', pontos: [av.pontos[k], av.pontos[k + 1]], sessao: `c.${k}` } });
        // umas dezenas de tiques de uma vez (o SwiftShader desenha poucos quadros): a reprodução atravessa a obra
        sim.rodar(40, { sincrono: true });
        sim.cmd('velocidade', { v: 3 });
        await new Promise((ok) => setTimeout(ok, 4000));
        sim.cmd('emprestimo.tomar', { valor: 1000 });
        await new Promise((ok) => setTimeout(ok, 1500));
        sim.cmd('velocidade', { v: 0 });
        // as tarefas do worker terminam com o jogo parado (o hash conta as pendentes)
        for (let i = 0; i < 100 && sim.tarefas.pendentes.length; i++) await new Promise((ok) => setTimeout(ok, 50));
        app.salvamento.atrasar(60000);
        app.salvar('manual');
        await new Promise((ok) => setTimeout(ok, 800));
        return { tique: sim.tique, seq: sim.livro.ultimoSeq, hash: sim.hash(), pendentes: sim.tarefas.pendentes.length, emCurso: app.salvamento.estado().emCurso, diario: JSON.parse(localStorage.getItem('heldopolis.diario')).tique };
      });
      assert.ok(antes.tique > 0, 'o jogo andou');
      assert.equal(antes.diario, antes.tique, 'o diário tem o tique exato do jogo parado');
      assert.equal(antes.emCurso.length, 1, 'o save estava no meio');
      // a aba morre sem pagehide nem visibilitychange (como o Android mata): o Page.crash não responde, então não espera
      const cdp = await ctx.newCDPSession(pg);
      cdp.send('Page.crash').catch(() => {});
      await new Promise((ok) => setTimeout(ok, 1500));
      await pg.close().catch(() => {});
      const pg2 = await ctx.newPage();
      pg2.on('pageerror', (e) => erros.push(e.message));
      await pg2.goto(url('continuar'));
      await pronto(pg2);
      const depois = await pg2.evaluate(() => {
        const sim = window.__held.app.sim;
        return { tique: sim.tique, seq: sim.livro.ultimoSeq, hash: sim.hash(), pendentes: sim.tarefas.pendentes.length };
      });
      assert.equal(depois.tique, antes.tique, 'nenhum tique perdido');
      assert.equal(depois.seq, antes.seq, 'nenhum comando perdido');
      if (!antes.pendentes && !depois.pendentes) assert.equal(depois.hash, antes.hash, 'o mesmo estado');
      assert.deepEqual(erros, []);
      console.log(`Chromium: tique ${antes.tique}, seq ${antes.seq}, hash ${antes.hash} antes e ${depois.hash} depois`);
    } finally {
      await browser.close();
      srv.fechar();
    }
  });
}
