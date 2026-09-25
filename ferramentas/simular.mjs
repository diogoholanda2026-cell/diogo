// Robô que joga sozinho para medir o equilíbrio: quanto tempo cada capítulo leva, onde trava,
// quanto as oficinas trabalham e se cada regra (lotes, automático, cadeia, licenças, dilemas, depósito, pedidos,
// empréstimo) termina o jogo. Produz em lotes (n pelo que a próxima etapa pede), deixa o espaço 1 da Usina de
// Materiais em automático enquanto o plano pede o item, usa os aceleradores das etapas, fabrica um pedido por vez
// na Usina de Pedidos e vende sobras no Depósito quando falta crédito.
// Uso: node ferramentas/simular.mjs [passo_min=3] [ritmo=1]
//   SESSOES='7:30-7:45,12:30-12:45,18:30-18:45,22:00-22:15'  joga só nessas janelas (fora delas o tempo passa)
//   ESCOLHA=0|1|alt  opção do Conselho   MUTIRAO=1 usa fichas   DEPOSITO=1 compra matéria-prima   EMPRESTIMO=1 toma empréstimo quando falta crédito
//   ROBO=meta  só coleta e segue J.planoMeta() (Meta em foco)   CADEIA=1 encomenda em cadeia   SEMENTE=n sorteios fixos
//   ACELERA=0 não usa aceleradores   AUTO=0 sem espaço automático   ETAPAS=1 registra cada etapa e módulo   RELATORIO=1 detalhes por capítulo
// npm run simular:todos (node ferramentas/simular.mjs --todos): testes de regra, matriz de 8 combinações e
// dilemas; sai com código 1 se houver TRAVADO ou algum número fora das faixas.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { novoEstado, prepararSave, Jogo, TOPOGRAFO, FICHAS_MAX, N_MODULOS, F_PRODUTO, COFRE_H, VERSAO_SAVE, REGRAS, ANO_MS } from '../fonte/sim/estado.js';
import { ITENS, PREDIOS, USINAS, OFICINAS, receitas } from '../fonte/data/itens.js';
import { PROJETOS, PROJ, MODULOS, POP_NIVEL, LIMITE_CAP, SERVICO_NIVEL, BEM_NIVEL, PRESSAO_MORADIA } from '../fonte/data/obras.js';
import { CAPITULOS, FALAS_ETAPA, EFEITOS, TUTORIAL } from '../fonte/data/historia.js';

const DIA0 = Date.UTC(2026, 0, 1); const H = 3600e3;
const SESSOES_PADRAO = '7:30-7:45,12:30-12:45,18:30-18:45,22:00-22:15';
const semente = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const LIC = ['estaca', 'baliza', 'trena'];
const USINAS_L = USINAS.filter((u) => !PREDIOS[u].pedidos); // usinas que aceitam J.produzir (a de Pedidos só trabalha para os pedidos)
const LOTE = REGRAS.loteMax;

