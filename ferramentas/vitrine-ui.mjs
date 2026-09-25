// Vitrine da interface no celular, sem WebGL: empacota a simulação, o HUD, os painéis e os modais do Controle de
// verdade sobre a foto da maquete (o 3D é trocado por um mundo de mentira com a câmera da vista da foto) e captura
// cada painel, modal, o tutorial, a pílula de metas e os estados novos. Cerca de 1 s por captura: serve para
// iterar CSS sem disputar CPU com o renderizador por software.
// Uso: node ferramentas/vitrine-ui.mjs [pasta] [cenas separadas por vírgula | todas] [tamanhos: 986x443,915x412]
// Saída: <pasta>/<tamanho>-<cena>.png e <pasta>/ui.json (alvos < 44 px, textos < 11 px, área do HUD em repouso,
// retângulo da folha, erros de página). ANIMAR=1 deixa as animações de CSS ligadas.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const [saida = '/tmp/vitrine-ui', cenasArg = 'todas', tamArg = '986x443,915x412'] = process.argv.slice(2);
const pasta = resolve(saida); mkdirSync(pasta, { recursive: true });

// economia nova de mentira (só para a vitrine): quando a simulação ainda não tem o contrato (J.loteMax), estas
// funções imitam calendário, empréstimo, valuation, lotes, automático, aceleradores, renda por faixa, Depósito a
// 150% com 100 vendas e a Usina de Pedidos, para a interface ser vista e medida antes da mesclagem
function stubEconomia(J, S, REGRAS, PREDIOS, ITENS, PROJ) {
  if (typeof J.loteMax === 'function') return false;
  const DIA = 20000; Object.assign(REGRAS, { loteMax: 10, fLote: 0.8, aceleraH: 1, empAno: 50000, empMax: 500000, empTaxa: 0.1, empPrazoAnos: 10, empPasso: 1000, empMora: 0.2, offlineH: 12, offlineFator: 0.5, cofreH: 12, pedidoFator: 5, pedidoValor: 1.5 });
  S.calendario = S.calendario || { inicio: S.criado }; S.emprestimo = S.emprestimo || { principal: 0, juros: 0, contratos: [], ultimoJuro: S.t }; S.aceleradores = S.aceleradores || { obra: 0, producao: 0 }; S.valuationMax = S.valuationMax || 0;
  PREDIOS.usina2.nome = 'Usina de Pedidos da Comunidade'; PREDIOS.usina2.pedidos = true; PREDIOS.usina2.desc = 'Só fabrica itens que estão nos pedidos da comunidade: toque em Fabricar dentro de um pedido.';
  const cal = () => { const t = Math.max(0, J.agora - S.calendario.inicio); const dia = Math.floor(t / DIA); return { dia, diaDoMes: (dia % 30) + 1, mes: (Math.floor(dia / 30) % 12) + 1, ano: Math.floor(dia / 360) + 1, progDia: (t % DIA) / DIA, diaMs: DIA }; };
  J.calendario = cal;
  const divida = () => S.emprestimo.principal + S.emprestimo.juros;
  J.emprestimoInfo = () => { const E = S.emprestimo, ano = cal().ano; const tomado = E.contratos.filter((c) => c.ano === ano).reduce((a, c) => a + c.valor, 0); return { principal: E.principal, juros: E.juros, divida: divida(), disponivelAno: Math.max(0, 50000 - tomado), limiteAno: 50000, limiteDivida: 500000, taxaAno: 0.1, parcela: E.principal ? Math.min(E.principal, Math.max(1000, Math.ceil(E.principal / 10))) : 0, contratos: E.contratos.map((c) => ({ ...c, vencido: c.saldo > 0 && c.fim <= J.agora })), jurosPorDia: (E.principal * 0.1) / 360 }; };
  J.emprestar = (v) => { if (!(v >= 1000) || v % 1000) return 'valor'; const I = J.emprestimoInfo(); if (v > I.disponivelAno) return 'limiteAno'; if (divida() + v > 500000) return 'limiteDivida'; S.emprestimo.principal += v; S.emprestimo.contratos.push({ id: S.seq++, ano: cal().ano, valor: v, saldo: v, ini: J.agora, fim: J.agora + 10 * 360 * DIA }); S.creditos += v; J.emit('emprestimo', { tipo: 'tomou', valor: v }); J.emit('aviso', { texto: 'Empréstimo de ' + v.toLocaleString('pt-BR') + ' creditado', icone: 'emprestimo' }); return 'ok'; };
  J.pagarJuros = () => { const E = S.emprestimo; if (E.juros < 1) return 'nada'; const v = Math.min(S.creditos, Math.ceil(E.juros)); if (v < 1) return 'creditos'; S.creditos -= v; E.juros = Math.max(0, E.juros - v); J.emit('emprestimo', { tipo: 'juros', valor: v }); return 'ok'; };
  J.pagarParcela = () => { const E = S.emprestimo; const I = J.emprestimoInfo(); const tot = Math.ceil(E.juros) + I.parcela; if (tot < 1) return 'nada'; if (S.creditos < tot) return 'creditos'; S.creditos -= tot; E.juros = 0; let p = I.parcela; E.principal -= p; for (const c of E.contratos) { const a = Math.min(c.saldo, p); c.saldo -= a; p -= a; if (!p) break; } E.contratos = E.contratos.filter((c) => c.saldo > 0); J.emit('emprestimo', { tipo: 'parcela', valor: tot }); return 'ok'; };
  J.quitar = () => { const E = S.emprestimo; const tot = Math.ceil(divida()); if (tot < 1) return 'nada'; if (S.creditos < tot) return 'creditos'; S.creditos -= tot; E.principal = 0; E.juros = 0; E.contratos = []; J.emit('emprestimo', { tipo: 'quitou', valor: tot }); return 'ok'; };
  J.valuation = () => { let obras = 0; for (const [k, st] of Object.entries(S.etapas)) { if (st.estado !== 'feita') continue; const [pid, eid] = k.split('.'); const e = PROJ[pid]?.etapas.find((x) => x.id === eid); if (e) obras += 1.5 * (e.custo + Object.entries(e.itens).reduce((a, [it, n]) => a + n * (ITENS[it]?.valor || 0), 0)); } let modulos = 0; for (const arr of Object.values(S.modulos)) for (const m of arr) for (let n = 1; n <= m.nivel; n++) modulos += 1.5 * [0, 200, 700, 1800, 4500, 9000][n]; let predios = 0; for (const [id, p] of Object.entries(PREDIOS)) if (S.predios[id]?.ok) predios += p.custo || 0; const moradores = J.pop * 100, caixa = S.creditos - divida(); const total = Math.round(obras + modulos + predios + moradores + caixa); S.valuationMax = Math.max(S.valuationMax, total); return { total, partes: { obras: Math.round(obras), modulos: Math.round(modulos), predios, moradores, caixa: Math.round(caixa) } }; };
  J.loteMax = (oid, item) => { const req = ITENS[item]?.req || {}; let m = 10; for (const [k, n] of Object.entries(req)) m = Math.min(m, Math.floor((S.itens[k] || 0) / n)); return Math.max(0, m); };
  const produzir0 = J.produzir.bind(J), enf0 = J.enfileirar.bind(J);
  J.produzir = (uid, item, n = 1, auto = false) => { if (PREDIOS[uid]?.pedidos) return 'bloqueado'; const r = produzir0(uid, item); if (r !== 'ok') return r; const u = S.predios[uid]; const s = u.slots.filter(Boolean).pop(); n = Math.max(1, Math.min(10, n | 0)); s.n = n; s.auto = !!auto; if (n > 1) s.fim = s.ini + J.durItem(item) * n * 0.8; return 'ok'; };
  J.enfileirar = (oid, item, n = 1, auto = false, encadear = false) => { n = encadear ? 1 : Math.max(1, Math.min(10, n | 0)); const req = ITENS[item]?.req || {}; if (n > 1) { for (const [k, q] of Object.entries(req)) if ((S.itens[k] || 0) < q * n) return 'falta'; for (const [k, q] of Object.entries(req)) S.itens[k] -= q * (n - 1); } const r = enf0(oid, item, encadear); if (r !== 'ok') { if (n > 1) for (const [k, q] of Object.entries(req)) S.itens[k] += q * (n - 1); return r; } const f = S.predios[oid].fila[S.predios[oid].fila.length - 1]; f.n = n; if (f.fim && n > 1) f.fim = f.ini + J.durItem(item) * n * 0.8; if (auto) S.predios[oid].auto = { item, n }; return 'ok'; };
  J.setAuto = (uid, i, on) => { const s = S.predios[uid]?.slots[i]; if (!s) return 'nada'; s.auto = !!on; return 'ok'; };
  J.setAutoFila = (oid, on, item, n) => { S.predios[oid].auto = on ? { item, n: n || 1 } : null; return 'ok'; };
  J.cancelarSlot = (uid, i) => { const u = S.predios[uid]; if (!u?.slots[i]) return 'nada'; u.slots[i] = null; return 'ok'; };
  J.cancelarFila = (oid, j) => { const o = S.predios[oid]; const f = o.fila[j]; if (!f) return 'nada'; o.fila.splice(j, 1); if (!f.pend) for (const [k, q] of Object.entries(ITENS[f.item].req || {})) S.itens[k] += q * (f.n || 1); return 'ok'; };
  J.acelerar = (alvo) => { const A = S.aceleradores, a = J.agora, H = 3600e3; const ad = (x) => { x.fim = Math.max(a, x.fim - H); }; if (alvo.etapa) { const st = S.etapas[alvo.etapa]; if (st?.estado !== 'obra') return 'nada'; if (A.obra < 1) return 'sem'; ad(st); A.obra--; } else if (alvo.modulo) { const m = S.modulos[alvo.modulo[0]][alvo.modulo[1]]; if (m.obra?.estado !== 'obra') return 'nada'; if (A.obra < 1) return 'sem'; ad(m.obra); A.obra--; } else if (alvo.predio) { const p = S.predios[alvo.predio]; let ok = false; for (const s of p.slots || []) if (s && s.fim > a) { ad(s); ok = true; } const f = p.fila?.[0]; if (f?.fim > a) { ad(f); ok = true; } if (!ok) return 'nada'; if (A.producao < 1) return 'sem'; A.producao--; } else return 'nada'; J.tick(a); J.emit('acelerou', { alvo, restante: { ...A } }); return 'ok'; };
  J.vendasDeposito = () => { const D = S.deposito; return { feitas: D.janela === J._janela() ? D.vendas : 0, max: 100 }; };
  J.precoVenda = (k) => Math.ceil(1.5 * ITENS[k].valor * 3);
  J.tarifaMorador = () => (J.bem <= 30 ? 5 : J.bem <= 60 ? 8 : 11); J.rendaHora = () => J.pop * J.tarifaMorador();
  J.rendaInfo = () => ({ tarifa: J.tarifaMorador(), faixa: J.bem <= 30 ? '0-30' : J.bem <= 60 ? '31-60' : '61-100', porHora: J.rendaHora(), cofre: S.repasse.acum, cofreMax: Math.max(1, J.rendaHora() * 12), offlineH: 12, offlineFator: 0.5, cofreH: 12 });
  J.pedidosTotais = () => { const T = {}; for (const p of S.pedidos) if (p?.itens) for (const [k, n] of Object.entries(p.itens)) { T[k] = T[k] || { n: 0, falta: 0 }; T[k].n += n; } for (const k of Object.keys(T)) T[k].falta = Math.max(0, T[k].n - (S.itens[k] || 0)); return T; };
  J.fabricarPedido = (i) => { const p = S.pedidos[i]; if (!p?.itens) return 'nada'; if (!S.predios.usina2.ok) return 'fechado'; p.auto = true; const u = S.predios.usina2; u.fila = u.fila || []; for (const [k, n] of Object.entries(p.itens)) { const f = n - (S.itens[k] || 0); if (f > 0) u.fila.push({ item: k, n: f }); } J.emit('pedidoFabricando', { i, itens: p.itens }); return 'ok'; };
  J.pararPedido = (i) => { const p = S.pedidos[i]; if (p) p.auto = false; return 'ok'; };
  return true;
}

