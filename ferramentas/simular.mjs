// Robô que joga sozinho para medir o equilíbrio: quanto tempo cada capítulo leva, onde trava,
// quanto as oficinas trabalham e se cada regra nova (cadeia, licenças, dilemas, depósito) termina o jogo.
// Uso: node ferramentas/simular.mjs [passo_min=3] [ritmo=1]
//   SESSOES='7:30-7:45,12:30-12:45,18:30-18:45,22:00-22:15'  joga só nessas janelas (fora delas o tempo passa)
//   ESCOLHA=0|1|alt  opção do Conselho   MUTIRAO=1 usa fichas   DEPOSITO=1 compra matéria-prima
//   ROBO=meta  só coleta e segue J.planoMeta() (Meta em foco)   CADEIA=1 encomenda em cadeia   SEMENTE=n sorteios fixos
//   ETAPAS=1 registra cada etapa e módulo      RELATORIO=1 detalhes por capítulo
// npm run simular:todos (node ferramentas/simular.mjs --todos): testes de regra, matriz de 8 combinações e
// dilemas; sai com código 1 se houver TRAVADO ou algum número fora das faixas.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { novoEstado, prepararSave, Jogo, TOPOGRAFO, FICHAS_MAX, N_MODULOS, F_PRODUTO, COFRE_H } from '../fonte/sim/estado.js';
import { ITENS, PREDIOS, USINAS, OFICINAS, receitas } from '../fonte/data/itens.js';
import { PROJETOS, PROJ, MODULOS, POP_NIVEL, LIMITE_CAP, SERVICO_NIVEL, BEM_NIVEL, PRESSAO_MORADIA } from '../fonte/data/obras.js';
import { CAPITULOS, FALAS_ETAPA, EFEITOS, TUTORIAL } from '../fonte/data/historia.js';

const DIA0 = Date.UTC(2026, 0, 1); const H = 3600e3;
const SESSOES_PADRAO = '7:30-7:45,12:30-12:45,18:30-18:45,22:00-22:15';
const semente = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const LIC = ['estaca', 'baliza', 'trena'];