// ------------------------------------------------------------------ uma partida
export function rodar(o = {}) {
  const r0 = Math.random; if (o.semente != null) Math.random = semente(o.semente);
  try { return partida(o); } finally { Math.random = r0; }
}
function partida(o) {
  const passo = (o.passo ?? 3) * 60000; const T0 = DIA0 + 7 * H; let t = T0;
  const S = o.estado ? prepararSave(JSON.parse(JSON.stringify(o.estado)), t) : novoEstado(t); S.ritmo = o.ritmo ?? 1; const J = new Jogo(S); // o.estado: continua um save (inclusive antigo)
  if (o.estado && S.t > t) t = S.t; // um save gravado depois do início da simulação continua de onde parou (no jogo, S.t nunca está no futuro)
  const janelas = o.sessoes ? o.sessoes.split(',').map((s) => s.split('-').map((h) => { const [a, b] = h.split(':').map(Number); return a * 60 + (b || 0); })) : null;
  const minDia = () => ((t - DIA0) / 60000) % 1440; const dentro = () => !janelas || janelas.some(([a, b]) => minDia() >= a && minDia() < b);
  const proxJanela = () => { const m = minDia(); let d = Infinity; for (const [a] of janelas) { const x = a > m ? a - m : a + 1440 - m; d = Math.min(d, x); } return t + d * 60000; };
  const hora = () => ((t - T0) / H).toFixed(2).padStart(7) + 'h';
  const log = []; const M = {}; const cap = () => S.cap;
  const m = (c) => (M[c] ||= { ini: t, dur: 0, turnos: 0, semAcao: 0, parado: 0, bloq: {}, bloqTurnos: {}, credMin: Infinity, credMax: 0, credFim: 0, niveis: 0, pedidos: 0, compras: 0, vendas: 0, etapas: 0, modulos: 0, obrasMax: 0, obrasAm: [], mutUsado: 0, bemFim: 0, lotes: 0, acelerados: 0, fabricados: 0, emprestado: 0, autoLotes: 0, vendasCred: 0 });
  const util = {}; const desde = { usina1: T0 }; let nNovo = 0, nNovo6 = 0, nFim = 0, nNivelEv = 0;
  J.on((tipo, d) => {
    const c = m(cap());
    if (tipo === 'produto' && d.fim) util[d.predio] = (util[d.predio] || 0) + (d.fim - d.ini);
    if (tipo === 'produzir') { util[d.predio] = (util[d.predio] || 0) + (d.fim - d.ini) / S.predios[d.predio].nSlots; c.lotes += d.n || 1; if (d.auto) c.autoLotes += d.n || 1; }
    if (tipo === 'enfileirar' && !d.pend) c.lotes += d.n || 1;
    if (tipo === 'predio') desde[d.id] = t;
    if (tipo === 'nivel') { c.niveis += d.para - d.de; nNivelEv++; }
    if (tipo === 'pedido') c.pedidos++;
    if (tipo === 'etapaFeita') { c.etapas++; if (o.etapas) log.push(`${hora()}   ${d.key}`); }
    if (tipo === 'moduloFeito') { c.modulos++; if (o.etapas) log.push(`${hora()}   módulo ${d.faixa}${d.i}→${d.nivel}`); }
    if (tipo === 'novoCapitulo') { nNovo++; if (d.cap.n === 6) nNovo6++; log.push(`${hora()} >>> capítulo ${d.cap.n} (${d.cap.nome})  nível ${S.nivel} créditos ${S.creditos} fichas ${S.mutirao} disp ${S.disposicao} vida ${J.vida().toFixed(0)}%`); }
    if (tipo === 'fimDeJogo') { nFim++; log.push(`${hora()} >>> fim de jogo`); }
  });
  let acoes = 0; const conta = (r) => { if (r === 'ok') acoes++; return r; };
  const coletarTudo = () => { for (const u of USINAS) if (S.predios[u].ok) for (const i of J.prontosUsina(u)) conta(J.coletarUsina(u, i)); for (const x of OFICINAS) if (S.predios[x].ok) conta(J.coletarOficina(x)); J.coletarRepasse(); };
  const aprovarTudo = () => { for (const [k, st] of Object.entries(S.etapas)) if (st.estado === 'pronta') conta(J.aprovarEtapa(k)); for (const f of Object.keys(S.modulos)) S.modulos[f].forEach((mm, i) => { if (mm.obra?.estado === 'pronta') conta(J.aprovarModulo(f, i)); }); };
  const escolher = () => { const c = J.capitulo(); if (!c || S.capEscolhas[c.n] !== undefined || !c.metas.every((x) => J.metaFeita(x))) return; const e = o.escolhas?.[c.n] ?? (o.escolha === 'alt' ? (c.n + 1) % 2 : +(o.escolha || 0)); J.concluirCapitulo(c.escolha?.[e]?.id ?? c.escolha?.[0]?.id ?? null); };
  // almoxarifado apertado: vende primeiro o que mais sobra (o depósito aceita 100 por janela)
  const venderSobras = (need) => { const alvo = Math.max(8, Math.floor(J.capacidade * 0.12)); const sob = Object.entries(S.itens).filter(([k, n]) => ITENS[k].tipo !== 'especial' && n > (need[k] || 0)).map(([k, n]) => [k, n - (need[k] || 0)]).sort((a, b) => b[1] - a[1]);
    for (const [k, q] of sob) { if (J.livre >= alvo) break; const r = J.vender(k, Math.min(q, alvo - J.livre)); if (r === 'ok') m(cap()).vendas++; else if (r === 'limite') break; } };
  // falta crédito para uma obra de meta: vende o que sobra do plano, do mais valioso ao mais barato, até juntar o que falta
  const venderParaCreditos = (need, v) => { const sob = Object.entries(S.itens).filter(([k, n]) => ITENS[k].tipo !== 'especial' && n > (need[k] || 0)).map(([k, n]) => [k, n - (need[k] || 0)]).sort((a, b) => J.precoVenda(b[0]) - J.precoVenda(a[0])); const c0 = S.creditos;
    for (const [k, q] of sob) { if (S.creditos - c0 >= v) break; const r = J.vender(k, Math.min(q, Math.ceil((v - (S.creditos - c0)) / J.precoVenda(k)))); if (r === 'ok') { m(cap()).vendasCred++; acoes++; } else if (r === 'limite') break; } };
  // aceleradores das etapas: obra, na obra de meta mais longa (se faltar mais de 30 min); produção, no trabalho mais longo
  // de uma oficina (senão na usina mais ocupada)
  const usarAceleradores = () => {
    if (o.aceleradores === 0) return; const A = S.aceleradores; const c = J.capitulo(); const metas = new Set((c?.metas || []).filter((x) => x.tipo === 'etapa').map((x) => x.id.split('.')[0]));
    for (let g = 0; g < 3 && A.obra > 0; g++) { let best = null, bf = 0;
      for (const [k, st] of Object.entries(S.etapas)) if (st.estado === 'obra') { const f = (st.fim - t) * (metas.has(k.split('.')[0]) ? 2 : 1); if (f > bf) { bf = f; best = { etapa: k, resta: st.fim - t }; } }
      for (const [f, arr] of Object.entries(S.modulos)) arr.forEach((mm, i) => { if (mm.obra?.estado === 'obra' && mm.obra.fim - t > bf) { bf = mm.obra.fim - t; best = { modulo: [f, i], resta: mm.obra.fim - t }; } });
      if (!best || best.resta < 30 * 60000) break; const alvo = best.etapa ? { etapa: best.etapa } : { modulo: best.modulo }; if (J.acelerar(alvo) !== 'ok') break; m(cap()).acelerados++; acoes++; }
    for (let g = 0; g < 3 && A.producao > 0; g++) { let best = null, bf = 30 * 60000;
      for (const x of OFICINAS) { const f = S.predios[x].fila[0]; if (S.predios[x].ok && f?.fim > t + bf) { bf = f.fim - t; best = { predio: x }; } }
      if (!best) for (const u of USINAS) { const st = S.predios[u]; if (!st.ok) continue; const tot = st.slots.reduce((a, s) => a + (s && s.fim > t ? Math.min(3600e3, s.fim - t) : 0), 0); if (tot > bf) { bf = tot; best = { predio: u }; } }
      if (!best || J.acelerar(best) !== 'ok') break; m(cap()).acelerados++; acoes++; }
  };
  // Usina de Pedidos: um pedido por vez, o de recompensa mais útil, se o almoxarifado tiver espaço para guardar o que falta
  const fabricarPedidos = () => {
    const u = S.predios.usina2; if (!u?.ok || !PREDIOS.usina2.pedidos || S.pedidos.some((p) => p.auto)) return; let best = null, bv = 0;
    S.pedidos.forEach((p, i) => { if (!p.itens) return; const R = p.recompensa || {}; const falta = Object.entries(p.itens).reduce((a, [k, n]) => a + Math.max(0, n - (S.itens[k] || 0)), 0); if (falta <= 0 || falta > J.livre) return;
      const util = (Object.keys(R.itens || {}).some((k) => LIC.includes(k) || S.itens[k] < 4) ? 2 : 0) + (R.bem && J.bem < 80 ? 1 : 0) + (R.disposicao && S.mutirao < FICHAS_MAX ? 1 : 0) + (R.creditos || 0) / 2000; if (util > bv) { bv = util; best = i; } });
    if (best != null && J.fabricarPedido(best) === 'ok') { m(cap()).fabricados++; acoes++; }
  };
  // cenário de empréstimo: toma o que falta para uma obra de meta (múltiplos de 1.000, até o disponível no ano), paga os
  // juros a cada visita e quita quando os créditos cobrem a dívida com folga
  const usarEmprestimo = (falta) => {
    if (!o.emprestimo) return; const I = J.emprestimoInfo();
    if (I.divida >= 1 && S.creditos >= I.divida + 5000) { if (J.quitar() === 'ok') acoes++; }
    else if (I.juros >= 1 && S.creditos >= Math.ceil(I.juros)) { if (J.pagarJuros() === 'ok') acoes++; }
    if (falta > 0 && I.disponivelAno >= 1000) { const v = Math.min(I.disponivelAno, Math.ceil(falta / 1000) * 1000); if (J.emprestar(v) === 'ok') { m(cap()).emprestado += v; acoes++; } }
  };
  const usarMutirao = () => { // na obra de meta mais longa (etapas e módulos), se faltar mais de 20 min
    const c = J.capitulo(); const metas = new Set((c?.metas || []).filter((x) => x.tipo === 'etapa').map((x) => x.id.split('.')[0])); let best = null, bf = 0;
    for (const [k, st] of Object.entries(S.etapas)) if (st.estado === 'obra') { const f = (st.fim - t) * (metas.has(k.split('.')[0]) ? 2 : 1); if (f > bf) { bf = f; best = { etapa: k }; } }
    for (const [f, arr] of Object.entries(S.modulos)) arr.forEach((mm, i) => { if (mm.obra?.estado === 'obra' && mm.obra.fim - t > bf) { bf = mm.obra.fim - t; best = { modulo: [f, i] }; } });
    if (best && bf > 20 * 60000 && J.mutirao(best) === 'ok') { m(cap()).mutUsado++; acoes++; }
  };
  const pedidosUteis = (need) => S.pedidos.forEach((p, i) => { // entrega o pedido que a Usina de Pedidos fabricou; dos outros, só sobra, e só se a recompensa serve
    if (!p.itens || !Object.entries(p.itens).every(([k, n]) => (S.itens[k] || 0) - (p.auto ? 0 : need[k] || 0) >= n)) return; const R = p.recompensa || {};
    const serve = p.auto || Object.keys(R.itens || {}).some((k) => LIC.includes(k) || S.itens[k] < 4) || (R.bem && J.bem < 80) || (R.disposicao && S.mutirao < FICHAS_MAX) || S.creditos < 20000;
    if (serve) conta(J.entregarPedido(i));
  });
  // metas do capítulo e tudo de que elas dependem (obras, módulos), para gastar primeiro no que importa
  function prioridades() {
    const proj = new Set(), mod = {}; const c = J.capitulo(); const ver = new Set();
    const req = (r) => { if (ver.has(r)) return; ver.add(r); const [a, b] = r.split('.'); if (MODULOS[a]) { mod[a] = Math.max(mod[a] || 0, +b); return; } const p = PROJ[a]; if (!p) return; proj.add(a); for (const e of p.etapas) { for (const x of J.requerEtapa(p, e)) req(x); if (e.id === b) break; } };
    for (const x of c?.metas || []) { if (J.metaFeita(x)) continue; if (x.tipo === 'etapa') req(x.id); else if (x.tipo === 'modulos') mod[x.faixa] = Math.max(mod[x.faixa] || 0, x.nivel); else if (x.tipo === 'predio') proj.add('predio:' + x.id); }
    return { proj, mod };
  }
  // plano de produção: demanda em ordem de prioridade, expandida pelos insumos e descontando o que já existe
  function plano(pri) {
    const listas = [[], [], [], [], []]; // 0 metas, 1 outras obras e módulos, 2 próxima etapa, 3 epílogo adiantado, 4 estoque
    const add = (L, k, n) => { if (ITENS[k].tipo !== 'especial' && n > 0) listas[L].push([k, n]); };
    for (const p of PROJETOS) {
      if (p.cap > S.cap) { for (const e of p.etapas) if (J.aceitaEntrega(p, e) && J.etapa(p.id + '.' + e.id).estado !== 'obra') for (const [i, n] of Object.entries(J.faltaEtapa(p.id + '.' + e.id))) add(3, i, n); continue; }
      let prox = 0; const L = pri.proj.has(p.id) ? 0 : 1;
      for (const e of p.etapas) {
        const k = p.id + '.' + e.id; const s = J.situacao(p, e); if (s === 'feita') continue;
        if (!prox && (s === 'disponivel' || s === 'prancha')) { for (const [i, n] of Object.entries(J.faltaEtapa(k))) add(L, i, n); prox = 1; continue; }
        if (!prox && (s === 'obra' || s === 'pronta')) { prox = 1; continue; }
        if (prox && s === 'bloqueada') for (const [i, n] of Object.entries(J.itensEtapa(p, e))) add(2, i, n);
        break;
      }
    }
    for (const f of Object.keys(S.modulos)) S.modulos[f].forEach((mm, i) => { if (J.situacaoModulo(f, i) !== 'disponivel') return; const r = J.requisitosModulo(f, i); if (!r.servOk || !r.bemOk) return; for (const [k, n] of Object.entries(r.itens)) add(mm.nivel < (pri.mod[f] || 0) ? 0 : 1, k, n); });
    // estoque: um pouco de cada produto que o capítulo ainda vai pedir (as oficinas trabalham enquanto o jogo está fechado)
    if (o.estoque !== 0) { const resta = {}; for (const p of PROJETOS) for (const e of p.etapas) if (J.capEtapa(p, e) <= S.cap && !J.feita(p.id + '.' + e.id)) for (const [k, n] of Object.entries(J.itensEtapa(p, e))) resta[k] = (resta[k] || 0) + n;
      for (const [f, arr] of Object.entries(S.modulos)) arr.forEach((mm, i) => { if (MODULOS[f].cap > S.cap) return; for (let lv = mm.nivel + 1; lv <= Math.min(MODULOS[f].max, J.limiteModulo(f)); lv++) for (const [k, n] of Object.entries(mm.pedido?.nivel === lv ? mm.pedido.itens : J.pedidoModulo(f, i, lv))) resta[k] = (resta[k] || 0) + n; });
      // no fim da sessão, como um jogador antes de fechar o jogo: filas cheias (o que sobrar espera na bandeja)
      let vol = Math.floor(J.capacidade * (fimSessao ? 0.5 : 0.25)); for (const [k, n] of Object.entries(resta)) { if (ITENS[k].tipo !== 'produto' || !J.liberado(k) || vol <= 0) continue; const q = Math.min(n, fimSessao ? 6 : 3); add(4, k, q); vol -= q; } }
    // Usina de Pedidos: os insumos dos produtos da fila dela entram no plano (os itens do pedido marcado ficam reservados abaixo)
    { const u2 = S.predios.usina2; if (u2?.ok && PREDIOS.usina2.pedidos) for (const f of u2.fila || []) { const it = ITENS[f.item]; if (it?.req) for (const [r, q] of Object.entries(it.req)) add(2, r, q * f.n); } }
    const livre = { ...S.itens }; for (const x of OFICINAS) { const o2 = S.predios[x]; for (const f of o2.fila) livre[f.item] = (livre[f.item] || 0) + (f.n || 1); for (const k of o2.prontos) livre[k] = (livre[k] || 0) + 1; } for (const u of USINAS) for (const sl of S.predios[u].slots) if (sl) livre[sl.item] = (livre[sl.item] || 0) + (sl.sobra ?? sl.n ?? 1);
    const prod = [], bruto = [];
    const exp = (k, n, pr, prof) => { const it = ITENS[k]; const usa = Math.min(livre[k] || 0, n); livre[k] = (livre[k] || 0) - usa; const d = n - usa; if (d <= 0) return; if (it.tipo === 'bruto') { bruto.push([k, d, pr]); return; } prod.push([k, d, pr, prof]); for (const [r, q] of Object.entries(it.req)) exp(r, q * d, pr, prof + 1); };
    listas.forEach((L, pr) => { for (const [k, n] of L) exp(k, n, pr, 0); });
    // licenças que faltam viram madeira, aço e cobre para o topógrafo
    for (const p of PROJETOS) { const nx = J.proximaEtapa(p); if (!nx || !['disponivel', 'prancha'].includes(nx.s)) continue; const f = J.faltaEtapa(p.id + '.' + nx.e.id); for (const k of LIC) if (f[k]) for (const [i, q] of Object.entries(TOPOGRAFO[k].itens)) bruto.push([i, q * f[k], 0]); }
    const need = {}; for (const L of listas.slice(0, 4)) for (const [k, n] of L) need[k] = (need[k] || 0) + n; for (const [k, n] of prod) need[k] = (need[k] || 0) + n;
    for (const p of S.pedidos) if (p.auto && p.itens) for (const [k, q] of Object.entries(p.itens)) need[k] = (need[k] || 0) + q;
    return { prod, bruto, need, listas };
  }
  function turnoGuloso() {
    const c = m(cap()); const pri = prioridades(); let pl = plano(pri);
    // prédios: a oficina que produz algo planejado (ou qualquer um, com dinheiro sobrando)
    const usa = new Set(pl.prod.map(([k]) => ITENS[k].oficina)); if (pl.bruto.length) for (const u of USINAS) usa.add(u);
    for (const id of Object.keys(PREDIOS)) { const cu = PREDIOS[id].custo || 0; if (!S.predios[id].ok && J.predioLiberado(id) && (S.creditos > cu * 3 + 2000 || (usa.has(id) && S.creditos > cu + 300))) conta(J.construirPredio(id)); }
    J.ampliarAlmox();
    // licenças: o topógrafo resolve o que faltar (uma por vez)
    for (const p of PROJETOS) { const nx = J.proximaEtapa(p); if (!nx || !['disponivel', 'prancha'].includes(nx.s)) continue; const f = J.faltaEtapa(p.id + '.' + nx.e.id); for (const k of LIC) if (f[k] && !S.topografo) conta(J.encomendarLicenca(k)); }
    // obras: primeiro as das metas; as outras só com reserva para as metas que ainda esperam material
    // (e, na reta final do capítulo 5, com o custo do epílogo guardado, como faz quem vê a prancha do replantio)
    const bloq = new Set(); let reserva = 0, faltaCred = 0;
    if (S.cap === 5 && (S.marcos[5] || 0) >= 2) for (const e of PROJ.reflorestar.etapas) reserva += J.custoEtapa(PROJ.reflorestar, e);
    const tentar = (p, meta) => {
      if (p.cap > S.cap) { for (const e of p.etapas) if (J.aceitaEntrega(p, e)) J.entregarTudo(p.id + '.' + e.id); return; }
      for (const e of p.etapas) {
        const key = p.id + '.' + e.id; const s = J.situacao(p, e); if (s === 'feita') continue;
        if (s === 'disponivel' || s === 'prancha') {
          J.entregarTudo(key); const falta = Object.keys(J.faltaEtapa(key)); const cu = J.custoEtapa(p, e);
          if (!meta && !falta.length && S.creditos - cu < reserva) { bloq.add('etapa:creditos'); break; }
          const r = conta(J.iniciarEtapa(key)); if (r !== 'ok') { let why = r; if (r === 'falta') why = falta.some((k) => ITENS[k].tipo === 'especial') ? 'licenca' : 'itens'; bloq.add('etapa:' + why); if (meta) { reserva += cu; if (r === 'creditos') faltaCred = Math.max(faltaCred, cu - S.creditos); } }
        } else if (J.aceitaEntrega(p, e)) J.entregarTudo(key);
        break;
      }
    };
    for (const p of PROJETOS) if (pri.proj.has(p.id)) tentar(p, true);
    const modulo = (f, i, meta) => { const mm = S.modulos[f][i]; if (J.situacaoModulo(f, i) !== 'disponivel') return; const q = J.requisitosModulo(f, i); if (!meta && S.creditos - q.custo < reserva) return; const r = conta(J.melhorarModulo(f, i)); if (r === 'servico') { for (const k of q.servicos) if (J.serv[k] < q.popDepois) bloq.add('serv:' + k); } else if (r !== 'ok') { bloq.add('mod:' + r); if (meta && r !== 'bem') { reserva += q.custo; if (r === 'creditos') faltaCred = Math.max(faltaCred, q.custo - S.creditos); } } };
    for (const f of Object.keys(S.modulos)) S.modulos[f].forEach((mm, i) => { if (mm.nivel < (pri.mod[f] || 0)) modulo(f, i, true); });
    for (const p of PROJETOS) if (!pri.proj.has(p.id)) tentar(p, false);
    for (const f of Object.keys(S.modulos)) S.modulos[f].forEach((mm, i) => { if (mm.nivel >= (pri.mod[f] || 0)) modulo(f, i, false); });
    for (const b of bloq) { c.bloq[b] = (c.bloq[b] || 0) + passo / 60000; c.bloqTurnos[b] = (c.bloqTurnos[b] || 0) + 1; }
    if (o.mutirao && S.mutirao > 0) usarMutirao();
    usarAceleradores();
    // falta crédito para uma meta: vende sobras do plano no Depósito (150% do preço de compra); no cenário de empréstimo, toma emprestado
    if (faltaCred > 0) { venderParaCreditos(pl.need, faltaCred); usarEmprestimo(Math.max(0, faltaCred - (S.creditos - (c.credAntes ?? S.creditos)))); } else usarEmprestimo(0);
    // amplia só o que está limitando: fila cheia com trabalho planejado, ou usina toda ocupada
    pl = plano(pri);
    for (const id of [...USINAS_L, ...OFICINAS]) { const x = S.predios[id]; if (!x.ok || S.creditos - J.custoEspaco(id) < Math.max(reserva, J.custoEspaco(id) * 2)) continue; const cheio = x.fila ? x.fila.length >= J.vagasFila(id) && pl.prod.some(([k]) => ITENS[k].oficina === id) : x.slots.every(Boolean) && pl.bruto.length; if (cheio) J.ampliar(id); }
    // oficinas: em rodízio pelos itens do plano (metas primeiro, insumos mais profundos antes), em lotes limitados pelos insumos
    for (const x of OFICINAS) {
      const o2 = S.predios[x]; if (!o2.ok) continue;
      const cand = pl.prod.filter(([k]) => ITENS[k].oficina === x && J.liberado(k)).sort((a, b) => a[2] - b[2] || b[3] - a[3]).map(([k, d]) => [k, d]);
      // como um jogador: o insumo que uma encomenda mais importante espera não vai para uma menos importante
      const espera = new Set();
      for (let volta = 0; volta < 12 && o2.fila.length < J.vagasFila(x); volta++) { let fez = false; for (const cd of cand) { if (cd[1] <= 0 || o2.fila.length >= J.vagasFila(x)) continue; const req = Object.keys(ITENS[cd[0]].req); if (req.some((r) => espera.has(r))) continue;
        const n = o.cadeia ? 1 : Math.min(LOTE, cd[1], Math.max(1, J.loteMax(x, cd[0]))); const r = conta(J.enfileirar(x, cd[0], n, false, !!o.cadeia)); if (r === 'ok') { cd[1] -= n; fez = true; } else if (r === 'falta') for (const k of req) espera.add(k); } if (!fez) break; }
    }
    // usinas: matérias-primas do plano (metas primeiro) em lotes, dentro do espaço que sobra no almoxarifado; sem plano, só
    // se sobrar bastante espaço
    const raws = []; for (const [k, d, pr] of pl.bruto.sort((a, b) => a[2] - b[2])) if (J.liberado(k)) { const r = raws.find((x) => x[0] === k); if (r) r[1] += d; else raws.push([k, d]); }
    const demRaw = new Set(raws.map((r) => r[0]));
    const fallback = ['madeira', 'brita', 'aco', 'argila', 'mudas', 'vidro', 'cobre', 'fibra'].filter((k) => J.liberado(k)); let ai = 0, orc = J.livre - 8;
    for (const u of USINAS_L) if (S.predios[u].ok) for (let sl = 0; sl < S.predios[u].nSlots; sl++) {
      if (S.predios[u].slots[sl] || orc < 1) continue; let k = null, n = 0;
      for (let g = 0; g < raws.length && !k; g++) { const r = raws[(ai + g) % raws.length]; if (r[1] > 0) { k = r[0]; n = Math.min(LOTE, r[1], orc); r[1] -= n; ai = (ai + g + 1) % raws.length; } }
      if (!k) { if (J.livre < J.capacidade * 0.3) break; k = fallback[ai++ % fallback.length]; n = Math.min(5, orc); }
      if (conta(J.produzir(u, k, n)) === 'ok') orc -= n;
    }
    // automático: o espaço 1 da Usina de Materiais repete o lote enquanto o plano pedir o item; desliga no fim da sessão
    { const a = S.predios.usina1.slots[0]; if (a && o.auto !== 0) { const quer = !fimSessao && demRaw.has(a.item); if (a.auto !== quer) J.setAuto('usina1', 0, quer); } }
    fabricarPedidos();
    // depósito: só a matéria-prima que falta para as obras abertas (não para estoque), com folga no almoxarifado
    if (o.deposito) { const falta = {}; for (const [k, d, pr] of pl.bruto) if (pr <= 1) falta[k] = (falta[k] || 0) + d; for (const u of USINAS) for (const sl of S.predios[u].slots) if (sl && falta[sl.item]) falta[sl.item]--;
      for (const [k, d] of Object.entries(falta)) { if (!J.liberado(k)) continue; for (let q = 0; q < d; q++) { const e = J.estoqueDeposito(k); if (e.n < 1 || S.creditos - e.preco < Math.max(reserva, 5 * e.preco) || J.livre < J.capacidade * 0.3) break; if (J.comprar(k) === 'ok') { c.compras++; acoes++; } } } }
    pedidosUteis(pl.need);
    if (J.livre < Math.max(8, J.capacidade * 0.1)) venderSobras(pl.need);
  }
  const fila = (k) => { let n = 0; const I = ITENS[k]; if (I.oficina) { const x = S.predios[I.oficina]; for (const f of x.fila) if (f.item === k) n++; for (const p of x.prontos) if (p === k) n++; } else for (const u of USINAS) for (const s of S.predios[u].slots) if (s?.item === k) n++; return n; };
  function turnoMeta() { // segue a Meta em foco, como um jogador que só faz o que o jogo indica
    for (let g = 0; g < 40; g++) {
      const pl = J.planoMeta(); if (!pl || pl.acao === 'aguardar') break; const a = pl.alvo || {}; let r = 'x';
      if (pl.acao === 'apresentar') { escolher(); r = 'ok'; }
      else if (pl.acao === 'aprovar') r = a.etapa ? J.aprovarEtapa(a.etapa) : J.aprovarModulo(a.modulo[0], a.modulo[1]);
      else if (pl.acao === 'coletar') { if (a.repasse) r = J.coletarRepasse(); else if (PREDIOS[a.predio].tipo === 'usina') { for (const i of J.prontosUsina(a.predio)) r = J.coletarUsina(a.predio, i); } else r = J.coletarOficina(a.predio); if (r === 'almox') { venderSobras(plano(prioridades()).need); r = 'x'; } }
      else if (pl.acao === 'iniciar') r = a.etapa ? J.iniciarEtapa(a.etapa) : J.melhorarModulo(a.modulo[0], a.modulo[1]);
      else if (pl.acao === 'entregar') r = J.entregar(a.etapa, pl.item, pl.n);
      else if (pl.acao === 'construir') r = a.almox ? J.ampliarAlmox() : a.ampliar ? J.ampliar(a.ampliar) : J.construirPredio(a.predio);
      else if (pl.acao === 'vender') { const L = J.livre; venderSobras(plano(prioridades()).need); r = J.livre > L ? 'ok' : 'x'; }
      else if (pl.acao === 'produzir') { if (a.topografo) r = J.encomendarLicenca(a.topografo); else { let resta = Math.max(1, pl.n); while (resta > 0) { const n = Math.min(LOTE, resta); const x = PREDIOS[a.predio].tipo === 'usina' ? J.produzir(a.predio, pl.item, n) : J.enfileirar(a.predio, pl.item, Math.max(1, Math.min(n, J.loteMax(a.predio, pl.item)))); if (x !== 'ok') break; r = 'ok'; resta -= n; } } }
      if (r !== 'ok') { if (J.livre < 4) venderSobras(plano(prioridades()).need); break; } acoes++;
    }
  }
  let fimSessao = false;
  function turno() {
    J.tick(t); acoes = 0; const c = m(cap()); c.credAntes = S.creditos; o.aCadaTurno?.(J, S, t);
    coletarTudo(); aprovarTudo(); escolher();
    if (o.robo === 'meta') { turnoMeta(); if (J.livre < 4) venderSobras(plano(prioridades()).need); } else turnoGuloso();
    let ob = 0; for (const st of Object.values(S.etapas)) if (st.estado === 'obra') ob++; for (const arr of Object.values(S.modulos)) for (const x of arr) if (x.obra) ob++;
    c.obrasMax = Math.max(c.obrasMax, ob); c.obrasAm.push(ob);
    c.credMin = Math.min(c.credMin, S.creditos); c.credMax = Math.max(c.credMax, S.creditos); c.turnos++; if (!acoes) c.semAcao++;
    // parado: nada a fazer e nada andando (nenhuma obra, oficina ou usina trabalhando): é a parede da economia
    if (!acoes && !ob && !S.topografo && !OFICINAS.some((x) => S.predios[x].ok && S.predios[x].fila[0]?.fim > t) && !USINAS.some((u) => S.predios[u].slots.some((sl) => sl && sl.fim > t))) c.parado++;
  }
  const limite = t + 24 * H * (o.dias ?? 60); let capAnt = 1, parado = 0, vidaAnt = -1, tVida = t, travou = null; m(1);
  const acabou = () => J.feita('reflorestar.e1');
  while (t < limite && !acabou()) {
    if (dentro()) { t += passo; fimSessao = !!janelas && !dentro(); t -= passo; turno(); t += passo; } else t = proxJanela();
    if (S.cap !== capAnt) { const c = m(capAnt); c.dur = (t - c.ini) / H; c.credFim = S.creditos; c.bemFim = J.bem; c.popFim = J.pop; capAnt = S.cap; m(S.cap).ini = t; }
    const v = J.vida(); if (Math.abs(v - vidaAnt) > 1e-6) { vidaAnt = v; tVida = t; }
    if (t - tVida > (janelas ? 72 : 24) * H) { travou = `TRAVADO no capítulo ${S.cap}, nível ${S.nivel}, créditos ${S.creditos}, vida ${v.toFixed(1)}%`; log.push(`${hora()} ${travou}`); break; }
  }
  { const c = m(capAnt); c.dur = (t - c.ini) / H; c.credFim = S.creditos; c.bemFim = J.bem; c.popFim = J.pop; }
  const fimT = t; const oficinas = {}; for (const id of [...USINAS, ...OFICINAS]) if (desde[id] != null && S.predios[id].ok) oficinas[id] = (util[id] || 0) / Math.max(1, fimT - desde[id]);
  for (const c of Object.values(M)) { const a = c.obrasAm.slice().sort((x, y) => x - y); c.obrasP95 = a.length ? a[Math.floor(a.length * 0.95)] : 0; delete c.obrasAm; }
  return { o, log, M, horas: (fimT - T0) / H, dias: (fimT - T0) / (24 * H), terminou: acabou(), travou, S, J, oficinas, nNovo, nNovo6, nFim, nNivelEv,
    fichas: { ganhas: S.stats.dispGanha / 100, perdidas: S.stats.dispPerdida / 100, usadas: S.stats.mutiroes } };
}