// página de teste: o Controle real com mundo, obras, câmera e motor de mentira
const entrada = `
import * as THREE from 'three';
import { Jogo, novoEstado, REGRAS } from './sim/estado.js';
import { Controle } from './jogo.js';
import { instalarExtras } from './ui/extras.js';
import { prepararIcones } from './ui/icones.js';
import { A, VISTA_FOTO } from './data/planta.js';
import { TUTORIAL } from './data/historia.js';
import { PREDIOS, ITENS } from './data/itens.js';
import { PROJ } from './data/obras.js';
const stubEconomia = ${stubEconomia.toString()};
const nop = () => {};
const W = innerWidth, H = innerHeight;
const camera = new THREE.PerspectiveCamera(VISTA_FOTO.fov || 38, W / H, 0.3, 600);
const v = VISTA_FOTO, p = v.pitch ?? 0.9; camera.position.set(v.x + Math.sin(v.yaw) * Math.cos(p) * v.dist, Math.sin(p) * v.dist, v.z + Math.cos(v.yaw) * Math.cos(p) * v.dist); camera.lookAt(v.x, 0, v.z); if (v.roll) camera.rotateZ(v.roll); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
const engine = { camera, vw: W, vh: H, W, H, q: { id: 'media' }, ocupado: null, acordar: nop, render: nop, renderer: { domElement: document.createElement('canvas') }, aoQualidade: [], stats: {}, gpu: 'vitrine-ui', fpsCap: 60, setQuality: nop, pr: 1 };
const rig = { target: new THREE.Vector3(v.x, 0, v.z), dist: v.dist, yaw: v.yaw, minDist: 3.2, deslocAlvo: 0, flyTo: (o) => { if (o.done) setTimeout(o.done, 0); }, ray: () => new THREE.Raycaster(), ground: () => null, passeio: nop, baque: nop, orbitaCine: (ms, y, done) => setTimeout(() => done && done(), 50), onMove: null };
const centroDe = (k) => { const a = A[k]; if (a?.c) return a.c; return [0, 0]; };
const faixa = (k, n) => ({ mods: Array.from({ length: n }, () => ({ nivel: 0 })), centro: (i) => { const [x, z] = centroDe(k); return [x + (i - n / 2) * 1.6, z]; }, alturaTopo: (nv) => 0.6 + nv * 0.55, setTodos: nop, setNivel: nop, refresh: nop, andar: () => ({ acabado: new THREE.Group() }), def: {} });
const faixas = new Proxy({}, { get: (o, k) => (o[k] ||= faixa(k, 8)) });
const modelos = new Proxy({}, { get: (o, k) => (o[k] ||= { ancora: [...(A[k]?.c ? [A[k].c[0], 2, A[k].c[1]] : [0, 2, 0])], foco: null, partes: {} }) });
const mundo = { faixas, casas: faixa('vila', 6), modelos, canteiro: { visible: true, children: [] }, predios: {}, root: new THREE.Group(), parte: () => null, setEtapa: nop, refundir: nop, povoar: nop, pick: () => null, mostrarFantasma: nop };
const obras = { iniciar: () => ({ box: null }), progresso: nop, pronta: nop, remover: nop, producao: nop, ancora: () => null, concluir: (k, cb, o = {}) => { setTimeout(() => o.aoImpacto && o.aoImpacto(), 380); setTimeout(() => cb && cb(), 1200); } };
const ground = { lake: { position: { y: 0 } }, flags: {}, paint: nop, tampa: {} };
const env = { mode: 'exposicao', setMode(m) { this.mode = m; } };
const S = novoEstado(Date.now()); const J = new Jogo(S); J.tick(Date.now());
const STUB = stubEconomia(J, S, REGRAS, PREDIOS, ITENS, PROJ); // false quando a simulação já tem a economia nova
const som = new Proxy({}, { get: () => nop }); const vibra = { on: true, tique: nop, sucesso: nop, erro: nop };
const ui = document.getElementById('ui');
await prepararIcones?.();
const C = new Controle({ engine, rig, env, ground, forest: { setReflorestamento: nop }, table: {}, mundo, obras, J, som, vibra, ui, cfg: {} });
C.sincronizarMundo = nop; C.vistaFoto = nop;
instalarExtras(C, { engine, env, rig, cfg: {}, fotoURL: 'foto.webp', versao: 'vitrine-ui', qualidadeAuto: 'media', telaCheia: nop });
let last = performance.now(); const loop = (t) => { const dt = Math.min(0.1, (t - last) / 1000); last = t; try { C.update(dt, t); } catch (e) { console.error(e); } requestAnimationFrame(loop); }; requestAnimationFrame(loop);
C.iniciar();
window.H = { C, J, S, TUTORIAL, THREE, STUB, REGRAS, PREDIOS, PROJ }; window.__pronto = true;
`;
const js = (await build({ stdin: { contents: entrada, resolveDir: join(raiz, 'fonte'), loader: 'js' }, bundle: true, format: 'esm', write: false, logLevel: 'error', target: ['chrome110'] })).outputFiles[0].text;
// a fonte entra no CSS em base64, como no arquivo único (a página abre por file://, onde a fonte externa é barrada)
const css = readFileSync(join(raiz, 'fonte/ui/estilo.css'), 'utf8').replace(/url\(fontes\/([\w.-]+\.woff2)\)/g, (m, f) => `url(data:font/woff2;base64,${readFileSync(join(raiz, 'fonte/web/fontes', f)).toString('base64')})`);
const semAnim = process.env.ANIMAR ? '' : '*,*::before,*::after{animation-duration:1ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition:none!important}';
writeFileSync(join(pasta, 'foto.webp'), readFileSync(join(raiz, 'fonte/web/foto.webp')));
writeFileSync(join(pasta, 'vitrine-ui.html'), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}\nbody{background:#1a1d16 url(foto.webp) center/cover no-repeat}\n${semAnim}</style></head><body><canvas id="c" style="opacity:0"></canvas><div id="ui"></div><script type="module">${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`);

// cenas: cada uma prepara o estado a partir de um jogo novo
const CENAS = {
  inicio: () => {},
  metas: (H) => H.C.hud.alternarMetas(true),
  agora: (H) => { H.S.dicas.guia = H.TUTORIAL.length; H.S.dicas.abertura = 1; H.C.hud.filaFalas.length = 0; H.C.hud._proxFala(); H.C.calcBolhas(); },
  'metas-agora': (H) => { CENAS.agora(H); H.C.hud.alternarMetas(true); },
  'guia-painel': (H) => { H.C.hud.filaFalas.length = 0; H.C.hud._proxFala(); H.C.irPara({ predio: 'usina1' }); },
  usina: (H) => { base(H); H.C.paineis.abrir('usina', 'usina1'); },
  oficina: (H) => { base(H); H.J.enfileirar('carpintaria', 'viga'); H.C.paineis.abrir('oficina', 'carpintaria'); },
  almox: (H) => { base(H); H.C.paineis.abrir('almox'); },
  obras: (H) => { base(H); H.C.paineis.abrir('obras'); },
  prancha: (H) => { base(H); H.S.itens.brita = 20; H.S.itens.madeira = 20; H.C.paineis.abrir('etapa', 'pas_frente.e1'); },
  'prancha-falta': (H) => { base(H); H.S.etapas['pas_frente.e1'] = { estado: 'feita', entregue: {} }; H.S.etapas['lago.e1'] = { estado: 'feita', entregue: {} }; H.S.itens.estaca = 0; H.J._derivar(); H.C.paineis.abrir('etapa', 'sede.e1'); },
  modulo: (H) => { base(H); H.S.cap = 2; H.S.modulos.anel[0].nivel = 2; H.J._derivar(); H.C.paineis.abrir('modulo', ['anel', 0]); },
  pedidos: (H) => { base(H); H.S.cap = 4; H.S.nivel = 14; H.J._derivar(); H.J.tick(Date.now()); for (const k of ['viga', 'deque', 'concreto', 'madeira', 'brita', 'aco']) H.S.itens[k] = 3; H.C.paineis.abrir('pedidos'); },
  'pedido-falta': (H) => { CENAS.pedidos(H); for (const k of Object.keys(H.S.itens)) if (H.S.itens[k] < 100) H.S.itens[k] = 0; const i = H.S.pedidos.findIndex((p) => p.itens); H.C.paineis.render(true); H.C.paineis.el.querySelector(`[data-a=pedido][data-i="${i}"]`)?.click(); },
  producao: (H) => { base(H); H.J.enfileirar('carpintaria', 'viga'); H.C.paineis.abrir('producao'); },
  deposito: (H) => { base(H); H.S.cap = 2; H.J.comprar('madeira'); H.J.comprar('madeira'); H.C.paineis.abrir('deposito'); },
  escritorio: (H) => { base(H); H.S.itens.madeira = 5; H.J.encomendarLicenca('estaca'); H.C.paineis.abrir('escritorio'); },
  config: (H) => H.C.config(),
  nivel: (H) => { H.C.modalNivel({ de: 2, para: 4, nivel: 4, creditos: 750, especiais: ['estrado', 'cadeado'], especial: 'estrado', novos: ['argila', 'deque', 'mudas'], predios: ['horto'], vagas: [] }); },
  capitulo: (H) => { completarCap1(H); H.C.modalCapitulo(H.J.capitulo()); },
  'capitulo-toque-fora': (H) => { completarCap1(H); H.C.modalCapitulo(H.J.capitulo()); document.querySelector('.veu').click(); },
  conselho: (H) => { completarCap1(H); H.C.modalCapitulo(H.J.capitulo()); document.querySelector('[data-depois]').click(); },
  final: (H) => { H.C._final = false; H.C.finalComposicao(); H.C._filaModais.forEach((x) => (x.t = 0)); H.C._verModais(); },
  apreciar: (H) => H.C.apreciar(true),
  brindes: (H) => { H.C.hud.brinde('Medição aprovada: +1.260', 'creditos', 9000); H.C.hud.brinde('Caminho da Frente: Abrir o caminho', 'ok', 9000); H.C.hud.brinde('Achado: Etiqueta RFID!', 'etiqueta', 9000); },
  bem: (H) => { H.C._infoBem(); },
  mutirao: (H) => { H.S.disposicao = 45; H.C._infoMutirao(); },
  // todos os tipos de balão: coleta (item pulando), obra pronta (check), repasse (moeda subindo), obra em andamento
  baloes: (H) => { base(H); const t = Date.now(); H.S.etapas['pas_frente.e1'] = { estado: 'pronta', entregue: {}, ini: t - 9000, fim: t - 10 }; H.S.etapas['lago.e1'] = { estado: 'obra', entregue: {}, ini: t - 40000, fim: t + 60000 }; H.S.repasse.acum = 800; H.J._derivar(); H.C.calcBolhas(); },
  aprovacao: (H) => { H.S.etapas['pas_frente.e1'] = { estado: 'pronta', entregue: {}, ini: Date.now() - 1000, fim: Date.now() - 10 }; H.C.aprovarEtapa('pas_frente.e1'); },
  // ---- economia nova (com a simulação de verdade ou, antes dela, o stub da vitrine) ----
  'escritorio-financas': (H) => { economia(H); H.C.paineis.aba.escritorio = 'financas'; H.C.paineis.abrir('escritorio'); },
  'escritorio-renda': (H) => { CENAS['escritorio-financas'](H); rolar(H, 330); },
  'escritorio-emprestimo': (H) => { CENAS['escritorio-financas'](H); rolar(H, 9999); },
  'escritorio-obra': (H) => { economia(H); H.C.paineis.aba.escritorio = 'obra'; H.C.paineis.abrir('escritorio'); },
  'usina-lote': (H) => { economia(H); H.C.paineis.qtd['usina1|brita'] = 5; H.C.paineis.abrir('usina', 'usina1'); },
  'usina-fichas': (H) => { CENAS['usina-lote'](H); rolar(H, 9999); },
  'oficina-lote': (H) => { economia(H); H.C.paineis.qtd['carpintaria|viga'] = 4; H.C.paineis.abrir('oficina', 'carpintaria'); },
  'oficina-fichas': (H) => { CENAS['oficina-lote'](H); rolar(H, 9999); },
  'pedidos-totais': (H) => { economia(H); pedidosEco(H); H.C.paineis.abrir('pedidos'); },
  'usina-pedidos': (H) => { economia(H); pedidosEco(H); H.C.paineis.abrir('usina', 'usina2'); },
  calendario: (H) => { economia(H); H.C.hud.atualizar(); H.C.hud.aoPop?.(); },
  'deposito-venda': (H) => { economia(H); H.S.cap = 2; H.S.deposito.janela = H.J._janela(); H.S.deposito.vendas = 12; H.C.paineis.aba.deposito = 'vender'; H.C.paineis.abrir('deposito'); },
  'aprovacao-etapa': (H) => { economia(H); const p = H.PROJ.pas_frente, e = p.etapas[0]; H.J.emit('etapaFeita', { key: 'pas_frente.e1', p, e }); H.J.emit('aviso', { texto: 'Medição aprovada: +1.260', icone: 'creditos', creditos: 1260 }); H.C._filaModais.forEach((x) => (x.t = 0)); H.C._festaAte = 0; H.C._verModais(); },
  acelerar: (H) => { economia(H); const t = Date.now(); H.S.etapas['lago.e1'] = { estado: 'obra', entregue: {}, ini: t - 40000, fim: t + 5400000 }; H.J._derivar(); H.C.paineis.abrir('etapa', 'lago.e1'); },
};
// estado da economia nova: dia 12 do mês 3, empréstimos (um vencido), aceleradores, lotes em andamento (um em
// automático e um parado com o Almoxarifado cheio), fila da oficina em lotes e o modo automático nela
function economia(H) {
  base(H); const S = H.S, J = H.J, t = Date.now(); const DIA = 20000;
  S.calendario = { inicio: t - (360 + 2 * 30 + 11) * DIA - 7000 }; /* dia 12 do mês 3 do ano 2 */ S.aceleradores = { obra: 2, producao: 3 }; S.cap = 2; S.modulos.anel.slice(0, 3).forEach((m) => (m.nivel = 2)); J._derivar();
  S.creditos = 31500; J.emprestar?.(20000); J.emprestar?.(20000); if (S.emprestimo) { S.emprestimo.juros = 1234; S.emprestimo.principal += 6000; S.emprestimo.contratos.unshift({ id: 900, ano: 1, valor: 10000, saldo: 6000, ini: t - 11 * 360 * DIA, fim: t - 360 * DIA }); }
  const u = S.predios.usina1; u.slots[0] = { item: 'madeira', n: 10, ini: t - 180000, fim: t + 480000, auto: true }; u.slots[1] = { item: 'brita', n: 4, ini: t - 60000, fim: t + 120000, auto: false }; u.slots[2] = { item: 'aco', n: 10, ini: t - 900000, fim: t - 5000, auto: false };
  S.itens.madeira = 30; S.itens.brita = 26; S.itens.argila = 4; // Almoxarifado cheio: o lote pronto espera vaga
  const o = S.predios.carpintaria; o.fila = [{ item: 'viga', n: 3, ini: t - 90000, fim: t + 200000 }, { item: 'deque', n: 2, ini: 0, fim: 0 }]; o.auto = { item: 'viga', n: 3 }; o.prontos = [];
  S.repasse.acum = 2400; J._derivar(); H.C.hud.brindes.innerHTML = ''; H.C.calcBolhas(); H.C.hud.atualizar();
}
function rolar(H, y) { const c = H.C.paineis.el?.querySelector('.corpo'); if (c) c.scrollTop = y; }
function pedidosEco(H) { const S = H.S, J = H.J; S.cap = 4; S.nivel = 14; J._derivar(); J.tick(Date.now()); for (const k of ['viga', 'deque', 'concreto', 'madeira', 'brita', 'aco']) S.itens[k] = 3; const i = S.pedidos.findIndex((p) => p.itens && Object.entries(p.itens).some(([k, n]) => (S.itens[k] || 0) < n)); if (i >= 0) J.fabricarPedido?.(i); }
function base(H) { H.S.nivel = 9; H.S.xp = 1700; H.S.creditos = 12000; H.S.predios.carpintaria.ok = true; H.S.predios.concreto.ok = true; H.S.predios.usina2.ok = true; H.J.produzir('usina1', 'madeira'); H.J.produzir('usina1', 'brita'); H.J.produzir('usina1', 'aco'); H.S.predios.usina1.slots[0].fim = Date.now() - 10; H.S.itens.viga = 2; H.S.itens.cimento = 3; H.S.dicas.guia = H.TUTORIAL.length; H.C.hud.filaFalas.length = 0; H.C.hud._proxFala(); H.J._derivar(); H.C.calcBolhas(); H.C.hud.atualizar(); }
function completarCap1(H) { const S = H.S; S.predios.carpintaria.ok = true; for (const k of ['pas_frente.e1', 'lago.e1', 'sede.e1', 'sede.e2']) S.etapas[k] = { estado: 'feita', entregue: {} }; S.modulos.anel.slice(0, 3).forEach((m) => (m.nivel = 2)); S.dicas.guia = H.TUTORIAL.length; H.C.hud.filaFalas.length = 0; H.C.hud._proxFala(); H.J._derivar(); H.C.hud.capitulo(); }
const CODIGO = `window.base=${base.toString()};window.completarCap1=${completarCap1.toString()};window.economia=${economia.toString()};window.pedidosEco=${pedidosEco.toString()};window.rolar=${rolar.toString()};window.CENAS={${Object.entries(CENAS).map(([k, f]) => JSON.stringify(k) + ':' + f.toString()).join(',')}};`;
const nomes = cenasArg === 'todas' ? Object.keys(CENAS) : cenasArg.split(',');
const tamanhos = tamArg.split(',').map((s) => s.split('x').map(Number));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const rel = { cenas: {}, erros: [] };
for (const [w, h] of tamanhos) for (const nome of nomes) {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  pg.on('pageerror', (e) => rel.erros.push(`${w}x${h} ${nome}: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error') rel.erros.push(`${w}x${h} ${nome}: console ${m.text()}`); });
  await pg.goto('file://' + join(pasta, 'vitrine-ui.html')); await pg.waitForFunction(() => window.__pronto, null, { timeout: 20000 });
  await pg.addScriptTag({ content: CODIGO }); await pg.evaluate((n) => window.CENAS[n](window.H), nome);
  await pg.waitForTimeout(nome === 'aprovacao' ? 450 : 350);
  await pg.screenshot({ path: join(pasta, `${w}x${h}-${nome}.png`) });
  rel.cenas[`${w}x${h}-${nome}`] = await pg.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; };
    const escondido = (e) => { if (getComputedStyle(e).pointerEvents === 'none') return true; for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return true; } return false; };
    // alvo de toque: a caixa do elemento somada à folga do ::after/::before (inset negativo)
    const folga = (e) => { let fx = 0, fy = 0; for (const ps of ['::after', '::before']) { const cs = getComputedStyle(e, ps); if (cs.content === 'none' || cs.position !== 'absolute') continue; const t = -parseFloat(cs.top) || 0, l = -parseFloat(cs.left) || 0; fy = Math.max(fy, 2 * t); fx = Math.max(fx, 2 * l); } return [fx, fy]; };
    const alvos = [...document.querySelectorAll('#ui button, #ui [data-a], #ui .balao, #ui input, #ui [data-x], #ui [data-y], #ui [data-esc], #ui [data-fecha]')].filter((e) => vis(e) && !escondido(e));
    const peq = alvos.map((e) => { const r = e.getBoundingClientRect(); const [fx, fy] = folga(e); return { c: (e.className?.baseVal ?? e.className) + '', a: e.dataset.a || e.dataset.x || e.dataset.y || e.dataset.v || '', t: (e.textContent || '').trim().slice(0, 20), w: Math.round(r.width + fx), h: Math.round(r.height + fy) }; }).filter((x) => x.w < 44 || x.h < 44);
    const fontes = {}; const wk = document.createTreeWalker(document.getElementById('ui'), NodeFilter.SHOW_TEXT); let n; while ((n = wk.nextNode())) { if (!n.textContent.trim()) continue; const p = n.parentElement; if (!vis(p) || escondido(p)) continue; const fs = parseFloat(getComputedStyle(p).fontSize); if (fs < 11) (fontes[fs.toFixed(1)] ||= []).push(n.textContent.trim().slice(0, 20)); }
    const blocos = [...document.querySelectorAll('#ui .topo > *:not(.esp), #ui .esq > *, #ui .dir > .bt, #ui .obras-bt, #ui .proximo')].filter((e) => vis(e) && !escondido(e)).map((e) => { const r = e.getBoundingClientRect(); return r.width * r.height; });
    const f = document.querySelector('.folha:not(.sai)'); const fr = f?.getBoundingClientRect();
    const bal = [...document.querySelectorAll('.balao')].filter((e) => vis(e) && !e.classList.contains('sob')).map((e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    let perto = 0; for (let i = 0; i < bal.length; i++) for (let j = i + 1; j < bal.length; j++) if (Math.hypot(bal[i][0] - bal[j][0], bal[i][1] - bal[j][1]) < 36) perto++;
    const m = document.querySelector('.modal'); const fd = document.querySelector('.fala-dock');
    return { peq, fontesPequenas: fontes, hudArea: Math.round(blocos.reduce((a, b) => a + b, 0)), hudPct: +((blocos.reduce((a, b) => a + b, 0) / (innerWidth * innerHeight)) * 100).toFixed(1), folha: fr ? { rect: [fr.left, fr.top, fr.width, fr.height].map(Math.round), pct: +((fr.width * fr.height) / (innerWidth * innerHeight) * 100).toFixed(1), html: f.innerHTML.length, rola: f.querySelector('.corpo').scrollHeight > f.querySelector('.corpo').clientHeight + 2 } : null,
      modal: m ? { rola: (() => { const c = m.querySelector('.mc') || m; return c.scrollHeight > c.clientHeight + 2; })(), rect: (() => { const r = m.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); })() } : null, fala: fd && vis(fd) && !escondido(fd), guia: (() => { const g = document.querySelector('.guia'); return g && vis(g) && !g.classList.contains('oculto') ? g.style.transform : null; })(), baloesPerto: perto, baloes: bal.length };
  });
  await pg.close();
}
writeFileSync(join(pasta, 'ui.json'), JSON.stringify(rel, null, 1));
for (const [k, r] of Object.entries(rel.cenas)) console.log(k.padEnd(28), `hud ${r.hudPct}%`, r.folha ? `folha ${r.folha.pct}% ${r.folha.rola ? 'rola' : ''}` : '', r.modal ? `modal${r.modal.rola ? ' ROLA' : ''}` : '', `alvos<44: ${r.peq.length}`, Object.keys(r.fontesPequenas).length ? 'TEXTO<11 ' + JSON.stringify(r.fontesPequenas) : '', r.guia ? 'guia' : '', r.fala ? 'fala' : '', r.baloesPerto ? `balões perto ${r.baloesPerto}` : '');
console.log(rel.erros.length ? 'ERROS:\n' + rel.erros.join('\n') : 'sem erros de página');
await browser.close();