// ------------------------------------------------------------------ uma partida
export function rodar(o = {}) {
  const r0 = Math.random; if (o.semente != null) Math.random = semente(o.semente);
  try { return partida(o); } finally { Math.random = r0; }
}
function partida(o) {
  const passo = (o.passo ?? 3) * 60000; const T0 = DIA0 + 7 * H; let t = T0;
  const S = o.estado ? prepararSave(JSON.parse(JSON.stringify(o.estado)), t) : novoEstado(t); S.ritmo = o.ritmo ?? 1; const J = new Jogo(S); // o.estado: continua um save (inclusive antigo)
  const janelas = o.sessoes ? o.sessoes.split(',').map((s) => s.split('-').map((h) => { const [a, b] = h.split(':').map(Number); return a * 60 + (b || 0); })) : null;
  const minDia = () => ((t - DIA0) / 60000) % 1440; const dentro = () => !janelas || janelas.some(([a, b]) => minDia() >= a && minDia() < b);
  const proxJanela = () => { const m = minDia(); let d = Infinity; for (const [a] of janelas) { const x = a > m ? a - m : a + 1440 - m; d = Math.min(d, x); } return t + d * 60000; };
  const hora = () => ((t - T0) / H).toFixed(2).padStart(7) + 'h';
  const log = []; const M = {}; const cap = () => S.cap;
  const m = (c) => (M[c] ||= { ini: t, dur: 0, turnos: 0, semAcao: 0, parado: 0, bloq: {}, bloqTurnos: {}, credMin: Infinity, credMax: 0, credFim: 0, niveis: 0, pedidos: 0, compras: 0, vendas: 0, etapas: 0, modulos: 0, obrasMax: 0, obrasAm: [], mutUsado: 0, bemFim: 0 });
  const util = {}; const desde = { usina1: T0 }; let nNovo = 0, nNovo6 = 0, nFim = 0, nNivelEv = 0;
  J.on((tipo, d) => {
    const c = m(cap());
    if (tipo === 'produto' && d.fim) util[d.predio] = (util[d.predio] || 0) + (d.fim - d.ini);
    if (tipo === 'produzir') util[d.predio] = (util[d.predio] || 0) + (d.fim - d.ini) / S.predios[d.predio].nSlots;
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
  // almoxarifado apertado: vende primeiro o que mais sobra (o depósito aceita 20 por janela)
  const venderSobras = (need) => { const alvo = Math.max(8, Math.floor(J.capacidade * 0.12)); const sob = Object.entries(S.itens).filter(([k, n]) => ITENS[k].tipo !== 'especial' && n > (need[k] || 0)).map(([k, n]) => [k, n - (need[k] || 0)]).sort((a, b) => b[1] - a[1]);
    for (const [k, q] of sob) { if (J.livre >= alvo) break; const r = J.vender(k, Math.min(q, alvo - J.livre)); if (r === 'ok') m(cap()).vendas++; else if (r === 'limite') break; } };
  const usarMutirao = () => { // na obra de meta mais longa (etapas e módulos), se faltar mais de 20 min
    const c = J.capitulo(); const metas = new Set((c?.metas || []).filter((x) => x.tipo === 'etapa').map((x) => x.id.split('.')[0])); let best = null, bf = 0;
    for (const [k, st] of Object.entries(S.etapas)) if (st.estado === 'obra') { const f = (st.fim - t) * (metas.has(k.split('.')[0]) ? 2 : 1); if (f > bf) { bf = f; best = { etapa: k }; } }
    for (const [f, arr] of Object.entries(S.modulos)) arr.forEach((mm, i) => { if (mm.obra?.estado === 'obra' && mm.obra.fim - t > bf) { bf = mm.obra.fim - t; best = { modulo: [f, i] }; } });
    if (best && bf > 20 * 60000 && J.mutirao(best) === 'ok') { m(cap()).mutUsado++; acoes++; }
  };
  const pedidosUteis = (need) => S.pedidos.forEach((p, i) => { // só entrega sobra, e só se a recompensa serve para alguma coisa
    if (!p.itens || !Object.entries(p.itens).every(([k, n]) => (S.itens[k] || 0) - (need[k] || 0) >= n)) return; const R = p.recompensa || {};
    const serve = Object.keys(R.itens || {}).some((k) => LIC.includes(k) || S.itens[k] < 4) || (R.bem && J.bem < 80) || (R.disposicao && S.mutirao < FICHAS_MAX) || S.creditos < 20000;
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
    const livre = { ...S.itens }; for (const x of OFICINAS) { const o2 = S.predios[x]; for (const f of o2.fila) livre[f.item] = (livre[f.item] || 0) + 1; for (const k of o2.prontos) livre[k] = (livre[k] || 0) + 1; } for (const u of USINAS) for (const sl of S.predios[u].slots) if (sl) livre[sl.item] = (livre[sl.item] || 0) + 1;
    const prod = [], bruto = [];
    const exp = (k, n, pr, prof) => { const it = ITENS[k]; const usa = Math.min(livre[k] || 0, n); livre[k] = (livre[k] || 0) - usa; const d = n - usa; if (d <= 0) return; if (it.tipo === 'bruto') { bruto.push([k, d, pr]); return; } prod.push([k, d, pr, prof]); for (const [r, q] of Object.entries(it.req)) exp(r, q * d, pr, prof + 1); };
    listas.forEach((L, pr) => { for (const [k, n] of L) exp(k, n, pr, 0); });
    // licenças que faltam viram madeira, aço e cobre para o topógrafo
    for (const p of PROJETOS) { const nx = J.proximaEtapa(p); if (!nx || !['disponivel', 'prancha'].includes(nx.s)) continue; const f = J.faltaEtapa(p.id + '.' + nx.e.id); for (const k of LIC) if (f[k]) for (const [i, q] of Object.entries(TOPOGRAFO[k].itens)) bruto.push([i, q * f[k], 0]); }
    const need = {}; for (const L of listas.slice(0, 4)) for (const [k, n] of L) need[k] = (need[k] || 0) + n; for (const [k, n] of prod) need[k] = (need[k] || 0) + n;
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
    const bloq = new Set(); let reserva = 0;
    if (S.cap === 5 && (S.marcos[5] || 0) >= 2) for (const e of PROJ.reflorestar.etapas) reserva += J.custoEtapa(PROJ.reflorestar, e);
    const tentar = (p, meta) => {
      if (p.cap > S.cap) { for (const e of p.etapas) if (J.aceitaEntrega(p, e)) J.entregarTudo(p.id + '.' + e.id); return; }
      for (const e of p.etapas) {
        const key = p.id + '.' + e.id; const s = J.situacao(p, e); if (s === 'feita') continue;
        if (s === 'disponivel' || s === 'prancha') {
          J.entregarTudo(key); const falta = Object.keys(J.faltaEtapa(key)); const cu = J.custoEtapa(p, e);
          if (!meta && !falta.length && S.creditos - cu < reserva) { bloq.add('etapa:creditos'); break; }
          const r = conta(J.iniciarEtapa(key)); if (r !== 'ok') { let why = r; if (r === 'falta') why = falta.some((k) => ITENS[k].tipo === 'especial') ? 'licenca' : 'itens'; bloq.add('etapa:' + why); if (meta) reserva += cu; }
        } else if (J.aceitaEntrega(p, e)) J.entregarTudo(key);
        break;
      }
    };
    for (const p of PROJETOS) if (pri.proj.has(p.id)) tentar(p, true);
    const modulo = (f, i, meta) => { const mm = S.modulos[f][i]; if (J.situacaoModulo(f, i) !== 'disponivel') return; const q = J.requisitosModulo(f, i); if (!meta && S.creditos - q.custo < reserva) return; const r = conta(J.melhorarModulo(f, i)); if (r === 'servico') { for (const k of q.servicos) if (J.serv[k] < q.popDepois) bloq.add('serv:' + k); } else if (r !== 'ok') { bloq.add('mod:' + r); if (meta && r !== 'bem') reserva += q.custo; } };
    for (const f of Object.keys(S.modulos)) S.modulos[f].forEach((mm, i) => { if (mm.nivel < (pri.mod[f] || 0)) modulo(f, i, true); });
    for (const p of PROJETOS) if (!pri.proj.has(p.id)) tentar(p, false);
    for (const f of Object.keys(S.modulos)) S.modulos[f].forEach((mm, i) => { if (mm.nivel >= (pri.mod[f] || 0)) modulo(f, i, false); });
    for (const b of bloq) { c.bloq[b] = (c.bloq[b] || 0) + passo / 60000; c.bloqTurnos[b] = (c.bloqTurnos[b] || 0) + 1; }
    if (o.mutirao && S.mutirao > 0) usarMutirao();
    // amplia só o que está limitando: fila cheia com trabalho planejado, ou usina toda ocupada
    pl = plano(pri);
    for (const id of [...USINAS, ...OFICINAS]) { const x = S.predios[id]; if (!x.ok || S.creditos - J.custoEspaco(id) < Math.max(reserva, J.custoEspaco(id) * 2)) continue; const cheio = x.fila ? x.fila.length >= J.vagasFila(id) && pl.prod.some(([k]) => ITENS[k].oficina === id) : x.slots.every(Boolean) && pl.bruto.length; if (cheio) J.ampliar(id); }
    // oficinas: em rodízio pelos itens do plano (metas primeiro, insumos mais profundos antes)
    for (const x of OFICINAS) {
      const o2 = S.predios[x]; if (!o2.ok) continue;
      const cand = pl.prod.filter(([k]) => ITENS[k].oficina === x && J.liberado(k)).sort((a, b) => a[2] - b[2] || b[3] - a[3]).map(([k, d]) => [k, d]);
      // como um jogador: o insumo que uma encomenda mais importante espera não vai para uma menos importante
      const espera = new Set();
      for (let volta = 0; volta < 12 && o2.fila.length < J.vagasFila(x); volta++) { let fez = false; for (const cd of cand) { if (cd[1] <= 0 || o2.fila.length >= J.vagasFila(x)) continue; const req = Object.keys(ITENS[cd[0]].req); if (req.some((r) => espera.has(r))) continue; const r = conta(J.enfileirar(x, cd[0], !!o.cadeia)); if (r === 'ok') { cd[1]--; fez = true; } else if (r === 'falta') for (const k of req) espera.add(k); } if (!fez) break; }
    }
    // usinas: matérias-primas do plano (metas primeiro); sem plano, só se sobrar espaço no almoxarifado
    const raws = []; for (const [k, d, pr] of pl.bruto.sort((a, b) => a[2] - b[2])) if (J.liberado(k)) { const r = raws.find((x) => x[0] === k); if (r) r[1] += d; else raws.push([k, d]); }
    const fallback = ['madeira', 'brita', 'aco', 'argila', 'mudas', 'vidro', 'cobre', 'fibra'].filter((k) => J.liberado(k)); let ai = 0;
    for (const u of USINAS) if (S.predios[u].ok) for (let sl = 0; sl < S.predios[u].nSlots; sl++) {
      if (S.predios[u].slots[sl] || J.livre < 8) continue; let k = null;
      for (let g = 0; g < raws.length && !k; g++) { const r = raws[(ai + g) % raws.length]; if (r[1] > 0) { k = r[0]; r[1]--; ai = (ai + g + 1) % raws.length; } }
      if (!k) { if (J.livre < J.capacidade * 0.3) break; k = fallback[ai++ % fallback.length]; } conta(J.produzir(u, k));
    }
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
      else if (pl.acao === 'produzir') { if (a.topografo) r = J.encomendarLicenca(a.topografo); else for (let q = 0; q < Math.max(1, pl.n); q++) { const x = PREDIOS[a.predio].tipo === 'usina' ? J.produzir(a.predio, pl.item) : J.enfileirar(a.predio, pl.item); if (x !== 'ok') break; r = 'ok'; } }
      if (r !== 'ok') { if (J.livre < 4) venderSobras(plano(prioridades()).need); break; } acoes++;
    }
  }
  let fimSessao = false;
  function turno() {
    J.tick(t); acoes = 0; const c = m(cap()); o.aCadaTurno?.(J, S, t);
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
  L.push(`FIM ${R.horas.toFixed(1)} h (${R.dias.toFixed(1)} dias) nível ${R.S.nivel} créditos ${R.S.creditos} fichas ${R.S.mutirao} pop ${R.J.pop} bem ${R.J.bem}% serv ${JSON.stringify(R.J.serv)}`);
  if (det) for (const [k, c] of Object.entries(R.M)) {
    L.push(`cap ${k}: ${c.dur.toFixed(1)} h, turnos ${c.turnos}, sem ação ${((100 * c.semAcao) / Math.max(1, c.turnos)).toFixed(0)}%, parado ${((100 * c.parado) / Math.max(1, c.turnos)).toFixed(0)}%, etapas ${c.etapas}, módulos ${c.modulos}, níveis +${c.niveis}, créditos ${c.credMin === Infinity ? '-' : c.credMin}..${c.credMax} (fim ${c.credFim}), bem ${c.bemFim}%, pedidos ${c.pedidos}, compras ${c.compras}, vendas ${c.vendas}, mutirão ${c.mutUsado}, obras simultâneas máx ${c.obrasMax} p95 ${c.obrasP95}`);
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
  f(R.dias >= 12 && R.dias <= 16, `jogo em ${R.dias.toFixed(1)} dias (faixa 12 a 16)`);
  for (const [k, c] of Object.entries(R.M)) {
    if (+k === 1) f(c.dur <= 36, `capítulo 1 em ${(c.dur / 24).toFixed(2)} dias (o começo é rápido: máx. 1,5)`);
    else if (+k <= 5) f(c.dur >= 36 && c.dur <= 96, `capítulo ${k} em ${(c.dur / 24).toFixed(2)} dias (faixa 1,5 a 4)`);
    else f(c.dur <= 8, `epílogo em ${c.dur.toFixed(1)} h (máx. 8)`);
    // inflação: o que sobra no fim de um capítulo não passa de 1,5 × o custo do seguinte (com os efeitos das escolhas),
    // inclusive no fim do capítulo 5, diante do epílogo
    if (+k <= 5) { const cs = custoSeguinte(R.J, +k); f(c.credFim <= 1.5 * cs, `créditos no fim do capítulo ${k}: ${c.credFim} > 1,5 × ${cs}`); }
  }
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
    // fila parada: 3 itens na fila e bandeja cheia; +10 h e coleta: o próximo leva o tempo inteiro
    { const S = novoEstado(T); const J = new Jogo(S); S.predios.carpintaria.ok = true; S.itens.madeira = 60; const o = S.predios.carpintaria; o.prontos = Array(7).fill('viga');
      for (let i = 0; i < 3; i++) J.enfileirar('carpintaria', 'viga'); J.tick(T + 10 * H);
      f(o.prontos.length === 9 && o.fila.length === 1 && !o.fila[0].fim, `bandeja cheia deveria parar a fila (prontos ${o.prontos.length}, fila ${o.fila.length}, fim ${o.fila[0]?.fim})`);
      J.tick(T + 20 * H); J.coletarOficina('carpintaria'); const g = o.fila[0]; f(g && Math.abs(g.fim - g.ini - J.durItem('viga')) < 2 && g.ini === T + 20 * H, 'depois da coleta o próximo item deveria levar o tempo inteiro'); }
    // encomenda em cadeia: concreto sem cimento puxa da bandeja da própria central; pendente vencido libera a vaga
    { const S = novoEstado(T); const J = new Jogo(S); S.nivel = 6; S.predios.concreto.ok = true; S.predios.carpintaria.ok = true; S.itens.brita = 20; S.itens.argila = 5;
      f(J.enfileirar('concreto', 'concreto', true) === 'ok' && S.predios.concreto.fila[0].pend, 'item sem insumos deveria entrar pendente');
      f(J.enfileirar('concreto', 'cimento') === 'ok' && S.predios.concreto.fila[0].item === 'cimento' && S.predios.concreto.fila[0].fim, 'pendente não pode segurar a fila');
      J.tick(T + 2 * H); f(S.predios.concreto.prontos.includes('concreto'), 'o pendente deveria puxar o cimento pronto e produzir');
      const S2 = novoEstado(T); const J2 = new Jogo(S2); S2.nivel = 6; S2.predios.carpintaria.ok = true; J2.enfileirar('carpintaria', 'trelica', true); J2.tick(T + 13 * H); f(S2.predios.carpintaria.fila.length === 0, 'pendente sem insumos por 12 h deveria liberar a vaga'); }
    // tempo fechado: 3 dias em no máximo 288 passos, e em menos de 100 ms
    { const S = novoEstado(T); const J = new Jogo(S); S.predios.carpintaria.ok = true; S.itens.madeira = 20; for (let i = 0; i < 3; i++) J.enfileirar('carpintaria', 'viga'); const t0 = performance.now(); J.tick(T + 72 * H); f(performance.now() - t0 < 100, 'avanço offline caro demais'); f(S.predios.carpintaria.prontos.length === 3, 'avanço offline não produziu a fila'); }
    // níveis: dois de uma vez geram um evento só; nível não dá ficha
    { const S = novoEstado(T); const J = new Jogo(S); const ev = []; J.on((t, d) => t === 'nivel' && ev.push(d)); const fichas = S.mutirao; J._xp(200, 'teste'); f(ev.length === 1 && ev[0].de === 1 && ev[0].para === 4 && ev[0].especiais.length === 3 && ITENS[ev[0].especial], 'vários níveis de uma vez deveriam gerar um único evento'); f(S.mutirao === fichas, 'subir de nível não dá ficha'); }
    // falas: uma por etapa
    { const falta = []; for (const p of PROJETOS) for (const e of p.etapas) if (!FALAS_ETAPA[p.id + '.' + e.id]) falta.push(p.id + '.' + e.id); f(!falta.length, 'etapas sem fala: ' + falta.join(', ')); }
    // migração v1 → v2 (saves sintéticos: início, capítulo 3 com escolhas antigas e 5 fichas, epílogo)
    { const v1 = (cap, o = {}) => { const S = novoEstado(T - 5 * 24 * H); S.v = 1; S.cap = cap; delete S.disposicao; delete S.topografo; delete S.deposito; delete S.bemTemp; delete S.marcos; delete S.itens.estaca; S.itens.nó = 3; S.predios.velho = { ok: true }; S.modulos.anel.push({ nivel: 2, obra: null }); S.stats = { coletas: 10, obras: 2, jogadoMs: 5 }; S.dicas.guia = 1; Object.assign(S, o); return JSON.parse(JSON.stringify(S)); };
      const a = prepararSave(v1(1), T); const Ja = new Jogo(a); f(Number.isFinite(Ja.ocupado) && a.v === 2 && a.itens.estaca === 0 && a._orfaos?.itens?.nó === 3 && a._orfaos?.predios?.velho && a._orfaos?.modulos?.anel && a.dicas.guia === 1, 'migração do início');
      const b0 = v1(3, { mutirao: 5, capEscolhas: { 1: 'usina+', 2: 'mutirao2' }, bonus: { usina: 0.15, oficina: 0, almox: 0, repasse: 0, bem: 0, xp: 0 }, nivel: 16, xp: 9000, creditos: 50000 }); b0.itens.kitvet = 2; b0.predios.laboratorio = { ok: true, fila: [{ item: 'racao', ini: T - 1000, fim: T + 1000 }], prontos: [], nFila: 4 }; b0.etapas['biblioteca.e1'] = { estado: 'feita', entregue: {} }; b0.modulos.anel.forEach((x) => (x.nivel = 3));
      const b = prepararSave(b0, T); const Jb = new Jogo(b); Jb.agora = T;
      f(b.mutirao === 3 && b.disposicao === 100 && Jb.ef.usina === 0.15 && b.capEscolhas[1] === 'legado:usina+' && b.creditos === 50000 + 4500 && b._avisos?.length === 1 && b.nivel === 16 && b.feita !== 0 && Jb.feita('biblioteca.e1') && b.modulos.anel.every((x) => x.nivel === 3), 'migração do capítulo 3 (bônus, fichas, progresso)');
      const r0 = v1(3, { repasse: { acum: 40538.7, t: T - H } }); const cr0 = r0.creditos; const rs = prepararSave(r0, T); const Jr = new Jogo(rs); Jr.tick(T);
      f(rs.creditos === cr0 + 40538 && rs.repasse.acum <= Jr.taxaRepasse() * 60 * COFRE_H + 1e-6 && rs._avisos?.some((x) => x.includes('cofre antigo')), 'migração: o cofre de repasses antigo vira créditos, com aviso');
      { const S = novoEstado(T); const J = new Jogo(S); J.tick(T); const max = J.taxaRepasse() * 60 * COFRE_H; S.repasse.acum = max * 1.5; J.tick(T + 60000); f(S.repasse.acum === max * 1.5, 'o cofre de repasses não pode encolher quando a taxa cai'); }
      f(Jb.liberado('racao') === false || b.legado.includes('racao'), 'item do capítulo 5 na fila continua liberado'); f(b.predios.laboratorio.fila.length === 1, 'fila preservada');
      f(Math.abs(Jb.durItem('bloco') - ITENS.bloco.t0 * 1000 * F_PRODUTO) < 1 && Jb.fObra(3) === 0.7, 'ritmo novo entra em rampa');
      const c0 = v1(6, { capEscolhas: { 1: 'usina+', 2: 'repasse+', 3: 'bem+', 4: 'xp+', 5: 'mutirao2' } }); c0.etapas['reflorestar.e1'] = { estado: 'prancha', entregue: { muda: 15, substrato: 2 } }; const muda0 = c0.itens.muda;
      const c = prepararSave(c0, T); f(c.etapas['reflorestar.e1'].entregue.muda === 8 && c.itens.muda === muda0 + 7 && !c.etapas['reflorestar.e0'], 'epílogo antigo: entrega acima do pedido volta ao almoxarifado');
      const d = prepararSave(prepararSave(v1(2), T), T); f(d.v === 2 && !d._orfaos?.x, 'normalizar é idempotente');
      const d2 = prepararSave({ ...novoEstado(T), mutirao: 7, disposicao: 250, creditos: -5 }, T); f(d2.mutirao === 3 && d2.disposicao === 100 && d2.creditos === 0, 'normalizar limita fichas, disposição e créditos');
      const e = prepararSave({ v: 1, itens: { madeira: 'x' }, modulos: {}, etapas: { 'nada.e1': {} } }, T); f(new Jogo(e).ocupado === 0 && e._orfaos.etapas['nada.e1'], 'save quebrado vira jogo válido');
      let g = null; try { g = prepararSave({ v: 1, cap: 2, itens: {}, modulos: { anel: 5 }, predios: { carpintaria: { ok: true, fila: 5, prontos: 'x' }, x: { fila: 5 } }, pedidos: [{ itens: 5 }], etapas: { 'reflorestar.e1': 5 } }, T); const Jg = new Jogo(g); Jg.tick(T + H); } catch (err) { g = null; } f(g && g.predios.carpintaria.ok && g.predios.carpintaria.fila.length === 0, 'save com listas quebradas não pode lançar exceção');
      let h = null; try { const h0 = JSON.parse(JSON.stringify(novoEstado(T))); h0.etapas['constructor.e1'] = { estado: 'feita' }; h0.itens.toString = 3; h0.predios.hasOwnProperty = { ok: true }; h0.topografo = { k: 'valueOf' }; h0.capEscolhas = { 1: 'constructor' }; h = prepararSave(h0, T); new Jogo(h).tick(T + H); } catch (err) { h = null; }
      f(h && h._orfaos?.etapas?.['constructor.e1'] && h.topografo === null && !Object.hasOwn(h.itens, 'toString'), "save com chaves como 'constructor' não pode lançar exceção");
      // o robô continua cada save migrado até o fim, sem trava
      for (const [nome, v] of [['início', v1(1)], ['capítulo 3', b0], ['epílogo', c0]]) { const R = rodar({ estado: v, passo: 5, semente: 3 }); f(R.terminou && !R.travou, `robô a partir do save v1 (${nome}): ${R.travou || 'não terminou'}`); } }
    // recarregar não dá vagas de fila de graça nem devolve material entregue a mais por causa de uma escolha
    { let S = novoEstado(T); S.cap = 3; S.capEscolhas = { 1: 'amplo', 2: 'biblio24h' }; S.predios.carpintaria.ok = true; S.predios.carpintaria.fila = Array.from({ length: 6 }, () => ({ item: 'viga', ini: 0, fim: 0 }));
      S.etapas['biblioteca.e1'] = { estado: 'feita', entregue: {} }; S.etapas['biblioteca.e2'] = { estado: 'feita', entregue: {} }; S.etapas['biblioteca.e3'] = { estado: 'prancha', entregue: { estante: 8, trelica: 3 } }; S.etapas['crd.e1'] = { estado: 'obra', entregue: { premoldado: 5 }, ini: T, fim: T + H }; // em obra o material já foi usado (mesmo acima do pedido-base)
      const est0 = S.itens.estante, pre0 = S.itens.premoldado; for (let i = 0; i < 3; i++) S = prepararSave(JSON.parse(JSON.stringify(S)), T); const J = new Jogo(S);
      f(S.predios.carpintaria.nFila === 3 && J.vagasFila('carpintaria') === 6, `recarregar com 'amplo' deu vagas de graça (nFila ${S.predios.carpintaria.nFila})`);
      f(S.etapas['biblioteca.e3'].entregue.estante === 8 && S.itens.estante === est0 && !J.faltaEtapa('biblioteca.e3').estante, 'recarregar devolveu estantes pedidas pela escolha biblio24h');
      f(S.etapas['crd.e1'].entregue.premoldado === 5 && S.itens.premoldado === pre0, 'recarregar devolveu material de etapa em obra'); }
    // depósito: estoque de 10, preço sobe; venda até 20 por janela
    { const S = novoEstado(T); const J = new Jogo(S); J.agora = T; S.creditos = 1e6; S.nivel = 5; const p0 = J.precoCompra('madeira'); for (let i = 0; i < 12; i++) J.comprar('madeira'); f(S.itens.madeira === 16 && J.estoqueDeposito('madeira').n === 0 && J.comprar('madeira') === 'esgotado' && J.precoCompra('madeira') > p0, 'estoque do depósito');
      S.itens.brita = 40; J.vender('brita', 30); f(S.itens.brita === 20 && J.vender('brita', 1) === 'limite', 'limite de vendas'); J.agora = T + 4 * H; J.tick(T + 4 * H); f(J.estoqueDeposito('madeira').n === 10, 'estoque renova na janela seguinte'); }
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
      J4.coletarOficina('carpintaria'); J4.tick(T + 3 * H); f(S4.predios.carpintaria.prontos.filter((k) => k === 'viga').length === 3, 'depois da coleta as vigas saem');
      // encomenda em cadeia sem insumos: o plano pede os insumos, não mais uma encomenda do mesmo produto
      const S5 = novoEstado(T); const J5 = new Jogo(S5); J5.agora = T; S5.nivel = 5; S5.predios.carpintaria.ok = true; for (const k of ['pas_frente.e1', 'lago.e1', 'sede.e1']) S5.etapas[k] = { estado: 'feita', entregue: {} }; S5.modulos.anel.slice(0, 3).forEach((x) => (x.nivel = 2)); S5.etapas['sede.e2'] = { estado: 'prancha', entregue: { concreto: 3 } };
      S5.itens.madeira = 0; S5.itens.viga = 0; S5.predios.carpintaria.fila = Array.from({ length: 4 }, () => ({ item: 'viga', ini: 0, fim: 0, pend: true, desde: T })); J5._derivar();
      const p5 = J5.planoMeta(); f(p5?.acao === 'produzir' && p5.item === 'madeira', 'vigas pendentes: a Meta em foco deveria pedir madeira (' + p5?.texto + ')'); }
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
  // e ampliar o que trava) termina na mesma faixa de 12 a 16 dias, com o epílogo em até 8 h
  if (H.terminou && C.terminou) { const ep = H.M[6]?.dur ?? 0; linhas.push(`Meta em foco: ${H.dias.toFixed(1)} dias (${(H.dias / C.dias).toFixed(2)} × o robô normal; faixa 12 a 16), epílogo ${ep.toFixed(1)} h, créditos no fim ${H.S.creditos}`);
    if (H.dias < 12 || H.dias > 16 || H.dias > 1.5 * C.dias) falhas.push(`Meta em foco: ${H.dias.toFixed(1)} dias (faixa 12 a 16, máx. 1,5 × ${C.dias.toFixed(1)})`); if (ep > 8) falhas.push(`Meta em foco: epílogo em ${ep.toFixed(1)} h (máx. 8)`); }
  // bem-estar: ~77% no fim do capítulo 3 (média das sessões) e sem saturar antes do capítulo 5, para a pressão de
  // moradia e as opções de bem-estar dos dilemas pesarem
  const b3 = [C, D, E, F, G].filter((R) => R.M[3]).map((R) => R.M[3].bemFim); const mb3 = b3.reduce((a, b) => a + b, 0) / Math.max(1, b3.length);
  linhas.push(`bem-estar no fim do capítulo 3: ${b3.join(', ')} (média ${mb3.toFixed(0)}%, faixa 70 a 85); fim dos capítulos 2 a 4: ${[C, D, E, F, G].map((R) => [2, 3, 4].map((k) => R.M[k]?.bemFim).join('/')).join(', ')}`);
  if (mb3 < 70 || mb3 > 85 || b3.some((x) => x < 55 || x > 90)) falhas.push(`bem-estar no fim do capítulo 3: ${b3.join(', ')} (média ${mb3.toFixed(0)}%)`);
  for (const R of [A, B, C, D, E, F, G]) for (const k of [2, 3, 4]) if (R.M[k]?.bemFim >= 100) falhas.push(`bem-estar saturou em 100% no fim do capítulo ${k}`);
  const san = [C, D, E, F, G].flatMap((R) => Object.values(R.M).map((c) => (c.bloqTurnos['serv:saneamento'] || 0) / Math.max(1, c.turnos))); linhas.push(`bloqueio por saneamento: até ${(Math.max(...san) * 100).toFixed(0)}% dos turnos de um capítulo`);
  if (!san.some((x) => x > 0) || san.some((x) => x >= 0.2)) falhas.push(`saneamento: bloqueio de ${(Math.max(...san) * 100).toFixed(0)}% (precisa ser > 0 e < 20%)`);
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
    if (k === 5) { linhas.push(`dilema do capítulo 5: epílogo ${(a * 60).toFixed(0)} × ${(b * 60).toFixed(0)} min (${(d * 100).toFixed(0)}%)`); difs.push([d, 0]); if (Math.max(...base.map(cap), ...V.map(cap)) > 3) falhas.push('dilema 5: epílogo passou de 3 h no contínuo (armadilha)'); continue; }
    difs.push([d, dr]); linhas.push(`dilema do capítulo ${k}: capítulo ${k + 1} ${a.toFixed(1)} × ${b.toFixed(1)} h (${(d * 100).toFixed(0)}%), resto do jogo ${ra.toFixed(0)} × ${rb.toFixed(0)} h (${(dr * 100).toFixed(0)}%)`);
  }
  const pesam = difs.filter(([d, dr]) => Math.max(d, dr) >= 0.08).length; if (pesam < 3) falhas.push(`dilemas: só ${pesam} com diferença ≥ 8% (mín. 3)`); linhas.push(`dilemas que pesam (≥ 8%): ${pesam} de ${difs.length}`);
  if (difs.some(([d, dr]) => Math.max(d, dr) > 0.2)) falhas.push('dilemas: alguma opção muda o tempo em mais de 20% (armadilha)');
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
    const E = process.env; const R = rodar({ passo: +(process.argv[2] || 3), ritmo: +(process.argv[3] || 1), sessoes: E.SESSOES === '1' ? SESSOES_PADRAO : E.SESSOES, escolha: E.ESCOLHA || 0, mutirao: !!+E.MUTIRAO, deposito: !!+E.DEPOSITO, robo: E.ROBO, cadeia: !!+E.CADEIA, semente: E.SEMENTE != null ? +E.SEMENTE : undefined, etapas: !!E.ETAPAS });
    console.log(relatorio(R, true)); if (R.travou || !R.terminou) process.exitCode = 1;
  }
}