// ------------------------------------------------------------------ relatório
const custoSeguinte = (J, k) => { let v = 0; for (const p of PROJETOS) for (const e of p.etapas) if (J.capEtapa(p, e) === k + 1) v += J.custoEtapa(p, e); return v; };
function relatorio(R, det = true) {
  const L = [...R.log];
  const V = R.J.valuation(), EI = R.J.emprestimoInfo();
  L.push(`FIM ${R.horas.toFixed(1)} h (${R.dias.toFixed(1)} dias) nível ${R.S.nivel} créditos ${R.S.creditos} fichas ${R.S.mutirao} pop ${R.J.pop} bem ${R.J.bem}% serv ${JSON.stringify(R.J.serv)}`);
  L.push(`valuation ${V.total} (obras ${V.partes.obras}, módulos ${V.partes.modulos}, prédios ${V.partes.predios}, moradores ${V.partes.moradores}, caixa ${V.partes.caixa}); renda ${R.J.rendaHora()}/h (tarifa ${R.J.tarifaMorador()}); dívida ${Math.round(EI.divida)} (tomado ${R.S.stats.emprestado}, juros pagos ${R.S.stats.jurosPagos}); aceleradores usados ${R.S.stats.acelerados}, lotes ${R.S.stats.lotes}, pedidos fabricados ${R.S.stats.pedidosFabricados}; calendário ${JSON.stringify((({ dia, mes, ano }) => ({ dia, mes, ano }))(R.J.calendario()))}`);
  if (det) for (const [k, c] of Object.entries(R.M)) {
    L.push(`cap ${k}: ${c.dur.toFixed(1)} h, turnos ${c.turnos}, sem ação ${((100 * c.semAcao) / Math.max(1, c.turnos)).toFixed(0)}%, parado ${((100 * c.parado) / Math.max(1, c.turnos)).toFixed(0)}%, etapas ${c.etapas}, módulos ${c.modulos}, níveis +${c.niveis}, créditos ${c.credMin === Infinity ? '-' : c.credMin}..${c.credMax} (fim ${c.credFim}), bem ${c.bemFim}%, pedidos ${c.pedidos} (fabricados ${c.fabricados}), compras ${c.compras}, vendas ${c.vendas}+${c.vendasCred}, mutirão ${c.mutUsado}, aceleradores ${c.acelerados}, lotes ${c.lotes} (auto ${c.autoLotes}), emprestado ${c.emprestado}, obras simultâneas máx ${c.obrasMax} p95 ${c.obrasP95}`);
    if (Object.keys(c.bloq).length) L.push('   bloqueios (min): ' + Object.entries(c.bloq).map(([a, b]) => `${a} ${Math.round(b)}`).join(', '));
  }
  L.push('oficinas ocupadas: ' + Object.entries(R.oficinas).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(', '));
  L.push(`fichas: ganhas ${R.fichas.ganhas.toFixed(1)}, perdidas no teto ${R.fichas.perdidas.toFixed(1)}, usadas ${R.fichas.usadas}; coletas ${R.S.stats.coletas}`);
  const pend = []; for (const p of PROJETOS) { const nx = R.J.proximaEtapa(p); if (nx) pend.push(`${p.id}.${nx.e.id}:${nx.s}`); } if (pend.length) L.push('pendentes ' + pend.slice(0, 10).join(' | '));
  L.push('módulos ' + Object.entries(R.S.modulos).map(([f, a]) => f + ':' + a.map((x) => x.nivel).join('')).join(' '));
  return L.join('\n');
}

