// Robô que joga sozinho para medir o equilíbrio: quanto tempo cada capítulo leva e onde trava.
// Uso: node ferramentas/simular.mjs [intervalo_min=3] [ritmo=1]
import { novoEstado, Jogo } from '../fonte/sim/estado.js';
import { ITENS, PREDIOS, USINAS, OFICINAS, receitas } from '../fonte/data/itens.js';
import { PROJETOS, PROJ, MODULOS } from '../fonte/data/obras.js';

const passoMin = +(process.argv[2] || 3); const ritmo = +(process.argv[3] || 1);
let t = Date.UTC(2026, 0, 1); const S = novoEstado(t); S.ritmo = ritmo; const J = new Jogo(S);
const log = []; J.on((tipo, d) => { if (tipo === 'etapaFeita' && process.env.ETAPAS) log.push(`${hora()}   ${d.key}`); if (tipo === 'moduloFeito' && process.env.ETAPAS) log.push(`${hora()}   módulo ${d.faixa}${d.i}→${d.nivel}`); if (tipo === 'nivel') log.push(`${hora()} nível ${d.nivel}`); if (tipo === 'novoCapitulo') log.push(`${hora()} >>> capítulo ${d.cap?.n} (${d.cap?.nome})  vida ${J.vida().toFixed(0)}%`); });
const hora = () => { const h = (t - Date.UTC(2026, 0, 1)) / 3600000; return (h).toFixed(1).padStart(6) + 'h'; };
function necessidades() { // soma dos itens que faltam para as próximas obras e módulos
  const need = {};
  const add = (k, n) => { need[k] = (need[k] || 0) + n; };
  for (const p of PROJETOS) { if (!J.projAberto(p) && p.cap <= S.cap) continue; const nx = J.proximaEtapa(p); if (!nx) continue; if (nx.s === 'disponivel' || nx.s === 'prancha') for (const [k, n] of Object.entries(J.faltaEtapa(p.id + '.' + nx.e.id))) add(k, n); }
  for (const f of Object.keys(S.modulos)) S.modulos[f].forEach((m, i) => { if (J.situacaoModulo(f, i) === 'disponivel') { const r = J.requisitosModulo(f, i); if (r.servOk && r.bemOk) for (const [k, n] of Object.entries(r.itens)) add(k, n); } });
  // expande a demanda pelos produtos intermediários e matérias-primas (descontando o estoque)
  const total = {}; const bruto = {}; const est = { ...S.itens };
  const exp = (k, n) => { const it = ITENS[k]; if (!it || it.tipo === 'especial' || n <= 0) return; const usa = Math.min(est[k] || 0, n); est[k] = (est[k] || 0) - usa; const f = n - usa; total[k] = (total[k] || 0) + n; if (!f) return; if (it.tipo === 'bruto') bruto[k] = (bruto[k] || 0) + f; else for (const [r, q] of Object.entries(it.req)) exp(r, q * f); };
  for (const [k, n] of Object.entries(need)) exp(k, n);
  for (const [k, n] of Object.entries(total)) need[k] = Math.max(need[k] || 0, n);
  return { need, bruto };
}
function turno() {
  J.tick(t);
  // coleta tudo
  for (const u of USINAS) if (S.predios[u].ok) for (const i of J.prontosUsina(u)) J.coletarUsina(u, i);
  for (const o of OFICINAS) if (S.predios[o].ok) J.coletarOficina(o);
  J.coletarRepasse();
  // aprova obras prontas
  for (const [k, st] of Object.entries(S.etapas)) if (st.estado === 'pronta') J.aprovarEtapa(k);
  for (const f of Object.keys(S.modulos)) S.modulos[f].forEach((m, i) => { if (m.obra?.estado === 'pronta') J.aprovarModulo(f, i); });
  if (J.capitulo() && J.capitulo().metas.every((m) => J.metaFeita(m)) && S.capEscolhas[J.capitulo().n] === undefined) J.concluirCapitulo(J.capitulo().escolha?.[0]?.id);
  // constrói prédios
  for (const id of Object.keys(PREDIOS)) if (!S.predios[id].ok && PREDIOS[id].nivel <= S.nivel && S.creditos > (PREDIOS[id].custo || 0) + 500) J.construirPredio(id);
  // amplia espaços se sobra dinheiro
  for (const id of [...USINAS, ...OFICINAS]) if (S.predios[id].ok && S.creditos > J.custoEspaco(id) * 4) J.ampliar(id);
  J.ampliarAlmox();
  // entrega e inicia obras / módulos
  for (const p of PROJETOS) { const nx = J.proximaEtapa(p); if (!nx) continue; if (nx.s === 'disponivel' || nx.s === 'prancha') { const key = p.id + '.' + nx.e.id; J.entregarTudo(key); J.iniciarEtapa(key); } }
  for (const f of Object.keys(S.modulos)) S.modulos[f].forEach((m, i) => { if (J.situacaoModulo(f, i) === 'disponivel') J.melhorarModulo(f, i); });
  // oficinas: produz o que falta (maior demanda primeiro)
  const { need, bruto } = necessidades();
  for (const o of OFICINAS) { if (!S.predios[o].ok) continue; const rs = receitas(o).filter((k) => J.liberado(k)).sort((a, b) => (need[b] || 0) - (need[a] || 0)); for (const k of rs) { if ((need[k] || 0) <= (S.itens[k] || 0)) continue; while (J.enfileirar(o, k) === 'ok') { if ((S.itens[k] || 0) + 1 >= (need[k] || 0)) break; } } }
  // usinas: matérias-primas mais necessárias
  const alvo = Object.entries(bruto).sort((a, b) => b[1] - a[1]).map(([k]) => k).filter((k) => J.liberado(k));
  const fallback = ['madeira', 'brita', 'aco', 'argila', 'mudas', 'vidro', 'cobre', 'fibra'].filter((k) => J.liberado(k));
  let ai = 0; for (const u of USINAS) if (S.predios[u].ok) for (let s = 0; s < S.predios[u].nSlots; s++) { if (J.livre < 8) break; const k = alvo.length ? alvo[ai++ % alvo.length] : fallback[ai++ % fallback.length]; J.produzir(u, k); }
  // pedidos
  S.pedidos.forEach((p, i) => { if (p.itens && Object.entries(p.itens).every(([k, n]) => (S.itens[k] || 0) - (need[k] || 0) >= n)) J.entregarPedido(i); });
  // se o almoxarifado lota, vende excedentes
  if (J.livre < 4) for (const [k, n] of Object.entries(S.itens)) if (ITENS[k].tipo !== 'especial' && n > (need[k] || 0) + 2) J.vender(k, n - (need[k] || 0) - 2);
}
const fim = t + 1000 * 3600 * 24 * 60; let ultimoCap = 0; let parado = 0; let vidaAnt = 0;
while (t < fim && !(S.etapas['reflorestar.e1']?.estado === 'feita')) {
  turno(); t += passoMin * 60000;
  const v = J.vida(); if (Math.abs(v - vidaAnt) < 1e-6) parado++; else parado = 0; vidaAnt = v;
  if (parado > (24 * 60) / passoMin) { log.push(`${hora()} TRAVADO. cap ${S.cap} nível ${S.nivel} créditos ${S.creditos} vida ${v.toFixed(1)}%`); break; }
}
for (const l of log) console.log(l);
console.log('fim', hora(), 'vida', J.vida().toFixed(1) + '%', 'nível', S.nivel, 'créditos', S.creditos, 'pop', J.populacao(), 'bem', J.bemEstar(), 'serv', JSON.stringify(J.servicos()));
const pend = []; for (const p of PROJETOS) { const nx = J.proximaEtapa(p); if (nx) pend.push(`${p.id}.${nx.e.id}:${nx.s}:${JSON.stringify(J.faltaEtapa(p.id + '.' + nx.e.id))}`); } console.log('pendentes', pend.slice(0, 12).join(' | '));
const mods = Object.entries(S.modulos).map(([f, a]) => f + ':' + a.map((m) => m.nivel).join('')); console.log('módulos', mods.join(' '));
if (process.env.DEBUG) { console.log(JSON.stringify(Object.fromEntries(Object.entries(S.predios).map(([k, v]) => [k, { ok: v.ok, fila: v.fila?.map((f) => f.item), prontos: v.prontos, slots: v.slots?.map((s) => s && s.item) }])))); console.log(JSON.stringify(Object.fromEntries(Object.entries(S.itens).filter(([, v]) => v)))); console.log('livre', J.livre, 'mod anel 0', J.situacaoModulo('anel', 0), JSON.stringify(J.requisitosModulo('anel', 0))); console.log(JSON.stringify(necessidades())); }