// ------------------------------------------------------------------ faixas de aceitação
function faixasSessoes(R, nome, falhas, o = {}) {
  const f = (ok, msg) => { if (!ok) falhas.push(`${nome}: ${msg}`); };
  f(R.terminou && !R.travou, R.travou || 'não terminou');
  if (!R.terminou) return;
  f(R.dias >= 7 && R.dias <= 12, `jogo em ${R.dias.toFixed(1)} dias (faixa 7 a 12)`);
  for (const [k, c] of Object.entries(R.M)) {
    if (+k === 1) f(c.dur <= 36, `capítulo 1 em ${(c.dur / 24).toFixed(2)} dias (o começo é rápido: máx. 1,5)`);
    else if (+k <= 5) f(c.dur >= 18 && c.dur <= 96, `capítulo ${k} em ${(c.dur / 24).toFixed(2)} dias (faixa 0,75 a 4)`);
    else f(c.dur <= 8, `epílogo em ${c.dur.toFixed(1)} h (máx. 8)`);
    // economia nova: cada etapa devolve 150% do custo e os moradores pagam por hora, então os créditos crescem o jogo
    // inteiro (não há inflação de preços: nada é reprecificado); o que se confere é que crédito nunca vira parede a partir
    // do capítulo 2 (bloqueio por crédito em no máximo 10% dos turnos) e que o capítulo seguinte sempre está pago no fim
    if (+k >= 2 && +k <= 5) { const b = ((c.bloqTurnos['etapa:creditos'] || 0) + (c.bloqTurnos['mod:creditos'] || 0)) / Math.max(1, c.turnos); f(b <= 0.1, `capítulo ${k}: bloqueio por crédito em ${(100 * b).toFixed(0)}% dos turnos (máx. 10%)`); const cs = custoSeguinte(R.J, +k); f(c.credFim >= cs, `créditos no fim do capítulo ${k}: ${c.credFim} < custo do seguinte ${cs}`); }
  }
  f(R.S.stats.lotes > 500 && Object.values(R.M).reduce((a, c) => a + c.autoLotes, 0) > 0, `lotes ${R.S.stats.lotes} e automático ${Object.values(R.M).reduce((a, c) => a + c.autoLotes, 0)} (o robô produz em lotes e usa o automático)`);
  if (o.aceleradores !== 0 && !o.robo) f(R.S.stats.acelerados >= 50, `aceleradores usados ${R.S.stats.acelerados} (mín. 50: cada etapa dá 2)`);
  if (!o.robo) f(R.S.stats.pedidosFabricados >= 1, `pedidos fabricados na Usina de Pedidos ${R.S.stats.pedidosFabricados} (mín. 1)`);
  f(R.J.emprestimoInfo().divida < 1, `dívida no fim ${R.J.emprestimoInfo().divida.toFixed(0)}`);
  const of = Object.entries(R.oficinas).filter(([k]) => PREDIOS[k].tipo === 'oficina'); const media = of.reduce((a, [, v]) => a + v, 0) / Math.max(1, of.length);
  f(media >= 0.15, `oficinas ocupadas ${(media * 100).toFixed(0)}% em média (mín. 15%)`);
  f(R.M[5] && R.M[5].niveis >= 3, `${R.M[5]?.niveis ?? 0} níveis no capítulo 5 (mín. 3)`);
  f(R.nNovo6 === 1 && R.nFim <= 1, `capítulo 6 registrado ${R.nNovo6} vez(es)`);
  if (o.mutirao) f(R.fichas.perdidas <= 0.3 * Math.max(1, R.fichas.ganhas), `fichas perdidas ${R.fichas.perdidas.toFixed(1)} de ${R.fichas.ganhas.toFixed(1)} (máx. 30%)`);
}

// ------------------------------------------------------------------ invariantes da planta (sem trava possível)
export function invariantes() {
  const erros = [];
  for (let c = 1; c <= 5; c++) {
    let pop = 0, min5 = Infinity; const lim = (f) => { const L = LIMITE_CAP[f]; if (!L) return MODULOS[f].max; let v = 0; for (const [k, n] of Object.entries(L)) if (c >= +k) v = n; return v; };
    for (const [f, M] of Object.entries(MODULOS)) if (M.cap <= c) { const n = Math.min(M.max, lim(f)); pop += N_MODULOS[f] * Math.round(M.pop * POP_NIVEL[n]); if (n >= 5) min5 = Math.min(min5, Math.round(M.pop * (POP_NIVEL[5] - POP_NIVEL[4]))); }
    const serv = { agua: 0, energia: 0, saneamento: 0 }; let bem = 0;
    for (const p of PROJETOS) for (const e of p.etapas) if ((e.cap || p.cap) <= c) { for (const [k, v] of Object.entries(e.servico || {})) serv[k] += v; bem += e.bem || 0; }
    // pior escolha possível nos capítulos anteriores
    let piorBem = 0, piorEnergia = 0; for (let k = 1; k < c; k++) { const op = CAPITULOS[k - 1].escolha || []; const v = (id, q) => { let s = 0; for (const parte of [EFEITOS[id]?.bonus, EFEITOS[id]?.custo]) if (parte && !(parte.ateCap && c >= parte.ateCap)) s += parte[q] || 0; return s; }; if (op.length) { piorBem += Math.min(...op.map((x) => v(x.id, 'bem'))); piorEnergia += Math.min(...op.map((x) => v(x.id, 'energia'))); } }
    serv.energia += piorEnergia; const niveis = Math.max(...Object.entries(MODULOS).filter(([, M]) => M.cap <= c).map(([f, M]) => Math.min(M.max, lim(f))));
    for (const [lv, ks] of Object.entries(SERVICO_NIVEL)) if (niveis >= +lv) for (const k of ks) if (serv[k] < pop) erros.push(`capítulo ${c}: ${k} ${serv[k]} < população possível ${pop}`);
    for (const [lv, b] of Object.entries(BEM_NIVEL)) if (niveis >= +lv) { const v = 35 + bem + piorBem - (pop - min5) / PRESSAO_MORADIA; if (v < b) erros.push(`capítulo ${c}: bem-estar no último pavimento ${v.toFixed(1)} < ${b} com a pior escolha`); }
  }
  return erros;
}

// ------------------------------------------------------------------ testes de regra
function testes() {
  const falhas = []; const f = (ok, msg) => { if (!ok) falhas.push('teste: ' + msg); };
  const r0 = Math.random; Math.random = semente(7);
  try {
    const T = DIA0 + 8 * H;
    // coleta automática: com o almoxarifado lotado a bandeja enche (9) e a fila para; liberado o espaço, a bandeja
    // esvazia sozinha no tick e o próximo trabalho começa nesse instante, com o tempo inteiro
    { const S = novoEstado(T); const J = new Jogo(S); S.predios.carpintaria.ok = true; S.itens.madeira = J.capacidade + 10; const o = S.predios.carpintaria; o.prontos = Array(7).fill('viga');
      for (let i = 0; i < 3; i++) J.enfileirar('carpintaria', 'viga'); J.tick(T + 10 * H);
      f(o.prontos.length === 9 && o.fila.length === 1 && !o.fila[0].fim, `bandeja cheia deveria parar a fila (prontos ${o.prontos.length}, fila ${o.fila.length}, fim ${o.fila[0]?.fim})`);
      S.itens.madeira = 10; J.tick(T + 10 * H + 1000); const g = o.fila[0]; f(o.prontos.length === 0 && S.itens.viga === 9 && g && Math.abs(g.fim - g.ini - J.durItem('viga')) < 2 && g.ini === T + 10 * H + 1000, 'com espaço no almoxarifado a bandeja esvazia sozinha e o próximo item leva o tempo inteiro');
      // lotes: 10 unidades levam 8 vezes o tempo de 1; o lote entra inteiro no almoxarifado; o que não cabe espera no espaço
      const S2 = novoEstado(T); const J2 = new Jogo(S2); f(J2.produzir('usina1', 'brita', 10) === 'ok' && J2.produzir('usina1', 'brita', 11) === 'valor' && J2.produzir('usina1', 'brita', 0) === 'valor', 'lote de 1 a 10');
      const sl = S2.predios.usina1.slots[0]; f(Math.abs(sl.fim - sl.ini - 8 * J2.durItem('brita')) < 2 && sl.n === 10 && Math.abs(J2.durLote('brita', 1) - J2.durItem('brita')) < 1e-6, 'lote de 10 leva 8 vezes o tempo de 1');
      S2.itens.madeira = J2.capacidade - 9; J2.tick(T + H); f(S2.itens.brita === 4 + 5 && sl.sobra === 5 && S2.predios.usina1.slots[0] === sl && J2.livre === 0, `almoxarifado lotado: entra o que cabe e o resto espera (brita ${S2.itens.brita}, sobra ${sl.sobra})`);
      f(J2.coletarUsina('usina1', 0) === 'almox', 'coletar com o almoxarifado cheio avisa'); S2.itens.madeira = 0; f(J2.coletarUsina('usina1', 0) === 'ok' && S2.itens.brita === 14 && !S2.predios.usina1.slots[0], 'a sobra é coletada quando abre espaço');
      // automático: o espaço recomeça o mesmo lote no instante em que o anterior terminou, e para quando o almoxarifado lota
      const S3 = novoEstado(T); const J3 = new Jogo(S3); J3.produzir('usina1', 'brita', 5, true); J3.tick(T + 8 * H); const s3 = S3.predios.usina1.slots[0];
      f(S3.itens.brita >= 40 && J3.livre === 0 && s3 && s3.auto && s3.item === 'brita' && s3.n === 5 && s3.sobra > 0, `automático produz até lotar o almoxarifado (brita ${S3.itens.brita}, livre ${J3.livre}, sobra ${s3?.sobra})`);
      f(J3.setAuto('usina1', 0, false) === 'ok' && !s3.auto && J3.cancelarSlot('usina1', 0) === 'ok' && !S3.predios.usina1.slots[0] && J3.cancelarSlot('usina1', 0) === 'nada', 'setAuto e cancelarSlot');
      // oficina em lotes: loteMax pelos insumos, insumos consumidos na hora, cancelar devolve; automático repete enquanto houver insumos
      const S4 = novoEstado(T); const J4 = new Jogo(S4); S4.predios.carpintaria.ok = true; S4.itens.madeira = 30; f(J4.loteMax('carpintaria', 'viga') === 10 && J4.enfileirar('carpintaria', 'viga', 5) === 'ok' && S4.itens.madeira === 20 && J4.enfileirar('carpintaria', 'viga', 11) === 'valor', 'lote na oficina limitado pelos insumos');
      S4.itens.madeira = 0; f(J4.enfileirar('carpintaria', 'viga', true) === 'ok' && S4.predios.carpintaria.fila[1].pend && S4.predios.carpintaria.fila[1].n === 1, 'chamada antiga enfileirar(oid, item, true) ainda encadeia 1 unidade');
      f(J4.cancelarFila('carpintaria', 1) === 'ok' && S4.itens.madeira === 0 && J4.cancelarFila('carpintaria', 0) === 'ok' && S4.itens.madeira === 10 && !S4.predios.carpintaria.fila.length, 'cancelar devolve os insumos'); S4.itens.madeira = 30;
      f(J4.setAutoFila('carpintaria', true, 'viga', 4) === 'ok' && S4.predios.carpintaria.fila.length === 1 && S4.predios.carpintaria.fila[0].auto, 'setAutoFila entra na fila na hora');
      J4.tick(T + 3 * H); f(S4.itens.viga === 15 && S4.itens.madeira === 0 && !S4.predios.carpintaria.fila.length, `automático repete até acabar os insumos (viga ${S4.itens.viga}, madeira ${S4.itens.madeira})`);
      S4.itens.madeira = 8; J4.tick(T + 4 * H); f(S4.itens.viga === 19 && J4.setAutoFila('carpintaria', false) === 'ok' && !S4.predios.carpintaria.auto, 'insumos novos: o automático volta; desligar limpa'); }
    // encomenda em cadeia: concreto sem cimento puxa da bandeja da própria central; pendente vencido libera a vaga
    { const S = novoEstado(T); const J = new Jogo(S); S.nivel = 6; S.predios.concreto.ok = true; S.predios.carpintaria.ok = true; S.itens.brita = 20; S.itens.argila = 5;
      f(J.enfileirar('concreto', 'concreto', true) === 'ok' && S.predios.concreto.fila[0].pend, 'item sem insumos deveria entrar pendente');
      f(J.enfileirar('concreto', 'cimento') === 'ok' && S.predios.concreto.fila[0].item === 'cimento' && S.predios.concreto.fila[0].fim, 'pendente não pode segurar a fila');
      J.tick(T + 2 * H); f(S.itens.concreto >= 1, 'o pendente deveria puxar o cimento pronto e produzir');
      const S2 = novoEstado(T); const J2 = new Jogo(S2); S2.nivel = 6; S2.predios.carpintaria.ok = true; J2.enfileirar('carpintaria', 'trelica', true); J2.tick(T + 13 * H); f(S2.predios.carpintaria.fila.length === 0, 'pendente sem insumos por 12 h deveria liberar a vaga'); }
    // tempo fechado: 3 dias em no máximo 288 passos, e em menos de 100 ms
    { const S = novoEstado(T); const J = new Jogo(S); S.predios.carpintaria.ok = true; S.itens.madeira = 20; for (let i = 0; i < 3; i++) J.enfileirar('carpintaria', 'viga'); const t0 = performance.now(); J.tick(T + 72 * H); f(performance.now() - t0 < 100, 'avanço offline caro demais'); f(S.itens.viga === 3, 'avanço offline não produziu a fila'); }
    // níveis: dois de uma vez geram um evento só; nível não dá ficha
    { const S = novoEstado(T); const J = new Jogo(S); const ev = []; J.on((t, d) => t === 'nivel' && ev.push(d)); const fichas = S.mutirao; J._xp(200, 'teste'); f(ev.length === 1 && ev[0].de === 1 && ev[0].para === 4 && ev[0].especiais.length === 3 && ITENS[ev[0].especial], 'vários níveis de uma vez deveriam gerar um único evento'); f(S.mutirao === fichas, 'subir de nível não dá ficha'); }
    // falas: uma por etapa
    { const falta = []; for (const p of PROJETOS) for (const e of p.etapas) if (!FALAS_ETAPA[p.id + '.' + e.id]) falta.push(p.id + '.' + e.id); f(!falta.length, 'etapas sem fala: ' + falta.join(', ')); }
    // migração v1 → v2 (saves sintéticos: início, capítulo 3 com escolhas antigas e 5 fichas, epílogo)
    { const v1 = (cap, o = {}) => { const S = novoEstado(T - 5 * 24 * H); S.v = 1; S.cap = cap; delete S.disposicao; delete S.topografo; delete S.deposito; delete S.bemTemp; delete S.marcos; delete S.itens.estaca; S.itens.nó = 3; S.predios.velho = { ok: true }; S.modulos.anel.push({ nivel: 2, obra: null }); S.stats = { coletas: 10, obras: 2, jogadoMs: 5 }; S.dicas.guia = 1; Object.assign(S, o); return JSON.parse(JSON.stringify(S)); };
      const a = prepararSave(v1(1), T); const Ja = new Jogo(a); f(Number.isFinite(Ja.ocupado) && a.v === VERSAO_SAVE && a.itens.estaca === 0 && a._orfaos?.itens?.nó === 3 && a._orfaos?.predios?.velho && a._orfaos?.modulos?.anel && a.dicas.guia === 1, 'migração do início');
      const b0 = v1(3, { mutirao: 5, capEscolhas: { 1: 'usina+', 2: 'mutirao2' }, bonus: { usina: 0.15, oficina: 0, almox: 0, repasse: 0, bem: 0, xp: 0 }, nivel: 16, xp: 9000, creditos: 50000 }); b0.itens.kitvet = 2; b0.predios.laboratorio = { ok: true, fila: [{ item: 'racao', ini: T - 1000, fim: T + 1000 }], prontos: [], nFila: 4 }; b0.etapas['biblioteca.e1'] = { estado: 'feita', entregue: {} }; b0.modulos.anel.forEach((x) => (x.nivel = 3));
      const b = prepararSave(b0, T); const Jb = new Jogo(b); Jb.agora = T;
      f(b.mutirao === 3 && b.disposicao === 100 && Jb.ef.usina === 0.15 && b.capEscolhas[1] === 'legado:usina+' && b.creditos === 50000 + 4500 && b._avisos?.some((x) => x.includes('Mutirão')) && b.nivel === 16 && b.feita !== 0 && Jb.feita('biblioteca.e1') && b.modulos.anel.every((x) => x.nivel === 3), 'migração do capítulo 3 (bônus, fichas, progresso)');
      const r0 = v1(3, { repasse: { acum: 40538.7, t: T - H } }); const cr0 = r0.creditos; const rs = prepararSave(r0, T); const Jr = new Jogo(rs); Jr.tick(T);
      f(rs.creditos === cr0 + 40538 && rs.repasse.acum <= Jr.taxaRepasse() * 60 * COFRE_H + 1e-6 && rs._avisos?.some((x) => x.includes('cofre antigo')), 'migração: o cofre de repasses antigo vira créditos, com aviso');
      { const S = novoEstado(T); const J = new Jogo(S); J.tick(T); const max = J.taxaRepasse() * 60 * COFRE_H; S.repasse.acum = max * 1.5; J.tick(T + 60000); f(S.repasse.acum === max * 1.5, 'o cofre de repasses não pode encolher quando a taxa cai'); }
      f(Jb.liberado('racao') === false || b.legado.includes('racao'), 'item do capítulo 5 na fila continua liberado'); f(b.predios.laboratorio.fila.length === 1, 'fila preservada');
      f(Math.abs(Jb.durItem('bloco') - ITENS.bloco.t0 * 1000 * F_PRODUTO) < 1 && Jb.fObra(3) === 0.7, 'ritmo novo entra em rampa');
      const c0 = v1(6, { capEscolhas: { 1: 'usina+', 2: 'repasse+', 3: 'bem+', 4: 'xp+', 5: 'mutirao2' } }); c0.etapas['reflorestar.e1'] = { estado: 'prancha', entregue: { muda: 15, substrato: 2 } }; const muda0 = c0.itens.muda; c0.modulos.anel.forEach((x) => (x.nivel = 5)); // no capítulo 6 há moradores pagando a renda
      const c = prepararSave(c0, T); f(c.etapas['reflorestar.e1'].entregue.muda === 8 && c.itens.muda === muda0 + 7 && !c.etapas['reflorestar.e0'], 'epílogo antigo: entrega acima do pedido volta ao almoxarifado');
      const d = prepararSave(prepararSave(v1(2), T), T); f(d.v === VERSAO_SAVE && !d._orfaos?.x, 'normalizar é idempotente');
      const d2 = prepararSave({ ...novoEstado(T), mutirao: 7, disposicao: 250, creditos: -5 }, T); f(d2.mutirao === 3 && d2.disposicao === 100 && d2.creditos === 0, 'normalizar limita fichas, disposição e créditos');
      const e = prepararSave({ v: 1, itens: { madeira: 'x' }, modulos: {}, etapas: { 'nada.e1': {} } }, T); f(new Jogo(e).ocupado === 0 && e._orfaos.etapas['nada.e1'], 'save quebrado vira jogo válido');
      let g = null; try { g = prepararSave({ v: 1, cap: 2, itens: {}, modulos: { anel: 5 }, predios: { carpintaria: { ok: true, fila: 5, prontos: 'x' }, x: { fila: 5 } }, pedidos: [{ itens: 5 }], etapas: { 'reflorestar.e1': 5 } }, T); const Jg = new Jogo(g); Jg.tick(T + H); } catch (err) { g = null; } f(g && g.predios.carpintaria.ok && g.predios.carpintaria.fila.length === 0, 'save com listas quebradas não pode lançar exceção');
      let h = null; try { const h0 = JSON.parse(JSON.stringify(novoEstado(T))); h0.etapas['constructor.e1'] = { estado: 'feita' }; h0.itens.toString = 3; h0.predios.hasOwnProperty = { ok: true }; h0.topografo = { k: 'valueOf' }; h0.capEscolhas = { 1: 'constructor' }; h = prepararSave(h0, T); new Jogo(h).tick(T + H); } catch (err) { h = null; }
      f(h && h._orfaos?.etapas?.['constructor.e1'] && h.topografo === null && !Object.hasOwn(h.itens, 'toString'), "save com chaves como 'constructor' não pode lançar exceção");
      // o robô continua cada save migrado até o fim, sem trava
      for (const [nome, v] of [['início', v1(1)], ['capítulo 3', b0], ['epílogo', c0]]) { const R = rodar({ estado: v, passo: 5, semente: 3 }); f(R.terminou && !R.travou, `robô a partir do save v1 (${nome}): ${R.travou || 'não terminou'}`); } }
    // migração v2 → v3 (save no formato da versão anterior: espaços e filas sem lote, sem calendário, empréstimo nem aceleradores)
    { const S2 = JSON.parse(JSON.stringify(novoEstado(T - 3 * 24 * H))); S2.v = 2; S2.t = T - H; S2.cap = 2; S2.nivel = 9; S2.creditos = 12000; S2.almoxNivel = 3; delete S2.calendario; delete S2.emprestimo; delete S2.aceleradores; delete S2.valuationMax; delete S2.stats.lotes;
      S2.predios.usina1.slots = [{ item: 'brita', ini: T - 2 * H, fim: T - H - 1000 }, { item: 'madeira', ini: T - H, fim: T + H }, null]; delete S2.predios.usina2.fila; S2.predios.carpintaria = { ok: true, fila: [{ item: 'viga', ini: T - H, fim: T + 600e3 }, { item: 'deque', ini: 0, fim: 0 }, { item: 'trelica', ini: 0, fim: 0, pend: true, desde: T - H }], prontos: ['viga', 'viga'], nFila: 4 };
      S2.pedidos = [{ id: 7, espera: T, itens: { viga: 2 }, recompensa: { creditos: 90, xp: 10 }, quem: 'x' }]; S2.deposito = { janela: 5, n: { brita: 2 }, vendas: 3 }; S2.repasse = { acum: 250, t: T - H }; S2.modulos.anel.slice(0, 3).forEach((x) => (x.nivel = 2)); for (const k of ['pas_frente.e1', 'lago.e1', 'sede.e1', 'sede.e2']) S2.etapas[k] = { estado: 'feita', entregue: {} };
      const P = prepararSave(JSON.parse(JSON.stringify(S2)), T); const JP = new Jogo(P);
      f(P.v === VERSAO_SAVE && P.calendario.inicio === S2.criado && P.calendario.dia === Math.floor((S2.t - S2.criado) / 20000) && P.emprestimo.principal === 0 && P.emprestimo.contratos.length === 0 && P.aceleradores.obra === 0 && P.valuationMax === 0 && P._avisos?.some((x) => x.includes('Economia nova')), 'migração v2 → v3: calendário desde a criação, empréstimo vazio, aceleradores zerados, aviso');
      const u = P.predios.usina1.slots, c = P.predios.carpintaria; f(u[0].n === 1 && u[0].auto === false && u[1].item === 'madeira' && u[1].n === 1 && c.fila[0].n === 1 && c.fila[0].auto === false && c.fila[0].fim === T + 600e3 && c.fila[2].pend && c.fila[2].n === 1 && c.prontos.length === 2 && c.auto === null && Array.isArray(P.predios.usina2.fila) && P.pedidos[0].auto === false && P.deposito.vendas === 3 && P.repasse.acum === 250 && P.creditos === 12000 && P.almoxNivel === 3, 'migração v2 → v3: lotes de 1 nos espaços e filas, bandeja, pedidos, depósito e cofre preservados');
      JP.tick(T); f(P.itens.brita === 4 + 1 && !u[0] && P.itens.viga === 2 && c.prontos.length === 0 && JP.calendario().ano >= 1 && JP.emprestimoInfo().divida === 0 && JP.valuation().total > 0, 'depois da migração o lote pronto e a bandeja entram sozinhos no almoxarifado');
      const R = rodar({ estado: S2, sessoes: SESSOES_PADRAO, passo: 1, semente: 4 }); f(R.terminou && !R.travou, `robô a partir do save v2: ${R.travou || 'não terminou'}`); }
    // recarregar não dá vagas de fila de graça nem devolve material entregue a mais por causa de uma escolha
    { let S = novoEstado(T); S.cap = 3; S.capEscolhas = { 1: 'amplo', 2: 'biblio24h' }; S.predios.carpintaria.ok = true; S.predios.carpintaria.fila = Array.from({ length: 6 }, () => ({ item: 'viga', ini: 0, fim: 0 }));
      S.etapas['biblioteca.e1'] = { estado: 'feita', entregue: {} }; S.etapas['biblioteca.e2'] = { estado: 'feita', entregue: {} }; S.etapas['biblioteca.e3'] = { estado: 'prancha', entregue: { estante: 8, trelica: 3 } }; S.etapas['crd.e1'] = { estado: 'obra', entregue: { premoldado: 5 }, ini: T, fim: T + H }; // em obra o material já foi usado (mesmo acima do pedido-base)
      const est0 = S.itens.estante, pre0 = S.itens.premoldado; for (let i = 0; i < 3; i++) S = prepararSave(JSON.parse(JSON.stringify(S)), T); const J = new Jogo(S);
      f(S.predios.carpintaria.nFila === 3 && J.vagasFila('carpintaria') === 6, `recarregar com 'amplo' deu vagas de graça (nFila ${S.predios.carpintaria.nFila})`);
      f(S.etapas['biblioteca.e3'].entregue.estante === 8 && S.itens.estante === est0 && !J.faltaEtapa('biblioteca.e3').estante, 'recarregar devolveu estantes pedidas pela escolha biblio24h');
      f(S.etapas['crd.e1'].entregue.premoldado === 5 && S.itens.premoldado === pre0, 'recarregar devolveu material de etapa em obra'); }
    // depósito: estoque de 10, preço sobe; venda a 150% do preço base de compra, até 100 por janela
    { const S = novoEstado(T); const J = new Jogo(S); J.agora = T; S.creditos = 1e6; S.nivel = 5; const p0 = J.precoCompra('madeira'); for (let i = 0; i < 12; i++) J.comprar('madeira'); f(S.itens.madeira === 16 && J.estoqueDeposito('madeira').n === 0 && J.comprar('madeira') === 'esgotado' && J.precoCompra('madeira') > p0, 'estoque do depósito');
      f(J.precoVenda('brita') === Math.ceil(1.5 * p0 / ITENS.madeira.valor * ITENS.brita.valor) && J.precoVenda('brita') === Math.ceil(1.5 * J.precoBase('brita')) && J.precoVenda('concreto') === Math.ceil(4.5 * ITENS.concreto.valor), 'venda a 150% do preço base de compra');
      S.itens.brita = 150; const c0 = S.creditos; f(J.vender('brita', 120) === 'ok' && S.itens.brita === 50 && S.creditos === c0 + 100 * J.precoVenda('brita') && J.vendasDeposito().feitas === 100 && J.vender('brita', 1) === 'limite', 'limite de 100 vendas por janela'); J.agora = T + 4 * H; J.tick(T + 4 * H); f(J.estoqueDeposito('madeira').n === 10 && J.vendasDeposito().feitas === 0, 'estoque e vendas renovam na janela seguinte'); }
    // topógrafo, mutirão (até 2 h), disposição
    { const S = novoEstado(T); const J = new Jogo(S); J.agora = T; S.itens.madeira = 5; f(J.encomendarLicenca('estaca') === 'ok' && J.encomendarLicenca('baliza') === 'ocupado', 'topógrafo uma por vez'); J.tick(T + 21 * 60000); f(S.itens.estaca === 2 && !S.topografo, 'topógrafo entrega a licença');
      S.etapas['lago.e1'] = { estado: 'obra', entregue: {}, ini: J.agora, fim: J.agora + 5 * H }; S.mutirao = 1; J.mutirao({ etapa: 'lago.e1' }); f(Math.abs(S.etapas['lago.e1'].fim - (J.agora + 3 * H)) < 1000, 'mutirão adianta 2 h');
      S.mutirao = 3; S.disposicao = 95; J._disposicao(20); f(S.mutirao === 3 && S.disposicao === 100 && S.stats.dispPerdida === 15, 'teto de fichas e disposição'); }
    // marcos, pedidos por capítulo, epílogo com pré-entrega, planoMeta sem beco
    { const S = novoEstado(T); const J = new Jogo(S); const ev = []; J.on((t, d) => ev.push([t, d])); S.predios.carpintaria.ok = true; J._verCapitulo(); S.etapas['pas_frente.e1'] = { estado: 'feita', entregue: {} }; J._verCapitulo(); f(S.marcos[1] === 1 && ev.some(([t]) => t === 'fala'), 'marco em 1/3 das metas');
      S.cap = 2; S.nivel = 8; J._derivar(); J.tick(T + 1000); f(S.pedidos.length === 3 && S.pedidos.every((p) => p.itens && p.quem && p.fala && p.recompensa), 'pedidos no capítulo 2: 3 cartões com rosto'); S.cap = 4; J.tick(T + 2000); f(S.pedidos.length === 6, '6 cartões do capítulo 4');
      S.cap = 5; J._derivar(); S.itens.muda = 10; f(J.entregar('reflorestar.e1', 'muda') === 'ok' && S.etapas['reflorestar.e1'].entregue.muda === 8, 'prancha do epílogo aceita entregas no capítulo 5'); f(J.iniciarEtapa('reflorestar.e1') === 'bloqueada', 'epílogo só inicia no capítulo 6');
      const S3 = novoEstado(T); const J3 = new Jogo(S3); const pl = J3.planoMeta(); f(pl && pl.acao !== 'aguardar' && pl.texto, 'planoMeta no início: ' + JSON.stringify(pl)); f(J3.metaProgresso(CAPITULOS[0].metas[4]).txt === '0/3', 'metaProgresso de módulos');
      // bandeja cheia de outro produto: a Meta em foco manda coletar (a fila parada nunca entrega as vigas)
      const S4 = novoEstado(T); const J4 = new Jogo(S4); J4.agora = T; S4.nivel = 5; S4.predios.carpintaria.ok = true; for (const k of ['pas_frente.e1', 'lago.e1', 'sede.e1']) S4.etapas[k] = { estado: 'feita', entregue: {} }; S4.modulos.anel.slice(0, 3).forEach((x) => (x.nivel = 2)); S4.etapas['sede.e2'] = { estado: 'prancha', entregue: { concreto: 3 } };
      const o4 = S4.predios.carpintaria; o4.prontos = Array(9).fill('deque'); o4.fila = Array.from({ length: 3 }, () => ({ item: 'viga', ini: 0, fim: 0 })); S4.itens.viga = 0; J4._derivar();
      const p4 = J4.planoMeta(); f(p4?.acao === 'coletar' && p4.alvo?.predio === 'carpintaria', 'bandeja cheia: a Meta em foco deveria mandar coletar (' + p4?.texto + ')');
      J4.coletarOficina('carpintaria'); J4.tick(T + 3 * H); f(S4.itens.viga === 3, 'depois da coleta as vigas saem');
      // encomenda em cadeia sem insumos: o plano pede os insumos, não mais uma encomenda do mesmo produto
      const S5 = novoEstado(T); const J5 = new Jogo(S5); J5.agora = T; S5.nivel = 5; S5.predios.carpintaria.ok = true; for (const k of ['pas_frente.e1', 'lago.e1', 'sede.e1']) S5.etapas[k] = { estado: 'feita', entregue: {} }; S5.modulos.anel.slice(0, 3).forEach((x) => (x.nivel = 2)); S5.etapas['sede.e2'] = { estado: 'prancha', entregue: { concreto: 3 } };
      S5.itens.madeira = 0; S5.itens.viga = 0; S5.predios.carpintaria.fila = Array.from({ length: 4 }, () => ({ item: 'viga', ini: 0, fim: 0, pend: true, desde: T })); J5._derivar();
      const p5 = J5.planoMeta(); f(p5?.acao === 'produzir' && p5.item === 'madeira', 'vigas pendentes: a Meta em foco deveria pedir madeira (' + p5?.texto + ')'); }
    // calendário: 20 s por dia, 30 dias por mês, 360 por ano; eventos de dia (com saltou) e de ano
    { const S = novoEstado(T); const J = new Jogo(S); const ev = []; J.on((t, d) => (t === 'dia' || t === 'ano') && ev.push([t, d])); J.tick(T + 25000); const c = J.calendario();
      f(c.dia === 1 && c.diaDoMes === 2 && c.mes === 1 && c.ano === 1 && Math.abs(c.progDia - 0.25) < 1e-9 && c.diaMs === 20000 && ev.length === 1 && ev[0][1].saltou === 1, 'calendário no 2º dia');
      J.tick(T + 361 * 20000); const c2 = J.calendario(); f(c2.ano === 2 && c2.mes === 1 && c2.diaDoMes === 2 && ev.length === 3 && ev[1][0] === 'dia' && ev[1][1].saltou === 360 && ev[2][0] === 'ano' && ev[2][1].ano === 2, 'virada de ano com um único evento de dia (saltou 360)'); }
    // empréstimo: múltiplos de 1.000, 50 mil por ano, dívida máxima, juros de 10% ao ano (por tempo), parcela, quitação, mora depois do prazo
    { const S = novoEstado(T); const J = new Jogo(S); J.tick(T); const av = []; J.on((t, d) => t === 'aviso' && av.push(d)); f(J.emprestar(500) === 'valor' && J.emprestar(1500) === 'valor' && J.emprestar(30000) === 'ok' && S.creditos === 33000 && J.emprestar(21000) === 'limiteAno' && J.emprestar(20000) === 'ok' && J.emprestar(1000) === 'limiteAno', 'limite de 50 mil por ano');
      f(av.length === 2 && av.every((d) => d.creditos === undefined && d.icone === 'creditos'), 'o aviso do empréstimo tomado não leva creditos (a interface faz as moedas voarem do botão)');
      f(typeof J.loteMax === 'function' && PREDIOS.usina2.pedidos === true && typeof J.durLote === 'function' && ['loteMax', 'fLote', 'aceleraH', 'empAno', 'empMax', 'empTaxa', 'empPrazoAnos', 'empPasso', 'empMora', 'offlineH', 'offlineFator', 'cofreH'].every((k) => typeof REGRAS[k] === 'number'), 'a interface detecta a simulação nova por J.loteMax, PREDIOS.usina2.pedidos e as REGRAS novas');
      J.tick(T + ANO_MS / 2); f(Math.abs(S.emprestimo.juros - 2500) < 1e-6 && J.emprestimoInfo().disponivelAno === 0, 'juros de 10% ao ano, proporcionais ao tempo');
      J.tick(T + ANO_MS + 1000); f(J.emprestimoInfo().disponivelAno === 50000 && J.emprestimoInfo().ano === 2, 'ano novo libera mais 50 mil');
      S.creditos = 100; f(J.pagarJuros() === 'ok' && S.creditos === 0 && S.emprestimo.juros > 4800, 'pagar juros paga o que dá'); S.creditos = 1e6; f(J.pagarJuros() === 'ok' && S.emprestimo.juros === 0 && J.pagarJuros() === 'nada', 'pagar juros zera');
      f(J.pagarParcela() === 'ok' && S.emprestimo.principal === 45000 && S.emprestimo.contratos.map((c) => c.saldo).join() === '25000,20000', 'parcela de 10% abate o contrato mais antigo');
      let neg = null; for (let k = 2; k <= 11; k++) { J.tick(T + k * ANO_MS + 1000); S.emprestimo.juros = 0; const r = J.emprestar(50000); if (r !== 'ok') neg = neg || r; } const I = J.emprestimoInfo();
      f(neg === 'limiteDivida' && I.divida <= 500000 && I.principal >= 445000 && J.emprestar(50000) !== 'ok' && I.contratos.filter((c) => c.vencido).length === 2, `dívida máxima de 500 mil e contratos vencidos (${neg}, ${I.principal})`);
      const j0 = S.emprestimo.juros; J.tick(T + 11 * ANO_MS + 1000 + ANO_MS / 10); const dj = S.emprestimo.juros - j0; const esp = I.contratos.reduce((a, c) => a + c.saldo * (c.vencido ? 0.2 : 0.1), 0) / 10; f(Math.abs(dj - esp) < 1, `mora de 20% nos vencidos (juros ${dj.toFixed(0)} × ${esp.toFixed(0)})`);
      S.creditos = 10; f(J.quitar() === 'creditos', 'quitar sem créditos'); S.creditos = 2e6; f(J.quitar() === 'ok' && S.emprestimo.principal === 0 && S.emprestimo.juros === 0 && J.emprestimoInfo().contratos.length === 0 && J.quitar() === 'nada', 'quitar paga tudo');
      const P = prepararSave(JSON.parse(JSON.stringify(S)), T); f(P.emprestimo.principal === 0 && Array.isArray(P.emprestimo.contratos), 'empréstimo sobrevive ao save'); }
    // renda dos moradores: 5, 8 ou 11 por morador por hora pela faixa de bem-estar; cofre de 12 h; fechado rende 12 h a 50%
    { const S = novoEstado(T); const J = new Jogo(S); J.tick(T); f(J.rendaHora() === 0 && J.rendaInfo().cofreMax === 0, 'sem moradores não há renda');
      S.modulos.anel.forEach((x) => (x.nivel = 3)); J._derivar(); const pop = J.pop; f(pop === 2560 && J.bem <= 30 && J.tarifaMorador() === 5 && J.rendaHora() === pop * 5 && J.rendaInfo().faixa === '0-30', `tarifa de 5 até 30% (bem ${J.bem}, pop ${pop})`);
      J.tick(T + 60000); f(Math.abs(S.repasse.acum - J.rendaHora() / 60) < 1e-6, '1 minuto online rende 1/60 da renda por hora');
      J.tick(T + 60000 + 30 * H); f(Math.abs(S.repasse.acum - (J.rendaHora() / 60 + 12 * 0.5 * J.rendaHora())) < 1e-6, '30 h fechado rendem 12 h a 50%');
      S.repasse.acum = 0; for (let k = 0; k < 30; k++) J.tick(T + 60000 + 30 * H + (k + 1) * H); f(Math.abs(S.repasse.acum - 12 * J.rendaHora()) < 1e-6, 'o cofre guarda 12 h de renda');
      S.bemTemp = [{ n: 6, fim: T + 1000 * H }]; for (const p of PROJETOS) for (const e of p.etapas) if (e.bem) S.etapas[p.id + '.' + e.id] = { estado: 'feita', entregue: {} }; J._derivar(); f(J.bem > 60 && J.tarifaMorador() === 11 && J.rendaInfo().faixa === '61-100' && J.rendaHora() === pop * 11, 'tarifa de 11 acima de 60%');
      const max = J.rendaHora() * COFRE_H; S.repasse.acum = max * 1.5; J.tick(T + 100 * H); f(S.repasse.acum === max * 1.5, 'o cofre nunca encolhe quando a tarifa cai'); }
    // recompensa de 150% (créditos + itens) e aceleradores por etapa e pavimento
    { const S = novoEstado(T); const J = new Jogo(S); J.tick(T); S.itens.madeira = 3; S.itens.brita = 2; J.entregarTudo('pas_frente.e1'); const c0 = S.creditos; f(J.iniciarEtapa('pas_frente.e1') === 'ok' && J.acelerar({ etapa: 'pas_frente.e1' }) === 'sem', 'sem acelerador no começo');
      J.tick(T + 60000); const ev = []; J.on((t, d) => t === 'etapaFeita' && ev.push(d)); f(J.aprovarEtapa('pas_frente.e1') === 'ok' && ev[0].recompensa === Math.round(1.5 * (150 + 3 * 12 + 2 * 14)) && S.creditos - c0 === -150 + ev[0].recompensa + 400 && S.aceleradores.obra === 1 && S.aceleradores.producao === 1, `recompensa de 150% do custo (${ev[0]?.recompensa})`);
      S.itens.brita = 4; S.itens.madeira = 2; J.entregarTudo('lago.e1'); J.iniciarEtapa('lago.e1'); const st = S.etapas['lago.e1']; f(J.acelerar({ etapa: 'lago.e1' }) === 'ok' && st.estado === 'pronta' && S.aceleradores.obra === 0 && J.acelerar({ etapa: 'lago.e1' }) === 'sem', 'acelerador adianta 1 h (a obra curta fica pronta)');
      J.produzir('usina1', 'brita', 10); f(J.acelerar({ predio: 'usina1' }) === 'ok' && S.aceleradores.producao === 0 && S.itens.brita >= 10 && !S.predios.usina1.slots[0], 'acelerador de produção adianta 1 h de todos os espaços (lote coletado)');
      S.aceleradores.producao = 1; S.predios.carpintaria.ok = true; S.itens.madeira = 20; J.enfileirar('carpintaria', 'viga', 10); const g = S.predios.carpintaria.fila[0]; const gf = g.fim; f(J.acelerar({ predio: 'carpintaria' }) === 'ok' && (S.itens.viga === 10 || g.fim === Math.max(J.agora, gf - H)), 'acelerador de produção na oficina');
      S.modulos.anel[0].pedido = null; J._pedidoModulos(); const r = J.requisitosModulo('anel', 0); for (const [k, n] of Object.entries(r.itens)) S.itens[k] = n; f(J.melhorarModulo('anel', 0) === 'ok', 'módulo iniciado'); const c1 = S.creditos; J.tick(T + 3 * H);
      const evm = []; J.on((t, d) => t === 'moduloFeito' && evm.push(d)); f(J.aprovarModulo('anel', 0) === 'ok' && evm[0].recompensa === Math.round(1.5 * (200 + Object.entries(r.itens).reduce((a, [k, n]) => a + n * ITENS[k].valor, 0))) && S.creditos - c1 >= evm[0].recompensa, 'pavimento devolve 150% do custo (créditos + itens)'); }
    // valuation: etapas e pavimentos a 150%, prédios pelo preço, 100 por morador, caixa menos dívida; recorde e evento
    { const S = novoEstado(T); const J = new Jogo(S); J.tick(T); const ev = []; J.on((t, d) => t === 'valuation' && ev.push(d.total)); f(J.valuation().total === 3000 && J.valuation().partes.caixa === 3000, 'valuation inicial é o caixa');
      S.etapas['pas_frente.e1'] = { estado: 'feita', entregue: {} }; S.modulos.anel[0].nivel = 2; J._derivar(); const v = J.valuation(); f(v.partes.obras === Math.round(1.5 * (150 + 36 + 28)) && v.partes.modulos === Math.round(1.5 * (200 + 700)) && v.partes.moradores === J.pop * 100 && v.total === v.partes.obras + v.partes.modulos + v.partes.moradores + 3000 && S.valuationMax === v.total, 'partes do valuation');
      S.creditos = 5000; J.construirPredio('carpintaria'); J.ampliar('carpintaria'); J.emprestar(10000); const v2 = J.valuation(); f(v2.partes.predios === 500 && v2.partes.caixa === S.creditos - 10000 && S.creditos >= 14500 && ev.length === 2 && v2.max === S.valuationMax, 'prédios, ampliações e dívida no valuation'); }
    // pedidos 5 × maiores com 150% do valor; Usina de Pedidos fabrica o que falta (matéria-prima e produto com insumos) e para
    { const S = novoEstado(T); const J = new Jogo(S); S.cap = 3; S.nivel = 8; J._derivar(); J.tick(T + 1000); f(S.pedidos.length === 4 && S.pedidos.every((p) => p.itens && Object.values(p.itens).every((q) => q % 5 === 0 && q >= 5) && p.recompensa.creditos === Math.round(1.5 * Object.entries(p.itens).reduce((a, [k, q]) => a + ITENS[k].valor * q, 0))), 'pedidos com 5 × as quantidades e 150% do valor');
      f(J.fabricarPedido(0) === 'fechado' && J.pedidosTotais()[Object.keys(S.pedidos[0].itens)[0]].n >= 5, 'sem a Usina de Pedidos não fabrica; totais por item');
      S.predios.usina2.ok = true; S.predios.carpintaria.ok = true; f(J.produzir('usina2', 'brita', 1) === 'bloqueado' && J.setAuto('usina2', 0, true) === 'bloqueado', 'a Usina de Pedidos não aceita produção comum');
      S.pedidos[0].itens = { brita: 15, viga: 10 }; S.itens.brita = 0; S.itens.viga = 0; S.itens.madeira = 0; const ev = []; J.on((t, d) => t === 'pedidoFabricando' && ev.push(d));
      f(J.fabricarPedido(0) === 'ok' && S.pedidos[0].auto && ev[0].itens.brita === 15 && ev[0].itens.viga === 10 && S.predios.usina2.slots[0]?.item === 'brita' && S.predios.usina2.slots[0].n === 10 && S.predios.usina2.slots[1]?.item === 'brita' && S.predios.usina2.slots[1].n === 5 && !S.predios.usina2.slots[2] && S.predios.usina2.fila.length === 1, 'a fila puxa em paralelo; o produto espera os insumos');
      J.tick(T + 2 * H); f(S.itens.brita === 15 && S.predios.usina2.fila[0]?.item === 'viga' && S.predios.usina2.slots.every((s) => !s), 'matéria-prima pronta e coletada; viga ainda espera madeira');
      S.itens.madeira = 20; J.tick(T + 2 * H + 1000); f(S.predios.usina2.slots[0]?.item === 'viga' && S.predios.usina2.slots[0].n === 10 && S.itens.madeira === 0 && !S.predios.usina2.fila.length, 'com os insumos a viga começa consumindo 10 × 2 madeira');
      J.tick(T + 6 * H); f(S.itens.viga === 10 && J.pedidosTotais().viga.falta === 0 && J.entregarPedido(0) === 'ok' && !S.pedidos[0].itens, 'pedido entregue com o que a usina fabricou');
      S.pedidos[1].itens = { brita: 20 }; f(J.fabricarPedido(1) === 'ok' && J.pararPedido(1) === 'ok' && !S.pedidos[1].auto && !S.predios.usina2.fila.length && J.pararPedido(1) === 'nada', 'parar tira da fila');
      const P = prepararSave(JSON.parse(JSON.stringify(S)), T + 6 * H); f(Array.isArray(P.predios.usina2.fila) && P.predios.usina2.slots.length === 3, 'a Usina de Pedidos sobrevive ao save'); }
    // cenário "juros e limites": sem crédito no começo, o robô toma empréstimo, paga os juros a cada visita e quita antes do fim
    { const S0 = novoEstado(T); S0.creditos = 0; const R = rodar({ estado: S0, sessoes: SESSOES_PADRAO, passo: 1, semente: 5, emprestimo: 1 }); const EI = R.J.emprestimoInfo();
      f(R.terminou && !R.travou, 'cenário de empréstimo: ' + (R.travou || 'não terminou')); f(R.S.stats.emprestado >= 1000 && R.S.stats.emprestado <= 100000 && R.S.stats.jurosPagos > 0 && EI.divida < 1, `cenário de empréstimo: tomado ${R.S.stats.emprestado}, juros pagos ${R.S.stats.jurosPagos}, dívida no fim ${EI.divida.toFixed(0)}`); }
    // tutorial: cada passo tem fala e teste
    f(TUTORIAL.every((p) => p.id && p.quem && p.fala && p.alvo && typeof p.feito === 'function'), 'tutorial incompleto');
  } catch (e) { falhas.push('teste: exceção ' + (e.stack || e.message)); }
  finally { Math.random = r0; }
  return falhas;
}

// ------------------------------------------------------------------ matriz (npm run simular:todos)
function todos() {
  const falhas = [...invariantes().map((x) => 'invariante: ' + x), ...testes()]; const sem = 1; const linhas = [];
  const roda = (nome, o) => { const t0 = Date.now(); const R = rodar({ semente: sem, ...o }); linhas.push(`\n=== ${nome} (${((Date.now() - t0) / 1000).toFixed(1)} s)\n${relatorio(R, !!process.env.RELATORIO)}`); if (R.travou || !R.terminou) falhas.push(`${nome}: ${R.travou || 'não terminou'}`); return R; };
  const A = roda('contínuo, passo 1 min, escolha 0', { passo: 1, escolha: 0 });
  if (A.M[1]) { const min = A.M[1].dur * 60; if (min < 30 || min > 45) falhas.push(`contínuo: capítulo 1 em ${min.toFixed(0)} min (faixa 30 a 45)`); linhas.push(`capítulo 1 em ${min.toFixed(0)} min (faixa 30 a 45)`); }
  const B = roda('contínuo, passo 2 min, escolha 1', { passo: 2, escolha: 1 });
  for (const [k, c] of Object.entries(B.M)) if (c.parado / Math.max(1, c.turnos) > 0.35) falhas.push(`contínuo passo 2: capítulo ${k} com ${((100 * c.parado) / c.turnos).toFixed(0)}% de turnos parados (máx. 35%)`);
  const ses = { sessoes: SESSOES_PADRAO, passo: 1 };
  const C = roda('sessões, escolha 0', { ...ses, escolha: 0 }); faixasSessoes(C, 'sessões escolha 0', falhas);
  const D = roda('sessões, escolha 1', { ...ses, escolha: 1 }); faixasSessoes(D, 'sessões escolha 1', falhas);
  const E = roda('sessões, alternada, mutirão e depósito', { ...ses, escolha: 'alt', mutirao: 1, deposito: 1 }); faixasSessoes(E, 'sessões alt+mutirão+depósito', falhas, { mutirao: 1 });
  const F = roda('sessões, alternada, mutirão', { ...ses, escolha: 'alt', mutirao: 1 }); faixasSessoes(F, 'sessões alt+mutirão', falhas, { mutirao: 1 });
  if (E.terminou && F.terminou && E.horas < 0.85 * F.horas) falhas.push(`depósito encurta o jogo demais: ${E.dias.toFixed(1)} contra ${F.dias.toFixed(1)} dias (máx. 15%)`);
  const G = roda('sessões, encomenda em cadeia', { ...ses, escolha: 0, cadeia: 1 }); faixasSessoes(G, 'sessões cadeia', falhas);
  const H = roda('sessões, robô da Meta em foco', { ...ses, escolha: 0, robo: 'meta' });
  // quem só segue a Meta em foco (que também manda adiantar produção, subir módulos em paralelo, pré-entregar o epílogo
  // e ampliar o que trava, mas não usa aceleradores nem a Usina de Pedidos) termina em 10 a 16 dias, com o epílogo em até 8 h
  if (H.terminou && C.terminou) { const ep = H.M[6]?.dur ?? 0; linhas.push(`Meta em foco: ${H.dias.toFixed(1)} dias (${(H.dias / C.dias).toFixed(2)} × o robô normal; faixa 10 a 16), epílogo ${ep.toFixed(1)} h, créditos no fim ${H.S.creditos}`);
    if (H.dias < 10 || H.dias > 16 || H.dias > 1.8 * C.dias) falhas.push(`Meta em foco: ${H.dias.toFixed(1)} dias (faixa 10 a 16, máx. 1,8 × ${C.dias.toFixed(1)})`); if (ep > 8) falhas.push(`Meta em foco: epílogo em ${ep.toFixed(1)} h (máx. 8)`); }
  // sem crédito no começo e com empréstimo: o robô toma até 100 mil, paga juros e termina sem dívida, no mesmo prazo
  { const S0 = novoEstado(DIA0 + 7 * H); S0.creditos = 0; const Emp = roda('sessões, sem crédito no começo, empréstimo', { ...ses, escolha: 0, emprestimo: 1, estado: S0 }); const EI = Emp.J.emprestimoInfo();
    linhas.push(`empréstimo: tomado ${Emp.S.stats.emprestado}, juros pagos ${Emp.S.stats.jurosPagos}, dívida no fim ${EI.divida.toFixed(0)}, ${Emp.dias.toFixed(1)} dias`);
    if (Emp.terminou && (Emp.S.stats.emprestado < 1000 || Emp.S.stats.emprestado > 100000 || EI.divida >= 1 || Emp.dias > 12)) falhas.push(`empréstimo: tomado ${Emp.S.stats.emprestado}, dívida no fim ${EI.divida.toFixed(0)}, ${Emp.dias.toFixed(1)} dias`); }
  // bem-estar: ~77% no fim do capítulo 3 (média das sessões) e sem saturar antes do capítulo 5, para a pressão de
  // moradia e as opções de bem-estar dos dilemas pesarem
  const b3 = [C, D, E, F, G].filter((R) => R.M[3]).map((R) => R.M[3].bemFim); const mb3 = b3.reduce((a, b) => a + b, 0) / Math.max(1, b3.length);
  linhas.push(`bem-estar no fim do capítulo 3: ${b3.join(', ')} (média ${mb3.toFixed(0)}%, faixa 70 a 85); fim dos capítulos 2 a 4: ${[C, D, E, F, G].map((R) => [2, 3, 4].map((k) => R.M[k]?.bemFim).join('/')).join(', ')}`);
  if (mb3 < 70 || mb3 > 85 || b3.some((x) => x < 55 || x > 90)) falhas.push(`bem-estar no fim do capítulo 3: ${b3.join(', ')} (média ${mb3.toFixed(0)}%)`);
  for (const R of [A, B, C, D, E, F, G]) for (const k of [2, 3, 4]) if (R.M[k]?.bemFim >= 100) falhas.push(`bem-estar saturou em 100% no fim do capítulo ${k}`);
  const san = [C, D, E, F, G].flatMap((R) => Object.values(R.M).map((c) => (c.bloqTurnos['serv:saneamento'] || 0) / Math.max(1, c.turnos))); linhas.push(`bloqueio por saneamento: até ${(Math.max(...san) * 100).toFixed(0)}% dos turnos de um capítulo`);
  if (!san.some((x) => x > 0) || san.some((x) => x >= 0.25)) falhas.push(`saneamento: bloqueio de ${(Math.max(...san) * 100).toFixed(0)}% (precisa ser > 0 e < 25%)`);
  const lic = [C, D, E, F, G, H].reduce((a, R) => a + Object.values(R.M).reduce((b, c) => b + (c.bloq['etapa:licenca'] || 0), 0), 0); linhas.push(`bloqueio por licença nas sessões: ${lic} min`); if (!lic) falhas.push('licenças nunca faltaram (a topografia não pesa)');
  // dilemas: só a escolha do capítulo k muda (a opção 0 cuida das pessoas, a 1 acelera a obra); compara o capítulo seguinte
  // e o resto do jogo no ritmo de trabalho contínuo (passo 2 min, 3 sementes fixas), onde a escolha não some no intervalo
  // entre sessões. O dilema do capítulo 5 pesa no epílogo, que é curto de propósito: conta como os outros (≥ 8% no epílogo),
  // e a armadilha ali é o epílogo passar de 3 h no contínuo (nas sessões, cada opção tem de fechá-lo em 8 h).
  const SEM = [1, 2, 3]; const cont = { passo: 2 }; const base = SEM.map((x) => rodar({ semente: x, ...cont, escolha: 0 })); const difs = []; const med = (L, f) => L.reduce((a, R) => a + f(R), 0) / L.length;
  for (let k = 1; k <= 5; k++) {
    const V = SEM.map((x) => rodar({ semente: x, ...cont, escolha: 0, escolhas: { [k]: 1 } })); if (V.some((R) => !R.terminou)) { falhas.push(`dilema ${k}: opção 1 não terminou`); continue; }
    const cap = (R) => R.M[k + 1]?.dur || 0, resto = (R) => R.horas - Object.entries(R.M).filter(([c]) => +c <= k).reduce((x, [, c]) => x + c.dur, 0);
    const a = med(base, cap), b = med(V, cap), ra = med(base, resto), rb = med(V, resto); const d = Math.abs(b - a) / Math.max(a, b), dr = Math.abs(rb - ra) / Math.max(ra, rb);
    if (k === 5) { linhas.push(`dilema do capítulo 5: epílogo ${(a * 60).toFixed(0)} × ${(b * 60).toFixed(0)} min (${(d * 100).toFixed(0)}%)`); difs.push([d, 0, true]); if (Math.max(...base.map(cap), ...V.map(cap)) > 3) falhas.push('dilema 5: epílogo passou de 3 h no contínuo (armadilha)'); continue; }
    difs.push([d, dr]); linhas.push(`dilema do capítulo ${k}: capítulo ${k + 1} ${a.toFixed(1)} × ${b.toFixed(1)} h (${(d * 100).toFixed(0)}%), resto do jogo ${ra.toFixed(0)} × ${rb.toFixed(0)} h (${(dr * 100).toFixed(0)}%)`);
  }
  const pesam = difs.filter(([d, dr]) => Math.max(d, dr) >= 0.08).length; if (pesam < 3) falhas.push(`dilemas: só ${pesam} com diferença ≥ 8% (mín. 3)`); linhas.push(`dilemas que pesam (≥ 8%): ${pesam} de ${difs.length}`);
  if (difs.some(([d, dr, epilogo]) => !epilogo && Math.max(d, dr) > 0.2)) falhas.push('dilemas: alguma opção muda o tempo em mais de 20% (armadilha)'); // no epílogo curto a armadilha é passar de 3 h (acima)
  // projetos condicionais (pas_frente2, pas_caracol): com passarelas de mentira na planta, entram no jogo e o robô termina
  const pr = spawnSync(process.execPath, ['--import', new URL('./passarelas-teste.mjs', import.meta.url).href, fileURLToPath(import.meta.url), '--passarelas'], { encoding: 'utf8' });
  linhas.push('passarelas condicionais: ' + (pr.stdout || pr.stderr || '').trim().split('\n').join(' | ')); if (pr.status !== 0) falhas.push('passarelas condicionais: ' + (pr.stdout || pr.stderr || '').trim());
  console.log(linhas.join('\n'));
  console.log(falhas.length ? `\nFALHAS (${falhas.length}):\n- ` + falhas.join('\n- ') : '\nTudo nas faixas.');
  process.exitCode = falhas.length ? 1 : 0;
}

// ------------------------------------------------------------------ linha de comando
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--todos')) todos();
  else if (process.argv.includes('--passarelas')) { // com a pré-carga passarelas-teste.mjs
    const f = []; if (!PROJ.pas_frente2 || !PROJ.pas_caracol) f.push('pas_frente2/pas_caracol não entraram (rode com --import ./ferramentas/passarelas-teste.mjs)');
    else { f.push(...invariantes()); const R = rodar({ passo: 3, semente: 1 }); if (R.travou || !R.terminou) f.push(R.travou || 'não terminou'); for (const k of ['pas_frente2.e1', 'pas_caracol.e1']) if (!R.J.feita(k)) f.push(k + ' não foi feita');
      if (!f.length) console.log(`ok (${R.dias.toFixed(1)} dias no contínuo, as duas passarelas feitas)`); }
    if (f.length) console.log(f.join('; ')); process.exitCode = f.length ? 1 : 0;
  }
  else if (process.argv.includes('--testes')) { const f = [...invariantes(), ...testes()]; console.log(f.length ? f.join('\n') : 'testes ok'); process.exitCode = f.length ? 1 : 0; }
  else {
    const E = process.env; const R = rodar({ passo: +(process.argv[2] || 3), ritmo: +(process.argv[3] || 1), sessoes: E.SESSOES === '1' ? SESSOES_PADRAO : E.SESSOES, escolha: E.ESCOLHA || 0, mutirao: !!+E.MUTIRAO, deposito: !!+E.DEPOSITO, robo: E.ROBO, cadeia: !!+E.CADEIA, semente: E.SEMENTE != null ? +E.SEMENTE : undefined, etapas: !!E.ETAPAS, emprestimo: !!+E.EMPRESTIMO, aceleradores: E.ACELERA === '0' ? 0 : 1, auto: E.AUTO === '0' ? 0 : 1 });
    console.log(relatorio(R, true)); if (R.travou || !R.terminou) process.exitCode = 1;
  }
}
